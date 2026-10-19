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

## 0-1. S0 실행 결과 (2026-10-18) — §3 표보다 이 절이 우선

**서버**: `http://localhost:3000` = 워크트리 `D:/workspace/Vocaflow-db1-apply` · 커밋 **`00ba6381c`**(미커밋 0). main `c3a03d168` 과의 차이는 CSAT API·lib 7파일뿐이고 학습자 UI·스킨·layout 차이 0(`git diff --stat`) → 학습자 화면 기준선으로 사용. 이 워크트리에서 서버를 띄우지 못한 이유: 메인 `.env.local` 직접 접근이 거부 규칙으로 막혀 있다(우회하지 않음).
**도구**: `scripts/design/capture-learner.mjs`(이번에 테마·익명·SHA·오류 판정 추가) · 계정 `runtime-test-0705`(텍스트 6 · 어휘 273) · `--fold` 첫 화면 · 모션 고정 · 대기 4s.
**증거 파일**: `docs/design/shots/learner-tines/s0/*.png` + `_report.json`, `/` 익명은 `s0-root/`(gitignore — 로컬 보관, 개인 기록 포함 가능).

| 라우트 | 1440·1280 × 라이트·다크 | 착지 | 자동 판정 | 눈 확인(1440 라이트) | R |
|---|---|---|---|---|---|
| `/`(익명) | 4/4 | `/` | 정상 | — | ✓ 자동 |
| `/fit` · `/login` · `/signup`(익명) | 각 4/4 | 같은 URL | 정상 | — | ✓ 자동 |
| `/library/scripts/14378d44…`(익명) | 4/4 | 같은 URL | 정상(h1 기사 제목) | — | ✓ 자동 |
| `/hub` | 4/4 | 같은 URL | 정상 | **확인** — 큰 보라 제목·표제 띠·제품 액자 KPI. Tines 홈 골격에 가장 가깝다 | ✓ |
| `/dashboard` | 4/4 | 같은 URL | 정상 | — | ✓ 자동 |
| `/library/books` | 4/4 | 같은 URL | 정상 | **확인** — 가운데 약 990px 컨테이너, 초록 히어로 카드 + 탭, **검색·분류 레일 없음** | ✓ |
| `/library/books/42f3bce4…?preview=1` | 4/4 | 같은 URL | 정상(h1 Hamlet) | — | ✓ 자동 |
| `/library/vocab` | 4/4 | 같은 URL | 정상 | — | ✓ 자동 |
| `/text?view=books` | 4/4 | 같은 URL | 정상 | — | ✓ 자동 |
| `/text/859e0b09…?mode=read` | 4/4 | 같은 URL | 정상 | **확인** — 단계 칩 두 줄(「Game Lab」 줄바꿈) · 문장 사이 큰 공백 · **본문 첫 줄에 원문 URL 노출**(데이터 결함) | ✓ |
| `/wordvault` | 4/4 | 같은 URL | 정상 | **확인** — 모듈 배너 + 「WordVault」 하위 머리 + 테마 버튼 = 머리 3중 · 가운데 774px 카드 | ✓ |
| `/wordvault/browse` · `/wordvault/review` | 각 4/4 | 같은 URL | 정상 | — | ✓ 자동 |
| `/wordvault/study` | 4/4 | 같은 URL | 정상 | **확인** — 가운데 648px 카드 두 장, 아래 단축키 줄. 학습 세션인데 AppHeader·띠가 그대로 | ✓ |
| `/flashcard/play?set=6f92ab53…` | 4/4 | 같은 URL | 정상 | **확인(다크)** — FS 세션 모드 정상 | ✓ |
| `/csat`(경계 확인) | 4/4 | 같은 URL | 정상 | **확인** — 먹색 버튼·회색 면, 이미 3B 계열 → 「유지」 기준선 | 기준선 |
| `/admin`(경계 확인) | 4/4 | 같은 URL | 정상 | — | 기준선 |

합계: 대상 20 라우트 × 4 조건 = **80 장 중 80 장 정상 착지**(로그인 튕김 0 · 오류 화면 0). 1차 실행에서 `/` 가 Git Bash 경로 변환(`/` → Git 설치 경로) 때문에 로그인 상태로 찍혀 `/hub` 로 넘어갔고, `MSYS_NO_PATHCONV=1` 로 다시 찍었다.
**분모**: 학습자 90 중 R 확보 **19**(`/` 포함), CSAT 11 중 기준선 1, 나머지 **미실행**. I(상호작용)·V(시각 대조)는 아직 **0**.

### S0b 참조 재조사 (tines.com, 2026-10-18)

도구 `scripts/design/tines-ref-recheck.mjs` · 원본 `tmp/tines-ref/20261018/`(커밋 금지) · 측정 `_measure.json`. 11 템플릿 × 1440·1280 = **22/22 측정**(404 페이지는 의도한 404).

| 템플릿 | h1(서체/크기 1440) | 머리 높이 | 1280 h1 | 열린 상태 |
|---|---|---|---|---|
| 홈 | Roobert 64 | 68 | 56 | 탭 5 존재 · **메가메뉴·검색: 열기 2회 실패 → 미확보**(헤더 항목 「Product…Open search」는 확인) |
| 3b(제품) | Roobert 64 | 68 | 56 | FAQ `details` 6 · 1440 에서 펼침 확인 |
| library | Roobert 44 | 68 | 44 | **왼쪽 검색·분류 레일 + 넓은 보라 히어로 + Featured/All 탭** · FAQ 펼침 확인 |
| university | Reckless 64 | 68 | 61.4 | — |
| customers | Reckless 56 | 68 | 56 | — |
| case-study | Reckless 48 | 68 | 48 | — |
| solutions/security | Reckless 64 | 68 | 64 | — |
| pricing | Roobert 64 | 68 | 64 | FAQ 5 · 1440 펼침 확인, 1280 미확보 |
| book-a-demo | Roobert 28 | 68 | 28 | 폼(제출 안 함) |
| legal | Reckless 36 | 68 | 36 | — |
| 404 | Roobert 42 | 68 | 42 | — |

- 2026-09-21 기록과 같은 점: 머리 68px · 상용 서체 2종(Roobert 산세리프 / Reckless 세리프 편집 제목) · 알약 버튼(999px). 우리 스킨은 무료 대체(Figtree/Petrona)를 쓴다 — 저작권상 유지.
- 쿠키 배너는 대부분 페이지에서 보였다(「거절」로 닫고 측정).
- 수치는 계산 스타일이고 본문·이미지는 저장소에 넣지 않았다.

## 0-2. S2 공통 부품 결과 (2026-10-18)

