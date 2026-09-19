// scripts/audit/scriptquiz-surface.mts
//
// READ-ONLY 감사 — library_chapter_quiz 가 학습자 화면에 "틀리게 보이는" 조용한 결함 측정.
// 실행: npx tsx --tsconfig apps/web/tsconfig.json scripts/audit/scriptquiz-surface.mts

import fs from 'node:fs'
import path from 'node:path'
import https from 'node:https'
import { createClient } from '@supabase/supabase-js'

// 이 머신은 ALPN 확장이 붙은 ClientHello 를 드롭한다(reference-node-tls-alpn-blocked).
// Node 내장 fetch(undici, 스냅샷)는 tls.connect 패치를 타지 않으므로 node:https 로 직접 낸다.
const agent = new https.Agent({ keepAlive: true, maxSockets: 4 })
function once(input: any, init: any = {}): Promise<Response> {
  const url = typeof input === 'string' ? input : input.url
  const hdrs: Record<string, string> = {}
  const rawH = init.headers ?? (typeof input === 'object' ? input.headers : undefined)
  if (rawH) {
    if (typeof rawH.forEach === 'function' && !Array.isArray(rawH)) {
      rawH.forEach((v: string, k: string) => {
        hdrs[k] = v
      })
    }
    if (Object.keys(hdrs).length === 0) for (const [k, v] of Object.entries(rawH)) hdrs[k] = String(v)
  }
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const req = https.request(
      {
        hostname: u.hostname,
        port: 443,
        path: u.pathname + u.search,
        method: init.method ?? 'GET',
        headers: hdrs,
        agent,
        servername: u.hostname,
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => {
          const body = Buffer.concat(chunks)
          resolve(
            new Response(body, {
              status: res.statusCode ?? 500,
              headers: Object.fromEntries(
                Object.entries(res.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : String(v ?? '')]),
              ),
            }),
          )
        })
      },
    )
    req.on('error', reject)
    if (init.body) req.write(init.body)
    req.end()
  })
}

const nodeFetch: typeof fetch = (async (input: any, init: any = {}) => {
  let lastErr: unknown
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      return await once(input, init)
    } catch (e) {
      lastErr = e
      await new Promise((r) => setTimeout(r, 300 + attempt * 400))
    }
  }
  throw lastErr
}) as any

