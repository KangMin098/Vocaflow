# 디자인 거버넌스 — 결정 기록

> 2026-09-18 · 작성 Claude Code. 지시: "규정 위반 없는 평범한 화면을 구조적으로 끝내기"(형태 발명 절차 · 방향 단일화 · QA 평균 회귀 검사).
> 1차에는 사람이 정할 4건을 대기로 남겼고, 2차(같은 날)에 사용자 지시 "평균은 절대 안 된다" 로 전부 확정했다. 2차에서만 화면 코드 1파일(DD-06)과 page 머리 주석 5줄을 고쳤다.
> 에이전트 환경 결정(두 에이전트 D-01~)은 [agents/DECISIONS.md](../../agents/DECISIONS.md) 로 별도다.

## 사용자 지시로 확정 (2026-09-18 2차)

> 사용자: **"목표는 오직 혁신적 디자인 가능하도록, 평균은 절대 안되도록."** 대기하던 4건을 이 기준으로 정했다.

| # | 결정 | 근거 · 한 일 |
|---|---|---|
| **DD-01** | **Admin 액센트 = Deep Ink `--p`** (+ `ShieldCheck` + 「Admin」 배지). 보라 `#8B5CF6` 신규 사용 금지 | 보라는 외부 스킬 공통 "AI-보라" 금지 1순위 = 평균 신호. AGENTS.md · ADMIN_CONSOLE 갱신. 남은 사용(admin 표면 318회 · 학습자 38회, 2026-09-18 평균 신호 라쳇 실측)은 **코드 교체 전**이다 — 라쳇이 증가를 막고 감소만 허용한다. 일괄 치환은 84파일이라 별도 작업(화면 확인 필요) |
| **DD-02** | vocaflow-design 서문 → **"스타일은 차별점이 아니다. 자산의 형태는 차별점이다"** + "평균은 어떤 화면에서도 허용하지 않는다" | 원문과 §G 의 모순 제거. §A 제목도 「4문」으로 |
| **DD-04** | 골든 1호 = **`/library/books`** — 발산 4안 [compare/library-books.md](compare/library-books.md) 작성 완료 | 골격이 격자인, 가장 평균에 가까운 학습자 화면. **고르는 것은 사람**(에이전트 권고: A 「사정권 지평」) |
| **DD-06** | `/text/[id]` risk 단어의 `word-pulse` 4s 무한 반복 = **위반** → 제거 | `components/workspace/ReadingUniverse.tsx` 네 상태를 형태 문법 F1(3/2/1px 실선 · new 2px 점선, `--memory-*` 토큰, 모션 0)로 교체. 하드코딩 `rgba` 4개 · 그라디언트 1개 · `text-white` 제거(→ `--on-p`) |
| **DD-12** | **평균 금지를 테스트로 강제** (vocaflow-design §G5) | 권고는 기본값에 진다. ① `apps/web/src/app/__tests__/form-declaration-ratchet.test.ts` — 새 `page.tsx` 는 `// @form: <G1 축> — <서명>` 없이 실패(기존 무선언 152화면은 기준선 JSON, 줄기만). ② `apps/web/src/components/__tests__/average-signal-ratchet.test.ts` — 평균 신호 8종 × 표면 2 출현 수가 늘면 실패, 줄면 기준선을 내리라고 실패. **변이 검사**: 선언 없는 `grid-cols-3` 화면을 넣자 두 테스트가 각각 실패(확인 후 삭제). 선언을 붙인 화면 5: `/` · `/fit` · `/text/[id]` · `/dashboard` · `/hub` |

## 결정

