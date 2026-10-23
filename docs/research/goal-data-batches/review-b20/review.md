# T-0133 · B20 독립 검증

**다음 배치 보류 — B20-P1-01의 D2 후보 격리 확인 뒤 연구 확대 가능. 새 P0 0 · 새 P1 1.** result=pass는 검증 수행 완료이며 전체 주장 통과가 아니다. skip_count=0.

입력 @00eed70e2b8e6b9195c9b9a6f52f45c1af7f8d33, diff fa9835ed5..00eed70e2의 16파일(전체 diff 3,306줄)을 고정해 코드 변경·문서·생성물 결속과 산술을 대조했다. 입력 워크트리는 읽기만 했고 assemble은 허용 출력 폴더 아래 임시 복사본에서만 실행했다. 최초 task show가 IN_PROGRESS/session t-0133-codex여서 추가 대기는 필요 없었다. PID 조회 명령은 실행하지 않았다. 중앙 development_policy를 UTF-8로 읽고 현재 브랜치를 유지했다. 원문·세션·명령 출력은 *.local.json으로만 보존하고 두 폴더 .gitignore로 제외했다.

## 수용 기준

- AC0 **confirmed** — 23×23 전수 해시 비교와 공유 3쌍 원문 필드 대조. 먼저 판정된 A#24/A#35만 유지, 도표 두 ID 모두 제외. 결합 706, B20 221/240 κ .859972; 지문만 같고 발문이 다르면 별개. (scripts/research/goal-data/review-b20/deep.mjs:5; scripts/research/goal-data/review-b20/deep.mjs:31; D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/d2-export.mjs:104)
- AC1 **refuted** — 양측의 언급 없음→금지 확정 논리는 반박. SOURCE_GAP_ITEMS와 D3 1문항/4오답 격리는 확인. D2 독립 평가 후보 상태는 미해소 P1. 프롬프트 탐지 효과/과잉 보고율은 실험 전 unclear. (D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b20-v24/input.json:4243; D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b20-v24/chunk-A-02.out.json:857; D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b20-v24/chunk-B-02.out.json:845; D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D2-task-mapping/b20-v24-agreement.json:599; D:/workspace/Vocaflow/scripts/csat/data/columns2/M1809.txt:299; D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/d3-build.mjs:28)
- AC2 **confirmed** — 4/4 임시 복사 재조립 바이트 동일, 최초 대비 9/80행 설명만 변경; 40 선정·해시·221/240·κ .859972·primary37/40·경보 없음; b2–b20 및 두 b9t 변형 validate 결함0, 격리32/32, 실행기8980aaa59 동일. (scripts/research/goal-data/review-b20/assembly.mjs:8; scripts/research/goal-data/review-b20/supplement.mjs:13; scripts/research/goal-data/review-b20/audit.mjs:45; scripts/research/goal-data/review-b20/regression.mjs:13; scripts/research/goal-data/review-b20/supplement.mjs:11)
- AC3 **unclear** — 후보10·갈림10 합집합18과 추가 M1809#26을 대조 완료. 정답 지지와 TASK Gold는 구별. 주 TASK 갈림3·direct/indirect·독립 적격은 사람 Gold 없이 미확정. (scripts/research/goal-data/review-b20/row-review.md:1; D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D2-task-mapping/CONTRACT_V2_4.md:33)
- AC4 **confirmed** — 새 P0 0/P1 1. D2 후보 격리 확인 전 다음 배치 보류. 프롬프트 개정 권고와 미확정 범위를 기록. (docs/research/goal-data-batches/review-b20/review.md:1; docs/research/goal-data-batches/review-b20/verdict.json:1)

## 분모 전수 대조

D1 source-inventory의 2014A 23·2014B 23개 정규화 지문 해시를 529쌍 비교했다. 일치 지문은 A#24=B#23 · A#32=B#29 · A#35=B#31 세 쌍뿐이다. 모든 동일 지문 후보를 b19/b20 input.rows 및 excluded_raw의 원문으로 다시 읽어 발문·지문·선지·answer·answers를 비교했으며 셋 다 완전 동일했다(scripts/research/goal-data/review-b20/deep.mjs:5). 나머지 526쌍의 정규화 지문 해시가 다르므로 완전 동일 문항이 추가로 숨어 있을 수는 없다(해시 충돌 제외). 이는 봉인된 D1 snapshot의 전수 비교이며 현재 DB 전수 재조회라는 주장은 하지 않는다. D1 passage hash는 공백·대소문자 정규화이고 입력 passage hash는 원바이트라 서로 직접 비교하지 않았다.

