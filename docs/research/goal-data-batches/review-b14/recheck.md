# T-0123 · 행 단위 틀 가드 독립 재검

**기준 수정 필요.** 새 P0 0 · 새 P1 2. result=pass는 검증 수행 완료이며 완화 수용을 뜻하지 않는다. skip_count=0.

입력 30ea8e94f293f81c910708d04545d50976536d8f, diff 57b7e7006..30ea8e94f293f81c910708d04545d50976536d8f의 3파일 전체와 mapping-review §18 끝까지 읽었다. 최초 task show에서 IN_PROGRESS/session t-0123-codex 일치해 대기 불필요. PID 조회 없음. 입력 worktree는 읽기만 했다. 코드·계약은 Git 객체에 고정하고, ignored 원문 패킷은 이전 캡처와 현재 파일의 바이트 동일성을 재확인했다. 원문·명령 출력은 recheck.local.json 및 finish-recheck.local.json에만 보존한다.

## 수용 기준

- AC0 **confirmed** — 반례16/16, 최초B01 차단, b3 B·b6 A 허용, 28트랙 중 b8 A만 적발. 활성화 조건만 메모리에서 해제하고 독립 집계와 실제 reasons 결과를 28트랙 모두 대조했다. 배포 검증기의 비소급 정책과 구분한다. (scripts/research/goal-data/d2-validate.mjs:132; scripts/research/goal-data/d2-validate.check.mjs:22; scripts/research/goal-data/review-b14/recheck.mjs:35; scripts/research/goal-data/review-b14/recheck.mjs:59)
- AC1 **refuted** — 반복1줄+무의미 고유1줄이 통과한다. 정확한 1+1 반례는 차단. 단 1+2는 통과하며 실제40행 runner에서도 재현되어 우회 위험은 confirmed(P1-01). (scripts/research/goal-data/d2-validate.mjs:132; scripts/research/goal-data/review-b14/recheck.mjs:53)
- AC2 **refuted** — b13 A·b9t-v24 A가 빠진 것은 나머지 줄이 문항 고유이기 때문이다. 52행 전수 대조. 반복 관련9행 중 b13 #29/#30은 나머지 설명 자체가 없고 각각1/1이다. b13 나머지3행과 b9t4행의 다른 설명에도 여러 문항에 성립하는 공통 관측 한계가 있다. 근거 위치/대응 TASK와 일관됨은 문항 고유성과 다르다. 링크 유지·공통 설명 격리는 수용한다. 의미 Gold와 primary 단일 우열은 unclear. (docs/research/goal-data-batches/D2-task-mapping/mapping-review.md:286; scripts/research/goal-data/local/b13-v24/chunk-A-02.out.json:688; scripts/research/goal-data/local/b13-v24/input.json:4154; scripts/research/goal-data/local/b13-v24/chunk-A-02.out.json:1628; scripts/research/goal-data/local/b13-v24/input.json:5480; scripts/research/goal-data/local/b13-v24/chunk-A-02.out.json:1751; scripts/research/goal-data/local/b13-v24/input.json:5636; scripts/research/goal-data/local/b13-v24/chunk-A-02.out.json:1987; scripts/research/goal-data/local/b13-v24/input.json:5923; scripts/research/goal-data/local/b13-v24/chunk-A-02.out.json:2090; scripts/research/goal-data/local/b13-v24/input.json:6061; scripts/research/goal-data/local/b9t-v24/chunk-A-01.out.json:148; scripts/research/goal-data/local/b9t-v24/input.json:779; scripts/research/goal-data/local/b9t-v24/chunk-A-01.out.json:235; scripts/research/goal-data/local/b9t-v24/input.json:1253; scripts/research/goal-data/local/b9t-v24/chunk-A-01.out.json:264; scripts/research/goal-data/local/b9t-v24/input.json:1390; scripts/research/goal-data/local/b9t-v24/chunk-A-01.out.json:322; scripts/research/goal-data/local/b9t-v24/input.json:1675)
- AC3 **confirmed** — 대안 기준을 판정하고 새 P0/P1 및 산출물을 기록한다. 계약 허용 공통 관측 한계를 화이트리스트/별도 코드로 분리하고 나머지는 문항 단위 반복 기준을 유지하는 대안을 권고한다. 1+1·1+2, 임의 삽입E2, 실제B01, b3/b6를 한 회귀 집합으로 삼아야 한다. 구체 화이트리스트의 전량 오탐/누락 성능은 미측정이며 수치 개선을 주장하지 않는다. (docs/research/goal-data-batches/review-b14/recheck.md:1; docs/research/goal-data-batches/review-b14/recheck.json:1)

