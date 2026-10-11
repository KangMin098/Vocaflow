// scripts/csat/inquiry-drain-export.mjs
//
// **출제 사고 탐구 데이터(vNext2 · inquiry) — 청크를 뽑는다.** 3단: 이 export → 에이전트(.out.json) → inquiry-drain-validate → inquiry-drain-build.
//
// 문항마다 채울 것(계약: docs/csat-learner/ITEM_INQUIRY_V2_CONTRACT.md):
//   오답 설계(S4)  선지마다 유지한 성분 · 바뀐 성분(무엇 → 무엇) · 변환 종류 · 내용 참/거짓
//   공통 원리(S5)  이 문항이 지지하는 조건부 원리 · 성립 조건 · 적용하면 안 되는 조건
// 결과는 DB 가 아니라 **분석 버전에 묶인 정적 JSON** 으로 간다(apps/web/src/lib/csat/inquiry-data.json) —
// 분석이 새 버전이 되면 그 문항의 탐구 데이터는 화면에서 빠진다(stale). DB 정본 · 검수 상태를 건드리지 않는다.
//
// 청크에는 원문(지문 · 선지 · 발문)이 들어간다 — 작성자가 원문과 대조해야 하기 때문이다. 그래서 청크는 커밋하지 않는다
// (.gitignore `scripts/csat/inquiry-drain/chunk-*.json`). 커밋하는 것은 검수를 지난 한국어 결과(.out.json)뿐이다.
//
// 재실행 안전: 같은 분석 버전으로 이미 채운 문항(.out.json)은 건너뛴다. 기존 청크 · 출력은 덮지 않는다(새 청크 번호로 이어 쓴다).
// 범위: 평가원 in_scope 최신 발행 분석. 학평은 이 공정에 아직 넣지 않는다(2026-10-11 사용자 결정 — 학평 검수는 주간 한도 말미).
//
//   node -r dotenv/config node_modules/tsx/dist/cli.mjs scripts/csat/inquiry-drain-export.mjs [--size 25] [--limit N]

import fs from 'node:fs'
import path from 'node:path'
import { isKiceExam } from './lib-exam-id.mjs'

for (const f of ['apps/web/.env.local', '.env.local']) {
  try {
    for (const line of fs.readFileSync(path.resolve(f), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch {
    /* 없으면 다음 후보 */
  }
}

const arg = (name, dflt) => {
  const i = process.argv.indexOf(name)
  return i >= 0 ? Number(process.argv[i + 1]) : dflt
}
const SIZE = arg('--size', 25)
const LIMIT = arg('--limit', Infinity)
const WORK = path.resolve('scripts/csat/inquiry-drain')
fs.mkdirSync(WORK, { recursive: true })

const { createClient } = await import('@supabase/supabase-js')
const { distractorsAreTrue } = await import('../../apps/web/src/lib/csat/teaching-contract.ts')
const { splitSentences } = await import('../../apps/web/src/lib/csat/passage-skeleton.ts')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// keyset(id) 페이징 — 뒤 페이지가 앞을 다시 훑는 OFFSET 을 쓰지 않는다(offset-paging-budget)
async function page(table, sel, tune = (q) => q) {
  const out = []
  for (let last = null; ; ) {
    let q = tune(db.from(table).select(`id, ${sel}`)).order('id').limit(500)
    if (last !== null) q = q.gt('id', last)
    const { data, error } = await q
    if (error) throw new Error(`${table}: ${error.message}`)
    out.push(...data)
    if (data.length < 500) break
    last = data[data.length - 1].id
  }
  return out
}

const items = (await page('csat_items', 'exam_id, type_id, in_scope, stem, passage, choices, answer')).filter(
  (r) => isKiceExam(r.exam_id) && r.in_scope,
)
const rows = await page('csat_item_analyses', 'item_id, version, answer_unknown, measured_ability, design_intent, answer_locus, choice_analysis', (q) =>
  q.eq('status', 'published'),
)
const SLOT_TYPES = new Set(['R-IRRELEVANT', 'R-INSERT', 'R-ORDER', 'X-ORDER', 'R-REFER', 'X-REFER'])
const latest = new Map()
for (const r of rows) if ((latest.get(r.item_id)?.version ?? -1) < r.version) latest.set(r.item_id, r)

// 이미 채운 문항(같은 분석 버전) — 버전이 바뀐 문항은 다시 뽑는다
const done = new Map()
for (const f of fs.readdirSync(WORK).filter((f) => f.endsWith('.out.json'))) {
  for (const r of JSON.parse(fs.readFileSync(path.join(WORK, f), 'utf8')).items ?? []) done.set(r.id, r.analysis_version)
}

let noAnalysis = 0
let skipped = 0
const todo = []
for (const it of items.sort((a, b) => a.id.localeCompare(b.id))) {
  const a = latest.get(it.id)
  if (!a) {
    noAnalysis += 1
    continue
  }
  if (done.get(it.id) === a.version) {
    skipped += 1
    continue
  }
  const passage = it.passage ?? ''
  todo.push({
    id: it.id,
    type_id: it.type_id,
    analysis_version: a.version,
    // 부정형 선택(어법 · 내용 일치 등) — 정답이 아닌 선지가 「맞는 말」인 유형. 오답 왜곡을 지어내지 않는다
    distractors_are_true: distractorsAreTrue(it.type_id, it.id),
    // 선지가 명제가 아니라 위치 · 지시 대상인 유형 — 참/거짓 대신 not_applicable
    slot_type: SLOT_TYPES.has(it.type_id),
    answer: a.answer_unknown ? null : it.answer,
    stem: it.stem,
    sentences: passage ? splitSentences(passage).map((r, i) => ({ n: i + 1, text: passage.slice(r.start, r.end).trim() })) : [],
    choices: it.choices,
    analysis: {
      measured_ability: a.measured_ability,
      design_intent: a.design_intent,
      answer_reasoning: a.answer_locus?.reasoning ?? null,
      choice_analysis: (a.choice_analysis ?? []).map((c) => ({
        n: c.n,
        verdict: c.verdict,
        trap: c.trap ?? null,
        why_tempting: c.why_tempting ?? null,
        how_to_reject: c.how_to_reject ?? null,
        why_correct: c.why_correct ?? null,
      })),
    },
  })
  if (todo.length >= LIMIT) break
}

const existing = fs.readdirSync(WORK).filter((f) => /^chunk-inq-\d+\.json$/.test(f)).length
let k = existing
for (let i = 0; i < todo.length; i += SIZE) {
  k += 1
  const name = `inq-${String(k).padStart(2, '0')}`
  fs.writeFileSync(path.join(WORK, `chunk-${name}.json`), JSON.stringify({ chunk: name, items: todo.slice(i, i + SIZE) }, null, 1) + '\n')
}
console.log(
  `평가원 in_scope ${items.length} · 분석 없음 ${noAnalysis} · 이미 채움(같은 버전) ${skipped} · 새로 뽑음 ${todo.length} → 청크 ${k - existing}개(${WORK})`,
)
