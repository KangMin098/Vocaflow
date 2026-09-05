// packages/library-pipeline/src/textbook/standalone.ts
//
// **자립성 — 그 한 편만 읽고 이해되는 글인가.**
//
// ── 왜 네 번째 축이 필요한가 (실측 2026-09-04) ───────────────────────
// 어수창 · FK 밴드 · 교육과정 어휘 세 축을 통과한 PD 발췌 906편을 적재하고
// 표본 6편을 열어 봤더니 **6편 전부가 소설 대화 장면**이었다:
//
//     "Mrs. Grose tried to keep up with me. \"You mean you're afraid of seeing her again?\""
//     "So she disturbed you, and, to see what she was looking at, you also looked—you saw."
//
// 셋 다 통과했는데 **지문이 아니다.** `Mrs. Grose` 도 `Flora` 도 설명 없이 나오고,
// 문장이 앞 상황을 가리킨다. 교재 지문은 그 한 편이 스스로 선다.
//
// ── 문턱은 시중 지문에서 나왔다 ──────────────────────────────────────
// 짐작으로 정하면 멀쩡한 이야기 지문까지 막는다(시중 초·중 교재에도 이야기와 대화가 있다).
// 그래서 시중 지문 196쪽을 같은 자로 쟀다(`scripts/textbook-corpus/passage-mine.mjs`):
//
//     대화 비중   초등 p50 **0** · p75 0.7 · p90 4.5 · p95 8.5
//                 중등 p50 **0** · p75 0.0 · p90 3.6 · p95 7.6
//     문두 지시   초등 3% · 중등 3%
//
// 시중 지문은 **거의 대화가 없고**(중앙 0), 앞을 가리키며 시작하는 것은 3%뿐이다.
// 우리 PD 발췌는 대화 중앙 **17.9%** · 문두 지시 **53%** 였다 — 다른 물건이다.
//
// ⚠️ **이 자는 대화를 나쁘다고 말하지 않는다.** 이야기 지문에 대화가 있는 것은 정상이고
//   시중에도 p95 8.5% 까지 있다. 막는 것은 **대화가 글의 절반을 넘는 장면 조각**이다.
// ⚠️ 문두 규칙은 기계적이라 오탐이 있다 — 시중 지문 3%가 이 규칙에 걸린다. 그 3%는
//   실제로 앞 문단을 받는 글일 수도, 규칙의 한계일 수도 있다. **오탐률을 적어 두고 쓴다.**

/** 시중 초·중 지문 실측(2026-09-04 · 196쪽). 문턱의 근거이자 인용할 값. */
export const STANDALONE_SPEC = {
  measuredAt: '2026-09-04',
  tool: 'scripts/textbook-corpus/passage-mine.mjs',
  market: {
    elementary: { sample: 129, quotedP50: 0, quotedP90: 4.5, quotedP95: 8.5, anaphoricPct: 3 },
    middle: { sample: 67, quotedP50: 0, quotedP90: 3.6, quotedP95: 7.6, anaphoricPct: 3 },
  },
} as const

/**
 * 문턱 = 시중 **p95**.
 *
 * 어휘 자는 p90 을 썼는데(그쪽은 분포가 넓어 p95 면 너무 헐거웠다) 여기는 p95 다 —
 * 시중 분포가 0 에 몰려 있어 p90(4.5)으로 조이면 **대화가 조금 있는 정상 이야기 지문**이
 * 무더기로 막힌다. 두 자의 백분위가 다른 것은 실수가 아니라 분포가 달라서다.
 */
export const STANDALONE_GATE = { maxQuotedPct: 9 } as const

/**
 * 앞 맥락을 요구하는 문두. 대명사·지시어·접속부사, 그리고 따옴표로 시작하는 글.
 *
 * ── 2026-09-05: 표본 12편을 손으로 읽고 두 구멍을 찾았다 ─────────────
 * 게이트를 통과한 발췌 12편 중 **교재 지문으로 쓸 만한 것은 3편**이었다. 나머지 9편이
 * 새어 나온 이유가 둘로 갈렸다:
 *
 *   · `Still, it was not easy to believe.` — `still` 이 목록에 없었다
 *   · `Neither the wind nor his young wife had thought…` — `neither` 도 없었다
 *   · `In the school-house yard another group of boys…` — `another` 도 없었다
 *
 * ⚠️ **`for` 와 `even` 은 일부러 넣지 않는다.** `For many years people have…` ·
 *   `Even the smallest bird can…` 은 자립적인 문장이다. 앞을 가리키는 쓰임과 그렇지 않은
 *   쓰임이 같은 낱말에 섞여 있어, 넣으면 멀쩡한 지문을 막는다.
 * ⚠️ **정관사 미소개 명사(`The servant saluted…`)는 규칙으로 안 갈린다.** `The sun is…`
 *   과 구별할 방법을 못 찾았다 — `lib-clean.mjs` 가 편집자 주석에서 네 번 실패한 것과
 *   같은 종류다. 여기서 잡는 척하지 않는다. 그래서 이 자를 통과해도 **손으로 읽으면
 *   더 걸러진다**(§`docs/reports/kid-source-plan-20260904.md`).
 */
