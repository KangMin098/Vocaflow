// apps/web/src/components/csat/theater/MeaningDraft.tsx
'use client'
//
// **원문 이해 — 과거 「내 말로」 노트의 읽기 전용 기록.** (v3.2 scene=meaning 작성 칸 → 2026-10-23 T-0091 전환)
//
// 새로 쓰기 · 고쳐 쓰기 · 내 말과 검수된 쉬운 말의 자기 대조는 없다(학습자 글을 평가 · 대조하지 않는다 — DECISIONS CL-SL-1).
// 검수된 쉬운 말 · 지킬 조건 · 앞뒤 관계는 패널 본문이 이미 보인다. 이 칸은 예전에 저장한 노트가 있을 때만 그대로 보인다
// (MeaningNote 기록 · 병합 계약은 그대로 — 지우거나 덮지 않는다). 쓰지 않는 옛 props 는 호출부 호환으로만 받는다.

import type { MeaningNote } from '@/lib/csat/meaning-note'
import type { MsRelation, MsUnit } from '@/lib/csat/meaning-support/labels'
import { RELATION_KIND_LABEL } from '@/lib/csat/meaning-support/labels'

import styles from './theater.module.css'

export function MeaningDraft({
  note,
  stale,
  relations,
  onRelation,
}: {
  unit?: MsUnit
  /** 이 의미의 예전 노트(없으면 null) */
  note: MeaningNote | null
  /** 노트가 지금과 다른 설명을 보고 쓴 것인가 */
  stale: boolean
  text?: string
  onChange?: (t: string) => void
  onSave?: (text: string) => Promise<boolean>
  onRevise?: (text: string, change: string) => Promise<boolean>
  onCompared?: () => void
  /** 이 의미와 이어진 검수된 관계 */
  relations: { relation: MsRelation; side: 'before' | 'after' }[]
  onRelation: (id: string) => void
  onWhole?: () => void
}) {
  if (!note) return null
  return (
    <details className={styles.msDraft} data-testid="ms-note" data-readonly="true" data-revised={note.revised ? 'true' : 'false'}>
      <summary>과거 작성 기록 · 읽기 전용</summary>
      {stale ? (
        <p className={`${styles.quiet} break-keep`} data-testid="ms-note-stale">예전 설명을 보고 쓴 노트예요 — 지금 설명과 다를 수 있어요. 기록은 그대로 두었어요.</p>
      ) : null}
      {note.revised ? (
        <div className={styles.explainCompare} data-testid="ms-note-history">
          <div><b>처음 쓴 설명</b><p className="break-keep">{note.first}</p></div>
          <div><b>고쳐 쓴 설명</b><p className="break-keep">{note.revised}</p></div>
          {note.change ? <p className="break-keep"><span className={styles.diagramLabel}>달라진 점</span>{note.change}</p> : null}
        </div>
      ) : (
        <p className="break-keep"><span className={styles.diagramLabel}>예전에 쓴 말</span>{note.first}</p>
      )}
      {relations.length ? (
        <p className={styles.msSpeakRow}>
          {relations.map(({ relation, side }) => (
            <button key={relation.id} type="button" className={styles.back} onClick={() => onRelation(relation.id)} data-testid="ms-note-relation">
              {side === 'before' ? '앞과의 연결' : '뒤와의 연결'} · {RELATION_KIND_LABEL[relation.kind]}
            </button>
          ))}
        </p>
      ) : null}
    </details>
  )
}
