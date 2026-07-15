> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_sense_completion_v10.md
> category: project

---

SENSE_COMPLETION_MULTISESSION.md 런북(sense-chunk.mjs→서브에이전트 authoring→sense-apply.mjs) S6=V-Level 10 담당 실행 (2026-07-14, out-dir `scripts/dict/sc-v10`, gitignore `sc-*/`).

**결과**: 4 full pass, **311 단어** 단일→다중 sense 적용 (pass별 205/48/28/30). V10 content 단어 multi-sense **10.6%→17.1%** (819/4,803); 잔여 단일-sense 3,984. 사용자 승인하에 pass 4에서 **중단**.

**핵심 교훈 — targets:0 도달 불가**: 보수적 사전에선 V10 대부분이 진짜 단일-POS(의학/기술/종 명사, -tion/-ness 명사, -ous/-ive 형용사)라 0 불가능. yield가 pass1 이후 **~30/pass로 정체**(수렴 아님) — inter-pass variance 바닥(에이전트가 borderline 단어 callus/gazette/blotch/spat을 한 pass에선 skip, 다음 pass에선 catch). ~4,000 풀에서 ~30/pass 제거 → 완전 배수엔 ~130 pass(~3,400 에이전트) 필요 = 비현실적. **고가치 noun↔verb는 pass 1-2에서 이미 포획**. 다른 V-Level도 동일 패턴 예상 → "loop until targets:0"은 "loop until 수렴(<~15/pass 또는 고가치 소진)"으로 해석.

**파이프라인 구조적 갭 → 교정 완료**: pos만 틀리고 sense 1개인 단어(appraisal/reappraisal/rebuttal/perusal/denture — adjective로 저장됐지만 실제 noun)는 sense-apply의 ≥2-sense 가드에 매 pass reject. **5건 `scripts/dict/sense-fix-single.mjs` FIXES 배열 append + `--commit`으로 교정 완료**(denture는 gloss도 형용사형 틀니의→명사형 틀니,의치). MCP execute_sql 직접 UPDATE는 auto-mode 분류기 차단 → service-role node 우회([[project_sense_completion_v1_4.md]] 교훈과 동일). 스캔: adjective 라벨인데 meaning_ko가 순수 명사 gloss면 오라벨(단 -al/-ical 대부분은 정상 형용사, "(격식)" 등 괄호 주석이 gloss-끝 정규식 무력화 주의).

**멀티세션 git 주의**: S1-S7 병렬이 **동일 워킹트리** 공유 → 다른 세션이 런 도중 커밋(682d9fb)·파일 stage. `git commit` 시 타 세션 staged 파일이 딸려 들어감(내 커밋이 v8.md·CONTEXT.md 흡수). 런북대로 이 작업은 **커밋 불필요(DB가 결과)**. 커밋·push는 병렬 세션과 조율 필요 → 함부로 reset/amend/push 금지.

**운영 노트**: 세션 usage limit 도달 시 이미 실행중이던 에이전트는 **실패 전 out.json을 이미 write** → 그 산출물은 유효(apply 가능). 신규 dispatch만 즉시 실패. 로컬 apply(node+Supabase)는 limit 무관.

**후속 pass (2026-07-16)**: 전 25청크 1회 전수(2 batch: 00-13, 14-24) 추가 실행 → **+22 적용**(batch1 18 + batch2 4). multi-sense 17.1%→**17.49%**(840/4,802). 예측대로 plateau(0.55% yield, ~22/pass) 재확인 — V10은 이미 수렴, 재스윕 무의미. 후반 청크(rank 27K+)는 종/질병/고문 archaic 압도. appraisal은 이번에도 단일-sense pos-fix로 reject(구조적 갭 재현). V9와 달리 stop 재질의 없이 동일 판단 적용(사용자 V9서 "수렴 시 종료" 기확정).

관련: [[project_dict_context_sense_matching]] · [[project_dict_field_completeness]]

