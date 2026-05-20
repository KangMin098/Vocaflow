// apps/web/tests/e2e/fixtures/test-user.ts
// 테스트용 고정 사용자 — Supabase auth.users 에 미리 생성 필요
// 환경변수 PLAYWRIGHT_TEST_EMAIL / PLAYWRIGHT_TEST_PASSWORD 로 override 가능

export const TEST_USER = {
  email: process.env.PLAYWRIGHT_TEST_EMAIL || 'lexicon-test@vocaflow.local',
  password: process.env.PLAYWRIGHT_TEST_PASSWORD || 'lexicon-test-pw-2026',
};

export const TEST_WORDS = {
  // shared_dictionary 에 확실히 존재하는 단어 (Phase 1 전후 매칭 안정)
  exactMatch: ['abandon', 'science', 'study', 'analyze'],
  // 굴절형 (Phase 3 surface_index 도입 후 매칭 예정)
  inflected: ['abandoned', 'analyzing', 'studies'],
  // 다단어 (shared_dictionary 등재된 phrasal)
  multiWord: ['bus lane', 'in addition to'],
};