const ANAPHORIC_OPENERS =
  /^(he|she|it|they|him|her|them|his|their|this|that|these|those|but|so|then|however|yet|therefore|thus|meanwhile|besides|still|neither|nor|another|again|instead|afterward|afterwards|nevertheless|moreover)\b/i

/**
 * **⚠️ 시도했고 물러섰다 — 첫 문장 안의 되짚기 표지 (2026-09-05)**
 *
 * 문두 첫 낱말만 보는 규칙의 한계가 분명했다. 표본 12편을 다시 읽으니 쓸 만한 것이
 * 2편이었고, 실패한 열 편의 되짚기가 전부 **문두가 아닌 자리**에 있었다:
 *
 *   `Glen knew that.` · `…past them shot a huge black mass` ·
 *   `…excited by this account` · `The following day while…` ·
 *   `As the reader already knows my position…`
 *
 * 그래서 첫 문장 **전체**에서 되짚기 표지를 찾는 규칙을 넣어 봤다:
 *   `(this|that|these|those) + 명사` · `the (following|next|same|other)` ·
 *   `for the (second|third) time` · `as the reader` · `already (knows|said)`
 *
 * **시중 지문으로 재니 오탐이 3% → 초등 13% · 중등 19% 로 뛰었다.** 시중 초·중 교재
 * 지문도 `this account` · `the following day` 를 정상적으로 쓴다 — 지문 안에서 앞
 * **문장**을 되짚는 것과 앞 **문단**을 요구하는 것은 다른 일인데, 표면형이 같다.
 * 그 둘을 가르는 방법을 못 찾았다.
 *
 * 그래서 **넣지 않는다.** 멀쩡한 시중형 지문 13~19% 를 버리는 대가로 얻는 정확도가 아니다.
 * `lib-clean.mjs` 가 편집자 주석에서 네 번 실패한 것과 같은 종류이고, 여기 적어 두는
 * 이유도 같다 — **다음 사람이 같은 규칙을 다시 짜지 않게.**
 *
 * 남는 결론: 이 자를 통과해도 **손으로 읽으면 더 걸러진다**(표본 12편 중 2~3편).
 * 그 비율은 규칙으로 못 올리므로 **재고 수치와 함께 밝힌다.**
 */

/**
 * **글이 아니라 기록·항목으로 시작하는가.**
 *
 * ── 실측 2026-09-05 (주제를 설명문으로 옮긴 뒤 표본 12편) ────────────
 * 손 판정이 1/12 → **6/12** 로 올랐고, 남은 실패에 같은 꼴이 둘 있었다:
 *
 *   `November 10, 1851.—At 12.30 p. m., thermometer, 54°.`  ← 항해·기상 **일지**
 *   `Treatment. The first consideration is rest, …`          ← 교본의 **항목 표제**
 *
 * 둘 다 문장으로 되어 있어 어수·FK·어휘·대화 어느 축에도 안 걸린다. 그런데 지문이 아니다 —
 * 앞의 표·항목 체계를 알아야 읽힌다.
 *
 * ⚠️ 항목 표제는 `Mr.`·`Dr.`·`St.`·`No.` 같은 약어와 겹친다. 그래서 **약어를 먼저 뺀다.**
 *   그러고도 오탐이 남을 수 있어 시중 지문으로 재고 넣었다(§`STANDALONE_SPEC`).
 */
const ABBREV = /^(?:mr|mrs|ms|dr|st|no|vol|fig|jr|sr|prof|rev|capt|gen|col|lt|sgt)$/i
const LOGBOOK =
  /^[A-Z][a-z]+\s+\d{1,2},\s*\d{4}\s*[.,—–-]|^\d{1,2}[/.]\d{1,2}[/.]\d{2,4}\b|\b\d{1,2}[.:]\d{2}\s*[ap]\.?\s*m\./i

/**
 * **요일로 시작하는 일지** — `Wednesday, 4th. Cloudy and coldish.`
 *
 * 위 `LOGBOOK` 은 달력 날짜(`November 10, 1851.`)만 잡는다. 그런데 항해일지는 해가 바뀌지
 * 않는 한 연도를 적지 않는다 — `Wednesday, 4th.` 처럼 요일과 일자만 쓴다. Audubon 항해일지
 * 발췌가 자립성 자를 그대로 통과했다(실측 2026-09-05, `mixed` 표본 12편 중 1편).
 *
 * ⚠️ 이야기 안의 평범한 문장(`Wednesday was the day of the fair.`)을 치지 않도록
 *   '요일 + 숫자 + 끝맺음' 세 조건을 모두 요구한다. 시중 지문 오탐은 따로 재서 적었다.
 */
