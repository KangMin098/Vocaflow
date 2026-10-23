// scripts/research/goal-data/review-b17/write-review.mjs
import fs from 'node:fs'
const out='scripts/research/goal-data/review-b17/',doc='docs/research/goal-data-batches/review-b17/',base='scripts/research/goal-data/local/b17-v24/'
const get=n=>JSON.parse(fs.readFileSync(out+n+'.local.json','utf8')),a=get('audit'),s=get('supplement'),c=get('checks'),assembly=get('assembly')
if(c.failed.length)throw Error('verification failed')
const rows=[
['2018#38','confirmed','소금 결핍의 사례가 결핍 조절 일반 진술과 다른 영양분 사례 사이를 잇는다. ④와 R4 연구 후보를 지지한다. B01 추가 행의 소금·결핍·유사 사례 연결은 이 문항 고유 내용이다. 삽입은 묶음 수행이다.'],
['2018#39','confirmed','먼 호수 오염을 받는 원인 가정과 뒤의 배출원 규제가 양쪽에서 ④를 고정한다. R4 후보를 지지하나 R2·R3와 분리한 단독 관측은 미확정이다.'],
['2017#25','confirmed','공동 집필 사실과 단독 집필 선지의 차이가 ⑤를 지지한다. 부정 요구 E1 후보는 지지하되 E2·E3를 함께 거치는 문항이다.'],
['2017#26','unclear','전시품 판매의 긍정 진술을 부정한 ③이 정답이다. E1 후보를 지지하지만 부정 발문 처리와 진술 대조 E3 중 어느 primary가 우월한지는 확정하지 않는다.'],
['2017#28','confirmed','노인들을 가리키는 복수 명사구와 단수 동사의 불일치가 ⑤를 지지한다. E1은 부분 집합 후보이고 실제 어법 수행은 범위 밖이다.'],
['2017#29','confirmed','교사 고립 맥락, 비교 과정의 부재와 뒤의 불평 장면이 세 칸을 닫아 ④를 지지한다. 복수 조건 E1은 간접 후보이며 어휘 주 수행과 분리하지 않는다. 첫 출력 전 유형 정정도 이 문항 오답 ① 한 곳이다.'],
['2017#30','confirmed','통역을 고치는 사람만 다른 인물이라 ④다. E1 후보를 지지하지만 지칭 주 수행은 범위 밖이다.'],
['2018#25','confirmed','예술가들과 유대를 형성했다는 사실을 반대로 쓴 ④가 불일치한다. E1 후보를 지지하며 단독 진단 주장은 하지 않는다.'],
['2018#26','confirmed','오전 개인 훈련과 오후 연습 경기의 차이가 ③의 불일치를 만든다. E1 후보는 타당하고 E2 위치 선택도 필요하다.'],
['2018#28','confirmed','뒤에 완전한 절이 오는 연결어의 부적합이 ②를 지지한다. 부정 요구 E1 후보와 구문 주 수행을 구분한다.'],
['2018#22','unclear','음식 다양성이 섭취를 늘린다는 중심이 ④를 지지한다. 같은 낱말을 쓰면서 방향을 뒤집은 ⑤가 있어 E3 근거는 있으나 direct/indirect 경계는 미확정이다.'],
['2018#34','unclear','AI가 인간 고유 능력을 가져가 정체성을 되묻게 한다는 역설이 ⑤를 지지한다. 도덕 관련 낱말 재사용은 있으므로 전혀 겹치는 오답이 없다는 B의 문자적 설명은 지지하지 않는다. E3 의미 분류와 부정된 생산성 문장의 E2 경쟁 근거 적격성은 미확정이다.'],
['2018#42','unclear','자기와 지나치게 가깝다는 설명과 다른 인물 사용으로 객관성을 얻는 결론이 ①을 지지한다. 한 문장 재진술 R5인지 결합 R6인지, 감정 표현 재사용의 E3 적격성은 미확정이다.'],
['2017#19','unclear','간식 앞 기대에서 제지 후 실망으로 바뀌어 ⑤가 지지된다. 행동 묘사의 정서 명명이 추론인지, 두 장면 압축이 R5인지, 범위 밖인지 계약이 충분히 닫지 못한다.'],
['2017#31','unclear','정해진 결론과 계획된 목표 숙달만 요구하는 놀이·수업이라는 맥락이 ③을 지지한다. 한 문장 재진술 R5와 두 문장 결합 R6의 경계를 유지한다.'],
['2018#19','unclear','기대에 못 미친 투어에서 숲의 감탄으로 바뀌어 ②가 지지된다. 뒤쪽 감정은 명시됐지만 앞쪽 실망은 상황 묘사다. 후반 명시만으로 전반 추론까지 배제하는 B 설명은 불충분하다. 전반 한 문장 재진술인지 결합인지도 남는다.'],
['2018#29','unclear','6개월 조사와 10년 이상 보존 사례의 대조가 ②의 부적절성을 지지한다. 다음 문장 근거가 있다는 B 설명은 원문에 맞지만 반어 문장만으로 닫힌다는 A와의 E2 무관/간접 우열은 미확정이다.'],
['2018#33','unclear','수출 작물 장려와 주식 생산 제한이 자기 생산 통제 상실이라는 ①을 지지한다. 기술 선진 소수 진술을 경쟁 근거로 고를 필요가 있는지에 따라 E2 direct/indirect가 갈린다.'],
['2018#35','unclear','타인 권리 존중과 황금률 연결에서 지식 축적 목적의 활동 장려인 ③이 이탈한다. 개별 문장 기능 R3와 여러 문장 배열 R4의 단위를 달리 잡아 E1/R4 primary가 갈리므로 단일 우열은 미확정이다.'],
['2018#44','unclear','네 대명사는 한 인물이고 (d)만 경쟁자인 다른 인물을 가리켜 ④다. 아버지 발화 근처의 두 이름이 만드는 혼동 경로는 실제 존재하지만 E2 보조 관측인지 국소 지칭 수행인지 미확정이다.'],
]
const evidence=id=>a.dossier.find(r=>r.id===id).evidence
const rowReview='# b17 원문 독립 대조\n\n후보10·갈림10·primary 갈림6을 합친 고유20문항. 원문은 dossier.local.json에 보존한다. confirmed는 연구 후보의 근거 지지이며 사람 Gold·학생 수행 확인을 뜻하지 않는다. 후보인 2017#26도 primary 갈림을 유지한다.\n\n|문항|판정|대조 결과|파일:줄|\n|---|---|---|---|\n'+rows.map(([id,status,why])=>`|${id}|${status}|${why}|${evidence(id).join('; ')}|`).join('\n')+'\n'
fs.writeFileSync(out+'row-review.md',rowReview)
const changes=s.changes.map(r=>({label:r.label,item:r.item,added:r.added,fields:r.added?['entire added row']:r.fields.map(f=>f.field),first:r.added?r.first.replace(/:0$/,':1')+' (item absent)':r.first,final:r.final}))
const accept=[
{index:0,status:'confirmed',claim:'자기 최초79→최종80행 전량 비교. 기존9행의 지정 필드 수정과 B01 누락1행 수기 추가. 관측된 출력 후 수정은 문항별 Edit이며 일괄 치환·판정 자동 생성 없음.',evidence:['scripts/research/goal-data/review-b17/assembly.mjs:11','scripts/research/goal-data/review-b17/supplement.mjs:18',...changes.map(r=>r.final)]},
{index:1,status:'confirmed',claim:'B02 스크립트의 첫 출력 전 특정 리터럴 한 곳 수정은 스냅샷 우회로 관측되지 않음. 수정 전후를 메모리 재실행해 차이는 2017#29 오답1 유형뿐. 세 조립 경로와 B01 직접 Write가 자기 최초본을 구조적으로 재현. 프롬프트·manifest·실행 전문 일치; 관측 validator 타 청크 ID0. 절대 미노출은 unclear.',evidence:['scripts/research/goal-data/review-b17/assembly.mjs:14',base+'prompts/manifest.json:1','scripts/research/goal-data/review-b17/supplement.mjs:25']},
{index:2,status:'confirmed',claim:'40선정·해시·일치224/240·κ .874739·primary34/40·R6 κ .545455/공동direct3·경보를 재계산. 17개 로컬 배치 validate 결함0, 실제 격리 회귀32/32. runner/validator/회귀 소스는 8980aaa59와 동일.',evidence:['docs/research/goal-data-batches/D2-task-mapping/b17-v24-agreement.json:43','scripts/research/goal-data/review-b17/audit.mjs:45','scripts/research/goal-data/review-b17/regression.mjs:14','scripts/research/goal-data/review-b17/supplement.mjs:13']},
{index:3,status:'unclear',claim:'후보10·갈림10 및 primary갈림6의 원문 대조 완료. 후보 근거 지지, 의미·primary Gold 미확정. 심경 계약 개정 후보는 지지하나 b13/b14/b15에서도 A/B primary가 반복 불일치했다는 해석은 refuted.',evidence:['scripts/research/goal-data/review-b17/row-review.md:1','docs/research/goal-data-batches/D2-task-mapping/mapping-review.md:317','docs/research/goal-data-batches/review-b13/review.md:70']},
{index:4,status:'confirmed',claim:'verdict/review·새 P0/P1·다음 배치 가부 및 unclear 명시.',evidence:[doc+'verdict.json:1',doc+'review.md:1']}
]
const next='가능 — v2.4 연구 후보 확대만; 문항별 수기 수정·최초 스냅샷·실행 로그 보존과 의미 경계 미확정 유지.'
const verdict={task_id:'T-0129',owner_id:'goal-data-independent',source_commit:a.rev,diff_base:a.old,result:'pass',result_meaning:'검증 수행 완료; 모든 주장 통과 아님',skip_count:0,observed_at:new Date().toISOString(),acceptance:accept,new_p0:[],new_p1:[],next_batch:next,history_changes:changes,stats:{overall:a.overall,per_task:a.per,primary_agree:34,primary_disagreements:a.primary,r6_joint_direct:s.r6,cumulative:{items:586,exams:23,r1:1371,disputed:509},d3:s.totals},historical_mood:s.mood.map(({judgments,...m})=>m),refuted_subclaims:[{claim:'b13 b14 b15 모두 심경 A/B primary가 불일치',reason:'지정 과거 심경4문항은 A/B 일치. b17 두 문항에서만 primary 불일치. 과거 독립 검토의 의미 unclear와 구분해야 한다.',evidence:s.mood.map(m=>m.input)}],unclear:['행동·상황 정서 명명의 R5/R6/outside 경계','2018#42·2017#31 재진술/결합 경계','2018#35 R3/R4 단위와 2017#26 primary 단일 우열','E2/E3 갈림의 의미 Gold','관측 필드의 진단 타당성·실제 학생 수행·학습 효과','기록 밖 노출·이전 지식과 인과 오염의 절대 부재'],verification:{independent_checks:c.checks.length,failed:c.failed.length,shipped_regressions:32,local_packet_count:c.packet_count,source_unchanged:true},not_run:['DB 읽기/쓰기','제품 빌드/E2E','사람 Gold/학생 측정','봉인/NeedRank 승인','main/원격 통합']}
fs.writeFileSync(doc+'verdict.json',JSON.stringify(verdict,null,2)+'\n')
const historyTable=changes.map(r=>`|${r.label}|${r.item}|${r.fields.join(', ')}|${r.first}|${r.final}|`).join('\n')
const review=`# T-0129 · b17-v24 독립 검증

**${next} 새 P0 0 · 새 P1 0.** result=pass는 검증 수행 완료이며 의미 Gold나 모든 수용 주장 통과가 아니다. skip_count=0.

고정 입력 @${a.rev}, diff ${a.old}..${a.rev}의 15파일을 읽고 생성물 전량을 파싱·결속·재계산했다. 최초 task show에서 IN_PROGRESS/session t-0129-codex 일치하여 추가 대기 불필요. PID 조회 없음. 중앙 development_policy를 UTF-8로 읽었고 현재 브랜치를 유지했다. 입력 worktree는 읽기만 했다. Git은 현재 검토 worktree의 공유 객체를 사용했다. 원문·전체 diff·명령 출력·세션 전문·조립 코드는 *.local.json에만 두며 두 산출 폴더의 .gitignore로 제외한다.

## 수용 기준

${accept.map(r=>`- AC${r.index} **${r.status}** — ${r.claim} (${r.evidence.slice(0,3).join('; ')})`).join('\n')}

## 최초→최종 및 출력 수정 방식

자기 청크 최초본만 기준으로 삼았다. 다른 분석자의 snapshot에 함께 들어간 복사본을 새 최초본으로 세지 않았다. 최초 A01/A02/B01/B02는 20/20/19/20, 최종은 각각20행이다. 기존79행 중9행 변경·70행 불변, 누락1행 추가다. 기존행의 links·primary·decision_path·source hash 변경0. A01의3개 관측 중복은 각 행의 not_observable에서 E1 항목만 지웠고 directly_observable은 유지했다. 이 정합성 수정이 실제 관측 타당성을 확립하지는 않는다.

|청크|문항|변경 필드|최초 파일:줄|최종 파일:줄|
|---|---|---|---|---|
${historyTable}

A01 요지·주제·제목의 요구 문장을 각각 일화 교훈·정의/사례·결론 선택으로 늘렸고, A02의2017#27은 우천 취소 안내 항목을, B01의2018#21은 공 전달 훈련을, B02의2017#23은 감독의 현실 조합을 반영해 오답 근거를 보강했다. 전행 반복 생성이나 여러 행에 대한 출력 일괄 치환은 실행 기록에서 관측되지 않았다. 실패한 Edit 시도와 대화 재기록에 나타난 동일 호출을 별도 성공 변경으로 중복 계수하지 않았다.

B01은 직접 Write로19행 작성 → snapshot → 검증에서 누락과 오답 근거2건 검출 → 자기 입력의 누락 문항 재열람 → 두 문항을 각각 Edit →20/20 순서다. 추가2018#38은 결핍 일반 진술·소금 사례·다른 영양분 사례를 잇고 네 오답 위치도 각각 설명한다. 기존행의 문장 틀을 복사해 판정 내용을 생성한 증거는 없고 이 문항 고유 내용이 확인된다. (원세션 agent-a4cdc3e1974514d93.jsonl:46,52,58,64,66,74; 최종 chunk-B-01.out.json:477)

## B02 첫 출력 전 경로와 노출

B02 원세션 agent-aa8d780ff6bdd15e3.jsonl:52의 조립 코드와 :58 명령을 읽었다. 특정2017#29 오답①의 왜곡 유형 리터럴만 form_error→other로 바꾼 다음 처음 조립 실행 → snapshot → 검증했다. 수정 전후 스크립트를 메모리 재실행한 차이는 이 유형 한 곳이고, 이후 결과가 자기 최초 snapshot 전체와 구조적으로 동일하다. 최초 출력 파일을 만들고 나서 수정한 뒤 스냅샷을 찍은 경로는 관측되지 않았다. 어휘 의미 오답을 형태 오류로 두지 않으려는 개별 정정은 타당하지만 other의 분류 정밀도는 Gold가 아니다.

A01의 rows/build, A02의 build, B02의 build는 문항별 판정 리터럴을 ID·SHA·status와 결합하고 필드 이름·TASK 별칭을 바꾼다. primary의 고정 우선순위 선택·판정 문장 조합 생성은 없다. 세 경로 모두 최초본 재현, B01의 직접 Write도 최초본 재현했다. 스크립트에 판정 리터럴을 작성했다는 사실과 판정 자체를 코드로 자동 결정했다는 주장을 구분했다. 실제 scratchpad 코드도 읽어 local 캡처에 보존했다. (assembly.mjs:11)

manifest의 틀·입력·prompt SHA와 네 첫 user 전문이 일치하며 새 청크 검증·수기 수정 규칙이 실제 전달됐다. snapshot/validate 출력에는 다른 snapshot의 내용이 포함되지 않았다. 관측된 청크 validate 결과의 다른 청크 ID는0이다. A02 :56 디렉터리 목록에는 다른 청크·input 파일명만 보였고 내용 열람은 관측되지 않았다. B02 :46은 codebook 앞부분과 자기 B02 파일명만 출력했다. A/B의 큰 원문 출력 재열람은 자기 입력의 tool-results 경로로 추적된다. 다른 트랙 내용·v2.5·실행기 소스 열람은 기록에서 관측되지 않았지만 절대 미접근·인과 오염 부재는 unclear다.

## 재계산과 전체 diff

2018 27+2017 13=40, 제외2, 기존 선정 중복0. source/passage/selection/input/계약/청크/prompt/history 해시를 대조하고 D2 생성물4개를 바이트 재현했다. 일치224/240=.9333333333, κ=.8747390397, primary34/40이다. R6는 일치.900·κ=.5454545455·공동direct3(2018#31/#33/#34)이다. 현 경보는 일치<.80과 κ<.68의 동시 조건이라 경보 없음이 재현되며, 낮은 κ를 해소했다거나 안정성이 확정됐다는 뜻은 아니다.

b2–b17 및 b9t 두 계약을 포함한 총17개 로컬 배치의 최종 validate 결함0을 확인했다. 실제 격리 프로세스의 제공 회귀32/32도 통과했다. runner·validator·회귀 소스는 기준8980aaa59와 바이트 동일하다. 첫 VM 회귀는 삭제를 모형화하지 못해 오탐이 나고 child process 환경도 없었으므로 그 실행을 통과로 세지 않았다. 실제 격리 파일시스템으로 대체한 결과를 최종 증거로 사용했다.

전체 JSONL diff는 append-only이며 기존행 삭제·변경0이다. b17 신규 R1 78·갈림16·D3 reasoning40·오답160. 누적586문항·23시험·R1 1371·갈림509, D3 primary504/586·왜곡1678/2344를 재계산했다. D3 전40행·160오답의 원판정 결속과 그룹/coverage 전필드를 대조했다. 코드 diff는 배치 등록1행과 D3 배치 목록 추가뿐이며 새 실행기 변경은 없다. (audit.mjs; supplement.mjs; verify-diff.mjs)

## 원문과 계약 경계

후보10·갈림10 및 primary갈림6을 합친 고유20문항의 원문·선지·정답·판정을 직접 대조했다. 문항별 결과와 파일:줄은 scripts/research/goal-data/review-b17/row-review.md에 있다. 후보 근거는 지지하되 갈림 문항의 의미 우열·학생 오답 경로는 미확정이다.

심경 계약 개정 후보는 지지한다. 2018#19는 앞쪽 상황 묘사와 뒤쪽 명시 감정의 조합이며, 2017#19는 행동을 감정으로 명명하는 판단과 두 장면 압축을 포함한다. v2.3 §6은 명시 정서와 추론을 구분하지만 행동 묘사의 재진술 범위·혼합 문항의 결정 단위·R5 압축 적용 여부를 충분히 정하지 않았다. 사후 규칙을 만들어 이번 판정에 소급하지 않는다.

다만 mapping-review.md:317의 과거 배치 반복 갈림 서술을 A/B primary 반복 불일치로 읽으면 refuted다. b13 M2206#19는 R6/R6,2021#19는 null/null, b14 M2109#19와 b15 M2106#19도 null/null이다. 실제 관측 불일치는 b17의 R6/null·R5/R6다. b13 독립 검토의 의미 unclear는 재확인됐으므로 의미 경계가 반복 문제였다는 더 좁은 해석은 지지한다. 과거 두 분석자 일치와 독립 검토의 미확정을 혼용하지 않는다. 새 P0/P1로 세지 않는 서술 정정 사항이다.

## 검증과 마무리

독립 검사${c.checks.length}개 실패0·제공 회귀32/32·skip_count0. 캡처${c.packet_count}파일과 원세션4개의 바이트 불변을 종료 전 확인했다. 원문·명령 출력은 local 파일만 보존하며 입력 소유 파일 변경0. 재현은 node scripts/research/goal-data/review-b17/capture.mjs → node scripts/research/goal-data/review-b17/run.mjs → write-review.mjs다. 로컬 입력과 세션 기록이 없는 환경은 의미·노출 검증을 Git 파일만으로 완결할 수 없다.

DB 읽기/쓰기·제품 빌드/E2E·사람 Gold/학생 측정·봉인/NeedRank 승인·main/원격 통합은 미실행이며 통과로 세지 않는다. 요청 순서대로 Git add/commit 시도 후 evidence와 submit을 실행한다. 커밋 결과와 검증 완료는 별개이며 실제 명령 출력·오류는 finish.local.json에 보존한다.
`
fs.writeFileSync(doc+'review.md',review)
console.log(JSON.stringify({artifacts:[doc+'review.md',doc+'verdict.json',out+'row-review.md'],checks:c.checks.length,next_batch:next}))
