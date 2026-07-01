// scripts/lcp/generate-chapter-quiz.mjs
//
// ScriptQuiz 큐레이션 챕터 퀴즈 — LCP 큐레이션 드레인(Claude Code 배치)용 헬퍼.
//
// 흐름(큐 드레인):
//   1) Admin /admin/curation 에서 "스크립트 퀴즈 큐" → book_quiz_jobs(pending).
//   2) Claude Code 가 책별로:
//        node scripts/lcp/generate-chapter-quiz.mjs plan <book_id>
//          → 챕터 목록 + 챕터당 목표 문항 수(V-Level 곡선) + 기존 퀴즈 커버리지(JSON).
//        node scripts/lcp/generate-chapter-quiz.mjs content <book_id> <chapter_idx>
//          → 그 챕터 본문 + 목표 N (Claude 가 스토리 기반 MCQ 를 저술).
//        node scripts/lcp/generate-chapter-quiz.mjs insert <book_id> <chapter_idx> --file q.json
//          → 문항 검증 + library_chapter_quiz 전량 교체(idempotent) + book_quiz_jobs 진행률 갱신.
//   * 문항 저술은 LLM(=Claude Code) 이 챕터 본문을 읽고 수행 — 앱 런타임 LLM 0.
//   * 문항 INSERT 는 사용자 명시 승인 후에만 (메모리 규칙).
//
// insert JSON 형식 (배열):
//   [{ "type":"multiple"|"truefalse"|"blank",
//      "question":"...", "questionKo":"...",
//      "options":[{"text":"...","textKo":"..."}, ...],
//      "correctIndex":0,
//      "sourceSnippet":"...", "sourceSentenceIdx":12 }]

import fs from 'node:fs'
import path from 'node:path'

