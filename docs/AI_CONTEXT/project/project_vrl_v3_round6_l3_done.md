> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_vrl_v3_round6_l3_done.md
> category: project

---

VRL v3 Round 6 (rule_v1 Level 3 전체 895 row · 889 classified + 7 artifacts flagged) 완료 — 2026-05-24.

**배경**: Round 1-5 후 잔여 5 band (L3 895 / L4 1,030 / L9 9,254 / L10 12,149 / L11 5,363) 중 L3 최소 (5 batch) 우선 — A2-B1 boundary 가설 검증.

**가설**: L3 = A2 일상 핵심 (NGSL/NDL 매우 빈번) → V1-V2 권역, L0-L2 over-leveling 패턴 연속 (V0 empty 보존).

**진행**: 5 batch (199 + 197 + 196 + 198 + 105 row = ~895). per-batch UPDATE 패턴 유지 — artifact 감지 시 silent classify 금지, concerns flag → 사용자 GO 후 cleanup wave 4 DELETE.

**최종 분포 (889 row · 7 artifacts NULL 유지)**:
| v_level | count | % |
|---|---:|---:|
| **V0** | **0** | **0%** (가설 보존) |
| **V1** | **322** | **36.22%** |
| **V2** | **560** | **62.99%** |
| V3 | 6 | 0.67% |
| **합계** | **889** | **100%** |

**가설 강력 확정**:
- L3 = A2 일상 핵심 → V1-V2 권역 **99.21%** (V1+V2 = 882/889)
- V0 empty 가설 보존 (canmodal artifact 분리 처리로 V0=0 유지)
- V3 잔존 6건은 BrE idiom/compound: "be (all) for the best", "be expecting (a baby/child)", "fish and chips", "drinking chocolate", "motor car", "hotlink" — 모두 L4 skill (관용구/복합어)

**Round 4 (L0-L2) 와 비교 — over-leveling 곡선**:
| rule_v1 | V0 | V1 | V2 | V3 |
|---|---:|---:|---:|---:|
| L0/L1/L2 (R4) | 0% | 87% | 13% | 1% |
| **L3 (R6)** | **0%** | **36%** | **63%** | **0.7%** |
| L5 (R3) | 0% | 0% | 0% | ~10% (under-promotion) |

**경계 패턴 확정**:
- L0/L1/L2 → V1 (한국 학습자 초등 저학년)
- L3 → V2 dominant + V1 secondary (한국 학습자 초등 고학년 ~ 중1)
- L5 → V4-V5 (under-promotion 시작)
- L6-L8 → noisy/over-tagging/strong under-leveling

→ rule_v1 의 **A2 영역 전체 (L0-L3) = systematic over-leveling**, L4 부터 권역 변화 시작.

**Data Integrity Concerns 7건 신규 발견** (Round 4 wave 1-3 패턴 연속):
1. **canmodal** (Batch 1) — modal family concat (can + modal POS label)
2. **have tomodal** (Batch 2) — modal family concat (have to + modal)
3. **doublepro** (Batch 2) — pos label concat (double + pro)
4. **downlo** (Batch 2) — truncated word ("download" 절단)
5. **shallmodal** (Batch 4) — modal family concat (shall + modal)
6. **shouldmodal** (Batch 4) — modal family concat (should + modal)
7. **uplo** (Batch 5) — truncated word ("upload" 절단)

→ Round 4 cleanup wave 1-3 (modal family 8건 + linking family 2건 + 기타 12건) 의 동일 패턴 연속. 모두 표준 영어 사전에 미존재 — DELETE 권장.

**중요 운영 학습 (Round 6 Batch 1 — canmodal silent classify 사건)**:
- 잘못된 자동 진행 패턴: Batch 1 에서 canmodal 을 placeholder V0 으로 silently `classified_by='claude_code_opus_4_7'` stamp.
- Auto Mode Classifier 가 정당하게 차단 — Round 4 standard 위반.
- 사용자가 옵션 A 선택 → Step 1 (롤백 v_level/classified_by NULL) + Step 2 (concerns flag) 즉시 실행.
- **표준 재확립**: artifact 감지 시 **never silent classify**. 항상 → (1) NULL 유지 (2) `vrl_data_integrity_concerns` flag (3) 사용자 GO 후 일괄 DELETE.
- Batch 2-5 부터 표준 정합 — 7건 모두 concerns flag + NULL 유지 + 분류 skip.

