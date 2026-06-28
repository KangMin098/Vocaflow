// apps/web/src/lib/articles/use-source-policy.ts
// ACP §18 P1 — SourcePolicy 단일 진입 훅.
//
// 큐레이션 화면의 모든 분기(supply/media/derivation/attribution)는 이 훅이 반환하는
// policy 만 읽는다. source 문자열로 직접 분기(if (source === 'voa'))하면 설계 위반.
//
// 정책 정의·파생은 C2 공유 자산(@vocaflow/library-pipeline/curation-spec)에 있다.
// client-safe 서브패스만 import — 배럴(@vocaflow/library-pipeline)은 node 코드(normalize)
// 를 끌어와 클라이언트 번들을 깨뜨림 (BulkArticlesTab 과 동일 패턴).

'use client'

import { useMemo } from 'react'

import {
  resolveSourcePolicy,
  SUPPLY_LABEL,
  MEDIA_LABEL,
  DERIVATION_LABEL,
  ATTRIBUTION_LABEL,
  type SourcePolicy,
} from '@vocaflow/library-pipeline/curation-spec'

/**
 * source 문자열 → SourcePolicy. 활성 소스가 아니면 보수적 기본값(C2 resolveSourcePolicy).
 * 메모이즈 — source 가 같으면 동일 객체 참조 유지.
 */
export function useSourcePolicy(source: string): SourcePolicy {
  return useMemo(() => resolveSourcePolicy(source), [source])
}

export { SUPPLY_LABEL, MEDIA_LABEL, DERIVATION_LABEL, ATTRIBUTION_LABEL }
export type { SourcePolicy }
