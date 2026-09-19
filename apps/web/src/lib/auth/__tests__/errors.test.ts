// apps/web/src/lib/auth/__tests__/errors.test.ts
// Supabase 에러 → 한국어 매핑. 실측한 원본 메시지를 그대로 넣어 고정한다.

import { describe, it, expect } from 'vitest'

import {
  CALLBACK_ERROR_CODES,
  classifyCallbackError,
  classifyProviderError,
  mapAuthError,
  mapCallbackError,
  mapPasswordUpdateError,
  mapResendError,
  mapResetRequestError,
  mapSignupError,
} from '../errors'

/** 사용자에게 영어 원문이 새지 않는지 판정. */
function looksKorean(message: string): boolean {
  return /[가-힣]/.test(message)
}

describe('mapAuthError — 로그인', () => {
  it.each([
    'Invalid login credentials',
    'invalid_credentials',
    'Invalid credentials',
    'User not found',
  ])('자격증명 계열은 계정 존재를 드러내지 않는 같은 문구로 수렴: %s', (raw) => {
    expect(mapAuthError(raw)).toBe('이메일 또는 비밀번호가 일치하지 않습니다')
  })

  it('이메일 미인증을 구분한다', () => {
    expect(mapAuthError('Email not confirmed')).toContain('이메일 인증')
  })

  it('레이트리밋을 구분한다', () => {
    expect(mapAuthError('Request rate limit reached')).toContain('너무 많은 요청')
    expect(mapAuthError('Too many requests')).toContain('너무 많은 요청')
  })

  it('네트워크 실패를 구분한다', () => {
    expect(mapAuthError('Failed to fetch')).toContain('네트워크')
  })

  it('알 수 없는 메시지·null 은 안전한 폴백', () => {
    expect(mapAuthError('some unmapped supabase error')).toBe(
      '로그인 중 오류가 발생했습니다. 다시 시도해주세요',
    )
    expect(mapAuthError(null)).toBe('로그인 중 오류가 발생했습니다. 다시 시도해주세요')
    expect(mapAuthError(undefined)).toBe('로그인 중 오류가 발생했습니다. 다시 시도해주세요')
  })

  it('어떤 입력에도 영어 원문을 그대로 흘리지 않는다', () => {
    for (const raw of ['Invalid login credentials', 'boom', '', 'AnonymousProvider disabled']) {
      const out = mapAuthError(raw)
      expect(looksKorean(out), `"${raw}" 의 결과가 한국어가 아니다`).toBe(true)
      // 너무 짧은 입력은 우연히 부분 문자열이 될 수 있어 의미가 없다
      if (raw.length > 3) {
        expect(out, `원본 메시지 "${raw}" 가 그대로 노출됐다`).not.toContain(raw)
      }
    }
  })
})

describe('mapSignupError — 회원가입', () => {
  it('이미 가입된 이메일 (실측 422 "User already registered")', () => {
    expect(mapSignupError('User already registered')).toBe('이미 가입된 이메일입니다')
  })

  it('약한 비밀번호 (실측 422 "Password should be at least 6 characters.")', () => {
    // 서버 최소는 6 이지만 제품 기준(8+영문+숫자)을 안내해야 사용자가 통과할 수 있다
    const out = mapSignupError('Password should be at least 6 characters.')
    expect(out).toContain('8자 이상')
    expect(out).toContain('영문과 숫자')
  })

  it('이메일 발송 한도와 일반 레이트리밋을 구분한다', () => {
    expect(mapSignupError('email rate limit exceeded')).toContain('이메일 발송 한도')
    expect(mapSignupError('too many requests')).toContain('너무 많은 요청')
  })

  it('DB 트리거 실패를 관리자용 단서와 함께 알린다', () => {
    expect(mapSignupError('Database error saving new user')).toContain('서버 설정 오류')
  })

  it('가입 중단과 이메일 가입 비활성화를 구분한다', () => {
    expect(mapSignupError('Email signups are disabled')).toContain('이메일 가입이 비활성화')
    expect(mapSignupError('Signups not allowed for this instance')).toContain('회원가입이 일시 중단')
  })

  it('알 수 없는 메시지는 폴백 — 원문을 노출하지 않는다', () => {
    const out = mapSignupError('unexpected internal detail: table foo_bar')
    expect(out).toBe('회원가입 중 오류가 발생했습니다. 다시 시도해주세요')
    expect(out).not.toContain('foo_bar')
  })
})

describe('mapResetRequestError — 재설정 메일 발송', () => {
  it('HTTP 429 를 상태코드만으로도 잡는다', () => {
    expect(mapResetRequestError('anything', 429)).toContain('요청이 너무 잦습니다')
  })

  it('메시지로도 레이트리밋을 잡는다', () => {
    expect(mapResetRequestError('rate limit exceeded')).toContain('요청이 너무 잦습니다')
  })

  it('폴백은 한국어이며 원문을 노출하지 않는다', () => {
    const out = mapResetRequestError('smtp relay 550 blocked host mail.internal')
    expect(looksKorean(out)).toBe(true)
    expect(out).not.toContain('mail.internal')
  })
})

