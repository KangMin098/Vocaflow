// scripts/acp/import-corpus-pilot.mjs
// Reviewed four-story pilot only. Default dry-run; --commit enqueues, never publishes.
// pnpm exec tsx scripts/acp/import-corpus-pilot.mjs [--commit]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { createClient } from '@supabase/supabase-js'
import { normalizePunctuation, reflowSoftHyphens } from '../../packages/library-pipeline/src/normalize/index.ts'
import { evaluateSource } from '../../packages/library-pipeline/src/textbook/source-eligibility.ts'
import { decide, hardReject, RULES_VERSION, CODES_VERSION } from '../csat/gate-rules.mjs'
import { normalizedTextHash } from '../lib/corpus-dedup.mjs'
import { SYNTAX_PROBES, repositorySyntaxProbe, mapPurposes } from '../audit/csat-corpus-pilot-analyze.mjs'

export const PILOT_IDS = ['0136', '0216', '0335', '0342'].map(id => `african_storybook:${id}`)
const ALLOWED = new Set(PILOT_IDS)
const MAX_AGE = 24 * 60 * 60 * 1000
const SHA = /^[a-f0-9]{64}$/
const hash = text => createHash('sha256').update(text).digest('hex')
const bodyOf = text => reflowSoftHyphens(normalizePunctuation(text), { joinHyphenLineBreaks: false })

export function assertFresh(value, now, label) {
  const at = Date.parse(value), current = Date.parse(now)
  if (!Number.isFinite(at) || !Number.isFinite(current) || at > current || current - at > MAX_AGE) {
    throw new Error(`${label} is invalid, future-dated, or older than 24 hours`)
  }
}

function uniqueMap(rows, label) {
  if (!Array.isArray(rows)) throw new Error(`${label} must be an array`)
  const result = new Map()
  for (const row of rows) {
    if (!row.source_id || result.has(row.source_id)) throw new Error(`${label} duplicate or missing source_id`)
    result.set(row.source_id, row)
  }
  return result
}

/** Validate revisions before filtering: stale evidence must never silently become a skip. */
export function validateBundle(bundle, now) {
  for (const key of ['articles', 'analysis', 'review', 'dedup']) {
    const evidence = bundle.files?.[key]
    if (!evidence || !SHA.test(evidence.sha256)) throw new Error(`Missing ${key} file evidence`)
    assertFresh(evidence.modifiedAt, now, `${key} file`)
  }
  assertFresh(bundle.analysis.measuredAt, now, 'Analysis')
  assertFresh(bundle.dedup.measuredAt, now, 'Duplicate audit')
  if (bundle.analysis.readOnly !== true || bundle.dedup.readOnly !== true) throw new Error('Expected read-only audit evidence')
  const articles = uniqueMap(bundle.articles, 'Articles')
  const analysis = uniqueMap(bundle.analysis.rows, 'Analysis')
  const review = uniqueMap(bundle.reviews, 'Review')
  const dedup = uniqueMap(bundle.dedup.results, 'Duplicate audit')
  if (articles.size !== analysis.size || articles.size !== dedup.size) throw new Error('Audit coverage mismatch')
  for (const [id, article] of articles) {
    if (!SHA.test(article.content_hash) || hash(article.content) !== article.content_hash) throw new Error(`Body hash mismatch: ${id}`)
    assertFresh(article.fetched_at, now, `Fetch ${id}`)
    if (analysis.get(id)?.contentHash !== article.content_hash || dedup.get(id)?.contentHash !== article.content_hash) {
      throw new Error(`Stale analysis or duplicate evidence: ${id}`)
    }
    if (analysis.get(id).normalizedContentHash !== hash(bodyOf(article.content)) ||
      dedup.get(id).normalizedHash !== normalizedTextHash(article.content)) throw new Error(`Normalization evidence mismatch: ${id}`)
    if (article.source === 'african_storybook') {
      if (review.get(id)?.contentHash !== article.content_hash ||
        !isDeepStrictEqual(analysis.get(id).contentReview, review.get(id))) throw new Error(`Stale review evidence: ${id}`)
    }
  }
  for (const id of review.keys()) if (!articles.has(id)) throw new Error(`Unknown reviewed source: ${id}`)
  return { articles, analysis, review, dedup }
}

