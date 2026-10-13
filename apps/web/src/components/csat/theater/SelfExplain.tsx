// apps/web/src/components/csat/theater/SelfExplain.tsx
'use client'
//
// **자기 설명 — 오답 하나의 설계를 내 말로.** (2026-10-11 · M4 · 작업공간 W3 저장 보강)
//
// 정답 번호를 다시 고르게 하지 않는다. 오답 하나를 골라 「왜 그럴듯한가」와 「무엇이 바뀌어 배제되나」를 쓰고,
// 저장한 뒤 검수된 분석 설명과 나란히 놓고 스스로 대조한다(Chi 외 1989 자기 설명). 참여는 선택이다 — 건너뛰어도
// 설명 열람은 막히지 않는다. 자동 의미 채점은 하지 않는다(검증된 경로가 없다) — 「맞았다/틀렸다」를 꾸미지 않는다.
// 해설이 이미 열린 화면에서 쓰므로 독립 수행이 아니다(afterExplanation: true).
//
// 초안은 부모(문항별 탭 메모리)가 갖는다 — 장면을 오가도 남는다. 저장은 실제 결과(Promise<boolean>)로만 끝난다:
// 실패하면 입력과 같은 기록 id 를 지키고 「다시 저장」, 성공하면 보낸 판만 비운다(lib/csat/explain-draft).

import { useState } from 'react'

import { track } from '@/lib/analytics/client'
import { EXPLAIN_MAX, type SelfExplanation } from '@/lib/csat/dissect'
import { clearExplain, edited, EMPTY_EXPLAIN, sending, settled, type ExplainDraft } from '@/lib/csat/explain-draft'
import type { TheaterBlock } from '@/lib/csat/theater'

import styles from './theater.module.css'

const CIRCLED = ['', '①', '②', '③', '④', '⑤']
const freshId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

