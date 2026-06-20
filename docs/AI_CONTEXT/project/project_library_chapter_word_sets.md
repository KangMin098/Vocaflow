> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_library_chapter_word_sets.md
> category: project

---

도서 → shared_word_sets 발행 인프라 구축. 챕터당 1 단어장, `v_level >= book.book_v_level` 필터.

**적용된 마이그레이션 7건** (2026-05-25):
- `shared_word_sets_category_library_book` — CHECK 에 `'library_book'` 신규 값 추가
- `shared_words_library_book_vocabulary_ref` — `library_book_vocabulary_id` FK + 부분 인덱스
- `publish_book_word_sets_function` — RPC `publish_book_word_sets(p_book_id uuid)` (멱등, curation_query JSONB 로 중복 SKIP)
- `trigger_publish_book_word_sets` — `library_books.status='published'` 전환 시 자동 발행
- `user_word_set_subscriptions_source_tracking` — `subscription_source` + `source_book_id` 컬럼
- `shared_word_sets_curation_query_gin` — `curation_query ? 'book_id'` 부분 GIN 인덱스 (역조회)

**백필 결과 — 117 챕터 단어장**:
- Alice (V6, 12 ch): 586 단어 (30-72/ch)
- Frankenstein (V8, 24 ch): 1,425 단어 (21-106/ch)
- Pride (V8, 61 ch): ~1,220 단어 (3-63/ch · 8 챕터 <10 단어, 사용자 결정대로 그대로 생성)
- Dorian (V8, 20 ch): 1,339 단어 (11-238/ch)

**Why:** 도서 학습 시 "이 챕터의 도전 어휘" 단위 학습 가능 — Krashen i+1 정합 (book_v_level 기준 V+ 만).

**How to apply:**
- 신규 published 도서는 trigger 가 자동 발행 — 별도 호출 불필요
- 기존 published 책에 챕터 단어장 누락 시 `SELECT publish_book_word_sets(book_id);` 수동 호출 (멱등)
- 책-단어장 역조회는 `WHERE curation_query @> '{"book_id":"<uuid>"}'::jsonb` (GIN 인덱스 적용됨)
- 사용자가 책 진입 시 단어장 구독하면 `user_word_set_subscriptions.source_book_id` 채워야 학습 분석 정확

관련: [[feedback_auto_curate_book_is_gating]] (auto_curate_book 함수명 오해 정정)

