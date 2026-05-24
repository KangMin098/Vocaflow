// apps/web/src/lib/library/activate-chapter.ts
// Phase 2A — workspace 진입 시 학습 활성화 트리거 (VRL v3 wiring)
//
// 호출 위치: app/(main)/text/[id]/layout.tsx — markChapterStarted 직후
// 멱등성:
//   - personalizeChapter: reading_sessions 존재 시 return early
//   - adaptiveExtractWords: vocabularies UNIQUE(user_id, word) + onConflict ignoreDuplicates
//
// VRL v3 정합:
//   - user_profiles.current_v_level → AdaptiveExtractContext.userVLevel
//   - learning-value.ts vLevelWeightFor() 가 i+1 zone 단어 부각

import type { SupabaseClient } from '@supabase/supabase-js'
import { adaptiveExtractWords } from './adaptive-extract'
import { personalizeChapter, type UserCefr, type UserMastery } from './personalize'

const VALID_CEFR: readonly UserCefr[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const VALID_MASTERY: readonly UserMastery[] = ['cold', 'warm', 'hot']

export interface ActivateChapterInput {
  textId: string
  libraryBookId: string
  chapterIdx: number
  chapterWordCount: number
  userId: string
}

interface UserLearningProfile {
  mastery: UserMastery
  cefr: UserCefr
  /** VRL v3 V-Level 0~11 (null = system_default 미해결 → 가중치 X) */
  vLevel: number | null
}

/**
 * user_profiles + user_stats 에서 학습 컨텍스트 도출.
 * row 부재 시 보수적 기본값 (cold / A2 / vLevel null).
 */
async function fetchLearningProfile(
  client: SupabaseClient,
  userId: string,
): Promise<UserLearningProfile> {
  const [profileRes, statsRes] = await Promise.all([
    client
      .from('user_profiles')
      .select('cefr_level, current_v_level')
      .eq('user_id', userId)
      .maybeSingle(),
    client
      .from('user_stats')
      .select('mastery_level')
      .eq('user_id', userId)
      .maybeSingle(),
  ])

  const rawCefr = (profileRes.data?.['cefr_level'] as string | null) ?? null
  const cefr =
    rawCefr && (VALID_CEFR as readonly string[]).includes(rawCefr)
      ? (rawCefr as UserCefr)
      : 'A2'

  const rawMastery = (statsRes.data?.['mastery_level'] as string | null) ?? null
  const mastery =
    rawMastery && (VALID_MASTERY as readonly string[]).includes(rawMastery)
      ? (rawMastery as UserMastery)
      : 'cold'

  // VRL v3 — current_v_level 가드 (옵션 B 정합):
  //   진단 미실행 user 는 default 0. v_level=0 그대로 주입 시
  //   L1 단어가 "i+1 sweet spot" 으로 부각되어 유아 단어가 surface.
  //   → 0 은 "system_default 미해결" 으로 간주, null 로 변환 → CEFR fallback.
  //   진단/자가선언 후 1~11 만 vLevelWeightFor 가중치 활성화.
  const rawVLevel = profileRes.data?.['current_v_level'] as number | null | undefined
  const vLevel =
    typeof rawVLevel === 'number' && rawVLevel >= 1 && rawVLevel <= 11
      ? rawVLevel
      : null

  return { mastery, cefr, vLevel }
}

/**
 * chapter workspace 진입 시 1회 (멱등) 호출:
 *   1) personalizeChapter — reading_sessions 동적 분할
 *   2) adaptiveExtractWords — vocabularies 적응 추출 (VRL v3 i+1 가중)
 *
 * 실패 시 throw 하지 않음 — 워크스페이스 로딩 중단 회피 (warn 로그만).
 */
export async function activateChapterLearning(
  client: SupabaseClient,
  input: ActivateChapterInput,
): Promise<void> {
  let profile: UserLearningProfile
  try {
    profile = await fetchLearningProfile(client, input.userId)
  } catch (err) {
    console.warn(
      '[activate-chapter] fetchLearningProfile failed (non-fatal):',
      (err as Error).message,
    )
    return
  }

  // 1. 동적 reading_sessions
  try {
    await personalizeChapter(client, input.textId, {
      userMastery: profile.mastery,
      userCefr: profile.cefr,
    })
  } catch (err) {
    console.warn(
      '[activate-chapter] personalizeChapter failed (non-fatal):',
      (err as Error).message,
    )
  }

  // 2. 적응 단어 추출 (VRL v3 wiring — userVLevel 주입)
  try {
    await adaptiveExtractWords(client, input.textId, {
      userId: input.userId,
      userMastery: profile.mastery,
      userCefr: profile.cefr,
      userVLevel: profile.vLevel,
      libraryBookId: input.libraryBookId,
      chapterIdx: input.chapterIdx,
      chapterWordCount: input.chapterWordCount,
    })
  } catch (err) {
    console.warn(
      '[activate-chapter] adaptiveExtractWords failed (non-fatal):',
      (err as Error).message,
    )
  }
}
