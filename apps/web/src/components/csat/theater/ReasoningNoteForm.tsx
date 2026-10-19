// apps/web/src/components/csat/theater/ReasoningNoteForm.tsx
'use client'
//
// **원리 노트 — 이 문항에서 얻은 조건부 원리를 내 말로.** (v3 M4 · CSAT_REASONING_DATA_V3 §ReasoningNote · 작업공간 W3)
//
// 원리 · 근거 · 통하는 조건 · 쓰면 안 되는 조건을 쓴다. 참여는 선택이고 다른 장면을 잠그지 않는다.
// 저장한 뒤 검수된 원리와 나란히 놓고 스스로 대조한다 — 자동 채점 · 능력 판정 없음. 해설 뒤 기록이라 독립 수행이 아니다.
// 쓴 글 · 문항 id 는 분석 이벤트로 보내지 않는다(D3).
//
// 작업공간 W3: 초안은 부모(문항별 탭 메모리)가 갖는다 — 장면을 오가도 남는다. 근거 연결은 선택이다 — 지금 고른
// 문장 근거를 「이 근거를 노트에 연결」 하면 기존 `evidence`(문장 번호) 계약으로 저장하고, 다시 열면 그 문장을 짚는다.
// 지도 결속을 확인할 수 없거나 문장 단위가 아닌 유형은 연결하지 않는다(번호를 지어내지 않는다). evidence 가 빈 기존 노트는 정상이다.

import { NOTE_FIELD_MAX, normalizeReasoningNote, type ReasoningNote } from '@/lib/csat/dissect'
import { clearNote, edited, EMPTY_NOTE, sending, settled, type NoteDraft } from '@/lib/csat/explain-draft'
import type { InquiryPrinciple, V3PairView } from '@/lib/csat/inquiry/labels'

import styles from './theater.module.css'

const FIELDS = [
  { key: 'statement', label: '이 문항에서 얻은 원리', hint: '무엇이 판정을 정하는가' },
  { key: 'grounds', label: '근거', hint: '지문의 몇 번 문장 · 어떤 표현 때문인가' },
  { key: 'applicability', label: '통하는 조건', hint: '어떤 조건이 같을 때 다른 문항에도 쓸 수 있나' },
  { key: 'limit', label: '쓰면 안 되는 조건', hint: '어떤 경우에는 이 원리가 틀리나' },
] as const

const freshId = (t: number) => globalThis.crypto?.randomUUID?.() ?? `${t.toString(36)}-${Math.random().toString(36).slice(2)}`
const nums = (xs: readonly number[]) => xs.map((n) => `${n}번`).join(' · ')

