// apps/web/src/components/admin/knowledge/ItemEditor.tsx
// 항목 상세의 쓰기 폼 — 상태 변경 · 층 연결 · 근거 추가. 규칙 판정은 서버 액션(lib/knowledge/rules)이 한다.
'use client'

import { useState, useTransition } from 'react'
import {
  addCsatEvidenceAction,
  addExternalEvidenceAction,
  addLinkAction,
  editStatementAction,
  setItemStatusAction,
  type ActionResult,
} from '@/app/admin/knowledge/actions'
import { ATTRIBUTIONS, ATTRIBUTION_LABEL, LAYER_LABEL, LAYER_RANK, STATUS_LABEL, type ItemStatus, type Layer } from '@/lib/knowledge/labels'
import { TRANSITIONS } from '@/lib/knowledge/rules'

const FIELD =
  'min-h-11 w-full rounded border border-[var(--bd)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]'
const BUTTON =
  'inline-flex min-h-11 items-center justify-center rounded border px-4 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] disabled:cursor-not-allowed disabled:text-[var(--t3)]'

function useAction() {
  const [pending, start] = useTransition()
  const [result, setResult] = useState<ActionResult | null>(null)
  const run = (fn: () => Promise<ActionResult>, onOk?: () => void) =>
    start(async () => {
      const r = await fn()
      setResult(r)
      if (r.ok) onOk?.()
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

/** 문장 고치기 — 채택 · 적용 중이면 자신과 아래 층이 재검토로 돌아간다(되돌릴 수 없다: 다시 채택해야 한다) */
export function StatementForm({ itemId, statement, version, live }: { itemId: string; statement: string; version: number; live: boolean }) {
  const { pending, result, run } = useAction()
  const [text, setText] = useState(statement)
  const cascaded = result?.ok ? ((result.data as { cascaded?: string[] } | undefined)?.cascaded ?? []) : []
  return (
    <section aria-labelledby="statement-form">
      <h2 id="statement-form" className="mb-2 text-sm font-semibold text-[var(--t1)]">문장 고치기 (v{version})</h2>
      {live && <p className="mb-2 text-sm text-[var(--t2)]">채택된 문장이다 — 고치면 이 항목과 이것을 구현하는 아래 층이 모두 「검토 중」으로 돌아가고 학습자 적용이 자동 중단된다.</p>}
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={1500} className={FIELD} aria-label="항목 문장" />
      <button type="button" disabled={pending || text.trim() === statement} onClick={() => run(() => editStatementAction(itemId, text, version))} className={`${BUTTON} mt-2 border-[var(--bd)] text-[var(--t1)]`}>
        문장 저장
      </button>
      <Feedback result={result} okText={cascaded.length ? `저장했습니다. 연쇄 재검토: ${cascaded.join(', ')}` : '저장했습니다.'} />
    </section>
  )
}

export function StatusActions({
  itemId,
  status,
  evidenceVersion,
  version,
}: {
  itemId: string
  status: ItemStatus
  /** 화면이 그릴 때 읽은 근거 버전 — 채택 요청에 실어 그 사이 근거가 바뀌었으면 거부된다 */
  evidenceVersion: number
  /** 화면이 그릴 때 읽은 문장 버전 — 그 사이 문장이 바뀌었으면 거부된다 */
  version: number
}) {
  const { pending, result, run } = useAction()
  const [reason, setReason] = useState('')
  const next = TRANSITIONS[status]
  return (
    <section aria-labelledby="status-actions">
      <h2 id="status-actions" className="mb-2 text-sm font-semibold text-[var(--t1)]">
        상태 — {STATUS_LABEL[status]}
      </h2>
      <label className="mb-2 block text-sm text-[var(--t2)]" htmlFor="status-reason">
        이유 (반려는 필수)
      </label>
      <textarea
        id="status-reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        className={FIELD}
      />
      <div className="mt-2 flex flex-wrap gap-2">
        {next.map((to) => (
          <button
            key={to}
            type="button"
            disabled={pending}
            onClick={() => run(() => setItemStatusAction(itemId, to, reason, evidenceVersion, version), () => setReason(''))}
            className={`${BUTTON} ${to === 'adopted' || to === 'applied' ? 'border-[var(--p)] text-[var(--p)]' : 'border-[var(--bd)] text-[var(--t1)]'}`}
          >
            {STATUS_LABEL[to]}(으)로
          </button>
        ))}
      </div>
      <Feedback result={result} okText="바꿨습니다. 검토 기록에 남았습니다." />
    </section>
  )
}

interface Candidate {
  id: string
  title: string
  layer: Layer
}

export function LinkForm({ itemId, layer, candidates }: { itemId: string; layer: Layer; candidates: Candidate[] }) {
  const { pending, result, run } = useAction()
  const upper = candidates.filter((c) => LAYER_RANK[layer] === LAYER_RANK[c.layer] + 1)
  const [kind, setKind] = useState(upper.length > 0 ? 'implements' : 'complements')
  const options = kind === 'implements' ? upper : candidates
  const [toId, setToId] = useState('')
  const [reason, setReason] = useState('')
  return (
    <section aria-labelledby="link-form">
      <h2 id="link-form" className="mb-2 text-sm font-semibold text-[var(--t1)]">연결 추가</h2>
      <div className="grid gap-2">
        <label className="text-sm text-[var(--t2)]">
          종류
          <select value={kind} onChange={(e) => { setKind(e.target.value); setToId('') }} className={FIELD}>
            {layer !== 'essence' && <option value="implements">위 층을 구현한다</option>}
            <option value="complements">보완한다</option>
            <option value="contrasts">반대된다</option>
            <option value="condition_variant">조건만 다르다</option>
            <option value="duplicate_candidate">중복 후보</option>
          </select>
        </label>
        <label className="text-sm text-[var(--t2)]">
          대상
          <select value={toId} onChange={(e) => setToId(e.target.value)} className={FIELD}>
            <option value="">고르세요</option>
            {options.map((c) => (
              <option key={c.id} value={c.id}>
                {LAYER_LABEL[c.layer]} · {c.title}
              </option>
            ))}
          </select>
        </label>
        {kind === 'implements' && upper.length === 0 && (
          <p className="text-sm text-[var(--t3)]">바로 위 층에 항목이 아직 없습니다.</p>
        )}
        <label className="text-sm text-[var(--t2)]">
          이유
          <input value={reason} onChange={(e) => setReason(e.target.value)} className={FIELD} />
        </label>
        <button
          type="button"
          disabled={pending || !toId}
          onClick={() => run(() => addLinkAction(itemId, toId, kind, reason), () => { setToId(''); setReason('') })}
          className={`${BUTTON} border-[var(--bd)] text-[var(--t1)]`}
        >
          연결
        </button>
      </div>
      <Feedback result={result} okText="연결했습니다." />
    </section>
  )
}

interface OriginOption {
  passageSha256: string
  label: string
}

export function EvidenceForm({ itemId, origins }: { itemId: string; origins: OriginOption[] }) {
  const { pending, result, run } = useAction()
  const [mode, setMode] = useState<'external' | 'csat'>('external')
  const [grade, setGrade] = useState('B')
  const [attribution, setAttribution] = useState('stated')
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [locator, setLocator] = useState('')
  const [note, setNote] = useState('')
  const [sha, setSha] = useState('')
  const reset = () => { setUrl(''); setTitle(''); setLocator(''); setNote(''); setSha('') }

  return (
    <section aria-labelledby="evidence-form">
      <h2 id="evidence-form" className="mb-2 text-sm font-semibold text-[var(--t1)]">근거 추가</h2>
      <fieldset className="mb-2 flex gap-4 text-sm text-[var(--t1)]">
        <legend className="sr-only">출처 종류</legend>
        <label className="inline-flex min-h-11 items-center gap-2">
          <input className="h-4 w-4 accent-[var(--p)]" type="radio" checked={mode === 'external'} onChange={() => setMode('external')} /> 링크
        </label>
        <label className="inline-flex min-h-11 items-center gap-2">
          <input className="h-4 w-4 accent-[var(--p)]" type="radio" checked={mode === 'csat'} onChange={() => setMode('csat')} /> 기출 원천
        </label>
      </fieldset>
      <div className="grid gap-2">
        <label className="text-sm text-[var(--t2)]">
          귀속
          <select value={attribution} onChange={(e) => setAttribution(e.target.value)} className={FIELD}>
            {ATTRIBUTIONS.map((a) => (
              <option key={a} value={a}>
                {ATTRIBUTION_LABEL[a]}
              </option>
            ))}
          </select>
        </label>
        {mode === 'external' ? (
          <>
            <label className="text-sm text-[var(--t2)]">
              등급
              <select value={grade} onChange={(e) => setGrade(e.target.value)} className={FIELD}>
                <option value="A">A 직접 확인 — 위치까지 읽었다</option>
                <option value="B">B 유력 — 서지·목차만 확인</option>
                <option value="C">C 계보 — 같은 주장을 다른 곳에서</option>
              </select>
            </label>
            <label className="text-sm text-[var(--t2)]">
              링크 (https)
              <input value={url} onChange={(e) => setUrl(e.target.value)} className={FIELD} inputMode="url" />
            </label>
            <label className="text-sm text-[var(--t2)]">
              출처 제목
              <input value={title} onChange={(e) => setTitle(e.target.value)} className={FIELD} />
            </label>
            <label className="text-sm text-[var(--t2)]">
              위치 (예: 03:12–04:05, §교재특징)
              <input value={locator} onChange={(e) => setLocator(e.target.value)} className={FIELD} />
            </label>
          </>
        ) : (
          <label className="text-sm text-[var(--t2)]">
            기출 원천 (A·B·C 만 — 등급은 원천을 따른다)
            <select value={sha} onChange={(e) => setSha(e.target.value)} className={FIELD}>
              <option value="">고르세요</option>
              {origins.map((o) => (
                <option key={o.passageSha256} value={o.passageSha256}>{o.label}</option>
              ))}
            </select>
          </label>
        )}
        <label className="text-sm text-[var(--t2)]">
          메모 (재서술 — 원문을 옮겨 적지 않는다)
          <input value={note} onChange={(e) => setNote(e.target.value)} className={FIELD} />
        </label>
        <button
          type="button"
          disabled={pending || (mode === 'csat' ? !sha : !url)}
          onClick={() =>
            run(
              () =>
                mode === 'csat'
                  ? addCsatEvidenceAction({ itemId, passageSha256: sha, attribution, note })
                  : addExternalEvidenceAction({ itemId, grade, attribution, url, title, locator, note }),
              reset
            )
          }
          className={`${BUTTON} border-[var(--bd)] text-[var(--t1)]`}
        >
          근거 추가
        </button>
      </div>
      <Feedback result={result} okText="근거를 연결했습니다." />
    </section>
  )
}
