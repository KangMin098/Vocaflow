<!-- docs/research/final-independent-20261018/REWORK_DELTA_REVERIFY.md -->
# REWORK 변경분 독립 재검증 · 진행 원장

## 현재 판정 · 후속 재검증

**최신 후속이 아래01c/1ee 단계보다 우선한다.** 실제 통합303 **256f109e5e142e902ab48eb537cae7f6535eeb61**는 최신250 **2549e407d9b1138c83b7fd633556b1527b62648c**를 포함한다. 그 사이 migration 복원 뒤의 CHANGELOG 충돌은 담당 실제 merge로 해결됐다. [최신 HEAD/CI·소스5파일 결속](./rework-latest-head-binding.json)에서 실제 state API/merge/store가 독립 검증 스냅샷과 같고 migration SHA bb4cc88d가 실제 적용 이력과 일치함을 확인했다. 실제 DB 재적용은 하지 않았다.

2502549의 추가 store 변경은 최대5회 재전송/증가 간격/실패 표시다. 새 단위5/5를 독립 실행했고 [새 실제 브라우저](./state-rework-browser.json)는 동시 두 기기 외3번째 컨텍스트에서 지속409의 총6요청 뒤 중단·1분 추가0·실패 상태/IndexedDB 노트 보존·새 저장 뒤 정상 성공을 확인했다. 처음 두 기기 경합200/409도 새 실제 타이머로 재시도해 두 노트가 남았다. [이전01c 브라우저](./state-rework-browser-01c.json) 결과도 보존한다. 이 조합에서 검증한 실제 소스가 통합256f와 바이트 일치하므로 같은 코드를 다시 실행하지 않는다. 최신303/250 CI는 기계 기록의 진행 상태를 따르며 옛 성공으로 대체하지 않는다. FI-018의 실제312 HEAD는 여전히cefc이며 **PARTIAL_FIX / OPEN, REWORK**다.

**REWORK**. 실제 제품 코드 통합 HEAD는303 **01c5e4bc0dace7f28c98bdf5a5273884b3538e8d**,250 **bcc3b32a781b121715e675e6bbe8824961065b5b**다.250bcc는30301c의 조상이다.303 최신 **1ee7e38443063559922998be58d68652adec714e**는 이 코드 이후 문서만 바뀌어 검증을 재사용한다. 이후250 **92ea6aa3cf04bce0fdeda721a3213b05ec7191ad**는 적용 이력에 맞게 기존 migration 주석 바이트를 복원했고 앱 코드는 bcc와 같다. 이 마지막 DB 파일 변경은 아래 앱 검증과 별도로 결속한다.

|결함|수정 후 독립 결과|판정/한계|
|---|---|---|
|FI-006|아래 PostgreSQL 두 연결4사례·22역할, SQL 바이트 불변|FIX_VERIFIED_IN_CANDIDATE / ISOLATED_DB_VERIFIED|
|FI-010|실제 RSC/SQL에서 공개 전 기록 성공·실패·commit 후 ack 유실·별도 재열기·최초 수행·완료 복귀4검사 통과|FIX_VERIFIED_IN_CANDIDATE / 격리 서버·DB 범위.12개 필터 skip은 통과 수 아님|
|FI-014|채점기/Gold/UI 채택 바이트 결속과 기존1,596조합·12브라우저 관찰 재사용|FIX_VERIFIED_IN_CANDIDATE. 사람 Gold 승인 아님|
|FI-015|실제 HTTP PUT/GET+PostgreSQL13검사, 두 브라우저 컨텍스트의 실제 IndexedDB/store 재시도|FIX_VERIFIED_IN_CANDIDATE / ISOLATED_DB_VERIFIED·ISOLATED_BROWSER_VERIFIED|
|FI-016|비공개 실제 HTTP/DB 경계4검사 통과, 정상 대조 포함|FIX_VERIFIED_IN_CANDIDATE. 합성 인증/게이트 어댑터이며 실제 JWT 검증 아님. DL-0177 비공개 인계|
|FI-017|실제 통합 코드의 타입·lint·빌드/필수 CI, 관련 테스트와 실제 CI 브라우저8건|FIX_VERIFIED_IN_CANDIDATE. 전체 실제 학습자 A→H 성공 아님|
|FI-018|PR312cefc3e502 작성자20검사 통과, 추가 독립 경계에서 거절 필요 입력이 수용됨|PARTIAL_FIX / OPEN. 민감한 상세/격리 후보는 DL-0177 비공개. safe-merge 실행·우회·실제 병합0|

