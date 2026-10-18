# PC 학습자 화면 Tines 감사 — 전수 목록 · 지침 충돌 · 개선 백로그

> 작성 2026-10-18 · Claude Code · 코드 기준 **origin/main `c3a03d168`**(워크트리 `design/learner-tines-audit`).
> 기준 정본: [DESIGN.md](../../DESIGN.md)(DD-83). 다음 단계 계획: [learner-tines-plan](./learner-tines-plan.md).
> 범위: PC 웹. 관리자(`/admin/**`, page 89개)·모바일 웹·`apps/mobile`·`/dev/**`(9개)·`/api/**` 는 디자인 변경 대상이 아니다. `/csat/**` 는 목록에 넣되 3B 유지.

## 0. 검증 상태 읽는 법

| 칸 | 뜻 | 이번 회차 |
|---|---|---|
| **S** 소스 확인 | `page.tsx`·layout 체인·middleware·redirect·import 를 읽어 목적·진입·부품·팝업을 확인 | **완료 2026-10-18 @ c3a03d168** (정적 분석, 서브에이전트 + 직접 확인) |
| **R** 정상 렌더 | 진입 조건을 갖춘 계정·실제 ID 로 PC 1440/1280 에서 정상 화면(로그인·오류·로딩 화면 아님) 캡처 | **미실행** |
| **I** 상호작용 | 탭·쿼리 분기·팝업 열기/닫기·Esc·포커스·빈/실패 상태 실행 | **미실행** |
| **V** 시각 대조 | 같은 뷰포트의 Tines 대응 화면과 측정값 대조표 | **미실행** |

- 표의 `S✓ R· I· V·` = S 완료, 나머지 미실행. 이전 회차의 「검증 완료」 문구는 옮겨 오지 않았다 — 근거는 아래 §4.
- **이전 목록과의 관계**: 미병합 브랜치 `design/replica-first` 의 `docs/design/remaining-inventory.md` 와 라우트 집합이 **정확히 같다**(학습자 90개, 정규화 후 diff 0). 그러나 그 파일의 상태 칸은 생성 스크립트 `scripts/design/remaining-learning-audit.mjs` 가 **경로별 삼항 연산으로 고정 출력**한 문자열이다(`/dashboard` `/plan` `/reports` `/library/books` → 「실제 셸 PC 4조건 렌더 + 격리 기능 검증」 등). 캡처·테스트 결과를 읽지 않으므로 이 문서에 검증 근거로 쓰지 않는다. 리다이렉트 스텁도 레이아웃 줄 때문에 후보 9–10 이 잡혀 있었다.
- 「실제 확인 URL」의 ID 는 2026-10-18 DB(read-only `execute_sql`)에서 뽑았다: 발행 도서 `42f3bce4-5cae-4cda-ae40-f1da16d8ad99` · 발행 아티클 `14378d44-2e70-46d3-80a2-2dcf1def75c0` · 발행 단어세트 `6f92ab53-b978-4b08-9c6c-adeab6aeee11` · PD 만화 `super-mystery-comics-csv06n06`. `texts`(278행)·`dictation_sessions`(15행)는 RLS 상 **검증 계정 소유 행**이 필요해 R 단계에서 계정별로 뽑는다(아래 SQL).

## 1. 전역 틀 (모든 행이 공유)

| 틀 | 마운트 위치 | 들어 있는 것 | 기준 · 참조 후보 | 비고 |
|---|---|---|---|---|
| 루트 | `app/layout.tsx` | `data-skin`(`NEXT_PUBLIC_SKIN ?? "tines"`) · head 스크립트(`?skin=off\|tines` → localStorage `vocaflow-skin`, `vocaflow-theme`, reduced-motion) · `DevicePreferences` · **`ToastProvider`** · root `error.tsx`/`not-found.tsx`/`loading.tsx` | Tines | **스킨 해제 경로 = Tines 적용의 코드 차단점**(계획 S1) |
| `(marketing)` | `(marketing)/layout.tsx` | `SiteHeader`(알약 내비 · 메가메뉴 3 · `SearchButton` → **`SearchDialog`** Ctrl/⌘+K) · `MarketingTail` · `SiteFooter` | Tines 홈 `SiteNav26` · `GlobalSearch` · `SiteFooter26` ([tines-mapping §1](./tines-mapping.md)) | `/` 는 그룹 밖에서 같은 헤더·푸터를 직접 마운트 |
| `(auth)` | `(auth)/layout.tsx` | 미니 헤더(LogoMark + **테마 토글**) · 2열 폼 + 삽화 · 작은 푸터 | Tines `ContactSupportForm` | |
| `(main)` | `(main)/layout.tsx` | skip link · `GlobalBodyReset` · **`AppHeader`**(상단 막대 + 메가메뉴, `top-nav-data.ts`) · `MobileUtilityBar` · `CompassRibbon` · `ModuleBanner` · `SessionFrame` · `MobileTabBar` | Tines 메가메뉴 · 제품 액자 앱 UI(`refs/tines/app-measured.json`) | 학습자 앱에는 **검색 다이얼로그가 없다**(SearchDialog 는 공개 화면 전용) · FS 라우트에서 AppHeader 세션 모드(Esc 종료) |
| `(app)` | `(app)/layout.tsx` | `ScreenViewTracker` + `SessionFrame` 만 — AppHeader 없음 | 게임: 자체 미술 · CSAT: 3B | |
| 오버레이 원시 부품 | `components/ui` | `Dialog`(ComicInfoDialog · GameBriefModal · SeriesInfoModal · NetflixDetailSheet · VocabSetPreviewModal) · `Toast` · `ZoomableImage`. `Modal`·`Tooltip`·`Select`·`LoadingOverlay` 는 `/dev/components` 만 사용 · `ios/SheetContainer` 사용처 0 · **Popover/Dropdown/Menu 원시 부품 없음** — 팝오버는 각자 `role="dialog"` 로 손수 구현(`workspace/*Popover` · `WordLookupPopover` · `MicroPause` · `PrintSheet` 등) | Tines 모달(ui-kit) · `interactions-summary` | 팝오버 계열 통일이 백로그 B4 |

