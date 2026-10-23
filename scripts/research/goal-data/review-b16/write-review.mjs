// scripts/research/goal-data/review-b16/write-review.mjs
import fs from 'node:fs'
const out='scripts/research/goal-data/review-b16/',doc='docs/research/goal-data-batches/review-b16/'
const a=JSON.parse(fs.readFileSync(out+'audit.local.json')),s=JSON.parse(fs.readFileSync(out+'supplement.local.json')),g=JSON.parse(fs.readFileSync(out+'guards.local.json')),qa=JSON.parse(fs.readFileSync(out+'checks.local.json'))
const notes={
 '2020#38':['confirmed','생존 최적지와 번식 최적지의 불일치 뒤 텃새의 비용 감수, 철새 대조로 이어지는 배열이 ④를 지지한다. R4 묶음 교수 사례이며 E2·독립 진단으로 분리하지 않는다.'],
 '2020#39':['confirmed','시청자 분산에 대한 걱정에서 반론으로 바뀐 뒤 이점이 추가되는 경계가 ③이다. R4 후보를 지지하며 삽입 단독 수행 관측은 미확정이다.'],
 '2019#26':['confirmed','영화의 제목 동일 여부가 ④의 불일치를 만든다. 부정 발문 E1 후보는 지지되며 실제 결정은 E2·E3도 함께 필요하다.'],
 '2019#27':['unclear','예약 불필요인 주석과 ⑤의 반대 진술이 정답을 지지한다. E1 후보는 지지하되, 주석 위치 탐색 E2와 부정어 대조 E3의 primary 우열은 확정하지 않는다.'],
 '2019#29':['confirmed','수동태를 받는 대동사 형태 오류가 ②를 지지한다. E1은 제한된 TASK 집합 안의 후보이며 실제 어법 수행을 대체하지 않는다.'],
 '2019#30':['unclear','물 위에서 사냥하기 쉬운 문맥과 ⑤의 힘들다는 부사가 충돌한다. E1 후보는 지지한다. A는 같은 문장 운반 용이성을, B는 앞의 사냥 취약성을 근거로 삼아 E2 무관/간접이 갈린다. 운반과 사냥의 단계 차이는 B 근거에 유리하지만 계약 Gold는 미확정이다.'],
 '2020#26':['confirmed','자녀 수 세기의 불운과 ⑤의 행운이 반대다. E1 후보를 지지하며 E3가 실제 정답 대조에 관여한다.'],
 '2020#27':['unclear','이메일 제출 항목과 방문 제출 선지 ③이 반대다. 안내문 끝의 웹 방문 요청은 다른 기능이다. E1 후보는 지지하나 E2 탐색/E3 대조의 primary 우열은 미확정이다.'],
 '2020#29':['confirmed','관계절 내부의 수식 분사와 문장 본동사의 구별이 ④ 오류를 지지한다. E1은 부정 요구 후보이고 어법 주 수행은 집합 밖이다.'],
 '2020#30':['confirmed','나머지 설명을 채택하기 전에 다른 가능성을 살피라는 논지라 부정 동사 ④가 반대다. E1 후보는 지지하며 낱말 판단을 E1 단독 관측으로 주장하지 않는다.'],
 '2020#23':['unclear','도덕 발달에서 유전과 환경의 복잡한 상호작용이라는 중심은 ①을 지지한다. ②는 본문이 부정하는 대립 구도를 재사용한다. E3가 중심 확정 뒤 필수 대조인지 오답 경로만 있는 간접인지 갈림을 유지한다.'],
 '2020#33':['unclear','재료 공급 확보 능력이 기술 미래를 제한한다는 중심은 ⑤를 지지한다. ④의 정부 정책은 원문에 없다. A는 이 미언급을 중심으로 배제하고 B는 별도 대조로 배제하여 R5/E3 primary와 relevance가 함께 갈린다.'],
 '2019#21':['unclear','결과 집착을 반박하고 다음 질문과 새 무지 발견으로 나아가는 글이 ①을 지지한다. 언론 보도 단계와 반박 단계의 오독이 ④로 가는 B 반사실은 원문 근거가 있으나 R4 간접과 문장 기능 R3 경계는 미확정이다.'],
 '2019#23':['unclear','기후 대응의 목적과 원조·정책 개혁의 수단을 함께 담는 ②가 지지된다. 마지막 OECD 보조금 사례를 중심으로 삼는 경로는 있으나 ⑤의 국제 분쟁까지 가려면 추가 왜곡이 필요해 R4 간접/무관을 확정하지 않는다.'],
 '2019#31':['unclear','사회적 공유가 많을수록 기억이 고정된다는 문장은 ①을 지지한다. A는 한 문장 재진술 R5로, B는 고정·망각·부정 상쇄를 결합한 R6로 판단한다. 결합이 필수인지의 경계를 유지한다.'],
 '2020#19':['unclear','여행 전 기대와 도착 후 실망이 ①을 지지한다. 두 장면 구분은 발문이 주며 A의 R4 반사실에는 실망을 공포로 과장하는 별도 의미 왜곡도 들어가 R4 간접을 단정하기 어렵다.'],
 '2020#20':['unclear','어른이 놀이를 스스로 허락하라는 마지막 주장이 ①을 지지한다. 장애 설명을 주장으로 읽는 B 경로는 가능하나 원인 기능 R3와 전체 배열 R4의 경계는 미확정이다.'],
 '2020#21':['unclear','지식 없이 창의적인 모양만 보이는 부류가 ①을 지지한다. 직전 문장에 근거가 이미 주어졌다는 A와 두 부류 중 근거를 선택해야 한다는 B의 E2 간접/direct 경계를 유지한다.'],
 '2020#31':['unclear','과학주의의 배타적 진리 정의와 비과학의 주관성 평가가 ②의 중요성 낮음 의미를 지지한다. A는 정의와 결과 결합 R6, B는 정의 재진술 R5로 본다. 관용 표현 지식과 결합 필요성을 분리할 학습자·사람 판정이 없다.'],
 '2020#45':['unclear','차 안의 은퇴 고민과 폭포의 재도전 발언은 다르며 ③이 불일치다. A는 진술 대조 E3, B는 장면 위치 선택 E2를 primary로 둔다. 두 근거 모두 원문에 결속하지만 단일 우열은 미확정이다.'],
}
const rowReviews=a.dossier.map(d=>({item:d.id,status:notes[d.id][0],why:notes[d.id][1],evidence:d.evidence,candidate_tasks:a.sample.candidates.filter(r=>r.item===d.id).map(r=>r.task),disputed_tasks:a.sample.disputed.filter(r=>r.item===d.id).map(r=>r.task),primary_disputed:a.primary.some(r=>r.item===d.id)}))
if(rowReviews.length!==20||a.primary.some(p=>!rowReviews.some(r=>r.item===p.item)))throw Error('Sample/primary coverage missing')
const findings=[
 {id:'P1-01',severity:'P1',status:'confirmed',title:'외부 반복 배제가 자기 청크의 실제 누락을 숨긴다',evidence:['scripts/research/goal-data/d2-run.mjs:79','scripts/research/goal-data/d2-run.mjs:80','scripts/research/goal-data/review-b16/guards.mjs:56'],reproduction:'b16 A01 첫 3문항에 반복 사유를 넣고 A02 출력 파일은 rows=[]로 둔다. validate A 02는 통과 0/20·결함0·exit0. 파일 존재만으로 자기 청크 누락을 모두 배제 탓으로 간주한다.',impact:'분석자는 기다리라는 안내를 받고 누락된 자기 출력을 고치지 못한다. 현재 agree는 트랙을 배제하므로 잘못된 링크 적재는 재현되지 않았다.',recommendation:'자기 청크의 실제 ID 집합·행 유효성·누락을 트랙 배제 이전에 확인한다. 트랙 배제로 생긴 출력 없음만 별도 상태로 표시한다.'},
 {id:'P1-02',severity:'P1',status:'confirmed',title:'반복 그룹의 처음 세 ID로 참여 청크를 추정해 네 번째 문항이 사라진다',evidence:['scripts/research/goal-data/d2-validate.mjs:134','scripts/research/goal-data/d2-run.mjs:78','scripts/research/goal-data/d2-run.mjs:80'],reproduction:'b16 A01 첫 3문항과 A02 첫 문항에 동일 사유를 둔다. 트랙 오류는 앞의 3개 ID만 싣고, validate A 02는 자기 문항도 반복 그룹 소속인데 결함0·exit0이다.',impact:'청크 경계를 넘는 반복을 해당 분석자가 고칠 수 없고, 서로 기다리는 상태가 가능하다. agree의 out.clear는 유지돼 결합 유출은 없다.',recommendation:'오류를 문자열로 역해석하지 말고 전체 affected_item_ids·chunk·kind를 가진 구조로 전달한다. 화면에 보일 ID만 자기 청크로 제한한다.'},
]
const acceptance=[
 {index:0,status:'confirmed',why:'20/20 회귀와 실제 1+1·1+2 runner 차단, 임의 E2 차단, 32트랙 재적용 적발4/허용b6, 문항별 정당 설명 허용을 재현. 정확 비교는 공백 정규화 이후이며 구두점 변형은 예외가 아니다.',evidence:['scripts/research/goal-data/d2-validate.mjs:20','scripts/research/goal-data/d2-validate.mjs:131','scripts/research/goal-data/review-b16/guards.mjs:10']},
 {index:1,status:'refuted',why:'정상 자기 청크·교차 청크 ID 가림과 배제 트랙 결합 차단은 확인했지만 P1-01/02로 자기 누락과 네 번째 반복 참여가 결함0으로 숨는다.',evidence:['scripts/research/goal-data/d2-run.mjs:78','scripts/research/goal-data/d2-run.mjs:80','scripts/research/goal-data/d2-validate.mjs:165']},
 {index:2,status:'confirmed',why:'40선정·해시·κ·34/40·경보·history·dedup을 재현하고 프롬프트와 노출 예외를 기록. 절대 독립성과 의미 Gold는 확인한 사실에 포함하지 않는다. 노출 셋이라는 문서 수치는 refuted(네 분석자).',evidence:['docs/research/goal-data-batches/D2-task-mapping/b16-v24-agreement.json:1','scripts/research/goal-data/review-b16/supplement.mjs:8','scripts/research/goal-data/review-b16/row-review.md:1']},
 {index:3,status:'unclear',why:'후보10·갈림10 및 primary갈림6의 원문 대조를 완료. 연구 후보 근거는 지지하되 의미 갈림·primary 단일 우열·사람 Gold는 미확정.',evidence:['docs/research/goal-data-batches/D2-task-mapping/b16-v24-review-sample.json:1','scripts/research/goal-data/review-b16/row-review.md:1']},
 {index:4,status:'confirmed',why:'verdict/review, 새 P0=0/P1=2, b17 보류와 unclear를 기록.',evidence:[doc+'verdict.json:1',doc+'review.md:1']},
]
const verdict={task_id:'T-0124',owner:'goal-data-independent',session:'t-0124-codex',source_commit:a.rev,base_commit:a.old,observed_at:new Date().toISOString(),type:'review',result:'pass',result_meaning:'검증 수행 완료; 모든 수용 주장 통과를 뜻하지 않음',skip_count:0,acceptance,checks:{total:qa.checks.length,failed:qa.checks.filter(c=>!c.pass).length,source_packets_unchanged:qa.unchanged},new_P0:0,new_P1:2,findings,b17:'보류 — 실행기 P1-01/02를 수정하고 두 반례·기존 청크 가림을 회귀한 뒤 연구 후보 확대만 재개',unclear:['학습자 수행·학습효과','사람 Gold·의미 갈림과 primary 단일 우열','로그 밖 접근·오염 인과 부재','현 DB 상태(DB scope none)','관측 필드 정의와 재판정은 계속 유예·근거 사용 금지'],metrics:{overall:a.overall,per_task:a.per,primary_agree:34,total:40,r1:81,disputed:13,combined_items:546,combined_r1:1293,combined_disputed:493},row_reviews:rowReviews,history_changes:s.citations,dedup:{rows:16,removed_entries:16,other_fields_unchanged:true},exposure:{analysts:4,evidence:s.exposures},unrun:['DB 읽기/쓰기','제품 빌드·E2E','학습자 측정','원격/main 통합']}
fs.writeFileSync(doc+'verdict.json',JSON.stringify(verdict,null,2)+'\n')
fs.writeFileSync(out+'row-review.md','# b16 원문 독립 대조\n\n후보10·갈림10·primary 갈림6을 합친 고유20문항. 원문과 명령 출력은 *.local.json에만 보존한다. confirmed는 해당 연구 후보 근거 지지이며 사람 Gold나 직접 관측 확인이 아니다. 후보와 갈림이 겹치는 문항은 행 전체의 불확실성을 유지한다.\n\n|문항|판정|원문 대조|파일:줄|\n|---|---|---|---|\n'+rowReviews.map(r=>`|${r.item}${r.primary_disputed?' (primary 갈림)':''}|${r.status}|${r.why}|${r.evidence.join('; ')}|`).join('\n')+'\n')
const md=`# T-0124 · 틀 가드·청크 실행기·b16 독립 검증

**b16 연구 후보 유지 · b17 보류. 새 P0 0 · 새 P1 2.** result=pass는 검증 수행 완료이며 수용 주장 전체 통과가 아니다. skip_count=0.

입력 @${a.rev}, diff ${a.old}..${a.rev}의20파일을 읽고 생성 JSON/JSONL 전체를 파싱·대조했다. 중앙 development_policy를 UTF-8로 읽었고 첫 task show에서 IN_PROGRESS/session t-0124-codex 일치해 대기 불필요. PID 조회 없음. 다른 세션의 입력 worktree는 읽기만 했으며 고정 Git 객체와 원문·prompts·history 로컬 캡처를 분리했다. 캡처 ${Object.keys(JSON.parse(fs.readFileSync(out+'packets.local.json')).files).length}파일은 종료 전 바이트 동일성을 확인했다. 원문·전체 diff·명령 출력·세션 기록은 *.local.json에만 두고 두 산출 폴더에서 Git 제외한다.

## 수용 기준

${acceptance.map(c=>`- AC${c.index} **${c.status}** — ${c.why} (${c.evidence.join('; ')})`).join('\n')}

## 새 P1과 runner 재현

${findings.map(f=>`**${f.id} — ${f.title} (confirmed)**\n\n${f.reproduction} ${f.impact} 수정: ${f.recommendation} (${f.evidence.join('; ')})`).join('\n\n')}

두 반례는 실제 고정 runner 모듈을 VM에서 실행했고 입력 FS의 write·mkdir는 메모리에만 저장했다. 반복 링크에 의한 자기 청크 오류는 별도 대조에서 정상 검출된다. 오류가 모두 숨는다는 일반화는 refuted다. 최초 b14 B01은 결함18/exit1, B02는 내용 없는 안내/결함0/exit0이며 기존 재현과 일치한다. 서로 다른 청크에 걸친 반복도 앞의 세 ID 안에 자기 문항이 있을 때는 다른 ID를 가려 검출한다. 앞의 세 ID 밖에 있는 참여 문항에서만 P1-02가 발생한다. 최종 b16 네 청크는 모두 exit0이며 자기 청크 결함0이다.

agree는 loadTrack을 다시 사용하고 반복 결함에서 out.clear를 수행한다. 반례 입력의 A는 전체 배제되고 쌍0·전40 HUMAN_REVIEW_REQUIRED를 재현했다. 따라서 종료0을 결합 허용으로 해석하면 안 되며, 현재 코드가 배제된 트랙을 결합에 흘린다는 주장은 refuted다. (scripts/research/goal-data/d2-validate.mjs:165; scripts/research/goal-data/d2-run.mjs:107)

## 가드와 정당 설명

제공 회귀20/20, T-0123의1+1·1+2는 합성 및 실제 b14 A40행 runner에서 차단됐다. 삽입 E2의 임의 동일 설명은 차단된다. FIXED_INSERT_E2의 두 문자열만 입력유형 R-INSERT·TASK E2 조건에서 예외다. 단 문자열 비교 전에 연속 공백·양끝 공백·줄바꿈을 정규화하므로 바이트 완전 일치는 아니다. 같은 문구의 공백 변형은 허용, 마침표를 덧붙인 변형은 반복으로 차단됐다. 이 동작은 문구 의미를 바꾼 임의 예외와 구분한다. (d2-validate.mjs:20,131–134)

전32트랙(이전30+b16 A/B)에 활성화 조건만 메모리에서 해제해 독립 집계와 reasons를 대조했다. b3 B·b8 A·b9t-v24 A·b13 A만 적발, b6 A 허용. b14 이전 비소급 정책은 그대로다. 문항별 서로 다른 정당 설명3개는 허용, 같은 문항 내부의 같은 설명4개는 1문항으로 계산된다. b3 B 같은 공통 관측 한계도 계약 고정 문구 외에는 적발되므로, 이 가드를 의미 오류 판정으로 사용하지 않는다. 실제 문항 고유 설명의 새 오탐은 이번 표본에서 발견되지 않았으나 전체 의미 정밀도는 unclear다.

## 선정·재계산·history

2020 27+2019 13=40, 제외2, 기존 선정과 중복0. cap 밖2019 잔여는 선정 실패로 세지 않는다. source/passage/selection/input/계약/청크/prompt/history SHA를 재계산하고 D2 생성물4개를 바이트 재현했다. 일치227/240=.9458333333, κ=.8996913580, primary34/40이다. 안정5TASK는 모두 경보ok이며 κ 단독 기준을 새로 만들지 않았다. 누적546문항·21시험·R1 1293·갈림493, D3 primary470/546·왜곡1577/2184와 그룹 전필드를 재계산했다. JSONL 기존행 삭제·변경0, b16 신규 R1 81·갈림13·D3 reasoning40·오답160이다.

자기 최초 스냅샷4개만 최초값으로 세고, 다른 분석자 snapshot에 함께 복사된 파일은 중복 계수하지 않았다. 최초→최종 A01은5행(사유3·outside1·오답 근거1), A02는3행(stem3·사유2), B01은1행(outside·독립평가), B02는17행(관측 삭제16행과 사유 재작성3행·stem4행·오답2행이 겹침)이다. 전80행의 링크·primary·decision_path는 변경0이다. 상세 필드와 파일:줄은 verdict.history_changes다.

A01의2020#26/#27/#35는 행운·이메일·흐름 이탈 단서로, A02의2019#22/#24는 생산성 항목·수치 둔감 단서로 재작성됐다. 반복 그룹의2019#18은 그대로 두고 다른2행을 바꿔 그룹을 해소했다. 그러므로 A02의3문항을 모두 다시 썼다는 명제는 refuted다. B02의2019#21/#30/#31은 다음 질문·취약성·망각 경쟁 근거로 바뀌어 각 원문 맥락에 맞는다. 다만 원문 단서가 붙은 이유와 수행을 실제로 관측했다는 주장은 다르다. (verdict.history_changes; scripts/research/goal-data/review-b16/row-review.md:1)

B02 세션 agent-a083d22b26898203e.jsonl:70의 실제 dedup 스크립트를 메모리 재실행했다. 관측 양쪽 교집합16항목/16행만 not_observable에서 삭제하며 링크·primary·나머지 필드는 모두 불변이다. 같은 명령 앞부분의 별도 sed가 stem·오답 근거도 고치므로 스냅샷 전체 diff를 dedup 부작용으로 오해하지 않았다. 이후 :81의 사유3개 재작성을 별도로 확인했다. 관측 필드의 정의 혼재·빈값 의미·독립 진단 사용 금지는 미해소이며 새 P1로 중복 계수하지 않는다.

## 프롬프트·노출·원문 표본

보존 프롬프트4개 SHA·입력 SHA·최초 user 전문이 일치한다. manifest의 틀 SHA는 b16 당시 구형 템플릿과 일치하고 d1707f73c의 청크 출력 수정 후 템플릿과는 다르다. 현재 템플릿으로 과거 프롬프트를 재현했다고 주장하지 않는다. 새 mk-prompts의 NN 치환과 allowed_inputs 변경을 diff에서 확인했다.

문서의 「셋」은 refuted다. A01 :63/:69, A02 :89/:95, B01 :58뿐 아니라 B02 :87도 다른 청크2020#31의 실제 오류를 보았다. 네 분석자 모두 다른 청크 ID 노출이 확인됐고, B02는 공통 틀 설명 없이도 다른 청크의 주 수행 오류를 읽었다. A02의 파일명 열람·인자 없는 호출, B02의 codebook 최상위 키 출력도 로그와 일치한다. 다른 트랙 판정·v2.5 내용 노출은 기록에서 관측되지 않았지만 절대 미접근과 인과 오염 부재는 unclear다. 이미 생성된 b16의 노출 이력은 실행기 수정으로 소급 제거되지 않는다. (verdict.exposure; 원세션 agent-a083d22b26898203e.jsonl:87)

원문 후보10·갈림10 및 primary갈림6을 합친 고유20문항을 직접 대조했다. 후보의 연구 근거는 지지하며 갈림의 의미 우열은 확정하지 않는다. R5/R6는 한 문장 재진술과 결합 필요성, E2/E3는 위치 선택과 진술 대조의 결정 우선성, R4는 단계 배열과 개별 문장 기능의 경계다. 학생 수행·학습효과나 사람 Gold는 측정하지 않았다. 문항별 판정·파일:줄은 row-review.md에 있다.

**b17 보류 — P1-01/02 수정과 두 반례 회귀 후 연구 후보 확대만 재개.** b16의40문항을 버릴 근거는 없으나 관측 필드·독립 진단·NeedRank·Gold로 승격하지 않는다.

## 검증과 마무리

독립 검사${qa.checks.length}개·실패0, skip_count=0. L1 연구 검토에 필요한 파싱·SHA·재계산·원문 대조·VM runner·기존 회귀를 수행했다. DB 읽기/쓰기·제품 빌드/E2E·학습자 측정·원격/main 통합은 미실행이며 통과로 세지 않는다. 입력 소유 파일 변경0. 재현은 node scripts/research/goal-data/review-b16/run.mjs 후 write-review.mjs다. 원문 캡처가 없는 환경은 로컬 원문을 다시 읽어야 하며 Git 산출물만으로 원문 회귀가 완결된다고 주장하지 않는다.

요청한 순서로 Git add/commit 시도 → runtime/t-0124-ev.json → task evidence → submit을 수행하며 오류·출력 원문은 finish.local.json에 보존한다. 커밋 성공과 검증 수행 완료는 별개다.
`
fs.writeFileSync(doc+'review.md',md)
console.log(JSON.stringify({acceptance:acceptance.map(c=>[c.index,c.status]),checks:qa.checks.length,new_P0:0,new_P1:2,b17:'hold'}))
