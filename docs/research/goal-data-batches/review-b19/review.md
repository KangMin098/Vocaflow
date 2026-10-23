# T-0132 · B19 독립 검증

**다음 배치 보류 — B19-P1-01 결손 전파·집계 격리 확인 후 v2.4 연구 후보 확대 가능. 새 P0 0 · 새 P1 1.** result=pass는 검증 수행 완료이며 전체 주장 통과가 아니다. skip_count=0.

고정 입력 @aa851c2772d84fec4436cb96e60cd1c96bbb7e25, diff 98ba78332..aa851c277의 16파일을 캡처하고 변경 문서·코드·JSON/JSONL을 구조화해 대조했다. 입력 워크트리는 읽기만 했다. 최초 task show가 IN_PROGRESS/session t-0132-codex여서 추가 대기는 없었으며 PID 조회는 하지 않았다. 중앙 development_policy를 읽고 기존 브랜치를 유지했다. 원문·diff·세션·명령 출력은 두 허용 폴더의 *.local.json에만 저장하며 .gitignore로 제외한다.

## 수용 기준

- AC0 **confirmed** — B19 네 청크·B18 A01 손 원본 재조립과 최종 출력 바이트 일치; 관측 기록에서 출력 직접 수정 0 (scripts/research/goal-data/review-b19/assembly.mjs:10; scripts/research/goal-data/review-b19/provenance.mjs:6; scripts/research/goal-data/review-b19/row-review.md:1) 최초 snapshot 이전 변경은 원세션 Write/Edit로 확인; 관측 밖 동작 부재는 절대 증명하지 않음
- AC1 **confirmed** — 40 선정·해시·224/240·kappa .880273·primary37/40·R4 .692982·경보·b2–b19 회귀·실행기·프롬프트 재계산 (scripts/research/goal-data/review-b19/audit.mjs:45; scripts/research/goal-data/review-b19/supplement.mjs:5; scripts/research/goal-data/review-b19/verify-diff.mjs:9; scripts/research/goal-data/review-b19/regression.mjs:8; scripts/research/goal-data/review-b19/provenance.mjs:6) 금지 내용 노출은 관측되지 않음; 절대 미접근은 unclear
- AC2 **refuted** — 원천 결손·not_suitable 타당은 confirmed이나 진단/원천 근거 제외가 모든 생성물에 전파됐다는 주장은 refuted (D:/workspace/Vocaflow-main-serving/scripts/csat/lib-passage.mjs:254; D:/workspace/Vocaflow-main-serving/scripts/csat/build-corpus.mjs:124; D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/d1-source-audit.mjs:61; D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/d3-build.mjs:55; D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D3-principles/distractor-logic.jsonl:2639; scripts/research/goal-data/review-b19/detect-source-gap.sql:1) 라이브 DB 상태·제품 진단 소비 경로는 DB 접근 없이 unclear. Claude 추가 조회 필요: detect-source-gap.sql
- AC3 **unclear** — 후보10·갈림10·primary갈림3 합집합22 원문 대조 완료; 의미·primary Gold는 미확정 (scripts/research/goal-data/review-b19/row-review.md:1; D:/workspace/Vocaflow-goal-data/docs/research/goal-data-batches/D2-task-mapping/CONTRACT_V2_4.md:31)
- AC4 **confirmed** — verdict/review·새 P0/P1·다음 배치 가부·unclear 기록 (docs/research/goal-data-batches/review-b19/review.md:1; docs/research/goal-data-batches/review-b19/verdict.json:1)

## 재조립·최초/최종·노출

B19 A01/A02/B01/B02 각20행과 B18 A01 20행 모두 임시 복사본에서 실제 Node assemble 실행 후 최종본과 바이트 일치했다. B19 코드는 경로 변경 없이 실행했고, B18의 소유자 출력 경로 상수만 임시 복사본 경로로 바꿨다(assembly.mjs:17). 실행 전 소유자 경로 잔존을 거부한다. 조립은 손 판정의 순서 정렬·메타데이터 결속·JSON 직렬화뿐이며 새 판정 생성·우선순위 선택이 없다. B18-P1-01 원본 동기화는 재현 관점에서 해소됐다. B18 2017#42의 사후 R6 변경이 독립 일치35/40을 소급 변경하지 않는다는 문서 경계도 유지된다.

최초 snapshot→최종은 80행 중8행 변경·72행 불변이다. A01 0; A02 2015#43 not_observable 중복1 + 2014A#34/#35 오답 설명2; B01 2015#37 인용1; B02 2014A#23/#26/#34/#35 오답 설명4. primary·links·source hash 변경0. A01 최초 출력 전 관측 중복1은 손 원본 수정이며 최초본과 최종본이 같다. 원세션 Edit의 대상은 손 원본이고 재조립 뒤 최종 출력과 일치한다. B02 Python 시도는 실행 실패했으며 이후 문항별 Edit로 고쳤다. 동일 tool-use 중복 기록은 한 번만 센다. 관측된 출력 직접 Edit/Write는 0이다(provenance.mjs:6).

