// apps/web/src/lib/knowledge/vnext-server.ts
// 학습 원리 vNext 관리자 로더 — 탐구 · 설계 · 배포 · 수행 · 검증. requireAdmin 뒤에서만 부른다(service_role).
// 정본 docs/methodology/VNEXT.md · 마이그레이션 20261008120000. DB 오류는 삼키지 않고 던진다(화면이 「불러오지 못함」).
// 대상 표는 작다(설계·질문은 수십, 수행 기록은 설계당 수천) — 수행 기록만 커서 페이징한다.
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { isLayer, isStatus, type ItemStatus, type Layer } from './labels'
import {
  checkDeployReadiness,
  evaluateProtocol,
  isDesignRole,
  isDesignStatus,
  isFacet,
  isFit,
  isInquiryStatus,
  isResearchLevel,
  isStance,
  parseProcedure,
  parseThresholds,
  type DesignRole,
  type DesignStatus,
  type Facet,
  type Fit,
  type InquiryStatus,
  type ProcedureStep,
  type ProtocolResult,
  type Readiness,
  type ResearchLevel,
  type RunRecord,
  type Stance,
  type Verdict,
} from './vnext'

function db(): SupabaseClient {
  return createAdminClient() as unknown as SupabaseClient
}

function fail(what: string, error: { code?: string; message?: string }): never {
  throw new Error(`${what} 읽기 실패 (${error.code ?? 'unknown'}: ${error.message ?? ''})`)
}

type Row = Record<string, unknown>
const PAGE = 1000

// ── 항목(얇은 모양) ──────────────────────────────────────────────────
export interface ItemRef {
  id: string
  slug: string
  title: string
  layer: Layer
  status: ItemStatus
  facet: Facet | null
  evidenceCount: number
}

async function listItemRefs(ids?: string[]): Promise<ItemRef[]> {
  const out: Row[] = []
  let after: string | null = null
  for (;;) {
    let q = db().from('knowledge_items').select('id,slug,title,layer,status,facet').order('id').limit(PAGE)
    if (ids) q = q.in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])
    if (after) q = q.gt('id', after)
    const { data, error } = await q
    if (error) fail('항목', error)
    const rows = (data ?? []) as Row[]
    out.push(...rows)
    if (rows.length < PAGE) break
    after = String(rows[rows.length - 1]!.id)
  }
  const evid = await evidenceCounts()
  return out.map((r) => {
    if (!isLayer(r.layer) || !isStatus(r.status)) throw new Error(`알 수 없는 층·상태: ${String(r.layer)}/${String(r.status)}`)
    return {
      id: String(r.id),
      slug: String(r.slug),
      title: String(r.title),
      layer: r.layer,
      status: r.status,
      facet: isFacet(r.facet) ? r.facet : null,
      evidenceCount: evid.byItem.get(String(r.id)) ?? 0,
    }
  })
}

// ── 근거 세 축 집계 ──────────────────────────────────────────────────
export interface EvidenceAxes {
  id: string
  itemId: string
  grade: string
  attribution: string
  sourceType: string
  researchLevel: ResearchLevel
  fit: Fit
  fitNote: string | null
  title: string | null
  url: string | null
  locator: string | null
  note: string | null
}

async function evidenceRows(itemIds?: string[]): Promise<EvidenceAxes[]> {
  const out: Row[] = []
  let after: string | null = null
  for (;;) {
    let q = db()
      .from('knowledge_evidence')
      .select('id,item_id,grade,attribution,source_type,research_level,fit,fit_note,external_title,external_url,locator,note')
      .order('id')
      .limit(PAGE)
    if (itemIds) q = q.in('item_id', itemIds.length ? itemIds : ['00000000-0000-0000-0000-000000000000'])
    if (after) q = q.gt('id', after)
    const { data, error } = await q
    if (error) fail('근거', error)
    const rows = (data ?? []) as Row[]
    out.push(...rows)
    if (rows.length < PAGE) break
    after = String(rows[rows.length - 1]!.id)
  }
  return out.map((r) => ({
    id: String(r.id),
    itemId: String(r.item_id),
    grade: String(r.grade),
    attribution: String(r.attribution),
    sourceType: String(r.source_type),
    researchLevel: isResearchLevel(r.research_level) ? r.research_level : 'not_assessed',
    fit: isFit(r.fit) ? r.fit : 'not_assessed',
    fitNote: (r.fit_note as string | null) ?? null,
    title: (r.external_title as string | null) ?? null,
    url: (r.external_url as string | null) ?? null,
    locator: (r.locator as string | null) ?? null,
    note: (r.note as string | null) ?? null,
  }))
}

