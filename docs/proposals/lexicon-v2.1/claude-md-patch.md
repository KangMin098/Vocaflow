# CLAUDE.md 패치 (D 단계에서 적용)

`CLAUDE.md` §"🗄 Supabase DB 스키마" 섹션에 v2.1 lexicon 시스템을 정식 SSoT 로 등재.

## 변경 위치

§"🗄 Supabase DB 스키마" 의 §"영단어 마스터 사전 시스템 (v06.23 신설 · v06.24 한국어 뜻 100% 완성)" 직후에 새 서브섹션 추가.

## 추가 내용 (그대로 붙여넣기)

```markdown
### 한국 학습자 어휘 시스템 (v2.1 — NCIC + KICE 빈도 통합)

`shared_dictionary` (글로벌 영단어 마스터) 와 **별도** 로 한국 교육과정·수능 출제
이력에 특화된 어휘 시스템. 3 테이블 + 1 마스터 + ALTER 로 구성.

#### word_lexicon — 단어 마스터 (lemma + pos 단위)

| 컬럼 | 타입 | 용도 |
|------|------|------|
| `id` | UUID PK | — |
| `lemma` | TEXT | 소문자 정규화 (winkNLP `eng-lite-web-model` 산출) |
| `part_of_speech` | TEXT | 10종 (n/v/adj/adv/prep/conj/pron/det/interj/phrase) |
| `meaning_ko` | TEXT | 한국 교과서 기준 1순위 의미 |
| `meaning_ko_alt` | TEXT[] | 보조 의미 배열 + GIN 인덱스 |
| `ipa` / `pronunciation_us` | TEXT | 발음 |
| `cefr_level` | TEXT | A1~C2 (출처별 다르면 `lexicon_source_tags.metadata` 에서 override) |
| `primary_sentence_id` | UUID FK | `sentences` (v2 1급 엔티티) 참조 — **본문 14_lexicon_v2_1.sql 에는 부재, 15_lexicon_primary_sentence.sql 에서 별도 ADD COLUMN** (sentences 마이그레이션 미적용 환경 호환) |

UNIQUE `(lemma, part_of_speech)` — `run.v` vs `run.n` 같은 동음이의 분리.

#### lexicon_source_tags — 단어↔출처 N:M

`(lexicon_id, source)` 복합 PK. 한 단어가 NCIC + 수능 + EBS 동시 소속 가능.
source enum 7종: `ncic_basic` · `ncic_extended` · `kice_csat` · `kice_mock` ·
`ebs_textbook` · `middle_school` · `high_school`. `metadata` JSONB 에 출처별
부가 정보 (예: NCIC grade, KICE first_year).

#### word_frequency_stats — 출제 빈도 통계

`frequency_data_sources` 마스터 FK + `source` 캐시 + 연도 범위 + raw_count
(`CHECK > 0` — Tier 1 row 미생성). 핵심 컬럼:

| 컬럼 | 자동? | 용도 |
|---|:---:|---|
| `raw_count` | 입력 | 실제 출현 횟수 |
| `normalized_freq` | 입력 | per 10,000 tokens (출처 간 비교) |
| `rank_in_source` | 입력 | UI "수능 빈출 #245" |
| `frequency_tier` | ✅ 트리거 | 절대 경계 (≥10=5 / 4-9=4 / 2-3=3 / 1=2) — UI ★ 배지 |
| `appears_every_year` | ✅ 트리거 | `metadata.years_appeared` 길이가 `(year_to-year_from+1)` 와 같을 때 true |
| `metadata` | 입력 | `years_appeared` INT[] 등 시계열 |

트리거 `auto_compute_freq_fields()` 가 INSERT/UPDATE 시 `frequency_tier` +
`appears_every_year` 자동 채움 (CLAUDE.md §18.9 BLOCKER 1·2 의 GENERATED +
비-IMMUTABLE 충돌 회피 패턴 적용).

#### frequency_data_sources — 빈도 출처 마스터 (정규화)

`source_key` UNIQUE + `citation` + `license` + `url`. 6 row 시드 사전 등록.
공공누리 제1유형 출처 표시 의무는 이 마스터의 `citation` 컬럼이 단일 진실 소스.

#### shared_words 변경

`lexicon_id UUID FK` 추가. 기존 중복 컬럼 (`word` / `meaning_ko` / `example_en`
/ `pronunciation` / `part_of_speech` / `cefr_level`) 은
`migration-shared-words-to-lexicon.sql` Phase D (별도 PR) 에서 DROP.

#### 데이터 흐름

```
NCIC 부록 PDF + KICE 기출 PDF
  → winkNLP 토큰화 + lemmatization
  → CSV staging
  → word_lexicon (UPSERT)
  → lexicon_source_tags (NCIC + KICE 출제 이력)
  → word_frequency_stats (raw_count > 0 만)
  → 트리거가 tier + appears_every_year 자동 채움
