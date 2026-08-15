# apps/web — 웹 전용 가이드

루트 `CLAUDE.md` 가 SSoT. 본 문서는 Next.js 14 App Router 한정 보충만 기록.

## 우선 읽을 것

코드 작성 전 루트 `CLAUDE.md` §"🧠 디자인 철학 · 학습 과학 원칙"을 확인. 모든 학습 모듈은 이 원칙(Active Recall · Spaced Repetition · Calm UI · Empathetic Feedback 등)을 도구로 구현하는 것이지, 토큰·컬러는 그 도구. 새 PR 머지 전 동 섹션 끝의 **적용 체크리스트** 자가점검 필수.

## 토큰 로드

`src/app/globals.css` 첫 줄에 `@import '@vocaflow/design-tokens/tokens.css';` — 이 한 줄로 `--p`, `--bg`, `--t1` 등 모든 CSS Variables 가 등록됨. Tailwind 는 `var(--p)` 식으로 참조.

## 인증 보호

서버 컴포넌트는 `lib/supabase/server.ts`, 클라이언트 컴포넌트는 `lib/supabase/client.ts` 사용. 라우트 보호는 `src/middleware.ts` 에서 처리.

admin 가드는 3층: `middleware.ts`(라우트) + `requireAdmin`/`getAdminUser`(RSC, `lib/auth/require-admin.ts`) + `requireAdminApi`(API, `lib/auth/require-admin-api.ts`). 셋 다 `getUser` + `user_profiles.role`·`status` 검사.

### 인증 공유 모듈 — 새로 만들지 말고 여기서 가져다 쓸 것 (v06.140)

| 파일 | 소유하는 결정 |
|---|---|
| `lib/auth/redirect.ts` | 로그인 후 복귀 경로. **쓰기는 `?next=` 하나**, 읽기는 `next`·`returnTo`·`redirect` 별칭 흡수. open redirect 판정(`safeInternalPath`)도 여기만 |
| `lib/auth/protected-routes.ts` | "로그인이 필요한 화면" 목록. 미들웨어가 강제 |
| `lib/auth/account.ts` | 역할(`canAccessAdminConsole` = admin\|curator)·상태(`isUsableAccount`) 판정. 3층 가드가 공유 |
| `lib/auth/validation.ts` | 이메일·비밀번호(8자+영문+숫자)·표시이름 규칙 + 한글 이름 base64 |
| `lib/auth/errors.ts` | Supabase 에러 → 한국어. 콜백 에러 코드 계약도 여기 |

**왜 모아 뒀나**: 이 규칙들이 화면마다 복사돼 있던 동안, 미들웨어는 `?next=` 로 쓰고 로그인
화면은 `?returnTo=` 를 읽어 **모든 딥링크 복귀가 조용히 `/hub` 로 떨어졌다**. 이름을 각자
정하게 두면 반드시 다시 어긋난다. 새 인증 화면은 반드시 위 모듈을 import 할 것.

**보호 라우트를 추가할 때**: 페이지에 `getUser()`→`redirect()` 를 손으로 붙이지 말고
`PROTECTED_PREFIXES` 에 접두사를 추가한다. 손으로 붙이던 동안 `(main)` 48 라우트 중
32개가 로그아웃 상태로 열려 있었다. 도서(`/library`)·만화(`/comics`) 카탈로그는 **공개 유지**(발견·SEO).

**인증 회귀** — `tests/e2e/20-auth-flows.spec.ts`(46) + `src/lib/auth/__tests__/`(188, 실 DB
권한 상승 공격 8건 포함). ⚠️ `.env.local` 에 `DEV_ADMIN_BYPASS=1` 이 있으면 admin 가드 4건이
자동 skip 된다 — 가드를 고쳤으면 `DEV_ADMIN_BYPASS=0 NEXT_DIST_DIR=.next-nobypass npx next dev -p 3100`
로 띄우고 `DEV_ADMIN_BYPASS=0 PLAYWRIGHT_BASE_URL=http://localhost:3100` 로 재실행해 확인할 것.

## 학습자가 읽는 이름 — 화면에서 짓지 말 것 (v06.141)

