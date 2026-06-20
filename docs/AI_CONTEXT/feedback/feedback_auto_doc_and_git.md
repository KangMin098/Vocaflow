> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/feedback_auto_doc_and_git.md
> category: feedback

---

# 자동 .md 갱신 + 자동 git commit/push (standing authorization)

**Date granted**: 2026-06-08

## The rules

1. **자동 .md 갱신** — 코드 변경 발생 시 같은 turn 안에 관련 `docs/*.md` 도 함께 갱신. 사용자 요청 없어도 내가 판단.
2. **자동 git commit + push** — 논리적 milestone 또는 파일 ≥5 변경 누적 시 자동 commit 후 push. 사용자 요청 없어도 내가 판단.

## Why
- 사용자가 명시적으로 부여한 standing authorization (이번 conversation 에서 "자동으로 ... 갱신" + "자동으로 git commit, 머지, 푸시" 요청).
- 프로젝트 기본 instruction "NEVER commit/push without explicit authorization" 의 default behavior 를 **이 프로젝트(Vocaflow)에서만** 사용자가 overridden 함.
- drift 방지 (코드 ↔ 문서 정합) + 작업 흐름 끊김 최소화.

## How to apply

### 자동 .md 갱신 매트릭스
| 트리거 | 갱신 대상 |
|---|---|
| 마이그레이션 적용 | `docs/DB_SCHEMA.md` + `docs/CHANGELOG.md` |
| 새 RPC / view / trigger | `docs/DB_SCHEMA.md` |
| 새 라우트 (`page.tsx` / `route.ts`) | `docs/ROUTES.md` |
| 새 컴포넌트 (도메인 신설) | `docs/MODULES.md` |
| 학습 모듈 / 인지 계층 변경 | `docs/LEARNING_MODEL.md` + `docs/MODULES.md` |
| 디자인 토큰 / 컴포넌트 패턴 | `docs/DESIGN_SYSTEM.md` |
| Admin 라우트 / 일괄 액션 | `docs/ADMIN_CONSOLE.md` |
| 큐레이션 RPC / 파이프라인 | `docs/LIBRARY_PIPELINE.md` |
| 코딩 패턴 / 안티패턴 | `docs/CONVENTIONS.md` |
| 패키지 추가/버전 | `docs/STACK.md` |
| 위 모든 변경 (요약) | `docs/CHANGELOG.md` Unreleased |

### 자동 git commit / push
- **트리거**: logical milestone 또는 ≥5 파일 변경 또는 사용자가 다음 주제로 명확히 전환
- **Commit**: Conventional commits (`feat:` `fix:` `chore:` `docs:` `refactor:`) · 제목 ≤72자 (한국어 OK) · 본문 변경 list · `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>` 첨부
- **Push**: 현재 작업 브랜치만 (main 직접 push 절대 금지 — PR 권장)
- **Force push 절대 금지** (사용자 명시 요청 시만)
- **`--no-verify` 절대 금지**
- **Merge**: PR 자동 merge 는 CI 통과 + main 보호 정책 명확화 전까지 보류

### 안전 안티패턴 — 자동화 예외 (사용자 확인 필수)
- `.env*` 파일 commit
- 새 API key / secret 포함
- 빌드/테스트 실패 상태 push
- DROP TABLE / TRUNCATE 같은 destructive DB 변경
- 파일 ≥30 변경 (정상 milestone 아님)

## Scope
- **이 프로젝트 (Vocaflow) 한정**. 다른 프로젝트는 기본 instruction 따름.
- 사용자가 다시 변경 요청 시 본 메모리 갱신.

## Related
- `[[project_supabase]]` — Supabase context
- `[[feedback_supabase_migrations]]` — 마이그레이션 자동 적용은 여전히 사용자 확인 필요 (이번 권한과 분리)

