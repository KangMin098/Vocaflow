# T-0162 · b21-v24 독립 검증

**새 P0 0 · 새 P1 0. 다음 배치는 연구 범위에서 진행 가능. AC3의 TASK 의미·Gold는 unclear로 유지한다.** 13건의 현재 DB 전수 재현·학생 숙달·제품 사용 승인은 포함하지 않는다.

지정 입력은 **3cf2b8cbb4710002d8f20da621220e3b8445b4b0**이다. 현재 입력 HEAD는 그 이후 b11944d4여서 워킹 파일을 지정 커밋으로 오인하지 않았다. Git 명령 없이 Git 객체를 읽고 각 객체 SHA1을 검증해 지정 commit tree의 코드·문서·생성물을 고정했다. 비추적 local 청크·손 원본·프롬프트·history는 SHA256 manifest로 별도 결속하고 종료 시 원본 불변을 확인했다. 중앙 development_policy를 UTF-8로 읽었으며 두 허용 폴더 밖 쓰기·Git 조작·DB 접속·다른 owner 상태 변경은 하지 않았다.

## 수용 기준

- AC0 **confirmed** — 4/4 바이트 동일. 손 원본 80행 모든 제공 필드 동일. 최초 대비 16/80행의 설명·관측 필드만 변경, primary/relevance/왜곡 유형 변경0. 관측된 Write/Edit와 셸 명령에서 출력 직접 수정0. 손 원본 Write/Edit 재생17파일 모두 현재본과 일치. (scripts/research/goal-data/review-b21/assembly.mjs:1; scripts/research/goal-data/review-b21/source-chain.mjs:1; scripts/research/goal-data/review-b21/supplement.mjs:1)
- AC1 **confirmed** — 분석자 로그는 assemble 작성과 실행 요청 뒤 중단(실행 결과 없음), 최종 보고 없음. 오케스트레이터가 동일 assemble을 읽고 실행→첫 snapshot→결함0 결과를 남김. 손 판정 내용 생성·변경 없이 형식 변환만 수행. 첫 snapshot과 최종 동일. §25는 미수집을 명시함. (D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b21-v24/sources/A-02/assemble.mjs:10; D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D2-task-mapping/mapping-review.md:362; C:/Users/Administrator/.claude/projects/d--workspace-Vocaflow/c4d62ec5-d73f-4d51-898b-475f87e9be60.jsonl:6907; C:/Users/Administrator/.claude/projects/d--workspace-Vocaflow/c4d62ec5-d73f-4d51-898b-475f87e9be60.jsonl:6913; C:/Users/Administrator/.claude/projects/d--workspace-Vocaflow/c4d62ec5-d73f-4d51-898b-475f87e9be60.jsonl:6914; C:/Users/Administrator/.claude/projects/d--workspace-Vocaflow/c4d62ec5-d73f-4d51-898b-475f87e9be60/subagents/agent-a93f86f2656c694c7.jsonl:105)
- AC2 **confirmed** — 실제 최초 지시4/4 보존본 일치, 템플릿 재생·chunk·원천·snapshot 해시 일치, B prior 분석 미포함. 관측 로그에 금지 판정 내용 열람 없음(파일명 목록은 보임). 40선정/41제외, 223/240 κ0.8665576451, primary35/40, R4 κ0.6645702306 일치율0.8로 중단 경보 없음. b2–b21 및 b9t 두 변형 총21개 validate 결함0, 격리32/32. (D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b21-v24/prompts/manifest.json:4; D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D2-task-mapping/b21-v24-agreement.json:44; scripts/research/goal-data/review-b21/audit.mjs:1; scripts/research/goal-data/review-b21/supplement.mjs:1; scripts/research/goal-data/review-b21/regression.mjs:1; scripts/research/goal-data/review-b21/provenance.mjs:1)
- AC3 **unclear** — 주 TASK 갈림5개는 기록과 agreement/D3에 보존. R4 갈림8개 원문 대조 완료. 단일 기능과 여러 문장 단계 오독의 간접 경로를 현재 계약만으로 유일하게 결정할 수 없어 Gold 미확정. 순서5개는 모두 배열 자체가 결정이며 양측 R4 direct에 부합. §25의 갈림8 유형 요약은 부정확(순서0). (D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D2-task-mapping/mapping-review.md:362; D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D2-task-mapping/CONTRACT_V2_1.md:14; D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D2-task-mapping/CONTRACT_V2_3.md:27; scripts/research/goal-data/review-b21/row-review.md:1)
- AC4 **confirmed** — 두 #41/#42 지문은 빈칸·공백 제거 시 동일하며 표시 유무만 다름. 원문 추출은 빈 공간/줄바꿈을 보존하지만 실제 밑줄 문자는 없음. 제목 정답을 지지하는 다른 문장이 남아 연구 유지 근거는 지지. 로컬 배치로 평가원4쌍 재현, 과거 SQL·13쌍 응답 확인. 학평9쌍 본문 전수·현재 DB는 재조회 금지로 독립 재현 unclear. 결합 relevance 전부 unknown·D3 가설 상태·README 사용 금지 보존, 확정 전이/학생 숙달/출제 원리 승격 없음. (D:/workspace/Vocaflow/scripts/csat/data/columns/2014A.txt:613; D:/workspace/Vocaflow/scripts/csat/data/columns2/M1809.txt:653; C:/Users/Administrator/.claude/projects/d--workspace-Vocaflow/c4d62ec5-d73f-4d51-898b-475f87e9be60.jsonl:6787; C:/Users/Administrator/.claude/projects/d--workspace-Vocaflow/c4d62ec5-d73f-4d51-898b-475f87e9be60.jsonl:6792; D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/README.md:29; D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D3-principles/principle-groups.json:116; scripts/research/goal-data/review-b21/deep.mjs:1)
- AC5 **confirmed** — review.md와 verdict.json 작성. 새 P0/P1 없음. 연구 다음 배치 허용, Gold/진단 승격은 불허. 미실행과 불확실성을 별도 보존. (docs/research/goal-data-batches/review-b21/review.md:1; docs/research/goal-data-batches/review-b21/verdict.json:1)

