// scripts/csat/report-lines-refold.mjs
//
// **유형 리포트의 줄 단위 재작성 드레인 — `failure_modes` · `procedure_steps`.** (2026-09-28)
//
// `locus-refold` 는 근거 서술(`answer_locus_pattern`) 한 필드만 고친다. 그런데 학습자 화면은
// 「미끄러지는 자리」(failure_modes)와 「풀이 절차」(procedure_steps)도 그린다 — 실측 2026-09-28:
// 26유형 중 17유형의 이 두 필드에 「청크」·내부 필드명·날짜 갱신 같은 분석자 작업 로그가 남아 있다.
// 줄마다 짧아서 유형 전체를 다시 쓰지 않고 **표지가 걸린 줄만** 뽑아 고친다.
//
// 3단 구조:
//   export  → scripts/csat/report-lines/chunk-01.json   (표지가 걸린 줄 + 같은 유형의 다른 줄 맥락)
//   Claude  → chunk-01.out.json                          ({ type_id, field, index, text } 목록)
//   import  → 그 줄만 바꿔 넣는다(배열 나머지는 그대로) · 쓰기 전 원본을 backup-<시각>.json 에 남긴다
//
// 게이트(import): 표지가 남으면 · 빈 값/10자 미만 · 원본에 없는 문항 id · 원본에 없는 영어 토막 ·
//   원본과 같으면 · 지금 DB 의 그 줄이 export 때와 다르면(다른 쓰기가 끼었다) 건너뛰고 수를 출력한다.
// 재실행 안전: export 는 표지가 걸린 줄만 뽑으므로 고친 줄은 다시 나오지 않는다. import 는 같은 값을 쓰지 않는다.
//
//   NODE_OPTIONS=--tls-max-v1.2 node scripts/csat/report-lines-refold.mjs export
//   NODE_OPTIONS=--tls-max-v1.2 node scripts/csat/report-lines-refold.mjs import [--commit]

import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { citedItemIds, detectAnalystMeta, inventedFragments } from './lib-analyst-markers.mjs'

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
const MODE = process.argv[2]
const COMMIT = process.argv.includes('--commit')
const WORK = path.resolve('scripts/csat/report-lines')
fs.mkdirSync(WORK, { recursive: true })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const { data: reps, error } = await db.from('csat_type_reports').select('type_id, failure_modes, procedure_steps').eq('organizer', 'kice').eq('status', 'published')
if (error) throw new Error(error.message)
const lineOf = (r, field, i) => (field === 'failure_modes' ? r.failure_modes?.[i] : r.procedure_steps?.[i]?.step) ?? ''

if (MODE === 'export') {
  const lines = []
  for (const r of reps) {
    for (const field of ['failure_modes', 'procedure_steps']) {
      const arr = r[field] ?? []
      arr.forEach((_, i) => {
        const text = lineOf(r, field, i)
        const markers = detectAnalystMeta(text)
        if (markers.length) lines.push({ type_id: r.type_id, field, index: i, markers, text })
      })
    }
  }
  const byType = new Map(reps.map((r) => [r.type_id, r]))
  const context = {}
  for (const t of new Set(lines.map((l) => l.type_id))) {
    const r = byType.get(t)
    context[t] = { failure_modes: r.failure_modes ?? [], procedure_steps: (r.procedure_steps ?? []).map((s) => s?.step ?? '') }
  }
  const file = path.join(WORK, 'chunk-01.json')
  if (fs.existsSync(file.replace(/\.json$/, '.out.json'))) console.log('  ⚠ chunk-01.out.json 이 이미 있다 — import 부터 하거나 지우고 다시 뽑는다')
  fs.writeFileSync(file, JSON.stringify({ instructions: 'scripts/csat/report-lines/_PROMPT.md', lines, context }, null, 2) + '\n')
  console.log(`  표지가 걸린 줄 ${lines.length} · 유형 ${Object.keys(context).length} → ${path.relative(process.cwd(), file)}`)
  process.exit(0)
}

if (MODE !== 'import') throw new Error('export | import [--commit]')

const src = JSON.parse(fs.readFileSync(path.join(WORK, 'chunk-01.json'), 'utf8'))
const out = JSON.parse(fs.readFileSync(path.join(WORK, 'chunk-01.out.json'), 'utf8'))
const exported = new Map(src.lines.map((l) => [`${l.type_id}|${l.field}|${l.index}`, l.text]))
const byType = new Map(reps.map((r) => [r.type_id, structuredClone(r)]))
const skip = {}
const bump = (why) => (skip[why] = (skip[why] ?? 0) + 1)
const touched = new Set()
let ready = 0
for (const o of out.lines ?? []) {
  const k = `${o.type_id}|${o.field}|${o.index}`
  const before = exported.get(k)
  const r = byType.get(o.type_id)
  const text = (o.text ?? '').trim()
  if (before == null || !r) { bump('export 에 없는 줄'); continue }
  if (lineOf(r, o.field, o.index) !== before) { bump('DB 의 그 줄이 export 뒤 바뀌었다'); continue }
  if (text.length < 10) { bump('빈 값·10자 미만'); continue }
  if (text === before.trim()) { bump('원본과 같다'); continue }
  if (detectAnalystMeta(text).length) { bump('작업 표지가 남았다'); continue }
  const had = citedItemIds(before)
  if ([...citedItemIds(text)].some((id) => !had.has(id))) { bump('원본에 없는 문항 id'); continue }
  if (inventedFragments(before, text).length) { bump('원본에 없는 영어 표현'); continue }
  if (o.field === 'failure_modes') r.failure_modes[o.index] = text
  else r.procedure_steps[o.index] = { ...r.procedure_steps[o.index], step: text }
  touched.add(o.type_id)
  ready += 1
}
console.log(`  줄 ${out.lines?.length ?? 0} · 통과 ${ready} · 유형 ${touched.size}`)
console.log('  건너뜀:', Object.keys(skip).length ? skip : '없음')
if (!COMMIT) {
  console.log('  미리보기 — --commit 을 붙이면 쓴다(원본은 backup-<시각>.json)')
  process.exit(0)
}
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const backup = path.join(WORK, `backup-${stamp}.json`)
fs.writeFileSync(backup, JSON.stringify(reps.filter((r) => touched.has(r.type_id)), null, 2) + '\n')
for (const t of touched) {
  const r = byType.get(t)
  const { error: e } = await db.from('csat_type_reports').update({ failure_modes: r.failure_modes, procedure_steps: r.procedure_steps }).eq('organizer', 'kice').eq('type_id', t)
  if (e) throw new Error(`${t}: ${e.message} (원본은 ${path.basename(backup)})`)
}
console.log(`  적재 유형 ${touched.size} · 줄 ${ready} · 원본 ${path.relative(process.cwd(), backup)}`)
