// scripts/dict/build-test-corpus-gutenberg.mts
// 단어추출 테스트 코퍼스 (신규 소스) — Standard Ebooks 774권 전권 소진 후,
// 미학습 일반화 테스트 지속을 위한 Project Gutenberg 소싱.
// Gutendex API(인기순) → text/plain 본문 → PG 보일러플레이트 제거 →
// 프로덕션과 동일한 winkNLP 추출(@vocaflow/wlp + extract-lemmas 필터) → extraction_test_vocab 적재.
// 실행: OFFSET=300 TARGET=200 CLEAR=1 node_modules/.bin/tsx scripts/dict/build-test-corpus-gutenberg.mts
// 멱등: (author|title) 중복 skip. 프로덕션 library_books 무관(평가 전용).
import fs from 'node:fs'
import { processText } from '@vocaflow/wlp'

const env = fs.readFileSync('apps/web/.env.local', 'utf8')
for (const l of env.split('\n')) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').replace(/\r/g, '') }
const SB = process.env.NEXT_PUBLIC_SUPABASE_URL!, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY!
const Hget = { apikey: SVC, Authorization: 'Bearer ' + SVC }
const Hup = { ...Hget, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const UA = { 'User-Agent': 'Mozilla/5.0 (Vocaflow extraction-test corpus builder)' }

const TARGET = parseInt(process.env.TARGET || '200')
const OFFSET = parseInt(process.env.OFFSET || '0')   // 인기 상위 N권 건너뛰기 (SE 겹침 최소화)
const MAX_CHARS = 900_000

// ── 프로덕션 추출 필터 복제 (packages/library-pipeline/src/analyze/extract-lemmas.ts) ──
const TOKEN_BLOCKLIST = new Set(['mr', 'mrs', 'ms', 'dr', 'sir', 'madam', 'lord', 'lady', "'s", "'t", "'ll", "'re", "'ve", "'d", "'m", 'll', 're', 've',
  'acct', 'dept', 'depts', 'yrs', 'wks', 'wk', 'cts', 'rms', 'mgr', 'mdse', 'recd', 'shipt', 'yd', 'yds', 'yr', 'hr', 'hrs', 'mos', 'pts', 'doz', 'rm',
  'brac', 'shilly', 'shally', 'scarum', 'harum', 'toity', 'hoity', 'tighty', 'jongg', 'jeebies', 'heebie', 'hotsy', 'totsy', 'turvydom', 'willy', 'nilly', 'namby', 'pamby', 'wishy', 'washy', 'higgledy', 'piggledy', 'razzle', 'fuddy', 'duddy', 'teeny', 'weeny', 'itsy', 'bitsy', 'hocus', 'pocus', 'mumbo', 'lutely', 'cisely', 'derful', 'ishness', 'iddity'])
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

// PG plain-text 보일러플레이트 제거 (*** START/END OF ... GUTENBERG EBOOK ***)
function stripGutenberg(raw: string): string {
  let s = raw.replace(/\r\n/g, '\n')
  const start = s.match(/\*\*\*\s*START OF (THE|THIS) PROJECT GUTENBERG EBOOK[\s\S]*?\*\*\*/i)
  if (start) s = s.slice(start.index! + start[0].length)
  const end = s.search(/\*\*\*\s*END OF (THE|THIS) PROJECT GUTENBERG EBOOK/i)
  if (end > 0) s = s.slice(0, end)
  // 남은 PG 안내 블록(라이선스/프로듀서) 제거
  s = s.replace(/Produced by[^\n]*\n/gi, '')
  s = s.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n')
  return s.trim()
}

interface Book { id: number; title: string; author: string; textUrl: string }

async function gutList(): Promise<Book[]> {
  const out: Book[] = []
  const want = OFFSET + TARGET
  let url: string | null = 'https://gutendex.com/books/?languages=en&mime_type=text%2Fplain&sort=popular'
  for (let guard = 0; guard < 200 && out.length < want && url; guard++) {
    try {
      const r = await fetch(url, { headers: UA })
      if (!r.ok) break
      const j: any = await r.json()
      for (const b of j.results || []) {
        // text/plain URL 탐색 (.txt 우선, htm/zip 제외)
        let tu = ''
        for (const [k, v] of Object.entries(b.formats || {})) {
          if (typeof v !== 'string') continue
          if (/text\/plain/i.test(k) && !/\.zip$/i.test(v)) { tu = v; break }
        }
        if (!tu) continue
        const author = (b.authors?.[0]?.name || 'Unknown').replace(/,\s*/g, ' ').trim()
        out.push({ id: b.id, title: (b.title || '').slice(0, 200).trim(), author, textUrl: tu })
      }
      url = j.next
    } catch { break }
    await sleep(250)
  }
  return out.slice(OFFSET, OFFSET + TARGET)
}

async function clearCorpus() {
  for (const t of ['extraction_test_vocab', 'extraction_test_books']) {
    try { await fetch(SB + '/rest/v1/' + t + '?book_gid=gt.-2147483648', { method: 'DELETE', headers: { ...Hget, Prefer: 'return=minimal' } }) } catch {}
  }
}
async function upsertVocab(rows: any[], n = 6) { for (let i = 0; i < n; i++) { try { const r = await fetch(SB + '/rest/v1/extraction_test_vocab', { method: 'POST', headers: Hup, body: JSON.stringify(rows) }); if (r.ok) return true } catch {} await sleep(500 * (i + 1)) } return false }
async function upsertBook(row: any) { try { await fetch(SB + '/rest/v1/extraction_test_books', { method: 'POST', headers: Hup, body: JSON.stringify(row) }) } catch {} }

// ── main ──
if (process.env.CLEAR === '1') { await clearCorpus(); console.error('기존 코퍼스 삭제됨') }

// 이전 전 라운드 도서(중복 배제): prev_all.json 있으면 사용, 없으면 현재 test_books
const doneSlugs = new Set<string>()
try { const d = JSON.parse(fs.readFileSync('scratchpad-foreign/prev_all.json', 'utf8')); for (const x of d) doneSlugs.add((x.author + '|' + x.title).toLowerCase()) } catch {}
try { const r = await fetch(SB + '/rest/v1/extraction_test_books?select=author,title', { headers: Hget }); const d: any = await r.json(); if (Array.isArray(d)) for (const x of d) doneSlugs.add((x.author + '|' + x.title).toLowerCase()) } catch {}
console.error('중복배제 대상 도서:', doneSlugs.size)

const books = await gutList()
console.error('Gutenberg 소싱 후보:', books.length, '권 (OFFSET', OFFSET, ')')

function gidOf(id: number): number { return 1_000_000 + id }  // SE slug 해시와 충돌 없는 별도 대역

let ok = 0, fail = 0, dup = 0
for (const b of books) {
  const key = (b.author + '|' + b.title).toLowerCase()
  if (doneSlugs.has(key)) { dup++; continue }
  try {
    const res = await fetch(b.textUrl, { headers: UA })
    if (!res.ok) { fail++; continue }
    let text = stripGutenberg(await res.text())
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
    if (agg.size < 100) { fail++; continue }
    const gid = gidOf(b.id)
    const rows = [...agg.entries()].map(([lemma, v]) => ({ book_gid: gid, lemma, freq: v.freq, first_sentence: v.fs }))
    for (let i = 0; i < rows.length; i += 800) await upsertVocab(rows.slice(i, i + 800))
    await upsertBook({ book_gid: gid, title: b.title, author: b.author, download_count: 0, topic: 'gutenberg', char_len: charLen, distinct_lemmas: agg.size })
    doneSlugs.add(key)
    ok++
    if (ok % 10 === 0) console.error(`  진행 ${ok} — ${b.author}/${b.title} (${agg.size} lemmas)`)
    await sleep(150)
  } catch (e: any) { fail++; console.error('  ERR', b.id, e.message) }
}
console.error('완료 — 성공', ok, '실패', fail, '중복skip', dup)
