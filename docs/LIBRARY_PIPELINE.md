# Library Pipeline

> 라이브러리 도서·짧은 글·공용 단어장·어휘 분류 — 4 개 큐레이션 파이프라인.
> 작성 시점: 2026-06-08 (v06.34).

---

## 파이프라인 4종 개요

| 파이프라인 | 약어 | 입력 | 출력 | 주요 테이블 |
|---|---|---|---|---|
| **Library Curation Pipeline** | **LCP** | 9 외부 소스 → 도서 | `library_books` + `chapters_master` + `chapter_word_sets` (자동 발행) | `library_*` |
| **Article Curation Pipeline** | **ACP** | **15 소스 · 38 피드** (실측 2026-08-21) | `library_articles` + `shared_word_sets`(library_article, 발행 시 자동) | `library_articles` |
| **Vocabulary Curation Build** | **VCB** | seed 단어 list | `shared_words` enriched | `vocab_*` |
| **Vocabulary Reading Level** | **VRL** | 사전 → 분류 | `shared_dictionary.v_level` 4축 (level/track/domain/skill) | `vocaflow_*` + `vrl_*` |

---

## LCP — Library Curation Pipeline v2.0

### Status 흐름

```
queued
  → ingesting → normalizing → segmenting → analyzing → curating
  → (auto_curate_book 게이트 분기)
      ├─ cefr_confidence ≥ 0.85 → published   (publish trigger 발동)
      ├─ cefr_confidence ≥ 0.60 → ready       (admin 검수 대기)
      └─ else                  → failed
  → (admin force-publish) → published
  → (admin archive) → archived
```

### 외부 소스 (`library_source_catalogs`)

| Tier | Source | Quality |
|---|---|---|
| **S** | standard_ebooks | 정제 EPUB · 무료 PD |
| **S** | openstax | 교과서 |
| **S** | voa_learning | VOA Learning English |
| **S** | storyweaver | StoryWeaver 그림책 CC BY 4.0 (삽화+낭독, v06.56) |
| **A** | wikibooks | 위키북스 |
| **A** | wikisource | 위키소스 |
| **B** | gutenberg | Project Gutenberg PD |
| **B** | librivox | LibriVox 오디오북 (보이스 매핑) |
| **C** | open_library | Open Library |
| **C** | hathitrust | HathiTrust |
| **M** | manual | 수동 등록 |
| (추가) | simple_wikipedia | Simple English Wikipedia (v06.34) |
| (추가) | pressbooks | Pressbooks OA book (CC-BY 서버렌더 HTML · OBP 동결 해제 α retarget, v06.163) |

**Pressbooks ingester (v06.163, OBP 동결 해제 α)** — `ingest/pressbooks.ts`. OBP 는 챕터 전문 PDF-only(client-render + `__NEXT_DATA__` 메타만)라 dependency-0 불가 → 동결. 대신 Pressbooks(opentextbc.ca 등)는 챕터별 서버렌더 HTML(CC-BY 다수) → SE 계약 그대로 EPUB/PDF 파싱 없이 `RawBook` 산출. `source_id="<host>/<book-slug>"`(host allowlist), book landing→`citation_*` 메타·CC 링크·TOC 챕터 URL, 챕터 페이지→`hentry` `<section>` 슬라이스(entry-title 중복 제거) 후 산문화, `CHAPTER N.` 마커+`CHAPTER_HREF_SEP` deep-link. dev 라우트: `/api/lcp/dev-ingest-preview`(fetch 미리보기) · `/api/lcp/dev-enqueue-book`(service-role enqueue) · dev-process `pressbooks` 케이스(`max_chapters` 옵션). **마이그레이션 적용 완료**(`library_books_source_add_pressbooks`, source CHECK +`pressbooks`). **end-to-end 실증(2026-07-09)**: `Introduction to Sociology 2e` published · CEFR C1 · V-Level 8 · 23 챕터 · 23/23 챕터 단어세트(894단어) · llm_cost 0.

**그림책 삽화/낭독 (StoryWeaver, v06.56)** — `library_books.illustrations`(`[{idx,url,alt}]` 링크, 문단 idx 정합) + `library_books.audio_url`(readalong mp3). ingester `storyweaver.ts` 가 `/api/v1/stories/{id|slug}/read` 파싱(StoryPage→문단, coverImage→삽화, FrontCover→표지, audioPath→낭독). ReadingUniverse 가 문단별 `<figure>` 렌더, workspace layout 이 audio_url→단일 스트림 chapterAudio. 자체 표지·오디오 제공 → resolveCoverImageUrl·LibriVox 매핑 우회.

### 데이터 흐름

#### 1. Ingest (`/api/lcp/process` ingest 단계)
- 소스별 fetcher (`packages/library-pipeline` + `lib/library/seed-fetchers/`)
- 원본 fetch → `raw` text + meta (title/author/license/source_url)

#### 2. Normalize
- `normalizeBook(raw)` — 공백 정리, illustration markers 제거, 챕터 boundary 정제

#### 3. Segment
- `segmentBook(norm)` → chapters 배열
- 0 챕터 → throw "Segment failed"

**챕터 원본 deep-link (`source_href`, v06.35)** — admin 검수의 "원본 소스" 챕터별 링크 정확도. Standard Ebooks 챕터 URL 은 도서 구조마다 4종(파일분리 `/text/chapter-1` · 앵커 `/text/fables#slug` · 명명 `/text/charmides` · 중첩 `/text/chapter-1-1-1`)이라 `/text/chapter-N` 추측은 404. ingest 가 소스 TOC(`{ebookUrl}/text`)를 파싱해 `single-page <section id>` ↔ TOC href fragment 를 조인 → 챕터 마커에 href 동봉(`CHAPTER_HREF_SEP`), segment 가 `ChapterSegment.source_href` 로 분리, `insert_book_analysis` 가 `library_chapters_master.source_href` 적재. 렌더(`ChapterSidebar`)는 저장값 우선, 없으면 `chapterSourceUrl` fallback(SE 는 안전한 도서 TOC). 기존 도서는 `scripts/lcp/backfill-se-chapter-hrefs.mjs` 로 백필(본문/어휘 불변 · source_href 만 UPDATE).

#### 4. Analyze
- `analyzeBook(book_id, norm, chapters)` — LLM 호출 (Anthropic SDK)
- 출력: cefr_level + cefr_confidence + word_count + chapter_count + reading_minutes + llm_cost_usd + words[]

#### 5. Library_books UPDATE (메타 + status=curating)

#### 6. Backfill / Compute (best-effort)
- `backfill_book_lemmas(p_book_id)` — direct-bind + 추출 + percentile 정상화
- `compute_book_vrl(p_book_id)` — V-Level type-based p75 centroid (v06.34: token → type)
- `compute_book_cefrj(p_book_id)` — CEFR-J 12-band (internal) + cefr_band auto
- `compute_book_coverage(p_book_id)` — 레벨별 기지어 커버리지 (i+1)
- `resolveCoverImageUrlWithSeed(client, …)` — **표지 해결 정본. 시드 우선, 원천 폴백** (아래 참조)
- `collect_archaic_candidates(p_book_id)` — 미바인딩 단어 archaic_candidates 적재

**표지 이미지 — 시드가 먼저다 (v06.142, 실측 2026-08-15)**

발행 13권 중 **8권이 무표지**였다. 그런데 그중 **7권은 `library_seed_catalog.cover_url` 에 표지 URL 이
이미 있었다** — 시드 수집기가 목록 페이지에서 뽑아 넣어 둔 값이다. 승격 단계(`process`/`dev-process`)가
그 값을 무시하고 원천 사이트에 **다시** 요청했고, 그 요청은 `try/catch` + `console.warn` 인
best-effort 라 실패하면 조용히 표지 없는 책이 발행됐다. 7/27 하루에 5권이 몰려 생성된 것으로 보아
대량 드레인 중 스로틀·타임아웃에 걸린 것으로 보인다. (파서·정규식 자체는 재현 결과 정상이었다 —
로직 결함이 아니라 **네트워크 의존이 만든 결함**이다.)

- 정본 = `resolveCoverImageUrlWithSeed(client, {source, sourceId})` → `{url, via:'seed'|'origin'|'none'}`.
  시드에 값이 있으면 네트워크를 아예 타지 않는다. 승격 2곳 + 백필이 모두 이것을 쓴다.
