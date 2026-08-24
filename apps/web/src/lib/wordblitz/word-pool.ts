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
  lemma: string | null;
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
    .select('word, lemma, base_learning_value')
    .eq('library_book_id', libraryBookId)
    .eq('chapter_idx', chapterIdx)
    // 노이즈 가드 — 고유명사·contraction·미지 토큰 제외 (게임 후보에 jim/john 출현 방지)
    // (CLAUDE.md v06.29 §"라이브러리 도서 난이도 지수" 안티패턴 정합)
    .not('lemma', 'is', null)
    .order('base_learning_value', { ascending: false })
    .limit(need * 3); // 사용자 단어와 중복 제거 buffer

  const lbvRows = (lbvData ?? []) as LbvRow[];

  // 후보 키는 표면형(r.word)이 아니라 **lemma** 다. 실측(2026-08-22) 1,591,690행 중
  // 표면형이 사전에 정확일치하는 것은 71.3% 뿐이고 lemma 는 100% — 표면형으로 찾으면
  // 나머지 28.7% 가 뜻 없음으로 걸러져 풀이 12개를 못 채운다(게임이 조용히 짧아진다).
  const seen = new Set<string>();
  const candidateWords: string[] = [];
  for (const r of lbvRows) {
    const lemma = (r.lemma ?? '').toLowerCase();
    if (!lemma || seen.has(lemma) || userWordSet.has(lemma)) continue;
    seen.add(lemma);
    candidateWords.push(lemma);
  }

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

  // 뜻이 없는 후보를 **먼저** 거른 뒤 need 만큼 자른다. 순서가 반대면(예전 코드) 자르고 나서
  // 걸러서 풀이 목표치에 못 미친 채로 게임이 시작됐다 — 버퍼(need*3)를 뽑아 두고 쓰지 못했다.
  const chapterWords: Word[] = candidateWords
    .map((w) => ({ en: w, ko: dictMap.get(w) ?? '' }))
    .filter((w) => w.ko.length > 0)
    .slice(0, need);

  return [...userWords, ...chapterWords].slice(0, TOTAL_POOL_SIZE);
}
