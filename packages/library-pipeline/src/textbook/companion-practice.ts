// packages/library-pipeline/src/textbook/companion-practice.ts
import { createHash } from 'node:crypto'
import { buildGrammarChoice } from './grammar-choice'
import { buildWordOrder } from './word-order'
import { buildVocabChoice, type VocabLexicon } from './vocab-choice'
import { buildListenChoose, type WordAudio } from './listen-choose'
import type { ElementaryWord } from './elementary'
import { clozeOf } from '../vocab/typeset'
import { canonicalJson } from './review-digest'
import { COMPANION_ACTIVITIES } from './factory-order'

/**
 * Non-reading products on the same order lineage. A brief requests companion activities;
 * they are sealed into each order's `activity_types`. For every unit of an assembled run the
 * existing generators (grammar, word order, vocabulary, listening) run on that unit's own
 * passage, and listening audio also yields dictation and word cards. The diagnostic check
 * reuses the run's own items, one per planned skill. Nothing is invented: a generator that
 * finds no candidate records a skip, and a requested activity with no item for a grade blocks.
 */
export { COMPANION_ACTIVITIES }
export type CompanionActivity = (typeof COMPANION_ACTIVITIES)[number]

export interface CompanionResources {
  lexicon?: VocabLexicon
  isCommonWord?: (word: string) => boolean
  /** Words with Korean meanings eligible for listening/dictation/cards (e.g. curriculum list). */
  wordPool?: readonly ElementaryWord[]
  audioOf?: (word: string) => WordAudio | null
}

type RunUnit = {
  day: number; grade: string; unit_id: string; product_order_id: string; order_revision: number
  order_hash: string; primary_skill: string; passage: string
  items: Array<{ item_id: string; item_type: string; prompt: string }>
}
type AssembledRun = {
  volumeInput: { orders: Array<{ grade: string; order: { activity_types: string[]; product_order_id: string } }>; units: RunUnit[] }
  output: { receipt: { receipt_hash: string; planning_hash: string } }
}

