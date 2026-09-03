// packages/library-pipeline/src/textbook/curriculum.ts
//
// **2022 개정 영어과 교육과정 기본어휘 3,000 — 한국 학년 수준의 정본 자.**
//
// ── 왜 FK 만으로는 안 되는가 ─────────────────────────────────────────
// `readability.ts` 의 FK 는 **문장 길이와 음절만** 본다. 낱말이 오늘 쓰이는 말인지,
// 그 학년이 배우는 말인지 모른다. 그래서 두 번 크게 틀렸다(둘 다 실측):
//
//   · NASA 사진 설명글 — FK 는 낮은데 내용어의 **64%가 교육과정 별표 밖**이었다
//     (`photosynthesis` 와 `unhappiness` 를 같은 5음절로 세니 그럴 수밖에 없다)
//   · Project Gutenberg — `Little Women`(1868)·`Tom Sawyer`(1876)가 **FK 로는 초6~중1** 이다.
//     19세기 어휘를 FK 는 못 본다
//
// 한국 초·중 학습자에게 "그 학년 수준" 은 문장 길이가 아니라 **교육과정이 그 학년에
// 배우라고 정한 낱말 안에 있는가**로 정해진다. 그 목록이 이 저장소에 이미 있었다 —
// 다만 **읽는 코드가 없어** 일회성 임포트 산출물로 놀고 있었다.
//
// ── 등급은 문서의 별표 표기 그대로다 ─────────────────────────────────
//     `kcurr2022_1`  단일 별표 `*`   819낱말   a · about · above · across · act …
//     `kcurr2022_2`  이중 별표 `**` 1,215낱말   able · absolute · accent · accept …
//     `kcurr2022_0`  무표시        1,011낱말   abandon · aboard · abort · abound …
//
// 별책14 의 표기 관례상 `*` 가 초등 권장 · `**` 가 중학 · 무표시가 고등이고,
// **낱말 표본이 그 해석을 뒷받침한다**(`a/about/above` vs `abandon/aboard/abort`).
// 그래도 이름은 문서 표기를 그대로 쓴다 — 해석을 이름에 박으면 나중에 못 고친다.
//
// ⚠️ **굴절형을 완전히 되돌리지 않는다**(`-s`·`-es`·`-ies`·`-ed`·`-ing` 만). 그래서 적중률은
//   **하한**이다 — 실제 적중은 이보다 높다. 소스끼리 견주는 데는 같은 잣대라 문제없지만
//   "적중 62%" 를 절대값으로 인용하면 과소평가한다.
// ⚠️ 원문 목록에 **고유명사·숫자·파생형이 없다**(CSV 머리말). 사람 이름이 많은 이야기는
//   그만큼 적중률이 낮게 나온다 — 이야기와 설명문을 이 값 하나로 견주면 안 된다.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))

/** CSV 는 `packages/library-pipeline/data/curriculum/` 에 있다. src 기준 두 칸 위다. */
function loadList(id: string): Set<string> {
  const file = path.resolve(HERE, '..', '..', 'data', 'curriculum', `${id}.csv`)
  const out = new Set<string>()
  let raw: string
  try {
    raw = fs.readFileSync(file, 'utf8')
  } catch {
    // **없으면 빈 집합을 돌려주지 않는다** — 빈 집합은 "적중 0%" 로 읽혀
    //   멀쩡한 지문이 전부 어휘 밖으로 판정된다. 못 읽었으면 못 읽었다고 말한다.
    throw new Error(`교육과정 어휘 목록을 못 읽었다: ${file}`)
  }
  for (const line of raw.split('\n')) {
    const w = line.trim()
    if (!w || w.startsWith('#') || w === 'word') continue
    out.add(w.split(',')[0]!.trim().toLowerCase())
  }
  return out
}

let cache: { star1: Set<string>; star2: Set<string>; plain: Set<string> } | null = null

/** 세 등급 목록. 처음 부를 때만 읽는다. */
export function curriculumLists(): { star1: Set<string>; star2: Set<string>; plain: Set<string> } {
  cache ??= {
    star1: loadList('kcurr2022_1'),
    star2: loadList('kcurr2022_2'),
    plain: loadList('kcurr2022_0'),
  }
  return cache
}

/**
 * 기능어는 어느 학년에나 있다 — 적중률의 분모에서 뺀다.
 * 안 빼면 어떤 글이든 90%대가 나와 소스끼리 구별이 안 된다.
 */
