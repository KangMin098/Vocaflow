> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_dict_context_sense_matching.md
> category: project

---

**v06.225 (2026-07-12)** 큐레이션 단어추출의 sense/POS 오정렬 근본 근절.

**근본 원인**: `shared_dictionary`는 **단어당 1행 + v_level=최난이도 sense** 기준. 다의어가 기본 sense(저-V)+고급 sense(V≥6)를 가지면 행 v_level=고-V → 텍스트가 기본 용법을 써도 V≥6 필터 통과 → 고급 gloss로 오추출(B류). creep="변태"류(A류, primary 오선정)와는 별개 아키텍처 문제.

**해결(Phase 2·3)**:
- **Phase 2**: `library_book/article_vocabularies.context_pos` 컬럼(마이그 `20260712160000`). 백필 `scripts/backfill-context-pos.mts`(winkNLP로 first_sentence 태깅, multi-POS 단어만; book 1,507·article 212). 파이프라인 forward-wiring: `extract-lemmas.ts`가 chapter 지배 POS 계산 → `ChapterWord.context_pos` → `insert_book_analysis` RPC(`20260712170000`) + article 직삽입 → **신규 도서 자동**.
- **Phase 3**: `select_book_chapter_vocab`+`select_article_vocab`에 LATERAL JOIN(`20260712165000`) — `context_pos`로 `meanings_ko`에서 문맥 POS 일치 sense 선택 → **그 sense의 v_level로 V≥6 필터** + 그 sense gloss·pos 표시. NULL은 row 값 폴백(하위호환).

**sense별 v_level 모델**: `meanings_ko` 각 sense에 `v_level` 필드 추가. 예 `sole=[{adj,유일한,v5},{noun,발바닥,v6},{noun,서대,v9}]`. 수리 누적 17단어.

**검증**: creep(문맥 verb)→"기어가다" · sole(문맥 adj·v5)→Gibbon/Les Mis 추출 0건(기본용법 오추출 근절 실증).

**잔여(자동화)**: 488 study-word 후보 배치 Claude 재검수(sense별 v_level·누락 sense 보강) — 탐지기 `scripts/audit-dict-pos-mismatch.mts`가 후보 자동생성, `dict-enrich` 스킬 배치. 상세 `docs/proposals/dict-sense-quality-audit.md`.

관련: [[book_vocab_ssot_unify]] [[project_extraction_pipeline_p1_p4]] [[project_book_dict_registration_process]]

