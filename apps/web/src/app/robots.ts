// apps/web/src/app/robots.ts
//
// robots.txt — **인증 레지스트리에서 파생**한다. 손으로 적지 않는다.
//
// 왜 파생인가:
//   기존 `public/robots.txt` 는 `Allow: /` 한 줄이었다. 그래서 크롤러가 `/hub`·`/wordvault`·
//   `/settings` 같은 보호 경로를 계속 훑고, 그때마다 로그인으로 리다이렉트된 **빈 페이지**를 본다.
//   크롤 예산이 로그인 화면 복제본에 쓰이고, 색인에는 같은 페이지가 여러 주소로 잡힌다.
//   그렇다고 목록을 손으로 적으면 `PROTECTED_PREFIXES` 와 갈라진다 — 새 보호 화면이 생겨도
//   robots 는 모르고, 아무도 그걸 눈치채지 못한다.
//   → `protected-routes.ts` 를 **단일 출처**로 삼는다. 보호 목록에 추가하면 robots 가 따라온다.
//
// ⚠️ `/api` 는 `PUBLIC_PREFIXES` 에 있지만(미들웨어가 리다이렉트하지 않는다는 뜻) **색인 대상은
//    아니다.** "로그인 불필요" 와 "검색에 노출" 은 다른 축이라 여기서 따로 막는다.

import type { MetadataRoute } from 'next'

import { PROTECTED_PREFIXES } from '@/lib/auth/protected-routes'
import { absoluteUrl } from '@/lib/seo/site'

/** 로그인이 필요하진 않지만 색인할 이유도 없는 경로. */
const NOINDEX_PUBLIC = ['/api/', '/dev/', '/hub-lab']

export default function robots(): MetadataRoute.Robots {
  const disallow = [
    ...PROTECTED_PREFIXES.map((p) => `${p}/`),
    ...NOINDEX_PUBLIC,
    // 공유 결과는 파생물이라 색인하지 않는다 — 같은 화면이 무한한 주소로 잡힌다.
    // (`/fit` 자체는 색인한다. 공유 페이지 메타에도 noindex 를 걸어 두 겹으로 막는다.)
    '/fit/s/',
  ]

  return {
    rules: [{ userAgent: '*', allow: '/', disallow }],
    sitemap: absoluteUrl('/sitemap.xml'),
  }
}