메뉴·탭·활동 이름은 **영어**다. 이름을 정하는 곳은 두 군데뿐이고, 화면은 거기서 import 한다.

| 파일 | 소유하는 이름 |
|---|---|
| `lib/framework/axes.ts` | 표면(`SURFACES[].name` = Today·Library·Vault·Growth) · 축(Facet·Stage) |
| `lib/learner/plan-activities.ts` | 자료 유형(`MATERIAL_LABEL`) · 활동(`PLAN_ACTIVITIES[].label`) · 요일 · 출처 |

**자료 유형 4종** — `Books` / `Dispatches`(arXiv·NASA·NIH·VOA 짧은 글) / `Decks`(발행 단어장) / `Scripts`(학습자가 넣은 글).
⚠️ `scripts` 라는 키가 화면마다 다른 것을 가리킨다: Library 탭에서는 **공개 짧은 글**(`article`=Dispatches),
Dictation·Vault 탭에서는 **내가 넣은 글**(`script`=Scripts). 라벨을 손으로 적으면 이 둘이 같은 이름이 된다.

**왜 모아 뒀나**: 한글이던 시절 같은 유형이 화면마다 갈려 있었다 — `article` 이 Plan 에서는 '스크립트',
Library 에서는 '짧은 글' · `word_set` 이 '공용단어장'/'단어장'/'세트' 셋. 모바일 하단 탭은 자체 한국어
목록을 들고 있어서 같은 표면이 데스크톱 `Today` · 모바일 `오늘` 이었다. **이름을 각자 정하게 두면
영어로도 똑같이 갈린다.**

**한글로 남기는 것**: 본문·빈 상태·안내 문구·에러 메시지·스크린리더 `aria-label`.
학습 중 읽는 문장이라 영어화가 인지 부하를 올린다(§학습원칙6 Cognitive Load). 이름과 문장은 다르게 취급한다.

회귀: `tests/e2e/04-ui-smoke.spec.ts` 하단 탭 단언이 `SURFACES[].name` 과 같은 문자열을 쓴다 —
탭이 레지스트리를 실제로 읽는지 확인하는 장치다.

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

**추출 스케일 회귀** — `09-text-extract-scale.spec.ts`: 강연 분량(20,818자) `/text/new` 입력 → 추출 → 저장 왕복. **입력 무단 절단 회귀 락**(인식 단어 수가 입력 규모에 비례하는지 단언 — `TextInput` 의 `maxLength` 하드 속성이 75%를 조용히 버리던 v06.35 결함 재발 방지) + `pending_words` 가 사전 갭만 받는지 `unresolved_dict_words` 교차 검증. DB 헬퍼 `fetchPendingWordsSince`/`unresolvedDictWords`/`deletePendingWordsSince`. **vocabularies·pending_words 는 finally 에서 반드시 원복** — 남기면 다음 실행의 추출 후보가 영구 축소된다.

**추출 신뢰 회귀** — `08-text-extract-trust.spec.ts`: `/text/new` 본문 입력 → 'text'(P75) 전략 추출 → ① 4단계 expand "왜 추천했어요?" 근거 카드 렌더 ② 2단계 알아요(✓+체크해제)/몰라요(aria-pressed) → `word_familiarity` known/unknown 적재를 `countWordFamiliaritySince` 로 DB 단언. **known 판정은 다음 추출을 영구 축소하므로 finally 에서 `deleteWordFamiliaritySince` 로 반드시 원복**(테스트가 만든 행만 updated_at 기준 삭제).

**컴포저 단어장 동선 회귀** — `22-book-composer-sets.spec.ts`: 도서 상세 Tier 2 "보조 단어장" 자리에
그 책으로 만든 세트(해금·재등장)가 **이유와 함께** 뜨는지. `아직 준비되지 않았어요` 문구가 남아 있으면
배선이 끊긴 것으로 보고 실패한다 — 발행은 DB 에서 성공으로 보이므로 화면 단언 없이는 알 수 없다.

