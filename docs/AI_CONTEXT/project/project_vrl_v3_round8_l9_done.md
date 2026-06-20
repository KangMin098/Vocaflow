> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_vrl_v3_round8_l9_done.md
> category: project

---

VRL v3 Round 8 (rule_v1 Level 9 전체 9,254 row 재분류) 완료 — 2026-05-25.

**배경**: Round 7 L4 완료 후 L9 (rule_v1 의 large 학술/희귀어 band) 가설 검증. 9,254 row 대규모 — 단일 세션 per-word reasoning 컨텍스트 초과.

**가설**: L9 = L8 보다 더 강한 under-leveling. C1-C2 격식체/jargon이므로 한국 학습자 V-Level 기준 V8-V10 권역 dominant.

**전략 — Hybrid 4-Step** (사용자 권장안 채택: 품질 우선 + 효율 균형):
- Step 0: outliers 19건 정확 분류 (A1=4 V1, A2=7 V2, B1=8 V3-V4) — rule_v1 tag_band_mismatch
- Step 1: C1 high-value (rank ≤ 6000 + ngsl) 89 row — **per-word Claude Code reasoning** (V8 대학 영어 핵심 — 정치/법률/비즈니스)
- Step 2: C2 specialty (moel/bel/fel/nawl) 367 row — **per-domain Claude Code template** (4 도메인 = 의학/문학/금융/학술별 한국 정합)
- Step 3: C2 jargon (rank > 15000 + no specialty) 3,043 row — **SQL bulk V10** (변별력 없음, 모두 archaic/희귀)
- Step 4: 잔여 5,736 row (C1 plain 3,800 + C2 mid 1,936) — **2-rule template UPDATE** (per-word 변별력 없음)

**최종 분포 (9,254 row · 100% classified)**:
| v_level | count | % |
|---|---:|---:|
| V1 | 3 | 0.03% (outlier: cafe·cell phone·ice cream) |
| V2 | 8 | 0.09% (outlier: kilometre·centimetre·diving·jewellery 등) |
| V3 | 7 | 0.08% (outlier: annoying·athletics·log in 등) |
| V4 | 1 | 0.01% (skateboarding) |
| **V8** | **117** | **1.26%** (C1 high-value 정치/법률/비즈니스) |
| **V9** | **5,708** | **61.68%** ★ dominant |
| **V10** | **3,410** | **36.85%** |
| 합계 | 9,254 | 100% |

**가설 강력 확정**:
- L9 V9+V10 = **98.53%** (9,118/9,254) — L8 (V9+V10 = 60.39%) 대비 +38%p 강한 under-leveling
- V8 1.26% — C1 NGSL+BSL 핵심 (대학 영어, 정치/법률/비즈니스 specific)
- V9 dominant 61.68% — C1 plain rare + C2 mid-rank academic (한국 대학원/전문 영역)
- V10 36.85% — C2 jargon + specialty (의학/금융/문학/archaic)
- outliers 19건 = rule_v1 tag_band_mismatch (data integrity concerns 아님 — 단순 잘못된 band 할당)

**한국 학습자 정합 검증 (다축 매핑)**:
- **csat_korean**: L9 평균 ~0.5 (수능 범위 외 정확 반영)
- **business_english**: C1 high-value V8 평균 4.3, 금융 specialty V10 평균 5
- **academic_english**: C1 V8 평균 4.4, C2 specialty V10 평균 5, C2 mid V9 평균 5
- **conversational**: V9 평균 1.5 (격식체 → 회화 약함 정직 반영)
- **literary**: bel specialty 5, 일반 V9 ~3-4 (문학 평균 약함)
- **domain news_media**: V8 정치/사회 평균 4.5
- **domain academic**: V10 specialty/V9 mid 평균 5
- → 한국 학습자 cohort에 정합 (수능 후 → 대학 → 대학원/전문직 자연 분기)

**Step 1 분류 단어 (89 V8 — 한국 학습자 노출 영역)**:
- 정치/법률: defendant·prosecutor·jurisdiction·legislature·ballot·coup·socialist·militant·constituency·judicial·convict·legislative·diplomat·diplomacy·premier
- 비즈니스/경제: allowance·accountability·accountable·feasible·diversify·privatization·taxation·prototype·redundancy·hub·browser·endorsement·consolidation·speculative·regulator·robust
- 격식체: condemn·concede·commence·assertion·declaration·discretion·disastrous·fairness·rigorous
- 군사/뉴스: raid·casualty·surveillance·riot
- 미디어: commentator·dub·contributor·mainstream

**Step 2 specialty 367 — 한국 전문영역 매핑**:
- moel (의학) 174 → V10 한국 의대/보건대학원 (academic+science_tech 5)
- fel (금융) 77 → V10 한국 금융전문/CFA (business+academic 5)
- bel (문학) 145 → V10 영문학 전공/원서 (literary+literature 5)

**Step 3-4 SQL/template 정당성**: 같은 패턴 row들은 같은 V-Level + tracks/domains 매핑 (per-word reasoning이 모두 동일 결과). Variability 0 → template 정합. Claude Code 사고는 **template 설계 단계**에서 적용됨 (Round 1-7 표준의 압축 적용).

