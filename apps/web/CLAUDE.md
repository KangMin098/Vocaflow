# apps/web — 웹 전용 가이드

루트 `CLAUDE.md` 가 SSoT. 본 문서는 Next.js 14 App Router 한정 보충만 기록.

## 우선 읽을 것

코드 작성 전 루트 `CLAUDE.md` §"🧠 디자인 철학 · 학습 과학 원칙"을 확인. 모든 학습 모듈은 이 원칙(Active Recall · Spaced Repetition · Calm UI · Empathetic Feedback 등)을 도구로 구현하는 것이지, 토큰·컬러는 그 도구. 새 PR 머지 전 동 섹션 끝의 **적용 체크리스트** 자가점검 필수.

## 토큰 로드

`src/app/globals.css` 첫 줄에 `@import '@vocaflow/design-tokens/tokens.css';` — 이 한 줄로 `--p`, `--bg`, `--t1` 등 모든 CSS Variables 가 등록됨. Tailwind 는 `var(--p)` 식으로 참조.

## 인증 보호

서버 컴포넌트는 `lib/supabase/server.ts`, 클라이언트 컴포넌트는 `lib/supabase/client.ts` 사용. 라우트 보호는 `src/middleware.ts` 에서 처리.

admin 가드는 3층: `middleware.ts`(라우트) + `requireAdmin`/`getAdminUser`(RSC, `lib/auth/require-admin.ts`) + `requireAdminApi`(API, `lib/auth/require-admin-api.ts`). 셋 다 `getUser` + `user_profiles.role` 검사.

### 개발 전용 admin 우회 (로그인 없이 /admin)

`lib/auth/dev-bypass.ts` 의 `devAdminBypass()` 를 위 3층 진입부에서 호출. `apps/web/.env.local` 에 `DEV_ADMIN_BYPASS=1` + `DEV_ADMIN_USER_ID=<admin uuid>` 설정 시 합성 admin 으로 통과. **프로덕션 무효** — `NODE_ENV==='production'` 이면 코드가 무조건 `null` 반환(하드 게이트). 끄려면 플래그 삭제 후 dev 서버 재시작. (`.env.local` 은 git 추적 안 됨.)

## App Router 그룹 / 세그먼트

- `(auth)` — 인증 라우트 (헤더 없음)
- `(marketing)` — 공개 랜딩
- `(main)` — 로그인 후 앱 (Sidebar 포함)
- `admin/` — 관리자 콘솔 (route group 미사용 → URL = `/admin/*`, AdminSidebar 적용, 보라 액센트로 시각 분리)
- `dev/` — 개발 검증 (`/dev/components` 카탈로그)

각 그룹/세그먼트는 자체 `layout.tsx` 보유. 그룹 간 컴포넌트 공유는 `src/components/` 의 도메인 폴더로.

## 루트 `/` 페이지

`src/app/page.tsx` = **화면 인덱스 + 진행률 대시보드** (Phase 1.5 dev 진입점). 그룹별로 모든 라우트를 status 뱃지(✅/⏳)와 함께 노출. 새 화면 추가 시 `GROUPS` 배열에 항목을 추가해 자동 집계.

## 미구현 화면 = StubPage

`components/dev/StubPage` 사용. props: `{ title, description, upcoming?: string[] }`. 실제 구현으로 교체 시 단순 import 변경.

## 화면 검증 (UI 스모크 — 상시 자산, 임시 드라이버 금지)

화면 검증/런타임 테스트가 필요하면 **임시 Playwright 드라이버를 새로 만들지 말고** 상시 스펙을 실행:

```bash
pnpm --filter web test:e2e:smoke   # 04-ui-smoke — 학습자 8화면 + EchoMatch 게이트 + 콘솔에러 0
pnpm --filter web test:e2e         # 전체 e2e (smoke + 학습루프 + wordvault/flashcard/admin 회귀)
```

**핵심 학습 루프 회귀** — `05-learner-loop.spec.ts`: ScriptQuiz 완주(Drone Ch1 직행) → `scores` 적재를 service-role DB 단언으로 확인(완주 결과가 조용히 증발했던 v06.139 결함 재발 방지). DB 단언 헬퍼 `tests/e2e/utils/db.ts`(apps/web/.env.local 의 SERVICE_ROLE_KEY 직접 로드 · 키 없으면 UI 완주만 검증). 새 게임/영속화 경로 검증 시 이 패턴(직행 URL + 완주 마커 + `countScoresSince`) 재사용.

- 실행 시 3000 의 기존 dev 서버 재사용(`reuseExistingServer`), 없으면 자동 기동 (playwright.config.ts)
- 검증 계정: `runtime-test-0705@vocaflow.dev` / `RuntimeTest1!` (vocab 10·활동 시드·진단 v11) — EchoMatch 텍스트 `89970bfa-…8317`
  - **stage S3**(2026-07-13 `reading_fluency_log` wpm~160 시드) → hub 처방 ④ **DCP 구문 연습 활성**(order/insert·`/practice/dcp`). CTP DCP 계열 런타임 검증 가능. 시드 되돌리려면 해당 계정 fluency 로그 3건 DELETE → S1 복귀.
- 새 화면/모듈 런타임 검증을 했으면 그 시나리오를 04-ui-smoke 또는 새 spec 으로 **남겨서** 다음부터 자동 회귀되게 할 것
- 마이크 실녹음 검증은 fake-mic 플래그 필요: `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream`
- ⚠️ **dev 서버는 워크스페이스에 1개만** — 멀티 세션이 각자 `next dev` 를 띄우면 `.next` 공유 오염으로 라우트가 무작위 404 (실측 2026-07-07). 이미 떠 있는 서버를 재사용하고, 오염 시 모든 서버 종료 → `.next` 삭제 → 1개만 재기동.

## 전역 에러 바운더리 (필수)

`error.tsx` / `not-found.tsx` / `loading.tsx`가 `src/app/` 직속에 반드시 존재. 누락 시 클라이언트 라우터가 "missing required error components, refreshing..." 로 무한 새로고침. 수정·삭제 금지.

## TextViewer ↔ WordVault 인계 (mock Phase 2)

`lib/text-viewer/handoff.ts`의 `saveExtractedWords` / `consumePendingWords` / `toWordItem`. sessionStorage 기반 — Phase 3에서 Zustand `wordVaultStore`로 교체 예정.

## 테마 토글

`hooks/useTheme.ts` — `localStorage('vocaflow-theme')` + `data-theme` 속성. SSR-안전(초기값 'light' → mount 후 적용). `(auth)/layout.tsx`에 동일 패턴 인라인 존재 (작업 시 통합 권장).
