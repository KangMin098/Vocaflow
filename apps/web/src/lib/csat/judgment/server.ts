// apps/web/src/lib/csat/judgment/server.ts
// **서버 전용** — 판단 도구의 제품 연결 로더. 문항 페이지(첫 응답)는 loadJudgmentItem 만, 판단 라우트(노출 원장 커밋 뒤)는
// loadJudgmentReveal 만 부른다. 두 로더는 같은 분석 판본(analysisVersion)과 그 판본의 원문 단위(units_version · units_hash)에
// 묶이고, 판본이 맞지 않으면 아무것도 내지 않는다(틀린 근거보다 근거 없음).
//
// csat_item_units 는 authenticated 에 SELECT 권한이 없다(RLS 정책 0 · 2026-10-24 확인) — 호출자는 서버의 service-role
// 클라이언트(createAdminClient)를 넘긴다. 스키마 변경은 없다. 클라이언트 컴포넌트는 이 파일을 import 하지 않는다.
import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import type { ChoiceAnalysis, EvidenceUnit, JudgmentItem, RevealData } from './types'

export type JudgmentUnavailable = { state: 'unavailable'; reason: 'no-item' | 'no-analysis' | 'version-mismatch' | 'no-units' | 'shape' | 'db' }
export type JudgmentItemLoad = { state: 'ready'; item: JudgmentItem } | JudgmentUnavailable

type AnalysisRow = { version: number; units_version: number | null; units_hash: string | null; status: string; design_intent: string | null; answer_locus: unknown; choice_analysis: unknown }
type UnitRow = { units: { id: string; n: number; kind: string; text: string }[]; units_version: number; units_hash: string }

async function boundAnalysis(db: SupabaseClient, itemId: string, analysisVersion: number) {
  const { data, error } = await db
    .from('csat_item_analyses')
    .select('version, units_version, units_hash, status, design_intent, answer_locus, choice_analysis')
    .eq('item_id', itemId)
    .eq('version', analysisVersion)
    .eq('status', 'published')
    .limit(1)
  if (error) return { error: 'db' as const }
  const a = (data?.[0] ?? null) as AnalysisRow | null
  if (!a) return { error: 'no-analysis' as const }
  if (a.units_version == null) return { error: 'no-units' as const }
  const u = await db.from('csat_item_units').select('units, units_version, units_hash').eq('item_id', itemId).eq('units_version', a.units_version).limit(1)
  if (u.error) return { error: 'db' as const }
  const units = (u.data?.[0] ?? null) as UnitRow | null
  if (!units || !Array.isArray(units.units) || units.units.length < 2) return { error: 'no-units' as const }
  if (a.units_hash && units.units_hash !== a.units_hash) return { error: 'version-mismatch' as const }
  return { a, units }
}

/**
 * 공개 전 문항 자료 — 정답 번호 · verdict · 정답 위치 · 해설을 읽지도 않는다(select 에 없음).
 * analysisVersion 은 문항 페이지가 이미 읽은 판본(CsatItemExplain.analysis_version)을 넘긴다 — 해설 판본과 원문 단위가 갈리지 않게.
 */
export async function loadJudgmentItem(db: SupabaseClient, itemId: string, analysisVersion: number | null): Promise<JudgmentItemLoad> {
  if (analysisVersion == null) return { state: 'unavailable', reason: 'no-analysis' }
  const it = await db.from('csat_items').select('id, exam_id, no, type_id, stem, choices').eq('id', itemId).limit(1)
  if (it.error) return { state: 'unavailable', reason: 'db' }
  const row = it.data?.[0] as { id: string; exam_id: string; no: number; type_id: string | null; stem: string | null; choices: unknown } | undefined
  if (!row) return { state: 'unavailable', reason: 'no-item' }
  if (!row.type_id || !row.stem || !Array.isArray(row.choices) || row.choices.length !== 5 || !row.choices.every((c) => typeof c === 'string')) return { state: 'unavailable', reason: 'shape' }
  const bound = await boundAnalysis(db, itemId, analysisVersion)
  if ('error' in bound) return { state: 'unavailable', reason: bound.error ?? 'db' }
  const units: EvidenceUnit[] = bound.units.units.map((x) => ({ id: x.id, n: x.n, kind: x.kind, text: x.text }))
  return {
    state: 'ready',
    item: {
      id: row.id,
      examId: row.exam_id,
      no: row.no,
      typeId: row.type_id,
      stem: row.stem,
      choices: row.choices as string[],
      units,
      version: { unitsVersion: bound.units.units_version, unitsHash: bound.units.units_hash, analysisVersion: bound.a.version },
    },
  }
}

/**
 * 공개 자료 — 판단 라우트가 노출 원장(answer_direct) 커밋에 성공한 **뒤에만** 부른다.
 * 요청 판본과 다르면 null(라우트는 409 를 이미 냈어야 한다). 선지 분석이 5개가 아니면 null.
 */
export async function loadJudgmentReveal(db: SupabaseClient, itemId: string, analysisVersion: number): Promise<RevealData | null> {
  const it = await db.from('csat_items').select('answer').eq('id', itemId).limit(1)
  const answer = (it.data?.[0] as { answer: number | null } | undefined)?.answer
  if (it.error || answer == null) return null
  const bound = await boundAnalysis(db, itemId, analysisVersion)
  if ('error' in bound) return null
  const choices = bound.a.choice_analysis
  if (!Array.isArray(choices) || choices.length !== 5) return null
  return {
    id: itemId,
    analysisVersion: bound.a.version,
    unitsVersion: bound.units.units_version,
    answer,
    designIntent: bound.a.design_intent ?? undefined,
    answerLocus: (bound.a.answer_locus ?? undefined) as RevealData['answerLocus'],
    choices: choices as ChoiceAnalysis[],
  }
}
