# 영역 감사 — 학습자 학습 환경 / UX (2026-10-09)

- 기준: 브랜치 `audit/platform-goal` @ `a7c986469` (origin/main 최신). 코드 읽기 전용 · DB `SELECT` 만.
- 실계정: `auth.users` = **5** (dev/test 계정). 아래의 모든 "실사용" 증거는 이 5개 계정에서 나왔다 — **실제 외부 학습자 사용 증거는 0**이다.
- `funnel_events.screen_viewed` 는 60일간 수천 건이지만 사용자 수 ≤ 4 이고, 날짜가 e2e sweep 실행일(10-05·10-06·10-08)에 몰려 있다 → **화면 진입 이벤트는 자동 e2e/수동 점검 흔적으로 본다(실학습 증거 아님).**
- 상태 정의: VERIFIED_WORKING 은 "학습 기록 DB 행(learning_records/scores/모듈 전용 테이블)이 있다 + e2e 스펙이 있다" 둘 다일 때만 붙였다. 단 기록 주체가 테스트 계정이므로 **"사람이 검증" 이 아니라 "기록 경로가 실제로 쓰였음" 수준**이다. "테스트가 있다" ≠ "실사용자 검증".
- e2e: `apps/web/tests/e2e/*.spec.ts` 79개 + visual 2. 저장소 안에 최근 실행 결과(test-results / report) 는 없다 → **e2e 통과 여부는 이 감사에서 확인 불가**(스펙 존재만 확인).

## DB 실측 (SELECT, 2026-10-09)

`learning_records` by module (행 수 · 마지막 attempted_at):
dictation 166 (08-16) · ghost-race 132 (08-24) · cascade 97 (08-25) · flashcard 59 (09-19) · word-economy 45 (08-24) · wordblitz 29 (**10-03**) · connections 20 · wordfall-cadence 16 · word-customs 12 · wordsmith-vigil 11 · lexicon-estate 11 · daily-blitz 11 · pirate-quest 10 · pairflip 9 (07-10) · morphmerge 9 · lexicon-hands 9 · glyph-tongue 8 · letter-forge 6 · silent-rule 5 · **wordvault 4 (06-28)** · morpheme-rules 3. **spellforge 0 · echo 0 · word-orrery 0 · lexicon-detective 0 · scriptquiz 0**.

`scores` by module: ghost-race 25 · scriptquiz 23 (08-17) · flashcard 8 (09-19) · cascade 4 · wordblitz 3 (10-03) · word-economy 3 · wordfall-cadence 2 · dictation 2 · pairflip 2 · 그 외 아케이드 각 1. **spellforge 0 · echo 0**.

모듈 전용 테이블: `reading_sessions` 287 (전부 status=pending, 마지막 09-12) · `dictation_sessions` 15 / `dictation_attempts` 6 · `echo_match_sessions` 9 / `echo_match_attempts` 9 · `csat_item_attempts` 20 · `csat_trap_attempts` 83 · `csat_dx_session` 2 / `csat_dx_response` 90 / `csat_dx_snapshot` 2 · `csat_learner_state` 2 · `csat_map_goal` 1 · `csat_map_task` 21 · `csat_map_task_done` **0** · `learning_task_attempts` **0** · `learning_sessions` **0** · `learning_first_attempts` **0** · `csat_ec_capture_session` 0 (tombstone 6) · `user_diagnostic_results` 23 · `user_level_snapshots` 22 · `user_word_set_subscriptions` 279 · `study_plan_items` 8 · `weekly_reports` 1 · `comic_read_progress` 2 · `comic_panel_events` 90 · `reading_fluency_log` 3 · `user_textbook_selections` 3 · `classes` / `class_members` / `class_assignments` **0** · `daily_activity` 85 (마지막 10-06).

## 기능 플래그 / 숨김

- 환경변수 기반 기능 플래그는 **없다** (`process.env.*` 전수: NEXT_PUBLIC_*ENABLE/FLAG 0건). 숨김 장치는 셋뿐:
  - `app/dev/replica/layout.tsx:21` — 프로덕션에서 `REPLICA_ROUTES!=='on'` 이면 404.
  - `app/(main)/text/[id]/page.tsx:252` — 비프로덕션 전용 분기.
  - `app/(main)/hub-lab/page.tsx` — "링크는 어디에도 걸지 않는다" (주석 L7), 주소를 아는 사람만 진입하는 실험 화면.
