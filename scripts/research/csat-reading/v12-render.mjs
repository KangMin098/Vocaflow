// scripts/research/csat-reading/v12-render.mjs
// Render the review ledger without elevating pedagogical design to observed efficacy.
import fs from 'node:fs'
const base='docs/research/csat-reading/',dir=base+'data/v12/',read=p=>JSON.parse(fs.readFileSync(p,'utf8'))
const x=read(dir+'task-relation-review.json'),codebook=read('docs/csat-learner/v4/codebook.json')
if(x.tasks.length!==30||x.relations.length!==34||x.pair_audits.length!==7||x.tasks.some(t=>!codebook.tasks.some(c=>c.id===t.id)))throw Error('Review denominator or permanent ID drift')
const write=(file,lines)=>fs.writeFileSync(base+file,`<!-- ${base+file} -->\n`+lines.join('\n')+'\n')
const cases=xs=>xs.map(c=>`${c.item}: ${c.why} (${c.source_ref}; ${c.relevance||'L'})`).join(' / ')||'읽기 자료에서 지지 사례 미확보'
const scalar=x=>typeof x==='string'?x:JSON.stringify(x)
const rubricLines=r=>Array.isArray(r)?r.map(s=>`- ${s}`):[
 `평가 차원: ${r.dimensions?.join(' / ')||'개별 프로필 정의'}`,'',
 ...(r.levels||[]).map(l=>`- ${l.level}: ${l.description}`),'',r.scope||'',r.separate_axes||''
]
const E=['# E. TASK 구조·관계 감사','',`2026-10-14 · [정본 원장](./data/v12/task-relation-review.json). 원천 rev4 영구ID 유지.21비보류=18원자후보+3통합관찰, hold9=L4+X5. 단일 AI의 원문 결속 논리 감사이며 심리측정 독립성·학생 효과 검증은 아니다.`,``,`## TASK30 판정`,``,`| TASK | 영구ID | 종류/기존상태 | 연구판정 | 근거와 제한 |`,`|---|---|---|---|---|`]
for(const t of x.tasks)E.push(`| ${t.display} | ${t.id} | ${t.kind}/${t.status} | ${t.independence_verdict} | ${t.atomic_vs_integrated_limit.replace(/\|/g,'/')} |`)
E.push('','## 특히 구별해야 할7쌍','')
for(const p of x.pair_audits)E.push(`### ${p.id}: ${p.verdict}`,'',p.distinction,'',`근거: ${cases(p.cases)}`,'',`반례/중복: ${p.counter}`,'',`구별 관찰: ${p.discriminator}`,'',p.decision_limit,'')
E.push('## 교육 관계34 전량 검토','','기존approved14는 정의상 구성 관계의 승인을 보존한다. 연구의 추가 지지는 논리적 수행 연결이며 인과·전이·학생 진단의 승인이 아니다. SUPPORTS는 필수선수가 아니므로 다른 충분 경로의 존재만으로 반증하지 않는다. PREREQUISITE·TRANSFERS_TO의 경험적 주장은 학생 자료가 없으면 증거 부족이다.','', '| ID | 유형·방향 | 기존 | 연구검토 | 사례 | 제한 |','|---|---|---|---|---|---|')
for(const r of x.relations)E.push(`| ${r.id} | ${r.type}: ${r.from} → ${r.to} | ${r.prior_status} | ${r.review_status} | ${cases(r.cases).replace(/\|/g,'/')} | ${r.limits.replace(/\|/g,'/')} |`)
E.push('','유형 정의8개와 실제관계 기록은 다른 분모다. 현재34에는PART_OF18·PREREQUISITE3·SUPPORTS7·INTEGRATES_WITH3·TRANSFERS_TO2·ALTERNATIVE_PATH1이 있고 DIAGNOSE_WITH/REMEDIATES 실기록은0이다. 교수·평가 설계 후보를 이 유형에 연결할 수 있지만 기존34를 자동 증가·승인하지 않았다.')
write('V12-E-TASKS.md',E)
const G=['# G. TASK별 교수·교재 모델','','2026-10-14 · 모든 교수 순서와 효과는 H/E 미검증. [30프로필](./data/v12/task-relation-review.json)의 고유한 기출 근거를 보존한다. 설명→지도연습→독립응답→전이→지연 확인은 자료 역할이고 검증된 최적 순서나 공통 숙달 문턱은 아니다. L/X는 자료·측정 공백을 함께 기록한다.','']
const H=['# H. 직접 확인·평가 명세','','2026-10-14 · 문항 요구(L), 관찰 과제 설계(H), 실제 학생 수준을 분리한다. 여기에는 학생 응답·유효 응답 수·채점 일치도·IRT 난도·성취 문턱 자료가 없다. 정성 루브릭도 후보이며, U(근거 부족)는0점이나 결손이 아니다. 도움·노출·독립·전이·지연은 설명 깊이와 별도 축이다.','']
for(const t of x.tasks){
 G.push(`## ${t.display} · ${t.id}`,'',`수행 목표: ${t.teaching.goal}`,'',`기출 지지: ${cases(t.support_cases)}`,'',`경계/반례: ${cases(t.contrast_or_countercases)}`,'',`설명 방법: ${t.teaching.method}`,'',`선행 수행/조건: ${t.teaching.prerequisite}`,'',`자료 역할: ${t.teaching.materials_roles}`,'',`지도 연습: ${t.teaching.practice}`,'',`독립 확인: ${t.teaching.independent_check}`,'',`전이: ${t.teaching.transfer}`,'',`지연: ${t.teaching.delayed_check}`,'',`효과: ${t.teaching.effect}`,'')
 if(t.teaching.sequence_AF)G.push('상세A~F 설계:','',...t.teaching.sequence_AF.map(p=>`- ${p.phase}: ${p.instruction} (${p.status})`),'')
 H.push(`## ${t.display} · ${t.id}`,'',`목표: ${t.definition}`,'',`과제 조건: ${t.assessment.conditions}`,'',`허용 응답/근거: ${t.assessment.response}`,'','루브릭 후보:','',...rubricLines(t.assessment.rubric_candidate),'',`부분·대안 응답: ${t.assessment.alternative}`,'',`판정 보류: ${t.assessment.withhold}`,'',`힌트/노출/독립성: ${t.assessment.exposure_rule}`,'',`지원 공백: ${t.coverage_gap.join('; ')}`,'')
 if(t.assessment.parallel_task_spec)H.push('평행/전이 과제 조건:','',...Object.entries(t.assessment.parallel_task_spec).map(([k,v])=>`- ${k}: ${scalar(v)}`),'')
}
G.push('## 난도와 역할 결속','','어휘지원·문장길이·종속/수식·지시거리·담화암시성·후보유사성·숫자복합절·응답생성부담·허용시간을 독립 기록한다. 자료가 어려워 보인다는 인상과 실제학생 난도는 다르다. 원문 사례는 원문/해설/예제로 사용할 후보이지 이미 검수된 미노출 교재 풀은 아니다. 권리·허용답·학생 노출을 확인한 뒤 역할을 배정한다.')
H.push('## 정량 관찰 계약','','응답별로attempt_id/task/facet/item/source_revision/response/validity/help/exposure/elapsed_time/rubric_version/채점자별판정/불일치를 기록할 설계를 제안한다. 유효 응답 수 n과 조건별 관찰 수는 실제응답을 수집한 뒤 계산한다. 전이·지연은 별도분모이며 동일문항 재풀이는 미노출확인으로 세지 않는다.','', '문항정답률을TASK숙달확률로 바꾸지 않는다. 모든TASK에2문항 기준을 공통적용하지 않는다. 현재 코드북의2개/3문장 등은 기존 설계문구이며 검증된 필요량·성취문턱이 아니다. atomic과integrated를 평균내거나 영역의숙달막대를 계산하지 않는다.')
write('V12-G-TEACHING.md',G);write('V12-H-ASSESSMENT.md',H)
const coverage=[
 {axis:'기출 유형·문항',state:'partial',denominator:'운영786/기본범위공개758/기본보유774/전체45별도',evidence:['audit.json','pilot-source.json','restoration-summary.json'],why:'전체운영분석은 존재하지만 원문 완전 대조·같은형 검증·새분류가 전수 완료된 것은 아니다.'},
 {axis:'영역·TASK 관련성',state:'partial',denominator:'786×30=23580;비보류21/hold9',evidence:['item-task-map.jsonl','task-relation-review.json'],why:'후보전수표현과원문결속사례를분리. L/X 및미검토조합unknown.'},
 {axis:'출제원리·반례',state:'partial',denominator:'bounded비교원리110/기존749;교차유형기존0',evidence:['principle-task-review.json'],why:'원리문구전량검토는원문쌍전량검증·교차유형재현과다르다.'},
 {axis:'교수방법',state:'partial',denominator:'30설계명세;비보류21효과미검증/hold9',evidence:['task-relation-review.json'],why:'방법·조건·기출예제후보를정의했으나실제학생효과검증없음.'},
 {axis:'학습교재',state:'partial',denominator:'source완전복원24+기존완전8,새16별도;역할6',evidence:['restoration-summary.json','pilot-source.json'],why:'연구입력/예제후보는있으나교재권리·허용답·역할별콘텐츠검수와분량확정은미완료.'},
 {axis:'직접확인과제',state:'partial',denominator:'정적선언live5/ready2/content_needed14/blocked9',evidence:['task-relation-review.json'],why:'루브릭설계와코드북정적상태. 이번연구의현재실행·학생채점·유효응답검증0.'},
 {axis:'미노출전이과제',state:'unsupported',denominator:'학생별미노출검증된전이풀0;후보설계별도',evidence:['task-relation-review.json'],why:'원문및평행과제명세만으로학생의미노출및전이성공을확정못함.'},
 {axis:'지연재확인과제',state:'unsupported',denominator:'실제지연수행검증0',evidence:['task-relation-review.json'],why:'다른날새과제조건제안뿐;실제학생응답과간격타당성자료없음.'}
]
fs.writeFileSync(dir+'coverage.json',JSON.stringify({version:'1.2',date:'2026-10-14',states:{supported:'범위를명시한실제검증완료',partial:'일부근거/설계만있음',unsupported:'요구되는자료/관찰없음',unknown:'현재유효성미확인'},axes:coverage,task_gaps:x.tasks.map(t=>({id:t.id,display:t.display,status:t.status,gaps:t.coverage_gap,execution:t.static_execution_definition.direct_check,currently_executed:false})),whole_exam_45_supported:false,learner_deficits_inferred:false,learner_records_used:0},null,2)+'\n')
write('V12-I-COVERAGE.md',['# I. 목표 커버리지·지원 공백','','2026-10-14 · [기계판독 원장](./data/v12/coverage.json). 지원됨/일부지원/미지원/미확인을 구별한다. 학생자료를수집하지않았으며 콘텐츠공백을학생결손으로보지않는다.','', '| 지원축 | 상태 | 분모 | 근거·남은공백 |','|---|---|---|---|',...coverage.map(c=>`| ${c.axis} | ${c.state==='partial'?'일부 지원':'미지원'} | ${c.denominator} | ${c.why} |`),'','## TASK별 공백','',...x.tasks.map(t=>`- ${t.display} (${t.id}): ${t.coverage_gap.join('; ')}`),'','목표점수·등급·날짜와의관련성을정리할수있지만 학습당예상점수·개인필요량은미확정이다. 현재재고와필요학습량을구별한다. 읽기만으로듣기/실전지원율을추정하지않으며45문항전체학습지원완료는아니다. static live는현재실행확인과별개로미확인이다.'])
console.log('Rendered E/G/H/I and coverage30/34/7/8, all designs distinct from learner evidence')