**서버**: 이 워크트리 `http://localhost:3041`(커밋 `622b9c600` + S2 작업분 — 커밋 SHA 는 이 절을 담은 커밋). 환경 변수는 dotenv 로 프로세스 안에서만 읽었다.

| 항목 | 변경 | 검증 | 결과 |
|---|---|---|---|
| B2 학습자 셸 검색 | `AppHeader` 오른쪽 끝에 공개 화면과 같은 `SearchButton`(원 44px · Ctrl/⌘+K · `/api/search`) | `learner-overlay-check.mjs` · 단위 `top-nav.test.tsx` | `/hub` Ctrl+K·클릭 모두 열림 → 「hamlet」 결과 → Esc 닫힘 → **포커스가 검색 단추로 복귀** · 세션(`/flashcard/play`)에는 단추 0·Ctrl+K 무반응 ✓ |
| B4 팝오버 껍데기 | `tines-kit.ts` `POPOVER`(12px · 1px 라벤더 · 크림 · `--sh-md`, Tines 스킨에서 그림자 평평) — 6종 적용(TypePopover · FloatingSparkle · SupportGloss · RecallCard · WorkspaceChapterNav · WordLookupPopover). **이 값은 S2 당시 우리 구현값이며 Tines 측정 근거가 없었다** — 참조 대조와 역할별 적합성은 §0-3 | 가드 `popover-surface.test.ts` · 실측 | 6종이 같은 껍데기로 그려짐(타이포 설정 240px·12px, 장 목록 320px·12px, 이전 6px) — 일관성만 확인, 참조 일치는 미검증 |
| B4 Esc 닫기 | `lib/ui/use-escape-key.ts`(닫힌 동안 듣지 않음) — FloatingSparkle · InsightPanel 에 적용(이전 Esc 불가) | 가드 테스트 · 실측 | 열린 팝업 Esc 로 닫힘 ✓ |
| **새로 찾은 결함** | 닫힌 「학습 인사이트」 곁 패널이 화면 밖에 `role="dialog"` 로 남아 **Tab 이 안의 단추에 들어감**(aria-hidden 만 있었음) → 닫힌 동안 `inert` | 측정기가 이 패널을 열린 팝업으로 오판한 것에서 발견 | 수정 ✓ |
| 모달(Dialog) | 변경 없음(9월 §28 에 이미 통일) | 도서 상세 시트 1140px·24px · 단어장 미리보기 880px·24px, Esc 닫힘 | ✓ |
| B3 세리프 하드코딩 | **변경 불필요 — 오판 정정**: Tailwind `font-editorial/english/serif` 가 이미 `var(--font-serif)` 등 변수를 먼저 쓰고 스킨이 덮는다 | `tailwind.config.ts:128-163` | — |
| B9 빈/오류/로딩 | 오류·404 는 이미 `SpotState` 소품. 로딩은 스피너 유지(화면 전환마다 삽화는 산만). **빈 상태 부품이 `SpotState`(16곳)·`EmptyState`(27곳) 두 벌** → S4 화면 묶음에서 통합 | grep | 이관 |

- 상호작용 **7/7**(`docs/design/shots/learner-tines/s2/_overlays.json` · 열린 화면 캡처 6장). 측정기 오판 2건(닫힌 패널을 열린 것으로 · 디바운스 전 빈 결과)을 고친 뒤의 수치다.
- **범위 밖 차이 — 원인별**(2026-10-18 재조사, `shot-diff.mjs` 가 차이 영역을 출력하도록 고친 뒤 · 확대 캡처 `s2-after/_diff/`):

  | 화면 | 차이 | 영역(1440) | 원인 | 판정 |
  |---|---|---|---|---|
  | `/admin` 4장 | 0.03~0.04% | x1243–1350 · y74–83 | 화면의 「조회 시각 · PM 09:27 KST」 → 「PM 10:00 KST」(확대 캡처로 확인) — 촬영 시각 차이 | **확인 — 시각 표시**. 이번 변경과 무관 |
  | 학습자 화면(`/hub` 등) | 0.04% | x1277–1415 · y12–51 | 헤더 오른쪽 끝 검색 원 추가 | **확인 — 의도한 변경** |
  | `/csat` 1440·1280 다크, 1440 라이트 | 0.00% | — | — | 차이 없음 |
  | `/csat` 1280 라이트 | 3.30% | x93–1231 · y94–899 | 변경 후에는 「2026·42번 — 이어서 볼 수 있어요」 줄이 있고 기준선 이 1장에만 없다. **같은 기준선 실행의 다른 3장(1440 라이트 · 다크 2장)에는 그 줄이 있다** → 계정 데이터가 바뀐 것이 아니라 이 1장에서만 줄이 빠졌다. 빠진 이유(조회 시점 · 응답 지연 등)는 **확인하지 못했다** | **미확인 — 일시 누락**. 이번 변경 파일은 `(app)/csat` 를 거치지 않는다(코드 경로 근거). 「데이터 차이」라고 적었던 앞 판은 근거가 부족해 정정 |

- **분모(2026-10-18 S2 시점)** — 섞지 않는다:
  - 상호작용 **시나리오 7개**: 검색(단축키) · 검색(클릭) · 도서 상세 시트 · 단어장 미리보기 · 타이포 설정 · 장 목록 · 세션 검색 없음 → 7/7 통과.
  - 그 시나리오가 확인한 **고유 화면 6개**: `/hub` · `/library/books` · `/library/vocab` · `/text/[id]` · `/flashcard/play` · 학습자 헤더(공통). 학습자 90 화면 기준 I 확보 = **5 화면**(헤더는 화면이 아니라 공통 부품).
  - **V(참조 측정 대조) = 0**. 기능 테스트·상호작용 통과는 V 로 세지 않는다.

## 0-3. S3 결과 (2026-10-18)

공통 조건: 우리 = 이 워크트리 `http://localhost:3041`(작업분 — 커밋은 이 절을 담은 커밋), 기준선 = `http://localhost:3000`(`00ba6381c`), 계정 `runtime-test-0705`, 라이트(다크 별도 표기), 모션 감소. 참조 = tines.com 2026-10-18 실측(`tines-ref-recheck.mjs` · `layout-measure.mjs`). 캡처는 `tmp/s3/`(커밋 안 함).

### ① 서가 `/library/books`

**채택 근거(수정 전 측정)** — 같은 도구(`scripts/design/layout-measure.mjs`)로 1440·1280 을 쟀다.

