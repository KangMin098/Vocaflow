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
    expect(isPlayableDcpType('grammar_fix')).toBe(false)
    expect(isPlayableDcpType(undefined)).toBe(false)
    expect(isClassifiedDcpType('grammar_fix')).toBe(false)
  })
})

describe.skipIf(skipIfNoEnv)('DCP 유형 분류 (integration)', () => {
  let db: SupabaseClient
  let storedTypes: string[]

  beforeAll(async () => {
    db = createClient(SUPABASE_URL!, SERVICE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    // 1,000행 조용한 절단에 두 번 당한 저장소다 — 넉넉히 받고 distinct 는 여기서 낸다.
    const seen = new Set<string>()
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db
        .from('csat_dcp_items')
        .select('type')
        .order('type')
        .range(from, from + 999)
      if (error) throw new Error(error.message)
      if (!data?.length) break
      for (const r of data) seen.add(String((r as { type: string }).type))
      if (data.length < 1000) break
    }
    storedTypes = [...seen].sort()
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
