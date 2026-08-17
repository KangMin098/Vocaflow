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

import { describe, expect, it } from 'vitest'

import robots from '../robots'
import sitemap, { SITEMAP_PATHS } from '../sitemap'
import { PROTECTED_PREFIXES, requiresAuth } from '@/lib/auth/protected-routes'
import { SITE_ORIGIN } from '@/lib/seo/site'

describe('sitemap — 색인 대상', () => {
  const entries = sitemap()

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

  it('약관·개인정보는 낮은 우선순위다 — 검색 유입의 문이 아니다', () => {
    const byPath = new Map(entries.map((e) => [e.url.slice(SITE_ORIGIN.length) || '/', e]))
    expect(byPath.get('/terms')!.priority!).toBeLessThan(0.5)
    expect(byPath.get('/privacy')!.priority!).toBeLessThan(0.5)
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
