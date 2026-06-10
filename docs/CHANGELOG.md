# CHANGELOG

> Vocaflow 변경 이력. 최신 3개 버전(v06.32~34) + 현재 작업 중인 마이그레이션 + 세션 변경 사항을 보존.
> 이전 v06.0~v06.31 의 누적 변경은 git 이력 (`git log`) 으로만 추적.
>
> **갱신 정책**: 새 마이그레이션 / 새 라우트 / 모듈 시맨틱 변경 / 컴포넌트 신설·제거 시 항목 추가.
> SQL · 라우트 경로 · 컴포넌트 이름은 `git`/`grep`/`SQL` 로 100% 검증 가능한 사실만 기록.

---

## Unreleased (v06.34 → next)

### 도서 큐레이션 — "→ 소스 GET" 시맨틱 재정의 (DELETE-based)

**Before** — `admin_bulk_requeue_books` 가 `status='queued'` UPDATE 만 수행 → 도서가 Curated Books 에 그대로 남음 (의도와 불일치).

**After** — `library_books` row DELETE → cascading effect:
- `library_book_vocabularies` (CASCADE) + `library_chapters_master` (CASCADE) 자동 삭제
- `library_seed_catalog.imported_book_id` (SET NULL) — seed 자동 unlock → BulkFetchTab 에서 재 fetch 가능
- `shared_word_sets` drafts 명시 DELETE (FK 없음, JSONB 참조)
- `archaic_candidates.first_seen_book_id` (SET NULL — FK 변경) — 단어 자산은 보존

| Migration | 내용 |
|---|---|
| `20260606225815_admin_bulk_book_status` | bulk RPC 초안 — status UPDATE 만 |
| `20260606231723_admin_bulk_book_rollback_cascade` | rollback cleanup 추가 (draft sets / vocabs / chapters) |
| `20260607005258_admin_bulk_return_to_source` | DELETE 시맨틱 재정의 (deleted_count / seed_unlocked 반환) |
| `20260607010118_archaic_candidates_first_seen_book_set_null` | FK ON DELETE NO ACTION → SET NULL |

**관련 RPC**: `admin_bulk_set_books_curating(uuid[])` (ready→curating, draft 삭제만), `admin_bulk_requeue_books(uuid[])` (→ 소스 GET, library_books DELETE).

**관련 UI**: [`apps/web/src/components/admin/curation/MyLibraryTab.tsx`](../apps/web/src/components/admin/curation/MyLibraryTab.tsx) — Curated Books toolbar 3 버튼 (`검토대기 → 처리중` / `처리중 → 소스 GET` / `검토대기 → 소스 GET`) + `▶ 큐 처리 (dev · N권)` (자동 반복 drain).

### Dev 큐 드레인 (production 외 pg_cron 회피)

`get_lcp_config()` 가 dev 환경에서 NULL → cron worker 가 pgmq 메시지 무시. Admin 이 직접 트리거하는 dev-only endpoint 추가:

- **NEW**: [`apps/web/src/app/api/lcp/dev-drain-queue/route.ts`](../apps/web/src/app/api/lcp/dev-drain-queue/route.ts) — `NODE_ENV !== 'production'` + admin 인증 가드, `max=5` 도서를 self-host `/api/lcp/dev-process` 로 순차 호출, `archive_book_pipeline_messages` 자동 정리.
- UI: 자동 반복 루프 (라운드별 fetch + remaining 카운트 + 1초 elapsed 타이머 + 중지/계속 banner).

### 사용자 입력 책 (챕터별) 모드

`/text/new` 가 "단일 스크립트 / 책 (챕터별)" 두 모드. 책 모드는 챕터 N개 → 한 UUID 그룹으로 묶음.

| Migration | 내용 |
|---|---|
| `20260608222229_texts_user_book_group_id` | `texts.user_book_group_id UUID` + CHECK(library_book_id IS NULL OR user_book_group_id IS NULL) + 부분 인덱스 |
| `20260608222931_v_text_content_user_book_group_v2` | `v_text_content` view 에 `user_book_group_id` 추가 |

