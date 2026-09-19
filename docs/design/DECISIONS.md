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

## 화면 재설계 실행 (2026-09-19~) — DD-22~

> 지시: 감사(`audit/verdict.md` 평균·경계)를 `audit/priority.md` 순서로 한 화면씩 "서명 있음" 으로 옮긴다. **질문하지 않고** 선택 규칙 B4(① 새 데이터 작업 최소 ② 여정 ①② 앞 화면과 같은 몸짓 ③ 자기검토 통과, 갈리면 ②)로 고르고 여기 적는다.
> 작업 환경: worktree `D:/workspace/Vocaflow-screen-redesign`(브랜치 `feat/screen-redesign`, `pc2-20260720-1` HEAD + `feat/ux-audit` + `feat/design-workflow-20260918` 병합) — 메인 워크트리에는 다른 세션의 미커밋 변경 214건이 있어 캡처·라쳇이 섞인다(DD-20 과 같은 이유). 진행 기록: [audit/PROGRESS.md](audit/PROGRESS.md) 「실행」 절.

| # | 결정 | 근거 · 한 일 |
|---|---|---|
| **DD-22** | `/hub` = **A 「들어 올리는 곡선」**(망각). 첫 시선이 7일 기억 곡선(Σ R(t) 기대값) — 점선 그대로 두면 · 실선 오늘 N개를 다시 보면 · 사이의 면 = 남는 몫. 서명 = 「오늘 다시 볼 단어」 슬라이더 → 선·면 페이드 + 낱말 권점 200ms. 탈락: B 「내 기억으로 칠한 오늘의 글」(채색 지문) · C 「차오르는 서가」(환경 변형) · D 「오늘의 한 장」(시험지 사물) | B4: (1) 은 C·D(새 데이터 0), (2) 는 A·B(`/fit` 골든과 같은 「슬라이더 → 낱말 표면 200ms」) 로 갈림 → (2) 우선. A·B 중 B 는 **조인 필요** + 미진단 학습자(여정 ② 의 그 사람)에게 오늘의 글이 없어 골격이 사라진다 → A. C 는 실제 계정 추적 단어가 전부 risk(DB 98/98 · 136/136)라 서가가 빈다 · D 는 N4 약함(권점 외에는 자산 없이 그려진다). **브리프 후보 1 을 그대로 쓰지 않은 이유**: "안 하면 목요일에 흐려진다" 는 7일 안에 새로 흐려질 단어가 실제 계정 모두 **0** 이라 수평선이 된다 → "하면 올라간다" 로 뒤집었다. 구현: `lib/learner/memory-lift.ts`(순수 · FSRS `applyReview` 로 Good 1회 적용 후 R 재계산) · `hub-lift-query.ts`(세션 큐와 **같은 함수** `fetchStudyVocabularies` — 보여 준 앞 N개 = `/flashcard/play?limit=N`) · `TodayStage` 재작성 · `TodayFocus`·`NextWordsStrip` 은 허브에서 은퇴(곡선 아래 낱말 줄로 합침) · 관측 `hub_curve_interacted {count, words}`. 2회 수정(① 직사각형 곡선 → Σ R ② 진단 계정에서 CTA 가 폴드 밖 · 「시작」 둘 → CTA 를 슬라이더 아래로, 2차 링크 문구). 골든 [golden/hub.md](golden/hub.md) |
| **DD-23** | `/diagnostic` = **A 「답할수록 칠해지는 지문」**(채색 지문). 시작: 데모 지문 학습 낱말마다 dotted(아직 모름) · 문항: 서버와 같은 규칙의 중간 추정으로 지문을 칠함 · 결과: RPC 레벨로 칠한 지문 + h1 「지금 N권을 읽을 수 있어요」(셸 분포). 탈락: B 「불이 켜지는 서가」 · C 「시험지 한 장」 · D 「어휘 지층」 | B4: (1) 은 C·D(새 작업 0), (2) 는 **A 하나**(랜딩·`/fit` 과 같은 칠 함수 `runs` — 레벨이 움직이면 낱말 면 색) → (2) 우선 · A. B 는 312권 책등이 390 에서 1px, C 는 N4 약함, D 는 (a) 가 분석 도구로 읽힘. **중간 추정은 지어낸 값이 아니다** — `analyze_diagnostic_result` 를 pg_get_functiondef 로 읽어 같은 규칙(정답률 ≥ 0.70 인 최고 레벨, 없으면 1)을 `lib/diagnostic/interim-level.ts` 로 옮기고 테스트로 잠갔다. 새 쿼리 0(데모 지문 = 랜딩 계산 · 레벨별 사정권 = 셸 10분 캐시). 관측 신설 없음(결과는 DB 행으로 파생 — D4). 수정 2회. 골든 [golden/diagnostic.md](golden/diagnostic.md) |
| **DD-24** | `/flashcard/play` = **A 「이 단어의 기억선」**(망각). 카드 아래 이 단어의 R(t) 시간축 — 뒤집으면 네 평가의 다음 만남 눈금, 손을 얹은 평가의 다음 곡선. 평가 버튼 날짜 = FSRS 미리보기. 완료 = 이 세션 낱말들의 7일 곡선(허브 문법). 탈락: B 「원문 한 줄의 빈칸」 · C 「오늘의 한 장」 · D 「흐려짐 지층」 | B4 세 기준 모두 A: (1) 새 데이터 0(세션이 이미 `srsV2` 를 싣는다) (2) 허브 골든과 같은 몸짓(선택이 곡선을 바꾼다) (3) 자기검토 통과 — B 는 `text_id` 원문 조인 + 문장 없는 12% 폴백, C·D 는 N4 약함. **고친 불일치**: 버튼이 SM-2 간격을 보였는데 실제 스케줄은 FSRS — `lib/flashcard/memory-line.ts` 가 세션과 같은 `applyReview` 로 미리본다. **FSRS 흔들림**(`enable_fuzz: true`)은 정본 밖이라 건드리지 않고 3일 이상 간격에 「약」 · 기억선은 브라우저에서만 계산(하이드레이션 18↔22 실측). 모션 신설 0(곡선은 정지 — §5.2 개정 불필요). 0바이트였던 `ForgettingCurve.tsx` 를 채웠다. 수정 1회. 골든 [golden/flashcard-play.md](golden/flashcard-play.md) |
| **DD-25** | `/fit/s/[payload]` = **A 「가장 어려운 낱말 줄」**(채색 지문). 공유 링크엔 원문이 없으므로 표면형 + V-Level 16개를 `/fit` 과 같은 `PaintedPassage` 로 칠하고, 1차 = 「내 지문으로 해 보기」, 2차 = 같은 `ClassSheet`. 탈락: B 「받은 한 장」 · C 「학년 눈금 하나」 · D 「내 반으로 다시」(폼 우선 — N4 불통과) | 감사 **판정 보류**였다(유효 payload 없음) — `/fit` 공유 버튼으로 실제 링크를 만들어 확인: 원문이 없어 `PublicFitClient` 가 빈 입력칸을 먼저 세웠다(코드 추정이 맞았다). `PublicFitClient` 는 `/fit` 골든과 공유라 A5 로 두고 `/fit/s` 전용 `SharedFitView` 를 만들었다(`PaintedPassage`·`ClassSheet` 는 수정 없이 재사용). B4: (1) 넷 다 0 (2) A 만 `/fit` 과 같은 부품·같은 몸짓 → A. 관측·마이그레이션 신설 0(`/fit` 이름 그대로). C6 에서 가장 가까운 Cathoven(CEFR 다색 칠)은 같은 골격이 아니라고 판정 — 근거를 골든에 적었다. 수정 0회. 골든 [golden/fit-s.md](golden/fit-s.md) |
| **DD-26** | `/signup` = **A 「칠해진 지문 옆의 가입」**(채색 지문). 판면 위 두 단 — 랜딩 데모 지문을 `/fit` 과 같은 `PaintedPassage` 로 칠해 폼 옆에(모바일은 칠해진 두 줄 → 폼). 탈락: B 「첫 서가 짓기」 · C 「원서 한 장 서명」 · D 「방금 본 결과 이어받기」 | B4: (2) 가 A·D, (3) 에서 D 는 공유 경로로 온 사람에게만 골격이 선다 → A. 페이지를 서버(`page.tsx` — `buildHeroDemo`, 쿼리 0)와 클라이언트(`SignupForm.tsx` — 로직 그대로)로 나눴다. 인증 레이아웃의 `max-w-md` 는 `has-[[data-auth-wide]]` 로 가입 화면만 넓힌다(다른 3화면 코드 무변경 · 모바일 위 여백만 줄었다). **함께 고친 결함**: 가입 ↔ 로그인 링크가 `next` 를 떨어뜨렸다(초대 학생의 학급 연결 끊김) — 양쪽 보존. 수정 2회. C6 미실행(Lazyweb 연결 끊김). 골든 [golden/signup.md](golden/signup.md) |
| **DD-27** | `/text/[id]` = **A 「내 기억으로 칠한 원문」**(채색 지문 × 망각). 레이아웃이 챕터 낱말만 단어장과 조인해 R(t) 상태를 원문 낱말에 싣고(`word-states.ts`), 원문 위에 이 챕터의 낱말 줄(`ChapterWordLine` — 누르면 원문의 그 자리로). 탈락: B 「난외의 7일 곡선」 · C 「한 장의 판면」 · D 「읽고 나면 얇아지는 밑줄」 | A6 = **조인 필요**(키가 컬럼으로 있음 — 드레인 불필요)라 진행. B4: (1) A 가 조회 1 로 가장 적음 → A. D 는 "읽음 = 복습" 이라는 FSRS 가 정하지 않은 전이를 지어낸다. **걷은 I5 위반 3**: 기억 통계 상수 · 고정 인용문 · 모드 진행 목업(지금 모드만 active). 한국어 이탤릭 · 알약 줄 glass · 칩 hover AI-보라 제거. 390 가로 넘침 349→0 · axe 3→0(닫힌 패널 `inert` · 활성 알약·음성 버튼 토큰 대비). 수정 2회. C6 미실행. 골든 [golden/text-id.md](golden/text-id.md) |
| **DD-28** | `/wordvault/review` · `/study` = **A 「이 단어의 기억선」**(망각 — `/flashcard/play` 골든 부품 수정 없이 재사용). review 는 **다시 볼 낱말(`attention`)만**, study 는 전체 — 두 라우트를 구분한다. 탈락: B 「곡선 위의 큐」(모션 개정 필요) · C 「차오르는 바탕」 · D 「오늘의 복습 한 장」(N4 약함) | B4: (1) A·C·D 0 (2) A 만 같은 부품·같은 몸짓 → A. **고친 데이터 결함**: `StudyMode` 가 낱말의 DB FSRS 카드(`srs`)를 쓰지 않고 세션 캐시가 비면 새 카드로 평가 — 이 화면의 복습은 매번 안정도를 리셋했다(`cardFor`). 상수 간격(I5) → FSRS 미리보기. 평균 신호 정적 17→4. 수정 2회. C6 미실행. 골든 [golden/wordvault-review.md](golden/wordvault-review.md) |
| **DD-29** | 회고 `/dashboard` + `/reports` = **A 「기억의 지층」**(환경 변형 — 페이지가 선언만 하고 렌더하지 않던 골격을 세운다). 층 두께 = 낱말 수 · 층 안에 실제 낱말 · 이번 주에 되찾은 낱말에 권점(`/hub` 표식) · 층을 누르면 펼침. `/reports` 는 **통합하지 않고 같은 문법으로**(주마다 한 겹) — 라우트·입구(ManageSection)를 유지해 링크 그래프를 흔들지 않는다. 관측 `retrospect_layer_opened {rung, words}`(브리프의 `weeksBack` 은 B 안의 속성이라 A 에 맞게 바꿈). 탈락: B 「지난주의 나 × 오늘의 나」(과거 stability 이력이 없어 FSRS 재생 드레인 필요 — A6 보류 조건) · C 「28일 필사본」 · D 「주간 장부」(N4 불통과) | B4: (1) A·D 0, C 1, B 드레인 (2) A 만 앞 골든과 같은 표식(권점 · R(t) 로 칠한 낱말) → A. **고친 결함**: `/reports` 조회 실패 → 빈 상태로 보임 · 두 회고의 분(分) 기준 불일치(둘 다 분을 쓰지 않음) · 첫 화면 0 카운터 3개. 정적 신호 `/dashboard` 5→3 · `/reports` 3→1. 수정 1회. C6 미실행. 골든 [golden/retrospect.md](golden/retrospect.md) |
| **DD-30** | `/text/new` = **A 「붙여 넣으면 칠해지는 입력칸」**(채색 지문 — `/fit` 골든 부품 `PaintedPassage`·`/api/fit` 수정 없이 재사용). 붙여 넣기·예시 선택이면 칠이 도착하는 순간 입력칸 자리가 칠해진 원문으로, 타이핑 중에는 바꾸지 않는다(`/fit` 과 같은 규칙). 준비 중인 파일·URL 입력은 **걷었다**(`InputModeTabs` 삭제 — 이 화면 전용) · 저장 후 **새 글로** 이동 · 관측 `text_created {coveragePct, chapters}`(브리프의 `forClass` 는 이 화면이 학급을 받지 않아 지어내지 않고 뺌). 탈락: B 「우리 반에 나눠 줄 한 장 먼저」(학급 데이터 0) · C 「내 단어장으로 칠한 글」(조회 1) · D 「원고지」(N4 불통과) | B4: (1) A·D 0 (2) A 만 `/fit`·`/signup`·`/diagnostic` 과 같은 몸짓 → A. 공용 `ExtractionPanel` 이 같은 글에 다른 커버리지(내 단어장 기준 39.4% vs 학년 기준 100%)를 한 화면에 세워 이 화면에서 걷었다(저장 후 `/text/[id]` 에 그대로). 정적 신호 21→4. 수정 1회. C6 미실행. 골든 [golden/text-new.md](golden/text-new.md) |
| **DD-31** | 인증 3화면 `/login` · `/reset-password` · `/verify-email` = **A 「칠해진 지문 옆의 폼」**(`/signup` 골든 6호의 두 단을 그대로 — `AuthSpread` → `SignupProof`). 세 `page.tsx` 를 서버 페이지 + 클라이언트 폼으로 나눴다(폼 로직 불변, 탭 제목이 처음으로 생김). 주소를 모르는 메일 확인 화면은 잠긴 재발송 버튼 대신 이유 + 1차 「다시 가입하기」(e2e 계약 갱신). 탈락: B 「내 서가가 기다려요」(로그인 전엔 내 서가를 모름) · C 「한 줄 인증」 · D 「원고 봉투」(N4 불통과) | B1: 상위 10 다음 여정 ①② 의 남은 화면(`/verify-email`)이 브리프상 인증 4화면 한 단위. B4: (1) A·C·D 0 (2) A 만 `/signup` 과 같은 틀 → A. 정적 신호 6·11·6 → 0·0·0. 수정 0회. C6 미실행. 골든 [golden/auth.md](golden/auth.md) |
| **DD-32** | `/practice` (+ `/practice/dcp` 빈 날) = **A 「오늘의 연습지」**(시험지 사물 — 번호 붙은 괘선 문항 여섯 줄, 문항마다 그 면에서 아직 통과하지 못한 **내 낱말**). `FacetSummary` 에 `pending`(면당 8) 을 더했다 — 이미 읽는 행에서 접는 응답 확장(추가 조회 0). 면 요약은 서버에서 읽는다(브라우저 조회가 첫 화면을 흔들었다). 탈락: B 「여섯 면 레이더」(N4 부분) · C 「낱말이 먼저」(조회 1) · D 「도구 서랍」(N4 불통과) | B1: 학습자 화면 중 점수 최고(`/practice/dcp` 8) + 부모. B4 (2) A 만 허브·회고와 같은 「낱말 줄」 문법. 렌더 1280 큰 모서리 10→0 · 카드형 5→0. `DcpPlayer` 는 교재 연습과 공용이라 그대로(공용 교체 후보). 수정 0회. C6 미실행. 골든 [golden/practice.md](golden/practice.md) |
| **DD-33** | `/teacher` = **A 「교실에 붙일 초대장」**(시험지 사물 — 반 이름 · 큰 초대코드 · QR 한 장, `InviteSheet`). 반이 없으면 같은 종이가 미리보기로 서고 반 이름 칸이 종이의 제목(입력칸이 곧 결과). 여러 반이면 괘선 목록에서 고르고 처음엔 학생이 가장 적은 반. 참여(학생 입구)는 한 줄 폼. 탈락: B 「우리 반 칠판」(학생 0 이라 첫 화면이 빈 칠판) · C 「첫 과제 미리보기」(예시뿐) · D 「학급 대시보드」(N4 불통과) | B1: 남은 학습자 화면 중 점수가 있는 유일한 화면(4, 렌즈 6). B4 (2) A 만 「입력칸이 곧 결과」 몸짓. 반이 있는 상태는 **캡처하지 않았다** — 검증 계정에 반이 없고 캡처용 반 생성은 DB 쓰기라서, 렌더 계약 테스트로 고정. 수정 0회. C6 미실행. 골든 [golden/teacher.md](golden/teacher.md) |
| **DD-22b** | 관측 `hub_curve_interacted` 의 DB 허용 목록 = **승인 대기** — `supabase/migrations/_pending_funnel_allow_hub_curve.sql`(작성 시점 DB 제약 40 + 1). 적용하지 않았다 | A7(마이그레이션은 SQL 커밋 후 승인 대기). 적용 전에는 `db-allowlist.integration.test.ts` 가 이 1종에서 실패한다 — 맞는 실패. 화면 동작에는 영향 없음(관측만 빠진다) |

