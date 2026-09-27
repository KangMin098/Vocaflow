// apps/web/src/app/api/search/route.ts
//
// 전역 검색 API(DD-68) — `GET /api/search?q=` → { q, groups, partial }.
// 로그인 없이 부를 수 있다. 조회는 요청자의 세션으로 하므로 RLS 가 권한을 정한다(익명이면 단어 묶음은 빈다).
// 한 묶음이 실패해도 나머지는 돌려주고 `partial` 에 실패한 묶음 이름을 적는다 — 오류를 「결과 없음」으로 삼키지 않는다.

import { NextResponse, type NextRequest } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { cleanQuery, matchPages, matchVideos, searchBooks, searchWords, type SearchGroups } from '@/lib/search/global'
import { KIND_ORDER, videosByKind } from '@/lib/video/catalog'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const q = cleanQuery(req.nextUrl.searchParams.get('q'))
  const empty: SearchGroups = { pages: [], books: [], words: [], videos: [] }
  if (!q) return NextResponse.json({ q, groups: empty, partial: [] })

  const supabase = await createClient()
  const byKind = videosByKind()
  const videos = KIND_ORDER.flatMap((k) => byKind[k])
  const partial: string[] = []
  const settle = async <T,>(name: string, p: Promise<T>, fallback: T): Promise<T> => {
    try { return await p } catch (e) { partial.push(name); console.error('[search]', name, e); return fallback }
  }
  const [books, words] = await Promise.all([
    settle('books', searchBooks(supabase, q), []),
    settle('words', searchWords(supabase, q), []),
  ])
  const groups: SearchGroups = { pages: matchPages(q), books, words, videos: matchVideos(videos, q) }
  return NextResponse.json({ q, groups, partial }, { headers: { 'Cache-Control': 'private, max-age=30' } })
}
