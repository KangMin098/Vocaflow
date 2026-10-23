# T-0121 · b14-v24 및 과거 배치 반복 설명 독립 검증

현재 b14 연구 후보 유지. **다음 배치는 조건부 보류** — P1-01의 정당한 짧은 설명 오탐 경계를 처리하고 소급 목록을 정정한 뒤 진행한다. 새 P0 0 · 새 P1 1. result pass는 검증 수행 완료이며 수용 주장 전체 통과를 뜻하지 않는다. skip_count=0.

입력 @32bfeb2de02a09dd53e9dacb74fb50a3b9ebe601, diff a9617e2aa..32bfeb2de02a09dd53e9dacb74fb50a3b9ebe601 17파일을 읽었다. 최초 task show에서 IN_PROGRESS/session t-0121-codex 일치하여 추가 대기 불필요. PID·프로세스 조회 없이 진행했다. 중앙 development_policy를 읽고 현재 브랜치 유지. 입력 소유 worktree는 읽기만 했고, 그 worktree의 Git 인식 오류 때문에 현재 worktree의 공유 Git 객체에서 커밋을 고정했다. 원문·명령 출력·diff·실행 재현은 *.local.json에만 보존, 두 산출 폴더의 .gitignore에 제외 규칙을 뒀다.

## 수용 기준별 판정

- AC0 **refuted** — 가드 동작·반례·최초 B01 차단은 confirmed. 오탐 없음과 b8 A·b13 A만 걸린다는 전수성은 refuted. (scripts/research/goal-data/d2-validate.mjs:120; scripts/research/goal-data/d2-validate.check.mjs:22; scripts/research/goal-data/local/b14-v24/history/2026-10-23T10-09-44-982Z-b14-v24-B-01-first/chunk-B-01.out.json:1; docs/research/goal-data-batches/D2-task-mapping/mapping-review.md:273; scripts/research/goal-data/review-b14/guards.mjs:15)
- AC1 **confirmed** — 140행의 relevance·primary·decision_path·counterfactual를 대조. 문항별 판단 근거가 남아 있어 반복 설명만 격리하고 연구 후보 링크 유지가 타당하다. 의미 Gold는 미확정. (scripts/research/goal-data/review-b14/row-review.md:1; docs/research/goal-data-batches/D2-task-mapping/mapping-review.md:273)
- AC2 **confirmed** — T-0120은 검증기 통과를 회귀 범위로 삼아 not_observable 트랙 반복을 독립 집계하지 않았다. 전 계약·파생 트랙 집계와 행별 대조로 보강했다. (scripts/research/goal-data/review-b13/audit.mjs:33; docs/research/goal-data-batches/review-b13/review.md:1; scripts/research/goal-data/review-b14/guards.mjs:15)
- AC3 **unclear** — 40선정·해시·κ·primary·경보·프롬프트·후보10·갈림10·primary 갈림5를 검증했다. 관측 밖 노출과 의미 우열·인과 오염은 unclear 유지. (docs/research/goal-data-batches/D2-task-mapping/mapping-review.md:265; docs/research/goal-data-batches/D2-task-mapping/b14-v24-agreement.json:44; scripts/research/goal-data/review-b14/sample-review.md:1; C:/Users/Administrator/.claude/projects/d--workspace-Vocaflow/c4d62ec5-d73f-4d51-898b-475f87e9be60/subagents/agent-a1f1dd2c1cbec0e30.jsonl:73; C:/Users/Administrator/.claude/projects/d--workspace-Vocaflow/c4d62ec5-d73f-4d51-898b-475f87e9be60/subagents/agent-a8296655e51909765.jsonl:74; C:/Users/Administrator/.claude/projects/d--workspace-Vocaflow/c4d62ec5-d73f-4d51-898b-475f87e9be60/subagents/agent-a93e38f49b5b7961a.jsonl:75; C:/Users/Administrator/.claude/projects/d--workspace-Vocaflow/c4d62ec5-d73f-4d51-898b-475f87e9be60/subagents/agent-aefe18a07b0542b73.jsonl:75)
- AC4 **confirmed** — verdict·review·새 P0/P1·다음 배치·소급 처리·unclear 기록. (docs/research/goal-data-batches/review-b14/verdict.json:1; docs/research/goal-data-batches/review-b14/review.md:1)

