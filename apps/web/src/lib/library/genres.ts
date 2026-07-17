// apps/web/src/lib/library/genres.ts
//
// 큐레이션 genre_norm(~40종 세분) → 학습자 탐색용 broad 8버킷 매핑.
// genre_norm 은 한국어 자유텍스트("사회 소설"·"추리 단편집"…)라 키워드 substring 매칭.
// 매칭 순서가 의미를 가짐(구체 → 일반): 추리/SF 를 '문학·소설' 보다 먼저 판정.

export type GenreBucket =
  | 'mystery'
  | 'scifi_fantasy'
  | 'adventure_history'
  | 'romance'
  | 'poetry_drama'
  | 'essay_philosophy'
  | 'children_ya'
  | 'literary'

export interface GenreBucketMeta {
  key: GenreBucket
  label: string
  emoji: string
}

// 노출 순서 = 칩 표시 순서.
export const GENRE_BUCKETS: GenreBucketMeta[] = [
  { key: 'literary', label: '문학·소설', emoji: '📖' },
  { key: 'mystery', label: '추리·스릴러', emoji: '🔍' },
  { key: 'scifi_fantasy', label: 'SF·판타지', emoji: '🚀' },
  { key: 'adventure_history', label: '모험·역사', emoji: '🗺️' },
  { key: 'romance', label: '로맨스', emoji: '💗' },
  { key: 'poetry_drama', label: '시·희곡', emoji: '🎭' },
  { key: 'essay_philosophy', label: '에세이·인문·논픽션', emoji: '🧠' },
  { key: 'children_ya', label: '동화·청소년', emoji: '🧸' },
]

const GENRE_LABEL: Record<GenreBucket, string> = Object.fromEntries(
  GENRE_BUCKETS.map((b) => [b.key, b.label]),
) as Record<GenreBucket, string>

export function genreBucketLabel(key: GenreBucket): string {
  return GENRE_LABEL[key]
}

// 키워드 규칙 — 구체 버킷 먼저(순서 중요). '우화'·'그림책' 이 essay/정보 키워드보다 먼저 매칭돼
// STEM 그림책·동물 우화가 동화·청소년으로 정상 분류됨(순서 의존).
const RULES: Array<{ key: GenreBucket; kws: string[] }> = [
  { key: 'children_ya', kws: ['동화', '아동', '청소년', '그림책', '우화'] },
  { key: 'mystery', kws: ['추리', '범죄', '스릴러', '미스터리', '탐정', '괴기', '공포'] },
  { key: 'scifi_fantasy', kws: ['SF', '에스에프', '공상과학', '환상', '판타지', '고딕'] },
  { key: 'romance', kws: ['로맨스', '연애'] },
  { key: 'poetry_drama', kws: ['시', '운문', '희곡', '비극', '사극', '희극', '서사시', '드라마'] },
  {
    // 인문·논픽션 — 철학/전기 + 학술·정책·보고서 등 비문학 정보서 (NULL→literary 오분류 방지)
    key: 'essay_philosophy',
    kws: [
      '철학', '정치', '에세이', '논설', '자서전', '전기', '회고', '사상', '종교', '역사서',
      '학술', '정책', '보고서', '논픽션', '사회학', '교과서',
    ],
  },
  { key: 'adventure_history', kws: ['모험', '역사', '서부', '전쟁', '항해'] },
  // literary 는 fallback (아래 bucketOf 가 처리)
]

/**
 * genre_norm → broad 버킷. 매칭 실패 시 'literary'(문학·소설). null/빈값도 'literary'.
 * ⚠️ NULL/미매칭 폴백이 'literary' 라, genre_norm 이 비면 소설이 아닌 책도 문학으로 분류됨.
 *    발행 도서의 genre_norm NULL 은 큐레이션 백필로 해소해야 근본 정확(프론트 한계).
 */
export function bucketOf(genreNorm: string | null | undefined): GenreBucket {
  if (!genreNorm) return 'literary'
  const g = genreNorm.trim()
  for (const r of RULES) {
    if (r.kws.some((kw) => g.includes(kw))) return r.key
  }
  return 'literary'
}

// ── 길이 버킷 ─────────────────────────────────────────────
// reading_minutes 기준 5밴드. 카탈로그 분포(2분~120시간)가 이전 3버킷의 '길게'(>4h)에
// 73% 몰렸던 것을 4~10h · 10~20h · 20h+(대작)로 분리 — 읽기 부담 판단이 명확.
// 임계: 60 / 240 / 600 / 1200 분 (= 1 / 4 / 10 / 20 시간).
export type LengthBucket = 'short' | 'medium' | 'long' | 'xlong' | 'epic'

export interface LengthBucketMeta {
  key: LengthBucket
  label: string
}

export const LENGTH_BUCKETS: LengthBucketMeta[] = [
  { key: 'short', label: '짧게 (~1시간)' },
  { key: 'medium', label: '1~4시간' },
  { key: 'long', label: '4~10시간' },
  { key: 'xlong', label: '10~20시간' },
  { key: 'epic', label: '20시간+' },
]

export function lengthBucket(minutes: number | null | undefined): LengthBucket | null {
  if (minutes == null || minutes <= 0) return null
  if (minutes < 60) return 'short'
  if (minutes < 240) return 'medium'
  if (minutes < 600) return 'long'
  if (minutes < 1200) return 'xlong'
  return 'epic'
}

// ── V-레벨 밴드 ───────────────────────────────────────────
// Vocaflow VRL 12단계(V1–V11) → 학습자 친화 5밴드. CEFR-J 매핑과 대략 정합
// (V1→A1 · V6→B1 · V8→B2 · V9+→C). 레벨 필터의 단일 단위 = V (CEFR 는 카드 배지 보조).
export type VBand = 'intro' | 'beginner' | 'intermediate' | 'upper' | 'advanced'

export interface VBandMeta {
  key: VBand
  label: string
  short: string
  min: number
  max: number
}

export const V_BANDS: VBandMeta[] = [
  { key: 'intro', label: '입문', short: 'V1–2', min: 1, max: 2 },
  { key: 'beginner', label: '초급', short: 'V3–4', min: 3, max: 4 },
  { key: 'intermediate', label: '중급', short: 'V5–6', min: 5, max: 6 },
  { key: 'upper', label: '중상급', short: 'V7–8', min: 7, max: 8 },
  { key: 'advanced', label: '고급', short: 'V9–11', min: 9, max: 11 },
]

export function vBandOf(level: number | null | undefined): VBand | null {
  if (level == null) return null
  const b = V_BANDS.find((x) => level >= x.min && level <= x.max)
  return b ? b.key : null
}

// ── 연령 밴드 ─────────────────────────────────────────────
// curation_meta.age_band ("5+"·"10+"·"17+"…) → 3밴드 (선택 보조용).
export type AgeBand = 'children' | 'teen' | 'adult'

export interface AgeBandMeta {
  key: AgeBand
  label: string
}

export const AGE_BANDS: AgeBandMeta[] = [
  { key: 'children', label: '어린이' },
  { key: 'teen', label: '청소년' },
  { key: 'adult', label: '성인' },
]

export function ageBandOf(age: string | null | undefined): AgeBand | null {
  if (!age) return null
  const n = parseInt(age, 10)
  if (Number.isNaN(n)) return null
  if (n < 10) return 'children'
  if (n <= 15) return 'teen'
  return 'adult'
}
