// scripts/csat/source-round-report.mjs
//
// **보관 판정 회차를 집계해 `docs/source-check/round-{n}.md` 를 쓴다 — DB 는 읽지 않는다(판정 파일만).**
//
// 기준: docs/source-check/criteria.md §10. 한 회차가 내는 것:
//   · 소스별 보관·보류·폐기 · 보류 사유 분포
//   · 칸별 집계(보관된 원천이 채우는 연령·목적·유형·난이도·플랫폼 속성) — 어느 칸이 부족한지가 여기서 나온다
//   · 이중 판정 일치도(κ) — `chunk-<source>.b.out.json` 이 있는 소스
//   · 사람 확인 표본 — 보관·보류·폐기에서 **고르게**, 소스를 돌아가며 뽑는다
//   · `--compare <다른 회차 디렉터리>` — 같은 원천을 다른 기준 버전으로 판정한 결과와 대조해 **바뀐 건수**
// 오판 분석·다음 회차 계획 절은 사람 확인 결과를 받은 뒤 채운다(표본을 보기 전에는 쓸 수 없다).
//
// 실행: node scripts/csat/source-round-report.mjs --round 1 [--sample 10] [--compare scripts/csat/source-round/round-0] [--stdout]

import fs from 'node:fs'
import path from 'node:path'

import { SLOT_AGES, SLOT_PURPOSES, SLOT_TYPES, SLOT_PLATFORM } from './gate-rules.mjs'

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`)
  return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d
}
const ROUND = Number(arg('round', 0))
if (!Number.isInteger(ROUND) || ROUND < 1) throw new Error('--round <n> (1 이상)')
const SAMPLE = Number(arg('sample', 10))
// `--dir`·`--name` — 같은 회차 표본을 개정된 기준으로 다시 판정한 결과(예: round-1-v2)를 따로 집계할 때.
const DIR = path.resolve(arg('dir', `scripts/csat/source-round/round-${ROUND}`))
const NAME = arg('name', `round-${ROUND}`)
const COMPARE = arg('compare', '')
if (!fs.existsSync(DIR)) throw new Error(`회차 디렉터리가 없다: ${DIR}`)

const readOuts = (dir, suffix) => {
  const out = new Map()
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(suffix) && !f.endsWith(`.b${suffix}`))) {
    const source = f.replace(/^chunk-/, '').replace(suffix, '')
    out.set(source, JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')))
  }
  return out
}
const outs = readOuts(DIR, '.out.json')
const chunks = new Map(
  fs.readdirSync(DIR).filter((f) => /^chunk-[^.]+\.json$/.test(f)).map((f) => [f.replace(/^chunk-/, '').replace('.json', ''), JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))]),
)
const titleOf = new Map([...chunks.values()].flat().map((x) => [x.id, x.title]))
const missing = [...chunks.keys()].filter((s) => !outs.has(s))

// ── 소스별 ───────────────────────────────────────────────────────────
const cls = ['keep', 'hold', 'discard']
const bySource = []
const holdReasons = {}
const all = []
for (const [source, rows] of [...outs].sort()) {
  const c = { keep: 0, hold: 0, discard: 0 }
  for (const r of rows) {
    c[r.retention] = (c[r.retention] ?? 0) + 1
    if (r.retention === 'hold') holdReasons[r.hold_reason] = (holdReasons[r.hold_reason] ?? 0) + 1
    all.push({ ...r, source })
  }
  bySource.push({ source, n: rows.length, ...c })
}
const total = all.length
const pct = (x, n = total) => (n ? `${((x / n) * 100).toFixed(1)}%` : '—')

// ── 칸별(보관만) ─────────────────────────────────────────────────────
const kept = all.filter((r) => r.retention === 'keep')
const axisCount = (axis, vocab) => {
  const m = Object.fromEntries([...vocab].map((v) => [v, 0]))
  for (const r of kept) for (const v of r.slots?.[axis] ?? []) m[v] = (m[v] ?? 0) + 1
  return m
}
const levelCount = {}
for (const r of kept) for (const v of r.slots?.levels ?? []) levelCount[v] = (levelCount[v] ?? 0) + 1
const platformBySource = bySource.map(({ source }) => {
  const rows = all.filter((r) => r.source === source)
  return { source, ...Object.fromEntries([...SLOT_PLATFORM].map((p) => [p, rows.filter((r) => r.slots?.platform?.includes(p)).length])) }
})

// ── 이중 판정 ────────────────────────────────────────────────────────
const doubles = []
for (const f of fs.readdirSync(DIR).filter((f) => f.endsWith('.b.out.json'))) {
  const source = f.replace(/^chunk-/, '').replace('.b.out.json', '')
  const a = new Map((outs.get(source) ?? []).map((r) => [r.id, r.retention]))
  const b = new Map(JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')).map((r) => [r.id, r.retention]))
  const ids = [...a.keys()].filter((id) => b.has(id))
  const t = Object.fromEntries(cls.map((x) => [x, Object.fromEntries(cls.map((y) => [y, 0]))]))
  for (const id of ids) t[a.get(id)][b.get(id)]++
  const n = ids.length
  const po = cls.reduce((s, c) => s + t[c][c], 0) / n
  const pe = cls.reduce((s, c) => s + (cls.reduce((x, y) => x + t[c][y], 0) / n) * (cls.reduce((x, y) => x + t[y][c], 0) / n), 0)
  doubles.push({ source, n, agreement: po, kappa: pe === 1 ? 1 : (po - pe) / (1 - pe) })
}

// ── 사람 확인 표본 — 판정마다 SAMPLE 건, 소스를 돌아가며 ─────────────────
const sample = []
for (const c of cls) {
  const pools = bySource.map(({ source }) => all.filter((r) => r.source === source && r.retention === c))
  for (let i = 0; sample.filter((s) => s.retention === c).length < SAMPLE && pools.some((p) => p.length > i); i++) {
    for (const p of pools) if (p[i] && sample.filter((s) => s.retention === c).length < SAMPLE) sample.push(p[i])
  }
}

// ── 재판정 비교 ──────────────────────────────────────────────────────
let compare = null
if (COMPARE) {
  const prev = new Map([...readOuts(path.resolve(COMPARE), '.out.json').values()].flat().map((r) => [r.id, r]))
  const both = all.filter((r) => prev.has(r.id))
  const changed = both.filter((r) => prev.get(r.id).retention !== r.retention)
  compare = { dir: COMPARE, both: both.length, changed: changed.length, moves: changed.reduce((m, r) => ((m[`${prev.get(r.id).retention}→${r.retention}`] = (m[`${prev.get(r.id).retention}→${r.retention}`] ?? 0) + 1), m), {}) }
}

// ── 쓰기 ─────────────────────────────────────────────────────────────
const versions = [...new Set(all.map((r) => r.criteria_version))]
const tbl = (head, rows) => [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n')
const axisTable = (label, m) => tbl([label, '보관 원천 수', '보관 중 비율'], Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, v]) => [`\`${k}\``, v, pct(v, kept.length)]))
const md = `# 원문 점검 회차 ${ROUND}${NAME !== `round-${ROUND}` ? ` — ${NAME}` : ''}

> 기준 버전 ${versions.map((v) => `v${v}`).join(' · ')} · 판정 ${total}건 · 소스 ${bySource.length}곳${missing.length ? ` · **판정 파일 없는 소스 ${missing.length}곳**: ${missing.join(', ')}` : ''}
> 생성: \`node scripts/csat/source-round-report.mjs --round ${ROUND}\` · 근거 태그: 이 문서의 수치는 전부 [측정](이 회차 판정 파일 집계)이다.

## 1. 판정 분포

전체 보관 ${all.filter((r) => r.retention === 'keep').length}(${pct(kept.length)}) · 보류 ${all.filter((r) => r.retention === 'hold').length}(${pct(all.filter((r) => r.retention === 'hold').length)}) · 폐기 ${all.filter((r) => r.retention === 'discard').length}(${pct(all.filter((r) => r.retention === 'discard').length)})

보류 사유: ${Object.entries(holdReasons).map(([k, v]) => `\`${k}\` ${v}`).join(' · ') || '없음'}

