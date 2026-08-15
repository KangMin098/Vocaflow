// apps/web/src/components/dashboard/__tests__/growth-empty-states.test.tsx
//
// Growth 카드 4종이 **아무것도 없는 학습자**에게 무엇을 보여주는가.
//
// 이 스펙이 필요한 이유:
//   이번 재설계의 출발점 자체가 "히어로가 0을 띄웠다" 였다. 그런데 0을 없앤 방식이
//   **데이터가 있는 계정에서만** 검증됐다(실측 계정은 단어 252개 보유). 신규 학습자는
//   그 화면을 한 번도 안 본 채로 배포될 뻔했고, 신규 상태야말로 "0 나열" 이 가장
//   쉽게 되살아나는 자리다.
//
//   ADR 0006 D2 의 규칙을 그대로 적용한다: **0 은 숫자가 아니라 문장이다.**
//
// dev 서버 없이 돈다 — `.next` 캐시가 깨져 있어도(멀티 세션 함정) 이 검증은 산다.

import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { Ladder, Reach, RescuedWords as RescuedWordsData, TraceDay } from '@/lib/learner/growth-math'

import { ActivityTrace } from '../ActivityTrace'
import { DurabilityLadder } from '../DurabilityLadder'
import { LexicalReach } from '../LexicalReach'
import { RescuedWords } from '../RescuedWords'

const EMPTY_LADDER: Ladder = {
  counts: { day: 0, few: 0, week: 0, month: 0, season: 0 },
  unseen: 0,
  onLadder: 0,
  medianDays: null,
  topDays: null,
}

/** 28일 전부 무활동. */
function emptyDays(): TraceDay[] {
  return Array.from({ length: 28 }, (_, i) => ({
    date: `2026-08-${String(i + 1).padStart(2, '0')}`,
    reviews: 0,
    words: 0,
  }))
}

describe('DurabilityLadder — 사다리가 비었을 때', () => {
  it('숫자를 나열하지 않고 문장으로 답한다', () => {
    const html = renderToString(<DurabilityLadder ladder={EMPTY_LADDER} />)
    expect(html).toContain('단어를 담으면')
    // 빈 사다리에 0을 다섯 개 늘어놓지 않는다 — 그게 이전 히어로의 실패였다.
    expect(html).not.toContain('하루')
    expect(html).not.toContain('계절')
  })

  it('담아 둔 단어는 있고 복습만 없으면, 다음 한 걸음을 말한다', () => {
    const html = renderToString(
      <DurabilityLadder ladder={{ ...EMPTY_LADDER, unseen: 117 }} />,
    )
    expect(html).toContain('117')
    expect(html).toContain('한 번 복습하면')
  })

  it('사다리에 하나라도 있으면 중앙값을 0일이 아니라 시간으로 쓴다', () => {
    const html = renderToString(
      <DurabilityLadder
        ladder={{
          counts: { day: 1, few: 0, week: 0, month: 0, season: 0 },
          unseen: 0,
          onLadder: 1,
          medianDays: 0.069,
          topDays: 0.069,
        }}
      />,
    )
    expect(html).toContain('2시간')
    expect(html).not.toMatch(/>0일</)
  })
})

describe('RescuedWords — 이번 주에 아무것도 못 했을 때', () => {
  it('0 을 크게 쓰지 않고 문장 + 다음 행동을 준다', () => {
    const empty: RescuedWordsData = { count: 0, sample: [] }
    const html = renderToString(<RescuedWords rescued={empty} />)
    expect(html).toContain('아직 다시 만난 단어가 없어요')
    expect(html).toContain('복습 열기')
    expect(html).not.toContain('개를 다시 만나 맞혔어요')
  })

  it('있으면 개수와 **실물 단어**를 함께 그린다 (개수만 그리지 않는다)', () => {
    const html = renderToString(
      <RescuedWords
        rescued={{ count: 36, sample: [{ word: 'resilient', meaning: '회복력 있는' }] }}
      />,
    )
    expect(html).toContain('36')
    expect(html).toContain('resilient')
    expect(html).toContain('회복력 있는')
  })
})

describe('ActivityTrace — 기록이 없을 때', () => {
  it('연속일 배지를 그리지 않는다 (0일 연속은 압박이다)', () => {
    const html = renderToString(
      <ActivityTrace days={emptyDays()} streak={0} activeDays={0} />,
    )
    expect(html).not.toContain('일 연속')
  })

  it('요일 리듬은 근거가 없으면 그리지 않는다', () => {
    const html = renderToString(
      <ActivityTrace days={emptyDays()} streak={0} activeDays={0} />,
    )
    expect(html).not.toContain('하는 편이에요')
  })

  it('분(minutes)을 절대 인쇄하지 않는다 — 기록되지 않는 값이다', () => {
    const days = emptyDays()
    days[27] = { date: '2026-08-28', reviews: 120, words: 86 }
    const html = renderToString(<ActivityTrace days={days} streak={1} activeDays={1} />)
    expect(html).toContain('120건')
    // "시간 1분 · 단어 301개"(1분에 301단어)를 인쇄하던 자리다. 분 표기가 되살아나면 잡는다.
    expect(html).not.toMatch(/>\s*\d+\s*분\s*</)
    expect(html).not.toContain('시간')
  })

  it('학습일을 `8/28일` 로 쓰지 않는다 (8월 28일로 읽힌다)', () => {
    const days = emptyDays()
    days[27] = { date: '2026-08-28', reviews: 5, words: 3 }
    const html = renderToString(<ActivityTrace days={days} streak={1} activeDays={1} />)
    expect(html).toContain('28일 중 1일')
    expect(html).not.toContain('1/28일')
  })
})

describe('LexicalReach — 순위를 아는 단어가 없을 때', () => {
  it('빈 카드를 남기지 않고 스스로 사라진다', () => {
    const empty: Reach = { bands: [], ranked: 0, medianRank: null }
    expect(renderToString(<LexicalReach reach={empty} />)).toBe('')
  })
})
