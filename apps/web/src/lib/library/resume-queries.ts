// apps/web/src/lib/library/resume-queries.ts
// IA G0 — BookVault 학습 재개 로직
//
// 우선순위:
// 1. in_progress chapter (가장 낮은 chapter_idx)
// 2. not_started 중 가장 낮은 chapter_idx
// 3. 모두 completed → 가장 낮은 chapter_idx (다시 읽기)
// 4. 책 자체 미enroll → null (호출자가 미리보기로 redirect)

import type { SupabaseClient } from '@supabase/supabase-js';

export interface ResumeTarget {
  textId: string;
  chapterIdx: number;
  chapterTitle: string | null;
  status: 'in_progress' | 'not_started' | 'completed';
}

interface TextRow {
  id: string;
  chapter_idx: number;
  chapter_title: string | null;
  status: string;
}

/**
 * 사용자가 특정 도서를 학습 재개할 다음 chapter의 texts.id 결정.
 * @returns ResumeTarget (다음 학습 대상) | null (책 미enroll)
 */
export async function getResumeTarget(
  client: SupabaseClient,
  userId: string,
  libraryBookId: string,
): Promise<ResumeTarget | null> {
  const { data, error } = await client
    .from('texts')
    .select('id, chapter_idx, chapter_title, status')
    .eq('user_id', userId)
    .eq('library_book_id', libraryBookId)
    .order('chapter_idx', { ascending: true });

  if (error) {
    console.error('[getResumeTarget] failed:', error.message);
    return null;
  }

  const rows = (data ?? []) as TextRow[];

  if (rows.length === 0) return null;

  const inProgress = rows.find((r) => r.status === 'in_progress');
  if (inProgress) {
    return {
      textId: inProgress.id,
      chapterIdx: inProgress.chapter_idx,
      chapterTitle: inProgress.chapter_title,
      status: 'in_progress',
    };
  }

  const notStarted = rows.find((r) => r.status === 'not_started');
  if (notStarted) {
    return {
      textId: notStarted.id,
      chapterIdx: notStarted.chapter_idx,
      chapterTitle: notStarted.chapter_title,
      status: 'not_started',
    };
  }

  const first = rows[0]!;
  return {
    textId: first.id,
    chapterIdx: first.chapter_idx,
    chapterTitle: first.chapter_title,
    status: 'completed',
  };
}

/**
 * 책 enroll 상태 검사 (texts에 library_book_id 존재 여부).
 * 미리보기 라우트가 enroll한 사용자를 학습 재개로 redirect하기 위함.
 */
export async function isBookEnrolled(
  client: SupabaseClient,
  userId: string,
  libraryBookId: string,
): Promise<boolean> {
  const { count, error } = await client
    .from('texts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('library_book_id', libraryBookId);

  if (error) return false;
  return (count ?? 0) > 0;
}
