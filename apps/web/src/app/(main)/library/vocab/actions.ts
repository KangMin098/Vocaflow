// apps/web/src/app/(main)/library/vocab/actions.ts
//
// 공용 단어장 구독/해지 Server Actions.
//
// v06.35 — 구독과 적재를 분리한다.
//   이전: 구독 시 세트 **전량**을 vocabularies 에 넣었다. cap 40 시절엔 40개라 티가 안
//   났지만, 발행 cap 을 제거하자(학습 대상 누락을 없애기 위해) 세트가 챕터당 300개
//   내외가 됐고 구독 한 번에 그만큼이 FSRS 큐로 들어가게 됐다. 하루 22단어 기준
//   14일치를 학습자 동의 없이 밀어 넣는 셈이다 (인지부하 원칙 위반).
//
//   현재: 구독은 "이 세트를 학습하겠다"는 **표시**이고, 적재는 **첫 세션 분량만** 한다.
//   나머지는 리더에서 챕터에 도달할 때 L2(deliver/commit_chapter_vocab)가 채운다 —
//   그 편이 Context-Dependent 인출에도 맞다(읽는 맥락에서 그 챕터 단어를 만난다).
//
//   도서 챕터 세트는 L2 로직(commit_chapter_vocab)을 그대로 재사용해 선정 기준이
//   리더와 갈라지지 않게 한다. 도서가 아닌 세트(어원·교육과정 등)는 챕터 진입 개념이
//   없으므로 상한만 두고 기존 방식을 유지한다.
//
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

/**
 * 도서가 아닌 세트(어원·교육과정 등)의 구독 시 첫 적재 상한.
 *
 * 세트 전체를 한 번에 넣으면 그날 학습자의 FSRS 큐가 세트 크기만큼 부푼다.
 * UI 가 안내하는 하루 신규 22단어를 기준으로 이틀치 정도를 시작 분량으로 잡는다 —
 * 학습을 즉시 시작할 수 있으면서도 큐가 압도되지 않는 선.
 */
const INITIAL_IMPORT_LIMIT = 40

export async function subscribeSet(setId: string): Promise<SubscribeResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, reason: 'unauthenticated' }

  // 게시된 세트만 구독 가능 — 클라이언트 신뢰 X
  const { data: set, error: setErr } = await supabase
    .from('shared_word_sets')
    .select('id, is_published, category, curation_query')
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

  // 2) 도서 챕터 세트 — L2 에 위임한다.
  //    리더에서 쓰는 것과 **같은 함수**라 선정 기준이 갈라지지 않는다:
  //    기보유 제외 + 학습자 i+1 재랭킹 + 챕터 길이 기반 분량(8~30).
  //    나머지 단어는 리더에서 그 챕터에 도달할 때 채워진다.
  const cq = set.curation_query as { book_id?: string; chapter_idx?: number } | null
  if (set.category === 'library_book' && cq?.book_id && cq.chapter_idx != null) {
    const { data: n, error: cErr } = await (
      supabase as unknown as {
        rpc: (
          fn: string,
          args: Record<string, unknown>,
        ) => Promise<{ data: number | null; error: { message: string } | null }>
      }
    ).rpc('commit_chapter_vocab', { p_book_id: cq.book_id, p_chapter_idx: cq.chapter_idx })
    if (cErr) return { ok: false, reason: 'error', message: cErr.message }

    const { count: total } = await supabase
      .from('shared_words')
      .select('*', { count: 'exact', head: true })
      .eq('set_id', setId)

    revalidatePath('/library/vocab')
    revalidatePath('/wordvault')
    const imported = typeof n === 'number' && n > 0 ? n : 0
    return {
      ok: true,
      importedCount: imported,
      alreadyOwnedCount: 0,
      totalWords: total ?? 0,
    }
  }

  // 3) 도서가 아닌 세트 — 챕터 진입 개념이 없으므로 상한만 두고 적재한다.
  const { data: words, error: wErr } = await supabase
    .from('shared_words')
    .select('word, meaning_ko, source_sentence, example_en, pronunciation, part_of_speech, cefr_level')
    .eq('set_id', setId)
    .order('sort_order', { ascending: true, nullsFirst: false })
    .limit(INITIAL_IMPORT_LIMIT)
  if (wErr) return { ok: false, reason: 'error', message: wErr.message }

  // totalWords 는 **세트 전체 크기** — 이번에 담은 양(words.length)이 아니다.
  //   UI 가 "N개 중 M개 시작" 을 안내할 수 있어야 한다 (상한이 생겼으므로 둘이 다르다).
  const { count: setTotal } = await supabase
    .from('shared_words')
    .select('*', { count: 'exact', head: true })
    .eq('set_id', setId)
  const totalWords = setTotal ?? 0

  if (!words || words.length === 0) {
    revalidatePath('/library/vocab')
    revalidatePath('/wordvault')
    return { ok: true, importedCount: 0, alreadyOwnedCount: 0, totalWords }
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
    // 원문 문장 우선 (도서 챕터 문맥) → dict 일반 예문 폴백
    example_sentence: w.source_sentence ?? w.example_en,
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
    // 이번에 실제로 담은 양 — 상한(INITIAL_IMPORT_LIMIT) 때문에 totalWords 와 다르다
    importedCount: words.length - alreadyOwnedCount,
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