async function evidenceCounts() {
  const rows = await evidenceRows()
  const byItem = new Map<string, number>()
  const byLevel = new Map<ResearchLevel, number>()
  for (const e of rows) {
    byItem.set(e.itemId, (byItem.get(e.itemId) ?? 0) + 1)
    byLevel.set(e.researchLevel, (byLevel.get(e.researchLevel) ?? 0) + 1)
  }
  return { byItem, byLevel, total: rows.length }
}

// ── 탐구 질문 ────────────────────────────────────────────────────────
export interface Inquiry {
  id: string
  slug: string
  question: string
  status: InquiryStatus
  capabilityItemId: string | null
  conclusion: string | null
  uncertainty: string | null
  nextAction: string | null
  updatedAt: string
}

function toInquiry(r: Row): Inquiry {
  if (!isInquiryStatus(r.status)) throw new Error(`알 수 없는 질문 상태: ${String(r.status)}`)
  return {
    id: String(r.id),
    slug: String(r.slug),
    question: String(r.question),
    status: r.status,
    capabilityItemId: (r.capability_item_id as string | null) ?? null,
    conclusion: (r.conclusion as string | null) ?? null,
    uncertainty: (r.uncertainty as string | null) ?? null,
    nextAction: (r.next_action as string | null) ?? null,
    updatedAt: String(r.updated_at),
  }
}

const INQ_COLS = 'id,slug,question,status,capability_item_id,conclusion,uncertainty,next_action,updated_at'

export interface Position {
  id: string
  stance: Stance
  note: string
  createdBy: string
  item: ItemRef | null
  evidence: EvidenceAxes | null
}

export async function listInquiries() {
  const [{ data, error }, pos] = await Promise.all([
    db().from('knowledge_inquiries').select(INQ_COLS).order('updated_at', { ascending: false }),
    db().from('knowledge_inquiry_positions').select('inquiry_id,stance'),
  ])
  if (error) fail('탐구 질문', error)
  if (pos.error) fail('입장', pos.error)
  const counts = new Map<string, Record<Stance, number>>()
  for (const p of (pos.data ?? []) as Row[]) {
    if (!isStance(p.stance)) continue
    const k = String(p.inquiry_id)
    const c = counts.get(k) ?? { supports: 0, contradicts: 0, qualifies: 0, counterexample: 0 }
    c[p.stance]++
    counts.set(k, c)
  }
  return ((data ?? []) as Row[]).map((r) => {
    const q = toInquiry(r)
    return { ...q, stances: counts.get(q.id) ?? { supports: 0, contradicts: 0, qualifies: 0, counterexample: 0 } }
  })
}

