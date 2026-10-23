# T-0129 · b17-v24 독립 검증

**가능 — v2.4 연구 후보 확대만; 문항별 수기 수정·최초 스냅샷·실행 로그 보존과 의미 경계 미확정 유지. 새 P0 0 · 새 P1 0.** result=pass는 검증 수행 완료이며 의미 Gold나 모든 수용 주장 통과가 아니다. skip_count=0.

고정 입력 @c839832caa110f886b397aa84fc3b7c9679f08b6, diff 8980aaa59..c839832caa110f886b397aa84fc3b7c9679f08b6의 15파일을 읽고 생성물 전량을 파싱·결속·재계산했다. 최초 task show에서 IN_PROGRESS/session t-0129-codex 일치하여 추가 대기 불필요. PID 조회 없음. 중앙 development_policy를 UTF-8로 읽었고 현재 브랜치를 유지했다. 입력 worktree는 읽기만 했다. Git은 현재 검토 worktree의 공유 객체를 사용했다. 원문·전체 diff·명령 출력·세션 전문·조립 코드는 *.local.json에만 두며 두 산출 폴더의 .gitignore로 제외한다.

## 수용 기준

- AC0 **confirmed** — 자기 최초79→최종80행 전량 비교. 기존9행의 지정 필드 수정과 B01 누락1행 수기 추가. 관측된 출력 후 수정은 문항별 Edit이며 일괄 치환·판정 자동 생성 없음. (scripts/research/goal-data/review-b17/assembly.mjs:11; scripts/research/goal-data/review-b17/supplement.mjs:18; scripts/research/goal-data/local/b17-v24/chunk-A-01.out.json:376)
- AC1 **confirmed** — B02 스크립트의 첫 출력 전 특정 리터럴 한 곳 수정은 스냅샷 우회로 관측되지 않음. 수정 전후를 메모리 재실행해 차이는 2017#29 오답1 유형뿐. 세 조립 경로와 B01 직접 Write가 자기 최초본을 구조적으로 재현. 프롬프트·manifest·실행 전문 일치; 관측 validator 타 청크 ID0. 절대 미노출은 unclear. (scripts/research/goal-data/review-b17/assembly.mjs:14; scripts/research/goal-data/local/b17-v24/prompts/manifest.json:1; scripts/research/goal-data/review-b17/supplement.mjs:25)
- AC2 **confirmed** — 40선정·해시·일치224/240·κ .874739·primary34/40·R6 κ .545455/공동direct3·경보를 재계산. 17개 로컬 배치 validate 결함0, 실제 격리 회귀32/32. runner/validator/회귀 소스는 8980aaa59와 동일. (docs/research/goal-data-batches/D2-task-mapping/b17-v24-agreement.json:43; scripts/research/goal-data/review-b17/audit.mjs:45; scripts/research/goal-data/review-b17/regression.mjs:14)
- AC3 **unclear** — 후보10·갈림10 및 primary갈림6의 원문 대조 완료. 후보 근거 지지, 의미·primary Gold 미확정. 심경 계약 개정 후보는 지지하나 b13/b14/b15에서도 A/B primary가 반복 불일치했다는 해석은 refuted. (scripts/research/goal-data/review-b17/row-review.md:1; docs/research/goal-data-batches/D2-task-mapping/mapping-review.md:317; docs/research/goal-data-batches/review-b13/review.md:70)
- AC4 **confirmed** — verdict/review·새 P0/P1·다음 배치 가부 및 unclear 명시. (docs/research/goal-data-batches/review-b17/verdict.json:1; docs/research/goal-data-batches/review-b17/review.md:1)

## 최초→최종 및 출력 수정 방식

자기 청크 최초본만 기준으로 삼았다. 다른 분석자의 snapshot에 함께 들어간 복사본을 새 최초본으로 세지 않았다. 최초 A01/A02/B01/B02는 20/20/19/20, 최종은 각각20행이다. 기존79행 중9행 변경·70행 불변, 누락1행 추가다. 기존행의 links·primary·decision_path·source hash 변경0. A01의3개 관측 중복은 각 행의 not_observable에서 E1 항목만 지웠고 directly_observable은 유지했다. 이 정합성 수정이 실제 관측 타당성을 확립하지는 않는다.

