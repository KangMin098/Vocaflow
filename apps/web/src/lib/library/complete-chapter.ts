// apps/web/src/lib/library/complete-chapter.ts
// Phase 11.10 G3 — chapter 완료 처리 (server action, 멱등)

'use server';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

export interface CompleteChapterResult {
  ok: boolean;
  alreadyCompleted: boolean;
  nextChapterTextId: string | null;
  bookCompleted: boolean;
}

export async function completeChapter(textId: string): Promise<CompleteChapterResult> {
  const client = (await createClient()) as unknown as SupabaseClient;

  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return {
      ok: false,
      alreadyCompleted: false,
      nextChapterTextId: null,
      bookCompleted: false,
    };
  }

  const { data: current } = await client
    .from('texts')
    .select('id, library_book_id, chapter_idx, status')
    .eq('id', textId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!current) {
    return {
      ok: false,
      alreadyCompleted: false,
      nextChapterTextId: null,
      bookCompleted: false,
    };
  }

  const c = current as {
    id: string;
    library_book_id: string | null;
    chapter_idx: number | null;
    status: string;
  };

  const alreadyCompleted = c.status === 'completed';

  if (!alreadyCompleted) {
    const { error } = await client
      .from('texts')
      .update({
        status: 'completed',
        progress_percent: 100,
        updated_at: new Date().toISOString(),
      })
      .eq('id', textId)
      .eq('user_id', user.id);

    if (error) {
      console.error('[completeChapter] update failed:', error.message);
      return {
        ok: false,
        alreadyCompleted: false,
        nextChapterTextId: null,
        bookCompleted: false,
      };
    }
  }

  if (!c.library_book_id) {
    return { ok: true, alreadyCompleted, nextChapterTextId: null, bookCompleted: false };
  }

  const { data: siblings } = await client
    .from('texts')
    .select('id, chapter_idx, status')
    .eq('user_id', user.id)
    .eq('library_book_id', c.library_book_id)
    .order('chapter_idx', { ascending: true });

  const allChapters = (siblings ?? []) as Array<{
    id: string;
    chapter_idx: number;
    status: string;
  }>;

  const nextChapter = allChapters.find(
    (s) => s.id !== textId && (s.status === 'not_started' || s.status === 'in_progress'),
  );

  const allCompleted = allChapters.every(
    (s) => s.id === textId || s.status === 'completed',
  );

  return {
    ok: true,
    alreadyCompleted,
    nextChapterTextId: nextChapter?.id ?? null,
    bookCompleted: allCompleted,
  };
}
