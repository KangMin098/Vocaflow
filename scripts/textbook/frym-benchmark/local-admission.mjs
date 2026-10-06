// scripts/textbook/frym-benchmark/local-admission.mjs
import { createHash } from 'node:crypto'
import { openSync, readSync, closeSync, realpathSync, statSync } from 'node:fs'
import { extname, normalize } from 'node:path'
import { AXES, sampleAnalysisHash, screenSample, validateProtocol, hash } from './benchmark.mjs'

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const present = value => typeof value === 'string' && value.trim().length > 0
const opaqueId = value => typeof value === 'string' && /^[a-z0-9][a-z0-9:_-]{0,127}$/i.test(value)
const DIGITAL_TEXT_METHODS = new Set(['fixture', 'pdftotext', 'html_text', 'plain_text', 'hwp_text', 'epub_text', 'docx_text'])
const HEX = /^[a-f0-9]{64}$/
const METADATA_KEYS = ['sample_id', 'publisher', 'series', 'title', 'grade', 'edition', 'publication_year', 'difficulty_step', 'ISBN', 'publisher_id', 'canonical_url', 'passage_id', 'page', 'genre', 'rights_basis', 'access_date']
const safeMetadata = metadata => Object.fromEntries(METADATA_KEYS.filter(key => key === 'publication_year' ? Number.isInteger(metadata[key]) : present(metadata[key])).map(key => [key, metadata[key]]))

export function identifyLocalFile(sourcePath) {
  const resolved = realpathSync(sourcePath)
  if (!statSync(resolved).isFile()) throw Error('SOURCE_NOT_FILE')
  const fd = openSync(resolved, 'r')
  const digest = createHash('sha256')
  const legacyDigest = createHash('sha1')
  const chunk = Buffer.alloc(1024 * 1024)
  let first = Buffer.alloc(0)
  try {
    for (;;) {
      const n = readSync(fd, chunk, 0, chunk.length, null)
      if (!n) break
      if (!first.length) first = Buffer.from(chunk.subarray(0, Math.min(n, 16)))
      digest.update(chunk.subarray(0, n))
      legacyDigest.update(chunk.subarray(0, n))
    }
  } finally { closeSync(fd) }
  const extension = extname(resolved).toLowerCase()
  const zip = first.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))
  const signatures = {
    '.pdf': first.subarray(0, 5).toString() === '%PDF-',
    '.epub': zip, '.docx': zip, '.hwpx': zip,
    '.png': first.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    '.jpg': first.subarray(0, 3).equals(Buffer.from([255, 216, 255])),
    '.jpeg': first.subarray(0, 3).equals(Buffer.from([255, 216, 255])),
    '.tif': first.subarray(0, 4).toString('hex').match(/^(49492a00|4d4d002a)$/) !== null,
    '.tiff': first.subarray(0, 4).toString('hex').match(/^(49492a00|4d4d002a)$/) !== null,
    '.hwp': first.subarray(0, 8).toString('hex') === 'd0cf11e0a1b11ae1',
    '.txt': first.length > 0 && !first.includes(0),
    '.html': first.length > 0 && !first.includes(0),
    '.htm': first.length > 0 && !first.includes(0),
  }
  return {
    source_path_hash: sha256(normalize(resolved).toLowerCase()),
    file_hash: digest.digest('hex'),
    source_sha1: legacyDigest.digest('hex'),
    format: extension.slice(1) || 'unknown',
    file_identified: signatures[extension] === true,
  }
}

const audit = (candidate, file, status, reasons, stages) => ({
  sample_id: opaqueId(candidate?.metadata?.sample_id) ? candidate.metadata.sample_id : null,
  sample_id_hash: present(candidate?.metadata?.sample_id) ? sha256(candidate.metadata.sample_id) : null,
  source_path_hash: file?.source_path_hash ?? null,
  file_hash: file?.file_hash ?? null,
  format: file?.format ?? null,
  status,
  reasons: [...new Set(reasons)],
  stages,
})

