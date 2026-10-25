// apps/web/src/app/api/csat/item/[slug]/judgment/bound-item.ts
// **서버 전용** — 문항 페이지(첫 응답)와 판단 라우트(공개 응답)가 같은 규칙으로 D 판단 도구 문항을 만든다(T-0161).
//
// 규칙: G 어댑터(lib/csat/binding/adapter.ts)의 현재 판본 결속 — 현재 원문 해시에 맞는 최고 units_version 과 그 단위에 결속된
// 최고 published 분석 — 으로 BoundItem 을 만들고, toJudgmentItem 이 block 이유 없이 낸 JudgmentItem 만 쓴다.
// D server.ts 의 loadJudgmentItem 은 넘겨받은 analysis_version 을 그대로 쓰므로 쓰지 않는다(여러 published 판 문항).
// 추가 조건: 결속 판이 해설 극장이 읽은 판본(최신 published, expectedVersion)과 같아야 한다 — 다르면 도구 · 원장 · 해설 판본이 갈린다.
// 정답(answer · answers) · 선지 분석은 결속 판정에만 서버에서 읽고, 반환값(JudgmentItem)에는 싣지 않는다.
import 'server-only'

import fs from 'node:fs'
import path from 'node:path'

import type { SupabaseClient } from '@supabase/supabase-js'

import { bindItem, toJudgmentItem, type AnalysisRow, type ItemRow, type UnitsRow } from '@/lib/csat/binding/adapter'
import { judgmentItemValidity } from '@/lib/csat/binding/invalidate'
import type { PdfAnchorFile } from '@/lib/csat/binding/pdf'
import { isBlocking } from '@/lib/csat/binding/readiness'
import type { JudgmentItem } from '@/lib/csat/judgment/types'
import { lectureMeta } from '@/lib/csat/lecture/store'

/** 제품에 연결한 단계 — 첫 연결은 R-IRRELEVANT 만(TypeJudgment 'first') */
export const JUDGMENT_STAGES = ['first'] as const
/** 'first' 단계 유형(TypeJudgment.JUDGMENT_TOOLS 와 같다) — 클라이언트 모듈 함수는 서버에서 부를 수 없어 여기 둔다. 화면은 TypeJudgment 가 한 번 더 거른다 */
export const JUDGMENT_TOOL_TYPES: ReadonlySet<string> = new Set(['R-IRRELEVANT'])

export type BoundJudgment = { item: JudgmentItem } | { item: null; reason: string }

function pdfAnchored(examId: string, no: number): boolean {
  // 경고 등급(no_pdf_anchor)에만 쓰인다 — 못 읽으면 false(경고)로 둔다. 차단 판정에는 영향이 없다
  try {
    const f = path.join(process.cwd(), 'src/lib/csat/anchor-data', `${examId}.json`)
    if (!fs.existsSync(f)) return false
    const d = JSON.parse(fs.readFileSync(f, 'utf8')) as PdfAnchorFile
    return d.items.some((x) => x.no === no)
  } catch {
    return false
  }
}

/**
 * @param db service-role 클라이언트(csat_item_units · csat_current_units_many 는 authenticated 권한이 없다)
 * @param expectedVersion 해설 극장이 읽은 분석 판본(CsatItemExplain.analysis_version)
 */
export async function loadBoundJudgmentItem(db: SupabaseClient, itemId: string, expectedVersion: number | null): Promise<BoundJudgment> {
  if (expectedVersion == null) return { item: null, reason: 'no_analysis' }
  const it = await db.from('csat_items').select('id,exam_id,no,type_id,stem,passage,choices,answer,answers,body_ok').eq('id', itemId).limit(1)
  if (it.error) return { item: null, reason: 'db' }
  const row = (it.data?.[0] ?? null) as ItemRow | null
  if (!row) return { item: null, reason: 'no_item' }
  // 도구가 없는 유형은 결속을 읽지도 않는다
  if (!row.type_id || !JUDGMENT_TOOL_TYPES.has(row.type_id)) return { item: null, reason: 'no_tool' }
  // 강의가 있는 문항에는 도구를 붙이지 않는다(T-0161 r2 · 강의 진행 × 도구 조작 동시 노출은 실물 검증 전)
  if (lectureMeta(itemId)) return { item: null, reason: 'lecture_present' }
  const [u, an] = await Promise.all([
    db.rpc('csat_current_units_many', { p_items: [itemId] }),
    db.from('csat_item_analyses').select('version,status,units_version,units_hash,answer_locus,choice_analysis').eq('item_id', itemId).eq('status', 'published'),
  ])
  if (u.error || an.error) return { item: null, reason: 'db' }
  const units = (((u.data ?? []) as (UnitsRow & { item_id: string })[]).find((x) => x.item_id === itemId) ?? null) as UnitsRow | null
  let inputHash = units?.input_hash ?? null
  if (!inputHash) {
    const h = await db.rpc('csat_item_input_hash', { p_item: itemId })
    if (h.error || h.data == null) return { item: null, reason: 'db' }
    inputHash = String(h.data)
  }
  const bound = bindItem({ item: row, inputHash, units, analyses: (an.data ?? []) as AnalysisRow[], pdfAnchored: pdfAnchored(row.exam_id, row.no) })
  const out = toJudgmentItem(bound, row, units, isBlocking)
  if (!out.item) return { item: null, reason: out.reasons.filter(isBlocking).join(',') || 'blocked' }
  // G 무효화 판정 — 지금 판본에 대 valid 인 것만
  const v = judgmentItemValidity(out.item, {
    itemId,
    inputHash,
    passage: row.passage ?? '',
    unitsVersion: bound.basis.unitsVersion,
    unitsHash: bound.basis.unitsHash,
    analysisVersion: bound.analysisVersion,
  })
  if (v.status !== 'valid') return { item: null, reason: `stale:${v.reasons.join(',')}` }
  if (out.item.version.analysisVersion !== expectedVersion) return { item: null, reason: 'version_mismatch' }
  return { item: out.item }
}
