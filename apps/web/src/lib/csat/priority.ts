// apps/web/src/lib/csat/priority.ts
//
// **④ 사정권 — 다음 시험에 무엇이 나올 자리인가.**
//
// ── 왜 「예측」이 아니라 「사정권」인가 ───────────────────────────────
// 처음 계획은 `csat_type_reports.open_questions` 를 「열린 질문」으로 펴는 것이었다.
// 실제로 읽어 보니 **그건 학습자 글이 아니다** — "모(母)청크의 관찰 ①", "body_ok:false",
// "파서 개선 시", "_PROMPT.md 의 라벨표" 처럼 우리 파이프라인 내부 어휘다(실측 2026-09-15:
// R-BLANK 59건 · R-ORDER 26건 전부 그 성격). 수험생에게 내면 못 읽고, 읽어도 쓸 데가 없다.
//
// 그래서 **지어내지 않고 셀 수 있는 것만** 쓴다: 출제 빈도의 시간 변화. 이것은 예언이
// 아니라 **산수**이고, 근거가 히트맵의 같은 숫자라 학습자가 직접 확인할 수 있다
// (CLAUDE.md I5 — 수치는 실측 또는 즉석 계산만).
//
// ⚠️ **「나온다」고 말하지 않는다.** 화면 문구는 늘 "최근 N개년 M문항" 이고, 등급은
//   그 수에서 나온 것이라고 적는다. 평가원의 다음 출제를 아는 사람은 없다.

import type { Heatmap, HeatRow } from './heatmap'
import { RECENT_FROM } from './heatmap'

/** 사정권 등급. A 가 가장 급하다. */
export type Band = 'A' | 'B' | 'C' | 'gone'

export interface PriorityRow {
  typeId: string
  name: string
  band: Band
  /** 최근 4개년 문항 수. */
  recent: number
  /** 전체 문항 수. */
  total: number
  /** 최근 4개년이 몇 해에 걸쳐 있나 — 「몰린 것」과 「꾸준한 것」을 가른다. */
  yearsSeen: number
  /** 최근 구간의 해당 연도 수(분모). */
  yearsRecent: number
  /** 3점 문항 수(전체). */
  hard: number
  /** 라벨이 말하지 않는 것 — 왜 이 등급인가. 화면이 그대로 쓴다. */
  why: string
}

/**
 * 등급 경계 — **근거 없는 임계값을 쓰지 않으려고 분포에서 정한다.**
 *
 * 실측 2026-09-15(최근 4개년 = 2023~, 회차 기준): 유형 26개의 최근 문항 수 분포는
 * 0 이 여러 개이고 나머지가 한 자리~수십으로 길게 퍼져 있다. 그래서 절대값으로 자르면
 * 회차가 늘 때마다 경계가 어긋난다. **상대 위치(최대값 대비)로 자른다** — 회차가 늘어도
 * 같은 뜻을 유지한다.
 */
export const BAND_CUT = { a: 0.5, b: 0.2 } as const

/**
 * 히트맵 → 사정권.
 *
 * ⚠️ **최근 출제가 0 이면 `gone`** 이고, 이것을 C 아래 등급으로 두지 않는다.
 *   "우선순위가 낮다" 와 "이제 안 나온다" 는 학습자에게 전혀 다른 지시다.
 *
 * ⚠️ **꾸준함을 함께 본다.** 같은 8문항이어도 4개년에 흩어진 것과 한 해에 몰린 것은 다르다.
 *   몰린 쪽은 그 해의 특수 사정일 수 있으므로 `why` 에 적어 학습자가 판단하게 한다
 *   (등급을 깎지는 않는다 — 셀 수 있는 것만 말하고 해석은 넘긴다).
 */
export function buildPriority(map: Pick<Heatmap, 'rows' | 'years'>): PriorityRow[] {
  const recentYears = map.years.filter((y) => y >= RECENT_FROM)
  const maxRecent = map.rows.reduce((m, r) => Math.max(m, r.recent), 0)

  const rows = map.rows.map<PriorityRow>((r: HeatRow) => {
    const seen = r.cells.filter((c) => c.year >= RECENT_FROM && c.n > 0).length
    const hard = r.cells.reduce((s, c) => s + c.hard, 0)
    const share = maxRecent > 0 ? r.recent / maxRecent : 0

    let band: Band
    if (r.recent === 0) band = 'gone'
    else if (share >= BAND_CUT.a) band = 'A'
    else if (share >= BAND_CUT.b) band = 'B'
    else band = 'C'

    const why =
      band === 'gone'
        ? `${RECENT_FROM}학년도 이후 출제 없음 — 전체로는 ${r.total}문항`
        : seen <= 1 && r.recent > 1
          ? `최근 ${recentYears.length}개년 중 한 해에 ${r.recent}문항이 몰려 있어요`
          : `최근 ${recentYears.length}개년 중 ${seen}개년에 걸쳐 ${r.recent}문항`

    return {
      typeId: r.typeId,
      name: r.name,
      band,
      recent: r.recent,
      total: r.total,
      yearsSeen: seen,
      yearsRecent: recentYears.length,
      hard,
      why,
    }
  })

  const order: Record<Band, number> = { A: 0, B: 1, C: 2, gone: 3 }
  return rows.sort(
    (a, b) => order[a.band] - order[b.band] || b.recent - a.recent || a.name.localeCompare(b.name, 'ko'),
  )
}

/**
 * 「최근」이 **몇 개 학년도인가** — 화면 문구가 이 값을 써야 한다.
 *
 * ⚠️ 하드코딩하지 않는다. `RECENT_FROM`(2023) 이후 회차가 실제로 몇 개 학년도인지는
 *   코퍼스에 달려 있다. 실측 2026-09-15 기준 2023~2027 로 **5개년**인데, 화면 문구에
 *   「최근 4개년」을 박아 두었더니 바로 아래 줄이 「최근 5개년 중 5개년에 걸쳐」라고
 *   말했다(스크린샷에서 잡혔다). 회차가 늘면 또 어긋나므로 세어서 쓴다.
 */
export const recentYearCount = (years: readonly number[]): number =>
  years.filter((y) => y >= RECENT_FROM).length

export const BAND_LABEL: Record<Band, string> = {
  A: '자주 나옴',
  B: '가끔 나옴',
  C: '드물게 나옴',
  gone: '요즘 안 나옴',
}

/** 등급별 한 줄 — 라벨이 말하지 않는 것. */
export const BAND_SAYS: Record<Band, string> = {
  A: '최근 출제가 가장 많은 무리예요. 시간을 여기에 먼저 씁니다',
  B: '꾸준히 나오지만 A보다는 적어요',
  C: '최근 출제가 적어요. A·B를 끝낸 뒤에 봅니다',
  gone: `${RECENT_FROM}학년도 이후로는 나오지 않았어요. 기출 연습용으로만 봅니다`,
}