- 표지를 못 구하면 **`warn` 으로 남긴다** — 무표지 발행은 카탈로그에서 바로 보인다.
- 백필 `POST /api/admin/library/backfill-covers`(재실행 안전) — 소스 제한을 없앴다(예전엔
  gutenberg/SE 만 봐서 pressbooks·lit2go 는 대상에서 빠져 있었다). 응답에 `via` 를 실어
  "시드가 비어 있는 소스가 어디인가" 를 한 번에 알 수 있다. **실행 결과 무표지 8 → 1권**
  (남은 1권 pressbooks 는 시드에도 원본이 없다).
- Gutenberg 는 `.large` 를 먼저 시도하고 없으면 `.medium` 으로 내려간다(HEAD 확인).
  ⚠️ 실측한 두 권(1342·1259)은 `.large` 가 **404** 라 200px 대에 머문다 — 소스의 한계다.
- 트레이드오프: SE 시드 URL 은 목록 썸네일(484×726)이고 og:image 는 1400×2100 이다.
  카드 슬롯(200px·2x=400px)에는 484px 로 충분하다고 보고 **신뢰성을 택했다.**

**표지 배치 — 그림책은 잘라 넣지 않는다** (`lib/library/cover-fit.ts`)

카드 슬롯은 이미 `aspect-[3/4]` 로 통일돼 있다. 통일되지 않은 것은 원본 비율이다:

| 소스 | 실측 | 3:4 슬롯에서 |
|---|---|---|
| Gutenberg | 200×281 · 200×299 (0.67~0.71) | 상하 5~11% 잘림 — 허용 |
| Standard Ebooks | 1400×2100 (0.667) | 상하 11% 잘림 — 허용 |
| StoryWeaver | 959×460 · 3351×1605 (**2.09**) | **좌우 64% 잘림** |

StoryWeaver 표지는 표지가 아니라 삽화 가로 크롭(`illustration_crops/…`)이라 그렇다.
`coverFitFor(book)` 가 `is_picture_book` 으로 갈라 그림책만 `object-contain` + 블러 배경을 쓴다.
URL 패턴으로 가르지 않는 이유: 호스트가 바뀌면 조용히 틀리지만, "그림책이면 가로 삽화" 는
바뀌지 않는다. `BookGridCard` 와 `LibraryGrid` 가 같은 함수를 쓴다(회귀 4건).

**lemma self-heal 게이트 (v06.35)** — best-effort backfill 이 누락/실패하는 경로(수동 재분절 `reprocess-book.mjs` 등)를 대비해, **추출 시점에도 자동 backfill**. `extract_book_vocabulary_admin(p_book_id, p_percentile)` 시작부에 `PERFORM backfill_book_lemmas(p_book_id)` (멱등 · `lemma IS NULL` 행만) — migration `20260613022941_extract_admin_self_heal_lemmas`. 어떤 ingest 경로로 lemma 가 비었든 추출하는 순간 복구되고, 신규 등재 사전 단어도 다음 추출에서 즉시 바인딩. (계기: Les Misérables 364장이 수동 재분절로 0 bound → 추출 굴절형 누락·coverage NULL·진단 부풀림. backfill 로 0→11,808(88.4%) 복구.) 주의: 추출 SSoT `select_book_chapter_vocab` 는 `COALESCE(bv.lemma, bv.word)` 이므로 base 형은 lemma NULL 이어도 추출됨 — NULL 의 실손실은 **굴절형** + 진단·coverage.

**dictionary self-heal 드레인 (v06.35, 외부 소스·LLM 0)** — ingest 가 `collect_archaic_candidates` 로 쌓는 미해소어(`archaic_candidates`) 중 진짜 희귀·전문 실단어를 **Wiktionary 게이트**로 정확 해소해 `lexicon_clean`(ko_source=`wikt-selfheal`) 자동 적재 → 다음 `lookup_word_meaning` 부터 coverage-clean 티어 해소(사전 자가성장). 스크립트: `dict-selfheal-core.mjs`(게이트: 영어섹션+register 판정·plural/alt-form/"See X" 리다이렉트 추적·`koQualityOk`) + `dict-selfheal-drain.mjs`(archaic_candidates→적재, 멱등·배치 캡·기존제외). 뜻 = Wiktionary 정의문 → Google 번역(LLM 생성 0). **핫패스(ingest 요청) 밖 드레인**이라 외부 조회 지연이 ingest 를 안 막음 — 크론/Claude Code 드레인 주기 실행. 게이트 정밀도: coinage/외국어/눈방언은 영어섹션 부재/register 태그로 자동 거부(시연 379후보→55통과, 오역 0). cf. 반례로 형태소 자동분해는 `cameleopard→came+leopard`(기린) 오뜻 부여로 기각.

**추출 지표 재정의 (v06.35)** — `/admin/curation` 의 "추출 %" 는 `v_book_extraction_stats.lemma_coverage_pct`, 즉 `shared_dictionary` 결합률 하나만 봤다. 그런데 결합 실패에는 **결합돼선 안 되는 것**이 대량 섞인다: 고어(`enforce_archaic_not_in_shared`/ADR D4 로 등재 금지) · 외국어 원문 인용(Les Misérables `de`/`la`/`du` 748회) · 인명/지명(P&P `elizabeth` 602회). 미매핑 4,882 단어를 `lookup_word_meaning` 에 넣으면 **4,362개(89.3%) · 출현 기준 94.6% 가 해석**된다 — 자산(`lexicon_clean` 455,037 · `spelling_norm` 312,642 · `archaic_dictionary` 810 · `dialect_map` 147)은 이미 있는데 지표가 안 봤을 뿐.

- 마이그레이션 `20260809120419_lbv_resolution_diagnostics` + `20260809120437_v_book_extraction_stats_v2`.
- `library_book_vocabularies` 에 `resolved_via`/`resolved_lang`/`resolved_word`/`noise_kind` 추가. **`lemma` 는 불변** — `select_book_chapter_vocab` 이 `COALESCE(bv.lemma, bv.word)` → `shared_dictionary` 로 학습 단어를 뽑으므로, 해석 결과를 `lemma` 에 쓰면 `lexicon_clean` 에 en 표제어로 있는 인명이 학습 단어로 승격된다.
- 백필 `fill_lbv_resolution()` 5,547행 → 전체 해석률 **94.26% → 99.49%** (미해결 489행). 책별: Les Misérables 89.5→98.7 · Sociology 88.4→98.7 · Dialogues 92.9→99.6.
- 남은 미해결의 성격: 프랑스어 은어(Hugo 은어장) · 그리스/라틴 전문어 · 현대 사회학 신조어 · 인도 문화 차용어 · 의성어.

**HTML 수치 엔티티 잔존 (v06.35 수정)** — `pressbooks`/`standard-ebooks` 의 `decodeEntities` 가 named 엔티티만 열거하고 **수치 fallback 이 없었다**. opentextbc 본문은 곱슬 큰따옴표를 `&#8220;`/`&#8221;` 로 쓰는데, 이게 본문에 남아 winkNLP 가 `&#8220;social` 을 한 토큰으로 물면서 **첫 글자를 먹은 조각**(`ocial` · `ociety` · `eople` · `bject`)이 추출 어휘에 들어갔다 — Introduction to Sociology 815행. 두 ingester 에 `&#(\d+);` / `&#x([0-9a-fA-F]+);` generic fallback 추가 (다른 7개 ingester 는 이미 있었음) + 회귀 `test/entity-decode.test.ts`. **이미 적재된 조각은 해당 도서 재수집 시에만 사라진다.**

**추출 노이즈 규칙 2건 추가 (v06.35)** — `extract-lemmas.ts`:
- 로마숫자 장 번호(`CHAPTER XLIX` → `xlix`) — 길이 3+ 순수 로마숫자 거부 (`mix`/`dim`/`did`/`mid`/`lid`/`civil` 예외).
- 참고문헌 URL 잔해 — 문장이 URL(`http`/`www.`)을 포함하고 토큰 좌우에 공백 없이 `.`/`/` 가 붙으면 제외 (`globalissues` · `religionfor` · `pdf` · `org`). 문장 끝 마침표 오탐 방지를 위해 URL 문맥을 함께 요구.

#### 7. Auto Curate
- `auto_curate_book(p_book_id)` RETURNS text — 3분기 게이트:

```sql
IF cefr_confidence >= 0.85
   AND copyright_safe_in_kr = true
   AND chapter_count BETWEEN 1 AND 100
   AND word_count >= 1000
   AND library_book_vocabularies count >= 50
THEN status = 'published' + published_at = now()
     → publish_book_word_sets trigger 발동 → 챕터 단어장 발행
ELSIF cefr_confidence >= 0.60 AND copyright_safe_in_kr
THEN status = 'ready' (admin 검수 대기, draft 단어장 0)
ELSE status = 'failed' + status_message
```