**관련 신규 파일**:
- [`apps/web/src/lib/text-viewer/save-user-book.ts`](../apps/web/src/lib/text-viewer/save-user-book.ts) — `saveUserBook({ bookTitle, author, chapters[] })` (UUID 생성 + N row 일괄 INSERT + 부분 실패 rollback)
- [`apps/web/src/components/text-viewer/BookChapterInput.tsx`](../apps/web/src/components/text-viewer/BookChapterInput.tsx) — 챕터 워크벤치 (가로 레일 nav + Alt+←/→ 단축키 + 챕터별 작성 상태 시각화)

**관련 액션**:
- `deleteUserBookGroupAction(groupId)` 신규 (단일 텍스트 액션은 그룹 chapter 거부)
- `useTexts` 가 `aggregateUserBookChapters` 로 그룹 → 1 LibraryText 카드 집계 (category="내 책")
- Workspace `/text/[id]/layout.tsx` 가 `user_book_group_id` 분기 — synthetic BookRow + chapter siblings → ChapterSidebar 동작

### DB 디스크 회수 (운영 정리)

5,155 orphan `content_chunks` DELETE → VACUUM FULL 5종 (`library_book_vocabularies` 233 MB→39 MB · `content_chunks` 58→13 MB · `archaic_candidates` 21→9.5 MB · `library_chapters_master` 6.2→1.4 MB · `pgmq.q_library_pipeline`).

**결과**: DB 606 MB → **350 MB** (256 MB / 42% 감소).

### LibriVox 챕터 매핑 (Workspace 보이스)

`librivox-chapter-map.ts` 재설계 — `parseSectionChapterMeta` (Roman + Arabic + "Book X, Chapter Y") + `buildVoiceChapters` 그룹핑 + `verifyWithinBookContiguity` (책별 1..N 검증) + 1차 outlier 제외 실패 시 2차 재시도 (Two Treatises Ch 11 like 긴 챕터 보호). `save-librivox-audio` route 는 `chapter_parts` 실패 시 단권 `audio.section_count === masters.length` 시 자동 `flat` 폴백.

`LibriVoxAudioPanel` 이 legacy `mode === null + aligned === true` 도 flat 으로 인식 (Pride & Prejudice 등 기존 저장본 자동 노출).

---

## v06.34 — 사용자 학습 자산 시각화 + ENHANCEMENTS

**라이브러리 도서 V-Level 측정 방식 token → type 교체** (`compute_book_vrl_type_based_p75` migration) — Zipf 편향 차단. Christmas Carol/Treasure Island/Sherlock/Dorian 등 12 도서 V-Level 재측정 (예: V5 → V7~V8). 학술 정합 (Lexile/ATOS/CEFR-J Text Profile).

**도서·단어장 spec UI 적용** — `/library/books` LibraryGrid 카드에 `✨ 단어장` indicator + `word_set_count` prop. `BookDetailClient` Primary/Supplementary Tier 시스템. Workspace 상시 가시 사이드 패널 (`WordSetSidebar.tsx`, lg breakpoint 이상 320px).

**라우트 정리** — `/library/scripts` + `/library/scripts/[bookId]` → `/library/books*` redirect. `LibraryTabs` 3탭 → 2탭. 미사용 `PublishedBooksSection` / `BookCard` 삭제. `fetchPublishedBooks` + `PublishedBook` interface 제거.

**Spec 충돌 해석 명시** — Spec §4 "Primary 1 단어장" vs 챕터당 1 단어장 → "도서 학습 단어장" 통합 카드 + 챕터별 펼침으로 해석. Spec §5 "학습 완료 234/1748" vs 사용자 0명 → null placeholder + "학습을 시작하면 진행도가 채워져요" 안내.

---

## v06.33 — EchoMatch 따라읽기 모듈 (Shadow Reading)

**4-Phase cycle**: idle → listening (TTS) → recording (MediaRecorder) → comparing (DTW) → scored.

**라이브러리**: `pitchfinder` (YIN 알고리즘) + `dynamic-time-warping-ts`. **3축 점수 40/30/30 가중** — 인토네이션 (피치 contour DTW · PITCH_THRESHOLD=80Hz) + 강세 (RMS energy DTW · ENERGY_THRESHOLD=0.08) + 리듬 (durationMs ratio · MAX 2.5).

