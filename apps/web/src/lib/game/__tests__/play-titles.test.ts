// apps/web/src/lib/game/__tests__/play-titles.test.ts
//
// **게임 19종이 서로 다른 브라우저 제목을 갖는가.**
//
// ── 왜 (실측 2026-08-30) ─────────────────────────────────────────────
// `(app)/play/*/page.tsx` 는 전부 `'use client'` 다(`next/dynamic` + `ssr:false` 로
// 게임 번들을 늦게 싣는다). 클라이언트 컴포넌트는 `metadata` 를 내보낼 수 없어서
// **19종 전부가 루트 기본 제목** "Vocaflow — 영어 스크립트 기반 종합 학습" 을 달고 있었다.
// 탭·히스토리·북마크가 모두 같은 이름이라 무엇을 열어 뒀는지 구별할 수 없었다.
//
// 고친 방법은 라우트마다 `layout.tsx` 하나(제목만)인데, **파일이 19개라 새 게임에서
// 빠지기 쉽다** — 이 저장소가 반복해 겪은 "손으로 유지하는 목록" 이다
// (SessionFrame 의 SESSION_META 도 같은 이유로 카탈로그 파생으로 바꿨다).
// 그래서 목록을 없애는 대신 **가드를 둔다**: 라우트가 늘면 이 테스트가 먼저 빨개진다.

import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { GAME_CATALOG } from '@/lib/game/catalog'

const PLAY_DIR = path.resolve(__dirname, '../../../app/(app)/play')

/** page.tsx 가 있는 실제 라우트만. */
function playSlugs(): string[] {
  return fs
    .readdirSync(PLAY_DIR)
    .filter((d) => fs.existsSync(path.join(PLAY_DIR, d, 'page.tsx')))
    .sort()
}

function titleOf(slug: string): string | null {
  const file = path.join(PLAY_DIR, slug, 'layout.tsx')
  if (!fs.existsSync(file)) return null
  const src = fs.readFileSync(file, 'utf8')
  const m = src.match(/title:\s*(?:'([^']*)'|"([^"]*)")/)
  return m ? (m[1] ?? m[2] ?? null) : null
}

describe('게임 라우트 제목', () => {
  it('라우트를 하나도 못 찾으면 이 테스트는 아무것도 지키지 않는다', () => {
    expect(playSlugs().length).toBeGreaterThan(10)
  })

  it('모든 게임 라우트가 자기 제목을 갖는다', () => {
    const missing = playSlugs().filter((s) => !titleOf(s))
    expect(missing, `layout.tsx 의 제목이 없다: ${missing.join(', ')}`).toEqual([])
  })

  it('제목은 GAME_CATALOG 의 이름을 따른다 — 화면에서 짓지 않는다', () => {
    const bySlug = new Map(GAME_CATALOG.map((g) => [g.slug as string, g.name]))
    const wrong: string[] = []
    for (const slug of playSlugs()) {
      const name = bySlug.get(slug)
      // 카탈로그에 없는 라우트는 셸 제목·닫기 대상도 없다 — 그쪽이 먼저 문제다.
      expect(name, `GAME_CATALOG 에 없는 라우트: ${slug}`).toBeTruthy()
      // ⚠️ `플레이` 가 붙는 이유 — 게임 이름만 쓰면 **같은 이름의 허브와 겹친다.**
      //    `/wordblitz`(허브)와 `/play/wordblitz`(세션)가 실측에서 같은 제목이었다
      //    (2026-08-30 · `28-screen-identity` 제목 중복). `(main)` 쪽 세션이 이미
      //    같은 방식으로 가른다 — `/flashcard` vs `/flashcard/play`("Flashcard 학습").
      const want = `${name} 플레이`
      const got = titleOf(slug)
      if (got !== want) wrong.push(`${slug}: "${got}" ≠ "${want}"`)
    }
    expect(wrong, `카탈로그와 어긋난 제목:\n${wrong.join('\n')}`).toEqual([])
  })

  it('브랜드를 손으로 붙이지 않는다 — 루트 template 이 이미 붙인다', () => {
    // 루트 `layout.tsx` 는 `title.template = "%s | Vocaflow"` 다. 페이지가 또 `· Vocaflow`
    // 를 적으면 탭에 **"X · Vocaflow | Vocaflow"** 로 두 번 나온다.
    // (저장소에 그렇게 적힌 페이지가 25곳 더 있다 — 실측 2026-08-30. 여기부터 늘리지 않는다.)
    const offenders = playSlugs().filter((s) => (titleOf(s) ?? '').includes('Vocaflow'))
    expect(offenders, `제목에 브랜드가 이미 들어 있다: ${offenders.join(', ')}`).toEqual([])
  })

  it('제목이 서로 겹치지 않는다', () => {
    const titles = playSlugs().map((s) => titleOf(s))
    const dupes = titles.filter((t, i) => t !== null && titles.indexOf(t) !== i)
    expect([...new Set(dupes)], `겹치는 제목: ${dupes.join(', ')}`).toEqual([])
  })
})
