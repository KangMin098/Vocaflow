// apps/web/src/lib/csat/inquiry/data.ts
//
// **출제 사고 탐구 데이터 — 분석 버전에 묶인 정적 정본.** (vNext2 · inquiry v1 · 2026-10-11)
//
// 원본: scripts/csat/inquiry-drain/*.out.json(작성 → 검증기 → 독립 검수) → `inquiry-drain-build.mjs` → `inquiry-data.json`.
// DB 분석 정본과 검수 상태를 건드리지 않는다. 화면은 **지금 읽은 분석 버전과 같은 버전**으로 만든 데이터만 쓴다 —
// 분석이 새 버전이 되면 그 문항의 탐구 데이터는 stale 로 빠지고, 화면은 기존 분석 블록만 보인다(옛 설명을 최신처럼 보이지 않는다).
// 계약: docs/csat-learner/ITEM_INQUIRY_V2_CONTRACT.md

import data from '../inquiry-data.json'

import type { InquiryRecord } from './labels'

export type { InquiryDistractor, InquiryPrinciple, InquiryRecord, Truth } from './labels'

const RECORDS = (data as { items: Record<string, InquiryRecord> }).items

export type InquiryLookup = { state: 'ready'; record: InquiryRecord } | { state: 'stale' } | { state: 'missing' }

/** 문항 · 분석 버전 → 탐구 데이터. 버전이 다르면 stale(보이지 않는다), 없으면 missing. */
export function lookupInquiry(itemId: string, analysisVersion: number | null): InquiryLookup {
  const r = RECORDS[itemId]
  if (!r) return { state: 'missing' }
  if (analysisVersion == null || r.analysis_version !== analysisVersion) return { state: 'stale' }
  return { state: 'ready', record: r }
}
