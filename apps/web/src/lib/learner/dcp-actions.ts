// apps/web/src/lib/learner/dcp-actions.ts
//
// CTP DCP(구문 연습) 서버 액션 — Phase 2.
//   fetchDcpPracticeItems : 오늘 처방(prescribe_today) practice 블록 문항(payload 포함) 조회. S3+ 에서만 active.
//   gradeDcpItem          : grade_dcp_item RPC(서버 answer_key 채점) → {correct, attemptId, answerKey}. attempt 기록.
//   recordDcpErrorCause   : 오답 attempt 에 error_cause 부착(RLS owner + CHECK 5원인).

'use server'

import type { SupabaseClient } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/server'

import type { DcpErrorCause, DcpGradeResult, DcpItem } from './dcp'
import { SERIES_SPINE } from '@vocaflow/library-pipeline'

import { fetchMyTextbooks } from '@/lib/textbook/my-shelf-query'

import { isChoiceDcpType, isPlayableDcpType } from './dcp-types'

const ALLOWED_CAUSES: readonly DcpErrorCause[] = ['vocab', 'parsing', 'structure', 'inference', 'timing']

/**
 * prescribe_today practice 블록의 raw 문항 하나를 DcpItem 으로 검증·정규화. 부적격이면 null.
 *
 * ⚠️ `csat_dcp_items` 에는 **교재(인쇄물)에만 쓰는 유형도 함께 저장된다**
 *   (`irrelevant`·`word_order`·`vocab_choice`). 처방이 그것을 뽑아 오면 여기서 `null` 이
 *   되어 학습자가 조용히 문항을 잃는다 — 2026-08-21 에 실제로 그랬다(발행 카탈로그 안
 *   42.5%). 막는 쪽은 `prescribe_today` 의 허용 목록이고, 여기서는 **어느 갈래인지 먼저
 *   확인해** 의도를 코드에 남긴다.
 */
function parseItem(raw: unknown): DcpItem | null {
  const r = raw as Record<string, unknown> | null
  if (!r || typeof r.id !== 'string') return null
  const type = r.type
  // 교재용 유형은 화면이 그리지 못한다 — 여기서 걸러 낸 것이 곧 처방이 새고 있다는 뜻이다.
  if (!isPlayableDcpType(type)) return null
  const payload = r.payload as Record<string, unknown> | null
  if (!payload) return null

  if (type === 'order') {
    const presented = (payload as { presented?: unknown }).presented
    if (!Array.isArray(presented) || presented.length < 2) return null
    return {
      id: r.id,
      type: 'order',
      paragraphIdx: typeof r.paragraph_idx === 'number' ? r.paragraph_idx : 0,
      payload: { presented: presented.map((s) => String(s)) },
    }
  }
  if (type === 'insert') {
    const remaining = (payload as { remaining?: unknown }).remaining
    const insertSentence = (payload as { insert_sentence?: unknown }).insert_sentence
    const gapCount = (payload as { gap_count?: unknown }).gap_count
    if (!Array.isArray(remaining) || typeof insertSentence !== 'string') return null
    return {
      id: r.id,
      type: 'insert',
      paragraphIdx: typeof r.paragraph_idx === 'number' ? r.paragraph_idx : 0,
      payload: {
        remaining: remaining.map((s) => String(s)),
        insert_sentence: insertSentence,
        gap_count: typeof gapCount === 'number' ? gapCount : remaining.length + 1,
      },
    }
  }

  // ── 선택지 9종 ────────────────────────────────────────────────
  // 아홉이 한 갈래인 이유는 **모양이 같아서**다(payload·answer_key 실측 동일).
  // 유형마다 분기를 두면 아홉 벌이 조금씩 어긋난 채 남는다.
  if (isChoiceDcpType(type)) {
    const passage = (payload as { passage?: unknown }).passage
    const choices = (payload as { choices?: unknown }).choices
    const stemKo = (payload as { stem_ko?: unknown }).stem_ko
    // 선택지가 5개가 아니면 문항이 성립하지 않는다 — 그리면 학습자가 못 푸는 화면이 된다.
    if (typeof passage !== 'string' || !passage.trim()) return null
    if (!Array.isArray(choices) || choices.length !== 5) return null
    if (typeof stemKo !== 'string' || !stemKo.trim()) return null
    const underline = (payload as { underline?: unknown }).underline
    const summarySentence = (payload as { summary_sentence?: unknown }).summary_sentence
    return {
      id: r.id,
      type,
      paragraphIdx: typeof r.paragraph_idx === 'number' ? r.paragraph_idx : 0,
      payload: {
        passage,
        choices: choices.map((c) => String(c)),
        stemKo,
        underline: typeof underline === 'string' && underline.trim() ? underline : null,
        summarySentence: typeof summarySentence === 'string' && summarySentence.trim() ? summarySentence : null,
      },
    }
  }
  return null
}

/**
 * 담은 교재가 덮는 V-Level 목록.
 *
 * ⚠️ **사다리는 여기서 푼다.** `prescribe_today` 는 레벨만 알고 step 을 모른다 —
 *    step → V-Level 매핑의 정본은 `SERIES_SPINE` 이고, SQL 에 복사하면 눈금이 둘이 되어
 *    반드시 갈린다(`user_textbook_selections` 가 step 번호만 저장한 이유와 같다).
 *
 * 못 읽으면 빈 배열 — 그러면 처방은 예전과 똑같이 동작한다(담기가 오늘 할 것을 줄이지 않는다).
 */
