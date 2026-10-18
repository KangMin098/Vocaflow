<!-- docs/research/final-independent-20261018/AUTHORED_SQL_REVIEW.md -->
# 창작 공급 보류 SQL 독립 반례 — REWORK

대상: 총괄 세션 커밋 b4fbf4d5c의 supabase/migrations/_pending_authored_supply.sql. 미제출·미적용 개발 스냅샷의 조기 검증이며, 실제 개발 DB의 배포 결함이라고 주장하지 않는다. 기존 DB-1/2/I2/G2 위에 이 SQL을 올린 격리 PGlite에서 재현했다. 개발 DB 쓰기0.

| 원장 ID · 등급 | 재현 | 실제 결과 | 기대 동작 |
|---|---|---|---|
| FI-002 · 핵심 P2 | authored_item을 instruction/guided_practice로 등록한 뒤 같은 ref의 FQ를 independent_check로 기록하고 해당 자격을 납품 | 납품 성공·supply_delivery_valid=true. 등록 행의 role_class/intended_role이 공급 시점에 결속되지 않음 | 등록 목적·역할과 FQ/수요/납품 역할이 맞아야 함. 교수 산출물을 평가로 재자격화하는 우회 거절 |
| FI-003 · P1 | 정확히 같은 body와 Gold를 교수/평가용으로 등록하되 passage_group 문자열만 다르게 줌. 교수 ref를 먼저 열람한 뒤 평가 ref를 납품·G2 수행 | 노출 none, 납품 허용, first_exposure=true/evidence=true. 이미 본 동일 본문이 새 독립 근거가 됨 | 지문 정체성은 등록자의 임의 그룹명만 믿지 않음. 동일 정규화 본문의 교수/평가 혼용을 등록/공급에서 차단하고 노출은 실제 지문 정체성으로 판정 |
| FI-004 · 핵심 P2 | rights basis=licensed, scope={display,transmit}만 있고 store/assess는 없는 산출물을 independent_check로 납품. Gold 사람 결정은 따로 존재 | 납품 성공·현재 유효=true. 권리는 display/transmit만 확인하고 Gold의 assess가 이용 권리 범위를 대신함 | 실제 이용 동작의 권리 범위를 확인. 사람 Gold의 assess는 평가 이용 권한을 대신할 수 없음. 최소한 평가 역할은 rights assess 범위가 필요 |

[실제 격리 출력](./authored-supply-counterexamples.log) · [재현 실행기](../../../apps/web/scripts/final-independent/probe-authored-supply.ts). 실행기는 공유 Git object의 고정 owner commit에서 SQL을 읽는다. 다른 환경에서는 해당 커밋을 먼저 fetch해야 한다. 이 스냅샷의 정상 시험 통과는 위 조합을 검증하지 않았다.

수정 소유: Claude-VOCAFLOW-FINAL-OWNER. 이 독립 세션은 SQL을 수정하거나 적용하지 않는다. 수정 HEAD가 오면 같은 반례의 차단과 정상 역할·적법 범위·새 지문의 공급/수행을 함께 확인한다. 실제 PostgreSQL 동시성은 별도로 검증해야 하며 PGlite 한 연결 결과로 대체하지 않는다.

## FI-006 · 핵심 P2 · OPEN — 동일 지문 묶음 동시 납품 중복

위 세 PGlite 반례와 별도로 PostgreSQL **17.10의 두 연결·동시 트랜잭션**에서 확인했다. 동일 학습자에게 서로 다른 Workspace/수요 줄·산출물 ref이지만 같은 passage_group인 두 평가 자료를 준비했다. 첫 연결의 납품 INSERT를 커밋하지 않은 채 두 번째 연결로 납품했다. 두 번째도 성공했고 두 트랜잭션을 커밋한 뒤 납품은 2행이었다. 두 번째가 기다리거나 이미 공급된 같은 지문임을 거절하지 않았다.

새 exposure 판정은 같은 묶음의 선행 납품을 노출로 세지만, 공급 시점의 묶음 단위 직렬화가 없어 다른 수요 줄의 동시 요청은 서로의 미커밋 행을 보지 못한다. 이 SQL의 기존 순차 ‘같은 묶음 두 번째 거절’ 시험으로는 이 경합을 잡지 못한다. 기대: 실제 지문 정체성과 학습자 단위에서 동시 공급을 직렬화하고, 앞선 커밋 뒤 최신 노출 상태를 다시 판정한다. 한 수요 줄만 잠그는 것으로 충분하지 않다.

[실제 PostgreSQL 출력](./authored-concurrency.log) · [두 연결 실행기](../../../apps/web/scripts/final-independent/probe-authored-concurrency.ts). 서버는 독립 세션의 전용 데이터 디렉터리에서만 띄웠고 종료했다. 개발 DB 접속·쓰기 없음. 첫 실행기의 pg_ctl stdout pipe 대기로 인한 인프라 실패는 PASS로 세지 않았으며, 자식 pipe 상속을 제거한 뒤 별도 새 클러스터에서 위 결과를 얻었다.
## FI-002 추가 범위 · 다른 TASK의 자격 혼입

`--task-only` 모드로 기존 역할 반례를 반복하지 않고 등록 TASK↔자격 TASK 경계를 추가 확인했다. `r.central_meaning`/`authored-central-meaning`으로 불변 등록한 평가 자료에 `r.reference` FQ를 만들고 해당 TASK의 수요에 납품했다. **공급 성공·현재 유효=true**였고, 같은 자료를 수행한 뒤 G2 결속에서야 `attempt task key does not map to delivery TASK`로 거절됐다. [관찰값](./authored-task-mismatch.json).

따라서 FI-002의 기대 계약은 등록 행의 `task_id/task_key/role_class/intended_role`과 FQ·수요·납품의 결속까지 포함한다. 정상 G2가 마지막 단계에서 거절하는 것은 긍정적인 방어지만, 학습자에게 맞지 않는 TASK 자료를 유효한 공급으로 제공하는 앞단 오류를 해결하지는 못한다. 같은 산출물↔자격 결속 결함의 추가 조합이므로 새 ID로 중복 제출하지 않는다. 등록자의 임의 TASK 재자격화는 공급 전에 거절되어야 한다. 실제 개발 DB 쓰기 없음.
