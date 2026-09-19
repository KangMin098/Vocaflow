// apps/web/src/lib/csat/__tests__/trap-drill.test.ts
//
// **훈련이 재는 것을 잠근다.**
//
// 이 훈련이 무너지는 방식은 「안 돌아간다」가 아니라 **「돌아가는데 아무것도 안 잰다」**다:
// 보기가 엉뚱해서 소거법으로 풀리거나, 해설이 정답 이름을 품고 있거나, 서버와 클라이언트가
// 다른 보기 순서를 그리거나. 셋 다 화면은 멀쩡해 보인다.

import { describe, expect, it } from 'vitest'

import { TRAPS, UNIVERSAL } from '../trap-atlas'
import {
  OPTION_COUNT,
  buildOptions,
  leaksAnswer,
  rngFrom,
  scoreDrill,
  shuffle,
  type DrillAnswer,
} from '../trap-drill'

describe('보기 만들기', () => {
  it('정답이 반드시 들어가고 중복이 없다', () => {
    for (const t of UNIVERSAL) {
      for (const typeId of Object.keys(t.by_type).slice(0, 3)) {
        const opts = buildOptions(t.key, typeId, `${t.key}:${typeId}`, TRAPS)
        expect(opts).toHaveLength(OPTION_COUNT)
        expect(opts).toContain(t.key)
        expect(new Set(opts).size).toBe(OPTION_COUNT)
      }
    }
  })

  it('보기는 그 유형에서 실제로 나오는 함정에서 뽑는다', () => {
    // 전체에서 아무렇게나 뽑으면 **그 유형에 나오지도 않는 함정**이 섞여 소거법으로 풀린다.
    // 그러면 재는 것이 「수법을 아는가」가 아니라 「목록을 외웠는가」가 된다.
    const dense = TRAPS[0]!
    const typeId = Object.keys(dense.by_type)[0]!
    const inType = new Set(TRAPS.filter((t) => (t.by_type[typeId] ?? 0) > 0).map((t) => t.key))
    const opts = buildOptions(dense.key, typeId, 'seed', TRAPS)
    const outside = opts.filter((o) => o !== dense.key && !inType.has(o))
    expect(outside, `그 유형에 없는 보기가 섞였다: ${outside.join(', ')}`).toEqual([])
  })

  it('같은 씨앗이면 같은 순서 — 서버와 클라이언트가 어긋나지 않는다', () => {
    // 어긋나면 하이드레이션이 깨지고, 최악의 경우 서버가 정한 정답 자리와 화면이 다르다.
    const a = buildOptions('어휘 함정', 'R-BLANK', 'M2309#42:2', TRAPS)
    const b = buildOptions('어휘 함정', 'R-BLANK', 'M2309#42:2', TRAPS)
    expect(a).toEqual(b)
  })

  it('씨앗이 다르면 순서가 달라진다 — 늘 같은 자리에 정답이 있으면 훈련이 아니다', () => {
    const positions = new Set<number>()
    for (let i = 0; i < 40; i++) {
      positions.add(buildOptions('무관', 'R-BLANK', `seed-${i}`, TRAPS).indexOf('무관'))
    }
    expect(positions.size, '정답 자리가 고정돼 있다').toBeGreaterThan(1)
  })

  it('유형에 함정이 모자라도 넷을 채운다', () => {
    const opts = buildOptions('무관', '존재하지-않는-유형', 'x', TRAPS)
    expect(opts).toHaveLength(OPTION_COUNT)
    expect(opts).toContain('무관')
    expect(new Set(opts).size).toBe(OPTION_COUNT)
  })
})

describe('난수기', () => {
  it('같은 씨앗이면 같은 수열', () => {
    const a = rngFrom('abc')
    const b = rngFrom('abc')
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })

  it('0 이상 1 미만', () => {
    const r = rngFrom('seed')
    for (let i = 0; i < 200; i++) {
      const v = r()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('섞어도 원소가 그대로다', () => {
    const src = [1, 2, 3, 4, 5, 6, 7, 8]
    const out = shuffle(src, rngFrom('s'))
    expect([...out].sort((x, y) => x - y)).toEqual(src)
    expect(src, '원본을 건드렸다').toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })
})

describe('정답 누설 걸러내기', () => {
  it('해설이 정답 이름을 품고 있으면 버린다', () => {
    expect(leaksAnswer('앞뒤가 뒤집혀 보인다', '이건 인과 역전이다', '인과 역전')).toBe(true)
    // 띄어쓰기를 지운 형태도 잡는다
    expect(leaksAnswer('', '전형적인 인과역전 선지다', '인과 역전')).toBe(true)
  })

  it('이름이 없으면 통과시킨다', () => {
    expect(leaksAnswer('첫 문장에 같은 낱말이 있다', '그 구절의 주어는 Kant 이지 법이 아니다', '주체 역전')).toBe(
      false,
    )
  })
})

describe('채점', () => {
  const mk = (answer: string, picked: string, i: number): DrillAnswer => ({
    cardId: `c${i}`,
    picked,
    answer,
  })

  it('맞은 수와 틀린 문제를 센다', () => {
    const r = scoreDrill([mk('무관', '무관', 1), mk('반대 진술', '무관', 2), mk('무관', '무관', 3)])
    expect(r.total).toBe(3)
    expect(r.correct).toBe(2)
    expect(r.missed).toHaveLength(1)
    expect(r.missed[0]!.answer).toBe('반대 진술')
  })

  it('한 번 틀린 것을 「약점」이라고 부르지 않는다', () => {
    // 1/1 을 약점이라 적으면 학습자가 **없는 결함**을 고치러 간다(철학 3).
    const r = scoreDrill([mk('무관', '반대 진술', 1)])
    expect(r.weak).toEqual([])
  })

  it('두 번 보고 두 번 다 놓친 것만 약점이다', () => {
    const r = scoreDrill([mk('무관', '반대 진술', 1), mk('무관', '어휘 함정', 2), mk('범위 과대', '범위 과대', 3)])
    expect(r.weak).toEqual(['무관'])
  })

  it('두 번 중 한 번 맞히면 약점이 아니다', () => {
    const r = scoreDrill([mk('무관', '무관', 1), mk('무관', '반대 진술', 2)])
    expect(r.weak).toEqual([])
  })

  it('빈 세트에서도 죽지 않는다', () => {
    const r = scoreDrill([])
    expect(r).toMatchObject({ total: 0, correct: 0, missed: [], byTrap: [], weak: [] })
  })

  it('함정별 성적이 못 맞힌 것부터 온다', () => {
    const r = scoreDrill([
      mk('무관', '무관', 1),
      mk('반대 진술', '무관', 2),
      mk('반대 진술', '무관', 3),
      mk('범위 과대', '범위 과대', 4),
    ])
    expect(r.byTrap[0]!.trap).toBe('반대 진술')
    expect(r.byTrap[0]).toMatchObject({ seen: 2, correct: 0 })
  })
})
