// packages/library-pipeline/src/textbook/publisher-index.ts
//
// **출판사별 우위 지수의 산술.**
//
// ── 왜 스크립트에서 떼어 냈는가 ─────────────────────────────────────
// 이 계산은 "우리가 시중 교재를 이겼다" 를 판정하는 자다. 자가 틀리면 못 이긴 것을
// 이겼다고 적게 되고, 그 잘못은 리포트를 읽는 사람에게는 보이지 않는다.
// `.mjs` 스크립트 안에 있으면 테스트가 닿지 않으므로 여기로 옮겨 회귀로 묶는다.
// (실제로 첫 구현이 A5 에서 표본 크기를 우위로 착각했다 — 3종뿐인 출판사에 3.571 이
//  나왔다. 그런 종류의 결함은 눈으로 읽어서 잡히지 않는다.)

/** 한 축의 판정 결과. `index` 가 `null` 이면 **못 잰 축**이다 — 0 이 아니다. */
export interface PublisherAxis {
  id: string
  /** 단위. `'%'` 는 비율 축(천장이 있다), `'종'` 은 개수 축(천장이 없다). */
  unit: string
  ours: number
  market: number
  index: number | null
  /** 못 잰 이유. 있으면 `index` 는 반드시 `null` 이다. */
  insufficient?: string
  ceiling?: number
}

/**
 * **Wilson 95% 신뢰구간.**
 *
 * 정규근사(Wald)를 쓰지 않는 이유 — 표본이 작거나 비율이 0/1 에 가까우면 Wald 구간은
 * `[0,1]` 을 벗어나거나 폭이 0 이 된다. 출판사별로 쪼개면 그 두 경우가 실제로 생긴다
 * (쎄듀 3종 · 수경 1종).
 *
 * 기준선으로는 **상한**을 쓴다: 상대에게 가장 유리한 해석으로도 이겨야 우위로 친다.
 * 표본이 작으면 구간이 넓어져 저절로 이기기 어려워지므로, 근거 없는 "표본 N개 이상"
 * 문턱을 따로 둘 필요가 없다.
 */
export function wilson95(hits: number, n: number): { point: number; lo: number; hi: number; n: number } | null {
  if (!Number.isFinite(n) || n <= 0) return null
  if (hits < 0 || hits > n) return null
  const z = 1.959964
  const p = hits / n
  const d = 1 + (z * z) / n
  const c = p + (z * z) / (2 * n)
  const s = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))
  return {
    point: Number(p.toFixed(4)),
    lo: Number(Math.max(0, (c - s) / d).toFixed(4)),
    hi: Number(Math.min(1, (c + s) / d).toFixed(4)),
    n,
  }
}

/**
 * 기하평균. 비율의 평균은 기하평균이고, **한 축이 0 에 가까우면 종합도 끌려 내려가야**
 * 맞다(해설이 없는 교재는 다른 게 좋아도 교재가 아니다).
 *
 * 못 잰 축(`null`)과 0 이하는 뺀다 — 0 을 섞으면 로그가 발산하고, 무엇보다
 * **못 잰 것을 0점으로 세는 것은 없는 패배를 적는 일**이다.
 */
export function geoMean(xs: readonly (number | null)[]): number | null {
  const live = xs.filter((x): x is number => x != null && x > 0)
  if (!live.length) return null
  return Number(Math.exp(live.reduce((a, x) => a + Math.log(x), 0) / live.length).toFixed(3))
}

/**
 * **한 축의 천장.** 비율 축의 지수는 `우리/시장` 이고 우리 값은 100% 를 넘을 수 없으므로
 * 천장은 `1/시장` 이다. 개수 축('종')에는 천장이 없다 — `null` 을 돌려준다.
 */
export function axisCeiling(axis: PublisherAxis): number | null {
  if (axis.unit !== '%') return null
  if (!(axis.market > 0)) return null
  return Number((1 / axis.market).toFixed(3))
}

/**
 * **잰 축만으로 도달 가능한 최대 지수.**
 *
 * 잰 축이 적을수록 천장이 낮아지고, 그래서 **목표가 산술적으로 불가능한 출판사**가 생긴다.
 * 실측 2026-08-31 — EBS 는 해설 문서가 코퍼스에 0건이라 A6·A7 두 축만 잴 수 있고,
 * 그 둘의 천장이 1.250 · 1.151 이라 최대치가 **1.199** 다. 목표 1.200 에 0.001 모자란다.
 * 이걸 모르면 닿을 수 없는 곳을 향해 사이클을 계속 돌게 된다 — 우리 파이프라인이 아니라
 * **코퍼스의 증거**가 막고 있는 것이다.
 *
 * 개수 축을 빼므로 이 값은 **보수적**이다(실제 천장은 이보다 높거나 같다).
 */
export function reachableMax(axes: readonly PublisherAxis[]): number | null {
  const ceils = axes
    .filter((a) => a.index != null)
    .map(axisCeiling)
    .filter((x): x is number => x != null)
  return geoMean(ceils)
}

/**
 * **구속 출판사** — "각 출판사를 120% 이긴다" 는 주장은 **가장 낮은 곳**에서 정해진다.
 * 못 잰 출판사(`overallIndex == null`)는 후보가 아니다. 이겼다고도, 졌다고도 적지 않는다.
 */
export function bindingPublisher<T extends { publisher: string; overallIndex: number | null }>(
  rows: readonly T[],
): T | null {
  const scored = rows.filter((r) => r.overallIndex != null)
  if (!scored.length) return null
  return scored.reduce((a, b) => ((b.overallIndex as number) < (a.overallIndex as number) ? b : a))
}

/**
 * **창고 모드에서 출판사별 A5(유형 다양성)를 잴 수 있는가.**
 *
 * 못 잰다. 창고 모드의 분모는 그 출판사에서 **발문이 검출된 유형 수**인데, 우리 분자는
 * 창고 전체의 유형 수(25종)다. 3종뿐인 쎄듀는 7종만 잡혀 3.571 이 나왔다 —
 * 우리가 3.5배 낫다는 뜻이 아니라 **그 출판사의 표본이 작다는 뜻**이다.
 * 책을 적게 낸 곳일수록 우리가 유리해지는 자는 자가 아니다.
 *
 * 올바른 비교는 **우리 한 권 대 그들 한 권**(`perDocument` 중앙값)이라 `--volume` 에서만
 * 성립한다. 합본(79종→16종)에서는 표본이 커서 이 왜곡이 눈에 띄지 않았다.
 */
export function canScoreTypeSpread(basis: string | null | undefined): boolean {
  return basis != null && basis !== '79종 합본'
}
