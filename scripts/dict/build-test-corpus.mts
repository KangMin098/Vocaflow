// scripts/dict/build-test-corpus.mts
// 단어추출 테스트 코퍼스 — Standard Ebooks(손교정 클린 고전, OCR 손상 없음) ~200권 소싱 →
// 프로덕션과 동일한 winkNLP 추출(@vocaflow/wlp + extract-lemmas 필터) → extraction_test_vocab 적재.
// 실행: node_modules/.bin/tsx scripts/dict/build-test-corpus.mts
// 멱등: extraction_test_books 에 이미 있으면 skip. 프로덕션 library_books 무관(평가 전용).
import fs from 'node:fs'
import { processText } from '@vocaflow/wlp'

const env = fs.readFileSync('apps/web/.env.local', 'utf8')
for (const l of env.split('\n')) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '') }
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY!
const Hget = { apikey: SVC, Authorization: 'Bearer ' + SVC }
const Hup = { ...Hget, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const UA = { 'User-Agent': 'Mozilla/5.0 (Vocaflow extraction-test corpus builder)' }

const TARGET = parseInt(process.env.TARGET || '200')
const MAX_CHARS = 900_000

// ── 프로덕션 추출 필터 복제 (packages/library-pipeline/src/analyze/extract-lemmas.ts) ──
const TOKEN_BLOCKLIST = new Set(['mr', 'mrs', 'ms', 'dr', 'sir', 'madam', 'lord', 'lady', "'s", "'t", "'ll", "'re", "'ve", "'d", "'m", 'll', 're', 've'])
function isValidLearningWord(raw: string): boolean {
  const lemma = raw.toLowerCase().trim()
  if (!lemma || lemma.length < 2 || lemma.length > 30) return false
  if (/\d/.test(lemma)) return false
  if (/[.:]/.test(lemma)) return false
  if (!/^[a-z'-]+$/.test(lemma)) return false
  if (/^['-]|['-]$/.test(lemma)) return false
  if (TOKEN_BLOCKLIST.has(lemma)) return false
  return true
}

function htmlToText(html: string): string {
  let s = html.replace(/<head[\s\S]*?<\/head>/i, '')
  // SE 보일러플레이트 섹션 제거(제목/판권/콜로폰/헌정/제사)
  s = s.replace(/<section[^>]*epub:type="[^"]*(titlepage|imprint|colophon|copyright-page|dedication|epigraph)[^"]*"[\s\S]*?<\/section>/gi, '')
  s = s.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
  s = s.replace(/<[^>]+>/g, ' ')
  s = s.replace(/&#821[67];|&[lr]squo;/g, "'").replace(/&#822[01];|&[lr]dquo;/g, '"')
    .replace(/&#8212;|&mdash;/g, '—').replace(/&#8230;|&hellip;/g, '…')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => { try { return String.fromCharCode(+n) } catch { return ' ' } })
  s = s.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n')
  return s.trim()
}

interface Book { slug: string; title: string }

const SKIP = parseInt(process.env.SKIP || '0')
async function seList(): Promise<Book[]> {
  const seen = new Set<string>()
  const out: Book[] = []
  const want = SKIP + TARGET
  for (let page = 1; page <= 80 && out.length < want; page++) {
    try {
      const r = await fetch(`https://standardebooks.org/ebooks/?page=${page}`, { headers: UA })
      if (!r.ok) break
      const h = await r.text()
      const links = [...h.matchAll(/href="(\/ebooks\/[a-z0-9-]+\/[a-z0-9-]+)"/g)].map(m => m[1])
      let added = 0
      for (const slug of links) {
        if (seen.has(slug)) continue
        seen.add(slug); out.push({ slug, title: slug.split('/').slice(-2).join(' / ') }); added++
        if (out.length >= want) break
      }
      if (added === 0) break
    } catch { /* skip */ }
    await sleep(250)
  }
  return out.slice(SKIP)  // 앞 SKIP권 건너뛰기 → 새 도서
}
async function clearCorpus() {
  for (const t of ['extraction_test_vocab', 'extraction_test_books']) {
    try { await fetch(URL + '/rest/v1/' + t + '?book_gid=gt.-2147483648', { method: 'DELETE', headers: { ...Hget, Prefer: 'return=minimal' } }) } catch {}
  }
}

async function upsertVocab(rows: any[], n = 6) { for (let i = 0; i < n; i++) { try { const r = await fetch(URL + '/rest/v1/extraction_test_vocab', { method: 'POST', headers: Hup, body: JSON.stringify(rows) }); if (r.ok) return true } catch {} await sleep(500 * (i + 1)) } return false }
async function upsertBook(row: any) { try { await fetch(URL + '/rest/v1/extraction_test_books', { method: 'POST', headers: Hup, body: JSON.stringify(row) }) } catch {} }

// slug → 안정적 정수 gid (해시)
function slugGid(slug: string): number { let h = 0; for (let i = 0; i < slug.length; i++) { h = (h * 31 + slug.charCodeAt(i)) | 0 } return Math.abs(h) }

// ── main ──
if (process.env.CLEAR === '1') { await clearCorpus(); console.error('기존 코퍼스 삭제됨') }
const doneSlugs = new Set<string>()
try { const r = await fetch(URL + '/rest/v1/extraction_test_books?select=author,title', { headers: Hget }); const d: any = await r.json(); if (Array.isArray(d)) for (const x of d) doneSlugs.add(x.author + '|' + x.title) } catch {}

const books = await seList()
console.error('Standard Ebooks 소싱:', books.length, '권')

let ok = 0, fail = 0
for (const b of books) {
  const [, , author, title] = b.slug.split('/')
  if (doneSlugs.has(author + '|' + title)) { continue }
  try {
    const res = await fetch(`https://standardebooks.org${b.slug}/text/single-page`, { headers: UA })
    if (!res.ok) { fail++; continue }
    let text = htmlToText(await res.text())
    if (text.length < 5000) { fail++; continue }
    const charLen = text.length
    if (text.length > MAX_CHARS) text = text.slice(0, MAX_CHARS)

    const chunks = text.split(/\n\n+/).reduce<string[]>((acc, p) => {
      if (!acc.length || acc[acc.length - 1].length + p.length > 40000) acc.push(p); else acc[acc.length - 1] += '\n\n' + p
      return acc
    }, [])
    const agg = new Map<string, { freq: number; fs: string }>()
    for (const ch of chunks) {
      const r = processText(ch)
      for (const sent of r.sentences) {
        for (const tk of sent.tokens) {
          if (tk.isStopWord || tk.isPunctuation) continue
          if (tk.pos === 'PROPN') continue
          if (!isValidLearningWord(tk.lemma)) continue
          const e = agg.get(tk.lemma)
          if (e) e.freq++
          else agg.set(tk.lemma, { freq: 1, fs: (r.sentences[tk.sentenceIndex]?.text || '').trim().slice(0, 300) })
        }
      }
    }
    const gid = slugGid(b.slug)
    const rows = [...agg.entries()].map(([lemma, v]) => ({ book_gid: gid, lemma, freq: v.freq, first_sentence: v.fs }))
    for (let i = 0; i < rows.length; i += 800) await upsertVocab(rows.slice(i, i + 800))
    await upsertBook({ book_gid: gid, title, author, download_count: 0, topic: 'standard-ebooks', char_len: charLen, distinct_lemmas: agg.size })
    ok++
    if (ok % 10 === 0) console.error(`  진행 ${ok} — ${author}/${title} (${agg.size} lemmas)`)
    await sleep(150)
  } catch (e: any) { fail++; console.error('  ERR', b.slug, e.message) }
}
console.error('완료 — 성공', ok, '실패', fail)
