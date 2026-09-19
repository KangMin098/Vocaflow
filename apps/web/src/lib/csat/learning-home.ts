// apps/web/src/lib/csat/learning-home.ts
import type { DissectionCatalog, DissectionItem, DissectionRecord } from './dissect'

export function patternGroups(items: DissectionItem[]) {
  const groups = new Map<string, { tag: string; formula: string; format: string; items: DissectionItem[] }>()
  for (const item of items) {
    const group = groups.get(item.formulaTag) ?? { tag: item.formulaTag, formula: item.formula, format: item.format, items: [] }
    group.items.push(item); groups.set(item.formulaTag, group)
  }
  return [...groups.values()]
}
export function patternPosition(items: DissectionItem[], record: DissectionRecord) {
  if (record.queue.some(q => items.some(i => i.formulaTag === q.tag))) return '다시 확인할 원리'
  if (record.formulas.some(f => items.some(i => i.formulaTag === f.tag))) return '내 공식에 보관'
  if (record.predictions.some(p => items.some(i => i.id === p.item))) return '예측해 본 원리'
  if (record.inspected?.some(id => items.some(i => i.id === id))) return '분석을 읽은 원리'
  return '아직 탐색 전'
}
export function recommendationReason(catalog: DissectionCatalog, plan: DissectionItem[], record: DissectionRecord, now: number) {
  if (!plan.length) return '검토된 분석 문항을 준비하고 있어요.'
  const due = record.queue.find(q => q.due <= now && plan[2]?.formulaTag === q.tag && plan[2]?.id !== q.source)
  if (due) return '아직 모르겠다고 남긴 원리를 다시 확인할 때예요. 같은 공식의 다른 문항을 전이에 넣었어요.'
  if (!record.predictions.length) return '첫 분석은 정답을 알고 시작해요. 근거와 오답을 어떻게 설계했는지 예측하고, 다른 지문에서 확인해요.'
  const families = new Set(catalog.items.filter(i => i.type_id === plan[0].type_id).map(i => i.distractor.family))
  const seen = new Set(record.predictions.filter(p => p.type === plan[0].type_id && p.family).map(p => p.family))
  const unseen = [...families].filter(f => !seen.has(f))
  if (unseen.length) return `이 유형에는 아직 예측하지 않은 함정 계열이 ${unseen.length}개 있어요. 탐색 비율이 낮은 유형부터 골랐어요.`
  return '이 유형의 함정 계열을 모두 예측해 봤어요. 덜 최근에 살펴본 문항부터 다시 비교해요.'
}
