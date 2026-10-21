// apps/web/src/components/layout/__tests__/learner-color-scope.test.tsx
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const route = vi.hoisted(() => ({ pathname: '/hub' as string | null }))
vi.mock('next/navigation', () => ({ usePathname: () => route.pathname }))
import { LearnerColorScope, usesLearnerColors } from '../LearnerColorScope'
import { getLearnerColorRole, getLearnerPalette } from '@/lib/design/learner-palette'
import { GAME_CATALOG, trackOf } from '@/lib/game/catalog'

describe('PC 학습자 색 범위', () => {
  it.each(['/admin', '/admin/library', '/csat', '/csat/diagnosis', '/dev/example', '/api/search', null])('3B/개발/미확인 경로 %s에는 적용하지 않는다', pathname => {
    expect(usesLearnerColors(pathname)).toBe(false)
  })
  it.each(['/', '/hub', '/library/books', '/text/a', '/play/wordblitz', '/login'])('학습자 경로 %s를 포함한다', pathname => {
    expect(usesLearnerColors(pathname)).toBe(true)
  })
  it.each([
    ['/library/books/one', '/library/books', 'green'],
    ['/library/scripts/one', '/library/scripts', 'peach'],
    ['/wordvault/browse', '/wordvault', 'pink'],
    ['/library/textbooks/series/step', '/library/textbooks', 'lavender'],
    ['/comics/adapted/one', '/comics', 'yellow'],
    ['/dictate/one', '/dictate', 'teal'],
    ['/login', '/privacy', 'neutral'],
  ])('상세·세션 %s는 같은 기능 %s의 색 역할을 유지한다', (detail, list, palette) => {
    expect(getLearnerPalette(detail)).toBe(palette)
    expect(getLearnerPalette(list)).toBe(palette)
  })
  it('하위 학습 작업과 게임의 경계를 구분한다', () => {
    expect(getLearnerPalette('/text/book/echo')).toBe('teal')
    expect(getLearnerPalette('/text/book/comic')).toBe('yellow')
    route.pathname = '/play/connections'
    const markup = renderToString(<LearnerColorScope />)
    expect(markup).toContain('data-learner-pc-palette="peach"')
    expect(markup).toContain('data-learner-pc-mode="game"')
    route.pathname = '/wordvault'
    expect(renderToString(<LearnerColorScope />)).toContain('data-learner-pc-palette="pink"')
    expect(renderToString(<LearnerColorScope />)).toContain('data-learner-pc-mode="page"')
  })
  it.each([
    [['/flashcard', '/pairflip', '/wordblitz'], 'lavender', 'recall'],
    [['/spellforge', '/play/morphmerge', '/play/letter-forge'], 'yellow', 'produce'],
    [['/scriptquiz', '/practice/dcp', '/play/connections'], 'peach', 'reason'],
    [['/dashboard', '/reports', '/plan'], 'teal', 'reflect'],
  ] as const)('같은 학습 목적 %s은 같은 계열을 쓴다', (paths, palette, group) => {
    for (const path of paths) expect(getLearnerColorRole(path)).toMatchObject({ palette, group })
  })
  it('게임 카탈로그의 실제 트랙을 그대로 재사용한다', () => {
    for (const game of GAME_CATALOG) {
      const group = trackOf(game.slug)
      expect(getLearnerColorRole(`/play/${game.slug}`)).toMatchObject({ group, palette: { recall: 'lavender', produce: 'yellow', reason: 'peach' }[group], attention: 'focus' })
    }
    expect(getLearnerColorRole('/play/__proto__')).toMatchObject({ palette: 'neutral', group: 'overview' })
  })
  it('같은 활동도 고르기와 실제 반복 작업면의 색 면적을 구분한다', () => {
    expect(getLearnerColorRole('/flashcard')).toMatchObject({ cadence: 'frequent', attention: 'browse', priority: 'core' })
    expect(getLearnerColorRole('/flashcard/play/')).toMatchObject({ palette: 'lavender', attention: 'focus' })
    expect(getLearnerColorRole('/text/book')).toMatchObject({ attention: 'focus', cadence: 'frequent' })
    expect(getLearnerColorRole('/text/new')).toMatchObject({ attention: 'browse' })
    expect(getLearnerColorRole('/wordvault/review')).toMatchObject({ group: 'recall', palette: 'lavender', attention: 'focus' })
    expect(getLearnerColorRole('/library/textbooks/series/step/practice')).toMatchObject({ group: 'reason', palette: 'peach', attention: 'focus' })
    expect(getLearnerColorRole('/settings')).toMatchObject({ palette: 'neutral', priority: 'support', cadence: 'occasional' })
  })
  it('학습자에서 3B로 이동하면 포털까지 포함한 색 표식을 제거한다', () => {
    route.pathname = '/hub'
    expect(renderToString(<LearnerColorScope />)).toContain('data-learner-pc-color="tines"')
    route.pathname = '/csat'
    expect(renderToString(<LearnerColorScope />)).toBe('')
    route.pathname = '/admin/users'
    expect(renderToString(<LearnerColorScope />)).toBe('')
  })
})
