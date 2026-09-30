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

type Row = Record<string, unknown>
type PageResult = { data: unknown[] | null; error: { code?: string; message?: string } | null }

/** Supabase API 가 한 번에 돌려주는 최대 행 수(저장소 설정). 한 번만 읽으면 뒤쪽 행이 조용히 빠진다. */
const PAGE = 1000

/**
 * 끝까지 읽는다 — **커서(keyset) 페이징**. OFFSET 은 깊어질수록 비싸고 저장소 예산이 막는다
 * (`offset-paging-budget` 회귀). `make(after)` 는 고유 키 `key` 로 정렬하고 `.limit(PAGE)` 한 질의에,
 * `after` 가 있으면 `.gt(key, after)` 를 붙여 돌려준다. 화면 순서는 받은 뒤 JS 로 다시 정렬한다.
 */
async function fetchAll(
  what: string,
  key: string,
  make: (after: string | null) => PromiseLike<PageResult>
): Promise<Row[]> {
  const out: Row[] = []
  let after: string | null = null
  for (;;) {
    const { data, error } = await make(after)
    if (error) fail(what, error)
    const rows = (data ?? []) as Row[]
    out.push(...rows)
    if (rows.length < PAGE) return out
    after = String(rows[rows.length - 1]![key])
  }
}

/** `.in()` 에 넣는 ID 가 많으면 요청 주소가 길어진다 — 나눠서 읽고 합친다. */
const ID_CHUNK = 200
async function fetchByIds(
  what: string,
  ids: string[],
  key: string,
  make: (chunk: string[], after: string | null) => PromiseLike<PageResult>
): Promise<Row[]> {
  const out: Row[] = []
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    const chunk = ids.slice(i, i + ID_CHUNK)
    out.push(...(await fetchAll(what, key, (after) => make(chunk, after))))
  }
  return out
}

/** 화면 정렬(다중 열)용 비교기 — 커서 페이징은 고유 키 순으로 받으므로 받은 뒤 다시 정렬한다. */
function byKeys(...keys: { key: string; desc?: boolean }[]) {
  return (a: Row, b: Row) => {
    for (const { key, desc } of keys) {
      const c = String(a[key] ?? '').localeCompare(String(b[key] ?? ''))
      if (c !== 0) return desc ? -c : c
    }
    return 0
  }
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
  /** 근거 집합 버전 — 근거가 추가·삭제·변경될 때마다 DB 트리거가 올린다. 채택 요청에 실어 「본 근거 그대로」를 확인한다. */
  evidenceVersion: number
  updatedBy: string
  updatedAt: string
}

const ITEM_COLUMNS =
  'id,layer,slug,title,statement,skill_ids,condition_ids,status,status_reason,efficacy,product_modules,version,evidence_version,updated_by,updated_at'

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
    evidenceVersion: Number(r.evidence_version),
    updatedBy: String(r.updated_by),
    updatedAt: String(r.updated_at),
  }
}

