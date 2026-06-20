> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_doc_structure_split.md
> category: project

---

# Doc structure split — CLAUDE.md → docs/* (2026-06-08)

## What changed

Before — `CLAUDE.md` was a 3,946-line SSoT containing design system + learning model + modules + DB schema + admin console + version history + everything.

After:
- **`CLAUDE.md`** (~210 lines) — slim index. Always attached. Contains: 7원칙 + 4철학 + Memory Decay + 절대 금지/항상 지킬 것 + automation policy + doc navigation table.
- **`README.md`** (84 lines) — 1-page intro for repo visitors.
- **`docs/`** — 12 focused files for selective Claude project attachment:
  - `PROJECT.md` — 미션·타겟·9 모듈 요약·모노레포 구조
  - `STACK.md` — 기술 스택 + 버전 (package.json verified)
  - `DESIGN_SYSTEM.md` — 토큰·폰트·컴포넌트·모션
  - `LEARNING_MODEL.md` — 9계층 v3.2 + 7축 모델 + FSRS
  - `MODULES.md` — 9 모듈 + EchoMatch (목적·라우트·컴포넌트)
  - `ROUTES.md` — 전체 라우트 맵 (77 page · 23 API · 11 layout)
  - `DB_SCHEMA.md` — 57 테이블 · 5 view · 222 함수 (DB verified)
  - `LIBRARY_PIPELINE.md` — LCP + VCB + VRL + ACP
  - `ADMIN_CONSOLE.md` — `/admin/*`
  - `CONVENTIONS.md` — 코딩 패턴 + 안티패턴 + PR 체크리스트
  - `CHANGELOG.md` — v06.32~34 + 이번 세션
  - (기존 `ARCHITECTURE.md` · `DESIGN_DECISIONS.md` 보존)

## Why
- 3,946 lines 한 파일은 Claude project attachment 토큰 비효율 (관련 없는 영역까지 context 점유)
- 변경 이력 v06.0~v06.31 누적으로 drift 위험 (사실 검증 어려움)
- 영역별 분리로 작업별 선택 첨부 가능 → 정확도 100% + 토큰 효율

## How to use

### Claude project attachment 조합
| 작업 | attachments |
|---|---|
| 일반 | CLAUDE.md (always-on) |
| UI | + DESIGN_SYSTEM.md + MODULES.md |
| DB / 마이그레이션 | + DB_SCHEMA.md + LIBRARY_PIPELINE.md |
| 큐레이션 | + LIBRARY_PIPELINE.md + ADMIN_CONSOLE.md + DB_SCHEMA.md |
| 새 모듈 | + LEARNING_MODEL.md + MODULES.md |
| 라우트 | + ROUTES.md + MODULES.md |
| 코드 리뷰 | + CONVENTIONS.md + CHANGELOG.md |

### 자동 갱신 매트릭스 (사용자 standing authorization)
See `[[feedback_auto_doc_and_git]]`. 코드 변경 시 같은 turn 안에 관련 doc 갱신 (요청 없어도 자동).

## Verification
모든 .md 파일은 검증된 사실만 기록:
- DB: `mcp__supabase__execute_sql` (project_id=jajenrevcbmrpaliomxv)
- 라우트: `Glob page.tsx/route.ts/layout.tsx`
- 패키지: `package.json` direct read
- 디스크 사이즈: `pg_size_pretty(pg_total_relation_size)`

## Variance preservation
- `apps/web/CLAUDE.md` (45 lines) · `apps/mobile/CLAUDE.md` (15 lines) · `packages/design-tokens/CLAUDE.md` (21 lines) — 짧은 보충 그대로
- `docs/proposals/*` 점진 제안서 (시점 기록) 그대로
- `docs/adr/*` ADR (append-only) 그대로
- 변경 이력 v06.0~v06.31 은 `git log` 참조 (CLAUDE.md 본문에서 제거)

