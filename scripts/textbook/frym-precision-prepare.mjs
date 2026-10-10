// scripts/textbook/frym-precision-prepare.mjs
// Local evidence acquisition only. No DB writes and no paid-model calls.
import fs from 'node:fs'
import path from 'node:path'
import { createScriptClient } from '../lib/supabase-client.mjs'
import { loadEnv } from './volume-pool.mjs'
import { fetchWithTimeout } from '../../packages/library-pipeline/src/ingest-article/_helpers.ts'
import { epmcFullTextUrl } from '../../packages/library-pipeline/src/ingest-article/europe-pmc.ts'
import { resolveFrontiersSlug, frontiersXmlUrl } from '../../packages/library-pipeline/src/ingest-article/frontiers.ts'
import { frymStudentDoi, researchBodyHash, researchOriginSchema } from '@vocaflow/library-pipeline/research-origin'
import { frymFullTextContent, frymFullTextContainer } from '../../packages/library-pipeline/src/ingest-article/frontiers-young-minds.ts'
import { extractFrymResearchOrigin } from '@vocaflow/library-pipeline/research-origin'
import { acquirePrecisionFullText, acquirePrecisionMetadata, selectPrecisionAbstract } from '../../packages/library-pipeline/src/textbook/parallel-evidence.ts'

const arg = (name) => { const i = process.argv.indexOf(`--${name}`); return i < 0 ? null : process.argv[i + 1] }
if (process.argv.includes('--commit')) throw new Error('Local review preparation has no --commit mode')
const origins = arg('origins')
const workdir = arg('workdir')
if (!origins || !workdir) throw new Error('--origins <export.json> --workdir <new ignored directory> required')
const manifestText = fs.readFileSync(origins, 'utf8')
const manifest = JSON.parse(manifestText)
if (manifest.version !== 1 || manifest.mode !== 'read_only' || !Array.isArray(manifest.rows) || manifest.rows.length < 20 || manifest.rows.length > 50)
  throw new Error('Precision sample must contain 20..50 read-only FYM rows')
const dir = path.resolve(workdir)
if (fs.existsSync(dir)) throw new Error('Use a new evidence directory; existing snapshots are immutable')
fs.mkdirSync(dir, { recursive: true })
const save = (file, text) => fs.writeFileSync(path.join(dir, file), text, { flag: 'wx' })
const json = (value) => `${JSON.stringify(value, null, 2)}\n`
save('origins.json', manifestText)
loadEnv()
const db = createScriptClient()
const selected = manifest.rows.filter((r) => r.status === 'declared_original_source')
if (selected.length < 20 || new Set(selected.map((r) => r.id)).size !== selected.length)
  throw new Error('Precision preparation requires 20..50 distinct articles with declared origins')
