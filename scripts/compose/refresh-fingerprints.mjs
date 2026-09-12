// scripts/compose/refresh-fingerprints.mjs
//
// ACP §20 — **저장된 지문을 새 기준으로 다시 뜬다.**
//
// 왜 필요한가 (2026-08-19):
//   소스 지문을 **원본 HTML** 에서 뜨고 있었다. 메뉴·스크립트·다른 기사 제목이 7어절 조각의
//   대부분을 차지해, 본문이 통째로 같아도 겹침이 1%대로 희석된다(같은 쌍 0.7% vs 31.3%).
//   그래서 I12 의 전재 접기(`collapseSyndication`)가 **장치는 있는데 작동하지 않았다.**
//   기준을 추출 본문으로 고쳤지만, **이미 저장된 지문은 그대로 낡아 있다** — 그 상태로
//   게이트를 다시 돌리면 낡은 값으로 판정하고, 손으로 바로잡아 둔 FAIL 이 조용히 PASS 로 덮인다.
//
// 이 스크립트는 소스를 다시 받아 추출 본문으로 지문을 다시 뜬다. 본문은 저장하지 않는다.
//
// ⚠️ 발행사 서버에 실제 요청이 나간다(소스마다 robots + 기사 1회). 자주 돌리지 않는다.
// ⚠️ 지문이 바뀌면 그 묶음의 게이트 판정은 **낡은 것이 된다** — 다시 돌려야 한다.
//    스크립트가 바뀐 묶음을 끝에 알려 준다.
//
// 재실행 안전: 같은 값을 다시 써도 결과가 같다(멱등). 다만 요청이 또 나간다.
//
// 실행:
//   pnpm dlx tsx scripts/compose/refresh-fingerprints.mjs            # 무엇이 바뀌는지만 본다
//   pnpm dlx tsx scripts/compose/refresh-fingerprints.mjs --commit   # 저장한다
//   … [--batch <id>] 로 한 묶음만.

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const commit = process.argv.includes('--commit')
const bi = process.argv.indexOf('--batch')
const only = bi >= 0 ? process.argv[bi + 1] : null

const { createClient } = await import('@supabase/supabase-js')
const {
  COMPOSE_USER_AGENT,
  CrawlGate,
  buildFingerprint,
  collapseSyndication,
  extractArticle,
  parseRobots,
} = await import('@vocaflow/library-pipeline')

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const get = async (url) => {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), 20_000)
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': COMPOSE_USER_AGENT },
      signal: c.signal,
      redirect: 'follow',
    })
    return { ok: r.ok, status: r.status, text: r.ok ? await r.text() : '' }
  } catch {
    return { ok: false, status: 0, text: '' }
  } finally {
    clearTimeout(t)
  }
}

let q = db.from('article_compose_sources').select('id, batch_id, publisher, url, fingerprint')
if (only) q = q.eq('batch_id', only)
const { data: rows, error } = await q.order('batch_id')
if (error) throw new Error('소스 조회 실패: ' + error.message)

const { data: batches } = await db.from('article_compose_batches').select('id, topic')
const topicOf = new Map((batches ?? []).map((b) => [b.id, b.topic]))

// robots 는 호스트마다 한 번만 묻는다 — 같은 발행사 소스가 여럿이면 중복 요청이 된다.
const gate = new CrawlGate()
const primed = new Set()
const refreshed = []
const failures = []

for (const r of rows ?? []) {
  const host = new URL(r.url).host
  if (!primed.has(host)) {
    primed.add(host)
    const rb = await get(`https://${host}/robots.txt`)
    gate.setRobots(host, rb.status === 404 ? parseRobots('') : rb.ok ? parseRobots(rb.text) : null)
  }
  const decision = gate.check(r.url, Date.now())
  if (!decision.allowed) {
    failures.push(`${r.publisher}: ${decision.reason}`)
    continue
  }
  if (decision.waitMs > 0) await new Promise((res) => setTimeout(res, decision.waitMs))
  gate.markFetched(r.url, Date.now())

  const res = await get(r.url)
  if (!res.ok) {
    failures.push(`${r.publisher}: 응답 ${res.status} — ${r.url}`)
    continue
  }
  // 본문은 여기서만 산다. 남는 것은 지문뿐이다.
  const fresh = buildFingerprint(extractArticle(res.text).text)
  refreshed.push({ ...r, fresh })
}

// 묶음별로 옛 값과 새 값이 계통 수를 어떻게 바꾸는지 보여 준다 — 숫자만 갱신하면
//   무엇이 달라졌는지 아무도 모른다.
const byBatch = new Map()
for (const r of refreshed) {
  if (!byBatch.has(r.batch_id)) byBatch.set(r.batch_id, [])
  byBatch.get(r.batch_id).push(r)
}

const toRecord = (r, which) => ({
  id: r.id,
  publisher: r.publisher,
  url: r.url,
  published_at: '',
  fingerprint: which === 'old' ? r.fingerprint : r.fresh,
})

const changedBatches = []
for (const [batchId, srcs] of byBatch) {
  const before = collapseSyndication(srcs.map((r) => toRecord(r, 'old'))).length
  const after = collapseSyndication(srcs.map((r) => toRecord(r, 'new'))).length
  const mark = before === after ? '·' : '✗'
  console.log(
    `${mark} ${(topicOf.get(batchId) ?? batchId).slice(0, 56)}\n    소스 ${srcs.length} · 독립 계통 ${before} → ${after}`,
  )
  if (before !== after) changedBatches.push({ batchId, before, after })
}

for (const f of failures) console.log(`  ⚠ ${f}`)

if (!commit) {
  console.log(`\n갱신 대상 ${refreshed.length} / 조회 ${rows?.length ?? 0}. --commit 을 붙이면 저장한다.`)
  process.exit(0)
}

let saved = 0
for (const r of refreshed) {
  const { error: uErr } = await db
    .from('article_compose_sources')
    .update({ fingerprint: r.fresh })
    .eq('id', r.id)
  if (uErr) failures.push(`${r.publisher}: 저장 실패 ${uErr.message}`)
  else saved++
}

console.log(`\n갱신 ${saved} / ${refreshed.length}`)
if (changedBatches.length) {
  console.log('\n계통 수가 바뀐 묶음 — 게이트를 다시 돌려야 한다:')
  for (const c of changedBatches) {
    console.log(`  · ${topicOf.get(c.batchId) ?? c.batchId} (${c.before} → ${c.after})`)
    console.log(`    pnpm dlx tsx scripts/compose/drain-gates.mjs --batch ${c.batchId} --commit`)
  }
}