async function pickedVLevels(): Promise<number[]> {
  const mine = await fetchMyTextbooks()
  if (!mine.available || mine.steps.length === 0) return []
  const levels = new Set<number>()
  for (const rung of SERIES_SPINE) {
    if (mine.steps.includes(rung.step)) for (const lv of rung.vLevels) levels.add(lv)
  }
  return [...levels].sort((a, b) => a - b)
}

/**
 * 오늘 처방의 구문 연습(DCP) 문항. S3 미만이거나 문항 없으면 active=false.
 *
 * `steered` = 이 문항들이 **담은 교재에서** 나왔는가. 화면이 그 사실을 말할 수 있어야
 * "담기가 무엇을 바꿨는지" 를 학습자가 안다 — 안 그러면 또 보이지 않는 약속이 된다.
 */
export async function fetchDcpPracticeItems(): Promise<{
  active: boolean
  items: DcpItem[]
  steered: boolean
}> {
  const client = await createClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) return { active: false, items: [], steered: false }

  const loose = client as unknown as SupabaseClient
  const { data, error } = await loose.rpc('prescribe_today', {
    p_user_id: user.id,
    p_v_levels: await pickedVLevels(),
  })
  if (error || !data) return { active: false, items: [], steered: false }

  const blocks = (data as { blocks?: unknown }).blocks
  const practice = Array.isArray(blocks)
    ? (blocks.find((b) => (b as { kind?: string } | null)?.kind === 'practice') as Record<string, unknown> | undefined)
    : undefined
  if (!practice || practice.active !== true) return { active: false, items: [], steered: false }

  const raw = practice.items
  const items = Array.isArray(raw) ? raw.map(parseItem).filter((x): x is DcpItem => x !== null) : []
  return { active: items.length > 0, items, steered: practice.steered === true }
}

/**
 * 교재 계단(V-Level)의 연습 문항을 가져온다 — **오늘 처방과 다른 경로다.**
 *
 * ── 왜 따로 있나 ────────────────────────────────────────────────────
 * `fetchDcpPracticeItems` 는 오늘 처방을 읽으므로 S3 이상에서만 열린다. 그런데 교재 서가
 * (`/library/textbooks`)는 학령 사다리를 보여 주면서 **풀 자리가 없었다** — 재고만 보고
 * `/hub` 로 돌아가는 화면이었다. 그래서 `csat_item_attempts` 가 0행이고,
 * **난이도(P)·변별도(D)를 못 낸다**(평가 요소 중 열위 하나).
 *
 * ⚠️ 문항 테이블은 학습자가 못 읽는다(admin 정책 하나뿐). **열어서도 안 된다** —
 *   같은 행에 `answer_key` 가 있어서 정책을 열면 브라우저에서 정답이 보인다.
 *   그래서 `textbook_practice_items` RPC 가 정답을 뺀 열만 내준다.
 *
 * ⚠️ **어떤 유형이 나오는지는 RPC 가 정한다** — 화면이 거르지 않는다. 화면에서 거르면
 *   "8문항 달라고 했는데 3개만 뜨는" 조용한 손실이 생긴다(처방에서 실제로 겪었다).
 */
export async function fetchTextbookPracticeItems(
  vLevel: number,
  limit = 10,
): Promise<{ items: DcpItem[]; unavailable: boolean }> {
  const client = await createClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  // 로그인하지 않았으면 "문항이 없다" 가 아니라 "못 봤다" 다 — 둘을 구별해서 넘긴다.
  if (!user) return { items: [], unavailable: true }

  const loose = client as unknown as SupabaseClient
  const { data, error } = await loose.rpc('textbook_practice_items', {
    p_v_level: vLevel,
    p_limit: limit,
  })
  // 조회 실패를 빈 목록으로 뭉개지 않는다 — 화면이 "아직 문항이 없어요" 로 거짓말하게 된다.
  if (error) return { items: [], unavailable: true }

  const items = Array.isArray(data) ? data.map(parseItem).filter((x): x is DcpItem => x !== null) : []
  return { items, unavailable: false }
}

/** 서버 answer_key 로 채점(grade_dcp_item). attempt 를 기록하고 attempt_id 반환. */
export async function gradeDcpItem(
  itemId: string,
  answer: Record<string, unknown>,
): Promise<DcpGradeResult> {
  const client = await createClient()
  const loose = client as unknown as SupabaseClient
  const { data, error } = await loose.rpc('grade_dcp_item', { p_item_id: itemId, p_answer: answer })
  if (error || !data) return { correct: false, attemptId: null, answerKey: null }
  const d = data as { correct?: boolean; attempt_id?: string; answer_key?: Record<string, unknown> | null }
  return {
    correct: d.correct === true,
    attemptId: d.attempt_id ?? null,
    answerKey: d.answer_key ?? null,
  }
}

/** 오답 attempt 에 error_cause 를 부착(자기보고 1-tap). RLS owner + DB CHECK(5원인) 이중 방어. */
export async function recordDcpErrorCause(attemptId: string, cause: DcpErrorCause): Promise<{ ok: boolean }> {
  if (!attemptId || !ALLOWED_CAUSES.includes(cause)) return { ok: false }
  const client = await createClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) return { ok: false }

  const loose = client as unknown as SupabaseClient
  const { error } = await loose
    .from('csat_item_attempts')
    .update({ error_cause: cause })
    .eq('id', attemptId)
    .eq('user_id', user.id)
  return { ok: !error }
}