export async function loadInquiryDetail(slug: string) {
  const { data, error } = await db().from('knowledge_inquiries').select(INQ_COLS).eq('slug', slug).maybeSingle()
  if (error) fail('탐구 질문', error)
  if (!data) return null
  const inquiry = toInquiry(data as Row)
  const { data: pos, error: pe } = await db()
    .from('knowledge_inquiry_positions')
    .select('id,stance,note,created_by,item_id,evidence_id,created_at')
    .eq('inquiry_id', inquiry.id)
    .order('created_at')
  if (pe) fail('입장', pe)
  const posRows = (pos ?? []) as Row[]
  const evIds = posRows.map((p) => p.evidence_id).filter((x): x is string => typeof x === 'string')
  const evidence = evIds.length ? (await evidenceRows()).filter((e) => evIds.includes(e.id)) : []
  const evById = new Map(evidence.map((e) => [e.id, e]))
  const itemIds = [
    ...new Set([
      ...posRows.map((p) => p.item_id).filter((x): x is string => typeof x === 'string'),
      ...evidence.map((e) => e.itemId),
      ...(inquiry.capabilityItemId ? [inquiry.capabilityItemId] : []),
    ]),
  ]
  const items = await listItemRefs(itemIds)
  const itemById = new Map(items.map((i) => [i.id, i]))
  const positions: Position[] = posRows
    .filter((p) => isStance(p.stance))
    .map((p) => {
      const ev = typeof p.evidence_id === 'string' ? (evById.get(p.evidence_id) ?? null) : null
      const itemId = typeof p.item_id === 'string' ? p.item_id : (ev?.itemId ?? null)
      return {
        id: String(p.id),
        stance: p.stance as Stance,
        note: String(p.note),
        createdBy: String(p.created_by),
        item: itemId ? (itemById.get(itemId) ?? null) : null,
        evidence: ev,
      }
    })
  const designs = (await listDesigns()).filter((d) => d.inquiryId === inquiry.id)
  return {
    inquiry,
    capability: inquiry.capabilityItemId ? (itemById.get(inquiry.capabilityItemId) ?? null) : null,
    positions,
    designs,
    allItems: await listItemRefs(),
  }
}

// ── 설계 ─────────────────────────────────────────────────────────────
export interface Design {
  id: string
  slug: string
  title: string
  learnerSummary: string
  procedure: ProcedureStep[]
  includeConditions: string[]
  excludeConditions: string[]
  moduleKey: string
  trainTypeIds: string[]
  transferTypeIds: string[]
  mapCodes: string[]
  assessment: Record<string, unknown>
  inquiryId: string | null
  status: DesignStatus
  statusReason: string | null
  version: number
  updatedBy: string
  updatedAt: string
}

const DESIGN_COLS =
  'id,slug,title,learner_summary,procedure,include_conditions,exclude_conditions,module_key,train_type_ids,transfer_type_ids,map_codes,assessment,inquiry_id,status,status_reason,version,updated_by,updated_at'

export function toDesign(r: Row): Design {
  if (!isDesignStatus(r.status)) throw new Error(`알 수 없는 설계 상태: ${String(r.status)}`)
  return {
    id: String(r.id),
    slug: String(r.slug),
    title: String(r.title),
    learnerSummary: String(r.learner_summary),
    procedure: parseProcedure(r.procedure),
    includeConditions: (r.include_conditions as string[]) ?? [],
    excludeConditions: (r.exclude_conditions as string[]) ?? [],
    moduleKey: String(r.module_key),
    trainTypeIds: (r.train_type_ids as string[]) ?? [],
    transferTypeIds: (r.transfer_type_ids as string[]) ?? [],
    mapCodes: (r.map_codes as string[]) ?? [],
    assessment: (r.assessment as Record<string, unknown>) ?? {},
    inquiryId: (r.inquiry_id as string | null) ?? null,
    status: r.status,
    statusReason: (r.status_reason as string | null) ?? null,
    version: Number(r.version),
    updatedBy: String(r.updated_by),
    updatedAt: String(r.updated_at),
  }
}

export async function listDesigns(): Promise<Design[]> {
  const { data, error } = await db().from('knowledge_designs').select(DESIGN_COLS).order('updated_at', { ascending: false })
  if (error) fail('학습 설계', error)
  return ((data ?? []) as Row[]).map(toDesign)
}

export interface DesignLinkView {
  role: DesignRole
  item: ItemRef
}

export interface Deployment {
  id: string
  designId: string
  designVersion: number
  startedAt: string
  startedBy: string
  endedAt: string | null
  endedBy: string | null
  endReason: string | null
  snapshot: Record<string, unknown>
}

function toDeployment(r: Row): Deployment {
  return {
    id: String(r.id),
    designId: String(r.design_id),
    designVersion: Number(r.design_version),
    startedAt: String(r.started_at),
    startedBy: String(r.started_by),
    endedAt: (r.ended_at as string | null) ?? null,
    endedBy: (r.ended_by as string | null) ?? null,
    endReason: (r.end_reason as string | null) ?? null,
    snapshot: (r.snapshot as Record<string, unknown>) ?? {},
  }
}

