// scripts/csat/inquiry-drain-build.mjs
//
// **탐구 데이터 빌드 — 검증 · 검수를 지난 문항만 정적 정본으로.** (vNext2 · inquiry v1)
//
// 입력: scripts/csat/inquiry-drain/chunk-inq-NN.json(원문 · 로컬 전용) + .out.json(작성) + review-*.json(독립 검수, 선택)
// 출력: apps/web/src/lib/csat/inquiry-data.json — 화면이 분석 버전으로 대조해 쓴다(lib/csat/inquiry/data.ts).
//
// 넣는 조건(하나라도 어기면 뺀다 · 뺀 수와 이유를 출력한다):
//   · status = ok  (needs_review · needs_source 는 화면에 내지 않는다 — 분석 교정 공정의 몫)
//   · 검증기 오류 0  (inquiry-drain-validate 의 validateItem 을 그대로 다시 돌린다)
//   · 공개 가드(lib-inquiry-review.mjs · v3 M2) — verified(현재 내용 해시에 묶인 독립 pass · 검수자≠작성자 · 기준 버전 일치)
//     또는 legacy(해시 결속 없는 v1 판정의 마지막이 revise 아님 — 2026-10-11 이전 공개분 보존용)만 넣는다.
//     revise · unreviewed 는 뺀다. 각 문항에 `review: verified|legacy` 를 기록해 화면이 둘을 구별한다(legacy 를 verified 로 승격하지 않는다).
//     `--verified-only` 면 legacy 도 뺀다(v3 공개 빌드).
// 원문(지문 · 선지)은 출력에 넣지 않는다 — 작성자가 쓴 짧은 인용(8단어 이하)만 들어간다.
// 재실행 안전: 같은 입력이면 같은 출력(문항 id 정렬). 파일을 통째로 다시 쓴다.
//
//   node scripts/csat/inquiry-drain-build.mjs [--dry]

import fs from 'node:fs'
import path from 'node:path'

import { validateItem, validateV3 } from './inquiry-drain-validate.mjs'
import { classifyReview } from './lib-inquiry-review.mjs'

const WORK = path.resolve('scripts/csat/inquiry-drain')
const OUT = path.resolve('apps/web/src/lib/csat/inquiry-data.json')
const DRY = process.argv.includes('--dry')
const VERIFIED_ONLY = process.argv.includes('--verified-only')

// 문항 → 모든 판정(파일 이름 · 검수자 · 해시 · 기준 버전 포함). 판정 결과는 classifyReview 가 해시에 묶어 정한다
const verdictsById = new Map()
for (const f of fs.readdirSync(WORK).filter((f) => /^review-.*\.json$/.test(f))) {
  const doc = JSON.parse(fs.readFileSync(path.join(WORK, f), 'utf8'))
  for (const v of doc.verdicts ?? []) {
    const list = verdictsById.get(v.id) ?? []
    list.push({ ...v, reviewer: v.reviewer ?? doc.reviewer ?? null, criteria: v.criteria ?? doc.criteria ?? null, file: f })
    verdictsById.set(v.id, list)
  }
}

const items = {}
const dropped = { status: [], invalid: [], revised: [], unreviewed: [], legacy_excluded: [], no_input: [] }
const reviewCount = { verified: 0, legacy: 0 }
for (const f of fs.readdirSync(WORK).filter((f) => /^chunk-inq-\d+\.out\.json$/.test(f)).sort()) {
  const name = f.replace(/\.out\.json$/, '')
  const inPath = path.join(WORK, `${name}.json`)
  const out = JSON.parse(fs.readFileSync(path.join(WORK, f), 'utf8'))
  if (!fs.existsSync(inPath)) {
    dropped.no_input.push(...(out.items ?? []).map((r) => r.id))
    continue
  }
  const inputs = new Map(JSON.parse(fs.readFileSync(inPath, 'utf8')).items.map((it) => [it.id, it]))
  for (const r of out.items ?? []) {
    if (r.status !== 'ok') {
      dropped.status.push(`${r.id}(${r.status})`)
      continue
    }
    const input = inputs.get(r.id)
    const errs = input ? validateItem(input, r) : ['입력 없음']
    if (errs.length) {
      dropped.invalid.push(`${r.id}(${errs.length})`)
      continue
    }
    // 작성 run 은 문항 또는 출력 최상위 — 검수자와 같은지 공개 가드가 본다
    const review = classifyReview({ ...r, writer_run: r.writer_run ?? out.writer_run }, verdictsById.get(r.id) ?? [])
    if (review.state === 'revise') {
      dropped.revised.push(r.id)
      continue
    }
    if (review.state === 'unreviewed') {
      dropped.unreviewed.push(`${r.id}(${review.reason})`)
      continue
    }
    if (review.state === 'legacy' && VERIFIED_ONLY) {
      dropped.legacy_excluded.push(r.id)
      continue
    }
    reviewCount[review.state] += 1
    items[r.id] = {
      analysis_version: r.analysis_version,
      review: review.state,
      distractors: r.distractors
        .map((d) => ({ n: d.n, truth: d.truth, operation: d.operation, preserved: d.preserved ?? [], altered: d.altered ?? [], note: d.note }))
        .sort((a, b) => a.n - b.n),
      principle: r.principle ? { statement: r.principle.statement, when_applies: r.principle.when_applies, when_not: r.principle.when_not } : null,
    }
  }
}

