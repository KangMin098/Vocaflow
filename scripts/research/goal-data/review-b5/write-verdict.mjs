// scripts/research/goal-data/review-b5/write-verdict.mjs
import fs from 'node:fs';
import path from 'node:path';
const source='D:/workspace/Vocaflow-goal-data';
const target='docs/research/goal-data-batches/review-b5';
const samples=JSON.parse(fs.readFileSync('scripts/research/goal-data/review-b5/sample.local.json','utf8'));
const rec=JSON.parse(fs.readFileSync(`${target}/recalculation.json`,'utf8'));
const d='docs/research/goal-data-batches/D2-task-mapping/';
const loc=(file,needle,root=source)=>{const n=fs.readFileSync(path.join(root,file),'utf8').split('\n').findIndex(l=>l.includes(needle));if(n<0)throw Error(`${file}: missing ${needle}`);return `${file}:${n+1}`;};
const evidence=(needle)=>loc(`${target}/recalculation.json`,needle,process.cwd());
const decisions=[
 ['confirmed','연구용 R4 direct 후보: 협상 방법의 열거에서 시간 지평의 부연을 해당 방법 뒤·새 방법 앞에 배치한다. 첫 문장/나머지 본문 분리와 정답 ④의 배열을 로컬 원문으로 확인. 개별 TASK 측정 자격은 부여하지 않는다.'],
 ['confirmed','연구용 R4 direct 후보: 자기/대상 구별 조건 뒤에 실패 결과를 두고 마지막 결과 부연과 이어야 하므로 ⑤. 첫 문장의 조건 부정이 가리키는 선행 조건과 후속 결과를 대조했다. 삽입 묶음 관찰로 한정.'],
 ['confirmed','연구용 R4 direct 후보: 예측을 요구하는 관리 논리→예측 불가능한 현실→불확실성 예시의 전환 배열로 ④. 첫 문장 분리는 내용상 일관되고 삽입 격리도 유지된다. 인쇄본 박스/PDF 직접 대조까지 확인한 것은 아니다.'],
 ['confirmed','v2.2 §4 기준 E1 direct 후보: 어법의 옳은 위치가 아닌 틀린 위치를 고르는 부정 요구가 실제 발문에 있다. 어법 고유 수행의 direct/숙달을 확인한 것은 아니다.'],
 ['confirmed','E1 indirect 후보: 두 빈칸 중 첫 조건만 충족하는 실제 오답 ②가 존재하고 둘째 조건은 본문 장애 요인과 반대다. A/B choice 반사실이 원문·선지와 맞는다.'],
 ['confirmed','E1 direct 후보: 부정 일치 발문 확인. 정답 ②는 미국 이주 시기와 교육 시작 시기를 혼동하고 나머지는 본문과 부합한다.'],
 ['confirmed','E1 direct 후보: 부정 일치 발문과 부정형 정답 ③을 확인. 안내문의 무료 제공 사실과 정답의 부정이 충돌한다.'],
 ['confirmed','v2.2 §4 기준 E1 direct 후보: 부정 어법 발문 확인. 정답 ⑤의 관계사 뒤 구조는 다른 밑줄들과 구별된다. 범위 밖 문법 TASK까지 측정했다고 해석하지 않는다.'],
 ['confirmed','v2.2 §4 기준 E1 direct 후보: 부정 어휘 발문 확인. 마지막 낱말이 앞의 비합리적 사고 설명과 반대인 것이 정답 ⑤다. V1/V4 고유 수행 판정은 이번 부분 집합 밖이다.'],
 ['confirmed','E1 direct 후보: 전체 흐름에서 이탈한 문장을 고르라는 예외 요구가 명시돼 있다. 일반적 구매 서비스로 이동한 ④와 나머지 수집망 활용 전개를 대조했다.'],
 ['unclear','A의 오답 ① 유인은 본문의 창의적 인물/선지 예술가 대응으로 원문에 결속된다. B의 추론에 흡수된다는 이유만으로 모든 합리적 E3 경로를 배제할 수 없다. E3의 고유 대응과 R6/V4의 중복 경계가 미정이므로 A의 indirect 확정도 보류.'],
 ['unclear','A의 감소만 보는 오답 ③ 반사실은 실제 증감 양쪽 사례와 결속된다. B의 일반화에 흡수된다는 단정은 배제 근거가 부족하다. 부분 대응을 E3 고유 수행으로 셀지 규칙이 없어 unknown 유지.'],
 ['unclear','A의 한 단어 선지라는 배제 이유는 충분하지 않다. B의 의미 대응은 원문과 맞지만 문맥 어휘 V4·추론 R6와 독립적으로 E3 direct인지 결정할 규칙이 없다. 단어 선지 일반 배제와 E3 자동 direct 모두 수용하지 않는다.'],
 ['unclear','A의 오답 ⑤는 실제 투자 방향과 부정 보장 틀의 혼동에 결속된다. B의 정답 대응도 내용상 가능하다. 같은 합리적 경로에서 왜 결정적인지/보조적인지를 가르는 E3/V4·R6 기준이 v2.2에 없어 direct/indirect 보류.'],
 ['unclear','A의 광장 점유 장면을 이유로 오독하는 반사실과 B의 머물고 싶은 환경에 대한 대응은 모두 원문에서 설명 가능하다. 고유 E3가 결정적인지 보조인지 별도 경계가 없어 하나를 확정하지 않는다.'],
 ['unclear','A의 문학 작품·자족을 묶은 오답 ②와 B의 정서적 관계 형성 대응은 원문에 결속된다. 대조 추론 R6/문맥 어휘 V4와 E3의 역할 분리가 없어 direct/indirect 미확정.'],
 ['unclear','A의 마지막 정책 문장을 중심으로 오인해 ⑤로 가는 경로는 가능하다. 다만 한 문장 기능 R3 오독인지 여러 문장 배열 R4인지 추가 증거가 필요하다. B가 주장한 특정 오답 경로 부재도 단정할 수 없다.'],
 ['unclear','빈칸의 직업적 존중/보수 대비는 원문에서 확인된다. A가 보수를 중심으로 오인한다고 썼지만 높은 보수라는 명시 내용에서 적은 보수 오답으로 가는 과정이 충분하지 않다. R5 중심 압축이 별도 수행인지 R6 국소 대비인지 보류.'],
 ['refuted','A가 전제한 앞의 과학·증거 화제는 본문에 없다(과학 증거는 선지 ②에만 등장). A의 특정 반사실 설명을 반박한다. B는 앞 책임 가림 문장과 바로 뒤 정정 문장을 골랐으나, 복수 근거 탐색이 필요한지 인접 문장으로 충분한지 계약 §2 경계가 남아 B direct는 unclear. 대체 라벨 unknown.'],
 ['refuted','B의 숨은 정서 추론 필요 주장을 반박한다. 앞의 걱정과 뒤의 편안함은 본문에 직접 명시돼 있고 한숨의 숨은 의미가 필요한 경로라는 설명은 명시 근거를 누락했다. 이 설명으로 R6 indirect를 확정할 수 없다. A의 명시 정서 대응 경로는 지지되지만 학습자 추론 능력 판정은 아님.'],
];
const item_reviews=samples.map((s,i)=>({kind:i<10?'R1_candidate':'disputed',item_id:s.sample.item,task:s.sample.task,judgments:s.sample.judgments,verdict:decisions[i][0],evidence:s.evidence.map(e=>`${source}/${e}`),note:decisions[i][1],product_relevance:'unknown'}));
const checks=[
 {id:'selection_and_hashes',verdict:'confirmed',evidence:[evidence('"total": 38'),evidence('"selection_order_matches": true'),evidence('"chunk_binding"')],note:'예정 ID 40개에서 기록된 제외 2개를 뺀 38개의 순서·중복0·M2509=27/2023=11을 재현. 38개 전부 UTF-8 passage hash와 source JSON hash·selection 결속·analysis hash를 재계산. A/B 각각 20+18, 6 TASK, 원문 source 일치.'},
 {id:'excluded_original_facts',verdict:'unclear',evidence:[`${source}/${loc(d+'b5-v22-selection.json','"excluded"')}`,evidence('"excluded_raw_rows_available": false')],note:'제외 목록은 M2509#25 도표 미결속·2023#38 choices 없음. 로컬 input/chunk에는 제외 2행의 export 당시 raw snapshot이 없어 두 원천 상태를 독립 재계산할 수 없다. T-0100도 DB 상태를 unclear로 남겼다. 선택 산술/코드와 제외 사실 독립 확정을 구분한다. DB 접근 없음.'},
 {id:'insertion_split_and_isolation',verdict:'confirmed',evidence:[evidence('"insertion_isolation": true'),...item_reviews.slice(0,3).flatMap(r=>r.evidence)],note:'삽입 3문항 given/body가 원문의 서로 다른 연속 부분이고 재분리와 일치. 내용·배열상 첫 문장 경계 확인. A/B E2 unknown·독립평가 not_suitable 유지. PDF 박스 및 215개 first_sentence 전체의 정확성은 미검증.'},
 {id:'legacy_regression',verdict:'confirmed',evidence:[evidence('"validation"'),evidence('"legacy_subset_flags"')],note:'새 d2-run의 validate 경로를 실제 pilot-lib와 로컬 패킷으로 실행. b2 40/40, b3 8/8, b4 40/40 A/B 모두 결함0. 기존 패킷은 tasks 미설정이므로 primary null 면제가 적용되지 않는다. import/CLI만 주입하고 validate 로직은 변경하지 않음.'},
 {id:'primary_null_scope_complete',verdict:'refuted',evidence:[`${source}/${loc('scripts/research/goal-data/d2-run.mjs','const noDirect')}`,evidence('"validator_counterexamples"')],note:'면제는 contract v2.2가 아니라 input.tasks 존재에 결속된다. 메모리 반례에서 contract v2.1+tasks+primary=null도 통과했고, v2.2 §1이 secondary=[]를 요구하는데 비어 있지 않은 유효 indirect 보조 TASK도 통과했다. 실제 b5 primary=null은 0건이므로 현재 수치 오염과 향후 검증기 결함은 구분한다.'},
 {id:'agreement_and_alarm',verdict:'confirmed',evidence:[evidence('"overall"'),evidence('"alarms"')],note:'210/228=.9210526316, κ=.8594761171(파일 4자리 .8595; 근사 .860). TASK별 분모38와 4범주 A/B 분포 및 κ를 독립 재계산. 안정5 모두 ok. E2 κ=.956422이지만 삽입 unknown 3쌍 포함, 별도 학생 타당도 합격 아님.'},
 {id:'causal_improvement',verdict:'unclear',evidence:[evidence('"e.task_demand"'),evidence('"e.evidence_location"'),`${source}/${loc(d+'CONTRACT_V2_2.md','## 2.')}`],note:'E2 .4106→.9564 및 E1 1.0은 관측. 표본·TASK 범위·규칙이 함께 달라졌고 같은 표본의 통제 A/B 규칙 재판정이 아니다. 규칙 개선의 인과 효과로 승격하지 않는다.'},
 {id:'contract_1_4_boundary',verdict:'unclear',evidence:[`${source}/${loc(d+'CONTRACT_V2_2.md','## 1.')}`,`${source}/${loc(d+'CONTRACT_V2_2.md','## 4.')}`,evidence('"primary_null": []')],note:'§1은 청크에 direct가 없을 때만 null을 허용하므로 §4에서 E1 direct가 있으면 null 금지라는 문언 해석은 가능하다. 따라서 형식 논리의 필연적 모순으로 확정하지 않는다. 하지만 §1의 어법·어휘 결정이 범위 밖이라는 예시와 §4의 부정 발문 direct가 같은 문항에서 충돌하는 운용 경계는 남는다. 실제 어법 문항은 E1을 primary로 출력한다. 부분 집합 primary가 문항의 실제 주 수행을 뜻하는지 명시 필요.'},
 {id:'e3_v4_rule_gap',verdict:'confirmed',evidence:[`${source}/${loc(d+'CONTRACT_V2_2.md','## 2.')}`, ...item_reviews.slice(10,16).flatMap(r=>r.evidence)],note:'v2.2는 E2·삽입·E1·부분 집합을 다루지만 T-0100이 요구한 E3/V4 경계를 추가하지 않았다. 갈림6의 단어/절 대응을 어휘·추론·선지 대응 중 어디로 볼지 미확정. 다음 배치 전 보완 필요.'},
 {id:'no_automatic_ai_approval',verdict:'confirmed',evidence:[evidence('"ai_links"'),`${source}/${loc('scripts/research/goal-data/d2-run.mjs',"relevance: 'unknown'")}`],note:'커밋 산출의 후보83·갈림18 모두 relevance=unknown. status AI_PROPOSED와 삽입 격리 확인. B 입력에는 prior 분석·traps 없음. 실제 실행 세션의 상호 독립성/사람 Gold/권리/제품 소비 필터 전체는 이 로컬 데이터만으로 인증하지 않는다.'},
];
const counts=list=>Object.fromEntries(['confirmed','refuted','unclear'].map(v=>[v,list.filter(r=>r.verdict===v).length]));
const verdict={task_id:'T-0103',owner:'goal-data-independent',source_commit:'7ad98fda08f3739a14bcff1c41273968f7fe2fa6',protocol:'read-only local packets; recompute.mjs; 20 original-text comparisons; in-memory validator counterexamples',overall_verdict:'refuted',note:'검증 수행 완료. 무조건 다음 배치 진행/품질 합격 주장을 수용하지 않음. 반박 수정·영향 재검증과 경계 보완 전 보류. 검증 프로토콜 pass와 데이터 품질 pass를 구분한다.',scope_checks:checks,item_reviews,counts:{scope:counts(checks),items:counts(item_reviews)},not_run:['DB query or write','PDF/인쇄본 박스 대조','제외 2행 당시 raw snapshot 독립 재현','동일 표본 규칙 변경 인과 실험','제품 E2E·권리·사람 Gold 검수'],commit_attempt:'별도 command-output.txt에 원문 기록'};
fs.writeFileSync(`${target}/verdict.json`,JSON.stringify(verdict,null,2)+'\n');
const lines=['# T-0103 b5-v22 독립 검증','',`입력: ${verdict.source_commit}. owner goal-data-independent / session t0103-codex. 첫 task show에서 IN_PROGRESS·세션 일치를 확인했다. 프로세스/PID 조회 없음. DB 접근 없음. 입력 워크트리 수정 없음.`,'','**판정: 보완 후 재검증 필요.** 산술·현재 구조 검증은 재현되지만 제외 2행 원천 상태는 독립 확정 불가, 검증기 범위 결함과 원문 설명 반박이 남는다. unclear는 confirmed로 올리지 않았다.','',`표본 20건: ${JSON.stringify(verdict.counts.items)}. 아래 confirmed는 계약상 연구 후보 지지를 뜻하며 사람 검수/권리/학생 능력 측정 승인이 아니다.`,'','## 재계산','', '실행: `node scripts/research/goal-data/review-b5/recompute.mjs`. 입력 read-only, 원문은 `sample.local.json`에만 보관하고 경로 내 `.gitignore`로 제외. d2-run import/ROOT/CLI를 주입해 validate 경로를 실행했으며 agree/export(쓰기/DB)는 실행하지 않았다. 원본 두 코드의 4673e15ac→7ad98fda0 diff는 code-diff.txt에 보관. Node 자식 Git은 소유권 오류로 실패했고 예외 설정 없이 제거했다. shell Git 읽기 결과로 커밋 및 diff를 확인했다.','', '| TASK | 일치 | κ | 중단 경보 |','|---|---:|---:|---|',...Object.entries(rec.per_task).map(([t,s])=>`| ${t} | ${s.agree}/${s.n} | ${s.kappa.toFixed(6)} | ${rec.alarms[t]??'E2 보정 연구'} |`),'','전체 210/228=.921052632, κ=.859476117. 기존 b2/b3/b4는 A/B 각각 40/40·8/8·40/40, b5 38/38, 모두 구조 결함0. 안정5 경보 모두 ok지만 아래 반박/공백을 무효화하지 않는다. E2/E1 인과 개선은 unclear.','', '## 범위·계약 판정','',...checks.map(c=>`- **${c.id}: ${c.verdict}** — ${c.note} 근거: ${c.evidence.join(', ')}.`),'','## 원문 표본 20건','',...item_reviews.map(r=>`- **${r.item_id} / ${r.task}: ${r.verdict}** (${r.kind}; A=${r.judgments.A}, B=${r.judgments.B}) — ${r.note} 근거: ${r.evidence.join(', ')}.`),'','## 다음 단계와 한계','', '원 담당자가 반박 2건의 설명/라벨을 정정하고 영향 수치를 재검증해야 한다. E3/V4·R3/R4·E2 탐색 경계와 §1/§4 주 수행 의미를 보완하고, primary-null의 버전 결속 및 secondary=[] 검사를 추가해야 한다. 제외 2행의 당시 원천 스냅샷을 봉인해 재대조하기 전 제외 사실을 confirmed로 올리지 않는다. 같은 표본에 대한 E2 규칙 전후 대조 없이 인과 개선을 주장하지 않는다.','', '원문 인용은 커밋 파일에 없음. DB·제품 코드·원 D2 산출물 변경 없음. 제품 lint/typecheck/E2E는 연구 전용 변경 범위상 미실행이며 통과로 보고하지 않는다. 최종 Git·evidence·submit 명령 출력은 command-output.txt와 사용자 보고에 기록한다.',''];
fs.writeFileSync(`${target}/review.md`,lines.join('\n'));
console.log(JSON.stringify(verdict.counts));

