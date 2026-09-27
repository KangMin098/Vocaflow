// apps/web/src/lib/knowledge/server.ts
// 학습 원리 등록부 로더. requireAdmin 뒤에서만 부른다(knowledge_* 는 service_role 전용).
// DB 오류를 빈 목록·0 으로 삼키지 않는다 — 던지고, 화면이 「불러오지 못함」으로 말한다.
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  GRADES,
  LAYERS,
  STATUSES,
  isGrade,
  isLayer,
  isStatus,
  type Grade,
  type ItemStatus,
  type Layer,
} from './labels'

function db(): SupabaseClient {
  return createAdminClient() as unknown as SupabaseClient
}

function fail(what: string, error: { code?: string; message?: string }): never {
  throw new Error(`${what} 읽기 실패 (${error.code ?? 'unknown'}: ${error.message ?? ''})`)
}

export interface KnowledgeItem {
  id: string
  layer: Layer
  slug: string
  title: string
  statement: string
  skillIds: string[]
  conditionIds: string[]
  status: ItemStatus
  statusReason: string | null
  efficacy: string
  productModules: string[]
  version: number
  updatedBy: string
  updatedAt: string
}

const ITEM_COLUMNS =
  'id,layer,slug,title,statement,skill_ids,condition_ids,status,status_reason,efficacy,product_modules,version,updated_by,updated_at'

function toItem(r: Record<string, unknown>): KnowledgeItem {
  if (!isLayer(r.layer) || !isStatus(r.status)) {
    throw new Error(`알 수 없는 층·상태: ${String(r.layer)} / ${String(r.status)}`)
  }
  return {
    id: String(r.id),
    layer: r.layer,
    slug: String(r.slug),
    title: String(r.title),
    statement: String(r.statement),
    skillIds: (r.skill_ids as string[]) ?? [],
    conditionIds: (r.condition_ids as string[]) ?? [],
    status: r.status,
    statusReason: (r.status_reason as string | null) ?? null,
    efficacy: String(r.efficacy),
    productModules: (r.product_modules as string[]) ?? [],
    version: Number(r.version),
    updatedBy: String(r.updated_by),
    updatedAt: String(r.updated_at),
  }
}

export async function listItems(filter: { layers?: Layer[]; statuses?: ItemStatus[] } = {}) {
  let q = db().from('knowledge_items').select(ITEM_COLUMNS).order('layer').order('title')
  if (filter.layers?.length) q = q.in('layer', filter.layers)
  if (filter.statuses?.length) q = q.in('status', filter.statuses)
  const { data, error } = await q
  if (error) fail('항목', error)
  return (data ?? []).map((r) => toItem(r as Record<string, unknown>))
}

export interface EvidenceRow {
  id: string
  itemId: string
  grade: Exclude<Grade, 'G'>
  attribution: 'stated' | 'inferred'
  sourceType: 'methodology' | 'csat_origin' | 'external'
  title: string
  url: string | null
  locator: string | null
  note: string | null
}

export async function listEvidence(itemIds: string[]): Promise<EvidenceRow[]> {
  if (itemIds.length === 0) return []
  const { data, error } = await db()
    .from('knowledge_evidence')
    .select(
      'id,item_id,grade,attribution,source_type,source_id,csat_passage_sha256,external_url,external_title,locator,note'
    )
    .in('item_id', itemIds)
  if (error) fail('근거', error)
  return (data ?? []).map((r) => ({
    id: String(r.id),
    itemId: String(r.item_id),
    grade: r.grade as EvidenceRow['grade'],
    attribution: r.attribution as EvidenceRow['attribution'],
    sourceType: r.source_type as EvidenceRow['sourceType'],
    title: String(r.external_title ?? r.source_id ?? r.csat_passage_sha256 ?? ''),
    url: (r.external_url as string | null) ?? null,
    locator: (r.locator as string | null) ?? null,
    note: (r.note as string | null) ?? null,
  }))
}

export interface LinkRow {
  fromId: string
  toId: string
  kind: string
  reason: string
}

export async function listLinks(): Promise<LinkRow[]> {
  const { data, error } = await db().from('knowledge_links').select('from_id,to_id,kind,reason')
  if (error) fail('연결', error)
  return (data ?? []).map((r) => ({
    fromId: String(r.from_id),
    toId: String(r.to_id),
    kind: String(r.kind),
    reason: String(r.reason),
  }))
}

export interface ReviewRow {
  itemId: string
  fromStatus: string | null
  toStatus: string
  reviewer: string
  reason: string | null
  at: string
}

export async function listReviews(itemIds: string[]): Promise<ReviewRow[]> {
  if (itemIds.length === 0) return []
  const { data, error } = await db()
    .from('knowledge_reviews')
    .select('item_id,from_status,to_status,reviewer,reason,at')
    .in('item_id', itemIds)
    .order('at', { ascending: false })
  if (error) fail('검토 기록', error)
  return (data ?? []).map((r) => ({
    itemId: String(r.item_id),
    fromStatus: (r.from_status as string | null) ?? null,
    toStatus: String(r.to_status),
    reviewer: String(r.reviewer),
    reason: (r.reason as string | null) ?? null,
    at: String(r.at),
  }))
}

export interface GapRow {
  id: string
  layer: Layer | null
  skillIds: string[]
  question: string
  cause: string
  nextAction: string
  affectedCount: number | null
  status: 'open' | 'closed'
  createdAt: string
}

