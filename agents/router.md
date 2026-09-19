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
