// scripts/research/csat-reading/v12-strategy-report.mjs
// Report original statistics and subsequent critiques as separate evidence layers.
import fs from 'node:fs'
const base='docs/research/csat-reading/',dir=base+'data/v12/',read=p=>JSON.parse(fs.readFileSync(p,'utf8')),x=read(dir+'pilot-agreement.json'),logic=read(dir+'pilot-logic-review.json'),window=read(dir+'window-review.json'),corrected=read(dir+'window-corrected-review.json'),intervals=read(dir+'descriptive-intervals.json')
const names={contrast:'대립·대조',core_sentence:'중심 문장',selective:'선택적 읽기',incremental:'직독직해/제시순서 누적',syntax:'구문 해부',meaning_units:'의미 단위 읽기',proposition_relations:'명제 관계',structure_reconstruction:'글 구조 복원',evidence_option_comparison:'근거 중심 선지 비교',type_specific:'유형별 접근'}
const pct=x=>x===null?'미정의':(100*x).toFixed(2)+'%',k=x=>x===null?'미정의':x.toFixed(3)
const lines=[`<!-- ${base}V12-C-STRATEGIES.md -->`,'# C. 전략 충분성·독립 검증 보고서','','2026-10-14 · v1.2 준비 파일럿. 사전등록commit `bc4649287`, source입력동결과 최초제출hash는 [registration](./data/v12/pilot-registration.json)·[execution](./data/v12/pilot-execution.json). 원문전문/정답은ignored로컬에만보존한다.','',
 '새2014~2024 본시험16문항·16유형·16공유지문을 기존64/공유·정규화같은본문과 분리해 선정했다. 선정분모244는 메타데이터 적격 발견집합이며 목적 표집이다.2014A/B를 별도 책자로 두고12책자에분산했다. 모평 추가0. 누적 독립연구 대상은80문항(본시험72·모평8)이지만 코드북·source 수준이 달라 하나의동일척도분포로계산하지않는다.','',
 '실제 로컬 문제PDF와같은형 정답표를16/16 직접 대조했다. 본문·발문·다섯후보·각주14개·제시형은 complete16의 최초 source 판정을 보존한다. 파생단위116개 가운데2014A#40의 Ms.가 문장으로 분리된 결함은 사후별도 원장에 기록했다. 원문 문자가 사라진 것이 아니라 분석단위의 경계 결함이다. 공식다운로드계보·인간검수·권리확정은별도미해결이다.','',
 'A/B는 새문맥(fork none)에서 정답·기존v3·이전판정·상대판정을 보지 않고16문항을직접읽었다. 첫8부분초안과첫완성본을 보존했고 두 완성본을 동결한 뒤 정답을 공개했다. 같은모델설정/사전학습미노출은보장하지않는다. 두답은각각16/16정답표와같지만 설명의충분성이나교수효과와별개다.','',
 '## 최초 독립 분류','','| 축 | 실제 첫 일치 | κ/해석 | 사전 수치 |','|---|---:|---|---|',
 `| 담화 목적 | ${pct(x.axes.discourse.raw_agreement)} | κ=${k(x.axes.discourse.kappa)} | 통과 |`,
 `| 실제 평가 요구 | ${pct(x.axes.task.raw_agreement)} | κ=${k(x.axes.task.kappa)} | 통과 |`,
 `| 결정관계 | ${pct(x.axes.decisive_relations.mean_jaccard)} | 평균Jaccard | 수치 통과·필요성 정의 미해결 |`,
 `| 추론 | ${pct(x.axes.inference.mean_jaccard)} | 평균Jaccard | **70% 미달** |`,
 `| 언어 복잡성/결정명제 성분 | ${pct(x.axes.complexity.mean_jaccard)} / ${pct(x.axes.proposition.mean_jaccard)} | 기술 자료 | 독립확대확정 아님 |`,
 `| 보기 textual_support | ${pct(x.axes.option_textual_support.raw_agreement)} | κ=${k(x.axes.option_textual_support.kappa)} | 평가 대상·기준 문맥의 차이 보존 |`,
 `| 보기 task_fit | ${pct(x.axes.option_task_fit.raw_agreement)} | κ=${k(x.axes.option_task_fit.kappa)} | 동일 답과 밀접; 충분성 검증 아님 |`,
 '', '80개보기는16문항내종속관찰이다. 주축/전략/언어 성분을 합치면16문항모두에차이가있다. 사후합의로지우지않았다. 배경관계Jaccard79.17%도원장에보존했다.','',
 `사후 기술용 지문군집bootstrap1,000회(seed20261014)의 결정관계 구간은 ${pct(intervals.intervals.decisive_relations.low)}~${pct(intervals.intervals.decisive_relations.high)}, 추론은 ${pct(intervals.intervals.inference.low)}~${pct(intervals.intervals.inference.high)}다. 목적표집의 기술적 재표집 구간이지 모집단/미래시험의 신뢰구간이 아니다. 담화/요구의1~1 구간도미래의확실성을뜻하지않는다. 이전표본과의차이를방법개선의인과효과로해석하지않는다.`,
 '', '## 전략별 AI/FOV 최초 통계','','AI는정답식별, FOV는다섯후보의개별과제적합성검수다. sufficient/conditional을긍정으로묶되두상태의exact일치는별도로계산했다. 유일정답가정은conditional이며나머지후보의성립을증명하지않는다. 아래는방법상태의일치도이고학생성공률/효과가아니다.','',
 '| 방법 | AI exact / 긍정일치 / κ | FOV exact / 긍정일치 / κ | 긍정 A/B: AI; FOV | 수치 AI/FOV | 논리 확대 |','|---|---|---|---|---|---|']
