// scripts/audit/csat-corpus-pilot-analyze.mjs
// Read-only ACP measurement of a local corpus; never imports or publishes articles.
// pnpm exec tsx scripts/audit/csat-corpus-pilot-analyze.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { normalizePunctuation, reflowSoftHyphens } from '../../packages/library-pipeline/src/normalize/index.ts'
import { extractBookLemmas } from '../../packages/library-pipeline/src/analyze/extract-lemmas.ts'
import { lookupAndEnrich } from '../../packages/library-pipeline/src/analyze/lookup-enrich.ts'
import { computeLearningValue } from '../../packages/library-pipeline/src/analyze/learning-value.ts'
import { detectBookCefr } from '../../packages/library-pipeline/src/analyze/cefr-detect.ts'
import { evaluateSource } from '../../packages/library-pipeline/src/textbook/source-eligibility.ts'
import { hardReject, decide } from '../csat/gate-rules.mjs'

const hash = text => createHash('sha256').update(text).digest('hex')
const round = n => Math.round(n * 100) / 100
const ratio = (n, d) => d ? round(100 * n / d) : null
const CEFR = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])
const PURPOSE_MAP = { gist: 'main_point', detail: 'content_match' }
const PURPOSES = new Set(['title', 'topic', 'main_point', 'blank', 'order', 'insert', 'content_match', 'mood', 'long_reference'])

/** Restricted facade: lookupAndEnrich cannot perform a write even if it changes. */
export function readOnlyDictionaryClient(client) {
  return {
    from(table) {
      if (table !== 'shared_dictionary') throw new Error(`Unexpected table: ${table}`)
      return { select: columns => ({ in: (column, values) => client.from(table).select(columns).in(column, values) }) }
    },
  }
}

/**
 * Read-only equivalent of the live compute_article_vrl SQL, inspected 2026-09-19.
 * The canonical RPC updates library_articles, so it MUST NOT be called for this pilot.
 * Its inputs are the exact computeLearningValue output that analyzeArticle persists.
 * Distinct word types, not token frequencies; V11 excluded; percentile_disc, not cont.
 */
export function measureVrl(words, entries) {
  const distinct = [...new Set(words.map(w => w.word))]
  const levels = distinct.map(w => entries.get(w)?.v_level)
    .filter(v => Number.isInteger(v) && v >= 0 && v <= 10).sort((a, b) => a - b)
  if (!levels.length) return null
  const percentile = p => levels[Math.max(0, Math.ceil(p * levels.length) - 1)]
  return {
    p50: percentile(0.5), p75: percentile(0.75), p90: percentile(0.9),
    weighted_avg: round(levels.reduce((a, b) => a + b, 0) / levels.length),
    matched_lemmas: levels.length, lemma_coverage_pct: ratio(levels.length, distinct.length),
    v_level_diversity: new Set(levels).size, method: 'p75_type_v11_excluded_article',
    implementation: 'read-only equivalent of live compute_article_vrl; no RPC invocation',
    sqlSource: 'supabase/migrations/20260901040000_lav_drop_dead_columns.sql',
  }
}

export function mapPurposes(values = []) {
  return [...new Set(values.map(v => PURPOSE_MAP[v] ?? v))].filter(v => PURPOSES.has(v))
}

export function summarizeStoredSyntax(values) {
  const result = { total: 0, missing: 0, invalidOrMissingComponents: 0, comparable: 0,
    matchesOldOnly: 0, matchesNewOnly: 0, matchesBoth: 0, matchesNeither: 0,
    saturated100: 0, proposedScoreWouldChange: 0 }
  for (const value of values) {
    result.total++
    if (value == null) { result.missing++; continue }
    const { score, sent_p90: sent, clause_depth_p90: clauses } = value
    if (![score, sent, clauses].every(Number.isFinite) || score < 0 || score > 100 || sent < 0 || clauses < 0) {
      result.invalidOrMissingComponents++; continue
    }
    result.comparable++
    if (score === 100) result.saturated100++
    const oldScore = Math.min(100, Math.max(0, Math.round(sent * 2 + clauses * 6)))
    const newScore = Math.min(100, Math.max(0, Math.round((sent - 10) * 0.75 + (clauses - 1) * 5)))
    const oldMatch = score === oldScore, newMatch = score === newScore
    result[oldMatch ? newMatch ? 'matchesBoth' : 'matchesOldOnly' : newMatch ? 'matchesNewOnly' : 'matchesNeither']++
    if (score !== newScore) result.proposedScoreWouldChange++
  }
  return result
}

