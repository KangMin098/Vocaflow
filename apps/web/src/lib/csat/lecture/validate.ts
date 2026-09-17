// apps/web/src/lib/csat/lecture/validate.ts
//
// **대본 검사 — 「1타 강사 수준」 중 기계가 잴 수 있는 부분 전부.**
//
// 적재(드레인 import)·회귀·전체 적용이 **이 함수 하나**를 부른다. 검사가 두 벌이면 한쪽만
// 고쳐져, 파일럿에서 막힌 것이 전체 적용에서는 통과하는 일이 생긴다.
//
// 두 층으로 나눈다:
//   · **막는 것**(issues) — 하나라도 있으면 적재하지 않는다. 구조·타깃·낭독 표기·원문 인용(A2)·
//     분석 베껴 읽기(C3)·길이(C4)·지시어(C2)·무근거 판정(C3)
//   · **점수**(mechanical) — 루브릭 중 기계가 채점하는 두 칸: 낭독 적합성 10 · 시간 10.
//     나머지 80점(왜·배제·함정·전략·공식)은 별도 심사관이 매긴다(지시문 C6 「별도 호출」).
//
// ⚠️ 원문(`source`)은 검사에만 쓰고 **결과에는 수만 남긴다**(F4). 어느 구절이 겹쳤는지를
//    문자열로 돌려주면 그 문자열이 리포트 파일을 타고 저장소에 들어온다.

import { cueFocus } from './focus'
import { enWords, estimateSec, koSentences, segmentIssues, syllables } from './speakable'
import { isValidTarget, type TargetSet } from './targets'
import { ROLE_ORDER, type Lecture, type LectureCue, type LectureRole } from './types'

export interface ValidateContext {
  targets: TargetSet
  /** 정답 — 모르면 null */
  answer: number | null
  /** 오답 분석이 있는 선지 번호 — 배제 큐가 **하나씩 전부** 덮어야 한다 */
  wrongChoices: number[]
  /** 함정 이름이 붙은 선지가 있는가 — 있으면 trap 큐가 있어야 한다 */
  hasTrapLabels: boolean
  hasVocab: boolean
  /** 분석 원고(한국어) — 그대로 읽는 것을 잡는다 */
  analysisTexts: string[]
  /** 기출 원문(지문·문두·선지) — 8단어 연속 인용을 잡는다. **결과에 남기지 않는다.** */
  sourceTexts: string[]
}

export interface Issue {
  code: string
  cue?: string
  msg: string
}

export interface ValidateResult {
  ok: boolean
  issues: Issue[]
  /** 기계 채점 두 칸 */
  mechanical: { reading: number; time: number }
  stats: {
    cues: number
    totalSec: number
    maxCueSec: number
    koSentences: number
    longSentences: number
    /** 원문과 겹친 8단어 연쇄 수 — 0 이어야 한다 */
    quoteHits: number
  }
}

export const LIMITS = {
  cuesMin: 8,
  cuesMax: 14,
  cueSecMax: 20,
  totalSecMin: 150,
  totalSecMax: 270,
  pauseMin: 300,
  pauseMax: 900,
  /** 권장 문장 길이(음절) — 넘는 비율만큼 낭독 점수가 깎인다 */
  sentenceSoft: 22,
  /** 이보다 긴 한 문장은 막는다 — 숨이 차서 목소리가 끊어 읽는다 */
  sentenceHard: 40,
  quoteWords: 8,
  copyChars: 20,
} as const

const DIRECTIVE =
  /보세요|보시면|봅시다|볼까요|보시죠|봐요|봐 주세요|여기|짚어|짚을|짚습|짚겠|주목|확인하|확인해|찾아|찾으|눈여겨|표시하|표시해|밑줄/
/**
 * 무근거 난이도 판정 — **문제·문항에 대한** 판정만 잡는다.
 * 처음에는 「쉽죠·어렵죠」를 통째로 막았는데, 파일럿에서 「속마음이 새어 나오면 읽기는 오히려
 * 쉽죠」(지문 논리를 풀어 말한 것)가 걸렸다. 막을 것은 「이 문제는 쉽습니다」 류다.
 */
