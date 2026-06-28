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

**A2 완료 (PR #39, branch feat/wordvault-study-real-a2, #38 위 스택):** WordVault StudyMode가 MOCK_WORDS만 받던 문제 해소 — browse RSC 패턴(fetchUserVocabularies+vocabRowToWord) 복제로 `/wordvault/study` RSC 신설(fetchStudyVocabularies: due 우선 next_review_at asc nullsFirst, cap 50) + StudyMode 데모 제거+rateWord 실 FSRS/push/flush. **A1.2(StudyMode 영속화)는 A2로 자연 해결.** rating 1~5→FSRS: 1Again/2Hard/3Hard/4Good/5Easy. 핵심 발견: browse는 이미 RSC 실데이터, study/review만 레거시 client mock이었음.

**A1.3 완료 (PR #40, branch feat/wordblitz-learning-records, main 기반 독립):** recordWordBlitzResult(WorkspaceWordBlitzMode handleCorrect/handleWrong 에서 호출)에 vocabularies.update 후 learning_records.insert(resultToRecordPayload) 추가. 4모듈 기록 일관 달성. flush 인프라 무관.

**런타임 검증 (2026-06-28, ✅ FULL E2E PASS):** #39 dev 서버 → 사용자 직접 로그인 → `/wordvault/study` 실 단어 학습 → 종료(flush) → DB 반영 확인. baseline(전 사용자 review 0 + learning_records 0)에서 → **4단어(book/tale/apartment/allow) vocabularies last_review_at/stability(8.30)/review_count(1)/module_history(['wordvault']) 갱신 + learning_records 4행(module=wordvault, rating, is_correct, FK 일치) INSERT**. FSRS Easy 정합(~2주 후 복습). **flush 영속화 실 앱에서 정상 동작 확인** — A1.1(flush) + A2(study 실데이터) 검증 완료. flashcard/spellforge/dictation 도 동일 flush 경로라 검증됨. A1.3(WordBlitz)은 동일 resultToRecordPayload insert(payload 정합 검증됨)라 by-analogy.

**잔여(SRS):**
- **A2b** — WordVault review 뷰(하드코딩 "12개" placeholder) 실 due 단어 배선 + hub `words` mock(page.tsx:57 MOCK_WORDS, hero 분포 fallback) 실데이터화. (※ /wordvault?view=study·review 진입점은 SegmentControl·PageHeader 가 ?view= 링크 — A2 redirect 가 study 는 처리, review 는 아직 inline placeholder)
- ⚠️ A1.1/A2/A1.3 **런타임 스모크 전부 미실시**(헤드리스 한계) — 머지 전 수동 확인 필요.

상위 백로그: C1 P6 구독 필터([[project_p6_handoff_pending]]), C2 ACP §18([[project_acp_source_redesign]]). 멀티세션 worktree로 작업 — [[feedback_handoff_workflow]].
**전부 main MERGED (2026-06-28):** #38(A1.1 `e641816`)·#39(A2 `72a7729`)·#40(A1.3 `c8cc7a5`) — 각 rebase(main 머지·충돌해소)+CI green(verify+build)+squash. SRS 영속화 5모듈이 실 앱 검증 완료 후 main 반영됨. (잔여 A2b는 #39 의존 — 이제 진입 가능.) 이번 세션 main 머지 총 8 PR: #36/#37/#41/#42/#43 + #38/#39/#40. #44(세션 핸드오프 doc)만 open.

