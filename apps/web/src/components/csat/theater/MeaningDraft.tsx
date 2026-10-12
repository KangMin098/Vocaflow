// apps/web/src/components/csat/theater/MeaningDraft.tsx
'use client'
//
// **내 말로 — 메모리 초안.** (v3.1 · 설계 §4)
// 저장 버튼 · 저장 완료 · 서버 동기화가 없다. 같은 문항 안 의미 · 장면 이동에는 부모가 의미별로 지키고,
// 새로 고침 · 문항 이탈 · 로그아웃에는 사라진다는 점을 쓰기 전에 알린다. 600자를 넘으면 잘라내지 않고 알리기만 한다.
// 자동 판정 · 이해도 점수 없음. 검수된 쉬운 말 · 보존 조건과 나란히 놓고 스스로 대조할 뿐이다.

import { useState } from 'react'

import type { MsUnit } from '@/lib/csat/meaning-support/labels'
import { FACET_LABEL } from '@/lib/csat/meaning-support/labels'
import { DRAFT_MAX, draftTooLong } from '@/lib/csat/meaning-support/model'

import styles from './theater.module.css'

export function MeaningDraft({ unit, text, onChange }: { unit: MsUnit; text: string; onChange: (t: string) => void }) {
  const [open, setOpen] = useState(Boolean(text))
  const [compared, setCompared] = useState(false)
  const over = draftTooLong(text)
  if (!open) {
    return (
      <button type="button" className={styles.back} onClick={() => setOpen(true)} data-testid="ms-draft-open">
        내 말로 써 보기(선택)
      </button>
    )
  }
  return (
    <div className={styles.msDraft} data-testid="ms-draft">
      <label className={styles.explainField}>
        <span className="break-keep">이 의미를 내 말로 — 저장되지 않아요. 새로 고침하거나 다른 문항으로 가면 사라져요.</span>
        <textarea value={text} rows={3} onChange={(e) => onChange(e.target.value)} aria-invalid={over} aria-describedby="ms-draft-count" data-testid="ms-draft-text" />
      </label>
      <p id="ms-draft-count" className={over ? styles.msWarn : styles.quiet} role={over ? 'alert' : undefined}>
        {[...text].length} / {DRAFT_MAX}자{over ? ' — 너무 길어요. 줄여 주세요(잘라내지 않았어요).' : ''}
      </p>
      {text.trim() ? (
        compared ? (
          <div className={styles.explainCompare} data-testid="ms-draft-compare">
            <div><b>내 말</b><p className="break-keep">{text}</p></div>
            <div>
              <b>검수된 쉬운 말</b>
              <p className="break-keep">{unit.simpleKo}</p>
              {unit.preserves.length ? (
                <ul className="break-keep">
                  {unit.preserves.map((p, i) => (<li key={i}><span className={styles.diagramLabel}>{FACET_LABEL[p.facet]}</span>{p.valueKo}</li>))}
                </ul>
              ) : null}
            </div>
            <p className={styles.quiet}>이 조건들이 내 말에도 남아 있는지 스스로 확인해 보세요. 점수는 매기지 않아요.</p>
          </div>
        ) : (
          <button type="button" className={styles.back} onClick={() => setCompared(true)} data-testid="ms-draft-compare-open">
            검수된 설명과 나란히 보기
          </button>
        )
      ) : null}
    </div>
  )
}