async function measureStoredSyntax(client) {
  const startedAt = new Date().toISOString()
  const counts = summarizeStoredSyntax([])
  let cursor = null
  for (;;) {
    let query = client.from('library_articles').select('id,syntax_score').order('id', { ascending: true }).limit(1000)
    if (cursor) query = query.gt('id', cursor)
    const { data, error } = await query
    if (error) throw new Error(`Stored syntax scan failed: ${error.message}`)
    if (!Array.isArray(data)) throw new Error('Stored syntax scan returned no row array')
    if (!data.length) break
    const page = summarizeStoredSyntax(data.map(row => row.syntax_score))
    for (const key of Object.keys(counts)) counts[key] += page[key]
    cursor = data.at(-1).id
    if (counts.total % 20000 === 0) console.log(`Read-only stored syntax scan: ${counts.total} articles`)
  }
  return { startedAt, finishedAt: new Date().toISOString(), table: 'library_articles', counts,
    method: 'read-only keyset pages; stored rounded sent_p90/clause_depth_p90 comparison',
    caveats: ['Not a transaction snapshot; concurrent article changes may affect the scan.',
      'Saved component values are already rounded. Neither-match rows are unknown, not proof of a third formula.',
      'Proposed scores use the saved summaries, not a recalculation of original text.',
      'Math.round is a local diagnostic; PostgreSQL float ties may differ by one.',
      'No existing score, content, or cache was updated.'] }
}

function readReviews(files, articles) {
  const byId = new Map(articles.map(r => [r.source_id, r]))
  const reviews = new Map()
  for (const file of files) {
    if (!fs.existsSync(file)) continue
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
    const rows = Array.isArray(parsed) ? parsed : parsed.rows ?? parsed.reviews
    if (!Array.isArray(rows)) throw new Error(`Review rows must be an array: ${file}`)
    for (const r of rows) {
      if (reviews.has(r.source_id)) throw new Error(`Duplicate review: ${r.source_id}`)
      if (!byId.has(r.source_id) || byId.get(r.source_id).content_hash !== r.contentHash) {
        throw new Error(`Stale or unknown review: ${r.source_id}`)
      }
      if (!['use', 'narrative', 'review', 'reject'].includes(r.verdict)) throw new Error(`Invalid verdict: ${r.source_id}`)
      reviews.set(r.source_id, r)
    }
  }
  return reviews
}

