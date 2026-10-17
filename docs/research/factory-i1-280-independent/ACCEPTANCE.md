# PR #280 Factory I1 독립 보안·수용 검증

2026-10-17 · Codex · **개발 DB 쓰기 0**. DB migration·DDL·DML·사용자 생성/삭제·학습 API 제출을 실행하지 않았다. 임시 PostgreSQL 클러스터만 변경했다.

## 1. 판정과 기준

**제출본 REJECT → 수정본 ACCEPT_WITH_LIMITS(최종 CI/목적 리뷰 확인 전).** DB 적용 승인은 아니다. 실공급 E2E는 **BLOCKED**다. 실제 개발 DB의 C/B/I1 대상 10개 표와 공급 RPC가 없음을 직접 조회했다.

- 제출 HEAD: `e89ebac493841b6fbcd0ebf0cdda780361ae75d6`.
- 시작 main/제출 merge-base: `9c19f15b1fc911b13040dc01fe5a12fef5af592f`.
- PR #277 최종 HEAD: `4a853dca73da95df5872b7b45e28e97520be38a5`. 검사 중 2026-10-17 18:32 KST 병합됨. 병합 main `edcfa5f9570147ccea3ec2609f3d487b1be1562a`.
- I1-S는 I0 delta의 실행 가능한 D1과 주석뿐인 D2를 대체한다. **I0 delta 전체를 적용하지 않는다.** I0 D3 표 초안은 별도 I1-D3가 대체하므로, S 단독이 D3까지 포함한다는 뜻은 아니다. SQL 적용 순서 C→B→수정 S(한 트랜잭션), P/D3 각각 별도 승인.
- 수정 전후 동일 fixture를 사용한다. PostgreSQL `--submitted`는 git의 제출 HEAD에서 SQL을 읽는다. 정상 통과/의도된 B 결함/새 반례 실패를 구분한다.

## 2. 결함과 수정

| ID | 등급 | 제출본 반증 | 수정·잔여 제한 |
|---|---|---|---|
| R01 | P1 | 자격 supersede 후 옛 공급 `valid=true`, 새 공급과 supersede 경합도 통과 | 현재 자격·필수 축 재검사, 자격 공유 잠금. **역사 행 보존**, 새 자격·승인 자동 상속 금지 |
| R02 | P1 | 요청/공급 5 후 승인 3 철회에도 `delivered` 전이 성공 | 종결 시 유효한 해당 주문 공급만 수량으로 집계. 유효 2면 `partial`(공백 아닌 이유), 현재 부족 3. 종결 후 철회면 역사적 delivered는 유지 |
| R03 | P2 핵심 | 같은 Workspace/TASK/role의 이전 PLAN 공급 2·높은 seq를 신규 수요 3의 완료로 표시 | 전체 canonical 수요별 원장, 현재 Inspector의 canonical과 정확히 일치할 때만 표시. 다른 PLAN뿐 아니라 같은 PLAN의 다른 수요 ID도 섞지 않음 |
| R04 | P1 | DCP 권리/원천 적격성 실패 또는 기출 Reveal Gate 보류 후 revision 불변이면 계속 유효 | 기존 원천 RPC·Reveal Gate를 현재 시점에 재검사. 새 공급도 거절 |
| S10 | P1 | 필수 A축 `{}`에서 SQL NULL이 CHECK·IF NOT를 통과해 승인·공급 성공 | 축 validator와 역할 판정의 NULL을 false로, 공급에서 `IS NOT TRUE` |
| S11 | P1 | 주문 종료 트랜잭션이 열린 동안 공급 통과, 철회 중 delivered 종결 통과 | 공급/종결 줄→주문 잠금. 종결 자격/승인도 잠가 순서를 확정하고 대기 후 재검사 |
| S12 | P2 핵심 | S만 적용한 DB의 롤백이 미설치 D3 표에서 `42P01` | 중첩 IF로 부분 승인 지원. 롤백 끝에 공급 EXECUTE 회수 유지. partial/D3 행이 있으면 전체 거절 |
| CI01 | P2 | 제출 CI verify의 mock `rpc(fn,args)`를 RPC 감사가 실호출로 수집 | 테스트 callback 명칭 수정, 감사 가드 유지 |
| S13 | P1 | 개발 DB의 기본 표 ACL은 anon/authenticated ALL. INSERT/UPDATE/DELETE만 회수하므로 RLS를 우회하는 TRUNCATE로 공급 이력 삭제 가능(실제 PG에서 성공, 즉시 rollback) | S의 8개 표·D3 2개 표에서 ALL 회수 후 authenticated SELECT만 부여. TRUNCATE/REFERENCES/TRIGGER 포함 120개 ACL 조합 회귀. 실제 개발 DB에서는 읽기 감사만 실행 |
| AUTH01 | P1 | 실제 `is_admin_or_curator()`는 프로필 없는 로그인 사용자에게 NULL. `IF NOT NULL`이 자격/출시 승인을 허용함(I0 독립 감사와 동일 재현) | S에서 C 자격·승인·철회 및 B 전이 가드를 완전한 함수로 대체하고 P/D3도 `IS NOT TRUE`. 실 helper 의미를 fixture에 반영, 여섯 관리자 RPC와 S-only/롤백 검사 |
| REVIEW01 | P1 | 목적 리뷰: 빈 D3 검사와 DROP 사이 동시 등록이 커밋하면 원장을 지울 수 있음 | 검사 전 factory_order·설치된 D3 표 ACCESS EXCLUSIVE 잠금. 실제 PG에서 등록을 먼저 열고 롤백을 경합시켜 이력 보존 검사 |
| REVIEW02 | P2 핵심 | 목적 리뷰: 세션 회차와 응답 문항 회차가 다른 B 입력에서 공유 지문 노출을 놓침 | 직접 dx_response→session 조인 경로 복원. public+assessment 모두 승인된 상태의 평가 공급도 거절하는 회귀 추가 |

