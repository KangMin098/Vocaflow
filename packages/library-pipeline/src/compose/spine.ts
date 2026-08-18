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

/**
 * 학령 밴드 — 하나의 V 축을 학령으로 자른 구간. 경계는 겹친다(진급이 계단이 아니므로).
 *
 * ⚠️ **미해결**: 이 밴드는 엄밀히 말하면 *어휘* 밴드이지 독자 연령이 아니다. 둘은 상관이
 * 높지만 같지 않다 — 성인 학습자를 위한 V2 회화 지문도 '초등' 밴드로 잡힌다. 지금은
 * 이 제품의 V1–3 독자가 실제로 초등이라 기본값으로 성립하지만, 성인 입문 과정을 열면
 * 안전성 지시(사건사고 배제)가 엉뚱한 곳에 붙는다. 그때는 독자 축을 따로 뽑아야 한다.
 */
export interface GradeBand {
  key: GradeBandKey
  label: string
  /** 이 밴드 학습자가 무리 없이 읽는 V 구간 */
  vRange: { min: number; max: number }
  /** 대응 CEFR-J 밴드 — 위 실측 매핑에서 나온다 */
  cefrj: ReadonlyArray<string>
  /**
   * 학령 집필 지시 — **유형이 아니라 밴드가 갖는다.**
   *
   * 같은 유형(예: 일반 영어)이 초등판과 중등판을 모두 쓰므로, 학령에 따라 달라지는 규칙은
   * 유형 쪽에 둘 수 없다. 특히 초등의 안전성 규칙(사건사고 배제)이 그렇다 — 사실 원장은
   * 하드뉴스를 담고 있어도 초등판은 거기서 그 사실을 쓰지 않아야 한다.
   */
  directives: ReadonlyArray<string>
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
    directives: [
      '한 문장에 한 가지만 말한다. 접속사로 두 문장을 잇지 않는다.',
      '눈에 보이는 것을 쓴다 — 사물·동물·사람·장소. 제도·정책·추상명사는 쓰지 않는다.',
      '사건사고·분쟁·죽음은 사실 카드에 있어도 쓰지 않는다.',
      '숫자는 한 편에 하나만 남긴다 — 셋을 나열하면 셋 다 놓친다.',
      '같은 단어를 일부러 다시 쓴다. 동의어로 바꾸면 재인이 끊긴다.',
    ],
    note: '흥미·습관 형성기. 하드뉴스는 부적합 — 내러티브·사물 설명·경이 소재.',
  },
  middle: {
    key: 'middle',
    label: '중등',
    vRange: { min: 3, max: 6 },
    cefrj: ['A2', 'B1'],
    directives: [
      // ⚠️ '역피라미드로 쓰라' 고 지시하지 않는다 — 그것이 곧 원 기사의 전개라
      //   I14(구조 독립성)를 정면으로 밀어 올린다. 학령 지시는 **문단 단위**만 정한다.
      '한 문단은 4~6문장으로 끊는다 — 문단이 이해 단위이자 구문 연습 문항의 생성 단위다.',
      '한 문단에 사실을 두세 개까지만 담는다.',
    ],
    note: '하드뉴스 리라이트 최적 구간. 역피라미드 축약이 5W1H 문항과 맞는다.',
  },
  high: {
    key: 'high',
    label: '고등',
    vRange: { min: 5, max: 8 },
    cefrj: ['B1', 'B2'],
    directives: [
      '지시어로 문장 간 결속을 만든다 — 순서·삽입 문항의 단서가 된다.',
      '한 문단에 논지 하나. 주제문을 문단 앞이나 끝에 분명히 둔다.',
    ],
    note: '수능 register 진입. 논증형·학술형 explainer.',
  },
  exam: {
    key: 'exam',
    label: '대입·학술',
    vRange: { min: 7, max: 11 },
    cefrj: ['B2'],
    directives: [
      '한정 표현(may·suggests·is associated with)으로 단정을 피한다.',
      '심화 어휘를 일부러 넣는다 — 이 밴드의 제약은 천장이 아니라 하한이다.',
    ],
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
  /** 심화 어휘(V≥9) 비율 — 최상위 밴드는 이걸 **하한**으로 본다 */
  deepShare: number
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
  let deep = 0
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
    if (w.v >= 9) deep++
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
    deepShare: known === 0 ? 0 : deep / known,
    offenders,
  }
}

