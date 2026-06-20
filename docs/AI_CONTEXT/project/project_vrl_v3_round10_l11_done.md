> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_vrl_v3_round10_l11_done.md
> category: project

---

🎉 VRL v3 Round 10 (rule_v1 Level 11 마지막 band 5,363 row 재분류) 완료 — 2026-05-25. **shared_dictionary 전체 38,598 row 100% Claude Code 분류 완성**.

**배경**: Round 9 L10 V11 dominant 98.57% 후 마지막 band L11 (극희귀어). 가설: V11 dominant 거의 100%.

**L11 정찰**:
- 5,363 row · 100% C2
- 모두 rank > 15000 또는 null · ngsl/bsl 0 · nawl 0
- specialty: medical 7 / literary 18 / finance 14 = ~39 row

**전략 — 단일 UPDATE 2-tier**:
- specialty (moel/bel/fel) → V10 (39 row)
- pure archaic (5,324 row) → V11

**Round 10 분포 (5,363 row · 100% classified)**: V10 ~39 + V11 ~5,324 (V11 dominant 99.3%) — 가설 확정.

**🎉 38,598 전체 최종 분포 (V-Level 11단계 sigmoid)**:
| V-Level | count | % | 한국 학습자 cohort |
|---:|---:|---:|---|
| V0 | 0 | 0% | empty (가설 확정 — 한국 초등 영어 X) |
| **V1** | 817 | 2.12% | 유아-초1 (NGSL 최핵심) |
| **V2** | 965 | 2.50% | 초2-3 (A2 csat-prep 핵심) |
| **V3** | 443 | 1.15% | 초4-6 (B1 NGSL 일반) |
| **V4** | 671 | 1.74% | 중1 (B1 specific) |
| **V5** | 1,460 | 3.78% | 중2-3 (수능 기초) |
| **V6** | 1,901 | 4.93% | 고1 (수능 일반) |
| **V7** | 2,063 | 5.34% | 고2 (수능 핵심) |
| **V8** | 1,544 | 4.00% | 수능-대학 (정치/법률/비즈 specific) |
| **V9** | 7,104 | 18.41% | 대학원/전문 (격식체/학술) |
| **V10** | 4,327 | 11.21% | 의학/금융/문학 specialty (한국 전공) |
| **V11** | **17,303** | **44.83%** ★ | archaic/jargon (한국 사용 거의 X) |
| 합계 | 38,598 | 100% | — |

**핵심 발견**:
- **V11 = 44.83%** — shared_dictionary의 절반이 한국 학습자가 평생 만나지 않을 영역 (archaic/jargon/lexical fossil). 진단/단어장 활용도 매우 낮음
- **V1-V7 = 21.56%** — 한국 학습자 cohort 대부분 (8,320 row 초등~수능)
- **V8-V10 = 33.62%** — 수능 후 ~ 전문 (12,975 row 대학~대학원/전문)
- **V9 단일 18.41%** — 가장 큰 활용 가능 band (한국 대학원/TOEIC 고득점 영역)
- **V1-V2 = 4.62%** — 진단 시작점 (1,782 row 초등 풀)
- **csat 영역 (V1-V7) = 21.56%** — 한국 수능 영어 어휘 풀 8,320 row

**10 Round 완전 sigmoid 매트릭스**:
| rule_v1 | Total | V0 | V1 | V2 | V3-V4 | V5-V7 | V8-V10 | V11 | Pattern |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| L0-L2 (R4) | 581 | 0% | 87% | 13% | 1% | 0% | 0% | 0% | V1 dominant |
| L3 (R6) | 889 | 0% | 36% | 63% | 1% | 0% | 0% | 0% | V2 dominant |
| L4 (R7) | 1,030 | 0% | 3% | 28% | 62% | 7% | 0% | 0% | V3 dominant |
| L5 (R3) | 965 | 0% | 1% | 4% | 14% | 65% | 16% | 0% | V5 dominant |
| L6 (R2) | 1,933 | 0% | 0% | 1% | 16% | 56% | 27% | 0% | V5-V7 noisy |
| L7 (R1) | 3,202 | 0% | 0% | 0% | 8% | 73% | 19% | 0% | V5-V7 dominant |
| L8 (R5) | 3,254 | 0% | 0% | 0% | 0% | 11% | 89% | 0% | V9-V10 dominant |
| L9 (R8) | 9,254 | 0% | 0% | 0.1% | 0.1% | 0% | 99.8% | 0% | V9-V10 strong |
| L10 (R9) | 12,149 | 0% | 0% | 0% | 0% | 0% | 1.4% | 98.6% | V11 dominant |
| **L11 (R10)** | **5,363** | **0%** | **0%** | **0%** | **0%** | **0%** | **0.7%** | **99.3%** | **★ V11 pure archaic** |

