// apps/web/src/lib/learner/memory-horizon.ts
//
// Growth(회고) 의 데이터 척추 — **실제로 유지되는 컬럼에서만** 읽는다.
//
// 왜 새로 만들었나 (2026-08-15 실측 진단):
//   이전 /dashboard 는 화면 셋이 동시에 학습자에게 거짓을 말하고 있었다.
//
//   ① 히어로 "마음에 자리잡은 단어 **0개**" — 단어 252개를 들고 있는 계정에서.
//
//      ⚠️ 정정(2026-08-16): 처음에 이 결함을 "`refresh_user_known_word_count` 를 아무도
//      호출하지 않는다" 로 적었는데 **틀렸다**. `lib/srs/flush-actions.ts` 가 부르고, 그것은
//      Flashcard·PairFlip·SpellForge·StudyMode·Dictation 세션 종료마다 도는 실제 경로다
//      (`flush-session.flushPendingSession` → 5개 컴포넌트). grep 결과를 읽지 않고
//      "실행 경로 밖" 이라고 단정한 것이 원인이다. 파이프라인은 **멀쩡하다**.
//
//      진짜 문제는 **고른 지표**였다: 그 함수의 정의가 `stability >= 21`(Anki 의 mature 기준)
//      이라 0이 정직한 값이었다. 이 계정의 최대 stability 는 2.31일 — 21일에 닿으려면 몇 달이
//      걸린다. 즉 신규~중급 학습자에게 **몇 달 동안 0을 보여주는 지표**를 회고 화면의
//      주인공으로 세운 것이 결함이다. 계산이 틀린 게 아니라 질문이 틀렸다.
//
//   ② 히트맵 "28일 중 **1일** 학습"
//      `daily_activity.total_minutes > 0` 을 학습일 판정으로 썼는데, 그 컬럼을 채우는
//      트리거가 `ROUND(duration_seconds/60.0)` 이다. 60초 미만 세션은 **0분으로 반올림**되어
//      영원히 누적되지 않는다. 실측: 최근 8일 연속 활동(리뷰 120·142·33…)이 있는데
//      minutes>0 인 날은 1일뿐이었다.
//
//   ③ "시간 1분 · 단어 301개" — 1분에 301단어. 같은 카드 안에서 자기모순.
//
//   그래서 이 모듈은 **분(minutes)을 아예 쓰지 않는다.** 기록되지 않는 값은 그리지 않는다.
//   학습량의 정본은 `learning_records`(리뷰 1건 = 1행, 506행 실측)다.
//
// 무엇을 계산하나 — 회고 화면이 답해야 하는 질문 그대로:
//   · 내 기억은 얼마나 **오래 버티나**   → 지속 사다리(ladder) + 중앙값
//   · 이번 주에 내가 **되찾은 것**은      → rescued (다시 만나 맞힌 단어)
//   · 실제로 며칠, 얼마나 했나            → days28 · streak (리뷰 기준 단일 정의)
//   · 내가 붙잡은 단어는 **어디쯤**인가   → reach (빈도 밴드)
//
// 설계 규칙:
//   · `memory_state` 저장 금지 규칙 준수 — 상태는 언제나 R(t) 동적 계산, 여기서도 저장 안 함
//   · 평가하지 않는다(서술만). 이 계정처럼 정답률이 낮으면 "나빠지고 있다" 로 읽히는
//     추세선이 나올 수 있는데, 그건 철학 ③ Empathetic Feedback 위반이다.
//     그래서 추세 대신 **항상 벌어서 얻는 값**(rescued)을 회고의 정서 축으로 둔다.

import 'server-only'

import { cache } from 'react'

import type { SupabaseClient } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/server'

import { fetchGrowthStats } from './growth-stats'
// 순수 계산·상수는 `growth-math.ts` 가 소유한다 — 클라이언트 컴포넌트와 vitest 가
// 서버 전용 코드를 끌어오지 않도록 나눠 뒀다(그 파일 머리주석 참조).
import {
  RUNGS,
  median,
  rungFor,
  type Ladder,
  type Reach,
  type RescuedWords,
  type RungKey,
  type TraceDay,
} from './growth-math'

export {
  RUNGS,
  formatDuration,
  rungFor,
  type ActivityDayDto,
  type Ladder,
  type Reach,
  type ReachBand,
  type RescuedWords,
  type RungKey,
  type TraceDay,
} from './growth-math'

