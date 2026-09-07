// apps/web/src/app/__tests__/seo-routes.test.ts
//
// robots.txt · sitemap.xml 회귀.
//
// 이 파일이 지키는 계약 하나가 나머지를 전부 끌고 간다:
//   **보호 화면이 색인되지 않는다.**
//   sitemap 에 보호 경로가 올라가면 크롤러는 로그인 화면을 색인한다 — 없는 것보다 나쁘다.
//   robots 가 보호 경로를 안 막으면 크롤 예산이 로그인 리다이렉트 복제본에 쓰인다.
//   두 파일 모두 `protected-routes.ts` 에서 파생되므로, 이 테스트는 그 파생이 살아 있는지를 본다.
//
// 왜 손으로 적은 목록을 안 믿나: 실측(2026-08-17) 기준 `public/sitemap.xml` 은 URL 이
//   **루트 하나뿐**이었다. 정적 파일이라 화면이 늘어도 아무도 갱신하지 않았다.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { beforeAll, describe, expect, it, vi } from 'vitest'

import robots from '../robots'
import sitemap, { SITEMAP_PATHS } from '../sitemap'
import { PROTECTED_PREFIXES, requiresAuth } from '@/lib/auth/protected-routes'
import { SITE_ORIGIN } from '@/lib/seo/site'

/**
 * 콘텐츠 목록은 **가짜로 준다.**
 *
 * 실 DB 를 치면 이 스위트가 네트워크에 묶이고, 그러면 "sitemap 의 계약" 이 아니라
 * "지금 DB 에 뭐가 있나" 를 시험하게 된다. 여기서 지키려는 것은 계약이다 —
 * 콘텐츠가 섞여 들어와도 ① 보호 경로는 걸러지고 ② 정적 항목과 중복되지 않고
 * ③ 정적 우선순위 질서를 깨지 않는다. 그래서 세 경우를 일부러 다 담은 가짜를 쓴다.
 * (실제로 몇 건이 나오는지는 `seo-content-entries.integration.test.ts` 가 실 DB 로 본다.)
 */
vi.mock('@/lib/seo/content-entries', () => ({
  fetchContentEntries: async () => [
    { path: '/library/books/aaaa', lastModified: new Date('2026-01-02') },
    { path: '/comics/restored/some-issue' },
    { path: '/wordvault/sneaky' }, // 보호 경로 — 걸러져야 한다
    { path: '/comics' }, // 정적 항목과 중복 — 한 번만 나가야 한다
  ],
}))

describe('sitemap — 색인 대상', () => {
  let entries: Awaited<ReturnType<typeof sitemap>>

  beforeAll(async () => {
    entries = await sitemap()
  })

  it('URL 이 하나뿐이 아니다 (정적 파일 시절의 결함)', () => {
    expect(entries.length).toBeGreaterThan(5)
  })

  it('모든 URL 이 절대 경로다 — 상대 URL 은 sitemap 에서 무효다', () => {
    for (const e of entries) {
      expect(e.url.startsWith('https://')).toBe(true)
      expect(e.url.startsWith(SITE_ORIGIN)).toBe(true)
    }
  })

  it('보호 경로를 절대 올리지 않는다 — 로그인 화면을 색인시키지 않는다', () => {
    for (const path of SITEMAP_PATHS) {
      expect(requiresAuth(path), `${path} 는 보호 경로다`).toBe(false)
    }
    for (const e of entries) {
      const path = e.url.slice(SITE_ORIGIN.length) || '/'
      expect(requiresAuth(path), `${path} 가 sitemap 에 있다`).toBe(false)
    }
  })

  it('가입 전 가치를 보여주는 화면(/fit)이 랜딩 다음으로 높다', () => {
    const byPath = new Map(entries.map((e) => [e.url.slice(SITE_ORIGIN.length) || '/', e]))
    const root = byPath.get('/')!
    const fit = byPath.get('/fit')!

    expect(fit).toBeDefined()
    expect(fit.priority!).toBeLessThanOrEqual(root.priority!)
    for (const [path, e] of byPath) {
      if (path === '/' || path === '/fit') continue
      expect(e.priority!, `${path} 우선순위`).toBeLessThan(fit.priority!)
    }
  })

  it('URL 이 중복되지 않는다', () => {
    const urls = entries.map((e) => e.url)
    expect(new Set(urls).size).toBe(urls.length)
  })

  it('콘텐츠 상세가 들어간다 — 랜딩만 있던 시절의 결함', () => {
    const paths = entries.map((e) => e.url.slice(SITE_ORIGIN.length))
    expect(paths).toContain('/library/books/aaaa')
    expect(paths).toContain('/comics/restored/some-issue')
  })

  it('콘텐츠 목록에 보호 경로가 섞여 와도 걸러낸다', () => {
    const paths = entries.map((e) => e.url.slice(SITE_ORIGIN.length))
    expect(paths).not.toContain('/wordvault/sneaky')
  })

  it('콘텐츠가 정적 항목과 겹치면 한 번만 나간다', () => {
    const dup = entries.filter((e) => e.url === `${SITE_ORIGIN}/comics`)
    expect(dup.length).toBe(1)
  })

  it('콘텐츠 상세는 카탈로그보다 낮다 — 목록이 먼저 잡혀야 고를 수 있다', () => {
    const byPath = new Map(entries.map((e) => [e.url.slice(SITE_ORIGIN.length) || '/', e]))
    const catalog = byPath.get('/library/books')!
    const detail = byPath.get('/library/books/aaaa')!
    expect(detail.priority!).toBeLessThan(catalog.priority!)
  })

  it('약관·개인정보는 낮은 우선순위다 — 검색 유입의 문이 아니다', () => {
    const byPath = new Map(entries.map((e) => [e.url.slice(SITE_ORIGIN.length) || '/', e]))
    expect(byPath.get('/terms')!.priority!).toBeLessThan(0.5)
    expect(byPath.get('/privacy')!.priority!).toBeLessThan(0.5)
  })
})

