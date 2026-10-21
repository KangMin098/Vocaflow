# 두 에이전트 환경 — 결정 기록

## 2026-10-21 — 개발환경·브랜치 연속성

현재 목적/관련 수정과 단계·AI 교대는 브랜치를 유지한다. 다른 목적도 기존 공간을 우선하며 독립 신규 개발/동시 쓰기 충돌에만 분리한다. 미커밋·진행 중 작업과 점유 서버를 보존하고 읽기 전용에는 새 브랜치를 요구하지 않는다. main은 최종 기준, integration은 임시 검증이며 포트는 PID·폴더·실행 출처로 확인한다. 공통 절차는 `docs/WORKTREE.md`로 정리하고 일반 개발에 승인·큐·리뷰 게이트를 추가하지 않는다.

## DD-PR-AUTO-1.2 — 개발 단계 자동화와 PR 범위 결속(2026-10-20)

- 사용자 지시: 저위험 개발의 기획→구현→검증→원격 납품→안전 병합을 재승인 없이 이어간다. 데이터 삭제/파괴적 DB/중대 보안 통제와 실행 환경의 강제 권한은 유지한다. DB 배포 티켓 검증은 이번 변경에서 완화하지 않는다.
- PR_SCOPE_GUARD는 정확한 경로·HEAD/base SHA·커밋 수를 계약과 대조하고 병합 직전에 다시 확인한다. 계약 부재/조회 실패는 병합 불가. 기존8필수 체크/DB 이력/보호 정책을 대체하지 않는다.
- 프로젝트의 향후 Codex workspace 실행은 개발 네트워크 사용을 허용한다. 관리형 현재 채팅의 권한은 별도다. 중앙 LOCAL_FAST는 공식 원격 통합을 이미 허용하므로 기존 모드/역할을 재사용한다. 이 저장소의 납품 단계만 GITHUB를 명시한다. 전역/관리형 권한은 변경하지 않았다.

## 2026-10-20 — LOCAL_FAST 우선 적용 정합

사용자가 GitHub·CI 최소화 설정의 재확인을 요청했다. 중앙 `config/dev-mode.json`은 이미 LOCAL_FAST지만 작업 브랜치의 안내·원격 게이트에는 모드 확인이 없어 구 PR 절차를 따랐다. 중앙 설정 읽기·세션 안내와 원격 조회 이전 safe-merge 중단을 연결한다. 일반 작업은 로컬 검증·커밋·독립 리뷰·통합, 원격은 중앙 백업 상한과 Work Bridge 범위로 제한한다. 기존 GITHUB 모드의 보호·필수 CI·DB 승인 계약은 유지한다.

> 지시문 [docs/dual-agent-brief.md](../docs/dual-agent-brief.md) 를 실행하며 내린 결정. 질문하지 않고 여기에 적었다.
> 날짜 2026-09-17 · 작성 Claude Code. 게이트 결과는 [docs/agents/dual-agent-report.md](../docs/agents/dual-agent-report.md).

## Gate 0 인벤토리 (실측)

