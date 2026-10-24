# 대량작업 K — 기출분석 통합 회귀 위험 대응표 (2026-10-24)

기준: 로컬 main `3fa3b3415`(D 판단 도구 병합) · `feat/lecture-learner-control@e77c48f94`(T-0140·0147·0152, main 미병합) · 개발 DB `jajenrevcbmrpaliomxv` 읽기 전용 질의.
상태 어휘: **PASS**(실행해 통과) · **KNOWN_GAP**(실행해 결함 확인, `it.fails` 로 고정) · **NOT_READY**(제품에 연결되지 않아 검증 대상 없음) · **NOT_RUN**(실행하지 않음). 서로 승격하지 않는다.
검증 층: U=단위 · I=격리 · L=실계정/개발 DB · C=콘텐츠 승인 · E=학습 효과. 이번 회차는 U·L(읽기)만 실행했다. I·C·E 는 NOT_RUN.

하네스: `apps/web/src/lib/csat/k-regression/__tests__/k-contracts.test.ts` (14 tests, 실패로 고정한 결함 3건 포함).

| K | 위험 | 상태 | 층 | 근거 |
|---|---|---|---|---|
| K1 | 문항·원문·분석·강의·앵커·노출·지도 계약 충돌 | NOT_READY | — | 강의·정답 지연·34 연결이 main 에 없다(T-0152 REVIEW). 통합 뒤 재검사 |
| K2 | 초기 props 정답 키 누출(D 픽스처 13건) | PASS | U | `leakedAnswerKeys` = [] |
| K2-a | 정답 키 목록이 `is_correct`·`answer_no`·`correctIndex` 를 못 잡는다 | KNOWN_GAP | U | `lib/csat/judgment/evidence.ts` ANSWER_KEYS |
| K2 | 첫 HTML·RSC 정답 분리, cue·강조 누출 | PASS(브랜치) | U | lecture 브랜치 judgment route·lecture 테스트 86/86. main 미병합이라 제품 기준은 NOT_READY |
| K3 | 판본(analysis/units)·id·형식 불일치 거절 | PASS | U | `checkReveal` |
| K3-a | units **해시**가 달라도 번호만 같으면 통과 | KNOWN_GAP | U | `RevealData` 에 unitsHash 없음 |
| K3 | 픽스처 13건 ↔ 개발 DB 현재 판본·해시 | PASS | L | 13/13 일치 |
| K4 | 2015#25 `answers={4,5}`(DB 유일 복수 정답) | KNOWN_GAP | U·L | K4-a: verdict=correct 2개 + answer=4 공개 자료를 거절하지 않는다. 단일 `answer` 비교: `session/ItemScreen.tsx:100`, `authored/AuthoredRunner.tsx:466`, `lib/csat/evidence.ts:323` |
| K5 | D 6종 판단 도구의 근거 데이터 결속 | PASS | U·L | D 테스트 145/145 + 픽스처 DB 결속 |
| K5 | D 도구 제품 화면 연결 | NOT_READY | — | 제품 라우트에 마운트 없음(grep 0건) |
| K5 | 34번 판단 도구 제품 연결 | NOT_READY | — | T-0145 BLOCKED · T-0152 REVIEW |
| K6 | P6 v3.1 개발 DB 적용 | PASS | L | 마이그레이션 2건 이력 존재 · authenticated 기록 권한 없음 · service_role 추적 표 INSERT 회수 · auth.users 참조 제거 |
| K6 | 기록 실패 시 정답 미전달(503) | PASS(브랜치) | U | judgment route 테스트 |
| K6 | 노출·도움 뒤 시도의 독립 판정 실측 | NOT_READY | L | 추적 시작 뒤 시도 0건 · 노출 71행/3문항 |
| K6-a | 독립 판정이 같은 `item_ref` 만 본다 — 지문을 공유하는 다른 문항의 노출을 반영하지 않는다 | KNOWN_GAP(정적) | — | `learning_attempt_independence` exposed CTE. 앱 reader 는 지문 해시로 묶는다 → DB·앱 판정 기준이 다르다. 고치려면 DB 변경(승인 필요) |
| K7 | PDF·강의·근거 동시 사용 성능·장애 | NOT_RUN | — | 통합 화면이 main 에 없다 |
| K8 | 검증 상태 구별 | PASS | — | 이 표의 어휘·층 구분 |

## 재발 사례 대응

| 사례 | 항목 | 상태 |
|---|---|---|
| 34번 c3 UNKNOWN 경계 | K5 | NOT_READY |
| cue 이동·강조 정답 누출 / 초기 HTML·RSC 간접 공개 | K2 | 브랜치 PASS · 제품 NOT_READY |
| 2015#25 복수 정답 | K4 | KNOWN_GAP |
| 35번 근거 강조 불일치 | K3·K5 | 픽스처 결속 PASS(H2609G1/G2#35) · 강조 화면 NOT_READY |
| 문항 조건·한정 과잉 일반화 | — | NOT_RUN(T-0148 BLOCKED 쪽 탐지기) |
| 원문 누락·도표 수치·각주 | — | NOT_RUN |
| P6 기록 실패 뒤 정답 전달 | K6 | 브랜치 PASS |
| 도움 받은 학습의 독립 수행 오판 | K6 | 함수 규칙 존재 · 실측 NOT_READY · K6-a |
| 분석 판본 변경 뒤 앵커 불일치 | K3 | PASS · 해시는 K3-a |

## 결론
K 준비 작업(하네스·대응표)만 완료. 전체 제품 수용은 보류 — 강의·34 연결 main 통합, 1280/1440 통합 E2E, 독립 Codex 검증이 남았다.
