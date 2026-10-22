// apps/web/src/lib/admin/__tests__/account-cohort.test.ts
//
// T-0084 — 실사용 학습자 cohort 하나를 리텐션 밖의 지표(관리자 KPI · 교사 퍼널 · 영상 시청)가 같이 쓰는가.
//   검증된 외부 계정만 분자 · 분모에 들어간다. 내부 · 운영 역할 · 미분류(예약 도메인 포함) · 익명 · 고아 행은 빠진다.
//   읽기 실패 · 잘림 · 설정 오류 = null(못 쟀음), 끝까지 읽고 검증 0 = 실제 0. DB 는 모의 — 읽지도 쓰지도 않는다.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const EXT = '33333333-3333-4333-8333-333333333333'
const EXT2 = '55555555-5555-4555-8555-555555555555'
const ADMIN = '11111111-1111-4111-8111-111111111111'
const DEV = '22222222-2222-4222-8222-222222222222'
const QA = '44444444-4444-4444-8444-444444444444' // 예약 도메인(.test) — 미분류
const SYN = '66666666-6666-4666-8666-666666666666' // 외부처럼 보이는 합성 계정 — 목록에 없으면 미분류
const ORPHAN = '77777777-7777-4777-8777-777777777777' // auth 에 없는 활동 행

type Row = Record<string, unknown>
let users: Array<{ id: string; created_at: string; email: string }> = []
let tables: Record<string, Row[]> = {}
let fail: Set<string> = new Set()
let listUsersCalls = 0

/** PostgREST 빌더 흉내 — head count · eq · in · gt · or(쌍 커서) · order · range · limit. 키셋 페이징이 실제로 넘어가는지 본다. */
function fakeClient() {
  return {
    auth: {
      admin: {
        listUsers: async ({ page, perPage }: { page: number; perPage: number }) => {
          listUsersCalls += 1
          if (fail.has('auth')) return { data: null, error: { message: 'denied' } }
          return { data: { users: users.slice((page - 1) * perPage, page * perPage) }, error: null }
        },
      },
    },
    from(table: string) {
      const filters: Array<(r: Row) => boolean> = []
      let head = false
      const result = (rows: Row[]) => (fail.has(table) ? { data: null, error: { message: 'denied' }, count: null } : { data: rows, error: null, count: rows.length })
      const orders: string[] = []
      const cmp = (a: unknown, b: unknown) => (String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0)
      const num = (a: unknown, b: unknown) => (typeof a === 'number' && typeof b === 'number' ? a - b : cmp(a, b))
      const all = () =>
        (tables[table] ?? [])
          .filter((r) => filters.every((f) => f(r)))
          .sort((a, b) => orders.reduce((d, c) => d || num(a[c], b[c]), 0))
      const q = {
        select: (_c: string, opts?: { head?: boolean }) => {
          head = !!opts?.head
          return q
        },
        eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), q),
        in: (c: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[c])), q),
        not: () => q,
        gt: (c: string, v: unknown) => (filters.push((r) => num(r[c], v) > 0), q),
        or: (expr: string) => {
          // 'class_id.gt.X,and(class_id.eq.X,user_id.gt.Y)' 쌍 커서만
          const m = /^class_id\.gt\.([^,]+),and\(class_id\.eq\.[^,]+,user_id\.gt\.([^)]+)\)$/.exec(expr)
          if (!m) throw new Error('fake or: ' + expr)
          const [, c, u] = m
          filters.push((r) => cmp(r.class_id, c) > 0 || (r.class_id === c && cmp(r.user_id, u) > 0))
          return q
        },
        order: (c: string) => (orders.push(c), q),
        limit: async (n: number) => result(all().slice(0, n)),
        range: async (lo: number, hi: number) => result(all().slice(lo, hi + 1)),
        then: (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(head ? { ...result([]), data: null, count: fail.has(table) ? null : all().length } : result(all())).then(ok, ko),
      }
      return q
    },
    storage: { from: () => ({ list: async () => ({ data: [], error: null }) }) },
  }
}
let client = fakeClient()
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => client }))

import { cohortOf, fetchAccountCohort, OPERATOR_FETCH_CAP, verifiedOnly } from '../account-cohort'
import { getAdminDashboardStats } from '../dashboard-stats'
import { fetchTeacherFunnelGaps } from '../teacher-funnel'
import { loadVideoConsole } from '../video-console'

const REG = { VOCAFLOW_EXTERNAL_VERIFIED_ACCOUNT_IDS: `${EXT} ${EXT2}`, VOCAFLOW_INTERNAL_ACCOUNT_IDS: DEV }
const kstToday = () => new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10)

