// apps/web/src/lib/auth/__tests__/protected-routes.test.ts
// "로그인이 필요한 화면" 선언 회귀 — 과잉 차단(공개 카탈로그 잠금)과 누락 차단 양쪽을 막는다.

import { describe, it, expect } from 'vitest'

import { PROTECTED_PREFIXES, PUBLIC_PREFIXES, requiresAuth } from '../protected-routes'

describe('requiresAuth — 보호되어야 하는 개인 화면', () => {
  it.each([
    '/hub',
    '/dashboard',
    '/settings',
    '/reports',
    '/teacher',
    '/plan',
    '/my',
    '/my/words',
    '/my/books/abc-123',
    '/diagnostic',
    '/diagnostic/history',
    '/practice/dcp',
    '/wordvault',
    '/wordvault/browse',
    '/flashcard/play',
    '/spellforge/play',
    '/pairflip/results',
    '/wordblitz',
    '/scriptquiz/play',
    '/dictate/session',
    // 플레이는 보호 — FSRS·scores 를 쓴다. 카탈로그(`/arcade`)와 갈린다(아래 공개 목록).
    '/play/connections',
    '/play/cascade',
    '/text',
    '/text/new',
    '/text/89970bfa/echo',
  ])('보호: %s', (path) => {
    expect(requiresAuth(path)).toBe(true)
  })
})

describe('requiresAuth — 공개로 남아야 하는 화면', () => {
  it.each([
    ['랜딩', '/'],
    ['소개', '/about'],
    ['가격', '/pricing'],
    ['약관', '/terms'],
    ['개인정보', '/privacy'],
    ['로그인', '/login'],
    ['가입', '/signup'],
    ['비밀번호 재설정', '/reset-password'],
    ['이메일 인증', '/verify-email'],
    ['도서 카탈로그', '/library'],
    ['도서 상세', '/library/books/abc-123'],
    ['스크립트', '/library/scripts/xyz'],
    ['만화 카탈로그', '/comics'],
    ['만화 상세', '/comics/restored/slug-1'],
    ['Game Lab 카탈로그', '/arcade'],
  ])('공개: %s', (_label, path) => {
    expect(requiresAuth(path)).toBe(false)
  })

  it('Game Lab 은 카탈로그만 공개하고 플레이는 잠근다 (둘러보기 자유 · 기록은 로그인)', () => {
    // 2026-08-15 인증 스윕이 `/arcade` 를 휩쓸어 잠그면서 `09-arcade-access` 의 비로그인
    // 그룹 7건이 계속 빨간 채였다(잠긴 뒤 아무도 안 봤다는 뜻이다). 그 스펙 헤더는 그 그룹을
    // **"신규 유입 경로"** 로 명시하고, 화면에도 맛보기 배지·"단어 모으러 가기" CTA·
    // 무단어 오늘의 실험이 일부러 만들어져 있다. 경계는 **카탈로그/플레이** 이지 화면 전체가 아니다.
    expect(requiresAuth('/arcade'), '카탈로그는 공개').toBe(false)
    expect(requiresAuth('/play/cascade'), '플레이는 보호').toBe(true)
    // 접두사 오인 방지 — '/arcade' 공개가 '/play' 를 열어 주면 안 된다.
    expect(requiresAuth('/play'), '플레이 루트도 보호').toBe(true)
  })

  it('API 는 리다이렉트 대상이 아니다 (401/403 은 각 핸들러 책임)', () => {
    expect(requiresAuth('/api/auth/callback')).toBe(false)
    expect(requiresAuth('/api/lcp/process')).toBe(false)
  })
})

describe('접두사 경계 — 부분 일치로 엉뚱한 경로를 삼키지 않는다', () => {
  it.each([
    ['/textbook', '/text'],
    ['/planner-public', '/plan'],
    ['/myths', '/my'],
    ['/playground-docs', '/play'],
    ['/hubbub', '/hub'],
    ['/reportsx', '/reports'],
  ])('%s 는 %s 접두사에 걸리지 않는다', (path) => {
    expect(requiresAuth(path)).toBe(false)
  })

  it('정확히 일치하는 접두사 자체는 보호된다', () => {
    expect(requiresAuth('/my')).toBe(true)
    expect(requiresAuth('/text')).toBe(true)
    expect(requiresAuth('/play')).toBe(true)
  })
})

describe('입력 방어', () => {
  it('빈 값·비경로·비문자열에 던지지 않는다', () => {
    expect(requiresAuth('')).toBe(false)
    expect(requiresAuth(null)).toBe(false)
    expect(requiresAuth(undefined)).toBe(false)
    expect(requiresAuth('hub')).toBe(false)
    expect(requiresAuth(42 as unknown as string)).toBe(false)
  })
})

describe('선언 자체의 위생', () => {
  it('접두사에 끝 슬래시를 붙이지 않는다 (붙이면 단독 경로가 안 잡힌다)', () => {
    for (const p of [...PROTECTED_PREFIXES, ...PUBLIC_PREFIXES]) {
      if (p === '/') continue
      expect(p.endsWith('/'), `${p} 에 끝 슬래시가 있다`).toBe(false)
    }
  })

  it('모든 접두사는 "/" 로 시작한다', () => {
    for (const p of [...PROTECTED_PREFIXES, ...PUBLIC_PREFIXES]) {
      expect(p.startsWith('/')).toBe(true)
    }
  })

  it('중복 선언이 없다', () => {
    const all = [...PROTECTED_PREFIXES, ...PUBLIC_PREFIXES]
    expect(new Set(all).size).toBe(all.length)
  })

  it('공개 선언이 보호 선언보다 우선한다 (겹쳐도 열린다)', () => {
    // 두 목록이 겹치면 공개가 이긴다 — 이 계약이 깨지면 카탈로그가 조용히 잠긴다
    const overlap = PROTECTED_PREFIXES.filter((p) => (PUBLIC_PREFIXES as readonly string[]).includes(p))
    for (const p of overlap) {
      expect(requiresAuth(p)).toBe(false)
    }
  })
})