## 2. 디자인 지침 충돌과 수정 내역

분류: **현행** 규칙 / **과거** 기록 / **생성물** / **참고**. 생성물 해당 없음 — `agents/scripts/sync.mjs` 는 MCP 블록만 만들고 디자인 문서는 생성하지 않는다. 줄 번호는 수정 전 `c3a03d168` 기준.

| # | 파일:줄 | 원문(요약 인용) | 분류 | 문제 | 수정(이번 커밋) | 우선순위 근거 |
|---|---|---|---|---|---|---|
| G1 | `DESIGN.md:3` | 「**[동결]** … **수정 금지**(DD-62)」 | 현행 | 정본이어야 할 파일이 자기 수정을 막는다 | 전면 교체 — 2026-10-03 기준(출처 `design/replica-first` `9b9078d90`)을 main 실물에 맞춰 반영, csat-app.css 미구현·스킨 해제 경로를 표기 | P0 차단 |
| G2 | `DESIGN.md:9-11` | 주묵 `#C0392B` · Hahmlet·Lora·IBM Plex 4종 | 현행 | Tines 색·서체와 정면 충돌 | G1 교체로 제거(이력은 git) | P0 |
| G3 | `docs/design/DECISIONS.md` DD-62 | 「초안 9개를 동결」 | 과거 | 모든 동결 배너의 근거 | **DD-83 추가** — 동결 해제 · DD-24 폐기 · DD-66 유지 · DD-68/82 연결 | P0 |
| G4 | `packages/design-tokens/CLAUDE.md:6-23` | 「동일 토큰을 `colors.ts`…」「웹/앱 한쪽만 수정 금지」, 없는 루트 CLAUDE.md 표 참조 | 현행 | 웹 스킨만 바꾸는 PC 작업에도 RN 변경을 요구하는 것으로 읽힘 | 절차 적용 범위를 **기본 tokens.css** 로 한정, 스킨은 웹 전용(`tines.ts` 값 동기만), 죽은 참조를 DESIGN.md 로 | P0 오해 |
| G5 | `AGENTS.md:40` | 「DESIGN.md(방향·화면별 골격·서명)」 | 현행 | 입구가 옛 판을 설명 | 「스타일 정본 — PC 학습자 Tines · /csat·/admin 3B · PC 웹만」 + 감사 링크, DESIGN_SYSTEM 은 「과거 기록·재료」 | P1 |
| G6 | `AGENTS.md:61` | 「현재 서체는 한국어 Hahmlet · 영어 Lora.」 | 현행 | 전 화면 서체 규칙처럼 읽힘 | 2026-10-03 라우트 결정 문장으로 교체(DD-83) | P1 |
| G7 | `AGENTS.md:70` I7 | 「390px 에서 낱말이 쪼개진다」 | 현행(규칙 유지) | 이유가 모바일을 범위로 암시 | 규칙 유지, 이유만 「좁은 폭」 | P2 |
| G8 | `AGENTS.md:137` | 「먹색 · Inter · 보라 0 — DD-82」 | 현행 | 「보라 0」이 전역 금지로 읽힘 | 「관리자 한정, 학습자 Tines 는 보라 잉크」 명시 | P1 |
| G9 | `docs/DESIGN_SYSTEM.md:3,7` | 「[동결]…수정 금지」 · 「**현행 SSoT** — v07 주묵 판면」 | 과거(현행으로 표기됨) | DESIGN.md 와 정본 경쟁 | 「과거 기록」 배너 · 7행을 「v07 기록(대체됨)」으로 | P0 |
| G10 | `docs/DESIGN_SYSTEM.md:71-134, 222-251` | 주묵 판면 · PressButton/SealMark · 「Typography — 현행 4종」 · 「색 토큰 카탈로그(현행)」 · 관리자 규격 혼재 | 과거 | 절마다 「현행」이 남아 있음 | 파일 머리 배너로 일괄 「현행 아님」. 절 단위 분리는 백로그 B11(역사 문서 무차별 치환 금지) | P1 |
| G11 | `docs/design/03-system.md:3` + §3-9(292·308·354) | 「[동결]」 · 「Tines 와 갈리는 축」 · 「ΔE2000 < 2 도 0」 | 과거 | 「닮지 않기」 기준 — 새 방향의 반대 | 배너: DD-24 기준 폐기, 저작권 핵심만 유지 | P1 |
| G12 | `docs/design/04-application.md:3` | 「[동결]」 | 과거 | 동결 문구 | 과거 기록 배너 | P2 |
| G13 | `docs/design/image-system-brief.md:3` | 「[동결]」 + 「Tines 계열」 유사도 제한 | 참고(사용자 원문) | 동결 · 유사도 제한 | 「원문 보존 · 규칙 아님」 배너 | P2 |
| G14 | `docs/design/admin-brief.md:3` | 「[동결]」 | 과거 | 옛 관리자 액센트안 | 배너: 관리자 = 3B(DD-82) | P2 |
| G15 | `docs/csat-learner/{integrated-experience,learning-home,visual-analysis}.md:3` | 「[동결]」 | 과거 | 동결 문구 | 배너: /csat = 3B | P2 |
| G16 | `docs/design/tines-mapping.md` §0 | (범위 문장 없음) — 사용자가 지목한 「그 외(관리자 포함)는 Tines」는 **main 에 없음**(확인) | 현행 | 적용 범위가 공개 화면·`/csat/space` 로 읽힘, 학습 앱 행 부재 | §0 에 적용 범위(PC 전 화면, /csat·/admin 은 3B)와 「상태 칸은 2026-09 기록」 주석 | P1 |
| G17 | `docs/design/06-workflow.md:41-50` | 「375×812, 390×844, 768×1024 …」 · `--project=390-light` 예시 2곳 | 현행(절차) | 기본 점검이 모바일 중심 | 기본 PC 1440/1280, 모바일 프로젝트는 요청 시만, 예시 `1440-light` | P1 |
| G18 | `.claude/skills/vocaflow-design/SKILL.md` = `.agents/skills/…`(동일 사본, 생성기 없음) | 주묵 선·권점 서명 예시 | 참고 | 예시가 주묵 판면 쪽으로 끈다 | 두 사본 머리에 「스타일 정본 DESIGN.md · 예시일 뿐」 한 줄 | P1 |
| G19 | `design-taste-frontend`(설치 스킬) | 단일 강조색·보라·세리프·알약·반전 구획 일반 규칙 | 참고 | Tines 기준(보라 잉크·다색·세리프 편집 제목·알약 CTA·진한 구획)과 충돌 가능 | 스킬 파일은 저장소 밖(로컬에서 SKILL.md 를 찾지 못함 — 원격/플러그인 제공 추정) → **수정하지 않고** DESIGN.md 머리·DD-83 에 「참고 자료, Tines 기준을 덮지 않음」 예외 명시 | P1 |
| G20 | `apps/web/CLAUDE.md:72-78` | 「실측 2026-08-25 (390px) … 학습자 전수 훑기 @390px」 | 과거 | 모바일 측정 프레이밍 | **미수정** — 하위 지시 파일은 계획 S2 에서 웹 지시 전체와 함께 정리 | P2 |
| G21 | `docs/CHANGELOG.md` DD-68 항목들 | 과거 변경 기록 | 과거 | 없음 | 유지 | — |

