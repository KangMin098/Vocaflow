// scripts/textbook/frym-benchmark/real-intake-enrich.mjs
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { hash } from './benchmark.mjs'

const read = path => JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''))
const sha = (algorithm, bytes) => createHash(algorithm).update(bytes).digest('hex')
const canonicalPath = value => resolve(value).replaceAll('\\', '/').normalize('NFC').toLowerCase()

export function buildEvidenceLedger(stage1Path, inventoryPath, catalogPath, corpusDbPath) {
  const stage1 = read(stage1Path)
  const inventory = read(inventoryPath)
  const catalog = read(catalogPath)
  if (stage1?.status !== 'selection_sealed' || !Array.isArray(inventory) || inventory.length !== 31 ||
      !catalog?.docs || typeof catalog.docs !== 'object' ||
      hash([...new Set(inventory.map(row => row.sha256))].sort()) !== hash(stage1.selection_protocol.inventory_file_hashes)) {
    throw Error('EVIDENCE_INPUT_INVALID')
  }
  const byPath = new Map()
  for (const doc of Object.values(catalog.docs)) {
    if (typeof doc.absPath !== 'string') continue
    const key = canonicalPath(doc.absPath)
    if (byPath.has(key)) throw Error('CORPUS_PATH_COLLISION')
    byPath.set(key, doc)
  }
  const db = new Database(corpusDbPath, { readonly: true, fileMustExist: true })
  const docQuery = db.prepare('SELECT hash, abs_path FROM docs WHERE id = ?')
  const pageQuery = db.prepare('SELECT p, text FROM pages WHERE doc_id = ? ORDER BY p')
  const entries = []
  try {
    for (const row of inventory) {
      const bytes = readFileSync(row.source_path)
      if (sha('sha256', bytes) !== row.sha256) throw Error('INVENTORY_SOURCE_CHANGED')
      const doc = byPath.get(canonicalPath(row.source_path))
      const currentSha1 = sha('sha1', bytes)
      const dbDoc = doc ? docQuery.get(doc.id) : null
      const catalogCurrent = doc && doc.hash === currentSha1 && doc.extract?.sourceHash === currentSha1 &&
        dbDoc?.hash === currentSha1 && canonicalPath(dbDoc.abs_path) === canonicalPath(row.source_path)
      const pages = catalogCurrent ? pageQuery.all(doc.id) : []
      const isbnPages = []
      const possiblePassagePages = []
      const possibleItemPages = []
      for (const page of pages) {
        const text = page.text ?? ''
        if (/\bISBN\b|\b97[89][\d -]{10,18}\b/i.test(text)) isbnPages.push(page.p)
        const englishWords = (text.match(/\b[A-Za-z]{2,}\b/g) ?? []).length
        if (englishWords >= 80) possiblePassagePages.push(page.p)
        if (/\b(?:choose|according to|which of the following|what is|why does)\b/i.test(text) || /[①②③④⑤]/.test(text)) {
          possibleItemPages.push(page.p)
        }
      }
      entries.push({
        file_hash: row.sha256,
        source_path_hash: sha('sha256', row.source_path.normalize('NFC')),
        catalog_match: !doc ? 'not_indexed' : catalogCurrent ? 'byte_verified' : 'stale',
        catalog_doc_id: catalogCurrent ? doc.id : null,
        catalog_role_hint: catalogCurrent ? doc.role : null,
        catalog_publisher_hint: catalogCurrent ? doc.publisher : null,
        catalog_series_hint: catalogCurrent ? doc.series : null,
        catalog_grade_hint: catalogCurrent ? doc.grade_band : null,
        catalog_low_confidence: catalogCurrent ? doc.low_confidence ?? [] : [],
        extracted_page_count: pages.length,
        isbn_candidate_page_count: isbnPages.length,
        isbn_candidate_pages: isbnPages.slice(0, 20),
        possible_passage_page_count: possiblePassagePages.length,
        possible_passage_pages: possiblePassagePages.slice(0, 20),
        possible_item_page_count: possibleItemPages.length,
        possible_item_pages: possibleItemPages.slice(0, 20),
        page_lists_truncated: [isbnPages, possiblePassagePages, possibleItemPages].some(list => list.length > 20),
        rights_evidence: null,
        confirmed_publisher_edition: null,
        confirmed_single_grade: null,
        confirmed_passage_item_boundary: null,
      })
    }
  } finally {
    db.close()
  }
  return {
    schema: 'frym-local-evidence-ledger/1', status: 'unreviewed_hints',
    selection_protocol_hash: stage1.selection_protocol_hash,
    inventory_snapshot_hash: stage1.selection_protocol.inventory_snapshot_hash,
    catalog_file_hash: sha('sha256', readFileSync(catalogPath)),
    corpus_db_file_hash: sha('sha256', readFileSync(corpusDbPath)),
    entries,
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [stage1Path, inventoryPath, catalogPath, corpusDbPath, outputPath] = process.argv.slice(2)
  if (![stage1Path, inventoryPath, catalogPath, corpusDbPath, outputPath].every(Boolean)) {
    throw Error('USAGE: <stage1> <inventory> <local-corpus-manifest> <local-corpus-db> <new-evidence-ledger>')
  }
  const ledger = buildEvidenceLedger(stage1Path, inventoryPath, catalogPath, corpusDbPath)
  writeFileSync(outputPath, `${JSON.stringify(ledger, null, 2)}\n`, { flag: 'wx' })
  process.stdout.write(`${JSON.stringify({ files: ledger.entries.length,
    byte_verified_catalog: ledger.entries.filter(entry => entry.catalog_match === 'byte_verified').length,
    stale_catalog: ledger.entries.filter(entry => entry.catalog_match === 'stale').length,
    not_indexed: ledger.entries.filter(entry => entry.catalog_match === 'not_indexed').length,
    evidence_ledger_hash: hash(ledger) })}\n`)
}