export function admitCandidate(candidate, protocol) {
  validateProtocol(protocol)
  const stages = ['source-discovered']
  let file
  try { file = identifyLocalFile(candidate?.source_path) } catch { return { audit: audit(candidate, null, 'admission-reject', ['SOURCE_UNREADABLE'], stages) } }
  if (!file.file_identified) return { audit: audit(candidate, file, 'admission-hold', ['FILE_FORMAT_UNVERIFIED'], stages) }
  stages.push('file-identified')
  if (candidate.expected_file_hash !== file.file_hash || !HEX.test(candidate.expected_file_hash ?? '')) return { audit: audit(candidate, file, 'admission-reject', ['SOURCE_HASH_CHANGED'], stages) }
  const meta = candidate.metadata
  if (!meta || !present(meta.sample_id) || !present(meta.publisher) || !present(meta.series) || !present(meta.title) || !present(meta.edition) || !present(meta.grade) || !present(meta.passage_id) || !present(meta.page) || !present(meta.ISBN) && !(present(meta.publisher_id) && present(meta.canonical_url))) return { audit: audit(candidate, file, 'admission-hold', ['METADATA_INCOMPLETE'], stages) }
  stages.push('metadata-extracted')
  const extraction = candidate.extraction
  const imageSource = ['png', 'jpg', 'jpeg', 'tif', 'tiff'].includes(file.format)
  if (!present(extraction?.passage_text) || !present(extraction?.page_range) || !present(extraction?.passage_id) || extraction.source_file_hash !== file.file_hash || extraction.passage_id !== meta.passage_id || extraction.page_range !== meta.page || extraction.boundary_confirmed !== true || !/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(extraction.method ?? '') || typeof extraction.ocr_used !== 'boolean' || (imageSource || !DIGITAL_TEXT_METHODS.has(extraction.method)) && !extraction.ocr_used || extraction.ocr_used && extraction.ocr_verified !== true) return { audit: audit(candidate, file, 'admission-hold', ['NEEDS_MANUAL_ADMISSION'], stages) }
  stages.push('passage-extracted')
  if (!Array.isArray(extraction.questions) || !extraction.questions.length || extraction.questions.some(q => !q || typeof q !== 'object' || Array.isArray(q) || !present(q.id) || !present(q.stem) || !present(q.type) || !present(q.answer)) || new Set(extraction.questions.map(q => q.id)).size !== extraction.questions.length || extraction.question_boundary_confirmed !== true) return { audit: audit(candidate, file, 'admission-hold', ['QUESTION_EXTRACTION_INCOMPLETE'], stages) }
  stages.push('question-extracted')
  const analysis = candidate.analysis
  if (!/^[a-z][a-z0-9_-]*:[a-z0-9:_-]+$/i.test(analysis?.evidence_locator ?? '')) return { audit: audit(candidate, file, 'admission-hold', ['EVIDENCE_LOCATOR_NOT_OPAQUE'], stages) }
  if (AXES.some(axis => {
    const review = analysis.ordinal_reviews?.[axis]
    return protocol.axes[axis].scale === 'ordinal' && review && review.rater_a === review.rater_b && (review.adjudicated != null || review.adjudicator_id != null)
  })) return { audit: audit(candidate, file, 'admission-hold', ['ORDINAL_REVIEW_INVALID'], stages) }
  const questions = extraction.questions
  const passage_hash = sha256(extraction.passage_text)
  const item_set_hash = hash(questions.map(({ answer, ...item }) => item))
  const scoring_key_hash = hash(questions.map(({ id, answer }) => ({ id, answer })))
  if (analysis?.codebook_hash !== protocol.codebook_hash || analysis.passage_hash !== passage_hash || analysis.item_set_hash !== item_set_hash || analysis.scoring_key_hash !== scoring_key_hash || !present(analysis?.analyzer_version) || !present(analysis?.evidence_locator) || AXES.some(axis => !Number.isFinite(analysis?.metrics?.[axis]))) return { audit: audit(candidate, file, 'admission-hold', ['NINE_AXIS_ANALYSIS_MISSING'], stages) }
  stages.push('analysis-ready')
  const item_type_counts = Object.fromEntries([...new Set(questions.map(q => q.type))].map(type => [type, questions.filter(q => q.type === type).length]))
  if (Object.keys(item_type_counts).some(type => !protocol.item_types.includes(type) || !Number.isFinite(analysis.item_type_difficulty?.[type]) || analysis.item_type_difficulty[type] < protocol.item_type_difficulty.valid_min || analysis.item_type_difficulty[type] > protocol.item_type_difficulty.valid_max)) return { audit: audit(candidate, file, 'admission-hold', ['ITEM_DIFFICULTY_INVALID'], stages) }
  const axisValues = object => Object.fromEntries(AXES.filter(axis => object?.[axis] !== undefined).map(axis => [axis, object[axis]]))
  const auxiliary_metrics = Object.fromEntries(AXES.filter(axis => protocol.axes[axis].auxiliary_metrics.length).map(axis => [axis, Object.fromEntries(protocol.axes[axis].auxiliary_metrics.filter(metric => analysis.auxiliary_metrics?.[axis]?.[metric] !== undefined).map(metric => [metric, analysis.auxiliary_metrics[axis][metric]]))]))
  const ordinal_reviews = Object.fromEntries(AXES.filter(axis => protocol.axes[axis].scale === 'ordinal' && analysis.ordinal_reviews?.[axis]).map(axis => {
    const review = analysis.ordinal_reviews[axis]
    const safe = {}
    for (const key of ['rater_a_id', 'rater_b_id']) if (present(review[key])) safe[key] = review[key]
    for (const key of ['rater_a', 'rater_b']) if (Number.isInteger(review[key])) safe[key] = review[key]
    if (review.rater_a !== review.rater_b) {
      if (present(review.adjudicator_id)) safe.adjudicator_id = review.adjudicator_id
      if (Number.isInteger(review.adjudicated)) safe.adjudicated = review.adjudicated
    }
    return [axis, safe]
  }))
  const row = {
    ...safeMetadata(meta),
    source_path_hash: file.source_path_hash,
    file_hash: file.file_hash,
    extraction_hash: hash(extraction),
    source_method: extraction.method,
    analyzer_version: analysis.analyzer_version,
    evidence_locator: analysis.evidence_locator,
    passage_hash,
    item_set_hash,
    scoring_key_hash,
    word_count: extraction.passage_text.trim().split(/\s+/).length,
    item_count: questions.length,
    item_type_counts,
    item_type_difficulty: Object.fromEntries(Object.keys(item_type_counts).map(type => [type, analysis.item_type_difficulty[type]])),
    metrics: axisValues(analysis.metrics),
    auxiliary_metrics,
    axis_agreement: axisValues(analysis.axis_agreement),
    ordinal_reviews,
    codebook_hash: protocol.codebook_hash,
    selection_manifest_hash: protocol.selection_manifest_hash,
  }
  row.analysis_hash = sampleAnalysisHash(row)
  const reasons = screenSample(row, protocol)
  if (reasons.length) return { audit: audit(candidate, file, reasons.some(reason => ['RIGHTS_UNCONFIRMED', 'NOT_SELECTED', 'PROTOCOL_INPUT_MISMATCH', 'NON_REPRESENTATIVE_EDITION'].includes(reason)) ? 'admission-reject' : 'admission-hold', reasons, stages) }
  stages.push('admission-pass')
  return { audit: audit(candidate, file, 'admission-pass', [], stages), sample: row, duplicate_key: sha256(extraction.passage_text.normalize('NFC').replace(/\s+/g, ' ').trim()) }
}