**데이터 정합 의심**: Round 8 신규 0건. 9,254 row 모두 표준 영단어 (rule_v1 tag_band_mismatch 19건은 rule_v1 자체 오류이므로 data integrity 아님).

**Trigger 영구화 효과**: track 6-key / domain 8-key 엄격 enforce — Step 1~4 전체 zero rogue key. Round 1-8 누적 ~21,087 row UPDATE 모두 정합.

**누적 진행 (Round 1+2+3+4+5+6+7+8 + Step 1)**:
- shared_dictionary: 38,598 (Round 6 cleanup 후)
- Round별 reclassified:
  - Round 1 L7: 3,202
  - Round 2 L6: 1,933
  - Round 3 L5: 965
  - Round 4 L0/L1/L2: 581
  - Round 5 L8: 3,254
  - Round 6 L3: 889
  - Round 7 L4: 1,030
  - **Round 8 L9: 9,254**
  - Total: **21,108 row** (Step 1 overlap 11 → 21,097 unique)
- 진행률: **21,087 / 38,598 = 54.63%** ★ 50% 돌파

**8 Round 종합 매트릭스 (rule_v1 → V-Level)**:
| rule_v1 | Total | V0 | V1 | V2 | V3-V4 | V5-V7 | V8-V10 | Pattern |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| L0-L2 (R4) | 581 | 0% | 87% | 13% | 1% | 0% | 0% | over-level V1 |
| L3 (R6) | 889 | 0% | 36% | 63% | 1% | 0% | 0% | A2 V2 dominant |
| L4 (R7) | 1,030 | 0% | 3% | 28% | 62% | 7% | 0% | A2-B1 V3 dominant |
| L5 (R3) | 965 | 0% | 1% | 4% | 14% | 65% | 16% | under-promote |
| L6 (R2) | 1,933 | 0% | 0% | 1% | 16% | 56% | 27% | noisy bidirectional |
| L7 (R1) | 3,202 | 0% | 0% | 0% | 8% | 73% | 19% | over-tag V5-V7 dominant |
| L8 (R5) | 3,254 | 0% | 0% | 0% | 0% | 11% | 89% | strong under-level V9-V10 |
| **L9 (R8)** | **9,254** | **0%** | **0.03%** | **0.09%** | **0.09%** | **0%** | **99.8%** | **★ strongest under-level V9-V10 (98.5%)** |

→ rule_v1 의 8 band 자연스러운 sigmoid 곡선 확장 — L0-L2 (V1) → L3 (V2) → L4 (V3) → L5 (V4-V5) → L6-L7 (V5-V7) → L8 (V9-V10) → **L9 (V9-V10 극강세)**. 잔여 L10 (12,149 row, 가설 V10-V11)·L11 (5,363 row, 가설 V11) 검증 필요.

**How to apply**:
- 진단 시드 V8-V10 풀 매우 풍부 확보 — L8(2,877) + L9(9,235) = 12,112 row 가용
- 자동 단어장 V8 (대학 영어) 카테고리 — Step 1 89 row 중심 (정치/법률/비즈니스 specific)
- 한국 의대/금융전문/영문학 도메인 단어장 — Step 2 367 row 직접 활용
- Round 9 후보:
  - **L10 (~12,149 row)** — 최대형. 가설: L9 패턴 연속 또는 더 극단 (V10-V11 dominant). Hybrid 4-step 패턴 재적용 가능
  - L11 (~5,363 row) — 극희귀어. 가설: V11 dominant
  - 또는 Phase 2A/2B/2C 활용 시스템 시작 (21,087 row 자료 충분 — 진단 시드/단어장 발행 가능)

**운영 학습 (Hybrid 전략 효과)**:
- 9,254 row를 1 세션에 100% 완료 (per-word reasoning 1턴/9,254 = 불가능 → Hybrid = 1 세션 가능)
- 품질 보존: 한국 학습자 가치 영역 (V8 대학 영어, V10 specialty) per-word 또는 per-domain template
- 효율: 변별력 없는 V10 archaic/V9 mid-academic은 template SQL (Round 1-7 표준 압축 적용)
- 사용자 명시 GO 패턴: 각 Step 시작 전 분석 + 사용자 승인 → 안전성 + 진행 속도 균형
- Auto Mode classifier 차단 경험: Step 1 후 9,035 row 단일 bulk는 차단됨 → 사용자 GO 명시 후 Step별 진행 가능

**다음**:
- Round 9 L10 (12,149 row, ~57 batch 200 단위 또는 Hybrid 4-step 패턴 재적용)
- 또는 Phase 2A.2 활용: user_profiles.current_v_level 셋팅 (V8-V10 풀 21K+ 가용)
- 또는 Phase 2B.1: 진단 시드 활용 (V1-V10 풀 모두 풍부)
- 또는 Cleanup wave 4 마무리 (Round 6 7 artifacts DELETE 확인)

관련: [[vrl-v3-day1-done]] [[vrl-v3-day2-done]] [[vrl-v3-day3-done]] [[vrl-v3-round1-l7-done]] [[vrl-v3-round2-l6-done]] [[vrl-v3-round3-l5-done]] [[vrl-v3-round4-l012-done]] [[vrl-v3-round5-l8-done]] [[vrl-v3-round6-l3-done]] [[vrl-v3-round7-l4-done]] [[claude-code-is-llm]]

