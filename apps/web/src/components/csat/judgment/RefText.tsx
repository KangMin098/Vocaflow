// apps/web/src/components/csat/judgment/RefText.tsx
// 해설 문장의 [u3] 을 원문 링크로 그린다 — 누르면 원문 쪽이 그 단위를 가리키고, 포커스는 학습자 자리에 남는다.
'use client'

import { splitRefs } from '@/lib/csat/judgment/evidence'
import type { EvidenceUnit } from '@/lib/csat/judgment/types'
import styles from './judgment.module.css'

export function RefText({ text, units, active, onRef }: { text: string; units: EvidenceUnit[]; active?: string[]; onRef: (unitId: string) => void }) {
  return (
    <>
      {splitRefs(text, units).map((p, i) =>
        p.kind === 'text' ? (
          <span key={i}>{p.text}</span>
        ) : p.known ? (
          <button key={i} type="button" className={styles.ref} data-ref={p.unitId} aria-pressed={active?.includes(p.unitId) ?? false} onClick={() => onRef(p.unitId)}>
            {p.label}
          </button>
        ) : (
          <span key={i} className={styles.refDead} title="원문에 없는 참조">{p.label}</span>
        ),
      )}
    </>
  )
}
