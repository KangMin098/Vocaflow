// apps/web/src/app/api/analytics/event/route.ts
//
// **공개 퍼널 이벤트 수신구 — 외부 분석 서비스 없이 우리 DB 로 받는다.**
//
// ── 왜 필요한가 (실측 2026-09-01) ───────────────────────────────────
// 공개 이벤트 10종을 정의하고 화면에 배선했는데 **한 건도 나가지 않고 있었다.**
// `NEXT_PUBLIC_POSTHOG_KEY` 가 비어 있으면 `lib/analytics/client.ts` 는 조용히 아무것도
// 하지 않는다(의도된 동작 — 로컬·CI 잡음 방지). 그래서 화면도 멀쩡하고 테스트도 통과하는데
// 계측만 영원히 0 이다.
//
// 자체 DB 로 받는 길도 막혀 있었다 — `record_funnel_event` RPC 는 `auth.uid()` 가 NULL 이면
// **조용히 버린다.** 그런데 `/fit` 은 **비로그인 교사**를 위한 화면이고, 그게 이 제품의
// 유일한 CAC 0 경로다(`PLATFORM_AUDIT.md`). 즉 가장 중요한 퍼널이 구조적으로 못 잡혔다.
//
// 그래서 서버가 대신 쓴다. 브라우저는 이 라우트에 POST 하고, 여기서 **서비스 롤**로
// `funnel_events` 에 넣는다(RLS 에 INSERT 정책이 없어 브라우저는 직접 못 넣는다).
//
// ── 남용 방어 ───────────────────────────────────────────────────────
// 비로그인 쓰기 경로라 세 겹으로 막는다:
//   ① **닫힌 이벤트 목록** — `ALLOWED_EVENTS` 에 없으면 버린다. 이름을 지어낼 수 없다.
//   ② **속성 검사** — `isSafeProps`: 숫자·불리언·24자 이하 공백 없는 열거형만.
//      `/fit` 이 "붙여넣은 지문을 저장하지 않는다" 고 약속하므로, 지문 조각은 이 검사에
//      반드시 걸린다(길거나 공백을 포함한다).
//   ③ **토큰 버킷** — IP 당. `lib/textfit/rate-limit.ts` 를 그대로 쓴다.
//
// ── 절대 하지 않는 것 ───────────────────────────────────────────────
// · 클라이언트가 보낸 `user_id` 를 믿지 않는다 — **세션에서만** 읽는다.
//   (같은 종류의 구멍을 `20260815020000_close_client_writable_gaps` 가 이미 한 번 막았다.)
// · 실패해도 화면에 영향을 주지 않는다 — 계측은 부가 정보이지 기능이 아니다.
//   그래서 어떤 경우에도 204 를 돌려주고, 이유는 서버 로그에만 남긴다.

import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

import { ALLOWED_EVENTS, isSafeProps, type PublicEventName } from '@/lib/analytics/events'
import { TokenBucketLimiter, clientKeyFromHeaders } from '@/lib/textfit/rate-limit'
import { createClient } from '@/lib/supabase/server'

/**
 * 계측용 한도 — `/fit` 분석보다 훨씬 헐겁게 둔다. 한 사람이 서가를 훑으면 미리보기
 * 이벤트가 연달아 난다(정상 사용). 막을 대상은 스크립트 한 대가 표를 채우는 것이다.
 */
const limiter = new TokenBucketLimiter({
  capacity: 60,
  refillPerSecond: 1,
  idleTtlMs: 10 * 60_000,
  maxKeys: 5_000,
})

const ALLOWED = new Set<string>(ALLOWED_EVENTS)

/** 계측 한 건의 본문 상한 — 실제 이벤트는 수백 바이트다. 4KB 면 넉넉하고도 남는다. */
const MAX_BODY_BYTES = 4096

/** 계측은 화면을 깨뜨리지 않는다 — 어떤 이유로 버려도 같은 응답을 준다. */
const ok = () => new NextResponse(null, { status: 204 })

export async function POST(req: Request): Promise<NextResponse> {
  try {
    if (!limiter.take(clientKeyFromHeaders(req.headers), Date.now()).allowed) return ok()

    // 본문 크기 상한 — 이 라우트는 **가드가 없는 공개 쓰기 경로**이고, 통과한 `props` 는
    // service_role 로 `funnel_events.meta`(jsonb) 에 그대로 들어간다. 상한이 없으면
    // 키 하나에 수 MB 를 실어 보내 DB 를 부풀릴 수 있다. 계측 한 건은 수백 바이트면 된다.
    // (`content-length` 가 없는 청크 전송은 아래 `isSafeProps` 의 키·값 검사가 막는다.)
    const declared = Number(req.headers.get('content-length') ?? '0')
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return ok()

    const body = (await req.json()) as { name?: unknown; props?: unknown; surface?: unknown }
    const name = typeof body.name === 'string' ? body.name : ''
    if (!ALLOWED.has(name)) return ok()

    const props = body.props ?? {}
    if (!isSafeProps(props)) return ok()

    // 표면 이름도 열거형 취급 — 자유 문자열을 허용하면 URL 이 새어 들어온다.
    const surface =
      typeof body.surface === 'string' && body.surface.length <= 32 && !/\s/.test(body.surface)
        ? body.surface
        : null

    // ⚠️ 주체는 **세션에서만** 읽는다. 비로그인이면 null 이고, 그것이 이 라우트의 존재 이유다.
    let userId: string | null = null
    try {
      const supabase = await createClient()
      const { data } = await supabase.auth.getUser()
      userId = data.user?.id ?? null
    } catch {
      // 세션을 못 읽어도 익명으로 기록한다 — 분모를 잃는 것보다 낫다.
    }

    const url = process.env['NEXT_PUBLIC_SUPABASE_URL']
    const key = process.env['SUPABASE_SERVICE_ROLE_KEY']
    if (!url || !key) return ok()

    const admin = createServiceClient(url, key, { auth: { persistSession: false } })
    const { error } = await admin.from('funnel_events').insert({
      user_id: userId,
      event: name as PublicEventName,
      surface,
      meta: props as Record<string, unknown>,
    })
    if (error) console.warn('[analytics] insert 실패:', error.message)
    return ok()
  } catch (e) {
    console.warn('[analytics] 이벤트 처리 실패:', e instanceof Error ? e.message : String(e))
    return ok()
  }
}