### 2-1. 문서가 아니라 코드가 강제하는 것

| 위치 | 강제 내용 | Tines 적용과의 관계 | 조치 |
|---|---|---|---|
| `apps/web/src/app/layout.tsx:102-104,157,170-174` | `NEXT_PUBLIC_SKIN=off` · `?skin=off` → localStorage 로 스킨 해제 | **차단점** — DESIGN.md 는 해제 금지인데 코드는 허용 | 계획 S1(코드 변경, 이번 단계 제외) |
| `globals.css:1110` · `admin/csat/sources/source-query.module.css:4` · `csat/space/space.module.css:5` | `?skin=off` 를 안내하는 주석 | 오해 유발 | S1 과 함께 |
| `globals.css:1111-1113` | `:root[data-skin="tines"]` 버튼 999px 알약(예외 `data-shape="keep"`) | 정합 | 유지 |
| `tailwind.config.ts:128-163` · `layout.tsx:26-27,53,60` | `font-editorial`/`english`/`serif` = Lora·Hahmlet 기본, Pretendard 는 스킨 켜졌을 때만 | 스킨이 `--font-*` 로 덮지만 클래스 하드코딩은 세리프로 남는다 | 백로그 B3(사용처 전수) |
| `lib/design/__tests__/skin-parity.test.ts:31-40` | `tines.css` ↔ `tines.ts` 값 일치 | 정합(동기 부담만) | G4 문구에 반영 |
| `lib/design/__tests__/token-parity.test.ts:72-86` | 기본 `tokens.css` ↔ `colors.ts`(RN) | 학습자 변경을 기본 토큰에 두면 RN 패키지까지 바뀜 | DESIGN.md 절차 3 「스킨에 둔다」 |
| `lib/design/__tests__/token-exists.test.ts:88-94` | 쓰인 `var(--x)` 가 tokens/globals 에 정의 | 스킨 전용 토큰 추가 시 실패 가능 | B12 확인 |
| `playwright.visual.config.ts:5-10,34-36` | 375/390/768/1280/1440 × 라이트/다크 | 기본 실행에 모바일 포함 | 계획 S2 — 기본 PC, 모바일 opt-in |
| `scripts/design/style-gate.mjs:7-10` | Tines 정확 색·ΔE<2 는 보고만, 실패는 `<title>` 누락·Roobert/Reckless 서체 | 저작권+접근성 — 정합 | 유지 |
| `scripts/design/admin-purple-scan.mjs` 등 | 관리자 보라 제거 | 관리자 한정 | 학습자 라우트에 돌리지 않는다 |
| `components/marketing/__tests__/no-hardcoded-stats.test.ts` | I5 실측 수치 | 유지 대상 | 유지 |
| `.githooks/pre-commit` · `agents/scripts/check.mjs` | 디자인 강제 없음 | — | — |

## 3. 전수 목록

열: URL · 목적 · 기준 · 진입 조건 · 실제 확인 URL · 주요 컴포넌트 · 팝업·상태(탭·쿼리·오버레이) · 기존 자산 · 참조 후보(Tines) · 검증 · 증거 · 우선순위.
공통값: 경계는 루트 `error/not-found/loading` 만(예외는 표기) · 증거 「소스」= `apps/web/src/app/<경로>/page.tsx` + layout 체인, 2026-10-18 @ c3a03d168 · 검증 표기는 §0.
우선순위: **P1** 학습 핵심 동선·첫인상(허브·읽기·단어·복습·서가·셸) · **P2** 그 밖의 정상 화면 · **P3** 리다이렉트 스텁·실험·결과 직접 진입 불가 화면.
「—」 = 해당 없음. 진입 「로그인」= `middleware.ts` + `lib/auth/protected-routes.ts` 보호 접두어(익명 → `/login?next=`).

