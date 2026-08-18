// packages/library-pipeline/src/compose/spine.ts
//
// ACP §20 — 어휘 스파인. 초등부터 대입까지 **하나의 난이도 축**.
//
// ── 왜 새로 만들지 않았나 (실측 2026-08-18) ────────────────────────────
//
// 스파인을 NGSL(초등 코어) × 교과서 × 기출로 새로 정렬하려 했으나, 먼저 재 보니
// **이미 있는 V-Level(VRL 0–11)이 그 스파인이었다.** `shared_dictionary` 47,125 표제어 중
// 47,114(99.98%)에 붙어 있고, 교육 기준 정답지인 CEFR-J 어휘 밴드와 단조로 맞는다:
//
//   CEFR-J A1 → V 중앙값 1 (n=1,023)   A2 → 3 (1,194)   B1 → 5 (1,931)   B2 → 7 (1,950)
//
// 나머지 축은 **정본이 될 수 없다는 것**이 같은 측정에서 드러났다:
//
//   · NGSL SFI (12,152어) — 빈도 밴드와 V-Level 은 크게 보면 단조지만(평균 V 1.99 → 4.31 →
//     6.80 → 8.48 → 9.71) 어긋나는 151건 중 **141건(93.4%)이 파생형**이다(birding·branding·
//     casting…). NGSL 은 lemma family 에 빈도를 주고 V-Level 은 형태·의미에 레벨을 준다 —
//     축의 충돌이 아니라 **단위 불일치**다. 표제어로 그냥 조인하면 고빈도 family 의 빈도가
//     희귀 파생형으로 샌다.
//   · NGSL 의 교육 맹점 — 달력 어휘(december SFI 14.8 · friday 21.9 · wednesday 17.4)는
//     코퍼스 빈도가 낮지만 CEFR-J 는 **전부 A1** 이고 V-Level 도 2~3 이다. 빈도로 초등 밴드를
//     만들면 "Wednesday 가 phenomenon 보다 어렵다" 가 된다. **빈도는 교수 순서가 아니다.**
//   · 사전 자체 `cefr_level` (47,125어) — CEFR-J 와 **정확 일치가 36.7%**(2,236/6,098)이고
//     어긋남이 거의 전부 한 단계 **과대평가** 쪽이다(A1 단어의 59%를 A2 이상으로). 커버리지가
//     제일 넓은 축이 제일 편향돼 있다 — 밴드 판정에 쓰면 안 된다.
//
// 그래서 이 모듈은 축을 새로 만들지 않고 **V-Level 위에 학령 밴드를 정의**한다.

/** 학령 밴드 — 하나의 V 축을 학령으로 자른 구간. 경계는 겹친다(진급이 계단이 아니므로). */
export interface GradeBand {
  key: GradeBandKey
  label: string
  /** 이 밴드 학습자가 무리 없이 읽는 V 구간 */
  vRange: { min: number; max: number }
  /** 대응 CEFR-J 밴드 — 위 실측 매핑에서 나온다 */
  cefrj: ReadonlyArray<string>
  note: string
}

export type GradeBandKey = 'elementary' | 'middle' | 'high' | 'exam'

/**
 * 밴드 경계의 근거는 CEFR-J ↔ V 중앙값 매핑이다(A1→1 · A2→3 · B1→5 · B2→7).
 * 학령 사이를 **겹치게** 둔 것은 의도다 — 중2와 고1 사이에 읽을 수 없는 골이 생기면
 * 12년 재노출이 그 자리에서 끊긴다.
 */
export const GRADE_BANDS: Record<GradeBandKey, GradeBand> = {
  elementary: {
    key: 'elementary',
    label: '초등',
    vRange: { min: 1, max: 3 },
    cefrj: ['A1', 'A2'],
    note: '흥미·습관 형성기. 하드뉴스는 부적합 — 내러티브·사물 설명·경이 소재.',
  },
  middle: {
    key: 'middle',
    label: '중등',
    vRange: { min: 3, max: 6 },
    cefrj: ['A2', 'B1'],
    note: '하드뉴스 리라이트 최적 구간. 역피라미드 축약이 5W1H 문항과 맞는다.',
  },
  high: {
    key: 'high',
    label: '고등',
    vRange: { min: 5, max: 8 },
    cefrj: ['B1', 'B2'],
    note: '수능 register 진입. 논증형·학술형 explainer.',
  },
  exam: {
    key: 'exam',
    label: '대입·학술',
    vRange: { min: 7, max: 11 },
    cefrj: ['B2'],
    note: '대학 전공서 인용 수준. 뉴스 리라이트가 아니라 자체 집필 영역.',
  },
}