/** 밴드 제약의 방향. 최상위 밴드에서는 **뒤집힌다**. */
export type BandConstraintKind = 'ceiling' | 'floor'

export interface BandConstraint {
  kind: BandConstraintKind
  /** ceiling: 밴드 초과 어휘 비율의 상한 · floor: 심화 어휘(V≥9) 보유 비율의 하한 */
  value: number
  /** 이 값이 어디서 나왔는가. 근거 없이 임계를 두면 정상 산출물을 실패로 부른다. */
  basis: string
  /** 실측으로 보정됐는가. false 면 **막는 데 쓰면 안 된다**. */
  calibrated: boolean
}

/**
 * 밴드별 제약 — 발행 아티클 160편 실측(2026-08-18)에서 나왔다.
 *
 * 측정 방법: 글마다 서로 다른 lemma 의 V 분포를 구해 밴드 초과 비율을 낸 뒤,
 * **글 자신의 측정 레벨(`article_v_level`)로 묶어** 백분위를 봤다. 그 레벨에 실제로 있는
 * 글이 통과해야 하기 때문이다.
 *
 *   avl  n    초등초과 p50/p90   중등초과 p50/p90   고등초과 p50/p90   V9+보유 p50
 *   2    5    20.0 / 21.9        2.3 / 3.3          0.0 / 1.5          0.8
 *   3    8    23.2 / 25.0        5.4 / 9.2          1.8 / 3.9          2.1
 *   4   42    31.1 / 35.1        6.3 / 10.1         1.7 / 4.6          2.1
 *   5   67    44.8 / 52.5       12.0 / 15.4         3.7 / 5.9          4.1
 *   6   37    53.8 / 60.4       17.3 / 20.0         5.3 / 9.1          5.8
 *   7    1    65.7 / 66.7       25.4 / 25.4        10.6 / 10.6        13.4
 *
 * 여기서 두 가지가 드러났고 둘 다 설계를 바꿨다:
 *
 *  ① **대입 밴드는 천장이 무의미하다.** V>11 초과가 전 구간 0.00% 다 — V11 이 축의 끝이라
 *     넘을 수가 없다. 최상위에서 제약은 뒤집힌다: 어려운 말을 막는 게 아니라 **충분히
 *     넣었는지**를 본다(수능·학술 지문의 성격 자체가 그렇다).
 *  ② **초등 밴드는 보정할 수 없다.** 가장 쉬운 V2 지문조차 V3 초과가 20~22% 다. 초등용으로
 *     쓴 글이 코퍼스에 **0편**이라 "정상인 초등 지문" 의 분포를 알 방법이 없다. 그래서
 *     `calibrated: false` 로 두고, 초등 판을 실제로 써 본 뒤에 채운다. 없는 근거로 막지 않는다.
 */
export const BAND_CONSTRAINT: Record<GradeBandKey, BandConstraint> = {
  elementary: {
    kind: 'ceiling',
    value: 0.33,
    basis:
      'VOA Learning English 30편(저레벨 학습자용으로 **일부러 쓴** 콘텐츠) V>3 비율 p50 27.3%·p90 33.2%. 지문에는 주제어가 필요해서(화산 기사의 volcano·lava) 저레벨 콘텐츠도 이 정도는 넘는다. V5 지문 44.8%·V6 53.8% 와는 갈린다',
    calibrated: true,
  },
  middle: {
    kind: 'ceiling',
    value: 0.12,
    basis: 'V3~4 지문 50편의 밴드 초과 p90 = 9.2~10.1%. 여유를 두어 12%',
    calibrated: true,
  },
  high: {
    kind: 'ceiling',
    value: 0.1,
    basis: 'V5~6 지문 104편의 밴드 초과 p90 = 5.9~9.1%. 여유를 두어 10%',
    calibrated: true,
  },
  exam: {
    kind: 'floor',
    value: 0.04,
    basis:
      '소스군별 V9+ 보유 실측 — 학술(plos·elife·wikipedia, n=10) p10 5.0%·최소 3.8% vs 학습자용(voa·simple_wikipedia, n=64) p50 2.3%. 두 군을 가르는 자리에 4%',
    calibrated: true,
  },
}

