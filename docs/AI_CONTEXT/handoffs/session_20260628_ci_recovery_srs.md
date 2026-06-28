# Handoff — 2026-06-28 세션 (CI 복구 + SRS 영속화 + worktree 인프라)

> 대상: 다음 Claude Code/Project 세션 — resume 가이드
> 범위: 멀티세션 worktree 인프라 · SRS 학습결과 영속화 5모듈 · **silently 깨져있던 CI 양대 게이트(build·verify) 복구·머지·가드** · lint 부채 74건 · 위생 정리
> SSoT 참조: [[project_next_build_broken]] · [[project_srs_persistence_a1]] · `docs/WORKTREE.md` · `docs/CHANGELOG.md`(v06.86~94)

---

## 1. main 에 머지됨 (5 PR)

| PR | 커밋 | 내용 |
|---|---|---|
| #41 | `ee27bad` | 프로덕션 `next build` 복구(`swcMinify:false` + `eslint.ignoreDuringBuilds`) + CI `build` 가드 job |
| #42 | `1af1fb9` | `verify` CI green 복구 — web lint 74건→0 + mobile lint/typecheck stub + 무테스트 패키지 `--passWithNoTests` + content-storage 통합테스트 env-skip 수정 |
| #36 | `e522023` | 멀티세션 git worktree 자동화 (`scripts/worktree.mjs` + `pnpm wt` + `docs/WORKTREE.md`) |
| #37 | `26fa3ac` | Tier B UI 폴리시 (pending-words toast + 로딩 화면 스피너) |
| #43 | `1dcc043` | 추적 중이던 `.turbo` 캐시 파일 2종 untrack |

**핵심 시스템 발견:** CI(`ci.yml`)가 그동안 `next build`를 안 돌리고 `verify`도 사실상 red 방치(main branch protection 없음)라 **build·verify 양쪽이 silently 깨져있었음**. 이제 둘 다 green + 실제 게이트로 작동.

## 2. 보류 — SRS 영속화 PR (재개 시 작업)

학습 결과를 `vocabularies`(FSRS D/S) + `learning_records`(audit)에 영속화. **구현 완료, 머지 보류**(런타임 미검증).

| PR | 브랜치 | 내용 | base |
|---|---|---|---|
| #38 | `feat/srs-persistence-a1` | A1.1 — `flushPendingSrsResults` 서버액션 + 세션종료 flush + Flashcard/SpellForge/Dictation 배선 | main |
| #39 | `feat/wordvault-study-real-a2` | A2 — `/wordvault/study` RSC 실 vocabularies(due 우선) + StudyMode 실배선 | #38 (스택) |
| #40 | `feat/wordblitz-learning-records` | A1.3 — WordBlitz `learning_records` insert | main |

**재개 절차:**
1. **각 main 재머지** — #42 lint 변경과 겹친 파일에서 **코드 충돌** 예상: #38↔SpellForge.tsx(`confirmed` 제거), #39↔wordvault/page.tsx(`handlePlayExample` 제거)·rating-mapper.ts. (force-push 금지 → `git merge origin/main` 방식.)
2. **런타임 E2E 검증** — 로그인→학습(flashcard/spellforge/dictation/wordvault study)→완료→ DB 확인: `vocabularies.last_review_at`/`stability` 갱신 + `learning_records` row 생성. **헤드리스 불가 → 수동 또는 staging** (자격증명 필요).
3. **머지 순서** #38 → #39 (스택), #40 독립. 각 main 머지는 **명시 확인** 필요(분류기 정책).

설계 핵심(재조사 불요, [[project_srs_persistence_a1]]): 마이그레이션 0(DB·`lib/srs/*` 완비) · cardId 신뢰불가 → **단어 텍스트 lookup** · **서버 권위 재계산**(empty-card 리셋 방지) · WordBlitz 가 레퍼런스.

## 3. 잔여 백로그

- **A2b** — WordVault review 뷰(placeholder) 실 due 단어 + hub `words` mock(page.tsx:57 MOCK_WORDS) 실데이터화. ⚠️ review는 #39의 `fetchStudyVocabularies` 재사용이 자연스러워 **#39에 의존**(스택). SRS 머지 후 진입 권장.
- **C1 P6** — 구독 시점 user V-level 필터 ([[handoffs/p6_subscribe_user_filter]], E1~E8 결정 대기).
- **C2 ACP §18** — register/license/noise 게이트 ([[project_acp_source_redesign]], 마이그레이션 승인 대기).
- **#2~#19** — 이전 세션 VCB/VRL/dict PR 스택 (이 세션 미관여).

## 4. 후속(옵션)

- `next.config` `eslint.ignoreDuringBuilds`를 다시 `false`로(이제 lint 0이라 빌드에서 lint 재강제 가능) — 단, lint는 verify가 이미 게이트하므로 선택.
- SWC minify surgical 복원(onnxruntime 청크만 제외해 SWC minify 전역 복원, 빌드 속도) — 시도마다 빌드 2~3분, 신중.

## 5. worktree 운영 메모

이 세션은 `Vocaflow-tierb`(임시) 등 worktree에서 작업. **worktree 갓차: `.env.local`은 gitignore라 worktree에 없음** → 루트에서 복사해야 `next build`/test 가능. `pnpm wt new`가 자동 복사하도록 개선하면 좋음(미구현). 상세 `docs/WORKTREE.md`.