export async function listDeployments(designId?: string): Promise<Deployment[]> {
  let q = db().from('knowledge_deployments').select('*').order('started_at', { ascending: false })
  if (designId) q = q.eq('design_id', designId)
  const { data, error } = await q
  if (error) fail('배포', error)
  return ((data ?? []) as Row[]).map(toDeployment)
}

async function designLinks(designId: string): Promise<DesignLinkView[]> {
  const { data, error } = await db().from('knowledge_design_items').select('item_id,role').eq('design_id', designId)
  if (error) fail('설계 연결', error)
  const rows = (data ?? []) as Row[]
  const items = await listItemRefs(rows.map((r) => String(r.item_id)))
  const byId = new Map(items.map((i) => [i.id, i]))
  return rows
    .filter((r) => isDesignRole(r.role) && byId.has(String(r.item_id)))
    .map((r) => ({ role: r.role as DesignRole, item: byId.get(String(r.item_id))! }))
}

/** 수행 기록(관리자 집계용) — user_id 는 집계 키로만 쓰고 화면에 내보내지 않는다. */
export interface RunRow extends RunRecord {
  preview: boolean
  synthetic: boolean
  deploymentId: string | null
}

export async function listRuns(designId: string): Promise<RunRow[]> {
  const out: Row[] = []
  let after: string | null = null
  for (;;) {
    let q = db()
      .from('knowledge_task_runs')
      .select('id,user_id,item_id,phase,claim_hit,option_correct,created_at,design_version,preview,synthetic,deployment_id')
      .eq('design_id', designId)
      .order('id')
      .limit(PAGE)
    if (after) q = q.gt('id', after)
    const { data, error } = await q
    if (error) fail('수행 기록', error)
    const rows = (data ?? []) as Row[]
    out.push(...rows)
    if (rows.length < PAGE) break
    after = String(rows[rows.length - 1]!.id)
  }
  return out.map((r) => ({
    userId: String(r.user_id),
    itemId: String(r.item_id),
    phase: r.phase === 'transfer' ? 'transfer' : 'train',
    claimHit: (r.claim_hit as boolean | null) ?? null,
    optionCorrect: (r.option_correct as boolean | null) ?? null,
    at: Date.parse(String(r.created_at)),
    designVersion: Number(r.design_version),
    preview: r.preview === true,
    synthetic: r.synthetic === true,
    deploymentId: (r.deployment_id as string | null) ?? null,
  }))
}

export interface ValidationRun {
  id: string
  designVersion: number
  synthetic: boolean
  nLearners: number
  nRuns: number
  metrics: ProtocolResult['metrics'] & { caveats?: string[] }
  verdict: Verdict
  note: string | null
  computedBy: string
  computedAt: string
}

export async function listValidationRuns(designId?: string): Promise<(ValidationRun & { designId: string })[]> {
  let q = db().from('knowledge_validation_runs').select('*').order('computed_at', { ascending: false })
  if (designId) q = q.eq('design_id', designId)
  const { data, error } = await q
  if (error) fail('검증 실행', error)
  return ((data ?? []) as Row[]).map((r) => ({
    id: String(r.id),
    designId: String(r.design_id),
    designVersion: Number(r.design_version),
    synthetic: r.synthetic === true,
    nLearners: Number(r.n_learners),
    nRuns: Number(r.n_runs),
    metrics: r.metrics as ValidationRun['metrics'],
    verdict: r.verdict as Verdict,
    note: (r.note as string | null) ?? null,
    computedBy: String(r.computed_by),
    computedAt: String(r.computed_at),
  }))
}

/** 실학습 기록만, 지정 버전만 — 미리보기·합성은 효과 계산에 넣지 않는다. */
export function protocolFor(runs: readonly RunRow[], version: number, assessment: Record<string, unknown>, synthetic = false) {
  const pick = runs.filter((r) => r.designVersion === version && !r.preview && r.synthetic === synthetic)
  return evaluateProtocol(pick, parseThresholds(assessment))
}