## 새 가드·전수 목록

scripts/research/goal-data/d2-validate.mjs:120의 ID 제거/공백 정규화/서로 다른 문항 Set 기준을 독립 집계하고 실제 reasons 함수 결과와 비교했다. 중복 TASK 설명 수가 아니라 고유 문항 수를 센다. shipped 반례3(3문항 거부·2문항 허용·b13 비소급), 기존 이유 검사6, 공용 loader4 및 prereg 공용 loader 정적 확인을 메모리 FS에서 모두 재현했다. 최초 B01은 44설명이 19문항에 걸려 실제 validate B가 종료1, 트랙 통과0으로 거부했다. 최종 A/B는 가드 오류0이다.

일반 배치12개 A/B=24트랙, b9t-v24/v25 파생4를 추가해 **28트랙**. b10은 사전등록 예약이므로 최종 출력이 없다. b9t 비교의 원산출 E/F가 loader용 A/B 파일로 보존된 점을 구분한다. 배치와 계약 활성화 조건만 메모리에서 풀어 새 패턴 기준을 전수 적용했다. 실제 배포된 검증기를 과거 배치에 실행하면 의도대로 소급 차단하지 않는다.

|배치/트랙|반복 그룹 문항 수|설명 수|해석|
|---|---|---|---|
|b3-insert/B|3|3|이전 v2 계약의 공통 비관측 한계|
|b6-v23/A|3|3|이전 v2.3 계약의 삽입 E2 공통 격리|
|b8-v24/A|20 + 7|90 + 10|일반 확대: §18 기재|
|b9t-v24/A|4|4|파생 비교 산출: §18 목록 누락|
|b13-v24/A|5|5|일반 확대: §18 기재|

위 외 23트랙은 패턴0. v2.4+ 조건을 유지하고 배치 제한만 풀면 b8 A·b9t-v24 A·b13 A 3트랙이다. 따라서 일반 v2.4 확대에 한정한 두 트랙 목록은 맞지만, 전 배치·파생까지 전수라는 주장은 틀리다. 전체 ID 목록은 verdict.json, 140행 판정 필드 확인은 row-review.md.

## 새 P1 및 소급 결론

**P1-01** — b6 A 삽입 3행의 E2 분리 불가 설명은 각 행 E2 unknown·not_suitable과 일관된다. 계약/배치 활성화만 메모리에서 풀면 새 가드가 이를 거부한다. 같은 의미의 짧은 관측 한계가 b14 이후 3행에 있으면 판정 링크가 고유해도 전체가 배제된다. 현재 b14 최종에서 발생한 데이터 손실은 없다. (scripts/research/goal-data/d2-validate.mjs:120; scripts/research/goal-data/d2-validate.mjs:158; scripts/research/goal-data/local/b6-v23/chunk-A-02.out.json:831; scripts/research/goal-data/local/b6-v23/chunk-A-02.out.json:2004; scripts/research/goal-data/local/b6-v23/chunk-A-02.out.json:2112)

정당한 공통·계약 고정 설명을 식별하는 예외나 격리 수준을 정하고, 실제 3행·최초 B01 거부를 함께 회귀 검사한다. 단순 문장 길이 늘리기를 해결로 삼지 않는다. 실제 초기 B01이 계속 거부되고 정당한 공통 제한은 개별 설명 격리로 처리되는 두 조건을 같이 검증해야 한다. 문구 반복 자체가 무근거 판정·링크 오류의 충분조건은 아니다. b14 현재 최종 자료가 이 오탐으로 손실됐다는 증거는 없다.

