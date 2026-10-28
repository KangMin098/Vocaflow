// apps/web/src/components/library/story/__tests__/story-return-anchor.test.tsx
//
// U03 — 단어장 → Story 복귀 문장(같은 탭 보조 기억): 저장 → 떠남 → 같은 발행본 · 단위에서 한 번만 낱말 번호,
// 떠나지 않음 · 다른 단위 · 다른 계정 · 주인 없는 옛 표식 · 형식 오류 · 저장소 오류는 null(단위 첫머리 그대로).
// 늦은 전달 · 단순 재렌더 이동 판정, 문장 범위와 렌더 강조.

import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { StoryUnitText } from '../StoryUnitText'
import {
  RETURN_ANCHOR_KEY,
  markAnchorLeft,
  ownerTag,
  rememberSaveAnchor,
  sentenceRange,
  shouldMoveToReturn,
  takeReturnAnchor,
} from '../story-return-anchor'
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

const A = ownerTag('viewer-a')
const B = ownerTag('viewer-b')

describe('ownerTag', () => {
  it('짧은 16진 8자 · 원문 id 를 담지 않는다 · 계정마다 다르다', () => {
    expect(A).toMatch(/^[0-9a-f]{8}$/)
    expect(A).not.toContain('viewer')
    expect(A).not.toBe(B)
    expect(ownerTag('viewer-a')).toBe(A)
  })
})

describe('takeReturnAnchor', () => {
  it('저장 → 떠남 → 같은 주인 · 단위면 낱말 번호를 한 번만 돌려준다', () => {
    const s = memory()
    rememberSaveAnchor({ owner: A, releaseKey: KEY, unitIndex: 2, wordIndex: 7 }, s)
    markAnchorLeft(A, s)
    expect(takeReturnAnchor(A, KEY, 2, s)).toBe(7)
    expect(takeReturnAnchor(A, KEY, 2, s)).toBeNull()
  })

  it('떠나지 않았으면 쓰지도 지우지도 않는다', () => {
    const s = memory()
    rememberSaveAnchor({ owner: A, releaseKey: KEY, unitIndex: 2, wordIndex: 7 }, s)
    expect(takeReturnAnchor(A, KEY, 2, s)).toBeNull()
    markAnchorLeft(A, s)
    expect(takeReturnAnchor(A, KEY, 2, s)).toBe(7)
  })

  it('다른 발행본 · 단위면 null 이고 지운다', () => {
    const s = memory()
    rememberSaveAnchor({ owner: A, releaseKey: KEY, unitIndex: 2, wordIndex: 7 }, s)
    markAnchorLeft(A, s)
    expect(takeReturnAnchor(A, KEY, 3, s)).toBeNull()
    expect(s.getItem(RETURN_ANCHOR_KEY)).toBeNull()
    rememberSaveAnchor({ owner: A, releaseKey: KEY, unitIndex: 2, wordIndex: 7 }, s)
    markAnchorLeft(A, s)
    expect(takeReturnAnchor(A, 'lsr_' + 'b'.repeat(32), 2, s)).toBeNull()
  })

  it('계정 교체: 다른 주인의 표식은 쓰지 않고 지운다 · 다른 주인은 떠남 표시도 못 한다', () => {
    const s = memory()
    rememberSaveAnchor({ owner: A, releaseKey: KEY, unitIndex: 2, wordIndex: 7 }, s)
    markAnchorLeft(B, s)
    expect(JSON.parse(s.getItem(RETURN_ANCHOR_KEY)!).left).toBe(false)
    markAnchorLeft(A, s)
    expect(takeReturnAnchor(B, KEY, 2, s)).toBeNull()
    expect(s.getItem(RETURN_ANCHOR_KEY)).toBeNull()
    expect(takeReturnAnchor(A, KEY, 2, s)).toBeNull()
  })

  it('주인 없는 옛 표식 · 형식이 틀린 주인은 쓰지 않고 지운다', () => {
    const s = memory()
    s.setItem(RETURN_ANCHOR_KEY, JSON.stringify({ releaseKey: KEY, unitIndex: 2, wordIndex: 7, left: true }))
    expect(takeReturnAnchor(A, KEY, 2, s)).toBeNull()
    expect(s.getItem(RETURN_ANCHOR_KEY)).toBeNull()
    s.setItem(RETURN_ANCHOR_KEY, JSON.stringify({ owner: 'viewer-a', releaseKey: KEY, unitIndex: 2, wordIndex: 7, left: true }))
    expect(takeReturnAnchor(A, KEY, 2, s)).toBeNull()
    rememberSaveAnchor({ owner: 'raw-user-id', releaseKey: KEY, unitIndex: 2, wordIndex: 7 }, s)
    expect(s.getItem(RETURN_ANCHOR_KEY)).toBeNull()
  })

  it('마지막 저장만 기억한다', () => {
    const s = memory()
    rememberSaveAnchor({ owner: A, releaseKey: KEY, unitIndex: 2, wordIndex: 7 }, s)
    rememberSaveAnchor({ owner: A, releaseKey: KEY, unitIndex: 2, wordIndex: 11 }, s)
    markAnchorLeft(A, s)
    expect(takeReturnAnchor(A, KEY, 2, s)).toBe(11)
  })

  it('형식 오류 · 저장소 오류 · 저장소 없음은 null', () => {
    const s = memory()
    s.setItem(RETURN_ANCHOR_KEY, '{not json')
    expect(takeReturnAnchor(A, KEY, 2, s)).toBeNull()
    s.setItem(RETURN_ANCHOR_KEY, JSON.stringify({ owner: A, releaseKey: KEY, unitIndex: -1, wordIndex: 1, left: true }))
    expect(takeReturnAnchor(A, KEY, 2, s)).toBeNull()
    const broken = { getItem: () => { throw new Error('x') }, setItem: () => { throw new Error('x') }, removeItem: () => { throw new Error('x') } }
    expect(() => rememberSaveAnchor({ owner: A, releaseKey: KEY, unitIndex: 0, wordIndex: 0 }, broken)).not.toThrow()
    expect(takeReturnAnchor(A, KEY, 0, broken)).toBeNull()
    expect(takeReturnAnchor(A, KEY, 0, null)).toBeNull()
  })
})

describe('shouldMoveToReturn', () => {
  it('초기 전달: 번호와 표지가 있으면 옮긴다', () => {
    expect(shouldMoveToReturn(null, 5, true)).toBe(true)
  })
  it('늦은 전달: null 일 때는 옮기지 않고, 번호가 생기면 옮긴다', () => {
    expect(shouldMoveToReturn(null, null, false)).toBe(false)
    expect(shouldMoveToReturn(null, 5, true)).toBe(true)
  })
  it('표지가 아직 없으면 기다린다', () => {
    expect(shouldMoveToReturn(null, 5, false)).toBe(false)
  })
  it('단순 재렌더(같은 번호)는 다시 옮기지 않는다 · 다른 번호면 옮긴다', () => {
    expect(shouldMoveToReturn(5, 5, true)).toBe(false)
    expect(shouldMoveToReturn(5, 8, true)).toBe(true)
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
