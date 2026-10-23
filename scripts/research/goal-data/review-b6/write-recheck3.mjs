// scripts/research/goal-data/review-b6/write-recheck3.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
const local='scripts/research/goal-data/review-b6/',dest='docs/research/goal-data-batches/review-b6/';
const load=n=>JSON.parse(fs.readFileSync(local+n+'.local.json','utf8'));
const m=load('recheck3-metrics'),p=load('recheck3-probes'),d=load('recheck3-detail');
assert.equal(p.check6.logs.length,6);assert.equal(d.mutations.length,6);assert.equal(d.agreementUnchanged,true);
const inputRoot='D:/workspace/Vocaflow-goal-data/';
const refs={validator:inputRoot+'scripts/research/goal-data/d2-validate.mjs:86',checks:inputRoot+'scripts/research/goal-data/d2-validate.check.mjs:12',d2:inputRoot+'scripts/research/goal-data/d2-run.mjs:32',d3:inputRoot+'scripts/research/goal-data/d3-build.mjs:49',source33:inputRoot+'scripts/research/goal-data/local/b6-v23/input.json:2156',source34:inputRoot+'scripts/research/goal-data/local/b6-v23/input.json:2303',a33:inputRoot+'scripts/research/goal-data/local/b6-v23/chunk-A-01.out.json:1716',b34:inputRoot+'scripts/research/goal-data/local/b6-v23/chunk-B-01.out.json:1912',link:inputRoot+'docs/research/goal-data-batches/D2-task-mapping/b6-v23-item-task-links.jsonl:41',combined:inputRoot+'docs/research/goal-data-batches/D2-task-mapping/item-task-links.jsonl:552',d3_33:inputRoot+'docs/research/goal-data-batches/D3-principles/item-reasoning.jsonl:173',d3_34:inputRoot+'docs/research/goal-data-batches/D3-principles/item-reasoning.jsonl:174',locus:inputRoot+'docs/research/goal-data-batches/D3-principles/principle-groups.json:40',contract:inputRoot+'docs/research/goal-data-batches/D2-task-mapping/CONTRACT_V2_4.md:27',recommendation:inputRoot+'docs/research/goal-data-batches/D2-task-mapping/CONTRACT_V2_4.md:36',extra:'scripts/research/goal-data/review-b6/recheck3-detail.mjs:25'};
const acceptance=[
 {index:0,status:'resolved',finding:'T-0108 P1 해소. 실제 direct 1개·primary 일치만 골격 예외. 공급 검사6/6, 기존6종 및 독자6종 반례/대조군을 D2·D3에서 재현. b2–b6 현행 계약 회귀 결함0.',evidence:[refs.validator,refs.checks,refs.d2,refs.d3,refs.extra]},
 {index:1,status:'unresolved',correction_status:'resolved',finding:'T-0108 P2의 지정 설명과 #33(A) E3 why 수정은 원문에 부합하고 D3 전파 완료. 링크 판정·primary·일치율·κ·R1·갈림 수는 불변. 다만 수치 전체 불변이라는 문자 그대로의 조건은 충족하지 않음: #34(B) 결정 위치 인용 변경으로 D3 same_decision_locus 97→96. 정당한 파생값 변경이며 새 P0/P1이 아니다.',evidence:[refs.source33,refs.source34,refs.a33,refs.b34,refs.link,refs.combined,refs.d3_33,refs.d3_34,refs.locus]},
 {index:2,status:'resolved',finding:'새 P0 0·P1 0. v2.4는 §4 결정 대기·연구 후보 표시를 유지하는 조건으로 봉인 가능. 본 검토는 입력을 수정하거나 실제 봉인하지 않는다.',evidence:[refs.validator,refs.contract,refs.recommendation,'docs/research/goal-data-batches/review-b6/recheck3.json:1']}
];
const result={task_id:'T-0109',owner_id:'goal-data-independent',session:'t-0109-codex',type:'review',result:'pass',result_meaning:'검증 수행 완료; 수용 기준 전량 충족이나 제품 적용 승인이 아님',skip_count:0,observed_at:m.observed_at,source_commit:m.source_commit,base_commit:m.base_commit,diff_sha256:m.diff_sha256,changed_files:m.diff_summary.map(x=>x.file),acceptance,prior_findings:[{id:'T0108-P1-01',status:'resolved'},{id:'T0108-P2-01',status:'resolved'}],new_P0:[],new_P1:[],seal:{allowed:true,condition:'§4 결정 대기와 연구 후보 표시 유지. 공개 relevance=unknown·NeedRank 입력 금지 유지',one_line:'v2.4 봉인 가능 — 새 P0/P1 없음; §4 결정 대기 유지, 동일 결정 위치 97→96 예외 명시.'},verification:{supplied_checks:6,independent_probes:6,previous_probes:6,regression:Object.fromEntries(Object.entries(m.d3Regression).map(([k,v])=>[k,{...v,defects:0}])),agreement:{n:m.overall.n,agree:m.overall.agree,ratio:m.overall.agreement,kappa:m.overall.kappa,primary:m.primary_agreement},counts:p.counts,d3_totals:m.d3_totals,same_decision_locus:{before:97,after:96},propagation_all_40:m.d3_propagation.every(x=>x.primary&&x.fields&&x.distractors),packet_hashes:m.packet_hashes},unclear:['A/B 생성 과정의 실제 독립성: 독립 세션 로그 없음','고친 §4 규칙의 미관측 b7 타당도·학생 효과','기존 2022#33 E2/R5 우열·E3 경계 및 b5 원천 복구 이력','direct 집합의 제품 관련도 사용 적격성'],not_run_out_of_scope:['DB/SQL 실행','제품 E2E','사람 검수·D5 외부 검증','입력 worktree 쓰기·봉인 실행','main/원격 통합'],raw_local_files:['recheck3-diff.local.json','recheck3-packets.local.json','recheck3-metrics.local.json','recheck3-probes.local.json','recheck3-detail.local.json','recheck3-command-output.local.json'].map(x=>local+x)};

