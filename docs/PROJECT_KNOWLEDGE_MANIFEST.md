# Vocaflow — PROJECT_KNOWLEDGE_MANIFEST

> **이 파일은 Tier 1 (Always-on) — Claude Project 채팅에서 항상 attach 되어야 함.**
>
> 목적: claude.ai Projects 의 GitHub 커넥터에 무엇을 **추가/제외 해야 한몸으로 작동하는지** 의 SSoT.
> 전체 sync 는 비용·정확도 모두 비효율 → 3-tier 선별 + 도메인별 swap.

---

## 0. 한 줄 요약

```
GitHub repo 1,230 파일 중 ~82 파일 (≈ 8% 용량) 만 Project 가 본다.
나머지는 Claude Code (VS Code) 가 본다 — Tier 3 영역은 Claude Code 단독.
사용자가 두 채팅 사이 다리 (결과 paste) 역할.
```

---

## 1. 3-tier 분류

### Tier 1 — **Always-on** (~26 파일 · ≈ 2% 용량)

모든 채팅 attach. 빼면 Project 가 "프로젝트가 뭐고 어떻게 작업하나" 못 답.

| 묶음 | 파일 |
|---|---|
| 루트 SSoT | `CLAUDE.md` · `README.md` |
| 워크스페이스 메타 | `package.json` · `turbo.json` · `pnpm-workspace.yaml` · `tsconfig.base.json` |
| **docs/ 직속 전체 (20 파일)** | `00_project_brief.md` · `ACP_SOURCE_REDESIGN.md` · `ADMIN_CONSOLE.md` · `API.md` · `ARCHITECTURE.md` · `CHANGELOG.md` · **`CONTEXT.md`** · `CONVENTIONS.md` · `DB_SCHEMA.md` · `DEPLOY.md` · `DESIGN_DECISIONS.md` · `DESIGN_SYSTEM.md` · `LEARNING_MODEL.md` · `LIBRARY_PIPELINE.md` · `MOBILE_SHELL_SPEC.md` · `MODULES.md` · `ONBOARDING.md` · `PROJECT.md` · `ROUTES.md` · `STACK.md` |
| **본 문서** | `docs/PROJECT_KNOWLEDGE_MANIFEST.md` (이 파일 — Project 가 본 manifest 를 항상 봐야 self-direction 가능) |

### Tier 2 — **Domain on-demand** (~31 파일 · ≈ 3% 용량)

도메인 채팅 시작 시 해당 묶음 추가. 다른 도메인 시작 시 swap.

#### 항상 묶음 (도메인 무관 — Tier 1 보강)

- `docs/adr/` 전체 3 파일 (의사결정 추적, append-only)
- `docs/AI_CONTEXT/feedback/` 전체 8 파일 (사용자 룰 — 반복 지시 차단)
- `docs/AI_CONTEXT/README.md` (mirror 가이드)
- **`docs/AI_CONTEXT/handoffs/` 전체** (활성 handoff — Project 검토 대기 중 spec 본문)
  - 예: `p6_subscribe_user_filter.md` (C6 user V-level 필터 — Project 위임 중)
  - 머지 후 완료된 handoff 는 별도 archive (대상 manifest 갱신)

#### 도메인별 묶음 6종

각 도메인 시작 시 위 항상 묶음 + 해당 묶음만 attach.

##### A. DB / migration 작업

- `docs/DB_SCHEMA.md` (Tier 1 에 있음)
- `supabase/migrations/2026061*.sql` (최근 20-30 — 옛 `2025*` init 제외)

##### B. LCP / ACP 파이프라인

- `docs/LIBRARY_PIPELINE.md` · `docs/ADMIN_CONSOLE.md` (둘 다 Tier 1)
- `packages/library-pipeline/src/types-article.ts` · `types.ts`
- `packages/library-pipeline/src/ingest-article/_curation-spec.ts` · `_helpers.ts`
- `apps/web/src/lib/acp/seed-upsert.ts`

##### C. VRL / 단어 분류

- `docs/LEARNING_MODEL.md` (Tier 1)
- `docs/AI_CONTEXT/project/project_vrl_v3_round{1,5,10}_*.md` (핵심 round 3-5 파일)
- `docs/AI_CONTEXT/project/project_vrl_v_level_pure_semantic.md`
- `docs/AI_CONTEXT/project/project_vrl_phase3a_text_new_extraction.md`

##### D. 워크스페이스 / 학습 모듈

- `docs/MODULES.md` · `docs/LEARNING_MODEL.md` (Tier 1)
- `apps/web/src/types/library.ts`
- `apps/web/src/components/workspace/ReadingUniverse.tsx` (활성 작업 시만)

##### E. 라우트 / API

