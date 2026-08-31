// packages/library-pipeline/src/textbook/item-health.ts
//
// **문항 건강 점검 — 상업 교재 제작 8단계 중 8번(평가·개정).**
//
// ── 없는 단계였고, 왜 없었는가 ───────────────────────────────────────
// 출간 후 오류 신고와 사용 결과를 모아 다음 쇄에 반영하는 단계다. 우리에겐 이게 없었다.
// 이유는 분명했다 — `csat_item_attempts` 가 **0행**이라 어느 문항이 너무 쉽거나 어려운지
// 알 방법이 없었다.
//
// ── 그런데 정답률 없이도 잴 수 있는 것이 있다 ────────────────────────
// 유형을 만들면서 매번 검증기를 붙였다(판별력 · 유일성 · 정답 번호 쏠림 · 수율).
// **그 검증기들이 곧 문항 사후 평가다.** 학습자가 한 명도 없어도 다음은 지금 알 수 있다:
//
//   ① 정답 번호가 한쪽으로 쏠렸는가      → 읽지 않고 찍어서 맞는다
//   ② 지문이 규격 밖으로 길거나 짧은가    → 시험지에 못 싣는다
//   ③ 재고가 특정 밴드에만 있는가        → 그 학년 교재를 못 만든다
//   ④ 지금 규칙으로 다시 만들면 안 나오는가 → 규칙이 엄해진 뒤 낡은 것이다
//
// ── 실사용 데이터가 들어오면 붙는 자리 ───────────────────────────────
// `ItemAttemptStats` 를 넣으면 난이도·변별도가 함께 계산된다. 지금은 0행이라 "관측 없음" 이
// 뜨는데, **그 사실 자체를 리포트에 적는다** — 없는 것을 없다고 적지 않으면 다음 사람이
// "평가 단계가 있다" 고 오해한다.

/** 문항 하나에 대해 점검이 필요로 하는 것. */
export interface HealthInput {
  id: string
  type: string
  /** 정답 번호. 단답형(번호 없음)이면 0. */
  answer: number
  /** 답지 수 — 유형마다 다르다(수능 5 · 초등 4). */
  choiceCount: number
  /** 지문 낱말 수. 지문이 없는 유형이면 null. */
  passageWords: number | null
  /** 학습자 레벨 밴드. */
  vLevel: number | null
}

/** 실사용 관측. 아직 한 건도 없다 — 들어오면 난이도·변별도가 계산된다. */
export interface ItemAttemptStats {
  id: string
  attempts: number
  correct: number
  /** 상위 27% 집단의 정답 수. 변별도에 쓴다. */
  upperCorrect?: number
  /** 하위 27% 집단의 정답 수. */
  lowerCorrect?: number
  upperCount?: number
  lowerCount?: number
}

/**
 * 카이제곱 상단 임계값 (유의수준 0.05).
 *
 * **짐작한 숫자가 아니라 통계표다.** 자유도 1~10 의 χ²(0.05) 값이고, 어느 통계 교재에나
 * 같은 값이 실려 있다. 0.05 라는 유의수준은 관례이며, 그 관례를 쓴다는 사실을 여기 적어 둔다.
 *
 * 답지 5개면 자유도 4(= 5−1), 4개면 자유도 3 이다.
 */
export const CHI2_CRITICAL_05: Readonly<Record<number, number>> = {
  1: 3.841,
  2: 5.991,
  3: 7.815,
  4: 9.488,
  5: 11.07,
  6: 12.592,
  7: 14.067,
  8: 15.507,
  9: 16.919,
  10: 18.307,
}

export interface AnswerBias {
  counts: number[]
  total: number
  /** 가장 많이 나온 번호의 비중. 균등하면 1/n. */
  maxShare: number
  chi2: number
  df: number
  /**
   * 효과 크기 Cramér's V = √(χ² / (n·(k−1))). **표본 크기에 둔감하다.**
   * χ² 는 n 이 크면 3%p 차이도 임계를 73배 넘긴다 — 그 경보는 쓸모가 없다.
   */
  cramersV: number
  /**
   * 균등분포와 **유의하게 다르고(χ²) 동시에 크기가 있는가(V≥0.1)**.
   * 참이면 지문을 안 읽고 찍어서 맞을 여지가 실제로 있다.
   */
  biased: boolean
}