beforeEach(() => {
  client = fakeClient()
  fail = new Set()
  listUsersCalls = 0
  users = [
    { id: EXT, created_at: '2026-10-01T00:00:00Z', email: 'student@gmail.com' },
    { id: EXT2, created_at: '2026-10-02T00:00:00Z', email: 'learner@naver.com' },
    { id: ADMIN, created_at: '2026-09-01T00:00:00Z', email: 'ops@gmail.com' },
    { id: DEV, created_at: '2026-09-02T00:00:00Z', email: 'dev@gmail.com' },
    { id: QA, created_at: '2026-09-03T00:00:00Z', email: 'qa@vocaflow.test' },
    { id: SYN, created_at: '2026-09-04T00:00:00Z', email: 'synthetic-learner-01@example.org' },
  ]
  tables = { user_profiles: [{ user_id: ADMIN, role: 'admin' }, { user_id: DEV, role: 'user' }] }
})

describe('fetchAccountCohort — 판정은 account-classification 하나', () => {
  it('검증 외부만 verified · 운영 역할 · 내부 목록 · 예약 도메인 · 합성(목록 밖)은 제외 · 요약은 수만', async () => {
    const c = await fetchAccountCohort(client as never, REG)
    expect(c.status).toBe('ok')
    if (c.status !== 'ok') return
    expect([...c.verified].sort()).toEqual([EXT, EXT2].sort())
    expect(c.accounts).toMatchObject({ total: 6, externalVerified: 2, internal: 2, unknown: 2 })
    expect(JSON.stringify(c.accounts)).not.toMatch(/@|gmail|vocaflow\.test/)
  })
  it('반례 — 이메일 누락 · iso-learner.test · example.org 는 목록 없이 실사용이 되지 않는다 · 명시 목록이면 정상 포함(대조)', async () => {
    const NOMAIL = '88888888-8888-4888-8888-888888888888'
    const ISO = '99999999-9999-4999-8999-999999999999'
    users = [...users, { id: NOMAIL, created_at: '2026-10-03T00:00:00Z', email: null as never }, { id: ISO, created_at: '2026-10-03T00:00:00Z', email: 'learner@iso-learner.test' }]
    const off = await fetchAccountCohort(client as never, REG)
    expect(off.status === 'ok' && [NOMAIL, ISO, SYN].some((id) => off.verified.has(id))).toBe(false)
    expect(off.status === 'ok' && off.accounts.unknownInternalHint).toBeGreaterThanOrEqual(3) // .test · .test · example.org
    const on = await fetchAccountCohort(client as never, { VOCAFLOW_EXTERNAL_VERIFIED_ACCOUNT_IDS: `${NOMAIL} ${ISO}` })
    expect(on.status === 'ok' && [...on.verified].sort()).toEqual([NOMAIL, ISO].sort())
  })
  it('내부 목록에 있으면서 외부 목록에도 있는 운영자 → 내부(외부로 새지 않는다)', async () => {
    const c = await fetchAccountCohort(client as never, { VOCAFLOW_EXTERNAL_VERIFIED_ACCOUNT_IDS: `${EXT} ${ADMIN}` })
    expect(c.status === 'ok' && [...c.verified]).toEqual([EXT])
  })
  it('설정 미등록 = 실제 0(끝까지 읽음) · 설정 오류 = DB 를 읽기 전에 unavailable', async () => {
    const c = await fetchAccountCohort(client as never, {})
    expect(c.status === 'ok' && c.verified.size).toBe(0)
    listUsersCalls = 0
    expect(await fetchAccountCohort(client as never, { VOCAFLOW_INTERNAL_ACCOUNT_IDS: 'oops' })).toMatchObject({ status: 'unavailable', reason: 'registry_invalid' })
    expect(listUsersCalls).toBe(0)
  })
  it('가입자 2페이지 이상을 끝까지 읽는다(1,000번째 뒤의 검증 계정도 들어간다)', async () => {
    const filler = Array.from({ length: 1000 }, (_, i) => ({ id: `f${i}`, created_at: '2026-09-01T00:00:00Z', email: `u${i}@gmail.com` }))
    users = [...filler, ...users]
    const c = await fetchAccountCohort(client as never, REG)
    expect(listUsersCalls).toBe(2)
    expect(c.status === 'ok' && c.verified.has(EXT)).toBe(true)
  })
  it('읽기 실패 · 운영 역할 상한 = unavailable(0 이 아니다)', async () => {
    fail.add('auth')
    expect(await fetchAccountCohort(client as never, REG)).toMatchObject({ status: 'unavailable', reason: 'read_failed' })
    fail = new Set(['user_profiles'])
    expect(await fetchAccountCohort(client as never, REG)).toMatchObject({ status: 'unavailable', reason: 'read_failed' })
    fail = new Set()
    tables.user_profiles = Array.from({ length: OPERATOR_FETCH_CAP }, (_, i) => ({ user_id: `op${i}`, role: 'curator' }))
    expect(await fetchAccountCohort(client as never, REG)).toMatchObject({ status: 'unavailable', reason: 'read_failed' })
  })
  it('verifiedOnly — 익명(null) · 고아 · 내부 행 제외 · cohort 불가면 null', async () => {
    const c = await fetchAccountCohort(client as never, REG)
    const rows = [{ u: EXT }, { u: null }, { u: ORPHAN }, { u: ADMIN }, { u: SYN }, { u: EXT2 }]
    expect(verifiedOnly(c, rows, (r) => r.u)).toEqual([{ u: EXT }, { u: EXT2 }])
    expect(verifiedOnly({ status: 'unavailable', reason: 'read_failed' }, rows, (r) => r.u)).toBeNull()
  })
  it('cohortOf — 같은 클라이언트(한 요청)에서는 가입자 목록을 한 번만 읽는다', async () => {
    await Promise.all([cohortOf(client as never), cohortOf(client as never)])
    expect(listUsersCalls).toBe(1)
  })
})

