// scripts/csat/diagnosis/canon-prepare.mts
//
// 정본 저장 · 시드 반영 준비물(2026-10-08) — **DB 읽기만 한다. 아무것도 쓰지 않는다.**
//   1) docs/csat-learner/pilot-runs/M2409-canon-diff.md — 실제 M2409 현재 행(시드) → 최종 태그(dual-model reviewed) 문항별 diff · 출처(Claude · Codex)
//   cd apps/web && node <tsx cli> --env-file=<.env.local> ../../scripts/csat/diagnosis/canon-prepare.mts
import fs from 'node:fs'
import path from 'node:path'

import { createClient } from '@supabase/supabase-js'

import { ATTRIBUTE_CODES } from '../../../apps/web/src/lib/csat/diagnosis/engine/types.ts'
import type { Weights } from '../../../apps/web/src/lib/csat/diagnosis/seed-rules.ts'

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
// 저장할 값 = tri-model adjudicated(2026-10-08 · 존재가 갈린 22칸 블라인드 3차 판정)
type Cell = { code: string; third: { value: number; why: string }; exists: boolean; final: number; taxonomy_ambiguous: boolean }
const final = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'pilot/M2409-review-tri.json'), 'utf8')) as { rule: string; reviewers: string; status: string; items: { no: number; w: Weights; claude: Weights; codex: Weights; cells: Cell[] }[] }
const m24 = await attrsOf('M2409')
const [exam] = await must(db.from('csat_exams').select('id, diagnosis_ready').eq('id', 'M2409'), 'exam')
const cur = (no: number) => Object.fromEntries(ATTRIBUTE_CODES.map((c) => [c, Number(m24.find((r) => r.item_id === `M2409#${no}` && r.attribute_code === c)?.weight ?? 0)])) as Weights
const fmt = (w: Weights, hi: Set<string>) => ATTRIBUTE_CODES.map((c) => (hi.has(c) ? `**${c}:${w[c]}**` : `${c}:${w[c]}`)).join(' ')
let changed = 0
const lines = [
  '# M2409 정본 저장 전 diff — 현재 DB(유형 기본값 시드) → 최종 태그(tri-model adjudicated)',
  '',
  `> 생성 2026-10-08 · \`scripts/csat/diagnosis/canon-prepare.mts\`(DB 읽기만). 현재 DB: 역량 행 ${m24.length} · 검수 표지 ${m24.filter((r) => r.reviewed_at).length} · diagnosis_ready=${exam?.diagnosis_ready}.`,
  `> 최종 태그 출처: ${final.reviewers}. 규칙: ${final.rule}. 상태: ${final.status}.`,
  '> 축 관측 계약(axis-routing): R · E 기출 관측 · V · X 보조(구분 확인) · S 직접 확인 · L 범위 밖 — 정본은 「모든 축을 기출로 판정」이 아니다.',
  '> 저장 방법(승인 뒤): 관리자 태깅 화면 「검수 저장」 = `csat_dx_save_item_tagging`(문항마다 9개 · 0 포함) → 판정 28/28 · 252행 · 구조 0 확인 → 관리자 「진단 반영 켜기」. 직접 UPDATE 금지.',
  '> 굵은 글씨 = 현재 DB 와 다른 역량.',
  '',
]
for (const it of final.items) {
  const c = cur(it.no)
  const hi = new Set(ATTRIBUTE_CODES.filter((a) => c[a] !== it.w[a]))
  if (hi.size) changed++
  lines.push(`### ${it.no}번`, `- 현재 DB: ${fmt(c, hi)}`, `- 저장할 값: ${fmt(it.w, hi)}`, `- Claude: ${fmt(it.claude, new Set())}`, `- Codex: ${fmt(it.codex, new Set())}`)
  for (const cell of it.cells ?? []) lines.push(`- 3차(${cell.code}): ${cell.third.value} → 최종 ${cell.final}(존재 ${cell.exists ? '예' : '아니오'})${cell.taxonomy_ambiguous ? ' · **taxonomy_ambiguous**' : ''} — ${cell.third.why}`)
  lines.push('')
}
lines.splice(6, 0, `요약: 28문항 중 현재 DB 와 다른 문항 ${changed} · 저장 후 행 252(9 × 28) · 검수 표지 28문항.`, '')
fs.writeFileSync(path.join(ROOT, 'docs/csat-learner/pilot-runs/M2409-canon-diff.md'), lines.join('\n'))

// 시드 v2 반영 SQL 생성은 이 통합(main)에서 뺐다 — seed v2 는 승인 보류(원본 feat/map-vnext 에만 있다)
console.log(JSON.stringify({
  m2409: { rows: m24.length, reviewed: m24.filter((r) => r.reviewed_at).length, ready: exam?.diagnosis_ready, changedItems: changed },
}, null, 1))
