// apps/web/src/lib/learner/__tests__/grade-band-is-fit.integration.test.ts
//
// **밴드는 적합이지 적격이 아니다 — 채점이 `cefr_above_band` 로 거부되지 않는다.**
// 실 DB 통합. 환경변수가 없으면 skip하고, 마이그레이션 적용 전에도 skip한다(아래 이유).
//
// ── 무엇을 막는 회귀인가 (2026-09-20 · 이슈 #104) ─────────────────────
// 적격 게이트가 채점 앞에 서면서, 차단 사유에 섞인 `cefr_above_band` 하나 때문에
// **이미 받은 문항의 채점이 거부**됐다(`Source is unavailable for practice`).
// 학습자는 답을 냈는데 결과를 못 본다 — 난이도 적합 판정이 결과 표시를 막은 셈이다.
// 규모: 사유가 `["cefr_above_band"]` 하나뿐인 원문 **11,276편**(DB 실측), 등급은 `blocked`
// 이라 **등급만 보면 못 가른다**. 그래서 판정은 사유 배열로 한다.
//
// ── 이 테스트가 재는 것 ───────────────────────────────────────────────
// ① **밴드만 걸린** 원문의 문항은 채점된다(행이 남고 정답 여부가 돌아온다).
// ② **다른 사유가 있는** 원문(내용 반려·안전·형식 등)의 문항은 **여전히 거부**된다 —
//    게이트를 통째로 열어 버리면 이 줄이 실패한다.
//
// ⚠️ 마이그레이션(`20260920120000_grade_dcp_band_is_fit_not_eligibility`)은 **사용자 승인 후 적용**한다
//    (AGENTS.md). 적용 전에는 `csat_source_is_gradeable` 가 없으므로 이 파일은 그 사실을 보고
//    **skip** 한다 — 없는 함수를 두고 CI 를 빨갛게 만들면 다른 실패가 가려진다.
//    적용 뒤에는 자동으로 돌기 시작한다(스킵 조건이 함수 존재 여부라서).
//
// 쓴 행은 지운다 — 남기면 그 계정의 `derive_learner_stage` 가 흔들려 다른 스펙의 전제가 바뀐다.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL']
const ANON_KEY = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']
const SERVICE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY']
const noEnv = !SUPABASE_URL || !ANON_KEY || !SERVICE_KEY

const TEST_EMAIL = 'runtime-test-0705@vocaflow.dev'
const TEST_PASSWORD = process.env.PLAYWRIGHT_RUNTIME_PASSWORD ?? ''

/**
 * ⚠️ **모듈 최상위에서 확인한다.**  는 **수집 시점**에 x 를 읽으므로
 * beforeAll 에서 채운 값은 늦는다 — 2026-09-20 에 실제로 적용 뒤에도 2건이 skip 됐다.
 */
const migrated = await (async () => {
  if (noEnv) return false
  const probe = createClient(SUPABASE_URL!, SERVICE_KEY!, { auth: { persistSession: false } })
  const { error } = await probe.rpc('csat_source_is_gradeable', {
    p_article_id: '00000000-0000-0000-0000-000000000000',
  })
  return !error
})()

/** 채점 대상 하나 — 문항 id 와 그 원문의 차단 사유. */
type Probe = { itemId: string; articleId: string; blockers: string[] }

