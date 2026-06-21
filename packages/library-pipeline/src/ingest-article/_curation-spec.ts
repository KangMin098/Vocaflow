// packages/library-pipeline/src/ingest-article/_curation-spec.ts
//
// LCP 대량 수집 — 소스/피드별 큐레이션 spec.
//
// 각 source 의 RSS 항목을 학습 친화도 score 로 순위화하기 위한 조건/가중치.
// listXxxFeed() 에서 import 해 적용.
//
// 설계 원칙:
//   1. 학습 친화도(LearningFit) — VOA L1 > L2 > L3 > 일반 뉴스
//   2. 신선도(Recency)        — feed 성격에 따라 cutoff 차등 (APOD ∞)
//   3. 길이 적합(LengthFit)   — description 길이가 학습용 본문 추정에 비례
//   4. 노이즈 제거(Filter)    — stub/placeholder/공지 type 제외
//
// 사용처: list*Feed() 직후 applyArticleCurationSpec() 호출 → score 부여 + 필터링.

// v06.69 — arxiv 제거 (사용자 명시: "플랫폼 전체에서 삭제"). 6종 가용.
export type SourceKey =
  | 'voa'
  | 'nasa'
  | 'nih'
  | 'wikinews'
  | 'the_conversation'
  | 'simple_wikipedia'

export interface FeedSpec {
  /** 신선도 컷오프 (일). null=무한 (APOD 등 timeless). */
  recencyDays: number | null
  /** description 최소 길이 (학습 본문 quality proxy) */
  minDescriptionLen: number
  /** title 최소 길이 (placeholder 제거) */
  minTitleLen: number
  /** 소스 가중치 (0~1) — 학습자 친화 정도. VOA > NASA > NIH */
  sourceWeight: number
  /** 레벨 보너스 — VOA L1 강조용 (-1 ~ +1) */
  levelBonus: number
  /** description 이상적 길이 (LengthFit 정점) */
  idealDescLen: number
  /** 노이즈 키워드 (제목에 포함시 차감) */
  noiseKeywords: ReadonlyArray<string>
  /** 최종 반환 max items (filter 후 score 정렬 → top N) */
  maxItems: number
  /** frozen archive (정지된 PD 소스). true 면 score 에서 recency 축 제거
   *  (source 0.45 / length 0.25 재분배) + 730일 stale cliff 면제. VOA 전용. */
  frozen?: boolean
}

