# S023 `/diagnostic/history` — V-Level 변천사

> 생성 2026-09-18 · Claude(감사 서브에이전트) · 근거: 메인 워크트리 코드 읽기 + `tools/screen-graph.mjs` 결과. 카드 ≤ 40줄.

## 목적
- JTBD: "진단을 여러 번 받았을 때, 내 레벨이 언제 왜 바뀌었는지 보고 싶다, 그래서 성장을 확인한다"
- 주 사용자: 학생(재진단자) · 인지 계층: 없음(L7 성격 — 추정)

## 흐름
- 진입: /diagnostic 「기록 보기」 하나뿐 — 지난 결과가 있을 때만 노출(`components/diagnostic/DiagnosticClient.tsx:731-756`). 셸 진입 없음
- D7 활성화 경로 밖
- 단계: 1. 헤더(돌아가기·제목) 2. 스냅샷 타임라인 읽기
- 완료 조건: 없음(읽기)
- 1차 행동: 「진단으로 돌아가기」(`app/(main)/diagnostic/history/page.tsx:51-57`) — 유일한 앞길
- 나가는 길: /diagnostic

## 상태 5종
| 상태 | 있나 | 근거 file:line | D5(다음 한 걸음) |
|---|---|---|---|
| 빈 | 있음 | "아직 V-Level 기록이 없어요." `components/diagnostic/HistoryTimeline.tsx:50-60` | △ 본문에 "/diagnostic" 경로 문자열만(링크 아님 `:56`), 헤더 돌아가기 링크로 대체 |
| 로딩 | 전역만 | `app/loading.tsx` | — |
| 오류 | 있음 | DB `error.message` 원문 노출 `history/page.tsx:66-70` | ✗ 다시 시도 없음 · 개발자 문자열 |
| 부분 | 없음 | 비로그인 "로그인이 필요해요." `page.tsx:26-34`(로그인 링크 없음 ✗) | — |
| 완료 | 해당 없음 | — | — |

## 자산
- N1 자산: V-Level 스냅샷(user_level_snapshots) — 역할: **숫자** — 카드마다 "V3 → V4" + 신뢰도 %(`HistoryTimeline.tsx:124-140`)
- 형태 씨앗: 없음
- 학습과학 원칙: #7 Emotional(성장 확인) — 약함. 하락 delta 를 `--error-ink` 빨강으로(`HistoryTimeline.tsx:99-101`) — 압박 규칙과 긴장(추정)

## 첫 시선 (코드 기준 — Gate 3 캡처로 확정)
- 첫 뷰포트: 56px 제목 "V-Level 변천사" + 부제 "audit chain"(학습자에게 내부 용어, `page.tsx:62`) + 세로 타임라인
- 골격 판정: **카드 목록**(세로 괘선 위 `shadow-ios-2` 카드 `HistoryTimeline.tsx:63,84`) — G1 축 없음. 시간축이 있으나 레벨 곡선은 그리지 않음
- 평균 신호(정적): 1 (float-hover 1)

## 근거
- `apps/web/src/app/(main)/diagnostic/history/page.tsx:36-42` — 스냅샷 전량 조회(limit 없음)
- `apps/web/src/components/diagnostic/HistoryTimeline.tsx:88-91` — 사유 배지 색만 다름(아이콘 병기 `:74-80`)
