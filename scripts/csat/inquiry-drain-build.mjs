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
//   · 독립 검수의 마지막 판정이 revise 가 아니다(review-*.json 을 이름 순으로 읽어 문항마다 마지막 판정 — 재검수는 review-zz-*.json)
// 원문(지문 · 선지)은 출력에 넣지 않는다 — 작성자가 쓴 짧은 인용(8단어 이하)만 들어간다.
// 재실행 안전: 같은 입력이면 같은 출력(문항 id 정렬). 파일을 통째로 다시 쓴다.
//
//   node scripts/csat/inquiry-drain-build.mjs [--dry]

import fs from 'node:fs'
import path from 'node:path'

import { validateItem } from './inquiry-drain-validate.mjs'

const WORK = path.resolve('scripts/csat/inquiry-drain')
const OUT = path.resolve('apps/web/src/lib/csat/inquiry-data.json')
const DRY = process.argv.includes('--dry')

// 문항마다 **마지막** 검수 판정을 쓴다(파일 이름 순) — 고쳐 쓴 뒤의 재검수(review-zz-*.json)가 처음 판정을 덮는다
const lastVerdict = new Map()
for (const f of fs.readdirSync(WORK).filter((f) => /^review-.*\.json$/.test(f)).sort()) {
  for (const v of JSON.parse(fs.readFileSync(path.join(WORK, f), 'utf8')).verdicts ?? []) lastVerdict.set(v.id, v.verdict)
}
const revised = new Set([...lastVerdict].filter(([, v]) => v === 'revise').map(([id]) => id))

const items = {}
const dropped = { status: [], invalid: [], revised: [], no_input: [] }
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
    if (revised.has(r.id)) {
      dropped.revised.push(r.id)
      continue
    }
    items[r.id] = {
      analysis_version: r.analysis_version,
      distractors: r.distractors
        .map((d) => ({ n: d.n, truth: d.truth, operation: d.operation, preserved: d.preserved ?? [], altered: d.altered ?? [], note: d.note }))
        .sort((a, b) => a.n - b.n),
      principle: r.principle ? { statement: r.principle.statement, when_applies: r.principle.when_applies, when_not: r.principle.when_not } : null,
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
console.log(`넣음 ${doc.count} · 뺌: status ${dropped.status.length} · 검증 오류 ${dropped.invalid.length} · 검수 revise ${dropped.revised.length} · 입력 없음 ${dropped.no_input.length}${DRY ? ' (dry — 파일 안 씀)' : ''}`)
for (const [k, v] of Object.entries(dropped)) if (v.length) console.log(`  ${k}: ${v.slice(0, 30).join(' ')}${v.length > 30 ? ' …' : ''}`)