export function prepareAdmission(candidates, protocol) {
  validateProtocol(protocol)
  if (!Array.isArray(candidates)) throw Error('CANDIDATES_NOT_ARRAY')
  const results = candidates.map(candidate => admitCandidate(candidate, protocol))
  const ids = new Map(), passages = new Map(), normalizedPassages = new Map()
  for (const result of results) {
    if (!result.sample) continue
    for (const [map, key] of [[ids, result.sample.sample_id], [passages, result.sample.passage_hash], [normalizedPassages, result.duplicate_key]]) map.set(key, [...(map.get(key) ?? []), result])
  }
  for (const group of [...ids.values(), ...passages.values(), ...normalizedPassages.values()]) {
    if (group.length < 2) continue
    for (const result of group) {
      result.audit.status = 'admission-reject'
      if (!result.audit.reasons.includes('DUPLICATE_SAMPLE_OR_PASSAGE')) result.audit.reasons.push('DUPLICATE_SAMPLE_OR_PASSAGE')
      if (result.audit.stages.at(-1) === 'admission-pass') result.audit.stages.pop()
      delete result.sample
    }
  }
  return {
    samples: results.flatMap(result => result.sample ? [result.sample] : []),
    audit: { schema: 'frym-local-admission/1', protocol_hash: hash(protocol), results: results.map(result => result.audit) },
  }
}