#### 8. pgmq Archive (성공/실패 양쪽)
- `archive_book_pipeline_messages(p_book_id)` — 큐 정리

### Worker

| 환경 | 메커니즘 |
|---|---|
| **Production** | `process_library_pipeline_batch(5)` pg_cron 매 30초 → POST `/api/lcp/process` (X-LCP-Token + msg_id) |
| **Dev** | `get_lcp_config()` NULL → cron early return 0 → Admin "Curated Books" 가 `/api/lcp/dev-process` 를 도서별 순차 호출(단일 엔진 `runProcess`). (구 `dev-drain-queue` 5권/라운드 루프는 라우트만 잔존·UI 미사용) |

### LCP v06.34 — 소스 GET 복귀 (DELETE 시맨틱)

기존 `admin_bulk_requeue_books` 가 `status='queued'` UPDATE 만 → 도서가 Curated Books 에 그대로 남는 의도 불일치.

**재정의**: `library_books` row DELETE.
- `library_book_vocabularies` (CASCADE) + `library_chapters_master` (CASCADE) 자동
- `library_seed_catalog.imported_book_id` (SET NULL) — seed 자동 unlock → BulkFetchTab 재 fetch 가능
- `shared_word_sets` drafts 명시 DELETE
- 안전 가드: published 단어장 / 사용자 진도 있으면 row 스킵
- 반환: `(deleted_count, skipped_count, sets_deleted, seed_unlocked, blocked_by_users, blocked_by_published)`

UI 버튼 (v06.x 통합):
- `소스로 되돌리기 (삭제)` — 처리중 ∪ 검토대기 선택분을 library_books DELETE → BulkFetch 복귀. (구 `처리중→소스GET`+`검토대기→소스GET` 2버튼이 동일 RPC 라 1버튼 통합)
- (구 `검토대기 → 처리중`(draft 삭제 reclassify) 버튼은 제거 — 재처리로 대체. RPC `admin_bulk_set_books_curating` 는 잔존)

### 4축 도서 난이도 지수 (v06.29 신설)

| 축 | 컬럼 | 출처 |
|---|---|---|
| **V-Level Centroid** | `book_v_level` (smallint) + `v_level_centroid_precise` (numeric) + `vrl_components` (jsonb) | type-based p75 (v06.34) |
| **CEFR 6-band** | `cefr_band` (generated stored) | `cefrj_level` 에서 파생 |
| **CEFR-J 4-band** | `shared_dictionary.cefrj_wordlist_band` (A1/A2/B1/B2) + `cefrj_domain_tags` (text[]) | CEFR-J Wordlist v1.6 (7,035 lemma · 86.7% 매칭) |
| **Flesch-Kincaid** | `flesch_kincaid_grade` (numeric) + `flesch_reading_ease` (numeric) + `readability_computed_at` | `scripts/book-readability.mjs` |

### V-Level Centroid 방식 (v06.34 token → type)

이전 (v06.33 이하) — `generate_series(1, freq_in_book)` token-weighted p75. Zipf 분포 영향으로 the/a/of 등이 dominant → V5 측정 다수 (실제 V7-V8).

v06.34 — `SELECT DISTINCT lbv.lemma, sd.v_level` type-based p75. Lexile/ATOS/CEFR-J Text Profile 학술 정합. 실측 효과 예: Christmas Carol V5 → V7 (B1.2) · Treasure Island V5 → V8 (B2.1) · Twenty Years After V5 → V9 (B2.2 — Dumas advanced).

### Source-Aware Confidence

`library_source_catalogs.cefrj_auto_assign_tier` (S/A/B/C/M) 영구:

| Tier | base conf | coverage 보정 (≥90% → 0 / 80% → −0.05 / 70% → −0.10 / <70% → −0.20) |
|---|---|---|
| S | 0.90~0.95 | auto-publish + spot-check 10% |
| A | 0.80~0.85 | sample review 30% |
| B | 0.65~0.70 | full review |
| C | 0.50~0.60 | OCR cleanup + full review |
| M | 1.00 | admin self-verify |

최종 clamp [0.30, 1.00].

### 챕터 단어장 발행 (v06.30)

`publish_book_word_sets(uuid)` RPC + `trigger_publish_book_word_sets` (status='published' trigger):
- `v_level >= book_v_level` 필터 (strict)
- 챕터당 1 단어장 · 단어 수 제한 X
- curation_query JSONB 멱등 SKIP

117 sets / 4 published 도서:
- Alice: 12 (586 단어)
- Frankenstein: 24 (1,425)
- Pride & Prejudice: 61 (~1,220)
- Dorian: 20 (1,339)

### LibriVox 챕터 보이스 매핑 (v06.34)

`library_books.librivox_audio` JSONB — 두 mode:
- **`chapter_parts`** (다권) — `chapter_map[idx]: { roman, parts[] }`
- **`flat`** (단권) — `sections[i]` 1:1 매핑 + `aligned=true`

**자동 폴백** (`save-librivox-audio` route v06.34):
- `chapter_parts` Roman 파싱 실패 + 단권 + `section_count === chapter_count` → 자동 `flat` 저장
- Pride/Twenty Years After 같은 Arabic 챕터 책 자동 인식

**매핑 알고리즘** (`librivox-chapter-map.ts`):
- `parseSectionChapterMeta(title)` — Roman + Arabic + "Book X, Chapter Y" 통합
- `buildVoiceChapters` — `(book, chapter)` 그룹핑 · insertion order
- `verifyWithinBookContiguity` — 책별 1..N
- 1차 outlier 제외 + 실패 시 2차 재시도 (긴 챕터 보호)

**자동 매핑 (로직 흡수, v06.35)** — `librivox-automap.ts` 공유 헬퍼:
- `autoMapLibriVoxForBook(client, bookId)` = resolve → count-gate → flat 폴백 → `librivox_audio` 저장.
  `save-librivox-audio`(큐레이터 수동)와 `lcp/dev-process`(파이프라인 자동)가 **동일 헬퍼** 사용 (중복 제거).
- `dev-process` 가 분석 직후 자동 호출 → **count-gate 통과 시 즉시 저장** (별도 버튼·CLI·큐 불필요).
- 결과 3분기: `mapped`(저장) / `queued`(녹음은 있으나 정합 실패 → 사람 판단 필요 → `book_curation_jobs` 자동 등록) / `no_recording`(낭독 없음 → 브라우저 TTS).
- **`book_curation_jobs` 큐 = count-gate 실패본만** (Claude Code 수동 정합 대상). 성공/녹음없음은 큐 잡 자동 삭제 → 큐는 항상 "사람 손이 필요한 책"만.
- 이전(v06.34)의 수동 "매핑 큐 등록(Claude)" 버튼은 제거 — dev 처리가 자동 등록.

**Claude Code 드레인 정합기 (v06.35)** — `librivox-chapter-map.ts` + `scripts/lcp/librivox-align.mjs`. count-gate 가 안전 중단하는 다권/포맷불일치 도서를 두 목록(소스 챕터 + LibriVox 섹션) 구조 분석으로 매핑. 다권+권번호면 **volume**, 단권이면 **title** 자동 선택.

- **`alignChaptersByVolume` (다권 — Les Mis 5권: 364/364 = 100%)**: 권 N = 텍스트 Part N, 권 내 섹션이 `(Book,Chapter)` 순서 → 권 단위 번호 매핑(권 내 "Bk 01" 유일 → 충돌 0). 4-pass:
  1. 번호 매핑 (권 N → Part N, group_label "Part›Book" 순서로 Book/Chapter 번호화)
  2. 퍼지 제목 교차검증 (Levenshtein ≥0.7 + 토큰 + 접두 — 표기차 Quartet/Quartett·Humor/Humour·악센트·`<b>`·`...`절단 흡수, 완전히 다른 제목만 보류)
  3. **PASS 2 제목 복구** — edition shift(오디오에 추가/병합 챕터)로 번호가 어긋난 챕터를 권 안에서 제목으로 재배정
  4. **PASS 3 번호 신뢰** — 제목 절단/오타지만 라벨=구조위치 단일·미사용 섹션은 번호 신뢰(`number_trusted` 로 보고, spot-check)
  - 묶음 `"Ch 01-04"` → 그 4장에 같은 파일(블록 재생) · `"Ch 20 part 1/2/3"` → 한 챕터 멀티파트