A#35는 3점/B#31은 2점이라 전체 source hash는 다르다. points를 제외한 명시적 동일 문항 키를 써야 이 쌍을 놓치지 않는다(D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/d2-export.mjs:104). A#24/A#35는 b19에서 먼저 판정됐고 결합본에 각각1회, B#23/#31은0회다. 도표 A#32/B#29는 둘 다 판정 제외이므로 분모0회다. 실제 b20에서 B#29 사유는 도표가 먼저 남는다. 지문만 같고 발문이 다르면 서로 다른 문항으로 유지하며, 같은 지문이라는 사실은 독립 노출/평가 적격의 별도 제한이다. A/B 간 그런 부분 동일 추가 쌍은0이며, 같은 지문+다른 발문의 합성 사례로 키가 달라짐을 확인했다.

중복 규칙 적용 뒤 결합 고유 문항706·28시험·R1 1,610·갈림563, B20 40문항·240쌍 중221일치(.9208333333)·κ .859972363이다. b19+b20 80문항/480쌍은445일치(.9270833333)·κ .8700766393. 모든 결합 계약의 보류되지 않은 원자 TASK를 실제 A/B 원판정에서 풀링하면5,106/5,676(.8995771670)·κ .8070255323이다. 계약·TASK 구성이 다르므로 이 풀링 κ를 v2.4 안정성이나 타당도의 근거로 대체하지 않는다. pilot 통합 TASK 108쌍은 제외했으며, b3로 대체된 이전 삽입은 현재 D3 문항 목록과 동일하게 제외했다. 제3 판정·사후 설명 수정을 독립 A/B 일치로 소급하지 않았다.

## 재조립·최초 snapshot·회귀

네 손 원본 assemble을 읽었다. A01은 세 원본을 병합해 hash/status를 붙이고, A02/B02는 입력 순서로 정렬하고 hash/status를 붙이며, B01은 추가로 TASK 표시코드를 ID로 변환한다. 새 판정 생성·고정 우선순위 primary 선택은 없다. 실제 임시 재조립4/4 모두 최종본과 바이트 동일(scripts/research/goal-data/review-b20/assembly.mjs:8). 소유자 절대 경로가 남으면 실행을 거부하며 입력 폴더에서 assemble을 돌리지 않았다.

각 청크 자신의 최초 snapshot을 최종과 비교했다. 80행 중9행 설명 변경·71행 불변이다. A01 0, A02 M1809#32 오답 설명1, B01 2014B#35/#36/#42의 not_observable 설명3, B02 M1809#18/#20/#26/#31/#32 오답 설명5. primary·links·source hash 변경0. 중복 tool-use 기록은 id로 한 번만 셌다. 관측 세션의 Edit는 손 원본을 향하며 출력 직접 Write/Edit는0이다. 실제 첫 prompt 네 개는 보존본과 같고 template·chunk·prompt hash·전문 치환 재현이 맞는다. A01/A02에는 다른 파일명 목록 노출이 있었으며 B01 sources 목록 시도는 디렉터리 부재 오류, B02 목록은 자기 빈 폴더다. B01/A02의 큰 출력 재열람은 자기 입력 tool-results다. 금지 판정 내용 열람은 관측되지 않았고 절대 미접근은 unclear다(scripts/research/goal-data/review-b20/provenance.mjs:4).

선정은2014B20+M1809 20, 제외9(없는 문항5·동일 문항2·도표2). 선정·원문·지문·input·계약·청크·prompt·history 해시가 맞고 새 D2 생성물4개를 메모리에서 바이트 재현했다. 주 TASK37/40·R4 κ .786096(35/40)·경보 없음. b2–b20와 b9t 두 계약의20개 로컬 변형 validate 결함0, 실제 격리 회귀32/32 통과, d2-run/d2-validate/d2-validate.check는8980aaa59와 동일했다. 이 회귀는 실행기 계약 검사이며 원천 완전성 탐지를 검증한 것은 아니다.

JSONL 추가분은 R1 82·갈림19·D3 문항40/오답160. 기존 JSONL 삭제/변경0. D3 전 필드 결속·전체 유형별 집계·coverage를 재계산했다. D3 주 TASK614/706·왜곡2,044/2,824, source_text 왜곡2,019/2,796(.722103)이다. 확인된 결손7문항=도표5+2014A#29+M1809#26. 생성물과 문서 수치의 정합성을 원천 타당도로 확대하지 않는다.

