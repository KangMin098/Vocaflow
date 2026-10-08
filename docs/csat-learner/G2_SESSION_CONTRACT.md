<!-- docs/csat-learner/G2_SESSION_CONTRACT.md -->
# G2: 서버 학습 세션 · 멱등성 · 첫 시도 계약 (설계 결정)

| 항목 | 내용 |
|---|---|
| 결정일 | 2026-10-08 (사용자 결정) |
| 이어 받는 문서 | [G0 계약](./G0_LEARNING_CONTRACT.md). G0 §6의 (a)/(b) 선택지는 **(b) 별도 세션 표로 확정**합니다 |
| 상태 | **설계만 했습니다.** SQL은 vocaflow-b5의 통합 세트로 다시 설계하고, 사용자 승인 전에는 DB에 적용하지 않습니다 |
| 선행 | G0·G1은 기능 범위 기준으로 CLOSED. incident는 [G1_INCIDENT](./G1_INCIDENT_2026-10-08.md) |

> **가장 중요한 원칙: 세션 / 시도 / 이벤트 / 완료를 다시 하나로 합치지 않습니다.**
> G0에서 분리한 `activity · phase · help_level · outcome` 위에 서버 세션과 멱등성을 얹습니다.

## 1. 서버 학습 세션은 별도 표
**이유**: 문항을 열었지만 판단을 한 번도 제출하지 않은 상태도 학습 이력입니다. 시도나 이벤트 행이 있어야만 세션이 존재하는 구조로는 이것을 나타낼 수 없습니다.

세션이 최소한 가져야 하는 의미 (열 이름은 통합 SQL에서 정함):

| 의미 | 비고 |
|---|---|
| 학습자 | `user_id`. RLS로 본인 행만 |
| 대상 | `item_ref`. 기출은 `csat_items.id`, 비기출 과제는 별도 식별자(사용자 결정) |
| 학습 활동 · 측정 단계 | `activity`(theater·dissect·practice) · `phase`(practice·review·transfer·pre·post·delayed). 세션에 붙고 시도는 상속 |
| 시작 · 마지막 활동 | `started_at` · `last_active_at` |
| 현재 단계 | `step` · `steps`(재개 위치, 강의가 바뀌었는지 판별) |
| 공개 · 도움 수준 | `revealed_at` · `help_level`(independent·hint·viewed_first). 먼저 공개한 값이 이김 |
| 종료 상태 | `finished_at`(한 번 정해지면 불변), 복습 예약 `review_at` |
| 출처 | `client_session_id`(기기가 만든 세션 uuid) · 기기·클라이언트 provenance(닫힌 열거형) · `synthetic` |
| 무효화 | 삭제 표시(tombstone) 또는 무효화 상태. 병합으로 되살아나지 않음 |

- `completion`(viewed·guided·independent)은 **저장하지 않고 파생**합니다(G0 §2 그대로).
- 기기 기록(`csat_learner_state.record.sessions`, G1)은 같은 `client_session_id`로 서버 세션과 짝을 짓습니다. G1 세션의 `id`·`sv`·`updatedAt`·`revealedAt`·삭제 표시가 그대로 옮겨집니다.

## 2. 멱등성: 요청 키와 도메인 유일성을 분리
| 구분 | 무엇 | 키 |
|---|---|---|
| **요청 멱등** (재전송 방지) | 같은 논리적 변경의 재시도를 한 번으로 | `user_id + client_mutation_id` |
| **도메인 규칙** (학습 의미) | 첫 시도, 한 세션, 같은 문항 재풀이, 3일 뒤 복습, 전이 시도 | 세션 · `phase` · `activity` · 순서 열로 계산 |

- **같은 논리적 변경의 재시도만** 같은 `client_mutation_id`를 씁니다. 새 사용자 행동(다시 풀기, 복습, 전이)에는 **언제나 새 id**를 씁니다. 같은 답을 다시 제출하더라도 그것이 새 행동이면 새 id입니다.
- 같은 `client_mutation_id`로 **내용이 다른** 요청이 오면 덮어쓰지 않고 충돌로 처리합니다. 모든 의미 필드를 비교합니다(G2 초안의 기록 함수 규칙).
- G1 기기 기록의 `Prediction.attempt`(uuid)는 **요청 멱등 키**로 옮겨집니다. 「첫 시도」 판정에는 쓰지 않습니다.
- 세션 쪽 변경(열기, 단계 이동, 공개, 마치기, 복습 예약, 삭제)도 각각 `client_mutation_id`를 가집니다. 서버는 단조 규칙(G0 §4)으로 합칩니다.