// ── v3 출력(chunk-v3-NN) — 독립 검수(verified)일 때만 그 문항의 기록을 v3 로 대체한다. 그 밖에는 v1 기록을 그대로 둔다 ──
// v3 칸은 legacy 경로로 절대 공개하지 않는다(v3 계획 §5). 검증기(v1 + v3) 오류가 하나라도 있으면 싣지 않는다.
dropped.v3_unverified = []
dropped.v3_invalid = []
let v3Count = 0
for (const f of fs.readdirSync(WORK).filter((f) => /^chunk-v3-\d+\.out\.json$/.test(f)).sort()) {
  const name = f.replace(/\.out\.json$/, '')
  const inPath = path.join(WORK, `${name}.json`)
  const out = JSON.parse(fs.readFileSync(path.join(WORK, f), 'utf8'))
  if (!fs.existsSync(inPath)) {
    dropped.no_input.push(...(out.items ?? []).map((r) => `${r.id}(v3)`))
    continue
  }
  const inputs = new Map(JSON.parse(fs.readFileSync(inPath, 'utf8')).items.map((it) => [it.id, it]))
  for (const r of out.items ?? []) {
    const input = inputs.get(r.id)
    if (r.status !== 'ok' || !input) continue
    const errs = [...validateItem(input, r), ...validateV3(input, r)]
    if (errs.length) {
      dropped.v3_invalid.push(`${r.id}(${errs.length})`)
      continue
    }
    const review = classifyReview({ ...r, writer_run: r.writer_run ?? out.writer_run }, verdictsById.get(r.id) ?? [])
    if (review.state !== 'verified') {
      dropped.v3_unverified.push(`${r.id}(${review.reason})`)
      continue
    }
    if (items[r.id]?.review) reviewCount[items[r.id].review] -= 1
    reviewCount.verified += 1
    v3Count += 1
    items[r.id] = {
      analysis_version: r.analysis_version,
      review: 'verified',
      distractors: r.distractors
        .map((d) => ({ n: d.n, truth: d.truth, operation: d.operation, preserved: d.preserved ?? [], altered: d.altered ?? [], note: d.note }))
        .sort((a, b) => a.n - b.n),
      principle: r.principle ? { statement: r.principle.statement, when_applies: r.principle.when_applies, when_not: r.principle.when_not } : null,
      v3: { sentence_count: input.sentences.length, ...r.v3 },
    }
  }
}

const sorted = Object.fromEntries(Object.entries(items).sort(([a], [b]) => a.localeCompare(b)))
const doc = {
  note: 'vNext2 탐구 데이터 — scripts/csat/inquiry-drain-build.mjs 가 생성. 손으로 고치지 말 것(재생성에 덮인다).',
  contract: 'docs/csat-learner/ITEM_INQUIRY_V2_CONTRACT.md',
  count: Object.keys(sorted).length,
  items: sorted,
}
if (!DRY) fs.writeFileSync(OUT, JSON.stringify(doc, null, 1) + '\n')
console.log(`넣음 ${doc.count}(verified ${reviewCount.verified} · legacy ${reviewCount.legacy}) · 뺌: status ${dropped.status.length} · 검증 오류 ${dropped.invalid.length} · 검수 revise ${dropped.revised.length} · 미검수 ${dropped.unreviewed.length} · legacy 제외 ${dropped.legacy_excluded.length} · v3 수록 ${v3Count} · v3 미검수 ${dropped.v3_unverified.length} · v3 검증 오류 ${dropped.v3_invalid.length} · 입력 없음 ${dropped.no_input.length}${DRY ? ' (dry — 파일 안 씀)' : ''}`)
for (const [k, v] of Object.entries(dropped)) if (v.length) console.log(`  ${k}: ${v.slice(0, 30).join(' ')}${v.length > 30 ? ' …' : ''}`)
