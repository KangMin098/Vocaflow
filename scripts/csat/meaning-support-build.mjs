// scripts/csat/meaning-support-build.mjs
//
// v3.1 교수 sidecar 공개 빌드 → apps/web/src/lib/csat/meaning-support-data.json (서버 전용 import).
//   node scripts/csat/meaning-support-build.mjs --manifest scripts/csat/meaning-support-drain/pilot-manifest.json [--dry] [--allow-drop <id,…>]
//
// 넣는 조건(모두): 작성 status ok · 기계 검증 오류 0 · **원문 입력이 있고 원문 대조 통과**(full build) ·
//   현재 contentHash 에 묶인 **독립 pass**(writer ≠ reviewer · criteria meaning-support-v1.0 · 같은 hash 에 revise/hold 없음) ·
//   binding(analysisVersion · unitsHash · basePublicHash)이 **지금 배포된 inquiry 레코드**와 같음.
// --dry: 파일을 쓰지 않고 사유별 수(added · unchanged · stale · review_hold · revise · unreviewed · missing_input · invalid)를 출력.
// 안전: 원문 입력이 하나라도 없으면 full build · --dry 모두 exit 1, 기존 산출물은 byte-identical 로 둔다(쓰기 전에 멈춘다).
// 파일럿 계약: manifest.contract.expectedPublic(명시 목록)이 비어 있거나, 그 문항이 이번 빌드에서 공개되지 않으면 실패한다.
//   공개 항목에는 원문 입력에서 만든 대조 자료(alignment — 글자 지문 · 오프셋, 영어 본문 없음)를 붙인다.
//   지금 공개된 문항이 이번 빌드에서 빠지면 실패한다(--allow-drop 으로 명시한 문항만 예외). manifest 밖 기존 항목은 보존한다.
//   같은 입력이면 byte-identical · 임시 파일 → rename 으로 원자적 교체. DB 를 읽거나 쓰지 않는다.
import { readFileSync, readdirSync, writeFileSync, existsSync, renameSync } from 'node:fs'
import { join } from 'node:path'

import { classifyReview } from './lib-inquiry-review.mjs'
import { buildAlignment, canonicalJson, checkPilotContract, decidePublic, MS_CRITERIA_VERSION, SCHEMA } from './lib-meaning-support.mjs'
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
  if (r.errs.some((x) => x.includes('원문 입력 없음'))) { reasons.missing_input.push(id); continue } // 아래에서 쓰기 전에 실패
  if (r.errs.length) { reasons.invalid.push(`${id}(${r.errs.length})`); delete next[id]; continue }
  const out = readJson(join(DIR, `support-${slug(id)}.out.json`))
  const d = decidePublic(out, verdictsOf.get(id) ?? [], pub[id], classifyReview)
  if (d.state !== 'public') { reasons[d.state === 'not_ok' ? 'not_ok' : d.state].push(d.state === 'unreviewed' ? `${id}(${d.reason})` : id); delete next[id]; continue }
  const s = out.support
  const hash = d.hash
  const c = { reason: d.reason }
  let alignment
  try { alignment = buildAlignment(s, readJson(join(DIR, `input-${slug(id)}.json`))) } catch (e) { reasons.invalid.push(`${id}(대조 자료: ${e.message})`); delete next[id]; continue }
  const entry = { ...s, review: { criteria: MS_CRITERIA_VERSION, contentHash: hash, reviewer: c.reason.replace(/ pass$/, '') }, alignment }
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
// 원문 입력 누락 — 대조 · 원문 확인 없이 공개 자료를 만들거나 지우지 않는다
if (reasons.missing_input.length) { console.error(`원문 입력이 없다: ${reasons.missing_input.join(' ')} — node scripts/csat/meaning-support-export.mjs 로 다시 뽑는다(산출물은 그대로 둠)`); process.exit(1) }
// 파일럿 계약 — 명시 목록의 문항이 모두 공개돼야 한다(빈 계약 · 누락은 실패)
const expected = manifest.contract?.expectedPublic ?? []
if (!manifest.contract?.id || !expected.length) { console.error('manifest.contract(id · expectedPublic)가 없다 — 공개 대상을 명시해야 한다'); process.exit(1) }
const unlisted = expected.filter((id) => !manifest.items.some((m) => m.itemId === id))
const absent = expected.filter((id) => !next[id])
if (unlisted.length || absent.length) { console.error(`파일럿 계약(${manifest.contract.id}) 위반 — manifest 밖: ${unlisted.join(' ') || '없음'} · 공개 안 됨: ${absent.join(' ') || '없음'}`); process.exit(1) }
const contractErrs = checkPilotContract(manifest, data)
if (contractErrs.length) { console.error(`파일럿 계약 위반: ${contractErrs.join(' · ')}`); process.exit(1) }
if (dropped.length) { console.error(`공개 중이던 문항이 빠진다: ${dropped.join(' ')} — 원인을 고치거나 --allow-drop 으로 명시`); process.exit(1) }
if (!DRY) {
  if (existsSync(OUT) && readFileSync(OUT, 'utf8') === text) process.exit(0)
  const tmp = `${OUT}.tmp`
  writeFileSync(tmp, text)
  renameSync(tmp, OUT)
}
