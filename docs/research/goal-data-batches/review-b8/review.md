# T-0113 b8-v24 독립 검증

b9는 v2.4 연구 배치로 조건부 진행 가능. v2.5 봉인은 미관측 검증 전 보류. 새 P0 0 · P1 1(봉인 계획).

owner goal-data-independent · session t-0113-codex. 최초 task show에서 IN_PROGRESS·세션 일치 확인. PID 조회 없음. 중앙 dev-minimal-20261020 확인. 입력 e87bdc173..1fa75b9cc, 관찰 2026-10-23T07:55:38.383Z. 다른 세션 입력은 읽기 전용. 원문·명령 출력은 ignored *.local.json에만 보존.

검증 수행 완료(pass), skip_count=0. 미실행은 통과가 아니다.

## 수용 기준 0: confirmed

excluded_raw의 최상위 type_id 14/14가 선정 스냅샷과 일치. 실제 snapshot 함수의 복사4·manifest·현재 출력 수정 후 보존 및 스냅샷 1바이트 변조 검출을 메모리 FS에서 재현. b7 history 4파일은 T-0111 리뷰 당시 패킷·현재 패킷과 바이트 일치. 폴더명은 경로 메타데이터이며 변경이 본문 해시를 바꾸지 않는다.
- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/d2-export.mjs:75
- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/d2-run.mjs:170
- scripts/research/goal-data/review-b8/supplement.mjs:20

manifest까지 함께 재작성하는 공격의 진본 인증은 없다. verify CLI·수정 전 자동 호출도 없다. 현재 history는 T-0111 이후 기준선이며 T-0111 이전 A-02 재표시 전 원본을 복구하지 않는다. 실제 폴더 rename 명령은 소유권 때문에 실행하지 않았고 경로 독립 해시로 검증했다.

## 수용 기준 1: confirmed

M2706 15 + M2409 25=40, 기판정 pilot12·도표2 제외, 선택/본문/원천 해시 전부 일치. 223/240=.9291667→.9292, κ=.8774517→.8775, primary37/40. 안정5 경보 전부 ok(E2는 경보 대상 밖). b2–b8 D2·D3 각 A/B 구조 회귀 결함0. D2 4생성물 바이트 재현 및 D3 40행 설명·오답 전파 일치.
- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/d2-export.mjs:59
- D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D2-task-mapping/b8-v24-agreement.json:43
- D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D3-principles/principle-groups.json:46
- scripts/research/goal-data/review-b8/check.mjs:40

## 수용 기준 2: unclear

후보10·갈림10을 원문·정답·양 트랙 근거와 대조했다. 후보 판정은 지지하나 R4/E2 갈림과 primary3 및 M2409#39 outside R2/R4 우열은 독립적 Gold로 확정하지 않는다.
- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/input.json:5453
- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/chunk-A-02.out.json:1808
- D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/chunk-B-02.out.json:1826
- D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D2-task-mapping/mapping-review.md:204

## 수용 기준 3: refuted

b7의 규칙 도출 표본9 재적용은 개발 회귀 비교로 타당하지만 봉인의 충분 검증으로는 타당하지 않다. 동일 표본 일치 상승은 과적합과 구별할 수 없다. b7→b8 E2/E3 갈림5→1을 규칙 효과로 돌리지 않은 서술은 confirmed. 미관측 성능은 unclear.
- D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D2-task-mapping/mapping-review.md:204
- D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D2-task-mapping/CONTRACT_V2_5.md:1
- docs/research/goal-data-batches/review-b6/recheck2.md:1
- docs/research/goal-data-batches/review-b6/recheck3.md:1

## 수용 기준 4: confirmed

verdict.json·review.md 작성, 새 P0/P1·b9 진행·v2.5 검증 방식·불확실성 명시. pass는 검증 수행 완료이며 봉인 승인이나 전량 판정 합격이 아니다.
- docs/research/goal-data-batches/review-b8/verdict.json:1
- docs/research/goal-data-batches/review-b8/review.md:1

## 재계산과 변경 범위

