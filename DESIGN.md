# Vocaflow 디자인 — 방향 · 형태 · 골든

> 디자인 작업의 입구. 값은 [tokens.css](packages/design-tokens/src/tokens.css) · [globals.css](apps/web/src/app/globals.css) 에서 2026-09-18 에 읽었고,
> 어긋나면 코드가 맞다. 형태를 만드는 절차는 [vocaflow-design](.claude/skills/vocaflow-design/SKILL.md) §G, 재료는 [DESIGN_SYSTEM](docs/DESIGN_SYSTEM.md).

## 방향 — 값으로만

지면 `#FBFAF6`(`--bg`) · 캔버스 `#F4F0E9`(`--bg2`) 위에 잉크 `#1A1714`(`--t1`)로 쓰고, 브랜드 행동은 Deep Ink `#0F2540`(`--p`),
면적을 가진 색은 주묵 `#C0392B`(`--ju`) 하나다. 골드 `#B0843A`(`--active`)는 화면 면적 5% 미만.
글꼴은 Hahmlet(한글 디스플레이) · Lora(영어 원문) · IBM Plex Sans KR(UI·본문) · JetBrains Mono(수치) 4종.
구획은 그림자 대신 `0 0 0 1px #E0DBD0`(헤어라인 링, `--bd`), 모서리 2–6px(`--r-sm`…`--r-2xl`),
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
| 서가 | 층이 차오르는 사다리 → 층 안에 낱말이 선 지층(2026-09-19) | FSRS 안정도 | `apps/web/src/components/dashboard/DurabilityLadder.tsx` |
| 시험지 | 2단 격자 · 문항 번호 · 괘선 | CSAT 코퍼스 | `apps/web/src/components/textfit/ClassSheet.tsx`(권점 · 난외 · 도장) |

씨앗 전체(10개)와 골격 여부: [00-form-seeds](docs/design/00-form-seeds.md).

## 화면별 골격·서명 배정

골격 = 첫 시선이 닿는 형태(vocaflow-design §G1 축 하나). 서명 = 그 골격에서 화면당 하나.
상태 칸은 2026-09-18 UX 감사의 **실캡처 판정**(브랜치 `feat/ux-audit` `docs/design/audit/verdict.md`)을 따른다 — 전체 127화면 중 서명 있음은 `/` · `/csat` 둘뿐이다.