네 실제 첫 prompt는 보존본과 같고 manifest·청크·템플릿 해시 및 전문 치환 재현이 맞는다. 자기 청크 validate 출력에 외부 문항 ID0. 금지 내용 열람은 관측되지 않았고 절대 미접근은 unclear다. 파일명 목록 노출은 **A01과 B02 두 곳**이다(상위 mapping-review의 A01만 기재한 노출 요약은 불완전). B02 큰 출력 재열람은 자기 입력의 tool-results 파일, A02는 자기 원문 scratchpad다. A02 sources 디렉터리 목록 시도는 디렉터리 부재 오류다. 이 이름 노출을 다른 판정 내용 열람으로 확대하지 않는다.

## 재계산·diff

2015 27+2014A 13=40, 제외7, 과거 선정 중복0. source·passage·selection·input·계약·청크·prompt·history 해시 일치. D2 새 생성물4개를 바이트 재현했다. 전체224/240=.9333333333, κ=.8802731269, primary37/40. R5 κ .868421, R6 1, E1 .951807, E3 1, R4 .692982, E2 .795292. R4 일치 .825라 현 조건 일치<.80 AND κ<.68의 중단 경보 없음. 수치 경보 부재와 새 P1에 따른 다음 배치 보류는 별개다.

b2–b19 및 b9t 두 계약의19개 로컬 배치 validate 결함0; 실행기·검증기·제공 회귀 소스는 8980aaa59와 동일, 실제 격리 회귀32/32 통과. JSONL은 append-only, 기존행 삭제/변경0. 신규 R1 82·갈림16·D3 40/160, 누적666문항·26시험·R1 1528·갈림544. D3 primary577/666·왜곡1913/2664. 신규 reasoning40·오답160의 원판정 결속과 전 유형 group·coverage 필드를 재계산했다. 코드 diff는 b19 선정 등록·D3 배치 목록 추가이고 prompt는 손 원본 보존·원본 수정 후 재조립 조항이다. README/mapping의 산술은 맞지만 원천 완전성의 증명은 아니다.

## 원천 결손·D1 body_ok 맹점

2014A#29 입력은 body_ok=true·지문561자다(local/b19-v24/input.json:5147). 양측에서 휴관 조건의 앞줄이 없고 끝의 단어만 남았으며, 두 판정 모두 not_suitable로 처리한 것은 타당하다. 정답⑤의 주차 할인은 남은 본문에서 지지되지만 ③을 원문으로 완전히 배제할 수 없다. 따라서 정답을 맞힐 수 있다는 이유로 독립 진단 적격으로 승격하면 안 된다. 손 판정·최초 snapshot에도 결손 인식이 있어 검증자가 새로 만든 판정이 아니다.

main-serving scripts/csat/data/columns2/2014A.txt:277에는 영어 운영 조건 각주가 온전하고 다음 줄:278에 끝 단어가 있다. build-corpus.mjs:124가 영어 각주 보존을 hakpyeong 안내문에만 켜므로 수능 A형에서는 꺼진다. lib-passage.mjs:254–257은 별표 앞줄을 버리고 별표 없는 다음 줄은 남긴다. 저장 입력의 결손을 같은 파서로 재현했다(공백 및 별표 주위 공백만 정규화). keepEnglishNotes:true를 준 읽기 전용 비교에서는 운영 조건 앞줄이 살아난다. 이 결과는 로컬 추출본 기준이며 공식 PDF 원본에 대한 승인 복구를 대신하지 않는다.

build-corpus.mjs:179의 suspectBody는 한글·단독 마침표·한 글자 토막·유형별 기호·기능어 꼬리 등만 보며 내부의 정상 단어+마침표는 놓친다. 실제 해당 함수를 격리 평가하면 false다. 번호별 절반 길이 가드(:388)는 작은 내부 각주 유실을 보장 탐지하지 못한다. 특히 :368 주석은 이 문항을 0.6 기준의 오탐 예로 적어 현재 결손 확인과 충돌한다. D1(d1-source-audit.mjs:61/:63/:133)은 저장 body_ok·50자 문턱을 신뢰하고 각주/연속 줄/문장 경계를 비교하지 않는다. 본문이 충분히 길다는 사실과 완전하다는 판정이 섞인 경로다. DB의 최신 상태를 조회한 것으로 주장하지 않는다.

