# Factory DB-1 실제 적용 독립 수용 — PR #286

**판정: BLOCKED — 실제 적용 결과 제출이라는 시작 조건 미충족.**

Codex-DB1-ACCEPT가 2026-10-17 23:05–23:06 KST에 개발 DB를 직접 읽었다. DB-1 이력은 0행이고 신규 표 8개가 모두 없다. 이는 실제 적용 성공의 수용 조건 미충족이며, 제출되지 않은 배포가 실패했다고 단정하는 판정은 아니다. DB 쓰기·추가 SQL 적용·rollback·병합은 수행하지 않았다. 기존 47/47·33/33 패키지 검증도 반복하지 않았다.

## 기준과 증거

- PR: [#286](https://github.com/KangMin098/Vocaflow/pull/286), OPEN, `chore/factory-i1-deploy-package`.
- 검증 대상 최신 HEAD: `37aafced818cc1d0e8607ac4f085a52bc5c729f8`.
- 조회한 `origin/main`: `c73338971e174bed555f6a96f880a43092ad97cd` (#285). PR HEAD의 조상이 아니며 GitHub 판정은 CONFLICTING이다.
- 신규 worktree: `D:/workspace/Vocaflow-db1-accept-286`, 브랜치 `review/factory-db1-accept-286`, 최신 main에서 분기했다. PR 파일은 해당 원격 ref의 Git blob으로 읽었다.
- 대상: Supabase connector의 프로젝트 식별자가 `jajenrevcbmrpaliomxv`와 일치함을 확인했다. DB는 `postgres`. 접속 URL·비밀값은 저장하지 않았다.
- 직접 조회 SQL과 MCP 원응답: [DB 상태](./db-snapshot.json), [DB-2/D3/I2 제외 상태](./excluded-stages-snapshot.json). SELECT만 사용했다.
- GitHub 최신 상태: [PR/CI 스냅샷](./pr-snapshot.json). 조회 시 PR 댓글은 0개, PR 본문은 실제 개발 DB 미적용이라고 명시한다. PR HEAD의 `supabase/deploy/factory-i1/logs/`에 등록된 파일도 없다.
- 실제 게이트 출력: [safe-merge dry-run](./safe-merge-dry-run.txt), 종료 코드 3.

## 15항목 판정

FAIL은 관측된 수용 조건 미충족, UNKNOWN은 증거 부족을 뜻한다. 미제출 로그나 과거 독립 시험을 실제 적용 증거로 치지 않는다.

| # | 검증 | 판정 | 직접 대조 결과 / 부족한 근거 |
|---|---|---|---|
| 1 | 사용자 승인 SHA와 적용 SQL SHA | UNKNOWN | 이 세션에 실제 적용용 사용자 SHA 승인과 적용 로그가 제출되지 않았다. 요청의 조건부 병합 승인은 DB 적용 승인이 아니다. |
| 2 | 대상 개발 DB 정확성 | PASS | Supabase 프로젝트 식별자 `jajenrevcbmrpaliomxv`, DB `postgres` 확인. |
| 3 | migration 이력 정확히 1행 | FAIL | `20261017200000`은 0행. 전체 이력 722행, 최대 버전 `20261014091841`. |
| 4 | C → 수정 B → I1-S 단일 트랜잭션 적용 | UNKNOWN | 실제 apply/transaction/COMMIT 기록과 적용 이력이 없다. 패키지 설계는 실행 증거가 아니다. |
| 5 | Git migration과 DB statements SHA | UNKNOWN | Git blob 104,441바이트의 SHA는 아래 값과 일치. DB 이력이 없어 실제 statements SHA를 얻을 수 없다. |
| 6 | 적용 전후 checkpoint 무결성 | UNKNOWN | 실제 실행에 묶인 전후 checkpoint와 diff 미제출. 기존 패키지 preflight는 적용 후 증거가 아니다. |
| 7 | 신규 표 8개와 허용 객체 범위 | FAIL | 대상 8표 모두 `to_regclass` NULL. 실제 적용 후 허용 범위 비교는 미실시. |
| 8 | RLS 활성화 및 권한 축소 | UNKNOWN | 대상 표가 없어 적용 후 RLS/ACL을 검증할 수 없다. 기존 권한 전체 불변도 미확인. |
| 9 | helper 두 함수 search_path 변경 | FAIL | `is_admin`: `public`; `is_admin_or_curator`: `public, auth`. 기대하는 `pg_temp` 추가가 두 함수 모두 없다. |
| 10 | helper 본문·ACL·소유권 불변 | UNKNOWN | 현재 본문 MD5와 ACL은 PR의 `remote-final.json` 사전 스냅샷과 일치하고 소유자는 둘 다 postgres. 실제 배포 전후 소유권/본문/ACL 불변 증거는 미제출. |
| 11 | 기존 학생 기록 불변 | UNKNOWN | 현재 `learning_task_attempts` 129행. 사전 스냅샷과 행 수가 같아도 전체 행 내용 불변을 증명하지 못한다. 실제 전후 full-row hash 필요. |
| 12 | G2 원장 노출 판정 정상 | FAIL | G2 고유 쌍 123개는 존재하지만 `supply_learner_exposure` 함수는 0개. 실제 DB-1 노출 판정을 실행할 수 없다. |
| 13 | DB-2·D3·I2 binding 미적용 | PASS | DB-2 이력 0행, product order/link 표·fulfillment 함수·partial 제약 없음. I2 annotation registry 및 qualification annotation 열 없음. |
| 14 | 적용 로그와 verify 결과 일치 | UNKNOWN | 적용/verify 로그 미제출·Git 미등록. 실제 이력과 대조 불가. |
| 15 | COMMIT 불확정·오류 로그 여부 | UNKNOWN | 원본 로그가 없어 unknown/오류 부재를 확인할 수 없다. 로그 부재를 정상 COMMIT으로 해석하지 않는다. |

## SHA와 권한 상태

Git migration `supabase/migrations/20261017200000_factory_i1_db1_supply_foundation.sql`의 원본 바이트 SHA256:

```text
061a48a8b50b956762dedf171d3a8949d4f9bae4da4058b41d52227eb767c624
```

**실제 migration SHA: 확인 불가(이력 0행).** 위 값은 제출 패키지의 Git 파일 SHA이며 실제 적용 SHA가 아니다.

현재 helper 본문 SHA256은 `is_admin` = `76483ff5b68817f4067a037029e36860ea5a41cad8cc7dc6ca4abcab14cc4c48`, `is_admin_or_curator` = `65d343d2a330cf8efc7eca1254a40af4f2dc00ae1678f6dcd4dc74a89e75795b`. 두 ACL은 `{postgres=X/postgres,service_role=X/postgres,anon=X/postgres,authenticated=X/postgres}`, 소유자는 `postgres`다. 이는 현재 관측값이며 실제 배포 후 불변 판정이 아니다. DB-1의 신규 RLS/권한 축소와 G2 노출은 아직 수용할 수 없다.

## 최종 CI와 safe-merge

조회한 PR HEAD에서 필수 8종(`verify`, `build`, `e2e`, TypeScript, broken links, migration-doc 정합, CHANGELOG, manifest drift)은 각각 SUCCESS가 하나 이상 있고 실패는 없다. 추가 `e2e-gate-faultclosed`도 SUCCESS다. 비필수 `e2e-shared-dev`는 SKIPPED이며 실제 개발 DB 검증 성공으로 세지 않는다. 이는 **위 HEAD의 기존 CI**이지 적용 로그 등록과 최신 main 통합 뒤의 최종 CI가 아니다.

`node agents/scripts/safe-merge.mjs 286 --dry-run`은 **BLOCKED / exit 3**:

1. PR CONFLICTING.
2. safe-merge 프로세스에는 `SUPABASE_ACCESS_TOKEN`이 없어 이력을 읽지 못함. 별도 Supabase MCP 직접 조회에서는 DB-1 이력 자체가 0행임을 확인했다. 자격 부재와 이력 부재를 구분한다.

최종 실제 적용 목적 리뷰 NO_FINDINGS는 아직 없으며, 과거 패키지 리뷰를 재사용하지 않았다. 실제 병합 명령은 실행하지 않았다. **병합 SHA 없음.**

## Claude-DB1-APPLY 재개용 전달 사항

현재 차단은 배포 코드 결함 확정이 아니라 시작 조건과 실제 적용 증거의 부재다. DB를 수정하거나 rollback하지 않는다. 지정된 적용 실행자가 다음을 제출한 뒤 이 독립 수용을 재개한다.

1. 새 전체 SHA 및 수정 B/wrapper 범위에 대한 명시적 사용자 승인 근거, 실제 실행 Git HEAD와 manifest/runner SHA.
2. 삭제·편집하지 않은 원본 apply 로그, 실패·unknown·COMMIT 오류가 있다면 해당 로그 전부, 별도 verify 결과 및 성공 후 DB 이력 한 행의 statements SHA.
3. 실행 직전/직후 checkpoint와 diff, 학생 기록 전체 행 해시 및 기존 권한·helper 본문/ACL/소유권의 전후 비교.
4. DB-1 verify의 전 항목 결과와 실제 RLS/권한/G2 노출 대조. 실패/불확정 상태를 성공으로 바꾸지 않는다.
5. 적용 로그를 PR #286에 Git 등록하고 최신 main 충돌을 해소한 최종 HEAD 제출. 독립 수용과 최종 목적 리뷰, 필수 CI 8종 및 추가 E2E, safe-merge dry-run을 모두 다시 확인한다.

DB-2는 DB-1 수용 뒤 별도 승인·후속 적용 대상이다. D3와 I2 annotation binding 및 실제 납품↔G2 결속은 이번 수용/병합 범위에서 적용하지 않는다.
