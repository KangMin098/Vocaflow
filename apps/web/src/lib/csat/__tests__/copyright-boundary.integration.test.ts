// apps/web/src/lib/csat/__tests__/copyright-boundary.integration.test.ts
//
// **평가원 문항 원문이 학습자 쪽으로 새지 않는지** 실 DB 로 확인한다.
//
// 이 파이프라인은 지문·선지를 통째로 들고 있다. 그것은 한국교육과정평가원의 저작물이고,
// 우리가 학습자에게 줄 수 있는 것은 **그 문항을 분석해 우리가 쓴 글**뿐이다.
// 그래서 `csat_items.passage` 는 `authenticated` 에게 `USING (false)` 이고,
// 학습자 화면은 `csat_items_public` 뷰만 읽는다(`lib/csat/learner.ts` 는 일부러
// service_role 이 아니라 **RLS 를 따르는 클라이언트**를 쓴다).
//
// ⚠️ **이 테스트가 실패하면 = 저작물이 공개됐다는 뜻이다.** 테스트를 고치지 말고 정책을 원복할 것.
//    분석 데이터가 아무리 좋아도 이 경계가 무너지면 서비스를 세울 수 없다.
//
// SERVICE_ROLE_KEY / ANON_KEY 없으면 자동 skip (CI).

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const TEST_EMAIL = 'runtime-test-0705@vocaflow.dev'
const TEST_PASSWORD = 'RuntimeTest1!'

const skip = !SUPABASE_URL || !ANON_KEY || !SERVICE_KEY

describe.skipIf(skip)('기출 원문 저작권 경계 (실 DB)', () => {
  let anon: SupabaseClient
  let learner: SupabaseClient
  let svc: SupabaseClient

  beforeAll(async () => {
    svc = createClient(SUPABASE_URL!, SERVICE_KEY!, { auth: { persistSession: false } })
    anon = createClient(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false } })
    learner = createClient(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false } })

    const { error } = await learner.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    })
    if (error) throw new Error(`검증 계정 로그인 실패: ${error.message}`)
  })

  afterAll(async () => {
    await learner?.auth.signOut()
  })

  it('service_role 은 지문을 읽는다 — 대조군이 없으면 아래 단언이 무의미하다', async () => {
    // 사정권(독해)만 본다. 듣기 문항의 `passage` 는 짧은 조각이라 대조군이 못 된다.
    const { data, error } = await svc
      .from('csat_items')
      .select('id, passage')
      .eq('in_scope', true)
      .not('passage', 'is', null)
      .limit(50)
    expect(error).toBeNull()
    const long = (data ?? []).filter((r) => String(r.passage ?? '').length > 300)
    expect(long.length, '긴 지문이 하나도 없으면 이 테스트가 아무것도 안 지킨다').toBeGreaterThan(0)
  })

  for (const who of ['anon', 'learner'] as const) {
    it(`${who} 은 csat_items 를 읽지 못한다`, async () => {
      const db = who === 'anon' ? anon : learner
      const { data, error } = await db.from('csat_items').select('id, passage').limit(5)
      // 막는 방법은 둘 다 옳다 — 정책이 0행을 돌려주거나(RLS), 권한 자체가 없거나.
      // **읽히는 것만이 실패다.**
      if (!error) expect(data ?? [], `${who} 이 csat_items 를 읽었다`).toHaveLength(0)
    })

    it(`${who} 은 지문 컬럼을 이름으로 콕 집어도 못 읽는다`, async () => {
      const db = who === 'anon' ? anon : learner
      const { data, error } = await db.from('csat_items').select('passage').not('passage', 'is', null).limit(1)
      if (!error) expect(data ?? [], `${who} 이 passage 를 읽었다`).toHaveLength(0)
    })
  }

  // **경계가 어디에 그어져 있는지** — 이 목록이 곧 결정이다.
  //
  //   나가면 안 되는 것: `passage` · `choices` — 평가원이 고른 글과 다섯 선지가 그 저작물의 알맹이다.
  //   나가도 되는 것:   `stem`(발문) · `answer`(정답 번호) · `points`(배점).
  //     발문은 수십 년째 같은 문장이 되풀이되는 **기능 문구**이고, 정답과 배점은 평가원이
  //     정답표로 **이미 공개**한다. 셋 다 감출 이유가 없고, 감추면 계획 화면이 배점을 못 적는다.
  //
  // 즉 이 테스트가 지키는 것은 "다 가려라" 가 아니라 **선이 옮겨 다니지 않는 것**이다.
  it('학습자용 뷰는 지문·선지 컬럼 자체를 갖지 않는다', async () => {
    const { data, error } = await learner.from('csat_items_public').select('*').limit(1)
    expect(error, `학습자가 csat_items_public 을 못 읽으면 화면이 빈다: ${error?.message}`).toBeNull()
    expect(data?.length, '뷰가 비어 있으면 이 단언이 아무것도 안 지킨다').toBe(1)
    const cols = Object.keys(data![0])
    // 컬럼이 아예 없어야 한다. `passage: null` 로 있으면 나중에 누군가 채운다.
    for (const forbidden of ['passage', 'choices']) {
      expect(cols, `csat_items_public 에 ${forbidden} 가 있다`).not.toContain(forbidden)
    }
    // 계획 화면이 배점을 적으려면 이 셋은 있어야 한다 — 지운 줄 모르고 지우면 화면이 조용히 빈다
    for (const needed of ['stem', 'answer', 'points']) {
      expect(cols, `csat_items_public 에서 ${needed} 가 사라졌다`).toContain(needed)
    }
  })

  it('학습자가 읽는 분석·검수는 published 만 보인다', async () => {
    const { data, error } = await learner.from('csat_item_analyses').select('status').limit(200)
    expect(error).toBeNull()
    expect(data?.length, '분석이 하나도 안 보이면 학습자 화면이 빈다').toBeGreaterThan(0)
    expect([...new Set((data ?? []).map((r) => r.status))]).toEqual(['published'])
  })

  it('학습자가 분석을 고쳐 쓰지 못한다 — 검수를 우회하는 가장 짧은 길이다', async () => {
    const { data: one } = await svc.from('csat_item_analyses').select('id').eq('status', 'published').limit(1)
    expect(one?.length).toBe(1)
    const { error } = await learner
      .from('csat_item_analyses')
      .update({ measured_ability: '학습자가 고쳐 쓴 값' })
      .eq('id', one![0].id)
      .select('id')
    // 정책이 막는 방법은 둘 — 오류를 내거나, 0행을 고치거나. 다시 읽어 확인한다.
    const { data: after } = await svc
      .from('csat_item_analyses')
      .select('measured_ability')
      .eq('id', one![0].id)
      .single()
    expect(after?.measured_ability, `학습자 UPDATE 가 통했다 (error=${error?.message ?? 'none'})`).not.toBe(
      '학습자가 고쳐 쓴 값',
    )
  })
})
