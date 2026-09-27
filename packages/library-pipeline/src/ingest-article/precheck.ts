// packages/library-pipeline/src/ingest-article/precheck.ts
//
// **모음 단계 사전검증** — 원문을 창고에 넣기 전에 비용 낮은 순서로 본다(2026-09-25 · 사용자 지시).
//
//   ① 분류   원천이 준 카테고리·태그          — 규칙 · 비용 0
//   ② 제목   부적합 신호(topic-fitness) + 원천별 noiseKeywords — 규칙 · 비용 0
//   ③ 앞부분 본문 앞 200어의 영어 비율 · 산문 비율 · 안내문 표지 — 규칙 · 비용 0
//   ④ 전문   ② 원문 점검(LLM 판정) — 여기서 하지 않는다. 가장 비싸므로 ①~③ 을 통과한 것만 간다.
//
// ── 왜 원천마다 켜고 끄나 (실측 2026-09-25, 제목 분류기를 적재분 전량에 대 봤다) ──
//   wikinews           19,486 중 부적합 33.8% — 표본이 전부 체포·폭동·사망·재판. **정확하다.**
//   nih_news_in_health    800 중 1.6% — 「Heart Attack」「Cardiac Arrest」 사망 통계. **전부 오판.**
//   gdl                   300 중 2   — 그림책 「Shock! Crash!」. **오판.**
//   → 제목 규칙은 뉴스형 원천에서만 막고, 건강·그림책에서는 끈다.
//
// ── 버리지 않고 표시한다 ──
//   기본은 'flag' — 결과를 `csat_fit.precheck` 에 남기고 적재한다(② 원문 점검의 우선순위 재료).
//   'block' 으로 켠 원천만 적재를 건너뛴다. 이미 적재된 대기분은 `archived` 로 돌린다(되돌릴 수 있다).
//   규칙이 틀렸을 때 되돌릴 수 있어야 한다 — 규칙이 정당한 글을 걸면 글이 아니라 **규칙을 고친다**(AGENTS.md).

import { classifyTopic } from '../compose/topic-fitness'
import { FEED_SPECS, SOURCE_DEFAULT_SPEC, type FeedSpec } from './_curation-spec'

// v2 (2026-09-25) — wikinews · global_voices 제목 막음 해제. 판본이 바뀌면 backfill 이 다시 판정한다.
export const PRECHECK_VERSION = 2

export type PrecheckMode = 'off' | 'flag' | 'block'
export type PrecheckStage = 'category' | 'title' | 'head'

export interface PrecheckPolicy {
  category: PrecheckMode
  title: PrecheckMode
  head: PrecheckMode
  /** 이 카테고리·태그가 붙으면 ① 에서 걸린다. 원천이 카테고리를 줄 때만 뜻이 있다. */
  categoryBlock?: RegExp[]
}

const DEFAULT: PrecheckPolicy = { category: 'flag', title: 'flag', head: 'flag' }

/**
 * 원천별 정책. 여기 없는 원천은 DEFAULT(전부 표시만)다.
 *
 * 'block' 은 **실측으로 오판이 드물다고 확인한 자리에만** 건다. 새로 막고 싶으면 먼저
 * 적재분 전량에 대 보고 부적합 표본을 눈으로 본다(AGENTS.md — 일화로 권고하지 않는다).
 */
