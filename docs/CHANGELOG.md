# CHANGELOG

> Vocaflow 변경 이력. 최신 3개 버전(v06.32~34) + 현재 작업 중인 마이그레이션 + 세션 변경 사항을 보존.
> 이전 v06.0~v06.31 의 누적 변경은 git 이력 (`git log`) 으로만 추적.
>
> **갱신 정책**: 새 마이그레이션 / 새 라우트 / 모듈 시맨틱 변경 / 컴포넌트 신설·제거 시 항목 추가.
> SQL · 라우트 경로 · 컴포넌트 이름은 `git`/`grep`/`SQL` 로 100% 검증 가능한 사실만 기록.

---

## Unreleased (v06.34 → next)

### P5a — frequency_rank 백필 16,492 row (v06.78 · D2)

P1 (게이트 디커플) 직후. P0 측정 D2 = "V6~V11 frequency_rank 충전 22.7% (< 60%)" → P2 composite 재설계 전 선행 필수.

**근거**: composite 의 `0.70 * 1/LOG(rank+10)` 항이 학습밴드 77% 단어에서 `COALESCE(rank, 50000)` 으로 상수 동점 (C2). 백필로 의미 회복.

**백필** (migration [20260620040000_p5a_freq_rank_backfill_from_ext](../supabase/migrations/20260620040000_p5a_freq_rank_backfill_from_ext.sql)):
- 대상: V6~V11 + `frequency_rank IS NULL` + `lemma_band IS NOT NULL` = **16,492 row**
- 식: `lemma_band 'XXk'` → `XX * 1000 + 500` (밴드 중간점, deterministic, vendor-neutral)
- 마커: `frequency_sources.p5a_backfill = '2026-06-20T00:00:00Z'`
- 백업: `shared_dictionary_p5a_backup_20260620` (PK=word + NULL 보존, 롤백용)

**실측 효과**:
- V6~V11 충전율: 22.7% → **64.1%** (+41.4pp · D2 60% 통과)
- V6~V8 CSAT 핵심: 40.0% → 56.6% (+16.6pp)
- 25 distinct band 중간점 (1500~25500)

**미백필 14,271 row**: frequency_band ∈ {compound, phrase, rare} 또는 frequency_sources 자체 부재. 빈도 신호 없음 — P5a 범위 외.

**다음** (P2): composite 재설계. NULL→50000 폐지 (rank NULL → 0), salience 챕터 max 정규화, csat_band_fit 항 추가.

### P1 — 추출 게이트 디커플 (v06.77)

Handoff (Project 작성) "학습 단어 추출 파이프라인 사전db 목적 최적합 고도화" 의 P1 단계. P0 진단 (`docs/AI_CONTEXT/diagnostics/extraction_p0_20260620.md`) 의 결정표 권장 그대로 적용.

**문제 (C3)**: `select_book_chapter_vocab` 의 게이트가 `sd.v_level >= bk.book_v_level` 라 책 난이도가 학습밴드를 결정. 결과: book_v_level≥7 책 15권에서 V6~V8 (CSAT 핵심 학습밴드) 가 100% 역배제 (~23,000 단어 인스턴스 손실).

**변경** (migration [20260620030000_extraction_fixed_learnable_floor](../supabase/migrations/20260620030000_extraction_fixed_learnable_floor.sql)):
- `select_book_chapter_vocab` 게이트: `>= bk.book_v_level` → `>= 6` (D1=V6 확정)
- `select_article_vocab` 게이트: `>= COALESCE(art.article_v_level, 4)` → `>= 6` (book 함수와 일치, C5 drift 사전 차단)
- composite / skill penalty / register exclude / 정렬 / cap 전부 보존 (P2/P3 별도)
- `book_v_level` (난이도 표시) `compute_book_vrl` 보존

**검증 (실측)**:
- Les Misérables (V9) — V6=1,117 / V7=1,240 / V8=1,120 복원 (이전 0/0/0)
- Alice (V6) — V6=169 / V7=121 / V8=70 변동 0 (이미 floor 통과 중)
- published 5권 추출 회귀 0

**롤백**: `docs/AI_CONTEXT/rollback/P1_*_원본.sql` 재적용.

**다음** (P2~P5):
- P5a (frequency_rank 백필 · D2 선행 필수) — V6~V11 충전 22.7% → 60%+
- P2 (composite 재설계 · C1·C2) — NULL→50000 폐지, salience 챕터 max 정규화
- P3 (cap N=40 · C4) — 챕터당 max=239 → 40
- P4 (단일 코어 통합 · C5)
- P5b/P5c/P6 (후행 검토)

### git tracking 정합 — 적용된 4 migration 추적 합류 (v06.76)

이미 supabase 에 적용된 4 migration 파일이 git untracked 상태로 잔류. SSoT (git=DB) 정합 위해 추적 합류 — schema drift 0 (적용 timestamp 와 파일 timestamp 가 다른 것은 직접 SQL 로 apply 했기 때문).

| 파일 | DB apply 시각 | 도메인 |
|---|---|---|
| [20260608120000_acp_license_register_gate](../supabase/migrations/20260608120000_acp_license_register_gate.sql) | 2026-06-14 05:13 UTC | ACP §18 Step 1 — license_class / register / lexical_noise / display_only 컬럼 + 자동 게이트 트리거 |
| [20260608123000_acp_nd_display_only_gate](../supabase/migrations/20260608123000_acp_nd_display_only_gate.sql) | 2026-06-14 05:33 UTC | ACP §18 Step 3 — ND(display_only) 단어세트 발행 차단 + 구독 no-op |
| [20260608126000_acp_lexical_noise_gate](../supabase/migrations/20260608126000_acp_lexical_noise_gate.sql) | 2026-06-14 06:11 UTC | ACP §18 Step 5 §4-C — lexical_noise>0.08 단어세트 발행 차단 |
| [20260614200000_library_books_is_picture_book](../supabase/migrations/20260614200000_library_books_is_picture_book.sql) | 2026-06-14 11:00 UTC | LCP — `is_picture_book` GENERATED STORED (삽화≥4 + 단어<5000) · `judgeIPlusOne` 임계 -7pp 보정용 |

내용 변경 없음 (이미 동작 중). PR #22 머지로 확정된 Project Knowledge attach 묶음에 ACP gate migration 들이 합류 가능해짐.

### LCP 대량 list — 단계별 상태 + 삭제 기능 (v06.75)

사용자 요청: "LCP 대량 리스트에 단계별 상태(큐상태 등), 삭제 기능 등 필요한 기능 있어야함. 전체적으로 검토 다시 해서 적용해줘."

### 단계별 상태 가시화

- [seed-upsert.ts](../apps/web/src/lib/acp/seed-upsert.ts) `listArticleSeeds` 에 article.status / status_message JOIN — `imported_article_id` 별도 query 로 `library_articles` status 매핑. 신규 타입 `SeedListRow` + `ArticleStatusValue` 8종.
- mount 시 `seed-list?includeImported=true` — 큐에 진행 중인 article 도 표시.
- 신규 row badge 9종 (`STATUS_BADGE`): 후보 / 대기 / 정규화 / 분석중 / 큐레이션 / 검토대기 / 발행됨 / 실패 / 보관.
- 색상 단계 직관화 (fresh→review→stable→known / failed=error).
- `articleStatusMessage` 가 tooltip 으로 표시 (실패 사유 즉시 확인).

### 삭제 기능 (단건 + bulk)

- 신규 API [`/api/admin/articles/seed/delete`](../apps/web/src/app/api/admin/articles/seed/delete/route.ts):
  - 미발행 후보: `curation_status='hidden'` soft hide (다시 GET 시 재노출 안 됨)
  - 진행 중/검수 대기/실패: `library_articles` 영구 삭제 (CASCADE 로 vocabularies + word_sets 정리)
  - `published` 는 차단 + 안내 ("먼저 검토대기로 되돌리세요")
- `requireAdmin` + service_role + dev-bypass 호환.
- UI:
  - **row 별 휴지통 아이콘** — confirm 후 즉시 삭제. tooltip 으로 분기 동작 명시 (`seed hide` / `article delete`)
  - **헤더에 bulk 삭제 버튼** (선택 N건) — 잘못 가져온 묶음 일괄 정리
  - 실패 row 에 RefreshCw 아이콘 (검수 페이지의 재처리 액션 안내)

### 필터 패널에 큐 단계 축 추가 (8축)

기존 7축 (검색/소스/점수/CEFR/발행/audio/기간) + **신규 `articleStatuses` chip 다중 선택** (9 옵션 `STATUS_OPTIONS`). 토글 옆 활성 카운트 chip 도 8축 기준 갱신. 발행 상태 기본값 `unpublished` → `all` 로 변경 (큐 진행 중도 보이도록).

### 새 흐름

```
mount → seed-list (includeImported=true) → rows {seedId, articleStatus, articleStatusMessage}
                          ↓
              filter 8축 + sort → displayRows
                          ↓
       row 각각: 단계 badge + 휴지통 / bulk 헤더: 삭제 + 큐 추가
```

큐레이터가 단순 "후보 → 큐 추가" 흐름 외에도 진행 중 article 모니터링 + 잘못된 항목 즉시 정리까지 한 화면에서 해결.

### 워크스페이스 브라우저 TTS — best voice 자동 선택 재설계 (v06.74)

`/text/[id]` 하단 플레이어의 브라우저 음성(Web Speech) 자동 선택 품질 개선. 기존 `pickBestVoice` 결함 4건 수정:
1. "Google US English"(Chrome 클라우드 WaveNet)가 'standard' 오분류 → Chrome 에서 로봇 로컬 음성(David)에 밀림.
2. `localService +20` 이 거꾸로 — 최고 음질은 클라우드(non-local) neural/Google 인데 로컬 우대 → David(45) > Google(15) 역전 버그.
3. 레거시 로봇 음성(eSpeak·MS David/Zira/Mark/Hazel/George) 감점 없음.
4. 저장된 voice 가 이 기기에 없으면(stale) 브라우저 기본(로봇)으로 조용히 강등.

수정 [tts-controller.ts](../apps/web/src/lib/workspace/tts-controller.ts): 점수 SSoT `voiceScore()` — neural/natural/studio(+100) > Online(+95) > Google(+85) > Siri/Premium/Enhanced(+70) > Apple named(+45), eSpeak/레거시 MS(−60), en-US(+15)>en-GB(+10), 학습친화 named(aria/jenny/ava…) nudge(+8). `localService` 미반영(품질 신호 아님 — 이름 기반). loadVoices 가 stale 저장값이면 best 재선정(LS 보존). getEnglishVoices best-first 정렬. [VoicePickerPopover](../apps/web/src/components/workspace/VoicePickerPopover.tsx) 상단 음성에 "추천" 배지. 예: Chrome/Win 에서 David(−43) 대신 Google US English(100) 선택.

### LCP 대량 결과 list — 7축 필터 통합 패널 (v06.73)

사용자 요청: "LCP 대량의 list 에 필터 조건 필요함. 전체 조건에 대한 커버리지가 필터에 있어야 함."

이전엔 `hidePublished` / `audioOnly` 토글 2개만 있었음. 결과 row 가 수십~수백 건일 때 큐레이터가 좁히기 불편 → 7축 필터 패널로 통합.

### 신 state — `listFilters` 7축

| 축 | 컨트롤 | 동작 |
|---|---|---|
| **검색** | text input | title + description 부분 일치 (대소문자 무시) |
| **소스** | 6개 chip 다중 선택 | 비어있으면 모두 통과 |
| **점수** | minScore slider (0~100) | `score.total × 100 >= minScore`. 0 = 전체 |
| **CEFR** | A1~C2 chip 다중 선택 | 소스 spec.targetCefr.min 기준. 비어있으면 모두 |
| **발행 상태** | segment (전체/미발행/발행) | 기본값 `미발행` (이전 `hidePublished=true` 와 동등) |
| **audio 보유** | segment (전체/있음/없음) | 기존 `audioOnly` 통합 |
| **기간** | recencyDays slider (1~365) | `now − published_at > N일` 차단. 0 = 전체 |

### UI ([BulkArticlesTab.tsx](../apps/web/src/app/admin/articles/BulkArticlesTab.tsx))

- 결과 헤더 안에 **`필터 [N]` 토글** (활성 필터 개수 chip — 기본 `미발행` 만 활성). ChevronDown 아이콘.
- 펼치면 grid 2열 (sm) 필터 패널. 각 축마다 라벨 + 컨트롤 + 현재 값 표시.
- 우하단 `필터 초기화 (기본값: 미발행만)` 버튼.
- 결과 카운트 표시 갱신: `N건 (필터로 M 숨김 / 전체 K)`.

### 적용 후 흐름

```
rows (서버 fetch)
  ↓ listFilters 7축 통과
visibleRows (사용자 필터링)
  ↓ sortBy (score | date) 정렬
displayRows (화면 표시)
```

소스별 / CEFR 별 / 점수 구간별로 사용자가 즉시 좁혀 큐 추가 후보를 명확히 식별 가능.

### LCP 대량 GET — 전체 재설계 (v06.72)

사용자 명시: "전체 재설계 해달라는것임" (선택 / 가져오기 개수 / 종류 / 결과 조건 모두 사용자 컨트롤). v06.71 의 부분 fix 가 부족 → 4축 동시 재구성.

### 신 state schema

| state | 역할 |
|---|---|
| `sourceConfig: Map<SourceKey, { selectedFeeds, maxItems }>` | 소스별 세부 — feed 개별 선택 + 가져올 최대 개수 (1~50) |
| `globalFilters: { minScoreOverride, recencyDaysOverride }` | 전역 spec override (null = spec 기본) |
| `expandedSources: Set<SourceKey>` | 어떤 카드가 펼쳐졌는지 |
| `fetchProgress: { current, total }` | fetch 진행 상태 (실시간 N/M feed) |

### 4축 UI 재구조 ([BulkArticlesTab.tsx](../apps/web/src/app/admin/articles/BulkArticlesTab.tsx))

#### A. 선택 — 빠른 선택 preset chips
상단에 `기본 (VOA+NASA+NIH)` · `전체 (6 소스)` · `고급 (학자+백과)` 칩 3종. 한 번에 합리적 묶음 선택.

#### B. 종류 — 카드 expand → feed 개별 체크박스
각 소스 카드에 "세부 설정" 토글 (ChevronDown). 펼치면 해당 소스의 feed 별 체크박스. 헤더에 `{선택}/{전체} feed` 표시.

#### C. 가져오기 개수 — 카드별 maxItems slider+input
펼친 영역에 maxItems range slider (1~50) + number input (양방향 동기). 기본값 = `SOURCE_SPECS[source].maxItemsPerBatch`. 카드 헤더에 `최대 N` 가시화.

#### D. 결과 조건 — 글로벌 필터 패널 (펼치기)
🎚 패널 토글. 펼치면:
- **최소 점수 override** (★ 0~100 slider) — spec.minScore 이상으로 강화 (낮추지는 못함; 다른 소스 spec 들 보호).
- **신선도 cutoff override** (1~365일 slider).
- `spec 기본값으로 초기화` 버튼.

펼침 헤더에 현재 override 값 표시 (`min★50 · 30d` 또는 `spec · spec`).

### 진행 상태 표시

fetch 중 버튼 라벨이 `가져오는 중… 3/9 feed` 로 실시간 갱신 + 아래 progress bar (0~100%) 표시. 사용자가 어느 정도 진행 중인지 한눈에 파악.

### handleBulkFetch 재구성

```
feedsToFetch = SOURCES 순회 → selectedSources & sourceConfig.selectedFeeds 만 추가
fetch 각 feed → done 카운터 + setFetchProgress
cap 단계 → globalMinScore = max(spec.minScore, globalFilters.minScoreOverride)
            (낮춤 X — 다른 소스 spec 보호)
        → spec 통과 후 applySourceLevelCap
        → sourceConfig.maxItems 추가 slice
```

### 결과 패널 (v06.71 그대로)

소스별 분포 (최종 / 원본 −드롭) + N feed. 0건 회색. drop 사유 tooltip.

### 사용자 흐름 (전후)

| 단계 | v06.71 | v06.72 |
|---|---|---|
| 빠른 시작 | 카드 일일이 클릭 | preset chip 1 클릭 |
| 종류 조절 | 불가 (spec 자동) | 카드 펼치고 feed 체크박스 |
| 개수 조절 | 불가 (spec 고정) | 카드 펼치고 slider 즉시 변경 |
| 결과 조건 | 불가 (spec 고정) | 글로벌 필터 패널 slider |
| 진행 상태 | "가져오는 중…" 만 | `3/9 feed` + progress bar |
| 결과 분포 | 텍스트 row 만 | sourceStats 패널 + tooltip |

### LCP 대량 GET — 인터페이스/결과 고도화 + 3건 fix (v06.71)

사용자 피드백: "VOA, NASA 외 전부 LCP 대량 가져오기 안됨. 선택, 가져오기 개수, 종류 등 가져오기 인터페이스, 결과 조건 등 고도화 해줘. 많이 불편함."

### 실측 진단 (curl + spec scoring 시뮬레이션)

| 소스 | parsed | 가드 통과 | 주요 실패 원인 |
|---|---:|---:|---|
| VOA | 20 | 20 | ✅ |
| NASA | 10 | 10 | ✅ |
| **NIH MedlinePlus** | 54 | **0** | desc 28~100자 / title 16~25자 (가드 120/25 너무 높음). MedlinePlus 본문 자체가 짧음 |
| **Wikinews** | **0** | 0 | 영문 사이트 사실상 비활성 (30일 ns=0 article 0건) |
| **Simple Wikipedia** | 30 | 18 | extract<60자 12개 사전 필터 후 |
| The Conversation | 50 | 50 | ✅ (v06.70 fix 효과) |

### 코어 버그 1건 — byCappedSource 하드코딩

[BulkArticlesTab.tsx](../apps/web/src/app/admin/articles/BulkArticlesTab.tsx) `handleBulkFetch` 의 cap 단계가 하드코딩 `['voa','nasa','nih']` 만 처리 → wikinews/the_conversation/simple_wikipedia 가 가져온 후 결과 row 에서 누락. SOURCES 전수 순회로 변경.

### Fix 3건

1. **NIH spec 완화** ([_curation-spec.ts](../packages/library-pipeline/src/ingest-article/_curation-spec.ts)): `minDescriptionLen` 120 → **40**, `minTitleLen` 25 → **15**, `recencyDays` 21 → **365**, `idealDescLen` 300 → **120**, `maxItems` 10 → **30**. MedlinePlus 본문이 본질적으로 짧은 특성 반영.
2. **Wikinews health=inactive**: SourceConfig 에 `health` + `healthNote` 신설. Wikinews 카드에 "⚠️ 외부 소스 비활성 — 영문 사이트가 현재 거의 비활성 (30일 새 article 0건)" 표시.
3. **byCappedSource 7종 전수 처리** (위 코어 버그 fix).

### 인터페이스 고도화 (사용자 명시 — "선택/개수/종류/결과 조건")

- **소스 카드 health badge** — health!=ok 시 카드 하단에 AlertCircle + 상태 메시지 (inactive=빨강 / unstable=주황).
- **결과 패널 신규** (`sourceStats`): 가져온 후 소스별 분포 표시 — 색점 + 라벨 + `최종 / 원본 (−드롭) (N feed)` 형식. 0건 소스는 회색 처리. tooltip 에 드롭 사유 (spec 가드 미통과). 사용자가 "어느 소스가 몇 건 회수됐는지" + "왜 드롭됐는지" 한눈에.

### 활성 ACP 6종 (v06.71 기준)

VOA (활성) · NASA (활성) · NIH (활성 — spec 완화) · Simple Wikipedia (활성 — 60% 회수) · Wikinews (⚠️ 외부 비활성) · The Conversation (활성).

### LCP 대량 — The Conversation description 추출 수정 (v06.70)

사용자 피드백: "LCP 대량에서 The Conversation 가져오기 기능 안되는 거 같음."

