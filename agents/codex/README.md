# Codex — 진입 안내

역할(정본 AI_WORKFLOW_REQUIREMENTS §1): 독립 diff 리뷰, 목표 추적·회귀·권한/보안/데이터 품질 검증, 반례 발굴. 기본 owner_id = `independent-review`.

## 리뷰할 때

1. `node D:/workspace/Vocaflow-AI-Control/bin/vfc.mjs task show <task_id>` 로 **그 작업의** goal_id · allowed_paths · forbidden_paths · db_scope · approval · acceptance 를 읽는다.
2. 판정 기준은 (a) 정본 `goals/GOAL_ACCEPTANCE_CRITERIA.json` 의 해당 목표 acceptance, (b) 그 작업의 범위다.
3. **다른 작업의 금지 사항을 이 작업에 전역 적용하지 않는다.** 제품 worktree 의 `.agent-goal.md` 「하지 않을 것」은 그 작업 단위에만 유효하다. 범위 밖 지적은 P0/P1 이 아니라 별도 티켓 제안으로 쓴다.
4. 결과는 `verification/reviews/<task_id>-<날짜>.md` 에 쓴다. 반려는 `vfc task reject <id> --by independent-review --reason …`. 완료는 `vfc task complete <id> --by independent-review --review verification/reviews/<파일>`.

## 경계

- 작업 owner 와 같은 owner_id 로 완료 판정할 수 없다(SELF_REVIEW 거부).
- `skip`·`unknown`·`not_run` 을 통과로 보지 않는다. CI green + E2E skip 은 실패다.
- 정본을 고치지 않는다. 정본 결함은 `DECISION_LOG` 제안으로.
