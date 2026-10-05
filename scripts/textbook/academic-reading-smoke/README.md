# FYM F02 reading smoke 재현

이 디렉터리는 [2026-10-05 결과](../../../docs/reports/academic-reading-smoke-20261005.md)를 다시 만드는 입력 구성기와 실패 주입기다. 추적된 `f02-origin.json`은 DOI·인용·원천 hash/revision 메타데이터만 담는다. FYM 본문 전체는 현재 DB에서 읽어 ignored `.agent-logs` 아래에만 둔다. 원천이 바뀌면 기존 hash에 맞추어 고치지 말고 smoke를 새 회차로 다시 검수한다. 모든 명령은 읽기 전용 DB 접근 또는 로컬 파일 쓰기이며 `--commit`을 붙이지 않는다.

PowerShell에서 저장소 루트를 현재 디렉터리로 놓고 **빈** 작업 디렉터리에 실행한다.

```powershell
$work = '.agent-logs/academic-reading-e2e-smoke/replay'
$common = @('--source','frym','--research-origins','scripts/textbook/academic-reading-smoke/f02-origin.json','--preservation-rules','scripts/textbook/frym-precision/preservation-rules-1.json','--precision-review','scripts/textbook/frym-precision/round-1.json','--limit','4','--size','4')
pnpm exec tsx --tsconfig apps/web/tsconfig.json scripts/textbook/adapt-drain-export.mjs --target scripts/textbook/targets/knowledge-middle1.json @common --dir "$work/middle1"
pnpm exec tsx --tsconfig apps/web/tsconfig.json scripts/textbook/adapt-drain-export.mjs --target scripts/textbook/targets/knowledge-high1-simple.json @common --dir "$work/high1"
node scripts/textbook/academic-reading-smoke/build-drafts.mjs $work
node scripts/textbook/academic-reading-smoke/build-review-packet.mjs $work
pnpm exec tsx --tsconfig apps/web/tsconfig.json scripts/textbook/adapt-review-export.mjs --dir "$work/middle1"
pnpm exec tsx --tsconfig apps/web/tsconfig.json scripts/textbook/adapt-review-export.mjs --dir "$work/high1"
```

`F02-review-packet.json`을 Claude Code와 Codex에 **각각 독립 세션으로** 전달한다. 다른 검수자의 답은 제공하지 않는다. [동일한 판정 프롬프트](./review-prompt.md)를 각 실행에 전달하고 아래 경로에 원문 결과를 저장한다. 두 번째 실행이 첫 번째 결과 파일을 읽지 않도록 프롬프트가 packet만 지정한다. 결과는 `id`, `verdict` (`pass|reject|insufficient_evidence`), `dimensions` ([12개 필드](../academic-reading-review.mjs)의 참/거짓), `distortions`, 실제 인용, 근거를 포함해야 한다. `fill-reviews.mjs`는 verdict를 바꾸지 않고 UUID/target/source/draft hash가 붙은 review 양식에 각 결과를 옮긴다. importer가 인용·차원·해시를 다시 검증한다.

```powershell
$prompt = (Get-Content scripts/textbook/academic-reading-smoke/review-prompt.md -Raw).Replace('{{WORK}}', $work)
claude.cmd -p $prompt --tools Read --permission-mode dontAsk --output-format text | Out-File "$work/claude-f02-rights-review.txt" -Encoding utf8
codex exec -s read-only -o "$work/codex-f02-review.txt" $prompt
```

```powershell
node scripts/textbook/academic-reading-smoke/fill-reviews.mjs $work
pnpm exec tsx --tsconfig apps/web/tsconfig.json scripts/textbook/adapt-drain-import.mjs --target scripts/textbook/targets/knowledge-middle1.json --dir "$work/middle1" --preservation-rules scripts/textbook/frym-precision/preservation-rules-1.json --precision-review scripts/textbook/frym-precision/round-1.json
pnpm exec tsx --tsconfig apps/web/tsconfig.json scripts/textbook/adapt-drain-import.mjs --target scripts/textbook/targets/knowledge-high1-simple.json --dir "$work/high1" --preservation-rules scripts/textbook/frym-precision/preservation-rules-1.json --precision-review scripts/textbook/frym-precision/round-1.json
pnpm exec tsx --tsconfig apps/web/tsconfig.json scripts/textbook/academic-reading-smoke/run-injections.mjs $work
```

2026-10-05의 기대 결속: 원천 hash `be013e6a1cafece83b78f84a8de7ef31a578842000cce580dccea11caccda4dd`; target key 중1 `a7f5e450d09a4eb4e12ca4bb`, 고1 `b117d0a5ee0a0fc72bc711da`; draft hash 중1 `b5cc79d2846903f244a70b83b4f18013aee3da2ed7e4d082cd89b8b4fec389fe`, 고1 `c97a53cb9f224e35e6a188efcfc174caa604489c1e24cb3ebfd32f5b96d7de61`. 위 tracked origin만으로 새 디렉터리에 export·draft·review 양식을 다시 만들었을 때 세 hash 종류가 원 실행과 일치했다. 독립 LLM 평가는 확정 재현 값이 아니므로 실제 verdict와 불일치는 기록한다. 당시 importer는 Codex의 `insufficient_evidence` 때문에 두 target 모두 적재 가능 0건이었다. `run-injections.mjs`는 실제 검수 기록을 바꾸지 않고 메모리 안에서만 통과를 가정해 정상 gate와 원문/target/각색/절단/권리 변조 차단을 검사하며 결과를 `$work/injection-results.json`에 쓴다.

이 smoke의 학년별 난도 profile은 학생 측정값이 아니다. 독립 검수 불일치와 교육적 검증 미완료가 해소되기 전에는 DB seed 또는 실제 문항 export로 승격하지 않는다.