const envRaw = fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8')
function envVal(name: string): string {
  const re = new RegExp('^\\s*' + name + '\\s*=\\s*(.*)\\s*$', 'm')
  const m = envRaw.match(re)
  if (!m) throw new Error('missing env ' + name)
  return m[1].trim().replace(/^["']|["']$/g, '')
}
const db = createClient(envVal('NEXT_PUBLIC_SUPABASE_URL'), envVal('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false },
  global: { fetch: nodeFetch },
})

// ── paged fetch helper (PostgREST 1,000행 상한) ───────────────
async function fetchAll<T>(
  table: string,
  cols: string,
  order: string,
  filter?: (q: any) => any,
): Promise<T[]> {
  const out: T[] = []
  const page = 1000
  for (let from = 0; ; from += page) {
    let q: any = db.from(table).select(cols).order(order, { ascending: true }).range(from, from + page - 1)
    if (filter) q = filter(q)
    const { data, error } = await q
    if (error) throw new Error(table + ': ' + error.message)
    const rows = (data ?? []) as T[]
    out.push(...rows)
    if (rows.length < page) break
  }
  return out
}

interface QuizRow {
  id: string
  library_book_id: string
  chapter_idx: number
  q_order: number
  type: string
  question: string
  question_ko: string | null
  options: { text?: string; textKo?: string }[] | null
  correct_index: number
  source_snippet: string | null
  source_sentence_idx: number | null
  book_v_level: number | null
}

interface BookRow {
  id: string
  title: string | null
  status: string | null
  copyright_safe_in_kr: boolean | null
  published_at: string | null
  book_v_level: number | null
}

interface ChapterRow {
  library_book_id: string
  chapter_idx: number
  chapter_title: string | null
  content_hash: string | null
  word_count: number | null
}

// ── 정규화 ────────────────────────────────────────────────────
function normText(s: string): string {
  return s
    .replace(/[‘’ʼ´`]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐‑‒–—―]/g, '-')
    .replace(/…/g, '...')
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
function loose(s: string): string {
  return normText(s).toLowerCase().replace(/[^a-z0-9 ]/g, '')
}

const STOP = new Set([
  'the', 'and', 'that', 'this', 'with', 'from', 'have', 'has', 'had', 'was', 'were', 'been',
  'they', 'them', 'their', 'there', 'then', 'than', 'when', 'what', 'which', 'who', 'whom',
  'will', 'would', 'could', 'should', 'shall', 'into', 'onto', 'upon', 'about', 'after',
  'before', 'because', 'being', 'does', 'did', 'done', 'her', 'his', 'him', 'she', 'you',
  'your', 'not', 'but', 'for', 'are', 'its', 'it', 'all', 'any', 'one', 'two', 'own', 'out',
  'off', 'over', 'under', 'more', 'most', 'some', 'such', 'only', 'other', 'said', 'says',
  'very', 'just', 'also', 'how', 'why', 'where', 'while', 'both', 'each', 'himself', 'herself',
  'themselves', 'itself', 'never', 'ever', 'again', 'once', 'still', 'here',
])
function contentWords(s: string): string[] {
  return loose(s)
    .split(' ')
    .filter((w) => w.length >= 4 && !STOP.has(w))
}

function splitSentences(content: string): string[] {
  return normText(content)
    .split(/(?<=[.!?"'])\s+(?=[A-Z"'(“])/)
    .filter((s) => s.trim().length > 0)
}

// ── main ──────────────────────────────────────────────────────
const quiz = await fetchAll<QuizRow>(
  'library_chapter_quiz',
  'id, library_book_id, chapter_idx, q_order, type, question, question_ko, options, correct_index, source_snippet, source_sentence_idx, book_v_level',
  'id',
)
const books = await fetchAll<BookRow>(
  'library_books',
  'id, title, status, copyright_safe_in_kr, published_at, book_v_level',
  'id',
)
const bookById = new Map(books.map((b) => [b.id, b]))
const bookIds = [...new Set(quiz.map((q) => q.library_book_id))]

const chapters: ChapterRow[] = []
for (let i = 0; i < bookIds.length; i += 20) {
  const slice = bookIds.slice(i, i + 20)
  const { data, error } = await db
    .from('library_chapters_master')
    .select('library_book_id, chapter_idx, chapter_title, content_hash, word_count')
    .in('library_book_id', slice)
  if (error) throw new Error('chapters: ' + error.message)
  chapters.push(...((data ?? []) as ChapterRow[]))
}
const chapKey = (b: string, c: number) => b + '#' + c
const chapById = new Map(chapters.map((c) => [chapKey(c.library_book_id, c.chapter_idx), c]))

// 퀴즈가 붙은 챕터의 본문만 로드
const neededHashes = [
  ...new Set(
    quiz
      .map((q) => chapById.get(chapKey(q.library_book_id, q.chapter_idx))?.content_hash)
      .filter((h): h is string => !!h),
  ),
]
const contentByHash = new Map<string, string>()
for (let i = 0; i < neededHashes.length; i += 40) {
  const { data, error } = await db
    .from('content_chunks')
    .select('hash, content')
    .in('hash', neededHashes.slice(i, i + 40))
  if (error) throw new Error('content_chunks: ' + error.message)
  for (const r of (data ?? []) as { hash: string; content: string }[]) contentByHash.set(r.hash, r.content)
}

const normContentByHash = new Map<string, string>()
const looseContentByHash = new Map<string, string>()
const sentCountByHash = new Map<string, number>()
for (const [h, c] of contentByHash) {
  normContentByHash.set(h, normText(c))
  looseContentByHash.set(h, loose(c))
  sentCountByHash.set(h, splitSentences(c).length)
}

const L = (s: string) => console.log(s)
const pct = (n: number, d: number) => (d ? ((n / d) * 100).toFixed(1) : '0.0') + '%'
function sample<T>(arr: T[], n: number): T[] {
  return arr.slice(0, n)
}
function qref(q: QuizRow) {
  const b = bookById.get(q.library_book_id)
  return `${b?.title ?? '?'} ch${q.chapter_idx} q${q.q_order} [${q.id}]`
}

L('════════ ScriptQuiz / library_chapter_quiz 표면 감사 ════════')
L(`총 문항 ${quiz.length} · 도서 ${bookIds.length} · 챕터 ${new Set(quiz.map((q) => chapKey(q.library_book_id, q.chapter_idx))).size}`)
const typeDist = new Map<string, number>()
for (const q of quiz) typeDist.set(q.type, (typeDist.get(q.type) ?? 0) + 1)
L('type 분포: ' + [...typeDist].map(([t, n]) => `${t}=${n}`).join(' · '))

// ── 발행 게이트: 학습자에게 실제 보이는 문항 ────────────────
const visibleBook = (b?: BookRow) =>
  !!b && b.status === 'published' && !!b.copyright_safe_in_kr && !!b.published_at
const visibleQuiz = quiz.filter((q) => visibleBook(bookById.get(q.library_book_id)))
L(`\n[0] 카탈로그 발행 게이트 (list_book_chapter_quiz_catalog)`)
L(`  학습자에게 보이는 문항 ${visibleQuiz.length} / ${quiz.length} (${pct(visibleQuiz.length, quiz.length)})`)
const hiddenByBook = new Map<string, number>()
for (const q of quiz) if (!visibleBook(bookById.get(q.library_book_id))) hiddenByBook.set(q.library_book_id, (hiddenByBook.get(q.library_book_id) ?? 0) + 1)
L(`  숨은 도서 ${hiddenByBook.size}권 / 문항 ${quiz.length - visibleQuiz.length}`)
for (const [bid, n] of [...hiddenByBook].sort((a, b) => b[1] - a[1]).slice(0, 6)) {
  const b = bookById.get(bid)
  L(`    · ${b?.title ?? bid} — status=${b?.status} safe=${b?.copyright_safe_in_kr} pub=${b?.published_at ? 'y' : 'n'} · ${n}문항`)
}

// ── 1. correct_index 범위 ────────────────────────────────────
const outOfRange = quiz.filter((q) => {
  const n = Array.isArray(q.options) ? q.options.length : 0
  return q.correct_index < 0 || q.correct_index >= n
})
L(`\n[1] correct_index 범위 밖: ${outOfRange.length} / ${quiz.length}`)
for (const q of sample(outOfRange, 3)) L(`    · ${qref(q)} idx=${q.correct_index} n=${q.options?.length}`)

// ── 2. options 이상 ──────────────────────────────────────────
const noOptions = quiz.filter((q) => !Array.isArray(q.options) || q.options.length < 2)
const emptyOptText = quiz.filter((q) => (q.options ?? []).some((o) => typeof o?.text !== 'string' || o.text.trim() === ''))
L(`\n[2] options 결손: 2개 미만 ${noOptions.length} · 빈 text 포함 ${emptyOptText.length} / ${quiz.length}`)

const dupOptions = quiz.filter((q) => {
  const ts = (q.options ?? []).map((o) => loose(o.text ?? ''))
  return new Set(ts).size !== ts.length
})
L(`  선지 중복(정규화 동일): ${dupOptions.length} / ${quiz.length}`)
for (const q of sample(dupOptions, 3)) L(`    · ${qref(q)} :: ${(q.options ?? []).map((o) => o.text).join(' | ')}`)

// ── 3. truefalse — 화면은 index0=O, index1=X 로 고정 렌더 ────
const TRUEISH = /^(true|t|yes|참|맞|o)\b/i
const FALSEISH = /^(false|f|no|거짓|아니|x)\b/i
const tf = quiz.filter((q) => q.type === 'truefalse')
const tfBadCount = tf.filter((q) => (q.options ?? []).length !== 2)
const tfMisordered = tf.filter((q) => {
  const o = q.options ?? []
  if (o.length !== 2) return false
  const a = normText(o[0]?.text ?? '')
  const b = normText(o[1]?.text ?? '')
  return FALSEISH.test(a) && TRUEISH.test(b)
})
const tfNonTF = tf.filter((q) => {
  const o = q.options ?? []
  if (o.length !== 2) return false
  const a = normText(o[0]?.text ?? '')
  const b = normText(o[1]?.text ?? '')
  return !((TRUEISH.test(a) && FALSEISH.test(b)) || (FALSEISH.test(a) && TRUEISH.test(b)))
})
L(`\n[3] truefalse ${tf.length}문항 — 화면은 선지0에 거대 "O", 선지1에 거대 "X" 를 고정 렌더`)
L(`  선지 2개 아님: ${tfBadCount.length}`)
L(`  선지 순서 뒤집힘 (0=False, 1=True → O 아래 "False" 표시): ${tfMisordered.length}`)
for (const q of sample(tfMisordered, 3)) L(`    · ${qref(q)} :: [${(q.options ?? []).map((o) => o.text).join(' | ')}] correct=${q.correct_index}`)
L(`  선지가 True/False 쌍이 아님 (O/X 기호와 무관한 텍스트): ${tfNonTF.length}`)
for (const q of sample(tfNonTF, 4)) L(`    · ${qref(q)} :: [${(q.options ?? []).map((o) => o.text).join(' | ')}]`)

// ── 4. 배지/키보드 힌트 — 비-truefalse 는 "4지선다" 배지 고정 ──
const nonTf = quiz.filter((q) => q.type !== 'truefalse')
const notFour = nonTf.filter((q) => (q.options ?? []).length !== 4)
const lenDist = new Map<number, number>()
for (const q of nonTf) lenDist.set((q.options ?? []).length, (lenDist.get((q.options ?? []).length) ?? 0) + 1)
L(`\n[4] 비-truefalse ${nonTf.length}문항 — 화면 배지는 항상 "4지선다"`)
L(`  선지 수 분포: ` + [...lenDist].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}개=${v}`).join(' · '))
L(`  선지 4개 아님(배지와 불일치): ${notFour.length}`)
for (const q of sample(notFour, 3)) L(`    · ${qref(q)} n=${(q.options ?? []).length}`)

// ── 5. blank 타입 — 빈칸 표시 유무 ──────────────────────────
const blanks = quiz.filter((q) => q.type === 'blank')
const blankNoMarker = blanks.filter((q) => !/(_{2,}|□{2,}|\.{3,}|\[\s*\]|\(\s*\))/.test(q.question))
L(`\n[5] blank 타입 ${blanks.length}문항 · 질문에 빈칸 표시 없음 ${blankNoMarker.length}`)
for (const q of sample(blankNoMarker, 3)) L(`    · ${qref(q)} :: ${q.question.slice(0, 110)}`)

// ── 6. source_snippet 존재 및 본문 실재 여부 ────────────────
const noSnippet = quiz.filter((q) => !q.source_snippet || q.source_snippet.trim() === '')
L(`\n[6] source_snippet ("스크립트 근거"로 인용 렌더)`)
L(`  비어 있음: ${noSnippet.length} / ${quiz.length}`)

const withChapter = quiz.filter((q) => {
  const ch = chapById.get(chapKey(q.library_book_id, q.chapter_idx))
  return !!ch && !!ch.content_hash && contentByHash.has(ch.content_hash)
})
L(`  본문 대조 가능 문항: ${withChapter.length} / ${quiz.length}`)

const notInChapter: QuizRow[] = []
const notInChapterLoose: QuizRow[] = []
for (const q of withChapter) {
  const sn = q.source_snippet
  if (!sn || sn.trim() === '') continue
  const ch = chapById.get(chapKey(q.library_book_id, q.chapter_idx))!
  const nc = normContentByHash.get(ch.content_hash!)!
  const lc = looseContentByHash.get(ch.content_hash!)!
  if (!nc.includes(normText(sn))) {
    notInChapter.push(q)
    if (!lc.includes(loose(sn))) notInChapterLoose.push(q)
  }
}
const snippetDenom = withChapter.filter((q) => q.source_snippet && q.source_snippet.trim() !== '').length
L(`  본문에 그대로 없음(문장부호/공백 정규화 후): ${notInChapter.length} / ${snippetDenom} (${pct(notInChapter.length, snippetDenom)})`)
L(`  본문에 없음(영숫자만 남긴 느슨한 대조에서도): ${notInChapterLoose.length} / ${snippetDenom} (${pct(notInChapterLoose.length, snippetDenom)})`)
for (const q of sample(notInChapterLoose, 4)) {
  L(`    · ${qref(q)}`)
  L(`      snippet: ${(q.source_snippet ?? '').slice(0, 160)}`)
}

// 느슨 대조에서 없는 것 중, 부분(앞 절반)이라도 본문에 있나 → 변형 인용 vs 창작 인용 구분
let partialFound = 0
for (const q of notInChapterLoose) {
  const ch = chapById.get(chapKey(q.library_book_id, q.chapter_idx))!
  const lc = looseContentByHash.get(ch.content_hash!)!
  const w = loose(q.source_snippet ?? '').split(' ').filter(Boolean)
  if (w.length >= 8) {
    const head = w.slice(0, Math.max(6, Math.floor(w.length / 2))).join(' ')
    if (lc.includes(head)) partialFound++
  }
}
L(`  그 중 앞 절반은 본문에 있음(=중간부터 어긋난 변형 인용): ${partialFound} / ${notInChapterLoose.length}`)

// ── 7. snippet 잘림 흔적 ────────────────────────────────────
const snips = quiz.filter((q) => (q.source_snippet ?? '').trim().length > 0)
const truncated = snips.filter((q) => {
  const s = normText(q.source_snippet ?? '')
  return !/[.!?"'”’)]$/.test(s)
})
const lenBuckets = new Map<string, number>()
for (const q of snips) {
  const n = (q.source_snippet ?? '').length
  const b = n < 60 ? '<60' : n < 120 ? '60-119' : n < 200 ? '120-199' : n < 300 ? '200-299' : n < 400 ? '300-399' : '400+'
  lenBuckets.set(b, (lenBuckets.get(b) ?? 0) + 1)
}
L(`\n[7] snippet 길이 분포: ` + [...lenBuckets].map(([k, v]) => `${k}=${v}`).join(' · '))
L(`  종결부호 없이 끝남(잘림 의심): ${truncated.length} / ${snips.length} (${pct(truncated.length, snips.length)})`)
const exact300 = snips.filter((q) => (q.source_snippet ?? '').length === 300).length
L(`  길이 정확히 300: ${exact300}`)
for (const q of sample(truncated, 3)) L(`    · ${qref(q)} :: …${(q.source_snippet ?? '').slice(-70)}`)

// ── 8. snippet 이 정답의 근거인가 (어휘 겹침) ───────────────
const mcq = quiz.filter((q) => q.type !== 'truefalse' && (q.options ?? []).length >= 3 && (q.source_snippet ?? '').trim().length > 0)
let zeroOverlap = 0
let correctBeatsDistractor = 0
let distractorBeatsCorrect = 0
const zeroSamples: QuizRow[] = []
const flipSamples: QuizRow[] = []
for (const q of mcq) {
  const snipW = new Set(contentWords(q.source_snippet ?? ''))
  const score = (t: string) => {
    const w = contentWords(t)
    if (w.length === 0) return 0
    return w.filter((x) => snipW.has(x)).length / w.length
  }
  const opts = q.options ?? []
  const ci = q.correct_index
  if (ci < 0 || ci >= opts.length) continue
  const sc = score(opts[ci]?.text ?? '')
  const sd = opts.map((o, i) => (i === ci ? -1 : score(o.text ?? ''))).filter((x) => x >= 0)
  const maxD = sd.length ? Math.max(...sd) : 0
  if (sc === 0) {
    zeroOverlap++
    if (zeroSamples.length < 4) zeroSamples.push(q)
  }
  if (sc > maxD) correctBeatsDistractor++
  else if (maxD > sc) {
    distractorBeatsCorrect++
    if (flipSamples.length < 4) flipSamples.push(q)
  }
}
L(`\n[8] snippet 이 정답 근거인가 — 내용어 겹침 (MCQ ${mcq.length}문항)`)
L(`  정답 선지 어휘가 snippet 에 하나도 없음: ${zeroOverlap} (${pct(zeroOverlap, mcq.length)})`)
L(`  정답 > 최고오답 겹침: ${correctBeatsDistractor} (${pct(correctBeatsDistractor, mcq.length)})`)
L(`  오답이 정답보다 snippet 과 더 겹침: ${distractorBeatsCorrect} (${pct(distractorBeatsCorrect, mcq.length)})`)
for (const q of zeroSamples) {
  L(`    [겹침0] ${qref(q)}`)
  L(`       Q: ${q.question.slice(0, 100)}`)
  L(`       정답: ${(q.options ?? [])[q.correct_index]?.text?.slice(0, 90)}`)
  L(`       근거: ${(q.source_snippet ?? '').slice(0, 110)}`)
}

// ── 9. 정답이 길이만으로 구별되는가 ────────────────────────
const mc4 = quiz.filter((q) => q.type !== 'truefalse' && (q.options ?? []).length >= 3 && q.correct_index >= 0 && q.correct_index < (q.options ?? []).length)
let longest = 0
let strictLongest = 0
let shortest = 0
for (const q of mc4) {
  const lens = (q.options ?? []).map((o) => (o.text ?? '').length)
  const mx = Math.max(...lens)
  const mn = Math.min(...lens)
  const cl = lens[q.correct_index]
  if (cl === mx) longest++
  if (cl === mx && lens.filter((x) => x === mx).length === 1) strictLongest++
  if (cl === mn) shortest++
}
L(`\n[9] 정답 = 최장 선지 (기대치 ~${(100 / 4).toFixed(0)}%, MCQ ${mc4.length}문항)`)
L(`  최장(동률 포함): ${longest} (${pct(longest, mc4.length)}) · 단독 최장: ${strictLongest} (${pct(strictLongest, mc4.length)}) · 최단: ${shortest} (${pct(shortest, mc4.length)})`)

// ── 10. correct_index 쏠림 (책 단위) ───────────────────────
const distAll = [0, 0, 0, 0, 0, 0]
for (const q of mc4) if (q.correct_index < 6) distAll[q.correct_index]++
L(`\n[10] correct_index 전체 분포(MCQ): ${distAll.slice(0, 5).map((n, i) => `${i}:${n}`).join(' ')}`)
const skewBooks: string[] = []
for (const bid of bookIds) {
  const rows = mc4.filter((q) => q.library_book_id === bid)
  if (rows.length < 20) continue
  const d = new Map<number, number>()
  for (const q of rows) d.set(q.correct_index, (d.get(q.correct_index) ?? 0) + 1)
  const top = Math.max(...d.values())
  if (top / rows.length > 0.4)
    skewBooks.push(`${bookById.get(bid)?.title ?? bid}: ${[...d].sort((a, b) => a[0] - b[0]).map(([i, n]) => `${i}:${n}`).join(' ')} (최대 ${pct(top, rows.length)}, n=${rows.length})`)
}
L(`  한 위치 40% 초과 도서(문항 20+): ${skewBooks.length}`)
for (const s of skewBooks.slice(0, 8)) L(`    · ${s}`)

// ── 11. 같은 세션 안에서 문제 중복 ─────────────────────────
const byChapter = new Map<string, QuizRow[]>()
for (const q of quiz) {
  const k = chapKey(q.library_book_id, q.chapter_idx)
  if (!byChapter.has(k)) byChapter.set(k, [])
  byChapter.get(k)!.push(q)
}
let dupInSession = 0
const dupSamples: string[] = []
for (const [k, rows] of byChapter) {
  const seen = new Map<string, QuizRow>()
  for (const q of rows) {
    const key = loose(q.question)
    if (seen.has(key)) {
      dupInSession++
      if (dupSamples.length < 4) dupSamples.push(`${qref(q)} == q${seen.get(key)!.q_order} :: ${q.question.slice(0, 90)}`)
    } else seen.set(key, q)
  }
}
L(`\n[11] 같은 챕터(=한 세션) 안에 동일 질문 중복: ${dupInSession} / ${quiz.length}`)
for (const s of dupSamples) L(`    · ${s}`)

// ── 12. question_ko ────────────────────────────────────────
const hasKo = /[가-힣]/
const koNull = quiz.filter((q) => !q.question_ko || q.question_ko.trim() === '')
const koNotKorean = quiz.filter((q) => q.question_ko && q.question_ko.trim() !== '' && !hasKo.test(q.question_ko))
const koSameAsEn = quiz.filter((q) => q.question_ko && loose(q.question_ko) === loose(q.question))
L(`\n[12] question_ko (?ko=1 토글 시 표시)`)
L(`  비어 있음: ${koNull.length} / ${quiz.length}`)
L(`  한글 없음: ${koNotKorean.length} · 영어 원문과 동일: ${koSameAsEn.length}`)
for (const q of sample(koNotKorean, 3)) L(`    · ${qref(q)} :: ${q.question_ko}`)

// question_ko 안의 숫자/고유명사가 question 과 어긋나는가 (다른 문제인지 신호)
function nums(s: string): string[] {
  return (s.match(/\d+/g) ?? []).sort()
}
const koNumMismatch = quiz.filter((q) => {
  if (!q.question_ko) return false
  const a = nums(q.question).join(',')
  const b = nums(q.question_ko).join(',')
  return a !== b
})
L(`  질문 영/한 숫자 불일치: ${koNumMismatch.length} / ${quiz.filter((q) => !!q.question_ko).length}`)
for (const q of sample(koNumMismatch, 3)) {
  L(`    · ${qref(q)}`)
  L(`      EN: ${q.question.slice(0, 90)}`)
  L(`      KO: ${(q.question_ko ?? '').slice(0, 90)}`)
}

// 선지 textKo 부분 커버리지 (ko=1 이면 일부만 한글이 붙는다)
const koPartial = quiz.filter((q) => {
  const o = q.options ?? []
  if (o.length === 0) return false
  const withKo = o.filter((x) => x.textKo && x.textKo.trim() !== '').length
  return withKo > 0 && withKo < o.length
})
const koNone = quiz.filter((q) => {
  const o = q.options ?? []
  return o.length > 0 && o.every((x) => !x.textKo || x.textKo.trim() === '')
})
L(`  선지 textKo 일부만 존재: ${koPartial.length} · 전무: ${koNone.length} / ${quiz.length}`)

// ── 13. source_sentence_idx 범위 ──────────────────────────
let idxOut = 0
let idxDenom = 0
let idxNull = 0
const idxSamples: string[] = []
for (const q of quiz) {
  if (q.source_sentence_idx == null) {
    idxNull++
    continue
  }
  const ch = chapById.get(chapKey(q.library_book_id, q.chapter_idx))
  if (!ch?.content_hash || !sentCountByHash.has(ch.content_hash)) continue
  idxDenom++
  const n = sentCountByHash.get(ch.content_hash)!
  if (q.source_sentence_idx < 0 || q.source_sentence_idx >= n) {
    idxOut++
    if (idxSamples.length < 4) idxSamples.push(`${qref(q)} idx=${q.source_sentence_idx} 문장수=${n}`)
  }
}
L(`\n[13] source_sentence_idx (현재 UI 미사용 — 렌더 경로 없음)`)
L(`  null ${idxNull} / ${quiz.length} · 대조 가능 ${idxDenom} · 문장 범위 밖 ${idxOut} (${pct(idxOut, idxDenom)})`)
for (const s of idxSamples) L(`    · ${s}`)

// ── 14. 고아 챕터 / 본문 없음 ─────────────────────────────
const orphan = quiz.filter((q) => !chapById.has(chapKey(q.library_book_id, q.chapter_idx)))
const noHash = quiz.filter((q) => {
  const ch = chapById.get(chapKey(q.library_book_id, q.chapter_idx))
  return !!ch && (!ch.content_hash || !contentByHash.has(ch.content_hash))
})
L(`\n[14] 챕터 연결`)
L(`  library_chapters_master 에 없는 (도서,챕터): ${orphan.length} / ${quiz.length} — 화면 제목이 "Chapter N" 폴백`)
const orphanChs = new Set(orphan.map((q) => chapKey(q.library_book_id, q.chapter_idx)))
L(`    고아 챕터 수 ${orphanChs.size}`)
for (const q of sample(orphan, 4)) L(`    · ${qref(q)}`)
L(`  챕터는 있으나 본문(content_chunks) 없음: ${noHash.length}`)

// ── 15. 정답이 본문에 없는 문자열인가 (MCQ 정답 인용 검증) ──
let correctNotInChapter = 0
let correctInChapterDenom = 0
for (const q of mc4) {
  const ch = chapById.get(chapKey(q.library_book_id, q.chapter_idx))
  if (!ch?.content_hash || !looseContentByHash.has(ch.content_hash)) continue
  const t = loose((q.options ?? [])[q.correct_index]?.text ?? '')
  if (t.split(' ').length > 12 || t.length < 4) continue
  correctInChapterDenom++
  if (!looseContentByHash.get(ch.content_hash)!.includes(t)) correctNotInChapter++
}
L(`\n[15] (참고) 짧은 MCQ 정답 문구가 본문에 문자 그대로 없음: ${correctNotInChapter} / ${correctInChapterDenom} — 환언 정답 포함, 결함 아님`)

L('\n════════ 끝 ════════')
