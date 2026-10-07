// scripts/textbook/frym-benchmark/real-intake-screen.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { hash } from './benchmark.mjs'

const [stage1Path, inventoryPath, probePath, outputPath] = process.argv.slice(2)
if (![stage1Path, inventoryPath, probePath, outputPath].every(Boolean)) throw Error('USAGE: <stage1> <inventory> <probe> <new-screening-input>')
const read = path => JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''))
const stage1 = read(stage1Path)
const inventory = read(inventoryPath)
const probe = read(probePath)
if (stage1?.status !== 'selection_sealed' || probe?.schema !== 'frym-local-pdf-probe/1' || !Array.isArray(inventory) ||
    !Array.isArray(probe.records) || probe.records.length !== inventory.length ||
    probe.inventory_count !== inventory.length || probe.inspected_count !== inventory.length ||
    probe.inventory_snapshot_hash !== stage1.selection_protocol.inventory_snapshot_hash) throw Error('SCREENING_SOURCE_INVALID')
const expected = stage1.selection_protocol.inventory_file_hashes
const inventoryHashes = [...new Set(inventory.map(row => row.sha256))].sort()
if (hash(expected) !== hash(inventoryHashes) || hash(probe.records.map(row => row.file_hash).sort()) !== hash(inventory.map(row => row.sha256).sort())) throw Error('SCREENING_INVENTORY_MISMATCH')
const byHash = new Map()
for (const row of inventory) {
  const probeRecord = probe.records.find(record => record.file_hash === row.sha256)
  if (!probeRecord) throw Error('SCREENING_PROBE_MISSING')
  const current = byHash.get(row.sha256)
  if (current) {
    const first = inventory.find(candidate => candidate.sha256 === row.sha256)
    if (hash([first.rights_basis, first.grade_evidence, first.edition_evidence, first.passage_boundary, first.item_boundary]) !==
        hash([row.rights_basis, row.grade_evidence, row.edition_evidence, row.passage_boundary, row.item_boundary])) throw Error('ALIAS_EVIDENCE_CONFLICT')
    current.alias_count++
    continue
  }
  const reasons = []
  if (row.rights_basis !== 'authorized_local_analysis') reasons.push('HOLD_RIGHTS')
  if (!row.grade_evidence) reasons.push('HOLD_GRADE')
  if (!row.edition_evidence) reasons.push('HOLD_EDITION')
  if (!row.passage_boundary || !row.item_boundary) reasons.push('HOLD_BOUNDARY')
  if (probeRecord.status === 'front_ocr_needed') reasons.push('HOLD_OCR')
  if (probeRecord.status === 'unsupported_container_for_probe' || probeRecord.status === 'pdf_probe_failed') reasons.push('HOLD_FORMAT')
  if (!reasons.length) throw Error('ELIGIBLE_FILE_REQUIRES_PASSAGE_SCREENING')
  byHash.set(row.sha256, {
    reasons, alias_count: 1, probe_status: probeRecord.status,
    page_count: Number.isInteger(probeRecord.pages) ? probeRecord.pages : null,
    front_pages_inspected: Number.isInteger(probeRecord.front_pages_inspected) ? probeRecord.front_pages_inspected : 0,
    isbn_hint_count: probeRecord.isbn_candidates?.length ?? 0,
    grade_hint_count: probeRecord.grade_markers?.length ?? 0,
    publisher_hint_count: probeRecord.publisher_markers?.length ?? 0,
    preview_hint_count: probeRecord.preview_markers?.length ?? 0,
  })
}
const screening = {
  schema: 'frym-local-screening-input/1',
  selection_protocol_hash: stage1.selection_protocol_hash,
  inventory_snapshot_hash: stage1.selection_protocol.inventory_snapshot_hash,
  probe_hash: hash(probe),
  screening_scope: 'file_level_metadata_only_no_confirmed_passage_candidates',
  candidates: [], held_file_hashes: [...byHash.keys()].sort(),
  held_files: Object.fromEntries([...byHash].sort(([a], [b]) => a.localeCompare(b))),
}
writeFileSync(outputPath, `${JSON.stringify(screening, null, 2)}\n`, { flag: 'wx' })
process.stdout.write(`${JSON.stringify({ inventory_n: inventory.length, held_unique_files: byHash.size, eligible_candidates: 0, screening_input_hash: hash(screening) })}\n`)
