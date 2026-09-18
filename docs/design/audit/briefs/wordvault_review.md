# 브리프 — `/wordvault/review` 복습 (S059) · `/wordvault/study` 학습 (S060)

> 생성 2026-09-18 · Claude Code · 근거: [카드 review](../cards/modules/wordvault_review.md) · [카드 study](../cards/modules/wordvault_study.md) · [판정](../verdict.md). 4안은 만들지 않았다.
> 두 라우트는 **같은 컴포넌트 · 같은 쿼리**(`review/page.tsx:4-5,31,34` — 주석은 due+new 라 하지만 필터 없음)이고 캡처가 픽셀 단위로 같다 → 한 브리프.

## 목적 · 여정 위치
- JTBD: "흐려진 단어가 쌓였을 때, 오늘 잃기 직전의 것부터 되살리고 싶다, 그래서 복습이 헛수고가 아니게 한다"
- 여정 ③ 복습 루프.

## 현재 골격 (판정: 평균)
- 첫 시선 = **중앙 단일 카드 + 중앙 대형 표제어** — 복습 화면인데 R(t)·망각색·밑줄 0. 카드 우상단 장식 동심원, 레이블 없는 거북이 아이콘, 파란 글로우 그림자.
- 평가 버튼 아래 다음 복습 간격이 **하드코딩**("10 min…14 days", `StudyMode.tsx:42-48`) — **I5 위반**(FSRS 가 계산할 값을 상수로).

## 자산 (DB 실측)

| 자산 | 값 | 어디 |
|---|---|---|
| 단어별 FSRS | 2,249행 `stability · difficulty · last_review_at · next_review_at` | `vocabularies` |
| 다음 간격 | `ts-fsrs` 가 평가별로 계산 가능 | `lib/srs/fsrs.ts` |
| 4색 | 동적 R(t) | DESIGN_SYSTEM §Memory Decay |

## G1 축 후보
1. **망각** — 복습 큐 자체가 **R(t) 가 낮은 순의 곡선 위 점들** — 첫 시선이 "지금 이 단어들이 선 아래로 내려가고 있다". 카드는 곡선의 한 점을 열면 나온다.
2. **환경 변형** — 복습한 단어가 risk→stable 로 옮겨가며 **화면의 바탕 톤이 세션 동안 차오른다**(렌즈 3) — 게이지 없이.

## 서명 후보
- 평가 버튼을 누르면 그 단어의 다음 복습 시점이 곡선 위에서 오른쪽으로 이동(상수가 아니라 FSRS 계산값) — 200ms.

## 제약
- 하드코딩 간격 제거(I5) · study/review 를 **합칠지 구분할지** 먼저 결정(통합 후보) · 모션 7종 · 오답에 붉은색 금지.

## 성공 지표
- 기존: `screen_viewed`(wordvault-review 54 · wordvault-study 54 — 표본 부족).
- 복습 완료는 `vocabularies.review_count` 변화로 파생(D4). **신설 필요**: 없음(파생으로 충분).
