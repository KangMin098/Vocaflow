// scripts/audit/csat-sources-audit.mjs
// Read-only audit of every source row; never modifies DB or UI snapshots.
// pnpm exec tsx scripts/audit/csat-sources-audit.mjs [--item-refs <json>] [--check]
// --item-refs accepts SELECT DISTINCT ref_id WHERE kind='article' as a UUID array.
// Reports contain row IDs and metadata, not bodies, credentials or DB URLs.
import fs from 'node:fs'
import path from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { evaluateSource as judgeSource, tallyEligibility, isComposable, ELIGIBILITY_SPEC_VERSION } from '../../packages/library-pipeline/src/textbook/source-eligibility.ts'
import { cefrFitsBand } from '../../packages/library-pipeline/src/textbook/assemble-unit.ts'
import { decide, retentionOf, HARMFUL, UNFIT } from '../csat/gate-rules.mjs'
import { retryingFetch } from '../lib/supabase-client.mjs'
import { compositionContradictions, auditFailures } from './csat-sources-checks.mjs'
import { sourceEligibilityInput } from '../../packages/library-pipeline/src/textbook/source-eligibility-row.ts'
import { discoverWork, addWork } from './csat-source-work.mjs'

const option = (name) => {
  const index = process.argv.indexOf(`--${name}`)
  if (index < 0) return null
  const value = process.argv[index + 1]
  if (!value || value.startsWith('--')) throw new Error(`Missing --${name} value`)
  return value
}
const envFile = 'apps/web/.env.local'
for (const line of (fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : '').split(/\r?\n/)) {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '')
}
const origin = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!origin || !key) throw new Error('Missing Supabase environment')
const fetchRead = retryingFetch()
async function* walk(table, select, filter = {}, cursorKey = 'id') {
  let cursor = null
  for (;;) {
    const qs = new URLSearchParams({ select, ...filter, order: `${cursorKey}.asc`, limit: '1000' })
    if (cursor) qs.set(cursorKey, `gt.${cursor}`)
    const response = await fetchRead(`${origin}/rest/v1/${table}?${qs}`, {
      method: 'GET', headers: { apikey: key, Authorization: `Bearer ${key}` },
    })
    if (!response.ok) throw new Error(`${table}: HTTP ${response.status}`)
    const rows = await response.json()
    if (!Array.isArray(rows)) throw new Error(`${table}: expected array`)
    if (!rows.length) return
    yield rows
    const next = rows.at(-1)[cursorKey]
    if (!next || (cursor && next <= cursor)) throw new Error(`${table}: cursor did not advance`)
    cursor = next
    if (rows.length < 1000) return
  }
}

