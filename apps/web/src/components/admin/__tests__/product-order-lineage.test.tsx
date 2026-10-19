// apps/web/src/components/admin/__tests__/product-order-lineage.test.tsx
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ProductOrderLineageView } from '../csat-diagnosis/ProductOrderLineageView'

describe('주문 계보 표시', () => {
  it('미설치·조회 불가·실제 빈 목록을 분리한다', () => {
    expect(
      renderToStaticMarkup(<ProductOrderLineageView result={{ status: 'not_installed' }} />)
    ).toContain('주문 계보 미설치')
    expect(
      renderToStaticMarkup(<ProductOrderLineageView result={{ status: 'error' }} />)
    ).toContain('주문 계보 조회 불가')
    expect(
      renderToStaticMarkup(
        <ProductOrderLineageView
          result={{ status: 'installed', rows: [], total: 0, limited: false }}
        />
      )
    ).toContain('등록된 공용 주문 연결이 없습니다')
  })
  it('현재성·과거 판과 비소모성 계획량을 실제 원장 값으로 표시한다', () => {
    const html = renderToStaticMarkup(
      <ProductOrderLineageView
        result={{
          status: 'installed',
          total: 1,
          limited: false,
          rows: [
            {
              id: 'link',
              order_id: 'personal',
              product_order_id: 'TPO-one',
              order_revision: 2,
              order_hash: 'a'.repeat(64),
              quantity: 3,
              product_quantity: 5,
              created_at: '2026-10-20T00:00:00Z',
              product_current: false,
              personal_current: true,
              status: 'withdrawn',
            },
          ],
        }}
      />
    )
    expect(html).toContain('철회된 주문')
    expect(html).toContain('TPO-one · v2')
    expect(html).toContain('3 / 공용 목표 5')
    expect(html).toContain('이 연결로 생산 실행·자료 적합성·납품 여부를 판정하지 않습니다')
  })
})
