// apps/web/src/components/csat/diagnosis/map/__tests__/r5-inspector-fixture.tsx
// R5 r.central_meaning TaskInspector 격리 fixture — 합성 기록 · 고정 시각 · DB 읽기/쓰기 0. 실제 학습자 · 개발 DB 증거가 아니다.
// 계산은 실제 순수 함수(asIsMap · toBeMap · planWorkspaces · workspacePlan · ranksOf · taskInspector)를 그대로 탄다.
import { renderToStaticMarkup } from 'react-dom/server'

import type { ActivityRow } from '@/lib/csat/map/lifecycle-evidence'
import type { MapPageData } from '@/lib/csat/map/load'
import { asIsMap, type AxisProxyState } from '@/lib/csat/map/v4/as-is'
import type { V4View } from '@/lib/csat/map/v4/compose'
import { DOMAINS, type Domain } from '@/lib/csat/map/v4/definition'
import { allTaskPlans, workspacePlan, type PlanActivity } from '@/lib/csat/map/v4/plan'
import { toBeMap, type ConfirmLink } from '@/lib/csat/map/v4/to-be'
import { planWorkspaces } from '@/lib/csat/map/v4/workspace'
import type { ExposureLedger, FqReader } from '@/lib/csat/map/v62/assessment-exposure'
import { canonicalDemand } from '@/lib/csat/map/v62/canonical-json'
import { buildDemand } from '@/lib/csat/map/v62/demand'
import { taskInspector } from '@/lib/csat/map/v62/graph'
import { ranksOf } from '@/lib/csat/map/v62/rank'
import type { ReturnNote } from '@/lib/csat/map/v62/return-ctx'
import type { SupplyLedger } from '@/lib/csat/map/v62/supply-ledger'
import type { RefItem } from '@/lib/csat/map/target'
import type { FindAttemptRow } from '@/lib/knowledge/find-outcome'

import { TaskInspector } from '../TaskInspector'

export const TASK = 'r.central_meaning' as const
export const KEY = 'claim-support'
export const VIEWER = 'fixture-viewer'
export const CHECK_ITEMS = ['2026#20', '2026#22', '2025#20', '2025#22', '2024#20', '2024#22']
export const TRANSFER_REF = '2020#24'
export const OTHER_TRANSFER_REF = '2019#24'

const day = (n: number) => new Date(Date.UTC(2026, 8, 1) + n * 86_400_000).toISOString()
const proxy = (s: AxisProxyState) => ({ state: Object.fromEntries(DOMAINS.map((d) => [d, s])) as Record<Domain, AxisProxyState>, contributions: Object.fromEntries(DOMAINS.map((d) => [d, 3])) as Record<Domain, number> })
const REF: RefItem[] = Array.from({ length: 45 }, (_, i) => ({ examId: 'REF', no: i + 1, points: i < 10 ? 3 : 2, errorRate: 0.1 + i / 100 }))
const lineRefItems = { B6: REF.slice(17, 24), A5: REF.slice(28, 34) }
const confirm: ConfirmLink[] = CHECK_ITEMS.map((t) => ({ target: t, href: `/csat/item/${t.replace('#', '-')}?check=1#principle`, label: `${t} 직접 확인` }))
const transferTargets = { [KEY]: [TRANSFER_REF, OTHER_TRANSFER_REF].map((t) => ({ target: t, href: `/csat/practice/claim-support?item=${t}`, label: '다른 글에 적용' })) }

export const att = (itemRef: string, ok: boolean, d: number, help: 'independent' | 'viewed_first' = 'independent'): FindAttemptRow => ({
  userId: VIEWER, itemRef, taskKey: KEY, phase: 'practice', isCorrect: ok, synthetic: false, helpLevel: help, afterViewedFirst: help === 'viewed_first', afterExplanation: false,
  timingUncertain: false, answeredAt: day(d), activity: 'theater', sessionId: 'fixture-session', contentHash: 'current', expectedContentHash: 'current',
})
export const act = (itemRef: string, ok: boolean, d: number, phase = 'practice'): ActivityRow => ({ itemRef, taskKey: KEY, phase, isCorrect: ok, answeredAt: day(d) })

export interface Fixture {
  goalSet: boolean
  attempts: FindAttemptRow[]
  activity: ActivityRow[]
  asOfDay: number
  saved: boolean
  planVersion?: number
  goalVersion?: number
  fq: FqReader
  /** 수요 정규 문자열을 받아 원장을 만든다(줄 열쇠가 수요에 묶여 있어서) */
  ledger?: (demandKey: string) => SupplyLedger
  returned?: readonly ReturnNote[] | null
}