- `/dev`, `/dev/components`, `/dev/directions`, `/dev/tts-probe` 는 (main) 셸 밖 개발 라우트(프로덕션 가드는 replica 하위만).

---

## 환경별 표

### 1. TextViewer (L0–L2 읽기)
| 항목 | 내용 |
|---|---|
| 라우트 | `/text` · `/text/new` · `/text/[id]` (`?mode=read`) · `/my`·`/my/texts`→`/text` 리다이렉트 |
| 코드 | `app/(main)/text/**`, `components/text-viewer/*`, `components/textviewer/*`(이름 중복 디렉터리 2개), `lib/text` |
| 테이블 | `texts`, `reading_sessions`, `vocabularies`, `v_text_content`, `reading_fluency_log` |
| 테스트 | e2e `08-text-extract-trust`, `09-text-extract-scale`, `23-textfit-verdict`, `23-word-web-reader` · unit 1 (`components/textviewer`) |
| DB 증거 | `texts` 278 · `reading_sessions` 287 **전부 pending**(completed 0) · fluency 3 |
| 상태 | **PARTIAL** — 읽기/입력은 동작 흔적이 있으나 세션 완료가 한 번도 기록되지 않음(완료 처리 경로 단절 의심). `text/new` 는 "직접 입력 탭만 동작, 파일/URL 준비 중"(page.tsx:3). |

### 2. WordVault (L3)
| 항목 | 내용 |
|---|---|
| 라우트 | `/wordvault`(→ 하위로 redirect, page.tsx:65) · `/wordvault/browse` · `/wordvault/review` · `/wordvault/study` · `/my/words`→`/wordvault` |
| 코드 | `components/wordvault`, `lib/wordvault` |
| 테이블 | `vocabularies`, `shared_dictionary`, `shared_words`, `shared_word_sets`, `user_word_set_subscriptions`, `daily_activity`, rpc `recommend_word_sets_for_user` |
| 테스트 | e2e `01-wordvault-browse`, `22-vault-facets`, `24-wordvault-real-stats`, `99-vault-measure` · unit 3 |
| DB 증거 | `learning_records(wordvault)` 4행, 마지막 **06-28** · `vocabularies` 2,269 · 구독 279 |
| 상태 | **IMPLEMENTED_UNVERIFIED** — 단어 저장·구독은 쓰이나 WordVault 자체 복습 기록은 3개월 넘게 0. |

### 3. Flashcard (L4a 재인)
| 항목 | 내용 |
|---|---|
| 라우트 | `/flashcard` · `/flashcard/play` |
| 코드 | `components/flashcard`, `lib/flashcard`, `lib/srs`(ts-fsrs, `rating-mapper.ts`) |
| 테이블 | `vocabularies`, `shared_dictionary`, `word_roots`, `word_root_links`, `learning_records`, `scores` |
| 테스트 | e2e `02-flashcard-session`, `05-learner-loop` · unit 3 + srs 6 |
| DB 증거 | lr 59 (09-19) · scores 8 (09-19) |
| 상태 | **VERIFIED_WORKING** (테스트 계정 기록 경로 기준) |

### 4. WordBlitz (L4a 자동화)
| 항목 | 내용 |
|---|---|
| 라우트 | `/wordblitz`(허브) · `/play/wordblitz`(플레이) |
| 코드 | `lib/wordblitz`, `components/game/*` |
| 테이블 | `learning_records`, `library_book_vocabularies`, `shared_dictionary`, `vocabularies`, `scores` |
| 테스트 | e2e `07-arcade-games`, `13-arcade-integrity` · unit 1 |
| DB 증거 | lr 29 · scores 3, 마지막 **10-03** (학습 모듈 중 가장 최근) |
| 상태 | **VERIFIED_WORKING** |

### 5. PairFlip (L4a 공간기억)
| 항목 | 내용 |
|---|---|
| 라우트 | `/pairflip` · `/pairflip/play` · `/pairflip/results` |
| 코드 | `components/pairflip`, `lib/pairflip` |
| 테이블 | `learning_records`, `scores`, `vocabularies` |
| 테스트 | e2e 전용 스펙 없음(sweep `26-learner-sweep` 진입만) · unit **0** |
| DB 증거 | lr 9 · scores 2, 마지막 **07-10** |
| 상태 | **IMPLEMENTED_UNVERIFIED** — 기록 3개월 전이 마지막, 단위 테스트 없음. |

