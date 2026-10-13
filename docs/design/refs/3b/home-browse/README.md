# 3B 참조 대응 — v3 M1 지도 홈 · 기출 탐구 조건

> 학습 지도(access-map) · 원문 이해 패널(meaning-panel) 대조와 별개다. 그 결과로 이 화면을 검증하지 않는다.
> 정본 수치: [spec.json](./spec.json) · 변수: `home/home-landing.module.css` 의 `--hl-*` · `browse/browse-conditions.module.css` 의 `--bc-*` ·
> 가드: `apps/web/src/components/csat/home/__tests__/home-browse-geometry.test.ts` · 실측: `scripts/design/home-browse-compare.mjs`.

## 참조 → 우리 부품

| 참조 | 우리 | 같게 둔 것 | 다르게 둔 것(이유) |
|---|---|---|---|
| Skill 모달 카드(면 · 테두리 · 반경 · 여백) | 홈 「기출 탐구」 입구 카드 | #fbf9f7 · #e2e1e0 · 12 · 위 26 · 가로 24 | — |
| 보조 알약(Edit file) | 홈 「내 자료」 알약 | 면 #f4f1ed · 알약 반경 | 높이 24 → **44**(누름 대상 규칙) |
| 1차 컨트롤(먹색 알약 · reference-analysis) | 홈 「기출 탐구로」 · 서가의 고른 조건 | #0d0d17 / #fcf9f5 · 알약 | 높이 → 44 |
| 입력 상자(흰 면 + 테두리) | 서가의 안 고른 조건 칩 · 회차 고르기 | #ffffff · #e2e1e0 · 알약 | 높이 34 → 44 |

공용 `home.module.css` 의 `.chip` 은 다른 화면도 쓰므로 서가 조건 범위(`.conditions`) 안에서만 덮는다.

## 실측 대조 (2026-10-13 · dev 서버 · DPR 1)

`node --env-file=<apps/web/.env.local> scripts/design/home-browse-compare.mjs --base http://localhost:3219` — 1280 · 1440 각각 **18/18 통과**(아래는 1440).

| 항목 | 참조(기대) | 우리 | 판정 |
|---|---|---|---|
| 홈 · 기출 탐구 카드 면 | #fbf9f7 | #fbf9f7 | 통과 |
| 홈 · 카드 테두리 | #e2e1e0 | #e2e1e0 | 통과 |
| 홈 · 카드 반경 | 12 | 12.0 | 통과 |
| 홈 · 카드 위 여백 | 26 | 26.0 | 통과 |
| 홈 · 카드 가로 안쪽 | 24 | 24.0 | 통과 |
| 홈 · 내 자료 알약 면 | #f4f1ed | #f4f1ed | 통과 |
| 홈 · 내 자료 알약 반경 | 알약 | 알약 | 통과 |
| 홈 · 내 자료 높이(참조 24 → 규칙 44) | 44 | 44.0 | 통과 |
| 홈 · 1차 행동 면 | #0d0d17 | #0d0d17 | 통과 |
| 홈 · 1차 행동 글자 | #fcf9f5 | #fcf9f5 | 통과 |
| 홈 · 1차 행동 높이(규칙 44) | 44 | 44.0 | 통과 |
| 서가 · 고른 조건 면 | #0d0d17 | #0d0d17 | 통과 |
| 서가 · 고른 조건 글자 | #fcf9f5 | #fcf9f5 | 통과 |
| 서가 · 조건 반경 | 알약 | 알약 | 통과 |
| 서가 · 안 고른 조건 면 | #ffffff | #ffffff | 통과 |
| 서가 · 안 고른 조건 테두리 | #e2e1e0 | #e2e1e0 | 통과 |
| 서가 · 조건 높이(규칙 44) | 44 | 44.0 | 통과 |
| 서가 · 회차 고르기 높이(규칙 44) | 44 | 44.0 | 통과 |
