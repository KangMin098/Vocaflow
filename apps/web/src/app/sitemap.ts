// apps/web/src/app/sitemap.ts
//
// sitemap.xml — 공개 화면 목록.
//
// 왜 다시 만드나 (2026-08-17 실측):
//   기존 `public/sitemap.xml` 은 **URL 이 루트 하나뿐**이었다. `/fit`·`/about`·`/pricing`·
//   `/library`·`/comics` 가 전부 빠져 있었고, 정적 파일이라 화면이 늘어도 아무도 갱신하지 않았다.
//   검색으로 들어올 수 있는 문이 실제로는 하나였던 셈이다.
//
// ⚠️ 여기 적은 경로는 **`requiresAuth` 로 검증**한다. 보호 경로를 sitemap 에 올리면
//    크롤러가 로그인 화면을 색인하고, 그건 없는 것보다 나쁘다. 회귀가 이 계약을 강제한다.

import type { MetadataRoute } from 'next'

import { requiresAuth } from '@/lib/auth/protected-routes'
import { absoluteUrl } from '@/lib/seo/site'

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

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()

  return ENTRIES
    // 보호 경로가 실수로 섞여 들어오면 조용히 뺀다 — 로그인 화면을 색인시키지 않는다.
    .filter((e) => !requiresAuth(e.path))
    .map((e) => ({
      url: absoluteUrl(e.path),
      lastModified,
      changeFrequency: e.changeFrequency,
      priority: e.priority,
    }))
}