describe('지표별 cohort 적용(T-0084)', () => {
  beforeEach(() => {
    process.env.VOCAFLOW_EXTERNAL_VERIFIED_ACCOUNT_IDS = `${EXT} ${EXT2}`
    process.env.VOCAFLOW_INTERNAL_ACCOUNT_IDS = DEV
  })

  it('관리자 KPI — 전체 계정 수는 그대로(참고) · 실사용 = 검증 외부만 · 오늘 활동도 검증 외부만', async () => {
    const today = kstToday()
    tables.daily_activity = [EXT, ADMIN, DEV, QA, SYN, ORPHAN].map((user_id) => ({ user_id, date: today })).concat([{ user_id: EXT2, date: '2026-01-01' }])
    tables.user_profiles = [...tables.user_profiles, ...[EXT, EXT2, QA, SYN].map((user_id) => ({ user_id, role: 'user' }))]
    const s = await getAdminDashboardStats(client as never)
    expect(s.learners).toEqual({ total: 6, activeToday: 6, verified: 2, verifiedActiveToday: 1 })
  })
  it('관리자 KPI — cohort 불가면 실사용 칸은 null(전체 수로 대신하지 않는다)', async () => {
    fail.add('auth')
    const s = await getAdminDashboardStats(client as never)
    expect(s.learners.verified).toBeNull()
    expect(s.learners.verifiedActiveToday).toBeNull()
  })
  it('교사 퍼널 — 교사 · 학생 모두 검증 외부만 · 1,000행 넘는 이벤트도 끝까지', async () => {
    const noise = Array.from({ length: 1200 }, (_, i) => ({ id: i + 10, user_id: SYN, event: 'teacher_hub_view' }))
    tables.funnel_events = [
      { id: 1, user_id: EXT, event: 'teacher_hub_view' },
      { id: 2, user_id: ADMIN, event: 'teacher_hub_view' },
      { id: 3, user_id: EXT, event: 'invite_shared' },
      { id: 4, user_id: DEV, event: 'invite_shared' },
      ...noise,
      { id: 5000, user_id: EXT2, event: 'teacher_hub_view' },
    ]
    tables.classes = [{ id: 'c1', teacher_id: EXT }, { id: 'c2', teacher_id: DEV }]
    tables.class_members = [{ class_id: 'c1', user_id: QA }, { class_id: 'c2', user_id: EXT2 }]
    // 학생이 미분류(QA)뿐이면 「학생이 왔다」가 아니다
    expect(await fetchTeacherFunnelGaps()).toEqual({ hubVisitors: 2, createdClass: 1, sharedInvite: 1, gotStudent: 0 })
    tables.class_members.push({ class_id: 'c1', user_id: EXT2 })
    client = fakeClient()
    expect((await fetchTeacherFunnelGaps())?.gotStudent).toBe(1)
  })
  it('교사 퍼널 — cohort 불가 · 표 읽기 실패 = null', async () => {
    tables.funnel_events = []
    fail.add('auth')
    expect(await fetchTeacherFunnelGaps()).toBeNull()
    fail = new Set(['class_members'])
    client = fakeClient()
    expect(await fetchTeacherFunnelGaps()).toBeNull()
  })
  it('영상 시청 — 검증 외부만 · 익명 · 운영 · 합성 시청 제외 · cohort 불가 = null', async () => {
    const ev = (id: number, user_id: string | null, event: string) => ({ id, user_id, event, meta: { kind: 'explainer', videoId: 'v1' } })
    tables.funnel_events = [ev(1, EXT, 'video_started'), ev(2, EXT, 'video_completed'), ev(3, null, 'video_started'), ev(4, ADMIN, 'video_started'), ev(5, SYN, 'video_started'), ev(6, EXT2, 'video_started')]
    const v = await loadVideoConsole(client as never)
    expect(v.views).toEqual({ started: { explainer: 2 }, completed: { explainer: 1 }, byId: { v1: 2 } })
    fail.add('auth')
    client = fakeClient()
    expect((await loadVideoConsole(client as never)).views).toEqual({ started: null, completed: null, byId: null })
  })
})