export const PRECHECK_POLICY: Record<string, PrecheckPolicy> = {
  // 뉴스형 — 제목은 **표시만**. 처음엔 막았다(제목 표본을 눈으로 보고 「정확하다」고 판단) — 틀렸다.
  //   원문 점검 회차 6 에서 사전검증이 막은 7편을 판정자 둘이 전부 읽었더니 **보관 13/14 판정**이었다
  //   (가짜 폭탄 탐지기 → 통념 교정 · 의무투표 항소 → 주장-근거 · 기후 토론). 제목의 사건 신호는
  //   「지문으로 못 쓴다」가 아니다. 6,434편은 --restore 로 되돌렸다. 스포츠는 수집기가 이미 뺀다.
  wikinews: {
    category: 'block',
    title: 'flag',
    head: 'block',
    categoryBlock: [/sport|football|cricket|olympic|baseball|basketball|tennis|golf|rugby|motorsport|obituar|crime/i],
  },
  // 제목은 표시만 — 막았더니 19/100 이 걸렸는데 전부 시위·민주주의·거리 예술을 다룬 **분석·논평**이었다
  //   (「Protests can change governments, but can they strengthen democracy?」). 사건 속보인 wikinews 와 다르다.
  global_voices: { category: 'flag', title: 'flag', head: 'block' },
  // 건강·그림책 — 제목 규칙이 오판한다(사망 통계·「Crash!」). 끈다.
  nih_news_in_health: { category: 'flag', title: 'off', head: 'block' },
  // 그림책은 앞부분도 표시만 — 「Little hat, big hat.」처럼 기능어·마침표가 적은 정상 책이 걸린다(실측 4/668).
  gdl: { category: 'flag', title: 'off', head: 'flag' },
  global_storybooks: { category: 'flag', title: 'off', head: 'flag' },
  storyweaver: { category: 'flag', title: 'off', head: 'flag' },
  african_storybook: { category: 'flag', title: 'off', head: 'flag' },
  eia_kids: { category: 'flag', title: 'off', head: 'block' },
  openstax: { category: 'flag', title: 'off', head: 'block' },
}

export function precheckPolicy(source: string): PrecheckPolicy {
  return PRECHECK_POLICY[source] ?? DEFAULT
}

// ── ③ 앞부분 — 규칙 ─────────────────────────────────────────────────

const FUNCTION_WORDS = new Set(
  'the a an of to and in is was for on that with as by it at from be are this which or have has had not but they he she we you his her their its were been will would can i my me our your him them what when where how why do does did there'.split(' '),
)

/** 앞 N 어 — 문단 경계를 유지한 채 자른다. */
export function headOf(content: string, words = 200): string {
  const out: string[] = []
  let n = 0
  for (const para of String(content ?? '').split(/\n{2,}/)) {
    const w = para.trim().split(/\s+/).filter(Boolean)
    if (!w.length) continue
    out.push(w.slice(0, Math.max(0, words - n)).join(' '))
    n += w.length
    if (n >= words) break
  }
  return out.join('\n\n')
}

