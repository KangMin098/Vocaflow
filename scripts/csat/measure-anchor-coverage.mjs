// scripts/csat/measure-anchor-coverage.mjs
//
// **오답 선지가 지문 지도에 왜 안 붙었나 — 선지마다 사유를 센다**(지시문 F05 · F06, 2026-10-11).
//
// 지도(skeleton-data)는 선지 하나에 앵커 하나만 단다. 고르는 순서는 `lib-fragments.mjs` 의 `locateChoice`:
//   ① how_to_reject 속 영어 조각(지우는 근거) → ② why_tempting 속 조각(끌리는 이유) → ③ lure_quote(끌리는 구절)
// 그래서 ①②가 찾히면 ③은 **설계상** 쓰이지 않는다. 「lure_quote 미반영」 대부분이 이것이다 — 결함이 아니라
// 한 선지 한 앵커 규칙. 이 스크립트는 그것과 진짜 빈자리(지문에서 못 찾음 · 예산 탈락 · 지문 결손)를 가른다.
//
// 지도 파일은 다시 굽지 않는다 — **커밋된** skeleton-data 를 읽어 실제로 학습자가 보는 앵커와 견준다.
// 읽기 전용(DB 조회만). 결과: 사유별 수 + 선지별 원장 JSON(--out).
//
//   npx tsx scripts/csat/measure-anchor-coverage.mjs [--out scripts/csat/design-learning-audit/anchor-coverage.json]

import fs from 'node:fs'
import path from 'node:path'
import { isKiceExam } from './lib-exam-id.mjs'
import { fragments, locateChoice } from './lib-fragments.mjs'

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

const outArg = process.argv.indexOf('--out')
const SAMPLE = process.argv.includes('--sample')
const OUT = outArg >= 0 ? path.resolve(process.argv[outArg + 1]) : null
const SKELETON = path.resolve('apps/web/src/lib/csat/skeleton-data')

const { createClient } = await import('@supabase/supabase-js')
const { findQuote } = await import('../../apps/web/src/lib/csat/quote-match.ts')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

async function page(table, sel, tune = (q) => q) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await tune(db.from(table).select(sel)).range(from, from + 999)
    if (error) throw new Error(`${table}: ${error.message}`)
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}

const analyses = await page('csat_item_analyses', 'item_id, version, choice_analysis', (q) =>
  q.eq('status', 'published').order('item_id').order('version', { ascending: false }),
)
const latest = new Map()
for (const r of analyses) if (!latest.has(r.item_id)) latest.set(r.item_id, r)
// 평가원만 — 지도 파일은 평가원 집합만 커밋된다(학평은 DB 표)
const items = (await page('csat_items', 'id, exam_id, type_id, passage, choices, body_ok, in_scope', (q) => q.order('id'))).filter(
  (r) => isKiceExam(r.exam_id) && r.in_scope,
)

const placed = new Map() // item id → Set(anchor id)
for (const f of fs.readdirSync(SKELETON).filter((f) => f.endsWith('.json') && f !== 'index.json')) {
  const j = JSON.parse(fs.readFileSync(path.join(SKELETON, f), 'utf8'))
  for (const it of Array.isArray(j) ? j : (j.items ?? [])) placed.set(it.id, new Set((it.anchors ?? []).map((a) => a.id)))
}

const count = {}
const lureCount = {}
const rows = []
const bump = (o, k) => (o[k] = (o[k] ?? 0) + 1)
let distractors = 0
for (const it of items) {
  const a = latest.get(it.id)
  if (!a) continue
  for (const ch of a.choice_analysis ?? []) {
    if (ch.verdict !== 'distractor' || ch.n == null) continue
    distractors += 1
    const hasLure = typeof ch.lure_quote === 'string' && ch.lure_quote.trim().length > 0
    let reason
    if (!it.passage) reason = 'no_passage'
    else if (!it.body_ok) reason = 'body_broken'
    else {
      const hit = locateChoice(ch, it.passage, findQuote)
      if (!hit) {
        // 못 찾은 까닭을 가른다: 20자 이상 영어 조각이 아예 없나(짧은 어구 · 한국어만) · 있는데 지문과 글자가 안 맞나
        const frs = [...fragments(ch.how_to_reject), ...fragments(ch.why_tempting)]
        const short = /['‘"“][A-Za-z][^'’"”]{1,18}['’"”]|\b[A-Za-z]{3,}\b/.test(`${ch.how_to_reject ?? ''} ${ch.why_tempting ?? ''}`)
        reason = frs.length ? 'quote_mismatch' : short ? 'only_short_english' : 'korean_only'
      }
      else if (!placed.get(it.id)?.has(`reject:${ch.n}`)) reason = 'dropped_by_budget'
      else reason = hit.lure ? 'shown_lure' : hit.from === 'tempt' ? 'shown_tempt' : 'shown_reject'
    }
    bump(count, reason)
    if (hasLure) bump(lureCount, reason === 'shown_reject' || reason === 'shown_tempt' ? 'superseded_one_anchor_per_choice' : reason)
    // 맞지 않는 조각이 지문이 아니라 선지 문구인가 — 「선지를 인용」 하면 지문에서 찾을 수 없다
    let quotesChoice = null
    if (reason === 'quote_mismatch') {
      const choice = String((Array.isArray(it.choices) ? it.choices[ch.n - 1] : '') ?? '').toLowerCase()
      quotesChoice = [...fragments(ch.how_to_reject), ...fragments(ch.why_tempting)].some((f) => choice.includes(f.toLowerCase().slice(0, 15)))
      bump(count, quotesChoice ? 'quote_mismatch:choice_text' : 'quote_mismatch:not_choice')
    }
    rows.push({ id: it.id, type: it.type_id, n: ch.n, reason, has_lure: hasLure, ...(quotesChoice == null ? {} : { quotes_choice: quotesChoice }) })
    if (SAMPLE && reason === 'quote_mismatch' && rows.filter((r) => r.reason === 'quote_mismatch').length % 40 === 1)
      console.log(`  표본 ${it.id} #${ch.n} 선지인용=${quotesChoice} · ${[...fragments(ch.how_to_reject), ...fragments(ch.why_tempting)][0]?.slice(0, 80)}`)
  }
}

const shown = (count.shown_reject ?? 0) + (count.shown_tempt ?? 0) + (count.shown_lure ?? 0)
console.log(`평가원 오답 선지 ${distractors} · 지도에 붙음 ${shown} (${((100 * shown) / distractors).toFixed(1)}%)`)
for (const [k, v] of Object.entries(count).sort((x, y) => y[1] - x[1])) console.log(`  ${k.padEnd(20)} ${v}`)
console.log(`lure_quote 있는 오답 ${Object.values(lureCount).reduce((a, b) => a + b, 0)}`)
for (const [k, v] of Object.entries(lureCount).sort((x, y) => y[1] - x[1])) console.log(`  ${k.padEnd(34)} ${v}`)
const byType = {}
for (const r of rows) if (!r.reason.startsWith('shown') && r.reason !== 'dropped_by_budget') bump(byType, r.type)
console.log('지문에서 못 찾은 오답 — 유형별', JSON.stringify(Object.fromEntries(Object.entries(byType).sort((x, y) => y[1] - x[1]))))
if (OUT) {
  fs.writeFileSync(OUT, JSON.stringify({ measured_by: 'scripts/csat/measure-anchor-coverage.mjs', distractors, count, lureCount, rows }, null, 1) + '\n')
  console.log(`→ ${path.relative(process.cwd(), OUT)}`)
}
