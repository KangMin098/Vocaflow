// apps/web/src/lib/library/__tests__/media-form.test.ts
//
// 매체 형식 판정 회귀.
//
// 왜 있는가: 판정 **순서**가 규칙이다. 소스를 register 보다 먼저 보면 단신(news)이
// 어학 강의 표지를 달고 나간다 — 실측으로 VOA 가 'As It Is'(news)와
// 'Words and Their Stories'(expository)를 같은 소스로 함께 주기 때문이다.
// 순서를 바꾸는 리팩터가 조용히 통과하지 못하게 여기 못 박는다.

import { describe, expect, it } from 'vitest'

import {
  dominantMediaForm,
  MEDIA_FORMS,
  mediaFormSrLabel,
  resolveMediaForm,
  type MediaForm,
} from '../media-form'

describe('resolveMediaForm — 테이블 우선', () => {
  it('도서·만화·대본은 소스와 무관하게 테이블이 정한다', () => {
    expect(resolveMediaForm({ kind: 'book', source: 'nasa' })).toBe('book')
    expect(resolveMediaForm({ kind: 'comic', source: 'voa' })).toBe('comic')
    expect(resolveMediaForm({ kind: 'text', source: 'the_conversation' })).toBe('script')
  })
})

describe('resolveMediaForm — register 가 소스를 앞선다', () => {
  it("VOA 단신(news)은 어학 강의가 아니라 신문으로 읽는다", () => {
    expect(resolveMediaForm({ kind: 'article', source: 'voa', register: 'news' })).toBe('newspaper')
  })

  it('같은 VOA 라도 해설(expository)은 어학 강의다', () => {
    expect(resolveMediaForm({ kind: 'article', source: 'voa', register: 'expository' })).toBe('lesson')
  })
})

describe('resolveMediaForm — 소스 매핑', () => {
  const cases: Array<[string, MediaForm]> = [
    ['simple_wikipedia', 'reference'],
    ['wikipedia', 'reference'],
    ['factbook', 'reference'],
    ['wikivoyage', 'reference'],
    ['the_conversation', 'magazine'],
    ['owid', 'magazine'],
    ['plos', 'journal'],
    ['elife', 'journal'],
    ['nasa', 'bulletin'],
    ['usgs', 'bulletin'],
    ['noaa', 'bulletin'],
    ['nih', 'bulletin'],
  ]
  for (const [source, form] of cases) {
    it(`${source} → ${form}`, () => {
      expect(resolveMediaForm({ kind: 'article', source })).toBe(form)
    })
  }
})

describe('resolveMediaForm — 미지의 소스', () => {
  it('소스를 모르고 음성이 있으면 강의로 본다', () => {
    expect(resolveMediaForm({ kind: 'article', source: 'unknown_feed', hasAudio: true })).toBe('lesson')
  })

  it('단서가 없으면 매거진(중립 산문)으로 떨어진다 — 백과·학술지로 오인시키지 않는다', () => {
    expect(resolveMediaForm({ kind: 'article' })).toBe('magazine')
    expect(resolveMediaForm({})).toBe('magazine')
  })
})

describe('MEDIA_FORMS 명세', () => {
  it('모든 형식이 라벨·SR명사·액센트·문법을 갖는다 (빈 값 금지)', () => {
    for (const [key, spec] of Object.entries(MEDIA_FORMS)) {
      expect(spec.form).toBe(key)
      expect(spec.label.length).toBeGreaterThan(0)
      expect(spec.srNoun.length).toBeGreaterThan(0)
      expect(spec.grammar.length).toBeGreaterThan(5)
      // 새 색을 만들지 않는다 — 전부 기존 CSS 변수여야 한다.
      expect(spec.accent).toMatch(/^var\(--[a-z-]+\)$/)
    }
  })
})

describe('dominantMediaForm — 트랙 대표 형식', () => {
  it('topic 트랙(기관 4 + 학술지 2)은 기관 발표가 대표다', () => {
    expect(dominantMediaForm(['nasa', 'nih', 'elife', 'plos', 'usgs', 'noaa'])).toBe('bulletin')
  })

  it('단일 소스 트랙은 그 소스의 형식', () => {
    expect(dominantMediaForm(['simple_wikipedia'])).toBe('reference')
    expect(dominantMediaForm(['voa'])).toBe('lesson')
  })

  it('동수면 입력 순서가 앞선 형식 — 표지가 호출마다 흔들리지 않는다', () => {
    expect(dominantMediaForm(['plos', 'nasa'])).toBe('journal')
    expect(dominantMediaForm(['nasa', 'plos'])).toBe('bulletin')
  })

  it('빈 배열·미지 소스만 있으면 매거진', () => {
    expect(dominantMediaForm([])).toBe('magazine')
    expect(dominantMediaForm(['nope', 'also_nope'])).toBe('magazine')
  })
})

describe('mediaFormSrLabel — 텍스트 대안', () => {
  it('시각 표시가 aria-hidden 이므로 절대 빈 문자열이 아니다', () => {
    for (const form of Object.keys(MEDIA_FORMS) as MediaForm[]) {
      expect(mediaFormSrLabel(form).length).toBeGreaterThan(0)
    }
  })

  it('읽는 시간이 있으면 함께 읽어 준다', () => {
    expect(mediaFormSrLabel('newspaper', { readingMinutes: 4 })).toBe('신문 기사, 읽는 시간 약 4분')
  })

  it('0분·null 은 시간 문구를 붙이지 않는다', () => {
    expect(mediaFormSrLabel('newspaper', { readingMinutes: 0 })).toBe('신문 기사')
    expect(mediaFormSrLabel('newspaper', { readingMinutes: null })).toBe('신문 기사')
  })
})
