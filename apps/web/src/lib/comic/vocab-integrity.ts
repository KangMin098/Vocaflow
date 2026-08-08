// apps/web/src/lib/comic/vocab-integrity.ts
//
// 만화 target_vocab ↔ 도서 챕터 단어장 정합 검사 (설계서 §7.4 · G7).
//
// 왜 필요한가: `comic_pages.target_vocab` 은 verbatim(정본) 버블에서만 뽑는다는 계약이라
//   원문·ScriptQuiz·Dictation 과 같은 단어여야 한다. 그 계약이 깨지면 학습자가 만화에서 만난 단어가
//   챕터 단어장(shared_word_sets category='library_book')에 없는 '고아'가 되어 FSRS 로 이어지지 않는다.
//   차단이 아니라 판정(발행 체크리스트)으로 다룬다 — 큐레이터가 보고 고칠 수 있어야 한다.
//
// 검사는 SQL 함수 대신 TS 로 둔다: 마이그레이션 없이 즉시 작동하고, 규칙(표제어 변형 허용)을
//   단위 테스트로 고정할 수 있다.

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

export interface VocabIntegrity {
  /** 만화가 표면화하는 고유 단어 수 */
  total: number
  /** 챕터 단어장에서 찾은 수 */
  matched: number
  /** 단어장에 없는 단어 (정합 위반) */
  orphans: string[]
  /** 비교 대상 단어장이 아예 없으면 true — 위반이 아니라 '판정 불가' */
  noWordSets: boolean
}

/** 비교 정규화 — 대소문자·좌우 공백·전후 문장부호 제거 (하이픈/어퍼스트로피는 단어의 일부라 보존) */
export function normalizeWord(w: string): string {
  return w
    .trim()
    .toLowerCase()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
}

/**
 * 순수 판정 — 단어장 어휘(word 또는 lemma)에 없는 target_vocab 을 골라낸다.
 * 표제어 변형을 감안해 word/lemma 양쪽을 후보로 본다(예: 만화 "wrought" vs 단어장 lemma "work").
 */
export function computeVocabOrphans(
  targetVocab: string[],
  setWords: Array<{ word: string | null; lemma: string | null }>,
): { total: number; matched: number; orphans: string[] } {
  const known = new Set<string>()
  for (const s of setWords) {
    if (s.word) known.add(normalizeWord(s.word))
    if (s.lemma) known.add(normalizeWord(s.lemma))
  }
  known.delete('')

  const seen = new Set<string>()
  const orphans: string[] = []
  let matched = 0
  for (const raw of targetVocab) {
    const w = normalizeWord(raw ?? '')
    if (!w || seen.has(w)) continue
    seen.add(w)
    if (known.has(w)) matched += 1
    else orphans.push(w)
  }
  return { total: seen.size, matched, orphans: orphans.sort() }
}

/**
 * 도서 단위 정합 검사. 호출부(Admin 검수)는 이미 comic_pages 를 들고 있으므로 target_vocab 을 넘긴다.
 * 단어장 조회 실패는 '판정 불가'로 degrade (검수 화면이 죽지 않게).
 */
export async function fetchComicVocabIntegrity(
  client: SupabaseClient,
  bookId: string,
  targetVocab: string[],
): Promise<VocabIntegrity> {
  const empty: VocabIntegrity = { total: 0, matched: 0, orphans: [], noWordSets: false }
  if (targetVocab.length === 0) return empty

  try {
    const { data: sets, error } = await client
      .from('shared_word_sets')
      .select('id')
      .eq('category', 'library_book')
      .eq('curation_query->>book_id', bookId)
    if (error) return { ...empty, noWordSets: true }

    const ids = ((sets ?? []) as Array<{ id: string }>).map((s) => s.id)
    if (ids.length === 0) {
      const r = computeVocabOrphans(targetVocab, [])
      return { ...r, orphans: [], noWordSets: true, matched: 0 }
    }

    const { data: words, error: wErr } = await client
      .from('shared_words')
      .select('word, lemma')
      .in('set_id', ids)
    if (wErr) return { ...empty, noWordSets: true }

    const r = computeVocabOrphans(
      targetVocab,
      (words ?? []) as Array<{ word: string | null; lemma: string | null }>,
    )
    return { ...r, noWordSets: false }
  } catch {
    return { ...empty, noWordSets: true }
  }
}