// Diagnostic ONLY: three fixed probes against the checked-in SQL expression.
// Production article measurements below always use the live IMMUTABLE RPC.
export function repositorySyntaxProbe(text) {
  const sentences = text.split(/[.!?]+[\s"]/).map(s => s.trim()).filter(s => s.length > 2)
  if (!sentences.length) return null
  const continuous = values => {
    values.sort((a, b) => a - b)
    const i = 0.9 * (values.length - 1), lo = Math.floor(i)
    return values[lo] + (values[Math.ceil(i)] - values[lo]) * (i - lo)
  }
  const words = continuous(sentences.map(s => s.split(/\s+/).length))
  const clauses = continuous(sentences.map(s => (s.match(/[,;]/g)?.length ?? 0) +
    (s.match(/\b(that|which|who|whom|whose|because|although|though|while|whereas|if|when|since|unless|before|after|as)\b/gi)?.length ?? 0)))
  return { sent_p90: Math.round(words), clause_depth_p90: Math.round(clauses * 10) / 10,
    score: Math.max(0, Math.min(100, Math.round((words - 10) * 0.75 + (clauses - 1) * 5))) }
}

export const SYNTAX_PROBES = [
  ['short', 'The cat sat on the mat. The dog slept by the door.'],
  ['long', 'Although the committee had reviewed the evidence, the members postponed the decision because they wanted to hear from residents who had lived near the river before the factory opened.'],
  ['complex', 'When the researchers examined the samples, they found that several organisms survived because the water remained warm; however, the team could not explain why the population declined after the storm, although the habitat appeared unchanged.'],
]

async function liveSyntax(client, text) {
  // This previously inspected IMMUTABLE text-to-json function cannot update rows.
  // RPC's default POST avoids putting full articles into URLs or exceeding URL limits.
  const { data, error } = await client.rpc('compute_syntax_score', { p_content: text })
  if (error) throw new Error(`compute_syntax_score failed: ${error.message}`)
  if (data !== null && (!Number.isFinite(data.score) || data.score < 0 || data.score > 100)) {
    throw new Error('Invalid live syntax result')
  }
  return data
}

function env() {
  const envFile = path.resolve('apps/web/.env.local')
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase environment is required for read-only dictionary measurement')
  }
}

export async function analyzePilot({ client, articles, reviews }) {
  if (new Set(articles.map(a => a.source_id)).size !== articles.length) throw new Error('Duplicate article source_id')
  const prepared = articles.map(article => {
    if (hash(article.content) !== article.content_hash) throw new Error(`Content hash mismatch: ${article.source_id}`)
    const body = reflowSoftHyphens(normalizePunctuation(article.content), { joinHyphenLineBreaks: false })
    const chapter = { chapter_idx: 1, content: body, word_count: body.match(/\b[a-zA-Z][a-zA-Z'-]*\b/g)?.length ?? 0,
      paragraph_offsets: [0], sentence_offsets: [0] }
    return { article, body, chapter, index: extractBookLemmas([chapter]) }
  })
  const union = [...new Set(prepared.flatMap(p => [...p.index.bookFrequency.keys()]))]
  console.log(`Read-only exact dictionary lookup: ${union.length} distinct lemmas from ${articles.length} articles`)
  const enriched = await lookupAndEnrich(readOnlyDictionaryClient(client), union, { skipLlm: true })
  if (enriched.enrichedCount !== 0 || enriched.llmCost !== 0) throw new Error('Unexpected enrichment')
  const syntaxProbes = []
  for (const [id, text] of SYNTAX_PROBES) {
    const live = await liveSyntax(client, text)
    const repository = repositorySyntaxProbe(text)
    syntaxProbes.push({ id, text, live, repository, differs: ['sent_p90', 'clause_depth_p90', 'score'].some(k => live?.[k] !== repository?.[k]) })
  }
  const results = []
  for (const p of prepared) {
    const { article, body, chapter, index } = p
    const review = reviews.get(article.source_id) ?? null
    const words = computeLearningValue(index, enriched.entries, { totalChapters: 1 })
    const vrl = measureVrl(words, enriched.entries)
    const cefr = await detectBookCefr([chapter], index, enriched.entries, { skipLlm: true })
    const syntax = await liveSyntax(client, body)
    const types = [...index.bookFrequency.keys()]
    const frequencies = [...index.bookFrequency.values()]
    const totalTokens = frequencies.reduce((a, b) => a + b, 0)
    const exact = types.filter(w => enriched.entries.has(w))
    const knownCefr = types.filter(w => CEFR.has(enriched.entries.get(w)?.cefr_level))
    const knownTokens = knownCefr.reduce((n, w) => n + index.bookFrequency.get(w), 0)
    const codes = hardReject(body)
    const verdict = review?.verdict ?? null
    const gate = verdict ? decide({ purpose: 'csat', verdict, genre: review.genre ?? null, codes }) : null
    // NARA's unknown rights never become CC0 merely because the website is governmental.
    const rightsVerified = article.source === 'african_storybook' && review?.attributionVerified === true && /^CC-BY-[34]\.0$/.test(article.license ?? '')
    const input = { title: article.title, status: 'ready', articleVLevel: vrl?.p75 ?? null,
      wordCount: chapter.word_count, register: review?.register ?? null, cefrLevel: cefr.level,
      syntaxScore: syntax?.score ?? null, displayOnly: false, licenseClass: rightsVerified ? 'cc_by' : 'unknown',
      copyrightSafeInKr: null, gatePublishable: gate?.publishable ?? null,
      gateBlockedBy: gate?.blockedBy ?? null, gateVerdict: verdict, gatePurpose: 'csat',
      gateGenre: review?.genre ?? null, excerptWindows: 0, hasItems: false, outsidePct: null }
    const preview = evaluateSource(input)
    const usageBlockers = ['local_pilot_not_imported', ...preview.blockers]
    if (!rightsVerified) usageBlockers.push('rights_unverified')
    if (!review) usageBlockers.push('content_not_reviewed')
    if (review && review.quality && review.quality !== 'clean') usageBlockers.push(`quality_${review.quality}`)
    if (syntaxProbes.some(x => x.differs)) usageBlockers.push('live_syntax_definition_drift')
    results.push({ source: article.source, source_id: article.source_id, title: article.title,
      contentHash: article.content_hash, normalizedContentHash: hash(body), normalizationChanged: body !== article.content,
      wordCount: chapter.word_count, lemmaTypes: types.length, lemmaTokens: totalTokens,
      dictionary: { exactMatchedTypes: exact.length, exactTypeCoveragePct: ratio(exact.length, types.length),
        exactTokenCoveragePct: ratio(exact.reduce((n, w) => n + index.bookFrequency.get(w), 0), totalTokens),
        cefrKnownTypes: knownCefr.length, cefrKnownTokenCoveragePct: ratio(knownTokens, totalTokens),
        missingExactTypes: types.filter(w => !enriched.entries.has(w)),
        note: 'Exact lookup misses are not proven dictionary gaps; learner headword resolution is a separate path.' },
      vrl, cefr, cefrVocabFallbackUsed: knownTokens === 0, syntax, syntaxAuthority: 'live IMMUTABLE compute_syntax_score',
      contentReview: review, learningPurposes: mapPurposes(review?.learningPurposes ?? review?.purposes),
      rightsVerified, mechanicalCodes: codes, publicationGatePreview: gate,
      canonicalPreview: preview, canonicalPreviewInput: input,
      usageAllowed: false, usageBlockers: [...new Set(usageBlockers)] })
    if (results.length % 10 === 0) console.log(`Measured ${results.length}/${prepared.length}`)
  }
  return { measuredAt: new Date().toISOString(), readOnly: true, llmCalls: 0, databaseWrites: 0,
    assumptions: ['Canonical preview assumes a future ready row; the corpus has not been imported.',
      'No excerpt or item exists; curriculum outside-percentage is unmeasured.',
      'Content age fit is independent of linguistic CEFR/V-Level.',
      'CEFR confidence measures agreement of two signals, not dictionary coverage or an external validation.',
      'Syntax probes compare the live function with a diagnostic translation of the repository SQL, never replace live scores.'],
    syntaxProbes, syntaxRepository: 'supabase/migrations/20260712120000_ctp_syntax_score_recalibrate.sql',
    dictionary: { unionTypes: union.length, exactHits: enriched.hitCount, exactMisses: enriched.missCount },
    summary: { total: results.length, contentReviewed: results.filter(r => r.contentReview).length,
      rightsVerified: results.filter(r => r.rightsVerified).length,
      canonicalStatuses: Object.fromEntries(['eligible', 'conditional', 'review', 'rejected'].map(s => [s, results.filter(r => r.canonicalPreview.status === s).length])),
      usageAllowed: 0 }, rows: results }
}

async function main() {
  if (process.argv.includes('--commit')) throw new Error('This measurement script does not support --commit')
  env()
  const base = path.resolve('.agent-logs/corpus-pilot')
  const articles = fs.readFileSync(path.join(base, 'articles.jsonl'), 'utf8').trim().split('\n').map(JSON.parse)
  const reviews = readReviews([path.join(base, 'asp-review.json'), path.join(base, 'nara-review.json')], articles)
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } })
  if (process.argv.includes('--syntax-impact')) {
    const analysis = JSON.parse(fs.readFileSync(path.join(base, 'analysis.json'), 'utf8'))
    const current = new Map(articles.map(row => [row.source_id, row.content_hash]))
    if (!Array.isArray(analysis.rows) || analysis.rows.length !== current.size ||
      analysis.rows.some(row => current.get(row.source_id) !== row.contentHash)) {
      throw new Error('Pilot analysis is stale; rerun measurement before the syntax impact scan')
    }
    const impact = await measureStoredSyntax(client)
    impact.eligiblePilotPreviews = analysis.rows.filter(r => r.canonicalPreview.status === 'eligible').map(row => {
      const { sent_p90: sent, clause_depth_p90: clauses } = row.syntax
      const proposedScore = Math.min(100, Math.max(0, Math.round((sent - 10) * 0.75 + (clauses - 1) * 5)))
      const after = evaluateSource({ ...row.canonicalPreviewInput, syntaxScore: proposedScore })
      // The current source policy validates syntax range, not a score threshold.
      const atZero = evaluateSource({ ...row.canonicalPreviewInput, syntaxScore: 0 })
      const atHundred = evaluateSource({ ...row.canonicalPreviewInput, syntaxScore: 100 })
      return { source_id: row.source_id, contentHash: row.contentHash, oldScore: row.syntax.score, proposedScore,
        oldStatus: row.canonicalPreview.status, proposedStatus: after.status,
        changed: after.status !== row.canonicalPreview.status,
        endpointStatuses: [atZero.status, atHundred.status],
        usageAllowed: false }
    })
    fs.writeFileSync(path.join(base, 'syntax-impact.json'), JSON.stringify(impact, null, 2) + '\n')
    console.log(JSON.stringify(impact, null, 2))
    return
  }
  const analysis = await analyzePilot({ client, articles, reviews })
  fs.writeFileSync(path.join(base, 'analysis.json'), JSON.stringify(analysis, null, 2) + '\n')
  console.log(JSON.stringify(analysis.summary, null, 2))
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1 })
}
