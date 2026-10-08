// apps/web/src/components/admin/knowledge/VnextForms.tsx
// 학습 원리 vNext 입력 폼(2026-10-08) — 탐구 질문 · 연결 · 결론 · 연구 서지 · 연구 근거 · 근거 축 · 종류 · 제품 적용 · 상태 · 검증 계획.
// 실패는 DB 트리거 문장까지 그대로 보여 준다(무엇이 막았는지 알게). 44px 터치 타겟 · 보이는 focus.
'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition, type ReactNode } from 'react'

import {
  addResearchEvidenceAction, createApplicationAction, createInquiryAction, createResearchSourceAction, createTrialAction,
  linkInquiryAction, setApplicationStatusAction, setEvidenceAxesAction, setInquiryStatusAction, setItemKindAction,
} from '@/app/admin/knowledge/vnext-actions'
import {
  APPLICABILITY, APPLICABILITY_LABEL, APP_STATUS_LABEL, APP_SURFACES, APP_SURFACE_LABEL, APP_TRANSITIONS, EXTERNAL_LEVELS, EVIDENCE_LEVEL_LABEL,
  INQUIRY_ROLES, INQUIRY_ROLE_LABEL, INQUIRY_STATUSES, INQUIRY_STATUS_LABEL, KIND_LABEL, RESEARCH_DESIGNS, RESEARCH_DESIGN_LABEL,
  type AppStatus, type Kind,
} from '@/lib/knowledge/vnext-labels'

const FIELD = 'mt-1 block min-h-11 w-full rounded border border-[var(--bd)] bg-transparent px-3 py-2 text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]'
const BTN = 'inline-flex min-h-11 items-center rounded border border-[var(--p)] px-4 text-sm font-medium text-[var(--p)] disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]'
const LABEL = 'text-sm text-[var(--t2)]'

function useSubmit() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okText = '저장했습니다', after?: () => void) =>
    start(async () => {
      setError(null); setDone(null)
      const r = await fn()
      if (!r.ok) { setError(r.error ?? '실패'); return }
      setDone(okText)
      after?.()
      router.refresh()
    })
  const status = (
    <>
      {error && <p role="alert" className="text-sm text-[var(--error)]">{error}</p>}
      {done && <p role="status" className="text-sm text-[var(--t2)]">{done}</p>}
    </>
  )
  return { run, pending, status }
}

function Box({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-6 grid gap-3 border-y border-[var(--bd)] py-5">
      <h3 className="font-semibold text-[var(--t1)]">{title}</h3>
      {children}
    </section>
  )
}

export function InquiryForm({ skills }: { skills: { id: string; label: string }[] }) {
  const { run, pending, status } = useSubmit()
  const [slug, setSlug] = useState('')
  const [question, setQuestion] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  return (
    <Box title="새 탐구 질문">
      <label className={LABEL}>질문 — 무엇을 알고 싶은가(답이 아니라 물음)
        <textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={2} maxLength={500} className={FIELD} />
      </label>
      <label className={LABEL}>주소 이름(영소문자 · 숫자 · 하이픈)
        <input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} className={FIELD} />
      </label>
      <fieldset className="flex flex-wrap gap-3 text-sm text-[var(--t1)]">
        <legend className={LABEL}>영역</legend>
        {skills.map((s) => (
          <label key={s.id} className="inline-flex min-h-11 items-center gap-2">
            <input type="checkbox" className="h-4 w-4 accent-[var(--p)]" checked={picked.includes(s.id)} onChange={() => setPicked(picked.includes(s.id) ? picked.filter((x) => x !== s.id) : [...picked, s.id])} />
            {s.label}
          </label>
        ))}
      </fieldset>
      <div><button type="button" className={BTN} disabled={pending} onClick={() => run(() => createInquiryAction({ slug, question, skillIds: picked }), '질문을 열었습니다', () => { setSlug(''); setQuestion(''); setPicked([]) })}>질문 열기</button></div>
      {status}
    </Box>
  )
}

