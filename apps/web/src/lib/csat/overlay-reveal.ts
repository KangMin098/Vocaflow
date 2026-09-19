// apps/web/src/lib/csat/overlay-reveal.ts
//
// **해설을 한꺼번에 주지 않고 한 겹씩 여는 순서.**
//
// ── 왜 이 파일이 생겼나 (2026-09-16) ─────────────────────────────────
// `/csat/overlay` 는 문항 번호를 누르면 답·근거·오답 넷·절차를 **동시에** 펼치고 있었다.
// 그 화면에서 학습자가 하는 일은 **읽기**다. 인출이 한 번도 일어나지 않는다 —
// 답을 보고 나서 읽는 근거는 재인(recognition)이지 회상이 아니다(원칙 1 Active Recall,
// Karpicke & Roediger 2008). 문제지를 손에 들고 있는 사람에게 이건 아까운 낭비다.
//
// 그래서 순서를 만든다: **풀고 → 답하고 → 한 겹씩 연다.** 이 파일은 그 «한 겹» 들을
// 분석 한 벌에서 뽑아내는 일만 한다. 화면은 이 배열을 그리기만 한다.
//
// ── 순서를 이렇게 둔 이유 ────────────────────────────────────────────
//   ① 근거 → ② 정답이 왜 맞나 → ③ 오답이 왜 아닌가 → ④ 절차 → ⑤ 어휘
// 오답부터 열면 "내가 왜 틀렸나" 로 시작해 자책이 앞선다(철학 3 Empathetic Feedback).
// 근거를 먼저 세워 두면 오답 넷은 그 근거에 비추어 읽히고, 그때 배제가 절차가 된다.
// `/csat/item/[slug]` 가 같은 순서를 쓴다 — 두 화면이 다른 순서를 가르치면 안 된다.
//
// ⚠️ **원문을 만들지 않는다.** 여기 들어오는 문자열은 전부 우리 저작물(분석)이고,
//    `answer_quote` 만 짧은 인용이다 — `lib/csat/overlay.ts` 가 그은 경계 그대로다.

/** 단계를 만들 재료 — `OverlayItem` 의 부분집합이다(화면 타입에 묶이지 않게 따로 적는다). */
export interface RevealSource {
  answer: number | null
  answer_quote: string | null
  design_intent: string | null
  choice_analysis: {
    n: number
    verdict?: string
    trap?: string
    why_tempting?: string
    how_to_reject?: string
    why_correct?: string
  }[]
  solve_procedure: { step: string; on_fail?: string }[]
  required_vocab: string[]
}

export type RevealKind = 'evidence' | 'correct' | 'reject' | 'procedure' | 'vocab'

/** 문제지 위에서 이 단계가 켜는 것. 나머지는 옅어진다(한 화면에 두드러지는 것은 하나). */
export interface RevealFocus {
  /** 근거 문장 밑줄 */
  quote: boolean
  /** 선지 기호 상자 — 번호 목록 */
  marks: number[]
  /** 어휘 밑줄 */
  vocab: boolean
}

export interface RevealStep {
  kind: RevealKind
  /** 단계 표시줄에 뜨는 짧은 이름 */
  label: string
  /** 카드 본문 — 없을 수 있다(어휘·절차는 아래 목록이 본문이다) */
  body: string | null
  /** 이 단계가 가리키는 선지 번호. 근거·절차·어휘는 null */
  choice: number | null
  /** 함정 이름 — 오답 단계에만 (L5) */
  trap: string | null
  /** 오답 단계의 «왜 끌리나» — 배제 근거와 나란히 둔다 */
  whyTempting: string | null
  /** 절차 단계의 줄들 */
  procedure: { step: string; on_fail?: string }[]
  /** 어휘 단계의 낱말들 */
  vocab: string[]
  focus: RevealFocus
}

const CIRCLED = ['', '①', '②', '③', '④', '⑤']

const clean = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim() : ''
  return s.length ? s : null
}

const noFocus = (): RevealFocus => ({ quote: false, marks: [], vocab: false })

/**
 * 분석 한 벌 → 열어 갈 단계들.
 *
 * **빈 단계를 만들지 않는다.** 근거가 없는 문항(정답표가 없는 회차 등)에서 빈 카드를
 * 한 장 끼우면 학습자는 "다음" 을 눌렀는데 아무것도 안 바뀐 것을 본다 — 그건 고장으로 읽힌다.
 * 재료가 없는 겹은 **아예 없다.**
 */