### 3-1. 공개 · 인증

| URL | 목적 | 기준 | 진입 | 실제 확인 URL | 주요 컴포넌트 | 팝업·상태 | 기존 자산 | 참조 후보 | 검증 | 증거 | 우선 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `/` | 랜딩 | Tines | 공개 · 로그인 시 MW 가 `/hub` 로 | `/`(익명) | SiteHeader · CoverageHero · ToneTabs · LandingCta · SiteFooter | 메가메뉴 3 · SearchDialog · ToneTabs | hero-book-field · bed-flowers · spot 5 | 홈 | S✓ R· I· V· | 소스 · ISR | P1 |
| `/about` | 소개 | Tines | 공개 | `/about` | marketing/sections · ComponentVideo · Illustration | Mk 헤더 오버레이 · FAQ `<details>` | hero-book-field | 제품 `/3b/` | S✓ R· I· V· | 소스 | P2 |
| `/pricing` | 요금제 | Tines | 공개 | `/pricing` | PricingClient | FAQ 펼침 | — | 요금제 | S✓ R· I· V· | 소스 | P2 |
| `/terms` · `/privacy` | 법률 | Tines | 공개 | 같은 URL | LegalPage | — | — | 법률 `/legal/` | S✓ R· I· V· | 소스 | P3 |
| `/fit` | 공개 지문 진단 | Tines | 공개 · 옛 공유 쿼리면 `redirect('/fit/s/…')` | `/fit` | PublicFitClient · Faq · Illustration | 슬라이더 · 예시 결과 · 지우기 · FAQ | 골든 1호 기록(옛 판) | 역량 표 | S✓ R· I· V· | 소스 | P1 |
| `/fit/s/[payload]` | 공유 진단 결과 | Tines | 공개 · 잘못된 payload notFound · noindex | `/fit` 에서 결과 공유로 생성 | PublicFitClient | — | — | 사례 상세 | S✓ R· I· V· | 소스(`decodeProfile`) | P3 |
| `/join/[code]` | 학급 초대 참여(학습자) | Tines | 공개(보호 목록 밖) · 참여는 로그인 → `/teacher` | 초대 코드 필요: `peek_class_by_code`(학급 1개 — 코드 컬럼은 R 단계에서 `classes` 스키마 확인) · 없는 코드 = UnknownCode 화면 | inline UI · UnknownCode | server action → redirect | — | 문의 폼 | S✓ R· I· V· | 소스 | P2 |
| `/video` | 영상 목록 | Tines | 공개 | `/video` | Hero2Col · ComponentVideo | — | scene-video | 블로그 | S✓ R· I· V· | 소스 | P2 |
| `/video/[id]` | 영상 상세 | Tines | 공개 · `VIDEO_PUBLISHED=false` 면 전부 404 | `lib/video/catalog.ts` `allVideoIds()` 첫 값 | ComponentVideo | 인라인 재생 | — | 글 상세 | S✓ R· I· V· | 소스 | P3 |
| `/login` | 로그인 | Tines | 공개 | `/login` · `/login?error=…` | Card · FormField · Input | `?error` · `?next` · 테마 토글 | scene-hub | 문의 폼 | S✓ R· I· V· | 소스 | P1 |
| `/signup` | 가입 | Tines | 공개 | `/signup` | Card · Checkbox · FormField · ProgressBar | toast · returnTo | scene-hub | 문의 폼 | S✓ R· I· V· | 소스 | P1 |
| `/reset-password` | 비밀번호 재설정 | Tines | 공개 | `/reset-password` · `?mode=update` | Card · FormField | 2분기 · toast | — | 문의 폼 | S✓ R· I· V· | 소스 | P2 |
| `/verify-email` | 메일 인증 안내 | Tines | 공개 | `/verify-email?email=…` | Card | toast | — | 문의 폼 | S✓ R· I· V· | 소스 | P3 |
| `/sitemap` | 사이트맵 | Tines | 공개(목록 밖) · `(main)` 셸 | `/sitemap` | Screen | — | — | 푸터 링크 묶음 | S✓ R· I· V· | 소스 | P3 |

### 3-2. 허브 · 성장 · 계정 · 교사 흐름 (`(main)` 셸)

