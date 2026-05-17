// apps/web/src/app/(main)/library/vocab/actions.ts
//
// 공용 단어장 구독/해지 Server Actions.
// 구독 시:
//   1) user_word_set_subscriptions upsert (멱등)
//   2) shared_words → vocabularies 벌크 import (origin='shared_set', shared_set_id 기록,
//      UNIQUE(user_id, word) 충돌은 무시 — 이미 보유한 단어는 건드리지 않음)
// 해지 시: 구독만 제거. vocabularies 는 보존 — 학습 기록(learning_records FK)이
//   삭제될 위험과 사용자가 손댄 단어를 임의로 지우면 안 되기 때문.

'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'

export type SubscribeResult =
  | { ok: true; importedCount: number; alreadyOwnedCount: number; totalWords: number }
  | { ok: false; reason: 'unauthenticated' | 'not_published' | 'error'; message?: string }

export type UnsubscribeResult =
  | { ok: true }
  | { ok: false; reason: 'unauthenticated' | 'error'; message?: string }

const VOCAB_IMPORT_CHUNK = 500 // Supabase POST payload 한도 대비 분할

export async function subscribeSet(setId: string): Promise<SubscribeResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, reason: 'unauthenticated' }

  // 게시된 세트만 구독 가능 — 클라이언트 신뢰 X
  const { data: set, error: setErr } = await supabase
    .from('shared_word_sets')
    .select('id, is_published')
    .eq('id', setId)
    .maybeSingle()
  if (setErr) return { ok: false, reason: 'error', message: setErr.message }
  if (!set || !set.is_published) return { ok: false, reason: 'not_published' }

  // 1) 구독 upsert
  const { error: subErr } = await supabase
    .from('user_word_set_subscriptions')
    .upsert(
      { user_id: user.id, set_id: setId },
      { onConflict: 'user_id,set_id', ignoreDuplicates: true },
    )
  if (subErr) return { ok: false, reason: 'error', message: subErr.message }

  // 2) shared_words → vocabularies import
  const { data: words, error: wErr } = await supabase
    .from('shared_words')
    .select('word, meaning_ko, example_en, pronunciation, part_of_speech, cefr_level')
    .eq('set_id', setId)
  if (wErr) return { ok: false, reason: 'error', message: wErr.message }

  const totalWords = words?.length ?? 0
  if (totalWords === 0) {
    revalidatePath('/library/vocab')
    revalidatePath('/wordvault')
    return { ok: true, importedCount: 0, alreadyOwnedCount: 0, totalWords: 0 }
  }

  // 이미 보유한 단어 (충돌로 무시될 것) 카운트 — UX 안내용
  const wordList = words!.map((w) => w.word)
  const { data: existing, error: exErr } = await supabase
    .from('vocabularies')
    .select('word')
    .eq('user_id', user.id)
    .in('word', wordList)
  if (exErr) return { ok: false, reason: 'error', message: exErr.message }
  const alreadyOwnedCount = existing?.length ?? 0

  // 청크 단위 upsert — UNIQUE(user_id, word) 충돌 무시
  const rows = words!.map((w) => ({
    user_id: user.id,
    word: w.word,
    meaning: w.meaning_ko,
    example_sentence: w.example_en,
    pronunciation: w.pronunciation,
    pos: w.part_of_speech,
    cefr_level: w.cefr_level,
    origin: 'shared_set',
    shared_set_id: setId,
  }))

  for (let i = 0; i < rows.length; i += VOCAB_IMPORT_CHUNK) {
    const chunk = rows.slice(i, i + VOCAB_IMPORT_CHUNK)
    const { error } = await supabase
      .from('vocabularies')
      .upsert(chunk, { onConflict: 'user_id,word', ignoreDuplicates: true })
    if (error) return { ok: false, reason: 'error', message: error.message }
  }

  revalidatePath('/library/vocab')
  revalidatePath('/wordvault')
  return {
    ok: true,
    importedCount: totalWords - alreadyOwnedCount,
    alreadyOwnedCount,
    totalWords,
  }
}

export async function unsubscribeSet(setId: string): Promise<UnsubscribeResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, reason: 'unauthenticated' }

  const { error } = await supabase
    .from('user_word_set_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .eq('set_id', setId)
  if (error) return { ok: false, reason: 'error', message: error.message }

  // ⚠️ vocabularies 는 보존. 사용자가 학습한 단어와 learning_records 가 함께 사라지면
  //   복구 불가능. 정리는 /wordvault 에서 사용자 명시 액션으로만.
  revalidatePath('/library/vocab')
  revalidatePath('/wordvault')
  return { ok: true }
}
