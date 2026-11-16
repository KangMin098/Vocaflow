// apps/web/src/lib/csat/inquiry/data.ts
//
// **출제 사고 탐구 데이터 — 분석 버전에 묶인 정적 정본.** (vNext2 · inquiry v1 · 2026-10-11)
//
// 원본: scripts/csat/inquiry-drain/*.out.json(작성 → 검증기 → 독립 검수) → `inquiry-drain-build.mjs` → `inquiry-data.json`.
// DB 분석 정본과 검수 상태를 건드리지 않는다. 화면은 **지금 읽은 분석 버전과 같은 버전**으로 만든 데이터만 쓴다 —
// 분석이 새 버전이 되면 그 문항의 탐구 데이터는 stale 로 빠지고, 화면은 기존 분석 블록만 보인다(옛 설명을 최신처럼 보이지 않는다).
// 계약: docs/csat-learner/ITEM_INQUIRY_V2_CONTRACT.md

import { createHash } from 'node:crypto'
import data from '../inquiry-data.json'

import type { InquiryRecord } from './labels'

export type { InquiryDistractor, InquiryPrinciple, InquiryRecord, Truth } from './labels'

const RECORDS = (data as { items: Record<string, InquiryRecord> }).items

// T-0137 DATA_STATUS.json의 기존 공개 분석 스냅샷. 새 내용·승인으로 승격하지 않는다.
const TRANSFER_34_SHA = 'fbe006f6d7a9d9fb976bc4e279b5d60fad8df762b1442b61d5629c3a0e0bb5e4'
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

/** 34 전용 표시의 결속 검사. 원본은 불변이고 다른 문항에는 아무 표시도 추가하지 않는다. */
export function projectInteraction34(itemId: string, record: InquiryRecord): InquiryRecord {
  if (itemId !== '2026#34' || !record.v3) return record
  const matches = record.review === 'verified' && record.analysis_version === 5
    && createHash('sha256').update(canonical(record), 'utf8').digest('hex') === TRANSFER_34_SHA
  return { ...record, v3: { ...record.v3, interaction34: { state: matches ? 'ready' : 'VERIFICATION_FAILED', analysisVersion: record.analysis_version } } }
}

export type InquiryLookup = { state: 'ready'; record: InquiryRecord } | { state: 'stale' } | { state: 'missing' }

/** 문항 · 분석 버전 → 탐구 데이터. 버전이 다르면 stale(보이지 않는다), 없으면 missing. */
export function lookupInquiry(itemId: string, analysisVersion: number | null): InquiryLookup {
  const r = RECORDS[itemId]
  if (!r) return { state: 'missing' }
  if (analysisVersion == null || r.analysis_version !== analysisVersion) return { state: 'stale' }
  return { state: 'ready', record: projectInteraction34(itemId, r) }
}

/** 문항의 공개 v3 결속(문장 분할 · 분석 버전) — 비교 쌍이 쓸 때와 지금이 같은지 볼 때. 공개 탐구가 없으면 null */
export function inquiryBinding(itemId: string): { units_hash: string | null; analysis_version: number | null } | null {
  const r = RECORDS[itemId]
  if (!r) return null
  return { units_hash: r.v3?.units_hash ?? null, analysis_version: r.analysis_version ?? null }
}
