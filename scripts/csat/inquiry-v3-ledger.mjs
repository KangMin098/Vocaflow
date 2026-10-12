// scripts/csat/inquiry-v3-ledger.mjs
//
// v3 탐구 데이터 coverage 원장 — 기관 · 학년 · 유형 · 장면 · status 별 분모와 제외 사유(CSAT_V3_IMPLEMENTATION_PLAN §6).
// 입력: 작성 입력 청크(chunk-v3-*.json · chunk-inq-*.json, gitignore) · 작성 결과(*.out.json) · 공개 정본 inquiry-data.json · 비교 정본 compare-data.json.
// 출력: docs/csat-learner/v3/COVERAGE_LEDGER.md (재실행 안전 — 통째로 다시 쓴다). DB 를 읽지 않는다.
//   node scripts/csat/inquiry-v3-ledger.mjs [--check]   (--check: 파일을 안 쓰고 낡았으면 exit 1)
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'

const ROOT = process.cwd()
const DIR = join(ROOT, 'scripts/csat/inquiry-drain')
const OUT = join(ROOT, 'docs/csat-learner/v3/COVERAGE_LEDGER.md')
const CHECK = process.argv.includes('--check')

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))
const listOf = (o) => (Array.isArray(o) ? o : o.items ?? [])

// 입력(유형 · 정답 · 문장 수) — v1 입력 청크가 전 문항을 덮는다
const inputs = new Map()
for (const f of readdirSync(DIR).filter((f) => /^chunk-(inq|v3)-[\w-]+\.json$/.test(f) && !f.includes('.out.'))) {
  for (const it of listOf(readJson(join(DIR, f)))) if (!inputs.has(it.id)) inputs.set(it.id, it)
}
// 작성 결과 — 같은 id 는 v3 결과를 우선
const outs = new Map()
for (const f of readdirSync(DIR).filter((f) => /^chunk-(inq|v3)-[\w-]+\.out\.json$/.test(f)).sort()) {
  for (const it of listOf(readJson(join(DIR, f)))) {
    const prev = outs.get(it.id)
    if (!prev || (it.v3 && !prev.v3) || f.startsWith('chunk-v3')) outs.set(it.id, it)
  }
}
const pub = readJson(join(ROOT, 'apps/web/src/lib/csat/inquiry-data.json')).items
const comparePath = join(ROOT, 'apps/web/src/lib/csat/compare-data.json')
const compare = existsSync(comparePath) ? readJson(comparePath) : null
const pairIds = new Set()
if (compare?.items) {
  // 문항별 비교 목록 { id: [{ other, kind, ... }] } — 양쪽 이름을 모두 센다
  for (const [id, list] of Object.entries(compare.items)) { pairIds.add(id); for (const p of list) if (p?.other) pairIds.add(p.other) }
}

// 기관 · 학년 — id 형식: 2014A#23 · 2026#34 = 수능(고3), M2306#19 = 평가원 모의(6 · 9월, 고3)
function org(id) {
  if (/^M\d{4}#/.test(id)) return id.slice(3, 5) === '06' ? '평가원 6월 모평' : '평가원 9월 모평'
  return '수능'
}

const rows = []
for (const [id, inp] of inputs) {
  const o = outs.get(id)
  const p = pub[id]
  let status
  if (p?.review === 'verified' && p.v3) status = 'public_v3'
  else if (p) status = 'public_v1_only'
  else if (!o) status = 'not_written'
  else if (o.status !== 'ok') status = o.status
  else status = 'excluded_unreviewed'
  const v = p?.v3
  rows.push({
    id, org: org(id), grade: '고3', type: inp.type_id ?? 'unknown', status,
    scenes: {
      task: Boolean(v?.requirement), meaning: Boolean(v?.meanings?.length), judgment: (v?.choices?.length ?? 0) === 5,
      design: Boolean(v?.design?.claims?.length), principle: Boolean(p?.principle?.statement), compare: pairIds.has(id),
    },
  })
}

const SC = ['task', 'meaning', 'judgment', 'design', 'principle', 'compare']
const count = (arr, f) => arr.filter(f).length
function table(keyFn, label) {
  const groups = new Map()
  for (const r of rows) { const k = keyFn(r); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r) }
  const head = `| ${label} | 분모 | 공개 v3 | 제외 | ${SC.join(' | ')} |\n|---|---:|---:|---:|${SC.map(() => '---:').join('|')}|`
  const body = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, g]) =>
    `| ${k} | ${g.length} | ${count(g, (r) => r.status === 'public_v3')} | ${count(g, (r) => r.status !== 'public_v3')} | ${SC.map((s) => count(g, (r) => r.scenes[s])).join(' | ')} |`)
  return [head, ...body].join('\n')
}
const statuses = new Map()
for (const r of rows) statuses.set(r.status, (statuses.get(r.status) ?? 0) + 1)
const excluded = rows.filter((r) => r.status !== 'public_v3').sort((a, b) => a.id.localeCompare(b.id))

const md = `# v3 탐구 데이터 coverage 원장

> \`node scripts/csat/inquiry-v3-ledger.mjs\` 가 생성 — 손으로 고치지 말 것. 기준: 작성 입력 청크 · 작성 결과 · 공개 정본(\`inquiry-data.json\`) · 비교 정본(\`compare-data.json\`).
> 범위는 평가원(수능 · 6월/9월 모평, 고3) in_scope 분석 문항. **학평 고1~3 은 공개 보류(2026-10-11 사용자 결정)라 분모에 없다.**
> 장면 칸은 공개 데이터에 그 장면의 v3 칸이 있는 문항 수. compare 는 기존 비교 정본에 이름이 오른 문항 수(v3 검수 쌍 아님 — legacy_unbound).

## 상태

| status | 문항 | 뜻 |
|---|---:|---|
${[...statuses.entries()].sort().map(([k, n]) => `| ${k} | ${n} | ${{ public_v3: 'v3 칸까지 독립 검수 verified · 공개', public_v1_only: 'v1 칸만 공개', not_written: '작성 결과 없음', excluded_unreviewed: '작성은 됐으나 유효한 검수 pass 없음', needs_review: '기존 분석의 문장 번호/인용이 화면 분할과 어긋남 — 분석 교정 공정 몫', needs_source: '원문 결손' }[k] ?? ''} |`).join('\n')}
| **합계** | **${rows.length}** | |

## 기관 · 학년

${table((r) => `${r.org} · ${r.grade}`, '기관 · 학년')}

## 유형

${table((r) => r.type, '유형')}

## 제외 문항 (${excluded.length})

${excluded.map((r) => `- ${r.id} · ${r.type} · ${r.status}`).join('\n') || '- 없음'}
`

if (CHECK) {
  const cur = existsSync(OUT) ? readFileSync(OUT, 'utf8').replace(/\r\n/g, '\n') : ''
  if (cur !== md) { console.error('COVERAGE_LEDGER 낡음 — node scripts/csat/inquiry-v3-ledger.mjs'); process.exit(1) }
  console.log('COVERAGE_LEDGER 최신')
} else {
  mkdirSync(dirname(OUT), { recursive: true })
  writeFileSync(OUT, md)
  console.log(`원장 ${rows.length}문항 · ${[...statuses.entries()].map(([k, n]) => `${k} ${n}`).join(' · ')} → ${OUT}`)
}