describe('sitemap — 갱신', () => {
  /**
   * **`revalidate` 가 없으면 sitemap 이 빌드 시점에 굳는다.**
   *
   * 그 상태면 도서를 발행해도 **재배포 전까지** 사이트맵이 그대로다 — 콘텐츠를 DB 에서
   * 읽도록 만든 의미가 통째로 사라진다. 런타임 동작이라 다른 테스트로는 안 잡혀서 소스를 본다.
   *
   * ⚠️ 빌드 라우트 표의 `○` 로는 판별할 수 없다(ISR 과 완전 정적이 같은 기호다).
   *    실제 확인은 `.next/prerender-manifest.json` 의 `initialRevalidateSeconds` —
   *    2026-08-26 실측: `/sitemap.xml` · `/` · `/pricing` = 86400, `/about` · `/robots.txt` = false.
   */
  it('revalidate 를 내보낸다 — 없으면 빌드 시점에 굳는다', () => {
    const src = readFileSync(join(process.cwd(), 'src', 'app', 'sitemap.ts'), 'utf8')
    expect(src).toMatch(/export const revalidate\s*=\s*\d+/)
  })
})

describe('robots — 크롤 범위', () => {
  const rules = robots()
  const rule = Array.isArray(rules.rules) ? rules.rules[0]! : rules.rules!
  const disallow = (Array.isArray(rule.disallow) ? rule.disallow : [rule.disallow!]) as string[]

  it('모든 보호 경로를 막는다 (레지스트리에서 파생 — 새 화면이 생겨도 따라온다)', () => {
    for (const prefix of PROTECTED_PREFIXES) {
      expect(disallow, `${prefix} 미차단`).toContain(`${prefix}/`)
    }
  })

  it('관리 콘솔을 막는다 — 학습자 보호 목록에서 파생되지 않는다', () => {
    // `/admin` 은 `PROTECTED_PREFIXES` 에 없다(3층 가드가 따로 지킨다). 그래서 파생만
    // 믿으면 robots 가 admin 을 안 막는다 — 2026-08-26 실측에서 실제로 그랬다.
    // 크롤러가 admin 전체를 훑으며 로그인 리다이렉트에 크롤 예산을 쓴다.
    expect(disallow).toContain('/admin')
    expect(disallow).toContain('/admin/')
  })

  it('로그인은 불필요하지만 색인 대상도 아닌 곳을 막는다', () => {
    // "로그인 불필요" 와 "검색 노출" 은 다른 축이다 — /api 는 PUBLIC_PREFIXES 에 있지만
    // 색인할 이유가 없다.
    expect(disallow).toContain('/api/')
    expect(disallow).toContain('/dev/')
    expect(disallow).toContain('/hub-lab')
  })

  it('공유 결과 링크는 색인하지 않는다 — 같은 화면이 무한한 주소로 잡힌다', () => {
    expect(disallow).toContain('/fit/s/')
  })

  it('개발용 화면 인덱스(/dev)를 막는다 — 접두사 슬래시만으로는 안 잡힌다', () => {
    // 2026-08-26 에 화면 인덱스를 / 에서 /dev 로 옮겼다. 그때까지 목록에는 '/dev/' 만
    // 있었는데, 그 규칙은 '/dev' **자체**를 막지 못한다 — 옮긴 화면이 그대로 색인될 뻔했다.
    expect(disallow).toContain('/dev')
  })

  it('공개 화면은 막지 않는다', () => {
    for (const open of ['/fit', '/pricing', '/about', '/library', '/comics']) {
      expect(disallow).not.toContain(`${open}/`)
    }
    expect(rule.allow).toBe('/')
  })

  it('sitemap 위치를 절대 URL 로 알린다', () => {
    expect(rules.sitemap).toBe(`${SITE_ORIGIN}/sitemap.xml`)
  })
})
