// apps/web/scripts/csat-learner/quote-visibility-audit.mts
// Read-only audit of the current learner quote renderer against local PDF extraction and DB passages.
// Run from apps/web with tsx --tsconfig scripts/tsconfig.harness.json; --at and --out are required.
// Only IDs, hashes, versions and measurements are saved. No passages or quotes are persisted.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { EvidenceQuote } from '../../src/components/csat/theater/EvidenceQuote'
import { capQuoteWords, QUOTE_WORD_CAP } from '../../src/lib/csat/quote-display'
import { findQuote, normalizeForMatch } from '../../src/lib/csat/quote-match'
import { REFLOW_VERSION, reflowExam } from '../../src/lib/csat/reflow/reflow'
import type { ReflowAnchors } from '../../src/lib/csat/reflow/types'
import { keysetSelect } from '../../src/lib/supabase/keyset-select'
import { arg, localPapers, pdfPages, serviceDb, writeJson } from './env.mts'

type Item = { id: string; exam_id: string; no: number; type_id: string | null; passage: string | null }
type Analysis = { id: string; item_id: string; version: number; updated_at: string; answer_locus: { quote?: string } | null }
const at = arg('at')
const output = arg('out')
if (!at || !output || !Number.isFinite(Date.parse(at))) throw new Error('--at <ISO time> and --out <json> are required')
const hash = (text: string) => crypto.createHash('sha256').update(text).digest('hex')
const db = await serviceDb()
const exams = await keysetSelect<{ id: string }, string>((cursor, limit) => {
  let q = db.from('csat_exams').select('id').eq('organizer', 'kice').order('id').limit(limit)
  if (cursor) q = q.gt('id', cursor)
  return q
}, row => row.id, 'KICE exams')
const examIds = exams.map(e => e.id)
if (!examIds.length) throw new Error('No KICE exams returned')
const items = await keysetSelect<Item, string>((cursor, limit) => {
  let q = db.from('csat_items').select('id,exam_id,no,type_id,passage').in('exam_id', examIds).eq('in_scope', true).order('id').limit(limit)
  if (cursor) q = q.gt('id', cursor)
  return q
}, row => row.id, 'KICE in-scope items')
const analyses: Analysis[] = []
for (let start = 0; start < items.length; start += 100) {
  const ids = items.slice(start, start + 100).map(i => i.id)
  analyses.push(...await keysetSelect<Analysis, string>((cursor, limit) => {
    let q = db.from('csat_item_analyses').select('id,item_id,version,updated_at,answer_locus').in('item_id', ids).eq('status', 'published').order('id').limit(limit)
    if (cursor) q = q.gt('id', cursor)
    return q
  }, row => row.id, 'Published analyses'))
}
const latest = new Map<string, Analysis>()
for (const a of analyses) if (!latest.has(a.item_id) || latest.get(a.item_id)!.version < a.version) latest.set(a.item_id, a)
const cohort = items.filter(i => latest.has(i.id))
if (!cohort.length) throw new Error('No published KICE items returned')
const papers = localPapers()
const rows: {
  id: string; typeId: string | null; analysisId: string; version: number; updatedAt: string; quoteSha256: string; dbPassageSha256: string;
  devicePassageSha256: string | null; extraction: string; samePassage: boolean | null;
  dbFullMatch: boolean; deviceFullMatch: boolean | null; displayed: boolean; truncated: boolean;
}[] = []
const pdfs: { examId: string; sha256: string | null; items: number; status: string }[] = []
for (const exam of [...new Set(cohort.map(i => i.exam_id))].sort()) {
  const members = cohort.filter(i => i.exam_id === exam)
  const anchorFile = path.resolve(`src/lib/csat/anchor-data/${exam}.json`)
  const anchors = fs.existsSync(anchorFile) ? JSON.parse(fs.readFileSync(anchorFile, 'utf8')) as ReflowAnchors & { sha256: string } : null
  const file = anchors ? papers.get(anchors.sha256) : null
  const typeOf = new Map(items.filter(i => i.exam_id === exam).map(i => [i.no, i.type_id]))
  const extracted = anchors && file
    ? reflowExam(await pdfPages(file), anchors, no => typeOf.get(no) ?? null, [...typeOf.keys()]) : null
  pdfs.push({ examId: exam, sha256: anchors?.sha256 ?? null, items: members.length, status: extracted ? 'extracted' : anchors ? 'missing-pdf' : 'missing-anchors' })
  for (const item of members) {
    const analysis = latest.get(item.id)!
    const quote = analysis.answer_locus?.quote?.trim() ?? ''
    const displayQuote = capQuoteWords(quote)
    const truncated = quote.split(/\s+/).length > QUOTE_WORD_CAP
    const device = extracted?.get(item.no)
    const passage = device?.ok ? device.passage : null
    rows.push({
      id: item.id, typeId: item.type_id, analysisId: analysis.id, version: analysis.version, updatedAt: analysis.updated_at,
      quoteSha256: hash(quote), dbPassageSha256: hash(item.passage ?? ''), devicePassageSha256: device ? hash(device.passage) : null,
      extraction: !extracted ? 'not-measured' : !device ? 'missing-item' : device.ok ? 'ok' : device.reason ?? 'failed',
      samePassage: device ? normalizeForMatch(device.passage).text === normalizeForMatch(item.passage ?? '').text : null,
      dbFullMatch: Boolean(quote && findQuote(item.passage ?? '', quote)),
      deviceFullMatch: device ? Boolean(quote && findQuote(device.passage, quote)) : null,
      displayed: Boolean(renderToStaticMarkup(createElement(EvidenceQuote, { passage, quote: displayQuote, truncated }))),
      truncated,
    })
  }
  console.log(`${exam}: ${members.length} items, ${extracted ? 'PDF extracted' : 'not measured'}`)
}
const normal = rows.filter(r => r.dbFullMatch)
const unmatched = rows.filter(r => !r.dbFullMatch)
const summary = {
  inScopeItems: items.length, publishedItems: cohort.length, analysedVersionsRead: analyses.length,
  measuredItems: rows.filter(r => r.extraction !== 'not-measured').length,
  extractionOk: rows.filter(r => r.extraction === 'ok').length,
  samePassage: rows.filter(r => r.samePassage).length,
  differentPassageIds: rows.filter(r => r.samePassage === false).map(r => r.id),
  dbMatched: normal.length, dbMatchedVisible: normal.filter(r => r.displayed).length,
  dbMatchedHiddenIds: normal.filter(r => !r.displayed).map(r => r.id),
  dbUnmatched: unmatched.length, dbUnmatchedHidden: unmatched.filter(r => !r.displayed).length,
  dbUnmatchedVisibleIds: unmatched.filter(r => r.displayed).map(r => r.id),
  dbUnmatchedIds: unmatched.map(r => r.id),
  allVisible: rows.filter(r => r.displayed).length,
}
const sourceFiles = [
  'scripts/csat-learner/quote-visibility-audit.mts', 'scripts/csat-learner/env.mts',
  'src/components/csat/theater/EvidenceQuote.tsx', 'src/components/csat/theater/ItemPaper.tsx',
  'src/lib/csat/quote-display.ts', 'src/lib/csat/quote-match.ts',
  'src/lib/csat/reflow/reflow.ts', 'src/lib/csat/reflow/pdf-frags.ts', 'src/lib/csat/reflow/read-paper.ts',
]
writeJson(path.resolve(output), {
  measuredAt: at, codeRef: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  reflowVersion: REFLOW_VERSION, dbWrites: false,
  sourceSha256: Object.fromEntries(sourceFiles.map(file => [file, hash(fs.readFileSync(path.resolve(file), 'utf8').replace(/\r\n/g, '\n'))])),
  definition: 'DB full-quote match is a comparison cohort, not a semantic correctness judgment. Display uses the actual EvidenceQuote component and capped quote.',
  scope: 'Known-hash local PDFs through shared pdfPages/reflowExam; not a measurement of arbitrary user PDFs or PDF absence.',
  summary, pdfs, rows,
})
console.log(JSON.stringify(summary, null, 2))
if (summary.measuredItems !== summary.publishedItems) throw new Error('Incomplete PDF coverage; see report, do not report a full-corpus pass')
