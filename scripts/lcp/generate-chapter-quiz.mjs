// scripts/lcp/generate-chapter-quiz.mjs
//
// ScriptQuiz 큐레이션 챕터 퀴즈 — LCP 큐레이션 드레인(Claude Code 배치)용 헬퍼.
//
// 흐름(큐 드레인):
//   1) Admin /admin/curation 에서 "스크립트 퀴즈 큐" → book_curation_jobs(task_type='quiz_gen', pending).
//   2) Claude Code 가 책별로:
//        node scripts/lcp/generate-chapter-quiz.mjs plan <book_id>
//          → 챕터 목록 + 챕터당 목표 문항 수(V-Level 곡선) + 기존 퀴즈 커버리지(JSON).
//        node scripts/lcp/generate-chapter-quiz.mjs content <book_id> <chapter_idx>
//          → 그 챕터 본문 + 목표 N (Claude 가 스토리 기반 MCQ 를 저술).
//        node scripts/lcp/generate-chapter-quiz.mjs insert <book_id> <chapter_idx> --file q.json
//          → 문항 검증 + library_chapter_quiz 전량 교체(idempotent) + book_curation_jobs(quiz_gen) 진행률 갱신.
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

// book_curation_jobs(task_type='quiz_gen') 진행률 갱신 (실측 커버리지 기반). job 없으면 skip.
async function refreshJobProgress(bookId) {
  const chapters = await getChapters(bookId)
  const counts = await existingCounts(bookId)
  const chaptersDone = Array.from(counts.values()).filter((n) => n > 0).length
  const questionsCreated = Array.from(counts.values()).reduce((s, n) => s + n, 0)
  const status = chaptersDone >= chapters.length && chapters.length > 0 ? 'done' : 'running'

  const { data: job } = await db
    .from('book_curation_jobs')
    .select('id')
    .eq('book_id', bookId)
    .eq('task_type', 'quiz_gen')
    .maybeSingle()
  if (!job) {
    console.log('[job] quiz_gen 잡 없음 — 진행률 갱신 skip')
    return
  }
  const { error } = await db
    .from('book_curation_jobs')
    .update({
      chapters_total: chapters.length,
      chapters_done: chaptersDone,
      questions_created: questionsCreated,
      status,
      claimed_at: new Date().toISOString(),
    })
    .eq('book_id', bookId)
    .eq('task_type', 'quiz_gen')
  if (error) throw new Error(`job update failed: ${error.message}`)
  console.log(`[job] ${chaptersDone}/${chapters.length}ch · ${questionsCreated}문 · status=${status}`)
}

// ── batch (진입밴드 대량 드레인) ───────────────────────────────
//
// 왜 배치가 따로 있나: 챕터 하나에 content → 저술 → insert 왕복 3회는 40권 1,091챕터에
//   맞지 않는다. 여러 챕터 본문을 한 파일로 뽑고, 채운 파일 하나를 한 번에 넣는다.
//   ⚠️ **검증은 위 `validateQuestions` 를 그대로 쓴다** — 배치용 검증을 따로 쓰면 규칙이 갈린다.
//
// 대상 선정: 학습자가 실제로 도달하는 장만 — chapter_v_level ≤ 7(수능 1-2등급 이하) 이고
//   300~6,000단어. 너무 짧으면 물을 것이 없고, 너무 길면 한 번에 읽히지 않는다.
//   **이미 문항이 있는 장은 제외한다** — 재실행 안전의 전부다.

const BATCH_MAX_V = 7
const BATCH_MIN_WORDS = 300
const BATCH_MAX_WORDS = 6000

