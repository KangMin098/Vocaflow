// scripts/research/csat-reading/v12-cross.mjs
// Separate source-grounded cross-type candidates from the existing same-type comparison corpus.
import fs from 'node:fs'
const base='docs/research/csat-reading/',dir=base+'data/v12/',read=p=>JSON.parse(fs.readFileSync(p,'utf8'))
const input=read('scripts/research/csat-reading/local/main-20261014/input.json'),source=read(base+'data/main-20261014/source-audit.json')
const locate=(item,phrase)=>{const start=item.passage.indexOf(phrase);if(start<0)throw Error('Stale cross-case span');return {field:'passage',start,end:start+phrase.length}}
const fact=input.items.find(x=>x.id==='2017#25'),notice=input.items.find(x=>x.id==='2024#28')
for(const item of [fact,notice]){const s=source.items.find(x=>x.id===item.id);if(!['body','stem','choices','presentation','answer'].every(k=>s[k]?.status==='complete'))throw Error('Cross-case source not complete')}
const records=[
 {id:'cross-support-vs-fit-01',status:'source_checked_logical_candidate_not_product_approved',items:[{id:fact.id,type:fact.type_id,binding:fact.binding,polarity:'nonmatching',judgments:[
 {n:1,support:'supports',fit:'fails',evidence:locate(fact,'Forman grew up in a small town near Prague.'),why:'성장지 명제가 본문과 일치하여 불일치 과제 후보로는 부적합.'},
 {n:2,support:'supports',fit:'fails',evidence:locate(fact,'Forman studied film at the film school of the University of Prague.'),why:'학업 정보 일치.'},
 {n:3,support:'supports',fit:'fails',evidence:locate(fact,'he emigrated to the U.S. and continued to make films.'),why:'이주 뒤에도 영화 제작을 계속했다는 조건 일치.'},
 {n:4,support:'supports',fit:'fails',evidence:locate(fact,'swept eight Oscars including one for best director.'),why:'감독상 정보 일치.'},
 {n:5,support:'contradicts',fit:'fits',evidence:locate(fact,'With Jan Novák, Forman wrote his autobiography'),why:'공동 집필이 단독 집필 후보를 반박하여 불일치 과제에 맞는다.'}]},
 {id:notice.id,type:notice.type_id,binding:notice.binding,polarity:'matching',judgments:[
 {n:1,support:'contradicts',fit:'fails',evidence:locate(notice,'Theme: “Joyful Moments” in Our Growing Community'),why:'정해진 주제가 있는데 주제가 없다는 후보.'},
 {n:2,support:'contradicts',fit:'fails',evidence:locate(notice,'from December 1 to December 14.'),why:'접수 기간이 한 달이라는 후보를 반박.'},
 {n:3,support:'supports',fit:'fits',evidence:locate(notice,'Video length cannot exceed three minutes.'),why:'3분 상한을 같은 범위로 대응.'},
 {n:4,support:'contradicts',fit:'fails',evidence:locate(notice,'Entries are limited to one per student.'),why:'1인당 한 편과 두 편의 수량 한계가 다름.'},
 {n:5,support:'contradicts',fit:'fails',evidence:locate(notice,'The prize winners will be chosen by the school art teachers.'),why:'선정 주체가 학생회라는 후보를 반박.'}]}],
 common:'먼저 본문-후보 대응을 판정한 뒤 발문의 일치/불일치 조건에 대응한다. 같은 textual contradiction도 발문에 따라 fit가 반대다.',tasks:['e.task_demand','e.option_correspondence'],countercondition:'추론·제거·삽입 과제에서 모든 후보를 사실 명제로 간주하거나 실제 세계의 거짓을 자동 추론할 수 없다.',AI_FOV:'한 정답 근거만으로 AI를 수행하려면 유일정답 가정이 필요하다. 여기에 작성한 FOV 논리는 각각 전체 입력의 별도 근거를 사용한다.',rights_provenance:'identified local PDF matched; official download chain and human content review unresolved',content_truth:'not_assessed',transfer:'not_tested',teaching_effect:'not_tested'},
 {id:'cross-reference-boundary-02',items:['2014A#39','2016#30'],status:'partial_structural_analogy_decisive_structure_not_identical',basis:'원문 입력을 다시 읽음. 2014A#39의 인물 연결은 서사 이해를 돕지만 완료된 횡단 행동·가방 언급·다음 회고가 삽입 위치를 제약한다. 2016#30의 대명사 후보는 Linx와 Dan Tres의 지칭을 비교하는 과제다.',shared:'인물 지시를 유지하는 언어 자원',difference:'삽입은 사건 순서·연결을 추가 판정하고 지칭 문제는 동일 대상 여부를 판정한다. 지시 추적이 공통이라는 사실만으로 같은 결정 원리의 교차유형 재현을 승인하지 않는다.',source_refs:['restored-v1.2:2014A#39','restored-v1.2:2016#30'],original_principle_validation:false,transfer:false}
]
fs.writeFileSync(dir+'cross-type-cases.json',JSON.stringify({protocol:'1.2',method:'Root AI directly re-read source-bound development inputs and tested separate condition structures; not human or student evidence.',existing_pairs_changed:false,existing_cross_type_pairs:0,cases:records},null,2)+'\n')
console.log('Two separate development cross-type case records; existing749 comparisons unchanged')