export function InquiryLinkForm({ inquiryId, evidenceOptions }: { inquiryId: string; evidenceOptions: { id: string; label: string }[] }) {
  const { run, pending, status } = useSubmit()
  const [mode, setMode] = useState<'item' | 'evidence'>('item')
  const [itemSlug, setItemSlug] = useState('')
  const [evidenceId, setEvidenceId] = useState('')
  const [role, setRole] = useState<string>('support')
  const [note, setNote] = useState('')
  return (
    <Box title="주장 · 근거 잇기">
      <fieldset className="flex flex-wrap gap-4 text-sm text-[var(--t1)]">
        <legend className={LABEL}>무엇을</legend>
        <label className="inline-flex min-h-11 items-center gap-2"><input type="radio" name="m" className="h-4 w-4 accent-[var(--p)]" checked={mode === 'item'} onChange={() => setMode('item')} />항목(주장 · 결론 후보)</label>
        <label className="inline-flex min-h-11 items-center gap-2"><input type="radio" name="m" className="h-4 w-4 accent-[var(--p)]" checked={mode === 'evidence'} onChange={() => setMode('evidence')} />근거 한 건</label>
      </fieldset>
      {mode === 'item' ? (
        <label className={LABEL}>항목 주소 이름<input value={itemSlug} onChange={(e) => setItemSlug(e.target.value)} className={FIELD} /></label>
      ) : (
        <label className={LABEL}>근거
          <select value={evidenceId} onChange={(e) => setEvidenceId(e.target.value)} className={FIELD}>
            <option value="">고른다</option>
            {evidenceOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </label>
      )}
      <label className={LABEL}>역할
        <select value={role} onChange={(e) => setRole(e.target.value)} className={FIELD}>
          {INQUIRY_ROLES.map((r) => <option key={r} value={r}>{INQUIRY_ROLE_LABEL[r]}</option>)}
        </select>
      </label>
      <label className={LABEL}>메모(충돌 · 조건 · 불확실성)<input value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} className={FIELD} /></label>
      <div><button type="button" className={BTN} disabled={pending} onClick={() => run(() => linkInquiryAction({ inquiryId, itemSlug: mode === 'item' ? itemSlug : null, evidenceId: mode === 'evidence' ? evidenceId || null : null, role, note }), '이었습니다', () => { setItemSlug(''); setNote('') })}>잇기</button></div>
      {status}
    </Box>
  )
}

export function InquiryStatusForm({ id, from, candidates }: { id: string; from: string; candidates: { slug: string; title: string }[] }) {
  const { run, pending, status } = useSubmit()
  const [to, setTo] = useState<string>(from)
  const [conclusion, setConclusion] = useState('')
  const [uncertainty, setUncertainty] = useState('')
  return (
    <Box title="상태 · 결론">
      <label className={LABEL}>상태
        <select value={to} onChange={(e) => setTo(e.target.value)} className={FIELD}>
          {INQUIRY_STATUSES.map((s) => <option key={s} value={s}>{INQUIRY_STATUS_LABEL[s]}</option>)}
        </select>
      </label>
      {to === 'concluded' && (
        <label className={LABEL}>결론 항목(결론 후보로 이은 항목 중)
          <select value={conclusion} onChange={(e) => setConclusion(e.target.value)} className={FIELD}>
            <option value="">고른다</option>
            {candidates.map((c) => <option key={c.slug} value={c.slug}>{c.title}</option>)}
          </select>
        </label>
      )}
      <label className={LABEL}>남은 불확실성(결론이어도 적는다)<textarea value={uncertainty} onChange={(e) => setUncertainty(e.target.value)} rows={2} maxLength={1500} className={FIELD} /></label>
      <div><button type="button" className={BTN} disabled={pending} onClick={() => run(() => setInquiryStatusAction({ id, from, to, conclusionItemSlug: conclusion || null, uncertainty }))}>저장</button></div>
      {status}
    </Box>
  )
}