/** feed 별 spec — feed_id 가 키, 없으면 source 기본값 사용. */
export const FEED_SPECS: Record<string, FeedSpec> = {
  // ─── VOA — 학습 친화도 최상 (CEFR 1-3 등급) ───────────────────
  'voa:lets-learn-english': {
    frozen: true,           // P1 — frozen archive: recency 축 제거 + 730일 cliff 면제
    recencyDays: 365,       // 학습 자료는 1년 stale OK
    minDescriptionLen: 50,
    minTitleLen: 15,
    sourceWeight: 1.00,     // 학습 최적 — VOA L1
    levelBonus: 0.30,       // A2 — 입문자 최강 친화
    idealDescLen: 200,
    noiseKeywords: ['archive', 'index'],
    maxItems: 15,
  },
  'voa:as-it-is': {
    frozen: true,           // P1 — frozen archive: recency 축 제거 + 730일 cliff 면제
    // v06.44 — recencyDays 180→365 (VOA 학습용 자료 stale 잘 안 됨, lets-learn/words 와 정합)
    //           minDescriptionLen 80→40 (VOA RSS 일부 항목 description 빈 패턴 흡수)
    recencyDays: 365,
    minDescriptionLen: 40,
    minTitleLen: 18,
    sourceWeight: 0.95,
    levelBonus: 0.15,       // B1
    idealDescLen: 250,
    noiseKeywords: ['archive', 'index'],
    maxItems: 15,
  },
  'voa:science-technology': {
    frozen: true,           // P1 — frozen archive: recency 축 제거 + 730일 cliff 면제
    recencyDays: 365,
    minDescriptionLen: 40,
    minTitleLen: 18,
    sourceWeight: 0.90,
    levelBonus: 0.10,
    idealDescLen: 250,
    noiseKeywords: ['archive'],
    maxItems: 15,
  },
  'voa:words-and-their-stories': {
    frozen: true,           // P1 — frozen archive: recency 축 제거 + 730일 cliff 면제
    recencyDays: 365,       // idiom 학습 자료 1년+ OK
    minDescriptionLen: 40,  // v06.44 — VOA RSS description 빈 항목 흡수
    minTitleLen: 15,
    sourceWeight: 0.92,
    levelBonus: 0.05,       // B2
    idealDescLen: 250,
    noiseKeywords: ['archive'],
    maxItems: 12,
  },

  // ─── VOA register gap 보강 (P2) — 서사 + 설명문. 둘 다 frozen archive ──
  'voa:american-stories': {
    frozen: true,           // P2 — frozen archive: recency 축 제거 + 730일 cliff 면제
    recencyDays: 365,
    minDescriptionLen: 40,
    minTitleLen: 15,
    sourceWeight: 0.90,
    levelBonus: 0.05,       // B2 — 고전 단편 서사 (어휘 풍부)
    idealDescLen: 250,
    noiseKeywords: ['archive', 'index'],
    maxItems: 15,
  },
  'voa:health-lifestyle': {
    frozen: true,           // P2 — frozen archive: recency 축 제거 + 730일 cliff 면제
    recencyDays: 365,
    minDescriptionLen: 40,
    minTitleLen: 18,
    sourceWeight: 0.90,
    levelBonus: 0.10,       // B1 — consumer-facing 건강·생활 설명문
    idealDescLen: 250,
    noiseKeywords: ['archive', 'index'],
    maxItems: 15,
  },

  // ─── NASA — 흥미 ↑ + PD ───────────────────────────────────────
  'nasa:news': {
    recencyDays: 30,        // 뉴스 신선도 중요
    minDescriptionLen: 120,
    minTitleLen: 20,
    sourceWeight: 0.85,
    levelBonus: 0,
    idealDescLen: 300,
    noiseKeywords: ['advisory', 'briefing', 'media call'],
    maxItems: 12,
  },
  'nasa:apod': {
    recencyDays: null,      // 천문 일사진 — timeless
    minDescriptionLen: 100,
    minTitleLen: 8,         // APOD 제목 짧음 (예: "Mars")
    sourceWeight: 0.90,     // 시각 매력 ↑ 학습자 흥미
    levelBonus: 0.05,
    idealDescLen: 350,
    noiseKeywords: [],
    maxItems: 15,
  },
  'nasa:iotd': {
    recencyDays: 60,
    minDescriptionLen: 80,
    minTitleLen: 12,
    sourceWeight: 0.82,
    levelBonus: 0,
    idealDescLen: 250,
    noiseKeywords: [],
    maxItems: 12,
  },

  // ─── NIH — 의학·건강 (전문도 ↑) ────────────────────────────────
  'nih:medlineplus': {
    recencyDays: 14,        // 건강 정보 신선도 중요
    minDescriptionLen: 120,
    minTitleLen: 20,
    sourceWeight: 0.80,
    levelBonus: 0.10,       // consumer-facing = 학습자 친화 ↑
    idealDescLen: 300,
    noiseKeywords: ['recall', 'alert'],
    maxItems: 12,
  },
  'nih:directors-blog': {
    recencyDays: 90,
    minDescriptionLen: 150,
    minTitleLen: 25,
    sourceWeight: 0.75,
    levelBonus: -0.05,      // 전문 - 학습자 약간 어려움
    idealDescLen: 400,
    noiseKeywords: [],
    maxItems: 10,
  },
  'nih:news': {
    recencyDays: 21,
    minDescriptionLen: 120,
    minTitleLen: 25,
    sourceWeight: 0.78,
    levelBonus: -0.05,
    idealDescLen: 300,
    noiseKeywords: ['advisory', 'recall'],
    maxItems: 10,
  },

  // v06.69 — arXiv 관련 FEED_SPECS 6종 제거 (소스 자체가 플랫폼에서 삭제됨).
}

