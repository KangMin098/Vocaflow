# Factory I1 — 개발 DB 배포 패키지(DB-1 · DB-2)

> **상태: 패키지 완료 · 미적용.** 개발 DB(`jajenrevcbmrpaliomxv`)에는 읽기(SELECT)만 했다. migration 이력 · DDL · DML 0.
> 승인 범위와 SQL 정본은 [승인 패키지](./FACTORY_I1_APPROVAL_PACKAGE.md) · [독립 수용](../../research/factory-i1-280-independent/ACCEPTANCE.md)이 정본이다. 이 문서는 **그 SQL 을 어떻게 안전하게 적용하는가**만 다룬다.
> 격리 PostgreSQL 통과는 개발 DB 적용 성공이 아니다. 실제 적용 · 검증 결과는 이 문서 §11 에 적용 뒤 기록한다.
> **DB286 독립 검증 후 새 정본**: 최초 제출은 REWORK. 최신 main(#283)의 B NULL 버전 검사 보완과 배포 보안 수정으로 전체 SHA가 바뀌었다. 아래 §2가 현재 배포 정본이다. 기존 승인/이전 전체 SHA는 승계하지 않는다. I2 annotation binding은 이 파일들에 포함하지 않는다. [독립 판정](../../research/factory-i1-deploy-286-independent/ACCEPTANCE.md).

## 1. 한눈에

| 단계 | 파일 | 내용 | 적용 조건 |
|---|---|---|---|
| **DB-1** | `supabase/migrations/20261017200000_factory_i1_db1_supply_foundation.sql` | C → B → I1-S 원본 바이트 + 가드 | 사용자 명시 승인 · preflight 차단 0 |
| **DB-2** | `supabase/deploy/factory-i1/db2/20261017200100_factory_i1_db2_partial.sql` | I1-P 원본 바이트 + 가드 | DB-1 실DB 검증 로그 + 별도 승인. **`supabase/migrations` 밖** |
| 러너 | `scripts/db/factory-i1/deploy.mjs` | check · dry-run · preflight · apply · verify | — |
| 되돌리기 | `supabase/deploy/factory-i1/db1-restore.sql` · `db2-restore.sql` | 커밋 뒤 단계 되돌리기(보존 조건 선검사) | 장애 시 별도 승인 |

**쓰지 않는 경로**: `supabase db push`(아래 dry-run: 승인 밖 345개를 함께 민다) · MCP `apply_migration`(자기 시각으로 버전을 새로 매겨 이력 해시 대조가 깨진다) · scratchpad 임시 apply 스크립트 · transaction pooler(6543).

## 2. SHA-256 검증표

| 대상 | sha256 | 비고 |
|---|---|---|
| C `_pending_workspace_supply_c_qualification.sql` | `dd940568ef7170212bf23ac9f7fb89bb090e8f529eeb4c26bb9ccdbc1e503f66` | 정본(PR #280) — DB-1 세그먼트 C |
| B `_pending_workspace_supply_b_orders.sql` | `2957ecf73c4399f81971581769021b30eb69c1141c29a443de62a5aa4506aa02` | #283 NULL 버전 거절 1줄 보완 — 세그먼트 B |
| I1-S `_pending_workspace_supply_i1_safety.sql` | `cc3d91001fc21800171c8210c3142ea9d6ef35facb7df877f88e4f0a97a3b6de` | 정본 — 세그먼트 S |
| I1-P `_pending_workspace_supply_i1_partial.sql` | `79807c38244982389ad2eb25b36350bc7121a84cc10b5ab54a1293b758e95041` | 정본 — DB-2 세그먼트 P |
| **DB-1 migration 전체**(104,441 B) | `061a48a8b50b956762dedf171d3a8949d4f9bae4da4058b41d52227eb767c624` | `--confirm-sha` 값 · 이력 statements 해시 · 새 승인 대상 |
| **DB-2 migration 전체**(32,678 B) | `2165015d063ff67a56806e57dabbaa6aa7fe2bd07e8608beaa8a9323fba8896b` | 〃 · 별도 승인 |
| `db1-restore.sql` | `386d065f310977967143e634f52fb92e3745752597f8529b2f9fec58a24015a3` | 생성물 |
| `db2-restore.sql` | `1c00d3cfdf96891daf76066c4e83e5d374d4974357299997fe8d3484fe4e7b61` | 생성물 |
| `db1-verify.sql` · `db2-verify.sql` | `bc9e040b297b226605199d610537e4b6218c06c0498f517685442d0e19b57e42` · `8bb55239198575a1a7d89cb061bb4dd0c3ec24d623de3f4bd92cec8964abf739` | 생성물(읽기 전용) |
| `preflight.sql` | `c1a0152baaadf202ad1c2f9ed7be3dfffabcde8ad284564be1daea7be59ad0c2` | 생성물(읽기 전용) |
| `MANIFEST.json` | `ff1cac064d2cb0e9c343d79b6177dda743ecfab47afd3bf3532a03ddeb61a0a9` | 세그먼트 오프셋 · 허용 목록 |

세그먼트는 `-- >>> VF-SEGMENT <id> … sha256=… bytes=…` 다음 바이트부터 `-- <<< VF-SEGMENT <id>` 앞까지가 원본과 **바이트까지 같다**. `node scripts/db/factory-i1/deploy.mjs check` 가 정본 4종 SHA · 세그먼트 · 생성물 7개를 매번 다시 대조한다(보조 생성물 5개 포함 · 1바이트 변조 거절 — 격리 A3). 손으로 고치지 않는다 — 바꾸려면 `node scripts/db/factory-i1/build.mjs`(정본 SHA 가 다르면 생성 자체가 거절된다).

## 3. migration 안의 가드(어떤 러너로 돌려도 지켜지는 것)

DB286 보완: 기존 helper 두 개는 적용 전 `pg_proc`의 모든 속성을 임시 표에 보관하고 `proconfig` 이외의 차이를 거절한다. 허용 객체 이름에 포함된다는 이유로 본문·ACL·소유권 변경이 통과하지 않는다. DB-1의 최종 `proconfig`도 아래 정확한 값으로 검사한다.

1. **프롤로그** — 이력(개발 DB 처럼 이력이 있는 DB): 같은 버전 있음 · DB-2 가 먼저 있음 → 거절. 전제 표 14 · 함수 5 존재. 대상 표 10(D3 2 포함) · 함수 17 부재. 권한 helper 두 개의 `proconfig` 가 실측값(또는 DB-1 뒤 값)이 아니면 `DEPLOY_BLOCKED[drift]`. `lock_timeout 15s` · `statement_timeout 120s`.
2. **원자성** — 프롤로그가 xid 를 표식하고 세그먼트 경계마다(프롤로그→C · C→B · B→S · S→에필로그) 같은 xid 인지 본다. 프롤로그는 **커밋 가드**(임시 지연 제약 트리거)를 걸어, 에필로그 검증을 통과하지 않은 트랜잭션은 COMMIT 자체가 실패한다 — 파일을 잘라 「프롤로그+C」만 커밋하려는 러너도 그 조각 전체가 롤백된다(격리 C7 · C8 · C9).
3. **에필로그** — 적용 전후 카탈로그 지문(시스템 스키마 밖 전부: 표/뷰/인덱스/시퀀스의 종류 · ACL · RLS · 소유자 · reloptions · 뷰 정의 / 열 · 열 ACL / 제약 / 함수 본문 · 설정 · ACL · 소유자 / 정책 / 트리거 / 스키마 / enum · 도메인 · 복합 · 범위 타입 / 기본 권한 / 확장 / 이벤트 트리거 / 주석 전체 해시, `scripts/db/factory-i1/catalog.mjs`) diff 가 허용 목록과 다르면 `DEPLOY_BLOCKED[allowlist]` 로 전체 롤백. 이어서 helper search_path 최종값 · 8표 RLS/권한 · 내부 판정기 실행권 · 쓰기 RPC anon 실행권 · 정의자 search_path 의 `pg_temp` 를 단언한다.
4. **지문 밖(알려진 한계)** — 데이터 행 · 시퀀스 값 · 통계 · `OWNED BY` · 역할 자체(`CREATE ROLE`)는 보지 않는다. C · B · S · P 원본에는 이런 문이 없다. 비교는 READ COMMITTED 라 적용 중(최대 120초) **다른 세션이 커밋한 DDL 도 diff 에 들어가 롤백된다** — 안전한 쪽 오탐이므로 종료 3 이면 동시 DDL 여부부터 본다.

## 4. 허용 객체 목록(정본: `scripts/db/factory-i1/spec.mjs` · `MANIFEST.json`)

격리 PostgreSQL 17 에서 원본을 올린 실측 diff 를 승인 패키지 §3 과 한 줄씩 대조해 고정했다.

| 단계 | 기존 객체 변경(이것뿐) | 새 객체 | 삭제 |
|---|---|---|---|
| DB-1 | **`public.is_admin()` search_path `public` → `public, pg_temp` · `public.is_admin_or_curator()` `public, auth` → `public, auth, pg_temp`**(본문 · ACL 불변, 되돌리기에서도 유지) | 표 8 · 그 인덱스/시퀀스 · 제약(새 표) · 함수 16 · 정책 8(모두 SELECT) · 트리거 17 · 기존 표 3개의 복합 고유키 3(제약 + 인덱스, 데이터 변경 0) | 0 |
| DB-2 | `factory_order_state_check`(+`partial`) · `factory_order_one_open_per_line`(닫힘에 partial) · `factory_order_open` · `factory_order_transition` | 함수 `workspace_line_fulfillment` | 0 |

개발 DB 이벤트 트리거 9개를 읽어 영향을 확인했다(`checkpoint/preflight-db1-20261017.json` 의 `event_trigger_review`): graphql 시퀀스 · NOTIFY · CREATE EXTENSION 전용 · pgsodium 은 라벨 붙은 `pgsodium.key` 에만 반응 — 허용 목록 판정에 영향 없음.

## 5. 적용 전 checkpoint(개발 DB · 읽기 전용 · 2026-10-17 20:50 KST)

`supabase/deploy/factory-i1/preflight.sql` 을 그대로 실행한 결과: `checkpoint/preflight-db1-20261017.json` · 판정 `checkpoint/preflight-evaluation-20261017.json`.

| 항목 | 값 |
|---|---|
| PostgreSQL · 이력 | 17.6 · 722행 · 최댓값 `20261014091841` · 그 뒤 0 · DB-1/DB-2 버전 없음 |
| 대상 | 표 10 · 함수 20 · 복합 고유키 3 · partial — 모두 없음 |
| 전제 | 표 14 · 함수 5 모두 있음 |
| helper | `is_admin` `{search_path=public}` · `is_admin_or_curator` `{"search_path=public, auth"}` · 둘 다 정의자 |
| 실행 역할(이번 읽기) | `postgres` — public CREATE · 이력 INSERT · helper/의존 표 소유 모두 true |
| 노출 원장 | G2 시도 129 · 학습 세션 358 · dx 응답 135 · 함정 83 · 세션 시도 1 · 복습 큐 1 · 문항 시도 20 · **G2 고유 쌍 123** · Workspace 0 |
| 의존 표 배타 잠금 | 0 |
| 카탈로그 지문 | 6,442행 · md5 `4ad41553…`(검토 반영 전 질의) — 확장 지문 질의도 실DB 에서 오류 없이 실행(rel 1,137 · col 3,267 · typ 36 · 기본 권한 37 · 확장 15 · 이벤트 트리거 9) |
| G2 쌍 중 csat_items 로 해석 안 되는 것 · 이력 열 | 0 · 6열(created_by · idempotency_key 포함) — 독립 검토 반영 뒤 재질의 |
| **판정** | **DB-1 차단 0** · DB-2 차단 5(DB-1 이력 · 객체 없음 — 의도대로) |

적용 당일 러너가 같은 SQL 로 다시 판정한다. 그 사이 새 원격 migration 이 생기면 `DEPLOY_BLOCKED[history]` — 카탈로그를 다시 보고 `--accept-remote-after <버전>` 으로만 넘어간다.

## 6. dry-run 기록(오프라인 · `checkpoint/dry-run-db1.json`)

| 항목 | 값 |
|---|---|
| 러너가 적용하는 것 | DB-1 파일 **1개** |
| 원격 최댓값 뒤의 로컬 migration | DB-1 하나뿐(예상 외 0) |
| `supabase db push` 가 밀 파일 | **346**(DB-1 + 이력 이름이 다른 옛 파일 345) → 경로 차단 |
| DB-2 위치 | `supabase/migrations` 밖 — 들어가면 `DEPLOY_BLOCKED[db2-coupled]`(격리 A8) |

## 7. 격리 검증(실제 PostgreSQL 17.10 임시 클러스터)

DB286의 첫 빈 Supabase CI에서는 기존 migration 롤백으로 helper 두 개가 사라져 DB-1이 전제 검사에서 안전하게 거절됐다. [최초 실패](../../research/factory-i1-deploy-286-independent/first-ci-failure.json)를 보존했다. CI 준비 단계만 `scripts/ci/factory-i1-prerequisites.mjs`로 두 함수의 **저장소 정본 본문과 ACL**을 복구한다. GitHub Actions의 loopback:54322/postgres에만 쓰며 query/포트 재정의는 거절한다. `check_function_bodies=off`는 이 fixture 트랜잭션에서만 사용하고, 미버전 원천 표가 없으면 실제 호출은 오류로 닫힌다. 새 표·운영 이력 생성이나 운영 migration 전제 완화는 없다. N03/N04 PostgreSQL 시험에서 이 경계와 원장 1행을 보존한 DB-2 적용을 확인했다. 전체 운영 스키마 복원 성공을 의미하지 않는다.

| 실행 | 결과 | 증거 |
|---|---|---|
| `isolated.mjs` 배포 절차 | **47/47** | `evidence/isolated-deploy.json` |
| `supply-i1-concurrency.mjs --via-deploy`(배포 DB-1+DB-2 위 기존 33조건: RLS 10원장 타인 0행 · 관리자 RPC NULL helper 거절 · pg_temp 사칭 거절 · anon 실행권 · TRUNCATE 우회 · G2 노출 9경로 · 동시성) | **33/33** | `evidence/concurrency-via-deploy.txt` |
| 같은 스크립트 원본 레이어 모드(회귀) | 33/33 | — |

배포 절차 47건의 범위: 오프라인(정본 · 세그먼트 · 변조 · 연결 대상 · dry-run 차단 5) · 정상 경로(preflight · 적용 · 허용 목록 diff 정확 일치 · 이력 해시 = 파일 해시 · 검증 SQL · G2 쌍 노출 판정 · 재적용 거절 · DB-2) · **원자성**(커밋 직전 실패 · S 끝 실패 · 허용 밖 추가/변경/삭제 · 소유자 변경 · 뷰 재정의 · 기본 권한 · 주석 · BEGIN 없는 단일 질의 · 비원자 러너 3형태 · DB-1 없는 DB-2 · DB-1 이력 변조 — 모두 카탈로그 · 이력 원상) · 대조군(B 만이면 G2 검증이 실패 — 검증 SQL 판별력) · **되돌리기**(DB-2 → DB-1 직후 카탈로그 바이트 일치 · 원장 행 있으면 거절 · DB-1 → 적용 전 + helper 강화만 잔존 · 재적용 가능).

**한계**: pgsodium 마스크 이벤트 트리거는 격리 DB 에 없어 재현하지 않았다(코드 읽기 판단뿐 — 반응하면 에필로그가 롤백한다). 의존 객체는 개발 DB 실측을 본뜬 최소 사본이다(실 Supabase 의 auth · 기존 정책 전체가 아니다). 실 helper 는 PR #280 과 같은 사본으로 재현했다. 개발 DB 에서의 RLS 실동작 · 실제 학생 데이터 노출 판정은 적용 뒤 §8 에서만 확인된다.

## 8. 배포 절차(실행자: 사용자 또는 DB 쓰기 승인을 받은 세션 — auto 모드 세션은 쓰기 차단 유지)

`--approved-by`는 감사 메타데이터이며 사용자 승인 증거가 아니다. 정책상 DB 쓰기가 허용된 실행 환경에서 **새 전체 SHA와 변경 범위의 명시 승인**을 먼저 받아야 한다. 공용 PreToolUse 훅은 `deploy.mjs apply`를 DB 승인 대상으로 분류한다. 러너도 자동 실행(`VFC_AUTOMATED_RUN=1`/`AGENT_GUARD_ASK=0`/CI), 비대화형 실행, `apply --isolated`를 접속 전에 거절한다. 허용된 실행자는 터미널에서 전체 SHA를 포함한 확인 문구를 직접 입력한다. 이 입력도 정책상 승인을 대체하지 않는다.

운영 접속은 PostgreSQL 프로토콜·DB `postgres`·명시적 포트 `5432`로 고정한다(생략 시 PGPORT 상속도 거절). query/fragment 옵션은 접속 대상·TLS를 바꿀 수 있어 거절한다. TLS 인증서를 검증하며 검증 실패를 완화하는 옵션은 없다. 적용 트랜잭션 안에서 이력 표를 잠근 뒤 preflight를 다시 실행해 승인 이후 이력 변화를 차단한다.

준비: 최신 `origin/main` 위의 이 PR 브랜치 · `npm i pg@8.13.1` 을 임시 폴더(`<deps>`)에 · 연결 문자열은 셸 환경 변수 `VF_DEPLOY_DB_URL`(직결 `db.jajenrevcbmrpaliomxv.supabase.co:5432` 또는 session pooler — 값은 출력 · 커밋하지 않는다).

```text
# 0. 오프라인
node scripts/db/factory-i1/deploy.mjs check
node scripts/db/factory-i1/deploy.mjs dry-run --stage db1 --remote-history <당일 이력 목록>
# 1. 적용 전 checkpoint — 읽기 전용(/db-checkpoint before factory-i1-db1 도 함께 · get_advisors security/performance 기록)
node scripts/db/factory-i1/deploy.mjs preflight --stage db1 --deps <deps>
# 2. 적용 — 한 연결 · 한 트랜잭션(본문 + 이력 1행) → 커밋 → 즉시 verify
node scripts/db/factory-i1/deploy.mjs apply --stage db1 --deps <deps> \
  --confirm-sha 061a48a8b50b956762dedf171d3a8949d4f9bae4da4058b41d52227eb767c624 --approved-by "<승인자 · 일시 · 승인 문구 위치>"
# 3. 적용 뒤 — /db-checkpoint after factory-i1-db1 · get_advisors 재기록 · 아래 §8-2
node scripts/db/factory-i1/deploy.mjs verify --stage db1 --deps <deps>
```

### 8-1. 차단 조건 → 어디서 막히나

| 조건 | 러너(쓰기 전) | migration 본문(쓰기 중) |
|---|---|---|
| 대상 프로젝트 불일치 | 연결 호스트/사용자 ref 대조 · 비이력 DB 거절 | — |
| SQL SHA 불일치 | `check` · `--confirm-sha` · 본문 재해시 | 세그먼트는 생성 시 정본 SHA 강제 |
| migration 이력 충돌 | 같은 버전 · 원격 최댓값 ≥ 버전 · checkpoint 뒤 새 원격 버전 | 프롤로그 이력 검사 |
| 예상 외 적용 대상 migration | dry-run(최댓값 뒤 로컬 파일 = DB-1 뿐) · 러너는 파일 1개만 | — |
| 미승인 객체 변경 | — | 에필로그 카탈로그 diff = 허용 목록 |
| DB-1 원자성 불명확 | transaction pooler 거절 · BEGIN…COMMIT 한 연결 | xid 트립와이어 · 커밋 가드 |
| 되돌리기 실패 | — | 되돌리기 파일이 보존 조건을 잠금 뒤 먼저 검사 · 실패면 아무것도 지우지 않음 |
| DB-1 검증 전 DB-2 | DB-1 verify 로그(같은 대상 · ok · sha) + 원격 DB-1 이력 해시 + 잠긴 적용 트랜잭션에서 DB-1 검증 재실행 | 프롤로그가 DB-1 이력 본문 sha 대조 |
| 적용 뒤 G2 검증 실패 예견 · 이력 열 다름 | `g2_pairs_unresolved` > 0 · 이력 열 누락이면 쓰기 전 차단 | — |
| 실행자 쓰기 권한 없음 | 정책 승인 · 훅 · 자동/비대화형 차단 · 승인 기록 · 역할의 CREATE/이력 INSERT/소유권 확인 | — |

종료 코드: **2** = 접속/적용 전 `DEPLOY_BLOCKED` · **3** = 적용 실패(롤백 확인) · **4** = 커밋 뒤 검증 실패 또는 COMMIT/복구 결과 미확정·기타 실행 오류. 4를 롤백 성공으로 해석하지 않는다.

### 8-2. 적용 직후 검증(읽기 전용 · `db1-verify.sql` 12행 — 러너 verify 가 같은 본문)

이력 행(본문 sha = 파일 sha) · 8표 RLS on · 8표 0행 · anon 권한 0/authenticated SELECT 만 · 정책 8 모두 SELECT · helper search_path 최종값 · 내부 판정기 3개 anon/authenticated 실행권 없음 · 쓰기 RPC 7 anon 실행권 없음 · 정의자 search_path `pg_temp` · 복합 고유키 3 · DB-2/D3 없음 · **G2 노출 판정: G2 고유 쌍 전부(2026-10-17 123쌍)가 `none` 이 아님**(B 에서는 none 이던 쌍 — 대조군 D1).
이어서 `get_advisors`(security · performance) 신규 경고를 승인 패키지 §6 기대와 대조, `db_health_checkpoint_diff`. 공급 E2E(합성 계정 쓰기)는 승인 패키지 §9 의 **별도 승인** 작업이다.

### 8-3. 실패 시 중단 · 복구

| 상황 | 조치 |
|---|---|
| 종료 2 | 메시지의 조건을 해소하거나 이 패키지를 다시 만든다(정본이 바뀌었으면 새 승인). 강제 옵션은 없다 |
| 종료 3 | 롤백됨 — `preflight` 로 카탈로그 · 이력 원상 확인, 로그의 오류를 분석. 같은 파일 재시도는 원인 해소 뒤에만 |
| 종료 4 | **공급을 열지 않는다.** `/db-incident` 분류 → 원인이 패키지면 `db1-restore.sql`(8표가 비어 있을 때만 · helper 강화는 유지) 을 별도 승인으로 `psql -1 -v ON_ERROR_STOP=1` 실행 → `preflight` 재확인 |
| COMMIT 응답 유실/로그가 applying에서 중단 | **재시도·복구를 먼저 실행하지 않는다.** 별도 사고로 분류하고 읽기 전용 이력 SHA·객체·검증 결과로 실제 커밋 여부부터 대조한다. ROLLBACK 응답이 와도 이미 커밋됐을 수 있다. 판별 후에만 별도 승인된 복구 절차를 따른다 |
| DB-2 뒤 문제 | `db2-restore.sql` 만 쓴다(partial 행 0 일 때). PR #280 의 `_pending_workspace_supply_i1_rollback.sql` 은 D3→P→S 를 한 번에 되돌리는 파일이고, 그 §0–§2 만 떼어 쓰면 본문은 S 그대로지만 `factory_order_open` · `factory_order_transition` 의 search_path 에서 `pg_temp` 가 빠진다(격리 F1 실측) |

### 8-4. 적용 로그 · 이력 기록

- 러너가 `supabase/deploy/factory-i1/logs/<stage>-<command>-<대상>-<시각>.json`을 쓴다. DDL 전에 applying 로그를 쓰고 같은 파일에 committed/unknown/verified/committed_verify_failed 결과를 남긴다. 대상 ref·단계 SHA·Git HEAD·manifest SHA·runner SHA·승인 기록·preflight·시각·NOTICE·오류·verify 행을 보관한다. URL·비밀번호는 오류/로그에서 제거하며 접속 호스트도 기록하지 않는다. 학습자 ID·원문은 없다. **적용·검증 로그를 이 PR에 커밋한다.**
- 이력: `supabase_migrations.schema_migrations` 에 `(version, name, statements = [파일 전문], created_by = 'factory-i1-deploy:<승인 기록>', idempotency_key = 파일 sha)` 한 행을 **본문과 같은 트랜잭션**에서 쓴다. `sha256(array_to_string(statements,''))` = 파일 sha — `agents/scripts/safe-merge.mjs` 의 이력 대조식과 같다.
- **이 PR 은 DB-1 적용 전에는 병합되지 않는다**: safe-merge 는 `supabase/migrations` 의 새 버전 파일이 개발 DB 이력 해시와 같아야 통과시킨다. 순서는 「PR 브랜치 파일로 적용 → verify 로그 커밋 → safe-merge」.

## 9. DB-2(별도 단계 · 별도 승인)

1. DB-1 verify 로그가 `ok` 인 것을 확인하고 공급 E2E 등 DB-1 운영 검증을 끝낸다.
2. `preflight --stage db2` — DB-1 이력 해시 · 객체 · helper 가 DB-1 직후와 같아야 차단 0.
3. `apply --stage db2 --confirm-sha 2165015d063ff67a56806e57dabbaa6aa7fe2bd07e8608beaa8a9323fba8896b --approved-by "…" --db1-verify-log supabase/deploy/factory-i1/logs/db1-verify-….json`. 로그만으로 통과하지 않으며 같은 연결에서 DB-1의 보안·이력·노출 검증을 다시 통과해야 한다. 최초 배포 전용 `tables_empty`는 후속 DB-2 진입에서 제외해 정상 사용 원장을 보존한다.
4. `verify --stage db2`(7행) · 승격 PR 에서 DB-2 파일을 `supabase/migrations/` 로 옮긴다(이력 해시가 같으므로 safe-merge 통과).

## 10. 독립 검토(2026-10-17 · 맥락 없는 Claude 서브에이전트 · 읽기 전용 · Codex CLI 는 이 머신에 없음)

P0 0 · P1 1 · P2 4 · P3 3. 반영: **P1** 카탈로그 지문 사각지대(소유자 · 뷰 정의 · 기본 권한 · 타입 · 확장 · 이벤트 트리거 · 주석 · 비 public 열) → 지문 확장 + 반례 4건(C5a–d) · **P2** 트립와이어 안내의 psql 경로 제거(이력 행이 안 남는다) · `deploy.mjs check` 가 보조 생성물까지 대조 · 동시 DDL/pgsodium 한계 명시(§3-4 · §7) · G2 미해석 쌍 사전 차단 · **P3** 이력 열 사전 검사. 남김(P3): `--db1-verify-log` 는 로컬 JSON(원격 이력 해시 · migration 안 이력 가드가 이중으로 막는다) · `--isolated` 는 hostname 만 본다(격리 시험 전용 플래그 · 운영 절차에서 쓰지 않는다).

## 11. 적용 결과 기록(적용 뒤 채운다)

| 단계 | 적용 시각 | 실행자 · 승인 | 로그 | verify | advisors 신규 |
|---|---|---|---|---|---|
| DB-1 | — | — | — | — | — |
| DB-2 | — | — | — | — | — |
