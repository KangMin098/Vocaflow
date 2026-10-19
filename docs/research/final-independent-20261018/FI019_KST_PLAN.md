<!-- docs/research/final-independent-20261018/FI019_KST_PLAN.md -->
# FI-019 · KST 당일 기록의 미래 기준 시각으로 PLAN 거절

**핵심 P2 / REWORK / OPEN**, 기존 [#313](https://github.com/KangMin098/Vocaflow/issues/313). 대상 f8aa32239fc40b741116e5773dfb617992008bcd. as_of_future/currentAsOf 기존 이슈 검색 결과0건을 확인하고 한 이슈로 등록했다. 같은 날짜 처리 문제는 이 ID로 추적한다.

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

A의 날짜/기준 시각 의미와 B→C/H 계획 저장 연결을 막는다. 전체 REWORK에 FI-018과 함께 반영한다. FI-010 VERIFIED_FIXED·FI-015 명시 범위의 기존10건 수용은 유지한다. 실제 개발 DB 적용·사람 Gold/권리·실제 학습자/효과와는 별개이며 FINAL_COMPLETE를 선언하지 않는다.
