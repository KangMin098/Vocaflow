// apps/web/src/lib/admin/account-cohort.ts
//
// T-0084 — 실사용 학습자 cohort 조회부(서버 전용). 판정 규칙은 `account-classification.ts` 하나뿐이다 —
//   여기는 그 규칙에 넣을 입력(가입자 목록 · 운영 역할)을 읽고, **검증된 외부 계정 집합**과 수 요약을 돌려준다.
//   리텐션 · 관리자 KPI · 교사 퍼널 · 영상 사용자 집계가 이 결과 하나를 다시 쓴다(지표마다 다른 판정 금지).
//
// 읽기 실패 · 목록 잘림 · 설정 오류 = `unavailable`(0 이 아니다). 끝까지 읽었고 검증 계정이 0 이면 그게 실제 0 이다.
// 새 테이블 · 새 쓰기 · 새 RPC 없음. ⚠️ `auth.users` 는 service-role 로만 읽힌다 — 호출부는 admin 가드 뒤에 둔다.

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { classifyAccount, INTERNAL_ROLES, parseAccountRegistry, summarizeAccounts, type AccountSummary } from './account-classification'

/**
 * 계정 분류 목록의 서버 전용 설정(쉼표·공백 구분 계정 UUID). 값은 서버에만 있고 화면에는 **수만** 올라간다.
 *   VOCAFLOW_INTERNAL_ACCOUNT_IDS          운영·개발·QA 계정
 *   VOCAFLOW_EXTERNAL_VERIFIED_ACCOUNT_IDS 사람이 실사용 학습자로 확인한 계정
 * 둘 다 없으면 「미설정」 — 운영 역할만 내부로 빠지고 나머지는 미분류(실사용 지표에서 제외)다.
 */
export const INTERNAL_IDS_ENV = 'VOCAFLOW_INTERNAL_ACCOUNT_IDS'
export const EXTERNAL_IDS_ENV = 'VOCAFLOW_EXTERNAL_VERIFIED_ACCOUNT_IDS'

/**
 * 운영 역할(admin·curator) 계정 ID. 역할 판정에 필요한 것은 이 집합뿐이라 **그 역할만 필터해 읽는다** —
 * 전체 프로필을 페이지로 훑지 않는다(OFFSET 페이징 예산 · `offset-paging-budget.test.ts`, T-0007).
 * 운영 계정이 상한에 닿으면 잘렸을 수 있으므로 cohort 를 포기한다(unavailable).
 */
export const OPERATOR_FETCH_CAP = 1000
const AUTH_PAGE = 1000
const AUTH_MAX_PAGES = 100

export interface CohortUser {
  id: string
  created_at: string
}

export type AccountCohort =
  | { status: 'ok'; verified: ReadonlySet<string>; verifiedUsers: CohortUser[]; accounts: AccountSummary }
  | { status: 'unavailable'; reason: 'registry_invalid'; errors: string[] }
  | { status: 'unavailable'; reason: 'read_failed' }

type Admin = SupabaseClient

const READ_FAILED = { status: 'unavailable', reason: 'read_failed' } as const

/** 검증 계정만 남긴다. cohort 를 못 정했으면 null(= 못 쟀음) */
export function verifiedOnly<T>(cohort: AccountCohort, rows: readonly T[], userOf: (r: T) => unknown): T[] | null {
  if (cohort.status !== 'ok') return null
  return rows.filter((r) => {
    const u = userOf(r)
    return typeof u === 'string' && cohort.verified.has(u)
  })
}

export async function fetchAccountCohort(admin: Admin, env: Record<string, string | undefined> = process.env): Promise<AccountCohort> {
  // 분류 설정이 잘못됐으면 DB 를 읽기 전에 멈춘다 — 「계산 불가 + 사유」
  const parsed = parseAccountRegistry(env[INTERNAL_IDS_ENV], env[EXTERNAL_IDS_ENV])
  if (parsed.status === 'invalid') return { status: 'unavailable', reason: 'registry_invalid', errors: parsed.errors }
  try {
    // `listUsers` 는 PostgREST 가 아니라 Auth API 라 `pagedSelect` 를 못 쓴다 — 직접 넘긴다.
    //   한 장(1,000)만 받으면 가입자가 그 위로 늘 때 분모가 조용히 잘린다. 상한을 넘으면 못 쟀다고 말한다.
    // email 은 **서버 안에서 도메인 힌트로만** 쓴다 — 결과에는 ID 집합과 수만 남는다.
    const users: { id: string; created_at: string; email?: string | null }[] = []
    for (let page = 1; ; page += 1) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: AUTH_PAGE })
      if (error || !data) return READ_FAILED
      users.push(...(data.users as { id: string; created_at: string; email?: string | null }[]))
      if (data.users.length < AUTH_PAGE) break
      if (page >= AUTH_MAX_PAGES) {
        console.warn('[account-cohort] 가입자 목록이 100페이지를 넘는다 — cohort 를 포기한다')
        return READ_FAILED
      }
    }

    const { data, error } = await admin.from('user_profiles').select('user_id').in('role', [...INTERNAL_ROLES]).limit(OPERATOR_FETCH_CAP)
    if (error || !data) return READ_FAILED
    // 역할을 못 다 읽은 채 계속하면 운영자가 미분류로 남아 수는 맞아 보여도 근거가 틀린다
    if (data.length >= OPERATOR_FETCH_CAP) return READ_FAILED
    const operators = new Set((data as Array<{ user_id: string }>).map((p) => p.user_id))

    const classified = users.map((u) => ({ u, c: classifyAccount({ id: u.id, role: operators.has(u.id) ? 'admin' : null, email: u.email ?? null }, parsed.registry) }))
    const verifiedUsers = classified.filter(({ c }) => c.cls === 'external_verified').map(({ u }) => ({ id: u.id, created_at: u.created_at }))
    return {
      status: 'ok',
      verified: new Set(verifiedUsers.map((u) => u.id)),
      verifiedUsers,
      accounts: summarizeAccounts(classified.map(({ c }) => c), parsed.status),
    }
  } catch {
    return READ_FAILED
  }
}

/**
 * 한 요청(= 한 admin 클라이언트) 안에서 cohort 를 **한 번만** 계산해 여러 집계가 나눠 쓴다.
 *   관리자 화면은 클라이언트 하나로 KPI · 퍼널 · 영상을 함께 읽는다 — 같은 가입자 목록을 지표마다 다시 받지 않는다.
 *   클라이언트가 사라지면 같이 사라진다(WeakMap). 기본 env 일 때만 기억한다(테스트 주입 env 는 매번 계산).
 */
const memo = new WeakMap<object, Promise<AccountCohort>>()

export function cohortOf(admin: Admin, env?: Record<string, string | undefined>): Promise<AccountCohort> {
  if (env) return fetchAccountCohort(admin, env)
  const hit = memo.get(admin)
  if (hit) return hit
  const p = fetchAccountCohort(admin)
  memo.set(admin, p)
  return p
}
