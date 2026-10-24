# 학습지도 ↔ 기출분석 연결 계약 (대량작업 H)

> 코드: `apps/web/src/lib/csat/bridge/` · 테스트: `bridge/__tests__/`(32건, 실계정·DB 없음).
> 공유 화면(학습지도 `UnifiedLearningMap`·`TaskInspector`, 문항 `AnalysisTheater`)·DB·공식 판정 엔진은 **고치지 않았다**. 아래 인터페이스로 담당 owner가 연결한다.
> 상태 구분: **H 독립 모듈 = 구현·작성자 검증 완료** / **제품 연결 = 미완료**(owner 몫). 학습 효과 NOT_EVALUATED · 지연 유지 NOT_ESTABLISHED.

## 모듈

| H | 파일 | 하는 일 | 재사용한 기존 판정 |
|---|---|---|---|
| H1·H2 | `entry.ts` `entriesFor()` | TASK·NeedRank·목표 → 열어도 되는 실제 기출 + 추천 이유 | `studyItemsFor` · `reservedPracticePool` · `NEED_LABEL` |
| H3 | `activity-meaning.ts` | 정답 열람·강의·해설 뒤 확인·도움 시도·독립 시도·보류 구분 | — |
| H4 | `exposure-consumer.ts` · `exposure-reader.ts` | P6 원장 → X0~X3/X_UNKNOWN(E 규칙 R1~R12 + 같은 지문) · 읽기 전용 | P6 `learning_exposures` · `learning_attempt_independence` · `normalizedPassageKey` |
| H5 | `evidence-feed.ts` | 유효한 독립 수행만 지도 엔진에 공급 · 승격 검문 | — (판정은 `skillDiagnosis` 몫) |
| H6 | `round-trip.ts` | TASK·Workspace·계획·목표·분석 판본·복귀 단계 왕복 | `withMapReturn` · `returnNotes` |
| H7 | `skill-map.ts` | 사고 기능 7개 ↔ TASK(정본 `TASK_CSAT_TYPES`에서 계산) | `TASK_CSAT_TYPES` |
| 화면 | `learner-summary.ts` | 학습자 여섯 질문 답(왜·무슨 능력·목표 역할·받은 도움·이해/미확인·다음) | — |

## 공급 조건(H5) — 모두 만족해야 accepted
수행·정오 있음 · P6 `independent_candidate` · 노출 X0/X1(같은 지문 포함) · 시도 판본 해시 = 현재 판본 해시 · 같은 시도 중복 아님.
모르면 **held**(UNKNOWN 보존): 원장 못 읽음 · 독립 판정 실패 · 지문 식별 불가 · 판본 변경. 도움·정답 노출 뒤·반복은 **rejected**.
`promotionGate`는 서로 다른 지문 2개 이상의 accepted 정답만 통과시키며, 통과해도 해소·숙달은 엔진이 정한다.

## K6-a 정합(같은 지문 공유 문항)
- DB `learning_attempt_independence`는 같은 `item_ref` 노출만 본다(K 하네스 `RISK_MATRIX.md` K6-a, 개발 DB `pg_get_functiondef` 확인).
- H는 앱 원장(`exposure-ledger.ts`) 기준을 따른다: **같은 지문을 쓰는 다른 문항의 정답·단서 노출도 이 시도의 노출**이다. DB가 `independent_candidate`를 내도 H 노출 수준이 X3/X2면 공급하지 않는다.
- 지문을 식별하지 못하면(문항 지문 없음 · 원장 행 문항 지문 미상 · 지문 조회 실패) 기록이 없어도 X0/X1을 주지 않는다 → held.
- `readExposures`는 문항으로 거르지 않고 그 학습자 원장 전체를 읽는다.
- DB 함수 자체의 정합 수정은 P6·학습기록 owner 결정이다. 수정한다면 SQL 전문·SHA-256·영향 범위·복구 계획을 내고 사용자 승인 뒤에만 적용한다 — 이 작업은 DB를 바꾸지 않았다.

## P6 실제 기록 경로(2026-10-24 확인)
| 경로 | 위치 | 상태 |
|---|---|---|
| 정답 공개 요청 `POST /api/csat/item/[slug]/judgment` | `feat/lecture-learner-control`(T-0147) | 브랜치에 있음 · **로컬 main 미통합** |
| 노출 기록 `learning_exposure_record(answer_direct)` 커밋 뒤에만 정답 반환 | 같은 route — 서버 인증 사용자 id · service_role 클라이언트 | 코드 확인. 실패 시 503·정답 없음·no-store |
| 분석 판본 결속(409) | 같은 route | 코드 확인 |
| 같은 지문 문항 노출 연계 | 기록은 `item_ref` 단위 — 연계는 소비자(H4 · 앱 원장)가 지문 키로 한다 | H 반영 |
| H reader → 지도 증거 입력 | `readExposures` · `readPassageKeys` · `readIndependence` → `buildEvidenceFeed` | 모듈 완성 · 지도 엔진 입력 연결 없음 |
| 개발 DB 실측 | K 하네스: `learning_exposures` 71행·3문항, 추적 시작 뒤 시도 0건 | 실측 독립 판정 NOT_RUN |

## owner 인계 — 연결 지점
1. **learning-map**(학습지도 화면): `TaskInspector`의 기출 링크를 `entriesFor(...).entries`로 만들고 `rationale`·`learnerSummary`를 그린다. 복귀 화면은 `parseBridgeCtx` + `bridgeReturnNotes(saved, ctx, 현재 분석 판본)`. 지도 엔진 입력에 `buildEvidenceFeed().accepted`를 쓸지는 그 owner 결정.
2. **csat-lecture-disclosure**(문항·판단 장면, T-0147·T-0152 진행 중): 문항 화면 「학습지도로」 링크를 `bridgeReturnHref(searchParams)`로. 노출 기록은 그쪽 route가 계속 맡는다 — H는 쓰지 않는다. **T-0152가 `AnalysisTheater`를 수정 중이므로 H는 그 파일을 동시에 고치지 않는다.**
3. 필요한 최소 인터페이스는 위 함수 서명이 전부다. 새 화면 컴포넌트·중복 판정을 만들지 않는다.

## 실제 인증 E2E 수행 가능 범위
- 가능(지금): 격리 단위·시나리오(32건). T-0147 브랜치의 judgment route 격리 E2E는 그 브랜치에서 PASS 기록.
- 불가(BLOCKED): main 기준 실계정 E2E — judgment route가 main에 없고, 학습지도 화면에 H 연결이 없다. 합성 계정 기록 생성은 기존 테스트 계정·권한 확인 뒤 owner 경로로만 한다(이 작업은 실사용자·DB 기록을 만들지 않았다).