const WEEKDAY_ENTRY =
  /^(?:Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day,?\s+\d{1,2}(?:st|nd|rd|th|d)?\s*[.,—–-]/i

function opensAsRecord(text: string): boolean {
  const t = text.trim()
  if (LOGBOOK.test(t.slice(0, 60))) return true
  if (WEEKDAY_ENTRY.test(t.slice(0, 40))) return true
  // `Treatment. The first…` — 한 낱말 + 마침표 + 대문자. 약어는 뺀다.
  const m = t.match(/^([A-Za-z]+)\.\s+[A-Z]/)
  if (m && m[1] && !ABBREV.test(m[1]) && m[1].length >= 4) return true
  return false
}

export interface StandaloneSignals {
  /** 인용부호 안에 든 낱말의 비율 %. */
  quotedPct: number
  /** 첫 문장이 앞을 가리키는가. */
  opensAnaphoric: boolean
  /** 일지·항목 표제로 시작하는가 — 글이 아니라 기록이다. */
  opensAsRecord: boolean
}

export function standaloneSignals(text: string): StandaloneSignals | null {
  const t = String(text ?? '')
  const words = (t.match(/[A-Za-z][A-Za-z'-]*/g) ?? []).length
  if (!words) return null

  // 곧은·굽은 **큰따옴표와 작은따옴표를 함께** 본다.
  // ⚠️ 처음엔 큰따옴표만 셌다. 그런데 구텐베르크의 영국 판본은 대화를 `'…'` 로 적는다 —
  //   실측 2026-09-05: `'God bless you, O king!' said the young man` 같은 대화 장면이
  //   **대화 비중 0%** 로 세어져 그대로 통과했다.
  // ⚠️ 작은따옴표는 아포스트로피(`don't`)와 같은 글자라, 여는 쪽이 **낱말 앞**에 있고
  //   닫는 쪽이 **낱말 뒤**에 있을 때만 대화로 센다. 안 그러면 `it's … don't` 사이가
  //   통째로 대화로 세어진다.
  let quoted = 0
  for (const m of t.matchAll(/["“][^"”]{2,400}["”]/g)) {
    quoted += (m[0].match(/[A-Za-z][A-Za-z'-]*/g) ?? []).length
  }
  for (const m of t.matchAll(/(?:^|[\s(])['‘]([^'’]{2,400})['’](?=[\s,.!?;:)]|$)/g)) {
    quoted += ((m[1] ?? '').match(/[A-Za-z][A-Za-z'-]*/g) ?? []).length
  }

  const first = (t.match(/^[^.!?]{10,400}[.!?]/) ?? [t.slice(0, 200)])[0] ?? ''
  const opensAnaphoric = /^["“'‘]/.test(t.trim()) || ANAPHORIC_OPENERS.test(first.trim())

  return {
    quotedPct: +((quoted / words) * 100).toFixed(1),
    opensAnaphoric,
    opensAsRecord: opensAsRecord(t),
  }
}

export interface StandaloneFit {
  pass: boolean
  signals: StandaloneSignals | null
  reason: string | null
}

/**
 * 교재 지문으로 자립하는가.
 *
 * 못 재면 **통과시키지 않는다** — 모름을 허용으로 바꾸면 잴 수 없는 글이 그대로 실린다.
 */
export function standaloneFit(text: string): StandaloneFit {
  const s = standaloneSignals(text)
  if (!s) return { pass: false, signals: null, reason: '낱말이 없어 잴 수 없다' }
  if (s.quotedPct > STANDALONE_GATE.maxQuotedPct) {
    return {
      pass: false,
      signals: s,
      reason: `대화가 ${s.quotedPct}% 다 — 장면 조각이지 지문이 아니다(시중 p95 ${STANDALONE_SPEC.market.elementary.quotedP95}%)`,
    }
  }
  if (s.opensAnaphoric) {
    return {
      pass: false,
      signals: s,
      reason: '첫 문장이 앞을 가리킨다 — 그 한 편만 읽고는 무엇을 말하는지 알 수 없다',
    }
  }
  if (s.opensAsRecord) {
    return {
      pass: false,
      signals: s,
      reason: '일지·항목 표제로 시작한다 — 글이 아니라 표·항목 체계의 한 칸이다',
    }
  }
  return { pass: true, signals: s, reason: null }
}
