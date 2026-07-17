// apps/web/src/lib/learner/prescription-actions.ts
//
// CTP Today 처방(prescribe_today) 서버 액션 — hub "오늘"의 스마트 기본값.
// META 확정(2026-07-11 · Opt A): 진단 완료 + 오늘 수동계획 없음 → 이 처방이 hub "오늘"의 정본.
//
// prescribe_today(uuid) = 결정론 5블록(복습→듣기→읽기→연습→검증, 60~75분, stage_band 기반).
//   SECURITY DEFINER · auth.uid() 게이트 → 서버 세션으로 본인 처방만.
//   블록은 학습 흔적을 되먹인 순수 처방(runtime-LLM 0). 상세: docs/proposals/hub-today-meta.md.

'use server'

import type { SupabaseClient } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/server'

/** 읽기(input) 블록 후보 — csat_stage_catalog(article∪book) 한 항목. */
export interface PrescriptionCandidate {
  kind: 'article' | 'book'
  id: string
  title: string
  vLevel: number | null
  register: string | null
  cefrLevel: string | null
}

/** hub "오늘" 처방 — prescribe_today 파싱 결과 + 분기·런처용 부가정보. */
export interface TodayPrescription {
  /** V-Level 진단 완료 여부 (분기 게이트 — 미진단이면 hub 는 진단 유도). */
  isDiagnosed: boolean
  /** 학습자 스테이지 'S1'~'Sn'. */
  stage: string
  stageNum: number
  totalMinutes: number
  /** ① 복습 — FSRS due 카드 수. */
  dueCount: number
  /** ③ 읽기 — stage_band + 후보(최대 5). */
  input: { stageBand: string; candidates: PrescriptionCandidate[] }
  /** ④ 연습(DCP) — Phase 2 인터랙션. Phase 1 은 상태 표시만. */
  practiceActive: boolean
  practiceCount: number
  /** ② 듣기(EchoMatch) 진입용 최근 텍스트(없으면 도서 라이브러리로 폴백). */
  listeningTextId: string | null
}

/** jsonb 블록 배열에서 kind 로 하나 찾기. */
function pickBlock(blocks: unknown, kind: string): Record<string, unknown> | null {
  if (!Array.isArray(blocks)) return null
  const found = blocks.find((b) => (b as { kind?: string } | null)?.kind === kind)
  return (found as Record<string, unknown>) ?? null
}

function parseCandidates(raw: unknown): PrescriptionCandidate[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((c) => c as Record<string, unknown>)
    .filter((c) => c && (c.kind === 'article' || c.kind === 'book') && typeof c.id === 'string')
    .map((c) => ({
      kind: c.kind as 'article' | 'book',
      id: c.id as string,
      title: (c.title as string) ?? '제목 없음',
      vLevel: typeof c.v_level === 'number' ? (c.v_level as number) : null,
      register: (c.register as string) ?? null,
      cefrLevel: (c.cefr_level as string) ?? null,
    }))
}

/**
 * hub "오늘" 처방을 조회한다.
 * @returns 로그인 안 됐으면 null. RPC 실패해도 isDiagnosed 는 채워 반환(카드 미표시 판단용).
 */
export async function fetchTodayPrescription(): Promise<TodayPrescription | null> {
  const client = await createClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) return null

  // prescribe_today 는 생성 타입 미반영 — 느슨한 client 로 rpc 접근(plan-actions loose 패턴 미러).
  const loose = client as unknown as SupabaseClient

  const [profileRes, rpcRes, latestTextRes] = await Promise.all([
    client
      .from('user_profiles')
      .select('current_v_level')
      .eq('user_id', user.id)
      .maybeSingle(),
    loose.rpc('prescribe_today', { p_user_id: user.id }),
    client
      .from('texts')
      .select('id')
      .eq('user_id', user.id)
      .not('last_opened', 'is', null)
      .order('last_opened', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const vLevel = (profileRes.data as { current_v_level: number | null } | null)?.current_v_level ?? null
  const isDiagnosed = vLevel !== null && vLevel > 0
  const listeningTextId = (latestTextRes.data as { id: string } | null)?.id ?? null

  const p = (rpcRes.data ?? null) as { stage?: string; blocks?: unknown; total_minutes?: number } | null
  if (rpcRes.error || !p) {
    return {
      isDiagnosed,
      stage: 'S1',
      stageNum: 1,
      totalMinutes: 0,
      dueCount: 0,
      input: { stageBand: 'S1', candidates: [] },
      practiceActive: false,
      practiceCount: 0,
      listeningTextId,
    }
  }

  const due = pickBlock(p.blocks, 'fsrs_due')
  const input = pickBlock(p.blocks, 'input')
  const practice = pickBlock(p.blocks, 'practice')

  const stage = typeof p.stage === 'string' ? p.stage : 'S1'
  const stageNum = Number.parseInt(stage.replace(/^S/, ''), 10) || 1
  const candidates = parseCandidates(input?.candidates)
  const practiceItems = practice?.items
  const practiceCount = Array.isArray(practiceItems) ? practiceItems.length : 0

  return {
    isDiagnosed,
    stage,
    stageNum,
    totalMinutes: typeof p.total_minutes === 'number' ? p.total_minutes : 0,
    dueCount: typeof due?.due_count === 'number' ? (due.due_count as number) : 0,
    input: { stageBand: (input?.stage_band as string) ?? stage, candidates },
    practiceActive: practice?.active === true && practiceCount > 0,
    practiceCount,
    listeningTextId,
  }
}
