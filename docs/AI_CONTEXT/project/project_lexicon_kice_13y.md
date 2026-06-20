> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_lexicon_kice_13y.md
> category: project

---

# Lexicon v2.2 — KICE 13y CSAT ingest (완료 2026-05-20)

Sprint `feature/lexicon-v2.2-kice-13y` → PR #18 squash-merged to main as `7668280` (2026-05-20). 원격 브랜치 자동 삭제. worktree `C:\Users\kille\Vocaflow-kice` 는 보존 (추후 연도 추가 시 재사용).

## 산출물 — DB

- `word_lexicon`: **5,421 rows** (KICE 13y 통합, POS = n/v/adj/adv/prep/conj/phrase)
- `lexicon_source_tags`: 5,421 row · 모두 `source='kice_csat'` · metadata 에 years_appeared / question_history / kice_difficulty_per_year / meanings_by_year
- `word_frequency_stats`: 5,421 row · Tier 4 = 382 / T3 = 1,293 / T2 = 3,746 (T5 = 0)
- `frequency_data_sources.kice_csat`: citation = '한국교육과정평가원 대학수학능력시험 영어 영역 2014~2026 (13개년)', license = 공공누리 제1유형
- `kice_csat_load_history`: 1 row (sprint audit)
- `shared_word_sets` 자동 큐레이션 5종 (모두 `is_published=false` · 큐레이터 검토 대기):

| subcategory | slug | rows |
|---|---|---|
| frequent_8plus | `kice-frequent-8plus` | 15 |
| frequent_tier4 | `kice-frequent-tier4` | 382 |
| q31_34_blank | `kice-q31-34-blank` | 462 |
| q41_43_long | `kice-q41-43-long` | 245 |
| q18_24_purpose | `kice-q18-24-purpose` | 383 |

## 핵심 사실 (추후 sprint 가 기억해야 할 데이터 분포)

- **max raw_count = 9** (단어가 13년 중 최대 9년 출현). `define|v`, `perception|n`, `immediate|adj` 3 단어만 9년 출현.
- **appears_every_year = true: 0건** — 13년 모두 출제된 단어 없음. 트리거 정상 작동, 데이터 사실.
- 핸드오프 원안의 `absolute_13y` (13/13) / `tier5_high_freq` (raw≥10) 큐레이션은 빈 단어장이 되므로 → `frequent_8plus` / `frequent_tier4` 로 재정의됨.
- Old (2014-18) vs Modern (2019-26) lemma overlap = 994 (37%) — 자료 작성자 추출 기준 차이가 큼.

## 추후 새 연도 추가 (예: 2027) 재실행 절차

[[memory_supabase_migrations]] 정합 — apply_migration 은 사용자 승인 필요.

1. `data/seed/kice-csat/` 에 `2027_수능영어_*.xlsx` 추가
2. `cd C:\Users\kille\Vocaflow-kice && pnpm tsx scripts/lexicon-v2.2/kice-csat-parse.ts`
3. `pnpm tsx scripts/lexicon-v2.2/kice-csat-aggregate.ts` → year_from=2014, year_to=2027 자동 갱신
4. `pnpm tsx scripts/lexicon-v2.2/kice-csat-seed.ts --dry-run` → `--commit` (멱등 — `ON CONFLICT (lemma, part_of_speech)`)
5. SQL: `SELECT subcategory, regenerate_auto_curated_set(id) FROM shared_word_sets WHERE category='csat' AND auto_curated=true;`

ETL 멱등 안전. 같은 (lemma, pos) 는 UPSERT, 같은 (lexicon_id, source, year_from, year_to) 는 freq_stats UPSERT.

## 파서 특징 (재사용 주의사항)

- 2014~2018 파일은 다중 시트 (요약 + 기본 + 중급 + 고급). 파서가 자동 헤더 탐지 + "요약" 시트 skip.
- 2014 A형 + B형 + 2018 어휘목록 + 어휘분류 = 한 연도 다중 파일도 자동 통합 (year 매칭 + Phase 2 (lemma, pos) dedup).
- 출제 문항 컬럼 "1번/40번" multi-parse → `question_history` JSONB.
- POS 정규화: `v.`, `v`, `v/n`, `v./n.` 모두 v2.1 CHECK 통과 형태로 매핑.

## 환경

- Worktree: `C:\Users\kille\Vocaflow-kice` (origin/main 기반, gitignored `.env.local` 은 메인에서 복사 필요)
- Branch: `feature/lexicon-v2.2-kice-13y` · commit `7510737` · pushed
- 메인 작업 트리 `C:\Users\kille\Vocaflow` 의 Pipeline1 branch + 다수 unstaged/untracked 는 별개 작업 (LCP RSS / Workspace UI / P5 dict-fill 등) — 본 sprint 가 건드리지 않음
- 마이그레이션 #6 (시드) 은 `shared_word_sets.slug` NOT NULL 컬럼 누락으로 1차 실패 → 재시도 시 `slug='kice-<subcategory>'` 추가하여 성공. worktree 파일도 sync 됨.

[[project_supabase]] · [[feedback_supabase_migrations]] · [[feedback_neutral_terms]]

