// apps/web/src/lib/library/adaptive-extract.ts
// LCP v2.0 Phase 9 — chapter 진입 시 사용자 적응 단어 추출
//
// 호출 시점: chapter workspace 진입 시 1회
// 멱등성: vocabularies UNIQUE (user_id, word) — 중복 자동 무시
//
// 정책:
//   - baseN = min(25, max(8, floor(chapter_word_count / 200)))
//   - mastery 가중: cold 0.4, warm 0.7, hot 1.0
//   - fatigue 가중: 사용자 vocab 500개 초과 시 0.6
//   - shared_dictionary miss 단어는 skip + 다음 LV 단어 보충

import type { SupabaseClient } from '@supabase/supabase-js'
import { vLevelWeightFor } from '@vocaflow/library-pipeline'
import type { UserCefr, UserMastery } from './personalize'

const VALID_CEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const

const NEXT_CEFR: Record<UserCefr, UserCefr> = {
  A1: 'A2',
  A2: 'B1',
  B1: 'B2',
  B2: 'C1',
  C1: 'C2',
  C2: 'C2',
}

const MASTERY_FACTOR: Record<UserMastery, number> = {
  cold: 0.4,
  warm: 0.7,
  hot: 1.0,
}

export interface AdaptiveExtractContext {
  userId: string
  userMastery: UserMastery
  userCefr: UserCefr
  /**
   * VRL v3 V-Level (0~11). 지정 시 shared_dictionary.v_level 거리 기반
   * Krashen i+1 secondary re-ranking 적용. 미지정 시 base_learning_value 만 사용.
   */
  userVLevel?: number | null
  libraryBookId: string
  chapterIdx: number
  chapterWordCount: number
}

export interface AdaptiveExtractResult {
  /** 결정된 추출 N */
  decidedCount: number
  /** 실제 INSERT 시도 row 수 (LV miss skip 후) */
  attemptedCount: number
  /** 실제 INSERT된 row 수 (UNIQUE 충돌 후) */
  insertedCount: number
}

/**
 * chapter 진입 시 호출 — vocabularies에 적정 N개 INSERT.
 * shared_dictionary miss 단어는 skip하고 다음 LV 단어로 보충.
 */
