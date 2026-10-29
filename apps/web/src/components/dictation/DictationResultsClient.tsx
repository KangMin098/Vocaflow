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

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Check,
  Home,
  Leaf,
  Loader2,
  RotateCw,
  Search,
  ListRestart,
  Sprout,
  Square,
  Volume2,
} from 'lucide-react'

import { useStoryAuthGuard } from '@/components/library/story/use-story-auth-guard'
import { AudioController, hasEnglishVoice } from '@/lib/dictation/audio-control'
import { ResultsRelisten, type RelistenSpeaker } from '@/lib/dictation/results-relisten'
import { NextActionCard } from '@/components/recommend/NextActionCard'
import { analyzeErrorPatterns } from '@/lib/dictation/analyzer'
import { tagCoach, tagLabel } from '@/lib/dictation/error-tags'
import { fetchDictationSessionDetail, type SessionDetail } from '@/lib/dictation/persist'
import { createClient } from '@/lib/supabase/client'
import { useNextAction } from '@/lib/recommend/use-next-action'
import type { WordResult } from '@/lib/dictation/types'
import { dictationFrom, dictationRetryHref, type DictationRetrySource } from '@/lib/dictation/return'
import { wordVaultSearchHref } from '@/lib/dictation/word-vault-link'
import { MISSED_RETRY_HREF, missedRetryPayload, stashMissedRetry } from '@/lib/dictation/retry-missed'

const DICTATION_ACCENT = '#0EA5E9'

