> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_vrl_v3_round1_l7_done.md
> category: project

---

VRL v3 Round 1 (rule_v1 Level 7 전체 3,202 row 재분류) 완료 — 2026-05-24.

**배경**: Day 3 rule_v1 기계 분류의 부정확성 (vegetable→L5, hoodie→L5, bard→L9, apple→L9 등) 확인 후 Claude Code 자체 의미 분류로 전환. Migration `20260527_100000_vrl_claude_classify_prep.sql` 적용 — 기존 4 컬럼을 `*_rule_v1` 백업 + 새 7 컬럼 추가 (`v_level/track_levels/domain_levels/skill_level/claude_reasoning/classified_by/claude_classified_at`).

**진행**: Phase 1 sample 50 + Batches 1-30. 처음 100 row 단위, Batch 28부터 200 row 전환. 사용자 per-batch approval 유지 (안전 규칙 `feedback_supabase_migrations` 정합).

**최종 분포 (3,202 row · L7 유지율 38.6%)**:
- L3=8 (0.25% · NGSL 핵심 anger/butterfly/elementary school + 4 pos_concat 의심)
- L4=61 (1.91%)
- L5=382 (11.93%)
- L6=894 (27.92%)
- **L7=1,237 (38.63%)** — 유지
- L8=481 (15.02%)
- L9=137 (4.28%)
- L10=2 (0.06% · aerodynamics, aviate)
- L11=0

**비대칭 패턴**:
- 하향 L3-L6: 1,345 (42.0%) — rule_v1 systematic 과대 분류 보정
- 유지 L7: 1,237 (38.6%) — 합당 분류
- 상향 L8-L10: 620 (19.4%) — under-promotion 보정

**Track 활용도 (key cardinality / 3,202)**:
- academic_english 1,642 (51.3%) / csat_korean 1,268 (39.6%) / literary 1,141 (35.6%)
- conversational 1,113 (34.8%) / general_proficiency 902 (28.2%) / business_english 816 (25.5%)

**Domain 활용도**:
- general 1,707 / academic 849 / literature 687 / business 682
- science_tech 536 / news_media 505 / entertainment 226 / travel_culture 119
- Day 3 rule_v1 0/241이던 science_tech 정상화 — 의미 인식 정확.

**Skill Level**: L3=2,183 (68%), L4=694 (22%, 다의어+multi-word), L2=316, L1=7, L5=2.

**데이터 정합 의심 13건 / 7유형** (`vrl_data_integrity_concerns` 테이블):
- `pos_label_concatenated` 5건 (beauxiliary, maymodal, mightmodal, misle, wouldmodal)
- `inflected_form_as_entry` 2건 (barged, bowled)
- `truncated_or_split_word` 2건 (spre, unlo)
- `tag_band_mismatch` 1건 (aviate — csat-prep-core 태그 vs 24k 빈도)
- `name_initial` 1건 (al), `misspelled_or_duplicate` 1건 (shwa), `compound_word_no_space` 1건 (sciencefiction)
→ 데이터 적재 파이프라인 검토 권장 (별도 cleanup phase).

**작동 가설 검증**:
- 가설: rule_v1 정확도 ~35-40%
- 결과: L7 유지율 38.6% — 정확히 검증됨

**Trigger 영구화 효과**: `trg_enforce_track_keys` / `trg_enforce_domain_keys` 가 batch 중 ~10건의 news_media 슬립 자동 차단 — 데이터 무결성 인프라 가치 입증.

**Why**: rule_v1 자체가 30개의 boolean rule 분기 — 의미 맥락(예: ramadan 종교 vs MOEL 태그) 인식 불가. Claude Code 가 학습자 관점 + over-tagging 인식 + 한국 차용어/문화 매핑 동시 처리.

**How to apply**:
- Round 2 후보: L6 (1,933), L5 (965), L8 (3,254), L9 (9,254), L10-11 (보류 권장)
- 200 row batch가 효율 우수 (100 row 대비 응답/검증 1회)
- per-batch approval 패턴 + DB-side set parity 검증 (`EXCEPT` 기반) 필수
- track key는 6종, domain은 8종 — trigger 가 enforce하지만 SQL 작성 시도 명시적 검증
- 신규 data integrity 발견 시 즉시 `vrl_data_integrity_concerns` 등록 (수정은 별도 phase)

**다음**:
- Round 2 L6 (1,933 row, ~10 batch 200 단위) — Round 1 결과 보정으로 일부 L7 진입 예상
- 또는 활용 시스템 (Day 4-6): `calculate-book-vrl-v3.ts` · 진단 시드 · 자동 단어장 85개

관련: [[vrl-v3-day1-done]] [[vrl-v3-day2-done]] [[vrl-v3-day3-done]] [[claude-code-is-llm]]

