// apps/web/src/components/csat/theater/MeaningDraft.tsx
'use client'
//
// **내 말로 이해하기 — 의미 하나를 내 말로 쓰고, 검수된 쉬운 말과 대조하고, 고쳐 쓴다.** (v3.2 · scene=meaning)
//
// 흐름(모두 선택 — 쓰지 않아도 강의 · 근거 · 다른 장면으로 자유롭게 간다):
//   ① 「내 말로 써 보기」를 눌러야 입력칸이 펼쳐진다(상시 노출 안 함). 한두 문장이면 충분하다.
//   ② 저장 → 내 기록(DissectionRecord.meaningNotes · 기기 + 서버 동기화). 실패하면 글을 지키고 「다시 저장」.
//   ③ 「검수된 쉬운 말과 나란히」 — 내 말 · 검수된 쉬운 말 · 지킬 조건(주체 · 조건 · 부정 · 범위 · 시간 · 인과 · 가능성 …).
//      표현이 달라도 같은 뜻이면 괜찮다. 자동 채점 · 정오 판정 · 점수 없음 — 조건이 내 말에 남았는지 스스로 본다.
//   ④ 「고쳐 쓰기」 — 처음 설명은 남기고 고친 설명을 따로 저장, 원하면 「처음 이해와 달라진 점」을 짧게. 고친 횟수는 세지 않는다.
//   ⑤ 대조 뒤 「이 의미가 이어지는 곳」 — 앞뒤 관계 · 글 전체 단계로(검수된 관계 · 통합 설명 재사용).
// 저장 전 입력은 문항별 탭 메모리(부모)가 지킨다. 학습자 글은 자동 낭독하지 않는다.

import { useEffect, useState } from 'react'

import { track } from '@/lib/analytics/client'
import { MEANING_CHANGE_MAX, MEANING_NOTE_MAX, type MeaningNote } from '@/lib/csat/meaning-note'
import type { MsRelation, MsUnit } from '@/lib/csat/meaning-support/labels'
import { FACET_LABEL, RELATION_KIND_LABEL } from '@/lib/csat/meaning-support/labels'

import styles from './theater.module.css'

type Mode = 'closed' | 'write' | 'saved' | 'revise'

