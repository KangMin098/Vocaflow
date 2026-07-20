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

// ─────────────────────────────────────────────
// 비학습 롱테일 "독해 참고 단어" — 라이브러리 도서 chapter
// select_book_chapter_coverage → coverage_lexicon(학습 core 밖) 매칭.
// 고유명사(Darcy·Collins)는 first_sentence 소문자 출현 필터로 RPC에서 제외됨.
// ─────────────────────────────────────────────

export interface CoverageWord {
  word: string;
  /** 한국어 뜻 (빈도순 번역 완주분). 미번역 극희귀는 null → glossEn 표시 */
  meaningKo: string | null;
  /** 영어 gloss 폴백 (한국어 미확보 시) */
  glossEn: string | null;
  pos: string | null;
  frequencyInChapter: number;
}

/**
 * 라이브러리 도서 chapter 의 비학습 롱테일(coverage) 단어를 반환 — "독해 참고용".
 * select_book_chapter_coverage(book) 를 호출해 해당 chapter 만 필터. 결과가 작아(도서당 수십)
 * 전체 호출+클라 필터로 충분. 학습 단어장(i+1)과 분리 — 암기 대상 아님, 읽기 이해 보조.
 */
export async function getChapterCoverageWords(
  client: SupabaseClient,
  libraryBookId: string,
  chapterIdx: number,
): Promise<CoverageWord[]> {
  const { data, error } = await client.rpc('select_book_chapter_coverage', {
    p_book_id: libraryBookId,
    p_chapter_idx: chapterIdx, // 서버가 해당 챕터만 처리(성능) — 전권 스캔 회피
  });
  if (error) {
    console.error('[getChapterCoverageWords] RPC failed:', error.message);
    return [];
  }
  const rows = (data ?? []) as Array<{
    chapter_idx: number;
    word: string;
    meaning_ko: string | null;
    gloss_en: string | null;
    pos: string | null;
    frequency_in_chapter: number;
  }>;
  return rows.map((r) => ({
    word: r.word,
    meaningKo: r.meaning_ko,
    glossEn: r.gloss_en,
    pos: r.pos,
    frequencyInChapter: r.frequency_in_chapter,
  }));
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

/**
 * 라이브러리 도서 chapter 의 학습 단어를 base_learning_value 순으로 반환.
 *
 * 큐레이션 경로 정합 (★fix) — `extract_book_vocabulary_admin` / `publish_book_word_sets`
 * 와 동일하게 **`v_level >= book_v_level` 절대 바닥선**을 적용한다. 이전엔 바닥선 없이
 * blv 상위 N 만 잘라, 도서 centroid 이하 단어가 자리를 차지하고 고가치어(예: V9
 * "conspirator")가 동점 무더기 + N컷에 밀려 리더 인라인에서 누락됐다 — 발행 단어장과
 * 어긋나던 유일한 seam. book_v_level 미산정(null) 도서는 floor 생략 → 기존 동작 보존.
 *
 * dict 조인도 lemma 기준으로 교정 (큐레이션 함수들과 동일 — d.word = lbv.lemma).
 * 본문 매칭·표시 표면형은 lbv.word 유지, 뜻·품사·v_level 은 lemma 사전 entry 에서.
 */
export async function getChapterWords(
  client: SupabaseClient,
  libraryBookId: string,
  chapterIdx: number,
  limit = 30,
): Promise<ChapterWord[]> {
  // 0. 도서 centroid — 학습 단어 바닥선 (null 이면 floor 생략)
  const { data: bookRow } = await client
    .from('library_books')
    .select('book_v_level')
    .eq('id', libraryBookId)
    .maybeSingle();
  const floor = (bookRow as { book_v_level: number | null } | null)?.book_v_level ?? null;

  // 1. chapter 내 바인딩 단어 전체를 blv 순으로 (floor 를 dict 조인 후 적용하므로
  //    DB 측 limit 대신 넉넉히 fetch — 챕터당 수백 row, 단일 인덱스 스캔).
  const { data: lbvData, error: lbvError } = await client
    .from('library_book_vocabularies')
    .select('word, lemma, first_sentence, base_learning_value, frequency_in_chapter')
    .eq('library_book_id', libraryBookId)
    .eq('chapter_idx', chapterIdx)
    // 노이즈 가드 — 고유명사·contraction·미지 토큰(lemma 매칭 실패) 제외
    // (CLAUDE.md v06.29 §"라이브러리 도서 난이도 지수" 안티패턴 정합)
    .not('lemma', 'is', null)
    .order('base_learning_value', { ascending: false })
    .limit(500);

  if (lbvError) {
    console.error('[getChapterWords] lbv fetch failed:', lbvError.message);
    return [];
  }

  const lbvRows = (lbvData ?? []) as Array<{
    word: string;
    lemma: string;
    first_sentence: string | null;
    base_learning_value: number;
    frequency_in_chapter: number;
  }>;

  if (lbvRows.length === 0) return [];

  // 2. dict 조인 — lemma 기준 (surface 가 아닌 lemma 의 뜻·v_level)
  const lemmas = Array.from(new Set(lbvRows.map((r) => r.lemma.toLowerCase())));
  const { data: dictData } = await client
    .from('shared_dictionary')
    .select('word, meaning_ko, pos, cefr_level, v_level')
    .in('word', lemmas);

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
    dictMap.set(d.word.toLowerCase(), {
      meaning: d.meaning_ko,
      pos: d.pos,
      cefr_level: d.cefr_level,
      v_level: d.v_level,
    });
  }

  // 3. floor 적용 + blv 순 상위 limit (lbvRows 는 이미 blv desc).
  const out: ChapterWord[] = [];
  for (const r of lbvRows) {
    const dict = dictMap.get(r.lemma.toLowerCase());
    // book_v_level 이 있으면 v_level 미상/이하 단어 제외 (큐레이션 정합).
    if (floor != null && (dict?.v_level == null || dict.v_level < floor)) continue;
    out.push({
      word: r.word,
      meaning: dict?.meaning ?? null,
      pos: dict?.pos ?? null,
      cefrLevel: dict?.cefr_level ?? null,
      vLevel: dict?.v_level ?? null,
      exampleSentence: r.first_sentence,
      baseLearningValue: r.base_learning_value,
      frequencyInChapter: r.frequency_in_chapter,
    });
    if (out.length >= limit) break;
  }
  return out;
}
