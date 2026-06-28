// apps/web/src/lib/articles/publish-gate.ts
// ACP §18 P4 — 발행 게이트 (SourcePolicy 기반 동적 구성).
//
// 목업의 핵심: 게이트 항목이 source 하드코딩이 아니라 policy 로 구성된다.
//   · media='audio'          → audio_url 연결 필수 (text 소스는 항목 없음)
//   · attribution='required'  → 출처 4종(source_url·author·license·link) 필수
//   · derivation='display_only' → 단어세트 미발행(info 행, fail 아님 — UI 에서 표시)
//   · 전 소스 공통: lexical_noise ≤ 0.08 · article_v_level 산정
// 발행 가능 = 모든 fail 0 (+ 상태 ready · copyright_safe 는 호출측 전제).

import type { SourcePolicy } from '@vocaflow/library-pipeline/curation-spec'

export const LEXICAL_NOISE_MAX = 0.08

export interface GateInput {
  audioUrl: string | null
  lexicalNoise: number | null
  articleVLevel: number | null
  sourceUrl: string | null
  author: string | null
  license: string | null
}

export interface GateItem {
  key: string
  label: string
  pass: boolean
}

/** policy 로 게이트 항목을 동적 구성 (목업 ③ 게이트 테이블). */
export function computeGateItems(policy: SourcePolicy, a: GateInput): GateItem[] {
  const items: GateItem[] = []

  if (policy.media === 'audio') {
    items.push({ key: 'audio', label: 'audio_url 연결', pass: !!(a.audioUrl && a.audioUrl.trim()) })
  }

  items.push({
    key: 'noise',
    label: `어휘 노이즈 ≤ ${LEXICAL_NOISE_MAX}`,
    pass: a.lexicalNoise != null && a.lexicalNoise <= LEXICAL_NOISE_MAX,
  })

  items.push({ key: 'vlevel', label: 'article_v_level 산정', pass: a.articleVLevel != null })

  if (policy.attribution === 'required') {
    items.push({
      key: 'attribution',
      label: '출처 4종 (url·author·license·link)',
      pass: !!(a.sourceUrl && a.author && a.license),
    })
  }

  return items
}

/** 모든 게이트 항목 pass = 발행 가능 (상태/copyright 는 별도 전제). */
export function gatePasses(items: GateItem[]): boolean {
  return items.length > 0 && items.every((i) => i.pass)
}

/** 큐 상태 dot — ready & 게이트 통과=ok / ready & 미통과=hold / 그 외=new. */
export type QueueDot = 'ok' | 'hold' | 'new'

export function queueDot(status: string, gatePass: boolean): QueueDot {
  if (status === 'ready') return gatePass ? 'ok' : 'hold'
  return 'new'
}
