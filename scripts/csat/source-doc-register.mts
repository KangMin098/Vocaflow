// scripts/csat/source-doc-register.mts
//
// **확보한 원문 등록부를 만든다 — 이 조사의 산출물이다.**
//
// 목표는 「소스GET 사이트에서 원문의 내용을 점검해서, 여러 유형의 교재를 생성하기
// 위한 원천인 원문을 확보하는 것」이다. 그 확보분이 여기 모인다.
//
// 입력 둘을 합친다:
//   `source-doc-inspect.json`   기계 점검 — 정제 후 산문량 · 언어 · 창별 산출
//   `doc-read-N.out.json`       읽기 판정 — 화제 · 장르 · 내용 적합성 · usable_for
//
// 기계가 못 보는 것(화제·장르)과 사람이 안 세는 것(창별 산출)을 **한 행에** 둔다.
// 둘 중 하나만 보면 판정이 틀린다 — 이 조사에서 두 번 그랬다.
//
// 사용: pnpm dlx tsx scripts/csat/source-doc-register.mts --dir <스크래치패드>
// 읽기 전용.

import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const argOf = (n: string, d: string): string => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d
}
const DIR = resolve(argOf('dir', '.'))
const INSPECT = resolve(argOf('inspect', 'docs/reports/data/source-doc-inspect.json'))
const OUT = resolve(argOf('out', 'docs/reports/data/source-doc-register.json'))

interface Inspected {
  id: string; source: string; words_raw: number; words_prose: number
  keep_pct: number; english_ratio: number
  yield: Record<string, number>; types_covered: number
  verdict: 'inspect' | 'reject'; reject_reason: string | null
}
interface Read {
  id: string; verdict: 'keep' | 'drop'; topic_ko?: string; domain?: string
  usable_for?: string[]; why?: string; drop_reason?: string
}

const insp = JSON.parse(readFileSync(INSPECT, 'utf8')) as { docs: Inspected[] }
const byId = new Map(insp.docs.map((d) => [d.id, d]))

const reads: Read[] = []
for (const f of readdirSync(DIR).filter((x) => /^doc-read-\d+\.out\.json$/.test(x))) {
  try {
    const j = JSON.parse(readFileSync(join(DIR, f), 'utf8')) as { items?: Read[] }
    for (const it of j.items ?? []) reads.push(it)
  } catch { /* 아직 안 나온 청크 */ }
}
const readById = new Map(reads.map((r) => [r.id, r]))

const WINDOWS = ['school_sentence', 'school_paragraph', 'csat_short', 'csat_long'] as const

interface Row extends Inspected {
  read_verdict: 'keep' | 'drop' | 'unread'
  topic_ko: string | null
  domain: string | null
  usable_for: string[]
  drop_reason: string | null
}
const rows: Row[] = insp.docs.map((d) => {
  const r = readById.get(d.id)
  return {
    ...d,
    read_verdict: d.verdict === 'reject' ? 'drop' : (r?.verdict ?? 'unread'),
    topic_ko: r?.topic_ko ?? null,
    domain: r?.domain ?? null,
    usable_for: r?.usable_for ?? [],
    drop_reason: d.verdict === 'reject' ? d.reject_reason : (r?.drop_reason ?? null),
  }
})

const kept = rows.filter((r) => r.read_verdict === 'keep')

// ── 보고 ──────────────────────────────────────────────────────────────
const pad = (s: string | number, n: number): string => String(s).padStart(n)
console.log('확보 원문 등록부\n')

const bySource: Record<string, { n: number; keep: number; drop: number; unread: number }> = {}
for (const r of rows) {
  const b = (bySource[r.source] ??= { n: 0, keep: 0, drop: 0, unread: 0 })
  b.n++
  b[r.read_verdict === 'unread' ? 'unread' : r.read_verdict]++
}
console.log('원천        점검   확보   버림   미판정   확보율')
for (const [k, v] of Object.entries(bySource)) {
  const judged = v.keep + v.drop
  console.log(
    `${k.padEnd(12)}${pad(v.n, 4)}${pad(v.keep, 7)}${pad(v.drop, 7)}${pad(v.unread, 9)}` +
      `${pad(judged ? ((v.keep / judged) * 100).toFixed(0) + '%' : '—', 9)}`
  )
}
const judgedAll = rows.filter((r) => r.read_verdict !== 'unread').length
console.log(`\n확보 ${kept.length} / 판정 ${judgedAll} (${judgedAll ? ((kept.length / judgedAll) * 100).toFixed(1) : 0}%) · 전체 ${rows.length}`)

// 버린 이유
const drops: Record<string, number> = {}
for (const r of rows.filter((x) => x.read_verdict === 'drop')) {
  const k = (r.drop_reason ?? '(사유 없음)').replace(/\d+/g, 'N')
  drops[k] = (drops[k] ?? 0) + 1
}
if (Object.keys(drops).length) {
  console.log('\n버린 이유')
  for (const [k, v] of Object.entries(drops).sort((a, b) => b[1] - a[1])) console.log(`  ${pad(v, 3)}건  ${k}`)
}

// 유형 커버리지 — **확보분이 어느 유형을 채우는가**가 이 조사의 목적이다
console.log('\n유형 커버리지 (확보 원문 기준)')
for (const w of WINDOWS) {
  const docs = kept.filter((r) => r.usable_for.includes(w) || (!r.usable_for.length && (r.yield[w] ?? 0) > 0))
  const spans = docs.reduce((a, r) => a + (r.yield[w] ?? 0), 0)
  console.log(`  ${w.padEnd(18)}원문 ${pad(docs.length, 4)}편  ·  토막 ${pad(spans.toLocaleString(), 8)}  ·  편당 ${(spans / Math.max(1, docs.length)).toFixed(1)}`)
}

// 소재 분포 — 부족 칸을 채우는지가 원천의 값어치다
const dom: Record<string, number> = {}
for (const r of kept) if (r.domain) dom[r.domain] = (dom[r.domain] ?? 0) + 1
if (Object.keys(dom).length) {
  console.log('\n소재 분포 (확보 원문)')
  for (const [k, v] of Object.entries(dom).sort((a, b) => b[1] - a[1])) console.log(`  ${pad(v, 3)}편  ${k}`)
}

writeFileSync(
  OUT,
  JSON.stringify(
    {
      measuredAt: new Date().toISOString().slice(0, 10),
      contract: 'source-doc-register/v1',
      total: rows.length, kept: kept.length, judged: judgedAll,
      bySource, dropReasons: drops, domains: dom,
      docs: rows,
    },
    null, 2
  )
)
console.log(`\n기록: ${OUT}`)