| # | 결정 | 이유 |
|---|---|---|
| **DD-03** | 주묵 문법을 **토큰 신설 없이 문서만** 공용화 — `DESIGN_SYSTEM §✒ 형태 문법` F1–F5 | 원 결정("`visual-analysis.module.css` 가 소유 · 공용 토큰 신설 금지")과 충돌하지 않는다 — 공용이 된 것은 **선의 뜻**이지 값이 아니다. **토큰 신설 트리거**: CSAT 밖 모듈 하나가 같은 선(두께·대시·끝 모양)을 CSS 로 복사하는 순간. 그때 `--rule-support` 류 토큰 개정을 연다 |
| **DD-05** | 외부 취향 스킬 13 → **활성 2 + 내장 `dataviz`**, 11개는 `_disabled/` 로 **이동**(삭제 0) | 아래 §스킬 이동 표 |
| **DD-07** | `vocaflow-*` 스킬 4파일을 **git 추적 대상으로** 되돌림(`.gitignore` 부정 패턴) | 구조적 결함: `.claude/skills/`·`.agents/` 통째 ignore 때문에 **디자인 정본(`vocaflow-design`)과 비평·루프 스킬이 git 에 한 번도 없었다**(`git ls-files .claude/skills` = 0). AGENTS.md 가 "발명 정본"으로 링크하는데 다른 머신·worktree 에는 파일이 없다. 제3자 설치 스킬과 `_disabled/` 는 계속 ignore |
| **DD-08** | Part 2(하한선)에서 빠진 줄은 **Gate 1 이 지정한 §1 라우팅 3행 · v1 중복 문단 · §2 충돌표**뿐이고, 전부 [archive/vocaflow-design-SKILL-2026-09-17.md](archive/vocaflow-design-SKILL-2026-09-17.md)에 원문 보존 | 금지 자체는 한 줄도 풀지 않았다 — 비활성 스킬 출처의 금지(GSAP pinning · AIDA · 무거운 섀도 · 대시보드 세리프 금지 거부)는 §2 아래 "계속 금지" 한 줄로 유지. §0 의 `CLAUDE.md 디자인 철학` → `AGENTS.md`(철학이 옮겨 간 곳 — 링크 교정) |
| **DD-08b** | §2 의 `--el-*` 토큰 → `--sh-float` 로 교정 | `--el-*` 는 **존재하지 않는 토큰**이었다(`tokens.css` · `globals.css` grep 0). 없는 토큰을 지시하는 하한선은 지킬 수 없다 |
| **DD-09** | `.claude/` · `.agents/` 의 `vocaflow-design/SKILL.md` 두 사본을 **바이트 동일**로 | 기존 Codex 사본은 기계 치환본이라 `` `.Codex/skills/` 13개 grep `` 처럼 없는 경로를 만들었고, "Codex 3단 드레인이 ScriptQuiz 를 만들었다"는 사실과 다른 문장이 됐다. 정본 하나를 복사한다 |
| **DD-10** | DESIGN_SYSTEM 의 옛 「CSS Variables (SSoT 축약형)」 블록을 **현행 토큰 표로 교체** | 그 블록의 값(`--p #3B82F6` · `--bg #FFFFFF` · `--r-lg 12px` · `--sh-md` 그림자)은 Tailwind 기본색이었고 `tokens.css` 와 **전부** 달랐다 — "SSoT" 라는 제목의 폐기값이 본문에 셋(iOS Indigo · Reading Room 초판 · 이 블록) 있었다. 원문은 archive |
| **DD-11** | DESIGN_SYSTEM 목표 ≤400줄 → **360줄대**. 원문 1,509줄은 [archive/DESIGN_SYSTEM_history.md](archive/DESIGN_SYSTEM_history.md) 에 무수정 | `learning-tone.test.ts` 가 파싱하는 `### 게임 전용 하드코딩 색상 (예외)` 제목과 ```` ```css ```` 블록은 **글자 그대로** 유지 |

## §DS-분류 — DESIGN_SYSTEM.md 절 단위 인벤토리 (Gate 0)

| 원 절 (원문 줄) | 분류 | 처분 |
|---|---|---|
| 🎯 첫인상·이탈·모션 예산 §1–3 (9–151) | 현행 SSoT | **남김**(정정 이력 서사는 요약) |
| 🎯 §4 외부 디자인 스킬 판정 (153–169) | 중복(SKILL §2) | archive · 본문은 링크 한 줄 |
| 🌍 World-class Benchmarks (173–205) | 벤치마크 | archive |
| 🎨 Reading Room Art Direction (209–376) | 이력 + 현행 규칙 혼재 | 면/잉크 분리 규칙 · 철학 5조(현행 값으로) **남김**, Reading Room 색 CSS 블록(폐기값) · 타이포 v06.39 표 · 정정 서사 archive |
| 🛒 매대 시각 상품성 (385–509) | 현행 규칙 + 실측 서사 | 규칙 5개 **남김**(§매대), 실측표·서사 archive |
| 🎨 iOS Color SSoT v06.38 (514–737) | **폐기 명시** | archive (본문에 "폐기된 값" 절 0) |
| 🍎 iOS/iPadOS 디자인 언어 (739–909) | 이력 + 현행 프리미티브 | 프리미티브 이름·사용 규약 요지 **남김**(§컴포넌트 규약), 토큰 카탈로그(`--r-ios` 옛 값 · glow · glass) archive |
| 디자인 철학 4 · 학습 과학 7 (912–933) | 중복(AGENTS.md) | archive · PR 자가점검에 링크 |
| Typography 옛 체계 (937–999) | **폐기**(Plus Jakarta·DM Sans — v07 제거) | archive · v07 4종 표로 교체 |
| CSS Variables SSoT 축약형 (1003–1123) | **폐기**(Tailwind 기본색) | archive · 현행 토큰 표로 교체(DD-10) |
| 게임 전용 하드코딩 색상 (1125–1157) | 현행 SSoT(회귀가 파싱) | **남김**(글자 그대로) |
| Memory Decay (1161–1184) | 현행 SSoT | **남김**(잉크 값 추가) |
| CEFR · Spacing · Elevation · Radius · Motion · Breakpoints (1188–1275) | 현행(일부 값 낡음 — radius 6/8/12 → 2/3/4, 그림자 → 링) | **남김, 값 갱신** |
| 컴포넌트 패턴 Button·Form·Toast·Badge 클래스 문자열 (1279–1360) | 폐기(옛 radius·`active:scale`) | archive · 규약으로 요약 |
| `.arc-slot` · Protocol 다이얼로그 · Icons · 계측 훅 · Frame · 버튼 색 (1362–1448) | 현행 | **남김**(요약) |
| 접근성/안티패턴 · onClick 훑기 표 (1452–1498) | 현행 + 실측 표 | 규칙 **남김**, 15건 표 archive |
| CSAT 비교 판면 · 관계 표식 (1500–1509) | 현행 — 모듈 소유 | **§✒ 형태 문법 F2·F3·F5 로 승격**(DD-03) |

## §스킬 이동 (Gate 5)

위치: `.claude/_disabled/skills/<이름>` · `.agents/_disabled/skills/<이름>` — **스킬 탐색 루트(`.claude/skills` · `.agents/skills`) 밖**에 둔다.
지시문의 `_disabled/` 를 루트 **안**(`skills/_disabled/`)에 두면 하위 폴더를 훑는 탐색기가 여전히 찾을 수 있어 비활성이 보장되지 않는다.

| 스킬 | 판정 | 이유 | 마지막 실사용 근거 (CHANGELOG 0건 · docs grep) |
|---|---|---|---|
| `design-taste-frontend` | **유지** | 공개 랜딩의 레이아웃·타입스케일 감각. v2 | `docs/reports/design-skill-audit-2026-09-04.md` |
| `minimalist-ui` | **유지** | Admin 화면 라우팅 대상 | `docs/reports/csat-sources-redesign-20260916.md:153` (관리자 CSAT 소스 재설계) |
| `dataviz` (내장) | **유지** | 차트·통계 | 저장소 밖(내장 스킬) |
| `design-taste-frontend-v1` | 이동 | v2 의 하위호환 보관본 — 중복 | 목록 언급만 |
| `gpt-taste` | 이동 | GSAP pinning·AIDA — 두 행 모두 금지로 판정돼 있던 스킬 | 목록 · 반려 기록만 |
| `stitch-design-taste` | 이동 | perpetual micro-motion · 대시보드 세리프 금지 — 반려 기록만 있음 | `docs/reports/learner-design-review-20260907.md:348`(반려) |
| `high-end-visual-design` | 이동 | 섀도·glass 로 "비싸 보이게" — 판면과 정반대 | 목록 언급만 |
| `industrial-brutalist-ui` | 이동 | 라우팅의 "부르지 말 것"에만 있었다 | 목록 언급만 |
| `redesign-existing-projects` | 이동 | 쓰이던 것은 "감사 단계"뿐 → 06-workflow 비평 (a)–(e) 가 대체 | `docs/csat-learner/learning-home.md:32`(감사 항목 참고) |
| `brandkit` | 이동 | 표지 정본이 코드(`textbook/cover.ts`)·DB 각인이다 — 이미지 생성 표지를 쓰지 않는다 | 목록 언급만 |
| `imagegen-frontend-web` | 이동 | 섹션별 이미지 생성 — 랜딩 증명은 DOM/SVG(§7) | 목록 언급만 |
| `imagegen-frontend-mobile` | 이동 | 모바일은 Phase 2(기획) | 목록 언급만 |
| `image-to-code` | 이동 | "먼저 이미지를 생성하라"는 절차가 §G(자산 형태 먼저)와 반대 방향 | 목록 언급만 |
| `full-output-enforcement` | 이동 | 취향 스킬은 아니지만 외부 설치본 — AGENTS.md "코드 완성형만" 규칙과 중복 | 목록 언급만 |

**되돌리기**: `mv .claude/_disabled/skills/<이름> .claude/skills/` (Codex 쪽은 `.agents/…`). 되살리면 [archive 의 §2 원문](archive/vocaflow-design-SKILL-2026-09-17.md)에서 그 스킬의 충돌 행을 SKILL §2 로 복귀시킨다.
⚠️ 스킬 설치기(`skills-lock.json` 13항목, 손대지 않음)로 복원·갱신을 돌리면 11개가 `skills/` 로 **다시 설치될 수 있다** — 설치기를 돌린 뒤 `ls .claude/skills` 로 확인한다.

## 보고 외 사실

- `node agents/scripts/check.mjs` 의 **D2 FAIL 은 이 작업 전부터** 있었다 — `.codex/config.toml`(untracked, 2026-09-18 10:12 에 다시 쓰임)에 GENERATED 마커가 없다. 다른 세션·Codex 의 파일이라 손대지 않았다. 나머지 8/8 PASS.
- 커밋하지 않았다 — 대상 파일 다수가 **다른 세션의 미커밋 작업 위**에 있다(`AGENTS.md`·`DESIGN.md`·`06-workflow.md` untracked, `DESIGN_SYSTEM.md`·`.gitignore`·`CHANGELOG.md` 에 남의 hunk). `--only` 로도 남의 줄이 딸려 간다.

## UX 감사 (2026-09-18) — DD-13~18

> 산출물 전체: 브랜치 `feat/ux-audit` 의 `docs/design/audit/`(PROGRESS · verdict · priority · briefs · cards). 감사 중 메인 워크트리가 Codex 잠금이라 worktree 에서 썼다.

### 결정

| # | 결정 | 이유 |
|---|---|---|
| **DD-13** | 감사는 **worktree `feat/ux-audit`** 에서 쓰고, 메인 워크트리 코드는 읽기만 했다 | 메인 워크트리에 Codex 잠금(실행 중 확인). 규약상 남의 잠금이면 읽기 전용 — 장기 병행은 worktree(AGENTS 공유 워크스페이스) |
| **DD-14** | 캡처는 저장소의 시각 QA 하네스(`test:design`)가 아니라 **감사 전용 스크립트**(`audit/tools/capture.mjs`)로 했다 | 하네스(`playwright.visual.config.ts`)는 미커밋 파일이라 worktree 에 없고, 등록 라우트만 찍는다. 감사 스크립트는 익명 응답(로그인 필요 여부) · 1280/390 첫 화면 · 렌더 DOM 평균 신호를 한 번에 잰다 |
| **DD-15** | 검증 세션은 저장소 픽스처(`tests/e2e/fixtures/test-user.ts`) 계정으로 **1회 로그인**해 새로 만들었다 | 기존 `.auth-csat-learner.json` 은 만료(→ `/login`). 세션 파일은 worktree 의 gitignore 폴더에만 |
| **DD-16** | `/join/[code]` 는 **무효 코드**로만 찍었다 | 실제 초대 코드를 로그인 상태로 열면 학급 가입이 실행될 수 있다(쓰기 부작용) |
| **DD-17** | 판정 등급 규칙: 평균 = N4 불통과 ∧ 익명성(2) 불통과 · 서명 있음 = 둘 다 통과 · 경계 = 그 밖. **글꼴·색만으로는 익명성(2) 불통과** | "이 제품인지" 는 형태로만 말할 수 있다 — 스타일은 하루면 복제된다(§G) |
| **DD-18** | 우선순위 공식 = 수요(여정 ①② 3 · ③④ 2 · 그 밖 1) × 평균(2/1.5/1/0) × 데이터 용이(3/2/1) | 지시문. 여정 밖 최대 6점 → 상위 10 은 전부 여정 위 |

### 발견 — 앞선 결정의 정정이 필요한 것

| # | 발견 | 조치 |
|---|---|---|
| **DD-12 보강** | `@form` 선언 5개 중 **4개가 렌더와 다르다**(`/fit` · `/hub` · `/dashboard` · `/text/[id]`) — 선언은 2026-09-18 앞선 세션(Claude)이 붙였다. 라쳇은 선언의 **존재**만 검사한다 | 선언을 사실대로 고치거나 화면을 선언대로 만든다 — **사용자 결정**. 라쳇에 "선언과 렌더 대조" 를 더하려면 캡처 기반 검사가 필요(비용 큼) |
| **DD-06 보강** | `/text/[id]` 의 F1 밑줄(두께 3/2/1px)로 바꿨지만, 모든 단어가 `status:'new'` 고정이라 **한 종류로만** 나온다 | 데이터(`vocabularies.text_id`·stability)는 있다 — 조인 코드 작업(브리프 text_id) |
| **도구** | `screen-graph.mjs` 의 씨앗 S2 판정은 `components/ui/press` import 만으로 잡혀 과대 계상 · 정적 링크 분석은 템플릿 문자열 목적지를 못 본다 | 결과 문서에 한계를 명시했다. 고치려면 S2 를 `DecayUnderline` 심볼 사용으로 좁힌다 |

### 사용자 결정 대기

1. **첫 발산 대상**: 우선순위 1위 `/fit`(18점) vs 이미 4안이 있는 `/library/books`(DD-04, 6점) — 병행 또는 전환.
2. **`/teacher`(렌즈 6)**: 학급 구성원·과제가 DB 에 0 → 공식 4점. 예시 데이터로 설계할지.
3. **통합**: `/wordvault/review`≡`/study` · 모듈 허브 쌍 · `/dashboard`+`/reports` · 내 책 3중 — 합칠 화면(priority.md 「통합 기회」).
4. **`@form` 선언 불일치 4건**의 처리(위 DD-12 보강).

## /fit 발산 결정 (2026-09-19) — DD-19

| # | 결정 | 근거 · 한 일 |
|---|---|---|
| **DD-19** | `/fit` = **A 「칠해지는 입력칸」 골격 + B 「학급에 나눠 줄 한 장」 출력 면**(별도 화면 아님). C 「일주일 뒤의 이 글」 **보류** — 로그인 후 개인 기록(FSRS) 기반으로 재검토(공개 화면의 일반 모형 수치는 표시광고 위험). D 「지문 지도」 **A 확정 후 추가 여부 재검토**. `/library/books` 는 병행하지 않고 `/fit` 골든 고정 뒤 착수 | 사용자 결정. 구현: `/api/fit` 응답에 표면형→레벨 표(`surfaceLevels` — 원문은 여전히 서버로 안 감) · `lib/textfit/paint.ts`(랜딩과 공용) · `PaintedPassage` · `ClassSheet`(권점 = CSS `text-emphasis`) · `PrintSheet.prelude`(판면이 인쇄 첫 장) · 사다리는 「학년별 범위 자세히」 접힘으로(철학 2) · 한국어 판정 문장 Lora 이탤릭 → Hahmlet. 2회 수정 후 골든 4장(`golden/fit.md`). `@form` 선언을 렌더와 일치하게 정정 |
| **DD-19b** | 새 관측 2종 `fit_level_moved` · `fit_sheet_opened` — **마이그레이션 적용**(2026-09-19 사용자 승인, DB 버전 `20260918232454` · 행 9,143 보존 · `db-allowlist` 통합 테스트 35/35) | `funnel_events_event_check` 가 허용 목록이라 DB 가 받지 않는다(`db-allowlist.integration.test.ts` 가 적용 전까지 실패 — 맞는 실패). SQL: `supabase/migrations/20260919100000_funnel_allow_fit_paint.sql`(적용 시점 DB 제약 38개 + 2) |

## 공유 문서 커밋 (2026-09-19) — DD-20

| # | 결정 | 근거 · 한 일 |
|---|---|---|
| **DD-20** | AGENTS.md · DESIGN.md · CLAUDE.md 는 **(b) 경로** — 임시 워크트리에서 HEAD 기준으로 이 세션의 변경만 다시 적용해 커밋. 작업 트리의 혼합 파일은 그대로 둔다 | 다른 세션 변경(두 에이전트 전환: CLAUDE.md 495→44줄 · AGENTS.md 신설 · Codex 입구 DESIGN.md)은 이해되지만 **저장소 안에서 완결되지 않는다** — 가리키는 `agents/` · `docs/agents/CONTEXT_DETAIL.md` · `.claude/settings.json` · `.codex/` 가 전부 미추적이라 파일째 커밋하면 CLAUDE.md 의 규칙 485줄이 없는 파일로 옮겨지고 `doc-path-drift` 가 CI 에서 깨진다. 그래서 AGENTS.md 에 넣었던 이 세션의 규칙(DESIGN.md 필독 · 활성 스킬 2 · 평균 금지 · Admin 액센트)은 HEAD 의 CLAUDE.md 같은 자리에 적용했고, DESIGN.md 는 이 세션이 쓴 절만으로 만들었다(미추적 파일을 가리키지 않게). **함께 고친 구조 결함**: 라쳇 기준선을 처음에 다른 세션의 미커밋 변경이 섞인 작업 트리에서 재서 **커밋된 트리에서 실패**했다 — 기준선을 커밋된 트리로 재측정(화면 기준선 csat/progress·session ↔ dissect·formulas · learner.grid-3eq 60 · admin.ai-purple 326), DESIGN_SYSTEM 의 미추적 경로 참조 제거. 그 결과 **미커밋 CSAT 작업이 있는 작업 트리에서는 두 라쳇이 "기준선을 갱신하라" 로 떨어진다** — 그 세션이 커밋할 때 기준선을 함께 내린다(라쳇의 의도된 동작) |

## Lazyweb 스킬 사용 범위 (2026-09-19) — DD-21

> Lazyweb 스킬 팩 v0.15.13 을 사용자 전역(`~/.claude/skills/` 9개)에 설치한 뒤 정한 범위. 설치 위치가 저장소 밖이라 이 저장소에서는 이 항목이 유일한 제약이다.

| # | 결정 | 근거 · 한 일 |
|---|---|---|
| **DD-21** | ① **허용**: `lazyweb-search-screens` · `lazyweb-search-flows` 만. 용도는 Gate 4 층 1(평균의 정의)과 Gate 6 사후 검증(닮은 화면 유무)뿐. ② **금지**: `lazyweb-apply-design-best-practices` 와 리포트·적용 계열 스킬 전부(`lazyweb-growth-report` · `-growth-score` · `-growth-backlog` · `-search-experiments` · 라우터 `lazyweb` 로의 우회 포함). ③ **세션 분리**: Lazyweb MCP 는 감사·검증 세션에서만 쓴다. Gate 5 브리프 작성 · 발산 · 골든 고정 · 구현 세션에서는 Lazyweb 도구를 호출하지 않는다. ④ **결과 처리**: 이미지는 저장소에 넣지 않는다. 레퍼런스 인덱스(references.md — 아직 미추적, 다른 세션 작업) 에 링크 · 첫 시선 골격 분류 · 평균 신호 수만 적는다. Lazyweb 결과를 G1 축 후보의 근거로 인용하지 않는다. ⑤ **예외 — 카테고리 밖 이식**: R(t) · 커버리지와 같은 데이터 구조를 가진 비교육 도메인(finance · health · utilities) 검색 결과는 형태 후보로 쓸 수 있되, 브리프에 「이식 출처」를 명시한다 | 사용자 결정. `lazyweb-apply-design-best-practices` 는 외부 취향 스킬의 SKILL.md 를 받아 그대로 적용한다 — AGENTS.md 의 활성 외부 취향 스킬 2개 제한과 vocaflow-design 판정 우선 원칙을 우회한다. 검색 결과는 「이미 있는 평균」을 정의하는 데 쓰여야지 형태의 출처가 되면 평균으로 수렴한다(§G 발명 목표와 충돌) — 그래서 발명 세션과 분리한다. 같은 업종 밖, 같은 데이터 구조의 화면은 평균이 아니라 이식이라 ⑤로 열어 둔다 |

## 이미지 체계 — Tines 계열 유사도 (2026-09-19) — DD-22~23

> 지시: [image-system-brief.md](image-system-brief.md)(사용자 제공, 4회차 중 1회차 = Gate −1→2). 산출물: [refs/index.md](refs/index.md) · [refs/tines/dna.md](refs/tines/dna.md) · [refs/uxcel/dna.md](refs/uxcel/dna.md) · [asset-inventory.md](asset-inventory.md) · [similarity-proposal.md](similarity-proposal.md).
> 범위: 웹만 — `apps/mobile` 제외(사용자 지시 「모바일은 제외」, 2026-09-19).

| # | 결정 | 근거 · 한 일 |
|---|---|---|
| **DD-22** | **착수 · 상태 고정(Gate −1)**. 참조 캡처(Tines 289 · Uxcel 379 PNG)는 저장소 밖 `C:\Users\Administrator\design-refs\` 에만 두고, 이미지 차단은 루트 `.gitignore` 가 아니라 **`docs/design/refs/.gitignore`**(새 파일)로 | 시작 시 작업 트리 변경 210건(다른 세션 CSAT 작업 · `DESIGN.md`·`CHANGELOG.md`·`.gitignore` 미커밋 hunk · `AGENTS.md`·`06-workflow.md` 미추적) — 루트 `.gitignore` 에 줄을 더하면 `--only` 커밋에 남의 hunk 가 딸려 간다(DD-20 과 같은 사정). 읽기 목록 8개 줄 수: DESIGN 82 · DECISIONS 133 · SKILL 370 · DESIGN_SYSTEM 358 · 03-system 291 · 04-application 101 · design-tokens CLAUDE 21 · 06-workflow 110. 06-workflow 비평 (a)~(e) 재사용. 캡처 PNG 에 서체·색값이 없어 **Tines 8페이지 × 2뷰포트를 Playwright 로 다시 열어 computed style 을 읽었다**(읽기 전용, 결과는 저장소 밖). Uxcel `_private` 51장 · `auth.json` 은 열지 않았다 |
| **DD-22b** | brief 의 전제 4개를 **실측으로 정정**해 기록(원문은 보존) | ① Tines 제목은 굵은 산세리프가 아니라 세리프(Reckless 54)·산세리프(Roobert 39) 혼용, 32px 이상 제목 32개 중 굵기 400 이 24 ② 액센트는 하나가 아니라 보라 계열 면적 19.7% + 파스텔 틴트 5계열 ③ `--paper` 토큰은 없고 `--bg #FBFAF6` 이 Tines `#FCF9F5` 와 채널당 1 차이(우리 값이 먼저) ④ 무대는 1px 선 격자 24px 가 주, 점 격자(1px · 12px)는 액자 안쪽만. 그래서 L3 hex 검사에 **ΔE2000 < 2** 를 더하자고 제안(기존 토큰 예외) |
| **DD-22c** | 🔴 **웹 아이콘 참조 깨짐 3건 발견** — 고치지 않고 기록(A5: Gate 6 전 코드 수정 금지) | `layout.tsx` `icons.apple` → `/apple-touch-icon.png` · `public/manifest.json` → `/icons/icon-192.png` · `/icons/icon-512.png` 전부 파일 없음. `manifest.json` 색은 DD-10 이 폐기한 `#3B82F6` · 순백 `#FFFFFF`. 모바일(`app.json` 아이콘 3)도 없지만 범위 밖. 지금 따로 고칠지는 사용자 결정(proposal §5-4) |
| **DD-23** | **유사도 상한 대기 — ① / ② / ③**. 에이전트 권고 **②**(격자 무대 · 섹션 리듬 · 여백 160px · 제목 비율 · 액자 — 서체·잉크·면적 색·모서리 유지) | 어느 옵션이든 **03-system §3-5 「자산 파일 0개」**(P1)와 **SKILL §F 「자산과 무관한 새 미감 = 장식」**(P2)을 먼저 개정해야 한다 — 조건: 삽화는 서명 아님 · 개념은 N1 자산 개념 · 학습 중 화면 0. 12px+ 모서리 · 대문자 눈썹 · 마퀴는 DD-12 라쳇 · `Eyebrow` 규칙 · 모션 금지로 **어느 옵션에도 넣을 수 없다**. 격자는 CSS 그라디언트로 그리면 평균 신호 라쳇이 늘어나므로 SVG 패턴으로만 |

