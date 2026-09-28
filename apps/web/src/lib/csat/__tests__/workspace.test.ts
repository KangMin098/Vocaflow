// apps/web/src/lib/csat/__tests__/workspace.test.ts
import { describe, expect, it } from 'vitest'

import { mergeDissection, sameRecord } from '../continuity'
import { emptyDissectionRecord, type DissectionRecord, type Prediction } from '../dissect'
import {
  EMPTY_SCOPE,
  MIN_JUDGE,
  createWorkspace,
  deleteWorkspace,
  editWorkspace,
  liveWorkspaces,
  mergeWorkspaces,
  nextSet,
  poolOf,
  progressOf,
  putWorkspace,
  weakCandidates,
  weakRows,
  weekStart,
  type WorkspaceIndexItem,
} from '../workspace'

const NOW = Date.parse('2026-09-29T09:00:00Z')
const DAY = 86_400_000

const idx = (id: string, type_id: string, family: string, mapped = true): WorkspaceIndexItem => ({
  id,
  type_id,
  exam_id: id.split('#')[0],
  family,
  mapped,
  year: Number(id.replace(/^M/, '20').slice(0, 4)),
})
const INDEX = [
  idx('2026#31', 'R-BLANK', '반대 진술'),
  idx('2026#32', 'R-BLANK', '어휘 함정'),
  idx('2025#31', 'R-BLANK', '반대 진술', false),
  idx('2026#36', 'R-ORDER', '부분 사실'),
  idx('2024#36', 'R-ORDER', '반대 진술'),
]
const ws0 = (scope = EMPTY_SCOPE, now = NOW) =>
  createWorkspace({ name: '빈칸 잡기', starter: 'killer', intent: { goal: '빈칸 1등급', plan: { perWeek: 3, until: '2026-10-10' } }, scope, now, rand: 0.5 })
const rec = (patch: Partial<DissectionRecord> = {}): DissectionRecord => ({ ...emptyDissectionRecord(1), ...patch })
const pred = (item: string, step: 1 | 2 | 3, hit: boolean, at: number): Prediction => ({ item, type: 'x', step, hit, at })

describe('poolOf — 칸 안은 또는, 칸 사이는 그리고', () => {
  it('「빈칸 + 2026 회차」 는 2026 의 빈칸만이다(합집합이 아니다)', () => {
    const pool = poolOf({ ...EMPTY_SCOPE, types: ['R-BLANK'], exams: ['2026'] }, INDEX)
    expect(pool.map((p) => p.id)).toEqual(['2026#31', '2026#32'])
  })
  it('같은 칸 여러 개는 또는', () => {
    expect(poolOf({ ...EMPTY_SCOPE, types: ['R-BLANK', 'R-ORDER'] }, INDEX)).toHaveLength(5)
  })
  it('함정 조건 · 지도 있는 문항만', () => {
    expect(poolOf({ ...EMPTY_SCOPE, traps: ['반대 진술'], mappedOnly: true }, INDEX).map((p) => p.id)).toEqual(['2026#31', '2024#36'])
  })
  it('낱개 문항은 조건과 상관없이 더해진다 · 조건이 없으면 낱개만', () => {
    expect(poolOf({ ...EMPTY_SCOPE, types: ['R-ORDER'], items: ['2025#31'] }, INDEX).map((p) => p.id)).toEqual(['2025#31', '2026#36', '2024#36'])
    expect(poolOf({ ...EMPTY_SCOPE, items: ['2026#32'] }, INDEX).map((p) => p.id)).toEqual(['2026#32'])
    expect(poolOf(EMPTY_SCOPE, INDEX)).toEqual([])
  })
})

describe('mergeWorkspaces — 기기 ↔ 서버', () => {
  it('한쪽에만 있으면 살리고, 늦게 고친 쪽이 이긴다', () => {
    const a = ws0()
    const b = editWorkspace(a, { name: '바꾼 이름' }, NOW + 10)
    const other = { ...ws0(), id: 'ws-other', createdAt: NOW + 1 }
    const m = mergeWorkspaces([a], [b, other])
    expect(m.map((w) => w.id)).toEqual([a.id, 'ws-other'])
    expect(m[0].name).toBe('바꾼 이름')
    expect(mergeWorkspaces([b], [a])[0].name).toBe('바꾼 이름')
  })
  it('같은 시각의 충돌은 순서와 상관없이 같은 결과(결정적)', () => {
    const a = ws0()
    const x = { ...a, name: '가' }
    const y = { ...a, name: '나' }
    expect(mergeWorkspaces([x], [y])).toEqual(mergeWorkspaces([y], [x]))
  })
  it('묘비는 다른 기기의 옛 사본이 되살리지 못한다', () => {
    const a = ws0()
    const gone = deleteWorkspace(a, NOW + 5)
    expect(liveWorkspaces(mergeWorkspaces([gone], [a]))).toEqual([])
    expect(liveWorkspaces(mergeWorkspaces([a], [gone]))).toEqual([])
  })
  it('묘비보다 늦게 고친 사본은 살아난다(지운 뒤 다른 기기에서 다시 고친 경우)', () => {
    const a = ws0()
    const gone = deleteWorkspace(a, NOW + 5)
    const later = { ...a, name: '다시', updatedAt: NOW + 20 }
    expect(liveWorkspaces(mergeWorkspaces([gone], [later])).map((w) => w.name)).toEqual(['다시'])
  })
  it('mergeDissection 이 Workspace 를 잃지 않는다 — 늦게 쓴 기기가 다른 기기의 것을 지우지 않는다', () => {
    const w1 = ws0()
    const w2 = { ...ws0(), id: 'ws-2' }
    const local = rec({ updatedAt: NOW + 100, workspaces: [w1] })
    const server = rec({ updatedAt: NOW, workspaces: [w2] })
    expect(mergeDissection(local, server).workspaces?.map((w) => w.id).sort()).toEqual([w1.id, 'ws-2'].sort())
    expect(sameRecord(local, mergeDissection(local, server))).toBe(false)
  })
  it('Workspace 가 없는 옛 기록끼리는 칸을 만들지 않는다(기존 병합 결과 그대로)', () => {
    expect(mergeDissection(rec(), rec()).workspaces).toBeUndefined()
  })
})

