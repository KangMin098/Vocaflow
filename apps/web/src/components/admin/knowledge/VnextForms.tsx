// apps/web/src/components/admin/knowledge/VnextForms.tsx
// 학습 원리 vNext 쓰기 폼 — 원리 면 · 근거 축 · 탐구 질문 · 입장 · 학습 설계 · 배포 상태 · 롤백 · 검증 실행.
// 규칙 판정은 서버 액션과 DB 트리거가 한다. 여기서는 입력을 모으고 거부 문장을 그대로 보인다.
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  addPositionAction,
  createDesignAction,
  createInquiryAction,
  linkDesignItemAction,
  recordValidationAction,
  rollbackDesignAction,
  setDesignStatusAction,
  setEvidenceAxesAction,
  setFacetAction,
  updateInquiryAction,
  type ActionResult,
} from '@/app/admin/knowledge/vnext-actions'
import {
  DESIGN_ROLES,
  DESIGN_ROLE_LABEL,
  DESIGN_STATUS_LABEL,
  DESIGN_TRANSITIONS,
  FACETS,
  FACET_LABEL,
  FITS,
  FIT_LABEL,
  INQUIRY_STATUSES,
  INQUIRY_STATUS_LABEL,
  LEARNER_MODULES,
  RESEARCH_LEVELS,
  RESEARCH_LEVEL_LABEL,
  STANCES,
  STANCE_LABEL,
  type DesignStatus,
  type Facet,
  type Fit,
  type InquiryStatus,
  type ResearchLevel,
} from '@/lib/knowledge/vnext'

const FIELD =
  'min-h-11 w-full rounded border border-[var(--bd)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]'
// 버튼은 정적 클래스 문자열로 쓴다 — touch-target 회귀가 요소의 리터럴 min-h-11 을 읽는다. 강조는 data-primary · aria-pressed 변형.
const LABEL = 'mb-1 block text-sm text-[var(--t2)]'

function useAction() {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [result, setResult] = useState<ActionResult | null>(null)
  const run = (fn: () => Promise<ActionResult>, onOk?: (r: ActionResult) => void) =>
    start(async () => {
      const r = await fn()
      setResult(r)
      if (r.ok) {
        onOk?.(r)
        router.refresh()
      }
    })
  return { pending, result, run }
}

function Feedback({ result, okText }: { result: ActionResult | null; okText: string }) {
  if (!result) return null
  return (
    <p role={result.ok ? 'status' : 'alert'} className={`mt-2 text-sm ${result.ok ? 'text-[var(--t2)]' : 'text-[var(--error-ink)]'}`}>
      {result.ok ? okText : result.error}
    </p>
  )
}

// ── 원리 면 ──────────────────────────────────────────────────────────
export function FacetPicker({ itemId, facet }: { itemId: string; facet: Facet | null }) {
  const { pending, result, run } = useAction()
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-[var(--t1)]">이 원리는 무엇의 기제인가</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {FACETS.map((f) => (
          <button key={f} type="button" disabled={pending} aria-pressed={facet === f} className="inline-flex min-h-11 items-center justify-center rounded border border-[var(--bd)] px-4 text-sm font-medium text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] disabled:cursor-not-allowed disabled:text-[var(--t3)] aria-pressed:border-[var(--p)] aria-pressed:text-[var(--p)] data-[primary]:border-[var(--p)] data-[primary]:text-[var(--p)]" onClick={() => run(() => setFacetAction({ itemId, facet: f }))}>
            {FACET_LABEL[f]}
          </button>
        ))}
        <button type="button" disabled={pending || facet === null} className="inline-flex min-h-11 items-center justify-center rounded border border-[var(--bd)] px-4 text-sm font-medium text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] disabled:cursor-not-allowed disabled:text-[var(--t3)] aria-pressed:border-[var(--p)] aria-pressed:text-[var(--p)] data-[primary]:border-[var(--p)] data-[primary]:text-[var(--p)]" onClick={() => run(() => setFacetAction({ itemId, facet: null }))}>
          분류 지우기
        </button>
      </div>
      <Feedback result={result} okText="저장했습니다" />
    </fieldset>
  )
}

