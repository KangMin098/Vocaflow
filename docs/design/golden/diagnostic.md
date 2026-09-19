# 골든 — `/diagnostic` 어휘 진단 (골든 3호)

> 고정 2026-09-19 · 고른 규칙: 화면 재설계 실행 세션 B4 · 만든 것: Claude Code
> 발산 기록: [compare/diagnostic.md](../compare/diagnostic.md) · 결정: [DECISIONS](../DECISIONS.md) DD-23 · 같은 몸짓의 앞 골든: [fit](fit.md)(슬라이더 → 낱말 면) · [hub](hub.md)(슬라이더 → 권점)

| 파일 | 상태 | 뷰포트 |
|---|---|---|
| [diagnostic-A-start@1280-light.png](diagnostic-A-start@1280-light.png) | 시작 — 검증 계정. 1차 「전체 어휘 진단 시작」 · 지문 dotted(아직 모름) · 목표별 진단은 괘선 목록 | 1280×900 |
| [diagnostic-A-start@390-light.png](diagnostic-A-start@390-light.png) | 같은 상태 | 390×844 |
| [diagnostic-A-start@390-dark.png](diagnostic-A-start@390-dark.png) | 같은 상태 · 다크 | 390×844 |
| [diagnostic-A-question@390-light.png](diagnostic-A-question@390-light.png) | 두 번째 면 — 12문항 뒤. 「지금까지 답한 12개로 본 수준 V2 · 처음 만나는 낱말 20개」 로 지문이 칠해지고 그 아래 문항 낱말 | 390×844 |
| [diagnostic-A-result@1280-light.png](diagnostic-A-result@1280-light.png) | 결과 — 「지금 37권을 읽을 수 있어요 · 한 계단 더 가면 88권 더」 · V5 로 칠해진 지문(처음 만나는 낱말 10) · 1차 = 추천 세트 담고 첫 카드 학습 | 1280×900 |
| [diagnostic-A-result@390-light.png](diagnostic-A-result@390-light.png) | 같은 상태 | 390×844 |

문항·결과 캡처 계정: 저장소 e2e 픽스처 런타임 계정(`05-learner-loop` 가 같은 계정으로 진단을 제출한다). 보이는 것은 데모 지문과 문항 낱말뿐이다. **이 캡처로 그 계정의 V-Level 이 V5 로 다시 매겨졌다**(e2e 05 와 같은 부작용).

## 골격 · 서명

- **골격(G1)**: 채색 지문 — 낱말별 V-Level 이 매겨진 지문(랜딩 데모와 같은 계산). 시작: 학습 낱말마다 dotted(= 아직 모름). 문항: **지금까지의 답을 서버와 같은 규칙**(`lib/diagnostic/interim-level.ts` — 정답률 ≥ 0.70 인 가장 높은 레벨)으로 추정한 수준에서 처음 만나는 낱말이 주묵 면. 결과: RPC 가 돌려준 레벨로 칠한 지문.
- **서명**: 「알아요 / 몰라요」 → 중간 추정이 바뀌면 지문 칠이 다시 갈린다 · 200ms — 랜딩·`/fit` 과 같은 칠 함수(`PaintedPassage.runs`), 레벨을 움직이는 것이 슬라이더가 아니라 **학습자의 답**이다.
- **약속을 지킨다**: 전역 헤더 「5분 진단이 끝나면 312권 중 지금 읽을 수 있는 책이 정해져요」 → 결과 h1 이 그 수(`fetchLevelReach` — 셸과 같은 분포). 「V5」 는 부제.
- 버린 안: B 「불이 켜지는 서가」(환경 변형 — 390 에서 책등 1px) · C 「시험지 한 장」(N4 약함) · D 「어휘 지층」(앱 종류가 분석 도구로 읽힌다).

## 수정 이력 (2회 — 한도 소진)

| 회차 | 가장 나쁜 것 | 고친 것 |
|---|---|---|
| 1 | 390 에서 지문이 첫 화면을 다 차지해 **1차 행동이 폴드 밖**. 캡처가 진단 목록 로딩 중에 찍혔다 | 순서를 h1 → 1차 행동 → 지문(작게)으로 · 캡처 스펙이 시작 버튼을 기다린다 |
| 2 | V11 결과에서 칠해진 낱말이 0 인데 문구가 「칠해진 곳이 다음 공부거리」 — 없는 것을 가리켰다 | 0 개면 「이 글에 처음 만나는 낱말이 없어요」 |

## 판정 수치 (감사 2026-09-18 → 2026-09-19)

| 항목 | 감사(평균) | 지금 | 도구 |
|---|---|---|---|
| (a) 익명성 | 통과 / **불통과** | 통과 / **통과** — 랜딩·`/fit` 의 채색 지문, dotted(new) 밑줄 | 이미지 직접 |
| N4 | 불통과 — 히어로 카드 + 카드 목록 | 통과 — 낱말별 레벨 없이는 못 칠한다 | — |
| 렌더 390 (3열/그림자/큰모서리/그라디언트/카드형/시각화) | 0/0/1/1/**4**/0 | 0/0/0/0/**0**/0 | `audit/tools/measure-screen.mjs` |
| 렌더 1280 | 0/0/1/7/**5**/0 | 0/0/0/6/**3**/0 — 남은 3 = 목표별 진단의 괘선 목록 행(계측이 `divide-y` 윗선을 테두리로 센다) · gradient 6 = 셸 사이드바 | 같은 도구 |
| 정적(import 트리 8종) | **6** | **1** — 공용 `ui/press` 주석 오탐(DD-22 후보) | 같은 도구 |
| 라쳇 | — | learner gradient 171→**169** · glass 52→**50** · form-declaration 무선언 목록에서 제거 | vitest |
| 접근성·넘침 | — | axe 위반 0 · 넘침 0 · 페이지 오류 0(시작 390·1280·390 다크 / 문항·결과 흐름) | `test:design` · 흐름 스크립트 |
| C6 | — | 닮은 골격 없음 — 상위 10: 퀴즈 진행률 막대(Unity·Whop·Duolingo) · 레벨 막대(Memrise·Elevate) · 레벨 선택(Babbel) · 단어 카드(GRE). [검색 기록](https://www.lazyweb.com/agentic-search/70f7557d-e726-40bf-b9c5-13eda32f2acb) | DD-21 예외 |

## 남은 것

- 시험별(track) 진단은 레벨 축이 사전 V 와 달라 지문을 칠하지 않는다(문항·결과 모두) — 그 결과 화면은 문장만. 시험별 사물(기출 코퍼스)로 칠하는 것은 다음 발산 후보.
- 셸 머리의 「진단 시작」 과 본문 1차 행동이 겹친다(감사 지적) — 셸 결함이라 범위 밖. 사이드바가 `/diagnostic` 을 Growth 로 표시하는 것도 셸.
- 관측 신설 없음 — `diagnostic_completed` 는 `user_diagnostic_results` · `user_level_snapshots` 행으로 파생된다(D4).
