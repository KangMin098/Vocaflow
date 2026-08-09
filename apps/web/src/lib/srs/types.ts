// packages/ui-shared/src/srs/types.ts
// Vocaflow SRS — 도메인 타입 정의
// CLAUDE.md §17 학습 모델 v2.0 — [4] 기억 축 + [7] 데이터 축 정합
// FSRS 호환 3변수(D/S/R) → Memory Decay 4색 동적 매핑

/**
 * Memory Decay 4상태 — CLAUDE.md §"Memory Decay 색 체계" 정합
 * R(t) 동적 계산 결과만 사용 — DB 직접 저장 금지 (§17 안티패턴)
 */
export type MemoryState = 'new' | 'stable' | 'shaky' | 'risk';

/**
 * 사용자 회상 평가 — FSRS 4단계 (Anki/RemNote 호환)
 * DB `learning_records.rating` 컬럼에 1~4로 저장
 */
export const Rating = {
  Again: 1, // 완전히 잊음 → Stability 큰폭 감소
  Hard: 2, // 떠올렸으나 어려웠음
  Good: 3, // 정상 회상
  Easy: 4, // 매우 쉬웠음 → Stability 큰폭 증가
} as const;

export type RatingValue = (typeof Rating)[keyof typeof Rating];

/**
 * SRS 단어 카드 — Supabase `vocabularies` 테이블 컬럼 정합
 * §17.7 데이터 축 — vocabularies 6 신규 컬럼
 */
export interface SrsCard {
  /** 단어 고유 ID (vocabularies.id) */
  id: string;

  /** FSRS Difficulty — 1.0~10.0 (mean reversion으로 ease hell 방지) */
  difficulty: number;

  /** FSRS Stability — 일 단위 (100%→90% 감쇠까지의 일수) */
  stability: number;

  /** 마지막 review 시각 (vocabularies.last_review_at) */
  lastReviewAt: Date | null;

  /** 다음 review due 시각 (vocabularies.next_review_at) */
  nextReviewAt: Date | null;

  /** 거쳐온 모듈 이력 (vocabularies.module_history) */
  moduleHistory: ModuleId[];

  /** 누적 review 횟수 (vocabularies.review_count) */
  reviewCount: number;
}

/**
 * 8개 학습 모듈 식별자 — CLAUDE.md §"핵심 모듈 8개" 정합
 * learning_records.module enum 값과 1:1 대응
 */
export type ModuleId =
  | 'flashcard'
  | 'spellforge'
  | 'wordblitz'
  | 'pairflip' // L4a 공간기억 — DB module_id enum 정합
  | 'scriptquiz'
  | 'dictation'
  | 'wordvault' // 노출(L3)만, retrieve 아님
  | 'workspace' // L2 hover 인터랙션
  | 'textviewer' // L1
  // ── 신규 게임 6종 (v07.3 arcade suite) — DB enum 확장 마이그레이션 후 persistence 활성 ──
  | 'cascade' // L4a 재인·공간 (매치)
  | 'connections' // L5 의미 그룹핑
  | 'word-economy' // L4a 전략 인출
  | 'daily-blitz' // 리텐션 데일리
  | 'letter-forge' // L4b 철자 생성
  | 'ghost-race' // L4a 비동기 경쟁
  | 'glyph-tongue' // L2 문맥 추론 해독 (Chants of Sennaar 계열)
  | 'word-customs' // L3+ 정밀 검증·위조 적발 (Papers Please 계열)
  | 'lexicon-hands' // L4+ 어휘 속성 시너지 엔진 (Balatro 계열)
  | 'lexicon-detective' // L5 장면 수확·서사 재구성 (Golden Idol 계열)
  | 'morpheme-rules' // L4b 형태소 조립·규칙 재작성 (Baba Is You 계열)
  | 'silent-rule' // L4b 철자 규칙 귀납 (The Witness 계열)
  | 'lexicon-estate' // L5 의미장 인접 배치·드래프트 (Blue Prince 계열)
  | 'word-orrery' // L5 지식 게이트 탐사 (Outer Wilds 계열)
  | 'pirate-quest' // L4a 3D 공간 인출 (v07.8 재설계로 학습자 단어 사용)
  | 'wordsmith-vigil' // L4b 타이핑 생성 서바이버 (Typing of the Dead 계열)
  | 'morphmerge' // L4b 어족 합치기 형태론 (2048/Merge 계열)
  | 'wordfall-cadence'; // L4c 듣기 케이던스 (리듬 계열)

/**
 * 사용자 단계 — §17.2 [2] 상태 축 — 사용자 상태
 * Hub 진입 시 user_stats.mastery_level 1쿼리로 조회
 */
export type MasteryLevel = 'cold' | 'warm' | 'hot';

/**
 * 사용자 통계 — Supabase `user_stats` 테이블 정합
 * §17.7 신규 테이블
 */
export interface UserStats {
  userId: string;
  masteryLevel: MasteryLevel;
  totalWords: number;
  currentStreak: number;
  /** FSRS Target Retention (한국 학습자 초기값 0.85) */
  fsrsTargetRetention: number;
  updatedAt: Date;
}

/**
 * Review 이벤트 — `learning_records` 1건 생성용 입력
 */
export interface ReviewInput {
  card: SrsCard;
  rating: RatingValue;
  reviewedAt: Date;
  module: ModuleId;
}

/**
 * Review 결과 — DB 업데이트 + learning_records 적재용
 */
export interface ReviewResult {
  /** 갱신된 카드 (vocabularies UPDATE 대상) */
  card: SrsCard;

  /** learning_records INSERT 대상 */
  log: {
    cardId: string;
    rating: RatingValue;
    module: ModuleId;
    reviewedAt: Date;
    /** review 직전의 R(t) — 회고용 (선택) */
    retrievabilityBefore: number;
    /** 이번 review로 인한 Stability 변화 */
    stabilityDelta: number;
  };
}
