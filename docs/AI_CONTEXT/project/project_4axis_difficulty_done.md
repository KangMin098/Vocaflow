> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_4axis_difficulty_done.md
> category: project

---

라이브러리 도서 4축 난이도 지수 인프라 완성 (2026-05-25) — CLAUDE.md v06.29 등재.

## 4축 + DB 위치

| 축 | 컬럼 | 출처 |
|---|---|---|
| V-Level Centroid | `library_books.book_v_level` + `v_level_centroid_precise` + `vrl_components` | `compute_book_vrl()` (기존) |
| CEFR 6-band | `library_books.cefr_band` (GENERATED ALWAYS STORED) | `cefrj_level` 12-band 에서 자동 파생 |
| CEFR-J 4-band | `shared_dictionary.cefrj_wordlist_band` + `cefrj_domain_tags` | CEFR-J Wordlist v1.6 외부 표준 |
| Flesch-Kincaid | `library_books.flesch_kincaid_grade` + `flesch_reading_ease` + `readability_computed_at` | `scripts/book-readability.mjs` |

## 적용된 Migrations

- `phase3_cefrj_multi_source_v1` — `library_books`에 cefrj_level/cefrj_confidence/v_level_centroid_precise + `library_source_catalogs.cefrj_auto_assign_tier` (S/A/B/C/M) + `compute_book_cefrj()` + `bulk_compute_cefrj_for_all_sources()`
- `phase3_four_axis_difficulty_v1` — `shared_dictionary` CEFR-J 컬럼 + `library_books.cefr_band` (generated) + F-K 2종

## 적재 인프라 (재사용 가능)

- `scripts/cefrj-import.mjs` — JSONL → `_staging_cefrj_wordlist` 배치 upsert (멱등)
- `scripts/book-readability.mjs` — F-K backfill (`--book-id <uuid>` 지원)
- `data/import/cefrj/cefrj_wordlist_v1.6_normalized.jsonl` — 7,035 unique lemma (재실행 source)
- `data/import/cefrj/CEFR-J Wordlist Ver1.6.xlsx` — 원본 (1MB, gitignored via `data/import/*`)

## CEFR-J Wordlist v1.6 적재 결과

- 7,988 entries → normalize → 7,035 unique lemma
- shared_dictionary 매칭 6,098/7,035 = **86.7%** (미매칭 937 = contraction·복합어·고유명사)
- 분포: A1=1,023 / A2=1,194 / B1=1,931 / B2=1,950

## V-Level ↔ CEFR-J 외부 정합 매트릭스 (★ 학술 검증)

- V1 → A1 dominant (76%)
- V2 → A1+A2 dominant (76%)
- V4 → A2+B1 dominant (80%)
- V6 → B1+B2 dominant (92%)
- V7 → B2 dominant (63%)
- V8~V11 → B2 only (wordlist B2 cap)

V-Level 시스템이 CEFR-J 4-band 표준과 monotonic 정합 — 외부 학술 검증 완료.

## 5권 backfill 실측

| Title | V | Centroid | CEFR-6 | CEFR-J 12 | F-K Grade | F-K Ease |
|---|---|---|---|---|---|---|
| Alice's Adventures | 6 | 3.63 | B1 | B1.1 | 10.54 | 69.7 |
| Frankenstein | 8 | 4.90 | B2 | B2.1 | 10.74 | 61.2 |
| Pride and Prejudice | 8 | 4.56 | B2 | B2.1 | 12.44 | 54.9 |
| Sherlock Holmes | 8 | 4.61 | B2 | B2.1 | 9.03 | 70.1 |
| Dorian Gray | 8 | 4.60 | B2 | B2.1 | 6.22 | 76.6 |

Huck Finn 은 chapters/vocabularies 모두 미적재 → import 미완 도서, 4축 backfill skip.

## 주요 정책 (CLAUDE.md §"라이브러리 도서 난이도 지수")

- **Tier 1 (적용)**: 4축 모두 — 단일 지수 의존 금지
- **Tier 2 (Phase 2 검토)**: Spache(V0-V3 정밀도) · ARI · Coleman-Liau — 베타 perceived difficulty 설문 후 결정
- **Tier 3 (B2B 진입 시)**: Lexile · ATOS · Coh-Metrix
- **LibraryCard 표시**: 메인 `cefr_band + book_v_level` 2개 / detail 4축
- **Citation 의무**: "The CEFR-J Wordlist Version 1.6. Compiled by Yukio Tono, Tokyo University of Foreign Studies." — Library detail footer + CLAUDE.md
- **`cefrj_level` 12-band 은 internal heuristic** (Wordlist 4-band 만 외부 표준 보증) — 표기 시 주의

## 안티패턴

- 단일 지수 의존
- `cefrj_level` 12-band 를 CEFR-J 공식 표준으로 표기 (Wordlist 는 4-band 만)
- LibraryCard 메인에 F-K 노출 (인지부담)
- 검수 강도 평준화 (Tier S/A/B/C/M 차등 유지)

## 잔여 (후속 작업)

- `/admin/curation` UI 4축 컬럼 + source filter tab + CEFR-J 라벨 보정 UI
- `/admin/vrl/automation` 도서 큐레이션 카드
- Huck Finn import 완성 (chapters + vocabularies → 4축 자동 backfill)
- 베타 perceived difficulty 설문 (30명) — Tier 2 도입 결정 근거

관련: [[project_library_books_v_level_poc]], [[project_phase3b_lemma_backfill_books]]

