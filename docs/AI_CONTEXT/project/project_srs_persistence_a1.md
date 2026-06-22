> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_srs_persistence_a1.md
> category: project

---

플랫폼 미완성 작업 triage 중 A1(SRS 영속화) 진단·구현. 2026-06-23.

**핵심 진단 (재조사 불필요):**
- **마이그레이션 0** — `vocabularies`에 FSRS 컬럼(difficulty/stability/last_review_at/next_review_at/module_history/review_count) + `learning_records`에 rating(smallint CHECK 1~4)/retrievability_before/stability_delta/metadata 모두 **이미 존재**. 실 DB 쿼리로 검증.
- **FSRS 인프라 완비** — `lib/srs/{fsrs,state,sm2,rating-mapper,supabase-adapter}.ts`. `ts-fsrs ^5.2.3` 의존성 존재. **WordBlitz `recordWordBlitzResult`가 작동 레퍼런스**(단 vocabularies update만, learning_records insert 없음).
- 학습 모듈은 FSRS를 클라에서 계산해 `sessionStorage` 큐(`pushPendingResult`)에 쌓지만 **DB flush 소비자가 없어 소실**됐던 게 진짜 갭.
- **`cardId` 신뢰 불가** — 모듈마다 의미 상이(Flashcard set=shared_words.id / text=vocabularies.id / Dictation=정규화 단어). → flush는 반드시 **단어 텍스트로 (user_id, word) vocabularies 조회**(WordBlitz 패턴).
- **서버 권위 재계산 필수** — scoped 단어는 `createNewCard`(empty)로 시작 → 클라 cardUpdate 신뢰 시 실 D/S **리셋**됨. 서버가 실 row의 D/S에 `applyReview` 적용해야 함.

**A1.1 완료 (PR #38, branch feat/srs-persistence-a1):** `lib/srs/flush-actions.ts`(server) + `flush-session.ts`(client) + `flush-types.ts` 신설, `PendingSrsResult.word` 추가, Flashcard/SpellForge/Dictation 완료 지점 flush 배선. typecheck/lint 통과, 런타임 스모크는 미실시.

**잔여:**
- **A1.2** — WordVault `StudyMode.tsx`는 순수 데모(rateWord=console.log, studyIndex=2 데모루프, 진행률 가짜). 실 rating 계산+push+진행 배선 필요.
- **A1.3** — WordBlitz `recordWordBlitzResult`에 `learning_records` insert 추가(현재 vocabularies update만 → Hub/Dashboard 통계 누락).

상위 백로그: A2 Hub 실데이터 배선(mock + 진행률 0 하드코딩), C1 P6 구독 필터([[project_p6_handoff_pending]]), C2 ACP §18([[project_acp_source_redesign]]). 멀티세션 worktree로 작업 — [[feedback_handoff_workflow]].

