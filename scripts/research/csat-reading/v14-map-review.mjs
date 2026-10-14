// scripts/research/csat-reading/v14-map-review.mjs
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const base='docs/research/csat-reading/data/',path='scripts/research/csat-reading/local/v14/map-input.json';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),sha=s=>createHash('sha256').update(s).digest('hex');
const packet=read(path),sources=new Map(packet.items.map(x=>[x.item.id,x]));
// Hand-authored after reading every selected body/stem/candidate/gloss/presentation; not rule-generated relevance.
const decisions={
'r.central_meaning':[
['2019#23','direct','ethical principles of justice','기후 변화 대응의 정의 원칙을 원조·산림 보전·보조금 개혁으로 연결하는 전체 범위가 주제 판단 경로에 직접 쓰인다.','R4 조직도만 제시하면 중심 대상·서술 생성은 관찰되지 않는다.'],
['2015#24','not_applicable','largely on foot','생애 사실의 여행 방식 한 항목을 비교할 수 있다. 전체 생애 요지를 생성할 요구는 원래 과제에 없다.','그림 실력·명성의 요약을 새 수업 과제로 만들 가능성과 원래 R5 요구를 분리한다.'],
['2015#32','direct','Knowledge is amoral','지식의 진전과 도덕적 사용을 구분한 중심이 빈칸 전후 판단 경로에 쓰인다.','E3 후보 평가와 선지 없는 R5 중심 생성은 다른 관찰이다.'],
['2017#25','not_applicable','With Jan Novák','공동 집필 정보와 단독 집필 후보의 대응으로 판정할 수 있어 중심 생성 요구를 인정하지 않는다.','세부 근거 발견 E2와 중심 대표성 R5를 혼동하지 않는다.'],
['2014B#38','indirect','These changes','지각의 형태 유지와 망막상의 변화라는 전역 내용은 순서 이해를 돕지만 선행 사다리꼴·변화·유사 예의 연결로 배열이 제약된다.','R1 지시·R2 관계·R4 배열 산출물로 R5 생성 성공을 대체하지 않는다.'],
['2020#36','indirect','The simple answer to this question','문화 재생산과 만족스러운 이야기의 연결이 내용 이해를 지원한다. 질문→답변→구체적 예의 연결은 별도 충분 경로 후보다.','주제 한 문장을 정답 순서의 필수조건으로 강제하지 않는다.']
],
'e.option_correspondence':[
['2018#28','indirect','what it is really having','밑줄 형식의 문장 기능을 검사하는 과제다. 고립 표현은 사실 명제가 아니며 S 계열 분석이 직접 요구된다.','다섯 표시가 존재한다는 자동 규칙은 의미 명제 후보의 E3 직접 대응을 과잉 연결한다.'],
['2014A#32','direct','showed the same average annual hours','도표 두 연령군의 시간 값을 후보의 같음·비교·결합 조건과 대응한다.','도표 값 읽기와 원래 영어 후보 의미 정규화는 별도 단계다.'],
['2022#25','direct','is not expected to change','예측연도·지역·변화 여부를 원도표의 두 값과 대조한다. AI 한 후보 판정과 다른 네 후보 FOV를 분리한다.','인쇄 후보 문장은 자기 진실의 근거가 아니며 원도표 셀을 사용한다.'],
['2018#19','direct','What a wonderful adventure','앞의 기대 불충족과 뒤의 감탄·매혹을 심경 변화 후보에 대응한다.','세계 사실성 판단이나 두 단어의 사전 동의관계 V4로 대체하지 않는다.'],
['2015#21','direct','When there is no immediate danger','놀이의 문제 해결 역할과 개입 자제 조건이 주제 후보의 범위에 대응한다.','선지를 보고 얻은 요지는 독립 R5 생성의 증거가 아니다.'],
['2016#18','direct','switch to the third week program','기존 신청 주차와 변경 가능 문의를 목적 후보의 행위·대상과 대응한다.','예약 사실·환불 불가 정보가 곧 환불 요구라는 주장을 지지하지 않는다.']
],
's.form_scope':[
['2014A#32','direct','the same average annual hours','두 집단의 같은 시간이라는 결합 절과 다른 두 집단의 대소 절의 범위를 구별한다.','수식어 부착 S3를 모두 맞혀도 같음·대소·결합의 진리조건을 잘못 구성할 수 있다.'],
['2018#28','not_applicable','what it is really having','문제의 what 절은 목적어 공백 없는 완전 절에 대한 연결 형식이다. 부정·비교·양화·조건의 의미 범위가 핵심 판정이 아니다.','S3/절 구조 문제를 모든 어법 유형이라는 이유로 S5 직접으로 분류하지 않는다.'],
['2018#18','indirect','if it is possible','예약이 가능하다는 단정과 가능 여부 문의를 구별하면 요청 의미에 도움된다. 원래 목적은 행위 대응으로도 구별된다.','if의 보문 여부와 문의의 실제 내용 범위를 별도 기록한다.'],
['2021#26','direct','remained active in teaching and writing','은퇴 이후에도 가르침과 글쓰기를 함께 지속했다는 결합과 가르침 부정 후보를 비교한다.','수식관계만 표시하면 부정·시점·결합 보존 수행이 빠진다.'],
['2014A#36','indirect','if they are in a meeting','조건부 상황 예를 일반 성향과 구분하는 의미 범위가 관계 판단을 지원한다. 원래 빈칸은 예시·대조 기능 요구가 중심이다.','조건문의 해석과 대조 연결 표현 선택 R2/E3를 같은 수행으로 세지 않는다.'],
['2017#38','indirect','only when the essential point','연대순 글의 정당화 조건이 제한된다는 설명은 끝부분 이해를 돕는다. 삽입 위치는 독자 정보와 Therefore의 연결로도 제약된다.','only when 해석을 삽입의 보편 필수조건이라고 일반화하지 않는다.']
],
'v.contextual_sense':[
['2016#29','indirect','competing / cooperating','동일 먹이 이용을 후보 의미와 연결한다. 핵심은 경쟁·협력의 의미 관계와 문맥 적합성이며 하나의 다의어 뜻 선택을 직접 요구한다고 할 증거는 부족하다.','V4 대비·E3 후보 적합성을 V2 다의 문맥 선택과 혼동하지 않는다.'],
['2014A#36','not_applicable','low self-monitoring','연결 표현의 예시·대조 관계를 선택하는 과제이며 특정 표현의 서로 다른 문맥 뜻을 구별하는 관찰은 없다.','표현을 뜻으로 번역한 활동을 V2 직접 평가로 자동 승격하지 않는다.'],
['2020#37','indirect','blind to the fact','인지하지 못함이라는 비유 뜻은 비판 내용을 이해하는 데 도움되지만 순서 과제는 선행 지시·추가 비판의 연결로도 제약된다.','비유 뜻 설명은 새 V2 수업 후보가 될 수 있으나 원래 배열이 V2 직접 측정인 것은 아니다.'],
['2024#23','direct','correct “signal”','시장 보상의 잘못된 유인·안내라는 뜻을 실제 정보 전달 신호와 구별하는 문맥 해석이 중심 범위 대응 경로에 쓰인다.','단어 뜻 설명만으로 전역 주제 후보의 범위 적합성 E3까지 검수한 것은 아니다.'],
['2015#24','indirect','many commissions','후원자의 의뢰라는 의미는 기관·위원회 뜻과 구별되어 이력 이해를 돕는다. 원래 불일치 여행 방식 판정에는 직접 요구되지 않는다.','지문 안 다의어 존재와 실제 정답 경로의 직접 요구를 분리한다.'],
['2020#20','direct','biggest roadblock to play','물리적 도로 장애가 아니라 성인의 놀이를 막는 심리적 장애라는 문맥 뜻이 규범·걱정과 대응한다.','R5 전체 주장은 별도 생성·근거 응답이 필요하다.']
]};
const rows=packet.rows.map(sel=>{const d=decisions[sel.task_id].find(r=>r[0]===sel.item_id);if(!d)throw Error('Missing decision');const {item,path:source_path}=sources.get(sel.item_id);const start=item.passage.indexOf(d[2]);if(start<0)throw Error('Anchor missing '+sel.item_id);return {...sel,relevance:d[1],why:d[3],task_distinction:d[4],source_path,source_file_sha256:sha(fs.readFileSync(source_path)),source_row_sha256:sha(JSON.stringify(item)),anchor:{field:'passage',start,end:start+d[2].length,offset_unit:'UTF-16'},source_admission:'inherited_AI_complete_question_and_same_form_key; no new PDF audit',research_qualification:'source_bound_AI_development_review',public_qualification:'not_reviewed',student_measurement:false};});
const result={version:'1.4',selection_sha256:packet.selection_sha256,source_packet_sha256:sha(fs.readFileSync(path)),reviewer:'single_AI_education_context',definitions:{direct:'An actual original-item solution path uses the distinct TASK performance; not necessity over all paths or learner measurement.',indirect:'Supports understanding but original demand or distinct observation is not established.',not_applicable:'Original task does not demand the distinct performance; new teaching task remains possible.',unknown:'Insufficient input or definition for an actual-item claim.'},rows,first_submission:true,prior_unique:74,new_unique:rows.length,latest_unique:98,remaining_unreviewed:23482,automatic_candidates_unchanged:6310,student_count:0,human_count:0,population_estimates:false};
const out=base+'v14/map-review.json';if(fs.existsSync(out))throw Error('First submission exists');fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({rows:rows.length,sha256:sha(fs.readFileSync(out)),states:rows.reduce((s,r)=>(s[r.relevance]=(s[r.relevance]??0)+1,s),{})}));
