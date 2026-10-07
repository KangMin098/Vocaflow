// scripts/textbook/frym-benchmark/real-intake-seal.mjs
import { createHash, randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { AXES, GRADES, hash, validateProtocol } from './benchmark.mjs'
import { cohortComposition, cohortCoverage, screeningInventoryHash } from './two-stage-seal.mjs'
import { recomputeSelection } from './selection-audit.mjs'
import { buildEvidenceLedger } from './real-intake-enrich.mjs'

const [command, ...args] = process.argv.slice(2)
const fail = code => { throw Error(code) }
const read = path => JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''))
const writeNew = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' })
const sha256 = value => createHash('sha256').update(value).digest('hex')
const fileHash = path => sha256(readFileSync(path))
const validateEvidenceLedger = (supplied, stage1, stage1Path, checked, inventory, inventoryPath, ledgerPath, catalogPath, dbPath) => {
  const enriched = supplied.screening_scope === 'file_level_enriched_hints_no_confirmed_passage_candidates'
  if (!enriched && supplied.screening_scope !== 'file_level_metadata_only_no_confirmed_passage_candidates') fail('SCREENING_SCOPE_INVALID')
  if (!enriched) {
    if (supplied.revision !== undefined || supplied.evidence_ledger_hash || ledgerPath || catalogPath || dbPath ||
        Object.values(supplied.held_files ?? {}).some(held => 'catalog_match' in held || 'catalog_doc_id' in held ||
          'catalog_role_hint' in held || 'catalog_grade_hint' in held || 'extracted_page_count' in held ||
          'possible_passage_page_count' in held || 'possible_item_page_count' in held ||
          'page_lists_truncated' in held)) fail('EVIDENCE_LEDGER_UNEXPECTED')
    return
  }
  if (supplied.revision !== 2 || supplied.candidates?.length !== 0 || supplied.held_file_hashes?.length !== 30) fail('EVIDENCE_SCREENING_SCOPE_INVALID')
  if (![ledgerPath, catalogPath, dbPath].every(Boolean)) fail('EVIDENCE_LEDGER_MISSING')
  const ledger = read(ledgerPath)
  const rebuilt = buildEvidenceLedger(stage1Path, inventoryPath, catalogPath, dbPath)
  if (ledger.schema !== 'frym-local-evidence-ledger/1' || ledger.status !== 'unreviewed_hints' ||
      ledger.selection_protocol_hash !== stage1.selection_protocol_hash ||
      ledger.inventory_snapshot_hash !== stage1.selection_protocol.inventory_snapshot_hash ||
      ledger.catalog_file_hash !== fileHash(catalogPath) || ledger.corpus_db_file_hash !== fileHash(dbPath) ||
      supplied.evidence_ledger_hash !== hash(ledger) || hash(ledger) !== hash(rebuilt) || !Array.isArray(ledger.entries) ||
      ledger.entries.length !== inventory.length ||
      hash(ledger.entries.map(entry => [entry.file_hash, entry.source_path_hash]).sort()) !==
        hash(inventory.map(row => [row.sha256, sha256(row.source_path.normalize('NFC'))]).sort()) ||
      hash(ledger.entries.map(entry => entry.file_hash).sort()) !== hash(checked.map(row => row.file_hash).sort()) ||
      ledger.entries.some(entry => entry.rights_evidence !== null || entry.confirmed_publisher_edition !== null ||
        entry.confirmed_single_grade !== null || entry.confirmed_passage_item_boundary !== null)) fail('EVIDENCE_LEDGER_STALE')
  for (const fileHashValue of stage1.selection_protocol.inventory_file_hashes) {
    const entry = ledger.entries.find(row => row.file_hash === fileHashValue)
    const held = supplied.held_files?.[fileHashValue]
    if (!entry || !held || held.catalog_match !== entry.catalog_match || held.catalog_doc_id !== entry.catalog_doc_id ||
        held.catalog_role_hint !== entry.catalog_role_hint || held.catalog_grade_hint !== entry.catalog_grade_hint ||
        held.extracted_page_count !== entry.extracted_page_count ||
        held.possible_passage_page_count !== entry.possible_passage_page_count ||
        held.possible_item_page_count !== entry.possible_item_page_count ||
        held.page_lists_truncated !== entry.page_lists_truncated) fail('EVIDENCE_SCREENING_MISMATCH')
  }
}
const relativeSource = (root, sourcePath) => {
  const result = relative(resolve(root), resolve(sourcePath)).replaceAll('\\', '/')
  if (!result || result === '..' || result.startsWith('../') || result.includes(':')) fail('INVENTORY_PATH_OUTSIDE_ROOT')
  return result.normalize('NFC')
}
const checkedInventory = (inventoryPath, root) => {
  const inventory = read(inventoryPath)
  if (!Array.isArray(inventory) || inventory.length !== 31) fail('INVENTORY_SCOPE_MISMATCH')
  const checked = inventory.map(row => {
    if (typeof row.source_path !== 'string' || !/^[a-f0-9]{64}$/.test(row.sha256 ?? '')) fail('INVENTORY_ROW_INVALID')
    const actual = fileHash(row.source_path)
    if (actual !== row.sha256) fail('INVENTORY_SOURCE_CHANGED')
    return { file_hash: actual, relative_path: relativeSource(root, row.source_path) }
  })
  if (new Set(checked.map(row => row.relative_path)).size !== 31 ||
      new Set(checked.map(row => row.file_hash)).size !== 30) fail('INVENTORY_SCOPE_MISMATCH')
  return checked
}

