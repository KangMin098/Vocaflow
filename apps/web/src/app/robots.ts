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

/**
 * ⚠️ **`/admin` 은 `PROTECTED_PREFIXES` 에서 오지 않는다.**
 *
 * 그 목록은 **학습자** 보호 경로이고, admin 은 3층 가드(미들웨어 + `requireAdmin` +
 * `requireAdminApi`)가 따로 지킨다. 그래서 파생만 믿으면 robots 가 admin 을 **안 막는다** —
 * 2026-08-26 실측에서 실제로 그 상태였다. 크롤러가 admin 전체를 훑고 로그인 리다이렉트를
 * 받으며 크롤 예산을 쓰고, 관리 화면의 주소 구조가 그대로 드러난다.
 *
 * 여기 손으로 적는 이유가 그것이다. 보호 방식이 다르면 파생도 다른 곳에서 와야 한다.
 */
const ADMIN_PREFIX = '/admin'

/** 로그인이 필요하진 않지만 색인할 이유도 없는 경로. */
// ⚠️ 접두사에 슬래시를 붙이면 **그 경로 자체는 안 막힌다** — '/dev/' 는 '/dev' 를 잡지 못한다.
//    2026-08-26 에 개발용 화면 인덱스를 '/' 에서 '/dev' 로 옮기며 드러났다.
const NOINDEX_PUBLIC = ['/api/', '/dev', '/dev/', '/hub-lab']

export default function robots(): MetadataRoute.Robots {
  const disallow = [
    ...PROTECTED_PREFIXES.map((p) => `${p}/`),
    ADMIN_PREFIX,
    `${ADMIN_PREFIX}/`,
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
