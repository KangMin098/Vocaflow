# Codex-DB286 — Factory I1 배포 패키지 독립 검증

- 대상: [PR #286](https://github.com/KangMin098/Vocaflow/pull/286), 실제 head branch `chore/factory-i1-deploy-package`.
- 최초 제출: `3d4f773d8d134923c92518a8ab5c80951c81f77e`. **최초 판정 REWORK**. 기존 47조건 통과만으로 아래 반례를 발견하지 못했다.
- 통합 main: `732f2bb0f0b4094c175c0b5e8a66c799d704a6a0`(#283 포함). 전용 worktree에서 통합했으며 다른 세션의 파일/인덱스는 수정하지 않았다.
- 최종 독립 판정: **ACCEPT_WITH_LIMITS**. DB-1 패키지 **DEPLOY_READY**(새 명시 승인·권한 있는 실행자의 실제 적용 대기). 코드 HEAD `46b935f9e`의 필수 8종과 추가 게이트 고장 E2E가 모두 성공했다. 마지막 보수적 오류 분류/문서 커밋도 [최신 HEAD 체크](https://github.com/KangMin098/Vocaflow/pull/286/checks)가 모두 성공해야 배포 준비 판정을 유지한다. 개발 DB 쓰기/배포/safe-merge/병합은 실행하지 않았다.

## 1. 최초 제출 결함과 수정

`submitted-counterexamples.json`의 `safe=false` 6건은 실제 격리 DB에서 재현한 결함이다. `pass`는 기대했던 결함을 재현했다는 뜻이며 제출본이 안전하다는 뜻이 아니다. 수정 후 동일 시험은 `fixed-counterexamples.json`의 `safe=true`로 확인한다.

| ID | 등급 | 제출본 재현 | 최소 수정 |
|---|---|---|---|
| R01 | P1 | 검증된 프로젝트 URL에 `?host=127.0.0.1&port=…&sslmode=disable`를 붙이면 pg 드라이버의 실제 host/port/TLS가 바뀐다. TLS 인증서 검증도 꺼져 있었다 | query/fragment·잘못된 프로토콜/DB/포트 거절, TLS 인증서 검증 |
| R02 | P1 | 자동 환경 + 임의 `--approved-by` + `--isolated` CLI가 실제 격리 DB에 DB-1을 커밋했다 | 공용 훅의 DB 승인 분류, auto/CI·비대화형·CLI apply의 isolated 차단, 별도 정책 승인 및 전체 SHA 대화형 확인. 승인 문자열은 메타데이터로만 취급 |
| R03 | P1 | 배포 중 event trigger가 기존 `is_admin()` 본문을 `select true`로 바꿔도 허용된 함수 이름이라 적용 성공 | helper 두 개의 적용 전/후 전체 pg_proc 속성 비교(proconfig 제외) + 정확한 최종 search_path. 본문·ACL·정의자·소유권 등 불변 |
| R04 | P1 | 실제 COMMIT 후 응답만 ECONNRESET으로 유실시키면 이력이 존재하는데도 러너는 실패/롤백으로 보고 | outcome=unknown·종료 4·사고 분류. DDL 전 의도 로그와 Git/manifest/runner SHA 기록. 읽기 대조 전 재시도/복구 금지. FATAL 서버 종료/내부 오류/08/40003도 보수적으로 unknown이며 이후 ROLLBACK 응답이 이를 바꾸지 않는 회귀 추가 |
| R05 | P2 | preflight 뒤 새 원격 이력을 넣어도 실제 apply는 성공 | 적용 트랜잭션 안에서 이력 표를 잠근 뒤 preflight 재실행; 신규 이력 거절 |
| R06 | P2 | DB-1 검증이 현재 실패하는 권한 상태에서도 DB-2를 적용할 수 있었다. CLI의 JSON `verify.ok`는 로컬에서 조작 가능 | DB-2 적용과 같은 연결/잠긴 트랜잭션에서 DB-1 보안·이력·노출 검증 재실행. 이력 SHA와 기존 로그도 계속 요구. 최초 배포 전용 빈 원장 검사는 제외해 정상 사용 데이터 보존 |
| R01 후속 | P2 | 독립 목적 리뷰에서 URL 포트 생략 + PGPORT=6543 상속 반례 추가 발견(접속 없이 pg 드라이버 설정 재현) | 운영 URL에 명시적 :5432 필수, 포트 생략 회귀 추가 |
| 후속 CI | P2 | 빈 Supabase에서 기존 migration 실패로 helper 두 개가 없어 DB-1의 전제 검사가 거절. 첫 CI 준비 코드의 archive 경로 누락도 목적 리뷰로 발견 | 운영 SQL/가드는 불변. CI에서만 두 helper의 저장소 정본 본문/ACL을 복구하고 `_all_migrations` 경로 회귀를 추가 |

정책 승인, OS 자격증명, 터미널은 신뢰 경계다. 같은 자격증명을 가진 임의 프로그램이 사용자 동의를 암호학적으로 증명할 수 있다고 주장하지 않는다. 시험 라이브러리를 운영 승인 우회 경로로 안내하지 않는다.

## 2. SQL와 승인 차이

제출 DB-1 `766b88841cc65511592d847f4da3d87a2441a44682d5f4f1383f25ab2c1fa211`의 C/B/S와 DB-2 `7c1cc2ed2e99cdc4264f86fd6cf4af16115f597c80b89a18cf216190acc1ec2f`의 P는 당시 원본과 바이트 단위 일치했다.

최신 main #283은 B의 `(b->>'v') <> '2'`를 `(b->>'v') is distinct from '2'`로 바꿨다. 이 한 줄 보안 수정만 동기화했다. **기존 B 해시 승인은 철회된 상태이며 새 전체 파일 승인이 필요하다.** I0 delta·D3·I2 annotation binding은 배포 세그먼트에 넣지 않았다. #283의 보류 annotation 파일은 main 이력을 그대로 통합했을 뿐 DB-1/2에는 들어가지 않는다.

| 파일 | 최종 SHA-256 |
|---|---|
| C | `dd940568ef7170212bf23ac9f7fb89bb090e8f529eeb4c26bb9ccdbc1e503f66` |
| B(#283 NULL 보완) | `2957ecf73c4399f81971581769021b30eb69c1141c29a443de62a5aa4506aa02` |
| S | `cc3d91001fc21800171c8210c3142ea9d6ef35facb7df877f88e4f0a97a3b6de` |
| P | `79807c38244982389ad2eb25b36350bc7121a84cc10b5ab54a1293b758e95041` |
| DB-1 전체(104,441 bytes) | `061a48a8b50b956762dedf171d3a8949d4f9bae4da4058b41d52227eb767c624` |
| DB-2 전체(32,678 bytes) | `2165015d063ff67a56806e57dabbaa6aa7fe2bd07e8608beaa8a9323fba8896b` |
| MANIFEST | `ff1cac064d2cb0e9c343d79b6177dda743ecfab47afd3bf3532a03ddeb61a0a9` |

영구 객체 범위는 이전 승인안과 같다: DB-1의 8원장/16함수/정책·트리거·복합 고유키와 **기존 helper 두 개의 search_path 변경만**, DB-2는 partial CHECK/index·주문 함수 둘·충족도 함수다. 추가된 wrapper helper snapshot은 트랜잭션 임시 객체로 COMMIT 뒤 사라진다. 기존 helper 본문/ACL 불변과 승인 목록 밖 변화 거절을 실제 PostgreSQL에서 확인했다. DB-2 단독 복구는 S 권한 강화를 유지한다.

## 3. 검증과 증거

| 검증 | 결과/증거 |
|---|---|
| 제출 격리 PostgreSQL 17.10 배포 절차 | [47/47](./submitted-isolated.json) |
| 제출 추가 반례 | [6건 재현 + 정상 차단 2건](./submitted-counterexamples.json); 실제 운영 접속 없음 |
| 수정 배포 절차 | [47/47](./fixed-isolated.json): 부분/분리 실행, 마지막 검증 실패, 이력/카탈로그 rollback, 중복 적용, 복구의 원장 보존 포함 |
| 수정 추가 반례 | [8/8](./fixed-counterexamples.json): 6결함 차단 + 동시 DDL 거절 + 실제 15초 락 타임아웃/rollback |
| 배포 SQL 위 기존 I1 동시성 | [33/33](./fixed-concurrency.txt): RLS·권한·G2·NULL 관리자·pg_temp·직렬화. 시험의 D3는 기존 회귀 조건을 유지하기 위해서만 별도 로드하며 DB-1/2에는 미포함 |
| 오프라인/권한/로그 회귀 | deploy.test.mjs **6/6**, CI 전제 **3/3**, 공용 guard 90/90. CI verify에 배포/전제 회귀 추가 |
| CI 전제와 DB-2 생명주기 | [N03/N04 2/2](./ci-prerequisites-isolated.json): 정본 helper 복구·없는 원천 표 오류·DB-1 적용·정상 자격 원장 1행을 보존한 DB-2 적용. CI 전용 URL/환경/archive 경로 단위 3/3 |
| 공용 에이전트 전체 회귀 | [141/141](./agent-regression.txt) |
| 읽기 전용 개발 DB | [remote-preflight.json](./remote-preflight.json): 프로젝트 ref 확인, PostgreSQL 17.6·이력 722행·최대 20261014091841·DB-1/2 없음·전제 충족·충돌/락 0·DB-1 차단 0 |
| 목적 리뷰 | [표준 review.mjs 최종 NO_FINDINGS](./purpose-cli-final.txt)·[read-only reviewer NO_FINDINGS](./purpose-independent.txt). [제출본 지적](./purpose-cli-submitted.txt)과 [첫 수정본 지적](./purpose-cli-fixed-first.txt)을 보존했다. DB-2 빈 원장 과잉 차단을 수정했고, Supabase secrets 부재로 기존 PR 통합 시험 실행 범위가 줄었다는 근거가 없음을 확인. 마지막 COMMIT 오류 분류 보완도 독립 리뷰 NO_FINDINGS·배포 6/6 |
| 최신 main/필수 CI | main #283 통합. [코드 HEAD CI 증거](./ci-code-46b935f9e.json): 필수 **8/8 SUCCESS** 및 추가 e2e-gate-faultclosed SUCCESS |
| 빈 Supabase CI | 두 잡 모두 **migration 성공 353·기존 실패 164·새 실패 0**. DB-1을 known-failure에 추가하지 않고 실제 적용했다. 브라우저 **4 passed**, 실제 RPC 고장 **2 passed** |
| 실제 개발 DB 미적용 최종 확인 | [remote-final.json](./remote-final.json), 2026-10-17 21:34:57 KST: 이력 722·DB-1/2 없음·대상 없음·기존 helper와 원장 수 불변. 읽기 전용 질의만 실행 |

PR CI verify는 공유 개발 DB 비밀값을 전달하지 않는다. DB 동작은 별도 로컬 Supabase e2e와 격리 PostgreSQL로 검증한다. main/수동 CI의 기존 공유 DB 동작은 이번 작업에서 실행하지 않는다.

첫 코드 HEAD `191f71a96`의 CI verify/build/정합 5종은 성공했고 e2e 두 잡은 [전제 함수 누락](./first-ci-failure.json)으로 실패했다. 이를 성공으로 세거나 known-failure 목록에 DB-1을 추가하지 않았다. CI 전용 복구는 두 함수의 정본 정의만 만들며 새 표/이력을 만들지 않는다. 런타임에 없는 article 표를 읽으면 오류로 닫히는 것을 확인했다. 전체 운영 의존성이 빈 DB에 복원됐다고 주장하지 않는다. 이 저장소의 secret 이름 실측에서는 Supabase URL/anon/service 세 가지가 모두 없었으므로 기존 PR의 실DB 통합 시험도 환경 조건으로 skip되던 상태다. 이번 작업이 그 시험들을 새롭게 skip시킨 것은 아니다.

한계: 최소 의존 사본 PostgreSQL 시험은 실 Supabase의 전체 auth/확장/event trigger 환경을 대체하지 않는다. pgsodium 등 실DB 확장 부작용과 실제 역할/학습 데이터 검증은 적용 뒤 필요하다. 카탈로그 지문은 문서에 적힌 데이터 행/역할/시퀀스 값 등 제외 범위를 가진다. 타 세션의 DDL이 에필로그 이후 발생하는 것까지 직렬화하는 계약은 아니다.

## 4. 배포와 safe-merge의 남은 조건

상태는 **DEPLOY_READY**이며 실제 개발 DB는 이번 세션에서 적용하지 않는다. 최신 HEAD의 체크가 실패/대기라면 배포 준비 판정도 보류한다. 마지막 HEAD 체크 결과는 PR 본문/체크 링크에서 확인한다.

1. 새 B/DB-1 전체 SHA와 wrapper 변경 범위의 사용자 명시 승인. `--approved-by`나 이번 독립 수용은 그 승인이 아니다.
2. 정책상 허용된 환경의 권한 있는 실행자가 당일 checkpoint/권한/이력을 다시 확인하고 DB-1 파일 하나만 적용한다. 승인 밖 과거 migration이나 DB-2는 함께 적용하지 않는다.
3. 실제 DB-1 이력 statements SHA가 위 전체 SHA와 일치하고, 성공한 apply/verify 로그·checkpoint/advisor 결과를 PR에 등록한다. Git 파일/이력/로그 SHA를 대조한다.
4. 로그 등록으로 바뀐 최종 HEAD의 필수 CI 8종·최신 main·목적 리뷰를 다시 확인한 뒤에만 safe-merge를 실행한다. 이력 없음/불일치/읽기 실패면 병합 금지.
5. DB-2는 DB-1 성공 검증 및 별도 승인 후 후속 단계다. 원장에 데이터가 있거나 COMMIT 결과가 미확정이면 복구를 자동 실행하지 않는다.
