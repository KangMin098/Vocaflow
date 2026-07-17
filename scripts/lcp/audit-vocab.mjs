// scripts/lcp/audit-vocab.mjs
//
// 큐레이션 검토 드레인 (Phase 1) — vocab_audit: 발행 도서 챕터 단어장의 어휘 품질 감사.
//   뜻(meaning_ko)·품사(pos)·레벨(v_level)·register(고어 유입) 오류를 문맥 근거로 점검.
//
// 흐름(큐 드레인):
//   1) Admin /admin/curation 에서 "어휘 감사 큐" → book_curation_jobs(task_type='vocab_audit', pending).
//   2) Claude Code 가 책별로:
//        node scripts/lcp/audit-vocab.mjs plan <book_id> [chapter_idx]
//          → 발행 단어장 엔트리(word/뜻/사전 v_level·pos·register + 원문 문장) JSON. 이걸 읽고 감사.
//        node scripts/lcp/audit-vocab.mjs apply <book_id> --file audit.json
//          → audit 검증 + book_curation_jobs.result 기록 + status='done'.
//   * 감사(오류 식별)는 LLM(=Claude Code)이 문맥으로 판단. 실제 사전 교정은 별도(dict-* 스크립트).
//   * 큰 도서는 PostgREST 1000행 상한 → chapter_idx 로 챕터별 감사 권장.
//
// audit JSON 형식:
//   { "flagged":[ { "word":"stroke", "chapter_idx":1,
//                   "issue":"wrong_meaning"|"wrong_pos"|"wrong_level"|"should_exclude"|"other",
//                   "current":"뇌졸중", "suggested":"타격(도끼질)", "note":"문맥=도끼질" } ],
//     "summary":"..." }

import fs from 'node:fs'
import path from 'node:path'

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

const VALID_ISSUE = new Set(['wrong_meaning', 'wrong_pos', 'wrong_level', 'should_exclude', 'other'])

async function getBook(bookId) {
  const { data, error } = await db
    .from('library_books')
    .select('id, title, status, book_v_level')
    .eq('id', bookId)
    .maybeSingle()
  if (error) throw new Error(`book lookup failed: ${error.message}`)
  if (!data) throw new Error(`book not found: ${bookId}`)
  return data
}

// 발행 챕터 단어장 엔트리 + 사전 메타 (3-step fetch → merge).
async function getEntries(bookId, chapterFilter) {
  const { data: sets, error: sErr } = await db
    .from('shared_word_sets')
    .select('id, curation_query')
    .eq('category', 'library_book')
    .eq('is_published', true)
    .filter('curation_query->>book_id', 'eq', bookId)
  if (sErr) throw new Error(`sets lookup failed: ${sErr.message}`)
  const setChapter = new Map()
  const setIds = []
  for (const s of sets ?? []) {
    const ch = Number(s.curation_query?.chapter_idx)
    if (chapterFilter != null && ch !== chapterFilter) continue
    setChapter.set(s.id, ch)
    setIds.push(s.id)
  }
  if (setIds.length === 0) return []

  const { data: words, error: wErr } = await db
    .from('shared_words')
    .select('set_id, word, lemma, meaning_ko, cefr_level, sort_order, source_sentence')
    .in('set_id', setIds)
    .limit(2000)
  if (wErr) throw new Error(`words lookup failed: ${wErr.message}`)

  // 사전 메타 배치 조회 (word=COALESCE(lemma,word) 기준, 500개씩)
  const keys = Array.from(new Set((words ?? []).map((w) => w.lemma || w.word)))
  const dictMap = new Map()
  for (let i = 0; i < keys.length; i += 500) {
    const chunk = keys.slice(i, i + 500)
    const { data: dict, error: dErr } = await db
      .from('shared_dictionary')
      .select('word, v_level, primary_pos, word_register')
      .in('word', chunk)
    if (dErr) throw new Error(`dict lookup failed: ${dErr.message}`)
    for (const d of dict ?? []) dictMap.set(d.word, d)
  }

  return (words ?? [])
    .map((w) => {
      const d = dictMap.get(w.lemma || w.word) ?? {}
      return {
        chapter_idx: setChapter.get(w.set_id) ?? null,
        sort_order: w.sort_order,
        word: w.word,
        lemma: w.lemma,
        meaning_ko: w.meaning_ko,
        cefr: w.cefr_level,
        v_level: d.v_level ?? null,
        pos: d.primary_pos ?? null,
        register: d.word_register ?? null,
        sentence: w.source_sentence,
      }
    })
    .sort((a, b) => a.chapter_idx - b.chapter_idx || a.sort_order - b.sort_order)
}

