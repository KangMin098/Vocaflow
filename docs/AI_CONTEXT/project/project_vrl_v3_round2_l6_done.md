> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_vrl_v3_round2_l6_done.md
> category: project

---

VRL v3 Round 2 (rule_v1 Level 6 전체 1,933 row 재분류) 완료 — 2026-05-24.

**배경**: Round 1 (L7 3,202 row) 완료 후 L6 noisy 가설 검증. Sanity Check (B1+csat-prep 97.4% 하향율) 로 rule_v1 L6 systematic over-promotion 확인 — Round 2 진행 승인.

**진행**: Batch 1-10 (200 row 단위 × 9 + 최종 133 row). per-batch approval 패턴 + DB-side EXCEPT 정합 검증 유지.

**최종 분포 (1,933 row · L6 유지율 31.87%)**:
- L4=318 (16.45%) — B1 NGSL 핵심어 하향
- L5=495 (25.61%) — B1/B2 핵심
- **L6=616 (31.87%)** — 유지
- L7=470 (24.31%) — formal/literary 상향
- L8=34 (1.76%) — 학술/문학 상향

**비대칭 패턴 (L7 대비 noisy)**:
- 하향 L4-L5: 813 (42.06%) — Round 1 L7 의 42.0% 와 유사
- 유지 L6: 616 (31.87%) — **Round 1 L7 38.63% 대비 6.76%p 낮음**
- 상향 L7-L8: 504 (26.07%) — Round 1 L7 의 19.4% 대비 6.67%p 높음

**가설 검증 결과**:
- L7: unidirectional 하향 편향 (rule_v1 over-tagging)
- L6: bidirectional 분산 (over+under 양방향) — **noisy 가설 확정**

**Track 활용도 (key cardinality / 1,933)**:
- general_proficiency 1,627 (84.2%) / csat_korean 1,423 (73.6%)
- conversational 783 (40.5%) / business_english 697 (36.1%)
- academic_english 685 (35.4%) / literary 524 (27.1%)
- L6 은 conversational/general 비중 ↑ (L7 의 academic 51% 대비)

**Domain 활용도**:
- general 1,925 (99.6%) / business 746 / academic 659
- literature 519 / news_media 436 / science_tech 283
- travel_culture 241 / entertainment 177
- L6 의 general 거의 전체 — 일상 어휘 비중 ↑

**Skill Level**: L3=1,582 (81.8%) / L4=351 (18.2%) — L7 의 L3=68% 대비 단의 어휘 비중 ↑ (L6 가 더 단순)

**데이터 정합 의심**: Round 1 + Round 2 누적 13건 (L6 신규 0건) — L6 row 들은 데이터 적재 측면에서 깨끗.

**누적 진행 (Round 1+2)**: 5,135 row reclassified (L7 3,202 + L6 1,933) / total 38,626 = 13.3%

**작동 가설 검증**:
- 가설: L6 은 L7 보다 noisy (bidirectional misclassification)
- 결과: 유지율 31.87% (L7 38.63% 대비 -6.76%p), 상향율 26.07% (L7 19.4% 대비 +6.67%p) — **확정**

**Trigger 영구화 효과**: track 6-key / domain 8-key 엄격 enforce — 10 batch 전체 zero rogue key.

**Why**: L6 (rule_v1) 은 B1 와 B2 사이 ambiguous band — NGSL 핵심어가 잘못 promoted (downgrade 대상) + formal/literary 어휘가 잘못 demoted (upgrade 대상) 동시 발생. Claude Code 의미 인식이 양방향 보정.

**How to apply**:
- Round 3 후보 우선순위:
  - **L5 (965 row)** — 작은 규모, B1 하한 검증 (Round 1+2 hypothesis 확장)
  - L8 (3,254 row) — formal/academic band, L7 상향분 (470건) 정합 검증
  - L9 (9,254 row) — 대규모, 학술/희귀어 ⊃ 보류 권장
- 200 row batch + per-batch approval 패턴 유지
- L6 결과는 L5/L7 의 cross-band 보정 필요 가능성 시사 (L4 318 + L8 34 추가 분포)

**다음**:
- Round 3 L5 (965 row, ~5 batch 200 단위) 권장
- 또는 활용 시스템 (Day 4-6): `calculate-book-vrl-v3.ts` · 진단 시드 · 자동 단어장 85개
- 또는 데이터 정합 cleanup phase (13건 7유형)

관련: [[vrl-v3-day1-done]] [[vrl-v3-day2-done]] [[vrl-v3-day3-done]] [[vrl-v3-round1-l7-done]] [[claude-code-is-llm]]

