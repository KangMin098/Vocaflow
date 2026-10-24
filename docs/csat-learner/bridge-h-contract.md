# 학습지도 ↔ 기출분석 연결 계약 (대량작업 H)

> 코드: `apps/web/src/lib/csat/bridge/` · 테스트: `bridge/__tests__/`(29건, 실계정·DB 없음).
> 공유 화면(학습지도 `UnifiedLearningMap`·`TaskInspector`, 문항 `AnalysisTheater`)은 **고치지 않았다**. 아래 인터페이스로 담당 owner(learning-map · csat-lecture-disclosure)가 연결한다.
> 학습 효과: **NOT_EVALUATED**. 지연 유지: NOT_ESTABLISHED.

## 모듈

| H | 파일 | 하는 일 | 재사용한 기존 판정 |
|---|---|---|---|
| H1·H2 | `entry.ts` `entriesFor()` | TASK·NeedRank·목표 → 열어도 되는 실제 기출 + 추천 이유 | `studyItemsFor` · `reservedPracticePool` · `NEED_LABEL` |
| H3 | `activity-meaning.ts` | 정답 열람·강의·해설 뒤 확인·도움 시도·독립 시도·보류 구분 | — |
| H4 | `exposure-consumer.ts` · `exposure-reader.ts` | P6 원장 → X0~X3/X_UNKNOWN(E 규칙 R1~R12) · 본인 행 읽기 전용 | P6 `learning_exposures` · `learning_attempt_independence` |
| H5 | `evidence-feed.ts` | 유효한 독립 수행만 지도 엔진에 공급 · 승격 검문 | — (판정은 `skillDiagnosis` 몫) |
| H6 | `round-trip.ts` | TASK·Workspace·계획·목표·분석 판본·복귀 단계 왕복 | `withMapReturn` · `returnNotes` |
| H7 | `skill-map.ts` | 사고 기능 7개 ↔ TASK(정본 `TASK_CSAT_TYPES`에서 계산) | `TASK_CSAT_TYPES` |
| 화면 | `learner-summary.ts` | 학습자 여섯 질문 답(왜·무슨 능력·목표 역할·받은 도움·이해/미확인·다음) | — |

## 공급 조건(H5) — 모두 만족해야 accepted
수행·정오 있음 · P6 `independent_candidate` · 노출 X0/X1 · 시도 판본 해시 = 현재 판본 해시 · 같은 시도 중복 아님.
모르면 **held**(UNKNOWN 보존): 원장 못 읽음 · 독립 판정 실패 · 판본 변경. 도움·정답 노출 뒤·반복은 **rejected**.
`promotionGate`는 서로 다른 지문 2개 이상의 accepted 정답만 통과시키며, 통과해도 해소·숙달은 엔진이 정한다.

## owner 인계 — 연결 지점
1. **learning-map**: `TaskInspector`의 기출 링크를 `entriesFor(...).entries`로 만들고 `rationale`·`learnerSummary`를 그린다. 복귀 화면은 `parseBridgeCtx` + `bridgeReturnNotes(saved, ctx, 현재 분석 판본)`.
2. **csat-lecture-disclosure**: 문항 화면 「학습지도로」 링크를 `bridgeReturnHref(searchParams)`로. 노출 기록(`learning_exposure_record`)은 그쪽 기록 경로(T-0147) — 이 모듈은 쓰지 않는다.
3. **지도 판정**: `buildEvidenceFeed`의 accepted 만 skillDiagnosis 입력 후보로. 현재 엔진 입력을 바꾸는 것은 지도 owner 결정.

## 실계정 필요(별도 상태: NOT_RUN)
- 실제 P6 기록이 생긴 뒤의 브라우저 E2E(개발 DB 실측 2026-10-24: `learning_exposures` 0행, 제품 호출 경로 없음 — E 05 문서).
- P6 마이그레이션 2건은 개발 DB 적용분이며 저장소 기록은 `fix/csat-p6-migrations`(T-0144)에 있다 — 이 작업은 DB를 바꾸지 않았다.
