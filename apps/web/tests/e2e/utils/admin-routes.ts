// apps/web/tests/e2e/utils/admin-routes.ts
//
// **관리자 화면 목록의 단일 출처** — 파일 시스템에서 읽는다.
//
// ── 왜 (실측 2026-08-25) ────────────────────────────────────────────────
// 학습자 쪽에는 전수 훑기(`26-learner-sweep`)와 파일시스템 레지스트리가 있는데
// **관리자 쪽에는 둘 다 없었다.** 실측: 관리자 정적 라우트 33개 중 스펙에 한 번이라도
// 등장하는 것이 8개(24.2%)뿐이고, 나머지 **25개 화면은 어떤 테스트도 열어 본 적이 없다.**
//
// 그 상태에서 "관리자 화면은 괜찮다" 고 말할 근거가 없다 — 열리는지조차 아무도 안 봤다.
// 목록을 손으로 적으면 반드시 뒤처지므로(학습자 쪽이 이미 그 값을 치렀다) 파일에서 읽는다.
//
// ⚠️ 동적 라우트(`[id]`)는 제외한다. 실 데이터가 필요하고 그건 시나리오 스펙의 몫이다.

import fs from 'node:fs'
import path from 'node:path'

/** 훑지 않는 라우트 — **이유가 있는 것만.** 길어지면 커버리지가 아니라 면제 목록이 자란다. */
export const ADMIN_SKIP_ROUTES: Record<string, string> = {}

/**
 * 여는 것만으로 **바깥에 요청을 보내거나 비용이 드는** 화면.
 * 열되 아무 버튼도 누르지 않는다. (지금은 없다 — 생기면 여기 적는다.)
 */
export const ADMIN_NO_CLICK_ROUTES = new Set<string>([])

/**
 * `admin/` 아래 정적 관리자 라우트 전부. 정렬은 안정적이다(스냅샷·베이스라인용).
 *
 * 관리자는 route group 을 쓰지 않는다 — URL 이 곧 디렉터리다(`/admin/*`).
 */
export function adminRoutes(): string[] {
  const base = path.resolve(__dirname, '../../../src/app/admin')
  const out: string[] = []

  if (fs.existsSync(path.join(base, 'page.tsx'))) out.push('/admin')

  const walk = (dir: string, url: string) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name)
      if (!fs.statSync(full).isDirectory()) continue
      if (name.startsWith('[')) continue // 동적 — 시나리오 스펙의 몫
      if (name.startsWith('_') || name.startsWith('(')) {
        walk(full, url) // 라우트 그룹은 URL 에 안 들어간다
        continue
      }
      const child = `${url}/${name}`
      if (fs.existsSync(path.join(full, 'page.tsx'))) out.push(child)
      walk(full, child)
    }
  }

  walk(base, '/admin')
  return out.filter((r) => !(r in ADMIN_SKIP_ROUTES)).sort()
}

/**
 * **오직 다른 곳으로 보내기만 하는 화면.** 지금은 `/admin/vocab` 하나(5줄).
 *
 * 본문이 없다 — `redirect()` 한 줄이 전부다. 여기서 "본문이 있나 · 되돌아오나" 를 물으면
 * **리다이렉트가 끝나기 전 순간을 찍어** 빈 화면으로 판정한다.
 * 실측 2026-08-25: 훑기가 `/admin/vocab` 을 "본문이 거의 비었다(0자)" 로 적었는데,
 * 300ms 시점의 DOM 은 `NEXT_REDIRECT;replace;/admin/vocab/runs;307` 템플릿이었다 —
 * 화면이 아니라 **계측기가 틀린 것**이다. 목적지(`/admin/vocab/runs`)는 목록에 따로 있고
 * 거기서 재진다.
 *
 * 학습자 레지스트리(`learner-routes.ts`)가 이미 같은 함정을 겪고 같은 방법으로 풀었다 —
 * 런타임이 아니라 **소스로** 판별한다. 이 저장소는 순수 리다이렉트 껍데기에 반환형 `never`
 * 를 명시하므로 그 선언을 믿는다("JSX 가 없으면 껍데기" 로 재면 진짜 화면까지 면제된다).
 */
