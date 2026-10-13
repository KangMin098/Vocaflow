// apps/web/src/lib/csat/item-tab-memory.ts
//
// **문항별 탭 메모리 — 문항을 옮겼다 돌아와도 남는다.** (작업공간 W2/W3 + 기출 찾기 FND3)
//
// 해설 극장(`AnalysisTheater`)은 문항 주소(`/csat/item/[slug]`)가 바뀌면 다시 마운트된다. 그래서 장면별 근거 선택 ·
// 판 스크롤 · 자기 설명/원리 노트/원문 이해 초안을 컴포넌트 상태에만 두면 「기출 찾기로 다른 문항 → 찾기 전 문항으로」
// 왕복에서 모두 사라진다(e2e 실측 2026-10-13). 이 모듈 변수에 문항 키로 둔다:
//   · 클라이언트 라우트 전환에는 살아 있고, 새로 고침 · 탭 종료에는 사라진다(보장하지 않는다고 화면이 안내).
//   · sessionStorage · 이벤트 · API · 주소로 보내지 않는다(노트 원문이 기기 밖으로 나가지 않게).

import type { ExplainDraft, NoteDraft } from './explain-draft'

export interface SceneMemory {
  evidence: { sentences: number[]; key: string } | null
  scroll: number
}

export const tabMemory = {
  /** `${itemId}|${scene}` → 그 장면의 근거 선택 · 판 스크롤 */
  scene: new Map<string, SceneMemory>(),
  /** 문항 id → 자기 설명 초안 */
  explain: {} as Record<string, ExplainDraft>,
  /** 문항 id → 원리 노트 초안 */
  note: {} as Record<string, NoteDraft>,
  /** 문항 id → (의미 단위 id → 원문 이해 초안) */
  meaning: {} as Record<string, Record<string, string>>,
}

export const sceneKey = (itemId: string, scene: string) => `${itemId}|${scene}`
