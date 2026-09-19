// apps/web/src/lib/csat/plan-timeline.ts
//
// **「시간이 몇 번에서 바닥나는가」 — 순수 모델.**
//
// ── 왜 필요한가 ───────────────────────────────────────────────────────
// 계획 화면은 이미 「절차 시간 합 51분 · 쓸 수 있는 시간 45분」을 적고 있었다. 맞는 말인데
// **학습자가 할 수 있는 일이 없다.** 6분이 모자란다는 것까지는 알겠는데, 그래서 어느 번호에서
// 손이 멈추는지, 무엇을 줄여야 하는지는 두 숫자로는 안 보인다.
//
// 띠로 그리면 보인다 — 18번부터 쌓아 올려 45분 선을 **어디서 넘는지** 한 자리로 찍힌다.
// 그리고 학습자마다 읽는 속도가 다르므로 배율을 쥐여 준다: 1.2배로 읽으면 선이 어디로 옮겨
// 가는지가 **그 자리에서** 바뀐다(I3 — 값을 바꾸면 결과가 바뀐다).
//
// ⚠️ 판단을 화면에 두지 않는다. 이 저장소는 컴포넌트를 `renderToString` 으로만 검사하므로
//    (`PassageMap` 과 같은 이유) 계산이 컴포넌트 안에 있으면 검사할 길이 없어진다.
//
// ⚠️ **`server-only` 를 들이지 않는다** — 배율 컨트롤이 클라이언트에서 이 함수를 다시 부른다.

export interface TimelineRow {
  no: number
  type_id: string
  type_name: string
  points: number | null
  time_budget_sec: number | null
  ready: boolean
}

export interface TimelineSeg extends TimelineRow {
  /** 배율을 먹인 이 문항의 시간(초). 절차가 없으면 0 — 그 사실은 따로 센다. */
  sec: number
  /** 시작·끝 누적 시간(초) */
  start: number
  end: number
  /** 이 문항이 끝나는 시점이 쓸 수 있는 시간을 넘었나 */
  over: boolean
}

export interface Timeline {
  segs: TimelineSeg[]
  /** 배율을 먹인 합계(초) */
  total: number
  available: number
  /** 시간이 바닥나는 첫 문항 번호. 안 넘으면 null */
  breaksAt: number | null
  /** 넘는 양(초). 안 넘으면 0 */
  overflow: number
  /** 남는 양(초). 넘으면 0 */
  slack: number
  /** 절차가 아직 없는 문항 수 — **합계가 과소평가돼 있다**는 뜻이라 화면이 말해야 한다 */
  unknown: number
  /** 절차가 없는 문항에 쓸 수 있는 1문항당 평균(초). 0 이면 이미 넘었다 */
  perUnknown: number
}

/** 배율의 허용 범위 — 밖은 의미가 없다(0.5배면 90분, 2배면 22분이다). */
export const SPEED_MIN = 0.7
export const SPEED_MAX = 1.5

export function clampSpeed(s: number): number {
  if (!Number.isFinite(s)) return 1
  return Math.min(SPEED_MAX, Math.max(SPEED_MIN, s))
}

/**
 * 번호 순서대로 시간을 쌓는다.
 *
 * `speed` 는 **읽는 속도**다 — 1.2 면 20% 빨리 읽으므로 걸리는 시간은 1/1.2 다.
 * (배율을 시간에 곱하면 "빠르게" 를 골랐는데 시간이 늘어난다. 실제로 한 번 뒤집어 썼다.)
 */
export function buildTimeline(rows: TimelineRow[], availableSec: number, speed = 1): Timeline {
  const k = 1 / clampSpeed(speed)
  const sorted = [...rows].sort((a, b) => a.no - b.no)

  let cursor = 0
  const segs: TimelineSeg[] = sorted.map((r) => {
    const sec = r.time_budget_sec ? Math.round(r.time_budget_sec * k) : 0
    const start = cursor
    cursor += sec
    return { ...r, sec, start, end: cursor, over: cursor > availableSec }
  })

  const total = cursor
  const first = segs.find((s) => s.over && s.sec > 0)
  const unknown = segs.filter((s) => s.sec === 0).length
  const slack = Math.max(0, availableSec - total)

  return {
    segs,
    total,
    available: availableSec,
    breaksAt: first?.no ?? null,
    overflow: Math.max(0, total - availableSec),
    slack,
    unknown,
    // 절차가 없는 문항이 남은 시간을 나눠 갖는다면 한 문항에 몇 초인가 —
    // 「아직 준비 중」을 그냥 0 으로 세면 합계가 실제보다 낙관적이라는 사실이 가려진다.
    perUnknown: unknown > 0 ? Math.floor(slack / unknown) : 0,
  }
}

/** `93` → `1분 33초`. 0 은 「—」. */
export function mmss(sec: number): string {
  if (!sec) return '—'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  if (!m) return `${s}초`
  return s ? `${m}분 ${s}초` : `${m}분`
}
