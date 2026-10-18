# v6.2 P-F8b · c — 승인안 B · C 보강 · 실제 Postgres 동시성 · FQ1.1 인수

> 상태: **DB 미적용.** 보강한 보류 SQL 을 격리 Postgres 두 종류에서 실행했다 — PGlite(WASM, 연결 1) 테스트 + **실제 PostgreSQL 17 다중 연결**(로컬 임시 클러스터).
> 개발 DB · 학습자 기록 · 연구 원장 무변경. 학습자 효과 주장 없음.

## 1. B 에서 고친 결함

| # | 결함(P-F7 판) | 고침 | 근거 |
|---|---|---|---|
| B-1 | 공급이 **없는 DCP 문항**을 막지 못했다 — `select ref_id … ; if v_art is not null and not eligible` 이라 행이 없거나 원천이 null 이면 원천 검사를 **건너뛰었다** | `supply_artifact_revision(kind, ref)` 가 종류별 **실제 행**에서 현재 revision(내용 해시)을 계산. 없거나 원천 null · 기사 아님 · 지원 안 하는 종류면 null → 공급 거절. 원천 null 은 부적격 | PGlite: 없는 문항 · 원천 null · textbook_activity 거절 |
| B-1 | 검수 뒤 문항 내용이 바뀌어도 공급됐다 | 자격 revision ≠ 현재 내용 해시면 거절(「검수 뒤 내용이 바뀜」) — 이전 검수 상속 금지 | PGlite: answer_key 변경 뒤 거절 |
| B-2 | 평가 역할 G 가 「시도 기록 없음 = 미노출」이었다 | `supply_learner_exposure` — R5 기출(csat_item): 그 문항 응답 · **같은 회차 응시** · **정규화 동일 지문**(공백 · 대소문자) 응답 → 노출. DCP: 해설 열람 · 힌트 · 같은 기사 다른 문항 기록이 없으므로 `unknown` → **새 DCP 직접 평가 HOLD** | PGlite: R5 none 공급 · attempted · exam_seen · shared_passage_seen 거절 · DCP 평가 unknown 거절 |
| B-3 | 같은 request_key 재전송이 **본문을 비교하지 않고** 이전 결과를 성공으로 돌려줬다(P-M2b 계획 저장과 같은 종류) | `factory_order_open`(줄 · 이유 · 수량) · `factory_order_transition`(기대 상태 · 목표 · 이유 · 실행 · 자격) · `workspace_delivery_record`(줄 · 주문 · 자격 · 승인) — 다르면 거절 | PGlite 6건 |
| B-3 | 같은 키 동시 재전송이 「열린 주문 있음」으로 실패할 수 있었다(요청 키를 줄 잠금 **전에** 봄) | 줄 잠금 → 요청 키 확인 순서로(설계 검토로 고침) | 실제 PG: 동시 재전송 20/20 같은 id |
| B-4 | 서비스 키 직접 INSERT 가 검사를 우회해 `delivered` 주문 · 승인 · 공급 행을 만들 수 있었다 | 9개 표 BEFORE INSERT 가드 — 정의자 함수가 켠 트랜잭션 설정(`vocaflow.supply_writer`)이 없으면 거부. 주문은 requested/0 으로만 시작, 이벤트는 주문의 seq+1 · 현재 상태에서만 이어짐(누락 · 중복 거부). 수요 · 줄 UPDATE/DELETE 금지 | PGlite: 직접 INSERT 3종 · 끊긴 seq 거부 |
| B-5 | 추가 전용 트리거가 **계정 삭제 cascade 까지 막았다** | 부모 FK cascade(`pg_trigger_depth() > 1`)로 오는 DELETE 만 허용, 직접 DELETE 는 거부 | PGlite: 계정 삭제 후 주문 0 |
| C | 승인 철회 함수가 없었다(직접 INSERT 뿐) | `content_release_revoke(approval, reason)` · 자격 · 승인 · 철회 직접 INSERT 가드 | PGlite |

서비스 키가 설정을 **일부러** 켜면 가드를 넘을 수 있다 — 그것은 「의도된 수동 복구」로만 쓰고 운영 기록에 사유를 남긴다. 실수로 우회되는 경로는 없다.

사용자 · 요청 키: 키 공간은 사용자별(`unique(user_id, request_key)`) — 다른 학습자의 같은 키는 별개 주문(PGlite).

## 2. 실제 PostgreSQL 다중 연결 동시성 — 7/7

`node scripts/csat/map/v62/supply-concurrency.mjs --deps <임시 폴더>`(embedded-postgres 17.10 · pg 8.13 을 임시 폴더에만 설치, 저장소 의존성 아님). 임시 클러스터를 띄우고 끝나면 지운다.

| 시나리오(동시) | 결과 |
|---|---|
| 같은 수요 기록 20 | 수요 1 · 줄 1벌 · 20/20 같은 id |
| 같은 줄 · 다른 키 주문 20 | 주문 1 · 나머지 「열린 주문」 |
| 같은 키 재전송 20 | 20/20 같은 주문 id |
| 같은 기대 상태 · 다른 목표 전이 20 | 성공 1 · 이벤트 1 · 주문 seq = 이벤트 seq |
| 같은 자격 대체 10 | 성공 1(선형 이력) |
| 같은 줄 · 같은 산출물 공급 10 | 공급 1 |
| 철회 커밋 뒤 공급 | 거절 |

한계: 로컬 임시 클러스터 + 스텁 의존 객체다. 개발 DB(Supabase · 실제 RLS · 실제 데이터 크기)에서의 동시 실측은 **승인 뒤 실행 대상**으로 남는다.

## 3. FQ1.1 인수(P-F8c)

`scripts/csat/map/v62/import-fq11.mjs` → `fq11-candidates.data.json`(16개 · 축별 상태 · 방법 · 검토 revision · 근거 sha256 · 이유, **로컬 경로 · 원문 제외**). `fq11.ts` 가 원장 기록 입력으로 바꾼다.

- 16 = 연구 4(설명 역할) + DCP 12(지도 연습). A · E · F · G · H 는 전부 unknown 그대로 — 원천 · Gold 결속 값을 지어내지 않는다.
- 원장 기록 16/16 성공 · **승인 0/16**(A · F · H 미통과) · 앱 판정도 승인 가정 시 공급 0.
- DCP 수정본 revision(연구 revision + 산출물 해시) ≠ DB 문항 현재 내용 해시 → 수정본이 적재 · 재검수되기 전엔 공급 함수가 거절한다.
- 연구 활동은 제품 표가 없는 종류 → 공급 불가(지원 공백).
- 기존 R5(검수된 확인 과제)는 FQ 행 유무와 무관 — `supplyFor` 기존 경로 · 테스트 그대로.

## 4. 적용 순서(승인 뒤) — 변경 없음

C → B → 앱 연결. 적용 뒤: `/db-checkpoint` 전후 · 이 테스트와 같은 시나리오를 검증 계정으로 트랜잭션 · rollback · 개발 DB 두 연결 동시 시험.