| | 우리(전) | Tines Library | Tines Customers |
|---|---|---|---|
| 바깥 틀 | 본문 992(1440 · 1280 같음) | 뷰포트 − 80 = 1360 / 1200 | 1128 / 968 |
| 검색·분류 위치 | **y 2508** — 「전체 탐색」 안의 펼친 상자(조건 8줄 ≈ 630px) | **왼쪽 레일 x40 · w288(1280: 279) · y154**, 검색 알약 41px + 접히는 분류 묶음 | 없음 |
| 결과 격자 시작 | **y 3137**(세 번째 화면) · 6열 152px | 본문 x400(1280: 367) | 3열 |

- 우리 조건 상자와 Tines 레일은 **같은 역할**(검색 + 분류로 목록 좁히기)이다 → 레일 골격 **채택**. 조건을 결과 위에 쌓으면 결과가 화면 밖으로 밀린다는 것이 실측(y 3137)으로 드러났다.
- 위쪽 추천 구획(코버플로 · 「지금 딱 맞아요」 등 가로 선반)은 **전체 폭이 필요한 가로 스크롤**이라 레일 옆에 두지 않았다 → Tines 처럼 페이지 전체를 레일로 감싸는 안은 **기각**. 레일은 「전체 탐색」 구획에만.
- 바깥 틀은 Tines Library 값(뷰포트 − 80)을 채택 — 레일 288 + 간격 + 결과 칸이 들어갈 폭이 992 에는 없다. 다른 서가 탭은 이번 범위가 아니라 그대로 두고, 서가 머리(탭·배너)는 이 화면에서만 같은 폭으로 맞췄다(`data-shelf-wide` + `:has()`).

**결과 표**

| 대상 URL·상태 | 참조 URL·상태 | 측정 항목 | 참조값 | 적용값 | 차이·의도 | 전후 캡처 | 남은 문제 |
|---|---|---|---|---|---|---|---|
| `/library/books` 전체 탐색 · 기본 | tines.com/library · 기본 | 레일 위치·폭 | x40 · w288(1280: x40 · w279) | x40 · w288(1280 같음) | 1280 에서 +9px — 고정 폭이 결과 칸 열 수를 안정시킨다 | `tmp/s3/shelf-before/browse@1440-light.png` → `shelf-after/browse@1440-light.png` · `@1280` | — |
| 같음 | 같음 | 결과 칸 시작 x | 400(1280: 367) | 400(1280: 392) | 1280 에서 +25 — 간격을 `clamp(48px, 5vw, 72px)` 로 둠(참조 1280 간격 48) | 같음 | 1280 간격을 참조와 맞출지 S5 에서 판단 |
| 같음 | 같음 | 검색 입력 | 알약(990px) · 높이 41 · 레일 폭 | 알약 · 높이 44 · 레일 폭(284) · 라벤더 면 | 높이 +3 = 터치 44px 규칙 | 같음 | — |
| 같음 | 같음 | 분류 묶음 | 접힘 + 아래 화살표 | `details` 접힘 · 화살표 · 고른 묶음은 열린 채 + 점 표시 · 높이 44 | 선택이 접힌 묶음에 숨지 않게(의도) | `tmp/s3/shelf-check/filter@1280.png` | — |
| 같음 | 같음 | 결과 격자 시작 y | (참조 첫 카드 y703 — 위 구성 다름) | 3137 → **2491** | 위쪽 추천 구획을 유지해서 첫 화면에는 아직 없다(의도 — 위 기각 근거) | 같음 | 첫 화면 구성은 서가 2차 과제 |
| 같음 · 스크롤 | 같음 | 레일 고정 | 레일 높이가 페이지 전체(7429) | `sticky` top 88 · 자체 스크롤 | 같은 효과 | `shelf-check/sticky@1440.png` | — |
| 같음 · 머리 | tines.com/library 머리 | 바깥 틀 | 1360 / 1200 | 1360 / 1200(탭·배너 포함) | 히어로는 참조(1000, 레일 옆)와 달리 전체 폭 — 레일이 아래 구획에만 있어서 | `shelf-after/ours-books@1440.png` | — |
| 같음 · 다크 | (참조 다크 없음) | 레일·결과 | — | 자체 다크 토큰 | 참조에 다크 화면 없음 → 자체 대응 | `shelf-after/browse@1440-dark.png` | 카드 배지(B2·읽을 장)가 다크에서 흐림 — **기존 문제**(카드 부품 미변경) |
| 같음 · 코버플로 | — | — | — | 변경 없음 | — | `shelf-before/spotlight@1440-light.png` ↔ `shelf-after/…` | 코버플로 왼쪽 빈 자리 · 페이지 점 x≈486 치우침 — **기준선에도 있음**(이번 변경 무관) |

**동작 검증** `scripts/design/shelf-check.mjs` — 1440·1280 각 **7/7**(`tmp/s3/shelf-check/_shelf@*.json`): 레일이 결과 왼쪽 · 검색 「hamlet」 312 → 1권(격자도 1장) · 레벨 칩 → 10권 + 묶음 열린 채 + 선택 점 · 초기화 → 312 · 접힌 「장르」 키보드 Enter 로 펼침(요약 높이 44) · 스크롤 후 레일 top 88 고정 · 격자 카드 → 상세 시트(모달 1) → Esc 닫힘.
**범위 밖** — 같은 날 3000 ↔ 3041 픽셀 비교: `/library/vocab` · `/library/scripts` · `/library/textbooks` 각 0.04%(영역 x1277–1415 · y12–51 = S2 헤더 검색 원, 확인) · `/csat` 0.00%.
**판정**: 서가 = R ✓ · I ✓ · **V ✓(전체 탐색 구획 · 머리 틀)** / 첫 화면 추천 구획은 V 미실행.

### ② 단어장 `/wordvault`(허브)

**범위 확인** — 「단어장 머리」(`WordVaultHubChrome`)를 쓰는 화면은 허브 하나다. `/wordvault/study` · `review` · `browse` 는 머리띠 제외 목록에 있고 자기 화면을 그린다 → 세션 단계(③)에서 다룬다.

**수정 전 측정**(`layout-measure`, 1440 · 1280 같은 값)

| 층 | 역할 | 위치·크기(전) |
|---|---|---|
| 셸 머리띠(ModuleBanner) | 장식 — 모듈 이름 「WORDS · WORDVAULT」 + 한 줄 「만난 단어를 내 것으로 모아요」 | x232 · y146 · 976×128 · 분홍 면 |
| 얇은 바(GlassBar) | **제목** h1 「WordVault」 18px Petrona · 보기 탭 4 · 테마 전환 | h1 **x20**(화면 가장자리) · y286 · 탭은 오른쪽 끝 |
| 본문 카드 | **자료 정보**(단어 수 · 기억 4색) + **학습 조작**(「지금 다시 만나기」) | x333 · 폭 772 |