export async function listGaps(): Promise<GapRow[]> {
  const { data, error } = await db()
    .from('knowledge_gaps')
    .select('id,layer,skill_ids,question,cause,next_action,affected_count,status,created_at')
    .order('status')
    .order('created_at', { ascending: false })
  if (error) fail('공백', error)
  return (data ?? []).map((r) => ({
    id: String(r.id),
    layer: isLayer(r.layer) ? r.layer : null,
    skillIds: (r.skill_ids as string[]) ?? [],
    question: String(r.question),
    cause: String(r.cause),
    nextAction: String(r.next_action),
    affectedCount: r.affected_count === null ? null : Number(r.affected_count),
    status: r.status === 'closed' ? 'closed' : 'open',
    createdAt: String(r.created_at),
  }))
}

export interface CsatOrigin {
  passageSha256: string
  representativeItemId: string
  itemIds: string[]
  examId: string
  grade: Grade
  sourceTitle: string | null
  sourceAuthors: string[]
  sourcePublisher: string | null
  sourceYear: number | null
  evidence: { kind: string; url: string; label: string }[]
  note: string | null
}

export async function listCsatOrigins(): Promise<CsatOrigin[]> {
  const { data, error } = await db()
    .from('knowledge_csat_origins')
    .select(
      'passage_sha256,representative_item_id,item_ids,exam_id,grade,source_title,source_authors,source_publisher,source_year,evidence,note'
    )
    .order('exam_id')
    .order('representative_item_id')
  if (error) fail('기출 원천', error)
  return (data ?? []).map((r) => {
    if (!isGrade(r.grade)) throw new Error(`알 수 없는 등급: ${String(r.grade)}`)
    return {
      passageSha256: String(r.passage_sha256),
      representativeItemId: String(r.representative_item_id),
      itemIds: (r.item_ids as string[]) ?? [],
      examId: String(r.exam_id),
      grade: r.grade,
      sourceTitle: (r.source_title as string | null) ?? null,
      sourceAuthors: (r.source_authors as string[]) ?? [],
      sourcePublisher: (r.source_publisher as string | null) ?? null,
      sourceYear: r.source_year === null ? null : Number(r.source_year),
      evidence: (r.evidence as CsatOrigin['evidence']) ?? [],
      note: (r.note as string | null) ?? null,
    }
  })
}

/** 층 × 상태 개수 — 원리 지도의 수치. 빈 칸도 0 으로 채워 격자가 비지 않게 한다. */
export function countByLayerStatus(items: KnowledgeItem[]) {
  const grid = Object.fromEntries(
    LAYERS.map((l) => [l, Object.fromEntries(STATUSES.map((s) => [s, 0]))])
  ) as Record<Layer, Record<ItemStatus, number>>
  for (const it of items) grid[it.layer][it.status] += 1
  return grid
}

export function countByGrade(origins: CsatOrigin[]) {
  const out = Object.fromEntries(GRADES.map((g) => [g, 0])) as Record<Grade, number>
  for (const o of origins) out[o.grade] += 1
  return out
}

export interface TaxonomyEntry {
  id: string
  label: string
  dimension: string
}

/** 분류 축 — 최신 가져오기 스냅샷의 methodology_taxonomy. 스냅샷이 없으면 빈 배열(오류는 던진다). */
export async function listTaxonomy(): Promise<TaxonomyEntry[]> {
  const client = db()
  const { data: batch, error: e1 } = await client
    .from('methodology_batches')
    .select('id')
    .order('created_at', { ascending: false })
    .limit(1)
  if (e1) fail('가져오기 원장', e1)
  if (!batch?.length) return []
  const { data, error } = await client
    .from('methodology_taxonomy')
    .select('id,label,dimension')
    .eq('batch_id', batch[0].id)
  if (error) fail('분류 축', error)
  return (data ?? []).map((r) => ({ id: String(r.id), label: String(r.label), dimension: String(r.dimension) }))
}

/** 항목 목록 화면용 묶음 — 항목 · 항목별 근거 수 · 분류 id→라벨. */
export async function loadItemView(filter: { layers?: Layer[]; statuses?: ItemStatus[] }) {
  const [items, taxonomy] = await Promise.all([listItems(filter), listTaxonomy()])
  const evidence = await listEvidence(items.map((i) => i.id))
  const evidenceCount: Record<string, number> = {}
  for (const e of evidence) evidenceCount[e.itemId] = (evidenceCount[e.itemId] ?? 0) + 1
  const taxonomyLabel = Object.fromEntries(taxonomy.map((t) => [t.id, t.label]))
  return { items, evidenceCount, taxonomyLabel }
}

export interface ExpertRow {
  id: string
  name: string
  organization: string
  specialties: string[]
  researchStatus: string
  channels: { name: string; url: string; relationship: string }[]
}

export async function listExperts(): Promise<ExpertRow[]> {
  const client = db()
  const { data: batch, error: e1 } = await client
    .from('methodology_batches')
    .select('id')
    .order('created_at', { ascending: false })
    .limit(1)
  if (e1) fail('가져오기 원장', e1)
  if (!batch?.length) return []
  const [experts, channels] = await Promise.all([
    client.from('methodology_experts').select('id,name,organization,specialties,researchStatus').eq('batch_id', batch[0].id),
    client.from('methodology_channels').select('name,url,relationship,expertIds').eq('batch_id', batch[0].id),
  ])
  if (experts.error) fail('전문가', experts.error)
  if (channels.error) fail('채널', channels.error)
  return (experts.data ?? []).map((e) => ({
    id: String(e.id),
    name: String(e.name),
    organization: String(e.organization),
    specialties: (e.specialties as string[]) ?? [],
    researchStatus: String(e.researchStatus),
    channels: (channels.data ?? [])
      .filter((c) => ((c.expertIds as string[]) ?? []).includes(String(e.id)))
      .map((c) => ({ name: String(c.name), url: String(c.url), relationship: String(c.relationship) })),
  }))
}