async function cmdExportBatch(bookId, limit, outPath) {
  const book = await getBook(bookId)
  const counts = await existingCounts(bookId)
  const { data, error } = await db
    .from('library_chapters_master')
    .select('chapter_idx, chapter_title, content_hash, word_count, chapter_v_level')
    .eq('library_book_id', bookId)
    .lte('chapter_v_level', BATCH_MAX_V)
    .gte('word_count', BATCH_MIN_WORDS)
    .lte('word_count', BATCH_MAX_WORDS)
    .order('chapter_idx', { ascending: true })
  if (error) throw new Error(`chapters lookup failed: ${error.message}`)

  const todo = (data ?? []).filter((c) => (counts.get(c.chapter_idx) ?? 0) === 0).slice(0, limit)
  const hashes = [...new Set(todo.map((c) => c.content_hash))]
  const contentByHash = new Map()
  for (let i = 0; i < hashes.length; i += 50) {
    const { data: chunks, error: cErr } = await db
      .from('content_chunks')
      .select('hash, content')
      .in('hash', hashes.slice(i, i + 50))
    if (cErr) throw new Error(`content_chunks lookup failed: ${cErr.message}`)
    for (const r of chunks ?? []) contentByHash.set(r.hash, r.content)
  }

  const payload = {
    book: { id: book.id, title: book.title, book_v_level: book.book_v_level },
    target_per_chapter: targetPerChapter(book.book_v_level),
    chapters: todo.map((c) => ({
      chapter_idx: c.chapter_idx,
      chapter_title: c.chapter_title,
      word_count: c.word_count,
      chapter_v_level: c.chapter_v_level,
      content: contentByHash.get(c.content_hash) ?? '',
      questions: [],
    })),
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2))
  console.log(
    `[export] ${book.title} — 남은 대상 ${(data ?? []).filter((c) => (counts.get(c.chapter_idx) ?? 0) === 0).length}장 중 ${todo.length}장 → ${outPath}`,
  )
}

/**
 * 정답 위치 쏠림 검사 — **보기를 섞는 화면이 없다.**
 *
 * 2026-08-30 실측: 기존 1,019문항의 correct_index 분포는 253/256/261/249 로 고르다.
 *   그런데 한 번에 여러 챕터를 저술하면 무심코 정답을 계속 첫 보기에 두게 된다
 *   (실제로 첫 배치 5문항이 전부 index 0 이었다). 그러면 학습자가 본문을 읽지 않고
 *   **첫 보기만 찍어도 맞는다** — 문항이 있어도 학습이 일어나지 않는다.
 *
 * 보기가 3개 이상인 문항만 센다(truefalse 는 위치가 2개뿐이라 쏠림 판정이 무의미하다).
 */
function checkAnswerSpread(questions, label) {
  const multi = questions.filter((q) => q.options.length >= 3)
  if (multi.length === 0) return
  const dist = new Map()
  for (const q of multi) dist.set(q.correct_index, (dist.get(q.correct_index) ?? 0) + 1)
  const top = Math.max(...dist.values())
  const share = top / multi.length
  const summary = [...dist].sort((a, b) => a[0] - b[0]).map(([i, n]) => `${i}:${n}`).join(' ')
  if (multi.length >= 8 && share > 0.5) {
    throw new Error(
      `${label}: 정답 위치가 한쪽에 쏠렸다(${summary} · 최대 ${Math.round(share * 100)}%). ` +
        '화면은 보기를 섞지 않는다 — 첫 보기만 찍어도 맞는 문항집이 된다. 위치를 분산할 것.',
    )
  }
  if (share > 0.5) {
    console.warn(`[warn] ${label}: 정답 위치 쏠림 ${summary} (문항이 적어 경고만)`)
  }
}

/**
 * 학습 카드에 그대로 올라가면 안 되는 낱말 — **좁은 목록**이다.
 *
 * 이 퀴즈는 설계상 **원문을 그대로 인용한 근거 문장**을 화면에 띄운다. 그래서
 * `safety/slur-roots.mjs` 의 넓은 후보 목록을 그대로 쓸 수 없다 — 거기엔 `idiot`·`dwarf`·
 * `savage`·`vagabond` 처럼 문학 독해에 필요한 낱말이 대거 들어 있고, 그것까지 막으면
 * Oz 도, Ragged Dick 도 드레인할 수 없다.
 *
 * 여기 남긴 것은 **뜻이 오직 집단 멸칭인 것들**뿐이다. 시대 문헌(Huckleberry Finn 등)을
 * 채울 때 사람이 문장마다 눈으로 거르는 대신 이 가드가 막는다 —
 * 사람의 주의력은 지치지만 가드는 지치지 않는다.
 */
