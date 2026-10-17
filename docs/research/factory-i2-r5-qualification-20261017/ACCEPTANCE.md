# PR #283 — Codex-I 독립 수용

2026-10-17 · worktree `Vocaflow-factory-i2-qualification-review` · 기준 main `dcd070c441ebcc41a62094778e7699df62eba97d`(#280 병합) · 제출 HEAD `f94ddcbce3dc25afe9e2beb22c4aab1910a9cf4a`.
최종 통합은 main `09564242f`(#282 병합)까지 포함한다. 추가된 main 변경은 V2-F2 문서 3개와 CHANGELOG이며 제품 코드/SQL은 바뀌지 않았다.

**제출본 REWORK → 수정 승인안 ACCEPT_WITH_LIMITS. 실제 I2는 BLOCKED.** 연구 근거와 격리 검증된 SQL 제안의 수용이며, DB 적용·배포 동기화·자격·public/assessment 승인·납품의 승인이 아니다. 개발 DB에서는 SELECT만 실행했다. 실제 학생/합성 계정/학습 제출 쓰기도 0이다.

## 1. FQ A–H와 실제 충족도

원 규칙은 별도 연구 브랜치의 [FQ1-CONTRACT](https://github.com/KangMin098/Vocaflow/blob/a658fa39a/docs/research/factory-qualification/FQ1-CONTRACT.md), [FQ1-ROLE-ELIGIBILITY](https://github.com/KangMin098/Vocaflow/blob/a658fa39a/docs/research/factory-qualification/FQ1-ROLE-ELIGIBILITY.md)를 직접 읽었다. 파일 SHA-256은 각각 `a95d9ea4001cce319addf5c663e2e73a3a73cd6edbf35d9c8f0c8a30f449fd74`, `2c75e2bafd81b7077e29ccca07ab5dee9fb42dafad923ad1567008d1a328bf67`이다. 원 규칙 파일은 변경하지 않았다.

| 축 | 독립 판단 | 확인 범위·추가 필요 |
|---|---|---|
| A | PASS, 로컬 공식 파일 대조 범위 | 짝수형 문제지 3쪽 시각 확인·지문 연속 일치·8단어 창 39/39·선택지 5/5. 정답표 **2쪽 짝수형** 24번 ②를 시각/텍스트 재확인. 문제지/정답표 SHA는 제출 증거와 동일. 공식 웹 재다운로드/다운로드 계보 검증은 하지 않음. A는 F 권리가 아님 |
| B | PASS, AI 비맹검 의미 확인만 | 현재 6문장·주장 2·근거 3/4/5·관계 4=reason을 전체 문맥에서 다시 읽음. 원 두 AI 맹검 출력은 미보존이므로 재검증 불가. 사람 검수/Gold/학생 타당성으로 승격하지 않음 |
| C | UNKNOWN | TASK 수행 산출물과 검수 실행 기록 없음. 글에 주장·근거가 있다는 B로 대체하지 않음 |
| D | UNKNOWN | 교수 피드백 미검수. transfer 비필수지만 PASS로 만들지 않음 |
| E | UNKNOWN | 사람 Gold·revision/hash·부분/동등/오답/보류 rubric 및 실제 응답 채점 근거 필요 |
| F | UNKNOWN | 이용/각색/배포/평가 사용의 대상·범위·근거·판단자 기록 필요. 비노출 설계/공식 PDF 소유/B7 출시 표지는 권리 승인이 아님 |
| G | 개인별 공급 순간 검사 | 11:10:15Z(20:10:15 KST) 대상 시도/세션/해설/dx 모두 0. 11:13:45Z 추가 SELECT에서 trap/세션 시도/복습큐도 0·정규화 동일 본문 0. 영구 무노출이나 모든 학습자 적격을 뜻하지 않음 |
| H | UNKNOWN | 코드·골격 서명 일치는 실제 대상 실행 검증이 아님. 격리 SQL fixture는 2020#24 학습 실행 증거가 아님 |

전이 필수 A/B/C/E/F/H 중 **2/6(A·AI 한정 B)**. C/E/F/H 4축 UNKNOWN. DB 재현 원본은 [INDEPENDENT-DB.json](./INDEPENDENT-DB.json). 문항 revision `665745b7…a8e8`, 주석 hash `72c534f8…2441`은 제출과 같다. 현재 활성 `claim-support:2020-24`는 여전히 연습 전이 풀에서 열릴 수 있다. 연습 노출/도움이 있는 수행을 독립 전이로 읽을 수 없다.

## 2. 발견과 최소 수정

| ID | 등급 | 제출본 결함 | 수정/반례 |
|---|---|---|---|
| Q01 | P1 | 기록 열만 있고 공급/현재 충족도에서 실제 현재 주석 대조 없음 | 신뢰된 현재 배포 등록부 `supply_current_annotation`과 **문항/TASK/원문 revision/annotation_ref/hash** 모두 대조. 누락·다른 값이면 공급 거절, 주석 교체 뒤 현재 충족도 false |
| Q02 | P1 | 새 writer가 `not is_admin_or_curator()`와 `search_path=public`로 I1-S 보안을 퇴행 | `IS NOT TRUE`, 명시적 `public,pg_temp`. 실제 NULL helper에서 일반 사용자 거절 |
| Q03 | 핵심 P2 | 권장 C→binding→B→S는 S가 옛 writer 서명을 재생성. binding은 S의 ALTER 대상도 제거 | **C→B→S→(선택 P)→binding v2**, 같은 트랜잭션. S 선행 없으면 명시적 거절. 옛 기록 서명 제거·새 기록 서명 하나 |
| Q04 | P2 | 공백 annotation_ref 허용, 정답표 대조는 재현기에서 빠짐 | 공백 ref 거절. `verify.mjs --answer-key`는 짝수형 페이지/24번 행/파일 SHA를 독립 검사 |
| Q05 | 핵심 P2, 목적 리뷰 | 기존 B의 버전 `<> '2'`가 누락/NULL을 통과시켜 같은 수요에 다른 서명을 허용 | B 한 줄을 `IS DISTINCT FROM '2'`로 수정. 누락/NULL 두 반례 재실행. B 승인 해시는 새로 확인해야 하며 I1 제출 증거는 덮지 않음 |
| Q06 | P2, 코드 리뷰 | PG 시험기 예외 시 연결 반환을 건너뛰어 종료/임시 클러스터 정리가 대기할 수 있음 | 연결 반환을 finally로 옮기고 종료/정리를 별도 finally로 보장. 연결 직후 예외 주입으로 종료 경로 확인 |
| Q07 | 핵심 P2, 승인안 재리뷰 | 현재 주석 SELECT FOR SHARE가 0행인 뒤 helper 재조회에서 동시 삽입 행을 잠금 없이 사용할 수 있음 | 잠근 행을 `INTO c`로 받아 없으면 즉시 거절하고 그 튜플만 비교. 중간 버전의 재조회 경로 2실패를 보존하고 수정본 2통과 |
| Q08 | 핵심 P2, 승인안 후속 리뷰 | 공식 선지 문자열 포함만 검사해 순서를 바꿔도 재현기가 통과할 수 있음 | 지문 뒤의 ①–⑤를 번호별로 비교하고 DB의 현재 B revision도 비교. 선지 교환/본문 정체성 반례 5개를 CI에 연결. 정답표 인자와 기존 evidence 결속도 필수화 |

공급 공개 서명은 기존 `(uuid,uuid,uuid,uuid,uuid)` 그대로다. 내부 I1 공급/유효성 함수는 `_i1`로 옮기고 public/anon/authenticated EXECUTE를 회수한다. I1-S 원본 파일·노출/원천/승인/수량 검사는 보존한다. B는 Q05 한 줄만 수정했다. 새 helper도 외부 직접 실행 불가다. 새 현재 등록부는 RLS 활성·클라이언트/관리자/서비스 역할 권한 없음·DB 소유자 전용이며 **빈 상태**로 설치한다. 기본 ALL ACL 하에서도 authenticated INSERT/SELECT/TRUNCATE가 거절된다.

현재 배포 정보는 [current-annotation-manifest.mts](../../../scripts/research/factory-i2-r5-qualification/current-annotation-manifest.mts)가 실제 `currentItemTask`와 `def.hash`로 읽기만 한다. 2020/2021 결과가 기존 G2 hash와 일치했다. SQL은 코드 파일을 스스로 읽지 못하므로 **등록부를 실제 배포와 원자적으로 동기화하는 운영 경로가 아직 없다.** 이 경로를 승인/검증하기 전에는 등록부를 채우지 않고 실제 공급을 BLOCKED로 유지한다. SQL 비교 성공을 “현재 서비스 코드까지 결속 완료”로 과대 해석하지 않는다.

## 3. 이력·G2·G 보존

- 주석이 바뀌면 기존 납품 행/자격 hash를 삭제·변경하지 않는다. 현재 충족도만 false다. 동일 request_key/본문 재전송은 과거 ID 반환이며 현재 재승인이 아니다.
- G2 `content_hash=sha256(JSON.stringify(annotation))` 공식을 바꾸지 않는다. 옛 G2 hash가 현재와 달라도 그 학습자의 과거 노출은 노출이다. 다른 학생의 시도는 현재 학생을 막지 않는다. I1-S처럼 synthetic도 보수적으로 노출로 센다.
- 실제 2020#24 이력은 여전히 0. 합성 SQL fixture의 과거 행·노출 반례는 실제 학습 기록이 아니다.
- 연습 풀 격리·화면 상수 자격 제거·delivery_id와 G2 귀속·검수 실행 계정/노출 분리는 기존 #281 후속 차단으로 유지한다. 이 검증에서 학습 코드 범위를 확장하지 않았다.

## 4. 격리 증거와 제한

| 검증 | 결과 |
|---|---|
| 동일 SQL 반례, 제출 B/binding을 최신 C/S/P 위에 적용 | 실제 PostgreSQL **17.10, 26/38 PASS·12 FAIL**. [제출 증거](./INDEPENDENT-PG-SUBMITTED.json). 현재 등록부 자체가 없어 ref/hash/TASK 비교 조건의 실패는 독립 메타데이터를 전달할 경로 부재도 포함하며, 각 조건의 별도 저장/변경 실험 성공으로 세지 않음. 별도 DB에서 제출 권장 C/binding/B/S 순서를 실행하면 writer 서명 2개가 남음 |
| Q07 중간 버전 반증 | `15d153d8e`의 binding을 읽은 실제 PostgreSQL **44/46, 2 FAIL**. [중간 증거](./INDEPENDENT-PG-PRELOCK.json). 격리 helper를 예외 marker로 잠시 대체해 0행 후 재조회 및 잠근 튜플 재조회 호출을 검출했다. 실제 동시 INSERT 타이밍을 재현했다는 주장은 하지 않음 |
| 수정 B/binding | 실제 PostgreSQL 17.10 **46/46**. [수정 증거](./INDEPENDENT-PG-FIXED.json). 43개 순차 조건(재조회 marker 2개 포함) + 별도 연결의 공급 우선/배포 우선 직렬화·커밋 뒤 현재 무효 3조건 |
| PGlite | 제출 패킷 7 + 독립 SQL 시나리오 1(43조건) + 기존 C 11/B 26/I1 47/store 7 = **99 테스트 통과**. B 버전 추가 수정 뒤 B26+독립1 27/27, Q07 뒤 패킷7+독립1 8/8 재실행 |
| 기존 실제 I1 PostgreSQL | 기존 C/B/S/P/D3 스크립트 **33/33**, 다중 연결·철회/주문/supersede/노출/ACL/롤백 회귀. binding이 없는 기존 패키지의 보존 검사이며 binding 결합 동시성은 위 별도 결과 |
| 원문/정답·runtime 주석 | [독립 원천 재현](./INDEPENDENT-SOURCE.json): 2020/2021#24 모두 현재 B revision·번호별 선지 5/5·짝수형 정답표 2쪽 일치. Node 반례 **5/5**를 CI verify에 추가. B의 JSONB 표기기는 실제 PG oracle **3/3**로 검증. runtime manifest 2020/2021 hash 일치 |
| 기존 G2 회귀·정적 검사 | claim-support/수직 경로 **68/68**, web TypeScript 0오류, agents check **15/15** |
| 개발 DB | PostgreSQL 17.6 SELECT만. C/B/I1 10표와 새 현재 주석 등록부 모두 미설치. [종료 읽기 감사](./INDEPENDENT-DB-FINAL.json) 11:21:39Z(20:21:39 KST)에도 대상의 6종 노출/정규화 동일 본문 모두 0. 실제 공급 E2E BLOCKED |

SQL fixture는 실제 데이터·권리 증빙/Gold를 대신하지 않는다. 현재 등록부가 코드 배포와 다른 상태인 운영을 이 격리 시험은 검증하지 않았다. 문항/원천 검사가 가진 기존 트랜잭션 범위와 학습 노출 전체 직렬화의 I1 한계도 유지한다.

## 5. 새 SQL 승인 단위 및 실제 공급 전 차단

새 승인안은 `_pending_workspace_supply_c_annotation_binding.sql` **v2 전체 파일**이다. 정확한 SHA-256은 수정 PG 증거의 같은 파일 항목을 따른다. 선행 C/B/S/P 해시도 함께 봉인한다. P는 선택이며 실주문 운영 전 I1 DB-2 승인 조건을 별도로 충족해야 한다. I0 delta 중복 적용 금지. 기존 C/B/S 승인에 이 v2의 새 표·열·색인·함수 교체·GRANT/RLS를 묵시적으로 포함하지 않는다.

1. 소유자 전용 등록부와 원문 revision을 실제 배포의 runtime manifest에 결속하고, 삭제/교체 배포도 같은 원자 경계로 처리하는 **배포 동기화 경로 검증 및 명시 승인**. 구 배포와 동시 운영 금지. 그 전 등록부는 빈 상태 유지.
2. 정확한 SQL/hash/객체 범위 승인·적용 전후 체크포인트·한 트랜잭션 적용. **이번에는 실행하지 않음.** 기존 I1 rollback은 v2를 모른다. 이력 존재 후 DROP/열 제거 금지, 역순 복원은 새 승인 필요. 비상 중단은 별도 승인으로 현재 등록을 비우고 이력은 보존하는 방식.
3. 사람의 F 권리 판단 및 E Gold/rubric/revision/hash, C/H의 분리된 실제 검수 산출물 확보. B의 사람 검수는 현재 없음으로 계속 명시.
4. 연습 노출 격리·개인 G·납품↔시도 귀속 차단을 해결한 뒤에야 별도 자격/출시/납품 쓰기 승인을 요청한다.

## 6. PR/검증 상태

이 문서의 수용은 코드·SQL 승인안에 대한 것이다. 최종 commit/CI/목적 리뷰와 PR #283의 병합 상태는 해당 PR HEAD와 checks를 정본으로 확인한다. DB 적용이나 실제 출시로 해석하지 않는다. 후속 검증 결과는 아래 기록에 추가한다.

- 목적/코드 리뷰의 Q05·Q06을 수정했고 `review.mjs --base 231bdc105`의 eec6ed9a2 후속 결과는 `NO_FINDINGS`다. Claude 전체(231bdc105)·후속(eec6ed9a2) 교차 리뷰도 `NO_FINDINGS`다. 승인안 계획 재리뷰·최종 HEAD CI 결과는 PR 본문에 남긴다.
- 최종 RLS 반례는 실제 납품을 가진 `me`를 다른 사용자 `other`로 읽어 0행인지 검사하도록 보완하고 PGlite/실제 PG 44조건을 다시 통과했다. Claude 최종 증분 리뷰는 P1/P2 없음, P3 하나(이 RLS 검사 자체의 사전 존재 확인을 따로 두면 더 독립적임)다. 현재 전체 시험에서는 앞의 공급 성공·이력 보존 검사가 실패하면 전체가 실패하므로 빈 fixture의 거짓 통과는 아니다.

재실행(개발 DB 자격증명 불필요):

```text
pnpm exec tsx scripts/research/factory-i2-r5-qualification/independent-postgres.mts --deps <isolated-deps> --submitted
pnpm exec tsx scripts/research/factory-i2-r5-qualification/independent-postgres.mts --deps <isolated-deps>
pnpm --filter web exec vitest run src/lib/csat/map/v62/__tests__/supply-annotation-independent.pglite.test.ts src/lib/csat/map/v62/__tests__/supply-c-annotation-binding.pglite.test.ts
NODE_OPTIONS=--conditions=react-server pnpm exec tsx --tsconfig apps/web/tsconfig.json scripts/research/factory-i2-r5-qualification/current-annotation-manifest.mts 2020#24 2021#24
```
