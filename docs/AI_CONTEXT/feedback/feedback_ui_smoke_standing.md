> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/feedback_ui_smoke_standing.md
> category: feedback

---

사용자 지시(2026-07-07): "앞으로 화면 검증/테스트 필요하면 자동으로 수행하게" — 화면 검증을 상시 자산으로 전환.

**Why:** 그동안 런타임 검증마다 임시 Playwright 드라이버를 작성→삭제해 재사용 자산이 안 남았음(학습자 플로우·게임·EchoMatch 모두 반복 낭비).

**How to apply:**
- 화면 검증/런타임 테스트 요청 시 → `pnpm --filter web test:e2e:smoke` (tests/e2e/04-ui-smoke.spec.ts: 학습자 8화면 + EchoMatch 게이트 + 콘솔에러 0). 전체 회귀는 `test:e2e`.
- 새 화면/모듈을 런타임 검증했으면 그 시나리오를 **spec 으로 남겨** 다음부터 자동 회귀(임시 드라이버 금지 — apps/web/CLAUDE.md "화면 검증" 섹션이 SSoT).
- 검증 계정 runtime-test-0705@vocaflow.dev / RuntimeTest1! · EchoMatch 텍스트 89970bfa-…8317.
- 마이크 실녹음은 fake-mic 플래그(--use-fake-ui/device-for-media-stream) 필요 — 스모크 범위 밖.
- ⚠️ dev 서버 1개 원칙: 멀티 세션이 각자 next dev 띄우면 `.next` 공유 오염 → 라우트 무작위 404(2026-07-07 실측). 기존 서버 재사용; 오염 시 전부 종료→.next 삭제→1개 재기동.
- ✅ 첫 실행 green (2026-07-07 `9cd9423`, 콜드 서버 기준 2 passed). 첫 가동에서 실결함 2건 적발: ① RecommendedBooks 가 `popularity_rank`(seed_catalog 소유)를 library_books 에서 select → 400 → 허브 도서 추천 전멸(수리) ② dev 콜드 청크 경합(ChunkLoadError→`/_next/undefined`) — 리로드 1회 복구 패턴을 스펙에 내장. 스펙은 로그인 1회 storageState 재사용(auth rate-limit 회피) + 4xx URL 캡처.

관련: [[project-echo-match-module]] [[project-learner-management-p0-p3]]

