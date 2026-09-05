// apps/web/src/components/layout/__tests__/compass-ribbon.test.tsx
//
// 나침반 띠 **렌더 회귀** — 모델이 맞아도 화면이 안 그리면 아무 일도 안 일어난다.
//
// 옆 파일 `wayfinder.test.ts` 는 *모델*이 여섯 질문에 답하는지를 잰다. 여기서는 그 답이
// **실제 HTML 에 나오는지**와, 셸이 지켜야 하는 제약(진행에 퍼센트 금지 · 상시 층은 CTA 하나 ·
// 학습 세션에서는 통째로 사라짐 · 44px 터치 타깃)이 살아 있는지를 본다.

import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const nav = vi.hoisted(() => ({ pathname: '/library/books' }))

vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }))

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

// 계측은 브라우저 전용이다 — 서버 렌더에서 부르지 않지만, 모듈 로드 자체를 막아 둔다.
vi.mock('@/lib/analytics/client', () => ({ track: vi.fn() }))

import { computeReach } from '@/lib/learner/reach-math'
import { forecastMemory } from '@/lib/learner/memory-forecast'
import type { WayfinderData } from '@/lib/learner/wayfinder-query'

import { CompassRibbon } from '../CompassRibbon'
import { WayfinderPanel } from '../WayfinderPanel'
import { buildWayfinder } from '@/lib/learner/wayfinder'

const DAY = 86_400_000
const NOW = new Date('2026-09-05T03:00:00.000Z')
const BOOKS = [0, 0, 10, 9, 1, 2, 15, 88, 149, 38, 0, 0]

function data(over: Partial<WayfinderData> = {}): WayfinderData {
  return {
    blocks: [
      { key: 'review', name: '복습', headline: '기억이 흐려진 11개를 다시 만나요', href: '/flashcard/play', done: true, locked: false },
      { key: 'listen', name: '듣기', headline: '원어민 음성을 따라 소리 내어 읽어요', href: '/library/books', done: false, locked: false },
      { key: 'read', name: '읽기', headline: '오늘의 지문을 읽어요', href: '/library/books', done: false, locked: false },
    ],
    isDiagnosed: true,
    unavailable: false,
    reach: computeReach(BOOKS, 312, 7),
    forecast: forecastMemory(
      Array.from({ length: 9 }, () => ({
        stability: 2,
        last_review_at: new Date(NOW.getTime() - 4 * DAY).toISOString(),
      })),
      NOW,
      7,
    ),
    past: { activeDays: 4, prevActiveDays: 2, streak: 3 },
    counts: { attention: 11, fresh: 8 },
    ...over,
  }
}

const render = (d: WayfinderData | null = data()) => renderToString(<CompassRibbon data={d} />)

