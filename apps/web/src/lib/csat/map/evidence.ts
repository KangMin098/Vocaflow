// apps/web/src/lib/csat/map/evidence.ts
//
// 스냅샷 저장 때 학습 지도용 성취율(engine/map-evidence)을 계산해 evidence 에 더한다 — **지도 전용 처리 전체를 여기 가둔다.**
// 게이트: csat_map_line_link 가 있고 시드돼 있을 때만 켠다(마이그레이션 미적용 · 시드 전에도 기존 기록 저장은 그대로).
// 실패 격리: 이 함수는 던지지 않는다. 조회 · 계산이 실패해도 status 'failed' 만 남기고 기존 스냅샷 키는 건드리지 않는다.

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { selectByChunks, selectSmall } from '../diagnosis/fetch'
import { embargoedExamIds } from '../embargo-gate'
import { computeMapEvidence, type MapEvidence, type MapLineInput } from '../diagnosis/engine/map-evidence'
import type { EngineInput } from '../diagnosis/engine/types'

export type MapEvidenceStatus = 'ok' | 'off' | 'failed'

/** PostgREST / Postgres 의 「그런 테이블이 없다」 */
const MISSING_TABLE = new Set(['42P01', 'PGRST205'])

const keyOf = (examId: string, no: number) => `${examId}#${no}`

export async function mapEvidenceFor(
  db: SupabaseClient,
  input: EngineInput,
): Promise<{ status: MapEvidenceStatus; evidence: MapEvidence | null }> {
  try {
    // Reveal Gate — 입력(buildInput)은 이미 보류 시험 기록을 뺐다. 그래도 섞였으면 정오 파생 지표를 계산하지 않는다(embargo-gate · 판정 실패도 보류)
    const sessionExams = input.sessions.map((s) => s.examId).filter((x): x is string => Boolean(x))
    if ((await embargoedExamIds(sessionExams)).size > 0) return { status: 'off', evidence: null }
    // 게이트 — 오류를 0 으로 삼키지 않는다: 테이블 없음(미설치)과 그 밖의 오류를 가른다
    const probe = await db.from('csat_map_line_link').select('line_code').limit(1)
    if (probe.error) {
      if (probe.error.code && MISSING_TABLE.has(probe.error.code)) return { status: 'off', evidence: null }
      throw new Error(probe.error.message)
    }
    if ((probe.data ?? []).length === 0) return { status: 'off', evidence: null }

    const links = await selectSmall<{ line_code: string; link_kind: string; ref: string }>(
      () => db.from('csat_map_line_link').select('line_code, link_kind, ref').in('link_kind', ['type', 'item_no']),
      'csat_map_line_link',
    )
    const byType: MapLineInput['byType'] = {}
    const byNo: MapLineInput['byNo'] = {}
    for (const l of links) {
      if (l.link_kind === 'type') byType[l.ref] = l.line_code
      else {
        // item_no 의 ref = `<시험 id>#<번호>` — 회차별로 승인된 번호표만 들어 있다
        const [examId, no] = l.ref.split('#')
        if (examId && Number.isInteger(Number(no))) (byNo[examId] ??= {})[Number(no)] = l.line_code
      }
    }

    // 시험 목록 = 기록한 시험 + 진단 테스트 문항의 원시험(배점이 거기 있다)
    const examIds = [...new Set([...Object.keys(input.exams), ...Object.values(input.items).map((m) => m.examId)])]
    const typeRows = await selectByChunks<{ exam_id: string; no: number; type_id: string | null }>(
      examIds,
      20,
      (chunk) => db.from('csat_items').select('exam_id, no, type_id').in('exam_id', chunk),
      'csat_items',
    )
    const keyRows = await selectByChunks<{ exam_id: string; no: number; points: number }>(
      examIds,
      20,
      (chunk) => db.from('csat_dx_answer_key').select('exam_id, no, points').in('exam_id', chunk),
      'csat_dx_answer_key',
    )
    const typeOf: MapLineInput['typeOf'] = {}
    for (const r of typeRows) typeOf[keyOf(r.exam_id, r.no)] = r.type_id
    const pointsOf: MapLineInput['pointsOf'] = {}
    for (const r of keyRows) pointsOf[keyOf(r.exam_id, r.no)] = r.points

    return { status: 'ok', evidence: computeMapEvidence(input, { byType, byNo, typeOf, pointsOf }) }
  } catch (e) {
    console.warn(`[csat-map] 지도 지표 계산 실패(기존 스냅샷은 그대로 저장): ${e instanceof Error ? e.message : String(e)}`)
    return { status: 'failed', evidence: null }
  }
}
