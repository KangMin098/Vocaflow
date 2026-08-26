// apps/web/src/lib/seo/content-entries.ts
//
// **콘텐츠 상세 페이지를 검색에 알린다** — sitemap 의 동적 절반.
//
// 왜 필요한가 (2026-08-26 실측):
//   sitemap 에 담긴 URL 은 9개, 전부 정적 랜딩이었다. 그런데 로그인 없이 열리는
//   **콘텐츠 상세가 123개** 있었다 — 발행 도서 13 + 발행 만화 110.
//   검색 유입은 랜딩이 아니라 롱테일 콘텐츠에서 온다("Alice in Wonderland 챕터 어휘").
//   문을 123개 내놓고 검색엔진에는 9개만 알리고 있었던 셈이다.
//
// ── 왜 anon 권한으로 읽나 ────────────────────────────────────────────
// sitemap 은 정의상 **익명 방문자가 볼 수 있는 것**의 목록이다. service-role 로 읽으면
// RLS 가 막는 행까지 올라가고 크롤러는 열리지 않는 URL 을 받는다.
// anon 으로 읽으면 "내가 못 읽으면 sitemap 에도 없다" 가 자동으로 성립한다.
//
// 실제로 그 규칙이 일한다: `pd_comic_issues` 는 969행이지만 RLS(`status='published'`)가
// **110호**만 연다. 나머지 859호는 카탈로그 관리용이라 색인 대상이 아니다 —
// 따로 필터를 적을 필요 없이 anon 이 이미 걸러 준다.
//
// ── ⚠️ 1,000행 절단 ────────────────────────────────────────────────
// PostgREST 는 한 번의 select 에 **1,000행**만 준다. 오류도 경고도 없다.
// 처음 이 파일은 `pd_comic_panels` 를 통째로 읽어 "패널 있는 호" 를 구했는데,
// anon 가시 패널이 4,282행이라 1,000에서 잘렸고 그 안에 든 호는 **28개**뿐이었다.
// 즉 만화 110호 중 82호가 조용히 사이트맵에서 빠졌다 — 실패가 예외가 아니라
// **그럴듯한 작은 숫자**로 나타나는 모양이라, 페이지네이션으로 못 박는다.
//
// ⚠️ 실패는 조용히 빈 배열이다. DB 가 잠깐 안 되는 것 때문에 **정적 9개까지 사라지면**
//    sitemap 전체가 회귀한다. 부분이 실패해도 나머지는 나가야 한다.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export interface ContentEntry {
  path: string
  /** 마지막 변경 시각. 모르면 생략 — 거짓 날짜를 주면 크롤러가 재방문 주기를 잘못 잡는다. */
  lastModified?: Date
}

type Row = Record<string, unknown>

/** PostgREST 한 번 요청의 상한. 이 수만큼 왔으면 **더 있을 수 있다**는 뜻이다. */
const PAGE = 1000

function anonClient(): SupabaseClient | null {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL']
  const key = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

/**
 * 한 표를 **끝까지** 읽는다.
 *
 * 호출부가 쿼리를 만들고(필터 포함) 이 함수는 `range` 만 넘긴다. 한 페이지가 PAGE 미만이면
 * 마지막이다. 오류가 나면 던진다 — 부분 결과를 전체인 척 돌려주면 그게 정확히 위 절단 사고다.
 */
async function selectAll(
  label: string,
  build: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<Row[]> {
  const out: Row[] = []

  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1)
    if (error) {
      const msg = (error as { message?: string }).message ?? '알 수 없음'
      throw new Error(`${label} 조회 실패: ${msg}`)
    }

    const rows = (data ?? []) as Row[]
    out.push(...rows)
    if (rows.length < PAGE) return out
  }
}

/** 발행 도서 상세 — `/library/books/[bookId]`. */
async function bookEntries(db: SupabaseClient): Promise<ContentEntry[]> {
  const rows = await selectAll('library_books', (f, t) =>
    db
      .from('library_books')
      .select('id, updated_at')
      .eq('status', 'published')
      // ⚠️ 조건을 **화면과 똑같이** 맞춘다. 페이지가 copyright_safe_in_kr 도 요구하므로
      //    여기서 빠뜨리면 sitemap 이 404 를 광고한다. 지금은 발행 13권 전부 true 지만
      //    ready 303권을 발행하면 갈라질 수 있다.
      .eq('copyright_safe_in_kr', true)
      .range(f, t),
  )

  return rows
    .filter((r): r is Row & { id: string } => typeof r.id === 'string')
    .map((r) => ({
      path: `/library/books/${r.id}`,
      ...(typeof r.updated_at === 'string' ? { lastModified: new Date(r.updated_at) } : {}),
    }))
}

/** 발행 만화 상세 — `/comics/restored/[slug]`. */
async function comicEntries(db: SupabaseClient): Promise<ContentEntry[]> {
  const [issues, panels] = await Promise.all([
    selectAll('pd_comic_issues', (f, t) =>
      db.from('pd_comic_issues').select('id, slug').range(f, t),
    ),
    selectAll('pd_comic_panels', (f, t) =>
      db.from('pd_comic_panels').select('issue_id').range(f, t),
    ),
  ])

  // 패널이 없는 호는 열면 notFound() 다 — 404 를 색인시키지 않는다.
  // (지금은 발행 110호 전부 패널이 있어 교집합이 곧 전체지만, 그건 오늘의 데이터일 뿐이다.)
  const withPanels = new Set(
    panels.map((r) => r.issue_id).filter((v): v is string => typeof v === 'string'),
  )

  return issues
    .filter(
      (r): r is Row & { id: string; slug: string } =>
        typeof r.id === 'string' && typeof r.slug === 'string' && withPanels.has(r.id),
    )
    .map((r) => ({ path: `/comics/restored/${r.slug}` }))
}
/**
 * 색인 대상 콘텐츠 상세 경로 전부.
 *
 * 환경변수가 없으면(테스트·빌드 일부 단계) 빈 배열 — 예외를 던지지 않는다.
 */
export async function fetchContentEntries(): Promise<ContentEntry[]> {
  const db = anonClient()
  if (!db) return []

  const [books, comics] = await Promise.all([
    bookEntries(db).catch((err: unknown) => {
      console.error('[seo/content-entries] 도서', err)
      return [] as ContentEntry[]
    }),
    comicEntries(db).catch((err: unknown) => {
      console.error('[seo/content-entries] 만화', err)
      return [] as ContentEntry[]
    }),
  ])

  return [...books, ...comics]
}
