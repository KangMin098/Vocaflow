// scripts/audit/scriptquiz-surface3.mts — READ-ONLY 3차: 인용 훼손 유형 분해
//  C. 소유격 's 가 사라진 인용/선지 (학습자에게 비문으로 보인다)
//  D. 아포스트로피가 통째로 빠진 축약형 (dont / cant …)
//  E. 챕터 본문 자체가 잘렸는가 (word_count 대비 content 길이)
//  F. C/D/E 를 제외한 "본문에 정말 없는" 인용

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

const quiz = await fetchAll<QuizRow>('library_chapter_quiz', 'id, library_book_id, chapter_idx, q_order, type, question, question_ko, options, correct_index, source_snippet', 'id')
const books = await fetchAll<{ id: string; title: string | null }>('library_books', 'id, title', 'id')
const titleOf = new Map(books.map((b) => [b.id, b.title ?? b.id]))
const bookIds = [...new Set(quiz.map((q) => q.library_book_id))]

const chapters: { library_book_id: string; chapter_idx: number; content_hash: string | null; word_count: number | null }[] = []
for (let i = 0; i < bookIds.length; i += 20) {
  const { data, error } = await db.from('library_chapters_master').select('library_book_id, chapter_idx, content_hash, word_count').in('library_book_id', bookIds.slice(i, i + 20))
  if (error) throw new Error('chapters: ' + error.message)
  chapters.push(...(data as any[]))
}
const key = (b: string, c: number) => b + '#' + c
const chapOf = new Map(chapters.map((c) => [key(c.library_book_id, c.chapter_idx), c]))
const allHashes = [...new Set(chapters.map((c) => c.content_hash).filter((h): h is string => !!h))]
const contentByHash = new Map<string, string>()
for (let i = 0; i < allHashes.length; i += 40) {
  const { data, error } = await db.from('content_chunks').select('hash, content').in('hash', allHashes.slice(i, i + 40))
  if (error) throw new Error('content_chunks: ' + error.message)
  for (const r of data as any[]) contentByHash.set(r.hash, r.content)
}

const L = (s: string) => console.log(s)
const pct = (n: number, d: number) => (d ? ((n / d) * 100).toFixed(1) : '0.0') + '%'
const qref = (q: QuizRow) => `${titleOf.get(q.library_book_id)} ch${q.chapter_idx} q${q.q_order} [${q.id}]`

