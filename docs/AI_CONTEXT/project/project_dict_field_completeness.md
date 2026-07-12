> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_dict_field_completeness.md
> category: project

---

**v06.225 Phase 5** — 사용자 지시 "빈도수 상관없이 레벨별 있어야 할 단어 정보 항목 모두 점검". sense/POS([[project_dict_context_sense_matching]])와 별개로 학습자-대면 **필드 완비**를 v_level별 전수 감사.

**감사 결과(shared_dictionary 45,496)**: meaning_ko·meanings_ko·pos·cefr·v_level = **100%**. example 84.5% · ipa 64% · synonyms 59% · inflections 55% · collocations 31% · antonyms 31% · korean_learner_note 27%. **audio_url·image_url·mnemonic_ko = 0%**(별도 에셋/런타임 파이프라인 미구축, 데이터 결측 아님 — 스코프 외). 결측은 v_level이 아니라 과거 **빈도-기반 dict-fill**([[project_dict_fill_top5k_done]] 등) 잔재로 전 레벨 산재.

**예문 전수 채움 완료(2026-07-13)**: 사용자 "전체 계속(끝까지)" 선택. 실 단일어(pos∉idiom/phrasal · word에 공백 없음 · word_register∉archaic_literary/period_cultural) 결측 **2,548개** → Claude(=LLM) 문맥·sense 예문 생성, 15배치. **전 레벨 V1~V11 example 100%** 달성. 전체 사전 example 84.5%→**90.1%**. 잔여 결측 4,517 = **전량 관용구/구동사/다어절/고어**(독립 예문이 부적절한 단위 → 정당한 스킵). 저-레벨 결측은 대부분 고유명사·브랜드(™)·약어·영국식 철자·합성어였고, V10-11은 초희귀 파생어·음식·동물·명명대상이 압도.

**적용 방식**: `UPDATE shared_dictionary SET example_en=v.ex FROM (VALUES ...) v(word,ex) WHERE word=v.word AND (example_en IS NULL OR example_en='')`. 배치당 100~200. 특수문자 키(™·é·ñ·curly ’·straight ' 이중따옴표 이스케이프) 정확 매칭. 예문엔 apostrophe 회피(escaping 단순화).

**남은 필드 결측(후속 배치 대상)**: ipa 실 단일어 ~10,594 · synonyms ~15K · collocations V11 거의 전무. 감사 쿼리 재사용 가능(v_level별 `count(*) FILTER (WHERE <field> ...)`).

**추출 품질 개선 항목 6개(2026-07-13 도출, 발음 제외)** — 추출 함수가 쓰는 게이트/스코어/조인 필드 진단:
1. **word_register 노이즈 카테고리 — ✅ 구현 완료**: brand(™ 96)·abbreviation(무모음 2~5자 129)·proper_noun 신설(CHECK 마이그 `20260713100000`), 추출 함수 제외 확장(`20260713100500`). **proper_noun 분류는 후속**(고유명사 소문자화돼 패턴 어려움 → LLM 패스 필요).
2. **frequency_rank NULL 백필(잔여)**: `_extract_composite_score`가 NULL rank→0.40 가중 **완전 0점**. study-tier plain V6-10 **5,890**개 불이익. 빈도 코퍼스 백필 또는 함수가 NULL을 중립처리하도록 보정.
3. **사전 커버리지 갭(잔여)**: 발행 도서 단어 **19.5%(4,669)** 미등록→추출 불가. 성격=OCR/방언 오류+고유명사+희귀. 상류 tokenization/OCR-clean 갭. stage_book_dict_candidates 드레인 + 노이즈 게이트.
4. **다의어 sense 완성도(잔여)**: rank≤5000 단일-sense 3,027(동일-POS 다의어 사각, light 빛·match 성냥). 배치 재검수.
5. **spelling_variants 미활용(잔여)**: 114만 채움, 영/미 변형 dedup 부재.
6. **verified false 73%(저우선)**: composite 0.10이나 예문 90%로 상쇄.