| URL | 목적 | 기준 | 진입 | 실제 확인 URL | 주요 컴포넌트 | 팝업·상태 | 기존 자산 | 참조 후보 | 검증 | 증거 | 우선 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `/hub` | 학습 허브 | Tines | 로그인 | `/hub`(학습 기록 있는 계정) | ToneTabs · PromoLink · CsatContinueLine · TitleMarquee | ToneTabs · 빈 계정 상태 | tile-hub · spot-dashboard (hub-hero-field·path-*는 메인 워크트리 미커밋 — B14) | 홈 + 제품 액자 | S✓ R· I· V· | 소스 | P1 |
| `/hub-lab` | 허브 시안 비교 | Tines | 로그인 | `/hub-lab?v=a` (`a\|b\|c\|d\|g`, `?t=`) | LabBar · VariantA–G | 시안·시간대 쿼리 | — | — | S✓ R· I· V· | 소스 | P3 실험 |
| `/dashboard` | 기억 대시보드 | Tines | 로그인 | `/dashboard` | ActivityTrace · DurabilityLadder · LexicalReach · ManageSection | 빈 상태 | spot-dashboard | 제품 액자(KPI·도넛) | S✓ R· I· V· | 소스 | P1 |
| `/plan` | 학습 계획 | Tines | 로그인 | `/plan` | PlanClient | — | path-calendar(메인 워크트리 미커밋 — B14) | University | S✓ R· I· V· | 소스 | P2 |
| `/reports` | 리포트 | Tines | 로그인 | `/reports` | ReportsClient | — | path-report(미커밋) | 사례 상세 | S✓ R· I· V· | 소스 | P2 |
| `/diagnostic` | 레벨 진단 | Tines | 로그인 | `/diagnostic` | DiagnosticClient | `role=dialog` · toast | — | 역량 표 다이얼 | S✓ R· I· V· | 소스 | P2 |
| `/diagnostic/history` | 진단 이력 | Tines | 로그인 · `user_level_snapshots` | `/diagnostic/history` | HistoryTimeline | 빈 상태 | — | 이벤트 디렉터리 | S✓ R· I· V· | 소스 | P2 |
| `/settings` | 설정 | Tines | 로그인 | `/settings` | Toggle · Gwonjeom · DevicePreferences | 테마/모션 radiogroup | — | 폼(ui-kit) | S✓ R· I· V· | 소스 | P2 |
| `/teacher` | 학급 만들기/참여 + 받은/보낸 과제 | Tines | 로그인 · 역할 게이트 없음(데이터로 교사·학생 구역 분기) | `/teacher`(학생 구역 = 받은 과제) — 학급 과제 0건이라 빈 상태만 확인 가능 | TeacherClient · ReceivedAssignments · SentAssignments | 만들기/참여 폼 · 빈 상태 | scene-teacher · tile-teacher | 산업(B2B) | S✓ R· I· V· | 소스 | P2 · **학습자 구역만 변경 대상**, 교사 구역은 같은 화면이라 함께 보되 교사 기능 변경 금지 |
| `/my` · `/my/texts` | 스텁 | — | 로그인 | → `/text` | — | redirect | — | — | S✓ | 소스 | P3 |
| `/my/words` | 스텁 | — | 로그인 | → `/wordvault` | — | redirect | — | — | S✓ | 소스 | P3 |
| `/my/books` | 내 책 목록 | Tines | 로그인 | `/my/books` | SpotState · Gwonjeom | 빈 상태 | spot-empty-shelf | Library 열린 행 | S✓ R· I· V· | 소스 | P2 |
| `/my/books/[bookId]` | 이어읽기 해석(스텁) | — | 로그인 · **loading.tsx 있음** | `/my/books/42f3bce4-…` → 재개 있으면 `/text/<id>?mode=read`, 없으면 도서 상세 | — | redirect | — | — | S✓ | 소스 | P3 |

### 3-3. 서가 · 만화 (`library/layout` = LibraryTabs + ModuleBanner · `comics/layout` = ComicsTabs · 공개)

| URL | 목적 | 기준 | 진입 | 실제 확인 URL | 주요 컴포넌트 | 팝업·상태 | 기존 자산 | 참조 후보 | 검증 | 증거 | 우선 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `/library` | 스텁 | — | 공개 | → `/library/books` | — | redirect | — | — | S✓ | 소스 | P3 |
| `/library/books` | 도서 탐색 | Tines | 공개(로그인 시 개인화) | `/library/books` · `?show=all` | AreaHero · BooksExplorer → LibraryGrid · ShelfEmptyState · ComicHeroCard | **NetflixDetailSheet**(Dialog) · 탭 · 빈/걸러짐 | tile-books · card-books · spot-empty-shelf | 고객 사례 책 카드 · 이벤트 필터 | S✓ R· I· V· | 소스 | P1 |
| `/library/books/[bookId]` | 도서 미리보기 | Tines | 공개 · 로그인+수강 중이면 `/text/<id>?mode=read`(`?preview=1` 이면 건너뜀) | `/library/books/42f3bce4-5cae-4cda-ae40-f1da16d8ad99?preview=1` | UserPreviewClient · BookDetailClient · BookContentReader → WordLookupPopover | **VocabSetPreviewModal** · WordLookupPopover | — | 사례 상세 | S✓ R· I· V· | 소스 + DB ID | P1 |
| `/library/scripts` | 아티클 목록 | Tines | 공개 | `/library/scripts` · `?series=` | AreaHero · ScriptsBrowser | **SeriesInfoModal** | tile-articles | Library | S✓ R· I· V· | 소스 | P2 |
| `/library/scripts/[bookId]` | 아티클 미리보기 (id = `library_articles.id`) | Tines | 공개 · **익명만 미리보기**(로그인 시 학습 시작 → `/text/<id>`) · 아티클 아니면 도서 상세로 | `/library/scripts/14378d44-2e70-46d3-80a2-2dcf1def75c0`(익명) | inline | redirect 2종 | — | 글 상세 | S✓ R· I· V· | 소스 + DB ID | P2 |
| `/library/textbooks` | 교재 서가 | Tines | 공개 | `/library/textbooks` | ShelfScreen | — | tile-textbooks | Library | S✓ R· I· V· | 소스 | P2 |
| `/library/textbooks/[series]` | 시리즈 서가 | Tines | 공개 · 없는 시리즈 notFound | `/library/textbooks/reading` (`reading\|vocab\|syntax`) | ShelfScreen | — | — | Library 모음 | S✓ R· I· V· | 소스(`series-catalog.ts`) | P2 |
| `/library/textbooks/[series]/[step]` | 권 상세 | Tines | 공개 · 미발행이면 상태 문구 · 숫자 경로는 next.config 308 | step = RPC `textbook_shelf_inventory`; 발행 확인 `select band from textbook_volume_renders where series='reading' and status='published'` | TextbookPickButton · ShareVolumeButton | 미발행 상태 | — | Library 상세 | S✓ R· I· V· | 소스 | P2 |
| `/library/textbooks/[series]/[step]/practice` | 권 연습(DCP) | Tines(세션) | 공개 · 발행된 rung 만 | catalog `rungs[].step` 중 발행분 | DcpPlayer | 세션 상태 | — | University 작업면 | S✓ R· I· V· | 소스 | P2 |
| `/library/vocab` | 단어세트 | Tines | 공개(개인화) | `/library/vocab` | VocabSetGrid · VocabSeriesHeader | **VocabSetPreviewModal** | card-vocab · tile-decks | Library 상세 `LibraryTable` | S✓ R· I· V· | 소스 | P1 |
| `/comics` | 스텁 | — | 공개 | → `/comics/adapted` | — | redirect | — | — | S✓ | 소스 | P3 |
| `/comics/adapted` | 각색 만화 목록 | Tines | 공개 | `/comics/adapted` | AreaHero | — | tile-comics | Library | S✓ R· I· V· | 소스 | P2 |
| `/comics/adapted/[bookId]` | 만화판 상세 | Tines | 공개 · force-dynamic · notFound | RPC `list_book_comic_catalog` 의 bookId(R 단계에서 조회) | ComicFormatChoice | — | — | 사례 상세 | S✓ R· I· V· | 소스 | P2 |
| `/comics/restored` | 복원 PD 만화 | Tines | 공개 | `/comics/restored` · `?series=` | AreaHero | **ComicInfoDialog** | spot-comic | Library | S✓ R· I· V· | 소스 | P2 |
| `/comics/restored/[slug]` | PD 만화 리더 | Tines(리더) | 공개 · 패널 0이면 notFound | `/comics/restored/super-mystery-comics-csv06n06` | PdModernReader(`role=dialog`) | 리더 오버레이 | — | — | S✓ R· I· V· | 소스 + DB slug | P2 |