## 재현 결과와 새 P1

기존 반례16/16, 최초 b14 B01 runner 차단, 28트랙 독립 집계 일치. 새 가드를 과거 전체에 메모리 적용하면 b8 A만 반복20문항·7문항의 두 그룹으로 적발된다. b3 B·b6 A는 허용된다. 이는 실제 과거 배치의 비소급 정책을 변경한 실행이 아니다.

**RECHECK-P1-01 — 무의미한 고유 설명 2개로 반복 설명 비율을 희석하면 트랙 전체가 통과한다.** 동일 반복 1줄+무의미 고유 1줄은 1/2라 차단, 고유 2줄은 1/3이라 허용. b14 A 실제 2021#32/#33/#34의 not_observable만 치환한 40행 트랙도 실제 runner 통과. 문항 근거가 없는 설명이 추가될수록 반복 가드가 약해진다. primary/decision_path 고유성은 not_observable 의미 검증을 대신하지 못한다. 행 설명 수를 분모로 쓰지 않고, 허용된 공통 관측 한계만 별도 분류한 뒤 나머지 반복은 기존 문항 수 기준으로 검사한다. (scripts/research/goal-data/d2-validate.mjs:132; scripts/research/goal-data/review-b14/recheck.mjs:59)

**RECHECK-P1-02 — 삽입 E2의 계약 고정 문구 예외가 모든 문자열 예외로 구현됐다.** 삽입 E2의 why를 계약과 관계없는 동일 설명으로 바꾼 실제 b14 A 삽입 3행도 runner 통과. TASK/type만 보고 제외하며 why 내용은 비교하지 않는다. 계약 고정 문구를 보호하려던 예외가 삽입 E2의 근거 없는 반복까지 검사 밖으로 만든다. 계약 버전+입력 유형+TASK+허용 문구/명시적 관측 한계 코드로 예외를 제한하고, 다른 문구에는 문항 단위 반복 검사를 적용한다. (scripts/research/goal-data/d2-validate.mjs:126; scripts/research/goal-data/d2-validate.mjs:134; docs/research/goal-data-batches/D2-task-mapping/CONTRACT_V2_2.md:26)

정확한 요청 반례인 반복1+고유1은 차단되어 그 명제는 refuted다. 더 강한 반복1+고유2 반례는 실제 runner에서 A 40/40·결함0으로 통과했다. 삽입 E2 임의 문구 반례도 A 40/40·결함0이다. 두 반례는 메모리에서만 치환했고 파일·DB에 적용하지 않았다.

## b13 A·b9t A 행별 판정

두 트랙52행의 not_observable를 decision_path·primary_reason·원문 근거 인용과 대조했다. 각 행·각 설명의 평가는 recheck.json의 row_review에 둔다. 문장 완전 일치3문항 미만은 고유 근거의 충분조건이 아니다. 여기서 context_supported는 원문·TASK 맥락에 맞는다는 뜻이며 그 원문에서만 참인 설명이라는 뜻이 아니다. 아래는 완화로 이전 반복 그룹에서 빠진9행 전부다.