참조 tines.com/library 머리: 하위 머리 줄(빵부스러기 · 하위 내비 · 테마 전환) → 진한 판(눈썹 · h1 44px · 설명 · 그림 · 판 아랫변 탭 Featured/All). **시작선은 하나**(본문 칸 x400).
→ 문제: 시작선 셋(232 · 20 · 333) · 제목 18px · 모듈 이름 반복. **채택**: 서가와 같은 `AreaHero` 판 한 장(눈썹 = 머리띠 문구 · h1 · 설명 · 그림 · 판 아랫변 보기 탭 · 오른쪽 위 테마 전환). 테마 전환은 참조 하위 머리에도 있는 조작이라 **유지**. 머리띠는 이 화면에서만 끈다(`NO_BANNER` 에 `/^\/wordvault$/`).

| 대상 URL·상태 | 참조 URL·상태 | 측정 항목 | 참조값 | 적용값 | 차이·의도 | 전후 캡처 | 남은 문제 |
|---|---|---|---|---|---|---|---|
| `/wordvault` · 기본 | tines.com/library · 기본 | 시작선 | 하나(본문 칸) | 판 x334 = 본문 카드 x334(1280: 254 = 254) | 일치 | `tmp/s3/vault-before/ours-vault@1440.png` → `vault-after/ours-vault@1440.png` | — |
| 같음 | 같음 | 제목 크기 | h1 44px · 500 | 52px · 500(Figtree) | +8 — 서가 판(`AreaHero`)과 같은 값으로 앱 안 구역 머리를 통일(의도) | 같음 | 44 로 맞출지는 S5 에서 서가와 함께 |
| 같음 | 같음 | 보기 전환 | 판 아랫변 폴더 탭 | 판 아랫변 탭 4 · 높이 44 · `aria-current` | 같은 골격 | 같음 | — |
| 같음 | 같음 | 테마 전환 | 하위 머리 오른쪽 끝 | 판 오른쪽 위 44px 원 | 위치 다름 — 하위 머리 줄을 따로 두지 않아서(의도) | `vault-check/theme-toggled@1440.png` | — |
| 같음 | 같음 | 머리 높이 | 판 411 | 판 348(머리띠 128 + 바 52 를 대신) · 본문 카드 y 358 → 526 | 첫 화면에 카드 · CTA 는 그대로 보인다(CTA y≈845) | 같음 | — |
| 같음 · 다크 | (참조 다크 없음) | — | — | 자체 다크 | 자체 대응 | `vault-check/theme-toggled@1440.png` | — |

**동작 검증** `scripts/design/vault-check.mjs` — 1440·1280 각 **7/7**(`tmp/s3/vault-check/_vault@*.json`): h1 하나 · 시작선 일치 · 탭 4개(현재 = 허브, 높이 44) · 「둘러보기」 탭 이동 · 테마 전환(light → dark, 되돌림) · 자료 정보(단어 수 + 기억 4색 칸) · 「지금 다시 만나기」가 **기준선(3000)과 같은 목적지**(`/wordvault/browse?filter=state:risk`) · 자료 묶음 미리보기 팝업 열림 → Esc 닫힘.
- 측정기 정정 2건: ① 처음엔 CTA 가 세션으로 간다고 기대했으나 원래 동작이 흐릿한 단어 목록이었다(화면 코드 `VaultIdentity.tsx` 미변경) — 기대값을 「기준선과 같은 목적지」로 고침 ② 본문 카드 테두리가 Tines 스킨에서 그림자 고리라 탐지 조건에 추가.
**범위 밖** — `/flashcard` · `/spellforge` · `/dictate` · `/scriptquiz` 허브(머리띠 유지 화면) 3000 ↔ 3041 각 0.04%(영역 x1277–1415 · y12–51 = S2 검색 원, 확인).
**판정**: 단어장 허브 머리 = R ✓ · I ✓ · V ✓(머리) / 본문(가운데 772 칸 · 카드 구성)은 V 미실행.

### ③ 학습 세션

**참조 근거** — tines.com 에는 학습 세션에 대응하는 화면이 없다(마케팅 사이트). 세션의 기준은 **우리 세션끼리의 공통 조작 일관성**이고, 이미 다수(전체화면 세션 4종)가 쓰는 세션 틀(`SessionFrame` — 위쪽 막대 56 · 오른쪽 위 44px 「세션 닫기」 · Esc · `?from=` 복귀)을 기준으로 삼았다. Tines 값과 비교한 V 는 해당 없음.

**수정 전 측정**(`scripts/design/session-audit.mjs`, 기준선 3000 · 1440)

| 세션 | 전역 헤더 | 나가기 조작 | 설정 | 비고 |
|---|---|---|---|---|
| 플래시카드 · ScriptQuiz | 없음 | 오른쪽 위 「세션 닫기 (Esc)」 44px | — | 기준 |
| SpellForge | 없음 | 「세션 닫기」 x1376 + **「스펠 닫기」 x1380 겹침**(닫기 둘) | — | |
| PairFlip | 없음 | 「세션 닫기 (Esc)」 · 위쪽 막대 95 | — | |
| **단어장 학습 · 복습** | **있음** | 카드 안 왼쪽 「← 종료」(x417) | 「학습 설정 열기」(→ `/settings`) | 다른 세션과 자리·이름이 다름 |
| 구문 연습 `/practice/dcp` | 있음 | 「오늘」 링크 | — | 이번 미변경(아래 남은 문제) |
| Echo `/text/[id]/echo` · 만화 `/text/[id]/comic` | 있음 | 「본문으로」 **63×18 · 포커스 표시 없음** | — | 워크스페이스 안 화면이라 전체화면 아님(레지스트리 의도) |

**적용**: ① 단어장 학습·복습을 전체화면 세션으로(`full-screen-routes` · `SessionFrame` 제목 「WordVault 학습/복습」 · 닫기 `/wordvault`, `?from=` 복귀는 틀이 그대로 처리). 카드 안 「← 종료」는 틀의 닫기와 같은 일(`/wordvault` 이동 · FSRS 는 떠날 때 저장 `useSrsFlushOnLeave`)이라 뺐고, **진행 막대 · 설정 · 하단 단축키는 유지**. Esc 는 세션 Esc 로 등록해 저장(flush) 후 종료를 이쪽이 맡는다(틀과 이중 이동 방지). ② SpellForge 자체 닫기를 전체화면에서는 숨김(읽기 화면 안 `?mode=spellforge` 에서는 유지). ③ Echo · 만화 「본문으로」 높이 44 · 포커스 표시.
**유지(모듈 학습 방식)**: SpellForge 의 Esc = 단어 건너뛰기(v08.7 [B1] 결정 — 한 번의 Esc 가 건너뛰기와 종료를 동시에 하던 결함의 수정). 그래서 틀 라벨에 「(Esc)」가 없다 — 정확한 표시.