| 화면 | 골격 (G1 축) | 서명 (요소 · 트리거 · ms) | 상태 |
|---|---|---|---|
| `/` 랜딩 | 채색 지문 | 슬라이더 이동 → 단어 면 색 전환 · 200ms(`--dur-normal`) | 현행 |
| `/fit` | 채색 지문 | 학년 슬라이더 → 낱말 면 색 200ms(랜딩과 같은 몸짓) · 출력 면 = 「학급에 나눠 줄 한 장」(권점·난외·도장) | **서명 있음 — 골든 1호**(2026-09-19, [golden/fit.md](docs/design/golden/fit.md)). A+B 채택, C 보류 · D 재검토 |
| `/fit/s/[payload]` 공유 결과 | 채색 지문 | 학년 슬라이더 → 가장 어려운 낱말 줄 면 색 200ms(`/fit` 과 같은 `PaintedPassage`) · 1차 「내 지문으로 해 보기」 | **서명 있음**(2026-09-19 골든 5호 [golden/fit-s.md](docs/design/golden/fit-s.md) · DD-25) |
| `/signup` (인증 대표) | 채색 지문 | 가입 폼 옆 지문이 학년 슬라이더로 칠해짐 · 200ms(`PaintedPassage`) — 모바일은 칠해진 두 줄 | **서명 있음**(2026-09-19 골든 6호 [golden/signup.md](docs/design/golden/signup.md) · DD-26) · 로그인·재설정·메일 확인은 아직 옛 틀 |
| `/text/[id]` | 채색 지문 × 망각 | 원문 낱말 밑줄 두께 3/2/1px = 이 학습자의 R(t) · 원문 위 낱말 줄, 누르면 원문의 그 자리로(모션 0) | **서명 있음**(2026-09-19 골든 7호 [golden/text-id.md](docs/design/golden/text-id.md) · DD-27) |
| `/csat` 분석 | 주묵 문법 | 대조 순간 지지 실선이 근거 → 정답으로 그어짐 · 200ms | 현행(선 그리기 모션은 §5.2 개정 전까지 페이드) |
| `/csat` 홈 | 시험지 사물 | 두 문항이 `=` 로 합류 · 패턴 교체 시 · 200ms | 현행 |
| `/dashboard` · `/reports` | 환경 변형 | 기억의 지층 — 층 두께 = 낱말 수, 층 안에 내 낱말, 이번 주에 되찾은 낱말엔 권점 · 층을 누르면 펼침(모션 0) · `/reports` = 주마다 한 겹 | **서명 있음**(2026-09-19 골든 9호 [golden/retrospect.md](docs/design/golden/retrospect.md) · DD-29) |
| `/hub` · 홈 | 망각 | 「오늘 다시 볼 단어」 슬라이더 → 7일 기억 곡선(Σ R(t))의 실선·면이 서고 낱말 권점이 옮겨 찍힘 · 200ms(`TodayStage`) | **서명 있음**(2026-09-19 골든 2호 [golden/hub.md](docs/design/golden/hub.md) · DD-22) |
| `/diagnostic` | 채색 지문 | 「알아요 / 몰라요」 → 지금까지의 답으로 본 수준에서 지문 칠이 다시 갈림 · 200ms(`DiagnosticPassage`) · 결과 h1 = 지금 읽을 수 있는 책 수 | **서명 있음**(2026-09-19 골든 3호 [golden/diagnostic.md](docs/design/golden/diagnostic.md) · DD-23) |
| `/wordvault` | 망각(목표) | — | **감사 판정 평균** — 링 게이지·4열 타일, 4색은 점·숫자 색뿐 · `/review` ≡ `/study` 픽셀 동일(우선순위 8위) |
| `/wordvault/review` · `/study` | 망각 | 평가에 손을 얹으면 이 단어의 다음 곡선·다음 만남 눈금(`/flashcard/play` 와 같은 부품) · review = 다시 볼 낱말만 | **서명 있음**(2026-09-19 골든 8호 [golden/wordvault-review.md](docs/design/golden/wordvault-review.md) · DD-28) |
| `/library/books` 매대 | — | 표지 식별색(색상=갈래 · 명도=수준) | **다음 발산 대상**(`/fit` 골든 고정 후 착수 — DD-19) — 골격이 격자(평균). 발산 4안 [compare/library-books.md](docs/design/compare/library-books.md) → 사람이 고른다 |
| `/flashcard/play` | 망각 | 평가에 손을 얹으면 이 단어의 다음 곡선과 다음 만남 눈금이 선다(모션 0 · 카드 뒤집기는 7종 안) · 완료 = 7일 곡선 | **서명 있음**(2026-09-19 골든 4호 [golden/flashcard-play.md](docs/design/golden/flashcard-play.md) · DD-24) |
| `/flashcard` 등 다른 학습 모듈 | 망각(목표) | 카드 뒤집기 0.55s(7종 안) | **감사 판정 평균** — 학습 모듈 18화면 중 서명은 `/flashcard/play` 하나 |
| `/admin/*` | 환경 변형 · 주묵 문법 중 화면별 선언 | — | 액센트 = Deep Ink `--p` 확정(DD-01). 옛 보라는 신규 금지·감소만 |

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
| CSAT 학습자 결정 | [학습자 결정](docs/csat-learner/DECISIONS.md) |
| 조사 → 구현 → 캡처 → 비평 → 수정 | [디자인 작업 절차](docs/design/06-workflow.md) (`pnpm --filter web test:design`) |
| 레퍼런스를 선택하는 이유 | [레퍼런스 인덱스](docs/design/references.md) |
| 형태 씨앗 · 발산안 · 골든 | [00-form-seeds](docs/design/00-form-seeds.md) · [compare/](docs/design/compare/fit.md) · [golden/](docs/design/golden/README.md) |
| 디자인 거버넌스 결정 | [design/DECISIONS](docs/design/DECISIONS.md) |
| 겹치면 안 되는 자기 작업 | [own-portfolio](docs/design/own-portfolio.md) |

큰 재설계(새 화면·전면 재설계)는 §G3 발산 4안 — 골격(G1 축)이 서로 다른 넷 — 을 `compare.md` 로 비교하고 사람이 고른다.
고른 안은 2회 수정해 골든으로 고정하고, 이후 같은 계열 화면은 골든을 닮게 만든다.
