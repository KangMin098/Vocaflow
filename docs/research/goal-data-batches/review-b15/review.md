# T-0122 · b15-v24 및 802 확대 독립 검증

**연구 후보506문항 유지, 802 확대 완료·독립 관측 인계는 보류. 새 P0 0 · 새 P1 2.** result pass는 검증 수행 완료다. 수용 주장 전체 통과가 아니며 skip_count=0.

입력 @57b7e7006e8e725f5909e4872f8d65ae30a879b5, diff 32bfeb2de..57b7e7006e8e725f5909e4872f8d65ae30a879b5 15파일. 원 소유 worktree는 읽기만 했다. 중앙 development_policy와 T-0121을 읽고 같은 브랜치에서 진행했다. 최초 task show가 IN_PROGRESS/session t-0122-codex여서 추가 대기 불필요. PID·프로세스 조회는 하지 않았다. 원문·명령 출력·전체 diff·history·prompts는 *.local.json에 보존하고 두 산출 폴더의 .gitignore로 제외한다.

## 수용 기준별 판정

- AC0 **unclear** — 빈 값 허용·전30트랙 추이·A/B·공통 조립을 확인. 빈 값+direct 모순 주장은 refuted. 관측 기준 혼재는 confirmed. 공통 빈 값이 의미판정을 생략한 지름길인지는 행별 이유와 로그만으로 결정 불가. (docs/csat-learner/v62/data-expansion/ANALYST_CONTRACT.md:34; docs/csat-learner/v62/data-expansion/ANALYST_CONTRACT.md:45; scripts/research/goal-data/review-b15/observability.mjs:8; scripts/research/goal-data/review-b15/row-review.md:1)
- AC1 **refuted** — 28선정·해시·κ .8483754513·primary25/28·경보·프롬프트·최초/최종·회귀 confirmed. 802 대비 누락0은 refuted. T-0121 가드 과잉은 pinned commit에서 미해소이나 b15 실제 손실0. (docs/research/goal-data-batches/D2-task-mapping/b15-v24-selection.json:1; docs/research/goal-data-batches/D2-task-mapping/b15-v24-agreement.json:1; scripts/research/goal-data/review-b15/audit.mjs:33; scripts/research/goal-data/review-b15/observability.mjs:28; scripts/research/goal-data/d2-validate.mjs:120)
- AC2 **unclear** — 후보10·갈림10·primary 갈림3 모두 원문 대조 완료. A01 #29/#30 중복 수정은 첫 파일 쓰기 전임을 로그로 confirmed. 갈림의 의미 우열은 미확정. (scripts/research/goal-data/review-b15/row-review.md:1; docs/research/goal-data-batches/D2-task-mapping/b15-v24-review-sample.json:1; C:/Users/Administrator/.claude/projects/d--workspace-Vocaflow/c4d62ec5-d73f-4d51-898b-475f87e9be60/subagents/agent-a36e999d76b98adbe.jsonl:67)
- AC3 **refuted** — 506문항19시험·R1 1212·갈림480 및 인계 제한 confirmed. 802 확대 완료는 refuted; snapshot 대비 잔여296. 현 DB 상태는 DB scope none으로 unclear. (docs/research/goal-data-batches/D2-task-mapping/mapping-coverage.json:1; docs/research/goal-data-batches/D3-principles/principle-groups.json:1; scripts/research/goal-data/review-b15/observability.mjs:28; docs/research/goal-data-batches/D2-task-mapping/CONTRACT_V2_4.md:3)
- AC4 **confirmed** — verdict/review·새 P0=0/P1=2·불확실성·모집단 분해·재현 스크립트 기록. (docs/research/goal-data-batches/review-b15/verdict.json:1; docs/research/goal-data-batches/review-b15/review.md:1)

## 직접 관련과 직접 관측의 구분

v2.4는 ANALYST_CONTRACT를 상속한다. ANALYST_CONTRACT:34는 directly_observable을 direct의 부분집합으로 정의하고 :45는 선택형 정답으로 근거 지목·자기 말 압축이 확인되지 않는다고 명시한다. 따라서 빈 배열은 허용된다. direct가 있어도 모든 해당 수행이 정답만으로 분리 관측되지 않으면 빈 배열일 수 있다. 이를 모순으로 세거나 직접 관측의 최소 비율을 강제할 계약 근거는 없다. v2.4 자체에 별도의 빈 값 예외·최소 개수 규칙은 없다.

