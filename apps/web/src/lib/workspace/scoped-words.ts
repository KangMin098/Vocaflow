// apps/web/src/lib/workspace/scoped-words.ts
//
// 워크스페이스 ModePills(카드·블리츠 …) → 모듈 진입 시 현재 자료의 단어를 fetch.
// 모듈 무관 neutral shape — 각 모듈(Flashcard / WordBlitz)이 자기 타입으로 adapt.
//   · set  : 도서 챕터 shared_word_sets.id → shared_words (canonical · "단어" pill 과 동일 소스)
//   · text : 사용자 스크립트 texts.id      → vocabularies WHERE text_id (사용자 어휘 자산)
//
// 스코프 규칙은 page.tsx 의 wordsHref 와 정합 — 도서면 챕터 단어장, 스크립트면 그 텍스트.

import type { SupabaseClient } from '@supabase/supabase-js'

export interface ScopedWord {
  id: string
  word: string
  meaning: string
  pronunciation: string
  pos: string
  example: string
  /** 사전 DB inflected_forms (lemma 기준) — 예문 하이라이트/빈칸 불규칙 인식용 */
  inflectedForms: string[]
  /** 그림책 단어면 그 단어가 등장한 페이지 삽화 url — Dual Coding 시각 단서 */
  illustrationUrl?: string
}

/** 본문 문장 → 그 페이지 삽화 url 매처. illustration.alt(페이지 텍스트) 와 source_sentence 정합. */
function buildIllustrationMatcher(
  illustrations: Array<{ idx: number; url: string; alt?: string }> | null,
): (sentence: string | null | undefined) => string | undefined {
  const norm = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
  const idx = (illustrations ?? [])
    .filter((i) => i && typeof i.url === 'string' && typeof i.alt === 'string')
    .map((i) => ({ url: i.url, alt: norm(i.alt as string) }))
    .filter((i) => i.alt.length >= 8)
  if (idx.length === 0) return () => undefined
  return (sentence) => {
    if (!sentence) return undefined
    const s = norm(sentence)
    if (s.length < 8) return undefined
    const head = s.slice(0, 40)
    const hit = idx.find((i) => i.alt.includes(head) || s.includes(i.alt.slice(0, 40)))
    return hit?.url
  }
}

/** lemma 목록 → shared_dictionary.inflected_forms 일괄 조회 (lemma → forms 맵) */
async function loadInflectedForms(
  client: SupabaseClient,
  lemmas: string[],
): Promise<Map<string, string[]>> {
  const uniq = [...new Set(lemmas.filter((l): l is string => !!l))]
  if (uniq.length === 0) return new Map()
  const { data } = await client
    .from('shared_dictionary')
    .select('word, inflected_forms')
    .in('word', uniq)
  const map = new Map<string, string[]>()
  for (const r of (data ?? []) as Array<{ word: string; inflected_forms: string[] | null }>) {
    if (r.inflected_forms && r.inflected_forms.length > 0) map.set(r.word, r.inflected_forms)
  }
  return map
}

export interface ScopedWordsResult {
  words: ScopedWord[]
  /** ResourceContext / 빈 상태 라벨 */
  title: string
  subtitle: string
  /** 도서 챕터면 "Chapter N", 스크립트면 '' */
  chapterLabel: string
}

export async function fetchScopedWords(
  client: SupabaseClient,
  scope: { set?: string; text?: string; chapter?: number | null; userId: string | null },
): Promise<ScopedWordsResult | null> {
  if (scope.set) return fetchBySet(client, scope.set, scope.chapter ?? null)
  if (scope.text && scope.userId) return fetchByText(client, scope.text, scope.userId)
  return null
}

