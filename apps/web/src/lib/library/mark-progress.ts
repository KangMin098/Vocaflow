// apps/web/src/lib/library/mark-progress.ts
// IA G2 — Workspace 진입 시 texts.status 자동 변경 (server action)
//
// 정책 (멱등):
//   not_started → in_progress (자동)
//   in_progress, completed, extracted, conquered → 변경 없음

'use server';

import { createClient } from '@/lib/supabase/server';

export async function markChapterStarted(textId: string): Promise<void> {
  const client = await createClient();

  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) return;

  // 멱등 — not_started만 in_progress로 (status 조건 WHERE)
  const { error } = await client
    .from('texts')
    .update({ status: 'in_progress', updated_at: new Date().toISOString() })
    .eq('id', textId)
    .eq('user_id', user.id)
    .eq('status', 'not_started');

  if (error) {
    console.error('[markChapterStarted] failed:', error.message);
  }
}