|청크|문항|변경 필드|최초 파일:줄|최종 파일:줄|
|---|---|---|---|---|
|A-01|2018#21|stem_demand|scripts/research/goal-data/local/b17-v24/history/2026-10-23T11-38-35-829Z-b17-v24-A-01-first/chunk-A-01.out.json:376|scripts/research/goal-data/local/b17-v24/chunk-A-01.out.json:376|
|A-01|2018#22|stem_demand|scripts/research/goal-data/local/b17-v24/history/2026-10-23T11-38-35-829Z-b17-v24-A-01-first/chunk-A-01.out.json:510|scripts/research/goal-data/local/b17-v24/chunk-A-01.out.json:510|
|A-01|2018#23|stem_demand|scripts/research/goal-data/local/b17-v24/history/2026-10-23T11-38-35-829Z-b17-v24-A-01-first/chunk-A-01.out.json:638|scripts/research/goal-data/local/b17-v24/chunk-A-01.out.json:638|
|A-01|2018#28|not_observable.0|scripts/research/goal-data/local/b17-v24/history/2026-10-23T11-38-35-829Z-b17-v24-A-01-first/chunk-A-01.out.json:1125|scripts/research/goal-data/local/b17-v24/chunk-A-01.out.json:1125|
|A-01|2018#29|not_observable.0|scripts/research/goal-data/local/b17-v24/history/2026-10-23T11-38-35-829Z-b17-v24-A-01-first/chunk-A-01.out.json:1230|scripts/research/goal-data/local/b17-v24/chunk-A-01.out.json:1225|
|A-01|2018#30|not_observable.0|scripts/research/goal-data/local/b17-v24/history/2026-10-23T11-38-35-829Z-b17-v24-A-01-first/chunk-A-01.out.json:1335|scripts/research/goal-data/local/b17-v24/chunk-A-01.out.json:1325|
|A-02|2017#27|distractors.0.why|scripts/research/goal-data/local/b17-v24/history/2026-10-23T11-38-43-243Z-b17-v24-A-02-first/chunk-A-02.out.json:1771|scripts/research/goal-data/local/b17-v24/chunk-A-02.out.json:1771|
|B-01|2018#21|distractors.1.why|scripts/research/goal-data/local/b17-v24/history/2026-10-23T11-38-50-429Z-b17-v24-B-01-first/chunk-B-01.out.json:77|scripts/research/goal-data/local/b17-v24/chunk-B-01.out.json:77|
|B-01|2018#38|entire added row|scripts/research/goal-data/local/b17-v24/history/2026-10-23T11-38-50-429Z-b17-v24-B-01-first/chunk-B-01.out.json:1 (item absent)|scripts/research/goal-data/local/b17-v24/chunk-B-01.out.json:477|
|B-02|2017#23|distractors.0.why|scripts/research/goal-data/local/b17-v24/history/2026-10-23T11-38-05-215Z-b17-v24-B-02-first/chunk-B-02.out.json:1433|scripts/research/goal-data/local/b17-v24/chunk-B-02.out.json:1433|

A01 요지·주제·제목의 요구 문장을 각각 일화 교훈·정의/사례·결론 선택으로 늘렸고, A02의2017#27은 우천 취소 안내 항목을, B01의2018#21은 공 전달 훈련을, B02의2017#23은 감독의 현실 조합을 반영해 오답 근거를 보강했다. 전행 반복 생성이나 여러 행에 대한 출력 일괄 치환은 실행 기록에서 관측되지 않았다. 실패한 Edit 시도와 대화 재기록에 나타난 동일 호출을 별도 성공 변경으로 중복 계수하지 않았다.

B01은 직접 Write로19행 작성 → snapshot → 검증에서 누락과 오답 근거2건 검출 → 자기 입력의 누락 문항 재열람 → 두 문항을 각각 Edit →20/20 순서다. 추가2018#38은 결핍 일반 진술·소금 사례·다른 영양분 사례를 잇고 네 오답 위치도 각각 설명한다. 기존행의 문장 틀을 복사해 판정 내용을 생성한 증거는 없고 이 문항 고유 내용이 확인된다. (원세션 agent-a4cdc3e1974514d93.jsonl:46,52,58,64,66,74; 최종 chunk-B-01.out.json:477)

## B02 첫 출력 전 경로와 노출

B02 원세션 agent-aa8d780ff6bdd15e3.jsonl:52의 조립 코드와 :58 명령을 읽었다. 특정2017#29 오답①의 왜곡 유형 리터럴만 form_error→other로 바꾼 다음 처음 조립 실행 → snapshot → 검증했다. 수정 전후 스크립트를 메모리 재실행한 차이는 이 유형 한 곳이고, 이후 결과가 자기 최초 snapshot 전체와 구조적으로 동일하다. 최초 출력 파일을 만들고 나서 수정한 뒤 스냅샷을 찍은 경로는 관측되지 않았다. 어휘 의미 오답을 형태 오류로 두지 않으려는 개별 정정은 타당하지만 other의 분류 정밀도는 Gold가 아니다.

A01의 rows/build, A02의 build, B02의 build는 문항별 판정 리터럴을 ID·SHA·status와 결합하고 필드 이름·TASK 별칭을 바꾼다. primary의 고정 우선순위 선택·판정 문장 조합 생성은 없다. 세 경로 모두 최초본 재현, B01의 직접 Write도 최초본 재현했다. 스크립트에 판정 리터럴을 작성했다는 사실과 판정 자체를 코드로 자동 결정했다는 주장을 구분했다. 실제 scratchpad 코드도 읽어 local 캡처에 보존했다. (assembly.mjs:11)