### 6. SpellForge (L4b)
| 항목 | 내용 |
|---|---|
| 라우트 | `/spellforge` · `/spellforge/play` |
| 코드 | `components/spellforge`, `lib/spellforge`(`scoped-words`, `hub-words`), `lib/srs/rating-mapper.ts:26 spellforgeResultToRating` |
| 테이블 | 직접 `.from` 없음 — `pushPendingResult → flushPendingSession` 공용 경로 |
| 테스트 | unit 1 · e2e 전용 없음 |
| DB 증거 | **lr 0 · scores 0** (page.tsx 머리말도 "scores 에 spellforge 0행" 명시) · 화면 진입 145회 |
| 상태 | **IMPLEMENTED_UNVERIFIED** — 진입은 되나 기록이 한 번도 저장된 적 없음 → 저장 경로 결함 가능성(우선 조사 대상). |

### 7. EchoMatch (L4c 발음/청각)
| 항목 | 내용 |
|---|---|
| 라우트 | `/text/[id]/echo` |
| 코드 | `components/echo`, `lib/echo` (pitchfinder + DTW) |
| 테이블 | `echo_match_sessions`, `echo_match_attempts`, `learning_records`(module `echo`, `lib/srs/types.ts:66` "기록만, 간격 불변") |
| 테스트 | e2e `06-echomatch-fakemic` · unit 3 |
| DB 증거 | echo sessions 9 / attempts 9 · **lr(echo) 0** |
| 상태 | **PARTIAL** — 전용 테이블엔 기록, 그러나 설계상 남겨야 할 learning_records(echo) 는 0. |

### 8. ScriptQuiz (L5)
| 항목 | 내용 |
|---|---|
| 라우트 | `/scriptquiz` · `/scriptquiz/play` |
| 코드 | `lib/scriptquiz`(queue.ts) |
| 테이블 | `library_chapter_quiz`(2,453), `quiz_questions`(5), `scores`, `texts` |
| 테스트 | unit 2 · e2e `06-chapter-launch`(간접) |
| DB 증거 | scores 23, 마지막 08-17 · lr 0 (문항 단위 기록 없음) |
| 상태 | **IMPLEMENTED_UNVERIFIED** (점수만 남고 7주 무기록) |

### 9. Dictation (L6 듣기·쓰기)
| 항목 | 내용 |
|---|---|
| 라우트 | `/dictate` · `/dictate/setup` · `/dictate/session` · `/dictate/results` |
| 코드 | `components/dictation`, `lib/dictation` |
| 테이블 | `dictation_sessions`, `dictation_attempts`, views `dictation_overview/recent_misses/weakness`, rpc `get_chapter_content` |
| 테스트 | e2e `17-dictation-loop`, `23-dictate-resume`, `24-dictate-sweep` · unit 5 |
| DB 증거 | lr 166 (08-16) · sessions 15 · attempts 6 · scores 2 |
| 상태 | **VERIFIED_WORKING** (lr 최다 모듈) |

### 10. Dashboard / Reports / Plan (L7 회고·목표)
| 항목 | 내용 |
|---|---|
| 라우트 | `/dashboard` · `/reports` · `/plan` · `/settings` |
| 코드 | `components/dashboard`, `components/reports`, `components/plan`, `lib/learner/memory-horizon.ts`, `weekly-report`, `plan-actions` |
| 테이블 | `daily_activity`, `learning_records`, `weekly_reports`, `study_plan_items`, `user_stats` |
| 테스트 | unit dashboard 2 · plan/reports **0** · e2e `05-plan-picker` |
| DB 증거 | daily_activity 85 (10-06) · weekly_reports **1** · study_plan_items 8 · user_stats 2 |
| 상태 | Dashboard **IMPLEMENTED_UNVERIFIED** · Reports **PARTIAL**(리포트 1건, 수동 "갱신" 버튼에만 의존) · Plan **IMPLEMENTED_UNVERIFIED** |

### 11. Hub / 포털 / 오늘 처방
| 항목 | 내용 |
|---|---|
| 라우트 | `/hub` · `/hub-lab`(비공개 실험) · `/sitemap` |
| 코드 | `components/hub/**`(portal, tines-bands), `lib/learner/*` rpc `prescribe_today` |
| 테스트 | e2e `18-hub-real-queue`, `23-hub-today-stage`, `38-hub-ribbon-truth`, `91-hub-design-capture` · unit 1 |
| DB 증거 | screen_viewed(hub) 1,710 (테스트 계정) · `hub_promo_clicked` 57 |
| 상태 | **IMPLEMENTED_UNVERIFIED** (진입 화면 자체이므로 학습 기록 증거 개념 없음). hub-lab = **EXPERIMENTAL** |

