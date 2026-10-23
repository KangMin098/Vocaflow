// scripts/research/goal-data/review-b13/write-review.mjs
import fs from 'node:fs'
const dir='scripts/research/goal-data/review-b13/',dest='docs/research/goal-data-batches/review-b13/'
const get=n=>JSON.parse(fs.readFileSync(dir+n+'.local.json','utf8'))
const a=get('audit'),s=get('supplement'),e=get('extra'),t=get('transcript-summary')
const checks=[...s.checks,...e.checks.slice(a.checks.length),...t.checks.slice(a.checks.length)]
if(checks.some(c=>!c.pass))throw Error('Unresolved verification failure')
const source='docs/research/goal-data-batches/D2-task-mapping/'
const packets=get('packets').files
const locate=(p,id)=>p+':'+(packets[p].split('\n').findIndex(l=>l.includes('"item_id"')&&l.includes('"'+id+'"'))+1)
const refs=id=>{const b='scripts/research/goal-data/local/b13-v24/';return [locate(b+'input.json',id),...['A','B'].map(track=>{const n=JSON.parse(packets[b+`chunk-${track}-01.out.json`]).rows.some(r=>r.item_id===id)?1:2;return locate(b+`chunk-${track}-0${n}.out.json`,id)})]}
const candidate=[
 ['M2206#38','R4','②. 상사의 평가 책임 설명 뒤 관찰 불가 문제를 넣어 질문과 딜레마 해결로 잇는다. 배열 근거를 지지하며 삽입 E2 unknown·개별 독립평가 부적격을 유지한다.'],
 ['M2206#39','R4','⑤. 수면의 보편성·필수 기능 주장 뒤 반응성 저하라는 대가를 넣어 후속 지시가 받을 대상을 채운다. 묶음 관찰 후보를 지지한다.'],
 ['2021#26','E1','⑤. 은퇴 후 가르치기와 글쓰기 모두 계속했다는 진술에 가르치지 않았다는 선지가 어긋난다. 부정 요구를 지지한다.'],
 ['2021#27','E1','④. 헬멧 미제공을 제공으로 뒤집은 선지다. 부정 요구 direct를 지지한다. E1 primary는 현 v2.4에서 허용된다.'],
 ['2021#29','E1','⑤. 완전한 절의 여부를 묻는 자리에 what 대신 whether가 필요하다. E1 후보 및 S축 outside를 지지한다.'],
 ['2021#30','E1','⑤. 기대 대신 실제 관측을 보고해 편향을 깨려면 용기가 있어야 한다. lacked는 반대다. E1 후보 및 V축 outside를 지지한다.'],
 ['M2206#26','E1','③. 헬싱키에서 기록을 깼다는 진술을 깨지 못했다고 뒤집었다. 부정 요구 direct를 지지한다.'],
 ['M2206#27','E1','⑤. 공장 안 촬영 금지를 허용으로 뒤집었다. E1 direct를 지지하며 E3/E2의 primary 단일 우열까지 인증하지 않는다.'],
 ['M2206#29','E1','⑤. to see와 병렬인 원형 discover가 필요하다. E1 후보 및 S축 outside를 지지한다.'],
 ['M2206#30','E1','④. 전통 집착이 효율·생산성·시장 대응을 저해한다는 맥락에서 increase가 부적절하다. E1 후보 및 V축 outside를 지지한다.']
].map(([item,task,why])=>({item,task,verdict:'confirmed',why,evidence:refs(item)}))
const disputed=[
 ['2021#21','E3','②. 자연의 관점 대변과 인간 행동 전환이 비유의 뜻이다. 인권·역사·법 소재를 재사용한 오답은 있으나 의미를 먼저 세운 뒤 E3 대조가 필수인지 보조인지의 우열은 미확정이다.'],
 ['2021#24','E3','③. 촉각이 시간에 의존한다는 중심과 시간 개념을 촉각이 만든다는 ②의 방향이 다르다. A는 선지 관계 대조, B는 방향을 포함한 중심 생성에 이를 넣는다. primary E3/R5 및 direct/indirect 우열은 미확정이다.'],
 ['M2206#18','E3','③. 추가 혜택 제공이 편지 목적이다. 기념행사 취소·기념품·전시 소재 오답은 실제 존재하나, 중심만으로 닫힘과 별도 대조 필요의 경계는 미확정이다.'],
 ['M2206#21','E3','②. 빈 편지함은 타인 요구에 응답하는 일이다. 사회관계 단절 ④를 일시적 외부 차단과 연결하는 반사실은 가능하나, 추론과 분리된 E3 보조 수행의 필수성은 확정 못 한다.'],
 ['M2206#24','E3','①. 노년 사회 지각의 이득이 중심이다. ②는 부정 정보 무시를 사회 기술 향상의 인과로 바꾼다. 별도 대조인지 중심 범위만으로 탈락하는지의 우열은 미확정이다.'],
 ['M2206#41','E3','③. 기대·기술 변화에 적응하는 사생활권의 개념과 실천이 전체 축이다. 법 영역·기술 부작용 소재 오답과의 대조가 필수인지 보조인지 미확정이다.'],
 ['2021#20','R4','②. 전문성의 비용과 한계에서 중요하고 즐기는 영역 집중으로 간다. B의 양보→결론 단계 오인은 가능하지만 ⑤가 특정 문장 기능 오인(R3)만으로도 설명돼 R4 indirect 우열은 미확정이다.'],
 ['2021#22','R4','①. 접근 민주화와 대중 의견 공개를 거쳐 비평이 대중 의견을 반영한다. ②의 다양한 장르는 원문에 명시되지 않아 B 반사실의 지지 강도는 제한된다. 원인→결과 배열과 한 문장 중심 오인의 분리는 미확정이다.'],
 ['2021#31','R5','②. 중앙 행정과 대비되는 개인의 사용, 당사자·합의 진술을 연결한다. R6 주 수행은 지지하나 중앙 행정을 중심으로 잡아 ③으로 간다는 R5 indirect 경로의 필요성은 미확정이다.'],
 ['M2206#22','R4','④. 계획은 자원 효율과 성공 가능성을 높인다. 양보→반전 두 문장이 존재하지만 A의 locus 반사실이 배열 수행과 한 문장 기능(R3)을 충분히 분리하는지는 미확정이다.']
].map(([item,task,why])=>({item,task,verdict:'unclear',why,evidence:refs(item)}))
const boundary=[
 ['M2206#19','①. 의심에서 만족으로의 답은 지지한다. 정서 단어가 동일하게 없다는 사실만으로 R6가 되지는 않는다. 걱정 해소는 명시됐고 편리함·미소·재방문 단서의 정서 명명은 추론으로도 읽힌다. v2.3 §6의 명시 정서/재진술 경계가 닫히지 않아 R6 direct·outside=false는 unclear다.'],
 ['M2206#35','④. 거리와 무관한 유대·이동 자유 사이에서 최연장자 결정권이 이탈한다. ③→⑤ 배열 설명과 문장 화제·기능 분류(R3)가 모두 가능해 R4 primary 및 outside=false는 unclear다. 두 트랙 일치를 독립 의미 확정으로 바꾸지 않는다.'],
 ['M2206#20','①. 여러 매체에서 긍정적 과학자 묘사가 주장이다. A는 영화만 담은 ④와의 범위 대조를, B는 긍정 묘사·매체 범위를 포함한 중심을 결정으로 본다. E3/R5 primary는 unclear다.'],
 ['M2206#33','②. 사자의 먹이 장소를 인간이 정한다는 예시는 인간이 상호작용 맥락을 정한다는 답을 지지한다. 예시 한 문장의 재진술(R5)인지 첫 문화적 진술과 결합한 일반화(R6)인지, 특히 점진성까지 한 문장에 있는지는 닫히지 않는다. R5/R6 primary는 unclear다.'],
 ['M2206#45','⑤. 졸업 전 모험이라는 (D)의 발화를 졸업 후로 바꾼 선지가 틀리다. 흩어진 단락 탐색 E2와 찾은 문장의 시점 대조 E3가 모두 direct라 단일 primary는 unclear다.'],
 ['2021#19','①. 처음 괴로움과 끝 평정이 본문에 명시돼 있어 R6를 세우지 않고 primary null·secondary []로 둔 v2.4 처리는 지지한다. 실제 학습자 오답 경로 및 개인 V축 숙달은 별도 미확정이다.']
].map(([item,why])=>({item,verdict:item==='2021#19'?'confirmed':'unclear',why,evidence:refs(item)}))
const acceptance=[
 {index:0,verdict:'confirmed',claim:'프롬프트/입력/틀 해시·치환·V2_5 금지·실제 전달·내용 열람 목록 및 덮어쓰기 거부 확인. 메타데이터·오류 출력 예외는 별도 기록.',evidence:[baseRef('prompts/manifest.json',2),'scripts/research/goal-data/mk-prompts.mjs:23',dir+'supplement.mjs:17',dir+'transcripts.mjs:14',dir+'verify-diff.mjs:9']},
 {index:1,verdict:'confirmed',claim:'최초80·최종80 행별 비교 완료. v2.4 거부/v2.5만 허용하는 구조 없음. 절대 미노출은 unclear.',evidence:[dir+'supplement.mjs:9','scripts/research/goal-data/d2-validate.mjs:76',...refs('2021#19')]},
 {index:2,verdict:'confirmed',claim:'40선정·해시·κ .854434·주36/40·경보·회귀 결함0·b12 갈림2 미확정 표기 재확인.',evidence:[source+'b13-v24-selection.json:2',source+'b13-v24-agreement.json:43',source+'mapping-review.md:252',dir+'audit.mjs:37',dir+'verify-diff.mjs:14']},
 {index:3,verdict:'unclear',claim:'후보10·갈림10·지정 경계 원문 대조 수행 완료. 후보 근거10 지지, 갈림10과 의미 경계·primary 우열은 미확정.',evidence:[source+'b13-v24-review-sample.json:5',...refs('M2206#19'),...refs('M2206#35')]},
 {index:4,verdict:'confirmed',claim:'verdict.json·review.md·새 P0/P1·다음 배치 가부·unclear 명시.',evidence:[dest+'verdict.json:1',dest+'review.md:1']}
]
function baseRef(p,line){return 'scripts/research/goal-data/local/b13-v24/'+p+':'+line}
const verdict={task_id:'T-0120',owner_id:'goal-data-independent',input_commit:a.rev,diff_base:a.old,observed_at:new Date().toISOString(),type:'review',result:'pass',result_meaning:'검증 수행 완료; semantic unclear 및 미실행을 통과로 바꾸지 않음',skip_count:0,checks:{total:checks.length,failed:0},acceptance,new_P0:[],new_P1:[],next_batch:'조건부 가능 — v2.4 연구 후보 확대만; 프롬프트·최초출력·열람 로그 보존 및 의미 경계·primary 미확정 유지.',candidates:candidate,disputed,boundary,unclear:['관측 로그 밖 노출·이전 지식·인과 오염의 절대 부재','M2206#19 정서 명명/R6 경계','M2206#35 R4/R3·outside 경계','M2206#20/#33/#45 및 2021#24 primary 단일 우열','b12 M2209#26/#40 판단 단위 경계','direct/indirect 의미 Gold 및 실제 학습자 오답·학습효과'],not_run:['DB 쓰기','입력 저장소 수정','새 분석자 실행','제품 E2E','사람 Gold·학생 측정','봉인 승인','main/원격 통합'],statistics:{overall:a.overall,per_task:a.per,primary_disputes:a.primary},artifacts:{commands:dir+'finish.local.json',raw_diff:dir+'diff.local.json',packets:dir+'packets.local.json',transcripts:dir+'transcripts.local.json'}}
fs.writeFileSync(dest+'verdict.json',JSON.stringify(verdict,null,2)+'\n')
const lines=[
 '# T-0120 · b13-v24 독립 검증','',verdict.next_batch,'',
 `검증 수행 완료(pass) · skip_count=0 · 새 P0 0 · 새 P1 0. 지정 입력 @${a.rev}, diff b8685b8d1..${a.rev}(16파일). 첫 task show에서 IN_PROGRESS/session t-0120-codex 일치. 프로세스/PID 조회 없이 진행했다. 중앙 development_policy(dev-minimal-20261020)를 읽고 기존 브랜치를 유지했다. 입력 소유자의 파일은 읽기만 했으며 Git 객체와 바이트 보존 local 패킷으로 검증했다. 다른 worktree의 git -C 접근은 저장소 인식 오류가 나 현재 worktree에서 공유 Git 객체를 읽었다. 원문·명령 출력은 *.local.json으로만 보존했다.`,
 '', '## 수용 기준','',...acceptance.map(x=>`- AC${x.index} **${x.verdict}** — ${x.claim} (${x.evidence.join('; ')})`),
 '', '## 프롬프트 보존·실행·열람','',
 '틀·네 prompt·네 input 청크 해시를 재계산해 manifest와 일치했다. 배치·트랙·청크·라벨·트랙 지시 치환만으로 네 전문을 재현했고 정규화한 본문도 동일했다. 두 트랙 모두 V2_5_*·prereg-*·v2_5-* 및 v2.5 계약, 실행기·검증기 소스 열람을 금지한다. 네 원 세션 첫 user 전문과 보존 전문은 끝 줄바꿈만 무시하면 일치한다.',
 '',...t.summary.map(x=>`- ${x.label}: 전문 일치 · 읽은 파일 보고 ${x.path}:${x.report.line}. 허용 계약6개·자기 청크와 실행 출력. codebook 내용 대신 청크 tasks 정의를 사용했다.`),
 '', '내용 열람은 허용 목록 안이라는 보고는 confirmed다. 실제 Bash/Read/Write/Edit 호출도 대조했다. A01은 자기 청크 prior 일부, A02는 자기 prior/traps를 확인했다. B는 원문 전용 청크만 열었다. B01/B02의 긴 출력 재열람 파일은 각각 자기 청크 출력으로 추적된다. 조립 코드는 행의 판정 문장·primary를 리터럴로 쓰고 sha·상태 결합·JSON 출력·인용/정답 확인을 수행하며 고정 우선순위 primary 선택은 확인되지 않았다.',
 '', '예외가 전혀 없었다는 엄격한 주장은 refuted다. A01 로그56행 ls에 다른 청크·input·prompts 이름이 보였고, B01 44–45행 인자 없는 실행은 input 누락 오류·경로·스택 위치를 출력했다. 소스 본문·타 트랙 판정·v2.5 규칙은 출력하지 않았다. A02/B01/B02는 codebook 크기를 wc로 확인했지만 내용은 열지 않았다. snapshot 출력은 프롬프트5번에 명시된 절차다. 이것을 미노출의 절대 증명으로 확장하지 않는다.',
 '', 'mk-prompts의 지정 6da162eae 변경은 manifest가 있으면 mkdir/write 이전에 throw하는 2행이다. 기존 manifest가 있는 b13 재생성을 메모리 FS에서 실행해 거부·쓰기0을 확인했다. 같은 입력에 변경 전 생성기는 manifest와 네 전문(5파일)을 덮어쓰므로 반례를 재현했다. manifest만 숨긴 신규 생성 경로에서는 네 전문을 바이트 재현했다. 입력 저장소에 실제 재생성 명령을 실행하지 않았다. manifest 없이 남은 부분 파일이나 동시 생성까지 원자적으로 보호한다는 보장은 이 가드에 없다. 이번 보존 패킷은 manifest가 있어 해당 공백의 손실은 관측되지 않았다.',
 '', '## 재계산·diff·회귀','',
 `${checks.length}개 검사 통과. M2206 18–45 도표25 제외27 + 2021 18–31 도표25 제외13 =40. 기존 선정과 중복0, 도표 제외2, source/passage/selection/input/계약 해시 일치. 나머지 2021 문항은 cap 밖이며 결손 제외가 아니다. D2 네 생성물을 바이트 재현했다. 일치221/240=.9208333333, κ=.8544340165(저장 .9208/.8544), primary36/40, R1 78, 갈림19.`,
 '', 'R5 .925/κ .8658 · R6 .950/κ .8068 · E1 1/1 · E3 .850/κ .7706 · R4 .850/κ .7209 · E2 .950/κ .9153. 현 경보(일치<.80 및 κ<.68 동시)는 모두 ok다. 계약 통과나 일치도를 의미 Gold·학습효과·버전 인과 효과로 바꾸지 않는다.',
 '', 'b2/b3/b4/b5/b6/b7/b8/b9/b11/b12/b13 각각 A/B =22트랙 최종 결함0. b10은 사전 등록 파생 예약이므로 일반 확대 회귀 배치가 아니다. 재실행은 메모리 FS로만 수행했다.',
 '', '16파일 diff를 보존하고 변경 경로·행을 대조했다. mk-prompts guard, d2-export의 b13 선정과 d3-build 입력 추가, README 및 mapping-review §16–17을 확인했다. JSONL 기존 행 변경·삭제0, b13 후보78·갈림19·D3 reasoning40·distractor160 추가. D3 새 reasoning의 양쪽 발문·구조·판단·근거 hash·primary와 오답160의 분류·설계·이유를 원 출력에 재결속했다. 모든 유형 그룹의 문항·오답·왜곡 일치·primary 쌍·small_sample도 재계산했다. 결합438문항·17시험·R1 1093·갈림445, D3 primary376/438·왜곡1239/1752=.7071918. source_text만의 왜곡은1221/1732로 분모가 다르다. 공개 relevance는 전부 unknown 유지한다. b12 M2209#26/#40은 고유·영구 모호함 확정 대신 미확정으로 고쳐졌다.',
 '', '## 최초·최종 행별 v2.5 흔적','',
 '청크별 자기 라벨 first 스냅샷만 최초로 택했다. 다른 트랙 파일을 함께 복사하는 history는 독립 최초로 중복 계수하지 않았다. 저장된 history manifest 해시 전부 일치. 최초80행 중 오류8행(A02 5·B01 2·B02 1)은 v2.4와 v2.5가 같은 오류로 거부한다. 최종80행은 v2.4 오류0이다. 최초·최종 모두 v2.4가 거부하고 v2.5만 허용하는 구조는 없다.',
 '', '두 버전이 모두 허용했다는 주장은 refuted다. 최초·최종의 2021#27 A/B는 E1 primary라 v2.5 §1이 거부한다. 2021#19 A/B는 primary null·secondary []인데 R4 indirect가 있어 v2.5 §3의 정확한 indirect 목록 조건과 달라 거부한다. 이는 현 v2.4 계약과 양립한다. 나머지 행은 두 버전 오류가 같으며, 이것만으로 노출 여부를 식별할 수 없다.',
 '', '최초 대비 최종 수정은 B01 M2206#22 발문·#33 오답① 이유, A02 M2206#42 R6 반사실 how·2021#22/#23/#24 발문·#31 오답⑤ 이유, B02 2021#31 오답⑤ 이유다. primary·relevance·decision_path·outside 변경0. M2206#42 links 전체가 바뀌었다고 뭉뚱그리지 않고 기존 locus 반사실에 how만 보강한 것을 확인했다. 최초부터 결함이 없었다는 주장은 refuted며 최종 수정 뒤 계약 통과는 confirmed다.',
 '', '## 원문 후보10·갈림10 및 지정 경계','',
 ...candidate.map(x=>`- candidate ${x.item}/${x.task}: **${x.verdict}** — ${x.why} (${x.evidence.join('; ')})`),
 ...disputed.map(x=>`- disputed ${x.item}/${x.task}: **${x.verdict}** — ${x.why} (${x.evidence.join('; ')})`),
 ...boundary.map(x=>`- boundary ${x.item}: **${x.verdict}** — ${x.why} (${x.evidence.join('; ')})`),
 '', '후보 confirmed는 지정 TASK의 원문 근거를 지지한다는 뜻이다. 행 전체·독립평가 적격·단일 primary·진단 타당도를 인증하지 않는다. 원문 갈림을 강제로 해소하지 않았으며 새 P0/P1은 없다.',
 '', '## 전행 대조표','', '오류 수는 행 검증기 기준이다. primary null 및 E1의 버전별 차이도 그대로 남긴다. 최초 전문·행 원문은 local 파일에만 있다.','',
 '|상태|트랙|문항|primary|v2.4 오류|v2.5 오류|근거|','|---|---|---|---|---:|---:|---|',
 ...[['최초',s.firstRows],['최종',s.traceRows]].flatMap(([state,rs])=>rs.map(x=>`|${state}|${x.track}|${x.item}|${x.primary??'null'}|${x.v24_errors.length}|${x.v25_errors.length}|${x.evidence}|`)),
 '', '## 미확정·미실행·마무리','',...verdict.unclear.map(x=>'- unclear: '+x),
 '', 'DB 쓰기·입력 저장소 수정·새 분석자 실행·제품 E2E·사람 Gold/학생 측정·봉인 승인·main/원격 통합은 미실행이며 통과가 아니다. 다섯 수용 범위의 검증은 모두 수행해 skip_count=0이다. 원문·명령 출력은 두 폴더의 .gitignore에서 *.local.json으로 제외한다. Git add/commit 시도 후 evidence와 submit을 실행하고 출력 원문은 scripts/research/goal-data/review-b13/finish.local.json에 보존한다. 커밋 실패와 검증 수행 완료를 구분한다.',''
]
fs.writeFileSync(dest+'review.md',lines.join('\n'))
console.log(JSON.stringify({checks:checks.length,failed:0,acceptance:acceptance.map(x=>({index:x.index,verdict:x.verdict})),new_P0:0,new_P1:0,next_batch:verdict.next_batch},null,2))
