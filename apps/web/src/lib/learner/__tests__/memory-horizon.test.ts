// apps/web/src/lib/learner/__tests__/memory-horizon.test.ts
//
// Growth(회고) 데이터 척추의 순수 규칙.
//
// 여기서 지키는 것은 전부 **2026-08-15 실측으로 발견한 결함의 재발 방지**다.
// 그 결함들의 공통점: 화면은 멀쩡히 떴고, 숫자만 조용히 틀렸다. 그래서 눈으로는
// 몇 달을 못 잡았고, 잡힌 뒤에도 "어디가 틀렸는지" 를 말해 주는 장치가 없었다.

import { describe, expect, it } from 'vitest'

// 순수 모듈에서 직접 가져온다. `growth-stats`/`memory-horizon` 는 `server-only` +
// `react.cache` 라 node 테스트 환경에서 뜨지 않는다(실제로 그렇게 한 번 실패했다).
import {
  RUNGS,
  computeStreak,
  formatDuration,
  rungFor,
  type ActivityDayDto,
} from '../growth-math'

function days(spec: Array<{ minutes?: number; words?: number; reviews?: number }>): ActivityDayDto[] {
  return spec.map((s, i) => ({
    date: `2026-08-${String(i + 1).padStart(2, '0')}`,
    minutes: s.minutes ?? 0,
    words: s.words ?? 0,
    reviews: s.reviews ?? 0,
  }))
}

describe('computeStreak — 연속일 정의는 앱에 하나뿐이다', () => {
  it('오늘까지 이어진 날만 센다', () => {
    expect(computeStreak(days([{ words: 5 }, {}, { words: 3 }, { words: 9 }]))).toBe(2)
  })

  it('분이 0이어도 단어가 있으면 학습한 날이다', () => {
    // 이 한 줄이 핵심 회귀다. `total_minutes` 는 60초 미만 세션을 0으로 반올림하므로
    // minutes 만 보면 리뷰 120건을 한 날이 "학습 안 함" 이 된다(실측: 28일 중 1일로 나왔다).
    expect(computeStreak(days([{ minutes: 0, words: 86 }, { minutes: 0, words: 82 }]))).toBe(2)
  })

  it('분도 단어도 0인데 복습이 있으면 학습한 날이다 — 절반이 여기서 사라졌다', () => {
    // `minutes`·`words` 를 채우는 것은 `scores` 트리거뿐이고, 실제 복습을 세는 것은
    // `learning_records` 가 채우는 `total_reviews` 다. `scores` 를 안 쓰는 모듈
    // (EchoMatch·Dictation)로 공부한 날은 두 칸이 0 으로 남는다.
    // 실측 2026-09-05: `daily_activity` 47일 중 **24일(51.1%)** 이 그 상태였고,
    // 연속 배지는 `streak > 0` 게이트라 **아예 사라져** 있었다 — 같은 카드의 막대그래프는
    // `learning_records` 로 그리므로 "오늘 막대는 섰는데 연속 배지는 없다" 가 됐다.
    expect(computeStreak(days([{ reviews: 51 }, { reviews: 28 }, { reviews: 12 }]))).toBe(3)
  })

  it('셋 다 0인 날은 여전히 끊는다 — 관대해지는 것이 목적이 아니다', () => {
    expect(computeStreak(days([{ reviews: 5 }, { minutes: 0, words: 0, reviews: 0 }, { reviews: 7 }]))).toBe(1)
  })

  it('오늘이 아직 비어 있어도 어제까지의 연속을 끊지 않는다', () => {
    // 하루가 끝나기 전에 "끊겼다" 고 말하지 않는다(철학 ③).
    expect(computeStreak(days([{ words: 4 }, { words: 4 }, {}]))).toBe(2)
  })

  it('어제도 비어 있으면 0 — 오늘 하루만 봐주고 그 이상은 아니다', () => {
    expect(computeStreak(days([{ words: 4 }, {}, {}]))).toBe(0)
  })

  it('전부 비면 0', () => {
    expect(computeStreak(days([{}, {}, {}]))).toBe(0)
  })

  it('빈 배열도 죽지 않는다', () => {
    expect(computeStreak([])).toBe(0)
  })
})

describe('rungFor — 지속 사다리 경계', () => {
  it('복습 기록이 없으면 사다리 밖', () => {
    expect(rungFor(0)).toBeNull()
    expect(rungFor(-1)).toBeNull()
    expect(rungFor(Number.NaN)).toBeNull()
  })

  it('경계값은 위 칸에 속한다 (>= min)', () => {
    expect(rungFor(0.99)).toBe('day')
    expect(rungFor(1)).toBe('few')
    expect(rungFor(2.99)).toBe('few')
    expect(rungFor(3)).toBe('week')
    expect(rungFor(6.99)).toBe('week')
    expect(rungFor(7)).toBe('month')
    expect(rungFor(29.99)).toBe('month')
    expect(rungFor(30)).toBe('season')
  })

  it('아무리 커도 마지막 칸을 벗어나지 않는다', () => {
    expect(rungFor(100_000)).toBe('season')
  })

  it('칸은 빈틈 없이 이어진다 — 어떤 양수도 반드시 한 칸에 든다', () => {
    for (const s of [0.001, 0.5, 1, 2, 3, 5, 7, 20, 30, 365]) {
      expect(rungFor(s), `S=${s} 가 어느 칸에도 안 든다`).not.toBeNull()
    }
    // 칸 경계가 서로 맞물려 있는지(앞 칸의 max === 다음 칸의 min)
    for (let i = 1; i < RUNGS.length; i++) {
      expect(RUNGS[i].min).toBe(RUNGS[i - 1].max)
    }
  })
})

describe('formatDuration — 0일이라고 쓰지 않는다', () => {
  it('하루 미만은 시간·분으로 내려간다', () => {
    // `2시간` 이어야 할 값을 `0일` 로 쓰면 학습자는 자기가 아무것도 못 했다고 읽는다.
    expect(formatDuration(0.069)).toBe('2시간')
    expect(formatDuration(0.5)).toBe('12시간')
    expect(formatDuration(0.0005)).toBe('1분')
  })

  it('아무리 작아도 0 이 나오지 않는다', () => {
    for (const s of [0.00001, 0.0001, 0.001]) {
      expect(formatDuration(s)).not.toMatch(/^0/)
    }
  })

  it('일·주·개월로 올라간다', () => {
    expect(formatDuration(1)).toBe('1일')
    expect(formatDuration(6)).toBe('6일')
    expect(formatDuration(7)).toBe('1주')
    expect(formatDuration(21)).toBe('3주')
    expect(formatDuration(30)).toBe('1개월')
    expect(formatDuration(90)).toBe('3개월')
  })
})
