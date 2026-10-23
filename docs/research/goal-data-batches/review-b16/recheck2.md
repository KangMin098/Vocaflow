# T-0126 · b16 청크 소유권·ID 가림 독립 재검증

**새 P0 0 / P1 2 · b17 보류.** result=pass는 검증 수행 완료다. skip_count=0이며 수용 기준 전체 통과를 뜻하지 않는다.

입력 @d85f22d145fdf284f5b7f4bff0f184bbe9a6eaa6, 비교 b447ccf406dcd264c75e1622bcc44905bf84a1c8..d85f22d145fdf284f5b7f4bff0f184bbe9a6eaa6의 변경 3파일 전체 diff를 정독했다. 첫 task show에서 IN_PROGRESS · session t-0126-codex가 확인되어 대기 재시도는 필요 없었다. PID 조회 없음. 중앙 development_policy를 읽었다. 다른 세션 소유 입력은 읽기만 했고, 실행 소스는 git show로 고정했다. 실제 runner·makeValidator·pilot validateRow/validateChunk를 VM에서 실행했다. 파일 쓰기와 삭제·이름 변경 반례는 메모리 overlay뿐이다. 캡처 296파일은 현재 바이트와 같다.

## 수용 기준

- AC0 **unresolved** — With both input chunks present, the actual full runner rejects both swapped rows: loadTrack accepts 38/40, reports 2 ownership errors, both checkChunk calls report 2 defects, agree produces 228 pairs and excludes both violating IDs. All 16 b2–b16 variants preserve full validate logs/exits. Deleting or renaming both input chunks restores exit0, 40 accepted rows and 240 agree pairs; deleting one accepts one violating row (39 rows/234 pairs) despite exit1. (scripts/research/goal-data/d2-validate.mjs:160; scripts/research/goal-data/d2-validate.mjs:162; scripts/research/goal-data/d2-validate.mjs:182; scripts/research/goal-data/d2-validate.mjs:184; scripts/research/goal-data/d2-run.mjs:107)
- AC1 **unresolved** — Line188 contains zero 0x08 bytes; both boundaries are literal backslash-b. The pinned exam lists contain 630+672 unique item IDs across 14+18 exams; the combined 1302 IDs all match. Requested A-form, M-prefixed, one-digit and punctuation cases match. Previous ordinary free-reason leak is fixed. ASCII-letter/underscore adjacency still leaks known foreign IDs through real reason diagnostics, and malformed JSON in another chunk exposes a foreign ID in the thrown parser error before masking. Unknown ID-shaped text is also masked (conservative overmasking). (scripts/research/goal-data/d2-validate.mjs:188; scripts/research/goal-data/d2-validate.mjs:194; scripts/research/goal-data/d2-validate.mjs:208; scripts/research/goal-data/d2-validate.mjs:216; scripts/csat/data/questions.json:1; scripts/csat/data/mock-questions.json:1)
- AC2 **resolved** — Shipped regression executes 26/26. Its six newest structural checks retain row/chunk stubs; independently reproduce their six claims with complete actual makeValidator and pilot validateRow/validateChunk: own-empty, fourth-member, state-only, swapped-row rejection in loader, both chunk rejections, and free-reason masking. 33 independent assertions pass. Both requested artifacts, new P0/P1 and b17 decision are recorded. (scripts/research/goal-data/d2-validate.check.mjs:84; scripts/research/goal-data/d2-validate.check.mjs:112; docs/research/goal-data-batches/review-b16/recheck2.json:1; scripts/research/goal-data/review-b16/recheck2.mjs:1)

## 확인된 수정과 남은 반례

입력 청크가 있으면 맞바꿈은 두 checkChunk 각각 결함2, loadTrack 결함2·38행, 전체 validate exit1이다. agree는 위반 두 ID를 빼고 228쌍을 만든다. 소유권 위반에서 청크는 누락도 세므로 숫자까지 같아야 하는 것은 아니다. 실제 수용 여부가 일치한다. 이전 일반 자유 서술 노출도 가려졌다. (scripts/research/goal-data/d2-validate.mjs:160; scripts/research/goal-data/d2-validate.mjs:162; scripts/research/goal-data/d2-validate.mjs:198; scripts/research/goal-data/d2-validate.mjs:216)

