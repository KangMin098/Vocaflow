// packages/library-pipeline/src/textbook/freedom.ts
//
// **자유도 — "아무 유형으로나 교재를 낼 수 있는가".**
//
// ── 왜 이 잣대가 없으면 콘솔이 거짓말을 하나 (실측 2026-09-15) ───────
// 교재 공장 현황판은 밴드마다 **60문항 한 권**을 재고 7/7 초록을 띄운다
// (`production-stages.ts` · 스냅샷 실측 전 밴드 renderable 60/60 · explained 60/60).
// 그 판정은 맞다 — 다만 **"한 권을 낼 수 있는가"** 에만 맞다.
//
// 같은 날 재고를 유형별로 세어 보면 다른 세상이 나온다:
//
//   V7(고3/수능)  총 229,608문항인데 — long_reference **4** · mood **8** · claim 13 ·
//                 implication 13 · main_point 21 · purpose 23 · summary 27 · title 36 ·
//                 content_match 43 · topic 50 · **blank 71**
//   V2            long_reference **3** · irrelevant 27 · content_match 28
//
// 재고 65만이 기계 변환형(blank_word 92,956 · grammar_fix 56,565 · unit_vocab 53,350)에
// 몰려 있고, **시장이 교재를 고르는 기준인 이해·추론형은 두 자리**다. 그래서 V2·V7 은
// 서로 겹치지 않는 권을 **딱 하나**밖에 못 낸다(`type-inventory-snapshot` volumes=1).
//
// 현황판은 이것을 구조적으로 못 본다 — 한 권만 보기 때문이다. 한 권이 초록이면
// 두 권째가 불가능해도 초록이다. **이 파일이 그 사각을 잰다.**
//
// ── 두 가지 자유를 가른다 ───────────────────────────────────────────
//   · **단일유형 자유도** — "고3 빈칸추론 30문항 특강" 을 낼 수 있는가.
//     시중이 실제로 파는 모양이고(유형별 특강), 한 유형 재고만 본다.
//   · **혼합권 자유도** — 배합을 지킨 60문항 권을 **겹치지 않게** 몇 권 낼 수 있는가.
//     배합의 어느 한 유형이 마르면 거기서 멈춘다 — 그 유형이 `binding` 이다.
//
// ⚠️ **못 잰 것을 0 으로 적지 않는다.** `items: null` 은 판정 불가고, 그때 그 칸은
//   가능도 불가능도 아니다. 0 으로 뭉개면 관리자가 없는 구멍을 메우러 간다
//   (이 저장소가 `count ?? 0` 으로 이미 한 번 당한 함정).

/** 한 (밴드 × 유형) 칸의 재고. `items` 가 `null` 이면 **못 쟀다** — 0 이 아니다. */
export interface FreedomCell {
  type: string
  items: number | null
  /** 이 유형이 혼합권 한 권에 몇 문항 들어가는가. 배합에 없으면 0. */
  needPerVolume?: number
}

/** 한 칸의 단일유형 판정. */
export interface SoloVerdict {
  type: string
  items: number | null
  /** 이 크기의 특강을 낼 수 있는가. 못 쟀으면 `null`. */
  ok: boolean | null
  /** 겹치지 않게 몇 권까지. 못 쟀으면 `null`. */
  volumes: number | null
  /** 가능해지려면 몇 문항 더 필요한가. 이미 되면 0, 못 쟀으면 `null`. */
  short: number | null
}

/**
 * **단일유형 특강 자유도** — 유형 하나만으로 `size` 문항 교재를 낼 수 있는가.
 *
 * @param size 특강 한 권의 문항 수. 시중 유형별 특강은 20~40 대가 흔하므로 호출부가 정한다 —
 *             여기서 기본값을 박으면 그 숫자가 근거 없이 기준이 된다.
 */
export function soloFreedom(cells: readonly FreedomCell[], size: number): SoloVerdict[] {
  if (size <= 0) throw new Error(`특강 크기는 1 이상이어야 한다: ${size}`)
  return cells.map((c) => {
    if (c.items === null) return { type: c.type, items: null, ok: null, volumes: null, short: null }
    return {
      type: c.type,
      items: c.items,
      ok: c.items >= size,
      volumes: Math.floor(c.items / size),
      short: Math.max(0, size - c.items),
    }
  })
}

/** 한 밴드의 단일유형 자유도 요약. */
export interface SoloReport {
  verdicts: SoloVerdict[]
  /** 낼 수 있는 칸 수. */
  ok: number
  /** 판정 대상 칸 수(못 잰 칸 제외) — **분모가 이것이다.** */
  measured: number
  /** 못 잰 칸 수. 0 과 구별해서 화면에 적는다. */
  unmeasured: number
  /** 가장 모자란 칸부터. 이미 되는 칸은 빠진다. */
  gaps: SoloVerdict[]
}

