# sample_kice_frequency.csv — 컬럼 사전 & 데이터 정의

C-0 산출물. v2.1 스키마 (`word_lexicon` + `lexicon_source_tags` + `word_frequency_stats`) 의
컬럼 적합성을 검증하기 위한 20개 단어 수동 샘플 (실제 row 수 22 — 다품사 분리 포함).

스키마 확정 (A 단계) 진입 전 fit 검증이 목적이며, 빈도 수치는 추정값으로 실제 KICE 분석
파이프라인 (C-2 / C-3) 산출과 다를 수 있습니다.

## 컬럼 사전

| 컬럼 | 타입 | 적재 대상 | 비고 |
|---|---|---|---|
| `lemma` | TEXT | `word_lexicon.lemma` | 소문자, lemmatized |
| `pos` | TEXT | `word_lexicon.part_of_speech` | n/v/adj/adv/... — winkNLP POS 출력 정합 |
| `meaning_ko` | TEXT | `word_lexicon.meaning_ko` | 한국 교과서 기준 1순위 의미 |
| `meaning_ko_alt` | TEXT (세미콜론 구분) | `word_lexicon.meaning_ko_alt` (TEXT[]) | 적재 시 `string_to_array(';')` |
| `ipa` | TEXT | `word_lexicon.ipa` | 국제음성기호 |
| `cefr` | TEXT | `word_lexicon.cefr_level` | A1~C2 |
| `ncic_grade` | TEXT | `lexicon_source_tags.metadata->>grade` | elementary/middle/high_common/high_extended |
| `kice_raw_count` | INT | `word_frequency_stats.raw_count` | 0이면 word_frequency_stats row 생성 안 함 |
| `kice_years_appeared` | TEXT (세미콜론 구분) | `word_frequency_stats.metadata.years_appeared` | INT[] 로 변환 후 JSONB 배열 |
| `csat_first_year` | INT | `lexicon_source_tags.metadata->>first_year` (kice_csat) | 미출제어는 NULL |

## 선정 기준 (22행)

### 빈도 5단계 분포
| Tier | raw_count 범위 | 행 수 | 단어 예시 |
|---|---|---|---|
| 5 | ≥ 10 | 6 | ability(47) · adapt(34) · acquire(29) · run.v(22) · accomplish(18) · adolescent(15) |
| 4 | 4~9 | 7 | present.v(13) · abandon(12) · advocate(11) · bear.v(9) · adequate(8) · bank(7) · aesthetic(6) |
| 3 | 2~3 | 5 | present.adj(5) · run.n(4) · abrupt(3) · arbitrary(3) · ambiguous(2) |
| 2 | 1 | 2 | bear.n(1) · benevolent(1) |
| 1 | 0 (NCIC만) | 2 | diligent(0) · hometown(0) |

### 다품사 케이스 (winkNLP POS 분리 정확도 검증용)
- `bear.v` (참다, B1, 9회) vs `bear.n` (곰, A2, 1회)
- `run.v` (달리다, A1, 22회) vs `run.n` (달리기, B1, 4회)
- `present.adj` (현재의, A2, 5회) vs `present.v` (제시하다, B1, 13회)

### 다의어 케이스 (`meaning_ko_alt` 검증)
- `bank` (은행 / 강둑)
- `run.v` (달리다 / 운영하다 / 흐르다)
- `present.v` (제시하다 / 선물하다 / 발표하다)
- `bear.n` (단일 의미만 — 빈 칸 유지)

### CEFR 분포
- A1: 1 / A2: 4 / B1: 5 / B2: 6 / C1: 6 / C2: 0

### NCIC 학교급 분포
- elementary: 4 / middle: 5 / high_common: 4 / high_extended: 9

## 적재 변환 규칙

```
CSV → DB 변환 (validate-sample.sql 에서 수행)

1. word_lexicon
   - (lemma, pos) UPSERT
   - meaning_ko_alt: string_to_array(meaning_ko_alt, ';')  -- 빈 문자열 → NULL

2. lexicon_source_tags  (source = 'ncic_basic')
   - metadata: jsonb_build_object('grade', ncic_grade)
   - 모든 행 (ncic_grade 가 NOT NULL 이므로 22개 전부)

3. lexicon_source_tags  (source = 'kice_csat')
   - kice_raw_count > 0 인 행만 (20개 — diligent / hometown 제외)
   - metadata: jsonb_build_object('first_year', csat_first_year)

4. word_frequency_stats  (source = 'kice_csat_recent', 2014~2024)
   - kice_raw_count > 0 인 행만 (20개)
   - raw_count = kice_raw_count
   - metadata: jsonb_build_object(
       'years_appeared', string_to_array(kice_years_appeared, ';')::int[],
       'appears_every_year', (array_length(...) = 11)
     )
   - frequency_tier: 트리거에서 자동 계산
```

## 검증 후 의사결정 항목 (A 단계로 이월)

샘플 적재·검증 후 다음 4건을 A 단계 최종 DDL에서 결론:

1. **`meaning_ko_alt` 자료형** — 현재 `TEXT[]`. JSONB 로 전환하면 다국어 확장 시 유리하나 단순 배열에는 과설계. → `TEXT[]` 유지 권장.

2. **`appears_every_year` 자동 계산 위치** — staging UPSERT 시점 계산 vs DB 트리거. 트리거가 single source of truth 보장에 유리.

3. **Tier 1 (raw_count = 0) 행 처리** — `word_frequency_stats` 에 row 생성 안 함이 자연스러움. "미출제" 여부는 `lexicon_source_tags` 에 `kice_csat` 태그 부재로 derive.

4. **`citation` 중복 저장** — 모든 row 에 "KICE 2014-2024 자체 분석" 반복되면 정규화 후보. `frequency_data_sources(source_id, citation, license, url)` 마스터 분리 검토. 출처 3종 미만이면 컬럼 유지가 단순.