223/240=.9291666667, κ=.8774517166. primary37/40 · R1 88 · 갈림17. E2/R4는 각34/40. 안정5 전부 ok이며 E2는 대상 밖. 결합278 · R1 775 · 갈림376 · D3 primary234/278. D3 전체 오답772/1112와 원문 적격 오답756/1096을 구별한다. source-gap은4문항. 17파일 diff를 보관·읽고 생성물 추가행·필드 변경을 분해 대조했다. 기존 JSONL 행 삭제·변경은 없고 새 b8 행만 추가된다.

b2/b3/b4/b5/b6/b7/b8 D2·D3 A/B 수용40/8/40/38/40/40/40. 현행 계약 구조 회귀이며 의미 Gold 인증은 아니다. b8 D2 생성4파일을 메모리 FS 재생성하여 바이트 일치, D3 40행 설명·오답 전파 일치.

snapshot은 실제 함수 본문을 가상 FS에서 실행했다. 출력4개를 복사하고 manifest를 만들며 원본 수정 후에도 사본 불변이다. 사본에 공백1개 추가하면 해시 불일치를 검출했다. 검출은 리뷰 검증기에서 수행하며 공급 코드에 verify 명령은 없다. manifest와 본문을 함께 바꾸면 독립 진본 인증이 안 된다. b7 history4파일은 T-0111 리뷰에 보존된 패킷 및 현재 패킷과 모두 바이트 일치하므로 기준선 보존은 확인된다. 폴더명은 해시 입력에 없으며 이름 변경 자체는 내용 불변이다. 현재 history의 시각·label 변경을 과거 독립 생성 증거로 사용하지 않는다.

## 새 발견

### B8-P1-01 · P1 · confirmed

규칙 도출에 사용한 b7 갈림9에 적용·비교한 뒤 봉인 여부를 정하는 계획에 별도 미관측 검증 문턱이 없다. 재적용은 디버깅에 쓰고, 봉인 근거로는 독립 보류 표본을 추가해야 한다. 현재 v2.4 배치 오류나 이미 봉인이 실행됐다는 주장은 아니다.
- D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D2-task-mapping/mapping-review.md:204
- D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D2-task-mapping/CONTRACT_V2_5.md:1

### B8-P2-01 · P2 · confirmed

mapping-review E3 κ .961은 .9604743083의 통상 세 자리 반올림 .960과 다르다. 정본 agreement .9605·계산 및 중단 경보에는 영향 없음.
- D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D2-task-mapping/mapping-review.md:198
- D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D2-task-mapping/b8-v24-agreement.json:43

### B8-P2-02 · P2 · confirmed

v2.5 초안 머리말은 봉인 뒤 b8 적용이라고 남아 있지만 실제 b8은 v2.4. 적용 시점을 명확히 고쳐야 한다.
- D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D2-task-mapping/CONTRACT_V2_5.md:1
- D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D2-task-mapping/mapping-review.md:204

## 원문 대조 후보 10 · 갈림 10

- candidates M2409#38 / r.discourse_structure: **confirmed** — 정밀 편집을 미시 접근으로 받는 ⑤. 둘째 장점의 조작→예시→정밀도→효과 배열은 R4 direct를 지지한다. 실제 결정은 R2 지시 연결로도 분해 가능하여 outside true와 모순은 아니다.
  - D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/input.json:5274 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/chunk-A-02.out.json:1706 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/chunk-B-02.out.json:1719
- candidates M2409#39 / r.discourse_structure: **confirmed** — 일반 감상의 최소 요건에서 전문가의 깊은 이해로 전환하고 이유·비평가 관심으로 이어지는 ③. R4 direct는 지지한다. This is because의 이유 연결 R2와 단계 배열 R4 중 주 수행 우열은 unclear. A primary_reason도 단계 전환을 말하므로 A outside true의 근거는 추가 설명이 필요하다.
  - D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/input.json:5453 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/chunk-A-02.out.json:1808 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/chunk-B-02.out.json:1826
- candidates M2409#26 / e.task_demand: **confirmed** — 평생 연주를 지속했으므로 중단했다는 ⑤가 반대다. 부정 요구 E1과 표현 대조 E3를 지지한다. R4 연대기 indirect는 특정 오답의 필요 조건인지 unclear.
  - D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/input.json:3411 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/chunk-A-02.out.json:262 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/chunk-B-02.out.json:264