| 대상 URL·상태 | 참조 | 측정 항목 | 기준값(세션 틀) | 적용값 | 차이·의도 | 전후 캡처 | 남은 문제 |
|---|---|---|---|---|---|---|---|
| `/wordvault/study` · 첫 카드 | 우리 세션 틀(참조 대응 없음) | 전역 헤더 | 없음 | 있음 → **없음** | 일치 | `tmp/s3/session-check-3000/vault-study@1440-start.png` → `session-check-3041/…` | — |
| 같음 | 같음 | 나가기 | 오른쪽 위 44 · 하나 | 카드 안 x417 → **x1376 · 44 · 하나** | 일치 | 같음 | 라벨 「세션 닫기」에 「(Esc)」 없음 — 세션이 Esc 를 등록하면 틀이 떼는 규칙. 실제로 Esc 는 종료하므로 하단 단축키 「Esc 종료」가 안내 |
| 같음 | 같음 | Esc | 복귀 | `/wordvault` | 일치 | — | — |
| `/wordvault/review` | 같음 | 위 셋 | 같음 | 같음 | 일치 | 같음 | 같음 |
| `/spellforge/play` | 같음 | 나가기 개수 | 1 | 2 → **1** | 일치 | `session-check-*/spellforge@1440-start.png` | Esc = 건너뛰기(유지) |
| `/text/[id]/echo` · `/comic` | — | 「본문으로」 탭 대상 | 44 | 18 → 44 · 포커스 표시 | 접근성 규칙 | — | 렌더 확인은 읽기 단계에서 |

**동작 검증** `scripts/design/session-check.mjs`(FSRS 평가 쓰기는 하지 않음 — 공유 검증 계정): 기준선 **2/6** → 변경 후 **5/6**(`tmp/s3/session-check-{3000,3041}/_sessions@1440.json`). 남은 1 = SpellForge Esc(건너뛰기 — 의도된 모듈 동작, 측정 기대값이 「Esc = 복귀」라 실패로 찍힘). 학습 동작(Space) 후 화면 변화: 단어장 학습·복습 · PairFlip 있음, 플래시카드 · ScriptQuiz · SpellForge 는 Space 로 바뀌지 않음(기준선도 같음 — 그 모듈의 공개 조작이 Space 가 아니거나 포커스 조건, 미확인).
**미확인**: PairFlip Esc — 기준선은 머무름(`/pairflip/play`), 변경 후는 복귀(`/pairflip`). PairFlip 코드는 이번에 바꾸지 않았다. Space 로 카드를 뒤집은 상태에 따라 Esc 를 게임이 가져가는 것으로 추정되나 확인하지 못했다.
**남은 문제**: 구문 연습(`/practice/dcp`)이 전역 헤더 + 「오늘」 링크로 나간다 — 세션으로 볼지(레지스트리 결정) 판단 필요. 받아쓰기 세션(`/dictate/session`)은 검증 계정에 세션 행이 없어 열지 못했다(만들려면 학습 데이터 쓰기 — 미실행). 세션 화면의 Tines 시각 대조는 대응 화면이 없어 V 해당 없음.

### 팝오버 6종 — 참조 측정과 역할 판정

참조 실측(1440 · 1280 같음): **앵커형 드롭다운**(Library 하위 내비 「Overview ▾」) 180×198 · 모서리 **10px** · 테두리 1px 보라 12% 투명(`rgb(93 56 174 / .12)` 근사) · 그림자 없음 · 안여백 6px · 크림 면. **검색 패널**(홈 「Open search」) 900×204 · 모서리 **16px** · 테두리 보라 14% · 옅은 그림자(0 20px 60px 5%). **메가메뉴** 600×306 · 모서리 20px · 그림자 없음 · 클릭으로 열림 · 뒤를 어둡게 덮음. (캡처 `tmp/tines-ref/20261018/library-dropdown@1440.png` · `home-megamenu@1440.png` · `home-search@1440.png`)

| 우리 팝오버 | 역할 | 가장 가까운 참조 | 현재(S2 구현값) | 판정 |
|---|---|---|---|---|
| 장 목록(WorkspaceChapterNav) | 목록형 메뉴 | 앵커형 드롭다운 | 12px · 라벤더 `--bd` 불투명 | 참조와 다름: 10px · 12% 투명 테두리 · 안여백 6px → **읽기 단계에서 「메뉴」 규격으로 분리** |
| 타이포 설정(TypePopover) | 설정 패널 | 앵커형 드롭다운(조작 묶음) | 12px · 라벤더 | 같은 「메뉴」 규격 후보 — 읽기 단계에서 대조 |
| 단어 풀이(WordLookupPopover) · 회상 카드(RecallCard) · 보조 풀이(SupportGloss) | 내용형 카드(본문 위 떠 있는 읽을거리) | 검색 패널(떠 있는 내용 면) | 12px · 그림자 없음 | 참조 검색 패널은 16px + 옅은 그림자 → **「카드」 규격 후보**, 읽기 단계에서 실제 크기로 대조 |
| 다음 단계 추천(FloatingSparkle) | 떠 있는 안내 카드 | 검색 패널 | 12px | 「카드」 규격 후보 |

→ **한 규격(12px)으로 묶은 것은 역할 구분 없이 맞춘 것**이었다. 참조는 목록형(10px · 무그림자)과 떠 있는 내용 면(16px · 옅은 그림자)을 다르게 쓴다. → ④ 읽기에서 두 벌로 나눠 적용·대조했다(아래).

### ④ 읽기 `/text/[id]` + 팝오버 6종

**수정 전 측정**(`scripts/design/reading-measure.mjs`, 1440 · 1280 같음)

| | 우리 | Tines 사례 상세(omada-health) |
|---|---|---|
| 본문 단 | x412 · 폭 616(바깥 article 680 − 안 여백 32×2) | x380 · 폭 680 |
| 글자 | Petrona 15px · 줄 간격 23.25(1.55) · 400 · 먹색 | Roobert 18px · 29.25(1.625) · 500 · 보라 |
| 한 줄 글자 수(근사) | 82 | 76 |

