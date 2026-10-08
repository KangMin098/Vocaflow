// apps/web/src/lib/admin/__tests__/retention-classification.test.ts
//
// 조회부 `fetchRetention` 이 계정 분류를 **계산 전에** 적용하는가(VG-L3-D1-02).
// 내부·미분류 계정의 학습은 리텐션 분자·분모 어디에도 들어가면 안 된다.
// DB 는 모의 클라이언트 — 이 테스트는 DB 를 읽거나 쓰지 않는다.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const ADMIN = '11111111-1111-4111-8111-111111111111'
const DEV = '22222222-2222-4222-8222-222222222222'
const EXT = '33333333-3333-4333-8333-333333333333'
const QA = '44444444-4444-4444-8444-444444444444'

type Row = Record<string, unknown>
let tables: Record<string, Row[]> = {}
let users: Array<{ id: string; created_at: string; email: string }> = []
let failProfiles = false

// 모의 DB: 활동 표는 range 페이지, user_profiles 는 `.in('role', …).limit(n)` 필터 조회(T-0007)를 흉내 낸다.
// user_profiles 를 range(OFFSET)로 훑으면 이 모의는 실패를 돌려준다 — 페이징 회귀를 잡는다.
let profileRangeCalls = 0
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    auth: { admin: { listUsers: async () => ({ data: { users }, error: null }) } },
    from: (table: string) => {
      let roles: string[] | null = null
      const q = {
        in: (col: string, vals: string[]) => {
          if (col === 'role') roles = vals
          return q
        },
        limit: async (n: number) => {
          if (table === 'user_profiles' && failProfiles) return { data: null, error: { message: 'denied' } }
          const rows = (tables[table] ?? []).filter((r) => !roles || roles.includes(String(r.role)))
          return { data: rows.slice(0, n), error: null }
        },
        range: async (lo: number, hi: number) => {
          if (table === 'user_profiles') {
            profileRangeCalls += 1
            return { data: null, error: { message: 'user_profiles 를 OFFSET 페이지로 읽지 않는다' } }
          }
          return { data: (tables[table] ?? []).slice(lo, hi + 1), error: null }
        },
      }
      return { select: () => q }
    },
  }),
}))

import { fetchRetention } from '../retention'

beforeEach(() => {
  failProfiles = false
  users = [
    { id: ADMIN, created_at: '2026-01-01T00:00:00Z', email: 'owner@personal-mail.com' },
    { id: DEV, created_at: '2026-01-01T00:00:00Z', email: 'dev@vocaflow.dev' },
    { id: EXT, created_at: '2026-01-01T00:00:00Z', email: 'student@gmail.com' },
    { id: QA, created_at: '2026-01-01T00:00:00Z', email: 'qa@example.com' },
  ]
  tables = {
    user_profiles: [
      { user_id: ADMIN, role: 'admin' },
      { user_id: DEV, role: 'user' },
      { user_id: EXT, role: 'user' },
      { user_id: QA, role: 'user' },
    ],
    // 내부·미분류 계정은 학습을 많이 했고, 외부는 한 번만 — 섞이면 숫자가 바로 드러난다
    learning_records: [
      { user_id: ADMIN, attempted_at: '2026-01-02T00:00:00Z' },
      { user_id: DEV, attempted_at: '2026-01-02T00:00:00Z' },
      { user_id: DEV, attempted_at: '2026-01-05T00:00:00Z' },
      { user_id: QA, attempted_at: '2026-01-03T00:00:00Z' },
      { user_id: EXT, attempted_at: '2026-01-01T00:00:00Z' },
    ],
    scores: [{ user_id: DEV, created_at: '2026-01-06T00:00:00Z' }],
  }
})