§18의 목록 누락은 별도 검토 범위 결함으로 기록한다. b9t는 일반 결합478에 더해지는 신규 문항이 아니므로 일반 R1 총계 결함으로 확대하지 않는다. b3·b6를 왜 적발하지 않는지 계약 조건을 숨기지 말고, 반복 패턴 전체와 적용 대상 결함을 나누어 적어야 한다.

**소급 처리 한 줄:** 과거 링크는 유지하되 b8 A·b13 A·b9t-v24 A의 반복 not_observable 설명은 문항 고유 근거에서 격리하고 b3 B·b6 A의 정당한 짧은 설명은 계약 경계로 구분한다.

140행의 결정 경로 인용을 원문에 결속했고 간접 링크의 오답/근거 반사실을 전수 결속했다. primary_reason·decision summary·반사실 완전 복제0. relevance·primary 값은 같은 장르에서 반복될 수 있으므로 값이 같은 것만으로 틀이라 보지 않았다. 원문별 판단까지 똑같이 채운 경우는 확인되지 않았으므로 일괄 링크 폐기나 재판정은 요구하지 않는다. 의미 경계의 미확정은 그대로다.

## T-0120 누락 원인과 보강

T-0120 audit.mjs:33–34는 당시 validator의 최종 오류0을 회귀 증거로 사용했다. 그 버전 reasons는 primary_reason만 검사했다. supplement의 최초/최종 비교도 계약 구조·relevance 변경·주 TASK 이유에 집중했고 not_observable의 트랙 간/문항 간 정규화 반복을 독립 집계하지 않았다. 그래서 b13 A의5행 반복을 놓쳤다. 당시 결함0은 당시 검사 범위의 결과였으며 설명 고유성 전수 통과로 해석하면 잘못이다.

이번에는 ① 모든 최종 트랙·파생·계약 버전을 명시적으로 열거 ② 새 패턴 기준을 활성화 조건 밖에도 메모리 적용 ③ 적발 트랙 전체140행에서 why와 판정 필드를 분리해 원문 대조 ④ 최초/최종 자기 라벨 스냅샷 및 세션 전문 대조 ⑤ 정당한 짧은 설명 반례를 추가했다. 반복 수·완전 일치만으로 의미 타당성을 자동 판정하지 않는다.

## b14 산출·diff·회귀 재계산

선정 2021#32–45 14 + M2109#18–44 도표25 제외26=40. 제외15는 앞 배치 기판정13+도표2이고 M2109#45는 cap 밖이다. 선정·입력·원문/지문·계약·프롬프트·history 해시를 재계산했다. 기존 선정과 중복0. D2 네 생성물을 바이트 재현했다. 일치218/240=.9083333333, κ=.8291704413, primary35/40, R1 70, 갈림22. 경보는 일치<.80과 κ<.68 동시일 때이며 모두 ok다.

- r.central_meaning: 일치 0.8750 · κ 0.7800
- r.inference: 일치 0.9500 · κ 0.7222
- e.task_demand: 일치 1.0000 · κ 1.0000
- e.option_correspondence: 일치 0.9000 · κ 0.8296
- r.discourse_structure: 일치 0.8750 · κ 0.7923
- e.evidence_location: 일치 0.8500 · κ 0.7558

12개 일반 배치 최종 validator 회귀는 모두 종료0. 이는 새 가드의 소급 활성화 통과와 구분한다. JSONL 기존 행 변경/삭제0, 후보70·갈림22·D3 reasoning40·오답160 추가. D3 새 원리40행 및 오답160을 판정의 발문·구조·결정 경로·primary·근거 해시·왜곡·설계·이유에 다시 결속했고 전 유형 group와 coverage를 재계산했다. 결합478문항·18시험·R1 1163·갈림467, D3 primary411/478·왜곡1374/1912. relevance 공개 필드는 모두 unknown이다. 계약 일치율을 의미 Gold·학습효과로 확장하지 않는다.

