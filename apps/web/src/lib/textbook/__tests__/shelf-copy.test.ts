// apps/web/src/lib/textbook/__tests__/shelf-copy.test.ts
//
// 태그라인/나머지 가르기 — **합이 원문이어야 한다**가 이 파일의 핵심 검사다.
// 앞면(태그라인)과 뒷면('무엇을 시키나요')이 다른 규칙으로 잘리면 문장이
// 사라지거나 두 번 나온다. 눈으로는 잘 안 보이고, 실제 문안 7개 전부에서 검사한다.

import { SERIES_SPINE } from '@vocaflow/library-pipeline'
import { describe, expect, it } from 'vitest'

import { detailOf, taglineOf } from '../shelf-copy'

const plain = (s: string) => s.replace(/\*\*/g, '').trim()

describe('taglineOf', () => {
  it('첫 문장만 남긴다', () => {
    expect(taglineOf('낱말에서 문장으로. 영작 배열이 첫 문장 단위 과제다.')).toBe('낱말에서 문장으로')
  })

  it('마침표가 없으면 통째로 태그라인이다 — 잘라서 없애지 않는다', () => {
    expect(taglineOf('수능 대응')).toBe('수능 대응')
  })

  it('강조 표기를 뗀다 — 매대는 마크다운을 렌더하지 않는다', () => {
    expect(taglineOf('**학평 대응**. 순서·삽입이 열린다.')).toBe('학평 대응')
  })

  it('숫자 안의 점에서 끊지 않는다 (마침표 뒤가 공백이나 끝일 때만 문장 끝)', () => {
    // '1.5배' 의 점에서 끊기면 태그라인이 '1' 이 된다.
    expect(taglineOf('지문이 1.5배 길어진다. 그래서 어렵다.')).toBe('지문이 1.5배 길어진다')
  })

  it('빈 문자열도 죽지 않는다', () => {
    expect(taglineOf('')).toBe('')
    expect(detailOf('')).toBe('')
  })
})

describe('detailOf', () => {
  it('태그라인을 뺀 나머지를 준다', () => {
    expect(detailOf('낱말에서 문장으로. 영작 배열이 첫 문장 단위 과제다.')).toBe(
      '영작 배열이 첫 문장 단위 과제다.',
    )
  })

  it('나머지가 없으면 빈 문자열 — 화면이 그 줄을 아예 안 낸다', () => {
    expect(detailOf('수능 대응')).toBe('')
  })
})

describe('실제 시리즈 문안 7개', () => {
  it('태그라인이 비지 않는다', () => {
    for (const rung of SERIES_SPINE) {
      expect(taglineOf(rung.rationale).length, `step ${rung.step}`).toBeGreaterThan(0)
    }
  })

  it('태그라인 + 나머지 = 원문 (문장이 사라지지도 겹치지도 않는다)', () => {
    for (const rung of SERIES_SPINE) {
      const tag = taglineOf(rung.rationale)
      const rest = detailOf(rung.rationale)
      // 원문에서 구분자(마침표·공백)만 뺀 글자열이 둘의 합과 같아야 한다.
      const norm = (s: string) => s.replace(/[.\s]/g, '')
      expect(norm(tag) + norm(rest), `step ${rung.step}`).toBe(norm(plain(rung.rationale)))
    }
  })

  it('태그라인이 한 줄에 들 만큼 짧다 (앞면은 훑는 자리다)', () => {
    for (const rung of SERIES_SPINE) {
      expect(taglineOf(rung.rationale).length, `step ${rung.step}`).toBeLessThanOrEqual(24)
    }
  })
})
