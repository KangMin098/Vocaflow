// scripts/textbook/frym-benchmark/real-intake-source-review.mjs
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { basename } from 'node:path'

const [inventoryPath, outputPath] = process.argv.slice(2)
if (!inventoryPath || !outputPath) throw Error('USAGE: <inventory> <new-review-ledger>')
const inventory = JSON.parse(readFileSync(inventoryPath, 'utf8').replace(/^\uFEFF/, ''))
if (!Array.isArray(inventory) || inventory.length !== 31) throw Error('INVENTORY_SCOPE_MISMATCH')
const sha256 = value => createHash('sha256').update(value).digest('hex')
const expectedPrefixes = [
  '80bb4d9639aa', '0ff35050896c', '6ec11bff0ec0', 'f70695f58fba', '6027b6c86e5a',
  '9b5f5b43db39', 'e9c918368c3a', 'f64506d686d8', 'f64506d686d8', '1e43e3ac93f8',
  'a7b7eaa43d3c', 'd03c82431df6', '6a93b42dbd2f', '6e4ec22873dd', '4f72e9474699',
  '8bede4b2199f', '95f81e166fdf', '7300ea1e9ffc', 'd0ffe21c6b45', 'a18332d1856f',
  'dea30eecb21d', 'aface30d1b6d', 'c61f8c3895f6', 'f449fd8c5bc3', 'b884d88700cc',
  '31a832fa08a0', '578a5b16e8d7', '856461d75155', '03e879084f1c', '2b420b8e3d20',
  'af07693611c4',
]
if (inventory.some((row, index) => row.sha256?.slice(0, 12) !== expectedPrefixes[index])) {
  throw Error('INVENTORY_ORDER_OR_IDENTITY_CHANGED')
}
const ne = code => `https://www.nebooks.co.kr/pages/book/view.asp?c=${code}`
const cedu = code => `https://www.cedubook.com/products/${code}`
// Catalog links identify a possible product. They do not prove the local file's edition or analysis rights.
const catalog = new Map([
  [0, [ne('BD02040002'), '979-11-253-4764-4', null]],
  [2, [ne('BD02000073'), '979-11-253-4893-1', null]],
  [3, [cedu('2505270001'), '978-89-6806-553-8', null]],
  [4, [ne('BD02000026'), '979-11-253-0471-5', '고1~고2']],
  [5, [ne('BD02040002'), '979-11-253-4764-4', null]],
  [6, [ne('BD02000073'), '979-11-253-4893-1', null]],
  [7, [ne('BD02000026'), '979-11-253-0471-5', '고1~고2']],
  [8, [ne('BD02000026'), '979-11-253-0471-5', '고1~고2']],
  [9, [cedu('2408210001'), '978-89-6806-430-2', null]],
  [10, [cedu('2505270001'), '978-89-6806-553-8', null]],
  [13, [ne('BB07000126'), '979-11-253-4032-4', '중2~중3']],
  [14, [ne('BB07000130'), '979-11-253-4760-6', '중1']],
  [16, [ne('BB07000140'), null, '중1~중2']],
  [17, [ne('BB07000140'), null, '중1~중2']],
  [18, [ne('BB07000139'), '979-11-253-4820-7', '중2~중3']],
  [19, [ne('BB07000139'), '979-11-253-4820-7', '중2~중3']],
  [20, [ne('BB07000141'), '979-11-253-4821-4', '중3']],
  [21, [ne('BB07000141'), '979-11-253-4821-4', '중3']],
  [22, [ne('BB07000134'), '979-11-253-4828-3', '초3~초4']],
  [23, [ne('BB07000135'), '979-11-253-4829-0', '초3~초4']],
  [24, [ne('BB07000134'), '979-11-253-4828-3', '초3~초4']],
  [25, [ne('BB07000135'), '979-11-253-4829-0', '초3~초4']],
  [26, [ne('BB07000136'), '979-11-253-4830-6', '초5~초6']],
  [27, [ne('BB07000138'), '979-11-253-4832-0', '초5~초6']],
  [28, [ne('BB07000136'), '979-11-253-4830-6', '초5~초6']],
  [29, [ne('BB07000138'), '979-11-253-4832-0', '초5~초6']],
])
const seen = new Set()
const entries = inventory.map((row, index) => {
  if (sha256(readFileSync(row.source_path)) !== row.sha256) throw Error(`SOURCE_CHANGED:${index}`)
  const [catalogUrl, catalogIsbn, catalogGrade] = catalog.get(index) ?? [null, null, null]
  const duplicateOf = seen.has(row.sha256) ? inventory.findIndex(item => item.sha256 === row.sha256) : null
  seen.add(row.sha256)
  return {
    inventory_index: index, file_hash: row.sha256, source_path_hash: sha256(row.source_path.normalize('NFC')),
    display_name: basename(row.source_path), duplicate_of_index: duplicateOf,
    catalog_url_candidate: catalogUrl, catalog_isbn_candidate: catalogIsbn,
    publisher_grade_claim: catalogGrade,
    // All four gates require evidence tied to this exact file, not a filename or catalog title alone.
    rights_verified: false, edition_verified: false, grade_scope_verified: false,
    boundary_verified: false, disposition: 'hold',
    reasons: [
      'ANALYSIS_RIGHTS_NOT_DOCUMENTED', 'LOCAL_EDITION_NOT_BOUND_TO_CATALOG',
      'GRADE_SCOPE_NOT_FILE_VERIFIED',
      'PASSAGE_ITEM_BOUNDARY_NOT_VISUALLY_REVIEWED',
    ],
  }
})
const result = {
  schema: 'frym-source-review/1', status: 'provisional_catalog_crosswalk',
  inventory_snapshot_hash: sha256(readFileSync(inventoryPath)),
  file_count: entries.length, unique_file_count: seen.size, eligible_file_count: 0,
  entries,
}
if (seen.size !== 30) throw Error('UNIQUE_FILE_SCOPE_MISMATCH')
writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' })
process.stdout.write(`${JSON.stringify({ file_count: entries.length, unique_file_count: seen.size, catalog_linked: entries.filter(entry => entry.catalog_url_candidate).length, eligible: 0 })}\n`)