const anchors = {
  lexical: ['frequent concrete words', 'mostly familiar with few glossed terms', 'some academic or polysemous terms', 'many abstract or low-frequency terms', 'dense specialist vocabulary'],
  syntax: ['mostly single-clause direct sentences', 'occasional simple subordination', 'regular subordinate or passive structures', 'nested modification and reference tracking', 'sustained multi-clause embedding'],
  information_density: ['one explicit idea per short segment', 'few new concepts with repetition', 'several linked propositions', 'dense new concepts with sparse restatement', 'high proposition density throughout'],
  discourse: ['explicit sequence and signposts', 'one explicit causal or contrast link', 'multiple linked paragraph functions', 'partly implicit cross-paragraph relations', 'layered or competing discourse relations'],
  inference: ['directly stated answers', 'single-step local inference', 'paraphrase across adjacent sentences', 'multi-step cross-paragraph inference', 'implicit synthesis with competing interpretations'],
  background_knowledge: ['all needed concepts explained', 'one familiar outside concept', 'some assumed school knowledge', 'several assumed domain concepts', 'specialist background needed to interpret claims'],
  abstraction: ['concrete objects and events', 'concrete examples with one abstraction', 'balanced concrete and conceptual content', 'mainly conceptual claims', 'theoretical or highly abstract relations'],
  item_difficulty: ['answer copied from nearby sentence', 'local paraphrase with weak distractors', 'one inference or distant evidence', 'multiple evidence locations and plausible distractors', 'multi-step evidence synthesis with strong distractors'],
  processing_load: ['short text with few referents', 'modest text and low retention', 'moderate text and several referents', 'longer text with sustained retention', 'high length and information-retention demand'],
}
const axes = Object.fromEntries(AXES.map(axis => [axis, {
  metric: `${axis}_ordinal`, scale: 'ordinal', unit: 'five_anchor_level',
  measurement_method: 'blind_independent_human_rubric_v1', missing_rule: 'inconclusive',
  rater_policy: 'two_independent_raters_third_adjudicator_on_disagreement', direction: 1,
  resolution: 1, minimum_meaningful_delta: 1, auxiliary_metrics: [], auxiliary_override_rule: 'none',
  rater_agreement_floor: .8, missing_priority: 'inconclusive', levels: anchors[axis],
}]))