- 글자 크기·줄 간격은 **유지**: 15px · 1.55 는 v06.62 사용자 피드백(「너무 큼」)으로 정한 값이고 학습자가 타이포 설정으로 바꾼다 → 참조 18px 와의 차이는 **의도**. 영어 원문 서체는 Tines 편집 세리프의 무료 대체(Petrona)라 이미 같은 계열.
- 눈 확인으로 드러난 결함 2: ① **문장 사이 빈 틈** — 문장마다 붙은 「문장 듣기」 단추(18px)의 평소 배경이 `var(--bd)` + 투명도 슬래시 클래스라 Tailwind 가 CSS 를 만들지 않아 **투명**했다(계산 스타일 `rgba(0,0,0,0)` 확인). ② **타이포 설정 팝오버**가 열리는 순간 자기 초기값(19px · 1.85)을 문서에 써서 고르지 않아도 본문이 15 → 19px 로 바뀌었고, 고른 값은 저장되지 않았으며, 「기본」 칸(1.85)이 실제 기본(1.55)과 달랐다.

**적용**: ① 같은 무효 클래스를 읽기 화면 범위(`components/workspace` 7파일 16곳)에서 `color-mix` 로(`scripts/design/var-opacity-codemod.mjs`, 재실행 0건). 문장 듣기 점은 주석의 원래 의도(「평소 4px 도트 → 올리면 풀 버튼」)대로 평소 상태를 가운데 원형 그라디언트 점으로 — 그대로 살리면 18px 원이 문장마다 찍혀 무거웠다. 학습자 코드 전체에는 같은 결함이 **119곳 · 50파일**(관리자·테스트 제외) 있었고 읽기 16곳만 고쳤다 → 나머지 **103곳 · 44파일**은 화면 묶음마다 눈으로 보며 고친다(S4). 늘지 않게 상한 가드 `var-opacity-ratchet.test.ts`(103 · 읽기 0). ② 타이포 설정: 열 때 현재 값을 읽고 고를 때만 적용·저장(`lib/reader/type-prefs.ts` · localStorage) · 읽기 화면이 열릴 때 저장값 적용(`UnifiedHeader`) · 선택지 15/17/19/22 · 1.4/1.55/1.85(가운데 = 실제 기본) · 칸 높이 44 · 포커스 표시. ③ 팝오버 두 벌 — `POPOVER_MENU`(장 목록 · 타이포 설정) · `POPOVER_CARD`(단어 풀이 · 회상 · 보조 풀이 · 추천).

| 대상 URL·상태 | 참조 URL·상태 | 측정 항목 | 참조값 | 적용값 | 차이·의도 | 전후 캡처 | 남은 문제 |
|---|---|---|---|---|---|---|---|
| `/text/[id]?mode=read` · 장 목록 열림 | tines.com/library · 「Overview ▾」 열림 | 모서리 · 테두리 · 그림자 | 10px · 1px 보라 12%(`rgb(93 56 174/.12)` 근사) · 없음 | 10px · 1px `--ju-ink` 12%(`rgb(84 47 156/.12)`) · 없음 · 320×251 | 테두리 색 근사(스킨 토큰) | `tmp/s3/reader-popover/chapter-nav@1440-light.png` · `@1280` · `@1440-dark` | — |
| 같음 · 타이포 설정 열림 | 같음 | 같음 | 같음 | 10px · 같음 · 240×203 | 일치 | `type@1440-*.png` | — |
| 같음 · 추천 카드 열림 | tines.com · 「Open search」 열림 | 모서리 · 테두리 · 그림자 | 16px · 1px 보라 14% · 0 20px 60px 5% | 16px · 1px `--ju` 14%(`rgb(113 75 208/.14)` = 참조와 같은 값) · 0 20px 60px `--t1` 5% | 일치 | `sparkle@1440-*.png` | — |
| 같음 · 단어 풀이 열림 | 같음 | 같음 | 같음 | 같음 · 288×138 | 일치 | `word@1440-*.png` | 누른 낱말이 「org」 — 본문 첫 줄 원문 URL 노출(B19 데이터 결함) |
| 회상 카드 · 보조 풀이 | 같음 | 껍데기 | 같음 | 같은 `POPOVER_CARD`(소스 가드) | — | — | 실제 열린 화면 V 미실행(학습 데이터 조건 필요) |
| 같음 · 본문 | tines.com 사례 상세 | 글자 · 단 | 18px · 680 | 15px · 616(유지) | 의도 — v06.62 사용자 결정 · 학습자 조절 | `tmp/s3/read-3000/…@1440-light.png` → `read-3041/…` | — |
| 같음 · 문장 듣기 점 | — | 평소 표시 | (설계 의도 4px 점) | 투명 → 지름 약 5px 점 · 올리면 18px 버튼 | 결함 수정 | `read-3041/_diff/dots-before.png` → `dots-after3.png` | — |

**동작 검증** `scripts/design/reader-popover-check.mjs` — 1440 라이트 · 1280 라이트 · 1440 다크 각 **6/6**(`tmp/s3/reader-popover/_reader@*.json`): 장 목록 열기 · 껍데기 · Esc / 타이포 설정 열기만 해서는 본문 15px 그대로 / 「크게」 → 19px · Esc / 새로고침 후 19px 유지 · 「크게」 눌림 표시 → 「기본」 15px / 추천 카드 / 단어 풀이 카드.
**범위 밖** — 읽기 화면 3000 ↔ 3041: 0.06~0.07%(문장 점 · 헤더 검색 원).
**남은 문제**: 단계 칩 두 줄 · 「Game Lab」 줄바꿈(B18 — 모듈 15개 정보 구조 결정 필요) · 받아쓰기·회상 카드·보조 풀이의 열린 화면 V.

## 0-4. S4 결과 (2026-10-19)

서버: 이 워크트리 `http://localhost:3041`(작업분 — 커밋은 이 절을 담은 커밋) · 기준선 `http://localhost:3000`(`00ba6381c`). 검증 계정 `runtime-test-0705`.

**분모(정확 집계)** — [learner-render-ledger.md](./learner-render-ledger.md)(생성물 `scripts/design/render-ledger.mjs`, 결과 JSON 46개 → 라우트 템플릿 매칭):
학습자 **91** 라우트(S4 에서 `/practice/dcp/session` 추가) 중 **정상 렌더 증거 30** · 격리 화면만 1(`/dictate/session`) · 나머지 60 미실행. CSAT 11 중 1(경계 확인용).
상호작용·시각 대조는 아래 단위별로 따로 적는다 — 기능 통과를 V 로 세지 않는다.

### ① 읽기 활동 선택(ModePills)

