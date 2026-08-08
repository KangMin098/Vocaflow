// apps/web/src/lib/game/__tests__/catalog.test.ts
//
// 게임 카탈로그 무결성 — 드리프트 재발 방지.
//
// 배경: 게임 정의가 4곳(arcade 페이지 · gamekit MARK_PATHS · SessionFrame SESSION_META ·
// 진입 카드 문구)에 복제돼 각각 다르게 낡았다("12종"/"14개 세계"/실제 17/라우트 19).
// 카탈로그로 통합했으므로, 이제 **카탈로그 ↔ 실제 라우트 디렉터리** 정합만 지키면 된다.
// 이 테스트가 그 계약을 강제한다 — 새 게임을 추가하고 카탈로그에 안 넣으면 여기서 깨진다.

import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  BANK_GAMES,
  GAME_BY_SLUG,
  GAME_CATALOG,
  GAME_COUNT,
  GAME_MARKS,
  MINE_GAMES,
  gamePlayHref,
  kstDayIndex,
  pickDailyGame,
} from '../catalog'

/** 실제 파일시스템의 /play/<slug> 라우트 목록 — 카탈로그가 따라가야 할 진실. */
function playRouteSlugs(): string[] {
  const dir = path.resolve(process.cwd(), 'src/app/(app)/play')
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(dir, e.name, 'page.tsx')))
    .map((e) => e.name)
    .sort()
}

describe('GAME_CATALOG ↔ /play 라우트 정합', () => {
  it('모든 /play/<slug> 라우트가 카탈로그에 등재돼 있다', () => {
    const missing = playRouteSlugs().filter((slug) => !GAME_BY_SLUG[slug])
    expect(
      missing,
      `카탈로그 누락: ${missing.join(', ')} — lib/game/catalog.tsx 의 GAME_CATALOG 에 추가하세요`,
    ).toEqual([])
  })

  it('카탈로그의 모든 게임이 실제 라우트를 가진다 (죽은 카드 방지)', () => {
    const routes = new Set(playRouteSlugs())
    const dangling = GAME_CATALOG.filter((g) => !routes.has(g.slug)).map((g) => g.slug)
    expect(dangling, `라우트 없는 카탈로그 항목: ${dangling.join(', ')}`).toEqual([])
  })

  it('GAME_COUNT 가 실제 라우트 수와 같다 (진입 카드 문구의 근거)', () => {
    expect(GAME_COUNT).toBe(playRouteSlugs().length)
  })
})

