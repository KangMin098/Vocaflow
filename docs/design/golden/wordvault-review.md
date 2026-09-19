# 골든 — `/wordvault/review` (+ `/wordvault/study`) 복습 (골든 8호)

> 고정 2026-09-19 · 고른 규칙: 화면 재설계 실행 세션 B4 · 만든 것: Claude Code
> 발산 기록: [compare/wordvault-review.md](../compare/wordvault-review.md) · 결정: [DECISIONS](../DECISIONS.md) DD-28 · 같은 부품의 앞 골든: [flashcard-play](flashcard-play.md)

| 파일 | 상태 | 뷰포트 |
|---|---|---|
| [wordvault-review-A@1280-light.png](wordvault-review-A@1280-light.png) | 복습 첫 화면(e2e 픽스처 런타임 계정 — 다시 볼 낱말). 카드 아래 기억선: 지난번 뒤로 25일 · 흐릿해요 | 1280×900 |
| [wordvault-review-A-rate@390-light.png](wordvault-review-A-rate@390-light.png) | 예문까지 연 뒤 「Hard」 에 손을 얹음 — 다음 곡선 + 눈금, 버튼마다 FSRS 간격(1일 · 2일 · 2일 · 약 3일 · 약 4일) | 390×844 |
| [wordvault-review-A-rate@390-dark.png](wordvault-review-A-rate@390-dark.png) | 같은 면 · 다크 | 390×844 |
| [wordvault-review-A-empty@390-light.png](wordvault-review-A-empty@390-light.png) | 빈 상태 — 검증 계정(새 낱말만): 「흐려지거나 흔들리는 단어가 지금은 없어요」 · 1차 「새 단어 익히기」 · 2차 「단어 둘러보기」 | 390×844 |

평가는 하지 않았다(DB 쓰기 0). study 는 같은 `StudyMode` 라 같은 골든을 따른다.

## 골격 · 서명

- **골격(G1)**: 망각 — `/flashcard/play` 골든의 「이 단어의 기억선」(`ForgettingCurve` · `buildMemoryLine`)을 **수정 없이** 가져왔다. 5단 자가평가는 `studyRatingToFsrs` 로 4단 곡선에 옮긴다.
- **서명**: 평가에 손을 얹으면 다음 곡선과 다음 만남 눈금(모션 0) — 플래시카드와 같은 몸짓.
- **고친 데이터 결함**: 평가가 DB 의 FSRS 카드가 아니라 새 카드에 적용되던 것(`cardFor` — 세션 캐시 → DB 카드 → 새 카드 순).
- **라우트 결정**: review = 다시 볼 낱말(`attention`), study = 전체. 두 화면이 픽셀까지 같던 것을 끝냈다.
- 걷은 것: 상수 간격(I5) · 장식 방사형 원 · `rounded-3xl`/`xl` · 그림자 · 떠오르는 hover · 파란 글로우 · 재생 중 무한 글로우 · 레이블 없는 거북이(→ 「천천히」) · 없는 마이크 단축키 안내.

## 수정 이력 (2회 — 한도 소진)

| 회차 | 가장 나쁜 것 | 고친 것 |
|---|---|---|
| 1 | 예문 없는 낱말에 **빈 회색 상자** · 없는 기능(마이크) 단축키 안내 | 예문이 있을 때만 · 안내 제거 |
| 2 | review 를 `attention` 으로 좁히자 새 낱말만 있는 학습자가 「잘 따라가고 있어요」(근거 없는 칭찬) + 둘러보기뿐 | 사실만 말하고 1차 「새 단어 익히기」(`/wordvault/study?filter=state:new`) |

## 판정 수치

| 항목 | 감사(평균) | 지금 | 도구 |
|---|---|---|---|
| (a) 익명성 | 불통과 — 단일 카드 | **통과** — 기억선 · 4색 밑줄 | 이미지 직접 |
| N4 | 불통과 | 통과 — FSRS 없이는 선·눈금이 없다(카드는 남는다) | — |
| 렌더 1280 (3열/그림자/큰모서리/그라디언트/카드형/시각화) | 0/**2**/**1**/7/2/**0** | 0/**1**/**0**/6/2/**1** | `measure-screen.mjs` |
| 렌더 390 | 0/**2**/**1**/1/2/**0** | 0/**1**/**0**/**0**/2/**1** | 같은 도구 |
| 정적 | **17** | **4**(`StudyMode` 의 `RevealPrompt` 모서리 2 · 떠오르는 hover 1 · press 주석 1) | `FILES=1` |
| 버튼 간격 | 상수 5종 | FSRS 미리보기(낱말마다 다름, 3일 이상 「약」) | 흐름 스크립트 |
| 라쳇 | — | learner shadow 29→**25** · rounded-big 39→**34** · gradient 165→**164** · float-hover 64→**61** · infinite-anim 10→**9** · form-declaration −2 | vitest |
| 접근성·넘침 | — | axe 0 · 넘침 0 · 오류 0(1280 · 390 · 390 다크) | 흐름 스크립트 |
| C6 | — | **미실행** — Lazyweb MCP 연결 끊김 | — |

## 남은 것

- 버튼 이름은 영어(Again · Hard · Fair · Easy · Perfect)인데 기억선 문구는 한국어(「어려워요 → 2일 뒤」) — Fair 도 Hard 로 옮겨져 같은 문구가 나온다. 다음 손질: 곡선 문구를 버튼 이름으로.
- `RevealPrompt` 의 `rounded-xl` · `hover:-translate-y-px` 가 남았다(정적 3).
- 관측 신설 없음 — 복습 완료는 `review_count` 변화로 파생(브리프).
