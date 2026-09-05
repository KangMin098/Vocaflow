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

/**
 * **가장 흔한 불규칙 과거·과거분사**만 되돌린다.
 *
 * 규칙으로는 손댈 수 없고, 이야기 지문에는 거의 모든 문장에 하나씩 있다.
 * 목록을 길게 늘리지 않는다 — 여기 없는 것은 여전히 '밖' 으로 세어지고, 그것이
 * "적중률은 하한" 이라는 이 파일의 약속이다.
 */
const IRREGULAR = new Map(
  Object.entries({
    took: 'take', taken: 'take', gave: 'give', given: 'give', went: 'go', gone: 'go',
    saw: 'see', seen: 'see', made: 'make', came: 'come', ran: 'run', sat: 'sit',
    stood: 'stand', fell: 'fall', fallen: 'fall', told: 'tell', heard: 'hear',
    thought: 'think', caught: 'catch', brought: 'bring', held: 'hold', kept: 'keep',
    left: 'leave', felt: 'feel', found: 'find', got: 'get', gotten: 'get', knew: 'know',
    known: 'know', grew: 'grow', grown: 'grow', flew: 'fly', flown: 'fly', drew: 'draw',
    threw: 'throw', wrote: 'write', written: 'write', spoke: 'speak', spoken: 'speak',
    broke: 'break', broken: 'break', chose: 'choose', rose: 'rise', ate: 'eat',
    eaten: 'eat', drank: 'drink', began: 'begin', begun: 'begin', won: 'win',
    lost: 'lose', sent: 'send', built: 'build', bought: 'buy', taught: 'teach',
    slept: 'sleep', met: 'meet', paid: 'pay', said: 'say', put: 'put', read: 'read',
    lay: 'lie', laid: 'lay', led: 'lead', rode: 'ride', ridden: 'ride', swam: 'swim',
    sang: 'sing', sung: 'sing', hung: 'hang', dug: 'dig', hid: 'hide', hidden: 'hide',
    children: 'child', men: 'man', women: 'woman', feet: 'foot', teeth: 'tooth',
    mice: 'mouse', geese: 'goose', leaves: 'leaf', lives: 'life', wolves: 'wolf',
  })
)

/**
 * **한 낱말의 어간 후보를 모두 낸다.**
 *
 * ── 왜 하나로는 안 되나 (실측 2026-09-05) ────────────────────────────
 * `stemLoose` 는 규칙 하나로 어간 **하나**를 만든다. 그래서 이렇게 틀린다:
 *
 *   `carried` → `carri`  (→ `carry` 를 못 찾는다)
 *   `tired`   → `tir`    (→ `tire` 를 못 찾는다)
 *   `stopped` → `stopp`  (→ `stop` 을 못 찾는다)
 *   `took`    → `took`   (불규칙은 규칙이 없다)
 *
 * 넷 다 교육과정 **안** 낱말인데 '밖' 으로 세어졌다. 그리고 이 편향은 **대칭이 아니다** —
 * 과거시제 이야기 지문에만 몰린다. 시중 초등 교재의 절반이 이야기인데, 그 절반만
 * 체계적으로 어렵게 측정된 셈이다(각색 실측: `The Roti and the Thieves` 51.9%.
 * `carried`·`took`·`grabbed`·`tired` 가 전부 '밖' 이었다).
 *
 * 그래서 어간을 **하나로 정하지 않고 후보를 모두 내어** 하나라도 목록에 있으면 안으로 센다.
 * 되돌리기가 과할 위험은 낮다 — 후보가 실제 표제어가 아니면 목록에 없어서 그냥 안 걸린다.
 */