const sha = (value: string) => createHash('sha256').update(value).digest('hex')
const esc = (text: string) => text.replace(/&/gu, '&amp;').replace(/</gu, '&lt;')
  .replace(/>/gu, '&gt;').replace(/"/gu, '&quot;').replace(/'/gu, '&#39;')
const sentencesOf = (passage: string) => passage.trim().split(/(?<=[.!?])\s+/u).filter(Boolean)
const needs: Partial<Record<CompanionActivity, (keyof CompanionResources)[]>> = {
  word_order_practice: ['isCommonWord'], vocab_practice: ['lexicon'],
  listening_practice: ['wordPool', 'audioOf'], dictation_practice: ['wordPool', 'audioOf'], vocab_cards: ['wordPool'],
}

function poolWordsIn(passage: string, pool: readonly ElementaryWord[]) {
  const tokens = new Set(passage.toLowerCase().match(/[a-z]+/gu) ?? [])
  return pool.filter(word => tokens.has(word.word.toLowerCase()))
}

function generate(kind: CompanionActivity, unit: RunUnit, deps: CompanionResources): { body: unknown; html: string } | null {
  const sentences = sentencesOf(unit.passage)
  if (kind === 'grammar_practice') {
    const item = buildGrammarChoice(sentences)
    return item && { body: item, html: `<p>어법상 틀린 것은? ${esc(item.sentences.join(' '))}</p><p>${item.underlines.map(u => `${u.label} ${esc(u.word)}`).join(' ')}</p>` }
  }
  if (kind === 'word_order_practice') {
    for (const [index, sentence] of sentences.entries()) {
      const item = buildWordOrder(sentence, sentences[index - 1] ?? null, deps.isCommonWord!)
      if (item) return { body: item, html: `<p>낱말을 바르게 배열하세요.${item.context ? ` (앞 문장: ${esc(item.context)})` : ''}</p><p>${esc(item.bank.join(' / '))}</p>` }
    }
    return null
  }
  if (kind === 'vocab_practice') {
    const item = buildVocabChoice(sentences, deps.lexicon!)
    return item && { body: item, html: `<p>문맥상 낱말의 쓰임이 적절하지 않은 것은? ${esc(item.sentences.join(' '))}</p><p>${item.underlines.map(u => `${u.label} ${esc(u.word)}`).join(' ')}</p>` }
  }
  const words = deps.wordPool ? poolWordsIn(unit.passage, deps.wordPool) : []
  if (kind === 'listening_practice') {
    for (const word of words) {
      const item = buildListenChoose(word, deps.wordPool!, deps.audioOf!)
      if (item) return { body: item, html: `<p>${esc(item.promptKo)} [음원: ${esc(item.audio.url)} · ${esc(item.audio.attribution)}]</p><p>${item.choices.map(c => `${c.label} ${esc(c.text)}`).join(' ')}</p>` }
    }
    return null
  }
  if (kind === 'dictation_practice') {
    for (const word of words) {
      const audio = deps.audioOf!(word.word)
      // Same licensing rule as listening: no attribution, no item.
      if (audio?.url && audio.attribution) return { body: { kind: 'dictation', word: word.word, audio },
        html: `<p>듣고 낱말을 쓰세요. [음원: ${esc(audio.url)} · ${esc(audio.attribution)}] ________</p>` }
    }
    return null
  }
  if (kind === 'vocab_cards') {
    const cards = words.flatMap(word => {
      const sentence = sentences.find(row => clozeOf(row, word.word))
      const cloze = sentence ? clozeOf(sentence, word.word) : null
      return cloze ? [{ word: word.word, meaning_ko: word.meaningKo, cloze }] : []
    }).slice(0, 3)
    return cards.length ? { body: { kind: 'vocab_cards', cards },
      html: `<p>${cards.map(card => `${esc(card.word)} — ${esc(card.meaning_ko)} · ${esc(card.cloze)}`).join('<br>')}</p>` } : null
  }
  return null
}

export type CompanionBlocker = { grade: string; activity: string; reason: string }

/** Builds the companion practice section for an assembled run; returns blockers instead of partial output. */
export function buildCompanionPractice(run: AssembledRun, deps: CompanionResources) {
  const requested = new Map(run.volumeInput.orders.map(entry => [entry.grade,
    entry.order.activity_types.filter((kind): kind is CompanionActivity => (COMPANION_ACTIVITIES as readonly string[]).includes(kind))]))
  const blockers: CompanionBlocker[] = []
  for (const [grade, kinds] of requested) for (const kind of kinds)
    for (const dep of needs[kind] ?? []) if (!deps[dep]) blockers.push({ grade, activity: kind, reason: `COMPANION_RESOURCE_MISSING:${dep}` })
  if (blockers.length) return { status: 'blocked' as const, blockers }
  const items: Array<{ activity: CompanionActivity; grade: string; day: number; unit_id: string; product_order_id: string
    order_revision: number; order_hash: string; passage_sha256: string; item_sha256: string; html: string }> = []
  const skipped: Array<{ activity: CompanionActivity; unit_id: string; reason: string }> = []
  const units = [...run.volumeInput.units].sort((a, b) => a.day - b.day || a.grade.localeCompare(b.grade))
  for (const unit of units) for (const kind of requested.get(unit.grade) ?? []) {
    if (kind === 'diagnostic_check') continue
    const made = generate(kind, unit, deps)
    if (!made) { skipped.push({ activity: kind, unit_id: unit.unit_id, reason: 'GENERATOR_NO_CANDIDATE' }); continue }
    items.push({ activity: kind, grade: unit.grade, day: unit.day, unit_id: unit.unit_id,
      product_order_id: unit.product_order_id, order_revision: unit.order_revision, order_hash: unit.order_hash,
      passage_sha256: sha(unit.passage), item_sha256: sha(canonicalJson(made.body)), html: made.html })
  }
  // Diagnostic check: the first run item for each planned primary skill, per grade (no new content).
  for (const [grade, kinds] of requested) {
    if (!kinds.includes('diagnostic_check')) continue
    const seen = new Set<string>()
    for (const unit of units.filter(row => row.grade === grade)) {
      if (seen.has(unit.primary_skill)) continue
      seen.add(unit.primary_skill)
      const item = unit.items[0]!
      items.push({ activity: 'diagnostic_check', grade, day: unit.day, unit_id: unit.unit_id,
        product_order_id: unit.product_order_id, order_revision: unit.order_revision, order_hash: unit.order_hash,
        passage_sha256: sha(unit.passage), item_sha256: sha(canonicalJson(item)),
        html: `<p>[진단 · ${esc(unit.primary_skill)} · ${unit.day}일차] ${esc(item.prompt)}</p>` })
    }
  }
  for (const [grade, kinds] of requested) for (const kind of kinds)
    if (!items.some(item => item.grade === grade && item.activity === kind))
      blockers.push({ grade, activity: kind, reason: 'COMPANION_ACTIVITY_EMPTY' })
  if (blockers.length) return { status: 'blocked' as const, blockers, skipped }
  const html = `<!-- SYNTHETIC COMPANION PRACTICE; NOT FOR PUBLICATION -->\n` + items.map(item =>
    `<section data-activity="${item.activity}" data-unit="${esc(item.unit_id)}">${item.html}</section>`).join('\n')
  const manifest = { schema: 'textbook-companion-practice/1', synthetic_fixture: true, non_production: true,
    publish_eligible: false, planning_hash: run.output.receipt.planning_hash,
    run_receipt_hash: run.output.receipt.receipt_hash,
    items: items.map(({ html: _html, ...rest }) => rest), skipped, html_sha256: sha(html) }
  return { status: 'built' as const, html, manifest: { ...manifest, manifest_hash: sha(canonicalJson(manifest)) } }
}

/** Rebuilds from the current run and resources; stored output must match exactly. */
export function verifyCompanionPractice(run: AssembledRun, deps: CompanionResources, output: { html: string; manifest: unknown }) {
  const current = buildCompanionPractice(run, deps)
  if (current.status !== 'built' || current.html !== output.html || canonicalJson(current.manifest) !== canonicalJson(output.manifest))
    throw Error('COMPANION_PRACTICE_STALE_OR_MIXED')
  return current.manifest
}
