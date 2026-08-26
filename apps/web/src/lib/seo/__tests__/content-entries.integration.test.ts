// apps/web/src/lib/seo/__tests__/content-entries.integration.test.ts
//
// **anon 이 실제로 읽을 수 있는가** — 이 모듈의 유일한 위험.
//
// `fetchContentEntries` 는 일부러 anon 권한으로 읽는다("익명이 못 보면 sitemap 에도 없다").
// 그런데 RLS 가 막으면 함수는 **예외 없이 빈 배열**을 돌려주고, sitemap 은 조용히
// 예전처럼 랜딩 9개로 돌아간다. 실패가 안 보이는 모양이라 실 DB 로 못 박는다.
//
// 환경변수 없으면 skip — CI 정상.

import { createClient } from '@supabase/supabase-js'
import { describe, it, expect } from 'vitest'

import { fetchContentEntries } from '../content-entries'

const skipIfNoEnv =
  !process.env['NEXT_PUBLIC_SUPABASE_URL'] || !process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']

describe.skipIf(skipIfNoEnv)('sitemap 콘텐츠 목록 (실 DB · anon)', () => {
  it('빈 배열이 아니다 — RLS 가 막으면 조용히 0 이 되는 실패 모양', async () => {
    const entries = await fetchContentEntries()
    expect(
      entries.length,
      'anon 이 공개 콘텐츠를 못 읽는다 — sitemap 이 랜딩만 남는다',
    ).toBeGreaterThan(0)
  })

  it('도서와 만화가 둘 다 있다 — 한쪽 RLS 만 막혀도 절반이 사라진다', async () => {
    const entries = await fetchContentEntries()
    const books = entries.filter((e) => e.path.startsWith('/library/books/'))
    const comics = entries.filter((e) => e.path.startsWith('/comics/restored/'))
    expect(books.length, '발행 도서가 하나도 없다').toBeGreaterThan(0)
    expect(comics.length, '복원 만화가 하나도 없다').toBeGreaterThan(0)
  })

  /**
   * **절단 회귀** — 이 파일이 존재하는 진짜 이유.
   *
   * PostgREST 는 select 당 1,000행만 준다(오류도 경고도 없이). 처음 구현은 `pd_comic_panels`
   * 4,282행을 통째로 읽으려 했고, 1,000에서 잘린 결과 안에 든 호가 **28개**뿐이라
   * 만화 110호 중 82호가 조용히 사이트맵에서 빠졌다. 그럴듯한 작은 숫자로 나타나는 실패라
   * 사람 눈으로는 안 잡힌다.
   *
   * 그래서 숫자를 **DB 가 센 총계와 대조**한다 — 상수를 적어 두면 데이터가 늘 때 같이 낡는다.
   */
  it('발행 만화가 하나도 빠지지 않는다 — 1,000행 절단 회귀', async () => {
    const db = createClient(
      process.env['NEXT_PUBLIC_SUPABASE_URL'] as string,
      process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] as string,
      { auth: { persistSession: false } },
    )
    // head+count 는 행을 받지 않으므로 절단과 무관한 총계를 준다.
    const { count } = await db
      .from('pd_comic_issues')
      .select('id', { count: 'exact', head: true })

    const comics = (await fetchContentEntries()).filter((e) =>
      e.path.startsWith('/comics/restored/'),
    )

    expect(count, 'anon 이 만화를 하나도 못 센다').toBeGreaterThan(0)
    expect(
      comics.length,
      `anon 에게 보이는 발행 만화 ${count}호 중 ${comics.length}호만 sitemap 에 있다 — 절단 의심`,
    ).toBe(count)
  })

  it('짧은 글도 들어간다 — 셋 중 하나만 빠져도 표면의 절반이 사라진다', async () => {
    // 발행 글 160개는 **본문까지** 익명에게 열려 있어(도서·만화와 다르다) 롱테일이 가장 잘 걸린다.
    const entries = await fetchContentEntries()
    const articles = entries.filter((e) => e.path.startsWith('/library/scripts/'))
    expect(articles.length, '발행 짧은 글이 하나도 없다').toBeGreaterThan(0)
  })

  it('경로가 중복되지 않는다', async () => {
    const paths = (await fetchContentEntries()).map((e) => e.path)
    expect(new Set(paths).size).toBe(paths.length)
  })
})
