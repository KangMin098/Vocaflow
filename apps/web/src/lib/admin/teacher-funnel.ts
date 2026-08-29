// apps/web/src/lib/admin/teacher-funnel.ts
//
// 교사 채널이 **어디서 끊기는가** — 파생으로 못 재는 두 구간.
//
// ── 왜 이 두 개만인가 ───────────────────────────────────────────────
// 가입·첫 학습·리텐션·학급 개설·참여·과제는 전부 기존 테이블에서 파생된다
// (`retention-math.ts` 의 결정: "수집기 대신 계산기". 쓰기 부하 0).
// 그런데 **일어나지 않은 일**은 파생할 수 없다:
//   · 허브까지 왔는데 학급을 만들지 않았다  → 어떤 테이블에도 행이 안 생긴다
//   · 초대코드를 공유했는데 아무도 안 왔다   → 복사는 클라이언트에서 끝난다
// 이 둘만 `funnel_events` 가 기록하고, 여기서 **파생 쪽과 맞물려** 격차로 읽는다.
//
// ── 왜 카운트가 아니라 격차인가 ─────────────────────────────────────
// "허브 방문 12" 는 아무것도 말하지 않는다. "12명이 왔고 2명이 만들었다" 가
// 채널이 어디서 끊기는지 말한다. 분자는 파생(classes·class_members), 분모는 기록(funnel_events).

import 'server-only'


import { createClient } from '@/lib/supabase/server'

export interface TeacherFunnelGaps {
  /** 허브에 도달한 사람 수 (funnel_events.teacher_hub_view 주체) */
  hubVisitors: number
  /** 그중 실제로 학급을 만든 사람 수 (classes.teacher_id 파생) */
  createdClass: number
  /** 초대코드를 공유한 사람 수 (funnel_events.invite_shared 주체) */
  sharedInvite: number
  /** 그중 실제로 학생이 들어온 사람 수 (class_members 파생) */
  gotStudent: number
}

type Row = Record<string, unknown>

/**
 * 두 구간의 분자·분모.
 *
 * 조회가 실패하면 `null` — 화면이 "0" 과 "못 불러왔다" 를 구별할 수 있어야 한다
 * (`fetchTeacherClasses` 가 같은 이유로 겪은 문제: 테이블이 사라진 동안 교사에게
 *  "개설한 클래스가 없어요" 로 보였다).
 *
 * ⚠️ **`react.cache` 로 감싸지 않는다.** 호출부가 `/admin` 한 곳뿐이라 이득이 없고,
 *    감싸는 순간 이 파일을 import 하는 **모든 vitest 스위트가 통째로 죽는다**
 *    (`cache is not a function` — node 환경에는 React 서버 런타임이 없다).
 *    실제로 `src/app/admin/__tests__/page.test.tsx` 가 그렇게 0 test 로 죽어 있었다.
 *    같은 판단으로 `lib/admin/retention.ts`·`dashboard-stats.ts` 도 감싸지 않는다
 *    (CONVENTIONS "vitest 를 깨뜨리는 것은 server-only 가 아니라 react.cache 다").
 */
export async function fetchTeacherFunnelGaps(): Promise<TeacherFunnelGaps | null> {
  const client = await createClient()
  const loose = client as unknown as {
    from: (t: string) => {
      select: (c: string) => Promise<{ data: unknown; error: unknown }>
    }
  }

  const [events, classes, members] = await Promise.all([
    loose.from('funnel_events').select('user_id, event'),
    loose.from('classes').select('id, teacher_id'),
    loose.from('class_members').select('class_id, user_id'),
  ])

  if (events.error || classes.error || members.error) {
    console.error('[teacher-funnel] 조회 실패', events.error ?? classes.error ?? members.error)
    return null
  }

  const evRows = (events.data ?? []) as Row[]
  const classRows = (classes.data ?? []) as Row[]
  const memberRows = (members.data ?? []) as Row[]

  const subjectsOf = (event: string): Set<string> =>
    new Set(
      evRows
        .filter((r) => r.event === event && typeof r.user_id === 'string')
        .map((r) => r.user_id as string),
    )

  const hubVisitorIds = subjectsOf('teacher_hub_view')
  const sharedIds = subjectsOf('invite_shared')

  // 학급을 만든 교사 (파생)
  const teacherIds = new Set(
    classRows.filter((r) => typeof r.teacher_id === 'string').map((r) => r.teacher_id as string),
  )

  // 학생이 실제로 들어온 학급 → 그 학급의 교사 (파생)
  //   본인이 자기 학급 멤버로 들어간 경우는 "학생이 왔다" 가 아니다.
  const classTeacher = new Map<string, string>()
  for (const r of classRows) {
    if (typeof r.id === 'string' && typeof r.teacher_id === 'string') {
      classTeacher.set(r.id, r.teacher_id)
    }
  }
  const teachersWithStudent = new Set<string>()
  for (const m of memberRows) {
    if (typeof m.class_id !== 'string' || typeof m.user_id !== 'string') continue
    const t = classTeacher.get(m.class_id)
    if (t && t !== m.user_id) teachersWithStudent.add(t)
  }

  const countIntersect = (a: Set<string>, b: Set<string>): number => {
    let n = 0
    for (const id of a) if (b.has(id)) n += 1
    return n
  }

  return {
    hubVisitors: hubVisitorIds.size,
    createdClass: countIntersect(hubVisitorIds, teacherIds),
    sharedInvite: sharedIds.size,
    gotStudent: countIntersect(sharedIds, teachersWithStudent),
  }
}
