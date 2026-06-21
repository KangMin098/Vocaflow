> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/feedback_handoff_workflow.md
> category: feedback

---

# Handoff 워크플로우 (Project ↔ Claude Code)

## 패턴

```
Project (claude.ai)
  ├─ handoff 본문 작성 (전역 규약 + 단계 정의 + 결정표 + 착수 순서)
  ├─ docs/AI_CONTEXT/handoffs/<name>.md 에 저장
  └─ PR 머지 후 사용자가 Code 세션에서 paste

Claude Code (VS Code)
  ├─ P0 진단 (read-only) — 함수 dump + 데이터 측정 → 결정표 채움
  ├─ 사용자 결정 (D1~Dn) 요청
  ├─ 단계별 실행:
  │   ├─ rollback baseline 저장 (docs/AI_CONTEXT/rollback/)
  │   ├─ SQL 전문 사용자 제시
  │   ├─ 승인 받기 ("적용" / "yes")
  │   ├─ apply_migration
  │   ├─ 검증 쿼리
  │   └─ commit + push
  └─ 단계마다 진행 또는 ABORT
```

## Why
PR #24 (학습 단어 추출 파이프라인 P0~P4 + 재발행) 에서 검증된 실효성:
- Project 작성 handoff = 깊은 spec + 전체 구조 (Project 의 reasoning 강점)
- Claude Code 단계별 실행 = DB query + migration apply + git/PR (Code 의 tooling 강점)
- 사용자가 두 채팅 사이 "다음" / "적용" 1단어로 빠른 결정
- 결정표 default 가 측정 근거 가지면 사용자 마찰 0

## How to apply

- **대규모 작업 (DB 함수 재설계, 데이터 백필, 파이프라인 변경)**: handoff 패턴 권장
- **작은 작업 (1-2 file 수정, 버그 픽스)**: handoff 불필요 — 직접 진행
- **사용자가 "다음" / "적용" 만 응답**: 권장안 자동 채택 의미. 단 destructive 작업은 명시 옵션 제시 후
- **handoff §전역 규약**: 모든 handoff 가 동일 규약 (Opus + xhigh / migration 승인 / shared_dictionary 보호 / vendor 중립 / git 안전 / 정찰 규율 / 멱등 롤백) 명시 → Claude Code 가 위반 차단
- **P0 read-only 진단**: 본 작업 가능성/위험 확인 + 결정표 default 측정 근거. 위험 0.
- **결정표 default 권장값**: Project 가 측정 가능한 근거 (예: P0 측정값) 와 함께 제시. 사용자 1단어 채택 가능.

## 안티패턴

- Handoff 없이 큰 작업을 Code 가 즉흥 진행 — 위험 (사용자 의도 어긋남)
- 결정표 없이 Project 권장값을 Code 가 자체 채택 — 사용자 결정권 침해
- migration apply 후 commit 잊음 — git=DB SSoT 정합 깨짐 (PR #23 패턴)
- **모든 위임 지시문 진행 전 `git branch --show-current` 선확인 누락** — 2026-06-21 PR #31 에서 발생. main 으로 직접 commit (다행히 push 실패로 origin 비파괴). 사용자가 향후 위임 지시문 "전역 규약" 에 선확인 명시 약속. Code 측 강제 적용 — Edit/Write 또는 `git add` 시작 전 무조건 `git branch --show-current` 확인 후 main 일 때 새 브랜치 분기. (현 세션에선 본 메모 직후부터 적용)

## 검증 사례
- PR #24 (P0~P4 + 재발행): handoff §전역 그대로 적용, 7 commits / 7 migrations / 사용자 마찰 0, bit-identical 검증 100%

관련: [[project-extraction-pipeline-p1-p4]] · [[project-p6-handoff-pending]] · [[feedback-supabase-migrations]] · [[feedback-auto-doc-and-git]]