export interface MemoryHorizon {
  ladder: Ladder
  rescued: RescuedWords
  /** 오늘 포함 최근 28일 (오름차순, 빈 날 0) */
  days28: TraceDay[]
  /** 리뷰가 있는 날 기준 연속 일수 — 이 앱의 streak 정의는 여기 하나다 */
  streak: number
  /** 최근 28일 중 리뷰가 있었던 날 수 */
  activeDays: number
  reach: Reach
}

const KST_MS = 9 * 3_600_000

/** KST 기준 'YYYY-MM-DD' (offsetDays 만큼 과거/미래). */
function kstDateIso(offsetDays = 0): string {
  return new Date(Date.now() + KST_MS + offsetDays * 86_400_000).toISOString().slice(0, 10)
}

/** UTC timestamptz → KST 날짜 문자열. */
function toKstDate(iso: string): string {
  return new Date(new Date(iso).getTime() + KST_MS).toISOString().slice(0, 10)
}

/**
 * 빈도 밴드 경계.
 *
 * 어휘 연구에서 습관적으로 쓰는 구간(1k / 2k / 5k / 10k)을 그대로 쓴다. 밴드는 "얼마나
 * 흔한 단어를 붙잡고 있나" 를 말할 뿐이고, **텍스트 커버리지 %로 환산하지 않는다** —
 * 커버리지는 학습자가 "아는" 전체 어휘 크기를 알아야 나오는 값인데 우리가 가진 것은
 * 저장한 단어뿐이라, 환산하면 반드시 실제보다 낮은 가짜 숫자가 된다.
 */
const REACH_BANDS: { key: string; label: string; max: number }[] = [
  { key: 'b1', label: '1천위 안', max: 1_000 },
  { key: 'b2', label: '1–2천위', max: 2_000 },
  { key: 'b5', label: '2–5천위', max: 5_000 },
  { key: 'b10', label: '5–1만위', max: 10_000 },
  { key: 'bx', label: '1만위 밖', max: Infinity },
]

export const fetchMemoryHorizon = cache(async (): Promise<MemoryHorizon | null> => {
  const client = await createClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) return null

  const lc = client as unknown as SupabaseClient
  const since28 = new Date(Date.now() - 27 * 86_400_000).toISOString()
  const since7 = new Date(Date.now() - 7 * 86_400_000).toISOString()

  const [{ data: vocabRows }, { data: reviewRows }, { data: weekRows }] = await Promise.all([
    lc
      .from('vocabularies')
      .select('id, word, meaning, lemma, stability')
      .eq('user_id', user.id)
      .limit(10_000),
    // 학습량의 정본. minutes 가 아니라 **행 수**를 센다.
    lc
      .from('learning_records')
      .select('vocabulary_id, attempted_at')
      .eq('user_id', user.id)
      .gte('attempted_at', since28)
      .limit(50_000),
    // 되찾은 단어 — 맞힌 것만. 틀린 재시도까지 세면 "되찾았다" 가 거짓이 된다.
    lc
      .from('learning_records')
      .select('vocabulary_id')
      .eq('user_id', user.id)
      .eq('is_correct', true)
      .not('vocabulary_id', 'is', null)
      .gte('attempted_at', since7)
      .limit(50_000),
  ])

  const vocab = (vocabRows ?? []) as Array<{
    id: string
    word: string | null
    meaning: string | null
    lemma: string | null
    stability: number | null
  }>

  // ── 지속 사다리 ──
  const counts = Object.fromEntries(RUNGS.map((r) => [r.key, 0])) as Record<RungKey, number>
  const stabilities: number[] = []
  let unseen = 0
  for (const v of vocab) {
    const s = v.stability ?? 0
    const rung = rungFor(s)
    if (rung === null) {
      unseen += 1
      continue
    }
    stabilities.push(s)
    counts[rung] += 1
  }
  stabilities.sort((a, b) => a - b)
  const ladder: Ladder = {
    counts,
    unseen,
    onLadder: stabilities.length,
    medianDays: median(stabilities),
    topDays: stabilities.length > 0 ? stabilities[stabilities.length - 1] : null,
  }

  // ── 28일 실제 흐름 (리뷰 기준) ──
  const byDate = new Map<string, { reviews: number; words: Set<string> }>()
  for (const r of (reviewRows ?? []) as Array<{
    vocabulary_id: string | null
    attempted_at: string
  }>) {
    const d = toKstDate(r.attempted_at)
    const cell = byDate.get(d) ?? { reviews: 0, words: new Set<string>() }
    cell.reviews += 1
    if (r.vocabulary_id) cell.words.add(r.vocabulary_id)
    byDate.set(d, cell)
  }
  const days28: TraceDay[] = []
  for (let i = 27; i >= 0; i--) {
    const d = kstDateIso(-i)
    const cell = byDate.get(d)
    days28.push({ date: d, reviews: cell?.reviews ?? 0, words: cell?.words.size ?? 0 })
  }

  // ── streak — **자체 계산하지 않는다.**
  //    셸 상태 띠가 `fetchGrowthStats().streak` 을 그리고 있으므로, 이 화면이 따로 세면
  //    같은 순간에 두 숫자가 뜬다. 그게 정확히 이전 화면의 결함이었다(띠 3일 · 히트맵 0일).
  //    `fetchGrowthStats` 는 `cache()` 라 셸이 이미 부른 결과를 그대로 재사용한다 — 추가 쿼리 없음.
  const streak = (await fetchGrowthStats())?.streak ?? 0
  const activeDays = days28.filter((d) => d.reviews > 0).length

  // ── 되찾은 단어 ──
  const rescuedIds = new Set(
    ((weekRows ?? []) as Array<{ vocabulary_id: string | null }>)
      .map((r) => r.vocabulary_id)
      .filter((id): id is string => !!id),
  )
  const byId = new Map(vocab.map((v) => [v.id, v]))
  const sample: RescuedWords['sample'] = []
  for (const id of rescuedIds) {
    const v = byId.get(id)
    if (!v?.word || !v.meaning) continue
    sample.push({ word: v.word, meaning: v.meaning })
    if (sample.length >= 5) break
  }
  const rescued: RescuedWords = { count: rescuedIds.size, sample }

  // ── 빈도 밴드 ──
  const reach = await fetchReach(lc, vocab)

  return { ladder, rescued, days28, streak, activeDays, reach }
})