### CI 실패의 실제 수정

3031ee의 [CI39135503282](https://github.com/KangMin098/Vocaflow/actions/runs/39135503282)와250bcc의 [CI39134584335](https://github.com/KangMin098/Vocaflow/actions/runs/39134584335)는 필수 체크 모두 SUCCESS다.25092ea의 [CI39136301481](https://github.com/KangMin098/Vocaflow/actions/runs/39136301481)은 최신 관찰 시 verify/e2e 일부 진행 중이며 앞 HEAD 성공으로 대신하지 않는다. shared-dev SKIPPED는 실제 개발 DB 검증이 아니다.

쓰기 예산은 기준141과 스캐너/테스트를 그대로 유지했다. 서버의6회 CAS 루프 대신 단일 CAS/경합409와 실제 클라이언트1.5초 재시도로 바뀌었다. 독립 로컬 예산8/8, 실제 두 API 테스트14/14 통과. 아래 최초141→143 실패를 삭제하지 않는다. 단언을 줄여 녹색으로 바꾼 것이 아니라 실제 프로토콜이 변경됐고 독립 HTTP/브라우저로 재시도와 무손실을 확인했다.

### FI-010 · 공개와 기록의 순서

[원본 로그](./authored-rework-open.log)는 실제4a RSC와 dfb29f SQL을 사용한4검사 통과/12필터 skip이다. 정상 별도 열람 이후 답은 first_exposure=false/evidence=false다. 기록 전 실패면 본문0문장·세션 미발급이며 이후 처음 성공한 열람/수행은 근거가 될 수 있다. 기록 commit 뒤 ack 유실이면 첫 응답 본문0, 기존 세션1이 남아 재열기/수행은 evidence=false다. 정상 최초 열람 즉시 수행은 evidence=true, 완료 복귀는 시도1행 유지다. 실제 제품 가드를 사용했고 독립 후보 패치를 넣지 않았다. 해당 RSC/SQL은01c/1ee에서 불변이다. 인증/세션 RPC transport는 합성이므로 실제 개발 DB/JWT 및 브라우저 네트워크 유실 전체를 검증한 것은 아니다.

### FI-015 · 실제 API와 실제 클라이언트

[실제 HTTP13검사](./state-rework-http.json)는 고정01c PUT/GET·continuity·meaning-note 소스를 native PostgreSQL17.10 풀에 연결했다. 동시 읽기를 맞춰 서로 다른 노트/같은 노트 수정의 초기 응답200/409, 경합 재시도 후 두 내용/최신 revision, 원래 first 텍스트·무관한 완료 이력 보존을 확인했다. DB commit 뒤 응답 소켓을 끊어 저장 유지·같은 패킷 재전송 중복 없음, 오래된 패킷의 후퇴 차단, 새 GET 일관성/no-store, NULL/마이크로초 timestamp, 강제 CAS 경합409·거짓 성공 없음, 미인증401도 통과했다. 모든 중간 편집 버전 보존을 주장하지 않는다.

[두 브라우저 컨텍스트](./state-rework-browser.json)는 실제 store.ts/IndexedDB의1.5초 타이머를 사용했다. 최초200/409 뒤 자동 재시도로 서버 두 노트가 남고 각 기기의 로컬 노트/sync 상태가 유지됐다. runtime 오류0/외부 요청0. 로그인/Reveal Gate는 합성이며 전체 theater 화면·실제 JWT/개발 DB·사람 수행과 효과는 범위 밖이다. 이전4a 서버6회 재시도의 [11검사](./state-rework-http-4a42.json)도 보존한다.

### FI-017 · 통합과 브라우저의 한계

옛 가상 통합 TS2300 실패는 [원본](./PR250_PR303_INTEGRATION.md)에 남긴다. 실제4a 통합 tsc exit0/관련68건, 최신01c 실제 API14건/예산8건과 필수 CI를 확인했다. [직접 해독한01c CI 브라우저](./rework-integrated-ci-browser.json)는8 expected/0 unexpected/0 flaky/0 skipped다. R5/9형식1280·1440, 자기 설명/reveal3건, 목표1건을 구분했다. 자기 설명 CI는 메모 패널/접근성 범위이며 실제 서버 저장을 증명하지 않는다. 위 별도 실제 store/API 검사가 변경 저장 경로를 보완한다. passing 화면/trace/HAR 첨부0으로 새 시각 관찰 주장도 하지 않는다.

### 개발 DB와 병합

[실제 READ ONLY 관찰](./rework-dev-readonly.json)2026-10-18T14:31:34.614327Z: authored/사람 결정 표 미설치, 자격/출시 승인/납품/결속0. state 표는 존재하고 timestamp를 덮는 trigger는 없다. 실제 학습자 본문/응답을 조회하거나 변경하지 않았다. SQL SHA dfb29f는 일치하나 실제 적용·사람 Gold/권리·실제 적격 공급과 전이/학습 효과는 NOT_VERIFIED다.

PR312의 녹색 CI를 보안 수용으로 대신하지 않는다. FI-018의 같은 완전성 계약에 잔여 반례가 있어 현재 safe-merge를 사용하지 않았다. 정책상 안전 조건이 충족된 후 병합하며 강제/우회하지 않는다. 최종 A~H는 [통합 보고서](./INTEGRATED_REPORT.md)를 따른다.

## 최초 재개 관찰 · 보존 기록

아래는4a42/f6f 단계의 최초 관찰이다. 위 현재 결과가 후속 수용 상태이며 아래 실패/당시 후속 계획을 현재 미수정 상태로 읽지 않는다.

사용자의 재개 지시 이후 새 HEAD를 확인했다. 요청303 b7b5ac424/2504b210bbb8은 보존하며 현재 고정303 **4a42b2b65eaaa164cc12a487dfcb806657ef9399**,250 **f6f74eb3831866380eb60b41e8aacea561d177cd**를 대상으로 한다. 실제 merge-base 검사에서250 최신 HEAD는303의 조상이다. 가상으로 import 한 줄을 지운 옛 후보가 아니라 이 실제 통합 HEAD를 검증한다. main은 c3a03d168이다.

현재 전체 판정 **REWORK · 재검증 진행 중**. 기존 최초 실패·수정 후보·보고서는 덮어쓰지 않는다. A~H를 좁히거나 새 TASK/필수 게이트를 만들지 않는다. 실제 DB 쓰기·Gold/권리 승인은 수행하지 않는다.

## 우선순위1 · 최신 CI와 검사 변경

[기계 기록](./rework-ci-triage.json). [303 CI39133318225](https://github.com/KangMin098/Vocaflow/actions/runs/39133318225)와 [250 CI39133224331](https://github.com/KangMin098/Vocaflow/actions/runs/39133224331)은 build/e2e/faultclosed 성공, verify 실패로 종료했다. shared-dev는 SKIPPED이며 실제 DB 성공이 아니다. 상세 브라우저 산출물 판독 전 CI 성공을 모든 새 UI/저장 경로 수용으로 확대하지 않는다.

요청 HEAD의 이전 CI39132530823/39132293734는 route-race.test.ts42행 `_val` 미사용 lint로 빌드도 막혔다. f6f74eb38은 mock의 `.is(col, _val)`에서 안 쓰는 두 번째 매개변수만 제거했다. 조건/정답 단언 삭제나 테스트 제외는 없었다. 최신 빌드 성공과 아래 실제 테스트로 확인했다.

실제 통합 소스의 웹 `tsc --noEmit`은 exit0(CODE_VERIFIED). 관련5파일은68/68 통과했다. 실제 route/merge와 격리 PGlite를 쓰는 검사도 포함하지만 인증·게이트 transport는 합성이므로 실제 DB/JWT나 새 전이·PLAN 증거로 계산하지 않는다. 최초 병렬 실행은 V8 native Zone 메모리 부족으로 종료됐으며 제품 실패로 세지 않았다. 종료를 확인한 뒤 단일 fork로 실행해68건 완주했다.

쓰기 예산은 로컬 LF 소스에서도8건 중1실패/7통과, **141→143**이다. 테스트 기준선은 그대로다. 새2후보는 `api/csat/state/route.ts`99/104행의 같은 학습자 상태에 대한 최대6회 CAS 재시도에서 나온다.99행은 insert인데500자 창의 뒤 update 때문에 후보로 잡힌다.104행은 실제 조건부 update다. 이는 전량 행별 드레인과 다르지만 수치만 올려 성공으로 바꿨다고 수용하지 않는다. 해당 경합/재시도 안전성과 스캐너의 중복 판정 또는 문서화한 제한 범위를 함께 확인해야 한다. 필수 verify 실패가 남아 병합할 수 없다.

## FI-006 · 실제 PostgreSQL17.10 두 연결

실제 SQL 파일 SHA는 **dfb29f2dc3c3c0ecf516bdf47efa1d50f2f203ef7d399a60f3072d57c93ac229**로 사용자 보고값과 같다. 승인 패키지의 다른 해시를 적용했다고 주장하지 않는다. 개발 DB 적용은 별도 미확인/금지 범위다.

[실행기](../../../apps/web/scripts/final-independent/probe-authored-concurrency.ts)의 `--owner-rework`는 고정 HEAD의 실제 SQL을 로컬 PostgreSQL17.10에 적용했다. 이전7e/b4 실패 결과는 기존 문서에 그대로 남긴다.

|사례|두 연결/커밋 후 결과|역사적 영수증/요청 본문|
|---|---|---|
|[같은 ref·같은 자격/승인·다른 Workspace/수요 줄](./authored-rework-same-ref.json)|둘째가 advisory 잠금 대기 후 거절, 납품1|동일 요청은 같은 영수증, 다른 본문의 같은 키는 거절, 기존 행/수량 불변|
|[같은 그룹·다른 본문 key](./authored-rework-shared-group-different-text.json)|대기 후 거절, 납품1|동일|
|[같은 본문·다른 그룹/ref](./authored-rework-alias-groups.json)|대기 후 거절, 납품1|동일|
|[서로 다른 정상 지문](./authored-rework-different-passages.json)|직렬화 뒤 둘 다 허용, 납품2|동일|

FI-006은 **FIX_VERIFIED_IN_CANDIDATE / ISOLATED_DB_VERIFIED**다. 실제 사람/DB·Supabase JWT·격리 밖 공급 성공이 아니다. [22개 실제 역할 대조](./authored-rework-rls-only.json)도 모두 통과했다. 본인/타인/익명/관리자/서비스의 읽기·직접 쓰기·사람 결정/RPC 경계를 최소 의존 스키마에서 확인했으며 실제 개발 DB 역할/JWT 전체 수용으로 확대하지 않는다. 각 임시 클러스터는 정상 종료와 postmaster.pid 부재를 확인하고 ignored 영역에 보존했다.

## FI-014 · 실제 제품의 채택 결속

[소스 결속](./fi014-adopted-source-binding.json): 실제 format 채점기/validator, AuthoredRunner 전체 바이트와4문항 Gold 변경 파일이 독립 후보0a06b5d11에서 검증한 것과 같다. [기존1,596조합/잘못된 Gold7종/브라우저12건](./FI014_CANDIDATE.md)을 재사용하며, 새 제품 실제68건 검사도 통과했다. 변경 없는 조합을 반복해 새 검증 건수로 늘리지 않는다.

FI-014는 해당 코드·후보 브라우저 범위의 **FIX_VERIFIED_IN_CANDIDATE**다. 잘못된 덩어리/무관한 이유 거절과 정당한 문항별 대체 이유/해설은 후보 검증 근거를 유지한다. 실제 등록 Gold hash/revision·해당 revision의 사람 검수/자격 연결은 별도다. AI 성공을 HUMAN_CONTENT_APPROVED로 올리지 않는다.

## 남은 재검증과 증거 수준

FI-010은 실제 RSC의 기록 성공/저장 실패/저장 뒤 응답 유실/재열기·본문 공개와 독립 근거를 후속 확인한다. FI-015는 실제 서버 API의 같은/다른 노트·동시 기기·재전송/조회·과거 기록을 확인한다. FI-016/018은 기존 비공개 경로를 유지하며 공개 원장에는 민감한 위치/절차/코드를 싣지 않는다. FI-017은 실제 통합 HEAD의 타입·빌드·단위/통합·화면/저장/G2·복귀를 함께 보며 개별 PR 성공으로 대신하지 않는다.

검증 수준은 CODE_VERIFIED / ISOLATED_DB_VERIFIED / ISOLATED_BROWSER_VERIFIED / DEV_DB_VERIFIED / HUMAN_CONTENT_APPROVED / ACTUAL_LEARNER_EVIDENCE / NOT_VERIFIED로 구분한다. 현재 실제 공급·사람 승인·실학습 효과는 새 성공 증거가 없다. 전체 A~H는 [통합 보고서](./INTEGRATED_REPORT.md)를 유지하며 후속 결과로 갱신한다. P1/핵심 P2 또는 필수 CI·목적·safe-merge 문제가 남으면 병합하지 않는다.
