// scripts/csat/map/v4/exam-readiness-report.mts
//
// 학습 지도 rev4.0 2차 §8 — 시험 전체의 「진단 반영 준비도」 보고서(읽기 전용 · DB 에 쓰지 않는다 · 활성화하지 않는다).
// 판정은 관리자 켜기 액션과 같은 함수(apps/web/src/lib/csat/diagnosis/readiness.ts examReadiness)를 그대로 쓴다 — 규칙을 다시 쓰지 않는다.
// 거기에 「무엇이 막고 있나」 원인 칸(구조 · 검수 · 시드 · 보류 · 원문 근거 · 문장 단위)을 더해 시험 단위 · 문항 단위 선행 작업량을 센다.
//   cd apps/web && node --env-file=.env.local --import tsx ../../scripts/csat/map/v4/exam-readiness-report.mts
// 출력: docs/csat-learner/v4/exam-readiness.json · docs/csat-learner/LEARNING_MAP_V4_EXAM_READINESS.md(생성물 — 손으로 고치지 않는다)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createClient } from '@supabase/supabase-js'

import { examReadiness, itemReview } from '../../../../apps/web/src/lib/csat/diagnosis/readiness.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
if (!String(process.env.NEXT_PUBLIC_SUPABASE_URL).includes('jajenrevcbmrpaliomxv')) throw new Error('개발 프로젝트가 아니다')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { persistSession: false } })

async function all<T>(table: string, select: string, filter?: (q: any) => any): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    let q = db.from(table).select(select).range(from, from + 999)
    if (filter) q = filter(q)
    const { data, error } = await q
    if (error) throw new Error(`${table}: ${error.message}`)
    out.push(...(data as T[]))
    if ((data ?? []).length < 1000) return out
  }
}

type Exam = { id: string; label: string; organizer: string | null; kind: string | null; grade: number | null; exam_year: number | null; month: number | null; diagnosis_ready: boolean | null }
const exams = await all<Exam>('csat_exams', 'id, label, organizer, kind, grade, exam_year, month, diagnosis_ready', (q) => q.order('id'))
const keys = await all<{ exam_id: string }>('csat_dx_answer_key', 'exam_id')
const items = await all<{ id: string; exam_id: string; answer: number | null; answers: number[] | null }>('csat_items', 'id, exam_id, answer, answers')
const attrs = await all<{ item_id: string; attribute_code: string; reviewed_at: string | null; source: string | null }>('csat_dx_item_attribute', 'item_id, attribute_code, reviewed_at, source')
const traps = await all<{ item_id: string }>('csat_dx_option_trap', 'item_id')
const analyses = await all<{ item_id: string; status: string }>('csat_item_analyses', 'item_id, status')
const units = await all<{ item_id: string }>('csat_item_units', 'item_id')
const { data: heldRows, error: heldErr } = await db.rpc('csat_ec_embargoed_exams', { p_exams: exams.map((e) => e.id) })
// 보류 판정을 못 읽으면 전부 「판정 실패」로 둔다(fail-closed — 보류가 아니라고 단정하지 않는다)
const heldFailed = !!heldErr
const held = new Set<string>(((heldRows ?? []) as unknown[]).map((r) => (typeof r === 'string' ? r : String((r as Record<string, unknown>).exam_id ?? (r as Record<string, unknown>).csat_ec_embargoed_exams ?? ''))))

const count = <T,>(rows: T[], key: (r: T) => string) => rows.reduce((m, r) => m.set(key(r), (m.get(key(r)) ?? 0) + 1), new Map<string, number>())
const keyCount = count(keys, (k) => k.exam_id)
const attrsByItem = new Map<string, typeof attrs>()
for (const a of attrs) attrsByItem.set(a.item_id, [...(attrsByItem.get(a.item_id) ?? []), a])
const trapItems = new Set(traps.map((t) => t.item_id))
const publishedItems = new Set(analyses.filter((a) => a.status === 'published').map((a) => a.item_id))
const unitItems = new Set(units.map((u) => u.item_id))