동일 좁은 꼴(문장부호 뒤 소문자2–20자 한 단어+마침표+대문자 시작)을 보존된 배치 입력의 고유630문항 전부에서 검사해 **2014A#29 한 건**만 찾았다(defect.mjs:10). 모든 원천 결손이 한 건이라는 뜻이 아니다. 각주 줄 전체와 이어지는 줄을 추적하는 추출 단계 비교가 가장 직접적이고, 길이·기능어 끝·종결부호 부재는 보조 신호다. 약어·항목명·서명 등 오탐을 수동 확인한 뒤 격리해야 한다. 새 규칙의 전 DB 정확도·재현율은 unclear다.

**Claude 추가 조회 필요: scripts/research/goal-data/review-b19/detect-source-gap.sql** — to_regclass 확인 후 body_ok=true 중 좁은 고아 단어·번호별 길이·기능어 꼬리·문장 종결 신호를 별도 열로 조회한다. SELECT만 제안했고 DB 접근·수정은 하지 않았다. 원문 복구 SQL은 PDF 해시·before/after·승인 범위를 갖춘 별도 패키지가 필요하다.

## 새 P1 · 근거 제외의 경계

**B19-P1-01 — D3가 확인된 원천 결손을 source_text로 집계한다.** d3-build.mjs:26/:55는 도표만 source_gap으로 분류하고 :59/:73은 나머지를 source_text로 쓴다. 결과 docs/research/goal-data-batches/D3-principles/item-reasoning.jsonl:660, docs/research/goal-data-batches/D3-principles/distractor-logic.jsonl:2639에서 결손을 명시한 ③까지 source_text다. :84/:100/:101의 원천 근거 집계에도 포함된다. 독립 평가 부적격 처리는 agreement에 반영되지만 이 파생 경로까지 원천 근거 제외가 전파됐다는 주장은 refuted다.

영향은 이 문항1·오답4이며 일치 오답3이다. 문항 전체를 결손으로 격리하면 source_text 오답2644→2640, 그 중 일치1895→1892이고, 보존 원장666문항/2664오답은 그대로 둘 수 있다. 이 변경을 입력에 적용하지 않았다. D2 R1에는 E3/E2 링크2행이 남아 있으나 relevance=unknown·관측false이고 진단 적격 필드가 없다(docs/research/goal-data-batches/D2-task-mapping/b19-v24-item-task-links.jsonl:66). 링크 보존 자체를 제품 진단 누출로 단정하지 않는다. 실제 제품 소비 경로는 unclear다.

해소 조건: 소유자가 확인된 원천 결손을 UUID/source hash에 결속하고 생성·집계에서 격리한 뒤 재생성 검증한다. not_suitable 전체를 source_gap으로 치환하면 정상 삽입·어법까지 결손으로 오분류되므로 별도 원천 상태가 필요하다. DB 복구는 승인 후 별개다. 본 검증은 입력 읽기 전용이므로 결함을 고쳤다고 보고하지 않는다.

## 표본·남은 불확실성

row-review.md의 후보10·갈림10·primary갈림3 합집합22문항을 원문과 양측 판정으로 대조했다. 2015#19의 기쁨 답은 지지되지만 정서를 R5 압축으로 볼지 범위 밖 대응으로 볼지 계약이 정하지 않아 R5/null을 유지한다. 2015#26·2014A#29의 E2/E3 우선순위도 미확정이다. R4·E2의 indirect/direct/n.a. 갈림을 관측 일치 상승으로 덮지 않는다. 사람 Gold·학생 측정·NeedRank 승인은 없다.

## 검증·마무리

정적/결속 검사531개와 별도 보충49개 실패0, 실제 격리 회귀32/32, 재조립5/5,630문항 탐지 재현 및 관측 provenance 확인을 수행했다. 알려진 D3 결함은 발견사항으로 남아 있다. 첫 Git 조회는 안전 디렉터리 인식 오류 뒤 명령 단위 safe.directory로 읽기를 수행했고, 첫 파서 비교는 별표 공백 차이를 명시적으로 정규화해 재검증했다. 최종본과 정규화 기준을 숨기지 않는다.

재현: node --experimental-vm-modules scripts/research/goal-data/review-b19/audit.mjs → node scripts/research/goal-data/review-b19/regression.mjs → node scripts/research/goal-data/review-b19/assembly.mjs → node --experimental-vm-modules scripts/research/goal-data/review-b19/supplement.mjs → node --experimental-vm-modules scripts/research/goal-data/review-b19/verify-diff.mjs → node scripts/research/goal-data/review-b19/capture.mjs → node scripts/research/goal-data/review-b19/provenance.mjs → node scripts/research/goal-data/review-b19/defect.mjs → node scripts/research/goal-data/review-b19/write-review.mjs. 로컬 원본/세션이 없는 환경은 의미·노출 검증을 완결할 수 없다.

DB 접근·쓰기, 제품 build/E2E, main·원격 통합은 미실행이며 통과로 세지 않는다. 요청한 순서대로 Git add/commit 시도 후 runtime evidence 등록·task submit을 실행한다. 실제 명령 출력과 오류는 finish.local.json에 보존한다.
