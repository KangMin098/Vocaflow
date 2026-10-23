// scripts/research/goal-data/review-b18/write-review.mjs
// Publish conclusions and evidence locations; all source text stays in ignored captures.
import fs from 'node:fs'
const out='scripts/research/goal-data/review-b18/',doc='docs/research/goal-data-batches/review-b18/'
const get=n=>JSON.parse(fs.readFileSync(out+n+'.local.json'))
const a=get('audit'),c=get('checks'),s=get('supplement'),assembly=get('assembly')
if(c.failed.length)throw Error('verification failures remain')
const notes={
 '2016#37':['confirmed','사례→사례 해석→정리 사이에 삽입하는 배열 근거를 지지한다. 지칭·문장 기능과 묶인 R4이며 독립 관찰 아님.'],
 '2016#38':['confirmed','부의 장점 나열이 끝난 뒤 양보 전환과 결론을 잇는 위치가 ⑤다. R4 묶음 후보 지지.'],
 '2017#38':['confirmed','약점 진술과 결과 사이에 독자의 사전 지식을 이유로 넣는 ②를 지지한다. R4 분리 타당도는 미확정.'],
 '2017#39':['confirmed','시장에 맡길 수 없다는 부정 뒤 국가 개입 대안, 그 뒤 직접·간접 방식이 이어지는 ⑤를 지지한다.'],
 '2016#25':['confirmed','적진 한가운데라는 장소가 ④의 반대 장소와 충돌한다. 부정 발문 E1 후보 지지; E3·E2와 분리된 학생 수행은 미확정.'],
 '2016#27':['confirmed','11월 한 달 일정과 ④의 두 달이 충돌한다. 부정 발문 후보 지지; 자동 부정문 규칙의 기여와 독립 수행은 구분한다.'],
 '2016#28':['confirmed','④의 절에서 본동사가 필요한 어법 오류다. E1 후보는 계약상 지지하되 핵심 어법 수행은 S축으로 범위 밖.'],
 '2016#29':['confirmed','갈대 파괴·어종 결여·먹이 경쟁을 모두 만족하는 ③. 두 조건만 확인할 때 ⑤로 가는 E1 indirect 반사실은 가능하나 실제 학생 경로는 미확정.'],
 '2016#30':['confirmed','④만 Dan Tres, 나머지는 Linx다. 다수와 다른 대상을 고르는 E1 후보 지지; 지칭 자체는 범위 밖.'],
 '2016#39':['unclear','감각 평가 단계 사이의 영양 가치 정의가 이탈하는 ③. R4·E1 후보는 지지하나 A의 R5 indirect와 B의 n.a. 우열은 미확정.'],
 '2016#23':['unclear','원하는 생물학적 노화 지표를 찾는 제목 ①이 지지된다. E3 direct/indirect는 비유 대응과 핵심어 오답의 부담 구분에 달려 미확정.'],
 '2016#33':['unclear','계통 독점·재파종 부적합을 결합한 재구매 ① 지지. B의 시장 낱말 오답 대응 E3와 A의 n.a. 차이는 미확정; 특정 오답을 든 E2 보조 설명은 가능.'],
 '2017#40':['unclear','주민 평가 차이가 관광 유형·보호 인식·거리와 관련된다는 요약 ③ 지지. 긍정 반응의 대상은 경제·일부 사회문화 영향이므로 환경 평가와 바로 경쟁한다고 확정하기 어렵다. E2·E3 강도는 미확정.'],
 '2016#21':['unclear','내적 동기 교수법의 효과를 결론으로 잡는 ⑤ 지지. 양보를 결론으로 오인하는 R4 보조 경로는 가능하지만 필수성은 미확정.'],
 '2016#31':['unclear','문화 요소 수용과 미터법 사례를 연결한 혁신 ② 지지. innovation 낱말 부재 자체는 R6 근거가 아니며 명제 재진술/결합 경계를 유지한다. 단위 열거에서 ⑤로 가는 E2 반사실 강도 미확정.'],
 '2016#34':['unclear','옛 불멸 희망과 새 대중 인정의 전환으로 ④ 지지. R4 indirect/n.a. 차이는 전환 배열을 별도 수행으로 보는지에 달려 미확정.'],
 '2016#40':['unclear','경기 침체 속 상대 성과 평가 예시와 결론이 ②를 지지한다. 결론 한 문장만으로 맥락 요인·수치만 의존 금지 전체를 재진술하는지 불분명하여 R6/R5 primary 미확정.'],
 '2016#42':['unclear','겉보기의 실용성 부재와 실제 가치 대비가 ②를 지지한다. 뒤의 높은 가치 진술은 ④로 가는 구체 경쟁 문장이라 E2 일치 후보는 지지하나, 두 트랙 일치만으로 타당성은 확정하지 않는다.'],
 '2017#32':['unclear','직군별 해상도 요구를 묶는 ② 지지. 배경 증가→반전→예시→재진술을 별도 R4 보조로 셀지 미확정.'],
 '2017#35':['unclear','직업 동일시의 위험 전개에 경력 향상 문장 ②가 이탈한다. E1/R4 primary 차이는 요구 방향과 실질 배열 판단의 경계로 남는다.'],
 '2017#42':['unclear','④ 정답 지지. (B)를 맞히면 ①·④가 남지만 A의 경쟁 문장은 ③을 지지해 이 잔여 둘을 가르지 못한다. A의 §4.3 충족 설명은 refuted; 대체 primary Gold는 미확정.'],
 '2017#44':['unclear','②의 연주자는 Keith, 나머지는 Erik이다. 여러 단락의 지칭 근거 탐색 E2와 다른 하나 요구 E1의 primary 우열, 기획자 동일성 추론은 미확정.'],
 '2016#26':['unclear','점심 포함 ④ 지지. 숫자와 항목의 대조 E3·흩어진 항목 탐색 E2 모두 지지되나 어느 쪽이 결정에 더 직접인지 미확정.']
}
const rows=a.dossier.map(d=>{if(!notes[d.id])throw Error('missing manual review '+d.id);const [verdict,why]=notes[d.id];return {item:d.id,verdict,why,evidence:d.evidence}})
fs.writeFileSync(out+'row-review.md','# b18 원문 대조\n\n후보 10·갈림 10·primary 갈림 5의 합집합 '+rows.length+'문항. confirmed는 후보 근거 지지이며 의미 Gold·학생 경로·독립 측정 확정이 아니다. 원문·선지·정답·양측 판정은 dossier.local.json에만 보존한다. 아래 경로는 읽기 전용 입력 @5d7292bea 기준이다.\n\n'+rows.map(r=>'## '+r.item+' — '+r.verdict+'\n\n'+r.why+'\n\n근거: '+r.evidence.map(p=>'`'+p+'`').join(' · ')+'\n').join('\n'))
const ac=[
 {index:0,verdict:'confirmed',claim:'네 조립 경로는 형식 변환만 수행하고 자기 최초 스냅샷을 재현한다. 최종본 재현 주장은 A01 두 설명에서 refuted.',evidence:[out+'assembly.mjs:20',out+'row-review.md:1']},
 {index:1,verdict:'confirmed',claim:'A01 두 행은 문항별 수기 수정이며 손 원본 미반영에 따른 재현성 결함이다. B02 첫 출력 전 수정은 손 원본의 네 문항에 한정된다.',evidence:[out+'assembly.mjs:29','scripts/research/goal-data/local/b18-v24/chunk-A-01.out.json:2150','scripts/research/goal-data/local/b18-v24/chunk-A-01.out.json:2269']},
 {index:2,verdict:'confirmed',claim:'40선정·해시·221/240·κ .855486·35/40·경보·b2–b18 validate·회귀32·8980aaa59 실행기·prompt/manifest를 재검증했다. 기록상 금지 내용 노출 없음; 절대 미접근은 unclear.',evidence:[out+'audit.mjs:45',out+'supplement.mjs:4',out+'regression.mjs:14']},
 {index:3,verdict:'unclear',claim:'후보10·갈림10·primary갈림5 원문 대조 완료. 2017#42 A의 경쟁 문장→잔여 선지 설명은 refuted; 2016#42 E2는 지지하되 의미·primary Gold는 미확정.',evidence:[out+'row-review.md:1','docs/research/goal-data-batches/D2-task-mapping/CONTRACT_V2_4.md:39']},
 {index:4,verdict:'confirmed',claim:'verdict/review·새 P0/P1·다음 배치 가부와 unclear를 기록했다.',evidence:[doc+'verdict.json:1',doc+'review.md:1']}
]
const finding={id:'B18-P1-01',severity:'P1',title:'최종 검증본이 손 원본으로 재현되지 않음',items:['2016#22','2016#23'],field:'not_observable.0.why',impact:'A01 재조립으로 두 수기 설명이 사라지고 반복 설명 가드 결함1이 재발한다. relevance·primary·D2/D3 판정 값은 바뀌지 않는다.',evidence:[out+'assembly.mjs:29','scripts/research/goal-data/local/b18-v24/chunk-A-01.out.json:2251','scripts/research/goal-data/local/b18-v24/chunk-A-01.out.json:2365'],remedy:'입력 소유자가 두 문항의 손 원본에 최종 수기 설명을 반영하고 메모리 재조립=최종본 및 validate 결함0을 확인한다. 최초 스냅샷은 보존한다.'}
const verdict={task_id:'T-0130',owner:'goal-data-independent',input_commit:a.rev,base_commit:a.old,observed_at:new Date().toISOString(),result:'pass',result_meaning:'독립 검증 수행 완료; 모든 주장 통과 또는 다음 배치 승인이라는 뜻이 아님',skip_count:0,acceptance:ac,new_P0:0,new_P1:1,findings:[finding],next_batch:{decision:'hold',line:'보류 — B18-P1-01의 손 원본 동기화·재조립 일치 확인 후 v2.4 연구 후보 확대 가능; 의미 Gold·공개 relevance·NeedRank 승인은 별개.'},unclear:['의미 및 primary Gold','실제 학생 오답 경로·독립 측정 타당도','관측 기록 밖 절대 미접근·인과 오염 부재'],verification:{independent_checks:c.checks.length,failed:c.failed.length,shipped_regressions:32,packet_count:c.packet_count,overall:a.overall,primary_agreement:35},not_run:['DB 접근·쓰기','제품 build/E2E','사람 Gold·학생 측정','main·원격 통합']}
fs.writeFileSync(doc+'verdict.json',JSON.stringify(verdict,null,2)+'\n')
const md=`# T-0130 · b18-v24 독립 검증

**다음 배치 보류 — B18-P1-01 손 원본 동기화·재조립 일치 확인 후 v2.4 연구 후보 확대 가능. 새 P0 0 · 새 P1 1.** result=pass는 검증 수행 완료이며 전체 주장 통과·의미 Gold 승인이 아니다. skip_count=0.

고정 입력 @${a.rev}, diff c839832ca..5d7292bea의 16파일을 캡처하고 구조·결속·생성물 전필드를 대조했다. 원문 의미 대조는 후보10·갈림10·primary갈림5 합집합 ${rows.length}문항이다. 첫 task show가 IN_PROGRESS/session t-0130-codex여서 추가 대기 불필요. PID 조회 없음. 중앙 development_policy를 읽고 현재 브랜치를 유지했다. 입력 소유 워크트리는 읽기만 했다. 원문·명령 출력·전체 diff·세션 전문·손 원본·조립 코드는 *.local.json에만 보존하며 두 산출 폴더에서 제외한다.

## 수용 기준

${ac.map(x=>'- AC'+x.index+' **'+x.verdict+'** — '+x.claim+' ('+x.evidence.join('; ')+')').join('\n')}

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

독립 검사${c.checks.length} 실패0·제공 회귀32/32·skip_count0. 알려진 재현성 결함을 기대된 반례로 검사했으므로 검증기 실행 통과와 데이터 결함 해소를 혼동하지 않는다. 캡처 ${c.packet_count}파일·원세션4개·손 원본의 바이트 불변을 확인했다. 첫 VM 시도의 경로 표기/이벤트 핸들러 모형 오류는 검사 실패를 숨기지 않고 보완한 뒤 재실행했다. 최종 명령 출력은 commands.local.json, 결함 재현 원문은 assembly.local.json에 있다.

재현: node scripts/research/goal-data/review-b18/capture.mjs → node scripts/research/goal-data/review-b18/run.mjs → node scripts/research/goal-data/review-b18/write-review.mjs. setup.mjs는 이전 검사 이식용이며 기존 완료 검사를 덮어쓸 수 있어 재현 명령에서 제외한다. 로컬 원본·세션 없는 환경에서는 Git 파일만으로 모든 의미·노출 검증을 완결할 수 없다.

DB 접근·쓰기, 제품 build/E2E, 사람 Gold·학생 측정, main·원격 통합은 미실행이며 통과로 세지 않는다. 요청 순서대로 자기 산출물 Git add/commit 시도 후 evidence와 submit을 수행한다. 실제 명령 출력·오류는 finish.local.json에 보존한다.
`
fs.writeFileSync(doc+'review.md',md)
console.log(JSON.stringify({acceptance:ac.map(x=>x.verdict),rows:rows.length,new_P0:0,new_P1:1,next_batch:'hold',checks:c.checks.length}))

