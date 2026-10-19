// apps/web/src/components/admin/csat-diagnosis/ProductOrderLineageView.tsx
import type { ProductOrderLineage } from '@/lib/admin/product-order-lineage'
import { ChevronDown } from 'lucide-react'

const statusLabel = {
  current: '현재 계획 연결',
  withdrawn: '철회된 주문',
  superseded: '이전 주문 판',
  personal_order_changed: '개인 계획·주문 변경',
} as const
export function ProductOrderLineageView({ result }: { result: ProductOrderLineage }) {
  return (
    <details
      className="group/lineage mt-3 border-t border-[var(--bd)] pt-2"
      data-product-order-lineage
    >
      <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--bdf)]">
        <span>공용 생산 주문 계보 · 읽기 전용</span>
        <ChevronDown
          aria-hidden="true"
          className="h-4 w-4 shrink-0 group-open/lineage:rotate-180"
        />
      </summary>
      {result.status !== 'installed' ? (
        <p role="status" className="break-keep">
          {result.status === 'not_installed' ? '주문 계보 미설치' : '주문 계보 조회 불가'} · 연결
          없음으로 판단하지 않습니다.
        </p>
      ) : result.total === 0 ? (
        <p>이 Workspace에 등록된 공용 주문 연결이 없습니다.</p>
      ) : (
        <>
          <p className="break-keep">
            연결 {result.total}건{result.limited ? ' · 최근 100건 표시' : ''}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <caption className="sr-only">개인 주문과 공용 Product Order의 계획 계보</caption>
              <thead>
                <tr>
                  <th scope="col" className="py-2">
                    공용 주문
                  </th>
                  <th scope="col">계획 문항</th>
                  <th scope="col">현재성</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => (
                  <tr key={row.id} className="border-t border-[var(--bd)]">
                    <td className="max-w-64 break-all py-2 pr-3">
                      {row.product_order_id} · v{row.order_revision}
                      <br />
                      <span className="text-[var(--t2)]">{row.order_hash.slice(0, 12)}</span>
                    </td>
                    <td className="pr-3">
                      {row.quantity} / 공용 목표 {row.product_quantity}
                    </td>
                    <td className="break-keep">{statusLabel[row.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <p className="mt-2 break-keep text-[var(--t2)]">
        문항 수는 개인별 계획 연결량입니다. 공용 자료는 재사용되며, 이 연결로 생산 실행·자료
        적합성·납품 여부를 판정하지 않습니다.
      </p>
    </details>
  )
}
