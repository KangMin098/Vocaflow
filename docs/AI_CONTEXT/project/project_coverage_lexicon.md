> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_coverage_lexicon.md
> category: project

---

**문제**: 도서·스크립트에 코어 45k 밖 롱테일(고어·희귀·전문)이 등장 → 학습자 독해 시 "정의 없음". **학습 큐레이션 ≠ 독해 커버리지** (다른 요구).

**설계(2-tier·별도 테이블)**: `coverage_lexicon`(마이그 `create_coverage_lexicon`) = shared_dictionary와 **물리 분리·무오염**. 컬럼 `word(PK)·pos·gloss_en·ipa·meaning_ko·frequency_rank·source·seen_count`. **학습 로직(단어장·i+1·추천)은 조회 금지** — 오직 reader 폴백. 조회 체인: core→coverage→(kaikki gloss)→미상.

**소스 결론(여러 소스 검토 후)**:
- 정의/ipa = **kaikki 벌크**(단일어·content POS·form_of 제외·코어 밖). 처음 424,328행 적재 → **굴절형-of-코어 5,445 DELETE 후 정리**(추출이 lemma 해소하므로 불요; 고빈도에 몰려 wave1에서 36% 나옴). ⚠️ **coverage 벌크 시 shared_dictionary.inflected_forms 제외 필수**(bulk-load.mjs는 form_of만 걸러 놓침).
- **한국어 tail = 외부 소스 전부 실패**(공통어 편중): kaikki EN-번역 25,736·kowiktionary 영어 13,671(tail 2,788·잡음)·PanLex 4.31GB(불확실 payoff·미확보). → **LLM 배치가 유일한 tail 한국어 확보 수단**.
- 빈도 = **hermitdave OpenSubtitles en_full**(165만·`data/freq-corpus/en_full.txt`, gitignore). 줄번호=랭크.

**한국어 확보 = Claude Code 최소context 배치**(word+gloss_en→간결 한국어, 무환각·kaikki근거): `coverage-translate-{chunk,apply}.mjs`. **빈도순**(실존 89k 우선, 굴절제외 후 78,363=98청크). 게이트: 한글 포함(영어 echo 거부). 미랭크 극희귀 334,829는 대기(안 나옴). **원 세션 서브에이전트 스폰 반복 실패(API/세션한도)→ 새 창 실행**(핸드오프 `docs/AI_CONTEXT/handoffs/coverage_translate_20260718.md`).

**사용자 스크립트 실시간 한계**: 사전번역 안 된 극희귀어는 읽기 시점 한국어 불가 → 영어 gloss 폴백 or 런타임 LLM(사용자 선호는 사전 머티리얼라이제이션). 빈도상위 사전번역으로 발생 최소화.

**잔여(미구현)**: RPC 폴백(`lookup_word_meaning`+coverage)·`is_learning_target`(select_*_vocab) · UI 2섹션 · 한국어 배치 완주(78,363). [[project_dict_wave_plan_w0]] 계열.

