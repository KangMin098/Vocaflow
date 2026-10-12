// apps/web/src/components/csat/theater/MeaningRelationView.tsx
'use client'
//
// **문장 연결 — 앞 의미가 뒤에서 어떻게 바뀌나.** (v3.1 · 설계 §3.1 관계 선택)
// 접속사 이름이 아니라 두 의미와 실제 변화(changeKo)를 한 판에 보인다. 추론이면 근거와 한계를 함께 보인다.

import type { MeaningSupportView, MsRelation } from '@/lib/csat/meaning-support/labels'
import { BASIS_LABEL_MS, RELATION_KIND_LABEL } from '@/lib/csat/meaning-support/labels'

import styles from './theater.module.css'

export function MeaningRelationView({ view, relation, onPickUnit }: { view: MeaningSupportView; relation: MsRelation; onPickUnit: (id: string) => void }) {
  const label = (ids: string[]) => ids.map((id) => view.units.find((u) => u.id === id)).filter(Boolean)
  return (
    <div className={styles.msRelation} data-testid="ms-relation" data-relation={relation.id}>
      <p className="break-keep">
        <span className={styles.diagramLabel}>{RELATION_KIND_LABEL[relation.kind]}</span>
        <span className={styles.epistemic}>{BASIS_LABEL_MS[relation.basis]}</span>
      </p>
      <div className={styles.msRelationGrid}>
        <div>
          <b>앞</b>
          {label(relation.from).map((u) => (
            <button key={u!.id} type="button" className={styles.back} onClick={() => onPickUnit(u!.id)}>{u!.labelKo}</button>
          ))}
          <p className="break-keep">{relation.beforeKo}</p>
        </div>
        <div aria-hidden className={styles.msArrow}>→</div>
        <div>
          <b>뒤</b>
          {label(relation.to).map((u) => (
            <button key={u!.id} type="button" className={styles.back} onClick={() => onPickUnit(u!.id)}>{u!.labelKo}</button>
          ))}
          <p className="break-keep">{relation.afterKo}</p>
        </div>
      </div>
      <p className="break-keep"><span className={styles.diagramLabel}>무엇이 바뀌나</span>{relation.changeKo}</p>
      {relation.warrantsKo.length ? <p className="break-keep"><span className={styles.diagramLabel}>이렇게 잇는 근거</span>{relation.warrantsKo.join(' · ')}</p> : null}
      {relation.limitKo ? <p className="break-keep"><span className={styles.diagramLabel}>여기까지만</span>{relation.limitKo}</p> : null}
    </div>
  )
}
