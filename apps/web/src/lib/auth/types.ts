// apps/web/src/lib/auth/types.ts
// 인증 계층 공용 타입 — require-admin.ts / require-admin-api.ts / account.ts 가 공유.
// (기존엔 AdminUser·AdminRole 이 두 파일에 각각 선언돼 있어 한쪽만 고치면 어긋났다.)

/** user_profiles.role 중 관리 콘솔 진입이 허용되는 값. */
export type AdminRole = 'admin' | 'curator'

export interface AdminUser {
  /** auth.users.id */
  id: string
  /** auth.users.email — null 가능 (소셜 로그인 일부 케이스) */
  email: string | null
  /** user_profiles.role — admin 또는 curator 만 통과 */
  role: AdminRole
}
