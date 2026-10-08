// scripts/textbook/frym-benchmark/reference-admission.test.mjs
import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { AXES, hash } from './benchmark.mjs'
import { normalizedPassageHash } from './two-stage-seal.mjs'
import { admitReference, verifyReferenceSelection } from './reference-admission.mjs'
import { evaluateAdmittedMultiGradeBenchmark, evaluateMultiGradeBenchmark } from './multi-grade-benchmark.mjs'

const sha = value => createHash('sha256').update(value).digest('hex')

function fixture(t, cohort = 'open_reference', grade_scope = { mode: 'grade_range', grades: ['middle_1', 'middle_2'] }) {
  const dir = mkdtempSync(join(tmpdir(), 'benchmark-reference-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const source_path = join(dir, 'source.txt')
  const body = 'Synthetic licensed instructional passage and questions.'
  writeFileSync(source_path, body)
  const file_hash = sha(body)
  const passage_text = 'Plants use sunlight to make food. This process helps them grow.'
  const questions = [{ id: 'Q1', type: 'literal', stem: 'What helps plants grow?', answer: 'Making food.' }]
  const candidate = { candidate_id: 'open:edition-1:p1', cohort, grade_scope,
    publisher: 'Fixture Publisher', series: 'Fixture Series', genre: 'expository', passage_text, questions }
  const codebook = { axes: Object.fromEntries(AXES.map(axis => [axis,
    { scale: 'ratio', valid_min: 0, valid_max: 5, rater_agreement_floor: .7, auxiliary_metrics: [] }])),
  item_types: ['literal'], item_type_difficulty: { scale: 'ratio', valid_min: 0, valid_max: 5 } }
  const evidence = { file_hash,
    edition: { verified: true, file_hash, edition: '2017', reviewer_id: 'edition_reviewer',
      local_locator: 'file:imprint', catalog_url: 'https://example.org/catalog',
      catalog_snapshot_hash: sha('catalog'), local_edition: '2017', catalog_edition: '2017' },
    grade_scope: { ...grade_scope, verified: true, file_hash, reviewer_id: 'grade_reviewer',
      local_locator: 'file:cover', catalog_url: 'https://example.org/catalog',
      catalog_snapshot_hash: sha('catalog'), local_grades: grade_scope.grades,
      catalog_grades: grade_scope.grades },
    rights: { verified: true, file_hash, reviewer_id: 'rights_reviewer',
      evidence_hash: sha('license evidence'), license_snapshot_hash: sha('license snapshot'),
      passage_covered: true, items_covered: true,
      third_party_exception: false, license: 'CC-BY-4.0', license_url: 'https://example.org/license',
      decision: 'AUTHORIZED_FOR_ANALYSIS' },
    boundary: { verified: true, reviewer_id: 'boundary_reviewer',
      passage: { file_hash, locator: 'page:1', start_hash: sha('start'), end_hash: sha('end') },
      items: { file_hash, locator: 'page:2', start_hash: sha('item-start'), end_hash: sha('item-end') } } }
  const rules = { schema: 'benchmark-reference-selection/1', status: 'sealed', cohort,
    inventory_hash: hash([file_hash]), codebook_hash: hash(codebook.axes),
    measurement_contract_hash: hash(codebook), maximum_samples: 1, seed: 'precommitted-seed' }
  const passage_hash = normalizedPassageHash(passage_text)
  const item_set_hash = hash(questions.map(({ answer, ...item }) => item))
  const scoring_key_hash = hash(questions.map(({ id, answer }) => ({ id, answer })))
  const screening = { schema: 'benchmark-reference-screening/1', rules_hash: hash(rules),
    inventory_hash: rules.inventory_hash, held_files: [], candidates: [{ candidate_id: candidate.candidate_id,
      status: 'metadata_eligible', cohort, file_hash, source_path_hash: sha(source_path.normalize('NFC')),
      passage_hash, item_set_hash,
      scoring_key_hash, evidence_hash: hash(evidence), grade_scope }] }
  const manifest = { schema: 'benchmark-reference-manifest/1', status: 'sealed', rules_hash: hash(rules),
    screening_hash: hash(screening), selected_ids: [candidate.candidate_id] }
  const analysis = { codebook_hash: rules.codebook_hash, passage_hash, item_set_hash,
    analyzer_version: 'fixture-1', evidence_hash: sha('analysis evidence'),
    metrics: Object.fromEntries(AXES.map(axis => [axis, 2])),
    axis_agreement: Object.fromEntries(AXES.map(axis => [axis, .9])),
    item_type_difficulty: { literal: 2 } }
  return { source_path, candidate, evidence, analysis, codebook, rules, screening, manifest }
}

test('open reference preserves a range-grade admission receipt and fails closed on changed evidence', t => {
  const input = fixture(t)
  const { receipt, reference } = admitReference(input)
  assert.equal(receipt.cohort, 'open_reference')
  assert.deepEqual(reference.grade_scope, { mode: 'grade_range', grades: ['middle_1', 'middle_2'] })
  assert.equal(reference.rights_basis, 'open_license_verified')
  assert.equal(reference.admission_receipt_hash, hash(receipt))
  const altered = structuredClone(input)
  altered.evidence.rights.third_party_exception = true
  altered.screening.candidates[0].evidence_hash = hash(altered.evidence)
  altered.manifest.screening_hash = hash(altered.screening)
  assert.throws(() => admitReference(altered), /REFERENCE_RIGHTS_UNVERIFIED/)
  assert.throws(() => admitReference({ ...input, candidate: { ...input.candidate, passage_text: 'Changed.' } }), /REFERENCE_CONTENT_CHANGED/)
  assert.throws(() => admitReference({ ...input, analysis: { ...input.analysis,
    axis_agreement: { ...input.analysis.axis_agreement, inference: .2 } } }), /REFERENCE_AXIS_EVIDENCE_INVALID/)
  assert.throws(() => admitReference({ ...input, codebook: { ...input.codebook,
    item_type_difficulty: { ...input.codebook.item_type_difficulty, valid_max: 20 } } }),
  /REFERENCE_MEASUREMENT_CONTRACT_CHANGED/)
  writeFileSync(input.source_path, 'Changed original file')
  assert.throws(() => admitReference(input), /REFERENCE_SOURCE_CHANGED/)
})

test('government public-domain reference requires specific passage and item origin evidence', t => {
  const input = fixture(t)
  input.evidence.rights.license = 'US-GOV-PUBLIC-DOMAIN'
  input.evidence.rights.license_url = 'https://www.nasa.gov/nasa-brand-center/images-and-media/'
  input.screening.candidates[0].evidence_hash = hash(input.evidence)
  input.manifest.screening_hash = hash(input.screening)
  assert.throws(() => admitReference(input), /REFERENCE_RIGHTS_UNVERIFIED/)
  input.evidence.rights.passage_origin_url = 'https://www.nasa.gov/example/student-guide.pdf'
  input.evidence.rights.items_origin_url = input.evidence.rights.passage_origin_url
  input.evidence.rights.passage_origin_hash = input.evidence.file_hash
  input.evidence.rights.items_origin_hash = input.evidence.file_hash
  input.evidence.rights.scoring_origin_url = 'https://www.nasa.gov/example/educator-guide.pdf'
  input.evidence.rights.scoring_origin_hash = sha('educator guide answers')
  input.scoring_source_path = join(input.source_path, '..', 'educator-guide.txt')
  writeFileSync(input.scoring_source_path, 'educator guide answers')
  input.screening.candidates[0].evidence_hash = hash(input.evidence)
  input.manifest.screening_hash = hash(input.screening)
  assert.equal(admitReference(input).reference.rights_basis, 'public_domain_verified')
  writeFileSync(input.scoring_source_path, 'changed answer guide')
  assert.throws(() => admitReference(input), /REFERENCE_SCORING_SOURCE_CHANGED/)
  writeFileSync(input.scoring_source_path, 'educator guide answers')
  const nongovernment = structuredClone(input)
  nongovernment.evidence.rights.passage_origin_url = 'https://www.nasa.gov.evil.example/student-guide.pdf'
  nongovernment.screening.candidates[0].evidence_hash = hash(nongovernment.evidence)
  nongovernment.manifest.screening_hash = hash(nongovernment.screening)
  assert.throws(() => admitReference(nongovernment), /REFERENCE_RIGHTS_UNVERIFIED/)
  input.evidence.rights.third_party_exception = true
  input.screening.candidates[0].evidence_hash = hash(input.evidence)
  input.manifest.screening_hash = hash(input.screening)
  assert.throws(() => admitReference(input), /REFERENCE_RIGHTS_UNVERIFIED/)
})

test('sealed selection, cohort and grade scope reject mixed or stale inputs', t => {
  const input = fixture(t)
  assert.deepEqual(verifyReferenceSelection(input).selected_ids, [input.candidate.candidate_id])
  assert.throws(() => admitReference({ ...input, evidence: { ...input.evidence,
    grade_scope: { ...input.evidence.grade_scope, grades: ['middle_1'] } } }), /REFERENCE_CANDIDATE_STALE/)
  assert.throws(() => admitReference({ ...input, candidate: { ...input.candidate,
    cohort: 'commercial_textbook' } }), /REFERENCE_CANDIDATE_STALE/)
  assert.throws(() => verifyReferenceSelection({ ...input, manifest: { ...input.manifest,
    selected_ids: [] } }), /REFERENCE_MANIFEST_SELECTION_INVALID/)
  const leaked = structuredClone(input)
  leaked.screening.candidates[0].metrics = { lexical: 5 }
  leaked.manifest.screening_hash = hash(leaked.screening)
  assert.throws(() => verifyReferenceSelection(leaked), /REFERENCE_SELECTION_CHAIN_INVALID/)
  const held = structuredClone(input)
  held.screening.held_files.push({ file_hash: held.screening.candidates[0].file_hash, reason: 'rights_pending' })
  held.manifest.screening_hash = hash(held.screening)
  assert.throws(() => verifyReferenceSelection(held), /REFERENCE_HELD_FILE_MIXED/)
  const mixed = structuredClone(input)
  mixed.screening.candidates[0].cohort = 'commercial_textbook'
  mixed.manifest.screening_hash = hash(mixed.screening)
  assert.throws(() => verifyReferenceSelection(mixed), /REFERENCE_SCREENING_INVALID/)
})

test('commercial authorized analysis and single-grade scope remain separate', t => {
  const input = fixture(t, 'commercial_textbook', { mode: 'single_grade', grades: ['middle_1'] })
  const result = admitReference(input)
  assert.equal(result.reference.rights_basis, 'authorized_local_analysis')
  const altered = structuredClone(input)
  altered.evidence.rights.decision = 'CATALOG_REFERENCE_ONLY'
  altered.screening.candidates[0].evidence_hash = hash(altered.evidence)
  altered.manifest.screening_hash = hash(altered.screening)
  assert.throws(() => admitReference(altered), /REFERENCE_RIGHTS_UNVERIFIED/)
})

test('multi-grade evaluation re-admits file-backed references before reading them', t => {
  const input = fixture(t)
  const { receipt, reference } = admitReference(input)
  const contract = { reference_cohort: 'open_reference' }
  assert.throws(() => evaluateMultiGradeBenchmark({ contract, references: [reference] }),
    /OPEN_REFERENCE_ADMISSION_REQUIRED/)
  assert.throws(() => evaluateAdmittedMultiGradeBenchmark({
    contract, admitted: [{ input, receipt: { ...receipt, file_hash: sha('other') }, reference }],
  }), /ADMITTED_REFERENCE_STALE_OR_MIXED/)
  assert.throws(() => evaluateAdmittedMultiGradeBenchmark({
    contract, admitted: [{ input, receipt, reference: { ...reference, grade_scope: { mode: 'single_grade', grades: ['middle_1'] } } }],
  }), /ADMITTED_REFERENCE_STALE_OR_MIXED/)
  assert.throws(() => evaluateAdmittedMultiGradeBenchmark({
    contract, admitted: [{ input, receipt, reference }],
  }), /MULTI_GRADE_CONTRACT_INVALID/)
})

test('CLI writes a create-only metadata receipt without textbook text', t => {
  const input = fixture(t)
  const dir = mkdtempSync(join(tmpdir(), 'benchmark-reference-cli-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const paths = Object.fromEntries(['rules', 'screening', 'manifest'].map(key => {
    const path = join(dir, `${key}.json`)
    writeFileSync(path, JSON.stringify(input[key]))
    return [key, path]
  }))
  const bundle = join(dir, 'bundle.json'), output = join(dir, 'receipt.json')
  writeFileSync(bundle, JSON.stringify({ source_path: input.source_path,
    candidate: input.candidate, evidence: input.evidence, analysis: input.analysis,
    codebook: input.codebook }))
  const run = () => spawnSync(process.execPath, [join(import.meta.dirname, 'reference-admit.mjs'),
    paths.rules, paths.screening, paths.manifest, bundle, output], { encoding: 'utf8' })
  const first = run()
  assert.equal(first.status, 0, first.stderr)
  assert.equal(run().status, 1)
  const saved = readFileSync(output, 'utf8')
  assert.equal(saved.includes(input.candidate.passage_text), false)
  assert.equal(saved.includes(input.candidate.questions[0].stem), false)
  assert.deepEqual(JSON.parse(saved).reference.grade_scope, input.candidate.grade_scope)
})