- **`alignChaptersByTitle` (단권 titled)**: 섹션 제목 ↔ 챕터 제목 유일 1:1, 미일치는 gap(TTS).
- **정확도 100% 원칙**: 검증/복구 못 한 건 omit → `pickChapterAudio` null → TTS. "강제 채움 금지 = 틀린 오디오 0".
- 드레인: `tsx scripts/lcp/librivox-align.mjs <book_id>` (dry-run) → `--commit`. 진단 덤프: `librivox-dump.mjs`. (계기: Les Mis 가 번호 시퀀스 flatten 으로 92장 오배정 → 권-인지 정합으로 364/364 교정.)

### Lexical Coverage (i+1 metric)

`library_books.lexical_coverage` jsonb + `compute_book_coverage(p_book_id)`:
- `coverage[L]` = % 토큰 v_level ≤ L
- admin 4축 섹션 + 라이브러리 캐러셀/상세 i+1 배지
- `judgeIPlusOne` 단일출처 (85/95 경계)
- `recommend_word_sets`엔 미적용 (book-level 지표 부적합)

### Copyright Gate

- **현재 정책 (v06.34)**: `copyright_safe_in_kr` = license PD/CC ILIKE
- 컬럼명 `_in_kr` 오해 주의 — 실제 US-safe + license-based
- 별도 cron `recompute-kr-safe` 미사용
- 94권 전부 safe

---

## ACP — Article Curation Pipeline v1.0

### 입력 — 소스별 "얼마나 깊이 들어갈 수 있는가" (실측 2026-08-30)

⚠️ 이 표의 앞 버전은 `arxiv-feed`(v06.69 에 플랫폼에서 삭제됨) 를 포함한 **4 feed** 로
적혀 있었다. 같은 문서 위쪽이 "15 소스 · 38 피드" 라 적고 있었으니 자기모순이었다.
숫자보다 중요한 것은 **소스마다 깊이 들어가는 방법이 다르다**는 것이라, 그것을 적는다.

| 소스 | 목록 확장 방식 | 상류 실측 | 비고 |
|---|---|---|---|
| `usgs` · `noaa` | Drupal 목록 `?page=N` (0-index) | usgs 793 · noaa 115 | **소진 확인** (DB 대조 미확보 0) |
| `wikipedia` · `simple_wikipedia` · `wikivoyage` | MediaWiki `continue` 객체 전체를 되돌려준다 | FA 6,993 + GA 다수 | 주제 적합률 5~11% — 대량 확보 보류 |
| `voa` | RSS **창 크기가 URL 파라미터** `?count=N` | 13피드 936 | 레벨 V3.8 — 대역 적중 16.5% |
| `nasa` · `futurity` | WordPress `?paged=N` | nasa 176 · futurity 188+ | `iotd` 는 paged 무시 → "새 항목 0" 가드가 멈춘다 |
| `plos` | Solr `start` 오프셋 + `numFound` 로 총량을 안다 | essay 1,541(큐레이션 통과) / 2,795(Solr) | **논증문 · 대역 적중 100%** |
| `elife` · `owid` · `factbook` · `wikinews` · `nih` | 단일 창 (확장 수단 없음) | 소량 | |
| `the_conversation` | — | — | CC BY-ND → `display_only` → **문항 0** |

**공통 함정** — 위 확장 수단을 뚫어도 `applyArticleCurationSpec` 이 `spec.maxItems`(대개 15)로
다시 자른다. 그건 **매일 도는 경로가 넘치지 않게** 두는 정책이지 품질 규칙이 아니므로,
대량 확보 경로는 `overrides.maxItems` 로 덮어쓴다. 생략하면 기존 동작 그대로다.

**소스를 새로 붙일 때 반드시 같이 볼 것** — `library_articles.source` 의 **CHECK 제약**.
2026-08-21 에 들어온 `futurity` 는 어댑터·spec·register 매핑·회귀 테스트가 다 있는데
제약만 갱신되지 않아, 목록도 본문 추출도 성공하면서 INSERT 가 전량 거절돼 확보량이
영구히 0 이었다(마이그레이션 `20260830020000` 으로 해소). 화면에는 "담은 것 0" 으로만
보여 **소스가 비어 있는 것과 구분되지 않는다.**

### 확보 배치 (헤드리스)

```
pnpm dlx tsx scripts/acp/collect-daily.mjs                       # 밀린 양만 센다(읽기 전용)
pnpm dlx tsx scripts/acp/collect-daily.mjs --source plos --feed essay --pages 60 --limit 900 --commit
pnpm dlx tsx scripts/acp/process-queue.mjs  --source plos --commit --limit 900
```

- `--pages N` — continuation/쪽번호를 지원하는 피드만 순회. `0` 이면 소진까지. 기본 1.
- 표의 마지막 칸이 **`소진`**(더 없음)과 **`예산소진`**(`--pages` 예산이 먼저 끝남)을 구분한다.
  이 구분이 없으면 예산 상한을 소진으로 오해한다 — 실제로 usgs/featured 를 25p 에서
  282편으로 보고했다가 52p 소진에서 567편인 것을 뒤늦게 알았다.
- `process-queue --source a,b` — 큐는 담은 순서로 나오므로 **적합도 낮은 소스가 앞을 막는다.**
  분석은 편당 어휘 행 수백 개를 만들어 디스크를 쓰므로, 무엇을 먼저 처리할지가 곧 비용이다.
- 둘 다 재실행 안전(이미 있는 것은 건너뛴다). 분석은 `ANTHROPIC_API_KEY` 없이도 돌고
  LLM 시그널만 빠진다(CEFR 신뢰도 0.732 → 0.725).

### 처리
- `/api/acp/enqueue` (article 큐 등록) → `/api/acp/dev-process` (article 처리)
- Status 흐름: `queued → normalizing → analyzing → ready → published` (LCP 미러, 글=단일 섹션)

### 검수 (v06.51) — LCP 책 검수 4패널 미러
`/admin/articles/preview/[id]`: 본문 리더 + 게시 게이트 / 보이스 연결(`audio_url`) / 학습 단어 추출 / 검수 팝업. (ADMIN_CONSOLE.md §/admin/articles 참조)

### 단어장 발행 + 학습자 체인 (v06.52) — LCP 전체 미러
글이 라이브러리 **스크립트**로 학습자에게 제공되는 학습 모델. 책 체인과 1:1:

| 단계 | 글(ACP) | 책(LCP) 대응 |
|---|---|---|
| 발행 시 단어장 | `trg_la_publish_word_set` → `publish_article_word_set` → `shared_word_sets`(category `library_article`) 1개 + `shared_words` | `trg_lb_publish_word_sets` → `publish_book_word_sets` (챕터 N개) |
| 단어 선정 | `select_article_vocab(uuid)` (register 필터 + composite, book_v_level 임계 없음) | `select_book_chapter_vocab` |
| 학습 시작 구독 | `subscribe_article_word_set(uuid)` (auth.uid) ← `startArticleLearning` | `_enroll_book_subscribe_word_sets` ← `enroll_library_book` |
| 워크스페이스 보이스 | `texts.source_url='article:{id}'` → `audio_url`→`chapterAudio` (단일 스트림) | `librivox_audio`→`pickChapterAudio` |
| 워크스페이스 단어 pill | 글 단어장 → `currentChapterWordSet` | 챕터 단어장 |

마이그레이션: `20260614180000_acp_article_word_set_pipeline`.

### 레벨 적응 드레인 (v06.34 신설) — 사다리 아래 세 단을 채우는 유일한 경로

**게이트는 지어져 있었는데 그것을 쓰는 파이프라인이 없었다** — `compose/adaptation.ts` 의
`runAdaptationGates` 를 부르는 스크립트가 하나도 없어, 6,627편 중 각색본이 3편뿐이었다.

왜 필요한가 (2026-08-30 실측): 겹치지 않는 20단원 책을 몇 권 만들 수 있는지 세면
**1단 0권 · 2단 1권 · 3단 2권** 인데 5단 18권 · 6단 23권이다. 수집 피드(arXiv · NASA ·
VOA · PLOS · Futurity)가 성인 대상이라 아래 단이 애초에 안 들어온다. **분류를 아무리 돌려도
없는 글이 생기지는 않는다** — 미분류 1,808편을 310편까지 분류했는데도 1단은 1편 그대로였다.