describe('mapPasswordUpdateError — 새 비밀번호 저장', () => {
  it('동일 비밀번호 재사용을 안내한다', () => {
    expect(mapPasswordUpdateError('New password should be different from the old password.')).toBe(
      '이전과 다른 비밀번호를 사용해주세요',
    )
  })

  it('세션 만료를 "링크 만료 → 재요청" 으로 번역한다', () => {
    // 재설정 링크로 들어와 폼을 오래 열어둔 뒤 저장하면 실제로 이 경로를 탄다
    for (const raw of ['Auth session missing!', 'JWT expired', 'invalid session']) {
      expect(mapPasswordUpdateError(raw)).toContain('재설정 링크가 만료')
    }
  })

  it('약한 비밀번호를 제품 기준으로 안내한다', () => {
    expect(mapPasswordUpdateError('Password should be at least 6 characters.')).toContain('8자 이상')
  })

  it('폴백이 한국어다', () => {
    expect(looksKorean(mapPasswordUpdateError('weird failure'))).toBe(true)
  })
})

describe('mapResendError — 인증 메일 재발송', () => {
  it('Supabase 의 "For security purposes" 쿨다운을 레이트리밋으로 처리한다', () => {
    expect(mapResendError('For security purposes, you can only request this after 51 seconds.')).toContain(
      '너무 많은 요청',
    )
  })

  it('이미 인증된 계정을 구분한다 (autoconfirm 환경에서 실제로 자주 발생)', () => {
    expect(mapResendError('Email address already confirmed')).toContain('이미 인증이 완료된 계정')
  })

  it('폴백이 한국어다', () => {
    expect(looksKorean(mapResendError('nope'))).toBe(true)
  })
})

describe('콜백 에러 코드 계약 — 라우트가 만드는 코드를 로그인 화면이 전부 읽는다', () => {
  it('선언된 모든 코드에 대해 mapCallbackError 가 문구를 준다', () => {
    for (const code of CALLBACK_ERROR_CODES) {
      const message = mapCallbackError(code)
      expect(message, `코드 ${code} 에 대응 문구가 없다`).not.toBeNull()
      expect(looksKorean(message!)).toBe(true)
    }
  })

  it('모르는 코드·null 은 배너를 띄우지 않는다', () => {
    expect(mapCallbackError('made_up_code')).toBeNull()
    expect(mapCallbackError(null)).toBeNull()
    expect(mapCallbackError(undefined)).toBeNull()
  })
})

describe('classifyCallbackError — verifyOtp/exchange 실패 분류', () => {
  it('만료를 잡는다', () => {
    expect(classifyCallbackError('Email link is invalid or has expired')).toBe('link_expired')
    expect(classifyCallbackError('Token has expired or is invalid')).toBe('link_expired')
  })

  it('이미 인증됨을 잡는다', () => {
    expect(classifyCallbackError('Email already confirmed')).toBe('already_verified')
  })

  it('분류 불가 시 지정한 폴백을 쓴다', () => {
    expect(classifyCallbackError('boom')).toBe('email_verification_failed')
    expect(classifyCallbackError('boom', 'oauth_failed')).toBe('oauth_failed')
  })

  it('반환값은 항상 선언된 코드 집합 안에 있다', () => {
    for (const raw of ['expired', 'already verified', 'random', '', null]) {
      expect(CALLBACK_ERROR_CODES).toContain(classifyCallbackError(raw))
    }
  })
})

describe('classifyProviderError — Supabase 가 URL 에 직접 실어 보내는 실패', () => {
  it('만료 링크를 link_expired 로 옮긴다 (예전엔 "잘못된 접근" 으로 오안내됐다)', () => {
    expect(
      classifyProviderError('access_denied', 'otp_expired', 'Email link is invalid or has expired'),
    ).toBe('link_expired')
  })

  it('일반 거부는 access_denied', () => {
    expect(classifyProviderError('access_denied', 'user_cancelled', null)).toBe('access_denied')
  })

  it('이미 인증됨을 잡는다', () => {
    expect(classifyProviderError('invalid_request', null, 'Email already confirmed')).toBe(
      'already_verified',
    )
  })

  it('파라미터가 없으면 null — 이 케이스가 아님을 뜻한다', () => {
    expect(classifyProviderError(null, null, null)).toBeNull()
    expect(classifyProviderError(undefined)).toBeNull()
    expect(classifyProviderError('')).toBeNull()
  })

  it('분류되면 항상 선언된 코드다', () => {
    const out = classifyProviderError('server_error', 'unexpected_failure', 'boom')
    expect(CALLBACK_ERROR_CODES).toContain(out!)
  })
})
