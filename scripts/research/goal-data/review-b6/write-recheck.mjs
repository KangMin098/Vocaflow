// scripts/research/goal-data/review-b6/write-recheck.mjs
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const dir='docs/research/goal-data-batches/review-b6/',local='scripts/research/goal-data/review-b6/';
const root='D:/workspace/Vocaflow-goal-data',rev='16561e875';
const m=JSON.parse(fs.readFileSync(dir+'recheck-metrics.json','utf8'));
const snap=JSON.parse(fs.readFileSync(local+'recheck-packets.local.json','utf8'));
const git=(...a)=>execFileSync('git',['-c',`safe.directory=${root}`,'-C',root,...a],{encoding:'utf8',maxBuffer:2000000});
const at=p=>git('show',`${rev}:${p}`);
const ref=(p,needle)=>{const txt=snap.files[p]??at(p);const i=txt.split('\n').findIndex(l=>l.includes(needle));if(i<0)throw new Error('Missing reference '+p+' '+needle);return `${root}/${p}:${i+1}`;};
const d2='docs/research/goal-data-batches/D2-task-mapping/',d3='docs/research/goal-data-batches/D3-principles/',base='scripts/research/goal-data/local/b6-v23/';
const code='scripts/research/goal-data/';
const p=(track,n,item)=>ref(base+`chunk-${track}-0${n}.out.json`,`"item_id": "${item}"`);
const source=item=>ref(base+'input.json',`"item_id": "${item}"`);
const contract=n=>ref(d2+'CONTRACT_V2_4.md',n);
const metrics=key=>dir+'recheck-metrics.json:'+ (fs.readFileSync(dir+'recheck-metrics.json','utf8').split('\n').findIndex(l=>l.includes('"'+key+'"'))+1);
const changes=m.changes.map(c=>({...c,status:c.item==='M2506#40'?'unresolved':c.track==='B'&&c.item==='2022#33'?'unclear':'resolved',why:({
 'M2506#41':'개인 요인 중심과 은유 제목 대응·도입 표현 재사용 오답의 대조가 문항에 결속된다. E3 선택은 우선순위와 반대이며 단일 최선 TASK 인증은 아니다.',
 '2022#31':'진위 판단과 세부 정정 예시를 구별하는 근거 선택이 실제 선지에 대응한다. E2로 고른 이유는 문항 고유하다.',
 '2022#34':'확정성 환상 비판과 관점 증식의 구별이 실제 오답에 결속된다. E2 선택 근거는 있으나 유일한 주 TASK라고 확정하지 않는다.',
 '2022#40':'두 관점의 요약어 대응과 다른 쌍의 왜곡을 대조하는 이유가 실제 선지와 맞는다. E3/R5 우열의 Gold 인증은 아니다.',
 'M2506#31':'최종 정보 보존 결론과 매체 필요성 문장을 구별하는 설명이다. E2 선택은 고정 우선순위와 반대인 문항별 판단 흔적이다. 물리적 매체 필요가 오답을 문자적으로 함의하는 것은 아니다.',
 'M2506#32':'아이디어 생성의 종결 여부와 정의 표현을 재사용한 선지의 구별이 실제 있다. E3 이유는 단순 TASK 명칭 반복을 넘는다.',
 'M2506#40':'(A)의 긍정 의미에 해당하는 후보는 ①②⑤로 셋이다. (A) 근거 문장 선택만으로 정답 쌍이 결정되지 않고 (B)의 핵심성 판단이 ②를 가른다. E2 direct 가능성과 별개로, E2가 중심 압축보다 결정적이라는 새 primary_reason은 입증되지 않는다.',
 '2022#33':'규칙 결정 참여와 개인 책임/소유를 구별하는 문항 고유 이유는 있다. 그러나 개인 책임은 소유권을 함의하지 않으며 규칙 고안 명제는 한 문장에도 있다. 두 문장에 흩어진 근거 선택이 필수라는 주장과 E2/R5 우열은 unclear.'
 })[c.item],evidence:[p(c.track,c.chunk,c.item),source(c.item)]}));