### 3-4. 학습 모듈 · 세션 · 결과 (`(main)` 셸, 로그인 — FS = 전체화면 세션, AppHeader 세션 모드)

검증 계정 소유 ID: `select id from texts where user_id = '<검증 계정 uuid>' order by created_at desc limit 1` · `select id from dictation_sessions where user_id = '<…>' limit 1`.

| URL | 목적 | 기준 | 진입 | 실제 확인 URL | 주요 컴포넌트 | 팝업·상태 | 기존 자산 | 참조 후보 | 검증 | 증거 | 우선 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `/text` | 내 서재 | Tines | 로그인 | `/text?view=books` (`books\|scripts\|vocab`) | MyTextbooks · TextHubContent | 탭 3 · 빈 상태 | tile-read · spot-empty-page | Library 분류 레일 | S✓ R· I· V· | 소스 | P1 |
| `/text/new` | 스크립트 추가 | Tines | 로그인 | `/text/new` | InputModeTabs · TextInput · BookChapterInput · SampleScripts · ExtractionPanel | 입력 탭 · radiogroup · toast · PrintSheet(dialog) | — | 문의 폼 · 생성/편집 | S✓ R· I· V· | 소스 | P2 |
| `/text/[id]` | 읽기 워크스페이스 | Tines(작업면 — 마케팅 히어로 금지) | 로그인 · 본인 텍스트(RLS) · layout 이 `v_text_content` 없으면 notFound | `/text/<계정 texts.id>?mode=read` · `mode=listen\|read\|comic\|shadow\|words\|flashcard\|spellforge\|wordblitz…` · `?page=` | UnifiedHeader · ReadingUniverse · InsightPanel · WordLookupPopover · FloatingAudioPlayer | InsightPanel · FloatingSparkle · SupportGloss · RecallCard · TypePopover · VoicePickerPopover · WorkspaceChapterNav · ZoomableImage · KeyboardHints · toast | spot-reading | 글 상세 `Article` · 제품 액자 | S✓ R· I· V· | 소스(669줄, 최고 복잡도) | P1 |
| `/text/[id]/comic` | 텍스트 만화 리더 | Tines(리더) | 로그인 · 만화 있는 텍스트 | `library_book_id` 있는 계정 텍스트 | ComicReader(dialog) | 리더 | — | — | S✓ R· I· V· | 소스 | P2 |
| `/text/[id]/echo` | EchoMatch | Tines(세션) | 로그인 | `content_chunks` 있는 계정 텍스트 | EchoMatchPlayerDynamic(`next/dynamic`, piper TTS) | 녹음·재생 상태 | spot-echomatch · tile-echo | — | S✓ R· I· V· | 소스 | P2 |
| `/wordvault` | 단어장 허브 | Tines | 로그인 · `?view=` 면 하위로 redirect | `/wordvault` | WordVaultHubChrome · WordVaultHub · Skeleton | ResourcePortfolio → **VocabSetPreviewModal** · 기억 4색 | tile-vault · spot-vault · spot-empty-vault | Library | S✓ R· I· V· | 소스 | P1 |
| `/wordvault/browse` | 단어 목록 | Tines | 로그인 · FS | `/wordvault/browse?book=42f3bce4-…` · `q` · `level` | WordVaultBrowseClient | 검색·필터 · 빈 결과 | spot-search | Library 표 | S✓ R· I· V· | 소스 | P1 |
| `/wordvault/study` | 학습 | Tines(세션) | 로그인 | `/wordvault/study` · `?filter=` `?from=` | WordVaultStudyClient | 세션 상태 · 완료 | spot-review-done | University | S✓ R· I· V· | 소스 | P1 |
| `/wordvault/review` | 복습(FSRS) | Tines(세션) | 로그인 | `/wordvault/review` | WordVaultStudyClient | 세션 · 완료 · due 0 | spot-review-done | University | S✓ R· I· V· | 소스 · 옛 감사 「`/review` ≡ `/study` 동일」(확인 필요) | P1 |
| `/flashcard` | 허브 | Tines | 로그인 | `/flashcard` | FlashcardHubClient | 빈 상태 | tile-flashcard | Library | S✓ R· I· V· | 소스 | P2 |
| `/flashcard/play` | 카드 세션 | Tines(세션) | 로그인 · FS | `/flashcard/play?set=6f92ab53-b978-4b08-9c6c-adeab6aeee11` · `text` `chapter` `from` `limit` | FlashcardSession · ResourceContext | MicroPause(dialog) · ZoomableImage · 완료 | spot-flashcard | — | S✓ R· I· V· | 소스 + DB ID | P1 |
| `/spellforge` | 허브 | Tines | 로그인 | `/spellforge` | SpellForgeHubClient | — | tile-spellforge | Library | S✓ R· I· V· | 소스 | P2 |
| `/spellforge/play` | 철자 세션 | Tines(세션) | 로그인 · FS | `/spellforge/play?set=6f92ab53-…` | SpellForge | MicroPause · 완료 | spot-spellforge | — | S✓ R· I· V· | 소스 | P2 |
| `/wordblitz` | WordBlitz 허브 | Tines | 로그인 | `/wordblitz` | GamePoolPanel · RecentScoresList | — | tile-wordblitz | — | S✓ R· I· V· | 소스 | P2 |
| `/scriptquiz` | 퀴즈 큐 | Tines | 로그인 | `/scriptquiz` | ScriptQuizQueue | 빈 큐 | tile-quiz · spot-quiz | — | S✓ R· I· V· | 소스 | P2 |
| `/scriptquiz/play` | 퀴즈 세션 | Tines(세션) | 로그인 · FS | `/scriptquiz/play?book=42f3bce4-…` · `ko=1` `text` `ch` | ScriptQuiz · ResourceContext | 정오 피드백 · 완료 | — | — | S✓ R· I· V· | 소스 | P2 |
| `/pairflip` | 허브 | Tines | 로그인 | `/pairflip` | PairFlipHub | — | tile-pairflip | — | S✓ R· I· V· | 소스 | P2 |
| `/pairflip/play` | 짝 맞추기 | Tines(세션) | 로그인 · FS · `?set`/`?text` 없고 sessionStorage 설정도 없으면 `/pairflip` 로 | `/pairflip/play?set=6f92ab53-…` | PairFlipGameScreen | 게임 상태 | spot-pairflip | — | S✓ R· I· V· | 소스 | P2 |
| `/pairflip/results` | 결과 | Tines | 로그인 · sessionStorage 결과 없으면 튕김(직접 진입 불가) | `/pairflip/play` 완주 후 | PairFlipResultScreen | — | — | — | S✓ R· I· V· | 소스 | P3 |
| `/dictate` | 받아쓰기 허브 | Tines | 로그인 | `/dictate` | DictationHubClient | — | tile-dictation · spot-listening | University | S✓ R· I· V· | 소스 | P2 |
| `/dictate/setup` | 준비 | Tines | 로그인 | `/dictate/setup?set=6f92ab53-…` · `text` `custom=1` `chapter` | DictationSetupClient | 설정 폼 | — | 폼 | S✓ R· I· V· | 소스 | P2 |
| `/dictate/session` | 진행 | Tines(세션) | 로그인 · FS | `/dictate/session?sessionId=<계정 dictation_sessions.id>` | DictationSessionClient | 입력·재생 상태 | — | — | S✓ R· I· V· | 소스 | P2 |
| `/dictate/results` | 결과 | Tines | 로그인 | `/dictate/results?sessionId=<같음>` | DictationResultsClient | — | — | 사례 상세 | S✓ R· I· V· | 소스 | P2 |
| `/practice` | 연습 고르기 | Tines | 로그인 | `/practice` | PracticeChooser | — | tile-* · spot-* | Solutions 카드 | S✓ R· I· V· | 소스 | P2 |
| `/practice/dcp` | DCP 연습 | Tines(세션) | 로그인 | `/practice/dcp` · `?from=` | DcpPlayer | — | — | University | S✓ R· I· V· | 소스 | P2 |
| `/arcade` | 게임 아케이드 | Tines | **공개**(개인화) | `/arcade?set=6f92ab53-…` | ArcadeMetaStrip · CourseBoard · BriefButton | **GameBriefModal** · scope 쿼리 | — | Library 격자 | S✓ R· I· V· | 소스 | P2 |
| `/arcade/ranking` | 랭킹 | Tines | 공개 | `/arcade/ranking?period=…` | RankingBoard | 기간 탭 | — | 표 | S✓ R· I· V· | 소스 | P3 |
| `/play/<game>` ×19 — cascade · connections · daily-blitz · ghost-race · glyph-tongue · letter-forge · lexicon-detective · lexicon-estate · lexicon-hands · morpheme-rules · morphmerge · pirate-quest · silent-rule · word-customs · word-economy · word-orrery · wordblitz · wordfall-cadence · wordsmith-vigil | 게임 | Tines 셸 경계·브리프·일시정지 / **게임 본체는 자체 미술 유지**(tines-mapping §8) | 로그인 · `(app)` 그룹(AppHeader 없음) · FS | `/play/<game>?set=6f92ab53-…` | `next/dynamic` Game + GameLoading(gamekit) · wordblitz: InGameBrief(GameBriefModal) · GamePauseControl | `?set=` `?text=` · 브리프 모달 · 일시정지 | 게임별 자산 | — | S✓ R· I· V· | 소스(19 layout 메타만) | P3(브리프·일시정지 공통부 P2) |

