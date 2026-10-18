<!-- docs/research/final-independent-20261018/REWORK_DELTA_REVERIFY.md -->
# REWORK 변경분 독립 재검증 · 진행 원장

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
