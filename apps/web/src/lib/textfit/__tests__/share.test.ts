// apps/web/src/lib/textfit/__tests__/share.test.ts
//
// 공유 링크 회귀. 이 파일이 지키는 계약은 셋인데, 첫째가 압도적으로 중요하다:
//
//  1. **지문이 링크에 새지 않는다.** 붙여넣는 것은 대체로 저작권 있는 교과서·모의고사다.
//     한 글자라도 문장이 실리면 우리가 복제·배포 주체가 된다.
//  2. **어떤 입력에도 throw 하지 않는다.** 공유 링크는 남이 손댈 수 있는 유일한 입력이다.
//     디코더가 죽으면 공개 화면 전체가 죽는다.
//  3. **왕복이 값을 보존한다.** 보내는 사람과 받는 사람이 다른 숫자를 보면 공유가 아니다.

import { describe, expect, it } from 'vitest'

import { buildLevelProfile } from '../profile'
import type { PublicWord } from '../profile'
import {
  SHARE_PARAM,
  buildShareUrl,
  decodeProfile,
  encodeProfile,
  isShareable,
} from '../share'

const lv = (surface: string, count: number, vLevel: number): PublicWord => ({
  surface,
  lemma: surface.toLowerCase(),
  count,
  status: 'leveled',
  vLevel,
})
const un = (surface: string, count: number): PublicWord => ({
  surface,
  lemma: surface.toLowerCase(),
  count,
  status: 'unleveled',
  vLevel: null,
})

const sample = () =>
  buildLevelProfile(
    [
      lv('disproportionately', 2, 10),
      lv('contingent', 3, 8),
      lv('curriculum', 4, 6),
      lv('efficient', 6, 5),
      un('massed', 2),
    ],
    420,
  )

// ── ① 지문 유출 금지 ────────────────────────────────────────────────────────

describe('지문은 링크에 담기지 않는다 (저작권)', () => {
  it('인코딩 결과에 문장이 들어가지 않는다 — 단어 목록만 담는다', () => {
    const p = sample()
    const encoded = encodeProfile(p)
    const decodedJson = Buffer.from(
      encoded.replace(/-/g, '+').replace(/_/g, '/'),
      'base64',
    ).toString('utf8')

    // 담긴 문자열은 전부 개별 단어여야 한다 — 공백이 들어간 항목이 있으면 문장이 샌 것이다.
    const strings = decodedJson.match(/"[^"]*"/g) ?? []
    for (const s of strings) {
      expect(s.slice(1, -1)).not.toMatch(/\s/)
    }
  })

  it('레벨 미상 단어는 공유되지 않는다 — 레벨을 모르면 담을 이유가 없다', () => {
    const p = buildLevelProfile([un('massed', 9), lv('contingent', 1, 8)], 200)
    const back = decodeProfile(encodeProfile(p))!
    expect(back.hardestWords.map((w) => w.surface)).toEqual(['contingent'])
  })

  it('단어 수와 길이에 상한이 있다 — URL 을 부풀리지 못한다', () => {
    const many = Array.from({ length: 60 }, (_, i) => lv(`w${i}`.padEnd(80, 'x'), 1, 10))
    const back = decodeProfile(encodeProfile(buildLevelProfile(many, 1000)))!
    expect(back.hardestWords.length).toBeLessThanOrEqual(16)
    for (const w of back.hardestWords) expect(w.surface.length).toBeLessThanOrEqual(32)
  })

  it('breakdown(원문 토큰 구성)은 공유하지 않는다', () => {
    const back = decodeProfile(encodeProfile(sample()))!
    expect(back.breakdown).toEqual({
      leveled: 0,
      unleveled: 0,
      unresolved: 0,
      function_word: 0,
    })
  })
})

// ── ② 어떤 입력에도 죽지 않는다 ─────────────────────────────────────────────

