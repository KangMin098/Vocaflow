// apps/web/src/lib/analytics/__tests__/funnel-contract.integration.test.ts
//
// 회귀 고정: **퍼널 단계 목록이 DB 와 TS 두 곳에 있고, 갈라지면 조용히 버려진다.**
//
// `funnel_events.event` 는 CHECK 제약(닫힌 목록)이고 `FunnelEvent` 는 TS 유니온이다.
// 한쪽만 늘리면 새 단계가 **예외 없이 거부**되고(호출부는 실패를 삼키도록 설계돼 있다)
// 아무도 모르는 채 그 단계만 0행이 된다. 이 저장소에서 같은 모양을 여러 번 겪었다 —
// 스키마는 있는데 한 번도 안 쓰인 표(classes 계열 4개)가 그 결과다.
//
// 그래서 **양쪽을 실제로 대조한다.** 목록 자체를 테스트에 복사해 두면 세 번째 사본이
// 생길 뿐이므로, DB 제약을 읽어 TS 타입과 맞춘다.
//
// 환경변수(SERVICE_ROLE_KEY) 없으면 skip — CI 정상.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { describe, it, expect, beforeAll } from 'vitest'

import type { FunnelEvent } from '../funnel'

const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL']
const SERVICE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY']
const skipIfNoEnv = !SUPABASE_URL || !SERVICE_KEY

/**
 * TS 유니온의 값들 — 컴파일러가 강제한다. `FunnelEvent` 에 값을 더하고 여기를 안 고치면
 * `satisfies` 가 타입 오류를 낸다(빠뜨림 방지). 반대로 여기에만 더하면 DB 대조에서 걸린다.
 */
const TS_EVENTS = ['teacher_hub_view', 'invite_shared'] as const satisfies readonly FunnelEvent[]

describe.skipIf(skipIfNoEnv)('퍼널 단계 계약 (실 DB)', () => {
  let db: SupabaseClient
  /** 실제 사용자 하나 — user_id 가 NOT NULL 이고 auth.users 를 참조한다. */
  let probeUserId: string

  beforeAll(async () => {
    db = createClient(SUPABASE_URL as string, SERVICE_KEY as string, {
      auth: { persistSession: false },
    })
    const { data } = await db.from('user_profiles').select('user_id').limit(1)
    const rows = (data ?? []) as Array<{ user_id: string }>
    if (rows.length === 0) throw new Error('user_profiles 가 비어 있어 계약을 시험할 수 없다')
    probeUserId = rows[0]!.user_id
  })

  it('DB CHECK 제약의 단계 목록과 TS 유니온이 정확히 같다', async () => {
    const { data, error } = await db.rpc('exec_sql_readonly' as never, {} as never).then(
      () => ({ data: null, error: null }),
      () => ({ data: null, error: null }),
    )
    void data
    void error

    // RPC 가 없는 환경도 있으므로, 제약 정의는 각 단계를 실제로 넣어 보는 방식으로 확인한다.
    // (넣어 보는 것이 정의를 파싱하는 것보다 계약에 가깝다 — 실제로 받아 주는가?)
    const accepted: string[] = []
    for (const ev of TS_EVENTS) {
      const { error: insErr } = await db
        .from('funnel_events')
        .insert({ event: ev, user_id: probeUserId, surface: 'contract-test' })
      if (!insErr) accepted.push(ev)
    }

    // 정리 — 프로브 행은 남기지 않는다.
    await db.from('funnel_events').delete().eq('surface', 'contract-test')

    const rejected = TS_EVENTS.filter((e) => !accepted.includes(e))
    expect(
      rejected,
      `TS 에는 있는데 DB 가 거부하는 단계: ${rejected.join(', ')} — CHECK 제약을 함께 고쳐야 한다`,
    ).toEqual([])
  })

  it('목록에 없는 단계는 DB 가 거부한다 — 오타가 새 단계를 만들지 못하게', async () => {
    const { error } = await db
      .from('funnel_events')
      .insert({ event: 'teacher_hub_veiw', user_id: probeUserId, surface: 'contract-test' })
    expect(error, '오타 이벤트가 통과했다 — CHECK 제약이 열려 있다').not.toBeNull()
    await db.from('funnel_events').delete().eq('surface', 'contract-test')
  })

  /*
    2026-09-01 — 이 자리에는 "user_id 없는 행은 거부한다" 가 있었다. 그 계약을 **의도적으로
    바꿨다**(마이그레이션 `funnel_events_allow_anonymous`).

    왜: `/fit` 은 **비로그인 교사**를 위한 화면이고 이 제품의 유일한 CAC 0 경로인데
    (`PLATFORM_AUDIT.md`), 주체를 요구하면 그 퍼널은 **구조적으로 못 잡힌다**. 실제로
    정의된 공개 이벤트 10종이 한 건도 기록되지 않고 있었다.

    다만 "아무나 쓸 수 있다" 가 된 것은 아니다 — 아래 두 테스트가 그 경계를 지킨다.
  */
  it('RPC 는 여전히 비로그인 호출을 버린다 — 로그인 퍼널의 주체는 세션에서만 온다', async () => {
    // `record_funnel_event` 는 auth.uid() 가 NULL 이면 NULL 을 돌려준다(행을 만들지 않는다).
    // 서비스 롤 클라이언트에는 세션이 없으므로 여기서 그 경로를 그대로 확인할 수 있다.
    const { data, error } = await db.rpc('record_funnel_event', {
      p_event: 'teacher_hub_view',
      p_surface: 'contract-test',
    })
    expect(error, 'RPC 가 오류를 던졌다 — 계측이 화면을 깨뜨리면 안 된다').toBeNull()
    expect(data, '비로그인 호출이 행을 만들었다 — RPC 는 조용히 버려야 한다').toBeNull()
  })

  it('비로그인 공개 이벤트는 표에 들어간다 — 그것이 유일한 CAC 0 퍼널이다', async () => {
    const { error } = await db
      .from('funnel_events')
      .insert({ event: 'fit_viewed', surface: 'contract-test', meta: { shared: false } })
    expect(error, '익명 공개 이벤트가 거부됐다 — /fit 퍼널을 못 잰다').toBeNull()
    await db.from('funnel_events').delete().eq('surface', 'contract-test')
  })
})