manifest의 틀·입력·prompt SHA와 네 첫 user 전문이 일치하며 새 청크 검증·수기 수정 규칙이 실제 전달됐다. snapshot/validate 출력에는 다른 snapshot의 내용이 포함되지 않았다. 관측된 청크 validate 결과의 다른 청크 ID는0이다. A02 :56 디렉터리 목록에는 다른 청크·input 파일명만 보였고 내용 열람은 관측되지 않았다. B02 :46은 codebook 앞부분과 자기 B02 파일명만 출력했다. A/B의 큰 원문 출력 재열람은 자기 입력의 tool-results 경로로 추적된다. 다른 트랙 내용·v2.5·실행기 소스 열람은 기록에서 관측되지 않았지만 절대 미접근·인과 오염 부재는 unclear다.

## 재계산과 전체 diff

2018 27+2017 13=40, 제외2, 기존 선정 중복0. source/passage/selection/input/계약/청크/prompt/history 해시를 대조하고 D2 생성물4개를 바이트 재현했다. 일치224/240=.9333333333, κ=.8747390397, primary34/40이다. R6는 일치.900·κ=.5454545455·공동direct3(2018#31/#33/#34)이다. 현 경보는 일치<.80과 κ<.68의 동시 조건이라 경보 없음이 재현되며, 낮은 κ를 해소했다거나 안정성이 확정됐다는 뜻은 아니다.

b2–b17 및 b9t 두 계약을 포함한 총17개 로컬 배치의 최종 validate 결함0을 확인했다. 실제 격리 프로세스의 제공 회귀32/32도 통과했다. runner·validator·회귀 소스는 기준8980aaa59와 바이트 동일하다. 첫 VM 회귀는 삭제를 모형화하지 못해 오탐이 나고 child process 환경도 없었으므로 그 실행을 통과로 세지 않았다. 실제 격리 파일시스템으로 대체한 결과를 최종 증거로 사용했다.

전체 JSONL diff는 append-only이며 기존행 삭제·변경0이다. b17 신규 R1 78·갈림16·D3 reasoning40·오답160. 누적586문항·23시험·R1 1371·갈림509, D3 primary504/586·왜곡1678/2344를 재계산했다. D3 전40행·160오답의 원판정 결속과 그룹/coverage 전필드를 대조했다. 코드 diff는 배치 등록1행과 D3 배치 목록 추가뿐이며 새 실행기 변경은 없다. (audit.mjs; supplement.mjs; verify-diff.mjs)

## 원문과 계약 경계

후보10·갈림10 및 primary갈림6을 합친 고유20문항의 원문·선지·정답·판정을 직접 대조했다. 문항별 결과와 파일:줄은 scripts/research/goal-data/review-b17/row-review.md에 있다. 후보 근거는 지지하되 갈림 문항의 의미 우열·학생 오답 경로는 미확정이다.

심경 계약 개정 후보는 지지한다. 2018#19는 앞쪽 상황 묘사와 뒤쪽 명시 감정의 조합이며, 2017#19는 행동을 감정으로 명명하는 판단과 두 장면 압축을 포함한다. v2.3 §6은 명시 정서와 추론을 구분하지만 행동 묘사의 재진술 범위·혼합 문항의 결정 단위·R5 압축 적용 여부를 충분히 정하지 않았다. 사후 규칙을 만들어 이번 판정에 소급하지 않는다.

다만 mapping-review.md:317의 과거 배치 반복 갈림 서술을 A/B primary 반복 불일치로 읽으면 refuted다. b13 M2206#19는 R6/R6,2021#19는 null/null, b14 M2109#19와 b15 M2106#19도 null/null이다. 실제 관측 불일치는 b17의 R6/null·R5/R6다. b13 독립 검토의 의미 unclear는 재확인됐으므로 의미 경계가 반복 문제였다는 더 좁은 해석은 지지한다. 과거 두 분석자 일치와 독립 검토의 미확정을 혼용하지 않는다. 새 P0/P1로 세지 않는 서술 정정 사항이다.

## 검증과 마무리

독립 검사387개 실패0·제공 회귀32/32·skip_count0. 캡처324파일과 원세션4개의 바이트 불변을 종료 전 확인했다. 원문·명령 출력은 local 파일만 보존하며 입력 소유 파일 변경0. 재현은 node scripts/research/goal-data/review-b17/capture.mjs → node scripts/research/goal-data/review-b17/run.mjs → write-review.mjs다. 로컬 입력과 세션 기록이 없는 환경은 의미·노출 검증을 Git 파일만으로 완결할 수 없다.

DB 읽기/쓰기·제품 빌드/E2E·사람 Gold/학생 측정·봉인/NeedRank 승인·main/원격 통합은 미실행이며 통과로 세지 않는다. 요청 순서대로 Git add/commit 시도 후 evidence와 submit을 실행한다. 커밋 결과와 검증 완료는 별개이며 실제 명령 출력·오류는 finish.local.json에 보존한다.