const BANNED = /(문제|문항)(은|는|이|가)?\s*(아주|정말|꽤|좀|너무)?\s*(쉽|어렵|쉬워|어려워)|(쉬운|어려운)\s*(문제|문항)/

/** 역할별로 가리켜도 되는 곳 — 강의가 말하는 것과 빛나는 것이 같은 종류여야 한다 */
const ROLE_TARGETS: Record<LectureRole, RegExp> = {
  intro: /^analysis:(head|ability|intent)$/,
  strategy: /^(analysis:(head|ability|intent|procedure|map)|anchor:sentence:\d+)$/,
  structure: /^(analysis:(map|intent|ability|procedure)|anchor:sentence:\d+)$/,
  evidence: /^(analysis:(answer|map)|anchor:sentence:\d+)$/,
  eliminate: /^analysis:reject:\d$/,
  trap: /^(analysis:reject:\d|anchor:sentence:\d+)$/,
  vocab: /^(analysis:vocab|anchor:sentence:\d+)$/,
  wrapup: /^analysis:(procedure|head|ability)$/,
}

const ORDINAL: Record<string, number> = {
  첫: 1, 두: 2, 세: 3, 네: 4, 다섯: 5, 여섯: 6, 일곱: 7, 여덟: 8, 아홉: 9, 열: 10, 열한: 11, 열두: 12, 열세: 13,
}
const HERE_ORDINAL = new RegExp(
  `여기[,\\s]*(${Object.keys(ORDINAL).sort((a, b) => b.length - a.length).join('|')})(?:\\s*번째)?\\s*문장`,
  'g',
)

/** 「여기 세 번째 문장」 「여기, 첫 문장」 → [3] · [1]. 「여기」 없이 번호만 말한 것은 세지 않는다(가리키기가 아니라 언급이다). */
export function spokenHereOrdinals(ko: string): number[] {
  return [...ko.matchAll(HERE_ORDINAL)].map((m) => ORDINAL[m[1]])
}

