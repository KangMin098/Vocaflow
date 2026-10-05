# FYM F02 reading smoke 재현

## F02 새 hash 재검수 (2026-10-05)

[수정 층위·결과](../../../docs/reports/academic-reading-f02-revision-20261005.md). 아래 절차는 이전 smoke의 `replay` 원본 청크를 보존하고, 현재 DB 원문을 별도 작업 폴더에 다시 export한다. `revise-f02.mjs`는 원문 hash/revision과 두 target key가 이전 실행과 같지 않으면 중단한다. 원문이 바뀌었으면 임의로 기존 초안에 새 원문을 붙이지 말고 근거를 다시 분석한다.

```powershell
$work = '.agent-logs/academic-reading-f02-r2'
$common = @('--source','frym','--research-origins','scripts/textbook/academic-reading-smoke/f02-origin.json','--preservation-rules','scripts/textbook/frym-precision/preservation-rules-1.json','--precision-review','scripts/textbook/frym-precision/round-1.json','--limit','4','--size','4')
pnpm.cmd exec tsx --tsconfig apps/web/tsconfig.json scripts/textbook/adapt-drain-export.mjs --target scripts/textbook/targets/knowledge-middle1.json @common --dir "$work/middle1"
pnpm.cmd exec tsx --tsconfig apps/web/tsconfig.json scripts/textbook/adapt-drain-export.mjs --target scripts/textbook/targets/knowledge-high1-simple.json @common --dir "$work/high1"
node scripts/textbook/academic-reading-smoke/revise-f02.mjs $work
pnpm.cmd exec tsx --tsconfig apps/web/tsconfig.json scripts/textbook/academic-reading-smoke/measure-f02-lexicon.mjs $work --apply
pnpm.cmd exec tsx --tsconfig apps/web/tsconfig.json scripts/textbook/adapt-review-export.mjs --dir "$work/middle1"
pnpm.cmd exec tsx --tsconfig apps/web/tsconfig.json scripts/textbook/adapt-review-export.mjs --dir "$work/high1"
pnpm.cmd exec tsx --tsconfig apps/web/tsconfig.json scripts/textbook/academic-reading-smoke/build-review-packet.mjs $work
```

어휘 측정기는 DB의 `shared_dictionary`를 **읽기만** 한다. `--apply`는 `reading_analysis`에 측정 설명을 넣어 draft hash를 바꾸므로, 그 뒤 review export/packet을 다시 만들어야 한다. 중복 적용을 피하려면 `revise-f02.mjs`부터 다시 실행한다. 생성된 `F02-review-packet.json` 하나를 Claude Code와 Codex에 각각 독립적으로 전달하고 [동일한 판정 계약](./review-prompt.md)에 맞는 결과를 `$work/claude-f02-complete-review.txt`와 `$work/codex-f02-complete-review.txt`에 저장한다. 첫 smoke와 같은 `fill-reviews.mjs`, 두 target의 `adapt-drain-import.mjs`(**`--commit` 없이**), `run-injections.mjs` 순서로 확인한다. 원문 전문·검수 원문은 ignored 작업 폴더에만 둔다. `educational validation required before DB seed`는 정상적인 사람 평가 대기 상태다.

이 디렉터리는 [2026-10-05 결과](../../../docs/reports/academic-reading-smoke-20261005.md)를 다시 만드는 입력 구성기와 실패 주입기다. 추적된 `f02-origin.json`은 DOI·인용·원천 hash/revision 메타데이터만 담는다. FYM 본문 전체는 현재 DB에서 읽어 ignored `.agent-logs` 아래에만 둔다. 원천이 바뀌면 기존 hash에 맞추어 고치지 말고 smoke를 새 회차로 다시 검수한다. 모든 명령은 읽기 전용 DB 접근 또는 로컬 파일 쓰기이며 `--commit`을 붙이지 않는다.

PowerShell에서 저장소 루트를 현재 디렉터리로 놓고 **빈** 작업 디렉터리에 실행한다.

```powershell
$work = '.agent-logs/academic-reading-e2e-smoke/replay'
$common = @('--source','frym','--research-origins','scripts/textbook/academic-reading-smoke/f02-origin.json','--preservation-rules','scripts/textbook/frym-precision/preservation-rules-1.json','--precision-review','scripts/textbook/frym-precision/round-1.json','--limit','4','--size','4')
pnpm exec tsx --tsconfig apps/web/tsconfig.json scripts/textbook/adapt-drain-export.mjs --target scripts/textbook/targets/knowledge-middle1.json @common --dir "$work/middle1"
pnpm exec tsx --tsconfig apps/web/tsconfig.json scripts/textbook/adapt-drain-export.mjs --target scripts/textbook/targets/knowledge-high1-simple.json @common --dir "$work/high1"
node scripts/textbook/academic-reading-smoke/build-drafts.mjs $work
pnpm exec tsx --tsconfig apps/web/tsconfig.json scripts/textbook/adapt-review-export.mjs --dir "$work/middle1"
pnpm exec tsx --tsconfig apps/web/tsconfig.json scripts/textbook/adapt-review-export.mjs --dir "$work/high1"
pnpm exec tsx --tsconfig apps/web/tsconfig.json scripts/textbook/academic-reading-smoke/build-review-packet.mjs $work
```