/** Source 기본 spec — feed 별 spec 미정 시 fallback */
export const SOURCE_DEFAULT_SPEC: Record<SourceKey, FeedSpec> = {
  voa: {
    frozen: true,           // P1 — frozen archive: recency 축 제거 + 730일 cliff 면제
    recencyDays: 180,
    minDescriptionLen: 80,
    minTitleLen: 18,
    sourceWeight: 0.90,
    levelBonus: 0.10,
    idealDescLen: 250,
    noiseKeywords: ['archive'],
    maxItems: 15,
  },
  nasa: {
    recencyDays: 30,
    minDescriptionLen: 100,
    minTitleLen: 20,
    sourceWeight: 0.85,
    levelBonus: 0,
    idealDescLen: 300,
    noiseKeywords: ['advisory'],
    maxItems: 12,
  },
  nih: {
    // v06.71 — MedlinePlus What's New 본문이 본질적으로 매우 짧음 (대부분 30-60자).
    //   가드 완화: minDescriptionLen 120→40, minTitleLen 25→15, recencyDays 21→365.
    //   실측: 54 parsed → 가드 완화 후 ~30+ pass.
    recencyDays: 365,
    minDescriptionLen: 40,
    minTitleLen: 15,
    sourceWeight: 0.78,
    levelBonus: 0,
    idealDescLen: 120,
    noiseKeywords: ['recall', 'advisory'],
    maxItems: 30,
  },
  // v06.66 — 신규 3종
  wikinews: {
    recencyDays: 30,
    minDescriptionLen: 80,
    minTitleLen: 20,
    sourceWeight: 0.70,
    levelBonus: 0,
    idealDescLen: 280,
    noiseKeywords: ['talk:', 'wikinews:'],
    maxItems: 24,
  },
  the_conversation: {
    recencyDays: 21,
    minDescriptionLen: 200,
    minTitleLen: 30,
    sourceWeight: 0.75,
    levelBonus: -0.05,
    idealDescLen: 400,
    noiseKeywords: ['retraction', 'correction'],
    maxItems: 20,
  },
  simple_wikipedia: {
    recencyDays: 9999,    // wikipedia 는 시간 무관 — recencyDays 사실상 비활성
    minDescriptionLen: 60, // v06.67 — extract 가 짧은 페이지도 통과 (Simple Wikipedia 특성)
    minTitleLen: 3,        // "Bird" 같은 짧은 제목 허용
    sourceWeight: 0.85,    // 학습 친화 ↑ (통제 어휘)
    levelBonus: 0.08,
    idealDescLen: 250,
    noiseKeywords: ['disambiguation', 'list of'],
    maxItems: 30,
  },
}

/** RSS item 인터페이스 — listXxxFeed 의 반환 타입과 호환 */
interface ScorableItem {
  title: string
  published_at: string | null
  description: string
}

/** 학습 친화도 score 결과 (0~1) + breakdown */
export interface ArticleScore {
  /** 종합 score (0~1) — 정렬 키 */
  total: number
  /** 신선도 (0~1) */
  recency: number
  /** 소스 가중치 (spec 그대로) */
  source: number
  /** description 길이 적합 (0~1) */
  length: number
  /** 레벨 보너스 (spec 그대로, -0.3~+0.3) */
  level: number
}

/**
 * 단일 item 의 학습 친화도 score 계산.
 *
 * 가중치: recency(0.40) + sourceWeight(0.30) + lengthFit(0.20) + levelBonus(0.10)
 */