최종 일반26트랙+파생4트랙=30트랙, 996트랙행·498 A/B쌍을 집계했다. b10은 예약 표본으로 산출 없음. b9t는 신규 문항이 아니며 v2.4 E/F·v2.5 C/D 원산출의 loader용 A/B 사본이다. 아래 수는 빈 행/전체 행, 괄호는 빈 행 중 direct 링크가 있는 행이다.

|배치|A|B|같은 TASK 양쪽 목록 기재 A/B|
|---|---:|---:|---:|
|b2-v2|7/40 (7)|14/40 (14)|0/0|
|b3-insert|8/8 (8)|0/8 (0)|0/0|
|b4-v21|24/40 (24)|1/40 (1)|0/0|
|b5-v22|31/38 (31)|35/38 (35)|4/3|
|b6-v23|1/40 (1)|14/40 (14)|10/12|
|b7-v24|29/40 (27)|28/40 (25)|3/3|
|b8-v24|11/40 (11)|24/40 (24)|3/1|
|b9-v24|36/40 (36)|23/40 (21)|1/2|
|b9t-v24|12/12 (11)|6/12 (5)|0/0|
|b9t-v25|4/12 (2)|6/12 (4)|0/0|
|b11-v24|35/40 (33)|17/40 (15)|5/9|
|b12-v24|40/40 (40)|26/40 (26)|0/0|
|b13-v24|35/40 (34)|38/40 (37)|1/0|
|b14-v24|33/40 (32)|33/40 (32)|0/4|
|b15-v24|20/28 (19)|28/28 (27)|0/0|

전체 빈619/996, 그중 direct 링크 보유596. b13 A/B=35/40·38/40, b14=33/40·33/40, b15=20/28·28/28이다. b15 A01은12/20이고 A02/B02는8/8이므로 §19의 청크당13–20/20은 정확한 전수 기술이 아니다. b12 A도40/40으로 빈 비율 증가는 b13부터 시작하지 않았다. 모든 청크의 분모와 수는 verdict에 남겼다.

b13–b15 빈 행의 direct별 비관측 사유를 대조했다. b13 B M2206#27의 E1 한 건은 사유 누락이고 나머지는 대응 사유가 있다. b15 56행 전부에 원문별 결정 경로·판정 이유가 있으며 빈 행의 direct 사유 누락0이다. 그러나 B01 조립 스크립트는 문항별 데이터에서 관측 값을 받지 않고20행 공통 빈 배열을 넣는다(원 세션 agent-abcb7fc5d19be898a.jsonl:63). 같은 로그:68은 직접 판정 결과라고 보고한다. 따라서 공통 기본값 사용 자체는 confirmed, 문항별 의미 검토 생략·고의 지름길은 unclear다. 이유 문장이 남았다는 사실만으로 내부 사고의 독립성을 증명하지 않는다.

같은 문항 b15의 관측 집합은20/28 일치·8/28 갈림이다. M2109#45와 M2106#26/#27/#29/#30/#35는 A만 E1, #36/#37은 A만 R4를 관측 가능으로 둔다. B는 전부 비관측 이유를 적는다. A 자체에서도 #29/#30은 E1 관측, 유사 부정 발문 #42/#44는 빈 값이므로 명시적 관측 판정 기준 보완이 필요하다. 링크·primary 일치율 .923/κ .848이 이 관측 필드의 일치를 검증한 값은 아니다.

## 새 P1 · 영향과 재판정

**P1-01 — 802 전량 완료 주장과 선정 잔여가 불일치 (confirmed)**

506/802만 결합. 미포함296=도표 제외16+미선정 시험270+포함 시험 내 미기록10. b15 자체56프레임은28선정+28제외로 완결이나 전 모집단 완료·누락0 주장은 refuted.
범위 완료 문구를 최근19시험 부분표본 완료로 정정하거나 잔여280의 선정·제외 결정을 기록한다. 기존506을 버릴 이유는 없다.
근거: scripts/research/goal-data/review-b15/observability.mjs:28; docs/research/goal-data-batches/D2-task-mapping/mapping-coverage.json:32; scripts/research/goal-data/d2-export.mjs:23.

**P1-02 — 관측 가능성의 결과/과정 기준 혼재와 공통 빈 값 조립 (confirmed)**

