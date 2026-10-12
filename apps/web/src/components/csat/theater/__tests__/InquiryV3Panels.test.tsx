// apps/web/src/components/csat/theater/__tests__/InquiryV3Panels.test.tsx
//
// v3 패널 — 세 칸(정답 선정 · 내용 · 발문 요구) 분리 · 근거 수준 라벨 · 문장 대응이 어긋나면 근거 버튼 대신 안내
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { InquiryV3 } from '@/lib/csat/inquiry/labels'
import { V3Design, V3Judgment, V3Meaning, V3Task } from '../InquiryV3Panels'

const v3: InquiryV3 = {
  sentence_count: 7,
  units_hash: 'abc',
  requirement: { requested: '빈칸에 들어갈 말을 고른다 — 완성 문장 전체가 부정된다', polarity: 'positive', conditions: ['cannot be 가 빈칸 표현 전체를 부정한다'], reading_scope: '5~7번 문장' },
  meanings: [
    { id: 'm1', sentences: [7], expression: 'cannot be', meaning_ko: '빈칸 표현이라고 볼 수 없다', scope: { kind: 'negation', note: '빈칸 표현 전체에 미친다' } },
    { id: 'm2', sentences: [6], expression: 'freely choose', meaning_ko: '이성적 존재가 자유롭게 고른다', scope: { kind: 'none' } },
  ],
  choices: [
    { n: 3, selected_as_answer: true, content_truth: 'true', requirement_fit: 'satisfies', decisive: '부정과 결합한 전체 명제가 6번 문장과 맞는다', sentences: [6, 7], meaning_ids: ['m1'] },
    { n: 2, selected_as_answer: false, content_truth: 'false', requirement_fit: 'fails', decisive: '방어 주체를 바꿔 결합 명제가 원문과 어긋난다', sentences: [4] },
  ],
  design: { claims: [{ basis: 'source_observation', text: '6번 문장이 법을 자유 선택의 구현으로 말한다', sentences: [6] }, { basis: 'design_hypothesis', text: '부정 범위를 판단 과제로 이용했다는 해석', sentences: [7] }], limitation: '실제 출제 과정은 확인할 수 없다' },
}
const noop = () => {}

describe('v3 패널', () => {
  it('평가 과제 — 요구 판단 · 조건 · 극성', () => {
    const html = renderToStaticMarkup(<V3Task v3={v3} />)
    expect(html).toContain('긍정형 발문')
    expect(html).toContain('cannot be 가 빈칸 표현 전체를 부정한다')
  })

  it('원문 의미 — 영어 표현 · 문맥 의미 · 범위 · 근거 버튼', () => {
    const html = renderToStaticMarkup(<V3Meaning v3={v3} onEvidence={noop} linkable selectedKey={null} />)
    expect(html).toContain('lang="en"')
    expect(html).toContain('부정 범위')
    expect(html).toContain('근거 7번 문장 보기')
    expect(html).not.toContain('범위 표지 없음') // scope none 은 줄을 그리지 않는다
  })

  it('문장 대응이 어긋나면 근거 버튼 대신 「문장 대응 확인 중」', () => {
    const html = renderToStaticMarkup(<V3Meaning v3={v3} onEvidence={noop} linkable={false} selectedKey={null} />)
    expect(html).toContain('문장 대응 확인 중')
    expect(html).not.toContain('data-testid="v3-evidence"')
  })

  it('문항 성립 — 정답 선정 · 내용 · 발문 요구를 세 칸으로 따로, 처음엔 정답 선택지', () => {
    const html = renderToStaticMarkup(<V3Judgment v3={v3} onEvidence={noop} linkable selectedKey={null} />)
    expect(html).toContain('정답 선정')
    expect(html).toContain('공식 정답')
    expect(html).toContain('내용은 원문과 맞음')
    expect(html).toContain('발문 요구를 충족')
    expect(html).toContain('부정과 결합한 전체 명제')
  })

  it('설계 — 항목마다 근거 수준 · 확인하지 못한 부분', () => {
    const html = renderToStaticMarkup(<V3Design v3={v3} onEvidence={noop} linkable selectedKey={null} />)
    expect(html).toContain('원문에서 확인')
    expect(html).toContain('설계 가설')
    expect(html).toContain('확인하지 못한 부분')
  })
})
