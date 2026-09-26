// apps/web/src/lib/search/global.ts
//
// **전역 검색**(DD-68 · tines-mapping §10 — 참조 `GlobalSearch` 모달에 대응). 로그인 없이도 쓴다.
//
// 묶음 넷:
//   화면 — 내비 데이터(nav-data) · 서버 조회 없음
//   도서 — `library_books` 발행본 제목·저자(RLS: 누구나 발행 + 국내 저작권 안전만 읽는다)
//   단어 — `shared_dictionary` 표제어 앞부분 일치 + 한국어 뜻(RLS: **로그인한 사람만** — 익명이면 빈 묶음)
//   영상 — 카탈로그 제목
// 권한은 우회하지 않는다 — 조회는 요청자의 세션(서버 클라이언트)으로 하고, RLS 가 걸러 낸 만큼만 돌려준다.
// 만화(`comic_books`)는 RLS 가 관리자만 읽게 해 두었으므로 여기 넣지 않는다.

import type { SupabaseClient } from '@supabase/supabase-js'

import { FOOTER_COLUMNS, MENUS } from '@/components/marketing/site/nav-data'
import type { ResolvedVideo } from '@/lib/video/catalog'

export const QUERY_MAX = 60
export const GROUP_LIMIT = 6

/** `href` 가 없으면 이동하지 않는 행이다 — 결과 안에서 답을 보여 준다(단어: 뜻). */
export type SearchHit = { href?: string; title: string; sub?: string }
export type SearchGroups = { pages: SearchHit[]; books: SearchHit[]; words: SearchHit[]; videos: SearchHit[] }

/**
 * 검색어 정리 — 앞뒤 공백을 걷고 60자로 자른다. PostgREST `or()` · `ilike` 문법에 쓰이는 글자
 * (`% _ , ( ) * \\ "`)는 지운다 — 남기면 사용자 입력이 필터 문법이 되어 다른 조건을 만든다.
 */
export function cleanQuery(raw: string | null | undefined): string {
  return String(raw ?? '')
    .replace(/[%_,()*\\"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, QUERY_MAX)
}

/** 영어 낱말 검색으로 볼 수 있는가 — 표제어 조회는 이 모양일 때만 한다. */
export const isWordQuery = (q: string) => /^[a-z][a-z' -]{0,40}$/i.test(q)

const norm = (s: string) => s.toLowerCase()

/** 화면 · 기능 — 메가메뉴 · 푸터의 실재 경로만(중복 경로는 한 번). */
export function matchPages(q: string): SearchHit[] {
  if (!q) return []
  const seen = new Set<string>()
  const all: SearchHit[] = []
  for (const m of MENUS) for (const l of [...m.cards, ...m.list]) all.push({ href: l.href, title: l.title, sub: l.body })
  for (const c of FOOTER_COLUMNS) for (const l of c.links) if (l.href.startsWith('/')) all.push({ href: l.href, title: l.label, sub: c.title })
  const n = norm(q)
  return all
    .filter((h) => (norm(h.title).includes(n) || norm(h.sub ?? '').includes(n)) && !seen.has(h.href!) && seen.add(h.href!))
    .slice(0, GROUP_LIMIT)
}

export function matchVideos(videos: ResolvedVideo[], q: string): SearchHit[] {
  if (!q) return []
  const n = norm(q)
  return videos
    .filter((v) => norm(v.title).includes(n) || norm(v.subtitle ?? '').includes(n))
    .slice(0, 4)
    .map((v) => ({ href: `/video/${v.id}`, title: v.title, sub: v.subtitle }))
}

export async function searchBooks(supabase: SupabaseClient, q: string): Promise<SearchHit[]> {
  if (!q) return []
  const like = `%${q}%`
  const { data, error } = await supabase
    .from('library_books')
    .select('id, title, author, cefr_level')
    .eq('status', 'published')
    .or(`title.ilike.${like},author.ilike.${like}`)
    .order('recommended_order', { ascending: true, nullsFirst: false })
    .limit(GROUP_LIMIT)
  // 오류를 빈 결과로 삼키지 않는다 — 부르는 쪽이 「못 읽음」 과 「없음」 을 가른다.
  if (error) throw new Error(`library_books 검색 실패: ${error.message}`)
  return (data ?? []).map((b) => ({
    href: `/library/books/${b.id}`,
    title: b.title,
    sub: [b.author, b.cefr_level].filter(Boolean).join(' · ') || undefined,
  }))
}

export async function searchWords(supabase: SupabaseClient, q: string): Promise<SearchHit[]> {
  if (!isWordQuery(q)) return []
  const { data, error } = await supabase
    .from('shared_dictionary')
    .select('word, meaning_ko, pos')
    .ilike('word', `${q.toLowerCase()}%`)
    .or('archived.is.null,archived.eq.false')
    .order('frequency_rank', { ascending: true, nullsFirst: false })
    .limit(GROUP_LIMIT)
  if (error) throw new Error(`shared_dictionary 검색 실패: ${error.message}`)
  // 단어 하나를 보여 주는 화면이 없다 — 없는 화면으로 보내지 않고 뜻을 행 안에 보여 준다.
  return (data ?? []).map((w) => ({
    title: w.word,
    sub: [w.pos, w.meaning_ko].filter(Boolean).join(' · ') || undefined,
  }))
}
