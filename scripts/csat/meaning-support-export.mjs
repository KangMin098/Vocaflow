// scripts/csat/meaning-support-export.mjs
//
// v3.1 원문 이해 교수 sidecar — **manifest 와 작성 입력**을 만든다. (C0 · C1)
//
//   node scripts/csat/meaning-support-export.mjs --manifest scripts/csat/meaning-support-drain/pilot-manifest.json [--source-root <dir>] [--dry]
//
// - manifest(커밋): 문항별 유형 · 분석 버전 · units_hash · basePublicHash · sourceSnapshotHash · inputRef · 문장 수 · 도표 여부 ·
//   기존 인용 기준선(단어 수 · 중복 제거 구간 · 원문 대비 비율) · 계획 지원 · 제외/보류 사유. **원문 본문은 넣지 않는다.**
// - 작성 입력(gitignore · meaning-support-drain/input-<id>.json): 원문 문장 · 발문 · 선지 · 공개 v3 · 결속 값.
// 원문 입력은 --source-root(기본 scripts/csat/inquiry-drain)의 chunk-inq|v3-*.json 에서만 읽는다. 없는 원문은 needs_source 로 남기고
// 기존 설명에서 복원하지 않는다. 재실행 안전: manifest 는 통째로 다시 쓰되 같은 입력이면 byte-identical, 작성 결과(.out.json)는 건드리지 않는다.
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'

import { basePublicHash, quoteBaseline, sourceSnapshotHash } from './lib-meaning-support.mjs'

const ROOT = process.cwd()
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d }
const MANIFEST = arg('--manifest', 'scripts/csat/meaning-support-drain/pilot-manifest.json')
const SRC = arg('--source-root', 'scripts/csat/inquiry-drain')
const DRY = process.argv.includes('--dry')
if (process.argv.includes('--help')) {
  console.log('manifest 출력: --manifest <path> · 원문 입력 root: --source-root <dir> · --dry: 파일 안 씀 · 재실행 안전(작성 결과 보존)')
  process.exit(0)
}

// 파일럿 범위 — 설계 §7 · 지시문 §2(C0). 수직 구현은 #34 · #38 먼저
const PILOT = [
  { id: '2026#34', supports: ['meaning', 'simple', 'preserve', 'relation', 'whole', 'inference'], stage: 'C2' },
  { id: '2026#38', supports: ['meaning', 'simple', 'preserve', 'relation', 'whole'], stage: 'C2' },
  { id: '2026#36', supports: ['meaning', 'simple', 'preserve', 'relation', 'whole'], stage: 'C3' },
  { id: '2026#22', supports: ['meaning', 'simple', 'preserve', 'relation', 'whole'], stage: 'C3' },
  { id: '2026#23', supports: ['meaning', 'simple', 'preserve', 'relation', 'whole'], stage: 'C3' },
  { id: '2026#29', supports: ['meaning', 'simple', 'preserve', 'syntax', 'whole'], stage: 'C3' },
  { id: '2026#25', supports: ['meaning', 'simple', 'preserve'], stage: 'C3', note: '도표 본체가 입력에 없다 — 언어 명제만 공개 후보, 수치 판단은 원본 도표 확인 전 보류' },
  { id: '2026#43', supports: ['meaning', 'simple', 'preserve', 'relation', 'whole'], stage: 'C3', note: '43~45 공유 장문 — 44 · 45 는 이번 파일럿 밖' },
]

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))
const listOf = (o) => (Array.isArray(o) ? o : o.items ?? [])
const pub = readJson(join(ROOT, 'apps/web/src/lib/csat/inquiry-data.json')).items

