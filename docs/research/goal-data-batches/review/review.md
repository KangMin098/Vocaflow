# T-0088 — D1–D4 독립 검증

검증 집계: **confirmed 80 · refuted 7 · unclear 46**(전체 133 판정 행; 상위 요약·하위 표본 포함).

D2 최종 보수 판정은 R1 {"confirmed":22,"refuted":0,"unclear":8}, 갈림 {"confirmed":10,"refuted":0,"unclear":20}다. R3 11개는 모두 unclear다. 명확한 v2 경계 위반은 부정 발문 E1의 B 판정 1개이며, #30 E2는 인접 문장/다른 문장 규칙이 겹쳐 위반 판정을 유보했다. 반사실 허위 확정 0개와 지지 보류 3개를 구분한다.

이 결과는 Codex의 AI 검증이며 사람 검수 결과·출시 승인·DB 수정 승인이 아니다. D1–D3 입력은 `80fa4454023c6b7086ac5cf4d7c12d459d26b0a0`, D4 입력은 `1b8f089e590536e2ef03c49cb3b6c85c0432ba85`다. 코드 근거는 D4 input_head의 38개 입력 해시와 일치함을 확인한 이 worktree의 `80fa44540`에 고정했다. PLAN은 `feat/goal-plan@c44f41a5cbab4348908e7bc18fe39e09ad183592`을 읽기만 했다. 항목별 판정·파일:줄·원문 SHA는 [verdict.json](./verdict.json), 표본 선정과 기계 검사는 [sample-checks.json](./sample-checks.json)에 있다.

## D1 — DB 직접 조회

[db-checks.json](./db-checks.json)에 GET 쿼리·관측 시각·결과를 보관했다. SELECT 의미의 GET 6개가 모두 HTTP 200이었고 RPC·쓰기 요청은 없었다.

| 주장 | 판정 | 확인한 범위 |
|---|---|---|
| 삽입 262개 raw_block null | confirmed | 262/262 재현. 문장 결손 확정과 구분 |
| 주어진 문장 262개 결손 | unclear | 2025#38·#39는 삽입 대상에 해당하는 접두 문장이 passage에 존재. 전량 경계 복원·공식 PDF 대조 미실행 |
| null만으로 전체 부적격 처리 | refuted | 저장 형식 차이 반례 때문에 일괄 제외 불가. D1 자체도 후보라고 유보함 |
| M2709 미적재 | confirmed | 시험 id/학년도·월 대체 검색 및 해당 문항 조회 빈 배열 |
| 2023#38 choices null | confirmed | body_ok=true와 함께 확인 |
| D1 권리 기록 기준 적격 0(미정) | confirmed | source_note 있는 시험은 문항 없는 M2009뿐 |
| 법적 재배포 가능 문항이 0개 | unclear | 별도 권리 계약·원장을 전량 검토하지 않음 |

삽입 대상 문장의 분리 필드가 없다는 문제는 남지만, 이를 문장 내용 자체의 결손으로 바꾸면 정상 공급 후보를 대량 배제할 수 있다. 이번 두 반례를 262개 전체의 정상 판정으로 일반화하지 않는다.

## D2 — 관련성 후보 30 + 갈림 30