export async function listItems(filter: { layers?: Layer[]; statuses?: ItemStatus[] } = {}) {
  const rows = await fetchAll('항목', 'id', (after) => {
    let q = db().from('knowledge_items').select(ITEM_COLUMNS).order('id').limit(PAGE)
    if (filter.layers?.length) q = q.in('layer', filter.layers)
    if (filter.statuses?.length) q = q.in('status', filter.statuses)
    if (after) q = q.gt('id', after)
    return q
  })
  return rows.sort(byKeys({ key: 'layer' }, { key: 'title' }, { key: 'id' })).map(toItem)
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
  const rows = await fetchByIds('근거', itemIds, 'id', (chunk, after) => {
    let q = db()
      .from('knowledge_evidence')
      .select(
        'id,item_id,grade,attribution,source_type,source_id,csat_passage_sha256,external_url,external_title,locator,note'
      )
      .in('item_id', chunk)
      .order('id')
      .limit(PAGE)
    if (after) q = q.gt('id', after)
    return q
  })
  return rows.map((r) => ({
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
  const rows = await fetchAll('연결', 'id', (after) => {
    let q = db().from('knowledge_links').select('id,from_id,to_id,kind,reason').order('id').limit(PAGE)
    if (after) q = q.gt('id', after)
    return q
  })
  return rows.map((r) => ({
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
  // id 는 bigint identity — 커서 비교가 문자열이 아니라 숫자여야 하므로 gt 에 숫자 문자열을 그대로 넘긴다(DB 가 bigint 로 비교)
  const rows = await fetchByIds('검토 기록', itemIds, 'id', (chunk, after) => {
    let q = db()
      .from('knowledge_reviews')
      .select('id,item_id,from_status,to_status,reviewer,reason,at')
      .in('item_id', chunk)
      .order('id')
      .limit(PAGE)
    if (after) q = q.gt('id', after)
    return q
  })
  // 최신순으로 — 같은 시각이면 나중에 쌓인 id 가 위
  rows.sort((a, b) => String(b.at).localeCompare(String(a.at)) || Number(b.id) - Number(a.id))
  return rows.map((r) => ({
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
  const rows = await fetchAll('공백', 'id', (after) => {
    let q = db()
      .from('knowledge_gaps')
      .select('id,layer,skill_ids,question,cause,next_action,affected_count,status,created_at')
      .order('id')
      .limit(PAGE)
    if (after) q = q.gt('id', after)
    return q
  })
  // 열린 것 먼저(open < closed), 그 안에서 최신순
  rows.sort(byKeys({ key: 'status', desc: true }, { key: 'created_at', desc: true }, { key: 'id' }))
  return rows.map((r) => ({
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
  const rows = await fetchAll('기출 원천', 'passage_sha256', (after) => {
    let q = db()
      .from('knowledge_csat_origins')
      .select(
        'passage_sha256,representative_item_id,item_ids,exam_id,grade,source_title,source_authors,source_publisher,source_year,evidence,note'
      )
      .order('passage_sha256')
      .limit(PAGE)
    if (after) q = q.gt('passage_sha256', after)
    return q
  })
  rows.sort(byKeys({ key: 'exam_id' }, { key: 'representative_item_id' }, { key: 'passage_sha256' }))
  return rows.map((r) => {
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
  const batchId = batch[0].id
  const rows = await fetchAll('분류 축', 'id', (after) => {
    let q = client.from('methodology_taxonomy').select('id,label,dimension').eq('batch_id', batchId).order('id').limit(PAGE)
    if (after) q = q.gt('id', after)
    return q
  })
  return rows.map((r) => ({ id: String(r.id), label: String(r.label), dimension: String(r.dimension) }))
}

/**
 * 출처 종류별 근거 수 — 개수만 필요하니 행을 가져오지 않고 DB 가 센다(head 요청).
 * `count ?? 0` 금지: 셀 수 없으면 0 이 아니라 오류다.
 */
export async function countEvidenceBySource(): Promise<Record<'methodology' | 'csat_origin' | 'external', number>> {
  const kinds = ['methodology', 'csat_origin', 'external'] as const
  const counts = await Promise.all(
    kinds.map(async (k) => {
      const { count, error } = await db()
        .from('knowledge_evidence')
        .select('id', { count: 'exact', head: true })
        .eq('source_type', k)
      if (error) fail('근거 수', error)
      if (count === null) throw new Error(`근거 수를 세지 못했다 (${k})`)
      return [k, count] as const
    })
  )
  return Object.fromEntries(counts) as Record<(typeof kinds)[number], number>
}

/** 항목 목록 화면용 묶음 — 항목 · 항목별 근거 수 · 분류 id→라벨. */
export async function loadItemView(filter: { layers?: Layer[]; statuses?: ItemStatus[] }) {
  const [items, taxonomy] = await Promise.all([listItems(filter), listTaxonomy()])
  const evidence = await listEvidence(items.map((i) => i.id))
  const evidenceCount: Record<string, number> = {}
  for (const e of evidence) evidenceCount[e.itemId] = (evidenceCount[e.itemId] ?? 0) + 1
  const taxonomyLabel = Object.fromEntries(taxonomy.map((t) => [t.id, t.label]))
  return { items, evidenceCount, taxonomyLabel, taxonomy }
}

/** 항목 상세 — 항목 · 위/아래 연결(상대 항목 포함) · 근거 · 검토 기록 · 분류 라벨. 없으면 null. */
export async function loadItemDetail(slug: string) {
  const client = db()
  const { data: row, error } = await client.from('knowledge_items').select(ITEM_COLUMNS).eq('slug', slug).maybeSingle()
  if (error) fail('항목', error)
  if (!row) return null
  const item = toItem(row as Record<string, unknown>)

  const [links, evidence, reviews, taxonomy, all] = await Promise.all([
    listLinks(),
    listEvidence([item.id]),
    listReviews([item.id]),
    listTaxonomy(),
    listItems(),
  ])
  const byId = new Map(all.map((i) => [i.id, i]))
  const mine = links.filter((l) => l.fromId === item.id || l.toId === item.id)
  const related = mine
    .map((l) => {
      const outgoing = l.fromId === item.id
      const other = byId.get(outgoing ? l.toId : l.fromId)
      return other ? { ...l, outgoing, other } : null
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  return {
    item,
    /** 이 항목이 구현하는 위층 항목 */
    up: related.filter((r) => r.kind === 'implements' && r.outgoing),
    /** 이 항목을 구현하는 아래층 항목 */
    down: related.filter((r) => r.kind === 'implements' && !r.outgoing),
    /** 반대·보완·조건 차이·중복 후보 */
    side: related.filter((r) => r.kind !== 'implements'),
    evidence,
    reviews,
    taxonomy,
    others: all.filter((i) => i.id !== item.id),
  }
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
  const batchId = batch[0].id
  const [experts, channels] = await Promise.all([
    fetchAll('전문가', 'id', (after) => {
      let q = client
        .from('methodology_experts')
        .select('id,name,organization,specialties,researchStatus')
        .eq('batch_id', batchId)
        .order('id')
        .limit(PAGE)
      if (after) q = q.gt('id', after)
      return q
    }),
    fetchAll('채널', 'id', (after) => {
      let q = client
        .from('methodology_channels')
        .select('id,name,url,relationship,expertIds')
        .eq('batch_id', batchId)
        .order('id')
        .limit(PAGE)
      if (after) q = q.gt('id', after)
      return q
    }),
  ])
  return experts.map((e) => ({
    id: String(e.id),
    name: String(e.name),
    organization: String(e.organization),
    specialties: (e.specialties as string[]) ?? [],
    researchStatus: String(e.researchStatus),
    channels: channels
      .filter((c) => ((c.expertIds as string[]) ?? []).includes(String(e.id)))
      .map((c) => ({ name: String(c.name), url: String(c.url), relationship: String(c.relationship) })),
  }))
}