**코드 인프라** — `lib/echo/`: `pitch-extractor.ts` (YIN frame 2048/hop 512 + voicedFrames) · `dtw-comparator.ts` (3축 + `scoreFeedback`) · `audio-recorder.ts` (getUserMedia echoCancel/noiseSuppress/AGC + MediaRecorder webm/opus + playBothOverlay) · `tts-player.ts` (Web Speech API · voice 선택) · `sentence-splitter.ts` (약어 Mr/Dr 처리) · `save-attempt.ts` (세션 캐시 + attempt INSERT + finalize 통계 집계).

**컴포넌트** — `components/echo/`: `EchoMatchPlayer` (4-Phase 컨트롤러 + sessionCache + attemptCountRef) · `MicPermissionGate` (권한 요청 게이트) · `PhaseProgress` (4 pill + 진행 %) · `SentenceCarousel` (Lora 18-22px) · `PitchVisualizer` (Canvas 2D devicePixelRatio + 원어민 var(--p) vs 사용자 var(--success) overlay + 그리드 + 정규화 min×0.9 max×1.1) · `ScoreCard` (overall 48px mono + 3축 weight % 표시 + tone 색).

**DB Migrations 2건** — `echo_match_sessions` (user/text/library_book FK + avg/best/worst 점수 통계 + retried_sentence_ids TEXT[] + RLS own sessions) + `echo_match_attempts` (session FK + sentence_id TEXT + attempt_number + 3축 점수 + duration_ms + RLS own attempts + idx user_date).

**알려진 한계**:
1. Web Speech API TTS 출력 직접 audio 추출 불가 (브라우저 보안) — 현재 `buildSyntheticRefContour` 합성 reference. Phase 2 에서 사전 녹음 audio 파일 또는 cloud TTS + Storage 캐싱으로 진짜 비교.
2. DTW threshold (80Hz/0.08) PoC 후 사용자 베타 데이터로 보정 필요.
3. DTW Web Worker 미적용 (22 문장 챕터는 main thread OK · 100+ 문장에서 분리 필요).
4. iOS Safari 실 검증 미수행.

**학습 모델 매핑** — Shadow Reading 은 기존 9계층 매핑 없음. 실제 인지는 L4c (청각 → 음운 출력). 위치: `/text/[id]/echo` 별도 라우트 (ModePills 'shadow' 모드 → 이 라우트).

---

## v06.32 — Workspace 도서 챕터 단어장 chip + Reading Universe

**도서↔단어장 매핑 정합** + Workspace UnifiedHeader 챕터 단어장 chip — `subscribed/total` 표시 + 클릭 시 InsightPanel.

**노출 분리 정책 최종 확정** — 단어장은 도서 컨텍스트 안에서만 노출, 카드/그리드 어디에도 단어장 정보 노출 X.

**`/library/scripts` 사용자 영역** — mock CurationCard 4권 + 별도 "발행된 도서" 섹션 모두 폐기 후 `PublishedBooksSection` 으로 통합. BookCard 단순화 — 인라인 expansion 제거 + `Link` 로 변환 (도서 카드 = entry point only).

**`/library/scripts/[bookId]` 도서 상세 페이지 신규** — 네이비/골드 Hero (cover gradient + 제목/저자/CEFR/V-Level/CEFR-J/Lexile/FK + "읽기 시작" CTA → `/text/[id]`) + `BookDetailClient` (6열 챕터 단어장 grid · 구독 상태 시각화 · VocabSetPreviewModal 재사용).

**`/admin/curation/preview/[bookId]` `ChapterWordSetsAdminSection`** Client 전환 — 표 행 `role="button"` + Enter/Space 키보드 + `ChapterWordSetPreviewModal` 신규 (구독 CTA 없는 admin 전용 modal · 단어 전수 fetch + sort_order DESC + 발음 듣기 + 추출 메타 JSONB details).

**결정** — 학습 진행 % 표시 보류. 사용자 0명 단계라 `vocabularies × learning_records` JOIN 비용 vs 정보 가치 비효율 — 구독 카운트만 표시 (Phase 2 사용자 학습 데이터 누적 후 확장 예정).
