// scripts/audit/scriptquiz-surface2.mts
// READ-ONLY — 1차 감사에서 나온 두 신호를 정밀 측정.
//  A. 정답 = 최장 선지 (길이 단서만으로 정답을 맞힐 수 있는가)
//  B. source_snippet 이 실제 챕터 본문에 있는가 (생략 인용 vs 변형/창작 인용 분리)

import fs from 'node:fs'
import path from 'node:path'
import https from 'node:https'
import { createClient } from '@supabase/supabase-js'

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
      { hostname: u.hostname, port: 443, path: u.pathname + u.search, method: init.method ?? 'GET', headers: hdrs, agent, servername: u.hostname },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () =>
          resolve(new Response(Buffer.concat(chunks), { status: res.statusCode ?? 500 })),
        )
      },
    )
    req.on('error', reject)
    if (init.body) req.write(init.body)
    req.end()
  })
}
const nodeFetch: typeof fetch = (async (input: any, init: any = {}) => {
  let lastErr: unknown
  for (let a = 0; a < 8; a++) {
    try {
      return await once(input, init)
    } catch (e) {
      lastErr = e
      await new Promise((r) => setTimeout(r, 300 + a * 400))
    }
  }
  throw lastErr
}) as any

const envRaw = fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8')
function envVal(name: string): string {
  const m = envRaw.match(new RegExp('^\\s*' + name + '\\s*=\\s*(.*)\\s*$', 'm'))
  if (!m) throw new Error('missing env ' + name)
  return m[1].trim().replace(/^["']|["']$/g, '')
}
const db = createClient(envVal('NEXT_PUBLIC_SUPABASE_URL'), envVal('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false },
  global: { fetch: nodeFetch },
})

async function fetchAll<T>(table: string, cols: string, order: string): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select(cols).order(order, { ascending: true }).range(from, from + 999)
    if (error) throw new Error(table + ': ' + error.message)
    const rows = (data ?? []) as T[]
    out.push(...rows)
    if (rows.length < 1000) break
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
}

const quiz = await fetchAll<QuizRow>(
  'library_chapter_quiz',
  'id, library_book_id, chapter_idx, q_order, type, question, question_ko, options, correct_index, source_snippet',
  'id',
)
const books = await fetchAll<{ id: string; title: string | null }>('library_books', 'id, title', 'id')
const titleOf = new Map(books.map((b) => [b.id, b.title ?? b.id]))

const bookIds = [...new Set(quiz.map((q) => q.library_book_id))]
const chapters: { library_book_id: string; chapter_idx: number; content_hash: string | null }[] = []
for (let i = 0; i < bookIds.length; i += 20) {
  const { data, error } = await db
    .from('library_chapters_master')
    .select('library_book_id, chapter_idx, content_hash')
    .in('library_book_id', bookIds.slice(i, i + 20))
  if (error) throw new Error('chapters: ' + error.message)
  chapters.push(...(data as any[]))
}
const key = (b: string, c: number) => b + '#' + c
const hashOf = new Map(chapters.map((c) => [key(c.library_book_id, c.chapter_idx), c.content_hash]))
const hashesByBook = new Map<string, string[]>()
for (const c of chapters) {
  if (!c.content_hash) continue
  if (!hashesByBook.has(c.library_book_id)) hashesByBook.set(c.library_book_id, [])
  hashesByBook.get(c.library_book_id)!.push(c.content_hash)
}
const allHashes = [...new Set(chapters.map((c) => c.content_hash).filter((h): h is string => !!h))]
const contentByHash = new Map<string, string>()
for (let i = 0; i < allHashes.length; i += 40) {
  const { data, error } = await db.from('content_chunks').select('hash, content').in('hash', allHashes.slice(i, i + 40))
  if (error) throw new Error('content_chunks: ' + error.message)
  for (const r of data as any[]) contentByHash.set(r.hash, r.content)
}

function normText(s: string): string {
  return s
    .replace(/[‘’ʼ´`]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐‑‒–—―]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}
function loose(s: string): string {
  return normText(s).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
}
const looseByHash = new Map<string, string>()
for (const [h, c] of contentByHash) looseByHash.set(h, loose(c))

const L = (s: string) => console.log(s)
const pct = (n: number, d: number) => (d ? ((n / d) * 100).toFixed(1) : '0.0') + '%'
const qref = (q: QuizRow) => `${titleOf.get(q.library_book_id)} ch${q.chapter_idx} q${q.q_order} [${q.id}]`

// ══════ A. 길이 단서 ══════
const mc = quiz.filter((q) => q.type !== 'truefalse' && (q.options ?? []).length >= 3)
L('════════ A. 정답이 길이만으로 드러나는가 ════════')
L(`MCQ ${mc.length}문항 (선지 전원 4개)`)

let longestWins = 0
let tie = 0
let sumCorrect = 0
let sumDistract = 0
let wordLongest = 0
const perBook = new Map<string, { n: number; win: number }>()
for (const q of mc) {
  const opts = q.options ?? []
  const lens = opts.map((o) => (o.text ?? '').length)
  const wlens = opts.map((o) => (o.text ?? '').trim().split(/\s+/).length)
  const mx = Math.max(...lens)
  const cl = lens[q.correct_index]
  const isMax = cl === mx
  const uniqueMax = lens.filter((x) => x === mx).length === 1
  if (isMax && uniqueMax) longestWins++
  else if (isMax) tie++
  if (wlens[q.correct_index] === Math.max(...wlens)) wordLongest++
  sumCorrect += cl
  sumDistract += (lens.reduce((a, b) => a + b, 0) - cl) / (lens.length - 1)
  const pb = perBook.get(q.library_book_id) ?? { n: 0, win: 0 }
  pb.n++
  if (isMax) pb.win++
  perBook.set(q.library_book_id, pb)
}
L(`\n"가장 긴 선지를 고른다" 전략 정답률: ${pct(longestWins + tie, mc.length)} (단독 최장 ${longestWins} + 동률 ${tie} / ${mc.length})`)
L(`  같은 전략을 무작위로 했을 때 기대치: 25.0%`)
L(`"단어 수가 가장 많은 선지" 전략 정답률: ${pct(wordLongest, mc.length)}`)
L(`정답 평균 길이 ${(sumCorrect / mc.length).toFixed(1)}자 vs 오답 평균 ${(sumDistract / mc.length).toFixed(1)}자 (${(sumCorrect / sumDistract).toFixed(2)}배)`)

const bookRows = [...perBook].map(([b, v]) => ({ t: titleOf.get(b) ?? b, ...v })).sort((a, b) => b.n - a.n)
L(`\n도서별(문항 많은 순 12권) — 최장 선지 전략 정답률:`)
for (const r of bookRows.slice(0, 12)) L(`  · ${r.t}: ${pct(r.win, r.n)} (${r.win}/${r.n})`)
const under50 = bookRows.filter((r) => r.n >= 10 && r.win / r.n < 0.5)
L(`  50% 미만인 도서(문항 10+): ${under50.length} / ${bookRows.filter((r) => r.n >= 10).length}`)

// 그 전략이 실제 세션 점수로는 어떻게 보이나 — 챕터(=세션) 단위
const byChapter = new Map<string, QuizRow[]>()
for (const q of quiz) {
  const k = key(q.library_book_id, q.chapter_idx)
  if (!byChapter.has(k)) byChapter.set(k, [])
  byChapter.get(k)!.push(q)
}
let perfectSessions = 0
let sess90 = 0
let sessTotal = 0
for (const [, rows] of byChapter) {
  const mcRows = rows.filter((q) => q.type !== 'truefalse')
  if (mcRows.length === 0) continue
  sessTotal++
  let win = 0
  for (const q of mcRows) {
    const lens = (q.options ?? []).map((o) => (o.text ?? '').length)
    if (lens[q.correct_index] === Math.max(...lens)) win++
  }
  // truefalse 는 찍기 50% 로 가정하지 않고 MCQ 만 센다
  if (win === mcRows.length) perfectSessions++
  if (win / mcRows.length >= 0.9) sess90++
}
L(`\n세션(챕터) 단위 — 최장 선지만 눌러도:`)
L(`  MCQ 전부 정답인 세션 ${perfectSessions} / ${sessTotal} (${pct(perfectSessions, sessTotal)})`)
L(`  90% 이상인 세션 ${sess90} / ${sessTotal} (${pct(sess90, sessTotal)})`)

// 형식 단서 — 정답만 대시/따옴표를 가지는가
let dashTell = 0
let quoteTell = 0
for (const q of mc) {
  const opts = (q.options ?? []).map((o) => o.text ?? '')
  const has = (s: string, re: RegExp) => re.test(s)
  const dash = /[—–]|\s-\s/
  const quo = /["“”]/
  if (has(opts[q.correct_index], dash) && opts.filter((_, i) => i !== q.correct_index).every((s) => !has(s, dash))) dashTell++
  if (has(opts[q.correct_index], quo) && opts.filter((_, i) => i !== q.correct_index).every((s) => !has(s, quo))) quoteTell++
}
L(`\n형식 단서 — 정답만 대시(—/–/ - ) 포함: ${dashTell} (${pct(dashTell, mc.length)}) · 정답만 따옴표 포함: ${quoteTell} (${pct(quoteTell, mc.length)})`)

const worst = mc
  .map((q) => {
    const lens = (q.options ?? []).map((o) => (o.text ?? '').length)
    const cl = lens[q.correct_index]
    const other = Math.max(...lens.filter((_, i) => i !== q.correct_index))
    return { q, gap: cl - other }
  })
  .sort((a, b) => b.gap - a.gap)
L(`\n길이 격차 상위 3 예:`)
for (const { q, gap } of worst.slice(0, 3)) {
  L(`  · ${qref(q)} (정답이 차순위보다 +${gap}자)`)
  ;(q.options ?? []).forEach((o, i) =>
    L(`      ${i === q.correct_index ? '✔' : ' '} [${String((o.text ?? '').length).padStart(3)}] ${(o.text ?? '').slice(0, 96)}`),
  )
}

// ══════ B. source_snippet 실재성 ══════
L('\n\n════════ B. "스크립트 근거" 인용문이 본문에 실재하는가 ════════')
const ELLIPSIS = /\s*(?:…|\.\.\.+)\s*/
let verbatim = 0
let elisionAllFound = 0
let elisionPartial = 0
let notFoundAtAll = 0
let foundInOtherChapter = 0
const badSamples: QuizRow[] = []
const otherChSamples: QuizRow[] = []
let denom = 0

for (const q of quiz) {
  const sn = q.source_snippet
  if (!sn || sn.trim() === '') continue
  const h = hashOf.get(key(q.library_book_id, q.chapter_idx))
  if (!h || !looseByHash.has(h)) continue
  denom++
  const lc = looseByHash.get(h)!
  const whole = loose(sn)
  if (lc.includes(whole)) {
    verbatim++
    continue
  }
  const frags = sn
    .split(ELLIPSIS)
    .map((f) => loose(f))
    .filter((f) => f.split(' ').filter(Boolean).length >= 3)
  if (frags.length > 1 && frags.every((f) => lc.includes(f))) {
    elisionAllFound++
    continue
  }
  const found = frags.filter((f) => lc.includes(f)).length
  if (frags.length > 0 && found > 0) {
    elisionPartial++
    if (badSamples.length < 6) badSamples.push(q)
  } else {
    notFoundAtAll++
    if (badSamples.length < 6) badSamples.push(q)
  }
  // 다른 챕터에 있나
  const otherHashes = (hashesByBook.get(q.library_book_id) ?? []).filter((x) => x !== h)
  for (const oh of otherHashes) {
    const olc = looseByHash.get(oh)
    if (olc && frags.length > 0 && frags.every((f) => olc.includes(f))) {
      foundInOtherChapter++
      if (otherChSamples.length < 3) otherChSamples.push(q)
      break
    }
  }
}
L(`대조 가능 문항 ${denom}`)
L(`  그대로 실재: ${verbatim} (${pct(verbatim, denom)})`)
L(`  생략(…)으로 이어붙였고 조각이 전부 실재: ${elisionAllFound} (${pct(elisionAllFound, denom)})`)
L(`  ── 위 둘 합계(정상 인용): ${verbatim + elisionAllFound} (${pct(verbatim + elisionAllFound, denom)})`)
L(`  일부 조각이 본문에 없음: ${elisionPartial} (${pct(elisionPartial, denom)})`)
L(`  어느 조각도 본문에 없음(창작/개작 인용): ${notFoundAtAll} (${pct(notFoundAtAll, denom)})`)
L(`  (그 중) 같은 책의 다른 챕터에는 있음: ${foundInOtherChapter}`)
for (const q of otherChSamples) L(`      · ${qref(q)} :: ${(q.source_snippet ?? '').slice(0, 100)}`)

L(`\n어긋난 인용 표본:`)
for (const q of badSamples) {
  const h = hashOf.get(key(q.library_book_id, q.chapter_idx))!
  const lc = looseByHash.get(h)!
  const frags = (q.source_snippet ?? '').split(ELLIPSIS).map((f) => loose(f)).filter((f) => f.split(' ').filter(Boolean).length >= 3)
  L(`  · ${qref(q)}`)
  L(`    인용: ${(q.source_snippet ?? '').slice(0, 190)}`)
  frags.forEach((f, i) => L(`      조각${i + 1} ${lc.includes(f) ? '있음' : '없음'}: ${f.slice(0, 80)}`))
}

L('\n════════ 끝 ════════')
