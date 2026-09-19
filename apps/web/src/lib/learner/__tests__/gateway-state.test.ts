// apps/web/src/lib/learner/__tests__/gateway-state.test.ts
//
// 관문 상태 판정 + **말투 규칙**.
//
// 말투를 테스트하는 이유: 복귀 문구는 이 제품에서 비난이 되기 가장 쉬운 자리다.
// "3일 쉬었어요" · "연속이 끊겼어요" 는 손실 프레이밍이고 스트릭 불안과 같은 기전으로 작동한다
// (철학 ③ Empathetic Feedback). 문구는 리팩터링 중에 조용히 바뀌기 쉬우므로 규칙을 잠근다.

import { describe, expect, it } from 'vitest'

import { classifyGateway, daysSinceKst, gatewayLine, type LastTouch } from '../gateway-state'

/** 2026-08-16 12:00 KST 를 '지금' 으로 고정 */
const NOW = Date.parse('2026-08-16T03:00:00Z')

function touch(iso: string, over: Partial<LastTouch> = {}): LastTouch {
  return { module: 'dictation', title: null, href: null, at: iso, ...over }
}

describe('daysSinceKst — KST 날짜 경계로 센다', () => {
  it('같은 KST 날이면 0', () => {
    expect(daysSinceKst('2026-08-16T00:30:00Z', NOW)).toBe(0) // 09:30 KST 같은 날
  })

  it('UTC 로는 같은 날이어도 KST 로 다른 날이면 1', () => {
    // 2026-08-15T16:00Z = 2026-08-16 01:00 KST → 같은 날(0)
    expect(daysSinceKst('2026-08-15T16:00:00Z', NOW)).toBe(0)
    // 2026-08-15T14:00Z = 2026-08-15 23:00 KST → 하루 전(1)
    expect(daysSinceKst('2026-08-15T14:00:00Z', NOW)).toBe(1)
  })

  it('미래 시각도 음수로 새지 않는다', () => {
    expect(daysSinceKst('2026-09-01T00:00:00Z', NOW)).toBe(0)
  })
})

describe('classifyGateway — 네 상태', () => {
  it('기록이 없으면 first', () => {
    expect(classifyGateway(null, NOW).phase).toBe('first')
  })

  it('오늘 활동했으면 today', () => {
    expect(classifyGateway(touch('2026-08-16T01:00:00Z'), NOW).phase).toBe('today')
  })

  it('1~6일이면 returning', () => {
    expect(classifyGateway(touch('2026-08-15T14:00:00Z'), NOW).phase).toBe('returning') // 1일
    expect(classifyGateway(touch('2026-08-10T14:00:00Z'), NOW).phase).toBe('returning') // 6일
  })

  it('7일 이상이면 away', () => {
    expect(classifyGateway(touch('2026-08-09T14:00:00Z'), NOW).phase).toBe('away') // 7일
    expect(classifyGateway(touch('2026-06-01T14:00:00Z'), NOW).phase).toBe('away')
  })
})

describe('gatewayLine — 할 말이 없으면 그리지 않는다', () => {
  it('처음 온 사람에게는 줄을 만들지 않는다 (진단 유도는 TodayFocus 단독)', () => {
    expect(gatewayLine(classifyGateway(null, NOW), null)).toBeNull()
  })

  it('오늘 이미 온 사람에게도 만들지 않는다 ("돌아왔네요" 는 거짓이다)', () => {
    expect(gatewayLine(classifyGateway(touch('2026-08-16T01:00:00Z'), NOW), '받아쓰기')).toBeNull()
  })
})

describe('gatewayLine — 말투 규칙 (철학 ③)', () => {
  it('하루 만이면 "어제 이어서"', () => {
    const line = gatewayLine(classifyGateway(touch('2026-08-15T14:00:00Z'), NOW), '받아쓰기')
    expect(line?.lead).toBe('어제 이어서')
  })

  it('2~6일은 일수를 사실로만 말한다', () => {
    const line = gatewayLine(classifyGateway(touch('2026-08-13T14:00:00Z'), NOW), '받아쓰기')
    expect(line?.lead).toBe('3일 만이에요')
  })

  it('7일 이상이면 **일수를 아예 말하지 않는다** — 오래 비울수록 숫자를 지운다', () => {
    for (const iso of ['2026-08-09T14:00:00Z', '2026-07-01T14:00:00Z', '2026-01-01T14:00:00Z']) {
      const line = gatewayLine(classifyGateway(touch(iso), NOW), '받아쓰기')
      expect(line?.lead, `${iso} 의 lead`).toBe('다시 오셨어요')
      expect(line?.lead).not.toMatch(/\d/)
    }
  })

  it('어떤 상태에서도 비난·손실 표현을 쓰지 않는다', () => {
    const BANNED = ['쉬었', '끊겼', '놓쳤', '실패', '오랜만', '안 했', '못 했']
    for (const iso of [
      '2026-08-15T14:00:00Z',
      '2026-08-13T14:00:00Z',
      '2026-08-09T14:00:00Z',
      '2026-01-01T14:00:00Z',
    ]) {
      const line = gatewayLine(classifyGateway(touch(iso), NOW), '받아쓰기')
      const text = `${line?.lead ?? ''} ${line?.detail ?? ''}`
      for (const bad of BANNED) {
        expect(text, `${iso} 문구에 "${bad}" 가 있으면 안 된다: ${text}`).not.toContain(bad)
      }
    }
  })
})

describe('gatewayLine — 무엇을 했는지 되짚는다', () => {
  it('자료 제목이 있으면 제목과 활동을 함께 말한다', () => {
    const line = gatewayLine(
      classifyGateway(touch('2026-08-13T14:00:00Z', { title: 'A Christmas Carol' }), NOW),
      '받아쓰기',
    )
    expect(line?.detail).toContain('A Christmas Carol')
    expect(line?.detail).toContain('받아쓰기')
  })

  it('제목이 없으면 활동만 말한다 (없는 자료명을 지어내지 않는다)', () => {
    const line = gatewayLine(classifyGateway(touch('2026-08-13T14:00:00Z'), NOW), 'WordBlitz')
    expect(line?.detail).toBe('마지막엔 WordBlitz')
  })

  it('조사를 붙이지 않는다 — 앞 명사가 임의의 영문이라 받침을 추정할 수 없다', () => {
    // 《Alice》는 "를", 《Carol》은 "을" · Echo 는 "로", Dictation 은 "으로" 다.
    // 고정 조사를 쓰면 둘 중 하나는 반드시 틀린다(라운드 1 에서 "《…Ghost》 을" 노출).
    const cases: [string | null, string][] = [
      ['Alice in Wonderland', 'Echo'],
      ['A Christmas Carol', 'Dictation'],
      [null, 'PairFlip'],
    ]
    for (const [title, activity] of cases) {
      const line = gatewayLine(
        classifyGateway(touch('2026-08-13T14:00:00Z', { title }), NOW),
        activity,
      )
      const d = line?.detail ?? ''
      for (const particle of ['을 ', '를 ', ' 으로', ' 로 ']) {
        expect(d, `"${d}" 에 조사 "${particle}"`).not.toContain(particle)
      }
    }
  })

  it('활동 이름을 못 얻으면 detail 을 비운다 (슬러그 노출 금지)', () => {
    const line = gatewayLine(classifyGateway(touch('2026-08-13T14:00:00Z'), NOW), null)
    expect(line?.lead).toBe('3일 만이에요')
    expect(line?.detail).toBeNull()
  })
})

