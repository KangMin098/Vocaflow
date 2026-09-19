// packages/library-pipeline/src/compose/attribution.test.ts
//
// 출처 표기 — 붙는가, 그리고 **대조에서 빠지는가**.

import { describe, expect, it } from 'vitest'

import {
  ATTRIBUTION_PREFIX,
  buildAttribution,
  stripAttribution,
  withAttribution,
} from './attribution'
import { buildFingerprint } from './fingerprint'
import { shelfRecordFrom } from './gates'

const BODY = 'A river ran low this summer. The plant had to stop for a while.'

describe('출처 표기', () => {
  it('발행사가 둘 이상이면 자연스럽게 잇는다', () => {
    expect(buildAttribution(['bbc.co.uk'])).toContain('by bbc.co.uk.')
    expect(buildAttribution(['bbc.co.uk', 'dw.com'])).toContain('bbc.co.uk and dw.com')
    expect(buildAttribution(['a', 'b', 'c'])).toContain('a, b and c')
  })

  it('출처가 없으면 아무것도 붙이지 않는다 — 빈 표기는 거짓말이다', () => {
    expect(buildAttribution([])).toBe('')
    expect(withAttribution(BODY, [])).toBe(BODY)
  })

  it('멱등 — 다시 붙여도 한 줄만 남는다', () => {
    const once = withAttribution(BODY, ['bbc.co.uk'])
    const twice = withAttribution(once, ['bbc.co.uk', 'dw.com'])
    const count = twice.split(ATTRIBUTION_PREFIX).length - 1
    expect(count).toBe(1)
    expect(twice).toContain('dw.com')
  })

  it('빈 줄로 떨어진 제 문단이라 본문 문단을 건드리지 않는다', () => {
    const out = withAttribution(BODY, ['bbc.co.uk'])
    expect(out.split(/\n\s*\n/)).toHaveLength(2)
    expect(stripAttribution(out)).toBe(BODY)
  })
})

describe('우리가 붙인 상용구는 표절의 증거가 아니다', () => {
  it('서가 지문에서 표기를 뺀다 — 형제 판끼리 겹쳐 I17 이 둘 다 막은 적이 있다', () => {
    // 실측 2026-08-18: 같은 취재 묶음의 두 판이 표기 22어절을 그대로 공유해 차단됐다.
    const a = withAttribution('The first version says one thing entirely.', ['bbc.co.uk', 'dw.com'])
    const b = withAttribution('The second version says something else completely.', [
      'bbc.co.uk',
      'dw.com',
    ])
    const fa = shelfRecordFrom({ id: 'a', title: 'A', source: 'original', content: a }).fingerprint
    const fb = shelfRecordFrom({ id: 'b', title: 'B', source: 'original', content: b }).fingerprint
    const shared = fa.hashes.filter((h) => fb.hashes.includes(h))
    expect(shared).toEqual([])

    // 떼지 않으면 실제로 겹친다 — 이 테스트가 지키는 것이 그 차이다.
    const raw = buildFingerprint(a).hashes.filter((h) => buildFingerprint(b).hashes.includes(h))
    expect(raw.length).toBeGreaterThan(0)
  })
})