/**
 * 밴드 판정에 쓸 수 있는 사전 필드.
 *
 * 화면·게이트가 어느 필드를 봐야 하는지 한곳에 적어 둔다 — 커버리지가 넓다는 이유로
 * `cefr_level` 을 집는 실수가 반복되기 때문이다(위 36.7% 참조).
 */
export const SPINE_AXIS = {
  /** 정본. 밴드 판정은 이것으로만 한다. */
  primary: 'v_level',
  /** 검증용 정답지. 커버리지가 좁아 정본은 못 되지만 회귀에서 정본을 감시한다. */
  reference: 'cefrj_wordlist_band',
  /** 보조 신호. 파생형 단위 불일치가 있어 단독 판정 금지. */
  advisory: 'ngsl_sfi',
  /** 밴드 판정에 쓰지 않는다 — CEFR-J 대비 체계적 과대평가. */
  distrusted: 'cefr_level',
} as const

/** 한 단어의 스파인 위치. v 가 null 이면 사전에 없는 단어다(모르는 것을 쉽다고 하지 않는다). */
export interface SpineWord {
  word: string
  v: number | null
}

export interface BandProfile {
  band: GradeBandKey
  /** 사전에서 찾은 단어 수 */
  known: number
  /** 사전에 없어 판정할 수 없는 단어 수 */
  unknown: number
  /** 밴드 안 */
  inBand: number
  /** 밴드 위 — 이 비율이 읽기 난이도를 만든다 */
  aboveBand: number
  /** 밴드 위 단어 비율 (0~1). 판정 불가 단어는 분모에서 뺀다. */
  aboveShare: number
  /** 밴드를 넘는 단어들 (V 높은 순) */
  offenders: ReadonlyArray<{ word: string; v: number }>
}

/**
 * 초안의 어휘가 목표 학령 밴드에 맞는지 잰다.
 *
 * ⚠️ 이 값은 `article_v_level` 과 **다른 것을 잰다**. 후자는 서로 다른 lemma 의 V 백분위(P75)라
 * 글이 길수록 올라가서, 130~450어로 짧게 쓰는 재저작 글에는 구조적으로 낮게 나온다
 * (발행 실측: 같은 CEFR 대에서 300어 미만 평균 4.00 → 1,500어 이상 4.86). 여기서 재는 것은
 * **밴드를 넘는 단어의 비율**이라 길이에 딸려 가지 않는다 — 그래서 렌더링 제약으로 쓸 수 있다.
 */
export function profileBand(words: ReadonlyArray<SpineWord>, band: GradeBandKey): BandProfile {
  const max = GRADE_BANDS[band].vRange.max
  let known = 0
  let unknown = 0
  let above = 0
  const offenders: Array<{ word: string; v: number }> = []

  const seen = new Set<string>()
  for (const w of words) {
    const key = w.word.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    if (w.v === null) {
      unknown++
      continue
    }
    known++
    if (w.v > max) {
      above++
      offenders.push({ word: key, v: w.v })
    }
  }

  offenders.sort((a, b) => b.v - a.v || a.word.localeCompare(b.word))
  return {
    band,
    known,
    unknown,
    inBand: known - above,
    aboveBand: above,
    aboveShare: known === 0 ? 0 : above / known,
    offenders,
  }
}

/**
 * 밴드별 허용 초과 비율.
 *
 * ⚠️ **이 값은 아직 근거가 없다.** 지금은 초안을 재기만 하고 막지 않는다 —
 * 오늘 V-Level 점 목표를 ±2 로 막았다가 정상 글을 실패로 부른 일이 있었다. 실제 지문을
 * 충분히 재서 분포를 본 뒤에 임계로 승격시킨다. 그때까지 이 상수는 **보고용 기준선**이다.
 */
export const BAND_TOLERANCE_DRAFT: Record<GradeBandKey, number> = {
  elementary: 0.03,
  middle: 0.05,
  high: 0.08,
  exam: 0.12,
}

/** 학습 유형의 vBand 로 가장 가까운 학령 밴드를 고른다 — 두 축을 잇는 유일한 지점. */
export function bandForVRange(range: { min: number; max: number }): GradeBandKey {
  let best: GradeBandKey = 'high'
  let bestOverlap = -1
  for (const b of Object.values(GRADE_BANDS)) {
    const overlap =
      Math.min(range.max, b.vRange.max) - Math.max(range.min, b.vRange.min)
    if (overlap > bestOverlap) {
      bestOverlap = overlap
      best = b.key
    }
  }
  return best
}
