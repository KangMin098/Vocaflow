# Claude Code + Codex CLI 병행 환경 — 지시문

> 사용자 지시문 원문(2026-09-17). 실행 기록·결정은 [agents/DECISIONS.md](../agents/DECISIONS.md),
> 게이트 결과는 [docs/agents/dual-agent-report.md](./agents/dual-agent-report.md).
> "Codex(아스트라)" = OpenAI Codex CLI.

## 0. 설계 결정

| 문제 | 결정 |
|---|---|
| 지시 파일이 둘(CLAUDE.md / AGENTS.md) | **AGENTS.md가 단일 출처.** CLAUDE.md는 `@AGENTS.md` 한 줄로 import하고 그 아래에 Claude 전용만 적는다 (Windows에선 심볼릭 링크 대신 @import) |
| Codex가 CLAUDE.md도 읽게 할지 | 읽지 않게 한다(중복 로드 방지). fallback 에 등록 가능 |
| MCP 설정 형식이 다름(JSON vs TOML) | `agents/mcp.source.json` 하나에서 `.mcp.json`과 `.codex/config.toml [mcp_servers]`를 스크립트로 생성 |
| 권한·샌드박스 | Claude: `settings.json` permissions. Codex: `approval_policy` + `sandbox_mode`. 둘 다 기본 보수, 예외 명시 |
| 동시 편집 충돌 | 같은 워크트리를 두 에이전트가 동시에 쓰지 않는다. `.agent-lock` + 에이전트별 git worktree |

### 파일 배치

```
repo/
├─ AGENTS.md                  ← 단일 출처(≤ 200줄)
├─ CLAUDE.md                  ← "@AGENTS.md" + Claude 전용
├─ .claude/settings.json      ← 팀 공유 권한·훅 (커밋) / settings.local.json (gitignore)
├─ .codex/config.toml         ← 프로젝트 스코프(신뢰된 저장소에서만 로드)
├─ .codex/agents/*.toml       ← reviewer, test-writer
├─ .mcp.json                  ← 생성물 (Claude용)
├─ agents/mcp.source.json     ← MCP 단일 출처
├─ agents/router.md · handoff.md · scripts/ (sync · handoff · lock)
├─ .agent-handoff/latest.md   ← 인수인계 산출물 (gitignore)
└─ .env / .env.local          ← 비밀은 여기만
```

## 1. 역할 분담

| 작업 형태 | 기본 담당 |
|---|---|
| 설계·계획·큰 리팩터·문서·대화형 탐색 | Claude Code |
| 테스트 주도 디버깅·명세가 명확한 구현·자동 리뷰·CI 배치 | Codex (`codex exec`, `codex review`) |
| 교차 검토 | 쓴 쪽의 **반대** 에이전트 (기능 단위만) |

### 한도(limit) 폴백 규칙
1. 한도 메시지 감지 → 즉시 `agents/scripts/handoff.sh <from> <to>`.
2. 인수인계 필수 항목: 브랜치·변경 파일·완료된 것·남은 것과 수용 기준·다음 한 동작·실행 금지 사항.
3. 받는 쪽 첫 명령은 항상 "`.agent-handoff/latest.md`를 읽고 수용 기준부터 재확인".
4. 한도가 풀려도 작업 중인 기능은 받은 쪽이 끝낸다. 중간 재이관 금지.
5. 주간 배치(리뷰·테스트 생성·문서 갱신)는 한도가 넉넉한 쪽에 몰아 예약.

## 2. 지시문

```text
[A] 절대 제약
A1. 비밀값은 .env 계열에만. 에이전트 설정 어디에도 값 미기재. MCP 인자는 참조만. 검사 스크립트로 강제.
A2. 지시 단일 출처는 AGENTS.md(≤ 200줄). CLAUDE.md 첫 줄은 "@AGENTS.md". 내용 중복 0.
A3. MCP 정의 단일 출처는 agents/mcp.source.json. 생성물은 직접 편집 금지(GENERATED 표기). sync --check 가 드리프트를 잡는다.
A4. 기본 권한은 보수적으로. Claude deny: rm -rf·force push·.env 읽기. Codex: approval_policy="on-request",
    sandbox_mode="workspace-write", network_access=false.
A5. 동시 쓰기 금지: lock acquire/release. 장기 병행은 git worktree.
A6. 기존 .claude/ 설정·스킬·서브에이전트는 보존.

[B] 만들 것
B1 AGENTS.md · B2 CLAUDE.md · B3 .codex/config.toml + agents/*.toml(reviewer·test-writer)
B4 mcp.source.json + sync(--check) · B5 router.md · B6 안전 훅 동등성(파괴 명령 차단 / 세션 시작 시
인수인계 주입 / 커밋 전 검사) · B7 handoff · B8 lock(고아 잠금 자동 해제) · B9 .gitignore + README 10줄

[C] 절차
Gate 0 인벤토리 · Gate 1 단일 출처(D1–D3) · Gate 2 권한·훅·잠금·인수인계(D4–D6)
Gate 3 동등성 실측(D7–D8; codex 미설치면 정적 검증으로 대체) · Gate 4 문서·정리

[D] 완료 조건
D1 CLAUDE.md 첫 줄 "@AGENTS.md", 중복 문장 0, AGENTS.md ≤ 200줄
D2 sync --check 종료코드 0
D3 에이전트 설정 파일 전체에서 비밀값 패턴 0건
D4 Claude deny 와 Codex 훅이 같은 파괴 명령을 차단 — 양쪽 실측 로그
D5 lock: 잠금 중 두 번째 acquire 거부, 고아 잠금 자동 해제
D6 handoff 산출물에 필수 6항목 존재(스키마 검사)
D7 스모크 작업: 두 에이전트 모두 동일 테스트 명령 실행, 허용 밖 파일 접근 0
D8 인수인계 왕복 후 브랜치·변경 파일이 손실 없이 이어짐
D9 README·router.md 존재, .gitignore 에 로컬 전용 4항목
```

## 3. 판단이 필요한 지점

1. 출처를 AGENTS.md로 둔 이유 — Codex는 AGENTS.md 이외 이름을 기본으로 못 읽고, Claude는 @import가 있다.
   `.claude/` 비중이 크면 Claude 출처가 편할 수 있다 → Gate 0 인벤토리로 결정(DECISIONS.md).
2. 모델 ID는 지시문에 박지 않는다 — config.toml 모델 줄은 현재 문서를 확인해 채운다.
