// apps/web/src/lib/csat/theater.ts
//
// **해설 극장의 대본 없는 골격 — 큐의 «순서»를 왼쪽 단계로, 분석을 오른쪽 블록으로.**
//
// 이 파일은 순수하다. DB·파일·React 를 모른다. 그래서 회귀가 통째로 검사할 수 있다.
//
// ── 왜 강의 큐가 「사고 과정」인가 ──────────────────────────────────────
// 792문항의 강의는 이미 **12~14개 큐**로 쓰여 있고, 큐마다 역할(`role`)과 가리킬 곳
// (`target`)이 붙어 있다. 그 차례가 곧 「이 문항을 읽는 순서」다 —
//   열기 → 준비 → 뼈대 → 근거 → 배제(오답마다) → 함정 → 어휘 → 정리.
// 새 순서를 발명할 이유가 없다. 여기서 하는 일은 그 차례에 **사람이 읽을 이름**을 붙이는 것뿐이다.
//
// ⚠️ 이름은 **역할과 타깃에서만** 짓는다. 대본 글자(`segments`)는 이 파일에 들어오지 않는다 —
//    들어오면 서버 렌더 HTML 에 대본이 실려 `lecture/types.ts` 의 경계가 무너진다.

import type { LectureRole, LectureStep } from './lecture/types'

export const CIRCLED = ['', '①', '②', '③', '④', '⑤'] as const

/** 큐 경계에서 한 번 나는 소리. 뜻이 다르면 소리도 다르다 — 같은 소리로 때우지 않는다. */
export type TheaterSfx = 'step' | 'mark' | 'trap' | 'seal'

export interface TheaterStep {
  /** 큐 id — 재생 엔진의 큐와 1:1 */
  id: string
  index: number
  /** 모노 눈썹 · 지금 무엇을 하는 중인가 */
  kind: string
  /** 한 줄 이름 · 무엇을 가리키는가 */
  name: string
  /** `analysis:map` · `anchor:sentence:5` — `data-lecture-target` 과 같은 키 */
  targetKey: string
  /** 1.0 배속 추정 초 */
  sec: number
  sfx: TheaterSfx
}

/** 역할 → 모노 눈썹. 학습자가 「지금 어느 단계인가」를 한 낱말로 안다. */
const ROLE_KIND: Record<LectureRole, string> = {
  intro: '열기',
  strategy: '준비',
  structure: '뼈대',
  evidence: '근거',
  eliminate: '배제',
  trap: '함정',
  vocab: '어휘',
  wrapup: '정리',
}

/** 역할 → 큐 경계에서 낼 소리. 근거는 «긋고», 함정·배제는 «짚고», 정리는 «찍는다». */
const ROLE_SFX: Record<LectureRole, TheaterSfx> = {
  intro: 'step',
  strategy: 'step',
  structure: 'step',
  evidence: 'mark',
  eliminate: 'trap',
  trap: 'trap',
  vocab: 'step',
  wrapup: 'seal',
}

const ANALYSIS_NAME: Record<string, string> = {
  head: '문항 열기',
  ability: '이 문항이 재는 것',
  intent: '출제 의도',
  map: '지문의 뼈대',
  answer: '답이 왜 이것인가',
  procedure: '다시 풀 때의 절차',
  vocab: '걸림돌 어휘',
}

export function targetKeyOf(target: { kind: string; id: string }): string {
  return `${target.kind}:${target.id}`
}

/** 큐 하나가 가리키는 곳의 이름. 모르는 타깃은 **지어내지 않고** 키를 그대로 보여 준다. */
export function stepName(target: { kind: string; id: string }): string {
  if (target.kind === 'anchor') {
    const m = /^sentence:(\d+)$/.exec(target.id)
    return m ? `${Number(m[1]) + 1}번째 문장` : target.id
  }
  const reject = /^reject:(\d)$/.exec(target.id)
  if (reject) return `오답 ${CIRCLED[Number(reject[1])] ?? reject[1]} 지우기`
  return ANALYSIS_NAME[target.id] ?? target.id
}

/** 강의 순서 → 왼쪽 레일의 단계 목록. 큐가 없으면 빈 배열(화면이 「상영 없음」으로 간다). */
export function theaterSteps(outline: LectureStep[]): TheaterStep[] {
  return outline.map((cue, index) => ({
    id: cue.id,
    index,
    kind: ROLE_KIND[cue.role] ?? cue.role,
    name: stepName(cue.target),
    targetKey: targetKeyOf(cue.target),
    sec: cue.est_sec,
    sfx: ROLE_SFX[cue.role] ?? 'step',
  }))
}

/** 상영 전체 길이 — 「약 n분」 한 줄에 쓴다 */
export function theaterMinutes(outline: LectureStep[]): number {
  return Math.max(1, Math.round(outline.reduce((sum, c) => sum + c.est_sec, 0) / 60))
}

// ── 오른쪽 부가 정보 블록 ──────────────────────────────────────────────

export type TheaterBlockKind = 'head' | 'ability' | 'intent' | 'answer' | 'reject' | 'procedure' | 'vocab'

export interface TheaterBlock {
  /** `data-lecture-target` 값 — 재생이 이 블록을 켤 때 쓰는 키 */
  key: string
  kind: TheaterBlockKind
  title: string
  chips: { text: string; tone?: 'ok' | 'warn' | 'quiet' }[]
  /** 문단들. 빈 문자열은 담지 않는다 */
  body: string[]
  /** 근거 인용(짧은 발췌) — 없으면 null */
  quote: string | null
}