### 사용자 결정 대기 (DD-23)

1. 유사도 상한 ① / ② / ③.
2. P1·P2 공통 개정 승인.
3. ✋ `ModuleHero` 삽화 재도입 · `PairFlipMascot` 캐릭터 유지 · 파비콘 재생성 · 표지 코드 별도 정본 유지.
4. 웹 아이콘 참조 깨짐 3건 — 지금 고칠지, Gate 6 에 묶을지.

### 사용자 결정 (2026-09-19) — DD-24~27

| # | 결정 | 근거 · 한 일 |
|---|---|---|
| **DD-24** | **유사도 상한 ②** — 격자 무대(SVG 패턴) · 섹션 리듬 · 여백 160px · 제목 비율 · 증명 액자. Tines 보라·파스텔 순환은 **미채용**: 면적 색은 주묵 하나(단일 액센트 유지). 섹션 바탕 교대는 **우리 토큰 1톤 · 잉크 4~6% 이내**만. L3 색 검사 = 정확 일치 + **ΔE2000 < 2**(기존 토큰은 예외 목록). 12px+ 모서리 · 대문자 눈썹 라벨 · 마퀴는 계속 금지 | 사용자 결정(DD-23 대기 1). 범위 = 웹(390px 포함), `apps/mobile`(Expo)만 제외 |
| **DD-25** | 공통 개정 P1·P2 **승인**. 삽화 조건 4개: ① 서명이 아니다 ② 그리는 개념은 N1 자산 개념 ③ 학습 중 화면 0 ④ **삽화도 03-system 형태 문법(주묵 의미 체계)을 지킨다** — 주묵은 앱이 남긴 표식이지 평가가 아니다(오답·위험에 주묵 금지), 선 두께 1/2/3px 는 망각도의 뜻으로만 | 사용자 결정(DD-23 대기 2). 개정은 2회차에서 03-system §3-5 · §3-9 로 |
| **DD-26** | 자산 처분: `ModuleHero` **삽화 미부착**(증명 우선 — 삽화 자리는 공개 화면 섹션 머리 · 빈 상태만) · 파비콘 **새로 제작** · 표지 생성 코드(`cover.ts` · `cover-art.ts`) **별도 정본 유지** · `PairFlipMascot` 부엉이는 **범위 밖 · 현상 유지 — 게임 모듈 예외**(PairFlip 은 아케이드와 같은 모듈 팔레트 예외 구역이라 A4 캐릭터 금지를 적용하지 않는다. 삽화 체계 manifest 에 넣지 않는다) | 사용자 결정(DD-23 대기 3) |
| **DD-27** | 🔧 **핫픽스** — 웹 아이콘 404 3건 + 색: `public/apple-touch-icon.png`(180, 모서리 0 — iOS 가 둥글린다) · `public/icons/icon-192.png` · `icon-512.png` · `app/favicon.ico`(16·32·48·256 PNG-in-ICO) 를 **사이드바 각인과 같은 마크**(`--ju` 채움 · 2/36 모서리 · Lora 500 「V」 · `--on-ju`)로 새로 구움. 16~48px 는 글자 비율 0.66 마스터에서 축소(0.50 은 16px 에서 획이 끊긴다). `manifest.json` `theme_color #3B82F6`·`background_color #FFFFFF` → `--bg #FBFAF6`, 같은 결함인 `layout.tsx` `viewport.themeColor`(`#FFFFFF`/`#0B1120`) → `--bg`/다크 `--bg2 #181410` | 사용자 결정(DD-23 대기 4 — 지금 처리). 검증: 로컬 서버 5경로 200 · `page-titles`·`seo-routes`·`learning-tone` 48/48 |
