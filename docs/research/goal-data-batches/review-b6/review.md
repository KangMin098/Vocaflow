# T-0105 b6-v23 독립 검증

**검증 수행 완료. 데이터는 부분 정정·재판정 필요.** 산술·P2-01 수정은 재현되지만 B-02 primary 절차 위반과 원문 설명 오류를 수용하지 않는다.

owner goal-data-independent / session t-0105-codex. 첫 task show에서 IN_PROGRESS 및 세션 일치 확인하여 추가 대기 불필요. PID/프로세스 조회 명령 없음. 입력 c6adb90901ec4045bc09c979a909b369ce408b22, 기준 e81b759f1b4fce33b4d4327b7820a70d55b3e4e7. 로컬 패킷 관찰 2026-10-23T06:27:58.886Z. 입력 worktree는 읽기 전용, DB 접근 없음. 중앙 development_policy(dev-minimal-20261020) 확인.

## 방법과 범위

전체 17파일 diff를 diff.local.json에 보관하고 코드·문서를 읽었다. JSONL은 모든 기존 행/필드의 유지와 추가를 비교했다: D2 후보+91/갈림+15, 기존 삭제·수정0; D3 사고과정+40/오답+160, 기존 삭제·수정0. coverage·agreement 및 D3 집계/분류 변화도 확인했다. 부수 diff의 nonrelease 계획38건·실행 스크립트는 읽기만 했고 실행·자격 승인하지 않았다. 코드/문서는 git show @c6adb9090로 고정, 다른 owner의 v2.4 작업은 사용하지 않았다. 읽기 명령의 safe.directory는 명령별 -c만 사용, 전역 설정 변경 없음.

check.mjs는 고정 커밋의 D2 validate/agree와 D3 passed를 메모리 FS/CLI 주입으로 실행한다. 원본 검증 로직은 바꾸지 않고 쓰기는 메모리로 받는다. 원문 패킷은 최초 스냅샷을 재사용한다. b6 agree의 4개 산출물은 커밋과 바이트 단위 일치한다. 커밋 원문과 인용은 tracked 산출물에 복사하지 않고 *.local.json에만 보관한다.

## 수용 기준별 판정

### 0. confirmed

P2-01 수정 및 b2–b6 구조 회귀, 삽입 E2 반복 예외의 제한 범위. v2.1/2.2/2.3×6모드 18 반례에서 D2/D3의 secondary 누락·null을 모두 거부. 유효 null-primary+명시 빈 배열은 v2.2/2.3에서만 허용. D2·D3 A/B b2=40,b3=8,b4=40,b5=38,b6=40 전부 통과. 예외는 삽입 E2 unknown만; 그 반복은 허용하지만 R4 direct·비삽입 E2 direct·삽입 E2 direct·수행 경로 복제는 거부. 의미를 바꿔 쓴 지름길까지 검증한다는 뜻은 아님.

- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/d2-run.mjs:97 (@c6adb9090)
- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/d3-build.mjs:36 (@c6adb9090)
- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/d2-run.mjs:90 (@c6adb9090)
- docs/research/goal-data-batches/review-b6/recalculation.json:173
- docs/research/goal-data-batches/review-b6/recalculation.json:423
- docs/research/goal-data-batches/review-b6/recalculation.json:109

### 1. confirmed

40문항 선정·제외 해시·복구 재결속·산술·중단 경보. 27+1+12=40, 고유 ID40, 6TASK, source/passsage/selection 해시 전량 일치. 제외 도표의 스냅샷 해시 일치. 2023#38 새 source hash 314d91e5…와 위치선지5 결속. 일치225/240=.9375, κ=.8907203351, 후보91/갈림15, 안정5 모두 ok; E2=.775/κ=.6703297은 안정5 밖. 제외 raw에는 type_id가 없어 유형 독립 재계산은 unclear(P2-02 계속), b5 당시 원천 스냅샷이 없어 복구 전후 원문 동일성·DB 복구 과정은 unclear. 현재 새 입력 결속만 confirmed.

- docs/research/goal-data-batches/review-b6/recalculation.json:563
- docs/research/goal-data-batches/review-b6/recalculation.json:864
- docs/research/goal-data-batches/review-b6/recalculation.json:876
- docs/research/goal-data-batches/review-b6/recalculation.json:1018
- D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D2-task-mapping/b6-v23-selection.json:22 (@c6adb9090)
- D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D2-task-mapping/b6-v23-agreement.json:39 (@c6adb9090)

