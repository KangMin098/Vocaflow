# T-0108 b6 2차 정정 독립 재검증

v2.4 봉인 보류 — §4 결정 대기 유지와 별개로 §3 direct 단일 예외 우회(P1)를 먼저 막아야 한다.

검증 수행 완료. 새 P0 **0건**, 새 P1 **1건**. pass는 검증 수행 완료이며 데이터 전량 합격이나 봉인 승인이 아니다.

owner goal-data-independent · session t-0108-codex. 첫 조회에서 IN_PROGRESS·세션 일치, 추가 대기 불필요. PID 조회 명령 없음. 입력 fdde27456da8b943ad67b85b090bf56729ea7c2f, 기준 16561e87506f4186083a2423439e62db1211d71f. 패킷 관찰 2026-10-23T06:57:09.045Z. 중앙 dev-minimal-20261020 확인. 입력 worktree 읽기 전용·DB 접근 없음.

## 수용 기준

### 0. resolved

D2·D3 makeValidator 공통화 및 기존 P1 우회 해소. legacyV1 호출은 pilot-1에만 지정되며 반사실 검사만 면제한다. 이유 누락·E2 위반·반복은 D3도 거부한다.

- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/d2-run.mjs:12
- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/d2-run.mjs:32
- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/d3-build.mjs:29
- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/d3-build.mjs:49
- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/d2-validate.mjs:25

### 1. unresolved

공급된 4/4와 2행 완전 반복·3행 골격·교차 청크 반례 거부는 재현. 그러나 direct 단일 접두사만으로 다중 direct 3행의 골격 검사를 우회한다. b2–b6 현행 계약 회귀 결함0과 새 v2.4 반례를 구별한다.

- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/d2-validate.mjs:18
- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/d2-validate.mjs:85
- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/d2-validate.check.mjs:12
- scripts/research/goal-data/review-b6/recheck2-probes.mjs:17

### 2. resolved

M2506#40 B E2→R5 정정을 원문이 지지한다. #33/#34 A·B R6 direct/R5 indirect는 범위 확장·문장 결합·비교 강도 차이로 지지된다. 표현이 다른 판단 흔적은 있으나 독립 생성 과정은 unclear이며 일부 구 설명은 여전히 재진술로 남았다.

- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/input.json:3273
- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-B-02.out.json:108
- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/input.json:2156
- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-A-01.out.json:1716
- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-B-01.out.json:1781
- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/input.json:2303
- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-A-01.out.json:1846
- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-B-01.out.json:1912

### 3. resolved

225/240=.9375, κ=.8921542195→.8922, 주 TASK33/40, b6 R1 93·갈림15, 결합604·갈림343, D3 166/198 재현. 안정5 경보 모두 ok. E2는 안정5 밖이다.

- D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D2-task-mapping/b6-v23-agreement.json:39
- D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D2-task-mapping/mapping-coverage.json:21
- D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D3-principles/item-reasoning.jsonl:1
- scripts/research/goal-data/review-b6/recheck2-probes.mjs:35

### 4. unresolved

새 P0 0·P1 1. §4 결정 대기·연구 후보 표시 유지 자체는 타당하지만 §3 예외 우회가 남아 v2.4 봉인은 보류. 원문·명령 출력은 *.local.json에만 보존하고 unclear를 유지했다.

- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/d2-validate.mjs:85
- D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D2-task-mapping/CONTRACT_V2_4.md:27
- D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D2-task-mapping/CONTRACT_V2_4.md:32
- docs/research/goal-data-batches/review-b6/recheck2.json:1

## 새 결함

### T0108-P1-01 · P1 · unresolved

direct 단일 예외가 실제 direct 수를 검사하지 않아 §3 골격 반복 검사를 우회한다.

v2.4 행 M2506#20/#21/#22는 각각 direct 2개. 다른 필드는 그대로 두고 이유를 동일 한국어 골격 및 서로 다른 영어·인용·번호로 만들면 거부되나, direct 단일 접두사를 붙이면 V.row 오류0·V.reasons 오류0·D2 대상행 수용·D3 세 행 수용. 완전 동일 두 행은 접두사와 무관하게 거부된다.

계약상 문항별 주 TASK 이유를 템플릿으로 채워도 D2와 D3 모두 통과시킬 수 있다. 현재 b6 산술 오류나 생성 부정의 증거는 아니다.

예외를 links의 실제 direct 개수=1 및 primary 일치로 제한한다. 다중 direct의 허위 단일 표지를 거부하고, 실제 단일은 결정 지점의 유효성을 검토한다. 수정 전 봉인 보류.

- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/d2-validate.mjs:18
- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/d2-validate.mjs:85
- scripts/research/goal-data/review-b6/recheck2-probes.mjs:17

### T0108-P2-01 · P2 · unresolved

재판정된 R6와 일부 기존 D3 설명의 재진술 표현이 불일치한다.

A #33 decision_path·answer_logic은 한 연구 문장의 재진술을, B #34 decision_path는 기존 판단의 재진술을 여전히 말한다. 새 primary_reason·R6 why의 복수 문장 결합 설명과 맞춰 갱신할 필요가 있다. 원문 정답과 R6 후보 판정 자체를 뒤집는 P1로 확대하지 않는다.





- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-A-01.out.json:1716
- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-B-01.out.json:1912
- D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D3-principles/item-reasoning.jsonl:173
- D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D3-principles/item-reasoning.jsonl:174

