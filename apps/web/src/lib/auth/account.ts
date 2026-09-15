// apps/web/src/lib/auth/account.ts
//
// 계정 역할·상태 판정 단일 소스.
//
// 왜 필요했나 (v06.140 실측):
//   1) 역할 기준이 층마다 달랐다 — middleware 는 role==='admin' 만 통과시키는데
//      requireAdmin/requireAdminApi 는 'curator' 도 허용했다. 미들웨어가 먼저 돌기
//      때문에 **curator 는 어떤 /admin 화면에도 진입할 수 없었다** (역할이 사실상 죽어 있었다).
//   2) user_profiles.status ('active'|'suspended'|'deleted') 를 검사하는 코드가
//      어디에도 없었다 — 정지시켜도 그대로 로그인하고 전 기능을 썼다.

import type { AdminRole } from './types'

export type AccountStatus = 'active' | 'suspended' | 'deleted'

/** /admin 콘솔에 들어갈 수 있는 역할. 3층 가드(middleware·RSC·API)가 모두 이 목록을 쓴다. */
export const ADMIN_CONSOLE_ROLES: readonly AdminRole[] = ['admin', 'curator']

/** 콘솔 진입 가능 역할인가. */
export function canAccessAdminConsole(role: string | null | undefined): role is AdminRole {
  return role === 'admin' || role === 'curator'
}

/** `admin` 전용(역할 부여·정지 등 상위 권한) 인가 — curator 는 제외. */
export function isFullAdmin(role: string | null | undefined): boolean {
  return role === 'admin'
}

/**
 * 서비스를 이용할 수 있는 계정 상태인가.
 * status 가 없으면(프로필 미생성 직후 등) 막지 않는다 — 신규 가입을 잠그면 안 되므로.
 */
export function isUsableAccount(status: string | null | undefined): boolean {
  return status !== 'suspended' && status !== 'deleted'
}

/** 차단된 계정을 로그인 화면으로 보낼 때 붙일 사유 코드. */
export function blockedReasonCode(status: string | null | undefined): 'suspended' | 'deleted' | null {
  if (status === 'suspended') return 'suspended'
  if (status === 'deleted') return 'deleted'
  return null
}
