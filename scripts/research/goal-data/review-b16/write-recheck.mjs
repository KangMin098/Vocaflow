// scripts/research/goal-data/review-b16/write-recheck.mjs
import fs from 'node:fs'
const out='scripts/research/goal-data/review-b16/',doc='docs/research/goal-data-batches/review-b16/'
const raw=JSON.parse(fs.readFileSync(out+'recheck.local.json')),summary=JSON.parse(fs.readFileSync(out+'recheck-summary.local.json'))
if(summary.failed.length||summary.skip_count!==0)throw Error('Recheck incomplete')
const v='scripts/research/goal-data/d2-validate.mjs',run='scripts/research/goal-data/d2-run.mjs',prompt='docs/research/goal-data-batches/D2-task-mapping/prompts/batch-analyst.md'
const acceptance=[
 {index:0,status:'unresolved',detail:'T-0124 P1-01/02 resolved with complete real row/chunk functions: own empty output has 20 missing rows and exit1; fourth participant has one track defect and exit1. Ordinary counterexamples expose no foreign IDs. However the broader no-foreign-ID contract is unresolved: free reason text leaks a foreign ID (RECHECK-P1-02).',references:[v+':187',v+':199',v+':201',run+':75']},
 {index:1,status:'unresolved',detail:'160 deterministic boundary cases preserve reasons/reasonsDetail projection and track exclusion. State-only clean chunk yields track out.size=0, agree pairs=0 and all 40 HUMAN_REVIEW_REQUIRED. But ownership swaps give chunk defect sum4 versus loadTrack errors0, full validate exit0, agree pairs240 (RECHECK-P1-01). Counts need not be numerically equal for track groups or exclusion-derived missing rows; acceptance contradiction is established by actual disagreeing acceptance.',references:[v+':151',v+':163',v+':187',v+':188',run+':107']},
 {index:2,status:'resolved',detail:'Shipped 23/23; the shipped last three use stubs, independently replaced here by complete actual b16 sources and validators. First b14 B01 defects3/exit1, B02 defects0/exit0 with state notice; final b16 A01/A02/B01/B02 clean. All 16 captured b2-b16 batch variants have identical full validate logs/exits across old/new commits. Manual-only output correction instruction present at the target.',references:['scripts/research/goal-data/d2-validate.check.mjs:84',v+':189',prompt+':14']},
 {index:3,status:'resolved',detail:'Both requested artifacts, two new P1 findings, zero new P0, and one-line b17 hold decision recorded. Review pass means completed verification, not all acceptance assertions satisfied.',references:[doc+'recheck.json:1',doc+'recheck.md:1']},
]
const findings=[
 {id:'RECHECK-P1-01',priority:'P1',status:'unresolved',title:'loadTrack accepts rows assigned to the wrong chunk while checkChunk rejects them',introduced_by_diff:false,trigger:'Exchange the first valid A01 and A02 rows, preserving all 40 IDs exactly once and every row field.',observed:{chunk_defects:[2,2],whole_track_defects:0,whole_validate_exit:0,agree_pairs:240},impact:'A chunk validation failure is not enforced at combination. The documented per-chunk ownership contract can be bypassed by full-track validation/agreement. Existing loader omission becomes explicit divergence with the new checker; not evidence of trackExcluded leakage.',references:[v+':156',v+':163',v+':187',v+':188',run+':107'],recommendation:'Share structured chunk ownership/missing checks with loadTrack, enforce them before accepting rows, and cover a real runner swap counterexample.'},
 {id:'RECHECK-P1-02',priority:'P1',status:'unresolved',title:'Foreign chunk IDs remain visible in reason text despite filtered affected-ID lists',introduced_by_diff:true,trigger:'Give two A01 rows and one A02 row the same not_observable reason beginning with the ID of a different A01 row; retain valid complete row data.',observed:{own_chunk_defects:1,exit:1,old_version_redacts:true,new_version_leaks:true},impact:'The own-ID list is filtered, but e.text is interpolated verbatim. The old runner redacted foreign IDs throughout the message. The new runner leaks a known foreign ID even without misplaced rows; wrong-chunk row errors also print foreign IDs directly.',references:[v+':133',v+':136',v+':188',v+':201'],recommendation:'Redact all known foreign IDs from every rendered diagnostic, including reason snippets, row/chunk messages and wrong-chunk-ID diagnostics, while preserving structured membership internally.'},
]
const result={task_id:'T-0125',owner_id:'goal-data-independent',result:'pass',result_semantics:'verification performed; unresolved assertions and new findings remain',skip_count:0,input:{commit:raw.rev,base_commit:raw.old,diff_sha256:raw.diff_sha256,source_worktree_read_only:true,execution:'Pinned actual runner and actual pilot validateRow/validateChunk via VM modules; filesystem writes confined to in-memory overlay; no validator function stubs',local_packets:296,source_packets_unchanged:true},observed_at:raw.observed_at,checks:{total:summary.total,failed:0,shipped:23,random_boundary_cases:160,seed:125,ownership_divergences:summary.fuzz.ownership_divergences},previous_findings:[{id:'T-0124 P1-01',status:'resolved',references:[v+':187']},{id:'T-0124 P1-02',status:'resolved',references:[v+':199']}],acceptance,new_p0:0,new_p1:2,findings,b17:{allowed:false,decision:'b17 보류 — 청크 소유권의 결합 우회와 다른 청크 ID 비노출 회귀를 수정·재검증한 뒤 연구 후보 확대 재개.'},regression:raw.regression.map(r=>({batch:r.batch,unchanged:true,before_exit:r.before_exit,after_exit:r.after_exit})),limitations:['No production DB read/write, product build/E2E, learner measurement or remote/main integration performed; none counted as passed.','Generated b16 exposure history and semantic uncertainty from T-0124 are not retrospectively resolved.','The 160 deterministic cases are exploration, not exhaustive proof.'],raw_evidence:[out+'recheck.local.json',out+'recheck-diff.local.json',out+'packets.local.json',out+'recheck-finish.local.json']}
fs.writeFileSync(doc+'recheck.json',JSON.stringify(result,null,2)+'\n')
const md=`# T-0125 · b16 청크 실행기 재검증

**기존 T-0124 P1-01/02 resolved · 새 P0 0 / P1 2 · b17 보류.** result=pass는 검증 수행 완료이며 주장 전체 통과가 아니다. skip_count=0.

입력 @${raw.rev}, diff ${raw.old}..${raw.rev} 전체 5파일을 정독했다. 첫 task show에서 IN_PROGRESS/session t-0125-codex가 일치했다. PID 조회 없음. 중앙 development_policy를 UTF-8로 확인했다. 입력 worktree는 읽기만 했고, 이전 캡처 296파일의 현재 바이트 동일성을 다시 확인했다. 실제 고정 runner와 pilot-lib의 validateRow·validateChunk 및 계약 검사 전체를 VM에서 실행했으며 FS 쓰기는 메모리 overlay로만 받았다. 빈 행·청크 함수로 대체하지 않았다.

## 수용 기준

${acceptance.map(a=>`- AC${a.index} **${a.status}** — ${a.detail} (${a.references.join('; ')})`).join('\n')}

## 기존 반례의 실제 재실행

P1-01: A01 첫 3행 반복 + A02 rows=[]에서 A02 자기 누락 20개·exit1. P1-02: 같은 반복에 A02 첫 행을 넷째로 넣으면 A02 트랙 결함 1개·exit1. 두 경우 일반 진단에 다른 청크 ID는 없다. 실제 청크 반복 결함 및 실제 행 primary_reason 누락도 각각 결함으로 집계돼 빈 함수로 만든 성공이 아님을 확인했다. (${v}:187; ${v}:189; ${v}:191)

무관한 반복만 있는 경우 A02는 결함0·exit0·trackExcluded=true다. 그러나 loadTrack A는 행0, agree는 쌍0, 전40문항 HUMAN_REVIEW_REQUIRED다. **상태만 있는 청크가 배제 트랙을 결합에 흘린다는 반례는 발견하지 못했다.** 전체 트랙 결함 수와 청크 합은 반복 그룹의 양쪽 집계·배제 후 출력 없음 때문에 수치상 같을 필요가 없다. 아래 P1은 단순 집계 차이가 아니라 실제 수용 경로 불일치다. (${v}:166; ${run}:107)

## 새 P1

**RECHECK-P1-01 — 청크 소유권 위반이 전체 validate와 agree를 통과한다 (unresolved).** 유효한 A01·A02 첫 행을 서로 교환한다. 40 ID는 모두 한 번씩 존재하고 행 내용은 불변이다. 청크별 결함은 2+2·exit1이나 전체 validate A는 결함0·exit0, loadTrack은 40행 수용, agree는 240쌍을 만든다. 고정 seed125의 160경계 입력 중 교환20건 모두 재현됐다. loadTrack은 입력 청크의 실제 ID 집합을 확인하지 않고 유효한 배치 행을 out에 넣는다. 이는 기존 로더 누락으로 새 수정이 만든 회귀라고 단정하지 않는다. checkChunk의 자기 청크 계약과 결합 로더의 수용 계약을 공유하고 실제 교환 반례를 회귀로 넣어야 한다. (${v}:156; ${v}:163; ${v}:187; ${v}:188)

**RECHECK-P1-02 — 구조화 ID 목록 밖의 설명 문자열에서 다른 청크 ID가 샌다 (unresolved, 회귀).** A01 두 행+A02 한 행에 같은 not_observable 설명을 넣되, 설명 앞에 반복 그룹 밖 A01 문항 ID를 넣었다. 실제 행·청크 검사를 통과하는 데이터에서 A02의 트랙 결함은1·exit1이고, hit 목록은 자기 ID만 표시하지만 설명 text가 외부 ID를 그대로 노출한다. 같은 입력의 이전 runner는 exit1이며 외부 ID를 가렸다. 새 checkChunk는 e.text를 그대로 출력한다. 잘못 배치된 행도 :188에서 외부 ID를 직접 출력한다. ID 목록 필터만으로는 비노출 계약을 충족하지 않는다. 전체 렌더 진단의 외부 ID를 가리거나 외부 정보를 포함하지 않는 메시지로 바꾸고 실제 행으로 회귀해야 한다. (${v}:136; ${v}:188; ${v}:201)

## 회귀·검증

${summary.total}개 검사·실패0, 제공 회귀23/23. 제공된 마지막3개의 stub 한계는 그대로이며 독립 재검에서 실제 함수를 실행했다. 최초 b14 B01은 결함3·exit1, B02는 결함0·배제 안내·exit0. 최종 b16 네 청크는 모두 결함0·exit0. 캡처한 b2–b16 전체16배치 변형의 full validate stdout/exit는 수정 전후 불변이다. 프롬프트 틀 :14에 검증 뒤 수정은 문항별 수기만이라는 지시가 있고 관측·설명도 포함한다. 과거 b16 프롬프트를 소급 변경했다고 해석하지 않는다.

160개 경계 탐색은 정상·행 교환·자기 누락·사유 누락·청크 간 반복·무관 반복·중복행·청크 링크 반복을 포함한다. reasons는 reasonsDetail.msg의 정확 투영이며, 모든 트랙 결함 입력은 loadTrack에서 행0으로 배제됐다. 전수 증명이 아니며 새 P1 두 건의 의미를 넘어 안전성을 일반화하지 않는다.

실행: node --experimental-vm-modules scripts/research/goal-data/review-b16/recheck.mjs → node scripts/research/goal-data/review-b16/write-recheck.mjs. 원문·전체 diff·명령 출력은 *.local.json에만 보존한다. DB·제품 build/E2E·학습자 측정·원격/main 통합은 미실행이며 통과로 세지 않는다. b16 과거 노출·관측 정의·의미 Gold 불확실성은 T-0124대로 남는다.

**${result.b17.decision}**

## 마무리

Git add/commit 시도 후 runtime/t-0125-ev.json(type review, result pass, skip_count0, covers[0,1,2,3]) 생성 → evidence → submit 순서로 실행한다. 커밋·evidence·submit 원출력 및 오류는 ${out}recheck-finish.local.json에 보존한다. 이 독립 검토 산출은 submit으로 다른 owner의 판정을 기다리며, 제품 변경이나 main 통합은 수행하지 않는다.
`
fs.writeFileSync(doc+'recheck.md',md)
console.log(JSON.stringify({artifacts:[doc+'recheck.json',doc+'recheck.md'],checks:summary.total,acceptance:acceptance.map(a=>a.status),new_p0:0,new_p1:2,b17:'hold'}))