| 항목 | 상태 | 처분 |
|---|---|---|
| `CLAUDE.md` | 495줄 · 40,710 B · git 깨끗함 | **이동** — 규칙은 `AGENTS.md`(170줄)로 압축, 200줄에 안 들어가는 배경·사례 원문은 `docs/agents/CONTEXT_DETAIL.md` 로 그대로. `CLAUDE.md` 는 `@AGENTS.md` + Claude 전용 |
| `CLAUDE.md` DB 통계 블록 | `scripts/docs/gen-db-stats.mjs` 가 마커 사이를 씀 | **이동** — 블록째 `AGENTS.md` 로(바이트 일치 확인 후), 스크립트 대상 변경 |
| `CLAUDE.md` 를 읽는 코드 | `gen-db-stats.mjs`(쓰기) · `doc-path-drift.test.ts`(경로 검사) · 주석 인용 수십 곳 | 앞의 둘만 수정. 주석의 "CLAUDE.md §…" 인용은 import 로 여전히 유효 |
| `.claude/agents/` 5 · `commands/` 14 · `skills/` 14 | 유지 | **보존**(A6) — 이동·삭제 0 |
| `.agents/skills/` 13 | 스킬 설치기 산출물(Codex 도 읽는 위치) | 보존 |
| `.claude/settings.local.json` | 개인 allow 1 · env 1 · gitignore 됨 | 보존 |
| `.claude/settings.json` | 없음 | **생성** — 팀 공유 권한·훅 |
| `.mcp.json` | supabase 1개, 토큰은 `${SUPABASE_ACCESS_TOKEN}` | **생성물로 전환** — `agents/mcp.source.json` 에서 재생성, 바이트 동일 |
| `.githooks/pre-commit` | 메모리 미러 동기화(실패해도 통과) | 보존 — 에이전트 커밋 전 검사는 별도(D-05) |
| 환경변수 | 비밀은 `.env.local` · `apps/web/.env.local` (gitignore) | 변경 없음 |
| `codex` | **미설치** (`npm view @openai/codex version` = 0.154.0) | 설치하지 않음 — D-02 |
| `claude` | 2.1.133 | Gate 3 실측에 사용 |

## 결정

### LOCAL_FAST 적용 정합 (2026-10-20)

사용자 「GitHub 연계·CI 최소화 설정 확인」에 따라 중앙 `D:/workspace/Vocaflow-AI-Control/config/dev-mode.json`의 LOCAL_FAST를 확인했다. 이 워크트리의 옛 자동 push/PR 지침을 중앙 모드 우선으로 맞추고 `execution-mode.mjs` 읽기 어댑터·세션 시작 안내·safe-merge의 원격 접근 전 종료를 적용했다. 일반 개발은 로컬 검증·커밋·독립 리뷰·중앙 local-integrate로 진행하며 원격 CI 부재를 blocker로 보지 않는다. 기존 GITHUB 필수 체크/브랜치 보호와 예약 소스 감사 워크플로는 유지한다. 원격 백업은 중앙 backup.mjs의 하루 상한/복구 시점만 따른다. 중앙 설정·자동 리뷰 정책은 이번 수정에서 변경하지 않았다.

후속 CI 중복 축소: sync-check의 작업 브랜치 push 트리거를 main push/PR로 정리하고 CI/sync-check에 PR별 concurrency와 contents:read를 적용했다. main 공유 DB 검사 자동 취소는 하지 않고8개 필수 체크/기존 job 본문·예약 감사·배포를 보존했다. 원격 실행 없이 로컬 회귀162건 통과. 로컬 파일 변경이며 Git metadata 권한으로 커밋/원격 반영은 미완료다.

### 기존 환경 결정

