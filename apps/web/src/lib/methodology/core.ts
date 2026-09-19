// apps/web/src/lib/methodology/core.ts
import type { KnowledgeBundle, Method, Source } from './types'
import { claimKinds } from './types'

type Row = Record<string, unknown>
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(text) && new Set(v).size === v.length
const date = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v
const member = (v: unknown, values: readonly unknown[]) => values.includes(v)
export function safeUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password } catch { return false }
}

/** Strict ingestion boundary. Reject unknown keys so full transcripts cannot hitchhike in JSON. */
export function validateBundle(input: unknown): string[] {
  const errors: string[] = []
  const check = (ok: unknown, path: string, rule: string) => { if (!ok) errors.push(`${path}: ${rule}`) }
  const object = (v: unknown, path: string, keys: string[]): Row => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) { errors.push(`${path}: object required`); return {} }
    const row = v as Row
    for (const k of Object.keys(row)) check(keys.includes(k), `${path}.${k}`, 'unknown field')
    for (const k of keys) check(k in row, `${path}.${k}`, 'required')
    return row
  }
  const keys = {
    experts: 'id name organization specialties profileSourceIds researchStatus verifiedAt',
    channels: 'id name url expertIds relationship verificationSourceIds verifiedAt',
    sources: 'id title url kind expertIds channelId originGroup publishedAt verifiedAt revision access rights rightsBasis durationSeconds taxonomyIds priority priorityReason',
    methods: 'id statement taxonomyIds review reviewedBy reviewedAt efficacy productApplications',
    claims: 'id methodId kind text ordinal attribution',
    evidence: 'id claimId sourceId sourceRevision expertIds locator stance note',
    relations: 'id fromId toId kind reason evidenceIds review',
    taxonomy: 'id label dimension parentId',
    gaps: 'id taxonomyIds question nextAction',
  }
  const root = object(input, '$', ['schemaVersion', 'verifiedAt', ...Object.keys(keys)])
  check(root.schemaVersion === 1, '$.schemaVersion', 'unsupported version')
  check(date(root.verifiedAt), '$.verifiedAt', 'ISO date required')
  const lists: Record<string, Row[]> = {}
  const maps: Record<string, Map<string, Row>> = {}
  for (const [table, fields] of Object.entries(keys)) {
    const array = root[table]
    check(Array.isArray(array), table, 'array required')
    lists[table] = (Array.isArray(array) ? array : []).map((v, i) => object(v, `${table}[${i}]`, fields.split(' ')))
    maps[table] = new Map()
    for (const r of lists[table]) {
      check(typeof r.id === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$/.test(r.id), table, 'safe id required')
      check(!maps[table].has(String(r.id)), `${table}.${r.id}`, 'duplicate id')
      maps[table].set(String(r.id), r)
    }
  }
  const ref = (id: unknown, table: string, path: string) => check(typeof id === 'string' && maps[table].has(id), path, `missing ${table} reference`)
  const refs = (ids: unknown, table: string, path: string, required = false) => {
    check(strings(ids) && (!required || ids.length > 0), path, 'unique reference array required')
    if (Array.isArray(ids)) ids.forEach(id => ref(id, table, path))
  }
  for (const [table, rows] of Object.entries(lists)) for (const r of rows) {
    const p = `${table}.${r.id}`
    for (const field of ['name', 'title', 'statement', 'text', 'label', 'question', 'nextAction', 'reason', 'originGroup', 'revision', 'rightsBasis', 'priorityReason']) {
      if (field in r) check(text(r[field]) && String(r[field]).length <= 1500, `${p}.${field}`, 'nonempty text <=1500 required')
    }
    if ('verifiedAt' in r) check(date(r.verifiedAt), p, 'verifiedAt ISO date required')
    if ('url' in r) check(safeUrl(r.url), p, 'HTTPS URL without credentials required')
    if ('taxonomyIds' in r) refs(r.taxonomyIds, 'taxonomy', p)
    if ('expertIds' in r) refs(r.expertIds, 'experts', p)
    if ('review' in r) check(member(r.review, ['extracted', 'reviewed', 'rejected']), p, 'invalid review')
  }
  for (const r of lists.experts) {
    refs(r.profileSourceIds, 'sources', `expert.${r.id}`, true)
    check(text(r.organization) && strings(r.specialties), `expert.${r.id}`, 'organization and specialties required')
    check(member(r.researchStatus, ['candidate', 'profile_verified']), `expert.${r.id}`, 'invalid research status')
    for (const id of Array.isArray(r.profileSourceIds) ? r.profileSourceIds : []) {
      const s = maps.sources.get(String(id))
      check(Array.isArray(s?.expertIds) && s.expertIds.includes(r.id), `expert.${r.id}`, 'profile source must identify expert')
      if (r.researchStatus === 'profile_verified') check(s?.access === 'document_read', `expert.${r.id}`, 'verified profile requires read document')
    }
  }
  for (const r of lists.channels) {
    refs(r.verificationSourceIds, 'sources', `channel.${r.id}`, true)
    check(member(r.relationship, ['personal', 'platform', 'institution', 'guest', 'reupload', 'fan']), `channel.${r.id}`, 'invalid relationship')
  }
  for (const r of lists.sources) {
    const p = `source.${r.id}`
    check(member(r.kind, ['document', 'video']), p, 'invalid kind')
    check(member(r.access, ['metadata_only', 'document_read', 'transcript_read', 'unavailable']), p, 'invalid access')
    check(member(r.rights, ['link_only', 'analysis_permitted']), p, 'invalid rights')
    check(member(r.priority, ['high', 'normal', 'low']), p, 'invalid priority')
    check(r.publishedAt === null || date(r.publishedAt), p, 'invalid publication date')
    check(r.durationSeconds === null || (typeof r.durationSeconds === 'number' && Number.isFinite(r.durationSeconds) && r.durationSeconds > 0), p, 'invalid duration')
    if (r.channelId !== null) ref(r.channelId, 'channels', p)
    if (r.access === 'transcript_read') check(r.kind === 'video' && r.rights === 'analysis_permitted' && /^sha256:[a-f0-9]{64}$/.test(String(r.revision)), p, 'transcript needs permission and SHA256 revision')
    if (r.access === 'document_read') check(r.kind === 'document', p, 'document kind required')
  }
  for (const r of lists.taxonomy) {
    check(member(r.dimension, ['age', 'proficiency', 'exam', 'skill', 'process', 'question']), `taxon.${r.id}`, 'invalid dimension')
    const seen = new Set([r.id]); let node = r
    while (node.parentId !== null && node.parentId !== undefined) {
      ref(node.parentId, 'taxonomy', `taxon.${r.id}`)
      if (seen.has(node.parentId)) { errors.push(`taxon.${r.id}: cycle`); break }
      seen.add(node.parentId)
      const parent = maps.taxonomy.get(String(node.parentId)); if (!parent) break
      check(parent.dimension === r.dimension, `taxon.${r.id}`, 'parent dimension mismatch'); node = parent
    }
  }
  for (const r of lists.methods) {
    const p = `method.${r.id}`
    check(r.efficacy === 'not_assessed', p, 'efficacy cannot be inferred from consensus')
    check(strings(r.productApplications), p, 'applications array required')
    check(r.reviewedBy === null || text(r.reviewedBy), p, 'invalid reviewer')
    check(r.reviewedAt === null || date(r.reviewedAt), p, 'invalid review date')
    if (r.review === 'reviewed') check(text(r.reviewedBy) && date(r.reviewedAt), p, 'review audit required')
    if (Array.isArray(r.productApplications) && r.productApplications.length) check(r.review === 'reviewed', p, 'product application needs review')
    check(lists.claims.some(c => c.methodId === r.id && c.kind === 'principle' && c.text === r.statement && c.attribution === 'source_explicit'), p, 'canonical statement must equal an explicit principle claim')
  }
  const ordinals = new Set<string>()
  for (const r of lists.claims) {
    const p = `claim.${r.id}`; ref(r.methodId, 'methods', p)
    check(member(r.kind, claimKinds), p, 'invalid kind')
    check(member(r.attribution, ['source_explicit', 'analyst_inference']), p, 'invalid attribution')
    check(Number.isInteger(r.ordinal) && Number(r.ordinal) >= 0, p, 'nonnegative ordinal required')
    const key = `${r.methodId}:${r.kind}:${r.ordinal}`
    check(!ordinals.has(key), p, 'duplicate ordinal'); ordinals.add(key)
    check(lists.evidence.some(e => e.claimId === r.id && e.stance === 'supports'), p, 'supporting evidence required')
  }
  for (const r of lists.evidence) {
    const p = `evidence.${r.id}`; ref(r.claimId, 'claims', p); ref(r.sourceId, 'sources', p)
    const s = maps.sources.get(String(r.sourceId))
    check(s && member(s.access, ['document_read', 'transcript_read']), p, 'metadata is not claim evidence')
    check(s?.revision === r.sourceRevision, p, 'stale source revision')
    check(member(r.stance, ['supports', 'qualifies', 'opposes']), p, 'invalid stance')
    check(typeof r.note === 'string' && r.note.length <= 800, p, 'note <=800 required')
    for (const id of Array.isArray(r.expertIds) ? r.expertIds : []) check(Array.isArray(s?.expertIds) && s.expertIds.includes(id), p, 'expert not attributed by source')
    const kind = (r.locator as Row | null)?.kind
    const l = object(r.locator, `${p}.locator`, kind === 'time' ? ['kind', 'start', 'end'] : ['kind', 'section'])
    if (kind === 'time') {
      check(s?.access === 'transcript_read', p, 'time evidence requires read transcript')
      check(typeof l.start === 'number' && Number.isFinite(l.start) && l.start >= 0 && typeof l.end === 'number' && Number.isFinite(l.end) && l.end > l.start && typeof s?.durationSeconds === 'number' && l.end <= s.durationSeconds, p, 'time interval outside video')
    } else check(kind === 'section' && s?.access === 'document_read' && text(l.section) && l.section.length <= 300, p, 'read document section required')
  }
  for (const r of lists.relations) {
    ref(r.fromId, 'methods', `relation.${r.id}`); ref(r.toId, 'methods', `relation.${r.id}`)
    check(r.fromId !== r.toId, `relation.${r.id}`, 'self relation')
    check(member(r.kind, ['equivalent_candidate', 'contradicts', 'context_differs', 'complements']), `relation.${r.id}`, 'invalid kind')
    refs(r.evidenceIds, 'evidence', `relation.${r.id}`, true)
    for (const methodId of [r.fromId, r.toId]) check(Array.isArray(r.evidenceIds) && r.evidenceIds.some(id => maps.claims.get(String(maps.evidence.get(String(id))?.claimId))?.methodId === methodId), `relation.${r.id}`, 'relation needs evidence for both methods')
  }
  return errors
}

