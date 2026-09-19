// apps/web/scripts/csat-learner/build-dissect-anchors.mts
// Offline verification only. Persist positions/hashes, never PDF text.
import fs from 'node:fs'
import crypto from 'node:crypto'
import { DISSECTION_METADATA } from '../../src/lib/csat/dissect-metadata'
import { buildSkeleton, splitSentences, type AnchorSpec } from '../../src/lib/csat/passage-skeleton'
import { findQuote } from '../../src/lib/csat/quote-match'
import { reflowExam } from '../../src/lib/csat/reflow/reflow'
import { localPapers, pdfPages, serviceDb } from './env.mts'

const db = await serviceDb()
const ids = Object.keys(DISSECTION_METADATA)
const { data, error } = await db.from('csat_item_analyses').select('item_id,version,answer_locus,choice_analysis').in('item_id', ids).eq('status', 'published').order('version', { ascending: false })
if (error) throw error
const papers = localPapers()
const result: Record<string, unknown> = {}
const fragments = (text: string) => [...text.matchAll(/[A-Za-z][A-Za-z0-9 ,.;:\-–—]{12,}/g)].map(m => m[0].trim().replace(/[\s,.;:]+$/, '')).sort((a, b) => b.length - a.length)
for (const exam of [...new Set(ids.map(id => id.split('#')[0]))]) {
  const anchors = JSON.parse(fs.readFileSync(`src/lib/csat/anchor-data/${exam}.json`, 'utf8'))
  const file = papers.get(anchors.sha256)
  if (!file) throw new Error(`Missing local PDF: ${exam}`)
  const nos = ids.filter(id => id.startsWith(exam + '#')).map(id => Number(id.split('#')[1]))
  const reflow = reflowExam(await pdfPages(file), anchors, () => 'R-BLANK', nos)
  for (const no of nos) {
    const id = `${exam}#${no}`
    const analysis = data?.find(a => a.item_id === id)
    const paper = reflow.get(no)
    if (!paper?.ok || !analysis) throw new Error(`Incomplete source: ${id}`)
    const specs: AnchorSpec[] = [{ id: 'answer', quote: analysis.answer_locus.quote, from: 'answer' }]
    for (const choice of analysis.choice_analysis) {
      if (choice.verdict !== 'distractor') continue
      for (const [field, from] of [['how_to_reject', 'reject'], ['why_tempting', 'tempt']] as const) {
        const quote = fragments(choice[field] ?? '').find(q => findQuote(paper.passage, q))
        if (quote) { specs.push({ id: `reject:${choice.n}`, quote, from }); break }
      }
    }
    const { skeleton, placements } = buildSkeleton(paper.passage, specs)
    result[id] = {
      id, no, type_id: 'R-BLANK', chars: skeleton.chars,
      sentences: splitSentences(paper.passage).map(s => ({ chars: s.end - s.start, hash: crypto.createHash('sha256').update(paper.passage.slice(s.start, s.end)).digest('hex'), reveals: [] })),
      anchors: placements.filter(p => p.sentences.length).map(p => ({ ...p, spans: skeleton.sentences.flatMap((s, sentence) => s.reveals.filter(r => r.anchorId === p.id).map(r => ({ sentence, start: r.start, end: r.end }))) })),
    }
    console.log(id, 'placed', placements.filter(p => p.sentences.length).length, '/', specs.length)
  }
}
fs.writeFileSync('src/lib/csat/dissect-anchors.json', JSON.stringify(result, null, 2) + '\n')