type Cause = 'READY' | 'HELD' | 'HELD_UNKNOWN' | 'STRUCTURAL' | 'NO_SEED' | 'REVIEW_NEEDED' | 'REVIEWED_NOT_ENABLED'
const rows = exams.map((e) => {
  const its = items.filter((i) => i.exam_id === e.id)
  const r = examReadiness(keyCount.get(e.id) ?? 0, its.map((i) => ({ id: i.id, hasAnswer: (i.answers?.length ?? 0) > 0 || i.answer !== null, attrs: (attrsByItem.get(i.id) ?? []).map((a) => ({ code: a.attribute_code, reviewed: a.reviewed_at !== null })) })))
  const seeded = its.filter((i) => (attrsByItem.get(i.id) ?? []).length > 0).length
  const reviewedItems = its.filter((i) => itemReview({ attrs: (attrsByItem.get(i.id) ?? []).map((a) => ({ code: a.attribute_code, reviewed: a.reviewed_at !== null })) }) === 'reviewed').length
  const cause: Cause = e.diagnosis_ready ? 'READY'
    : heldFailed ? 'HELD_UNKNOWN'
      : held.has(e.id) ? 'HELD'
        : r.structural.length ? 'STRUCTURAL'
          : seeded === 0 ? 'NO_SEED'
            : r.remaining > 0 ? 'REVIEW_NEEDED'
              : 'REVIEWED_NOT_ENABLED'
  return {
    id: e.id, label: e.label, organizer: e.organizer, kind: e.kind, grade: e.grade, year: e.exam_year, month: e.month,
    ready: e.diagnosis_ready === true, cause,
    keyRows: keyCount.get(e.id) ?? 0, items: its.length, seededItems: seeded, reviewedItems,
    remaining: r.remaining, structural: r.structural, reason: r.reason, canEnable: r.canEnable,
    trapItems: its.filter((i) => trapItems.has(i.id)).length,
    publishedAnalysis: its.filter((i) => publishedItems.has(i.id)).length,
    unitItems: its.filter((i) => unitItems.has(i.id)).length,
  }
})

const by = <K extends string>(f: (r: (typeof rows)[number]) => K) => rows.reduce((m, r) => ((m[f(r)] = (m[f(r)] ?? 0) + 1), m), {} as Record<K, number>)
const summary = {
  exams: rows.length,
  byCause: by((r) => r.cause),
  byOrganizer: by((r) => r.organizer ?? 'unknown'),
  canEnableNow: rows.filter((r) => r.canEnable && !r.ready).length,
  reviewItemsToGo: rows.filter((r) => r.cause === 'REVIEW_NEEDED').reduce((s, r) => s + r.remaining, 0),
  heldCheck: heldFailed ? 'failed' : 'ok',
}
// 다음 검수 후보 — 평가원 · 구조 문제 없음 · 최신 순(지도 기준 시험과 같은 방향), 남은 문항이 적은 것 먼저
const nextReview = rows.filter((r) => r.cause === 'REVIEW_NEEDED' && r.organizer === 'kice').sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || (b.month ?? 0) - (a.month ?? 0) || a.remaining - b.remaining).slice(0, 6).map((r) => ({ id: r.id, label: r.label, remaining: r.remaining, publishedAnalysis: r.publishedAnalysis, unitItems: r.unitItems }))

fs.writeFileSync(path.join(ROOT, 'docs/csat-learner/v4/exam-readiness.json'), JSON.stringify({ generated_by: 'scripts/csat/map/v4/exam-readiness-report.mts', rule: 'apps/web/src/lib/csat/diagnosis/readiness.ts examReadiness', summary, nextReview, rows }, null, 1) + '\n')