export async function loadDesignDetail(slug: string) {
  const { data, error } = await db().from('knowledge_designs').select(DESIGN_COLS).eq('slug', slug).maybeSingle()
  if (error) fail('학습 설계', error)
  if (!data) return null
  const design = toDesign(data as Row)
  const [links, deployments, runs, validations, allItems] = await Promise.all([
    designLinks(design.id),
    listDeployments(design.id),
    listRuns(design.id),
    listValidationRuns(design.id),
    listItemRefs(),
  ])
  const readiness: Readiness = checkDeployReadiness(
    links.map((l) => ({ role: l.role, layer: l.item.layer, status: l.item.status, slug: l.item.slug })),
  )
  const evidence = await evidenceRows(links.map((l) => l.item.id))
  let inquiry: Inquiry | null = null
  if (design.inquiryId) {
    const { data: q, error: qe } = await db().from('knowledge_inquiries').select(INQ_COLS).eq('id', design.inquiryId).maybeSingle()
    if (qe) fail('탐구 질문', qe)
    inquiry = q ? toInquiry(q as Row) : null
  }
  return {
    design,
    links,
    readiness,
    evidence,
    deployments,
    inquiry,
    runCounts: {
      real: runs.filter((r) => !r.preview && !r.synthetic).length,
      preview: runs.filter((r) => r.preview).length,
      synthetic: runs.filter((r) => r.synthetic).length,
      learners: new Set(runs.filter((r) => !r.preview && !r.synthetic).map((r) => r.userId)).size,
    },
    liveProtocol: protocolFor(runs, design.version, design.assessment),
    validations,
    allItems,
  }
}

// ── 운영실 · 품질 ────────────────────────────────────────────────────
export interface OpsSummary {
  items: { layer: Layer; total: number; adopted: number; noEvidence: number; needsReview: number }[]
  principlesWithoutFacet: number
  evidenceByLevel: { level: ResearchLevel; n: number }[]
  evidenceTotal: number
  inquiries: Record<InquiryStatus, number>
  designs: Record<DesignStatus, number>
  openDeployments: number
  runs7d: { real: number; preview: number; synthetic: number }
  pausedByEvidence: { slug: string; title: string; reason: string | null }[]
  latestVerdicts: { designSlug: string; verdict: Verdict; synthetic: boolean; computedAt: string }[]
}

export async function loadOpsSummary(now: Date): Promise<OpsSummary> {
  const [items, ev, inquiries, designs, deployments, validations] = await Promise.all([
    listItemRefs(),
    evidenceCounts(),
    listInquiries(),
    listDesigns(),
    listDeployments(),
    listValidationRuns(),
  ])
  const layers: Layer[] = ['essence', 'principle', 'method', 'practice']
  const since = new Date(now.getTime() - 7 * 86_400_000).toISOString()
  // 행을 받지 않고 센다 — 행 상한(1,000)에 조용히 잘리지 않게. 셀 수 없으면 0 이 아니라 던진다.
  const countRuns = async (kind: 'real' | 'preview' | 'synthetic') => {
    let q = db().from('knowledge_task_runs').select('id', { count: 'exact', head: true }).gte('created_at', since)
    q = kind === 'real' ? q.eq('preview', false).eq('synthetic', false) : q.eq(kind, true)
    const { count, error } = await q
    if (error) fail('최근 수행', error)
    if (count === null) throw new Error('최근 수행 수를 세지 못했다')
    return count
  }
  const [realN, previewN, syntheticN] = await Promise.all([countRuns('real'), countRuns('preview'), countRuns('synthetic')])
  const inq = { open: 0, collecting: 0, synthesizing: 0, concluded: 0, parked: 0 } as Record<InquiryStatus, number>
  for (const q of inquiries) inq[q.status]++
  const des = { draft: 0, ready: 0, deployed: 0, paused: 0, retired: 0 } as Record<DesignStatus, number>
  for (const d of designs) des[d.status]++
  const slugById = new Map(designs.map((d) => [d.id, d.slug]))
  const seen = new Set<string>()
  const latestVerdicts: OpsSummary['latestVerdicts'] = []
  for (const v of validations) {
    if (seen.has(v.designId)) continue
    seen.add(v.designId)
    latestVerdicts.push({ designSlug: slugById.get(v.designId) ?? v.designId, verdict: v.verdict, synthetic: v.synthetic, computedAt: v.computedAt })
  }
  return {
    items: layers.map((layer) => {
      const xs = items.filter((i) => i.layer === layer)
      return {
        layer,
        total: xs.length,
        adopted: xs.filter((i) => i.status === 'adopted' || i.status === 'applied').length,
        noEvidence: xs.filter((i) => i.evidenceCount === 0).length,
        needsReview: xs.filter((i) => i.status === 'extracted' || i.status === 'in_review').length,
      }
    }),
    principlesWithoutFacet: items.filter((i) => i.layer === 'principle' && !i.facet).length,
    evidenceByLevel: [...ev.byLevel.entries()].map(([level, n]) => ({ level, n })).sort((a, b) => b.n - a.n),
    evidenceTotal: ev.total,
    inquiries: inq,
    designs: des,
    openDeployments: deployments.filter((d) => !d.endedAt).length,
    runs7d: { real: realN, preview: previewN, synthetic: syntheticN },
    pausedByEvidence: designs
      .filter((d) => d.status === 'paused' && (d.statusReason ?? '').startsWith('근거 변화'))
      .map((d) => ({ slug: d.slug, title: d.title, reason: d.statusReason })),
    latestVerdicts,
  }
}

