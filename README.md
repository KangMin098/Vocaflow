# Vocaflow AI Control

Claude Code · Codex · ChatGPT 가 **같은 Vocaflow 플랫폼 목표**를 기준으로 협업하기 위한 공유 제어 공간이다.
제품 소스(`D:\workspace\Vocaflow*` worktree)와 분리돼 있고, 제품 코드는 여기에 두지 않는다.

- 위치: `D:\workspace\Vocaflow-AI-Control` — Vocaflow 저장소의 **orphan 브랜치 `ai-control`** worktree(제품 이력과 공통 조상 없음)
- 정본: [goals/](./goals/) — STEP 2 승인 정본 v1.1.0 (2026-10-09), `CANON_MANIFEST.json` 으로 sha256 봉인
- 사용법: [docs/USAGE.md](./docs/USAGE.md) · 데이터 계약: [docs/DATA_CONTRACT.md](./docs/DATA_CONTRACT.md) · 잠금: [docs/CONCURRENCY.md](./docs/CONCURRENCY.md) · 자동 실행: [docs/ORCHESTRATOR.md](./docs/ORCHESTRATOR.md) · ChatGPT: [docs/CHATGPT_CONNECTION.md](./docs/CHATGPT_CONNECTION.md)
- 에이전트별 안내: [agents/claude](./agents/claude/README.md) · [agents/codex](./agents/codex/README.md) · [agents/chatgpt](./agents/chatgpt/README.md)

## 구조

| 경로 | 내용 | Git |
|---|---|---|
| `goals/` | 승인 정본 5종 + STEP3 입력 + 봉인 manifest — **읽기 전용** | 버전 관리 |
| `seed/seed.json` | init 이 한 번 넣는 owner·결정·작업·근거 있는 초기 상태 | 버전 관리 |
| `bin/vfc.mjs` · `lib/` | CLI 와 규칙(잠금·상태·작업·정본 검증·ChatGPT 교환) | 버전 관리 |
| `tests/` | control 40 + orchestrator 16(가짜 Claude/Codex · 동시 프로세스 · epoch 잠금 경쟁 · 고장 주입 · SIGKILL 복구) | 버전 관리 |
| `config/priority.json` | 다음 작업 선정 범주표(1~8) | 버전 관리 |
| `docs/` · `agents/*/` | 운영 문서 · 에이전트별 진입 안내 | 버전 관리 |
| `verification/{tests,reviews,e2e}/` | 직접 확인한 증거 파일(로그 원문·run id) | 버전 관리 |
| `planning/requests/` · `planning/archive/` | ChatGPT 요청과 가져온 응답 기록 | 버전 관리 |
| `planning/responses/` | 사용자가 붙여 넣는 응답 수신함(가져오면 archive 로 이동) | 제외 |
| `state/*.json` | GOAL_STATUS · TASK_QUEUE · ACTIVE_TASKS · DECISION_LOG · OWNERSHIP_REGISTRY | 제외(실행 상태) |
| `runtime/{locks,checkpoints,logs}/` | 잠금 · 스냅샷 · 이벤트 로그 | 제외 |

## 시작

```
node bin/vfc.mjs goals validate     # 정본 10개 항목 검증 (exit 0 이어야 작업 상태를 바꿀 수 있다)
node bin/vfc.mjs init               # 멱등 — 처음 한 번
node bin/vfc.mjs status
node --test --test-concurrency=1 tests/control.test.mjs
```

## 원칙

1. 정본은 고치지 않는다. 바꿀 필요가 보이면 `DECISION_LOG` 에 제안 → 사용자 승인 → 새 판 봉인(`goals seal --decision`).
2. 상태는 CLI 로만 바꾼다 — 손으로 고치면 잠금·검증을 우회한다.
3. 근거 없는 목표는 `UNKNOWN` 이다. 보고서 인용만으로 `PASS` 를 줄 수 없다. `skip` 은 통과가 아니다.
4. 작업은 세션 이름이 아니라 **고정 owner_id** 에 속한다.
5. ChatGPT 응답은 `PROPOSED`/`OPEN_QUESTION` 으로만 들어간다. `APPROVED` 는 사용자 승인 근거가 있어야 한다.
6. 비밀값(토큰·DB URL·키)을 이 공간 어디에도 쓰지 않는다.
