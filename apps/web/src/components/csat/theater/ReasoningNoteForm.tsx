// apps/web/src/components/csat/theater/ReasoningNoteForm.tsx
'use client'
//
// **원리 노트 — 이 문항에서 얻은 조건부 원리를 내 말로.** (v3 M4 · CSAT_REASONING_DATA_V3 §ReasoningNote)
//
// 원리 · 근거 · 통하는 조건 · 쓰면 안 되는 조건을 쓴다. 참여는 선택이고 다른 장면을 잠그지 않는다.
// 저장한 뒤 검수된 원리와 나란히 놓고 스스로 대조한다 — 자동 채점 · 능력 판정 없음. 해설 뒤 기록이라 독립 수행이 아니다.
// 쓴 글 · 문항 id 는 분석 이벤트로 보내지 않는다(D3).

import { useState } from 'react'

import { NOTE_FIELD_MAX, normalizeReasoningNote, type ReasoningNote } from '@/lib/csat/dissect'
import type { InquiryPrinciple, V3PairView } from '@/lib/csat/inquiry/labels'

import styles from './theater.module.css'

const FIELDS = [
  { key: 'statement', label: '이 문항에서 얻은 원리', hint: '무엇이 판정을 정하는가' },
  { key: 'grounds', label: '근거', hint: '지문의 몇 번 문장 · 어떤 표현 때문인가' },
  { key: 'applicability', label: '통하는 조건', hint: '어떤 조건이 같을 때 다른 문항에도 쓸 수 있나' },
  { key: 'limit', label: '쓰면 안 되는 조건', hint: '어떤 경우에는 이 원리가 틀리나' },
] as const
type Key = (typeof FIELDS)[number]['key']

export function ReasoningNoteForm({
  itemId,
  analysisVersion,
  principle,
  pairs,
  saved,
  onSave,
  now = () => Date.now(),
}: {
  itemId: string
  analysisVersion: number | null
  /** 검수된 탐구 원리(대조용) — 없으면 대조 버튼 대신 안내 */
  principle: InquiryPrinciple | null
  /** 근거로 고를 수 있는 검수된 비교 쌍 */
  pairs: V3PairView[]
  /** 이 문항에서 이미 쓴 노트 */
  saved: ReasoningNote[]
  onSave: (x: ReasoningNote) => void
  /** 시각 주입(테스트) */
  now?: () => number
}) {
  const [draft, setDraft] = useState<Record<Key, string>>({ statement: '', grounds: '', applicability: '', limit: '' })
  const [pairIds, setPairIds] = useState<string[]>([])
  const [shownId, setShownId] = useState<string | null>(null)
  const shown = shownId ? saved.find((x) => x.id === shownId) ?? null : null
  const last = saved.length ? saved[saved.length - 1] : null

  const save = () => {
    const t = now()
    const x = normalizeReasoningNote({
      id: globalThis.crypto?.randomUUID?.() ?? `${t.toString(36)}-${Math.random().toString(36).slice(2)}`,
      item: itemId, pairIds, binding: { analysisVersion }, ...draft, evidence: [],
      afterExplanation: true, comparedWithModel: false, at: t, updatedAt: t,
    })
    if (!x) return
    onSave(x)
    setShownId(x.id)
    setDraft({ statement: '', grounds: '', applicability: '', limit: '' })
    setPairIds([])
  }

  return (
    <section className={styles.explain} aria-labelledby="note-title" data-testid="reasoning-note">
      <h2 id="note-title">원리 노트 <span className={styles.optional}>선택</span></h2>
      <p className="break-keep">이 문항에서 얻은 원리를 조건과 함께 적어 두세요. 저장하면 검수된 원리와 나란히 놓고 비교할 수 있어요. 점수는 매기지 않아요.</p>
      {FIELDS.map((f) => (
        <label key={f.key} className={styles.explainField}>
          <span>{f.label} <span className={styles.quiet}>— {f.hint}</span></span>
          <textarea value={draft[f.key]} maxLength={NOTE_FIELD_MAX} rows={2} onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))} data-testid={`note-${f.key}`} />
        </label>
      ))}
      {pairs.length ? (
        <fieldset className={styles.explainChoices}>
          <legend className="break-keep">근거로 삼은 검수된 비교(선택)</legend>
          {pairs.map((p) => (
            <label key={p.pairId} className="inline-flex min-h-11 items-center gap-2">
              <input type="checkbox" checked={pairIds.includes(p.pairId)} onChange={(e) => setPairIds((xs) => (e.target.checked ? [...xs, p.pairId] : xs.filter((y) => y !== p.pairId)))} />
              {p.otherLabel}
            </label>
          ))}
        </fieldset>
      ) : null}
      <div className={styles.explainActions}>
        <button type="button" onClick={save} disabled={!draft.statement.trim()} data-testid="note-save">
          노트 저장
        </button>
      </div>

      {shown ? (
        <div className={styles.explainCompare} data-testid="note-compare">
          <div>
            <b>내 노트</b>
            <p className="break-keep">{shown.statement}</p>
            {shown.applicability ? <p className="break-keep">통하는 조건: {shown.applicability}</p> : null}
            {shown.limit ? <p className="break-keep">쓰면 안 되는 조건: {shown.limit}</p> : null}
            {shown.binding.analysisVersion !== analysisVersion ? <p className={styles.quiet}>예전 분석으로 쓴 노트예요.</p> : null}
          </div>
          <div>
            <b>검수된 원리</b>
            {principle ? (
              shown.comparedWithModel ? (
                <>
                  <p className="break-keep">{principle.statement}</p>
                  <p className="break-keep">통하는 조건: {principle.when_applies.join(' · ')}</p>
                  <p className="break-keep">쓰면 안 되는 조건: {principle.when_not.join(' · ')}</p>
                </>
              ) : (
                <button type="button" onClick={() => onSave({ ...shown, comparedWithModel: true, updatedAt: now() })} data-testid="note-open-model">
                  검수된 원리 펼쳐 비교하기
                </button>
              )
            ) : (
              <p className={styles.quiet}>이 문항에는 검수된 원리가 아직 없어요.</p>
            )}
          </div>
          {shown.comparedWithModel ? <p className={styles.quiet}>조건과 경계를 같은 것으로 봤는지 스스로 확인해 보세요.</p> : null}
        </div>
      ) : last ? (
        <p className={styles.quiet}>
          이 문항에서 쓴 노트 {saved.length}개 ·{' '}
          <button type="button" className={styles.back} onClick={() => setShownId(last.id)} data-testid="note-show-last">
            마지막 노트 보기
          </button>
        </p>
      ) : null}
    </section>
  )
}
