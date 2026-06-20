> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_vrl_v3_round4_l012_done.md
> category: project

---

VRL v3 Round 4 (rule_v1 Level 0/1/2 전체 581 row 검증) + Step 1 modal/linking DELETE 11 완료 — 2026-05-24.

**배경**: 사용자 질문 "왜 V-Level 3 이하 0건?" — Round 1-3 (L7/L6/L5) 의심 sample 에서 L0-L2 자체가 over-leveled. 가설: rule_v1 L0/L1/L2 단어들이 실제로는 V-Level 1-3 권역.

**Step 1 — Data Integrity Cleanup** (11 DELETE):
- pos_label_concatenated 11건 DELETE: beauxiliary · maymodal · mightmodal · wouldmodal · couldmodal · mustmodal · ought tomodal · willmodal · equallinking · weighlinking · misle
- 정상 root 단어 (be/may/might/would/could/must/will/ought/equal/weigh) 모두 shared_dictionary 에 존재 — DELETE 안전
- CASCADE: dictionary_word_categories · lexicon_frequencies · vrl_diagnostic_questions · claude_classification_samples · vrl_data_integrity_concerns → 자동 정리
- SET NULL: vocabularies · shared_words · library_book/article_vocabularies → 사용자 자산 보존
- shared_dictionary: 38,630 → **38,619** (-11)
- vrl_data_integrity_concerns: 22 → 11 (CASCADE)

**Step 2 — Round 4 분류 (3 batch · 581 row)**:
- Batch 1: L0 116 + L1 84 = 200 row
- Batch 2: L1 31 + L2 169 = 200 row
- Batch 3: L2 final 181 row
- 누적: 581 row → V-Level 1 (87%), V2 (16%), V0 (data integrity 1건), V3 (1%), V6-V7 (각 1건 잔존 compound)

**V-Level 매핑 결과**:

| rule_v1 | 총 row | V0 | V1 | V2 | V3 | V6-7 |
|---|---:|---:|---:|---:|---:|---:|
| L0 (5-7세 유아) | 116 | 0 | 89 (76.7%) | 26 (22.4%) | 1 | 0 |
| L1 (초1-2) | 115 | 0 | 80 (69.6%) | 32 (27.8%) | 3 (2.6%) | 0 |
| L2 (초3-6) | 350 | 1 | 296 (84.6%) | 51 (14.6%) | 0 | 2 |

**가설 확정**:
- rule_v1 L0/L1/L2 = **systematic over-leveling**: 거의 모든 단어가 V-Level 1 (early elementary) 으로 하향 보정
- 진정한 V-Level 0 (toddler) 단어는 sample 581 row 중 **0건** (feellinking 1건은 data integrity artifact, 정상 어휘 아님)
- 한국 학습자 관점 — NGSL 핵심어 (have/do/go/the/a/be 등) 는 "초등 저학년 핵심" = V-Level 1 적정. rule_v1 의 L0 ("5-7세 유아") 은 실제 영어 학습 cohort 에 사실상 비어있음.

**Skill Level 분포 (Round 4)**:
- L3 (single_word): ~90%
- L4 (compound/idiom/phrasal_verb): ~10% — bus stop, dining room, phone call, grow up, excuse me 등

**데이터 정합 의심 (Round 4 신규)**:
- **feellinking** — linking family 3번째 concat artifact (equallinking, weighlinking 와 동일 패턴)
- 누적 12건 잔존 (Step 1 cleanup 후 11 + R4 신규 1):
  - pos_label_concatenated: feellinking
  - inflected_form_as_entry: barged, bowled (2)
  - misspelled_or_duplicate: shwa
  - name_initial: al, b, e (3)
  - tag_band_mismatch: aviate, repertoire (2)
  - truncated_or_split_word: spre, unlo (2)
  - compound_word_no_space: sciencefiction

**Trigger 영구화 효과**: track 6-key / domain 8-key 엄격 enforce — 3 batch 전체 zero rogue key (Round 1-4 누적 7,251 UPDATE — 581+6,670 — 모두 정합).

**Why**: rule_v1 의 토대 자체가 한국 학습자 영어 학습 cohort 와 일치하지 않음. "5-7세 유아 영어" 카테고리는 한국 어휘 학습 시장에 사실상 존재하지 않으므로 V-Level 0 은 비어있고, V-Level 1 (early elementary) 부터가 진정한 시작점.

**누적 진행 (Round 1+2+3+4 + Step 1)**:
- shared_dictionary: 38,630 → **38,619** (-11 DELETE)
- reclassified: **6,670 / 38,619 row (17.27%)**
- 5 round × ~1,000-3,000 row 각 (L7 3,202 + L6 1,933 + L5 965 + L0/L1/L2 581 = 6,681 — 11 DELETE overlap = 6,670)
- 데이터 정합 의심: Round 1-3 누적 22 → Step 1 후 11 → Round 4 신규 1 = **12건 잔존**

**How to apply**:
- 진단 시드 설계: V-Level 0 사용 X — V-Level 1 부터 시작
- 자동 단어장 85개: V-Level 1 (early elementary) 카테고리에 581 row 의 89% (516 row) 집중
- Round 5 후보: L8 (3,254 row) — formal/academic band, 가설 검증: L7 상향분 + L5 상향분 정합
- 잔존 12건 data integrity:
  - feellinking → Step 1 패턴으로 DELETE 가능 (linking family completion)
  - inflected forms (barged/bowled) → root entry merge 권장
  - name_initial (al/b/e) → DELETE 권장 (정상 root 단어 아님)
  - 기타 (sciencefiction/aviate/repertoire/spre/unlo/shwa) → 케이스별 판정

**다음**:
- Round 5 L8 또는 활용 시스템 (Day 4-6: book VRL · 진단 시드 · 자동 단어장 85개) 또는 잔존 data integrity 일괄 cleanup

관련: [[vrl-v3-day1-done]] [[vrl-v3-day2-done]] [[vrl-v3-day3-done]] [[vrl-v3-round1-l7-done]] [[vrl-v3-round2-l6-done]] [[vrl-v3-round3-l5-done]] [[claude-code-is-llm]]

