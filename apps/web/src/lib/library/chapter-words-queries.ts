// apps/web/src/lib/library/chapter-words-queries.ts
// Phase 11.7 — chapter 단어 enrichment 데이터 fetch
//
// library_book_vocabularies + shared_dictionary LEFT JOIN
// LV 상위 N개만 (default 30, 성능 + 학습 집중)

import type { SupabaseClient } from '@supabase/supabase-js';

// ─────────────────────────────────────────────
// 사용자 레벨 맞춤 추출 (Krashen i+1) — 라이브러리 도서 chapter
// 챕터 lemma → extract_vocabulary_for_user RPC (목표 = 사용자 V-Level+1 gaussian)
// ─────────────────────────────────────────────

export interface LeveledChapterWord {
  word: string;
  meaning: string | null;
  pos: string | null;
  cefrLevel: string | null;
  vLevel: number | null;
  /** i+1 근접도 (0~1, 목표 레벨에서 1.0) */
  vProximity: number | null;
  /** 'i+1 zone — 최적 도전' 등 학습 위치 설명 */
  reasoning: string | null;
  composite: number;
  rank: number;
}

export interface LeveledChapterResult {
  words: LeveledChapterWord[];
  /** 추출 기준 메타 (UI 표시용) */
  meta: {
    textVLevel: number | null;
    userVLevel: number | null;
    effectiveUserV: number | null;
    targetVLevel: number | null;
    levelSource: string | null;
    gap: number | null;
    autoN: number | null;
  } | null;
}

/**
 * 라이브러리 도서 chapter 의 lemma 를 사용자 레벨 기준 Krashen i+1 로 추출.
 * extract_vocabulary_for_user(p_user_id, chapter lemmas, strategy) 호출 — 목표 V-Level+1
 * 가우시안 근접도(σ=1.5)로 sweet-spot 단어 상위 N(auto_n) 반환. 미진단 시 글 P75 fallback.
 *
 * 기존 getChapterWords(LV 평면 정렬) 와 별개 — 이쪽은 "내 레벨 맞춤".
 */
export async function getChapterWordsForUser(
  client: SupabaseClient,
  libraryBookId: string,
  chapterIdx: number,
  userId: string,
  strategy: 'auto' | 'user' | 'text' = 'auto',
): Promise<LeveledChapterResult> {
  // 1. chapter lemma 수집 (바인딩된 것만)
  const { data: lbvData, error: lbvError } = await client
    .from('library_book_vocabularies')
    .select('word, lemma')
    .eq('library_book_id', libraryBookId)
    .eq('chapter_idx', chapterIdx)
    .not('lemma', 'is', null)
    .limit(5000);

  if (lbvError) {
    console.error('[getChapterWordsForUser] lbv fetch failed:', lbvError.message);
    return { words: [], meta: null };
  }

  const lemmas = Array.from(
    new Set(
      ((lbvData ?? []) as Array<{ word: string; lemma: string | null }>).map(
        (r) => (r.lemma ?? r.word).toLowerCase(),
      ),
    ),
  );
  if (lemmas.length === 0) return { words: [], meta: null };

  // 2. i+1 추출 RPC
  const { data, error } = await client.rpc('extract_vocabulary_for_user', {
    p_user_id: userId,
    p_words: lemmas,
    p_level_strategy: strategy,
  });
  if (error) {
    console.error('[getChapterWordsForUser] extract RPC failed:', error.message);
    return { words: [], meta: null };
  }

  const rows = (data ?? []) as Array<{
    text_v_level: number | null;
    user_v_level: number | null;
    effective_user_v: number | null;
    level_source: string | null;
    gap: number | null;
    auto_n: number | null;
    word: string;
    meaning_ko: string | null;
    v_level: number | null;
    cefr_level: string | null;
    pos: string | null;
    composite_score: number;
    score_breakdown: { target_v_level?: number; v_proximity?: number; reasoning?: string } | null;
    rank: number;
  }>;
  if (rows.length === 0) return { words: [], meta: null };

  const first = rows[0]!;
  return {
    words: rows.map((r) => ({
      word: r.word,
      meaning: r.meaning_ko,
      pos: r.pos,
      cefrLevel: r.cefr_level,
      vLevel: r.v_level,
      vProximity: r.score_breakdown?.v_proximity ?? null,
      reasoning: r.score_breakdown?.reasoning ?? null,
      composite: r.composite_score,
      rank: r.rank,
    })),
    meta: {
      textVLevel: first.text_v_level,
      userVLevel: first.user_v_level,
      effectiveUserV: first.effective_user_v,
      targetVLevel: first.score_breakdown?.target_v_level ?? null,
      levelSource: first.level_source,
      gap: first.gap,
      autoN: first.auto_n,
    },
  };
}

export interface ChapterWord {
  word: string;
  meaning: string | null;
  pos: string | null;
  cefrLevel: string | null;
  /** VRL v3 V-Level 0~11 (한국 학습자 로드맵). null = 미분류. */
  vLevel: number | null;
  exampleSentence: string | null;
  baseLearningValue: number;
  frequencyInChapter: number;
}

export async function getChapterWords(
  client: SupabaseClient,
  libraryBookId: string,
  chapterIdx: number,
  limit = 30,
): Promise<ChapterWord[]> {
  const { data: lbvData, error: lbvError } = await client
    .from('library_book_vocabularies')
    .select('word, first_sentence, base_learning_value, frequency_in_chapter')
    .eq('library_book_id', libraryBookId)
    .eq('chapter_idx', chapterIdx)
    // 노이즈 가드 — 고유명사·contraction·미지 토큰(lemma 매칭 실패) 제외
    // (CLAUDE.md v06.29 §"라이브러리 도서 난이도 지수" 안티패턴 정합)
    .not('lemma', 'is', null)
    .order('base_learning_value', { ascending: false })
    .limit(limit);

  if (lbvError) {
    console.error('[getChapterWords] lbv fetch failed:', lbvError.message);
    return [];
  }

  const lbvRows = (lbvData ?? []) as Array<{
    word: string;
    first_sentence: string | null;
    base_learning_value: number;
    frequency_in_chapter: number;
  }>;

  if (lbvRows.length === 0) return [];

  const words = lbvRows.map((r) => r.word);
  const { data: dictData } = await client
    .from('shared_dictionary')
    .select('word, meaning_ko, pos, cefr_level, v_level')
    .in('word', words);

  const dictMap = new Map<
    string,
    {
      meaning: string | null;
      pos: string | null;
      cefr_level: string | null;
      v_level: number | null;
    }
  >();
  for (const d of (dictData ?? []) as Array<{
    word: string;
    meaning_ko: string | null;
    pos: string | null;
    cefr_level: string | null;
    v_level: number | null;
  }>) {
    dictMap.set(d.word, {
      meaning: d.meaning_ko,
      pos: d.pos,
      cefr_level: d.cefr_level,
      v_level: d.v_level,
    });
  }

  return lbvRows.map((r) => {
    const dict = dictMap.get(r.word);
    return {
      word: r.word,
      meaning: dict?.meaning ?? null,
      pos: dict?.pos ?? null,
      cefrLevel: dict?.cefr_level ?? null,
      vLevel: dict?.v_level ?? null,
      exampleSentence: r.first_sentence,
      baseLearningValue: r.base_learning_value,
      frequencyInChapter: r.frequency_in_chapter,
    };
  });
}
