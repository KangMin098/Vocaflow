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
  GAME_FAMILIES,
  GAME_MARKS,
  HUB_TRACKS,
  MINE_GAMES,
  buildHubItems,
  gamePlayHref,
  hubSections,
  kstDayIndex,
  pickDailyGame,
  trackOf,
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

describe('계열(family) 접기', () => {
  it('계열 키는 GAME_FAMILIES 에 정의돼 있다', () => {
    const known = new Set(GAME_FAMILIES.map((f) => f.key))
    const unknown = GAME_CATALOG.filter((g) => g.family && !known.has(g.family)).map((g) => g.slug)
    expect(unknown, `정의 없는 family: ${unknown.join(', ')}`).toEqual([])
  })

  it('계열 소속 게임은 모드 라벨을 가진다 (칩에 이름이 비면 고를 수 없다)', () => {
    const noLabel = GAME_CATALOG.filter((g) => g.family && !g.modeLabel).map((g) => g.slug)
    expect(noLabel, `modeLabel 누락: ${noLabel.join(', ')}`).toEqual([])
  })

  it('한 계열 안에서 모드 라벨이 겹치지 않는다', () => {
    for (const f of GAME_FAMILIES) {
      const labels = GAME_CATALOG.filter((g) => g.family === f.key).map((g) => g.modeLabel)
      expect(new Set(labels).size, `${f.key} 모드 라벨 중복: ${labels.join(', ')}`).toBe(labels.length)
    }
  })

  it('모드는 modeOrder 순으로 나온다 — 기본 모드가 맨 앞', () => {
    const items = buildHubItems(GAME_CATALOG.filter((g) => g.family === 'blitz'))
    const fam = items.find((i) => i.kind === 'family')
    expect(fam?.kind).toBe('family')
    if (fam?.kind !== 'family') return
    const orders = fam.modes.map((m) => m.modeOrder ?? Number.MAX_SAFE_INTEGER)
    expect(orders).toEqual([...orders].sort((a, b) => a - b))
    // v08.3 — 랩 명명 정렬로 모드 라벨이 영문이 됐다(Classic · Ghost · Economy · Daily).
    expect(fam.modes[0].modeLabel).toBe('Classic')
  })

  it('모든 계열은 멤버가 2개 이상이다 (1개면 접을 이유가 없다)', () => {
    for (const f of GAME_FAMILIES) {
      const n = GAME_CATALOG.filter((g) => g.family === f.key).length
      expect(n, `${f.key} 멤버 ${n}개`).toBeGreaterThanOrEqual(2)
    }
  })

  it('접어도 게임이 사라지지 않는다 — 허브 표시 단위가 전 게임을 정확히 1번씩 담는다', () => {
    const s = hubSections()
    const reached: string[] = []
    for (const item of [...s.recall, ...s.produce, ...s.reason]) {
      if (item.kind === 'game') reached.push(item.game.slug)
      else reached.push(...item.modes.map((m) => m.slug))
    }
    expect(reached.length, `중복 노출: ${reached.length} vs ${GAME_COUNT}`).toBe(GAME_COUNT)
    expect(new Set(reached).size).toBe(GAME_COUNT)
    expect([...reached].sort()).toEqual(GAME_CATALOG.map((g) => g.slug).sort())
  })

  it('계열은 쪼개지지 않는다 — 멤버 전원이 같은 트랙에 있다', () => {
    const s = hubSections()
    const tracks = [s.recall, s.produce, s.reason]
    for (const f of GAME_FAMILIES) {
      const homes = tracks.filter((t) => t.some((i) => i.kind === 'family' && i.family.key === f.key))
      expect(homes.length, `${f.key} 가 0곳 또는 여러 트랙에 있음`).toBe(1)
      const card = homes[0].find((i) => i.kind === 'family' && i.family.key === f.key)
      const members = GAME_CATALOG.filter((g) => g.family === f.key)
      expect(card && card.kind === 'family' ? card.modes.length : 0).toBe(members.length)
    }
  })

  it('접힌 뒤 카드 수가 실제로 줄어든다 (중복 체감 완화의 정량 근거)', () => {
    const s = hubSections()
    expect(s.recall.length + s.produce.length + s.reason.length).toBeLessThan(GAME_COUNT)
  })

  // v07.8 — 분류축이 source(내 단어/뱅크) 에서 학습 동사 트랙으로 바뀌었다.
  // 전 게임이 학습자 단어를 쓰게 되면서 옛 축이 한쪽으로 몰려 죽었기 때문이다.
  it('트랙 분류가 전 게임을 정확히 1번씩 덮는다 (누락·중복 없음)', () => {
    const seen = new Set<string>()
    for (const g of GAME_CATALOG) {
      const t = trackOf(g.slug)
      expect(['recall', 'produce', 'reason'], `${g.slug} 트랙 미지정`).toContain(t)
      expect(seen.has(g.slug)).toBe(false)
      seen.add(g.slug)
    }
    expect(seen.size).toBe(GAME_COUNT)
  })

  it('빈 트랙이 없다 — 섹션이 비면 허브에 죽은 헤딩이 남는다', () => {
    const s = hubSections()
    for (const t of HUB_TRACKS) {
      expect(s[t.key].length, `${t.key} 트랙이 비었다`).toBeGreaterThan(0)
    }
  })

  // BANK_GAMES 가 비면서 pickDailyGame 이 from[NaN] → undefined 로 죽던 회귀.
  // 단어 0개 학습자의 /arcade 가 통째로 크래시했다.
  it('오늘의 추천은 보유 단어 수와 무관하게 항상 실재한다', () => {
    for (const vocab of [0, 1, 5, 6, 40]) {
      for (const day of [0, 1, 7, 12345]) {
        const g = pickDailyGame(day, vocab)
        expect(g, `vocab=${vocab} day=${day}`).toBeTruthy()
        expect(typeof g.slug).toBe('string')
      }
    }
  })

  it('buildHubItems — 멤버가 1개뿐이면 접지 않는다', () => {
    const single = GAME_CATALOG.filter((g) => g.family === 'blitz').slice(0, 1)
    const items = buildHubItems(single)
    expect(items).toHaveLength(1)
    expect(items[0].kind).toBe('game')
  })

  it('buildHubItems — 계열 카드는 첫 멤버 자리에 놓여 정렬이 튀지 않는다', () => {
    const games = GAME_CATALOG.filter((g) => g.source === 'mine')
    const items = buildHubItems(games)
    const firstFamilyMemberIdx = games.findIndex((g) => g.family === 'blitz')
    const familyCardIdx = items.findIndex((i) => i.kind === 'family')
    const before = games.slice(0, firstFamilyMemberIdx).filter((g) => g.family !== 'blitz').length
    expect(familyCardIdx).toBe(before)
  })
})

