// scripts/csat/source-get/precheck-backfill.mjs
//
// **이미 창고에 들어온 분석 대기(queued) 글에 모음 단계 사전검증을 소급 적용한다** (2026-09-25).
//
// 왜: 사전검증(precheck.ts)은 새로 담는 글에만 걸린다. 그 전에 담긴 대기분 — 특히 wikinews
//   덤프 18,866편 — 은 그대로 두면 ④ 학년 분석(LLM 비용)을 거친 뒤에야 ② 에서 떨어진다.
//   제목 부적합 33.8%(실측)를 분석 전에 걸러 비용을 줄인다.
//
// 하는 일:
//   · 모든 대기 글에 `csat_fit.precheck` 를 **키 하나만 더해** 적는다(다른 키를 덮지 않는다 — AGENTS.md jsonb 규칙).
//   · 원천 정책이 'block' 인 단계에 걸린 글은 `status='archived'` + `status_message` 에 사유를 적는다.
//     **지우지 않는다** — 규칙이 틀렸으면 `--restore` 로 이 스크립트가 보관한 것만 queued 로 되돌린다.
//
// 재실행 안전: 같은 판본(v)의 precheck 가 이미 있는 행은 건너뛴다. `--commit` 없이는 쓰지 않는다.
//
// 사용:
//   pnpm dlx tsx scripts/csat/source-get/precheck-backfill.mjs [--source wikinews]            (dry-run · 사유별 수 · 표본)
//   pnpm dlx tsx scripts/csat/source-get/precheck-backfill.mjs [--source wikinews] --commit
//   pnpm dlx tsx scripts/csat/source-get/precheck-backfill.mjs --source wikinews --restore --commit   (되돌리기)

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const { createClient } = await import('@supabase/supabase-js')
const { precheckArticle, PRECHECK_VERSION } = await import('@vocaflow/library-pipeline')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const SOURCE = arg('source')
const COMMIT = process.argv.includes('--commit')
const RESTORE = process.argv.includes('--restore')
const MARK = 'precheck:' // status_message 머리 — 이 스크립트가 보관한 것만 --restore 로 되돌린다
const PAGE = 500

if (RESTORE) {
  let q = db.from('library_articles').select('id', { count: 'exact', head: true }).eq('status', 'archived').like('status_message', `${MARK}%`)
  if (SOURCE) q = q.eq('source', SOURCE)
  const { count, error } = await q
  if (error) throw new Error(`조회 실패 — ${error.message}`)
  console.log(`되돌릴 대상 ${count}편${SOURCE ? ` (${SOURCE})` : ''}`)
  if (COMMIT) {
    let u = db.from('library_articles').update({ status: 'queued', status_message: null }).eq('status', 'archived').like('status_message', `${MARK}%`)
    if (SOURCE) u = u.eq('source', SOURCE)
    const { error: e2 } = await u
    if (e2) throw new Error(`되돌리기 실패 — ${e2.message}`)
    console.log('queued 로 되돌렸다')
  } else console.log('※ dry-run — 실제로 되돌리려면 --commit')
  process.exit(0)
}

const tally = { seen: 0, already: 0, pass: 0, flag: 0, block: 0, failed: 0 }
const bySource = {}
const reasons = {}
const samples = {}
let lastId = null
for (;;) {
  let q = db.from('library_articles').select('id, source, title, content, feed_id, csat_fit').eq('status', 'queued').order('id').limit(PAGE)
  if (SOURCE) q = q.eq('source', SOURCE)
  if (lastId) q = q.gt('id', lastId)
  const { data, error } = await q
  if (error) throw new Error(`대기 글 조회 실패 — ${error.message}`)
  if (!data.length) break
  lastId = data.at(-1).id
  for (const row of data) {
    tally.seen++
    const fit = row.csat_fit && typeof row.csat_fit === 'object' ? row.csat_fit : {}
    if (fit.precheck?.v === PRECHECK_VERSION) { tally.already++; continue }
    const pre = precheckArticle({ source: row.source, title: row.title, content: row.content, feedId: row.feed_id })
    tally[pre.verdict]++
    const s = (bySource[row.source] ??= { pass: 0, flag: 0, block: 0 })
    s[pre.verdict]++
    if (pre.verdict === 'block') {
      for (const r of pre.reasons) {
        reasons[r] = (reasons[r] ?? 0) + 1
        const k = `${row.source} ${r}`
        if ((samples[k] ??= []).length < 3) samples[k].push(row.title)
      }
    }
    if (!COMMIT) continue
    // 기존 csat_fit 을 읽어 키 하나만 더한다 — 통째로 덮으면 rights 표지가 날아간다.
    const patch = { csat_fit: { ...fit, precheck: pre } }
    if (pre.verdict === 'block') {
      patch.status = 'archived'
      patch.status_message = `${MARK}${pre.reasons.filter((r) => pre.blockedBy.includes(r.split(':')[0])).join(',')}`
    }
    const { error: e2 } = await db.from('library_articles').update(patch).eq('id', row.id).eq('status', 'queued')
    if (e2) { tally.failed++; if (tally.failed <= 5) console.log(`  실패 ${row.id}: ${e2.message}`) }
  }
  process.stdout.write(`\r  ${tally.seen}편 읽음`)
}

console.log(`\n
${COMMIT ? '적용' : 'dry-run'} — 대기 글 ${tally.seen}편${SOURCE ? ` (${SOURCE})` : ''}
  이미 같은 판본 ${tally.already} · 통과 ${tally.pass} · 표시만 ${tally.flag} · **막음(보관) ${tally.block}** · 실패 ${tally.failed}
원천별 ${JSON.stringify(bySource)}
막은 사유 ${JSON.stringify(reasons)}`)
for (const [k, v] of Object.entries(samples)) console.log(`  ${k}: ${v.join(' | ')}`)
if (!COMMIT) console.log('\n※ dry-run 이다. 실제로 쓰려면 --commit (되돌리기: --restore --commit)')
