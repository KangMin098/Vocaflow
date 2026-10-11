// apps/web/src/components/csat/theater/ComparePairs.tsx
'use client'
//
// **같은 원리, 다른 글 — 검수된 비교 쌍.** (2026-10-11 · M4 · 지시문 §9)
//
// 같은 유형이라는 이유만으로 잇지 않는다. 오답 하나씩이 **같은 방식으로** 지문에서 벗어났다고 독립 검수가 통과시킨 쌍만
// 보인다(`compare-data.json`, scripts/csat/compare-drain-*). 쌍이 없는 문항은 이 칸을 그리지 않는다 — 다른 문항이 있다고 꾸미지 않는다.
// 「비교했어요」는 링크를 연 것(열람)과 따로 남긴다 — 두 오답을 실제로 대조했다는 학습자 표시다.

import Link from 'next/link'

import { track } from '@/lib/analytics/client'
import { TRAP_GLOSS } from '@/lib/csat/understanding-check'

import styles from './theater.module.css'

const CIRCLED = ['', '①', '②', '③', '④', '⑤']

export interface ComparePair {
  other: string
  otherSlug: string
  otherLabel: string
  choice: number
  otherChoice: number
  trap: string
  note: string
}

export function ComparePairs({ pairs, compared, onCompared }: { pairs: ComparePair[]; compared: ReadonlySet<string>; onCompared: (other: string) => void }) {
  if (!pairs.length) return null
  return (
    <section className={styles.explain} aria-labelledby="compare-pairs-title" data-testid="compare-pairs">
      <h2 id="compare-pairs-title">
        같은 원리, 다른 글 <span className={styles.optional}>선택</span>
      </h2>
      <p className="break-keep">오답이 같은 방식으로 만들어진 다른 문항이에요. 두 오답을 나란히 놓고 무엇이 같고 무엇이 다른지 확인해 보세요.</p>
      <ul className={styles.comparePairs}>
        {pairs.map((p) => (
          <li key={`${p.other}:${p.otherChoice}`}>
            <p className="break-keep">
              <b>
                이 문항 {CIRCLED[p.choice] ?? p.choice} ↔ <Link href={`/csat/item/${p.otherSlug}`}>{p.otherLabel}</Link> {CIRCLED[p.otherChoice] ?? p.otherChoice}
              </b>{' '}
              · {p.trap}
              {TRAP_GLOSS[p.trap] ? ` (${TRAP_GLOSS[p.trap]})` : ''}
            </p>
            <p className="break-keep">{p.note}</p>
            {compared.has(p.other) ? (
              <p className={styles.quiet}>비교했어요.</p>
            ) : (
              <button
                type="button"
                className={styles.back}
                onClick={() => {
                  onCompared(p.other)
                  track({ name: 'csat_transfer_submitted', props: { relation: 'same_principle' } })
                }}
                data-testid="compare-done"
              >
                두 오답을 비교했어요
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
