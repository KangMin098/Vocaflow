// apps/web/src/lib/textfit/types.ts
//
// TextFit — "이 지문이 지금 이 학습자에게 맞는가" 를 실측으로 판정하는 엔진의 타입.
//
// 왜 필요했나: `csat_stage_gates` 는 S1~S4 에 coverage 0.98/0.95/0.90/0.85 임계를 갖고 있는데,
// 정작 그 값을 쓰는 코드가 없었다. `derive_learner_stage` 는 coverage 게이트를 만나면
// **coverage 를 재지 않고** `current_v_level >= stage*2` 로 우회한다(2026-08-17 실측).
// 즉 임계값은 장식이었고, 학습자는 "이 글이 나에게 몇 %인지" 를 한 번도 본 적이 없다.
//
// 학술 근거: Hu & Nation (2000) — 무보조 이해에 어휘 커버리지 98% 필요.
//   Kremmel 외 (2023, Language Learning) 재현 연구는 90/95/98% 간 이해도 차이가
//   통계적으로 유의하지 않다고 보고했다 → 그래서 **단일 절벽이 아니라 대역**으로 판정하고,
//   추정 비중이 큰 경우 범위(하한~상한)를 함께 노출한다.

/** 한 단어를 학습자가 안다고 볼 근거 — 강한 순. */
export type KnownSource =
  /** `word_familiarity.verdict='known'` — 학습자가 직접 안다고 답함 */
  | 'self_known'
  /** `word_familiarity.verdict='unknown'` — 학습자가 직접 모른다고 답함 */
  | 'self_unknown'
  /** `vocabularies` 에 있음 — FSRS stability 로 현재 인출 확률 R(t) 계산 */
  | 'fsrs'
  /** 사전 v_level ≤ 학습자 current_v_level — 추정(자기보고로 즉시 대체됨) */
  | 'level_assumed'
  /** 기능어·비어휘 표기 — 토크나이저가 뺀 running word (학습 대상 아님) */
  | 'function_word'
  /** 아무 근거 없음 — 미지어 */
  | 'none'

/** 지문 속 한 단어의 판정 결과. */
export interface WordVerdict {
  /** 표제어(소문자) */
  lemma: string
  /** 이 지문에서의 출현 횟수 — 커버리지 기여도이자 학습 우선순위 */
  count: number
  /** 안다고 볼 근거 */
  source: KnownSource
  /**
   * 아는 정도 0~1. 커버리지 계산에 그대로 곱한다.
   *   self_known 1 · fsrs R(t) · level_assumed 0.85 · self_unknown/none 0
   */
  weight: number
  /** 사전 V-Level (없으면 null) */
  vLevel: number | null
  /** FSRS 인출 확률 — `source='fsrs'` 일 때만 채워진다 */
  retention?: number
}

/** 커버리지 대역 — 학습자가 이 지문으로 **무엇을 할 수 있는지** 를 말한다. */
export type FitBand =
  /** ≥98% — 사전 없이 읽힘. 다독·유창성 훈련 */
  | 'flow'
  /** 95~98% — i+1 최적 학습 구간. 새 단어를 맥락에서 습득 */
  | 'growth'
  /** 90~95% — 정독 필요. 논증 지문 훈련(S3) */
  | 'study'
  /** 85~90% — 문항 훈련용. 킬러 정독(S4) */
  | 'hard'
  /** <85% — 인지 부하 초과. 지금 읽으면 이해가 아니라 해독이 된다 */
  | 'overload'

/** "몇 개를 익히면 어디까지 오르는가" — 역산 처방. */
export interface Prescription {
  /** 목표 커버리지 (0.95 = 다독 적정 · 0.98 = 무보조) */
  target: number
  /** 목표 도달에 필요한 최소 단어 수 — 이미 넘었으면 0 */
  wordsNeeded: number
  /** 그 단어들 (출현 빈도 내림차순 = 기여도 순) */
  words: WordVerdict[]
  /** 그 단어들을 다 익혔을 때의 커버리지 */
  projectedCoverage: number
  /** 목표에 도달 가능한가 — 미지어를 전부 익혀도 못 닿으면 false */
  reachable: boolean
}

/** TextFit 판정 전체. */
export interface TextFitResult {
  /** 러닝 워드 수 (기능어 포함) — 커버리지 분모 */
  totalTokens: number
  /** 학습 대상 unique 단어 수 (기능어 제외) */
  uniqueContentWords: number

