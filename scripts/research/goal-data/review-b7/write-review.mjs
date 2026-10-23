// scripts/research/goal-data/review-b7/write-review.mjs
import assert from 'node:assert/strict';
import {fs,path,root,rev,old,local,dest,base,doc,at,hash,snap,read,makeValidator,validate,passed,atomic,inp,tracks,metrics,locate,samples,sample} from './check.mjs';
const canonRoot='D:/workspace/Vocaflow-main-serving';
const canon=fs.readFileSync(canonRoot+'/docs/CSAT_TYPE_BLUEPRINTS.md','utf8');
const canonTypes=metrics.allTypeProbes.map(p=>{const line=canon.split('\n').findIndex(s=>s.startsWith('#### '+p.type+' '));assert.ok(line>=0);return {...p,evidence:canonRoot+'/docs/CSAT_TYPE_BLUEPRINTS.md:'+(line+1)};});
fs.writeFileSync(local+'canon.local.json',JSON.stringify({observed_at:new Date().toISOString(),root:canonRoot,blueprints:canon,analysis:fs.readFileSync(canonRoot+'/docs/CSAT_TYPE_ANALYSIS.md','utf8')},null,2));
const packet=read(base+'b7-v24/chunk-A-02.out.json');for(const r of packet.rows)r.main_performance_outside_subset=true;
const override={[root+'/'+base+'b7-v24/chunk-A-02.out.json']:JSON.stringify(packet)};
const d2probe=validate('b7-v24',override),d3probe=passed(inp,'b7-v24',override);
assert.equal(d3probe.size,28);assert.equal(d2probe.code,1);
const typo=[];
for(const type of ['R-IMPLY','R-MOOD','R-VOCAB','X-VOCAB','X-REFER','R-IRRELEVANT','R-INSERT']){
 const i=structuredClone(inp);i.rows[0].type_id=type;const r={...tracks.A[0],main_performance_outside_subset:true};
 typo.push({type,guard_rejected:makeValidator(i,atomic.filter(t=>i.tasks.includes(t.id))).row(r).some(e=>e.includes('판정 TASK 안'))});
}assert.ok(typo.every(r=>!r.guard_rejected));
const links=at(doc+'item-task-links.jsonl').trim().split('\n').map(JSON.parse);assert.ok(links.every(r=>r.relevance==='unknown'));
const exact=[];const repeated=[];
const norm=s=>String(s??'').replace(/\s+/g,' ').replace(/\d+/g,'').trim();
for(const a of tracks.A){const b=tracks.B.find(r=>r.item_id===a.item_id);for(const l of a.links){const q=b.links.find(x=>x.task_id===l.task_id);for(const f of ['why','task_distinction'])if(l[f]&&norm(l[f])===norm(q[f]))exact.push({item:a.item_id,task:l.task_id,field:f,chars:norm(l[f]).length,sha256:hash(norm(l[f]))});}}
for(const t of ['A','B'])for(const n of [1,2])for(const f of ['why','task_distinction']){const m=new Map();for(const r of tracks[t].slice((n-1)*20,n*20))for(const l of r.links){if(!l[f])continue;const key=l.task_id+'|'+l.relevance+'|'+norm(l[f]);m.set(key,[...(m.get(key)??[]),r.item_id]);}for(const [key,items] of m)if(items.length>1)repeated.push({track:t,chunk:n,field:f,sha256:hash(key),items});}
const wrong=at('docs/research/goal-data-batches/D3-principles/distractor-logic.jsonl').trim().split('\n').map(JSON.parse);
const sourceWrong={total:wrong.filter(r=>r.evidence==='source_text').length,agree:wrong.filter(r=>r.evidence==='source_text'&&r.distortion.agree).length};assert.deepEqual(sourceWrong,{total:940,agree:632});
const extra={d2probe,d3probe_accepted:d3probe.size,unguarded:typo,exact_cross_track:exact,repeated_links:repeated,canonTypes,sourceWrong};
fs.writeFileSync(local+'detail.local.json',JSON.stringify(extra,null,2));
const evidence=(p,s)=>root+'/'+locate(p,s);
const ev=id=>samples.find(s=>s.id===id).evidence.map(p=>root+'/'+p);
const outsideReasons={
 '2025#30':'경쟁의 죄책감이 동기를 낮추는 문맥에 stronger를 둔 ④는 V축 반의 방향 판단. true 타당.',
 '2025#35':'자동차의 스포츠 관광 기여에서 숙박·식당으로 이탈한 ④. 청크의 R5 압축과 별도로 문장 기능·통일성 R3 수행을 주 수행으로 보면 true가 양립. 유일한 분해라고 확정하지 않음.',
 '2025#42':'석기 제작에 강한 쥐기 등이 필요한데 excludes를 둔 (e). V축 판정이므로 true 타당.',
 '2025#44':'(c)만 Sean이고 나머지는 Ethan. 지칭 추적이 청크 밖이므로 true 타당.',
 '2023#19':'명시 정서어 실망→자신감 대응이 V축일 수 있어 true 양립. R5 압축과의 경계는 unclear.',
 '2023#30':'생활 융합을 막는 문맥에서 maintain을 둔 ⑤는 V축 방향 판정. true 타당.',
 '2023#35':'목소리 조절에서 소음 공동 해결로 이탈한 ③. 통일성·문장 기능 R3을 주 수행으로 보면 true 양립.'
};
const outsideReviews=Object.entries(outsideReasons).map(([item,why])=>({item,status:'confirmed',why,evidence:[evidence(base+'b7-v24/input.json',`"item_id": "${item}"`),...['A','B'].map(t=>evidence(base+`b7-v24/chunk-${t}-02.out.json`,`"item_id": "${item}"`))]}));
const findings=[
 {id:'B7-U1',severity:'unclear',status:'unclear',claim:'A/B 생성 독립성',detail:'true 7행 일치 재현. 이유·decision_path·answer_logic·links 행 전체 일치0/40. B 입력에 기존 분석·traps 없음. 수정 전 A-02 및 독립 세션 로그가 없어 복사 여부와 당시20/20 true 이력은 독립 확정 불가.',evidence:[evidence(base+'b7-v24/chunk-A-02.out.json','"item_id"'),evidence(base+'b7-v24/chunk-B-02.out.json','"item_id"'),evidence(doc+'mapping-review.md','A-02 분석자')]},
 {id:'B7-U2',severity:'unclear',status:'unclear',claim:'E2 .953 인과',detail:'높은 κ는 고정표·구성 차이·동일 AI 조건을 포함한다. 독립 대조 실험이 없어 학습 효과와 인과는 unclear.',evidence:[evidence(doc+'mapping-review.md','.953'),evidence(doc+'CONTRACT_V2_4.md','## 1.')]},
 {id:'B7-P2-01',severity:'P2',status:'unclear',claim:'제외 type_id 독립 결속',detail:'제외3의 본문·source hash·body_ok는 일치하나 excluded_raw.source에는 type_id가 없다. R-CHART 유형은 독립 재대조 불가. 기존 제약이며 새 P0/P1이 아니다.',evidence:[evidence(base+'b7-v24/input.json','"excluded_raw"'),evidence(doc+'b7-v24-selection.json','"type_id": "R-CHART"')]},
 {id:'B7-P2-02',severity:'P2',status:'confirmed',claim:'가드는 의미 적합성을 보증하지 않음',detail:'R-IMPLY는 정본상 추론형. 이번3문항 모두false는 타당하나 true 변이를 가드는 허용한다. 유형별 outside를 항상 자유라고 인증하지 않는다. b8에서도 문항 근거로 false/true를 확인해야 한다.',evidence:[canonRoot+'/docs/CSAT_TYPE_BLUEPRINTS.md:1065',evidence('scripts/research/goal-data/d2-validate.mjs','const IN_SUBSET_TYPES')]} 
];
// Report prose is independently authored below; no source passage or command transcript is published.
const comments={
 '2023#26':'부정 발문과 번역의 평판/실제 구별로 ⑤. E1과 E3 일치 후보를 지지한다.',
 '2023#27':'매일 공사와 주말 한정이 모순이므로 ②. E1/E3 일치는 지지. 일정 줄 탐색 E2와 한정어 대조 E3 중 primary 우열은 unclear.',
 '2023#30':'기술과 생활 융합을 지연하는 문맥에서 유지 동사가 부적절한 ⑤. E1 후보는 타당하며 낱말 판정은 V축 범위 밖.',
 '2023#35':'교사 목소리 조절에서 공동 소음 해결로 옮겨간 ③을 고른다. E1 부정 요구는 지지하나 R5/문장기능 경계는 문항별 판단.',
 '2024#26':'박사 취득 뒤 연구소 입사인데 취득 전으로 바꾼 ②. E1과 E3 일치 후보를 지지.',
 '2024#27':'예약은 이틀 전까지라 당일 예약 ③이 모순. E1 후보는 지지. 발문 끝 잘림·시간표 평탄화는 독립평가 적격 확정과 구별.',
 '2024#30':'비필수품에 매우 높은 가격을 요구하지 않는 문맥에서 low를 쓴 ④. 부정 요구 E1은 지지하며 V축 주 수행.',
 '2024#35':'빠른 말과 두뇌 지연의 충돌을 설명하는 흐름에 빠른 발화를 돕는다는 ③이 반대. E1은 지지하며 문장 기능의 전체 주 수행은 범위 밖 가능.',
 '2024#42':'언론 접촉을 피하면 잘못 인용될 위험도 피하는데 위험을 감수한다고 한 (e). E1은 지지, 낱말 수행은 V축.',
 '2024#44':'대화 상대 Emma를 가리키는 (c)만 나머지 Clara와 다르다. E1은 지지, 지칭 추적은 범위 밖.',
 '2023#21':'일기 쓰기와 자기 검토를 이어 ① 자기 성찰. R6 주 판단은 타당하지만 E3 direct/indirect 구분은 두 조건이 함께 성립해 unclear.',
 '2024#20':'가치를 반영한 행동을 명시적 지침으로 공유하는 ⑤. E3가 부수 대조인지 별도 결정인지 계약 경계는 unclear.',
 '2024#21':'스트레스 부분에 붙들리지 않는 넓은 경험 시야가 ④. 완성된 비유 해석에 원인 규명은 포함되지 않아 A의 R6가 설득력 있지만 E3 우열 규칙이 미봉인이라 unclear.',
 '2024#24':'사람 수·물리적 장소만으로 설명되지 않는 과잉관광이 ⑤. R5 일치는 지지. E3 직접성은 unclear.',
 '2024#41':'언론 접촉의 장단점과 개인 선택이 ②. R5 일치는 지지. 위험만 재사용한 제목의 E3 직접성은 unclear.',
 '2025#21':'이론만 추구하고 실무를 결여한 건축을 뜻하는 ③. 해석이 완성되면 ⑤의 전통 지식과 구별돼 B R6가 설득력. 2024와 반대 방향의 primary 갈림을 확인, 우열 확정은 unclear.',
 '2025#24':'자화상 역사를 확장하는 셀피의 표현 혁신이 ⑤. 자기중심적 세계문화 ③은 중심 명제에 불충분하지만 primary R5/E3 경계는 unclear.',
 '2025#41':'인간 손이 진화·역사를 이룬 결정적 도약인 ②. R5 일치는 지지하고 E3 direct/indirect는 unclear.',
 '2023#19':'실패의 실망에서 격려 뒤 자신감으로 바뀌어 ③. 명시 정서어 대응이므로 B primary null도 타당, A의 R5 압축을 배제할 규칙은 없어 unclear. B R4 indirect가 있는데 secondary []인 계약 충돌 확인.',
 '2024#19':'첫 출근 지각 걱정에서 제때 도착한 다른 버스 탑승 뒤 안도로 변하는 ①. B R4 indirect와 A 무관의 경계는 unclear. 두 트랙 primary null과 secondary []를 확인.',
 '2025#19':'예약 전 확신에서 만석 통보 뒤 실망으로 변하는 ③. B R4 indirect/primary null/secondary []는 같은 계약 경계. 정서가 명시돼 R6를 강제하지 않는다.',
 '2024#28':'길이 상한 3분인 ③이 맞다. 항목별 위치와 수치·주체 대조가 모두 필요하므로 E2/E3 primary 우열은 unclear.',
 '2025#26':'마지막 방송 이듬해 사망이므로 3년 뒤라는 ④가 틀리다. E3 일치는 지지.',
 '2025#27':'5일권만 할인이라는 ③은 공통 혜택과 모순. E2/E3 primary 우열은 unclear이고 표의 원래 시각적 셀 범위는 평탄화 원문만으로 독립 인증 못함.',
 '2025#28':'눈 조각 11팀 ③이 일치. 연간·7일·주차 불가·유료 셔틀과 비교하는 E3 일치는 지지.'
};
const sampleReviews=[...sample.candidates.map(s=>({...s,group:'candidate',status:'confirmed'})),...sample.disputed.map(s=>({...s,group:'disputed',status:'unclear'})),...['2025#19','2024#28','2025#26','2025#27','2025#28'].map(item=>({item,group:'extra',status:['2025#26','2025#28'].includes(item)?'confirmed':'unclear'}))].map(s=>({...s,why:comments[s.item],evidence:ev(s.item)}));
const acceptance=[
 {index:0,status:'confirmed',why:'v2.4 봉인은 §4 결정 대기·97→96 예외·relevance unknown·NeedRank 금지를 보존. 이전 selection 전량 수집을 읽었고 range 기존/신규 및 fixed 재판정 3대조 반례 통과.',evidence:[evidence(doc+'CONTRACT_V2_4.md','**봉인**'),evidence('scripts/research/goal-data/d2-export.mjs','const judgedBefore'),evidence('scripts/research/goal-data/d2-export.mjs','if (def.range && judgedBefore.has')]},
 {index:1,status:'confirmed',why:'40=15+15+10, 제외3의 source/passage 해시 일치, selection 및 모든40 입력 해시 일치. 224/240=.933333 κ=.8781958, primary31/40, 후보83 갈림16. 안정5 경보 ok. b2–b7 D2/D3 현행 계약 회귀 결함0. 제외 유형의 독립 검증은 P2-01 별도 unclear.',evidence:[evidence(doc+'b7-v24-selection.json','"exam_totals"'),evidence(doc+'b7-v24-agreement.json','"agreement":'),dest+'recalculation.json:1']},
 {index:2,status:'unclear',why:'A-02 전부true 변이: 구검사20행 수용, 신규12행 거부, D2와 D3 전파 재현. 13 유형 ID는 정본과 일치. 재표시7행은 B-02와 일치하고 내용상 타당. 그러나 당시20/20 이력과 복사 부재를 인증할 수정 전 출력·생성로그 없음. R-IMPLY 등 가드 밖은 문항 검토를 요구하며 유형 정본 자체가 outside 자유를 보증하지 않음.',evidence:[evidence('scripts/research/goal-data/d2-validate.mjs','const IN_SUBSET_TYPES'),...ev('2025#21'),...ev('2023#19')]},
 {index:3,status:'unclear',why:'후보10·갈림10 및 추가5 고유25문항 원문 대조 완료. E3 일치 예와 E2↔E3/함축 반대 방향/primary null indirect R4를 확인. E2 κ .9526의 인과와 v2.5 세 후보의 최종 타당성은 미확정. 후보들은 추가 관측을 위한 합리적 가설이며 봉인된 정답 규칙으로 승인하지 않음.',evidence:[evidence(doc+'b7-v24-review-sample.json','"candidates"'),evidence(doc+'mapping-review.md','### 다음 계약(v2.5)'),...ev('2024#21'),...ev('2025#21')]},
 {index:4,status:'confirmed',why:'verdict.json와 review.md에 각 기준·새 P0/P1·unclear 및 b8 판단을 기록. pass는 검증 수행 완료.',evidence:[dest+'verdict.json:1',dest+'review.md:1']}
];
const verdict={task:'T-0111',owner:'goal-data-independent',session:'t-0111-codex',input_commit:rev,base_commit:old,packet_observed_at:snap.observed_at,observed_at:new Date().toISOString(),result:'pass',result_meaning:'검증 수행 완료; 전체 내용 합격 또는 제품 투입 승인이 아님',skip_count:0,acceptance,new_P0:[],new_P1:[],findings,sampleReviews,outsideReviews,canonTypes,b8:'조건부 진행 가능 — 연구 배치로만 확대하고 §4 결정 대기·공개 relevance unknown·NeedRank 금지 및 문항별 outside 검토를 유지; v2.5 세 후보는 별도 미관측 검증 전 봉인하지 않는다.',unclear:['A/B 생성 독립성과 수정 전 A-02 20/20 이력','제외3 type_id 원천 독립 결속','E2 κ 상승 인과·학생 효과','E3/R6/primary 경계·v2.5 세 후보의 최종 타당성','일부 안내문 원래 표 레이아웃'],scope_not_run:['DB/SQL·데이터 쓰기','제품 E2E·사람 Gold·학생 검증','입력 worktree 수정·실제 계약 봉인','main/원격 통합'],git:'pending_attempt'};
fs.writeFileSync(dest+'verdict.json',JSON.stringify(verdict,null,2)+'\n');
const lines=['# T-0111 b7-v24 독립 검증','',verdict.b8,'',`입력 ${old}..${rev}; owner goal-data-independent · session t-0111-codex. 최초 조회 IN_PROGRESS·세션 일치. PID 조회 없음. 중앙 dev-minimal-20261020 확인. 패킷 관찰 ${snap.observed_at}. 입력은 읽기 전용·DB 접근 없음.`,'','검증 수행 완료(pass), skip_count=0. 새 P0 0 · P1 0. pass는 데이터 전부 승인·제품 관련도·진단 투입 승인이 아니다.','', '## 수용 기준','',...acceptance.flatMap(a=>[`### ${a.index}. ${a.status}`,'',a.why,'',...a.evidence.map(e=>'- '+e),'']),'## 재계산과 변경분 검토','', '18파일 diff를 고정 커밋으로 읽었다. 코드·봉인·§12는 직접 대조하고 JSONL은 모든 기존 행 유지/추가 필드를 분해 대조했다. D2 기존 변경·삭제0, 후보+83·갈림+16; D3 기존 변경·삭제0, 사고과정+40·오답+160. 결합238문항·R1 687·갈림359. D3 primary197/238·전체오답644/952와 원문확인632/940을 구별한다. README의 .672는 후자다. 40행 설명·오답·primary 전파 일치. D2 4산출은 메모리 재생성 바이트 일치.','', '40문항 source/passage/selection 해시와 3제외 source/passage/body_ok를 확인. 제외 raw에 type_id가 없어 도표 유형 자체의 독립 재계산은 unclear다. 선정 스캔은 앞선 배치 및 pilot selection을 전량 읽고 본 배치를 제외하며, 기존 입력이 있으면 덮어쓰기 전에 중단한다. 범위배치 기판정은 차단, 신규와 고정 재판정은 수용하는 3대조군을 확인했다. DB를 호출한 export 전체 실행과 현재 DB 동일성 인증은 하지 않았다.','', '13개 ID는 R-FACT·R-NOTICE·X-FACT·R-BLANK·R-SUMMARY·R-GIST·R-TOPIC·R-TITLE·X-TITLE·R-CLAIM·R-PURPOSE·R-ORDER·X-ORDER. 정본의 정보 대조·중심·추론·배열 수행과 여섯 TASK는 양립한다. 유형별 근거는 verdict.json canonTypes에 남겼다. guard 밖 어휘·지칭·무관·심경은 V/S/R2/R3와 경계가 있어 문항 판단을 유지하는 것이 타당. 삽입도 R4/범위 밖 연결과 관찰 부적격을 구별한다. 함축은 정본상 추론이므로 이번 세 문항 false가 맞으며, guard가 true를 허용한다고 의미적으로 승인된 값은 아니다.','', '## 분석자 스크립트·복사 탐지','', '이전 b6의 고정 우선순위 R5>R4>E3>E2>R6>E1로 예측했다. A-01 19/20(복수4/5), A-02 17/20(7/10), B-01 17/20(6/9), B-02 16/20(7/11). 이번에는 해당 고정 우선순위로 전량 선택된 패턴이 아니다. 이 검사는 다른 스크립트 부재의 증명이 아니다.','', 'A/B 모두 전체40에서 true13; 그중 A-02/B-02 true7은 2025#30·35·42·44 및 2023#19·30·35로 일치한다. 어휘3·지칭1·무관2·심경1이라는 근거로 설명할 수 있다. 현재 primary_reason·decision_path·answer_logic·links의 행 전체 A/B 완전 일치0/40, primary_reason 청크 내 숫자·공백 정규화 반복0. 링크 why/task_distinction의 반복은 별도로 detail.local.json에 보존했다. B 입력은 분석/traps 0, A는40개다. 독립 입력 설계는 confirmed이나 생성 독립성·복사 부재는 로그가 없어 unclear. 수정 전 A-02 20행 true 이력은 §12의 자진 보고이며 반례 재현과 구별한다.','', '## 원문 대조','',...sampleReviews.flatMap(s=>[`- ${s.group} ${s.item} / ${s.task??'추가'}: **${s.status}** — ${s.why}`,`  - ${s.evidence.join(' · ')}`]),'', '## v2.5 후보 판단','', '1. 일치·안내문의 E2/E3 우열: 위치와 표현 대조가 모두 필요한 구조를 짚은 연구 후보로 타당하다. 실제 렌더의 표·항목 난도와 문항별 대조 없이 남는 선지를 관측하기 전 어느 수행이 더 어렵다는 원인 주장은 unclear.','2. 함축까지 §4 확대: 2024#21과 2025#21의 반대 방향 갈림이 필요성을 보이지만 완성된 의미를 어디까지 제공하는지에 따라 남는 선지 수가 달라진다. 고정된 명제·남는 번호로 새 배치에서 검증해야 한다. 현 판정에 소급 봉인하지 않는다.','3. primary null + indirect secondary: 2023#19·2024#19·2025#19 B에서 실제 발생. 현 계약은 secondary []를 요구하므로 현재 행은 계약 통과다. indirect를 보존할 후보는 합리적이지만 direct0 면제와 base validator·D2/D3 소비 계약을 함께 정해야 하며 현재 데이터를 결함으로 뒤집지 않는다.','', '## 불확실성과 실행','',...findings.map(f=>`- ${f.id} (${f.status}): ${f.detail}`),'', '구현·검증 스크립트는 check.mjs 및 write-review.mjs. 원문·패킷·diff·명령 출력은 ignored *.local.json에만 둔다. 초기 보조 명령의 인용 실패·경로 오류와 검사 스크립트 구문 오류는 교정 후 assertions를 재실행했다. DB·제품 E2E·사람 검수·학생 측정·입력 수정·main/원격 통합은 범위 밖 미실행이며 통과가 아니다. Git add/commit와 evidence/submit 출력은 command-output.local.json에 기록한다.'];
// Keep report language Korean, including findings summarized above.
lines.push('', '## A-02 재표시 7행', '', ...outsideReviews.flatMap(r=>['- '+r.item+' ('+r.status+'): '+r.why, '  - '+r.evidence.join(' · ')]));
fs.writeFileSync(dest+'review.md',lines.join('\n')+'\n');
console.log('verdict.json and review.md written; 5 acceptance criteria, 25 source reviews, no new P0/P1; unclear retained.');
