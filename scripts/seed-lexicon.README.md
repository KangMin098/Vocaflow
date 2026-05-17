# seed-lexicon.mjs

Lexicon v2.1 시드 스크립트 — CSV → 3 테이블 멱등 upsert.

## 위치

`scripts/seed-lexicon.mjs`

## 사용법

### dry-run (DB 접속 없이 검증만)

```bash
node scripts/seed-lexicon.mjs --dry-run
# 또는 verbose
node scripts/seed-lexicon.mjs --dry-run --verbose
```

dry-run 시:
- CSV 파싱 + 행별 validation (lemma 정규화, pos 화이트리스트, CEFR, ncic_grade)
- payload 변환 시뮬레이션 (각 Phase 의 row 수 출력)
- DB 접속 없이 동작 (env 없어도 OK)

### 실적재 (LIVE)

`.env.local` 에 `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` 설정 후:

```bash
node scripts/seed-lexicon.mjs
```

### 옵션

| 옵션 | 기본값 | 설명 |
|---|---|---|
| `--csv <path>` | `data/seed/sample_kice_frequency.csv` | 입력 CSV 경로 |
| `--dry-run` | false | DB 접속·변경 없이 검증만 |
| `--batch-size <n>` | 100 | upsert batch 크기 |
| `--verbose`, `-v` | false | sample payload + warnings 출력 |

## 사전 조건

1. `schema-v2.1.sql` 적용 완료 (4 신규 테이블 + 트리거 + `frequency_data_sources` 6 row 시드)
2. `data/seed/sample_kice_frequency.csv` 존재 (22 row)
3. `service_role` 권한 (RLS 우회 — INSERT/UPDATE 필요)

## 멱등성

동일 CSV 재실행 시 변경 없음:

- `word_lexicon`: `ON CONFLICT (lemma, part_of_speech)` → `meaning_ko/meaning_ko_alt/ipa/cefr_level` UPDATE
- `lexicon_source_tags`: `ON CONFLICT (lexicon_id, source)` → `metadata` UPDATE
- `word_frequency_stats`: `ON CONFLICT (lexicon_id, source, year_from, year_to)` → `raw_count/metadata` UPDATE

`frequency_tier`, `appears_every_year` 는 트리거가 자동 계산하므로 payload에 포함하지 않음.

## 처리 흐름

```
CSV 22 row
   ↓ validateRow() — lemma 정규화, pos 화이트리스트, CEFR/grade 검증
   ↓
[Phase A] word_lexicon upsert (22 row)
   ↓ lexiconIdMap: "lemma|pos" → id
   ↓
[Phase B] lexicon_source_tags upsert (42 row = NCIC 22 + KICE 20)
   ↓ KICE 는 raw_count > 0 인 행만
   ↓
[Phase C] word_frequency_stats upsert (20 row)
   ↓ raw_count = 0 → SKIP (결정 3)
   ↓ trigger 가 frequency_tier / appears_every_year 자동 계산
   ↓
[Validation] post-load
   - word_lexicon total count
   - frequency_tier NULL 검사 (트리거 동작 확인)
   - Tier 분포 출력
```

## 22 row 샘플 적재 예상 결과

```
word_lexicon          : 22 rows  (lemma+pos UNIQUE)
lexicon_source_tags   : 42 rows  (NCIC 22 + KICE 20)
word_frequency_stats  : 20 rows  (raw_count > 0)

Tier 분포 (기대):
  Tier 5 : 6   (raw_count ≥ 10)
  Tier 4 : 7   (raw_count 4~9)
  Tier 3 : 5   (raw_count 2~3)
  Tier 2 : 2   (raw_count = 1)
  Tier 1 : 0   (CHECK > 0 로 row 미생성)
```

## dict-common.mjs 통합

`makeClient()` · `arg()` · `VALID_CEFR` 를 `./dict-common.mjs` 에서 import. 다른 dict-* 스크립트와 env 로드 방식 통일.

## 제한사항 / 향후

| 항목 | 현재 | 향후 |
|---|---|---|
| Phase 간 트랜잭션 | 없음 (Phase 별 독립) | 단일 RPC 함수로 트랜잭션화 |
| 부분 실패 시 rollback | 자동 X (재실행으로 복구) | RPC 트랜잭션 |
| 진행률 표시 | batch 단위 로그 | progress bar |
| 출처 확장 | KICE only | EBS/COCA source_key 별 분기 |
| CSV 파싱 | 자체 (quote 미지원) | `csv-parse` 도입 검토 |

## 검증 한계

본 스크립트는 다음만 검증됨:
- ✅ Node 문법 (`node --check`)
- ✅ CSV 22 row 파싱
- ✅ dry-run 전체 흐름 (Phase A 22 / B 42 / C 20 정확)

다음은 별도 검증 필요:
- ❌ 실 Supabase 환경 적재
- ❌ trigger 자동 계산 결과 (`compute_frequency_tier`)
- ❌ `ON CONFLICT` 멱등성 (재실행 시 변경 없음)
- ❌ RLS 정책과 service_role 권한 상호작용