export function ResearchSourceForm() {
  const { run, pending, status } = useSubmit()
  const [f, setF] = useState({ citation: '', doi: '', url: '', design: 'meta_analysis', population: '', l2Context: 'unknown' as 'yes' | 'no' | 'unknown', year: '', note: '' })
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  return (
    <Box title="새 연구 서지">
      <label className={LABEL}>인용(저자 · 연도 · 제목 · 학술지)<input value={f.citation} onChange={set('citation')} maxLength={600} className={FIELD} /></label>
      <div className="grid gap-3 md:grid-cols-3">
        <label className={LABEL}>DOI<input value={f.doi} onChange={set('doi')} placeholder="10.xxxx/…" className={FIELD} /></label>
        <label className={LABEL}>URL(https)<input value={f.url} onChange={set('url')} className={FIELD} /></label>
        <label className={LABEL}>연도<input value={f.year} onChange={set('year')} inputMode="numeric" className={FIELD} /></label>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <label className={LABEL}>연구 설계(이후 바꿀 수 없다)
          <select value={f.design} onChange={set('design')} className={FIELD}>{RESEARCH_DESIGNS.map((d) => <option key={d} value={d}>{RESEARCH_DESIGN_LABEL[d]}</option>)}</select>
        </label>
        <label className={LABEL}>제2언어 학습 맥락
          <select value={f.l2Context} onChange={set('l2Context')} className={FIELD}><option value="unknown">미확인</option><option value="yes">예</option><option value="no">아니오</option></select>
        </label>
        <label className={LABEL}>대상 · 표본<input value={f.population} onChange={set('population')} maxLength={300} className={FIELD} /></label>
      </div>
      <label className={LABEL}>메모<input value={f.note} onChange={set('note')} maxLength={1000} className={FIELD} /></label>
      <div><button type="button" className={BTN} disabled={pending} onClick={() => run(() => createResearchSourceAction(f), '서지를 등록했습니다')}>등록</button></div>
      {status}
    </Box>
  )
}

