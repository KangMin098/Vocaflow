// apps/web/src/components/diagnostic/__tests__/DiagnosticPassage.test.tsx
//
// `/diagnostic` 골격(채색 지문) 렌더 계약 — docs/design/compare/diagnostic.md · DD-23.
//   ① 레벨이 없으면(답 0) 칠하지 않고 학습 낱말마다 dotted — "아직 모름" 을 제품 문법으로.
//   ② 레벨이 있으면 `/fit` 과 같은 규칙(v > level 이면 주묵 면)으로 칠한다 — 몸짓이 같아야 한다.
//   ③ 레벨 미상(null)·기능어(undefined)는 칠하지 않는다.
//   ④ 원문은 한 글자도 잃지 않는다.

import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { DiagnosticPassage, unknownIn } from '../DiagnosticPassage'

const TOKENS = [
  { t: 'Every', v: 1 },
  { t: ' ' },
  { t: 'reader', v: 3 },
  { t: ' ' },
  { t: 'encounters', v: 6 },
  { t: ' the ' },
  { t: 'page', v: null },
  { t: '.' },
]
const text = (html: string) => html.replace(/<[^>]+>/g, '').replace(/<!-- -->/g, '')

describe('DiagnosticPassage', () => {
  it('① 답 0 — 칠 없이 학습 낱말마다 dotted', () => {
    const html = renderToString(<DiagnosticPassage tokens={TOKENS} level={null} />)
    expect(html).not.toContain('<mark')
    expect(html.match(/decoration-dotted/g)).toHaveLength(4)
    expect(html).toContain('data-diagnostic-passage="unknown"')
  })

  it('② V3 — 3 보다 높은 낱말만 주묵 면 (/fit 과 같은 규칙)', () => {
    const html = renderToString(<DiagnosticPassage tokens={TOKENS} level={3} />)
    expect(html.match(/<mark/g)).toHaveLength(1)
    expect(html).toContain('>encounters</mark>')
    expect(unknownIn(TOKENS, 3)).toBe(1)
    expect(unknownIn(TOKENS, 0)).toBe(3)
  })

  it('③ 레벨 미상은 어느 레벨에서도 칠하지 않는다', () => {
    const html = renderToString(<DiagnosticPassage tokens={TOKENS} level={0} />)
    expect(html).not.toContain('>page</mark>')
  })

  it('④ 원문 보존', () => {
    const whole = TOKENS.map((t) => t.t).join('')
    expect(text(renderToString(<DiagnosticPassage tokens={TOKENS} level={2} />))).toBe(whole)
    expect(text(renderToString(<DiagnosticPassage tokens={TOKENS} level={null} />))).toBe(whole)
  })
})
