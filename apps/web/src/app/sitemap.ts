// apps/web/src/app/sitemap.ts
//
// sitemap.xml — 공개 화면 목록.
//
// 왜 다시 만드나 (2026-08-17 실측):
//   기존 `public/sitemap.xml` 은 **URL 이 루트 하나뿐**이었다. `/fit`·`/about`·`/pricing`·
//   `/library`·`/comics` 가 전부 빠져 있었고, 정적 파일이라 화면이 늘어도 아무도 갱신하지 않았다.
//   검색으로 들어올 수 있는 문이 실제로는 하나였던 셈이다.
//
// 2026-08-26 — 여기에 **콘텐츠 상세**를 더했다. 그전까지 sitemap 은 정적 랜딩 9개뿐이었는데,
//   로그인 없이 열리는 콘텐츠 상세가 126개(발행 도서 13 + 복원 만화 113) 있었다.
//   검색 유입은 랜딩이 아니라 롱테일에서 온다 — 문을 126개 내고 9개만 알리고 있었다.
//   목록은 `lib/seo/content-entries.ts` 가 **anon 권한으로** 만든다(못 읽으면 안 올린다).
//
// ⚠️ 여기 적은 경로는 **`requiresAuth` 로 검증**한다. 보호 경로를 sitemap 에 올리면
//    크롤러가 로그인 화면을 색인하고, 그건 없는 것보다 나쁘다. 회귀가 이 계약을 강제한다.

import type { MetadataRoute } from 'next'

import { requiresAuth } from '@/lib/auth/protected-routes'
import { absoluteUrl } from '@/lib/seo/site'
import { fetchContentEntries } from '@/lib/seo/content-entries'

interface Entry {
  path: string
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']
  priority: number
}

/**
 * 색인 대상 공개 화면.
 *
 * 우선순위는 "검색으로 들어온 사람에게 무엇을 먼저 보여줄 것인가" 다.
 * `/fit` 이 랜딩(1.0) 다음인 이유: 가입 전에 가치를 보여주는 유일한 화면이고,
 * 교사 채널(CAC 0)이 성립하려면 이 문이 가장 넓어야 한다.
 */
const ENTRIES: Entry[] = [
  { path: '/', changeFrequency: 'weekly', priority: 1.0 },
  { path: '/fit', changeFrequency: 'monthly', priority: 0.9 },
  { path: '/pricing', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/about', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/library/books', changeFrequency: 'weekly', priority: 0.6 },
  { path: '/library/vocab', changeFrequency: 'weekly', priority: 0.6 },
  { path: '/comics', changeFrequency: 'weekly', priority: 0.5 },
  { path: '/terms', changeFrequency: 'yearly', priority: 0.2 },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.2 },
]

/** 색인 후보 목록 — 회귀 테스트가 이걸 직접 검증한다. */
export const SITEMAP_PATHS = ENTRIES.map((e) => e.path)

/**
 * 콘텐츠 상세의 우선순위.
 *
 * 정적 카탈로그(0.6)보다 낮게 둔다 — 개별 작품은 롱테일이라 수가 많고, 카탈로그가
 * 먼저 잡혀야 그 안에서 사람이 고를 수 있다. 0 으로 두지 않는 이유는 이 126개가
 * 실제 검색 유입의 문이기 때문이다.
 */
const CONTENT_PRIORITY = 0.5

/**
 * 하루마다 다시 만든다.
 *
 * ⚠️ 이게 없으면 Next 가 sitemap 을 **빌드 시점에 프리렌더하고 그대로 굳힌다**
 * (2026-08-26 빌드 실측: `○ /sitemap.xml` — Static). 그러면 도서를 발행해도
 * **재배포 전까지 사이트맵이 132개 그대로**다. 콘텐츠를 DB 에서 읽도록 만든 의미가 사라진다.
 *
 * 하루인 이유: 크롤러가 sitemap 을 그보다 자주 읽지 않고, 발행은 사람이 하는 일이라
 * 분 단위로 반영될 필요가 없다.
 */
export const revalidate = 86400

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date()

  const staticEntries = ENTRIES
    // 보호 경로가 실수로 섞여 들어오면 조용히 뺀다 — 로그인 화면을 색인시키지 않는다.
    .filter((e) => !requiresAuth(e.path))
    .map((e) => ({
      url: absoluteUrl(e.path),
      lastModified,
      changeFrequency: e.changeFrequency,
      priority: e.priority,
    }))

  // 콘텐츠가 없거나 DB 를 못 읽어도 정적 목록은 그대로 나간다.
  const content = await fetchContentEntries()
  const seen = new Set(staticEntries.map((e) => e.url))

  const contentEntries = content
    .filter((c) => !requiresAuth(c.path))
    .map((c) => ({
      url: absoluteUrl(c.path),
      lastModified: c.lastModified ?? lastModified,
      changeFrequency: 'monthly' as const,
      priority: CONTENT_PRIORITY,
    }))
    .filter((e) => {
      if (seen.has(e.url)) return false
      seen.add(e.url)
      return true
    })

  return [...staticEntries, ...contentEntries]
}