describe('fetchRetention — 검증된 외부 계정만 계산한다', () => {
  it('목록 미설정: 운영자는 내부, 나머지는 미분류 → 실사용 0, 내부·미분류의 학습은 어떤 칸에도 없다', async () => {
    const r = await fetchRetention({})
    expect(r?.status).toBe('ok')
    if (r?.status !== 'ok') return
    expect(r.accounts).toEqual({ total: 4, externalVerified: 0, internal: 1, unknown: 3, unknownInternalHint: 2, conflicts: 0, registry: 'not_configured' })
    expect(r.report.signups).toBe(0)
    expect(r.report.activated).toBe(0)
    expect(r.report.eligible).toEqual({ d1: 0, d7: 0, d30: 0 })
    expect(r.report.returned).toEqual({ d1: 0, d7: 0, d30: 0 })
    expect(r.report.medianDaysToFirstLearn).toBeNull()
  })

  it('외부 목록에 오른 계정만 분모·분자에 들어간다(내부 목록·운영 역할·미분류의 재방문은 제외)', async () => {
    const r = await fetchRetention({
      VOCAFLOW_INTERNAL_ACCOUNT_IDS: `${DEV}`,
      VOCAFLOW_EXTERNAL_VERIFIED_ACCOUNT_IDS: `${EXT}`,
    })
    expect(r?.status).toBe('ok')
    if (r?.status !== 'ok') return
    expect(r.accounts).toMatchObject({ total: 4, externalVerified: 1, internal: 2, unknown: 1, unknownInternalHint: 1, registry: 'ok' })
    // EXT 는 가입 당일에만 학습 → 활성화 1, 복귀 0. DEV 의 01-02·01-05·01-06 재방문이 섞이면 returned 가 0 이 아니게 된다.
    expect(r.report.signups).toBe(1)
    expect(r.report.activated).toBe(1)
    expect(r.report.medianDaysToFirstLearn).toBe(0)
    expect(r.report.returned).toEqual({ d1: 0, d7: 0, d30: 0 })
    expect(r.report.eligible.d1).toBe(1)
  })

  it('분류 설정 오류는 DB 를 읽기 전에 「계산 불가」(0 이 아니다)', async () => {
    const r = await fetchRetention({ VOCAFLOW_INTERNAL_ACCOUNT_IDS: 'oops' })
    expect(r).toEqual({ status: 'unavailable', reason: 'registry_invalid', errors: ['내부 목록 1번째 항목이 계정 ID(UUID) 형식이 아니다'] })
  })

  it('역할을 못 읽으면 null(못 쟀음) — 운영자를 미분류로 잘못 둔 채 계속하지 않는다', async () => {
    failProfiles = true
    expect(await fetchRetention({})).toBeNull()
  })

  it('일반 프로필이 아무리 많아도 운영 역할만 필터해 읽어 운영자를 놓치지 않는다(외부 목록 충돌 → 내부) · OFFSET 페이징 없음', async () => {
    // 운영자 + 일반 5,000명. 운영자를 외부 목록에도 잘못 올렸다 — 역할을 놓치면 실사용 1로 부풀어 오른다.
    const filler = Array.from({ length: 5000 }, (_, i) => `55555555-5555-4555-8555-${String(i).padStart(12, '0')}`)
    tables.user_profiles = [...filler.map((id) => ({ user_id: id, role: 'user' })), { user_id: ADMIN, role: 'admin' }]
    users = [{ id: ADMIN, created_at: '2026-01-01T00:00:00Z', email: 'owner@personal-mail.com' }]
    profileRangeCalls = 0
    const r = await fetchRetention({ VOCAFLOW_EXTERNAL_VERIFIED_ACCOUNT_IDS: ADMIN })
    expect(r?.status).toBe('ok')
    if (r?.status !== 'ok') return
    expect(r.accounts).toMatchObject({ externalVerified: 0, internal: 1, conflicts: 1 })
    expect(r.report.signups).toBe(0)
    expect(profileRangeCalls).toBe(0)
  })

  it('운영 역할 계정이 조회 상한에 닿으면 잘렸을 수 있으므로 null(못 쟀음)', async () => {
    tables.user_profiles = Array.from({ length: 1000 }, (_, i) => ({ user_id: `66666666-6666-4666-8666-${String(i).padStart(12, '0')}`, role: 'curator' }))
    expect(await fetchRetention({})).toBeNull()
  })

  it('결과에는 계정 ID·이메일이 없다', async () => {
    const r = await fetchRetention({ VOCAFLOW_EXTERNAL_VERIFIED_ACCOUNT_IDS: EXT })
    const s = JSON.stringify(r)
    for (const id of [ADMIN, DEV, EXT, QA]) expect(s).not.toContain(id)
    expect(s).not.toMatch(/@/)
  })
})
