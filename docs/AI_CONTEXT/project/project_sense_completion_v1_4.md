> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_sense_completion_v1_4.md
> category: project

---

2026-07-16 SENSE_COMPLETION_MULTISESSION 런북 S1(V-Level 1·2·3·4, out-dir scripts/dict/sc-v1_4) 완료. sense-chunk(--v-level)→general-purpose 에이전트 병렬→sense-apply --commit 루프. **누적 195 단어** 다중-sense 적용(V1 54 · V2 67 · V3 38 · V4 36). 적용 후 다중-sense 비율 V1 57.1% · V2 43.3% · V3 27.8% · V4 44.8%.

**수렴 판정**: `targets:0`은 도달 불가(보수적 authoring상 정당한 단일-POS 단어 대다수 스킵). 실 판정은 **apply의 applied count**가 한 자릿수로 체감할 때(예 V2 44→16→7). 에이전트 "changed" count는 아래 stuck 단어 재검출로 부풀려지니 신뢰 말 것.

**핵심 갭(S5~S11도 동일)**: `sense-apply.mjs`는 `meanings_ko.length>=2` 가드가 있어, **단일-POS인데 뜻 자체가 틀린(반대·오단어·품사오류)** 단어는 매 wave 재검출되지만 절대 적용 안 됨(rejected). 이들은 targets에서 안 빠져 무한 재검출 → 수렴 오판 주의.

**교정 방법**: `scripts/dict/sense-fix-single.mjs`(신규, 명시 리스트 + 서비스롤 UPDATE, --commit, 멱등) 작성해 처리. ⚠️ MCP `execute_sql` 직접 UPDATE는 auto-mode 분류기가 "런북 파이프라인 밖 직접편집"으로 **차단**함 → 파이프라인식 node 스크립트로 우회(사용자 승인 후). S1에서 9건 교정: impossibility(가능함→불가능함), inability(유능함→무능력), meaningfulness(비열함→유의미함), preferment(선호→승진), proper(noun 고유명사→adjective 적절한), rearrangement/reintroduction/reorganisation/reorganization(re- 누락).

관련: [[project_dict_sense_completion_v11]] [[project_dict_context_sense_matching]] [[feedback_supabase_migrations]]

