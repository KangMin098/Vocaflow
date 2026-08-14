// apps/web/src/lib/auth/__tests__/validation.test.ts
// 인증 폼 입력 규칙 — 세 화면(login/signup/reset)이 같은 기준을 쓰는지 고정한다.

import { describe, it, expect } from 'vitest'

import {
  DISPLAY_NAME_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  encodeDisplayNameB64,
  getPasswordStrength,
  isAsciiPrintable,
  isValidEmail,
  validateDisplayName,
  validatePassword,
} from '../validation'

describe('isValidEmail', () => {
  it.each([
    'user@vocaflow.com',
    'a.b+tag@sub.domain.co.kr',
    'runtime-test-0705@vocaflow.dev',
    "o'brien@example.org",
  ])('유효: %s', (email) => {
    expect(isValidEmail(email)).toBe(true)
  })

  it.each([
    ['빈 문자열', ''],
    ['공백만', '   '],
    ['@ 없음', 'uservocaflow.com'],
    ['도메인 점 없음', 'user@localhost'],
    ['로컬파트 없음', '@vocaflow.com'],
    ['도메인 없음', 'user@'],
    ['공백 포함', 'us er@vocaflow.com'],
    ['@ 2개', 'a@b@c.com'],
  ])('무효: %s', (_label, email) => {
    expect(isValidEmail(email)).toBe(false)
  })

  it('앞뒤 공백은 다듬어 판정한다 (사용자가 복사-붙여넣기 하는 흔한 경우)', () => {
    expect(isValidEmail('  user@vocaflow.com  ')).toBe(true)
  })

  it('254자를 넘는 주소는 거부한다', () => {
    expect(isValidEmail(`${'a'.repeat(250)}@vocaflow.com`)).toBe(false)
  })

  it('null·undefined·비문자열에 던지지 않는다', () => {
    expect(isValidEmail(null)).toBe(false)
    expect(isValidEmail(undefined)).toBe(false)
    expect(isValidEmail(42 as unknown as string)).toBe(false)
  })
})

describe('validatePassword — 8자 이상 + 영문 + 숫자', () => {
  it('규칙을 만족하면 null', () => {
    expect(validatePassword('RuntimeTest1')).toBeNull()
    expect(validatePassword('abcdefg1')).toBeNull()
  })

  it('빈 값은 입력 요청 문구', () => {
    expect(validatePassword('')).toBe('비밀번호를 입력해주세요')
    expect(validatePassword(null)).toBe('비밀번호를 입력해주세요')
  })

  it('짧으면 길이 사유', () => {
    expect(validatePassword('abc1')).toBe(`${PASSWORD_MIN_LENGTH}자 이상 입력해주세요`)
  })

  it('숫자만/영문만이면 구성 사유', () => {
    expect(validatePassword('12345678')).toBe('영문과 숫자를 모두 포함해주세요')
    expect(validatePassword('abcdefgh')).toBe('영문과 숫자를 모두 포함해주세요')
  })

  it('경계값 — 정확히 8자이면서 영문+숫자면 통과', () => {
    expect(validatePassword('abcdefg1')).toBeNull()
    expect(validatePassword('abcdef1')).not.toBeNull() // 7자
  })

  it('공백을 지우지 않는다 (비밀번호의 공백은 유효 문자)', () => {
    expect(validatePassword('  ab 12  ')).toBeNull()
  })
})

describe('validateDisplayName — 2~20자', () => {
  it('정상 범위는 null', () => {
    expect(validateDisplayName('홍길동')).toBeNull()
    expect(validateDisplayName('AB')).toBeNull()
    expect(validateDisplayName('가'.repeat(DISPLAY_NAME_MAX_LENGTH))).toBeNull()
  })

  it('공백 제거 후 판정한다', () => {
    expect(validateDisplayName('  A  ')).toBe('이름은 2자 이상이어야 해요')
    expect(validateDisplayName('  홍길동  ')).toBeNull()
  })

  it('너무 짧거나 길면 사유를 준다', () => {
    expect(validateDisplayName('')).toBe('이름은 2자 이상이어야 해요')
    expect(validateDisplayName(null)).toBe('이름은 2자 이상이어야 해요')
    expect(validateDisplayName('가'.repeat(21))).toBe('이름은 20자 이하로 입력해주세요')
  })
})

describe('getPasswordStrength', () => {
  it('빈 값은 0점 + 라벨 없음', () => {
    expect(getPasswordStrength('')).toEqual({ score: 0, label: '', color: 'error' })
    expect(getPasswordStrength(null)).toEqual({ score: 0, label: '', color: 'error' })
  })

  it('점수는 0~4 를 벗어나지 않는다', () => {
    const max = getPasswordStrength('Abcdefgh1234!@#$')
    expect(max.score).toBeLessThanOrEqual(4)
    expect(max.score).toBeGreaterThanOrEqual(0)
  })

  it('복잡도가 오르면 점수도 단조 증가한다', () => {
    const seq = ['abc', 'abcdefgh', 'Abcdefgh', 'Abcdefgh1', 'Abcdefgh1234!']
    const scores = seq.map((p) => getPasswordStrength(p).score)
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1])
    }
  })

  it('라벨과 색이 짝을 이룬다', () => {
    expect(getPasswordStrength('abc').color).toBe('error')
    expect(getPasswordStrength('Abcdefgh1234!@#$').label).toBe('강함')
    expect(getPasswordStrength('Abcdefgh1234!@#$').color).toBe('success')
  })
})

describe('display_name 비-ASCII 인코딩 (헤더 ISO-8859-1 우회)', () => {
  it('ASCII 판정이 정확하다', () => {
    expect(isAsciiPrintable('Hong Gildong')).toBe(true)
    expect(isAsciiPrintable('홍길동')).toBe(false)
    expect(isAsciiPrintable('café')).toBe(false)
    expect(isAsciiPrintable('')).toBe(true)
  })

  it('base64 왕복이 UTF-8 을 보존한다 (DB 트리거가 이 값을 디코드한다)', () => {
    for (const name of ['홍길동', 'café', '김민준', 'Ω≈ç√']) {
      const b64 = encodeDisplayNameB64(name)
      // Node 쪽에서 디코드해 트리거의 convert_from(decode(...,'base64'),'UTF8') 를 모사
      expect(Buffer.from(b64, 'base64').toString('utf8')).toBe(name)
    }
  })

  it('빈 문자열도 던지지 않는다', () => {
    expect(encodeDisplayNameB64('')).toBe('')
  })
})
