// scripts/csat/topic-gap.mjs
//
// **재고의 소재 구성이 기출과 같은가 — 「적합」의 두 번째 축.**
//
// ── 왜 이 자가 필요한가 ─────────────────────────────────────────────
// `score-articles.mjs` 는 원문이 수능 지문의 **모양(어수·문장길이·낱말길이)과 담화
// (연결사·지시어)** 대역에 드는지만 잰다. 그 파일이 스스로 밝히듯 **소재는 재지 않는다.**
// 그래서 `csat_fit.pass > 0` 을 「적합」이라 부르면 절반만 말한 것이다 —
// 모양이 맞아도 소재가 스모 심판·앨범 리뷰면 수능 교재 원천이 아니다.
//
// `measure-topic.mjs` 가 기출 302지문으로 재 둔 것: 회차와 소재는 **독립**이다
// (순열검정 p=0.26). 즉 소재 구성은 회차마다 새로 정하는 게 아니라 **고정 배합**이고,
// 그 배합이 곧 우리가 맞춰야 할 목표 분포다.
//
// ── 이 자가 내는 수치 — 「균형 사정권」 ──────────────────────────────
// 소재별 재고를 목표 배합으로 나눈 값의 **최솟값**이다.
//
//   균형 사정권 = min_t ( 재고_t / 목표비율_t )
//
// 5만 편이 있어도 전부 생물학이면 기출 배합으로 교재를 짤 수 없다. 병목 소재가
// 전체를 결정한다 — 그래서 "몇 편 있는가" 가 아니라 **"배합을 맞춘 채 몇 편 쓸 수 있는가"**
// 를 센다. 이 값이 목표(1만/3만/5만)와 견줄 유일하게 정직한 수다.
//
// ⚠️ 분류기는 약하다(`lib-topic.mjs` 참조). 다만 기출과 재고에 **같은 자**를 대므로
//   격차의 방향과 크기는 성립한다. 개별 글의 소재를 단정하는 데는 쓰지 않는다.
//
// 재실행 안전: 읽기만 한다. 아무것도 쓰지 않는다(`--out` 을 준 경우 리포트 파일만).
//
// 실행:
//   node scripts/csat/topic-gap.mjs                  # 표본 3,000편 (기본)
//   node scripts/csat/topic-gap.mjs --all            # 적합 원문 전량 (느리다)
//   node scripts/csat/topic-gap.mjs --out docs/reports/topic-gap.json

import fs from 'node:fs'
import path from 'node:path'

import { classify, TOPIC_KEYS } from './lib-topic.mjs'

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const ALL = process.argv.includes('--all')
const SAMPLE = ALL ? Infinity : Number(arg('sample') ?? 3000)
const OUT = arg('out')

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

// ── 목표 배합 = 기출 실측 ────────────────────────────────────────────
const distFile = path.resolve('scripts/csat/data/topic-distribution.json')
if (!fs.existsSync(distFile)) {
  console.error(`기출 소재 분포가 없다 — 먼저 돌릴 것: node scripts/csat/measure-topic.mjs`)
  process.exit(1)
}
const dist = JSON.parse(fs.readFileSync(distFile, 'utf8'))
const examTotal = dist.n
// ⚠️ `분류불가` 를 목표 배합에 넣으면 안 된다 — 그건 소재가 아니라 **분류기가 진 자리**다.
//   목표로 삼으면 "분류가 안 되는 글을 5.6% 확보하라" 는 말이 되어 버린다.
const TARGET_KEYS = TOPIC_KEYS.filter((k) => k !== '분류불가')
const examClassified = TARGET_KEYS.reduce((s, k) => s + (dist.total[k] ?? 0), 0)
const target = Object.fromEntries(TARGET_KEYS.map((k) => [k, (dist.total[k] ?? 0) / examClassified]))

// ── 재고 읽기 ────────────────────────────────────────────────────────
const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const { count: fitTotal, error: cErr } = await db
  .from('library_articles')
  .select('id', { count: 'exact', head: true })
  .gt('csat_fit->>pass', '0')
if (cErr) throw new Error(`적합 편수 조회 실패: ${cErr.message}`)

console.log(
  `소재 격차 — 재고 구성이 기출과 같은가\n${'='.repeat(78)}\n` +
    `  기출 ${examTotal}지문 (분류된 ${examClassified}) · 적합 원문 ${fitTotal.toLocaleString()}편\n`,
)

const stock = Object.fromEntries(TOPIC_KEYS.map((k) => [k, 0]))
const bySource = new Map()
let seen = 0
const PAGE = 200
for (let from = 0; seen < SAMPLE; from += PAGE) {
  const { data, error } = await db
    .from('library_articles')
    .select('source, content')
    .gt('csat_fit->>pass', '0')
    .not('content', 'is', null)
    .order('id')
    .range(from, from + PAGE - 1)
  if (error) throw new Error(`재고 조회 실패: ${error.message}`)
  if (!data || data.length === 0) break
  for (const a of data) {
    if (seen >= SAMPLE) break
    // 앞 6,000자만 본다 — 소재는 글머리에서 정해지고, 전문을 다 훑으면 방법 절(methods)의
    // 통계 용어가 뒤에서 표를 흔든다. 기출 지문(≈150어)과 견주려면 앞쪽이 옳다.
    const t = classify(String(a.content).slice(0, 6000)).topic
    stock[t] += 1
    if (!bySource.has(a.source)) bySource.set(a.source, Object.fromEntries(TOPIC_KEYS.map((k) => [k, 0])))
    bySource.get(a.source)[t] += 1
    seen += 1
  }
  if (data.length < PAGE) break
  process.stderr.write(`\r  분류 ${seen.toLocaleString()}편…`)
}
process.stderr.write('\r' + ' '.repeat(30) + '\r')

