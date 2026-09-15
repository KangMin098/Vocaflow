// apps/web/src/lib/seo/__tests__/og-queries.integration.test.ts
//
// **공유 카드가 빈 카드로 나가는 것**을 잡는다 — 이미지를 열어 보지 않고.
//
// 2026-08-26, 만화 카드가 제목 `Vocaflow` 짜리 빈 카드로 나간 적이 있다.
// `source_archive` 로 select 했는데 그건 RPC 가 매핑한 이름이고 표에는 `source_adapter` 다.
// PostgREST 가 400 을 냈고 코드는 `null` 을 받아 조용히 폴백을 그렸다.
//
//   **상태 200 · 14 KB 짜리 유효한 PNG 였다.**
//   상태 코드로도, 크기로도, content-type 으로도 알 수 없다.
//
// 그 실패가 어디서 갈리는지는 분명하다 — **조회가 행을 못 주는 순간**이다.
// 그래서 카드가 쓰는 바로 그 쿼리(`lib/seo/og-queries.ts`)를 실제로 날려 본다.
// 컬럼 이름이 틀리거나 필터가 화면과 갈라지면 여기서 걸린다.
//
// 환경변수 없으면 skip — CI 정상.

import { describe, expect, it } from 'vitest'

import { OG_QUERIES, ogQueryUrl, type OgQueryKind } from '../og-queries'

const URL_BASE = process.env['NEXT_PUBLIC_SUPABASE_URL']
const ANON = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']
const skipIfNoEnv = !URL_BASE || !ANON

/** 카드와 같은 권한으로 — anon. 여기서 되는 것만 크롤러도 본다. */
async function get(url: string): Promise<{ status: number; rows: unknown[] }> {
  const res = await fetch(url, {
    headers: { apikey: ANON as string, Authorization: `Bearer ${ANON as string}` },
  })
  const rows = res.ok ? ((await res.json()) as unknown[]) : []
  return { status: res.status, rows }
}

const KINDS = Object.keys(OG_QUERIES) as OgQueryKind[]

describe.skipIf(skipIfNoEnv)('공유 카드 쿼리 (실 DB · anon)', () => {
  it.each(KINDS)('%s — 컬럼이 실재한다 (틀리면 PostgREST 가 400 을 낸다)', async (kind) => {
    const q = OG_QUERIES[kind]
    const url = `${URL_BASE}/rest/v1/${q.table}?${q.sampleFilter}&select=${q.select}&limit=1`
    const { status } = await get(url)

    expect(
      status,
      `${q.table} 의 select 가 거부됐다 — 컬럼 이름을 표 기준으로 맞출 것 (RPC 반환 이름과 다를 수 있다)`,
    ).toBe(200)
  })

  it.each(KINDS)('%s — 실제로 행이 온다 (0행이면 모든 카드가 폴백이다)', async (kind) => {
    const q = OG_QUERIES[kind]
    const url = `${URL_BASE}/rest/v1/${q.table}?${q.sampleFilter}&select=${q.select}&limit=1`
    const { rows } = await get(url)

    expect(
      rows.length,
      `${q.table} 에서 공개 조건으로 한 행도 안 온다 — 필터가 화면과 갈라졌거나 RLS 가 막는다`,
    ).toBeGreaterThan(0)
  })

  it.each(KINDS)('%s — 제목이 비어 있지 않다 (카드의 본체다)', async (kind) => {
    const q = OG_QUERIES[kind]
    const url = `${URL_BASE}/rest/v1/${q.table}?${q.sampleFilter}&select=${q.select}&limit=1`
    const { rows } = await get(url)
    const first = rows[0] as Record<string, unknown> | undefined

    expect(typeof first?.['title'], `${q.table}.title 이 문자열이 아니다`).toBe('string')
    expect((first?.['title'] as string).length).toBeGreaterThan(0)
  })

  it('키를 넣은 URL 도 같은 모양이다 — 카드가 실제로 부르는 형태', async () => {
    // `ogQueryUrl` 이 필터를 잘못 조립하면 위 검사들을 통과하고도 카드만 빈다.
    const q = OG_QUERIES.article
    const sample = `${URL_BASE}/rest/v1/${q.table}?${q.sampleFilter}&select=id&limit=1`
    const { rows } = await get(sample)
    const id = (rows[0] as { id?: string } | undefined)?.id
    expect(id, '표본 id 를 못 얻었다').toBeTruthy()

    const { status, rows: byId } = await get(ogQueryUrl(URL_BASE as string, 'article', id as string))
    expect(status).toBe(200)
    expect(byId.length, 'id 로 조회했는데 행이 없다 — 필터 조립이 틀렸다').toBe(1)
  })
})
