// scripts/research/goal-data/review-b19/write-review.mjs
import fs from 'node:fs'
const out='scripts/research/goal-data/review-b19/',doc='docs/research/goal-data-batches/review-b19/',root='D:/workspace/Vocaflow-goal-data/',a=JSON.parse(fs.readFileSync(out+'audit.local.json')),s=JSON.parse(fs.readFileSync(out+'supplement.local.json')),x=JSON.parse(fs.readFileSync(out+'extra.local.json')),de=JSON.parse(fs.readFileSync(out+'defect.local.json')),as=JSON.parse(fs.readFileSync(out+'assembly.local.json')),pr=JSON.parse(fs.readFileSync(out+'provenance.local.json'))
const locate=(p,needle)=>p+':'+(fs.readFileSync(root+p,'utf8').split('\n').findIndex(l=>l.includes(needle))+1)
const d3='docs/research/goal-data-batches/D3-principles/',refs={reasoning:locate(d3+'item-reasoning.jsonl','"item_id":"2014A#29"'),distractor:locate(d3+'distractor-logic.jsonl','"item_id":"2014A#29","type_id":"R-NOTICE","choice":3'),links:locate('docs/research/goal-data-batches/D2-task-mapping/b19-v24-item-task-links.jsonl','"item":"2014A#29"')}
const notes={
 '2015#38':'confirmed: 결과→방법→개화 기제의 배열에서 ③ 삽입이 지지된다. R4는 삽입 공동 수행의 교수·묶음 관찰로만 보존하고 개별 진단은 제외한다.',
 '2015#39':'confirmed: 추가 평정은 가짜 외향인 측정 뒤·실제 집단 비교 앞인 ②다. 두 트랙 not_suitable 처리는 타당하며 R4 개별 관찰 Gold가 아니다.',
 '2014A#27':'confirmed: 작동을 멈춘다는 문맥의 stop 목적어 형태가 ④ 오류다. E1 부정 요구 링크는 지지하되 주 어법 수행은 범위 밖이라 독립 평가 부적격을 유지한다.',
 '2014A#30':'confirmed: 잡지와 뉴스레터의 주기 속성을 바꾼 ③ 불일치다. E1 부정 요구와 E3 대응은 지지하지만 단일 응답으로 E1만 분리 측정되지는 않는다.',
 '2014A#31':'confirmed: 최종 결과 통보 수단을 바꾼 ⑤ 불일치다. E1 후보 링크와 E3 중심 해석을 지지하며 표본의 INDEPENDENTLY_CHECKED는 의미 Gold가 아니다.',
 '2014A#36':'confirmed: 일반 진술의 예시와 집단 간 대조 관계로 ②다. E1은 두 빈칸을 모두 처리한다는 indirect 후보이고 실제 결정 R2는 범위 밖이다.',
 '2015#24':'confirmed: 여행 수단을 바꾼 ③ 불일치다. E1 부정 요구·E3 대응 후보를 지지하되 개별 E1 관찰 분리의 증거는 없다.',
 '2015#27':'confirmed: 신청서 제출 수단을 바꾼 ④ 불일치다. E1·E3 링크를 지지하고 실제 근거 선택과 대조 수행의 독립 측정은 미확정이다.',
 '2015#28':'confirmed: 분사 위치에 주절의 정동사가 필요해 ③ 오류다. E1 부정 요구는 명시적이나 범위 밖 구문 수행 때문에 not_suitable 유지.',
 '2015#29':'confirmed: 감사 발화의 화자가 딸인 ④만 다른 지칭이다. E1 예외 요구는 지지하지만 지칭 수행은 범위 밖이며 not_suitable 유지.',
 '2014A#28':'unclear: 세 낱말쌍의 답은 ③으로 지지된다. A의 E1 indirect 반사실은 B·C만 확인하면 ①이 남는 실제 경로다. B는 표준 발문이라 n.a.로 본다. 복수 빈칸 조건의 E1 범위를 사후 확정하지 않는다.',
 '2014A#25':'unclear: 압박 아래 휴식의 필요성 ⑤와 양측 R5는 지지된다. B의 R4는 도입의 게임 사례를 중심으로 오인하는 경로이고 A는 단일 처방 문장으로 충분하다고 본다. 배열 오인과 중심 오인의 분리 기준은 미확정.',
 '2014A#33':'unclear: 지배자 시선의 자유 ③과 R5는 지지된다. B의 R4는 하위자의 의무를 지배자 속성으로 전이하는 ⑤ 경로다. 대조 배열과 지칭/중심 오인의 독립성은 미확정.',
 '2014A#34':'unclear: 비유와 즐거움 감소를 결합한 ① 및 R6는 지지된다. B의 R5 indirect→⑤는 과학 화제만 남기는 경로여서 추가 오독이 필요하다. A n.a.와의 우열은 Gold로 확정하지 않는다.',
 '2015#18':'unclear: 결론의 회복 능력 ⑤와 R5는 지지된다. A의 R4→①은 도입 기업·전문가를 주제로 오인하는 경로이며 B는 결론 한 문장으로 충분하다고 본다. 배열 수행의 별도 필요성은 미확정.',
 '2015#19':'unclear: 승진 제안·감탄·꿈 실현의 정서가 기쁨 ①을 지지한다. 양측 모두 R6를 새 추론으로 세지 않는다. A R5는 정서의 압축, B null은 정서 어휘 대응으로 본다. v2.3 §6은 R5 대 범위 밖 경계를 정하지 않으므로 primary 갈림을 유지한다.',
 '2015#31':'unclear: 빠른 번갈아 처리가 동시성 착각을 만든다는 ② 및 R6는 지지된다. A의 E2 경쟁 근거는 동시 수행으로 해석된 문장→④로 구체적이나 B는 여러 문장 결합에 포함된 오해 해소로 본다. E2 direct/n.a.는 미확정.',
 '2015#32':'unclear: 지식 진보와 사회 적용을 혼동하지 말라는 ① 및 R5는 지지된다. A는 앞 기대를 근거로 잡는 ③, B는 사회적 기대 문장을 잡는 ④ 반사실을 쓴다. 내용 선택과 위치 탐색의 필요성 경계가 달라 E2 direct/indirect 유지.',
 '2015#33':'unclear: 인구 크기만으로 불충분하고 통제 완화·상업 조건을 결합한 ⑤ 및 R6는 지지된다. B R4→④는 도입 크기 증가를 작은 공동체 생존으로 다시 오인해야 하므로 설명이 약하다. R5 반사실과 R4 분리 여부는 미확정.',
 '2015#35':'unclear: 자동차 기술의 반응·비용 논지에서 태양 에너지 문장 ②가 이탈한다. A R4는 후반 대명사·비용 연결을 놓쳐 ④로 가는 경로, B는 한 문장 기능 R3로 본다. E1 primary 일치와 R4 갈림을 구분한다.',
 '2015#26':'unclear: 음료 포함 ⑤는 양측 같은 근거이며 할인 범위·환불·시간대 오답 대조도 타당하다. A E2 위치 탐색 대 B E3 대응의 primary 우선순위는 §4 결정 대기 범위를 유지한다.',
 '2014A#29':'confirmed: 결손 입력으로도 주차 할인 정답 ⑤는 지지되나 ③ 휴관 주기를 완전히 검증할 수 없다. 양측 not_suitable은 타당하다. E3/E2 primary는 결손 연구 사례로만 보존하며 D3 source_text 표시는 refuted(B19-P1-01).'
}
fs.writeFileSync(out+'row-review.md','# B19 원문 표본 대조\n\n후보10·갈림10·primary갈림3의 합집합 22문항이다. 아래 confirmed는 국소 판정 근거를 지지한다는 뜻이며 사람 Gold·개별 진단 타당도 승인이 아니다. 입력 파일은 소유자 워크트리의 읽기 전용 로컬 파일이다.\n\n'+a.dossier.map(d=>'## '+d.id+'\n\n'+notes[d.id]+'\n\n근거: '+d.evidence.map(p=>'D:/workspace/Vocaflow-goal-data/'+p).join(' · ')+'\n').join('\n'))
const acceptance=[
 {index:0,status:'confirmed',claim:'B19 네 청크·B18 A01 손 원본 재조립과 최종 출력 바이트 일치; 관측 기록에서 출력 직접 수정 0',evidence:[out+'assembly.mjs:10',out+'provenance.mjs:6',out+'row-review.md:1'],limits:'최초 snapshot 이전 변경은 원세션 Write/Edit로 확인; 관측 밖 동작 부재는 절대 증명하지 않음'},
 {index:1,status:'confirmed',claim:'40 선정·해시·224/240·kappa .880273·primary37/40·R4 .692982·경보·b2–b19 회귀·실행기·프롬프트 재계산',evidence:[out+'audit.mjs:45',out+'supplement.mjs:5',out+'verify-diff.mjs:9',out+'regression.mjs:8',out+'provenance.mjs:6'],limits:'금지 내용 노출은 관측되지 않음; 절대 미접근은 unclear'},
 {index:2,status:'refuted',claim:'원천 결손·not_suitable 타당은 confirmed이나 진단/원천 근거 제외가 모든 생성물에 전파됐다는 주장은 refuted',evidence:['D:/workspace/Vocaflow-main-serving/scripts/csat/lib-passage.mjs:254','D:/workspace/Vocaflow-main-serving/scripts/csat/build-corpus.mjs:124',root+'scripts/research/goal-data/d1-source-audit.mjs:61',root+'scripts/research/goal-data/d3-build.mjs:55',root+refs.distractor,out+'detect-source-gap.sql:1'],limits:'라이브 DB 상태·제품 진단 소비 경로는 DB 접근 없이 unclear. Claude 추가 조회 필요: detect-source-gap.sql'},
 {index:3,status:'unclear',claim:'후보10·갈림10·primary갈림3 합집합22 원문 대조 완료; 의미·primary Gold는 미확정',evidence:[out+'row-review.md:1',root+'docs/research/goal-data-batches/D2-task-mapping/CONTRACT_V2_4.md:31']},
 {index:4,status:'confirmed',claim:'verdict/review·새 P0/P1·다음 배치 가부·unclear 기록',evidence:[doc+'review.md:1',doc+'verdict.json:1']}
]
const verdict={task:'T-0132',owner:'goal-data-independent',input_commit:'aa851c2772d84fec4436cb96e60cd1c96bbb7e25',diff_base:'98ba78332',result:'pass',result_meaning:'검증 수행 완료; 주장 전체 통과 또는 데이터 결함 해소가 아님',skip_count:0,acceptance,findings:[{id:'B19-P1-01',severity:'P1',title:'확인된 지문 결손이 D3 source_text 집계에서 격리되지 않음',evidence:[root+'scripts/research/goal-data/d3-build.mjs:55',root+refs.reasoning,root+refs.distractor],impact:'1문항·4오답이 source_text에 포함; 결손 선지③도 source_text. 이 문항을 원천 결손으로 격리하면 source_text 오답2644→2640, 그 중 일치1895→1892; 전체 원장666/2664는 보존 가능',scope:'D2 공개 relevance는 unknown; not_suitable은 agreement에 남지만 R1 링크2행은 eligibility 필드가 없어 단독으로 진단 적격성을 증명하지 못함',remedy:'DB를 바꾸기 전에 승인된 원천 결손 표식을 문항/선지에 결속하고 D3 생성·집계 제외 가드를 소유자 경로에서 보완. not_suitable 전부를 source_gap으로 치환하면 정상 삽입/어법도 오분류되므로 금지.'}],new_p0:0,new_p1:1,next_batch:'보류 — B19-P1-01의 결손 전파·집계 격리 확인 후 v2.4 연구 후보 확대 가능',unclear:['라이브 DB와 제품 진단 소비 경로','관측 밖 노출·절대 미접근','원문 PDF와 대조한 복구 승인','심경·다중 direct·배열 대 중심의 의미 Gold'],verification:{failed:0,static_and_binding_checks:x.checks.length,supplement_additional:s.checks.length-a.checks.length,assembly_replays:as.length,isolated_regressions:32,local_batch_variants:19,source_gap_scan:{items:de.unique_inputs,hits:de.matches.map(x=>x.item)},provenance:pr.pass},not_run:['DB 접근·쓰기·마이그레이션','제품 build/E2E','사람 Gold·학생 측정','main·원격 통합'],raw_evidence:'동일 폴더 *.local.json (gitignore)'}
fs.writeFileSync(doc+'verdict.json',JSON.stringify(verdict,null,2)+'\n')
fs.writeFileSync(doc+'review.md',`# T-0132 · B19 독립 검증

**다음 배치 보류 — B19-P1-01 결손 전파·집계 격리 확인 후 v2.4 연구 후보 확대 가능. 새 P0 0 · 새 P1 1.** result=pass는 검증 수행 완료이며 전체 주장 통과가 아니다. skip_count=0.

고정 입력 @aa851c2772d84fec4436cb96e60cd1c96bbb7e25, diff 98ba78332..aa851c277의 16파일을 캡처하고 변경 문서·코드·JSON/JSONL을 구조화해 대조했다. 입력 워크트리는 읽기만 했다. 최초 task show가 IN_PROGRESS/session t-0132-codex여서 추가 대기는 없었으며 PID 조회는 하지 않았다. 중앙 development_policy를 읽고 기존 브랜치를 유지했다. 원문·diff·세션·명령 출력은 두 허용 폴더의 *.local.json에만 저장하며 .gitignore로 제외한다.

## 수용 기준

${acceptance.map(c=>'- AC'+c.index+' **'+c.status+'** — '+c.claim+' ('+c.evidence.join('; ')+')'+(c.limits?' '+c.limits:'')).join('\n')}

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

**B19-P1-01 — D3가 확인된 원천 결손을 source_text로 집계한다.** d3-build.mjs:26/:55는 도표만 source_gap으로 분류하고 :59/:73은 나머지를 source_text로 쓴다. 결과 ${refs.reasoning}, ${refs.distractor}에서 결손을 명시한 ③까지 source_text다. :84/:100/:101의 원천 근거 집계에도 포함된다. 독립 평가 부적격 처리는 agreement에 반영되지만 이 파생 경로까지 원천 근거 제외가 전파됐다는 주장은 refuted다.

영향은 이 문항1·오답4이며 일치 오답3이다. 문항 전체를 결손으로 격리하면 source_text 오답2644→2640, 그 중 일치1895→1892이고, 보존 원장666문항/2664오답은 그대로 둘 수 있다. 이 변경을 입력에 적용하지 않았다. D2 R1에는 E3/E2 링크2행이 남아 있으나 relevance=unknown·관측false이고 진단 적격 필드가 없다(${refs.links}). 링크 보존 자체를 제품 진단 누출로 단정하지 않는다. 실제 제품 소비 경로는 unclear다.

해소 조건: 소유자가 확인된 원천 결손을 UUID/source hash에 결속하고 생성·집계에서 격리한 뒤 재생성 검증한다. not_suitable 전체를 source_gap으로 치환하면 정상 삽입·어법까지 결손으로 오분류되므로 별도 원천 상태가 필요하다. DB 복구는 승인 후 별개다. 본 검증은 입력 읽기 전용이므로 결함을 고쳤다고 보고하지 않는다.

## 표본·남은 불확실성

row-review.md의 후보10·갈림10·primary갈림3 합집합22문항을 원문과 양측 판정으로 대조했다. 2015#19의 기쁨 답은 지지되지만 정서를 R5 압축으로 볼지 범위 밖 대응으로 볼지 계약이 정하지 않아 R5/null을 유지한다. 2015#26·2014A#29의 E2/E3 우선순위도 미확정이다. R4·E2의 indirect/direct/n.a. 갈림을 관측 일치 상승으로 덮지 않는다. 사람 Gold·학생 측정·NeedRank 승인은 없다.

## 검증·마무리

정적/결속 검사${x.checks.length}개와 별도 보충${s.checks.length-a.checks.length}개 실패0, 실제 격리 회귀32/32, 재조립5/5,630문항 탐지 재현 및 관측 provenance 확인을 수행했다. 알려진 D3 결함은 발견사항으로 남아 있다. 첫 Git 조회는 안전 디렉터리 인식 오류 뒤 명령 단위 safe.directory로 읽기를 수행했고, 첫 파서 비교는 별표 공백 차이를 명시적으로 정규화해 재검증했다. 최종본과 정규화 기준을 숨기지 않는다.

재현: node --experimental-vm-modules scripts/research/goal-data/review-b19/audit.mjs → node scripts/research/goal-data/review-b19/regression.mjs → node scripts/research/goal-data/review-b19/assembly.mjs → node --experimental-vm-modules scripts/research/goal-data/review-b19/supplement.mjs → node --experimental-vm-modules scripts/research/goal-data/review-b19/verify-diff.mjs → node scripts/research/goal-data/review-b19/capture.mjs → node scripts/research/goal-data/review-b19/provenance.mjs → node scripts/research/goal-data/review-b19/defect.mjs → node scripts/research/goal-data/review-b19/write-review.mjs. 로컬 원본/세션이 없는 환경은 의미·노출 검증을 완결할 수 없다.

DB 접근·쓰기, 제품 build/E2E, main·원격 통합은 미실행이며 통과로 세지 않는다. 요청한 순서대로 Git add/commit 시도 후 runtime evidence 등록·task submit을 실행한다. 실제 명령 출력과 오류는 finish.local.json에 보존한다.
`)
console.log(JSON.stringify({acceptance:acceptance.map(c=>({index:c.index,status:c.status})),new_p0:0,new_p1:1,refs},null,2))
