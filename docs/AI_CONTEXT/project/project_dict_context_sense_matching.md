> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_dict_context_sense_matching.md
> category: project

---

**v06.225 (2026-07-12)** 큐레이션 단어추출의 sense/POS 오정렬 근본 근절.

**근본 원인**: `shared_dictionary`는 **단어당 1행 + v_level=최난이도 sense** 기준. 다의어가 기본 sense(저-V)+고급 sense(V≥6)를 가지면 행 v_level=고-V → 텍스트가 기본 용법을 써도 V≥6 필터 통과 → 고급 gloss로 오추출(B류). creep="변태"류(A류, primary 오선정)와는 별개 아키텍처 문제.

**해결(Phase 2·3)**:
- **Phase 2**: `library_book/article_vocabularies.context_pos` 컬럼(마이그 `20260712160000`). 백필 `scripts/backfill-context-pos.mts`(winkNLP로 first_sentence 태깅, multi-POS 단어만; book 1,507·article 212). 파이프라인 forward-wiring: `extract-lemmas.ts`가 chapter 지배 POS 계산 → `ChapterWord.context_pos` → `insert_book_analysis` RPC(`20260712170000`) + article 직삽입 → **신규 도서 자동**.
- **Phase 3**: `select_book_chapter_vocab`+`select_article_vocab`에 LATERAL JOIN(`20260712165000`) — `context_pos`로 `meanings_ko`에서 문맥 POS 일치 sense 선택 → **그 sense의 v_level로 V≥6 필터** + 그 sense gloss·pos 표시. NULL은 row 값 폴백(하위호환).

**sense별 v_level 모델**: `meanings_ko` 각 sense에 `v_level` 필드 추가. 예 `sole=[{adj,유일한,v5},{noun,발바닥,v6},{noun,서대,v9}]`. 수리 누적 **154단어**(초기 17 + 배치1 40 + 배치2 109 + 배치3 tail 5).

**검증**: creep(문맥 verb)→"기어가다" · sole(문맥 adj·v5)→Gibbon/Les Mis 추출 0건 · **idle(형용사 문맥)→추출 제외**(v5) · noble(형용사)→"고귀한"(v6) 정확(기본용법 오추출 근절 실증).

**잔여 sweep 종결(고가치 179 전량)**: 탐지기(`audit-dict-pos-mismatch.mts` / `dump-pos-candidates` 로직)로 후보 자동생성. 코퍼스 504건 → 고가치 179 → **배치1 40 + 배치2 109 + 배치3 tail 5 = 154단어**(누락 POS 추가·전 sense v_level·flat flip·형식 정규화·shared_words 동기화·context_pos 재백필). flat flip 예: breeze→"산들바람"·pine→"소나무"(v5)·vacuum→"진공"·crumble→"부서지다"·refrain→"삼가다"·inevitable→"불가피한". A류 오데이터: wan("WAN약어"→"창백한"). **종결 판정**: 남은 🟡·🔴는 (a) 인벤토리 완성돼 Phase 3가 이미 처리(grave·damp·bound 등) (b) flat-primary 정답 (c) 명사화/participle 노이즈(the unconscious·trample·lo·prior·temporal) — 추가 실익 낮음. row v_level은 VRL 산출물이라 불변(Phase 3가 sense v_level로 우회). 상세 `docs/proposals/dict-sense-quality-audit.md`.

**Phase 4 — 사전 전역 구조/POS 정규화(2026-07-12)**: 45,496단어 전수 스캔 → Phase 3를 구조적으로 무력화하던 결함 근절. **sense POS 약어(`n.`·`adj.`·`v.` ~5,000)가 context_pos(`noun` 풀폼)와 절대 매칭 안 되던 게 핵심** → 풀폼 정규화로 수천 단어 sense-매칭 즉시 활성화. + no_meanings 6,964→0(단일 sense 백필) · legacy string-array 773→0 · enrichment `sense_ko`→`meaning` additive 2,045 · flat pos 흔들림 16→0. ~9,800단어(21%) 정합 → 전역 균일 `{pos,meaning,v_level}`. 전부 무손실/additive, 추출 회귀 정상. **감사 쿼리 재사용**: `no_meanings`/`legacy string`/`nonstd sense pos`/`multi_pos_words` 카운트로 재점검 가능.

**발행 세트 재발행 = 보류(사용자 결정 2026-07-12)**: 수정 사전의 gloss는 `shared_words` 동기화로 이미 반영됨. 남은 건 membership 드리프트뿐 — v5 부여 기본어(damp·sole·pine·idle·minor)의 발행 노출 **총 59개**(실제 제거 대상은 그 부분집합). `publish_book_word_sets`는 기존 세트 SKIP이라 재발행=삭제+재생성(set_id 변경, destructive) + 동시 세션이 book word set 작업 중 → **불균형·위험**이라 보류. 소수 드리프트는 다음 정상 재발행 때 자동 교정.

관련: [[book_vocab_ssot_unify]] [[project_extraction_pipeline_p1_p4]] [[project_book_dict_registration_process]]