describe.skipIf(noEnv)('밴드는 적합이지 적격이 아니다 (integration)', () => {
  let admin: SupabaseClient
  let learner: SupabaseClient
  let bandOnly: Probe | null = null
  let otherBlocked: Probe | null = null
  const attempts: string[] = []

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL!, SERVICE_KEY!, { auth: { persistSession: false } })
    learner = createClient(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false } })

    if (!migrated) return

    const { error: signInError } = await learner.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    })
    if (signInError) throw new Error(`검증 계정 로그인 실패: ${signInError.message}`)

    // 표본을 **문항 쪽에서** 고른다 — 고정 UUID 를 박지 않는다(드레인이 판정을 바꾸면 박은 값이 썩는다).
    //
    // ⚠️ 적격 표에서 시작하면 안 된다: 109,043행 중 앞 400행에 **문항이 붙은 원문이 없을 수 있다**
    //    (2026-09-20 실제로 표본 0 이었다). 학습자가 실제로 만나는 것은 문항이므로 문항에서 출발한다.
    const { data: items, error: itemsError } = await admin
      .from('csat_dcp_items')
      .select('id, ref_id')
      .eq('kind', 'article')
      .in('type', ['topic', 'blank', 'main_point', 'title', 'summary'])
      .limit(500)
    if (itemsError) throw new Error(itemsError.message)

    // 원문별 첫 문항만 남긴다 — 같은 원문을 두 번 보지 않는다.
    const firstItemOf = new Map<string, string>()
    for (const row of items ?? []) {
      const ref = row.ref_id as string
      if (ref && !firstItemOf.has(ref)) firstItemOf.set(ref, row.id as string)
    }
    const ids = [...firstItemOf.keys()].slice(0, 300)
    const { data: rows, error: rowsError } = await admin
      .from('csat_source_eligibility')
      .select('article_id, result')
      .in('article_id', ids)
    if (rowsError) throw new Error(rowsError.message)

    for (const row of rows ?? []) {
      const blockers = (row.result as { blockers?: unknown }).blockers
      if (!Array.isArray(blockers)) continue
      const list = blockers as string[]
      const probe: Probe = {
        itemId: firstItemOf.get(row.article_id as string)!,
        articleId: row.article_id as string,
        blockers: list,
      }
      if (!bandOnly && list.length === 1 && list[0] === 'cefr_above_band') bandOnly = probe
      if (!otherBlocked && list.some((x) => x !== 'cefr_above_band')) otherBlocked = probe
      if (bandOnly && otherBlocked) break
    }
  }, 120_000)

  afterAll(async () => {
    if (attempts.length) await admin.from('csat_item_attempts').delete().in('id', attempts)
    await learner?.auth.signOut()
  })

  it('마이그레이션 적용 여부를 먼저 말한다', () => {
    // 적용 전에는 아래 두 단언이 skip 된다 — 그 사실이 조용히 지나가지 않게 여기서 한 번 말한다.
    expect(typeof migrated).toBe('boolean')
    if (!migrated) {
      console.log('[grade-band-is-fit] csat_source_is_gradeable 없음 — 마이그레이션 승인·적용 전이라 skip')
    }
  })

  it.runIf(migrated)('밴드만 걸린 원문의 문항은 채점된다', async () => {
    expect(bandOnly, '밴드만 걸린 표본을 못 찾았다 — 표본 수를 늘리거나 사유 분포를 다시 재라').not.toBeNull()
    const { data, error } = await learner.rpc('grade_dcp_item', {
      p_item_id: bandOnly!.itemId,
      p_answer: { choice: '1' },
    })
    expect(error, `채점이 거부됐다: ${error?.message}`).toBeNull()
    const result = data as { correct: boolean; attempt_id: string }
    expect(typeof result.correct).toBe('boolean')
    expect(result.attempt_id).toBeTruthy()
    attempts.push(result.attempt_id)
  }, 60_000)

  it.runIf(migrated)('밴드 밖의 사유가 있는 원문은 여전히 거부된다', async () => {
    expect(otherBlocked, '밴드 밖 사유 표본을 못 찾았다').not.toBeNull()
    const { error } = await learner.rpc('grade_dcp_item', {
      p_item_id: otherBlocked!.itemId,
      p_answer: { choice: '1' },
    })
    expect(error?.message ?? '', `사유 ${otherBlocked!.blockers.join(',')} 인데 채점이 통과했다`).toContain(
      'Source is unavailable for practice',
    )
  }, 60_000)
})
