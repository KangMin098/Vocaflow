'use client'

// VcbCurationDetailPanel.tsx
// 자율 재구성: spec 이 qa_flags badge style 직후 잘려, 이후 섹션 (definitions /
// examples / syn-ant-coll / learner_note / actions / reenrich command) 은
// 앞선 VcbStepTriggerCard / VcbRunStatusBadge 의 인라인 Tailwind + var(--*) 패턴으로 구성.

import { useEffect, useState, useTransition } from 'react'
import { Check, X, RotateCcw, Copy, Pencil } from 'lucide-react'
import type { VcbQueueDetail, QueuePayload } from '@/lib/vcb/types'
import { editQueueItem, reenrichQueueItem } from '@/lib/vcb/server/curation'
import { VcbCurationEditForm } from './VcbCurationEditForm'

interface Props {
  detail: VcbQueueDetail
  runId: number
  onDecision: (
    kind: 'approve' | 'reject',
    note: string | null,
    clearNote?: () => void,
  ) => void
}

const REGISTER_LABEL: Record<string, string> = {
  formal: '격식',
  neutral: '중립',
  informal: '구어',
}

export function VcbCurationDetailPanel({ detail, onDecision }: Props) {
  const [note, setNote] = useState('')
  const [reenrichCommand, setReenrichCommand] = useState<string | null>(null)
  const [commandCopied, setCommandCopied] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [editMode, setEditMode] = useState(false)
  const [payloadOverride, setPayloadOverride] = useState<QueuePayload | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [editPending, startEdit] = useTransition()

  // 항목 전환 시 노트·재보강 커맨드·편집 상태 초기화(이전 항목 잔상 방지).
  useEffect(() => {
    setNote('')
    setReenrichCommand(null)
    setEditMode(false)
    setPayloadOverride(null)
    setEditError(null)
  }, [detail.queue_id])

  // 편집 이후 표시용 payload — 저장 성공분을 재fetch 없이 즉시 반영.
  const p = payloadOverride ?? detail.payload

  // 승인/거절은 부모(VcbCurationView)로 위임 — 낙관적 오버레이 + 자동 다음 이동.
  const handleApprove = () => onDecision('approve', note || null, () => setNote(''))
  const handleReject = () => onDecision('reject', note || null, () => setNote(''))
  const handleSaveEdit = (
    edited: Partial<QueuePayload>,
    editNote: string | null,
  ) => {
    setEditError(null)
    startEdit(async () => {
      const result = await editQueueItem(detail.queue_id, edited, editNote)
      if (result.ok) {
        setPayloadOverride({ ...p, ...edited })
        setEditMode(false)
      } else {
        setEditError(result.error ?? '편집 저장 실패')
      }
    })
  }
  const handleReenrich = () => {
    startTransition(async () => {
      const result = await reenrichQueueItem(detail.queue_id, note || null)
      if (result.ok && result.data) {
        setReenrichCommand(result.data.slash_command)
      }
    })
  }
  const copyReenrichCommand = async () => {
    if (!reenrichCommand) return
    try {
      await navigator.clipboard.writeText(reenrichCommand)
      setCommandCopied(true)
      setTimeout(() => setCommandCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  return (
    <article>
      {/* Header: lemma + IPA + badges */}
      <header className="mb-6">
        <h2 className="m-0">
          <span
            className="font-display font-bold text-2xl mr-3"
            style={{ color: 'var(--t1)' }}
          >
            {detail.lemma}
          </span>
          {p.ipa && (
            <span className="font-mono text-base" style={{ color: 'var(--t2)' }}>
              {p.ipa}
            </span>
          )}
        </h2>
        <div className="flex gap-2 flex-wrap mt-3">
          <span
            className="px-2 py-1 text-xs rounded-[var(--r-sm)] border"
            style={{
              background: 'var(--bg2)',
              borderColor: 'var(--bd)',
              color: 'var(--t2)',
            }}
          >
            {detail.pos}
          </span>
          {p.cefr && (
            <span
              className="px-2 py-1 text-xs rounded-[var(--r-sm)] font-mono"
              style={{
                background: `var(--cefr-${p.cefr}-bg)`,
                color: `var(--cefr-${p.cefr}-text)`,
              }}
            >
              {p.cefr}
            </span>
          )}
          {detail.ngsl_rank && (
            <span
              className="px-2 py-1 text-xs rounded-[var(--r-sm)] border"
              style={{
                background: 'var(--bg2)',
                borderColor: 'var(--bd)',
                color: 'var(--t2)',
              }}
            >
              NGSL #{detail.ngsl_rank}
            </span>
          )}
          {detail.seed_origin === 'ai_generated' && (
            <span
              className="px-2 py-1 text-xs rounded-[var(--r-sm)]"
              style={{ background: 'var(--info-light)', color: 'var(--info)' }}
            >
              AI Generated
            </span>
          )}
          {detail.qa_flags.length > 0 && (
            <span
              className="px-2 py-1 text-xs rounded-[var(--r-sm)] border font-mono"
              style={{
                background: 'var(--warning-light)',
                color: 'var(--warning)',
                borderColor: 'var(--warning)',
              }}
            >
              QA: {detail.qa_flags.join(', ')}
            </span>
          )}
          <span
            className="px-2 py-1 text-xs rounded-[var(--r-sm)] border font-mono"
            style={{
              background: 'var(--bg2)',
              borderColor: 'var(--bd)',
              color: 'var(--t3)',
            }}
          >
            confidence {p.confidence.toFixed(2)}
          </span>
        </div>
      </header>

      {editMode ? (
        <VcbCurationEditForm
          payload={p}
          onSave={handleSaveEdit}
          onCancel={() => setEditMode(false)}
          isSaving={editPending}
          error={editError}
        />
      ) : (
        <>
      {/* 한국어 정의 */}
      <Section title="한국어 정의">
        <ol className="m-0 pl-5 space-y-1">
          {p.definitions_ko.map((d, i) => (
            <li key={i} style={{ color: 'var(--t1)' }} className="text-base">
              {d.sense}
              <span
                className="ml-2 text-[11px] px-2 py-1 rounded-[var(--r-sm)]"
                style={{ background: 'var(--bg2)', color: 'var(--t3)' }}
              >
                {REGISTER_LABEL[d.register] ?? d.register}
              </span>
            </li>
          ))}
        </ol>
      </Section>

      {/* 영어 정의 */}
      <Section title="영어 정의">
        <ol className="m-0 pl-5 space-y-1">
          {p.definitions_en.map((d, i) => (
            <li key={i} style={{ color: 'var(--t2)' }} className="text-sm font-english">
              {d.sense}
            </li>
          ))}
        </ol>
      </Section>

      {/* 예문 */}
      <Section title="예문">
        <ul className="m-0 list-none p-0 space-y-3">
          {p.examples.map((ex, i) => (
            <li
              key={i}
              className="p-3 rounded-[var(--r-md)] border"
              style={{ background: 'var(--bg2)', borderColor: 'var(--bd)' }}
            >
              <p
                className="font-english italic m-0 mb-1"
                style={{ color: 'var(--t1)' }}
              >
                {ex.en}
              </p>
              <p className="text-sm m-0" style={{ color: 'var(--t2)' }}>
                {ex.ko}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      {/* 동의어 / 반의어 / 연어 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Section title="동의어" compact>
          <ChipList items={p.synonyms} tone="success" />
        </Section>
        <Section title="반의어" compact>
          <ChipList items={p.antonyms} tone="error" />
        </Section>
        <Section title="연어" compact>
          <ChipList items={p.collocations} tone="info" />
        </Section>
      </div>

      {/* 학습자 노트 */}
      {p.korean_learner_note && (
        <Section title="학습자 노트">
          <p
            className="m-0 p-3 rounded-[var(--r-md)] text-sm"
            style={{
              background: 'var(--info-light)',
              color: 'var(--t1)',
              borderLeft: '3px solid var(--info)',
            }}
          >
            {p.korean_learner_note}
          </p>
        </Section>
      )}

      {/* 액션 영역 */}
      <section
        className="mt-8 pt-6 border-t"
        style={{ borderColor: 'var(--bd)' }}
      >
        <label
          className="block font-display font-semibold text-xs uppercase tracking-wider mb-2"
          style={{ color: 'var(--t2)' }}
        >
          큐레이터 노트 (선택)
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="결정 사유 또는 재보강 지시"
          className="w-full p-3 rounded-[var(--r-md)] border font-body text-sm mb-3"
          style={{
            background: 'var(--bg2)',
            borderColor: 'var(--bd)',
            color: 'var(--t1)',
            minHeight: '80px',
            resize: 'vertical',
          }}
        />

        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleApprove}
            disabled={isPending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-[var(--r-md)] font-display text-sm font-medium text-white"
            style={{
              background: 'var(--success)',
              opacity: isPending ? 0.6 : 1,
            }}
          >
            <Check className="w-4 h-4" />
            Approve
          </button>
          <button
            type="button"
            onClick={handleReject}
            disabled={isPending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-[var(--r-md)] font-display text-sm font-medium text-white"
            style={{
              background: 'var(--error)',
              opacity: isPending ? 0.6 : 1,
            }}
          >
            <X className="w-4 h-4" />
            Reject
          </button>
          <button
            type="button"
            onClick={handleReenrich}
            disabled={isPending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-[var(--r-md)] font-display text-sm font-medium border"
            style={{
              color: 'var(--t1)',
              borderColor: 'var(--bd)',
              background: 'var(--bg)',
              opacity: isPending ? 0.6 : 1,
            }}
          >
            <RotateCcw className="w-4 h-4" />
            Re-enrich
          </button>
          <button
            type="button"
            onClick={() => setEditMode(true)}
            disabled={isPending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-[var(--r-md)] font-display text-sm font-medium border"
            style={{
              color: 'var(--t1)',
              borderColor: 'var(--bd)',
              background: 'var(--bg)',
              opacity: isPending ? 0.6 : 1,
            }}
          >
            <Pencil className="w-4 h-4" />
            편집
          </button>
        </div>

        {reenrichCommand && (
          <div
            className="mt-4 p-3 rounded-[var(--r-md)] border flex items-center gap-2"
            style={{
              background: 'var(--bg2)',
              borderColor: 'var(--bd)',
            }}
          >
            <code
              className="flex-1 font-mono text-xs overflow-hidden text-ellipsis whitespace-nowrap"
              style={{ color: 'var(--t1)' }}
            >
              {reenrichCommand}
            </code>
            <button
              type="button"
              onClick={copyReenrichCommand}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-[var(--r-sm)] text-xs font-display border"
              style={{
                color: 'var(--t2)',
                borderColor: 'var(--bd)',
                background: 'var(--bg)',
              }}
            >
              {commandCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {commandCopied ? 'Copied' : 'VS Code 에 붙여넣기'}
            </button>
          </div>
        )}

        {/* 결정 이력 */}
        {detail.decision_history.length > 0 && (
          <div className="mt-6">
            <h4
              className="font-display font-semibold text-xs uppercase tracking-wider mb-2"
              style={{ color: 'var(--t2)' }}
            >
              결정 이력
            </h4>
            <ul className="list-none p-0 m-0 space-y-1">
              {detail.decision_history.map((h, i) => (
                <li
                  key={i}
                  className="text-xs flex items-center gap-2"
                  style={{ color: 'var(--t3)' }}
                >
                  <span className="font-mono">{h.decided_at}</span>
                  <span className="font-display font-semibold">{h.decision}</span>
                  {h.note && <span>· {h.note}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
        </>
      )}
    </article>
  )
}

// ─── Helper sub-components ────────────────────────

function Section({
  title,
  compact,
  children,
}: {
  title: string
  compact?: boolean
  children: React.ReactNode
}) {
  return (
    <section className={compact ? 'mb-0' : 'mb-6'}>
      <h3
        className="font-display font-semibold text-xs uppercase tracking-wider mb-2"
        style={{ color: 'var(--t2)' }}
      >
        {title}
      </h3>
      {children}
    </section>
  )
}

function ChipList({
  items,
  tone,
}: {
  items: string[]
  tone: 'success' | 'error' | 'info'
}) {
  if (items.length === 0) {
    return (
      <p className="text-xs m-0" style={{ color: 'var(--t3)' }}>
        없음
      </p>
    )
  }
  const bg =
    tone === 'success'
      ? 'var(--success-light)'
      : tone === 'error'
        ? 'var(--error-light)'
        : 'var(--info-light)'
  const color =
    tone === 'success'
      ? 'var(--success)'
      : tone === 'error'
        ? 'var(--error)'
        : 'var(--info)'
  return (
    <ul className="list-none p-0 m-0 flex flex-wrap gap-2">
      {items.map((item, i) => (
        <li
          key={i}
          className="px-2 py-1 rounded-[var(--r-sm)] text-xs font-display"
          style={{ background: bg, color }}
        >
          {item}
        </li>
      ))}
    </ul>
  )
}
