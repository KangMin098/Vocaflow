# Library Pipeline

> 라이브러리 도서·짧은 글·공용 단어장·어휘 분류 — 4 개 큐레이션 파이프라인.
> 작성 시점: 2026-06-08 (v06.34).

---

## 파이프라인 4종 개요

| 파이프라인 | 약어 | 입력 | 출력 | 주요 테이블 |
|---|---|---|---|---|
| **Library Curation Pipeline** | **LCP** | 9 외부 소스 → 도서 | `library_books` + `chapters_master` + `chapter_word_sets` (자동 발행) | `library_*` |
| **Article Curation Pipeline** | **ACP** | 4 feed (arXiv/NASA/NIH/VOA) | `library_articles` + `shared_word_sets`(library_article, 발행 시 자동) | `library_articles` |
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

### 9 외부 소스 (`library_source_catalogs`)

| Tier | Source | Quality |
|---|---|---|
| **S** | standard_ebooks | 정제 EPUB · 무료 PD |
| **S** | openstax | 교과서 |
| **S** | voa_learning | VOA Learning English |
| **A** | wikibooks | 위키북스 |
| **A** | wikisource | 위키소스 |
| **B** | gutenberg | Project Gutenberg PD |
| **B** | librivox | LibriVox 오디오북 (보이스 매핑) |
| **C** | open_library | Open Library |
| **C** | hathitrust | HathiTrust |
| **M** | manual | 수동 등록 |
| (추가) | simple_wikipedia | Simple English Wikipedia (v06.34) |

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
- `resolveCoverImageUrl()` — Gutenberg pg{id}.cover / SE og:image
- `collect_archaic_candidates(p_book_id)` — 미바인딩 단어 archaic_candidates 적재

**lemma self-heal 게이트 (v06.35)** — best-effort backfill 이 누락/실패하는 경로(수동 재분절 `reprocess-book.mjs` 등)를 대비해, **추출 시점에도 자동 backfill**. `extract_book_vocabulary_admin(p_book_id, p_percentile)` 시작부에 `PERFORM backfill_book_lemmas(p_book_id)` (멱등 · `lemma IS NULL` 행만) — migration `20260613022941_extract_admin_self_heal_lemmas`. 어떤 ingest 경로로 lemma 가 비었든 추출하는 순간 복구되고, 신규 등재 사전 단어도 다음 추출에서 즉시 바인딩. (계기: Les Misérables 364장이 수동 재분절로 0 bound → 추출 굴절형 누락·coverage NULL·진단 부풀림. backfill 로 0→11,808(88.4%) 복구.) 주의: 추출 SSoT `select_book_chapter_vocab` 는 `COALESCE(bv.lemma, bv.word)` 이므로 base 형은 lemma NULL 이어도 추출됨 — NULL 의 실손실은 **굴절형** + 진단·coverage.

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
| **Dev** | `get_lcp_config()` NULL → cron early return 0 → `/api/lcp/dev-drain-queue` 가 직접 driving (v06.34 신규) |

### LCP v06.34 — 소스 GET 복귀 (DELETE 시맨틱)

기존 `admin_bulk_requeue_books` 가 `status='queued'` UPDATE 만 → 도서가 Curated Books 에 그대로 남는 의도 불일치.

**재정의**: `library_books` row DELETE.
- `library_book_vocabularies` (CASCADE) + `library_chapters_master` (CASCADE) 자동
- `library_seed_catalog.imported_book_id` (SET NULL) — seed 자동 unlock → BulkFetchTab 재 fetch 가능
- `shared_word_sets` drafts 명시 DELETE
- 안전 가드: published 단어장 / 사용자 진도 있으면 row 스킵
- 반환: `(deleted_count, skipped_count, sets_deleted, seed_unlocked, blocked_by_users, blocked_by_published)`

UI 3 버튼:
- `검토대기 → 처리중` — draft 단어장만 삭제 (curating reclassify)
- `처리중 → 소스 GET` — library_books DELETE → BulkFetch 복귀
- `검토대기 → 소스 GET` — 동일

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

### 입력 4 feed

| 경로 | 소스 |
|---|---|
| `GET /api/admin/articles/arxiv-feed` | arXiv 학술 |
| `GET /api/admin/articles/nasa-feed` | NASA News |
| `GET /api/admin/articles/nih-feed` | NIH News |
| `GET /api/admin/articles/voa-feed` | VOA Learning English |

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

---

## VCB — Vocabulary Curation Build

### 7-Step 파이프라인

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
| `recommend_word_sets_for_user(uuid, text[])` | 5-tier 추천 (primary/stretch/review + track + specialty opt-in) |
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
