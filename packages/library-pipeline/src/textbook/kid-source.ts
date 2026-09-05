// packages/library-pipeline/src/textbook/kid-source.ts
//
// **초·중 원문 재고의 목표와 세는 법 — 한 벌뿐인 정본.**
//
// ── 왜 패키지에 두나 ─────────────────────────────────────────────────
// 목표(9,160)와 칸별 몫(1,832)이 `scripts/textbook/kid-inventory.mjs` 안에만 있었다.
// Admin 화면이 같은 수치를 보이려면 그 상수를 **복사**해야 하는데, 복사한 순간
// 스크립트와 화면이 다른 답을 하는 날이 온다 — 이 저장소는 그 사고를 이미 겪었다
// (어수 창 `PASSAGE_WORDS` 가 두 벌이라 100~200 과 120~250 이 공존했다).
//
// ── 세는 법이 곧 정의다 ──────────────────────────────────────────────
// "게시 가능" = **적재분 − 명시적으로 격리된 것**.
//
// ⚠️ `publishable = true` 인 것만 세면 **아직 판정 안 받은 행이 통째로 빠진다** —
//   방금 담은 것은 늘 미판정이라 그 칸은 영영 안 찬 것으로 보인다.
// ⚠️ PostgREST 에서 `.not(col,'eq','false')` 로 한 번에 세도 **안 된다.** SQL `col <> 'false'`
//   로 번역되는데 `col` 이 NULL 이면 UNKNOWN 이라 그 행이 조용히 사라진다
//   (실측 2026-09-05: 초3~4 를 449 로 셌으나 실제는 652 − 격리 145 = **507**).
//   그래서 **두 번 세서 뺀다.** 이 파일이 그 규칙의 근거지다.

/** 발췌가 들어가는 다섯 칸 — `feed_label` 은 `PD 발췌 · <id>` 꼴이다. */
export const KID_BANDS = ['초3~4', '초5~6', '초6~중1', '중1~2', '중3'] as const

export type KidBand = (typeof KID_BANDS)[number]

/** `feed_label` 문자열 — 조회 조건과 화면 표기가 갈리지 않게 여기서 만든다. */
export function kidFeedLabel(band: KidBand): string {
  return `PD 발췌 · ${band}`
}

/**
 * 목표 = **고등 재고의 절반**.
 *
 * 고등(V5~V9 · ready+published · display_only 제외) **18,320편**을 실측하고 그 절반을 잡았다.
 * 사용자 요구가 "고등 목표량의 반절 정도" 였고, 그 말을 숫자로 고정한 것이 이 값이다.
 *
 * 칸별 몫이 균등한 것은 **학년 사다리가 한 칸이 비면 그 단계에서 끊기기** 때문이다.
 * 시중 코퍼스의 학년대별 발행 종수를 세어(초등 18권 · 중등 19권) 균등을 뒤집을 근거가
 * 없음을 확인했다(2026-09-05).
 */
export const KID_SOURCE_TARGET = {
  /** 고등 재고 실측 — 분모의 근거. */
  highSchoolStock: 18_320,
  /** 목표 총량. */
  total: 9_160,
  /** 칸별 몫 — `total` 을 다섯 칸에 고르게. */
  quotaPerBand: 1_832,
} as const

/** 한 칸의 재고 — 적재분과 격리분에서 파생한다. */
export interface KidBandRow {
  band: KidBand
  /** 적재된 행 수. */
  held: number
  /** `csat_fit->gate->>publishable` 이 명시적으로 `false` 인 행 수. */
  quarantined: number
  /** 적재 − 격리. 미판정은 격리가 아니므로 여기 들어간다. */
  publishable: number
  /** 격리 비율 % — 그 칸의 소스가 얼마나 오염됐는지. */
  quarantinedPct: number
  /** 몫까지 남은 편수. */
  quotaLeft: number
}

export interface KidSourceInventory {
  bands: KidBandRow[]
  /** 각색분(`feed_id='adapted'`) — 칸이 아니라 별도 경로다. */
  adapted: { held: number; quarantined: number; publishable: number }
  /** 다섯 칸 + 각색의 게시 가능 합계. */
  total: number
  /** 목표 대비 % (소수 한 자리). */
  pct: number
}

/**
 * 원시 카운트를 재고표로 만든다 — **순수 함수**라 스크립트와 화면이 같은 답을 낸다.
 *
 * `counts` 는 칸마다 `{ held, quarantined }`. 조회 방법(스크립트냐 서버냐)은 호출자 몫이고,
 * **무엇을 게시 가능이라 부르는지는 여기서만 정한다.**
 */
export function buildKidInventory(
  counts: Record<KidBand, { held: number; quarantined: number }>,
  adapted: { held: number; quarantined: number }
): KidSourceInventory {
  const bands: KidBandRow[] = KID_BANDS.map((band) => {
    const { held, quarantined } = counts[band]
    const publishable = held - quarantined
    return {
      band,
      held,
      quarantined,
      publishable,
      quarantinedPct: held ? +((quarantined / held) * 100).toFixed(1) : 0,
      quotaLeft: Math.max(0, KID_SOURCE_TARGET.quotaPerBand - publishable),
    }
  })
  const adaptedPublishable = adapted.held - adapted.quarantined
  const total = bands.reduce((n, r) => n + r.publishable, 0) + adaptedPublishable
  return {
    bands,
    adapted: { ...adapted, publishable: adaptedPublishable },
    total,
    pct: +((total / KID_SOURCE_TARGET.total) * 100).toFixed(1),
  }
}