- **수 정정**: 등록 활동은 **12개**다(읽기·듣기 4 · 단어 2 · 연습 6). S3 보고의 「15개」는 근거 없는 오기였다.
- 실제 노출 항목과 목적지(코드 `hrefFor`, 기준선과 동일 확인):

  | 그룹 | 활동 | 목적지 |
  |---|---|---|
  | 읽기·듣기 | Listen · Read | `/text/[id]?mode=listen|read` |
  | | Comic | `/text/[id]/comic` |
  | | Shadow | `/text/[id]?mode=shadow` |
  | 단어 | Words | 자료 스코프 단어장(WordVault browse) + `from=` |
  | | Cards | 자료 스코프 `/flashcard/play?set|text=` + `from=` |
  | 연습 | Spell | `/text/[id]?mode=spellforge`(인라인) |
  | | Blitz | 자료 스코프 WordBlitz + `from=` |
  | | Pairs | `/pairflip/play?text=<id>` + `from=` |
  | | Game Lab | 자료 스코프 `/arcade?set|text=` + `from=` |
  | | Quiz | `/scriptquiz`(스코프 없는 허브) |
  | | Dictate | `/dictate/setup?text=<id>` + `from=` |

- 변경: 한 줄 12개 + ▸ 화살표 → **현재 활동 알약 하나 + 「읽기·듣기 / 단어 / 연습」 펼침 메뉴**(메뉴형 팝오버 · 그룹별 완료 수 · 현재/완료 표시 · Esc · 바깥 닫기 · 포커스 복귀). 「다음 단계」 화살표 제거.
- 검증 `scripts/design/modepills-check.mjs` — 1440·1280 각 **6/6**: 한 줄(높이 57 · 보이는 조작 4) · 최소 높이 44 · 화살표 0 · 현재 = Read · **목적지 주소 12개가 기준선과 동일(빠짐 0 · 추가 0)** · 세 메뉴 열기 → 항목 44px → Esc 닫힘 → 연 단추로 포커스 복귀. 캡처 `tmp/s4/modepills/`.
- e2e `12-navigation` · `13-arcade-integrity` 는 메뉴를 연 뒤 링크를 누르도록 고쳤다(닫혀도 링크는 DOM 에 남아 주소 수집은 그대로). **e2e 자체는 실행하지 않았다**(공유 DB 쓰기 포함 여부 미확인).

### ② `/practice/dcp` — 푸는 동안만 세션

- 전체화면 판정이 주소 기준이라 주소를 나눴다: `/practice/dcp` = 안내(문항 없음 · 오늘 완료 — 기존 문구 그대로) · 풀 문항이 있으면 `from` 을 실어 **`/practice/dcp/session`**(전체화면 세션 틀) 으로. 세션은 같은 `DcpPlayer` 라 채점(`grade_dcp_item`) · 오답 원인 기록 · 요약 · 중도 이탈 동작은 바꾸지 않았다. 문항 조회 `prescribe_today` 는 허브도 매번 부르는 읽기 RPC.
- 닫기 · Esc: `?from=/practice` → `/practice`, from 없음 → `/hub`(예전 기본값과 같음). 세션 화면 위에 셸 머리띠가 남던 것을 제외 목록에 추가.
- 검증 `session-check` — `from` 있음 · 없음 각 ✓(전역 헤더 없음 · 닫기 하나 · Esc 복귀). 안내 화면(문항 없음 · 오늘 완료) 렌더는 검증 계정에 오늘 문항이 있어 **미실행**.

### ③ 세션 측정기 · PairFlip

- 측정기를 **모듈별 계약**으로 고쳤다(`scripts/design/session-check.mjs` 머리 주석에 근거). Esc 는 세션 틀이 앱에서 유일하게 듣고 모듈이 `useSessionEscape` 로 먼저 쓴다 — SpellForge(건너뛰기) · 단어장 학습/복습(저장 후 종료)만 등록, 나머지는 틀이 복귀. Space 는 플래시카드(뒤집기)와 단어장 학습(공개)만 계약.
- **SpellForge Esc 기대값을 바꾼 근거**: Esc = 「단어 건너뛰기」 확인 창(`window.confirm`) — v08.7 [B1] 결정. 측정 도구가 확인 창을 자동 취소해서 변화가 없었던 것이다. 「확인」은 FSRS 오답 기록을 쌓으므로 누르지 않고 **확인 창이 뜨고 문구가 「이 단어를 건너뛸까요?」이며 세션에 머문다**를 검증한다.
- 플래시카드 Space: 앞뒤 면이 이미 DOM 에 있어 글자 비교로 안 보였다 → DOM 비교로 신호 변경.
- 결과(`tmp/s4/sessions-final/`): 변경 후 **8/8**(플래시카드 · SpellForge · ScriptQuiz · PairFlip · 단어장 학습 · 복습 · 구문 연습 from 있음/없음). 기준선(`tmp/s4/session-3000/`)은 SpellForge(닫기 두 개 — S3 에서 고침) · 단어장 학습/복습(전역 헤더) · 구문 연습(헤더)에서 실패.
- **PairFlip**: Esc 처리 주체 = 세션 틀 하나(PairFlip 컴포넌트는 Esc 를 듣지도 등록하지도 않음 — 코드 추적). `scripts/design/pairflip-check.mjs` 로 처음 · 카드 1장 선택 · 2장(피드백 팝업 중) 상태별로 기준선 ↔ 변경 후 비교 → **양쪽 모두 세 상태에서 `/pairflip` 복귀**. S3 의 「기준선은 머무름」은 3.5초 고정 대기 안에 dev 서버가 `/pairflip` 을 컴파일하지 못한 것으로 판단(주소 변화를 30초까지 기다리자 기준선도 복귀). **미확인 해제**하되 근거는 「대기 시간을 늘린 재측정」뿐임을 남긴다. 새로 본 것: 카드를 누른 뒤 포커스가 카드가 아니라 BODY 로 빠진다(양쪽 동일 — 기존 접근성 결함, 미수정).

### ④ 받아쓰기 격리 검증

- 방법(`scripts/design/dictation-isolated-check.mjs`): 화면 코드는 그대로, 브라우저에서 Supabase REST 를 가로채 고정 세션 1행(문항 3)을 돌려주고 **쓰기는 DB 에 보내지 않고 가짜 성공**으로 막아 센다.
- 결과 3/3 — 세션 틀(닫기 1 · `1 / 3`) · 입력 → 제출 → 결과 100% 피드백 · 힌트/팝업 없음. **막은 쓰기 1건**(`POST dictation_attempts?on_conflict=session_id,item_idx` — 답안 즉시 적재). 캡처 `tmp/s4/dictation/`.
- **이것은 화면 검증일 뿐 저장 · 완주 흐름 검증이 아니다**(쓰기를 막았다). 기존 e2e(`17-dictation-loop` · `23-dictate-resume` · `24-dictate-sweep`)는 세션 생성 · 기록 · 정리 쓰기를 포함하므로 실행하지 않았다 — 실행 환경(격리 DB 여부)과 승인 범위 확인 필요.
- 발견: 받아쓰기 세션에 **나가기가 둘**(세션 틀 오른쪽 위 닫기 + 화면 안 「× 나가기」) — S3 에서 다른 세션에 고친 것과 같은 중복. 「나가기」가 적재 · 종료 처리를 하는지 확인 전이라 미수정.