/** 기능어 비율 — 라틴문자 비율로는 독일어·스페인어를 못 거른다(openalex 에서 확인된 함정). */
export function englishRatio(text: string): number {
  const toks = (text.toLowerCase().match(/[a-z']+/g) ?? [])
  if (toks.length < 20) return 1 // 너무 짧으면 판단하지 않는다(그림책 한 쪽)
  return toks.filter((t) => FUNCTION_WORDS.has(t)).length / toks.length
}

/**
 * 문장 밀도 — 100어당 문장 끝(. ! ?) 수. 목록·표·메뉴는 마침표가 거의 없어 낮다.
 *
 * ⚠️ 처음엔 「문장부호로 끝나는 문단의 어수 비율」로 쟀다 — wikinews 는 문장 중간에서
 *   줄을 끊은 원문이 많고(137편), 그림책은 한 쪽에 한 줄이라(15편) 멀쩡한 산문을 떨어뜨렸다.
 *   줄 모양이 아니라 문장 끝의 **밀도**를 본다.
 */
export function proseRatio(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length
  if (!words) return 0
  const ends = (text.match(/[.!?](?=["'”’)\]]*(\s|$))/g) ?? []).length
  return (100 * ends) / words
}

// 강한 신호만 — 「click here」「all rights reserved」는 웹사이트를 다루는 **기사 본문**에도 나와
//   wikinews 4편을 잘못 걸었다. 페이지 껍데기에서만 나오는 문구만 둔다.
const BOILERPLATE = [
  /\b(cookie|cookies) (policy|settings|preferences)\b/i,
  /\bjavascript (is )?(required|disabled)\b/i,
  // 「access denied」는 뺐다 — 차단·검열 기사 본문에 나온다(wikinews 3편 오판).
  /\b(page not found|404 not found)\b/i,
  /\bskip to (main )?content\b/i,
]

// 기준값 — 적재분 실측으로 정했다(precheck.test.ts 가 근거 수치를 고정한다).
export const HEAD_THRESHOLDS = { englishMin: 0.12, proseMin: 1.5 }

// ── 판정 ──────────────────────────────────────────────────────────────

export interface PrecheckInput {
  source: string
  title?: string | null
  content?: string | null
  categories?: string[] | null
  feedId?: string | null
}

export interface PrecheckResult {
  v: number
  verdict: 'pass' | 'flag' | 'block'
  /** `단계:사유` — 예) `title:unfit` `head:non_english` `category:Sports` */
  reasons: string[]
  /** 걸린 단계 중 'block' 으로 켜진 것 — 비었으면 막히지 않는다. */
  blockedBy: PrecheckStage[]
  head: { english: number; prose: number; words: number }
}

function noiseKeywordsOf(source: string, feedId?: string | null): string[] {
  const feed = feedId ? FEED_SPECS[feedId] : undefined
  const base = (SOURCE_DEFAULT_SPEC as Partial<Record<string, FeedSpec>>)[source]
  return [...(feed?.noiseKeywords ?? []), ...(base?.noiseKeywords ?? [])].map((k) => k.toLowerCase())
}

export function precheckArticle(input: PrecheckInput): PrecheckResult {
  const policy = precheckPolicy(input.source)
  const hits: Array<[PrecheckStage, string]> = []

  // ① 분류
  if (policy.category !== 'off') {
    for (const c of input.categories ?? []) {
      if ((policy.categoryBlock ?? []).some((re) => re.test(c))) hits.push(['category', c])
    }
  }

  // ② 제목
  const title = String(input.title ?? '')
  if (policy.title !== 'off' && title) {
    if (classifyTopic(title) === 'unfit') hits.push(['title', 'unfit'])
    const lower = title.toLowerCase()
    const noise = noiseKeywordsOf(input.source, input.feedId).find((k) => k && lower.includes(k))
    if (noise) hits.push(['title', `noise:${noise}`])
  }

  // ③ 앞부분
  const head = headOf(String(input.content ?? ''))
  const words = head.split(/\s+/).filter(Boolean).length
  const english = englishRatio(head)
  const prose = proseRatio(head)
  if (policy.head !== 'off') {
    if (!words) hits.push(['head', 'empty'])
    else {
      if (english < HEAD_THRESHOLDS.englishMin) hits.push(['head', 'non_english'])
      // 산문 비율은 40어 이상일 때만 — 그림책 한 쪽·짧은 시는 판단하지 않는다.
      if (words >= 40 && prose < HEAD_THRESHOLDS.proseMin) hits.push(['head', 'not_prose'])
      // 안내문 표지는 **짧은 본문에서만** 본다 — 페이지 껍데기는 짧다. 긴 기사는 그 문구를 보도한다
      //   (wikinews 「The Pirate Bay back online」의 404 Not Found · 「Telegram …」의 cookie policy).
      const bp = words < 120 && BOILERPLATE.find((re) => re.test(head))
      if (bp) hits.push(['head', 'boilerplate'])
    }
  }

  const blockedBy = [...new Set(hits.filter(([stage]) => policy[stage] === 'block').map(([s]) => s))]
  return {
    v: PRECHECK_VERSION,
    verdict: blockedBy.length ? 'block' : hits.length ? 'flag' : 'pass',
    reasons: hits.map(([s, r]) => `${s}:${r}`),
    blockedBy,
    head: { english: Math.round(english * 1000) / 1000, prose: Math.round(prose * 1000) / 1000, words },
  }
}
