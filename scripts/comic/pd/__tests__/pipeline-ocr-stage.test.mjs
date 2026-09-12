// scripts/comic/pd/__tests__/pipeline-ocr-stage.test.mjs
//
// ④ 대사 단계 판정 회귀.
//
// 왜 이 테스트가 있는가 (2026-08-16):
//   로컬 OCR 실행(`ocr-local.mjs`)을 걷어낼 때 호출부를 기계적으로 `ocr.mjs` 로 치환했더니
//   `source-hocr` 분기와 tesseract 분기가 **같은 명령**이 되어 OCR 이 두 번 돌았다.
//   산출물은 멱등이라 안 깨졌지만 시간이 두 배였고, --dry-run 계획에 같은 줄이 두 번 나와
//   운영자에게 "두 종류의 OCR 을 돈다" 는 틀린 인상을 줬다.
//   그래서 판정을 순수 함수로 분리하고, "언제 돌고 언제 왜 건너뛰는가"를 여기에 못 박는다.

import { describe, expect, it } from 'vitest'

import { planOcrStage } from '../pipeline.mjs'

describe('planOcrStage', () => {
  it('hOCR 이 있으면 전략과 무관하게 한 번 돈다', () => {
    for (const ocrStrategy of ['source-hocr', 'source-text', 'own-ocr']) {
      const r = planOcrStage({ ocrStrategy, hasHocr: true })
      expect(r.run).toBe(true)
      expect(r.skipReason).toBeNull()
    }
  })

  it('own-ocr 은 hOCR 이 없으면 건너뛰고, 도구 설치를 권하지 않는다', () => {
    const r = planOcrStage({ ocrStrategy: 'own-ocr', hasHocr: false })
    expect(r.run).toBe(false)
    // 로컬 OCR 경로가 제거됐으므로 tesseract 를 깔라는 안내는 거짓말이 된다.
    expect(r.skipReason).not.toMatch(/tesseract/i)
    expect(r.skipReason).toMatch(/수동 입력|사람이/)
  })

  it('source-hocr 인데 hOCR 이 없으면 취득 단계를 지목한다', () => {
    const r = planOcrStage({ ocrStrategy: 'source-hocr', hasHocr: false })
    expect(r.run).toBe(false)
    expect(r.skipReason).toMatch(/취득/)
  })

  it('건너뛸 때는 반드시 사유가 있다 (조용한 skip 금지)', () => {
    for (const ocrStrategy of ['source-hocr', 'source-text', 'own-ocr']) {
      const r = planOcrStage({ ocrStrategy, hasHocr: false })
      expect(r.run).toBe(false)
      expect(typeof r.skipReason).toBe('string')
      expect(r.skipReason.length).toBeGreaterThan(10)
    }
  })
})