export async function loadQuality() {
  const [designs, deployments, validations] = await Promise.all([listDesigns(), listDeployments(), listValidationRuns()])
  const rows = await Promise.all(
    designs
      .filter((d) => d.status !== 'draft')
      .map(async (d) => {
        const [links, runs] = await Promise.all([designLinks(d.id), listRuns(d.id)])
        const notAdopted = links.filter((l) => l.item.status !== 'adopted' && l.item.status !== 'applied')
        return {
          design: d,
          deployments: deployments.filter((x) => x.designId === d.id),
          latest: validations.find((v) => v.designId === d.id) ?? null,
          live: protocolFor(runs, d.version, d.assessment),
          realRuns: runs.filter((r) => !r.preview && !r.synthetic).length,
          previewRuns: runs.filter((r) => r.preview).length,
          syntheticRuns: runs.filter((r) => r.synthetic).length,
          /** 근거 변경 영향 — 지금 채택이 아닌 연결 항목 */
          notAdopted: notAdopted.map((l) => ({ slug: l.item.slug, title: l.item.title, status: l.item.status, role: l.role })),
        }
      }),
  )
  return rows
}

/** 지도(B) — 영역 × 층 관계와 노드 상세에 필요한 것. */
export async function loadMapGraph() {
  const [items, linksRes, designs] = await Promise.all([
    listItemRefs(),
    db().from('knowledge_links').select('from_id,to_id,kind'),
    listDesigns(),
  ])
  if (linksRes.error) fail('연결', linksRes.error)
  const links = ((linksRes.data ?? []) as Row[]).map((l) => ({ from: String(l.from_id), to: String(l.to_id), kind: String(l.kind) }))
  const designItems = await db().from('knowledge_design_items').select('design_id,item_id,role')
  if (designItems.error) fail('설계 연결', designItems.error)
  const designById = new Map(designs.map((d) => [d.id, d]))
  const designsByItem = new Map<string, { slug: string; title: string; status: DesignStatus }[]>()
  for (const r of (designItems.data ?? []) as Row[]) {
    const d = designById.get(String(r.design_id))
    if (!d) continue
    const xs = designsByItem.get(String(r.item_id)) ?? []
    xs.push({ slug: d.slug, title: d.title, status: d.status })
    designsByItem.set(String(r.item_id), xs)
  }
  const { data: skills, error } = await db().from('knowledge_items').select('id,skill_ids')
  if (error) fail('영역', error)
  const skillById = new Map(((skills ?? []) as Row[]).map((r) => [String(r.id), (r.skill_ids as string[]) ?? []]))
  return {
    nodes: items.map((i) => ({ ...i, skills: skillById.get(i.id) ?? [], designs: designsByItem.get(i.id) ?? [] })),
    links,
  }
}

export async function loadEvidenceForItem(itemId: string) {
  return evidenceRows([itemId])
}
