// apps/web/src/app/api/admin/csat/authored-ai-review/route.ts
import { createAuthoredAiPost } from '@/lib/admin/authored-ai-review'
import { requireAdminApi } from '@/lib/auth/require-admin-api'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const POST = createAuthoredAiPost({ guard: () => requireAdminApi(), session: createClient })
