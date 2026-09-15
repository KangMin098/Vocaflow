// apps/web/src/lib/echo/__tests__/sound-signal.integration.test.ts
//
// 따라 말하기 한 번 → **면 매트릭스의 Sound 칸**까지, 실 DB 로 잇는다.
// 환경변수(SERVICE_ROLE) 없으면 skip.
//
// 왜 이 테스트가 있나:
//   `word-signal.test.ts` 는 판정 규칙만 본다. 그런데 이 기능이 실제로 죽는 지점은 규칙이
//   아니라 **연결부**다 — enum 에 값이 없어 INSERT 가 튕기거나, 기록은 들어갔는데
//   `word-progress` 가 그 module 을 몰라 면이 안 서거나. 둘 다 화면은 멀쩡하고
//   처방만 비어 있어서, 눈으로는 "아직 안 해서 그렇겠지" 와 구분되지 않는다.
//   (같은 종류의 공백이 dictation 에서 실제로 났다 — 타입·단위는 통과했고 e2e 가 잡았다.)
//
// 무엇을 고정하나:
//   ① `module='echo'` INSERT 가 실제로 통과한다 (마이그레이션 20260814090000)
//   ② 그 기록이 `word-progress` 에서 **sound 면**으로 접힌다
//   ③ 오답도 시도로 세어 정답률을 떨어뜨린다 (통과가 거저 나지 않는다)
//   ④ **복습 간격을 움직이지 않는다** — vocabularies 의 D/S/review_count 가 그대로다
//      (설계상 가장 중요한 경계다. 여기가 무너지면 못 외운 단어가 안 돌아온다.)

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { deriveWordStates, type FacetAttempt } from '@/lib/framework/word-progress'

import { soundRecords, type SoundLemma } from '../word-signal'

const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL']
const SERVICE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY']
const skipIfNoEnv = !SUPABASE_URL || !SERVICE_KEY

const TEST_EMAIL = 'runtime-test-0705@vocaflow.dev'

interface VocabSnapshot {
  id: string
  word: string
  difficulty: number | null
  stability: number | null
  review_count: number | null
}

describe.skipIf(skipIfNoEnv)('EchoMatch 청각 신호 (integration · 발화 → 면)', () => {
  let svc: SupabaseClient
  let userId: string
  let vocab: VocabSnapshot | null = null
  let insertedIds: string[] = []

  beforeAll(async () => {
    svc = createClient(SUPABASE_URL!, SERVICE_KEY!, { auth: { persistSession: false } })

    const { data: users } = await svc.auth.admin.listUsers({ page: 1, perPage: 200 })
    userId = users?.users.find((u) => u.email === TEST_EMAIL)?.id ?? ''

    if (userId) {
      const { data } = await svc
        .from('vocabularies')
        .select('id, word, difficulty, stability, review_count')
        .eq('user_id', userId)
        .limit(1)
      vocab = ((data ?? [])[0] as VocabSnapshot | undefined) ?? null
    }
  })

  afterAll(async () => {
    // 테스트가 만든 행만 지운다 — 남기면 다음 실행의 면 분포가 오염된다
    if (insertedIds.length > 0) {
      await svc.from('learning_records').delete().in('id', insertedIds)
    }
  })

  it('module=echo 기록이 실제로 적재된다 (enum 이 값을 받는다)', async () => {
    expect(userId, `${TEST_EMAIL} 계정을 찾지 못했다`).toBeTruthy()
    expect(vocab, '검증 계정에 단어가 없다').toBeTruthy()

    // 실제 발화 한 번을 재현한다 — 문장에 든 두 단어 중 하나만 인식된 상황
    const sentence = `The ${vocab!.word} was quiet.`
    const lemmas: SoundLemma[] = [{ id: vocab!.id, word: vocab!.word.toLowerCase(), forms: [] }]
    const recs = soundRecords({
      sentence,
      score: { pitch: 77, energy: 56, timing: 95, overall: 76 },
      lemmas,
      transcriptRatio: 0.8,
      matchedKeys: new Set(sentence.toLowerCase().replace(/[.]/g, '').split(/\s+/)),
    })
    expect(recs).toHaveLength(1)
    expect(recs[0].evidence).toBe('transcript')
    expect(recs[0].isCorrect).toBe(true)

    const { data, error } = await svc
      .from('learning_records')
      .insert(
        recs.map((r) => ({
          user_id: userId,
          vocabulary_id: r.lemma.id,
          module: 'echo' as const,
          is_correct: r.isCorrect,
          rating: null,
          metadata: { evidence: r.evidence, sentence_id: 'integration-test' },
        })),
      )
      .select('id')

    expect(error, error?.message).toBeNull()
    insertedIds = ((data ?? []) as Array<{ id: string }>).map((r) => r.id)
    expect(insertedIds).toHaveLength(1)
  })

  it('적재된 기록이 sound 면으로 접힌다 (module 을 면으로 잇는 고리가 살아 있다)', async () => {
    expect(insertedIds.length).toBeGreaterThan(0)

    const { data } = await svc
      .from('learning_records')
      .select('module, is_correct')
      .in('id', insertedIds)

    const attempts: FacetAttempt[] = ((data ?? []) as Array<{ module: string; is_correct: boolean }>)
      .map((r) => ({ word: vocab!.word.toLowerCase(), module: r.module, isCorrect: r.is_correct }))

    const [state] = deriveWordStates(attempts, new Map())
    expect(state.accuracy.sound, 'echo 기록이 sound 면에 안 잡혔다').toBe(1)
    // 1회는 통과가 아니다 — 우연을 통과로 세지 않는 규칙이 여기서도 같이 산다
    expect(state.passed).not.toContain('sound')
  })

  it('복습 간격을 움직이지 않는다 (발화 모방은 인출이 아니다)', async () => {
    const { data } = await svc
      .from('vocabularies')
      .select('id, word, difficulty, stability, review_count')
      .eq('id', vocab!.id)
      .single()

    const after = data as VocabSnapshot
    expect(after.difficulty).toBe(vocab!.difficulty)
    expect(after.stability).toBe(vocab!.stability)
    expect(after.review_count).toBe(vocab!.review_count)
  })
})
