# 대량작업 K — 기출분석 통합 회귀 위험 대응표 (2026-10-24 · r2)

**기준 스냅샷:** 로컬 main `3fa3b3415`(D 판단 도구 병합).
**참조 브랜치(읽기만):** `feat/lecture-learner-control@e77c48f94`(T-0140·T-0147 공식 COMPLETED, T-0152 READY).
**개발 DB:** `jajenrevcbmrpaliomxv`, 읽기 전용 질의만 했다.

## 상태 어휘
아래 상태는 서로 승격하지 않는다.

| 상태 | 뜻 |
|---|---|
| PASS | 실행해서 계약이 지켜짐 |
| KNOWN_GAP | 실행해서 결함을 재현함. 재현 테스트 PASS 는 결함이 있다는 뜻이고, 해결이 아니다 |
| NOT_IN_BASELINE | 기능은 다른 브랜치에 구현돼 있고, 공식 완료일 수도 있다. 기준 스냅샷에만 없다 |
| NOT_IMPLEMENTED | 제품 어디에도 아직 구현되지 않았다 |
| NOT_RUN | 대상은 있지만 실행하지 않았다 |

## 검증 층
U=단위 · I=격리 · L=실계정/개발 DB · C=콘텐츠 승인 · E=학습 효과.
이번 회차는 U와 L(읽기)만 실행했다. I·C·E 는 NOT_RUN 이다.

## 하네스 구성
경로: `apps/web/src/lib/csat/k-regression/`

| 파일 | 역할 |
|---|---|
| `gaps.ts` | 결함 등록부(open / fixed) |
| `k-contracts.test.ts` | 지금 지켜지는 계약. PASS 만 담는다 |
| `k-repro.test.ts` | open 결함 재현. 결함이 있다는 것을 직접 단언한다 |
| `k-targets.test.ts` | 고친 뒤의 목표 동작. open 동안 skip 이다 |
| `k-registry.test.ts` | 등록부 · 재현 · 목표 · 이 표의 정합 |

## 대응표

| K | 위험 | 상태 | 층 | 근거 |
|---|---|---|---|---|
| K1 | 문항·원문·분석·강의·앵커·노출·지도 계약 통합 | NOT_IN_BASELINE | — | 강의·정답 지연은 공식 완료(T-0140·0147)지만 main 에 없다. 34번 연결 T-0152 는 READY(리뷰 반려 뒤) |
| K2 | 초기 props 정답 키(D 픽스처 13건) | PASS | U | `leakedAnswerKeys` = [] |
| K2 | 정답 근거·소거 문장이 초기 자료에 값으로 없다 | PASS | U | 이름 목록이 아니라 값 대조로 확인 |
| K2-a | 정답 키 검사가 이름 목록에만 의존한다 | KNOWN_GAP | U | `is_correct` · `answer_no` · `correctIndex` · `correct_choice` 를 놓친다 |
| K2 | 첫 HTML·RSC 정답 분리, cue·강조 누출 | NOT_IN_BASELINE | U(브랜치) | 참조 브랜치 테스트 86/86. 실제 HTML·RSC 응답 대조는 NOT_RUN |
| K3 | 판본(analysis/units)·id·형식 불일치 거절 | PASS | U | `checkReveal` |
| K3-a | units 해시가 달라도 판본 번호만 같으면 통과 | KNOWN_GAP | U | `RevealData` 에 해시 칸이 없다 |
| K3 | 픽스처 13건과 개발 DB 현재 판본·해시 | PASS | L | 13/13 일치 |
| K4-a | 정답 번호와 선지 판정이 어긋나도 거절하지 않는다 | KNOWN_GAP | U·L | 아래 「K4-a 상세」 |
| K5 | D 6종 판단 도구 근거 데이터 결속 | PASS | U·L | D 테스트 145/145, 픽스처 DB 결속 |
| K5 | D 도구 제품 화면 연결 | NOT_IMPLEMENTED | — | 어느 제품 라우트에도 마운트가 없다 |
| K5 | 34번 판단 도구 제품 연결, c3 UNKNOWN 경계 | NOT_IN_BASELINE | — | T-0145 BLOCKED, T-0152 READY. 검증된 통합 커밋이 없어 격리 통합 검사는 NOT_RUN |
| K6 | P6 v3.1 개발 DB 적용 | PASS | L | 아래 「K6 근거」 |
| K6 | 기록 실패 시 정답 미전달(503) | NOT_IN_BASELINE | U(브랜치) | 참조 브랜치 judgment route 테스트 |
| K6 | 노출·도움 뒤 시도의 독립 판정 실측 | NOT_RUN | L | 추적 시작 뒤 시도 0건. 노출은 71행, 3문항 |
| K6-a | DB·앱 노출 기준 불일치 | KNOWN_GAP | U·L | 아래 「K6-a 상세」 |
| K7 | PDF·강의·근거 동시 사용 성능·장애 | NOT_RUN | — | 통합 화면이 기준에 없다 |
| K7 | 1280/1440 통합 화면 | NOT_RUN | — | 같은 이유 |
| K8 | 검증 상태 구별 | PASS | U | `k-registry.test.ts` 가 이 표와 등록부를 맞춘다 |