/**
 * 정답 번호 쏠림 — 균등분포와 얼마나 다른가.
 *
 * "최다 비중 30% 면 나쁜가" 는 표본 수에 따라 다르다. 10문항에서 30% 는 아무 뜻이 없고
 * 1,000문항에서 30% 는 분명한 쏠림이다. 그래서 **비중이 아니라 카이제곱**으로 본다.
 */
export function assessAnswerBias(counts: readonly number[]): AnswerBias {
  const total = counts.reduce((s, n) => s + n, 0)
  const n = counts.length
  const expected = total / n
  const chi2 = expected > 0 ? counts.reduce((s, c) => s + (c - expected) ** 2 / expected, 0) : 0
  const df = n - 1
  const critical = CHI2_CRITICAL_05[df]
  // ⚠️ **χ² 만 보면 표본이 클수록 사소한 차이가 "쏠림" 이 된다.** 실측 2026-08-31:
  //   `insert` 52,523건의 최다 비중이 **23.4%**(기대 20%)인데 χ²=692.9 로 임계 9.5 를
  //   73배 넘겼다. 찍는 학습자가 얻는 이득은 3.4%p 뿐인데 리포트는 최고 등급 경보를 냈다.
  //   그렇게 늑대를 부르면 진짜 쏠림을 못 본다.
  //
  //   그래서 **효과 크기**를 함께 낸다 — Cramér's V = √(χ² / (n·(k−1))).
  //   위 사례는 V=0.057 로 관행상 "무시할 수준"(0.1 미만)이다.
  //
  // ⚠️ **0.1 은 실측 기준선이 아니라 통계 관행이다.** `market-spec.json` 에는 시중 교재의
  //   정답 위치 분포가 없어서(수집 대상이 아니었다) 시장에서 유도할 수가 없다.
  //   근거가 관행이라는 사실을 숨기지 않는다 — 실측이 생기면 그때 바꾼다.
  const cramersV = total > 0 && n > 1 ? Math.sqrt(chi2 / (total * (n - 1))) : 0
  return {
    counts: [...counts],
    total,
    maxShare: total ? Math.max(...counts) / total : 0,
    chi2,
    df,
    cramersV,
    // 임계값을 모르는 자유도면 판정하지 않는다 — 모르는 것을 "괜찮다" 고 하지 않는다.
    // **유의미(χ²)하고 동시에 크기가 있어야(V)** 쏠림으로 센다.
    biased: critical != null && chi2 > critical && cramersV >= 0.1,
  }
}

/**
 * 문항 난이도 P — 맞힌 비율. 고전검사이론의 정의 그대로다.
 *
 * **P = 1 이나 0 은 변별이 정의상 0 이다**(모두 맞거나 모두 틀리면 학습자를 못 가른다).
 * 그 둘만 결함으로 본다 — "0.3~0.8 이 적정" 같은 범위는 시험 목적에 따라 달라서
 * 우리가 정할 값이 아니다.
 */
export function difficulty(s: ItemAttemptStats): number | null {
  return s.attempts > 0 ? s.correct / s.attempts : null
}

/**
 * 변별도 D — 상위 집단 정답률 − 하위 집단 정답률 (upper-lower index).
 *
 * 상·하위 27% 로 나누는 것은 Kelley(1939)의 관례다. 데이터가 없으면 null.
 */
export function discrimination(s: ItemAttemptStats): number | null {
  if (!s.upperCount || !s.lowerCount) return null
  if (s.upperCorrect == null || s.lowerCorrect == null) return null
  return s.upperCorrect / s.upperCount - s.lowerCorrect / s.lowerCount
}

