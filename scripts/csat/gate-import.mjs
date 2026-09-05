// scripts/csat/gate-import.mjs
//
// **게이트 판정을 조각에 적용한다. 기본은 예행(dry) — `--commit` 이 있어야 쓴다.**
//
// ── 무엇을 쓰는가 ───────────────────────────────────────────────────
// ① `csat_fit.gate` (jsonb 키 하나 추가 — 마이그레이션 불필요)
//    { v, publishable, verdict, genre, why, codes[], by, at }
// ② 게시 불가면 `status='archived'` + `status_message`
//
// ⚠️ **지우지 않는다.** `archived` 는 이미 있는 상태값이고 파이프라인이 이미 거른다.
//   되돌릴 수 있게 남기는 쪽을 골랐다 — 판정이 틀렸을 때 원문을 다시 못 구하기 때문이다.
//   진짜 DELETE 는 판정이 굳은 뒤 별도 결정으로 한다.
//
// ⚠️ **csat_fit 을 통째로 덮으면 안 된다.** 그 안에 대역 채점 결과(pass·topic)가 있고
//   덮으면 균형 사정권 계산이 통째로 날아간다. 읽어서 키 하나만 더한다.
//
// 재실행 안전: 같은 판정을 다시 써도 결과가 같다. 이미 같은 값이면 건너뛴다.
//
// 실행: node scripts/csat/gate-import.mjs [--commit]

import fs from 'node:fs'
import path from 'node:path'

import { hardReject } from './gate-rules.mjs'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const COMMIT = process.argv.includes('--commit')
const DRAIN = path.resolve('scripts/csat/gate-drain')

// ── 책 판정 읽기 ────────────────────────────────────────────────────
const book = new Map()
let files = 0
for (const f of fs.readdirSync(DRAIN).filter((f) => f.endsWith('.out.json')).sort()) {
  const arr = JSON.parse(fs.readFileSync(path.join(DRAIN, f), 'utf8'))
  files += 1
  for (const it of arr) {
    if (!it.verdict) continue
    book.set(it.book, { verdict: it.verdict, genre: it.genre ?? '', why: it.why ?? '' })
  }
}
console.log('게이트 적용' + (COMMIT ? ' — **쓴다**' : ' — 예행(쓰지 않는다)'))
console.log('='.repeat(78))
console.log(`  판정 파일 ${files}개 · 책 **${book.size}권**\n`)
if (!book.size) {
  console.error('  ❌ 판정이 없다. 먼저 gate-book-export.mjs 로 뽑고 채울 것.')
  process.exit(1)
}

const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// ⚠️ 첫 실행이 12,300편에서 **오류 한 줄 없이** 죽었다(2026-09-05). 같은 일이 이 저장소의
//   PLOS 수확에서도 있었다. 원인을 못 잡은 채 긴 루프를 다시 돌리면 또 같은 자리에서 잃는다.
//   재실행 안전은 이미 있으니, 여기서는 일시적 실패를 삼켜 루프가 끊기지 않게만 한다.
// 두 번째 실행도 18,000편에서 말없이 끝났다. 재시도로 안 잡혔으니 던져진 오류가 아니다.
// 무엇이 끝냈는지 로그에 남긴다 — 안 남기면 세 번째도 같은 자리에서 잃는다.
for (const sig of ['SIGTERM', 'SIGINT', 'SIGHUP']) {
  process.on(sig, () => {
    console.error(`\n  ⛔ ${sig} 로 종료됨 — 재실행하면 이어서 간다`)
    process.exit(1)
  })
}
process.on('unhandledRejection', (e) => {
  console.error(`\n  ⛔ 처리 안 된 거부: ${String(e?.message ?? e).slice(0, 120)}`)
  process.exit(1)
})
process.on('exit', (code) => console.error(`\n  [종료 코드 ${code}]`))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function retry(fn, what, attempt = 0) {
  try {
    const r = await fn()
    if (r?.error) throw new Error(r.error.message)
    return r
  } catch (e) {
    if (attempt >= 4) throw new Error(`${what} — ${String(e.message).slice(0, 80)}`)
    await sleep(1500 * 2 ** attempt)
    return retry(fn, what, attempt + 1)
  }
}

/**
 * **서사를 게시 불가로 두는 것은 수능 쪽 사정이다 — 교재 쪽은 반대다.**
 *
 * 이 파일은 `publishable = verdict === 'use'` 로 판정해 왔다. 그런데 설계 문서
 * (`docs/CSAT_SOURCE_GATE.md`)는 `narrative` 를 두고 **"버리지 않는다 — 심경·분위기
 * (R-MOOD)와 내용일치(R-FACT)가 요구하는 것이 정확히 이것이다"** 라고 적는다.
 * 문서와 코드가 어긋나 있었고 코드 쪽이 이겼다(실측 2026-09-05: narrative 3,698편 전부 archived).
 *
 * 그중 **1,241편이 초·중 교재용 발췌**(`feed_id='kid-excerpt'`)다. 초·중 독해 교재는
 * 이야기 지문을 싣는다 — 이 저장소가 "초·중 창의 narrative 재고가 **0편**" 이라
 * StoryWeaver 를 새로 배선한 것이 그 기록이다. 수능 지문이 설명·논증문이라 서사를 빼는 것과,
 * 교재가 이야기를 필요로 하는 것은 **다른 용도의 다른 판단**이다.
 * 한 자로 두 용도를 재면 한쪽이 반드시 틀린다.
 *
 * `reject` 는 어느 쪽에서도 게시 불가다(교리·차별·폐기된 사실) — 그건 용도와 무관하다.
 */