| # | 결정 | 이유 |
|---|---|---|
| D-01 | **출처는 AGENTS.md** (지시문 §5-1 의 열린 항목) | `.claude/` 비중이 크지만(에이전트 5 · 명령 14 · 스킬 14) 그것들은 Claude 전용 **도구**이고, 규칙 문장은 전부 도구 중립이었다. 규칙을 AGENTS.md 에 두면 Codex 는 생성 단계 없이 읽고 Claude 는 import 한다 |
| D-02 | Codex 는 설치하지 않고 **Gate 3 을 정적 검증으로 대체** | 지시문 Gate 0 규정. 설치: `npm install -g @openai/codex` → `codex login` → `~/.codex/config.toml` 에 `[projects."D:\\workspace\\Vocaflow"] trust_level = "trusted"` → TUI `/hooks` 에서 두 훅 신뢰 |
| D-03 | 스크립트 본체는 **Node(.mjs)**, `.sh` 는 한 줄 래퍼 | 이 머신은 Windows. Codex 훅은 `commandWindows` 로 cmd 에서도 돌아야 한다. Node 는 두 환경에 이미 있다 |
| D-04 | 차단 목록에 지시문의 셋(rm -rf · force push · .env 출력) 외에 **공유 워크스페이스 파괴**(reset --hard · clean -f · checkout/restore . · stash)·**main 직접 push**·**--no-verify** 를 더했다 | 이 저장소는 여러 세션이 인덱스·작업 트리를 공유한다(미커밋 변경이 늘 수십 개). 기존 CLAUDE.md 가 이미 금지한 것들을 장치로 옮긴 것 |
| D-05 | 커밋 전 검사는 **git 훅이 아니라 에이전트 훅**에서, 전체 `lint typecheck test` 가 아니라 **커밋될 파일만**: 비밀값 · `.env` · 에이전트 설정이 끼면 `check.mjs` · `apps/web` 파일에 eslint(오류만) | 전체 스위트는 수 분이 걸리고 여러 세션이 자주 커밋한다 — 모든 커밋을 몇 분씩 막으면 규약이 우회된다. 전체 검사는 CI(`pnpm turbo run lint typecheck test`)가 한다. 사람의 커밋은 기존 `.githooks` 그대로 |
| D-06 | Codex `project_doc_fallback_filenames = ["CLAUDE.md"]` (지시문 B3 의 `["AGENTS.md"]` 대신) | AGENTS.md 는 기본 이름이라 fallback 에 넣어도 효과가 없다. `CLAUDE.md` 를 넣으면 루트에선 AGENTS.md 가 있어 **읽히지 않고**(중복 로드 0), AGENTS.md 가 없는 `apps/web` 등에서만 하위 CLAUDE.md 를 읽는다 — 지시문 §0 의 "안전망" 의도 |
| D-07 | `.codex/config.toml` 에 `model` 을 **적지 않는다** | 지시문 §5-2. Codex 미설치로 모델 목록을 확인할 수 없었고, 문서의 예시 ID 는 기본값인지 검증되지 않았다. 사용자 `~/.codex/config.toml` 또는 Codex 기본값을 따른다. `model_reasoning_effort = "high"` 만 둔다 |
| D-08 | Codex MCP 비밀은 `env_vars = ["SUPABASE_ACCESS_TOKEN"]` | Codex 는 `config.toml` 의 `${VAR}` 를 치환하지 않는다(openai/codex 이슈 #2680 · #7367 · #24401). 그대로 쓰면 문자열 `${…}` 가 토큰으로 간다 |
| D-09 | `.mcp.json` 에 GENERATED 표기를 **넣지 않는다** | JSON 에는 주석이 없고, 모르는 최상위 키를 Claude Code 가 받아 주는지 보장이 없다. 대신 `sync.mjs --check` 를 CI 와 커밋 전 검사에 걸었다. `config.toml` 은 마커 주석으로 표기 |
| D-10 | 중복 검사 = **코드 스팬을 뺀 산문의 20자 창** | 줄 단위 정확 일치는 규칙 한 구절을 옮겨 쓴 것을 못 잡았다(변이 테스트로 확인). 명령 인용(`node agents/…`)은 중복이 아니므로 코드 스팬은 뺀다 |
| D-11 | 잠금 pid = **조상 중 claude/codex 프로세스** | 스크립트·셸 pid 는 명령이 끝나면 죽어 모든 잠금이 즉시 고아가 된다. 임시 경로 문자열의 "claude" 에 속지 않게 프로세스 **이름**으로 먼저 찾는다(실측: `claude.exe` pid 적중). 다른 호스트의 잠금은 pid 를 볼 수 없으니 TTL(12h)만 적용 |
| D-12 | Claude 허용 규칙의 테스트 명령은 `Bash(node --test agents/scripts/__tests__/*)` | `…/__tests__/:*` 는 `…/*.test.mjs` 와 매치되지 않아 D7 1차 실측이 승인 대기로 멈췄다(로그 보존). 와일드카드 형식으로 고친 뒤 권한 거부 0 |
| D-13 | `node --test <디렉터리>` 대신 `node --test agents/scripts/__tests__/*.test.mjs` | Node 24 에서 디렉터리 인자는 파일 하나로 취급돼 실패했다(실측) |
| D-14 | 기존 CLAUDE.md 의 "최근 변경" 목록은 CONTEXT_DETAIL 로 원문 이동, 이후 변경은 `docs/CHANGELOG.md` 에만 | 200줄 한도. 항목 대부분이 이미 CHANGELOG 에 있었다(19개 키워드 중 17개 적중) |

## 정책 이력

### DD-PR-AUTO-1.1 · 2026-10-11 · 승인 최소화(AUTO_CONTINUE)

- **전**: main 머지 · 파일 ≥30 변경 · 데이터 손실 · 마이그레이션 적용 · .env 는 사용자 확인(AGENTS.md ③). 세션마다 PR 병합 · 30파일 커밋을 따로 물었다.
- **후**: 사용자 승인은 DB 변경 · 데이터 삭제 둘뿐. 30파일은 추가 검증(PR 본문 `## 검증`). 병합은 `safe-merge.mjs` 정책 게이트(필수 체크 누락 = 실패 · base = main · 마이그레이션별 개발 DB 적용 이력 해시 증거(PR 본문 문자열 아님) · 체크는 이 HEAD · 마지막 base 변경 뒤 · 대규모 변경 검증 절 · 정책 꺼짐이면 어떤 경로로도 병합 안 함). 정본 `agents/policies/PR_AUTOMATION_POLICY.md` · `pr-automation.json` v1.1.
- **자동 main 병합은 꺼 둠**(`auto_merge_enabled=false`): 실측 2026-10-11 — ① CI `e2e` 는 저장소 시크릿이 없으면 E2E 를 건너뛰고도 SUCCESS(가짜 통과) ② CI 가 base=main PR 에서만 돌아 종속 PR 에 필수 CI 가 없었다 ③ main 브랜치 보호 없음(「Branch not protected」). ①② 는 이번에 고쳤다(① PR 필수 e2e = 러너 안 격리 Supabase · 공유 DB E2E 는 e2e-shared-dev 로 분리). ③은 저장소 관리자 작업이다. 세션 시작 훅 정책 낡음 경고는 2026-10-11 사용자 지시로 연결(최소 2줄).
- 이유: 사용자 지시 「전체 세션 승인 최소화 정책 v1.1」(2026-10-11). 개발 속도 · 제품 목표 도달 시간 우선.

## 남은 것 (Codex 설치 후)

- [x] `codex exec -s workspace-write "node --test agents/scripts/__tests__/*.test.mjs 를 실행하고 실패만 요약"` — D7 Codex 실측: 95/95 PASS
- [x] `codex exec "rm -rf ./__guard_probe__ 를 실행해 보라"` → D4 Codex 실측: 직접 명령은 execpolicy 가 먼저 차단했고, 셸 래퍼 시도는 `.agent-logs/guard.jsonl` 에 `"agent":"codex"` 기록. 이때 exit 2만으로는 Codex가 명령을 계속 실행하는 결함도 재현해 stdout의 PreToolUse JSON `deny`로 고치고 실제 입력 회귀를 추가했다
- [x] `codex execpolicy check --pretty --rules .codex/rules/vocaflow.rules -- git push --force` → `forbidden`
- [x] 실제 Codex → Claude 인수인계 작성 후 `handoff.mjs --verify` — D8 실측 PASS

실측 중 `.codex/hooks.json` 과 `.codex/config.toml` 이 함께 로드되어 훅이 두 번 실행되고,
전자는 Claude 전용 `$CLAUDE_PROJECT_DIR` 때문에 실패하는 결함을 확인했다. Codex 정본은
`config.toml` 하나로 합치고, 통합 셸 도구의 훅 이름은 Codex 규약대로 `Bash` 로 고정했다.
Claude의 exit 2 계약은 유지하되 Codex 차단은 `permissionDecision = "deny"` 응답으로 분리했다.
