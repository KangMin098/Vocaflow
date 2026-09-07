// apps/web/src/lib/auth/__tests__/account.test.ts
// 역할·상태 판정 — 3층 가드가 같은 기준을 쓰는지 고정한다.

import { describe, it, expect } from 'vitest'

import {
  ADMIN_CONSOLE_ROLES,
  blockedReasonCode,
  canAccessAdminConsole,
  isFullAdmin,
  isUsableAccount,
} from '../account'

// DB CHECK 제약 user_profiles_role_check 가 허용하는 값 전체 (실측)
const ALL_ROLES = ['user', 'admin', 'curator'] as const
// DB CHECK 제약 user_profiles_status_check 가 허용하는 값 전체 (실측)
const ALL_STATUSES = ['active', 'suspended', 'deleted'] as const

describe('canAccessAdminConsole', () => {
  it('admin 과 curator 를 통과시킨다', () => {
    expect(canAccessAdminConsole('admin')).toBe(true)
    expect(canAccessAdminConsole('curator')).toBe(true)
  })

  it('일반 사용자와 미지정을 막는다', () => {
    expect(canAccessAdminConsole('user')).toBe(false)
    expect(canAccessAdminConsole(null)).toBe(false)
    expect(canAccessAdminConsole(undefined)).toBe(false)
    expect(canAccessAdminConsole('')).toBe(false)
  })

  it('유사 문자열을 막는다 (부분 일치·대소문자 우회 차단)', () => {
    for (const raw of ['Admin', 'ADMIN', 'admin ', ' admin', 'administrator', 'curator2']) {
      expect(canAccessAdminConsole(raw), `${raw} 가 통과했다`).toBe(false)
    }
  })

  it('ADMIN_CONSOLE_ROLES 목록과 판정이 일치한다', () => {
    for (const role of ALL_ROLES) {
      expect(canAccessAdminConsole(role)).toBe(ADMIN_CONSOLE_ROLES.includes(role as never))
    }
  })
})

describe('isFullAdmin — curator 와 구분되는 상위 권한', () => {
  it('admin 만 true', () => {
    expect(isFullAdmin('admin')).toBe(true)
    expect(isFullAdmin('curator')).toBe(false)
    expect(isFullAdmin('user')).toBe(false)
    expect(isFullAdmin(null)).toBe(false)
  })
})

describe('isUsableAccount — 정지/해지 계정 차단', () => {
  it('active 는 이용 가능', () => {
    expect(isUsableAccount('active')).toBe(true)
  })

  it('suspended·deleted 는 차단', () => {
    expect(isUsableAccount('suspended')).toBe(false)
    expect(isUsableAccount('deleted')).toBe(false)
  })

  it('status 가 없으면 막지 않는다 (프로필 생성 직전의 신규 가입을 잠그면 안 된다)', () => {
    expect(isUsableAccount(null)).toBe(true)
    expect(isUsableAccount(undefined)).toBe(true)
  })

  it('DB 가 허용하는 모든 status 를 명시적으로 판정한다', () => {
    const verdicts = ALL_STATUSES.map((s) => [s, isUsableAccount(s)] as const)
    expect(verdicts).toEqual([
      ['active', true],
      ['suspended', false],
      ['deleted', false],
    ])
  })
})

describe('blockedReasonCode', () => {
  it('차단 상태마다 사유 코드를 준다', () => {
    expect(blockedReasonCode('suspended')).toBe('suspended')
    expect(blockedReasonCode('deleted')).toBe('deleted')
  })

  it('정상 상태는 null', () => {
    expect(blockedReasonCode('active')).toBeNull()
    expect(blockedReasonCode(null)).toBeNull()
  })

  it('isUsableAccount 와 서로 모순되지 않는다', () => {
    for (const status of [...ALL_STATUSES, null, undefined]) {
      expect(blockedReasonCode(status) === null).toBe(isUsableAccount(status))
    }
  })
})