## 재조립·수정 경로·A-02

네 assemble을 모두 읽었다. JSON 손 판정을 입력 순서로 묶고 id·source_sha256·AI_PROPOSED를 붙일 뿐 primary·relevance·왜곡 유형·판정 문장을 생성하거나 바꾸지 않는다. 손 원본80행의 제공 필드를 출력과 대조했고 모두 같다. 허용 폴더 아래 임시 복사본에서만 실제 assemble을 실행해 **4/4 최종 바이트 일치**를 확인했다. 원본 위치에서 assemble은 실행하지 않았다.

각 청크 자신의 최초 snapshot 대비 A-01은4행(관측 한계 설명), A-02는0행, B-01은7행(stem_demand3·관측 중복3·오답 근거1), B-02는5행(관측 중복) 변경이다. 총16/80행이며 primary·relevance·왜곡 유형 변경0이다. A-01의 “결함1”은 반복 그룹 하나이며 “수정1행”이 아니다. 중복 tool-use id는 한 번만 세고 Write/Edit를 실제 순서로 재생한 손 원본·조립17파일은 모두 현재본과 같다. 이는 최초→최종 diff만 보고 수정 경로를 추측한 것보다 강한 관측 근거다. 관측된 출력 직접 Write/Edit·셸 수정은0이다. 세션 밖의 절대 무수정까지 증명하지는 않는다.

A-02 분석자 로그 C:/Users/Administrator/.claude/projects/d--workspace-Vocaflow/c4d62ec5-d73f-4d51-898b-475f87e9be60/subagents/agent-a93f86f2656c694c7.jsonl:105에 assemble 작성, :106에 assemble·snapshot·validate 실행 요청이 남지만 그 요청의 실행 결과는 없다. 오케스트레이터는 C:/Users/Administrator/.claude/projects/d--workspace-Vocaflow/c4d62ec5-d73f-4d51-898b-475f87e9be60.jsonl:6907에서 스크립트를 읽고 :6913에서 실행하며 :6914에 wrote20→첫 snapshot→청크 결함0이 기록된다. 손 판정 내용 수정은 없고 최초 snapshot과 최종도 같다. 최종 보고/handback은 없어 source_gap_suspected를 “없음”으로 채울 수 없다. D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D2-task-mapping/mapping-review.md:362에는 미수집이 명시돼 있어 경위 기록은 정확하다. 첫 출력 이전 손 원본의 관측 중복 수정2회와 “snapshot 이후 수정0”은 서로 다른 범위다.

