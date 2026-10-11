// apps/web/src/lib/csat/inquiry/scenes.ts
//
// **여섯 학습 장면 — 문항 해설을 「출제 설계 탐구」 순서로 묶는 계층.** (vNext2 M2 첫 수직 구현 · 2026-10-11)
//
// 기존 분석 블록(theaterBlocks) · 이해 확인 · 비교 쌍을 새 데이터 없이 장면에 배정한다. 장면은 자유 이동이고
// 순서(`next`)는 추천일 뿐이다 — 어느 장면도 답 제출 · 확신 · 강의 청취를 조건으로 잠그지 않는다.
// URL `?scene=` 로 공유 · 뒤로가기를 지원한다. 모르는 값은 본질(essence)로 정규화한다.
// 사고 그래프 · 6엔진(LogicGraph 등)은 이 배정 위에 장면별로 덧붙인다 — 여기서는 「무엇을 어느 장면에서 읽나」만 정한다.

import type { TheaterBlockKind } from '../theater'

export const SCENE_IDS = ['essence', 'structure', 'answer', 'distractor', 'principle', 'compare'] as const
export type SceneId = (typeof SCENE_IDS)[number]

export interface SceneDef {
  id: SceneId
  label: string
  /** 장면 머리에 쓰는 질문 — 학습자가 이 장면에서 판단할 것 */
  question: string
}

export const SCENES: readonly SceneDef[] = [
  { id: 'essence', label: '본질', question: '이 문항은 무엇을 판단하도록 구성됐나' },
  { id: 'structure', label: '지문 구조', question: '어떤 관계가 논리 전개를 만들었나' },
  { id: 'answer', label: '발문·정답 설계', question: '어떤 조건을 거쳐 답 표현이 성립하나' },
  { id: 'distractor', label: '오답 설계', question: '무엇을 그럴듯하게 유지하고 무엇을 바꿨나' },
  { id: 'principle', label: '공통 원리', question: '어떤 조건에서 다른 문항에도 통하나' },
  { id: 'compare', label: '기출 비교', question: '같은 원리의 반복과 적용 경계' },
]

export function normalizeScene(raw: string | null | undefined): SceneId {
  return (SCENE_IDS as readonly string[]).includes(raw ?? '') ? (raw as SceneId) : 'essence'
}

/** 추천 다음 장면 — 마지막(비교)은 없다 */
export function nextScene(id: SceneId): SceneId | null {
  const i = SCENE_IDS.indexOf(id)
  return SCENE_IDS[i + 1] ?? null
}

/** 분석 블록 → 장면. 블록 하나는 한 장면에만 있다(같은 문장을 두 판에 복제하지 않는다). */
const BLOCK_SCENE: Record<TheaterBlockKind, SceneId> = {
  head: 'essence',
  ability: 'essence',
  vocab: 'structure',
  intent: 'answer',
  answer: 'answer',
  reject: 'distractor',
  procedure: 'principle',
}

export function sceneOfBlock(kind: TheaterBlockKind): SceneId {
  return BLOCK_SCENE[kind]
}

/** 이해 확인 과제 → 장면: 근거 문장 찾기는 정답 설계, 바뀐 성분 고르기는 오답 설계 */
export function sceneOfCheck(kind: 'evidence' | 'lure'): SceneId {
  return kind === 'evidence' ? 'answer' : 'distractor'
}