const startedAt = new Date().toISOString()
const refFile = option('item-refs')
const refs = new Set()
if (refFile) {
  const values = JSON.parse(fs.readFileSync(refFile, 'utf8'))
  if (!Array.isArray(values) || values.some(v => typeof v !== 'string' || !/^[0-9a-f-]{36}$/i.test(v))) throw new Error('Invalid item reference list')
  for (const id of values) refs.add(id)
} else {
  for await (const rows of walk('csat_dcp_items', 'ref_id', { kind: 'eq.article' }, 'ref_id')) {
    for (const row of rows) refs.add(row.ref_id)
  }
}
const findings = {}
const policyCache = new Map()
for await (const rows of walk('csat_source_eligibility', 'article_id,source_updated_at,policy_version,input,result,quality_flags,linked_items', {}, 'article_id')) {
  for (const row of rows) policyCache.set(row.article_id, row)
}
function flag(code, row, detail) {
  const group = findings[code] ??= { count: 0, candidates: 0, bySource: {}, rows: [] }
  group.count++
  if (['ready', 'published'].includes(row.status)) group.candidates++
  group.bySource[row.source] = (group.bySource[row.source] ?? 0) + 1
  group.rows.push({ id: row.id, source: row.source, status: row.status, title: row.title, detail })
}
const states = {}, sources = {}, grades = [], articleIds = new Set(), hashes = new Map()
const withItemsByGrade = {}, byBand = {}, gates = {}
const work = {}, reasonCounts = {}, analysisStates = {}, contentStates = {}, cefrStates = {}
// 보관 축은 **확보한 전량**을 센다 — 조판 후보(ready/published)만 세면 archived·queued 가
// 집계 밖으로 빠져 「전량에 보관 판정이 있는가」라는 물음에 답하지 못한다.
const retention = {}, retentionUndecided = {}
let total = 0, composableWithItems = 0, composableWithoutItems = 0
const select = 'id,title,source,status,updated_at,source_url,content_hash,language,article_v_level,word_count,register,cefr_level,license_class,display_only,copyright_safe_in_kr,syntax_score,gate:csat_fit->gate,windows:csat_fit->make->windows'
for await (const rows of walk('library_articles', select)) {
  for (const row of rows) {
    total++
    articleIds.add(row.id)
    states[row.status] = (states[row.status] ?? 0) + 1
    sources[row.source] = (sources[row.source] ?? 0) + 1
    const candidate = ['ready', 'published'].includes(row.status)
    const gate = row.gate ?? {}
    gates[String(gate.verdict ?? '(none)')] = (gates[String(gate.verdict ?? '(none)')] ?? 0) + 1
    const keepState = retentionOf({ purpose: gate.purpose, verdict: gate.verdict, retain: gate.retain?.verdict })
    retention[keepState] = (retention[keepState] ?? 0) + 1
    // undecided 는 출처별로 쪼개 둔다 — 합계만 보면 어느 파이프라인이 구멍인지 알 수 없다.
    if (keepState === 'undecided') retentionUndecided[`${row.source}/${row.status}`] = (retentionUndecided[`${row.source}/${row.status}`] ?? 0) + 1
    if (row.content_hash) {
      const ids = hashes.get(row.content_hash) ?? []
      ids.push({ id: row.id, source: row.source, status: row.status })
      hashes.set(row.content_hash, ids)
    }
    if (!row.source_url && row.source !== 'original') flag('external_source_url_missing', row, null)
    if (!row.license_class) flag('license_class_missing', row, null)
    if (row.license_class && row.display_only !== true && row.copyright_safe_in_kr !== false) {
      // Match the legal judge below rather than maintain a second license policy.
      const legal = judgeSource({ licenseClass: row.license_class })
      if (legal.blockedBy === 'legal') flag('inventory_legal_undercount', row, row.license_class)
    }
    if (gate.verdict && (HARMFUL.has(gate.genre) || UNFIT.has(gate.genre)) && gate.verdict !== 'reject') flag('verdict_genre_conflict', row, `${gate.verdict}/${gate.genre}`)
    if (typeof gate.publishable === 'boolean' && Array.isArray(gate.codes) && gate.purpose) {
      const expected = decide({ purpose: gate.purpose, verdict: gate.verdict, genre: gate.genre, codes: gate.codes })
      if (expected.publishable !== gate.publishable) flag('gate_decision_drift', row, { stored: gate.publishable, expected: expected.publishable, reason: expected.blockedBy })
    }
    if (!candidate) continue
    const input = sourceEligibilityInput(row, refs.has(row.id))
    const result = judgeSource(input)
    const cached = policyCache.get(row.id)
    let cacheDrift = !cached
    if (!cached) flag('cache_missing', row, null)
    else {
      if (Date.parse(cached.source_updated_at) !== Date.parse(row.updated_at) || cached.policy_version !== ELIGIBILITY_SPEC_VERSION) { cacheDrift = true; flag('cache_stale', row, { cached: cached.source_updated_at, current: row.updated_at }) }
      if (cached.result.grade !== result.grade) { cacheDrift = true; flag('cache_grade_drift', row, { cached: cached.result.grade, current: result.grade }) }
      if (!isDeepStrictEqual(cached.input, input) || !isDeepStrictEqual(cached.result, result)) { cacheDrift = true; flag('cache_contract_drift', row, { inputChanged: !isDeepStrictEqual(cached.input, input), resultChanged: !isDeepStrictEqual(cached.result, result) }) }
    }
    for (const code of result.blockers) reasonCounts[code] = (reasonCounts[code] ?? 0) + 1
    for (const [counts, value] of [[analysisStates, result.analysisStatus], [contentStates, result.contentStatus], [cefrStates, result.cefrStatus]]) counts[value] = (counts[value] ?? 0) + 1
    for (const key of discoverWork(row, result, cached, cacheDrift)) addWork(work, key, row, result, cached)
    if (result.grade === 'unknown') flag('analysis_incomplete', row, result.reason)
    grades.push(result)
    const band = String(row.article_v_level ?? '(none)')
    const bucket = byBand[band] ??= {}
    bucket[result.grade] = (bucket[result.grade] ?? 0) + 1
    if (refs.has(row.id)) withItemsByGrade[result.grade] = (withItemsByGrade[result.grade] ?? 0) + 1
    if (!isComposable(result.grade)) continue
    if (refs.has(row.id)) composableWithItems++
    else composableWithoutItems++
    for (const code of compositionContradictions(gate, result.grade)) flag(code, row, { grade: result.grade, gate })
    if (!cefrFitsBand(row.cefr_level, row.article_v_level)) flag('cefr_composer_exclusion', row, { grade: result.grade, cefr: row.cefr_level, band: row.article_v_level, hasItems: refs.has(row.id) })
    if (!Number.isFinite(input.syntaxScore) || !Number.isInteger(row.article_v_level) || row.article_v_level < 0 || row.article_v_level > 11 || !['A1','A2','B1','B2','C1','C2'].includes(row.cefr_level)) flag('invalid_analysis_composable', row, input)
    if (gate.publishable == null) flag('gate_missing_composable', row, { grade: result.grade, gate })
    if (result.grade === 'excerpt' && !refs.has(row.id)) flag('windows_without_items_composable', row, { windows: input.excerptWindows })
  }
  process.stderr.write(`metadata ${total}\n`)
}
const snap = JSON.parse(fs.readFileSync('apps/web/src/lib/textbook/source-eligibility-snapshot.json', 'utf8'))
const inventory = JSON.parse(fs.readFileSync('apps/web/src/lib/textbook/source-inventory-snapshot.json', 'utf8'))
const tally = tallyEligibility(grades)
const report = {
  startedAt, completedAt: new Date().toISOString(), readOnly: true,
  scope: 'All library_articles metadata; eligibility only ready/published; bodies audited separately',
  // 보관 여부(파생 — 저장하지 않는다). `keep-pending-extraction` 은 purpose:'raw' 클래스 규칙이고,
  // `undecided` 가 0이 아니면 그만큼이 **보관 판정 없이 쌓여 있는** 원문이다.
  retention, retentionUndecided,
  itemReferenceInput: refFile ? 'External SQL distinct reference list (not a transactional snapshot)' : 'Live paginated distinct reference scan (not a transactional snapshot)',
  total, states, sources, gateVerdicts: gates, eligibility: tally, byBand,
  itemReferences: refs.size, orphanItemReferences: [...refs].filter(id => !articleIds.has(id)),
  withItemsByGrade, composableWithItems, composableWithoutItems,
  analysisStates, contentStates, cefrStates, reasonCounts, work,
  workSemantics: 'Overlapping candidate sets, not automatic approvals. Linked item counts are cached observations; live item references are independently scanned. Complete analysis is not readiness; assignment and historical use are not inferred.',
  snapshot: { measuredAt: snap.measuredAt, inventoryMeasuredAt: inventory.measuredAt,
    specStale: snap.specVersion !== ELIGIBILITY_SPEC_VERSION,
    inventoryDelta: total - inventory.scanned, candidateDelta: tally.total - snap.total.total,
    gradeDelta: Object.fromEntries(Object.entries(tally.byGrade).map(([g,n]) => [g,n - snap.total.byGrade[g]])) },
  duplicateHashes: [...hashes.values()].filter(rows => rows.length > 1), findings,
}
const output = path.resolve(option('output') ?? '.agent-logs/csat-sources-audit.json')
fs.mkdirSync(path.dirname(output), { recursive: true })
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ ...report, work: Object.fromEntries(Object.entries(work).map(([k,{ids,...v}]) => [k,v])), duplicateHashes: report.duplicateHashes.length, findings: Object.fromEntries(Object.entries(findings).map(([code,f]) => [code,{count:f.count,candidates:f.candidates,bySource:f.bySource}])) }, null, 2))
console.log(`Report: ${output}`)
if (process.argv.includes('--check') && auditFailures(report).length) process.exitCode = 1
