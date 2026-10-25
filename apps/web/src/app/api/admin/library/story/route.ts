// apps/web/src/app/api/admin/library/story/route.ts
import { NextResponse } from 'next/server'
import { failStory, isUuid, listStorySlots, loadStoryBundle, storyServerError, type StoryRpcClient } from '@/lib/library/story/admin'
import type { StoryResult } from '@/lib/library/story/types'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function reply(result: StoryResult<unknown>) {
  const code = result.ok ? '' : result.code.replace(/^story:/, '')
  const status = result.ok ? 200 : code === 'invalid_input' ? 400
    : ['auth_required', 'story_session_required'].includes(code) ? 401
      : ['staff_required', 'admin_required', 'account_inactive', 'account_blocked'].includes(code) ? 403
        : code === 'edition_version_not_found' ? 404 : 503
  return NextResponse.json(result, { status, headers: { 'cache-control': 'no-store' } })
}

/** Read-only transport. Existing Story getUser/active/staff checks and cookie RPC remain authoritative. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const kind = params.get('kind')
  const version = params.get('edition_version_id')
  if ((kind !== 'slots' && kind !== 'bundle') || (kind === 'bundle' && !isUuid(version))) {
    return reply(failStory('invalid_input', 'input'))
  }
  try {
    const client = await createClient() as unknown as StoryRpcClient
    const deps = { client, now: () => new Date() }
    // These functions require a real cookie user and active admin/curator. No development bypass/service key.
    return reply(kind === 'slots' ? await listStorySlots(deps) : await loadStoryBundle(deps, version))
  } catch {
    return reply(storyServerError())
  }
}
