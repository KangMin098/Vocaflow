// scripts/audit/scriptquiz-surface4.mts — READ-ONLY 4차
//  G. "본문에 없는 인용" 173건이 잘린 챕터에 몰려 있나
//  H. content_chunks 가 챕터 전문인가 (표본 원문 확인)
//  I. 잘린 챕터를 학습자가 읽는 경로 확인용 수치

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
    if (typeof rawH.forEach === 'function' && !Array.isArray(rawH)) rawH.forEach((v: string, k: string) => { hdrs[k] = v })
    if (Object.keys(hdrs).length === 0) for (const [k, v] of Object.entries(rawH)) hdrs[k] = String(v)
  }
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const req = https.request({ hostname: u.hostname, port: 443, path: u.pathname + u.search, method: init.method ?? 'GET', headers: hdrs, agent, servername: u.hostname }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => resolve(new Response(Buffer.concat(chunks), { status: res.statusCode ?? 500 })))
    })
    req.on('error', reject)
    if (init.body) req.write(init.body)
    req.end()
  })
}
const nodeFetch: typeof fetch = (async (i: any, n: any = {}) => {
  let e: unknown
  for (let a = 0; a < 8; a++) { try { return await once(i, n) } catch (x) { e = x; await new Promise((r) => setTimeout(r, 300 + a * 400)) } }
  throw e
}) as any
const envRaw = fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8')
const ev = (n: string) => envRaw.match(new RegExp('^\\s*' + n + '\\s*=\\s*(.*)\\s*$', 'm'))![1].trim().replace(/^["']|["']$/g, '')
const db = createClient(ev('NEXT_PUBLIC_SUPABASE_URL'), ev('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false }, global: { fetch: nodeFetch } })

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

interface QuizRow { id: string; library_book_id: string; chapter_idx: number; q_order: number; source_snippet: string | null }
const quiz = await fetchAll<QuizRow>('library_chapter_quiz', 'id, library_book_id, chapter_idx, q_order, source_snippet', 'id')
const books = await fetchAll<{ id: string; title: string | null }>('library_books', 'id, title', 'id')
const titleOf = new Map(books.map((b) => [b.id, b.title ?? b.id]))
const bookIds = [...new Set(quiz.map((q) => q.library_book_id))]

const chapters: any[] = []
for (let i = 0; i < bookIds.length; i += 20) {
  const { data, error } = await db.from('library_chapters_master').select('library_book_id, chapter_idx, chapter_title, content_hash, word_count').in('library_book_id', bookIds.slice(i, i + 20))
  if (error) throw new Error('chapters: ' + error.message)
  chapters.push(...(data as any[]))
}
const key = (b: string, c: number) => b + '#' + c
const chapOf = new Map(chapters.map((c) => [key(c.library_book_id, c.chapter_idx), c]))
const allHashes = [...new Set(chapters.map((c) => c.content_hash).filter(Boolean))] as string[]
const contentByHash = new Map<string, string>()
for (let i = 0; i < allHashes.length; i += 40) {
  const { data, error } = await db.from('content_chunks').select('hash, content').in('hash', allHashes.slice(i, i + 40))
  if (error) throw new Error('content_chunks: ' + error.message)
  for (const r of data as any[]) contentByHash.set(r.hash, r.content)
}

const L = (s: string) => console.log(s)
const pct = (n: number, d: number) => (d ? ((n / d) * 100).toFixed(1) : '0.0') + '%'
function normA(s: string) { return s.replace(/[‘’ʼ´`]/g, "'").toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim() }
function normB(s: string) { return normA(s).split(' ').filter((t) => t !== 's').join(' ') }
const ELLIPSIS = /\s*(?:…|\.\.\.+)\s*/

const realWords = new Map<string, number>()
const truncated = new Set<string>()
for (const c of chapters) {
  if (!c.content_hash) continue
  const t = contentByHash.get(c.content_hash)
  if (!t) continue
  const rw = t.trim().split(/\s+/).filter(Boolean).length
  realWords.set(key(c.library_book_id, c.chapter_idx), rw)
  if (c.word_count && rw < c.word_count * 0.8) truncated.add(key(c.library_book_id, c.chapter_idx))
}

const missing: QuizRow[] = []
for (const q of quiz) {
  const sn = q.source_snippet
  if (!sn?.trim()) continue
  const ch = chapOf.get(key(q.library_book_id, q.chapter_idx))
  if (!ch?.content_hash) continue
  const c = contentByHash.get(ch.content_hash)
  if (!c) continue
  const ca = normA(c)
  const cb = normB(c)
  const fr = sn.split(ELLIPSIS).map((f) => f.trim()).filter((f) => f.split(/\s+/).filter(Boolean).length >= 3)
  const list = fr.length ? fr : [sn]
  if (list.every((f) => ca.includes(normA(f)))) continue
  if (list.every((f) => cb.includes(normB(f)))) continue
  missing.push(q)
}

L('════════ G. "본문에 없는 인용" 의 분포 ════════')
L(`총 ${missing.length}건`)
const inTrunc = missing.filter((q) => truncated.has(key(q.library_book_id, q.chapter_idx)))
L(`  잘린 챕터(실낱말 < word_count×0.8)에 속함: ${inTrunc.length} (${pct(inTrunc.length, missing.length)})`)
const byBook = new Map<string, number>()
for (const q of missing) byBook.set(q.library_book_id, (byBook.get(q.library_book_id) ?? 0) + 1)
L(`  도서 ${byBook.size}권:`)
for (const [b, n] of [...byBook].sort((a, b) => b[1] - a[1])) {
  const tot = quiz.filter((q) => q.library_book_id === b).length
  L(`    · ${titleOf.get(b)}: ${n} / ${tot} (${pct(n, tot)})`)
}
const byChap = new Map<string, number>()
for (const q of missing) byChap.set(key(q.library_book_id, q.chapter_idx), (byChap.get(key(q.library_book_id, q.chapter_idx)) ?? 0) + 1)
L(`  챕터 ${byChap.size}개 · 그 중 잘린 챕터 ${[...byChap.keys()].filter((k) => truncated.has(k)).length}`)

L('\n════════ H. 잘린 챕터 전수 ════════')
const quizChapKeys = [...new Set(quiz.map((q) => key(q.library_book_id, q.chapter_idx)))]
const truncQuizChaps = quizChapKeys.filter((k) => truncated.has(k))
L(`퀴즈가 붙은 챕터 ${quizChapKeys.length} 중 잘린 챕터 ${truncQuizChaps.length}`)
for (const k of truncQuizChaps) {
  const ch = chapOf.get(k)!
  const [b, ci] = k.split('#')
  const qn = quiz.filter((q) => key(q.library_book_id, q.chapter_idx) === k).length
  L(`  · ${titleOf.get(b)} ch${ci}: 기재 ${ch.word_count} → 실제 ${realWords.get(k)} 낱말 (${pct(realWords.get(k) ?? 0, ch.word_count)}) · 문항 ${qn}`)
}

L('\n════════ I. 잘린 챕터 본문 표본 (앞·뒤 80자) ════════')
for (const k of truncQuizChaps.slice(0, 4)) {
  const ch = chapOf.get(k)!
  const t = contentByHash.get(ch.content_hash)!
  const [b, ci] = k.split('#')
  L(`  · ${titleOf.get(b)} ch${ci} (${t.length}자)`)
  L(`    시작: ${t.slice(0, 100).replace(/\s+/g, ' ')}`)
  L(`    끝  : ${t.slice(-100).replace(/\s+/g, ' ')}`)
}

// 책 전체 잘림 현황 (퀴즈 유무 무관) — P&P 등
L('\n════════ J. 도서별 챕터 잘림 (퀴즈 도서 전체) ════════')
const bookTrunc = new Map<string, { n: number; tot: number }>()
for (const c of chapters) {
  const k = key(c.library_book_id, c.chapter_idx)
  if (!realWords.has(k)) continue
  const e = bookTrunc.get(c.library_book_id) ?? { n: 0, tot: 0 }
  e.tot++
  if (truncated.has(k)) e.n++
  bookTrunc.set(c.library_book_id, e)
}
for (const [b, e] of [...bookTrunc].sort((a, b) => b[1].n - a[1].n).slice(0, 10)) {
  if (e.n === 0) break
  L(`  · ${titleOf.get(b)}: 잘린 챕터 ${e.n} / ${e.tot} (${pct(e.n, e.tot)})`)
}
L('\n════════ 끝 ════════')
