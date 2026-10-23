// scripts/research/goal-data/review-b5/write-recheck.mjs
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const root='D:/workspace/Vocaflow-goal-data', rev='e81b759f1';
const dir='docs/research/goal-data-batches/review-b5/';
const doc='docs/research/goal-data-batches/D2-task-mapping/';
const result=JSON.parse(fs.readFileSync(dir+'recheck.json','utf8'));
const text=p=>execFileSync('git',['-c',`safe.directory=${root}`,'-C',root,'show',`${rev}:${p}`],{encoding:'utf8',maxBuffer:10*1024*1024});
const ref=(p,needle)=>{const n=text(p).split('\n').findIndex(l=>l.includes(needle))+1;if(!n)throw Error(needle);return `${root}/${p}:${n} (@${rev})`;};
const d2='scripts/research/goal-data/d2-run.mjs', d3='scripts/research/goal-data/d3-build.mjs', exp='scripts/research/goal-data/d2-export.mjs';
const contract=doc+'CONTRACT_V2_3.md';
result.review_result='performed_with_remaining_findings';
result.pass_semantics='Evidence result pass means verification performed, not all acceptance resolved or product approval.';
result.acceptance=[
 {index:0,status:'resolved',finding:'반박 2건은 정확한 트랙의 refuted_rationale로 결합본에 표시되고 DISPUTED/R0·unknown·candidateRelevance=null 유지. 다른 트랙 승격 없음. 결합기 메모리 재실행 결과 두 JSONL은 커밋과 바이트 단위 일치. R1 511·갈림 328 및 b5 210/228·κ .8594761171 불변.',evidence:[ref(doc+'b5-v22-corrections.json','"corrections"'),ref('scripts/research/goal-data/d2-combine.mjs','const withCorrection'),ref(doc+'disputed-links.jsonl','"refuted_rationale"'),ref(doc+'b5-v22-agreement.json','"agreement"')]},
 {index:1,status:'unresolved',finding:'기존 반례(v2.1, 유효 nonempty secondary) 차단 및 v2.2/v2.3 정상 null 허용은 해결. direct 존재·부분 집합 없음도 차단. 그러나 secondary_tasks 누락/null은 []로 간주되어 D2·D3 양쪽에서 통과한다. 계약의 명시 secondary_tasks=[]를 엄밀히 보장하지 못한다(P2-01). b2–b5 D2·D3 A/B 각각 40·8·40·38 통과, 현재 패킷 회귀 결함 0.',evidence:[ref(d2,'const noDirect'),ref(d3,'const noDirect'),ref(doc+'CONTRACT_V2_2.md','secondary_tasks: []')]},
 {index:2,status:'unclear',finding:'§1은 청크 내부 primary와 문항 실제 주 수행을 구분해 §1/§4 운용 의미를 해소. §4는 R3 한 문장 기능과 R4 다문장 배열을 명시, §5는 다른 후보에 특정 오답 결속을 요구, §6은 원문 근거와 명시/비명시를 명시한다. §2·§3은 E3 결정/보조 및 R5/R6 경계의 진전이나, V4 고유 수행과 E3 비교의 분리는 직접 규정하지 않으며 M2509#31의 의미 대응을 별도 결정 단계로 볼지까지 독립 확정하지 않는다. direct의 별도 필요와 indirect의 먼저 정해짐은 원문 경로 판단을 여전히 요구한다. 문서 보완을 과거 갈림 6의 자동 해소로 삼지 않고 unclear 유지. 새로운 필연적 모순 또는 새 P0/P1은 확인하지 못했다.',evidence:[1,2,3,4,5,6].map(n=>ref(contract,`## ${n}.`))},
 {index:3,status:'resolved',finding:'앞으로 내보내는 제외 행의 snapshot·excluded_raw 및 해시 저장 구현 확인. 커밋 코드의 메모리 exporter 실행에서 도표·choices 결손·없는 문항을 재현했고 실제 b6 제외 1행도 source/passsage 해시 일치. 원문 type_id가 excluded_raw에 없어 유형의 독립 재계산에는 한계(P2-02). b5 동결 파일에는 당시 excluded_raw가 없어 2행의 과거 원천 상태는 unclear 유지. 변경된 계약·정정·결합본에 E2/E1 인과 개선 확정 주장은 없음. 규칙의 인과 효과 자체는 unclear.',evidence:[ref(exp,'const snapshotOf'),ref(exp,'const excludedRaw'),ref(exp,'rows, excluded_raw'),ref(doc+'b6-v23-selection.json','"snapshot"'),ref(contract,'> 근거:')]},
 {index:4,status:'resolved',finding:'recheck.json·recheck.md 및 재현 스크립트 작성. 원문 포함 전체 diff는 ignored diff.local.json에만 저장. 이전 8 unclear 및 두 반박의 대체 판정 unknown 유지. 검증 완료와 미해결 판정을 구분.',evidence:[dir+'recheck.json:1','scripts/research/goal-data/review-b5/recheck.mjs:1','scripts/research/goal-data/review-b5/.gitignore:1']}
];
result.contract_sections=[
 {section:1,status:'resolved',note:'primary는 청크 내부 최선 direct. outside_subset boolean은 실제 주 수행이 범위 밖임을 별도 기록. b5는 동결되어 v2.3 필드 소급 요구 없음.'},
 {section:2,status:'unclear',note:'E3 direct/indirect/NA 조건 신설과 추론 흡수만으로 배제 금지는 개선. V4와의 역할 경계 및 동일 문항에서 별도 결정의 필요성 판정은 원문별 검토 필요. b5 6갈림을 재판정하거나 승격하지 않음.'},
 {section:3,status:'resolved',note:'기진술 재진술 vs 근거로부터 도출 기준을 명시. 연결의 비명시 여부는 개별 문항 증거로 남음. 2023#31 기존 unclear 유지.'},
 {section:4,status:'resolved',note:'R3 단일 기능과 R4 복수 배열을 구분. 2023#22 A는 배열 전체도 주장하므로 규칙 추가만으로 기존 A/B 승자를 정하지 않음.'},
 {section:5,status:'resolved',note:'다른 후보 문장→특정 오답 결속 요구. 여러 정답 근거가 흩어진 경로는 v2.2 규칙을 계속 적용. 2023#34 B direct 자동 확정 없음.'},
 {section:6,status:'resolved',note:'2023#34의 오류는 선지에 용어가 존재한다는 사실 자체가 아니라 본문 앞쪽에 있다는 잘못된 위치 전제. 정정 note는 이를 정확히 명시. M2509#19는 명시 정서 근거 누락을 지적.'}
].map(r=>({...r,evidence:[ref(contract,`## ${r.section}.`)]}));
result.new_P0_P1=[];
result.findings=[
 {id:'P2-01',priority:'P2',status:'unresolved',title:'primary-null 면제에서 secondary 배열 누락/null도 통과',impact:'내용상 비어 있는 보조 TASK라 현재 R1/κ 오염은 관측되지 않으나 계약상 [] 스키마 보장은 실패. v2.2/v2.3 × missing/null 4반례가 양쪽 통과.',recommendation:'Array.isArray(secondary_tasks) && secondary_tasks.length === 0으로 면제 조건을 고정하고 누락/null 반례를 유지한다.',evidence:[ref(d2,'const noDirect'),ref(d3,'const noDirect')]},
 {id:'P2-02',priority:'P2',status:'unclear',title:'제외 raw에는 type_id가 없어 도표 유형을 raw에서 재계산할 수 없음',impact:'원문/선지/정답 SHA 및 공개 snapshot 유형은 저장되지만 raw에서 유형은 독립 복원 불가. body_ok도 source_sha256의 대상 밖이다. 현재 도표 분류가 틀렸다는 판정은 아님.',recommendation:'향후 excluded_raw에 type_id 및 제외 판단에 필요한 메타데이터도 보존하고 메타데이터 포함 해시를 별도로 결속한다.',evidence:[ref(exp,'const snapshotOf'),ref(exp,'const excludedRaw')]}
];
const prior=JSON.parse(fs.readFileSync(dir+'verdict.json','utf8'));
result.preserved_unclear=prior.item_reviews.filter(r=>r.verdict==='unclear').map(r=>({item:r.item_id,task:r.task,status:'unclear',product_relevance:'unknown',evidence:r.evidence}));
result.remaining_unclear=['b5 제외 2행의 내보내기 당시 원천 상태','E3 갈림 6 및 원문별 R5/R6·R3/R4 경계','2023#34 B 대체 라벨','E2/E1 규칙 개선의 인과 효과','사람 Gold·학생 측정·권리·실제 세션 상호 독립성'];
result.outside_scope_not_run=['DB 접근·쓰기','PDF/인쇄본 직접 대조','동일 표본 규칙 변경 인과 실험','제품 E2E·학생 능력 타당도 검증'];
result.scope_note='위 항목은 검증 필수 실행의 skip이 아니라 범위 밖 또는 증거 한계다. skip_count=0은 unresolved/unclear를 pass로 바꾸지 않는다. b6 판정 산출물은 읽거나 수정하지 않았다. b6 선정 및 제외 raw 1행만 스냅샷 구현 확인에 사용했다.';
result.method='전체 git diff를 ignored *.local.json에 보존하고 10파일을 읽음. 큰 결합 JSONL은 모든 행/모든 필드의 before/after를 전량 비교함. 변화는 contract 라벨 101개(v2.1→v2.2), refuted_rationale 2개 및 coverage 생성시각뿐. 계약/코드는 git show @e81b759f1로 고정. local 패킷은 읽기 전용. D2 validate·D3 passed 및 combine/export를 메모리에서 실행; 파일 쓰기와 fetch는 메모리 대체. source 코드 검증 로직은 변경하지 않음. safe.directory는 이 읽기 명령에만 -c로 지정하며 전역 설정/원본 worktree 쓰기 없음.';
fs.writeFileSync(dir+'recheck.json',JSON.stringify(result,null,2)+'\n');
const rlines=fs.readFileSync(dir+'recheck.json','utf8').split('\n');
const rref=needle=>dir+'recheck.json:'+(rlines.findIndex(l=>l.includes(needle))+1);
const lines=['# T-0104 b5-v22 보완 독립 재검증','',`입력: ${result.source_commit} (기준 ${result.base_commit}). owner goal-data-independent / session t-0104-codex. 첫 task show에서 IN_PROGRESS·세션 일치 확인. PID/프로세스 조회 없음. 입력 worktree 쓰기·DB 접근 없음.`, '', '**판정: 검증 수행 완료. 기존 보완은 대부분 재현되며 primary-null의 엄밀한 배열 조건은 미해결, E3/V4 및 과거 제외 원천 상태는 unclear 유지. 새 P0/P1 없음.**', '',result.method,'','## 수용 기준', '', ...result.acceptance.flatMap(a=>[`### ${a.index}. ${a.status}`,'',a.finding,'',...a.evidence.map(e=>`- ${e}`),'']), '## 재계산·반례','', 'D2·D3 b2/b3/b4/b5 A/B 각각 40/8/40/38 전부 통과(현재 패킷 회귀 결함 0). 결합 재생성 R1 511·갈림 328이며 두 JSONL이 커밋과 정확히 같다. b5 210/228 = .9210526316, κ=.8594761171(보고 .8595) 불변. 모든 결합 링크 relevance=unknown.','', '| TASK | 일치 | κ |','|---|---:|---:|',...Object.entries(result.b5.per_task).map(([t,v])=>`| ${t} | ${v.agree}/${v.pairs} | ${v.kappa.toFixed(9)} |`),'', '18 반례(3계약 × 6조건)를 D2·D3에 각각 실행. v2.1 모두 거절, v2.2/v2.3 정상 []만 허용되어야 하지만 누락/null도 허용된다. nonempty secondary·direct 존재·부분 집합 없음은 거절. v2.3 boolean은 다른 행에도 주입해 대상 결함을 다른 필드 오류로 가리지 않았다. no_subset 반례에는 full-task 누락 오류도 있으나 primary null 오류가 함께 존재한다.','',`실행: node scripts/research/goal-data/review-b5/recheck.mjs. 증거: ${rref('"counterexamples"')}, ${rref('"d3_regression"')}, ${rref('"recombined"')}. observed-defect assertion 통과는 결함 해결을 뜻하지 않는다.`, '', '## 계약 §1–§6', '',...result.contract_sections.flatMap(s=>[`- §${s.section} **${s.status}**: ${s.note} 근거 ${s.evidence.join(', ')}`]), '', '## 새 발견 및 유지할 공백','',...result.findings.flatMap(f=>[`- **${f.id} ${f.priority} / ${f.status}** — ${f.title}. ${f.impact} ${f.recommendation} 근거 ${f.evidence.join(', ')}`]),'', '**새 P0/P1: 없음.** E3 경계는 규칙 보완을 확인한 상태이며 독립적인 과거 갈림의 해소/타당도까지 확정하지 않는다. 이전 unclear 8건은 승격하지 않았다. 두 반박의 대체 라벨도 unknown이다.','',...result.remaining_unclear.map(s=>`- unclear: ${s}`),'', '제외 스냅샷 구현은 향후 저장 보완으로 확인했다. synthetic 2행 및 실제 b6 제외 1행의 source/passage 해시가 일치한다. b5의 원천 결손은 과거 raw가 없으므로 소급 확정하지 않는다. 정정·계약·결합 변경은 인과 효과 실험이 아니며 개선 수치에서 인과를 주장하지 않는다.','',result.scope_note,'', '## 마무리','', '검증 evidence의 result=pass는 검증 수행 완료를 뜻한다. task complete/제품 승인은 주장하지 않는다. Git add/commit 및 evidence/submit 출력 원문은 recheck.md 아래에 기록한다.',''];
fs.writeFileSync(dir+'recheck.md',lines.join('\n'));
console.log(JSON.stringify({acceptance:result.acceptance.map(a=>({index:a.index,status:a.status})),new_P0_P1:result.new_P0_P1,findings:result.findings.map(f=>({id:f.id,priority:f.priority,status:f.status})),artifacts:[dir+'recheck.json',dir+'recheck.md']},null,2));