export function DictationResultsClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('sessionId')
  const from = dictationFrom(searchParams.get('from'))

  const [stored, setDetail] = useState<SessionDetail | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading')

  // 요청 결속 — 보관된 결과가 지금 URL 이 요청한 세션일 때만 쓴다(effect 가 돌기 전 렌더에서도 옛 결과를 붙이지 않는다).
  const detail = currentSnapshot(stored, sessionId)
  // 세션 주인 결속 — 읽힌 세션 행의 user_id 와 브라우저 신원이 같다고 확인될 때만 결과와 복습을 그린다.
  const ownerId = detail?.session.userId ?? null
  const { guard, status: authStatus } = useStoryAuthGuard(ownerId)
  // 실행 시점 판정 — 보관된 재생 콜백은 렌더 플래그가 아니라 지금의 guard 상태와 지금의 유효 snapshot 을 다시 본다.
  const liveRef = useRef<{ guard: typeof guard; detail: SessionDetail | null }>({ guard, detail })
  liveRef.current = { guard, detail }
  const snapshotForAllow = detail
  const allowReplay = useCallback(
    () => replayAllowed(liveRef.current, snapshotForAllow),
    [snapshotForAllow],
  )
  const reviewEnabled = !!ownerId && authStatus === 'same'

  useEffect(() => {
    // sessionId 가 바뀌면 옛 결과를 먼저 내린다 — 늦은 응답은 아래 mounted 판정이 버린다.
    setDetail(null)
    setState('loading')
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
      if (!d || !acceptLoaded(sessionId, d)) {
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

  // 틀림·건너뜀 문항만 다시 — 이 snapshot 의 원 문항 정답 그대로 만든다. 원 세션 기록은 읽기만 한다.
  const missedRetry = useMemo(
    () => (detail ? missedRetryPayload(detail.session.title, detail.attempts) : null),
    [detail],
  )
  const retryMissed = useCallback(() => {
    // 실행 시점 판정 — 누르는 순간에도 주인 확인(same)과 유효 snapshot 이어야 남의 결과 문장을 넘기지 않는다.
    if (!missedRetry || !replayAllowed(liveRef.current, snapshotForAllow)) return
    // 봉투는 확정된 결과 주인에게 묶는다 — 설정 화면은 그때 확정된 계정이 같을 때만 꺼낸다.
    if (!stashMissedRetry(snapshotForAllow?.session.userId ?? null, missedRetry)) return
    router.push(MISSED_RETRY_HREF)
  }, [missedRetry, snapshotForAllow, router])

  const recommendation = useNextAction()

  if (state === 'loading' || (state === 'ready' && !detail) || (state === 'ready' && !!ownerId && authStatus === 'checking')) {
    return (
      // 맨 스피너는 **화면 판독기에 아무것도 아니다** — "불러오는 중" 과 "아무것도 없음" 이
      // 구분되지 않는다(회귀 스펙도 이 둘을 구별하지 못해 로딩 중을 빈 화면으로 읽었다).
      // 그래서 상태를 말로도 남긴다.
      <div
        role="status"
        aria-live="polite"
        className="mx-auto flex max-w-3xl items-center justify-center gap-2 px-4 py-20"
      >
        {/* 이 화면이 **무엇인지**는 불러오는 동안에도 있어야 한다 — 화면 판독기 사용자는
            "불러오는 중" 만 듣고는 어디에 와 있는지 모른다. 눈에는 안 보이되 문서에는 있다. */}
        <h1 className="sr-only">받아쓰기 결과</h1>
        <Loader2 size={20} className="animate-spin text-[var(--t3)]" aria-hidden="true" />
        <span className="font-body text-[13px] text-[var(--t2)]">결과를 불러오는 중</span>
      </div>
    )
  }

  if (state === 'missing' || !detail || !agg || (!!ownerId && authStatus === 'changed')) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
        <div>
          {/* 이 화면의 **이름**이므로 h1 이다. h2 로 두면 문서에 h1 이 없어
              화면 판독기가 "이 페이지는 무엇인가" 에 답하지 못한다. */}
          <h1 className="font-editorial text-[16px] font-[700] text-[var(--t1)]">
            이 결과를 찾을 수 없어요
          </h1>
          {/* ⚠️ 여기 있던 문구는 **불가능한 상태**를 설명했다 — "로그인 없이 진행한 세션은
              기록에 남지 않아요" 였는데, `/dictate/*` 는 보호 라우트라 로그인한 사람만
              이 화면에 닿는다. 그러면 안내가 자기 사정과 무관해 학습자는 이유를 못 얻는다.
              실제로 가능한 사유만 적는다. */}
          <p className="mt-1.5 font-body text-[13px] leading-relaxed text-[var(--t2)]">
            아직 끝내지 않았거나, 다른 계정에서 진행한 받아쓰기일 수 있어요. 최근 받아쓴
            기록은 받아쓰기 첫 화면에 그대로 남아 있습니다.
          </p>
        </div>
        <Link
          href="/dictate"
          className="inline-flex h-11 items-center gap-2 rounded-[var(--r-md)] px-4 font-display text-[13px] font-[700] text-[var(--ti)] shadow-[var(--sh-sm)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2"
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
          <span className="mb-2 inline-flex h-11 w-11 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--ti)_15%,transparent)]">
            <BandIcon size={22} strokeWidth={2} aria-hidden="true" />
          </span>
          {/* 히어로 최상단이 이 화면의 이름이다 — `p` 로 두면 결과 화면 전체에 h1 이 없다
              (실측 2026-09-06: 전 화면 정체 검사에서 `/dictate/results` 만 h1=0 이었다).
              보이는 모습은 그대로 두고 의미만 바로잡는다. */}
          <h1 className="font-editorial text-[12px] font-[700] uppercase tracking-[0.10em] opacity-80">
            받아쓰기 완료
          </h1>
          <p data-testid="results-accuracy" className="mt-2 font-display text-[60px] font-[800] leading-none tabular-nums">
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
        <article className="flex flex-col gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-sm)]">
          <h3 className="font-display text-[13px] font-[700] text-[var(--t1)]">
            복습에 반영된 단어
          </h3>
          {agg.hits.length === 0 && agg.misses.length === 0 ? (
            /* 처방을 말하면서 갈 길을 안 주면 그 문장은 조언이 아니라 설명으로 끝난다. */
            /* "단어장이나 도서 챕터를 고르면" 이라고 했으면 고르는 자리로 보내야 한다. */
            <>
              <p className="font-body text-[12px] leading-relaxed text-[var(--t2)]">
                이번 문장들에는 내 단어가 들어 있지 않았어요. 단어장이나 도서 챕터를 고르면
                받아쓰기가 그대로 복습이 됩니다.
              </p>
              <Link
                href="/dictate"
                className="inline-flex min-h-[44px] items-center gap-1 self-start rounded-[var(--r-md)] border border-[var(--bd)] px-3 py-2 font-display text-[12px] font-[600] text-[var(--t1)] transition-colors hover:border-[var(--p)] hover:bg-[var(--p-light)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2"
              >
                자료 고르기
                <ArrowRight size={13} />
              </Link>
            </>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {agg.hits.map((w) => (
                  <span
                    key={`h-${w}`}
                    className="rounded-full bg-[var(--success-light)] px-3 py-1 font-english text-[12px] font-[600] text-[var(--success)]"
                  >
                    ✓ {w}
                  </span>
                ))}
                {agg.misses.map((w) => (
                  <span
                    key={`m-${w}`}
                    className="rounded-full bg-[var(--warning-light)] px-3 py-1 font-english text-[12px] font-[600] text-[var(--warning)]"
                  >
                    ↻ {w}
                  </span>
                ))}
              </div>
              <p className="font-body text-[11px] leading-relaxed text-[var(--t2)]">
                맞힌 {agg.hits.length}개는 복습 간격이 늘었고, 놓친 {agg.misses.length}개는 곧
                다시 만나게 됩니다.
              </p>
              {/* 놓친 낱말 → 내 단어장 검색(DIC-VOC-01) — 주인 확인(same)일 때만. 검색일 뿐 저장·복습 기한을 약속하지 않는다. */}
              {reviewEnabled && agg.misses.length > 0 && (
                <div data-testid="missed-word-vault">
                  <p className="font-display text-[11px] font-[600] text-[var(--t2)]">내 단어장에서 이 낱말 찾기</p>
                  <ul className="mt-1.5 flex flex-wrap gap-2">
                    {agg.misses.map((w) => {
                      const href = wordVaultSearchHref(w)
                      if (!href) return null
                      return (
                        <li key={`v-${w}`}>
                          <Link
                            href={href}
                            data-testid="missed-word-vault-link"
                            aria-label={`내 단어장에서 ${w} 찾기`}
                            className="inline-flex min-h-[44px] max-w-full items-center gap-1 break-all rounded-[var(--r-md)] border border-[var(--bd)] px-3 py-2 font-english text-[12px] font-[600] text-[var(--t1)] transition-colors hover:border-[var(--p)] hover:bg-[var(--p-light)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2"
                          >
                            <Search size={12} aria-hidden />
                            {w}
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
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
                className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-3 py-3"
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
        <DictationAttemptRows
          attempts={detail.attempts}
          reviewEnabled={reviewEnabled}
          allowReplay={allowReplay}
          subscribeAllow={guard.subscribe}
        />
      </section>

      {/* ─── CTA ─── */}
      <DictationResultActions
        retry={s}
        from={from}
        missedCount={reviewEnabled && missedRetry ? missedRetry.items.length : 0}
        onRetryMissed={retryMissed}
      />
    </div>
  )
}

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2'

// 단어 채점 상태 — 세션 피드백(DictationSessionClient WordChip)과 같은 표기.
// 색만으로 전달하지 않도록 밑줄/취소선/테두리 + 글자 라벨을 함께 쓴다.
const WORD_STATUS_STYLES: Record<WordResult['status'], string> = {
  correct: 'text-[var(--success)] bg-[var(--success-light)]',
  misspelled: 'text-[var(--warning)] bg-[var(--warning-light)] underline decoration-wavy',
  wrong: 'text-[var(--error-ink)] bg-[var(--error-light)] line-through',
  missing: 'text-[var(--error-ink)] border border-dashed border-[var(--error)]',
  extra: 'text-[var(--warning)] line-through opacity-60',
}

const WORD_STATUS_LABELS: Record<WordResult['status'], string> = {
  correct: '정답',
  misspelled: '철자',
  wrong: '오답',
  missing: '누락',
  extra: '불필요',
}

type Attempt = SessionDetail['attempts'][number]

/** 요청 결속 — 보관된 결과가 지금 요청한 세션일 때만 돌려준다(요청 없음 · 다른 id 면 null). */
export function currentSnapshot(
  stored: SessionDetail | null,
  requestedId: string | null,
): SessionDetail | null {
  if (!stored || !requestedId) return null
  return stored.session.id === requestedId ? stored : null
}

/** 응답 결속 — 받은 결과가 그 요청의 세션인가. */
export function acceptLoaded(requestedId: string | null, d: SessionDetail): boolean {
  return !!requestedId && d.session.id === requestedId
}

/**
 * 다시 듣기 실행 시점 허용 — 렌더 플래그가 아니라 **지금** guard 상태와 **지금** 유효 snapshot 을 본다.
 * 콜백이 들고 있는 snapshot(mine) 이 현재 snapshot 과 같은 객체이고, 그 주인이 있으며, guard 가 same 일 때만 참.
 */
export function replayAllowed(
  live: { guard: { status: string }; detail: SessionDetail | null },
  mine: SessionDetail | null,
): boolean {
  return (
    !!mine &&
    live.detail === mine &&
    !!mine.session.userId &&
    live.guard.status === 'same'
  )
}

/** 결과 화면 전용 발화 — 기존 AudioController 의 시스템 음성만 쓴다(신경망 준비 · 다운로드 · 음성 선호 변경 없음). */
function systemSpeaker(): RelistenSpeaker {
  const ctl = new AudioController()
  return { speak: (text) => ctl.speak({ text, rate: 1 }), cancel: () => ctl.cancel() }
}

/**
 * 문항별 결과 — 어려웠던 문장을 골라 저장된 정답 문장을 현재 기기 음성으로 다시 듣고, 그때 받은 피드백을 다시 본다.
 * 결과 화면은 채점 입력이 아니므로 재생 횟수 · 힌트 · 정답률 · FSRS 를 기록하지 않는다.
 * reviewEnabled 는 세션 주인과 브라우저 신원이 같다고 확인됐을 때만 참이다 — 아니면 복습 조작을 그리지 않는다.
 */
export function DictationAttemptRows({
  attempts,
  reviewEnabled,
  speaker,
  voiceAvailable,
  allowReplay,
  subscribeAllow,
}: {
  attempts: Attempt[]
  reviewEnabled: boolean
  /** 시험 주입용 — 없으면 시스템 음성 */
  speaker?: RelistenSpeaker
  /** 시험 주입용 — 없으면 hasEnglishVoice() 로 판정 */
  voiceAvailable?: boolean | null
  /** 실행 시점 허용 판정 — 지금 guard 가 same 이고 이 행들의 snapshot 이 지금 유효한가. 없으면 reviewEnabled 만 본다(하네스). */
  allowReplay?: () => boolean
  /** 허용 판정이 바뀔 수 있는 신호(guard 상태 변경) — 바뀌는 즉시 동기로 다시 판정해 재생을 끊는다 */
  subscribeAllow?: (fn: () => void) => () => void
}) {
  const allow = allowReplay ?? (() => reviewEnabled)
  // 플레이어는 이 snapshot(attempts) 에 묶인다 — snapshot 이 바뀌거나 화면이 내려가면 폐기(dispose)되어
  // 보관된 옛 콜백이 다시 불려도 발화하지 않는다.
  const player = useMemo(
    // allow 는 이 snapshot 의 판정 함수로 생성 시점에 묶는다 — 뒤 렌더(다른 요청)의 판정을 빌려 쓰지 않는다.
    () => new ResultsRelisten(speaker ?? systemSpeaker(), allow),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- attempts 가 snapshot 경계다
    [speaker, attempts, allowReplay],
  )
  // 개발 StrictMode 의 mount→cleanup→mount 도 견디도록 effect 가 활성화하고 cleanup 이 폐기한다.
  useEffect(() => {
    player.activate()
    return () => player.dispose()
  }, [player])
  useEffect(() => {
    if (!subscribeAllow) return
    return subscribeAllow(() => {
      player.revalidate()
    })
  }, [subscribeAllow, player])
  const playingIdx = useSyncExternalStore(player.subscribe, player.getPlaying, player.getPlaying)
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  const [voiceOk, setVoiceOk] = useState<boolean | null>(voiceAvailable ?? null)

  useEffect(() => {
    if (voiceAvailable !== undefined) return
    let alive = true
    void hasEnglishVoice().then((ok) => {
      if (alive) setVoiceOk(ok)
    })
    return () => {
      alive = false
    }
  }, [voiceAvailable])

  // 화면 이탈 · 숨김 · 주인 확인 해제 때 발화를 끊는다.
  useEffect(() => {
    if (!reviewEnabled) player.stop()
  }, [reviewEnabled, player])
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') player.stop()
    }
    document.addEventListener('visibilitychange', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      player.stop()
    }
  }, [player])

  const activeIdx = reviewEnabled ? playingIdx : null
  const canPlay = reviewEnabled && voiceOk !== false

  return (
    <>
    {reviewEnabled && voiceOk === false && (
      <p data-testid="relisten-no-voice" className="px-5 pt-3 font-body text-[12px] text-[var(--t2)]">
        이 기기에서 영어 음성을 찾지 못해 다시 듣기를 쓸 수 없어요. 당시 피드백은 그대로 볼 수 있어요.
      </p>
    )}
    {reviewEnabled && voiceOk !== false && (
      <p className="px-5 pt-3 font-body text-[11px] text-[var(--t3)]">
        다시 듣기는 저장된 정답 문장을 이 기기 음성으로 읽어요. 당시 음성·속도와 다를 수 있고, 기록에는 남지 않아요.
      </p>
    )}
    <ul className="divide-y divide-[var(--bg3)]">
          {attempts.map((a) => {
            const c =
              a.accuracy >= 90
                ? 'var(--success)'
                : a.accuracy >= 70
                  ? 'var(--p)'
                  : 'var(--warning)'
            return (
              <li key={a.itemIdx} data-testid="attempt-row" className="flex items-start gap-3 px-5 py-3">
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
                  {reviewEnabled && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {canPlay && (
                    <button
                      type="button"
                      data-testid="attempt-relisten"
                      onClick={() => player.toggle(a.itemIdx, a.expected)}
                      aria-label={`${a.itemIdx + 1}번 문장 ${activeIdx === a.itemIdx ? '정지' : '다시 듣기'}`}
                      className={`inline-flex min-h-[44px] min-w-[44px] items-center gap-1 rounded-[var(--r-md)] border border-[var(--bd)] px-3 py-2 font-display text-[12px] font-[600] text-[var(--t1)] transition-colors hover:bg-[var(--bg2)] ${FOCUS_RING}`}
                    >
                      {activeIdx === a.itemIdx ? <Square size={12} aria-hidden="true" /> : <Volume2 size={12} aria-hidden="true" />}
                      {activeIdx === a.itemIdx ? '정지' : '다시 듣기'}
                    </button>
                    )}
                    <button
                      type="button"
                      data-testid="attempt-feedback-toggle"
                      aria-expanded={openIdx === a.itemIdx}
                      aria-controls={`attempt-feedback-${a.itemIdx}`}
                      onClick={() => setOpenIdx(openIdx === a.itemIdx ? null : a.itemIdx)}
                      className={`inline-flex min-h-[44px] items-center gap-1 rounded-[var(--r-md)] border border-[var(--bd)] px-3 py-2 font-display text-[12px] font-[600] text-[var(--t2)] transition-colors hover:bg-[var(--bg2)] ${FOCUS_RING}`}
                    >
                      {openIdx === a.itemIdx ? '당시 피드백 접기' : '당시 피드백'}
                    </button>
                  </div>
                  )}
                  {reviewEnabled && openIdx === a.itemIdx && <AttemptFeedback attempt={a} />}
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
    </>
  )
}

export function AttemptFeedback({ attempt }: { attempt: Attempt }) {
  const words = attempt.wordResults ?? []
  const tags = attempt.errorTags ?? []
  return (
    <div
      id={`attempt-feedback-${attempt.itemIdx}`}
      data-testid="attempt-feedback"
      className="mt-2 rounded-[var(--r-md)] bg-[var(--bg2)] p-3"
    >
      {words.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="단어별 결과">
          {words.map((w, i) => (
            <li key={i} className="inline-flex items-center gap-1">
              <span
                className={`inline-block rounded px-2 py-1 font-english text-[13px] ${WORD_STATUS_STYLES[w.status]}`}
              >
                {(w.status === 'missing' ? w.expected : w.actual) || '—'}
              </span>
              <span className="font-body text-[11px] text-[var(--t2)]">
                {WORD_STATUS_LABELS[w.status]}
                {(w.status === 'misspelled' || w.status === 'wrong') && w.expected
                  ? ` · 정답 ${w.expected}`
                  : ''}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="font-body text-[12px] text-[var(--t3)]">
          {attempt.skipped
            ? '건너뛴 문항이라 채점 피드백이 없어요.'
            : '피드백 없음 — 이 문항에는 당시 단어별 기록이 남아 있지 않아요.'}
        </p>
      )}
      {tags.length > 0 && (
        <ul className="mt-2 space-y-1">
          {tags.map((t) => (
            <li key={t} className="font-body text-[12px] text-[var(--t1)]">
              <span className="font-[700]">{tagLabel(t)}</span>
              {tagCoach(t) && <span className="text-[var(--t2)]"> — {tagCoach(t)}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** 결과 화면 행동 — 들어온 자리(있을 때만) · 틀린 문항만 다시(있을 때만) · 같은 자료로 한 번 더 · 받아쓰기 홈 · 통계. */
export function DictationResultActions({
  retry,
  from,
  missedCount = 0,
  onRetryMissed,
}: {
  retry: DictationRetrySource
  from: string | null
  /** 다시 받아쓸 틀림·건너뜀 문항 수 — 0 이면(모두 맞힘 · 주인 확인 전) 그리지 않는다 */
  missedCount?: number
  onRetryMissed?: () => void
}) {
  return (
    <>
      {/* 틀린 문항만 다시 — 같은 자료 전체가 아니라 이번에 놓친 원래 문항들로만 새 받아쓰기를 시작한다(원 기록은 그대로) */}
      {missedCount > 0 && onRetryMissed && (
        <button
          type="button"
          onClick={onRetryMissed}
          data-testid="dictation-retry-missed"
          data-missed-count={missedCount}
          className="flex min-h-[44px] items-center justify-center gap-2 rounded-[var(--r-md)] border border-[var(--p)] bg-[var(--p-light)] py-3 font-display text-[13px] font-[700] text-[var(--on-p-tint)] transition-colors hover:bg-[var(--bg2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2"
        >
          <ListRestart size={14} aria-hidden />
          틀린 문항 {missedCount}개만 다시 받아쓰기
        </button>
      )}
      {/* 들어온 자리로 — 읽던 글일 수도 다른 학습 화면일 수도 있어 제목 · 소속을 지어 말하지 않는다 */}
      {from && (
        <Link
          href={from}
          data-testid="dictation-return-from"
          className="flex items-center justify-center gap-2 rounded-[var(--r-md)] border border-[var(--bd)] py-3 font-display text-[13px] font-[700] text-[var(--t1)] transition-colors hover:bg-[var(--bg2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2"
        >
          <ArrowLeft size={14} aria-hidden />
          하던 학습으로 돌아가기
        </Link>
      )}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        {/* "한 번 더" 는 **같은 자료로** 돌아가야 한다 — 허브로 보내면 자료를 다시 찾아야 하고,
            그 마찰이 재도전을 막는다. 출처 좌표가 없으면(붙여넣기·오늘) 허브로 폴백. */}
        <Link
          href={dictationRetryHref(retry, from)}
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
    </>
  )
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
