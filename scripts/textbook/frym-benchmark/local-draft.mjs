// scripts/textbook/frym-benchmark/local-draft.mjs
import { readFileSync, realpathSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { identifyLocalFile } from './local-admission.mjs'

const sha256 = text => createHash('sha256').update(text).digest('hex')
const METHODS = { pdf: 'pdftotext', txt: 'plain_text', html: 'html_text', htm: 'html_text' }

export function draftLocalCandidates(sourcePath, extractorMeta, pagesJsonl, metadataHints = {}) {
  const source = identifyLocalFile(sourcePath)
  if (!source.file_identified) throw Error('FILE_FORMAT_UNVERIFIED')
  if (extractorMeta?.sourceHash !== source.source_sha1) throw Error('EXTRACTION_SOURCE_CHANGED')
  if (!['ok', 'ocr'].includes(extractorMeta.status) || extractorMeta.pageKind === 'chunk') throw Error('EXTRACTION_NOT_PAGE_BOUND')
  const method = extractorMeta.status === 'ocr' ? 'ocr' : METHODS[source.format] ?? extractorMeta.method
  if (typeof method !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(method)) throw Error('EXTRACTION_METHOD_UNKNOWN')
  const ocrUsed = extractorMeta.status === 'ocr' ? true : METHODS[source.format] ? false : extractorMeta.ocr_used
  if (typeof ocrUsed !== 'boolean') throw Error('OCR_MODE_UNKNOWN')
  const lines = pagesJsonl.trim().split(/\r?\n/).filter(Boolean)
  if (!lines.length) throw Error('EXTRACTION_EMPTY')
  const pages = lines.map(line => JSON.parse(line))
  if (pages.some(page => !Number.isInteger(page?.p) || page.p < 1 || typeof page.text !== 'string' || !page.text.trim()) || new Set(pages.map(page => page.p)).size !== pages.length) throw Error('EXTRACTION_PAGES_INVALID')
  const resolved = realpathSync(sourcePath)
  const hints = Object.fromEntries(['publisher', 'series', 'title', 'grade', 'edition', 'publication_year', 'difficulty_step', 'ISBN', 'publisher_id', 'canonical_url', 'genre', 'rights_basis', 'access_date'].filter(key => metadataHints[key] !== undefined).map(key => [key, metadataHints[key]]))
  const candidates = pages.map(page => ({
    source_path: resolved,
    expected_file_hash: source.file_hash,
    status: 'needs_manual_admission',
    metadata: { ...hints, page: String(page.p) },
    extraction: { source_file_hash: source.file_hash, method, ocr_used: ocrUsed, ocr_verified: false, page_range: String(page.p), boundary_confirmed: false, question_boundary_confirmed: false },
    review_material: { page: page.p, page_text: page.text, page_text_hash: sha256(page.text) },
  }))
  return { candidates, audit: { schema: 'frym-local-draft/1', source_path_hash: source.source_path_hash, file_hash: source.file_hash, extracted_pages_hash: sha256(pagesJsonl), candidates: candidates.length, status: 'needs_manual_admission' } }
}

export function readLocalDraftInputs(metaPath, pagesPath, hintsPath) {
  return {
    extractorMeta: JSON.parse(readFileSync(metaPath, 'utf8')),
    pagesJsonl: readFileSync(pagesPath, 'utf8'),
    metadataHints: JSON.parse(readFileSync(hintsPath, 'utf8')),
  }
}