const words = (s: string) => (s.toLowerCase().match(/[a-z0-9]+(?:['’][a-z]+)?/g) ?? []).map((w) => w.replace('’', "'"))
const squash = (s: string) => s.replace(/[\s.,!?·…'"“”‘’()\-—~]/g, '')

function ngrams(ws: string[], n: number): Set<string> {
  const out = new Set<string>()
  for (let i = 0; i + n <= ws.length; i += 1) out.add(ws.slice(i, i + n).join(' '))
  return out
}

export function validateLecture(lec: Lecture, ctx: ValidateContext): ValidateResult {
  const issues: Issue[] = []
  const add = (code: string, msg: string, cue?: LectureCue) => issues.push({ code, msg, cue: cue?.id })
  const cues = lec.cues ?? []

  // ── 구조 ──────────────────────────────────────────────────────────────
  if (cues.length < LIMITS.cuesMin || cues.length > LIMITS.cuesMax)
    add('cue-count', `큐 ${cues.length}개 — ${LIMITS.cuesMin}~${LIMITS.cuesMax} 밖`)
  const ids = new Set<string>()
  let lastRole = -1
  cues.forEach((c, i) => {
    if (ids.has(c.id)) add('dup-id', `큐 id 중복 ${c.id}`, c)
    ids.add(c.id)
    if (c.order !== i + 1) add('order', `order ${c.order} ≠ ${i + 1}`, c)
    const r = ROLE_ORDER.indexOf(c.role)
    if (r < 0) add('role', `모르는 역할 ${c.role}`, c)
    else if (r < lastRole) add('role-order', `역할 순서가 거꾸로 — ${c.role} 이 ${ROLE_ORDER[lastRole]} 뒤에 왔다`, c)
    lastRole = Math.max(lastRole, r)

    // A3 — 바인딩 없는 큐 거부
    if (!c.target || !isValidTarget(ctx.targets, c.target))
      add('target', `화면에 없는 타깃 ${c.target?.kind}:${c.target?.id}`, c)
    else if (!ROLE_TARGETS[c.role]?.test(`${c.target.kind}:${c.target.id}`))
      add('role-target', `${c.role} 큐가 ${c.target.kind}:${c.target.id} 를 가리킨다`, c)

    if (!(c.pause_after_ms >= LIMITS.pauseMin && c.pause_after_ms <= LIMITS.pauseMax))
      add('pause', `pause_after_ms ${c.pause_after_ms} — ${LIMITS.pauseMin}~${LIMITS.pauseMax} 밖`, c)
    if (!c.segments?.length) add('empty', '조각이 없다', c)
    for (const g of c.segments ?? []) for (const why of segmentIssues(g)) add('speakable', why, c)

    const ko = (c.segments ?? []).filter((g) => g.lang === 'ko-KR').map((g) => g.text).join(' ')
    if (!DIRECTIVE.test(ko)) add('directive', '지시어(「여기 보세요」 류)가 없다', c)
    if (BANNED.test(ko)) add('banned', '무근거 난이도 판정', c)

    // 귀와 눈이 같은 곳을 가리키는가 — 「여기 N번째 문장」이라고 말하면 N번째 막대가 켜져 있어야 한다.
    // 파일럿에서 심사관이 잡았다: 화면은 일곱 번째 막대를 켜 놓고 「여기 두 번째 문장을 보세요」라고 말했다.
    for (const n of spokenHereOrdinals(ko)) {
      const k = c.target?.kind === 'anchor' ? Number(c.target.id.split(':')[1]) : NaN
      if (k + 1 !== n) add('pointing', `「여기 ${n}번째 문장」이라 말하는데 화면은 ${c.target?.kind}:${c.target?.id} 를 켠다`, c)
    }
    // 분석 블록을 가리키며 문장 번호를 말하면, 그 번호가 `focus` 로 실려 있어야 지도가 같은 막대를 켠다.
    // 적재가 채우는 값이다 — 어긋나면 옛 데이터(채우기 전) 이거나 손으로 고친 것이다.
    if (c.target) {
      const want = cueFocus(c, ctx.targets.useMap ? ctx.targets.anchor.length : 0)
      if (JSON.stringify(want ?? null) !== JSON.stringify(c.focus ?? null))
        add('focus', `말한 문장 ${JSON.stringify(want ?? [])} ≠ 실린 focus ${JSON.stringify(c.focus ?? [])}`, c)
    }
  })

  const roles = new Set(cues.map((c) => c.role))
  for (const need of ['intro', 'strategy', 'structure', 'wrapup'] as LectureRole[])
    if (!roles.has(need)) add('missing-role', `${need} 큐가 없다`)
  if (ctx.answer != null && !roles.has('evidence')) add('missing-role', 'evidence 큐가 없다')
  if (ctx.hasTrapLabels && !roles.has('trap')) add('missing-role', 'trap 큐가 없다')
  if (ctx.hasVocab && !roles.has('vocab')) add('missing-role', 'vocab 큐가 없다')

  // 오답 배제 — 선지마다 한 큐, 빠짐도 겹침도 없이
  const elim = cues.filter((c) => c.role === 'eliminate').map((c) => Number(c.target.id.split(':')[1]))
  for (const n of ctx.wrongChoices) {
    const k = elim.filter((x) => x === n).length
    if (k === 0) add('eliminate-missing', `${n}번 선지를 지우는 큐가 없다`)
    if (k > 1) add('eliminate-dup', `${n}번 선지를 지우는 큐가 ${k}개`)
  }
  for (const n of elim) {
    if (ctx.answer != null && n === ctx.answer) add('eliminate-answer', '정답을 지우는 큐가 있다')
  }

  // ── 문체 · 낭독 ─────────────────────────────────────────────────────────
  const allKo = cues.flatMap((c) => c.segments.filter((g) => g.lang === 'ko-KR').map((g) => g.text))
  if (!allKo.some((t) => t.includes('여러분'))) add('address', '학습자를 「여러분」으로 부르지 않는다')
  const sentences = allKo.flatMap((t) => koSentences(t))
  const long = sentences.filter((s) => syllables(s) > LIMITS.sentenceSoft).length
  for (const c of cues)
    for (const g of c.segments)
      if (g.lang === 'ko-KR')
        for (const s of koSentences(g.text))
          if (syllables(s) > LIMITS.sentenceHard) add('sentence-long', `한 문장 ${syllables(s)}음절 — ${LIMITS.sentenceHard} 초과`, c)

  // C3 — 분석 원고를 그대로 읽지 않는다(띄어쓰기·문장부호를 걷고 20자 연속 일치를 센다)
  const shingles = new Set<string>()
  for (const t of ctx.analysisTexts) {
    const s = squash(t)
    for (let i = 0; i + LIMITS.copyChars <= s.length; i += 1) shingles.add(s.slice(i, i + LIMITS.copyChars))
  }
  for (const c of cues) {
    const s = squash(c.segments.filter((g) => g.lang === 'ko-KR').map((g) => g.text).join(''))
    for (let i = 0; i + LIMITS.copyChars <= s.length; i += 1)
      if (shingles.has(s.slice(i, i + LIMITS.copyChars))) {
        add('copy', `분석 원고를 ${LIMITS.copyChars}자 이상 그대로 읽는다`, c)
        break
      }
  }

  // A2 — 원문 8단어 연속 인용
  const src = new Set<string>()
  for (const t of ctx.sourceTexts) for (const g of ngrams(words(t), LIMITS.quoteWords)) src.add(g)
  let quoteHits = 0
  for (const c of cues) {
    const en = c.segments.map((g) => g.text).join(' ')
    const hits = [...ngrams(words(en), LIMITS.quoteWords)].filter((g) => src.has(g)).length
    if (hits) {
      quoteHits += hits
      add('quote', `원문과 ${LIMITS.quoteWords}단어 이상 연속 일치`, c)
    }
  }

  // ── 길이(적재가 계산) ────────────────────────────────────────────────────
  const secs = cues.map((c) => estimateSec(c.segments))
  const totalSec = Math.round(secs.reduce((a, b) => a + b, 0) + cues.reduce((a, c) => a + c.pause_after_ms, 0) / 1000)
  const maxCueSec = secs.length ? Math.max(...secs) : 0
  secs.forEach((s, i) => {
    if (s > LIMITS.cueSecMax) add('cue-long', `${s}초 — ${LIMITS.cueSecMax}초 초과`, cues[i])
  })
  if (totalSec < LIMITS.totalSecMin || totalSec > LIMITS.totalSecMax)
    add('total', `총 ${totalSec}초 — ${LIMITS.totalSecMin}~${LIMITS.totalSecMax}초 밖`)

  // ── 기계 채점 ───────────────────────────────────────────────────────────
  const longShare = sentences.length ? long / sentences.length : 1
  const readingPenalty = issues.some((i) => ['speakable', 'sentence-long', 'directive', 'address'].includes(i.code)) ? 3 : 0
  const reading = Math.max(0, Math.round(10 * (1 - longShare)) - readingPenalty)
  const overCues = secs.filter((s) => s > LIMITS.cueSecMax).length
  const time =
    totalSec < LIMITS.totalSecMin || totalSec > LIMITS.totalSecMax ? 0 : Math.max(0, 10 - overCues * 3)

  return {
    ok: issues.length === 0,
    issues,
    mechanical: { reading, time },
    stats: {
      cues: cues.length,
      totalSec,
      maxCueSec,
      koSentences: sentences.length,
      longSentences: long,
      quoteHits,
    },
  }
}

/** 적재가 덮어쓰는 값 — 쓰는 쪽의 어림을 믿지 않는다 */
export function withComputedTimes(lec: Lecture): Lecture {
  const cues = lec.cues.map((c) => ({ ...c, est_sec: estimateSec(c.segments) }))
  const total = Math.round(cues.reduce((a, c) => a + c.est_sec, 0) + cues.reduce((a, c) => a + c.pause_after_ms, 0) / 1000)
  return { ...lec, cues, total_sec_est: total }
}

/** 영어 조각 단어 수 — 리포트용 */
export const lectureEnWords = (lec: Lecture) =>
  lec.cues.reduce((a, c) => a + c.segments.filter((g) => g.lang === 'en-US').reduce((b, g) => b + enWords(g.text), 0), 0)