const NARRATIVE_OK_FEEDS = new Set(['kid-excerpt'])

const tally = { total: 0, judged: 0, unjudged: 0, pub: 0, quarantine: 0, skipped: 0, wrote: 0, restored: 0 }
const byVerdict = {}
const byCode = {}
const NOW = new Date().toISOString()

let cursor = '00000000-0000-0000-0000-000000000000'
for (;;) {
  const { data } = await retry(
    () =>
      db
        .from('library_articles')
        .select('id,title,content,status,status_message,feed_id,csat_fit')
        .eq('source', 'gutenberg')
        .gt('id', cursor)
        .order('id')
        .limit(300),
    '조회',
  )
  if (!data?.length) break
  cursor = data[data.length - 1].id

  for (const row of data) {
    tally.total += 1
    const key = String(row.title ?? '').split(' — ')[0].trim() || '(무제)'
    const v = book.get(key)
    if (!v) {
      tally.unjudged += 1
      continue
    }
    tally.judged += 1
    byVerdict[v.verdict] = (byVerdict[v.verdict] ?? 0) + 1

    const codes = hardReject(row.content)
    for (const c of codes) byCode[c] = (byCode[c] ?? 0) + 1
    const narrativeOk = v.verdict === 'narrative' && NARRATIVE_OK_FEEDS.has(row.feed_id)
    const publishable = (v.verdict === 'use' || narrativeOk) && codes.length === 0
    // ⚠️ **예행에서도 센다.** `if (!COMMIT) continue` 뒤에서 세면 예행이 0 을 보고하고,
    //   그러면 "무엇이 바뀌는지" 를 모른 채 --commit 을 누르게 된다.
    const willRestore =
      publishable &&
      row.status === 'archived' &&
      String(row.status_message ?? '').startsWith('게시 게이트:')
    if (willRestore) tally.restored += 1
    if (publishable) tally.pub += 1
    else tally.quarantine += 1

    const gate = {
      v: 1,
      publishable,
      verdict: v.verdict,
      genre: v.genre,
      why: v.why,
      codes,
      by: 'book-llm+rule',
      at: NOW,
    }
    const prev = row.csat_fit?.gate
    // 재실행 안전 — 판정이 그대로면 쓰지 않는다(`at` 은 비교에서 뺀다).
    const same =
      prev &&
      prev.publishable === gate.publishable &&
      prev.verdict === gate.verdict &&
      prev.genre === gate.genre &&
      JSON.stringify(prev.codes ?? []) === JSON.stringify(codes)
    if (same) {
      tally.skipped += 1
      continue
    }
    if (!COMMIT) continue

    // ⚠️ 기존 csat_fit 을 읽어 키 하나만 더한다 — 통째로 덮으면 pass·topic 이 날아간다.
    const patch = { csat_fit: { ...(row.csat_fit ?? {}), gate } }
    if (!publishable && row.status !== 'archived') {
      patch.status = 'archived'
      patch.status_message = `게시 게이트: ${v.verdict}${v.genre ? '/' + v.genre : ''}${
        codes.length ? ' · ' + codes.join(',') : ''
      }`
    }
    // **되돌릴 수 있어야 재실행 안전이다.** 판정이 바뀌어 게시 가능해졌는데 그대로
    //   archived 로 두면 이 스크립트는 한 방향으로만 움직이는 자가 된다.
    //   ⚠️ **이 게이트가 내린 것만** 되돌린다 — 다른 이유로 archived 된 글은 건드리지 않는다.
    if (willRestore) {
      patch.status = 'queued'
      patch.status_message = null
    }
    await retry(() => db.from('library_articles').update(patch).eq('id', row.id), `쓰기 ${row.id}`)
    tally.wrote += 1
  }
  process.stdout.write(`\r  훑음 ${tally.total.toLocaleString()}편 · 쓴 것 ${tally.wrote.toLocaleString()}`)
  if (data.length < 300) break
}

if (tally.restored) {
  console.log(`\n  되돌림 ${tally.restored.toLocaleString()}편 — 판정이 바뀌어 게시 가능해진 것`)
}
console.log(`\n\n  ${'판정'.padEnd(12)}${'조각'.padStart(9)}`)
console.log('  ' + '-'.repeat(40))
for (const [k, n] of Object.entries(byVerdict).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(12)}${n.toLocaleString().padStart(9)}`)
}
console.log('  ' + '-'.repeat(40))
console.log(`\n  기계 규칙 적중:`)
for (const [k, n] of Object.entries(byCode).sort((a, b) => b[1] - a[1])) {
  console.log(`    ${k.padEnd(16)}${n.toLocaleString().padStart(8)}`)
}
console.log(
  `\n  훑음 ${tally.total.toLocaleString()} · 판정 있음 ${tally.judged.toLocaleString()}` +
    ` · 판정 없음 ${tally.unjudged.toLocaleString()}\n` +
    `  **게시 가능 ${tally.pub.toLocaleString()} · 격리 ${tally.quarantine.toLocaleString()}**` +
    ` · 이미 같음 ${tally.skipped.toLocaleString()} · 쓴 것 ${tally.wrote.toLocaleString()}`,
)
if (!COMMIT) console.log(`\n  예행이었다. 실제로 쓰려면 --commit`)