### K4-a 상세
- 2015#25 의 DB 값은 `answer=4`, `answers={4,5}` 이다. 개발 DB 에서 복수 정답 문항은 이것 하나다.
- `checkReveal` 은 정답 번호와 어긋나는 `verdict=correct` 선지가 있어도 거절하지 않는다.
- 정답 하나만 비교하는 코드:
  - `session/ItemScreen.tsx:100`
  - `authored/AuthoredRunner.tsx:466`
  - `lib/csat/evidence.ts:323`

### K6 근거
- 마이그레이션 2건 적용 이력이 있다.
- authenticated 에 기록 권한이 없다.
- service_role 의 추적 표 INSERT 가 회수됐다.
- 기록 함수가 `auth.users` 를 더 읽지 않는다.

### K6-a 상세
- DB 함수 `learning_attempt_independence` 는 같은 `item_ref` 의 노출만 본다. 2026-10-24 `pg_get_functiondef` 로 확인했다.
- 앱 노출 원장은 같은 지문 해시를 쓰는 문항까지 노출로 본다.
- DB 쪽 재현 테스트는 P6 마이그레이션이 기준에 없어 skip 이다(NOT_IN_BASELINE). 앱 쪽 재현만 실행된다.

## 재발 사례 대응

| 사례 | 항목 | 상태 |
|---|---|---|
| 34번 c3 UNKNOWN 경계 | K5 | NOT_IN_BASELINE |
| cue 이동·강조로 정답 누출 / 초기 HTML·RSC 간접 공개 | K2 | NOT_IN_BASELINE (브랜치 단위 PASS) |
| 2015#25 복수 정답 | K4-a | KNOWN_GAP |
| 35번 근거 강조 불일치 | K3·K5 | 픽스처 결속 PASS(H2609G1/G2#35) · 강조 화면 NOT_IN_BASELINE |
| 문항 조건·한정의 과도한 일반화 | — | NOT_RUN (탐지기 T-0148 BLOCKED) |
| 원문 누락·도표 수치·각주 | — | NOT_RUN |
| P6 기록 실패 이후 정답 전달 | K6 | NOT_IN_BASELINE (브랜치 단위 PASS) |
| 도움 받은 학습의 독립 수행 오판 | K6·K6-a | 실측 NOT_RUN · 기준 불일치 KNOWN_GAP |
| 분석 판본 변경 후 근거 앵커 불일치 | K3·K3-a | 판본 번호 PASS · 해시 KNOWN_GAP |

## 결론
- 수용 대상은 K 회귀 하네스뿐이다.
- 전체 제품 수용은 보류한다. 강의·34번 연결의 main 통합, 1280/1440 통합 E2E, 결함 4건 수정이 남았다.
