> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_dict_field_completeness.md
> category: project

---

**v06.225 Phase 5** — 사용자 지시 "빈도수 상관없이 레벨별 있어야 할 단어 정보 항목 모두 점검". sense/POS([[project_dict_context_sense_matching]])와 별개로 학습자-대면 **필드 완비**를 v_level별 전수 감사.

**감사 결과(shared_dictionary 45,496)**: meaning_ko·meanings_ko·pos·cefr·v_level = **100%**. example 84.5% · ipa 64% · synonyms 59% · inflections 55% · collocations 31% · antonyms 31% · korean_learner_note 27%. **audio_url·image_url·mnemonic_ko = 0%**(별도 에셋/런타임 파이프라인 미구축, 데이터 결측 아님 — 스코프 외). 결측은 v_level이 아니라 과거 **빈도-기반 dict-fill**([[project_dict_fill_top5k_done]] 등) 잔재로 전 레벨 산재.

**예문 전수 채움 완료(2026-07-13)**: 사용자 "전체 계속(끝까지)" 선택. 실 단일어(pos∉idiom/phrasal · word에 공백 없음 · word_register∉archaic_literary/period_cultural) 결측 **2,548개** → Claude(=LLM) 문맥·sense 예문 생성, 15배치. **전 레벨 V1~V11 example 100%** 달성. 전체 사전 example 84.5%→**90.1%**. 잔여 결측 4,517 = **전량 관용구/구동사/다어절/고어**(독립 예문이 부적절한 단위 → 정당한 스킵). 저-레벨 결측은 대부분 고유명사·브랜드(™)·약어·영국식 철자·합성어였고, V10-11은 초희귀 파생어·음식·동물·명명대상이 압도.

**적용 방식**: `UPDATE shared_dictionary SET example_en=v.ex FROM (VALUES ...) v(word,ex) WHERE word=v.word AND (example_en IS NULL OR example_en='')`. 배치당 100~200. 특수문자 키(™·é·ñ·curly ’·straight ' 이중따옴표 이스케이프) 정확 매칭. 예문엔 apostrophe 회피(escaping 단순화).

**남은 필드 결측(후속 배치 대상)**: ipa 실 단일어 ~10,594 · synonyms ~15K · collocations V11 거의 전무. 감사 쿼리 재사용 가능(v_level별 `count(*) FILTER (WHERE <field> ...)`).

