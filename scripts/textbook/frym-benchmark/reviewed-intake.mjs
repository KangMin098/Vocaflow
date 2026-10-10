// scripts/textbook/frym-benchmark/reviewed-intake.mjs
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { GRADES, hash } from './benchmark.mjs'
import { normalizedPassageHash } from './two-stage-seal.mjs'

const hex = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
const words = value => typeof value === 'string' && value.trim().length > 0
const sha256 = value => createHash('sha256').update(value).digest('hex')
const fail = code => { throw Error(code) }
const fileHash = path => sha256(readFileSync(path))
const locator = value => words(value) && /^[a-z][a-z0-9_-]*:[a-z0-9:._-]+$/i.test(value)
const url = value => {
  try { const parsed = new URL(value); return ['http:', 'https:'].includes(parsed.protocol) && !parsed.hash }
  catch { return false }
}
const forbiddenAnalysis = value => value && typeof value === 'object' && Object.entries(value).some(([key, child]) =>
  ['metrics', 'analysis', 'analysis_hash', 'axis_agreement', 'ordinal_reviews', 'item_type_difficulty'].includes(key) || forbiddenAnalysis(child))

const identity = (entry, rows) => rows.some(row => entry?.file_hash === row.sha256 &&
  entry.source_path_hash === sha256(row.source_path.normalize('NFC')))

function evidenceReasons(entry, stage1) {
  const evidence = entry.evidence ?? {}
  const meta = entry.metadata ?? {}
  const edition = evidence.edition, grade = evidence.grade_scope, rights = evidence.analysis_rights
  const boundary = evidence.boundary
  const reasons = []
  if (edition?.verified !== true || edition.file_hash !== entry.file_hash ||
      !locator(edition.local_locator) || !url(edition.catalog_url) ||
      !hex(edition.catalog_snapshot_hash) || !words(edition.reviewer_id) ||
      !words(meta.publisher) || !words(meta.series) || !words(meta.title) || !words(meta.edition) ||
      !Number.isInteger(meta.publication_year) || meta.publication_year < 1900 || !words(meta.ISBN) ||
      edition.local_isbn !== meta.ISBN || edition.catalog_isbn !== meta.ISBN ||
      edition.local_edition !== meta.edition || edition.catalog_edition !== meta.edition ||
      edition.local_year !== meta.publication_year || edition.catalog_year !== meta.publication_year) reasons.push('HOLD_EDITION')
  if (grade?.verified !== true || grade.file_hash !== entry.file_hash ||
      !locator(grade.local_locator) || !url(grade.catalog_url) ||
      !hex(grade.catalog_snapshot_hash) || !words(grade.reviewer_id) ||
      !Array.isArray(grade.grades) || !grade.grades.length ||
      grade.grades.some(value => !GRADES.includes(value)) ||
      !Array.isArray(grade.local_grades) || !Array.isArray(grade.catalog_grades) ||
      hash(grade.local_grades) !== hash(grade.grades) ||
      hash(grade.catalog_grades) !== hash(grade.grades)) reasons.push('HOLD_GRADE')
  else if (grade.grades.length !== 1 || grade.grades[0] !== meta.grade) reasons.push('HOLD_GRADE_SCOPE_PROTOCOL')
  if (rights?.verified !== true || rights.decision !== 'AUTHORIZED_FOR_ANALYSIS' ||
      rights.covered_file_hash !== entry.file_hash || !words(rights.grantor) ||
      rights.scope !== 'internal_analysis' || !hex(rights.document_hash) ||
      !locator(rights.evidence_locator) || !words(rights.reviewer_id)) reasons.push('HOLD_RIGHTS')
  if (boundary?.verified !== true || boundary.visual_reviewed !== true ||
      !words(boundary.reviewer_id) || boundary.passage?.file_hash !== entry.file_hash ||
      boundary.items?.file_hash !== entry.file_hash || !locator(boundary.passage?.locator) ||
      !locator(boundary.items?.locator) ||
      !hex(boundary.passage?.start_anchor_hash) || !hex(boundary.passage?.end_anchor_hash) ||
      !hex(boundary.items?.start_anchor_hash) || !hex(boundary.items?.end_anchor_hash) ||
      !words(meta.passage_id) ||
      !words(meta.page) || boundary.passage.page !== meta.page ||
      !words(boundary.items.page) || !words(entry.passage_text) ||
      !Array.isArray(entry.questions) || !entry.questions.length ||
      entry.questions.some(question => !words(question?.id) || !words(question?.stem) ||
        !words(question?.answer) || !stage1.item_types.includes(question?.type)) ||
      new Set(entry.questions?.map(question => question.id)).size !== entry.questions?.length) reasons.push('HOLD_BOUNDARY')
  if (!['expository', 'argumentative', 'narrative'].includes(meta.genre) ||
      !words(meta.difficulty_step) || !/^\d{4}-\d{2}-\d{2}$/.test(meta.access_date ?? '') ||
      Number.isNaN(Date.parse(`${meta.access_date}T00:00:00Z`)) ||
      new Date(`${meta.access_date}T00:00:00Z`).toISOString().slice(0, 10) !== meta.access_date ||
      meta.access_date > stage1.selection_protocol.search_cutoff) reasons.push('HOLD_METADATA')
  return reasons
}

