# Factory I1 — 보안 감사(노출 · 승인 · 권한 · 동시성)

> 대상: C · B 승인안과 I1 delta(S · P · D3). **미적용** — 근거는 개발 DB 읽기 전용 실측(2026-10-17)과 격리 PostgreSQL 시험뿐이다.
> 패키지: [FACTORY_I1_APPROVAL_PACKAGE.md](./FACTORY_I1_APPROVAL_PACKAGE.md)

## 1. D1 — 학습자 노출(G) 판정의 누락

평가 역할(독립 확인 · 전이 · 지연 확인) 공급은 「학습자가 그 문항을 본 적 없음」이 전제다. B 의 `supply_learner_exposure` 는 `csat_dx_*` 만 봤다.

**개발 DB 실측(사용자×문항 쌍, 2026-10-17)** — 각 원장에서 노출인데 판정기가 놓친 쌍:

| 원장 | 쌍 | B 가 놓침 | I0 delta 가 놓침 | I1 |
|---|---:|---:|---:|---:|
| `csat_dx_response`(item_id 있음) | 84 | 0 | 0 | 0 |
| `learning_task_attempts`(G2 확인 · 적용) | 123 | **123** | 0 | 0 |
| `learning_sessions`(문항 화면 · 해설 · 공개) | 176 | **176** | 0 | 0 |
| └ `help_level = 'viewed_first'` | 55 | **55** | 0(현재 행은 모두 해설 시각도 있음) | 0 |
| `csat_trap_attempts` | 13 | **13** | **11** | 0 |
| `csat_session_attempts` | 1 | **1** | 0(같은 쌍이 다른 원장에도 있었다) | 0 |
| `csat_review_queue` | 1 | **1** | 0(같은 이유) | 0 |

구조적으로만 존재하는 누락(현재 0행이지만 생기면 새는 경로) — I0 delta 도 놓친 것:
- **삭제된 세션**(`deleted_at`): I0 은 `deleted_at is null` 만 봤다. 해설을 본 뒤 세션을 지우면 「안 봄」이 된다. I1 은 삭제 여부와 무관하게 센다.
- **`viewed_first` 만 있는 세션**(해설 시각 없음) · **도움 수신**(`help_received_at` · `help_server_at`).
- **문항 화면만 연 세션**(시도 · 해설 없음) → I1 `item_seen`.
- **G2 시도의 item_ref 가 비고 세션만 문항을 가리키는 경우** → 세션 조인으로 판정(현재 0행).
- **같은 지문의 다른 문항을 위 어느 경로로든 본 경우** → I1 은 모든 원장 + 응시 회차로 판정(B 는 dx 응답만).

판정 불가는 공급 거절: 문항 없음 · 인자 없음 · 노출 원장 7개 중 하나라도 없음(`to_regclass`) → `unknown`. 조회 오류는 예외 → 공급 트랜잭션 전체 실패. DCP 는 노출 원장이 없어 계속 `unknown`(평가 공급 HOLD — B 와 같음).

남은 한계: 공급 판정과 학습자의 첫 시도가 **같은 순간**에 일어나면(공급 트랜잭션이 노출 원장을 읽은 뒤 커밋 전 학습자가 시도) 노출된 문항이 공급될 수 있다. 노출 원장은 G2 writer 소관이라 이 패키지에서 잠그지 않는다. 공급 행 뒤에 시도가 있으면 G2 의 「도움 · 노출 뒤 첫 시도」 판정이 따로 막는다(LM-G1.4 T4 계약) — 숙달 판정으로 새지 않는다.

## 2. D2 — 승인 범위

| 경우 | 앱 계약(`supplyEligible`) | B | I1 |
|---|---|---|---|
| 평가 역할 · public 만 | 거절 | 거절 | 거절 |
| 평가 역할 · assessment 만 | 거절(public 필수) | **통과** | 거절 |
| 교수 역할 · assessment 만 | 거절 | **통과**(범위를 안 봄) | 거절 |
| public 철회 | 거절 | 기록 승인이 assessment 면 **통과** | 거절 |
| 다른 자격 행의 승인 | 거절 | 거절 | 거절 |
| 평가 역할의 기록 승인이 public 행 | — | 거절 | 거절(기록 승인은 assessment) |

## 3. 권한 · RLS

