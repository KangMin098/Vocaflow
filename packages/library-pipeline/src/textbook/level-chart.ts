// packages/library-pipeline/src/textbook/level-chart.ts
//
// **교재 레벨 차트** — 계단마다 지문이 얼마나 긴지를 시장 규격 위에 겹쳐 그린다.
//
// ── 왜 필요한가 ────────────────────────────────────────────────────
// 상업 교재 카탈로그가 빠짐없이 내는 것이 '교재 레벨 차트' 다(NE_Books 관측 2026-08-30).
// 교재 구매의 첫 질문이 "우리 애가 몇 단계인가" 이기 때문이다. 우리 매대에는 그게 **없었다** —
// 매대 지수 C5 축이 0/1 이었다(`scripts/textbook/catalog-benchmark.mjs`).
//
// ── 저쪽 차트와 다른 점 ────────────────────────────────────────────
// 상업 사이트의 레벨 차트는 **그림 한 장**이다 — 출판사가 자기 시리즈를 자기 기준으로 배치한 것이라
// 검증할 방법이 없다. 여기 것은 두 실측을 겹친다:
//   ① **시장 규격** — 시중 교재 79종 5,214쪽에서 잰 학년대별 지문 어수 분포(`market-spec.json`)
//   ② **우리 재고** — 그 계단에 실제로 있는 문항 수
// 그래서 "우리 고1 권의 지문은 시중 고1 교재의 47~242어 구간 안에 있다" 를 **숫자로** 말한다.
//
// ⚠️ 규격을 **지어내지 않는다.** 시장 표본이 얇은 버킷은 이웃에서 빌려 오고, 빌려 왔다는 사실을
//    `borrowedFrom` 으로 남긴다. 없는 규격을 있는 척하는 것보다 어디서 빌렸는지 적는 편이 낫다.
// ⚠️ 지문이 없는 계단(초등 소리·낱말)은 `words: null` 이다. 0 으로 적으면 차트가
//    "지문이 0어" 라는 거짓을 그린다 — 지문을 안 쓰는 것과 지문이 짧은 것은 다르다.

import spec from './market-spec.json'

/**
 * V-Level → 시장 규격 버킷.
 *
 * ⚠️ 이 표는 `scripts/textbook/market-benchmark.mjs` 의 `V_TO_BUCKET` 과 **같은 내용**이다.
 *    그쪽은 .mjs 라 이 모듈을 import 할 수 없어 부득이 두 벌이다. 한쪽을 고치면 반드시
 *    다른 쪽도 고칠 것 — 갈리면 같은 교재가 두 자로 재진다.
 *    (`market-spec.json` 은 생성물이라 이 표를 거기 넣을 수 없다 — 다음 생성에 덮어써진다.)
 */
export const V_TO_MARKET_BUCKET: Record<number, string> = {
  1: '초6',
  2: '초6',
  3: '중1',
  4: '중1',
  5: '고1',
  6: '고2',
  7: '고2',
  8: '고2',
  9: '고2',
}

/** 표본이 얇아 이웃에서 빌려 온 버킷 — 화면에 그대로 밝힌다. */
const BORROWED: Record<string, string> = {
  초6: '초등 표본(초6)',
  중1: '중등 표본(중1-2)',
}

/** 차트가 필요로 하는 최소한의 권 정보. 웹의 `ShelfVolume` 이 이 모양을 만족한다. */
export interface LevelChartVolume {
  step: number
  title: string
  schoolBand: string
  vLevels: number[]
  itemCount: number
  status: string
}

export interface LevelChartRow {
  step: number
  title: string
  schoolBand: string
  vLevels: number[]
  itemCount: number
  ready: boolean
  /** 시장 규격 버킷 이름. 규격을 못 찾으면 null. */
  bucket: string | null
  /** 이웃 버킷에서 빌려 왔다면 그 사실 */
  borrowedFrom: string | null
  /**
   * 시중 교재의 지문 어수 분포. **지문을 쓰지 않는 계단은 null.**
   * 0 으로 적으면 차트가 "지문이 0어" 라는 거짓을 그린다.
   */
  words: { p10: number; median: number; p90: number } | null
}

export interface LevelChart {
  rows: LevelChartRow[]
  /** 막대를 그릴 공통 축 — 모든 행이 같은 자를 써야 계단이 비교된다. */
  scale: { min: number; max: number }
  provenance: {
    documentsMeasured: number
    pagesMeasured: number
    generatedAt: string
  }
}

export function buildLevelChart(volumes: readonly LevelChartVolume[]): LevelChart {
  const rows: LevelChartRow[] = volumes.map((v) => {
    // 한 권이 V레벨 여럿을 쓰면 **가장 낮은 레벨**의 버킷을 쓴다 — 학습자가 진입하는 자리가 거기다.
    const lead = Math.min(...v.vLevels)
    const bucket = V_TO_MARKET_BUCKET[lead] ?? null
    const s = bucket
      ? (spec.passageWords as Record<string, { words: Record<string, number | undefined> } | undefined>)[bucket]
      : null

    // ⚠️ 규격이 **세 값을 다 갖췄을 때만** 막대를 그린다. 하나라도 없으면 `null` 이다 —
    //    빠진 값을 0 이나 NaN 으로 채우면 차트가 조용히 거짓 막대를 그린다(폭 0, 또는 폭 NaN).
    //    `market-spec.json` 은 생성물이라 버킷 구성이 다음 생성에 바뀔 수 있고, 그때
    //    화면이 죽는 대신 그 행만 "규격 없음" 으로 빠지는 편이 안전하다.
    const p10 = s?.words.p10
    const median = s?.words.median
    const p90 = s?.words.p90
    const words =
      p10 != null && median != null && p90 != null ? { p10, median, p90 } : null

    return {
      step: v.step,
      title: v.title,
      schoolBand: v.schoolBand,
      vLevels: v.vLevels,
      itemCount: v.itemCount,
      ready: v.status === 'ready',
      bucket,
      borrowedFrom: bucket ? (BORROWED[bucket] ?? null) : null,
      words,
    }
  })

  // 축은 실제로 그릴 값에서만 뽑는다 — 규격 없는 행을 0 으로 끌어들이면 축이 망가진다.
  const drawn = rows.filter((r) => r.words != null).map((r) => r.words!)
  const scale = drawn.length
    ? { min: 0, max: Math.max(...drawn.map((w) => w.p90)) }
    : { min: 0, max: 1 }

  return {
    rows,
    scale,
    provenance: {
      documentsMeasured: spec.provenance.documentsMeasured,
      pagesMeasured: spec.provenance.pagesMeasured,
      generatedAt: spec.generatedAt,
    },
  }
}

/**
 * "우리 아이는 몇 학년" → 어느 권.
 *
 * ⚠️ 학년 문자열을 **부분 일치**로 찾지 않는다 — '중1' 이 '중1-2' 와 '고1' 양쪽에 걸린다.
 *    계단이 소유한 `schoolBand` 를 그대로 목록으로 내고 고르게 한다. 자유 입력을 추측으로
 *    해석하는 것보다, 있는 계단을 보여 주고 고르게 하는 편이 틀리지 않는다.
 */
export function findStepForBand(
  volumes: readonly LevelChartVolume[],
  schoolBand: string,
): LevelChartVolume | null {
  return volumes.find((v) => v.schoolBand === schoolBand) ?? null
}
