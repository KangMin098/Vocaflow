// apps/web/src/components/csat/session/PatternMap.tsx
//
// 탐색 지도 — 출제 패턴마다 그 패턴 색의 카드 한 장(참조 제품 카드 3열). 카드 안은 문항 행과 기기 기록 상태.
// 상태는 기호 + 글자로 함께 보인다(색만으로 전하지 않는다).
'use client'

import { ArrowRight, Check, Circle, Dot, RotateCcw } from 'lucide-react'
import Link from 'next/link'
import type { DissectionItem, DissectionRecord } from '@/lib/csat/dissect'
import { patternGroups, patternPosition } from '@/lib/csat/learning-home'
import { toItemSlug } from '@/lib/csat/item-slug'
import { TINT_CLASS, type Tint } from '@/lib/design/tone'
import home from './learning-home.module.css'

type State = 'review' | 'saved' | 'seen' | 'new'
const LABEL: Record<State, string> = { review: '다시 확인', saved: '공식 보관', seen: '살펴봄', new: '탐색 전' }
const MARK: Record<State, typeof Check> = { review: RotateCcw, saved: Check, seen: Dot, new: Circle }

export function PatternMap({ items, record, toneOf }: { items: DissectionItem[]; record: DissectionRecord; toneOf: Map<string, Tint> }) {
  const stateOf = (item: DissectionItem): State => {
    if (record.queue.some(q => q.tag === item.formulaTag && q.source === item.id)) return 'review'
    if (record.formulas.some(f => f.sources.includes(item.id))) return 'saved'
    if (record.inspected?.includes(item.id) || record.predictions.some(p => p.item === item.id)) return 'seen'
    return 'new'
  }
  const touched = items.filter(i => stateOf(i) !== 'new').length
  return <div data-testid="visual-pattern-map">
    <p className={home.mapSummary}><strong>{touched}</strong> / {items.length}문항을 살펴봤어요 <span aria-hidden>·</span> {(['seen', 'saved', 'review'] as const).map(s => { const Mark = MARK[s]; return <span key={s}><Mark size={14} aria-hidden /> {LABEL[s]}</span> })}</p>
    <div className={home.mapCards}>{patternGroups(items).map(group => <section key={group.tag} className={`${TINT_CLASS[toneOf.get(group.tag) ?? 'lavender']} ${home.mapCard}`} aria-label={`${group.format} 패턴`}>
      <header><strong>{group.format}</strong><span>{patternPosition(group.items, record)}</span></header>
      <ul>{group.items.map(item => {
        const state = stateOf(item)
        const Mark = MARK[state]
        return <li key={item.id}><Link data-state={state} href={`/csat/dissect?item=${toItemSlug(item.id)}`}>
          <Mark size={16} aria-hidden />
          <span><b>{item.exam_id} · {item.no}번</b>{item.topic}</span>
          <small>{LABEL[state]}</small>
        </Link></li>
      })}</ul>
      <Link className={home.mapCardFoot} href={`/csat/dissect?formula=${group.tag}`}>이 원리로 해부하기 <ArrowRight size={15} aria-hidden /></Link>
    </section>)}</div>
  </div>
}