| 단계 | 스크립트 / 하는 일 |
|---|---|
| ① export | `scripts/textbook/adapt-drain-export.mjs --band elementary` — 각색 허용 라이선스(`cc_by`·`cc0`·`public_domain`)이고 목표보다 위 밴드인 원본을 **피드를 돌아가며** 뽑는다(한 피드에 쏠리면 서가가 한 색이 된다). 이미 각색본이 있는 원본은 건너뛴다 |
| ② **Claude Code** | 청크의 `title`·`text` 를 목표 학령으로 다시 쓴다. 규격은 `GRADE_BANDS` 가 준다 — 초등 90~170어 · 평균 문장 9어 · 추상명사 금지 · 숫자 하나 · 같은 낱말 반복 |
| ③ import | `adapt-drain-import.mjs --band elementary [--commit]` — `runAdaptationGates` 를 돌려 넣는다 |

**재실행 안전** — ①은 읽기만 한다. ③은 같은 원본·같은 밴드의 각색본이 있으면 건너뛴다
(실측: 2회차 "이미 있음 6 · 적재 0편").

**게이트** — critical 은 **I17 서가 중복** 하나다. 라이선스가 사용을 허락했으므로 재저작의
출처·표현·구조 독립성 검사는 성립하지 않는다. A1(원문 재작성)·A2(목표 레벨)는 경고이고,
경고를 달고 들어간 편수를 반드시 출력한다. 규격 밖(어수·평균 문장 길이)은 import 가 막는다.

⚠️ **각색본은 원본의 `source` 를 그대로 이어받는다** — `library_articles_source_check` 가
실제 피드만 허용하고, 각색해도 저작권 귀속은 원 발행처이기 때문이다. 각색이라는 사실은
`adapted_from_id` 와 `feed_id='adapted'` 가 나른다. `cc_by_sa` 는 뺐다(파생물 공유 조건을
서가 약관이 감당하는지 미확인 — 모르는 채로 쓰는 것보다 빼는 편이 싸다).

첫 실행(2026-08-30): 각색 가능 원본 **6,006편** 중 6편을 써서 게이트 6/6 통과,
1단 원글 **1 → 7편**. 이어 5편을 더 써 **11편**(1편은 `source='original'` 이라 걸렀다).

#### 소재 적합성은 규칙으로 안 갈린다 — 필요한 편수의 두 배를 뽑는다

export 가 라이선스·레벨·길이만 보던 동안 **표본 18편 중 7편(39%)이 소재부터 부적합**했다.
초등 지시문은 "제도·정책·추상명사는 쓰지 않는다 · 사건사고·분쟁·죽음은 쓰지 않는다" 인데,
COP28 정책 · 육류 감축 논쟁 · 네덜란드 전쟁사 · 사망 원인이 뽑혀 나왔다.

`register` 로 `argumentative` 1,546편을 뺐다(정의상 이 밴드의 소재가 아니다). **그런데
부적합률은 39% → 약 44% 로, 측정상 나아지지 않았다** — 남은 부적합 글이 전부 `expository`
이기 때문이다. `register` 는 "주장하는가" 를 가르지 이 밴드가 필요한 **"눈에 보이는가"** 를
가르지 않는다. 필터는 남겨 두되 **이것으로 문제가 풀렸다고 읽으면 안 된다.**

실제 대책은 **채우는 쪽의 판단**이다. 그래서 필요한 편수의 두 배쯤 뽑아 두고, 소재가 맞지
않는 것은 비워 둔다 — import 가 "제목 또는 본문이 비었다" 로 **세므로** 조용히 사라지지 않는다.

⚠️ **`source='original'`(우리가 쓴 글)은 각색 대상이 아니다.** 이미 우리 것이면 쉬운 판을
각색할 이유가 없고 그 레벨로 직접 쓰는 것이 맞다. DB 도 그렇게 말한다 —
`chk_original_needs_batch` 가 `compose_batch_id`·`composed_spec` 을 요구하는데, 원본의 spec 은
각색본을 설명하지 않는다(첫 적재가 이 제약에 걸려서 알았다). export·import 양쪽에서 막는다.

---

## VCB — Vocabulary Curation Build

VCB 는 두 경로를 갖는다. **보강이 필요한가**로 갈린다:

| 경로 | 언제 | 무엇을 하나 | 산출 |
|---|---|---|---|
| **8-step run** (아래) | 사전에 **없는** 단어를 새로 채워야 할 때 | seed → LLM 보강 → QA → 큐레이션 → 발행 | `shared_words` + `vocab_collections` |
| **Composer** (`/admin/vocab/studio`) | 사전에 **이미 있는** 데이터를 조합해 단어장을 만들 때 | blueprint → 조립 → 7지표 채점 → 발행 | `shared_word_sets` + `shared_words` (레시피·점수는 `curation_query`) |

### Composer (v06.35 신설) — 레시피 컴포저

단어장 생성기가 5곳에 흩어져 각자 다른 `curation_query` 방언을 쓰던 것을 Recipe v3 한 스키마로
통합한다. **마이그레이션 없음** (기존 `curation_query jsonb` 재사용).

| 단 | 값 |
|---|---|
| `population` | dictionary · list · roots · topics · corpus · exam_items · learner · union/intersect/except |
| `select` | 필터 + objective(`count`/`coverage`/`all`) + 기지 어휘 차감 + family 접기 |
| `organize` | `group_by` 15종 · `order_within` 7종 · 그룹 cap · `min_group_size` · 페이싱 |
| `present` | 보장 면(F1~F6) · 카드 필드 · 대조쌍 |

- 카탈로그 **31종** — 시중 26유형 + 고유 5종(`unlock`·`recycle`·`facet-ladder`·`confusion-log`·`uncovered`)
- 코드: `apps/web/src/lib/vcb/compose/*` (순수 코어) + `resolve.ts`(DB) + `publish.ts`
- CLI: `pnpm vcb:compose --blueprint <id> [--commit]` · 평가: `pnpm vcb:compose-eval`
- 설계·목표·Round 기록: [VCB_REDESIGN.md](./VCB_REDESIGN.md) · 매트릭스: [reports/vcb-compose-eval.md](./reports/vcb-compose-eval.md)

**고유 유형 실측 우위** (같은 예산, 대조군 = 일반 빈도순): `unlock` 200단어로 완전히 읽히는
문장 **201 vs 23** (Pride and Prejudice, 전체 1,769문장) · `recycle` 평균 향후 재등장 **143.4 vs 94.1**.

### 8-Step 파이프라인 (보강 경로)

```
1. Ingest (seed 입력)
2. Normalize
3. Extract
4. Dictionary lookup
5a. Export job (LLM enrichment)
5d. Import enriched
6. QA
7. Curate
8. Publish
```

### CLI scripts (`scripts/vcb/`)

```bash
pnpm vcb:ingest                # 01-ingest.ts
pnpm vcb:ingest-ai-seed        # 01b-ingest-ai-seed.ts
pnpm vcb:validate-seed-list    # 01c-validate-seed-list.mjs
pnpm vcb:normalize             # 02-normalize.ts
pnpm vcb:extract               # 03-extract.ts
pnpm vcb:dict-lookup           # 04-dict-lookup.ts
pnpm vcb:export-job            # 05a-export-job.ts
pnpm vcb:validate-output       # 05c-validate-output.mjs
pnpm vcb:import-enriched       # 05d-import.ts
pnpm vcb:qa                    # 06-qa.ts
pnpm vcb:curate                # 07-curate.ts
pnpm vcb:publish               # 08-publish.ts
pnpm vcb:publish-precheck      # 08b-publish-precheck.ts
```

### 카탈로그 파이프라인 — 발행 뒤 `/library/vocab` 한 권이 되기까지 (2026-08-31)

위 8단계는 **낱말을 만드는** 일이고, 여기는 그 낱말을 **한 권으로 세우는** 일이다.
`shared_words` 가 채워졌다고 서가에 책이 생기지 않는다 — 표지·판권면·목차·사다리 자리가
붙어야 학습자가 고를 수 있다(선택 지수, 아래 §측정).

**순서를 지켜야 한다.** 각인이 없으면 계단 재도출이 아무 일도 하지 않고, 계단이 틀린 채
측정하면 지수가 틀린다.

