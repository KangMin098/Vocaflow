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
- **핵심 루프 3종 완성 (v06.166~171)**: `05-learner-loop.spec.ts` — 게임 완주×2(ScriptQuiz·Flashcard) + 진단→개인화 진입. 진단(v06.171): `/diagnostic`→"진단 시작"→~40문항 "알아요" 이진→`countDiagnosticSnapshotsSince`(user_level_snapshots taken_reason='diagnostic'). storageState beforeAll 1회 로그인 재사용(3중 로그인 rate-limit·하이드레이션 빈필드 플레이크 해소, loginRuntimeUser fill 값 확정 재시도 필수). 게임/진단 계정 상태 변화(due 소모·V-Level 갱신)는 각 테스트가 리셋/재기록으로 반복가능화.
- **학습 루프 회귀 (v06.166 `c31e7a1`)**: `05-learner-loop.spec.ts` — 게임 완주→DB 영속화를 service-role 단언(`tests/e2e/utils/db.ts`, apps/web/.env.local 직접 로드). ScriptQuiz 직행(`/scriptquiz/play?book=…&ch=1` Drone Ch1 4문항)→키보드 '1'×4→`countScoresSince(module='scriptquiz')`. 교훈: 4지선다=plain button(role≠radio)·OX만 radio → 완주는 키보드 '1'(window 리스너·포커스 비의존)이 안정 · 시작 게이트는 하이드레이션 전 클릭 무시(문항 배지 전이 확인 후 재클릭) · 스모크 8화면은 dev first-compile 누적으로 setTimeout 120s 필요. 새 게임 영속화 검증 시 이 패턴 재사용.

- **아케이드 게임 전수 스모크 (2026-07-12)**: `07-arcade-games.spec.ts` — 14개 `/play/*`(12 아케이드+wordblitz+pirate-quest) 마운트+첫입력반응+콘솔0, 허브 12카드. 게임별 결정론적 준비마커·상호작용 하드코딩(gt-chip·mr-block→슬롯·db-tile→gk-tile--correct·wordblitz key '1'·cascade gridcell·word-customs 승인→다음여행자 등), pirate-quest는 3D 캔버스라 렌더만. 단일 클린 서버서 **15/15 pass**. `scores.module_id` enum에 신규 12종 전부 존재(영속화 유효).
- ⚠️ **멀티 dev 서버 오염의 함정(2026-07-12 실측)**: `next dev` 2개 공유 `.next` 오염은 **특정 lazy 청크만** 로딩 폴백에서 정지시켜 "그 게임만 마운트 실패"처럼 보임(glyph-tongue 오진 사례) — 렌더 크래시(에러 바운더리)와 구분됨. 진짜 코드버그와 감별: tsc 통과 + 페이지 셸은 뜨는데 dynamic import 폴백에서 멈춤 = 오염. 복구=전 dev 종료→`.next` 삭제→1개 재기동.
- ⚠️ **playwright는 반드시 `CI=1` 로 단독 실행**: 아니면 config의 managed webServer가 (readiness probe가 `/` 404를 보고) 별도 `pnpm dev` 를 **재spawn → 두번째 경쟁 서버가 `.next` 재오염**. `CI=1` 이면 webServer undefined(config)라 기존 :3000 만 사용 + 재시도 2회. 콜드 `.next` 첫 브라우저 히트는 클라이언트 청크 404(하이드레이션 실패)라 로그인·ready 에 reload-retry 필수(07 스펙에 내장). (2026-07-12 재확인: `CI=1` 없이 `test:e2e:smoke` 실행 → 서버가 런 중간 死 → connection-refused 연쇄. 클린 단일 서버(전 종료→.next 삭제→1개)에선 즉시 green.)
- ✅ **클라이언트-인증 의존 렌더도 e2e로 단언 가능 — 단, 서버가 클린일 때만(2026-07-12, v06.222 정정)**: `storageState`(쿠키 sb-…auth-token.0/.1, httpOnly=false)로 브라우저 `supabase.auth.getUser()`는 **클린 단일 서버에선 200 정상** → `useUserVLevel`이 실 V-Level 반환 → 밴드 배너/지도 정확 렌더(진단: V11→"고급 안내"·"내 레벨 V11·C2"). **오염 서버에선 청크 404로 하이드레이션 미완 → getUser 미실행 → userV=0(미진단) 폴백**(초기 오진의 실체 = 인증 한계 아님, 서버 불안정). 교훈: client-auth 화면 e2e 실패 시 "storageState 한계"로 속단 말고 **먼저 클린 서버(전 종료→.next 삭제→1개+CI=1) 확인**. 밴드 적응성은 e2e(계정 current_v_level 변경+finally 원복, `source-map.test.ts` 단위와 병행) 둘 다로 검증. JS 무거운 페이지 상호작용 클릭은 hydration 전 유실 → `expect(...).toPass()` 재클릭(멱등 setter) 패턴 필수.

관련: [[project-echo-match-module]] [[project-learner-management-p0-p3]] [[project-a3-game-real-data-sweep]]