/**
 * 프로파일이 밴드 제약을 만족하는가.
 *
 * ⚠️ `calibrated: false` 인 밴드는 **판정하지 않는다**. 근거 없는 임계로 막으면 정상 산출물이
 * 실패로 불린다 — 같은 실수를 이미 한 번 했다(V-Level 점 목표 ±2).
 */
export function evaluateBand(p: BandProfile): {
  verdict: 'PASS' | 'WARN' | 'UNCALIBRATED'
  detail: string
} {
  const c = BAND_CONSTRAINT[p.band]
  const label = GRADE_BANDS[p.band].label
  if (!c.calibrated) {
    return {
      verdict: 'UNCALIBRATED',
      detail: `${label} 밴드는 아직 기준이 없다 — ${c.basis}. 측정값만 남긴다(초과 ${(p.aboveShare * 100).toFixed(1)}% · 심화 ${(p.deepShare * 100).toFixed(1)}%).`,
    }
  }
  if (c.kind === 'ceiling') {
    const ok = p.aboveShare <= c.value
    return {
      verdict: ok ? 'PASS' : 'WARN',
      detail: `밴드 초과 ${(p.aboveShare * 100).toFixed(1)}% (기준 ${(c.value * 100).toFixed(0)}% · ${c.basis})`,
    }
  }
  const ok = p.deepShare >= c.value
  return {
    verdict: ok ? 'PASS' : 'WARN',
    detail: `심화 어휘 ${(p.deepShare * 100).toFixed(1)}% (최소 ${(c.value * 100).toFixed(0)}% · ${c.basis})`,
  }
}

/**
 * 이 판이 서는 학령 — **발주의 목표 레벨**에서 정한다.
 *
 * ⚠️ 유형(track)이 아니라 목표 레벨에서 정하는 것이 핵심이다. 팩트시트 1개에서 학령별 N판을
 * 파생시키려면 **같은 유형이 여러 학령을 서야** 하기 때문이다 — `general_proficiency`(V1–6)를
 * V2 로 발주하면 초등판, V5 로 발주하면 중등판이다. 유형의 밴드 전체로 정하면 둘이 같은
 * 학령으로 뭉개져서, 학령 확장이 곧 **유형 추가**가 돼 버린다.
 *
 * 실제로 그렇게 만들려다 되돌렸다: 초등용 유형을 새로 넣었더니 VRL 학습자 축
 * (`shared_dictionary.track_levels` — 실측 6종, 35k행)에 없는 7번째 키가 생겨 **두 레지스트리가
 * 갈렸다**. 학령은 렌더링 파라미터이지 학습자가 선언하는 목표가 아니다.
 *
 * 경계는 CEFR-J ↔ V 중앙값에서 온다(A1→1 · A2→3 · B1→5 · B2→7). `GradeBand.vRange` 가 서로
 * 겹치는 것은 **읽기 허용치**이고, 이 함수는 **집필 배정**이라 겹치지 않는다.
 */
export function bandForVLevel(v: number): GradeBandKey {
  if (v <= 3) return 'elementary'
  if (v <= 6) return 'middle'
  if (v <= 8) return 'high'
  return 'exam'
}

/** 유형이 **설 수 있는** 학령(대표값). 집필 배정은  을 쓴다. */
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
