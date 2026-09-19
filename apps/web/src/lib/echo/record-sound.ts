// apps/web/src/lib/echo/record-sound.ts
//
// EchoMatch 청각 신호의 **적재 경로** — 판정은 `word-signal.ts`(순수)가 한다.
//
// 파일을 나누는 이유는 `word-progress.ts` ↔ `word-progress-query.ts` 와 같다:
// 규칙은 테스트로 고정하고, 조회·쓰기는 갈아끼울 수 있어야 한다.
//
// ⚠️ 여기서 **`vocabularies` 를 건드리지 않는다.** EchoMatch 는 문장이 화면에 떠 있는 채로
//    따라 말하는 활동이라 인출이 아니다 — 복습 간격을 움직이면 정작 못 외운 단어가 안 돌아온다.
//    남기는 것은 `learning_records` 뿐이고, 그것으로 ① 면(F3) 이력 ② 그날의 활동
//    (`trg_daily_activity_from_lr`) 두 가지가 채워진다. 근거는 `word-signal.ts` 머리말 참조.

'use client'

import { createClient } from '@/lib/supabase/client'
import { loadInflectedForms } from '@/lib/workspace/scoped-words'

import type { SoundLemma, SoundRecord } from './word-signal'

/**
 * 이 텍스트에서 학습자가 담아 둔 단어들 — 청각 신호의 대상.
 *
 * dictation 의 텍스트 소스와 같은 기준(`vocabularies.text_id`)을 쓴다. 둘이 갈라지면
 * "받아쓰기는 타깃인데 따라 말하기는 아닌" 단어가 생기고, 학습자는 이유를 알 수 없다.
 */
export async function loadSoundLemmas(textId: string): Promise<SoundLemma[]> {
  const supabase = createClient()
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) return []

  const { data } = await supabase
    .from('vocabularies')
    .select('id, word, lemma')
    .eq('user_id', userId)
    .eq('text_id', textId)
    .limit(300)

  const rows = (data ?? []) as Array<{ id: string; word: string; lemma: string | null }>
  if (rows.length === 0) return []

  const formsMap = await loadInflectedForms(
    supabase,
    rows.map((r) => (r.lemma ?? r.word).toLowerCase()),
  )

  return rows.map((r) => {
    const key = (r.lemma ?? r.word).toLowerCase()
    return { id: r.id, word: key, forms: formsMap.get(key) ?? [] }
  })
}

/**
 * 판정 결과를 인출 기록으로 남긴다.
 *
 * `rating` 은 **비운다**(nullable). 그건 FSRS 채점칸이고, 여기서 넣으면 이 활동이
 * 복습 등급을 매긴 것처럼 읽힌다 — 실제로는 스케줄을 움직이지 않는다.
 * 대신 판정 근거를 `metadata` 에 남겨 나중에 "이 통과가 무엇으로 났나" 를 되물을 수 있게 한다.
 *
 * 비로그인·빈 입력은 silent skip — 따라 말하기 자체는 계속돼야 한다(적재는 부수 효과다).
 */
export async function recordEchoSound(
  records: SoundRecord[],
  context: { sentenceId: string; overall: number },
): Promise<{ ok: boolean; written: number; reason?: string }> {
  if (records.length === 0) return { ok: true, written: 0 }

  const supabase = createClient()
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) return { ok: false, written: 0, reason: 'unauthenticated' }

  const rows = records.map((r) => ({
    user_id: userId,
    vocabulary_id: r.lemma.id,
    module: 'echo' as const,
    is_correct: r.isCorrect,
    rating: null,
    metadata: {
      evidence: r.evidence,
      sentence_id: context.sentenceId,
      overall_score: context.overall,
    },
  }))

  const { error } = await supabase.from('learning_records').insert(rows)
  if (error) return { ok: false, written: 0, reason: error.message }
  return { ok: true, written: rows.length }
}