// ── 근거 축 ──────────────────────────────────────────────────────────
export function EvidenceAxesForm(props: { evidenceId: string; researchLevel: ResearchLevel; fit: Fit; fitNote: string }) {
  const { pending, result, run } = useAction()
  const [level, setLevel] = useState<ResearchLevel>(props.researchLevel)
  const [fit, setFit] = useState<Fit>(props.fit)
  const [note, setNote] = useState(props.fitNote)
  const id = props.evidenceId.slice(0, 8)
  return (
    <div className="mt-2 grid gap-2 md:grid-cols-[1fr_1fr_2fr_auto] md:items-end">
      <label>
        <span className={LABEL}>연구 수준</span>
        <select id={`lv-${id}`} value={level} onChange={(e) => setLevel(e.target.value as ResearchLevel)} className={FIELD}>
          {RESEARCH_LEVELS.map((l) => (
            <option key={l} value={l}>{RESEARCH_LEVEL_LABEL[l]}</option>
          ))}
        </select>
      </label>
      <label>
        <span className={LABEL}>적용 적합성</span>
        <select value={fit} onChange={(e) => setFit(e.target.value as Fit)} className={FIELD}>
          {FITS.map((f) => (
            <option key={f} value={f}>{FIT_LABEL[f]}</option>
          ))}
        </select>
      </label>
      <label>
        <span className={LABEL}>적합성 메모(대상·언어가 다르면 무엇이 다른지)</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} className={FIELD} maxLength={500} />
      </label>
      <button type="button" disabled={pending} className="inline-flex min-h-11 items-center justify-center rounded border border-[var(--bd)] px-4 text-sm font-medium text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] disabled:cursor-not-allowed disabled:text-[var(--t3)] aria-pressed:border-[var(--p)] aria-pressed:text-[var(--p)] data-[primary]:border-[var(--p)] data-[primary]:text-[var(--p)]" onClick={() => run(() => setEvidenceAxesAction({ evidenceId: props.evidenceId, researchLevel: level, fit, fitNote: note }))}>
        저장
      </button>
      <div className="md:col-span-4">
        <Feedback result={result} okText="저장했습니다" />
      </div>
    </div>
  )
}

// ── 탐구 질문 ────────────────────────────────────────────────────────
export function NewInquiryForm({ capabilities }: { capabilities: { id: string; title: string }[] }) {
  const { pending, result, run } = useAction()
  const [slug, setSlug] = useState('')
  const [question, setQuestion] = useState('')
  const [cap, setCap] = useState('')
  return (
    <form
      className="grid gap-3 md:grid-cols-[1fr_2fr_1fr_auto] md:items-end"
      onSubmit={(e) => {
        e.preventDefault()
        run(() => createInquiryAction({ slug, question, capabilityItemId: cap || null }), () => {
          setSlug('')
          setQuestion('')
        })
      }}
    >
      <label>
        <span className={LABEL}>slug</span>
        <input value={slug} onChange={(e) => setSlug(e.target.value)} className={FIELD} placeholder="claim-first-reading" required />
      </label>
      <label>
        <span className={LABEL}>탐구 질문</span>
        <input value={question} onChange={(e) => setQuestion(e.target.value)} className={FIELD} maxLength={500} required />
      </label>
      <label>
        <span className={LABEL}>대상 역량</span>
        <select value={cap} onChange={(e) => setCap(e.target.value)} className={FIELD}>
          <option value="">없음</option>
          {capabilities.map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={pending} data-primary
        className="inline-flex min-h-11 items-center justify-center rounded border border-[var(--bd)] px-4 text-sm font-medium text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] disabled:cursor-not-allowed disabled:text-[var(--t3)] aria-pressed:border-[var(--p)] aria-pressed:text-[var(--p)] data-[primary]:border-[var(--p)] data-[primary]:text-[var(--p)]">질문 열기</button>
      <div className="md:col-span-4">
        <Feedback result={result} okText="질문을 열었습니다" />
      </div>
    </form>
  )
}

export function InquiryEditor(props: { id: string; updatedAt: string; status: InquiryStatus; conclusion: string; uncertainty: string; nextAction: string }) {
  const { pending, result, run } = useAction()
  const [status, setStatus] = useState<InquiryStatus>(props.status)
  const [conclusion, setConclusion] = useState(props.conclusion)
  const [uncertainty, setUncertainty] = useState(props.uncertainty)
  const [nextAction, setNextAction] = useState(props.nextAction)
  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        run(() => updateInquiryAction({ id: props.id, seenUpdatedAt: props.updatedAt, status, conclusion, uncertainty, nextAction }))
      }}
    >
      <label>
        <span className={LABEL}>상태</span>
        <select value={status} onChange={(e) => setStatus(e.target.value as InquiryStatus)} className={FIELD}>
          {INQUIRY_STATUSES.map((s) => (
            <option key={s} value={s}>{INQUIRY_STATUS_LABEL[s]}</option>
          ))}
        </select>
      </label>
      <label>
        <span className={LABEL}>결론 후보(사람이 쓴다 · AI 합의만으로 확정하지 않는다)</span>
        <textarea value={conclusion} onChange={(e) => setConclusion(e.target.value)} rows={3} className={FIELD} maxLength={2000} />
      </label>
      <label>
        <span className={LABEL}>불확실성 — 무엇이 이 결론을 뒤집을 수 있나(결론에 필수)</span>
        <textarea value={uncertainty} onChange={(e) => setUncertainty(e.target.value)} rows={2} className={FIELD} maxLength={1000} />
      </label>
      <label>
        <span className={LABEL}>다음 행동</span>
        <input value={nextAction} onChange={(e) => setNextAction(e.target.value)} className={FIELD} maxLength={500} />
      </label>
      <button type="submit" disabled={pending} data-primary
        className="inline-flex min-h-11 items-center justify-center rounded border border-[var(--bd)] px-4 text-sm font-medium text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] disabled:cursor-not-allowed disabled:text-[var(--t3)] aria-pressed:border-[var(--p)] aria-pressed:text-[var(--p)] data-[primary]:border-[var(--p)] data-[primary]:text-[var(--p)]">저장</button>
      <Feedback result={result} okText="저장했습니다" />
    </form>
  )
}

