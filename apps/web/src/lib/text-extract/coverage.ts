// apps/web/src/lib/text-extract/coverage.ts
// 사용자 입력 스크립트 — 비학습 롱테일 "독해 참고 단어" 데이터층 + 고유명사 필터.
//   추출(core 학습 후보)에서 빠진 미매칭 토큰 중 coverage_lexicon(학습 밖)에 있는 단어를 참고용으로.
//   tokenize 가 소문자화하므로 고유명사(Darcy) 신호가 없음 → 원문의 소문자 출현으로 클라이언트 필터.

import type { SupabaseClient } from '@supabase/supabase-js'

export interface CoverageRefWord {
  word: string
  /** 원문에 실제 나온 표면형 (굴절형이면 word=표제어와 다름) */
  matchedSurface: string
  meaningKo: string | null
  glossEn: string | null
  pos: string | null
}

/**
 * 원문에서 **소문자로**(문장 중간 일반명사) 출현한 단어 집합.
 * 대문자로만 나오는 고유명사(등장인물·지명)를 참고 목록에서 배제하기 위한 신호.
 * `\b[a-z]…` = 단어 경계 + 소문자 시작(문장 첫 단어 대문자·고유명사 대문자는 미포함).
 */
export function lowercaseWordSet(text: string): Set<string> {
  const set = new Set<string>()
  const matches = text.match(/\b[a-z][a-z']*\b/g)
  if (matches) {
    for (const m of matches) {
      const w = m.includes("'") ? m.split("'")[0]! : m
      if (w.length >= 2) set.add(w)
    }
  }
  return set
}

/**
 * 임의 토큰 배열 → 비학습 롱테일(coverage) 참고 단어. `select_coverage_for_words` RPC.
 * 굴절 surface도 서버에서 en_inflection_bases 로 coverage 표제어 해소.
 */
export async function getCoverageForWords(
  client: SupabaseClient,
  words: string[],
): Promise<CoverageRefWord[]> {
  if (words.length === 0) return []
  const { data, error } = await client.rpc('select_coverage_for_words', { p_words: words })
  if (error) {
    console.error('[getCoverageForWords] RPC failed:', error.message)
    return []
  }
  return (
    (data ?? []) as Array<{
      word: string
      matched_surface: string
      meaning_ko: string | null
      gloss_en: string | null
      pos: string | null
    }>
  ).map((r) => ({
    word: r.word,
    matchedSurface: r.matched_surface,
    meaningKo: r.meaning_ko,
    glossEn: r.gloss_en,
    pos: r.pos,
  }))
}