export interface TypeHealth {
  type: string
  count: number
  answerBias: AnswerBias | null
  /** 지문 길이가 수능 규격 밖인 문항 수. 지문 없는 유형이면 null. */
  outOfSpecPassage: number | null
  /** 밴드별 문항 수 — 비어 있는 학년이 곧 못 만드는 교재다. */
  byLevel: Record<string, number>
  /** 관측이 있는 문항 수. 지금은 0 이다. */
  observed: number
  /** 변별이 정의상 0 인 문항(모두 맞거나 모두 틀림). 관측이 없으면 0. */
  degenerate: number
}

export interface StockHealth {
  total: number
  byType: TypeHealth[]
  /** 관측이 하나도 없으면 참 — **평가 단계가 아직 반쪽이라는 사실**. */
  noObservations: boolean
}

/**
 * 재고 전체를 점검한다.
 *
 * @param items 저장된 문항들.
 * @param spec 지문 길이 규격(수능 문항 기준). `compose-unit` 의 `CSAT_ITEM_WORDS` 를 넣는다.
 * @param stats 실사용 관측. 없으면 난이도·변별도는 건너뛴다.
 */
export function assessStock(
  items: readonly HealthInput[],
  // ⚠️ **유형마다 자가 다르다.** 장문(43~45 · 41~42)은 260~400어 창을 쓴다 —
  //   수능 단문 자(90~200)로 재면 **전량이 "규격 밖"** 으로 잡힌다. 실제로 그랬다:
  //   실측 2026-08-31 리포트가 `long_reference`·`long_vocab`·`long_match`·`long_order`·
  //   `long_title` 을 각각 **100% 규격 밖**이라고 보고했다 — 전부 오탐이었다.
  //   `compose-unit.itemWordSpec` 이 이미 유형별 창을 안다. 함수로 받아 그걸 쓴다.
  spec: { min: number; max: number } | ((type: string) => { min: number; max: number }),
  stats: readonly ItemAttemptStats[] = [],
): StockHealth {
  const statById = new Map(stats.map((s) => [s.id, s]))
  const groups = new Map<string, HealthInput[]>()
  for (const it of items) {
    const arr = groups.get(it.type) ?? []
    arr.push(it)
    groups.set(it.type, arr)
  }

  const byType: TypeHealth[] = []
  for (const [type, list] of [...groups.entries()].sort((a, b) => b[1].length - a[1].length)) {
    // 답지 수가 유형 안에서 일정할 때만 쏠림을 잰다 — 섞여 있으면 균등 기대값이 없다.
    const choiceCounts = new Set(list.map((x) => x.choiceCount))
    let answerBias: AnswerBias | null = null
    if (choiceCounts.size === 1) {
      const n = [...choiceCounts][0]!
      if (n >= 2) {
        const counts = new Array(n).fill(0)
        for (const x of list) if (x.answer >= 1 && x.answer <= n) counts[x.answer - 1]++
        answerBias = assessAnswerBias(counts)
      }
    }

    const typeSpec = typeof spec === 'function' ? spec(type) : spec
    const withPassage = list.filter((x) => x.passageWords != null)
    const outOfSpecPassage = withPassage.length
      ? withPassage.filter((x) => x.passageWords! < typeSpec.min || x.passageWords! > typeSpec.max)
          .length
      : null

    const byLevel: Record<string, number> = {}
    for (const x of list) {
      const k = x.vLevel == null ? '미분류' : `V${x.vLevel}`
      byLevel[k] = (byLevel[k] ?? 0) + 1
    }

    let observed = 0
    let degenerate = 0
    for (const x of list) {
      const s = statById.get(x.id)
      if (!s || s.attempts === 0) continue
      observed++
      const p = difficulty(s)
      if (p === 0 || p === 1) degenerate++
    }

    byType.push({ type, count: list.length, answerBias, outOfSpecPassage, byLevel, observed, degenerate })
  }

  return {
    total: items.length,
    byType,
    noObservations: byType.every((t) => t.observed === 0),
  }
}
