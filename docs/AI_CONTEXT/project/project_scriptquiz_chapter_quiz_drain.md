> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_scriptquiz_chapter_quiz_drain.md
> category: project

---

ScriptQuiz 챕터 퀴즈는 Claude Code(=LLM 본인)가 본문을 읽고 저작해 `library_chapter_quiz` 에 직접 INSERT 하는 드레인. 런타임 LLM 없음.

**메커니즘 (100% 검증):**
- 챕터 본문 = `content_chunks.content` ← `library_chapters_master.content_hash` 조인 (library_books 엔 본문 컬럼 없음; `source`=소스명일 뿐).
- 문항 수/챕터 = `quiz_target_per_chapter(book_v_level)`: V≤1→3, ≤3→4, ≤5→5, 6→6, 7→7, 8→8, 9→9, ≥10→10.
- 발행 = `library_chapter_quiz` 직접 INSERT (전용 RPC 없음). 컬럼: library_book_id, chapter_idx, q_order(1..N), type('multiple'|'truefalse'), question, question_ko, options(jsonb `[{text,textKo}×4]`), correct_index(0-based), source_snippet(원문 EN 인용), book_v_level. INSERT 시 dollar-quote(`$q$...$q$`)로 인용부호·아포스트로피 안전. RETURNING 에 window 함수 금지.
- 잡 큐 = `book_quiz_jobs`(id·book_id·status running/done·chapters_done/total·questions_created·note). 완료 시 status=done 갱신.
- 검증 RPC = `book_quiz_coverage(book_id)`(chapters_total/with_quiz/questions_total) · `list_book_chapter_quiz_catalog()`(학습자 hub 노출) · `select_book_chapter_quiz(book_id,chapter_idx)`(play).

**품질 규칙:** 근거 기반(본문 읽고 정답 확정, 조작 금지) · 정답 위치 0/1/2/3 분산("항상 A" 패턴 차단, 기존 큐레이션 챕터도 분산됨) · EN/KO 이중언어.

**정책 (2026-07-04 사용자 승인):** "서사 적합 도서 1권씩". 부적합/초대형 보류 — Poetry(168편)·Fables(135 micro)·Dialogues(76만단어)·Foundational(정책문서)·Les Mis(364ch). 실제 전체 규모 ~7,400문항(감사의 "14권"은 축소치).

**진행 (2026-07-05 live 재확정):** quiz 보유 12권 1,658문항 — **Pinocchio(252, 2026-07-05 완결 — V7·36ch×7·정답 회전설계 62/63/64/63·무결성 0)**·Pride(488)·Marvelous Land of Oz(168)·Huck(154)·Wonderful Oz(141)·Railway Children(98)·Wind in the Willows(96)·Sherlock(96)·Just So(84)·Alice(72)·Ammachi(5)·Drone(4). ⚠️ **Jane Eyre 342문항 소실** — 소스 GET DELETE(도서 재fetch, 현 status=ready)로 CASCADE 삭제된 것으로 판정; 재드레인 필요 시 새 book_id 기준. **카탈로그 노출은 v06.129 게이트로 published만** → 현재 4권 749문항(Pride·Pinocchio·Ammachi·Drone). published 잔여 무퀴즈: Decline(71ch·비서사)·Twenty Years After(90ch) — 본문 적재 여부 재확인 필요. ready 서사 후보: Jane Eyre(재)·Great Expectations(59ch·V9).

**정답 균등 설계 패턴 (2026-07-05 확립):** 사후 셔플 대신 저작 시점 회전 — 챕터 c의 q번째 정답 위치 = `(c+q)%4`. 전량 균등 보장, 셔플 UPDATE 불요.

**⛔ 2026-07-05 사용자 결정: 챕터 퀴즈 생성은 잔여 업무에서 제외 — 더 이상 백로그로 관리하지 않음.** Twenty Years After는 30/90ch 부분 드레인(270문항, 분포 67/67/68/68, 무결성 0건)에서 중단(잡 c0e11675 done+note). 카탈로그는 챕터 단위라 부분 노출 무해. 재개는 사용자 명시 지시 시에만, ch31부터.

관련: [[project_a3_game_real_data_sweep]] (scriptquiz #54 quiz_questions=개인 퀴즈 경로, 별개), [[feedback_claude_code_is_llm]].

