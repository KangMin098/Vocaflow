// apps/web/src/lib/textbook/shelf-stage.ts
//
// 서가의 **1차 진열 단위** — 초등 / 중등 / 고등 매대.
//
// ⚠️ `server-only`/`react.cache` 금지 — 클라이언트 컴포넌트와 vitest 가 함께 쓴다.
//
// ── 왜 나누는가 ─────────────────────────────────────────────────────────
// 시중 교재 코너는 책을 한 줄로 세우지 않는다. **매대를 먼저 나누고** 그 안에서 계단을 세운다.
// 학부모·교사가 찾는 순서가 "초등 → 그중 몇 학년" 이지 "1번 권 → 2번 권" 이 아니기 때문이다.
// 일곱 권을 평평하게 늘어놓으면 고1 학습자가 초등 두 권을 지나쳐야 자기 자리에 닿는다.
//
// ── 왜 문자열에서 유추하지 않고 표로 적는가 ──────────────────────────────
// `schoolBand` 는 학습자가 읽는 라벨이라 언제든 바뀔 수 있다('고1' → '고등 1학년').
// 접두사로 유추하면 그때 조용히 오분류된다 — 권이 사라지지 않고 **엉뚱한 매대에 꽂힌다**.
// 그래서 매핑을 명시하고, `SERIES_SPINE` 의 모든 밴드가 표에 있는지 테스트가 강제한다.

import type { ShelfVolume } from './shelf'

export type SchoolStage = 'elementary' | 'middle' | 'high'

/** 매대 순서 = 난이도 순서. 이 배열이 진열 순서의 정본이다. */
export const STAGE_ORDER: readonly SchoolStage[] = ['elementary', 'middle', 'high']

export const STAGE_LABEL: Record<SchoolStage, string> = {
  elementary: '초등',
  middle: '중등',
  high: '고등',
}

/** 매대가 무엇을 시키는 곳인지 — 라벨이 말하지 않는 것만 적는다. */
export const STAGE_SAYS: Record<SchoolStage, string> = {
  // ⚠️ "문장을 통째로 다루지 않습니다" 였다 — **틀렸다**(실측 2026-08-22).
  //    step 2(초등 고학년)에 `word_order`(영작 배열)가 있고, `SERIES_SPINE` 스스로
  //    "영작 배열이 **첫 문장 단위 과제**" 라고 적어 두었다. 매대 팻말이 사다리와 어긋났다.
  elementary: '소리와 낱말에서 시작해 첫 문장까지',
  middle: '문장 단위로. 어휘와 어법을 같이 봅니다',
  high: '글 전체를 봅니다. 순서·삽입처럼 글의 짜임을 다루는 유형이 들어옵니다',
}

/**
 * `schoolBand` → 매대.
 *
 * ⚠️ 새 계단을 추가하면 **여기에도 적어야 한다.** 안 적으면 테스트가 실패한다 —
 *    조용히 엉뚱한 매대에 꽂히는 것보다 낫다.
 */
const BAND_STAGE: Record<string, SchoolStage> = {
  '초등 저학년': 'elementary',
  '초등 고학년': 'elementary',
  '중학 1-2학년': 'middle',
  '중학 3학년': 'middle',
  고1: 'high',
  고2: 'high',
  '고3 / 수능 상위': 'high',
}

/** 모르는 밴드는 `null` — 화면이 그 사실을 알고 처리한다(추측해서 꽂지 않는다). */
export function stageOf(schoolBand: string): SchoolStage | null {
  return BAND_STAGE[schoolBand] ?? null
}

export interface StageGroup {
  stage: SchoolStage | null
  label: string
  says: string
  volumes: ShelfVolume[]
}

/**
 * 권들 → 매대별 묶음.
 *
 * 빈 매대는 내지 않는다 — 필터를 걸어 초등만 남았는데 '중등'·'고등' 팻말이 서 있으면
 * 그 화면은 없는 칸을 팔고 있는 것이다(`shelf-filter` 가 축 값을 재고에서 뽑는 것과 같은 이유).
 *
 * 표에 없는 밴드는 **버리지 않고** 마지막에 자기 이름으로 모은다 — 사다리에 새 계단이
 * 생겼는데 매핑을 안 적었을 때, 권이 화면에서 사라지는 것이 가장 나쁘다.
 */
export function groupByStage(volumes: readonly ShelfVolume[]): StageGroup[] {
  const groups: StageGroup[] = []

  for (const stage of STAGE_ORDER) {
    const members = volumes.filter((v) => stageOf(v.schoolBand) === stage)
    if (members.length > 0) {
      groups.push({
        stage,
        label: STAGE_LABEL[stage],
        says: STAGE_SAYS[stage],
        volumes: members,
      })
    }
  }

  const unmapped = volumes.filter((v) => stageOf(v.schoolBand) === null)
  for (const v of unmapped) {
    const existing = groups.find((g) => g.stage === null && g.label === v.schoolBand)
    if (existing) existing.volumes.push(v)
    else groups.push({ stage: null, label: v.schoolBand, says: '', volumes: [v] })
  }

  return groups
}

export interface Neighbors {
  /** 한 계단 아래 — 이 권이 어려울 때 갈 곳 */
  prev: ShelfVolume | null
  /** 한 계단 위 — 이 권이 쉬울 때 갈 곳 */
  next: ShelfVolume | null
}

/**
 * 한 권의 **앞뒤 권**.
 *
 * ── 왜 상세 화면에 필요한가 ───────────────────────────────────────────
 * 실제 교재의 뒤표지에는 시리즈 전체가 그려져 있고 이 권이 어디쯤인지 표시돼 있다.
 * 서점에서 책을 집은 사람이 가장 먼저 하는 판단이 **"나한테 맞나"** 이고, 안 맞으면
 * 바로 옆 권으로 손이 가기 때문이다. 지금 화면은 그때 서가로 되돌아가게 만든다 —
 * 되돌아간 사람은 대개 안 돌아온다.
 *
 * ⚠️ 배열 인덱스가 아니라 **step 순서**로 찾는다. 필터링된 목록을 넘겨도 맞아야 하고,
 *    사다리에 계단이 빠져 있어도(가령 4가 없어도) 3 다음이 5 로 이어져야 한다.
 */
export function neighborsOf(volumes: readonly ShelfVolume[], step: number): Neighbors {
  const sorted = [...volumes].sort((a, b) => a.step - b.step)
  return {
    prev: [...sorted].reverse().find((v) => v.step < step) ?? null,
    next: sorted.find((v) => v.step > step) ?? null,
  }
}