## 3. 첫 시도(first attempt)의 정의
첫 시도는 **네트워크상 처음 들어온 INSERT가 아니라, 학습 계약상 첫 판단 제출**입니다.

| 행동 | 첫 시도인가 |
|---|---|
| 문항 열기 | 아니다 (세션만 생김) |
| 「모르겠어요—바로 보기」 | 아니다 (`help_level=viewed_first`, 시도 없음) |
| 해설 먼저 보기 | 아니다 |
| 실제 판단 제출(근거 또는 정답 + 확신) | **후보**. 그 학습자·대상의 해당 `phase`에서 가장 이른 판단 제출이 첫 시도 |
| 같은 논리적 변경의 재전송 | 아니다. 요청 멱등으로 한 행만 남으므로 첫 시도가 둘이 될 수 없음 |
| 다시 풀기 · 복습 · 전이 | 새 시도. 첫 시도 여부는 `phase`·세션 순서로 따로 계산 |

- 계산은 저장이 아니라 **질의(뷰·함수)** 로 합니다. 효과 프로토콜(`evaluateProtocol`)의 「문항당 첫 시도만」 규칙도 같은 정의를 씁니다.
- 「해설을 먼저 본 세션의 이후 판단」을 효과 측정(`post`·`transfer`)에서 뺄지는 통합 설계에서 정합니다(제안: 뺀다).

## 4. 통합 SQL 세트에 넘길 요구사항 (vocaflow-b5)
G2 초안 `docs/csat-learner/g2-draft/learning_task_attempts_ext.sql`(sha256 `664ef0e8…dda5b6`)은 **단독 적용 금지 · 입력 자료**입니다. 아래를 하나의 통합 migration 세트로 다시 설계합니다.

1. **학습 세션 표** (§1). RLS 본인 SELECT, 쓰기는 서버 API(service_role)
2. **`learning_task_attempts` 확장**: `session_id`(FK → 세션) · `activity` · `help_level` · `client_mutation_id` + 유일 `(user_id, client_mutation_id)`. `phase`에 `review`를 넣을지는 효과 프로토콜 의미와 대조해 결정
3. **요청 멱등 기록 함수**: inserted / duplicate / conflict. 모든 의미 필드 비교
4. **첫 시도 집계** (§3) 뷰 또는 함수. 반복 시도와 분리
5. **`/csat/practice` 이식 요구** (b5): 서버 채점 · `pickNext` 전이 추천 · 효과 입력(`evaluateProtocol`) · 골격 115문항 격리 · 합성 계정 판정
6. **이벤트 허용 목록**: 기존 CHECK와 knowledge 2종, 기출 13종의 **합집합을 한 번에** 넣고 기존 행 통과를 검사

   기출 13종: `csat_item_opened` · `csat_source_ready` · `csat_prediction_submitted` · `csat_prediction_skipped` · `csat_step_advanced` · `csat_session_completed` · `csat_review_scheduled` · `csat_review_completed` · `csat_principle_saved` · `csat_transfer_submitted` · `csat_browse_filtered` · `csat_paper_failed` · `csat_learning_error`
7. **되돌리기 스크립트**와 영향 범위(표·행 수)를 sha256과 함께 승인 요청에 넣음

## 5. 이벤트 13종: 현재 상태
- 코드에 정의도 송신도 **0건**입니다(2026-10-08 grep). 보내지 않으므로 실패를 반복 전송하거나 조용히 버리는 경로도 없습니다.
- 통합 migration의 허용 목록이 승인·적용된 **뒤에** `events.ts` 정의와 송신을 한 커밋으로 활성화합니다.

## 6. 범위 밖으로 기록하는 것
- **학평 로컬 문제지 자동 로드**는 `feat/map-vnext`(`981e75083`) 전용 개발 기능이라 G1 결함이 아닙니다. main 기준 동작은 학평 문항 왼쪽에 「여기 놓기」가 나오는 것입니다. main에 들이려면 별도 작업 단위로 clean integration을 합니다.
