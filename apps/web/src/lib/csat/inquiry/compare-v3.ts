// apps/web/src/lib/csat/inquiry/compare-v3.ts
//
// **v3 비교 쌍 — 서버 projection.** (M4 · CSAT_REASONING_DATA_V3 §ComparisonPair)
//
// 원본: scripts/csat/compare-drain/chunk-v3p-*.out.json(작성 → 검증기 → 해시 결속 독립 검수) → `compare-v3-build.mjs` → `compare-v3-data.json`.
// 빌드가 이미 「양쪽 공개 v3 · 결속 해시 현재」인 쌍만 담는다. 여기서는 요청 시점의 조건을 다시 건다:
//   - 이 문항의 탐구 데이터가 지금 분석 버전과 다르면(stale) 비교 전체를 숨긴다
//   - 상대 문항은 같은 유형 siblings 가 아니라 **상대 유형의 공개 목록**으로 확인한다 — 공개되지 않은 상대의 설명은 내지 않는다
// 기존 비교(compare-data.json, legacy_unbound)는 v3 로 승격하지 않는다.

import data from '../compare-v3-data.json'

import type { PairAbsence, PairKind, V3PairView } from './labels'

interface Side { sentences: number[]; choices?: number[] }
interface StoredPair {
  kind: PairKind
  focus: string
  left: string
  right: string
  types: { left: string | null; right: string | null }
  mappings: { left: Side; right: Side; relation: string }[]
  shared_conditions: string[]
  decisive_differences: { text: string; left_sentences: number[]; right_sentences: number[] }[]
  principle: V3PairView['principle']
  limitation: string
  binding?: { left?: { units_hash?: string }; right?: { units_hash?: string } }
}
interface CompareV3Data { pairs: Record<string, StoredPair>; items: Record<string, string[]> }

const DATA = data as unknown as CompareV3Data

export interface PartnerInfo { slug: string; label: string }
/** 상대 문항의 지금 상태 — 공개 · 보류/접근 제한(held) · 공개 골격에 없음(missing, 삭제 · 미발행) */
export type PartnerState = ({ state: 'open' } & PartnerInfo) | { state: 'held' } | { state: 'missing' }
/** 화면에서 뺀 쌍의 이유별 수 — 누락을 정상처럼 숨기지 않는다 */
export interface PairWithheld { held: number; missing: number; changed: number }

/** 이 문항의 비교 쌍 상대 문항 id · 유형(공개 확인용) */
export function v3PairPartners(itemId: string, d: CompareV3Data = DATA): { id: string; type: string | null }[] {
  return (d.items[itemId] ?? []).flatMap((pid) => {
    const p = d.pairs[pid]
    if (!p) return []
    return p.left === itemId ? [{ id: p.right, type: p.types.right }] : [{ id: p.left, type: p.types.left }]
  })
}

/**
 * 이 문항 기준으로 돌린 공개 비교 쌍 + 없을 때의 이유.
 * @param inquiryReady 이 문항의 탐구 데이터가 지금 분석 버전과 같은가(lookupInquiry ready)
 * @param partner      상대 id → 공개되어 열 수 있으면 slug · label, 아니면 null
 */
export function projectV3Pairs(
  itemId: string,
  inquiryReady: boolean,
  partner: (id: string) => PartnerInfo | PartnerState | null,
  d: CompareV3Data = DATA,
  /** 상대의 지금 공개 v3 문장 분할 결속 — 쌍을 쓸 때와 다르면 changed 로 뺀다(주지 않으면 검사 안 함) */
  unitsOf?: (id: string) => string | null,
): { pairs: V3PairView[]; absence: PairAbsence | null; withheld: PairWithheld } {
  const withheld: PairWithheld = { held: 0, missing: 0, changed: 0 }
  const ids = d.items[itemId] ?? []
  if (!ids.length) return { pairs: [], absence: 'none', withheld }
  if (!inquiryReady) return { pairs: [], absence: 'stale', withheld }
  const pairs: V3PairView[] = []
  for (const pid of ids) {
    const p = d.pairs[pid]
    if (!p) continue
    const selfLeft = p.left === itemId
    const otherId = selfLeft ? p.right : p.left
    const raw = partner(otherId)
    const st: PartnerState = raw == null ? { state: 'held' } : 'state' in raw ? raw : { state: 'open', ...raw }
    if (st.state !== 'open') { withheld[st.state]++; continue }
    if (unitsOf) {
      const now = unitsOf(otherId)
      const bound = selfLeft ? p.binding?.right?.units_hash : p.binding?.left?.units_hash
      if (!now || (bound && now !== bound)) { withheld.changed++; continue }
    }
    const other = st
    pairs.push({
      pairId: pid,
      kind: p.kind,
      focus: p.focus,
      otherSlug: other.slug,
      otherLabel: other.label,
      mappings: p.mappings.map((m) => ({ self: selfLeft ? m.left : m.right, other: selfLeft ? m.right : m.left, relation: m.relation })),
      shared: p.shared_conditions,
      differences: p.decisive_differences.map((x) => ({
        text: x.text,
        selfSentences: selfLeft ? x.left_sentences : x.right_sentences,
        otherSentences: selfLeft ? x.right_sentences : x.left_sentences,
      })),
      principle: p.principle,
      limitation: p.limitation,
    })
  }
  if (pairs.length) return { pairs, absence: null, withheld }
  return { pairs: [], absence: withheld.changed && !withheld.held && !withheld.missing ? 'partner_changed' : withheld.missing && !withheld.held ? 'partner_missing' : 'partner_hidden', withheld }
}
