# DATA_CONTRACT — 공유 상태 파일 5종

모든 파일은 `state/` 에 있고 `schema: "vfc-state/1"` · `updated_at` 을 가진다. 변경은 `bin/vfc.mjs` 만 한다
(상태 뮤텍스 → 읽기 → 변경 → 바뀐 파일만 원자적 교체 → 반납).

## GOAL_STATUS.json

```jsonc
{
  "canon_version": "1.1.0",
  "goals": {                       // 정본 criteria 중 템플릿(L4) 을 뺀 35개
    "VG-L3-D2-01": {
      "level": 3, "phase": "R0", "blocking_for_R0": true,
      "status": "FAIL",            // PASS | FAIL | UNKNOWN | BLOCKED | EXTERNAL_INPUT_REQUIRED
      "acceptance": [...],         // 정본 acceptance 사본(읽기용)
      "evidence_paths": ["verification/e2e/EV-20261009-actions-skip.md"],
      "evidence_hooks": [],        // 검사기가 붙을 근거 위치(보고서 등) — 상태 판정 근거 아님
      "reported_only": false,      // PASS/FAIL 이 verification/ 증거로 정해졌으면 false
      "history": [{ "at", "from", "to", "by", "note", "evidence_paths" }]
    }
  },
  "release_gates": { "R0-DEPLOY": { "status": "FAIL", ... } }   // 정본 release_gates 7개
}
```

규칙: PASS·FAIL 은 `verification/` 아래 실제 증거 파일 + 사유 필수(보고서 경로 거부) · 정본 `observed_status`(unknown 등)와는 별개의 **이 공간의 판정**이다.

## TASK_QUEUE.json (정본) · ACTIVE_TASKS.json (파생)

| 필드 | 뜻 |
|---|---|
| `task_id` | `T-0001` … (자동) |
| `goal_id` | **정본 L3 id 하나**(PROJECT_GOAL §2: L4 작업은 정확히 하나의 주 L3). 없는 id · L0~L2 · 템플릿은 거부 |
| `related_goal_ids` | 관련 목표(정본 id 만) |
| `template` | 정본 L4 템플릿 id(CONTRACT/BUILD/TEST/TRACE/DELIVER) |
| `title` · `description` | 작업 설명 |
| `priority` | P0~P3 |
| `status` | READY · IN_PROGRESS · BLOCKED · REVIEW · COMPLETED · FAILED |
| `owner_id` | 고정 담당(OWNERSHIP_REGISTRY 에 있어야 함) |
| `branch` · `worktree` | 작업 위치 — worktree 는 owner 에 묶인 것만 |
| `allowed_paths` · `forbidden_paths` | 변경 허용·금지 범위(**이 작업 단위에만** 적용) |
| `db_scope` | `{ mode: none|read|write, targets: ["dev:<ref>"] }` |
| `approval_required` · `approval_kinds` · `approval` | db_write·main_merge·deploy·secret·destructive·external_publish. `approval` 은 `by:"user"` + 근거 + (DB 쓰기면) SQL sha256 |
| `acceptance` | 완료 조건 |
| `evidence[]` | `type`(unit·integration·e2e·ci·deploy·smoke·manual·db_query·review·log·analysis) · `command_or_protocol` · `result`(pass·fail·skip·not_run·unknown) · `skip_count` · `artifact_path_or_url`(실제 파일 또는 URL) · `observed_at` · `covers`(acceptance 번호) · `run_seq` |
| `run_seq` | 시작할 때마다 1 증가. 완료 판정은 현재 run 의 증거만 본다 |
| `run` | 실행 중 세션·에이전트 pid·host·잡은 잠금(token)·제품 .agent-lock token |
| `reviewed_by` · `review_record` | 완료 판정한 리뷰어 owner · 리뷰 기록 파일 |
| `updated_at` · `history[]` | 마지막 갱신 · 전이 기록 |

전이 규칙: [CONCURRENCY.md](./CONCURRENCY.md) §상태 기계. COMPLETED 는 등록된 다른 owner(리뷰어) · 리뷰 기록 파일 · 현재 run 증거가 모든 acceptance 를 `pass ∧ skip_count=0` 으로 덮을 것.

## DECISION_LOG.json (append-only)

`imported_responses`: ChatGPT 응답 request_id → sha256 · 생성된 결정 id(중복 가져오기 방지).

`decision_id` · `status`(APPROVED · RECORDED · PROPOSED · OPEN_QUESTION · REJECTED · SUPERSEDED) · `kind` · `summary` · `source` · `by` · `recorded_at`.
APPROVED 는 `approved_by:"user"` 일 때만. 항목을 지우지 않고, 바뀌면 새 항목이 옛 항목을 SUPERSEDED 로 가리킨다.

## OWNERSHIP_REGISTRY.json

```jsonc
"owners": {
  "csat-learning": {
    "purpose": "...", "agent_kinds": ["claude"],
    "worktrees": [{ "path": "d:/workspace/Vocaflow-g2-int", "branch": "feat/csat-g2-integration" }],
    "db_scopes": [],                       // DB 쓰기 잠금을 잡을 수 있는 대상
    "current_session": { "label": "vocaflow-f5", "agent": "claude", "pid": 1234, "bound_at": "..." },
    "session_history": [...],              // 이전 세션 — 세션이 바뀌어도 소유는 owner_id 에 남는다
    "session_aliases": [{ "label": "vocaflow-f5", "evidence": "..." }]
  }
}
```

고정 owner_id(2026-10-09): `platform-goal` · `r0-learning-journey` · `csat-learning` · `content-pipeline` · `methodology` · `data-contract`(개발 DB 쓰기 유일) · `release-quality` · `independent-review`.