|트랙·문항|나머지 줄의 판정|파일:줄|
|---|---|---|
|b13-v24/A M2206#45|근거 단락/위치·대응 문장 지목의 공통 관측 한계; 문항 고유라고 볼 수 없음|scripts/research/goal-data/local/b13-v24/chunk-A-02.out.json:688; scripts/research/goal-data/local/b13-v24/input.json:4154|
|b13-v24/A 2021#26|근거 단락/위치·대응 문장 지목의 공통 관측 한계; 문항 고유라고 볼 수 없음|scripts/research/goal-data/local/b13-v24/chunk-A-02.out.json:1628; scripts/research/goal-data/local/b13-v24/input.json:5480|
|b13-v24/A 2021#27|근거 단락/위치·대응 문장 지목의 공통 관측 한계; 문항 고유라고 볼 수 없음|scripts/research/goal-data/local/b13-v24/chunk-A-02.out.json:1751; scripts/research/goal-data/local/b13-v24/input.json:5636|
|b13-v24/A 2021#29|나머지 줄 없음(반복1/1). 그룹의 다른3행이 절반 미만이라 트랙에서 빠짐|scripts/research/goal-data/local/b13-v24/chunk-A-02.out.json:1987; scripts/research/goal-data/local/b13-v24/input.json:5923|
|b13-v24/A 2021#30|나머지 줄 없음(반복1/1). 그룹의 다른3행이 절반 미만이라 트랙에서 빠짐|scripts/research/goal-data/local/b13-v24/chunk-A-02.out.json:2090; scripts/research/goal-data/local/b13-v24/input.json:6061|
|b9t-v24/A 2022#45|근거 단락/위치·대응 문장 지목의 공통 관측 한계; 문항 고유라고 볼 수 없음|scripts/research/goal-data/local/b9t-v24/chunk-A-01.out.json:148; scripts/research/goal-data/local/b9t-v24/input.json:779|
|b9t-v24/A M2406#26|전쟁 문장이라는 문맥 단서가 있으나 여러 전쟁 문항에 적용 가능; 다른 줄은 공통 한계|scripts/research/goal-data/local/b9t-v24/chunk-A-01.out.json:235; scripts/research/goal-data/local/b9t-v24/input.json:1253|
|b9t-v24/A M2406#27|시각-항목 대응은 시간표 문맥과 일관; 항목 특정은 공통 한계|scripts/research/goal-data/local/b9t-v24/chunk-A-01.out.json:264; scripts/research/goal-data/local/b9t-v24/input.json:1390|
|b9t-v24/A M2406#45|대상 대응은 스무디 문맥과 일관; 근거 단락 특정은 공통 한계|scripts/research/goal-data/local/b9t-v24/chunk-A-01.out.json:322; scripts/research/goal-data/local/b9t-v24/input.json:1675|

특히 b13 #29/#30은 반복 설명만 있는 행인데도 트랙이 살아난다. 같은 반복 그룹 안에서 절반 이상인 행이2개뿐이라 3개 문항 임계값에 미달한다. §18의 「행마다 한 줄, 나머지 설명은 문항 고유」라는 일반화는 이 두 행에도 맞지 않는다. 근거 판정 필드가 원문에 결속한다는 이전 결론과 링크 유지는 수용하지만, 이를 not_observable 설명의 고유성이나 가드 안전성으로 확장하지 않는다.

## 대안 기준

계약상 허용된 관측 한계 문구를 버전·TASK·유형과 결속한 화이트리스트 또는 별도 코드로 분리한다. 공통 제한은 문항 고유 근거로 집계하지 않는다. 그 외 설명은 분모 희석 없이 기존 문항 수 기준을 유지하고, 원문/다른 판정 필드에 근거가 있는지는 별도 검토한다. 삽입E2는 계약상 의미만 제외해야 하며 유형만으로 모든 문자열을 제외하면 안 된다. b3/b6 실제 설명과 최초B01, 1+1·1+2, 임의 삽입E2를 함께 회귀 검사한다.

이는 대안의 설계 판정이다. 새 화이트리스트를 구현하거나 전량 정밀도/재현율을 측정하지 않았으므로 개선 수치는 주장하지 않는다. 의미 Gold·학습효과는 unclear다. 다음 배치는 위 우회 경계를 수정·검증하기 전 조건부 보류한다.

## 검증·마무리

재현 검사 227개 실패0(결함 반례가 기대대로 발생한 검사 포함), 수용기준4개 모두 조사. 원자료·D2 산출물·DB 쓰기 없음. 제품 E2E·main/원격 통합 미실행. 요청한 Git add/commit 시도 후 evidence→submit 원문은 finish-recheck.local.json에 기록하며 커밋 성공 여부와 검증 수행 완료를 구분한다.