진단 (curl + Node 시뮬레이션):
- 외부 endpoint 정상 (HTTP 200, atom 50 entries)
- 라우트 정상 호출
- parseRssFeed 가 entry 별 description 추출 시 **`<summary>` (68자) 가 `<content>` (5720자) 보다 우선** → score 가드 `minDescriptionLen: 200` 통과 못해 모두 reject

수정 ([_helpers.ts](../packages/library-pipeline/src/ingest-article/_helpers.ts)):
1. `description / content / summary` 후보 중 **가장 긴 것** 선택 (이전: description → summary → content 순 fallback)
2. entity-encoded HTML 처리 순서: 이전 `decodeEntities(stripTags(desc))` 는 stripTags 가 `&lt;p&gt;` 같은 entity 를 못 풀어 HTML 태그 잔존 → `stripTags(decodeEntities(desc))` 로 변경. `\s+` 정규화 추가.

검증 (사후 시뮬레이션): 50 entries 모두 descLen ≥ 200 (이전 0건 통과). 평균 400 (slice 한계).

영향 — VOA / NASA / NIH / Wikinews / Simple Wikipedia 같은 다른 atom/RSS 소스도 동일 헬퍼 사용. content/summary 분리된 소스 모두 회복 가능 (지금까지는 description 또는 summary 만 잡혔던 케이스).

### ACP arxiv 소스 — 플랫폼 전체 삭제 (v06.69)

사용자 명시: "arxiv 삭제 (플랫폼 전체에서)."

**사전 확인**: `library_articles.source='arxiv'` 2 row (vocabularies / shared_word_sets / seed_catalog 연결 0). 데이터 손실 위험 없음.

**DB** migration [20260614240000_acp_remove_arxiv_source](../supabase/migrations/20260614240000_acp_remove_arxiv_source.sql):
- 잔존 2 article DELETE
- `library_articles_source_check` + `library_article_seed_catalog_source_check` 양쪽 CHECK 에서 `'arxiv'` 제거

**파일 제거**:
- `packages/library-pipeline/src/ingest-article/arxiv.ts`
- `apps/web/src/app/api/admin/articles/arxiv-feed/` (폴더 전체)

**타입/spec 정리**:
- `ArticleSource` (types-article.ts) — `'arxiv'` 제거
- `SourceKey` (_curation-spec.ts) — `'arxiv'` 제거. SOURCE_SPECS + SOURCE_DEFAULT_SPEC + 6 FEED_SPECS + SOURCE_RANKINGS_BY_LEVEL 모든 arxiv 항목 제거
- `SeedSource` (seed-upsert.ts) — `'arxiv'` 제거
- `index.ts` — `listArxivFeed` / `ingestArxivArticle` / `ARXIV_FEEDS` / `ArxivListItem` export 제거

**route/UI 정리**:
- `/api/acp/enqueue` — `HOST_TO_SOURCE` arxiv 패턴 제거, switch 분기 제거, `arxiv:ID` 직접 입력 처리 제거, 에러 메시지 갱신
- `/api/admin/articles/seed-list` — `VALID_SOURCES` 갱신 (6종)
- `BulkArticlesTab.tsx` — SOURCES 에서 arxiv entry 제거 (UI 노출 0)
- `RssFeedTab.tsx` — `source` prop 타입에서 `'arxiv'` 제거
- `AcpClient.tsx` / `page.tsx` / `(main)/library/scripts/page.tsx` — 헤더/설명 문구 갱신
- `ArticleCard.tsx` — `SOURCE_META.arxiv` 제거, 3종 신규 (simple_wikipedia / wikinews / the_conversation) 추가

**활성 ACP 소스 6종**: VOA · NASA · NIH · Simple Wikipedia · Wikinews · The Conversation.

### LCP 대량 GET — 7종 소스 endpoint 실측 점검 + 3건 fix (v06.68)

사용자 요청: "LCP 대량 GET 각 소스별 가져오기 점검해줘."

7개 endpoint 직접 fetch (curl `-A 'Vocaflow-LCP/2.0'`) 후 응답 분석:

| 소스 | HTTP | 항목 | 상태 |
|---|---:|---:|---|
| VOA as-it-is | 200 | 20 | ✅ |
| NASA news | 200 | 10 | ✅ |
| NIH medlineplus | 200 | **54** | ✅ (이전 grep 한 줄 카운트 한계로 1로 보였던 것) |
| arXiv cs-AI | 200 | 0 | ⚠️ RSS `<skipDays>Sat/Sun</skipDays>` — 주말 publish skip (정상 정책) |
| Wikinews `Special:NewsFeed` | **404** | 0 | ❌ URL deprecated |
| The Conversation all | 200 | 50 | ✅ |
| Simple Wikipedia good | 200 | **18/30 valid** | ⚠️ 12 페이지 extract 부족 (<100자) |

**수정 3건**:
- [wikinews.ts](../packages/library-pipeline/src/ingest-article/wikinews.ts) `WIKINEWS_FEEDS[0].url` `Special:NewsFeed` (404) → `api.php?action=feedrecentchanges&feedformat=atom&namespace=0&hidebots=1&hideminor=1&hideanons=1&days=30&limit=30`. namespace=0 으로 article 만 필터링. **단**: 영문 Wikinews 가 사실상 비활성 (30일 ns=0 article 0건) → 라벨에 "(※ 현재 거의 비활성)" 명시.
- [BulkArticlesTab.tsx](../apps/web/src/app/admin/articles/BulkArticlesTab.tsx) arXiv 라벨 → "arXiv (월~금만 publish)" — 주말 fetch 시 0건이 정상임을 사용자에게 안내.
- [simple-wikipedia.ts](../packages/library-pipeline/src/ingest-article/simple-wikipedia.ts) list 단계에서 extract 짧은 페이지(`<60자`) 사전 필터. [_curation-spec.ts](../packages/library-pipeline/src/ingest-article/_curation-spec.ts) `simple_wikipedia.minDescriptionLen` 100→60, `minTitleLen` 15→3, `idealDescLen` 300→250 (Simple Wikipedia 특성에 맞게 완화).

### VRL 일상 구체어 과대분류 교정 — 어린이 책 V-Level 부풀림 (v06.67)

StoryWeaver 어린이 그림책 "Ammachi's Amazing Machines"(Level 2, A2)가 book_v_level **V5(B1)**로 과대 산정. 분석: 53단어 중 34개가 V1-V4지만 **p75가 일상 구체어 과대분류 단어에 끌려** V5로 부풀려짐 — coconut→C1/V8, tray→C1/V5, neat→C2/V7, shell→B2/V5, ripe→C1/V6, toss→C1/V7, squeak→C1/V9, husk→C2/V10 (구체 picturable 일상어인데 C1-C2). centroid 2.85·CEFR-J A2.2는 A2로 맞았으나 p75만 부풀려짐.

**수정** [migration 20260614230000](../supabase/migrations/20260614230000_fix_overclassified_concrete_words.sql): 8개 단어 v_level/cefr_level 교정(V3-4≈A2 매핑) — 전역 적용. 교정+재산정 후 해당 책 book_v_level **V5→V4**, centroid 2.85→2.46, CEFR-J A2.2→A2.1 (모든 지표 A2 정합). 다른 어린이/구체어 도서가 또 다른 과대분류 단어를 만날 수 있어 광역 sweep 은 별도 과제.

### LCP 대량 소스 — wikinews / the_conversation / simple_wikipedia 추가 (v06.66 2/2)

v06.66 1/2 에서 arXiv 재노출 (4종). 남은 3종 (wikinews / the_conversation / simple_wikipedia) ingester 는 단건 `ingestXArticle` 만 있고 `listXFeed` 미구현이라 대량 GET 불가했음. 본 작업에서 7종 모두 활성화.

**라이브러리 파이프라인** (`packages/library-pipeline/src/ingest-article/`):
- [wikinews.ts](../packages/library-pipeline/src/ingest-article/wikinews.ts) `listWikinewsFeed` + `WIKINEWS_FEEDS` — Atom feed (Special:NewsFeed)
- [the-conversation.ts](../packages/library-pipeline/src/ingest-article/the-conversation.ts) `listTheConversationFeed` + `THE_CONVERSATION_FEEDS` — Atom feed 4종 (all/science/health/politics)
- [simple-wikipedia.ts](../packages/library-pipeline/src/ingest-article/simple-wikipedia.ts) `listSimpleWikipediaFeed` + `SIMPLE_WIKIPEDIA_FEEDS` — MediaWiki API `generator=categorymembers` + `prop=extracts` 단일 호출 (very-good / good)
- [_curation-spec.ts](../packages/library-pipeline/src/ingest-article/_curation-spec.ts) `SourceKey` 7종 확장, `SOURCE_SPECS` + `SOURCE_DEFAULT_SPEC` + `SOURCE_RANKINGS_BY_LEVEL` 갱신
- [index.ts](../packages/library-pipeline/src/index.ts) `listXFeed` + `X_FEEDS` + `XListItem` 3종 export

**DB** migration [20260614230000_acp_article_source_add_3sources](../supabase/migrations/20260614230000_acp_article_source_add_3sources.sql):
- `library_articles_source_check` + `library_article_seed_catalog_source_check` 두 CHECK 에 3종 추가.
- 기존 enqueue 가 정상 동작 (v06.46 enqueue → seed_catalog upsert path).

**Web app**:
- 신규 feed route 3종: [/wikinews-feed](../apps/web/src/app/api/admin/articles/wikinews-feed/route.ts) / [/the_conversation-feed](../apps/web/src/app/api/admin/articles/the_conversation-feed/route.ts) / [/simple_wikipedia-feed](../apps/web/src/app/api/admin/articles/simple_wikipedia-feed/route.ts) — voa-feed 패턴 동일 (seed_catalog upsert + publishedSourceIds dedup).
- [seed-upsert.ts](../apps/web/src/lib/acp/seed-upsert.ts) `SeedSource` 7종 확장.
- [BulkArticlesTab.tsx](../apps/web/src/app/admin/articles/BulkArticlesTab.tsx) `SOURCES` 에 3종 추가 (BookText / Newspaper / MessageSquareText 아이콘).

**커버리지** (학습 친화 우선순위 기반 정렬):

| 소스 | CEFR | 라이선스 | bulkPriority |
|---|---|---|---|
| VOA | A2-B2 | PD | 1 |
| NASA | B1-C1 | PD | 2 |
| NIH | B2-C1 | PD | 3 |
| arXiv | C1-C2 | CC-BY | 4 |
| Wikinews | B1-B2 | CC-BY-2.5 | 5 |
| The Conversation | B2-C1 | CC-BY-ND (display_only) | 6 |
| Simple Wikipedia | A2-B1 | CC-BY-SA | 7 |

The Conversation 은 CC-BY-ND 라 단어장 발행 차단 (license_class=cc_by_nd → display_only trigger). 워크스페이스 단어 학습은 클릭 툴팁(`lookup_word_meaning`)으로만.

### LCP 대량 소스 — arXiv UI 재노출 (v06.66 1/2)

사용자 피드백: "LCP 대량에서 소스 GET 대상이 3개만 보임. 전체 대상에서 전체부터 ~ 1개까지 선택할 수 있어야 한다. 옵션을 왜 선택하라고 하나? 기본 아닌가?"

가용한 모든 소스가 노출되는 것이 기본. v06.35 에서 arXiv 제거 코멘트("라이선스 비자유·C2+·텍스트 오염") 가 있었지만 ingester / SOURCE_SPECS / feed route 모두 완비됨. UI 만 재추가.

[BulkArticlesTab.tsx](../apps/web/src/app/admin/articles/BulkArticlesTab.tsx) SOURCES 에 `arxiv` entry 추가 (6 feed: cs-AI / cs-CL / cs-LG / q-bio / math-HO / physics-gen-ph). `learnerLevel='advanced'` 선택 시 자동 우선 정렬, beginner/intermediate 에선 "이 수준엔 어려움" 배지로 가드. 이전 제거 사유는 spec.minScore 와 targetLevels='advanced' 가 처리.

**남은 작업** (v06.66 2/2 — 별도 commit 예정): simple_wikipedia / the_conversation / wikinews ingester 는 단건 `ingestXArticle` 만 있고 `listXFeed` 미구현 → 대량 GET 불가. 3종에 RSS/MediaWiki API 기반 listFeed 추가 후 노출.

### "→ 소스 GET" 일괄 복귀 seed unlock 버그 수정 (v06.65)

Curated Books 에서 도서를 "→ 소스 GET" 일괄 복귀하면 도서는 삭제되지만 소스 GET 탭에 **"큐" 표시가 잔류**(StoryWeaver "Ammachi's Amazing Machines"로 발견). 원인: `admin_bulk_requeue_books` 가 seed catalog 를 `IF EXISTS(... imported_book_id=v_id) THEN count++` 로 **카운트만** 하고 `UPDATE` 를 안 함 → 이후 `DELETE library_books` 시 FK(`imported_book_id ON DELETE SET NULL`)가 `imported_book_id` 만 null 로, `imported_to_books` 는 true 잔존. (단건 `admin_delete_book` 은 DELETE 전 UPDATE 라 정상 — bulk 경로만 결함.)

**수정** [migration 20260614220000](../supabase/migrations/20260614220000_fix_bulk_requeue_seed_unlock.sql) (적용·검증): DELETE 전에 `library_seed_catalog` 실제 UPDATE(imported 플래그 해제) + 기존 orphan(매칭 library_books 없는 imported_to_books=true) 정리. 검증: Ammachi imported_to_books→false, orphan 0.

### /admin/articles 단계 이동 액션 — LCP 동등화 (v06.64)

사용자 피드백: "/admin/articles 도 프로세스에 필요할 때 LCP 와 같이 삭제, 단계 전 이동 등의 기능이 있어야지."

LCP `MyLibraryTab` 의 published→ready revert + 영구 삭제 액션을 ACP 글에도 동등 적용. 기존 ACP 액션은 force_publish / requeue / archive 3종만이었음.

migration [20260614220000_acp_admin_revert_delete_article](../supabase/migrations/20260614220000_acp_admin_revert_delete_article.sql):
- `admin_revert_published_article(uuid)` — `admin_revert_published_book` 미러. published → ready 전환 + shared_word_sets(library_article) 삭제.
- `admin_delete_article(uuid)` — `admin_delete_book` 미러. ready/archived/queued/failed status 영구 삭제. CASCADE 로 `library_article_vocabularies` 삭제, SET NULL 로 `library_article_seed_catalog.imported_article_id` unlock. `shared_word_sets` 잔존분 정리.
  - **texts.source_url='article:{id}' 마커는 보존** — 사용자 학습 진도 유지 (layout.tsx 가 fetch 시 null → 보이스/단어장 미연결).
- published 책은 revert 후 삭제 (LCP 와 동일 정책).

API route (v06.55 force-publish 와 동일 패턴 — `requireAdmin` + service_role + 동등 로직 직접 실행, browser RPC + DEV_ADMIN_BYPASS 함정 회피):
- [/api/admin/articles/revert](../apps/web/src/app/api/admin/articles/revert/route.ts) — shared_word_sets DELETE + `status='ready'`/`published_at=NULL`.
- [/api/admin/articles/delete](../apps/web/src/app/api/admin/articles/delete/route.ts) — status 가드(ready/archived/queued/failed) + shared_word_sets DELETE + seed unlock 카운트 + library_articles DELETE.

UI:
- [CuratedArticlesTab.tsx](../apps/web/src/app/admin/articles/CuratedArticlesTab.tsx) — published 행에 `검토대기` (Undo2), ready/archived/queued/failed 행에 `삭제` (Trash2 · danger tone). 둘 다 confirm 다이얼로그 (단어장 삭제 / 본문 CASCADE / 마커 보존 명시). `RPC_ROUTE` 맵에 두 신규 endpoint 추가.
- [AdminArticleReviewClient.tsx](../apps/web/src/app/admin/articles/preview/[id]/AdminArticleReviewClient.tsx) — 검수 페이지 푸터에 `검토대기로 되돌리기` + `영구 삭제` 액션 노출. `ActionButton` tone 에 `danger` 추가.

### /admin/articles 대량 GET 소스 선택 UX 개선 (v06.63)

사용자 피드백: "LCP 대량에 전체 소스 대상 중 선택할 수 있어야 하지 않나? 선택 기능도 현재 불편함."

[BulkArticlesTab.tsx](../apps/web/src/app/admin/articles/BulkArticlesTab.tsx) 소스 카드 UX 보강:
- **전체 선택/해제** 토글 — 헤더 우측 버튼 (`전체 선택` ↔ `전체 해제`). 한 번에 모든 소스 선택/해제. 이전엔 카드 하나씩 클릭.
- **선택 카운트** — `{selectedSources.size}/{SOURCES.length} 선택` 헤더 라인 표시.
- **명시적 체크박스 아이콘** — 카드 좌측 상단 `<CheckSquare>`/`<Square>` (lucide-react). 이전엔 카드 배경/테두리 색깔 변화만으로 선택 상태 표현 — 사용자가 인지하기 어려웠음.
- `toggleAllSources` 핸들러 신설 (전체 선택 상태 → 해제, 그 외 → 전체 선택).

소스 본체 (VOA/NASA/NIH) 와 spec/scoring/audio detection 등은 그대로.

### /text/[id] 본문 폰트/줄간격 컴팩트화 (v06.62)

사용자 피드백: "폰트와 줄간격이 너무 큼." 이전 `--reader-font-size: 16px` / `--reader-line-height: 1.7` 가 차분하지만 한 화면에 적게 들어와 읽기 흐름이 끊겼음.

수정:
- [globals.css](../apps/web/src/app/globals.css) `--reader-font-size` 16px → **15px**, `--reader-line-height` 1.7 → **1.55**
- [ReadingUniverse.tsx](../apps/web/src/components/workspace/ReadingUniverse.tsx) paragraph 사이 margin `mb-7 md:mb-8` → **`mb-4 md:mb-5`**

검수 페이지(`ChapterContent` = 16px/1.75) 보다 약간 컴팩트한 차분 본문. 사용자 단어 클릭/문장 듣기 인터랙션 영향 0.

### article direct-script 워크스페이스 줄바꿈 수정 — single-newline fallback (v06.61)

`/text/[id]` (article direct-script) 본문 줄바꿈이 검수 페이지(`/admin/articles/preview/[id]`)와 어긋남. v06.58 paragraph 정합 수정 후에도 article 케이스는 paragraph 가 한 덩어리로 표시됐음.

**원인**: article 의 `texts.paragraph_offsets` 가 NULL (article ingest 단계에서 산출 안 함). `buildParagraphsFromContent` 의 fallback 이 `\n\s*\n` (double newline) 만 시도 — article 본문은 보통 single newline 으로 paragraph 구분이라 byBlank=1 → 모든 문장이 한 paragraph 로 합쳐짐.

