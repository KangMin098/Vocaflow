// apps/web/src/components/home/__tests__/TodayFocus.test.tsx
//
// 첫 방문 카드 — **검증 계정에서 절대 렌더되지 않는 화면**의 회귀.
//
// `/hub` 은 `!isDiagnosed` 일 때만 이 카드를 부르는데 검증 계정은 진단 완료(V11)다.
// 즉 런타임 캡처로는 이 화면을 볼 수 없고, 실제로 그 사각지대에서
// **다크모드 흰 바탕 + 흰 글자**(대비 1.05:1)가 오래 살아남았다.
// 눈으로 못 보는 화면은 단언으로 지킨다.

import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { TodayFocus } from '../TodayFocus'

const html = renderToString(<TodayFocus />)

describe('TodayFocus — 테마 안전성 (하드코딩 금지)', () => {
  it('색을 hex 로 하드코딩하지 않는다', () => {
    // `#F5F3FF` 배경 + `var(--t1)` 글자 조합이 다크에서 흰 글자를 흰 배경에 얹었다.
    // hex 리터럴이 하나라도 있으면 그 조합이 다시 생길 수 있다.
    expect(html).not.toMatch(/#[0-9a-fA-F]{6}/)
    expect(html).not.toMatch(/#[0-9a-fA-F]{3}\b/)
  })

  it('배경·글자를 모두 토큰으로 잡는다 (테마가 뒤집혀도 짝이 유지된다)', () => {
    expect(html).toContain('bg-[var(--bg)]')
    expect(html).toContain('text-[var(--t1)]')
  })

  it('Admin 전용 보라 액센트를 쓰지 않는다', () => {
    for (const purple of ['#AF52DE', '#5856D6', '#8B5CF6', '#6D28D9']) {
      expect(html).not.toContain(purple)
    }
  })
})

describe('TodayFocus — 처음 온 사람에게 하는 말', () => {
  it('내부 용어(V-Level)로 설명하지 않는다', () => {
    expect(html).not.toContain('V-Level')
    expect(html).not.toContain('12단계')
  })

  it('무엇을 얻는지 말한다', () => {
    expect(html).toContain('5분이면 오늘 읽을 것이 정해져요')
  })

  it('틀려도 괜찮다는 것을 알린다 (진단을 시험으로 만들지 않는다)', () => {
    expect(html).toContain('맞히지 못해도 괜찮아요')
  })

  it('조사를 손으로 붙이지 않는다 — 옛 문구의 "스크립트을" 재발 방지', () => {
    expect(html).not.toContain('스크립트을')
    expect(html).not.toContain('스크립트')
  })
})

describe('TodayFocus — 접근성', () => {
  it('CTA 는 44px 이상이다', () => {
    expect(html).toMatch(/min-h-\[48px\]/)
  })

  it('진단으로 보낸다', () => {
    expect(html).toContain('/diagnostic')
  })
})