export function build(f: Fixture) {
  const asIs = asIsMap({ asOf: day(f.asOfDay), sessions: [{ id: 's1', examId: 'E', examLabel: 'E', takenAt: '2026-08-20', enteredAt: '2026-08-21T00:00:00Z', raw: 70, grade: 3, diagnosable: true, examReady: true }], axisProxy: proxy('check_first'), checks: [{ taskKey: KEY, items: CHECK_ITEMS }], attempts: f.attempts })
  const toBe = f.goalSet ? toBeMap({ asIs, goal: { score: 80, set: true }, refItems: REF, lineRefItems, confirmLinks: { [KEY]: confirm } }) : null
  const plan = planWorkspaces({ asIs, toBe, confirmLinks: { [KEY]: confirm }, transferItems: { [KEY]: 2 }, transferTargets })
  const activity: PlanActivity[] = f.activity
  const plans = Object.fromEntries([plan.primary, ...plan.others].filter((w): w is NonNullable<typeof w> => !!w).map((w) => [w.id, workspacePlan(w, asIs, toBe, plan, activity)]))
  const view: V4View = { asIs, toBe, plan, plans, taskPlans: allTaskPlans(asIs, toBe, plan, activity) }
  const home = Object.keys(plans).find((id) => plans[id].core.includes(TASK)) ?? null
  // TaskInspector 와 같은 입력으로 만든 수요 정규 문자열 — 공급 원장 줄 열쇠(ledgerKey)의 세 번째 조각
  const demandKey = canonicalDemand(VIEWER, buildDemand(view, TASK, home, { workspaceId: f.saved ? 'ws-fixture-1' : null, planVersion: f.saved ? f.planVersion ?? 3 : null, goalVersion: f.saved ? f.goalVersion ?? 7 : null }))
  const ledger = f.ledger ? f.ledger(demandKey) : undefined
  const exposure: ExposureLedger = { status: 'ok', events: [], passageKeys: Object.fromEntries([...CHECK_ITEMS, TRANSFER_REF, OTHER_TRANSFER_REF].map((r) => [r, `p:${r}`])) }
  const data = {
    now: day(f.asOfDay),
    model: {},
    settings: {},
    doneTaskIds: [],
    findAttempts: f.attempts,
    lifecycleActivity: f.activity,
    practiceLinks: { find1: { confirm: confirm.map((c) => ({ ...c, taskKey: KEY })) } },
    records: [],
    v4: {
      sessions: [], proxyCovers: [], refItems: REF, transferItems: { [KEY]: 2 }, transferTargets, viewer: VIEWER,
      saved: f.saved && home
        ? { status: 'installed', goalVersionId: f.goalVersion ?? 7, byTemplate: { [home]: { workspaceId: 'ws-fixture-1', latest: { version: f.planVersion ?? 3 } } } }
        : { status: 'installed', goalVersionId: null, byTemplate: {} },
      supplyLedger: f.saved && ledger ? { 'ws-fixture-1': ledger } : {},
      assessmentExposure: exposure,
      fqReader: f.fq,
    },
  } as unknown as MapPageData
  const ins = taskInspector(TASK, view, ranksOf(view), null)
  return { view, data, ins, home, demandKey }
}

export function render(f: Fixture) {
  const b = build(f)
  const html = renderToStaticMarkup(<TaskInspector ins={b.ins} view={b.view} data={b.data} past={false} restoreWs={null} planOpen={false} onTogglePlan={() => {}} returned={f.returned ?? null} />)
  return { ...b, html }
}

const strip = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim()

/** data-testid 가 붙은 요소의 열린 태그 속성 · 안쪽 텍스트(중첩은 같은 태그 이름 깊이로 짝을 맞춘다) */
export function pick(html: string, testid: string): { attrs: Record<string, string>; text: string }[] {
  const out: { attrs: Record<string, string>; text: string }[] = []
  const re = new RegExp(`<(\\w+)([^>]*?)data-testid="${testid}"([^>]*)>`, 'g')
  for (const m of html.matchAll(re)) {
    const tag = m[1]
    const attrs: Record<string, string> = {}
    for (const a of (m[2] + m[3]).matchAll(/([\w-]+)="([^"]*)"/g)) attrs[a[1]] = a[2]
    let depth = 1
    let i = m.index! + m[0].length
    const tagRe = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'g')
    tagRe.lastIndex = i
    let end = html.length
    for (let t = tagRe.exec(html); t; t = tagRe.exec(html)) {
      depth += t[1] ? -1 : 1
      if (depth === 0) { end = t.index; break }
    }
    out.push({ attrs, text: strip(html.slice(i, end)) })
    i = end
  }
  return out
}
