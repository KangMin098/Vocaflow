# T-0088 엔진 인계 계약 — 검증 데이터 13건

- 출처: review/goal-data-20261023 @ 52d919040 · verdict.json sha256 1567b4347e5743efcfe2b3e61eccfc5fa36c12699e42b02e38bc5e72c0c8b5be
- 입력 revision: D1–D3 80fa44540 · D4 1b8f089e5 (+정정 a40f709d9 · 54302f2e5) · PLAN 읽기 c44f41a5c
- 판정: Codex(goal-data-independent) AI 검증 · 수용자 platform-goal. 사람 Gold·출시 승인 아님.
- 사용 허용: 각 항목 scope 문장 범위의 사실 근거로만. 제품 추천 · NeedRank 확정에 쓰는 승인은 없다.

| id | 주장 | 범위(scope) | 제품 연결 허용 | 승인·사람 검수 |
|---|---|---|---|---|
| D1-insert-raw-block | 삽입 262문항의 raw_block은 모두 null이다 | DB의 R-INSERT 262행 모두 raw_block=null. 표준 발문 정규식 일치 252행이다. 이것은 결손 탐지 신호의 재현이며 문장 결손 확정이 아니다. | 삽입 문항을 raw_block 으로 제외하지 않는 근거 | 없음 |
| D1-M2709 | M2709 시험·문항이 미적재다 | csat_exams의 id=M2709 또는 exam_year=2027/month=9 조회와 csat_items exam_id=M2709 조회가 모두 HTTP 200 빈 배열이다. 현재 해당 시험·문항 미적재 주장을 확인했다. 실제 시험 시행 여부는 이번 범위 밖이다. | M2709 를 데이터 공백(unknown)으로 표시 | 적재는 DB 쓰기 승인 |
| D1-2023-38 | 2023#38 choices=null이며 body_ok=true다 | id=2023#38 한 행의 body_ok=true, choices=null을 직접 확인했다. | 2023#38 을 평가·추천 후보에서 보류 | 선지 복구는 DB 쓰기 승인 |
| D1-redistribution-record-0 | D1 source_note 기록 기준의 재배포 적격은 0(미정)이다 | 134시험 중 source_note가 비지 않은 것은 M2009뿐이고 그 시험 문항은 0행이다. 따라서 문항이 있는 시험의 source_note 기록을 요구하는 D1 기준으로 적격 0(미정)을 재현했다. source_note는 권리 증명 원장 전체와 같지 않다. | 원문 재배포 판단 보류(unknown) | 권리 판단은 사람 |
| D2-R3-boundary | 계약 v2에 R3 경계 규정 공백이 있다 | R3 경계 행 부재와 11개 전수 갈림을 확인했다. 개별 관련성 판정은 unclear를 유지한다. | R3 기출 관련도는 unknown 유지 | R3 규칙 수용 전 사용 금지 |
| D3-order-granularity-gap | 순서 연결 단절을 구별하는 전용 범주가 부족하다 | 순서 표본 네 개 모두 A/B=other이나 지시 선행·대조·과정 소개/효과 순서 단절의 설명은 서로 다르다. 전용 연결·배열 범주 부재로 정밀 정보가 other에 뭉치는 주장은 지지된다. other 사용 자체는 계약 위반이 아니다. | 순서 오답 원인 표시에 쓰지 않음 | 분류표 v2 수용 전 금지 |
| D4-handoff-1 | 공통 판정은 다른 날·지문 다양성·전이/지연 역할을 도달 조건으로 검사하지 않는다 | 진단은 다른 날·서로 다른 지문·transfer/delayed 역할을 도달 조건으로 검사하지 않는다. lifecycle에는 확정 이후·운영 진행량 검사, supply에는 역할별 자격 검사가 있으나 지연 기억 판정은 아니다. 같은 날 같은 지문 메타데이터의 서로 다른 4문항 2실패→2정답으로 resolved를 재현했다. 실제 공급에서 같은 지문 노출을 막는 별도 가드가 있으므로 전체 제품에 아무 지문 방어도 없다는 주장은 하지 않는다. | 도달·평가 판정 로직 개선 근거(코드 수정 대상) | 없음(코드 검증) |
| D4-handoff-2-M1 | 선행 실패 없는 성공만으로 도달 상태가 되지 않으며 PLAN도 checking을 도달로 바꾸지 않는다 | 성공만 4회면 unverified이고 실제 독립 근거가 있으면 As-Is checking으로 남는다. feat/goal-plan 고정 SHA의 plan은 checking→checking, resolved→resolved를 별도로 매핑하고 goal-plan은 shown.achievement를 전달한다. 이 경로에서 checking을 도달로 승격하지 않는다. 후속 feat/goal-achievement 브랜치의 현재 구현 상태를 결론에 섞지 않았다. | 도달·평가 판정 로직 개선 근거(코드 수정 대상) | 없음(코드 검증) |
| D4-handoff-4-M7 | 정본 확인 키는 중심 TASK 한 개에만 부여된다 | 정본 확인 키는 중심 TASK 하나만 받는다. 창작 키도 task별 하나로 분리하며 별도 납품 경로를 통해 추가된다. V4의 정본 키 0, option-restate→E3 한 개를 실제 함수로 확인했다. 한 능력을 두 다른 TASK로 관찰할 수 있는 R3/R4 측정 중복 문제까지 해결하는 가드는 아니다. | 도달·평가 판정 로직 개선 근거(코드 수정 대상) | 없음(코드 검증) |
| D4-N1-approval-policy | 저장소 SQL은 조건을 갖춘 AI 결정을 허용한다 | 저장소 SQL은 human OR revision/Gold 해시 결속 AI 결정 OR 제한된 DCP source_policy를 허용한다. 따라서 사람 승인만 남았다고 일반화하면 실행 정책과 충돌한다. SQL 존재를 현재 DB 적용·개별 자료 승인 완료로 읽지 않는다. DCP 대안은 guided_practice 한정이다. | 도달·평가 판정 로직 개선 근거(코드 수정 대상) | 없음(코드 검증) |
| D4-N2-same-task-different-score | 같은 R5 TASK의 창작/기출 도구 채점 범위가 다르다 | R5 창작은 선택+중심 문장만 정답 조건이고 기존 claim-support는 근거+관계도 필수다. r5-cm-ind-1에서 supportOk=false/relationOk=false/isCorrect=true를 재현했다. 자체 명시 계약이라 구현 버그로 단정하지 않지만 두 키를 동일 측정 범위로 합치면 충돌한다. | 도달·평가 판정 로직 개선 근거(코드 수정 대상) | 없음(코드 검증) |
| D4-N3-observation-vs-need | R2/E3 관찰 제한과 공통 약점 확정 규칙이 충돌한다 | R2의 관찰 근거 내역만 및 E3의 함정 선택만으로 약함 판정 금지 제한을 공통 약점 확정에 반영하지 않는다. E3 lure 정오 false 두 개는 공통 실패 규칙에 들어갈 수 있다. | 도달·평가 판정 로직 개선 근거(코드 수정 대상) | 없음(코드 검증) |
| D4-N4-future-passage-duplication | 세트 validator는 본문 해시 중복 대신 passageGroup을 검사한다 | validateAuthoredSet은 passageGroup 문자열의 교수/평가 혼합을 검사한다. 실제 본문 해시 중복을 이 함수에서 검사하지 않는다. 공급 시 노출 원장의 같은 지문 방어는 별도로 있으므로 제품 전역 방어가 없다고 확대하지 않는다. | 도달·평가 판정 로직 개선 근거(코드 수정 대상) | 없음(코드 검증) |