export function adminRedirectOnlyRoutes(): Set<string> {
  const base = path.resolve(__dirname, '../../../src/app/admin')
  const out = new Set<string>()
  for (const r of adminRoutes()) {
    const rel = r === '/admin' ? '' : r.slice('/admin/'.length)
    const file = path.join(base, rel, 'page.tsx')
    if (!fs.existsSync(file)) continue
    const src = fs.readFileSync(file, 'utf8')
    if (src.includes('redirect(') && src.includes('): never')) out.add(r)
  }
  return out
}

/**
 * 관리자 화면은 dev 우회(`DEV_ADMIN_BYPASS=1`)로 연다.
 *
 * 이 저장소의 유일한 admin 계정은 소유자 것이고 자동화가 그 비밀번호를 들고 있지 않다.
 * 우회는 `NODE_ENV==='production'` 에서 코드가 무조건 무력화하는 **개발 전용 하드 게이트**다
 * (`lib/auth/dev-bypass.ts`). 우회가 꺼져 있으면 훑기는 **건너뛴다** — 로그인 화면을
 * 33번 캡처해 놓고 "관리자 화면 통과" 라고 적는 것이 가장 나쁜 결과이기 때문이다.
 */
/**
 * **우회가 실제로 먹는가** — 플래그가 아니라 서버에 물어본다.
 *
 * ⚠️ `adminBypassEnabled()` 는 `.env.local` 의 글자만 읽는다. 그런데 그 플래그는
 * `NODE_ENV==='production'` 에서 **코드가 무조건 무력화**한다(`lib/auth/dev-bypass.ts`).
 * 그래서 프로덕션 빌드(`next start`)에 대고 돌리면 플래그는 1인데 관리자 화면은 전부
 * 로그인으로 튕기고, 스캐너는 그것을 "잴 것이 없음" 으로 넘긴다 —
 * **아무것도 안 재고 초록**이 된다.
 *
 * 실측 2026-08-26: 관리자 탭 대상 ratchet 이 프로덕션에서 **2.1초 만에 "0건"** 으로
 * 통과했다. 바닥선이 218인데 0건이면 축하할 일이 아니라 계측이 죽은 것이다.
 * 이 함수는 그 거짓 초록을 막는다 — 서버가 관리자 화면을 실제로 내주는지 확인한다.
 */
export async function adminReachable(page: import('@playwright/test').Page): Promise<boolean> {
  try {
    await page.goto('/admin', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    return !/\/login/.test(page.url())
  } catch {
    return false
  }
}

export function adminBypassEnabled(): boolean {
  // ⚠️ 2026-09-05 — **파일만 보던 것이 CI 에서 스윕을 영원히 재웠다.**
  //   CI 러너에는 `.env.local` 이 없다(시크릿을 env 로 주입한다). 그래서 이 함수가 늘 false 를
  //   돌려주고 `30-admin-sweep` 은 **한 번도 돌지 않은 채** 초록으로 넘어갔다 — 관리자 화면
  //   41개를 여는 유일한 스펙이 그것이다. 파일 존재는 "우회가 켜졌나" 의 근거 중 하나일 뿐이고,
  //   실제 게이트는 프로세스가 보는 값이다. 그래서 env 를 **먼저** 보고, 없을 때만 파일을 읽는다.
  //   (거짓 초록은 여기서 막지 않는다 — `adminReachable()` 이 서버에 직접 물어본다.)
  const fromEnv = process.env['DEV_ADMIN_BYPASS']
  if (fromEnv !== undefined) return fromEnv.trim() === '1'

  // utils → e2e → tests → apps/web. 위로 셋이다 — 둘이면 `apps/web/tests/.env.local` 을
  // 찾게 되고, 파일이 없으니 훑기가 **조용히 건너뛰어진다**(실측으로 한 번 겪었다).
  const envPath = path.resolve(__dirname, '../../../.env.local')
  if (!fs.existsSync(envPath)) return false
  const src = fs.readFileSync(envPath, 'utf8')
  return /^DEV_ADMIN_BYPASS\s*=\s*1\s*$/m.test(src)
}
