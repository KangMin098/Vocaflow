// apps/web/src/lib/wordvault/add-word.ts
// Phase 11.7 — WordVault에 단어 추가 (server action, 멱등)
//
// vocabularies UNIQUE (user_id, word) → ON CONFLICT 보호 + 사전 SELECT로 멱등

'use server';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

export interface AddWordInput {
  word: string;
  meaning: string | null;
  pronunciation: string | null;
  pos: string | null;
  cefrLevel: string | null;
  exampleSentence: string | null;
  textId: string;
}

export type AddWordResult =
  | { ok: true; alreadyExists: boolean }
  | { ok: false; error: string };

export async function addWordToVault(input: AddWordInput): Promise<AddWordResult> {
  const client = (await createClient()) as unknown as SupabaseClient;

  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return { ok: false, error: '로그인이 필요합니다.' };
  }

  const normalizedWord = input.word.toLowerCase();

  const { data: existing } = await client
    .from('vocabularies')
    .select('id')
    .eq('user_id', user.id)
    .eq('word', normalizedWord)
    .maybeSingle();

  if (existing) {
    return { ok: true, alreadyExists: true };
  }

  const { error } = await client.from('vocabularies').insert({
    user_id: user.id,
    text_id: input.textId,
    word: normalizedWord,
    meaning: input.meaning ?? '',
    pronunciation: input.pronunciation ?? '',
    pos: input.pos ?? '',
    cefr_level: input.cefrLevel,
    example_sentence: input.exampleSentence ?? '',
    origin: 'manual',
  });

  if (error) {
    if (error.code === '23505') {
      return { ok: true, alreadyExists: true };
    }
    console.error('[addWordToVault] insert failed:', error.message);
    return { ok: false, error: error.message };
  }

  return { ok: true, alreadyExists: false };
}