### 공용 컴포넌트 교체 후보 (A5 — 화면 범위 밖이라 손대지 않은 것)

| 후보 | 어디서 걸렸나 | 제안 |
|---|---|---|
| `components/home/GatewayLead.tsx` 의 테두리 상자 | `/hub` 곡선 바로 위 「다시 오셨어요」 가 카드형 상자로 첫 시선을 먼저 가져간다. `/hub-lab` VariantG 도 써서 허브 전용이 아니다 | 괘선 한 줄(`Rule`)로 — `/hub-lab` 은 내부 실험실이라 함께 바꿔도 된다 |
| `components/ui/ios/index.ts` 배럴 | 배럴 import 한 줄이 쓰지 않는 `Card`(떠오르는 hover)까지 화면 트리에 싣는다 — 허브는 `ui/ios/Screen` 직접 import 로 피했다 | 학습자 화면의 `@/components/ui/ios` import 를 파일 직접으로(정적 신호 오탐 감소) |
| 감사 렌더 계측의 「카드형」 이 괘선 목록 행도 센다 | `/diagnostic` 목표별 진단을 카드에서 `divide-y` 목록으로 바꿨는데 1280 카드형이 3 남았다 — 행의 윗선을 테두리로 센다 | `measure-screen.mjs` · `capture.mjs` 의 cardsLike 를 "네 변 테두리 또는 그림자" 로 좁히기(감사 기준선 재측정 필요) |
| 허브·세션 완료의 7일 곡선이 두 벌 | `TodayStage` 의 `Curve`(허브 전용)와 `CompletionState` 의 `SessionCurve`(플래시카드 전용)가 같은 문법을 따로 그린다 — A5 로 공용화하지 않았다 | `components/ui/press` 옆에 `MemoryWeekCurve`(base · plan · 요일) 하나로 추출, 두 화면이 쓴다 |
| `components/recommend/NextActionCard.tsx` 그라디언트 | 플래시카드 완료 화면 아래 추천 카드에 그라디언트 2 가 남았다 — 여러 화면이 쓰는 공용 | 판면 톤(`--bg2` + 괘선)으로 |
| `components/ui/ZoomableImage.tsx` glass | 플래시카드 카드 뒷면이 가져오는 확대 오버레이에 backdrop-blur | 불투명 오버레이로 |
| `components/spellforge/*` 가 `/text/[id]` 트리에 실린다 | 읽기 화면이 SpellForge 를 모드로 품어 정적 신호 7(그라디언트·떠오르는 hover·무한 모션·3열)이 이 화면 몫으로 셈된다 — SpellForge 는 `/spellforge*` 와 공유 | SpellForge 재설계 때 함께 줄어든다(우선순위 밖 학습 모듈) |
| `ForgettingCurve` · `lib/flashcard/memory-line` 이 두 화면(플래시카드 · WordVault 학습)에서 쓰인다 | 플래시카드 전용으로 만들었는데 WordVault 가 수정 없이 가져왔다 — 이제 공용 | `components/ui/press` 옆으로 옮기고 이름을 `MemoryLine` 으로(동작 변경 없음) |
| 권점(`text-emphasis`)이 `/hub` · `/dashboard` 두 곳에 같은 값으로 따로 있다 | 둘 다 라우트 전용 CSS 모듈에 적었다(남의 라우트 CSS 를 import 하지 않으려고). 영어 낱말에서는 글자마다 점이 찍혀 낱말 하나가 점 줄이 된다 | `ui/press` 에 `Gwonjeom` 옆 `.gwonjeomWord` 한 벌 · 영어는 낱말 끝 점 하나(`::after`)로 — 두 화면 동시 교체 |
| `ExtractionPanel`(공용: `/text/[id]` · 옛 `/text/new`)이 한국어 판정 문장을 **이탤릭**으로 쓰고, 「커버리지」 를 **내 단어장 기준**으로 계산해 같은 글의 학년 기준 커버리지(`/fit` 계열)와 다른 숫자를 낸다 | `/text/new` 에서 두 숫자가 한 화면에 섰다(39.4% vs 100%) — 이 화면에서는 걷었다 | 한국어 이탤릭 제거 · 지표 이름을 「내 단어장으로 본 커버리지」 로 구분(또는 `/fit` 커버리지와 한 정의로) |
| `useTheme` 의 첫 값이 서버(light)와 브라우저(OS 다크)에서 다르다 | 테마 아이콘을 그리는 화면(`/text/new` · `/wordvault`)이 다크 OS 에서 hydration 오류 3건 — `/text/new` 는 화면 안에서 막았다 | 훅이 `ready` 전에는 `theme` 을 `null` 로 내게 |
| `saveText` · `saveUserBook` 이 새 글 표지 기본색으로 AI-보라(`#A78BFA → #6D28D9`)를 **DB 에 쓴다** | 화면 밖 데이터라 이 재설계에서 안 건드렸다 — 새 글마다 보라 표지가 쌓인다 | 표지 기본색을 토큰 계열(주묵·잉크)로. 기존 행은 그대로 |
| `SignupProof` 가 `(auth)/signup/` 에 있는데 인증 4화면이 같이 쓴다 | 이름·자리가 가입 전용처럼 보인다 | `(auth)/AuthProof.tsx` 옆으로 옮기고 이름을 `AuthProofPassage` 로(동작 변경 없음) |
| `DcpPlayer`(`/practice/dcp` · `/library/textbooks/…/practice` 공용)가 중첩 상자(bg2 상자 안 테두리 카드) · 번호 원 · **36px 버튼**(44px 하한 미만) · 그림자 | 이 재설계의 연습지 문법(괘선 문항·번호 숫자)과 어긋난다. 공용이라 한 화면 작업에서 못 바꾼다 | 문항을 괘선 행으로 · 번호는 mono 숫자 · 버튼 44px · 그림자 제거 — 두 화면 동시 |
| 평균 신호 정규식이 **주석**도 센다 | `ui/press/index.tsx:6` 주석 속 `shadow-md` 가 이 파일을 가져오는 모든 화면의 정적 신호를 1 올린다 | 라쳇·`measure-screen.mjs`·`screen-graph.mjs` 가 `//`·`/* */` 주석을 걷고 세게(기준선 재측정 필요 — 규칙을 고치는 일이라 별도 커밋) |

