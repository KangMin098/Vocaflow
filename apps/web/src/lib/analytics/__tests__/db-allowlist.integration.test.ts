// apps/web/src/lib/analytics/__tests__/db-allowlist.integration.test.ts
//
// **코드가 보낼 수 있는 이벤트를 DB 도 받아 주는가.**
//
// ── 왜 이 검사가 필요한가 (실측 2026-09-06) ────────────────────────────
// 허용 목록이 **세 곳**에 있다:
//   ① TS 유니온 `PublicEvent`            — 컴파일이 지킨다
//   ② 런타임 `EVENT_REGISTRY`            — `events.test.ts` 가 ①과 맞물리게 지킨다
//   ③ `funnel_events_event_check` (DB)   — **아무도 안 봤다**
//
// 그 사이 코드에만 5종이 늘었고 DB 는 그대로였다. 수신구
// (`app/api/analytics/event/route.ts`)는 계측이 화면을 깨뜨리지 않도록 **어떤 실패에도
// 204 를 돌려주고 이유는 console.warn 에만 남긴다** — 그래서 화면도, 스펙도, 사람도
// 눈치채지 못한 채 아래 5종이 **한 건도 적재되지 않았다**:
//   landing_demo_moved · landing_section_reached · wayfinder_opened ·
//   wayfinder_cta_clicked · screen_viewed(학습자 화면 진입 — CLAUDE.md D2)
//
// 이 저장소는 같은 종류를 이미 한 번 겪었다(`fit_worksheet_printed` 가 유니온에만 있고
// 허용 목록에 없어 전송 0). 그때 막은 것은 **코드 두 곳 사이**의 드리프트였다.
// 이 파일이 막는 것은 **코드와 DB 사이**의 드리프트다.
//
// ── 어떻게 재는가 ──────────────────────────────────────────────────────
// 제약 정의문을 파싱하지 않고 **실제로 넣어 본다.** 정의문을 읽으면 CHECK 의 문법이
// 바뀌거나(enum 전환 등) 다른 제약이 생겼을 때 검사가 조용히 무의미해진다.
// 넣어 보는 검사는 "보내면 남는가" 라는 **우리가 실제로 묻는 질문**과 같다.
//
// ⚠️ 방향이 중요하다 — `코드 ⊆ DB` 만 요구한다. DB 에 여분이 있는 것은 문제가 아니다
//    (`teacher_hub_view` · `invite_shared` 는 이 유니온에 없지만 다른 경로가 쓴다).
//    반대로 코드에만 있는 이름은 **보내는 순간 조용히 사라진다.**
//
// 검사용 행은 `surface='selftest'` 로 표시해 끝나고 지운다 — 퍼널 수치를 오염시키지 않는다.

import { afterAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'

import { ALLOWED_EVENTS } from '../events'

const URL = process.env['NEXT_PUBLIC_SUPABASE_URL']
const KEY = process.env['SUPABASE_SERVICE_ROLE_KEY']
const LIVE = !!URL && !!KEY

/** 이 파일이 남긴 행만 골라내는 표시. 실제 퍼널에는 이런 surface 가 없다. */
const SELFTEST_SURFACE = 'selftest'

const admin = LIVE
  ? createClient(URL as string, KEY as string, { auth: { persistSession: false } })
  : null

afterAll(async () => {
  if (!admin) return
  await admin.from('funnel_events').delete().eq('surface', SELFTEST_SURFACE)
})

describe('계측 허용 목록 — 코드와 DB', () => {
  it.runIf(LIVE)(
    'ALLOWED_EVENTS 가 전부 funnel_events 에 들어간다 — 안 들어가면 그 이벤트는 조용히 사라진다',
    async () => {
      const failures: string[] = []
      for (const name of ALLOWED_EVENTS) {
        const { error } = await admin!
          .from('funnel_events')
          .insert({ user_id: null, event: name, surface: SELFTEST_SURFACE, meta: {} })
        if (error) failures.push(`${name} — ${error.message}`)
      }

      expect(
        failures,
        [
          'DB 가 받아 주지 않는 이벤트가 있다 — 보내도 조용히 사라진다(수신구는 204 를 준다).',
          '`funnel_events_event_check` 를 갱신하는 마이그레이션이 필요하다.',
          '',
          ...failures,
        ].join('\n'),
      ).toEqual([])
    },
    120_000,
  )
})
