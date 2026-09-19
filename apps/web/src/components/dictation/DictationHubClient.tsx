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
//
// ── 2026-09-06 — 이 컴포넌트는 이제 **조회를 하지 않는다** ─────────────
// 마운트 뒤 페처 5종을 `Promise.all` 로 부르던 자리를 서버 한 벌(`lib/dictation/hub-query.ts`)
// 로 옮겼다. 브라우저 데이터 요청 15건이 그렇게 만들어지고 있었다.
// **여기 조회를 다시 붙이면 그 낭비가 되살아난다** — 새 수치가 필요하면 `hub-query.ts`
// 에 한 줄 더하고 props 로 받는다.
//
// 클라이언트에 남는 것은 셋뿐이고, 각각 이유가 있다:
//   ① `getResumableSession()` — `localStorage` 라 서버가 볼 수 없다(이 기기 우선, DB 는 폴백)
//   ② 세션 시작 — 문항 캐시 적재가 브라우저에서 일어난다
//   ③ [다시 시도] — 서버 데이터를 다시 받아야 하므로 `router.refresh()`

// 2026-09-19 화면 재설계(DD-36 · docs/design/compare/dictate.md 발산 A 「오늘의 받아쓰기 문제지」):
//   첫 시선이 하늘→파랑 그라디언트 띠(머리)와 그라디언트 상자·CTA 였다(감사 평균 — 1차 행동 색이 둘). 지금은
//   판면 머리(ModuleHero, DD-34) 아래 **받아쓸 문장 다섯 줄의 빈칸**(`DailySheet`)이 골격이고 1차 행동은 주묵 하나.
//   최근 세션은 괘선 목록 · 정확도 색은 글자 + 숫자(색만으로 전달하지 않는다).

'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, Headphones, Play, RotateCcw } from 'lucide-react'

import { ModuleHero, type HeroStat } from '@/components/hub/ModuleHero'
import type { DailyDictation } from '@/lib/dictation/daily'
import type { DictationHubData } from '@/lib/dictation/hub-query'
import { getResumableSession } from '@/lib/dictation/storage'
import { createDictationSession, DictationStartError } from '@/hooks/dictation/useDictationSession'
import type { DictationConfig } from '@/lib/dictation/types'

import { DailySheet } from './DailySheet'
import { SourcePicker } from './SourcePicker'
import { WeaknessPanel } from './WeaknessPanel'

/** 머리 그라디언트 — ModuleHero 는 2026-09-19 부터 면을 칠하지 않는다(호환용으로만 넘긴다) */
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

const SOURCE_KIND_LABEL: Record<string, string> = {
  book: '도서',
  text: '스크립트',
  set: '단어장',
  daily: '오늘의 받아쓰기',
  custom: '직접 입력',
}

