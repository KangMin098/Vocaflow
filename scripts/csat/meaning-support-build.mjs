// scripts/csat/meaning-support-build.mjs
//
// v3.1 교수 sidecar 공개 빌드 → apps/web/src/lib/csat/meaning-support-data.json (서버 전용 import).
//   node scripts/csat/meaning-support-build.mjs --manifest scripts/csat/meaning-support-drain/pilot-manifest.json [--dry] [--allow-drop <id,…>]
//
// 넣는 조건(모두): 작성 status ok · 기계 검증 오류 0 · **원문 입력이 있고 원문 대조 통과**(full build) ·
//   현재 contentHash 에 묶인 **독립 pass**(writer ≠ reviewer · criteria meaning-support-v1.0 · 같은 hash 에 revise/hold 없음) ·
//   binding(analysisVersion · unitsHash · basePublicHash)이 **지금 배포된 inquiry 레코드**와 같음.
// --dry: 파일을 쓰지 않고 사유별 수(added · unchanged · stale · review_hold · revise · unreviewed · missing_input · invalid)를 출력.
// 안전: 원문 입력이 없으면 실패하고 기존 산출물을 보존한다(입력 없음 때문에 공개 자료가 사라지지 않게).
//   지금 공개된 문항이 이번 빌드에서 빠지면 실패한다(--allow-drop 으로 명시한 문항만 예외). manifest 밖 기존 항목은 보존한다.
//   같은 입력이면 byte-identical · 임시 파일 → rename 으로 원자적 교체. DB 를 읽거나 쓰지 않는다.
import { readFileSync, readdirSync, writeFileSync, existsSync, renameSync } from 'node:fs'
import { join } from 'node:path'

import { classifyReview } from './lib-inquiry-review.mjs'
import { canonicalJson, decidePublic, MS_CRITERIA_VERSION, SCHEMA } from './lib-meaning-support.mjs'
import { checkItem } from './meaning-support-validate.mjs'

const ROOT = process.cwd()
const DIR = join(ROOT, 'scripts/csat/meaning-support-drain')
const OUT = join(ROOT, 'apps/web/src/lib/csat/meaning-support-data.json')
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d }
const MANIFEST = arg('--manifest', 'scripts/csat/meaning-support-drain/pilot-manifest.json')
const DRY = process.argv.includes('--dry')
const ALLOW_DROP = new Set(String(arg('--allow-drop', '')).split(',').filter(Boolean))
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))
const slug = (id) => id.replace('#', '-')

const pub = readJson(join(ROOT, 'apps/web/src/lib/csat/inquiry-data.json')).items
const manifest = readJson(join(ROOT, MANIFEST))
const prev = existsSync(OUT) ? readJson(OUT) : { items: {} }

const verdictsOf = new Map()
for (const f of readdirSync(DIR).filter((f) => /^review-[\w-]+\.json$/.test(f))) {
  const r = readJson(join(DIR, f))
  for (const v of r.verdicts ?? []) {
    const l = verdictsOf.get(v.itemId) ?? []
    l.push({ verdict: v.verdict, reviewer: v.reviewer ?? r.reviewer, content_hash: v.content_hash, criteria: v.criteria ?? r.criteria, file: f })
    verdictsOf.set(v.itemId, l)
  }
}

const reasons = { added: [], unchanged: [], stale: [], review_hold: [], revise: [], unreviewed: [], missing_input: [], invalid: [], not_ok: [], missing: [] }
const next = { ...prev.items } // manifest 밖 기존 항목 보존
for (const m of manifest.items) {
  const id = m.itemId
  const r = checkItem(id, { pub, requireInput: true })
  if (r.status === 'missing') { reasons.missing.push(id); delete next[id]; continue }
  if (r.status !== 'ok') { reasons.not_ok.push(`${id}(${r.status})`); delete next[id]; continue }
  if (r.errs.some((x) => x.includes('원문 입력 없음'))) { reasons.missing_input.push(id); continue } // 기존 공개분 보존(next 그대로)
  if (r.errs.length) { reasons.invalid.push(`${id}(${r.errs.length})`); delete next[id]; continue }
  const out = readJson(join(DIR, `support-${slug(id)}.out.json`))
  const d = decidePublic(out, verdictsOf.get(id) ?? [], pub[id], classifyReview)
  if (d.state !== 'public') { reasons[d.state === 'not_ok' ? 'not_ok' : d.state].push(d.state === 'unreviewed' ? `${id}(${d.reason})` : id); delete next[id]; continue }
  const s = out.support
  const hash = d.hash
  const c = { reason: d.reason }
  const entry = { ...s, review: { criteria: MS_CRITERIA_VERSION, contentHash: hash, reviewer: c.reason.replace(/ pass$/, '') } }
  ;(prev.items[id] && canonicalJson(prev.items[id]) === canonicalJson(entry) ? reasons.unchanged : reasons.added).push(id)
  next[id] = entry
}

// 지금 공개된 문항이 빠지면 실패(설명이 조용히 사라지는 회귀 차단)
const dropped = Object.keys(prev.items).filter((id) => !next[id] && !ALLOW_DROP.has(id))
const sorted = Object.fromEntries(Object.keys(next).sort().map((k) => [k, next[k]]))
const data = { note: 'v3.1 원문 이해 교수 sidecar — scripts/csat/meaning-support-build.mjs 가 생성. 손으로 고치지 말 것. 서버 전용(클라이언트 import 금지).', schema: SCHEMA, criteria: MS_CRITERIA_VERSION, count: Object.keys(sorted).length, items: sorted }
const text = JSON.stringify(data, null, 1) + '\n'
const head = Object.entries(reasons).filter(([, a]) => a.length).map(([k, a]) => `${k} ${a.length}`).join(' · ')
console.log(`공개 ${data.count} · ${head || '변화 없음'}${DRY ? ' (dry — 파일 안 씀)' : ''}`)
for (const [k, a] of Object.entries(reasons)) if (a.length && !['added', 'unchanged'].includes(k)) console.log(`  ${k}: ${a.join(' ')}`)
if (dropped.length) { console.error(`공개 중이던 문항이 빠진다: ${dropped.join(' ')} — 원인을 고치거나 --allow-drop 으로 명시`); process.exit(1) }
if (!DRY) {
  if (existsSync(OUT) && readFileSync(OUT, 'utf8') === text) process.exit(0)
  const tmp = `${OUT}.tmp`
  writeFileSync(tmp, text)
  renameSync(tmp, OUT)
}