**단어장 Studio 회귀** — `21-vcb-studio.spec.ts`: `/admin/vocab/studio` 에서 유형 선택 → 채점까지 돌고
**채점 전 발행 버튼이 잠겨 있음**을 단언(이 화면의 계약이 "평가가 발행의 전제" 다 — 서버 액션이
조용히 깨지면 화면은 그대로 뜨고 발행만 영원히 잠긴다). 발행(쓰기)은 하지 않는다 — e2e 가 공용
카탈로그에 세트를 남기면 다음 실행의 novelty 대조군이 오염된다. 쓰기 경로는 `pnpm vcb:compose` 로 검증.

- 실행 시 3000 의 기존 dev 서버 재사용(`reuseExistingServer`), 없으면 자동 기동 (playwright.config.ts)
- 검증 계정: `runtime-test-0705@vocaflow.dev` / `RuntimeTest1!` (vocab 10·활동 시드·진단 v11) — EchoMatch 텍스트 `89970bfa-…8317`
  - **stage S3**(2026-07-13 `reading_fluency_log` wpm~160 시드) → hub 처방 ④ **DCP 구문 연습 활성**(order/insert·`/practice/dcp`). CTP DCP 계열 런타임 검증 가능. 시드 되돌리려면 해당 계정 fluency 로그 3건 DELETE → S1 복귀.
- 새 화면/모듈 런타임 검증을 했으면 그 시나리오를 04-ui-smoke 또는 새 spec 으로 **남겨서** 다음부터 자동 회귀되게 할 것
- 마이크 실녹음 검증은 fake-mic 플래그 필요: `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream`
- ⚠️ **dev 서버는 워크스페이스에 1개만** — 멀티 세션이 각자 `next dev` 를 띄우면 `.next` 공유 오염으로 라우트가 무작위 404 (실측 2026-07-07). 이미 떠 있는 서버를 재사용하고, 오염 시 모든 서버 종료 → `.next` 삭제 → 1개만 재기동.
- ⚠️ **인증 상태는 `playwright-auth/` 에 저장한다 — `test-results/` 에 두지 말 것.** Playwright 는
  실행 시작 때 output 디렉터리를 통째로 지우므로, 동시 세션이 있으면 **남의 실행이 내 스펙의
  로그인 상태를 지운다.** 그러면 스펙은 엉뚱한 증상으로 실패한다 — 실측 2026-08-15,
  EchoMatch 스펙이 "Piper 시작 버튼이 안 뜬다" 로 150초 타임아웃했는데 실제 화면은 **로그인 페이지**였다.
  (19개 스펙을 `playwright-auth/` 로 이전 완료. 새 스펙도 그쪽에 쓸 것.)

## EchoMatch 전제 — ONNX 런타임 정적 자산

`public/onnx/` (74MB · gitignore)가 없으면 EchoMatch 는 **"음성 모델 로드 실패"** 로 죽는다
(`no available backend found … Failed to fetch /onnx/ort-wasm-simd-threaded.jsep.mjs`).
`pnpm dev` / `pnpm build` 앞에 `predev`/`prebuild` 가 `scripts/ensure-onnx-runtime.mjs` 를 돌려
`onnxruntime-web` dist 에서 자동 복사한다(멱등 — 있으면 건너뜀). 수동은 `pnpm --filter web ensure:onnx`.

> 2026-08-15 이전에는 이 복사가 **사람 손**이었다(`.gitignore` 주석과 `piper-tts.ts` 주석에
> "권장"·"복사 후" 로만 남아 있었다). 그래서 새 체크아웃에서 EchoMatch 가 조용히 죽었다.

## 전역 에러 바운더리 (필수)

`error.tsx` / `not-found.tsx` / `loading.tsx`가 `src/app/` 직속에 반드시 존재. 누락 시 클라이언트 라우터가 "missing required error components, refreshing..." 로 무한 새로고침. 수정·삭제 금지.

## TextViewer ↔ WordVault 인계 (mock Phase 2)

`lib/text-viewer/handoff.ts`의 `saveExtractedWords` / `consumePendingWords` / `toWordItem`. sessionStorage 기반 — Phase 3에서 Zustand `wordVaultStore`로 교체 예정.

## 테마 토글

`hooks/useTheme.ts` — `localStorage('vocaflow-theme')` + `data-theme` 속성. SSR-안전(초기값 'light' → mount 후 적용). `(auth)/layout.tsx`에 동일 패턴 인라인 존재 (작업 시 통합 권장).
