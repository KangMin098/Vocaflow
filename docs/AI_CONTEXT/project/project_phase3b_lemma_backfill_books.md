> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_phase3b_lemma_backfill_books.md
> category: project

---

# Phase 3B — Lemma Backfill + Book Score (2026-05-25)

## library_book_vocabularies lemma 백필

L2 inflections 역매핑으로 NULL 4,627 → 1,830 회수. 전체 coverage 79.23% → **91.78%** (+12.55%p).

```sql
UPDATE library_book_vocabularies bv SET lemma = sd.word
FROM (
  SELECT DISTINCT ON (bv2.id) bv2.id AS bv_id, sd2.word
  FROM library_book_vocabularies bv2
  JOIN shared_dictionary sd2 ON sd2.inflections @? format('$.forms[*].form ? (@ == "%s")', bv2.word)::jsonpath
  WHERE bv2.lemma IS NULL AND sd2.v_level IS NOT NULL
  ORDER BY bv2.id, sd2.frequency_rank ASC NULLS LAST
) sd WHERE bv.id = sd.bv_id;
```

## library_books book_vrl_score + lexile_measure 적용

5권 모두 통합 분류 완성:

| 도서 | V-Level | vrl_score | Lexile |
|---|---|---|---|
| Alice (Carroll) | V6 | 63 | 800L |
| Frankenstein | V8 | 90 | 1000L |
| Dorian Gray (Wilde) | V8 | 88 | 1000L |
| Sherlock Holmes (Doyle) | V8 | 88 | 1000L |
| Pride and Prejudice (Austen) | V8 | 88 | 1000L |

공식:
- `book_vrl_score = clamp(P75 * 10 + ROUND((weighted_avg - 3) * 5), 0, 100)`
- `lexile_measure = 200 + P75 * 100` (rough mapping, lexile_source='estimated_from_v_level')

## TS 타입 재생성

`packages/types/src/database.ts` 전체 재생성 — Supabase MCP `generate_typescript_types` 사용.

에러 65 → 30 (-54%). 남은 30개는 사전 미해결 부채 (automation/page.tsx Promise vs PromiseLike + 일부 schema mismatch).

## /admin/pending-words 페이지

`app/admin/pending-words/page.tsx` 신규 — Server Component, KPI 4 (대기/추가/encounter/최다) + 200 row 테이블 (lemma · encounter · status · admin_note · updated). revalidate=30s 운영 큐.

AdminSidebar `사용자 & 콘텐츠` 그룹에 'Pending Words' (Database 아이콘) 추가.

## 잔존

- Phase 2 admin 액션 wire-up (검토중/AI 분류/거절/추가) — 현재 read-only
- 30개 TS 에러: `admin/vrl/automation/page.tsx` PromiseLike 캐스팅 + 일부 schema gap
- library_book_vocabularies lemma NULL 1,830 (8.22%) — shared_dictionary 미수록 (pending_words 큐로 수동 보강 대상)