| # | 무엇 | 명령 | 소유 |
|---|---|---|---|
| ① | 조립·채점·발행 | `compose-batch.mts --plan <계획>` | `shared_word_sets` · `shared_words` · `ladder_step`(저작) |
| ② | 표지 도판 | `fetch-covers.mts --skip-existing` | `cover_image_url` · `cover_image_meta` |
| ③ | **사전 따라잡기** | `vocab/refresh-published-words.mjs` | `shared_words` 의 사전 복사본 (발음·유의어·반의어·연어·노트 — **빈 칸만**) |
| ④ | 판권면 각인 | `vocab/stamp-imprint.mts` | `curation_query.qa`·`.level`·`.imprint` · `brand_fingerprint` |
| ⑤ | 계단 재도출 | `vocab/reconcile-ladder.mts` | `ladder_step` (발행 뒤 **유일한** writer) |
| ⑥ | 측정 | `vocab/market-benchmark.mjs` · `vocab/choice-benchmark.mts` | 읽기만 |

전부 **드라이런이 기본**이고 `--commit` 이 있어야 쓴다. 전부 **재실행 안전**이다.

```bash
# 계획 하나로 여러 권 (드라이런 → 발행)
npx tsx --tsconfig apps/web/tsconfig.json scripts/vcb/compose-batch.mts \
  --plan scripts/vcb/data/compose-plan-2026-08-31.json [--commit]

npx tsx --tsconfig apps/web/tsconfig.json scripts/vcb/fetch-covers.mts --skip-existing --commit
node scripts/vocab/refresh-published-words.mjs --commit
npx tsx --tsconfig apps/web/tsconfig.json scripts/vocab/stamp-imprint.mts --commit
npx tsx --tsconfig apps/web/tsconfig.json scripts/vocab/reconcile-ladder.mts --commit

# 서가에서 내리기 (지우지 않는다 — `--restore` 로 되돌아온다)
node scripts/vocab/retire-sets.mjs --list scripts/vocab/data/<목록>.txt [--restore] --commit
```

#### 지켜야 할 것 — 값을 치르고 배운 것들

- **`ladder_step` 의 writer 는 둘뿐이다**: 발행 시점의 `publish.ts`, 발행 뒤의
  `reconcile-ladder.mts`. 둘 다 `resolveLadderStep` 을 쓴다.
  옛 `backfill-ladder-step.mjs` 는 **청사진 바닥을 몰라서** `반대말 짝`(4단에서 열리는 원리)을
  2단에 앉혔다. 지웠다 — 한 컬럼에 규칙이 다른 writer 가 있으면 반드시 다시 갈라진다.
- **"못 쟀다" 와 "재서 학령 밖" 은 다른 사실이다.** 섞으면 낱말 중앙값 V8~V9 인 권이
  청사진 바닥으로 떨어져 초등 칸에 앉는다(`mozzarella` 가 든 권이 그랬다).
  `resolveLadderStep({ aboveLadder })` 가 그 둘을 가른다.
- **한 유형이 여러 권이면 `COVER_QUERY_BY_SLUG` 에 권별 검색어를 넣는다.** 유형 검색어는
  하나뿐이라 주제 17권이 한 그림을 두고 경쟁했고 16권이 그라디언트로 떨어졌다.
- **은퇴는 `is_published=false` 다.** DELETE 는 `user_word_set_subscriptions` 를 CASCADE 로
  함께 지운다 — 되돌릴 수 없다. 대체품이 **실제로 선 뒤에** 내린다(서가에 구멍이 안 나게).
- **jsonb 는 키만 더한다.** `curation_query` 를 통째로 덮으면 컴포저 레시피·점수표가 날아간다.
- **발행은 사전의 스냅샷이다 — 게시된 권은 저절로 좋아지지 않는다.** `shared_words` 는 뜻·예문·
  발음·유의어·연어를 자기 컬럼에 **복사해** 갖는다. 사전을 아무리 채워도 이미 게시된 권은
  그대로다. 실측 2026-09-01 — 게시 27,075행 중 사전에는 있는데 복사본이 빈 칸이
  **유의어 1,641 · 연어 1,161 · 반의어 466 · 노트 354** 였다. ③이 그것을 따라잡는다.
  **사전을 손본 뒤에는 반드시 ③을 돌린다.**
- ⚠️ **그런데 그 넷 중 셋은 읽는 화면이 없다.** 넷을 다 채우고 내용 지수를 다시 쟀더니
  **1.586 그대로**였다. grep 전수로 확인한 결과:

  | 칸 | 닿는 경로 |
  |---|---|
  | `pronunciation` · `example_en` · `meaning_ko` · `part_of_speech` · `cefr_level` | 구독·게임이 `vocabularies` 로 **복사**한다 |
  | `korean_learner_note` | 미리보기 모달이 읽는다 |
  | `synonyms` · `antonyms` · `collocations` | **아무도 안 읽는다** — `vocabularies` 에 그 컬럼이 없고, 학습자는 `shared_dictionary` 에서 **런타임에** 받는다(`dict-extras.ts`) |

  그래서 ③의 기본값은 **닿는 칸만** 채운다(`--all-fields` 로 나머지도 채울 수 있다).
  **내용 지수를 올리려면 `shared_words` 가 아니라 `shared_dictionary` 를 채워야 한다.**
- ⚠️ **③은 `korean_learner_note` 를 목차 있는 세트에서 건드리지 않는다.** 그 세트에서 이
  컬럼은 사전 노트가 아니라 **챕터 제목**이다(`toSharedWords`: `grouped ? group_label : ...`).
  모르고 채우면 목차가 깨진다. (실측: 목차 있는 26,575행의 노트 격차는 0, 격차 354는 전부 평면 세트.)
- **쓰기가 도는 중의 읽기는 끊긴다.** ③을 300개 묶음으로 돌렸더니 드라이런은 통과하고
  `--commit` 만 `statement timeout` 이 났다. 묶음을 120으로 줄이고 지수 백오프 재시도를 넣었다
  — 이 저장소가 교재 쪽에서 이미 치른 값이다("몇 천 행짜리 조회는 언젠가 끊긴다").

#### 측정 — 두 개의 자, 서로 다른 것을 잰다

| 자 | 무엇 | 기준선 |
|---|---|---|
| `market-benchmark.mjs` | **산 뒤에** 쓰는 것 (예문·번역·파생어·유의어·다의어·품사·묶음원리 7축) | 시중 어휘 교재 4종 140칸 |
| `choice-benchmark.mts` | **고르기 전에** 쓰는 것 (판권면·목차·학습계획·머리말·시리즈안내 등 11신호) | 같은 4종의 `shelfSignals` |

시장 기준선은 `packages/library-pipeline/src/vocab/market-spec.json` 에 고정돼 있고,
`scripts/textbook-corpus/vocab-market-spec.mjs` 가 실제 교재에서 생성한다.

⚠️ **선택 지수는 "학습자가 보는가" 로 잰다** — "DB 에 값이 있는가" 도 "판권면이 적는가" 도
아니다. 이 자를 두 번 틀리게 잡았다: `dayPacing` 을 판권면만 보고 84% 로 셌으나 미리보기
모달이 전권에 하루치를 그리고 있었고, `seriesGuide` 는 화면엔 띠가 없는 권에도 점수를 주고
있었다. 화면 컴포넌트의 **렌더 조건을 그대로** 옮길 것.

⚠️ **보유율 비가 아니라 신호 개수로 잰다.** 시장이 100% 인 신호에서는 비의 천장이 1.00 이라
"120% 우위" 가 산술적으로 불가능해진다.

### Cast-2000 (2026-05-14~16) — 완료된 첫 batch

**Result**: `shared_dictionary` ~7% backfilled (먼저 7%만 운영). `shared_words` 7,488 row 가 source_queue_id 로 cast-2000 lineage 보존.

### Audit Chain (FK CASCADE)

```
vocab_runs (DELETE)
  └─→ vocab_seed_candidates (CASCADE)
       ├─→ vocab_dict_hits (CASCADE)
       └─→ vocab_enrichment_queue (CASCADE)
            ├─→ vocab_curation_decisions (CASCADE)
            └─→ shared_words.source_queue_id (SET NULL — lineage 보존)
```

### Admin UI (`/admin/vocab/*`)

`apps/web/src/components/admin/vcb/*` — 8 컴포넌트 (Steps 1~8 워크플로우).

---

## VRL — Vocabulary Reading Level

### v3.0 4축 분류 시스템

| 축 | 테이블 | row | 메타 |
|---|---|---|---|
| **V-Level** | `vocaflow_levels` | 12 | V0-V11 |
| **Track** | `vocaflow_tracks` | 6 | 영역 중립 ID (csat / business / academic / 등) |
| **Domain** | `vocaflow_domains` | 8 | 도메인 |
| **Skill** | `vocaflow_skills` | 5 | 스킬 |

### Classifications 적용 컬럼