- `docs/ROUTES.md` (Tier 1)
- `apps/web/src/middleware.ts`
- 특정 API route 본문 (채팅 주제별 1-2개)

##### F. 디자인 시스템

- `docs/DESIGN_SYSTEM.md` (Tier 1)
- `packages/design-tokens/src/tokens.css`
- `apps/web/src/app/globals.css`

### Tier 3 — **선별 attach** (~25 파일 · ≈ 3% 용량)

작업 history 큐레이션 — 채팅 주제와 직접 관련된 것만.

#### `docs/AI_CONTEXT/project/` 선별 가이드

- ✅ **활성**: 최근 30일 + 현재 진행 중 milestone (예: ACP active, sync 인프라 active)
- ⚠ **유지**: 안정 단계지만 자주 인용 (예: cast-2000, freq-corpus)
- ❌ **제외**: 완료된 ledger (예: VRL Phase 2a~k, dict-fill Phase 1-4) — grep 으로 충분

활성 후보 (수시 갱신):
- `project_acp_source_redesign.md`
- `project_doc_structure_split.md`
- `project_librivox_chapter_voice.md`
- `project_lexical_coverage_metric.md`
- `project_book_cover_images.md`
- `project_seed_catalog_curation_meta.md`

#### `docs/AI_CONTEXT/diagnostics/` 선별 가이드 (신규)

추출/큐레이션 등 read-only 진단 결과 (P0 단계). 활성 milestone 만 attach.

- ✅ 활성 milestone 동안만 (예: 추출 파이프라인 P1~P4 작업 중 → `extraction_p0_*` attach)
- ❌ milestone 종료 후엔 grep/archive — manifest 활성 list 갱신

