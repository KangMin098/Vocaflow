// apps/web/src/app/admin/csat/new/ProductOrderRegistration.tsx
'use client'

import { useState } from 'react'

type Registration = {
  product_order_id: string
  order_revision: number
  order_hash: string
  capability_state: string
}

export function ProductOrderRegistration() {
  const [document, setDocument] = useState('')
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<Registration | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function register() {
    setError(null)
    setResult(null)
    let order: unknown
    try { order = JSON.parse(document) } catch {
      setError('Product Order JSON 형식이 올바르지 않습니다.')
      return
    }
    setPending(true)
    try {
      const response = await fetch('/api/admin/articles/reading-promotion', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'register-order-document', order }),
      })
      const body: unknown = await response.json()
      if (!response.ok || !body || typeof body !== 'object' || !('order_hash' in body)) {
        setError('주문 등록이 거부됐습니다. 주문 계약과 관리자 세션을 확인하세요.')
        return
      }
      setResult(body as Registration)
    } catch {
      setError('등록 요청을 완료하지 못했습니다. 연결 상태를 확인한 뒤 재시도하세요.')
    } finally {
      setPending(false)
    }
  }

  return (
    <section aria-labelledby="product-order-registration" className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4">
      <h2 id="product-order-registration" className="font-display text-[16px] font-[800] text-[var(--t1)]">Product Order 등록</h2>
      <p className="mt-2 break-keep font-body text-[13px] text-[var(--t2)]">
        완성된 주문 문서를 서버에서 검증·봉인하고 동일 주문 ID, revision, hash를 제한 승격 경로에 등록합니다.
        등록은 콘텐츠 승격이나 교재 발행을 실행하지 않습니다.
      </p>
      <label htmlFor="product-order-json" className="mt-4 block font-body text-[13px] font-[700] text-[var(--t1)]">Product Order JSON</label>
      <textarea id="product-order-json" value={document} onChange={event => {
        setDocument(event.target.value)
        setResult(null)
        setError(null)
      }}
        rows={10} spellCheck={false} disabled={pending}
        className="mt-1 w-full rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] p-3 font-mono text-[12px] text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]" />
      <button type="button" onClick={() => void register()} disabled={pending || !document.trim()}
        className="mt-3 min-h-[44px] rounded-[var(--r-sm)] border border-[var(--p)] px-4 font-display text-[13px] font-[700] text-[var(--p)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] disabled:opacity-50">
        {pending ? '등록 중…' : '주문 검증 및 등록'}
      </button>
      {error ? <p role="alert" className="mt-3 break-keep text-[13px] text-[var(--memory-risk)]">{error}</p> : null}
      {result ? <dl role="status" className="mt-3 grid gap-1 break-all font-mono text-[12px] text-[var(--t2)]">
        <div>Order: {result.product_order_id} · revision {result.order_revision}</div>
        <div>Hash: {result.order_hash}</div>
        <div>Capability: {result.capability_state}</div>
      </dl> : null}
    </section>
  )
}
