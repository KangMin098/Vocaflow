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

**주의/잔여**:
- `shared_word_sets.category` CHECK 제약(elementary/middle/high/csat/eng_test/civil/business/themed/library_book/library_article) — 'etymology'는 불가라 themed+subcategory 사용.
- `shared_words.chapter`=smallint(텍스트 라벨 불가) → 라벨은 korean_learner_note.
- 잔여: 매핑 확장(학습밴드 2,304 중 1,500 발행) · `regenerate_auto_curated_set` 등 RPC에 root 축(`curation_query {org:'root'}`) 실행 배선 미구현 · 추출 파생어 인식·니모닉(G5) 연계 · confidence 검수.

설계 문서: `docs/AI_CONTEXT/diagnostics/dict_commercial_wordset_design_20260717.md`.