const CARD_BANNED = [
  'nigger', 'nigra', 'darkie', 'darky', 'pickaninny', 'blackamoor', 'negress', 'sambo',
  // 'injun' — Huckleberry Finn 3장의 "sweat like an Injun" 에서 실제로 걸렸다.
  // 목록을 머리로 지어내면 이런 것이 빠진다. 걸릴 때마다 여기 더한다.
  'redskin', 'injun', 'squaw', 'halfbreed', 'half-breed', 'mulatto', 'quadroon', 'octoroon',
  'coon', 'jap', 'gook', 'wop', 'dago', 'kike', 'kaffir', 'hottentot',
  'retard', 'mongoloid', 'imbecile', 'cretin',
]

/**
 * 학습자에게 보이는 **모든 문자열**을 훑는다 — 질문·한국어 질문·보기·근거 문장.
 * 넣기 전에 배치 전량을 본다(부분 삽입 방지).
 */
/**
 * 정답 **길이** 쏠림 검사 — 위치 쏠림보다 크게 새고 있었다.
 *
 * `checkAnswerSpread` 는 정답이 어느 자리에 있는지만 본다. 그런데 실측 2026-09-05,
 * 위치 분포는 621/601/604/580 으로 **완벽하게 고른데** 「가장 긴 선지를 누른다」 전략의
 * 정답률이 **95.1%(2,288/2,406)** 였다. 우연이면 25% 다. 정답 평균 89.8자 vs 오답 35.8자.
 * 챕터 342개 중 246개(71.9%)는 그 전략만으로 전문항 정답이고, 문항 10개 이상인 57권이
 * 전부 50%를 넘었다. **지문을 한 줄도 안 읽고 95점이 나온다.**
 *
 * 규약은 이미 이것을 정해 두고 있었다(CONVENTIONS 「선택지를 만들면 길이 편향을 반드시
 * 잰다」 — 문항 1.25배 / 배치 40%). 이 적재기만 안 따르고 있었다.
 *
 * 정답을 줄여서 맞추지 말 것 — 답이 흐려진다. **오답을 정답만큼 구체적으로 쓰되
 * 내용이 틀리게** 만드는 것이다.
 */
function checkAnswerLength(questions, label) {
  const multi = questions.filter((q) => q.type !== 'truefalse' && q.options.length >= 3)
  if (multi.length === 0) return
  const lenOf = (o) => String(o?.text ?? '').trim().length

  // ① 문항 단위 — 정답이 오답 평균의 1.25배를 넘으면 그 문항을 거부한다
  const overs = []
  let longest = 0
  for (const q of multi) {
    const lens = q.options.map(lenOf)
    const correct = lens[q.correct_index] ?? 0
    const others = lens.filter((_, i) => i !== q.correct_index)
    const avg = others.reduce((s, x) => s + x, 0) / Math.max(1, others.length)
    if (correct === Math.max(...lens)) longest += 1
    if (avg > 0 && correct > avg * 1.25) overs.push(`"${q.question.slice(0, 40)}…" 정답 ${correct}자 / 오답 평균 ${Math.round(avg)}자`)
  }

  // ② 배치 단위 — 정답이 최장인 비율이 40% 를 넘으면 적재 자체를 거부한다
  const share = longest / multi.length
  if (share > 0.4) {
    throw new Error(
      `${label}: 정답이 가장 긴 선지인 비율 ${Math.round(share * 100)}% (${longest}/${multi.length}) — 상한 40%. ` +
        '지문을 안 읽고 제일 긴 것을 고르면 맞는 문항집이다. ' +
        '정답을 줄이지 말고 **오답을 정답만큼 구체적으로(내용은 틀리게)** 채울 것.',
    )
  }
  if (overs.length) {
    throw new Error(
      `${label}: 정답이 오답 평균의 1.25배를 넘는 문항 ${overs.length}건 — ${overs.slice(0, 3).join(' · ')}`,
    )
  }
}