export function SelfExplain({
  itemId,
  rejects,
  choiceTruth,
  saved,
  draft = EMPTY_EXPLAIN,
  onDraft,
  onSave,
  onCompare,
  now = () => Date.now(),
}: {
  itemId: string
  /** 오답 블록(analysis:reject:n) — 검수된 설명이 있는 것만 */
  rejects: TheaterBlock[]
  /** 어법 · 어휘 · 불일치 — 오답 선지는 「맞는 말」이다 */
  choiceTruth: boolean
  /** 이 문항에서 이미 쓴 설명(실제로 저장된 것) */
  saved: SelfExplanation[]
  /** 이 문항의 초안(부모 탭 메모리) */
  draft?: ExplainDraft
  /** 초안 갱신 — 함수형(비동기 결과가 최신 초안 위에 적용되게) */
  onDraft: (fn: (d: ExplainDraft) => ExplainDraft) => void
  /** 실제 저장 결과 */
  onSave: (x: SelfExplanation) => Promise<boolean>
  onCompare: (id: string) => void
  now?: () => number
}) {
  const choices = rejects.map((b) => Number(b.key.split(':').pop())).filter((n) => Number.isInteger(n))
  const [skipped, setSkipped] = useState(false)
  const last = saved.length ? saved[saved.length - 1] : null

  if (!choices.length) return null
  if (skipped) {
    return (
      <p className={styles.quiet}>
        자기 설명을 건너뛰었어요.{' '}
        <button type="button" className={styles.back} onClick={() => setSkipped(false)}>
          다시 열기
        </button>
      </p>
    )
  }

  const { choice, tempting, reject, status } = draft
  const temptLabel = choiceTruth ? '이 선지는 왜 맞는 말인가요? (근거 위치 · 성립 이유)' : '이 선지는 왜 그럴듯한가요? (지문의 어느 표현에 기대나)'
  const rejectLabel = choiceTruth ? '그런데 왜 정답이 아닌가요? (발문이 묻는 것과 어떻게 다른가)' : '무엇이 바뀌어 배제되나요? (주체 · 범위 · 방향 · 조건)'
  const ready = choice != null && (tempting.trim().length > 0 || reject.trim().length > 0) && status !== 'saving'
  const shown = draft.shownId ? saved.find((x) => x.id === draft.shownId) ?? null : null
  const shownBlock = shown ? rejects.find((b) => b.key === `analysis:reject:${shown.choice}`) ?? null : null

  const save = async () => {
    if (choice == null) return
    const { draft: next, id, at } = sending(draft, freshId, now())
    onDraft(() => next)
    const x: SelfExplanation = {
      id,
      item: itemId,
      kind: 'lure',
      choice,
      tempting: tempting.trim().slice(0, EXPLAIN_MAX),
      reject: reject.trim().slice(0, EXPLAIN_MAX),
      at,
      afterExplanation: true,
      compared: false,
    }
    const ok = await onSave(x).catch(() => false)
    onDraft((d) => settled(d, ok, id, clearExplain))
  }

  return (
    <section className={styles.explain} aria-labelledby="self-explain-title" data-testid="self-explain">
      <h2 id="self-explain-title">내 말로 설명해 보기 <span className={styles.optional}>선택</span></h2>
      <p className="break-keep">오답 하나를 골라 설계를 설명해 보세요. 저장하면 분석 설명과 나란히 놓고 비교할 수 있어요. 점수는 매기지 않아요.</p>
      <div className={styles.explainChoices} role="group" aria-label="설명할 오답">
        {choices.map((n) => (
          <button key={n} type="button" aria-pressed={choice === n} onClick={() => onDraft((d) => edited(d, { choice: n }))}>
            {CIRCLED[n] ?? n}
          </button>
        ))}
      </div>
      <label className={styles.explainField}>
        <span>{temptLabel}</span>
        <textarea value={tempting} maxLength={EXPLAIN_MAX} rows={2} onChange={(e) => { const v = e.target.value; onDraft((d) => edited(d, { tempting: v })) }} disabled={choice == null} />
      </label>
      <label className={styles.explainField}>
        <span>{rejectLabel}</span>
        <textarea value={reject} maxLength={EXPLAIN_MAX} rows={2} onChange={(e) => { const v = e.target.value; onDraft((d) => edited(d, { reject: v })) }} disabled={choice == null} />
      </label>
      <p className={styles.draftNote}>저장하지 않은 글은 이 탭에만 있어요 — 새로고침하거나 탭을 닫으면 사라져요.</p>
      <div className={styles.explainActions}>
        <button type="button" onClick={() => void save()} disabled={!ready} data-testid="self-explain-save">
          {status === 'failed' ? '다시 저장' : status === 'saving' ? '저장하는 중…' : '저장하고 분석과 비교'}
        </button>
        <button type="button" onClick={() => setSkipped(true)}>
          건너뛰기
        </button>
      </div>
      <p role="status" aria-live="polite" className="break-keep text-[12.5px]" data-testid="self-explain-status" data-status={status}>
        {status === 'saved' ? '이 기기에 저장했어요.' : status === 'failed' ? '저장하지 못했어요. 쓴 내용은 그대로 두었으니 다시 저장해 주세요.' : ''}
      </p>

      {shown && shownBlock ? (
        <div className={styles.explainCompare} data-testid="self-explain-compare">
          <div>
            <b>내 설명 · {CIRCLED[shown.choice]}</b>
            {shown.tempting ? <p className="break-keep">{shown.tempting}</p> : null}
            {shown.reject ? <p className="break-keep">{shown.reject}</p> : null}
          </div>
          <div>
            <b>분석 설명</b>
            {shown.compared ? (
              shownBlock.body.map((p, i) => (
                <p key={i} className="break-keep">
                  {p}
                </p>
              ))
            ) : (
              <button
                type="button"
                onClick={() => {
                  onCompare(shown.id)
                  track({ name: 'csat_session_explained', props: { kind: 'reject' } })
                }}
                data-testid="self-explain-open"
              >
                분석 설명 펼쳐 비교하기
              </button>
            )}
          </div>
          {shown.compared ? <p className={styles.quiet}>같은 관계를 짚었는지, 바뀐 성분을 같은 것으로 봤는지 스스로 확인해 보세요.</p> : null}
        </div>
      ) : last && !shown ? (
        <p className={styles.quiet}>
          이 문항에서 쓴 설명 {saved.length}개 ·{' '}
          <button type="button" className={styles.back} onClick={() => onDraft((d) => ({ ...d, shownId: last.id }))}>
            마지막 설명 보기
          </button>
        </p>
      ) : null}
    </section>
  )
}
