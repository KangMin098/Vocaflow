# Vocaflow 디자인 — 방향 · 형태 · 골든

> **[동결]** 이 문서는 **실물 확인 전 초안**이다. Stage 5 에서 실물(실제 라우트 캡처) 기준으로 교체된다. **수정 금지** — 고칠 것이 보이면 화면을 먼저 고치고 그 화면에서 값을 다시 뽑는다(DD-62).

> 디자인 작업의 입구. 값은 [tokens.css](packages/design-tokens/src/tokens.css) · [globals.css](apps/web/src/app/globals.css) 에서 2026-09-18 에 읽었고,
> 어긋나면 코드가 맞다. 형태를 만드는 절차는 [vocaflow-design](.claude/skills/vocaflow-design/SKILL.md) §G, 재료는 [DESIGN_SYSTEM](docs/DESIGN_SYSTEM.md).

## 방향 — 값으로만

지면 `#FBFAF6`(`--bg`) · 캔버스 `#F4F0E9`(`--bg2`) 위에 잉크 `#1A1714`(`--t1`)로 쓰고, 브랜드 행동은 Deep Ink `#0F2540`(`--p`),
면적을 가진 색은 주묵 `#C0392B`(`--ju`) 하나다. 골드 `#B0843A`(`--active`)는 화면 면적 5% 미만.
글꼴은 Hahmlet(한글 디스플레이) · Lora(영어 원문) · IBM Plex Sans KR(UI·본문) · JetBrains Mono(수치) 4종.
구획은 그림자 대신 `0 0 0 1px #E0DBD0`(헤어라인 링, `--bd`), 모서리 2–6px(`--r-sm`…`--r-2xl`),
무대는 1px 모눈(`--grid-line`, 24px) — 삽화·증명 액자·공개 히어로·빈 상태의 바탕에만, 학습 중 화면 0([03-system §3-9](docs/design/03-system.md) · DD-24).
뜨는 것은 모달·시트·토스트·팝오버만(`--sh-float`). 모션 100–300ms(`--dur-fast`/`--dur-normal`/`--dur-slow`), 총 1s 이하.
기억 상태는 밑줄 두께 3px(risk `#9C3A30`) · 2px(shaky `#B5803A`) · 1px(stable `#2E7D5A`) · 2px dotted(new `#8A8278`)로 긋는다.

## 세계의 사물 — 이 제품의 형태는 어디서 오는가

| 사물 | 화면에서의 형태 | 자산(N1) | 정본 |
|---|---|---|---|
| 망각 곡선 | 7일 감쇠 선 · 밑줄 두께 3/2/1px | R(t) = `exp(ln(0.9)·t/S)` | `apps/web/src/components/layout/MemorySparkline.tsx` · `DecayUnderline` |
| 칠해진 지문 | 아는/모르는 단어의 면, 레벨 슬라이더 1개 | 커버리지 계산 | `apps/web/src/components/marketing/CoverageHero.tsx` |
| 주묵 붓 | 실선+화살표(지지) · 점선+막대(배제) · 점선+화살표(유인) · `=`(합류) | CSAT 분석 자료 | [DESIGN_SYSTEM §✒ 형태 문법](docs/DESIGN_SYSTEM.md) |
| 기록 지도 | ○ · • · ✓ · ↻ × 점선 · 실선 · 이중선 · 라벨 | 세션 기록 | 같은 절 F3 |
| 낙관·권점 | 주묵 테두리 28/36/44px 안의 Hahmlet 한 글자 · 권점 | — (서명 전용) | `apps/web/src/components/ui/press` |
| 서가 | 층이 차오르는 사다리 | FSRS 안정도 | `apps/web/src/components/dashboard/DurabilityLadder.tsx` |
| 시험지 | 2단 격자 · 문항 번호 · 괘선 · 모눈 무대(삽화·액자 바탕) | CSAT 코퍼스 | `apps/web/src/components/textfit/ClassSheet.tsx`(권점 · 난외 · 도장) |

씨앗 전체(10개)와 골격 여부: [00-form-seeds](docs/design/00-form-seeds.md).

## 화면별 골격·서명 배정

골격 = 첫 시선이 닿는 형태(vocaflow-design §G1 축 하나). 서명 = 그 골격에서 화면당 하나.
상태 칸은 2026-09-18 UX 감사의 **실캡처 판정**(브랜치 `feat/ux-audit` `docs/design/audit/verdict.md`)을 따른다 — 전체 127화면 중 서명 있음은 `/` · `/csat` 둘뿐이다.