**수정**: 검수의 [AdminArticleReviewClient.tsx](../apps/web/src/app/admin/articles/preview/[id]/AdminArticleReviewClient.tsx#L49-L55) 동일 로직 적용:
```ts
const byBlank = content.split(/\n{2,}/).filter(Boolean)
rawSplits = byBlank.length > 1 ? byBlank : content.split(/\n+/).filter(Boolean)
```

VOA "Everyday Grammar" 같은 article (single newline 으로 paragraph 분리) 이 검수와 동일하게 paragraph 별 분리 표시.

### StoryWeaver 레벨→난이도 밴드 필터 (v06.60)

StoryWeaver 그림책은 **레벨(1-4)이 곧 난이도** (leveled reader). 소스 GET 시 [fetcher](../apps/web/src/lib/library/seed-fetchers/storyweaver.ts) 가 레벨→`est_v_level`(L1→V2 … L4→V5) 직접 설정 (SeedRow `est_v_level` 옵셔널 필드 추가). 단, 카탈로그 난이도 밴드가 V5(B1)부터라 초급 그림책(V1-4)이 어떤 밴드에도 안 잡힘 → [BulkFetchTab](../apps/web/src/components/admin/curation/BulkFetchTab.tsx) V_BANDS 에 **초급 A1–A2 (V1–4)** 밴드 신설. 이제 StoryWeaver 책이 난이도로 필터됨. (최종 난이도는 analyze coverage 가 SSoT — est 는 카탈로그 필터용 추정.)

### StoryWeaver fetch 403 수정 — Cloudflare JA3 차단 → curl 폴백 (v06.59)

`/admin/curation 소스 GET → StoryWeaver 가져오기` 에서 `StoryWeaver books-search failed: 403`. 원인: StoryWeaver 가 Cloudflare 로 **Node 의 TLS(JA3) 핑거프린트를 차단** — undici `fetch` 와 Node `https` 모듈은 브라우저 UA·전체 헤더를 줘도 403, 동일 IP 에서 `curl` 은 200 (TLS 핸드셰이크 fingerprint 차이). 단순 UA/헤더 수정으로 해결 불가.

**수정** — [storyweaver.ts(ingester)](../packages/library-pipeline/src/ingest/storyweaver.ts) + [storyweaver.ts(fetcher)](../apps/web/src/lib/library/seed-fetchers/storyweaver.ts) 에 `swFetchJson()` 도입: undici `fetch` 우선 시도(차단 안 되는 환경) → 실패 시 `curl` (execFile) 폴백. 브라우저 UA 사용. 큐레이션은 admin/dev 서버 작업이라 curl 가용 가정. 실측: books-search·read 양쪽 fetch 403 → curl 폴백 → 정상(L2 필터·16페이지·audio).

### /text/[id] 본문 — 검수 페이지와 줄바꿈/내용 정합 (v06.58)

`/text/[id]` 워크스페이스 본문 표시가 `/admin/curation/preview` 검수 페이지 본문과 어긋남. 사용자: "원문 내용의 검수한 내용으로 보이지 않음. 줄바꿈이 전체 안 맞음."

**원인 진단** (검수 ↔ 워크스페이스 본문 처리 비교):

| 항목 | 검수 (`ChapterContent`) | 워크스페이스 (`ReadingUniverse`, before) |
|---|---|---|
| boilerplate strip | ❌ (raw DB content) | ✅ (TOC/chapter header 잘라냄 + offsets shift) — **검수와 불일치** |
| paragraph 경계 | `splitByOffsets(paragraph_offsets)` | `splitByOffsets` + `stripBoilerplate` 적용 후 — **검수와 불일치** |
| paragraph 내부 `\n` | `whitespace-pre-wrap` 으로 보존 | `splitIntoSentences` 의 `\s+` 가 `\n` 흡수 → **줄바꿈 손실** |
| sentence 사이 구분 | (paragraph 단위라 무관) | `<span>` inline + `' '` 1개만 — `\n` 표현 없음 |

**실측** (published 책 ch1 newline 분포):

| 책 | content_len | para_offsets | total `\n` | single `\n` |
|---|---:|---:|---:|---:|
| Pride and Prejudice | 825 | 43 | 25 | **25** |
| Twenty years after | 24,995 | 82 | 506 | **506** |
| Pinocchio | 3,163 | 18 | 34 | 0 |
| Decline and Fall of Roman Empire | 54,189 | 41 | 80 | 0 |

→ Pride/Twenty 같은 소스는 paragraph 내부에 single newline 다수 — 이전 워크스페이스에서 모두 한 줄로 합쳐졌음.

**수정** (3 처):
- [text-content-helpers.ts](../apps/web/src/app/(main)/text/[id]/text-content-helpers.ts):
  - `stripBoilerplate` + `shiftOffsets` + 관련 정규식 4종 dead code 제거. ingest/normalize 가 SSoT, 워크스페이스는 raw content 사용 (검수와 정합).
  - paragraph 경계 = `paragraph_offsets` 만 사용 (검수 `splitByOffsets` 와 동일).
  - `splitIntoSentences` 의 sentence 경계 separator: `\s+` → `[ \t]+`. `\n` 은 sentence 경계로 보지 않고 sentence text 안에 보존.
- [ReadingUniverse.tsx](../apps/web/src/components/workspace/ReadingUniverse.tsx) `<p>` 에 `whitespace-pre-line` 추가 — sentence text 안의 `\n` 이 자동으로 `<br>` 효과. 검수의 `whitespace-pre-wrap` 와 동등 (paragraph 단위 표시).

결과: paragraph 개수는 검수와 동일 (paragraph_offsets 기준), paragraph 내부 줄바꿈은 보존, sentence 단위 재생/하이라이트 기능도 유지.

### 글 게시 2건 수정 — CHECK 위반 + dev-bypass 무반응 (v06.57)

**증상**
- `/admin/articles` list 의 "게시" 클릭 → alert: `new row for relation "shared_word_sets" violates check constraint "shared_word_sets_category_check"`
- `/admin/articles/preview/[id]` 의 "게시" 클릭 → 무반응

**원인 1 — CHECK constraint 누락**: v06.52 가 `publish_article_word_set` 를 추가하면서 `category='library_article'` 로 INSERT 하는데, 기존 CHECK constraint 가 `library_book` 까지만 허용 → INSERT 위반.

**원인 2 — browser RPC + dev-bypass 비호환**: 두 화면 모두 브라우저 `client.rpc('admin_force_publish_article')` 직접 호출. `DEV_ADMIN_BYPASS=1` 환경에서 cookie 세션이 없어 `auth.uid()`=NULL → `is_admin_or_curator()`=false → RPC throw "Forbidden". list 에선 alert, preview 에선 footer 의 작은 표시로 무반응처럼 보임. v06.55 의 책 게시 fix 와 동일 패턴.

**수정**
- migration [20260614210000_shared_word_sets_category_add_library_article](../supabase/migrations/20260614210000_shared_word_sets_category_add_library_article.sql) — CHECK constraint 에 `library_article` 추가
- 신규 [/api/admin/articles/force-publish](../apps/web/src/app/api/admin/articles/force-publish/route.ts) — `requireAdmin` + service_role 동등 로직 (copyright 검증 + `status='published'` UPDATE). `trg_publish_article_word_set` trigger 가 자동 발행
- [CuratedArticlesTab.tsx](../apps/web/src/app/admin/articles/CuratedArticlesTab.tsx) + [AdminArticleReviewClient.tsx](../apps/web/src/app/admin/articles/preview/[id]/AdminArticleReviewClient.tsx) — `rpcAction` 에 `RPC_ROUTE` 맵 추가 → `admin_force_publish_article` 만 fetch 호출로 전환 (다른 RPC 는 기존 path 보존)

### LCP StoryWeaver 소스 + 그림책 삽화/낭독 (v06.56)

StoryWeaver(Pratham Books) CC BY 4.0 그림책을 LCP 소스로 추가 — 페이지별 **삽화**(링크)와 **낭독 오디오**를 학습자에게 노출. 모든 파이프라인은 기존 LCP 모델 그대로 (ingest→normalize→segment→analyze→publish→단어장→enroll→workspace).

**마이그레이션** `20260614190000_lcp_storyweaver_source` (적용·검증됨):
- `library_books.illustrations jsonb` (`[{idx,url,alt}]` 링크) + `library_books.audio_url text` (readalong)
- `library_books_source_check` 에 `storyweaver` 추가 · `library_source_catalogs` storyweaver row (CC BY 4.0, composite 4.6, S-tier)

**ingester** [storyweaver.ts](../packages/library-pipeline/src/ingest/storyweaver.ts) — `/api/v1/stories/{id|slug}/read` (server-side fetch, UA 필수): StoryPage 텍스트→문단, `coverImage.sizes`→삽화(idx 정합), FrontCover→표지, `audioPath`→낭독, `authors`→저자, BackCover→제목/줄거리. 실측: 2-smile-please 12페이지·삽화·mp3 정상.

**파이프라인** — 3 LCP 라우트(process/dev-process/dev-validate) dispatch + 자산 persist(삽화/표지/오디오). StoryWeaver 는 자체 표지·오디오 제공 → resolveCoverImageUrl·LibriVox 매핑 우회.

**학습자** — [ReadingUniverse](../apps/web/src/components/workspace/ReadingUniverse.tsx) 가 문단 idx별 삽화를 `<figure>`로 렌더(plain img) + [workspace layout](../apps/web/src/app/(main)/text/[id]/layout.tsx) 이 `audio_url`→단일 스트림 `chapterAudio`(원어민 성우) + 삽화 전달.

**admin (개별 추가)** — [StoryWeaverIdTab](../apps/web/src/components/admin/curation/StoryWeaverIdTab.tsx) + [preview-storyweaver](../apps/web/src/app/api/admin/library/preview-storyweaver/route.ts) + EnqueueModal/AdminCurationClient 배선. /admin/curation Sources 탭 자동 노출 + "StoryWeaver" ID 탭(표지·페이지수·낭독 미리보기 → 큐 추가).

**admin (소스 GET 대량)** — [storyweaver fetcher](../apps/web/src/lib/library/seed-fetchers/storyweaver.ts) (books-search API: 레벨 1-4 필터 + 키워드 검색 + 페이지네이션) → `library_seed_catalog` 대량 적재. BulkFetchTab SOURCE_OPTIONS + seed-fetchers FETCHERS 등록. 마이그레이션 `20260614200000_lcp_storyweaver_seed_catalog` (seed_catalog source CHECK 확장). 목록엔 저자 미포함 → ingest 시 채움, 레벨은 genre/subjects 보존.

### 책 검수 페이지 "게시" 무반응 수정 — dev-bypass + browser RPC 호환 (v06.55)

`/admin/curation/preview/{book-id}` 의 "게시" 버튼이 dev-bypass 모드 (`DEV_ADMIN_BYPASS=1`) 에서 무반응. 원인: AdminReviewClient → `forcePublishBook(client, id)` 가 브라우저 supabase client 로 직접 `admin_force_publish_book` RPC 호출 → cookie 세션이 없어 `auth.uid()`=NULL → `is_admin_or_curator()`=false → RPC `RAISE EXCEPTION 'Forbidden'`. 에러는 reader footer 의 작은 영역에 표시돼 사용자 시야 밖. v06.48 의 다른 admin write route 와 동일 함정.

수정:
- 신규 [/api/admin/library/force-publish-book](../apps/web/src/app/api/admin/library/force-publish-book/route.ts) — `requireAdmin` 가드 + service_role client. SECURITY DEFINER RPC 의 `is_admin_or_curator()` 우회를 위해 RPC 대신 동등 로직 직접 실행 (copyright 검증 + `status='published'` UPDATE). `trg_lb_publish_word_sets` trigger 가 자동으로 챕터 단어장 발행.
- [admin-queries.ts](../apps/web/src/lib/library/admin-queries.ts) `forcePublishBook` 헬퍼를 fetch 호출로 전환 — 호출부 시그니처 보존. `AdminReviewClient` + `BookDetailModal` "강제 게시" 두 entry 모두 자동 fix.

### ACP article 추출 기준 LCP book 동등화 — V-Level 게이트 + skill penalty (v06.54)

v06.52 가 만든 `select_article_vocab` 는 register filter + composite 만 동일했고 **V-Level 게이트 / skill penalty 는 결락** — LCP book 의 `select_book_chapter_vocab` 와 비교 시 4축 점검 결과:

| 축 | LCP book | ACP article (이전) | 강화 후 |
|---|---|---|---|
| 재분석 | analyzeBook → library_book_vocabularies | analyzeArticle 동일 | 그대로 |
| SSoT (preview ↔ publish) | `select_book_chapter_vocab` 단일 | preview = library_article_vocabularies 직접 SELECT(base_learning_value DESC) / publish = `select_article_vocab` (분기) | RPC 일원화 |
| V-Level 게이트 (`v_level ≥ baseline`) | ✅ `book_v_level` (P75 DISTINCT lemma, V11 제외) | ❌ 없음 (V0~V10 모두 포함) | ✅ `article_v_level` 신설 + 게이트 |
| Skill penalty (`skill=4 AND baseline<6 → −0.10`) | ✅ | ❌ | ✅ 동일 적용 |
| Register filter + Composite weight | ✅ | ✅ | 동일 |

migration [20260614200000_article_v_level_ssot_unify](../supabase/migrations/20260614200000_article_v_level_ssot_unify.sql):
- `library_articles` 에 `article_v_level smallint` + `vrl_components jsonb` + `vrl_calculated_at` 컬럼 신설
- `compute_article_vrl(article_id)` 함수 (`compute_book_vrl` 미러 — DISTINCT lemma P75, V11 제외)
- `select_article_vocab` v3 (V-Level 게이트 + skill penalty 추가)
- 기존 ready/published article 전수 backfill (compute_article_vrl)
- 기존 published article 단어장 재발행 (V<baseline 단어 제거 반영)

code:
- [acp/dev-process/route.ts](../apps/web/src/app/api/acp/dev-process/route.ts) — analyzeArticle 직후 `compute_article_vrl` RPC 호출
- [admin/articles/preview/[id]/page.tsx](../apps/web/src/app/admin/articles/preview/[id]/page.tsx) — `library_article_vocabularies` 직접 SELECT + shared_dictionary JOIN 제거 → `select_article_vocab` RPC 단일 호출 (preview ↔ publish SSoT)
- [review-types.ts](../apps/web/src/lib/articles/review-types.ts) — `ReviewArticle.articleVLevel` 필드 추가
- [ArticleExtractionPanel.tsx](../apps/web/src/components/admin/articles/ArticleExtractionPanel.tsx) — 헤더 `article_v_level V{N} 이상` 표시 + MetaCell 5열 (`발행 기준` + `article_v_level` 추가)

**검증** (ready article 1건 실측):
- vocab raw 186 → V-Level 게이트 + skill penalty 적용 후 **47** (`v06.52` 의 180 대비 -73% — book LCP 와 동일 정밀도)
- backfill 결과: ready article 1건 article_v_level = V4 산출
- TypeScript 0 error

### Lit2Go 곱슬따옴표 엔티티 미디코딩 수정 — Huck Finn 미바인딩 정상화 (v06.53)

`/admin/curation/preview` *Huckleberry Finn* 단어추출 미바인딩 618건 진단. 원인: [ingest/lit2go.ts](../packages/library-pipeline/src/ingest/lit2go.ts#L212) `decodeEntities()` 가 USF 본문의 곱슬따옴표 named entity(`&ldquo; &rdquo; &lsquo; &rsquo;`)를 안 풀어 **ldquo/rdquo/lsquo/rsquo 가 단어로 잡히고(2,790회)** `s&rsquo;pose→ose`·`b&rsquo;lieve→lieve`·`Only→nly` 식으로 **실단어가 쪼개짐**(노이즈 + coverage 손실 동시). lit2go 소스에만 발생(다른 ingest 는 디코딩 정상). standard-ebooks 와 동일하게 4 entity 추가 + [reprocess-book.mjs](../scripts/lcp/reprocess-book.mjs) INGEST 맵에 lit2go 추가. Huck Finn 재-ingest/재추출 → **엔티티 쓰레기 0** · instead/suppose/need/believe **복구·바인딩**. 남은 미바인딩은 Twain eye-dialect(de/dat/dey/gwyne/wuz)로 정상(학습어휘 제외 맞음).

### ACP 학습 모델 완성 — 글=학습자 스크립트 (LCP 전체 체인 미러) (v06.52)

검수 페이지(v06.51)에 이어 **발행→단어장→학습시작→워크스페이스** 전 구간을 책(LCP)과 동등하게. 글이 라이브러리 스크립트로 학습자에게 제공되는 학습 모델 완성.

**마이그레이션** `20260614180000_acp_article_word_set_pipeline` (4 함수 + 1 트리거 + backfill):
- `select_article_vocab(uuid)` — `select_book_chapter_vocab` 단일-섹션 버전 (register 필터 + classified/meaning + composite 랭킹; book_v_level 임계만 제외). 실측: ready 글 186 raw → 180 선정.
- `publish_article_word_set(uuid)` — 발행 시 `shared_word_sets`(category `library_article`) 1개 + `shared_words` 생성 (멱등).
- 트리거 `trg_la_publish_word_set` (AFTER UPDATE OF status) — status→published 시 자동 (책 `trg_lb_publish_word_sets` 미러).
- `subscribe_article_word_set(uuid)` — SECURITY DEFINER auth.uid(): 학습 시작 시 구독 + `vocabularies` 시드 (책 `_enroll_book_subscribe_word_sets` 미러).

**프론트엔드**:
- [start-learning.ts](../apps/web/src/lib/articles/start-learning.ts) — 텍스트 생성(신규·재사용 양쪽) 후 `subscribe_article_word_set` 호출 → 학습자 WordVault 에 글 단어장.
- [text/[id]/layout.tsx](../apps/web/src/app/(main)/text/[id]/layout.tsx) — direct-script(article 파생) 분기 신규: `source_url='article:{id}'` → `library_articles.audio_url`→`chapterAudio`(원어민 보이스, FloatingAudioPlayer 재사용) + 글 단어장→`currentChapterWordSet`(워크스페이스 "단어" pill). 책의 librivox/챕터 단어장 경로 대응.

### ACP 글 검수 페이지 — LCP 책 검수와 동등한 큐레이션 프로세스 (v06.51)

기존 `/admin/articles` Curated 탭은 **목록 + 행 액션 버튼**뿐 — 본문을 읽지 않고 게시/보관해야 했음("목록만 보고 큐레이션?"). LCP 책 검수(`/admin/curation/preview/[bookId]`)의 **4패널을 글에 1:1 미러** — 할 수 있는 부분 모두 동일, 화면 골격 동일. (책=다챕터, 글=단일 섹션이 유일한 본질 차이.)

**신규 라우트** `/admin/articles/preview/[id]` — 책 검수 4패널 미러:
1. **본문 리더 + 게시 게이트** ([AdminArticleReviewClient.tsx](../apps/web/src/app/admin/articles/preview/[id]/AdminArticleReviewClient.tsx)) ↔ AdminReviewClient — 상단바(뒤로/상태/신뢰도/PublishControl) + 단일 섹션 리더 + 푸터 액션(지금 처리·재분석/재처리/보관). 게시 게이트 = `copyright_safe_in_kr` 강제(`admin_force_publish_article` 정합).
2. **보이스 연결** ([ArticleAudioPanel.tsx](../apps/web/src/components/admin/articles/ArticleAudioPanel.tsx)) ↔ LibriVoxAudioPanel — 글은 단일 오디오라 챕터 매핑 대신 `audio_url` 검증/미리듣기/연결·해제. 신규 [/api/acp/set-audio](../apps/web/src/app/api/acp/set-audio/route.ts) (service-role).
3. **학습 단어 추출** ([ArticleExtractionPanel.tsx](../apps/web/src/components/admin/articles/ArticleExtractionPanel.tsx)) ↔ BookExtractionPanel — meta cells(CEFR/단어수/추출수/읽기시간) + LV 내림차순 랭킹 테이블 + 📜/🏛 RegisterBadge + 미등재 경고.
4. **검수 팝업** ([ArticleWordSetPreviewModal.tsx](../apps/web/src/components/admin/articles/ArticleWordSetPreviewModal.tsx)) ↔ ChapterWordSetPreviewModal — 단어 전수 + 뜻 + 발음(TTS) + 본문 첫 문장 + register.

**데이터** — [page.tsx](../apps/web/src/app/admin/articles/preview/[id]/page.tsx) (RSC) service-role 로 `library_article_vocabularies` 전량 + `shared_dictionary`(meaning_ko/pos/cefr/v_level/word_register/frequency_rank) 조인 (vocab 테이블에 admin RLS 없음 → ready 상태도 검수 가능). 진입 = [CuratedArticlesTab.tsx](../apps/web/src/app/admin/articles/CuratedArticlesTab.tsx) 제목/검수 버튼.

**버그 fix** — [analyze-article.ts](../packages/library-pipeline/src/analyze/analyze-article.ts): vocab INSERT 전 기존 행 DELETE (재분석 시 중복 누적 방지 — 멱등).

**남은 follow-up** — 학습자 워크스페이스(`/text/[id]`)는 아직 글 `audio_url` 미재생(direct-script texts 오디오 미배선); 책의 chapterAudio 경로에 article 분기 추가 필요.

### Dev 일괄 처리 대상에 failed 도서 포함 (v06.50)

[MyLibraryTab.tsx](../apps/web/src/components/admin/curation/MyLibraryTab.tsx) — Dev 일괄 처리 (`devBatchIds`) 가 `inProgressIds + readyIds` 만 모았는데 **failed 도서가 빠져 있어** 정규식/네트워크 일시 실패 후 fix 한 도서를 batch 로 다시 못 돌림. failed 도서 1권을 다시 처리하려면 모달에서 한 건씩 dev-process 호출하는 번거로움.

수정:
- `failedIds` memo 신설 (`b.status === 'failed'`).
- `devBatchIds = [...inProgressIds, ...readyIds, ...failedIds]`.
- confirm 다이얼로그 + 카운트 chip + 버튼 title 에 실패 N 권 노출.
- failed 도서는 `dev-process` 가 status 게이트 없이 ingest 부터 재시작 (이미 그렇게 설계됨 — UI 만 막혀 있었던 것).

이번 세션의 Lit2Go 정규식 fix (v06.49) 같은 케이스에서 실패 도서를 batch 재처리하는 것이 자연스러운 흐름. 무한 루프 위험 0 (단일 round) — 다시 실패하면 그저 status 유지.

### Lit2Go 본문 ingest 실패 수정 — 0 chars (v06.49)

`/admin/curation → Curated Books → Lit2Go dev 일괄 처리` 시 `Lit2Go book body too short: 0 chars` 발생. 원인은 ingest 정규식이 실제 USF 마크업과 안 맞음 (WordPress 기본 wrapper 가정).

**3 처: 모두 [ingest/lit2go.ts](../packages/library-pipeline/src/ingest/lit2go.ts)**

| 항목 | 코드 가정 | 실제 USF 마크업 | 수정 |
|---|---|---|---|
| passage URL | `/lit2go/{book-id}/{passage-slug}/` (3 seg, 상대) | `https://etc.usf.edu/lit2go/{book-id}/{book-slug}/{passage-id}/{passage-slug}/` (5 seg, 절대) | 정규식 5-seg + 절대/상대 모두 매칭 |
| 본문 wrapper | `<div class="entry-content">` / `<article>` | `<div id="i_apologize_for_the_soup">` (재미있는 실제 USF id) | id 매칭 + `<audio>`/`<source>`/`<nav>` 사전 제거 |
| 책 제목 | `<h1>` 동일 라인 | `<h2>` 멀티라인 (`<h1>` 은 사이트 로고) | `<h2>` + 멀티라인 `[\s\S]*?` |
| author/collection/genre anchor | 상대 URL 만 | 절대 URL | `(?:https?:\/\/etc\.usf\.edu)?` prefix optional |

**검증**: 책 91 (`The King of the Golden River`) 로 dry-run — 5 passage URL + title/author + 본문 18,393자 모두 정상 추출.

### dev-bypass 모드에서 seed 큐레이션 RLS 거부 수정 (v06.48)

`/admin/curation → 소스 GET → Lit2Go 1권` 시 `new row violates row-level security policy for table "library_seed_catalog"` 발생. 원인: `DEV_ADMIN_BYPASS=1` 환경에서 `requireAdmin` 은 합성 admin 으로 통과하지만 `createClient()` 가 만드는 SSR client 의 cookie 세션이 비어있어 `auth.uid()` = NULL → 정책 `is_admin_or_curator()` 1행 (`IF auth.uid() IS NULL THEN RETURN false`) 에서 거부.

수정 — 두 admin write route 를 다른 동족 route (`delete-seed-catalog`, `save-librivox-audio`, `backfill-covers`) 와 동일하게 **service_role client** 로 통일:
- [fetch-seed-batch/route.ts](../apps/web/src/app/api/admin/library/fetch-seed-batch/route.ts) — 모든 source bulk fetch UPSERT
- [enrich-seed/route.ts](../apps/web/src/app/api/admin/library/enrich-seed/route.ts) — seed detail enrich UPDATE

`requireAdmin` 가드는 그대로 유지. 정상 로그인 사용자 영향 0, dev-bypass 모드에서만 동작 복구. lit2go 뿐 아니라 모든 fetcher (gutenberg / standard_ebooks / wikibooks / librivox / lit2go) 에 동일 함정이 잠재했음.

### Supabase advisor "Security Definer View" 5건 일괄 해결 (v06.47)

migration `20260614150000_views_security_invoker` — public 스키마 5 view (`library_seed_catalog_view`, `user_vocab_enriched`, `v_book_extraction_stats`, `v_text_content`, `v_user_book_progress`) 를 `SECURITY INVOKER` 로 전환. SECURITY DEFINER (PG15 default) 는 view creator (postgres superuser) 권한으로 실행 → 호출자 RLS 우회 위험. INVOKER 전환 시 호출자 권한으로 RLS 가 정상 적용. 기능 변화 0 — 5 view 기반 8 테이블 모두 RLS + 정책 (admin role / user_id 본인 필터 / public read) 갖춤. defense in depth.

### middleware — 리다이렉트 시 세션 쿠키 유실 수정 (갑자기 로그아웃)

`/admin` 가드의 `/login`·`/hub` 리다이렉트가 `getUser()` 가 갱신·회전시킨 Supabase 세션 쿠키를 안 실어 보냄 → 토큰 회전이 리다이렉트와 겹치면 새 쿠키 유실·옛 refresh 토큰 무효 → 세션 끊김(간헐적 "갑자기 로그아웃"). 리다이렉트 응답에 `response.cookies` 를 복사하는 `redirectTo()` 헬퍼로 교체 ([middleware.ts](../apps/web/src/middleware.ts)). Supabase SSR 미들웨어 필수 패턴.

### VOA 기사 본문 추출 수정 — balanced wsw + 클립 reject

ACP 대량 GET 에서 VOA 기사 enqueue 시 "body too short" 빈발. 원인·수정 ([voa.ts](../packages/library-pipeline/src/ingest-article/voa.ts)):
- **본문 토막남**: `<div class="wsw">` 본문 컨테이너가 **오디오 플레이어 div 로 시작** → 기존 non-greedy `</div></div>` 정규식이 첫 블록(~97자)에서 끊겨 transcript 22단락을 통째로 놓침. **`extractDivByClass`(div 중첩 균형 추출)** 신설 → 컨테이너 전체 회수 후 `<p>` transcript 추출 (실측: 97자 → 2,156자). "No media source currently available" 플레이어 boilerplate 제거.
- **클립 chrome 오긁기 차단**: `<article>`/whole-html 폴백이 transcript 없는 오디오·비디오 클립에서 nav·footer 메뉴를 본문으로 긁어 4,839자 garbage 통과시키던 것 → **wsw 없으면 명확히 reject**("no transcript body — audio/video clip?"). VOA transcript = wsw 컨테이너가 SSoT.

### Lit2Go (USF) 대량 GET 수정

Lit2Go bulk fetch 가 0건 / 삽입 실패. 두 원인 교정:
- **fetcher URL 정합** ([seed-fetchers/lit2go.ts](../apps/web/src/lib/library/seed-fetchers/lit2go.ts)): 책 링크가 절대 URL(`https://etc.usf.edu/lit2go/{id}/`)인데 상대경로만 파싱 → 0건. 절대/상대 매칭 + icon anchor skip → `/books/` 204권 추출. genre 는 실제 `genres/{id}/{slug}/`(slug-only 404) — 실제 22장르 매핑. per-band·audio listing 부재라 gradeBand/audioOnly 필터 제거.
- **CHECK 제약 보완** (migration `20260614130000_library_seed_catalog_source_add_lit2go`): `library_seed_catalog_source_check` 에 `'lit2go'` 누락(`20260614120000` 이 `library_books` 만 갱신) → seed 삽입 시 위반. 추가. + `getCatalogStats` CATALOG_SOURCES 에 lit2go 추가(통계 pill).

### LibriVox 권-인지 정합 — 다권 도서 100% 드레인 (v06.35)

**문제** — Les Misérables(5권) LibriVox 매핑이 92장 오배정. 원인: 이전 드레인이 5권을 flatten 후 `(book,chapter)` **번호**로 매핑 → 각 권이 "Bk 01"부터 재시작해 권 간 충돌 + 묶음파일("Ch 01-04")·포맷불일치("Bk 1" vs "Bk 01")·`<b>` 태그.

**해결 — 두 목록(소스 챕터 + LibriVox 섹션) 구조 분석 후 권-인지 매핑** ([librivox-chapter-map.ts](../apps/web/src/lib/library/librivox-chapter-map.ts) + `scripts/lcp/librivox-align.mjs`):
- **`alignChaptersByVolume`** — 권 N = 텍스트 Part N, 권 내 `(Book,Chapter)` 순서로 매핑(권 내 "Bk 01" 유일 → 충돌 0). 4-pass: ①번호매핑 ②퍼지 제목 교차검증(Levenshtein≥0.7+토큰+접두 — 표기차/악센트/`<b>`/`...`절단 흡수) ③**PASS2 제목복구**(edition shift: 오디오 추가/병합 챕터) ④**PASS3 번호신뢰**(제목 오타지만 라벨=위치 단일 미사용 섹션, `number_trusted` 보고). 묶음→블록재생, multi-part→멀티파트.
- **`alignChaptersByTitle`** — 단권 titled 용 (섹션↔챕터 제목 1:1).
- **결과**: Les Mis **364/364 (100%)** — gap 0, conflict 0, number_trusted 1(ch103 제목오타). 이전 92장 오배정 완전 교체.
- **정확도 원칙**: 검증/복구 못 한 건 omit → `pickChapterAudio` null → TTS. "강제 채움 금지 = 틀린 오디오 0".
- **NEW** `scripts/lcp/librivox-align.mjs`(드레인) + `librivox-dump.mjs`(두 목록 진단 덤프). `build-librivox-map.mjs` 헤더에 다권 시 librivox-align 안내.

### 큐레이션 파이프라인 점검 — 오류 6 + dead code 정리 (v06.35)

소스 GET(대량) → Curated Books 전 과정 2-에이전트 리뷰 + RPC 실측 후 일괄 수정:

**🔴 버그 픽스**
- [dev-process/route.ts](../apps/web/src/app/api/lcp/dev-process/route.ts) `collect_archaic_candidates` **try/catch 누락** → throw 시 이미 `ready` 인 책이 `failed` 로 뒤집히던 것 가드 (주석은 best-effort 인데 실제 미가드였음).
- [admin-queries.ts](../apps/web/src/lib/library/admin-queries.ts) `CATALOG_SOURCES` 가 기본 소스 `simple_wikipedia` 누락 + 미사용 `openstax` 포함 → 실제 fetcher 5종으로 교정 (BulkFetch 통계 0 표시 해결).
- `enqueueSeedRow` 의 `imported_to_books` UPDATE 에러 미확인 → throw 추가 (중복 enqueue 차단).
- dev-process 자동매핑 성공/녹음없음 시 `book_curation_jobs` 무조건 DELETE → `status IN ('pending','failed')` 가드 (진행 중 수동 매핑 잡 보존).
- dev-process 자동 enqueue `mode` 하드코딩 `dev_reprocess` → 원본 status 로 판정 (`dev_process`/`dev_reprocess`).
- [MyLibraryTab.tsx](../apps/web/src/components/admin/curation/MyLibraryTab.tsx) 워크플로 스텝퍼 **queued vs in_progress 불일치** → `'queued'` StatusFilter 신설 (필터/카운트/스텝 정합, `대기 중` 칩).

**🟡 dead code**
- `enqueueCurationJobsAction` + `enqueueCurationJobs` wrapper + `EnqueueCurationJobsResult` 제거 (이번 세션 "매핑 큐 등록" 버튼 삭제로 호출부 소멸 — dev-process 자동 등록이 대체).

남은 dead code(enrich-seed 라우트·languages 고급필터·requeueBook·book_curation_jobs 이중 fetch)는 영향 작아 후속 정리 대상.

### LCP 도서 소스 — Lit2Go (USF) 추가 + V-Level SSoT 정책 명시 (v06.43)

사용자 명시 — "Lit2Go (USF) 를 라이브러리 소스 get 대상으로 추가. 프로세스는 기존 준용, 레벨은 v level 로 제산". 외부 비평 (Lit2Go US grade ≠ CEFR ≠ EFL) 검토 후 정책 정합.

**핵심 정책 — V-Level SSoT 보호**

| 축 | Lit2Go 제공 | Vocaflow 처리 |
|---|---|---|
| US 학년 (Flesch-Kincaid) | ✓ | **`curation_meta.lit2go_grade` 보존만** (final 매핑 X) |
| 장르 (K-12 분류) | ✓ | curation_meta 저장 |
| 연령 (간접) | ✓ | `content_maturity` 플래그 (kids/teen/adult) — hi-lo 표시 |
| 컬렉션 | ✓ | curation_meta |
| 오디오 (USF MP3) | ✓ | curation_meta.audio_url |
| 본문 라이선스 | PD | source: 'lit2go' |
| 요약 라이선스 | CC-BY (USF) | 인용 권장 표시 |
| **V-Level** | ✗ | **coverage 모델이 SSoT** (analyze 단계 lexical_coverage + lemma_coverage_pct) |

**`est_v_level` 보정 매핑 — 보정 참조용 (final X)**
- US grade 1-2 → est V4 (A2/B1)
- US grade 3-5 → est V6 (B1)
- US grade 6-8 → est V7 (B1-B2)
- US grade 9-12 → est V8 (B2)
- College+ → est V9 (C1)
이 값은 `curation_meta.est_v_level` 로 보존되어 admin 검수 cross-check 신호.

**구현 — 기존 fetcher 패턴 준용**

1. **seed-fetchers/lit2go.ts** 신규 (admin 브라우징)
   - HTML scrape (Lit2Go API 없음)
   - 장르/학년 밴드/검색 필터링
   - `lit2goGradeToEstVLevel(grade)` + `lit2goInferMaturity(grade, genre)` 보정 helpers
   - `getOptions()` — sorts 2 / genres 11 / advanced (search, lit2goGradeBand, lit2goAudioOnly) / maxBatch 40 / ⚠ EFL 차이 hint

2. **types.ts SeedSource 확장** — 'lit2go' 추가 + `lit2goGradeBand` / `lit2goAudioOnly` FetchBatchParams 필드 + AdvancedFieldKey 확장

3. **index.ts FETCHERS / SOURCE_LABELS 등록** + 보정 helpers export

4. **library-pipeline ingest/lit2go.ts** (Stage S2 — 본문 fetch)
   - 책 페이지 + passage 목록 파싱
   - 각 passage 본문 결합 (USF 서버 보호 150ms sleep)
   - 메타 (US grade · 컬렉션 · 장르 · 오디오 · USF 요약) 보존
   - `LibrarySource` type 에 'lit2go' 추가
   - 라이선스 'PD-Body / CC-BY-Summary'

5. **AdvancedFetchPanel** — 'lit2goGradeBand' / 'lit2goAudioOnly' 필드 + state + buildAdvancedBody + countActive 정합

6. **BulkFetchTab UI** — SOURCE_OPTIONS / SOURCE_OPTS 에 'lit2go' 추가 + ⚠ hint 가시화

**hi-lo (high-interest / low-readability) 정책**
EFL 한국 학습자 — "쉬운 영어 + 연령 적합 흥미":
- US grade 1-2 picture book = 쉬운 영어 ✓ but 10대에게 유치 ✗ → `kids` 표시
- US grade 6-8 모험 = 적정 흥미 + 적정 어휘 → `teen`
- 어른 문학 = `adult`
admin 검수 시 hi-lo 미스매치 판단 가능 (kids + V8 = 모순 → reject)

**파급**
- BulkFetchTab 소스 6종 확장 (gutenberg/SE/wikibooks/librivox/simple_wiki/**lit2go**)
- 짧은 지문 부족 보완 (SE = 완본 / Lit2Go = passage 단위 granular)
- 학년별 탐색 가능 (Lit2Go readability/k-2, 3-5, 6-8, 9-12)
- **US grade ≠ V-Level 정책 명시** → 향후 다른 grade 기반 소스 추가 시 동일 패턴

### LCP 대량 GET — 소스 레벨 spec + 학습자 수준별 순위 (v06.42)

사용자 명시 — "소스별 가져오기 할때 조건/기준/순위가 필요함. 소스별로 검토하여 구성". v06.41 feed-level spec 위에 **소스 레벨 거버넌스** 추가.

**v06.41 부족 진단**
- v06.41 = feed 레벨 spec (15 feed × 8 dim) 만 존재
- 소스간 우선순위 X · 소스당 batch cap X · 학습자 수준 매칭 X
- VOA 4 feed × 15 + arXiv 6 feed × 8 = 108건 부담 + arXiv 과점 위험

**소스 레벨 spec 확장** ([_curation-spec.ts](../packages/library-pipeline/src/ingest-article/_curation-spec.ts))

새 `SourceSpec` 9 dimension — targetLevels / targetCefr / maxItemsPerBatch / minScore / bulkPriority / license + attributionRequired / topicDomain + styleGuide / preferredFeedMix.

**4 소스 spec 정의**

| Source | targetLevels | CEFR | cap | minScore | priority | preferredFeedMix |
|---|---|---|---|---|---|---|
| **VOA** | beginner+intermediate | A2-B2 | 30 | 0.40 | **1** | as-it-is 30 / lets-learn 30 / sci-tech 25 / words 15 |
| **NASA** | intermediate | B1-C1 | 24 | 0.45 | 2 | **APOD 50** / news 30 / iotd 20 |
| **NIH** | intermediate+advanced | B2-C1 | 18 | 0.45 | 3 | **medlineplus 60** / blog 25 / news 15 |
| **arXiv** | advanced | C1-C2 | 18 | 0.35 | 4 | cs-CL 30 / math-HO 20 / cs-AI 15 / cs-LG 15 / q-bio 10 / phys 10 |

**학습자 수준별 소스 순위** `SOURCE_RANKINGS_BY_LEVEL`
- **beginner** (A1-A2): VOA → NASA → NIH → arXiv
- **intermediate** (B1-B2): VOA → NASA → NIH → arXiv
- **advanced** (C1+): **arXiv → NIH → NASA → VOA** (역전)

**Helper 함수**
- `applySourceLevelCap(items, source)` — feed-level cap 후 소스 레벨 적용
  · 학습 적합도 score 내림차순 → minScore 이하 제거 → maxItemsPerBatch 까지 → preferredFeedMix 비중 분포 (greedy pick)
- `getSourceOrderForLevel(level)` — 학습자 수준 기반 순서 + 추천 여부

**Public API 추가** ([index.ts](../packages/library-pipeline/src/index.ts))
- 12 함수/상수 export (FEED_SPECS / SOURCE_SPECS / SOURCE_RANKINGS_BY_LEVEL / 6 helpers / 5 types)

**BulkArticlesTab UI 강화** ([BulkArticlesTab.tsx](../apps/web/src/app/admin/articles/BulkArticlesTab.tsx))
- **학습자 수준 선택기** — 입문/중급/고급 → 소스 카드 자동 재정렬 + "추천" 배지
- **소스 명세 카드** (단순 chip → 4 line spec):
  · 1행: priority 번호 + 라벨 + feed 수 + cap + 추천 배지
  · 2행: CEFR 범위 · 라이선스 · 인용 의무 · min ★
  · 3행: 문체 (styleGuide)
- **bulk fetch 후 소스 레벨 cap 적용** — applySourceLevelCap 호출 (소스당 max / minScore / feed mix 보장)

**파급**
- **고급 학습자** 선택 → arXiv 최상단 (이전 항상 4번째)
- **VOA 60건 → 30건** (cap 적용, 다른 소스에 자리 양보)
- **NASA APOD 50% 비중 보장** (news 가 많아도 APOD 절반 차지)
- **arXiv minScore 0.35** — 학술 본질 어려움 인정, 관대
- **인용 의무 가시화** — arXiv CC-BY 표시

### LCP 대량 GET — 소스별 큐레이션 spec + 학습 친화도 score (v06.41)

사용자 명시 — "LCP 대량에서 소스별 가져오는 조건/기준/순위 검토해서 적용". 진단 결과 4 source 모두 단순 `slice(0, 20)` 하드코딩 — 필터/순위/dedup 부재.

**진단**
| 영역 | 이전 | 문제 |
|---|---|---|
| 가져오는 양 | 하드코딩 20 | 학습 친화도 무관 |
| 필터 | 없음 | placeholder · 짧은 stub · stale 항목 통과 |
| 순위 | RSS 원순 (대개 최신) | 학습 적합도 무시 |
| 신선도 | 컷오프 없음 | arXiv 7일↑ stale, APOD 영원 등 차등 X |
| 중복 | client enqueuedKeys | `library_articles` 이미 발행 X · 큐 이미 있음 X |
| 소스 차등 | 일률 | VOA L1 = arXiv = 동일 가중치 |

**개선 4 축**

**1. 소스/피드별 큐레이션 spec** ([_curation-spec.ts](../packages/library-pipeline/src/ingest-article/_curation-spec.ts) NEW) — 15 feed × 8 dimension
- `recencyDays` — VOA L1=365 (학습용 stale OK) / NASA news=30 / NASA APOD=∞ (timeless) / arXiv=7
- `minDescriptionLen` — 50-150 (소스별, description 길이 = 본문 quality proxy)
- `minTitleLen` — 8-25 (placeholder 제거)
- `sourceWeight` — 0.50-1.00 (VOA L1=1.0 > NASA APOD=0.90 > NIH=0.78 > arXiv=0.55)
- `levelBonus` — −0.20~+0.30 (VOA Let's Learn=+0.30, arXiv q-bio=−0.20)
- `idealDescLen` — bell curve 정점
- `noiseKeywords` — title 포함시 제외 (`archive`/`advisory`/`recall`/`erratum` 등)
- `maxItems` — 6-15 (소스별 차등)

**2. 학습 친화도 score** — 합성 0~1
```
score = recency(0.40) + sourceWeight(0.30) + lengthFit(0.20) + levelBonus(0.10)
```
- recency = `1 - ageDays / recencyDays` (timeless feed=0.7 default)
- lengthFit = bell curve (idealDescLen 정점)
- 각 항목에 `score: { total, recency, source, length, level }` 부여

**3. DB dedup** — 4 route 모두 `library_articles` 이미 발행 source_id 조회 후 `publishedSourceIds` 응답
- 제거 X (가시화) — 클라이언트에 "발행됨" 배지 표시
- 토글: 발행 숨김 default ON

**4. UI 강화** ([BulkArticlesTab.tsx](../apps/web/src/app/admin/articles/BulkArticlesTab.tsx))
- **★ score chip** (75↑=green / 55↑=blue / 35↑=amber / 그 외=red) + hover tooltip (recency/source/length/level breakdown)
- **발행됨 배지** (회색) — checkbox disabled
- **정렬 토글** — 적합도 / 최신순
- **발행 숨김 토글** — default ON
- 전체 선택: 보이는 항목만 (숨김 항목 제외)

**파급**
- VOA Let's Learn (L1) `lets-learn-english` = 학습 적합 최우선 (score 0.85+)
- NASA APOD = 시각 매력 + timeless = 두 번째 우선 (score 0.80+)
- arXiv = score 0.45 권역 → 최상단 X (사용자가 학술 원할 때만 선택)
- 같은 항목 두 번 큐잉 방지 (DB dedup)

**구현 통계**
- 15 feed spec 정의 (VOA 4 / NASA 3 / NIH 3 / arXiv 6 — 미스매치 없음 정합)
- 4 source list 함수 시그니처 변경 (feedId 추가)
- 4 route 업데이트 (publishedSourceIds 동봉)
- BulkArticlesTab UI 4 신규 컨트롤

### 🌍 Contemporary Editorial v06.40 ★★★ (세계 최고 수준 벤치마크 정제)

사용자 명시 — "세계 최고 수준의 작품들을 찾아서 분석해서 검토한 후 적용". Reading Room v06.39 위에 Apple Books × Linear × Things 3 × Notion × Substack × Reflect × Bear 7개 분석 → "Contemporary Editorial" 정제.

**v06.39 진단**
- Paper `#FAF8F3` 너무 yellow → vintage 느낌 (Apple Books `#FAFAF6` 가 modern editorial)
- Navy `#1E3A5F` "old map" 톤 → contemporary depth 부족 (Linear 비교)
- Gold 적용 3곳 분산 (active + memory shaky + CTA) → Linear single-accent 원칙 위반
- Hairline 약간 visible → Reflect 가 입증한 "거의 invisible + 여백 구조" 원칙 미적용

**토큰 정제** ([tokens.css](../packages/design-tokens/src/tokens.css) + [colors.ts](../packages/design-tokens/src/colors.ts))

| 토큰 | v06.39 | v06.40 |
|---|---|---|
| `--p` | `#1E3A5F` | **`#0F2540`** deep ink (contemporary depth) |
| `--active` | `#B8893B` | **`#B0843A`** (살짝 less yellow + 적용 면적 제한) |
| `--bg` | `#FAF8F3` warm yellow paper | **`#FBFAF6`** Apple Books off-white |
| `--bg2` | `#F2EEE6` | **`#F4F0E9`** cleaner contrast |
| `--bg3` | `#EAE4D8` | **`#ECE6DA`** |
| `--t1` | `#1C1815` | **`#1A1714`** deeper ink |
| `--bd` | `#D8D2C2` visible | **`#E0DBD0`** subtler (Linear 정합) |
| `--error` | `#A03A2E` | **`#9C3A30`** deeper |
| `--warning` | `#C68A2C` mustard | **`#B5803A`** sophisticated |
| 다크 `--p` | `#5F8FC0` | **`#6B9BD1`** (다크 contrast 강화) |
| 다크 `--bg` | `#1F1A14` | **`#231D17`** (살짝 lighter) |
| 다크 `--bg2` | `#16130E` | **`#181410`** (덜 brown, 더 contemporary dark) |
| 다크 `--bd` | `#3A332B` | **`#3D362D`** |

**Memory Decay 정제** ([globals.css](../apps/web/src/app/globals.css))
- shaky `#C68A2C` mustard → **`#B5803A`** deeper amber (sophisticated)
- risk `#A03A2E` → **`#9C3A30`** deeper warm red
- new `#7A726A` → **`#8A8278`** lighter warm gray
- stable `#2E7D5A` 유지

**Hero typography 최종 polish**
- 5 페이지 hero (`/library/books`, `/vocab`, `/scripts`, `/diagnostic/history`, `/settings`)
  - 42→52px font-[600] → **44→56px font-[500] tracking-[-0.012em]**
  - 가벼운 weight + 큰 사이즈 = Substack/Bear 가 입증한 editorial 효과 ↑

**Frame 호흡 강화** ([Frame.tsx](../apps/web/src/components/ui/ios/Frame.tsx))
- title weight 700 → **600** (Linear/Things 3 정밀)
- tracking `-0.024em` → `-0.022em`
- header `mb-5` → **`mb-6`** (Reflect 정합)

**HubHero 정제**
- 그라데이션 더 깊은 ink (`#051428 → #0F2540 → #1F3B66`) + 금빛 light leak 채도 ↓ (0.20 → 0.16) — "촛불 켜진 서재" 정제

**glow tokens 절제**
- `--sh-ios-glow-tint` `.22` → `.20` (Linear 정합 절제)
- 모든 glow 채도 한 단 더 ↓

**SSoT 문서** ([DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) §World-class Benchmarks)
- 7개 작품 분석 표 (Apple Books / Linear / Things 3 / Notion / Substack / Reflect / Bear)
- 종합 진단 (v06.39 → v06.40 정제) 표
- 세계 최고 수준 적용 5조 (Single accent / Less yellow / Deeper ink / Subtler hairlines / Lora editorial 가벼움)

**파급 효과**
- 카드 = 더 modern off-white (vintage 느낌 사라짐)
- 텍스트 = deeper ink (premium contrast)
- 버튼 = deep ink navy (contemporary)
- 헤어라인 = 거의 invisible, 여백이 구조 책임 (Reflect 정합)
- Hero = 가벼운 Lora 큰 사이즈 = editorial 정점
- Frame 카드 사이 호흡 ↑ — Reflect 식 거대 여백 정합
- 컴포넌트 코드 0줄 수정 — CSS 변수 단일 체계의 이점 (v06.39 와 동일)

### 🎨 Reading Room Art Direction v06.39 ★★★ (iOS 골격 + 잉크/페이퍼/금)

외부 디자인 비평 검토 → 사용자 명시 (a) Reading Room 풀 피벗. iOS 정합은 **"안 깨져 보이는" floor 였고 ceiling 이 아니었음** 진단 + 아트 디렉션 단일 컨셉 커밋.

**진단 (외부 비평 검증)**
- 팔레트가 프레임워크 기본값 (Tailwind blue → iOS Indigo — 둘 다 system default, 브랜드 관점 0)
- 가장 강한 자산 Lora 가 본문 20px 유틸에만 갇힘. Hero/Display 는 평범한 Plus Jakarta
- 모듈마다 다른 "세계" (정글 / 하늘 / 네이비-골드 / 하늘) → "한 사람이 설계한 제품"이 아님
- iOS HIG = 안 깨져 보이는 floor. 그 위에 관점 없으면 모든 iOS 앱과 똑같이 보임

**Reading Room 컨셉 — "조용한 서재 / 문학적 도구"**
금고에서 꺼낸 종이와 잉크, 절제된 한 줄기 금빛. WordVault(금고/서재) + Calm UI + Memory Decay + PairFlip 검증된 네이비/골드 + Lora 시그니처 — 프로젝트가 이미 내포한 정체성 표면화.

**토큰 풀 재정렬** ([tokens.css](../packages/design-tokens/src/tokens.css) + [colors.ts](../packages/design-tokens/src/colors.ts))

| 토큰 | iOS Indigo (v06.38) | Reading Room (v06.39) |
|---|---|---|
| `--p` | `#5856D6` iOS Indigo | **`#1E3A5F`** ink navy |
| `--active` | `#FF9500` iOS Orange | **`#B8893B`** muted gold (시그니처) |
| `--bg` | `#FFFFFF` 순백 | **`#FAF8F3`** warm paper |
| `--bg2` | `#F2F2F7` | **`#F2EEE6`** page canvas |
| `--t1` | `#000000` 순흑 | **`#1C1815`** ink (warm) |
| `--t2~t4` | cool 알파 (60,60,67) | **warm 알파 (28,24,21)** |
| `--bd` | `#C6C6C8` | **`#D8D2C2`** paper hairline |
| `--success` | `#34C759` | **`#2E7D5A`** muted forest |
| `--error` | `#FF3B30` | **`#A03A2E`** warm red |
| `--warning` | `#FF9500` | **`#C68A2C`** warm amber (gold) |
| 다크 `--bg` | `#1C1C1E` | **`#1F1A14`** warm dark paper |
| 다크 `--bg2` | `#000000` 순흑 | **`#16130E`** warm dark (순흑 X) |
| 다크 `--t1` | `#FFFFFF` 순백 | **`#F0EAE0`** warm paper |
| Material 글라스 | white translucent | **paper translucent** |

**Memory Decay paper 톤 정합** — 채도 1-2단 하향, 의미 1:1 유지
- stable `#34C759` → `#2E7D5A` muted forest
- shaky `#FF9500` → `#C68A2C` warm amber (gold 계열, 시그니처 정합)
- risk `#FF3B30` → `#A03A2E` warm red
- new `#8E8E93` → `#7A726A` warm gray

**Lora editorial 승격** — Plus Jakarta 가 차지하던 모든 hero 자리 → Lora
- [tailwind.config.ts](../apps/web/tailwind.config.ts) — `font-editorial` (Lora) 유틸리티 신규
- 5 페이지 hero — `font-display 32-34px` → **`font-editorial 42-52px font-[600]`**
- HubHero greeting — Plus Jakarta 20px → **Lora editorial 26-30px**
- HubHero BigStat — Plus Jakarta 24px → **Lora editorial 30px**
- TodayHero h1 — Plus Jakarta 22-26px → **Lora editorial 28-34px**
- VaultIdentity hero 숫자 — Plus Jakarta 64-88px → **Lora editorial 72-96px**

**HubHero 풀 재설계** ([HubHero.tsx](../apps/web/src/components/home/HubHero.tsx))
- 그라데이션 iOS Indigo 3단 → **ink navy 3단 + 우측 상단 금빛 light leak** (`#0F1E33 → #1E3A5F → #2D5380` + `radial(#B8893B 20%) soft-light`) = "촛불 켜진 서재"
- CTA 흰 캡슐 → **금빛 캡슐** (`#D4A856` bg, `#0F1E33` text, gold glow) — 금고에서 꺼낸 보상

**glow tokens 정렬** — 모든 saturated glow → muted 톤 (paper 정합)

**SSoT 문서** ([DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) §Reading Room Art Direction)
- 컨셉 정의 ("조용한 서재 / 문학적 도구")
- 시그니처 3축 (paper bg / ink text / navy + gold brand) iOS Indigo 비교표
- 색상 토큰 카탈로그 (light + dark)
- Lora editorial 승격 hierarchy 표
- 5조 디자인 철학 (순백 X 순흑 X / Lora hero / 금빛 시그니처 모먼트 / 헤어라인 + 여백 / 동시 노출 색 3개 이하)

**파급 효과 — 토큰 1곳 변경 = 화면 전체 톤 교체**
- 모든 `bg-[var(--bg)]` 카드 = warm paper
- 모든 `text-[var(--t1)]` = warm ink
- 모든 `bg-[var(--p)]` 버튼 = ink navy
- 모든 `--memory-*` = paper 톤
- 다크 모드 = 진짜 "서재 야간" (warm dark + warm paper)
- **컴포넌트 코드 0줄 수정** — CSS 변수 단일 체계의 이점

**기존 iOS 골격 유지** — 12+ 프리미티브 (Card · Frame · SegmentControl · InsetGroup · InsetRow · Capsule · StatPill · ActivityRing · PrimaryButton · GlassBar · SheetContainer · Screen), 모션 토큰, 접근성 훅 모두 그대로. iOS 작업은 골격, Reading Room 은 표현.

### iOS 디자인 일관성 감사 v06.38.2 ★ (6 미정합 일괄 정리)

사용자 — "전체 화면의 디자인 컨셉의 일괄성을 점검해줘". 광범위 grep 으로 6 미정합 발견 + 일괄 정리.

**진단 발견 (6 미정합)**
1. `/library/layout.tsx` + `/my/layout.tsx` 가 `max-w-6xl + p-4 md:p-8` 로 자식을 감싸 → Screen 이중 적용 충돌
2. `font-[800]` 19곳 잔존 (Flashcard / SpellForge / ScriptQuiz / MyBooks / DiagnosticClient / HistoryTimeline / WeeklyHeatmap / StatCard / HubHero BigStat / TodayHero / BookDetailClient)
3. Tailwind hex 잔존 (TodayFocus `#3B82F6/#F59E0B`, ModuleCard `#F59E0B/#22C55E/#8B5CF6/#4A9FCF`, NetflixDetailSheet `#3B82F6`, ArticleCard CEFR, RecentActivity SRS 색)
4. Ad-hoc card div 15+ (`border bg shadow rounded-r-lg`) — Frame/Card 프리미티브 미사용 (Dashboard 3, HistoryTimeline, ContinueCard, ModuleCard)
5. 6 페이지 Screen 미사용 (재확인: flashcard/spellforge/scriptquiz/wordblitz 는 max-w-wide 폭만 통일됨 — 기능적 OK)
6. `page.tsx.bak` 백업 잔존

**수정**
- **P1 layout 충돌** — `/library/layout.tsx` + `/my/layout.tsx` 의 `max-w-6xl bg-gradient` 제거, 상단 Tabs 컨테이너만 `max-w-[var(--ios-content-wide-max)]` 로 통일. 자식 페이지의 `<Screen>` 이 폭/패딩 책임
- **P2 font-[800] → font-[700]** 일괄 (11 파일 19곳): Flashcard/SpellForge/ScriptQuiz/MyBooks hero stats, HubHero BigStat (24px), TodayHero h1, DiagnosticClient 5곳, HistoryTimeline 2곳, WeeklyHeatmap, StatCard 등 → 모두 iOS Display Bold (700) 정합
- **P3 Tailwind hex → iOS 토큰** (5 파일):
  · TodayFocus accent `#3B82F6/#F59E0B/#8B5CF6/#10B981` → `#5856D6/#FF9500/#AF52DE/#34C759` (iOS Indigo/Orange/Purple/Green)
  · ModuleCard 모듈 색 hardcoded → iOS systemColor 토큰화 (textviewer=brand / wordvault=purple / flashcard=orange / spellforge=blue / wordblitz=green / pairflip=pink / scriptquiz=yellow)
  · RecentActivity SRS hex → `var(--memory-*)` 토큰
  · NetflixDetailSheet `#3B82F6` → `#5856D6` / `var(--p)`
  · ArticleCard CEFR A2/B1 → `var(--ios-green) / var(--p)`
- **P4 ad-hoc card → iOS 정렬** (6 파일):
  · MemoryStatus / WeeklyHeatmap → `rounded-ios-2xl bg-bg shadow-ios-2`
  · RecentActivity → `rounded-ios-xl shadow-ios-1`
  · ContinueCard / ModuleCard → iOS interactive (rounded-ios-2xl + shadow-ios-2 + motion-safe hover:shadow-ios-3 + -translate-y-0.5 + ease-ios-emphasized + active scale)
  · HistoryTimeline → `rounded-ios-xl shadow-ios-2`
- **P6** `hub/page.tsx.bak` 삭제

**파급**
- /library/* 페이지 폭/패딩 = 모든 페이지 동일 (Screen이 일괄 처리)
- /my/* 페이지 동일
- 모든 카드 컴포넌트 = iOS radius + shadow + hover motion 정합
- 모든 hero stat 숫자 = font-700 (iOS Bold, ExtraBold 안드로이드 톤 제거)
- 모든 액센트 색 = iOS systemColor 토큰 (Tailwind hex 잔존 0)

### iOS Design Polish v06.38.1 ★ (타이포 + 디테일 모션 + 폰트 스택)

사용자 — "디자인 부분도 ios 감성을 더 강하게 해줘". 색상 v06.38 이후 **타이포·간격·디테일 모션** 으로 iOS 감성 풀 보강.

**진단 — 덜 iOS인 부분**
- Hero 타이틀 `font-[800]` ExtraBold → iOS Display는 `font-[700]` (800은 안드로이드 Material 톤)
- Hero 사이즈 28-32px → iOS Large Title 표준 **34px**
- 트래킹 `-0.025em` → iOS는 `-0.028em` (Display는 매우 타이트)
- Line-height `leading-tight` (1.25) → iOS Large Title은 **`leading-[1.05]`** (좁게)
- Body 13-14px → iOS는 17pt 표준, 부제 15pt
- 폰트 스택 Plus Jakarta Sans 우선 → **`-apple-system` 우선** (iOS/macOS는 진짜 SF Pro)
- 카드 hover 변화 X → **`hover:shadow-ios-3 + -translate-y-0.5`** + iOS spring
- 아이콘 컨테이너 `rounded-ios-sm` 8px → **`rounded-ios-md`** 12px continuous
- Chevron `text-t3/70` → iOS 정확 `rgba(0,0,0,0.30)` (dark에선 `rgba(235,235,245,0.30)`)
- Capsule font-700 → **font-600** (iOS Footnote bold)

**Hero Large Title 5 페이지 일괄 재정렬**
- [/library/books](../apps/web/src/app/(main)/library/books/page.tsx) · [/library/vocab](../apps/web/src/app/(main)/library/vocab/page.tsx) · [/library/scripts](../apps/web/src/app/(main)/library/scripts/page.tsx) · [/diagnostic/history](../apps/web/src/app/(main)/diagnostic/history/page.tsx) · [/settings](../apps/web/src/app/(main)/settings/page.tsx)
- `text-[28px] font-[800] tracking-[-0.025em] md:text-[32px]` → `text-[32px] font-[700] tracking-[-0.028em] leading-[1.05] md:text-[34px]`
- body subtitle 14px → 15px (iOS Subheadline)

**Frame 컴포넌트 강화** ([Frame.tsx](../apps/web/src/components/ui/ios/Frame.tsx))
- 섹션 타이틀 20→**22px** (iOS Title 2) · weight 700 유지 · tracking-[-0.022em]→**-0.024em** · leading-[1.1]
- meta 11→12px · More 링크 13→14px font-600 (iOS Footnote)
- mb-4 → mb-5 (헤더 호흡 증가)

**Card interactive prop** ([Card.tsx](../apps/web/src/components/ui/ios/Card.tsx))
- `interactive` boolean prop 추가
- 활성화 시: `hover:shadow-ios-3 + -translate-y-0.5 + active:scale-[0.99]` + ease-ios-emphasized + cursor-pointer
- motion-safe 가드 (Reduce Motion 사용자 비활성)

**InsetRow polish** ([InsetRow.tsx](../apps/web/src/components/ui/ios/InsetRow.tsx))
- 아이콘 컨테이너 `h-8 w-8 rounded-ios-sm` → **`h-[30px] w-[30px] rounded-ios-md`** + `shadow-[0_1px_2px_rgba(0,0,0,0.08)]` (iOS Settings 정확)
- title 14px font-600 → **15px font-500** (iOS Headline)
- metaRight `text-mono-11-t3` → **`text-display-15-400-t2`** (iOS 정확 우측 메타)
- chevron `text-t3/70 size-16` → **`text-[rgba(60,60,67,0.30)] size-17 strokeWidth-2.25`** (iOS 정확 + dark mode 분기)
- 셀 패딩 `py-3` → `py-2.5 + min-h-[44px]` (iOS 44pt 표준)
- 사이 gap `gap-1.5` → `gap-2` (메타-chevron 호흡)

**Capsule weight** ([Capsule.tsx](../apps/web/src/components/ui/ios/Capsule.tsx))
- `font-display font-[700]` → **`font-[600]`** 일괄 (iOS Footnote bold)

**Tailwind font stack** ([tailwind.config.ts](../apps/web/tailwind.config.ts))
- display/body 폰트 첫 fallback: **`-apple-system` + `BlinkMacSystemFont`**
- 효과: iOS/macOS 사용자 → 시스템이 **진짜 SF Pro Display/Text** 렌더링. 다른 OS는 Plus Jakarta Sans / DM Sans
- mono: `SF Mono` 우선

**SSoT 문서** ([DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) §iOS Typography SSoT)
- iOS Type Ramp 11단 (Large Title → Caption 2) Vocaflow 사용처 매핑
- 폰트 스택 설명 (왜 `-apple-system` 우선이 진짜 iOS인지)
- iOS Typography 핵심 원칙 7조 (font-700 / -0.028em / leading-1.05 / Body 17pt / Footnote 600 / Caption mono / tabular-nums)
- 안티패턴 (font-extrabold = 안드로이드 톤, tracking-tight = 약함, leading-tight = 1.25 너무 떨어짐)

### iOS 학습 브랜드 + Learning Color v06.38 ★★ (Indigo + Memory Decay iOS 정렬)

사용자 재진단 — "색상이 플랫폼에 안맞음. ios 색상 + 디자인 & 학습적 효과 색상 + 디자인". v06.37 systemBlue 채택의 문제 진단 + 재정렬:

**v06.37 진단**
- `--p` = `#007AFF` iOS systemBlue → "Apple Settings" 톤. system 앱(Settings/Files)이 쓰는 색을 학습 플랫폼이 차용 → 정체성 무력화
- 3rd party iOS 앱은 모두 **브랜드 색 + iOS 구조**: Duolingo(그린)·Things 3(블루)·Linear(퍼플)·Notion(블랙)·Spotify(그린). systemBlue 그대로 쓰는 건 시스템 앱뿐
- 학습 플랫폼 색채 심리 → 보라/인디고 = 학구열·사색·집중 (Korean academic 정서)

**결정 — `--p` = iOS systemIndigo `#5856D6`** (다크 `#5E5CE6` vivid)
- iOS systemColor 12종 중 하나 → HIG 정합 100%
- 학구열·사색 정서 → 학습 플랫폼 정합
- 다른 영어 학습 앱(블루/그린 위주)과 시각 차별

**토큰 재정렬** ([tokens.css](../packages/design-tokens/src/tokens.css) + [colors.ts](../packages/design-tokens/src/colors.ts))
- `--p` `#007AFF` → `#5856D6` (light) + `#0A84FF` → `#5E5CE6` (dark vivid)
- `--p-hover/--p-light/--p-dark` 인디고 단계로 일괄 재정렬
- `--bdf` (focused border) `#007AFF` → `#5856D6`
- **새 토큰** `--sh-ios-glow-tint` (인디고 브랜드 글로우) — `--sh-ios-glow-blue` (iOS Blue, info 액션 보존) 와 분리

**Tailwind + 컴포넌트**
- [tailwind.config.ts](../apps/web/tailwind.config.ts) — `shadow-ios-glow-tint` 추가
- [PrimaryButton](../apps/web/src/components/ui/ios/PrimaryButton.tsx) — `tone="brand"` glow → `shadow-ios-glow-tint`. `tone="info"` 는 iOS Blue 글로우 유지

**Memory Decay 4색 — Tailwind hex → iOS systemColor 1:1**
- [globals.css §Memory Decay Colors](../apps/web/src/app/globals.css) `--memory-{stable/shaky/risk/new}` 토큰 신규
- stable: `#22C55E` → **`#34C759`** iOS systemGreen
- shaky: `#F59E0B` → **`#FF9500`** iOS systemOrange
- risk: `#EF4444` → **`#FF3B30`** iOS systemRed
- new: `#94A3B8` → **`#8E8E93`** iOS systemGray
- [srs/state.ts](../apps/web/src/lib/srs/state.ts) 주석 정렬 + [VaultIdentity](../apps/web/src/components/wordvault/hub/VaultIdentity.tsx) `BUCKET_META` → 토큰화 (`var(--memory-stable)` 등)
- [CLAUDE.md §Memory Decay 표](../CLAUDE.md) iOS hex 정렬

**인라인 brand glow 일괄 정렬**
- [HubHero](../apps/web/src/components/home/HubHero.tsx) 그라데이션 — iOS Blue 3단 → **iOS Indigo 3단** (`#3C3AAB → #5856D6 → #7B79E0`)
- [ActivityRing](../apps/web/src/components/ui/ios/ActivityRing.tsx) · [VocabularyLevelMap](../apps/web/src/components/wordvault/hub/VocabularyLevelMap.tsx) · [NextStepList](../apps/web/src/components/wordvault/hub/NextStepList.tsx) · [FlowStripe](../apps/web/src/components/wordvault/hub/FlowStripe.tsx) — `rgba(0,122,255)` → `rgba(88,86,214)` iOS Indigo

**SSoT 문서** ([DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) §iOS Color SSoT v06.38)
- Indigo 채택 이유 명시 (systemBlue = Apple Settings 톤 / 3rd party 정합 / 학습 정서)
- 토큰 카탈로그 인디고 정렬
- **§학습 효과 색채 (NEW)**
  · Memory Decay 4색 iOS systemColor 1:1 표
  · 학습 플랫폼 색채 철학 5조 (단일 브랜드 액센트 / 의미별 1:1 / 동기부여 ≠ 압박 / V-Level 시각 진행 / Calm UI 자극 절제)
  · 색-의미 1:1 매핑 표 (Indigo=brand, Green=달성/i+1, Orange=주의/streak, Red=회복, Gray=중립)
  · 동기부여 vs 압박 색 사용 원칙 (risk 옅게, streak warm, 정답 spring, 오답 0.6초)
  · V-Level 시각 진행 (현재=Indigo, i+1=Green, 분포=ios-gray-3, V0/미진단=Gray)
- §don'ts 안티패턴 — "iOS systemBlue 를 브랜드로 사용 금지" 추가

**파급 효과**
- 모든 `bg-[var(--p)]` 버튼 = 즉시 인디고 (학습 정서)
- 모든 `--memory-*` 사용처 = iOS systemColor (시각 일관성)
- WordVault Hub 4 bucket (확실/익숙/회복/신규) = 학습 의미 명확
- HubHero 그라데이션 = "사색하는 깊이감" Apple Music 카드 톤

### iOS Color SSoT 풀 재정렬 v06.37 ★ (브랜드 → System Blue + Grouped Background + Label Color)

사용자 명시 — "ios 감성이 느낌이 아직 임. 특히 색상에 대해서는 ios 설계가 안되 있는거 같음". 진단 결과 토큰 핵심 3가지가 **Tailwind 톤 그대로** → iOS HIG와 1:1 정합으로 재정렬:

**근본 진단 (3 주요 미스매치)**
1. 브랜드 `--p` = `#3B82F6` (Tailwind blue) → **iOS는 `#007AFF` systemBlue** — 미세하게 다른 cyan-shift, Tailwind 티 100%
2. 캔버스 `--bg2` = `#F8FAFC` (Tailwind slate-50) → **iOS는 `#F2F2F7` systemGroupedBackground** — Tailwind는 푸른빛, iOS는 중성 톤
3. 텍스트 `--t1` = `#0F172A` (Tailwind slate cool) → **iOS는 `rgba(60,60,67,*)` label color (warm-neutral 알파)** — cool slate → warm-neutral

**토큰 풀 재정렬** ([tokens.css](../packages/design-tokens/src/tokens.css) + [colors.ts](../packages/design-tokens/src/colors.ts))

| 토큰 | 이전 (Tailwind) | 신규 (iOS HIG) |
|---|---|---|
| `--p` | `#3B82F6` | `#007AFF` systemBlue |
| `--p-hover` | `#2563EB` | `#0066D6` |
| `--p-light` | `#EFF6FF` | `#E5F1FF` |
| `--success` | `#22C55E` | `#34C759` systemGreen |
| `--error` | `#EF4444` | `#FF3B30` systemRed |
| `--warning` | `#F59E0B` | `#FF9500` systemOrange |
| `--info` | `#06B6D4` | `#32ADE6` systemCyan |
| `--bg2` (캔버스) | `#F8FAFC` | `#F2F2F7` systemGroupedBackground ★ |
| `--bg3` | `#F1F5F9` | `#E5E5EA` systemGray5 |
| `--t1` | `#0F172A` | `#000000` label |
| `--t2` | `#475569` | `rgba(60,60,67,.60)` secondaryLabel |
| `--t3` | `#94A3B8` | `rgba(60,60,67,.30)` tertiaryLabel |
| `--t4` | `#CBD5E1` | `rgba(60,60,67,.18)` quaternaryLabel |
| `--bd` | `#E2E8F0` | `#C6C6C8` separator opaque |

**다크 모드 — iOS 정확** (이전 진청 + 차가운 slate → 순흑 + warm-neutral)
- `--p` `#60A5FA` → `#0A84FF` (systemBlue dark vivid)
- `--bg` `#0B1120` → `#1C1C1E` (card)
- `--bg2` `#141E30` → `#000000` (순흑 캔버스, iOS Settings Dark 시그니처)
- `--bd` `#1E2D42` → `#38383A` (separator dark)
- 라벨 모두 알파 기반 (`rgba(235,235,245,.60/.30/.16)`)

**컴포넌트 정합 수정**
- [Capsule](../apps/web/src/components/ui/ios/Capsule.tsx) — `neutral` tone 배경 `--bg2` → `--bg3` (다크에서 캔버스 순흑과 겹침 방지)
- [Capsule](../apps/web/src/components/ui/ios/Capsule.tsx) — `green/purple/pink` 등 hex (`#15803D` 등) → iOS system color 토큰 (`var(--ios-green)` 등)
- [StatPill](../apps/web/src/components/ui/ios/StatPill.tsx) — 배경 `--bg2` → `--bg3` (동일 이유)
- [ActivityRing](../apps/web/src/components/ui/ios/ActivityRing.tsx) — glow `rgba(59,130,246,.25)` → `rgba(0,122,255,.30)` (iOS Blue)
- [FlowStripe](../apps/web/src/components/wordvault/hub/FlowStripe.tsx) · [NextStepList](../apps/web/src/components/wordvault/hub/NextStepList.tsx) · [VocabularyLevelMap](../apps/web/src/components/wordvault/hub/VocabularyLevelMap.tsx) — 인라인 glow Tailwind blue → iOS Blue
- [HubHero](../apps/web/src/components/home/HubHero.tsx) — 그라데이션 `var(--p-dark) → var(--p)` 토큰 → 명시 iOS Blue 3단계 그라데이션 `#0051A8 → #007AFF → #2A8BFF` (Apple Music 카드 톤)
- `--sh-ios-glow-{blue,red,orange}` shadow tokens — 모두 iOS system color RGB 기반으로 재정의

**SSoT 문서** ([DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) §iOS Color SSoT)
- iOS HIG 3대 색상 시스템 표 (System Tint / System Colors / Grouped Background / Label / Separator)
- 색상 토큰 카탈로그 (light + dark)
- iOS 색상 철학 dos/don'ts 14조
- Capsule tone 의미-색 1:1 매핑

**파급 효과 (자동 정렬)**
- 모든 `bg-[var(--bg2)]` 페이지 = 즉시 iOS 시그니처 그레이 캔버스
- 모든 `text-[var(--t1~t4)]` = warm-neutral 알파 라벨 (Tailwind cool slate 사라짐)
- 모든 `bg-[var(--p)]` 버튼 = iOS Blue (#007AFF), 즉시 Apple 앱 톤
- 모든 `border-[var(--bd)]` = 정확한 iOS separator
- 다크 모드 = 진짜 iOS Settings Dark (순흑 + 카드)

### iOS Design System — 전체 화면 일괄 적용 v06.36.2 (Tier A + 학습 모듈)

사용자 명시 — "전체 화면을 iOS 디자인 적용해줘. 최고 수준으로". 학습자 노출 빈도순 Tier A 5+α 화면 일괄 적용:

**핵심 화면 (deep iOS 재설계 — Card/Frame/ActivityRing/Capsule/PrimaryButton 기반)**
- [/hub](../apps/web/src/app/(main)/hub/page.tsx) + [HubHero](../apps/web/src/components/home/HubHero.tsx) — 캡슐 메타 row (Streak/V-Level) + iOS Primary 흰 캡슐 CTA (외부 shadow glow) + 큰 stat row (BigStat 24px tabular-nums)
- [/dashboard](../apps/web/src/app/(main)/dashboard/page.tsx) + [TodayHero](../apps/web/src/components/dashboard/TodayHero.tsx) — ActivityRing (오늘 목표 진행) + 거대 hero 인사 + PrimaryButton (done=success/in-progress=brand)

**진단/라이브러리 페이지 (Screen 래퍼 + iOS 헤더 + Capsule 통계 row)**
- [/diagnostic](../apps/web/src/app/(main)/diagnostic/page.tsx) + 5 위치 `max-w-xl/2xl` → iOS content max
- [/diagnostic/history](../apps/web/src/app/(main)/diagnostic/history/page.tsx) — Card 래퍼 + iOS 헤더 + 뒤로가기 링크 iOS 정합
- [/library/books](../apps/web/src/app/(main)/library/books/page.tsx) — 32px hero 타이틀 + SF Symbol 컬러 아이콘 box (ios-orange) + Capsule 통계 row (도서/챕터/단어/내 학습)
- [/library/vocab](../apps/web/src/app/(main)/library/vocab/page.tsx) — ios-purple 아이콘 + Capsule (세트/단어/카테고리/구독)
- [/library/scripts](../apps/web/src/app/(main)/library/scripts/page.tsx) — brand 아이콘 + Capsule (아티클/단어)

**학습 모듈 진입 페이지 (Screen 래퍼 통일 — `max-w-5xl` → `--ios-content-wide-max`)**
- [/text](../apps/web/src/app/(main)/text/page.tsx) · [/dictate](../apps/web/src/app/(main)/dictate/page.tsx) · [/pairflip](../apps/web/src/app/(main)/pairflip/page.tsx) — Screen 래퍼
- [/flashcard](../apps/web/src/app/(main)/flashcard/page.tsx) · [/spellforge](../apps/web/src/app/(main)/spellforge/page.tsx) · [/scriptquiz](../apps/web/src/app/(main)/scriptquiz/page.tsx) · [/wordblitz](../apps/web/src/app/(main)/wordblitz/page.tsx) — `max-w-5xl gap-6 p-8` → `max-w-[var(--ios-content-wide-max)] gap-4 px-4 py-6 md:px-6 md:py-8` (iOS rhythm)

**Settings 페이지**
- [/settings](../apps/web/src/app/(main)/settings/page.tsx) — Screen 래퍼 + 32px hero 타이틀 + 캡슐 TOC nav (rounded-ios-pill + shadow-ios-1 + active:scale) + Section 카드 `rounded-ios-2xl + shadow-ios-2` + 아이콘 box `rounded-ios-md`

**My 페이지**
- [/my/books](../apps/web/src/app/(main)/my/books/page.tsx) · [/my/texts](../apps/web/src/app/(main)/my/texts/page.tsx) — iOS 폭 + Screen 래퍼
- [/text/new](../apps/web/src/app/(main)/text/new/page.tsx) — `max-w-4xl` → `--ios-content-wide-max`

**iOS 정합 패턴 (전체 적용)**
- `Screen` 컴포넌트로 모든 페이지 셸 통일 — `width: content|wide|compact|full` variant
- 캔버스 = `bg2` (그레이) + 카드 = `bg` (흰)
- gap = `gap-4` (iOS rhythm, 이전 `gap-6` 보다 호흡 정밀)
- 헤더 = 32px Display 타이틀 + 14px body 부제 + Capsule 통계 row
- 폭 = `--ios-content-max` (820px Reading) / `--ios-content-wide-max` (1024px Browse)

**나머지 화면 (Phase 14.6 후속)** — Workspace `/text/[id]` (Player 이미 v06.35 재설계 완료), Admin Console (별도 보라 액센트 유지), 게임 play 화면 (자체 게임 미학 보존), Auth/Marketing (분리 처리)

### iOS Design System — audit 반영 v06.36.1 (D1-D9 patch)

외부 audit 점검 9건을 분석. 현재 코드 상태와 정합 검증 후 **실가치 있는 부분만 선별 적용** (audit 가 hypothetical 코드를 점검한 부분은 따로 처리):

**즉시 적용 (웹 — 실가치)**
- **D3 sheetUp keyframe 전역화** — [globals.css](../apps/web/src/app/globals.css) §4.5 에 `@keyframes sheetUp/sheetDown/scrimFadeIn` 추가. styled-jsx 스코프 해시 회피 → Tailwind `animate-[sheetUp_...]` 매칭 보장.
- **D6 `useReduceMotion` 웹 훅** — [useReduceMotion.ts](../apps/web/src/hooks/useReduceMotion.ts). CSS @media 가 1차 가드, JS-driven 애니메이션 (ActivityRing transition 등) 분기엔 이 훅.
- **D3 web SheetContainer 프리미티브** — [SheetContainer.tsx](../apps/web/src/components/ui/ios/SheetContainer.tsx). 전역 keyframe + solid scrim (블러 X) + Esc/scrim 닫힘 + body scroll lock + `aria-modal`.
- **D8 web Screen 프리미티브** — [Screen.tsx](../apps/web/src/components/ui/ios/Screen.tsx). `width: compact|content|wide|full` variant (580/820/1024/none) + safe-area inset + 배경 variant.
- **D6 ActivityRing reduce-motion 분기** — inline style `transition` 은 CSS @media 우회 → `useReduceMotion()` 으로 `transition: none` 명시.
- **D6 RecommendedBooks 카드 hover** — `motion-safe:` 가드 추가 (translate-y, scale).
- **사용 규약 13조** — `<SheetContainer>` · `<Screen>` 사용 강제 + JS-driven 분기 필수 등 [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) §사용 규약 확장.

**Phase 2 보존 (mobile shell — audit corrected 최종형)**
- [MOBILE_SHELL_SPEC.md](./MOBILE_SHELL_SPEC.md) **신규** — 외부 audit 의 corrected 최종 코드 8 파일을 그대로 보존. 현재 `apps/mobile/` 은 Expo·RN 의존성 미설치 상태 (theme tokens + root layout만). Phase 2 진입 시 1:1 복붙 + 사전 작업 체크리스트 정합.
- 핵심: **D1 LargeTitleScreen** (공간 회수 = large title 을 스크롤 콘텐츠 첫 요소) · **D2 Expo Router `href: null`** 명시 차단 · **D4 Material 단일화 + Android `dimezisBlurView`** · **D7 useWindowDimensions + solid scrim** · **D9 한국어 IME 셸 책임 아님** (TextInput 레벨).
- 명명 변경: **"iOS Layer" → "Native Layer (iOS-led)"** (Android 동시 타깃 정합).

**미정 항목 (D5 — 데이터로 결정)**
- TAB-IA-1 Home 위치 (6번째 탭 / `index` 라우트 / 폐기)
- TAB-IA-2 "게임" 탭 (wordblitz 직결 / `/games` 허브)
- MAT-1 바 blur 상시 vs 스크롤 시에만 (Calm UI 트레이드오프)
- 현재 스펙은 TAB-IA-1=② + TAB-IA-2=① 가정. 베타 측정 후 확정.

**audit 정정**
- **D6 부분 정합 확인** — `prefers-reduced-motion: reduce` CSS @media 가드는 이미 [globals.css:220](../apps/web/src/app/globals.css) 에 존재. audit 의 "코드 0" 주장은 부분 정확 (CSS 가드는 있고 JS 훅이 없었음 → 본 패치로 보강).
- **D3 web SheetContainer 자체가 부재** — audit 가 점검한 styled-jsx 버그가 있는 web SheetContainer 가 실제로는 존재하지 않았음. 본 패치로 audit 의 corrected 최종형을 NEW 컴포넌트로 등재.

### iOS Design System — 플랫폼 디자인 뼈대 v06.36 ★

사용자 명시 — "iOS 디자인 설계 철학, 개념, 특징 등 모든 요소를 정의하고 플랫폼 전체에 적용되도록 디자인 뼈대를 구성". 플랫폼 전체 SSoT 재구성:

**1. 토큰 확장** ([tokens.css](../packages/design-tokens/src/tokens.css) + [colors.ts](../packages/design-tokens/src/colors.ts))
- **iOS 시스템 컬러 12종** + 6단계 그레이 + 7 tints (HIG light) + Vivid dark 셋 (`--ios-{red,orange,yellow,green,mint,teal,cyan,blue,indigo,purple,pink,brown}`, `--ios-gray-{1..6}`)
- **iOS Radius 스케일** 9단 (`--r-ios-{xs:6 .. 3xl:32, modal:38, pill}`)
- **iOS Shadow 스케일** 4단 + 컬러 글로우 4종 (`--sh-ios-{1..4}`, `--sh-ios-glow-{blue,green,red,orange}`)
- **iOS Material 글라스** 3단 (`--mat-glass-bg-{thin,regular,thick}` + `--mat-glass-filter`)
- **iOS Motion** — Spring/Standard/Emphasized 4 easing + 4 duration
- **iOS Layout Inset** — Reading 폭 820/1024px, safe-area inset, NavBar/Toolbar/TabBar h
- **iOS Type ramp** — large-title → caption-2 (SF Display/Text 정합)

**2. Tailwind 조인** ([tailwind.config.ts](../apps/web/tailwind.config.ts))
- `bg-ios-*` / `text-ios-*` 25종 컬러 utility · `rounded-ios-{xs..pill}` 9종 · `shadow-ios-{1..4}` + glow · `ease-ios-{standard,emphasized,spring,spring-bouncy}` timing function

**3. Foundation 프리미티브 10개** ([apps/web/src/components/ui/ios/](../apps/web/src/components/ui/ios/))
- `Card` — 떠있는 카드 (size · elevation · as 슬롯)
- `Frame` — Card + section header (title + meta + More 링크)
- `SegmentControl` — UISegmentedControl 캡슐 (Link/button 모드, count 배지)
- `InsetGroup` — Settings 인셋 그룹 + header/footer 캡션
- `InsetRow` — Settings 셀 (icon box + title/subtitle + progress + chevron)
- `Capsule` — 정보·상태 캡슐 (9 tone, sm/md size)
- `StatPill` — Health Categories KPI 셀
- `ActivityRing` — Fitness 원형 진행도 (gradient + glow + emphasized easing)
- `PrimaryButton` — iOS Primary CTA (6 tone × 3 size, count 배지)
- `GlassBar` — Navigation glass header (thin/regular/thick material)

**4. WordVault Hub 6 Section 리팩토링** — 모두 프리미티브 기반으로 재림
- `page.tsx` 헤더 → `<GlassBar>` + `<SegmentControl>`
- VaultIdentity → `<Card>` + `<ActivityRing>` + `<Capsule>` + `<StatPill>` + `<PrimaryButton>`
- VocabularyLevelMap → `<Frame>` + `<Capsule>` + `<InsetGroup>`/`<InsetRow>`
- ResourcePortfolio → `<Frame>` + `<SegmentControl>` + `<InsetGroup>`/`<InsetRow>`
- RecommendedBooks → `<Frame>` + `<PrimaryButton>` (no-diagnostic CTA)
- NextStepList → `<Frame>` + `<Capsule>` (type 배지) + `InsetGroup` 구조
- FlowStripe → `<Frame>` + `<StatPill>`

**5. SSoT 문서** ([DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) §iOS / iPadOS 디자인 언어)
- HIG 3대 원칙 (Clarity · Deference · Depth) → Vocaflow 적용 매핑
- 핵심 개념 10종 (Continuous Corner · Gray Canvas · Glass Material · Capsule · Inset Grouped List · Segmented Control · Activity Ring · Hero Numerals · Primary CTA · iOS Color Glow)
- 시스템 컬러 의미 슬롯 매핑 (red=critical, green=success/i+1, orange=warning/도서, purple=단어장, ...)
- 토큰 카탈로그 + Foundation 컴포넌트 사용 규약 10조

### admin 검수 — 챕터별 원본 소스 deep-link 정확화 (v06.35)

**문제** — `/admin/curation/preview/[bookId]` 챕터 목록의 "원본 소스" 외부링크가 챕터를 못 찾음(404). `source-urls.ts` 가 Standard Ebooks 챕터 URL 을 `/text/chapter-N` 으로 **추측**했으나, SE 실제 챕터 URL 은 도서 구조마다 4종으로 갈림(검증):
- 파일분리 `/text/chapter-1` (단권 소설) · 앵커 `/text/fables#the-fox-and-the-grapes` (우화·시 모음) · 명명 `/text/charmides` (플라톤 대화편) · 중첩 `/text/chapter-1-1-1` (Les Mis 다권). DB 메타만으로는 형식 구분 불가.

**해결** — 적재 시점에 소스 TOC(`{ebookUrl}/text`)를 파싱해 챕터별 **실제 href 를 DB 저장**:
- migration `20260613120000_library_chapters_source_href` — `library_chapters_master.source_href text` 추가 + `insert_book_analysis` 가 `p_chapters[].source_href` 적재하도록 확장
- SE ingest(`standard-ebooks.ts`) — single-page `<section id>` ↔ TOC href fragment 조인 → 챕터 마커에 href 동봉(`CHAPTER_HREF_SEP` U+001E). segment 가 분리해 `ChapterSegment.source_href` 로 전달
- 렌더 — `listChapters` 가 `source_href` select, `ChapterSidebar` 가 저장값 우선 사용. `chapterSourceUrl` SE fallback 은 추측 `/text/chapter-N` → 안전한 도서 TOC(`/text`)로 변경(절대 404 없음)
- 백필(`scripts/lcp/backfill-se-chapter-hrefs.mjs`) — 기존 13권 ingest+segment 재실행 후 (group,title) 조인·idx 조인으로 `source_href` 만 UPDATE(본문/어휘 불변). **859/955 챕터 정확 매핑**(10권 100% · Les Mis 364 중첩 포함). 잔여는 안전 TOC fallback: Fables/Poetry 에디션 drift(intersection 만) · Dialogues 본문 손상(별도) · Alice·Marvelous Oz 미적재(0행, 별도 ingest 버그)

### 도서 lemma 바인딩 self-heal — 추출 시 자동 backfill (v06.35)

**문제** — Les Misérables(364장)가 수동 재분절로 `library_book_vocabularies` 재삽입되며 lemma backfill 누락 → 13,351 단어 전부 미바인딩(0 bound). 영향: 굴절형 어휘 추출 누락 + `lexical_coverage` NULL + 미바인딩 진단 13,351건이 "노이즈 1,000"으로 부풀려져 표시. (추출 SSoT 가 `COALESCE(bv.lemma, bv.word)` 라 base 형은 매칭됐으나 굴절형은 누락.)

**데이터 복구** (`backfill_book_lemmas` 실행):
- Les Misérables: 0 → **11,808 bound (88.4%)** · coverage 재생성 · 추출 4,343 단어 정상화 (남은 1,543 = 프랑스 고유명사 = 진짜 노이즈 tail)
- Twenty years after: 6,759 → **6,919 bound (97.6%)**
- 전수 스캔 결과 이 2권만 영향 (나머지 정상)

**재발 방지** (migration `20260613022941_extract_admin_self_heal_lemmas`):
- `extract_book_vocabulary_admin` 시작부에 `PERFORM backfill_book_lemmas(p_book_id)` 1줄 추가 → **매 추출마다 멱등 backfill 선행**. 어떤 경로로 깨졌든(수동 재분절 등) 추출 시점에 자동 복구. 부수효과: Claude Code 배치가 신규 등재한 사전 단어도 다음 추출에서 즉시 바인딩.

### WordVault — iPhone/iPad 감성 풀 적용 (v06.35)

사용자 명시 — "아이폰, 아이패드의 디자인 감성을 전체적으로 적용". iOS HIG 핵심 6 패턴을 6 Section 포트폴리오에 일괄 적용:

**iOS HIG 핵심 패턴**
1. **그레이 캔버스 + 떠있는 흰 카드** — `bg-[var(--bg2)]` 메인 + 카드 `rounded-[24px]` + soft shadow (`0_1px_2px + 0_8px_24px_-12px`)
2. **글라스 헤더** — `bg-[var(--bg)]/85 backdrop-blur-xl backdrop-saturate-150` (52px h)
3. **캡슐 세그먼트 컨트롤** — 헤더 view 전환, ResourcePortfolio 도서/스크립트/단어장 탭에 적용 (활성 시 `shadow-[0_1px_2px_rgba(0,0,0,0.06),0_2px_8px_rgba(0,0,0,0.04)]`)
4. **거대한 hero 숫자** — VaultIdentity `text-[88px]` SF Display 스타일 (`font-[800] tracking-[-0.045em] tabular-nums`)
5. **iOS Activity Ring** — 주간 목표 진행도 (140px size, 14px stroke, gradient + soft shadow, cubic-bezier easing)
6. **iOS Settings 인셋 그룹** — `rounded-[14px]` 바깥 + 흰 안쪽 divide-y, disclosure chevron, 8x8 컬러 사각형 아이콘
7. **App Store 카드** — RecommendedBooks 가로 스크롤 snap, aspect-[2/3] 표지 + 캡슐 fit-tier 배지 + `group-hover:-translate-y-1`

**Section별 변경**
- VaultIdentity — Activity Ring + 88px hero 숫자 + 캡슐 메타 (수준/단어장/누적) + 4 bucket iOS Health 카드 + iOS Primary CTA (tone별 컬러 buttom: critical/warning/info/neutral)
- VocabularyLevelMap — V-Level 캡슐 막대 (`rounded-full` + soft shadow), 현재/다음/합계 캡슐 row, 트랙은 iOS Settings 인셋 list
- ResourcePortfolio — 도서/스크립트/단어장 세그먼트 컨트롤 + 인셋 그룹 list (SF Symbol 컬러 아이콘 + 진도 막대 + chevron)
- RecommendedBooks — App Store 가로 스크롤 snap 카드 6권 (cover image or 그라디언트 fallback + fit 배지 캡슐 + V-Level/CEFR 미니 칩)
- NextStepList — iOS Settings 인셋 list + 컬러 type 캡슐 배지 (현재/다음/복습/관심/수능/비즈/학술)
- FlowStripe — Stats 캡슐 row (평균/활동/총합) + 28일 캡슐 막대 (`rounded-full`, 활동/오늘/비활동 3색)

**iOS 시스템 컬러 도입**
- 그린 `#34C759` (확실/달성/딱맞아요)
- 오렌지 `#FF9F0A` (익숙/도서)
- 레드 `#FF453A` (회복/critical CTA)
- 그레이 `#8E8E93` (신규/비활성)
- 퍼플 `#AF52DE` (단어장)
- 옐로/시안/핑크 (수능/비즈/학술)

**컨테이너** — `max-w-5xl` → **`max-w-[820px]`** (iOS Reading 폭 정합 + 가독성 ↑) + `gap-5` → **`gap-4`** (카드간 호흡 정밀화)

### WordVault — 단어 관점 종합 포트폴리오 6 Section 재설계 (v06.35)

사용자 요청 정합 — 학습자의 리소스 이력 + V-Level 정보 + 권장 도서 통합:

**1. Identity Hero** (VaultIdentity) — 자산 hero (큰 숫자 + V-Level 메타 + 4 bucket 가로 비교 + 단일 CTA + 주간 목표)

**2. Vocabulary Level Map** ★신규 ([VocabularyLevelMap.tsx](../apps/web/src/components/wordvault/hub/VocabularyLevelMap.tsx))
- 사용자 보유 단어를 V-Level 0-11 별 분포 막대 (120px 높이)
- 현재 V-Level → `var(--p)` 강조 / **i+1 zone (V+1) → `var(--success)` 강조** (Krashen 권장)
- 트랙별 수준 inline (csat_korean / business / academic — `user_profiles.current_track_levels` JSONB)
- 데이터: `vocabularies.lemma` JOIN `shared_dictionary.v_level` (500 chunk in() 쿼리)

**3. Resource Portfolio** ★신규 ([ResourcePortfolio.tsx](../apps/web/src/components/wordvault/hub/ResourcePortfolio.tsx))
- 3-column grid: 도서 / 스크립트 / 공용 단어장
- 각 row: 제목 + 진도 막대 + 마지막 학습 시점
- 도서: `texts.library_book_id` 그룹 + `library_books` 메타 fetch
- 스크립트: `texts.user_book_group_id` + 직접 입력
- 단어장: `user_word_set_subscriptions` (library_book 카테고리는 도서 단위 그룹화)
- 각 그룹 상위 4개만 + 마지막 시점 relative time

**4. Recommended Books** ★신규 ([RecommendedBooks.tsx](../apps/web/src/components/wordvault/hub/RecommendedBooks.tsx))
- 사용자 V-Level 기준 i+1 도서 4권 (이미 enrolled 도서 제외)
- `scoreBook(book, ctx)` ([recommend-books.ts](../apps/web/src/lib/library/recommend-books.ts)) 점수 매김
- `judgeIPlusOne(coverage, vLevel)` ([i-plus-one.ts](../apps/web/src/lib/library/i-plus-one.ts)) 적합도 태그 (딱 맞아요/도전/쉬워요/어려워요)
- 진단 미완료 시 /diagnostic CTA

**5. Next Step List** (NextStepList) — `recommend_word_sets_for_user(uuid)` 단어장 추천 (그대로)

**6. Flow Stripe** (FlowStripe) — 28일 sparkline + 평균/활동/총합 + 마지막 활동 (그대로)

**max-width**: 4xl → **5xl** (Portfolio 정보 밀도 ↑)

### WordVault — 한눈에 보이는 학습 대시보드로 재설계 (v06.35)

이전 4 zone (VaultIdentity / NextStepList / AssetGrid / FlowStripe) → **3 zone 압축**.

**문제**: AssetGrid (단어장 grid) 가 사용자가 알고 싶은 "학습 진행 정보" 가 아닌 "내 컬렉션 목록" 만 보여줌. 사용자는 학습 상태·진행도·다음 단계를 한눈에 보고 싶음.

**해결**:
- **AssetGrid 제거** (`components/wordvault/hub/AssetGrid.tsx` import 폐기 — 파일 보존)
- [VaultIdentity.tsx](../apps/web/src/components/wordvault/hub/VaultIdentity.tsx) 강화 — Mastery Hero
  - V-Level 메타 칩 추가 (`user_profiles.current_v_level` fetch · 강조 색 박스)
  - 4 bucket **가로 비교 막대** (이전 한 줄 stacked bar 폐기) — 각 bucket 별 레이블/dot/막대/수치/비율 동시
  - 레이블: "확실히 기억 / 익숙해지는 중 / 잊혀가는 중 / 새로 만난" (사용자 친화 문구)
  - "기억 X%" inline 요약 (stable + shaky / total)
  - 단일 CTA (이전 동일 — risk→shaky→new 우선순위)
- FlowStripe / NextStepList 그대로 유지 (각각 추세·다음 단계)
- max-width 4xl · 3 zone · 한 스크롤 안에 모든 학습 정보 가시

**보존**: AssetGrid.tsx 파일은 import 없이 보존 (필요 시 `/wordvault/browse` 등 다른 view 에서 재활용 가능).

### Workspace Player — 풀 재설계 (하단 dock + 글라스 + Step Hero) (v06.35)

[FloatingAudioPlayer.tsx](../apps/web/src/components/workspace/FloatingAudioPlayer.tsx) 전면 재설계 — 모던/심플/최고 수준 톤:

- **레이아웃**: `fixed bottom-5 left-1/2` 떠 있는 카드 → `fixed inset-x-0 bottom-0` **하단 dock** (전체 폭, 화면 끝에 anchored). 가운데 max-w 920px 콘텐츠.
- **글라스 효과**: `bg-[var(--t1)]/95 backdrop-blur-2xl` + `border-t` + `shadow-[0_-12px_32px_-8px_rgba(0,0,0,0.18)]` — 정제된 프리미엄 인상.
- **타이포 정제**: pill 탭 → **underline 탭** (active 시 흰색 2px 라운드 underline). 진행 카운트 `1 / 22` mono tabular-nums 회색.
- **Transport 정제**: 통일된 9×9 ghost button + 중앙 11×11 흰 둥근 play (그림자 깊이 강화).
- **Step Hero** (step mode 활성 시): 별도 카드 → **Lora 17-19px 문장 텍스트가 hero**. step meta (mono tracking-wider) + 상태 라벨 + 작은 pulsing dot (` ` 듣는 중 / `●` 따라 말해 보세요).
- **Countdown ring**: 카운트다운 bar 폐기 → **play button 주변 SVG ring** (`var(--success)`, `stroke-dasharray` decreasing). 시각 무게중심 통합.
- **Step 액션 정제**: 좌 `↺ 다시 듣기` (ghost) · 중 play (ring 포함) · 우 `다음 ⏭` (`--p` brand pill + glow).
- **LibriVox body** 도 색상/구조 정합 (Mic icon 작아짐, 시간 mono tabular-nums, 속도 button border 정제).

### Workspace Player — 따라하기 (Step) 모드 추가 (v06.35)

리틀팍스 스타일 step-by-step 학습 — 문장 1개씩 듣고 따라 말한 후 자동 진행.

**TTS Controller** ([tts-controller.ts](../apps/web/src/lib/workspace/tts-controller.ts)):
- `PlayMode` 에 `'step'` 추가 (기존 `'sentence'|'paragraph'|'all'` 외)
- `PlayState` 에 `'awaiting_repeat'` 추가 (문장 재생 후 따라하기 대기 상태)
- 새 state 필드: `repeatCountdown` (남은 초) / `repeatTotalSec` (총 초, UI 비율 계산) / `currentText` (현재 문장 텍스트)
- `playFromMode('step', sentences, 0)` — 첫 문장 재생 → onend 시 `startRepeatCountdown` 호출
- `startRepeatCountdown(sec)` — 문장 단어수 비례 자동 (`min(8, max(2, words × 0.35))`), 매 1초 `setInterval` tick → 0초 도달 시 자동 다음
- 사용자 액션: `stepReplay()` (현재 문장 다시 듣기) / `stepAdvance()` (카운트다운 무시하고 즉시 다음)
- `stop()` · `finish()` · `repeatTimer` 정리 보장 (메모리 누수 차단)

**FloatingAudioPlayer** ([FloatingAudioPlayer.tsx](../apps/web/src/components/workspace/FloatingAudioPlayer.tsx)):
- `MODE_OPTIONS` 에 4번째 탭 "따라하기" 추가
- `StepCard` 신규 — Step 활성 시 모드 toggle 아래에 카드:
  - 헤더: 큰 흰색 step 번호 배지 + `STEP · N / Total` 메타 + 상태 라벨 (`🔊 듣는 중` / `👤 따라 말해 보세요`)
  - 현재 문장 (Lora 15px)
  - 카운트다운 bar (success 색, 매 초 width 감소)
  - 액션 row: `↺ 다시 듣기` (좌) · `N s 후 다음` (중) · `다음 ⏭` (우, brand p 색)
- 진행 표시: `STEP 3 / 22` (mono tabular-nums)
- 중앙 ▶ 버튼 — step 모드면 `playFromMode('step', ...)` 호출 (전체 연속 X)

### WordVault 도서 단어장 챕터별 표시 X — 도서 단위 1 카드로 그룹 (v06.35 patch)

`useHubStats` — `category='library_book'` 인 `shared_word_sets` 는 `curation_query->>'book_id'` 별로 그룹화. Pride & Prejudice 61 챕터 단어장 → 1 카드 (제목 = library_books.title, subtitle = "저자 · CEFR · N장", distribution = 챕터 합산). `collectionsCount` 도 도서 단위로 카운트 (이전: 챕터 수 합산 → 부풀려진 컬렉션 수). href: `?filter=set:{firstChapterSet}&book={bookId}` (browse 의 prev/next 챕터 nav 자연스럽게 활성).

### WordVault 허브 전면 재설계 — 7 tier → 4 zone (v06.35)

**문제** — 이전 v06.20 허브는 7 tier (ModuleHero+VaultBar / Recommended / BookShelf / CEFR / FindAndMore / LearningDimension / MemoryDecay / WordPeek) 누적으로 인지 부하 ↑, 동일 정보 (단어 분포) 3번 노출, gradient + 이모지로 "전문적이지 않음" 인상, 목표/방향 부재.

**재설계** — Editorial monochrome (회색 + `--p` 액센트만, 그라디언트/이모지 제거) + 4 Zone:

1. **Zone 1 — VaultIdentity** ([VaultIdentity.tsx](../apps/web/src/components/wordvault/hub/VaultIdentity.tsx) 신규)
   - 큰 단일 숫자 (총 단어, 64-88px `tabular-nums`) + 4색 horizontal bar + bucket inline counts
   - **이번 주 목표** 진행 바 (`user_profiles.daily_word_goal × 7` vs `daily_activity` 7일 합)
   - **단일 CTA** 우선순위: risk → shaky → new → 둘러보기 (`/wordvault/browse?filter=state:...`)

2. **Zone 2 — NextStepList** ([NextStepList.tsx](../apps/web/src/components/wordvault/hub/NextStepList.tsx) 신규)
   - `recommend_word_sets_for_user(user_id)` 결과 3-5개 — 카드 X, 번호 매긴 text list (Editorial)
   - 진단 미완료 시 `/diagnostic` CTA + "진단을 마치면 V-Level 에 맞는 단어장 3-5개를 추천해드려요" 안내
   - type label: 현재 수준 / 한 단계 위 / 복습 / 관심 분야 / 수능 / 비즈니스 / 학술

3. **Zone 3 — AssetGrid** ([AssetGrid.tsx](../apps/web/src/components/wordvault/hub/AssetGrid.tsx) 신규)
   - 상시 가시 검색 input + 1/2/3 col grid
   - 각 카드: type label · 제목 (영문 prefix 이모지 strip) · 큰 숫자 (단어 수) · 4색 mini bar · inline counts
   - `useHubStats.books[]` 그대로 활용 (스크립트 + 공용 단어장 통합)

4. **Zone 4 — FlowStripe** ([FlowStripe.tsx](../apps/web/src/components/wordvault/hub/FlowStripe.tsx) 신규)
   - 28일 sparkline (`daily_activity` 직접 fetch) — 오늘은 `--p`, 활동일은 `--t3`, 빈 날은 `--bg3` opacity 0.5
   - 평균/활동/총합 (tabular-nums) + 마지막 학습 활동 (어제 · Flashcard 12개 등)

**Hub 조립** ([WordVaultHub.tsx](../apps/web/src/components/wordvault/hub/WordVaultHub.tsx) 재작성)
- 6 tier → 4 zone, max-width 5xl → 4xl (집중도 ↑)
- mock fallback 보존 (개발/비로그인 시 mock_books 등)

**Header** ([page.tsx](../apps/web/src/app/(main)/wordvault/page.tsx)) — Editorial 톤:
- "WordVault · 내 어휘" 메타 라벨
- ViewSwitcher: 4 옵션 (허브/둘러보기/학습/복습), 가독성 폰트 12px
- 메인 배경 `var(--bg2)` (zone 들이 `var(--bg)` 카드 위로 떠 보임)

**기존 컴포넌트 보존** — VaultBar / BookShelfSection / CEFRDistribution / FindAndMore / LearningDimensionSection / MemoryDecayDistribution / TrendIndicator / WordPeekStrip / RecommendedSetsSection / VLevelPromotionCheck 는 import 되지 않지만 파일 보존 (Phase 2 추가 view 에서 재활용 가능).

### LibriVox 챕터 매핑 — 로직 흡수 + 큐 단순화 (v06.35)

**문제** — v06.34 는 LibriVox 매핑을 "항상 사람 판단 필요"로 보고 큐(book_curation_jobs)+수동 "매핑 큐 등록" 버튼+수동 CLI 드레인+수동 잡 닫기 = 한 권에 4단계로 만들었다. 그러나 `buildChapterPartsMap` 의 count-gate 로 매핑은 대부분 자동이며, 사람 판단은 **count-gate 실패 시에만** 필요.

**해결** — 자동 매핑을 로직 단계로 흡수:
- **NEW** [`apps/web/src/lib/library/librivox-automap.ts`](../apps/web/src/lib/library/librivox-automap.ts) — `autoMapLibriVoxForBook(client, bookId)` 공유 헬퍼 (resolve → count-gate → flat 폴백 → `librivox_audio` 저장).
- [`save-librivox-audio/route.ts`](../apps/web/src/app/api/admin/library/save-librivox-audio/route.ts) `build_chapter_map` 분기 = 헬퍼 호출로 리팩터 (≈190줄 중복 제거, 응답 shape 보존).
- [`lcp/dev-process/route.ts`](../apps/web/src/app/api/lcp/dev-process/route.ts) 분석 직후 헬퍼 자동 호출 → `librivox: 'mapped' | 'queued' | 'no_recording'` 반환. **count-gate 통과 시 즉시 저장** (별도 버튼·CLI 불필요). 정합 실패본만 `book_curation_jobs` 자동 upsert(서비스롤 직접 — RPC admin 가드 우회), 성공/녹음없음은 큐 잡 자동 삭제 → 큐는 "사람 손 필요한 책"만.
- [`MyLibraryTab.tsx`](../apps/web/src/components/admin/curation/MyLibraryTab.tsx) — 수동 "매핑 큐 등록(Claude)" 버튼·`runEnqueueMapping` 제거. "Dev 일괄 처리" 배너에 `🔊 매핑 N · ⏳ 매핑큐 M` 집계. 워크플로 가이드 callout 갱신.

### 도서 큐레이션 — "→ 소스 GET" 시맨틱 재정의 (DELETE-based)

**Before** — `admin_bulk_requeue_books` 가 `status='queued'` UPDATE 만 수행 → 도서가 Curated Books 에 그대로 남음 (의도와 불일치).

**After** — `library_books` row DELETE → cascading effect:
- `library_book_vocabularies` (CASCADE) + `library_chapters_master` (CASCADE) 자동 삭제
- `library_seed_catalog.imported_book_id` (SET NULL) — seed 자동 unlock → BulkFetchTab 에서 재 fetch 가능
- `shared_word_sets` drafts 명시 DELETE (FK 없음, JSONB 참조)
- `archaic_candidates.first_seen_book_id` (SET NULL — FK 변경) — 단어 자산은 보존

| Migration | 내용 |
|---|---|
| `20260606225815_admin_bulk_book_status` | bulk RPC 초안 — status UPDATE 만 |
| `20260606231723_admin_bulk_book_rollback_cascade` | rollback cleanup 추가 (draft sets / vocabs / chapters) |
| `20260607005258_admin_bulk_return_to_source` | DELETE 시맨틱 재정의 (deleted_count / seed_unlocked 반환) |
| `20260607010118_archaic_candidates_first_seen_book_set_null` | FK ON DELETE NO ACTION → SET NULL |

**관련 RPC**: `admin_bulk_set_books_curating(uuid[])` (ready→curating, draft 삭제만), `admin_bulk_requeue_books(uuid[])` (→ 소스 GET, library_books DELETE).

**관련 UI**: [`apps/web/src/components/admin/curation/MyLibraryTab.tsx`](../apps/web/src/components/admin/curation/MyLibraryTab.tsx) — Curated Books toolbar 3 버튼 (`검토대기 → 처리중` / `처리중 → 소스 GET` / `검토대기 → 소스 GET`) + `▶ 큐 처리 (dev · N권)` (자동 반복 drain).

### Dev 큐 드레인 (production 외 pg_cron 회피)

`get_lcp_config()` 가 dev 환경에서 NULL → cron worker 가 pgmq 메시지 무시. Admin 이 직접 트리거하는 dev-only endpoint 추가:

- **NEW**: [`apps/web/src/app/api/lcp/dev-drain-queue/route.ts`](../apps/web/src/app/api/lcp/dev-drain-queue/route.ts) — `NODE_ENV !== 'production'` + admin 인증 가드, `max=5` 도서를 self-host `/api/lcp/dev-process` 로 순차 호출, `archive_book_pipeline_messages` 자동 정리.
- UI: 자동 반복 루프 (라운드별 fetch + remaining 카운트 + 1초 elapsed 타이머 + 중지/계속 banner).

### 사용자 입력 책 (챕터별) 모드

`/text/new` 가 "단일 스크립트 / 책 (챕터별)" 두 모드. 책 모드는 챕터 N개 → 한 UUID 그룹으로 묶음.

| Migration | 내용 |
|---|---|
| `20260608222229_texts_user_book_group_id` | `texts.user_book_group_id UUID` + CHECK(library_book_id IS NULL OR user_book_group_id IS NULL) + 부분 인덱스 |
| `20260608222931_v_text_content_user_book_group_v2` | `v_text_content` view 에 `user_book_group_id` 추가 |

**관련 신규 파일**:
- [`apps/web/src/lib/text-viewer/save-user-book.ts`](../apps/web/src/lib/text-viewer/save-user-book.ts) — `saveUserBook({ bookTitle, author, chapters[] })` (UUID 생성 + N row 일괄 INSERT + 부분 실패 rollback)
- [`apps/web/src/components/text-viewer/BookChapterInput.tsx`](../apps/web/src/components/text-viewer/BookChapterInput.tsx) — 챕터 워크벤치 (가로 레일 nav + Alt+←/→ 단축키 + 챕터별 작성 상태 시각화)

**관련 액션**:
- `deleteUserBookGroupAction(groupId)` 신규 (단일 텍스트 액션은 그룹 chapter 거부)
- `useTexts` 가 `aggregateUserBookChapters` 로 그룹 → 1 LibraryText 카드 집계 (category="내 책")
- Workspace `/text/[id]/layout.tsx` 가 `user_book_group_id` 분기 — synthetic BookRow + chapter siblings → ChapterSidebar 동작

### DB 디스크 회수 (운영 정리)

5,155 orphan `content_chunks` DELETE → VACUUM FULL 5종 (`library_book_vocabularies` 233 MB→39 MB · `content_chunks` 58→13 MB · `archaic_candidates` 21→9.5 MB · `library_chapters_master` 6.2→1.4 MB · `pgmq.q_library_pipeline`).

**결과**: DB 606 MB → **350 MB** (256 MB / 42% 감소).

### LibriVox 챕터 매핑 (Workspace 보이스)

`librivox-chapter-map.ts` 재설계 — `parseSectionChapterMeta` (Roman + Arabic + "Book X, Chapter Y") + `buildVoiceChapters` 그룹핑 + `verifyWithinBookContiguity` (책별 1..N 검증) + 1차 outlier 제외 실패 시 2차 재시도 (Two Treatises Ch 11 like 긴 챕터 보호). `save-librivox-audio` route 는 `chapter_parts` 실패 시 단권 `audio.section_count === masters.length` 시 자동 `flat` 폴백.

`LibriVoxAudioPanel` 이 legacy `mode === null + aligned === true` 도 flat 으로 인식 (Pride & Prejudice 등 기존 저장본 자동 노출).

---

## v06.34 — 사용자 학습 자산 시각화 + ENHANCEMENTS

**라이브러리 도서 V-Level 측정 방식 token → type 교체** (`compute_book_vrl_type_based_p75` migration) — Zipf 편향 차단. Christmas Carol/Treasure Island/Sherlock/Dorian 등 12 도서 V-Level 재측정 (예: V5 → V7~V8). 학술 정합 (Lexile/ATOS/CEFR-J Text Profile).

**도서·단어장 spec UI 적용** — `/library/books` LibraryGrid 카드에 `✨ 단어장` indicator + `word_set_count` prop. `BookDetailClient` Primary/Supplementary Tier 시스템. Workspace 상시 가시 사이드 패널 (`WordSetSidebar.tsx`, lg breakpoint 이상 320px).

**라우트 정리** — `/library/scripts` + `/library/scripts/[bookId]` → `/library/books*` redirect. `LibraryTabs` 3탭 → 2탭. 미사용 `PublishedBooksSection` / `BookCard` 삭제. `fetchPublishedBooks` + `PublishedBook` interface 제거.

**Spec 충돌 해석 명시** — Spec §4 "Primary 1 단어장" vs 챕터당 1 단어장 → "도서 학습 단어장" 통합 카드 + 챕터별 펼침으로 해석. Spec §5 "학습 완료 234/1748" vs 사용자 0명 → null placeholder + "학습을 시작하면 진행도가 채워져요" 안내.

---

## v06.33 — EchoMatch 따라읽기 모듈 (Shadow Reading)

**4-Phase cycle**: idle → listening (TTS) → recording (MediaRecorder) → comparing (DTW) → scored.

**라이브러리**: `pitchfinder` (YIN 알고리즘) + `dynamic-time-warping-ts`. **3축 점수 40/30/30 가중** — 인토네이션 (피치 contour DTW · PITCH_THRESHOLD=80Hz) + 강세 (RMS energy DTW · ENERGY_THRESHOLD=0.08) + 리듬 (durationMs ratio · MAX 2.5).

**코드 인프라** — `lib/echo/`: `pitch-extractor.ts` (YIN frame 2048/hop 512 + voicedFrames) · `dtw-comparator.ts` (3축 + `scoreFeedback`) · `audio-recorder.ts` (getUserMedia echoCancel/noiseSuppress/AGC + MediaRecorder webm/opus + playBothOverlay) · `tts-player.ts` (Web Speech API · voice 선택) · `sentence-splitter.ts` (약어 Mr/Dr 처리) · `save-attempt.ts` (세션 캐시 + attempt INSERT + finalize 통계 집계).

**컴포넌트** — `components/echo/`: `EchoMatchPlayer` (4-Phase 컨트롤러 + sessionCache + attemptCountRef) · `MicPermissionGate` (권한 요청 게이트) · `PhaseProgress` (4 pill + 진행 %) · `SentenceCarousel` (Lora 18-22px) · `PitchVisualizer` (Canvas 2D devicePixelRatio + 원어민 var(--p) vs 사용자 var(--success) overlay + 그리드 + 정규화 min×0.9 max×1.1) · `ScoreCard` (overall 48px mono + 3축 weight % 표시 + tone 색).

**DB Migrations 2건** — `echo_match_sessions` (user/text/library_book FK + avg/best/worst 점수 통계 + retried_sentence_ids TEXT[] + RLS own sessions) + `echo_match_attempts` (session FK + sentence_id TEXT + attempt_number + 3축 점수 + duration_ms + RLS own attempts + idx user_date).

**알려진 한계**:
1. Web Speech API TTS 출력 직접 audio 추출 불가 (브라우저 보안) — 현재 `buildSyntheticRefContour` 합성 reference. Phase 2 에서 사전 녹음 audio 파일 또는 cloud TTS + Storage 캐싱으로 진짜 비교.
2. DTW threshold (80Hz/0.08) PoC 후 사용자 베타 데이터로 보정 필요.
3. DTW Web Worker 미적용 (22 문장 챕터는 main thread OK · 100+ 문장에서 분리 필요).
4. iOS Safari 실 검증 미수행.

**학습 모델 매핑** — Shadow Reading 은 기존 9계층 매핑 없음. 실제 인지는 L4c (청각 → 음운 출력). 위치: `/text/[id]/echo` 별도 라우트 (ModePills 'shadow' 모드 → 이 라우트).

---

## v06.32 — Workspace 도서 챕터 단어장 chip + Reading Universe

**도서↔단어장 매핑 정합** + Workspace UnifiedHeader 챕터 단어장 chip — `subscribed/total` 표시 + 클릭 시 InsightPanel.

**노출 분리 정책 최종 확정** — 단어장은 도서 컨텍스트 안에서만 노출, 카드/그리드 어디에도 단어장 정보 노출 X.

**`/library/scripts` 사용자 영역** — mock CurationCard 4권 + 별도 "발행된 도서" 섹션 모두 폐기 후 `PublishedBooksSection` 으로 통합. BookCard 단순화 — 인라인 expansion 제거 + `Link` 로 변환 (도서 카드 = entry point only).

**`/library/scripts/[bookId]` 도서 상세 페이지 신규** — 네이비/골드 Hero (cover gradient + 제목/저자/CEFR/V-Level/CEFR-J/Lexile/FK + "읽기 시작" CTA → `/text/[id]`) + `BookDetailClient` (6열 챕터 단어장 grid · 구독 상태 시각화 · VocabSetPreviewModal 재사용).

**`/admin/curation/preview/[bookId]` `ChapterWordSetsAdminSection`** Client 전환 — 표 행 `role="button"` + Enter/Space 키보드 + `ChapterWordSetPreviewModal` 신규 (구독 CTA 없는 admin 전용 modal · 단어 전수 fetch + sort_order DESC + 발음 듣기 + 추출 메타 JSONB details).

**결정** — 학습 진행 % 표시 보류. 사용자 0명 단계라 `vocabularies × learning_records` JOIN 비용 vs 정보 가치 비효율 — 구독 카운트만 표시 (Phase 2 사용자 학습 데이터 누적 후 확장 예정).