### 3-5. CSAT 학습자 — 3B 유지 (`(app)` 그룹, CsatShell 자체 크롬 · 디자인 변경 대상 아님)

| URL | 목적 | 진입 | 실제 확인 URL | 주요 컴포넌트 · 팝업 | 검증 | 비고 |
|---|---|---|---|---|---|---|
| `/csat` | 기출 홈 | 로그인 | `/csat` | HomeLanding · SpaceScreen · CsatRail · ItemFinderDialog | S✓ | **3B 스킨 장치(csat-app.css) main 에 없음** — 현재 Tines 스킨 위 모듈 CSS |
| `/csat/space` | 스텁 | 로그인 | → `/csat` | — | S✓ | |
| `/csat/browse` | 기출 탐색 | 로그인 | `/csat/browse` | CsatWorkspace · ItemFinderDialog | S✓ | |
| `/csat/diagnosis` | 진단 보드/지도 | 로그인 | `/csat/diagnosis?tab=records` | DiagnosisShell · MapScreen · RecordModal · RecordDetailModal · MapDialog · StepSheet · TaskPopup | S✓ | |
| `/csat/diagnosis/attempts/new` | 스텁 | 로그인 | → `?tab=records&modal=new` | — | S✓ | |
| `/csat/dissect` | 세트 해부 | 로그인 | `/csat/dissect` · `set` `formula` `item` `resume=1` | SessionRunner | S✓ | |
| `/csat/formulas` | 공식 진도 | 로그인 | `/csat/formulas` | ProgressView | S✓ | |
| `/csat/item/[slug]` | 문항 해설 극장 | 로그인 | `select replace(id,'#','-') from csat_items_public limit 1`(stem 제외 컬럼 ACL) | AnalysisTheater · LectureStage · V3CompareExplorer · ItemFinderDialog | S✓ | held 면 닫힘 문구 |
| `/csat/practice` | 스텁 | 로그인 | → `/csat/practice/claim-support` | — | S✓ | |
| `/csat/practice/[slug]` | 주장 연습 | 로그인 | `/csat/practice/claim-support` | ClaimPractice · PracticeReservedNotice | S✓ | 그 외 slug notFound |
| `/csat/record` | 기록 | 로그인 | `/csat/record` | RecordScreen | S✓ | |

