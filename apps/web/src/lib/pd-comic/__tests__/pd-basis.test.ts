// apps/web/src/lib/pd-comic/__tests__/pd-basis.test.ts
//
// PD 근거 계약 회귀 — **틀리면 법적 진술이 틀리는 값**이라 한 곳에서만 정한다.
//
// 이미 한 번 갈려 있었다: 파이프라인(`usPdHint`)은 1930년 이전에 `term-expired` 를 내고
// DB CHECK 도 허용하는데, 발행 API 의 화이트리스트에는 그 토큰이 없어 **확정이 400 으로 거부**됐다.
// 파이프라인이 만든 값을 API 가 못 받는 상태였고, 아무도 그 조합을 눌러 보기 전엔 몰랐다.

import { describe, expect, it } from 'vitest'

import {
  PD_BASES,
  PD_BASIS_KEYS,
  pdBasisLabel,
  pdBasisSpec,
  renewalLookups,
  renewalWindow,
} from '../model'

describe('근거 토큰 집합', () => {
  // DB `pd_issues_basis_chk` 가 허용하는 값 (2026-08-17 실측).
  const DB_ALLOWED = ['term-expired', 'pre-1929', 'no-renewal', 'explicit-license']

  it('DB CHECK 와 같은 집합이다 — 어느 쪽이 넓어도 사고가 난다', () => {
    expect([...PD_BASIS_KEYS].sort()).toEqual([...DB_ALLOWED].sort())
  })

  it('파이프라인이 내는 term-expired 를 받는다 (실측 400 회귀)', () => {
    expect(pdBasisSpec('term-expired')).not.toBeNull()
  })

  it('토큰 키가 중복되지 않는다', () => {
    expect(new Set(PD_BASES.map((b) => b.key)).size).toBe(PD_BASES.length)
  })
})

describe('근거 URL 요구 — 재검증 가능성', () => {
  it('"갱신 기록 없음"은 근거가 필요하다 — 어딘가를 찾아봤다는 주장이므로', () => {
    expect(pdBasisSpec('no-renewal')?.needsEvidence).toBe(true)
  })

  it('"권리자 공개"도 근거가 필요하다', () => {
    expect(pdBasisSpec('explicit-license')?.needsEvidence).toBe(true)
  })

  it('연도만으로 정해지는 것은 근거가 없어도 된다', () => {
    expect(pdBasisSpec('term-expired')?.needsEvidence).toBe(false)
  })
})

describe('renewalWindow — 어디를 봐야 하는가', () => {
  // 1909년법: 갱신은 발행 27~28년째에 등록해야 했다.
  it.each([
    [1952, [1979, 1980]],
    [1940, [1967, 1968]],
    [1953, [1980, 1981]],
  ])('%s년 발행 → %s년 갱신 편', (year, want) => {
    expect(renewalWindow(year)).toEqual(want)
  })

  it('연도를 모르면 범위도 없다 — 추측하지 않는다', () => {
    expect(renewalWindow(null)).toBeNull()
  })
})

describe('renewalLookups — 틀린 조회처는 틀린 확신을 만든다', () => {
  const l = renewalLookups('Whiz Comics', 1940)

  it('CCE(정기간행물)를 먼저 준다 — 만화가 실제로 있는 곳', () => {
    expect(l[0].url).toContain('onlinebooks.library.upenn.edu/cce')
  })

  it('연도를 알면 볼 갱신 편을 짚어 준다', () => {
    expect(l[0].note).toContain('1967')
    expect(l[0].note).toContain('1968')
  })

  it('Stanford DB 는 도서 전용임을 명시한다 (만화는 거기 없다)', () => {
    const stanford = l.find((x) => x.url.includes('stanford'))
    expect(stanford?.note).toMatch(/도서|Class A/)
    expect(stanford?.note).toContain('⚠️')
  })
})

describe('학습자 문구', () => {
  it('근거가 없으면 빈칸이 아니라 상태를 말한다', () => {
    expect(pdBasisLabel(null)).toBe('근거 확인 중')
  })

  it('모르는 값은 삼키지 않고 그대로 보여준다', () => {
    expect(pdBasisLabel('new-token')).toBe('new-token')
  })
})