function checkCardSafety(questions, label) {
  const hits = []
  questions.forEach((q, i) => {
    const fields = [
      ['question', q.question],
      ['question_ko', q.question_ko],
      ['source_snippet', q.source_snippet],
      ...q.options.flatMap((o, j) => [
        [`options[${j}].text`, o.text],
        [`options[${j}].textKo`, o.textKo],
      ]),
    ]
    for (const [name, value] of fields) {
      if (typeof value !== 'string') continue
      const lower = value.toLowerCase()
      for (const word of CARD_BANNED) {
        if (lower.includes(word)) hits.push(`  #${i} ${name}: "${word}"`)
      }
    }
  })
  if (hits.length > 0) {
    throw new Error(
      `${label}: 학습 카드에 올릴 수 없는 낱말이 ${hits.length}곳 있다.` +
        `${'\n'}${hits.join('\n')}${'\n'}` +
        '원문에 있더라도 카드에는 싣지 않는다 — 그 대목을 피해 다른 문장을 근거로 삼을 것.',
    )
  }
}

async function cmdInsertBatch(filePath, commit) {
  const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  const bookId = payload.book?.id
  if (!bookId) throw new Error('book.id 가 없다')
  const book = await getBook(bookId)

  // ⚠️ **넣기 전에 전량을 본다.** 챕터별로 넣다가 중간에 실패하면 반쪽만 들어간다.
  const allQuestions = []
  for (const ch of payload.chapters ?? []) {
    if (!Array.isArray(ch.questions) || ch.questions.length === 0) continue
    allQuestions.push(...validateQuestions(ch.questions))
  }
  checkAnswerSpread(allQuestions, `${book.title} 배치`)
  checkAnswerLength(allQuestions, `${book.title} 배치`)
  checkCardSafety(allQuestions, `${book.title} 배치`)

  let okCh = 0
  let skipped = 0
  let questionsTotal = 0
  for (const ch of payload.chapters ?? []) {
    if (!Array.isArray(ch.questions) || ch.questions.length === 0) {
      skipped++
      continue
    }
    // ⚠️ 위 insert 와 **같은** 검증. 빈 값·범위 밖 correctIndex 는 여기서 걸린다.
    const questions = validateQuestions(ch.questions)
    questionsTotal += questions.length
    if (!commit) {
      okCh++
      continue
    }
    const { error: delErr } = await db
      .from('library_chapter_quiz')
      .delete()
      .eq('library_book_id', bookId)
      .eq('chapter_idx', ch.chapter_idx)
    if (delErr) throw new Error(`delete existing failed (ch=${ch.chapter_idx}): ${delErr.message}`)
    const rows = questions.map((q, i) => ({
      library_book_id: bookId,
      chapter_idx: ch.chapter_idx,
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
    if (insErr) throw new Error(`insert failed (ch=${ch.chapter_idx}): ${insErr.message}`)
    okCh++
  }
  console.log(
    `[insert-batch] ${book.title} — 챕터 ${okCh} · 문항 ${questionsTotal} · 비어서 건너뜀 ${skipped}${commit ? '' : ' [dry-run]'}`,
  )
  if (commit) await refreshJobProgress(bookId)
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
  } else if (cmd === 'export-batch') {
    const limFlag = rest.indexOf('--limit')
    const outFlag = rest.indexOf('--out')
    if (!rest[0] || outFlag < 0)
      throw new Error('usage: export-batch <book_id> [--limit N] --out <path>')
    await cmdExportBatch(rest[0], limFlag >= 0 ? Number.parseInt(rest[limFlag + 1], 10) : 999, rest[outFlag + 1])
  } else if (cmd === 'insert-batch') {
    const fileFlag = rest.indexOf('--file')
    if (fileFlag < 0) throw new Error('usage: insert-batch --file <path> [--commit]')
    await cmdInsertBatch(rest[fileFlag + 1], commit)
  } else if (cmd === 'refresh-job') {
    if (!rest[0]) throw new Error('usage: refresh-job <book_id>')
    await refreshJobProgress(rest[0])
  } else {
    for (const line of [
      'commands:',
      '  plan <book_id>',
      '  content <book_id> <ch>',
      '  insert <book_id> <ch> --file q.json [--commit]',
      '  export-batch <book_id> [--limit N] --out <path>',
      '  insert-batch --file <path> [--commit]',
      '  refresh-job <book_id>',
    ])
      console.error(line)
    process.exit(1)
  }
} catch (e) {
  console.error(`[error] ${e instanceof Error ? e.message : e}`)
  process.exit(1)
}