function selection(inventoryPath, root, outputPath, seedPath, cutoff) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cutoff ?? '') || Number.isNaN(Date.parse(`${cutoff}T00:00:00Z`))) fail('CUTOFF_INVALID')
  const checked = checkedInventory(inventoryPath, root)
  const inventoryFileHashes = [...new Set(checked.map(row => row.file_hash))].sort()
  const minimum = { per_grade: 30, publishers: 3, series_per_publisher: 2, max_publisher_share: .4, max_series_share: .2, comparison_n: 12, item_type_comparison_n: 12 }
  const itemTypes = ['literal', 'inference', 'structure']
  const itemTypeDifficulty = { scale: 'ratio', valid_min: 0, valid_max: 100 }
  const fit = { lower_quantile: .1, upper_quantile: .9, minimum_axes: 7, length_ratio_min: .75, length_ratio_max: 1.25 }
  const separation = { minimum_stable_axes: 5, minimum_matching_axes: 3, minimum_reference_ratio: .5, maximum_opposite_axes: 1 }
  const codebookHash = hash(axes)
  const inventorySnapshotHash = screeningInventoryHash(inventoryFileHashes)
  const runId = `local-${cutoff}-${randomBytes(8).toString('hex')}`
  const seed = randomBytes(16).toString('hex')
  const selectionProtocol = {
    schema: 'frym-selection-protocol/1', status: 'sealed', run_id: runId,
    seed, search_cutoff: cutoff, search_sources: [],
    inventory_scope: 'preexisting_local_31_file_snapshot_only',
    inventory_file_count: checked.length,
    inventory_path_hashes: checked.map(row => sha256(row.relative_path)).sort(),
    inventory_file_hashes: inventoryFileHashes, inventory_snapshot_hash: inventorySnapshotHash,
    selection_algorithm: 'hash_rank_feasible_v1', genre_quota: { expository: 12, argumentative: 12, narrative: 6 },
    length_bins: { short_max: 149, medium_max: 299, minimum_each: 6 },
    grade_policy: 'single_grade_only', rights_policy: 'authorized_local_analysis_only',
    preview_policy: 'sample_only_flagged', duplicate_policy: 'one_per_normalized_passage_hash',
    candidate_id_rule: 'print:ISBN:edition:passage_id|digital:publisher_id:canonical_url:edition:passage_id',
    screening_rule: 'require_explicit_publisher_series_edition_year_single_grade_rights_passage_and_question_boundaries;otherwise_hold',
    codebook_hash: codebookHash,
    rules_hash: hash({ minimum, item_types: itemTypes, item_type_difficulty: itemTypeDifficulty, fit, separation }),
  }
  const stage1 = {
    schema: 'frym-benchmark/2', status: 'selection_sealed', version: runId, grades: [...GRADES],
    axes, codebook_hash: codebookHash, minimum, item_types: itemTypes, item_type_difficulty: itemTypeDifficulty,
    fit, separation, selection_protocol: { ...selectionProtocol, seed: undefined },
    selection_public_hash: hash({ ...selectionProtocol, seed: undefined }),
    seed_commitment: sha256(seed), selection_protocol_hash: hash(selectionProtocol),
  }
  writeNew(outputPath, stage1)
  writeNew(seedPath, { run_id: runId, seed })
  return { run_id: runId, file_count: checked.length, unique_files: inventoryFileHashes.length, selection_protocol_hash: stage1.selection_protocol_hash }
}

