// scripts/analytics/check-instrumentation.mjs
//
// **계측이 살아 있는가** — 한 명령으로 답한다.
//
// ── 왜 필요한가 (실측 2026-09-01) ───────────────────────────────────
// 공개 퍼널 이벤트 10종을 정의하고 화면에 배선했는데, `apps/web/.env.local` 의
// `NEXT_PUBLIC_POSTHOG_KEY` · `NEXT_PUBLIC_POSTHOG_HOST` 가 **둘 다 비어 있었다.**
// `lib/analytics/client.ts` 는 키가 없으면 **조용히 아무것도 하지 않는다**(의도된 동작 —
// 로컬·CI 에서 잡음을 안 내려고). 그래서 화면은 멀쩡하고 테스트도 통과하는데
// **이벤트는 한 건도 나가지 않는다.**
//
// `wired.test.ts` 는 "이벤트가 코드에서 불리는가" 를 지킨다. 그 다음 질문 —
// **"그 호출이 실제로 어딘가에 닿는가"** — 를 지키는 것이 이 스크립트다.
// 같은 파일이 2026-08-17 에 이미 한 번 물렸다(대괄호 표기로 값이 번들에 안 들어감).
//
// ── 두 경로를 각각 본다 ─────────────────────────────────────────────
//   · 공개 화면(`/fit`·랜딩·공용 단어장) → PostHog. **비로그인도 잡힌다.**
//   · 로그인 뒤 교사 퍼널 → 자체 DB `funnel_events`(`record_funnel_event`).
//     ⚠️ 이 RPC 는 `auth.uid()` 가 NULL 이면 **조용히 버린다** — 비로그인은 여기로 못 온다.
//     그래서 PostHog 가 꺼져 있으면 공개 퍼널은 대체 경로가 없다.
//
// 재실행 안전: 읽기만 한다.
// 실행: node scripts/analytics/check-instrumentation.mjs

import fs from 'node:fs'
import path from 'node:path'

const envPath = path.resolve('apps/web/.env.local')
const env = {}
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
  }
}

const posthogKey = env['NEXT_PUBLIC_POSTHOG_KEY'] ?? ''
const posthogHost = env['NEXT_PUBLIC_POSTHOG_HOST'] ?? ''
const posthogLive = posthogKey.length > 0 && posthogHost.length > 0

// 정의된 공개 이벤트 — `events.ts` 의 레지스트리에서 읽는다(손으로 옮겨 적지 않는다).
const eventsSrc = fs.readFileSync(path.resolve('apps/web/src/lib/analytics/events.ts'), 'utf8')
const registry = eventsSrc.match(/const EVENT_REGISTRY[^=]*=\s*\{([\s\S]*?)\}/)
const publicEvents = registry
  ? [...registry[1].matchAll(/^\s*([a-z_]+)\s*:/gm)].map((m) => m[1])
  : []

console.info('공개 퍼널 (PostHog)')
console.info(`  키   ${posthogKey ? `설정됨 (${posthogKey.length}자)` : '**비어 있음**'}`)
console.info(`  호스트 ${posthogHost ? `설정됨` : '**비어 있음**'}`)
console.info(`  정의된 이벤트 ${publicEvents.length}종: ${publicEvents.join(' · ')}`)
console.info(
  posthogLive ? '  → PostHog 로도 전송된다.' : '  → PostHog 로는 전송되지 않는다(키 없음).',
)
console.info('  자체 수신구 `/api/analytics/event` 는 키와 무관하게 항상 받는다 — 아래 표로 확인.')

// 자체 DB 쪽
if (env['NEXT_PUBLIC_SUPABASE_URL'] && env['SUPABASE_SERVICE_ROLE_KEY']) {
  const { createClient } = await import('@supabase/supabase-js')
  const sb = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY'], {
    auth: { persistSession: false },
  })
  const { data, error } = await sb.from('funnel_events').select('event, occurred_at')
  console.info('')
  console.info('자체 DB (funnel_events) — 공개·로그인 이벤트가 함께 쌓인다')
  if (error) {
    console.info(`  조회 실패: ${error.message}`)
  } else {
    const byEvent = new Map()
    for (const r of data) byEvent.set(r.event, (byEvent.get(r.event) ?? 0) + 1)
    if (byEvent.size === 0) console.info('  기록 0건')
    for (const [e, n] of [...byEvent].sort((a, b) => b[1] - a[1])) {
      console.info(`  ${e.padEnd(20)} ${n}`)
    }
    console.info('  · 공개 화면은 `/api/analytics/event`(서비스 롤)로 들어온다 — 익명 행 허용.')
    console.info('  · `record_funnel_event` RPC 는 여전히 비로그인을 버린다(로그인 퍼널 전용).')
    if (data.length === 0) {
      console.info('')
      console.info('⚠️ 기록이 0건이다 — 배선이 끊겼는지 확인할 것. 화면은 멀쩡해도 계측만 죽는다.')
      process.exitCode = 1
    }
  }
}

if (!posthogLive) {
  console.info('')
  console.info('PostHog 는 꺼져 있다 — **선택 사항**이다. 자체 수신구만으로 퍼널은 측정된다.')
  console.info('외부 대시보드가 필요해지면 apps/web/.env.local 에 두 값을 채운다:')
  console.info('  NEXT_PUBLIC_POSTHOG_KEY=phc_...  ·  NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com')
}