// 원문 입력 — 같은 id 는 먼저 찾은 파일(이름 순)을 inputRef 로
const inputs = new Map()
if (existsSync(join(ROOT, SRC))) {
  for (const f of readdirSync(join(ROOT, SRC)).filter((f) => /^chunk-(inq|v3)-[\w-]+\.json$/.test(f) && !f.includes('.out.')).sort()) {
    for (const it of listOf(readJson(join(ROOT, SRC, f)))) if (!inputs.has(it.id)) inputs.set(it.id, { it, ref: `inquiry-origin:${f.replace(/\.json$/, '')}` })
  }
}

const OUTDIR = join(ROOT, dirname(MANIFEST))
const items = []
for (const p of PILOT) {
  const rec = pub[p.id]
  const src = inputs.get(p.id)
  const row = { itemId: p.id, stage: p.stage, plannedSupports: p.supports }
  if (!rec || rec.review !== 'verified' || !rec.v3) { items.push({ ...row, status: 'needs_review', reason: '공개 v3(verified) 없음' }); continue }
  row.type = src?.it.type_id ?? null
  row.binding = { analysisVersion: rec.analysis_version, unitsHash: rec.v3.units_hash, basePublicHash: basePublicHash(rec) }
  if (!src) { items.push({ ...row, status: 'needs_source', reason: '로컬 원문 입력 없음 — 기존 설명에서 원문을 복원하지 않는다' }); continue }
  const hasChart = row.type === 'R-CHART'
  row.binding.sourceSnapshotHash = sourceSnapshotHash(src.it, { chartChecked: false })
  row.inputRef = src.ref
  row.sentences = src.it.sentences.length
  row.chart = hasChart ? { inputHasChartBody: false, chartChecked: false } : null
  row.quoteBaseline = quoteBaseline(src.it, rec)
  row.legacyMeanings = rec.v3.meanings.length
  row.status = 'ok'
  if (p.note) row.note = p.note
  items.push(row)
  if (!DRY) {
    mkdirSync(OUTDIR, { recursive: true })
    const it = src.it
    writeFileSync(join(OUTDIR, `input-${p.id.replace('#', '-')}.json`), JSON.stringify({
      itemId: p.id, type: it.type_id, inputRef: src.ref, binding: row.binding, chart: row.chart,
      stem: it.stem, answer: it.answer, sentences: it.sentences, choices: it.choices,
      v3: { requirement: rec.v3.requirement, meanings: rec.v3.meanings, choices: rec.v3.choices, design: rec.v3.design },
      distractors: rec.distractors, principle: rec.principle,
    }, null, 1))
  }
}

// 파일럿 계약(공개 대상 명시 목록)은 사람이 정한다 — 다시 뽑아도 기존 manifest 의 contract 를 그대로 둔다
const prevManifest = existsSync(join(ROOT, MANIFEST)) ? JSON.parse(readFileSync(join(ROOT, MANIFEST), 'utf8')) : null
const manifest = {
  contract: prevManifest?.contract ?? null,
  note: 'v3.1 원문 이해 교수 파일럿 manifest — meaning-support-export.mjs 가 생성. 원문 본문 없음(결속 · 기준선만).',
  basis: '커밋된 공개 inquiry-data.json + 로컬 원문 입력(비공개). live DB 통계 아님',
  sourceRoot: relative(ROOT, join(ROOT, SRC)).replace(/\\/g, '/'),
  items,
}
const out = JSON.stringify(manifest, null, 1) + '\n'
if (!DRY) { mkdirSync(OUTDIR, { recursive: true }); writeFileSync(join(ROOT, MANIFEST), out) }
for (const r of items) console.log(`${r.itemId} ${r.type ?? '-'} ${r.status} av${r.binding?.analysisVersion ?? '-'} sents ${r.sentences ?? '-'} quote ${r.quoteBaseline ? `${r.quoteBaseline.quoteWords}w ${(r.quoteBaseline.ratio * 100).toFixed(1)}%` : '-'}`)
console.log(`${DRY ? '(dry) ' : ''}manifest ${items.length}문항 · ok ${items.filter((r) => r.status === 'ok').length}`)