// ── plan ──────────────────────────────────────────────────────
async function cmdPlan(bookId, chapterFilter) {
  const book = await getBook(bookId)
  const entries = await getEntries(bookId, chapterFilter)
  const plan = {
    book: { id: book.id, title: book.title, status: book.status, book_v_level: book.book_v_level },
    chapter_filter: chapterFilter ?? null,
    entry_count: entries.length,
    truncated: entries.length >= 2000,
    instruction:
      '아래 entries 의 meaning_ko(문맥 대비)·pos·v_level·register 를 점검하세요. ' +
      'sentence 가 문맥 근거. 오류만 flagged 로(issue: wrong_meaning/wrong_pos/wrong_level/should_exclude/other). ' +
      '2000행 도달 시 chapter_idx 인자로 챕터별 감사. audit JSON 저장 후 apply.',
    entries,
  }
  console.log(JSON.stringify(plan, null, 2))
}

// ── apply ─────────────────────────────────────────────────────
function validateAudit(raw) {
  if (typeof raw !== 'object' || raw === null) throw new Error('audit JSON must be an object')
  const flaggedRaw = Array.isArray(raw.flagged) ? raw.flagged : []
  const flagged = flaggedRaw.map((f, i) => {
    if (typeof f.word !== 'string' || f.word.trim() === '')
      throw new Error(`flagged[${i}]: word required`)
    const issue = VALID_ISSUE.has(f.issue) ? f.issue : 'other'
    return {
      word: f.word,
      chapter_idx: typeof f.chapter_idx === 'number' ? f.chapter_idx : null,
      issue,
      current: typeof f.current === 'string' ? f.current : null,
      suggested: typeof f.suggested === 'string' ? f.suggested : null,
      note: typeof f.note === 'string' ? f.note : null,
    }
  })
  return { flagged, summary: typeof raw.summary === 'string' ? raw.summary : null }
}

async function cmdApply(bookId, filePath) {
  const book = await getBook(bookId)
  const a = validateAudit(JSON.parse(fs.readFileSync(filePath, 'utf8')))

  const { data: job } = await db
    .from('book_curation_jobs')
    .select('id')
    .eq('book_id', bookId)
    .eq('task_type', 'vocab_audit')
    .maybeSingle()
  if (!job) {
    console.log('[job] vocab_audit 잡 없음 — "어휘 감사 큐"로 먼저 적재하세요.')
    return
  }

  const result = {
    flagged: a.flagged,
    flagged_count: a.flagged.length,
    summary: a.summary,
    reviewed_at: new Date().toISOString(),
  }
  const { error: jErr } = await db
    .from('book_curation_jobs')
    .update({
      result,
      status: 'done',
      note: `flagged ${a.flagged.length}건`,
      claimed_at: new Date().toISOString(),
    })
    .eq('id', job.id)
  if (jErr) throw new Error(`job update failed: ${jErr.message}`)
  console.log(`[audit] ${book.title} — flagged ${a.flagged.length}건 기록 (status=done)`)
  for (const f of a.flagged.slice(0, 20)) {
    console.log(`  · ${f.word}${f.chapter_idx != null ? ` (ch${f.chapter_idx})` : ''} [${f.issue}] ${f.current ?? ''} → ${f.suggested ?? ''}`)
  }
  if (a.flagged.length > 20) console.log(`  … +${a.flagged.length - 20}건`)
  console.log('※ 실제 사전 교정은 dict-update / dict-fetch 스크립트로 별도 (감사=식별).')
}

// ── main ──────────────────────────────────────────────────────
const [, , cmd, ...rest] = process.argv
const fileIdx = rest.indexOf('--file')
const filePath = fileIdx >= 0 ? rest[fileIdx + 1] : null
try {
  if (cmd === 'plan') {
    if (!rest[0]) throw new Error('usage: plan <book_id> [chapter_idx]')
    const ch = rest[1] && !rest[1].startsWith('--') ? Number(rest[1]) : null
    await cmdPlan(rest[0], ch)
  } else if (cmd === 'apply') {
    if (!rest[0] || !filePath) throw new Error('usage: apply <book_id> --file audit.json')
    await cmdApply(rest[0], filePath)
  } else {
    console.error('commands: plan <book_id> [chapter_idx] | apply <book_id> --file audit.json')
    process.exit(1)
  }
} catch (e) {
  console.error(`[error] ${e.message}`)
  process.exit(1)
}