export function buildRevealSteps(src: RevealSource): RevealStep[] {
  const steps: RevealStep[] = []
  const answer = src.answer != null && src.answer >= 1 && src.answer <= 5 ? src.answer : null

  const byN = new Map<number, RevealSource['choice_analysis'][number]>()
  for (const c of src.choice_analysis ?? []) {
    if (typeof c?.n === 'number' && c.n >= 1 && c.n <= 5) byN.set(c.n, c)
  }

  // ① 근거 — 종이 위의 «여기» 부터. 인용이 없으면 출제 의도라도 세워 준다.
  const quote = clean(src.answer_quote)
  const intent = clean(src.design_intent)
  if (quote || intent) {
    steps.push({
      kind: 'evidence',
      label: '근거',
      body: quote ?? intent,
      choice: null,
      trap: null,
      whyTempting: null,
      procedure: [],
      vocab: [],
      // 인용이 없으면 칠할 것도 없다 — 없는 자리를 자신 있게 칠하지 않는다.
      focus: { ...noFocus(), quote: Boolean(quote) },
    })
  }

  // ② 정답이 왜 맞나
  if (answer) {
    const c = byN.get(answer)
    const why = clean(c?.why_correct) ?? intent
    if (why) {
      steps.push({
        kind: 'correct',
        label: `답 ${CIRCLED[answer] ?? answer}`,
        body: why,
        choice: answer,
        trap: null,
        whyTempting: null,
        procedure: [],
        vocab: [],
        focus: { quote: Boolean(quote), marks: [answer], vocab: false },
      })
    }
  }

  // ③ 오답이 왜 아닌가 — 번호순. 정답은 ②에서 이미 했다.
  for (const n of [1, 2, 3, 4, 5]) {
    if (answer && n === answer) continue
    const c = byN.get(n)
    if (!c) continue
    const body = clean(c.how_to_reject) ?? clean(c.trap)
    if (!body) continue
    steps.push({
      kind: 'reject',
      label: CIRCLED[n] ?? String(n),
      body,
      choice: n,
      trap: clean(c.trap),
      whyTempting: clean(c.why_tempting),
      procedure: [],
      vocab: [],
      focus: { quote: false, marks: [n], vocab: false },
    })
  }

  // ④ 다시 풀 때의 순서 — 종이 위에 가리킬 자리가 없다(절차는 문항 전체에 걸린다).
  const proc = (src.solve_procedure ?? []).filter((s) => clean(s?.step))
  if (proc.length) {
    steps.push({
      kind: 'procedure',
      label: '순서',
      body: null,
      choice: null,
      trap: null,
      whyTempting: null,
      procedure: proc,
      vocab: [],
      focus: noFocus(),
    })
  }

  // ⑤ 이 문항이 요구한 낱말
  const vocab = Array.from(
    new Set((src.required_vocab ?? []).map((w) => (typeof w === 'string' ? w.trim() : '')).filter(Boolean)),
  )
  if (vocab.length) {
    steps.push({
      kind: 'vocab',
      label: '어휘',
      body: null,
      choice: null,
      trap: null,
      whyTempting: null,
      procedure: [],
      vocab,
      focus: { quote: false, marks: [], vocab: true },
    })
  }

  return steps
}

/**
 * **해설 화면의 자료 모양 → 겹의 재료.**
 *
 * `loadCsatItemExplain`(`lib/csat/learner.ts`)과 오버레이 payload 는 같은 분석을 **다른 이름**
 * 으로 들고 있다(한쪽은 `evidence_quote`·`distractors`, 다른 쪽은 `answer_locus`·`choice_analysis`).
 * 겹 만드는 규칙을 두 벌 적으면 한쪽만 고쳐져 «화면마다 순서가 다른» 일이 생긴다 —
 * 그러면 학습자가 배우는 절차가 화면에 따라 달라진다. 그래서 입구에서 한 모양으로 맞춘다.
 *
 * 타입을 구조로만 받는다(`learner.ts` 를 import 하지 않는다) — 이 파일은 브라우저도 읽는다.
 */
export function revealSourceFromExplain(item: {
  answer: number | null
  answer_unknown: boolean
  why_correct: string | null
  evidence_quote: string | null
  evidence_reasoning: string | null
  distractors: { n: number; trap: string | null; why_tempting: string | null; how_to_reject: string | null }[]
  procedure: { step: string; on_fail?: string }[]
  required_vocab: string[]
}): RevealSource {
  // 정답표가 없는 회차는 **답을 모른다**고 말한다 — 모르는 답을 숫자로 내놓으면 그게 거짓이 된다.
  const answer = item.answer_unknown ? null : item.answer
  return {
    answer,
    answer_quote: item.evidence_quote,
    design_intent: item.evidence_reasoning ?? item.why_correct,
    choice_analysis: [
      ...(answer && item.why_correct ? [{ n: answer, why_correct: item.why_correct }] : []),
      ...item.distractors.map((d) => ({
        n: d.n,
        trap: d.trap ?? undefined,
        why_tempting: d.why_tempting ?? undefined,
        how_to_reject: d.how_to_reject ?? undefined,
      })),
    ],
    solve_procedure: item.procedure,
    required_vocab: item.required_vocab,
  }
}

/**
 * 「n번 선지」로 바로 가기 — 선지 기호를 눌렀을 때 그 배제 근거로 뛴다.
 *
 * 없으면 -1. 부르는 쪽이 그때는 **아무 데도 안 간다**(엉뚱한 단계로 보내면 학습자는
 * 자기가 누른 것과 열린 것이 다른 이유를 알 수 없다).
 */
export function stepIndexOfChoice(steps: RevealStep[], n: number): number {
  return steps.findIndex((s) => s.choice === n && (s.kind === 'reject' || s.kind === 'correct'))
}

/** 걸린 시간 → 버킷. 초를 그대로 보내지 않는 이유는 필요하지 않기 때문이다(계측 계약). */
export function secondsBucket(seconds: number): 0 | 1 | 2 | 3 | 4 | 5 {
  if (!Number.isFinite(seconds) || seconds < 0) return 0
  if (seconds < 30) return 0
  if (seconds < 60) return 1
  if (seconds < 90) return 2
  if (seconds < 120) return 3
  if (seconds < 180) return 4
  return 5
}
