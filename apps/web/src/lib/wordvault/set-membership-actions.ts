// apps/web/src/lib/wordvault/set-membership-actions.ts
// 칩으로 기사 단어장을 바꿀 때(URL 그대로) 그 세트의 정본 낱말을 본인 세션으로 다시 읽는다.
'use server'

import type { SupabaseClient } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/server'

import { loadArticleSetMembership, type SetMembershipPayload } from './set-membership-query'

export async function fetchArticleSetMembership(filter: string): Promise<SetMembershipPayload | null> {
  const client = (await createClient()) as unknown as SupabaseClient
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) return null
  return loadArticleSetMembership(client, filter)
}
