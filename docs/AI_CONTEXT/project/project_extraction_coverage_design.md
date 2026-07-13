> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_extraction_coverage_design.md
> category: project

---

**사용자 요구**: "사전db 전체를 굴절형·파생형 뜻 그대로 단어추출 되도록" (도서 표본 아님, 전체 사전). 여러 번 재확인 = 각 형태가 **자체(올바른) 뜻으로 추출/조회**되어야 함.

**⚠️ 절대 하지 말 것 — 규칙으로 굴절/파생 표제어 대량 생성 금지**: SQL 규칙은 어떤 형태가 실단어인지 판별 못 해 **쓰레기 날조**(`abashederness`·`ablesness` 등). 2026-07-13 시도했다 68,246 row 오염→전량 롤백. 형용사에 복수 -s·비교급 -er/est 무분별 적용 + 굴절형(pos 상속)에 -ness 복합. 기존 `scripts/dict/clean-inflected-forms.mjs` 주석도 명시: **"신규 규칙형 생성 안 함(information→informations 오생성 차단)"**.

**기존 굴절형 인프라 (이미 완비, 재작업 불요)** — 2026-06-13 v06.41 마이그 4종(`20260613140000~170000`):
- `shared_dictionary.inflected_forms text[]` (GIN): lemma별 불규칙/클러스터 굴절형.
- `en_inflection_bases(surface)`: **규칙 역굴절** 함수(surface→후보 base들).
- `english_irregular_forms` 테이블(불규칙 동사 133 base) + clean-inflected-forms.mjs(정제, 결정적).
- **`lookup_word_meaning(surface)` 4-tier**(리더 툴팁): direct → `en_inflection_bases`(inflection) → `spelling_variants`(variant) → `inflected_forms @> ARRAY[s]`(cluster).
- **`extract_vocabulary_for_user_v2` 2-layer**(/text 추출): L1 direct → L2 `inflected_forms @> ARRAY[surface]`.
- 검증(2026-07-13): galloped→gallop(inflection)·studied→study·happier→happy·children→child(cluster) 전부 뜻 그대로 해소 ✓. **굴절형은 winkNLP 적재 lemma화 + 이 해소로 이미 추출됨**(별도 표제어 불요).
- ※ **`inflections` jsonb 컬럼(≠inflected_forms)은 해소에서 미사용**(freq/provenance 보존용). `select_book_chapter_vocab`/`select_article_vocab`(라이브러리 큐레이션)은 해소층 미탑재 → winkNLP `bv.lemma`에만 의존(불규칙 winkNLP miss는 저-V 동형명사라 v≥6 필터로 무해).

**파생형 = headword로 처리(자체 뜻)**: 역굴절이 파생 커버 안 함(뜻이 base와 다름) → 자체 표제어 필요. `classified_by='claude_code_derivational'`. 소스=`data/seed/derivational-candidates.json`(**빈도 코퍼스 검증 실단어 2,494**, form+base+base_meaning+freq=전체 사전 기반). 2026-07-13: 기존 6,180 + 검증 소스 미등록 93(recognise·regulatory·auditory·forestry 등) + 도서 rare 114(ebullition·volubility 등 C2) 채움 → **검증 소스 100% 커버**, derivational 6,387. 사전 45,496→45,703. `word,pos`만 NOT NULL; `classified_by` CHECK=rule_v1/claude_code_opus_4_7/sonnet_4_6/derivational/opus_4_8/fable_5만.

**파생 해소 tier 추가(2026-07-13, 마이그 `20260713150000`)**: rare 미등록 파생형(dreamlike·kinglike·boyishly)이 `not_found`이던 문제 → `lookup_word_meaning`에 **tier 5** 추가: 4-tier(direct→en_inflection_bases→variant→inflected_forms cluster) 실패 시 투명 접미사(-ly/ily/ically/ness/iness/less/iless/ful/fully/ish/like/wise) 벗겨 **base 표제어 뜻 폴백**. **base 존재 시에만 해소=쓰레기 불가**(runtime, 데이터 생성 아님). 검증 20/20 해소·not_found 0. 전체 사전 base 대상. ⚠️ **표제어 대량 생성 대신 runtime 역-strip 해소가 정답**(forward 생성은 abashederness 날조). 잔여: 명사화(-tion/-ment)는 base 뜻 POS-불일치라 tier5 미포함(대부분 이미 표제어). 추출 함수(extract_vocabulary_for_user_v2 L2·select_book_chapter_vocab)는 굴절만 해소, 파생 tier 미배선(후속 옵션).

**도서 단어추출 해소(2026-07-13, 마이그 `20260713160000`+`160500`)**: 사용자 "도서 단어추출 시에도 굴절/파생형이 추출되고 뜻이 사전에서 나와야". `select_book_chapter_vocab`은 winkNLP `bv.lemma` 직접 JOIN만 해 미매칭 형태 탈락 → **`resolve_dict_headword(surface)` 헬퍼**(direct→inflected_forms cluster→en_inflection_bases→투명 파생 strip; base 실재 시에만=쓰레기 0; 파생 strip base 길이≥4+junk 제외) 신설 → JOIN을 `sd.word=resolve_dict_headword(COALESCE(bv.lemma,bv.word))`로 교체(시그니처 동일=호출부 무변). 회수 실증: darkish→dark·motherless→mother·uncomfortableness→uncomfortable. 방언 오해소(reely→ree·actuly→junk) 차단(길이≥4+junk 삭제 `foreign_word_proxy` 1건). Huck Finn 검증: study 목록 무오염. select_article_vocab는 동일 배선 미적용(도서만 지시).

**⚠️ forward 규칙 대량 생성 2회 실패 확정**: (1) 형용사+복수/비교급 → `abashederness` (2) 형용사→-ly → `unprotectedly`·`whitishly` 비표준 날조. 둘 다 롤백. **정답=runtime 역-strip 해소**(base 실재 검증으로 쓰레기 원천 차단), forward 생성 금지.

**추출 표시=실제 표면형 + 형태별 POS 뜻(2026-07-13, 마이그 `161000`+`161500`)**: 사용자 "ransomed 추출되면 ransomed 뜻(동사)이 나와야; children이면 children이 그대로". → `select_book_chapter_vocab`: `word`=실제 도서 표면형(lower(bv.word)), `lemma`=해소 표제어. **sense 선택에 POS 추론 추가**: `COALESCE(bv.context_pos, 형태추론)` — context_pos NULL(구 적재 도서)일 때 표면형↔표제어 형태차로 추론(+ed/d/ied·+ing→verb·+ly→adverb·-tion/ness/ity/ance/ence→noun·-ous/ive/ful/less/ish/able→adjective). 실증: ransomed→동사"몸값을 치르고 풀어주다"·scented·tilted·grumbling 동사 뜻. **맞는 sense 없으면 대표 뜻 폴백=polysemy gap 노출**(boom·ransom 동사 sense 없어 보강함). **완전 정확은 (1) 전 단어 sense 완비 (2) context_pos 백필 필요** — 지속 사전 보강. dedup=표제어 단위.

**결론**: 굴절형·파생형 뜻-그대로는 **조회(lookup 5-tier)·도서추출(resolve_dict_headword JOIN + 형태 POS 추론) 양쪽에서 전체 사전 동작**. 흔한 파생형=자체 headword(검증소스 100%), 미등록=역-strip base 폴백. 규칙 forward 대량생성 금지. 잔여=polysemy sense 완비(형태 POS 추론이 gap 노출).