${tbl(['소스', '건수', '보관', '보류', '폐기', '보관 비율'], bySource.map((s) => [s.source, s.n, s.keep, s.hold, s.discard, pct(s.keep, s.n)]))}

## 2. 칸별 집계 — 보관된 원천이 채우는 칸

${axisTable('연령', axisCount('ages', SLOT_AGES))}

${axisTable('목적', axisCount('purposes', SLOT_PURPOSES))}

${axisTable('문항 유형', axisCount('types', SLOT_TYPES))}

${axisTable('난이도', levelCount)}

**플랫폼 고유 속성(잠정 [추론]) — 소스별 보유 건수**

${tbl(['소스', ...SLOT_PLATFORM], platformBySource.map((r) => [r.source, ...[...SLOT_PLATFORM].map((p) => r[p])]))}

## 3. 이중 판정 일치도

${doubles.length ? tbl(['소스', '건수', '일치율', 'κ'], doubles.map((d) => [d.source, d.n, `${(d.agreement * 100).toFixed(1)}%`, d.kappa.toFixed(3)])) : '이중 판정 파일(`.b.out.json`)이 아직 없다.'}

${doubles.some((d) => d.kappa < 0.6) ? '**κ 0.6 미만인 소스가 있다 — 기준 §9 에 따라 이 회차의 적재를 멈추고 어긋난 편의 why 를 대조한다.**' : ''}

## 4. 사람 확인 표본 — 보관·보류·폐기 각 ${SAMPLE}건

${tbl(['판정', '소스', '원천', '이유', '칸(유형 · 목적 · 연령 · 난이도)'], sample.map((r) => [
  r.retention + (r.hold_reason ? `(${r.hold_reason})` : ''),
  r.source,
  `${String(titleOf.get(r.id) ?? '').slice(0, 50).replace(/\|/g, '/')} \`${r.id.slice(0, 8)}\``,
  String(r.why).replace(/\|/g, '/'),
  [r.slots?.types, r.slots?.purposes, r.slots?.ages, r.slots?.levels].map((a) => (a ?? []).join(',') || '—').join(' · '),
]))}

## 5. 재판정 — 기준 개정 전후로 바뀐 건수

${compare ? `\`${compare.dir}\` 와 같은 원천 ${compare.both}건 중 **${compare.changed}건** 바뀜 — ${Object.entries(compare.moves).map(([k, v]) => `${k} ${v}`).join(' · ') || '없음'}` : '이번 회차는 비교할 이전 판정이 없다(\`--compare\` 없음).'}

## 6. 오판 분석

사람 확인(§4 표본) 결과를 받은 뒤 채운다 — 잘못 보관한 것 · 잘못 폐기한 것 · 기준에 없어서 갈린 것(보류 \`criteria-gap\`).

## 7. 다음 회차 계획

오판 분석 뒤에 정한다 — 개정한 기준 버전 · 재판정 범위 · 다음 회차 소스별 건수.
`
if (process.argv.includes('--stdout')) console.log(md)
else {
  const file = path.resolve(`docs/source-check/${NAME}.md`)
  fs.writeFileSync(file, md)
  console.log(JSON.stringify({ written: path.relative(process.cwd(), file), judged: total, sources: bySource.length, missing, doubles: doubles.length, sample: sample.length }))
}
