# T-0130 · b18-v24 독립 검증

**다음 배치 보류 — B18-P1-01 손 원본 동기화·재조립 일치 확인 후 v2.4 연구 후보 확대 가능. 새 P0 0 · 새 P1 1.** result=pass는 검증 수행 완료이며 전체 주장 통과·의미 Gold 승인이 아니다. skip_count=0.

고정 입력 @5d7292beaf412e4e238ce644151fee32358c777a, diff c839832ca..5d7292bea의 16파일을 캡처하고 구조·결속·생성물 전필드를 대조했다. 원문 의미 대조는 후보10·갈림10·primary갈림5 합집합 23문항이다. 첫 task show가 IN_PROGRESS/session t-0130-codex여서 추가 대기 불필요. PID 조회 없음. 중앙 development_policy를 읽고 현재 브랜치를 유지했다. 입력 소유 워크트리는 읽기만 했다. 원문·명령 출력·전체 diff·세션 전문·손 원본·조립 코드는 *.local.json에만 보존하며 두 산출 폴더에서 제외한다.

## 수용 기준

- AC0 **confirmed** — 네 조립 경로는 형식 변환만 수행하고 자기 최초 스냅샷을 재현한다. 최종본 재현 주장은 A01 두 설명에서 refuted. (scripts/research/goal-data/review-b18/assembly.mjs:20; scripts/research/goal-data/review-b18/row-review.md:1)
- AC1 **confirmed** — A01 두 행은 문항별 수기 수정이며 손 원본 미반영에 따른 재현성 결함이다. B02 첫 출력 전 수정은 손 원본의 네 문항에 한정된다. (scripts/research/goal-data/review-b18/assembly.mjs:29; scripts/research/goal-data/local/b18-v24/chunk-A-01.out.json:2150; scripts/research/goal-data/local/b18-v24/chunk-A-01.out.json:2269)
- AC2 **confirmed** — 40선정·해시·221/240·κ .855486·35/40·경보·b2–b18 validate·회귀32·8980aaa59 실행기·prompt/manifest를 재검증했다. 기록상 금지 내용 노출 없음; 절대 미접근은 unclear. (scripts/research/goal-data/review-b18/audit.mjs:45; scripts/research/goal-data/review-b18/supplement.mjs:4; scripts/research/goal-data/review-b18/regression.mjs:14)
- AC3 **unclear** — 후보10·갈림10·primary갈림5 원문 대조 완료. 2017#42 A의 경쟁 문장→잔여 선지 설명은 refuted; 2016#42 E2는 지지하되 의미·primary Gold는 미확정. (scripts/research/goal-data/review-b18/row-review.md:1; docs/research/goal-data-batches/D2-task-mapping/CONTRACT_V2_4.md:39)
- AC4 **confirmed** — verdict/review·새 P0/P1·다음 배치 가부와 unclear를 기록했다. (docs/research/goal-data-batches/review-b18/verdict.json:1; docs/research/goal-data-batches/review-b18/review.md:1)

## 조립 경로와 수정

네 스크립트의 원세션 코드를 읽고 파일 쓰기가 없는 VM에서 손 원본과 자기 입력만 연결했다. A01·B02는 ESM 원본을 합쳐 SHA/status를 붙이고, B01은 JSON 원본 셋을 합친다. A02는 튜플을 객체로, 표시명을 TASK id로 바꾸고 인용 존재를 검사한다. 판정 문장·primary·relevance·decision_path·reasons·counterfactual·왜곡 유형의 새 결정이나 우선순위 선택은 관측되지 않았다. 원본 내부 헬퍼도 인자로 받은 리터럴을 포장한다. 첫 스냅샷은 네 청크 모두20행, 전80행 재현이다. 원세션 assembly 위치는 A01 :75, A02 :71, B01 :82, B02 :95이며 세션 경로는 assembly.local.json에 보존했다.

A01의 2016#22·#23은 각 문항을 지정한 Edit로 not_observable[0].why만 고쳤다. 처음80행 중 변경2·불변78이며 links·primary·source hash 변경0. 과거 해석의 두 믿음과 생물학적 노화 지표라는 각 문항 내용을 반영한다. 중복 기록된 같은 호출은 별도 변경으로 세지 않았다. 하지만 손 원본 j2.mjs에는 이 설명이 반영되지 않았다. 현 손 원본+조립은 최초본과 같고 최종본과 두 필드가 다르며, 재조립본 validate A 01은 EXIT 1/결함1(2017#41·2016#22·#23 반복 설명)이다. **B18-P1-01**: 최초→수기 수정→최종 검증의 흐름은 지켜졌지만 최종 검증본을 재생할 수 없다. 입력 수정 권한이 없어 소유자가 원본을 동기화해야 한다. 판정 링크나 통계가 바뀌는 결함이라고 확대하지 않는다. (assembly.mjs:29; 최종 chunk-A-01.out.json:2150,2269)

