// apps/web/src/lib/csat/map/v62/__tests__/study-items.test.ts
// v6.2 P-M3b — 기출 해부 링크의 학습자 노출 규칙(순수)
import { describe, expect, it } from 'vitest'

import RESEARCH from '../research-v14.data.json'
import { studyItemsFor } from '../study-items'

const link = (target: string) => ({ target, href: `/csat/item/${target}`, label: target })
const check = (unseen: string[]) => ({ taskKey: 'claim-support', status: 'unverified', independentItems: 0, attemptedItems: 0, verifiedItems: [], wrongItems: [], unseen, examSeen: [], verifiedAt: null }) as never

describe('기출 해부로 열 문항 — 노출 규칙', () => {
  it('안 푼 확인 문항 · 전이 문항은 링크로 만들지 않고 보류 수만 센다', () => {
    const s = studyItemsFor('r.central_meaning', check(['2026#20', '2025#20']), [link('2026#20'), link('2025#20')], [link('M2609#23')])
    expect(s.items.filter((x) => x.basis === 'attempted_check_item')).toEqual([])
    expect(s.withheld).toBe(3)
    expect(s.items.some((x) => ['2026#20', '2025#20', 'M2609#23'].includes(x.item))).toBe(false)
  })
  it('이미 푼 확인 문항만 해부로 연다', () => {
    const s = studyItemsFor('r.central_meaning', check(['2025#20']), [link('2026#20'), link('2025#20')], [])
    expect(s.items.filter((x) => x.basis === 'attempted_check_item').map((x) => x.item)).toEqual(['2026#20'])
    expect(s.withheld).toBe(1)
  })
  it('연구 사례는 두 AI 가 같은 판정(직접 · 간접)이고 확인 · 전이 묶음 밖일 때만', () => {
    const agreed = RESEARCH.links.filter((l) => l.task === 'r.central_meaning' && l.agree && l.first !== 'not_applicable').map((l) => l.item)
    const split = RESEARCH.links.filter((l) => l.task === 'r.central_meaning' && !l.agree).map((l) => l.item)
    const s = studyItemsFor('r.central_meaning', check([]), [], [])
    const cases = s.items.filter((x) => x.basis === 'research_case').map((x) => x.item)
    expect(cases.sort()).toEqual(agreed.sort())
    expect(cases.some((i) => split.includes(i))).toBe(false)
    // 같은 문항이 전이 묶음에 있으면 연구 사례로도 열지 않는다
    const blocked = studyItemsFor('r.central_meaning', check([]), [], agreed.map(link))
    expect(blocked.items.filter((x) => x.basis === 'research_case')).toEqual([])
  })
  it('공유 지문 노출은 원장이 없어 판정하지 않았다는 사실을 함께 돌려준다', () => {
    expect(studyItemsFor('e.option_correspondence', null, [], []).sharedPassageUnchecked).toBe(true)
  })
})