- candidates M2409#27 / e.task_demand: **confirmed** — 평일 운영과 주말이라는 ②가 모순. E1 direct는 지지한다. 근거 위치와 weekday 대조가 모두 필요하여 E2 primary의 유일한 우열은 unclear. A의 선지·항목 순서가 엇갈린다는 설명은 실제 항목이 대체로 순서 대응하므로 약하다.
  - D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/input.json:3548 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/chunk-A-02.out.json:383 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/chunk-B-02.out.json:394
- candidates M2409#29 / e.task_demand: **confirmed** — When절 뒤 주절 자리에서 realizing을 동사 원형 명령문으로 고쳐야 하는 ③. E1은 부정 요구이며 주 수행은 S축이라 outside true 지지.
  - D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/input.json:3834 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/chunk-A-02.out.json:617 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/chunk-B-02.out.json:628
- candidates M2409#30 / e.task_demand: **confirmed** — 생산 맥락과의 단절을 만들었는데 상쇄했다고 한 ④. E1 및 V축 outside true 지지. 앞 문장의 This 선행 내용과 뒤 reconnects 양쪽을 근거로 삼을 수 있다.
  - D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/input.json:3985 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/chunk-A-02.out.json:721 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/chunk-B-02.out.json:735
- candidates M2409#35 / e.task_demand: **confirmed** — 장벽과 그 해소에서 적합한 재택근무 직원 선발 지침으로 이탈한 ③. E1 direct 지지. 중심 R5·단계 R4·기능 R3이 함께 가능한 분해라 주 TASK 및 outside의 유일한 정답은 unclear.
  - D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/input.json:4789 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/chunk-A-02.out.json:1372 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/chunk-B-02.out.json:1388
- candidates M2409#40 / e.task_demand: **confirmed** — 부족한 기록을 재구성하여 과거 이해를 풍부하게 하는 ②. 두 칸 요구 E1 indirect와 R5 중심은 지지한다. R4 양보-결론 및 E2 근거 선택의 직접성은 unclear.
  - D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/input.json:5636 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/chunk-A-02.out.json:1910 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/chunk-B-02.out.json:1933
- candidates M2409#42 / e.task_demand: **confirmed** — 맥락 출처를 잊기 쉬워 학교에서 배운 것을 기억하지 못한다고 결론짓기 쉽다. 어렵다는 (e)⑤가 반대. E1·V축 outside true 지지. R5 indirect 및 다른 (d)의 근거 위치는 오류 경로 가설로 남는다.
  - D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/input.json:5940 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/chunk-A-02.out.json:2180 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/chunk-B-02.out.json:2188
- candidates M2706#26 / e.task_demand: **confirmed** — 1948은 집필, 출판은 1957이라 ③이 틀리다. E1·E3 후보 지지.
  - D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/input.json:808 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/chunk-A-01.out.json:701 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/chunk-B-01.out.json:637
- disputed M2706#20 / e.option_correspondence: **unclear** — 원리를 알고 훈련하도록 지도해야 하는 ③. R5 지지. B는 단계적이라는 ④가 gradually를 재사용함을 짚어 E3 indirect를 지지하지만 A는 불필요로 본다. 특정 오답 경로는 가능하며 필요성·실제 학습자 경로는 미확정.
  - D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/input.json:308 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/chunk-A-01.out.json:269 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/chunk-B-01.out.json:251
- disputed M2409#19 / r.discourse_structure: **unclear** — 여행 취소 한숨에서 대체 동물원 소식 뒤 들뜸으로 ①. R6는 타당하다. R4 indirect의 노크 전후 분리가 독립적 수행인지 두 반응의 추론에 포함되는지는 미봉인 경계다.
  - D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/input.json:2435 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/chunk-A-01.out.json:2173 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/chunk-B-01.out.json:1951
- disputed M2409#26 / r.discourse_structure: **unclear** — 평생 연주를 지속했으므로 중단했다는 ⑤가 반대다. 부정 요구 E1과 표현 대조 E3를 지지한다. R4 연대기 indirect는 특정 오답의 필요 조건인지 unclear.
  - D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/input.json:3411 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/chunk-A-02.out.json:262 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/chunk-B-02.out.json:264
