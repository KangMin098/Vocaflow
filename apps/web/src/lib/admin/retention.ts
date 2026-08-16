// apps/web/src/lib/admin/retention.ts
//
// 학습자 활성화·리텐션 **조회부**. 계산은 `retention-math.ts`(순수)가 소유한다.
//
// 새 테이블·새 쓰기 경로가 없다 — 기존 세 곳만 읽는다:
//   `auth.users`(가입) · `learning_records`(단어 단위) · `scores`(세션·게임 단위).
// 왜 이벤트 수집기를 만들지 않았는지는 `retention-math.ts` 머리주석 참조.
//
// ⚠️ `auth.users` 는 service-role 로만 읽힌다 — 그래서 이 모듈은 **admin 클라이언트**를 쓴다.
//    호출부는 반드시 admin 가드 뒤에 둘 것(`/admin` 은 `requireAdmin()` 이 지킨다).

import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'

import { computeRetention, type LearnerActivity, type RetentionReport } from './retention-math'

export type { RetentionReport } from './retention-math'
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
export async function fetchRetention(): Promise<RetentionReport | null> {
  try {
    return await computeFromDb()
  } catch {
    // ⚠️ **부가 지표 하나가 콘솔 전체를 죽이지 않게 한다.**
    //    `createAdminClient()` 는 env 누락 시 throw 하고, `auth.admin.listUsers` 는
    //    권한·네트워크로 실패할 수 있다. 감싸지 않으면 `/admin` 이 통째로 500 이 된다.
    //    다만 실패를 **0 으로 바꾸지는 않는다** — `null` 로 올려 보내면 화면이
    //    "못 쟀음" 이라고 말한다(0 과 구별 불가한 폴백은 이 리포의 지배적 결함 유형이다).
    return null
  }
}

async function computeFromDb(): Promise<RetentionReport | null> {
  const admin = createAdminClient()

  const { data: userList, error: userErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })
  if (userErr || !userList) return null

  const [{ data: lr }, { data: sc }] = await Promise.all([
    admin.from('learning_records').select('user_id, attempted_at').limit(100_000),
    admin.from('scores').select('user_id, created_at').limit(100_000),
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
  for (const r of (lr ?? []) as Array<{ user_id: string | null; attempted_at: string | null }>) {
    add(r.user_id, r.attempted_at)
  }
  for (const r of (sc ?? []) as Array<{ user_id: string | null; created_at: string | null }>) {
    add(r.user_id, r.created_at)
  }

  const learners: LearnerActivity[] = userList.users.map((u) => ({
    userId: u.id,
    signupDay: kstDay(u.created_at),
    activeDays: [...(byUser.get(u.id) ?? [])].sort(),
  }))

  return computeRetention(learners, kstToday())
}