async function fetchBySet(
  client: SupabaseClient,
  setId: string,
  /** 세트 내 특정 챕터만 학습 (shared_words.chapter). null=세트 전체. */
  chapter: number | null = null,
): Promise<ScopedWordsResult | null> {
  const { data: setRow } = await client
    .from('shared_word_sets')
    .select('id, title, curation_query')
    .eq('id', setId)
    .maybeSingle()
  const set = setRow as {
    id: string
    title: string
    curation_query: Record<string, unknown> | null
  } | null
  if (!set) return null

  let q = client
    .from('shared_words')
    .select('id, word, lemma, meaning_ko, source_sentence, example_en, pronunciation, part_of_speech')
    .eq('set_id', setId)
  if (chapter != null) q = q.eq('chapter', chapter)
  const { data, error } = await q.order('sort_order', { ascending: true })
  if (error) return null

  const rows = (data ?? []) as Array<{
    id: string
    word: string
    lemma: string | null
    meaning_ko: string | null
    source_sentence: string | null
    example_en: string | null
    pronunciation: string | null
    part_of_speech: string | null
  }>

  const formsMap = await loadInflectedForms(client, rows.map((r) => r.lemma ?? r.word))

  // 그림책 삽화 (StoryWeaver 등) — 단어 페이지 문장 → 삽화 매핑 (Dual Coding)
  const bookId =
    typeof set.curation_query?.['book_id'] === 'string'
      ? (set.curation_query['book_id'] as string)
      : null
  let matchIllus: (s: string | null | undefined) => string | undefined = () => undefined
  if (bookId) {
    const { data: bookRow } = await client
      .from('library_books')
      .select('illustrations')
      .eq('id', bookId)
      .maybeSingle()
    const illus = (bookRow as {
      illustrations: Array<{ idx: number; url: string; alt?: string }> | null
    } | null)?.illustrations
    matchIllus = buildIllustrationMatcher(illus ?? null)
  }

  const chapterIdx = Number(set.curation_query?.['chapter_idx'] ?? 0)
  const words: ScopedWord[] = rows.map((r) => {
    const illustrationUrl = matchIllus(r.source_sentence)
    return {
      id: r.id,
      word: r.word,
      meaning: r.meaning_ko ?? '',
      pronunciation: r.pronunciation ?? '',
      pos: r.part_of_speech ?? '',
      // 원문 문장 우선 (도서 챕터 문맥) → dict 일반 예문 폴백 (auto-V/specialty 단어장 등)
      example: r.source_sentence ?? r.example_en ?? '',
      inflectedForms: formsMap.get(r.lemma ?? r.word) ?? [],
      ...(illustrationUrl ? { illustrationUrl } : {}),
    }
  })

  // 세트 내 챕터 지정(신규 내부챕터) 우선 → 도서 챕터 세트(curation_query.chapter_idx) 폴백
  const label = chapter != null ? `Chapter ${chapter}` : chapterIdx > 0 ? `Chapter ${chapterIdx}` : ''
  return {
    words,
    title: set.title,
    subtitle: chapter != null ? `Chapter ${chapter} · ${words.length}개 단어` : `${words.length}개 단어`,
    chapterLabel: label,
  }
}

async function fetchByText(
  client: SupabaseClient,
  textId: string,
  userId: string,
): Promise<ScopedWordsResult | null> {
  const { data: textRow } = await client
    .from('texts')
    .select('id, title')
    .eq('id', textId)
    .maybeSingle()
  const text = textRow as { id: string; title: string } | null

  const { data, error } = await client
    .from('vocabularies')
    .select('id, word, lemma, meaning, example_sentence, pronunciation, pos')
    .eq('user_id', userId)
    .eq('text_id', textId)
    .order('created_at', { ascending: true })
  if (error) return null

  const rows = (data ?? []) as Array<{
    id: string
    word: string
    lemma: string | null
    meaning: string | null
    example_sentence: string | null
    pronunciation: string | null
    pos: string | null
  }>

  const formsMap = await loadInflectedForms(client, rows.map((r) => r.lemma ?? r.word))

  const title = text?.title ?? '내 스크립트'
  const words: ScopedWord[] = rows.map((r) => ({
    id: r.id,
    word: r.word,
    meaning: r.meaning ?? '',
    pronunciation: r.pronunciation ?? '',
    pos: r.pos ?? '',
    example: r.example_sentence ?? '',
    inflectedForms: formsMap.get(r.lemma ?? r.word) ?? [],
  }))

  return { words, title, subtitle: `${words.length}개 단어`, chapterLabel: '' }
}
