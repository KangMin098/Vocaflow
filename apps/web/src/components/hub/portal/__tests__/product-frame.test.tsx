// apps/web/src/components/hub/portal/__tests__/product-frame.test.tsx
//
// **제품 액자의 「살아 있는」 조각들이 실제로 그려지는가** (tines-mapping §29-5).
//
// ── 왜 캡처로 못 보고 테스트로 보나 (실측 2026-09-23) ──────────────────
// 「오늘의 흐름」 레일은 `model.steps.length > 0` 일 때만 그려진다 — 미진단 학습자에게는
// **없는 계단을 그리지 않는다**(`wayfinder.ts` 의 설계). 그런데 이 저장소의 검증 계정 둘
// (`runtime-test-*` · `lexicon-test`)은 **둘 다 진단 전**이라, 화면 캡처에는 그 레일이
// 아예 안 나온다. 흐르는 연결선과 「지금 할 차례」 숨쉬는 점은 **캡처로 확인할 수 없다.**
// 계정 데이터를 바꿔서 한 번 찍는 것보다, 조건을 세워 두고 **매번** 확인하는 쪽이 싸다.
//
// 여기서 보는 것은 셋이다:
//   ① 단계가 둘 이상일 때만 연결선(`.vf-flow`)이 생긴다 — 하나뿐이면 「이을 것」이 없다.
//   ② 숨쉬는 점(`.vf-breathe`)은 **지금 할 차례 하나에만** 붙는다(끝난 단계엔 체크가 붙는다).
//   ③ 진입 연출(`.vf-rise` · `.vf-arc` · `.vf-grow`)이 액자·숫자·도넛·막대에 붙어 있다.
//
// 모션 규칙 자체(언제 꺼지나 · 캡처는 어떻게 세우나)는 `lib/a11y/__tests__/motion-contract`
// 가 CSS 쪽에서 본다. 이 파일은 **클래스가 붙는 자리**만 본다 — 둘 다 있어야 계약이 닫힌다.

import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))
vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: (p: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...p} />,
}))
vi.mock('@/lib/analytics/client', () => ({ track: vi.fn() }))

import { computeReach } from '@/lib/learner/reach-math'
import { forecastMemory } from '@/lib/learner/memory-forecast'
import { buildWayfinder } from '@/lib/learner/wayfinder'
import type { PortalBook } from '@/lib/learner/hub-portal-query'

import { ProductFrame } from '../sections'

const DAY = 86_400_000
const NOW = new Date('2026-09-05T03:00:00.000Z')
const BOOKS = [0, 0, 10, 9, 1, 2, 15, 88, 149, 38, 0, 0]

const BLOCKS = [
  { key: 'review', name: '복습', headline: '기억이 흐려진 11개를 다시 만나요', href: '/flashcard/play', done: true, locked: false },
  { key: 'listen', name: '듣기', headline: '원어민 음성을 따라 소리 내어 읽어요', href: '/library/books', done: false, locked: false },
  { key: 'read', name: '읽기', headline: '오늘의 지문을 읽어요', href: '/library/books', done: false, locked: false },
] as const

const forecast = forecastMemory(
  Array.from({ length: 9 }, () => ({ stability: 2, last_review_at: new Date(NOW.getTime() - 4 * DAY).toISOString() })),
  NOW,
  7,
)

function model(blocks: readonly (typeof BLOCKS)[number][] = BLOCKS) {
  return buildWayfinder({
    blocks,
    isDiagnosed: true,
    pathname: '/hub',
    reach: computeReach(BOOKS, 312, 7),
    forecast,
    past: { activeDays: 4, prevActiveDays: 2, streak: 3 },
    counts: { attention: 11, fresh: 8 },
  })
}

const PORTAL_BOOKS: PortalBook[] = [
  { id: 'b1', title: 'Clarissa', author: 'Samuel Richardson', cover: 'https://example.test/1.jpg', cefr: 'B2', minutes: 120 },
  { id: 'b2', title: 'Don Quixote', author: 'Cervantes', cover: 'https://example.test/2.jpg', cefr: 'C1', minutes: 90 },
]

const FACTS = { books: 312, articles: 250, comics: 106, curatedSets: 55 }

const html = (blocks?: readonly (typeof BLOCKS)[number][]) =>
  renderToString(<ProductFrame model={model(blocks)} books={PORTAL_BOOKS} facts={FACTS} />)

describe('제품 액자 — 살아 있는 조각 (tines-mapping §29-5)', () => {
  it('① 단계가 둘 이상이면 흐르는 연결선이 생긴다', () => {
    expect(html()).toContain('vf-flow')
  })

  it('① 단계가 하나뿐이면 연결선은 없다 — 이을 것이 없다', () => {
    expect(html([BLOCKS[1]])).not.toContain('vf-flow')
  })

  it('② 숨쉬는 점은 「지금 할 차례」 하나에만 붙는다', () => {
    const out = html()
    expect(out.match(/vf-breathe/g) ?? []).toHaveLength(1)
  })

  it('② 끝난 단계에는 점 대신 체크가 붙는다', () => {
    // 세 단계 전부 끝난 날 — 지금 할 차례가 없으므로 숨쉬는 점도 없다.
    const allDone = BLOCKS.map((b) => ({ ...b, done: true }))
    expect(html(allDone)).not.toContain('vf-breathe')
  })

  it('③ 진입 연출이 액자·숫자·도넛·막대에 붙어 있다', () => {
    const out = html()
    expect(out, '액자와 KPI 숫자와 표 행').toContain('vf-rise')
    expect(out, '기억 도넛의 호').toContain('vf-arc')
    expect(out, '예보 막대').toContain('vf-grow')
  })

  it('③ 도넛 호는 자리잡기용 `strokeDashoffset` 를 잃지 않는다', () => {
    // `.vf-arc` 는 시작 지점만 밀어 숨긴다 — 기하를 덮으면 조각이 엉뚱한 각도에 붙는다.
    const out = html()
    expect(out).toMatch(/--arc-offset:[^;"]+/)
    expect(out).toMatch(/--arc-len:[^;"]+/)
    expect(out).toMatch(/stroke-dasharray/)
  })
})
