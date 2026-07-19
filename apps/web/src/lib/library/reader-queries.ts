// apps/web/src/lib/library/reader-queries.ts
// LCP v2.0 Phase 12.5 — Reader 컴포넌트가 사용할 chapter content lazy fetch
//
// 사용 패턴:
//   const chapterList = await listChapters(client, bookId);
//   const content = await getChapterContent(client, bookId, chapterIdx);

import type { SupabaseClient } from '@supabase/supabase-js'

export interface ChapterListItem {
  chapter_idx: number
  chapter_title: string | null
  /** 계층 그룹 라벨 (Volume/Book·sub-book) — null 이면 평면. 사이드바 collapsible 그룹용 */
  group_label: string | null
  word_count: number
  paragraph_count: number
  /** 원본 소스 해당 챕터 deep-link URL (SE TOC 매핑). null 이면 렌더가 도서 TOC 로 fallback */
  source_href: string | null
  /** 챕터별 어휘 V-level (distinct lemma p75, V11 제외). 단일 book_v_level 의 챕터 편차 노출용. null=미산출 */
  chapter_v_level: number | null
}

export interface ChapterContent {
  chapter_idx: number
  chapter_title: string | null
  content: string
  word_count: number
  paragraph_offsets: number[]
  sentence_offsets: number[]
}

export interface SampleWord {
  word: string
  base_learning_value: number
  first_sentence: string | null
  cefr_level: string | null
}

/** 본문 단어 클릭 조회 결과 — lookup_word_meaning RPC 1행. */
export interface WordLookup {
  found: boolean
  surface: string
  resolvedWord: string | null
  meaningKo: string | null
  pos: string | null
  cefrLevel: string | null
  vLevel: number | null
  exampleEn: string | null
  /** 'direct' | 'inflection' | 'variant' | 'cluster' | 'derivation' | 'coverage' | 'coverage_en' | 'not_found' | 'invalid' */
  matchVia: string
  /** 'standard' | 'modern_advanced' | 'period_cultural' | 'archaic_literary' | 'phrase_unit' (V11 분류) */
  wordRegister: string | null
  /** 영어 gloss — 커버리지 사전(비학습 롱테일) 폴백. 한국어 뜻 없을 때 표시용. 없으면 null */
  glossEn: string | null
  /** 자주 함께 쓰는 표현 — 툴팁 절제 노출(Progressive Disclosure). 없으면 null */
  collocations: string[] | null
}

/**
 * 표면 단어 → dict+lemma 체인 해소 (direct → 굴절 → 변이 → 클러스터).
 * 고어(hadst→have)·굴절(houses→house)·변이(subtile)까지 우리 사전으로 해소.
 * 미해소(불어·OCR)는 found=false. 외부 사전 의존 없음.
 */
export async function lookupWord(
  client: SupabaseClient,
  surface: string
): Promise<WordLookup | null> {
  const { data, error } = await client.rpc('lookup_word_meaning', { p_surface: surface })
  if (error) throw new Error(`lookupWord failed: ${error.message}`)
  const row = (data ?? [])[0] as
    | {
        found: boolean
        surface: string
        resolved_word: string | null
        meaning_ko: string | null
        pos: string | null
        cefr_level: string | null
        v_level: number | null
        example_en: string | null
        match_via: string
        word_register: string | null
        gloss_en: string | null
      }
    | undefined
  if (!row) return null

  // 연어 보강 — lookup_word_meaning RPC 미반환이라 해소된 word 로 shared_dictionary 1행 조회.
  // 툴팁은 단어 1개 on-demand 라 추가 round-trip 허용. 실패해도 조회 결과는 그대로.
  // 커버리지 폴백(coverage/coverage_en)은 shared_dictionary 밖이라 연어 조회 생략(불필요 round-trip 회피).
  let collocations: string[] | null = null
  if (row.found && row.resolved_word && !row.match_via.startsWith('coverage')) {
    const { data: cd, error: cErr } = await client
      .from('shared_dictionary')
      .select('collocations')
      .eq('word', row.resolved_word)
      .maybeSingle()
    if (cErr) {
      console.warn('[reader/lookupWord] collocations fetch failed:', cErr.message)
    } else {
      const c = (cd as { collocations: string[] | null } | null)?.collocations
      collocations = c && c.length > 0 ? c : null
    }
  }

  return {
    found: row.found,
    surface: row.surface,
    resolvedWord: row.resolved_word,
    meaningKo: row.meaning_ko,
    pos: row.pos,
    cefrLevel: row.cefr_level,
    vLevel: row.v_level,
    exampleEn: row.example_en,
    matchVia: row.match_via,
    wordRegister: row.word_register,
    glossEn: row.gloss_en,
    collocations,
  }
}