export function preparePilotRow({ article, review, analysis, files, now }) {
  const commit = article.metadata?.commit
  const shortId = article.source_id?.split(':')[1]
  const licenseVersion = article.license?.match(/^CC-BY-([34]\.0)$/)?.[1]
  if (article.source !== 'african_storybook' || !ALLOWED.has(article.source_id)) throw new Error('Source is outside the four-story pilot')
  if (!/^[a-f0-9]{40}$/.test(commit ?? '') || !article.author?.trim() || !SHA.test(article.raw_hash ?? '')) {
    throw new Error('Missing pinned commit, author, or raw hash')
  }
  const expectedPrefix = `https://github.com/global-asp/asp-source/blob/${commit}/en/${shortId}_`
  if (!article.source_url?.startsWith(expectedPrefix) || !article.source_url.endsWith('.md')) throw new Error('Unpinned source URL')
  const origin = new URL(article.origin_url)
  if (!['http:', 'https:'].includes(origin.protocol) || !['africanstorybook.org', 'www.africanstorybook.org'].includes(origin.hostname) || !origin.pathname.startsWith('/stories/')) {
    throw new Error('Unexpected original publisher URL')
  }
  if (!licenseVersion || article.license_url !== `https://creativecommons.org/licenses/by/${licenseVersion}/` || review.attributionVerified !== true) {
    throw new Error('Individual CC-BY attribution is not verified')
  }
  if (review.quality !== 'clean' || !['use', 'narrative'].includes(review.verdict)) throw new Error('Content review is not accepted and clean')
  const body = bodyOf(article.content)
  const codes = hardReject(body)
  const gate = decide({ purpose: 'csat', verdict: review.verdict, genre: review.genre, codes })
  const currentInput = { ...analysis.canonicalPreviewInput, title: article.title, status: 'ready',
    wordCount: body.match(/\b[a-zA-Z][a-zA-Z'-]*\b/g)?.length ?? 0,
    register: review.register, licenseClass: 'cc_by', copyrightSafeInKr: true, displayOnly: false,
    gatePurpose: 'csat', gateVerdict: review.verdict, gateGenre: review.genre,
    gatePublishable: gate.publishable, gateBlockedBy: gate.blockedBy,
    hasItems: false, excerptWindows: 0, outsidePct: null }
  if (currentInput.articleVLevel !== analysis.vrl?.p75 || currentInput.cefrLevel !== analysis.cefr?.level || currentInput.syntaxScore !== analysis.syntax?.score) {
    throw new Error('Inconsistent analysis metrics')
  }
  if (analysis.canonicalPreview?.status !== 'eligible' || evaluateSource(currentInput).status !== 'eligible' || !gate.publishable) {
    throw new Error('Canonical source preview is not eligible')
  }
  return {
    source: article.source, source_id: article.source_id, title: article.title, author: article.author,
    source_url: article.source_url, language: 'en', license: article.license, license_class: 'cc_by',
    source_fetched_at: article.fetched_at,
    copyright_safe_in_kr: true, display_only: false, content: article.content,
    status: 'queued', feed_id: 'reviewed-pilot', feed_label: 'Reviewed African Storybook pilot',
    // No fitted age, CEFR, V-Level, syntax, word-count or publication columns here.
    csat_fit: {
      gate: { ...gate, purpose: 'csat', verdict: review.verdict, genre: review.genre,
        codes, rv: RULES_VERSION, cv: CODES_VERSION, measuredAt: now },
      source_discovery: { version: 1, scope: 'four-story-reviewed-pilot',
        sourceId: article.source_id, originUrl: article.origin_url, pinnedCommit: commit,
        sourceUrl: article.source_url, author: article.author, license: article.license,
        licenseUrl: article.license_url, fetchedAt: article.fetched_at,
        rawHash: article.raw_hash, contentHash: article.content_hash,
        normalizedContentHash: hash(body), evidenceFiles: files,
        review: { verdict: review.verdict, genre: review.genre, register: review.register,
          topic: review.topic ?? null, ageFit: review.ageFit ?? [],
          ageFitBasis: 'manual content maturity recommendation, not linguistic difficulty',
          learningPurposes: mapPurposes(review.learningPurposes),
          quality: review.quality, reason: review.reason, attributionVerified: true },
        preparedAt: now },
    },
  }
}

export function verifyRawAttribution(article, raw, indexLine) {
  if (typeof raw !== 'string' || hash(raw) !== article.raw_hash) throw new Error(`Raw hash mismatch: ${article.source_id}`)
  const textAuthor = raw.match(/^\* Text:\s*(.+)$/m)?.[1]?.trim()
  const extracted = raw.split(/^\* License:/m)[0].replace(/^# [^\n]+\n/, '').replace(/^##\s*$/gm, '').replace(/\n{3,}/g, '\n\n').trim()
  if (textAuthor !== article.author || !/^\* License: \[CC-BY\]\s*$/m.test(raw) || extracted !== article.content ||
    !indexLine?.includes(`[CC-BY](${article.license_url})`) || !indexLine.includes(`(${article.origin_url})`)) {
    throw new Error(`Raw attribution or extraction mismatch: ${article.source_id}`)
  }
}

export function prepareRegistryProfile(existing, evidence, admitted, now) {
  if (!evidence?.candidate || evidence.candidate.source !== 'african_storybook' || evidence.metrics?.source !== 'african_storybook') {
    throw new Error('Missing African Storybook profile evidence')
  }
  assertFresh(evidence.measuredAt, now, 'Public profile measurement')
  const assertNoBody = value => {
    if (!value || typeof value !== 'object') return
    for (const [key, child] of Object.entries(value)) {
      if (['content', 'body', 'raw', 'raw_content', 'passage_text', 'rows', 'articles'].includes(key)) throw new Error('Raw text is forbidden in registry profiles')
      assertNoBody(child)
    }
  }
  assertNoBody(evidence.candidate)
  assertNoBody(evidence.metrics)
  // Source summaries only. The public report's rows and original text never enter profile.
  const result = { ...(existing ?? {}), ...evidence.candidate,
    pilot: { ...(evidence.candidate.pilot ?? {}), registered: admitted },
    measuredMetrics: { ...evidence.metrics, currentlyImported: admitted,
      scope: `${evidence.metrics.extracted ?? 'unknown count of'} extracted pilot rows, not admitted-only` },
    assessmentMeasuredAt: evidence.measuredAt,
    lastValidated: now, acquisition: { mode: 'reviewed-pilot', automaticIngestion: false,
      articleIds: PILOT_IDS, pinnedCommits: evidence.pinnedCommits ?? [], evidenceFiles: evidence.files } }
  if (JSON.stringify(result).length > 64000) throw new Error('Source profile is unexpectedly large')
  return result
}

/** Selection has no I/O. Duplicate title/near matches mean review, not permanent rejection. */
export function selectPilotCandidates(bundle, now) {
  const maps = validateBundle(bundle, now)
  const candidates = [], skipped = [], holds = []
  const eligible = [...maps.analysis.values()].filter(row => row.source === 'african_storybook' && row.canonicalPreview?.status === 'eligible')
  if (eligible.length > 4 || eligible.some(row => !ALLOWED.has(row.source_id))) throw new Error('Eligible plan exceeds the approved four-story scope')
  for (const article of maps.articles.values()) {
    const id = article.source_id
    if (!ALLOWED.has(id)) { skipped.push({ source_id: id, reason: 'outside_fixed_pilot' }); continue }
    const review = maps.review.get(id), analysis = maps.analysis.get(id), duplicate = maps.dedup.get(id)
    const kinds = ['storedHashMatches', 'bodyMatches', 'pilotMatches', 'titleMatches', 'urlMatches']
    for (const key of kinds) if (!Array.isArray(duplicate[key])) throw new Error(`Missing duplicate evidence ${key}: ${id}`)
    const exact = duplicate.storedHashMatches.length || duplicate.bodyMatches.some(m => m.normalizedExact) || duplicate.pilotMatches.some(m => m.normalizedExact)
    if (exact) { skipped.push({ source_id: id, reason: 'known_exact_duplicate' }); continue }
    if (kinds.some(key => duplicate[key].length)) {
      skipped.push({ source_id: id, reason: 'duplicate_evidence_requires_review' }); continue
    }
    try {
      const row = preparePilotRow({ article, review, analysis, files: bundle.files, now })
      candidates.push({ article, analysis, row })
      if (analysis.usageBlockers?.includes('live_syntax_definition_drift')) holds.push({ source_id: id, reason: 'live_syntax_definition_drift' })
    } catch (error) { skipped.push({ source_id: id, reason: error.message }) }
  }
  if (candidates.length > 4) throw new Error('Pilot cap exceeded')
  if (!Array.isArray(bundle.analysis.syntaxProbes) || bundle.analysis.syntaxProbes.length !== SYNTAX_PROBES.length ||
    bundle.analysis.syntaxProbes.some(probe => probe.differs !== false)) holds.push({ reason: 'analysis_syntax_probes_not_current' })
  return { candidates, skipped, holds }
}

async function response(query, label) {
  const { data, error } = await query
  if (error) throw new Error(`${label}: ${error.message}`)
  if (!Array.isArray(data)) throw new Error(`${label}: missing result array`)
  return data
}

async function checkCurrentDuplicates(db, candidates) {
  if (!candidates.length) return { candidates: [], skipped: [] }
  const sourceIds = candidates.map(c => c.article.source_id)
  const hashes = [...new Set(candidates.flatMap(c => [c.article.content_hash, hash(bodyOf(c.article.content))]))]
  const existing = await response(db.from('library_articles').select('id,source_id,content')
    .eq('source', 'african_storybook').in('source_id', sourceIds), 'Existing source lookup')
  const matches = await response(db.from('library_articles').select('id,content_hash').in('content_hash', hashes), 'Existing hash lookup')
  const related = []
  let cursor = null
  for (;;) {
    let q = db.from('library_articles').select('id,content').in('source', ['storyweaver', 'african_storybook']).order('id', { ascending: true }).limit(500)
    if (cursor) q = q.gt('id', cursor)
    const page = await response(q, 'Related text lookup')
    related.push(...page)
    if (page.length < 500) break
    const next = page.at(-1).id
    if (next === cursor) throw new Error('Nonadvancing related-text cursor')
    cursor = next
  }
  const relatedHashes = new Set(related.map(row => normalizedTextHash(row.content ?? '')))
  const selected = [], skipped = []
  for (const candidate of candidates) {
    const article = candidate.article, id = article.source_id
    const same = existing.find(row => row.source_id === id)
    if (same) { skipped.push({ source_id: id, reason: 'already_exists_preserved', articleId: same.id,
      bodyChanged: same.content !== article.content }); continue }
    if (matches.some(row => [article.content_hash, hash(bodyOf(article.content))].includes(row.content_hash)) || relatedHashes.has(normalizedTextHash(article.content))) {
      skipped.push({ source_id: id, reason: 'live_exact_duplicate' }); continue
    }
    const title = article.title.replace(/[\\%_]/g, '\\$&')
    const titles = await response(db.from('library_articles').select('id').ilike('title', title).limit(1), 'Title review lookup')
    if (titles.length) { skipped.push({ source_id: id, reason: 'live_title_match_requires_review' }); continue }
    selected.push(candidate)
  }
  return { candidates: selected, skipped }
}

export async function verifyLiveSyntax(db) {
  for (const [id, text] of SYNTAX_PROBES) {
    const { data, error } = await db.rpc('compute_syntax_score', { p_content: text })
    if (error) throw new Error(`Syntax preflight ${id}: ${error.message}`)
    const expected = repositorySyntaxProbe(text)
    if (['score', 'sent_p90', 'clause_depth_p90'].some(key => data?.[key] !== expected[key])) {
      throw new Error(`Live syntax definition drift: ${id}`)
    }
  }
}

export async function importCorpusPilot({ db, bundle, now = new Date().toISOString(), commit = false }) {
  const plan = selectPilotCandidates(bundle, now)
  const current = await checkCurrentDuplicates(db, plan.candidates)
  const skipped = [...plan.skipped, ...current.skipped]
  const report = { mode: commit ? 'commit' : 'dry-run', measuredAt: now,
    planned: current.candidates.map(c => ({ source_id: c.article.source_id, contentHash: c.article.content_hash, title: c.article.title, status: 'queued' })),
    skipped, holds: plan.holds, inserted: [], profileUpdated: false,
    duplicateLimitations: bundle.dedup.limitations }
  if (!commit) return report
  const matchingExisting = current.skipped.filter(row => row.reason === 'already_exists_preserved' && !row.bodyChanged).length
  if (!current.candidates.length && !matchingExisting) return report
  if (plan.holds.length) throw new Error('Commit held: rerun analysis after syntax calibration is verified')
  // Detect an unapplied registry migration before any article INSERT.
  const { data: registry, error: registryError } = await db.from('csat_source_registry')
    .select('source,profile').eq('source', 'african_storybook').single()
  if (registryError || !registry) throw new Error(`Registry preflight: ${registryError?.message ?? 'missing source'}`)
  const profile = prepareRegistryProfile(registry.profile, bundle.profileEvidence,
    current.candidates.length + matchingExisting, now)
  await verifyLiveSyntax(db)
  // One atomic INSERT request. A concurrent source-key collision fails the entire batch;
  // retry performs discovery again and preserves the winning rows. Never upsert bodies.
  const data = current.candidates.length ? await response(db.from('library_articles').insert(current.candidates.map(c => c.row))
    .select('id,source_id,status'), 'Pilot insert failed; rerun discovery before retrying') : []
  if (data.length !== current.candidates.length || data.some(row => row.status !== 'queued')) {
    throw new Error('Unexpected insert receipt; inspect rows before retrying')
  }
  report.inserted = data
  let update = db.from('csat_source_registry').update({ profile }).eq('source', 'african_storybook')
  update = registry.profile == null ? update.is('profile', null) : update.eq('profile', JSON.stringify(registry.profile))
  const { error: profileError } = await update.select('source').single()
  if (profileError) throw new Error(`Articles remain queued; registry profile update failed, safe to rerun: ${profileError.message}`)
  report.profileUpdated = true
  return report
}

function loadBundle(dir) {
  const files = {}, contents = {}
  for (const [key, name] of Object.entries({ articles: 'articles.jsonl', analysis: 'analysis.json', review: 'asp-review.json', dedup: 'dedup.json' })) {
    const file = path.join(dir, name), raw = fs.readFileSync(file, 'utf8')
    files[key] = { name, sha256: hash(raw), modifiedAt: fs.statSync(file).mtime.toISOString() }
    contents[key] = key === 'articles' ? raw.trim().split('\n').map(JSON.parse) : JSON.parse(raw)
  }
  const licenseIndex = fs.readFileSync(path.join(dir, 'asp-license-index.md'), 'utf8')
  for (const article of contents.articles.filter(row => ALLOWED.has(row.source_id))) {
    const filename = new URL(article.source_url).pathname.split('/').at(-1)
    const raw = fs.readFileSync(path.join(dir, `asp-${filename}`), 'utf8')
    const indexLine = licenseIndex.split('\n').find(line => line.startsWith(`${article.source_id.split(':')[1]} |`))
    verifyRawAttribution(article, raw, indexLine)
  }
  const profileFiles = ['apps/web/src/lib/textbook/source-discovery-profiles.json', 'docs/reports/csat-corpus-pilot-20260919.json']
  const [profilesRaw, metricsRaw] = profileFiles.map(file => fs.readFileSync(file, 'utf8'))
  const profiles = JSON.parse(profilesRaw), metrics = JSON.parse(metricsRaw)
  const profileEvidence = { candidate: profiles.candidates.find(row => row.source === 'african_storybook'),
    metrics: metrics.sources.find(row => row.source === 'african_storybook'), measuredAt: metrics.measuredAt,
    pinnedCommits: [...new Set(contents.articles.filter(row => ALLOWED.has(row.source_id)).map(row => row.metadata.commit))],
    files: profileFiles.map((name, i) => ({ name, sha256: hash([profilesRaw, metricsRaw][i]) })) }
  return { articles: contents.articles, analysis: contents.analysis, reviews: contents.review, dedup: contents.dedup, files, profileEvidence }
}

async function main() {
  const commit = process.argv.includes('--commit')
  if (process.argv.slice(2).some(arg => arg !== '--commit')) throw new Error('Only --commit is supported; pilot scope cannot be expanded by CLI flags')
  const envFile = path.resolve('apps/web/.env.local')
  if (fs.existsSync(envFile)) for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Missing Supabase environment')
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } })
  const dir = path.resolve('.agent-logs/corpus-pilot')
  const result = await importCorpusPilot({ db, bundle: loadBundle(dir), commit })
  fs.writeFileSync(path.join(dir, commit ? 'import-result.json' : 'import-plan.json'), JSON.stringify(result, null, 2) + '\n')
  console.log(JSON.stringify({ mode: result.mode, planned: result.planned, skipped: result.skipped.length,
    holds: result.holds, inserted: result.inserted, profileUpdated: result.profileUpdated,
    report: commit ? 'import-result.json' : 'import-plan.json' }, null, 2))
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1 })
}
