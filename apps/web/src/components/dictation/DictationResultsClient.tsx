// apps/web/src/components/dictation/DictationResultsClient.tsx
//
// 받아쓰기 결과 — "무엇이 남았는가"를 말한다.
//
// v07 변경 2가지:
//   ① 기록을 DB 에서 읽는다. 예전엔 localStorage 세션을 읽어서, 링크를 공유하거나
//      다른 기기에서 열면 결과가 통째로 사라졌다. 이제 dictation_sessions/_attempts 를
//      읽으므로 언제 어디서 열어도 그날의 받아쓰기가 그대로 있다.
//   ② 적재를 여기서 하지 않는다. scores·FSRS 는 세션 완주 시점(useDictationSession.finish)
//      에서 이미 끝났다. 결과 화면이 적재를 겸하면 새로고침마다 중복 적재된다.
//
// 화면이 답해야 할 질문은 "몇 점?"이 아니라 "오늘 무엇이 남았나?"다.
// 그래서 정확도 아래 두 줄이 핵심이다 — 복습에 올라간 단어 수, 청취 폭.

'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowRight,
  BarChart3,
  Check,
  Home,
  Leaf,
  Loader2,
  RotateCw,
  Sprout,
} from 'lucide-react'

import { NextActionCard } from '@/components/recommend/NextActionCard'
import { analyzeErrorPatterns } from '@/lib/dictation/analyzer'
import { tagCoach, tagLabel } from '@/lib/dictation/error-tags'
import { fetchDictationSessionDetail, type SessionDetail } from '@/lib/dictation/persist'
import { createClient } from '@/lib/supabase/client'
import { useNextAction } from '@/lib/recommend/use-next-action'
import type { WordResult } from '@/lib/dictation/types'

const DICTATION_ACCENT = '#0EA5E9'