export function buildReviewedScreening(stage1, inventory, probe, reviewed) {
  if (stage1?.status !== 'selection_sealed' ||
      reviewed?.schema !== 'frym-reviewed-passage-input/1' ||
      reviewed.selection_protocol_hash !== stage1.selection_protocol_hash ||
      reviewed.inventory_snapshot_hash !== stage1.selection_protocol.inventory_snapshot_hash ||
      reviewed.cohort !== 'commercial_textbook' ||
      !Array.isArray(reviewed.entries) || forbiddenAnalysis(reviewed) || !Array.isArray(inventory) ||
      probe?.schema !== 'frym-local-pdf-probe/1' || probe.records?.length !== inventory.length) fail('REVIEWED_INPUT_INVALID')
  const byHash = new Map()
  for (const row of inventory) {
    if (!hex(row?.sha256) || !words(row.source_path) || fileHash(row.source_path) !== row.sha256 ||
        !probe.records.some(record => record.file_hash === row.sha256)) fail('INVENTORY_SOURCE_CHANGED')
    const aliases = byHash.get(row.sha256) ?? []
    aliases.push(row)
    byHash.set(row.sha256, aliases)
  }
  if (hash([...byHash.keys()].sort()) !== stage1.selection_protocol.inventory_snapshot_hash ||
      probe.inventory_snapshot_hash !== stage1.selection_protocol.inventory_snapshot_hash ||
      probe.inspected_count !== inventory.length || probe.inventory_count !== inventory.length ||
      hash(probe.records.map(record => record.file_hash).sort()) !== hash(inventory.map(row => row.sha256).sort())) fail('REVIEWED_INVENTORY_MISMATCH')
  const entriesByFile = new Map()
  for (const entry of reviewed.entries) {
    const aliases = byHash.get(entry?.file_hash)
    if (!aliases || !identity(entry, aliases)) fail('REVIEWED_FILE_MISMATCH')
    if (entry.cohort !== reviewed.cohort) fail('COHORT_MISMATCH')
    const entries = entriesByFile.get(entry.file_hash) ?? []
    entries.push(entry)
    entriesByFile.set(entry.file_hash, entries)
  }
  const candidates = [], heldFileHashes = [], heldFiles = {}
  const ids = new Set(), passages = new Set()
  for (const [fileHashValue, aliases] of [...byHash].sort(([a], [b]) => a.localeCompare(b))) {
    const entries = entriesByFile.get(fileHashValue) ?? []
    const reasons = entries.length ? [...new Set(entries.flatMap(entry => evidenceReasons(entry, stage1)))] : ['HOLD_RIGHTS', 'HOLD_GRADE', 'HOLD_EDITION', 'HOLD_BOUNDARY']
    if (reasons.length) {
      heldFileHashes.push(fileHashValue)
      heldFiles[fileHashValue] = { reasons, alias_count: aliases.length }
      continue
    }
    for (const entry of entries) {
      const meta = entry.metadata
      const candidateId = `print:${meta.ISBN}:${meta.edition}:${meta.passage_id}`
      const passageHash = normalizedPassageHash(entry.passage_text)
      if (ids.has(candidateId) || passages.has(passageHash)) fail('DUPLICATE_PASSAGE_CANDIDATE')
      ids.add(candidateId); passages.add(passageHash)
      const itemTypes = Object.fromEntries([...new Set(entry.questions.map(question => question.type))].sort()
        .map(type => [type, entry.questions.filter(question => question.type === type).length]))
      const itemSetHash = hash(entry.questions.map(({ answer, ...item }) => item))
      const scoringKeyHash = hash(entry.questions.map(({ id, answer }) => ({ id, answer })))
      candidates.push({
        candidate_id: candidateId, status: 'metadata_eligible', file_hash: fileHashValue,
        source_path_hash: entry.source_path_hash, candidate_evidence_hash: hash(entry),
        evidence_gate_hashes: Object.fromEntries(['edition', 'grade_scope', 'analysis_rights', 'boundary']
          .map(gate => [gate, hash(entry.evidence[gate])])),
        passage_locator_hash: hash(entry.evidence.boundary.passage.locator),
        item_locator_hash: hash(entry.evidence.boundary.items.locator),
        publisher: meta.publisher, series: meta.series, title: meta.title, grade: meta.grade,
        edition: meta.edition, publication_year: meta.publication_year, ISBN: meta.ISBN,
        passage_id: meta.passage_id, page: meta.page, genre: meta.genre,
        rights_basis: 'authorized_local_analysis', difficulty_step: meta.difficulty_step,
        access_date: meta.access_date, word_count: entry.passage_text.trim().split(/\s+/).length,
        passage_hash: sha256(entry.passage_text), normalized_passage_hash: passageHash,
        item_set_hash: itemSetHash, scoring_key_hash: scoringKeyHash, item_type_counts: itemTypes,
      })
    }
  }
  return {
    schema: 'frym-local-screening-input/1', revision: 3,
    selection_protocol_hash: stage1.selection_protocol_hash,
    inventory_snapshot_hash: stage1.selection_protocol.inventory_snapshot_hash,
    probe_hash: hash(probe), reviewed_input_hash: hash(reviewed),
    screening_scope: 'reviewed_commercial_passage_candidates',
    candidates, held_file_hashes: heldFileHashes, held_files: heldFiles,
  }
}
