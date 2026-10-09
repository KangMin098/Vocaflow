// scripts/csat/lure-drain-export.mjs
//
// **끌리는 구절 드레인 — 내보내기.** 평가원 발행 분석(문항마다 최신 버전)의 오답 가운데 지문 위 자리를
// 못 찾는 것(lib-fragments.locateChoice → null)만 골라 청크로 쓴다. 에이전트가 각 오답에 대해 지문 속
// 「이 선지로 끌어당기는 구절」을 **원문 그대로** 골라 `chunk-NN.out.json` 에 쓰고, lure-drain-import 가 검증 뒤
// `choice_analysis[].lure_quote` 키 하나만 더한다(마이그레이션 불필요 · 다른 키는 그대로).
//
// 재실행 안전 — 이미 자리를 찾는 오답(lure_quote 포함)은 건너뛴다. 청크에는 지문 원문이 들어가므로 커밋하지 않는다(.gitignore).
//
//   pnpm exec tsx scripts/csat/lure-drain-export.mjs [--per 25]

import fs from 'node:fs'
import path from 'node:path'

import { isKiceExam } from './lib-exam-id.mjs'
import { locateChoice } from './lib-fragments.mjs'

for (const f of ['apps/web/.env.local', '.env.local']) {
  if (!fs.existsSync(f)) continue
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const { createClient } = await import('@supabase/supabase-js')
const { findQuote } = await import('../../apps/web/src/lib/csat/quote-match.ts')

const PER_ARG = process.argv.indexOf('--per')
const PER = PER_ARG >= 0 ? Number(process.argv[PER_ARG + 1]) : 25
const OUT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), 'lure-drain')

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// PostgREST 는 1,000행에서 조용히 끊는다 — id 키셋으로 넘긴다(OFFSET 은 뒤 페이지가 앞을 다시 훑는다 · offset-paging-budget).
async function page(table, sel, tune = (q) => q) {
  const out = []
  for (let last = null; ; ) {
    let q = tune(db.from(table).select(sel)).order('id').limit(1000)
    if (last != null) q = q.gt('id', last)
    const { data, error } = await q
    if (error) throw new Error(`${table}: ${error.message}`)
    out.push(...data)
    if (data.length < 1000) break
    last = data[data.length - 1].id
  }
  return out
}

const analyses = await page('csat_item_analyses', 'id, item_id, version, choice_analysis', (q) => q.eq('status', 'published'))
// 문항마다 최신 발행 버전 하나
const latest = new Map()
for (const r of analyses) if (!latest.has(r.item_id) || r.version > latest.get(r.item_id).version) latest.set(r.item_id, r)

const items = (await page('csat_items', 'id, exam_id, no, type_id, stem, choices, passage, body_ok')).filter(
  (r) => isKiceExam(r.exam_id) && r.body_ok && r.passage,
)

const work = []
let distractors = 0
let placed = 0
for (const it of items) {
  const a = latest.get(it.id)
  if (!a || !Array.isArray(a.choice_analysis)) continue
  const todo = []
  for (const ch of a.choice_analysis) {
    if (ch.n == null || ch.verdict === 'correct' || !String(ch.trap ?? '').trim()) continue
    distractors += 1
    if (locateChoice(ch, it.passage, findQuote)) {
      placed += 1
      continue
    }
    const choice = Array.isArray(it.choices) ? it.choices[ch.n - 1] : null
    todo.push({
      n: ch.n,
      choice: typeof choice === 'string' ? choice : (choice?.text ?? null),
      trap: ch.trap,
      why_tempting: ch.why_tempting ?? null,
      how_to_reject: ch.how_to_reject ?? null,
    })
  }
  if (todo.length)
    work.push({ item_id: it.id, analysis_id: a.id, version: a.version, type_id: it.type_id, stem: it.stem, passage: it.passage, distractors: todo })
}

// 재실행 안전(Codex P1): 채운 청크(.out.json 이 있는 것)는 입력까지 그대로 둔다 — 지우거나 번호를 다시 매기면
// 결과와 입력이 어긋나고, 같은 번호의 새 작업이 「이미 채움」으로 조용히 건너뛰어진다.
// 그래서 ① 이미 어느 결과에 든 **분석 버전**(analysis_id@version)은 다시 내보내지 않고 — 새 버전이 발행되면 다시 나온다(Codex P1) — ② 새 청크 번호는 기존 최댓값 다음부터 매긴다.
fs.mkdirSync(OUT, { recursive: true })
const existing = fs.readdirSync(OUT)
const done = new Set()
let maxId = 0
for (const f of existing) {
  const m = f.match(/^chunk-(\d+)\.(out\.)?json$/)
  if (!m) continue
  maxId = Math.max(maxId, Number(m[1]))
  if (m[2]) for (const r of JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8')).items ?? []) done.add(`${r.analysis_id}@${r.version}`)
}
// 결과 없는 입력만 치운다(아직 아무도 채우지 않은 것 — 이번 셈으로 다시 쓴다)
for (const f of existing) {
  const m = f.match(/^chunk-(\d+)\.json$/)
  if (m && !existing.includes(`chunk-${m[1]}.out.json`)) fs.rmSync(path.join(OUT, f))
}
const outIds = existing.filter((f) => /^chunk-\d+\.out\.json$/.test(f)).map((f) => Number(f.match(/\d+/)[0]))
let next = outIds.length ? Math.max(...outIds) : 0
const fresh = work.filter((w) => !done.has(`${w.analysis_id}@${w.version}`))
let written = 0
for (let i = 0; i < fresh.length; i += PER) {
  next += 1
  const id = String(next).padStart(2, '0')
  fs.writeFileSync(path.join(OUT, `chunk-${id}.json`), JSON.stringify({ chunk: id, items: fresh.slice(i, i + PER) }, null, 1))
  written += 1
}
const todoN = fresh.reduce((n, w) => n + w.distractors.length, 0)
console.log(
  `오답 ${distractors} · 자리 있음 ${placed} (${((100 * placed) / distractors).toFixed(1)}%) · 결과 대기(이미 채움 · import 전) ${work.length - fresh.length}문항 · 새로 채울 것 ${todoN}개 / ${fresh.length}문항 → 새 청크 ${written} (${OUT}${maxId ? ` · 기존 최대 번호 ${maxId}` : ''})`,
)
