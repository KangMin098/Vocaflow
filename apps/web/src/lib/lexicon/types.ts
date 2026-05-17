// apps/web/src/lib/lexicon/types.ts
//
// Lexicon v2.1 도메인 타입 + DB row 타입 + 변환 헬퍼.
// SSoT: docs/proposals/lexicon-v2.1/schema-v2.1.sql
//   (frequency_data_sources · word_lexicon · lexicon_source_tags · word_frequency_stats)

// ============================================================
// 1. 리터럴 타입 (DB CHECK 와 1:1 정합)
// ============================================================

/** winkNLP POS 태깅과 정합 */
export type PartOfSpeech =
  | 'n' | 'v' | 'adj' | 'adv'
  | 'prep' | 'conj' | 'pron' | 'det'
  | 'interj' | 'phrase';

/** CEFR 6 레벨 — 다른 도메인(SrsCard·LibraryText)과 공유 */
export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

/** lexicon_source_tags.source */
export type LexiconSource =
  | 'ncic_basic'
  | 'ncic_extended'
  | 'kice_csat'
  | 'kice_mock'
  | 'ebs_textbook'
  | 'middle_school'
  | 'high_school';

/** word_frequency_stats.source / frequency_data_sources.source_key */
export type FrequencySourceKey =
  | 'kice_csat'
  | 'kice_csat_recent'
  | 'kice_mock'
  | 'ebs_textbook'
  | 'academic_paper'
  | 'coca';

/** NCIC 학교급 (lexicon_source_tags.metadata.grade) */
export type NcicGrade = 'elementary' | 'middle' | 'high_common' | 'high_extended';

/** Frequency Tier (compute_frequency_tier 결과) */
export type FrequencyTier = 1 | 2 | 3 | 4 | 5;


// ============================================================
// 2. DB row 타입 (snake_case — Phase 2 database.ts 통합 전 임시)
// ============================================================

export interface FrequencyDataSourceRow {
  id: number;
  source_key: FrequencySourceKey;
  citation: string;
  license: string;
  url: string | null;
  created_at: string;
}

