// scripts/textbook/frym-benchmark/reviewed-intake.test.mjs
import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash } from 'node:crypto'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { hash, validateProtocol } from './benchmark.mjs'
import { buildReviewedScreening } from './reviewed-intake.mjs'
import { admitCandidate } from './local-admission.mjs'

const sha = value => createHash('sha256').update(value).digest('hex')
const run = (script, ...args) => spawnSync(process.execPath, [join(import.meta.dirname, script), ...args], { encoding: 'utf8' })
const read = path => JSON.parse(readFileSync(path, 'utf8'))

test('reviewed passage handoff seals a new manifest and rejects missing or mixed evidence', t => {
  const root = mkdtempSync(join(tmpdir(), 'frym-reviewed-intake-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const sourceRoot = join(root, 'sources')
  mkdirSync(sourceRoot)
  const inventory = Array.from({ length: 31 }, (_, index) => {
    const source_path = join(sourceRoot, `file-${index}.txt`)
    const body = `synthetic-source-${index % 30}`
    writeFileSync(source_path, body)
    return { source_path, sha256: sha(body) }
  })
  const inventoryPath = join(root, 'inventory.json')
  const stage1Path = join(root, 'stage1.json')
  const seedPath = join(root, 'seed.json')
  const probePath = join(root, 'probe.json')
  const inputPath = join(root, 'reviewed.json')
  const screeningPath = join(root, 'screening-r3.json')
  const protocolPath = join(root, 'manifest-r3.json')
  writeFileSync(inventoryPath, JSON.stringify(inventory))
  assert.equal(run('real-intake-seal.mjs', 'seal-selection', inventoryPath, sourceRoot,
    stage1Path, seedPath, '2026-10-08').status, 0)
  const stage1 = read(stage1Path)
  const probe = { schema: 'frym-local-pdf-probe/1', inventory_count: 31, inspected_count: 31,
    inventory_snapshot_hash: stage1.selection_protocol.inventory_snapshot_hash,
    records: inventory.map(row => ({ file_hash: row.sha256, status: 'front_metadata_extracted' })) }
  writeFileSync(probePath, JSON.stringify(probe))
  const source = inventory[0]
  const entry = {
    file_hash: source.sha256, source_path_hash: sha(source.source_path.normalize('NFC')),
    cohort: 'commercial_textbook',
    metadata: { publisher: 'Synthetic Publisher', series: 'Synthetic Series', title: 'Synthetic Reading',
      edition: '2026-1', publication_year: 2026, ISBN: '9780000000001', grade: 'middle_1',
      passage_id: 'P01', page: '12', genre: 'expository', difficulty_step: 'intro', access_date: '2026-10-08' },
    evidence: {
      edition: { verified: true, file_hash: source.sha256, local_locator: 'file:imprint_2',
        catalog_url: 'https://example.test/book', catalog_snapshot_hash: sha('catalog snapshot'),
        reviewer_id: 'edition_reviewer',
        local_isbn: '9780000000001', catalog_isbn: '9780000000001',
        local_edition: '2026-1', catalog_edition: '2026-1', local_year: 2026, catalog_year: 2026 },
      grade_scope: { verified: true, file_hash: source.sha256, grades: ['middle_1'],
        local_grades: ['middle_1'], catalog_grades: ['middle_1'],
        local_locator: 'file:cover_1', catalog_url: 'https://example.test/book',
        catalog_snapshot_hash: sha('catalog snapshot'), reviewer_id: 'grade_reviewer' },
      analysis_rights: { verified: true, decision: 'AUTHORIZED_FOR_ANALYSIS',
        covered_file_hash: source.sha256, grantor: 'Synthetic Rights Holder',
        scope: 'internal_analysis', document_hash: sha('synthetic permission'),
        evidence_locator: 'permission:record_1', reviewer_id: 'rights_reviewer' },
      boundary: { verified: true, visual_reviewed: true, reviewer_id: 'boundary_reviewer',
        passage: { file_hash: source.sha256, locator: 'file:passage_12', page: '12',
          start_anchor_hash: sha('passage start'), end_anchor_hash: sha('passage end') },
        items: { file_hash: source.sha256, locator: 'file:items_13', page: '13',
          start_anchor_hash: sha('item start'), end_anchor_hash: sha('item end') } },
    },
    passage_text: 'A synthetic passage has enough words for a reviewed candidate.',
    questions: [{ id: 'Q1', type: 'literal', stem: 'What does the synthetic passage state?', answer: 'A reviewed candidate.' }],
  }
  const reviewed = { schema: 'frym-reviewed-passage-input/1', cohort: 'commercial_textbook',
    selection_protocol_hash: stage1.selection_protocol_hash,
    inventory_snapshot_hash: stage1.selection_protocol.inventory_snapshot_hash, entries: [entry] }
  writeFileSync(inputPath, JSON.stringify(reviewed))
  const screened = run('real-intake-screen-reviewed.mjs', stage1Path, inventoryPath, probePath, inputPath, screeningPath)
  assert.equal(screened.status, 0, screened.stderr)
  const screening = read(screeningPath)
  assert.equal(screening.candidates.length, 1)
  assert.equal(screening.held_file_hashes.length, 29)
  assert.equal(screening.candidates[0].candidate_id, 'print:9780000000001:2026-1:P01')
  assert.equal(screening.candidates[0].evidence_gate_hashes.analysis_rights,
    hash(entry.evidence.analysis_rights))
  assert.equal(JSON.stringify(screening).includes(entry.passage_text), false)
  assert.equal(JSON.stringify(screening).includes(entry.questions[0].stem), false)
  assert.equal(run('real-intake-seal.mjs', 'seal-manifest-reviewed', stage1Path, screeningPath, probePath,
    inventoryPath, sourceRoot, seedPath, protocolPath, inputPath).status, 0)
  const protocol = read(protocolPath)
  assert.equal(typeof validateProtocol(protocol), 'string')
  assert.equal(protocol.selection_manifest.selected_sample_ids.length, 1)
  assert.equal(protocol.selection_manifest.coverage_status, 'insufficient_benchmark')
  const importCandidate = {
    source_path: source.source_path, expected_file_hash: source.sha256,
    reviewed_evidence: entry,
    metadata: { ...entry.metadata, sample_id: screening.candidates[0].candidate_id,
      rights_basis: 'authorized_local_analysis' },
    extraction: { source_file_hash: source.sha256, passage_id: entry.metadata.passage_id,
      page_range: entry.metadata.page, passage_text: entry.passage_text, questions: entry.questions,
      boundary_confirmed: true, question_boundary_confirmed: true, method: 'fixture', ocr_used: false,
      passage_locator: 'file:passage_12', item_locator: 'file:items_14' },
  }
  assert.deepEqual(admitCandidate(importCandidate, protocol).audit.reasons, ['REVIEWED_CANDIDATE_STALE'])
  const changedItem = structuredClone(importCandidate)
  changedItem.reviewed_evidence = entry
  changedItem.extraction.item_locator = 'file:items_13'
  changedItem.extraction.questions[0].stem = 'A different item with the same type.'
  assert.deepEqual(admitCandidate(changedItem, protocol).audit.reasons, ['REVIEWED_CANDIDATE_STALE'])
  const wrongReview = structuredClone(importCandidate)
  wrongReview.reviewed_evidence = { ...entry, evidence: { ...entry.evidence,
    analysis_rights: { ...entry.evidence.analysis_rights, document_hash: sha('changed permission') } } }
  assert.deepEqual(admitCandidate(wrongReview, protocol).audit.reasons, ['REVIEWED_EVIDENCE_MISMATCH'])
  const wrongAlias = { ...importCandidate, source_path: inventory[30].source_path }
  assert.deepEqual(admitCandidate(wrongAlias, protocol).audit.reasons, ['REVIEWED_EVIDENCE_MISMATCH'])
  assert.equal(run('real-intake-seal.mjs', 'verify-reviewed', stage1Path, screeningPath, probePath,
    inventoryPath, sourceRoot, protocolPath, inputPath).status, 0)
  assert.notEqual(run('real-intake-seal.mjs', 'seal-manifest-reviewed', stage1Path, screeningPath, probePath,
    inventoryPath, sourceRoot, seedPath, protocolPath, inputPath).status, 0)
  assert.match(run('real-intake-seal.mjs', 'seal-manifest', stage1Path, screeningPath, probePath,
    inventoryPath, sourceRoot, seedPath, join(root, 'legacy-manifest.json')).stderr,
  /REVIEWED_SCREENING_SCOPE_INVALID/)

  const changed = structuredClone(reviewed)
  changed.entries[0].evidence.boundary.items.locator = 'file:items_14'
  const changedPath = join(root, 'changed.json')
  writeFileSync(changedPath, JSON.stringify(changed))
  assert.notEqual(run('real-intake-seal.mjs', 'verify-reviewed', stage1Path, screeningPath, probePath,
    inventoryPath, sourceRoot, protocolPath, changedPath).status, 0)
  const noRights = structuredClone(reviewed)
  noRights.entries[0].evidence.analysis_rights.decision = 'CATALOG_REFERENCE_ONLY'
  assert.equal(buildReviewedScreening(stage1, inventory, probe, noRights).candidates.length, 0)
  const crossFile = structuredClone(reviewed)
  crossFile.entries[0].evidence.boundary.items.file_hash = inventory[1].sha256
  assert.equal(buildReviewedScreening(stage1, inventory, probe, crossFile).candidates.length, 0)
  const uncertainBoundary = structuredClone(reviewed)
  uncertainBoundary.entries[0].evidence.boundary.visual_reviewed = false
  assert.equal(buildReviewedScreening(stage1, inventory, probe, uncertainBoundary).candidates.length, 0)
  const mismatchedEdition = structuredClone(reviewed)
  mismatchedEdition.entries[0].evidence.edition.catalog_isbn = '9780000000002'
  assert.equal(buildReviewedScreening(stage1, inventory, probe, mismatchedEdition).candidates.length, 0)
  const range = structuredClone(reviewed)
  range.entries[0].evidence.grade_scope.grades = ['middle_1', 'middle_2']
  range.entries[0].evidence.grade_scope.local_grades = ['middle_1', 'middle_2']
  range.entries[0].evidence.grade_scope.catalog_grades = ['middle_1', 'middle_2']
  const rangeScreening = buildReviewedScreening(stage1, inventory, probe, range)
  assert.equal(rangeScreening.candidates.length, 0)
  assert.deepEqual(rangeScreening.held_files[source.sha256].reasons, ['HOLD_GRADE_SCOPE_PROTOCOL'])
  const prematureAnalysis = structuredClone(reviewed)
  prematureAnalysis.entries[0].analysis = { metrics: { lexical: 1 } }
  assert.throws(() => buildReviewedScreening(stage1, inventory, probe, prematureAnalysis), /REVIEWED_INPUT_INVALID/)
  const mixed = structuredClone(reviewed)
  mixed.entries[0].cohort = 'open_reference'
  assert.throws(() => buildReviewedScreening(stage1, inventory, probe, mixed), /COHORT_MISMATCH/)
  const duplicate = structuredClone(reviewed)
  duplicate.entries.push(structuredClone(entry))
  assert.throws(() => buildReviewedScreening(stage1, inventory, probe, duplicate), /DUPLICATE_PASSAGE_CANDIDATE/)
  const samePassageDifferentFile = structuredClone(reviewed)
  const otherEntry = structuredClone(entry)
  otherEntry.file_hash = inventory[1].sha256
  otherEntry.source_path_hash = sha(inventory[1].source_path.normalize('NFC'))
  otherEntry.metadata.ISBN = '9780000000002'
  otherEntry.passage_text = `  ${entry.passage_text.replaceAll(' ', '   ')}  `
  otherEntry.evidence.edition.file_hash = inventory[1].sha256
  otherEntry.evidence.edition.local_isbn = '9780000000002'
  otherEntry.evidence.edition.catalog_isbn = '9780000000002'
  otherEntry.evidence.grade_scope.file_hash = inventory[1].sha256
  otherEntry.evidence.analysis_rights.covered_file_hash = inventory[1].sha256
  otherEntry.evidence.boundary.passage.file_hash = inventory[1].sha256
  otherEntry.evidence.boundary.items.file_hash = inventory[1].sha256
  samePassageDifferentFile.entries.push(otherEntry)
  assert.throws(() => buildReviewedScreening(stage1, inventory, probe, samePassageDifferentFile), /DUPLICATE_PASSAGE_CANDIDATE/)
  const changedSource = structuredClone(inventory)
  writeFileSync(changedSource[0].source_path, 'changed source')
  assert.throws(() => buildReviewedScreening(stage1, changedSource, probe, reviewed), /INVENTORY_SOURCE_CHANGED/)
  assert.equal(protocol.metadata_screening.candidates[0].candidate_evidence_hash, hash(entry))
})