- disputed M2409#34 / r.discourse_structure: **unclear** — 회화의 운반 한계와 사진의 장소 순환을 결합하면 ⑤. R6 지지. 전후 배열 R4 및 경쟁 근거 E2 direct/indirect 우열은 unclear.
  - D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/input.json:4643 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/chunk-A-02.out.json:1226 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/chunk-B-02.out.json:1246
- disputed M2409#35 / r.central_meaning: **unclear** — 장벽과 그 해소에서 적합한 재택근무 직원 선발 지침으로 이탈한 ③. E1 direct 지지. 중심 R5·단계 R4·기능 R3이 함께 가능한 분해라 주 TASK 및 outside의 유일한 정답은 unclear.
  - D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/input.json:4789 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/chunk-A-02.out.json:1372 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/chunk-B-02.out.json:1388
- disputed M2409#40 / r.discourse_structure: **unclear** — 부족한 기록을 재구성하여 과거 이해를 풍부하게 하는 ②. 두 칸 요구 E1 indirect와 R5 중심은 지지한다. R4 양보-결론 및 E2 근거 선택의 직접성은 unclear.
  - D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/input.json:5636 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/chunk-A-02.out.json:1910 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/chunk-B-02.out.json:1933
- disputed M2409#42 / r.central_meaning: **unclear** — 맥락 출처를 잊기 쉬워 학교에서 배운 것을 기억하지 못한다고 결론짓기 쉽다. 어렵다는 (e)⑤가 반대. E1·V축 outside true 지지. R5 indirect 및 다른 (d)의 근거 위치는 오류 경로 가설로 남는다.
  - D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/input.json:5940 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/chunk-A-02.out.json:2180 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/chunk-B-02.out.json:2188
- disputed M2706#19 / r.discourse_structure: **unclear** — 멍한 시선·졸음에서 놀라운 풍경에 입을 벌리는 ①. R6 지지. 구름 위 전환 R4가 별도 간접 수행인지 불명확하다.
  - D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/input.json:160 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/chunk-A-01.out.json:148 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/chunk-B-01.out.json:135
- disputed M2706#21 / r.central_meaning: **unclear** — 버릴 대상은 의식의 인간 독점 믿음인 ②. R6 지지. 연구 필요 주장①을 ghost로 오인하는 R5/E2 반사실은 가능하지만 E2 탐색과 E3 대조의 별도 필요성은 unclear.
  - D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/input.json:479 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/chunk-A-01.out.json:402 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/chunk-B-01.out.json:382
- disputed M2706#30 / r.inference: **unclear** — 대사 비중 감소와 적은 지면에 비춰 thick④가 반대다. V축 outside true 지지. 흩어진 근거를 고르는 E2(A)와 부정 요구 E1(B)의 부분 집합 primary 우열 및 R6 indirect는 unclear.
  - D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/input.json:1252 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/chunk-A-01.out.json:1097 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/chunk-B-01.out.json:992

## 주 TASK·outside 추가 대조

- M2409#39: **unclear** — 일반 감상의 최소 요건에서 전문가의 깊은 이해로 전환하고 이유·비평가 관심으로 이어지는 ③. R4 direct는 지지한다. This is because의 이유 연결 R2와 단계 배열 R4 중 주 수행 우열은 unclear. A primary_reason도 단계 전환을 말하므로 A outside true의 근거는 추가 설명이 필요하다.
  - D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/input.json:5453 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/chunk-A-02.out.json:1808 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/chunk-B-02.out.json:1826
- M2706#30: **unclear** — 대사 비중 감소와 적은 지면에 비춰 thick④가 반대다. V축 outside true 지지. 흩어진 근거를 고르는 E2(A)와 부정 요구 E1(B)의 부분 집합 primary 우열 및 R6 indirect는 unclear.
  - D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/input.json:1252 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/chunk-A-01.out.json:1097 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/chunk-B-01.out.json:992
