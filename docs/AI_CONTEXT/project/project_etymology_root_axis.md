> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_etymology_root_axis.md
> category: project

---

시중 단어장 대응 분석([[project_dict_wave_plan_w0]] 후속) 결과 학년/수능/시험/주제는 이미 발행됨(shared_word_sets), **유일한 미대응 = 어원 단어장**(Word Smart류)이라 판정 → 구축.

**핵심 판단**: 어원 root는 **kaikki 불요** — 핵심 학술 root(spec=보다·port=나르다…)는 안정 표준지식이라 LLM 고신뢰(희귀어 어원 환각과 다름).

**구축(2026-07-17, 사용자 승인 후)**:
- **스키마** migration `20260717140000`: `word_roots`(어근·origin latin/greek/other·meaning_en·gloss_ko·variants·notes, root UNIQUE) + `word_root_links`(word·root_id·affix_type·confidence, (word,root_id) PK 멱등, 다중 root 허용). RLS 공개읽기.
- **시드** 181개: `scripts/dict/data/word-roots-seed.json` + `roots-seed.mjs`(멱등 upsert onConflict root).
- **매핑** 2,767 링크: `roots-map.mjs` chunk→6 서브에이전트가 **root→파생어족 생성**(어원학적 진짜 파생어만, coincidental substring 회피)→사전 실재 단어만 링크(후보 2,591 중 실재 2,472=95%). affix_type=root.notes 기본, confidence=4.
- **세트 발행** `etymology-core`: `roots-publish-set.mjs` → shared_word_sets(category `themed`/subcategory `etymology`) + shared_words 1,500단어·159 어근 챕터. **chapter=smallint(그룹번호)**·어근 라벨은 `korean_learner_note`("어근 spec — 보다"). 품질 검증 spec/dict/port/duc 전수 정확.

**렌더 검증(2026-07-17)**: e2e `09-etymology-set.spec.ts` 통과. **뷰어 수정 필요했음** — `VocabSetPreviewModal`이 챕터를 `Chapter N`(숫자만) 표시라 어근이 안 보였음 → 챕터 내 `korean_learner_note` 균일 시 어근 라벨을 챕터 헤딩으로 승격(책 챕터 무영향). **발견: 어원 세트가 themed 저중요도(categoryImportance=6)라 기본 추천 캐러셀 비노출** — /library/vocab 검색 "어원" 또는 테마별 필터로만 접근. 프로미넌스는 후속.

**이중배당 — 추출 어원 힌트(2026-07-17)**: `ExtractionPanel`이 추출 단어 표제어의 `word_root_links` 조회(loose client — 신규 테이블 database.ts 미반영) → 🏛 어근 칩(인라인 `🏛 spec`+expand "어원 spec(보다)"). e2e 08에 단언(통과). **`mnemonic_ko`는 admin(VocabularyDetailPanel) 전용 UI뿐 + shared_words에 mnemonic 필드 없음(korean_learner_note는 어근 라벨用) → 대량 니모닉 채움 대신 기존 근거 카드 surface 재사용**(UI 없는 데이터 채움 회피).

**주의/잔여**:
- `shared_word_sets.category` CHECK 제약(elementary/middle/high/csat/eng_test/civil/business/themed/library_book/library_article) — 'etymology'는 불가라 themed+subcategory 사용.
- `shared_words.chapter`=smallint(텍스트 라벨 불가) → 라벨은 korean_learner_note.
- 잔여: 매핑 확장(학습밴드 2,304 중 1,500 발행) · `regenerate_auto_curated_set` 등 RPC에 root 축(`curation_query {org:'root'}`) 실행 배선 미구현 · 추출 파생어 인식·니모닉(G5) 연계 · confidence 검수.

설계 문서: `docs/AI_CONTEXT/diagnostics/dict_commercial_wordset_design_20260717.md`.