function finalize(stage1Path, screeningPath, probePath, inventoryPath, root, seedPath, outputPath, ledgerPath, catalogPath, dbPath) {
  const stage1 = read(stage1Path)
  const seedRecord = read(seedPath)
  if (stage1?.status !== 'selection_sealed' || hash(stage1.selection_protocol) !== stage1.selection_public_hash ||
      hash(stage1.axes) !== stage1.codebook_hash) fail('STAGE1_STALE')
  if (seedRecord.run_id !== stage1.version || sha256(seedRecord.seed) !== stage1.seed_commitment) fail('SEED_COMMITMENT_MISMATCH')
  const rules = { ...stage1.selection_protocol, seed: seedRecord.seed }
  if (hash(rules) !== stage1.selection_protocol_hash) fail('SELECTION_PROTOCOL_STALE')
  const checked = checkedInventory(inventoryPath, root)
  if (hash(checked.map(row => sha256(row.relative_path)).sort()) !== hash(stage1.selection_protocol.inventory_path_hashes) ||
      screeningInventoryHash(new Set(checked.map(row => row.file_hash))) !== stage1.selection_protocol.inventory_snapshot_hash) fail('INVENTORY_SOURCE_CHANGED')
  const supplied = read(screeningPath)
  const probe = read(probePath)
  validateEvidenceLedger(supplied, stage1, stage1Path, checked, read(inventoryPath), inventoryPath, ledgerPath, catalogPath, dbPath)
  const inventoryHashes = new Set(stage1.selection_protocol.inventory_file_hashes)
  if (supplied.selection_protocol_hash !== stage1.selection_protocol_hash ||
      supplied.inventory_snapshot_hash !== rules.inventory_snapshot_hash ||
      supplied.probe_hash !== hash(probe) || probe.inventory_snapshot_hash !== rules.inventory_snapshot_hash ||
      probe.inventory_count !== 31 || probe.inspected_count !== 31 || probe.records?.length !== 31 ||
      hash(probe.records.map(row => row.file_hash).sort()) !== hash(checked.map(row => row.file_hash).sort()) ||
      !Array.isArray(supplied.candidates) || !Array.isArray(supplied.held_file_hashes) ||
      supplied.candidates.some(row => !inventoryHashes.has(row.file_hash)) ||
      supplied.held_file_hashes.some(fileHash => !inventoryHashes.has(fileHash)) ||
      new Set(supplied.held_file_hashes).size !== supplied.held_file_hashes.length ||
      new Set([...supplied.candidates.map(row => row.file_hash), ...supplied.held_file_hashes]).size !== inventoryHashes.size ||
      ![...inventoryHashes].every(fileHash => supplied.candidates.some(row => row.file_hash === fileHash) || supplied.held_file_hashes.includes(fileHash)) ||
      !supplied.held_files || hash(Object.keys(supplied.held_files).sort()) !== hash([...supplied.held_file_hashes].sort()) ||
      supplied.held_file_hashes.some(fileHash => !Array.isArray(supplied.held_files[fileHash]?.reasons) ||
        !supplied.held_files[fileHash].reasons.length ||
        supplied.held_files[fileHash].reasons.some(reason => !['HOLD_RIGHTS', 'HOLD_GRADE', 'HOLD_EDITION', 'HOLD_BOUNDARY', 'HOLD_OCR', 'HOLD_FORMAT', 'HOLD_DUPLICATE'].includes(reason)))) fail('SCREENING_INPUT_INVALID')
  const screening = {
    schema: 'frym-metadata-screening/1', status: 'frozen', run_id: rules.run_id,
    ...(supplied.revision ? { revision: supplied.revision } : {}),
    selection_protocol_hash: stage1.selection_protocol_hash,
    inventory_snapshot_hash: rules.inventory_snapshot_hash,
    candidates: supplied.candidates, held_file_hashes: supplied.held_file_hashes,
    held_files: supplied.held_files, probe_hash: supplied.probe_hash,
    screening_input_hash: hash(supplied), screening_scope: supplied.screening_scope,
    ...(supplied.evidence_ledger_hash ? { evidence_ledger_hash: supplied.evidence_ledger_hash } : {}),
  }
  const { selection_public_hash, seed_commitment, ...base } = stage1
  const protocol = { ...base, status: 'sealed', selection_protocol: rules, metadata_screening: screening, metadata_screening_hash: hash(screening) }
  const selected = recomputeSelection(protocol)
  const representativeEditions = Object.fromEntries(screening.candidates.filter(row => selected.selected_sample_ids.includes(row.candidate_id)).map(row => [JSON.stringify([row.publisher, row.title]), row.edition]))
  const manifest = {
    schema: 'frym-benchmark-selection/1', status: 'sealed', run_id: stage1.selection_protocol.run_id,
    ...(supplied.revision ? { revision: supplied.revision } : {}),
    selection_protocol_hash: stage1.selection_protocol_hash, metadata_screening_hash: protocol.metadata_screening_hash,
    inventory_snapshot_hash: stage1.selection_protocol.inventory_snapshot_hash,
    ...selected, representative_editions: representativeEditions,
    cohort_composition: cohortComposition(screening, selected.selected_sample_ids),
  }
  manifest.coverage_status = cohortCoverage(manifest.cohort_composition, stage1.minimum, stage1.selection_protocol)
  protocol.selection_manifest = manifest
  protocol.selection_manifest_hash = hash(manifest)
  validateProtocol(protocol)
  writeNew(outputPath, protocol)
  return { run_id: protocol.version, selected_n: selected.selected_sample_ids.length, coverage: manifest.coverage_status, sample_manifest_hash: protocol.selection_manifest_hash }
}

