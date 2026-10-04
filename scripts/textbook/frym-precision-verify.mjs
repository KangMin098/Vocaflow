// scripts/textbook/frym-precision-verify.mjs
// Verify immutable local evidence. This is not a DB importer or expert certification.
import fs from 'node:fs'
import path from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { precisionRoundSchema, validatePrecisionEvidence, summarizePrecision } from '../../packages/library-pipeline/src/textbook/parallel-precision.ts'
import { researchBodyHash, normalizeResearchDoi, extractFrymResearchOrigin } from '@vocaflow/library-pipeline/research-origin'
import { frymFullTextContainer, frymFullTextContent } from '../../packages/library-pipeline/src/ingest-article/frontiers-young-minds.ts'
import { htmlToPlainText } from '../../packages/library-pipeline/src/ingest-article/_helpers.ts'

const arg = (name) => { const i = process.argv.indexOf(`--${name}`); return i < 0 ? null : process.argv[i + 1] }
if (process.argv.includes('--commit')) throw new Error('Local verification has no --commit mode')
if (!arg('input') || !arg('evidence-dir')) throw new Error('--input <round.json> --evidence-dir <snapshot directory> required')
const round = precisionRoundSchema.parse(JSON.parse(fs.readFileSync(arg('input'), 'utf8')))
const dir = path.resolve(arg('evidence-dir'))
function read(file) {
  // Snapshots use flat basenames; reject traversal and absolute paths on either OS.
  if (!file || !/^[A-Za-z0-9_.-]+$/.test(file) || file === '.' || file === '..') throw new Error(`Unsafe snapshot filename: ${file}`)
  const target = path.join(dir, file)
  if (fs.lstatSync(target).isSymbolicLink()) throw new Error(`Snapshot symlink rejected: ${file}`)
  return fs.readFileSync(target, 'utf8')
}
const preparedText = read('prepared.json')
const originsText = read('origins.json')
const prepared = JSON.parse(preparedText)
const origins = JSON.parse(originsText)
if (researchBodyHash(preparedText) !== round.prepared_hash || researchBodyHash(originsText) !== round.origins_hash || prepared.origins_hash !== round.origins_hash)
  throw new Error('Prepared/origin manifest hash mismatch')
if (prepared.pairs.length !== round.pairs.length) throw new Error('Prepared pairs missing or added')
const screening = origins.screening
if (!screening || screening.selection !== `first_${round.selection.sample_size}_declared_original_source_in_source_id_order` || !isDeepStrictEqual(round.selection, { method: 'first_declared_original_source_in_source_id_order', sample_size: origins.rows.length, population: screening.population, counts: screening.counts, manifests: screening.files, screening: screening.rows.map(({ id, source_id, status, declared_dois }) => ({ id, source_id, status, declared_dois })) }))
  throw new Error('Screening archive and round disagree')
for (const pair of round.pairs) {
  const snapshot = prepared.pairs.find((p) => p.id === pair.id)
  if (!snapshot || ['source', 'relation', 'research', 'metadata', 'files'].some((key) => !isDeepStrictEqual(pair[key], snapshot[key])))
    throw new Error(`${pair.id}: preparation binding changed`)
  const fym = read(pair.files.fym)
  const fymHtml = read(pair.files.fym_page)
  if (researchBodyHash(fymHtml) !== pair.files.fym_page_hash) throw new Error(`${pair.id}: FYM page changed`)
  const fresh = extractFrymResearchOrigin({ html: fymHtml, container: frymFullTextContainer(fymHtml), body: frymFullTextContent(fymHtml), studentUrl: pair.source.source_url, checkedAt: pair.research.checked_at })
  if (fresh.body_hash !== pair.source.source_hash || !fresh.relations.some((r) => r.original_work_id === pair.relation.doi && researchBodyHash(r.evidence) === pair.relation.citation_hash))
    throw new Error(`${pair.id}: FYM archived origin mismatch`)
  const origin = origins.rows.find((r) => r.id === pair.source.id)
  if (!origin || origin.source_hash !== pair.source.source_hash || origin.source_revision !== pair.source.source_revision || origin.source_id !== pair.source.source_id || origin.source_url !== pair.source.source_url || origin.research_origin.page_hash !== pair.source.page_hash)
    throw new Error(`${pair.id}: export source identity mismatch`)
  if (pair.files.crossref) {
    const metadata = JSON.parse(read(pair.files.crossref)).message
    const expected = { doi: metadata.DOI, title: metadata.title?.[0] ?? null, authors: metadata.author?.map((a) => `${a.given ?? ''} ${a.family ?? ''}`.trim()) ?? [], container_title: metadata['container-title']?.[0] ?? null, type: metadata.type ?? null, url: metadata.URL ?? null }
    if (!isDeepStrictEqual(pair.metadata, expected) || normalizeResearchDoi(metadata.DOI) !== pair.relation.doi) throw new Error(`${pair.id}: Crossref metadata mismatch`)
  }
  const research = pair.files.research ? read(pair.files.research) : null
  if (pair.files.research_raw) {
    const raw = read(pair.files.research_raw)
    if (researchBodyHash(raw) !== pair.research.raw_hash) throw new Error(`${pair.id}: research raw hash mismatch`)
    let extracted
    if (pair.research.access === 'full_text') {
      const front = raw.match(/<front\b[^>]*>([\s\S]*?)<\/front>/i)?.[1] ?? ''
      const dois = [...front.matchAll(/<article-id\b[^>]*pub-id-type=["']doi["'][^>]*>([\s\S]*?)<\/article-id>/gi)].map((m) => normalizeResearchDoi(htmlToPlainText(m[1])))
      if (!dois.includes(pair.relation.doi) || pair.research.extraction !== 'jats_body_htmlToPlainText_v1') throw new Error(`${pair.id}: research header DOI/extraction mismatch`)
      extracted = htmlToPlainText(raw.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? '')
    } else {
      const json = JSON.parse(raw)
      const record = json.resultList?.result?.find((r) => normalizeResearchDoi(r.doi ?? '') === pair.relation.doi) ?? json.message
      if (normalizeResearchDoi(record?.doi ?? record?.DOI ?? '') !== pair.relation.doi || pair.research.extraction !== 'metadata_abstract_htmlToPlainText_v1') throw new Error(`${pair.id}: abstract DOI/extraction mismatch`)
      extracted = htmlToPlainText(record.abstractText ?? record.abstract ?? '')
    }
    if (extracted !== research) throw new Error(`${pair.id}: extracted research differs from raw snapshot`)
  }
  const errors = validatePrecisionEvidence(pair, fym, research)
  if (errors.length) throw new Error(`${pair.id}: ${errors.join('; ')}`)
}
console.log(JSON.stringify({ valid: true, database_writes: 0, ...summarizePrecision(round.pairs) }, null, 2))
