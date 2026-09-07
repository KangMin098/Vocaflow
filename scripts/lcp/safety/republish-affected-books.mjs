// scripts/lcp/safety/republish-affected-books.mjs
//
// 멸칭 판정 반영 뒤, **이미 발행된 단어장에서 실제로 빼는** 단계 (3단 드레인의 마무리).
//
// 왜 재발행인가: 손으로 shared_words 행을 지우면 다음 재발행에서 그대로 다시 들어온다 —
//   발행 세트는 select_book_chapter_vocab 의 스냅샷이기 때문이다. 사전을 고쳤으니
//   같은 RPC 를 다시 돌려 스냅샷을 새로 뜨는 것이 유일하게 되돌아오지 않는 방법이다.
//   republish_book_word_sets(book_id, NULL) 이 그 일을 한다(챕터별 DELETE→INSERT, cap 무제한).
//
// 대상은 "판정된 멸칭이 아직 남아 있는 발행 도서" 로 좁힌다 — 전권 재발행은
//   멀쩡한 세트의 republished_at 까지 흔들어 드리프트 감사를 어지럽힌다.
//
// 재실행 안전: 남은 멸칭을 매번 다시 조회해 대상을 정한다. 두 번째 실행은 대상 0 이어야 한다.
// 쓰기는 --commit 일 때만.
//
// 사용: node scripts/lcp/safety/republish-affected-books.mjs [--commit]

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { makeClient } from '../../dict-common.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const COMMIT = process.argv.includes('--commit')
const db = makeClient()

const { slurs } = JSON.parse(readFileSync(resolve(__dirname, 'verdicts.json'), 'utf8'))
const forms = slurs.map((s) => s.surface)

/**
 * 판정된 멸칭이 아직 들어 있는 발행 세트 → 도서 id 로 묶는다.
 *
 * ⚠️ 표면형(word)만 보면 놓친다. lemma 자체가 멸칭인 경우(gook → gooks · kaffir → kaffirs)
 *    표면형은 판정 목록에 없고 lemma 만 걸린다. 추출 RPC 도 같은 이유로 lemma 로 내려가
 *    걸러 내므로, 재발행 대상 판정도 **양쪽을 다 봐야** 대상이 빠지지 않는다.
 */
async function affectedBooks() {
  const setIds = new Set()
  for (const column of ['word', 'lemma']) {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db
        .from('shared_words')
        .select('set_id')
        .in(column, forms)
        .range(from, from + 999)
      if (error) throw new Error(`단어 조회 실패(${column}): ${error.message}`)
      for (const r of data) setIds.add(r.set_id)
      if (data.length < 1000) break
    }
  }
  if (setIds.size === 0) return []

  const books = new Map()
  const ids = [...setIds]
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await db
      .from('shared_word_sets')
      .select('id, title, is_published, curation_query')
      .in('id', ids.slice(i, i + 100))
      .eq('is_published', true)
      .eq('category', 'library_book')
    if (error) throw new Error(`세트 조회 실패: ${error.message}`)
    for (const r of data) {
      const bookId = r.curation_query?.book_id
      if (!bookId) continue
      books.set(bookId, (books.get(bookId) ?? 0) + 1)
    }
  }
  return [...books.entries()].map(([id, sets]) => ({ id, sets }))
}

const targets = await affectedBooks()
console.log(`판정 멸칭 ${forms.length}형 · 남아 있는 발행 도서 ${targets.length}권${COMMIT ? ' [COMMIT]' : ' [dry-run]'}`)
if (targets.length === 0) {
  console.log('대상 없음 — 발행 단어장에 판정된 멸칭이 남아 있지 않다.')
  process.exit(0)
}

let done = 0
let failed = 0
for (const [i, t] of targets.entries()) {
  const { data: title } = await db.from('library_books').select('title').eq('id', t.id).maybeSingle()
  const tag = `[${i + 1}/${targets.length}] ${title?.title ?? t.id} (해당 세트 ${t.sets})`
  if (!COMMIT) { console.log(`  · ${tag}`); continue }
  const { data, error } = await db.rpc('republish_book_word_sets', { p_book_id: t.id, p_cap: null })
  if (error) {
    failed++
    console.log(`  ! ${tag} — 재발행 실패: ${error.message}`)
    continue
  }
  done++
  console.log(`  ✓ ${tag} — 세트 ${data}개 재발행`)
}

console.log(`\n재발행 ${done} · 실패 ${failed}`)
if (!COMMIT) console.log('dry-run — 아무것도 바꾸지 않았다. --commit 으로 실행하면 반영된다.')
