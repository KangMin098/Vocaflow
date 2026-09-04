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

/** 앞 맥락을 요구하는 문두. 대명사·지시어·접속부사, 그리고 따옴표로 시작하는 글. */
const ANAPHORIC_OPENERS =
  /^(he|she|it|they|him|her|them|his|their|this|that|these|those|but|so|then|however|yet|therefore|thus|meanwhile|besides)\b/i

export interface StandaloneSignals {
  /** 인용부호 안에 든 낱말의 비율 %. */
  quotedPct: number
  /** 첫 문장이 앞을 가리키는가. */
  opensAnaphoric: boolean
}

export function standaloneSignals(text: string): StandaloneSignals | null {
  const t = String(text ?? '')
  const words = (t.match(/[A-Za-z][A-Za-z'-]*/g) ?? []).length
  if (!words) return null

  // 곧은 따옴표와 굽은 따옴표를 함께 본다 — 구텐베르크 평문은 둘이 섞여 있다.
  let quoted = 0
  for (const m of t.matchAll(/["“][^"”]{2,400}["”]/g)) {
    quoted += (m[0].match(/[A-Za-z][A-Za-z'-]*/g) ?? []).length
  }

  const first = (t.match(/^[^.!?]{10,400}[.!?]/) ?? [t.slice(0, 200)])[0] ?? ''
  const opensAnaphoric = /^["“]/.test(t.trim()) || ANAPHORIC_OPENERS.test(first.trim())

  return { quotedPct: +((quoted / words) * 100).toFixed(1), opensAnaphoric }
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
  return { pass: true, signals: s, reason: null }
}
