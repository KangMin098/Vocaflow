# 두 에이전트 라우팅 — Claude Code · Codex CLI

> 어떤 일을 어느 에이전트에 보내는가, 한도에 걸리면 어떻게 넘기는가. 규칙 정본은 [AGENTS.md](../AGENTS.md),
> 설계 결정은 [DECISIONS.md](./DECISIONS.md), 지시문 원문은 [docs/dual-agent-brief.md](../docs/dual-agent-brief.md).

## 1. 기본 담당

| 작업 형태 | 기본 담당 | 이유 |
|---|---|---|
| 설계·계획·큰 리팩터·문서·대화형 탐색 | **Claude Code** | plan mode · 스킬(`vocaflow-design` 등) · 드레인 서브에이전트 5종이 `.claude/` 에 있다 |
| LLM 판단 드레인(청크 채우기) | **Claude Code** | 전용 서브에이전트·슬래시 명령이 있다. Codex 도 같은 3단 구조로 할 수 있다(AGENTS.md) |
| 명세가 분명한 구현 · 테스트 주도 디버깅 | **Codex** (`codex exec`) | 실패 로그 → 원인 추적 루프가 짧다 |
| 회귀 테스트 작성 | **Codex** (`test-writer` 에이전트) | `.codex/agents/test-writer.toml` |
| 자동 리뷰 · CI 배치 | **Codex** (`codex review`) | 비대화형 |
| 교차 검토 | **쓴 쪽의 반대** | 다른 모델이 다른 종류의 오류를 잡는다 |

- 흐름의 기본형: **Claude 가 계획 → Codex 가 실행 → Claude 가 리뷰** (또는 그 역).
- 교차 검토는 **기능 단위에서만** 한다(비용이 대략 두 배). 잔손질·문서 한 줄은 한쪽에서 끝낸다.
  - Claude 가 쓴 기능 → `codex review --uncommitted` 또는 `reviewer` 에이전트
  - Codex 가 쓴 기능 → Claude 세션에서 `/code-review`
- 마이그레이션 적용·main 머지·`.env` 는 어느 쪽이든 사용자 확인(AGENTS.md ③).

## 2. 같은 워크트리를 동시에 쓰지 않는다

```
node agents/scripts/lock.mjs status              # 누가 쓰는 중인가
node agents/scripts/lock.mjs acquire <agent>     # 쓰기 전 (남이 살아서 쥐고 있으면 exit 3 → 읽기 전용)
node agents/scripts/lock.mjs release <agent>     # 끝나면
```

- 잠금에는 에이전트 **프로세스** pid 가 들어간다(조상 프로세스에서 `claude` / `codex` 를 찾는다). 프로세스가 죽었거나 12시간이 지나면 다음 acquire 가 고아 잠금으로 보고 해제한다.
- 장기 병행이 필요하면 워크트리를 나눈다: `pnpm wt new x-claude` · `pnpm wt new x-codex` (브랜치 `feat/x-claude` · `feat/x-codex`).
- 잠금은 **협조 규약**이다 — 규약을 모르는 세션은 막지 못한다. 그래서 커밋은 언제나 `git commit --only <paths>`.

## 3. 한도(limit) 폴백 — 5규칙

1. **한도 메시지를 보면 즉시** 인수인계를 쓴다:
   ```
   node agents/scripts/handoff.mjs claude codex \
     --done "…" --todo "…" --accept "…" --next "…" [--forbid "…"]
   node agents/scripts/lock.mjs release claude
   ```
   출력 끝의 「받는 쪽 시작 명령」을 사용자에게 그대로 전달한다.
2. 인수인계 필수 6항목: 브랜치 · 변경 파일 · 완료된 것 · **남은 것과 수용 기준** · 다음 한 동작 · 실행 금지 사항.
   `handoff.mjs --validate` 가 검사한다(비면 exit 1). 양식: [handoff.md](./handoff.md).
3. 받는 쪽 첫 동작은 항상 같다 — 세션 시작 훅이 `.agent-handoff/latest.md` 요약을 주입하면
   **수용 기준 재확인 → `handoff.mjs --verify` → `lock.mjs acquire <agent>` → `handoff.mjs --ack <agent>`**.
