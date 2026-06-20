> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_vrl_v_level_pure_semantic.md
> category: project

---

VRL v3 `shared_dictionary.v_level` 의미를 **pure semantic difficulty** 로 확정. 2026-05-25 결정.

**Why**: 이전 정의 (Round 1-10) 는 mixed — `list_tags` (NGSL/csat-prep/BSL/NAWL/moel/bel/fel/tsl) 빈도/도메인 신호를 V-Level 산정에 포함하여 한국 학습자 노출 빈도까지 반영했음. 그러나 `/text/new` 추출 composite 가 이미 `frequency_boost` weight (0.15) 로 빈도를 별도 가산 — V-Level mixed 정의는 double-count 야기. SSoT 단순화 위해 V-Level 은 **의미·통사 난이도만**, frequency 는 별도 컬럼 (`frequency_rank`, `lexicon_frequencies`) + composite weight 로 분리.

**How to apply**:

1. **분류 작업 (subagent prompt 필수 추가 문구)**:
   > V-Level 은 **의미·통사 난이도만** 평가. `list_tags` (NGSL/csat-prep/BSL/NAWL/moel/bel/fel/tsl 등) 의 빈도/도메인 신호는 `track_levels` / `domain_levels` 에만 반영하고 `v_level` 산정에서는 **무시**. "한국 학습자에게 흔하다" 는 이유로 v_level 을 낮추지 말 것. 예: `ram` (NGSL high-freq + 의미 B2-C1) → V7 (V5 아님), `wolf` → V6-V7, `crow` → V6.

2. **Frequency 는 추출 composite 에서 보정**:
   - 현재 `extract_vocabulary_for_user` RPC composite:
     `0.50·v_proximity + 0.25·track_boost + 0.15·frequency_boost + skill_penalty + archaic_penalty`
   - V-Level pure semantic 전환 후 `frequency_boost` weight 유지 또는 0.20 상향 검토
   - NGSL 단어가 추출 안 되는 문제 시 weight 조정으로 해결 (V-Level 손대지 말 것)

3. **Track / Domain 은 빈도/도메인 신호 그대로 사용** — 변경 없음:
   - `track_levels.csat_korean` ← csat-prep tag
   - `track_levels.business_english` ← BSL tag
   - `track_levels.academic_english` ← NAWL tag
   - `domain_levels.academic` ← NAWL/MOEL tag
   - `domain_levels.literature` ← BEL tag
   - 등

4. **재분류 범위** (D→A→B 순차 적용 2026-05-25):
   - **D**: 정의 문서화 (이 메모리)
   - **A**: Round 11B 파일럿 200 row 만 pure semantic respawn → apply → 검증
   - **B**: V≥10 + NGSL ~3,288 row fan-out (~17 subagents 병렬)
   - **C (보류)**: 전체 38,598 row 재감사 — Round 1-10 결과 누적 cost 막대, B 결과 검증 후 결정. Round 1-7 (per-word L0-L8) 은 비교적 정합, Round 8-10 (L9-L11 SQL bulk) 가 가장 큰 보정 대상.

5. **검증 지표**:
   - V≥10 + NGSL + rank<10000 row count 가 ~3,488 에서 줄어드는지
   - V-Level 분포가 V6-V8 권역으로 살짝 이동 (V5-V6 으로 과도하게 내려가는 것 X)
   - 의학/문학/학술 specialty (moel/bel/nawl) 는 V8-V9 유지

관련: [[vrl-v3-round10-l11-done]] [[vrl-phase3a-text-new-extraction]] [[claude-code-is-llm]]