**RECHECK2-P1-01 — 입력 파일 존재 여부만으로 소유권 검사를 끌 수 있다.** 같은 맞바꿈에서 두 입력 파일을 삭제하거나 이름을 바꾸면 loadTrack 40행·오류0, 전체 validate exit0, agree 240쌍으로 복귀한다. 하나만 삭제해도 위반 행 하나가 수용되어 39행·234쌍이다(전체 validate는 exit1). checkChunk는 입력을 읽지 못해 예외가 나지만 전체 검사·결합을 막지 않는다. 새 배치를 옛 경로와 구분하는 조건이 없으므로 P1이다. 명시적인 신뢰 가능한 legacy 계약으로 예외를 제한하고 새 배치 누락은 실패 처리해야 한다. (scripts/research/goal-data/d2-validate.mjs:182; scripts/research/goal-data/d2-validate.mjs:184; scripts/research/goal-data/d2-run.mjs:107)

**RECHECK2-P1-02 — 단어 경계와 JSON 예외에서 외부 ID가 샌다.** 실제 외부 ID 앞뒤에 영문자를 붙이거나 뒤에 밑줄을 붙인 반복 관측 설명은 실제 행·청크 검사와 runner를 거쳐 그대로 나온다. 다른 청크 출력이 잘못된 JSON이면 JSON.parse가 ID를 포함한 오류를 던지며 최종 가림에 도달하지 않는다. mine에 모인 문자열은 모두 가리지만 모든 출력 경로를 포괄하지 않는다. 알려진 외부 ID를 경계와 무관하게 가리고 파싱 오류를 안전한 진단으로 바꿔야 한다. (scripts/research/goal-data/d2-validate.mjs:188; scripts/research/goal-data/d2-validate.mjs:208; scripts/research/goal-data/d2-validate.mjs:216)

## 바이트·ID 전수·회귀

ITEM_ID의 :188 바이트를 고정 커밋에서 읽어 0x08 **0개**를 확인했다. 양쪽은 실제 역슬래시+b다. 원본 줄·hex는 local 증거에만 있다. questions.json의 14회차 630개와 mock-questions.json의 18회차 672개를 exam+no로 구성해 합계 1,302개 고유 ID 모두 정규식 완전 일치, 누락0이다. 실제 목록에 없는 예시도 별도로 검사했다: A형·M 접두어·한 자리 번호·괄호·인용부호·콜론·경로 인접은 정상이다. ASCII 문자·밑줄 인접은 누락되고, 목록에 없는 가상 ID 꼴도 가려져 보수적 과잉 가림이 있다. 학평 문법은 별도로 존재하지만 이 두 평가원 목록 범위 밖이며 DB 전수라고 주장하지 않는다. (scripts/research/goal-data/d2-validate.mjs:188; scripts/csat/data/questions.json:1; scripts/csat/data/mock-questions.json:1)

제공 회귀 **26/26**, 독립 검사 **33/33**. 제공된 최근 6개 구조 검사는 row/chunk stub을 사용한다. 이 한계를 명시하고 자기 출력 없음·넷째 참여자·상태만 배제·로더 맞바꿈·양쪽 청크 맞바꿈·자유 서술 가림의 여섯 주장을 실제 전체 함수로 별도 재현했다. b2–b16 캡처 16배치 변형 전체 validate 로그·exit는 전후 동일하다. 첫 탐색에서 입력 하나 삭제도 40행일 것이라는 예상은 실제 39행 관측으로 수정했으며, 양쪽 삭제·이름 변경의 완전 우회는 모두 재현됐다.

원문·명령 출력·전체 diff는 *.local.json에만 보존한다. 실행: node --experimental-vm-modules scripts/research/goal-data/review-b16/recheck2.mjs → node scripts/research/goal-data/review-b16/write-recheck2.mjs → node scripts/research/goal-data/review-b16/finish-recheck2.mjs. 입력 worktree의 HEAD 진전과 미커밋 변경은 다른 세션 소유로 보존했다. DB·제품 build/E2E·학습자 측정·원격/main 통합은 미실행이며 통과로 세지 않는다.

**b17 보류 — 새 배치의 입력 청크 누락 우회와 ID 비노출의 경계·예외 경로를 수정하고 독립 재검증해야 한다.**

마무리는 git add/commit 시도 → runtime/t-0126-ev.json 생성 → evidence → submit 순서다. 원출력은 scripts/research/goal-data/review-b16/recheck2-finish.local.json에 보존한다. 커밋 성공 여부는 그 원출력으로 구분하며, 검토 제출은 제품 통합을 뜻하지 않는다.
