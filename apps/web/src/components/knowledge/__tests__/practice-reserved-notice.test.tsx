// apps/web/src/components/knowledge/__tests__/practice-reserved-notice.test.tsx
// #281 — 연습 풀이 예약으로 비었을 때 숨기지 않고 이유 · 대체 경로를 보인다(원장 오류와 정상 예약을 다르게 말한다).
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { PracticeReservedNotice } from '../PracticeReservedNotice'

describe('PracticeReservedNotice', () => {
  it('정상 예약 — 실제 예약 수와 학습 지도 경로', () => {
    const html = renderToStaticMarkup(<PracticeReservedNotice reservedCount={9} ledgerError={false} />)
    expect(html).toContain('data-reason="reserved_for_check"')
    expect(html).toContain('남은 문항 9개')
    expect(html).toContain('href="/csat/diagnosis"')
    expect(html).toContain('break-keep')
  })
  it('원장 오류 — 「이미 다 봤다」 가 아니라 「기록을 다 읽지 못했다」', () => {
    const html = renderToStaticMarkup(<PracticeReservedNotice reservedCount={9} ledgerError />)
    expect(html).toContain('data-reason="ledger_error"')
    expect(html).toContain('기록을 다 읽지 못했어요')
    expect(html).not.toContain('남은 문항 9개')
  })
})