/**
 * 책의 모든 chapter list (메타만 — content 제외).
 * Reader 사이드바용.
 */
export async function listChapters(
  client: SupabaseClient,
  libraryBookId: string
): Promise<ChapterListItem[]> {
  const { data, error } = await client
    .from('library_chapters_master')
    .select(
      'chapter_idx, chapter_title, group_label, source_href, word_count, paragraph_offsets, chapter_v_level'
    )
    .eq('library_book_id', libraryBookId)
    .order('chapter_idx', { ascending: true })

  if (error) throw new Error(`listChapters failed: ${error.message}`)
  return (data ?? []).map((row) => {
    const r = row as {
      chapter_idx: number
      chapter_title: string | null
      group_label: string | null
      source_href: string | null
      word_count: number
      paragraph_offsets: number[] | null
      chapter_v_level: number | null
    }
    return {
      chapter_idx: r.chapter_idx,
      chapter_title: r.chapter_title,
      group_label: r.group_label ?? null,
      word_count: r.word_count,
      paragraph_count: r.paragraph_offsets?.length ?? 0,
      source_href: r.source_href ?? null,
      chapter_v_level: r.chapter_v_level ?? null,
    }
  })
}

/**
 * 단일 chapter의 본문 + offset.
 * Reader pane이 chapter 클릭 시 호출.
 */
export async function getChapterContent(
  client: SupabaseClient,
  libraryBookId: string,
  chapterIdx: number
): Promise<ChapterContent | null> {
  // chapter master + content chunk JOIN
  const { data: master, error: masterError } = await client
    .from('library_chapters_master')
    .select(
      'chapter_idx, chapter_title, word_count, paragraph_offsets, sentence_offsets, content_hash'
    )
    .eq('library_book_id', libraryBookId)
    .eq('chapter_idx', chapterIdx)
    .maybeSingle()

  if (masterError) throw new Error(`getChapterContent master failed: ${masterError.message}`)
  if (!master) return null

  const m = master as {
    chapter_idx: number
    chapter_title: string | null
    word_count: number
    paragraph_offsets: number[]
    sentence_offsets: number[]
    content_hash: string
  }

  const { data: chunk, error: chunkError } = await client
    .from('content_chunks')
    .select('content')
    .eq('hash', m.content_hash)
    .maybeSingle()

  if (chunkError) throw new Error(`getChapterContent chunk failed: ${chunkError.message}`)
  if (!chunk) return null

  return {
    chapter_idx: m.chapter_idx,
    chapter_title: m.chapter_title,
    content: (chunk as { content: string }).content,
    word_count: m.word_count,
    paragraph_offsets: m.paragraph_offsets,
    sentence_offsets: m.sentence_offsets,
  }
}

/**
 * chapter의 LV 상위 N개 sample words.
 * admin-review 모드의 하이라이트 토글용.
 */
export async function getSampleWords(
  client: SupabaseClient,
  libraryBookId: string,
  chapterIdx: number,
  limit = 10
): Promise<SampleWord[]> {
  const { data, error } = await client
    .from('library_book_vocabularies')
    .select('word, base_learning_value, first_sentence')
    .eq('library_book_id', libraryBookId)
    .eq('chapter_idx', chapterIdx)
    // 노이즈 가드 — 고유명사·contraction·미지 토큰 제외
    // (CLAUDE.md v06.29 §"라이브러리 도서 난이도 지수" 안티패턴 정합)
    .not('lemma', 'is', null)
    .order('base_learning_value', { ascending: false })
    .limit(limit)

  if (error) throw new Error(`getSampleWords failed: ${error.message}`)

  // shared_dictionary lookup (CEFR level)
  const words = (data ?? []).map((r) => (r as { word: string }).word)
  if (words.length === 0) return []

  const { data: dict } = await client
    .from('shared_dictionary')
    .select('word, cefr_level')
    .in('word', words)

  const cefrMap = new Map<string, string | null>(
    (dict ?? []).map((d) => [
      (d as { word: string }).word,
      (d as { cefr_level: string | null }).cefr_level,
    ])
  )

  return (data ?? []).map((r) => {
    const row = r as {
      word: string
      base_learning_value: number
      first_sentence: string | null
    }
    return {
      word: row.word,
      base_learning_value: row.base_learning_value,
      first_sentence: row.first_sentence,
      cefr_level: cefrMap.get(row.word) ?? null,
    }
  })
}
