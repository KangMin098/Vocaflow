// apps/web/src/components/csat/diagnosis/map/__tests__/inspector-study.test.tsx
//
// T-0159 — 학습지도 「기출 해부로 공부하기」 목록은 같은 지문 보호(노출 원장)를 거친 entriesFor 결과만 링크로 만든다.
// studyItemsFor 는 공급 · 계획 입력으로만 남는다(그 목록을 직접 링크로 그리면 안 푼 확인 문항과 같은 지문의 해설이 열린다).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {} }) }))
vi.mock('@/lib/analytics/client', () => ({ track: () => {} }))
vi.mock('@/lib/csat/map/learner-path', () => ({ learnerPath: () => ({ read: [], listen: [] }) }))

import type { ExposureLedger } from '@/lib/csat/map/v62/assessment-exposure'
import { entriesFor, researchTypeOf } from '@/lib/csat/bridge/entry'

const src = readFileSync(join(__dirname, '..', 'TaskInspector.tsx'), 'utf8')
const block = src.slice(src.indexOf('data-testid="inspector-study"'), src.indexOf('data-testid="inspector-study-withheld"'))

describe('TaskInspector 기출 목록 가드', () => {
  it('목록 링크는 entriesFor 결과(entry.entries)에서만 — study.items 를 그리지 않는다', () => {
    expect(block).toContain('entry.entries.map')
    expect(block).not.toContain('study.items.map')
    expect(src).toMatch(/ledger: data\.v4\?\.assessmentExposure \?\? \{ status: 'error'/)
  })
  it('추천 이유 · 판단 능력 · 해설 열람 의미를 보인다', () => {
    for (const id of ['inspector-study-why', 'inspector-study-goal', 'inspector-study-meaning']) expect(src).toContain(`data-testid="${id}"`)
    expect(src).toContain('약점으로 확정하지 않았어요')
  })
  it('과거 보기는 지도 복귀 문맥을 싣지 않는다', () => {
    expect(block).toContain('href={past ? `/csat/item/${toItemSlug(e.item)}` : e.href}')
  })
})

describe('화면이 받는 원장(compactLedger 형태)으로 같은 지문 보호가 동작', () => {
  const base = {
    task: 'r.central_meaning', need: null, goalNeed: null, goalSet: false,
    check: { taskKey: 'claim-support', status: 'unverified' as const, independentItems: 0, attemptedItems: 0, verifiedItems: [], wrongItems: [], unseen: ['2024#22'], examSeen: [], verifiedAt: null },
    confirm: [{ target: '2024-22', href: '', label: '' }], transfer: [], typeOf: researchTypeOf, ctx: {},
  }
  it('안 푼 확인 문항과 같은 지문인 연구 사례는 빠지고 withheld 로 센다', () => {
    const ledger: ExposureLedger = { status: 'ok', events: [], passageKeys: { '2024#22': 'p', '2019#23': 'p', '2015#32': 'q', '2014B#38': 'r', '2020#36': 's' } }
    const r = entriesFor({ ...base, ledger })
    expect(r.entries.map((e) => e.item)).not.toContain('2019#23')
    expect(r.entries.map((e) => e.item)).toContain('2015#32')
    expect(r.withheld).toBeGreaterThanOrEqual(2)
  })
  it('원장 오류면 연구 사례 전부 보류', () => {
    expect(entriesFor({ ...base, ledger: { status: 'error', failed: [] } }).entries).toEqual([])
  })
  it('연구 데이터 유형은 그대로, 없는 문항은 null', () => {
    expect(researchTypeOf('2019#23')).toBe('R-TOPIC')
    expect(researchTypeOf('2019-23')).toBe('R-TOPIC')
    expect(researchTypeOf('1999#1')).toBeNull()
  })
})

describe('실제 렌더(r5 fixture) — 학습지도 기출 목록', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server')
  const { build, CHECK_ITEMS, pick } = await import('./r5-inspector-fixture')
  const { TaskInspector } = await import('../TaskInspector')
  const draw = (passageKeys: Record<string, string>, goalSet = true) => {
    const b = build({ goalSet, attempts: [], activity: [], asOfDay: 30, saved: true, fq: { status: 'not_installed' } })
    ;(b.data.v4 as unknown as { assessmentExposure: ExposureLedger }).assessmentExposure = { status: 'ok', events: [], passageKeys }
    return renderToStaticMarkup(<TaskInspector ins={b.ins} view={b.view} data={b.data} past={false} restoreWs={null} planOpen={false} onTogglePlan={() => {}} returned={null} />)
  }
  const own = Object.fromEntries([...CHECK_ITEMS, '2020#24', '2019#24'].map((r) => [r, `p:${r}`]))
  const linksOf = (html: string) => pick(html, 'inspector-study-link').map((l) => l.attrs.href)

  it('연구 사례 지문을 모르면 링크를 만들지 않는다(fail-closed)', () => {
    expect(linksOf(draw(own))).toEqual([])
  })
  it('같은 지문이면 빠지고, 다른 지문이면 이유 · 판단 능력 · 복귀 문맥과 함께 열린다', () => {
    const html = draw({ ...own, '2019#23': 'p:2026#22', '2015#32': 'p:x1', '2014B#38': 'p:x2', '2020#36': 'p:x3' })
    const links = linksOf(html)
    expect(links.some((h) => h.includes('2019-23'))).toBe(false) // 안 푼 확인 문항 2026#22 와 같은 지문
    expect(links.some((h) => h.includes('2015-32'))).toBe(true)
    expect(links.every((h) => h.includes('from=map') && h.includes('map_task=r.central_meaning'))).toBe(true)
    const why = pick(html, 'inspector-study-why').map((w) => w.text).join(' ')
    expect(why).toContain('판단 능력')
    expect(pick(html, 'inspector-study-meaning')[0].text).toContain('혼자 판단한 기록으로는 세지 않아요')
    expect(pick(html, 'inspector-study-withheld')[0].text).toMatch(/같은 지문/)
  })
  it('목표 미설정이면 목표 관계를 계산하지 않았다고 말한다', () => {
    const html = draw({ ...own, '2015#32': 'p:x1' }, false)
    expect(pick(html, 'inspector-study-goal')[0].attrs['data-goal']).toBe('goal_not_set')
  })
})
