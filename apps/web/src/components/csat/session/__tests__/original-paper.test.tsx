// apps/web/src/components/csat/session/__tests__/original-paper.test.tsx
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DissectionItem } from '@/lib/csat/dissect'
import type { ReflowItem } from '@/lib/csat/reflow/types'
import { cropOf } from '@/lib/csat/reflow/read-paper'
import { AnalysisReading } from '../AnalysisReading'
import { ItemScreen } from '../ItemScreen'

vi.mock('@/lib/csat/reflow/read-paper', () => ({ cropOf: vi.fn() }))
const source = 'The reader met her neighbor.'
const png = 'data:image/png;base64,iVBORw0KGgo='
const item: DissectionItem = {
  id: 'H2603G1#44', exam_id: 'H2603G1', no: 44, type_id: 'X-REFER', points: 2,
  answer: 5, topic: '두 인물의 관계', format: '명사구 범위', formula: '역할과 범위를 확인한다',
  formulaTag: 'refer', wrapup: '전체 범위를 확인한다', intent: '지시 대상을 비교한다',
  intentOptions: ['지시 대상을 비교한다', '사건 시점을 비교한다', '수량 범위를 비교한다'],
  evidence: '소유격의 임자와 전체 명사구 대상을 구분한다',
  distractor: { n: 1, family: '범위 과대', line: '한 단어만 대입했다' },
  trapOptions: ['범위 과대', '주체 역전', '무관', '반대 진술'], history: [],
  skeleton: { sentences: [source.length], anchors: [
    { id: 'answer', from: 'answer', sentences: [0], quotes: [] },
    { id: 'reject:1', from: 'reject', sentences: [0], quotes: [] },
  ] },
}
const paper: ReflowItem = {
  no: 44, stem: '다른 지시 대상을 고르시오.', passage: source, notes: [],
  choices: ['(a)', '(b)', '(c)', '(d)', '(e)'], inline: false, ok: true,
  needsOriginal: true, reason: null, boxes: [{ p: 1, col: 0, top: 100, bottom: 20 }],
}
const reading = (p = paper) => renderToStaticMarkup(<AnalysisReading item={item} paper={p} onReadAgain={() => {}} />)
const prediction = (crop: string | null, p = paper) => renderToStaticMarkup(<ItemScreen
  item={item} paper={p} crop={crop} seed={1} seq={1} typeName="지칭"
  onReadAgain={() => {}} onPrediction={() => {}} onDone={async () => {}}
/>)

describe('밑줄·도표 원본과 문자 분석', () => {
  beforeEach(() => { vi.mocked(cropOf).mockReset() })

  it('분석 읽기는 원본 이미지와 기존 분석을 함께 표시한다', () => {
    vi.mocked(cropOf).mockReturnValue(png)
    const html = reading()
    expect(html).toContain(`src="${png}"`)
    expect(html).toContain('data-testid="analysis-workbench"')
    expect(cropOf).toHaveBeenCalledWith(item.exam_id, 44)
  })
  it('원본이 없는 캐시는 분석 읽기를 시작하지 않고 재입력을 요구한다', () => {
    vi.mocked(cropOf).mockReturnValue(null)
    const html = reading()
    expect(html).toContain('문제지 다시 놓기')
    expect(html).not.toContain('data-testid="analysis-workbench"')
  })
  it('예측 화면도 원본을 표시하며 문장 예측을 유지한다', () => {
    const html = prediction(png)
    expect(html).toContain(`src="${png}"`)
    expect(html).toContain('data-testid="item-screen"')
  })
  it('원본이 없으면 예측 화면은 범위를 잃은 글만으로 진행하지 않는다', () => {
    const html = prediction(null)
    expect(html).toContain('문제지 다시 놓기')
    expect(html).not.toContain('data-testid="item-screen"')
  })
  it('원본이 필요 없는 유형은 이미지 없이 기존 문자 분석을 표시한다', () => {
    const html = reading({ ...paper, needsOriginal: false })
    expect(html).toContain('data-testid="analysis-workbench"')
    expect(cropOf).not.toHaveBeenCalled()
  })
})