```

#### v2.1 안티패턴 (절대 금지)

- `word_frequency_stats.raw_count = 0` row 생성 — CHECK 위반 (결정 3)
- `appears_every_year` 를 application 코드에서 계산 — 트리거가 SSoT (결정 2)
- `citation` 을 freq_stats row 마다 inline 저장 — 마스터 분리 (결정 4)
- `meaning_ko_alt` 를 JSONB 로 전환 — 단순 배열 + GIN 으로 충분 (결정 1)
- `shared_dictionary` 와 `word_lexicon` 혼동 — 전자는 글로벌 캐시, 후자는
  한국 교육과정 특화. 별도 테이블, 별도 책임.
```

## 변경 이력 항목 (CLAUDE.md 맨 아래 변경 이력에 한 줄 추가)

```
**v06.28** §"🗄 Supabase DB 스키마" 한국 학습자 어휘 시스템 v2.1 신설 —
`word_lexicon` (lemma+pos 단위 마스터, TEXT[] meaning_ko_alt + GIN) +
`lexicon_source_tags` (N:M, 7 source enum) + `word_frequency_stats`
(raw_count > 0 CHECK, frequency_tier + appears_every_year 트리거 자동
채움, GENERATED + 비-IMMUTABLE 충돌 회피 패턴 — §18.9 BLOCKER 1·2 정합) +
`frequency_data_sources` (citation 정규화, 6 row 시드: kice_csat /
kice_csat_recent / kice_mock / ebs_textbook / academic_paper / coca) /
shared_words `lexicon_id` FK 추가 (Phase D 별도 PR 에서 중복 컬럼 DROP) /
Tier 절대 경계: ≥10=5, 4-9=4, 2-3=3, 1=2 / Lemmatizer: winkNLP
(eng-lite-web-model) — LCP 파이프라인과 lemma 공간 통일 / 공공누리
제1유형 출처 표시 의무는 `frequency_data_sources.citation` 단일 진실 소스
```

## 마이그레이션 순서 (정정 — corrections-v2.1.md §3 반영)

| # | 파일 | 의존성 |
|---|---|---|
| 12 | `12_sentences_table.sql` ★v2 sentences 1급 엔티티 (userMemories 확정 설계 SQL — **미작성**) | 02 |
| 13 | `13_shared_words_lexicon_id.sql` shared_words.lexicon_id FK 만 ADD (선요건) | 05 |
| 14 | `14_lexicon_v2_1.sql` schema-v2.1.sql 본문 (primary_sentence_id 부재, prereq 체크 + search_path 명시) | 11 + 13 |
| 15 | `15_lexicon_primary_sentence.sql` primary_sentence_id ADD COLUMN | 12 + 14 |
| 16 | `16_shared_words_backfill.sql` Phase A/B/C 백필 (별도 PR) | 14 |
| 17 | `17_shared_words_drop_legacy.sql` legacy 컬럼 DROP (코드 전환 후, 별도 PR) | 16 |

## D 단계 체크리스트 (재구성 — 완료/잔여 분리)

### 완료 (v06.28 적용분)

- [x] markdown 블록을 §"🗄 Supabase DB 스키마" 의 영단어 마스터 사전 시스템 직후에 삽입
- [x] §"📑 도메인 → DB 매핑 요약" 표에 4 신규 테이블 row 추가
- [x] §"📋 마이그레이션 순서" 표 갱신 — 12·13·14·15·16·17 6행 (정정본 반영)
- [x] CLAUDE.md 문서 버전 헤더 v06.27 → v06.28 갱신
- [x] 변경 이력에 v06.28 항목 prepend
- [x] §18.9 BLOCKER 헤더 "14건" → "15건" + #15 한 줄 등재 (search_path 누락 패턴)

### 잔여

- [ ] §"🚫 절대 저장하지 말아야 할 것" 통합 섹션에 v2.1 안티패턴 4건 합치기 (현재 v2.1 서브섹션 내부에만 별도 존재 — 중복 회피냐 통합 위치 노출이냐 선택)
- [ ] `set_updated_at()` 의 search_path 명시 여부 점검 → 누락이면 별도 ALTER FUNCTION 마이그레이션 추가
- [ ] sentences 마이그레이션 (12번) 작성 — userMemories v2 설계의 SQL 구현
- [ ] BLOCKER #15 상세본: `claude-md-blocker-15-patch.md` 참조 — CI 자동 검출 스니펫 도입 검토