// normA: 영숫자+공백. normB: 그 위에서 홀로 남은 "s" 토큰 제거(소유격 흡수)
function normA(s: string): string {
  return s.replace(/[‘’ʼ´`]/g, "'").toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
}
function normB(s: string): string {
  return normA(s).split(' ').filter((t) => t !== 's').join(' ')
}
const aByHash = new Map<string, string>()
const bByHash = new Map<string, string>()
for (const [h, c] of contentByHash) {
  aByHash.set(h, normA(c))
  bByHash.set(h, normB(c))
}
const ELLIPSIS = /\s*(?:…|\.\.\.+)\s*/

// ══════ E. 챕터 본문 잘림 ══════
L('════════ E. 퀴즈가 붙은 챕터의 본문이 온전한가 ════════')
const quizChapters = [...new Set(quiz.map((q) => key(q.library_book_id, q.chapter_idx)))]
let short = 0
const shortSamples: string[] = []
let ratioSum = 0
let ratioN = 0
for (const k of quizChapters) {
  const ch = chapOf.get(k)
  if (!ch?.content_hash) continue
  const c = contentByHash.get(ch.content_hash)
  if (!c || !ch.word_count) continue
  const ratio = c.length / ch.word_count
  ratioSum += ratio
  ratioN++
  if (ratio < 4.0) {
    short++
    if (shortSamples.length < 8) {
      const [b, ci] = k.split('#')
      shortSamples.push(`${titleOf.get(b)} ch${ci}: word_count=${ch.word_count} 본문=${c.length}자 (${ratio.toFixed(2)}자/낱말) 실제 낱말 ${c.trim().split(/\s+/).length}`)
    }
  }
}
L(`퀴즈가 붙은 챕터 ${quizChapters.length} · 평균 ${(ratioSum / ratioN).toFixed(2)}자/낱말`)
L(`본문이 word_count 대비 짧음(<4.0자/낱말): ${short} / ${ratioN} (${pct(short, ratioN)})`)
for (const s of shortSamples) L(`  · ${s}`)

// 실제 낱말 수 대비
let shortReal = 0
const shortRealSamples: string[] = []
for (const k of quizChapters) {
  const ch = chapOf.get(k)
  if (!ch?.content_hash || !ch.word_count) continue
  const c = contentByHash.get(ch.content_hash)
  if (!c) continue
  const real = c.trim().split(/\s+/).filter(Boolean).length
  if (real < ch.word_count * 0.8) {
    shortReal++
    if (shortRealSamples.length < 8) {
      const [b, ci] = k.split('#')
      shortRealSamples.push(`${titleOf.get(b)} ch${ci}: 기재 ${ch.word_count} 낱말 → 실제 ${real} 낱말 (${pct(real, ch.word_count)})`)
    }
  }
}
L(`\n실제 낱말 수가 word_count 의 80% 미만: ${shortReal} / ${ratioN} (${pct(shortReal, ratioN)})`)
for (const s of shortRealSamples) L(`  · ${s}`)

// ══════ C/D/F. 인용 훼손 유형 분해 ══════
L('\n\n════════ C·F. "스크립트 근거" 인용 훼손 유형 ════════')
let okA = 0
let possLost = 0
let stillMissing = 0
let denom = 0
const possSamples: QuizRow[] = []
const missSamples: QuizRow[] = []
const possByBook = new Map<string, number>()

function fragsOf(sn: string): string[] {
  return sn.split(ELLIPSIS).map((f) => f.trim()).filter((f) => f.split(/\s+/).filter(Boolean).length >= 3)
}

for (const q of quiz) {
  const sn = q.source_snippet
  if (!sn?.trim()) continue
  const ch = chapOf.get(key(q.library_book_id, q.chapter_idx))
  if (!ch?.content_hash || !aByHash.has(ch.content_hash)) continue
  denom++
  const ca = aByHash.get(ch.content_hash)!
  const cb = bByHash.get(ch.content_hash)!
  const fr = fragsOf(sn)
  const listA = fr.length ? fr : [sn]
  if (listA.every((f) => ca.includes(normA(f)))) {
    okA++
    continue
  }
  if (listA.every((f) => cb.includes(normB(f)))) {
    possLost++
    possByBook.set(q.library_book_id, (possByBook.get(q.library_book_id) ?? 0) + 1)
    if (possSamples.length < 5) possSamples.push(q)
    continue
  }
  stillMissing++
  if (missSamples.length < 6) missSamples.push(q)
}
L(`대조 가능 인용 ${denom}`)
L(`  본문과 일치(생략 … 포함): ${okA} (${pct(okA, denom)})`)
L(`  소유격 's 가 사라진 탓에만 불일치: ${possLost} (${pct(possLost, denom)}) ← 학습자는 비문 인용을 본다`)
L(`  그래도 본문에 없음: ${stillMissing} (${pct(stillMissing, denom)})`)
L(`\n  소유격 소실 도서별 상위:`)
for (const [b, n] of [...possByBook].sort((a, b) => b[1] - a[1]).slice(0, 8)) L(`    · ${titleOf.get(b)}: ${n}`)
L(`\n  소유격 소실 표본:`)
for (const q of possSamples) L(`    · ${qref(q)}\n      ${(q.source_snippet ?? '').slice(0, 170)}`)
L(`\n  본문에 없는 인용 표본:`)
for (const q of missSamples) L(`    · ${qref(q)}\n      ${(q.source_snippet ?? '').slice(0, 170)}`)

// ══════ C2. 소유격 소실이 질문·선지에도 있나 (인접 토큰 쌍 검사) ══════
L('\n\n════════ C2. 질문·선지에도 소유격이 사라졌나 ════════')
let fieldHits = 0
let rowHits = 0
const c2Samples: string[] = []
for (const q of quiz) {
  const ch = chapOf.get(key(q.library_book_id, q.chapter_idx))
  if (!ch?.content_hash || !aByHash.has(ch.content_hash)) continue
  const ca = aByHash.get(ch.content_hash)!
  const fields: [string, string][] = [
    ['question', q.question],
    ...(q.options ?? []).map((o, i) => [`options[${i}]`, o.text ?? ''] as [string, string]),
  ]
  let rowHit = false
  for (const [name, val] of fields) {
    const toks = normA(val).split(' ').filter(Boolean)
    for (let i = 0; i + 1 < toks.length; i++) {
      const pair = toks[i] + ' ' + toks[i + 1]
      const poss = toks[i] + ' s ' + toks[i + 1]
      if (!ca.includes(pair) && ca.includes(poss)) {
        fieldHits++
        rowHit = true
        if (c2Samples.length < 6) c2Samples.push(`${qref(q)} · ${name}: "…${pair}…" (본문은 "${toks[i]}'s ${toks[i + 1]}")\n        ${val.slice(0, 140)}`)
        break
      }
    }
  }
  if (rowHit) rowHits++
}
L(`소유격 's 가 빠진 것으로 확인된 필드 ${fieldHits} · 그런 문항 ${rowHits} / ${quiz.length} (${pct(rowHits, quiz.length)})`)
for (const s of c2Samples) L(`  · ${s}`)

// ══════ D. 아포스트로피 통째 소실 축약형 ══════
L('\n\n════════ D. 아포스트로피가 사라진 축약형 ════════')
const CONTR = /\b(dont|cant|wont|isnt|arent|wasnt|werent|didnt|doesnt|couldnt|wouldnt|shouldnt|havent|hasnt|hadnt|aint|im|ive|ill|id|youre|youve|youll|theyre|theyve|theyll|weve|were?ll|thats|whats|its|lets|hes|shes|theres)\b/gi
const AMBIG = new Set(['im', 'id', 'ill', 'its', 'were', 'hes', 'shes', 'weve', 'well'])
let contrRows = 0
const contrSamples: string[] = []
for (const q of quiz) {
  const fields: [string, string][] = [
    ['question', q.question],
    ['source_snippet', q.source_snippet ?? ''],
    ...(q.options ?? []).map((o, i) => [`options[${i}]`, o.text ?? ''] as [string, string]),
  ]
  const hits: string[] = []
  for (const [name, val] of fields) {
    for (const m of val.matchAll(CONTR)) {
      const w = m[0].toLowerCase()
      if (AMBIG.has(w)) continue
      hits.push(`${name}:"${m[0]}"`)
    }
  }
  if (hits.length) {
    contrRows++
    if (contrSamples.length < 5) contrSamples.push(`${qref(q)} · ${hits.slice(0, 3).join(' ')}`)
  }
}
L(`축약형 아포스트로피 소실 문항: ${contrRows} / ${quiz.length} (${pct(contrRows, quiz.length)})`)
for (const s of contrSamples) L(`  · ${s}`)

L('\n════════ 끝 ════════')
