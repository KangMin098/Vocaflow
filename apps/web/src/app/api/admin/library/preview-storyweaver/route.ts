// apps/web/src/app/api/admin/library/preview-storyweaver/route.ts
// LCP — StoryWeaver 책 미리보기 (id/slug → 메타 + 페이지수 + 표지).
//
// GET /api/admin/library/preview-storyweaver?id=<story id 또는 slug>
// ingestFromStoryWeaver 재사용 (검증된 read API 파싱) → 미리보기 subset 반환.

import { NextResponse } from 'next/server'
import { ingestFromStoryWeaver } from '@vocaflow/library-pipeline'

import { requireAdminApi } from '@/lib/auth/require-admin-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request): Promise<NextResponse> {
  const admin = await requireAdminApi()
  if (admin instanceof NextResponse) return admin

  const { searchParams } = new URL(request.url)
  const id = (searchParams.get('id') ?? '').trim()
  if (!id) {
    return NextResponse.json({ message: 'StoryWeaver id/slug 를 입력해 주세요.' }, { status: 400 })
  }
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(id) || id.length > 120) {
    return NextResponse.json(
      { message: '영숫자·하이픈만 허용됩니다 (예: 2 또는 2-smile-please).' },
      { status: 400 },
    )
  }

  try {
    const raw = await ingestFromStoryWeaver(id)
    return NextResponse.json({
      source: 'storyweaver',
      source_id: raw.source_id,
      title: raw.title,
      author: raw.author ?? 'Pratham Books',
      license: raw.license,
      preview_text: raw.description ?? raw.raw_content.slice(0, 400),
      source_url: raw.source_url,
      page_count: raw.illustrations?.length ?? 0,
      has_audio: !!raw.audio_url,
      cover_image_url: raw.cover_image_url ?? null,
      fetched_at: raw.fetched_at.toISOString(),
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : '미리보기를 가져오지 못했습니다.'
    return NextResponse.json({ message }, { status: 502 })
  }
}
