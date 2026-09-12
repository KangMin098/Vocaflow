// apps/web/src/lib/auth/__tests__/redirect.test.ts
// 로그인 후 복귀 경로 — open redirect 차단 + 파라미터 이름 통일 회귀 락.

import { describe, it, expect } from 'vitest'

import {
  DEFAULT_LANDING,
  RETURN_PARAM,
  RETURN_PARAM_ALIASES,
  loginUrlWithReturn,
  resolveReturnTo,
  safeInternalPath,
} from '../redirect'

/** 소스에 raw 제어문자를 남기지 않으려고 코드로 만든다. */
const NUL = String.fromCharCode(0)
const DEL = String.fromCharCode(127)

describe('safeInternalPath — 내부 경로만 통과', () => {
  it.each([
    '/hub',
    '/wordvault/browse',
    '/library/books/abc-123',
    '/text/1?tab=words',
    '/dashboard#today',
    '/comics/adapted/9',
  ])('내부 경로 통과: %s', (path) => {
    expect(safeInternalPath(path)).toBe(path)
  })

  it.each([
    ['빈 값', ''],
    ['공백만', '   '],
    ['상대 경로', 'hub'],
    ['protocol-relative', '//evil.com'],
    ['protocol-relative + 경로', '//evil.com/steal'],
    ['절대 URL', 'https://evil.com'],
    ['스킴 삽입', '/redir?to=https://evil.com'],
    ['백슬래시 정규화 우회', '/\\evil.com'],
    ['백슬래시 혼합', '/\\/evil.com'],
    ['개행 삽입', '/hub\n//evil.com'],
    ['탭 삽입', '/hub\t/x'],
    ['선행 공백으로 // 위장', ' //evil.com'],
    ['NUL 삽입', `/hub${NUL}evil`],
    ['DEL 삽입', `/hub${DEL}evil`],
    ['javascript 스킴', 'javascript:alert(1)'],
  ])('차단: %s', (_label, path) => {
    expect(safeInternalPath(path)).toBeNull()
  })

  it('null·undefined·비문자열을 안전하게 거부한다', () => {
    expect(safeInternalPath(null)).toBeNull()
    expect(safeInternalPath(undefined)).toBeNull()
    expect(safeInternalPath(123 as unknown as string)).toBeNull()
    expect(safeInternalPath({} as unknown as string)).toBeNull()
  })

  it('길이 상한을 넘는 경로를 거부한다', () => {
    expect(safeInternalPath(`/${'a'.repeat(3000)}`)).toBeNull()
  })

  it.each(['/login', '/signup', '/reset-password', '/verify-email', '/api', '/api/auth/callback'])(
    '인증 화면 자기참조 차단 (무한 왕복 방지): %s',
    (path) => {
      expect(safeInternalPath(path)).toBeNull()
    },
  )

  it('인증 화면 접두사와 "닮은" 정상 경로는 통과시킨다', () => {
    // '/signup' 차단이 '/signups-report' 까지 삼키면 안 된다
    expect(safeInternalPath('/loginhistory')).toBe('/loginhistory')
    expect(safeInternalPath('/signups-report')).toBe('/signups-report')
    expect(safeInternalPath('/apiary')).toBe('/apiary')
  })

  it('쿼리에 인증 경로가 들어 있어도 경로 자체가 안전하면 통과', () => {
    expect(safeInternalPath('/hub?from=/login')).toBe('/hub?from=/login')
  })
})

describe('resolveReturnTo — 별칭 3종을 모두 읽는다', () => {
  it.each(RETURN_PARAM_ALIASES)('별칭 %s 로 전달된 경로를 복원한다', (key) => {
    const params = new URLSearchParams(`${key}=${encodeURIComponent('/wordvault/browse')}`)
    expect(resolveReturnTo(params)).toBe('/wordvault/browse')
  })

  it('아무 별칭도 없으면 기본 랜딩', () => {
    expect(resolveReturnTo(new URLSearchParams(''))).toBe(DEFAULT_LANDING)
  })

  it('값이 위험하면 기본 랜딩으로 떨어진다', () => {
    expect(resolveReturnTo(new URLSearchParams('next=//evil.com'))).toBe(DEFAULT_LANDING)
    expect(resolveReturnTo(new URLSearchParams('redirect=https://evil.com'))).toBe(DEFAULT_LANDING)
  })

  it('안전하지 않은 별칭은 건너뛰고 안전한 별칭을 쓴다', () => {
    const params = new URLSearchParams('next=//evil.com&returnTo=/hub')
    expect(resolveReturnTo(params)).toBe('/hub')
  })

  it('별칭 우선순위는 next > returnTo > redirect', () => {
    const params = new URLSearchParams('redirect=/c&returnTo=/b&next=/a')
    expect(resolveReturnTo(params)).toBe('/a')
  })

  it('params 가 null 이어도 던지지 않는다', () => {
    expect(resolveReturnTo(null)).toBe(DEFAULT_LANDING)
    expect(resolveReturnTo(undefined)).toBe(DEFAULT_LANDING)
  })

  it('fallback 을 지정할 수 있다', () => {
    expect(resolveReturnTo(new URLSearchParams(''), '/admin')).toBe('/admin')
  })

  it('URLSearchParams 가 %2F 인코딩을 풀어도 안전 판정이 유지된다', () => {
    const params = new URLSearchParams(`next=${encodeURIComponent('//evil.com')}`)
    expect(resolveReturnTo(params)).toBe(DEFAULT_LANDING)
  })
})

describe('loginUrlWithReturn — 기록은 한 가지 이름으로만', () => {
  it('안전한 경로를 인코딩해 붙인다', () => {
    expect(loginUrlWithReturn('/wordvault/browse')).toBe(
      `/login?${RETURN_PARAM}=${encodeURIComponent('/wordvault/browse')}`,
    )
  })

  it('위험한 경로는 파라미터 없이 로그인으로만 보낸다', () => {
    expect(loginUrlWithReturn('//evil.com')).toBe('/login')
    expect(loginUrlWithReturn(null)).toBe('/login')
  })

  it('쿼리를 가진 경로도 온전히 왕복한다', () => {
    const target = '/library/books/x?chapter=3'
    const url = loginUrlWithReturn(target)
    const query = new URLSearchParams(url.split('?')[1])
    expect(resolveReturnTo(query)).toBe(target)
  })

  it('base 를 바꿔도 파라미터 이름은 그대로', () => {
    expect(loginUrlWithReturn('/hub', '/signin')).toBe(
      `/signin?${RETURN_PARAM}=${encodeURIComponent('/hub')}`,
    )
  })
})

describe('왕복 계약 — 쓰기(loginUrlWithReturn)와 읽기(resolveReturnTo)가 맞물린다', () => {
  // 이 테스트가 v06.140 결함의 회귀 락이다:
  // 미들웨어는 ?next= 로 쓰는데 로그인 화면은 ?returnTo= 를 읽어 전부 /hub 로 떨어졌다.
  it.each(['/hub', '/wordvault/browse', '/admin/curation', '/library/books/abc?tab=vocab'])(
    '%s 를 기록했다가 읽으면 같은 경로가 나온다',
    (target) => {
      const url = loginUrlWithReturn(target)
      const query = new URLSearchParams(url.split('?')[1] ?? '')
      expect(resolveReturnTo(query)).toBe(target)
    },
  )
})