function verify(stage1Path, screeningPath, probePath, inventoryPath, root, protocolPath, ledgerPath, catalogPath, dbPath) {
  const stage1 = read(stage1Path)
  const screeningInput = read(screeningPath)
  const probe = read(probePath)
  const protocol = read(protocolPath)
  if (stage1.status !== 'selection_sealed' || hash(stage1.selection_protocol) !== stage1.selection_public_hash ||
      protocol.version !== stage1.version || protocol.codebook_hash !== stage1.codebook_hash ||
      hash(protocol.axes) !== stage1.codebook_hash ||
      sha256(protocol.selection_protocol.seed) !== stage1.seed_commitment ||
      hash({ ...protocol.selection_protocol, seed: undefined }) !== stage1.selection_public_hash ||
      protocol.selection_protocol_hash !== stage1.selection_protocol_hash ||
      screeningInput.probe_hash !== hash(probe) ||
      probe.inventory_snapshot_hash !== stage1.selection_protocol.inventory_snapshot_hash ||
      probe.inventory_count !== 31 || probe.inspected_count !== 31 || probe.records?.length !== 31) fail('REAL_INTAKE_STALE')
  const expectedScreening = {
    schema: 'frym-metadata-screening/1', status: 'frozen', run_id: protocol.selection_protocol.run_id,
    ...(screeningInput.revision ? { revision: screeningInput.revision } : {}),
    selection_protocol_hash: stage1.selection_protocol_hash,
    inventory_snapshot_hash: stage1.selection_protocol.inventory_snapshot_hash,
    candidates: screeningInput.candidates, held_file_hashes: screeningInput.held_file_hashes,
    held_files: screeningInput.held_files, probe_hash: screeningInput.probe_hash,
    screening_input_hash: hash(screeningInput), screening_scope: screeningInput.screening_scope,
    ...(screeningInput.evidence_ledger_hash ? { evidence_ledger_hash: screeningInput.evidence_ledger_hash } : {}),
  }
  if (hash(protocol.metadata_screening) !== hash(expectedScreening) ||
      protocol.metadata_screening_hash !== hash(expectedScreening)) fail('SCREENING_EVIDENCE_STALE')
  const checked = checkedInventory(inventoryPath, root)
  validateEvidenceLedger(screeningInput, stage1, stage1Path, checked, read(inventoryPath), inventoryPath, ledgerPath, catalogPath, dbPath)
  if (hash(checked.map(row => sha256(row.relative_path)).sort()) !== hash(stage1.selection_protocol.inventory_path_hashes) ||
      screeningInventoryHash(new Set(checked.map(row => row.file_hash))) !== stage1.selection_protocol.inventory_snapshot_hash) fail('INVENTORY_SOURCE_CHANGED')
  if (hash(probe.records.map(row => row.file_hash).sort()) !== hash(checked.map(row => row.file_hash).sort())) fail('PROBE_INVENTORY_MISMATCH')
  validateProtocol(protocol)
  return { run_id: protocol.version, file_count: checked.length, held_unique_files: protocol.metadata_screening.held_file_hashes.length,
    selected_n: protocol.selection_manifest.selected_sample_ids.length, coverage: protocol.selection_manifest.coverage_status,
    selection_protocol_hash: protocol.selection_protocol_hash, metadata_screening_hash: protocol.metadata_screening_hash,
    sample_manifest_hash: protocol.selection_manifest_hash }
}

try {
  const result = command === 'seal-selection' ? selection(...args) :
    command === 'seal-manifest' ? finalize(...args) :
      command === 'verify' ? verify(...args) : fail('USAGE: seal-selection <inventory> <root> <new-stage1> <new-seed-file> <cutoff> | seal-manifest <stage1> <screening> <probe> <inventory> <root> <seed-file> <new-protocol> [ledger catalog db] | verify <stage1> <screening> <probe> <inventory> <root> <sealed-protocol> [ledger catalog db]')
  process.stdout.write(`${JSON.stringify(result)}\n`)
} catch (error) {
  process.stderr.write(`${error.message}\n`)
  process.exitCode = 1
}
