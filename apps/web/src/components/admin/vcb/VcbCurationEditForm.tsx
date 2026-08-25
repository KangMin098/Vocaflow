// apps/web/src/components/admin/vcb/VcbCurationEditForm.tsx
// 큐레이션 상세 — enriched payload 직접 편집 폼 (결정 C: 저빈도 전문가 도구).
// editQueueItem 서버액션으로 저장 → latest_decision='edit'(발행 대상에 포함).

'use client'

import { useState } from 'react'
import { Plus, Trash2, Check, X } from 'lucide-react'
import type { QueuePayload, DefinitionKo, ExamplePair, Cefr } from '@/lib/vcb/types'

const CEFR_OPTIONS: Cefr[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const REGISTERS: DefinitionKo['register'][] = ['formal', 'neutral', 'informal']
const REGISTER_LABEL: Record<DefinitionKo['register'], string> = {
  formal: '격식',
  neutral: '중립',
  informal: '구어',
}

interface Props {
  payload: QueuePayload
  onSave: (edited: Partial<QueuePayload>, note: string | null) => void
  onCancel: () => void
  isSaving: boolean
  error: string | null
}

const splitCsv = (s: string): string[] =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)

export function VcbCurationEditForm({
  payload,
  onSave,
  onCancel,
  isSaving,
  error,
}: Props) {
  const [ipa, setIpa] = useState(payload.ipa ?? '')
  const [cefr, setCefr] = useState<Cefr | ''>(payload.cefr ?? '')
  const [defsKo, setDefsKo] = useState<DefinitionKo[]>(
    payload.definitions_ko.length > 0
      ? payload.definitions_ko
      : [{ sense: '', register: 'neutral' }],
  )
  const [defsEn, setDefsEn] = useState<string[]>(
    payload.definitions_en.length > 0
      ? payload.definitions_en.map((d) => d.sense)
      : [''],
  )
  const [examples, setExamples] = useState<ExamplePair[]>(
    payload.examples.length > 0 ? payload.examples : [{ en: '', ko: '' }],
  )
  const [synonyms, setSynonyms] = useState(payload.synonyms.join(', '))
  const [antonyms, setAntonyms] = useState(payload.antonyms.join(', '))
  const [collocations, setCollocations] = useState(payload.collocations.join(', '))
  const [learnerNote, setLearnerNote] = useState(payload.korean_learner_note ?? '')
  const [note, setNote] = useState('')

  const koValid = defsKo.some((d) => d.sense.trim().length > 0)

  const handleSave = () => {
    const edited: Partial<QueuePayload> = {
      ipa: ipa.trim() || null,
      cefr: cefr || null,
      definitions_ko: defsKo
        .filter((d) => d.sense.trim())
        .map((d) => ({ sense: d.sense.trim(), register: d.register })),
      definitions_en: defsEn
        .map((s) => s.trim())
        .filter(Boolean)
        .map((sense) => ({ sense })),
      examples: examples
        .filter((e) => e.en.trim() || e.ko.trim())
        .map((e) => ({ en: e.en.trim(), ko: e.ko.trim() })),
      synonyms: splitCsv(synonyms),
      antonyms: splitCsv(antonyms),
      collocations: splitCsv(collocations),
      korean_learner_note: learnerNote.trim() || null,
      confidence: payload.confidence,
    }
    onSave(edited, note.trim() || null)
  }

  return (
    <div className="space-y-6">
      <div
        className="flex items-center justify-between pb-3 border-b"
        style={{ borderColor: 'var(--bd)' }}
      >
        <h3
          className="font-display font-semibold text-sm m-0"
          style={{ color: 'var(--t1)' }}
        >
          ✎ payload 편집
        </h3>
        <span className="font-mono text-[11px]" style={{ color: 'var(--t3)' }}>
          저장 시 결정 = edit (발행 대상 포함)
        </span>
      </div>

      {/* IPA + CEFR */}
      <div className="grid grid-cols-2 gap-4">
        <Field label="IPA">
          <input
            value={ipa}
            onChange={(e) => setIpa(e.target.value)}
            placeholder="/ˈɛɡzəmpəl/"
            className="w-full px-3 py-2 rounded-[var(--r-md)] border font-mono text-sm"
            style={inputStyle}
          />
        </Field>
        <Field label="CEFR">
          <select
            value={cefr}
            onChange={(e) => setCefr(e.target.value as Cefr | '')}
            className="w-full px-3 py-2 rounded-[var(--r-md)] border text-sm"
            style={inputStyle}
          >
            <option value="">미지정</option>
            {CEFR_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {/* 한국어 정의 */}
      <Field label="한국어 정의" hint={koValid ? undefined : '최소 1개 필요'}>
        <div className="space-y-2">
          {defsKo.map((d, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={d.sense}
                onChange={(e) => {
                  const next = [...defsKo]
                  next[i] = { ...next[i], sense: e.target.value }
                  setDefsKo(next)
                }}
                placeholder="뜻"
                className="flex-1 px-3 py-2 rounded-[var(--r-md)] border text-sm"
                style={inputStyle}
              />
              <select
                value={d.register}
                onChange={(e) => {
                  const next = [...defsKo]
                  next[i] = {
                    ...next[i],
                    register: e.target.value as DefinitionKo['register'],
                  }
                  setDefsKo(next)
                }}
                className="px-2 py-2 rounded-[var(--r-md)] border text-sm shrink-0"
                style={inputStyle}
              >
                {REGISTERS.map((r) => (
                  <option key={r} value={r}>
                    {REGISTER_LABEL[r]}
                  </option>
                ))}
              </select>
              <RemoveBtn
                onClick={() => setDefsKo(defsKo.filter((_, j) => j !== i))}
                disabled={defsKo.length <= 1}
              />
            </div>
          ))}
          <AddBtn
            label="정의 추가"
            onClick={() => setDefsKo([...defsKo, { sense: '', register: 'neutral' }])}
          />
        </div>
      </Field>

      {/* 영어 정의 */}
      <Field label="영어 정의">
        <div className="space-y-2">
          {defsEn.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={s}
                onChange={(e) => {
                  const next = [...defsEn]
                  next[i] = e.target.value
                  setDefsEn(next)
                }}
                placeholder="definition"
                className="flex-1 px-3 py-2 rounded-[var(--r-md)] border text-sm font-english"
                style={inputStyle}
              />
              <RemoveBtn
                onClick={() => setDefsEn(defsEn.filter((_, j) => j !== i))}
                disabled={defsEn.length <= 1}
              />
            </div>
          ))}
          <AddBtn label="정의 추가" onClick={() => setDefsEn([...defsEn, ''])} />
        </div>
      </Field>

      {/* 예문 */}
      <Field label="예문">
        <div className="space-y-3">
          {examples.map((ex, i) => (
            <div
              key={i}
              className="p-3 rounded-[var(--r-md)] border space-y-2"
              style={{ background: 'var(--bg2)', borderColor: 'var(--bd)' }}
            >
              <div className="flex items-center gap-2">
                <input
                  value={ex.en}
                  onChange={(e) => {
                    const next = [...examples]
                    next[i] = { ...next[i], en: e.target.value }
                    setExamples(next)
                  }}
                  placeholder="English example"
                  className="flex-1 px-3 py-2 rounded-[var(--r-sm)] border text-sm font-english italic"
                  style={inputStyle}
                />
                <RemoveBtn
                  onClick={() => setExamples(examples.filter((_, j) => j !== i))}
                  disabled={examples.length <= 1}
                />
              </div>
              <input
                value={ex.ko}
                onChange={(e) => {
                  const next = [...examples]
                  next[i] = { ...next[i], ko: e.target.value }
                  setExamples(next)
                }}
                placeholder="한국어 번역"
                className="w-full px-3 py-2 rounded-[var(--r-sm)] border text-sm"
                style={inputStyle}
              />
            </div>
          ))}
          <AddBtn
            label="예문 추가"
            onClick={() => setExamples([...examples, { en: '', ko: '' }])}
          />
        </div>
      </Field>

      {/* 동의어 / 반의어 / 연어 */}
      <div className="grid grid-cols-3 gap-4">
        <Field label="동의어" hint="쉼표 구분">
          <input
            value={synonyms}
            onChange={(e) => setSynonyms(e.target.value)}
            className="w-full px-3 py-2 rounded-[var(--r-md)] border text-sm"
            style={inputStyle}
          />
        </Field>
        <Field label="반의어" hint="쉼표 구분">
          <input
            value={antonyms}
            onChange={(e) => setAntonyms(e.target.value)}
            className="w-full px-3 py-2 rounded-[var(--r-md)] border text-sm"
            style={inputStyle}
          />
        </Field>
        <Field label="연어" hint="쉼표 구분">
          <input
            value={collocations}
            onChange={(e) => setCollocations(e.target.value)}
            className="w-full px-3 py-2 rounded-[var(--r-md)] border text-sm"
            style={inputStyle}
          />
        </Field>
      </div>

      {/* 학습자 노트 */}
      <Field label="학습자 노트">
        <textarea
          value={learnerNote}
          onChange={(e) => setLearnerNote(e.target.value)}
          className="w-full px-3 py-2 rounded-[var(--r-md)] border text-sm"
          style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }}
        />
      </Field>

      {/* 큐레이터 노트 (편집 사유) */}
      <Field label="편집 사유 (선택)">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="무엇을 왜 고쳤는지"
          className="w-full px-3 py-2 rounded-[var(--r-md)] border text-sm"
          style={{ ...inputStyle, minHeight: '48px', resize: 'vertical' }}
        />
      </Field>

      {error && (
        <p
          className="text-sm px-3 py-2 rounded-[var(--r-md)]"
          style={{
            background: 'var(--error-light)',
            color: 'var(--error)',
            border: '1px solid var(--error)',
          }}
          role="alert"
        >
          {error}
        </p>
      )}

      {/* 액션 */}
      <div
        className="flex gap-2 pt-4 border-t sticky bottom-0 pb-1"
        style={{ borderColor: 'var(--bd)', background: 'var(--bg)' }}
      >
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !koValid}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-[var(--r-md)] font-display text-sm font-medium disabled:opacity-50"
          style={{ background: 'var(--admin-strong)', color: 'var(--ti)' }}
        >
          <Check className="w-4 h-4" />
          {isSaving ? '저장 중…' : '편집 저장'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-[var(--r-md)] font-display text-sm font-medium border disabled:opacity-50"
          style={{ color: 'var(--t1)', borderColor: 'var(--bd)', background: 'var(--bg)' }}
        >
          <X className="w-4 h-4" />
          취소
        </button>
      </div>
    </div>
  )
}

// ─── helpers ──────────────────────────────────────
const inputStyle = {
  background: 'var(--bg)',
  borderColor: 'var(--bd)',
  color: 'var(--t1)',
} as const

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label
        className="flex items-center gap-2 font-display font-semibold text-xs uppercase tracking-wider mb-2"
        style={{ color: 'var(--t2)' }}
      >
        {label}
        {hint && (
          <span className="font-normal normal-case tracking-normal" style={{ color: 'var(--t3)' }}>
            {hint}
          </span>
        )}
      </label>
      {children}
    </div>
  )
}

function AddBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 px-3 py-2 rounded-[var(--r-sm)] font-display text-xs border transition-colors"
      style={{ color: 'var(--t2)', borderColor: 'var(--bd)', background: 'var(--bg2)' }}
    >
      <Plus className="w-3.5 h-3.5" />
      {label}
    </button>
  )
}

function RemoveBtn({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="삭제"
      className="inline-flex items-center justify-center w-8 h-8 rounded-[var(--r-sm)] shrink-0 disabled:opacity-30 transition-colors"
      style={{ color: 'var(--error)', background: 'var(--bg2)' }}
    >
      <Trash2 className="w-4 h-4" />
    </button>
  )
}