export interface WordLexiconRow {
  id: string;
  lemma: string;
  part_of_speech: PartOfSpeech;
  meaning_ko: string;
  meaning_ko_alt: string[] | null;
  ipa: string | null;
  pronunciation_us: string | null;
  cefr_level: CefrLevel | null;
  /** 15_lexicon_primary_sentence.sql 적용 후 추가. 이전엔 항상 null. */
  primary_sentence_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LexiconSourceTagRow {
  lexicon_id: string;
  source: LexiconSource;
  /** ncic_basic: { grade } / kice_csat: { first_year } */
  metadata: Record<string, unknown> | null;
  added_at: string;
}

export interface WordFrequencyStatsRow {
  id: string;
  lexicon_id: string;
  data_source_id: number;
  source: FrequencySourceKey;
  year_from: number | null;
  year_to: number | null;
  raw_count: number;
  normalized_freq: number | null;
  rank_in_source: number | null;
  /** 트리거 자동 계산 */
  frequency_tier: FrequencyTier;
  /** 트리거 자동 계산 */
  appears_every_year: boolean;
  /** { years_appeared: number[], first_year?: number } */
  metadata: Record<string, unknown>;
  computed_at: string;
}


// ============================================================
// 3. 도메인 모델 (camelCase — 코드에서 사용)
// ============================================================

export interface FrequencyDataSource {
  id: number;
  sourceKey: FrequencySourceKey;
  citation: string;
  license: string;
  url: string | null;
}

export interface WordLexicon {
  id: string;
  lemma: string;
  partOfSpeech: PartOfSpeech;
  meaningKo: string;
  meaningKoAlt: string[] | null;
  ipa: string | null;
  pronunciationUs: string | null;
  cefrLevel: CefrLevel | null;
  primarySentenceId: string | null;
}

export interface LexiconSourceTag {
  source: LexiconSource;
  /** ncic_basic 의 metadata.grade */
  grade?: NcicGrade;
  /** kice_csat 의 metadata.first_year */
  firstYear?: number;
  /** 원본 metadata (확장 정보 보존) */
  raw: Record<string, unknown>;
}

export interface FrequencyStat {
  source: FrequencySourceKey;
  yearFrom: number | null;
  yearTo: number | null;
  rawCount: number;
  normalizedFreq: number | null;
  rankInSource: number | null;
  tier: FrequencyTier;
  appearsEveryYear: boolean;
  /** metadata.years_appeared */
  yearsAppeared: number[];
  /** metadata.first_year (있는 경우) */
  firstYear?: number;
}

/** 단어 + 출처 태그 + 빈도 통계 통합 (UI 카드 1개 정보 단위) */
export interface LexiconEntry extends WordLexicon {
  sourceTags: LexiconSourceTag[];
  frequencyStats: FrequencyStat[];
}

/** Tier UI 배지 메타 */
export interface TierBadge {
  tier: FrequencyTier;
  stars: string;
  label: string;
  weight: 'critical' | 'high' | 'medium' | 'low' | 'minimal';
}


// ============================================================
// 4. UI 배지 매핑 (UI 레이어에서 직접 사용)
// ============================================================

export const TIER_BADGES: Record<FrequencyTier, TierBadge> = {
  5: { tier: 5, stars: '★★★★★', label: '필수',   weight: 'critical' },
  4: { tier: 4, stars: '★★★★☆', label: '고빈출', weight: 'high'     },
  3: { tier: 3, stars: '★★★☆☆', label: '중요',   weight: 'medium'   },
  2: { tier: 2, stars: '★★☆☆☆', label: '기출',   weight: 'low'      },
  1: { tier: 1, stars: '★☆☆☆☆', label: '예비',   weight: 'minimal'  },
};

/** raw_count = 0 (NCIC 등록은 됐으나 수능 미출제) UI 배지 */
export const TIER_UNRANKED_BADGE: TierBadge = {
  tier: 1,
  stars: '☆☆☆☆☆',
  label: '미출제',
  weight: 'minimal',
};

export const FREQUENCY_SOURCE_LABELS: Record<FrequencySourceKey, string> = {
  kice_csat_recent: '수능 10년',
  kice_csat:        '수능 전체',
  kice_mock:        '평가원 모의',
  ebs_textbook:     'EBS',
  academic_paper:   '학술 빈도',
  coca:             'COCA',
};

export const LEXICON_SOURCE_LABELS: Record<LexiconSource, string> = {
  ncic_basic:     'NCIC 기본',
  ncic_extended:  'NCIC 확장',
  kice_csat:      '수능',
  kice_mock:      '평가원 모의',
  ebs_textbook:   'EBS',
  middle_school:  '중학',
  high_school:    '고교',
};

export const NCIC_GRADE_LABELS: Record<NcicGrade, string> = {
  elementary:     '초등',
  middle:         '중학',
  high_common:    '고교 공통',
  high_extended:  '고교 확장',
};


// ============================================================
// 5. 변환 헬퍼 (DB row → 도메인 모델)
// ============================================================

export function rowToLexicon(row: WordLexiconRow): WordLexicon {
  return {
    id:                row.id,
    lemma:             row.lemma,
    partOfSpeech:      row.part_of_speech,
    meaningKo:         row.meaning_ko,
    meaningKoAlt:      row.meaning_ko_alt,
    ipa:               row.ipa,
    pronunciationUs:   row.pronunciation_us,
    cefrLevel:         row.cefr_level,
    primarySentenceId: row.primary_sentence_id ?? null,
  };
}

export function rowToSourceTag(row: LexiconSourceTagRow): LexiconSourceTag {
  const meta = (row.metadata ?? {}) as Record<string, unknown>;
  const grade = meta.grade as NcicGrade | undefined;
  const firstYear = meta.first_year as number | undefined;
  return {
    source:    row.source,
    grade,
    firstYear,
    raw:       meta,
  };
}

export function rowToFrequencyStat(row: WordFrequencyStatsRow): FrequencyStat {
  const meta = (row.metadata ?? {}) as Record<string, unknown>;
  const yearsRaw = meta.years_appeared;
  const yearsAppeared = Array.isArray(yearsRaw)
    ? (yearsRaw as unknown[]).filter((n): n is number => typeof n === 'number')
    : [];
  const firstYear = typeof meta.first_year === 'number' ? meta.first_year : undefined;
  return {
    source:           row.source,
    yearFrom:         row.year_from,
    yearTo:           row.year_to,
    rawCount:         row.raw_count,
    normalizedFreq:   row.normalized_freq,
    rankInSource:     row.rank_in_source,
    tier:             row.frequency_tier,
    appearsEveryYear: row.appears_every_year,
    yearsAppeared,
    firstYear,
  };
}

export function rowToFrequencyDataSource(row: FrequencyDataSourceRow): FrequencyDataSource {
  return {
    id:        row.id,
    sourceKey: row.source_key,
    citation:  row.citation,
    license:   row.license,
    url:       row.url,
  };
}


// ============================================================
// 6. UI 헬퍼
// ============================================================

/** 단어가 가진 가장 의미있는 tier 추출 (학습 출처 우선) */
export function pickPrimaryTier(stats: FrequencyStat[]): TierBadge {
  if (stats.length === 0) return TIER_UNRANKED_BADGE;

  const learningSources: FrequencySourceKey[] = [
    'kice_csat_recent', 'kice_csat', 'kice_mock', 'ebs_textbook',
  ];
  const learning = stats.find((s) => learningSources.includes(s.source));
  if (learning) return TIER_BADGES[learning.tier];

  return TIER_BADGES[stats[0].tier];
}

/** "수능 10년 ★★★★★ 필수 · 47회" */
export function formatFrequencyLine(stat: FrequencyStat): string {
  const badge = TIER_BADGES[stat.tier];
  const srcLabel = FREQUENCY_SOURCE_LABELS[stat.source];
  return `${srcLabel} ${badge.stars} ${badge.label} · ${stat.rawCount}회`;
}

/** "2014~2024년 매년 출제" */
export function formatYearsAppearedLine(stat: FrequencyStat): string | null {
  if (stat.appearsEveryYear && stat.yearFrom && stat.yearTo) {
    return `${stat.yearFrom}~${stat.yearTo}년 매년 출제`;
  }
  if (stat.yearsAppeared.length > 0) {
    return `${stat.yearsAppeared.length}개 연도 출제`;
  }
  return null;
}
