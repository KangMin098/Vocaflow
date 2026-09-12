// apps/web/src/app/__tests__/sitemap-routes-exist.test.ts
//
// sitemap 의 정적 경로가 **실제로 그 자리에 화면이 있는가**, 그리고 **리다이렉트가 아닌가.**
//
// 2026-08-26 실측에서 둘 다 어긋나 있었다:
//   · `/comics` 가 올라가 있었는데 그 파일은 `redirect('/comics/adapted')` 뿐이다.
//     크롤러는 한 번 더 왕복해야 하고, 크롤 예산은 그만큼 콘텐츠에 못 쓰인다.
//   · 정작 **실제 목록 두 개**(`/comics/adapted` · `/comics/restored`)와
//     ACP 짧은 글 카탈로그(`/library/scripts`)는 sitemap 에 **없었다.**
//     같은 날 복원 만화 상세 110개를 올려 놓고 그리로 가는 문은 색인되지 않는 상태였다.
//
// 목록을 손으로 관리하는 한 이 어긋남은 반복된다. 그래서 **파일 시스템과 대조**한다.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { SITEMAP_PATHS } from '../sitemap'

const APP = join(process.cwd(), 'src', 'app')

/**
 * 라우트 경로 → `page.tsx` 파일.
 *
 * App Router 의 route group(`(main)` 등)은 URL 에 나타나지 않으므로 이름으로 맞출 수 없다.
 * 그래서 그룹 디렉터리를 **투명하게** 통과하며 내려간다.
 */
function findPageFile(routePath: string): string | null {
  const segments = routePath.split('/').filter(Boolean)

  function descend(dir: string, rest: string[]): string | null {
    if (rest.length === 0) {
      const p = join(dir, 'page.tsx')
      return existsSync(p) ? p : null
    }

    const [head, ...tail] = rest as [string, ...string[]]

    // 같은 이름의 디렉터리를 먼저
    const direct = join(dir, head)
    if (existsSync(direct) && statSync(direct).isDirectory()) {
      const hit = descend(direct, tail)
      if (hit) return hit
    }

    // route group `(...)` 은 URL 에 없다 — 건너뛰며 같은 깊이를 다시 본다
    for (const name of readdirSync(dir)) {
      if (!name.startsWith('(') || !name.endsWith(')')) continue
      const g = join(dir, name)
      if (!statSync(g).isDirectory()) continue
      const hit = descend(g, rest)
      if (hit) return hit
    }

    return null
  }

  return descend(APP, segments)
}

/** `redirect(...)` 만 하고 아무것도 그리지 않는 화면인가. */
function isRedirectOnly(file: string): boolean {
  const src = readFileSync(file, 'utf8')
  if (!/\bredirect\(/.test(src)) return false
  // 리다이렉트 전용 파일은 아주 짧다. 조건부 리다이렉트가 있는 진짜 화면과 가르는 기준.
  return src.split('\n').filter((l) => l.trim().length > 0).length < 20
}

describe('sitemap 경로 ↔ 실제 화면', () => {
  const found = SITEMAP_PATHS.map((p) => ({ path: p, file: findPageFile(p) }))

  it.each(found)('$path — 그 자리에 화면이 있다', ({ path, file }) => {
    expect(file, `${path} 에 대응하는 page.tsx 를 못 찾았다 — 404 를 광고하고 있다`).not.toBeNull()
  })

  it.each(found)('$path — 리다이렉트가 아니다', ({ path, file }) => {
    if (!file) return // 위 테스트가 이미 실패한다
    expect(
      isRedirectOnly(file),
      `${path} 는 ${basename(file)} 에서 redirect 만 한다 — sitemap 에는 **도착지**를 넣어야 한다`,
    ).toBe(false)
  })

  it('복원 만화 상세를 올렸으면 그 카탈로그도 올린다', () => {
    // 상세 110개를 색인시키면서 목록을 빼면, 검색엔진이 그 묶음을 하나의 컬렉션으로 못 읽는다.
    expect(SITEMAP_PATHS).toContain('/comics/restored')
  })
})
