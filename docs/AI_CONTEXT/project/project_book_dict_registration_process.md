> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_book_dict_registration_process.md
> category: project

---

2026-05-31 — 사용자 원칙: **"단어 추출이 정상이려면 (1) 매핑될 건 매핑 + (2) 뜻이 있어야"**. 단순 매칭(찾기)은 무의미, 뜻이 핵심.

**`extract_book_vocabulary_admin(uuid,smallint)` 매핑 경로 = 3개뿐** (검증): `direct`(d.word=lbv.lemma) · `variants_persisted`(spelling_variants @>) · `inflection_recovery`(en_inflection_bases, **lemma NULL일 때만**). → **클러스터(`inflections` forms)·파생(en_derivational_bases) 미사용.** 그래서 불규칙 굴절(smote→smite)이 사전에 뜻 있어도 추출 누락, 파생/부정/복합 실단어(gladness·unaware·gateway)는 사전 부재로 뜻 없음.

**클러스터 false-member (중요)**: `inflections` 클러스터엔 굴절뿐 아니라 파생·부정이 섞임 — `unaware→aware`(반대뜻!)·`gladness→glad`(명사vs형용사)·`scrutinize→scrutiny`·`philosopher→philosophy`. → 추출/lookup 에 클러스터를 base 뜻으로 그냥 쓰면 **틀린 뜻**. 그래서 cluster base 의 meaning_ko 상속은 순수 굴절(smote→smite)만 맞고, 파생/부정은 **자체 뜻 seed** 필요. (이게 `lookup_word_meaning` 의 한계이기도 — 클릭 시 unaware→aware "알고있는" 반대뜻 노출됨.)

**등재 프로세스 (2-phase, Claude Code=LLM·런타임 키 없음 정합)**:
1. **stage** — `stage_book_dict_candidates(p_book_id)` (admin 가드, SECURITY DEFINER): 본문검수 중 책의 미등재 실단어 pending → `archaic_candidates.classification='addable_modern'`(등재 큐). 재출현 게이트(cron classify) 우회. `collect_archaic_candidates` 호출로 최신화. Admin UI = `BookExtractionPanel` "미등재 실단어 사전 등재 큐에 추가" 버튼 + `stageBookDictCandidates`(admin-queries).
2. **drain (Claude Code 배치)** — addable_modern 단어를 freq·cluster_base·deriv_base 힌트와 함께 SELECT → 자체 뜻 생성 → `shared_dictionary` INSERT(source='ai-generated', classified_by='claude_code_opus_4_7', ON CONFLICT word DO NOTHING) + 노이즈(불어/OCR) 분리 blacklist → `archaic_candidates` processed 마킹 → `backfill_book_lemmas(book_id)` 재실행 → 추출 정상.

`archaic_candidates` 가 word 단위라 **책 간 공통어 자동 dedup** (gladness·bravery 1회 등재로 다수 책 커버) — 사용자 "책마다 겹침" 정합.

실연 The Four Feathers(4d9e8891): freq≥2 ~85건 seed + 8 blacklist → lemma 92.2→93.9%, 신규 seed 56건 추출 후보 진입. 잔여 ~296 freq-1 long tail 은 동일 drain 으로 처리. Migration `stage_book_dict_candidates_fn`. [[project_lbv_lemma_null_breaks_extraction]] 의 backfill 게이트와 연속.