describe('나침반 띠 — 상시 층', () => {
  it('어디에 있는지, 어디까지 왔는지, 지금 무엇을 할지를 함께 말한다', () => {
    const html = render()
    expect(html, 'Q1 위치').toContain('Library')
    expect(html, 'Q2 단계 — 계단 진행').toContain('data-today-progress="1/3"')
    expect(html, 'Q3 방향 — 시점 표지').toContain('다음')
    expect(html, 'Q3 방향 — 문장').toContain('원어민 음성을 따라')
    expect(html, 'Q3 방향 — 버튼').toContain('듣기 시작')
  })

  it('라우트가 바뀌면 위치도 바뀐다 (9곳에서 같은 문자열을 그리던 것이 결함이었다)', () => {
    nav.pathname = '/library/books'
    const library = render()
    nav.pathname = '/dashboard'
    const growth = render()
    nav.pathname = '/library/books'

    expect(library).toContain('Library')
    expect(growth).toContain('Growth')
    expect(library).not.toBe(growth)
  })

  it('상시 층의 CTA 는 하나다 — 셸에서 고르게 하지 않는다', () => {
    const html = render()
    const ctas = html.match(/rounded-\[var\(--r-full\)\] bg-\[var\(--p\)\]/g) ?? []
    expect(ctas).toHaveLength(1)
  })

  it('진행을 퍼센트·게이지로 그리지 않는다 (철학 ④ Implicit Progress)', () => {
    const html = render()
    // 계단 점만 있고 눈에 보이는 분수·퍼센트 텍스트는 없다.
    // (`data-today-progress` 는 회귀가 읽는 자리라 화면에 렌더되지 않는다.)
    const visible = html.replace(/data-today-progress="[^"]*"/g, '')
    expect(visible).not.toMatch(/\d+\s*%/)
    expect(visible).not.toMatch(/>\s*\d+\s*\/\s*\d+\s*</)
  })

  it('상시 층은 연속일을 한 번만 그린다 (ADR 0006 D2)', () => {
    const html = render()
    const hits = html.match(/연속\s*\d+\s*일/g) ?? []
    expect(hits).toHaveLength(1)
  })

  it('연속일이 0이면 그리지 않는다 (0을 보여주는 것은 압박이다 — 철학 ③)', () => {
    const html = render(data({ past: { activeDays: 0, prevActiveDays: 0, streak: 0 } }))
    expect(html).not.toMatch(/연속\s*\d+\s*일/)
  })

  it('상시 층의 링크는 44px 이상 확보한다', () => {
    const html = render()
    const anchors = html.match(/<a [^>]*class="[^"]*"/g) ?? []
    expect(anchors.length).toBeGreaterThan(0)
    for (const a of anchors) {
      expect(a, `44px 미확보: ${a.slice(0, 90)}`).toMatch(/min-h-11/)
    }
  })

  it('「나의 자리」는 접혀 있다 — 폈을 때만 나온다 (철학 ② Progressive Disclosure)', () => {
    const html = render()
    expect(html).toContain('aria-expanded="false"')
    expect(html, '사정권은 접힌 층에 있다').not.toContain('사정권')
  })

  it('비로그인이면 띠 자체가 없다', () => {
    expect(render(null)).toBe('')
  })

  it('학습 세션에서는 셸이 통째로 사라진다 (작업기억 보호)', () => {
    nav.pathname = '/wordvault/browse'
    const html = render()
    nav.pathname = '/library/books'
    expect(html).toBe('')
  })

  it('진단 전에는 계단 대신 진단으로 보낸다', () => {
    const html = render(data({ isDiagnosed: false, blocks: [] }))
    expect(html).toContain('/diagnostic')
    expect(html).toContain('312') // 카탈로그 실측 — 상수를 박지 않는다
    expect(html).not.toContain('data-today-progress')
  })
})

describe('「나의 자리」 — 펼친 층', () => {
  const model = buildWayfinder({
    blocks: data().blocks,
    isDiagnosed: true,
    pathname: '/library/books',
    reach: data().reach,
    forecast: data().forecast,
    past: data().past,
    counts: data().counts,
  })
  const html = renderToString(<WayfinderPanel model={model} unavailable={false} id="p" />)

  it('나머지 세 질문(가치·동기·성장)을 여기서 답한다', () => {
    expect(html, 'Q4 가치 — 열린 책 수').toContain('274')
    expect(html, 'Q4 가치 — 다음 계단').toContain('38')
    expect(html, 'Q5 동기 — 예보 문장').toContain('붙잡아요')
    expect(html, 'Q5 동기 — 곡선').toContain('<svg')
    expect(html, 'Q6 성장').toContain('지난 7일')
  })

  it('곡선은 색만으로 말하지 않는다 — 문장과 aria 가 함께 선다', () => {
    expect(html).toMatch(/role="img"/)
    expect(html).toContain('기억 예보')
  })

  it('이전 띠의 두 칩(다시 볼 · 새 단어)이 사라지지 않고 예보 옆으로 옮겨 왔다', () => {
    expect(html).toContain('/wordvault/browse?filter=state:attention')
    expect(html).toContain('/wordvault/browse?filter=state:new')
  })

  it('처방 실패는 조용히 넘기지 않는다', () => {
    const failed = renderToString(<WayfinderPanel model={model} unavailable id="p" />)
    expect(failed).toContain('계산하지 못했어요')
  })

  it('하드코딩 색이 없다 — 전부 토큰이라 dark 테마가 따라온다', () => {
    expect(html).not.toMatch(/#[0-9a-fA-F]{6}/)
    expect(html).not.toMatch(/rgb\(/)
  })
})