b5–b14의61트랙행(고유50문항)이 같은 TASK를 두 관측 목록에 중복. b15는 중복0이나 A/B 관측 집합 갈림8. B01 조립이20행 공통 빈 배열을 넣는다. 각 비관측 이유는 존재하므로 무판정·의도적 지름길 인과는 unclear.
TASK 수행의 관측과 정답 결과의 관측을 구분해 정의하고 중복61행·갈림8문항부터 관측 필드를 재판정한다. b13 B M2206#27은 빈 값에 대응하는 E1 비관측 이유도 누락. 범위 전체 관측 필드는 독립 진단·NeedRank에 쓰지 않는다. 링크·primary 일괄 폐기나 빈 값의 일괄 direct 전환은 근거 없음.
근거: docs/csat-learner/v62/data-expansion/ANALYST_CONTRACT.md:34; docs/csat-learner/v62/data-expansion/ANALYST_CONTRACT.md:45; scripts/research/goal-data/local/b13-v24/chunk-A-01.out.json:1236; scripts/research/goal-data/local/b14-v24/chunk-B-02.out.json:102; C:/Users/Administrator/.claude/projects/d--workspace-Vocaflow/c4d62ec5-d73f-4d51-898b-475f87e9be60/subagents/agent-abcb7fc5d19be898a.jsonl:63.

양쪽 목록에 든61행은 단순 기재 사실로 확정했다. 일부 why는 정답 결과와 근거 진술의 서로 다른 관측 층위를 말하므로61행 모두 의미 오류라고 단정하지 않는다. 현재 스키마는 TASK 단위만 있어 그 층위를 기계적으로 구분할 수 없다. 독립 검사기는 빈+direct 허용, observable⊆direct, 양쪽 목록 중복 탐지를 각각 분리해 회귀한다. 중복 전수 목록은 verdict.json. 현 validator는 이 중복을 검출하지 않아 최종 통과와 관측 일관성을 구분해야 한다.

## b15 산출·원문·노출·기존 가드

선정28=M2109#45 1+M2106 27(도표25 제외). 자체56프레임=선정28+제외28(기판정26·도표2), cap에 의한 자체 잔여0, 기존 선정과 중복0. source/passage/input/selection/contract/prompt/chunk/history SHA를 재계산했다. 최초 자기 청크56행과 최종56행은 변경0. history에 함께 복사된 다른 청크는 최초 출력을 중복 계수하지 않았다. D2 생성물4개는 메모리 FS에서 바이트 재현됐다. JSONL 기존 행 변경·삭제0, 신규 후보49·갈림13·D3 reasoning28·오답112. D3 전체 그룹·원문 해시·발문·구조·결정 위치·primary·왜곡·설계·이유 결속을 재검산했다.

일치155/168=.9226190476, κ=.8483754513, primary25/28. 경보는 일치<.80과 κ<.68이 동시에일 때이며 모든 경보는 ok다. R6 κ .650은 일치27/28이라 중단 조건이 아니다. D3 결합 primary436/506·왜곡1446/2024=.7144268775.

|TASK|일치|κ|
|---|---:|---:|
|r.central_meaning|27/28|0.930175|
|r.inference|27/28|0.650000|
|e.task_demand|28/28|1.000000|
|e.option_correspondence|23/28|0.696312|
|r.discourse_structure|26/28|0.879570|
|e.evidence_location|24/28|0.747748|

후보10·갈림10·primary 갈림3을 원문 대조했다. 후보의 연구 링크 근거는 지지하되 갈림10과 primary3은 미확정으로 둔다. #33의 재진술/결합 추론과 #35의 문장 기능/전체 배열은 계약 경계이고, #45의 E2/E3는 탐색과 표현 반전의 결정 우선성 경계다. 상세 row-review.md의28문항별 요약 및 파일:줄을 따른다.

프롬프트4개는 보존 manifest와 입력 SHA·틀 SHA가 일치하고 템플릿 자리 치환만으로 재현된다. 네 원 세션의 최초 user와 보존 전문도 모두 일치한다. 원 세션 도구 기록은 허용 계약·자기 청크·자기 조립 파일·snapshot·validate 출력 범위였다. B01/B02의 codebook 내용은 최상위 키 목록만 출력되지만 소스 파일 자체를 require로 읽은 접근은 있었다. A01/A02도 wc로 크기를 봤다. 보고된 금지 파일 내용 열람은 관측되지 않았으나 절대 미노출·인과 오염 없음은 unclear다.

