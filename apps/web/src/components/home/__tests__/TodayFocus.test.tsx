// apps/web/src/components/home/__tests__/TodayFocus.test.tsx
//
// 첫 방문 지면 — **검증 계정에서 절대 렌더되지 않는 화면**의 회귀.
//
// `/hub` 은 `!isDiagnosed` 일 때만 이 지면을 부르는데 검증 계정은 진단 완료(V11)다.
// 즉 런타임 캡처로는 볼 수 없고, 실제로 그 사각지대에서 **다크모드 흰 바탕 + 흰 글자**
// (대비 1.05:1)가 오래 살아남았다. 눈으로 못 보는 화면은 단언으로 지킨다.
//
// v06.203 부터 이 지면의 계약은 하나 더 늘었다: **가치를 게이트 뒤에 두지 않는다.**
// 단어가 진단 제안보다 먼저 와야 한다(순서가 뒤집히면 다시 시험이 된다).

import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { TasteWord } from '@/lib/learner/taste-word'

import { TodayFocus } from '../TodayFocus'

const WORD: TasteWord = {
  word: 'resilient',
  meaningKo: '회복력 있는',
  exampleEn: 'She proved remarkably resilient.',
  cefr: 'B1',
  rank: 2431,
}

const withWord = renderToString(<TodayFocus word={WORD} />)
const noWord = renderToString(<TodayFocus word={null} />)

describe('가치를 게이트 뒤에 두지 않는다 (v06.203 핵심 계약)', () => {
  it('단어·뜻·예문을 실제로 그린다 — 어휘 제품의 첫 화면에 단어가 있어야 한다', () => {
    expect(withWord).toContain('resilient')
    expect(withWord).toContain('회복력 있는')
    expect(withWord).toContain('She proved remarkably resilient.')
  })

  it('단어가 진단 제안보다 **먼저** 온다', () => {
    // 순서가 뒤집히면 다시 "시험 먼저" 가 된다. 위치로 잠근다.
    expect(withWord.indexOf('resilient')).toBeLessThan(withWord.indexOf('5분 시작하기'))
  })

  it('진단 없이 갈 곳을 함께 판다 (게이트가 아님을 화면이 증명한다)', () => {
    expect(withWord).toContain('먼저 둘러보기')
    expect(withWord).toContain('/library')
    expect(withWord).toContain('진단 없이도')
  })

  it('빈도 순위를 학습자 말로 옮긴다', () => {
    expect(withWord).toContain('자주 쓰는 순')
    expect(withWord).toContain('2,431')
  })
})

describe('단어를 못 고른 경우', () => {
  it('없는 단어를 지어내지 않고 제안만 남긴다', () => {
    expect(noWord).not.toContain('오늘 만나 볼 단어')
    expect(noWord).toContain('5분이면 오늘 읽을 것이 정해져요')
    expect(noWord).toContain('/diagnostic')
  })
})

describe('테마 안전성 (하드코딩 금지)', () => {
  it('색을 hex 로 하드코딩하지 않는다', () => {
    // `#F5F3FF` 배경 + `var(--t1)` 글자 조합이 다크에서 흰 글자를 흰 배경에 얹었다.
    for (const html of [withWord, noWord]) {
      expect(html).not.toMatch(/#[0-9a-fA-F]{6}/)
      expect(html).not.toMatch(/#[0-9a-fA-F]{3}\b/)
    }
  })

  it('배경·글자를 모두 토큰으로 잡는다', () => {
    expect(withWord).toContain('bg-[var(--bg)]')
    expect(withWord).toContain('text-[var(--t1)]')
  })

  it('Admin 전용 보라 액센트를 쓰지 않는다', () => {
    for (const purple of ['#AF52DE', '#5856D6', '#8B5CF6', '#6D28D9']) {
      expect(withWord).not.toContain(purple)
    }
  })
})

describe('처음 온 사람에게 하는 말', () => {
  it('내부 용어(V-Level)로 설명하지 않는다', () => {
    expect(withWord).not.toContain('V-Level')
    expect(withWord).not.toContain('12단계')
  })

  it('틀려도 괜찮다는 것을 알린다 (진단을 시험으로 만들지 않는다)', () => {
    expect(withWord).toContain('맞히지 못해도 괜찮아요')
  })

  it('조사를 손으로 붙이지 않는다 — 옛 문구의 "스크립트을" 재발 방지', () => {
    expect(withWord).not.toContain('스크립트을')
  })
})

describe('접근성', () => {
  it('CTA 는 44px 이상이다', () => {
    expect(withWord).toMatch(/min-h-\[48px\]/)
  })

  it('2차 링크도 44px 이상이다', () => {
    expect(withWord).toMatch(/min-h-\[44px\]/)
  })
})