### 12. Practice / 구문 DCP (구문 연습)
| 항목 | 내용 |
|---|---|
| 라우트 | `/practice` · `/practice/dcp` · `/library/textbooks/[series]/[step]/practice` |
| 코드 | `components/practice`, `lib/learner/dcp-actions.ts`(rpc `textbook_practice_items` L249, `grade_dcp_item`) |
| 테이블 | `csat_dcp_items`(834,311), `csat_item_attempts`, rpc `grade_dcp_item`, `prescribe_today` |
| 테스트 | e2e `21-textbook-practice`, `25-practice-pool`, `26-practice-chooser` · integration `dcp-grade-records.integration.test.ts` |
| DB 증거 | `csat_item_attempts` 20 |
| 상태 | **IMPLEMENTED_UNVERIFIED** — 문항 83만 vs 시도 20 (공급/수요 비대칭 극단). |

### 13. 아케이드 / 게임 학습 (Pirate Quest 3D 포함)
| 항목 | 내용 |
|---|---|
| 라우트 | `/arcade` · `/arcade/ranking` · `/play/*` 18종 (cascade, connections, daily-blitz, ghost-race, glyph-tongue, letter-forge, lexicon-detective, lexicon-estate, lexicon-hands, morpheme-rules, morphmerge, pirate-quest, silent-rule, word-customs, word-economy, word-orrery, wordfall-cadence, wordsmith-vigil) |
| 코드 | `components/game/*`, `components/pirate-quest/*`(three/R3F: `PirateScene.tsx`, `PirateModel.tsx`), `word-orrery`·`wordfall-cadence`·`lexicon-detective` 도 three 사용 |
| 테이블 | `learning_records`, `scores` |
| 테스트 | e2e `07-arcade-games`, `09-arcade-access`, `12-arcade-audio`, `13-arcade-integrity`, `15-arcade-brief`, `25-arcade-ranking` |
| DB 증거 | lr 기록 16/18 게임 (ghost-race 132 최다), **마지막 기록 08-25** · word-orrery·lexicon-detective **0** |
| 상태 | 16종 **VERIFIED_WORKING**(테스트 계정, 6주 전) · word-orrery·lexicon-detective **IMPLEMENTED_UNVERIFIED**(진입 115회인데 기록 0) |

### 14. CSAT 학습자 (/csat*) — 진단·지도·세션·강의
| 항목 | 내용 |
|---|---|
| 라우트 | `/csat` (`?tab=type|trap`, `?need=`) · `/csat/browse` · `/csat/diagnosis` (`attempts/new`→ `?tab=records&modal=new`) · `/csat/record` · `/csat/space`→`/csat` · `/csat/item/[slug]` · `/csat/dissect` · `/csat/formulas` |
| 코드 | `components/csat/{home,browse,diagnosis,session,theater,lecture,space}`, `components/csat/diagnosis/map/LearningMap.tsx`, `lib/csat/**`(`map/load.ts`) · API `api/csat/state`, `api/csat/item/[slug]/task` |
| 테이블 | `csat_items(_public)`, `csat_item_analyses`, `csat_dx_*`(session/response/snapshot/settings/profile_hist), `csat_map_*`(goal/task/task_done/node/edge), `csat_item_attempts`, `csat_trap_attempts`, `csat_learner_state`, `learning_task_attempts`, `learning_sessions`, `csat_ec_*` |
| 테스트 | unit **91**(최다) · e2e `41`–`50`, `csat-continuity`, `csat-item-layout`, `43-csat-map-a11y` |
| DB 증거 | dx_session 2 / dx_response 90 · trap_attempts 83 · item_attempts 20 · learner_state 2 · map_goal 1 · map_task 21 / **task_done 0** · **learning_task_attempts 0 · learning_sessions 0** · EC capture 0 (tombstone 6) · funnel: `csat_session_finished` 1, `csat_lecture_played` 17 |
| 상태 | 진단(dx)·함정 **IMPLEMENTED_UNVERIFIED**(소량 기록) · 학습 지도(map) **PARTIAL**(과제 생성은 되나 완료 0, 지도가 읽는 `learning_task_attempts`·`learning_sessions` 0 — `lib/csat/map/load.ts:304-326`) · 세션 루프 **PARTIAL**(finished 1회) · 강의(lecture) **IMPLEMENTED_UNVERIFIED** · 오답원인 캡처(EC) **EXPERIMENTAL** |

