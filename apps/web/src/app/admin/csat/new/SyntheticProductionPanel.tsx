// apps/web/src/app/admin/csat/new/SyntheticProductionPanel.tsx
'use client'

import { useRef, useState } from 'react'

type Result = { html: string; manifest: { schema: string; synthetic_fixture: true; non_production: true;
  evidence_level: 'synthetic_mock_rpc'; production_verified: false; publish_eligible: false;
  reference_order: string; html_sha256: string; manifest_hash: string;
  receipt: { grade_scope: { grades: string[] }; published_status: string } } }

export function SyntheticProductionPanel() {
  const generation = useRef(0)
  const [order, setOrder] = useState('m1')
  const [result, setResult] = useState<Result | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function run() {
    const request = ++generation.current
    setPending(true); setResult(null); setError(null)
    try {
      const response = await fetch('/api/admin/csat/synthetic-production', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ order }),
      })
      if (!response.ok) throw Error('failed')
      const next = await response.json() as Result
      if (next.manifest?.synthetic_fixture !== true || next.manifest.non_production !== true ||
          next.manifest.publish_eligible !== false || next.manifest.production_verified !== false ||
          next.manifest.reference_order !== order) throw Error('invalid synthetic result')
      if (request === generation.current) setResult(next)
    } catch { if (request === generation.current) setError('합성 생산 예행을 완료하지 못했습니다. 성공 산출물을 표시하지 않습니다.') }
    finally { if (request === generation.current) setPending(false) }
  }
  function download(kind: 'html' | 'manifest') {
    if (!result) return
    const url = URL.createObjectURL(new Blob([kind === 'html' ? result.html : JSON.stringify(result.manifest, null, 2)],
      { type: kind === 'html' ? 'text/html;charset=utf-8' : 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = url; anchor.download = `synthetic-${result.manifest.reference_order}.${kind === 'html' ? 'html' : 'manifest.json'}`
    anchor.click(); URL.revokeObjectURL(url)
  }
  const button = 'rounded-[var(--r-sm)] border border-[var(--p)] px-4 text-[13px] font-[700] text-[var(--p)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)] disabled:opacity-50'
  return <section aria-labelledby="synthetic-production-title" className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4">
    <h2 id="synthetic-production-title" className="font-display text-[16px] font-[800] text-[var(--t1)]">공정 합성 예행</h2>
    <p className="mt-2 break-keep text-[13px] text-[var(--t2)]">고정된 지식 독해 주문으로 승격·문항·해설·검수·단원·권·원자 조판·게시 연결을 검증합니다. 비교 기준과 인증 결정은 합성 증거를 주입하며 실제 DB·등록 주문·학년 판정을 변경하지 않습니다.</p>
    <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={event => { event.preventDefault(); void run() }}>
      <label className="text-[13px] font-[700] text-[var(--t1)]">예행 주문
        <select value={order} onChange={event => { generation.current += 1; setOrder(event.target.value); setResult(null); setError(null); setPending(false) }}
          className="mt-1 block min-h-[44px] rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] px-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]">
          <option value="m1">중1 단일 학년</option><option value="h1">고1 단일 학년</option><option value="m1-m2">중1~중2 복수 학년</option>
        </select>
      </label>
      <button className={`min-h-[44px] ${button}`} disabled={pending} type="submit">{pending ? '예행 중' : '합성 생산 실행'}</button>
    </form>
    {error ? <p role="alert" className="mt-3 break-keep text-[13px] text-[var(--memory-risk)]">{error}</p> : null}
    {result ? <div className="mt-3">
      <p role="status" className="break-keep text-[13px] text-[var(--t1)]">합성 공정 실행 완료 · 운영 생산 미검증</p>
      <p className="mt-1 break-all font-mono text-[11px] text-[var(--t2)]">출력 SHA-256 {result.manifest.html_sha256}</p>
      <div className="mt-3 flex gap-2"><button type="button" className={`min-h-[44px] ${button}`} onClick={() => download('html')}>합성 교재 받기</button>
        <button type="button" className={`min-h-[44px] ${button}`} onClick={() => download('manifest')}>증거 manifest 받기</button></div>
    </div> : null}
  </section>
}
