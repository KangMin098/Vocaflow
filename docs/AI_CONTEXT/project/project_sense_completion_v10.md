> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_sense_completion_v10.md
> category: project

---

SENSE_COMPLETION_MULTISESSION.md 런북(sense-chunk.mjs→서브에이전트 authoring→sense-apply.mjs) S6=V-Level 10 담당 실행 (2026-07-14, out-dir `scripts/dict/sc-v10`, gitignore `sc-*/`).

**결과**: 4 full pass, **311 단어** 단일→다중 sense 적용 (pass별 205/48/28/30). V10 content 단어 multi-sense **10.6%→17.1%** (819/4,803); 잔여 단일-sense 3,984. 사용자 승인하에 pass 4에서 **중단**.

**핵심 교훈 — targets:0 도달 불가**: 보수적 사전에선 V10 대부분이 진짜 단일-POS(의학/기술/종 명사, -tion/-ness 명사, -ous/-ive 형용사)라 0 불가능. yield가 pass1 이후 **~30/pass로 정체**(수렴 아님) — inter-pass variance 바닥(에이전트가 borderline 단어 callus/gazette/blotch/spat을 한 pass에선 skip, 다음 pass에선 catch). ~4,000 풀에서 ~30/pass 제거 → 완전 배수엔 ~130 pass(~3,400 에이전트) 필요 = 비현실적. **고가치 noun↔verb는 pass 1-2에서 이미 포획**. 다른 V-Level도 동일 패턴 예상 → "loop until targets:0"은 "loop until 수렴(<~15/pass 또는 고가치 소진)"으로 해석.

**파이프라인 구조적 갭**: pos만 틀리고 sense 1개인 단어(appraisal/reappraisal/rebuttal/perusal/denture 등 ~5/pass)는 sense-apply의 ≥2-sense 가드에 매 pass reject → 영구 재출현. adjective로 잘못 저장됐지만 실제 noun. **단일-sense pos 교정 별도 툴 필요**(현 런북 범위 밖).

**운영 노트**: 세션 usage limit 도달 시 이미 실행중이던 에이전트는 **실패 전 out.json을 이미 write** → 그 산출물은 유효(apply 가능). 신규 dispatch만 즉시 실패. 로컬 apply(node+Supabase)는 limit 무관.

관련: [[project_dict_context_sense_matching]] · [[project_dict_field_completeness]]