export function scoreArticleFit(item: ScorableItem, spec: FeedSpec): ArticleScore {
  // 1) Recency — published_at 가까울수록 1, recencyDays 초과 시 0
  let recency = 0.5 // 발행일 미상 default
  if (item.published_at) {
    const ageDays = (Date.now() - new Date(item.published_at).getTime()) / 86400_000
    if (spec.recencyDays === null) {
      recency = 0.7 // timeless feed (APOD) — 발행일 무관 약간 가산
    } else if (ageDays < 0) {
      recency = 1 // 미래 발행 (RSS 캐시 이상치) — 우대 X 도 아닌 1로
    } else {
      recency = Math.max(0, 1 - ageDays / spec.recencyDays)
    }
  }

  // 2) Source weight — spec 그대로
  const source = spec.sourceWeight

  // 3) Length fit — bell curve: idealDescLen 정점, 너무 짧/너무 길면 ↓
  const dlen = item.description.length
  let length = 0
  if (dlen < spec.minDescriptionLen) {
    length = 0 // 필터에서 걸러져야 정상 (안전망)
  } else {
    const ratio = dlen / spec.idealDescLen
    // ratio=1 정점 1, ratio<1 비례 감소, ratio>1.5 부드러운 감소
    if (ratio <= 1) length = ratio
    else length = Math.max(0.4, 1 - (ratio - 1) * 0.4)
  }

  // 4) Level bonus — spec 그대로 (-0.3 ~ +0.3 정상 범위)
  const level = spec.levelBonus

  // 합성 — 가중치 합 = 1.0 + level 보너스
  // frozen feed 는 recency 축(0.40)이 stale 로 사문화 → source/length 재분배
  const total = spec.frozen
    ? source * 0.45 + length * 0.25 + level
    : recency * 0.40 + source * 0.30 + length * 0.20 + level

  return {
    total: Math.max(0, Math.min(1, total)),
    recency,
    source,
    length,
    level,
  }
}

/** 필터: 노이즈 제거 + 길이 검증. 통과 시 true. */
export function passesArticleFilter(item: ScorableItem, spec: FeedSpec): boolean {
  // title placeholder
  if (item.title.length < spec.minTitleLen) return false
  if (/^\(?제목\s*(없음|미상)\)?$/i.test(item.title)) return false
  // 노이즈 키워드
  const titleLower = item.title.toLowerCase()
  for (const kw of spec.noiseKeywords) {
    if (titleLower.includes(kw)) return false
  }
  // description 최소 길이
  if (item.description.length < spec.minDescriptionLen) return false
  // recency cutoff (recencyDays != null 일 때만). frozen archive 는 cliff 면제.
  if (!spec.frozen && spec.recencyDays !== null && item.published_at) {
    const ageDays = (Date.now() - new Date(item.published_at).getTime()) / 86400_000
    // 2배 grace 까지는 통과 (score 에서 자연 감점). 그 이상은 stale.
    if (ageDays > spec.recencyDays * 2) return false
  }
  return true
}

/**
 * 통합 helper: source/feedId 에 맞는 spec 으로 필터링 + scoring + sort + top N.
 *
 * 반환: 각 item 에 `score` 필드 부여된 새 배열 (score 내림차순).
 */
export function applyArticleCurationSpec<T extends ScorableItem>(
  items: T[],
  source: SourceKey,
  feedId: string,
): Array<T & { score: ArticleScore }> {
  const spec = FEED_SPECS[`${source}:${feedId}`] ?? SOURCE_DEFAULT_SPEC[source]

  const passed = items
    .filter((it) => passesArticleFilter(it, spec))
    .map((it) => ({ ...it, score: scoreArticleFit(it, spec) }))

  passed.sort((a, b) => b.score.total - a.score.total)

  return passed.slice(0, spec.maxItems)
}

/** Source/feedId 의 spec 가져오기 (UI에서 표시용) */
export function getFeedSpec(source: SourceKey, feedId: string): FeedSpec {
  return FEED_SPECS[`${source}:${feedId}`] ?? SOURCE_DEFAULT_SPEC[source]
}

// ═══════════════════════════════════════════════════════════════════
// SOURCE-LEVEL SPEC (v06.42)
// ─────────────────────────────────────────────────────────────────
// feed 레벨 spec 위에 적용되는 소스 레벨 거버넌스:
//   · 학습자 수준별 추천 순위 (beginner/intermediate/advanced)
//   · 소스당 배치 cap (한 소스가 결과 과점 방지)
//   · 소스 minScore floor (소스 본질적 품질 한계 정합)
//   · target CEFR 범위 (학습자 매칭)
//   · 라이선스 + attribution 의무
//   · 토픽 도메인 + 문체 (학습자에게 가시화)
//   · 소스내 feed 비중 (preferredFeedMix — 균등 X)
// ═══════════════════════════════════════════════════════════════════

