// packages/library-pipeline/src/textbook/type-spread.ts
//
// **유형 폭 — 사다리가 약속한 유형과 지면에 실제로 실린 유형을 견준다.**
//
// ── 왜 이 자가 따로 필요한가 (실측 2026-09-13) ───────────────────────
// `market-benchmark.mjs` 의 A5(유형 다양성)는 **창고**를 재거나, 권 모드에서도
// 출판사별로는 「못 잼」으로 빠진다(OCR 이 발문을 못 잡은 출판사가 3곳이다).
// 그래서 이 축은 리포트에서 늘 `—` 였고, **아무도 권당 유형 폭을 보지 않았다.**
//
// 그 사이에 벌어진 일을 조판 스냅샷에서 그대로 셌다:
//
//     사다리 선언      V5 19종 · V6 19종 · V7 19종
//     지면 실측        V5  4종 · V6  5종 · V7  5종
//     시중 고등 권당    중앙 9종 (30종 실측)
//
// **선언과 지면이 4배 넘게 벌어져 있었다.** 목차에는 19종이 적혀 있고 책에는 4종이 실린다.
// 이것은 재고 부족과 다른 결함이다 — `type-gap.mjs` 는 창고에 무엇이 모자란지를 재고,
// 이 자는 **창고에 있는데도 지면에 안 실린 것**을 잰다. 둘 다 필요하다.
//
// ⚠️⚠️ **「선언」과 「지면」은 서로 다른 시점에서 온다 — 이것을 안 밝히면 인과가 뒤집힌다.**
//   선언은 **지금 코드**(`SERIES_SPINE`)에서, 지면은 **조판 스냅샷**에서 읽는다. 스냅샷이
//   사다리보다 낡으면 그 차이는 결함이 아니라 **시차**다.
//
//   2026-09-13 에 실제로 그렇게 틀렸다. 「사다리가 19종을 선언해 놓고 지면에 4종만 실린다」고
//   적었는데, 스냅샷 시점(09-07)의 사다리를 git 에서 꺼내 보니 선언이 **4종**이었다 —
//   지면과 정확히 같았다. 19 는 그날 17:26 커밋이 넓힌 값이다. **조합기는 결백했고**
//   낡은 것은 스냅샷이었다. 그래서 이 자는 두 시각을 받아 `skew` 로 그 사실을 함께 낸다.
//
// ── 왜 「선언 대비」와 「시중 대비」를 함께 내는가 ────────────────────
// 하나만 내면 둘 다 틀리게 읽힌다. 선언 대비만 보면 사다리를 얇게 선언해 놓고 100% 가 되고,
// 시중 대비만 보면 사다리가 약속한 것을 안 지킨 사실이 안 보인다. 둘을 나란히 둔다.
//
// ⚠️ **못 잰 것은 통과가 아니다.** 시중 기준선이 없는 학교급은 `market: null` 이고
//   지수도 `null` 이다. 0 으로도 1 로도 뭉개지 않는다 — 이 저장소가 이미 겪은 거짓 초록이다.
//
// 순수 함수다 — DB 도 파일도 안 읽는다. 부르는 쪽이 스냅샷과 규격을 넣어 준다.

/** 시중 권당 유형 수 기준선의 학교급 — `market-spec.json` 의 `typeCoverage.perDocument.bySchool` 키. */
export type MarketSchool = '초등' | '중등' | '고등'

/**
 * 밴드 → 학교급.
 *
 * ⚠️ **눈금을 여기서 새로 만들지 않는다.** `level-chart.ts` 의 `V_TO_MARKET_BUCKET`
 *   (초6 · 중1 · 고1…)이 정본이고, 이 함수는 그 버킷의 앞 글자를 학교급으로 옮길 뿐이다.
 *   눈금이 둘이면 반드시 갈리고, 그 갈림은 두 리포트가 다른 학년을 말할 때 드러난다.
 */
export function schoolOfBucket(bucket: string | null | undefined): MarketSchool | null {
  if (!bucket) return null
  if (bucket.startsWith('초')) return '초등'
  if (bucket.startsWith('중')) return '중등'
  if (bucket.startsWith('고')) return '고등'
  return null
}

/** 그 권이 어떤 상태인가. */
export type SpreadState =
  /** 지면 유형 수가 시중 권당 중앙값 이상. */
  | 'ahead'
  /** 시중 중앙값 미만. */
  | 'behind'
  /** 시중 기준선이 없어 견줄 수 없다. */
  | 'unmeasured'

export interface VolumeTypeSpread {
  band: number
  schoolBand: string
  school: MarketSchool | null
  /** 사다리가 그 권에 쓰기로 **선언한** 유형 수. */
  declared: number
  /** 지면에 **실제로 실린** 유형 수. */
  printed: number
  /** 선언했는데 한 문항도 안 실린 유형. **여기가 할 일 목록이다.** */
  absent: string[]
  /** 선언에 없는데 실린 유형 — 사다리와 조합기가 어긋난 자국. */
  unexpected: string[]
  /** 시중 같은 학교급의 **권당** 유형 수 중앙값. 없으면 null. */
  market: number | null
  /** `printed / market`. `market` 이 null 이면 null — **못 쟀다는 뜻이다.** */
  index: number | null
  state: SpreadState
}