### 2. refuted

B-02 주 TASK를 문항별 가장 직접적인 수행으로 독립 판단했다는 절차의 타당성. 자진 보고와 일치하게 고정 우선순위 R5>R4>E3>E2>R6>E1 예측이 B-02 20/20, 다중-direct 10/10 일치. B-02 전량 primary 재판정 필요(특히 다중10). A-02도20/20이지만 이 일치만으로 A의 스크립트 사용을 확정하지 않음. 40/40 일치를 신뢰도 근거로 쓰지 않는 mapping-review 경고는 confirmed. 링크의 수기 생성/비자동 생성은 원장·생성 코드 부재로 unclear: B-02 완전 why·task_distinction 반복0, 15자 공통 구절 반복 및 내용별 다른 anchor/오답 존재. 표본 내용은 일률 자동 생성 주장을 입증하지 않는다. A 2022#38 설명 오류 및 경계 링크는 별도 재판정.

- D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D2-task-mapping/mapping-review.md:132 (@c6adb9090)
- docs/research/goal-data-batches/review-b6/recalculation.json:1025
- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-B-02.out.json:16
- D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D3-principles/reasoning-review.md:7

### 3. unclear

후보10·갈림10 원문 대조, R5/R6·E2 경계 및 E3 개선의 인과. 지정20링크(19고유문항) 전부 검토, 빈칸5와 제목 E2 추가6건으로 총26검토/24고유문항. R4 삽입5·E1경계5 내용 대조 완료. 원문 반박2개(A 2022#38 삽입 앞뒤, A 2022#29 수행 요약의 불필요한 가주어 구문)와 미확정 경계를 남김. 빈칸3개(2022#31/#33/#34)는 재진술 연구 후보 지지, M2506#33/#34는 통합·강도 경계 unclear. E3 .721→.913은 표본·판정자·규칙이 함께 달라 인과 unclear. 과거 b5 unclear를 소급 해소하지 않음.

- D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D2-task-mapping/CONTRACT_V2_3.md:12 (@c6adb9090)
- D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D2-task-mapping/CONTRACT_V2_3.md:22 (@c6adb9090)
- D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D2-task-mapping/CONTRACT_V2_3.md:31 (@c6adb9090)
- docs/research/goal-data-batches/review-b6/recalculation.json:896
- D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D2-task-mapping/mapping-review.md:128 (@c6adb9090)
- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/input.json:4848 (local snapshot 2026-10-23T06:27:58.886Z)
- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-A-02.out.json:1269 (local snapshot 2026-10-23T06:27:58.886Z)
- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-B-02.out.json:1227 (local snapshot 2026-10-23T06:27:58.886Z)
- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/input.json:5161 (local snapshot 2026-10-23T06:27:58.886Z)
- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-A-02.out.json:1510 (local snapshot 2026-10-23T06:27:58.886Z)
- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-B-02.out.json:1468 (local snapshot 2026-10-23T06:27:58.886Z)
- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/input.json:5325 (local snapshot 2026-10-23T06:27:58.886Z)
- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-A-02.out.json:1626 (local snapshot 2026-10-23T06:27:58.886Z)
- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-B-02.out.json:1589 (local snapshot 2026-10-23T06:27:58.886Z)
- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/input.json:2156 (local snapshot 2026-10-23T06:27:58.886Z)
- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-A-01.out.json:1702 (local snapshot 2026-10-23T06:27:58.886Z)
- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-B-01.out.json:1767 (local snapshot 2026-10-23T06:27:58.886Z)
- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/input.json:2303 (local snapshot 2026-10-23T06:27:58.886Z)
- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-A-01.out.json:1820 (local snapshot 2026-10-23T06:27:58.886Z)
- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-B-01.out.json:1886 (local snapshot 2026-10-23T06:27:58.886Z)

### 4. confirmed

verdict.json·review.md 산출 및 불확실성 보존. 수용 기준0–4와 표본별 판정·파일:줄·재현 스크립트를 기록. 원문/전체 diff/패킷은 ignored *.local.json에만 보관. pass는 검증 수행 완료이고 데이터 승인·내용 전부 합격·NeedRank/진단 투입 승인이 아님.

- docs/research/goal-data-batches/review-b6/verdict.json:1
- docs/research/goal-data-batches/review-b6/review.md:1
- scripts/research/goal-data/review-b6/check.mjs:1
- scripts/research/goal-data/review-b6/.gitignore:1

## 주 TASK 및 링크 생성 패턴

우선순위는 자진 보고된 R5 > R4 > E3 > E2 > R6 > E1이며 각 행의 direct만 남겨 첫 항목을 예측했다.

| 트랙/청크 | 우선순위 일치 | direct 복수 | 복수 중 일치 | why 완전 반복 그룹 | 구별 설명 완전 반복 그룹 |
|---|---:|---:|---:|---:|---:|
| A-1 | 18/20 | 14 | 12 | 1 | 0 |
| A-2 | 20/20 | 10 | 10 | 7 | 1 |
| B-1 | 18/20 | 15 | 13 | 1 | 0 |
| B-2 | 20/20 | 10 | 10 | 0 | 0 |

문장 집계는 공백 정규화·숫자 제거 후 TASK·relevance별로 서로 다른 문항에서 같은 why/task_distinction을 센 것이다. B-02는 120링크의 완전한 why 반복0·구별 설명 반복0이나 15자 연속 공통 구절(3문항 이상)은 why 9그룹·구별 설명2그룹이다. E1 무관 설명 구절은 최대6문항, R6 무관 구절은3문항, R5 재진술 구별 설명은3문항 등이다. 이는 규칙 문구 재사용의 흔적이며 문항별 anchor·반사실이 맞는지와 따로 평가했다. 원문 구절이 섞일 수 있어 반복 문자열은 patterns.local.json, 공개 산출은 해시·문항ID·횟수만 기록했다.

A-02도 같은 우선순위20/20이고 A/B-01은 각각18/20이다. 일치만으로 스크립트 사용의 인과를 입증할 수 없다. B-02는 자진 보고와 결합해 절차 위반을 확정한다. B-02 20개 primary 재판정이 필요하고, 특히 여러 direct 가운데 선택해야 하는10개가 핵심이다. 링크 판정 전체의 자동 생성을 확정할 증거는 없으며 수기라는 주장도 독립 인증되지 않았다.

원문 표본에서 실제 서로 다른 순서·목적·오답 변형과 명시/비명시 근거가 보였다. 반면 R5 재진술의 기계적 적용이 의심되는 M2506#33/#34는 문장 통합·강도 변화 경계로 unclear를 유지한다. 이 둘을 자동 생성의 증명으로 쓰지는 않는다.

## 재계산

| TASK | 일치 | κ | 중단 경보 |
|---|---:|---:|---|
| r.central_meaning | 39/40 | 0.955056180 | ok |
| r.inference | 40/40 | 1.000000000 | ok |
| e.task_demand | 40/40 | 1.000000000 | ok |
| e.option_correspondence | 38/40 | 0.913326111 | ok |
| r.discourse_structure | 37/40 | 0.885167464 | ok |
| e.evidence_location | 31/40 | 0.670329670 | 안정5 밖 |

D2/D3 A/B 현재 패킷의 회귀 결함0은 내용 판단의 오류0이 아니다. primary 선택 타당도나 다르게 표현한 잘못된 이유를 검증기는 판별하지 않는다. 삽입 E2 unknown 예외는 동일 문구 허용만 검증했으며 R4 등 복제 경로 탐지는 유지됐다.

## 원문 표본

지정 후보10과 갈림10은 링크20건·고유문항19개(2022#40이 두 그룹에 있음)다. 중복 제외 규칙은 그룹 내부에서만 작동한다. 빈칸 경계5와 제목 E2 1을 추가해 총26검토·고유24문항이다. 아래 confirmed는 해당 링크의 연구 후보 근거이며 사람 Gold/독립 학습 진단 승인이 아니다.

- **2022#38 / r.discourse_structure (candidate): confirmed** — R4 direct 후보는 지지된다. 다만 A의 수행 경로·정답 설명은 삽입문을 마지막 문장 뒤에 둬 정답 ⑤(그 문장 앞)와 반대다. 내용 설명을 별도 refuted로 기록하고 정정 전 교수 예시 사용 보류. B는 올바른 앞뒤 경계를 설명한다.
  - 근거: D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/input.json:5806 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-A-02.out.json:1987 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-B-02.out.json:1923 (local snapshot 2026-10-23T06:27:58.886Z)

- **2022#39 / r.discourse_structure (candidate): confirmed** — 무성 흑백 시기와 소리·색 도입의 대조를 연결해 ④를 고른다. 두 트랙이 지시와 대조의 배열을 원문에 결속한다. R4 교수 사례·묶음 관찰만 허용.
  - 근거: D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/input.json:5959 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-A-02.out.json:2094 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-B-02.out.json:2026 (local snapshot 2026-10-23T06:27:58.886Z)

- **2023#38 / r.discourse_structure (candidate): confirmed** — 공원 분리 감각 → 전통 설계 이유 → 사상 배경의 배열로 ⑤를 지지한다. 위치 선지 5개와 새 입력 해시, E2 unknown 및 독립평가 부적격을 확인.
  - 근거: D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/input.json:4170 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-A-02.out.json:824 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-B-02.out.json:788 (local snapshot 2026-10-23T06:27:58.886Z)

- **M2506#38 / r.discourse_structure (candidate): confirmed** — 과세 장점 → 비용 장애 → 기술 발전 → 향후 확대의 배열에서 ④. 원문 분리와 다문장 근거가 문항에 맞는다. 묶음 관찰 한정.
  - 근거: D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/input.json:2958 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-A-01.out.json:2273 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-B-01.out.json:2358 (local snapshot 2026-10-23T06:27:58.886Z)

- **M2506#39 / r.discourse_structure (candidate): confirmed** — 재현 작품/표현주의 대비 뒤 미적 태도를 요구하는 진술을 받아 ⑤. 실제 지시 대상과 단계가 해당 문항에 결속돼 단순 공통 문장 복제로 보이지 않는다.
  - 근거: D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/input.json:3115 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-A-02.out.json:4 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-B-02.out.json:4 (local snapshot 2026-10-23T06:27:58.886Z)

- **2022#29 / e.task_demand (candidate): confirmed** — 부정 어법 발문에 따라 E1 direct. 실제 주 수행은 청크 밖 S축이며 독립평가 부적격. A 수행 요약이 가주어 구문을 덧붙인 부분은 본문에 없는 구조 설명이어서 별도 정정 필요(정답 논리는 완전절→접속사로 맞음).
  - 근거: D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/input.json:4697 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-A-02.out.json:1166 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-B-02.out.json:1124 (local snapshot 2026-10-23T06:27:58.886Z)

- **2022#40 / e.task_demand (candidate): confirmed** — 요약 두 빈칸에서 한쪽만 맞는 오답 ⑤를 두 트랙이 특정한다. E1 indirect 반사실이 실제 선지에 결속돼 있다. E3 판정과 구분.
  - 근거: D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/input.json:6112 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-A-02.out.json:2201 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-B-02.out.json:2129 (local snapshot 2026-10-23T06:27:58.886Z)

- **M2506#26 / e.task_demand (candidate): confirmed** — 동상 설치의 생전/사후 차이를 부정 발문으로 고른다. E1 direct 표 적용은 타당하나 그 자체가 독립 E1 능력 측정 승인은 아니다.
  - 근거: D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/input.json:1151 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-A-01.out.json:875 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-B-01.out.json:918 (local snapshot 2026-10-23T06:27:58.886Z)

- **M2506#27 / e.task_demand (candidate): confirmed** — 잘린 발문에도 부정 요구가 남아 E1 direct는 지지된다. 셔틀 횟수 선지 대조도 맞는다. 발문 잘림을 복구하지 않고 독립평가 적격이라고 단정한 부분은 unclear; 온전한 원천 검증을 대체하지 않는다.
  - 근거: D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/input.json:1288 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-A-01.out.json:993 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-B-01.out.json:1039 (local snapshot 2026-10-23T06:27:58.886Z)

- **M2506#29 / e.task_demand (candidate): confirmed** — 단서 회상에서 학생이 단서를 받는 문맥과 부정 어법 발문을 구별한다. 청크 밖 태 판단과 청크 내부 E1을 분리해 부적격 유지.
  - 근거: D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/input.json:1569 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-A-01.out.json:1222 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-B-01.out.json:1273 (local snapshot 2026-10-23T06:27:58.886Z)

- **2022#33 / e.option_correspondence (disputed): unclear** — 자원 규칙 결정 참여의 재진술과 자원 접근으로 대상을 바꾼 오답은 원문에 있다. A는 별도 대조 direct, B는 중심 결정 뒤 보조 indirect로 보며, 실제 별도 단계의 필요성을 원문만으로 유일하게 확정할 수 없다.
  - 근거: D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/input.json:5161 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-A-02.out.json:1510 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-B-02.out.json:1468 (local snapshot 2026-10-23T06:27:58.886Z)

- **2022#40 / e.option_correspondence (disputed): unclear** — 짧은 낱말쌍의 의미 대응을 E3 별도 direct로 셀지 V4/R5 결과 선택으로 셀지 경계가 남는다. A/B 이유 모두 구체적이지만 v2.3의 직접/무관 경계를 일의적으로 해소하지 못한다.
  - 근거: D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/input.json:6112 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-A-02.out.json:2201 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-B-02.out.json:2129 (local snapshot 2026-10-23T06:27:58.886Z)

- **2022#36 / e.evidence_location (disputed): unclear** — 순서의 지시어 선행 내용 찾기를 E2 독립 위치 판단으로 셀지 R2/R4 배열에 흡수할지 미규정. A의 특정 오답은 실제 오답이지만 B의 무관도 가능한 해석.
  - 근거: D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/input.json:5472 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-A-02.out.json:1757 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-B-02.out.json:1717 (local snapshot 2026-10-23T06:27:58.886Z)

- **2022#37 / e.evidence_location (disputed): unclear** — 현실 혼돈→정신 필터→작가 필터의 경계를 정확히 읽었다. 그 근거 위치를 별도 E2 indirect로 셀지 배열 수행으로 셀지는 여전히 불명확.
  - 근거: D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/input.json:5655 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-A-02.out.json:1872 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-B-02.out.json:1820 (local snapshot 2026-10-23T06:27:58.886Z)

- **M2506#18 / e.evidence_location (disputed): unclear** — 목적 문장의 지시 대상 찾기와 경쟁 배경 문장 선택이라는 두 경로가 실제 본문에 있다. 전체 목적 판단 E2 무관 규칙과 v2.3 후보 문장 조건의 충돌은 남는다.
  - 근거: D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/input.json:16 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-A-01.out.json:4 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-B-01.out.json:4 (local snapshot 2026-10-23T06:27:58.886Z)

- **M2506#19 / r.discourse_structure (disputed): unclear** — 앞 행동에서 좌절 추론, 끝 감사는 명시라는 구분은 지지된다. 전후 상태 구분을 여러 문장 배열 R4로 추가 계상할지 단순 정서 변화 읽기로 볼지는 불확실.
  - 근거: D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/input.json:163 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-A-01.out.json:146 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-B-01.out.json:139 (local snapshot 2026-10-23T06:27:58.886Z)

- **M2506#20 / e.evidence_location (disputed): unclear** — AI 감독자 주장과 AI 불안정성 배경은 실제 문장이다. 주장 판단을 전체 중심/별도 탐색 중 어느 것으로 셀지 E2 규칙 공백이 남는다.
  - 근거: D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/input.json:317 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-A-01.out.json:257 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-B-01.out.json:263 (local snapshot 2026-10-23T06:27:58.886Z)

- **M2506#21 / r.discourse_structure (disputed): unclear** — 스펙트럼 해석과 반박된 흑백 관점을 선지 ③에 결속한 B 반사실은 문항 고유하다. 밑줄 인접 해석만으로 결정 가능한지, 전체 반박 배열이 보조 필요한지는 불확실.
  - 근거: D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/input.json:481 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-A-01.out.json:380 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-B-01.out.json:393 (local snapshot 2026-10-23T06:27:58.886Z)

- **M2506#22 / e.evidence_location (disputed): unclear** — 의사소통 평등→공유 가치라는 결정은 지지된다. B가 비교 문장을 ③의 지지 근거라 부르지만 실제 비교 방향은 ③과 반대여서 문자적 지지 주장까지 확정하지 않는다. E2 전체 요지/탐색 경계와 함께 재판정 대상.
  - 근거: D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/input.json:649 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-A-01.out.json:517 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-B-01.out.json:539 (local snapshot 2026-10-23T06:27:58.886Z)

- **M2506#23 / e.evidence_location (disputed): unclear** — 광고의 식품 관련 낱말 의미 변화는 실제 중심이고, B는 쇠퇴·자본주의 표현을 특정 오답에 연결한다. 이를 중심 결정과 별도의 E2 탐색으로 셀지는 계약상 불명확.
  - 근거: D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/input.json:825 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-A-01.out.json:640 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-B-01.out.json:669 (local snapshot 2026-10-23T06:27:58.886Z)

- **2022#31 / r.central_meaning (blank_boundary): confirmed** — 진위에 관심 없다는 단일 명제와 정확성 빈칸은 의미상 재진술로 읽을 수 있다. 세부 표현을 반복하는 오답도 실제 있다. v2.3의 R5 direct/R6 무관 연구 후보를 지지하되 어휘 완전 일치를 요구하지 않는다.
  - 근거: D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/input.json:4848 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-A-02.out.json:1269 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-B-02.out.json:1227 (local snapshot 2026-10-23T06:27:58.886Z)

- **2022#33 / r.central_meaning (blank_boundary): confirmed** — 사용자가 스스로 규정을 만들고 민주적으로 결정한다는 명제가 빈칸의 규칙 결정 참여를 뒷받침한다. R5 direct/R6 무관 후보는 지지. 별도의 E3 direct/indirect 갈림은 해결하지 않는다.
  - 근거: D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/input.json:5161 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-A-02.out.json:1510 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-B-02.out.json:1468 (local snapshot 2026-10-23T06:27:58.886Z)

- **2022#34 / r.central_meaning (blank_boundary): confirmed** — 기존 확정성·정밀성의 환상을 폭로한다는 명제는 겉보기 확실성·정밀성에 계속 의문을 던진다는 결론과 대응한다. 단일 명제 재진술 R5 후보를 지지.
  - 근거: D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/input.json:5325 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-A-02.out.json:1626 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-B-02.out.json:1589 (local snapshot 2026-10-23T06:27:58.886Z)

- **M2506#33 / r.central_meaning (blank_boundary): unclear** — 결정이 제도 관행에 영향받는다는 문장만으로 정답의 주관 경험·해결책 전체가 모두 진술됐다고 확정하기 어렵다. B 수행 요약도 앞뒤 문장을 묶는다. 복수 문장 통합/재진술 기준을 명확히 한 뒤 R5/R6 재판정 필요.
  - 근거: D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/input.json:2156 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-A-01.out.json:1702 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-B-01.out.json:1767 (local snapshot 2026-10-23T06:27:58.886Z)

- **M2506#34 / r.central_meaning (blank_boundary): unclear** — 청자 간 상대적 일관성과 차이 인정·반전으로 공통성이 차이를 훨씬 능가한다는 결론을 얻는다. 단일 명제의 동등 재진술인지 양보·강도 비교를 합친 도출인지 경계가 남아 R6 무관을 확정하지 않는다.
  - 근거: D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/input.json:2303 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-A-01.out.json:1820 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-B-01.out.json:1886 (local snapshot 2026-10-23T06:27:58.886Z)

- **M2506#24 / e.evidence_location (title_boundary): unclear** — 선사부터 현재까지라는 시간 범위와 고대만으로 좁힌 오답이 실제에 있다. B의 분산 근거는 문항 고유하지만 전체 제목 판단을 별도 E2 direct로 볼지 무관으로 볼지는 목적·요지와 같은 공백.
  - 근거: D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/input.json:986 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-A-01.out.json:752 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-B-01.out.json:788 (local snapshot 2026-10-23T06:27:58.886Z)

## 정정·재판정 및 유지할 불확실성

- **B6-P2-01 confirmed: B-02 primary 재판정** — 절차 위반 primary 20개를 문항 고유 결정 이유로 다시 판정하고 A/B primary 40/40을 품질 근거에서 제외. 링크 120개가 자동 생성됐다고 확대 확정하지 않음.
  - 근거: D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D2-task-mapping/mapping-review.md:132 (@c6adb9090) · docs/research/goal-data-batches/review-b6/recalculation.json:1025 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-B-02.out.json:16 · D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D3-principles/reasoning-review.md:7

- **B6-P2-02 refuted: 2022#38 A 삽입 앞뒤 설명** — 정답⑤는 마지막 문장 앞인데 A의 passage_structure·decision_path·answer_logic·design_hypothesis가 뒤로 설명. 원문 기준 설명 정정과 D3 전파 재생성·재검증이 필요. R4 direct 후보 자체는 지지되며 해시/정답번호 오류와 구분.
  - 근거: D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/input.json:5806 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-A-02.out.json:1987 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-B-02.out.json:1923 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D3-principles/item-reasoning.jsonl:196

- **B6-P2-03 refuted: 2022#29 A 수행 요약의 가주어 구조** — 본문은 접속사절을 주어로 쓰는 교정인데 A 수행 요약은 가주어를 추가해 잘못 설명한다. answer_logic의 완전절 교정과 E1 링크 판정은 별도로 맞음. 수행 요약·D3를 정정할 것.
  - 근거: D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/input.json:4697 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-A-02.out.json:1166 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-B-02.out.json:1124 (local snapshot 2026-10-23T06:27:58.886Z)

- **B6-U-01 unclear: 링크 수기 생성 주장** — 내용상 문항 고유 판단 흔적은 있으나 생성 방식의 독립 인증이 아니다. 반복 부재로 수기라고 입증하거나 규칙적 표현으로 자동 생성이라고 확정하지 않음.
  - 근거: docs/research/goal-data-batches/review-b6/recalculation.json:1025 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/input.json:4848 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-A-02.out.json:1269 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-B-02.out.json:1227 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/input.json:5161 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-A-02.out.json:1510 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-B-02.out.json:1468 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/input.json:5325 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-A-02.out.json:1626 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-B-02.out.json:1589 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/input.json:2156 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-A-01.out.json:1702 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-B-01.out.json:1767 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/input.json:2303 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-A-01.out.json:1820 (local snapshot 2026-10-23T06:27:58.886Z) · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b6-v23/chunk-B-01.out.json:1886 (local snapshot 2026-10-23T06:27:58.886Z)

- **B6-U-02 unclear: 남은 계약 경계와 과거 제외 원천** — E2 목적/주장/요지/주제/제목·순서, E3 짧은 선지/별도 대조, M2506#33/#34 재진술/통합, 제외 raw 유형 결속 및 b5 당시 원천 상태는 계속 미확정. 계약을 먼저 고정하고 영향 문항만 재판정. 새 계약을 이전 통과로 소급하지 않음.
  - 근거: docs/research/goal-data-batches/review-b6/recalculation.json:563 · D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D2-task-mapping/CONTRACT_V2_3.md:12 (@c6adb9090) · D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D2-task-mapping/CONTRACT_V2_3.md:22 (@c6adb9090)

B-02 primary 20개, A 2022#38 설명·D3 전파, A 2022#29 수행 요약·D3 전파는 재검토 대상이다. E2 경계 및 M2506#33/#34는 계약을 정한 뒤 영향 판정만 다시 한다. 지적사항을 입력 worktree에 직접 수정하지 않았다. 현재 전체 일치·κ는 수정 전 관측값으로 보존한다. 기존 b5 갈림·E3/V4 경계·과거 원천 상태와 인과 효과의 unclear는 승격하지 않는다. 전체802 승인이나 다음 배치 무조건 진행을 의미하지 않는다.

## 검증·제출 구분

수행: 고정 diff·계약·원문26검토, 입력 해시 전수, D2/D3 회귀, 18 반례, 반복 예외5종, b6 산출4개 재생성 대조. 검증 스크립트 assertions 통과. skip_count=0은 이 TASK에서 요구한 검증을 누락하지 않았다는 뜻이다. DB/PDF/제품 E2E/사람 검수는 범위 밖 미실행이며 통과로 기록하지 않는다.

Git add/commit 및 evidence/submit 명령의 실제 출력은 command-output.txt에 순서대로 남긴다. 쓰기 가능한 두 산출 디렉터리 이외의 저장소 파일을 수정하지 않는다(명시 요청된 AI-Control runtime evidence 파일·TASK 상태 갱신은 별도). 로컬 main 통합·원격 push는 이 읽기 전용 검증 TASK의 납품 범위에 포함하지 않는다.
