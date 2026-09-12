// scripts/lcp/publish-ready-books.mjs
//
// 발행 적체 해소 — status='ready' 도서를 게이트 재확인 후 한 권씩 'published' 로 올린다.
//
// 왜 한 권씩인가: status 변경이 AFTER UPDATE 트리거(trg_lb_publish_word_sets)를 깨우고,
//   그 트리거가 publish_book_word_sets() 로 **챕터마다 단어장을 만들어 발행**한다.
//   한 문장으로 303권을 갱신하면 트리거가 그 트랜잭션 안에서 전부 돌아 타임아웃으로 통째 롤백된다.
//   권별로 끊으면 느린 한 권(Clarissa 528챕터)이 나머지를 막지 않는다.
//
// 게이트: content_gate_publishable('book', id) 를 **발행 직전에 다시** 부른다.
//   사전에 한 번 쟀다고 넘어가면, 그 사이 다른 세션이 사전을 고쳐 놓은 경우를 못 본다.
//   copyright_safe_in_kr 도 함께 본다 — admin_force_publish_book 이 거는 것과 같은 조건인데,
//   이 스크립트는 service_role 로 직접 UPDATE 하므로(auth.uid() 가 없어 그 RPC 를 못 쓴다)
//   RPC 가 해 주던 검사를 여기서 대신 한다.
//
// 재실행 안전: status='ready' 만 조회하고 UPDATE 에도 .eq('status','ready') 를 걸어
//   이미 발행된 행을 건드리지 않는다. 몇 번 돌려도 결과가 같다.
// 되돌리기: 권별 admin_revert_published_book(book_id).
//
// 사용:
//   node scripts/lcp/publish-ready-books.mjs               # dry-run (게이트만 재확인)
//   node scripts/lcp/publish-ready-books.mjs --limit 20 --commit
//   node scripts/lcp/publish-ready-books.mjs --commit

import { makeClient, arg } from '../dict-common.mjs'

const argv = process.argv.slice(2)
const COMMIT = argv.includes('--commit')
const LIMIT = Number(arg(argv, '--limit', '0')) || 0

const db = makeClient()

async function fetchReady() {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from('library_books')
      .select('id, title, status, copyright_safe_in_kr, chapter_count')
      .eq('status', 'ready')
      .order('chapter_count', { ascending: true, nullsFirst: true }) // 가벼운 것부터 — 느린 한 권이 앞을 막지 않게
      .range(from, from + 999)
    if (error) throw new Error(`조회 실패: ${error.message}`)
    rows.push(...data)
    if (data.length < 1000) break
  }
  return rows
}

async function main() {
  const all = await fetchReady()
  const targets = LIMIT > 0 ? all.slice(0, LIMIT) : all
  console.log(`ready 도서 ${all.length} · 이번 실행 대상 ${targets.length}${COMMIT ? ' [COMMIT]' : ' [dry-run]'}\n`)

  let published = 0
  let blockedGate = 0
  let blockedLicense = 0
  let failed = 0

  for (const [i, b] of targets.entries()) {
    const tag = `[${i + 1}/${targets.length}] ${b.title} (ch.${b.chapter_count ?? '?'})`

    if (b.copyright_safe_in_kr !== true) {
      blockedLicense++
      console.log(`  ⊘ ${tag} — copyright_safe_in_kr 아님`)
      continue
    }

    const { data: ok, error: gErr } = await db.rpc('content_gate_publishable', { p_scope: 'book', p_id: b.id })
    if (gErr) {
      failed++
      console.log(`  ! ${tag} — 게이트 호출 실패: ${gErr.message}`)
      continue
    }
    if (ok !== true) {
      blockedGate++
      console.log(`  ✗ ${tag} — 게이트 FAIL`)
      continue
    }

    if (!COMMIT) {
      published++
      continue
    }

    const { data, error } = await db
      .from('library_books')
      .update({ status: 'published', published_at: new Date().toISOString() })
      .eq('id', b.id)
      .eq('status', 'ready') // 그 사이 다른 세션이 바꿨으면 건드리지 않는다
      .select('id')
    if (error) {
      failed++
      console.log(`  ! ${tag} — 발행 실패: ${error.message}`)
      continue
    }
    if (!data || data.length === 0) {
      console.log(`  · ${tag} — 이미 ready 가 아님(건너뜀)`)
      continue
    }
    published++
    if (published % 20 === 0) console.log(`  … ${published}권 발행`)
  }

  console.log(`\n발행 ${published} · 게이트 차단 ${blockedGate} · 라이선스 차단 ${blockedLicense} · 실패 ${failed}`)
  if (!COMMIT) console.log('dry-run — 상태를 바꾸지 않았다. --commit 으로 실행하면 반영된다.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
