// scripts/csat/diagnosis/canon-prepare.mts
//
// 정본 저장 · 시드 반영 준비물(2026-10-08) — **DB 읽기만 한다. 아무것도 쓰지 않는다.**
//   1) docs/csat-learner/pilot-runs/M2409-canon-diff.md — 실제 M2409 현재 행(시드) → 최종 태그(dual-model reviewed) 문항별 diff · 출처(Claude · Codex)
//   2) scripts/db/proposed-20261008-seed-v2.sql — 시드 v2(seed-rules.ts) 를 미검수 type_default 행에 반영하는 SQL(코드 규칙에서 생성 · sha256 출력)
//      + 영향 범위(시험 · 문항 · 행 수). **실행하지 않는다** — 사용자 승인 뒤 별도 실행.
//   cd apps/web && node <tsx cli> --env-file=<.env.local> ../../scripts/csat/diagnosis/canon-prepare.mts
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { createClient } from '@supabase/supabase-js'

import { ATTRIBUTE_CODES } from '../../../apps/web/src/lib/csat/diagnosis/engine/types.ts'
import { TYPE_BASE_V1, seedWeights, type Weights } from '../../../apps/web/src/lib/csat/diagnosis/seed-rules.ts'

const ROOT = path.resolve(import.meta.dirname, '../../..')
if (!String(process.env.NEXT_PUBLIC_SUPABASE_URL).includes('jajenrevcbmrpaliomxv')) throw new Error('개발 프로젝트가 아니다')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { persistSession: false } })
type Row = Record<string, unknown>
const must = async (q: PromiseLike<{ data: unknown; error: { message: string } | null }>, what: string): Promise<Row[]> => {
  const { data, error } = await q
  if (error) throw new Error(`${what}: ${error.message}`)
  return (data ?? []) as Row[]
}
// OFFSET 페이징 없이 — 시험 단위로 읽는다(시험당 역량 행 ≤ 45 × 9 = 405)
const attrsOf = (examId: string) => must(db.from('csat_dx_item_attribute').select('item_id, attribute_code, weight, source, reviewed_at').like('item_id', `${examId}#%`), `attrs ${examId}`)

// ── 1) M2409 정본 diff ──
const final = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'pilot/M2409-review-final.json'), 'utf8')) as { rule: string; reviewers: string; items: { no: number; w: Weights; claude: Weights; codex: Weights }[] }
const m24 = await attrsOf('M2409')
const [exam] = await must(db.from('csat_exams').select('id, diagnosis_ready').eq('id', 'M2409'), 'exam')
const cur = (no: number) => Object.fromEntries(ATTRIBUTE_CODES.map((c) => [c, Number(m24.find((r) => r.item_id === `M2409#${no}` && r.attribute_code === c)?.weight ?? 0)])) as Weights
const fmt = (w: Weights, hi: Set<string>) => ATTRIBUTE_CODES.map((c) => (hi.has(c) ? `**${c}:${w[c]}**` : `${c}:${w[c]}`)).join(' ')
let changed = 0
const lines = [
  '# M2409 정본 저장 전 diff — 현재 DB(유형 기본값 시드) → 최종 태그(dual-model reviewed)',
  '',
  `> 생성 2026-10-08 · \`scripts/csat/diagnosis/canon-prepare.mts\`(DB 읽기만). 현재 DB: 역량 행 ${m24.length} · 검수 표지 ${m24.filter((r) => r.reviewed_at).length} · diagnosis_ready=${exam?.diagnosis_ready}.`,
  `> 최종 태그 출처: ${final.reviewers}. 규칙: ${final.rule}. **human verified 아님.**`,
  '> 저장 방법(승인 뒤): 관리자 태깅 화면 「검수 저장」 = `csat_dx_save_item_tagging`(문항마다 9개 · 0 포함) → 판정 28/28 · 252행 · 구조 0 확인 → 관리자 「진단 반영 켜기」. 직접 UPDATE 금지.',
  '> 굵은 글씨 = 현재 DB 와 다른 역량.',
  '',
]
for (const it of final.items) {
  const c = cur(it.no)
  const hi = new Set(ATTRIBUTE_CODES.filter((a) => c[a] !== it.w[a]))
  if (hi.size) changed++
  lines.push(`### ${it.no}번`, `- 현재 DB: ${fmt(c, hi)}`, `- 저장할 값: ${fmt(it.w, hi)}`, `- Claude: ${fmt(it.claude, new Set())}`, `- Codex: ${fmt(it.codex, new Set())}`, '')
}
lines.splice(6, 0, `요약: 28문항 중 현재 DB 와 다른 문항 ${changed} · 저장 후 행 252(9 × 28) · 검수 표지 28문항.`, '')
fs.writeFileSync(path.join(ROOT, 'docs/csat-learner/pilot-runs/M2409-canon-diff.md'), lines.join('\n'))