export async function adaptiveExtractWords(
  client: SupabaseClient,
  textId: string,
  ctx: AdaptiveExtractContext,
): Promise<AdaptiveExtractResult> {
  // 1. 사용자 현재 vocab 수 (fatigue 계산용)
  const { count: userVocabCount, error: countError } = await client
    .from('vocabularies')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', ctx.userId)

  if (countError) {
    throw new Error(`vocab count failed: ${countError.message}`)
  }

  // 2. 추출 N 결정 (RULE 4: 최소 8 보장)
  const N = decideWordCount(
    ctx.userMastery,
    ctx.chapterWordCount,
    userVocabCount ?? 0,
  )

  if (N === 0) {
    return { decidedCount: 0, attemptedCount: 0, insertedCount: 0 }
  }

  // 3. library_book_vocabularies 에서 LV 상위 후보 가져오기.
  //    userVLevel 지정 시 i+1 zone 단어가 base LV 상위권에 적게 분포할 수 있으므로
  //    fetch buffer 를 N×5 로 확장 (미지정 시 N×3 유지).
  const fetchMultiplier = ctx.userVLevel != null ? 5 : 3
  const { data: candidates, error: candError } = await client
    .from('library_book_vocabularies')
    .select('word, first_sentence, frequency_in_chapter, base_learning_value')
    .eq('library_book_id', ctx.libraryBookId)
    .eq('chapter_idx', ctx.chapterIdx)
    // 노이즈 가드 — 고유명사·contraction·미지 토큰 제외 (Krashen i+1 후보 밀도 보존)
    // (CLAUDE.md v06.29 §"라이브러리 도서 난이도 지수" 안티패턴 정합)
    .not('lemma', 'is', null)
    .order('base_learning_value', { ascending: false })
    .limit(N * fetchMultiplier)

  if (candError) {
    throw new Error(
      `library_book_vocabularies fetch failed: ${candError.message}`,
    )
  }
  if (!candidates || candidates.length === 0) {
    return { decidedCount: N, attemptedCount: 0, insertedCount: 0 }
  }

  // 4. shared_dictionary 일괄 lookup — VRL v3 v_level 포함 (Krashen weight 용)
  //    (RULE 3: pronunciation 컬럼 부재 — SELECT 절에서 제거)
  const candidateWords = candidates.map((c) => c.word as string)
  const { data: dict, error: dictError } = await client
    .from('shared_dictionary')
    .select('word, meaning_ko, example_en, pos, cefr_level, v_level')
    .in('word', candidateWords)

  if (dictError) {
    throw new Error(`shared_dictionary lookup failed: ${dictError.message}`)
  }

  const dictMap = new Map((dict ?? []).map((d) => [d.word as string, d]))

  // 4-B. userVLevel 지정 시 secondary re-ranking — Krashen i+1 weight 적용
  //      base_learning_value 는 user-agnostic precomputed cache (pipeline 단계).
  //      여기서 사용자 v_level 거리 가중치를 곱해 i+1 zone 단어를 상위로 부각.
  const rankedCandidates =
    ctx.userVLevel == null
      ? candidates
      : [...candidates].sort((a, b) => {
          const aVL = (dictMap.get(a.word as string) as { v_level?: number | null } | undefined)?.v_level ?? null
          const bVL = (dictMap.get(b.word as string) as { v_level?: number | null } | undefined)?.v_level ?? null
          const aScore = (a.base_learning_value as number) * vLevelWeightFor(aVL, ctx.userVLevel)
          const bScore = (b.base_learning_value as number) * vLevelWeightFor(bVL, ctx.userVLevel)
          return bScore - aScore
        })

  // 5. 사용자가 이미 학습 중인 단어 (UNIQUE 충돌 회피용 사전 필터)
  const { data: existing, error: existError } = await client
    .from('vocabularies')
    .select('word')
    .eq('user_id', ctx.userId)
    .in('word', candidateWords)

  if (existError) {
    throw new Error(`vocabularies existing check failed: ${existError.message}`)
  }

  const existingWords = new Set((existing ?? []).map((e) => e.word as string))

  // 6. INSERT 대상 선정 — RULE 6: shared_dictionary miss skip + 다음 LV 단어 보충
  const rows: Array<{
    user_id: string
    text_id: string
    word: string
    meaning: string
    example_sentence: string | null
    pos: string | null
    cefr_level: string | null
    pronunciation: null
    difficulty: number
    stability: number
    review_count: number
    origin: 'library'
  }> = []

  for (const c of rankedCandidates) {
    if (rows.length >= N) break

    const word = c.word as string
    if (existingWords.has(word)) continue //                                     이미 학습 중

    const d = dictMap.get(word)
    if (!d) continue //                                                          shared_dictionary miss → skip + 다음 후보

    const meaning = (d['meaning_ko'] as string | null) ?? ''
    if (meaning.length === 0) continue //                                        의미 없는 단어 skip

    // RULE 5: cefr_level 빈 문자열 가드
    const rawCefr = (d['cefr_level'] as string | null) ?? ''
    const cefr =
      rawCefr.length > 0 && (VALID_CEFR as readonly string[]).includes(rawCefr)
        ? rawCefr
        : null

    rows.push({
      user_id: ctx.userId,
      text_id: textId,
      word,
      meaning,
      // 도서 챕터 본문 문장 우선 (context-dependent) → dict 일반 예문 폴백
      example_sentence:
        ((c.first_sentence as string | null) ??
          (d['example_en'] as string | null)) ??
        null,
      pos: (d['pos'] as string | null) ?? null,
      cefr_level: cefr,
      pronunciation: null, //                                                    shared_dictionary 에 컬럼 부재
      difficulty: 6.0,
      stability: 0,
      review_count: 0,
      origin: 'library',
    })
  }

  if (rows.length === 0) {
    return { decidedCount: N, attemptedCount: 0, insertedCount: 0 }
  }

  // 7. INSERT (UNIQUE 충돌은 ignoreDuplicates 로 무시 — 멱등 호출 보장)
  const { error: insertError, count: insertedCount } = await client
    .from('vocabularies')
    .upsert(rows, {
      onConflict: 'user_id,word',
      ignoreDuplicates: true,
      count: 'exact',
    })

  if (insertError) {
    throw new Error(`vocabularies INSERT failed: ${insertError.message}`)
  }

  // 8. text status 업데이트 — 'extracted' (texts_status_check 통과 확인됨)
  //
  // ⚠️ **이미 끝낸 장은 되돌리지 않는다.** 가드 없이 덮으면
  //    완료한 장에서 단어를 한 번 더 추출했을 때 `completed` → `extracted` 로 내려간다.
  //    그러면 학습자 쪽에서 이런 일이 조용히 일어난다:
  //      · `/library/books` 의 완료 수가 줄어든다(그 화면은 status='completed' 로 센다)
  //      · enrollment 상태가 '완료' 에서 '학습 중' 으로 되돌아간다
  //      · `complete-chapter` 의 alreadyCompleted 판정이 풀려 완료 후처리가 다시 돈다
  //      · `progress_percent` 는 100 그대로라 **두 진도 정의가 갈린다**
  //        (complete-chapter 는 status 와 progress_percent 를 함께 쓴다)
  //    추출은 학습을 되돌리는 행위가 아니므로 상태를 낮출 이유가 없다.
  const { error: updateError } = await client
    .from('texts')
    .update({ status: 'extracted' })
    .eq('id', textId)
    .not('status', 'in', '("completed","conquered")')

  if (updateError) {
    // 학습 추출 자체는 성공했으니 status 업데이트 실패는 throw 하지 않고 warn 만
    console.warn(
      `[adaptive-extract] texts.status update failed (non-fatal): ${updateError.message}`,
    )
  }

  return {
    decidedCount: N,
    attemptedCount: rows.length,
    insertedCount: insertedCount ?? 0,
  }
}

function decideWordCount(
  mastery: UserMastery,
  chapterWordCount: number,
  userVocabCount: number,
): number {
  // RULE 4: 최소 8개 보장 + 최대 25개 제한
  const baseN = Math.min(25, Math.max(8, Math.floor(chapterWordCount / 200)))
  const masteryFactor = MASTERY_FACTOR[mastery]
  const fatigueFactor = userVocabCount > 500 ? 0.6 : 1.0
  return Math.max(3, Math.floor(baseN * masteryFactor * fatigueFactor))
}

/**
 * 사용자가 다음에 학습할 권장 CEFR (60% target / 30% user / 10% stretch 분포 계산용).
 * Phase 9 단순화: ctx.userCefr 보다 한 단계 높은 것만 반환.
 * 60/30/10 가중 분포는 후속 phase 에서 정교화.
 */
export function getTargetCefr(userCefr: UserCefr): UserCefr {
  return NEXT_CEFR[userCefr]
}