### ⑤ 무효 투명도 클래스 · 서가 이동 · 콘텐츠 결함 · 허브/대시보드/인증

- 무효 클래스(변수 색 + 슬래시 투명도): 서가 5파일 · 단어장 허브 4파일 17곳, 허브 · 대시보드 · 설정 3파일 6곳 고침. **같은 서버에서 변환 직전 ↔ 직후** 전체 화면 비교(기준선 3000 은 S3 이전 배치라 비교 불가): 서가 0.00% — **코버플로 페이지 점 9개가 투명하던 것이 보이게 됨**(S3 에서 「점 x≈486 치우침」으로 적은 것은 나머지 점이 안 보였던 것 — 정정), 단어장 목록 구분선이 의도대로 옅어짐, 허브 · 대시보드 · 설정 0.00%(바뀐 클래스가 포커스 고리 · 오류 상태에만 있어 정상 상태 화면은 그대로 — **포커스 · 오류 상태 화면은 미확인**). 가드를 **파일별 상한**으로 바꿈(`var-opacity-ratchet.test.ts` — 기준선 32파일 80곳, 목록 밖 파일에 하나라도 생기면 실패, 변이 확인).
- 서가: 머리 판에 「조건으로 찾기 — 전체 탐색 ↓」(`#browse`) — 추천 선반 유지. 누르면 전체 탐색 제목 y96 · 조건 레일 y134(1440 · 1280 같음). `shelf-check` 8/8 ×2.
- 본문 첫 줄 URL: **출처 표기 데이터는 정상, 본문에 장 표식 줄이 남은 가공 결함** — 기록 [content-defects/2026-10-19-chapter-marker-in-body.md](../content-defects/2026-10-19-chapter-marker-in-body.md)(원문 ID · content_hash · 가공 경로 · 범위 10,255/11,161장 · 279권 · 선택지). DB · 출처는 바꾸지 않았다.
- `/hub` · `/dashboard` · 인증 측정(`layout-measure`, `tmp/s4/hda/`): 허브 h1 64px = Tines 홈 64px(1440 시작선 x80 ↔ 참조 x40) · 대시보드 가운데 992 · 인증은 폼 카드(448) + 삽화 판(768) 2열 ↔ Tines 문의 화면은 흰 카드 한 장(774 · 모서리 16 · 왼쪽 안내 + 오른쪽 폼). **고친 것: 인증 머리 시작선**(로고 x≈168 → x80 = 폼 카드, 테마 단추 끝 = 1360). 카드 한 장 구조는 4 화면의 폼 카드(`ui/Card`)를 함께 바꿔야 해 백로그(B20).

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
| `apps/web/src/app/layout.tsx:102-104,157,170-174` | `NEXT_PUBLIC_SKIN=off` · `?skin=off` → localStorage 로 스킨 해제 | **차단점** — DESIGN.md 는 해제 금지인데 코드는 허용 | **S1 완료(2026-10-18)** — 고정 `SKIN="tines"`, 옛 저장값 삭제, 회귀 `skin-always-on.test.ts` |
| `apps/web/playwright.visual.config.ts` | 375/390/768 기본 포함 | 모바일이 기본 실행 | **S1 완료** — 기본 1280/1440, 모바일은 `DESIGN_QA_MOBILE=1` |
| ~~`globals.css:1110` 등 주석 3곳~~ | 감사 서브에이전트가 보고했으나 **재확인 결과 `skin=off` 문구 없음**(2026-10-18 grep) — 오보 정정 | — | 조치 없음 |
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
| B3 | ~~세리프 하드코딩 클래스~~ — **오판(2026-10-18 S2)**: 클래스가 이미 스킨 변수를 거친다 | §2-1 tailwind | 학습자 다수 | P1 |
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
| B15 | `/library/*` 에 Tines Library 골격 — 왼쪽 검색·분류 레일 + 넓은 히어로 + 탭(현재 가운데 990px 카드) | S0 눈 확인 + S0b library 캡처 | `/library/books` `/library/scripts` `/library/vocab` `/library/textbooks` | P1 |
| B16 | 모듈 머리 3중(ModuleBanner + 모듈 하위 머리 + 테마 버튼) 정리 | S0 `/wordvault` | `/wordvault*` 외 모듈 허브 | P1 |
| B17 | 학습 세션(`/wordvault/study` 등)이 FS 가 아니라 AppHeader·띠가 그대로 — 세션 모드 일관성 | S0 `/wordvault/study` vs `/flashcard/play` | 세션 화면 | P1 |
| B18 | 읽기 화면 단계 칩 두 줄·줄바꿈, 문장 사이 공백 과다 | S0 `/text/[id]` | `/text/[id]*` | P1 |
| B19 | **데이터 결함(디자인 아님)**: 도서 본문 첫 줄에 원문 URL(`https://standardebooks.org/...`)이 섞여 노출 — 콘텐츠 파이프라인 담당에 전달 | S0 `/text/859e0b09…` | 해당 도서 텍스트 | 별도 |
| B20 | 인증 4화면을 Tines 문의 화면처럼 카드 한 장(왼쪽 안내 · 오른쪽 폼, 774 · 16px)으로 — 폼 카드 이중 테두리 정리 동반 | S4 측정 `tmp/s4/hda/` | 인증 4 | P2 |
| B21 | 받아쓰기 세션 나가기 중복(틀 닫기 + 화면 안 「나가기」) — 「나가기」의 적재 · 종료 처리 확인 후 정리 | S4 격리 검증 | `/dictate/session` | P1 |
| B22 | PairFlip 카드를 누르면 포커스가 BODY 로 빠짐(키보드 사용자 위치 상실) | S4 pairflip-check | `/pairflip/play` | P1 |
| B23 | 무효 투명도 클래스 남은 32파일 80곳 — 화면 묶음마다 변환 + 직전/직후 비교 | 가드 기준선 | 학습자 다수 | P2 |
| B14 | 메인 워크트리 미커밋 Tines 삽화(path-* · hero-tower · hub-hero-field · band-geo 등 staged) 출처 확인 후 필요분만 반입 | git status(D:/workspace/Vocaflow) | `/hub` `/plan` `/reports` | P2 |
