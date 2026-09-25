// scripts/csat/design-drain-export.mjs
//
// **출제 설계 주석 드레인 — 1단계(export).** (2026-09-25 · 재설계안 v1 Phase 1)
// 기준 정본: docs/csat-learner/design-annotation-criteria.md — 여기에 기준을 다시 쓰지 않는다.
//
// 3단 구조(AGENTS.md):
//   ① 이 스크립트             → scripts/csat/design-drain/chunk-<TYPE>-NN.json   (원문 포함 · gitignore)
//   ② Claude Code             → chunk-<TYPE>-NN.out.json                         (라벨 + 한국어 설명 · 커밋)
//   ③ design-drain-import.mjs → csat_item_analyses.answer_locus.passage_design
//
// 문장 번호는 골격과 **같은 분할기**(`splitSentences`)의 0-기반 번호다 — 화면 지문 지도와 같아야 채점된다.
//
// 재실행 안전: DB 에 passage_design 이 이미 있거나 같은 폴더 *.out.json 에 들어 있는 문항은 건너뛴다.
// 건너뛴 수를 출력한다. 읽기만 한다(DB 에 쓰지 않는다).
//
// 실행:
//   NODE_OPTIONS=--tls-max-v1.2 npx tsx scripts/csat/design-drain-export.mjs --pilot 2
//   NODE_OPTIONS=--tls-max-v1.2 npx tsx scripts/csat/design-drain-export.mjs            (남은 전부 · 청크 10)
//   … [--type R-BLANK] [--size 10] [--limit 3]

import fs from 'node:fs'
import path from 'node:path'

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

const arg = (n, d = null) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : d
}
const TYPES = ['R-PURPOSE', 'R-BLANK', 'R-ORDER']
const ONLY = arg('type')
const SIZE = Number(arg('size', 10))
const LIMIT = arg('limit') ? Number(arg('limit')) : Infinity
const PILOT = arg('pilot') ? Number(arg('pilot')) : null
/**
 * **끝난 문항을 일부러 다시 뽑는다** — `--redo 2026#30,M1809#30`.
 * 원문이 바뀌면(2026-09-25 reflow 재생성) 깨진 원문을 보고 쓴 주석은 다시 봐야 한다. 청크 이름에
 * `redo` 가 들어가 옛 `.out.json` 을 덮지 않고, 파일 이름 순서상 뒤에 와서 import 가 새 값으로 덮는다.
 */
const REDO = new Set(String(arg('redo', '') ?? '').split(',').map((s) => s.trim()).filter(Boolean))
const WORK = path.resolve('scripts/csat/design-drain')
fs.mkdirSync(WORK, { recursive: true })

const { createClient } = await import('@supabase/supabase-js')
const { splitSentences } = await import('../../apps/web/src/lib/csat/passage-skeleton.ts')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const done = new Set()
for (const f of fs.readdirSync(WORK).filter((f) => f.endsWith('.out.json'))) {
  for (const r of JSON.parse(fs.readFileSync(path.join(WORK, f), 'utf8')).items ?? []) done.add(r.id)
}

const types = ONLY ? [ONLY] : TYPES
const { data: items, error } = await db
  .from('csat_items')
  .select('id, exam_id, no, type_id, stem, passage, choices, answer, body_ok')
  .in('type_id', types)
  .order('id')
if (error) throw new Error(error.message)

const ids = items.map((i) => i.id)
const analyses = new Map()
for (let i = 0; i < ids.length; i += 200) {
  const { data, error: e } = await db
    .from('csat_item_analyses')
    .select('item_id, version, design_intent, answer_locus')
    .in('item_id', ids.slice(i, i + 200))
    .eq('status', 'published')
    .order('version', { ascending: false })
  if (e) throw new Error(e.message)
  for (const a of data) if (!analyses.has(a.item_id)) analyses.set(a.item_id, a)
}

let skippedDone = 0
let skippedBody = 0
let skippedNoAnalysis = 0
const byType = new Map(types.map((t) => [t, []]))
// 최신 회차 먼저 — 현행 설계부터 덮는다(analysis-drain 과 같은 순서)
for (const it of items.sort((a, b) => b.id.localeCompare(a.id))) {
  const a = analyses.get(it.id)
  if (REDO.size && !REDO.has(it.id)) continue
  if (!REDO.has(it.id) && (done.has(it.id) || a?.answer_locus?.passage_design)) { skippedDone++; continue }
  if (!it.body_ok || !it.passage) { skippedBody++; continue }
  if (!a) { skippedNoAnalysis++; continue }
  const sentences = splitSentences(it.passage).map((r, i) => ({ i, text: it.passage.slice(r.start, r.end).trim() }))
  byType.get(it.type_id).push({
    id: it.id,
    type: it.type_id,
    stem: it.stem,
    sentences,
    choices: it.choices,
    answer: it.answer,
    analysis: { design_intent: a.design_intent, answer_locus: { quote: a.answer_locus?.quote ?? null, reasoning: a.answer_locus?.reasoning ?? null } },
  })
}

let chunks = 0
let exported = 0
for (const [type, list] of byType) {
  const take = PILOT != null ? list.slice(0, PILOT) : list
  for (let i = 0; i < take.length && chunks < LIMIT; i += SIZE) {
    const part = take.slice(i, i + SIZE)
    const base = `chunk-${type}-${PILOT != null ? 'pilot' : `${REDO.size ? 'redo-' : ''}${String(i / SIZE + 1).padStart(2, '0')}`}`
    // ⚠️ 앞 회차의 결과(`<이름>.out.json`)가 이미 있으면 회차 표시를 붙인다 — 같은 이름으로 내면 판정자가
    //    결과를 쓰는 순간 커밋된 앞 회차 기록을 덮는다(2026-09-25 두 번째 회차에서 발견).
    let name = `${base}.json`
    for (let r = 2; fs.existsSync(path.join(WORK, name.replace(/\.json$/, '.out.json'))); r++) name = `chunk-${type}-r${r}-${base.split('-').pop()}.json`
    fs.writeFileSync(
      path.join(WORK, name),
      JSON.stringify({ criteria: 'docs/csat-learner/design-annotation-criteria.md', type, items: part }, null, 2),
    )
    chunks++
    exported += part.length
  }
}
console.log(`청크 ${chunks}개 · 문항 ${exported}개 → ${path.relative(process.cwd(), WORK)}`)
console.log(`건너뜀: 이미 채움 ${skippedDone} · 본문 불완전(body_ok=false) ${skippedBody} · 분석 없음 ${skippedNoAnalysis}`)
