// scripts/lcp/review-book.mjs
//
// 큐레이션 검토 드레인 (Phase 1) — level_verify: 도서 CEFR/V-Level 을 본문 근거로 재판정.
//
// 흐름(큐 드레인):
//   1) Admin /admin/curation 에서 "레벨 검토 큐" → book_curation_jobs(task_type='level_verify', pending).
//   2) Claude Code 가 책별로:
//        node scripts/lcp/review-book.mjs plan <book_id>
//          → 현재 저장 레벨(cefr/v/confidence) + 챕터 목록 + 본문 샘플(JSON). 이걸 읽고 레벨 판정.
//        node scripts/lcp/review-book.mjs apply <book_id> --file verdict.json [--correct]
//          → verdict 검증 + book_curation_jobs.result 기록 + status='done'.
//            --correct 시 verdict='adjust' 면 library_books.cefr_level/book_v_level 도 교정.
//   * 레벨 판정은 LLM(=Claude Code)이 본문을 읽고 수행 — 앱 런타임 LLM 0.
//   * library_books 교정(--correct)은 사용자 명시 승인 후에만 (메모리 규칙).
//
// verdict JSON 형식:
//   { "assessed_cefr":"B2", "assessed_v_level":7,
//     "verdict":"keep"|"adjust", "confidence":0.9, "rationale":"근거 한 줄" }

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

const VALID_CEFR = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])

async function getBook(bookId) {
  const { data, error } = await db
    .from('library_books')
    .select(
      'id, title, status, cefr_level, cefr_confidence, book_v_level, v_level_centroid_precise, cefrj_level, flesch_kincaid_grade, chapter_count, word_count',
    )
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

async function getContent(hash) {
  if (!hash) return ''
  const { data, error } = await db
    .from('content_chunks')
    .select('content')
    .eq('hash', hash)
    .maybeSingle()
  if (error) throw new Error(`content_chunks lookup failed: ${error.message}`)
  return data?.content ?? ''
}

// ── plan ──────────────────────────────────────────────────────
// 본문 근거로 레벨을 판정할 수 있도록: 저장 레벨 + 챕터 3개(처음/중간/끝) 샘플 발췌.
async function cmdPlan(bookId) {
  const book = await getBook(bookId)
  const chapters = await getChapters(bookId)
  const pickIdx = chapters.length
    ? [0, Math.floor(chapters.length / 2), chapters.length - 1].filter((v, i, a) => a.indexOf(v) === i)
    : []
  const samples = []
  for (const i of pickIdx) {
    const c = chapters[i]
    const content = await getContent(c.content_hash)
    samples.push({
      chapter_idx: c.chapter_idx,
      chapter_title: c.chapter_title,
      word_count: c.word_count,
      excerpt: content.slice(0, 1400),
    })
  }
  const plan = {
    book: {
      id: book.id,
      title: book.title,
      status: book.status,
      word_count: book.word_count,
      chapter_count: book.chapter_count,
    },
    stored_levels: {
      cefr_level: book.cefr_level,
      cefr_confidence: book.cefr_confidence,
      book_v_level: book.book_v_level,
      v_level_centroid_precise: book.v_level_centroid_precise,
      cefrj_level: book.cefrj_level,
      flesch_kincaid_grade: book.flesch_kincaid_grade,
    },
    instruction:
      '아래 excerpt 를 읽고 실제 CEFR(A1~C2) 와 V-Level(0~11) 을 판정하세요. ' +
      'verdict=adjust 면 assessed_* 로 교정 제안, keep 면 저장값 유지. verdict JSON 을 파일로 저장 후 apply.',
    samples,
  }
  console.log(JSON.stringify(plan, null, 2))
}

// ── apply ─────────────────────────────────────────────────────
function validateVerdict(raw) {
  if (typeof raw !== 'object' || raw === null) throw new Error('verdict JSON must be an object')
  if (!VALID_CEFR.has(raw.assessed_cefr)) throw new Error(`assessed_cefr invalid: ${raw.assessed_cefr}`)
  if (typeof raw.assessed_v_level !== 'number' || raw.assessed_v_level < 0 || raw.assessed_v_level > 11)
    throw new Error(`assessed_v_level out of range: ${raw.assessed_v_level}`)
  if (raw.verdict !== 'keep' && raw.verdict !== 'adjust')
    throw new Error(`verdict must be 'keep' | 'adjust'`)
  return {
    assessed_cefr: raw.assessed_cefr,
    assessed_v_level: raw.assessed_v_level,
    verdict: raw.verdict,
    confidence: typeof raw.confidence === 'number' ? raw.confidence : null,
    rationale: typeof raw.rationale === 'string' ? raw.rationale : null,
  }
}

async function cmdApply(bookId, filePath, correct) {
  const book = await getBook(bookId)
  const v = validateVerdict(JSON.parse(fs.readFileSync(filePath, 'utf8')))

  const { data: job } = await db
    .from('book_curation_jobs')
    .select('id')
    .eq('book_id', bookId)
    .eq('task_type', 'level_verify')
    .maybeSingle()
  if (!job) {
    console.log('[job] level_verify 잡 없음 — "레벨 검토 큐"로 먼저 적재하세요.')
    return
  }

  const result = {
    ...v,
    stored_cefr: book.cefr_level,
    stored_v_level: book.book_v_level,
    reviewed_at: new Date().toISOString(),
  }
  const { error: jErr } = await db
    .from('book_curation_jobs')
    .update({ result, status: 'done', claimed_at: new Date().toISOString() })
    .eq('id', job.id)
  if (jErr) throw new Error(`job update failed: ${jErr.message}`)
  console.log(
    `[verdict] ${book.title} — ${v.verdict} · ${book.cefr_level}/V${book.book_v_level} → ${v.assessed_cefr}/V${v.assessed_v_level}` +
      (v.confidence != null ? ` (conf ${v.confidence})` : ''),
  )

  if (correct && v.verdict === 'adjust') {
    const { error: bErr } = await db
      .from('library_books')
      .update({
        cefr_level: v.assessed_cefr,
        book_v_level: v.assessed_v_level,
        status_message: `level_verify: ${book.cefr_level}/V${book.book_v_level} → ${v.assessed_cefr}/V${v.assessed_v_level} (${v.rationale ?? ''})`,
      })
      .eq('id', bookId)
    if (bErr) throw new Error(`library_books correction failed: ${bErr.message}`)
    console.log(`[correct] library_books 교정 적용됨 → cefr=${v.assessed_cefr} v_level=${v.assessed_v_level}`)
  } else if (correct) {
    console.log('[correct] verdict=keep 이라 교정 없음 (result 만 기록).')
  }
}

// ── main ──────────────────────────────────────────────────────
const [, , cmd, ...rest] = process.argv
const correct = rest.includes('--correct')
const fileIdx = rest.indexOf('--file')
const filePath = fileIdx >= 0 ? rest[fileIdx + 1] : null
try {
  if (cmd === 'plan') {
    if (!rest[0]) throw new Error('usage: plan <book_id>')
    await cmdPlan(rest[0])
  } else if (cmd === 'apply') {
    if (!rest[0] || !filePath) throw new Error('usage: apply <book_id> --file verdict.json [--correct]')
    await cmdApply(rest[0], filePath, correct)
  } else {
    console.error('commands: plan <book_id> | apply <book_id> --file verdict.json [--correct]')
    process.exit(1)
  }
} catch (e) {
  console.error(`[error] ${e.message}`)
  process.exit(1)
}