## M1809#26 — 두 트랙이 같은 잘림을 놓쳤다

정답③은 현금 기부를 받는다는 진술이다. 원문 추출 텍스트 D:/workspace/Vocaflow/scripts/csat/data/columns2/M1809.txt:299에는 이를 명시적으로 금지하는 각주가 있다. 입력(D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b20-v24/input.json:4243)은 body_ok=true인데 이 줄이 통째로 없다. 원문 block을 같은 passageOf 기본값으로 통과시키면 저장 입력의 누락을 재현하며, keepEnglishNotes:true에서 각주가 살아난다(scripts/research/goal-data/review-b20/deep.mjs:40). 비교 정규화는 공백 및 별표 주변 공백뿐이다. 영어 문장 각주를 학평 안내문에만 보존하는 build-corpus의 분기와 별표 줄 제거가 원인 경로다(D:/workspace/Vocaflow/scripts/csat/build-corpus.mjs:124; D:/workspace/Vocaflow/scripts/csat/lib-passage.mjs:254).

A는 품목 목록과 중고 물품이라는 표현에서 현금 부재를 확인해 불일치로 확정하고, B도 대응 표현이 없다는 점을 E2가 결정이라는 이유로 썼다(D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b20-v24/chunk-A-02.out.json:857; D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b20-v24/chunk-B-02.out.json:845). 그러나 미언급은 금지를 함의하지 않는다. 품목 목록의 닫힌 범위를 가정해 정답을 추측하거나 나머지 네 선지가 지지돼 소거로 답을 맞힐 수는 있어도, 그것이 빠진 금지 각주의 근거를 복원하지는 않는다. 명시적 금지와 목록 미언급은 다른 판단 과제다. 두 트랙의 정답 일치·E2 합의는 원천 결손 탐지 성공이 아니다. v2.4의 안내문 E2 고정 규칙도 완전한 지문 위에서만 적용해야 한다.

SOURCE_GAP_ITEMS 격리는 타당하다(D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/d3-build.mjs:28). D3의 해당 문항1·오답4는 모두 source_gap:footnote_dropped이고 source_text 집계에서 빠진다. 원장 B20 κ .860은 역사적 독립 판정의 일치로 보존할 수 있으나 적격 수치와 혼동하면 안 된다. 이 결손을 제외한 B20 39문항은215/234(.9188034188)·κ .8561165049이며, 전체 확인 결손7개를 뺀 결합의 원자 쌍은5,034/5,598·κ .8065790656이다. 후자도 이질 계약 풀링 참고값이다.

**B20-P1-01: D3 격리가 D2 독립 후보 표시까지 전파되지 않았다.** D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D2-task-mapping/b20-v24-agreement.json:599의 use는 independent_check_candidate, 양측 independent_assessment는 candidate_if_unexposed다. D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/d2-run.mjs:144는 두 eligibility만으로 이 후보를 만든다. 원판정을 기록으로 보존하는 것과 지금 써도 되는 후보라고 표시하는 것은 다르다. R1·갈림 원장을 지우거나 역사적 일치를 바꿀 필요는 없지만 후보 산출/소비에서는 item_id+source hash 결손 상태를 우선 적용해야 한다. 실제 제품 진단 소비나 학습자 노출을 확인한 것은 아니므로 그 누출을 확정하지 않는다. 해소는 D2 후보 격리 재현이며, DB 복구·새 hash 판정은 별도 승인 범위다. 입력은 고치지 않았다.

## 같은 실패를 다른 배치에서 찾는 방법과 프롬프트

배치 입력·판정을 전부 순회해 안내문/내용 일치/장문 일치의 정답 논리와 primary 이유에서 미언급·부재 신호를 추출했다. 원문으로 본 후보는 M1809#26 양측과2024#45 A다. 후자는 정답 근거의 명시적 부상·꿈 포기 진술이 있어 오탐이며, 서로 다른 설명 필드를 이어 붙인 정규식이 문장 경계를 넘어 매치한 경우다. 따라서 신호를 자동 source_gap 확정으로 쓰면 안 된다. 오답 설명에 미언급이 있다는 것만으로도 결손은 아니다. 다른 배치에서 이번 좁은 신호로 확정된 추가 결손은0이며 전체 결손0이라는 주장은 하지 않는다(scripts/research/goal-data/review-b20/deep.mjs:50).

