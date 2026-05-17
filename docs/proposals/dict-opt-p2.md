# P2 — shared_dictionary 일괄 enrichment 실행 계획

**작성일**: 2026-05-17
**전제**: P0 (promote) + P0.5 (CEFR relabel) + P1 (schema 확장) 완료
**잔여 작업**: shared_dictionary 22,762 row 중 미채움 21,254 row 에 enrichment 적용

---

## 1. 현재 fillrate

| 컬럼 | filled | total | % |
|---|---:|---:|---:|
| example_en | 1,508 | 22,762 | 6.6% |
| synonyms | 1,481 | 22,762 | 6.5% |
| antonyms | 1,006 | 22,762 | 4.4% |
| ipa | 1,508 | 22,762 | 6.6% |
| collocations | 1,508 | 22,762 | 6.6% |
| register | 1,508 | 22,762 | 6.6% |
| korean_learner_note | 1,018 | 22,762 | 4.5% |

**남은 작업 단위**: 약 21,254 row (각 row 가 위 7 컬럼 중 부족한 값들을 채워야 함). 동일 lemma 가 여러 컬럼 모두 비어있으면 1회 enrichment 로 동시 채움.

---

## 2. 비용·시간 추정 (Opus 4.7 기준)

cast-2000 실측 (이번 세션, 200 lemma × 7 chunk 직접 enrich + 9건 reenrich + 336건 flag-fix + 11건 R3-residual):

- 약 1,400 lemma 직접 enrichment ≒ subagent token 누적 ~1.4M token (in+out)
- Opus 4.7 pricing: $15/Mtok input + $75/Mtok output
- output 비중 가정 60% → 평균 $51/Mtok
- **단가 약 $0.051/lemma**

→ 21,254 lemma 일괄 enrichment:
- **예상 비용: ~$1,084** (cast-2000 보다 10배 큰 작업)
- **예상 시간: 약 5~7 시간** (chunk 당 ~15분, wave-size=3 병렬, 106 chunk)

> 원안 sprint plan 의 "$260" 은 Sonnet 4.6 가정. memory rule (Opus 의무) 정합 시 실비용 ~$1K.

---

## 3. 실행 옵션 비교

| 옵션 | 방식 | 장점 | 단점 |
|---|---|---|---|
| **A (직접 batch)** | shared_dictionary 21,254 row → `pending-XXofMM.jsonl` 생성 → vcb-enrich-chunk subagent fan-out → 결과를 직접 shared_dictionary UPDATE | 가장 빠른 1회 완주 / 인프라 재사용 / 단가 명확 | $1K 한 번에 / VCB queue 우회 (감사·재시도 트레일 약함) |
| **B (VCB 시드 누적)** | csat-2000, ngsl-tier2-2000 등 시드를 만들어 VCB 정상 파이프라인 통과 → 각 run 마다 `05e-promote` 호출 | 감사·QA·curate 단계 보존 / 단계적 검증 / 도구 더 강화됨 | 10+ 회 반복 / 시드 큐레이션 부담 / 매번 ~$100 |
| **C (점진 — on-demand)** | shared_dictionary 빈 row 는 사용자 텍스트/단어장 빌드 시점에 lazy enrich | 비용 분산 / 사용 빈도 따라 자연 정렬 | 채움도 느리고 불완전 / 첫 사용자 대기 시간 |

---

## 4. 추천 — **B (단계적 VCB 시드 시리즈)**

근거:
1. **감사 트레일 보존** — `vocab_enrichment_queue` 가 모든 row 의 출처·QA flag·curator 결정 보관. 향후 컬럼 추가 시 같은 인프라 재사용 가능.
2. **단계적 위험 분산** — 시드 단위로 검수 가능. 첫 시드에서 문제 발견되면 다음 시드 전에 fix.
3. **R5 룰 자연 검증** — 각 시드의 CEFR 분포가 NGSL-CEFR 정합인지 자동 확인.
4. **단가는 비슷** — 옵션 A 와 토큰 양이 거의 같음 (재시도·flag-fix 포함). 실비용 $1,000~1,200.

### 권장 시드 시리즈 (총 ~20,000 lemma, 11 run)

| Run | 시드 slug | 카테고리 | 단어 수 (예상) | 우선순위 |
|---|---|---|---:|:---:|
| 2 | csat-2000 | high_school (수능 핵심) | 2,000 | 🔴 1 |
| 3 | ngsl-tier1-2000 | high_school (NGSL rank 1-2000) | 2,000 | 🔴 2 |
| 4 | ngsl-tier2-2000 | high_school (NGSL rank 2001-4000) | 2,000 | 🟡 3 |
| 5 | toeic-essential-2000 | exam (TOEIC) | 2,000 | 🟡 4 |
| 6 | business-2000 | business | 2,000 | 🟡 5 |
| 7 | academic-2000 | academic | 2,000 | 🟢 6 |
| 8 | ielts-2000 | exam (IELTS) | 2,000 | 🟢 7 |
| 9 | middle-2000 | middle_school | 2,000 | 🟢 8 |
| 10 | elementary-2000 | elementary | 2,000 | 🟢 9 |
| 11 | idioms-1000 | idiom | 1,000 | 🟢 10 |