### 3-6. 리다이렉트 요약

페이지 스텁: `/library` · `/comics` · `/my` · `/my/texts` · `/my/words` · `/my/books/[bookId]` · `/csat/space` · `/csat/practice` · `/csat/diagnosis/attempts/new`.
조건부: `/wordvault?view=` · `/library/books/[bookId]`(수강 중) · `/library/scripts/[bookId]`(로그인·비아티클) · `/fit`(옛 공유 쿼리) · `/pairflip/play`·`/pairflip/results`(sessionStorage) · `/`(로그인 → `/hub`).
`next.config.mjs` 308: `/library/textbooks/:step(\d+)[/practice]` → `/library/textbooks/reading/:step[/practice]`.

## 4. 개선 백로그 (소스 근거만 — 렌더 근거는 R 단계 뒤 갱신)

| # | 항목 | 근거 | 영향 화면 | 우선 |
|---|---|---|---|---|
| B1 | 스킨 해제 경로 제거(`NEXT_PUBLIC_SKIN=off` · `?skin=off` · 저장값 무시) | §2-1 layout.tsx | 전 화면 | P0 |
| B2 | 학습자 셸에 전역 검색(SearchDialog) — 공개 화면에만 있음 | §1 `(main)` | `(main)` 전체 | P1 |
| B3 | `font-editorial`/`english`/`serif` 하드코딩 클래스 사용처 전수 → 스킨 변수로 | §2-1 tailwind | 학습자 다수 | P1 |
| B4 | 팝오버 원시 부품 부재 — `role="dialog"` 손수 구현 10여 종을 Tines 팝오버/모달 규격 하나로 | §1 오버레이 | `/text/[id]` 외 | P1 |
| B5 | `/text/[id]` 읽기 워크스페이스 — Tines 글 상세·제품 액자 대응 설계 | 최고 복잡도 · P1 | `/text/[id]*` | P1 |
| B6 | 허브·서가·단어장 「중앙 카드 반복」 점검 → Library 분류 레일/열린 행 · University 격자 | DESIGN.md 「기능에 맞는 하위 골격」 | `/hub` `/library/*` `/wordvault*` `/text` | P1 |
| B7 | 학습 세션 FS 공통(머리·진행·완료·MicroPause) Tines 작업면 규격 | §3-4 FS 행 | 세션 10여 개 | P1 |
| B8 | 인증 2열 폼을 Tines 문의 폼 규격으로(입력·검증·오류 상태) | §3-1 | 인증 4 | P2 |
| B9 | 빈/오류/로딩 상태 — root 경계만 존재, SpotState 소품 배정 점검 | §0 경계 | 전체 | P2 |
| B10 | `ui/Modal`·`Tooltip`·`Select`·`LoadingOverlay`·`ios/SheetContainer` 미사용 부품 정리 여부 결정 | §1 | — | P3 |
| B11 | DESIGN_SYSTEM.md 절 단위 분리(현행 토큰 표 → DESIGN.md/코드, 나머지 이력) | G10 | 문서 | P2 |
| B12 | 스킨 전용 토큰과 `token-exists.test.ts` 충돌 여부 확인 | §2-1 | 테스트 | P2 |
| B13 | `/csat` 3B 스킨 장치(csat-app.css · data-design-scope) main 반영 — **CSAT 담당 작업과 조율**, 이 트랙 범위 밖 | G16 · DESIGN.md | `/csat/*` | 별도 |
| B14 | 메인 워크트리 미커밋 Tines 삽화(path-* · hero-tower · hub-hero-field · band-geo 등 staged) 출처 확인 후 필요분만 반입 | git status(D:/workspace/Vocaflow) | `/hub` `/plan` `/reports` | P2 |
