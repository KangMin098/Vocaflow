// apps/web/src/app/api/__tests__/route-guards.test.ts
//
// **라우트 핸들러가 RSC 전용 가드를 부르면, 실패가 JSON 이 아니라 HTML 로 돌아온다.**
//
// `lib/auth/require-admin.ts` 의 `requireAdmin()` 은 `next/navigation` 의 `redirect()` 로
// 미통과를 처리한다. RSC 에서는 그것이 옳지만, **라우트 핸들러 안에서는 307 응답**이 된다.
// 그래서 세션이 만료된 관리자가 Admin 화면에서 버튼을 누르면:
//
//   fetch('/api/admin/...') → 307 → /login (HTML) → res.json() → SyntaxError:
//   "Unexpected token '<', "<!DOCTYPE "... is not valid JSON"
//
// 화면은 "로그인이 만료됐습니다" 대신 정체불명의 파싱 오류를 띄운다. 실제로 API 79개 중
// **20개**가 이 상태였다(acp/* · admin/articles/* · admin/library/* · ctp/* · lcp/dev-*).
//
// 정본은 `lib/auth/require-admin-api.ts` 의 `requireAdminApi()` — 미통과 시
// 401/403 **JSON** 을 돌려주므로 클라이언트가 그대로 읽어 사람이 읽을 문구로 보여줄 수 있다.
//
// 이 테스트가 고정하는 것 두 가지:
//   1. 라우트 핸들러에서 RSC `requireAdmin` 를 import 하는 파일이 **0개**
//   2. 아래 PUBLIC 목록에 없는 라우트는 `requireAdminApi` 또는 **명시적 토큰 가드**를 가진다
//
// 새 공개 라우트를 열려면 PUBLIC 에 **이유와 함께** 한 줄 적어야 통과한다 — 목록을 늘리는
// 것 자체가 나쁘지는 않지만, 늘릴 때 한 번 더 생각하게 만드는 것이 목적이다.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

import { describe, expect, it } from 'vitest'

const API_DIR = join(process.cwd(), 'src', 'app', 'api')

/**
 * 인증 없이(또는 admin 아닌 자체 인증으로) 열어 둔 라우트 — 이유를 **여기 적어야** 통과한다.
 * 키는 `src/app/api/` 기준 상대 경로(디렉터리), POSIX 구분자.
 */
const PUBLIC: ReadonlyArray<{ route: string; why: string }> = [
  { route: 'analytics/event', why: '계측 수집 — 비로그인 방문자의 랜딩 이벤트를 받아야 한다' },
  { route: 'auth/callback', why: 'OAuth 콜백 — 로그인이 성립하기 전에 불린다' },
  { route: 'comics/pd/[slug]/info', why: '공개 만화 상세 정보 (비로그인 미리보기)' },
  { route: 'fit', why: '공개 진단 — 가치 확인 앞에 로그인을 두지 않는다 (CLAUDE.md D1)' },
  { route: 'lcp/process', why: 'pg_cron 워커 경로 — X-LCP-Token 으로만 연다' },
  {
    route: 'srs/flush',
    why:
      '학습자 beacon 경로(pagehide) — admin 이 아니라 본인 세션이다. 인증은 본체인 ' +
      'lib/srs/flush-actions.ts 가 쿠키로 한다 (두 곳에서 하면 반드시 갈라진다)',
  },
  { route: 'wordvault/facets', why: '학습자 본인 데이터 — 라우트 안에서 auth.getUser() 로 본다' },
]

const PUBLIC_ROUTES = new Set(PUBLIC.map((p) => p.route))

/** `src/app/api` 아래 모든 route.ts 를 상대 경로(POSIX)로 수집. */
function collectRoutes(dir: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__') continue
      found.push(...collectRoutes(full))
    } else if (entry === 'route.ts' || entry === 'route.tsx') {
      found.push(relative(API_DIR, full).split(sep).join('/'))
    }
  }
  return found.sort()
}

const ROUTE_FILES = collectRoutes(API_DIR)

/** 'acp/enqueue/route.ts' → 'acp/enqueue' */
function routeKey(file: string): string {
  return file.replace(/\/route\.tsx?$/, '')
}

/** 주석을 걷어낸 소스 — 주석 속 'requireAdmin' 언급이 오탐이 되지 않게. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

describe('API 라우트 가드', () => {
  it('라우트 파일을 실제로 찾았다 (스캐너가 빈손이면 이 테스트는 아무것도 지키지 않는다)', () => {
    expect(ROUTE_FILES.length).toBeGreaterThan(50)
  })

  it('RSC 전용 requireAdmin 을 import 하는 라우트가 없다', () => {
    const offenders = ROUTE_FILES.filter((file) => {
      const src = readFileSync(join(API_DIR, file), 'utf8')
      return /from\s+['"]@\/lib\/auth\/require-admin['"]/.test(src)
    })

    expect(
      offenders,
      `라우트 핸들러에서 redirect() 가드를 쓰면 401 대신 /login HTML 이 돌아가 res.json() 이 깨진다.\n` +
        `requireAdminApi() 로 바꿀 것:\n  ${offenders.join('\n  ')}`,
    ).toEqual([])
  })

  it('공개 허용 목록에 없는 라우트는 requireAdminApi 또는 명시적 토큰 가드를 가진다', () => {
    const unguarded = ROUTE_FILES.filter((file) => {
      const key = routeKey(file)
      if (PUBLIC_ROUTES.has(key)) return false
      const src = stripComments(readFileSync(join(API_DIR, file), 'utf8'))
      const hasAdminGuard = /requireAdminApi\s*\(/.test(src)
      const hasTokenGuard =
        /headers\.get\(\s*['"][Xx]-[\w-]*[Tt]oken['"]\s*\)/.test(src) ||
        /headers\.get\(\s*['"]authorization['"]\s*\)/i.test(src)
      return !hasAdminGuard && !hasTokenGuard
    })

    expect(
      unguarded,
      `가드가 없는 라우트다. requireAdminApi() 를 넣거나, 공개가 맞다면 PUBLIC 에 이유와 함께 등록할 것:\n  ` +
        unguarded.join('\n  '),
    ).toEqual([])
  })

  it('허용 목록은 실제로 존재하는 라우트만 가리킨다 (낡은 예외는 조용히 구멍을 남긴다)', () => {
    const keys = new Set(ROUTE_FILES.map(routeKey))
    const stale = PUBLIC.map((p) => p.route).filter((route) => !keys.has(route))
    expect(stale, `PUBLIC 에 있으나 파일이 없다 — 지울 것:\n  ${stale.join('\n  ')}`).toEqual([])
  })

  it('허용 목록의 모든 항목에 이유가 적혀 있다', () => {
    const missing = PUBLIC.filter((p) => p.why.trim().length < 10).map((p) => p.route)
    expect(missing).toEqual([])
  })
})