### 15. 라이브러리 읽기 (도서·스크립트·교재·공용 단어장)
| 항목 | 내용 |
|---|---|
| 라우트 | `/library`→`/library/books` · `/library/books/[bookId]`(→ `/text/[id]` redirect L85) · `/library/scripts` · `/library/scripts/[bookId]` · `/library/textbooks` · `/[series]` · `/[series]/[step]` · `/library/vocab` · `/my/books` · `/my/books/[bookId]`(→ redirect) |
| 코드 | `components/library/**`, `lib/library/**`, `lib/textbook/**` |
| 테이블 | `library_books`, `library_articles`, `library_chapters_master`, `shared_word_sets`, `user_word_set_subscriptions`, `user_textbook_selections`, rpc `enroll_library_book`, `deliver_chapter_vocab`, `get_chapter_content` 등 |
| 테스트 | unit library 38 + textbook 20 · e2e `16-chapter-vocab-delivery`, `19-content-scope`, `25-textbook-shelf`, `39-library-*`, `40-textbook-shelf-layout`, `22-book-composer-sets` |
| DB 증거 | 구독 279 · textbook_sel 3 · 독서 완료 기록 없음(reading_sessions completed 0) |
| 상태 | 카탈로그/구독 **IMPLEMENTED_UNVERIFIED** · 실제 읽기 완료 루프 **PARTIAL**(TextViewer 와 같은 완료 단절) |

### 16. 만화 (Comics)
| 항목 | 내용 |
|---|---|
| 라우트 | `/comics`→`/comics/adapted` · `/comics/adapted/[bookId]` · `/comics/restored` · `/comics/restored/[slug]` · `/text/[id]/comic` |
| 코드 | `components/comic`, `lib/comic` |
| 테이블 | `comic_books`(발행 1), `comic_pages`, rpc `list_comic_catalog`, `save_comic_progress`, `comic_panel_events` |
| 테스트 | e2e `11-comic-discovery`, `13-comic-navigation` · unit 3 |
| DB 증거 | comic_read_progress 2 · panel_events 90 |
| 상태 | **IMPLEMENTED_UNVERIFIED** (발행 1편, 진행 2건) |

### 17. 영상 / 강의 / TTS
| 항목 | 내용 |
|---|---|
| 라우트 | `/video` · `/video/[id]` (**(marketing) 그룹** — 학습자 앱 셸 밖) · CSAT 강의는 `/csat/item/[slug]` 내 `components/csat/lecture/*` · `/dev/tts-probe` |
| 테이블 | `video_*` 테이블(요청·잡) — 전부 0~근소 · funnel `video_started` 7 / `video_completed` 9 |
| 테스트 | unit video 6 · e2e `46-csat-lecture`, `27-tts-voice-stability` |
| 상태 | 영상 **IMPLEMENTED_UNVERIFIED**(학습 기록과 미연결 — learning_records 에 video 모듈 없음) · TTS **IMPLEMENTED_UNVERIFIED** |

### 18. 진단 / V-Level 배치
| 항목 | 내용 |
|---|---|
| 라우트 | `/diagnostic` · `/diagnostic/history` |
| 코드 | `components/diagnostic/DiagnosticClient` |
| 테이블 | `vrl_diagnostic_questions`(185), `vrl_diagnostic_tests`, `user_diagnostic_results`, `user_level_snapshots`, rpc `analyze_and_apply_*_diagnostic_result` |
| 테스트 | unit **0** · e2e 전용 없음(sweep 진입만) |
| DB 증거 | results 23 · snapshots 22 |
| 상태 | **IMPLEMENTED_UNVERIFIED** (기록은 있으나 테스트 0) |

### 19. 교실 (학생 측) / B2B
| 항목 | 내용 |
|---|---|
| 라우트 | `/teacher` (교사·학생 한 화면, 역할별 블록 — page.tsx:6) |
| 코드 | `components/teacher`, `lib/teacher` |
| 테이블 | `classes`, `class_members`, `class_assignments`, `class_assignment_progress`, rpc `join_class_by_code` |
| 테스트 | unit 5 · e2e `36-student-arrival` |
| DB 증거 | **classes·members·assignments 모두 0** (AGENTS.md 통계의 "학급 1" 과 불일치 — 이후 삭제된 듯) · `teacher_hub_view` 51 |
| 상태 | **IMPLEMENTED_UNVERIFIED** (학생 쪽 흐름은 한 번도 실데이터로 돈 적 없음) |

