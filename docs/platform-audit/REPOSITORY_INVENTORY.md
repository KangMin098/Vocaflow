# REPOSITORY_INVENTORY — 저장소·브랜치·worktree·PR 전수

> STEP 1/6 플랫폼 전수 조사 · 기준 `origin/main` **a7c986469** (2026-10-09) · 조사 브랜치 `audit/platform-goal`
> 원자료: [_raw/area-git.md](./_raw/area-git.md) · [_raw/remote-branches-ahead.txt](./_raw/remote-branches-ahead.txt) · [_raw/worktrees.txt](./_raw/worktrees.txt)

## 1. 규모 (저장소 실계수)

| 항목 | 값 | 근거 |
|---|---|---|
| main 커밋 | 3,777 | `git rev-list --count origin/main` |
| 월별 커밋 | 04월 3 · 05월 87 · 06월 214 · 07월 528 · 08월 1,243 · **09월 1,510** · 10월 192(1~9일) | `git log --date=format:%Y-%m` |
| 커밋 타입 | feat 1,609 · fix 1,100 · docs 550 | conventional prefix |
| 상위 scope | **csat 652 · textbook 570** · dict 201 · comic 164 · acp 140 | 공급 파이프라인이 학습자 모듈보다 압도적으로 많다 |
| 웹 page.tsx | 194개(그중 리다이렉트 전용 9개) | `_raw/pages.txt` |
| API route.ts | 91 | `_raw/api.txt` |
| Admin page | 87 | `_raw/area-admin-ops.md` |
| 마이그레이션 파일 | 506 | `ls supabase/migrations` |
| public 테이블 / 함수 | 약 245 / 585 | `_raw/area-shared.md` |
| packages | design-tokens · eslint-config · library-pipeline · types · ui-shared · vcb-core · vcb-curate-core · video-factory · wlp | `ls packages` |
| apps | `web`(실구현) · `mobile`(파일 12개, 기획 수준) | |

## 2. 원격 브랜치 (main 보다 앞선 55개)

| 분류 | 수 | 대표 |
|---|---|---|
| **UNMERGED · 진행 중** | 21 | ① `design/replica-first` 줄기(replica-first 255 · textbook-factory-phase1 289 · illo-quality 212 · admin-touch-target · vocab-modal-count · learner-finish · bespoke-heads · body-composition) — 서로 merge 로 얽힌 한 덩어리. ② CSAT 학습자·지식 갈래(ec-smoke ⊃ ec-reveal-app ⊃ reveal-gate-verify · map-vnext · csat-g2-integration #155 · knowledge-signals/verify · methodology-vnext · csat-learning-loop-g1 · csat-practice-port) |
| **UNMERGED · 2주 초과 정체** | 14 | claude/elegant-cannon(드레인 출력 688파일) · knowledge-essence #140 · agents-roundtrip-safety #122 · screen-redesign · ux-audit 등 |
| **대체됨** | 5 | knowledge-vnext · db-anon-exec-hardening #116 · db-anon-160-161 #117(024000 미적용 — 재검토 필요) · csat-source-policy-v3 · csat-corpus-expansion |
| **폐기 추정** | 14 | 6~7월 plan-ui · wordvault-study-real-a2 · lint/worktree/tier-b 계열 등 |
| PR #156 | — | `fix/map-transfer-skeleton` 변경 파일 0 — 이미 반영 |

브랜치 수명 ≤ 2주 정책(AGENTS.md ③) 기준 **55개 중 34개 초과**.

## 3. 마이그레이션 ↔ DB 정합 (가장 큰 위험)

1. **DB 에 적용됐지만 main 에 없는 마이그레이션 ≥ 17건** — EC 계열 10건(20261003230000, 1005~1006xxxx) · 교재 5건(20261007…) · `knowledge_release_approval`(20261008144206) · `learning_help_timing`(20261008180000). → **main 만으로 DB 를 재현할 수 없다.**
2. **번호 충돌**: `textbook-factory-phase1` 의 `20261008120000_reading_production_snapshot` 와 main·DB 의 `20261008120000_knowledge_vnext`.
3. **활성 브랜치에 DB 미적용 마이그레이션**: `20260926120000_spelling_canonical` · `20260929090000_funnel_allow_csat_workspace`. main 의 `20261002120000/120100/130000`(csat_map) 은 그 버전명으로 DB 기록이 없다(다른 버전명으로 적용됐는지 확인 필요).
4. map-vnext 와 ec-smoke 가 같은 마이그레이션·같은 csat 화면을 겹쳐 고친다.

## 4. worktree (48개)

- **커밋 안 된 변경이 있는 곳 27개** — 본 저장소(replica-first) 243 · screen-redesign 23 · ec-smoke 11 · methodology-intelligence 11.
- detached HEAD 검증용 2개(pr155-verify · practice-verify2)는 정리 후보.
- 원격 ahead 목록에 없는 로컬 전용 브랜치 worktree 다수(anchor-study · codex-* · ec-detector · map-core 등) — 원격 대비 상태는 미조사(**UNKNOWN**).

## 5. 열린 PR (6)

| PR | 브랜치 | 상태 판정 |
|---|---|---|
| #156 | fix/map-transfer-skeleton | 실변경 0 — 닫기 후보 |
| #155 | feat/csat-g2-integration | UNMERGED · 진행 중(G2·Practice 기록 계약 통합) |
| #140 | feat/knowledge-essence | UNMERGED · 정체 |
| #122 | chore/agents-roundtrip-safety | UNMERGED · 정체 (단, 세션 훅은 「안전장치 낡음」을 이미 경고 중) |
| #117 · #116 | db-anon-* | 대체됨 — 024000 미적용 확인 필요 |
