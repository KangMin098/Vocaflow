// apps/web/src/lib/knowledge/contextual-sense-annotations.ts
// V2 문맥 의미 선택 주석 목록(LM-G1.5a). 두 판정자 합의(review.status = 'accepted')인 주석만 과제로 노출한다.
//
// 2026-10-17 현재 **합의 주석 0개** — 그래서 이 과제는 어느 문항에도 나오지 않는다(지도 V2 직접 확인 = content_needed 그대로).
// 주석을 더하는 절차: annotations/contextual-sense-<item>.v1.json 작성 → 맹검 독립 검수 · 합의 → 여기 import 한 줄
//   → 관리자 출시(knowledge_applications 활성 · 사람 승인). 등록만으로는 학습자에게 열리지 않는다.
import { indexContextualSenseAnnotations, type ContextualSenseAnnotation } from './contextual-sense'

const SOURCES: readonly unknown[] = []

const ANNOTATIONS: Record<string, ContextualSenseAnnotation> = indexContextualSenseAnnotations(SOURCES)

export function contextualSenseAnnotationFor(itemId: string): ContextualSenseAnnotation | null {
  return ANNOTATIONS[itemId] ?? null
}

/** 노출 가능한 주석 수(감사 · 문서용) */
export function contextualSenseAnnotationCount(): number {
  return Object.keys(ANNOTATIONS).length
}