export type LearnerLevel = 'beginner' | 'intermediate' | 'advanced'

export interface SourceSpec {
  /** 적합한 학습자 수준 (multi) */
  targetLevels: ReadonlyArray<LearnerLevel>
  /** target CEFR 범위 — 학습자 매칭 가이드 */
  targetCefr: { min: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'; max: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' }
  /** 한 batch 에서 이 소스로부터 최대 가져올 항목 수 (모든 feed 합산 후 cap) */
  maxItemsPerBatch: number
  /** 이 소스의 학습 적합도 minScore (이하 자동 제거) */
  minScore: number
  /** 기본 bulk 우선순위 (낮을수록 우선, 1=최우선) */
  bulkPriority: number
  /** 라이선스 — UI 표시 + analyze 단계 입력 */
  license: string
  /** attribution 의무 여부 (학술 인용 등) */
  attributionRequired: boolean
  /** 강점 토픽 도메인 */
  topicDomain: ReadonlyArray<string>
  /** 문체 특성 (학습자에게 가시화) */
  styleGuide: string
  /** 소스내 feed 비중 (균등 X — 학습 적합도 차이 반영) */
  preferredFeedMix: ReadonlyArray<{ feedId: string; weight: number }>
}

/**
 * 소스별 spec — 학습 친화도 · 라이선스 · 토픽 · 우선순위 종합.
 *
 * 설계 근거:
 *  · VOA = U.S. federal government Learning English → 학습 적합 최우선, PD
 *  · NASA = PD, 천문·우주 흥미 매력 ↑, APOD 시각 자료
 *  · NIH = PD 의학·건강, MedlinePlus consumer-facing
 *  · Simple Wikipedia = A2-B1 통제 어휘, CC-BY-SA
 *  · Wikinews = CC-BY 시사 (현재 거의 비활성)
 *  · The Conversation = CC-BY-ND 학자 논증문, display_only
 */
