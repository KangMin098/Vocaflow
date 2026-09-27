// apps/web/src/lib/csat/design.ts
//
// **출제 설계 주석(S2 지문 뼈대 · S3 정답 설계) — 학습자 화면이 읽는 모양과 한국어 이름.** (2026-09-25 · Phase 1)
//
// 값은 `csat_item_analyses.answer_locus.passage_design`(드레인 `scripts/csat/design-drain-*`)에서 온다.
// 라벨 목록의 정본은 `docs/csat-learner/design-annotation-criteria.md` — 여기 이름을 바꾸면 그 문서도 고친다.
// 원문 글자는 없다 — 문장 번호 · 닫힌 라벨 · 우리가 쓴 한국어 설명뿐이다(저작권 경계).

export type Role = 'topic' | 'support' | 'example' | 'turn' | 'concession' | 'conclusion' | 'background' | 'speech_act' | 'closing'
export type Pattern =
  | 'myth_rebuttal'
  | 'general_specific'
  | 'problem_solution'
  | 'contrast'
  | 'cause_effect'
  | 'study_implication'
  | 'request_letter'
  | 'narrative'
  | 'other'
export type Transform = 'abstraction' | 'paraphrase' | 'negation_flip' | 'perspective' | 'speech_act_verb' | 'compression' | 'inference' | 'none'
export type Cue = 'pronoun' | 'connective' | 'article' | 'time' | 'logic' | 'repetition'

export interface PassageDesign {
  roles: Role[]
  alternatives: { index: number; role: Role }[]
  pattern: Pattern
  selection: string
  transform: Transform
  transform_note: string
  cues: Cue[]
}

export const PATTERN_LABEL: Record<Pattern, string> = {
  myth_rebuttal: '통념-반박',
  general_specific: '일반-구체',
  problem_solution: '문제-해결',
  contrast: '대조',
  cause_effect: '인과',
  study_implication: '연구 소개-함의',
  request_letter: '화행 글(요청·통보·안내)',
  narrative: '서사(시간 순)',
  other: '기타',
}

export const TRANSFORM_LABEL: Record<Transform, string> = {
  abstraction: '추상화',
  paraphrase: '동의 재진술',
  negation_flip: '부정의 긍정화',
  perspective: '관점 전환',
  speech_act_verb: '화행 동사화',
  compression: '압축',
  inference: '추론 복원',
  none: '해당 없음',
}

export const CUE_LABEL: Record<Cue, string> = {
  pronoun: '지시어·대명사',
  connective: '연결어',
  article: '관사(a → the)',
  time: '시간·순서 표지',
  logic: '논리 전개',
  repetition: '어휘 반복',
}

/** 로더가 jsonb 에서 꺼낸 값 → 화면 모양. 모양이 어긋나면 null(주석 없는 문항처럼 동작한다). */
export function parseDesign(raw: unknown): PassageDesign | null {
  if (!raw || typeof raw !== 'object') return null
  const d = raw as Record<string, unknown>
  if (!Array.isArray(d.roles) || typeof d.pattern !== 'string' || typeof d.transform !== 'string') return null
  return {
    roles: d.roles as Role[],
    alternatives: Array.isArray(d.alternatives) ? (d.alternatives as PassageDesign['alternatives']) : [],
    pattern: d.pattern as Pattern,
    selection: typeof d.selection === 'string' ? d.selection : '',
    transform: d.transform as Transform,
    transform_note: typeof d.transform_note === 'string' ? d.transform_note : '',
    cues: Array.isArray(d.cues) ? (d.cues as Cue[]) : [],
  }
}

/** 주제문으로 인정하는 문장들 — `topic` 역할 + 허용 대안 `topic`. 주제문이 없는 글(화행 글)은 화행 문장. */
export function topicSentences(d: PassageDesign): number[] {
  const main = d.roles.includes('topic') ? 'topic' : 'speech_act'
  const set = new Set<number>()
  d.roles.forEach((r, i) => r === main && set.add(i))
  for (const a of d.alternatives) if (a.role === main) set.add(a.index)
  return [...set].sort((a, b) => a - b)
}

/** 주제문 칸의 질문 — 화행 글은 「글쓴이가 하려는 일」을 묻는다 */
export const topicQuestion = (d: PassageDesign) => (d.roles.includes('topic') ? '주제문은 몇 번째 문장일까요?' : '글쓴이가 하려는 일(요청·통보)이 담긴 문장은?')
