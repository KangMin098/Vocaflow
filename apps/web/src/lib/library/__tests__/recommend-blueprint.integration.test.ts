// apps/web/src/lib/library/__tests__/recommend-blueprint.integration.test.ts
//
// hub 추천이 **컴포저 산출물을 실제로 집어 오는가** — 실 DB 왕복으로 확인한다.
//
// 이 스펙이 잡으려는 실패는 조용하다. 추천 RPC 는 오랫동안 슬러그를 하드코딩했고
// (`auto-vlevel-v1..v9` · `etymology-core` · `kice-%`), 컴포저가 발행한 29세트는 `cat-*`
// 슬러그라 **단 하나도 뜨지 않았다**. hub 는 정상으로 보인다 — 카드가 4장 뜨니까.
// 유형 카탈로그가 26종으로 늘어도 그 자리는 영원히 그대로였다.
//
// 그래서 판정 근거를 `curation_query.blueprint` 로 옮겼고, 여기서는 **레벨·트랙을 바꿔 가며**
// 각 블록이 실제로 발화하는지 본다. 조건 하나가 오타로 죽어도 화면은 멀쩡하므로 이 방법뿐이다.
//
// ⚠️ 프로필을 임시로 바꾼다 — `finally` 에서 반드시 원복한다. vitest 는 파일 직렬 실행이라
//    (`fileParallelism: false`) 다른 스펙과 겹치지 않는다.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, beforeAll, afterAll } from 'vitest'

const SUPA_URL = process.env['NEXT_PUBLIC_SUPABASE_URL']
const SUPA_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY']
const enabled = !!SUPA_URL && !!SUPA_KEY

/** 런타임 검증 계정 (compose-eval 픽스처와 같은 사용자) */
const USER = 'c02f0968-538e-4310-88f8-e91dec7746d1'

interface Rec {
  set_id: string
  slug: string
  title: string
  recommendation_type: string
  reason: string
  priority: number
}

let db: SupabaseClient
let original: { current_v_level: number | null; current_track_levels: unknown } | null = null

async function setProfile(level: number, tracks: Record<string, number>): Promise<void> {
  const { error } = await db
    .from('user_profiles')
    .update({ current_v_level: level, current_track_levels: tracks })
    .eq('user_id', USER)
  if (error) throw new Error(`profile update failed: ${error.message}`)
}

async function recommend(): Promise<Rec[]> {
  const { data, error } = await db.rpc('recommend_word_sets_for_user', {
    p_user_id: USER,
    p_interests: null,
  })
  if (error) throw new Error(`rpc failed: ${error.message}`)
  return (data ?? []) as Rec[]
}

/** 그 추천이 컴포저 산출물인가 — 슬러그가 아니라 레시피 유무로 판정한다. */
async function composerSlugs(): Promise<Set<string>> {
  const { data, error } = await db
    .from('shared_word_sets')
    .select('slug')
    .not('curation_query->blueprint', 'is', null)
  if (error) throw new Error(`composer list failed: ${error.message}`)
  return new Set((data ?? []).map((r) => (r as { slug: string }).slug))
}

describe.skipIf(!enabled)('hub 추천 — 유형(blueprint) 기반으로 컴포저 세트를 집어 온다', () => {
  beforeAll(async () => {
    db = createClient(SUPA_URL!, SUPA_KEY!, { auth: { persistSession: false } })
    const { data, error } = await db
      .from('user_profiles')
      .select('current_v_level, current_track_levels')
      .eq('user_id', USER)
      .single()
    if (error) throw new Error(`profile read failed: ${error.message}`)
    original = data as typeof original
  }, 60_000)

  afterAll(async () => {
    // 원복 — 남기면 이 계정을 쓰는 다른 스펙(hub·진단)의 전제가 바뀐다.
    if (original) {
      await db
        .from('user_profiles')
        .update({
          current_v_level: original.current_v_level,
          current_track_levels: original.current_track_levels,
        })
        .eq('user_id', USER)
    }
  })

  it('중급(V5) 학습자에게 레벨대를 선언한 컴포저 세트가 뜬다', async () => {
    await setProfile(5, {})
    const recs = await recommend()
    const composer = await composerSlugs()
    const hit = recs.find((r) => r.recommendation_type === 'composer_level')
    expect(hit, `composer_level 미발화 — 받은 유형: ${recs.map((r) => r.recommendation_type).join(',')}`).toBeTruthy()
    expect(composer.has(hit!.slug), `${hit!.slug} 이 컴포저 산출물이 아니다`).toBe(true)
    // 이유 문구가 학습자 말이어야 한다 — 내부 지표를 그대로 노출하지 않는다.
    expect(hit!.reason).toContain('V5')
  })

  it('트랙 진단이 높으면 그 트랙의 유형이 뜬다 (수능·학술·실무)', async () => {
    await setProfile(6, { csat_korean: 8, academic_english: 8, business_english: 8 })
    const recs = await recommend()
    const types = recs.map((r) => r.recommendation_type)
    // 셋 중 최소 둘 — LIMIT 8 안에서 우선순위 경쟁이 있으므로 전부를 요구하지 않는다.
    const trackHits = types.filter((t) => t.startsWith('track_')).length
    expect(trackHits, `트랙 추천 없음 — 받은 유형: ${types.join(',')}`).toBeGreaterThanOrEqual(2)
  })

  it('같은 세트가 두 번 실리지 않는다', async () => {
    await setProfile(6, { csat_korean: 8, academic_english: 8, business_english: 8 })
    const recs = await recommend()
    const ids = recs.map((r) => r.set_id)
    expect(new Set(ids).size, `중복 카드: ${ids.length - new Set(ids).size}건`).toBe(ids.length)
  })

  it('카드가 8장을 넘지 않는다 — hub 는 목록이 아니다', async () => {
    await setProfile(6, { csat_korean: 8, academic_english: 8, business_english: 8 })
    const recs = await recommend()
    expect(recs.length).toBeLessThanOrEqual(8)
  })

  it('진단 전(레벨 0)에도 터지지 않고 fallback 을 낸다', async () => {
    await setProfile(0, {})
    const recs = await recommend()
    expect(recs.every((r) => r.priority >= 1)).toBe(true)
  })
})
