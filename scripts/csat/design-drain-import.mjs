// scripts/csat/design-drain-import.mjs
//
// **출제 설계 주석 드레인 — 3단계(import).** (2026-09-25 · 재설계안 v1 Phase 1)
// 기준 정본: docs/csat-learner/design-annotation-criteria.md
//
// `scripts/csat/design-drain/*.out.json` → `csat_item_analyses.answer_locus.passage_design`
// (최신 published 버전 행 · jsonb 키 하나만 더한다 — 기존 quote/reasoning/sentence_index 는 그대로)
//
// 넣지 않는 것(건너뛴 수를 사유별로 출력한다 — 빈 값이 들어가면 구멍이 영영 남는다):
//   · 목록 밖 라벨(역할 9 · 패턴 9 · 변환 8 · 단서 6) · 문장 수 불일치(골격 분할기 기준)
//   · 빈 selection/transform_note · transform_note 에 원문 12자 넘는 인용
//   · 이미 같은 값이 들어 있는 문항(재실행 안전 — 키 순서가 아니라 필드 값으로 비교한다)
//
// 실행:
//   NODE_OPTIONS=--tls-max-v1.2 npx tsx scripts/csat/design-drain-import.mjs            (dry-run)
//   NODE_OPTIONS=--tls-max-v1.2 npx tsx scripts/csat/design-drain-import.mjs --commit

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

const COMMIT = process.argv.includes('--commit')
const WORK = path.resolve('scripts/csat/design-drain')

export const ROLES = ['topic', 'support', 'example', 'turn', 'concession', 'conclusion', 'background', 'speech_act', 'closing']
export const PATTERNS = ['myth_rebuttal', 'general_specific', 'problem_solution', 'contrast', 'cause_effect', 'study_implication', 'request_letter', 'narrative', 'other']
export const TRANSFORMS = ['abstraction', 'paraphrase', 'negation_flip', 'perspective', 'speech_act_verb', 'compression', 'inference', 'none']
export const CUES = ['pronoun', 'connective', 'article', 'time', 'logic', 'repetition']

const { createClient } = await import('@supabase/supabase-js')
const { splitSentences } = await import('../../apps/web/src/lib/csat/passage-skeleton.ts')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const rows = []
for (const f of fs.readdirSync(WORK).filter((f) => f.endsWith('.out.json')).sort()) {
  const j = JSON.parse(fs.readFileSync(path.join(WORK, f), 'utf8'))
  for (const r of j.items ?? []) rows.push({ ...r, _file: f, _version: j.criteria_version ?? 'v1' })
}

const skip = {}
const bump = (why) => (skip[why] = (skip[why] ?? 0) + 1)
const defects = []
let written = 0
let same = 0

/** 원문에서 12자 넘게 그대로 옮긴 조각이 있나 — 영문 연속 단어열로 본다 */
function quotesSource(note, passage) {
  for (const m of note.matchAll(/[A-Za-z][A-Za-z'’ ,.-]{12,}/g)) {
    if (passage.toLowerCase().includes(m[0].trim().toLowerCase())) return true
  }
  return false
}

for (const r of rows) {
  const { data: it } = await db.from('csat_items').select('id, type_id, passage').eq('id', r.id).maybeSingle()
  if (!it?.passage) { bump('문항·지문 없음'); continue }
  const n = splitSentences(it.passage).length
  if (!Array.isArray(r.roles) || r.roles.length !== n) { bump(`문장 수 불일치`); continue }
  if (r.roles.some((x) => !ROLES.includes(x))) { bump('목록 밖 역할'); continue }
  if (!PATTERNS.includes(r.pattern)) { bump('목록 밖 패턴'); continue }
  if (!TRANSFORMS.includes(r.transform)) { bump('목록 밖 변환'); continue }
  if ((r.cues ?? []).some((x) => !CUES.includes(x))) { bump('목록 밖 단서'); continue }
  if (it.type_id === 'R-ORDER' && !(r.cues ?? []).length) { bump('순서 유형 단서 없음'); continue }
  if ((r.alternatives ?? []).some((a) => !ROLES.includes(a.role) || a.index < 0 || a.index >= n)) { bump('대안 역할 오류'); continue }
  if (!r.selection?.trim() || r.selection.trim().length < 20) { bump('selection 비었거나 짧음'); continue }
  if (!r.transform_note?.trim() || r.transform_note.trim().length < 20) { bump('transform_note 비었거나 짧음'); continue }
  if (quotesSource(r.selection + ' ' + r.transform_note, it.passage)) { bump('원문 12자 넘게 인용'); continue }
  if (r.data_defect) defects.push(`${r.id} — ${r.data_defect}`)

  const { data: a } = await db
    .from('csat_item_analyses')
    .select('id, version, answer_locus')
    .eq('item_id', r.id)
    .eq('status', 'published')
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!a) { bump('published 분석 없음'); continue }

  const design = {
    criteria: r._version,
    roles: r.roles,
    alternatives: r.alternatives ?? [],
    pattern: r.pattern,
    selection: r.selection.trim(),
    transform: r.transform,
    transform_note: r.transform_note.trim(),
    cues: r.cues ?? [],
    ...(r.data_defect ? { data_defect: r.data_defect } : {}),
  }
  const prev = a.answer_locus?.passage_design
  const key = (d) => JSON.stringify([d.criteria, d.roles, d.alternatives, d.pattern, d.selection, d.transform, d.transform_note, d.cues, d.data_defect ?? null])
  if (prev && key(prev) === key(design)) { same++; continue }
  if (COMMIT) {
    // 기존 answer_locus 를 읽어 키 하나만 더한다 — 통째로 덮으면 quote/reasoning 이 날아간다
    const { error } = await db.from('csat_item_analyses').update({ answer_locus: { ...(a.answer_locus ?? {}), passage_design: design } }).eq('id', a.id)
    if (error) { bump(`쓰기 실패: ${error.message}`); continue }
  }
  written++
}

console.log(`${COMMIT ? '적재' : 'dry-run — --commit 을 붙이면 적재'} · 대상 ${rows.length} · ${COMMIT ? '썼음' : '쓸 것'} ${written} · 이미 같음 ${same}`)
console.log('건너뜀:', Object.keys(skip).length ? skip : '없음')
if (defects.length) console.log(`원문 추출 결함 기록 ${defects.length}:\n  ` + defects.join('\n  '))
