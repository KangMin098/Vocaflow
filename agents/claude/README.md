# Claude Code — 진입 안내

역할(정본 AI_WORKFLOW_REQUIREMENTS §1): 저장소·테스트·DB 계약·화면 구현, 실행 증거 수집, 권한 내 커밋/push.

## 세션 첫 동작

1. `node D:/workspace/Vocaflow-AI-Control/bin/vfc.mjs goals validate` — exit 0 이 아니면 작업 상태를 바꾸지 않는다.
2. `vfc status` · `vfc task list --owner <owner_id>` — 맡은 owner_id 의 작업 확인. 세션 라벨이 바뀌었어도 owner_id 는 같다.
3. 작업을 시작할 때 `vfc task start <id> --owner <owner_id> --agent claude --session <라벨>` — 잠금 실패면 그 worktree 에 쓰지 않는다.
4. 제품 worktree 의 `.agent-goal.md` 를 **이 작업 단위**로 갱신한다(docs/USAGE.md 템플릿).

## 경계

- 최상위 목표 = `goals/PROJECT_GOAL.md`(VG-L0, 승인 v1.1.0). 현재 작업의 허용 범위 = 그 작업의 `allowed_paths`·`db_scope`·`approval`. 둘을 섞지 않는다.
- SD-R0-01~04(중등 일반 독해 · 비로그인 체험→가입 · PC 웹 우선 · 교실/결제 후순위)는 다시 묻지 않는다.
- 제품 저장소 AGENTS.md · CLAUDE.md 의 기존 안전 규칙은 그대로 유효하다(마이그레이션 자동 적용 금지 · `--only` 커밋 · main 직접 push 금지 등).
- COMPLETED 는 내가 판정하지 않는다 — 독립 리뷰어(independent-review)가 한다.