### 정본 변경 요청 (A2 — 토큰·씨앗·스킬은 고치지 않았다)

- 없음(`/hub`). 선·면은 페이드(opacity), 권점은 색 전환 — 기존 예산 안에서 해결했다.
- 없음(`/diagnostic`). 칠은 `/fit` 과 같은 색 전환.
- 없음(`/fit/s`). `/fit` 과 같은 부품.
- 없음(`/signup`). `/fit` 과 같은 부품.
- 없음(`/text/[id]`). 낱말 찾기는 즉시 스크롤 + 포커스(7종 안).
- 없음(`/wordvault/review`). `/flashcard/play` 부품 그대로.
- 없음(회고). 층 펼치기는 모션 0 · 색 전환만(7종 안).
- 없음(`/text/new`). `/fit` 부품 그대로.
- 없음(인증 3화면). `/signup` 부품 그대로.
- 없음(`/practice`). 모션 0.
- 없음(`/teacher`). 모션 0.
- 없음(`/flashcard/play`). 평가 미리보기 곡선은 모션 없이 바뀐다. (후보로만: 서명을 「곡선이 오른쪽으로 늘어나는 200ms」 로 키우려면 §5.2 화이트리스트에 「기억선 전환」 을 더하는 개정이 먼저다 — G4.)

### 이 세션이 만난 기존 결함 (범위 밖 — 고치지 않음)

- 커밋된 트리의 타입 오류 3건: `app/admin/kice/item/[slug]/page.tsx:125` · `lib/csat/session/reveal.ts:14,79`(`AnchorOrigin` 없음 · `.from` 없음) — 다른 세션의 CSAT 작업 일부만 커밋된 흔적.
- `lib/analytics/__tests__/wired.test.ts` 「funnel_events 2종도 호출부가 있다」 가 Windows(CRLF 체크아웃)에서 실패 — 정규식이 `\n\n` 만 본다. Linux CI 는 통과.