### 20. 인증 / 온보딩
| 항목 | 내용 |
|---|---|
| 라우트 | `/login` · `/signup` · `/reset-password` · `/verify-email` — 별도 `/onboarding` 라우트 **없음** (진단·목표 설정이 온보딩 역할) |
| 테스트 | e2e `20-auth-flows` |
| 상태 | **IMPLEMENTED_UNVERIFIED** (가입 5) |

### 21. 전이/재평가 (Transfer · Re-evaluation)
| 항목 | 내용 |
|---|---|
| 위치 | `lib/csat/map/load.ts:305,326` (`phase='transfer'`), `lib/knowledge/product-server.ts:133` (insert), `app/(main)/csat/item/[slug]` + `api/csat/item/[slug]/task` |
| DB 증거 | `learning_task_attempts` **0** (transfer 포함 전체) |
| 상태 | **DESIGN_ONLY~IMPLEMENTED_UNVERIFIED** — 코드는 있으나 기록 0. (관련 스키마는 다른 브랜치와 번호 충돌 이력 — MEMORY `knowledge-vnext` 참조, 이 감사에서는 미확인) |

---

## 끊긴 / 중복 표면

1. **WordBlitz 이중 라우트** — `/wordblitz`(main, 허브) + `/play/wordblitz`(app, 플레이). 다른 모듈은 `/x` + `/x/play` 규약인데 이것만 `/play/*` 로 갈림.
2. **리다이렉트 전용 라우트 9개** (페이지 파일은 있으나 화면 없음): `/my`, `/my/texts`→`/text` · `/my/words`→`/wordvault` · `/my/books/[bookId]` · `/library`→`/library/books` · `/comics`→`/comics/adapted` · `/csat/space`→`/csat` · `/csat/diagnosis/attempts/new` · `/wordvault`(하위로). 194 page 수치를 부풀린다.
3. **`components/text-viewer` 와 `components/textviewer` 두 디렉터리 공존** — 이름 중복.
4. **`/hub-lab`** — 링크 없는 실험 화면이 (main) 셸 안에 프로덕션 노출(가드 없음).
5. **`/dev/*`** — `/dev`, `/dev/components`, `/dev/directions`, `/dev/tts-probe` 는 프로덕션 가드 없음(replica 하위만 가드).
6. **영상 `/video` 가 (marketing) 그룹** — 학습 기록·허브와 연결되지 않은 독립 표면.
7. **funnel 이벤트에만 남은 사라진 화면**: `csat-type`(337, 마지막 09-17) · `csat-plan`(201, 09-17) — 현재 page.tsx 없음(`/csat?tab=type` 로 흡수된 것으로 보임).
8. **학습 기록 이중 체계** — 어휘 모듈은 `learning_records`, CSAT 지도는 `learning_task_attempts`/`learning_sessions`, 연습은 `csat_item_attempts`, 듣기는 `dictation_*`, 발화는 `echo_match_*`. 대시보드(`lib/learner`)는 CSAT 쪽 기록을 읽지 않는다(`lib/learner` .from 목록에 `learning_task_attempts` 없음) → **CSAT 학습이 Dashboard/Reports 에 반영되지 않음.**

## 주요 공백 (근거 순)

- **SpellForge 기록 0** — 진입 145회, lr/scores 0. 저장 경로 결함 가능성 최우선 조사.
- **reading_sessions 287건 전부 pending** — 읽기 "완료" 가 한 번도 기록되지 않음 → L0–L2 진척이 어디에도 집계되지 않음.
- **EchoMatch 의 learning_records(echo) 0** — 전용 테이블 9건과 불일치.
- **word-orrery · lexicon-detective 기록 0** (3D 게임 2종).
- **CSAT 학습 지도: 과제 21 / 완료 0, learning_task_attempts 0** — 지도의 진척·전이 판정 데이터가 비어 있음.
- **Practice: 문항 834,311 / 시도 20.**
- **교실: 0행** — 학생 측 흐름 실데이터 미검증.
- **테스트 0 영역**: PairFlip(unit 0), Diagnostic(unit 0), Plan/Reports(unit 0).
- 학습 모듈 마지막 기록: wordblitz 10-03 외에는 대부분 **8월** — 최근 6주 학습 기록은 사실상 wordblitz·flashcard 뿐.
- 모든 증거는 테스트 계정 5개에서 나옴 — **실학습자 검증 VERIFIED 는 하나도 없다.**
