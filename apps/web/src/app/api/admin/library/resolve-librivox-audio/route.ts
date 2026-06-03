// apps/web/src/app/api/admin/library/resolve-librivox-audio/route.ts
//
// GET /api/admin/library/resolve-librivox-audio?gutenbergId=&title=&author=
//   → Gutenberg/SE 도서에 연결할 LibriVox 보이스를 해결 (gutenberg id EXACT 우선, SE best-effort, 솔로 우선).
//
// 응답: 200 { audio, match }  (매칭 실패 시 audio=null, match=null)
//       400 invalid · 401/403 미인증/role · 502 LibriVox 오류

import { NextResponse, type NextRequest } from 'next/server'

import { requireAdminApi } from '@/lib/auth/require-admin-api'
import {
  gutenbergIdFromStandardEbooks,
  resolveLibriVoxAudioForBook,
} from '@/lib/library/librivox-audio'

export const runtime = 'nodejs'
export const revalidate = 86400

export async function GET(req: NextRequest) {
  const adminOrError = await requireAdminApi()
  if (adminOrError instanceof NextResponse) return adminOrError

  const sp = req.nextUrl.searchParams
  const title = (sp.get('title') ?? '').trim()
  const author = (sp.get('author') ?? '').trim() || null
  const rawGut = (sp.get('gutenbergId') ?? '').trim()
  let gutenbergId = /^\d{1,7}$/.test(rawGut) ? rawGut : null
  const seSlug = (sp.get('seSlug') ?? '').trim() || null
  const rawCh = parseInt((sp.get('chapterCount') ?? '').trim(), 10)
  const chapterCount = Number.isFinite(rawCh) && rawCh > 0 ? rawCh : null

  if (!title && !gutenbergId && !seSlug) {
    return NextResponse.json(
      { error: 'BadRequest', message: 'title · gutenbergId · seSlug 중 하나가 필요합니다.' },
      { status: 400 },
    )
  }

  try {
    // Standard Ebooks 는 대부분 Gutenberg 전사본 파생 — 슬러그에서 원천 gutenberg id 해결 →
    // gutenberg-id EXACT 매칭 사용 (title/author fallback 보다 정확).
    if (!gutenbergId && seSlug) {
      gutenbergId = await gutenbergIdFromStandardEbooks(seSlug)
    }
    const result = await resolveLibriVoxAudioForBook({ gutenbergId, title, author, chapterCount })
    return NextResponse.json(result, {
      status: 200,
      headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown'
    return NextResponse.json(
      { error: 'GatewayError', message: `LibriVox 해결 실패: ${message}` },
      { status: 502 },
    )
  }
}