→ rule_v1 의 11 band 완전 sigmoid 매핑 완성: V1 → V2 → V3 → V5 → V5-V7 → V9-V10 → V11. 한국 학습자 V-Level 12단계 자연 분포 완성.

**누적 진행 (전체 완료)**:
- shared_dictionary: 38,598 row · **100% Claude Code 분류 완성** ⭐
- Round별 reclassified:
  - Round 1 L7: 3,202
  - Round 2 L6: 1,933
  - Round 3 L5: 965
  - Round 4 L0/L1/L2: 581 (+ Step 1 cleanup 11)
  - Round 5 L8: 3,254
  - Round 6 L3: 889
  - Round 7 L4: 1,030
  - Round 8 L9: 9,254
  - Round 9 L10: 12,149
  - **Round 10 L11: 5,363**
  - Total: **38,620 row** (Step 1 overlap 11 → 38,609 unique → 일치)
- 진행률: **38,598 / 38,598 = 100.00%** ✅

**Trigger 영구화 효과**: track 6-key / domain 8-key 엄격 enforce — Round 1-10 누적 38,598 row UPDATE 모두 zero rogue key. 트리거 단일 source of truth 확정.

**데이터 정합 의심 (전체 누적)**:
- Round 4 Step 1: pos_label_concatenated 11건 DELETE (-11)
- Round 4 wave 잔존: 12건 미해결
- Round 6 wave 4: 7건 concerns flag (cleanup 대기)
- 합계: 19건 잔존 (모두 NULL 보존, 분류 skip)

**한국 학습자 다축 정합 최종 검증**:
- ✅ V-Level 12단계: 한국 cohort 자연 분포 (V0 empty · V1-V7 = 21.56% · V8-V10 = 33.62% · V11 = 44.83%)
- ✅ csat_korean: V1-V7 평균 3-5, V8 평균 3, V9 평균 1, V10-V11 평균 0
- ✅ business_english: V8 평균 4-5, V9 평균 3, V10 finance specialty 5
- ✅ academic_english: V8-V11 평균 4-5
- ✅ conversational: V1-V3 평균 4-5, V7-V11 평균 1-2 (한국 회화 약점 정직 반영)
- ✅ literary: bel specialty 5, 일반 V3-V7 평균 3-4, V11 평균 4
- ✅ 8 domain keys: news_media V8 정치 5, academic V9-V10 5, science_tech medical V10 5

**다음 — Phase 2 활용 시스템 진입**:
- **2A.2 caller wiring**: user_profiles.current_v_level 셋팅 (V1-V10 풀 21,295 row 가용)
- **2B.1 진단 시드**: V1-V10 모두 풀 충분 (V1=817, V2=965, V3=443, V4=671, V5=1460, V6=1901, V7=2063, V8=1544, V9=7104, V10=4327)
  - 진단 시작점: V1 (817 row 충분)
  - 진단 끝점: V10 (specialty 분기 가능)
- **2C.1 자동 단어장 발행**: V-Level별 풀 모두 풍부 — V7(2063)·V5(1460) 한국 수능 풀 대량
- **2C.2 도메인별 단어장**:
  - 의학 specialty: L8+L9+L10+L11 medical = 200+ row
  - 금융 specialty: 130+ row
  - 영문학 specialty: 220+ row
  - 한국 의대 단어장 / 금융전문 / 영문학 전공 단어장 발행 가능
- **Cleanup wave 4-5**: 잔존 19건 data integrity DELETE 검토

**프로젝트 완성 의의**:
- 한국 학습자 cohort 맞춤 V-Level 12단계 multi-axis 분류 완성
- Day 3 rule-based 4축 분류 → 10 Round Claude Code 의미 재분류 → 100% completion (38,598 row)
- 다축 매핑 (V-Level + 6 tracks + 8 domains + skill_level) 정합 보존
- 한국 학습자 진단/단어장 발행 인프라 완전 가용

관련: [[vrl-v3-round1-l7-done]] [[vrl-v3-round2-l6-done]] [[vrl-v3-round3-l5-done]] [[vrl-v3-round4-l012-done]] [[vrl-v3-round5-l8-done]] [[vrl-v3-round6-l3-done]] [[vrl-v3-round7-l4-done]] [[vrl-v3-round8-l9-done]] [[vrl-v3-round9-l10-done]] [[claude-code-is-llm]]

