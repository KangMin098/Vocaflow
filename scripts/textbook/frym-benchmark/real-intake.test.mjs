// scripts/textbook/frym-benchmark/real-intake.test.mjs
import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash } from 'node:crypto'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import Database from 'better-sqlite3'
import { hash, validateProtocol } from './benchmark.mjs'

const sha = value => createHash('sha256').update(value).digest('hex')
const seal = join(import.meta.dirname, 'real-intake-seal.mjs')
const screen = join(import.meta.dirname, 'real-intake-screen.mjs')
const enrich = join(import.meta.dirname, 'real-intake-enrich.mjs')
const run = (script, ...args) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' })

test('real intake seals 31/30 inventory before zero-eligible screening and fails closed on changed evidence', t => {
  const root = mkdtempSync(join(tmpdir(), 'frym-real-intake-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const sources = join(root, 'sources')
  mkdirSync(sources)
  const inventory = Array.from({ length: 31 }, (_, i) => {
    const source_path = join(sources, `file-${i}.txt`)
    const bytes = `synthetic-file-${i % 30}`
    writeFileSync(source_path, bytes)
    return { source_path, sha256: sha(bytes), rights_basis: null, grade_evidence: null, edition_evidence: null, passage_boundary: null, item_boundary: null }
  })
  const inventoryPath = join(root, 'inventory.json')
  writeFileSync(inventoryPath, JSON.stringify(inventory))
  const stage1Path = join(root, 'stage1.json')
  const seedPath = join(root, 'seed.json')
  const probePath = join(root, 'probe.json')
  const screeningPath = join(root, 'screening.json')
  const finalPath = join(root, 'sealed.json')
  const stage1 = run(seal, 'seal-selection', inventoryPath, sources, stage1Path, seedPath, '2026-10-08')
  assert.equal(stage1.status, 0, stage1.stderr)
  const stage1Data = JSON.parse(readFileSync(stage1Path, 'utf8'))
  assert.equal(stage1Data.selection_protocol.seed, undefined)
  assert.equal(stage1Data.selection_protocol.inventory_file_hashes.length, 30)
  assert.notEqual(stage1Data.seed_commitment, undefined)
  assert.equal(run(seal, 'seal-selection', inventoryPath, sources, stage1Path, seedPath, '2026-10-08').status, 1)
  writeFileSync(probePath, JSON.stringify({ schema: 'frym-local-pdf-probe/1', inventory_count: 31,
    inventory_snapshot_hash: stage1Data.selection_protocol.inventory_snapshot_hash, inspected_count: 31,
    records: inventory.map(row => ({ file_hash: row.sha256, status: 'unsupported_container_for_probe' })) }))
  const screened = run(screen, stage1Path, inventoryPath, probePath, screeningPath)
  assert.equal(screened.status, 0, screened.stderr)
  const screening = JSON.parse(readFileSync(screeningPath, 'utf8'))
  assert.deepEqual(screening.candidates, [])
  assert.equal(screening.held_file_hashes.length, 30)
  const finalized = run(seal, 'seal-manifest', stage1Path, screeningPath, probePath, inventoryPath, sources, seedPath, finalPath)
  assert.equal(finalized.status, 0, finalized.stderr)
  const protocol = JSON.parse(readFileSync(finalPath, 'utf8'))
  assert.equal(typeof validateProtocol(protocol), 'string')
  assert.equal(run(seal, 'verify', stage1Path, screeningPath, probePath, inventoryPath, sources, finalPath).status, 0)
  assert.equal(protocol.selection_manifest.coverage_status, 'insufficient_benchmark')
  assert.equal(protocol.selection_manifest.selected_sample_ids.length, 0)
  const oldScopeWithHint = structuredClone(screening)
  oldScopeWithHint.held_files[screening.held_file_hashes[0]].catalog_role_hint = 'forged'
  const oldScopeWithHintPath = join(root, 'old-scope-with-hint.json')
  writeFileSync(oldScopeWithHintPath, JSON.stringify(oldScopeWithHint))
  assert.match(run(seal, 'seal-manifest', stage1Path, oldScopeWithHintPath, probePath, inventoryPath, sources,
    seedPath, join(root, 'old-scope-with-hint-seal.json')).stderr, /EVIDENCE_LEDGER_UNEXPECTED/)
  const fakeLocalSearch = structuredClone(protocol)
  fakeLocalSearch.metadata_screening.candidates.push({ candidate_id: 'unsealed', file_hash: inventory[0].sha256 })
  assert.throws(() => validateProtocol(fakeLocalSearch), /SELECTION_PROTOCOL_STALE_OR_INVALID/)
  const changedProbe = JSON.parse(readFileSync(probePath, 'utf8'))
  changedProbe.records[0].status = 'front_ocr_needed'
  const changedProbePath = join(root, 'probe-changed.json')
  writeFileSync(changedProbePath, JSON.stringify(changedProbe))
  assert.match(run(seal, 'verify', stage1Path, screeningPath, changedProbePath, inventoryPath, sources, finalPath).stderr, /REAL_INTAKE_STALE/)
  assert.match(run(seal, 'seal-manifest', stage1Path, screeningPath, changedProbePath, inventoryPath, sources, seedPath, join(root, 'probe-changed-seal.json')).stderr, /SCREENING_INPUT_INVALID/)
  const alienProbe = JSON.parse(readFileSync(probePath, 'utf8'))
  alienProbe.records[0].file_hash = sha('foreign-file')
  const alienProbePath = join(root, 'probe-alien.json')
  writeFileSync(alienProbePath, JSON.stringify(alienProbe))
  const alienScreening = structuredClone(screening)
  alienScreening.probe_hash = hash(alienProbe)
  const alienScreeningPath = join(root, 'screening-alien.json')
  writeFileSync(alienScreeningPath, JSON.stringify(alienScreening))
  assert.match(run(seal, 'seal-manifest', stage1Path, alienScreeningPath, alienProbePath, inventoryPath, sources, seedPath, join(root, 'alien-seal.json')).stderr, /SCREENING_INPUT_INVALID/)
  const alienProtocol = structuredClone(protocol)
  alienProtocol.metadata_screening.probe_hash = alienScreening.probe_hash
  alienProtocol.metadata_screening.screening_input_hash = hash(alienScreening)
  alienProtocol.metadata_screening_hash = hash(alienProtocol.metadata_screening)
  alienProtocol.selection_manifest.metadata_screening_hash = alienProtocol.metadata_screening_hash
  alienProtocol.selection_manifest_hash = hash(alienProtocol.selection_manifest)
  const alienProtocolPath = join(root, 'alien-protocol.json')
  writeFileSync(alienProtocolPath, JSON.stringify(alienProtocol))
  assert.match(run(seal, 'verify', stage1Path, alienScreeningPath, alienProbePath, inventoryPath, sources, alienProtocolPath).stderr, /PROBE_INVENTORY_MISMATCH/)
  const forgedProtocol = structuredClone(protocol)
  forgedProtocol.metadata_screening.held_files[screening.held_file_hashes[0]].reasons = ['HOLD_FORMAT']
  forgedProtocol.metadata_screening_hash = hash(forgedProtocol.metadata_screening)
  forgedProtocol.selection_manifest.metadata_screening_hash = forgedProtocol.metadata_screening_hash
  forgedProtocol.selection_manifest_hash = hash(forgedProtocol.selection_manifest)
  const forgedPath = join(root, 'forged.json')
  writeFileSync(forgedPath, JSON.stringify(forgedProtocol))
  assert.match(run(seal, 'verify', stage1Path, screeningPath, probePath, inventoryPath, sources, forgedPath).stderr, /SCREENING_EVIDENCE_STALE/)
  const conflictedInventory = structuredClone(inventory)
  conflictedInventory[30].rights_basis = 'authorized_local_analysis'
  const conflictedPath = join(root, 'inventory-conflict.json')
  writeFileSync(conflictedPath, JSON.stringify(conflictedInventory))
  assert.match(run(screen, stage1Path, conflictedPath, probePath, join(root, 'conflicted-screening.json')).stderr, /ALIAS_EVIDENCE_CONFLICT/)

  const incomplete = structuredClone(screening)
  incomplete.held_file_hashes.pop()
  const incompletePath = join(root, 'screening-incomplete.json')
  writeFileSync(incompletePath, JSON.stringify(incomplete))
  assert.match(run(seal, 'seal-manifest', stage1Path, incompletePath, probePath, inventoryPath, sources, seedPath, join(root, 'incomplete.json')).stderr, /SCREENING_INPUT_INVALID/)
  const extra = structuredClone(screening)
  extra.candidates.push({ candidate_id: 'outside', file_hash: sha('outside'), status: 'metadata_eligible' })
  const extraPath = join(root, 'screening-extra.json')
  writeFileSync(extraPath, JSON.stringify(extra))
  assert.match(run(seal, 'seal-manifest', stage1Path, extraPath, probePath, inventoryPath, sources, seedPath, join(root, 'extra.json')).stderr, /SCREENING_INPUT_INVALID/)
  const catalogPath = join(root, 'catalog.json')
  const dbPath = join(root, 'corpus.db')
  const ledgerPath = join(root, 'evidence-ledger.json')
  const screeningR2Path = join(root, 'screening-r2.json')
  const finalR2Path = join(root, 'sealed-r2.json')
  const firstSourceHash = createHash('sha1').update(readFileSync(inventory[0].source_path)).digest('hex')
  const catalog = { docs: { first: { id: 'first', absPath: inventory[0].source_path,
    hash: firstSourceHash, extract: { sourceHash: firstSourceHash },
    role: 'preview', publisher: 'hint only', series: 'synthetic', grade_band: 'multiple grades', low_confidence: [] } } }
  writeFileSync(catalogPath, JSON.stringify(catalog))
  const db = new Database(dbPath)
  db.exec('CREATE TABLE docs (id TEXT, hash TEXT, abs_path TEXT)')
  db.exec('CREATE TABLE pages (doc_id TEXT, p INTEGER, text TEXT)')
  db.prepare('INSERT INTO docs VALUES (?, ?, ?)').run('first', firstSourceHash, inventory[0].source_path)
  const insertPage = db.prepare('INSERT INTO pages VALUES (?, ?, ?)')
  for (let page = 1; page <= 25; page++) {
    insertPage.run('first', page, 'ISBN 9781234567890 Which of the following? ' + 'English passage words '.repeat(45))
  }
  db.close()
  assert.equal(run(enrich, stage1Path, inventoryPath, catalogPath, dbPath, ledgerPath).status, 0)
  const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'))
  assert.equal(ledger.entries.length, 31)
  assert.equal(ledger.entries[0].catalog_match, 'byte_verified')
  assert.equal(ledger.entries[1].catalog_match, 'not_indexed')
  assert.equal(ledger.entries[0].possible_passage_pages.length, 20)
  assert.equal(ledger.entries[0].possible_passage_page_count, 25)
  assert.equal(ledger.entries[0].page_lists_truncated, true)
  assert.equal(ledger.entries[0].confirmed_passage_item_boundary, null)
  assert.equal(run(screen, stage1Path, inventoryPath, probePath, screeningR2Path, ledgerPath).status, 0)
  assert.match(run(seal, 'seal-manifest', stage1Path, screeningR2Path, probePath, inventoryPath, sources, seedPath, join(root, 'missing-ledger.json')).stderr, /EVIDENCE_LEDGER_MISSING/)
  assert.equal(run(seal, 'seal-manifest', stage1Path, screeningR2Path, probePath, inventoryPath, sources, seedPath,
    finalR2Path, ledgerPath, catalogPath, dbPath).status, 0)
  const r2 = JSON.parse(readFileSync(finalR2Path, 'utf8'))
  assert.equal(r2.metadata_screening.revision, 2)
  assert.equal(r2.selection_manifest.revision, 2)
  assert.equal(r2.metadata_screening.held_files[inventory[0].sha256].extracted_page_count, 25)
  assert.equal(r2.metadata_screening.held_files[inventory[0].sha256].possible_passage_page_count, 25)
  assert.notEqual(r2.selection_manifest_hash, protocol.selection_manifest_hash)
  assert.equal(r2.selection_manifest.selected_sample_ids.length, 0)
  assert.equal(run(seal, 'verify', stage1Path, screeningR2Path, probePath, inventoryPath, sources,
    finalR2Path, ledgerPath, catalogPath, dbPath).status, 0)
  const wrongScope = JSON.parse(readFileSync(screeningR2Path, 'utf8'))
  wrongScope.screening_scope = 'unknown_scope'
  const wrongScopePath = join(root, 'wrong-scope.json')
  writeFileSync(wrongScopePath, JSON.stringify(wrongScope))
  assert.match(run(seal, 'seal-manifest', stage1Path, wrongScopePath, probePath, inventoryPath, sources,
    seedPath, join(root, 'wrong-scope-seal.json')).stderr, /SCREENING_SCOPE_INVALID/)
  const changedLedger = structuredClone(ledger)
  changedLedger.entries[0].catalog_grade_hint = 'forged single grade'
  const changedLedgerPath = join(root, 'changed-ledger.json')
  writeFileSync(changedLedgerPath, JSON.stringify(changedLedger))
  assert.match(run(seal, 'verify', stage1Path, screeningR2Path, probePath, inventoryPath, sources,
    finalR2Path, changedLedgerPath, catalogPath, dbPath).stderr, /EVIDENCE_LEDGER_STALE/)
  const changedScreening = JSON.parse(readFileSync(screeningR2Path, 'utf8'))
  changedScreening.held_files[inventory[0].sha256].catalog_grade_hint = 'forged single grade'
  const changedScreeningPath = join(root, 'changed-screening-r2.json')
  writeFileSync(changedScreeningPath, JSON.stringify(changedScreening))
  assert.match(run(seal, 'seal-manifest', stage1Path, changedScreeningPath, probePath, inventoryPath, sources,
    seedPath, join(root, 'forged-r2.json'), ledgerPath, catalogPath, dbPath).stderr, /EVIDENCE_SCREENING_MISMATCH/)
  writeFileSync(catalogPath, JSON.stringify({ ...catalog, altered: true }))
  assert.match(run(seal, 'verify', stage1Path, screeningR2Path, probePath, inventoryPath, sources,
    finalR2Path, ledgerPath, catalogPath, dbPath).stderr, /EVIDENCE_LEDGER_STALE/)
  const secret = JSON.parse(readFileSync(seedPath, 'utf8'))
  secret.seed = 'changed'
  writeFileSync(seedPath, JSON.stringify(secret))
  assert.match(run(seal, 'seal-manifest', stage1Path, screeningPath, probePath, inventoryPath, sources, seedPath, join(root, 'seed-changed.json')).stderr, /SEED_COMMITMENT_MISMATCH/)
  secret.seed = protocol.selection_protocol.seed
  writeFileSync(seedPath, JSON.stringify(secret))
  writeFileSync(inventory[0].source_path, 'changed')
  assert.match(run(seal, 'seal-manifest', stage1Path, screeningPath, probePath, inventoryPath, sources, seedPath, join(root, 'source-changed.json')).stderr, /INVENTORY_SOURCE_CHANGED/)
  assert.match(run(seal, 'verify', stage1Path, screeningPath, probePath, inventoryPath, sources, finalPath).stderr, /INVENTORY_SOURCE_CHANGED/)
})