const stockClassified = TARGET_KEYS.reduce((s, k) => s + stock[k], 0)
const scale = fitTotal / Math.max(1, seen) // 표본 → 전량 환산

// ── ① 분포 대조 ──────────────────────────────────────────────────────
console.log(`  ① 소재 분포 — 기출 vs 재고 (재고 표본 ${seen.toLocaleString()}편)`)
console.log('  ' + '-'.repeat(74))
console.log(`    ${'소재'.padEnd(11)}${'기출%'.padStart(8)}${'재고%'.padStart(8)}${'배율'.padStart(8)}${'추정 재고'.padStart(11)}`)
const rows = []
for (const k of TARGET_KEYS) {
  const ex = 100 * target[k]
  const st = (100 * stock[k]) / Math.max(1, stockClassified)
  const ratio = st / Math.max(0.0001, ex)
  const est = Math.round(stock[k] * scale)
  rows.push({ topic: k, examPct: ex, stockPct: st, ratio, estStock: est })
  const flag = ratio < 0.5 ? ' ⚠️ 부족' : ratio > 2 ? ' ← 과잉' : ''
  console.log(
    `    ${k.padEnd(11)}${ex.toFixed(1).padStart(8)}${st.toFixed(1).padStart(8)}` +
      `${ratio.toFixed(2).padStart(8)}${est.toLocaleString().padStart(11)}${flag}`,
  )
}
const unclass = (100 * stock['분류불가']) / Math.max(1, seen)
console.log(`    ${'(분류불가)'.padEnd(11)}${''.padStart(8)}${unclass.toFixed(1).padStart(8)}`)
console.log()

// ── ② 균형 사정권 ────────────────────────────────────────────────────
// 목표 배합을 지키며 쓸 수 있는 총 편수 = 병목 소재가 정한다.
const balanced = Math.floor(Math.min(...rows.map((r) => r.estStock / target[r.topic])))
const bottleneck = rows.reduce((a, b) => (a.estStock / target[a.topic] <= b.estStock / target[b.topic] ? a : b))
console.log('  ② 균형 사정권 — 기출 배합을 지키며 쓸 수 있는 편수')
console.log('  ' + '-'.repeat(74))
console.log(`    적합 원문 ${fitTotal.toLocaleString()}편 중 **${balanced.toLocaleString()}편**`)
console.log(`    병목 소재: ${bottleneck.topic} (재고 ${bottleneck.estStock.toLocaleString()} · 목표비율 ${(100 * target[bottleneck.topic]).toFixed(1)}%)`)
console.log()
for (const [label, goal] of [['1단계', 10000], ['2단계', 30000], ['3단계', 50000]]) {
  const pct = (100 * balanced) / goal
  const need = Object.fromEntries(
    rows.map((r) => [r.topic, Math.max(0, Math.round(goal * target[r.topic]) - r.estStock)]),
  )
  const short = Object.entries(need).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
  console.log(
    `    ${label} ${goal.toLocaleString().padStart(6)} → ${pct >= 100 ? '달성' : '미달'} ${pct.toFixed(1)}%` +
      `  · 부족 ${short.reduce((s, [, v]) => s + v, 0).toLocaleString()}편` +
      (short.length ? ` (최다 ${short[0][0]} ${short[0][1].toLocaleString()})` : ''),
  )
}
console.log()

// ── ③ 소재를 실제로 정하는 것은 소스다 ────────────────────────────────
console.log('  ③ 소스별 소재 구성 — 어디서 가져오면 어떤 소재가 오는가 (표본 기준)')
console.log('  ' + '-'.repeat(74))
console.log('    ' + '소스'.padEnd(18) + '편수'.padStart(7) + TARGET_KEYS.map((k) => k.slice(0, 2).padStart(6)).join(''))
const sourceRows = []
for (const [src, t] of [...bySource].sort((a, b) => {
  const sa = TOPIC_KEYS.reduce((s, k) => s + a[1][k], 0)
  const sb = TOPIC_KEYS.reduce((s, k) => s + b[1][k], 0)
  return sb - sa
})) {
  const n = TOPIC_KEYS.reduce((s, k) => s + t[k], 0)
  sourceRows.push({ source: src, n, byTopic: t })
  console.log(
    `    ${src.padEnd(18)}${String(n).padStart(7)}` +
      TARGET_KEYS.map((k) => `${Math.round((100 * t[k]) / Math.max(1, n))}%`.padStart(6)).join(''),
  )
}
console.log()
console.log('  ⚠️ 표본은 `id` 오름차순 앞쪽이라 소스 구성이 전량과 다를 수 있다 — 소스별 비율은')
console.log('     그 소스 안에서만 읽고, 소스 간 편수 비교에는 쓰지 말 것. 전량은 `--all`.')

if (OUT) {
  fs.writeFileSync(
    path.resolve(OUT),
    JSON.stringify(
      { measuredAt: new Date().toISOString(), examTotal, examClassified, target, fitTotal, sampled: seen, stock, rows, balanced, bottleneck: bottleneck.topic, bySource: sourceRows },
      null,
      1,
    ),
  )
  console.log(`\n→ ${OUT}`)
}