활성 (현재):
- `extraction_p0_20260620.md` (handoff "추출 파이프라인" 결정표 — PR #24 적용 후 P6 진행 중까지 활성)

#### `docs/AI_CONTEXT/rollback/` 정책 (Tier 외 제외)

migration 적용 직전 함수 본문 baseline. **Project 가 attach 할 가치 0 — Claude Code 단독 영역**.
- 본문은 SQL DDL 청크 — Project 의 spec 검토에 무가치
- Claude Code 가 직접 file path 로 참조 (필요 시 `Read` 도구)
- Project 채팅 attach 금지 (manifest §2 "제외" 묶음에 명시)
- (이번 채팅 작업 결과로 신규 mirror 되는 것들)

#### `docs/proposals/` 선별

- ✅ 진행 중 (active) 제안만
- ❌ 완료 흡수된 것 (대부분 — 핸드오프 후 본 docs/ 에 정착)

---

## 2. **제외 (Tier 외)** — Claude Code 단독 영역

| 카테고리 | 파일 | 이유 | 대신 |
|---|---|---|---|
| `apps/web/src/components/**` (~300 파일) | 컴포넌트 본문 | 단편 청크만 retrieve → 비효율 | Claude Code Read / Grep |
| `apps/web/src/app/**` (~170 파일) | 모든 라우트 핸들러 | 위와 동일 | `docs/ROUTES.md` 가 SSoT |
| `apps/web/src/lib/**` (~140 파일) | 비즈니스 로직 | 위와 동일 | 도메인 묶음에 핵심 1-2개만 |
| `supabase/migrations/2025*.sql` (~30) | 옛 init | `docs/DB_SCHEMA.md` 가 현 SSoT | — |
| `pnpm-lock.yaml` (4% 단독) | lock | 분석 가치 0 | — |
| `apps/mobile/**` | Phase 2 기획 | 채팅 거의 안 다룸 | 별도 attach 필요 시 |
| `apps/web/public/**` 모든 binary | 모델 / 이미지 | indexing 의미 0 | — |
| `docs/references/**` (14 HTML) | 옛 mockup | 사용 가치 낮음 | — |
| `docs/proposals/` 완료된 것 | — | 본 docs/ 에 흡수됨 | git history |
| `.turbo/` / `.next/` / `dist/` / `coverage/` | build cache | 이미 `.gitignore` | — |
| `data/` / `exports/` / `Downloads/` | 옛 데이터 / 임시 | 이미 `.gitignore` | — |
| `scripts/vcb/**` / `scripts/dict-fill/**` | 완료된 sprint CLI | 거의 인용 안 됨 | — |
| `docs/AI_CONTEXT/rollback/**` | migration rollback baseline SQL | DDL 청크 — Project spec 검토에 무가치 | Claude Code 직접 `Read` |

---

## 3. 채팅 시작 1-line 매핑 (사용자 → Project self-direction)

채팅 첫 메시지에 "**이 채팅은 X**" 라고 알리면 Project 가 본 manifest 참조해서 다음 안내:

| 사용자 1-line | Project 가 권장하는 attach (Tier 1 + …) |
|---|---|
| "이 채팅은 DB" / "migration" / "스키마" | + Tier 2-A (DB) |
| "이 채팅은 LCP" / "ACP" / "큐레이션" / "도서" / "글" | + Tier 2-B + Tier 3 의 ACP 활성 |
| "이 채팅은 VRL" / "단어 분류" / "V-Level" | + Tier 2-C |
| "이 채팅은 워크스페이스" / "학습 모듈" / "/text" | + Tier 2-D |
| "이 채팅은 API" / "라우트" | + Tier 2-E |
| "이 채팅은 디자인" / "UI" / "토큰" | + Tier 2-F |
| "설계만" / "방향성" / "검토" | Tier 1 만으로 충분 |
| "구현" / "디버깅" / "DB query" / "외부 API 검증" | **Project 영역 X** — Claude Code 측에 지시 |

---

## 4. 검증 / 갱신

### Project (claude.ai web) 측

- 새 채팅 시작 후 `@project_knowledge "PROJECT_KNOWLEDGE_MANIFEST"` retrieve 확인 — 본 파일이 indexing 됐는지
- 도메인 mismatch 시 (예: ACP 채팅인데 Tier 2-B 가 attach 안 됐을 때) Project 가 사용자에게 명시 요청

### Claude Code (VS Code) 측

- `pnpm sync:memory` → AI_CONTEXT mirror 갱신
- pre-commit hook 이 매 commit 시 자동 mirror
- `docs/CONTEXT.md` 의 §4 auto 블록이 매 commit 시 자동 갱신

### 자동 검증 (sync-check.yml)

추후 추가 가능:
- 본 manifest 의 Tier 1 list 가 git ls-files 와 1:1 일치하는지
- `docs/` 직속 .md 신규 추가 시 manifest 갱신 누락 alert
- Tier 2-A 의 supabase/migrations 리스트가 outdated 면 warn

---

## 5. 한몸 한계 (다시 명시)

| 영역 | Project (Tier 1+2+3) | Claude Code |
|---|---|---|
| 설계 / 점검 / 분석 / 지시 작성 | ✅ 주력 | 보조 |
| 구현 / migration 적용 / 테스트 / debugging | 가이드만 | ✅ 주력 |
| Supabase MCP / DB query | ❌ | ✅ |
| 외부 API fetch / WebFetch | ❌ | ✅ |
| git log / ls-files / branch / commit | ❌ | ✅ |
| pre-commit hook 실행 | ❌ | ✅ |

→ **사용자가 두 채팅 사이 다리** — Project 결과를 Claude Code 에 paste / Claude Code 결과 (commit hash, fix 요약) 를 Project 에 paste. 이 다리 비용이 한몸의 유일한 인적 cost.

---

## 6. 본 manifest 자체의 위치

- **추가 위치 (claude.ai UI)**: docs/ 직속 → `PROJECT_KNOWLEDGE_MANIFEST.md` 체크
- **Tier**: 1 (Always-on)
- **갱신 주체**: 사람 (영역 추가 시) — Tier 1/2 표만 수정
- **자동 갱신 부분**: 없음 (manifest 는 사람 큐레이션)

---

## 부록: 즉시 적용 체크리스트 (claude.ai 의 Add content from GitHub UI)

### Step 1 — 전체 해제

`Vocaflow` 옆 ☐ → 모두 해제

### Step 2 — Tier 1 추가 (26 파일)

루트 6 + `docs/` 직속 20 + 본 manifest

### Step 3 — Tier 2 항상 묶음 (11 파일)

- `docs/adr/` 3
- `docs/AI_CONTEXT/feedback/` 8
- `docs/AI_CONTEXT/README.md`

### Step 4 — 현재 활성 도메인 묶음 (5-10 파일)

지금 우리 채팅은 **sync 인프라 + ACP** → Tier 2-B (LCP/ACP) 추가:
- `packages/library-pipeline/src/types-article.ts` · `types.ts`
- `packages/library-pipeline/src/ingest-article/_curation-spec.ts` · `_helpers.ts`
- `apps/web/src/lib/acp/seed-upsert.ts`
- `supabase/migrations/2026061[3-9]*.sql` (최근 ACP)

### Step 5 — Tier 3 history 선별 (10-20 파일)

`docs/AI_CONTEXT/project/` 중 최근 + active 만.

### Step 6 — 검증

```
@project_knowledge "PROJECT_KNOWLEDGE_MANIFEST"  → 본 파일 retrieve
@project_knowledge "lib/acp/seed-upsert"          → ACP 코드 retrieve
@project_knowledge "docs/CONTEXT"                 → 첫 진입 retrieve
@project_knowledge "docs/AI_CONTEXT/feedback/feedback_auto_doc"  → 룰 retrieve
```

4건 모두 hit → manifest 도입 완료.
