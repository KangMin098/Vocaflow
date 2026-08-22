// apps/web/src/lib/learner/__tests__/dcp-grade-records.integration.test.ts
//
// **채점하면 관측이 실제로 한 줄 남는가.** 실 DB 통합 — 환경변수 없으면 skip.
//
// ── 무엇을 막는 회귀인가 (2026-08-22) ────────────────────────────────
// `csat_item_attempts` 는 0행이었다. 원인은 화면이 아니라 **FK 였다**:
// `grade_dcp_item` 이 `question_id` 에 `csat_dcp_items.id` 를 넣는데 그 컬럼의 FK 는
// `quiz_questions` 를 가리켜, 모든 INSERT 가 23503 으로 죽었다. 그 예외는
// `gradeDcpItem` 에서 `{correct:false}` 로 바뀌므로 **정답을 맞혀도 화면은 "아쉬워요"**
// 를 띄웠고 기록은 남지 않았다.
//
// 이 결함은 `20260812113000_restore_csat_item_attempts` 가 원본 DDL(FK 포함)을 그대로
// 복원하며 생겼다. 그때 검증은 `derive_learner_stage` 와 `prescribe_today` 만 봤다 —
// **채점을 한 번도 돌려 보지 않았다.** 42P01 을 고치고 23503 을 남긴 셈이다.
//
// 그래서 이 테스트는 함수 정의를 읽지 않는다. **진짜 학습자 세션으로 실제 채점을 돌리고,
// 행이 생겼는지 센다.** 통과하려면 컬럼·FK·권한·RLS 가 전부 맞아야 한다.
//
// 쓴 행은 지운다 — 남기면 그 계정의 `derive_learner_stage`(정답률로 계단 산출)가 흔들려
// 다른 e2e 스펙의 전제가 조용히 바뀐다.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL']
const ANON_KEY = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']
const SERVICE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY']
const skip = !SUPABASE_URL || !ANON_KEY || !SERVICE_KEY

const TEST_EMAIL = 'runtime-test-0705@vocaflow.dev'
const TEST_PASSWORD = 'RuntimeTest1!'

describe.skipIf(skip)('grade_dcp_item 이 관측을 남긴다 (integration)', () => {
  let learner: SupabaseClient
  let admin: SupabaseClient
  let userId: string
  const created: string[] = []

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL!, SERVICE_KEY!, { auth: { persistSession: false } })
    learner = createClient(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false } })
    const { data, error } = await learner.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    })
    if (error) throw new Error('검증 계정 로그인 실패: ' + error.message)
    userId = data.user!.id
  })

  afterAll(async () => {
    // 테스트가 만든 행만 지운다(id 지정). 계정의 다른 기록은 건드리지 않는다.
    if (created.length) await admin.from('csat_item_attempts').delete().in('id', created)
    await learner.auth.signOut()
  })

  it('삽입 유형을 채점하면 attempt 가 생기고 dcp_item_id 가 채워진다', async () => {
    const { data: item } = await admin
      .from('csat_dcp_items')
      .select('id, answer_key')
      .eq('kind', 'article')
      .eq('type', 'insert')
      .limit(1)
      .single()
    expect(item?.id).toBeTruthy()

    const position = (item!.answer_key as { position: number }).position
    const { data, error } = await learner.rpc('grade_dcp_item', {
      p_item_id: item!.id,
      p_answer: { position },
    })
    // ⚠️ 여기서 error 가 나면 화면은 "오답" 으로 보인다 — 조용한 실패의 원점이다.
    expect(error).toBeNull()
    const res = data as { correct: boolean; attempt_id: string }
    expect(res.correct).toBe(true)
    expect(res.attempt_id).toBeTruthy()
    created.push(res.attempt_id)

    const { data: row } = await admin
      .from('csat_item_attempts')
      .select('id, user_id, dcp_item_id, is_correct, item_role')
      .eq('id', res.attempt_id)
      .single()
    expect(row?.user_id).toBe(userId)
    // 컬럼을 잘못 고르면 여기서 잡힌다 — question_id 는 quiz_questions 전용이다.
    expect(row?.dcp_item_id).toBe(item!.id)
    expect(row?.is_correct).toBe(true)
    expect(row?.item_role).toBe('practice')
  })

  it('선택지 9종도 채점된다 — 정답이면 answer_key 를 돌려주지 않는다', async () => {
    const { data: item } = await admin
      .from('csat_dcp_items')
      .select('id, answer_key')
      .eq('kind', 'article')
      .eq('type', 'topic')
      .limit(1)
      .single()
    expect(item?.id).toBeTruthy()
    const answer = (item!.answer_key as { answer: number }).answer

    const ok = await learner.rpc('grade_dcp_item', { p_item_id: item!.id, p_answer: { choice: answer } })
    expect(ok.error).toBeNull()
    const okRes = ok.data as { correct: boolean; attempt_id: string; answer_key: unknown }
    expect(okRes.correct).toBe(true)
    // 정답일 때 정답 키를 돌려주면 다음 문항의 답까지 유추할 여지를 준다.
    expect(okRes.answer_key).toBeNull()
    created.push(okRes.attempt_id)

    const wrong = await learner.rpc('grade_dcp_item', {
      p_item_id: item!.id,
      p_answer: { choice: (answer % 5) + 1 },
    })
    expect(wrong.error).toBeNull()
    const wrongRes = wrong.data as { correct: boolean; attempt_id: string; answer_key: { answer: number } }
    expect(wrongRes.correct).toBe(false)
    // 오답일 때는 정답과 해설을 준다 — 이 화면의 오답 노트가 그것으로 그려진다.
    expect(wrongRes.answer_key.answer).toBe(answer)
    created.push(wrongRes.attempt_id)
  })

  it('교재 연습 RPC 는 정답 계열 키를 하나도 내주지 않는다', async () => {
    const { data, error } = await learner.rpc('textbook_practice_items', { p_v_level: 3, p_limit: 50 })
    expect(error).toBeNull()
    const rows = (data ?? []) as { type: string; payload: Record<string, unknown> }[]
    expect(rows.length).toBeGreaterThan(0)

    const leaked = new Set<string>()
    for (const r of rows) {
      for (const k of Object.keys(r.payload ?? {})) {
        if (/answer|correct|key|rationale|solution/i.test(k)) leaked.add(k)
      }
    }
    // 문항 행에는 `answer_key` 가 함께 있다 — RPC 가 그 열을 빼는 것이 이 경로의 유일한 방어다.
    expect([...leaked]).toEqual([])
  })

  it('없는 선택지 번호는 거부한다 — 캐스트가 먼저 터지지 않는다', async () => {
    const { data: item } = await admin
      .from('csat_dcp_items')
      .select('id')
      .eq('kind', 'article')
      .eq('type', 'topic')
      .limit(1)
      .single()
    const { error } = await learner.rpc('grade_dcp_item', { p_item_id: item!.id, p_answer: { choice: 9 } })
    expect(error).not.toBeNull()
    expect(error!.message).toContain('Bad choice')
  })
})
