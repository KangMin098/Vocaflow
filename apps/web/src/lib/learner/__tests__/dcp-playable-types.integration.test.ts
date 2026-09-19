// apps/web/src/lib/learner/__tests__/dcp-playable-types.integration.test.ts
//
// **저장된 DCP 유형이 전부 분류돼 있는가.** 실 DB 통합 — 환경변수 없으면 skip.
//
// ── 무엇을 막는 회귀인가 (2026-08-21) ────────────────────────────────
// 교재용 유형을 `csat_dcp_items` 에 넣으면서 "저장된 것 = 학습자가 푸는 것" 이라는
// 오래된 전제가 깨졌다. `prescribe_today` 는 그대로 유형을 안 가리고 5문항을 뽑았고,
// 실측 **발행 카탈로그 안 42.5%(661/1,556)** 가 화면이 못 그리는 문항으로 나갔다.
//
// 처방에 허용 목록이 생겨 **새 유형은 기본이 제외**가 됐으므로 같은 방식으로는 다시
// 새지 않는다. 남은 위험은 **유형을 저장해 놓고 어느 갈래인지 정하지 않는 것**이다.
// 그러면 그 유형은 아무도 모르게 재고에만 쌓이고, 나중에 누가 허용 목록에 넣을 때
// 화면·채점이 준비됐는지 아무도 확인하지 않는다.
//
// 그래서 **DB 에 실제로 있는 유형**을 읽어 두 목록에 다 있는지 본다. 목록을 여기 적어
// 두지 않는 이유는 그러면 테스트가 코드와 함께 낡아 아무것도 못 잡기 때문이다.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it } from 'vitest'

import {
  isClassifiedDcpType,
  isPlayableDcpType,
  PLAYABLE_DCP_TYPES,
  TEXTBOOK_ONLY_DCP_TYPES,
} from '../dcp-types'

const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL']
const SERVICE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY']
const skipIfNoEnv = !SUPABASE_URL || !SERVICE_KEY

describe('DCP 유형 분류 (순수)', () => {
  it('두 갈래가 겹치지 않는다', () => {
    for (const t of TEXTBOOK_ONLY_DCP_TYPES) expect(isPlayableDcpType(t)).toBe(false)
    for (const t of PLAYABLE_DCP_TYPES) expect(isPlayableDcpType(t)).toBe(true)
  })

  it('모르는 유형은 재생 가능으로 보지 않는다 — 기본이 제외다', () => {
    // ⚠️ **예시는 저장소에 없는 이름이어야 한다.** 처음에는 `grammar_fix` 를 썼는데
    //   2026-08-22 에 그 유형이 실제로 분류되면서 이 단언이 뒤집혔다. 언젠가 진짜가 될
    //   이름을 "모르는 유형" 의 예로 쓰면, 테스트가 규칙이 아니라 그때의 재고를 검사하게 된다.
    expect(isPlayableDcpType('sokrates_dialogue')).toBe(false)
    expect(isPlayableDcpType(undefined)).toBe(false)
    expect(isClassifiedDcpType('sokrates_dialogue')).toBe(false)
  })
})

describe.skipIf(skipIfNoEnv)('DCP 유형 분류 (integration)', () => {
  let db: SupabaseClient
  let storedTypes: string[]

  // ⚠️ **이 훅이 두 번 부러졌다 — 두 번 다 "재고가 늘어서" 다**(실측 2026-09-01).
  //    ① 42만 행을 1,000행씩 428번 받아 distinct 를 냈다 → `beforeAll` 40초 훅 제한 초과.
  //    ② `not.in(분류목록)` 한 방으로 바꿨더니, 위반이 **없을 때** 그것을 증명하려고
  //       전건을 훑어 `57014`(statement timeout).
  //    재고가 늘수록 못 도는 가드는 가드가 아니다.
  //
  //    그래서 **이미 미리 계산된 집계**를 읽는다(`20260831090000` 의 집계 뷰 · 114행).
  //    유형×레벨 distinct 가 거기 그대로 있다 — 이 테스트가 원하던 바로 그 값이다.
  //
  //    ⚠️ 이 뷰는 `v_level IS NOT NULL` 만 담는다. 지금은 전건이 v_level 을 가지므로
  //       (실측: 뷰 합계 427,592 = 표 전체) 사각이 없지만, **v_level 없는 행이 생기면
  //       이 가드가 그 유형을 못 본다.** 그때는 뷰의 조건부터 다시 봐야 한다.
  //    ⚠️ 뷰는 5분마다 갱신된다 — 방금 들어온 새 유형은 최대 5분 늦게 잡힌다.
  //       분류 누락은 배포 전에 잡으면 되는 종류라 이 지연은 받아들인다.
  beforeAll(async () => {
    db = createClient(SUPABASE_URL!, SERVICE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data, error } = await db.from('textbook_shelf_inventory_mv').select('item_type')
    if (error) throw new Error(`집계 뷰를 읽지 못했다: ${error.message}`)
    storedTypes = [...new Set((data ?? []).map((r) => String((r as { item_type: string }).item_type)))].sort()
  })

  it('저장된 유형이 하나 이상 있다 — 없으면 아래 검사가 공회전한다', () => {
    expect(storedTypes.length).toBeGreaterThan(0)
  })

  it('저장된 유형은 모두 분류돼 있다 — 재생용인지 교재용인지', () => {
    const unclassified = storedTypes.filter((t) => !isClassifiedDcpType(t))
    expect(
      unclassified,
      `분류되지 않은 유형 ${unclassified.join(', ')} — ` +
        `dcp-types.ts 의 PLAYABLE_DCP_TYPES 또는 TEXTBOOK_ONLY_DCP_TYPES 에 넣어야 한다. ` +
        `재생용으로 넣는다면 parseItem · DcpPlayer · grade_dcp_item · prescribe_today 를 함께 봐야 한다.`,
    ).toEqual([])
  })

  it('교재용 유형이 실제로 저장돼 있다 — 허용 목록이 하는 일이 있다', () => {
    // 교재용이 하나도 없다면 처방 필터는 아무것도 안 막고 있는 것이고,
    // 그때는 이 회귀 자체가 의미를 잃는다. 그 사실을 여기서 드러낸다.
    const textbookOnly = storedTypes.filter((t) => !isPlayableDcpType(t))
    expect(textbookOnly.length).toBeGreaterThan(0)
  })
})