export const SOURCE_SPECS: Record<SourceKey, SourceSpec> = {
  voa: {
    targetLevels: ['beginner', 'intermediate'],
    targetCefr: { min: 'A2', max: 'B2' },
    maxItemsPerBatch: 30,        // 6 feeds × ~15 → 30 cap (P2: +american-stories +health-lifestyle)
    minScore: 0.40,
    bulkPriority: 1,             // 학습 친화 최우선
    license: 'PD-Government',
    attributionRequired: false,  // VOA = U.S. federal → 인용 자유
    topicDomain: ['news', 'idioms', 'science', 'culture', 'language-learning', 'narrative', 'health'],
    styleGuide: '학습자 친화 단순 문체 · CEFR 1-3 등급 명시 콘텐츠',
    // P2 — 6 feed 재분배 (합 1.00). register gap 보강 feed(american/health)에 실질 비중.
    preferredFeedMix: [
      { feedId: 'as-it-is', weight: 0.22 },
      { feedId: 'lets-learn-english', weight: 0.22 },      // L1 - 입문 강조
      { feedId: 'science-technology', weight: 0.16 },
      { feedId: 'american-stories', weight: 0.16 },        // 서사 register gap
      { feedId: 'words-and-their-stories', weight: 0.12 }, // idiom 학습
      { feedId: 'health-lifestyle', weight: 0.12 },        // 설명문 register gap
    ],
  },
  nasa: {
    targetLevels: ['intermediate'],
    targetCefr: { min: 'B1', max: 'C1' },
    maxItemsPerBatch: 24,        // 3 feeds × ~12-15 → 24 cap
    minScore: 0.45,
    bulkPriority: 2,             // 학습 친화 ↑ (시각 매력 + 흥미)
    license: 'PD-Government',
    attributionRequired: false,  // 권장이지만 법적 의무 X
    topicDomain: ['astronomy', 'space', 'science', 'engineering'],
    styleGuide: '뉴스 기사 + 천문 일사진 (시각 자료 풍부 · 학습자 호기심 자극)',
    preferredFeedMix: [
      { feedId: 'apod', weight: 0.50 },   // 천문 사진 - 학습자 흥미 최고
      { feedId: 'news', weight: 0.30 },
      { feedId: 'iotd', weight: 0.20 },
    ],
  },
  nih: {
    targetLevels: ['intermediate', 'advanced'],
    targetCefr: { min: 'B2', max: 'C1' },
    maxItemsPerBatch: 18,        // 3 feeds × ~10-12 → 18 cap
    minScore: 0.45,
    bulkPriority: 3,
    license: 'PD-Government',
    attributionRequired: false,
    topicDomain: ['health', 'medical', 'biomedical-research', 'public-health'],
    styleGuide: '의학·건강 뉴스 (MedlinePlus = consumer-facing, 그 외 전문)',
    preferredFeedMix: [
      { feedId: 'medlineplus', weight: 0.60 },   // 환자친화 · 학습 적합 ↑
      { feedId: 'directors-blog', weight: 0.25 },
      { feedId: 'news', weight: 0.15 },           // 현재 403 차단 - 백업
    ],
  },
  // v06.69 — arXiv SOURCE_SPECS 제거 (소스 자체가 플랫폼에서 삭제됨).
  // v06.66 — Wikinews: 시사 뉴스, CC-BY-2.5, B1-B2 적합
  wikinews: {
    targetLevels: ['intermediate'],
    targetCefr: { min: 'B1', max: 'B2' },
    maxItemsPerBatch: 24,
    minScore: 0.40,
    bulkPriority: 5,
    license: 'CC-BY-2.5',
    attributionRequired: true,   // CC-BY — Wikinews contributors 인용
    topicDomain: ['news', 'politics', 'world', 'culture'],
    styleGuide: '시사 뉴스 (Wikipedia 자매 프로젝트, neutral POV)',
    preferredFeedMix: [
      { feedId: 'latest', weight: 1.00 },
    ],
  },
  // v06.66 — The Conversation: 학자 논증문, CC-BY-ND (display_only), B2-C1, CSAT 최난이도 유사
  the_conversation: {
    targetLevels: ['intermediate', 'advanced'],
    targetCefr: { min: 'B2', max: 'C1' },
    maxItemsPerBatch: 20,
    minScore: 0.45,
    bulkPriority: 6,
    license: 'CC-BY-ND-4.0',
    attributionRequired: true,
    topicDomain: ['analysis', 'science', 'politics', 'economy', 'culture'],
    styleGuide: '학자 논증문 (CSAT 최난이도 지문과 최유사) · 본문 verbatim only',
    preferredFeedMix: [
      { feedId: 'all', weight: 1.00 },
    ],
  },
  // v06.66 — Simple Wikipedia: A2-B1 통제 어휘, CC-BY-SA, MediaWiki API categorymembers
  simple_wikipedia: {
    targetLevels: ['beginner', 'intermediate'],
    targetCefr: { min: 'A2', max: 'B1' },
    maxItemsPerBatch: 30,
    minScore: 0.40,
    bulkPriority: 7,
    license: 'CC-BY-SA-4.0',
    attributionRequired: true,
    topicDomain: ['reference', 'science', 'history', 'culture', 'biology'],
    styleGuide: 'Simple English 통제 어휘 (Basic English 850 단어 권장) · 학습 친화 ↑',
    preferredFeedMix: [
      { feedId: 'very-good', weight: 0.60 },     // Very good articles 카테고리
      { feedId: 'good', weight: 0.40 },          // Good articles 카테고리
    ],
  },
}

/**
 * 학습자 수준별 소스 추천 순위.
 *
 *  · beginner    (A1-A2): VOA 압도적 + Simple Wikipedia, NASA 일부 가능
 *  · intermediate(B1-B2): VOA + Simple Wikipedia + NASA + Wikinews + NIH
 *  · advanced    (C1+):    The Conversation 우선, NIH/NASA 보조, VOA 너무 쉬움
 *
 * BulkArticlesTab 에서 학습자 수준 선택 시 이 순서로 소스 자동 재정렬.
 */