export function PositionForm({ inquiryId }: { inquiryId: string }) {
  const { pending, result, run } = useAction()
  const [itemSlug, setItemSlug] = useState('')
  const [evidenceId, setEvidenceId] = useState('')
  const [stance, setStance] = useState<string>('supports')
  const [note, setNote] = useState('')
  return (
    <form
      className="grid gap-3 md:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault()
        run(() => addPositionAction({ inquiryId, itemSlug: itemSlug || undefined, evidenceId: evidenceId || undefined, stance, note }), () => {
          setNote('')
          setItemSlug('')
          setEvidenceId('')
        })
      }}
    >
      <label>
        <span className={LABEL}>항목 slug(주장·방법 단위)</span>
        <input value={itemSlug} onChange={(e) => setItemSlug(e.target.value)} className={FIELD} />
      </label>
      <label>
        <span className={LABEL}>또는 근거 id(출처 하나)</span>
        <input value={evidenceId} onChange={(e) => setEvidenceId(e.target.value)} className={FIELD} />
      </label>
      <fieldset className="md:col-span-2">
        <legend className={LABEL}>입장</legend>
        <div className="flex flex-wrap gap-2">
          {STANCES.map((s) => (
            <button key={s} type="button" aria-pressed={stance === s} className="inline-flex min-h-11 items-center justify-center rounded border border-[var(--bd)] px-4 text-sm font-medium text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] disabled:cursor-not-allowed disabled:text-[var(--t3)] aria-pressed:border-[var(--p)] aria-pressed:text-[var(--p)] data-[primary]:border-[var(--p)] data-[primary]:text-[var(--p)]" onClick={() => setStance(s)}>
              {STANCE_LABEL[s]}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="md:col-span-2">
        <span className={LABEL}>왜 이 입장인가(재서술 — 원문을 옮기지 않는다)</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={FIELD} maxLength={1000} required />
      </label>
      <button type="submit" disabled={pending} data-primary
        className="inline-flex min-h-11 items-center justify-center rounded border border-[var(--bd)] px-4 text-sm font-medium text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] disabled:cursor-not-allowed disabled:text-[var(--t3)] aria-pressed:border-[var(--p)] aria-pressed:text-[var(--p)] data-[primary]:border-[var(--p)] data-[primary]:text-[var(--p)]">입장 더하기</button>
      <div className="md:col-span-2">
        <Feedback result={result} okText="더했습니다" />
      </div>
    </form>
  )
}

// ── 학습 설계 ────────────────────────────────────────────────────────
export function NewDesignForm({ inquiries }: { inquiries: { id: string; question: string }[] }) {
  const { pending, result, run } = useAction()
  const mod = LEARNER_MODULES.csat_claim_evidence
  const [slug, setSlug] = useState('')
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [procedure, setProcedure] = useState('')
  const [train, setTrain] = useState<string[]>([])
  const [transfer, setTransfer] = useState<string[]>([])
  const [inquiry, setInquiry] = useState('')
  const toggle = (xs: string[], x: string) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x])
  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        run(() =>
          createDesignAction({ slug, title, learnerSummary: summary, procedure, moduleKey: 'csat_claim_evidence', trainTypeIds: train, transferTypeIds: transfer, inquiryId: inquiry || null }),
        )
      }}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <label>
          <span className={LABEL}>slug</span>
          <input value={slug} onChange={(e) => setSlug(e.target.value)} className={FIELD} required />
        </label>
        <label>
          <span className={LABEL}>제목(학습자에게 보인다)</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={FIELD} maxLength={120} required />
        </label>
      </div>
      <label>
        <span className={LABEL}>추천 이유(학습자에게 보인다 — 근거 등급·관리자 용어 없이)</span>
        <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={2} className={FIELD} maxLength={600} required />
      </label>
      <label>
        <span className={LABEL}>절차 — 한 줄에 한 단계, 「제목 — 설명」</span>
        <textarea value={procedure} onChange={(e) => setProcedure(e.target.value)} rows={4} className={FIELD} required />
      </label>
      <p className="text-sm text-[var(--t2)]">학습자 모듈: {mod.label}(코드에 있는 모듈만)</p>
      {(['train', 'transfer'] as const).map((k) => (
        <fieldset key={k}>
          <legend className={LABEL}>{k === 'train' ? '훈련 유형' : '전이 유형(훈련하지 않고 옮겨 보는 유형)'}</legend>
          <div className="flex flex-wrap gap-2">
            {mod.typeIds.map((t) => {
              const on = (k === 'train' ? train : transfer).includes(t)
              return (
                <button key={t} type="button" aria-pressed={on} className="inline-flex min-h-11 items-center justify-center rounded border border-[var(--bd)] px-4 text-sm font-medium text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] disabled:cursor-not-allowed disabled:text-[var(--t3)] aria-pressed:border-[var(--p)] aria-pressed:text-[var(--p)] data-[primary]:border-[var(--p)] data-[primary]:text-[var(--p)]" onClick={() => (k === 'train' ? setTrain(toggle(train, t)) : setTransfer(toggle(transfer, t)))}>
                  {t}
                </button>
              )
            })}
          </div>
        </fieldset>
      ))}
      <label>
        <span className={LABEL}>탐구 질문</span>
        <select value={inquiry} onChange={(e) => setInquiry(e.target.value)} className={FIELD}>
          <option value="">없음</option>
          {inquiries.map((q) => (
            <option key={q.id} value={q.id}>{q.question}</option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={pending} data-primary
        className="inline-flex min-h-11 items-center justify-center rounded border border-[var(--bd)] px-4 text-sm font-medium text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] disabled:cursor-not-allowed disabled:text-[var(--t3)] aria-pressed:border-[var(--p)] aria-pressed:text-[var(--p)] data-[primary]:border-[var(--p)] data-[primary]:text-[var(--p)]">초안으로 만들기</button>
      <Feedback result={result} okText="초안을 만들었습니다" />
    </form>
  )
}

export function DesignLinkForm({ designId }: { designId: string }) {
  const { pending, result, run } = useAction()
  const [slug, setSlug] = useState('')
  const [role, setRole] = useState<string>('method')
  return (
    <form
      className="grid gap-3 md:grid-cols-[2fr_1fr_auto] md:items-end"
      onSubmit={(e) => {
        e.preventDefault()
        run(() => linkDesignItemAction({ designId, itemSlug: slug, role }), () => setSlug(''))
      }}
    >
      <label>
        <span className={LABEL}>항목 slug</span>
        <input value={slug} onChange={(e) => setSlug(e.target.value)} className={FIELD} required />
      </label>
      <label>
        <span className={LABEL}>역할</span>
        <select value={role} onChange={(e) => setRole(e.target.value)} className={FIELD}>
          {DESIGN_ROLES.map((r) => (
            <option key={r} value={r}>{DESIGN_ROLE_LABEL[r]}</option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={pending} className="inline-flex min-h-11 items-center justify-center rounded border border-[var(--bd)] px-4 text-sm font-medium text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] disabled:cursor-not-allowed disabled:text-[var(--t3)] aria-pressed:border-[var(--p)] aria-pressed:text-[var(--p)] data-[primary]:border-[var(--p)] data-[primary]:text-[var(--p)]">잇기</button>
      <div className="md:col-span-3">
        <Feedback result={result} okText="이었습니다" />
      </div>
    </form>
  )
}

export function DesignStatusActions({ designId, status, version, readyToDeploy }: { designId: string; status: DesignStatus; version: number; readyToDeploy: boolean }) {
  const { pending, result, run } = useAction()
  const [reason, setReason] = useState('')
  return (
    <section aria-labelledby="design-status">
      <h2 id="design-status" className="mb-2 text-sm font-semibold text-[var(--t1)]">
        상태 — {DESIGN_STATUS_LABEL[status]} · v{version}
      </h2>
      <label className={LABEL} htmlFor="design-reason">이유(중단·종료는 필수)</label>
      <textarea id="design-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className={FIELD} />
      <div className="mt-2 flex flex-wrap gap-2">
        {DESIGN_TRANSITIONS[status].map((to) => (
          <button
            key={to}
            type="button"
            disabled={pending || (to === 'deployed' && !readyToDeploy)}
            data-primary={to === 'deployed' || undefined}
            className="inline-flex min-h-11 items-center justify-center rounded border border-[var(--bd)] px-4 text-sm font-medium text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] disabled:cursor-not-allowed disabled:text-[var(--t3)] aria-pressed:border-[var(--p)] aria-pressed:text-[var(--p)] data-[primary]:border-[var(--p)] data-[primary]:text-[var(--p)]"
            onClick={() => run(() => setDesignStatusAction({ designId, from: status, to, seenVersion: version, reason }), () => setReason(''))}
          >
            {DESIGN_STATUS_LABEL[to]}(으)로
          </button>
        ))}
      </div>
      {!readyToDeploy && DESIGN_TRANSITIONS[status].includes('deployed') && (
        <p className="mt-2 text-sm text-[var(--t2)]">배포 문턱을 넘지 못했다 — 위 「막는 이유」를 먼저 푼다.</p>
      )}
      <Feedback result={result} okText="바꿨습니다" />
    </section>
  )
}

export function RollbackButton({ designId, deploymentId, version, label }: { designId: string; deploymentId: string; version: number; label: string }) {
  const { pending, result, run } = useAction()
  return (
    <div>
      <button type="button" disabled={pending} className="inline-flex min-h-11 items-center justify-center rounded border border-[var(--bd)] px-4 text-sm font-medium text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] disabled:cursor-not-allowed disabled:text-[var(--t3)] aria-pressed:border-[var(--p)] aria-pressed:text-[var(--p)] data-[primary]:border-[var(--p)] data-[primary]:text-[var(--p)]" onClick={() => run(() => rollbackDesignAction({ designId, deploymentId, seenVersion: version }))}>
        {label}
      </button>
      <Feedback result={result} okText="되돌렸습니다 — 배포 준비 상태입니다" />
    </div>
  )
}

export function ValidationButton({ designId }: { designId: string }) {
  const { pending, result, run } = useAction()
  return (
    <div>
      <button type="button" disabled={pending} data-primary
        className="inline-flex min-h-11 items-center justify-center rounded border border-[var(--bd)] px-4 text-sm font-medium text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] disabled:cursor-not-allowed disabled:text-[var(--t3)] aria-pressed:border-[var(--p)] aria-pressed:text-[var(--p)] data-[primary]:border-[var(--p)] data-[primary]:text-[var(--p)]" onClick={() => run(() => recordValidationAction({ designId }))}>
        지금 기록으로 검증 실행 남기기
      </button>
      <Feedback result={result} okText={`남겼습니다${result?.ok && result.data ? ` — ${(result.data as { verdict: string }).verdict}` : ''}`} />
    </div>
  )
}