const commandLog=local+'recheck3-command-output.local.json';
const commands=fs.existsSync(commandLog)?JSON.parse(fs.readFileSync(commandLog,'utf8')):[];
const gitAttempts=commands.filter(x=>x.command?.[0]==='git');
result.git={attempted:gitAttempts.length>0,committed:false,attempts:gitAttempts.map(x=>({action:x.command[1],exit_code:x.exit_code})),blocker:gitAttempts.length?'共有Git管理領域への書込権限なし':null,raw_output:commandLog};
if(gitAttempts.length)result.git.blocker='공유 Git 관리 영역 쓰기 권한 차단; add 실패로 새 파일 commit도 실패';
fs.writeFileSync(dest+'recheck3.json',JSON.stringify(result,null,2)+'\n');
const bullets=arr=>arr.map(x=>'- '+x).join('\n');
const md=`# T-0109 b6 3차 정정 독립 재검증

${result.seal.one_line}

owner goal-data-independent · session t-0109-codex. 첫 상태 조회가 IN_PROGRESS·세션 일치여서 추가 대기 불필요. PID 조회 명령 없음. 중앙 dev-minimal-20261020 확인. 입력 ${m.source_commit}, 기준 ${m.base_commit}. 패킷 관찰 ${m.observed_at}. 입력 worktree는 읽기 전용이며 DB 접근 없음.

검증 수행 완료(pass), skip_count=0. T-0108 P1·P2 정정은 resolved. 수용 기준1의 문자 그대로인 수치 전체 불변은 unresolved로 남긴다. 새 P0 0건·P1 0건.

## 수용 기준

${acceptance.map(a=>`### ${a.index}. ${a.status}\n\n${a.finding}\n\n${bullets(a.evidence)}`).join('\n\n')}

## 판단 근거

direct 단일의 접두사만 붙인 다중 direct 3행은 이제 양 경로에서 거부된다. 공급 검사 6/6을 고정 커밋 코드로 실행했다. 이전 완전 반복2행·골격3행·청크 경계·허위 단일·유효 단일·단일 접두사 완전 반복을 재실행했다. 독자 검사는 direct0·primary 불일치·동일 direct 링크 중복·탭 공백 접두사 다중 direct·실제 단일2행 완전 반복을 모두 거부하고, 실제 단일1행 대조군만 수용했다. V.row만으로 통과하는 경우에도 V.reasons와 D2 전체 트랙 및 D3 passed가 함께 거부한다. 의미적으로 맞는 이유임을 자동 인증하는 검사는 아니다.