export const SOURCE_RANKINGS_BY_LEVEL: Record<LearnerLevel, ReadonlyArray<SourceKey>> = {
  beginner:     ['voa', 'simple_wikipedia', 'nasa', 'wikinews', 'nih', 'the_conversation'],
  intermediate: ['voa', 'simple_wikipedia', 'nasa', 'wikinews', 'nih', 'the_conversation'],
  advanced:     ['the_conversation', 'nih', 'nasa', 'wikinews', 'voa', 'simple_wikipedia'],
}

/**
 * 소스 spec 가져오기 — UI 표시용
 */
export function getSourceSpec(source: SourceKey): SourceSpec {
  return SOURCE_SPECS[source]
}

/**
 * 학습자 수준에 맞는 소스 순서 반환 (BulkArticlesTab 자동 정렬용).
 *
 * 동시에 각 소스가 해당 학습자 수준에 fit 한지 (targetLevels 포함 여부) 도 표시.
 */
export function getSourceOrderForLevel(level: LearnerLevel): Array<{
  source: SourceKey
  isRecommended: boolean
  priority: number
}> {
  return SOURCE_RANKINGS_BY_LEVEL[level].map((source, i) => ({
    source,
    isRecommended: SOURCE_SPECS[source].targetLevels.includes(level),
    priority: i + 1,
  }))
}

/**
 * 소스 레벨 cap 적용 — bulk merge 후 같은 소스 그룹별로 호출.
 *
 *  1. 학습 적합도 score 내림차순 정렬
 *  2. 소스 minScore 이하 제거
 *  3. 소스 maxItemsPerBatch 까지만 유지
 *  4. 소스내 feed mix 비중에 따라 균등 분포 보장 (특정 feed 가 과점 방지)
 */
export function applySourceLevelCap<T extends { feed_id: string; score?: ArticleScore }>(
  items: T[],
  source: SourceKey,
): T[] {
  const spec = SOURCE_SPECS[source]

  // 1+2: minScore 필터 + score 내림차순
  const sorted = items
    .filter((it) => (it.score?.total ?? 0) >= spec.minScore)
    .sort((a, b) => (b.score?.total ?? 0) - (a.score?.total ?? 0))

  if (sorted.length <= spec.maxItemsPerBatch) {
    return sorted
  }

  // 4: feed mix 균등 분포 — preferredFeedMix 비중에 따라 각 feed 가 받을 quota 계산
  const feedQuotas = new Map<string, number>()
  let allocatedTotal = 0
  for (const m of spec.preferredFeedMix) {
    const q = Math.floor(spec.maxItemsPerBatch * m.weight)
    feedQuotas.set(m.feedId, q)
    allocatedTotal += q
  }
  // 남은 quota 는 첫 feed (최고 priority) 에 추가
  if (allocatedTotal < spec.maxItemsPerBatch && spec.preferredFeedMix.length > 0) {
    const first = spec.preferredFeedMix[0]!.feedId
    feedQuotas.set(first, (feedQuotas.get(first) ?? 0) + (spec.maxItemsPerBatch - allocatedTotal))
  }

  // greedy pick — 각 feed quota 채우며 score 내림차순으로 선택
  const taken = new Map<string, number>()
  const picked: T[] = []
  for (const it of sorted) {
    const usedInFeed = taken.get(it.feed_id) ?? 0
    const quota = feedQuotas.get(it.feed_id) ?? 0
    if (usedInFeed < quota) {
      picked.push(it)
      taken.set(it.feed_id, usedInFeed + 1)
    }
    if (picked.length >= spec.maxItemsPerBatch) break
  }

  // quota 가 못 채워서 부족하면 score 순으로 추가 (예: 한 feed 가 spec quota 보다 적은 항목 보유)
  if (picked.length < spec.maxItemsPerBatch) {
    const pickedKeys = new Set(picked)
    for (const it of sorted) {
      if (pickedKeys.has(it)) continue
      picked.push(it)
      if (picked.length >= spec.maxItemsPerBatch) break
    }
  }

  return picked
}
