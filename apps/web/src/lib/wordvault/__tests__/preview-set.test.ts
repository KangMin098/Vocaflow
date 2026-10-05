// apps/web/src/lib/wordvault/__tests__/preview-set.test.ts
//
// 회귀: WordVault 「학습 자산」에서 연 챕터 학습 모달이 「총 0개 단어」로 열리던 결함(2026-10-05).
// 행의 wordCount 는 「내가 담은 수」, 모달 머리는 「세트 전체 수」다 — 둘을 섞으면 안 된다.

import { describe, expect, it } from 'vitest'

import { toPreviewSet } from '../preview-set'

const row = {
  setId: 'set-1',
  title: '아직 없는 말 · 중학',
  href: '/wordvault/browse?filter=set:set-1',
  category: 'themed',
  cefrLevel: 'B1',
  coverEmoji: null,
}

describe('toPreviewSet — 모달 머리는 세트 전체 단어 수', () => {
  it('아직 한 단어도 담지 않은 세트도 전체 수로 연다(「총 0개 단어」 금지)', () => {
    const set = toPreviewSet({ ...row, wordCount: 0, totalWords: 300 })
    expect(set.wordCount).toBe(300)
  })

  it('담은 수와 전체 수가 다르면 전체 수를 쓴다', () => {
    expect(toPreviewSet({ ...row, wordCount: 12, totalWords: 300 }).wordCount).toBe(300)
  })

  it('전체 수를 모르면(메타 미수신) 담은 수로 물러난다', () => {
    expect(toPreviewSet({ ...row, wordCount: 12, totalWords: null }).wordCount).toBe(12)
    expect(toPreviewSet({ ...row, wordCount: 12 }).wordCount).toBe(12)
  })

  it('모달이 쓰는 식별 필드는 행에서 그대로 옮긴다', () => {
    const set = toPreviewSet({ ...row, wordCount: 0, totalWords: 300 })
    expect(set).toMatchObject({ id: 'set-1', title: '아직 없는 말 · 중학', cefrLevel: 'B1', category: 'themed' })
  })
})