4. 한도가 풀려도 **작업 중인 기능은 받은 쪽이 끝낸다.** 중간 재이관 금지.
5. 정기 배치(리뷰·테스트 생성·문서 갱신)는 한도가 넉넉한 쪽에 몰아 예약하고, 대화형 한도는 남겨 둔다.

## 4. 같은 안전장치 — 어디에 무엇이 있나

| 장치 | Claude Code | Codex CLI | 공용 스크립트 |
|---|---|---|---|
| 지시 | `CLAUDE.md` = `@AGENTS.md` + Claude 전용 | `AGENTS.md` (하위 디렉터리는 fallback `CLAUDE.md`) | — |
| 권한 기본값 | `.claude/settings.json` allow / deny | `approval_policy="on-request"` · `sandbox_mode="workspace-write"` · 네트워크 off | — |
| 파괴 명령 차단 | PreToolUse 훅 + deny | PreToolUse 훅 + `.codex/rules/vocaflow.rules` | `guard.mjs` |
| 세션 시작 주입 | SessionStart 훅 | SessionStart 훅 | `handoff-inject.mjs` |
| 커밋 전 검사 | `git commit` 에서 훅이 실행 | 같음 | `guard.mjs` → 비밀값 · `.env` · `check.mjs` · eslint |
| MCP | `.mcp.json` (생성물) | `config.toml [mcp_servers]` (생성물) | `sync.mjs` ← `mcp.source.json` |

Codex 쪽 주의: 프로젝트 `.codex/` 는 **신뢰한 프로젝트에서만** 로드되고, 새 훅은 TUI 의 `/hooks` 에서 한 번 신뢰해야 돈다.
Codex 는 `config.toml` 안의 `${VAR}` 를 치환하지 않는다 — 비밀은 `env_vars` 로 셸 환경에서 통과시킨다.

## 5. 왔다 갔다 할 때 — 한도가 아니어도 같은 순서

두 에이전트를 번갈아 쓰는 것 자체는 안전하다. 사고는 **넘기는 순간**에 난다(2026-09-26 한 세션에서 셋:
옛 가드 워크트리 · 같은 마이그레이션 번호 · 폐기된 PR 위의 PR).

**넘기는 쪽**
1. 하던 일을 커밋·push 한다(`git commit --only <paths>`). 미커밋을 남기고 넘기지 않는다.
2. `node agents/scripts/lock.mjs release <나>`
3. `node agents/scripts/handoff.mjs <나> <상대> --done … --todo … --accept … --next …` — 짧은 일이어도 쓴다.
   받는 쪽이 같은 세션 기억을 갖고 있지 않다는 것이 전제다.
4. 출력된 「받는 쪽 시작 명령」을 사용자에게 준다.

**받는 쪽** (세션 시작 훅이 알려 준다)
1. **「[안전장치 낡음]」 이 떴으면 멈춘다** → 사용자에게 알리고 `git merge origin/main`. 옛 워크트리는 이 훅 자체가
   없을 수 있다 — 그래서 **Codex 는 main 을 합친 워크트리에서만 띄운다**(지금 확인: `node agents/scripts/check.mjs`
   가 D10 까지 11항목을 돌면 최신이다).
2. 인수인계 수용 기준 재확인 → `handoff.mjs --verify` → `lock.mjs acquire <나>` → `handoff.mjs --ack <나>`.
3. 이어받은 기능은 끝까지 한다(§3-4).

**둘 다 지키는 것**
- 마이그레이션: 만들기 직전 `ls supabase/migrations` 로 번호를 고른다 · DB 적용은 사용자 승인 뒤 한쪽만 · 적용한 쪽이
  문서의 「미적용」 표기를 같은 PR 에서 고친다. 번호가 겹치면 **아직 적용 안 된 쪽**을 바꾼다(`check.mjs` D10).
- 교차 리뷰: 상대가 쓴 기능은 머지 전에 이쪽이 리뷰한다(§1). 리뷰 결함은 그 PR 에 코멘트로 남겨 추적한다.
- 다른 세션의 워크트리는 건드리지 않는다 — 고칠 게 있으면 `git worktree add --detach <임시경로> origin/<브랜치>` 에서
  git 작업만 하고 `git push origin HEAD:<브랜치>` 뒤 지운다.
- 쌓인 PR(stacked PR): base PR 이 닫혔으면 옮기기 전에 그 폐기 결정과 충돌하는지 본다(#118 ← #115 · DD-62/66).
