// apps/web/src/lib/knowledge/research-compare-server.ts
// 작업 4 서버 로더 — 원리 근거 비교 · 영역 지도. **읽기만** 한다(requireAdmin 뒤 service_role).
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { comparePrinciple, domainMatrix, type DomainMatrix, type PrincipleComparison, type REvidence, type RInquiryLink, type RItem } from './research-compare'

const CAP = 5000
type Row = Record<string, unknown>

async function read(what: string, q: PromiseLike<{ data: unknown; error: { message?: string } | null }>): Promise<Row[]> {
  const { data, error } = await q
  if (error) throw new Error(`${what} 읽기 실패: ${error.message ?? ''}`)
  const rows = (data ?? []) as Row[]
  if (rows.length >= CAP) throw new Error(`${what} 이 ${CAP} 행에 닿았다 — 페이징이 필요하다`)
  return rows
}

export interface ResearchCompareData {
  principles: PrincipleComparison[]
  matrix: DomainMatrix
}

export async function loadResearchCompare(): Promise<ResearchCompareData> {
  const db = createAdminClient() as unknown as SupabaseClient
  const [items, evidence, links] = await Promise.all([
    read('항목', db.from('knowledge_items').select('id,slug,title,layer,status,skill_ids').limit(CAP)),
    read('근거', db.from('knowledge_evidence').select('item_id,attribution,evidence_level,applicability,applicability_note,research_source_id').limit(CAP)),
    read('탐구 연결', db.from('knowledge_inquiry_links').select('item_id,inquiry_id,role').limit(CAP)),
  ])
  const all: RItem[] = items.map((i) => ({ id: String(i.id), slug: String(i.slug), title: String(i.title), layer: String(i.layer), status: String(i.status), skillIds: (i.skill_ids as string[] | null) ?? [] }))
  const ev: (REvidence & { itemId: string })[] = evidence.map((e) => ({
    itemId: String(e.item_id), attribution: (e.attribution as string | null) ?? null, evidenceLevel: (e.evidence_level as string | null) ?? null,
    applicability: (e.applicability as string | null) ?? null, applicabilityNote: (e.applicability_note as string | null) ?? null, researchSourceId: (e.research_source_id as string | null) ?? null,
  }))
  const ln: RInquiryLink[] = links.map((l) => ({ itemId: (l.item_id as string | null) ?? null, inquiryId: String(l.inquiry_id), role: String(l.role) }))
  const principles = all
    .filter((i) => i.layer === 'principle' || i.layer === 'essence')
    .map((i) => comparePrinciple(i, ev.filter((e) => e.itemId === i.id), ln.filter((l) => l.itemId === i.id)))
  return { principles, matrix: domainMatrix(all) }
}
