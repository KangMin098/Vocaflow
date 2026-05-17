# Dict-fill Sprint — Top 5K shared_dictionary 빠른 채움 (수정판)

**작성일:** 2026-05-17
**모델:** Claude Opus 4.7 (feedback_best_model 메모리 정합)
**예상 비용:** ~$142 (P1+P2 합계, dry-run 검증 후)
**예상 시간:** ~3시간 (병렬 5)

---

## 1. 배경

### 1a. 이번 sprint 이전 상태 (2026-05-17 기준)

shared_dictionary 22,762 row 중:

| 컬럼 | 채움 | 비율 | 출처 |
|---|---:|---:|---|
| example_en | 1,508 | 6.6% | VCB cast-2000 promote (`scripts/vcb/05e-promote-to-dictionary.mjs`) |
| synonyms | 1,481 | 6.5% | 동일 |
| antonyms | 1,006 | 4.4% | 동일 |
| ipa | 1,508 | 6.6% | 동일 |
| collocations | 1,508 | 6.6% | 동일 |
| register | 1,508 | 6.6% | 동일 |
| korean_learner_note | 1,018 | 4.5% | 동일 |

기존 inflight 작업으로 cast-2000 (1,508 단어) 이미 채움. **P0 (schema + promote) 작업 불필요**.

### 1b. 본 sprint scope — Top 5K 미터치 batch

| 그룹 | 단어 수 | 처리 |
|---|---:|---|
| Top 1K NGSL 미터치 (rank ≤ 1000) | **617** | **P1** (13 chunks × 50) |
| Top 1K~5K NGSL 미터치 (1000 < rank ≤ 5000) | **2,221** | **P2** (45 chunks × 50) |
| Top 5K+ + rank NULL | ~18,416 | 보류 (별도 sprint 또는 lazy) |

**P1+P2 합계: 2,838 단어** (dry-run 2026-05-17 검증)

> P1 카운트가 초기 추정 509 보다 +108 많음 — 그 중 대부분은 VCB enriched 이지만 POS mismatch 로 promote 안 된 lemma. 본 sprint 는 그대로 batch 처리 (작업 중복 비용 ~$5 < 별도 POS 정책 결정 시간).

### 1c. 미매칭 492건 (별도 정책 필요)

VCB cast-2000 의 lemma 중 492건은 dict 와 (word, pos) exact 매칭 실패:
- 대부분 POS mismatch (예: `run` VCB=NOUN, dict 에는 `verb` 만 존재)
- 같은 단어 다른 pos row 신규 INSERT 가 안전한지 정책 필요 (UNIQUE 제약 + 다의어 처리 방향)

→ 본 sprint scope 외. 별도 task 로 결정 후 처리.

---

## 2. Phase 구성

| Phase | 작업 | 단어 수 | 비용 | 시간 |
|---|---|---:|---:|---:|
| **P1** | Top 1K NGSL 미터치 batch | **617** | ~$31 | ~40분 |
| **P2** | Top 1K~5K NGSL 미터치 batch | **2,221** | ~$111 | ~2.5시간 |

비용 산출: Opus 4.7 토큰 단가 기반 cast-2000 실측치 $0.05/lemma.

---

## 3. 사전 결정

| Q | 결정 | 근거 |
|---|---|---|
| Q1 모델 | **Opus 4.7** | feedback_best_model 메모리 강제 |
| Q2 청크 크기 | **50 단어/prompt** | dict-fill 은 출력 5필드 단순 → 청크 키울 수 있음 |
| Q3 병렬 | **wave-size 5** | rate-limit 안전 마진 |
| Q4 재시도 | 청크 단위 2회 | 실패 chunk 는 `last_error` 기록 후 skip |
| Q5 인간 검수 | P1 30 / P2 100 단어 무작위 sample | sprint 종료 전 |

---

## 4. 채울 컬럼 (기존 활용)

| 컬럼 | 타입 | 기존 fill | 출처 |
|---|---|---:|---|
| `example_en` | TEXT | 1,508 | shared_dictionary 원래 컬럼 |
| `synonyms` | TEXT[] | 1,481 | 동일 |
| `antonyms` | TEXT[] | 1,006 | 동일 |
| `ipa` | TEXT | 1,508 | PR #13 추가 |
| `collocations` | TEXT[] | 1,508 | PR #13 추가 |

> `*_filled` 접미사 컬럼 신설 안 함 — 기존 컬럼 직접 UPDATE.

---

## 5. 전체 흐름

```
[Pre-flight]
  - 신규 컬럼 / migration 없음 (PR #13 적용 완료)
  - .env.local 검증 (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

[Phase 1 — Top 1K]
  1. tsx scripts/dict-fill/01-export-job.ts --tier top1k
        → exports/dict-fill/p1-input-NNofMM.jsonl (50 단어 × ~11 청크)
  2. Claude Code: /dict-enrich 청크 fan-out (병렬 5)
        → exports/dict-fill/p1-output-NNofMM.jsonl
  3. node scripts/dict-fill/02-validate-output.mjs exports/dict-fill/p1-output-*.jsonl
  4. tsx scripts/dict-fill/03-import-enriched.ts --tier p1
        → shared_dictionary UPDATE (IS NULL 가드 idempotent)
  5. 검증 SQL — 채움도 ≥ 95%

[Phase 2 — Top 1K~5K]
  같은 흐름. --tier top5k

[Post-sprint]
  - 채움도 확인 (P1+P2 합계 ≥ 95%)
  - 인간 sample 검수 130 단어
  - CLAUDE.md §"🗄 Supabase DB 스키마" shared_dictionary 컬럼 갱신
```

---

## 6. 안전 장치

- **Idempotent UPDATE**: `WHERE word=$1 AND pos=$2 AND <column> IS NULL` — 재실행 안전
- **백업**: PR #13 의 `shared_dictionary_backup_20260516` 가 sprint 시작 시점 fallback
- **비용 cap**: P1 cap $40, P2 cap $150 — 초과 시 자동 중단
- **재시도**: 청크 실패 시 2회 재시도, 그래도 실패면 다른 청크 진행 (block 안 함)

---

## 7. 종료 기준

- [ ] P1 / P2 모든 청크 처리 완료
- [ ] 채움도 (P1+P2 합계, Top 5K 범위):
  - example_en ≥ 95%
  - synonyms ≥ 80%
  - antonyms ≥ 50%
  - ipa ≥ 95%
  - collocations ≥ 80%
- [ ] 인간 sample 검수 130 단어 통과
- [ ] CLAUDE.md §"🗄 Supabase DB 스키마" shared_dictionary 7 컬럼 fillrate 갱신

---

## 8. 메모리 정합 체크리스트

- [x] **project_supabase**: jajenrevcbmrpaliomxv 사용
- [x] **feedback_supabase_migrations**: 신규 migration 없음 (PR #13 적용 완료)
- [x] **feedback_neutral_terms**: vendor명 미사용 ('Claude 모델' 사용)
- [x] **feedback_best_model**: Opus 4.7 강제 (Sonnet 대안 거절)