export function stemCandidates(w: string): string[] {
  const out = new Set<string>([w])
  const irr = IRREGULAR.get(w)
  if (irr) out.add(irr)
  out.add(stemLoose(w))
  if (w.endsWith('ied') && w.length > 4) out.add(`${w.slice(0, -3)}y`) // carried → carry
  if (w.endsWith('ed') && w.length > 4) {
    out.add(w.slice(0, -1)) // tired → tire
    const base = w.slice(0, -2)
    // stopped → stop : 같은 자음이 겹치면 하나를 지운다(`ss`·`ll`·`ff` 는 원래 겹치므로 뺀다)
    if (base.length > 2 && base.at(-1) === base.at(-2) && !'slfz'.includes(base.at(-1) as string)) {
      out.add(base.slice(0, -1))
    }
  }
  if (w.endsWith('ing') && w.length > 5) {
    const base = w.slice(0, -3)
    out.add(`${base}e`) // making → make
    if (base.length > 2 && base.at(-1) === base.at(-2) && !'slfz'.includes(base.at(-1) as string)) {
      out.add(base.slice(0, -1)) // running → run
    }
  }
  return [...out]
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

export interface CurriculumOptions {
  /**
   * 고유명사를 분모·분자에서 뺀다. **기본값 `false`** — 켜면 값이 달라지므로
   * 지금까지 잰 수치(시중 분포 `CURRICULUM_SPEC` 포함)와 섞이면 안 된다.
   *
   * ── 왜 필요한가 (실측 2026-09-05) ──────────────────────────────────
   * 이 파일 머리말이 이미 경고해 뒀다: **"원문 목록에 고유명사·숫자·파생형이 없다."**
   * 그래서 이름은 무조건 "교육과정 밖" 으로 센다. 이야기·설명문에는 이름이 드물어
   * 문제가 안 됐는데, **백과 도입부는 이름 덩어리**라 사정이 다르다:
   *
   *   Simple Wikipedia 도입부 n=54 · 초등 자
   *   고유명사 제거 전 통과 **2** → 제거 후 통과 **20** (33.3% 뒤집힘)
   *   교육과정 밖 비율 평균 낙폭 **10.3%p**
   *
   * `M*A*S*H` 나 `Maple Meadows` 를 몰라도 그 문장은 읽힌다. 이름을 어려운 낱말로
   * 세면 **소스의 성질을 난이도로 오인**하게 된다.
   *
   * ⚠️ 시중 분포(`CURRICULUM_SPEC`)는 이 옵션 **없이** 쟀다. 켠 값을 그 분포와
   *   견주면 우리 쪽만 유리해진다 — 견주려면 분포도 같은 옵션으로 다시 재야 한다.
   */
  excludeProperNouns?: boolean
}

/**
 * 문장 첫 자리가 **아닌데** 대문자로 시작하는 토큰을 지운다 — 고유명사 대용.
 *
 * 품사 분석기가 없으므로 근사다. 문장 첫 고유명사는 못 잡고(그 자리는 대문자가
 * 당연하므로 구별이 안 된다), 강조 대문자는 잘못 잡는다. **덜 잡는 쪽으로 틀린다** —
 * 그래서 이 옵션을 켜도 `outsidePct` 는 여전히 상한이다.
 */
export function stripProperNouns(text: string): string {
  return String(text ?? '')
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => {
      const toks = sentence.split(/\s+/)
      return toks.filter((t, i) => i === 0 || !/^[A-Z][A-Za-z'-]*[.,;:)"']?$/.test(t)).join(' ')
    })
    .join(' ')
}

/**
 * 지문의 내용어가 교육과정 별표 안에 얼마나 드는가.
 *
 * 판정에 쓰는 것은 대개 `outsidePct` 다 — "몇 %가 그 학년이 안 배운 낱말인가".
 * NASA 사진 설명글은 이 값이 **64%** 였다.
 */
