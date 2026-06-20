> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/feedback_auto_curate_book_is_gating.md
> category: feedback

---

`auto_curate_book(p_book_id uuid)` 는 함수명과 달리 **단어장 생성 함수가 아님**. 본문 실측 결과:

```
IF cefr_confidence ≥ 0.85 AND kr_safe AND chapters 1-100
   AND word_count ≥ 1000 AND lbv_count ≥ 50
THEN  status='published'  → 'auto_publish'
ELSIF cefr_confidence ≥ 0.60 AND kr_safe
THEN  status='ready'      → 'admin_review'
ELSE  status='failed'     → 'reject'
```

`library_books` UPDATE 1건만. `shared_word_sets`/`shared_words` INSERT 0건.

**Why:** 정찰 라운드에서 함수명만 보고 "큐레이션 진입점" 으로 추정한 1차 정찰 오류가 발견됨 — 2차 정찰 (`pg_get_functiondef` 본문 확인) 으로 정정. 함수 11종 "완비" 결론이 추측이었고 실제 INSERT 함수는 0건.

**How to apply:**
- 도서 → 단어장 발행은 **`publish_book_word_sets(p_book_id uuid)`** 사용 ([[library-chapter-word-sets]])
- `auto_curate_book` 은 status 자동 평가 용도만 (이미 published 도서에 재호출 시 cefr_confidence 등 재평가로 강등 위험)
- 함수 역할 정찰 시 이름 추정 금지 — `pg_get_functiondef(oid)` 본문 확인 필수
- 모든 정찰 agent 결론은 "본문 확인 여부" 명시해야 신뢰 가능

