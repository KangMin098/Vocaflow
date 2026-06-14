// apps/web/src/lib/auth/dev-bypass.ts
// 개발 전용 admin 인증 우회 (로그인 없이 /admin 접근).
//
// ⚠️ 보안: 프로덕션에선 절대 활성화되지 않는다.
//   - NODE_ENV === 'production' 이면 무조건 null (하드 게이트)
//   - dev 에서도 DEV_ADMIN_BYPASS=1 을 명시해야만 동작 (opt-in)
//
// 활성화: apps/web/.env.local 에 추가 (이 파일은 git 추적 안 됨)
//     DEV_ADMIN_BYPASS=1
//     DEV_ADMIN_USER_ID=<admin user_profiles.user_id>   # 쓰기 액션이 기록할 실제 id
//
//   DEV_ADMIN_USER_ID 미설정 시 페이지 브라우징은 되지만, admin.id 로 INSERT 하는
//   액션(큐레이션·오디오 저장 등)은 auth.users FK 위반 가능 → 실제 admin uuid 권장.
//
// 비활성화: .env.local 에서 DEV_ADMIN_BYPASS 줄을 지우거나 0 으로.

export interface DevAdmin {
  id: string
  email: string | null
  role: 'admin'
}

/**
 * 활성 시 합성 admin 을 반환, 아니면 null.
 * middleware / requireAdmin / requireAdminApi 진입부에서 호출해 우회 분기.
 */
export function devAdminBypass(): DevAdmin | null {
  if (process.env.NODE_ENV === 'production') return null
  if (process.env.DEV_ADMIN_BYPASS !== '1') return null

  return {
    id: process.env.DEV_ADMIN_USER_ID ?? '00000000-0000-0000-0000-000000000000',
    email: process.env.DEV_ADMIN_EMAIL ?? 'dev-admin@localhost',
    role: 'admin',
  }
}
