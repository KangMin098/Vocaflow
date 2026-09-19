# 두 에이전트 환경 — 게이트 리포트

> 지시문 [docs/dual-agent-brief.md](../dual-agent-brief.md) · 결정 [agents/DECISIONS.md](../../agents/DECISIONS.md) · 2026-09-17 · Claude Code.
> 다시 재기: `node agents/scripts/check.mjs` · `node --test agents/scripts/__tests__/*.test.mjs`.

## 요약

| 완료 조건 | 판정 | 근거 |
|---|---|---|
| D1 CLAUDE.md 첫 줄 `@AGENTS.md` · 중복 0 · AGENTS.md ≤ 200줄 | **PASS** | `check.mjs` — 170줄 · 17.9 KB · 중복 0 (변이 3종 검출) |
| D2 `sync --check` exit 0 | **PASS** | `.mcp.json` 바이트 동일 재생성 · `config.toml` 구역 일치 |
| D3 설정 파일 비밀값 0 | **PASS** | 설정 파일 49개 · 0건 (가짜 `sbp_` 키로 변이 검출) |
| D4 두 쪽이 같은 파괴 명령 차단 | **Claude PASS (실측) · Codex 정적 PASS** | [d4-claude-probe.jsonl](./logs/d4-claude-probe.jsonl) 3/3 차단 · Codex 페이로드 형식 CLI 테스트 12건 + [정적 검증](./logs/d4-d7-codex-static.log) 16/16 |
| D5 잠금 거부 · 고아 해제 | **PASS** | `lock.test.mjs` 6/6 · 실측 pid = `claude.exe` |
| D6 인수인계 필수 6항목 | **PASS** | `handoff.test.mjs` — 비면 exit 1 · validate FAIL |
| D7 스모크: 같은 테스트 명령 · 허용 밖 접근 0 | **Claude PASS (2차) · Codex 정적** | [d7-claude-smoke.jsonl](./logs/d7-claude-smoke.jsonl) — 1차 FAIL(허용 규칙 불일치) → 수정 → 도구 호출 1회 · 거부 0 |
| D8 왕복 후 손실 0 | **PASS (임시 저장소 시뮬레이션)** | Claude → Codex → Claude 두 번의 인계 모두 `--verify` PASS · 변이 2종(파일 소실 · 브랜치 변경) 검출 |
| D9 README · router.md · .gitignore 4항목 | **PASS** | `check.mjs` |

**Codex CLI 가 이 머신에 없다.** D4·D7·D8 의 Codex 쪽은 "Codex 가 넘길 입력을 같은 스크립트에 넣어 본 것" 과
"설정 파일을 실제 TOML 파서로 읽은 것" 까지다. 실제 `codex exec` 실측 4건은 DECISIONS.md 「남은 것」.

## Gate 0 · 인벤토리 — PASS