추가 hardening: C/B/I1 정의자 search_path의 `pg_temp`를 마지막에 명시한다. public 스키마 CREATE는 개발 DB에서 anon/authenticated 모두 false였다. 초기 임시 표 사칭 시험은 단순 EXISTS helper에서 양쪽 거절이었다. 실제 helper의 NULL 의미를 반영한 후 제출본은 관리자 가드를 지나갔다. 이는 AUTH01과 같은 원인이며 별도 권한 상승으로 중복 세지 않는다.

## 3. I1-S 보안·수용 범위

- G2, 학습 세션, 함정/세션 시도, 복습 큐, 삭제 세션, viewed_first, 도움, 공유 지문, 다른 학생의 노출, 누락 원장은 PGlite 및 PostgreSQL fixture로 검증한다. `none`만 평가 공급 가능, missing/unknown/error는 닫힌다. DCP 평가는 노출 원장 공백 때문에 계속 HOLD다.
- public/assessment 양쪽 승인, 같은 qualification 결속, 철회, TASK/role/revision, 공급 상한, 요청키 재전송은 기존 시험을 유지한다. 철회가 먼저면 공급이 기다린 뒤 거절, 공급이 먼저면 철회가 기다린다.
- PostgreSQL의 실제 `SET ROLE authenticated`에서 다른 학생의 10개 원장 조회 0행, 관리자 승인 RPC 거절, anon mutation/충족도 EXECUTE 없음. PGlite는 내부 판정기 직접 호출 금지·직접 INSERT·RLS도 검사한다. 스텁 권한 helper는 실제 개발 DB의 계정 상태 구현을 대체하는 시험이라는 한계가 있다.
- 원자성: 실패하면 RPC 전체 rollback, 동일 request_key/동일 본문은 같은 결과, 본문 다르면 거절. 과거 공급 ID 재시도는 과거 사실 반환이며 현재 유효성 재승인이 아니다.
- 조회 시점 이후 권리 변경은 다음 조회에 반영한다. 노출 원장과 신규 학습 제출까지 한 트랜잭션으로 잠그는 전체 학습 시스템 직렬화는 이 패키지 범위가 아니다. 기존 자료를 읽은 뒤 공급을 재승인하는 의미로 `supply_delivery_valid`에 G를 넣지 않는다.
- same-line/same-artifact unique는 유지한다. supersede/철회된 역사 행을 삭제해 같은 산출물을 재공급하지 않는다. 대체 산출물 또는 새 수요가 필요하다.

## 4. I1-P·D3 정책