- M2706#45: **unclear** — Beatrice는 재능이 없다고 말했으므로 칭찬했다는 ④가 틀리다. E2와 E3 direct는 지지한다. 화자 선택과 평가 방향 대조를 분리할 수 있으나 무엇이 주 수행인지는 v2.4 경계로 남는다.
  - D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/input.json:2136 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/chunk-A-01.out.json:1895 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/chunk-B-01.out.json:1699
- M2409#35: **unclear** — 장벽과 그 해소에서 적합한 재택근무 직원 선발 지침으로 이탈한 ③. E1 direct 지지. 중심 R5·단계 R4·기능 R3이 함께 가능한 분해라 주 TASK 및 outside의 유일한 정답은 unclear.
  - D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/input.json:4789 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/chunk-A-02.out.json:1372 · D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b8-v24/chunk-B-02.out.json:1388

추가 outside 표본: M2706#35는 체격-낙상 부상 흐름에서 BMI 건강점검④로 이탈하여 R3 주 수행 분해가 가능. M2706#42는 유리의 설명 곤란 맥락에서 obey(e)⑤가 반대여서 V축, M2706#44는 (e)만 Sally이고 나머지는 노부인이라 지칭 추적이다. 나머지 outside true는 위 표본에 포함되며 유형으로 일괄 인증하지 않는다. 두 심경은 행동에서 정서를 도출해 outside false가 타당하다. M2409#39는 두 트랙의 primary_reason이 모두 단계 전환을 말하므로 A outside true를 확정할 수 없다.

## v2.5 검증 권고

조건부 가능: v2.4 연구 배치로 진행하고 outside 문항별 근거·수정 전 snapshot·relevance unknown·NeedRank 금지를 유지한다.

b7 9는 개발 회귀로만 쓰고, 미열람 b9/보류 표본의 ID·본문/계약 해시·유형별 표본수·반사실 제공명제/잔여 선지·판정/보류 기준을 먼저 봉인한 뒤 독립 A/B 및 제3검토로 검증한다.

사전 등록에는 성공·실패·unclear 임계치와 수정 시 새 보류 표본을 쓰는 규칙을 넣는다. 각 유형을 포함한 독립 표본을 확보하고 v2.4와 v2.5를 서로 다른 판정자/무작위 배정 또는 순서 균형으로 비교하며, 먼저 기존 판정 노출 없이 원문 판단을 받는다. 함축은 동일한 제공 명제와 남는 선지 번호를 기록한다. E2/E3는 찾은 위치·대조 표현을 모두 적어 위치 제공 뒤에도 대조가 필요한지 본다. null secondary는 direct0·집합 정확성 양/음성 반례를 D2/D3에 함께 검증한다. b8은 이미 초안 이후 관측된 자료이므로 독립 최종 보류 표본으로 소급 지정하지 않는다. 같은 문항 재적용의 일치 상승과 b7→b8 5→1 모두 규칙 인과 효과로 인증하지 않는다.

## unclear 유지

- A/B 실제 독립 세션·초안 미열람은 로그 없으므로 unclear(패킷에 v2.5 계약 노출 없음은 확인).
- T-0111 이전 재표시 전 A-02 생성 과정은 snapshot 추가로 소급 인증 불가.
- R2/R4 outside, R4/E2 direct/indirect, 다중 direct primary의 유일한 우열은 unclear.
- 미관측 v2.5 타당도·인과 효과·학생 성취·제품 적용 적격성은 unclear.
- 기존 b5 원천 복구 및 2022#33·E3 경계의 이전 unclear 유지.

## 실행·제출

check.mjs·supplement.mjs의 assertions로 검증하고 write-review.mjs로 보고서를 생성한다. 초기 소유 worktree의 Git 접근 오류는 현재 리뷰 worktree의 공유 object 조회로 해결했다. 검사 이식 중 D3 오답 batch 조건 오기 및 보조 node -e 인용 실패는 교정했다. DB·제품 E2E·학생 측정·입력 쓰기·실제 봉인·main/원격 통합은 범위 밖 미실행이다. Git add/commit 시도와 evidence/submit의 원문은 command-output.local.json에 기록한다.

Git add/commit 시도 실패. 커밋·통합 미완료. 정확한 exit code·오류 원문은 scripts/research/goal-data/review-b8/command-output.local.json에 보존했다.
