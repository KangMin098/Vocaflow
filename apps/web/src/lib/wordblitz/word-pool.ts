// apps/web/src/lib/wordblitz/word-pool.ts
// Phase 11.9 B — WordBlitz 단어 풀 builder
//
// 정책: 사용자 vocabularies 우선 + chapter LV 보충 (혼합)
// - 사용자 단어가 게임에 즉각 등장 → endowment 강화
// - chapter LV 보충으로 부족 시 game 성립 보장 (최소 8개)
// - shared_dictionary lookup으로 한국어 뜻 채움

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Word } from './data';

const TOTAL_POOL_SIZE = 12;
const USER_PRIORITY_CAP = 8; // 사용자 단어 최대 N개 (나머지는 chapter 보충)

interface VocabRow {
  word: string;
  meaning: string | null;
  pronunciation: string | null;
}

interface LbvRow {
  word: string;
  base_learning_value: number;
}

interface DictRow {
  word: string;
  meaning_ko: string | null;
}

/**
 * Workspace WordBlitz 모드용 단어 풀 구성.
 * @param libraryBookId null이면 chapter 보충 skip (사용자 직접 입력 텍스트)
 */
export async function buildWordBlitzPool(
  client: SupabaseClient,
  userId: string,
  libraryBookId: string | null,
  chapterIdx: number | null,
): Promise<Word[]> {
  // 1. 사용자 vocabularies 우선 (created_at DESC, USER_PRIORITY_CAP)
  const { data: userVocabs } = await client
    .from('vocabularies')
    .select('word, meaning, pronunciation')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(USER_PRIORITY_CAP);

  const userRows = (userVocabs ?? []) as VocabRow[];
  const userWords: Word[] = userRows
    .filter((r) => r.word && r.meaning)
    .map((r) => ({
      en: r.word,
      ko: r.meaning ?? '',
      ...(r.pronunciation ? { pron: r.pronunciation } : {}),
    }));

  if (userWords.length >= TOTAL_POOL_SIZE) {
    return userWords.slice(0, TOTAL_POOL_SIZE);
  }

  // 2. chapter LV 보충 (library chapter만)
  if (!libraryBookId || chapterIdx == null) {
    return userWords;
  }

  const userWordSet = new Set(userWords.map((w) => w.en.toLowerCase()));
  const need = TOTAL_POOL_SIZE - userWords.length;

  const { data: lbvData } = await client
    .from('library_book_vocabularies')
    .select('word, base_learning_value')
    .eq('library_book_id', libraryBookId)
    .eq('chapter_idx', chapterIdx)
    // 노이즈 가드 — 고유명사·contraction·미지 토큰 제외 (게임 후보에 jim/john 출현 방지)
    // (CLAUDE.md v06.29 §"라이브러리 도서 난이도 지수" 안티패턴 정합)
    .not('lemma', 'is', null)
    .order('base_learning_value', { ascending: false })
    .limit(need * 3); // 사용자 단어와 중복 제거 buffer

  const lbvRows = (lbvData ?? []) as LbvRow[];
  const candidateWords = lbvRows
    .map((r) => r.word)
    .filter((w) => !userWordSet.has(w.toLowerCase()))
    .slice(0, need);

  if (candidateWords.length === 0) {
    return userWords;
  }

  // shared_dictionary lookup (한국어 뜻)
  const { data: dictData } = await client
    .from('shared_dictionary')
    .select('word, meaning_ko')
    .in('word', candidateWords);

  const dictMap = new Map<string, string | null>();
  for (const d of (dictData ?? []) as DictRow[]) {
    dictMap.set(d.word, d.meaning_ko);
  }

  const chapterWords: Word[] = candidateWords
    .map((w) => ({
      en: w,
      ko: dictMap.get(w) ?? '(의미 미등록)',
    }))
    .filter((w) => w.ko !== '(의미 미등록)'); // 뜻 없는 단어 제외 (게임 불가)

  return [...userWords, ...chapterWords].slice(0, TOTAL_POOL_SIZE);
}
