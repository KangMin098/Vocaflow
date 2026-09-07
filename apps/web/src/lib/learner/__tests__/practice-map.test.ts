// apps/web/src/lib/learner/__tests__/practice-map.test.ts
//
// `/practice` 가 파는 링크가 **실제로 열리는지** 를 잠근다.
//
// 왜 이 락이 필요한가: 매핑이 `GAME_CATALOG.layer` 문자열에서 파생하므로, 게임을 추가하거나
// layer 표기를 바꾸면 연습 카드는 **조용히** 달라진다. 링크가 죽어도 화면은 멀쩡히 뜬다.
// 이 프로젝트에서 반복해 나온 실패 형태가 정확히 그것이다(빈 화면·죽은 링크·틀린 숫자).

import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { FACET_ORDER } from '@/lib/framework/axes'
import { GAME_CATALOG } from '@/lib/game/catalog'
import { gameLabCount, PRACTICE_HREF, practiceToolsByFacet } from '@/lib/learner/practice-map'

const APP = path.resolve(__dirname, '../../../app')

/** 라우트가 파일시스템에 존재하는가 — `/play/x?from=…` → `app/(app)/play/x/page.tsx` */
function routeExists(href: string): boolean {
  const seg = href.split('?')[0].replace(/^\//, '')
  const groups = ['(app)', '(main)', '']
  return groups.some((g) => fs.existsSync(path.join(APP, g, seg, 'page.tsx')))
}

describe('practice-map', () => {
  const tools = practiceToolsByFacet()

  it('모든 면이 최소 한 개의 연습 도구를 갖는다', () => {
    // 하나라도 비면 화면이 "아직 전용 연습이 없어요" 로 떨어진다 — 그 문구가 맞는 순간에만
    // 나와야 한다. v1 은 게임을 못 보고 세 면에 대해 틀린 말을 했다.
    const empty = FACET_ORDER.filter((f) => tools[f].length === 0)
    expect(empty).toEqual([])
  })

  it('모든 도구 링크가 실제 라우트로 열린다', () => {
    const dead = FACET_ORDER.flatMap((f) => tools[f])
      .map((t) => t.href)
      .filter((href) => !routeExists(href))
    expect(dead).toEqual([])
  })

  it('같은 도구가 한 면 안에 중복되지 않는다', () => {
    for (const f of FACET_ORDER) {
      const hrefs = tools[f].map((t) => t.href)
      expect(new Set(hrefs).size, `${f} 중복`).toBe(hrefs.length)
    }
  })

  it('Game Lab 수는 /arcade 가 보여주는 수와 같다', () => {
    // arcade 는 베타를 뱃지만 붙이고 걸러내지 않는다 — 링크 문구가 그 뒤를 정확히 말해야 한다
    expect(gameLabCount()).toBe(GAME_CATALOG.length)
  })

  it('게임 링크는 연습으로 돌아오는 from 을 싣는다', () => {
    // 없으면 게임 종료가 `/arcade` 로 튕긴다 — 통합 화면이 자기가 연 문 뒤를 잃는다
    const games = FACET_ORDER.flatMap((f) => tools[f]).filter((t) => t.isGame)
    for (const t of games) {
      expect(new URL(t.href, 'http://x').searchParams.get('from'), t.href).toBe(PRACTICE_HREF)
    }
  })

  it('연습에 뜨는 게임은 학습자 자기 단어를 쓴다', () => {
    // 은행(bank) 단어 게임을 "연습" 으로 팔면 내 단어가 안 도는데 돌았다고 착각하게 된다
    const bySlug = new Map(GAME_CATALOG.map((g) => [`/play/${g.slug}`, g]))
    const games = FACET_ORDER.flatMap((f) => tools[f]).filter((t) => t.isGame)
    expect(games.length).toBeGreaterThan(0)
    for (const t of games) {
      const g = bySlug.get(t.href.split('?')[0])
      expect(g, `${t.href} 카탈로그에 없음`).toBeDefined()
      expect(g!.source, `${g!.name}`).toBe('mine')
      expect(g!.beta ?? false, `${g!.name} 베타`).toBe(false)
    }
  })
})
