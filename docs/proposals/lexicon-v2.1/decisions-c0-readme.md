# C-0 README 4건 의사결정 (A 단계 확정)

C-0 검증을 거쳐 A 단계에서 확정한 결정 사항. `schema-v2.1.sql` 에 직접 반영됨.

## 결정 1 — `meaning_ko_alt` 자료형 → `TEXT[]` 유지

| | |
|---|---|
| **선택** | `TEXT[]` (PostgreSQL 배열) |
| **대안** | `JSONB` (`["뜻1", "뜻2"]`) |
| **이유** | 보조 의미는 단순 순서 배열. JSONB 는 다국어 확장이나 구조 추가 시 유리하나 현 요구에 과잉. `gin (meaning_ko_alt)` 인덱스로 `ANY(...)` 검색 성능 확보. |
| **트레이드오프** | 다국어 확장 시 `meaning_en_alt` 등 컬럼 추가 필요. 그 시점에 JSONB 로 마이그레이션 검토. |
| **DDL 반영** | `word_lexicon.meaning_ko_alt TEXT[]` + `idx_lexicon_alt_gin` GIN 인덱스. |

## 결정 2 — `appears_every_year` 별도 컬럼 + 트리거 자동 계산

| | |
|---|---|
| **선택** | `word_frequency_stats.appears_every_year BOOLEAN` 별도 컬럼, `auto_compute_freq_fields()` 트리거가 `metadata.years_appeared` 길이와 `(year_to - year_from + 1)` 비교해 자동 채움. |
| **대안 A** | `metadata.appears_every_year` JSONB 내부. 쿼리 시마다 추출. |
| **대안 B** | `GENERATED ALWAYS AS ... STORED`. PG12+ 가능하지만 JSONB → INT[] 변환이 `IMMUTABLE` 보장 어려움 (CLAUDE.md §18.9 BLOCKER 1·2 사례 — LCP 파이프라인에서 GENERATED + 비-IMMUTABLE 충돌 경험). |
| **이유** | 자주 쿼리 (수능 매년 출제 단어 필터). JSONB 내부보다 컬럼이 인덱스 효율 우수. 트리거 채택은 LCP 의 `kr_safe` / `search_vector` 트리거 전환 패턴과 동일. |
| **DDL 반영** | `appears_every_year BOOLEAN DEFAULT false` + 부분 인덱스 `WHERE appears_every_year = true` + `trg_freq_auto_compute` 트리거. |

## 결정 3 — Tier 1 (raw_count = 0) row 생성 안 함

| | |
|---|---|
| **선택** | `word_frequency_stats.raw_count INT CHECK (raw_count > 0)` 강제. |
| **이유** | "수능 미출제 = NCIC 만 등록" 은 `lexicon_source_tags` 에 `kice_csat` 태그 부재로 derive 가능. row 생성은 데이터 의미 X + 불필요한 6,000+ 빈 row. |
| **UI 표시** | freq_stats 없음 → "NCIC 어휘 (수능 미출제)" 라벨. `compute_frequency_tier()` 는 `raw_count=0` 입력 시 NULL 반환 (방어). |
| **샘플 영향** | sample CSV 의 `diligent` / `hometown` (raw=0) 2건은 `word_lexicon` + `lexicon_source_tags(ncic_basic)` 까지만 적재. `validate-sample.sql` 검증 6-4 가 이 케이스 확인. |

## 결정 4 — `citation` → `frequency_data_sources` 마스터 분리

| | |
|---|---|
| **선택** | `frequency_data_sources(id, source_key, citation, license, url)` 마스터 + `word_frequency_stats.data_source_id SMALLINT FK`. |
| **이유** | 동일 citation 문자열이 6,000+ row 에 반복 = 비효율 + 라이선스 변경 시 일괄 갱신 어려움. 마스터 분리로 단일 진실 소스. 시드 6 row 사전 등록 (kice_csat / kice_csat_recent / kice_mock / ebs_textbook / academic_paper / coca). |
| **부수 변경** | `word_frequency_stats.source TEXT` 컬럼 의도적 중복 유지 — `UNIQUE (lexicon_id, source, year_from, year_to)` 제약 표현 + 자주 쓰는 필터의 JOIN 회피. application 코드는 항상 `frequency_data_sources` 와 JOIN 해 citation 노출. |
| **트레이드오프** | source_key 가 두 곳에 존재 → INSERT 시 일치 책임은 시드 스크립트. 트리거로 강제할 수 있으나 추가 복잡도 vs 운영 빈도 낮음으로 미채택. |

## 부수 — 이전 결정 재확인

| # | 항목 | 결정 | 반영 위치 |
|---|---|---|---|
| 5 | Tier 경계 | 절대 (a): ≥10 / 4-9 / 2-3 / 1 | `compute_frequency_tier()` |
| 6 | Lemmatizer | winkNLP (`eng-lite-web-model`) | C 단계 파이프라인 (별도 PR) |
| 7 | `metadata JSONB` | 추가 | `word_frequency_stats.metadata` + `idx_freq_metadata_gin` |