`F02-review-packet.json`은 **완성된 `.out.json`의 전체 분석·문항 계획·권리 정보와 review binding**을 담는다. 패킷 생성기는 현재 초안에서 `reviewIdentity`를 재계산해 정확히 일치하는 양식 1개만 선택하며, 초안이 수정된 뒤 오래된 양식으로 패킷을 만들면 중단한다. Claude Code와 Codex에 각각 독립 세션으로 전달하고 다른 검수자의 답은 제공하지 않는다. [동일한 판정 프롬프트](./review-prompt.md)를 각 실행에 전달하고 아래 경로에 원문 결과를 저장한다. 결과는 `id`, `source_hash`·`target_hash`·`draft_hash`, `verdict` (`pass|reject|insufficient_evidence`), `dimensions` ([12개 필드](../academic-reading-review.mjs)의 참/거짓), `distortions`, 실제 인용, 근거를 포함해야 한다. `fill-reviews.mjs`는 **현재 초안에서 다시 계산한 결속 정보**와 결과가 일치할 때만 현재 양식 1개를 갱신하고 이전 해시의 검수 기록은 보존한다. importer가 인용·차원·해시를 다시 검증한다.

```powershell
$prompt = (Get-Content scripts/textbook/academic-reading-smoke/review-prompt.md -Raw).Replace('{{WORK}}', $work)
claude.cmd -p $prompt --tools Read --permission-mode dontAsk --output-format text | Out-File "$work/claude-f02-complete-review.txt" -Encoding utf8
codex exec -s read-only -o "$work/codex-f02-complete-review.txt" $prompt
```

```powershell
pnpm exec tsx --tsconfig apps/web/tsconfig.json scripts/textbook/academic-reading-smoke/fill-reviews.mjs $work
pnpm exec tsx --tsconfig apps/web/tsconfig.json scripts/textbook/adapt-drain-import.mjs --target scripts/textbook/targets/knowledge-middle1.json --dir "$work/middle1" --preservation-rules scripts/textbook/frym-precision/preservation-rules-1.json --precision-review scripts/textbook/frym-precision/round-1.json
pnpm exec tsx --tsconfig apps/web/tsconfig.json scripts/textbook/adapt-drain-import.mjs --target scripts/textbook/targets/knowledge-high1-simple.json --dir "$work/high1" --preservation-rules scripts/textbook/frym-precision/preservation-rules-1.json --precision-review scripts/textbook/frym-precision/round-1.json
pnpm exec tsx --tsconfig apps/web/tsconfig.json scripts/textbook/academic-reading-smoke/run-injections.mjs $work
```

2026-10-05의 기대 결속: 원천 hash `be013e6a1cafece83b78f84a8de7ef31a578842000cce580dccea11caccda4dd`; target key 중1 `a7f5e450d09a4eb4e12ca4bb`, 고1 `b117d0a5ee0a0fc72bc711da`; draft hash 중1 `b5cc79d2846903f244a70b83b4f18013aee3da2ed7e4d082cd89b8b4fec389fe`, 고1 `c97a53cb9f224e35e6a188efcfc174caa604489c1e24cb3ebfd32f5b96d7de61`. 위 tracked origin만으로 새 디렉터리에 export·draft·review 양식을 다시 만들었을 때 세 hash 종류가 원 실행과 일치했다. 독립 LLM 평가는 확정 재현 값이 아니므로 실제 verdict와 불일치는 기록한다. `run-injections.mjs`는 실제 verdict와 무관하게 메모리 안에서만 통과를 가정해 정상 gate와 원문/target/각색/절단/권리 변조 차단을 검사하며 결과를 `$work/injection-results.json`에 쓴다.

이 smoke의 학년별 난도 profile은 학생 측정값이 아니다. 독립 검수 불일치와 교육적 검증 미완료가 해소되기 전에는 DB seed 또는 실제 문항 export로 승격하지 않는다.

완성 초안 검수의 2026-10-05 결과는 중1·고1 모두 Claude Code `reject`(문항 근거·분석 결함), Codex `insufficient_evidence`(난도 근거 부족)였다. 본문 의미 보존은 양쪽이 유지했지만 수정을 끝내고 새 draft hash로 재검수하기 전에는 두 행 모두 보류한다.