## 독립성·산술·회귀·생성물

실제 최초 지시4개는 저장된 프롬프트 전문과 같고 template→전문 치환, manifest prompt/chunk 해시, 원천·지문·계약·input·history 해시가 맞는다. B 청크에는 기존 분석/prior_traps가 없고, 관측 도구 기록에는 금지 판정 내용 열람이 없다. B-01·B-02는 디렉터리의 다른 파일/폴더 이름을 보았고, A-01·A-02가 읽은 tool-results는 자기 입력 출력 재열람이다. A-02 최종 보고 미수집을 B의 오염이나 절대 독립성의 증명으로 확대하지 않는다.

선정2014A9+M1809 7+M2006 24=40, 제외41. **223/240=.9291667, κ=.8665576451**, 주 TASK35/40. TASK별 κ는 R5 .721578, R6 1, E1 .948119, E3 .957356, R4 .664570, E2 .960435다. R4 일치율은 정확히 .8000이므로 “일치<.80 그리고 κ<.68”의 중단 조건을 충족하지 않는다. κ가 낮다는 사실은 남고 경보 없음이 타당도 증명은 아니다.

b2–b21의 기존 배치와 b9t-v24/v25 **21변형 validate 결함0**, 지정 커밋 실행기로 임시 격리한 d2-validate.check **32/32** 통과. b10은 별도 독립 배치가 없고 b9t 비교 변형으로 세었다. 제품 build/E2E는 이 연구 검증에 포함하지 않았다.

b21 agreement·표본·R1·갈림4파일을 메모리에서 바이트 재현했다. d2-combine과 d3-build도 파일 쓰기 대신 메모리 출력을 받아 결합·D3 **6파일**을 지정 커밋과 재현했다. JSON의 generated_at만 비교에서 제외했으며 JSONL은 바이트 동일이다. D3의 pilot 입력은 별도 로컬 읽기 전용 자료를 사용했다. 결합746문항·29시험·R1 1,685·갈림580, b21 추가75/17 및 D3 40문항/160오답. D3 주 TASK649/746, 왜곡2,151/2,984, source_text2,126/2,956, source_gap7문항이다. 이전 B20-P1-01 관련2014A#29·M1809#26은 D2 use=excluded_source_gap으로 현재 지정 커밋에서 격리됨을 확인했다.

## 원문 의미와 미확정

R4 갈림8개·primary 갈림5개·후보/갈림 표본·결손2개를 합친 원문 검토와 순서5개 전수 검토는 [문항별 대조](../../../../scripts/research/goal-data/review-b21/row-review.md)에 기록했다(정확한 경로: scripts/research/goal-data/review-b21/row-review.md). 한 문장의 기능을 R4 direct로 바꾼 명백한 신규 위반은 확인되지 않았다. 간접 R4에는 여러 문장의 단계와 특정 오답 반사실을 적었지만, 그 경로의 의미 타당도가 유일하게 정해지는 것은 아니다. 다섯 primary는 양측 값을 보존했고 사람 Gold로 정리하지 않았다.

§25의 “R4 갈림8 — 무관한 문장·순서”는 정정할 문구다. 실제8개는 요약1·제목4·빈칸2·무관한 문장1이며 순서 갈림은0이다. 순서5개는 모두 양측 R4 direct로 여러 단락 배열 자체가 답을 결정한다. 이 설명 정정은 산술/적격성 결함인 새 P1로 세지 않는다.

## 빈칸 표시 소실과13건의 증거 범위

2014A#41/#42와 M1809#41/#42는 같은 시험에서 빈칸 밑줄을 제거하고 공백을 무시하면 동일한 지문이다. #41만 표시가 없다. 원천 txt D:/workspace/Vocaflow/scripts/csat/data/columns/2014A.txt:613은 our 뒤 줄바꿈, D:/workspace/Vocaflow/scripts/csat/data/columns2/M1809.txt:653은 environmental 뒤 큰 공백을 보존한다. txt 자체에 문자 “______”가 있다는 식으로 읽으면 부정확하며, #42의 명시 표시와 추출본의 공백 위치를 합쳐 결손을 확인했다. 인쇄본의 시각적 밑줄을 직접 본 것은 아니다.