for (const row of selected) {
  const origin = researchOriginSchema.parse(row.research_origin)
  if (origin.student_url !== row.source_url || origin.body_hash !== row.source_hash || row.source_id !== `frym-full:${origin.student_doi}`)
    throw new Error(`Origin/source binding mismatch: ${row.id}`)
}
const { data, error } = await db.from('library_articles').select('id,source_id,source_url,content,updated_at').in('id', selected.map((r) => r.id))
if (error) throw new Error(`FYM evidence query failed: ${error.message}`)
const prepared = []
let count = 0
for (const row of selected) {
  const current = data.find((r) => r.id === row.id)
  if (!current || current.source_id !== row.source_id || current.source_url !== row.source_url || current.updated_at !== row.source_revision || researchBodyHash(current.content ?? '') !== row.source_hash)
    throw new Error(`FYM source changed since origin export: ${row.id}`)
  for (const relation of row.research_origin.relations) {
    const id = `F${String(++count).padStart(2, '0')}`
    save(`${id}.fym.txt`, current.content)
    const fymPage = await fetchWithTimeout(row.source_url, { accept: 'text/html', timeoutMs: 30000 })
    if (!fymPage.ok) throw new Error(`FYM evidence page GET ${fymPage.status}: ${row.id}`)
    if (frymStudentDoi(fymPage.url) !== frymStudentDoi(row.source_url)) throw new Error(`FYM redirected to another article: ${row.id}`)
    const fymHtml = await fymPage.text()
    const freshOrigin = extractFrymResearchOrigin({ html: fymHtml, container: frymFullTextContainer(fymHtml), body: frymFullTextContent(fymHtml), studentUrl: row.source_url, checkedAt: new Date().toISOString() })
    if (freshOrigin.body_hash !== row.source_hash || !freshOrigin.relations.some((r) => r.original_work_id === relation.original_work_id && r.evidence === relation.evidence))
      throw new Error(`FYM body/citation changed during evidence preparation: ${row.id}`)
    save(`${id}.fym.html`, fymHtml)
    const doi = relation.original_work_id
    const attempts = []
    let researchText = ''
    let researchUrl = null
    let access = 'unavailable'
    let extraction = null
    let rawHash = null
    let rawFile = null
    const checkedAt = new Date().toISOString()
    const metadata = await acquirePrecisionMetadata(doi, (url) => fetchWithTimeout(url, { accept: 'application/json', timeoutMs: 30000 }))
    attempts.push(...metadata.attempts)
    const crossref = metadata.crossref?.record ?? null
    const epmc = metadata.epmc?.record ?? null
    if (metadata.crossref) save(`${id}.crossref.json`, metadata.crossref.raw)
    if (metadata.epmc) save(`${id}.epmc.json`, metadata.epmc.raw)
    const candidates = []
    if (epmc?.pmcid) candidates.push(epmcFullTextUrl(epmc.pmcid))
    if (doi.startsWith('10.3389/')) {
      try {
        const slug = await resolveFrontiersSlug(doi)
        if (slug) candidates.push(frontiersXmlUrl(slug, doi))
      } catch (error) { attempts.push(`Frontiers resolution: ${error instanceof Error ? error.message : String(error)}`) }
    }
    const fullText = await acquirePrecisionFullText(doi, candidates, (url) => fetchWithTimeout(url, { accept: 'application/xml', timeoutMs: 30000 }))
    attempts.push(...fullText.attempts)
    if (fullText.evidence) {
      const { raw, text, url } = fullText.evidence
      researchText = text
      save(`${id}.research.xml`, raw)
      rawHash = researchBodyHash(raw)
      rawFile = `${id}.research.xml`
      researchUrl = url
      access = 'full_text'
      extraction = 'jats_body_htmlToPlainText_v1'
    }
    if (!researchText) {
      const abstract = selectPrecisionAbstract(epmc?.abstractText, crossref?.abstract)
      if (abstract) {
        researchText = abstract.text
        access = 'abstract_only'
        researchUrl = metadata[abstract.provider].url
        extraction = 'metadata_abstract_htmlToPlainText_v1'
        rawFile = `${id}.${abstract.provider}.json`
        rawHash = researchBodyHash(fs.readFileSync(path.join(dir, rawFile), 'utf8'))
      }
    }
    if (researchText) save(`${id}.research.txt`, researchText)
    const item = {
      id, source: { id: row.id, source_id: row.source_id, title: row.title, source_url: row.source_url, source_revision: row.source_revision, source_hash: row.source_hash, page_hash: row.research_origin.page_hash },
      relation: { doi, url: relation.research_url, citation_hash: researchBodyHash(relation.evidence) },
      metadata: crossref ? { doi: crossref.DOI, title: crossref.title?.[0] ?? null, authors: crossref.author?.map((a) => `${a.given ?? ''} ${a.family ?? ''}`.trim()) ?? [], container_title: crossref['container-title']?.[0] ?? null, type: crossref.type ?? null, url: crossref.URL ?? null } : null,
      research: { access, url: researchUrl, hash: researchText ? researchBodyHash(researchText) : null, raw_hash: rawHash, extraction, checked_at: checkedAt, attempts },
      files: { fym: `${id}.fym.txt`, fym_page: `${id}.fym.html`, fym_page_hash: freshOrigin.page_hash, research: researchText ? `${id}.research.txt` : null, research_raw: rawFile, crossref: crossref ? `${id}.crossref.json` : null, epmc: epmc ? `${id}.epmc.json` : null },
    }
    prepared.push(item)
    console.log(`${id}: ${doi} — ${access}`)
  }
}
const latest = await db.from('library_articles').select('id,source_id,source_url,content,updated_at').in('id', selected.map((r) => r.id))
if (latest.error) throw new Error(`FYM revision recheck failed: ${latest.error.message}`)
for (const row of selected) {
  const current = latest.data?.find((r) => r.id === row.id)
  if (!current || current.updated_at !== row.source_revision || current.source_id !== row.source_id || current.source_url !== row.source_url || researchBodyHash(current.content ?? '') !== row.source_hash)
    throw new Error(`FYM changed during preparation: ${row.id}; use a new evidence directory`)
}
save('prepared.json', json({ version: 1, mode: 'local_review', origins_hash: researchBodyHash(manifestText), sample: manifest.rows.map(({ research_origin, ...row }) => ({ ...row, origin: research_origin ? { student_doi: research_origin.student_doi, page_hash: research_origin.page_hash, checked_at: research_origin.checked_at, status: research_origin.status, relations: research_origin.relations.map((r) => ({ doi: r.original_work_id, url: r.research_url, citation_hash: researchBodyHash(r.evidence) })) } : null })), pairs: prepared }))
console.log(json({ prepared: prepared.length, database_writes: 0, workdir: dir }))
