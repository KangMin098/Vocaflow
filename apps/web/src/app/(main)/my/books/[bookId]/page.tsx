// apps/web/src/app/(main)/my/books/[bookId]/page.tsx
// IA G0 — BookVault 학습 재개 라우트 (server-side redirect)
//
// 흐름:
// 1. 인증 확인 (미인증 → 미리보기 fallback)
// 2. 진도 분석 (resume-queries)
// 3. enroll 상태 → /text/[nextTextId]?mode=read
// 4. 미enroll 상태 → /library/books/[bookId] (미리보기 fallback)

import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { getResumeTarget } from '@/lib/library/resume-queries';

interface PageProps {
  params: { bookId: string };
}

export default async function MyBookResumePage({ params }: PageProps) {
  const client = (await createClient()) as unknown as SupabaseClient;

  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    redirect(`/library/books/${params.bookId}`);
  }

  const target = await getResumeTarget(client, user.id, params.bookId);

  if (!target) {
    redirect(`/library/books/${params.bookId}`);
  }

  redirect(`/text/${target.textId}?mode=read`);
}
