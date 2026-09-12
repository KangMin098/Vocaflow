// apps/web/src/components/home/__tests__/TodayReading.test.tsx
//
// 오늘 읽을 것 — **지면 배분 재설계(v06.204)의 계약**.
//
// 이 섹션이 생긴 이유는 계측이었다: 관문의 51%(388px)를 누를 수도 없는 단어 목록이 쓰는 동안,
// 처방이 골라 둔 오늘의 글 5편은 **제목조차 화면에 없었다**(흐름 목록엔 `Read · 30분` 뿐).
// 그래서 여기서 지키는 것은 "무엇을 읽는지 학습자가 알 수 있는가" 와,
// 그것이 **무대의 단일 CTA 를 침범하지 않는가** 둘이다.

import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import type { PrescriptionCandidate } from '@/lib/learner/prescription-actions'

import { TodayReading } from '../TodayReading'

// 클라이언트 컴포넌트의 useRouter 는 라우터 컨텍스트 밖 renderToString 에서 throw — 스텁
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
}))
vi.mock('@/lib/articles/start-learning', () => ({
  startArticleLearning: vi.fn(),
}))

function cand(over: Partial<PrescriptionCandidate> = {}): PrescriptionCandidate {
  return {
    kind: 'article',
    id: 'a1',
    title: 'Bald eagle',
    vLevel: 5,
    register: 'expository',
    cefrLevel: 'B2',
    ...over,
  }
}

describe('무엇을 읽는지 알 수 있다', () => {
  it('제목을 그대로 세운다 — `Read · 30분` 은 개수와 같은 것이다', () => {
    const html = renderToString(<TodayReading candidates={[cand()]} />)
    expect(html).toContain('Bald eagle')
  })

  it('수준과 성격을 함께 보여준다 (고를 수 있어야 한다)', () => {
    const html = renderToString(<TodayReading candidates={[cand()]} />)
    expect(html).toContain('B2')
    // register 한국어 라벨은 레지스트리(`lib/articles/source-guide`) 소유 — 화면에서 짓지 않는다
    expect(html).toContain('설명')
    expect(html).not.toContain('expository')
  })

  it('메타가 없으면 그 줄을 만들지 않는다 (빈 구분자를 인쇄하지 않는다)', () => {
    const html = renderToString(
      <TodayReading candidates={[cand({ cefrLevel: null, register: null })]} />,
    )
    expect(html).toContain('Bald eagle')
    expect(html).not.toContain(' · ')
  })
})

describe('인지 부하 — 고르는 자리에 다섯은 많다', () => {
  it('후보가 많아도 3편만 보여준다', () => {
    const many = Array.from({ length: 5 }, (_, i) =>
      cand({ id: `a${i}`, title: `Article ${i}` }),
    )
    const html = renderToString(<TodayReading candidates={many} />)
    expect(html).toContain('Article 0')
    expect(html).toContain('Article 2')
    expect(html).not.toContain('Article 3')
    expect(html).not.toContain('Article 4')
  })

  it('후보가 없으면 섹션을 통째로 그리지 않는다', () => {
    expect(renderToString(<TodayReading candidates={[]} />)).toBe('')
  })
})

describe('단일 CTA 를 침범하지 않는다', () => {
  it('행을 채워진 버튼으로 만들지 않는다 — 1차 행동은 무대의 "지금 시작" 하나다', () => {
    const html = renderToString(<TodayReading candidates={[cand()]} />)
    expect(html).not.toContain('bg-[var(--p)]')
    expect(html).not.toContain('rounded-ios-pill')
  })
})

describe('진입 경로가 종류에 따라 다르다', () => {
  it('도서는 URL 직결', () => {
    const html = renderToString(
      <TodayReading candidates={[cand({ kind: 'book', id: 'bk1', title: 'Pride' })]} />,
    )
    expect(html).toContain('/library/books/bk1')
  })

  it('글(article)은 링크를 만들지 않는다 — texts 행 변환이 먼저다', () => {
    // `startArticleLearning` 이 texts 행을 만들기 전에는 주소가 없다. 링크로 두면 404 를 판다.
    const html = renderToString(<TodayReading candidates={[cand({ id: 'ar1' })]} />)
    expect(html).not.toContain('href="/text/ar1"')
    expect(html).toContain('<button')
  })
})