// ── 2) 시드 v2 반영 SQL(실행 안 함) ──
// 대상 = 역량 행이 있는 모든 시험(평가원 · 학평 — 시드는 시험 종류와 무관하게 같은 규칙). 문항은 그 행의 id 로만 짚는다
const examIds = (await must(db.from('csat_exams').select('id'), 'exams')).map((e) => e.id as string)
const attrs: Row[] = []
for (const id of examIds) attrs.push(...(await attrsOf(id)))
const itemIds = [...new Set(attrs.map((a) => a.item_id as string))]
const items: Row[] = []
for (let i = 0; i < itemIds.length; i += 200) items.push(...(await must(db.from('csat_items').select('id, exam_id, type_id, choices').in('id', itemIds.slice(i, i + 200)), 'items')))
const words = (c: string) => Math.max(...String(c).split(/\s*(?:……|…|\.\.\.)\s*/).map((s) => s.trim().split(/\s+/).filter(Boolean).length))
const upserts: string[] = []
const deletes: string[] = []
const touchedExams = new Set<string>()
const touchedItems = new Set<string>()
let skippedReviewed = 0
for (const it of items) {
  const rows = attrs.filter((a) => a.item_id === it.id)
  if (rows.some((r) => r.reviewed_at || r.source !== 'type_default')) { skippedReviewed++; continue } // 검수된 문항은 건드리지 않는다
  const choices = (it.choices as string[] | null) ?? []
  const v2 = seedWeights({ type: it.type_id as string, choiceWords: choices.length ? Math.max(...choices.map(words)) : null }, 'seed-v2').weights
  for (const c of ATTRIBUTE_CODES) {
    const now = Number(rows.find((r) => r.attribute_code === c)?.weight ?? 0)
    if (now === v2[c]) continue
    touchedExams.add(it.exam_id as string)
    touchedItems.add(it.id as string)
    if (v2[c] === 0) deletes.push(`('${it.id}','${c}')`)
    else upserts.push(`('${it.id}','${c}',${v2[c]})`)
  }
}
// 유형 표: v1 → v2 에서 유형 단위로 바뀌는 것(R1 · R3 · R4 — R2 는 선지 형태라 문항 행에서만)
const typeRows: string[] = []
const typeDeletes: string[] = []
for (const [type, base] of Object.entries(TYPE_BASE_V1)) {
  const v2 = seedWeights({ type, choiceWords: null }, 'seed-v2').weights
  for (const c of ATTRIBUTE_CODES) {
    const b = base[c] ?? 0
    if (b === v2[c]) continue
    if (v2[c] === 0) typeDeletes.push(`('${type}','${c}')`)
    else typeRows.push(`('${type}','${c}',${v2[c]})`)
  }
}
const guard = `source = 'type_default' AND reviewed_at IS NULL`
const sql = [
  '-- scripts/db/proposed-20261008-seed-v2.sql',
  '-- 시드 v2(apps/web/src/lib/csat/diagnosis/seed-rules.ts SEED_RULES_V2) 반영 — **제안 · 미실행**. 사용자가 이 파일(sha256)을 보고 승인한 뒤에만 실행한다.',
  '-- 생성: scripts/csat/diagnosis/canon-prepare.mts (코드 규칙에서 생성 — 손으로 고치지 않는다). 검수된 행 · admin 행은 건드리지 않는다(가드).',
  `-- 영향: 시험 ${touchedExams.size} · 문항 ${touchedItems.size} · 행 upsert ${upserts.length} · delete ${deletes.length} · 유형 표 upsert ${typeRows.length} · delete ${typeDeletes.length} · 검수 문항 건너뜀 ${skippedReviewed}`,
  '-- 되돌리기: 같은 스크립트를 seed-v1 로 생성(규칙 끄기)해 실행 — 시드 행은 검수 전 출발점이라 데이터 손실 없음.',
  'BEGIN;',
  typeRows.length ? `INSERT INTO public.csat_dx_type_attribute (type_id, attribute_code, weight) VALUES\n  ${typeRows.join(',\n  ')}\nON CONFLICT (type_id, attribute_code) DO UPDATE SET weight = EXCLUDED.weight;` : '-- 유형 표 upsert 없음',
  typeDeletes.length ? `DELETE FROM public.csat_dx_type_attribute WHERE (type_id, attribute_code) IN (VALUES\n  ${typeDeletes.join(',\n  ')});` : '-- 유형 표 delete 없음',
  upserts.length ? `INSERT INTO public.csat_dx_item_attribute (item_id, attribute_code, weight, source) VALUES\n  ${upserts.join(',\n  ')}\nON CONFLICT (item_id, attribute_code) DO UPDATE SET weight = EXCLUDED.weight\n  WHERE csat_dx_item_attribute.${guard.replace('source', 'source').replace(' AND reviewed_at', ' AND csat_dx_item_attribute.reviewed_at')};` : '-- 문항 행 upsert 없음',
  deletes.length ? `DELETE FROM public.csat_dx_item_attribute WHERE ${guard} AND (item_id, attribute_code) IN (VALUES\n  ${deletes.join(',\n  ')});` : '-- 문항 행 delete 없음',
  'COMMIT;',
  '',
].join('\n')
const sqlPath = path.join(ROOT, 'scripts/db/proposed-20261008-seed-v2.sql')
fs.writeFileSync(sqlPath, sql)
console.log(JSON.stringify({
  m2409: { rows: m24.length, reviewed: m24.filter((r) => r.reviewed_at).length, ready: exam?.diagnosis_ready, changedItems: changed },
  seedV2: { exams: touchedExams.size, items: touchedItems.size, upserts: upserts.length, deletes: deletes.length, typeUpserts: typeRows.length, typeDeletes: typeDeletes.length, skippedReviewed, totalItems: items.length, examsWithAttrs: new Set(items.map((i) => i.exam_id)).size },
  sha256: crypto.createHash('sha256').update(sql).digest('hex'),
}, null, 1))