A01 원 세션 agent-a36e999d76b98adbe.jsonl:61에 #29/#30 E1 양쪽 기재 초안, :67에 두 not_observable 항목을 지운 뒤 첫 build→snapshot→validate 순서가 남는다. 첫 파일/스냅샷 이후 수정은 없다. 따라서 snapshot 비교만으로는 이 초안 수정을 발견할 수 없으며 최초 파일 이전 로그로 확인했다.

T-0121 P1-01은 고정 입력 @57b7e7006에서 미해소다(d2-validate.mjs:120). 정당한 짧은 설명3행 반례가 여전히 거부되고 최초 b14 B01의19행 틀도 거부된다. b15 실제 최종56행은 최초와 같고 validator 및 틀 가드 오류0이므로 현재 b15 손실 증거는 없다. 입력 소유 세션의 이후 작업 파일에는 보완이 보였으나 대상 커밋 밖이라 수정 완료로 인정하지 않았다. 기존 P1을 새 P1로 중복 계수하지 않는다. 일반 b2–b15 배치13개 최종 회귀는 종료0, 전30트랙 강제 활성화 가드 집계와 계약상 소급 비활성화는 구분한다.

## 802 확대 총괄

**고정 D1 inventory의 평가원·수능802문항과 대조하면 결합506(63.09%)·19시험이며 296가 미포함이다.** 도표 제외 기록16, 미선정10시험270(2014A/B 각23+2015–2020·M1809·M2006 각28), 포함19시험 안의 선정·제외 미기록10으로 분해된다. 10은2023#41–45, M2409#44–45, M2406#43–44, M2209#45다. M2406#43/#44는 사전등록상 별도 제외였지만 selection.excluded에 없고 일반 확대의 영구 제외 결정도 아니다. 다른8은 cap 밖 잔여다. M2009는 D1 문항0이라802 분모에 없다. 2023#38의 과거 결손은 이후 복구 재판정돼 현재 잔여에 다시 세지 않는다. 고유 문항 중복0은 confirmed지만 802 누락0·마지막 전량 완료는 refuted다. 인계는 연구 후보/설명만 허용하며 공개 relevance=unknown·NeedRank 금지·사람 Gold 미확정·독립 진단 금지를 유지한다. 정답 관측·관련도·학습효과로 확대 해석하지 않는다.

DB scope=none이므로 DB 연결은 하지 않았다. 위 분해는 고정 inventory/selection/excluded/결합 산출의 대조이며 현재 DB 실측으로 표시하지 않는다. **Claude 추가 조회 필요: 아래 SQL** — 현 DB 모집단·누락 문항의 결손/도표 상태를 조회하고 고정 목록과 대조한다. 조회 결과는 *.local.json에만 저장한다.

```sql
SELECT i.id, i.exam_id, i.no, i.type_id, i.body_ok,
       jsonb_typeof(to_jsonb(i.choices)) AS choices_type,
       CASE WHEN jsonb_typeof(to_jsonb(i.choices))='array'
            THEN jsonb_array_length(to_jsonb(i.choices)) END AS choices_count,
       (i.answer IS NOT NULL OR cardinality(i.answers)>0) AS has_answer
FROM csat_items i JOIN csat_exams e ON e.id=i.exam_id
WHERE e.organizer='kice'
ORDER BY i.exam_id, i.no;
```

## 검증·마무리

독립 검사 648개·실패0. 다섯 수용 범위를 조사했으므로 skip_count=0이나 AC0/2 unclear와 AC1/3 refuted는 그대로다. L1 연구 검토 범위의 파싱·SHA·집계·메모리 재현·반례·문서 검사를 수행했다. 제품 코드 변경·DB 읽기/쓰기·E2E·학습자 측정·원격/main 통합은 미실행이다. 재현: node --experimental-vm-modules scripts/research/goal-data/review-b15/{audit,supplement,verify-diff,guards,observability}.mjs를 각각 실행하고 transcripts.mjs → write-review.mjs. 입력 소유 파일을 수정하지 않는다.

요청 순서대로 Git add/commit 시도 → runtime/t-0122-ev.json → task evidence → submit을 수행하며 원문은 finish.local.json에 보존한다. 커밋 성패와 검증 완료를 구분한다.
