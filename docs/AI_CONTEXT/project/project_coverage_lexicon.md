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

**⚠️ 모델 교훈(실증 2026-07-19)**: coverage 번역을 약한 모델로 돌린 워커 7청크가 **한국어 대신 영어 gloss 복사**(footrest→"support to rest the feet", no-hangul 90%+). apply 게이트(한글 필수)가 차단했으나 **재번역 비용 발생** → 실제로 더 비쌈. **Opus 재번역은 완벽**(footrest→발받침·bradykinesia→서동증, no-hangul 0). 결론: 이 "gloss→한국어+스킵판단" 작업은 모델 품질에 민감 → **Opus 또는 검증된 Sonnet 필수, Haiku 부적합**. [[feedback_best_model]] 강화.

**✅ 빈도순 tier 완주(2026-07-19)**: covtr 83청크 + 잔여 5청크 전량 Opus 적재 → **translated 77,501·skip 5,095·english_echo 0**. 빈도순(hermitdave 165만 랭크) 잔여 **1**(no-hangul 거부 1건, 사실상 소진). 남은 pending 327,285 = **미랭크 극희귀 tier(설계상 대기·콘텐츠 미등장)**. 세션한도(15:30 KST 리셋) 중 워커 15/19 실패했으나 대부분 파일 쓴 뒤 검증단계에서 죽어 out.json은 온전→코디 apply로 회수, 누락 6+잔여 5는 리셋 후 재디스패치로 완결. **교훈: 서브에이전트 대량 동시 스폰은 세션경계서 무더기 실패, 완료분 apply는 멱등이라 손실0.**

**✅ wire-up 완료(2026-07-19, 4파트)**: ① **reader 폴백** — `lookup_word_meaning` tier 6·7(`coverage`/`coverage_en`)+`gloss_en` 컬럼(마이그 `lookup_coverage_fallback`); FE `WordLookupPopover` 영어 gloss 폴백+"독해 참고용" 안내. ② **도서/기사 참고 목록** — `select_book_chapter_coverage`·`select_article_coverage`(마이그 `coverage_reference_lists`), 토큰⋈coverage(core와 분리=비학습 보장). ③ **사용자 스크립트 참고 목록** — `select_coverage_for_words(text[])`(마이그 `coverage_for_words`); `/text/new` ExtractionPanel 미매칭 토큰→`📖 독해 참고 단어` 접힘 섹션. ④ **UI** — 리더 `📖 참고 단어` 토글+`ChapterCoverageWords`(i+1과 분리). 3표면(도서·기사·사용자 스크립트) 완성. [[feedback_dict_learning_target_policy]] 이원관리 부합. **핵심 교훈: 텍스트 토큰은 소문자 저장이라 고유명사 신호 소실 → 도서/기사=`first_sentence`, 사용자 스크립트=원문(`lowercaseWordSet`)의 소문자 출현으로 Darcy·Collins 등 제외**(P&P 45→19). 학습 파이프라인 무변경(위험 0).

**✅ 추출 누락 실단어 폐쇄(2026-07-20)**: 목적=단어추출 실단어 누락 0. 실측(도서 23,693 토큰): core 80.6%·coverage 10.8%·not_found 8.4%(1,980). not_found 분해=고유명사+외국어+OCR/방언(정상 제외) + **진짜 실단어 미등재**. harvest RPC `select_extraction_residual()`(마이그 `extraction_residual_harvest`, first_sentence 소문자=실단어·문맥) → 도서·기사 **2,186 후보 → 문맥 기반 Opus 배치 → 903 실영어 적재**(`source='content_residual'`, `coverage-residual-{harvest,apply}.mjs`), 1,283은 외국어·OCR·방언·고유명사로 LLM 정확 제외. 도서 not_found 2,332→1,932. `dwelt`(불규칙 굴절)·esports·secularization·folkways 회수. **교훈: appears_lowercase는 실영어 신호로 불완전(외국어·방언도 소문자)→최종 판정은 LLM. 규칙 표제어 대량생성 금지 원칙([[project_extraction_coverage_design]]) 유지=문맥 근거 + skip 관대.** [[feedback_dict_learning_target_policy]] 이원관리 이행.

**✅ 참고 목록 완성도(2026-07-20)**: "7만 롱테일이 추출에 다 나와야" 지적 → 도서·기사 참고 함수가 **직접 lemma만** 봐서 굴절형 롱테일 대량 누락(P&P 18개만). 수리 3단계: ① **`en_inflection_bases` 굴절 해소**(footrests→footrest). ② **부작용 발견**: en_inflection_bases가 `character→[charact]`·`father→[fathe]` 과잉stem 생성 → core엔 무해하나 **kaikki 408k coverage엔 obscure 고어(charact·fathe)가 있어 오매칭**. → **core-제외 가드**(토큰 bases가 core로 해소되면 학습소관→coverage목록 배제) + cov.word 길이≥4로 정제(P&P 54 클린: chaise·ductility·superciliousness). ③ **성능**: `select_book_chapter_coverage(book, p_chapter_idx)` 챕터별 처리(큰도서 11s→1.2s) + direct-core 선필터로 en_inflection_bases를 core아닌 토큰에만. FE `getChapterCoverageWords` 챕터 전달. **교훈: en_inflection_bases는 과잉stem 후보를 뱉음 — 작은 curated set엔 안전하나 대형 kaikki set에 쓰면 노이즈 → core-제외 필수.**

**잔여(미구현)**: 미랭크 tail 327k(설계상 대기·콘텐츠 미등장) · 불규칙 굴절 해소기 보강(dwelt류는 coverage로 우회 해소됨). [[project_dict_wave_plan_w0]] 계열.

