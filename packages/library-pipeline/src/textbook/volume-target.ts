// packages/library-pipeline/src/textbook/volume-target.ts
//
// **어느 권을 찍는가 — 카탈로그가 정의한 것만 찍는다.**
//
// ── 왜 이 파일이 생겼나 (실측 2026-09-12) ────────────────────────────
// 조판기는 시리즈를 이렇게 골랐다:
//
//     const seriesDef = SERIES_CATALOG.find((x) => x.id === SERIES) ?? SERIES_CATALOG[0]
//
// `?? SERIES_CATALOG[0]` 이 독해다. 그래서 `--series readng` 처럼 **오타를 내면**:
//   · 내용은 **독해 책**이 나오고
//   · 조판 기록은 `series: 'readng'`(존재하지 않는 시리즈)으로 남는다
// 카탈로그에는 그 행이 어디에도 안 보이고, 진짜 독해 행은 낡은 채로 남는다. 아무 오류도 없다.
//
// 같은 모양의 두 번째 구멍: 그 시리즈에 **없는 단**을 지정하면(`--series vocab --band 1` —
// 어휘 시리즈는 V2 부터다) `rung` 이 `null` 이 되고, 풀을 좁히지 않은 채(`volume-pool.mjs`
// 의 `seriesRungOf` 가 null 을 돌려준다) 제목만 `Vocaflow Vocab V1` 로 찍힌다.
// **그 시리즈가 정의한 적 없는 책이 나온다.**
//
// 카탈로그 도움말은 이미 이 위험을 적고 있었다 — 「새 시리즈를 찍을 때 `--series` 를 빼면
// 기본값 reading 으로 기록돼 같은 일이 난다」. 경고는 있었고 **막는 코드가 없었다.**
//
// 순수 함수다. 부르는 쪽이 멈출지 결정한다 — 여기서 `process.exit` 를 하면 테스트가 죽는다.

import { SERIES_CATALOG, type SeriesDef, type SeriesId } from './series-catalog'
import type { SeriesRung } from './series'

export type VolumeTarget =
  | { ok: true; series: SeriesDef; rung: SeriesRung }
  | {
      ok: false
      /** 왜 못 찍는가 — 터미널이 이 문장을 그대로 찍는다. */
      reason: string
      /** 쓸 수 있는 시리즈 id. 오타를 냈을 때 바로 고칠 수 있게 함께 준다. */
      validSeries: SeriesId[]
      /** 시리즈는 맞고 단이 틀렸을 때, 그 시리즈가 덮는 V-Level. */
      validBands?: number[]
    }

/**
 * (시리즈, 단)이 카탈로그에 실제로 있는지 판정한다.
 *
 * ⚠️ **기본값으로 때우지 않는다.** 이 함수가 존재하는 이유가 그것이다 — 모르는 것을 아는
 *   것으로 바꿔치기하면, 나오는 책과 남는 기록이 서로 다른 것을 말한다.
 */
export function resolveVolumeTarget(
  seriesId: string,
  band: number,
  catalog: readonly SeriesDef[] = SERIES_CATALOG,
): VolumeTarget {
  const validSeries = catalog.map((s) => s.id)
  const series = catalog.find((s) => s.id === seriesId)
  if (!series) {
    return {
      ok: false,
      reason: `그런 시리즈가 없다: 「${seriesId}」`,
      validSeries,
    }
  }
  const rung = series.rungs.find((r) => r.vLevels.includes(band))
  if (!rung) {
    return {
      ok: false,
      reason: `${series.brand} 에는 V${band} 단이 없다`,
      validSeries,
      validBands: [...new Set(series.rungs.flatMap((r) => r.vLevels))].sort((a, b) => a - b),
    }
  }
  return { ok: true, series, rung }
}

/** 터미널에 찍을 거절문 — **고칠 수 있는 정보를 함께 준다.** */
export function formatVolumeTarget(t: Extract<VolumeTarget, { ok: false }>): string[] {
  const out = [`⛔ ${t.reason}`]
  if (t.validBands) out.push(`   그 시리즈의 단: ${t.validBands.map((b) => `V${b}`).join(' · ')}`)
  else out.push(`   쓸 수 있는 시리즈: ${t.validSeries.join(' · ')}`)
  return out
}