→ 11 run 완료 시 약 **19,000 lemma 추가 backfill** (중복 제외 후 약 80% 효율 가정).
→ 누적 채움도 약 **85~90%** 목표 (22,762 중 19,000~20,500).

---

## 5. 1차 (run 2 = csat-2000) 실행 절차

P0/P0.5/P1 가 완료된 환경에서 새 run 부트스트랩:

```bash
# 1. seed list 생성 (Claude API · /vcb-seed-list)
pnpm vcb:seed:generate --spec docs/seeds/csat-2000.yaml
   → exports/seeds/csat-2000.jsonl

# 2. seed list 검증
/vcb-seed-validate exports/seeds/csat-2000.jsonl   (slash command)

# 3. ingest → normalize → extract (Step 1-3)
pnpm vcb:ingest --file exports/seeds/csat-2000.jsonl --slug csat-2000
pnpm vcb:normalize --run-id <new>
pnpm vcb:extract --run-id <new>

# 4. dict-lookup (Step 4)
pnpm vcb:dict-lookup --run-id <new>
   → shared_dictionary 히트는 enrichment 건너뛰고 직접 publish 흐름으로

# 5. export job (Step 5a)
pnpm vcb:export-job --run-id <new> --chunk-size 200

# 6. enrich (Step 5b · 본 세션에서 검증된 fan-out)
/vcb-batch-enrich csat-2000   (claude code slash)

# 7. import + QA + auto-approve + publish
pnpm vcb:import-enriched --file exports/vcb-jobs/...-enriched-*.jsonl  (10회)
pnpm vcb:qa --run-id <new>
node scripts/vcb/07b-bulk-approve.mjs --run-id <new> --apply
pnpm vcb:publish --run-id <new>

# 8. 마스터 캐시 backfill
node scripts/vcb/05e-promote-to-dictionary.mjs --run-id <new> --apply

# 9. CEFR 재검증
node scripts/vcb/99-cefr-relabel.mjs --apply
```

기 자동화된 부분:
- Step 6 QA → flag-fix 자동화는 미구축. R3+R4 flag-fix 는 수동 분기 (`vcb-qa-flag-fix` skill 호출). 빈도 따라 자동화 가치 평가.
- Step 7 bulk-approve 는 이번 세션에서 추가됨.
- Step 8 publish pagination fix 는 이번 세션에서 적용됨.

---

## 6. 안전 장치

### 6a. 백업 정책
- 각 run 시작 전: `shared_dictionary` 백업 테이블 자동 생성 (날짜 suffix)
- 본 P1 backup 보존 기간: 30일 (2026-06-15 까지). 이후 drop.

### 6b. 비용 cap
- Run 당 예산 $150 cap. 초과 시 자동 중단 + 알림.
- Run 시작 전 `vcb:export-job` dry-run 으로 lemma 카운트 → 예상 비용 ($0.05 × N) 표시.

### 6c. 재시도
- 모든 스크립트 idempotent (재실행 안전).
- enrichment 실패 chunk 는 `enrich-chunk` 재호출 (백업 자동 생성).

### 6d. 중복 제거
- ingest 시점에 기존 `shared_dictionary.word` 중 fillrate 100% 인 row 자동 제외
- Step 4 dict-lookup 에서 히트는 enrichment skip

---

## 7. 종료 기준

- [ ] 11 run 모두 publish 완료
- [ ] `shared_dictionary` 핵심 4 컬럼 (example_en/synonyms/ipa/collocations) 채움도 ≥ 80%
- [ ] register 채움도 ≥ 80%
- [ ] CLAUDE.md §"🗄 Supabase DB 스키마" 의 `shared_dictionary` 섹션 갱신
- [ ] sprint 회고 노트 (`docs/retros/dict-opt-2026q2.md`)

---

## 8. 다음 결정 사항 (sprint 시작 전 확인 필요)

- Q1. 비용 (~$1K) 승인?
- Q2. 11 run 시드 우선순위 (위 표) OK? 변경 시 어떤 시드?
- Q3. CEFR 재라벨링은 매 run 후 자동 실행 (현재 99-cefr-relabel.mjs idempotent) — 유지?
- Q4. 종료 기준의 80% 채움도 목표 — 조정?