/**
 * 붙잡고 있는 단어의 빈도 분포.
 *
 * `shared_dictionary.frequency_rank` 는 45,292행 중 일부에만 있다(실측: 순위 보유 ~29k).
 * 순위를 모르는 단어는 **밴드에서 제외**하고 `ranked` 로 몇 개를 실제로 셌는지 함께 낸다 —
 * 모르는 것을 0위로 넣거나 1만위 밖으로 몰면 분포가 조용히 거짓말을 한다.
 */
async function fetchReach(
  lc: SupabaseClient,
  vocab: Array<{ word: string | null; lemma: string | null }>,
): Promise<Reach> {
  const empty: Reach = {
    bands: REACH_BANDS.map((b) => ({ key: b.key, label: b.label, count: 0 })),
    ranked: 0,
    medianRank: null,
  }

  const lemmas = [
    ...new Set(
      vocab
        .map((v) => (v.lemma?.trim() || v.word?.trim() || '').toLowerCase())
        .filter((w) => w.length > 0),
    ),
  ]
  if (lemmas.length === 0) return empty

  // in() 은 URL 길이 제한이 있다 — 500개씩 끊어 조회한다.
  // ⚠️ 순차로 돌리지 말 것. 단어 1만 개인 학습자에게는 왕복이 20번이 되고, 그 20번이
  // 회고면 첫 렌더를 그대로 막는다. 청크는 서로 독립이라 병렬이 옳다.
  const chunks: string[][] = []
  for (let i = 0; i < lemmas.length; i += 500) chunks.push(lemmas.slice(i, i + 500))

  const results = await Promise.all(
    chunks.map((chunk) =>
      lc
        .from('shared_dictionary')
        .select('frequency_rank')
        .in('word', chunk)
        .not('frequency_rank', 'is', null),
    ),
  )

  const ranks: number[] = []
  for (const { data } of results) {
    for (const r of (data ?? []) as Array<{ frequency_rank: number | null }>) {
      if (typeof r.frequency_rank === 'number') ranks.push(r.frequency_rank)
    }
  }
  if (ranks.length === 0) return empty

  const bands = REACH_BANDS.map((b) => ({ key: b.key, label: b.label, count: 0 }))
  for (const rank of ranks) {
    const idx = REACH_BANDS.findIndex((b) => rank <= b.max)
    bands[idx === -1 ? bands.length - 1 : idx].count += 1
  }
  ranks.sort((a, b) => a - b)
  return { bands, ranked: ranks.length, medianRank: median(ranks) }
}

