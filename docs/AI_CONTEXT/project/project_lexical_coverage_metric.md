> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_lexical_coverage_metric.md
> category: project

---

2026-06-06 — 도서별 **미지어 커버리지(i+1) 지표** 신설. V-level 평가에서 "② 미지어 커버리지" 옵션 선택 후 구현.

- **DB**: `library_books.lexical_coverage jsonb` + `compute_book_coverage(p_book_id)` RPC. `coverage[L]` = "V레벨 L 학습자가 아는 토큰 %" = `sum(freq) FILTER (v_level<=L) / total`, L=1..10. 91/93 backfill. `process`/`dev-process` 파이프라인이 `compute_book_cefrj` 직후 호출(자동 갱신).
- **판정 단일 출처**: `lib/library/i-plus-one.ts` `judgeIPlusOne(coverage, vLevel)` → `{coverage, tier, label, color}`. 임계 경계 85/95 를 **admin 과 user 가 공유**(큐레이터 기준=학습자 기준). 4 tier: ≥98 수월(중립) / 95–98 딱맞아요(green) / 85–95 도전적(amber) / <85 어려워요(red). 미진단(V0)·데이터없음 → null.
- **Admin**: `BookDetailModal` 4축 난이도 섹션에 `CoverageCurve`(V4–V10 색코딩).
- **User**: `/library/books` page 가 `user_profiles.current_v_level` + `lexical_coverage` fetch → `LibraryGrid` 캐러셀 히어로 배지 + `NetflixDetailSheet` `IPlusOneRow`(진행막대+격려문구, 미진단 시 /diagnostic 유도).

**중요 결정**: coverage 는 **도서 레벨** 지표라 `recommend_word_sets_for_user`(단어장=V레벨 필터 리스트, 토큰 분포 없음)엔 **부적합** → 단어장 추천엔 미적용, 도서 브라우징에만. 임계값(85/95)은 미검증 — 큐레이션 누적 후 `compute_book_coverage` 임계만 조정하면 admin·user 동시 반영. 관련: [[project_4axis_difficulty_done]].

