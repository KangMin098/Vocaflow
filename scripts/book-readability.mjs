// scripts/book-readability.mjs
//
// Flesch-Kincaid 계산 — library_books.flesch_kincaid_grade / flesch_reading_ease backfill.
//
// 데이터 소스 (raw text 없이 산정):
//   - words/sentence ← library_chapters_master.word_count + sentence_offsets
//   - syllables/word ← library_book_vocabularies.first_sentence 샘플 (deduped)
//
// F-K Grade Level: 0.39 (words/sent) + 11.8 (syll/word) - 15.59
// F-K Reading Ease: 206.835 - 1.015 (words/sent) - 84.6 (syll/word)
//
// 사용: node scripts/book-readability.mjs [--book-id <uuid>]

import { makeClient, arg } from './dict-common.mjs'

const supabase = makeClient()
const bookFilter = arg(process.argv, '--book-id', null)

// ── Syllable counter (heuristic, English) ────────────────
function countSyllables(word) {
  if (!word) return 0
  word = word.toLowerCase().replace(/[^a-z']/g, '')
  if (word.length === 0) return 0
  if (word.length <= 3) return 1
  // strip silent terminal 'e' (but not 'le' after consonant)
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '')
  word = word.replace(/^y/, '')
  const groups = word.match(/[aeiouy]+/g)
  return Math.max(1, groups ? groups.length : 1)
}

// ── Sentence tokenizer (simple) ──────────────────────────
function tokenizeWords(text) {
  return (text || '').match(/[A-Za-z][A-Za-z']*/g) ?? []
}

// ── Aggregate syllables/word from sentence corpus ────────
function aggregateSyllables(sentences) {
  let totalWords = 0
  let totalSyll = 0
  for (const s of sentences) {
    for (const w of tokenizeWords(s)) {
      totalWords += 1
      totalSyll += countSyllables(w)
    }
  }
  return { totalWords, totalSyll, syllPerWord: totalWords ? totalSyll / totalWords : 0 }
}

// ── Aggregate words/sentence from chapters ───────────────
function aggregateWordsPerSent(chapters) {
  let totalWords = 0
  let totalSent = 0
  for (const c of chapters) {
    totalWords += c.word_count ?? 0
    const offsets = c.sentence_offsets ?? []
    totalSent += Array.isArray(offsets) ? offsets.length : 0
  }
  return { totalWords, totalSent, wordsPerSent: totalSent ? totalWords / totalSent : 0 }
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

// ── Main ─────────────────────────────────────────────────
const bookQuery = supabase
  .from('library_books')
  .select('id, title, word_count')
  .order('title')
if (bookFilter) bookQuery.eq('id', bookFilter)
const { data: books, error: be } = await bookQuery
if (be) { console.error(be); process.exit(1) }

console.log(`Processing ${books.length} books\n`)
const results = []

for (const book of books) {
  // chapters
  const { data: chapters } = await supabase
    .from('library_chapters_master')
    .select('chapter_idx, word_count, sentence_offsets')
    .eq('library_book_id', book.id)

  if (!chapters || chapters.length === 0) {
    console.log(`  ✗ ${book.title} — no chapters, skip`)
    continue
  }

  const wps = aggregateWordsPerSent(chapters)
  if (wps.totalSent === 0) {
    console.log(`  ✗ ${book.title} — no sentence_offsets, skip`)
    continue
  }

  // sentences sample — paginate to bypass 1000-row default
  const sentences = new Set()
  const PAGE = 1000
  for (let offset = 0; ; offset += PAGE) {
    const { data: vocab } = await supabase
      .from('library_book_vocabularies')
      .select('first_sentence')
      .eq('library_book_id', book.id)
      .not('first_sentence', 'is', null)
      .range(offset, offset + PAGE - 1)
    if (!vocab || vocab.length === 0) break
    for (const v of vocab) if (v.first_sentence) sentences.add(v.first_sentence)
    if (vocab.length < PAGE) break
  }

  const spw = aggregateSyllables([...sentences])
  if (spw.totalWords === 0) {
    console.log(`  ✗ ${book.title} — no syllable sample, skip`)
    continue
  }

  const wpsVal = wps.wordsPerSent
  const spwVal = spw.syllPerWord
  const fkGrade = 0.39 * wpsVal + 11.8 * spwVal - 15.59
  const fkEase  = 206.835 - 1.015 * wpsVal - 84.6 * spwVal

  const grade = clamp(Math.round(fkGrade * 100) / 100, 0, 20)
  const ease  = clamp(Math.round(fkEase * 100) / 100, -50, 130)

  const { error: ue } = await supabase
    .from('library_books')
    .update({
      flesch_kincaid_grade: grade,
      flesch_reading_ease: ease,
      readability_computed_at: new Date().toISOString(),
    })
    .eq('id', book.id)

  if (ue) {
    console.log(`  ✗ ${book.title} — UPDATE failed: ${ue.message}`)
    continue
  }

  const row = {
    title: book.title.slice(0, 50),
    wps: wpsVal.toFixed(2),
    spw: spwVal.toFixed(3),
    fk_grade: grade,
    fk_ease: ease,
    sample: sentences.size,
  }
  results.push(row)
  console.log(`  ✓ ${row.title.padEnd(50)} wps=${row.wps.padStart(6)} spw=${row.spw} grade=${grade} ease=${ease} (sample=${sentences.size})`)
}

console.log(`\nDone · updated ${results.length} books`)
