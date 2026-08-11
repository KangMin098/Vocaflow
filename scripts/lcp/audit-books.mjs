// scripts/lcp/audit-books.mjs
//
// 추출 품질 증분 감사 러너 — books_needing_audit → audit_book_extraction 반복.
//
// 왜 러너인가: 감사를 전수 SQL 한 방으로 돌리던 v_extraction_quality_audit 는
//   코퍼스가 300권 · lbv 154만 행이 되자 통째로 타임아웃했다. 특히 결함 04/90 은
//   미해결 단어마다 content_chunks 를 정규식(\m…\M)으로 스캔해서 곱셈으로 커진다.
//   도서 1권은 빠르므로 권당 계산 → 저장 → 합계 조회로 바꿨고(마이그레이션
//   incremental_audit_and_stats_maintenance), 이 스크립트가 그 반복을 담당한다.
//
// 멱등: audit_book_extraction 이 도서별로 DELETE 후 INSERT 한다. 재실행해도 중복이 없고,
//   books_needing_audit 은 "감사 없음 또는 도서가 그 뒤에 갱신됨"만 돌려주므로
//   중단 후 다시 실행하면 남은 것부터 이어간다.
//
// 실행: pnpm dlx tsx scripts/lcp/audit-books.mjs [--limit N] [--delay MS]

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
const LIMIT = parseInt(arg('limit', '1000'), 10)
const DELAY_MS = parseInt(arg('delay', '300'), 10)

const { getServiceClient } = await import('@vocaflow/library-pipeline')
const sb = getServiceClient()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const { data: targets, error } = await sb.rpc('books_needing_audit', { p_limit: LIMIT })
if (error) {
  console.error(`[audit] 대상 조회 실패: ${error.message}`)
  process.exit(1)
}

const list = targets ?? []
console.error(`[audit] 대상 ${list.length}권 (delay=${DELAY_MS}ms)`)

let ok = 0
let fail = 0
const failures = []

for (const [idx, b] of list.entries()) {
  const label = `${idx + 1}/${list.length} ${(b.title ?? '').slice(0, 45)}`
  try {
    const { error: e } = await sb.rpc('audit_book_extraction', { p_book_id: b.library_book_id })
    if (e) throw new Error(e.message)
    ok++
    if ((idx + 1) % 20 === 0 || idx === list.length - 1) console.error(`  ✓ ${label}`)
  } catch (e) {
    fail++
    const msg = e instanceof Error ? e.message : String(e)
    failures.push(`${b.title} :: ${msg}`)
    console.error(`  ✗ ${label} — ${msg.slice(0, 110)}`)
  }
  if (idx < list.length - 1) await sleep(DELAY_MS)
}

console.error(`\n[audit] 완료 — 성공 ${ok} · 실패 ${fail}`)
if (failures.length) console.error(failures.slice(0, 15).join('\n'))