표는 [DECISIONS.md](../../agents/DECISIONS.md#gate-0-인벤토리-실측). 이동 2(CLAUDE.md 본문 · DB 통계 블록) · 생성물 전환 1(`.mcp.json`) · 삭제 0.

## Gate 1 · 단일 출처 — PASS (D1–D3)

| 파일 | 변경 |
|---|---|
| `AGENTS.md` | 신규 170줄 — 공용 규칙 정본 |
| `CLAUDE.md` | 495줄 → `@AGENTS.md` + Claude 전용 (전체 33줄) |
| `docs/agents/CONTEXT_DETAIL.md` | 신규 — 옮긴 원문(첫인상 · 드레인 · to_regclass · 최근 변경 · 자동화 정책 · 보조 문서) |
| `agents/mcp.source.json` · `agents/scripts/sync.mjs` | 신규 — MCP 단일 출처와 생성기 |
| `.codex/config.toml` | 신규 — 권한·훅 + 생성 구역 |
| `scripts/docs/gen-db-stats.mjs` | 대상 `CLAUDE.md` → `AGENTS.md` |
| `apps/web/src/lib/__tests__/doc-path-drift.test.ts` | 검사 대상에 AGENTS.md · router.md · CONTEXT_DETAIL 추가 (2/2 통과) |

원문 누락 검사: 다시 쓴 구간의 코드 스팬·굵은 글씨·색 코드를 새 파일에서 찾아, 빠진 실질 항목(AI SDK · DTW · r3f 패키지명)을 보충했다.

## Gate 2 · 권한·훅·잠금·인수인계 — PASS (D4–D6)

| 파일 | 역할 |
|---|---|
| `.claude/settings.json` | allow(빌드·테스트·git 읽기·commit·에이전트 스크립트) · deny(rm -rf · force push · reset --hard · clean -f · `.env` 읽기) · 훅 2 |
| `.codex/rules/vocaflow.rules` | execpolicy 2차 방어선 11줄 |
| `.codex/agents/reviewer.toml` · `test-writer.toml` | 읽기 전용 리뷰어 · 테스트 작성자 |
| `agents/scripts/guard.mjs` | 공용 PreToolUse — 판정표 + 커밋 전 검사(비밀값 · `.env` · `check.mjs` · eslint) |
| `agents/scripts/lock.mjs` · `handoff.mjs` · `handoff-inject.mjs` | 잠금 · 인수인계 · 세션 시작 주입 |
| `agents/scripts/*.sh` | 지시문 이름을 지키는 래퍼 4개 |
| `agents/scripts/__tests__/*.test.mjs` | 90건 |

커밋 전 검사 실측 (훅은 검사만 하고 명령을 실행하지 않으므로 실제 커밋 없이 확인):

| 경우 | 결과 | 소요 |
|---|---|---|
| AGENTS.md + web 테스트 파일 | 통과 | 8.0초 (eslint 포함) |
| 가짜 `sbp_` 토큰 파일 | 차단 — 줄 스캔 + D3 두 층 | — |
| `any` 를 쓴 web 파일 | 차단 — `@typescript-eslint/no-explicit-any` | — |

## Gate 3 · 동등성 실측 — Claude PASS · Codex 정적 대체

- **D4 Claude**: 헤드리스 `claude -p` 가 `rm -rf ./__guard_probe_nonexistent__` · `git push --force origin __no_such_branch__` · `cat apps/web/.env.local` 을 시도 → 셋 다 훅에서 차단, 우회 시도 없음.
- **D7 Claude**: 1차 — 허용 규칙 `Bash(node --test agents/scripts/__tests__/:*)` 가 `…/*.test.mjs` 와 매치되지 않아 네 번 승인 요청 후 `error_max_turns`. 규칙을 `…/__tests__/*` 로 고친 2차 — `node --test agents/scripts/__tests__/*.test.mjs 2>&1` 한 번 · 90/90 · 권한 거부 0 · 다른 도구 호출 0.
- **Codex 정적**: `config.toml` 파싱 · approval/sandbox/network · fallback · 훅 matcher(Bash·shell 적중, apply_patch 제외) · 훅 `command`/`commandWindows` 를 셸로 실제 실행해 exit 2 · 에이전트 TOML 필수 키 · rules 형식 — 16/16.
- **D8**: 임시 git 저장소에서 잠금·인계·주입·확인·읽음 표시를 두 번 왕복.

## Gate 4 · 문서·정리 — PASS

`agents/router.md` · `agents/handoff.md` · `agents/DECISIONS.md` · README 「두 에이전트로 일하는 법」 10줄 · `.gitignore`(+`.agent-handoff/` · `.agent-lock` · `.agent-logs/` · `.codex/` 로컬 3) · CI 에 `check.mjs` + 스크립트 회귀 · `docs/WORKTREE.md` 한 줄 · CHANGELOG.

삭제한 파일: 0. 빈 stderr 로그 2개는 지웠다.