## 금지(engine_handoff_exclusions)

- 개별 AI 링크를 NeedRank·진단·성취 입력으로 승격하지 않는다
- R3 11개와 다른 unclear 항목은 보류한다
- raw_block null로 삽입 262개 전체를 제외하지 않는다
- 원천 권리 기록 부재를 법적 불가로 바꾸지 않는다
- 정본 키 존재를 현재 활성·적격·납품 완료로 바꾸지 않는다

## 수신 측 요청

1. 수신 ACK  2. 13건 각각 현재 goal-plan 코드 대비 입력 검토(이미 반영 / 반영 필요 / 해당 없음)  3. 미승인 기출 관련도를 확정 NeedRank 로 쓰는 경로 유무

## 수신 ACK (2026-10-23 · vocaflow-01 · goal-engine T-0093 · feat/goal-outcome @9f23f9b9b)

- 이미 반영 1: D4-handoff-2-M1 (goal-outcome 은 achievement==='resolved' 만 셈, 재처방은 achievement 불변).
- 반영 필요 3 — 상류(skill-diagnosis/lifecycle·채점) 수정 대상, 이 브랜치 범위 밖: D4-handoff-1(다른 날·지문 다양성·전이) · D4-N2(창작/기출 채점 범위 통합 금지) · D4-N3(E3 lure 2실패가 약점 확정 → 재처방 「바로잡기」 오발 위험 잔존).
- 해당 없음 9: D1 4 · D2-R3 · D3 · D4-M7 · N1 · N4.
- 미승인 관련도 → NeedRank: goal-batches/b2-v2/R3 링크 경로 없음(To-Be 는 csat_dx_item_attribute · type_id 링크 · csat_dx_option_trap 만). 단 그 기존 경로에 검수 상태 필터가 없음 — 검수 여부 unclear.

## 인계 계약 변경 권고 (2026-10-23 · 데이터 담당 vocaflow-77 결정 · 근거 T-0117)

- v2.5(주 TASK 경계 규칙) 미봉인 · 실험 종료, CONTRACT_V2_5 「사용 금지」 표시. 확대는 v2.4 로 계속.
- 같은 문항 링크 일치 κ .92–.97 인데 주 TASK 갈림은 E2 · E3 둘 다 direct 일 때 「주」 이름 붙이기에서만 남았고 규칙 세 번 뒤에도 남음 → 문항 고유 모호함.
- **권고: 엔진이 TASK 관련도를 쓸 때는 주 TASK 단일값이 아니라 direct 링크 집합을, 주 TASK 는 설명 문구에만.** 공개 relevance=unknown · NeedRank 입력 금지는 그대로 — 지금 제품 동작 변경 없음. 실제 연결은 사람 검수 · 승인 이후 별도 결정.
