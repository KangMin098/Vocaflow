// apps/web/src/components/practice/__tests__/textbook-practice-scope.test.tsx
// 교재 연습 조회 경로 안내 — 공통 풀은 안내 · 명시 선택 전에 문항을 그리지 않고, 권 경로도 인쇄본 일치를 약속하지 않는다.
import fs from 'node:fs'
import path from 'node:path'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DcpItem } from '@/lib/learner/dcp'

const h = vi.hoisted(() => ({
  chosen: false,
  dcp: [] as Array<Record<string, unknown>>,
  actions: { gradeDcpItem: vi.fn(), recordDcpErrorCause: vi.fn() },
}))
vi.mock('@/lib/learner/dcp-actions', () => h.actions)
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')
  return {
    ...actual,
    // chosen(false 초기값)만 심는다
    useState: (init: unknown) => actual.useState(init === false && h.chosen ? true : init),
  }
})
vi.mock('@/components/practice/DcpPlayer', () => ({
  DcpPlayer: (p: Record<string, unknown>) => {
    h.dcp.push(p)
    return null
  },
}))

import {
  COMMON_POOL_CTA,
  COMMON_POOL_LIMIT,
  COMMON_POOL_NOTICE,
  TEXTBOOK_DONE_REVISIT,
  TextbookPracticeScope,
  VOLUME_SCOPE_NOTE,
  textbookPracticeDoneCopy,
} from '../TextbookPracticeScope'

type DoneCopy = (s: { total: number; correct: number }) => { title: string; body: string }

const ITEMS: DcpItem[] = [{ id: 'o1', type: 'order', paragraphIdx: 0, payload: { presented: ['A.', 'B.', 'C.'] } }]
const render = (scope: 'volume' | 'legacy_v_level' | null, chosen = false) => {
  h.chosen = chosen
  return renderToString(<TextbookPracticeScope items={ITEMS} scope={scope} backHref="/library/textbooks/vocab/5" backCta="이 교재로 돌아가기" />)
}

beforeEach(() => {
  h.dcp = []
  h.actions.gradeDcpItem.mockClear()
  h.actions.recordDcpErrorCause.mockClear()
})

describe('TextbookPracticeScope', () => {
  it('공통 풀 · 선택 전: 안내 두 줄 + 명시 선택 44px + 권 복귀, 문항(플레이어) 없음', () => {
    const html = render('legacy_v_level')
    expect(html).toContain(COMMON_POOL_NOTICE)
    expect(html).toContain(COMMON_POOL_LIMIT)
    expect(html).toMatch(new RegExp(`<button[^>]*min-h-\\[44px\\][^>]*focus-visible:ring-2[^>]*>${COMMON_POOL_CTA}</button>`))
    expect(html).toContain('href="/library/textbooks/vocab/5"')
    expect(h.dcp).toHaveLength(0)
  })
  it('공통 풀 · 선택 뒤: 같은 문항 · 기본 서버 채점 · revisit 기본 끔, 안내는 남는다', () => {
    const html = render('legacy_v_level', true)
    expect(html).toContain(COMMON_POOL_LIMIT)
    expect(h.dcp).toHaveLength(1)
    expect(h.dcp[0]!.items).toBe(ITEMS)
    expect(h.dcp[0]!.grade).toBeUndefined()
    expect(h.dcp[0]!.revisit).toBe(false)
    expect(h.dcp[0]!.backHref).toBe('/library/textbooks/vocab/5')
  })
  it('경로 미확인(null)은 권 전용으로 낙관하지 않는다 — 공통 풀처럼 선택 먼저', () => {
    const html = render(null)
    expect(html).toContain(COMMON_POOL_CTA)
    expect(html).not.toContain(VOLUME_SCOPE_NOTE)
    expect(h.dcp).toHaveLength(0)
  })
  it('권 경로: 수준 · 유형 기준 안내와 바로 플레이어 — 인쇄본 일치를 약속하지 않는다', () => {
    const html = render('volume')
    expect(html).toContain(VOLUME_SCOPE_NOTE)
    expect(html).not.toContain(COMMON_POOL_CTA)
    expect(h.dcp).toHaveLength(1)
    expect(html).not.toMatch(/수록 문제(예요|입니다)|교재와 같은 문제/)
  })
  it('렌더 · 선택은 채점 · 원인 기록을 부르지 않는다', () => {
    render('legacy_v_level')
    render('legacy_v_level', true)
    render('volume')
    expect(h.actions.gradeDcpItem).not.toHaveBeenCalled()
    expect(h.actions.recordDcpErrorCause).not.toHaveBeenCalled()
  })
  it('완료 문구: 맞힌 수 + 관측 범위만 — 실력 향상을 말하지 않고, 다시 보기는 켜졌을 때만', () => {
    for (const scope of ['volume', 'legacy_v_level'] as const) {
      h.dcp = []
      h.chosen = true
      renderToString(<TextbookPracticeScope items={ITEMS} scope={scope} backHref="/b" backCta="돌아가기" revisit />)
      renderToString(<TextbookPracticeScope items={ITEMS} scope={scope} backHref="/b" backCta="돌아가기" />)
      const [on, off] = h.dcp.map((p) => (p.doneCopy as DoneCopy)({ total: 5, correct: 3 }))
      expect(on!.title).toBe('5문항 중 3문항을 맞혔어요')
      expect(on!.body).toContain(TEXTBOOK_DONE_REVISIT)
      expect(off!.body).not.toContain(TEXTBOOK_DONE_REVISIT)
      for (const c of [on!, off!]) {
        expect(c.body).not.toContain('꾸준함')
        expect(c.body).not.toMatch(/실력이 (늘|돼|올라)/)
      }
    }
    expect(textbookPracticeDoneCopy({ total: 2, correct: 0 }).body).toBe(
      '교재 수준에 맞춰 고른 안내 연습이었어요. 이번 문항의 결과일 뿐 실력이 달라졌는지를 잰 것은 아니에요.',
    )
  })
})

describe('DcpPlayer 기본 완료 문구는 다른 caller 를 위해 그대로', () => {
  it('DcpPlayer 원문의 기본 격려 · doneCopy 분기가 바뀌지 않았다', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../DcpPlayer.tsx'), 'utf8')
    expect(src).toContain('`${total}문항 중 ${correctCount}문항을 맞혔어요. 꾸준함이 실력이 돼요.`')
    expect(src).toContain('custom ? custom.body :')
  })
})

describe('교재 연습 페이지 배선 · 낡은 문구', () => {
  const page = fs.readFileSync(path.resolve(__dirname, '../../../app/(main)/library/textbooks/[series]/[step]/practice/page.tsx'), 'utf8')
  it('loader 의 scope · ownerId 를 계정 경계(TextbookPracticeBridge)로 넘기고 DcpPlayer · revisit 을 직접 쓰지 않는다', () => {
    expect(page).toContain('const { items, unavailable, signedOut, scope, ownerId } = await fetchTextbookPracticeItems')
    expect(page).toContain('items.length > 0 && ownerId ?')
    expect(page).toMatch(/<TextbookPracticeBridge\s+items=\{items\}\s+scope=\{scope\}\s+ownerId=\{ownerId\}/)
    expect(page).not.toContain('<DcpPlayer')
    expect(page).not.toContain('<TextbookPracticeScope')
    expect(page).not.toMatch(/revisit/)
  })
  it('「순서·삽입만」 안내가 남지 않는다', () => {
    expect(page).not.toContain('순서·삽입 문항')
    expect(page).not.toContain('계단의 순서·삽입')
  })
})