const CAUSE_KO: Record<Cause, string> = {
  READY: '진단 반영됨',
  HELD: '보류(오답 원인 수집 — Reveal Gate)',
  HELD_UNKNOWN: '보류 판정 실패(fail-closed)',
  STRUCTURAL: '구조 문제(정답표 · 문항 · 정답 — 검수로 안 풀림)',
  NO_SEED: '역량 시드 없음(태깅 행 0 — 시드부터)',
  REVIEW_NEEDED: '사람 검수 남음(역량 9 · 선지 함정)',
  REVIEWED_NOT_ENABLED: '검수 완료 · 켜기 전(관리자 승인 대기)',
}
const esc = (s: unknown) => String(s ?? '').replace(/\|/g, '\\|')
const md = [
  '# 학습 지도 rev4.0 — 시험 진단 반영 준비도(생성 보고서)',
  '',
  '> **생성물 — 손으로 고치지 않는다.** `scripts/csat/map/v4/exam-readiness-report.mts`(읽기 전용) · 원자료 [v4/exam-readiness.json](./v4/exam-readiness.json).',
  '> 판정 규칙은 관리자 켜기 액션과 같은 `examReadiness`(apps/web/src/lib/csat/diagnosis/readiness.ts). 이 보고서는 **아무 시험도 켜지 않는다** — 켜기는 관리자 검수 · 승인 경로(`setExamReady`)로만.',
  '',
  '## 요약',
  '',
  `- 시험 ${summary.exams}회 — ${Object.entries(summary.byCause).map(([k, v]) => `${CAUSE_KO[k as Cause]} ${v}`).join(' · ')}`,
  `- 출처: ${Object.entries(summary.byOrganizer).map(([k, v]) => `${k} ${v}`).join(' · ')}`,
  `- 지금 켤 수 있는데 꺼진 시험: ${summary.canEnableNow} · 검수 남은 시험의 남은 문항 합: ${summary.reviewItemsToGo} · 보류 판정: ${summary.heldCheck}`,
  '',
  '## 다음 검수 후보(평가원 · 최신 순 · 제안)',
  '',
  '| 시험 | 이름 | 남은 검수 문항 | 해설 발행 문항 | 문장 단위 문항 |',
  '|---|---|---|---|---|',
  ...nextReview.map((r) => `| ${r.id} | ${esc(r.label)} | ${r.remaining} | ${r.publishedAnalysis} | ${r.unitItems} |`),
  '',
  '검수 경로: 관리자 문항 태깅 검수(`csat_dx_save_item_tagging` RPC — 역량 9 · 선지 함정 한 트랜잭션) → 판정 「진단 반영 가능」 → 관리자 켜기. 문항 단위 원문 근거(Evidence Anchor)와 문장 단위(`csat_item_units`)는 진단 반영 조건이 **아니다** — rev4 직접 확인 콘텐츠를 만들 때의 선행 작업량으로만 센다.',
  '',
  '## 시험별',
  '',
  '| 시험 | 이름 | 출처 | 상태 · 원인 | 정답표 | 문항 | 역량 시드 문항 | 검수 문항 | 남은 문항 | 구조 문제 | 선지 함정 문항 | 해설 발행 문항 | 문장 단위 문항 |',
  '|---|---|---|---|---|---|---|---|---|---|---|---|---|',
  ...rows.map((r) => `| ${r.id} | ${esc(r.label)} | ${r.organizer ?? '—'} | ${CAUSE_KO[r.cause]} | ${r.keyRows} | ${r.items} | ${r.seededItems} | ${r.reviewedItems} | ${r.remaining} | ${esc(r.structural.join(' · ') || '—')} | ${r.trapItems} | ${r.publishedAnalysis} | ${r.unitItems} |`),
  '',
].join('\n')
fs.writeFileSync(path.join(ROOT, 'docs/csat-learner/LEARNING_MAP_V4_EXAM_READINESS.md'), md)
console.log(JSON.stringify(summary), '\nnext:', JSON.stringify(nextReview))
