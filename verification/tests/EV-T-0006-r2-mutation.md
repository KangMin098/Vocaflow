# EV-T-0006-r2 — 회귀 테스트 변이 검사

| 되돌린 수정 | 실행 | 결과 |
|---|---|---|
| retention.ts 의 `.order('user_id', …)` 제거 | vitest retention-classification.test.ts | **1 failed** / 5 passed — 1,001 프로필 테스트가 운영자 누락(실사용 1)을 잡음 |
| retention.ts 의 `import 'server-only'` 제거 | vitest retention-server-boundary.test.ts | **1 failed** / 2 passed |
| 원복 | 두 파일 | 전부 통과(EV-T-0006-r2-targeted-vitest.log) |