더 직접적인 검사는 columns/columns2 원문의 별표 영어 문장을 추출 결과와 대조하는 것이다. 두 폴더의 대문자 시작·5단어 이상·한글 어휘 풀이 제외 신호는3줄이며2014A 두 추출본의 같은 각주와 M1809 한 줄, 고유 문항2개다. 이전 기록의2줄은 columns의2014A와 columns2의M1809를 센 고유 사건 요약이고, 두 폴더 전체 줄 수로는3이다. 같은 문항의 두 추출본을 독립 결손2개로 세지 않는다. 각주가 텍스트에 애초에 없거나 소문자/짧은 문장이면 이 규칙도 놓친다. 전량 파서 전후 비교와 문항별 정답 entailment·반박 사슬 검토를 함께 해야 한다.

프롬프트에 단순히 정답 근거가 없으면 원천 결손이라고 쓰는 것은 결손 의심을 드러내는 데 도움이 될 수 있지만 효과 크기는 실험 전 unclear다. 추론·요지·정상 불일치 오답·삽입의 주어진 문장·도표 등은 정답 문구가 그대로 없을 수 있고, 한 문장 인용만 강제하면 정상 문항을 과잉 보고한다. 참/거짓 판단에 필요한 명시 근거 또는 허용된 추론 사슬을 요청하고, 근거 부족 상태를 원천 결손 확정과 분리해야 한다. 정상 명시 불일치·실제 결손·정상 결합 추론·정상 미언급 오답·삽입 경계를 대조군으로 둔 새 독립 표본이 필요하며 이번에 탐지율 개선을 측정했다고 보고하지 않는다.

**프롬프트 개정 권고 한 줄:** 정답이 요구하는 참/거짓을 지지·반박하는 명시 근거나 허용된 추론 사슬을 먼저 확인하고, 단순 미언급만으로 불일치를 확정하지 말며 근거가 부족하면 source_gap_suspected와 누락 의심 위치를 보고하되 원본 대조 전 결손 확정·자동 제외하지 않는다.

## 표본과 불확실성

scripts/research/goal-data/review-b20/row-review.md:1에 후보10·갈림10 합집합18문항을 원문과 양측 판정으로 대조했다. 주 TASK 갈림2014B#34(R5/R6)·M1809#27(E2/E3)·M1809#33(R5/E2) 세 개가 갈림10 안에 모두 포함된다. 추가 M1809#26도 검토했다. 텍스트에서 정답이 지지되는 것과 TASK 의미·독립 평가·직접 관측을 확정하는 것은 다르다. 특히 지시어 세부 빈칸에 중심문장 R5 규칙을 적용할지, 어법/어휘에서 부분집합 E1을 독립 관측으로 볼지 unclear를 유지한다. 사람 Gold·학생 측정·NeedRank 승인은 없다.

## 검증·마무리

고유 정적/결속 검사579개 실패0, 임시 바이트 재조립4/4, 격리 회귀32/32, 로컬20변형 validate·529쌍 전수·원문 표본18+결손1 검토를 수행했다. 최초 PowerShell 정책 JSON 읽기는 기본 인코딩으로 실패해 UTF-8 Node로 다시 읽었고, rg 미설치로 파일 목록 조회를 대체했다. 풀링 검사 첫 실행은 옛 배치 input.tasks가 null인 것을 발견해 실제 link task로 수정했고, pilot 통합 TASK108쌍을 뺀 원자 분모5,676으로 coverage를 대조했다. 실패한 실행을 통과로 세지 않았다.

재현: node --experimental-vm-modules scripts/research/goal-data/review-b20/audit.mjs → node scripts/research/goal-data/review-b20/assembly.mjs → node scripts/research/goal-data/review-b20/regression.mjs → node --experimental-vm-modules scripts/research/goal-data/review-b20/supplement.mjs → node --experimental-vm-modules scripts/research/goal-data/review-b20/verify-diff.mjs → node --experimental-vm-modules scripts/research/goal-data/review-b20/deep.mjs → node scripts/research/goal-data/review-b20/capture.mjs → node scripts/research/goal-data/review-b20/provenance.mjs → node scripts/research/goal-data/review-b20/write-review.mjs. 원문·로컬 세션이 없는 환경에서는 의미·관측 검증을 완결할 수 없다.

DB 조회/쓰기·제품 build/E2E·main/원격 통합은 미실행이고 통과로 세지 않는다. 검토 TASK의 명시된 마무리인 자기 경로 git add/commit 시도 → runtime evidence(type review/result pass/skip0/covers0–4) → task evidence → submit까지 실행하며 원문 출력/오류는 finish.local.json에 보존한다.