const FUNCTION_WORDS = new Set(
  (
    'a an the and or but if of to in on at by for with from as is are was were be been being am ' +
    'do does did have has had i you he she it we they me him her us them my your his its our their ' +
    'this that these those there here not no yes so then than too very can could will would shall ' +
    'should may might must up down out off over under again more most all any some such no nor'
  ).split(' ')
)

/** 굴절 되돌리기 — 완전하지 않다. 그래서 적중률은 하한이다. */
export function stemLoose(w: string): string {
  if (w.endsWith('ies') && w.length > 4) return `${w.slice(0, -3)}y`
  if (w.endsWith('es') && w.length > 4) return w.slice(0, -2)
  if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) return w.slice(0, -1)
  if (w.endsWith('ing') && w.length > 5) return w.slice(0, -3)
  if (w.endsWith('ed') && w.length > 4) return w.slice(0, -2)
  return w
}

export interface CurriculumCoverage {
  /** 기능어를 뺀 내용어 수 — 적중률의 분모. */
  contentWords: number
  /** `*`(초등 권장) 안에 드는 비율 %. */
  star1Pct: number
  /** `*`+`**`(중학까지) 누적 %. */
  throughStar2Pct: number
  /** 3,000 낱말 전체 누적 %. */
  throughAllPct: number
  /** **교육과정 밖** 비율 % — 이 값이 크면 그 학년 지문이 아니다. */
  outsidePct: number
}

/**
 * 지문의 내용어가 교육과정 별표 안에 얼마나 드는가.
 *
 * 판정에 쓰는 것은 대개 `outsidePct` 다 — "몇 %가 그 학년이 안 배운 낱말인가".
 * NASA 사진 설명글은 이 값이 **64%** 였다.
 */
export function curriculumCoverage(text: string): CurriculumCoverage | null {
  const { star1, star2, plain } = curriculumLists()
  const all = (String(text ?? '').match(/[A-Za-z][A-Za-z'-]*/g) ?? []).map((w) => w.toLowerCase())
  const content = all.filter((w) => !FUNCTION_WORDS.has(w) && w.length > 1)
  if (!content.length) return null

  let s1 = 0
  let s2 = 0
  let inAny = 0
  for (const w of content) {
    const s = stemLoose(w)
    const in1 = star1.has(w) || star1.has(s)
    const in2 = in1 || star2.has(w) || star2.has(s)
    const in0 = in2 || plain.has(w) || plain.has(s)
    if (in1) s1++
    if (in2) s2++
    if (in0) inAny++
  }
  const pct = (n: number) => +((n / content.length) * 100).toFixed(1)
  return {
    contentWords: content.length,
    star1Pct: pct(s1),
    throughStar2Pct: pct(s2),
    throughAllPct: pct(inAny),
    outsidePct: pct(content.length - inAny),
  }
}

/**
 * 초·중 지문으로 쓸 만한 어휘인가.
 *
 * 기준을 **하나의 문턱**으로 두지 않고 두 값을 함께 본다:
 *   · `throughStar2Pct` — 중학까지의 낱말로 얼마나 덮이는가
 *   · `outsidePct`      — 교육과정 3,000 밖이 얼마나 되는가
 *
 * ⚠️ 문턱은 **실측에서 나온 값이 아니라 아직 정한 값이다.** 우리 지문 실측에서
 *   NASA(별표 밖 64%)와 재저작문(별표 밖 21%)이 크게 갈렸고 그 사이 어딘가라는 것만 안다.
 *   시중 교재 지문으로 같은 값을 재면 그때 이 수를 실측으로 바꿔야 한다.
 */
export const CURRICULUM_GATE = { maxOutsidePct: 40 } as const

export function passesCurriculumGate(text: string): {
  pass: boolean
  coverage: CurriculumCoverage | null
  reason: string | null
} {
  const c = curriculumCoverage(text)
  if (!c) return { pass: false, coverage: null, reason: '내용어가 없어 잴 수 없다' }
  if (c.outsidePct > CURRICULUM_GATE.maxOutsidePct) {
    return {
      pass: false,
      coverage: c,
      reason: `내용어의 ${c.outsidePct}% 가 교육과정 3,000 밖이다(상한 ${CURRICULUM_GATE.maxOutsidePct}%)`,
    }
  }
  return { pass: true, coverage: c, reason: null }
}
