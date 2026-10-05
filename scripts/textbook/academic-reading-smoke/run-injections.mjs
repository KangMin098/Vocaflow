// scripts/textbook/academic-reading-smoke/run-injections.mjs
import fs from 'node:fs'
import { loadEnv } from '../volume-pool.mjs'
import { createClient } from '@supabase/supabase-js'
import { adaptationKey, digest, readPreservationRules, READING_SOURCE_COLUMNS, validateReadingDraft } from '../academic-reading-contract.mjs'
import { REVIEW_DIMENSIONS, validateAgentReviews, canExportReadingItem, readingItemSourceFailure, reviewedPassageIsComplete } from '../academic-reading-review.mjs'

loadEnv()
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const rules = readPreservationRules('scripts/textbook/frym-precision/preservation-rules-1.json', 'scripts/textbook/frym-precision/round-1.json')
const base = process.argv[2] ?? '.agent-logs/academic-reading-e2e-smoke'
const results = []
for (const dir of ['middle1', 'high1']) {
  const folder = `${base}/${dir}`
  const input = JSON.parse(fs.readFileSync(`${folder}/chunk-00.json`, 'utf8')).find(x => x.reading.preservation_rules.entry.pair_id === 'F02')
  const draft = JSON.parse(fs.readFileSync(`${folder}/chunk-00.out.json`, 'utf8')).find(x => x.adapted_from_id === input.adapted_from_id)
  const { data: parent, error } = await db.from('library_articles').select(READING_SOURCE_COLUMNS).eq('id', input.adapted_from_id).single()
  if (error) throw error
  const now = Date.parse('2026-10-05T12:00:00Z')
  const validated = validateReadingDraft(draft, input, parent, now, rules.get(parent.id))
  if (!validated.ok) throw new Error(`${dir} draft failed: ${validated.reason}`)
  const actual = ['claude_code', 'codex'].map(reviewer => JSON.parse(fs.readFileSync(`${folder}/chunk-00.${reviewer}.review.json`, 'utf8')))
  const actualReview = validateAgentReviews(draft, input, actual)
  if (actualReview.ok) throw new Error('actual independent disagreement unexpectedly passed')
  // Simulated approval exercises the downstream gates only; it is never written to the actual review files or DB.
  const simulated = actual.map(([review]) => [{ ...review, verdict: 'pass',
    dimensions: Object.fromEntries(REVIEW_DIMENSIONS.map(key => [key, true])), distortions: [] }])
  const cleanReview = validateAgentReviews(draft, input, simulated)
  if (!cleanReview.ok) throw new Error(`gate simulation could not establish baseline: ${cleanReview.reason}`)
  const spec = { ...validated.spec, state: 'agent_reviewed', content_review: cleanReview.certificate }
  const article = {
    id: `local-${dir}`, source_id: adaptationKey(parent.id, spec.target), adapted_from_id: parent.id,
    title: draft.title, content: draft.text, source: parent.source, license: parent.license,
    license_class: parent.license_class, display_only: false, copyright_safe_in_kr: true,
    status: 'ready', article_v_level: spec.target.passage_v_level,
    updated_at: '2026-10-05T12:00:00Z', composed_spec: { academic_reading: spec },
  }
  const plan = spec.analysis.item_plan.find(x => x.skill === 'R4')
  const type = 'topic'
  const original = { passage: article.content, reading: { version: spec.version, target: spec.target,
    source_hash: digest(article.content), source_revision: article.updated_at } }
  const item = { passage: article.content, reading: { ...original.reading, skill: plan.skill,
    passage_level: spec.analysis.passage_profile.overall_level.level, item_reasoning_level: plan.item_reasoning_level,
    item_difficulty: plan.item_difficulty, difficulty_evidence: plan.difficulty_evidence,
    evidence: plan.evidence } }
  const cases = {
    BASELINE_SIMULATED_REVIEW: canExportReadingItem(article, parent, type) && readingItemSourceFailure(item, original, article, parent, type, article.article_v_level) === null,
    SOURCE_HASH_CHANGED: !validateReadingDraft(draft, input, { ...parent, content: `${parent.content} Changed.` }, now, rules.get(parent.id)).ok,
    TARGET_PROFILE_CHANGED: !validateReadingDraft({ ...draft, reading: { ...draft.reading,
      target: { ...draft.reading.target, reasoning_band: dir === 'middle1' ? 'high_1' : 'middle_1' } } }, input, parent, now, rules.get(parent.id)).ok,
    ADAPTATION_HASH_CHANGED: !validateAgentReviews({ ...draft, text: `${draft.text} Changed.` }, input, simulated).ok,
    POST_REVIEW_TRUNCATION_INVALIDATES_REVIEW: !reviewedPassageIsComplete(article, article.content.slice(0, article.content.lastIndexOf('\n\n')), type) &&
      readingItemSourceFailure(item, { ...original, passage: article.content.slice(0, article.content.lastIndexOf('\n\n')) }, article, parent, type, article.article_v_level)?.includes('truncated'),
    RIGHTS_REVOKED: !validateReadingDraft(draft, input, { ...parent, display_only: true }, now, rules.get(parent.id)).ok &&
      !canExportReadingItem(article, { ...parent, display_only: true }, type),
    ACTUAL_REVIEW_HELD: !actualReview.ok && actualReview.reason.includes('codex review did not pass'),
  }
  if (Object.values(cases).some(value => value !== true)) throw new Error(`${dir} injection failed: ${JSON.stringify(cases)}`)
  results.push({ id: `F02-${dir}`, source_hash: input.reading.source_hash, target_key: input.reading.target_key,
    draft_hash: cleanReview.certificate.draft_hash, actual_review: actualReview.reason, cases })
}
if (results[0].target_key === results[1].target_key || results[0].draft_hash === results[1].draft_hash)
  throw new Error('target/draft hash separation failed')
fs.writeFileSync(`${base}/injection-results.json`, `${JSON.stringify(results, null, 2)}\n`)
console.log(JSON.stringify(results.map(x => ({ id: x.id, target_key: x.target_key, actual_review: x.actual_review, cases: x.cases })), null, 2))