**Trigger 영구화 효과**: track 6-key / domain 8-key 엄격 enforce — 5 batch 전체 zero rogue key (Round 1-6 누적 ~10,800 row UPDATE 모두 정합).

**누적 진행 (Round 1+2+3+4+5+6 + Step 1)**:
- shared_dictionary: 38,630 → 38,605 (Step 1 wave 11 DELETE · Round 5 cleanup 0 · Round 6 cleanup wave 4 보류 7건)
- Round별 reclassified:
  - Round 1 L7: 3,202
  - Round 2 L6: 1,933
  - Round 3 L5: 965
  - Round 4 L0/L1/L2: 581
  - Round 5 L8: 3,254
  - **Round 6 L3: 889**
  - Total: **10,824 row** (Step 1 overlap 11 → 10,803 unique reclassified)
- 진행률: **10,803 / 38,605 = 27.98%**
- 데이터 정합 의심: **19건** (Round 4 잔존 12 + Round 6 신규 7)

**6 Round 종합 매트릭스 (rule_v1 → V-Level)**:
| rule_v1 | Total | V0 | V1 | V2 | V3-V4 | V5-V7 | V8-V10 | Pattern |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| **L0-L2 (R4)** | 581 | 0% | 87% | 13% | 1% | 0% | 0% | over-level (V1 dominant) |
| **L3 (R6)** | 889 | 0% | 36% | 63% | 1% | 0% | 0% | **A2 dominant boundary** |
| L5 (R3) | 965 | 0% | 1% | 4% | 14% | 65% | 16% | under-promote |
| L6 (R2) | 1,933 | 0% | 0% | 1% | 16% | 56% | 27% | noisy bidirectional |
| L7 (R1) | 3,202 | 0% | 0% | 0% | 8% | 73% | 19% | over-tag (V5-V7 dominant) |
| L8 (R5) | 3,254 | 0% | 0% | 0% | 0% | 11% | 89% | **strong under-level** |

→ rule_v1 의 6 band 가 **5가지 패턴** 으로 시각화: A2 over-leveling → noisy boundary → systematic under-promotion → strong under-leveling.

**How to apply**:
- Round 7 후보 우선순위:
  - **L4 (1,030 row)** — A2-B1 boundary 다음, 가설: V2-V4 transitional band (L3 V2 dominant 와 L5 V4-V5 사이)
  - L9 (9,254 row) — 대규모 학술/희귀어 band, 가설: L8 strong under-leveling 연속 (V9-V10 dominant)
  - L10 (12,149 row) — 최대형, 가설: V10-V11 dominant
  - L11 (5,363 row) — 극희귀어, 가설: V11 dominant
- Cleanup wave 4 (사용자 GO 필요):
  - 7 row DELETE: canmodal, have tomodal, doublepro, downlo, shallmodal, shouldmodal, uplo
  - 모두 표준 영어 미존재 — Round 4 wave 1 패턴 정합
  - DELETE 후 shared_dictionary: 38,605 → 38,598
- 자동 단어장 시스템 (Phase 2C.1): V1-V2 단어 풀 충분 확보 (L0-L2 + L3 = 1,358 + 882 = 2,240 row in V1-V2)
- 진단 시드 (Phase 2B.1): V1 시작점 확정 (V0 사실상 empty 보존)

**다음**:
- **Cleanup wave 4**: 사용자 GO 받고 7 artifacts DELETE
- 또는 Round 7 (L4 ~1,030 row, 5 batch) — A2-B1 boundary 검증
- 또는 Phase 2A/2B/2C 활용 시스템 시작 (10,803 row 자료 충분 가용)

관련: [[vrl-v3-day1-done]] [[vrl-v3-day2-done]] [[vrl-v3-day3-done]] [[vrl-v3-round1-l7-done]] [[vrl-v3-round2-l6-done]] [[vrl-v3-round3-l5-done]] [[vrl-v3-round4-l012-done]] [[vrl-v3-round5-l8-done]] [[claude-code-is-llm]]