| 객체 | 읽기 | 쓰기 | 실행권 |
|---|---|---|---|
| 자격 · 승인 · 철회 원장(C) | 관리자 · 큐레이터 | 정의자 함수만 + writer guard | 쓰기 함수: authenticated(함수 안에서 관리자 확인) |
| 수요 · 줄 · 주문 · 이벤트 · 공급(B) | 본인 행 + 관리자 | 정의자 함수만 + writer guard | authenticated |
| 공용 등록부 · 링크(D3) | **관리자 · 큐레이터만** — 학습자는 다른 학습자와 같은 공장 주문을 공유한다는 사실도 못 본다 | 정의자 함수(관리자) + writer guard | authenticated(함수 안에서 관리자 확인) |
| `supply_learner_exposure` · `supply_delivery_valid` · `factory_product_order_is_current` · `supply_artifact_revision` | — | — | **public · anon · authenticated 회수**(정의자 함수 안에서만). 열어 두면 학습자가 남의 uid 로 노출 여부를 물을 수 있다 |
| `workspace_line_fulfillment` | 본인 줄 · 관리자 | — | authenticated(함수 안에서 소유 확인 — 남의 줄은 not owned 오류) |

- 새 · 바뀐 함수 10개 모두 `SECURITY DEFINER` + `set search_path to 'public'` + anon 실행권 없음 — PGlite 시험이 `pg_proc` 로 확인.
- 학습자 A/B 격리: B 가 A 의 줄에 공급 · A 의 충족도 조회 → 거절. `set role authenticated` 로 RLS 아래에서 A 의 공급 · 등록부 · 링크 · 남의 주문 0행.
- writer guard 는 서비스 키 직접 INSERT 도 막는다. 우회 = `vocaflow.supply_writer='rpc'` 를 일부러 켜는 것뿐(의도된 수동 복구로만, 운영 기록 필수 — B 원칙 유지).

## 4. 동시성 · 멱등(실제 PostgreSQL 17 · 다중 연결)

| 반례 | B 기준선 | I1 |
|---|---|---|
| 같은 공급 요청 키 동시 재전송 20 | 20/20 같은 id | 20/20 같은 id |
| 줄 수량 3 · 서로 다른 산출물 동시 공급 20 | **20행**(상한 없음) | 3행 |
| 공급 트랜잭션이 열린 동안 철회 | 즉시 커밋 | 대기(statement timeout) → 공급 커밋 뒤 철회 |
| 철회 트랜잭션이 열린 동안 공급 | **공급 통과** → 철회 커밋 → 철회된 승인으로 공급 1행 | 대기 → 철회 커밋 뒤 `approval revoked` |
| 같은 줄 동시 주문 20(다른 키) | 1 | 1 |
| 같은 공용 주문 revision 동시 등록 20 | — | 1 |
| 같은 등록 키 동시 재전송 20 | — | 20/20 · 새 행 1 |
| 링크 20 ↔ 새 revision 등록 경합 | — | 교착 0 · 다른 오류 0. **한계**: 이번 실행에서는 링크 20 이 모두 등록보다 먼저 잠금을 잡아 「not current」 거절 경로가 동시성 아래서는 실행되지 않았다(순차 경로는 PGlite 에서 확인) |

멱등 규칙: 같은 요청 키 + 같은 본문 = 이전 결과 · 다른 본문 = `23505`. 줄 · 주문 · 승인 · 공용 주문 id 순서로 잠근다(교착 방지 — 공급은 줄 → 승인, 철회는 승인만, 링크는 주문 → 공용 주문 advisory).

## 5. 이번에 찾은 결함(B · I0 · 저장소)

| # | 심각도 | 결함 | 처리 |
|---|---|---|---|
| S1 | **높음** | B 노출 판정기가 G2 · 세션 · 함정 · 복습 원장을 보지 않음(실측 300+ 쌍) | I1-S |
| S2 | 높음 | I0 delta 도 함정 시도 11쌍 · 삭제 세션 · viewed_first-only 를 놓침 | I1-S 가 I0 delta 를 대체 |
| S3 | 높음 | 승인 범위: 평가 역할 assessment-only · 교수 역할 아무 범위 통과 | I1-S |
| S4 | 높음 | 철회와 공급 경합 시 철회된 승인으로 공급 행 생성(실제 Postgres 재현) | I1-S 잠금 |
| S5 | 중간 | 공급 수량 상한 없음(수량 3 줄에 20행) | I1-S |
| S6 | 중간 | `delivered` = 공급 1행 → 요청 5 · 적격 2 도 완료 | I1-P |
| S7 | 중간 | 앱 `supplyFor` 가 교수 검수 전 해설을 `available` · `fully_supplied` 로 표시 | 앱 변경(이 PR) |
| S8 | 낮음 | 기존 `supply-concurrency.mjs` 가 수요 본문 v1 을 보내 0/7 로 멈춰 있었음(B 가 v2 요구로 바뀐 뒤 낡음) | v2 로 갱신 · 7/7 |
| S9 | 낮음 | 되돌리기 초안이 보존 조건 검사를 drop 사이에 끼워 둬, 비트랜잭션 실행기에서 D3 를 지운 뒤 P 검사에서 멈출 수 있었음 | 생성기에서 모든 검사를 맨 앞 · `begin/commit` |