describe('GAME_CATALOG 항목 무결성', () => {
  it('slug 가 유일하다', () => {
    const slugs = GAME_CATALOG.map((g) => g.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('모든 게임에 라인 마크가 있다 (허브 카드 빈칸 방지)', () => {
    const noMark = GAME_CATALOG.filter((g) => !GAME_MARKS[g.slug]).map((g) => g.slug)
    expect(noMark, `마크 누락: ${noMark.join(', ')}`).toEqual([])
  })

  it('필수 표시 필드가 비어 있지 않다', () => {
    for (const g of GAME_CATALOG) {
      expect(g.name.length, `${g.slug}.name`).toBeGreaterThan(0)
      expect(g.tagline.length, `${g.slug}.tagline`).toBeGreaterThan(0)
      expect(g.layer.length, `${g.slug}.layer`).toBeGreaterThan(0)
      expect(g.emoji.length, `${g.slug}.emoji`).toBeGreaterThan(0)
      expect(g.closeHref.startsWith('/'), `${g.slug}.closeHref 는 내부 절대경로`).toBe(true)
    }
  })

  it('무드 4색이 모두 유효한 CSS 색이다', () => {
    const ok = /^(#[0-9a-fA-F]{3,8}|rgba?\()/
    for (const g of GAME_CATALOG) {
      for (const [k, v] of Object.entries(g.mood)) {
        expect(ok.test(v), `${g.slug}.mood.${k} = ${v}`).toBe(true)
      }
    }
  })

  it("source 는 minWords 와 정합한다 — mine 은 단어가 필요하고 bank 는 필요 없다", () => {
    for (const g of GAME_CATALOG) {
      if (g.source === 'mine') {
        expect(g.minWords, `${g.slug}: mine 인데 minWords=0 이면 내 단어를 절대 안 쓴다`).toBeGreaterThan(0)
      } else {
        expect(g.minWords, `${g.slug}: bank 인데 minWords>0 이면 맛보기로만 돈다`).toBe(0)
      }
    }
  })

  it('mine + bank 가 전체를 빠짐없이 분할한다', () => {
    expect(MINE_GAMES.length + BANK_GAMES.length).toBe(GAME_COUNT)
  })
})

describe('gamePlayHref', () => {
  it('스코프 없으면 순수 경로', () => {
    expect(gamePlayHref('cascade')).toBe('/play/cascade')
  })

  it('from 은 인코딩돼 실려도 디코딩 시 내부 경로', () => {
    const href = gamePlayHref('cascade', { from: '/arcade' })
    expect(href.startsWith('/play/cascade?')).toBe(true)
    const q = new URLSearchParams(href.split('?')[1])
    expect(q.get('from')).toBe('/arcade')
  })

  it('set·chapter·text 를 모두 싣는다', () => {
    const q = new URLSearchParams(gamePlayHref('cascade', { set: 's1', chapter: 3 }).split('?')[1])
    expect(q.get('set')).toBe('s1')
    expect(q.get('chapter')).toBe('3')
    const q2 = new URLSearchParams(gamePlayHref('cascade', { text: 't1' }).split('?')[1])
    expect(q2.get('text')).toBe('t1')
  })

  it('chapter 0·음수·null 은 싣지 않는다 (무의미한 쿼리 차단)', () => {
    expect(gamePlayHref('cascade', { chapter: 0 })).toBe('/play/cascade')
    expect(gamePlayHref('cascade', { chapter: -1 })).toBe('/play/cascade')
    expect(gamePlayHref('cascade', { chapter: null })).toBe('/play/cascade')
  })
})

describe('pickDailyGame — 오늘의 추천', () => {
  it('단어가 충분하면 mine, 부족하면 bank 에서 고른다', () => {
    for (let d = 0; d < 40; d++) {
      expect(pickDailyGame(d, 6).source).toBe('mine')
      expect(pickDailyGame(d, 5).source).toBe('bank')
      expect(pickDailyGame(d, 0).source).toBe('bank')
    }
  })

  it('같은 날짜엔 항상 같은 게임 (SSR/CSR 정합 · 새로고침해도 안 바뀜)', () => {
    for (const count of [0, 6, 100]) {
      const a = pickDailyGame(20_000, count)
      const b = pickDailyGame(20_000, count)
      expect(a.slug).toBe(b.slug)
    }
  })

  it('3D·베타는 추천하지 않는다 (모바일 번들 · 기록 미연동)', () => {
    for (let d = 0; d < 60; d++) {
      for (const count of [0, 6, 100]) {
        const g = pickDailyGame(d, count)
        expect(g.is3d, `${g.slug} 는 3D 인데 추천됨`).toBeFalsy()
        expect(g.beta, `${g.slug} 는 베타인데 추천됨`).toBeFalsy()
      }
    }
  })

  it('음수 dayIndex 에서도 유효한 게임을 반환한다 (모듈로 음수 방어)', () => {
    expect(pickDailyGame(-1, 10)).toBeTruthy()
    expect(pickDailyGame(-7, 0)).toBeTruthy()
  })

  it('충분히 여러 날을 돌면 추천 가능한 게임을 모두 순회한다 (특정 게임 고착 방지)', () => {
    const seen = new Set<string>()
    for (let d = 0; d < 60; d++) seen.add(pickDailyGame(d, 100).slug)
    const eligible = MINE_GAMES.filter((g) => !g.is3d && !g.beta)
    expect(seen.size).toBe(eligible.length)
  })
})

describe('kstDayIndex', () => {
  it('KST 자정을 경계로 날이 바뀐다', () => {
    // 2026-08-08 14:59 UTC = 2026-08-08 23:59 KST (같은 날)
    // 2026-08-08 15:00 UTC = 2026-08-09 00:00 KST (다음 날)
    const before = Date.UTC(2026, 7, 8, 14, 59, 0)
    const after = Date.UTC(2026, 7, 8, 15, 0, 0)
    expect(kstDayIndex(after) - kstDayIndex(before)).toBe(1)
  })

  it('같은 KST 날짜 안에서는 값이 같다', () => {
    const morning = Date.UTC(2026, 7, 8, 15, 30, 0) // 8/9 00:30 KST
    const evening = Date.UTC(2026, 7, 9, 10, 0, 0) // 8/9 19:00 KST
    expect(kstDayIndex(morning)).toBe(kstDayIndex(evening))
  })
})
