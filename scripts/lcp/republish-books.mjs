// scripts/lcp/republish-books.mjs
//
// 발행된 도서 세트를 재발행 — 발행 함수가 새로 싣는 필드를 기존 세트에 채운다.
//
// 왜: publish/republish 의 INSERT 컬럼 목록에 part_of_speech·example_en·ipa 가
//   빠져 있어서, 발행 세트 21,292단어의 품사 0% · 예문 0% · IPA 0% 였다
//   (사전에는 pos 100% · example 92.2% · ipa 80.5% 가 있는데 버리고 있었다).
//   함수를 고쳐도 **기존 행은 그대로**라 재발행이 필요하다.
//
// 부하 주의: republish 는 도서당 select_book_chapter_vocab 를 돌린다(무겁다).
//   오늘 NANO 에서 감사·통계 유지보수를 몰아쳐 DB 를 Unhealthy 로 만든 전례가 있으므로
//   기본 delay 를 넉넉히 둔다. MICRO 로 올린 뒤에도 한 번에 몰지 않는다.
//
// 멱등: republish 는 대상 세트를 DELETE 후 재INSERT 한다. 재실행해도 결과가 같다.
//   shared_words.id 는 바뀌지만 구독은 set 단위(vocabularies.shared_set_id)라 영향 없음.
//
// 실행: pnpm dlx tsx scripts/lcp/republish-books.mjs [--limit N] [--delay MS]

import fs from 'node:fs'
import path from 'node:path'

const envPath = path.resolve(process.cwd(), 'apps/web/.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').replace(/\r/g, '')
  }
}

const argv = process.argv.slice(2)
const arg = (name, dflt) => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt
}
const LIMIT = parseInt(arg('limit', '100'), 10)
const DELAY_MS = parseInt(arg('delay', '4000'), 10)

const { getServiceClient } = await import('@vocaflow/library-pipeline')
const sb = getServiceClient()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// 발행 세트가 있는 도서 중 품사가 비어 있는 것 (= 아직 재발행 안 됨)
const { data: sets, error } = await sb
  .from('shared_word_sets')
  .select('curation_query')
  .eq('category', 'library_book')
  .eq('is_published', true)
  .limit(5000)
if (error) {
  console.error(`[republish] 세트 조회 실패: ${error.message}`)
  process.exit(1)
}

const bookIds = [...new Set((sets ?? []).map((s) => s.curation_query?.book_id).filter(Boolean))].slice(0, LIMIT)
console.error(`[republish] 대상 ${bookIds.length}권 (delay=${DELAY_MS}ms)`)

let ok = 0
let fail = 0
const failures = []

for (const [idx, bid] of bookIds.entries()) {
  const { data: bk } = await sb.from('library_books').select('title').eq('id', bid).maybeSingle()
  const label = `${idx + 1}/${bookIds.length} ${(bk?.title ?? bid).slice(0, 42)}`
  try {
    const { data, error: e } = await sb.rpc('republish_book_word_sets', { p_book_id: bid })
    if (e) throw new Error(e.message)
    ok++
    console.error(`  ✓ ${label} — ${data}세트`)
  } catch (e) {
    fail++
    const msg = e instanceof Error ? e.message : String(e)
    failures.push(`${bk?.title ?? bid} :: ${msg}`)
    console.error(`  ✗ ${label} — ${msg.slice(0, 110)}`)
  }
  if (idx < bookIds.length - 1) await sleep(DELAY_MS)
}

console.error(`\n[republish] 완료 — 성공 ${ok} · 실패 ${fail}`)
if (failures.length) console.error(failures.slice(0, 15).join('\n'))
