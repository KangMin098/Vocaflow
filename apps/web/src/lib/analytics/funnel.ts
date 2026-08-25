// apps/web/src/lib/analytics/funnel.ts
//
// 유입 퍼널 기록 — **절대로 학습 경로를 막지 않는다.**
//
// ⚠️ 이 폴더에 **계측이 둘** 있다. 겹치는 이벤트는 없고 계층이 다르다 — 헷갈리면 한쪽이 죽는다.
//
// | | `events.ts` + `client.ts` | `funnel.ts` (이 파일) |
// |---|---|---|
// | 어디로 | PostHog (외부) | `funnel_events` (자체 DB) |
// | 누구를 | **비로그인 공개 화면** 방문자 | 로그인 이후 · 교사 왕복 |
// | 무엇을 | `/fit` 5종(viewed·analyzed·shared·share_opened·signup_clicked) | 유입 4종 + 교사 5단계 |
// | 왜 나뉘나 | 지문이 새면 안 되므로 속성에 **자유 문자열이 하나도 없다** | 주체를 이어야 하므로 user_id·anon_id 를 쓴다 |
//
// 둘은 한 사람의 여정을 앞뒤로 나눠 맡는다: `/fit` 에서 익명으로 써 보고(→ PostHog),
// 가입한 뒤 학급을 굴리는 구간(→ 이 파일). `anon_id` 가 그 사이를 잇는 고리다.
//
// 왜 헬퍼로 감싸는가: 계측 호출이 예외를 던지면 그 화면이 죽는다. 계측은 부가 정보이지
// 기능이 아니므로, 실패는 삼키고 콘솔에만 남긴다. DB 쪽 `record_funnel_event` 도 같은 이유로
// 주체를 못 이으면 예외 대신 NULL 을 돌려준다.
//
// 왜 user_id 를 넘기지 않는가: 넘기면 클라이언트가 남의 id 를 적을 수 있다.
// `record_funnel_event` 가 `auth.uid()` 로 스스로 찍는다
// (같은 종류의 구멍을 `20260815020000_close_client_writable_gaps` 가 이미 한 번 막았다).

import type { SupabaseClient } from '@supabase/supabase-js'

/** 기록 가능한 단계 — DB CHECK 제약과 같은 목록. 한쪽만 늘리면 조용히 거부된다. */
export type FunnelEvent =
  // 학습자 유입
  | 'visit'
  | 'signup'
  | 'first_learn'
  | 'day7_return'
  // 교사 왕복 5단계 (분기 진단 산술 "교사 3,500 × 학급 30" 의 첫 단추)
  | 'teacher_hub_view'
  | 'class_created'
  | 'invite_shared'
  | 'class_joined'
  | 'assignment_sent'

interface RecordOptions {
  /** 화면 식별자 — 같은 단계가 여러 표면에서 일어날 때 구분한다. */
  surface?: string
  /** 비로그인 구간을 잇는 브라우저 식별자. 로그인 상태면 없어도 된다. */
  anonId?: string
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
      p_anon_id: options.anonId ?? null,
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
