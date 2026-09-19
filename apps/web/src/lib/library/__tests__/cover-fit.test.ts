// apps/web/src/lib/library/__tests__/cover-fit.test.ts
//
// 회귀 락: 그림책 표지가 3:4 카드에서 **잘리지 않고** 담기는지.
//
// 실측 배경 (2026-08-15): 발행 표지 5종의 원본 비율을 재보니
//   Gutenberg 0.67~0.71 · Standard Ebooks 0.667 → 3:4 슬롯에서 상하 5~11% 잘림 (허용)
//   StoryWeaver 2.09 (959x460 · 3351x1605)      → **좌우 64% 잘림** (그림이 사라짐)
// StoryWeaver 표지는 표지가 아니라 삽화 가로 크롭(`illustration_crops/…`)이라 그렇다.
//
// 판정을 URL 패턴으로 하지 않고 `is_picture_book` 으로 하는 이유도 여기서 고정한다 —
// 호스트가 바뀌어도 "그림책이면 가로 삽화" 라는 사실은 바뀌지 않는다.

import { describe, expect, it } from 'vitest'

import { coverFitFor } from '../cover-fit'

describe('coverFitFor', () => {
  it('그림책은 contain — 좌우 64% 잘림을 막는다', () => {
    const fit = coverFitFor({ is_picture_book: true })
    expect(fit.objectFit).toBe('object-contain')
  })

  it('그림책은 블러 배경을 깐다 — contain 이 남긴 여백이 검은 띠로 보이지 않게', () => {
    expect(coverFitFor({ is_picture_book: true }).blurBackdrop).toBe(true)
  })

  it('일반 도서는 cover — 세로 표지의 상하 10% 안팎 잘림은 디자인이 견딘다', () => {
    const fit = coverFitFor({ is_picture_book: false })
    expect(fit.objectFit).toBe('object-cover')
    expect(fit.blurBackdrop).toBe(false)
  })

  it('is_picture_book 이 null/undefined 면 일반 도서로 본다 (안전한 기본값)', () => {
    expect(coverFitFor({ is_picture_book: null }).objectFit).toBe('object-cover')
    expect(coverFitFor({}).objectFit).toBe('object-cover')
  })
})
