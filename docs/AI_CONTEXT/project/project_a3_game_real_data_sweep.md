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

**전부 머지 완료 (2026-06-28, PR #56~#59)**:
- #56 PairFlip scores+hub stats / #57 flashcard·spellforge·dictation scores(`lib/scores/record-score.ts` 공유 헬퍼) / #58 **WordBlitz standalone** learning_records(recordWordBlitzResult)+scores(무한루프라 onExit 시점, score=correct×120+wrong×30) → **게임 5종 전부 scores 적재 완료** (메인 Hub useHubData 최근활동 채워짐).
- #59 **추천 엔진 실데이터화** — `lib/recommend/{decide,get-next-action,use-next-action}.ts` (decideNextAction 순수 P1~P4 단일출처 + getNextActionForUser server action[due+mastery] + useNextAction hook). 5개 호출처(FlashcardSession/ScriptQuiz/SpellForge/DictationResultsClient/text[id]) useMemo(getMockNextAction)→useNextAction. getMockNextAction 은 decide 경유 DRY+보존.
- ⚠️ 게임 상호작용/완료 화면 write 경로 런타임 미검증(전부 mock폴백/try-catch 안전). user_stats 빈 상태면 추천 mastery=vocab수 근사(cold-bias).

**✅ 런타임 검증 완료 (2026-07-05, v06.139)**: Playwright 실주행으로 #53/#54 "런타임 미검증" 종결. **PairFlip 전 경로 정상**(실 SRS 페어 렌더→Easy 완주→scores+learning_records 4행+daily_activity 트리거 집계, 수리 0). **ScriptQuiz 결함 2건 발견·수리**: ① `const rpc = client.rpc as ...` this-바인딩 소실로 카탈로그/세션 fetch 전멸(무언 catch가 은폐) → `bind(client)`+관측성 ② 완료 결과가 sessionStorage `pushPendingTextResult`만 쌓고 **소비자 전무**(=#57에서 유일하게 빠진 게임) → 완료 분기에 `recordGameScore` 직접 배선. 검증 계정 `runtime-test-0705@vocaflow.dev`(vocab 10·활동 시드). ⚠️ 교훈: supabase-js 메서드를 변수로 떼면 this 소실 — `.bind(client)` 필수.

**잔여 (사용자 입력/결정 필요 — 자율 불가)**: OpenStax a/b/c(비즈니스 결정, 보류 권장) · 추천 P2(진행중 스크립트 reading_session 연동) 후속. (구 "ScriptQuiz 문제 생성"은 library_chapter_quiz 카탈로그 체제로 대체 — quiz_questions per-text 경로는 레거시 캐퍼빌리티로 잔존.)

관련: [[project-srs-persistence-a1]] · [[project-vrl-phase2-wordvault-recommended-section]]