  /** 토큰 기준 커버리지 0~1 — Hu & Nation 정의(running words) */
  coverage: number
  /** 추정(level_assumed)분이 전부 미지어였을 때의 하한 */
  coverageLow: number
  /** 추정분이 전부 기지어였을 때의 상한 */
  coverageHigh: number
  /** 판정 신뢰도 0~1 — 추정에 기대지 않은 토큰 비율 */
  confidence: number

  /** 대역 판정 */
  band: FitBand
  /** 이 지문이 지원하는 학습 단계 (csat_stage_gates 대응, 없으면 null) */
  stage: 'S1' | 'S2' | 'S3' | 'S4' | null

  /**
   * **처음 보는 단어** — 빈도 내림차순. 학습 이력이 아예 없는 것만 들어간다.
   *
   * 학습했다가 잊은 단어는 여기 오지 않는다(`fading` 으로 간다). 커버리지 기여는 둘 다 0 이라
   * 수식상 같지만, 학습자에게는 전혀 다른 단어다 — 하나는 처음부터 배워야 하고
   * 다른 하나는 **복습 한 번이면 돌아온다**. 실측(2026-08-17)에서 검증 계정 135장 중 19장이
   * `review_count=13` 인데 `stability≈0` 이었다. 이 19개를 "처음 보는 단어" 로 부르면 거짓말이다.
   */
  unknown: WordVerdict[]
  /**
   * **잊어가는 / 잊은 단어** — FSRS 카드가 있는데 R(t) < 0.9. 인출 확률 오름차순.
   * 복습만으로 커버리지가 회복되는 구간이라, 처방에서 가장 값싼 회복분이다.
   */
  fading: WordVerdict[]

  /** 14일 뒤 예상 커버리지 — 복습을 하지 않았을 때 (FSRS 감쇠 반영) */
  coverageIn14Days: number

  /** 처방 — 다독 적정(0.95) · 무보조(0.98) */
  prescriptions: Prescription[]

  /** 근거 분해 — 커버리지가 어디서 왔는지 (합 = totalTokens) */
  breakdown: Record<KnownSource, number>
}

/** 엔진 입력 — DB 접근 없이 순수 계산만 하도록 필요한 것을 전부 받는다. */
export interface TextFitInput {
  /** 토크나이저의 `counts` — 내용어별 출현 횟수 */
  counts: Record<string, number>
  /** 토크나이저의 `totalWords` — 기능어 포함 러닝 워드 수 */
  totalTokens: number
  /** 학습자의 현재 V-Level (미진단이면 null → level_assumed 근거를 쓰지 않는다) */
  userVLevel: number | null
  /** `word_familiarity` — lemma → verdict */
  familiarity: Map<string, 'known' | 'unknown'>
  /** `vocabularies` — lemma → FSRS 상태 */
  fsrs: Map<string, FsrsState>
  /** 사전 V-Level — lemma → v_level */
  dictVLevel: Map<string, number>
  /** 판정 기준 시각 (테스트 재현성을 위해 주입) */
  now: Date
}

/**
 * 표제어 해석 경로 — 화면에서 판정의 정밀도를 밝히는 데 쓴다.
 *   headword_rpc          : `resolve_dict_headword` 정본 경로 (굴절형까지 접힘)
 *   exact_match_fallback  : RPC 부재 시 정확 일치만 — 굴절형이 미지어로 남아 **과소평가**된다
 */
export type ResolutionMode = 'headword_rpc' | 'exact_match_fallback'

/** 화면에 나가는 최종 판정 — 계산 결과 + 그 결과를 어떻게 얻었는지. */
export interface TextFitReport extends TextFitResult {
  /** 어떤 해석 경로로 잰 값인가 */
  resolutionMode: ResolutionMode
  /** 진단 완료 여부 — false 면 level_assumed 근거를 아예 쓰지 않았다 */
  isDiagnosed: boolean
}

/** FSRS 카드 상태 — 커버리지 감쇠 계산에 필요한 최소 필드. */
export interface FsrsState {
  /** 안정성 (일). null/0 이면 아직 복습 이력이 없다 */
  stability: number | null
  /** 마지막 복습 시각. null 이면 등록만 하고 한 번도 안 봤다 */
  lastReviewAt: Date | null
}