describe('디코더는 throw 하지 않는다 (공개 화면의 유일한 외부 입력)', () => {
  it.each([
    ['빈 문자열', ''],
    ['null', null],
    ['undefined', undefined],
    ['base64 아님', '!!!not-base64!!!'],
    ['JSON 아님', Buffer.from('hello world').toString('base64url')],
    ['배열 아님', Buffer.from('{"a":1}').toString('base64url')],
    ['길이 부족', Buffer.from('[1,2,3]').toString('base64url')],
    ['coverage 배열 길이 불일치', Buffer.from('[1,7,8,100,20,0,950,[900],[]]').toString('base64url')],
    ['coverage 가 배열이 아님', Buffer.from('[1,7,8,100,20,0,950,"x",[]]').toString('base64url')],
    ['버전 불일치', Buffer.from('[99,7,8,100,20,0,950,[1,2,3,4,5,6,7,8],[]]').toString('base64url')],
  ])('%s → null (예외 없음)', (_label, input) => {
    expect(() => decodeProfile(input as string)).not.toThrow()
    expect(decodeProfile(input as string)).toBeNull()
  })

  it('과도하게 긴 입력은 파싱조차 하지 않는다', () => {
    expect(decodeProfile('A'.repeat(5000))).toBeNull()
  })

  it('단조성이 깨진 곡선은 버린다 — 뒤집힌 그래프를 그리느니 링크를 무시한다', () => {
    const forged = Buffer.from(
      JSON.stringify([1, 7, 8, 400, 30, 0, 950, [900, 800, 950, 960, 970, 980, 990, 1000], []]),
    ).toString('base64url')
    expect(decodeProfile(forged)).toBeNull()

    // 대조군 — 같은 페이로드에서 단조성만 고치면 통과해야 한다
    //   (길이 검증에 걸려 우연히 null 이 되는 게 아님을 확인한다)
    const ok = Buffer.from(
      JSON.stringify([1, 7, 8, 400, 30, 0, 950, [800, 900, 950, 960, 970, 980, 990, 1000], []]),
    ).toString('base64url')
    expect(decodeProfile(ok)).not.toBeNull()
  })

  it('망가진 단어 항목은 건너뛰고 나머지는 살린다', () => {
    const mixed = Buffer.from(
      JSON.stringify([
        1,
        7,
        8,
        400,
        30,
        0,
        950,
        [900, 910, 920, 930, 940, 950, 960, 970],
        [['ok', 9], 'bad', ['x'], [123, 4], ['  ', 5], ['fine', 99]],
      ]),
    ).toString('base64url')

    const back = decodeProfile(mixed)!
    expect(back.hardestWords.map((w) => w.surface)).toEqual(['ok', 'fine'])
    // v_level 은 1~11 로 클램프된다
    expect(back.hardestWords[1]!.vLevel).toBe(11)
  })
})

// ── ③ 왕복 보존 ────────────────────────────────────────────────────────────

describe('왕복 — 보내는 사람과 받는 사람이 같은 숫자를 본다', () => {
  it('핵심 값이 보존된다', () => {
    const p = sample()
    const back = decodeProfile(encodeProfile(p))!

    expect(back.fitLevel).toBe(p.fitLevel)
    expect(back.textVLevel).toBe(p.textVLevel)
    expect(back.totalTokens).toBe(p.totalTokens)
    expect(back.uniqueContentWords).toBe(p.uniqueContentWords)
    expect(back.readings).toHaveLength(p.readings.length)
  })

  it('레벨별 커버리지가 ‰ 오차 안에서 보존된다', () => {
    const p = sample()
    const back = decodeProfile(encodeProfile(p))!
    for (let i = 0; i < p.readings.length; i++) {
      expect(back.readings[i]!.coverage).toBeCloseTo(p.readings[i]!.coverage, 2)
      expect(back.readings[i]!.coverageLow).toBeCloseTo(p.readings[i]!.coverageLow, 2)
      expect(back.readings[i]!.coverageHigh).toBeCloseTo(p.readings[i]!.coverageHigh, 2)
      expect(back.readings[i]!.band).toBe(p.readings[i]!.band)
    }
  })

  it('불확실 범위가 보존된다 — 정직성 장치가 공유에서 사라지지 않는다', () => {
    const p = buildLevelProfile([lv('a', 5, 6), un('mystery', 20)], 300)
    const back = decodeProfile(encodeProfile(p))!
    expect(back.resolvedShare).toBeCloseTo(p.resolvedShare, 2)
    const spread = back.readings[0]!.coverageHigh - back.readings[0]!.coverageLow
    expect(spread).toBeGreaterThan(0.05)
  })

  it('적정 레벨이 없으면 없는 채로 전달된다 — 억지로 학년을 붙이지 않는다', () => {
    const p = buildLevelProfile([lv('a', 40, 11)], 100)
    expect(p.fitLevel).toBeNull()
    expect(decodeProfile(encodeProfile(p))!.fitLevel).toBeNull()
  })

  it('URL 이 현실적인 길이다 (2,000자 이내)', () => {
    const many = Array.from({ length: 40 }, (_, i) => lv(`polysyllabic${i}`, 2, 10))
    const url = buildShareUrl('https://vocaflow.app', buildLevelProfile(many, 2000))
    expect(url.length).toBeLessThan(2000)
    expect(url).toContain(`/fit?${SHARE_PARAM}=`)
  })
})

describe('isShareable', () => {
  it('내용이 없으면 공유하지 않는다', () => {
    expect(isShareable(null)).toBe(false)
    expect(isShareable(buildLevelProfile([], 0))).toBe(false)
    expect(isShareable(sample())).toBe(true)
  })
})