describe('progressOf — 기존 학습 포함 vs 만든 뒤 · 계획', () => {
  it('만들기 전에 연 문항은 touched 에만 든다', () => {
    const ws = ws0({ ...EMPTY_SCOPE, types: ['R-BLANK'] })
    const r = rec({ views: [{ id: '2026#31', at: NOW - 3 * DAY }], completed: [{ id: '2026#32', at: NOW + DAY }] })
    const p = progressOf(ws, poolOf(ws.scope, INDEX), r, NOW + 2 * DAY)
    expect(p).toMatchObject({ pool: 3, touched: 2, touchedSince: 1, setsThisWeek: 1, perWeek: 3 })
    // 10-01 09:00 → 10-10 끝까지 = 오늘을 넣어 10일
    expect(p.daysLeft).toBe(10)
  })
  it('주의 시작은 월요일 0시', () => {
    const mon = Date.parse('2026-09-28T00:00:00Z')
    expect(weekStart(NOW)).toBe(mon)
    expect(weekStart(mon)).toBe(mon)
  })
})

describe('weakRows — 표본이 적으면 단정하지 않는다', () => {
  const pool = INDEX
  it(`${MIN_JUDGE}개 미만이면 insufficient`, () => {
    const r = rec({ predictions: [pred('2026#31', 1, false, 1), pred('2026#32', 1, false, 2)] })
    expect(weakRows(pool, r)[0]).toMatchObject({ key: 'R-BLANK', axis: 'type', step: 1, n: 2, verdict: 'insufficient' })
    expect(weakCandidates(pool, r)).toEqual([])
  })
  it('앞 창 5 · 최근 창 5 가 차야 방향을 말한다 — 2개 이상 차이일 때만', () => {
    const before = [0, 1, 2, 3, 4].map((i) => pred('2026#31', 1, i === 0, 10 + i))
    const recent = [0, 1, 2, 3, 4].map((i) => pred('2026#32', 1, i < 4, 20 + i))
    const row = weakRows(pool, rec({ predictions: [...before, ...recent] }))[0]
    expect(row).toMatchObject({ n: 10, before: { n: 5, hits: 1 }, recent: { n: 5, hits: 4 }, verdict: 'up' })
  })
  it('함정 축은 2수(오답 계열)를 본다 · 풀 밖 예측은 세지 않는다', () => {
    const r = rec({ predictions: [pred('2026#36', 2, false, 1), pred('9999#1', 2, false, 2), pred('2026#36', 1, true, 3)] })
    const rows = weakRows(pool, r)
    expect(rows.find((x) => x.axis === 'trap')).toMatchObject({ key: '부분 사실', n: 1 })
    expect(rows.reduce((a, x) => a + x.n, 0)).toBe(2)
  })
  it('약점 후보는 표본을 채우고 적중이 절반 미만인 것만', () => {
    const miss = Array.from({ length: MIN_JUDGE }, (_, i) => pred('2026#36', 1, i === 0, i))
    expect(weakCandidates(pool, rec({ predictions: miss })).map((x) => x.key)).toEqual(['R-ORDER'])
  })
})

describe('nextSet — 결정적', () => {
  it('안 연 문항부터, 같은 순위는 id 순', () => {
    const r = rec({ views: [{ id: '2026#31', at: 5 }] })
    const set = nextSet(INDEX, r)
    expect(set).toEqual(['2024#36', '2025#31', '2026#32'])
    expect(nextSet(INDEX, r)).toEqual(set)
  })
})

describe('putWorkspace · createWorkspace', () => {
  it('이름 · 목표를 자르고 id 를 결정적으로 만든다', () => {
    const w = createWorkspace({ name: '  ', starter: 'start', intent: { goal: 'x'.repeat(200) }, scope: EMPTY_SCOPE, now: NOW, rand: 0.25 })
    expect(w.name).toBe('이름 없는 Workspace')
    expect(w.intent.goal).toHaveLength(120)
    expect(w.id).toBe(createWorkspace({ name: 'a', starter: 'start', intent: { goal: '' }, scope: EMPTY_SCOPE, now: NOW, rand: 0.25 }).id)
    const r = putWorkspace(putWorkspace(rec(), w), editWorkspace(w, { name: '새' }, NOW))
    expect(r.workspaces).toHaveLength(1)
    expect(r.workspaces?.[0].name).toBe('새')
  })
})
