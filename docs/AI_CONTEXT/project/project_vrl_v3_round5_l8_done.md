> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_vrl_v3_round5_l8_done.md
> category: project

---

VRL v3 Round 5 (rule_v1 Level 8 전체 3,254 row 재분류) 완료 — 2026-05-24.

**배경**: Round 1-4 완료 후 L8 (rule_v1 의 formal/academic band) 가설 검증.
- Round 1 (L7): unidirectional 하향 (over-tagging)
- Round 2 (L6): bidirectional noisy
- Round 3 (L5): under-promotion 상향
- Round 4 (L0/L1/L2): systematic over-leveling (모두 V1-V2 권역)
- **Round 5 (L8) 가설**: formal band, 상향 강 우세 — C1 plain → V8, C2 + jargon → V9-V10

**진행**: Batch 1-17 (200 row × 16 + 54 row 최종). Auto Mode 활성 + per-batch 자동 진행 + DB-side counter 검증 유지. 마지막 batch (54 row · z-words 포함).

**최종 분포 (3,254 row · L8 유지율 28.03%)**:
| v_level | count | % |
|---|---:|---:|
| V6 | 75 | 2.30% |
| V7 | 302 | 9.28% |
| **V8** | **912** | **28.03%** |
| V9 | 1,259 | 38.69% |
| V10 | 706 | 21.70% |

**비대칭 패턴**:
- 하향 V6-V7: 377 (11.58%)
- 유지 V8: 912 (28.03%) — **모든 round 중 최저** (L7 38.6% / L6 31.87% / L5 52.54% / L0-2 73%)
- 상향 V9-V10: 1,965 (**60.39%**) — 모든 round 중 최강 상향 (L7 19.4% / L6 26.07% / L5 38.86% / L0-2 0%)

**가설 강력 확정**: rule_v1 L8 = **systematic under-leveling** (가장 심한 상향 편향).
- C2 + 법률/금융/의학 specific (e.g. plaintiff/liquidity/lesion/pathological/sovereign) → V9-V10 대거 상향
- C1 plain literary/archaic (e.g. lo, twain, whence, wrought, slumber) → V10 문어/고전
- 의학 specific (lymphocyte/orthopaedic/pulmonary/sclerosis/microbiology/syphilis/macroeconomics) → V10
- L8 의 28% 만이 V8 유지 — 나머지 60% 는 더 높은 band 가 적절

**Track 활용도**: 모든 row 6 track keys 완전 채움. academic_english 평균 8-10 (학술 specific 다수), literary 평균 8-10 (formal/archaic), business_english 평균 7-10 (financial/legal specific), conversational 평균 3-5 (격식체 → 구어 매우 약함).

**Domain 활용도**: 모든 row 8 domain keys 완전 채움. academic 5 (학술 specific) 또는 news_media 5 (정치/뉴스 격식) 가 빈번. general 평균 2-3 (격식체 일상 약함).

**Skill Level**: L3 (single_word) ~93% / L4 (compound/phrasal/idiom) ~7% — L4 예: lifeboat, lighthouse, monsoon→solo (single), lighthouse, loophole, midsummer, midwinter, mountaineer→compound, moviegoer, paperback, password 등.

**데이터 정합**: Round 5 신규 의심 0건 (Round 4 cleanup 후 L8 row 들은 정합).

**Trigger 영구화 효과**: track 6-key / domain 8-key 엄격 enforce — 17 batch 전체 zero rogue key.

**Why**: rule_v1 의 L8 (formal/academic) 은 한국 학습자 V-Level 분포 기준으로 **너무 낮게 책정**됨. C2 jargon · 의학/법률/금융 specific · archaic/literary 모두 V9-V10 권역. 한국 영어 교육에서 이 단어들은 수능 이후 (대학·대학원·전문직) 영역.

**누적 진행 (Round 1+2+3+4+5 + Step 1 cleanup)**:
- shared_dictionary: 38,630 → **38,605** (Step 1 wave −11 + wave 2/3 cleanup; Round 5 신규 DELETE 0)
- Round별 reclassified:
  - Round 1 L7: 3,202
  - Round 2 L6: 1,933
  - Round 3 L5: 965
  - Round 4 L0/L1/L2: 581
  - **Round 5 L8: 3,254**
  - Total: **9,935 row** (Step 1 overlap 11 + wave 2/3 cleanup 10 = 21 → 9,914 unique reclassified)
- 진행률: **9,914 / 38,605 = 25.68%**

**5 Round 비교 (rule_v1 → V-Level 가설 정합)**:
| rule_v1 | Total | Retain% | Down% | Up% | Pattern |
|---|---:|---:|---:|---:|---|
| L0/L1/L2 (R4) | 581 | 73% (V1-V2) | 0% | 0% (V0 empty) | **systematic over-leveling** |
| L5 (R3) | 965 | 52.54% | 8.60% | 38.86% | **under-promotion 상향** |
| L6 (R2) | 1,933 | 31.87% | 42.06% | 26.07% | **bidirectional noisy** |
| L7 (R1) | 3,202 | 38.63% | 42.0% | 19.4% | **over-tagging 하향** |
| **L8 (R5)** | **3,254** | **28.03%** | **11.58%** | **60.39%** | **strong under-leveling 상향** |

5 Round 결과 종합: rule_v1 은 **band 별로 systematic 편향 패턴이 다름** — L0-L2 over-level (V1-V2 권역), L5 under-promote, L6 noisy 양방향, L7 over-tag, **L8 strong under-level** (60% 상향). Claude Code 의미 재분류가 한국 학습자 V-Level 분포에 정합한 12단계 distribution 확보.

**How to apply**:
- Round 6 후보:
  - **L9 (~9,254 row 추정)** — 대규모 학술/희귀어 band, 가설: L8 와 유사한 strong under-leveling (V10 권역 다수)
  - L4 (~1,000 row) — A2-B1 boundary band, 가설: L5 와 유사한 under-promotion
  - L3 (~? row) — A1-A2, 가설: L0-L2 와 유사한 over-leveling
  - L10-L11 (소수) — 극희귀어, 가설: V10-V11 유지
- 200 row batch + per-batch 진행 패턴 유지
- L8 결과는 진단 시드 V8-V10 풀이 충분함을 보여줌 (1,965+912 = 2,877 row in V8-V10)

**다음**:
- Round 6 L9 (~9,254 row, ~47 batch 200 단위) 후보 — 대규모, 검토 필요
- 또는 활용 시스템 (Phase 2A/2B/2C):
  - 2A.2: adaptiveExtractWords caller wiring
  - 2B.1: 진단 시스템 시드 (V1-V10 모두 풀 확보됨 — 9,914 row 가용)
  - 2C.1: 자동 단어장 발행 (V-Level 7/6/5/1 풀 충분)

관련: [[vrl-v3-day1-done]] [[vrl-v3-day2-done]] [[vrl-v3-day3-done]] [[vrl-v3-round1-l7-done]] [[vrl-v3-round2-l6-done]] [[vrl-v3-round3-l5-done]] [[vrl-v3-round4-l012-done]] [[claude-code-is-llm]]

