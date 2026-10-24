// apps/web/src/components/csat/judgment/JudgmentShell.tsx
// 증거면(원문) + 판단면 두 면. 두 면은 각자 스크롤하므로 한쪽을 움직여도 다른 쪽 위치·선택이 남는다.
'use client'

import type { ReactNode } from 'react'
import styles from './judgment.module.css'

export function JudgmentShell({ title, stem, evidence, judgment }: { title: string; stem: string; evidence: ReactNode; judgment: ReactNode }) {
  return (
    <div className={styles.shell} data-judgment-shell>
      <section className={styles.pane} data-scroll-pane="evidence" aria-label="원문">
        <h2>{title}</h2>
        <p className={styles.stem}>{stem}</p>
        {evidence}
      </section>
      <section className={styles.pane} data-scroll-pane="judgment" aria-label="판단">
        {judgment}
      </section>
    </div>
  )
}

export { styles as judgmentStyles }