## 프롬프트·최초 출력·노출 예외

틀과4개 prompt·입력 청크 해시 일치, 템플릿 치환만으로 전문 재현, 원 세션 첫 user와4개 모두 일치. b13 대비 배치 이름 치환 외 계약 변경 없음. 기존 manifest 덮어쓰기 거부와 쓰기0을 메모리 재현했다.

- B-02: 전문 일치. C:/Users/Administrator/.claude/projects/d--workspace-Vocaflow/c4d62ec5-d73f-4d51-898b-475f87e9be60/subagents/agent-a1f1dd2c1cbec0e30.jsonl:73
- B-01: 전문 일치. C:/Users/Administrator/.claude/projects/d--workspace-Vocaflow/c4d62ec5-d73f-4d51-898b-475f87e9be60/subagents/agent-a8296655e51909765.jsonl:74
- A-02: 전문 일치. C:/Users/Administrator/.claude/projects/d--workspace-Vocaflow/c4d62ec5-d73f-4d51-898b-475f87e9be60/subagents/agent-a93e38f49b5b7961a.jsonl:75
- A-01: 전문 일치. C:/Users/Administrator/.claude/projects/d--workspace-Vocaflow/c4d62ec5-d73f-4d51-898b-475f87e9be60/subagents/agent-aefe18a07b0542b73.jsonl:75

예외3은 confirmed: A01 로그52의 목록 명령에 다른 파일 이름이 보인다. B02 로그46은 금지 실행기 소스를 sed로 실제 접근하되 출력을 버렸으며 다음 tool 결과는 완료 표식뿐이다. B01 로그18은 codebook 크기를 본다. 추가로 다른 청크들도 wc로 codebook 메타데이터를 보지만 내용 읽기는 없다. 임시 긴 출력 재열람은 각 자기 청크 원문 출력에서 유래했다. B02의 금지 접근을 무위반으로 정리하면 틀리지만, 관측 로그에서 실행기 본문·타 트랙 판정·v2.5 규칙이 모델에 전달된 증거는 없다. 명령상 접근과 모델의 내용 노출·인과 영향은 구분하며 절대 미노출은 unclear다.

자기 라벨 최초80과 최종80을 대조했다. B01 최초→최종19행의 not_observable44개가 고유하게 바뀌었고 primary·relevance·decision_path·counterfactual 변경0. 최초 기준 M2109#22/#23의 stem_demand도 수정됐으므로 모든 필드 변화가 why뿐이라는 주장은 하지 않는다. A01의 짧은 발문3·오답이유1, B02의 오답이유4도 수정됐다. A02는 변화0. history에 동반 복사된 타 청크를 별도 최초 출력으로 중복 계수하지 않았다. 최종80은 v2.4 행 검사 통과, v2.5만 허용하는 구조 없음.

## 표본·불확실성·마무리

후보10·갈림10·primary 갈림5를 원문과 대조했다. 후보10의 해당 TASK 근거는 지지하지만 갈림과 primary 단일 우열은 미확정이다. 상세 scripts/research/goal-data/review-b14/sample-review.md:1. 표본 숫자를 중복 제거 원문 수로 오인하지 않는다.

검사 685개 수행·실패0, 다섯 수용 범위 모두 조사하여 skip_count=0. P1 재현 검사는 기대한 반례가 발생했음을 확인한 것이며 제품 결함 해소 pass가 아니다. DB 쓰기·입력 파일 변경·새 분석자 실행·제품 E2E·학습자/Gold 측정·main/원격 통합은 미실행이다. 요청대로 Git add/commit을 시도하고 evidence→submit 출력 원문을 finish.local.json에 보존한다. 커밋 실패와 검증 수행 완료를 구분한다.
