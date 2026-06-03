// apps/web/tests/e2e/fixtures/test-user.ts
// 테스트용 고정 사용자 — Supabase auth.users 에 미리 생성 필요
// 환경변수 PLAYWRIGHT_TEST_EMAIL / PLAYWRIGHT_TEST_PASSWORD 로 override 가능

export const TEST_USER = {
  email: process.env.PLAYWRIGHT_TEST_EMAIL || 'lexicon-test@vocaflow.local',
  password: process.env.PLAYWRIGHT_TEST_PASSWORD || 'lexicon-test-pw-2026',
};

// seed 8개 (test 계정 lexicon-test@vocaflow.local 에 주입됨)
// A1: science, study / A2: achieve, create, develop / B1: effective / B2: abandon, fundamental
export const TEST_SEED_WORDS = [
  'science', 'study',                       // A1
  'achieve', 'create', 'develop',           // A2
  'effective',                              // B1
  'abandon', 'fundamental',                 // B2
] as const;

// CEFR 분포 (seed 기준) — spec assertion 에서 활용
export const TEST_CEFR_DISTRIBUTION = {
  A1: 2,
  A2: 3,
  B1: 1,
  B2: 2,
} as const;

export const TEST_WORDS = {
  // shared_dictionary 에 확실히 존재하는 단어 (seed 8개 부분집합 — Phase 1 매칭 안정)
  // 변경: analyze 제거 (사전에 없음 — 영국식 analyse 만 존재 가능) → create 로 대체
  exactMatch: ['abandon', 'science', 'study', 'create'],
  // 굴절형 (Phase 3 surface_index 도입 후 매칭 예정)
  // 변경: analyzing 제거 → creating 으로 대체 (seed 기반 lemma 매칭 검증)
  inflected: ['abandoned', 'creating', 'studies'],
  // 다단어 — Phase 1 에선 미사용, Phase 3 (surface_index MV) 도입 후 채울 예정
  multiWord: [] as string[],
};
