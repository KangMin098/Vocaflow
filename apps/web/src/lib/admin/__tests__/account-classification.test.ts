// apps/web/src/lib/admin/__tests__/account-classification.test.ts
//
// 계정 분류(VG-L3-D1-02) — 실사용 지표에 무엇이 들어가는가. 기획 REQ-20261009-001 · 승인 DL-0020 의 사례를 그대로 잰다.

import { describe, expect, it } from 'vitest'

import {
  classifyAccount,
  isInternalDomainHint,
  parseAccountRegistry,
  summarizeAccounts,
  type AccountRegistry,
} from '../account-classification'

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'
const C = '33333333-3333-4333-8333-333333333333'

function reg(internal: string[] = [], external: string[] = []): AccountRegistry {
  return { internal: new Set(internal), externalVerified: new Set(external) }
}

describe('parseAccountRegistry — 서버 설정 목록', () => {
  it('둘 다 비면 not_configured(빈 목록)', () => {
    const r = parseAccountRegistry(undefined, '  ')
    expect(r.status).toBe('not_configured')
  })

  it('쉼표·공백 구분 · 대소문자 무시', () => {
    const r = parseAccountRegistry(`${A.toUpperCase()}, ${B}`, `\n${C}`)
    expect(r.status).toBe('ok')
    if (r.status !== 'invalid') {
      expect([...r.registry.internal]).toEqual([A, B])
      expect([...r.registry.externalVerified]).toEqual([C])
    }
  })

  it('형식 오류 · 중복 · 두 목록 충돌은 invalid 이고, 오류 문구에 계정 ID 를 넣지 않는다', () => {
    const r = parseAccountRegistry(`${A},not-a-uuid,${A}`, `${A}`)
    expect(r.status).toBe('invalid')
    if (r.status === 'invalid') {
      expect(r.errors).toEqual([
        '내부 목록 2번째 항목이 계정 ID(UUID) 형식이 아니다',
        '내부 목록 3번째 항목이 중복이다',
        '내부·검증된 외부 두 목록에 같은 계정이 1개 있다',
      ])
      expect(r.errors.join(' ')).not.toContain(A)
    }
  })
})

describe('classifyAccount — 우선순위: 명시 목록 → 운영 역할(내부만) → 미분류', () => {
  it('명시적 내부 ID 는 역할과 무관하게 내부', () => {
    expect(classifyAccount({ id: A, role: 'user' }, reg([A]))).toMatchObject({ cls: 'internal', source: 'registry_internal' })
  })

  it('개인 도메인 admin 은 역할로 내부(도메인으로는 안 잡힌다)', () => {
    const c = classifyAccount({ id: A, role: 'admin', email: 'owner@personal-mail.com' }, reg())
    expect(c).toMatchObject({ cls: 'internal', source: 'role' })
  })

  it('curator 도 내부', () => {
    expect(classifyAccount({ id: A, role: 'curator' }, reg()).cls).toBe('internal')
  })

  it('검증된 외부 목록에 있는 user 만 external_verified', () => {
    expect(classifyAccount({ id: B, role: 'user' }, reg([], [B]))).toMatchObject({ cls: 'external_verified', source: 'registry_external' })
  })

  it('role=user 이고 목록에 없으면 — 내부 도메인이어도 — 미분류(도메인은 힌트만)', () => {
    const dev = classifyAccount({ id: C, role: 'user', email: 'qa@vocaflow.dev' }, reg())
    expect(dev).toMatchObject({ cls: 'unknown', internalHint: true })
    const plain = classifyAccount({ id: C, role: 'user', email: 'someone@gmail.com' }, reg())
    expect(plain).toMatchObject({ cls: 'unknown', internalHint: false })
  })

  it('외부 QA 후보(외부 도메인의 테스트 계정)도 목록에 없으면 실사용으로 세지 않는다', () => {
    expect(classifyAccount({ id: C, role: 'user', email: 'tester@outsourced-qa.io' }, reg()).cls).toBe('unknown')
  })

  it('운영 역할이 외부 목록에 오르면 내부로 판정하고 충돌로 센다(외부를 부풀리지 않는 쪽)', () => {
    expect(classifyAccount({ id: A, role: 'admin' }, reg([], [A]))).toMatchObject({ cls: 'internal', conflict: true })
  })

  it('프로필(역할)이 없으면 미분류', () => {
    expect(classifyAccount({ id: A, role: null }, reg()).cls).toBe('unknown')
  })
})

describe('isInternalDomainHint — 예약·자사 도메인', () => {
  it.each([
    ['a@example.com', true],
    ['a@sub.example.org', true],
    ['a@x.test', true],
    ['a@host.local', true],
    ['a@vocaflow.local', true],
    ['a@vocaflow.dev', true],
    ['a@qa.vocaflow.dev', true],
    ['a@gmail.com', false],
    ['a@notexample.com', false],
    ['a@vocaflow.dev.evil.com', false],
    ['no-at-sign', false],
    [null, false],
  ])('%s → %s', (email, want) => {
    expect(isInternalDomainHint(email)).toBe(want)
  })
})

describe('summarizeAccounts — 화면으로는 수만', () => {
  it('세 분류와 힌트·충돌을 센다', () => {
    const r = reg([], [B])
    const s = summarizeAccounts(
      [
        classifyAccount({ id: A, role: 'admin' }, r),
        classifyAccount({ id: B, role: 'user' }, r),
        classifyAccount({ id: C, role: 'user', email: 'x@example.com' }, r),
        classifyAccount({ id: '44444444-4444-4444-8444-444444444444', role: 'user', email: 'y@gmail.com' }, r),
      ],
      'ok',
    )
    expect(s).toEqual({ total: 4, externalVerified: 1, internal: 1, unknown: 2, unknownInternalHint: 1, conflicts: 0, registry: 'ok' })
    expect(JSON.stringify(s)).not.toMatch(/[0-9a-f]{8}-/)
  })
})
