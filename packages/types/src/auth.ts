// packages/types/src/auth.ts
//
// ⚠️ 수동 동기화 파일 — DB 마이그레이션과 일치 유지 필요
// ============================================================
//
// 존재 이유:
//   `supabase gen types typescript` (= `pnpm db:types`) 는 PostgreSQL `ENUM` 타입만
//   TS literal union 으로 변환합니다. 컬럼에 걸린 `CHECK (... IN (...))` 제약은
//   타입 추론에 사용되지 않아 `string` / `string | null` 로만 들어옵니다.
//
//   따라서 user_profiles 의 role / status / cefr_level 같이 CHECK 로만 정의된
//   허용값 집합은 본 파일에서 **수동 union 타입** 으로 정의하여 컴파일 시 안전성을
//   확보합니다.
//
// 동기화 대상 마이그레이션:
//   - supabase/migrations/20251101000005_user_stats_table.sql
//       (user_profiles.locale · theme — 본 파일 미반영 / Phase 2 시 통합 검토)
//   - supabase/migrations/20260504101620_add_user_profile_role_and_cefr.sql
//       (user_profiles.role · cefr_level · status — 본 파일 정의 대상)
//
// 향후 deprecation 계획:
//   PostgreSQL CHECK → ENUM 마이그레이션 시 본 파일은 deprecated 됩니다
//   (database.ts 가 자동으로 union 생성하므로 수동 정의 불필요).
// ============================================================

// ────────────────────────────────────────────────────────────
// UserRole — user_profiles.role
// ────────────────────────────────────────────────────────────
/**
 * 사용자 권한 식별자.
 *
 * - `user`    : 일반 사용자 (기본값) — 자기 학습 데이터만 접근
 * - `admin`   : `/admin/*` 전체 접근 권한 (사용자/콘텐츠/단어장/리포트/결제 관리)
 * - `curator` : `shared_word_sets`, `shared_texts` 등 공용 콘텐츠 관리 권한 (Phase 2)
 */
export const USER_ROLES = ['user', 'admin', 'curator'] as const
export type UserRole = (typeof USER_ROLES)[number]

// ────────────────────────────────────────────────────────────
// UserStatus — user_profiles.status
// ────────────────────────────────────────────────────────────
/**
 * 계정 라이프사이클 상태.
 *
 * - `active`    : 정상 사용 가능 (기본값)
 * - `suspended` : Reports 처리 결과로 일시 정지 (관리자 수동 조치)
 * - `deleted`   : 사용자 요청 또는 GDPR Soft Delete (30일 후 hard delete 예정)
 */
export const USER_STATUSES = ['active', 'suspended', 'deleted'] as const
export type UserStatus = (typeof USER_STATUSES)[number]

// ────────────────────────────────────────────────────────────
// CEFRLevel — user_profiles.cefr_level (NULL 허용)
// ────────────────────────────────────────────────────────────
/**
 * CEFR 6단계 학습자 자가 평가 레벨.
 *
 * - `A1`~`A2` : 초급 (Cold/Warm 사용자 진입점)
 * - `B1`~`B2` : 중급 (Hot 사용자 주력 영역)
 * - `C1`~`C2` : 고급 (네이티브 근접)
 * - `null`    : 미감지 — Dictation 첫 사용 시 자동 감지로 채워짐
 */
export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
export type CEFRLevel = (typeof CEFR_LEVELS)[number]

// ────────────────────────────────────────────────────────────
// 권한 가드 헬퍼
// ────────────────────────────────────────────────────────────
//
// 시그니처가 `UserRole | string` 인 이유:
//   DB 에서 오는 값은 자동 생성 타입상 `string` 이므로, 호출처에서 narrow 없이
//   직접 사용 가능하도록 union 으로 받습니다. 함수 내부에서 좁힘.

/** `role === 'admin'` — `/admin/*` 라우트 RBAC 게이트 단독 판정 */
export function isAdmin(role: UserRole | string): role is 'admin' {
  return role === 'admin'
}

/**
 * 큐레이터 또는 관리자 — admin 은 curator 권한을 자동 포함.
 * 공용 단어장(`shared_word_sets`) 편집 권한 판정 시 사용.
 */
export function isCurator(role: UserRole | string): role is 'admin' | 'curator' {
  return role === 'admin' || role === 'curator'
}

/** `/admin/*` 진입 가능 여부 — admin 전용 (curator 는 콘텐츠만, admin 콘솔 X) */
export function canAccessAdmin(role: UserRole | string): boolean {
  return isAdmin(role)
}

/** 공용 콘텐츠 관리 권한 — admin 또는 curator */
export function canManageContent(role: UserRole | string): boolean {
  return isCurator(role)
}
