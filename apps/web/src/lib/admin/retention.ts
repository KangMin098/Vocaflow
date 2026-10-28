// apps/web/src/lib/admin/retention.ts
//
// 학습자 활성화·리텐션 **조회부**. 계산은 `retention-math.ts`(순수)가 소유한다.
//
// 새 테이블·새 쓰기 경로가 없다 — 기존 네 곳만 읽는다:
//   `auth.users`(가입) · `learning_records`(단어 단위) · `scores`(세션·게임 단위) · `user_profiles`(운영 역할 계정만 — 계정 분류).
// 리텐션은 **검증된 외부 학습자만**으로 계산한다 — 분류 규칙은 `account-classification.ts`(VG-L3-D1-02).
// 왜 이벤트 수집기를 만들지 않았는지는 `retention-math.ts` 머리주석 참조.
//
// ⚠️ `auth.users` 는 service-role 로만 읽힌다 — 그래서 이 모듈은 **admin 클라이언트**를 쓴다.
//    호출부는 반드시 admin 가드 뒤에 둘 것(`/admin` 은 `requireAdmin()` 이 지킨다).

import 'server-only'

import { pagedSelect } from '@/lib/supabase/paged-select'

import { createAdminClient } from '@/lib/supabase/admin'

import { parseAccountRegistry } from './account-classification'
import { EXTERNAL_IDS_ENV, fetchAccountCohort, INTERNAL_IDS_ENV } from './account-cohort'
import { computeRetention, type LearnerActivity, type RetentionResult } from './retention-math'

export type { RetentionReport, RetentionResult } from './retention-math'

export { EXTERNAL_IDS_ENV, INTERNAL_IDS_ENV, OPERATOR_FETCH_CAP } from './account-cohort'
export { rateOrNull, MIN_DENOMINATOR_FOR_RATE } from './retention-math'

const KST_MS = 9 * 3_600_000

function kstDay(iso: string): string {
  return new Date(new Date(iso).getTime() + KST_MS).toISOString().slice(0, 10)
}

function kstToday(): string {
  return new Date(Date.now() + KST_MS).toISOString().slice(0, 10)
}

/**
 * ⚠️ `react.cache` 로 감싸지 않는다.
 *
 * 호출부가 `/admin` 한 곳뿐이라 얻는 것이 없고, 감싸는 순간 이 모듈을 import 하는
 * **페이지 렌더 테스트가 `cache is not a function` 으로 통째로 죽는다**(실측).
 * 같은 폴더의 `dashboard-stats.ts` 도 `server-only` 만 쓰고 cache 는 쓰지 않는다 — 그 관례를 따른다.
 */
export async function fetchRetention(env: Record<string, string | undefined> = process.env): Promise<RetentionResult | null> {
  try {
    return await computeFromDb(env)
  } catch {
    // ⚠️ **부가 지표 하나가 콘솔 전체를 죽이지 않게 한다.**
    //    `createAdminClient()` 는 env 누락 시 throw 하고, 활동 표 조회는 권한·네트워크로 실패할 수 있다.
    //    다만 실패를 **0 으로 바꾸지는 않는다** — `null` 로 올려 보내면 화면이 "못 쟀음" 이라고 말한다.
    return null
  }
}

async function computeFromDb(env: Record<string, string | undefined>): Promise<RetentionResult | null> {
  // 분류 설정 오류는 DB 를 읽기 전에 멈춘다 — 「계산 불가 + 사유」(0 이 아니다)
  const parsed = parseAccountRegistry(env[INTERNAL_IDS_ENV], env[EXTERNAL_IDS_ENV])
  if (parsed.status === 'invalid') return { status: 'unavailable', reason: 'registry_invalid', errors: parsed.errors }
  const admin = createAdminClient()
  // 계정 cohort(가입자 전 페이지 · 운영 역할 · 분류)는 공용 조회부가 정한다 — 지표마다 다른 판정을 두지 않는다(T-0084)
  const cohort = await fetchAccountCohort(admin, env)
  if (cohort.status !== 'ok') return null

  // ⚠️ 여기 있던 `.limit(100_000)` 은 **1,000행에서 잘렸다** — PostgREST 가 그 위를
  //    안 준다(실측 2026-08-30). 페이지는 기본키 `id` 오름차순으로 고정한다(T-0008).
  const [lr, sc] = await Promise.all([
    pagedSelect<{ user_id: string | null; attempted_at: string | null }>(
      (lo, hi) => admin.from('learning_records').select('user_id, attempted_at').order('id', { ascending: true }).range(lo, hi),
      'retention learning_records',
    ),
    pagedSelect<{ user_id: string | null; created_at: string | null }>(
      (lo, hi) => admin.from('scores').select('user_id, created_at').order('id', { ascending: true }).range(lo, hi),
      'retention scores',
    ),
  ])

  // 두 출처를 합친다 — 한쪽만 보면 조용히 틀린다(받아쓰기·게임은 scores,
  // 플래시카드류는 learning_records 에 남는다).
  const byUser = new Map<string, Set<string>>()
  const add = (userId: string | null, iso: string | null) => {
    if (!userId || !iso) return
    const set = byUser.get(userId) ?? new Set<string>()
    set.add(kstDay(iso))
    byUser.set(userId, set)
  }
  for (const r of (lr ?? []) as Array<{ user_id: string | null; attempted_at: string | null }>) add(r.user_id, r.attempted_at)
  for (const r of (sc ?? []) as Array<{ user_id: string | null; created_at: string | null }>) add(r.user_id, r.created_at)

  // **검증된 외부 계정만** 리텐션 계산에 넣는다. 내부·미분류의 학습은 분모·분자 모두에서 빠진다.
  const learners: LearnerActivity[] = cohort.verifiedUsers.map((u) => ({
    userId: u.id,
    signupDay: kstDay(u.created_at),
    activeDays: [...(byUser.get(u.id) ?? [])].sort(),
  }))

  return { status: 'ok', accounts: cohort.accounts, report: computeRetention(learners, kstToday()) }
}
