// apps/web/src/lib/csat/map/distinguish.ts
//
// 구분 확인(2026-10-08) — 「먼저 확인」 1위를 믿을 수 없을 때(core RANKING_GATE: 사실상 동률 · 선 바로 아래 · 관측 적음)
// 두 후보 중 어느 쪽이 원인인지 **가르는 확인 활동 하나**. 학생에게는 행동 하나만 보인다(두 CTA 를 내지 않는다).
// 약점을 정하지 않는다 — 결과는 다음 확인 순서만 정한다. 기록 저장(과제 완료) 없음: 지도 과제(csat_map_task)가 아니다 —
// 저장이 필요해지면 과제 행을 따로 승인받아 더한다(DB 변경).
// 활동은 축 쌍마다 「하나만 바꿔 다시 풀기」 꼴이다 — 한 쪽 원인을 치우고도 틀리면 다른 쪽이다.

import type { CoreCode } from './core'

export interface DistinguishActivity {
  /** 두 축(순서 무관) */
  pair: readonly [CoreCode, CoreCode]
  /** 무엇을 하는가 — 학생 말, 순서대로 */
  how: readonly string[]
  /** 결과를 어떻게 읽는가 — 학생 말 */
  read: string
  /** 걸리는 시간 */
  time: string
}

const NAME: Record<CoreCode, string> = { V: '어휘·표현', S: '문장 이해', R: '문장 관계', E: '본문↔선지', L: '듣기', X: '시간 내 통합' }

export const DISTINGUISH: readonly DistinguishActivity[] = [
  {
    pair: ['V', 'S'],
    how: ['틀린 문항에서 막힌 문장 하나를 고른다.', '그 문장의 모르는 낱말 뜻을 먼저 확인한다.', '뜻을 안 채로 그 문장을 다시 해석한다.'],
    read: '뜻을 알고 나서 해석되면 어휘·표현, 뜻을 알아도 누가 무엇을 했는지 안 잡히면 문장 이해를 먼저 확인해요.',
    time: '오답 문항 2개, 10분',
  },
  {
    pair: ['V', 'R'],
    how: ['틀린 문항에서 모르는 낱말 뜻을 먼저 확인한다.', '뜻을 안 채로 같은 문항을 다시 푼다.'],
    read: '뜻을 알고 맞히면 어휘·표현, 뜻을 알아도 앞뒤 문장이 어떻게 이어지는지 안 잡히면 문장 관계를 먼저 확인해요.',
    time: '오답 문항 2개, 10분',
  },
  {
    pair: ['V', 'E'],
    how: ['틀린 문항의 모르는 낱말 뜻을 먼저 확인한다.', '지문 내용을 한 줄로 적은 뒤 선지를 다시 고른다.'],
    read: '뜻을 알고 맞히면 어휘·표현, 지문은 이해했는데 선지에서 또 틀리면 본문↔선지를 먼저 확인해요.',
    time: '오답 문항 2개, 10분',
  },
  {
    pair: ['S', 'R'],
    how: ['틀린 문항에서 답을 가른 두 문장을 고른다.', '한 문장씩 따로 해석한다.', '두 문장이 같은 말 · 반대 · 원인과 결과 중 무엇인지 고른다.'],
    read: '한 문장 해석부터 막히면 문장 이해, 문장마다 해석은 되는데 둘의 관계가 안 잡히면 문장 관계를 먼저 확인해요.',
    time: '오답 문항 2개, 10분',
  },
  {
    pair: ['S', 'E'],
    how: ['틀린 문항의 정답 근거 문장을 해석한다.', '해석한 뜻을 들고 선지를 다시 고른다.'],
    read: '근거 문장 해석이 막히면 문장 이해, 해석은 됐는데 선지에서 또 틀리면 본문↔선지를 먼저 확인해요.',
    time: '오답 문항 2개, 10분',
  },
  {
    pair: ['R', 'E'],
    how: ['틀린 문항의 지문 흐름을 한 줄로 요약한다.', '요약을 들고 선지를 다시 고른다.'],
    read: '요약이 안 되면 문장 관계, 요약은 되는데 선지와 이어지지 않으면 본문↔선지를 먼저 확인해요.',
    time: '오답 문항 2개, 10분',
  },
]

/** 시간 내 통합(X)과 다른 축 — 시간 제한 없이 다시 풀기로 가른다 */
const withTime = (other: CoreCode): DistinguishActivity => ({
  pair: ['X', other],
  how: ['틀린 문항을 시간 제한 없이 다시 푼다.', '다시 풀어도 틀리면 막힌 곳을 표시한다.'],
  read: `시간 없이 맞히면 시간 내 통합, 시간이 있어도 틀리면 ${NAME[other]}를 먼저 확인해요.`,
  time: '오답 문항 3개, 15분',
})

/** 두 축을 가르는 활동 — 없으면 null(듣기 L 은 읽기 축과 가르지 않는다) */
export function distinguishActivity(a: CoreCode, b: CoreCode): DistinguishActivity | null {
  if (a === b || a === 'L' || b === 'L') return null
  if (a === 'X') return withTime(b)
  if (b === 'X') return withTime(a)
  return DISTINGUISH.find((d) => (d.pair[0] === a && d.pair[1] === b) || (d.pair[0] === b && d.pair[1] === a)) ?? null
}

export const distinguishTitle = (a: CoreCode, b: CoreCode) => `${NAME[a]} 때문인지 ${NAME[b]} 때문인지 먼저 확인해 볼게요`
