# Lexicon Unification — Phase 1 실행 패키지

> ADR Lexicon Unification v3.1 — Phase 1 (Schema Expansion)
> 시작일: 2026-05-20
> 브랜치: `db-통합`

## ⚠️ 진행 전 확인 사항

### 1. 기존 lexicon-v2.1 proposal과 충돌 가능성
`docs/proposals/lexicon-v2.1/` 에 다른 모델 (`(lemma, pos)` PK 모델)이 이미 존재.
본 Phase 1은 v3.1 모델 (`lemma` PK + senses JSONB) 기준. **v2.1과 v3.1은 양립 불가**.
→ v2.1 폐기 또는 보존 결정 필요.

### 2. Vendor 명칭 중립화 (메모리 제약)
마이그레이션 SQL 의 `frequency_data_sources` 시드에서 vendor명 직접 노출 제거.
초안에서 사용한 placeholder:
- `wm_2000` → `csat-prep-core-2k` (citation: "수능 대비 핵심 어휘 2,000 (vendor placeholder)")
- `ebs_1800` → `csat-prep-ext-1.8k` (citation: "수능 대비 확장 어휘 ~1,800 (vendor placeholder)")
- `ngsl`, `awl`, `coca_top5k` 는 학술 인용 가능 → 유지

→ 사용자 최종 source_key 결정 필요. 결정 전까지 SQL 적용 보류.

### 3. Supabase 마이그레이션 auto-apply 금지 (메모리 제약)
`supabase/migrations/20260520_120000_lexicon_phase1_expand.sql` 작성 완료.
**적용은 사용자가 Dashboard SQL Editor 에서 수동 실행** 또는 명시 승인 후 `mcp__supabase__apply_migration`.

## 산출물

- `usage-inventory.md` — shared_dictionary 등 코드 사용처 (Phase 4 마이그 체크리스트)
- `baseline.json` — Phase 1 적용 전 KPI (사용자가 SQL 실행 후 저장)
- `baseline-e2e.json` — Playwright 베이스라인 (Phase 1 적용 전)
- `post-phase1-e2e.json` — Phase 1 적용 후 (검증용)

## Playwright e2e

`apps/web/tests/e2e/` 에 3종 spec 작성:
- `01-wordvault-browse.spec.ts`
- `02-flashcard-session.spec.ts`
- `03-admin-curation.spec.ts`

설치 명령 (사용자 실행):
```bash
cd apps/web
pnpm add -D @playwright/test
pnpm exec playwright install chromium --with-deps
pnpm exec playwright test
```

## Phase 1 진입 조건

- [x] usage-inventory 작성
- [x] Playwright 설정 파일 작성
- [x] 3종 spec 작성
- [x] 마이그레이션 SQL 작성
- [ ] vendor 명칭 결정
- [ ] lexicon-v2.1 처리 결정
- [ ] Supabase 백업
- [ ] KPI 베이스라인 측정
- [ ] Playwright 설치 + 베이스라인 PASS
- [ ] 마이그레이션 SQL 수동 적용
- [ ] 사후 e2e PASS + KPI 비교