export function DictationResultsClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('sessionId')

  const [detail, setDetail] = useState<SessionDetail | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading')

  useEffect(() => {
    if (!sessionId) {
      router.replace('/dictate')
      return
    }
    // 로컬 전용 세션(비로그인)은 DB 에 없다 — 허브로 돌려보낸다.
    if (sessionId.startsWith('local-')) {
      setState('missing')
      return
    }
    let mounted = true
    void (async () => {
      const d = await fetchDictationSessionDetail(createClient(), sessionId)
      if (!mounted) return
      if (!d) {
        setState('missing')
        return
      }
      setDetail(d)
      setState('ready')
    })()
    return () => {
      mounted = false
    }
  }, [sessionId, router])

  const agg = useMemo(() => {
    if (!detail) return null
    const attempts = detail.attempts
    const allWordResults: WordResult[] = attempts.flatMap((a) => a.wordResults ?? [])
    const patterns = analyzeErrorPatterns(allWordResults)

    // 태그 빈도 — 이 세션 안에서 무엇이 반복됐나
    const tagCount = new Map<string, number>()
    for (const a of attempts) {
      for (const t of a.errorTags ?? []) tagCount.set(t, (tagCount.get(t) ?? 0) + 1)
    }
    const tags = [...tagCount.entries()].sort((a, b) => b[1] - a[1])

    const hits = new Set<string>()
    const misses = new Set<string>()
    for (const a of attempts) {
      for (const w of a.targetHits ?? []) hits.add(w)
      for (const w of a.targetWords ?? []) if (!(a.targetHits ?? []).includes(w)) misses.add(w)
    }
    // 같은 단어를 한 문장에서 맞고 다른 문장에서 놓쳤다면 "놓친 쪽"으로 센다(복습 우선).
    for (const w of misses) hits.delete(w)

    const solid = attempts.filter((a) => a.accuracy >= 90).length

    return { patterns, tags, hits: [...hits], misses: [...misses], solid }
  }, [detail])

  const recommendation = useNextAction()

  if (state === 'loading') {
    return (
      // 맨 스피너는 **화면 판독기에 아무것도 아니다** — "불러오는 중" 과 "아무것도 없음" 이
      // 구분되지 않는다(회귀 스펙도 이 둘을 구별하지 못해 로딩 중을 빈 화면으로 읽었다).
      // 그래서 상태를 말로도 남긴다.
      <div
        role="status"
        aria-live="polite"
        className="mx-auto flex max-w-3xl items-center justify-center gap-2 px-4 py-20"
      >
        <Loader2 size={20} className="animate-spin text-[var(--t3)]" aria-hidden="true" />
        <span className="font-body text-[13px] text-[var(--t2)]">결과를 불러오는 중</span>
      </div>
    )
  }

  if (state === 'missing' || !detail || !agg) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
        <div>
          <h2 className="font-display text-[16px] font-[700] text-[var(--t1)]">
            이 결과를 찾을 수 없어요
          </h2>
          <p className="mt-1.5 font-body text-[13px] leading-relaxed text-[var(--t2)]">
            로그인 없이 진행한 세션은 기록에 남지 않아요. 로그인하면 받아쓴 기록이 기기와
            무관하게 이어집니다.
          </p>
        </div>
        <Link
          href="/dictate"
          className="inline-flex h-11 items-center gap-1.5 rounded-[var(--r-md)] px-4 font-display text-[13px] font-[700] text-[var(--ti)] shadow-[var(--sh-sm)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2"
          style={{ background: `linear-gradient(135deg, ${DICTATION_ACCENT}, #1D4ED8)` }}
        >
          받아쓰기로 돌아가기
          <ArrowRight size={14} />
        </Link>
      </div>
    )
  }

  const s = detail.session
  const totalAccuracy = s.avgAccuracy ?? 0
  const totalTimeMs = s.durationMs ?? 0
  const minutes = Math.floor(totalTimeMs / 60000)
  const seconds = Math.floor((totalTimeMs % 60000) / 1000)

  // Calm, 격려 위주 마무리 — 점수대별 아이콘 + 사람 말투 한 줄 (트로피·폭죽 지양)
  const band =
    totalAccuracy >= 90
      ? { icon: Check, message: '깔끔하게 마쳤어요. 귀가 이 문장들에 익숙해지고 있어요.' }
      : totalAccuracy >= 70
        ? { icon: Sprout, message: '잘 따라오고 있어요. 한 번 더 들으면 더 또렷해질 거예요.' }
        : { icon: Leaf, message: '천천히 가도 괜찮아요. 오늘 들은 만큼 분명히 남았어요.' }
  const BandIcon = band.icon

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-8 md:px-6 md:py-10">
      {/* ─── Hero ─── */}
      <header
        className="relative overflow-hidden rounded-[var(--r-2xl)] p-7 text-[var(--ti)] shadow-[var(--sh-md)]"
        style={{ background: `linear-gradient(135deg, ${DICTATION_ACCENT}, #1D4ED8)` }}
      >
        <div className="flex flex-col items-center text-center">
          <span className="mb-2 inline-flex h-11 w-11 items-center justify-center rounded-full bg-[var(--ti)]/15">
            <BandIcon size={22} strokeWidth={2} aria-hidden="true" />
          </span>
          <p className="font-display text-[12px] font-[700] uppercase tracking-[0.10em] opacity-80">
            받아쓰기 완료
          </p>
          <p className="mt-2 font-display text-[60px] font-[800] leading-none tabular-nums">
            {Math.round(totalAccuracy)}
            <span className="ml-1 text-[26px] opacity-80">%</span>
          </p>
          <p className="mt-2 font-body text-[14px] opacity-90">{s.title}</p>
          <p className="mt-3 max-w-md font-body text-[13px] italic opacity-90">{band.message}</p>

          <div className="mt-6 grid grid-cols-3 gap-4 text-left md:gap-8">
            <HeroStat label="정확히" value={`${agg.solid} / ${s.completedItems}`} />
            <HeroStat label="시간" value={`${minutes}:${String(seconds).padStart(2, '0')}`} />
            <HeroStat label="힌트" value={`${s.totalHints}회`} />
          </div>
        </div>
      </header>

      {/* ─── 오늘 무엇이 남았나 ─── */}
      <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {/* 복습으로 넘어간 단어 — 받아쓰기가 단어 기억에 남긴 흔적 */}
        <article className="flex flex-col gap-2.5 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-sm)]">
          <h3 className="font-display text-[13px] font-[700] text-[var(--t1)]">
            복습에 반영된 단어
          </h3>
          {agg.hits.length === 0 && agg.misses.length === 0 ? (
            <p className="font-body text-[12px] leading-relaxed text-[var(--t2)]">
              이번 문장들에는 내 단어가 들어 있지 않았어요. 단어장이나 도서 챕터를 고르면
              받아쓰기가 그대로 복습이 됩니다.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5">
                {agg.hits.map((w) => (
                  <span
                    key={`h-${w}`}
                    className="rounded-full bg-[var(--success-light)] px-2.5 py-1 font-english text-[12px] font-[600] text-[var(--success)]"
                  >
                    ✓ {w}
                  </span>
                ))}
                {agg.misses.map((w) => (
                  <span
                    key={`m-${w}`}
                    className="rounded-full bg-[var(--warning-light)] px-2.5 py-1 font-english text-[12px] font-[600] text-[var(--warning)]"
                  >
                    ↻ {w}
                  </span>
                ))}
              </div>
              <p className="font-body text-[11px] leading-relaxed text-[var(--t2)]">
                맞힌 {agg.hits.length}개는 복습 간격이 늘었고, 놓친 {agg.misses.length}개는 곧
                다시 만나게 됩니다.
              </p>
            </>
          )}
        </article>

        {/* 청취 폭 — Implicit Progress (게이지 대신 숫자 한 줄) */}
        <article className="flex flex-col gap-2 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-sm)]">
          <h3 className="font-display text-[13px] font-[700] text-[var(--t1)]">청취 폭</h3>
          {s.longestPerfectWords && s.longestPerfectWords > 0 ? (
            <>
              <p className="font-mono text-[32px] font-[800] leading-none tabular-nums text-[var(--t1)]">
                {s.longestPerfectWords}
                <span className="ml-1 font-body text-[13px] font-[600] text-[var(--t2)]">단어</span>
              </p>
              <p className="font-body text-[11px] leading-relaxed text-[var(--t2)]">
                힌트 없이 한 번에 정확히 받아쓴 가장 긴 문장이에요. 이 숫자가 늘어나는 것이
                듣기가 자라는 모습입니다.
              </p>
            </>
          ) : (
            <p className="font-body text-[12px] leading-relaxed text-[var(--t2)]">
              이번엔 힌트 없이 완벽하게 받아쓴 문장이 없었어요. 짧은 문장부터 하나씩 채워
              나가면 됩니다.
            </p>
          )}
        </article>
      </section>

      {/* §17.3 추천 축 — 세션 종료 직후 */}
      <NextActionCard
        recommendation={recommendation}
        prelude="받아쓰기 결과가 정리됐어요. 다음으로 무엇을 해볼까요?"
      />

      {/* ─── 이번에 반복된 것 (태그) ─── */}
      {agg.tags.length > 0 && (
        <section className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-sm)]">
          <h3 className="mb-2.5 font-display text-[14px] font-[700] text-[var(--t1)]">
            이번에 반복된 것
          </h3>
          <ul className="flex flex-col gap-2">
            {agg.tags.slice(0, 3).map(([tag, n]) => (
              <li
                key={tag}
                className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-3 py-2.5"
              >
                <div className="flex items-center gap-2">
                  <span className="font-display text-[13px] font-[700] text-[var(--t1)]">
                    {tagLabel(tag)}
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-[var(--t2)]">
                    {n}문장
                  </span>
                </div>
                <p className="mt-0.5 font-body text-[11px] italic leading-relaxed text-[var(--t2)]">
                  {tagCoach(tag)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ─── 문항별 결과 ─── */}
      <section className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] shadow-[var(--sh-sm)]">
        <header className="border-b border-[var(--bd)] px-5 py-3">
          <h3 className="font-display text-[14px] font-[700] text-[var(--t1)]">문항별 결과</h3>
        </header>
        <ul className="divide-y divide-[var(--bg3)]">
          {detail.attempts.map((a) => {
            const c =
              a.accuracy >= 90
                ? 'var(--success)'
                : a.accuracy >= 70
                  ? 'var(--p)'
                  : 'var(--warning)'
            return (
              <li key={a.itemIdx} className="flex items-start gap-3 px-5 py-3">
                <span className="mt-1 font-mono text-[11px] font-[700] tabular-nums text-[var(--t2)]">
                  #{a.itemIdx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-english text-[14px] leading-relaxed text-[var(--t1)]">
                    {a.expected}
                  </p>
                  {a.userInput ? (
                    <p className="mt-1 font-english text-[12px] leading-relaxed text-[var(--t2)]">
                      → {a.userInput}
                    </p>
                  ) : (
                    <p className="mt-1 font-body text-[12px] text-[var(--t3)]">건너뜀</p>
                  )}
                </div>
                <span
                  className="font-mono text-[14px] font-[700] tabular-nums"
                  style={{ color: c }}
                >
                  {Math.round(a.accuracy)}%
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      {/* ─── CTA ─── */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        {/* "한 번 더" 는 **같은 자료로** 돌아가야 한다 — 허브로 보내면 자료를 다시 찾아야 하고,
            그 마찰이 재도전을 막는다. 출처 좌표가 없으면(붙여넣기·오늘) 허브로 폴백. */}
        <Link
          href={retryHref(s)}
          className="flex items-center justify-center gap-2 rounded-[var(--r-md)] border border-[var(--bd)] py-3 font-display text-[13px] font-[600] text-[var(--t2)] transition-colors hover:bg-[var(--bg2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2"
        >
          <RotateCw size={14} />
          한 번 더
        </Link>
        <Link
          href="/dictate"
          className="flex items-center justify-center gap-2 rounded-[var(--r-md)] border border-[var(--bd)] py-3 font-display text-[13px] font-[600] text-[var(--t2)] transition-colors hover:bg-[var(--bg2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2"
        >
          <Home size={14} />
          받아쓰기 홈
        </Link>
        <Link
          href="/dashboard"
          className="col-span-2 flex items-center justify-center gap-2 rounded-[var(--r-md)] py-3 font-display text-[13px] font-[700] text-[var(--ti)] shadow-[var(--sh-sm)] transition-transform hover:-translate-y-0.5 md:col-span-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2"
          style={{ background: `linear-gradient(135deg, ${DICTATION_ACCENT}, #1D4ED8)` }}
        >
          <BarChart3 size={14} />
          통계
          <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  )
}

/**
 * 같은 자료로 되돌아가는 링크.
 * 붙여넣은 글(custom)은 저장하지 않으므로 되돌아갈 자료가 없고,
 * 오늘의 받아쓰기(daily)는 내일 다시 조립되는 것이라 허브가 옳은 목적지다.
 */
function retryHref(s: SessionDetail['session']): string {
  if (s.textId) return `/dictate/setup?text=${s.textId}`
  if (s.sharedSetId) {
    const ch = s.chapterIdx ? `&chapter=${s.chapterIdx}` : ''
    return `/dictate/setup?set=${s.sharedSetId}${ch}`
  }
  return '/dictate'
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-display text-[10px] font-[700] uppercase tracking-wider opacity-70">
        {label}
      </p>
      <p className="font-display text-[22px] font-[800] tabular-nums">{value}</p>
    </div>
  )
}