const findings=[{
 id:'T0107-P1-01',severity:'P1',status:'unresolved',title:'D3가 D2의 v2.4 계약 검사를 우회한다',
 why:'d3-build.passed는 validateChunk/validateRow만 호출하며 validateV24·primaryReasonRepeats를 호출하지 않는다. v2.4로 선언한 같은 입력에서 primary_reason 제거(M2506#29), 이유 3행 복제, E2 고정표 위반(M2506#18)을 D2는 거부하지만 D3는 받아들인다. 이유 정상/E2 정상 대조군은 양쪽 모두 수용한다. b6는 v2.3여서 현재 165/198 전파 자체의 오류를 뜻하지 않지만 b7 v2.4를 D3로 넘기기 전에 고쳐야 한다.',
 evidence:[ref(code+'d3-build.mjs','function passed('),ref(code+'d3-build.mjs','if (!validateRow('),ref(code+'d2-run.mjs','function validateV24('),ref(code+'d2-run.mjs','ce.push(...primaryReasonRepeats'),metrics('v24tests')],
 action:'D2·D3가 같은 버전별 순수 검증 함수를 사용하게 하고 세 반례 및 정상 대조군을 두 경로에 적용한다. 입력 저장소 수정은 이 TASK 범위 밖이므로 수행하지 않았다.'
 },{
 id:'T0107-P2-01',severity:'P2',status:'unresolved',title:'B M2506#40의 주 TASK 선택 이유가 결정적 구별을 잘못 지목한다',why:changes.find(c=>c.item==='M2506#40').why,evidence:[p('B',2,'M2506#40'),p('A',2,'M2506#40'),source('M2506#40')],action:'(A)/(B)의 후보 제거 과정을 분리하여 primary를 재판정하거나 주 TASK 경계 미확정으로 남긴다.'
 }];