export function curriculumCoverage(
  text: string,
  { excludeProperNouns = false }: CurriculumOptions = {},
): CurriculumCoverage | null {
  const { star1, star2, plain } = curriculumLists()
  const src = excludeProperNouns ? stripProperNouns(String(text ?? '')) : String(text ?? '')
  const all = (src.match(/[A-Za-z][A-Za-z'-]*/g) ?? []).map((w) => w.toLowerCase())
  const content = all.filter((w) => !FUNCTION_WORDS.has(w) && w.length > 1)
  if (!content.length) return null

  let s1 = 0
  let s2 = 0
  let inAny = 0
  for (const w of content) {
    const cands = stemCandidates(w)
    const in1 = cands.some((c) => star1.has(c))
    const in2 = in1 || cands.some((c) => star2.has(c))
    const in0 = in2 || cands.some((c) => plain.has(c))
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
 * **시중 교재 지문의 어휘 분포 — 실측(2026-09-04).**
 *
 * 이전 판은 문턱이 `maxOutsidePct: 40` 하나였고, 그 값은 **재서 정한 것이 아니라
 * 정한 것**이었다(이 파일이 스스로 그렇게 적어 두었다). 이제 쟀다:
 *
 *   도구  `scripts/textbook-corpus/passage-mine.mjs`
 *   표본  시중 초·중 독해 교재(NE능률 8시리즈) 지문 실린 쪽 **196**
 *   검증  같은 쪽을 표식 기반 정확 추출과 맞대어 **차이 중앙 1.2%p · ±7%p 안 90%**
 *
 * 그리고 **문턱 40 은 시중 분포의 정확히 p75 였다** — 실제 시중 지문의 4편 중 1편을
 * 우리 게이트가 떨어뜨리고 있었다는 뜻이다. "시중 교재에 부합" 이 목표인데
 * 시중보다 좁은 자를 대고 있었다.
 *
 * ⚠️ 순수 초등 밴드(초3~초6)만 세면 **14쪽**뿐이다. 그래서 초등 자는 걸침 밴드
 *   (초6~중1 · 초6~중3, 리딩튜터 주니어)를 포함한 129쪽으로 만들었다. 출판사를 넓히면
 *   이 값은 움직인다 — `passage-mine.mjs` 를 다시 돌리면 그대로 다시 잰다.
 * ⚠️ 이 분포는 **어휘 축만** 이다. 어수·FK 는 `market-spec.json` 과 `readability.ts` 소관이다.
 */
export const CURRICULUM_SPEC = {
  // ⚠️ **2026-09-05 재측정** — 자가 바뀌면 분포도 다시 재야 한다.
  //   `stemCandidates` 로 굴절형(`carried`·`took`·`stopped`·`tired`)을 되돌리게 하자
  //   같은 시중 지문의 밖% 가 전반적으로 내려갔다(초등 중앙 30.3 → **27.0**).
  //   자만 고치고 옛 문턱(43.3%)을 그대로 두면 **기준이 조용히 헐거워진다** —
  //   그 값은 옛 자로 잰 p90 이지 새 자의 p90 이 아니다.
  measuredAt: '2026-09-05',
  tool: 'scripts/textbook-corpus/passage-mine.mjs',
  /** 교육과정 3,000 **밖** 비율의 시중 분포. 백분위 → % 값. */
  outside: {
    elementary: { sample: 129, p05: 8.9, p25: 20.0, p50: 27.0, p75: 33.3, p90: 38.6, p95: 40.7 },
    middle: { sample: 78, p05: 12.9, p25: 23.5, p50: 28.6, p75: 35.4, p90: 41.6, p95: 44.0 },
  },
} as const

export type SchoolLevel = 'elementary' | 'middle'

/**
 * 어휘 가드의 문턱 = **시중 분포의 p90**.
 *
 * p95 로 두면 시중 지문 95%가 통과하지만, 우리 재고가 분포의 오른쪽 끝(가장 어려운 쪽)에
 * 몰려도 전부 통과한다 — 통과율이 같아도 **분포가 다르면 부합이 아니다.** 그래서 문턱은
 * p90 으로 두고, 분포가 겹치는지는 `marketPercentile` 로 따로 본다(§`curriculumFit`).
 */
export const CURRICULUM_GATE = {
  elementary: { maxOutsidePct: CURRICULUM_SPEC.outside.elementary.p90 },
  middle: { maxOutsidePct: CURRICULUM_SPEC.outside.middle.p90 },
} as const

const PCTS = [5, 25, 50, 75, 90, 95] as const

/**
 * 이 지문의 어휘가 시중 분포의 어디쯤인가 — 0(가장 쉬움) ~ 100(가장 어려움).
 *
 * **통과/탈락보다 이 값이 중요하다.** 소스 하나의 백분위 중앙이 50 근처면 그 소스는
 * 시중 지문과 같은 결이고, 20 이면 시중보다 쉬운 글만 모은 것이다(StoryWeaver L1 이
 * 실제로 그랬다 — FK 1.42 로 초4 교재 1.81 보다도 아래였다).
 */
export function marketPercentile(outsidePct: number, school: SchoolLevel): number {
  const d = CURRICULUM_SPEC.outside[school]
  const xs: number[] = PCTS.map((p) => d[`p${String(p).padStart(2, '0')}` as keyof typeof d] as number)
  const first = xs[0] ?? 0
  const last = xs[xs.length - 1] ?? 100
  if (outsidePct <= first) return +((outsidePct / first) * PCTS[0]).toFixed(1)
  for (let i = 1; i < xs.length; i++) {
    const hi = xs[i] ?? last
    const lo = xs[i - 1] ?? first
    if (outsidePct <= hi) {
      const span = hi - lo
      const t = span === 0 ? 0 : (outsidePct - lo) / span
      const pLo = PCTS[i - 1] ?? 0
      const pHi = PCTS[i] ?? 100
      return +(pLo + t * (pHi - pLo)).toFixed(1)
    }
  }
  // p95 밖 — 시중 최대(초등 62.9 · 중등 63.5)까지를 95~100 으로 편다.
  const tail = Math.min(1, (outsidePct - last) / 15)
  return +(95 + tail * 5).toFixed(1)
}

export interface CurriculumFit {
  pass: boolean
  coverage: CurriculumCoverage | null
  /** 시중 분포에서의 자리(0~100). 50 이 시중 중앙. 못 재면 null. */
  marketPercentile: number | null
  reason: string | null
}

/**
 * 그 학교급 지문으로 쓸 만한 어휘인가 + 시중 분포의 어디인가.
 *
 * 못 재면 **통과시키지 않는다** — 모름을 허용으로 바꾸면 잴 수 없는 글이 그대로 실린다.
 */
export function curriculumFit(
  text: string,
  school: SchoolLevel = 'middle',
  opts: CurriculumOptions = {},
): CurriculumFit {
  const c = curriculumCoverage(text, opts)
  if (!c) return { pass: false, coverage: null, marketPercentile: null, reason: '내용어가 없어 잴 수 없다' }
  const p = marketPercentile(c.outsidePct, school)
  const max = CURRICULUM_GATE[school].maxOutsidePct
  if (c.outsidePct > max) {
    return {
      pass: false,
      coverage: c,
      marketPercentile: p,
      reason: `내용어의 ${c.outsidePct}% 가 교육과정 3,000 밖이다(시중 ${school === 'elementary' ? '초등' : '중등'} p90 = ${max}%)`,
    }
  }
  return { pass: true, coverage: c, marketPercentile: p, reason: null }
}

/**
 * **우리가 쓰는 글(재저작·각색)의 어휘 대역** — 수확한 글에는 걸지 않는다.
 *
 * ── 왜 하한이 필요한가 (실측 2026-09-04) ─────────────────────────────
 * 3축 게이트를 통과한 초·중 재고 470편 중 **367편(78%)이 우리가 쓴 글**이었고,
 * 그 글들의 시중 자리 중앙이 **16.9** 였다(시중 중앙 50). 게이트는 상한만 보므로
 * 전부 통과한다 — 그런데 분포가 시중과 겹치지 않는다.
 *
 * 이유는 두 가지고 **둘 다 문제다**:
 *   · 부합 — "시중 교재 같은 글" 이 목표인데 시중에 없는 쉬운 결이다
 *   · **학습 가치** — 밖 낱말이 15% 인 글은 30% 인 글보다 새 낱말을 그만큼 덜 가르친다.
 *     쉽게 쓰는 것은 배려가 아니라 **가르칠 것을 뺀 것**이다
 *
 * 수확한 글에는 안 건다 — 있는 글을 고르는 일과 쓰는 일은 다르다. 쓸 때는 어휘를
 * 우리가 고르므로 시중 대역을 겨냥하지 않을 이유가 없다.
 *
 * 대역은 시중 분포의 **p25~p90** 이다. 상한은 게이트와 같고(그 위는 그 학년이 못 읽는다),
 * 하한 p25 는 "시중 지문 4편 중 3편보다 쉽게 쓰지 않는다" 는 뜻이다.
 */
export const AUTHORED_VOCAB_BAND = {
  elementary: {
    minOutsidePct: CURRICULUM_SPEC.outside.elementary.p25,
    maxOutsidePct: CURRICULUM_SPEC.outside.elementary.p90,
  },
  middle: {
    minOutsidePct: CURRICULUM_SPEC.outside.middle.p25,
    maxOutsidePct: CURRICULUM_SPEC.outside.middle.p90,
  },
} as const

/**
 * 우리가 쓴 글이 그 학교급의 어휘 대역 안인가.
 *
 * **이유를 숫자로 돌려준다** — "어렵다/쉽다" 로는 다시 쓸 수 없다. 수능 작문 드레인에서
 * 배운 것과 같다(낱말 길이 대역을 숫자로 주자 한 바퀴에 붙었다).
 */
export function authoredVocabFit(
  text: string,
  school: SchoolLevel
): { pass: boolean; coverage: CurriculumCoverage | null; marketPercentile: number | null; reason: string | null } {
  const c = curriculumCoverage(text)
  if (!c) return { pass: false, coverage: null, marketPercentile: null, reason: '내용어가 없어 잴 수 없다' }
  const p = marketPercentile(c.outsidePct, school)
  const band = AUTHORED_VOCAB_BAND[school]
  const label = school === 'elementary' ? '초등' : '중등'
  if (c.outsidePct < band.minOutsidePct) {
    return {
      pass: false,
      coverage: c,
      marketPercentile: p,
      reason:
        `교육과정 밖 낱말이 ${c.outsidePct}% 로 시중 ${label} 지문보다 쉽다` +
        `(대역 ${band.minOutsidePct}~${band.maxOutsidePct}% · 시중 자리 ${p}). 새 낱말을 더 넣어 다시 쓴다`,
    }
  }
  if (c.outsidePct > band.maxOutsidePct) {
    return {
      pass: false,
      coverage: c,
      marketPercentile: p,
      reason:
        `교육과정 밖 낱말이 ${c.outsidePct}% 로 그 학년이 못 읽는다` +
        `(대역 ${band.minOutsidePct}~${band.maxOutsidePct}%). 어려운 낱말을 별표 안 낱말로 바꾼다`,
    }
  }
  return { pass: true, coverage: c, marketPercentile: p, reason: null }
}

/** 예전 이름 — 부르는 쪽(`space-place-ingest.mjs`)을 깨지 않는다. */
export function passesCurriculumGate(
  text: string,
  school: SchoolLevel = 'middle'
): { pass: boolean; coverage: CurriculumCoverage | null; reason: string | null } {
  const f = curriculumFit(text, school)
  return { pass: f.pass, coverage: f.coverage, reason: f.reason }
}
