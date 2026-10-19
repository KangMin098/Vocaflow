<!-- docs/research/final-independent-20261018/FI019_KST_PLAN.md -->
# FI-019 · KST 당일 기록의 미래 기준 시각으로 PLAN 거절

**핵심 P2 / FIX_VERIFIED_IN_CANDIDATE · CODE_VERIFIED**, 기존 [#313](https://github.com/KangMin098/Vocaflow/issues/313). 최초 실패 f8aa32239fc40b741116e5773dfb617992008bcd, 수정 e54def25a2a745242fab0a6ad7a726dafa5d9305. 병합/개발 DB 적용 판정이 아니며 최초 실패는 아래에 보존한다. 같은 날짜 처리 문제는 이 ID로 추적한다.

## 수정 후 독립 재검증 · 2026-10-19

e54의 실제 변경3파일을 대조했다. `as-is.ts`는 DATE만 KST00시로 해석하고 timestamp 해석은 유지한다. `definition.ts`의 정본 효력일도 같은 달력의 KST00시로 맞췄으며, 기존 미래5분 SQL 가드는 바꾸지 않았다. 실제 변경 파일만 격리 스냅샷에 결속해 실행한 작성자 v4 단위 검사는 **29/29 PASS**다. 제품 worktree나 실제 DB는 수정하지 않았다.

[같은 실행기의 수정 HEAD 결과](./plan-kst-asof-e54def25a.json)는 **5/5 PASS**다. 두 KST 오전 반례는 asOf=현재이고 당일 기록을 유지했다. 오전9시 이후/전날 대조도 통과했으며, 명시적 미래 timestamp는 계속 거절·제외됐다. CI가 자연 시각상 UTC 자정을 넘긴 것만을 수정 증거로 쓰지 않았다.

[수정 CI39178562223](https://github.com/KangMin098/Vocaflow/actions/runs/39178562223)의 새 여정은 최초 PLAN200을 지나 지도 관찰까지 진행했다. [원본 report](./journey-ci-e54-popup.json)는 기존10성공/여정1실패이며 전체 E2E 성공은 아니다. 실제 실패 화면1440px는 R5가 초점 상태인 지도를 보여 주고 팝업은 없다. 제품의 첫 클릭 초점→두 번째 클릭 상세 계약과 달리 테스트가 한 번만 눌렀다. 후속35d43cbcf8623b29652c650f3f388a7c906f972c는 그 상호작용만 고쳤으며, FI-019 제품3파일은 같아 5+29 검증을 반복하지 않는다. 전체 여정·증거 환류의 다음 단언은 별도로 확인한다.

## 실제 관찰과 최초 실패 보존

[CI39177372662 실패 job](https://github.com/KangMin098/Vocaflow/actions/runs/39177372662/job/117822720215)은 fixture 적재/기존10검사를 통과한 뒤 새 동일 학습자 테스트의 첫 PLAN에서 `422 as_of_future`로 실패했다. [직접 해독한 원본 report](./journey-ci-f8-original.json)는11건 중10 expected/1 unexpected/0 flaky/0 skip이다. 실패 첨부3개는 CI/ignored 원본에 보존하고 실제 문항/화면 원문을 공개 검증 브랜치에 복사하지 않았다.

앞선264f의 exam_year NOT NULL fixture 실패와 다르다. 그 최초 실패도 [종단 원장](./journey-review-20261019.json)에 보존했다. f8의 유효한 당일 입력으로 실제 서버/격리 PostgreSQL RPC가 거절된 것이 이번 제품 결함이다. 새 여정은 초기 PLAN 이후로 진행하지 못했으며 수행/G2/PLAN 환류 성공으로 세지 않는다.

## 실제 함수·고정 시각 반례

[실행기](../../../apps/web/scripts/final-independent/probe-plan-kst-asof.mjs)는 고정 후보의 실제 currentAsOf/asIsMap을 번들링하며 실제 파일 바이트/hash를 확인한다. SQL 미래5분 보호의 원문도 대조했다. [원본 결과](./plan-kst-asof-original.json)는2실패/3정상 대조다. 새 실제 DB 쓰기나 SQL 재실행은 하지 않았다.

|입력/대조|실제 코드 결과|판정|
|---|---|---|
|KST19일08:47:30, 수행일19일, 입력 시각08:47:29|기준 시각19일00:00Z = KST09시, 현재보다750초 미래|정상 PLAN이 거절되는 반례|
|KST19일00:05, 수행일19일|현재보다32,100초 미래|같은 반례|
|KST19일09:10, 수행일19일|기준 시각은 현재, 기록 유지|정상 대조|
|KST19일08:47, 수행일18일|기준 시각은 현재, 기록 유지|정상 대조|
|명시적 미래 enteredAt timestamp|기존5분 보호가 거절, 현재 기준 기록도 제외|유지해야 할 정상 대조|

`compose.ts:64 currentAsOf`는 DATE인 takenAt을 최대 timestamp로 채택한다. `as-is.ts:149 ms`는 날짜 문자열을 UTC00시로 읽는다. 실제 입력 API의 todayKst·DATE와 어긋나 현재보다 뒤인 기준 시각을 만든다. PLAN API는 그 값을 RPC로 보내고 기존 SQL 보호가 올바르게 거절한다.

원본은 기준 시각을 앞으로 밀어 당일 기록을 포함하지만 PLAN을 저장하지 못한다. **asOf만 현재로 자르는 수정**에서는 기존 asIsMap이 같은 당일 기록을 after_as_of로 제외한다. 실행기는 이 수정 방지 조건도 함께 대조한다. 수정 수용은 KST 당일의 PLAN 성공과 기록 유지, 명시적 미래 timestamp 거절을 모두 요구한다.

UTC 자정이 지나면 같은 원본 코드의 실제 시계 CI도 통과할 수 있다. CI의 색만으로 닫지 않고 고정 시각·실제 수정 HEAD·회귀 결과로 판단한다. 유효한 당일 입력과 SQL의5분 미래 보호를 유지한다. 테스트 입력을 이전 날짜로 옮기거나 미래 보호를 완화한 결과를 이 결함의 수정으로 계산하지 않는다.

## 인계/전체 목표

[PR303 인계](https://github.com/KangMin098/Vocaflow/pull/303#issuecomment-6256756754). 제품 source 경로는 현 검증 task의 수정 소유권 밖이므로 실제 제품을 편집하지 않고 실행기·반례·정상 대조·기대 동작을 담당에게 전달했다. 수정 HEAD를 같은 #313에서 독립 재검증한다.

A의 날짜/기준 시각 의미와 B→C/H 계획 저장 연결을 막았으며 후보 수정은 위 범위에서 확인했다. 전체 REWORK는 FI-018 미해결 및 전체 여정 미수용으로 유지한다. FI-010 VERIFIED_FIXED·FI-015 명시 범위의 기존10건 수용은 유지한다. 실제 개발 DB 적용·사람 Gold/권리·실제 학습자/효과와는 별개이며 FINAL_COMPLETE를 선언하지 않는다.