export function soloReport(cells: readonly FreedomCell[], size: number): SoloReport {
  const verdicts = soloFreedom(cells, size)
  const measured = verdicts.filter((v) => v.ok !== null)
  return {
    verdicts,
    ok: measured.filter((v) => v.ok).length,
    measured: measured.length,
    unmeasured: verdicts.length - measured.length,
    gaps: measured
      .filter((v) => !v.ok)
      .sort((a, b) => (b.short ?? 0) - (a.short ?? 0)),
  }
}

/** 혼합권 자유도 판정. */
export interface MixVerdict {
  /** 겹치지 않게 낼 수 있는 권 수. 못 잰 칸이 하나라도 있으면 `null`. */
  volumes: number | null
  /** 거기서 멈추게 하는 유형. 배합이 비었거나 못 쟀으면 `null`. */
  binding: string | null
  /** 못 잰 유형들 — 있으면 판정 자체가 못 미더우므로 화면이 말해야 한다. */
  unmeasured: string[]
}

/**
 * **혼합권 자유도** — 배합(`needPerVolume`)을 지킨 권을 겹치지 않게 몇 권.
 *
 * ⚠️ **한 칸이라도 못 쟀으면 권 수를 내지 않는다.** 못 잰 칸을 빼고 세면 남은 칸들의
 *   최솟값이 나오는데, 그건 실제보다 **큰** 수다 — 없는 여유를 있다고 말하게 된다.
 */
export function mixFreedom(cells: readonly FreedomCell[]): MixVerdict {
  const inMix = cells.filter((c) => (c.needPerVolume ?? 0) > 0)
  const unmeasured = inMix.filter((c) => c.items === null).map((c) => c.type)
  if (!inMix.length) return { volumes: null, binding: null, unmeasured }
  if (unmeasured.length) return { volumes: null, binding: null, unmeasured }

  // ⚠️ **동점은 흔하다** — 서로 다른 두 유형이 똑같이 1권에서 멈추는 일이 실제로 있다
  //   (V7 실측: long_reference 4/3 = 1 · mood 8/5 = 1). 배열 순서로 이기게 두면 호출부가
  //   칸을 어떻게 정렬해 왔느냐에 따라 화면이 **다른 범인을 지목한다.**
  //   동점이면 **재고가 더 적은 쪽**을 든다 — 관리자가 먼저 만들어야 할 것이 그쪽이고,
  //   그 수가 곧 "몇 개나 없는가" 를 말해 준다.
  let volumes = Infinity
  let binding: string | null = null
  let bindingItems = Infinity
  for (const c of inMix) {
    const items = c.items as number
    const v = Math.floor(items / (c.needPerVolume as number))
    if (v < volumes || (v === volumes && items < bindingItems)) {
      volumes = v
      binding = c.type
      bindingItems = items
    }
  }
  return { volumes: volumes === Infinity ? null : volumes, binding, unmeasured }
}

/** 한 밴드 전체. */
export interface BandFreedom {
  vLevel: number
  solo: SoloReport
  mix: MixVerdict
}

export function bandFreedom(
  vLevel: number,
  cells: readonly FreedomCell[],
  soloSize: number,
): BandFreedom {
  return { vLevel, solo: soloReport(cells, soloSize), mix: mixFreedom(cells) }
}

/** 공장 전체의 자유도 — 화면이 맨 위에 적는 두 수. */
export interface FreedomIndex {
  bands: BandFreedom[]
  /** 단일유형: 낼 수 있는 칸 / 잰 칸. */
  soloOk: number
  soloMeasured: number
  /** 못 잰 칸 — 비율에서 빠졌다는 사실을 화면이 말해야 한다. */
  soloUnmeasured: number
  /** 혼합권 총합. 못 잰 밴드는 빠지므로 그 수도 함께 든다. */
  mixVolumes: number
  mixUnmeasuredBands: number
  /** 가장 좁은 밴드 — 여기가 곧 "자유롭지 않다" 의 얼굴이다. */
  narrowest: BandFreedom | null
}

export function freedomIndex(bands: readonly BandFreedom[], size: number): FreedomIndex {
  void size
  const withMix = bands.filter((b) => b.mix.volumes !== null)
  return {
    bands: [...bands],
    soloOk: bands.reduce((n, b) => n + b.solo.ok, 0),
    soloMeasured: bands.reduce((n, b) => n + b.solo.measured, 0),
    soloUnmeasured: bands.reduce((n, b) => n + b.solo.unmeasured, 0),
    mixVolumes: withMix.reduce((n, b) => n + (b.mix.volumes as number), 0),
    mixUnmeasuredBands: bands.length - withMix.length,
    narrowest:
      withMix.length === 0
        ? null
        : withMix.reduce((lo, b) =>
            (b.mix.volumes as number) < (lo.mix.volumes as number) ? b : lo,
          ),
  }
}
