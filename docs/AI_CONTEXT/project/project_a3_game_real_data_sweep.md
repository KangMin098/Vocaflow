> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_a3_game_real_data_sweep.md
> category: project

---

A3 게임 모듈 mock 잔존 스윕 (2026-06-28) — hub/play 진입이 mock 단어/세션을 쓰던 것을 사용자 SRS 큐 실데이터로.

**패턴**: study-queries `fetchStudyVocabularies`(due 우선 + cap 50) 재사용 → 모듈별 어댑터(`lib/<mod>/hub-words.ts` 등)로 모듈 Word 타입 매핑. status(4색)는 `rowToCard`→`getMemoryState` SSoT. 영속화는 기존 `flushPendingSession`(서버 권위 재계산, word-text lookup, 미매칭 silent skip).

**상태**:
- **Flashcard** PR #51 ✅ merged — hub 진입 실 due 단어(영속화 기존 작동). `lib/flashcard/hub-words.ts`.
- **SpellForge** PR #52 ✅ merged — Gatsby mock 제거 → 실 due 단어. `lib/spellforge/hub-words.ts`.
- **PairFlip** PR #53 🔶 open — 실 페어 + 영속화 신규(기존 영속화 전무). `lib/pairflip/due-pairs.ts`(클라 fetch, pairId=vocab.id) + 훅 `pairs?` 옵션(부족하면 mock 폴백, win-condition 보존) + GameScreen onComplete `pushPendingResult`+flush. ModuleId += 'pairflip'(DB enum 기존재, 마이그레이션 0)→actionToHref 케이스. **게임 상태머신 런타임 미검증 → auto-merge 안 함**.
- **ScriptQuiz** PR #54 🔶 open — `quiz_questions`(per user+text) 실 퀴즈 capability. `lib/scriptquiz/questions.ts` `fetchQuizSession`(0개면 null→MOCK 폴백) + `ScriptQuiz session?` prop + play page async `?text=` fetch. **앱에 런타임 LLM 인프라 0** → 문제는 Claude Code(MCP) 사전 생성. 첫 콘텐츠 = "Ammachi Ch1" 5문제 INSERT(사용자 명시 승인 — 영속 공유 DB write 라 classifier 가 scoped 승인 초과 차단했었음). E2E 검증 OK. 런타임 미검증.

**핵심 발견**: flashcard/spellforge 는 영속화가 이미 작동(데이터 source 스왑만=클린). pairflip 은 영속화 전무 + mock 페어(더 큰 작업). scriptquiz 는 AI 문제생성 필요(런타임 X → MCP 사전생성). quiz_questions 콘텐츠 INSERT 는 영속 write 라 **명시 승인 필수**(controlled write+revert 승인으로 불충분).

**머지 상태 (2026-06-28)**: #51·#52·#53·#54 전부 main 머지 완료(#53/#54 사용자 승인 후 머지, 런타임은 미검증 — mock 폴백 무회귀). #55(question_ko, A3.4b) auto-merge.
**A3.4b question_ko ✅**: PR #55 — `quiz_questions.question_ko` 컬럼(migration `20260628140000`, 사용자 명시 승인) + Ammachi 5문제 한국어 질문 UPDATE + fetchQuizSession 매핑(생성타입 미반영→unknown 캐스팅). 이제 ScriptQuiz 한국어 토글이 질문까지 동작.

**A3.5 PairFlip scores+stats ✅**: PR #56 — `scores` 테이블에 **아무 게임도 안 쓰던** gap 첫 해소. PairFlipGameScreen onComplete→scores INSERT(module='pairflip', metadata{maxCombo/level/mode}) + `lib/pairflip/stats.ts fetchPairFlipStats` + /pairflip(server) fetch → PairFlipHub stats prop(MOCK_STATS 제거). PairFlip 이제 완전 완성(페어+SRS #53 + 점수/스탯 #56). 마이그레이션 0.

**A3.6 scores 적재 확장 ✅**: PR #57 — `lib/scores/record-score.ts`(recordGameScore + useRecordGameScore 마운트 1회 가드) 공유 헬퍼 + flashcard(CompletionState)/spellforge(SpellForgeCompletion)/dictation(DictationResultsClient) 완료 시 scores INSERT. PairFlip(#56 inline)과 합쳐 5개 게임 중 4개 적재. 메인 Hub 최근활동(useHubData scores read) 채워질 기반 완성. 마이그레이션 0.

**열린 PR (런타임 검증 대기, auto-merge 안 함)**: #56(PairFlip scores+stats), #57(flashcard/spellforge/dictation scores). 둘 다 typecheck/lint green, 게임 완료 화면 런타임 미검증.

**잔여 (사용자 입력/신규 initiative)**: PR #56/#57 게임 런타임 검증 후 머지(사용자) · **WordBlitz scores** = 무한루프라 세션시작시각+정오카운트 추적 구조 추가 선행(별도) · ScriptQuiz 다른 스크립트 문제(INSERT 승인) · getMockNextAction 추천엔진(별개) · OpenStax a/b/c(보류 권장).

관련: [[project-srs-persistence-a1]] · [[project-vrl-phase2-wordvault-recommended-section]]