b2/b3/b4/b5/b6는 각각40/8/40/38/40행을 A·B 및 D2·D3에서 수용, 결함0. 기존 secondary18반례·반복5종·v2.4 이유 누락/E2 대조도 재현했다. 이는 각 배치의 현행 계약 회귀이며 b6 전체를 v2.4로 소급 인증하지 않는다.

#33(A)는 제도에서 결정으로의 영향 방향과 앞부분 주관 경험·환경의 결합을 함께 사용한다. decision_path·answer_logic·passage_structure·design_hypothesis와 E3 why가 그 결합을 설명한다. #34(B)는 기본 지각의 상대적 일관성과 완전 균일성 부정·간헐적 차이를 합쳐 공통점 우위의 비교 판단을 만든다. 지정된 설명 정정은 원문과 양립하며 R6 후보를 지지한다. 강한 비교가 형식 논리만으로 필연 도출된다는 인증이나 출제 의도의 사실 확정은 아니다.

로컬 패킷 변경은 #33(A)5개 필드·#34(B)4개 필드뿐이다. 링크 배열은 #33(A) E3 why 문구만 달라졌다. 모든80행의 task_id/relevance와 primary가 이전 스냅샷과 동일하다. D2 개별·결합 E3 why는 각각41·552행에 반영됐고 D3 설명은173·174행에 전파됐다. D3 전체40행의 primary·설명·오답 전파도 일치한다.

산술은225/240=.9375, κ=${m.overall.kappa}→.8922, primary33/40. R1 b6 93·결합604, 갈림15·343. D3 primary166/198·왜곡514/792·원문502/780은 불변이다. 안정5 경보는 모두 ok이며 E2는 안정5 밖이다. 예외는 D3 same_decision_locus 97→96이다. #34(B)의 decision_path 인용 변경으로 A/B 위치 해시가 달라진 결과이며 198행에서96을 다시 셌다. 따라서 모든 수치가 불변이라는 문장은 그대로 승인할 수 없다.

8파일 전체 diff를 정독하고 JSONL 변경 필드를 분해 대조했다. D2 생성4파일은 시각을 고정한 메모리 재생성 결과가 커밋과 바이트 일치했다. D3 변경 설명·위치 해시·집계도 패킷과 대조했다. 원문과 명령 출력은 *.local.json에만 보존한다.

## 봉인 범위와 불확실성

§4 결정 대기는 유지한다. 같은8문항 시험과 문구 수정 뒤 b7 미관측을 구별하며, direct 집합 권고는 연구 후보다. 공개 relevance=unknown·NeedRank 입력 금지를 바꾸지 않는다. 새 P0/P1이 없어 이 범위에서 봉인은 가능하지만 실제 봉인·원본 수정은 수행하지 않았다.

${bullets(result.unclear.map(x=>'unclear: '+x))}

기존 #33(B) 및 일부 비대상 문구에는 재진술 표현이 남는다. 이번 지정된 A#33/B#34 정정과 구분하며 의미 경계의 연구 불확실성을 없앴다고 주장하지 않는다.

## 실행·제출

재현: node scripts/research/goal-data/review-b6/recheck3-probes.mjs → node scripts/research/goal-data/review-b6/recheck3-detail.mjs → node scripts/research/goal-data/review-b6/write-recheck3.mjs. assertions로 검증했다. 초기 보조 node -e의 PowerShell 인용 실패와 잘못된 로컬 상대 경로 읽기 실패는 올바른 파일 경로·스크립트로 교정했다. Git add/commit 시도 및 evidence·submit 원문은 recheck3-command-output.local.json에 기록한다.

${bullets(result.not_run_out_of_scope.map(x=>'범위 밖 미실행: '+x))}

미실행은 통과가 아니다. ${gitAttempts.length?'Git add(128)·commit(1) 시도 실패: 공유 Git 관리 영역 쓰기 권한이 차단됐다. 커밋·통합은 미완료이며 오류 원문은 recheck3-command-output.local.json에 보존했다.':'Git 시도 결과는 명령 로그에서 확인한다.'} 수용 기준1의 수치 불변 예외를 유지한다. pass는 검증 수행 완료를 뜻한다.
`;
fs.writeFileSync(dest+'recheck3.md',md);
assert.equal(result.acceptance.length,3);console.log('recheck3.json and recheck3.md written; acceptance 0 resolved, 1 unresolved (97→96), 2 resolved; seal conditional yes');
