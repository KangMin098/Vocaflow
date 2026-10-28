// apps/web/src/components/library/story/__tests__/story-return-anchor.test.tsx
//
// U03 — 단어장 → Story 복귀 문장(같은 탭 보조 기억): 저장 → 떠남 → 같은 발행본 · 단위에서 한 번만 낱말 번호,
// 떠나지 않음 · 다른 단위 · 형식 오류 · 저장소 오류는 null(단위 첫머리 그대로). 문장 범위와 렌더 강조.

import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { StoryUnitText } from '../StoryUnitText'
import { RETURN_ANCHOR_KEY, markAnchorLeft, rememberSaveAnchor, sentenceRange, takeReturnAnchor } from '../story-return-anchor'
import { tokenizeWords } from '../story-view'

function memory(): Storage {
  const m = new Map<string, string>()
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
    key: () => null,
    get length() {
      return m.size
    },
  }
}

const KEY = 'lsr_' + 'a'.repeat(32)

describe('takeReturnAnchor', () => {
  it('저장 → 떠남 → 같은 단위면 낱말 번호를 한 번만 돌려준다', () => {
    const s = memory()
    rememberSaveAnchor({ releaseKey: KEY, unitIndex: 2, wordIndex: 7 }, s)
    markAnchorLeft(s)
    expect(takeReturnAnchor(KEY, 2, s)).toBe(7)
    expect(takeReturnAnchor(KEY, 2, s)).toBeNull()
  })

  it('떠나지 않았으면 쓰지도 지우지도 않는다', () => {
    const s = memory()
    rememberSaveAnchor({ releaseKey: KEY, unitIndex: 2, wordIndex: 7 }, s)
    expect(takeReturnAnchor(KEY, 2, s)).toBeNull()
    markAnchorLeft(s)
    expect(takeReturnAnchor(KEY, 2, s)).toBe(7)
  })

  it('다른 발행본 · 단위면 null 이고 지운다', () => {
    const s = memory()
    rememberSaveAnchor({ releaseKey: KEY, unitIndex: 2, wordIndex: 7 }, s)
    markAnchorLeft(s)
    expect(takeReturnAnchor(KEY, 3, s)).toBeNull()
    expect(s.getItem(RETURN_ANCHOR_KEY)).toBeNull()
  })

  it('마지막 저장만 기억한다', () => {
    const s = memory()
    rememberSaveAnchor({ releaseKey: KEY, unitIndex: 2, wordIndex: 7 }, s)
    rememberSaveAnchor({ releaseKey: KEY, unitIndex: 2, wordIndex: 11 }, s)
    markAnchorLeft(s)
    expect(takeReturnAnchor(KEY, 2, s)).toBe(11)
  })

  it('형식 오류 · 저장소 오류 · 저장소 없음은 null', () => {
    const s = memory()
    s.setItem(RETURN_ANCHOR_KEY, '{not json')
    expect(takeReturnAnchor(KEY, 2, s)).toBeNull()
    s.setItem(RETURN_ANCHOR_KEY, JSON.stringify({ releaseKey: KEY, unitIndex: -1, wordIndex: 1, left: true }))
    expect(takeReturnAnchor(KEY, 2, s)).toBeNull()
    const broken = { getItem: () => { throw new Error('x') }, setItem: () => { throw new Error('x') }, removeItem: () => { throw new Error('x') } }
    expect(() => rememberSaveAnchor({ releaseKey: KEY, unitIndex: 0, wordIndex: 0 }, broken)).not.toThrow()
    expect(takeReturnAnchor(KEY, 0, broken)).toBeNull()
    expect(takeReturnAnchor(KEY, 0, null)).toBeNull()
  })
})

describe('sentenceRange', () => {
  const { pieces } = tokenizeWords('The cat sat. "Was it a hat?" she asked! Then home')
  const text = (r: { start: number; end: number } | null) => (r ? pieces.slice(r.start, r.end).map((p) => p.text).join('') : null)

  it('낱말이 든 문장만 고른다(앞 문장 끝은 빼고 이 문장 끝은 넣는다 · 끝 조각에 붙은 다음 여는 따옴표는 앞 문장 쪽)', () => {
    expect(text(sentenceRange(pieces, 0))).toBe('The cat sat. "')
    expect(text(sentenceRange(pieces, 5))).toBe('Was it a hat?" ')
    expect(text(sentenceRange(pieces, 7))).toBe('she asked! ')
    expect(text(sentenceRange(pieces, 9))).toBe('Then home')
  })

  it('이 문단에 없는 낱말이면 null', () => {
    expect(sentenceRange(pieces, 99)).toBeNull()
  })
})

describe('StoryUnitText returnWordIndex', () => {
  const body = 'The cat sat. Was it a hat?\n\nAnother day.'

  it('그 문장 하나만 강조 · 초점 가능한 표지로 감싼다(본문 글자는 그대로)', () => {
    const html = renderToString(<StoryUnitText text={body} tracing={false} returnWordIndex={5} />)
    expect(html.match(/data-story-return-sentence/g)).toHaveLength(1)
    expect(html).toMatch(/data-story-return-sentence="true">Was it a hat\?<\/span>/)
    expect(html).toContain('tabindex="-1"')
    expect(html).toContain('The cat sat. ')
  })

  it('낱말 모드에서도 버튼 번호 · 로빙 초점을 바꾸지 않는다', () => {
    const html = renderToString(<StoryUnitText text={body} tracing={false} defaultWordMode returnWordIndex={5} />)
    expect(html.match(/data-word-index=/g)).toHaveLength(9)
    expect(html).toMatch(/data-story-return-sentence="true"[^>]*>(<button[^>]*data-word-index="(3|4|5|6)"[^>]*>[^<]*<\/button>[ ?]*)+<\/span>/)
  })

  it('없으면 표지가 없다(단위 첫머리 그대로)', () => {
    expect(renderToString(<StoryUnitText text={body} tracing={false} />)).not.toContain('data-story-return-sentence')
    expect(renderToString(<StoryUnitText text={body} tracing={false} returnWordIndex={99} />)).not.toContain('data-story-return-sentence')
  })
})