export function MeaningDraft({
  unit,
  note,
  stale,
  text,
  onChange,
  onSave,
  onRevise,
  onCompared,
  relations,
  onRelation,
  onWhole,
}: {
  unit: MsUnit
  /** 이 의미의 저장된 노트(없으면 null) */
  note: MeaningNote | null
  /** 노트가 지금과 다른 설명을 보고 쓴 것인가 */
  stale: boolean
  /** 저장 전 입력(탭 메모리) */
  text: string
  onChange: (t: string) => void
  onSave: (text: string) => Promise<boolean>
  onRevise: (text: string, change: string) => Promise<boolean>
  onCompared: () => void
  /** 이 의미와 이어진 검수된 관계 */
  relations: { relation: MsRelation; side: 'before' | 'after' }[]
  onRelation: (id: string) => void
  /** 글 전체 단계 보기 */
  onWhole: () => void
}) {
  const [mode, setMode] = useState<Mode>(note ? 'saved' : text ? 'write' : 'closed')
  const [compared, setCompared] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [revText, setRevText] = useState(note?.revised ?? note?.first ?? '')
  const [change, setChange] = useState(note?.change ?? '')
  useEffect(() => {
    if (note && mode === 'closed') setMode('saved')
  }, [note, mode])

  const mine = note?.revised ?? note?.first ?? ''
  const save = async (fn: () => Promise<boolean>, next: Mode) => {
    setBusy(true)
    setFailed(false)
    const ok = await fn().catch(() => false)
    setBusy(false)
    if (ok) setMode(next)
    else setFailed(true)
  }
  const count = (t: string, max: number) => (
    <span className={[...t].length > max ? styles.msWarn : styles.quiet}>{[...t].length} / {max}자</span>
  )

  if (mode === 'closed') {
    return (
      <button type="button" className={styles.back} onClick={() => setMode('write')} data-testid="ms-draft-open">
        내 말로 써 보기(선택)
      </button>
    )
  }

  if (mode === 'write') {
    const over = [...text].length > MEANING_NOTE_MAX
    return (
      <div className={styles.msDraft} data-testid="ms-draft">
        <label className={styles.explainField}>
          <span className="break-keep">이 의미를 내 말로 — 한두 문장이면 충분해요. 저장하면 내 기록에 남아요.</span>
          <textarea value={text} rows={2} onChange={(e) => onChange(e.target.value)} aria-invalid={over} data-testid="ms-draft-text" />
        </label>
        <p className={styles.msSpeakRow}>
          {count(text, MEANING_NOTE_MAX)}
          <button type="button" className={styles.back} disabled={busy || !text.trim() || over} onClick={() => void save(() => onSave(text), 'saved')} data-testid="ms-draft-save">
            {failed ? '다시 저장' : busy ? '저장하는 중…' : '저장'}
          </button>
          <button type="button" className={styles.back} onClick={() => setMode('closed')}>접기</button>
        </p>
        {failed ? <p className={styles.msWarn} role="alert" data-testid="ms-draft-failed">저장하지 못했어요. 쓴 글은 그대로 있어요 — 다시 저장해 주세요.</p> : null}
      </div>
    )
  }

  if (mode === 'revise' && note) {
    const over = [...revText].length > MEANING_NOTE_MAX || [...change].length > MEANING_CHANGE_MAX
    return (
      <div className={styles.msDraft} data-testid="ms-draft-revise">
        <p className="break-keep"><span className={styles.diagramLabel}>처음 쓴 설명</span>{note.first}</p>
        <label className={styles.explainField}>
          <span>고쳐 쓴 설명</span>
          <textarea value={revText} rows={2} onChange={(e) => setRevText(e.target.value)} data-testid="ms-revise-text" />
        </label>
        <label className={styles.explainField}>
          <span className="break-keep">처음 이해와 달라진 점(선택)</span>
          <textarea value={change} rows={1} onChange={(e) => setChange(e.target.value)} data-testid="ms-revise-change" />
        </label>
        <p className={styles.msSpeakRow}>
          {count(revText, MEANING_NOTE_MAX)}
          <button type="button" className={styles.back} disabled={busy || !revText.trim() || over} onClick={() => void save(() => onRevise(revText, change), 'saved')} data-testid="ms-revise-save">
            {failed ? '다시 저장' : busy ? '저장하는 중…' : '고친 설명 저장'}
          </button>
          <button type="button" className={styles.back} onClick={() => { setFailed(false); setMode('saved') }}>그만 고치기</button>
        </p>
        {failed ? <p className={styles.msWarn} role="alert" data-testid="ms-draft-failed">저장하지 못했어요. 고친 글은 그대로 있어요 — 다시 저장해 주세요.</p> : null}
      </div>
    )
  }

  if (!note) return null
  return (
    <div className={styles.msDraft} data-testid="ms-note" data-revised={note.revised ? 'true' : 'false'}>
      {stale ? (
        <p className={`${styles.quiet} break-keep`} data-testid="ms-note-stale">예전 설명을 보고 쓴 노트예요 — 지금 설명과 다를 수 있어요. 기록은 그대로 두었어요.</p>
      ) : null}
      {/* 수정 전후 — 대조 중에는 대조 칸이 내 말을 보이므로 위에 다시 쓰지 않는다(처음 설명은 대조 칸에서 펼쳐 본다) */}
      {compared ? null : note.revised ? (
        <div className={styles.explainCompare} data-testid="ms-note-history">
          <div><b>처음 쓴 설명</b><p className="break-keep">{note.first}</p></div>
          <div><b>고쳐 쓴 설명</b><p className="break-keep">{note.revised}</p></div>
          {note.change ? <p className="break-keep"><span className={styles.diagramLabel}>달라진 점</span>{note.change}</p> : null}
        </div>
      ) : (
        <p className="break-keep"><span className={styles.diagramLabel}>내 말</span>{note.first}</p>
      )}

      {compared ? (
        <div className={styles.explainCompare} data-testid="ms-draft-compare">
          <div>
            <b>{note.revised ? '내 말(고쳐 쓴 설명)' : '내 말'}</b>
            <p className="break-keep">{mine}</p>
            {note.revised ? (
              <details data-testid="ms-note-history">
                <summary>처음 쓴 설명{note.change ? ' · 달라진 점' : ''}</summary>
                <p className="break-keep">{note.first}</p>
                {note.change ? <p className="break-keep"><span className={styles.diagramLabel}>달라진 점</span>{note.change}</p> : null}
              </details>
            ) : null}
          </div>
          <div>
            <b>검수된 쉬운 말</b>
            <p className="break-keep">{unit.simpleKo}</p>
          </div>
          {unit.preserves.length ? (
            <div className={styles.msKeep}>
              <b className="break-keep">내 말에도 남아 있는지 볼 조건</b>
              <ul className="break-keep">
                {unit.preserves.map((p, i) => (<li key={i}><span className={styles.diagramLabel}>{FACET_LABEL[p.facet]}</span>{p.valueKo}</li>))}
              </ul>
            </div>
          ) : null}
          <p className={`${styles.quiet} break-keep`}>표현이 달라도 같은 뜻이면 괜찮아요. 빠진 조건이 있으면 고쳐 써 보세요. 점수는 매기지 않아요.</p>
        </div>
      ) : null}

      <p className={styles.msSpeakRow}>
        {!compared ? (
          <button
            type="button"
            className={styles.back}
            onClick={() => {
              const n = [...mine].length
              track({ name: 'csat_meaning_draft_compared', props: { length: n < 50 ? 'lt50' : n < 200 ? 'lt200' : 'gte200' } })
              setCompared(true)
              onCompared()
            }}
            data-testid="ms-draft-compare-open"
          >
            검수된 쉬운 말과 나란히 보기
          </button>
        ) : null}
        <button type="button" className={styles.back} onClick={() => { setRevText(note.revised ?? note.first); setChange(note.change ?? ''); setMode('revise') }} data-testid="ms-revise-open">
          고쳐 쓰기
        </button>
      </p>

      {compared ? (
        <div className={styles.msNext} data-testid="ms-note-next">
          <span className={styles.diagramLabel}>이 의미가 이어지는 곳</span>
          <p className={styles.msSpeakRow}>
            {relations.map(({ relation, side }) => (
              <button key={relation.id} type="button" className={styles.back} onClick={() => onRelation(relation.id)} data-testid="ms-note-relation">
                {side === 'before' ? '앞과의 연결' : '뒤와의 연결'} · {RELATION_KIND_LABEL[relation.kind]}
              </button>
            ))}
            <button type="button" className={styles.back} onClick={onWhole} data-testid="ms-note-whole">글 전체 단계에서 보기</button>
          </p>
        </div>
      ) : null}
    </div>
  )
}