for(const [m,s]of Object.entries(x.methods))lines.push(`| ${names[m]} | ${pct(s.AI.exact_excluding_defer_over_all)} / ${pct(s.AI.positive_agreement)} / ${k(s.AI.kappa)} | ${pct(s.FOV.exact_excluding_defer_over_all)} / ${pct(s.FOV.positive_agreement)} / ${k(s.FOV.kappa)} | ${s.AI.positive_counts.join('/')}; ${s.FOV.positive_counts.join('/')} | ${s.AI.numeric_pass?'통과':'미달'}/${s.FOV.numeric_pass?'통과':'미달'} | 미허용 |`)
lines.push('','대립AI는긍정각2개여서최소3미달이고FOV는긍정0이다. 모두불충분이라는100%일치를전략타당성으로읽지않는다. 근거비교/유형접근은모든16개가긍정이라κ가미정의다. 사전게이트를사후완화하지않았으며, 이실패는방법의비효과가아니라변별적재현성검증을못한상태다.','',
 '## 방법 정의·성립 조건·반례','','| 방법 | 허용 정보·선행 이해 | 지지와 경계 | 교수/효과 상태 |','|---|---|---|---|',
 '| 대립 | 같은차원의 실제 두명제를 대비; 주체·범위·방향 이해 필요 | 2023#20 직관/확률,2021#22 비평가/대중 관계. 둘만으로 전체 요지와 모든후보를항상판정하지못함 | 관계를직접설명하게할후보; 효과미검증 |',
 '| 중심문장 | 실제한완성문장; 외부지시와전역대표성가정별도 | 2014A#40 감정표현,2020#29 국소어법오류. 2018#18 요청문을편지전체의독점목적이라고하면정보초과 | 문장중요성과대표성확인을분리; 효과미검증 |',
 '| 선택적 읽기 | 연속최대2문장/안내항목,지정된표행·열; 발문/후보정보별도 | 2016#25 적진정보·2022#25 값변화는conditional AI.2022#44 다문장블록을한문장으로세는것은범위위반 | 학생읽기행동·속도미측정; 효과미검증 |',
 '| 직독직해 | 제시순서로명제·참조누적; 재배열/삽입/제거/수치비교별도 | 전체문장으로의미를누적하는경로존재.2014B#38 배열·2018#39 삽입·2022#25 수치계산을추가해야하는조건 | 누적이해연습후보; 시간/효과미검증 |',
 '| 구문 해부 | 하나의국소의존과어휘의미; 지시대상/담화초점은외부정보 | 2020#29 inhabited 형태판정conditional AI; 다른네밑줄검수는불충분.2016#25 he의대상을단순구문으로강제하지못함 | 구조명암기와의미구성을분리; 효과미검증 |',
 '| 의미단위 | 구절/절을주체·술어·조건으로구성 | 전체의미구성지지.표계산·후보비교까지암묵포함시키면합성방법이므로단독충분성아님 | 끊기→의미보존응답을관찰할후보; 효과미검증 |',
 '| 명제 관계 | 실제명제의인과·대조·지시연결과방향 | 순서/삽입연결에사용.관계의존재와각해결경로의필수관계를혼용하지않음 | 연결 근거와대안경로설명후보; 효과미검증 |',
 '| 글 구조 복원 | 역할·배열·전개를재구성; 문장뜻선행 | 2014B#38 사각형→사다리꼴→선→유사사례.최선결속을논리적불가능/세계거짓으로바꾸지않음 | 블록라벨/역할/후보배열비교후보; 효과미검증 |',
 '| 근거 선지 비교 | 발문의극성과후보조건을실제근거에대응 | 2017#25 불일치/2024#28 일치 교차대조.전체근거·연산사용은합성경로;모든후보truth와fit를같게하지않음 | 독립검수과제후보; 효과미검증 |',
 '| 유형별 접근 | 탐색시작정책+실제지시/문법/숫자/결속검증 | 유형이찾을대상을안내할수있으나유형이름/연결어하나가의미이해를보장하지않음 | 조건부절차후보; 효과미검증 |',
 '', '## 창만 받은 새 AI의 독립 검토','','[첫창 등록](./data/v12/window-registration.json)·[첫16검토](./data/v12/window-review.json). B의첫긍정방법을고정우선순위로선택해16창(본문기준부분창13)을만들었다. 새문맥에는선택한unit/cell/각주·발문·후보만주고정답과원판정·설명·밖의본문을주지않았다. 이는사후탐색적AI정보범위검사이며학생실험이아니다.','',
 '첫 결과는 AI sufficient1/conditional12/insufficient3, FOV sufficient1/conditional1/insufficient14다. 원래 narrow 판정의 일부는전역초점·주제대표성가정을필요로했다.2022#44는한대상밖에보이지않으므로유일정답가정을넣어도번호를식별하지못했다.2019#30은relative advantage와laborious capture의공존가능성을남겼다.','',
 '처음의 창 생성 코드가2014B#38의A/B/C라벨대응과2019#40의요약틀을누락한것도발견됐다. 이두개를독해방법반증으로세지않았다. 원첫입력/결과를보존한채 [별도수정등록](./data/v12/window-correction-registration.json)과새문맥의 [2개검토](./data/v12/window-corrected-review.json)를추가했다. 수정창은각각④/①을선택하고AI/FOV sufficient로판정했다. 요약에는본문u4뿐아니라질문자극u5를추가했다고명시했다. 따라서 ‘정보전체를한문장만읽었다’거나독립학생전이성공이라고표현하지않는다.','',
 '수정창의두결과를첫16행에덮어써성공률을높이지않았다. 정답번호를낸첫13개는정답표와같았지만, 이조건부탐색결과를16개성공률/모든positive경로의확정으로사용하지않는다. 수정2개가같은고정입력의예산안에서성립한것과그창의구성정책자체가검증됐다는것도다르다.','',
 '본문 필드의 범위와 실제 제공한 의미 정보도 구별해야 한다. 2024#35는 본문창 2개지만 다섯 선택지가 원래 본문의 다섯 문장을 반복하여, 실제 제공한 본문 정보의 합집합은 5/7단위다.2022#25도 선택지가 본문의 다섯 후보 문장을 반복한다. 후보는 자기 진실의 근거로 쓰지 않지만 읽기량·정보 예산에서 사라지는 것은 아니다. [window-summary](./data/v12/window-summary.json)에 필드 중복을 기록했다. 좁은본문창 검사를 실제학생의총읽기량/속도 이점으로표현하지않는다.','',
 '## 독립 논리 검토와 재발 방지','','[별도논리원장](./data/v12/pilot-logic-review.json)은정답공개뒤16원문·32분류행·68경로·640방법/충분성상태를모두검토했다.44기록중13결함·22미해결·9긍정/none사례다.9문항에결함,13문항에미해결,합집합15문항이다. AI판정이므로이수치도인간정답검수나학생오류율이아니다.','',
 '1. 2018#18은요청행위의국소판별과전체목적의대표성이구별된다. 한요청문만보고다른모든목적을배제하는FOV는밖의문단에다른주요용건이있는반례에취약하다.',
 '2. 2022#44의(c)=Cora 하나만확인하면다른네개가Anna인세계와다른세개가Cora/하나만Anna인세계가모두4+1조건을충족한다. 따라서유일정답가정만으로(c)를고를수없다. A가Cora/Anna/Anna 세대상을확인한경로는별도의조건부대안이될수있지만두다문장블록으로좁은선택적읽기를통과했다고해서는안된다.',
 '3. 2019#30의수상수렵이상대적으로유리하다는정보는포획·살해에아무수고가없다는명제를필연적으로함의하지않는다. laboriously의문맥적최선판정과strict textual contradiction을분리한다. 이비판은원문문항/공식정답의오류판정이아니다.',
 '4. 2014A#40의호칭분할과장문block/sentence 예산은파생단위문제다. 원원문complete와동일형정답일치를소급부정하지않는다. 요약틀을질문조건으로예산외허용할지,주어진삽입문장을예산에포함할지는명시규칙을보완해야한다.',
 '5. 2018#39에서최선의응집·전개를고른다는과제와다른위치가어떤가상세계에서도불가능하다는논리명제는같지않다. 불충분/덜적합/미정/모순의기준문맥과비교강도를분리한다.',
 '', '첫검증기는unit ID수를세어다문장block을허용하는결함이있었다. 동결된첫검증기·첫일치도는보존하고 [보충범위검사](./data/v12/scope-guard.json)와회귀테스트를별도로추가했다. A/B2022#44긍정범위2건을차단하며호칭분할1건을기록한다. 정보범위검증기는원문텍스트동일성만검사해서는충분하지않다.','',
 '## 확대 판정','','**전체 확인적 확대와 전략 축의 전수 확장은 미허용**이다. 추론은수치미달,결정관계는필요성/대안경로정의미해결,전략은수치 또는논리/예산게이트를충족하지못했다. 수치통과9개의AI/FOV상태도논리결함이남아통과로승격하지않았다. 인간전문가/학생효과검증은별도미완료다.','',
 '논리검토에서도기술적범위가허용된담화·평가요구두축만개발문항32개의추가탐색재분류로연결한다([axis-extension](./data/v12/axis-extension.json)). 이미본개발표본이므로새독립확인·80개에더하는새32개가아니다. 결정관계노트가있어도승인된확대축으로세지않는다. R6~R8의기존자산후보/교육설계는이전략검증과독립된층위로계속수행했다.','',
 '다음판수정후보는질문정보예산·실제문장단위·글로벌대표성가정·대안경로별필요관계·best-fit/strict entailment의구별이다. 이번자료에서규칙을고쳐일치도가상승한것을새확인으로보고하지않는다.')
fs.writeFileSync(base+'V12-C-STRATEGIES.md',lines.join('\n')+'\n');console.log('C rendered: original first metrics, separate window results, logic gates and limits')
