// scripts/research/goal-data/review/finalize.mjs
// 판정은 원문을 읽은 검증자가 작성했다. 이 스크립트는 근거 결속·집계만 한다.
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'
const dir='docs/research/goal-data-batches/review'
const base='docs/research/goal-data-batches/'
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'))
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:20e6}).trim()
const sha='80fa4454023c6b7086ac5cf4d7c12d459d26b0a0'
const d4='1b8f089e590536e2ef03c49cb3b6c85c0432ba85'
const plan='c44f41a5cbab4348908e7bc18fe39e09ad183592'
assert.equal(git('rev-parse','80fa44540'),sha)
assert.equal(git('rev-parse','1b8f089e5'),d4)
const sc=read(dir+'/sample-checks.json')
assert.deepEqual(sc.counts,{r1:30,disputes:30,r3:11,d3:30})
const status={c:'confirmed',r:'refuted',u:'unclear'}
const r1=[
 ['u','감사→배경→결정 구분은 가능하나 동기 조사 ①로 간다는 반사실은 조사 행위가 없어 약하다. indirect 확정 보류.'],
 ['c','영어 감정어 쌍의 뜻 대비가 선택 수행에 직접 쓰인다. V1 direct는 원문 경로와 부합한다.'],
 ['c','처벌 통념과 실제 무지 원인의 대조를 놓치면 상벌 규정 ③을 처방으로 오인하는 경로가 성립한다.'],
 ['u','옥타브 지시 추적 경로는 있으나 A의 감수성 회복 ④ 반사실은 근거가 약하고 B의 동일 주파수 ②는 더 타당하다. 두 판정 전체를 확정하지 않는다.'],
 ['c','정의·예시를 소셜 미디어의 관계망 확장이라는 중심으로 모으는 R5 경로가 성립한다.'],
 ['c','전기와 자서전의 기억 사용 대조를 유사성 ④로 바꾸는 반사실이 구체적이다.'],
 ['c','고립에도 불구하고 사회에 기여한다는 양보를 고립만의 이유 ②로 축소하는 경로가 성립한다.'],
 ['c','불일치 발문을 반대로 읽으면 실제 일치 ①~④를 고르게 된다. 계약 v2 E1 direct에 부합.'],
 ['r','No의 범위를 읽는 것이 정답 ③의 진위를 직접 가른다고 두 why가 설명한다. 계약 v2 S5 direct 기준과 달리 indirect로 낮췄다. locus 문구 자체는 원문과 일치.'],
 ['c','일정·상금·참가비·제출·평가표를 각각 찾아 대조하는 E2 직접 경로가 있다.'],
 ['c','수동 분사와 관계절 선행사 오독이 옳은 ①/④를 오류로 고르게 하는 보조 경로다.'],
 ['c','insignificant의 기본 뜻과 뒤 important의 충돌이 어휘 선택의 직접 근거다.'],
 ['c','강제 원근과 짝짓기 성공 사례에서 지각 편향이라는 일반 의미를 도출한다.'],
 ['u','counterproductive 미해석은 특정되지만 A는 ④, B는 ②로 간다고 한다. 어느 오답 유인이 그 수행만으로 생기는지 확정하기 어렵다.'],
 ['c','비숲 조림 사례와 희귀종 피해에서 숲의 다양성이 비숲 전환의 정당화가 될 수 없음을 도출한다.'],
 ['c','lotteries/drawing a lot과 randomization/tiebreaking의 재진술 대응이 직접 쓰인다.'],
 ['c','these mentoring opportunities의 선행 네트워크를 놓치면 결론 ⑤를 무관 문장으로 오인하는 경로가 있다.'],
 ['c','Such instruction과 In this way의 선행 내용이 C→A→B를 고정하는 실제 경로다.'],
 ['u','B의 You would not be the first 추적은 타당하지만 A의 those는 같은 A의 notations를 받는다. B 질문을 받는 대명사라는 설명은 부정확해 전체 why 확인 보류.'],
 ['c','재등장과 상당한 변화를 feature/transformation으로 맞대는 V4 경로가 있다.'],
 ['c','여러 매체 사례를 적절한 채널 선택이라는 중심 결론으로 압축한다.'],
 ['c','복잡한 메시지와 일상 메시지의 의미 대비를 판정하면 less routine의 충돌이 드러난다.'],
 ['u','C에서 Chavez 소개 후 D의 이름 사용이라는 경로는 가능하나 고유명사 재출현만으로 필수 지시 추적이라고 단정하기 어렵다.'],
 ['c','대명사 (d)의 대상 Chavez와 나머지 Mike를 구별하는 것이 문항의 직접 수행이다.'],
 ['c','부정 발문을 놓치면 홈런 실패 진술 대신 사실 진술을 답으로 고른다.'],
 ['u','협력의 재진술은 관찰되지만 A의 감정 어휘→④는 표면 단어 유인이고 B의 갈등→⑤는 중심/예시 선택이다. V4 고유 반사실인지 미확정.'],
 ['c','시간·노동 관계의 변화를 work-time paradigm shift로 대응하는 실제 재진술 경로가 있다.'],
 ['c','It is A that 강조구문을 관계사 오류로 오인하면 옳은 ④를 선택한다.'],
 ['c','기계적 언어 분석과 문학적 몰입의 대조를 잃으면 linguistic insight ⑤로 가는 경로가 있다.'],
 ['u','liberation/frees 동의성은 분명하나 A의 ③과 B의 ④ 유인은 방향 반전/긍정 어감의 다른 가정이다. V4 indirect 전체 확정 보류.'],
]
const disputes=[
 ...[
  '사회적 자본 정의를 중심으로 올리는 오독은 가능하나 정의 역할 R3와 전체 전개 R4의 경계가 없다.',
  'B는 과정 작문 효과라는 결론 역할이다. 역할을 쓰는 경로와 지시 추적만 쓰는 경로가 모두 가능하다.',
  'B의 질문과 A의 응답 역할은 보이지만 R1/R2/R4와 독립적인 R3 indirect 기준이 없다.',
  '첫 문장의 역사 설명은 배경이나 그것을 제목 ④로 올리는 오류가 R3 고유 수행인지 불명확하다.',
  '갈등 장면은 예시다. 예시/중심 구별이 R3인지 R5인지 경계 규정이 필요하다.',
  '가동 시간 사례와 교대제는 설명 예시지만 R3와 중심 압축 R5의 우선 기준이 없다.',
  '야구·악보는 예시지만 규제/구성 대조 R2와 역할 R3를 분리할 계약이 없다.',
  'C는 평판 자본을 농민·지주로 구체화한다. 구체화 역할과 순서 R4/응집 R1의 경계가 없다.',
  'A는 관찰 C의 해석이다. 해석 역할과 선행 관찰 추적을 분리할 기준이 없다.',
  '첫 문장인 유출 위험 진술을 ④에 넣는 전환 역할 경로가 있다. 원문 결손 확정은 아니나 R3/R4 독립성 미정.',
  '첫 문장의 비선형 생애 사례는 비판 구체화로 ④에 이어진다. R3/R4/R2 경계가 미정.',
 ].map(n=>['u',n]),
 ['c','권고 direct(E3). 감정 쌍을 두 장면에 맞대는 실제 경로가 있으며 V1/R6에서도 처리된다는 이유는 모든 합리적 경로가 불필요하다는 A not_applicable의 근거가 못 된다.'],
 ['r','A indirect의 반사실 ⑤는 동료 평가를 요구한다. bad apples를 일반 평가 대상으로 오독해도 동료라는 주체는 도출되지 않아 그 연결은 근거 없음. B not_applicable 전체를 자동 채택하지 않는다.'],
 ['u','비유 전체 해석은 필요하나 이 비유를 저장된 덩어리 V3로 볼지 추론 R6로 볼지 계약 경계가 부족하다.'],
 ['c','권고 direct(V4). remarkably similar와 identical의 차이, 이름 같음/주파수 다름을 맞대는 경로가 있다.'],
 ['c','권고 direct(E3). ③의 두 속성과 본문을 대조하는 실제 경로가 있다. 다른 TASK로 처리한다는 A 배제 사유는 부족하다.'],
 ['u','정의 단계를 본론으로 올리는 반사실은 가능하나 전체 배열 R4와 문장 역할 R3 경계는 미정.'],
 ['c','권고 direct(V4). 고립/분리와 사회 기여를 제목의 두 구절로 맞대는 경로가 직접 성립한다.'],
 ['u','제목 은유의 함의를 추론하는 경로와 어휘 재진술만으로 푸는 경로가 공존한다. R6 direct와 V4 경계 미정.'],
 ['u','④ 비교 병렬은 원문에서 확인되지만 도표 수치가 없어 해당 오독이 오답을 만드는지는 판정 불가.'],
 ['c','권고 indirect(S5). 참가비 부정 no를 놓치면 참이라고 읽어 ③을 고르는 구체적 경로가 있다.'],
 ['c','권고 indirect(S1). honeys/are blended의 주어·서술어 확인이 which절 완전성 판정의 전제다. 원문 locus도 존재한다.'],
 ['c','권고 direct(E1). 틀린 것을 찾는 부정 요구는 계약 v2의 명시적 direct 사례다. 표준 어법 발문이라는 B 배제 사유는 규칙과 충돌.'],
 ['c','권고 direct(V4). insignificant와 ecologically important의 반의 대비를 직접 판정한다.'],
 ['c','권고 indirect(R2). 하드/소프트 대조를 뒤집으면 modesty ④를 오류로 읽는 구체적 경로가 있다.'],
 ['u','개입 강도 점층은 확인되나 그 구조를 잃었다고 permanently ②를 부적절하다고 볼 이유까지 충분히 고정되지는 않는다.'],
 ['c','권고 indirect(E2, A). 결정 근거는 바로 다음 인접 문장이다. 계약 v2의 인접 근거 규칙상 B direct보다 A indirect가 부합한다.'],
 ['u','착시 서술과 perceptual biases의 대응은 있으나 재진술 V4/새 의미 도출 R6 경계로 direct/indirect 결정 유보.'],
 ['c','권고 indirect(R1). This의 선행 크기 배치를 잘못 받으면 착시 인과 연결이 흐려진다. locus는 원문과 일치한다.'],
 ['u','장식 자체와 배치 방식 대조는 존재하지만 decorating skills 선택이 R2 결손만의 결과인지는 불분명하다.'],
]
const d3=[
 ['r','① 수동 분사는 옳다. B form_error는 실제 형태 오류라는 뜻으로 읽으면 틀리며 A other의 옳은 형태 설명은 원문과 부합한다.'],
 ['r','③ strong은 목적격 보어 형용사로 옳다. B form_error를 오류로 부르는 분류는 부적절하다.'],
 ['r','④ feel은 복수 선행사와 일치한다. B form_error와 옳다고 한 why가 충돌한다.'],
 ['r','⑤ its는 Clover의 소유격으로 옳다. B form_error는 원문의 오류를 지목하지 못한다.'],
 ['c','순서 ①은 전통 수업 마무리 C보다 과정 작문 A가 먼저다. 양측 other의 연결 단절 설명이 성립한다.'],
 ['c','순서 ②는 In this way의 선행 과정 작문 A 없이 B가 먼저 온다. 설명이 성립한다.'],
 ['c','순서 ③ 역시 A의 수정 과정을 전제하는 B를 선행시킨다. 설명이 성립한다.'],
 ['c','순서 ⑤는 B의 반복 수정 효과를 C의 평가 중심 뒤에 놓는다. A 선행 필요 설명이 성립한다.'],
 ['c','목적 ①의 동기 조사 행위는 없고 열의라는 표면 단어만 대응한다.'],
 ['c','목적 ③의 신규 홍보는 이미 등록한 참가자 대상 문맥에 없다.'],
 ['c','심경 ①의 분노와 차분함은 걱정과 환희에 맞지 않는다. 양측 other 허용 범위.'],
 ['u','심경 ②의 두 감정 모두 잘못됐다. A reversal은 뒤 감정의 반대에만 초점을 둬 복합 오류의 단일 유형 합의는 보류.'],
 ['u','함축 ①은 같은 옥타브 차이로 대상을 바꾼다. 표면 단어/대상 변경 두 분류의 우선순위는 없다.'],
 ['r','함축 ②는 동일 주파수라고 잘못 바꾼다. 유사성의 일반화라는 A overgeneralization보다 동일성·차이의 모순이다. B의 모순 설명은 맞다.'],
 ['u','요지 ②는 정의의 일부를 중심으로 올린다. 부분 사실과 표면 재사용의 경계가 없어 양측 유형을 하나로 확정하지 않는다.'],
 ['u','요지 ③은 범위 확장을 형성 방식 변화로 바꾼다. 표면 재사용/부분 사실 외에도 초점 변형 해석이 가능하다.'],
 ['u','주제 ②는 가족 자료를 증거 전체로 축소한다. scope_shrink/표면 단어의 우선순위는 계약에 없다.'],
 ['c','주제 ③은 자료 사용 방식의 차이를 이야기 품질에 미치는 인과로 바꾼다. causal_error 설명이 성립한다.'],
 ['u','제목 ①은 이익 얻는 방법이라는 요청을 새로 만든다. B off_demand의 본문에는 맞는 진술이라는 정의까지는 충족하지 못한다.'],
 ['u','제목 ②는 스스로 택한 고립의 주체를 시대로 바꾼다. 귀속 혼합/인과 오류 중 우선 범주가 없다.'],
 ['u','도표 ①은 정답 번호를 역이용한 true_statement다. 도표 수치가 없어 원문으로 참을 확인할 수 없다.'],
 ['u','도표 ② 역시 공식 답이 아니라는 추론뿐이며 자동차 수치 원문이 없다.'],
 ['c','내용 ①은 어린 시절 전기기기 관심과 일치한다.'],
 ['c','내용 ②는 21세 전기공학 석사 시작과 일치한다.'],
 ['c','안내 ①은 여행자들의 매년 재참가와 일치한다.'],
 ['c','안내 ②는 활동 목록의 정글 조류 관찰과 일치한다.'],
 ['c','안내 ①은 Shannon의 전기기기 관심과 일치한다.'],
 ['c','안내 ②는 Shannon의 21세 석사 시작과 일치한다.'],
 ['c','어휘 ① remove는 개입 강도를 높이는 나무 제거 단계로 문맥에 맞는다.'],
 ['c','어휘 ② permanently는 포장의 지속성을 나타내며 문맥에 맞는다.'],
]
// D3 선택 순서는 sample-checks.json으로 고정한다. 마지막 내용 두 행은 #26이 아닌 #27/#26 순서를 아래에서 검증한다.
const notes={r1,disputes,d3}
const samples=[]
for(const group of ['r1','disputes','d3']){
 const checks=sc.checks.filter(x=>x.group===group)
 assert.equal(checks.length,notes[group].length)
 checks.forEach((s,i)=>{
  const [v,note]=notes[group][i]
  samples.push({id:`${group}-${String(i+1).padStart(2,'0')}`,group,item:s.id,task_or_choice:s.task,claim:group==='disputes'?'A/B 관련성 갈림에 대한 권고 판정':group==='d3'?'A/B 오답 유형·설명의 원문 적합성':'R1 후보의 관련성·반사실 근거가 원문에 부합한다',verdict:status[v],evidence:[s.evidence,s.source],source_sha256:s.source_sha256,structural_errors:s.errors,note})
 })
}
// #27, #26의 순서에 맞춘 내용 확인 문장. 원문을 실수로 다른 문항에 결속하지 않는다.
for(const s of samples.filter(x=>x.group==='d3')){
 if(s.item==='M2609#26')s.note=s.task_or_choice===1?'내용 ①은 어린 시절 전기기기 관심과 일치한다.':'내용 ②는 21세 전기공학 석사 시작과 일치한다.'
 if(s.item==='M2609#27')s.note=s.task_or_choice===1?'안내 ①은 여행자들의 매년 재참가와 일치한다.':'안내 ②는 활동 목록의 정글 조류 관찰과 일치한다.'
}
const claims=[]
function add(id,claim,v,evidence,note){claims.push({id,claim,verdict:status[v],evidence,note})}
const code=(p,line)=>`${sha}:apps/web/src/lib/${p}:${line}`
const db='docs/research/goal-data-batches/review/db-observations.json'
const dbl=(needle)=>`${db}:${fs.readFileSync(db,'utf8').split('\n').findIndex(x=>x.includes(needle))+1}`
add('D1-raw','삽입 262문항의 raw_block이 모두 null이다','c',[dbl('"raw_block_null"')],'GET 결과 262/262. 이 사실과 주어진 문장 자체의 결손은 다르다.')
add('D1-insertion-loss','삽입 262문항 모두 주어진 문장이 결손이다','u',[dbl('"insertion_samples"'),'docs/research/goal-data-batches/review/db-checks.json:20'],'원 보고서는 후보라고 제한했다. 2025#38·39는 passage 접두부가 삽입 대상 문장으로 해석되고 로컬 원문과 DB가 같다. 따라서 전체 결손 확정이나 일괄 제외로 인계하면 안 된다. 공식 원본 대조 미실행.')
add('D1-M2709','M2709 시험 및 문항이 미적재다','c',[dbl('"M2709"'),'docs/research/goal-data-batches/review/db-checks.json:52'],'시험 id/2027학년도 9월 및 문항 exam_id GET 모두 빈 배열. 쿼리 시점의 범위에 한함.')
add('D1-choices','2023#38은 body_ok=true이나 choices=null이다','c',[dbl('"choices_2023_38"')],'원천 보완 필요성의 DB 근거로 인계 가능.')
add('D1-rights-record','문항 있는 133시험의 source_note 권리 기록이 비어 있어 기록으로 확인된 재배포 적격은 0이다','c',[dbl('"rights"')],'csat_items 시험 집합과 csat_exams를 결합한 GET 결과. 법적 재배포 불가 판정이나 다른 권리 원장 부재를 뜻하지 않는다.')
add('D2-structure','지정 표본 60링크의 인용·반사실 필드가 계약 형식과 일치한다','c',['docs/research/goal-data-batches/review/sample-checks.json:2'],'R1 30+갈림 30(R3 11). 원본 A/B의 anchor·locus literal, 오답 번호, source hash 검사 오류 0. 형식 통과가 의미 적합성을 뜻하지 않는다.')
add('D2-semantic','R1 후보 30링크와 갈림 30링크 모두 의미상 그대로 인계할 수 있다','r',['docs/research/goal-data-batches/review/verdict.json#samples'],'R1의 #27 S5 등급과 갈림 #20 V3 반사실에 반례가 있다. 갈림은 자체 승인값이 아니며 본 판정도 진단·관련도 입력 승인이 아니다.')
add('D2-R3','R3 갈림 11건을 계약 v2만으로 단일 관련성 값으로 확정할 수 있다','u',[`${sha}:${base}D2-task-mapping/CONTRACT_V2.md:21`,'docs/research/goal-data-batches/review/verdict.json#samples'],'역할은 원문에서 확인하되 R3/R4/R5와의 수행 경계가 없어 11건 모두 유보한다.')
add('D3-grammar-category','분류표에 어법 범주가 없다','r',[`${sha}:docs/csat-learner/v62/data-expansion/ANALYST_CONTRACT.md:44`,`${sha}:${base}D3-principles/distractor-logic.jsonl:205`],'form_error가 이미 있다. 표본 4개는 실제로 옳은 형태여서 B form_error와 why의 의미가 충돌한다. 없는 범주보다는 올바른 형태를 고르는 오답의 라벨 규칙 문제다.')
add('D3-order-category','순서 연결 단절을 명시하는 전용 범주가 없다','c',[`${sha}:docs/csat-learner/v62/data-expansion/ANALYST_CONTRACT.md:44`,`${sha}:${base}D3-principles/distractor-logic.jsonl:233`],'표본 4개 모두 other이나 why는 선행 내용·대조 단절을 구체적으로 설명한다. other 자체는 계약 허용값이며 설명 오류의 증거가 아니다.')
add('D3-all-usable','오답 유형 표본 30개 모두 원문만으로 확정할 수 있다','r',['docs/research/goal-data-batches/review/verdict.json#samples'],'어법 4개 분류 충돌, 동일 주파수 오류의 일반화 라벨, 도표 2개 자료 결손이 있다. 교수·원인 진단에 일괄 사용하지 않는 원 보고서의 보류 방향은 타당하다.')
add('D4-1','M2: 도달 판정에서 다른 날·지문 다양성·교수 역할을 검사하지 않는다','c',[code('csat/map/skill-diagnosis.ts',95),code('csat/map/skill-diagnosis.ts',121),code('csat/map/skill-diagnosis.ts',133),code('csat/map/v62/supply.ts',70),code('csat/map/v62/evidence-claims.ts',175),'docs/research/goal-data-batches/review/runtime-checks.json:12'],'같은 날·같은 지문·역할 없는 2실패+2성공으로 resolved 재현. 단 활동·phase·세션·해시 조건은 존재한다. lifecycle은 확정 뒤 시간순서만 검사하고 다른 날은 검사하지 않는다. evidence-claims는 지연 유지 NOT_ESTABLISHED를 명시한다.')
add('D4-2','M1: 선행 실패 없이 성공만 한 학습자는 checking으로 남으며 PLAN이 이를 도달로 바꾸지 않는다','c',[code('csat/map/skill-diagnosis.ts',110),code('csat/map/v4/as-is.ts',236),code('csat/map/v4/plan.ts',32),`${plan}:apps/web/src/lib/csat/map/v62/goal-plan.ts:107`,'docs/research/goal-data-batches/review/runtime-checks.json:6'],'성공 4회 unverified 재현, As-Is checking 변환, PLAN 상태 그대로 표시. feat/goal-plan은 고정 SHA를 읽었으며 이 결함이 목표 점수 미달임을 뜻하지 않는다.')
add('D4-3-counts','5분류의 건수는 2/3/4/10/2, 합계 21이다','c',[`${d4}:${base}D4-assessment/assessment-review.md:115`],'분류표를 재집계했다. 건수 일치가 분류 의미의 타당성을 보증하지 않는다.')
add('D4-3-R2','R2는 현재 기출 확인 키가 연결돼 실제 평가 가능한 TASK다','r',[code('csat/map/load.ts',739),dbl('"applications"'),code('csat/map/v4/definition.ts',69)],'cohesion-link 정의는 있으나 DB에서 유일하게 관찰된 적용 2022-36은 draft다. 정본 키 존재만으로 활성 기출 공급을 확정할 수 없다. 창작 경로는 별도 승인·납품 조건이다.')
add('D4-3-E3','E3의 option-restate는 기출 문항 적용에 연결돼 있다','c',[dbl('"applications"'),code('csat/map/v4/definition.ts',65),code('csat/map/load.ts',739)],'2025/2026의 22–24번 active 6개 연결 확인. 학습자별 비노출·출시·권리 관문까지 통과한다는 주장은 하지 않는다.')
add('D4-3-V4R6','V4/R6의 남은 문제는 승인뿐이며 도달 조건의 누락은 없다','r',[code('csat/map/v4/definition.ts',69),code('csat/map/skill-diagnosis.ts',110),code('knowledge/authored/formats.ts',152)],'정본 확인 키 없음은 맞지만 공통 M1이 두 TASK에도 적용된다. R6의 근거 없는 추론 실패 기준이 모든 허용 응답에서 보장되는지는 전수 반례 검사하지 않아 그 부분은 미확정이다.')
add('D4-4-practice','M4: 연습화면·도움·해설 뒤·시각 불확실 기록은 직접 판정에서 제외한다','c',[code('csat/map/skill-diagnosis.ts',91),code('knowledge/effect-signals.ts',83),'docs/research/goal-data-batches/review/runtime-checks.json:24'],'연습화면과 해설 뒤 제외는 실행 재현, 나머지는 isEligible 정적 확인. 실제 DB 학습자 E2E는 수행하지 않았다.')
add('D4-4-synthetic','M4: 합성 기록을 본인 TASK 판정에서 제외한다','r',[code('csat/map/skill-diagnosis.ts',92),code('csat/map/skill-diagnosis.ts',95),'docs/research/goal-data-batches/review/runtime-checks.json:18'],'synthetic:false로 덮어 isEligible 호출. 합성만 2실패+2성공도 resolved. 코드가 명시한 본인 판정 정책이며 집단 효과 통계 제외와 구분해야 한다.')
add('D4-4-M7','M7: 정본 확인 키는 중심 TASK 하나에만 배정된다','c',[code('csat/map/v4/definition.ts',65),code('csat/map/v4/definition.ts',69),'docs/research/goal-data-batches/review/runtime-checks.json:36'],'V4 키 0, option-restate 중심 E3 재현. 단 원리의 독립성이나 모든 창작 경로의 완전한 차단을 증명한 것은 아니다.')
add('D4-5-R5','누락: R5는 뒷받침과 관계가 틀려도 중심 문장과 선택지만 맞으면 isCorrect=true다','c',[code('knowledge/authored/formats.ts',106),code('knowledge/authored/formats.ts',113),'docs/research/goal-data-batches/review/runtime-checks.json:47'],'실제 parser/grade에 claim 정답·choice 정답·support 오답·relation 오답을 넣어 true 재현. 채점 계약이 중심+선택으로 제한됨을 인계하되 추가 응답을 맞혔다고 읽지 않는다.')
add('D4-5-exposure','누락: 모든 경로에서 서로 다른 지문 검사가 전혀 없다','r',[code('csat/map/v62/assessment-exposure.ts',54),code('csat/map/v62/assessment-exposure.ts',77)],'노출 원장은 같은 지문의 다른 문항도 차단한다. TASK 도달 판정의 지문 다양성 부재와 공급 경로의 노출 차단을 구분해야 한다.')
add('A5-artifacts','판정·근거·표본·인계 목록을 허용 경로에 작성하며 유보를 승격하지 않는다','c',['docs/research/goal-data-batches/review/verdict.json:1','docs/research/goal-data-batches/review/review.md:1'],'원문 포함 *.local.json은 ignore 및 커밋 제외. Git 경로와 산출 스키마 검사를 커밋 전에 실행한다.')
const tally=xs=>Object.fromEntries(['confirmed','refuted','unclear'].map(v=>[v,xs.filter(x=>x.verdict===v).length]))
const sampleSummary=Object.fromEntries(['r1','disputes','d3'].map(g=>[g,{count:samples.filter(x=>x.group===g).length,...tally(samples.filter(x=>x.group===g))}]))
const result={task:'T-0088',owner:'goal-data-independent',input:{d1_d3:sha,d4,goal_plan:plan,db_observed_at:read(db).observed_at},protocol:'AI 독립 원문 대조·DB GET·정적 코드·고정 시각 메모리 실행. 검증 범위는 이 입력과 표본에 한정.',acceptance_covers:[0,1,2,3,4],claims,summary:{claims:tally(claims),samples:tally(samples),all:tally([...claims,...samples])},sample_summary:sampleSummary,sampling:{selection:sc.selection,r3_all:11,structural_errors:sc.checks.flatMap(x=>x.errors).length,contract_semantic_violations:[{sample:'r1-09',count:1,rule:'CONTRACT_V2 §2 S5 direct 경계'},{sample:'disputes-23',count:1,rule:'CONTRACT_V2 §2 E1 부정 발문 direct'},{sample:'disputes-27',count:1,rule:'CONTRACT_V2 §2 E2 인접 근거 indirect'}],counterfactual_false_or_unsupported:[{sample:'disputes-13',track:'A',count:1,note:'동료 평가 ⑤로 가는 연결 근거 없음. 심리적 선택 확률을 측정한 것이 아님.'}],counterfactual_uncertain:samples.filter(x=>x.group!=='d3'&&x.verdict==='unclear').map(x=>x.id),no_population_estimate:true},samples,engine_handoff:claims.filter(x=>x.verdict==='confirmed'&&x.id!=='A5-artifacts').map(x=>({id:x.id,scope:x.note})),handoff_exclusions:['D2 링크를 NeedRank/진단 결손/성취 입력으로 자동 승격하지 않음','R3 11건 단일값 확정 금지','삽입 262 일괄 결손·일괄 제외 금지','source_note 부재를 법적 금지로 해석하지 않음','R2 활성 공급·V4/R6 도달 조건 충족·지연 유지 확정 금지','오답 왜곡을 학습자 원인 진단으로 사용하지 않음'],top_gaps:[{priority:1,id:'D4-2',action:'실패 없는 성공의 별도 도달 조건 검토'},{priority:2,id:'D4-1',action:'다른 날·지문·역할별 도달 조건을 코드북과 결속'},{priority:3,id:'D4-5-R5',action:'R5 결과가 실제로 측정한 응답 범위를 표시'},{priority:4,id:'D4-3-R2',action:'정본 키와 활성·공급 적격 연결을 구분'},{priority:5,id:'D2-R3',action:'R3/R4/R5 경계 규칙 수립 뒤 재판정'}],limitations:['의도 표본이며 무작위 표집이나 모집단 정확도 추정이 아니다. R1은 TASK R1이 아니라 후보 등급 R1이다.','외부 공식 원본·도표 복구·권리 원장 전수 탐색·학습자 DB E2E·전체 타입/빌드 검사는 미실행이다.','DB는 기록된 조회 시점의 관찰이며 고정 Git 스냅샷과 시간 기준이 다르다. 쓰기 0.','구조 검사 0오류와 의미 오류·불명확을 구분한다. A/B 합의는 독립 정답의 보증이 아니다.'],workflow:{restart:'사용자 재개 지시에 따라 task start 재실행 안 함. task show에서 pid 932/product_lock_token 63035f0a736d412a 확인.',previous_start_failure:'이전 실행의 최초 실패 메시지 원문은 잔존 review 파일에 없어 복원할 수 없음. 현재 task는 IN_PROGRESS(run_seq=1)로 관찰됨.',commit_scope:'docs/research/goal-data-batches/review/** 및 scripts/research/goal-data/review/**; *.local* 제외',push:false,db_writes:0}}
fs.writeFileSync(dir+'/verdict.json',JSON.stringify(result,null,2)+'\n')
console.log(JSON.stringify({summary:result.summary,samples:sampleSummary}))
