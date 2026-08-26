// apps/web/src/app/__tests__/public-routes-in-sitemap.test.ts
//
// **공개 동적 라우트가 sitemap 에 유형째 빠지지 않는가** — 역방향 검사.
//
// `sitemap-routes-exist` 는 sitemap → 파일을 본다("올린 주소에 화면이 있는가").
// 그 방향만으로는 **아예 안 올린 것**을 못 잡는다. 실제로 그 구멍으로 두 번 샜다:
//   · 2026-08-26 — 발행 짧은 글 **160개**에 애초에 주소가 없었다(리졸버뿐이었다)
//   · 같은 날 — `/comics/adapted/[bookId]` 는 공개 상세인데 sitemap 에 유형이 없었다
//     (비로그인도 3컷 미리보기를 본다)
//
// 손으로 목록을 관리하는 한 세 번째가 온다. 그래서 **파일 시스템이 진실**이 되게 한다:
// 보호되지 않은 동적 라우트를 전부 찾아, sitemap 의 콘텐츠 경로가 그 유형을 덮는지 본다.
//
// ⚠️ 이 검사는 **유형**만 본다(개수가 아니라). 개수는 실 DB 통합 테스트의 몫이다.

import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { requiresAuth } from '@/lib/auth/protected-routes'

const APP = join(process.cwd(), 'src', 'app')

/**
 * 색인 대상이 아닌 것이 분명한 동적 라우트 — 이유를 **여기 적어야** 통과한다.
 *
 * 목록을 늘리는 것 자체는 나쁘지 않지만, 늘릴 때 한 번 더 생각하게 만드는 것이 목적이다.
 */
const NOT_INDEXED: ReadonlyArray<{ prefix: string; why: string }> = [
  { prefix: '/fit/s/', why: '공유 결과는 파생물 — robots 가 막고 페이지도 noindex 다' },
  { prefix: '/library/textbooks/', why: '교재 계단은 학습자 진도용 화면 (카탈로그가 아니다)' },
  { prefix: '/text/', why: '내가 넣은 개인 본문 — 보호 경로' },
  {
    prefix: '/admin',
    why:
      '관리 콘솔 — PROTECTED_PREFIXES(학습자 목록) 밖에서 3층 가드가 지킨다. robots 가 따로 막는다(robots.ts 의 ADMIN_PREFIX 참조)',
  },
]

/** `(main)`·`(marketing)` 아래의 **동적 세그먼트를 가진** 라우트를 URL 접두사로 모은다. */
function dynamicRoutePrefixes(): string[] {
  const out: string[] = []

  const walk = (dir: string, url: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name)
      if (!statSync(full).isDirectory()) continue

      // route group·private 폴더는 URL 에 안 들어간다
      if (name.startsWith('(') || name.startsWith('_')) {
        walk(full, url)
        continue
      }

      if (name.startsWith('[')) {
        // 동적 세그먼트 — 부모까지가 유형의 접두사다
        if (existsSync(join(full, 'page.tsx'))) out.push(`${url}/`)
        walk(full, `${url}/x`)
        continue
      }

      walk(full, `${url}/${name}`)
    }
  }

  walk(APP, '')
  return [...new Set(out)]
}

describe('공개 동적 라우트 ↔ sitemap', () => {
  const prefixes = dynamicRoutePrefixes()

  it('검사할 동적 라우트를 찾았다 — 못 찾으면 이 테스트는 아무것도 안 본다', () => {
    expect(prefixes.length).toBeGreaterThan(3)
  })

  it('공개 동적 라우트는 sitemap 이 그 유형을 덮거나, 안 덮는 이유가 적혀 있다', async () => {
    // 동적 목록은 실 DB 가 필요하므로 여기서는 **정적 목록 + 코드가 만드는 접두사**로 본다.
    // 실제 경로 생성기(`lib/seo/content-entries.ts`)가 어떤 접두사를 쓰는지 소스에서 읽는다 —
    // DB 없이도 "유형을 덮는가" 는 판정할 수 있다.
    const { readFileSync } = await import('node:fs')
    const gen = readFileSync(join(process.cwd(), 'src', 'lib', 'seo', 'content-entries.ts'), 'utf8')

    const uncovered = prefixes.filter((p) => {
      if (requiresAuth(p.replace(/\/$/, ''))) return false // 보호 경로는 애초에 색인 대상이 아니다
      if (NOT_INDEXED.some((n) => p.startsWith(n.prefix))) return false
      // 생성기가 이 접두사로 경로를 만드는가 (`path: \`/library/books/${...}\`` 형태)
      return !gen.includes(`\`${p}$`)
    })

    expect(
      uncovered,
      `공개 동적 라우트인데 sitemap 이 그 유형을 안 만든다: ${uncovered.join(', ')}\n` +
        '색인 대상이 아니라면 NOT_INDEXED 에 이유와 함께 적을 것.',
    ).toEqual([])
  })
})