export function DictationHubClient({ data }: { data: DictationHubData }) {
  const router = useRouter()
  const { overview, catalog, weakness, recent, daily } = data
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  /**
   * 이어하기 — 서버가 준 DB 값으로 먼저 그리고, 이 기기 캐시가 있으면 그쪽으로 바꾼다.
   * 폰에서 시작하고 PC 에서 허브를 열어도 떠야 하므로 둘 다 본다(세션 URL 복원과 같은 이유).
   */
  const [resumeId, setResumeId] = useState<string | null>(data.resumeSessionId)
  /** [다시 시도] 가 서버 렌더를 다시 받는 동안 — 버튼이 죽은 것처럼 보이면 안 된다. */
  const [retrying, startRetry] = useTransition()

  useEffect(() => {
    const local = getResumableSession()?.id ?? null
    if (local) setResumeId(local)
  }, [])

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

  const hasAnything = catalog.books.length + catalog.scripts.length + catalog.sets.length > 0

  const heroNote = (() => {
    if (data.failed) return '지금은 받아쓰기 기록을 읽지 못했어요 — 아래에서 다시 시도할 수 있어요'
    if (overview.totalSessions === 0) {
      return '아직 받아쓴 문장이 없어요 — 오늘 5문장으로 시작해 볼까요'
    }
    if (overview.streak >= 2) {
      return `${overview.streak}일 이어오고 있어요 · 한 번에 받아쓴 가장 긴 문장 ${overview.span}단어`
    }
    return `누적 ${overview.totalSentences}문장 · 한 번에 받아쓴 가장 긴 문장 ${overview.span}단어`
  })()

  // 못 읽었으면 0 을 말하지 않는다 — 0 은 "세어 보니 없다" 는 뜻의 숫자다.
  const heroStats: HeroStat[] = data.failed
    ? [
        { label: '이번 주', value: '—', emphasis: true },
        { label: '청취 폭', value: '—' },
        { label: '받아쓰기 연속', value: '—' },
      ]
    : [
        {
          label: '이번 주',
          value: overview.weeklyAccuracy != null ? Math.round(overview.weeklyAccuracy) : '—',
          unit: overview.weeklyAccuracy != null ? '%' : undefined,
          emphasis: true,
        },
        { label: '청취 폭', value: overview.span, unit: '단어' },
        { label: '받아쓰기 연속', value: overview.streak, unit: '일' },
      ]

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-8 md:px-6 md:py-10">
      <ModuleHero
        eyebrow="Dictation · 청각 인출"
        title="받아쓰기"
        note={heroNote}
        gradient={{ from: DICTATION_ACCENT, to: '#1D4ED8' }}
        icon={Headphones}
        // 사이드바의 전체 학습 streak 과 다른 지표다 — 라벨에 '받아쓰기'를 박아 혼동을 막는다.
        stats={heroStats}
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

      {/* 조회 실패 — 빈 화면도, 영원한 스피너도 아닌 "왜 + 다음 한 걸음" */}
      {data.failed && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-[var(--r-md)] border border-[var(--bde)] bg-[var(--error-light)] px-4 py-3 sm:flex-row sm:items-center"
        >
          <p className="flex-1 break-keep font-body text-[13px] leading-relaxed text-[var(--error-ink)]">
            지금은 받아쓰기 자료를 불러오지 못했어요. 연결이 끊겼거나 잠시 응답이 없었어요.
          </p>
          <button
            type="button"
            onClick={() => startRetry(() => router.refresh())}
            disabled={retrying}
            className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-[var(--r-sm)] border border-[var(--error)]/30 bg-[var(--bg)] px-4 font-display text-[12px] font-[700] text-[var(--error-ink)] transition-colors hover:bg-[var(--error-light)] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2 active:scale-[0.99]"
          >
            <RotateCcw size={13} className={retrying ? 'animate-spin' : undefined} aria-hidden />
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
        loadFailed={data.failed}
        daily={daily}
        starting={starting}
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
          <ul className="m-0 flex list-none flex-col divide-y divide-[var(--bd)] border-y border-[var(--bd)] p-0">
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
                <li key={s.id} className="flex items-center gap-3 px-1 py-3">
                  <span className="shrink-0 font-display text-[11px] font-[700] text-[var(--t2)]">
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
                      className="inline-flex min-h-[44px] shrink-0 items-center px-2 font-display text-[12px] font-[600] text-[var(--t2)] underline decoration-[var(--bd)] underline-offset-4 transition-colors hover:text-[var(--p)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]"
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
  loadFailed,
  daily,
  starting,
  hasAnything,
  onStart,
}: {
  loadFailed: boolean
  daily: DailyDictation | null
  starting: boolean
  hasAnything: boolean
  onStart: () => void
}) {
  // 조회 실패는 위 alert 가 이유와 [다시 시도] 를 말한다 — 여기에 "자료 없음" 을
  // 겹쳐 그리면 실패를 빈 상태로 오해하게 만든다.
  if (loadFailed) return null

  // 서버가 이미 조립해 내려주므로 로딩 상태가 없다(예전에는 여기서 스피너가 돌았다).
  // 재료가 없는 이유는 하나뿐 — 받아쓸 자료가 없다. (비로그인은 라우트가 막는다.)
  if (!daily) {
    return (
      <section className="flex flex-col gap-1 border-l-2 border-[var(--bd)] py-1 pl-4">
        <h2 className="font-display text-[15px] font-[700] text-[var(--t1)]">오늘의 받아쓰기</h2>
        <p className="m-0 break-keep font-body text-[13px] leading-relaxed text-[var(--t2)]">
          {hasAnything
            ? '아래에서 자료를 하나 골라 첫 세션을 마치면, 내일부터는 오늘의 5문장이 자동으로 만들어져요.'
            : '받아쓸 자료가 아직 없어요. 도서를 담거나 스크립트를 넣으면 여기에 매일 5문장이 놓입니다.'}
        </p>
      </section>
    )
  }

  return <DailySheet daily={daily} starting={starting} onStart={onStart} />
}
