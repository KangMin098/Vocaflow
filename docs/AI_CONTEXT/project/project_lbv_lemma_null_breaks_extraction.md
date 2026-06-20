> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_lbv_lemma_null_breaks_extraction.md
> category: project

---

2026-05-31 — `library_book_vocabularies.lemma` 가 NULL 이면 `extract_book_vocabulary_admin` 이 망가진다 (조용히):
- `direct` CTE 가 `d.word = lbv.lemma` join → NULL 이면 0 바인딩. 후보는 `inflection_recovery`(word→en_inflection_bases→base)로만 나옴.
- `book_levels`(threshold 계산)도 lemma join → empty → `percentile_disc` NULL → COALESCE fallback v_thresh=5/baseline. **그래서 percentile(70/75/80) 바꿔도 후보 수 불변** (UX 버그가 아니라 데이터 공백).
- 파생 seed(word-keyed 행)는 `direct`(lemma) 경로로만 닿는데 lemma NULL 이라 **seed 효과가 추출 후보에 안 나타남**. 반면 `find_unbound_book_lemmas` 는 `COALESCE(lemma,word)=word` 로 대조 → seed 반영되어 미등재는 줄어듦 → "미등재↓인데 후보 불변" 모순의 원인.

**"Twenty years after"(book 9124af41) 가 lemma 0.0%** (7,089 전부 NULL) — Phase 3B lemma backfill([[project_phase3b_lemma_backfill_books]])이 이 Dumas 책을 누락(나중 추가). 나머지 6권은 88~96%.

backfill 규칙(Sherlock 역추적): 채워진 lemma 100% 가 **완전한 사전 표제어**(v_level+classified_by+meaning_ko). 88% `lemma=lower(word)`(표면형이 표제어), 12% 환원(그 중 46%만 en_inflection_bases 로 재현 가능, 나머지는 ingest winkNLP). 안전 backfill = `word-self(완전) → en_inflection_bases base(완전) → NULL`. 멱등(`WHERE lemma IS NULL`). 9124af41 적용 → 93.6%(6,635/7,089). 결과: 후보 P75=2,387/P80=1,847(percentile 반영), seed 파생어 198 후보 포함.

**재발 방지 완료(2026-05-31)**: `backfill_book_lemmas(uuid)` 함수(멱등·service_role) 신설 + `/api/lcp/process`·`dev-process` 의 `collect_archaic_candidates` 직전에 best-effort 호출 wiring. 신규 도서는 ingest 시 자동 lemma backfill → 동일 문제 차단. 또한 9124af41 잔여 미바인딩 정리: 실재 고어 4 seed + 비영어 14 noise_blacklist(불어 foreign_word + OCR corrupt_token 신규 카테고리) → genuine_miss 18→0.

**재발(2026-06-13) + 추출시점 self-heal 게이트**: 위 wiring 에도 Les Misérables(2ee87d41, 364장)가 **0 bound 로 재발** — 수동 재분절(reprocess-book.mjs / 수동 Claude 드레인) 경로는 route 의 backfill 을 안 타거나 대규모에서 best-effort 실패. backfill 재실행 → 0→11,808(88.4%), Twenty years after 6,759→6,919. **항구 차단**: migration `20260613022941_extract_admin_self_heal_lemmas` — `extract_book_vocabulary_admin` 시작부에 `PERFORM backfill_book_lemmas(p_book_id)` 추가(멱등). 이제 **소비 시점(추출)에서 자동 복구**되므로 어떤 ingest 경로로 깨졌든 무관. 주의: 추출 SSoT `select_book_chapter_vocab` 는 `COALESCE(bv.lemma, bv.word)` 라 base 형은 lemma NULL 이어도 추출됨 — NULL 의 실제 손실은 굴절형 + `find_unbound_book_lemmas` 진단 부풀림 + `compute_book_coverage` NULL.