## 재실행과 원문 대조

공통 검사기는 git show로 고정한 코드에서 원래 검증 로직을 유지하고 파일 읽기·CLI만 주입했다. D2 agree 쓰기는 메모리로 받았고 b6 산출4개는 고정 커밋과 바이트 일치했다. D3 passed도 실제 함수 본문을 실행했다. 이유 누락·E2 위반은 유효 대조군과 비교했고 양 경로가 함께 거부했다. legacyV1은 호출부에서 pilot-1에만 주며, 직접 반례에서 반사실만 면제하고 v2.4 이유 필수 검사는 유지함을 확인했다.

공급된 check 4/4는 그대로 재현했다. 독자 반례는 완전반복2행·골격3행·청크1/2 경계 반복을 모두 거부했다. 실제 단일 direct3행의 형식은 허용하고 동일문장2행은 거부했다. 다만 단일 형식 예외가 direct 개수를 보지 않아 다중 direct3행이 같은 방식으로 통과했다. 제공된 단일 형식 테스트는 links를 갖지 않아 이 악용을 검사하지 못한다.

b2/b3/b4/b5/b6의 D2·D3 A/B 수용은 각각40/8/40/38/40, 결함0. 기존 secondary 18반례·반복 예외5종도 기대대로 재현했다. 이 결과는 각 배치의 현행 계약 구조 검사이며 의미상 무결성이나 b6 전체의 v2.4 적격 인증은 아니다.

M2506#40: 성장의 기여만 보면 (A)에①②⑤가 남으며 직접 지원의 핵심성을 (B)에 대응시켜②를 고른다. E2가 더 결정적이라는 이전 이유를 고친 R5 후보는 지지된다. #33은 결정에 관한 연구 문장만으로 주관 경험·해결책 전체를 동일 범위로 진술했다고 보기 어려워 앞의 환경·경험 결합과 합치는 R6 판단이 타당하다. #34는 기초 지각의 상대적 일관성, 완전 균일성 부정, 가끔 남는 차이를 합쳐 공통점 우위의 비교를 얻는다. 한 문장의 동등 재진술로 확정하던 R5보다 새 R6 후보를 지지한다. R5 indirect의 중심 오인 반사실은 실제 오답 번호와 연결돼 구조상 유효하나 학습자의 실제 오류 원인 인증은 아니다.

A/B는 #33에서 범위 확장과 앞뒤 문장 결합을 서로 다르게 설명하고 #34에서도 비교 강도·양보를 각자 표현했다. 이는 별도 내용 판단 흔적이다. 재판정 시점의 독립 세션 로그가 없어 생성 과정의 독립성은 unclear로 남긴다. 같은 정정 요청을 받은 뒤 일치했다는 사실만으로 독립성이나 정확도를 인증하지 않는다.

산술: 225/240=.9375, κ=0.8921542194661634→.8922, primary33/40. R1은 b6 93·결합604, 갈림15·343. D3 primary166/198, 전체 오답514/792·원문 오답502/780. 안정5 경보 모두 ok. E2 일치0.775·κ0.6703296703296704는 안정5 밖이며 숨기지 않는다. D3 40행의 양 트랙 primary·설명·오답 전파는 패킷과 일치한다.

전체14파일 diff를 보관하고 코드·v2.4 초안·b6 및 결합/D3 변경을 대조했다. 부수 authored-ai-record/deploy.mjs는 승인 티켓/TTY·SQL SHA 확인 경로를 읽었지만 실행·DB 승인·전면 보안 인증은 하지 않았다. README의 b6 κ 표시는 .891로 남아 새 값 .8922를 반영하지 못한 경미한 문서 지연도 있다.

§4는 결정 대기 제목을 유지하며, 같은8문항 시험6/8과 수정 후 b7 관측을 구별한다. 수정한 규칙의 미관측 검증은 아직 없다. direct 집합 권고도 연구 후보로만 유지해야 하며 공개 relevance=unknown·NeedRank 입력 금지를 바꾸지 않는다. §4 대기 표시가 §3의 재현 가능한 P1을 면제하지 않는다.

## 불확실성·범위·재현

- unclear: A·B 실제 생성 과정의 독립성(별도 판단 문구·파일은 있으나 세션 로그 없음)
- unclear: 2022#33 E2/R5 우열 및 E3 direct/indirect
- unclear: 기존 b5 제외 원천 상태·복구 과정·갈림 및 V4 경계
- unclear: 고친 §4 규칙의 미관측 문항 타당도·일치 상승 원인·학생 효과
- unclear: direct 집합의 제품 관련도 사용 적격성

실행: `node scripts/research/goal-data/review-b6/recheck2-probes.mjs` → `node scripts/research/goal-data/review-b6/write-recheck2.mjs`. assertions 통과. 초기 보조 준비 명령은 python 실행 불가로 실패하여 Node로 작성 후 성공했다. 새 파일의 이전 커밋 부재 진단은 예상된 diff 처리이며 검증 실패가 아니다. 원문·인용·명령 출력은 *.local.json에만 저장한다.

skip_count=0은 요구된 검증 수행 완료이다. DB/SQL·제품 E2E·사람 검수·D5 외부 확인·main/원격 통합은 범위 밖 미실행이며 통과가 아니다. Git add/commit 시도 후 evidence·submit의 실제 출력은 recheck2-command-output.local.json에 기록한다.