export function assertBundle(input: unknown): asserts input is KnowledgeBundle {
  const errors = validateBundle(input)
  if (errors.length) throw new Error(errors.join('\n'))
}
export function evidenceUrl(source: Source, start?: number): string {
  if (!safeUrl(source.url)) throw new Error('Unsafe source URL')
  const url = new URL(source.url)
  if (start !== undefined && source.kind === 'video' && /(^|\.)youtube\.com$|^youtu\.be$/.test(url.hostname)) url.searchParams.set('t', `${Math.floor(start)}s`)
  return url.href
}
export function compareMethods(bundle: KnowledgeBundle, ids: string[]) {
  return [...new Set(ids)].map(id => {
    const method = bundle.methods.find(m => m.id === id)
    if (!method) throw new Error(`Unknown method: ${id}`)
    const claims = bundle.claims.filter(c => c.methodId === id).sort((a, b) => a.ordinal - b.ordinal)
    const evidence = bundle.evidence.filter(e => claims.some(c => c.id === e.claimId))
    // Count agreement only on the explicit canonical principle, not supporting side claims.
    const principleIds = new Set(claims.filter(c => c.kind === 'principle' && c.attribution === 'source_explicit').map(c => c.id))
    const support = evidence.filter(e => e.stance === 'supports' && principleIds.has(e.claimId))
    const originGroups = [...new Set(support.map(e => bundle.sources.find(s => s.id === e.sourceId)!.originGroup))]
    const expertIds = [...new Set(support.flatMap(e => e.expertIds))]
    return { method, claims, evidence, consensus: { expertIds, originGroups, independentlyRepeated: expertIds.length > 1 && originGroups.length > 1, efficacy: method.efficacy }, relations: bundle.relations.filter(r => r.fromId === id || r.toId === id) }
  })
}
export function researchCoverage(bundle: KnowledgeBundle) {
  const descendants = (id: string): string[] => [id, ...bundle.taxonomy.filter(t => t.parentId === id).flatMap(t => descendants(t.id))]
  return bundle.taxonomy.filter(t => t.dimension === 'skill' && !t.parentId).flatMap(skill => {
    const skillIds = new Set(descendants(skill.id))
    return bundle.taxonomy.filter(t => t.dimension === 'age').map(age => {
      const matches = (ids: string[]) => ids.includes(age.id) && ids.some(id => skillIds.has(id))
      const sources = bundle.sources.filter(s => matches(s.taxonomyIds))
      const methods = bundle.methods.filter(m => m.review !== 'rejected' && matches(m.taxonomyIds))
      return { skillId: skill.id, ageId: age.id, indexed: sources.length, read: sources.filter(s => s.access === 'document_read' || s.access === 'transcript_read').length, extracted: methods.length, reviewed: methods.filter(m => m.review === 'reviewed').length, gapIds: bundle.gaps.filter(g => matches(g.taxonomyIds)).map(g => g.id) }
    })
  })
}
/** Lexical candidates are a review queue, never semantic equivalence or an automatic merge. */
export function duplicateCandidates(methods: Method[]) {
  const grams = (s: string) => { const t = s.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''); return new Set(Array.from({ length: Math.max(0, t.length - 1) }, (_, i) => t.slice(i, i + 2))) }
  const result: { left: string; right: string; similarity: number; contextMatches: boolean }[] = []
  for (let i = 0; i < methods.length; i++) for (let j = i + 1; j < methods.length; j++) {
    const a = grams(methods[i].statement), b = grams(methods[j].statement)
    const overlap = [...a].filter(g => b.has(g)).length
    const union = new Set([...a, ...b]).size; const similarity = union ? overlap / union : 0
    if (similarity >= 0.35) result.push({ left: methods[i].id, right: methods[j].id, similarity, contextMatches: [...methods[i].taxonomyIds].sort().join('|') === [...methods[j].taxonomyIds].sort().join('|') })
  }
  return result.sort((a, b) => b.similarity - a.similarity)
}
