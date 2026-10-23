// scripts/research/goal-data/review-b12/write-review.mjs
// Human review conclusions plus mechanically generated evidence tables; no source quotations.
import fs from 'node:fs'
const out='scripts/research/goal-data/review-b12/',docs='docs/research/goal-data-batches/review-b12/',prefix='docs/research/goal-data-batches/D2-task-mapping/'
const a=JSON.parse(fs.readFileSync(out+'audit.local.json')),s=JSON.parse(fs.readFileSync(out+'supplement.local.json')),t=JSON.parse(fs.readFileSync(out+'transcript-summary.local.json'))
const checks=[...s.checks,...t.checks.filter(c=>c.name.endsWith('dispatched saved prompt'))]
if(checks.some(c=>!c.pass))throw Error('Unresolved audit expectations')
const notes={
 'M2209#38':['confirmed','④. 재료 선택 단계 뒤 구조·특성 관계의 이해를 넣어 후속 지식 지칭과 과학자 대명사를 채운다. R4 묶음 후보를 지지하며 E2 unknown·독립평가 부적격 유지.'],
 'M2209#39':['confirmed','⑤. 개인 선호→집단 형성 뒤 정체성 생성 문장이 공동체 확장으로 이어진다. R4 묶음 후보 지지. R6 indirect의 추가 필요성은 별도 unclear.'],
 'M2306#38':['confirmed','④. 살충제 유해성 뒤 개발 곤란을 추가하고 승인 비용으로 구체화한 다음 대안으로 간다. R4 묶음 후보 지지; E2 unknown·독립평가 부적격 유지.'],
 'M2306#39':['confirmed','③. 여러 개체 이탈에 더 크게 반응한다는 연구 결과를 신뢰성 관점으로 평가한 뒤 한 개체·오경보·다수 이탈 이유가 이어진다. R4 묶음 후보 지지.'],
 'M2209#26':['confirmed','⑤. 예술가의 재정적 성공을 부정한 선지가 마지막 진술과 반대다. 부정 요구 E1 direct 지지. A는 표현 대조 E3, B는 분산된 전기 사실의 위치 E2를 강조한다. 두 direct는 지지하나 primary 단일 우열은 unclear.'],
 'M2209#27':['confirmed','②. 심사에서 그림 기술을 고려하지 않는다는 안내를 고려한다고 뒤집었다. 부정 요구 E1 direct 지지. E3 primary는 부정 대조로 설명 가능하다.'],
 'M2209#29':['confirmed','③. 보장 내용 절의 주어·술어가 완전하여 관계사 대신 내용절 접속사가 필요하다. 부정 요구 E1 후보와 S축 범위 밖 판정 지지.'],
 'M2209#30':['confirmed','④. 공급 초과로 팔리지 않은 수송 용량은 기회를 잡은 것이 아니라 잃은 것이다. E1 후보와 V축 범위 밖 판정 지지.'],
 'M2209#35':['confirmed','③. 이주 결정의 편익·비용·심리 비용 사이에서 사치 소비 문장만 이탈한다. 부정 요구 E1 후보 지지. R4/R3 분해·R5 indirect는 별도 모호함으로 남긴다.'],
 'M2209#40':['confirmed','①. 정보 처리의 유능함과 넓은 맥락 판단의 저하를 함께 충족해야 한다. 한쪽 빈칸만 맞추는 E1 indirect 후보 지지. R5/R6 판정은 아래에서 unclear 유지.'],
}
const disputed={
 'M2209#39':'⑤는 집단 형성에서 공동체 확장으로 이어진다. B가 설정한 개인 이야기·집단 형성의 의미 연결 실패→④ 경로는 가능하지만 R4와 분리된 R6 indirect의 필요성은 확정 못 한다.',
 'M2209#20':'①. 마지막의 함께 살고 대화하는 실천이 주장이다. 도덕 교육·TV 오답은 실제 소재를 재사용하지만 E3 direct(A)/indirect(B)의 필수성 우열은 unclear. R5 primary는 양립한다.',
 'M2209#23':'⑤. 제약 없는 형태가 상상력과 즐거움을 낳는다는 대조 뒤 진술이 중심이다. 기하학·정밀성 오답의 재사용은 확인되나 E3 direct/indirect 우열은 unclear.',
 'M2209#41':'②. 무작위 배정·집단 유사성·식단 통제는 처치 외 요인 배제로 모인다. 감기·영양 소재 오답은 존재하나 E3 indirect/direct 우열은 unclear.',
 'M2306#41':'①. 타인 반응을 따르는 군중 판단과 무행동 결론이 제목을 정한다. 응급 상황 소재 오답과 E3 direct/indirect의 우열은 unclear. 최초·재작성 모두 문항별 중심을 담으며 재작성은 오답 소재까지 구체화했다.',
 'M2209#21':'②. 자발적 단독 작업의 장애와 주기적 개인 사고·리더의 개입을 결합해 협업 중단을 도출한다. R6 primary를 지지하나 안심·집단 조화 문장을 잘못 골라③으로 가는 E2 indirect와 같은 문장 근거의 무관 판정 사이 우열은 unclear.',
 'M2209#34':'④. 습관화로 안전한 자극 앞에서도 활동한다는 해결 명제가 답을 지지한다. 조심→반전→해결 배열 실패를 별도 R4 indirect로 세는 필요성은 unclear. 양쪽 E2 direct의 조심 문장은 대상(낯선/익숙한)도 달라 경쟁 근거의 강도를 과신하지 않는다.',
 'M2209#35':'③. 이주 결정의 비용·편익이 중심이다. 금전적 이익으로 중심을 좁혀 심리 비용⑤를 버린다는 B의 경로는 가능한 가설이나 A의 R5 무관보다 우월한 Gold로 확정 못 한다.',
 'M2209#40':'①. A는 각 빈칸에 필요한 두 명제가 각각 진술됐다는 단위, B는 두 칸을 합친 전체 명제가 한 문장에 없다는 단위를 쓴다. v2.4 §2의 한 명제/한 문장 단위를 요약 전체와 각 빈칸 중 어디에 적용하는지 불일치한다. R5/R6는 단순 낱말 문제도, 영구적 고유 모호함의 증명도 아니다. 현재 primary 우열은 unclear.',
 'M2306#35':'③. 상대 강약에 따른 결정→정보 수집→신호 기능 사이에서 평상시 체중·섭식만 이탈한다. 중심을 동물 일반으로 넓혀⑤를 버리는 R5 indirect는 가능하나 A의 무관과의 우열은 unclear.',
}
const samples=[...a.sample.candidates.map(r=>({...r,verdict:notes[r.item][0],why:notes[r.item][1],kind:'candidate'})),...a.sample.disputed.map(r=>({...r,verdict:'unclear',why:disputed[r.item],kind:'disputed'}))].map(r=>({...r,evidence:a.dossier.find(d=>d.id===r.item).evidence}))
const acceptance=[
 {index:0,verdict:'confirmed',summary:'프롬프트 4/4·입력·틀 해시 재계산, 치환 외 동일, 실제 전달 전문 4/4 일치. 내용 열람은 허용 범위; 메타데이터·사용법 예외는 아래 별도 판정.',evidence:[prefix+'prompts/batch-analyst.md:10','scripts/research/goal-data/mk-prompts.mjs:23','scripts/research/goal-data/local/b12-v24/prompts/manifest.json:2',out+'transcripts.mjs:14']},
 {index:1,verdict:'confirmed',summary:'최종80·최초80 행별 v2.4/v2.5 비교. 최종 오류0, 최초 발문 길이7 오류는 두 버전 공통. v2.5 전용 구조 흔적은 발견 못 함; 실제 미노출의 절대 증명은 unclear. A01 반복3행 수정과 판단 불변 확인.',evidence:['scripts/research/goal-data/d2-validate.mjs:76','scripts/research/goal-data/local/b12-v24/history/2026-10-23T09-27-34-602Z-b12-v24-A-01-first/chunk-A-01.out.json:1032','scripts/research/goal-data/local/b12-v24/chunk-A-01.out.json:1042',prefix+'CONTRACT_V2_4.md:28']},
 {index:2,verdict:'confirmed',summary:'40선정·해시·226/240=.9416667·κ=.8932859·주38/40·경보 ok 재계산, b2–b12 20트랙 결함0, D2 4생성물 바이트 재현·D3 합계 대조.',evidence:[prefix+'b12-v24-selection.json:2',prefix+'b12-v24-agreement.json:43','scripts/research/goal-data/d2-run.mjs:138',out+'supplement.mjs:39']},
 {index:3,verdict:'unclear',summary:'후보10·갈림10 원문대조 완료. 후보 근거는 지지하나 primary 및 indirect의 유일한 의미 Gold는 미확정. M2209#26 E3/E2 및 #40 R5/R6를 유지.',evidence:[prefix+'b12-v24-review-sample.json:5',...a.dossier.find(d=>d.id==='M2209#26').evidence,...a.dossier.find(d=>d.id==='M2209#40').evidence]},
 {index:4,verdict:'confirmed',summary:'verdict.json·review.md·새 P0/P1·다음 배치 가부·unclear를 명시.',evidence:[docs+'verdict.json:1',docs+'review.md:1']},
]
const verdict={task_id:'T-0119',owner:'goal-data-independent',session:'t-0119-codex',source_commit:a.rev,base_commit:a.old,result:'pass',result_meaning:'검증 수행 완료; 의미 Gold·미노출 절대 증명·제품 사용 승인이 아님',skip_count:0,observed_at:new Date().toISOString(),acceptance,checks:{total:checks.length,passed:checks.filter(c=>c.pass).length,failed:checks.filter(c=>!c.pass).length},new_P0:[],new_P1:[],next_batch:'조건부 가능 — v2.4 연구 후보 확대만; 프롬프트·최초출력·열람 로그 보존, 모호한 primary는 미확정 유지.',metrics:{selection:40,exam_totals:{M2306:14,M2209:26},overall:a.overall,per_task:a.per,primary_agree:38,r1:79,disputed:14,regression_tracks:20,regression_defects:0},samples,unclear:['기록 밖의 노출·이전 지식 및 의미 영향의 절대 부재','M2209#26 E3/E2 primary 단일 우열','M2209#40 R5/R6 요약 명제 단위','E3 direct/indirect와 경쟁 문장 강도·실제 학습자 오답 경로','사람 Gold·학생 성취·제품 진단 타당도'],not_run:['DB 쓰기','입력 저장소 수정','새 분석자 실행','제품 E2E','학생 측정','봉인 승인','main/원격 통합']}
fs.writeFileSync(docs+'verdict.json',JSON.stringify(verdict,null,2)+'\n')
fs.writeFileSync(docs+'checks.local.json',JSON.stringify({source_commit:a.rev,checks},null,2)+'\n')
const logs=t.summary.map(r=>`- ${r.label}: 전달 전문 일치, 계약6개+자기 청크. 보고 ${r.path}:${r.report.line}.`).join('\n')
const sampleText=samples.map(r=>`- ${r.kind} ${r.item}/${r.display}: **${r.verdict}** — ${r.why} (${r.evidence.join('; ')})`).join('\n')
const rowTable=rows=>rows.map(r=>`|${r.track}|${r.item}|${r.primary??'null'}|${r.v24_errors.length?'발문 길이 오류':'오류0'}|${r.v25_errors.length?'동일 발문 길이 오류':'오류0'}|${r.evidence}|`).join('\n')
const report=`# T-0119 · b12-v24 독립 검증

${verdict.next_batch}

검증 수행 완료(pass) · skip_count=0 · 새 P0 0 · 새 P1 0. 미노출·Gold·봉인·제품 타당도 인증은 아니다. 지정 입력 @${a.rev}, diff ${a.old}..${a.rev}(17파일). 최초 task show에서 IN_PROGRESS/session t-0119-codex 일치. PID 조회 없음. 중앙 development_policy(dev-minimal-20261020) 확인. 입력 소유자의 파일에 쓰지 않았으며 Git 객체와 읽기 고정한 local 패킷으로 검사했다.

## 수용 기준

${acceptance.map(r=>`- AC${r.index} **${r.verdict}** — ${r.summary} (${r.evidence.join('; ')})`).join('\n')}

## 프롬프트 보존·실행·열람

manifest의 template sha와 네 prompt/input sha를 실제 바이트로 재계산해 전부 일치했다. 틀에서 배치·트랙·청크·라벨·트랙 설명만 바꾸면 네 전문이 재현되고, 역치환한 본문도 동일하다. A/B 모두 v2.5 계약·V2_5_*·prereg-*·v2_5-* 및 검증기/실행기 소스 내용 열람을 금지한다. 생성기를 메모리 FS로 실행해 네 전문을 다시 바이트 재현했다(생성시각 자체는 재현 대상 아님).

추가로 이미 완료된 네 분석자의 원 세션 로그를 읽어 첫 user 전문과 보존 전문을 대조했다. 네 건 모두 끝 줄바꿈만 무시하면 동일하다. 선언만 보존한 것이 아니라 실제 전달 전문을 확인했다. 세션을 실행하거나 수정하지 않았다.

${logs}

**내용 열람이 허용 목록 안이라는 보고는 confirmed**. A01은 codebook의 해당6개 TASK와 자기 청크의 prior 분석 일부를 읽었다. A02는 codebook 내용 대신 청크 tasks 정의와 자기 청크 일부 prior 키/함정을 보았다. B01/B02는 자기 원문만 읽었다. B02의 긴 출력 재열람 도구 결과 파일도 자기 청크 출력으로 추적되며 타 트랙 내용이 아니다. 실제 Bash/Read 호출을 전량 대조해 금지 문서·타 트랙 내용 조회는 확인되지 않았다. 조립 코드의 판정은 리터럴이고 자동 우선순위 primary 선택은 확인되지 않았다.

**아무 예외도 없었다는 엄격한 주장은 refuted**. 세 예외 유형의 영향은 다음과 같다.

- A01 ls(원 로그80행): 다른 청크·input·history 등의 이름이 보임. 문항별 판정 내용은 노출하지 않아 의미 오염 증거는 아니다. 이름도 전혀 안 보였다고 하지는 않는다.
- A01 인자 없는 실행(92행): 사용법뿐 아니라 input 누락/명령 오류가 출력됐다. 파일 경로·명령 형태가 보였고 소스 본문·v2.5 규칙·타 트랙 판정은 출력되지 않았다. snapshot 출력도 경로/파일 수/시각 수준이다. manifest의 허용 출력 목록은 validate만 적지만 프롬프트5번이 snapshot 실행을 명시하므로 이를 별도 금지 내용 열람으로 세지 않는다.
- 네 세션 모두 wc(각18행): codebook·허용 계약·자기 청크의 바이트 수 확인. A02/B01/B02의 codebook 미열람은 내용 미열람을 뜻하며 wc와 모순되지 않는다. A01은 이후 허용된 TASK 정의 내용도 발췌했다.

새 B11-P1-01 범위의 보존 공백은 b12에서 보강됐다. 단 이 확인은 관측 로그 범위다. 기록 밖의 노출·이전 모델 지식·실제 인과 영향의 완전 부재는 unclear로 남긴다. 재생성 명령은 파일을 덮어쓰므로 원 전문뿐 아니라 원 세션 로그도 계속 보존하는 현재 방식을 유지한다.

## 재계산·diff·회귀

총 ${checks.length}개 검사 통과. M2306#32–45 14 + M2209#18–44(도표25 제외)26=40. 기판정13·도표2 제외, 다음45는 cap 밖이며 결손 제외로 오해하지 않는다. 기존 선정과 중복0, source/passage/selection/input/계약 해시 일치. D2 생성물4개 바이트 재현. 일치226/240=.9416666667, κ=.8932859048(저장 .9417/.8933), 주38/40, R1 79, 갈림14.

R5 .925/κ .8625 · R6 .950/κ .6460 · E1 1/1 · E3 .900/κ .8312 · R4 .925/κ .8805 · E2 .950/κ .9231. R6 κ만 .68 아래이나 일치가 .80 이상이므로 두 조건을 함께 밑돌 때만 중단하는 현 계약상 경보는 모두 ok다. κ 단독으로 충분한 안정이라고 일반화하지 않는다.

b2/b3/b4/b5/b6/b7/b8/b9/b11/b12 각 A/B = 20트랙, 트랙당40/8/40/38/40/40/40/40/40/40행, 최종 결함0. b10은 사전 등록 파생 예약이며 여기 회귀 대상인 일반 확대 산출 배치가 아니다. 계약 회귀 통과를 의미 Gold로 바꾸지 않는다.

17파일 diff에서 JSONL 기존 행 삭제·변경0. b12 R1 79·갈림14가 결합에 추가됐고 D3 reasoning40·distractor160이 추가됐다. 결합398문항·15시험·R1 1015·갈림426, D3 주340/398·원천 본문 왜곡1115/1576=.7074873을 저장된 행에서 재계산했다. 모든 공개 링크 relevance=unknown 유지. mk-prompts/틀/README/§16과 export·D3 입력 배치 추가도 대조했다. README의 v2.5 봉인 후보 잔여 문구는 미봉인·종료로 수정됐다.

## 최초 출력·v2.5 흔적·A01 반복

네 청크 자기 라벨의 first 스냅샷만 최초로 골랐다. snapshot이 다른 트랙 파일도 복사하므로 후속 디렉터리의 복사본을 독립 최초로 세지 않는다. 저장된 모든 history manifest 해시도 일치했다. 최초80행에서 A01 발문 길이5행과 B01 2행만 행 검사를 거부하며 두 버전에서 같은 오류다. A01의 트랙 반복 검사도 같은 골격3행을 거부한다. 최종80행은 양 버전 행 검사 오류0이다. b11 최초 null/secondary처럼 **v2.4 거부·v2.5만 허용하는 행은 이 b12 최초/최종에서 발견되지 않았다**. 모든 행 primary가 non-null이라 그 차이를 검출할 기회 자체도 없었다.

A01 M2306#41/M2209#20/#23의 원 이유는 동일 골격 속 각 문항의 중심 명제를 이미 담았다. 최초는 **문항별 결론을 반복 틀로 설명한 것**이며, 독립적인 반사실 검사를 실제로 했다는 충분한 증거는 아니다. 재작성은 각각 군중 판단의 응급 소재 오답, 부모·교사의 실천 대 TV·도덕 소재 오답, 칸트의 대조 뒤 중심 대 기하학·정밀성 오답을 들어 문항별로 구체화했다. 실제 원문과 맞아 문항별 설명으로 수용 가능하다. primary·links·decision_path·outside 변경0, A01 이유3행·발문5행 및 B01 발문2행만 변경했다. 반복 가드가 작동하고 수정됐다는 주장은 confirmed이며 최초부터 반복이 없었다는 주장은 refuted다.

사실·안내·서사에서 E1 primary를 선택하지 않은 행동은 v2.4 §3의 문항별 E2/E3 설명과 양립한다. v2.4 §4가 사실형까지 E1 primary를 금지한다는 규칙은 없다. 함축·심경 R6도 v2.3/v2.4에서 설명된다. 최종 v2.5 검사 통과만으로 v2.5 노출 또는 미노출을 판정하지 않는다. 최종/최초 전행 대조표는 아래와 같다.

## 원문 후보10·갈림10

${sampleText}

후보 confirmed는 지정 TASK의 근거를 지지한다는 뜻이며 행 전체·독립평가 적격·primary 우열 인증은 아니다. 두 주 TASK 갈림은 실제 다른 판단 단위를 사용했다. 이를 고유하고 영구적인 모호함이라고 확정하지 않는다. 특히 요약의 빈칸별 명제와 전체 요약 명제를 구분하지 않으면 v2.4 §2 적용 결과가 달라진다. 경쟁 문장의 강도(M2209#34 등), E3 필수/보조 구분, 가상 오답 경로는 의미 검토의 한계로 남는다. 새 P0/P1로 확정할 추가 증거는 확인하지 못했다.

## 최종80행 계약 대조

v2.5는 흔적 비교용 검사이며 사용 승인 대상이 아니다. 선택 이유 원문과 명령 출력은 ignored *.local.json에만 보존한다.

|트랙|문항|primary|v2.4|v2.5|근거|
|---|---|---|---|---|---|
${rowTable(s.traceRows)}

## 최초80행 계약 대조

행 검사 외 A01 트랙 전체 반복3행 오류는 위 본문에 별도 기록했다. 행 검사를 통과한 것을 트랙 통과라고 하지 않는다.

|트랙|문항|primary|v2.4|v2.5|최초 근거|
|---|---|---|---|---|---|
${rowTable(s.firstRows)}

## 미확정·미실행·마무리

${verdict.unclear.map(x=>'- unclear: '+x).join('\n')}

${verdict.not_run.join(' · ')}은 미실행이며 통과가 아니다. 요청된 다섯 검증 범위는 모두 수행해 skip_count0이다. 입력 저장소는 읽기만 했고 산출은 지정 review-b12 두 폴더에 한정했다. 원문·diff·세션·명령 출력은 *.local.json으로 두고 두 폴더의 .gitignore에서 제외했다. Git add/commit 시도와 evidence/submit 원문은 finish.local.json에 남긴다. 커밋 실패를 검토 내용의 pass로 숨기지 않는다.
`
fs.writeFileSync(docs+'review.md',report)
console.log(JSON.stringify({checks:verdict.checks,acceptance:acceptance.map(({index,verdict})=>({index,verdict})),new_P0:0,new_P1:0,next_batch:verdict.next_batch},null,2))
