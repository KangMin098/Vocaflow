> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_dict_sense_completion_v5_v6.md
> category: project

---

멀티세션 런북 `scripts/dict/SENSE_COMPLETION_MULTISESSION.md` 의 **S2 담당(V-Level 5,6)** 를 out-dir `scripts/dict/sc-v5_6` 로 실행 (2026-07-14 세션, 이전 세션서 이어받음).

**결과 (수렴)**:
- **V5**: 5 wave, ~67 multi-sense 적용 → **43.7%** multi-sense (580/1328 content noun/verb/adj alpha non-ing). net-applied 궤적 31→16→5→10→5.
- **V6**: 4 wave, ~87 multi-sense 적용 (50→13→13→11) → **35.6%** multi-sense (652/1829). wave1이 대량(50), 이후 long tail.

**핵심 구조 발견 (런북 결함)**: 런북의 `targets: 0` 종료조건은 **구조적으로 도달 불가**. `targets`=모든 단일-sense content 단어인데, V5/V6 어휘 대다수(-tion/-ment 학술명사·-ous/-ive 형용사·행위자명사·기술어)가 **진짜 단일-POS** → 에이전트가 영구 skip → 매 wave target으로 잔존. 실제 종료 = **flatline**(pass당 net-applied ~10, 잔여는 legit 단일-POS). V5 748·V6 1177 잔여 target은 대부분 정당. 더 갈면 정확도>수량 원칙 훼손(에이전트가 억지 sense 추가).

**Rejected floor (중요)**: 단일-POS gloss/pos 교정은 `meanings_ko` length-1 → `sense-apply.mjs`가 **reject**(≥2 sense 요구) → 매 wave 재-flag되고 영원히 미적용. 직접 교정함(service-role, 단일-sense row만 가드):
- V5: pretreatment(대우→전처리)·recombination(결합→재조합)·redefinition(정의→재정의)·referral(pos adj→noun)·resettlement(해결→재정착)
- V6: conduction(수행→전도)·disable(pos adj→verb)·impurity(**순수함→불순물, 반의어 오류**)·insensitivity(**민감함→무감각, 반의어 오류**)·retrial(pos adj→noun)
- 교정 후 V6 wave4 rejected=0 확인(floor 재-flag 소멸).

**재사용 스크립트**(sc-v5_6 throwaway 헬퍼): `_sc_progress.mjs V`(multi% 측정)·`_sc_harvest.mjs`(.out.json서 length-1 교정 수확, rm 전)·`_sc_floor_fix*.mjs`(직접 gloss/pos update). sc-* dir는 gitignore(커밋 불요, DB가 결과).

관련: [[project_dict_sense_completion_v11]] · [[project_dict_context_sense_matching]] · [[feedback_handoff_workflow]]

