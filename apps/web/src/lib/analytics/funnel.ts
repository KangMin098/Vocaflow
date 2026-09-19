// apps/web/src/lib/analytics/funnel.ts
//
// 유입 퍼널 기록 — **절대로 학습 경로를 막지 않는다.**
//
// ⚠️ 이 폴더·이 저장소에 계측이 **셋** 있다. 겹치지 않게 각자 다른 것을 맡는다.
//
// | | 무엇을 | 어떻게 |
// |---|---|---|
// | `lib/admin/retention-math.ts` | 가입·첫 학습·활동 리텐션 | 기존 테이블에서 **파생**(쓰기 0) |
// | `events.ts`+`client.ts` | `/fit` 공개 화면 5종 | PostHog(외부)·비로그인·지문 유출 차단 |
// | `funnel.ts` (이 파일) | **파생으로 못 재는 두 구간** | 자체 DB `funnel_events` |
//
// 이 파일이 맡는 둘은 어떤 테이블에도 흔적이 남지 않는다 —
// "허브에 왔는데 학급을 안 만들었다" 와 "코드를 공유했는데 아무도 안 왔다".
// 그 둘이 교사 채널이 **어디서** 끊기는지를 말해 주는 유일한 신호다.
//
// 왜 헬퍼로 감싸는가: 계측 호출이 예외를 던지면 그 화면이 죽는다. 계측은 부가 정보이지
// 기능이 아니므로, 실패는 삼키고 콘솔에만 남긴다. DB 쪽 `record_funnel_event` 도 같은 이유로
// 주체를 못 이으면 예외 대신 NULL 을 돌려준다.
//
// 왜 user_id 를 넘기지 않는가: 넘기면 클라이언트가 남의 id 를 적을 수 있다.
// `record_funnel_event` 가 `auth.uid()` 로 스스로 찍는다
// (같은 종류의 구멍을 `20260815020000_close_client_writable_gaps` 가 이미 한 번 막았다).

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * 기록 가능한 단계 — **파생으로 못 재는 둘뿐이다.**
 *
 * 나머지(가입·첫 학습·재방문·학급 개설·참여·과제)는 `lib/admin/retention-math.ts` 가
 * 기존 테이블에서 파생한다. 그 파일의 결정을 그대로 따른다 —
 * "수집기를 새로 만드는 대신 계산기를 만든다. 쓰기 부하 0, 마이그레이션 0."
 * 같은 수치를 두 곳에서 세면 어긋났을 때 어느 쪽이 맞는지 알 수 없다.
 */
export type FunnelEvent =
  /** 허브에 도달했지만 학급을 만들지 않은 사람 — 어떤 테이블에도 흔적이 없다 */
  | 'teacher_hub_view'
  /** 초대코드를 공유했지만 아무도 들어오지 않은 경우 — 복사는 클라이언트에서 끝난다 */
  | 'invite_shared'

interface RecordOptions {
  /** 화면 식별자 — 같은 단계가 여러 표면에서 일어날 때 구분한다. */
  surface?: string
  meta?: Record<string, unknown>
}

/**
 * 퍼널 이벤트 1건 기록. **실패해도 던지지 않는다.**
 * 반환값은 "기록됐는가" 뿐 — 호출부가 이 값으로 분기하면 안 된다.
 */
export async function recordFunnel(
  client: SupabaseClient,
  event: FunnelEvent,
  options: RecordOptions = {},
): Promise<boolean> {
  try {
    const { error } = await (client as unknown as {
      rpc: (fn: string, args: Record<string, unknown>) => Promise<{ error: { message: string } | null }>
    }).rpc('record_funnel_event', {
      p_event: event,
      p_surface: options.surface ?? null,
      p_meta: options.meta ?? {},
    })
    if (error) {
      console.warn(`[funnel] ${event} 기록 실패: ${error.message}`)
      return false
    }
    return true
  } catch (err) {
    // 네트워크·직렬화 등 어떤 이유로도 화면을 깨뜨리지 않는다.
    console.warn(`[funnel] ${event} 기록 예외:`, err)
    return false
  }
}
