// apps/web/src/app/api/lcp/dev-ingest-preview/route.ts
// LCP dev-only 소스 ingester 미리보기 — 외부 fetch 만, DB write 없음.
//
// 목적: 신설 book ingester(T-2 Pressbooks 등)의 실 추출 결과를 DB 적재 전 검증.
//   RawBook 를 산출해 통계(제목/저자/라이선스/챕터 수/단어 수/프로즈 샘플)만 반환.
//   공유 테이블 write 0 · 마이그레이션 불요 → 안전. 프로덕션 차단(NODE_ENV='production').
//
// body: { source: 'pressbooks'; source_id: string; max_chapters?: number }

import { NextResponse } from 'next/server'
import { ingestFromPressbooks, type RawBook } from '@vocaflow/library-pipeline'

import { requireAdminApi } from '@/lib/auth/require-admin-api'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

// 챕터 마커 제어문자 (segment.ts CHAPTER_GROUP_SEP=U+001F · CHAPTER_HREF_SEP=U+001E)
const MARKER_CTRL = /[]/g

interface PreviewBody {
  source?: string
  source_id?: string
  max_chapters?: number
}

export async function POST(request: Request): Promise<NextResponse> {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'dev-ingest-preview disabled in production' }, { status: 403 })
  }
  const admin = await requireAdminApi()
  if (admin instanceof NextResponse) return admin

  let body: PreviewBody
  try {
    body = (await request.json()) as PreviewBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!body.source_id) {
    return NextResponse.json({ error: 'source_id required' }, { status: 400 })
  }

  try {
    let raw: RawBook
    switch (body.source) {
      case 'pressbooks':
        raw = await ingestFromPressbooks(body.source_id, body.max_chapters ?? 0)
        break
      default:
        return NextResponse.json(
          { error: `unsupported source: ${body.source ?? '(none)'} — preview 는 현재 pressbooks 만` },
          { status: 400 },
        )
    }

    const chapterCount = (raw.raw_content.match(/(^|\n)CHAPTER \d+\./g) ?? []).length
    const wordCount = raw.raw_content.split(/\s+/).filter(Boolean).length
    // 프로즈 샘플 = 첫 CHAPTER 마커 이후 300자 (마커 제어문자 제거).
    const afterFirst = raw.raw_content.replace(MARKER_CTRL, ' ').split(/CHAPTER \d+\.[^\n]*\n/)[1] ?? ''
    return NextResponse.json({
      ok: true,
      source: raw.source,
      source_id: raw.source_id,
      source_url: raw.source_url,
      title: raw.title,
      author: raw.author ?? null,
      license: raw.license,
      chapter_count: chapterCount,
      word_count: wordCount,
      prose_sample: afterFirst.trim().slice(0, 300),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