B02는 첫 출력 전 손 원본에서 네 문항을 고쳤다. 2016#31 E2 indirect→n.a.로 바꾸며 근거·반사실·secondary·관측 설명을 함께 정리했고, #33은 E2 반사실을 특정 오답③ 경로로 바꿨다. #37·#38은 unknown E2를 secondary에서 뺐다. 최초 작성 원본→수정 원본의 메모리 출력 비교는 이 네 문항에만 차이가 있다. 첫 출력·스냅샷·최종은 같고 판정 리터럴 수정은 조립 코드가 아니라 손 원본에서 수행됐다. Python 시도는 실행 실패, 중복 호출 기록은 추가 변경으로 세지 않았다. #31의 변경은 단순 키 형식만이 아니라 relevance 판단의 변경이라는 점도 명시한다.

## 재계산·전체 diff·노출

2017 14+2016 26=40, 제외15, 과거 선정 중복0. source·passage·selection·input·계약·청크·prompt·history 해시 일치. D2 생성물4개를 바이트 재현했다. 전체 일치221/240=.9208333333, κ=.8554858338, 주 TASK35/40. TASK별 κ R5 .856115/R6 .760956/E1 1/E3 .869138/R4 .741658/E2 .849906. 현 일치<.80 AND κ<.68 경보 조건에 해당 없음. 실행기·검증기·회귀 소스는 8980aaa59와 동일하다. b2–b18 및 b9t 두 계약을 포함한 18개 로컬 배치 최종 validate 결함0, 제공 격리 회귀32/32 통과다.

JSONL 변경은 append-only, 기존행 삭제·변경0. b18 신규 R1 75·갈림19·D3 reasoning40·오답160. 누적626문항·24시험·R1 1446·갈림528, D3 primary539/626·왜곡1803/2504. D3 신규40행·160오답의 원판정 결속과 그룹/coverage 전필드를 재계산했다. 코드 변경은 b18 선정 등록과 D3 목록 추가, 프롬프트는 형식 변환만 조항 추가다. b17 심경 반복 갈림 서술은 이전 검증에 맞게 정정됐다. README와 mapping-review의 수치도 일치한다.

네 실제 첫 prompt는 보존본·manifest·템플릿과 일치한다. 관측된 자기 청크 validate 출력에 다른 청크 ID0. tool-use와 tool-result를 읽었으며 금지된 다른 판정·실행기 소스 내용 열람은 관측되지 않았다. B01의 codebook 키 목록 확인, B02의 codebook 허용 범위 조회가 있으며 A02의 큰 원문 재열람은 자기 입력 출력의 tool-results 경로다. 절대 미접근·관측 밖 인과 오염 부재는 unclear다.

## 원문 의미 경계

문항별 대조·파일:줄은 scripts/research/goal-data/review-b18/row-review.md에 있다. 후보 근거를 지지하되 지칭·삽입·어법의 범위 밖 수행과 묶음 관찰을 유지한다. primary갈림5(2017#35/#42/#44,2016#26/#40)는 미확정이다.

2016#42는 실용성이 없어 보이는 성질과 실제 가치의 대조가 정답②를 지지하며, 뒤 가치 문장을 택하면 오답④로 가는 경쟁 근거가 구체적이다. 양측 E2 primary 일치는 이 설명을 지지하지만 의미 Gold·독립 측정을 확정하지 않는다.

2017#42 A는 (B)를 맞히면 ①·④가 남는다고 정확히 적었지만, 경쟁 문장은 ③을 지지한다고 썼다. ③은 (B)가 틀려 이미 제거되어 그 근거 선택으로 잔여①·④를 가른다는 설명은 **refuted**다. 물리적 정밀성과 심리적 부정확성은 서로 다른 대상이기도 하다. ① delayed를 지지하는 별도 경쟁 문장은 제시되지 않았다. 따라서 A의 §4.3 충족 주장은 지지하지 않는다. B의 단일 R6도 (A)를 맞춰야 한다는 조건을 해결한 Gold는 아니다. §4는 결정 대기이고 두 수행이 있는 두 빈칸의 primary 경계를 사후에 새 규칙으로 정하지 않는다. 새 P1은 재현성1건으로 세고, 이 의미 사례는 기존 unclear 경계의 구체 반증으로 남긴다.

## 검증과 마무리

독립 검사395 실패0·제공 회귀32/32·skip_count0. 알려진 재현성 결함을 기대된 반례로 검사했으므로 검증기 실행 통과와 데이터 결함 해소를 혼동하지 않는다. 캡처 352파일·원세션4개·손 원본의 바이트 불변을 확인했다. 첫 VM 시도의 경로 표기/이벤트 핸들러 모형 오류는 검사 실패를 숨기지 않고 보완한 뒤 재실행했다. 최종 명령 출력은 commands.local.json, 결함 재현 원문은 assembly.local.json에 있다.

재현: node scripts/research/goal-data/review-b18/capture.mjs → node scripts/research/goal-data/review-b18/run.mjs → node scripts/research/goal-data/review-b18/write-review.mjs. setup.mjs는 이전 검사 이식용이며 기존 완료 검사를 덮어쓸 수 있어 재현 명령에서 제외한다. 로컬 원본·세션 없는 환경에서는 Git 파일만으로 모든 의미·노출 검증을 완결할 수 없다.

DB 접근·쓰기, 제품 build/E2E, 사람 Gold·학생 측정, main·원격 통합은 미실행이며 통과로 세지 않는다. 요청 순서대로 자기 산출물 Git add/commit 시도 후 evidence와 submit을 수행한다. 실제 명령 출력·오류는 finish.local.json에 보존한다.