const acceptance=[
 {id:0,status:'unresolved',claim:'네 청크 주 TASK 재판정·우선순위·이유 고유성·8변경 원문 대조',why:'links는 80행 모두 불변. 우선순위 일치는 A1 18/20→18/20, A2 20/20→16/20, B1 18/20→16/20, B2 20/20→18/20. 모든 primary_reason 15자 이상이며 80행 완전 중복0, 청크별 3문항 이상 공유하는 15자 연속구0. direct 단일 공통 표지는 31/80(38.75%)이나 뒤의 결정 지점은 문항별이다. 의미상 템플릿 여부를 이 수치만으로 부정할 수 없다. 8변경 모두 R5보다 낮은 E2/E3로 가므로 고정 우선순위만으로 생성한 출력은 아니다. B 네 건 중 #31/#32는 문항별 이유 지지, #40은 이유 재판정 필요, 2022#33은 우열 unclear. 생성 과정의 독립성은 로그 부재로 unclear.',evidence:[metrics('chunks'),metrics('changes'),p('B',1,'M2506#31'),p('B',1,'M2506#32'),p('B',2,'M2506#40'),p('B',2,'2022#33')]},
 {id:1,status:'resolved',claim:'links 불변·.9375·κ .8907·32/40·경보·b2–b6 회귀',why:'225/240=.9375, κ=.8907203351243056, 주 TASK32/40. 안정5 경보 모두 ok. E2=.775/κ=.6703296703은 안정5 밖이며 낮은 수치를 숨기지 않는다. b2/b3/b4/b5/b6 D2·D3 A/B 각각40/8/40/38/40 수용, 기존18 secondary 반례와 반복5종도 기대대로 동작. b6 agree 산출4개가 @16561e875와 바이트 일치. 이는 현행 버전 구조 회귀 결함0이며 내용 오류0이나 v2.4 적격 인증은 아니다.',evidence:[metrics('regression'),metrics('d3Regression'),metrics('overall'),metrics('stop_alarm'),ref(d2+'b6-v23-agreement.json','"primary_task_agreement"')]},
 {id:2,status:'resolved',claim:'2022#38·2022#29 설명 정정 및 D3 전파',why:'2022#38의 ⑤는 마지막 재배치 문장 앞이다. A의 구조·가설·수행 요약·정답 이유 및 ③④ 오답 이유가 이에 맞게 정정됐다. 2022#29의 완전한 절은 전체 문장의 주어로 쓰이며 가주어를 가정하지 않는 정정이 맞다. D3 40행×양 트랙의 primary·수행 요약·구조·가설·정답 이유·오답 이유를 패킷과 대조하여 모두 일치. JSONL 직접 집계173→165/198, 오답 전체514/792 및 원문 적격502/780 불변.',evidence:[source('2022#38'),p('A',2,'2022#38'),source('2022#29'),p('A',2,'2022#29'),ref(d3+'item-reasoning.jsonl','"item_id":"2022#38"'),ref(d3+'item-reasoning.jsonl','"item_id":"2022#29"'),metrics('d3_totals'),metrics('d3_propagation')]},
 {id:3,status:'unresolved',claim:'v2.4 §1–§4 경계 해소·새 P0/P1·direct 집합 권고',why:'§1 전체 판단/순서 E2 표와 §1-1 낱말쌍 E3 분리는 규칙 선택의 공백을 문서 수준에서 좁힌다. §2는 동의 재진술를 허용하고 한 문장/복수 문장 기준을 제시하지만 M2506#33/#34의 명제 범위·비교 강도 보존을 실제 재판정하지 않았다. §3 이유는 고유성 증거이지 독립 절차 인증이 아니며 D3 검증 누락 P1이 있다. §4는 결정 대기이며 같은8문항 사후 일치 증가만으로 타당도를 검증할 수 없다. direct 집합은 임의 주 TASK 선택 의존을 줄이는 연구 후보로 타당하나 exact33/40·평균 Jaccard .9375이고 모든 공개 relevance가 unknown이므로 현 엔진 투입 승인은 부적절하다. 새 P0=0, 새 P1=1.',evidence:[contract('## 1.'),contract('## 1-1.'),contract('## 2.'),contract('## 3.'),contract('## 4.'),metrics('direct_sets'),...findings[0].evidence]},
 {id:4,status:'resolved',claim:'recheck.json·recheck.md 및 unclear 보존',why:'요구 산출·기준별 status·파일:줄·8변경·새 심각 결함·재현 스크립트·불확실성을 기록했다. 원문과 인용 패킷·전체 diff는 ignored *.local.json에만 보관한다. pass는 검증 수행 완료이며 데이터 전량 합격이 아니다.',evidence:[dir+'recheck.json:1',dir+'recheck.md:1',local+'recheck-calc.mjs:1',local+'write-recheck.mjs:1']}
];
const boundaries=[
 {section:'§1 / §1-1',status:'resolved',meaning:'문서 규칙의 선택 공백 해소',limitation:'v2.4 초안이며 b6 links를 소급 변경하거나 기존 미확정 링크를 Gold로 승격하지 않는다. E3 낱말쌍 이외의 부분 일치 오답 필요성도 실제 적용 후 확인해야 한다.'},
 {section:'§2',status:'unclear',meaning:'한 문장 재진술/복수 문장 결합을 구별하는 기준은 제시',limitation:'M2506#33은 정답의 전체 명제를 한 문장이 담는지, #34는 비교 강도까지 동등한지 여전히 미확정이다. 대상 두 문항의 새 판정이 없다.'},
 {section:'§3',status:'unresolved',meaning:'문항별 이유80개 추가·D2 존재/길이/완전 반복 검사',limitation:'3행 완전 일치만 감지하며 2행 반복·의미 템플릿·교차 청크 반복은 보장하지 않는다. D3는 해당 검사 자체를 하지 않는다.'},
 {section:'§4',status:'unresolved',meaning:'다중 direct 기준은 결정 대기',limitation:'같은8문항에 맞춘 일치 증가와 별도 미관측 문항의 타당도를 구별해야 한다. direct 집합도 오탐 direct·다중계상·부분집합 밖 수행을 해결하지 않는다.'}
];
const result={task_id:'T-0107',owner_id:'goal-data-independent',session:'t-0107-codex',source_commit:m.source_commit,base_commit:m.base_commit,observed_at:m.observed_at,review_completed:true,result:'pass',result_meaning:'검증 수행 완료; 내용 전량 수용·v2.4 봉인·엔진 투입 승인 아님',skip_count:0,covers:[0,1,2,3,4],source_read_only:true,db_access:false,acceptance,changes,boundaries,new_P0:[],new_P1:findings.filter(f=>f.severity==='P1'),other_findings:findings.filter(f=>f.severity!=='P1'),unclear_preserved:['링크·primary의 실제 생성 과정 및 독립성','M2506#33/#34의 R5/R6 재진술·통합·강도 경계','2022#33 E2/R5 우열 및 E3 direct/indirect','과거 b5 원천·복구 과정 및 제외 raw 유형 결속','E3 개선과 계약 변경의 인과·학생 학습효과','기존 b5의 갈림·V4 경계'],metrics_artifact:dir+'recheck-metrics.json',verification:{command:'node scripts/research/goal-data/review-b6/recheck-calc.mjs',assertions:'passed',raw_snapshot:local+'recheck-packets.local.json',diff_snapshot:local+'recheck-diff.local.json',outside_scope_unrun:['DB 접근·SQL 실행·제품 E2E·사람 Gold 검수','D5 외부 출처 사실 검증','로컬 main 통합·원격 push (독립 검증 제출 TASK)']}};
fs.writeFileSync(dir+'recheck.json',JSON.stringify(result,null,2)+'\n');
let md='# T-0107 b6-v23 정정·v2.4 초안 독립 재검증\n\n검증 수행 완료. 산술과 설명 정정은 확인됐지만 v2.4 봉인은 보류할 근거가 남았다. **새 P0 0건 · 새 P1 1건(D3 계약 검증 누락)**.\n\n';
md+=`owner goal-data-independent / session t-0107-codex. 첫 조회에서 IN_PROGRESS와 세션 일치. PID 조회 명령 없음. 입력 ${m.source_commit}, 기준 ${m.base_commit}. 로컬 패킷 관찰 ${m.observed_at}, 모든 재실행은 동일 스냅샷 재사용. 중앙 development_policy dev-minimal-20261020 확인. 다른 owner의 입력 worktree는 읽기 전용, DB 접근 없음.\n\n`;
md+='## 수용 기준별 판정\n\n';for(const a of acceptance)md+=`### ${a.id}. ${a.status} — ${a.claim}\n\n${a.why}\n\n${a.evidence.map(e=>'- '+e).join('\n')}\n\n`;
md+='## 우선순위 및 이유 반복\n\nR5 > R4 > E3 > E2 > R6 > E1 순서에서 direct 첫 항목을 예측했다.\n\n|청크|이전 일치|정정 후 일치|다중 direct 중 일치|완전 중복 이유|direct 단일 표지|\n|---|---:|---:|---:|---:|---:|\n';
for(const c of m.chunks)md+=`|${c.track}-${c.chunk}|${c.chunk===2?20:18}/20|${c.primary_matches}/20|${c.multi_matches}/${c.multi_direct}|0/20|${c.single_direct_label_rows}/20|\n`;
md+='\n공백 정규화·숫자 제거 후 80행 완전 중복도 0이다. 청크별 3문항 이상에 걸친 15자 연속구도 0이다. 필수 표지31/80을 문항 전체의 템플릿율이라고 해석하지 않는다. 의미상 반복의 자동 판정과 실제 생성 로그 인증은 별개이며 unclear다.\n\n## 변경 8건 원문 대조\n\n';
for(const c of changes)md+=`- **${c.track}-${c.chunk} ${c.item}: ${c.status}** (${c.old} → ${c.new}). ${c.why}\n  - ${c.evidence.join(' · ')}\n`;
md+='\n## 새 결함\n\n';for(const f of findings)md+=`- **${f.id} ${f.severity}: ${f.title} — ${f.status}**\n\n  ${f.why}\n\n  조치: ${f.action}\n\n  ${f.evidence.join(' · ')}\n\n`;
md+='v2.4 반례는 원본 실행 로직을 바꾸지 않고 FS·CLI만 메모리로 주입했다. 정상/변형의 같은 A행을 비교하며 다른 b6행의 v2.4 표 위반을 대상행 오류로 잘못 세지 않는다. 정상 reason/E2 대조군 모두 D2·D3 수용, 이유 누락/3행 복제/E2 위반은 D2 거부·D3 수용이다. 회귀 b2–b6는 각 배치의 기존 계약으로 검사했으므로 이 새 v2.4 결함과 구별한다.\n\n';
md+='## v2.4 경계와 direct 집합 권고\n\n';for(const b of boundaries)md+=`- **${b.section}: ${b.status}** — ${b.meaning}. ${b.limitation}\n`;
md+='\ndirect 집합은 주 TASK의 임의 선택 의존을 줄이는 연구 표현으로는 타당하다. 다만 두 트랙 direct 집합 exact33/40, 평균 Jaccard .9375는 타당도·학생 진단 효과가 아니다. 공개 링크 relevance=unknown·NeedRank 입력 금지 계약을 유지하고, 원천 권리·검수 상태·부분집합 밖 수행·미확정 링크·가중치/정규화 검증을 거쳐야 한다. 이 검증 TASK에서 엔진을 변경하거나 새 자격을 승인하지 않았다.\n\n';
md+='## diff 범위와 불확실성\n\n전체15파일 diff를 recheck-diff.local.json에 고정했다. D2·D3 변경은 기존 행과 필드별로 대조했다. 부수 D5 조사3파일·README·nonrelease SQL/러너도 읽기 검토했으나 T-0098 실행·D5 외부 사실 확인을 승인하거나 수행하지 않았다. D5는 official 칸0과 후보10을 유지하고, nonrelease 러너는 SQL SHA와 T-0098 사용자 승인값 일치를 요구한다. 이는 SQL의 실행 성공·권리 승격·보안 전면 검증을 뜻하지 않는다.\n\n';
md+=result.unclear_preserved.map(s=>'- **unclear 유지**: '+s).join('\n')+'\n\n';
md+='재현: `node scripts/research/goal-data/review-b6/recheck-calc.mjs` → `node scripts/research/goal-data/review-b6/write-recheck.mjs`. assertions 통과. 처음의 반례 대조군은 secondary_tasks를 함께 맞추지 않아 실패했으며, A행별 오류 필터와 유효 대조군을 고친 후 다시 통과했다. 신규 파일의 이전 커밋 조회에서 나오는 git path-not-in-revision 메시지는 예상한 추가파일 처리이며 최종 assertions 실패가 아니다. 원문·인용·전체 diff는 *.local.json에만 보존한다.\n\nskip_count=0은 요구 검증 수행 완료를 뜻한다. DB/SQL·제품 E2E·사람 검수·D5 외부 출처 확인·로컬 main/원격 통합은 범위 밖 미실행이며 통과가 아니다. Git add/commit 시도와 evidence/submit 실제 출력은 scripts/research/goal-data/review-b6/recheck-command-output.local.json에 보존한다.\n';
fs.writeFileSync(dir+'recheck.md',md);
console.log(JSON.stringify({task:result.task_id,acceptance:acceptance.map(a=>({id:a.id,status:a.status})),new_P0:0,new_P1:1,artifacts:[dir+'recheck.json',dir+'recheck.md']}));
