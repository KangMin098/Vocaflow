// apps/web/src/lib/csat/diagnosis/report.ts
//
// 학습자 진단 화면의 조회 — 시험 기록 + 문항 유형 + 선지 함정을 읽어 buildExamReport 에 넘긴다.
// **service role 클라이언트를 받는다** — 호출하는 페이지가 먼저 로그인을 확인하고 userId 는 그 세션에서 온다.
// csat_items 는 학습자에게 닫혀 있어 서버가 읽되, **번호·유형만** 읽는다(원문은 읽지도 넘기지도 않는다).

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { examEmbargoDecision } from '@/lib/csat/embargo-gate'
import { keysetSelect } from '@/lib/supabase/keyset-select'

import { buildExamReport, type ExamReport, type ReportItem, type ReportSession } from './engine/exam-report'
import { selectByChunks, selectSmall } from './fetch'
import { loadTrapFamily } from './server'

type Db = SupabaseClient

export interface PickerExam {
  id: string
  label: string
  organizer: 'kice' | 'edu_office'
  kind: string
  grade: number | null
  year: number | null
  month: number | null
}

/** 기록할 수 있는 회차 — 45문항 정답표가 있는 학평 · 모평 · 수능 */
export async function loadPickerExams(db: Db): Promise<PickerExam[]> {
  const keys = await selectSmall<{ exam_id: string }>(() => db.from('csat_dx_answer_key').select('exam_id').eq('no', 1), 'csat_dx_answer_key')
  const exams = await selectByChunks<PickerExam>(
    keys.map((k) => k.exam_id),
    300,
    (chunk) => db.from('csat_exams').select('id, label, organizer, kind, grade, year, month').in('id', chunk),
    'csat_exams',
  )
  return exams
}

export async function loadTypeNames(db: Db): Promise<Record<string, string>> {
  const rows = await selectSmall<{ id: string; name: string }>(() => db.from('csat_types').select('id, name'), 'csat_types')
  return Object.fromEntries(rows.map((r) => [r.id, r.name]))
}

interface SessionRow {
  id: string
  exam_id: string
  mode: 'live' | 'retake'
  taken_at: string
  created_at: string
  raw_score: number | null
  grade: number | null
}

export async function loadExamReport(db: Db, userId: string): Promise<{ report: ExamReport; typeNames: Record<string, string> }> {
  // 기록 키만 먼저(점수 없이) → Reveal Gate 로 보류 시험(오답 원인 Pilot 수집 중 · 요청자 무관)의 기록을 뺀다 → 남은 기록의 점수 · 응답만 읽는다
  const keys = await keysetSelect<Omit<SessionRow, 'raw_score' | 'grade'>, string>(
    (cursor, limit) => {
      const q = db.from('csat_dx_session').select('id, exam_id, mode, taken_at, created_at')
        .eq('user_id', userId).in('mode', ['live', 'retake']).not('exam_id', 'is', null).order('id').limit(limit)
      return cursor === null ? q : q.gt('id', cursor)
    },
    (row) => row.id,
    'csat_dx_session',
  )
  // 판정 실패를 「기록 없음」으로 보이지 않는다(재입력 유도 금지 · Codex P2) — 조회 실패로 던져 화면이 오류를 말하게
  const { held, failed } = await examEmbargoDecision(keys.map((k) => k.exam_id))
  if (failed) throw new Error('보류 판정 실패 — 기록을 지금 열 수 없다')
  const visible = keys.filter((k) => !held.has(k.exam_id))
  const scores = new Map(
    (await selectByChunks<{ id: string; raw_score: number | null; grade: number | null }>(
      visible.map((k) => k.id),
      100,
      (chunk) => db.from('csat_dx_session').select('id, raw_score, grade').eq('user_id', userId).in('id', chunk),
      'csat_dx_session 점수',
    )).map((r) => [r.id, r]),
  )
  const sessions: SessionRow[] = visible.map((k) => ({ ...k, raw_score: scores.get(k.id)?.raw_score ?? null, grade: scores.get(k.id)?.grade ?? null }))
  const examIds = [...new Set(sessions.map((s) => s.exam_id))]
  // 세션당 응답 45행 → 20세션 묶음 900행
  const [responses, exams, itemRows, trapFamily, typeNames] = await Promise.all([
    selectByChunks<{ session_id: string; item_no: number; chosen_option: number | null; is_correct: boolean }>(
      sessions.map((s) => s.id),
      20,
      (chunk) => db.from('csat_dx_response').select('session_id, item_no, chosen_option, is_correct').in('session_id', chunk),
      'csat_dx_response',
    ),
    selectByChunks<{ id: string; label: string }>(examIds, 300, (chunk) => db.from('csat_exams').select('id, label').in('id', chunk), 'csat_exams'),
    // 회차당 문항 ≤ 28 → 30회차 묶음 840행. 번호·유형만
    selectByChunks<{ id: string; exam_id: string; no: number; type_id: string }>(
      examIds,
      30,
      (chunk) => db.from('csat_items').select('id, exam_id, no, type_id').in('exam_id', chunk),
      'csat_items',
    ),
    loadTrapFamily(db),
    loadTypeNames(db),
  ])
  // 문항당 함정 ≤ 5행 → 150문항 묶음 750행
  const traps = await selectByChunks<{ item_id: string; option_no: number; trap_key: string }>(
    itemRows.map((i) => i.id),
    150,
    (chunk) => db.from('csat_dx_option_trap').select('item_id, option_no, trap_key').in('item_id', chunk),
    'csat_dx_option_trap',
  )

  // 해설 링크는 학습자에게 공개된 문항(csat_items_public)만 — 미발행 학평 문항으로 가면 404 다
  const publicIds = new Set(
    (await selectByChunks<{ id: string }>(itemRows.map((i) => i.id), 300, (chunk) => db.from('csat_items_public').select('id').in('id', chunk), 'csat_items_public')).map((r) => r.id),
  )
  const labelOf = new Map(exams.map((e) => [e.id, e.label]))
  const items: Record<string, Record<number, ReportItem>> = {}
  const byItemId = new Map<string, ReportItem>()
  for (const i of itemRows) {
    const it: ReportItem = { no: i.no, itemId: publicIds.has(i.id) ? i.id : null, typeId: i.type_id, traps: {} }
    ;(items[i.exam_id] ??= {})[i.no] = it
    byItemId.set(i.id, it)
  }
  for (const t of traps) {
    const it = byItemId.get(t.item_id)
    if (it) it.traps[t.option_no] = t.trap_key
  }

  const answersBy = new Map<string, ReportSession['answers']>()
  for (const r of responses) {
    const list = answersBy.get(r.session_id) ?? []
    list.push({ no: r.item_no, chosen: r.chosen_option, correct: r.is_correct })
    answersBy.set(r.session_id, list)
  }
  const reportSessions: ReportSession[] = sessions.map((s) => ({
    id: s.id,
    examId: s.exam_id,
    examLabel: labelOf.get(s.exam_id) ?? s.exam_id,
    takenAt: s.taken_at,
    createdAt: s.created_at,
    mode: s.mode,
    raw: s.raw_score ?? 0,
    grade: s.grade,
    answers: (answersBy.get(s.id) ?? []).sort((a, b) => a.no - b.no),
  }))

  return { report: buildExamReport(reportSessions, items, trapFamily), typeNames: { ...typeNames, LISTEN: '듣기' } }
}
