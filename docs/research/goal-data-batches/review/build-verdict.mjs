// docs/research/goal-data-batches/review/build-verdict.mjs
// 판정은 아래에 수동 작성했다. 이 파일은 판정·근거를 결속하고 집계할 뿐 새 의미 판정을 하지 않는다.
import fs from 'node:fs'
import {execFileSync} from 'node:child_process'
const dir='docs/research/goal-data-batches/review'
const base='docs/research/goal-data-batches/'
const sha='80fa44540'
const git=(p,s=sha)=>execFileSync('git',['show',`${s}:${p}`],{encoding:'utf8',maxBuffer:30e6})
const checks=JSON.parse(fs.readFileSync(`${dir}/sample-checks.json`,'utf8'))
const db=JSON.parse(fs.readFileSync(`${dir}/db-checks.json`,'utf8'))
const runtime=JSON.parse(fs.readFileSync(`${dir}/runtime-checks.json`,'utf8'))
const sourceLines=(p,needle,s=sha)=>`${s}:${p}:${git(p,s).split('\n').findIndex(l=>l.includes(needle))+1}`
const evidence=(p,n)=>`${sha}:${p}:${n}`
const code='apps/web/src/lib/'
const skill=code+'csat/map/skill-diagnosis.ts'
const formats=code+'knowledge/authored/formats.ts'
const canon='docs/csat-learner/v4/codebook.json'
const row=(id,verdict,evidence,note,extra={})=>({id,verdict,evidence,note,...extra})
const localEvidence=p=>`${dir}/${p}:1`
const d1=[
 row('D1-insert-raw-block','confirmed',[localEvidence('db-checks.json')],'DB의 R-INSERT 262행 모두 raw_block=null. 표준 발문 정규식 일치 252행이다. 이것은 결손 탐지 신호의 재현이며 문장 결손 확정이 아니다.'),
 row('D1-insert-sentence-missing-262','unclear',[localEvidence('db-checks.json'),sourceLines(base+'D1-source-audit/source-quality-report.md','262 전체 의심')],'262문항 모두의 주어진 문장 결손은 입증되지 않았다. 2025#38·#39는 DB passage 접두 문장이 각각 위험 전환·선형 생애주기 반박 기능으로 정답 위치 ④와 이어진다. 로컬 입력과 DB passage도 일치한다. 별도 필드 부재와 내용 부재를 혼동하면 안 된다. 공식 원본 PDF 대조 및 262문항별 경계 복원은 미실행.'),
 row('D1-insert-blanket-exclusion','refuted',[localEvidence('db-checks.json')],'raw_block null만으로 삽입 전체를 분석·진단 부적격으로 확정하는 확대 해석은 지지되지 않는다. D1 원문은 후보라고 유보했으므로 후보 보고 자체를 오류로 단정하지 않는다.'),
 row('D1-M2709','confirmed',[localEvidence('db-checks.json')],'csat_exams의 id=M2709 또는 exam_year=2027/month=9 조회와 csat_items exam_id=M2709 조회가 모두 HTTP 200 빈 배열이다. 현재 해당 시험·문항 미적재 주장을 확인했다. 실제 시험 시행 여부는 이번 범위 밖이다.'),
 row('D1-2023-38','confirmed',[localEvidence('db-checks.json')],'id=2023#38 한 행의 body_ok=true, choices=null을 직접 확인했다.'),
 row('D1-redistribution-record-0','confirmed',[localEvidence('db-checks.json'),sourceLines('scripts/research/goal-data/d1-source-audit.mjs','source_note')],'134시험 중 source_note가 비지 않은 것은 M2009뿐이고 그 시험 문항은 0행이다. 따라서 문항이 있는 시험의 source_note 기록을 요구하는 D1 기준으로 적격 0(미정)을 재현했다. source_note는 권리 증명 원장 전체와 같지 않다.'),
 row('D1-legal-redistribution-0','unclear',[localEvidence('db-checks.json')],'권리 기록 없음은 법적 재배포 불가 0개 확정과 다르다. 별도 계약·원장·허가를 전량 검토하지 않았다. 이 AI 검증은 법적 권리 판단이나 출시 승인이 아니다.')
]
const r1Notes={
 'M2609#18':'도입의 등록 열의와 후반 장소 변경 결정을 구분하면 목적이 닫힌다. 도입을 목적으로 올리는 ① 반사실은 본문에 기반한 가설이다.',
 'M2609#19':'긴장 행동→칭찬 뒤 환호를 영어 감정어 쌍과 가르는 경로에서 V1의 기본 뜻 대비가 직접 쓰인다.',
 'M2609#20':'처벌 통념을 In fact가 반박한다. 이를 필자 처방으로 읽으면 상벌 정비 ③으로 가는 경로가 구체적이다.',
 'M2609#21':'This relationship/phenomenon은 주파수 배수 관계를 받는다. 같은 주파수로 돌아간다는 ②는 다름을 놓친 오독이다. A의 ④ 경로는 B보다 약하며 실제 학생 유인 효과는 미검증이다.',
 'M2609#22':'관계망·사회적 자본이라는 시작과 끝을 정의·예시와 구분하는 중심 의미 경로를 지지한다.',
 'M2609#23':'by contrast가 기억 사용의 차이를 세운다. 이를 놓치면 자료 유사성 ④로 오인할 수 있다.',
 'M2609#24':'사회 기여와 자발적 고립의 양보 관계가 제목의 역설을 지지한다. 고립 강요 ②는 관계·주체를 잘못 읽은 경우다.',
 'M2609#26':'일치하지 않는다는 부정 요구를 적용해야 사실 진술 ①~④를 버린다. E1 direct 경계와 맞는다.',
 'M2609#27':'No private restroom과 공용 화장실 접근 가능을 갈라 읽어야 ③ 불일치를 판정한다. locus는 실제 본문에 있다.',
 'M2609#28':'일정·상금·지침·평가 비중의 여러 구역을 찾아 대조해야 ⑤가 남는다. E2 direct를 지지한다.',
 'M2609#29':'분사구문의 의미상 주어와 관계절의 복수 선행사 연결은 각각 ①·④를 틀렸다고 오인하는 구체 경로다.',
 'M2609#30':'insignificant의 기본 뜻을 ecologically important와 대비하는 경로가 직접 결정에 쓰인다.',
 'M2609#31':'강제 원근과 수컷이 크게 보이는 사례에서 지각 편향이라는 상위 개념을 도출한다.',
 'M2609#32':'counterproductive를 모르면 역효과라는 결론을 선지에 연결하지 못한다. 제시된 오답 번호들은 실제 오답이나 어느 쪽으로 유인되는지는 행동 자료가 없다.',
 'M2609#33':'습지 조림의 문제 사례와 생태학자 비판을 비숲 전환의 정당화 금지로 일반화하는 추론 경로다.',
 'M2609#34':'추첨·동률 해소를 randomization/tiebreaking으로 재진술하는 의미 대응이 있다.',
 'M2609#35':'these mentoring opportunities의 앞선 멘토 관계 연결을 놓치면 ⑤를 무관하게 보는 반사실이 성립한다.',
 'M2609#36':'Such instruction→전통 수업, In this way→반복 피드백을 받는 지시 연결이 배열을 고정한다.',
 'M2609#37':'B 첫 문장은 주어진 글의 이해 못한 경험을 받으므로 지시 연결 경로는 지지된다. 단 B의 those가 B 질문의 신호를 받는다는 부연은 잘못이다. those는 A 안의 기호 나열을 받는다.',
 'M2609#40':'재등장과 특성 변화의 의미가 feature/transformation으로 대응한다.',
 'M2609#41':'연구와 예시를 걸러 메시지에 맞는 채널 선택을 중심으로 압축한다.',
 'M2609#42':'confusing/ambiguous에 대응할 lean 쪽은 routine이어야 한다. less routine은 같은 방향이므로 의미 대조 판단이 결정에 쓰인다.',
 'M2609#43':'C의 Chavez 소개→D의 동일 인물 행동이라는 지시·개체 연결이 배열 판단에 쓰인다.',
 'M2609#44':'(d) his만 Chavez이고 나머지는 Mike이다. 지시 대상 판정 자체를 요구한다.',
 'M2609#45':'적절하지 않다는 부정 요구를 적용하여 홈런을 치지 못했다는 ②를 골라야 한다.',
 '2025#22':'cooperate·소통 촉진과 ①의 의미 대응이 있다. 제시 반사실은 정의·예시를 중심으로 올리는 가설로만 인정한다.',
 '2025#23':'수확 주기에서 시계 중심으로의 변화를 work-time paradigm shift와 대응하는 경로다.',
 '2025#29':'It is A that 강조 구조를 관계절 오류로 오인하면 옳은 ④를 고를 수 있어 S4 간접 경로를 지지한다.',
 '2025#31':'기계적 분석과 전인적 몰입의 대조를 놓치면 linguistic insight ⑤로 향하는 구체 경로가 있다.',
 '2025#32':'liberation과 frees의 동의 계열 연결이 있다. intensify를 문맥 밖에서도 liberation의 반의어라고 일반화해서는 안 된다.'
}
const d2r1=checks.checks.filter(c=>c.group==='r1').map(c=>row(`D2-R1-${c.id}-${c.task}`,'confirmed',[c.evidence,c.source],r1Notes[c.id],{item:c.id,task:c.task,source_sha256:c.source_sha256,scope:'관련성 후보 경로 지지. 사람 검토·직접 측정·반사실의 실제 유인 효과 확인 아님',explanation_error:c.id==='M2609#37'}))
const disputeNotes={
 'M2609#19/E3':['confirmed','B','direct','감정 추론을 두 영어 감정어와 대응시키는 경로는 독립적으로 존재한다. 다른 TASK로 이미 처리했다는 A 사유만으로 배제할 수 없다.'],
 'M2609#20/V3':['unclear',null,null,'bad apples의 비유는 실재하지만 이를 일반 평가 대상으로 오독하면 동료 평가 ⑤로 간다는 연결은 추가 추정을 요한다. 허위로 확정하지 않으며 A 반사실 지지는 미확인이다.'],
 'M2609#21/V3':['unclear',null,null,'비유 구 전체의 해석인지 R6 문맥 추론인지 경계가 남는다. come back home을 고정 숙어로 전제할 근거는 없다.'],
 'M2609#21/V4':['confirmed','A','direct','유사한 소리·같은 음 이름과 동일 주파수를 구별하는 의미 대비는 실제 선지 변별 경로다.'],
 'M2609#21/E3':['confirmed','B','direct','③의 이름 반복·다른 음높이를 주파수 배수 설명과 대응하는 경로가 있다. V4와 중복된다는 이유만으로 무관하지 않다.'],
 'M2609#22/R4':['confirmed','A','indirect','정의·예시·재강조의 배열을 못 보고 정의 부분을 요지 ②로 올리는 반사실은 원문에 닫힌다.'],
 'M2609#24/V4':['confirmed','B','direct','고립과 공동체 기여를 제목의 detached/attached로 바꿔 읽는 의미 대응이 존재한다.'],
 'M2609#24/R6':['unclear',null,null,'제목의 역설을 함축 추론으로 볼지 V4 의미 대응·R5 중심 압축으로 볼지는 계약만으로 닫히지 않는다.'],
 'M2609#25/S4':['unclear',null,null,'higher than과 lower than의 병렬은 실제 존재하여 B의 구조 부재 사유는 부정확하다. 그러나 도표가 없어 A의 ④ 진위 오판 반사실은 끝까지 검증할 수 없다.'],
 'M2609#28/S5':['confirmed','B','indirect','no participation fee를 흘리면 참가비가 있다는 실제 오답 ③을 고른다. 명시 부정 범위가 있다.'],
 'M2609#29/S1':['confirmed','B','indirect','honeys/are blended로 관계절의 주어·서술어를 찾지 못하면 which가 주어라고 오인하는 locus 경로가 있다.'],
 'M2609#29/E1':['confirmed','A','direct','어법상 틀린 것을 묻는 부정 요구다. 표준 발문이라는 이유로 B가 무관 처리한 것은 v2 E1 direct 경계 위반이다.'],
 'M2609#30/V4':['confirmed','B','direct','insignificant와 important의 반대 의미 대비가 바로 부적절 낱말을 가른다.'],
 'M2609#30/R2':['confirmed','B','indirect','hard/soft 접근의 대조를 뒤집으면 modesty ④를 어색하다고 볼 수 있다. 연결어 존재만이 아니라 구체 오답을 제시했다.'],
 'M2609#30/R4':['unclear',null,null,'개입 정도의 점층은 원문에 있으나 이를 놓치는 것만으로 permanently ②를 오류로 고르는 필연적 연결은 약하다. 반사실 허위로 확정하지 않는다.'],
 'M2609#30/E2':['confirmed','B','direct','밑줄 문장의 정오가 다른 문장 ecologically important에 달려 있다. v2의 다른 문장 탐색 direct 조건에 맞아 A indirect는 경계 위반이다.'],
 'M2609#31/V4':['confirmed','A','direct','forced perspective·실제보다 크게 보임을 perceptual biases로 추상화한 표현 대응이 정답 변별 경로다. B의 ④ 반사실도 허위는 아니다.'],
 'M2609#31/R1':['confirmed','B','indirect','This의 선행 내용은 크기별 거리 배치다. 배치와 착시의 연결을 놓치는 locus 반사실을 지지한다.'],
 'M2609#31/R2':['confirmed','B','indirect','무질서한 장식이 아니라 배치 방식이라는 But의 대조를 놓치면 decorating skills ④로 읽는 경로가 있다.']
}
const d2disputes=checks.checks.filter(c=>c.group==='disputes').map(c=>{
 const isR3=c.task==='R3'
 const v=isR3?['unclear',null,null,'정의·예시·결론·전환·해석 역할은 해당 원문에서 설명 가능한 경로다. 하지만 v2는 R3 경계 행이 없고 역할 명명 요구와 역할 해석 기여를 구분하지 않는다. A/B 중 하나를 정본으로 승격하지 않는다. 삽입 #38·#39 역시 본문 접두 문장 가능성을 배제하고 결손으로 고정하지 않는다.']:disputeNotes[`${c.id}/${c.task}`]
 if(!v) throw Error('missing dispute '+c.id+'/'+c.task)
 return row(`D2-dispute-${c.id}-${c.task}`,v[0],[c.evidence,c.source],v[3],{item:c.id,task:c.task,supported_track:v[1],reviewer_candidate:v[2],source_sha256:c.source_sha256,contract_boundary_violation:c.id==='M2609#29'&&c.task==='E1'?'B':c.id==='M2609#30'&&c.task==='E2'?'A':null,counterfactual_false:false,counterfactual_semantics_held:['M2609#20/V3','M2609#25/S4','M2609#30/R4'].includes(`${c.id}/${c.task}`)})
})
const d3Notes={
 'M2609#18/1':['confirmed','surface_word_match','열의·등록 언급을 동기 조사로 바꾼 선지다. A/B 표면어 대응 설명이 본문과 맞는다.'],
 'M2609#18/3':['confirmed','unmentioned','이미 등록한 참여자에게 장소를 알리는 글이며 새 프로그램 홍보는 없다.'],
 'M2609#19/1':['confirmed','other','걱정과 환호를 분노와 차분함으로 오지정한다. 감정 종류 오류는 other 설명과 맞는다.'],
 'M2609#19/2':['unclear',null,'마지막 bored가 환희에 반하지만 시작 frustrated도 걱정의 정확한 재표현이 아니다. reversal/other 중 단일 범주 결정 규칙이 없다.'],
 'M2609#20/1':['confirmed','partial_truth','교육은 맞으나 생산성·주기적 윤리 교육은 추가됐고 기준 마련은 빠졌다.'],
 'M2609#20/3':['confirmed','reversal','비판 대상인 처벌 접근을 필자의 처방으로 올렸다.'],
 'M2609#21/1':['unclear',null,'차이를 식별한다는 방향 전환과 같은 옥타브 안이라는 범위·대상 변경이 함께 있다. A/B 단일 범주 우선순위가 없다.'],
 'M2609#21/2':['refuted',null,'주파수가 달라지는데 identical frequency라고 한 모순이다. A overgeneralization의 일반화 대상이 없고 B other의 비유 직역도 부가 해석이다. 유사→동일 의미 변경을 더 정확히 표시해야 한다.'],
 'M2609#22/2':['unclear',null,'정의 요소를 요지로 올린 부분 사실이면서 원문 낱말을 재사용한다. 두 범주가 중첩돼 하나로 닫히지 않는다.'],
 'M2609#22/3':['unclear',null,'범위 확대를 형성 방식 변화로 바꾼 진술이다. 부분 사실·표면어 일치 구분 기준이 부족하다.'],
 'M2609#23/2':['unclear',null,'가족 자료 하나로 초점을 줄인 동시에 표면어를 재사용했다. 범위 축소와 표면어 우선순위 미정이다.'],
 'M2609#23/3':['confirmed','causal_error','자료 사용 차이를 자료가 서사 품질에 미치는 인과로 바꿨다.'],
 'M2609#24/1':['unclear',null,'수도원의 위상을 개인 이익을 얻는 방법으로 바꿨다. 발문·목표 이탈과 표면어 대응이 겹친다.'],
 'M2609#24/2':['unclear',null,'자발적 고립을 시대가 요구한 고립으로 바꿨다. 주체 혼합과 잘못된 인과가 모두 가능하다.'],
 'M2609#25/1':['unclear',null,'도표 원수치가 없다. 정답 번호 ⑤로 ①을 참이라고 역산한 것은 원문 독립 검증이 아니다.'],
 'M2609#25/2':['unclear',null,'도표 원수치가 없어 최저 연령대 진술의 참·거짓을 확인할 수 없다.'],
 'M2609#26/1':['confirmed','true_statement','어린 시절 전기기기에 관심이 있었다는 본문 진술과 일치한다.'],
 'M2609#26/2':['confirmed','true_statement','21세에 석사과정을 시작했다는 본문 진술과 일치한다.'],
 'M2609#27/1':['confirmed','true_statement','매년 다시 참여한다는 본문 진술과 일치한다.'],
 'M2609#27/2':['confirmed','true_statement','활동에 정글 조류 관찰이 명시됐다.'],
 'M2609#30/1':['confirmed','true_statement','개입을 늘린 대응으로 나무를 제거하고 원래 길을 복원한다는 서술에 맞는다.'],
 'M2609#30/2':['confirmed','true_statement','더 강한 개입에서 포장을 통해 더 영구적으로 넣는다는 문맥에 맞는다.']
}
const d3=checks.checks.filter(c=>c.group==='d3').map(c=>{
 let v
 if(c.id==='M2609#29') v=['unclear',null,({1:'꿀이 불리는 대상이므로 referred가 옳다.',3:'find의 목적격 보어로 strong이 옳다.',4:'producers and retailers를 받는 복수 feel이 옳다.',5:'단수 Clover를 받는 its가 옳다.'})[c.task]+' A/B 모두 옳은 형태라는 원문 설명은 맞다. form_error가 실제 형태 오류인지 어법상 유인 일반인지 계약의 적용 범위가 모호하므로 B를 허위로 확정하지 않는다. A other와 B form_error 중 단일 범주 판정은 보류한다.']
 else if(c.id==='M2609#36') v=['confirmed','other',({1:'전통 작문의 평가 단계 C가 먼저 와야 대조 A가 이어진다.',2:'B의 In this way는 A의 반복 피드백을 받으므로 B가 먼저 올 수 없다.',3:'과정 작문의 효과 B는 과정 소개 A 뒤에 와야 한다.',5:'C 뒤 B를 붙이면 In this way가 전통 수업을 받게 되어 연결이 끊긴다.'})[c.task]+' 연결·배열 단절을 other로 설명하는 것은 현 계약에서 허용되지만 같은 레이블만으로 단절 종류는 복원되지 않는다.']
 else v=d3Notes[`${c.id}/${c.task}`]
 if(!v) throw Error('missing d3 '+c.id+'/'+c.task)
 return row(`D3-${c.id}-choice${c.task}`,v[0],[c.evidence,c.source],v[2],{item:c.id,choice:c.task,reviewer_distortion:v[1],source_sha256:c.source_sha256,meaning:'confirmed=원문에 맞는 최소 한 분류/설명 지지, refuted=특정 분류 주장 반박(설명에서 대상 명시), unclear=범주 경계 또는 원천 부족'})
})
const d3Claims=[
 row('D3-grammar-category-absent','refuted',[sourceLines('docs/csat-learner/v62/data-expansion/ANALYST_CONTRACT.md','`distortion_type`:'),sourceLines(base+'D3-principles/reasoning-review.md','이 두 유형')],'계약 v1(따라서 v2)에 form_error(어법·형태)가 이미 있다. 어법 표본 네 선지는 실제로 옳고 A=other/B=form_error로 갈린다. 부재라고 단정한 원인은 틀렸으며 정상 형태 유인과 실제 형태 오류의 적용 경계가 부족하다는 결론은 가능하다.'),
 row('D3-order-granularity-gap','confirmed',[sourceLines(base+'D3-principles/distractor-logic.jsonl','"item_id":"M2609#36"'),sourceLines('docs/csat-learner/v62/data-expansion/ANALYST_CONTRACT.md','`distortion_type`:')],'순서 표본 네 개 모두 A/B=other이나 지시 선행·대조·과정 소개/효과 순서 단절의 설명은 서로 다르다. 전용 연결·배열 범주 부재로 정밀 정보가 other에 뭉치는 주장은 지지된다. other 사용 자체는 계약 위반이 아니다.'),
 row('D3-agreement-is-not-truth','confirmed',[sourceLines(base+'D3-principles/principle-groups.json','"distortion_agree_source_text"')],'164/280은 A/B 일치 집계다. 원문 대조 정확도·사람 Gold·학습자 오답 원인 정확도로 읽을 수 없다. 이번 30 표본도 모집단 정확도 추정이 아니다.')
]
const taskSpecs=[
 ['V1','confirmed',139,code+'knowledge/authored/tasks.ts',4,'등록 창작 키에 V1이 없고 정본은 다른 날 재인출을 요구한다. FSRS가 존재한다는 사실과 TASK 판정 결속은 다르다.'],
 ['V2','confirmed',160,skill,19,'서로 다른 문맥 2개 조건을 문맥 identity로 세지 않는다. 현재 문항 텍스트가 서로 다른 것과 판정 가드는 별개다.'],
 ['V3','confirmed',179,formats,213,'의미를 말하는 기준을 뜻·근거 선택형으로 대신한다. 산출 동일성은 입증하지 않는다.'],
 ['V4','unclear',198,formats,398,'같음 여부와 의미 관계를 채점하여 형식은 맞는다. 추가 날짜·횟수 도달 조건은 없다. 그러나 사람 승인만 남았다는 분류는 AI 결정 허용 SQL과 대조가 필요하고 현재 납품·승인 상태를 읽지 않았다.'],
 ['S1','confirmed',217,skill,130,'연속 3문장 기준과 공통 연속 2정답 판정은 다르다. 한 덩어리 선택이 뼈대 전체 표시와 같은지도 미확인이다.'],
 ['S2','confirmed',239,formats,376,'덩어리·이유 선택은 경계 오류 없이 풀어 쓴 산출의 의미 동일성을 검증하지 않는다.'],
 ['S3','confirmed',260,skill,19,'다른 문장에서도 성공해야 하지만 진단 입력에는 문장·지문 identity가 없다.'],
 ['S4','confirmed',279,formats,376,'구조·이유 선택은 풀어 쓴 산출과 다르다. 부분 평가 분류를 지지한다.'],
 ['S5','confirmed',299,formats,269,'Gold에는 문법 범주가 있지만 공통 진단은 포인트별로 서로 다른 문항 2개를 세지 않는다. 포인트 자료 자체가 없다는 해석은 과도하다.'],
 ['S-O1','confirmed',321,code+'csat/map/v4/observation.ts',3,'정본이 숙달 계산 없이 관찰만 요구한다. 숙달 도구 부재는 설계와 일치하며 관찰 기능 자체 부재를 뜻하지 않는다.'],
 ['R1','confirmed',340,skill,98,'itemRef 구분은 있지만 서로 다른 지문 2개 조건이 없다.'],
 ['R2','refuted',361,code+'knowledge/cohesion-link.ts',74,'cohesion-link는 2022#36 주석과 연결되지만 지시 대상 문장+순서를 채점한다. 정본 관계 종류+근거 단서를 직접 받지 않으며 관찰 내역만이라는 제한도 빠졌다. 키 존재로 전체 TASK 실제 평가 가능을 닫을 수 없다.'],
 ['R3','confirmed',382,formats,287,'R4와 discourse_roles/gradeStructure를 공유하며 Gold tagging 독립 관찰 조건을 검사하지 않는다. 같은 함수라는 사실만으로 능력 동일성을 단정하지 않는다.'],
 ['R4','confirmed',404,formats,312,'R3와 독립 관찰을 확인하는 코드가 없다. 도달 조건 검증 부족을 지지한다.'],
 ['R5','confirmed',426,skill,119,'확정 후 시간 순서와 120일 상한만 있고 다른 날·새 지문 조건은 없다. evidence-claims도 delayedRetention=NOT_ESTABLISHED로 선언한다.'],
 ['R6','unclear',448,formats,144,'정답·결정 근거·허용 근거 밖 없음은 검사한다. 정본에 추가 날짜·횟수 조건은 없다. 사람 승인만 대기라는 현재 상태·단일 경로 주장은 DB에서 확인하지 않았다.'],
 ['R-O1','confirmed',467,code+'csat/map/v4/observation.ts',31,'하위 근거 취합은 있으며 자기 숙달 도구 없음은 설계와 일치한다. 이를 일반 측정 불가능으로 확대하지 않는다.'],
 ['E1','confirmed',486,skill,19,'유형 2개 이상 조건이 입력·집계에 없다. 요구 진술 선택도 직접 말하기와 구분해야 한다.'],
 ['E2','confirmed',505,skill,119,'다른 문항 2독립 정답→다른 날 재확인을 확정 뒤 2정답으로 대신한다. 역할 납품이 최소 간격을 보장하지 않는다.'],
 ['E3','refuted',527,code+'knowledge/evidence-locate.ts',104,'option-restate의 기출 6문항 연결은 확인된다. 그러나 lurePicked도 isCorrect=false라 공통 2실패가 학습 요구를 확정할 수 있다. 함정 선택만으로 약함 판정 금지라는 정본과 충돌해 전체 실제 평가 가능 분류는 반박한다. 좁은 대응 문장 지목 기능은 실행 가능하다.'],
 ['E-O1','confirmed',550,code+'csat/map/v4/observation.ts',31,'정답·근거·배제 이유를 함께 내는 통합 관찰 성공 도구는 없다. 선택+결정 근거만 추가하는 제안은 버린 답 이유까지 충족하지 않는다.']
]
const d4tasks=taskSpecs.map(([id,v,n,p,l,note])=>row(`D4-task-${id}`,v,[evidence(canon,n),evidence(p,l)],note))
const d4=[
 row('D4-handoff-1','confirmed',[evidence(skill,91),evidence(skill,119),evidence(code+'csat/map/v62/supply.ts',76),evidence(code+'csat/map/load.ts',318),evidence(code+'csat/map/lifecycle-evidence.ts',8),evidence(code+'csat/map/v62/evidence-claims.ts',175),localEvidence('runtime-checks.json')],'진단은 다른 날·서로 다른 지문·transfer/delayed 역할을 도달 조건으로 검사하지 않는다. lifecycle에는 확정 이후·운영 진행량 검사, supply에는 역할별 자격 검사가 있으나 지연 기억 판정은 아니다. 같은 날 같은 지문 메타데이터의 서로 다른 4문항 2실패→2정답으로 resolved를 재현했다. 실제 공급에서 같은 지문 노출을 막는 별도 가드가 있으므로 전체 제품에 아무 지문 방어도 없다는 주장은 하지 않는다.'),
 row('D4-handoff-2-M1','confirmed',[evidence(skill,110),evidence(code+'csat/map/v4/as-is.ts',236),'c44f41a5cbab4348908e7bc18fe39e09ad183592:apps/web/src/lib/csat/map/v4/plan.ts:32','c44f41a5cbab4348908e7bc18fe39e09ad183592:apps/web/src/lib/csat/map/v62/goal-plan.ts:106',localEvidence('runtime-checks.json')],'성공만 4회면 unverified이고 실제 독립 근거가 있으면 As-Is checking으로 남는다. feat/goal-plan 고정 SHA의 plan은 checking→checking, resolved→resolved를 별도로 매핑하고 goal-plan은 shown.achievement를 전달한다. 이 경로에서 checking을 도달로 승격하지 않는다. 후속 feat/goal-achievement 브랜치의 현재 구현 상태를 결론에 섞지 않았다.'),
 row('D4-handoff-3-21classes','refuted',[evidence(code+'knowledge/cohesion-link.ts',74),evidence(code+'knowledge/evidence-locate.ts',104),evidence(canon,370),evidence(canon,536)],'21건을 각각 아래에 검토했다. R2·E3에 실제 기출 확인 키가 붙은 것은 맞지만 정본 측정 범위·약함 판정 제한까지 충족한다는 분류는 반박한다. V4·R6는 형식만 확인되며 현재 승인·자격·납품과 사람만 대기라는 전체 분류는 unclear다.'),
 row('D4-handoff-4-M4','refuted',[evidence(skill,91),evidence(skill,95),evidence(code+'knowledge/effect-signals.ts',80),localEvidence('runtime-checks.json')],'연습 화면·도움·해설 뒤·시각 불확실 제외는 코드로 확인된다. 하지만 본인 진단은 synthetic:false로 바꿔 isEligible을 호출한다. 합성 2실패→2정답도 resolved여서 합성 제외까지 방어됐다는 M4 전체 주장은 틀리다. 집단 효과 표본의 합성 제외와 구분해야 한다.'),
 row('D4-handoff-4-M7','confirmed',[evidence(code+'csat/map/v4/definition.ts',65),evidence(code+'knowledge/authored/tasks.ts',4),evidence(code+'csat/map/v4/definition.ts',74),localEvidence('runtime-checks.json')],'정본 확인 키는 중심 TASK 하나만 받는다. 창작 키도 task별 하나로 분리하며 별도 납품 경로를 통해 추가된다. V4의 정본 키 0, option-restate→E3 한 개를 실제 함수로 확인했다. 한 능력을 두 다른 TASK로 관찰할 수 있는 R3/R4 측정 중복 문제까지 해결하는 가드는 아니다.'),
 row('D4-handoff-5-omissions','confirmed',[evidence(formats,113),evidence(code+'knowledge/claim-support.ts',134),evidence(canon,536),evidence(skill,95),evidence('supabase/migrations/20261021175340_learning_outcomes_ai_factory_activation_approved_20261022.sql',884)],'누락은 아래 세부 항목으로 제시한다. 독립 검증은 평가 정본·제품 수정·현재 DB 승인 상태 확정을 하지 않는다.')
]
const omissions=[
 row('D4-N1-approval-policy','confirmed',[evidence('supabase/migrations/20261021175340_learning_outcomes_ai_factory_activation_approved_20261022.sql',884)],'저장소 SQL은 human OR revision/Gold 해시 결속 AI 결정 OR 제한된 DCP source_policy를 허용한다. 따라서 사람 승인만 남았다고 일반화하면 실행 정책과 충돌한다. SQL 존재를 현재 DB 적용·개별 자료 승인 완료로 읽지 않는다. DCP 대안은 guided_practice 한정이다.'),
 row('D4-N2-same-task-different-score','confirmed',[evidence(formats,113),evidence(code+'knowledge/claim-support.ts',134),localEvidence('runtime-checks.json')],'R5 창작은 선택+중심 문장만 정답 조건이고 기존 claim-support는 근거+관계도 필수다. r5-cm-ind-1에서 supportOk=false/relationOk=false/isCorrect=true를 재현했다. 자체 명시 계약이라 구현 버그로 단정하지 않지만 두 키를 동일 측정 범위로 합치면 충돌한다.'),
 row('D4-N3-observation-vs-need','confirmed',[evidence(canon,370),evidence(canon,536),evidence(code+'knowledge/evidence-locate.ts',104),evidence(skill,110)],'R2의 관찰 근거 내역만 및 E3의 함정 선택만으로 약함 판정 금지 제한을 공통 약점 확정에 반영하지 않는다. E3 lure 정오 false 두 개는 공통 실패 규칙에 들어갈 수 있다.'),
 row('D4-N4-future-passage-duplication','confirmed',[evidence(code+'knowledge/authored/authored-items.ts',141),evidence(code+'csat/map/v62/assessment-exposure.ts',40)],'validateAuthoredSet은 passageGroup 문자열의 교수/평가 혼합을 검사한다. 실제 본문 해시 중복을 이 함수에서 검사하지 않는다. 공급 시 노출 원장의 같은 지문 방어는 별도로 있으므로 제품 전역 방어가 없다고 확대하지 않는다.'),
 row('D4-current-release','unclear',[evidence(code+'csat/map/load.ts',299)],'이번 DB 조회는 D1 원천 테이블만 읽었다. 현재 AI/사람 결정·권리·자격·출시·개별 학습자 납품은 미조회다. 과거 패킷의 0건을 현재 값으로 쓰지 않는다.')
]
const allDist=git(base+'D3-principles/distractor-logic.jsonl').trim().split('\n').map(JSON.parse)
const counts=rs=>rs.reduce((a,r)=>(a[r.verdict]=(a[r.verdict]??0)+1,a),{})
const top=[
 {rank:1,ids:['D4-handoff-2-M1'],gap:'선행 실패 없이 이미 가능한 TASK의 도달 근거 경로',impact:'성공만 한 학습자가 checking에 남아 이미 가능한 TASK를 재확인하게 될 수 있다.',next:'실패를 선행 조건으로 요구하지 않는 성공 근거와 도달 상태 계약을 정하고 PLAN 경로까지 검증한다.'},
 {rank:2,ids:['D4-handoff-1','D4-task-S1','D4-task-S5','D4-task-E1'],gap:'TASK 도달 조건과 공통 연속 2정답 판정의 불일치',impact:'같은 날 성공을 다른 날 유지로, 문항 차이를 새 문맥으로, 한 유형·포인트를 범위 전체 성공으로 과대해석할 수 있다.',next:'정본의 날짜·문맥 identity·포인트·유형·횟수 조건을 각각 결속한다. 승인되지 않은 최소 간격은 임의로 정하지 않는다.'},
 {rank:3,ids:['D1-insert-sentence-missing-262','D1-M2709','D1-2023-38','D1-redistribution-record-0'],gap:'원천 결손과 저장 형식 차이·권리 미정을 구분한 공급 적격 근거',impact:'최신 시험 공백과 실제 선지 결손은 공급을 제한한다. 반대로 접두 삽입 문장을 놓치면 정상 후보를 대량으로 부적격 처리한다.',next:'삽입 대상/본문 경계를 전량 복원 대조하고 권리 상태는 명시 원장으로 결속한다. DB 수정은 별도 승인 범위다.'},
 {rank:4,ids:['D4-task-R2','D4-task-E3','D4-N2-same-task-different-score','D4-N1-approval-policy'],gap:'확인 키별 측정 범위·관찰 제한·승인 정책 결속',impact:'키의 존재를 TASK 전체 평가 가능으로 읽거나 다른 채점 범위를 하나의 성취로 합치면 잘못된 목표 상태를 만든다.',next:'도구별 관찰 범위와 상태 승격 제한을 명시하고 동일 revision의 결정·자격·납품을 읽어 확인한다.'},
 {rank:5,ids:['D2-R3-boundary','D3-grammar-category-absent','D3-order-granularity-gap'],gap:'R3 경계와 오답 왜곡 범주 적용 기준',impact:'AI 일치 후보라도 관련성·오답 원인을 확정할 수 없고 NeedRank·진단 입력으로 넘기면 불확실성이 사라진다.',next:'R3 역할 해석/명명 경계, 정상 어법 유인/형태 오류, 순서 연결 단절 범주를 계약에서 구분하고 같은 원문으로 재검증한다.'}
]
const report={task:'T-0088',owner:'goal-data-independent',language:'ko',nature:'Codex 독립 AI 검증 · 사람 Gold 아님 · 출시/DB 변경 승인 아님',inputs:{d1_d3:execFileSync('git',['rev-parse',sha],{encoding:'utf8'}).trim(),d4:execFileSync('git',['rev-parse','1b8f089e5'],{encoding:'utf8'}).trim(),d4_code:sha,goal_plan:'c44f41a5cbab4348908e7bc18fe39e09ad183592',local_originals:'D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b2-v2/input.json',partial_draft:'임시 초안은 참고했으나 이 결과의 증거가 아니다. 아래 판정은 원문·실제 코드·DB 조회 및 메모리 실행으로 재검증한 범위만 담았다.'},verdict_semantics:'confirmed=명시된 좁은 주장/선택한 후보가 근거로 지지됨. refuted=명시된 주장 또는 특정 트랙 분류를 반박함. unclear=자료·계약 경계 부족. 관련성 후보 지지와 실제 학습자 수행 검증을 구분한다.',db:{method:'PostgREST GET만 사용(SELECT 의미). RPC/SQL 실행·DB 쓰기 없음.',at:db.queried_at,evidence:localEvidence('db-checks.json'),requests:db.results.length,all_http_200:db.results.every(r=>r.status===200)},d1,d2:{selection:checks.selection,r1:d2r1,disputes:d2disputes,summary:{r1:counts(d2r1),disputes:counts(d2disputes),r3_reviewed:11,structural_contract_errors:checks.checks.filter(c=>c.group!=='d3'&&c.errors.length).length,confirmed_boundary_violations:2,violation_unit:'A/B의 개별 TASK 판정 2개(표본 링크 60개 중 서로 다른 갈림 링크 2개)',counterfactual_false_confirmed:0,counterfactual_semantics_held:3,explanation_errors:2,explanation_error_details:['M2609#37 R1 B의 those 선행 대상 설명','M2609#25 S4 B의 병렬 구조 부재 설명'],counterfactual_note:'인용·오답 번호 형식 통과와 반사실의 실제 유인 효과는 다르다. 허위 확정 0은 60개 모두 참 또는 효과 검증을 뜻하지 않는다.'},r3_claim:row('D2-R3-boundary','confirmed',[sourceLines(base+'D2-task-mapping/CONTRACT_V2.md','TASK 별 경계'),sourceLines(base+'D2-task-mapping/mapping-review.md','R3 κ')],'R3 경계 행 부재와 11개 전수 갈림을 확인했다. 개별 관련성 판정은 unclear를 유지한다.'),product_use:'모든 relevance=unknown 유지. 이 결과를 NeedRank/진단/숙달 근거로 직접 쓰지 않는다.'},d3:{sample:d3,claims:d3Claims,summary:{sample:counts(d3),sample_count:30,grammar:4,order:4,source_gap:2,classification_refuted:1,meaning:'함축 ② A 과일반화 1개 반박. 어법 4개는 레이블 적용 범위가 모호해 unclear.',full_recount:{total:allDist.length,source_text:allDist.filter(r=>r.evidence==='source_text').length,agree_source_text:allDist.filter(r=>r.evidence==='source_text'&&r.distortion.agree).length}},product_use:'왜곡 유형을 학습자 오답 원인·진단 판정 입력으로 쓰지 않는다.'},d4:{handoff:d4,tasks:d4tasks,omissions,summary:{tasks:counts(d4tasks),task_count:21},runtime:{assertions_passed:14,evidence:localEvidence('runtime-checks.json'),scope:'고정 fixture의 순수 함수 재현. 공개 화면·DB 납품 E2E 통과 아님.'}},top_5_gaps:top,verification:{passed:['고정 커밋 git show 입력 읽기','D1 GET 6개 HTTP 200','D2 R1 30+갈림30/R3 11 원문 대조','D3 오답30 원문 대조(도표2 unclear)','90표본 원문 SHA와 인용/반사실 형식 검사','D4 실제 TS 순수 함수 메모리 재현 14 assertions · D4 입력 해시38개 일치'],unrun:['262 삽입 문항 공식 원본 PDF 전량 대조','현재 승인·권리·자격·납품 DB 조회','공개 학습자 E2E','앱 전체 lint/typecheck/test(제품 코드 변경 없음)'],git_commit:{status:'blocked',reason:'git add 단계에서 중앙 Git worktree index.lock 생성 Permission denied. 인덱스·커밋 변경 없음. 권한 우회·push·통합 없음.',path:'D:/workspace/Vocaflow/.git/worktrees/Vocaflow-goal-data-review/index.lock'},scope_safety:'제품·DB·D1–D4 폴더 수정 없음. 이 review 경로의 자기 파일만 커밋. push 없음.'}}
fs.writeFileSync(`${dir}/verdict.json`,JSON.stringify(report,null,2)+'\n')
const md=`# T-0088 — D1–D4 독립 검증\n\n이 결과는 Codex의 AI 검증이며 사람 Gold·출시 승인·DB 수정 승인이 아니다. D1–D3 입력은 \`${report.inputs.d1_d3}\`, D4 입력은 \`${report.inputs.d4}\`다. 코드 근거는 D4 input_head의 38개 입력 해시와 일치함을 확인한 이 worktree의 \`80fa44540\`에 고정했다. PLAN은 \`feat/goal-plan@${report.inputs.goal_plan}\`을 읽기만 했다. 항목별 판정·파일:줄·원문 SHA는 [verdict.json](./verdict.json), 표본 선정과 기계 검사는 [sample-checks.json](./sample-checks.json)에 있다.\n\n## D1 — DB 직접 조회\n\n[db-checks.json](./db-checks.json)에 GET 쿼리·관측 시각·결과를 보관했다. SELECT 의미의 GET 6개가 모두 HTTP 200이었고 RPC·쓰기 요청은 없었다.\n\n| 주장 | 판정 | 확인한 범위 |\n|---|---|---|\n| 삽입 262개 raw_block null | confirmed | 262/262 재현. 문장 결손 확정과 구분 |\n| 주어진 문장 262개 결손 | unclear | 2025#38·#39는 삽입 대상에 해당하는 접두 문장이 passage에 존재. 전량 경계 복원·공식 PDF 대조 미실행 |\n| null만으로 전체 부적격 처리 | refuted | 저장 형식 차이 반례 때문에 일괄 제외 불가. D1 자체도 후보라고 유보함 |\n| M2709 미적재 | confirmed | 시험 id/학년도·월 대체 검색 및 해당 문항 조회 빈 배열 |\n| 2023#38 choices null | confirmed | body_ok=true와 함께 확인 |\n| D1 권리 기록 기준 적격 0(미정) | confirmed | source_note 있는 시험은 문항 없는 M2009뿐 |\n| 법적 재배포 가능 문항이 0개 | unclear | 별도 권리 계약·원장을 전량 검토하지 않음 |\n\n삽입 대상 문장의 분리 필드가 없다는 문제는 남지만, 이를 문장 내용 자체의 결손으로 바꾸면 정상 공급 후보를 대량 배제할 수 있다. 이번 두 반례를 262개 전체의 정상 판정으로 일반화하지 않는다.\n\n## D2 — 관련성 후보 30 + 갈림 30\n\nR1은 입력 순서의 서로 다른 문항 첫 링크 30개(도표 #25·삽입 #38/#39 제외), 갈림은 R3 11개 전부와 나머지 입력 순서 19개를 골랐다. 의도 표본이며 모집단 정확도 추정이 아니다. 로컬 b2-v2 원문과 선지·발문을 대조하고 A/B 근거도 읽었다.\n\n- R1 판정: ${JSON.stringify(counts(d2r1))}. 이는 관련성 후보의 최소 한 판단 경로 지지이며 직접 관찰·사람 확인을 뜻하지 않는다. M2609#37 B의 those 선행 대상 부연은 잘못됐지만 B 첫 문장의 지시 연결로 R1 경로는 성립한다.\n- 갈림 판정: ${JSON.stringify(counts(d2disputes))}. R3 11개는 모두 unclear다. 역할 해석이 기여하는 것과 역할 명명 자체를 요구하는 것의 경계가 계약에 없다.\n- **확인한 v2 의미 경계 위반 2개**: M2609#29 E1의 B(부정 발문인데 표준 발문이라 무관), M2609#30 E2의 A(다른 문장 근거인데 indirect). 인용·반사실 스키마·원문 SHA 검사는 오류 0개였다. 형식 통과가 의미 검증을 대신하지 않는다.\n- **반사실 허위 확정 0개, 의미 지지 보류 3개**: M2609#20 V3(비유 오독→동료 평가), #25 S4(도표 수치 없음), #30 R4(점층 오독→permanently). 허위 확정 0을 참 60개나 유인 효과 확인으로 바꾸지 않는다. #25 B의 병렬 구조 부재 설명도 실제 higher/lower 병렬과 충돌한다.\n\nAI 후보의 relevance=unknown은 유지한다. 이 검증만으로 NeedRank·진단 입력 자격이 생기지 않는다.\n\n## D3 — 오답 왜곡 30\n\n어법·순서 각 4개를 먼저 포함하고 b2-v2 유형별 표본으로 30개를 구성했다. 결과는 ${JSON.stringify(counts(d3))}다. 도표 2개는 수치가 없으므로 정답 번호로 역산하지 않고 unclear다.\n\n**어법 범주 부재 주장은 refuted**다. v1을 상속한 v2 계약에는 form_error가 이미 있다. M2609#29의 정답 아닌 네 선지는 옳은 형태인데 A는 other, B는 form_error로 분류했다. 두 트랙 모두 옳은 형태라는 설명은 맞지만 form_error의 의미가 실제 오류인지 어법 유인 일반인지 모호하다. 개별 네 레이블 판정은 unclear로 두며 정상 형태 유인의 적용 경계를 보완해야 한다.\n\n**순서의 분류 정밀도 공백은 confirmed**다. 네 오답 모두 other로 합의했지만 지시 선행·대조 대상·과정/효과 배열 단절이 구별되지 않는다. other 사용은 현 계약에서 허용된다.\n\n전수 산술을 다시 계산한 원문 근거 왜곡 일치는 ${report.d3.summary.full_recount.agree_source_text}/${report.d3.summary.full_recount.source_text}다. 이것은 A/B 일치이며 정확도나 학습자 오답 원인이 아니다. 30개 중 범주 반박 1개는 M2609#21 ② A의 과일반화다. 어법 4개는 원문 설명이 맞고 레이블 적용 범위만 모호하므로 unclear다. 범주가 겹치는 나머지 항목은 원문 설명이 맞더라도 단일 레이블을 억지 확정하지 않았다.\n\n## D4 — handoff 5항목\n\n1. **판정 코드 주장 confirmed**: skill-diagnosis.ts:91–133은 독립 첫 시도·확정 후 순서·120일 상한·연속 2정답을 본다. 다른 날·지문 identity·공급 역할은 입력 조건이 아니다. supply.ts의 역할 자격, lifecycle-evidence.ts의 회차 후 수행/전이 운영량, evidence-claims.ts의 NOT_ESTABLISHED를 지연 기억 판정으로 혼동하지 않았다. 공급 노출 원장에는 같은 지문 방어가 별도로 있다.\n2. **M1 confirmed**: 성공만 4회는 unverified이며 As-Is의 독립 근거가 있으면 checking에 남는다. feat/goal-plan의 plan.ts:32와 goal-plan.ts:106은 이를 도달로 바꾸지 않는다. 현재 후속 목표 엔진의 개발 상태는 이번 결론 범위 밖이다.\n3. **21분류 전체는 refuted**: TASK별 ${JSON.stringify(counts(d4tasks))}. R2는 기출 2022#36 cohesion-link에 연결되나 관계 종류+근거 단서를 직접 받지 않는다. E3는 기출 option-restate에 연결되나 함정 선택만으로 약함 판정 금지 제한이 공통 실패 판정에 반영되지 않는다. 좁은 도구 실행 가능과 전체 도달 계약 충족을 구분한다. V4·R6는 형식 외 추가 도달 조건 누락은 찾지 못했지만 현재 승인·자격·납품은 unclear다.\n4. **M4 전체 refuted / M7 좁은 방어 confirmed**: 연습 화면·도움·해설 뒤·시각 불확실 제외는 맞다. 합성 제외는 실제 코드가 synthetic:false로 바꿔 우회한다. M7의 정본 키는 중심 TASK 하나에만 붙으며 창작 키도 TASK별로 분리된다. R3/R4의 측정 중복까지 막는다는 뜻은 아니다.\n5. **누락 confirmed**: R5 창작과 기출의 채점 범위 차이, R2/E3 관찰 제한과 약점 확정 충돌, 사람 전용 분류와 SQL의 AI 결정 허용 정책 차이, passageGroup 이름만 보는 세트 검증의 한계를 기록했다. 현재 DB 승인 상태는 추정하지 않는다.\n\n[runtime-checks.json](./runtime-checks.json)의 순수 함수 실행에서 성공만→unverified, 같은 날 같은 지문 메타데이터 2실패+2성공→resolved, 합성만→resolved, 연습/해설 뒤→unverified를 재현했다. R5 창작 r5-cm-ind-1은 근거·관계가 모두 틀려도 선택·중심이 맞으면 isCorrect=true였다. 실제 TS를 메모리에서 변환해 실행했으며 앱 파일·캐시·DB를 쓰지 않았다. 초기 실행은 이 worktree 의존성 부재·fixture 경로·응답 enum 문제로 실패했고 이를 수정한 최종 실행 14 assertion이 통과했다. E2E 통과로 보고하지 않는다.\n\n## 검증·변경 범위\n\n고정 git 객체·로컬 원문 읽기, D1 DB SELECT, 원문 해시·인용 검사, 순수 함수 재현을 수행했다. 제품 코드 변경이 없어 앱 전체 lint/typecheck/test 및 화면 E2E는 미실행이다. 공식 삽입 원본 전량 대조와 현재 승인·납품 상태 조회도 미실행이다. 기존 임시 D4 초안은 판단의 출처나 통과 증거로 사용하지 않았다. 다른 세션이 생성한 파일은 수정·커밋하지 않는다. 이 검토는 제품 수정·DB 적용·main 통합을 수행하지 않으며 사용자가 지정한 review 브랜치에서 자기 review 파일만 git add/commit --only로 커밋하려 했으나 중앙 Git의 index.lock 생성 권한이 거부되어 git add 단계에서 차단됐다. 커밋·통합·push는 미완료이며 권한을 우회하지 않았다. 차단 경로: D:/workspace/Vocaflow/.git/worktrees/Vocaflow-goal-data-review/index.lock.\n\n## 목표 달성 시스템 영향 기준 공백 상위 5개\n\n${top.map(t=>`${t.rank}. **${t.gap}** — ${t.impact} 다음 검증: ${t.next}`).join('\n\n')}\n`
fs.writeFileSync(`${dir}/review.md`,md)
console.log(JSON.stringify({d1:counts(d1),d2_r1:counts(d2r1),d2_disputes:counts(d2disputes),d3:counts(d3),d4_tasks:counts(d4tasks)}))