`shared_dictionary` 4축 + 메타:
- `v_level` smallint
- `track_levels` jsonb (각 트랙별 레벨)
- `domain_levels` jsonb
- `skill_level` smallint + `skill_type` text
- `word_register` TEXT DEFAULT 'standard' (modern_advanced / phrase_unit / archaic_literary / period_cultural / standard)
- `derivation_base` + `derivation_suffix` + `inflections` jsonb
- `frequency_band` + `frequency_score`
- `cefr_confidence` (Phase 1)

### 분류 정의 (v06.25 결정)

V-Level = **pure semantic** (frequency/domain 신호는 제외, track_levels/domain_levels 에만 반영).
- frequency 는 추출 composite 의 `frequency_boost` weight 0.15 가 담당
- 예: `ram` NGSL → V7 (V5 아님)

### Round 1-10 진행 (Claude Code 분류, 2026-05-24~25)

전체 38,598 row 100% Claude Code 분류 완료 (v06.34). 최종 V-Level 분포:
- V11 = 44.83% (17,303 — archaic)
- V9 = 18.41% (7,104)
- V10 = 11.21%
- V7 = 5.34% · V6 = 4.93% · V8 = 4.00% · V5 = 3.78%
- V2 = 2.50% · V1 = 2.12% · V4 = 1.74% · V3 = 1.15%
- V0 = 0% (진단 시드 V1 부터 시작)

sigmoid 곡선 완성. Phase 2 (진단 시드/단어장 발행) 진입 가능.

### V11 word_register 분류 (Phase 2026-05-31)

V-Level=11 의 17,452 row 전량 태그 (standard 0):
- `modern_advanced`: 12,414 — keratin/biogeochemistry/yakuza 등 현대 고급
- `phrase_unit`: 4,319 — frequency_band phrase/compound
- `archaic_literary`: 435
- `period_cultural`: 284

배지 UI: 📜 고어 / 🏛 시대어 (Phase 3 연동).

### 파생어 사전 seed (2026-05-31)

`shared_dictionary` 에 파생어 독립 row 2,315건 추가 (`source='derivational-seed'`):
- 대상: `inflections.forms` 에 있으나 독립 row 없는 파생어 (freq≥50)
- POS 접사별 결정 (noun/adjective/adverb)
- verb 접사 (-ate/-ize/-ise) · -ry 제외
- `meaning_ko` 규칙 합성 352건 · 나머지 NULL (2차 LLM 처리 예정)
- v_level=LEAST(base_v+1, 10) · verified=false · 멱등 INSERT
- 회수: "Twenty Years After" 553건 신규 L1 바인딩

### 진단 시스템

#### vrl_diagnostic_tests (5 진단, 185 questions 총)

| test_type | 문항 | 분포 |
|---|---|---|
| `base_v_level` | 40 | V1(5) V2(5) V3(4) V4(4) V5(4) V6(4) V7(4) V8(4) V9(3) V10(2) V11(1) |
| `track` (csat_korean) | 32 | csat-prep tag · V2-V8 |
| `track` (business) | 32 | bsl · V3-V9 |
| `track` (academic) | 32 | nawl · V4-V10 |
| `comprehensive` | 50 | NGSL 강제 V1-V10 × 5 (4축 동시 분석) |

#### RPC 함수

| 함수 | 용도 |
|---|---|
| `analyze_diagnostic_result(answers)` | 70% threshold + weighted avg confidence |
| `analyze_and_apply_diagnostic_result(answers)` | apply: user_profiles UPDATE + snapshot INSERT |
| `analyze_track_diagnostic_result` / `analyze_and_apply_track_diagnostic_result` | track 진단 |
| `analyze_and_apply_comprehensive_diagnostic_result` | 4축 동시 |
| `recommend_word_sets_for_user(uuid, text[])` | 6-tier 추천 (primary/stretch/review + track + specialty opt-in + book_iplus1: coverage 85~95% 도서 입문 챕터 세트) |
| `auto_promote_v_level_for_user(uuid)` | i+1 zone ≥20 mastered → V+1 + snapshot |
| `auto_promote_track_level_for_user(uuid, text)` | track promote (threshold 15) |
| `cron_auto_promote_all_users()` | pg_cron 새벽 03 KST 일괄 |

### Auto-curated V-Level 단어장 (Phase 2C.1)

V1-V9 = 1,600 row · slug `auto-vlevel-v1~v9`:
- V1-V7 (1,200) category=elementary/middle/high
- V8-V9 (400) category=eng_test (TOEIC/TOEFL/IELTS)
- 선정: `frequency_rank ASC + skill_level=3 + (NGSL/csat-prep/BSL/NAWL)`

### Specialty 단어장 (Phase 2C.2)

- medical (200 moel)
- business (250 bsl)
- literary (250 bel)
- academic (202 nawl)
- = 902 row · category=themed · V8-V11

### Admin Console (/admin/vrl/*)

`/admin/vrl` Dashboard — KPI 4 + Hero 진행률 + V-Level 12 진행 list.
`/admin/vrl/taxonomy` — 4 tab (Levels/Tracks/Domains/Skills) read-only.
`/admin/vrl/automation` — pg_cron + V-Level 분포 + 진단 활용도 (v06.34).

### Phase 2J Automation Dashboard

5 admin RPC:
- `cron_jobs` / `cron_runs` (최근 10)
- `snapshot_counts` (by reason/scope)
- `v_level_distribution` (bar)
- `diagnostic_use` (활용도)

---

## 영단어 마스터 사전 시스템 (v06.23~27)

### shared_dictionary 마스터 캐시

45,292 row · 183 MB · meaning_ko 100% (v06.24 완성).

### 데이터 흐름
```
사용자 텍스트 → 토큰화 → shared_dictionary 조회
  ├─ 히트(목표 ~90%): 즉시 반환 (~50ms)
  └─ 미스: Claude API → 캐시 누적 (source='ai-generated')
```

운영 시 AI 호출 비용 80~95% 절감.

### CEFR 분포 (v06.24)

A1=548 / A2=719 / B1=1,204 / B2=2,212 / C1=3,806 / C2=13,241
- 핵심 A1~B2 영역 22% — 운영 시 보강 필요

### Phase 1 통합 컬럼 (v06.26)

11개 추가:
- `senses` JSONB · `primary_pos` · `pos_set`
- `ipa_uk` · `ipa_us`
- `cefr_confidence` · `domain_tags`
- `frequency_score` · `frequency_band`
- `verified_by` · `verified_at`

### Phase 2 ETL (v06.27)

`20260521153559_lexicon_phase2_backfill` 적용:
- 38,476 → 38,542 row (kice-orphan 66 신규)
- senses/primary_pos/pos_set 100% 채움
- `lexicon_frequencies` 6,305 신규 (KICE+WM+EBS+NGSL+AWL+COCA)
- `shared_words.lemma` 3,399 / `vocabularies.lemma` 1,228 backfill

### Frequency 외부 코퍼스 (Phase 1-2)

- `shared_dictionary` 22,762 → 45,292
- `lexicon_frequencies` 사이드카 (출처별 분리)
- 4 새 컬럼 + JSONB multi-source 구조
- Vendor-neutral 명명

### Dict-fill Sprint 결과

| Sprint | 범위 | 결과 |
|---|---|---|
| **Top 5K** (rank ≤5000) | 4,026 row | 100% example_en/ipa/coll · 97% syn · 55% ant |
| **P3 (rank >5000)** | 8,104/8,105 row | 100% example_en/ipa · 99.96% coll · 87% syn · 43% ant |
| **P4 (1k-9k stub)** | 2,738 new stubs | pos/meaning/example/ipa/syn/ant/cefr/learner-note · 10k-25k tier (12,976) 잔여 |

### 카테고리 시스템 (v06.25 브릿지)

`dictionary_categories` 566 노드 (3계층 H1=18 / H2=76 / H3=472).
`dictionary_word_categories` 28,124 매핑.

v06.25 브릿지 — `shared_word_sets` 에 `category_id` + `additional_category_ids` 추가 (기존 `category` 보존).

---

## Migration 시드 인프라

| 스크립트 | 용도 |
|---|---|
| `scripts/seed-dictionary.mjs` | 외부 시드 SQLite → `shared_dictionary` 멱등 batch upsert |
| `scripts/dict-fetch-batch.mjs` | meaning_ko NULL batch 추출 (50개씩) |
| `scripts/dict-update-batch.mjs` | UPDATE (멱등, WHERE NULL 보호) |
| `scripts/dict-status.mjs` | CEFR별 진행률 보고 |
| `scripts/dict-common.mjs` | service-role 클라이언트 + 헬퍼 |
| `scripts/cefrj-import.mjs` | CEFR-J Wordlist v1.6 staging upsert |
| `scripts/book-readability.mjs` | F-K 2종 산정 |

