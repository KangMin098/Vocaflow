// scripts/csat/compare-v3-build.mjs
//
// v3 비교 쌍 공개 빌드 — 작성 결과(chunk-v3p-*.out.json) 중 **현재 내용 해시에 묶인 독립 pass** 만,
// 그리고 양쪽 문항이 지금도 공개 v3(verified)이고 결속 해시(units_hash · inquiry_hash)가 현재 탐구와 같은 쌍만
// apps/web/src/lib/csat/compare-v3-data.json 으로 낸다. 뺀 수와 이유를 출력한다. 재실행 안전(통째로 다시 쓴다).
//   node scripts/csat/compare-v3-build.mjs [--dry]       공개 빌드(--dry: 파일 안 씀)
//   node scripts/csat/compare-v3-build.mjs --hash v3p-01  검수자용: 청크의 쌍별 현재 해시 · writer_run
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

import { classifyReview, contentHash, pairContentHash, PAIR_CRITERIA_VERSION } from './lib-inquiry-review.mjs'
import { buildPairTypeIndex, isInquiryInputFilename, requirePairTypes } from './lib-compare-types.mjs'

const ROOT = process.cwd()
const CDIR = join(ROOT, 'scripts/csat/compare-drain')
const IDIR = join(ROOT, 'scripts/csat/inquiry-drain')
const OUT = join(ROOT, 'apps/web/src/lib/csat/compare-v3-data.json')
const DRY = process.argv.includes('--dry')
const hi = process.argv.indexOf('--hash')

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))
const listOf = (o) => (Array.isArray(o) ? o : o.items ?? [])

// 작성 결과(쌍) — writer_run 은 파일 머리값
const pairs = []
for (const f of readdirSync(CDIR).filter((f) => /^chunk-v3p-\d+\.out\.json$/.test(f)).sort()) {
  const o = readJson(join(CDIR, f))
  for (const p of o.pairs ?? []) pairs.push({ ...p, writer_run: p.writer_run ?? o.writer_run, chunk: o.chunk })
}

if (hi > 0) {
  const name = process.argv[hi + 1]
  for (const p of pairs.filter((p) => p.chunk === name)) console.log(JSON.stringify({ pair_id: p.pair_id, hash: pairContentHash(p), writer_run: p.writer_run, status: p.status }))
  process.exit(0)
}

// 판정 — review-v3p-*.json { reviewer, criteria, verdicts:[{pair_id, verdict, content_hash, why}] }
const verdictsOf = new Map()
for (const f of readdirSync(CDIR).filter((f) => /^review-v3p-[\w-]+\.json$/.test(f))) {
  const r = readJson(join(CDIR, f))
  for (const v of r.verdicts ?? []) {
    const list = verdictsOf.get(v.pair_id) ?? []
    list.push({ verdict: v.verdict, reviewer: v.reviewer ?? r.reviewer, content_hash: v.content_hash, criteria: v.criteria ?? r.criteria, file: f })
    verdictsOf.set(v.pair_id, list)
  }
}

// 현재 탐구 — 공개 상태 + 작성 결과 해시(결속 확인)
const pub = readJson(join(ROOT, 'apps/web/src/lib/csat/inquiry-data.json')).items
const outs = new Map()
for (const f of readdirSync(IDIR).filter((f) => /^chunk-(inq|v3)-[\w-]+\.out\.json$/.test(f)).sort()) {
  for (const it of listOf(readJson(join(IDIR, f)))) {
    const prev = outs.get(it.id)
    if (!prev || (it.v3 && !prev.v3) || f.startsWith('chunk-v3')) outs.set(it.id, it)
  }
}

// 상대 공개 조회도 이 골격 유형을 쓴다. 원문 입력은 gitignore이므로 깨끗한 checkout에서도 유형을 복구할 수 있어야 한다.
const skeletonDir = join(ROOT, 'apps/web/src/lib/csat/skeleton-data')
const skeletonDocs = readdirSync(skeletonDir).filter((f) => f.endsWith('.json') && f !== 'index.json').map((f) => readJson(join(skeletonDir, f)))
const inputDocs = readdirSync(IDIR).filter(isInquiryInputFilename).map((f) => readJson(join(IDIR, f)))
const typeOf = buildPairTypeIndex(skeletonDocs, inputDocs)

const skip = { not_ok: [], revise: [], unreviewed: [], stale: [], not_public: [] }
const keep = []
for (const p of pairs) {
  if (p.status !== 'ok') { skip.not_ok.push(`${p.pair_id}(${p.status})`); continue }
  const c = classifyReview(p, verdictsOf.get(p.pair_id) ?? [], { criteria: PAIR_CRITERIA_VERSION, hashOf: pairContentHash })
  if (c.state === 'revise') { skip.revise.push(p.pair_id); continue }
  if (c.state !== 'verified') { skip.unreviewed.push(`${p.pair_id}(${c.reason})`); continue }
  const sides = [p.left, p.right]
  if (sides.some((s) => pub[s.id]?.review !== 'verified' || !pub[s.id]?.v3)) { skip.not_public.push(p.pair_id); continue }
  const stale = sides.some((s) => pub[s.id].v3.units_hash !== s.units_hash || !outs.has(s.id) || contentHash(outs.get(s.id)) !== s.inquiry_hash)
  if (stale) { skip.stale.push(p.pair_id); continue }
  keep.push(p)
}

// 공개 형태 — pair 본문은 한 번, 문항 → pair_id 색인. 원문은 넣지 않는다(문장 번호만)
const data = { note: 'v3 비교 쌍 — scripts/csat/compare-v3-build.mjs 가 생성. 손으로 고치지 말 것.', criteria: PAIR_CRITERIA_VERSION, count: keep.length, pairs: {}, items: {} }
for (const p of keep.sort((a, b) => a.pair_id.localeCompare(b.pair_id))) {
  data.pairs[p.pair_id] = {
    kind: p.kind, focus: p.focus, left: p.left.id, right: p.right.id, types: requirePairTypes(p, typeOf), mappings: p.mappings, shared_conditions: p.shared_conditions ?? [],
    decisive_differences: p.decisive_differences ?? [], principle: p.principle ?? null, limitation: p.limitation,
    binding: { left: { units_hash: p.left.units_hash, inquiry_hash: p.left.inquiry_hash }, right: { units_hash: p.right.units_hash, inquiry_hash: p.right.inquiry_hash } },
  }
  for (const id of [p.left.id, p.right.id]) (data.items[id] ??= []).push(p.pair_id)
}

const head = (a) => a.slice(0, 20).join(' ') + (a.length > 20 ? ' …' : '')
console.log(`넣음 ${keep.length} · 뺌: 작성 상태 ${skip.not_ok.length} · revise ${skip.revise.length} · 미검수 ${skip.unreviewed.length} · stale ${skip.stale.length} · 상대 비공개 ${skip.not_public.length}${DRY ? ' (dry — 파일 안 씀)' : ''}`)
for (const [k, a] of Object.entries(skip)) if (a.length) console.log(`  ${k}: ${head(a)}`)
if (!DRY) writeFileSync(OUT, JSON.stringify(data, null, 1) + '\n')
if (!DRY && !existsSync(OUT)) process.exit(1)
