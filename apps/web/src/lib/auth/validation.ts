// apps/web/src/lib/auth/validation.ts
//
// 인증 폼 입력 검증 — login / signup / reset-password 가 공유하는 단일 규칙.
//
// 분리 이유: isValidEmail 이 세 페이지에 각각 복사돼 있었고, 비밀번호 규칙은
// signup(8자+영문+숫자) 과 reset-password(8자) 가 서로 달랐다. 같은 계정에
// 서로 다른 기준이 적용되면 "가입은 거부됐는데 재설정으로는 통과" 같은 구멍이 난다.

/** 서버(Supabase) 최소 길이는 6 이지만, 제품 기준은 8 로 더 강하게 잡는다. */
export const PASSWORD_MIN_LENGTH = 8
export const DISPLAY_NAME_MIN_LENGTH = 2
export const DISPLAY_NAME_MAX_LENGTH = 20

/**
 * 이메일 형식 검증. 완전한 RFC 5322 파서가 아니라 오타 차단용 실용 규칙이며,
 * 최종 판정은 Supabase 가 한다.
 */
export function isValidEmail(email: string | null | undefined): boolean {
  if (typeof email !== 'string') return false
  const value = email.trim()
  if (!value || value.length > 254) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

/**
 * 비밀번호 규칙 검증 — 8자 이상 + 영문 + 숫자.
 *
 * @returns 통과 시 null, 실패 시 사용자에게 보여줄 한국어 사유
 */
export function validatePassword(password: string | null | undefined): string | null {
  if (typeof password !== 'string' || password.length === 0) return '비밀번호를 입력해주세요'
  if (password.length < PASSWORD_MIN_LENGTH) return `${PASSWORD_MIN_LENGTH}자 이상 입력해주세요`
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return '영문과 숫자를 모두 포함해주세요'
  return null
}

/**
 * 표시 이름 검증 — 공백 제거 후 2~20자.
 *
 * @returns 통과 시 null, 실패 시 사유
 */
export function validateDisplayName(name: string | null | undefined): string | null {
  const value = (name ?? '').trim()
  if (value.length < DISPLAY_NAME_MIN_LENGTH) return '이름은 2자 이상이어야 해요'
  if (value.length > DISPLAY_NAME_MAX_LENGTH) return '이름은 20자 이하로 입력해주세요'
  return null
}

export interface PasswordStrength {
  /** 0~4 */
  score: number
  label: '' | '약함' | '보통' | '좋음' | '강함'
  color: 'error' | 'warning' | 'success'
}

/**
 * 비밀번호 강도 — 길이·대소문자 혼용·숫자·기호를 가산해 0~4 로 압축한다.
 * 표시 전용이며 가입 통과 여부는 validatePassword() 가 결정한다.
 */
export function getPasswordStrength(password: string | null | undefined): PasswordStrength {
  if (typeof password !== 'string' || !password) return { score: 0, label: '', color: 'error' }

  let score = 0
  if (password.length >= PASSWORD_MIN_LENGTH) score++
  if (password.length >= 12) score++
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  score = Math.min(score, 4)

  if (score <= 1) return { score, label: '약함', color: 'error' }
  if (score === 2) return { score, label: '보통', color: 'warning' }
  if (score === 3) return { score, label: '좋음', color: 'success' }
  return { score, label: '강함', color: 'success' }
}

/**
 * 한글 등 비-ASCII 표시 이름을 base64 로 인코드한다.
 *
 * 이유: 일부 supabase-js / 미들웨어 / 쿠키 조합에서 raw_user_meta_data 의 비-ASCII 가
 * RequestInit.headers 경로로 흘러 "String contains non ISO-8859-1 code point" 로 죽는다.
 * DB 트리거 `handle_new_user()` 가 display_name_b64 를 우선 디코드한다 (실측 확인).
 */
export function encodeDisplayNameB64(name: string): string {
  const bytes = new TextEncoder().encode(name)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

/** 순수 ASCII(출력 가능) 문자열인지 — true 면 display_name 을 그대로 보내도 안전. */
export function isAsciiPrintable(value: string): boolean {
  // eslint-disable-next-line no-control-regex
  return /^[ -~]*$/.test(value)
}
