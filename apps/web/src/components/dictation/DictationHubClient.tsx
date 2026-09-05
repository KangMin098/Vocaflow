// apps/web/src/components/dictation/DictationHubClient.tsx
//
// 받아쓰기 허브 — "오늘 뭘 받아쓸지"를 시스템이 먼저 정하고, 고르고 싶으면 고르게 한다.
//
// v06 까지 이 화면은 localStorage 시드 3개를 나열하는 선택지 화면이었다. 그 구조에서는
// 학습자가 매일 "무엇을 골라야 느는가"를 스스로 판단해야 했고, 그 판단 비용이 곧
// 이탈이었다. 이제 첫 화면 첫 카드가 **오늘의 5문장**이고, 나머지는 그 아래로 접힌다.
//
// 학습 과학:
//   · Active Recall + Context-Dependent — 문장 안에서 내 단어를 인출한다
//   · Spacing — 오늘의 구성이 복습 임박 단어에서 나온다
//   · Implicit Progress — 게이지 대신 "청취 폭 N단어" 한 줄(§철학4)
//   · Calm UI — 폭죽·뱃지 없음. 완료는 조용한 한 문장으로 알린다(§철학1)

'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, Headphones, Loader2, Play, RotateCcw, Sparkles } from 'lucide-react'

import { ModuleHero } from '@/components/hub/ModuleHero'
import { createClient } from '@/lib/supabase/client'
import { buildDailyDictation, type DailyDictation } from '@/lib/dictation/daily'
import { fetchDictationCatalog, type DictationCatalog } from '@/lib/dictation/catalog'
import {
  fetchDictationOverview,
  fetchDictationWeakness,
  fetchRecentDictationSessions,
  fetchResumableSessionId,
  type DictationOverview,
  type RecentSessionRow,
  type WeaknessRow,
} from '@/lib/dictation/persist'
import { getResumableSession } from '@/lib/dictation/storage'
import { createDictationSession, DictationStartError } from '@/hooks/dictation/useDictationSession'
import type { DictationConfig } from '@/lib/dictation/types'

import { SourcePicker } from './SourcePicker'
import { WeaknessPanel } from './WeaknessPanel'

const DICTATION_ACCENT = '#0EA5E9'

/** 오늘의 받아쓰기 기본값 — 고르는 화면 없이 바로 시작하므로 온건한 중간값. */
const DAILY_CONFIG: DictationConfig = {
  chunkSize: 1,
  count: 'all',
  order: 'sequential',
  scoring: 'smart',
  cefr: 'B1',
  speed: 0.9,
  autoRepeat: 2,
  hintsAllowed: true,
  voice: '',
}

const EMPTY_CATALOG: DictationCatalog = { books: [], scripts: [], sets: [] }

const SOURCE_KIND_LABEL: Record<string, string> = {
  book: '도서',
  text: '스크립트',
  set: '단어장',
  daily: '오늘의 받아쓰기',
  custom: '직접 입력',
}