R1은 입력 순서의 서로 다른 문항 첫 링크 30개(도표 #25·삽입 #38/#39 제외), 갈림은 R3 11개 전부와 나머지 입력 순서 19개를 골랐다. 의도 표본이며 모집단 정확도 추정이 아니다. 로컬 b2-v2 원문과 선지·발문을 대조하고 A/B 근거도 읽었다.

- **반사실 허위 확정 0개, 의미 지지 보류 3개**: M2609#20 V3(비유 오독→동료 평가), #25 S4(도표 수치 없음), #30 R4(점층 오독→permanently). 허위 확정 0을 참 60개나 유인 효과 확인으로 바꾸지 않는다. #25 B의 병렬 구조 부재 설명도 실제 higher/lower 병렬과 충돌한다.

AI 후보의 relevance=unknown은 유지한다. 이 검증만으로 NeedRank·진단 입력 자격이 생기지 않는다.

## D3 — 오답 왜곡 30

어법·순서 각 4개를 먼저 포함하고 b2-v2 유형별 표본으로 30개를 구성했다. 결과는 {"unclear":13,"confirmed":16,"refuted":1}다. 도표 2개는 수치가 없으므로 정답 번호로 역산하지 않고 unclear다.

**어법 범주 부재 주장은 refuted**다. v1을 상속한 v2 계약에는 form_error가 이미 있다. M2609#29의 정답 아닌 네 선지는 옳은 형태인데 A는 other, B는 form_error로 분류했다. 두 트랙 모두 옳은 형태라는 설명은 맞지만 form_error의 의미가 실제 오류인지 어법 유인 일반인지 모호하다. 개별 네 레이블 판정은 unclear로 두며 정상 형태 유인의 적용 경계를 보완해야 한다.

**순서의 분류 정밀도 공백은 confirmed**다. 네 오답 모두 other로 합의했지만 지시 선행·대조 대상·과정/효과 배열 단절이 구별되지 않는다. other 사용은 현 계약에서 허용된다.

전수 산술을 다시 계산한 원문 근거 왜곡 일치는 164/280다. 이것은 A/B 일치이며 정확도나 학습자 오답 원인이 아니다. 30개 중 범주 반박 1개는 M2609#21 ② A의 과일반화다. 어법 4개는 원문 설명이 맞고 레이블 적용 범위만 모호하므로 unclear다. 범주가 겹치는 나머지 항목은 원문 설명이 맞더라도 단일 레이블을 억지 확정하지 않았다.

## D4 — handoff 5항목

1. **판정 코드 주장 confirmed**: skill-diagnosis.ts:91–133은 독립 첫 시도·확정 후 순서·120일 상한·연속 2정답을 본다. 다른 날·지문 identity·공급 역할은 입력 조건이 아니다. supply.ts의 역할 자격, lifecycle-evidence.ts의 회차 후 수행/전이 운영량, evidence-claims.ts의 NOT_ESTABLISHED를 지연 기억 판정으로 혼동하지 않았다. 공급 노출 원장에는 같은 지문 방어가 별도로 있다.
2. **M1 confirmed**: 성공만 4회는 unverified이며 As-Is의 독립 근거가 있으면 checking에 남는다. feat/goal-plan의 plan.ts:32와 goal-plan.ts:106은 이를 도달로 바꾸지 않는다. 현재 후속 목표 엔진의 개발 상태는 이번 결론 범위 밖이다.
3. **21분류 전체는 refuted**: TASK별 {"confirmed":17,"unclear":2,"refuted":2}. R2는 기출 2022#36 cohesion-link에 연결되나 관계 종류+근거 단서를 직접 받지 않는다. E3는 기출 option-restate에 연결되나 함정 선택만으로 약함 판정 금지 제한이 공통 실패 판정에 반영되지 않는다. 좁은 도구 실행 가능과 전체 도달 계약 충족을 구분한다. V4·R6는 형식 외 추가 도달 조건 누락은 찾지 못했지만 현재 승인·자격·납품은 unclear다.
4. **M4 전체 refuted / M7 좁은 방어 confirmed**: 연습 화면·도움·해설 뒤·시각 불확실 제외는 맞다. 합성 제외는 실제 코드가 synthetic:false로 바꿔 우회한다. M7의 정본 키는 중심 TASK 하나에만 붙으며 창작 키도 TASK별로 분리된다. R3/R4의 측정 중복까지 막는다는 뜻은 아니다.
5. **누락 confirmed**: R5 창작과 기출의 채점 범위 차이, R2/E3 관찰 제한과 약점 확정 충돌, 사람 전용 분류와 SQL의 AI 결정 허용 정책 차이, passageGroup 이름만 보는 세트 검증의 한계를 기록했다. 현재 DB 승인 상태는 추정하지 않는다.

[runtime-checks.json](./runtime-checks.json)의 순수 함수 실행에서 성공만→unverified, 같은 날 같은 지문 메타데이터 2실패+2성공→resolved, 합성만→resolved, 연습/해설 뒤→unverified를 재현했다. R5 창작 r5-cm-ind-1은 근거·관계가 모두 틀려도 선택·중심이 맞으면 isCorrect=true였다. 실제 TS를 메모리에서 변환해 실행했으며 앱 파일·캐시·DB를 쓰지 않았다. 초기 실행은 이 worktree 의존성 부재·fixture 경로·응답 enum 문제로 실패했고 이를 수정한 최종 실행 14 assertion이 통과했다. E2E 통과로 보고하지 않는다.

## 검증·변경 범위

고정 git 객체·로컬 원문 읽기, D1 DB SELECT, 원문 해시·인용 검사, 순수 함수 재현을 수행했다. 제품 코드 변경이 없어 앱 전체 lint/typecheck/test 및 화면 E2E는 미실행이다. 공식 삽입 원본 전량 대조와 현재 승인·납품 상태 조회도 미실행이다. 기존 임시 D4 초안은 판단의 출처나 통과 증거로 사용하지 않았다. 다른 세션이 생성한 파일은 수정·커밋하지 않는다. 이 검토는 제품 수정·DB 적용·main 통합을 수행하지 않으며 사용자가 지정한 review 브랜치에서 자기 review 파일만 git add/commit --only로 커밋하려 했으나 중앙 Git의 index.lock 생성 권한이 거부되어 git add 단계에서 차단됐다. 커밋·통합·push는 미완료이며 권한을 우회하지 않았다. 차단 경로: D:/workspace/Vocaflow/.git/worktrees/Vocaflow-goal-data-review/index.lock.

## 목표 달성 시스템 영향 기준 공백 상위 5개

1. **선행 실패 없이 이미 가능한 TASK의 도달 근거 경로** — 성공만 한 학습자가 checking에 남아 이미 가능한 TASK를 재확인하게 될 수 있다. 다음 검증: 실패를 선행 조건으로 요구하지 않는 성공 근거와 도달 상태 계약을 정하고 PLAN 경로까지 검증한다.

2. **TASK 도달 조건과 공통 연속 2정답 판정의 불일치** — 같은 날 성공을 다른 날 유지로, 문항 차이를 새 문맥으로, 한 유형·포인트를 범위 전체 성공으로 과대해석할 수 있다. 다음 검증: 정본의 날짜·문맥 identity·포인트·유형·횟수 조건을 각각 결속한다. 승인되지 않은 최소 간격은 임의로 정하지 않는다.

3. **원천 결손과 저장 형식 차이·권리 미정을 구분한 공급 적격 근거** — 최신 시험 공백과 실제 선지 결손은 공급을 제한한다. 반대로 접두 삽입 문장을 놓치면 정상 후보를 대량으로 부적격 처리한다. 다음 검증: 삽입 대상/본문 경계를 전량 복원 대조하고 권리 상태는 명시 원장으로 결속한다. DB 수정은 별도 승인 범위다.

4. **확인 키별 측정 범위·관찰 제한·승인 정책 결속** — 키의 존재를 TASK 전체 평가 가능으로 읽거나 다른 채점 범위를 하나의 성취로 합치면 잘못된 목표 상태를 만든다. 다음 검증: 도구별 관찰 범위와 상태 승격 제한을 명시하고 동일 revision의 결정·자격·납품을 읽어 확인한다.

5. **R3 경계와 오답 왜곡 범주 적용 기준** — AI 일치 후보라도 관련성·오답 원인을 확정할 수 없고 NeedRank·진단 입력으로 넘기면 불확실성이 사라진다. 다음 검증: R3 역할 해석/명명 경계, 정상 어법 유인/형태 오류, 순서 연결 단절 범주를 계약에서 구분하고 같은 원문으로 재검증한다.

## 재개 및 제출 기록

재개 지시에 따라 재실행하지 않음. task show의 pid 932/product_lock_token 63035f0a736d412a가 T-0088 자신의 실행임을 확인.

최초 실행 실패 메시지 원문은 잔존 파일에서 확인하지 못했다. 추정하여 복원하지 않는다.

최종 산출 재생성은 scripts/research/goal-data/review/finalize.mjs, 검증은 review/validate-output.mjs를 사용한다. build-verdict.mjs는 재개 전 초안 생성기로 최종 결과는 finalize.mjs의 유보 판정 보완을 포함한다.

엔진 인계 허용 13개는 verdict.json의 engine_handoff에 범위와 근거를 명시했다. unclear 및 개별 AI 링크는 엔진 입력으로 승인하지 않는다.

기존 커밋 관찰: 8456ee69d8ef96058d8cfab4764aea66b3669edb. 검증 도중 HEAD가 이전 실행의 검토 커밋으로 진행한 것을 관찰했다. 이 세션의 git 명령 성공으로 주장하지 않는다. 최종 보수 판정 보완과 ev.json은 이 커밋에 포함되지 않았다.

최종 보완분 Git 오류 원문: fatal: Unable to create 'D:/workspace/Vocaflow/.git/worktrees/Vocaflow-goal-data-review/index.lock': Permission denied

추가 evidence 등록 실패: 거부 [NOT_REVIEWER] REVIEW 단계 증거는 등록된 다른 owner(리뷰어)만 붙인다

submit 재시도 실패: 거부 [BAD_TRANSITION] REVIEW → REVIEW 불가. 현재 상태는 이미 REVIEW다. 이 세션의 추가 증거 등록·최종 보완 커밋·재제출 성공으로 보고하지 않는다.
