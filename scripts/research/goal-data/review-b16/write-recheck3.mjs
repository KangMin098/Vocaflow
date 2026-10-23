// scripts/research/goal-data/review-b16/write-recheck3.mjs
import fs from 'node:fs'
const out='scripts/research/goal-data/review-b16/',doc='docs/research/goal-data-batches/review-b16/'
const r=JSON.parse(fs.readFileSync(out+'recheck3.local.json','utf8'))
if(r.checks.some(c=>!c.pass))throw Error('Verification incomplete')
const v='scripts/research/goal-data/d2-validate.mjs',run='scripts/research/goal-data/d2-run.mjs'
const acceptance=[
 {index:0,status:'resolved',detail:'입력 삭제 1개: 19행/114쌍, 삭제·개명 2개: 0행/0쌍. 전체 runner exit1, 소유권 확인 불가 진단, 해당 청크 전체 배제, 위반 두 행 결합 제외. 입력 없는 checkChunk는 예외 정지하고 청크 runner는 exit1로 안전하게 표시한다.',references:[v+':163',v+':164',v+':187',v+':199',run+':90']},
 {index:1,status:'unresolved',detail:'숫자 경계는 정의된 문항 문법에서 타당하다. 실제 1302 ID × 7문맥(9114건) 누락0. 영문자·밑줄·괄호·소문자·A/B형, 자기 ID 보존, 과잉 가림을 확인했다. 다른/자기 청크 출력 JSON 및 자기 청크 입력 JSON 예외, ID 포함 경로는 가려진다. 하지만 validate 진입 전 배치 input.json 파싱과 tasks 해석 예외는 maskIds를 거치지 않아 stderr와 스택에 외부 ID가 남는다.',references:[v+':193',v+':196',v+':199',v+':223',run+':23',run+':30',run+':78',run+':81']},
 {index:2,status:'resolved',detail:'제공 회귀31/31. 실제 makeValidator와 pilot validateRow/validateChunk로 자기 빈 출력(누락20), 넷째 반복 참여(결함1), 소유권 맞바꿈(38행/228쌍), 상태만 배제(0행/0쌍)를 재현했다. otherUnreadable과 자기 빈 출력·행 결함·출력 누락의 조합에서도 자기 결함이 exit1이다. b2–b16 캡처16변형의 전체 validate 로그·exit 불변.',references:[v+':209',v+':213',v+':215',v+':224',v+':227',run+':87','scripts/research/goal-data/d2-validate.check.mjs:73',out+'recheck3.mjs:1']},
 {index:3,status:'resolved',detail:'recheck3.json·recheck3.md, 새 P0/P1와 b17 가부, 재현 스크립트 및 local 원출력을 기록했다.',references:[doc+'recheck3.json:1',doc+'recheck3.md:1',out+'recheck3.mjs:1']},
]
const findings=[{
 id:'RECHECK3-P1-01',priority:'P1',status:'unresolved',title:'청크 출력 가림 전에 실행되는 runner 초기화 예외가 외부 ID를 노출한다',
 references:[run+':23',run+':30',run+':61',run+':78',run+':81'],
 trigger:'b16 배치 input.json을 실제 외부 ID가 들어간 깨진 JSON으로 바꾼 메모리 overlay에서 validate A 02 실행. 별도로 유효 JSON의 tasks에 외부 ID 문자열을 넣어 초기화 오류 유발.',
 observed:{malformed_batch_input:'uncaught SyntaxError; stderr contains foreign ID and JSON.parse / d2-run.mjs:23 stack',undefined_task:'uncaught Error includes foreign ID; no say()/maskIds call',ordinary_chunk_json_paths:'masked; regression fixed'},
 impact:'청크 입력·출력 파일의 기존 예외 수정은 확인됐지만 모든 청크 모드 출력이라는 계약은 충족하지 않는다. 공유 배치 입력 오류 시 분석자에게 다른 청크 문항 정보가 보일 수 있다. 이전부터 있던 초기화 경로의 잔여 구멍이며 이번 수정으로 생긴 회귀라고 단정하지 않는다.',
 recommendation:'청크 모드를 판별한 뒤 입력 파싱·tasks 해석·validator 생성까지 포함하는 최상위 오류 경계를 두고, 안전한 메시지만 maskIds를 거쳐 출력한다. uncaught stderr 스택에 원문/ID가 나오지 않는 실제 프로세스 회귀를 추가한다.',
}]
const result={task_id:'T-0127',owner_id:'goal-data-independent',input:{commit:r.rev,base_commit:r.old,diff_sha256:r.diff_sha256,changed_files:4,source_read_only:true,pinned_git_sources:true,local_packet_bytes_unchanged:true,local_packets:296},observed_at:r.observed_at,result:'pass',result_semantics:'검증 수행 완료이며 수용 기준 전체 통과를 뜻하지 않음',skip_count:0,checks:{independent:r.checks.length,failed:0,shipped:31,unchanged_batch_variants:16,exam_list_unique_ids:1302,mask_adjacency_cases:9114,mask_misses:0,backspace_bytes:0},acceptance,previous_findings:[{id:'RECHECK2-P1-01',status:'resolved'},{id:'RECHECK2-P1-02',status:'resolved',detail:'기존 영문자/밑줄 인접과 청크 JSON 예외 반례는 해소. 더 넓은 출력 계약의 초기화 경로는 새 발견으로 분리.'}],new_p0:0,new_p1:1,findings,b17:{allowed:false,decision:'b17 보류 — 배치 입력 초기화 예외도 청크 출력 가림 경계에 포함하고 재검증해야 한다.'},limitations:['배치·청크 소스는 고정 커밋 git show로 읽고 쓰기·삭제·개명은 VM 메모리 overlay에서만 실행했다. 실제 child process의 uncaught stderr도 같은 실제 runner 모듈/고정 소스/overlay로 재현했으며 입력 worktree에는 쓰지 않았다.','제공 구조 회귀의 일부는 row/chunk stub을 쓴다. 독립 검사는 실제 전체 검증 함수로 별도 재현했다.','숫자 경계는 문항 문법의 토큰 검사다. 5자리 연도/3자리 번호 같은 문법 밖 문자열의 내부 부분문자열까지 알려진 ID로 가려야 한다는 더 강한 계약은 주장하지 않는다. 가상 ID 형태는 보수적으로 가려진다.','DB 전수·제품 build/E2E·학습자 측정·원격/main 통합은 미실행이며 통과로 세지 않는다. 기존 b16 노출 이력·Gold/학생 진단 승격도 해소했다고 주장하지 않는다.'],raw_evidence:[out+'recheck3.local.json',out+'recheck3-diff.local.json',out+'recheck3-finish.local.json',out+'packets.local.json']}
fs.writeFileSync(doc+'recheck3.json',JSON.stringify(result,null,2)+'\n')
const md=`# T-0127 · fail-closed·ID 경계·JSON 경로 독립 재검증

**새 P0 0 / P1 1 · b17 보류.** result=pass는 검증 수행 완료다. skip_count=0이며 AC1은 unresolved다.

입력 @${r.rev}, ${r.old}..${r.rev}의 4파일 전체 diff(b226539c2·fc3690e3a)를 정독했다. 중앙 development_policy를 읽었고 첫 task show에서 IN_PROGRESS/session t-0127-codex가 일치해 추가 대기는 없었다. PID 조회는 하지 않았다. 다른 세션 소유 입력은 읽기만 했다. 이전 캡처296파일은 현재 바이트와 일치한다.

## 수용 기준

${acceptance.map(a=>`- AC${a.index} **${a.status}** — ${a.detail} (${a.references.join('; ')})`).join('\n')}

## 숫자 경계 독립 판정

데이터 담당의 숫자 경계가 정의된 문항 문법에 맞다. 이전 판정자가 제안한 (?<![0-9A-Za-z#])는 앞에 영문자가 붙은 실제 ID를 놓쳐 부적절하다. 현재 구현은 실제 평가원 목록1302개(630+672) × 7문맥9114건에서 누락0이다. 별도로 M 접두어·소문자·A/B형·한 자리 번호를 확인했다. 자기 ID는 보존한다. 5자리 연도·3자리 번호는 문법 밖이므로 그대로 두고, 목록에 없는 가상 ID 꼴도 가려 보수적 과잉 가림이 있다. 이 판정은 알려진 ID의 모든 임의 부분문자열을 지운다는 주장이 아니다. (${v}:193; ${v}:196; scripts/csat/data/questions.json:1; scripts/csat/data/mock-questions.json:1)

## 해소된 반례와 잔여 P1

입력1개 삭제 시19행·114쌍, 2개 삭제/개명 시0행·0쌍이며 위반 행은 결합되지 않는다. 다른 청크 JSON이 깨지면 자기 청크는 결함0·상태만, 자기 출력 JSON이 깨지면 결함1·exit1이다. 자기 입력 JSON 예외와 파일 경로의 외부 ID도 가려진다. otherUnreadable은 자기 누락·행 결함을 숨기지 않는다. (${v}:164; ${v}:205; ${v}:223; ${run}:78)

**RECHECK3-P1-01 — runner 초기화 예외가 가림 경계 밖이다.** 배치 input.json 파싱(:23)과 tasks 해석(:30)은 validate 안의 say/maskIds(:78)와 try(:79)보다 먼저 실행된다. 실제 외부 ID를 포함한 잘못된 배치 JSON은 uncaught SyntaxError의 stderr와 JSON.parse/d2-run.mjs:23 스택에 ID를 남긴다. 유효 JSON의 정의 밖 task 문자열도 그대로 예외 메시지에 남는다. 청크 파일 JSON의 기존 반례는 수정됐지만 “모든 청크 모드 출력”은 미충족이다. 이는 잔여 초기화 경로이며 새 회귀라고 단정하지 않는다. 청크 모드 최상위 오류 경계가 입력 읽기·파싱·validator 생성까지 감싸야 한다. 원문·stderr·스택은 local 증거에만 보존한다. (${run}:23; ${run}:30; ${run}:78; ${run}:81)

## 검증 범위

제공31/31, 독립${r.checks.length}/${r.checks.length}, b2–b16 캡처16변형 전체 validate 로그·exit 불변. 실제 runner·makeValidator·pilot validateRow/validateChunk를 고정 Git 소스로 VM에서 실행했다. 제공 구조 회귀의 stub은 한계로 기록하고 독립 재현은 실제 전체 함수를 사용했다. 자기 빈 출력은 누락20, 넷째 참여는 결함1, 맞바꿈은38행/228쌍, 무관 반복의 상태만 배제는0행/0쌍이다. 첫 시험에서 VM의 rmSync 무동작이 제공 fail-closed 검사를 거짓 실패시켜 메모리 삭제를 구현했고, PowerShell→node 파이프의 문자 손상도 수정한 뒤 재실행했다. 제품 소스는 수정하지 않았다.

재현: node --experimental-vm-modules ${out}recheck3.mjs → node ${out}write-recheck3.mjs → node ${out}finish-recheck3.mjs. 원문·전체 diff·명령 출력은 *.local.json에만 둔다. DB·제품 build/E2E·학습자 측정·원격/main 통합은 미실행이다. Git 커밋 성공과 검토 수행 완료는 별개이며 최종 명령 원출력은 recheck3-finish.local.json에 기록한다.

**${result.b17.decision}**
`
fs.writeFileSync(doc+'recheck3.md',md)
console.log(JSON.stringify({acceptance:acceptance.map(a=>a.status),checks:r.checks.length,new_p0:0,new_p1:1,b17:'hold'}))
