> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_doc_ai_context_3folders.md
> category: project

---

# docs/AI_CONTEXT/ 3 신규 폴더 분류 (2026-06-20, PR #26~27)

## 분류

| 폴더 | manifest 분류 | 정책 |
|---|---|---|
| `docs/AI_CONTEXT/handoffs/` | **Tier 2 항상 묶음** | 활성 handoff 항상 attach (예: `p6_subscribe_user_filter.md` Project 위임 대기 중). 머지/완료 시 archive 후 manifest 갱신 |
| `docs/AI_CONTEXT/diagnostics/` | **Tier 3 선별** | 활성 milestone 동안만 attach (예: `extraction_p0_20260620.md` — P6 진행 중까지 활성) |
| `docs/AI_CONTEXT/rollback/` | **Tier 외 제외** | DDL 청크 — Project spec 검토 무가치. Claude Code 단독 `Read` |

## 추가 인프라

- `scripts/check-manifest.mjs` (PR #27) — `docs/AI_CONTEXT/` 새 폴더 추가 시 manifest 미언급 warn
- `.github/workflows/sync-check.yml` `manifest-drift` job — push/PR 마다 실행 (warning-only)
- pre-commit hook (`docs/CONTEXT.md` 자동 갱신) 도 작동 중

## Why
본 세션 초반 (2026-06-20) PR #25 머지 후 발견 — `docs/AI_CONTEXT/handoffs/` 신규 폴더가 manifest 에 없어 Project 가 attach list 못 만듦. drift 누적 방지 위해 CI 검증 추가.

## How to apply

- **새 handoff 추가 시**: `docs/AI_CONTEXT/handoffs/<name>.md` 만 만들면 자동 Tier 2 (manifest 갱신 불요). Project 자동 attach 권장.
- **새 diagnostic 추가 시**: `docs/AI_CONTEXT/diagnostics/<name>.md` 만들면 drift warn → manifest §1 Tier 3 활성 list 갱신 필요.
- **새 docs/AI_CONTEXT/<폴더>/ 추가 시**: 반드시 manifest 분류 (Tier 1/2/3 또는 §2 제외) 명시. drift CI 가 강제 알림.
- **새 docs/ 직속 *.md 추가 시**: manifest §1 Tier 1 list 에 백틱 인용 추가 (drift CI 가 warn).

## 검증 1-line (로컬)
```
node scripts/check-manifest.mjs
```
→ 정합 시: `✅ manifest 정합 — drift 없음`
→ drift 시: `::warning::<폴더명>이 manifest 분류에 없음`

관련: [[project-p6-handoff-pending]] · [[project-extraction-pipeline-p1-p4]]