export function ReasoningNoteForm({
  itemId,
  analysisVersion,
  principle,
  pairs,
  saved,
  onSave,
  draft = EMPTY_NOTE,
  onDraft,
  candidate = [],
  onShowEvidence,
  now = () => Date.now(),
  modelLabel = '검수된 원리',
  authored,
}: {
  itemId: string
  analysisVersion: number | null
  /** 검수된 탐구 원리(대조용) — 없으면 대조 버튼 대신 안내 */
  principle: InquiryPrinciple | null
  /** 근거로 고를 수 있는 검수된 비교 쌍 */
  pairs: V3PairView[]
  /** 이 문항에서 이미 쓴 노트 */
  saved: ReasoningNote[]
  /** 실제 저장 결과(기기 저장 성공 여부) */
  onSave: (x: ReasoningNote) => Promise<boolean>
  /** 이 문항의 초안(부모 탭 메모리) */
  draft?: NoteDraft
  onDraft: (fn: (d: NoteDraft) => NoteDraft) => void
  /** 지금 고른 문장 근거 중 이 문항 지도 범위 안의 번호(linkableEvidence) — 비면 연결 행동을 내지 않는다 */
  candidate?: number[]
  /** 저장된 노트의 근거를 가운데 판에서 짚는다(지도 결속이 있을 때만 넘긴다) */
  onShowEvidence?: (sentences: number[]) => void
  /** 시각 주입(테스트) */
  now?: () => number
  /** 대조 모델 이름 — 사람 검수 전 창작 설명은 「검수된」 이라 부르지 않는다(FI-011 C) */
  modelLabel?: string
  /** 창작 교수 자료 결속(서버가 확인) — 있으면 노트에 싣는다 */
  authored?: { deliveryId: string; annotationHash: string }
}) {
  const { fields, pairIds, evidence, status } = draft
  const shown = draft.shownId ? saved.find((x) => x.id === draft.shownId) ?? null : null
  const last = saved.length ? saved[saved.length - 1] : null
  const linked = evidence.length > 0
  const sameAsCandidate = linked && candidate.length === evidence.length && candidate.every((n, i) => n === evidence[i])

  const save = async () => {
    const t = now()
    const { draft: next, id, at } = sending(draft, () => freshId(t), t)
    const x = normalizeReasoningNote({
      // 다시 시도면 같은 id — 병합이 한 건으로 합친다
      id, item: itemId, pairIds, binding: { analysisVersion }, ...fields, evidence,
      afterExplanation: true, comparedWithModel: false, at, updatedAt: t, ...(authored ? { authored } : {}),
    })
    if (!x) return
    onDraft(() => next)
    const ok = await onSave(x).catch(() => false)
    onDraft((d) => settled(d, ok, id, clearNote))
  }

  return (
    <section className={styles.explain} aria-labelledby="note-title" data-testid="reasoning-note">
      <h2 id="note-title">원리 노트 <span className={styles.optional}>선택</span></h2>
      <p className="break-keep">이 문항에서 얻은 원리를 조건과 함께 적어 두세요. 저장하면 검수된 원리와 나란히 놓고 비교할 수 있어요. 점수는 매기지 않아요.</p>
      {FIELDS.map((f) => (
        <label key={f.key} className={styles.explainField}>
          <span>{f.label} <span className={styles.quiet}>— {f.hint}</span></span>
          <textarea
            value={fields[f.key]}
            maxLength={NOTE_FIELD_MAX}
            rows={2}
            onChange={(e) => { const v = e.target.value; onDraft((d) => edited(d, { fields: { ...d.fields, [f.key]: v } })) }}
            data-testid={`note-${f.key}`}
          />
        </label>
      ))}

      {/* 근거 연결(선택) — 지금 고른 문장 근거를 노트에 묶는다. 자동 저장 · 강제 입력 아님 */}
      <div className={styles.noteEvidence} data-testid="note-evidence" data-linked={linked}>
        {linked ? (
          <p className="break-keep">
            연결한 근거: <b>{nums(evidence)} 문장</b>{' '}
            <button type="button" className={styles.back} onClick={() => onDraft((d) => edited(d, { evidence: [] }))} data-testid="note-evidence-unlink">
              연결 해제
            </button>
          </p>
        ) : (
          <p className={styles.quiet}>연결한 근거 없음 — 근거 칸에 글로 적어도 돼요.</p>
        )}
        {candidate.length && !sameAsCandidate ? (
          <button type="button" className={styles.back} onClick={() => onDraft((d) => edited(d, { evidence: candidate }))} data-testid="note-evidence-link">
            지금 고른 근거({nums(candidate)} 문장)를 노트에 연결
          </button>
        ) : null}
      </div>

      {pairs.length ? (
        <fieldset className={styles.explainChoices}>
          <legend className="break-keep">근거로 삼은 검수된 비교(선택)</legend>
          {pairs.map((p) => (
            <label key={p.pairId} className="inline-flex min-h-11 items-center gap-2">
              <input
                type="checkbox"
                checked={pairIds.includes(p.pairId)}
                onChange={(e) => { const on = e.target.checked; onDraft((d) => edited(d, { pairIds: on ? [...d.pairIds, p.pairId] : d.pairIds.filter((y) => y !== p.pairId) })) }}
              />
              {p.otherLabel}
            </label>
          ))}
        </fieldset>
      ) : null}
      <p className={styles.draftNote}>저장하지 않은 노트는 이 탭에만 있어요 — 새로고침하거나 탭을 닫으면 사라져요.</p>
      <div className={styles.explainActions}>
        <button type="button" onClick={() => void save()} disabled={!fields.statement.trim() || status === 'saving'} data-testid="note-save">
          {status === 'failed' ? '다시 저장' : status === 'saving' ? '저장하는 중…' : '노트 저장'}
        </button>
      </div>
      <p role="status" aria-live="polite" className="break-keep text-[12.5px]" data-testid="note-status" data-status={status}>
        {status === 'saved' ? '이 기기에 저장했어요.' : status === 'failed' ? '저장하지 못했어요. 쓴 내용은 그대로 두었으니 다시 저장해 주세요.' : ''}
      </p>

      {shown ? (
        <div className={styles.explainCompare} data-testid="note-compare">
          <div>
            <b>내 노트</b>
            <p className="break-keep">{shown.statement}</p>
            {shown.applicability ? <p className="break-keep">통하는 조건: {shown.applicability}</p> : null}
            {shown.limit ? <p className="break-keep">쓰면 안 되는 조건: {shown.limit}</p> : null}
            {shown.evidence.length ? (
              shown.binding.analysisVersion === analysisVersion && onShowEvidence ? (
                <button type="button" className={styles.back} onClick={() => onShowEvidence(shown.evidence)} data-testid="note-evidence-show">
                  연결한 근거 {nums(shown.evidence)} 문장 짚기
                </button>
              ) : (
                <p className={styles.quiet} data-testid="note-evidence-stale">연결한 근거 {nums(shown.evidence)} 문장 — 예전 분석 기준이거나 지도와 맞춰 볼 수 없어 위치는 짚지 않아요.</p>
              )
            ) : (
              <p className={styles.quiet}>연결한 근거 없음</p>
            )}
            {shown.binding.analysisVersion !== analysisVersion ? <p className={styles.quiet}>예전 분석으로 쓴 노트예요.</p> : null}
          </div>
          <div>
            <b>{modelLabel}</b>
            {principle ? (
              shown.comparedWithModel ? (
                <>
                  <p className="break-keep">{principle.statement}</p>
                  {principle.when_applies.length ? <p className="break-keep">통하는 조건: {principle.when_applies.join(' · ')}</p> : null}
                  {principle.when_not.length ? <p className="break-keep">쓰면 안 되는 조건: {principle.when_not.join(' · ')}</p> : null}
                </>
              ) : (
                <button type="button" onClick={() => void onSave({ ...shown, comparedWithModel: true, updatedAt: now() })} data-testid="note-open-model">
                  {modelLabel} 펼쳐 비교하기
                </button>
              )
            ) : (
              <p className={styles.quiet} data-testid="note-no-model">이 문항에는 비교할 설명({modelLabel})이 아직 없어요. 쓴 노트는 그대로 남아요.</p>
            )}
          </div>
          {shown.comparedWithModel ? <p className={styles.quiet}>조건과 경계를 같은 것으로 봤는지 스스로 확인해 보세요.</p> : null}
        </div>
      ) : last ? (
        <p className={styles.quiet}>
          이 문항에서 쓴 노트 {saved.length}개 ·{' '}
          <button type="button" className={styles.back} onClick={() => onDraft((d) => ({ ...d, shownId: last.id }))} data-testid="note-show-last">
            마지막 노트 보기
          </button>
        </p>
      ) : null}
    </section>
  )
}
