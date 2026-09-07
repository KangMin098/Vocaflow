// apps/web/tests/e2e/utils/public-routes.ts
//
// **공개 화면 목록의 단일 출처** — 파일 시스템에서 읽는다.
//
// ── 왜 (실측 2026-08-26) ────────────────────────────────────────────────
// 전수 훑기가 둘 있었지만 둘 다 **로그인한 뒤의 화면**만 봤다 —
// 학습자 `(main)` 45개, 관리자 `admin/` 33개. 그런데 이 앱의 page.tsx 는 130개이고,
// 그중 **랜딩 `/` · `(marketing)` · `(auth)` 는 어느 훑기의 분모에도 없었다.**
//
// 하필 그쪽이 가장 중요한 표면이다:
//   · `/` 는 sitemap priority 1.0 — 검색과 공유가 도착하는 유일한 정문
//   · `/fit` 은 로그인 없이 쓸 수 있는 유일한 가치 증명 화면(1차 CTA · 교사 채널의 전제)
//   · `(auth)` 4개는 **모든 가입자가 반드시 통과**한다
// 로그인한 화면이 100% 여도 정문이 깨져 있으면 아무도 거기까지 오지 못한다.
//
// ⚠️ 이 훑기는 **로그아웃 상태로** 돈다. 그게 방문자가 실제로 보는 것이다.
//    로그인 상태로 재면 `(auth)` 는 전부 리다이렉트로 튕겨 아무것도 못 잰다.

import fs from 'node:fs'
import path from 'node:path'

/** 훑지 않는 라우트 — **이유가 있는 것만.** */
export const PUBLIC_SKIP_ROUTES: Record<string, string> = {
  // robots 가 막는 개발 전용 인덱스. 방문자 동선이 아니다(다만 열리기는 해야 하므로 아래 DEV 로 따로 본다).
}

/**
 * 개발 전용 화면 — 방문자 동선은 아니지만 **깨져 있으면 안 되는** 것.
 * 분모에는 넣되 "연결" 은 묻지 않는다(여긴 목차라 링크가 전부 다른 그룹으로 나간다).
 */
export const DEV_ROUTES = new Set(['/dev', '/dev/components'])

/**
 * 로그인하면 다른 곳으로 보내는 화면. 로그아웃 훑기에서는 정상적으로 열린다.
 * (로그인 상태로 재면 전부 리다이렉트라 못 잰다 — 그래서 이 훑기는 로그아웃이다.)
 */
export const AUTH_ROUTES = new Set(['/login', '/signup', '/reset-password', '/verify-email'])

/**
 * 이 앱의 **모든** 정적 라우트 — 죽은 링크 판정의 분모.
 *
 * 공개+학습자+관리자만 모으면 `(app)`(게임 세션 `/play/*`)로 가는 링크가 "없는 화면" 으로
 * 찍힌다 — 실측 2026-08-26 에 `/about` → `/play/wordblitz` 가 그렇게 잡혔다.
 * 화면이 아니라 **분모가 빠진 것**이었다. 링크의 목적지는 그룹을 가리지 않는다.
 */
export function allStaticRoutes(): string[] {
  const appDir = path.resolve(__dirname, '../../../src/app')
  const out: string[] = []
  if (fs.existsSync(path.join(appDir, 'page.tsx'))) out.push('/')

  const walk = (dir: string, url: string) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name)
      if (!fs.statSync(full).isDirectory()) continue
      if (name.startsWith('[') || name.startsWith('_') || name === 'api') continue
      const nextUrl = name.startsWith('(') ? url : `${url}/${name}`
      if (!name.startsWith('(') && fs.existsSync(path.join(full, 'page.tsx'))) out.push(nextUrl)
      walk(full, nextUrl)
    }
  }
  walk(appDir, '')
  return [...new Set(out)].sort()
}

/**
 * 루트 + `(marketing)` + `(auth)` + `dev` 의 정적 라우트.
 *
 * `(main)`·`admin`·`(app)` 은 각자의 훑기가 본다 — 여기서 또 세면 분모가 겹친다.
 */
export function publicRoutes(): string[] {
  const appDir = path.resolve(__dirname, '../../../src/app')
  const out: string[] = []

  // 루트 랜딩
  if (fs.existsSync(path.join(appDir, 'page.tsx'))) out.push('/')

  const walk = (dir: string, url: string) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name)
      if (!fs.statSync(full).isDirectory()) continue
      if (name.startsWith('[')) continue // 동적 — 실 데이터가 필요하다(시나리오 스펙의 몫)
      if (name.startsWith('_')) continue
      if (name.startsWith('(')) {
        walk(full, url) // 라우트 그룹은 URL 에 안 들어간다
        continue
      }
      const child = `${url}/${name}`
      if (fs.existsSync(path.join(full, 'page.tsx'))) out.push(child)
      walk(full, child)
    }
  }

  for (const group of ['(marketing)', '(auth)', 'dev']) {
    const base = path.join(appDir, group)
    if (!fs.existsSync(base)) continue
    if (group === 'dev') {
      // dev 는 그룹이 아니라 실제 세그먼트다 — URL 에 들어간다.
      if (fs.existsSync(path.join(base, 'page.tsx'))) out.push('/dev')
      walk(base, '/dev')
    } else {
      walk(base, '')
    }
  }

  return [...new Set(out)].filter((r) => !(r in PUBLIC_SKIP_ROUTES)).sort()
}