/** 블록을 만들 때 필요한 것만 — 로더의 전체 모양에 묶이지 않게 좁혀 받는다 */
export interface TheaterSource {
  exam_label: string
  no: number
  type_name: string | null
  points: number | null
  time_budget_sec: number | null
  answer: number | null
  answer_unknown: boolean
  measured_ability: string | null
  design_intent: string | null
  why_correct: string | null
  evidence_quote: string | null
  evidence_reasoning: string | null
  distractors: { n: number; trap: string | null; why_tempting: string | null; how_to_reject: string | null }[]
  procedure: { step: string; on_fail?: string }[]
  required_vocab: string[]
}

const text = (s: string | null | undefined): string[] => (s && s.trim() ? [s.trim()] : [])

/**
 * 분석 자료 → 오른쪽에 차례로 쌓일 블록들.
 *
 * **비어 있는 칸은 만들지 않는다.** 근거가 없으면 근거 블록이 없는 것이고, 화면은 그 자리에
 * 「준비 중」을 그리지 않는다 — 없는 것을 있는 것처럼 보이게 하는 순간 학습자가 기다리게 된다.
 */
export function theaterBlocks(item: TheaterSource): TheaterBlock[] {
  const out: TheaterBlock[] = []

  out.push({
    key: 'analysis:head',
    kind: 'head',
    title: `${item.exam_label} ${item.no}번`,
    chips: [
      ...(item.type_name ? [{ text: item.type_name }] : []),
      ...(item.points ? [{ text: `${item.points}점`, tone: 'quiet' as const }] : []),
      ...(item.time_budget_sec ? [{ text: `권장 ${item.time_budget_sec}초`, tone: 'quiet' as const }] : []),
      item.answer != null && !item.answer_unknown
        ? { text: `정답 ${CIRCLED[item.answer] ?? item.answer}`, tone: 'ok' as const }
        : { text: '정답표 없음', tone: 'warn' as const },
    ],
    body:
      item.answer == null || item.answer_unknown
        ? ['이 회차는 평가원 정답표를 구하지 못했어요. 정답을 모르는 채로 근거를 적으면 그건 창작이라, 이 문항은 답을 지목하지 않습니다. 아래 절차는 그대로 쓸 수 있어요.']
        : [],
    quote: null,
  })

  if (item.measured_ability?.trim()) {
    out.push({
      key: 'analysis:ability',
      kind: 'ability',
      title: '이 문항이 재는 것',
      chips: [{ text: '재는 능력' }],
      body: text(item.measured_ability),
      quote: null,
    })
  }

  if (item.design_intent?.trim()) {
    out.push({
      key: 'analysis:intent',
      kind: 'intent',
      title: '출제 의도',
      chips: [{ text: '왜 이렇게 냈나' }],
      body: text(item.design_intent),
      quote: null,
    })
  }

  if (item.why_correct?.trim() || item.evidence_reasoning?.trim()) {
    out.push({
      key: 'analysis:answer',
      kind: 'answer',
      title: '답이 왜 이것인가',
      chips: [
        { text: '정답 근거', tone: 'ok' },
        ...(item.answer != null && !item.answer_unknown ? [{ text: CIRCLED[item.answer] ?? String(item.answer) }] : []),
      ],
      body: [...text(item.why_correct), ...text(item.evidence_reasoning)],
      quote: item.evidence_quote?.trim() || null,
    })
  }

  for (const d of item.distractors) {
    const body = [...text(d.why_tempting), ...text(d.how_to_reject)]
    if (!body.length && !d.trap) continue
    out.push({
      key: `analysis:reject:${d.n}`,
      kind: 'reject',
      title: `${CIRCLED[d.n] ?? d.n}가 왜 아닌가`,
      chips: [{ text: '오답', tone: 'warn' }, ...(d.trap?.trim() ? [{ text: d.trap.trim() }] : [])],
      body,
      quote: null,
    })
  }

  if (item.procedure.length) {
    out.push({
      key: 'analysis:procedure',
      kind: 'procedure',
      title: '다시 풀 때의 절차',
      chips: [{ text: `${item.procedure.length}단계` }],
      body: item.procedure.map((p, i) => `${i + 1}. ${p.step}${p.on_fail ? ` — 막히면 ${p.on_fail}` : ''}`),
      quote: null,
    })
  }

  if (item.required_vocab.length) {
    out.push({
      key: 'analysis:vocab',
      kind: 'vocab',
      title: '걸림돌 어휘',
      chips: [{ text: `${item.required_vocab.length}낱말` }],
      body: [item.required_vocab.join(' · ')],
      quote: null,
    })
  }

  return out
}

/**
 * 큐가 가리키는 타깃 키 → 그때 켜질 블록 키.
 * `anchor:sentence:k` 는 블록이 아니라 **지도**를 가리키므로 `analysis:map` 으로 보낸다 —
 * 그래야 부가 정보 패널이 「지금 설명하는 곳」을 잃지 않는다.
 */
export function blockKeyForTarget(targetKey: string, blockKeys: string[]): string | null {
  if (blockKeys.includes(targetKey)) return targetKey
  if (targetKey.startsWith('anchor:')) return 'analysis:map'
  if (targetKey === 'analysis:map') return 'analysis:map'
  return null
}
