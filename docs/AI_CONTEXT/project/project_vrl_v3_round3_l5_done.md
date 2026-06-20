> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_vrl_v3_round3_l5_done.md
> category: project

---

VRL v3 Round 3 (rule_v1 Level 5 전체 965 row 재분류) 완료 — 2026-05-24.

**배경**: Round 2 (L6) noisy 가설 확정 후 L5 (rule_v1 B1 band) 로 가설 확장. 작은 규모 (965 row) + 안정성 검증. CEFR B1 99.5% / NGSL=0 / csat-prep 24% — non-NGSL B1 band 특성.

**진행**: Batch 1-5 (200 row × 4 + 165 row 최종). per-batch approval 패턴 + DB-side EXCEPT 정합 검증 유지. Auto mode 활성으로 turn-by-turn 진행.

**최종 분포 (965 row · L5 유지율 52.5%)**:
- L3=14 (1.45%) — data integrity (modal family + name_initial + concat)
- L4=69 (7.15%) — NGSL B1 핵심어 (act, deliver, character, mark 등)
- **L5=507 (52.54%)** — 유지 (vs L6 31.87% · L7 38.6%)
- L6=316 (32.75%) — formal/compound/specific
- L7=57 (5.91%) — rare/literary/aging tech
- L8=2 (0.21%) — repertoire (tag_band_mismatch), water jump

**비대칭 패턴 (L5 안정 band 확인)**:
- 하향 L3-L4: 83 (8.60%) — Round 1/2 의 ~42% 대비 **현저히 낮음**
- 유지 L5: 507 (52.54%) — **Round 1 L7 (38.6%) · Round 2 L6 (31.87%) 모두 추월**
- 상향 L6-L8: 375 (38.86%) — Round 1 (19.4%) · Round 2 (26.07%) 대비 **현저히 높음**

**가설 확장 결과 (3 rounds 누적)**:
| Level | Retention | Down% | Up% | rule_v1 특성 |
|---|---:|---:|---:|---|
| L7 (Round 1) | 38.63% | 42.0% | 19.4% | systematic over-tagging (하향 편향) |
| L6 (Round 2) | 31.87% | 42.06% | 26.07% | bidirectional noisy |
| **L5 (Round 3)** | **52.54%** | **8.60%** | **38.86%** | **systematic under-promotion (상향 편향)** |

**가설 확정 (Round 3)**: rule_v1 의 L5 (B1 non-NGSL band) 는 **under-promotion 편향** — B1 단어들을 L6/L7 수준으로 올려야 할 것들이 다수. csat-prep core 단어 (compliment, fluent, brochure 등) 가 L5 → L6/L7 상향 다발.

**Track 활용도**: 모든 row 가 6 track keys 완전 채움 (trigger enforce 정합). 평균 level 분포는 csat_korean / academic_english / business_english 가 csat-prep 단어 비중 ↑로 인해 평균 5.5-6.0, conversational / general_proficiency 가 NGSL+everyday 비중 ↑로 인해 6.5-7.0 추정.

**Domain 활용도**: 모든 row 가 8 domain keys 완전 채움. general 가 가장 dense (대부분 row 4-5), news_media / academic 가 csat-prep 비중에 따라 변동.

**Skill Level**: L3=637 (66%) / L4=328 (34%) — L6 (66/34) 와 유사, L7 (68/22) 보다 multi-word 비중 약간 ↑ (B1 의 compound noun + phrasal verb 다수).

**데이터 정합 의심 +9건 (Round 3 신규)** → 누적 22건:
- `pos_label_concatenated` Round 3 신규 5건 (couldmodal, mustmodal, ought tomodal, willmodal, equallinking, weighlinking) — modal family **8건 총** (beauxiliary/maymodal/mightmodal/wouldmodal/couldmodal/mustmodal/ought tomodal/willmodal) + linking-verb family 2건 (equallinking/weighlinking)
- `name_initial` Round 3 신규 2건 (b, e) — total 3건 (al/b/e)
- `tag_band_mismatch` Round 3 신규 1건 (repertoire — rank 542 vs C1-C2 vocab, 명백한 corpus tagging 오류)

**Trigger 영구화 효과**: track 6-key / domain 8-key 엄격 enforce — 5 batch 전체 zero rogue key (Round 1+2+3 합계 6,100 row UPDATE 동안 zero).

**Why**: Round 1 (L7) 하향 편향 + Round 2 (L6) 양방향 noisy + Round 3 (L5) 상향 편향 = **rule_v1 systematic distortion 의 multi-band 패턴**. L5 의 NGSL B1 core 단어들이 csat-prep 태그로 인해 L6/L7 으로 상향 정당화. Claude Code 의미 인식이 한국 학습자 관점에서 B1 단어의 정확한 자리 (L4-L5) 식별.

**누적 진행 (Round 1+2+3)**: 6,100 row reclassified (L7 3,202 + L6 1,933 + L5 965) / total 38,626 = **15.79%**

**How to apply**:
- Round 4 후보 우선순위:
  - **L8 (3,254 row)** — formal/academic band, Round 1 L7 상향분 (620건) + Round 3 L5 상향분 (375건) 정합 검증, 가설: L8 도 noisy 또는 안정
  - L4 (~1,000 row 추정) — A2 NGSL 핵심어 band, 가설: L5 의 ~10% 하향분과 동일한 boundary
  - L9 (9,254 row) — 대규모 학술/희귀어, 보류
  - L10-L11 (소수) — 보류
- 200 row batch + per-batch approval 패턴 유지
- L5 결과는 NGSL B1 core 단어들이 csat-prep + everyday context 로 L4-L5 에 위치한다는 사실 강력히 시사

**다음**:
- Round 4 L8 (3,254 row, ~17 batch 200 단위) 권장 — formal band 가설 검증
- 또는 활용 시스템 (Day 4-6): `calculate-book-vrl-v3.ts` · 진단 시드 · 자동 단어장 85개
- 또는 데이터 정합 cleanup phase (22건 8 유형 — 우선 modal family 8건 일괄 해결 권장)

관련: [[vrl-v3-day1-done]] [[vrl-v3-day2-done]] [[vrl-v3-day3-done]] [[vrl-v3-round1-l7-done]] [[vrl-v3-round2-l6-done]] [[claude-code-is-llm]]

