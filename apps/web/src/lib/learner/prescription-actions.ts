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
  /**
   * 진단된 V-Level (0~11). 미진단이면 null.
   *
   * 이미 `user_profiles.current_v_level` 을 읽어 `isDiagnosed` 를 만들고 **값은 버리고
   * 있었다.** 셸의 사정권("지금 열린 책 N권")이 이 값 없이는 계산되지 않는데, 같은 컬럼을
   * 다시 읽으면 모든 라우트에 쿼리가 하나 더 붙는다. 버리지 않고 실어 보낸다 — 추가 쿼리 0.
   */
  vLevel: number | null
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
  /**
   * 처방을 **계산하지 못했는가**. true 면 아래 값들은 계산 결과가 아니라 폴백이다.
   *
   * 왜 필요한가: 이 플래그가 없어서 실패가 조용히 정상처럼 보였다. 2026-07-19 에
   * `csat_item_attempts` 가 삭제되면서 `derive_learner_stage` → `prescribe_today` 가
   * 모든 학습자에게 실패했는데, 폴백값(stage 'S1' · 0분 · due 0)이 **신규 학습자의 정상
   * 상태와 똑같아서** 3주 넘게 아무도 몰랐다. 화면은 "오늘 할 게 없다" 고 말했고
   * 그것이 계산 결과인지 실패인지 구별할 방법이 없었다.
   *
   * 폴백 자체는 유지한다(화면이 깨지는 것보다 낫다). 다만 **폴백임을 말한다.**
   */
  unavailable: boolean
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
    // 실패를 삼키지 않는다. 폴백값(S1 · 0분 · due 0)은 **신규 학습자의 정상 상태와 똑같아서**
    // 조용히 넘기면 아무도 모른다 — 실제로 csat_item_attempts 삭제로 3주 넘게 그랬다.
    if (rpcRes.error) {
      console.error(
        `[hub] prescribe_today 실패 — 폴백 처방을 반환합니다: ${rpcRes.error.message}`,
      )
    }
    return {
      isDiagnosed,
      vLevel,
      stage: 'S1',
      stageNum: 1,
      totalMinutes: 0,
      dueCount: 0,
      input: { stageBand: 'S1', candidates: [] },
      practiceActive: false,
      practiceCount: 0,
      listeningTextId,
      unavailable: true,
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
    vLevel,
    stage,
    stageNum,
    totalMinutes: typeof p.total_minutes === 'number' ? p.total_minutes : 0,
    dueCount: typeof due?.due_count === 'number' ? (due.due_count as number) : 0,
    input: { stageBand: (input?.stage_band as string) ?? stage, candidates },
    practiceActive: practice?.active === true && practiceCount > 0,
    practiceCount,
    listeningTextId,
    unavailable: false,
  }
}
