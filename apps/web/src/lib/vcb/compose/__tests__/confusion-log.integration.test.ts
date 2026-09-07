// apps/web/src/lib/vcb/compose/__tests__/confusion-log.integration.test.ts
//
// `confusion-log` 유형이 **실제 오답 기록**을 짝으로 바꾸는지 — 실 DB 왕복으로 확인한다.
//
// 이 스펙이 잡으려는 실패는 조용하다. 유형은 "내가 헷갈린 짝" 을 약속하는데,
// 한때 모집단이 `vocabularies.next_review_at`(FSRS 복습 예정)을 읽고 있었다. 그건
// "곧 잊을 때가 된 단어" 지 "틀린 단어" 가 아니다. 화면은 멀쩡히 세트를 뱉으므로
// 아무것도 빨개지지 않고, 학습자만 남의 함정을 자기 함정이라고 배운다.
//
// 그래서 여기서는 **기록을 직접 심고** 그것이 짝 그룹으로 나오는지 본다.
// 심은 것은 finally 에서 지운다 — 남기면 다음 실행의 오답 통계가 오염된다.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { resolvePopulation } from '../resolve'

const SUPA_URL = process.env['NEXT_PUBLIC_SUPABASE_URL']
const SUPA_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY']
const enabled = !!SUPA_URL && !!SUPA_KEY

/** 실제로 헷갈릴 만한 짝 — 사전에 둘 다 있어야 hydrate 된다. */
const TARGET = 'affect'
const CHOSEN = 'effect'

let client: SupabaseClient
let userId: string
let targetVocabId: string
const insertedRecordIds: string[] = []
const insertedVocabIds: string[] = []

describe.skipIf(!enabled)('confusion-log — 기록된 오답이 짝이 된다', () => {
  beforeAll(async () => {
    client = createClient(SUPA_URL!, SUPA_KEY!, { auth: { persistSession: false } })

    const { data: prof, error: pErr } = await client
      .from('user_profiles')
      .select('user_id')
      .limit(1)
      .single()
    if (pErr) throw new Error(`user_profiles: ${pErr.message}`)
    userId = (prof as { user_id: string }).user_id

    // 이 사용자의 vocabularies 에 대상 단어가 있어야 learning_records 가 붙는다.
    const { data: existing } = await client
      .from('vocabularies')
      .select('id')
      .eq('user_id', userId)
      .eq('word', TARGET)
      .maybeSingle()
    if (existing) {
      targetVocabId = (existing as { id: string }).id
    } else {
      const { data: v, error: vErr } = await client
        .from('vocabularies')
        .insert({ user_id: userId, word: TARGET, meaning: '영향을 미치다' })
        .select('id')
        .single()
      if (vErr) throw new Error(`vocabularies insert: ${vErr.message}`)
      targetVocabId = (v as { id: string }).id
      insertedVocabIds.push(targetVocabId)
    }

    const { data: rec, error: rErr } = await client
      .from('learning_records')
      .insert({
        user_id: userId,
        vocabulary_id: targetVocabId,
        module: 'wordblitz',
        rating: 1,
        is_correct: false,
        metadata: { chosen: CHOSEN },
        attempted_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    if (rErr) throw new Error(`learning_records insert: ${rErr.message}`)
    insertedRecordIds.push((rec as { id: string }).id)
  }, 60_000)

  afterAll(async () => {
    for (const id of insertedRecordIds) await client.from('learning_records').delete().eq('id', id)
    for (const id of insertedVocabIds) await client.from('vocabularies').delete().eq('id', id)
  })

  it('오답 단어와 그때 고른 단어가 **둘 다** 후보에 들어온다', async () => {
    const pool = await resolvePopulation(client, { kind: 'learner', user_id: userId, state: 'wrong' })
    const words = pool.map((c) => c.word.toLowerCase())
    expect(words, '틀린 단어가 빠졌다').toContain(TARGET)
    // 한쪽만 실으면 나란히 놓을 것이 없다 — 대조가 이 유형의 상품이다.
    expect(words, '고른 오답이 빠졌다 — 짝이 성립하지 않는다').toContain(CHOSEN)
  })

  it('둘이 **같은 짝 키**를 받는다 (어느 쪽에서 붙이든 같은 그룹)', async () => {
    const pool = await resolvePopulation(client, { kind: 'learner', user_id: userId, state: 'wrong' })
    const keyOf = (w: string) =>
      pool
        .find((c) => c.word.toLowerCase() === w)
        ?.group_keys?.find((g) => g.key.startsWith('confusion:'))?.key
    const a = keyOf(TARGET)
    expect(a, '짝 키가 붙지 않았다').toBeTruthy()
    expect(keyOf(CHOSEN)).toBe(a)
    // 사전순 정렬 키 — 정답 쪽에서 붙이든 오답 쪽에서 붙이든 같은 문자열이어야 한다.
    expect(a).toBe(`confusion:${[TARGET, CHOSEN].sort().join('|')}`)
  })

  it('기록이 없는 단어에는 짝 키를 지어내지 않는다', async () => {
    const pool = await resolvePopulation(client, { kind: 'learner', user_id: userId, state: 'wrong' })
    const unpaired = pool.filter(
      (c) => !c.group_keys?.some((g) => g.key.startsWith('confusion:')),
    )
    // 짝 키가 없는 후보가 있어도 되지만, 있다면 그건 `chosen` 이 기록되지 않은 오답이다.
    // 여기서 고정하는 것은 "없으면 없는 대로 둔다" — 채워 넣으면 남의 함정이 내 함정이 된다.
    for (const c of unpaired) {
      expect(c.group_keys?.some((g) => g.key.startsWith('confusion:'))).toBeFalsy()
    }
  })
})
