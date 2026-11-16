// apps/web/src/lib/csat/inquiry/scenes.ts
//
// **일곱 학습 장면 — 문항 해설을 「출제 설계 탐구」 순서로 묶는 계층.** (v3 · docs/csat-learner/v3/CSAT_LEARNING_PROCESS_V3.md)
//
// 평가 과제 → 원문 의미·구조 → 문항 성립(정답 + 모든 비선정 선지) → 설계 재구성(가설) → 기출 비교 → 조건부 원리 → 학습 정리(옛 「내 설명」).
// 장면은 자유 이동이고 순서(`next`)는 추천일 뿐이다 — 어느 장면도 답 제출 · 확신 · 강의 청취 · 이전 장면 방문을 조건으로 잠그지 않는다.
// URL `?scene=` 로 공유 · 뒤로가기를 지원한다. vNext2 의 여섯 장면 값(essence · structure · answer · distractor)은 별칭으로 받는다.
// 이 일곱 장면은 개인 능력 경로(map/learner-path) · 확인 과제 절차(map/curriculum PROTOCOL)의 번호와 다른 층이다 — 섞지 않는다.

import type { TheaterBlockKind } from '../theater'

export const SCENE_IDS = ['task', 'meaning', 'judgment', 'design', 'compare', 'principle', 'explain'] as const
export type SceneId = (typeof SCENE_IDS)[number]

/** 문항 성립 장면의 처음 보기 — 옛 `answer` · `distractor` 링크의 뜻을 구별한다(선지 번호를 지어내지 않는다) */
export type JudgmentView = 'answer' | 'options'

export interface SceneDef {
  id: SceneId
  label: string
  /** 장면 머리에 쓰는 질문 — 학습자가 이 장면에서 판단할 것 */
  question: string
}

export const SCENES: readonly SceneDef[] = [
  { id: 'task', label: '평가 과제', question: '무엇을 이해하고 어디까지 판단해야 하는가' },
  { id: 'meaning', label: '원문 이해', question: '문장과 글이 실제로 무엇을 말하며 그 관계는 어떻게 성립하는가' },
  { id: 'judgment', label: '문항 성립', question: '어떤 조건 때문에 한 선택지가 정답이고 다른 선택지는 요구를 충족하지 못하는가' },
  { id: 'design', label: '설계 재구성', question: '관찰된 의미 관계를 어떤 판단 과제로 이용했다고 해석할 수 있는가' },
  { id: 'compare', label: '기출 비교', question: '다른 기출에도 같은 관계가 있으며 무엇이 같고 무엇이 다른가' },
  { id: 'principle', label: '조건부 원리', question: '어떤 조건에서 같은 판단을 적용하고 어느 경우 적용하지 못하는가' },
  // id 는 옛 주소(scene=explain) 호환으로 그대로 — 내용은 시스템이 준비한 학습 정리다(T-0091 · 서술 입력 없음)
  { id: 'explain', label: '학습 정리', question: '준비된 관계 · 근거 · 원리 · 조건을 한곳에서 확인하고 다음 활동으로 이어 간다' },
]

/** vNext2 장면 값 → v3 (UX v3 §2) */
const ALIAS: Record<string, { scene: SceneId; judgmentView?: JudgmentView }> = {
  essence: { scene: 'task' },
  structure: { scene: 'meaning' },
  answer: { scene: 'judgment', judgmentView: 'answer' },
  distractor: { scene: 'judgment', judgmentView: 'options' },
}

export interface ParsedScene {
  scene: SceneId
  judgmentView: JudgmentView
  /** 주소의 값이 정규형과 다르다 — 화면은 replace 로 고친다(무효값을 에러로 만들지 않는다) */
  normalized: boolean
}

/** `?scene=` · `?judgmentView=` 파서 — 서버 첫 렌더와 popstate 가 같은 함수를 쓴다 */
export function parseScene(raw: string | null | undefined, rawView?: string | null): ParsedScene {
  const value = raw ?? ''
  const view: JudgmentView = rawView === 'options' ? 'options' : 'answer'
  if ((SCENE_IDS as readonly string[]).includes(value)) return { scene: value as SceneId, judgmentView: view, normalized: false }
  const alias = ALIAS[value]
  if (alias) return { scene: alias.scene, judgmentView: alias.judgmentView ?? view, normalized: true }
  return { scene: 'task', judgmentView: view, normalized: value !== '' }
}

export function normalizeScene(raw: string | null | undefined): SceneId {
  return parseScene(raw).scene
}

/** 추천 다음 장면 — 마지막(학습 정리)은 없다 */
export function nextScene(id: SceneId): SceneId | null {
  const i = SCENE_IDS.indexOf(id)
  return SCENE_IDS[i + 1] ?? null
}

/** 분석 블록 → 장면. 블록 하나는 한 장면에만 있다(같은 문장을 두 판에 복제하지 않는다). */
const BLOCK_SCENE: Record<TheaterBlockKind, SceneId> = {
  head: 'task',
  ability: 'task',
  vocab: 'meaning',
  answer: 'judgment',
  reject: 'judgment',
  intent: 'design',
  procedure: 'principle',
}

export function sceneOfBlock(kind: TheaterBlockKind): SceneId {
  return BLOCK_SCENE[kind]
}

/** 이해 확인 과제 → 장면: 근거 문장 찾기 · 바뀐 성분 고르기 모두 문항 성립 판단이다 */
const CHECK_SCENE: Record<'evidence' | 'lure', SceneId> = { evidence: 'judgment', lure: 'judgment' }

export function sceneOfCheck(kind: 'evidence' | 'lure'): SceneId {
  return CHECK_SCENE[kind]
}