| 화면 | 골격 (G1 축) | 서명 (요소 · 트리거 · ms) | 상태 |
|---|---|---|---|
| `/` 랜딩 | 채색 지문 | 슬라이더 이동 → 단어 면 색 전환 · 200ms(`--dur-normal`) | 현행 |
| `/fit` | 채색 지문 | 학년 슬라이더 → 낱말 면 색 200ms(랜딩과 같은 몸짓) · 출력 면 = 「학급에 나눠 줄 한 장」(권점·난외·도장) | **서명 있음 — 골든 1호**(2026-09-19, [golden/fit.md](docs/design/golden/fit.md)). A+B 채택, C 보류 · D 재검토 |
| `/text/[id]` | 채색 지문(목표) | 단어 밑줄 두께 3/2/1px · 정지(모션 0) | **감사 판정 평균** — 모든 단어가 `status:'new'` 고정이라 밑줄이 한 종류(데이터는 `vocabularies.text_id` 로 있음). `word-pulse` 는 제거(DD-06) |
| `/csat` 분석 | 주묵 문법 | 대조 순간 지지 실선이 근거 → 정답으로 그어짐 · 200ms | 현행(선 그리기 모션은 §5.2 개정 전까지 페이드) |
| `/csat` 홈 | 시험지 사물 | 두 문항이 `=` 로 합류 · 패턴 교체 시 · 200ms | 현행 |
| `/dashboard` | 환경 변형(목표) | 버티는 기간 사다리의 층 · 정지(모션 0) | **감사 판정 평균 · 선언 미렌더**(첫 화면이 빈 상태 문장 카드) |
| `/hub` · 홈 | 망각(목표) | 오늘 단어의 밑줄 두께 3/2/1px(`TodayStage` · `NextWordsStrip`) | **감사 판정 평균** — 첫 시선의 표제어에 밑줄이 보이지 않음(검증 계정 단어 8개 — 데이터 있는 계정으로 재확인 필요). 7일 감쇠 선(S1) 승격 후보 |
| `/wordvault` | 망각(목표) | — | **감사 판정 평균** — 링 게이지·4열 타일, 4색은 점·숫자 색뿐 · `/review` ≡ `/study` 픽셀 동일(우선순위 8위) |
| `/library/books` 매대 | — | 표지 식별색(색상=갈래 · 명도=수준) | **다음 발산 대상**(`/fit` 골든 고정 후 착수 — DD-19) — 골격이 격자(평균). 발산 4안 [compare/library-books.md](docs/design/compare/library-books.md) → 사람이 고른다 |
| `/flashcard` 등 학습 중 | 망각(목표) | 카드 뒤집기 0.55s(7종 안) | **감사 판정 평균** — 중앙 단일 카드, R(t)·망각 표시 0(Anki/Quizlet 와 같은 모양). `/flashcard/play` 우선순위 4위 · 학습 모듈 18화면 서명 0 |
| `/admin/*` | **시험지 사물 — 「정오표」**(2026-09-20 확정 · DD-58) | 막힌 공정 행의 **주묵 권점(•)** → 고르면 권점이 주묵 실선으로 이어져 상세를 가리킨다 · 200ms | 대표 화면 `/admin/csat` 부터. 액센트 = `--p` + **주묵 표식만**(B 안 · DD-55) · 옛 보라 204곳은 감소만 · 골격 선언은 60화면 중 **0** 이라 Gate 4 에서 채운다 |

## 관리자 콘솔 — 골격 「정오표」 (2026-09-20 확정)

화면 **60개**로 가장 큰 표면인데 골격 선언이 **0/60** 이었다 — 그래서 「표 + 카드 + 3열」로 수렴했다
(전수 감사 [design/admin-brief.md](docs/design/admin-brief.md)). 발산 4안 중 **1 정오표**를 골랐다
([compare/admin-csat.md](docs/design/compare/admin-csat.md) · 결정 DD-58).

### 규칙 5 — 관리자 화면을 만들 때