describe('BGM 커버리지', () => {
  // 트랙 매핑이 gamekit 에 따로 있던 시절 독립 3D 2종(wordblitz·pirate-quest)이
  // 표에서 빠져 영영 무음이었다. 카탈로그로 통합했으니 전수 보유를 강제한다.
  it('모든 게임이 배경음악 트랙을 가진다', () => {
    const silent = GAME_CATALOG.filter((g) => !g.music).map((g) => g.slug)
    expect(silent, `BGM 없는 게임: ${silent.join(', ')}`).toEqual([])
  })

  it('트랙 파일이 실제로 public 에 존재한다 (404 무음 방지)', () => {
    for (const g of GAME_CATALOG) {
      const rel = (g.music as string).replace(/^\//, '')
      const abs = path.resolve(process.cwd(), 'public', rel)
      expect(fs.existsSync(abs), `${g.slug}: ${g.music} 파일 없음`).toBe(true)
    }
  })

  it('트랙 경로 형식이 일관된다', () => {
    for (const g of GAME_CATALOG) {
      expect(g.music, `${g.slug}.music`).toMatch(/^\/audio\/games\/[a-z0-9-]+\.mp3$/)
    }
  })

  // v07.5 — 게임마다 고유 트랙. 재사용은 "또 같은 음악"으로 읽혀 몰입을 깎는다.
  it('트랙이 게임 간 재사용되지 않는다', () => {
    const used = GAME_CATALOG.map((g) => g.music as string)
    const dup = used.filter((m, i) => used.indexOf(m) !== i)
    expect([...new Set(dup)], `재사용 트랙: ${[...new Set(dup)].join(', ')}`).toEqual([])
  })

  // 이전 세트는 8비트 스퀘어파(칩튠)라 "PC 효과음 같은 얇은 느낌"이었다.
  // 오케스트라·시네마틱으로 전면 교체했으므로 칩튠 복귀를 막는다.
  it('칩튠 트랙이 크레딧에 다시 들어오지 않는다', () => {
    const credits = fs.readFileSync(
      path.resolve(process.cwd(), 'public/audio/games/CREDITS.txt'),
      'utf8',
    )
    const chiptune = ['8bit Dungeon Level', 'Bit Quest', 'Bit Shift', 'Awesome Call', 'Bass Walker']
    const back = chiptune.filter((t) => new RegExp(`^\\s*\\w[\\w-]*\\s+"${t}"`, 'm').test(credits))
    expect(back, `칩튠 복귀: ${back.join(', ')}`).toEqual([])
  })

  it('모든 게임이 크레딧에 곡명과 함께 기재돼 있다 (CC-BY 준수)', () => {
    const credits = fs.readFileSync(
      path.resolve(process.cwd(), 'public/audio/games/CREDITS.txt'),
      'utf8',
    )
    const missing = GAME_CATALOG.filter(
      (g) => !new RegExp(`^\\s*${g.slug}\\s+"[^"]+"`, 'm').test(credits),
    ).map((g) => g.slug)
    expect(missing, `크레딧 누락: ${missing.join(', ')}`).toEqual([])
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
  // v07.8 — 이전 단언은 "단어가 충분하면 mine, 부족하면 bank" 였다.
  // 전 게임이 학습자 단어를 쓰게 되면서 bank 후보가 사라졌고, 그 분기를 유지하면
  // 단어 부족 학습자에게 후보 0개 → from[NaN] → undefined 로 /arcade 가 죽는다.
  // 지금은 보유량과 무관하게 고르고, 부족분은 게임 안에서 맛보기로 degrade 한다.
  it('보유 단어 수와 무관하게 항상 실재하는 게임을 고른다', () => {
    for (let d = 0; d < 40; d++) {
      for (const count of [0, 5, 6, 200]) {
        const g = pickDailyGame(d, count)
        expect(g, `day=${d} vocab=${count}`).toBeTruthy()
        expect(GAME_CATALOG.some((x) => x.slug === g.slug)).toBe(true)
      }
    }
  })

  it('추천에는 3D·베타를 올리지 않는다 (모바일 번들·기록 미연동)', () => {
    for (let d = 0; d < 40; d++) {
      const g = pickDailyGame(d, 20)
      expect(g.is3d ?? false, `${g.slug} 가 3D`).toBe(false)
      expect(g.beta ?? false, `${g.slug} 가 베타`).toBe(false)
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
