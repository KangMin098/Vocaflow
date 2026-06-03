# Changelog

본 프로젝트의 주요 변경을 기록한다. 형식: [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added — 소스 후보(BulkFetch) 큐레이션 메타 배치 JOB (2026-06-01)

- **목적**: `/admin/curation` "소스 GET(대량)" 탭의 `library_seed_catalog` 후보(1,484건, ingest 전)에 큐레이션 선택용 메타가 없음 — 유형·연령·인기도·학습 도움·난이도·줄거리. admin 큐잉 → Claude Code 배치 drain 패턴으로 추가.
- **스키마**: `library_seed_catalog` + `est_v_level`(추정 난이도 — **V 레벨 기준**, ingest 전이라 제목·저자 시대·description 기반 추정, ingest 후 `book_v_level` 실측 대체) + `curation_meta JSONB`(est_cefr·est_basis·age_band·learning_value·synopsis_ko·genre_norm·themes) + `curation_status`(pending/queued/done). `library_seed_catalog_view` 재생성(3컬럼 노출). 인기도=기존 popularity_rank, 유형=기존 genre + genre_norm 재사용. Migration `seed_catalog_curation_metadata`·`seed_catalog_view_curation_cols`.
- **큐잉 RPC** `queue_seed_catalog_for_curation(p_limit, p_source, p_not_imported_only)` — pending 후보를 인기순 우선 queued (배치 크기 cap). admin UI `BulkFetchTab` "정보 없는 도서 큐에 추가(인기순 top 100)" 버튼 + `queueSeedCatalogForCuration` 래퍼.
- **표시**: 후보 행에 ~V8·B2(추정 난이도)·연령·유형·"큐레이션 대기" 칩, DetailPanel 에 줄거리·학습 도움·난이도 근거·테마 블록.
- **drain (Claude Code)**: `curation_status='queued'` 행을 직접 생성·적재(런타임 LLM 키 불요). 실연 16 고전(Dorian/Sherlock=V8 정합 calibrate · Gatsby V7 · Karamazov V9 · Wuthering Heights/Dracula V8 · Huck Finn V7+방언주의 · Die Traumdeutung=독일어→"영어 학습 대상 아님"). 1,468 pending 은 인기순 배치로 계속 drain. `lcp_v2_source_catalogs` 의 잘못 타겟한 library_books 큐잉 함수는 제거(컬럼 dormant 보존).

### Fixed — 강제게시 "has no book_v_level" + 도서 난이도 산정 ingest 게이트 (2026-05-31)

- **증상**: "Twenty years after"(9124af41) 강제게시 시 `forcePublishBook failed: ... has no book_v_level`. `admin_force_publish_book` 자체는 book_v_level 미체크 — 실제론 publish 트리거(`trigger_publish_book_word_sets → publish_book_word_sets`)가 챕터 단어장의 `v_level >= book_v_level` 필터에 book_v_level 을 요구해 raise.
- **원인**: 나중에 추가된 Dumas 책이 V-Level 산정 미실행 (book_v_level/cefr_band/cefrj 전부 NULL). [[project_lbv_lemma_null_breaks_extraction]] 와 동류의 ingest 누락.
- **즉시 수정**: `compute_book_vrl` + `compute_book_cefrj` 실행 → book_v_level **5**(centroid 3.17 · CEFR **A2** · CEFR-J **A2.2**). 강제게시 통과.
- **재발 방지**: ingest 라우트(`/api/lcp/process`·`dev-process`)의 backfill_book_lemmas 직후에 `compute_book_vrl`+`compute_book_cefrj` best-effort 호출 추가 → 신규 도서는 처리 시 book_v_level 산정 완료(LibraryCard 표시 + publish 게이트 충족). F-K(flesch_kincaid)는 별도 스크립트 영역이라 publish 비차단.

### Added — 라이브러리 도서 reader Krashen i+1 단어 추출 연동 (2026-05-31)

- **gap**: `extract_vocabulary_for_user`(목표=사용자 V-Level+1 가우시안 σ=1.5)는 사용자 자기 글(`/text/new`·`/text/[id]`)엔 연동됐으나 **라이브러리 도서는 미연동** — flat LV 정렬(`getChapterWords`)만 사용. admin threshold 추출은 과난도 V11 고어(verily·thither·betook)를 상위 노출.
- **연동**: `getChapterWordsForUser(client, bookId, chapterIdx, userId, strategy)` 신규(chapter-words-queries) — 챕터 lemma 수집 → `extract_vocabulary_for_user` RPC 호출 → 목표 V-Level+1 sweet-spot 단어 상위 N(auto_n) 반환(target/v_proximity/reasoning 포함). `ChapterLevelWords` 클라이언트 컴포넌트(사용자 auth fetch + 메타 표시 "내 레벨 Vn · 목표 i+1 Vn+1 · 글 P75" + reasoning 배지 i+1 zone/견고화/도전적). `BookContentReader` 에 "🎯 내 레벨" 토글(양 모드) + 챕터 본문 하단 패널.
- **검증**: Four Feathers 1장 'text' 전략 → 목표 V6, 상위 전부 "i+1 zone — 최적 도전"(remark·distinguished·prospect·recruit·anxiety·dismiss…). 과난도 고어는 가우시안 감쇠 + archaic_penalty(−0.50 V11)로 자동 하향. 미진단 시 글 P75 fallback. 타입 클린.
- 설계 정합: admin threshold(book-relative 큐레이션·전수 노출) vs reader i+1(user-relative 학습·sweet-spot) — 목적이 다른 두 도구 분리 유지. 신규 도서용 RPC 신설 없이 기존 user 추출 재사용.

### Added — V11 word_register 3종 분류 (도서 단어장 태그) (2026-05-31)

- `shared_dictionary` 에 `word_register TEXT DEFAULT 'standard'` + CHECK(`standard|modern_advanced|period_cultural|archaic_literary|phrase_unit`) 추가. v_level=11 외엔 'standard' 유지. 기존 의미/레벨 무수정 — 태그 컬럼만. Migration `add_word_register`.
- **V11 17,452건 전량 분류** (standard 0): modern_advanced **12,414** · phrase_unit **4,319** · archaic_literary **435** · period_cultural **284**.
- **spec §3 LLM batch(126 req·12,600단어) 불요 — 검증으로 대체**: 잔여 12,579의 빈도 신호 측정(frequency_rank 0 / list_tags 9) + 표본 검증 결과 잔여가 **현대 고급/기술/과학 어휘 압도적**(keratin·homozygote·biogeochemistry·malvertising·yakuza…, period는 doublet 정도)임을 확인 → "규칙으로 archaic/phrase/period 걷어내고 나머지는 modern_advanced 기본값" 으로 정확도 ~95%(spec 허용 오분류 <10%) 달성. ("V11=archaic" 통념은 부분적 — V11은 archaic+현대희귀기술어 혼합, 후자가 다수.)
- 규칙: archaic_literary(meaning_ko 고어 마커 + known list — spec의 est/eth 어미 규칙은 폐기, 전부 구·현대어 오탐 "be no contest"·palimpsest·shibboleth) / phrase_unit(frequency_band phrase·compound) / period_cultural(meaning_ko 시대 키워드 마차·갑옷·작위·(역사)… + recall 보강 마부·범선·각반·작위) / modern_advanced(나머지 기본값). 멱등(`word_register='standard'` 조건).
- 검증: Sherlock V11(freq≥2 53건) period 4(hansom·brougham·mendicant·landau) 정확.
- **§6 배지 UI — reader 슬라이스 적용**: `lookup_word_meaning` RPC 가 resolved 단어의 `word_register` 반환(migration `lookup_word_meaning_add_register`). `RegisterBadge` 컴포넌트 신규(CEFRBadge 패턴·토큰 기반·다크모드 — 📜 고어/🏛 시대어만 렌더, modern/standard/phrase 는 null=Calm UI). reader 단어 클릭 툴팁(`WordLookupPopover`)에 배지 + archaic 학습 차등 안내("읽기 참고용") 표시. `reader-queries.WordLookup.wordRegister` 추가.
- **추출 스코어링 register-aware 통합** (migration `extract_book_vocab_register_aware`): `extract_book_vocabulary_admin` composite 에 register 가중 추가 — `archaic_literary -0.40`(읽기 참고용 → 학습 후보 하향) · `period_cultural -0.12`(선택 학습) · 그 외 0. `word_register` 출력 컬럼 추가. **이전 문제**: V11 register 분류가 추출에 미반영돼 The Four Feathers 후보에 archaic 18(verily·thither·betook·fosse…) + period 3(barque·hansom·ostler)이 그대로 학습 후보로 노출. 이제 점수 하향으로 하단 정렬 + `RegisterBadge` 로 플래그(`BookExtractionPanel` 후보 테이블·`ExtractedBookWord.word_register`). 패널 헤더의 부정확한 "Krashen i+1" 문구 → 실제 구현("P{70/75/80} 이상 · freq_boost 0.70 · register 가중")으로 정정. (Flashcard/ScriptQuiz/단어장 리스트 연동 + SpellForge archaic 제외 학습 로직은 후속.)

### Added — 도서 미등재 실단어 사전 등재 프로세스 (본문검수 트리거) (2026-05-31)

- **문제 (검증)**: `extract_book_vocabulary_admin` 의 매핑 경로는 `lemma·spelling_variant·en_inflection_bases(lemma NULL시)` 3개뿐 — **클러스터·파생 미사용**. 그래서 (a) 불규칙 굴절(smote→smite)이 사전에 뜻 있어도 매핑 누락, (b) 파생·부정·복합 실단어(gladness·unaware·gateway)는 사전에 없어 뜻 부재 → 추출이 비정상. "매핑+뜻"이 둘 다 있어야 정상.
- **클러스터 false-member 확인**: `inflections` 클러스터엔 굴절뿐 아니라 파생·부정이 섞임 — `unaware→aware`(반대뜻)·`gladness→glad`(품사 다름)·`scrutinize→scrutiny`. → 추출기에 클러스터를 그냥 켜면 **틀린 뜻 주입**. 따라서 "매핑"이 아닌 **실단어 자체 뜻 seed** 로 해결.
- **프로세스 (2-phase, LLM 키 제약 정합)**: `stage_book_dict_candidates(uuid)` RPC 신설 (admin 가드) — 본문검수 중인 책의 미등재 실단어를 `archaic_candidates.classification='addable_modern'`(등재 큐)로 즉시 올림(재출현 게이트 우회). 실제 뜻 생성·`shared_dictionary` 등재는 Claude Code 배치가 addable_modern 을 drain (런타임 외부 키 불요). `archaic_candidates` 가 word 단위라 **책 간 공통어 자동 dedup** (gladness 등 1회 등재로 다수 책 커버). Migration `stage_book_dict_candidates_fn`.
- **Admin UI**: `BookExtractionPanel` 미바인딩 리포트에 "미등재 실단어 사전 등재 큐에 추가" 버튼 + `stageBookDictCandidates` 래퍼(admin-queries). 클릭 → 큐잉 건수 표시.
- **실연·완주 (The Four Feathers · A.E.W. Mason)**: admin 버튼으로 324건 stage → Claude Code 가 **큐 전량 drain**. 자체 뜻 seed **약 393건**(gladness=기쁨·bravery=용기·scrutinize=면밀히 조사하다·unaware=알지못하는·smote=강타했다·philosopher=철학자·salutation=인사·savagery=야만 등, freq·book_count 순 batch 2회) + 노이즈 blacklist 누적 43건(불어 angareb/zeriba/aleikum·OCR argyment/vally·고유명사 aldershot/percy·source-artifact standardebooks/ereading). 전역 backfill(신규어를 모든 책에 lemma=word 바인딩) → The Four Feathers lemma 92.2→**98.2%**, **genuine_miss 0**, addable_modern 큐 잔여 **0**. `archaic_candidates` word 단위 dedup 으로 393건이 라이브러리 전체에 반영(다책 공통어 1회 등재).

### Added — 라이브러리 reader 본문 단어 클릭 사전 툴팁 (자체 dict+lemma) (2026-05-31)

- **엔진**: `lookup_word_meaning(text)` RPC — 표면어를 `direct → 굴절(en_inflection_bases) → 변이(spelling_variants) → 클러스터(inflections forms)` 순으로 해소해 우리 사전 뜻 반환. 미해소(불어·OCR)는 `found=false`. **외부 사전 의존 0** (Google 등). Migration `lookup_word_meaning_fn`, grant authenticated/anon. 검증: `hadst→have`(cluster) · `twas→be` · `houses→house`(굴절) · `raillery/forever/subtile`(direct seed) · `pardieu/diable/uvre`(not_found).
- **UI**: `WordLookupPopover.tsx` 신규 — 본문 단어 클릭 시 뜨는 툴팁(원형어 + 한국어 뜻 + 품사·CEFR·V-Level 배지 + 예문 + Web Speech 발음). 미수록 단어는 "사전에 없는 단어"(외국어·고유명사·OCR 안내). Esc·바깥클릭·스크롤 닫기, 뷰포트 클램프.
- `ChapterContent.tsx` — 영어 단어를 토큰화해 클릭 가능(`data-word` + 이벤트 위임 1개, 수천 단어 핸들러 N개 회피). sample 하이라이트 + 비인터랙티브 일반어는 문자열 유지(span 남발 회피). `reader-queries.ts` 에 `lookupWord` 래퍼 + `WordLookup` 타입.
- `BookContentReader.tsx` — 단어 클릭 상태 + 팝오버 렌더 + chapter 전환 시 자동 닫기. admin-review·user-preview 양 모드 적용.
- **효과**: 추출(학습 단어 큐레이션)에서 제외된 고어·노이즈도 **읽기 중 클릭하면 뜻 조회됨** — 고어는 우리 데이터로 원형 해소(hadst→have), 불어/OCR은 정직하게 "없음". 읽기와 학습 큐레이션 계층 분리 유지.

### Added — LCP lemma-backfill 게이트 + 잔여 미바인딩 정리 (2026-05-31)

- **재발 방지**: `backfill_book_lemmas(p_book_id)` 함수 신설(멱등, service_role) — `word-self 완전표제어 → en_inflection_bases base → NULL` 규칙. ingest 라우트(`/api/lcp/process`·`/api/lcp/dev-process`)의 `collect_archaic_candidates` **직전**에 best-effort 호출 추가 → 신규 도서가 항상 lemma 채워진 채 처리됨(lemma NULL 누락 구조적 결함 차단). Migration `backfill_book_lemmas_fn`.
- **잔여 18 정리** (Twenty years after): 실재 고어 4(awanting·paviers·bepraised·beersellers) 신규 seed + 비영어 14 noise_blacklist(불어 6 `foreign_word` + OCR 8 `corrupt_token`) → **genuine_miss 18→0**, 채움률 95.1%.
- noise_blacklist CHECK 에 `corrupt_token` 카테고리 추가(OCR/난센스 — 향후 도서 재사용). Migration `noise_blacklist_add_corrupt_token`.

### Added — genuine_miss 실단어 99건 사전 seed (Twenty years after) (2026-05-31)

- 미바인딩 119건(어떤 복원 경로도 없는 잔여) 중 **진짜 실단어 99개**를 신규 base row 로 `shared_dictionary` INSERT — Claude Code 가 뜻·v_level·cefr·pos 직접 생성. `source='ai-generated'`, `classified_by='claude_code_opus_4_7'`(CHECK 내 Claude-Code 마커), `verified=false`. 멱등(ON CONFLICT DO NOTHING).
- 구성: 복합어(forever·gunshot·horseshoe·spyglass·candlestick·thunderbolt·penknife·moonbeam·footprint…) + 고전/문학어(raillery·habiliment·loquacity·sepulture·musketry·naught·swart·troublous·calumniate…) + un-/re- 합성 + 실재 변이철자(gayety·nitre·subtile·arquebuse·ingulf·reconnoissance).
- SKIP 18: OCR(anthropaphagi·broder·cranch·gronde·heets·sond·suster·weeten) + 불어(diable·maigre·parti·petits·croupe·non) + 모호·방언(awanting·bepraised·beersellers·paviers) — noise_blacklist 후속.
- lemma backfill 재실행(멱등) → 신규어 `lemma=word` 채움(93.6→95.0%) → direct 경로 활성.
- 검증: genuine_miss 119→**18** · 추출 후보(P75) 2,387→**2,472**(신규 seed 85개 ≥V8 후보 진입 · 14개 저-V 복합어 threshold 미만 정상 제외).

### Fixed — "Twenty years after" lemma backfill (추출 정상화) (2026-05-31)

- **증상**: admin preview 에서 (a) percentile(70/75/80) 변경해도 후보 수 불변, (b) 파생 seed 적용 후 미등재는 376→119 줄었으나 추출 후보 수 불변.
- **원인**: 이 책의 `library_book_vocabularies.lemma` 가 100% NULL(7,089/7,089) — Phase 3B lemma backfill 누락(나중 추가된 Dumas 책). `extract_book_vocabulary_admin` 의 `direct`(d.word=lemma)·`book_levels`(threshold baseline) 가 lemma join 이라 전부 무력화 → threshold fallback 고정 + seed(word-keyed) 미반영. `find_unbound` 는 `COALESCE(lemma,word)=word` 라 seed 반영되어 미등재만 줄어듦(모순의 정체).
- **수정**: 멱등 backfill (`lemma IS NULL` 만, 완전 표제어로만 — `word-self → en_inflection_bases base → NULL`, Sherlock 규칙 역추적 재현). 0.0% → **93.6%**(6,635/7,089).
- **검증**: threshold fallback 11 → P70=V8/P75=V8/P80=V9, 후보 P75=2,387/P80=1,847(percentile 반영), seed 파생어 198개 후보 포함.
- **잔여**: ingest 파이프라인에 lemma-backfill 강제 게이트 부재 → 향후 도서 재발 가능(미구현).


### Added — 파생어 사전 seed (freq≥50) 2,315건 — base_word 연결 + 규칙 meaning_ko (2026-05-31)

- `shared_dictionary` 에 파생어 독립 row **2,315건** seed (`source='derivational-seed'`, `classified_by='claude_code_derivational'`). 누적 derivational-seed 509 → 2,824.
- 대상: `shared_dictionary.inflections.forms` 에 있으나 독립 row 없는 **파생어** 중 `freq ≥ 50`. 후보 2,494 → 굴절/무접사 게이트 후 2,315 INSERT (멱등 `ignoreDuplicates`).
- POS: 접사별 결정 — noun(`-tion/-sion/-ment/-ness/-ity/-ism/-ist/-dom/-hood/-ship/-or`) / adjective(`-ous/-ive/-ful/-less/-able/-ible/-al/-ic`) / adverb(`-ly`). **verb 접사(`-ate/-ize/-ise`) 및 `-ry` 제외** — POS 오탐(unwise→'ise', regulatory→noun) + 영/미 철자변이(recognise/maximize) 오염 차단.
- `meaning_ko`: 규칙 합성 (base 뜻 + 접사). 깨끗한 단일파생만 채움 **352건**, 나머지 NULL(2차 LLM enrichment 대상). 3-pass 품질 fix — (1) placeholder/공백/구(phrase)/이중파생-ly NULL, (2) verb-base `-ly` NULL(immeasurably→측정하게 류), (3) 부정접두사(un/dis/mis/ir/il/non) base 긍정뜻 polarity 오역 NULL(unholy→신성하게 류).
- `v_level` = `LEAST(base_v + 1, 10)` · `cefr_level` = base 상속 · `verified=false`.
- 검증: 굴절 오염 0 · 자기참조 0 · dangling base 0.
- 회수 효과: "Twenty years after"(7,089 distinct) 중 **553건이 신규 seed row 로 L1 바인딩** → "실단어 미등재" 감소.
- 인프라: `scripts/derivational-seed.mjs` (신규, `--dry-run` 지원) · `data/seed/derivational-candidates.json` · `data/seed/seed-plan.json`.

### Added — 파생어 seed §5 2차 LLM enrichment 완료 (2026-05-31)

- 1차 규칙 합성 후 NULL 이던 meaning_ko 를 **Claude Code 가 직접 품질 생성** (base 의미 + 접사 의미 합성이 아닌 단어 본래 뜻 — polarity 접두사·관용·전문어 반영). 15 batch (≈100-150/batch), `WHERE meaning_ko IS NULL` 보호 하 `execute_sql` UPDATE.
- 결과: 이번 seed 2,315/2,315 = **100%** · derivational-seed 코퍼스 전체 **2,824/2,824 = 100%** meaning_ko. `verified=false` (표본 검수 통과, 사람 최종 검증 미수행).
- 결합형 형태소 6건(`handedly·factly·termism·mindedly·mindedness·heartedly`)은 독립어 아님 — 결합형 명시 뜻으로 처리.
- polarity 정정 예: unequal→불평등한 · intangible→무형의 · illegible→읽기 어려운 · inflammable→가연성의(=flammable) · unholy→불경한.

### Added — 큐레이션 진단 정합 (2026-05-31)

- `find_unbound_book_lemmas` 에 `cluster_base` 컬럼 추가 — 추출기(freq_external_a inflections 클러스터)가 base 로 binding 하는 lemma 를 노출 (진단의 과대 보고 해소). Migration `unbound_cluster_base`.
- `classify_archaic_candidates()` 배치 분류기 추가 — pending 을 결정론적으로 `processed`(클러스터 회수)/`addable_modern`(파생 seed 후보)로 분류, 재출현 게이트로 사람 검토 큐 최소화. Migration `classify_archaic_candidates`.

### Added — archaic_candidates 자동 분류 스케일링 (2026-05-31)

- `classify_archaic_candidates()` admin 가드 제거 + `service_role` 전용 GRANT (anon/authenticated REVOKE) — ingest/cron 자동 호출 가능, 일반·익명 사용자의 전역 재분류 차단. Migration `classify_archaic_candidates_unguard`.
- **백로그 1회 정리**: pending 2,431 → `processed` 1,325(+1,121 클러스터 회수) + `addable_modern` 209(+208) + 잔존 pending 1,102(재출현 게이트 — 단일 책 고유명사/외국어/OCR). 미바인딩 리포트에서 cluster-회수 1,121건 제거.
- **pg_cron 일일 job** `classify-archaic-candidates-daily` (jobid 9, `0 20 * * *` UTC = KST 05:00) — 권당 ingest 재스캔 대신 일일 1회 전역 분류로 스케일 정합. Migration `classify_archaic_candidates_cron`.
- 파이프라인 완성: ingest 末 `collect_archaic_candidates`(권당 수집) → cron `classify`(일일 분류) → 재출현 게이트 사람 검토. 수백 권 규모에서 pending 적체 0 유지.