export function ResearchEvidenceForm({ itemId, sources }: { itemId: string; sources: { id: string; label: string }[] }) {
  const { run, pending, status } = useSubmit()
  const [f, setF] = useState({ researchSourceId: '', grade: 'B', attribution: 'stated', applicability: 'unknown', applicabilityNote: '', locator: '' })
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  return (
    <Box title="연구 근거 붙이기 — 수준은 서지 설계에서 자동">
      <label className={LABEL}>연구 서지
        <select value={f.researchSourceId} onChange={set('researchSourceId')} className={FIELD}><option value="">고른다</option>{sources.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
      </label>
      <div className="grid gap-3 md:grid-cols-3">
        <label className={LABEL}>출처 확인도<select value={f.grade} onChange={set('grade')} className={FIELD}><option value="A">A 해당 부분 대조</option><option value="B">B 서지만 확인</option><option value="C">C 계보</option></select></label>
        <label className={LABEL}>귀속<select value={f.attribution} onChange={set('attribution')} className={FIELD}><option value="stated">출처가 직접 말함</option><option value="observed">관찰</option><option value="inferred">분석자 추론</option></select></label>
        <label className={LABEL}>적용 적합성<select value={f.applicability} onChange={set('applicability')} className={FIELD}>{APPLICABILITY.map((a) => <option key={a} value={a}>{APPLICABILITY_LABEL[a]}</option>)}</select></label>
      </div>
      <label className={LABEL}>적합성 메모(대상 언어 · 학령 · 맥락)<input value={f.applicabilityNote} onChange={set('applicabilityNote')} maxLength={500} className={FIELD} /></label>
      <label className={LABEL}>위치(쪽 · 절 · 표)<input value={f.locator} onChange={set('locator')} maxLength={200} className={FIELD} /></label>
      <div><button type="button" className={BTN} disabled={pending || !f.researchSourceId} onClick={() => run(() => addResearchEvidenceAction({ itemId, ...f }), '연구 근거를 붙였습니다')}>붙이기</button></div>
      {status}
    </Box>
  )
}

export function EvidenceAxesForm({ evidenceId, external, applicability, note, level }: { evidenceId: string; external: boolean; applicability: string; note: string | null; level: string }) {
  const { run, pending, status } = useSubmit()
  const [a, setA] = useState(applicability)
  const [n, setN] = useState(note ?? '')
  const [l, setL] = useState(level)
  return (
    <div className="mt-2 flex flex-wrap items-end gap-2" data-testid="evidence-axes">
      <label className="text-xs text-[var(--t2)]">적용 적합성
        <select value={a} onChange={(e) => setA(e.target.value)} className={FIELD}>{APPLICABILITY.map((x) => <option key={x} value={x}>{APPLICABILITY_LABEL[x]}</option>)}</select>
      </label>
      {external && (
        <label className="text-xs text-[var(--t2)]">수준(외부 근거)
          <select value={l} onChange={(e) => setL(e.target.value)} className={FIELD}>{EXTERNAL_LEVELS.map((x) => <option key={x} value={x}>{EVIDENCE_LEVEL_LABEL[x]}</option>)}</select>
        </label>
      )}
      <label className="text-xs text-[var(--t2)]">메모<input value={n} onChange={(e) => setN(e.target.value)} maxLength={500} className={FIELD} /></label>
      <button type="button" className={BTN} disabled={pending} onClick={() => run(() => setEvidenceAxesAction({ evidenceId, applicability: a, applicabilityNote: n, evidenceLevel: external ? l : null }))}>축 저장</button>
      {status}
    </div>
  )
}

export function KindForm({ itemId, options, current }: { itemId: string; options: readonly Kind[]; current: Kind | null }) {
  const { run, pending, status } = useSubmit()
  const [k, setK] = useState<string>(current ?? options[0])
  if (options.length < 2 && current) return null
  return (
    <div className="flex flex-wrap items-end gap-2" data-testid="kind-form">
      <label className="text-sm text-[var(--t2)]">종류{current ? '' : ' — 아직 미분류'}
        <select value={k} onChange={(e) => setK(e.target.value)} className={FIELD}>{options.map((o) => <option key={o} value={o}>{KIND_LABEL[o]}</option>)}</select>
      </label>
      <button type="button" className={BTN} disabled={pending} onClick={() => run(() => setItemKindAction({ itemId, kind: k }))}>종류 저장</button>
      {status}
    </div>
  )
}

export function ApplicationForm({ itemOptions }: { itemOptions: { slug: string; label: string }[] }) {
  const { run, pending, status } = useSubmit()
  const [f, setF] = useState({ itemSlug: '', surface: 'csat_item_task', surfaceRef: '', audience: '', exclusions: '' })
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  return (
    <Box title="새 적용 초안 — 학습자에게는 채택 · 검증 계획 · 켜기 뒤에만 나간다">
      <label className={LABEL}>항목(과제 · 방법)
        <select value={f.itemSlug} onChange={set('itemSlug')} className={FIELD}><option value="">고른다</option>{itemOptions.map((o) => <option key={o.slug} value={o.slug}>{o.label}</option>)}</select>
      </label>
      <div className="grid gap-3 md:grid-cols-2">
        <label className={LABEL}>적용 표면<select value={f.surface} onChange={set('surface')} className={FIELD}>{APP_SURFACES.map((s) => <option key={s} value={s}>{APP_SURFACE_LABEL[s]}</option>)}</select></label>
        <label className={LABEL}>과제 키<input value={f.surfaceRef} onChange={set('surfaceRef')} placeholder="claim-evidence-v1" className={FIELD} /></label>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className={LABEL}>대상 조건(JSON)<input value={f.audience} onChange={set('audience')} placeholder='{"exam":"suneung"}' className={FIELD} /></label>
        <label className={LABEL}>제외 조건(JSON)<input value={f.exclusions} onChange={set('exclusions')} placeholder='{"listening":true}' className={FIELD} /></label>
      </div>
      <div><button type="button" className={BTN} disabled={pending || !f.itemSlug} onClick={() => run(() => createApplicationAction(f), '적용 초안을 만들었습니다')}>초안 만들기</button></div>
      {status}
    </Box>
  )
}

export function ApplicationStatusForm({ id, from }: { id: string; from: AppStatus }) {
  const { run, pending, status } = useSubmit()
  const [reason, setReason] = useState('')
  const next = APP_TRANSITIONS[from]
  if (next.length === 0) return null
  return (
    <div className="flex flex-wrap items-end gap-2" data-testid={`app-status-${id}`}>
      <label className="text-xs text-[var(--t2)]">이유(중단 · 롤백 필수)<input value={reason} onChange={(e) => setReason(e.target.value)} className={FIELD} /></label>
      {next.map((to) => (
        <button key={to} type="button" className={BTN} disabled={pending} onClick={() => run(() => setApplicationStatusAction({ id, from, to, reason }))}>
          {to === 'active' ? '학습자에게 켜기' : APP_STATUS_LABEL[to]}
        </button>
      ))}
      {status}
    </div>
  )
}

export function TrialForm({ applications }: { applications: { id: string; label: string }[] }) {
  const { run, pending, status } = useSubmit()
  const [f, setF] = useState({ applicationId: '', delayed: '14', transfer: true, comparison: '', minN: '30', measures: '', synthetic: false })
  return (
    <Box title="효과 검증 계획 — 사전 · 사후 필수, 비교 조건이 없으면 「관찰된 변화」로만 보고">
      <label className={LABEL}>적용
        <select value={f.applicationId} onChange={(e) => setF({ ...f, applicationId: e.target.value })} className={FIELD}><option value="">고른다</option>{applications.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</select>
      </label>
      <div className="grid gap-3 md:grid-cols-3">
        <label className={LABEL}>지연 평가(일 · 비우면 없음)<input value={f.delayed} onChange={(e) => setF({ ...f, delayed: e.target.value })} inputMode="numeric" className={FIELD} /></label>
        <label className={LABEL}>최소 표본(실제 학습자)<input value={f.minN} onChange={(e) => setF({ ...f, minN: e.target.value })} inputMode="numeric" className={FIELD} /></label>
        <label className="inline-flex min-h-11 items-center gap-2 text-sm text-[var(--t1)]"><input type="checkbox" className="h-4 w-4 accent-[var(--p)]" checked={f.transfer} onChange={(e) => setF({ ...f, transfer: e.target.checked })} />전이 평가(미연습 문항)</label>
      </div>
      <label className={LABEL}>비교 조건(예: 같은 기간 과제 안 한 주장형 문항 · 비우면 없음)<input value={f.comparison} onChange={(e) => setF({ ...f, comparison: e.target.value })} className={FIELD} /></label>
      <label className={LABEL}>측정 지표(쉼표로)<input value={f.measures} onChange={(e) => setF({ ...f, measures: e.target.value })} placeholder="주장형 문항 정답률, 근거 문장 선택 정답률" className={FIELD} /></label>
      <label className="inline-flex min-h-11 items-center gap-2 text-sm text-[var(--t1)]"><input type="checkbox" className="h-4 w-4 accent-[var(--p)]" checked={f.synthetic} onChange={(e) => setF({ ...f, synthetic: e.target.checked })} />합성 학습자 실행(경로 검증용 — 효과 판정에 못 쓴다)</label>
      <div>
        <button type="button" className={BTN} disabled={pending || !f.applicationId} onClick={() => run(() => createTrialAction({
          applicationId: f.applicationId, synthetic: f.synthetic,
          design: { pre: true, post: true, delayedDays: f.delayed.trim() ? Number(f.delayed) : null, transfer: f.transfer, comparison: f.comparison.trim() || null, minN: Number(f.minN), measures: f.measures.split(',').map((s) => s.trim()).filter(Boolean) },
        }), '검증 계획을 만들었습니다')}>계획 저장</button>
      </div>
      {status}
    </Box>
  )
}
