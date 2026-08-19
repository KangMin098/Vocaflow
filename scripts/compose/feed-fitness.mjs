// scripts/compose/feed-fitness.mjs
//
// ACP §20 — **피드별 학습 적합도.** 어떤 피드가 한국 학습자용 지문을 실제로 물어오는가.
//
// ── 왜 필요한가 ─────────────────────────────────────────────────────
// 수집은 잘 돌지만(하루 300~800 후보) 취재 가능 사건이 전부 사망·사고·정치 쟁점이라
// 학습 지문으로 한 편도 못 썼다. 즉 **피드가 뉴스 홈·탑스토리 중심이라 학습 부적합 비율이
// 구조적으로 높다.** 그런데 후보 테이블에 `feed_id` 가 없어 "어느 피드가 문제인가" 를
// 귀속할 수 없다 — 그래서 피드를 직접 열어 그 자리에서 분류한다.
//
// 분류는 제목 기반 규칙이라 정밀하지 않다. **순위를 매기는 용도**이지 개별 판정용이 아니다.
// 규칙은 아래 한곳에만 있고, 바꾸면 모든 측정이 같이 바뀐다.
//
// 실행: pnpm dlx tsx scripts/compose/feed-fitness.mjs [--all]
//   --all 을 주면 비활성 피드도 잰다(후보 피드를 견줄 때).

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const { createClient } = await import('@supabase/supabase-js')
const { COMPOSE_USER_AGENT, classifyTopic } = await import('@vocaflow/library-pipeline')

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const get = async (url, ms = 15000) => {
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

function titles(xml) {
  const blocks = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) ?? []
  const out = []
  for (const b of blocks) {
    const m = b.match(/<title(?:\s[^>]*)?>\s*(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))\s*<\/title>/i)
    const t = (m?.[1] ?? m?.[2] ?? '').trim()
    if (t) out.push(t)
  }
  return out
}

let q = db.from('article_compose_feeds').select('source_key,url,label,enabled').order('source_key')
if (!process.argv.includes('--all')) q = q.eq('enabled', true)
const { data: feeds, error } = await q
if (error) throw new Error('피드 조회 실패: ' + error.message)

const rows = []
for (const f of feeds ?? []) {
  const r = await get(f.url)
  if (!r.ok) {
    rows.push({ ...f, n: 0, fit: 0, unfit: 0, pct: null, note: 'HTTP' + (r.err || r.status) })
    continue
  }
  const ts = titles(r.text)
  let fit = 0
  let unfit = 0
  for (const t of ts) {
    const c = classifyTopic(t)
    if (c === 'fit') fit++
    else if (c === 'unfit') unfit++
  }
  rows.push({
    ...f,
    n: ts.length,
    fit,
    unfit,
    pct: ts.length ? (100 * fit) / ts.length : null,
    upct: ts.length ? (100 * unfit) / ts.length : null,
    note: '',
  })
}

rows.sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1))

console.log('피드별 학습 적합도 (제목 기반 · 순위용)\n')
console.log(
  ['소스'.padEnd(15), '피드'.padEnd(26), '항목', ' 적합%', '부적합%', ''].join(' '),
)
for (const r of rows) {
  console.log(
    [
      r.source_key.padEnd(15),
      String(r.label).slice(0, 26).padEnd(26),
      String(r.n).padStart(4),
      (r.pct === null ? '  -' : r.pct.toFixed(1)).padStart(6),
      (r.upct === null ? '  -' : r.upct.toFixed(1)).padStart(7),
      r.enabled ? '' : ' (비활성)',
      r.note,
    ].join(' '),
  )
}

const on = rows.filter((r) => r.enabled && r.n > 0)
const totN = on.reduce((s, r) => s + r.n, 0)
const totFit = on.reduce((s, r) => s + r.fit, 0)
const totUnfit = on.reduce((s, r) => s + r.unfit, 0)
console.log(
  `\n활성 합계 ${totN}항목 · 적합 ${((100 * totFit) / totN).toFixed(1)}% · 부적합 ${((100 * totUnfit) / totN).toFixed(1)}%`,
)
const dead = on.filter((r) => (r.pct ?? 0) < 10)
if (dead.length) {
  console.log(`\n적합 10% 미만 피드 ${dead.length}개 — 학습 지문을 거의 물어오지 못한다:`)
  for (const d of dead) console.log(`  · ${d.source_key} / ${d.label} (${d.pct.toFixed(1)}%)`)
}
