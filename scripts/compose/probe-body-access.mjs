// scripts/compose/probe-body-access.mjs
//
// ACP §20 — **본문 접근 가능 여부 실측.**
//
// 왜: 발견 단계는 제목만 보고 "독립 2계통" 을 판정한다. 그런데 그중 한 소스의 **본문을
// 못 읽으면** 취재 단계에서 사실 원장을 채울 수 없어 묶음이 통째로 무너진다.
// 실제로 Solar eclipse 사건이 dw+npr 2계통으로 올라왔는데 NPR 은 45초 타임아웃 재시도에도
// 본문이 안 열려, BBC 를 급히 찾아 대체해야 했다(2026-08-19).
//
// 이 스크립트는 소스마다 실제 기사 주소를 열어 본문 추출까지 해 보고 결과를 낸다.
// 결과는 `FACT_SOURCES[key].bodyAccess` 에 손으로 기록한다 — `termsReviewed` 와 같은
// 성격이다(사람이 확인한 사실). 이 스크립트를 다시 돌리면 기록이 낡았는지 알 수 있다.
//
// ⚠️ 본문은 읽고 즉시 버린다. 저장하지 않는다.
//
// 실행: pnpm dlx tsx scripts/compose/probe-body-access.mjs [--per 2]

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const pi = process.argv.indexOf('--per')
const PER = pi >= 0 ? Number(process.argv[pi + 1]) : 2

const { createClient } = await import('@supabase/supabase-js')
const lib = await import('@vocaflow/library-pipeline')
const { extractArticle, parseRobots, isPathAllowed, COMPOSE_USER_AGENT, FACT_SOURCES } = lib

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

/** 본문으로 인정할 최소 어수 — 이보다 짧으면 추출 실패로 본다. */
const MIN_WORDS = 120

const get = async (url, ms = 30000) => {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), ms)
  try {
    const r = await fetch(url, { headers: { 'User-Agent': COMPOSE_USER_AGENT }, signal: c.signal, redirect: 'follow' })
    return { ok: r.ok, status: r.status, text: r.ok ? await r.text() : '' }
  } catch (e) {
    return { ok: false, status: 0, text: '', err: String(e.name || e) }
  } finally {
    clearTimeout(t)
  }
}

const { data: cands } = await db
  .from('article_compose_candidates')
  .select('source_key,url')
  .order('published_at', { ascending: false })
  .limit(900)

const bySrc = new Map()
for (const c of cands ?? []) {
  const a = bySrc.get(c.source_key) ?? []
  if (a.length < PER) {
    a.push(c.url)
    bySrc.set(c.source_key, a)
  }
}

const robotsCache = new Map()
const rows = []

for (const [src, urls] of [...bySrc].sort()) {
  let ok = 0
  let blocked = 0
  const reasons = []
  for (const u0 of urls) {
    let u
    try {
      u = new URL(u0)
    } catch {
      reasons.push('bad-url')
      blocked++
      continue
    }
    if (!robotsCache.has(u.origin)) {
      const rr = await get(u.origin + '/robots.txt', 12000)
      robotsCache.set(u.origin, rr.ok ? parseRobots(rr.text) : null)
    }
    const robots = robotsCache.get(u.origin)
    if (robots && !isPathAllowed(robots, COMPOSE_USER_AGENT, u.pathname)) {
      reasons.push('robots')
      blocked++
      continue
    }
    const r = await get(u0)
    if (!r.ok) {
      reasons.push(r.err || 'HTTP' + r.status)
      blocked++
      continue
    }
    const a = extractArticle(r.text) // 본문은 여기서 끝 — 저장하지 않는다
    if (a.wordCount < MIN_WORDS) {
      reasons.push(`짧음(${a.wordCount}어·${a.via})`)
      blocked++
      continue
    }
    ok++
  }
  const verdict = ok > 0 ? 'ok' : 'blocked'
  rows.push({ src, ok, blocked, verdict, reasons: [...new Set(reasons)].join(',') })
}

console.log('소스별 본문 접근 (기사 ' + PER + '건씩 · 최소 ' + MIN_WORDS + '어)\n')
console.log(['소스'.padEnd(16), '판정'.padEnd(8), '성공/시도', '사유'].join(' '))
for (const r of rows) {
  console.log(
    [r.src.padEnd(16), r.verdict.padEnd(8), `${r.ok}/${r.ok + r.blocked}`.padStart(9), '  ' + r.reasons].join(' '),
  )
}

console.log('\n■ 레지스트리와 대조')
let drift = 0
for (const r of rows) {
  const spec = FACT_SOURCES[r.src]
  if (!spec) continue
  const recorded = spec.bodyAccess ?? 'unknown'
  if (recorded !== r.verdict) {
    drift++
    console.log(`  ⚠ ${r.src}: 기록 '${recorded}' ≠ 실측 '${r.verdict}' — FACT_SOURCES 를 갱신할 것`)
  }
}
console.log(drift === 0 ? '  기록과 실측이 일치한다.' : `  어긋남 ${drift}건.`)
