// apps/web/src/components/csat/session/PatternMap.tsx
'use client'

import Link from 'next/link'
import type { DissectionItem, DissectionRecord } from '@/lib/csat/dissect'
import { patternGroups, patternPosition } from '@/lib/csat/learning-home'
import { toItemSlug } from '@/lib/csat/item-slug'
import visual from './visual-analysis.module.css'

export function PatternMap({ items, record }: { items: DissectionItem[]; record: DissectionRecord }) {
  return <div className={visual.patternTree} data-testid="visual-pattern-map">
    <div className={visual.treeRoot}><span>발견한 관계를 모으는 곳</span><strong>출제 원리</strong><small>같은 공식으로 묶인 문항</small></div>
    <div className={visual.branches}>{patternGroups(items).map(group => <div className={visual.branch} key={group.tag}>
      <Link className={visual.patternNode} href={`/csat/dissect?formula=${group.tag}`}><strong>{group.format}</strong><span>{patternPosition(group.items, record)}</span></Link>
      <div className={visual.leaves}>{group.items.map(item => {
        const queued = record.queue.some(q => q.tag === item.formulaTag && q.source === item.id)
        const saved = record.formulas.some(f => f.sources.includes(item.id))
        const seen = record.inspected?.includes(item.id) || record.predictions.some(p => p.item === item.id)
        const state = queued ? 'review' : saved ? 'saved' : seen ? 'seen' : 'new'
        return <Link key={item.id} data-state={state} href={`/csat/dissect?item=${toItemSlug(item.id)}`}><span className={visual.recordMark} aria-hidden>{queued ? '↻' : saved ? '✓' : seen ? '•' : '○'}</span><span>{item.exam_id} · {item.no}<small>{queued ? '다시 확인' : saved ? '공식 보관' : seen ? '살펴봄' : '탐색 전'}</small></span></Link>
      })}</div>
    </div>)}</div>
  </div>
}