export function DictationHubClient() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [signedIn, setSignedIn] = useState(false)
  const [overview, setOverview] = useState<DictationOverview | null>(null)
  const [catalog, setCatalog] = useState<DictationCatalog>(EMPTY_CATALOG)
  const [weakness, setWeakness] = useState<WeaknessRow[]>([])
  const [recent, setRecent] = useState<RecentSessionRow[]>([])
  const [daily, setDaily] = useState<DailyDictation | null>(null)
  const [starting, setStarting] = useState(false)
  const [resumeId, setResumeId] = useState<string | null>(null)
  const [startError, setStartError] = useState<string | null>(null)
  /** 자료를 못 불러온 이유 — 이게 없으면 지하철에서 스피너가 최종 상태가 된다 */
  const [loadError, setLoadError] = useState(false)
  /** [다시 시도] 가 올리는 세대 번호 — 값이 바뀌면 아래 effect 가 다시 돈다 */
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setLoadError(false)
    void (async () => {
      // try/catch/finally 가 없던 시절: getUser() 나 buildDailyDictation 하나만 던져도
      // setLoading(false) 에 도달하지 못해 회전 아이콘이 **영원히** 남았다. 새로고침 말고는
      // 길이 없는데 화면은 그 사실을 말하지 않았다(B4).
      try {
        const client = createClient()
        const {
          data: { user },
        } = await client.auth.getUser()
        const uid = user?.id ?? null
        if (mounted) setSignedIn(!!uid)

        const [ov, cat, wk, rc, dl] = await Promise.all([
          fetchDictationOverview(client),
          fetchDictationCatalog(client, uid),
          fetchDictationWeakness(client, 14),
          uid ? fetchRecentDictationSessions(client, 5) : Promise.resolve([]),
          buildDailyDictation(client, uid),
        ])
        // 이 기기 캐시 우선(즉시), 없으면 DB — 폰에서 시작하고 PC 에서 허브를 열어도
        // 이어하기가 떠야 한다(세션 URL 복원과 같은 이유).
        const local = getResumableSession()?.id ?? null
        const resume = local ?? (await fetchResumableSessionId(client))
        if (!mounted) return
        setOverview(ov)
        setCatalog(cat)
        setWeakness(wk)
        setRecent(rc)
        setDaily(dl)
        setResumeId(resume)
      } catch (e) {
        console.error('[Dictation] 허브 로드 실패:', e)
        if (mounted) setLoadError(true)
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [reloadKey])

  const startDaily = useCallback(async () => {
    if (!daily || starting) return
    setStarting(true)
    setStartError(null)
    // 실패를 삼키지 않는다 — `createDictationSession` 은 이제 던진다. 잡지 않으면
    // 스피너가 영원히 돌고 학습자에겐 "아무 반응 없음" 이 된다(설정 화면에서 겪은 그것).
    let session
    try {
      session = await createDictationSession(daily, DAILY_CONFIG)
    } catch (e) {
      setStarting(false)
      setStartError(
        e instanceof DictationStartError && e.reason === 'cache-failed'
          ? '이 브라우저의 저장 공간이 가득 차 세션을 이어받지 못했어요. 사이트 데이터를 정리하고 다시 시도해 주세요.'
          : '오늘의 문장을 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.',
      )
      return
    }
    router.push(`/dictate/session?sessionId=${session.id}`)
  }, [daily, starting, router])

  const hasAnything =
    catalog.books.length + catalog.scripts.length + catalog.sets.length > 0

  const heroNote = (() => {
    if (!overview || overview.totalSessions === 0) {
      return '아직 받아쓴 문장이 없어요 — 오늘 5문장으로 시작해 볼까요'
    }
    if (overview.streak >= 2) {
      return `${overview.streak}일 이어오고 있어요 · 한 번에 받아쓴 가장 긴 문장 ${overview.span}단어`
    }
    return `누적 ${overview.totalSentences}문장 · 한 번에 받아쓴 가장 긴 문장 ${overview.span}단어`
  })()

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-8 md:px-6 md:py-10">
      <ModuleHero
        eyebrow="Dictation · 청각 인출"
        title="받아쓰기"
        note={heroNote}
        gradient={{ from: DICTATION_ACCENT, to: '#1D4ED8' }}
        icon={Headphones}
        // 사이드바의 전체 학습 streak 과 다른 지표다 — 라벨에 '받아쓰기'를 박아 혼동을 막는다.
        stats={[
          {
            label: '이번 주',
            value: overview?.weeklyAccuracy != null ? Math.round(overview.weeklyAccuracy) : '—',
            unit: overview?.weeklyAccuracy != null ? '%' : undefined,
            emphasis: true,
          },
          { label: '청취 폭', value: overview?.span ?? 0, unit: '단어' },
          { label: '받아쓰기 연속', value: overview?.streak ?? 0, unit: '일' },
        ]}
      />

      {/* ─── 이어하기 (미완주 세션) ─── */}
      {resumeId && (
        <Link
          href={`/dictate/session?sessionId=${resumeId}`}
          className="flex min-h-[44px] items-center gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-4 py-3 font-body text-[13px] text-[var(--t1)] transition-colors hover:border-[var(--p)] hover:bg-[var(--p-light)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2"
        >
          <Play size={13} className="text-[var(--p)]" />
          풀던 받아쓰기가 남아 있어요
          <ArrowRight size={13} className="ml-auto text-[var(--t2)]" />
        </Link>
      )}

      {/* 로딩 실패 — 빈 화면도, 영원한 스피너도 아닌 "왜 + 다음 한 걸음" */}
      {loadError && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-[var(--r-md)] border border-[var(--bde)] bg-[var(--error-light)] px-4 py-3 sm:flex-row sm:items-center"
        >
          <p className="flex-1 break-keep font-body text-[13px] leading-relaxed text-[var(--error-ink)]">
            지금은 받아쓰기 자료를 불러오지 못했어요. 연결이 끊겼거나 잠시 응답이 없었어요.
          </p>
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-[var(--r-sm)] border border-[var(--error)]/30 bg-[var(--bg)] px-4 font-display text-[12px] font-[700] text-[var(--error-ink)] transition-colors hover:bg-[var(--error-light)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2 active:scale-[0.99]"
          >
            <RotateCcw size={13} aria-hidden />
            다시 시도
          </button>
        </div>
      )}

      {/* 시작 실패 사유 — 버튼만 되돌아오는 화면은 "아무 일도 안 일어났다" 로 읽힌다 */}
      {startError && (
        <p
          role="alert"
          className="rounded-[var(--r-md)] border border-[var(--bde)] bg-[var(--error-light)] px-4 py-3 font-body text-[13px] leading-relaxed text-[var(--error-ink)]"
        >
          {startError}
        </p>
      )}

      {/* ─── 오늘의 받아쓰기 ─── */}
      <DailyCard
        loading={loading}
        loadFailed={loadError}
        daily={daily}
        starting={starting}
        signedIn={signedIn}
        hasAnything={hasAnything}
        onStart={startDaily}
      />

      {/* ─── 자료 고르기 ─── */}
      <SourcePicker catalog={catalog} />

      {/* ─── 약점 ─── */}
      <WeaknessPanel rows={weakness} days={14} />

      {/* ─── 최근 세션 ─── */}
      {recent.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-[15px] font-[700] text-[var(--t1)]">최근 받아쓰기</h2>
          <ul className="flex flex-col divide-y divide-[var(--bg3)] rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)]">
            {recent.map((s) => {
              const acc = s.avgAccuracy
              const accColor =
                acc == null
                  ? 'var(--t3)'
                  : acc >= 90
                    ? 'var(--success)'
                    : acc >= 70
                      ? 'var(--p)'
                      : 'var(--warning)'
              const done = !!s.completedAt
              return (
                <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="shrink-0 rounded-full bg-[var(--bg3)] px-2 py-1 font-display text-[10px] font-[700] text-[var(--t2)]">
                    {SOURCE_KIND_LABEL[s.sourceKind] ?? s.sourceKind}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-body text-[13px] font-[600] text-[var(--t1)]">
                      {s.title}
                    </p>
                    <p className="font-body text-[11px] text-[var(--t2)]">
                      {done
                        ? `${new Date(s.completedAt as string).toLocaleString('ko-KR', {
                            month: 'numeric',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: 'numeric',
                          })} · ${s.completedItems}문장`
                        : `진행 중 · ${s.completedItems}/${s.totalItems}문장`}
                    </p>
                  </div>
                  {acc != null && (
                    <span
                      className="font-mono text-[14px] font-[700] tabular-nums"
                      style={{ color: accColor }}
                    >
                      {Math.round(acc)}%
                    </span>
                  )}
                  {done && (
                    <Link
                      href={`/dictate/results?sessionId=${s.id}`}
                      className="shrink-0 rounded-[var(--r-sm)] bg-[var(--bg2)] px-2 py-1 font-display text-[11px] font-[600] text-[var(--t2)] transition-colors hover:bg-[var(--bg3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2"
                    >
                      결과
                    </Link>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}

// ── 오늘의 받아쓰기 카드 ──────────────────────────────────────────

function DailyCard({
  loading,
  loadFailed,
  daily,
  starting,
  signedIn,
  hasAnything,
  onStart,
}: {
  loading: boolean
  loadFailed: boolean
  daily: DailyDictation | null
  starting: boolean
  signedIn: boolean
  hasAnything: boolean
  onStart: () => void
}) {
  // 로드 실패는 위 alert 가 이유와 [다시 시도] 를 말한다 — 여기에 "자료 없음" 을
  // 겹쳐 그리면 실패를 빈 상태로 오해하게 만든다.
  if (loadFailed) return null
  if (loading) {
    return (
      <div className="flex h-[132px] items-center justify-center rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)]">
        <Loader2 size={18} className="animate-spin text-[var(--t3)]" />
      </div>
    )
  }

  // 재료가 없는 이유는 둘 중 하나 — 로그인 안 함 / 자료가 없음. 각각 다른 길을 준다.
  if (!daily) {
    return (
      <section className="flex flex-col gap-3 rounded-[var(--r-lg)] border border-dashed border-[var(--bd)] bg-[var(--bg)] p-5">
        <h2 className="font-display text-[15px] font-[700] text-[var(--t1)]">오늘의 받아쓰기</h2>
        <p className="font-body text-[13px] leading-relaxed text-[var(--t2)]">
          {!signedIn
            ? '로그인하면 복습 시점이 된 단어로 매일 5문장이 자동으로 준비돼요.'
            : hasAnything
              ? '아래에서 자료를 하나 골라 첫 세션을 마치면, 내일부터는 오늘의 5문장이 자동으로 만들어져요.'
              : '받아쓸 자료가 아직 없어요. 도서를 담거나 스크립트를 넣으면 여기에 매일 5문장이 놓입니다.'}
        </p>
      </section>
    )
  }

  const minutes = Math.max(1, Math.round(daily.sentences.length * 0.8))

  return (
    <section
      className="flex flex-col gap-4 rounded-[var(--r-lg)] border border-[var(--bd)] bg-gradient-to-br from-[var(--bg)] to-[var(--bg2)] p-5 shadow-[var(--sh-sm)]"
      aria-labelledby="daily-dictation-title"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span
            className="font-display text-[11px] font-[700] uppercase tracking-[0.10em]"
            style={{ color: DICTATION_ACCENT }}
          >
            오늘의 받아쓰기
          </span>
          <h2
            id="daily-dictation-title"
            className="font-display text-[19px] font-[700] text-[var(--t1)]"
          >
            {daily.sentences.length}문장 · 약 {minutes}분
          </h2>
          {/* 구성 내역은 아래 칩이 말한다 — 같은 말을 두 번 하지 않는다(§철학2) */}
        </div>
        <Sparkles size={18} className="mt-0.5 shrink-0 text-[var(--t3)]" />
      </div>

      {/* 왜 이 문장인지 — 구성 근거를 접지 않고 보여준다. 시스템을 신뢰하려면 근거가 보여야 한다. */}
      <ul className="flex flex-wrap gap-2">
        {daily.meta.due > 0 && (
          <ReasonChip label={`복습 임박 단어 ${daily.meta.due}`} tone="p" />
        )}
        {daily.meta.retry > 0 && (
          <ReasonChip label={`지난번 놓친 문장 ${daily.meta.retry}`} tone="warning" />
        )}
        {daily.meta.fresh > 0 && (
          <ReasonChip label={`읽던 자료에서 ${daily.meta.fresh}`} tone="neutral" />
        )}
      </ul>

      <button
        type="button"
        onClick={onStart}
        disabled={starting}
        className="group inline-flex items-center justify-center gap-2 rounded-[var(--r-md)] py-3 font-display text-[14px] font-[700] text-[var(--ti)] shadow-[var(--sh-sm)] transition-all duration-[var(--dur-normal)] hover:-translate-y-0.5 hover:shadow-[var(--sh-md)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2"
        style={{ background: `linear-gradient(135deg, ${DICTATION_ACCENT}, #1D4ED8)` }}
      >
        {starting ? (
          <>
            <Loader2 size={15} className="animate-spin" />
            준비 중
          </>
        ) : (
          <>
            시작하기
            <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
          </>
        )}
      </button>
    </section>
  )
}

function ReasonChip({ label, tone }: { label: string; tone: 'p' | 'warning' | 'neutral' }) {
  const cls =
    tone === 'p'
      ? 'bg-[var(--p-light)] text-[var(--on-p-tint)]'
      : tone === 'warning'
        ? 'bg-[var(--warning-light)] text-[var(--warning)]'
        : 'bg-[var(--bg3)] text-[var(--t2)]'
  return (
    <li className={`rounded-full px-3 py-1 font-body text-[11px] font-[600] ${cls}`}>{label}</li>
  )
}