/** 한 권의 입력 — 조판 스냅샷과 사다리에서 온다. */
export interface VolumeSpreadInput {
  band: number
  schoolBand: string
  /** `V_TO_MARKET_BUCKET[band]` — 부르는 쪽이 정본 눈금에서 읽어 넣는다. */
  marketBucket: string | null
  /** 사다리(`SERIES_SPINE` 의 rung)가 선언한 유형. */
  declaredTypes: readonly string[]
  /** 지면 단원들이 실제로 쓴 유형 — 중복 포함으로 넣어도 된다. */
  printedTypes: readonly string[]
}

/** 시중 권당 유형 수 — `market-spec.json` 의 `typeCoverage.perDocument.bySchool[*].median`. */
export type MarketPerSchoolMedian = Partial<Record<MarketSchool, number>>

/**
 * 한 권을 잰다.
 *
 * ⚠️ `printedTypes` 가 비면 `printed: 0` 이다 — 이것은 **못 쟀다가 아니라 실제 0** 이다.
 *   조판 스냅샷은 그 권을 실제로 조합한 결과라, 비었다면 그 권에 실릴 것이 없었다는 뜻이다.
 */
export function measureVolumeSpread(
  v: VolumeSpreadInput,
  marketMedian: MarketPerSchoolMedian,
): VolumeTypeSpread {
  const declared = new Set(v.declaredTypes)
  const printed = new Set(v.printedTypes)
  const school = schoolOfBucket(v.marketBucket)
  const market = school ? marketMedian[school] ?? null : null
  const index = market != null && market > 0 ? printed.size / market : null
  return {
    band: v.band,
    schoolBand: v.schoolBand,
    school,
    declared: declared.size,
    printed: printed.size,
    absent: [...declared].filter((t) => !printed.has(t)).sort(),
    unexpected: [...printed].filter((t) => !declared.has(t)).sort(),
    market,
    index,
    state: index == null ? 'unmeasured' : index >= 1 ? 'ahead' : 'behind',
  }
}

/** 두 입력의 시각이 어긋났는가. **어긋난 채로 읽으면 조합기를 범인으로 지목하게 된다.** */
export interface SpreadSkew {
  /** 조판 스냅샷을 구운 시각. */
  printedAt: string
  /** 사다리(`SERIES_SPINE`)가 마지막으로 바뀐 시각. */
  declaredAt: string
  /** 스냅샷이 사다리보다 낡았다 — 선언·지면 차이를 결함으로 읽으면 안 된다. */
  stale: boolean
}

/**
 * 스냅샷이 사다리보다 낡았는가.
 *
 * ⚠️ 파싱 못 하는 값은 `null` 이다 — `false`(안 낡았다)로 뭉개면 시차가 조용히 숨는다.
 */
export function measureSkew(
  printedAt?: string | null,
  declaredAt?: string | null,
): SpreadSkew | null {
  if (!printedAt || !declaredAt) return null
  const p = Date.parse(printedAt)
  const d = Date.parse(declaredAt)
  if (Number.isNaN(p) || Number.isNaN(d)) return null
  return { printedAt, declaredAt, stale: p < d }
}

export interface SpreadReport {
  volumes: VolumeTypeSpread[]
  /** 시중 중앙값 이상인 권 수 / 견줄 수 있었던 권 수. */
  ahead: number
  behind: number
  unmeasured: number
  /** 선언했는데 어느 권에도 안 실린 유형 — 사다리 전체 기준. */
  absentEverywhere: string[]
  /** 견줄 수 있었던 권들의 지수 평균. 하나도 못 재면 null. */
  meanIndex: number | null
  /** 두 입력의 시각. 안 주면 null — **못 쟀다는 뜻이지 안 어긋났다는 뜻이 아니다.** */
  skew: SpreadSkew | null
}

export function measureSpread(
  volumes: readonly VolumeSpreadInput[],
  marketMedian: MarketPerSchoolMedian,
  at: { printedAt?: string | null; declaredAt?: string | null } = {},
): SpreadReport {
  const rows = volumes.map((v) => measureVolumeSpread(v, marketMedian))
  const scored = rows.filter((r) => r.index != null)
  const declaredAll = new Set<string>()
  const printedAll = new Set<string>()
  for (const v of volumes) {
    for (const t of v.declaredTypes) declaredAll.add(t)
    for (const t of v.printedTypes) printedAll.add(t)
  }
  return {
    volumes: rows,
    ahead: rows.filter((r) => r.state === 'ahead').length,
    behind: rows.filter((r) => r.state === 'behind').length,
    unmeasured: rows.filter((r) => r.state === 'unmeasured').length,
    absentEverywhere: [...declaredAll].filter((t) => !printedAll.has(t)).sort(),
    meanIndex: scored.length === 0 ? null : scored.reduce((a, r) => a + r.index!, 0) / scored.length,
    skew: measureSkew(at.printedAt, at.declaredAt),
  }
}