// .env.local 로드
const envPath = path.resolve('apps/web/.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const { createClient } = await import('@supabase/supabase-js')

const url = process.env['NEXT_PUBLIC_SUPABASE_URL']
const key = process.env['SUPABASE_SERVICE_ROLE_KEY']
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const db = createClient(url, key, { auth: { persistSession: false } })

// V-Level → 챕터당 목표 문항 수 (SQL quiz_target_per_chapter 와 동일 곡선 — SSoT 미러).
function targetPerChapter(v) {
  if (v == null) return 5
  if (v <= 1) return 3
  if (v <= 3) return 4
  if (v <= 5) return 5
  if (v === 6) return 6
  if (v === 7) return 7
  if (v === 8) return 8
  if (v === 9) return 9
  return 10
}

async function getBook(bookId) {
  const { data, error } = await db
    .from('library_books')
    .select('id, title, status, book_v_level, chapter_count')
    .eq('id', bookId)
    .maybeSingle()
  if (error) throw new Error(`book lookup failed: ${error.message}`)
  if (!data) throw new Error(`book not found: ${bookId}`)
  return data
}

async function getChapters(bookId) {
  const { data, error } = await db
    .from('library_chapters_master')
    .select('chapter_idx, chapter_title, content_hash, word_count')
    .eq('library_book_id', bookId)
    .order('chapter_idx', { ascending: true })
  if (error) throw new Error(`chapters lookup failed: ${error.message}`)
  return data ?? []
}

async function getChapterContent(bookId, chapterIdx) {
  const { data: ch, error: chErr } = await db
    .from('library_chapters_master')
    .select('chapter_idx, chapter_title, content_hash, word_count')
    .eq('library_book_id', bookId)
    .eq('chapter_idx', chapterIdx)
    .maybeSingle()
  if (chErr) throw new Error(`chapter lookup failed: ${chErr.message}`)
  if (!ch) throw new Error(`chapter not found: book=${bookId} ch=${chapterIdx}`)
  const { data: chunk, error: ccErr } = await db
    .from('content_chunks')
    .select('content')
    .eq('hash', ch.content_hash)
    .maybeSingle()
  if (ccErr) throw new Error(`content_chunks lookup failed: ${ccErr.message}`)
  return { ...ch, content: chunk?.content ?? '' }
}

async function existingCounts(bookId) {
  const { data, error } = await db
    .from('library_chapter_quiz')
    .select('chapter_idx')
    .eq('library_book_id', bookId)
  if (error) throw new Error(`existing quiz lookup failed: ${error.message}`)
  const byChapter = new Map()
  for (const r of data ?? []) byChapter.set(r.chapter_idx, (byChapter.get(r.chapter_idx) ?? 0) + 1)
  return byChapter
}

// ── plan ──────────────────────────────────────────────────────
async function cmdPlan(bookId) {
  const book = await getBook(bookId)
  const chapters = await getChapters(bookId)
  const counts = await existingCounts(bookId)
  const target = targetPerChapter(book.book_v_level)
  const plan = {
    book: { id: book.id, title: book.title, status: book.status, book_v_level: book.book_v_level },
    target_per_chapter: target,
    chapters_total: chapters.length,
    chapters: chapters.map((c) => ({
      chapter_idx: c.chapter_idx,
      chapter_title: c.chapter_title,
      word_count: c.word_count,
      existing_questions: counts.get(c.chapter_idx) ?? 0,
      needs_generation: (counts.get(c.chapter_idx) ?? 0) === 0,
    })),
  }
  console.log(JSON.stringify(plan, null, 2))
}

// ── content ───────────────────────────────────────────────────
async function cmdContent(bookId, chapterIdx) {
  const book = await getBook(bookId)
  const ch = await getChapterContent(bookId, chapterIdx)
  const target = targetPerChapter(book.book_v_level)
  console.log(`# ${book.title} — Chapter ${ch.chapter_idx}${ch.chapter_title ? ` · ${ch.chapter_title}` : ''}`)
  console.log(`# book_v_level=${book.book_v_level} · target_questions=${target} · word_count=${ch.word_count}`)
  console.log('# ─────────────────────────────────────────────')
  console.log(ch.content)
}

// ── insert ────────────────────────────────────────────────────
function validateQuestions(raw) {
  if (!Array.isArray(raw)) throw new Error('JSON root must be an array of questions')
  const out = []
  raw.forEach((q, i) => {
    const where = `question[${i}]`
    const type = q.type === 'truefalse' || q.type === 'blank' ? q.type : 'multiple'
    if (typeof q.question !== 'string' || q.question.trim() === '')
      throw new Error(`${where}: question is required`)
    if (!Array.isArray(q.options) || q.options.length < 2)
      throw new Error(`${where}: options must have >= 2 items`)
    q.options.forEach((o, j) => {
      if (typeof o?.text !== 'string' || o.text.trim() === '')
        throw new Error(`${where}.options[${j}]: text is required`)
    })
    if (
      typeof q.correctIndex !== 'number' ||
      q.correctIndex < 0 ||
      q.correctIndex >= q.options.length
    )
      throw new Error(`${where}: correctIndex out of range`)
    out.push({
      type,
      question: q.question,
      question_ko: q.questionKo ?? null,
      options: q.options.map((o) => ({
        text: o.text,
        ...(o.textKo ? { textKo: o.textKo } : {}),
      })),
      correct_index: q.correctIndex,
      source_snippet: q.sourceSnippet ?? null,
      source_sentence_idx: q.sourceSentenceIdx ?? null,
    })
  })
  return out
}

async function cmdInsert(bookId, chapterIdx, filePath, commit) {
  const book = await getBook(bookId)
  const target = targetPerChapter(book.book_v_level)
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  const questions = validateQuestions(raw)

  console.log(
    `[insert] ${book.title} ch=${chapterIdx} — ${questions.length} questions (target ${target}, V${book.book_v_level})`,
  )
  if (questions.length !== target) {
    console.warn(
      `[warn] question count ${questions.length} != target ${target} (허용 — 목표는 권장값)`,
    )
  }
  if (!commit) {
    console.log('[dry-run] --commit 없음 — 검증만 수행. 삽입하지 않음.')
    console.log(JSON.stringify(questions, null, 2))
    return
  }

  // 전량 교체(idempotent) — 해당 챕터 기존 문항 DELETE 후 INSERT
  const { error: delErr } = await db
    .from('library_chapter_quiz')
    .delete()
    .eq('library_book_id', bookId)
    .eq('chapter_idx', chapterIdx)
  if (delErr) throw new Error(`delete existing failed: ${delErr.message}`)

  const rows = questions.map((q, i) => ({
    library_book_id: bookId,
    chapter_idx: chapterIdx,
    q_order: i + 1,
    type: q.type,
    question: q.question,
    question_ko: q.question_ko,
    options: q.options,
    correct_index: q.correct_index,
    source_snippet: q.source_snippet,
    source_sentence_idx: q.source_sentence_idx,
    book_v_level: book.book_v_level,
  }))
  const { error: insErr } = await db.from('library_chapter_quiz').insert(rows)
  if (insErr) throw new Error(`insert failed: ${insErr.message}`)
  console.log(`[ok] inserted ${rows.length} questions for ch=${chapterIdx}`)

  await refreshJobProgress(bookId)
}

// book_quiz_jobs 진행률 갱신 (실측 커버리지 기반). job 없으면 skip.
async function refreshJobProgress(bookId) {
  const chapters = await getChapters(bookId)
  const counts = await existingCounts(bookId)
  const chaptersDone = Array.from(counts.values()).filter((n) => n > 0).length
  const questionsCreated = Array.from(counts.values()).reduce((s, n) => s + n, 0)
  const status = chaptersDone >= chapters.length && chapters.length > 0 ? 'done' : 'running'

  const { data: job } = await db
    .from('book_quiz_jobs')
    .select('id')
    .eq('book_id', bookId)
    .maybeSingle()
  if (!job) {
    console.log('[job] book_quiz_jobs row 없음 — 진행률 갱신 skip')
    return
  }
  const { error } = await db
    .from('book_quiz_jobs')
    .update({
      chapters_total: chapters.length,
      chapters_done: chaptersDone,
      questions_created: questionsCreated,
      status,
      claimed_at: new Date().toISOString(),
    })
    .eq('book_id', bookId)
  if (error) throw new Error(`job update failed: ${error.message}`)
  console.log(`[job] ${chaptersDone}/${chapters.length}ch · ${questionsCreated}문 · status=${status}`)
}

// ── main ──────────────────────────────────────────────────────
const [, , cmd, ...rest] = process.argv
const commit = rest.includes('--commit')
try {
  if (cmd === 'plan') {
    if (!rest[0]) throw new Error('usage: plan <book_id>')
    await cmdPlan(rest[0])
  } else if (cmd === 'content') {
    if (!rest[0] || rest[1] == null) throw new Error('usage: content <book_id> <chapter_idx>')
    await cmdContent(rest[0], Number.parseInt(rest[1], 10))
  } else if (cmd === 'insert') {
    const fileFlag = rest.indexOf('--file')
    const file = fileFlag >= 0 ? rest[fileFlag + 1] : null
    if (!rest[0] || rest[1] == null || !file)
      throw new Error('usage: insert <book_id> <chapter_idx> --file <path> [--commit]')
    await cmdInsert(rest[0], Number.parseInt(rest[1], 10), file, commit)
  } else if (cmd === 'refresh-job') {
    if (!rest[0]) throw new Error('usage: refresh-job <book_id>')
    await refreshJobProgress(rest[0])
  } else {
    console.error('commands: plan <book_id> | content <book_id> <ch> | insert <book_id> <ch> --file q.json [--commit] | refresh-job <book_id>')
    process.exit(1)
  }
} catch (e) {
  console.error(`[error] ${e instanceof Error ? e.message : e}`)
  process.exit(1)
}
