// scripts/dict/build-test-corpus-seedlist.mts
// 단어추출 테스트 코퍼스 — 큐레이션 "소스 GET" 목록(library_seed_catalog, standard_ebooks) 기반.
// SE 최신 774 풀 소진 후, 시드 카탈로그의 미테스트 SE 도서로 일반화 테스트 지속.
// scratchpad-foreign/seed_slugs.json (author/title 슬러그 배열) 을 읽어 SE single-page 추출 →
// 프로덕션과 동일한 winkNLP 추출(@vocaflow/wlp + extract-lemmas 필터) → extraction_test_vocab 적재.
// 실행: LIMIT=200 CLEAR=1 node_modules/.bin/tsx scripts/dict/build-test-corpus-seedlist.mts
import fs from 'node:fs'
import { processText } from '@vocaflow/wlp'

const env = fs.readFileSync('apps/web/.env.local', 'utf8')
for (const l of env.split('\n')) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').replace(/\r/g, '') }
const SB = process.env.NEXT_PUBLIC_SUPABASE_URL!, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY!
const Hget = { apikey: SVC, Authorization: 'Bearer ' + SVC }
const Hup = { ...Hget, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const UA = { 'User-Agent': 'Mozilla/5.0 (Vocaflow extraction-test corpus builder)' }

const LIMIT = parseInt(process.env.LIMIT || '200')
const MAX_CHARS = 900_000

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
function htmlToText(html: string): string {
  let s = html.replace(/<head[\s\S]*?<\/head>/i, '')
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
async function clearCorpus() {
  for (const t of ['extraction_test_vocab', 'extraction_test_books']) {
    try { await fetch(SB + '/rest/v1/' + t + '?book_gid=gt.-2147483648', { method: 'DELETE', headers: { ...Hget, Prefer: 'return=minimal' } }) } catch {}
  }
}
async function upsertVocab(rows: any[], n = 6) { for (let i = 0; i < n; i++) { try { const r = await fetch(SB + '/rest/v1/extraction_test_vocab', { method: 'POST', headers: Hup, body: JSON.stringify(rows) }); if (r.ok) return true } catch {} await sleep(500 * (i + 1)) } return false }
async function upsertBook(row: any) { try { await fetch(SB + '/rest/v1/extraction_test_books', { method: 'POST', headers: Hup, body: JSON.stringify(row) }) } catch {} }
function slugGid(slug: string): number { let h = 0; for (let i = 0; i < slug.length; i++) { h = (h * 31 + slug.charCodeAt(i)) | 0 } return Math.abs(h) }

// ── main ──
if (process.env.CLEAR === '1') { await clearCorpus(); console.error('기존 코퍼스 삭제됨') }
const slugs: string[] = JSON.parse(fs.readFileSync('scratchpad-foreign/seed_slugs.json', 'utf8'))
console.error('시드 슬러그:', slugs.length, '권 (목표', LIMIT, ')')

let ok = 0, fail = 0
for (const slug of slugs) {
  if (ok >= LIMIT) break
  const [author, title] = slug.split('/')
  try {
    const res = await fetch(`https://standardebooks.org/ebooks/${slug}/text/single-page`, { headers: UA })
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
    if (agg.size < 100) { fail++; continue }
    const gid = slugGid(slug)
    const rows = [...agg.entries()].map(([lemma, v]) => ({ book_gid: gid, lemma, freq: v.freq, first_sentence: v.fs }))
    for (let i = 0; i < rows.length; i += 800) await upsertVocab(rows.slice(i, i + 800))
    await upsertBook({ book_gid: gid, title, author, download_count: 0, topic: 'seed-catalog-se', char_len: charLen, distinct_lemmas: agg.size })
    ok++
    if (ok % 10 === 0) console.error(`  진행 ${ok} — ${author}/${title} (${agg.size} lemmas)`)
    await sleep(150)
  } catch (e: any) { fail++; console.error('  ERR', slug, e.message) }
}
console.error('완료 — 성공', ok, '실패', fail)
