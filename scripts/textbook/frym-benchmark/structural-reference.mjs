// scripts/textbook/frym-benchmark/structural-reference.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { hash } from './benchmark.mjs'
import { assertExternalCandidate } from './local-candidate-path.mjs'
import { buildReferenceRoleScreen } from './reference-role-screen.mjs'

const fail = code => { throw Error(code) }
const sha = value => createHash('sha256').update(value).digest('hex')
const filled = value => typeof value === 'string' && value.length > 0
const hex = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
const decode = html => html.replace(/&#(?:x([a-f\d]+)|(\d+));/gi,
  (_, x, d) => String.fromCodePoint(parseInt(x ?? d, x ? 16 : 10)))
  .replace(/&(?:nbsp|amp|lt|gt|quot|apos);/g, match => ({
    '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'",
  })[match])
const plain = html => decode(html.replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
const median = numbers => {
  const sorted = [...numbers].sort((a, b) => a - b)
  return sorted.length ? (sorted[Math.floor((sorted.length - 1) / 2)] +
    sorted[Math.ceil((sorted.length - 1) / 2)]) / 2 : 0
}

export function characterizeStructuralReferences({ role_input, role_screen, specifications }) {
  const current = buildReferenceRoleScreen(role_input)
  if (hash(current) !== hash(role_screen)) fail('STRUCTURAL_ROLE_SCREEN_STALE')
  if (!Array.isArray(specifications) || specifications.length !== current.structural_eligible_n ||
      new Set(specifications.map(row => row?.source_id)).size !== specifications.length)
    fail('STRUCTURAL_SPEC_SET_INVALID')
  const profiles = specifications.map(spec => {
    const role = current.structural_corpus.find(row => row.source_id === spec.source_id)
    const source = role_input.candidates.find(row => row.structural.source_id === spec.source_id)?.structural
    if (!role || !source || !filled(spec.start_marker) || !filled(spec.end_marker) ||
        !hex(spec.excerpt_hash) || !['article', 'storybook'].includes(spec.format))
      fail('STRUCTURAL_SPEC_INVALID')
    const html = readFileSync(source.source_path, 'utf8')
    const start = html.indexOf(spec.start_marker)
    const end = html.indexOf(spec.end_marker, start + spec.start_marker.length)
    if (start < 0 || end <= start || html.indexOf(spec.start_marker, start + 1) >= 0 ||
        sha(html.slice(start, end)) !== spec.excerpt_hash)
      fail('STRUCTURAL_EXCERPT_CHANGED')
    const excerpt = html.slice(start, end)
    const text = plain(excerpt)
    const words = text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []
    const sentences = text.split(/[.!?]+(?:\s|$)/).map(row => row.trim()).filter(Boolean)
    const sentenceLengths = sentences.map(row => (row.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length)
      .filter(length => length > 1)
    const cues = Object.fromEntries(['because', 'however', 'therefore', 'for example', 'but']
      .map(cue => [cue.replace(/ /g, '_'), (text.match(new RegExp(`\\b${cue}\\b`, 'gi')) ?? []).length]))
    const profile = { schema: 'structural-characterization/1', source_id: spec.source_id,
      role_decision_hash: role.decision_hash, source_hash: role.source_hash,
      excerpt_hash: spec.excerpt_hash, format: spec.format,
      text_block_count: spec.format === 'article' ?
        (excerpt.match(/<p(?:\s|>)/gi) ?? []).length :
        (excerpt.match(/class="asbText"/g) ?? []).length,
      heading_count: (excerpt.match(/<h[1-6](?:\s|>)/gi) ?? []).length,
      list_item_count: (excerpt.match(/<li(?:\s|>)/gi) ?? []).length,
      word_count: words.length, sentence_count: sentenceLengths.length,
      median_sentence_words: median(sentenceLengths), discourse_cues: cues,
      measurement_scope: 'non_grade_structure_only' }
    return { ...profile, profile_hash: hash(profile) }
  })
  const body = { schema: 'structural-reference-corpus/1', role_screen_hash: current.screen_hash,
    profile_count: profiles.length, profiles,
    calibration_eligible_n: 0, grade_distribution_n: 0,
    benchmark_target_fit: 'unopened', benchmark_level_separation: 'unopened' }
  return { ...body, corpus_hash: hash(body) }
}

export function bindStructuralPlanningNote({ corpus, order }) {
  if (corpus?.schema !== 'structural-reference-corpus/1' ||
      hash(Object.fromEntries(Object.entries(corpus).filter(([key]) => key !== 'corpus_hash'))) !== corpus.corpus_hash ||
      corpus.calibration_eligible_n !== 0 || corpus.grade_distribution_n !== 0 ||
      corpus.benchmark_target_fit !== 'unopened' ||
      !filled(order?.product_order_id) || !Number.isInteger(order?.order_revision) ||
      order.order_revision < 1 || !hex(order?.order_hash))
    fail('STRUCTURAL_PLANNING_INPUT_INVALID')
  const body = { schema: 'structural-planning-note/1',
    product_order_id: order.product_order_id, order_revision: order.order_revision,
    order_hash: order.order_hash, order_evidence_level: 'caller_supplied_unverified',
    structural_corpus_hash: corpus.corpus_hash,
    profile_hashes: corpus.profiles.map(row => row.profile_hash),
    allowed_uses: ['passage_structure', 'sentence_shape', 'discourse_cues', 'item_format'],
    binding: 'advisory_only', target_fit_evidence: false,
    level_separation_evidence: false, gold_s_evidence: false }
  return { ...body, note_hash: hash(body) }
}

if (process.argv[1]?.endsWith('structural-reference.mjs')) {
  const [inputPath, screenPath, specsPath, outputPath] = process.argv.slice(2)
  if (![inputPath, screenPath, specsPath, outputPath].every(filled))
    fail('USAGE: structural-reference.mjs <external-input> <external-screen> <external-specs> <new-output>')
  for (const path of [inputPath, screenPath, specsPath, outputPath]) assertExternalCandidate(path)
  const result = characterizeStructuralReferences({
    role_input: JSON.parse(readFileSync(inputPath, 'utf8')),
    role_screen: JSON.parse(readFileSync(screenPath, 'utf8')),
    specifications: JSON.parse(readFileSync(specsPath, 'utf8')),
  })
  writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' })
  process.stdout.write(`${JSON.stringify({ corpus_hash: result.corpus_hash,
    profile_count: result.profile_count, grade_distribution_n: result.grade_distribution_n })}\n`)
}