---

## 주의사항

### 안티패턴
1. **`memory_state` 컬럼 DB 저장 금지** — Memory Decay 4색은 R(t) 동적 계산만
2. **단일 도서 지수 의존 금지** — V-Level / CEFR / F-K 4축 분산 활용
3. **`cefrj_level` 12-band 공식 표준 표기 금지** — Wordlist 는 4-band 만 보증, 12-band 는 internal heuristic
4. **LibraryCard 메인 F-K 노출 금지** — detail 한정 (학습자 인지부담)
5. **검수 강도 평준화 금지** — Tier 별 차등 (S 자동 publish OK · B/C full review)

### Citation 의무 (CEFR-J Wordlist v1.6)
> The CEFR-J Wordlist Version 1.6. Compiled by Yukio Tono, Tokyo University of Foreign Studies.

위치: Library detail footer (Phase 2 UI) + 본 문서.

**시드를 검증 없이 믿으면 안 된다 (v06.143, 실측 2026-08-15)**

v06.142 에서 "시드 우선" 으로 바꿨더니 발행 SE 7권이 **더 나빠졌다** — 표지 없음(그라디언트
폴백)에서 **검은 박스**로. 죽은 URL 은 표지가 없는 것보다 나쁘다.

원인: **Standard Ebooks 가 표지 URL 스킴을 바꿨다.**

| | 경로 |
|---|---|
| 예전(시드에 굳어 있음) | `/images/covers/<slug>-f5fe576e-cover@2x.jpg` |
| 현재 | `/images/covers/<slug>/<40자해시>/cover@2x.jpg` |

`library_seed_catalog` 의 SE 시드 **1,450건 중 1,369건(94%)** 이 예전 스킴이고,
전부 같은 빌드해시 `f5fe576e` 를 달고 있으며 **전부 404** 다.

→ `resolveCoverImageUrlWithSeed()` 가 시드 URL 을 **`isImageOk()` 로 확인한 뒤에만** 쓴다.
죽어 있으면 원천으로 내려간다(`via:'origin'`), 원천도 없으면 `via:'seed-dead'` 로 구분해
보고한다. HEAD 한 번(주간 캐시)이 무-네트워크보다 싸다 — 정확성이 우선이다.

재백필 결과: 8권 스캔 · 7권 복구 · **`fromSeed` 0**(검증이 죽은 시드를 전부 걸러냄).
남은 1권은 pressbooks 로 시드·원천 모두 표지가 없다.

⚠️ **남은 일**: 시드 1,369건은 여전히 죽은 URL 이다. 지금은 검증이 막아 주지만,
SE 시드를 재수집하면(수집기 자체는 현재 스킴을 정상 파싱한다 — 재현 확인) 카탈로그가
정상화되고 HEAD 확인도 대부분 생략된다.

**캡처 하네스도 같은 날 두 번 거짓말했다** (`91-hub-design-capture`)
- `beforeAll` 훅이 `describe.configure` 의 timeout 을 안 물려받아 기본 30초 → 콜드 컴파일 시
  캡처 0장으로 죽었다. `test.setTimeout(180_000)` 으로 고정.
- 검증 계정을 **모든 세션이 공유**해서 다른 세션의 로그아웃이 이쪽 로그인을 죽였다.
  서가는 공개 라우트이므로 `HUB_SHOT_NOAUTH=1` 로 로그인을 건너뛴다.

**서지 표기 정규화 (v06.144, 실측 2026-08-15)** — `lib/library/bibliographic.ts`

서가에 소스별 관행이 그대로 섞여 있었다: Gutenberg 는 도서관 도치형(`Austen, Jane`),
SE 는 자연형(`Charles Dickens`), StoryWeaver 는 이중공백·후행공백(`Shabnam  Minwalla`),
그리고 문장형 제목(`Twenty years after`). 같은 서가에서 저자가 두 형식으로 불리면
정렬·검색·인상이 모두 무너진다.

- `normalizeAuthor` — 쉼표가 **정확히 하나**이고 양쪽이 인명일 때만 도치를 푼다.
  `King, Martin Luther, Jr.`(쉼표 2개)·`Little, Brown and Company`(조직명)는 손대지 않는다.
  틀리게 뒤집는 것보다 그대로 두는 편이 낫다.
- `normalizeTitle` — **전부 소문자인 단어만** 올린다. 대문자가 섞인 토큰(`MacDonald`·`H. P.`·
  `2nd`)은 의도된 표기로 보고 보존. 기능어는 소문자로 두되 첫/끝 단어는 올린다.
  ⚠️ **문장형 게이트**: 소문자 실단어가 1개뿐이면 출판사 표기로 보고 건드리지 않는다 —
  `Tell Me, What is a Drone?` 의 `is` 를 `Is` 로 고치는 것은 교정이 아니라 훼손이다.
- 적용 지점은 **넣는 순간**(`process`/`dev-process`) — 카탈로그가 갈린 뒤 백필로 쫓아가면 늘 늦는다.

전체 401권 dry-run 결과 **변경 8권 · 오탐 0 · 무손상 393권**:
도치형 2(P&P·Twenty Years After) · 이중/후행공백 6(StoryWeaver) · 문장형 제목 1.
회귀 15건 — 절반이 **바꾸면 안 되는 것**을 지킨다(`Romeo and Juliet`·`Suspiria de Profundis`·
`2nd` 서수·출판사 표기).

**서가 레이아웃 — 실측 라운드 기록 (v06.145, 2026-08-15)**

"실제 도서관처럼" 을 감이 아니라 계측으로 밀었다. 하네스 `91-hub-design-capture` 가
스크린샷과 함께 `metrics.json` 을 낸다: 구역별 카드 높이 · 제목 줄 수 · 가로 넘침.

| 항목 | 시작 | 끝 |
|---|---|---|
| 발행 표지 | 5/13 (그중 7권은 죽은 URL → 검은 박스) | **12/13 실제 표지** |
| 카드 균질성(구역당 높이 종류) | 7종 | **1종** (Books·Dispatches·Decks 전부) |
| 측정 가능한 탭 | 1/3 | **3/3** |
| 자료 유형 이름 | 화면당 3종(탭·제목·칩) | **단일 출처 1종** |
| 가로 넘침 | 0px | 0px |

**진짜 원인은 한 줄이었다** — `BookGridCard` 의 `<button>` 에 `w-full` 이 없어 격자 칸이
아니라 **내용 너비**로 줄었고, 안쪽 표지(`aspect-[3/4] w-full`)가 그 폭을 따라갔다.
같은 행에서 63px(`Fables`) ~ 150px. 표지 비율은 내내 정확했다(전 카드 0.750).
해상도·`object-fit`·비율을 의심하며 두 라운드를 돌고 나서야, **표지 박스를 직접 재고**
비율만 완벽하고 폭이 흔들린다는 표가 나오자 원인이 즉시 좁혀졌다.
같은 결함이 `VocabSetCard` 에도 있어 함께 막았다(`CurationCard`·`LibraryCard` 는 미사용).

⚠️ **판정 도구가 이 라운드에서만 다섯 번 틀렸다.** 전부 "고쳐야 할 곳" 을 잘못 가리켰다:
① `fullPage` + 지연로딩 → 접힘 아래 표지가 검은 박스(실제로는 정상 반환)
② 구역 혼합 → 캐러셀·가로줄·격자를 한 통에 넣고 "높이 9종"
③ `overflow-clip-margin:24px` → 모바일 가로 넘침 8px 재발
④ 조용한 0개 → Dispatches·Decks 가 한 라운드 내내 미측정인데 "이상 없음" 으로 읽힘
⑤ `rect` 높이 → 코버플로의 **의도된 원근**(scale)을 불균질로 보고
지금은 ④에 큰 경고, ⑤는 `offsetHeight`(transform 제외)로 잰다.

**건드리지 않기로 한 것**: `cefr_band`(CEFR-J 파생 stored) vs `cefr_level`(LLM) 이
발행 13권 중 11권에서 한 단계 어긋나지만, 카드가 쓰는 `cefr_band` 가 학술 정합 값이고
`cefr_level` 은 폴백이다 — 의도된 설계다. 그림책 표지도 `object-contain` 으로 여백이
크지만, 삽화를 64% 잘라내는 것보다 정직하다.
