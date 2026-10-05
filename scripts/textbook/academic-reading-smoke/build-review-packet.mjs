// scripts/textbook/academic-reading-smoke/build-review-packet.mjs
import fs from 'node:fs'
import path from 'node:path'
import { reviewIdentity } from '../academic-reading-review.mjs'

const base = path.resolve(process.argv[2] ?? '.agent-logs/academic-reading-e2e-smoke')
const rows = JSON.parse(fs.readFileSync(path.join(base, 'middle1/chunk-00.json'), 'utf8'))
const source = rows.find(row => row.reading.preservation_rules?.entry?.pair_id === 'F02')
if (!source) throw new Error('F02 source missing from current export')
const pilot = JSON.parse(fs.readFileSync('scripts/textbook/frym-precision/adaptation-pilot-1.json', 'utf8')).records
const adaptations = ['middle1', 'high1'].map(dir => {
  const input = JSON.parse(fs.readFileSync(path.join(base, dir, 'chunk-00.json'), 'utf8'))
    .find(row => row.adapted_from_id === source.adapted_from_id)
  const draft = JSON.parse(fs.readFileSync(path.join(base, dir, 'chunk-00.out.json'), 'utf8'))
    .find(row => row.adapted_from_id === source.adapted_from_id)
  if (!input || !draft) throw new Error(`F02 ${dir} export or completed draft missing`)
  const binding = reviewIdentity(draft, input)
  const templates = JSON.parse(fs.readFileSync(path.join(base, dir, 'chunk-00.claude_code.review.json'), 'utf8'))
    .filter(row => Object.entries(binding).every(([key, value]) => row?.[key] === value))
  if (templates.length !== 1) throw new Error(`F02 ${dir} review template missing, duplicated, or stale`)
  const template = templates[0]
  const example = pilot.find(row => row.id === `F02-${dir}`)
  if (!example || input.reading.target_key !== draft.reading.target_key ||
      example.text !== draft.text || example.target_key !== draft.reading.target_key)
    throw new Error(`F02 ${dir} export, completed draft, review template, or pilot mismatch`)
  return {
    id: example.id, target: draft.reading.target, target_key: draft.reading.target_key,
    title: draft.title, text: draft.text, reading_analysis: draft.reading.reading_analysis,
    source_rights: draft.reading.source_rights, source_attribution: example.source_attribution,
    review_binding: Object.fromEntries(['source_id', 'source_revision', 'source_hash', 'target_key', 'target_hash', 'draft_hash'].map(key => [key, template[key]])),
  }
})
if (adaptations.length !== 2) throw new Error('F02 middle1/high1 adaptations missing')
const packet = {
  source_id: source.adapted_from_id, source_revision: source.reading.source_revision,
  source_hash: source.reading.source_hash, source_title: source.source_title,
  source_text: source.source_text, source_url: source.source_url,
  preservation_rules: source.reading.preservation_rules, adaptations,
  rights_evidence: {
    checked_at: '2026-10-05T00:00:00Z',
    article_url: source.source_url,
    article_license_excerpt: 'Copyright © 2021 Hutmacher. This is an open-access article distributed under the terms of the Creative Commons Attribution License (CC BY).',
    article_author: 'Fabian Hutmacher',
    license_url: 'https://creativecommons.org/licenses/by/4.0/',
    license_summary: 'Share and adapt for any purpose including commercially, with attribution, license link and change indication; the article attribution of each adaptation provides these.',
  },
}
fs.writeFileSync(path.join(base, 'F02-review-packet.json'), `${JSON.stringify(packet, null, 2)}\n`)
console.log(`F02 packet: ${source.reading.source_hash}; ${adaptations.map(row => row.id).join(', ')}`)