| # | 규칙 | 왜 |
|---|---|---|
| A1 | **골격은 「정오표」** — 공정·항목이 **번호 + 괘선 행**으로 서고, 각 행이 「번호 · 이름 · 눈금 · 판정」이다. 카드 격자·3열은 골격이 아니다 | 관리자가 묻는 것은 「지금 어느 칸이고 다음은 무엇인가」 하나다. 번호와 괘선이 그 순서를 말한다 |
| A2 | **서명은 주묵 권점(•) 하나** — 막힌 행의 번호 왼쪽에 찍고, 고르면 **주묵 실선**으로 상세까지 이어진다(200ms `--dur-normal` · `transform` 만) | 화면당 서명 하나(§G2). 권점·실선은 이 제품의 주묵 어휘이고 관리자에만 쓰는 표식이다 |
| A3 | **첫 뷰포트에 「가장 앞선 막힌 단계」 한 줄** — 색이 아니라 **문장 + 주묵 표식**으로. 막힌 것이 없으면 **그 줄을 비운다** | 액센트 C 「공정 띠」를 대신해 흡수한 규격(DD-55). 없는 것을 색으로 꾸미지 않는다 |
| A4 | **원색 주묵(`--ju`)은 표식(점·선)만** — 권점 · 헤더 도장 테두리 · 파괴적 동작 테두리 · 활성 행 왼쪽 2px. **면으로 칠하지 않는다.** 옅은 tint(`--ju-light`)는 토큰 정의대로 **활성 행 배경**에만. 구조·액센트는 `--p` | 원색이 면적을 가지면 경고와 혼동된다(03-system 3-2). tint 는 그 파일이 「붓 자국·활성 행 배경」으로 이미 정의해 둔 자리다 |
| A5 | **44px 은 관리자 레이아웃 루트에서 일괄 보장** — 화면마다 붙이지 않는다(2026-09-20 결정) | 요소마다 붙이면 반드시 빠뜨린다. 루트에서 보장하면 스캐너의 「판정 불가」도 근거를 갖는다(DD-51·DD-56) |

### 진행 상태

| Gate | 내용 | 상태 |
|---|---|---|
| 0 | 전수 감사 + 액센트 3안 | **완료**(DD-55 · admin-brief) |
| 1 | 발산 4안 | **완료 · 「정오표」 채택**(DD-58 · compare/admin-csat) |
| 2 | 규칙 · 이 절 | **완료**(위 A1–A5) |
| 3 | 골든 목업 1280 · 375 | 진행 |
| 4 | 구현 + Tailwind 이관 + 골격 선언 60건 | 대기(DD-56 — 이관은 구현과 함께) |

## 평균 금지 — 목표는 혁신뿐

권고가 아니라 **실패하는 테스트**다(vocaflow-design §G5):
새 `page.tsx` 는 첫 20줄에 `// @form: <G1 축> — <서명>` 이 없으면 실패(`apps/web/src/app/__tests__/form-declaration-ratchet.test.ts`),
3열 균등 격자 · 그림자 · 12px+ 둥근 카드 · 그라디언트 · AI-보라 · glass · 떠오르는 hover · 무한 모션이 **하나라도 늘면** 실패(`apps/web/src/components/__tests__/average-signal-ratchet.test.ts`).
기준선은 내리기만 한다.

## 골든 스크린

[docs/design/golden/](docs/design/golden/README.md) — **골든 1호 `/fit`(2026-09-19)**: [golden/fit.md](docs/design/golden/fit.md) 4장(A 1280·390 · B 판면 · 빈 상태). 다음은 `/library/books`(발산안 있음).
같은 계열이 아닌 화면의 비평 (c) 는 아직 "기준 없음"으로 기록한다.

## 정본 연결

| 결정할 것 | 정본 |
|---|---|
| 학습 효과·형태 발명·외부 스킬 충돌 | [vocaflow-design](.claude/skills/vocaflow-design/SKILL.md) (Part 1 §A–§G 목표 · Part 2 하한선), [CLAUDE.md](CLAUDE.md) |
| 현재 판면·서체·토큰·형태 문법 | [디자인 시스템](docs/DESIGN_SYSTEM.md), [주묵 판면](docs/design/03-system.md) |
| 실제 토큰·글꼴 구현 | [tokens.css](packages/design-tokens/src/tokens.css), [Tailwind](apps/web/tailwind.config.ts) |
| 제품의 학습 계층 | [학습 모델](docs/LEARNING_MODEL.md) |
| CSAT 학습자 결정 | [학습자 결정](docs/csat-learner/DECISIONS.md) · [통합 경험](docs/csat-learner/integrated-experience.md) |
| 조사 → 방향 → 구현 → 캡처 → 비평 → 수정 | [디자인 작업 절차](docs/design/06-workflow.md) |
| 레퍼런스를 고르는 이유 | [레퍼런스 인덱스](docs/design/references.md) |
| 형태 씨앗 · 발산안 · 골든 | [00-form-seeds](docs/design/00-form-seeds.md) · [compare/](docs/design/compare/fit.md) · [golden/](docs/design/golden/README.md) |
| 디자인 거버넌스 결정 | [design/DECISIONS](docs/design/DECISIONS.md) |
| 겹치면 안 되는 자기 작업 | [own-portfolio](docs/design/own-portfolio.md) |

큰 재설계(새 화면·전면 재설계)는 §G3 발산 4안 — 골격(G1 축)이 서로 다른 넷 — 을 `compare.md` 로 비교하고 사람이 고른다.
고른 안은 2회 수정해 골든으로 고정하고, 이후 같은 계열 화면은 골든을 닮게 만든다.
