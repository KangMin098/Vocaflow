// apps/web/src/lib/csat/meaning-support/data.ts
//
// **v3.1 원문 이해 교수 sidecar — 서버 전용 조회 · base 결속.** (C1 · 설계 §5.2)
//
// 순서: (호출자가) 문항 접근 · Reveal Gate 확인 → lookupInquiry ready → 여기서 sidecar 결속 검사.
//   analysisVersion · unitsHash · basePublicHash(**지금 배포된 inquiry 레코드 전체의 직접 canonical SHA-256**)가 모두 같을 때만 ready.
//   하나라도 다르면 stale — 기존 v3 화면은 그대로 쓴다. 공개 데이터 파일 전체를 클라이언트로 보내지 않고 문항 1개의 projection 만 넘긴다.
// 해시 규칙은 scripts/csat/lib-meaning-support.mjs 와 같다(키 재귀 정렬 · 배열 순서 유지 · 문자열 원형). 동치 회귀: __tests__/model.test.ts.

import { createHash } from 'node:crypto'

import inquiryData from '../inquiry-data.json'
import data from '../meaning-support-data.json'

import type { InquiryRecord } from '../inquiry/labels'
import type { MeaningSupportView, MsContentState } from './labels'

interface StoredSupport extends MeaningSupportView {
  schema: string
  binding: { analysisVersion: number; unitsHash: string; basePublicHash: string; sourceSnapshotHash: string }
  review?: { criteria: string; contentHash: string; reviewer: string }
}
const SUPPORTS = (data as unknown as { items: Record<string, StoredSupport> }).items
const RECORDS = (inquiryData as unknown as { items: Record<string, InquiryRecord> }).items

export function canonicalJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(',')}]`
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    return `{${Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`)
      .join(',')}}`
  }
  return JSON.stringify(v)
}
export const basePublicHash = (record: unknown) => createHash('sha256').update(canonicalJson(record), 'utf8').digest('hex')

/** 공개 projection — 결속 · 검수 메타 · schema 를 뺀 화면용 형태 */
function project(s: StoredSupport): MeaningSupportView {
  return {
    itemId: s.itemId, defaultUnitId: s.defaultUnitId, anchors: s.anchors, propositions: s.propositions, units: s.units,
    relations: s.relations, whole: s.whole, bridges: s.bridges, partial: s.partial ?? null,
  }
}

/**
 * 문항 하나의 교수 설명 조회. inquiryReady=false(분석 버전 다름 등)면 stale. analysisVersion 은 지금 읽은 live 분석 버전.
 * @param records 테스트 주입(기본은 배포 inquiry-data)
 */
export function lookupMeaningSupport(
  itemId: string,
  analysisVersion: number | null,
  inquiryReady: boolean,
  { supports = SUPPORTS, records = RECORDS }: { supports?: Record<string, StoredSupport>; records?: Record<string, InquiryRecord> } = {},
): { state: MsContentState; view: MeaningSupportView | null } {
  const s = supports[itemId]
  if (!s) return { state: 'missing', view: null }
  const rec = records[itemId]
  if (!inquiryReady || !rec || analysisVersion == null) return { state: 'stale', view: null }
  const b = s.binding
  if (b.analysisVersion !== analysisVersion || b.analysisVersion !== rec.analysis_version) return { state: 'stale', view: null }
  if (b.unitsHash !== rec.v3?.units_hash) return { state: 'stale', view: null }
  if (b.basePublicHash !== basePublicHash(rec)) return { state: 'stale', view: null }
  return { state: 'ready', view: project(s) }
}
