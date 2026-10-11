// apps/web/src/app/admin/csat/new/ProductOrderRegistration.tsx
'use client'

import { useEffect, useRef, useState } from 'react'

export type PlanSelection = { brief: unknown; plan_hash: string } | null
type Brief = { grade_scope: { grades: string[] } }
type Draft = { order: Record<string, unknown>; order_hash: string; capability_state: string }
const labels = {
  product_order_id: '주문 ID', series_id: '시리즈 ID', edition_id: '판본 ID',
  product_variant: '제품 변형', unit_spec_version: '단원 규격',
  chapter_spec_version: '장 규격', volume_spec_version: '권 규격', layout_profile: '조판 프로필',
} as const
type Field = keyof typeof labels
const policyLabels = {
  source: '원천', rights: '권리', adaptation: '각색', benchmark: 'Benchmark',
  evidence: '증거', trust: '신뢰',
} as const
type Policy = keyof typeof policyLabels
const initialFields = Object.fromEntries(Object.keys(labels).map(key => [key, ''])) as Record<Field, string>
const initialPolicies = Object.fromEntries(Object.keys(policyLabels).map(key => [key, { version: '', hash: '' }])) as Record<Policy, { version: string; hash: string }>

export function ProductOrderRegistration({ selection }: { selection: PlanSelection }) {
  const requestGeneration = useRef(0)
  const [fields, setFields] = useState(initialFields)
  const [policies, setPolicies] = useState(initialPolicies)
  const [grade, setGrade] = useState('')
  const [revision, setRevision] = useState(1)
  const [languageBand, setLanguageBand] = useState('middle')
  const [passageLevel, setPassageLevel] = useState(4)
  const [shareAlike, setShareAlike] = useState(false)
  const [exam, setExam] = useState('')
  const [resourcesText, setResourcesText] = useState('')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [registrationReceipt, setRegistrationReceipt] = useState<{ orderId: string; revision: number; hash: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const grades = (selection?.brief as Brief | undefined)?.grade_scope?.grades ?? []
  const firstGrade = grades[0] ?? ''

  useEffect(() => {
    requestGeneration.current += 1
    setGrade(firstGrade)
    setDraft(null); setError(null); setPending(false)
  }, [selection, firstGrade])
  function invalidate() {
    requestGeneration.current += 1
    setDraft(null); setError(null); setPending(false)
  }
  function updateField(key: Field, value: string) { setFields(current => ({ ...current, [key]: value })); invalidate() }
  function updatePolicy(key: Policy, part: 'version' | 'hash', value: string) {
    setPolicies(current => ({ ...current, [key]: { ...current[key], [part]: value } })); invalidate()
  }

  async function preview() {
    if (!selection || !grade) return
    // Licensed second texts (P13/P20) or data (P14) are sealed into the order; the server validates rights fields.
    let resources: unknown[] | undefined
    if (resourcesText.trim()) {
      try {
        const parsed = JSON.parse(resourcesText) as unknown
        if (!Array.isArray(parsed)) throw Error('not array')
        resources = parsed
      } catch { invalidate(); setError('자료는 JSON 배열이어야 합니다.'); return }
    }
    invalidate(); setPending(true)
    const generation = requestGeneration.current
    try {
      const response = await fetch('/api/admin/csat/product-order-draft', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ brief: selection.brief, plan_hash: selection.plan_hash,
          grade, ...fields, order_revision: revision, language_band: languageBand,
          passage_v_level: passageLevel, share_alike: shareAlike, policies,
          ...(exam ? { exam } : {}), ...(resources ? { resources } : {}) }),
      })
      if (!response.ok) {
        if (generation === requestGeneration.current) setError('주문 초안을 봉인하지 못했습니다. 정책 참조·학년·난도를 확인하세요.')
        return
      }
      const next = await response.json() as Draft
      if (generation === requestGeneration.current) setDraft(next)
    } catch { if (generation === requestGeneration.current) setError('주문 초안 요청에 실패했습니다. 연결 상태를 확인하세요.') }
    finally { if (generation === requestGeneration.current) setPending(false) }
  }
  async function register() {
    if (!draft) return
    const generation = requestGeneration.current
    setPending(true); setError(null)
    try {
      const response = await fetch('/api/admin/articles/reading-promotion', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'register-order-document', order: draft.order }),
      })
      const result = await response.json() as { order_hash?: string }
      if (!response.ok || result.order_hash !== draft.order_hash) {
        if (generation === requestGeneration.current) setError('주문 등록이 거부되었거나 hash가 다릅니다. 현재 주문 revision을 확인하세요.')
        return
      }
      // A request already sent to the DB may complete after the operator changes the plan.
      // Preserve its actual receipt instead of presenting that write as a failed/no-op action.
      setRegistrationReceipt({ orderId: String(draft.order.product_order_id),
        revision: Number(draft.order.order_revision), hash: result.order_hash })
    } catch { if (generation === requestGeneration.current) setError('등록 요청에 실패했습니다. 현재 상태를 조회한 뒤 재시도하세요.') }
    finally { if (generation === requestGeneration.current) setPending(false) }
  }

  function downloadDraft() {
    if (!draft) return
    const blob = new Blob([JSON.stringify(draft.order, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `product-order-${String(draft.order.product_order_id).replace(/[^a-z0-9_-]/giu, '_')}-r${revision}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const inputClass = 'mt-1 min-h-[44px] w-full rounded border border-[var(--bd)] bg-[var(--bg)] px-2 text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]'
  return <section aria-labelledby="product-order-registration" className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4">
    <h2 id="product-order-registration" className="font-display text-[16px] font-[800] text-[var(--t1)]">기획안에서 Product Order 등록</h2>
    <p className="mt-2 break-keep text-[13px] text-[var(--t2)]">기획안을 만든 뒤 운영자가 보유한 정책 버전·hash를 입력하세요. 서버는 기획 hash·학년·정책 참조 형식을 확인해 주문을 봉인합니다. 정책의 현재성은 이후 승격 gate에서 재확인합니다.</p>
    {!selection ? <p role="status" className="mt-3 text-[13px] text-[var(--t2)]">먼저 기획안을 생성하세요.</p> : <fieldset disabled={pending}>
      <p className="mt-3 break-all font-mono text-[11px] text-[var(--t2)]">기획 hash {selection.plan_hash}</p>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <label className="text-[13px] text-[var(--t1)]">대상 학년<select value={grade} onChange={event => { setGrade(event.target.value); invalidate() }} className="mt-1 min-h-[44px] w-full rounded border border-[var(--bd)] bg-[var(--bg)] px-2 text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]">{grades.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className="text-[13px] text-[var(--t1)]">주문 revision<input type="number" min={1} value={revision} onChange={event => { setRevision(Number(event.target.value)); invalidate() }} className="mt-1 min-h-[44px] w-full rounded border border-[var(--bd)] bg-[var(--bg)] px-2 text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]" /></label>
        {(Object.keys(labels) as Field[]).map(key => <label key={key} className="text-[13px] text-[var(--t1)]">{labels[key]}<input value={fields[key]} onChange={event => updateField(key, event.target.value)} className={inputClass} /></label>)}
        <label className="text-[13px] text-[var(--t1)]">언어 수준<select value={languageBand} onChange={event => { setLanguageBand(event.target.value); invalidate() }} className="mt-1 min-h-[44px] w-full rounded border border-[var(--bd)] bg-[var(--bg)] px-2 text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]">{['elementary', 'middle', 'high', 'exam'].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className="text-[13px] text-[var(--t1)]">지문 V-Level<input type="number" min={0} max={11} value={passageLevel} onChange={event => { setPassageLevel(Number(event.target.value)); invalidate() }} className="mt-1 min-h-[44px] w-full rounded border border-[var(--bd)] bg-[var(--bg)] px-2 text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]" /></label>
      </div>
      <label className="mt-3 flex min-h-[44px] items-center gap-2 text-[13px] text-[var(--t1)]"><input type="checkbox" className="h-[44px] w-[44px]" checked={shareAlike} onChange={event => { setShareAlike(event.target.checked); invalidate() }} />동일조건 공유 조판</label>
      <div className="mt-3 grid gap-3 lg:grid-cols-[14rem_1fr]">
        <label className="text-[13px] text-[var(--t1)]">시험 목표(P18 등 시간 판단)<select value={exam} onChange={event => { setExam(event.target.value); invalidate() }} className="mt-1 min-h-[44px] w-full rounded border border-[var(--bd)] bg-[var(--bg)] px-2 text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]">
          <option value="">없음</option>{['csat', 'psat_8_9', 'sat', 'act', 'toefl', 'lsat'].map(value => <option key={value} value={value}>{value}</option>)}
        </select></label>
        <label className="text-[13px] text-[var(--t1)]">봉인할 자료(P13·P20 제2 지문, P14 데이터) — JSON 배열, 일자마다 순서대로 순환
          <textarea value={resourcesText} onChange={event => { setResourcesText(event.target.value); invalidate() }} rows={4}
            className="mt-1 min-h-[44px] w-full rounded border border-[var(--bd)] bg-[var(--bg)] p-2 font-mono text-[12px] text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]" />
        </label>
      </div>
      <fieldset className="mt-3"><legend className="font-[700] text-[13px] text-[var(--t1)]">정책·계약 참조 입력</legend><p className="text-[12px] text-[var(--t2)]">운영자가 확인한 버전과 SHA-256을 입력하세요. 이 화면은 참조 형식만 검증합니다.</p>
        {(Object.keys(policyLabels) as Policy[]).map(key => <div key={key} className="mt-2 grid gap-2 lg:grid-cols-[9rem_1fr_2fr]">
          <span className="text-[13px] text-[var(--t1)]">{policyLabels[key]}</span>
          <label className="text-[12px] text-[var(--t2)]">버전<input value={policies[key].version} onChange={event => updatePolicy(key, 'version', event.target.value)} className={inputClass} /></label>
          <label className="text-[12px] text-[var(--t2)]">SHA-256<input value={policies[key].hash} onChange={event => updatePolicy(key, 'hash', event.target.value)} className={`${inputClass} font-mono text-[12px]`} /></label>
        </div>)}</fieldset>
      <button type="button" onClick={() => void preview()} disabled={pending} className="mt-4 min-h-[44px] rounded border border-[var(--p)] px-4 text-[13px] font-[700] text-[var(--p)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)] disabled:opacity-50">{pending ? '확인 중' : '주문 초안 봉인·확인'}</button>
      {draft ? <div role="status" className="mt-3 text-[13px] text-[var(--t2)]"><p>제품 {String(draft.order.product_family)} · 역량 {draft.capability_state} · 학년 {grade}</p><p className="break-all font-mono text-[11px]">주문 hash {draft.order_hash}</p>
        <div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={downloadDraft} className="min-h-[44px] rounded border border-[var(--bd)] px-4 font-[700] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]">봉인 주문 문서 저장</button>
        <button type="button" onClick={() => void register()} disabled={pending} className="min-h-[44px] rounded border border-[var(--p)] px-4 font-[700] text-[var(--p)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)] disabled:opacity-50">현재 주문 등록</button></div></div> : null}
      {error ? <p role="alert" className="mt-3 break-keep text-[13px] text-[var(--memory-risk)]">{error}</p> : null}
    </fieldset>}
    {registrationReceipt ? <p role="status" className="mt-3 break-all text-[13px] text-[var(--t2)]">마지막 등록: {registrationReceipt.orderId} · revision {registrationReceipt.revision} · {registrationReceipt.hash}</p> : null}
  </section>
}