I1-P 수정 정책은 수용한다. `delivered`는 **전이 시점에 유효한 해당 주문 전량**, `partial`은 유효 일부 후 이유와 함께 종결, 현재 충족도는 줄 요청−현재 유효 공급이다. 부족분 재주문은 현재 부족 이하, PLAN 변경은 기존 주문을 삭제/자동 취소하지 않는다. P-4는 「과거 자격의 유효성 자동 유지」를 철회하고 역사와 현재 자격을 분리한다. DB-2 적용 승인은 별도다.

**I1-D3/DB-3 보류 유지.** 발행 주체/등록 경로, 공장 정본 hash 직렬화, share_key와 개인 요구 결속, 공유 생산량의 배분 단위·상한이 확정되지 않았다. SQL의 hash 형식/FK/현재 revision/TASK/role 검사 및 동시 등록·링크 통과만으로 생산량 보증을 주장할 수 없다. 이미 있는 링크의 멱등 반환은 현재 revision 적격 보장이 아니다.

## 5. 검증 증거와 한계

정확한 SQL/파일 hash·실행 로그에서 추출한 실패/통과 기록은 [EVIDENCE.json](./EVIDENCE.json), 브라우저 DOM 기록은 [browser/results.json](./browser/results.json).

| 계층 | 결과 |
|---|---|
| PGlite 제출+독립 R01/R02/R04 | 37 통과/3 실패. R03 store 6 통과/1 실패 |
| PGlite 추가 회귀 | S-only rollback 실패 `42P01`, 기출 Reveal Gate 반례 실패를 보존 후 수정 |
| PGlite 수정 집중 | I1 **46/46**(기본 ALL·실 helper NULL·공유 지문 회귀 포함), store **7/7**, I0 계약 **77/77**. persist 13개 포함 광역 결과는 EVIDENCE의 run 기록 |
| 실제 PostgreSQL | **17.10**, 동일 33조건에서 제출 **20/33**, 수정 **33/33**. 기본 ALL·실 helper NULL·롤백 등록 경합 포함. 원장 삭제 반례는 로컬 DB에서만 실행 |
| 기존 B PostgreSQL | 기존 동시성 7/7. B만의 상한·철회 반례는 별도 기대 실패로 보존 |
| PC Chromium | 1280·1440, 실제 TaskInspector·공급/수요 엔진의 합성 읽기 fixture. 이전 수요 제외/부분·완료/미설치/검수 전 열람/키보드 접기/가로 넘침 검증. 외부 요청 0. 전체 앱 DB E2E와 구분 |
| 기존 R5·T1–T4·PLAN/Workspace | 전체 CI 단위 회귀에 포함. 개발 DB에 계정·학습 기록을 쓰는 기존 브라우저 스크립트는 실행 금지 범위라 재실행하지 않음 |
| 실제 개발 DB | PostgreSQL 17.6 읽기 감사만. 대상 10개 표/충돌 함수/복합 제약 없음. 의존 노출 열·원천/Reveal RPC 정의 확인. 실제 공급 E2E **BLOCKED** |

## 6. 병합과 정확한 승인 범위

- 안전 병합은 최종 HEAD에서 필수 verify/build/e2e/e2e-gate-faultclosed와 목적 리뷰, 최신 main 통합을 확인한 뒤에만 판정한다. 실패/대기 체크를 성공으로 읽지 않는다. 이 검증은 main 병합이나 DB 적용을 실행하지 않는다.
- DB-1: 최신 package §2의 정확한 C/B/수정 S SHA-256, 허용 객체(validator·search_path·8개 새 표 권한 회수 포함), 한 트랜잭션 및 적용 전/후 읽기 검증·보존/롤백에 대한 **명시 승인**. I0 delta 제외. S만으로 B의 부분 납품 정책까지 고친 것은 아니므로 실주문 운영은 DB-2까지 확인 후 권고.
- DB-2: 수정 P-1/P-2/P-3/P-4, partial CHECK/index, `factory_order_open`/`factory_order_transition`/`workspace_line_fulfillment`의 정확한 hash 및 별도 DB 적용 승인.
- DB-3: D3-1~3 및 share_key/공유 수량 조건 확정 후 정본 SQL/hash를 다시 검증하고 승인. 현재 보류하며 DB-1/2 승인에 포함하지 않는다.
- 적용 후 실공급 E2E를 실행하려면 합성 계정/학생 기록 쓰기도 그 별도 작업에서 승인한다. 개발 DB 쓰기는 이번 검증에서 실행하지 않았다.