제목 정답은 각각 인식된 거리를 조정하라는 권고와 생태 회복을 돕는 경작지 관리라는 나머지 문장으로 지지된다. 결손을 없다고 덮지 않되 각주 정답 근거 소실과 같은 수준으로 자동 제외할 이유는 이번 문항에서 확인되지 않았다. 난도 불변·학생 영향0까지 주장하지 않는다.

같은 규칙을 저장된 기존 배치 입력 전량에 적용하면 평가원4쌍(2014A·2014B·2016·M1809 각 #41/#42)이 재현된다. C:/Users/Administrator/.claude/projects/d--workspace-Vocaflow/c4d62ec5-d73f-4d51-898b-475f87e9be60.jsonl:6787에 실제 전수 SQL, :6792에 평가원4+학평9=13쌍의 과거 응답이 있다. 따라서13건은 근거 없는 숫자는 아니다. 그러나 이는 타 세션의 과거 질의 기록이고, 학평9쌍의 본문 snapshot이 제공되지 않았으므로 **이번 독립 검증에서13쌍 전수 재현·현재 DB13건을 confirmed로 만들지는 않는다**. DB 접속 금지를 지켰고 이 부분은 unclear다. 이 규칙은 같은 시험에 밑줄이 남은 동일 지문 형제가 있어야 탐지하므로 양쪽 모두 잘림·다른 문자 소실·상이한 공백 외 텍스트에는 결손0을 보장하지 않는다.

보고3청크 중 A-01/B-01이 같은2문항을 보고하고 B-02는 없음, A-02는 미수집이다. 고유 실제 결손2·관측된 과잉0은 재확인되나 프롬프트 개선 효과·과잉 보고율의 모집단 추정은 불가능하다.

## 승격 금지·결론·미실행

README는 AI 링크의 진단 입력, 왜곡 유형의 오답 원인 해석, 관측 필드의 근거 사용을 금지한다(D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/README.md:29). 결합 링크 relevance는 전부unknown이고 candidateRelevance·R1 상태만 남는다. D3는 AI_PROPOSED_TWO_TRACK와 출제 의도 가설 주의를 보존한다(D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D3-principles/principle-groups.json:116). 검토한 산출물에서 확정 전이 관계·학생 숙달·확정 출제 원리로 승격한 곳은 확인되지 않았다. 제품 전체 소비 경로 감사나 학생 측정 결과를 확인했다는 뜻은 아니다.

새 P0/P1 없음. 다음 **연구 배치 진행 가능**; R4와 primary의 미확정·원천 결손 기록·후보/가설 제한은 유지한다. DB 복구·새 원문 적재·제품 진단/Gold 승격은 이번 결론에 포함하지 않는다. AC3와13건 독립 전수 재현 등 unclear를 통과로 세지 않았다.

검사 구성은 정적/결속198개+추가 재생성11개 실패0, 재조립4/4, 손 원본17파일 수정 경로 재생, 격리32/32, validate21변형이다. 검증 스크립트 작성 중 구문 오류2회는 수정 후 재실행했으며 실패 실행을 통과 건수에 포함하지 않았다. 중앙 정책의 첫 기본 인코딩 출력은 깨져 UTF-8로 다시 읽었다.

재현 순서: audit.mjs(--experimental-vm-modules) → assembly.mjs → regression.mjs → capture.mjs → provenance.mjs → source-chain.mjs → deep.mjs(--experimental-vm-modules) → supplement.mjs(--experimental-vm-modules) → write-review.mjs. 모두 scripts/research/goal-data/review-b21/ 아래다. 소유자 원문·세션 로그·Git 객체가 없는 환경의 의미/출처 검사는 미실행으로 남겨야 한다. raw 자료는 *.local.json으로만 저장하고 .gitignore로 제외했다.

DB 재조회/쓰기·학평9쌍 본문 전수·제품 build/E2E·학생 측정·Git 명령/커밋/통합·TASK 상태 변경은 미실행이며 PASS가 아니다.
