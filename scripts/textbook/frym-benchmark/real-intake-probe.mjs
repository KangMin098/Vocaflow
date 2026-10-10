// scripts/textbook/frym-benchmark/real-intake-probe.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { extname } from 'node:path'
import { createHash } from 'node:crypto'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { hash } from './benchmark.mjs'

const [inventoryPath, outputPath, limitText] = process.argv.slice(2)
if (!inventoryPath || !outputPath) throw Error('USAGE: <inventory.json> <new-output.json> [limit]')
const rows = JSON.parse(readFileSync(inventoryPath, 'utf8').replace(/^\uFEFF/, ''))
const limit = limitText ? Number(limitText) : rows.length
if (!Array.isArray(rows) || !Number.isInteger(limit) || limit < 1) throw Error('INVENTORY_INVALID')
const digest = bytes => createHash('sha256').update(bytes).digest('hex')
const matches = (text, pattern) => [...new Set([...text.matchAll(pattern)].map(match => match[0]))]
const output = []

for (const row of rows.slice(0, limit)) {
  const bytes = readFileSync(row.source_path)
  const fileHash = digest(bytes)
  if (fileHash !== row.sha256) throw Error('INVENTORY_SOURCE_CHANGED')
  const record = { file_hash: fileHash, extension: extname(row.source_path).toLowerCase(), source_path_hash: digest(row.source_path.normalize('NFC')), status: 'metadata_unverified' }
  if (record.extension !== '.pdf') {
    record.status = 'unsupported_container_for_probe'
    output.push(record)
    continue
  }
  try {
    const document = await getDocument({ data: new Uint8Array(bytes), useSystemFonts: true, verbosity: 0 }).promise
    const meta = await document.getMetadata().catch(() => null)
    record.pages = document.numPages
    record.pdf_title = typeof meta?.info?.Title === 'string' ? meta.info.Title.slice(0, 160) : null
    record.pdf_author = typeof meta?.info?.Author === 'string' ? meta.info.Author.slice(0, 100) : null
    const front = []
    const pagesToInspect = Math.min(document.numPages, 4)
    for (let pageNo = 1; pageNo <= pagesToInspect; pageNo++) {
      const page = await document.getPage(pageNo)
      const content = await page.getTextContent()
      front.push(content.items.map(item => item.str ?? '').join(' '))
      page.cleanup()
    }
    const frontText = front.join(' ')
    record.front_pages_inspected = pagesToInspect
    record.front_text_chars = frontText.length
    record.isbn_candidates = matches(frontText, /(?:97[89][- ]?)?\d[- ]?\d{2,5}[- ]?\d{2,7}[- ]?[\dX]/gi).slice(0, 12)
    record.grade_markers = matches(frontText, /(?:초등|중학|고등|중[123]|고[123]|[56]학년|[123]학년)/g).slice(0, 12)
    record.publisher_markers = matches(frontText, /(?:NE능률|능률교육|비상교육|EBS|한국교육방송공사)/gi).slice(0, 12)
    record.preview_markers = matches(frontText, /(?:미리보기|견본|sample|preview)/gi).slice(0, 8)
    record.status = frontText.length < 80 ? 'front_ocr_needed' : 'front_metadata_extracted'
    await document.cleanup()
  } catch (error) {
    record.status = 'pdf_probe_failed'
    record.error_code = error?.name ?? 'Error'
    record.error_detail = String(error?.message ?? '').slice(0, 200)
  }
  output.push(record)
}
writeFileSync(outputPath, `${JSON.stringify({ schema: 'frym-local-pdf-probe/1', inventory_count: rows.length,
  inventory_snapshot_hash: hash([...new Set(rows.map(row => row.sha256))].sort()),
  inspected_count: output.length, records: output }, null, 2)}\n`, { flag: 'wx' })
process.stdout.write(`${JSON.stringify({ inspected: output.length, statuses: Object.fromEntries([...new Set(output.map(row => row.status))].map(status => [status, output.filter(row => row.status === status).length])) })}\n`)
