# Vocaflow — CLAUDE.md
# English Learning App · Design System · Single Source of Truth

> Quizlet Parts Kit v06 분석 기반, 영어 학습앱에 최적화된 디자인 시스템  
> **이 문서는 모든 컴포넌트 구현의 단일 기준(Single Source of Truth)입니다.**  
> 기술스택: Next.js 14 (App Router) · React Native (Expo) · Tailwind · Supabase · Claude API (Anthropic) · Vercel · Railway  
> **문서 버전: v06.29** (라이브러리 도서 난이도 4축 지수 정책 신설 — V-Level Centroid + CEFR 6-band(generated) + CEFR-J Wordlist v1.6 4-band(외부 표준 적재 7,035 lemma · 6,098 매칭 86.7%) + Flesch-Kincaid(자체 syllable counter). Migrations `phase3_cefrj_multi_source_v1` + `phase3_four_axis_difficulty_v1`. 5권 backfill — Alice V6 B1.1 FK10.5 / Pride V8 B2.1 FK12.4 / Frankenstein V8 B2.1 FK10.7 / Sherlock V8 B2.1 FK9.0 / Dorian V8 B2.1 FK6.2. Source-tier confidence (S/A/B/C/M) + Citation 의무(Tono Lab/TUFS). 산정 인프라 — `scripts/cefrj-import.mjs` + `scripts/book-readability.mjs` + `compute_book_cefrj()` + `bulk_compute_cefrj_for_all_sources()`. CLAUDE.md §"라이브러리 도서 난이도 지수" 섹션 신설 + Tier 1/2/3 도입 정책. V-Level↔CEFR-J monotonic 정합 외부 검증 매트릭스: V1→A1 76% / V6→B1+B2 92% / V7→B2 63%) · v06.28 (Admin Console — VRL Pipeline 별도 메뉴 신설 + 신고 뱃지 DB 연동. AdminSidebar `사용자&콘텐츠` 그룹 6→7항목 (Brain 아이콘). `/admin/vrl/*` 6 라우트 — Dashboard(KPI 4 + V-Level 12 진행)·Taxonomy(Levels/Tracks/Domains/Skills 4 tab read-only) 실 구현 + 4 stub(concerns/diagnostic/users/snapshots). `lib/admin/vrl/queries.ts` 단일 출처 (fetchVrlDashboard/fetchVrlTaxonomy). 신고 뱃지 mock `badge:7` → `admin/layout.tsx` Server fetch `reports.status='open'` COUNT 주입, 0건 시 자동 숨김. CLAUDE.md §15 라우트 12개 갱신 + AdminSidebar 그룹 갱신 + VRL Pipeline 섹션 신설) · v06.27 (Lexicon Unification Phase 2 ETL 적용 — `shared_dictionary` 38,476 → 38,542 row (`kice-orphan` 66 신규 INSERT). 모든 row `senses`/`primary_pos`/`pos_set` 100% 채움. `lexicon_frequencies` 6,305 신규 (Step 6 wfs migration + Step 7 csat-prep-core-2k 1,839 / ext-1.8k 1,097 list_tags 적재). `shared_words.lemma` 3,399 / `vocabularies.lemma` 1,228 backfill. Migrations 적용 — `20260521153559 lexicon_phase2_backfill` + `20260521154526 lexicon_phase2_step2b_remediate`. 적용 과정 fix commits 4개 — (1) `9d48b01` Step 0 source CHECK 'kice-orphan' 추가 / (2) `b709cc9` Step 1 assertion `<> 12976` → `<> 0` (pos hygiene+P5 ts-track 후 unknown=0 반영) / (3) `c43726a` Step 6+Final lf 임계값 정정 (8,000 → 6,000, orphan wl 1,654 의 wfs 영구 제외 반영) / (4) `db0c185` Step 2-B 버그 remediation — `meanings_ko` 가 plain-string 배열인 780 row 에서 `m || jsonb_build_object` 의 JSONB `||` semantic 으로 senses[i] = ["str", {sense_idx:0}] 변형 → 표준 sense object 로 재포장 + pos_set 재계산. 잔존 — kice-orphan 66 row meta 결손(upstream wl 결손, 후속 enrichment 대상) + sw.lemma 88 / vocab.lemma 31 OOV (Phase 3 surface_index MV 해결 예정)) · v06.26 (Lexicon Unification Phase 1 — 스키마 확장. Migration `20260520_120000_lexicon_phase1_expand.sql` 적용. `shared_dictionary` 11개 통합 컬럼 추가 (`senses` JSONB, `primary_pos`, `pos_set`, `ipa_uk/us`, `cefr_confidence`, `domain_tags`, `frequency_score`, `frequency_band`, `verified_by/at`). `lexicon_frequencies` 사이드카 신설 — KICE+WM+EBS+NGSL+AWL+COCA 다중 출처. `vocabularies`/`shared_words`/`library_book_vocabularies`/`library_article_vocabularies` 에 `lemma TEXT REFERENCES shared_dictionary(word)` 추가. `vocab_seed_candidates`/`vocab_enrichment_queue`/`vocab_dict_hits` 에 `lemma_normalized` 추가. `word_lexicon` INSERT 차단 트리거 `trg_word_lexicon_freeze` 설치 — 5,421 row 보존 + Phase E DROP 예정. Playwright 1.60 + chromium-headless-shell + e2e 3종 `baseline-pre-phase2` 측정 완료 (5 PASS / 2 FAIL — selector/mock 이슈, Phase 4 시점 해결 예상)) · v06.25 (`shared_word_sets` ↔ `dictionary_categories` 브릿지 — 최소 외과수술. ALTER 만으로 `category_id` (단일 FK) + `additional_category_ids` (TEXT[] gin) 컬럼 추가. 기존 `category` 컬럼은 보존 + DEPRECATED 주석 — Phase 2 폐기. WordVault hub/library 가 풍부한 566-노드 트리로 필터링 가능. 결정 근거: 정찰로 `dictionary_categories`(566) + `dictionary_word_categories`(28,124 · orphan 0) 이미 정합 확인 — 새 마스터 테이블/taxonomy 컬럼 추가 X. migration `20260518130000_shared_word_sets_category_bridge.sql` 적용 후 관리자가 1 row('필수2000') 수동 매핑) · v06.24 (영단어 마스터 사전 한국어 뜻 100% 완성 — `shared_dictionary` 21,740/21,740 모든 단어 `meaning_ko` 채움, 37 batch 세션 누적, A1~C2 + NONE 모든 레벨 100% / 한국 사자성어·속담 직매핑 ~30건 + 지역 분기 명시 ~80건 + 사용 주의 어휘 ~50건 + 상표명 ™ ~30건 / `scripts/dict-fetch-batch · dict-update-batch · dict-status · dict-common` 멱등 인프라 / 캐시 히트 시 AI 호출 비용 80~95% 절감 / 미완: `dictionary_categories.name_ko` 0/566 + `verified` false) · v06.23 (영단어 마스터 사전 시스템 신설 — `shared_dictionary` 21,740 + `dictionary_categories` 566 + `dictionary_word_categories` 28,124 매핑) · v06.22 (WordVault Browse 풀스크린 분리 (`/wordvault/browse`) + ScriptsChipNav · ListenPanel 설정 항상 노출 / SessionFrame ResourceContext (좌측 상단 리소스 브레드크럼) — 7개 풀팝업 라우트 모두 적용 / Dictation Setup CEFR 수동 선택 제거 + 'difficulty-first' 옵션 제거 / Dashboard WeeklyHeatmap 28일 sparkline 재설계 (300px → 120px) / WordRow v4 — 16px 컴팩트 + 예문 우측 정렬 + 펼침 메커니즘 완전 제거 + 메타 라인 삭제 / HideToggleBar "전체 예문 펼치기" 버튼 제거 / (app)/layout.tsx 신규 — WordBlitz/PirateQuest 도 SessionFrame 적용) · v06.21 (PairFlip 모듈 신규 + 디자인 리뉴얼 / Sidebar v06.16 5그룹 config 분리 / Library 라우트 분리 (`/scripts` · `/vocab`) / 풀스크린 세션 정책 + SessionFrame 셸 / WordVault hub v6 hybrid (BookShelfSection · LearningDimensionSection · WordPeekStrip 추가) / Dashboard RecentActivity 컴팩트 칩 행 재설계) · v06.19 (WordVault 허브 v5 — 자산 차원별 관리 / **v06.18 의 SpotlightWord·RecentlyAdded·AssetActions 삭제** (자산 관리 본질 외 — 학습 ritual / browse view 기능 중복) / **신규 2 컴포넌트** (CEFRDistribution = 레벨 facet 6 막대 + 클릭 시 browse 레벨 필터 진입 / FindAndMore = 인라인 검색 진입 + 보조 작업 링크 + 일괄 작업 Phase 2 disabled) / **CEFR 분포 6색 토큰 신규** (--cefr-a1~c2 + 다크모드 변형 — 기존 --cefr-A1-bg badge 토큰과 분리, 분포 시각화 전용) / **5 Tier IA**: Hero+VaultBar / AssetCollectionsRow / CEFRDistribution / FindAndMore / MemoryDecayDistribution+TrendIndicator / **Hub vs Browse 책임 분리** 명시 — hub=facet 진입점, browse=실제 작업(검색·정렬·필터·목록·일괄·듣기), 중복 금지 / mock-data 보강 (tallyCEFR 헬퍼 + 단어 5개 추가 = 13개 mock 으로 6단계 모두 검증 가능) / 5관점 (뇌과학 — Tversky categorization·Recognition>Recall·spatial memory / 심리 — SDT 자율성·Choice Architecture·Miller 7±2 / 효율 — DRY·One Job per Component / 접근성 — categorical color text labels·keyboard Enter/Esc / 실용 — Cold/Warm/Hot 적응)) · v06.18 (WordVault 허브 v4 — "내 어휘 자산" 정체성 강화 / 신규 컴포넌트 3종 (VaultBar · TrendIndicator · AssetCollectionsRow) / Hero stats 변경 (위급/안정/전체 → 총/컬렉션/누적일수 — Endowment Effect Volume·Provenance·Longevity 3축) / VaultBar = Hero 내부 슬림 8px 4색 누적 막대 (자산 규모 0클릭 인지) / AssetCollectionsRow = CollectionsCarousel 대체 (type 배지 3종: 스크립트/내가만든/추천 + 4색 mini distribution bar) / TrendIndicator = MemoryDecayDistribution 헤더 우측 (week-over-week 추세, Calm UI: risk 증가는 주황 — 빨강 X) / ModuleHero `bottomSlot` prop 신규 (note 아래·stats 위 자유 슬롯) / MemoryDecayDistribution `trend` prop 옵션 / mock-data MOCK_ACCUMULATED_DAYS=31 · MOCK_TREND · MOCK_ASSET_COLLECTIONS / v06.17 Asset Management boundary 유지 (TodayRiskStrip·ModeEntryGrid 복원 X — 학습은 Flashcard 위임)) · v06.17 (WordVault 허브 v3 — Asset Management 정체성 재정의 / 사용자 지적: "단어장 hub 는 내 단어(자산)을 관리하는 화면으로 구성되어야 — WordVault·SRS·Flashcard 관계 개념 정합?" / **개념 boundary 명시**: WordVault=자산(Asset) / SRS=엔진(invisible) / Flashcard=학습 세션(Module) / **v2 → v3 변경**: TodayWordsList(학습 큐)·ModeEntryGrid(학습 모드 진입) **제거** — Flashcard 영역 침범 해소 / **신규 2개**: RecentlyAdded(자산 성장 surface — new 단어 우선) · AssetActions(검색/전체듣기/학습 위임 3 카드) / **6 Tier IA (asset-first)**: Hero → CollectionsCarousel(PRIMARY) → RecentlyAdded → SpotlightWord → AssetActions → MemoryDecayDistribution(+ Flashcard 게이트웨이 footer 링크) / 학습은 명시적으로 외부 모듈 위임 — "Flashcard 에서 학습할 수 있어요" 작은 footer link / Hero stats 변경 (전체 emphasis · 안정 · 신규)) · v06.16 (WordVault 허브 v2 — SpotlightWord · TodayWordsList · CollectionsCarousel 신규) · v06.15 (용어 통일 — "**원문**" → "**스크립트**" 전수 변경) · v06.14 (§17.10 IA — **FlowNav v2** 재설계 — (1) 5단계 → **6단계** 확장 (라이브러리 L0 Discover 분리 — Library vs Text 시각 구분) / (2) **진척도 ring** 신규 / (3) **세션 라우팅** 전환) · v06.13 (§17.1 v3.2 — Dictation L6 Complete · ScriptQuiz L5 Conquer · §17.10 IA 원칙 신규) · v06.12 (Hub Hero 슬림화 + 모듈별 커스터마이징 — ModuleHero 시각 무게 35% 감량) · v06.11 (§17.1 L3 Encode 허브 — `/wordvault` 허브) · v06.10 (§17.1 L1 Acquire 라우트 분리 — `/text` 허브 신규) · v06.9 (§17 학습 모델 v3.0) · v06.8 (§17 학습 모델 v2.0 신설) · v06.7 (§16 Dictation 모듈) · v06.6 (§"디자인 철학·학습 과학 원칙")

---

## 📋 Quizlet Parts Kit v06 원본 분석 결과

### 원본 디자인 노트
- 폰트: Hurme Geometric Sans No.3 (로고), No.2 (UI) — 유료 전용
- teal: 인터랙티브 / yellow: 호버·프레스 / coral: 에러 / green: 정답
- gray30: 기본 텍스트 / gray70: 비활성화

### 원본 컴포넌트 (10개 카테고리)
1. Typography (Desktop 8단계 + Mobile 8단계 + Body 4종 + Link 3종 + Special 4종)
2. Selectors (Radio, Checkbox, Toggle, Combined Toggle, Binary Switch)
3. Buttons (Primary, Secondary, Icon, Link, Text Link, Bordered Icon, Special Char, Social)
4. Colors (Primary 3색, Secondary 4색, Grays 5+색)
5. Icons (Large 7종 + Small 7종)
6. Form Fields (5가지 상태 + Alt 테이블형 + 에러)
7. Dropdowns (단일, 정렬옵션, Popover, Popover with Divider)
8. Tool Tips (Desktop, Mobile, Macro — 4색 변형)
9. Social Buttons (Google 연동)
10. Alt Form Fields (용어-정의 테이블)

### 🔍 개선 사항 (15개 → v6에서 전부 해결)

| # | 영역 | v5 문제점 | v6 해결 |
|---|------|-----------|---------|
| 1 | 폰트 | Hurme Geometric Sans 유료 | Plus Jakarta Sans / DM Sans / Lora / JetBrains Mono |
| 2 | 다크모드 | 미지원 | data-theme="dark" 완전 대응 |
| 3 | 스페이싱 | 미정의 | 4px 기반 스케일 (--s-1 ~ --s-16) |
| 4 | 그림자 | 미정의 | 5단계 shadow (--sh-xs ~ --sh-xl) |
| 5 | 애니메이션 | 미정의 | duration + easing + 사용 규칙 |
| 6 | 반응형 | Desktop/Mobile만 | 390/768/1280px 3단계 |
| 7 | 접근성 | 미정의 | WCAG AA + 터치 타겟 44px |
| 8 | 로딩 | 미정의 | Skeleton / Spinner / Progress |
| 9 | 게임 UI | 미정의 | Flashcard / SpellForge / WordBlitz / ScriptQuiz 전용 |
| 10 | 오디오 | 미정의 | TTS 컨트롤 완전 정의 |
| 11 | 진행률 | 미정의 | 선형 / 원형 프로그레스 |
| 12 | 토스트 | 미정의 | 성공/에러/정보/경고 4종 |
| 13 | 모달 | 미정의 | 확인 / 경고 / 전체화면 |
| 14 | 네비게이션 | 미정의 | 하단 탭바 + 헤더 |
| 15 | 아이콘 | 7종 부족 | Lucide React 채택 |

---

## 🎯 프로젝트 개요

- **서비스명**: Vocaflow
- **목적**: 영어 스크립트 기반 종합 학습 플랫폼
- **기술스택**: Next.js 14 (App Router) · React Native (Expo) · Tailwind CSS · Supabase · Claude API (Anthropic) · Vercel · Railway
- **타겟**: 영어 학습자 (한국 고등학생~성인)
- **플랫폼**: 웹(데스크톱+모바일 브라우저) + iOS/Android 앱 동시 지원

### 핵심 모듈 9개

| 모듈 | 설명 | 상태 |
|------|------|------|
| **TextViewer** | 허브 (`/text`) — 내 스크립트 라이브러리 + 입력 진입점 / `/text/new` 입력 화면 / `/text/[id]` 워크스페이스 | 허브 신규 v06.10 |
| **WordVault** | 허브 (`/wordvault`) — Memory Decay 4색 분포 + 자산 차원별 관리 / **`/wordvault/browse` 풀스크린 세션** ★v06.22 (워크스페이스 접근 용이 · 스크립트 칩 nav · ListenPanel 항상 노출 · 단어 추가/학습 시작/Stats 제거) / `?view=study` 학습 / `?view=review` 복습 | 허브 신규 v06.11 (v06.20 BookShelf 추가 / v06.22 Browse 풀스크린 분리) |
| **Flashcard** | SM-2 SRS 플래시카드 · 하늘 배경 환경 · 양방향 모드 | React 구현 |
| **SpellForge** | 스펠링 타이핑 게임 · 파란 패널 테마 | React 구현 |
| **WordBlitz** | 인형뽑기 3D 받아쓰기 · GLB 집게 · 풀스크린 | 진행 중 (3D 디자인 반복) |
| **PairFlip** | 짝맞추기 카드 게임 (L4a Recognize 4번째) · Editorial 네이비/골드/크림 팔레트 · 5단계 난이도(8~20장) · 모든 레벨 2줄 고정 · O/X 코너 배지 · FSRS rating 통합 | **MVP 구현 (v06.21 신규)** |
| **ScriptQuiz** | 스크립트 독해 퀴즈 · AI 자동 생성 · 3-screen flow | React 구현 |
| **Dashboard** | 학습 통계 · KPI 4종 · 28일 sparkline (v06.22 WeeklyHeatmap 재설계) · ModuleAccuracyRing · ScoreTrend · RecentActivity 컴팩트 칩 행 (v06.21) | 설계 완료 (v06.0 신규) |
| **Dictation** | 받아쓰기 · CEFR 자동 감지 (수동 선택 X · v06.22) · TTS · 단어별 채점 · 4단계 힌트 · Setup 순서: 순차/랜덤 (difficulty-first 제거 · v06.22) | **MVP 구현 (v06.7 신규)** |

---

## 🧠 디자인 철학 · 학습 과학 원칙

> 모든 화면·컴포넌트·인터랙션은 아래 원칙을 따른다.
> 새 기능 설계 시 "어느 원칙에 기여하는가"를 먼저 답할 것.
> 디자인 토큰·타이포·컬러는 모두 이 원칙을 구현하기 위한 도구.
> **이 원칙들이 9개 학습 모듈에서 어떤 흐름·상태·추천 구조로 작동하는지는 §17 "학습 모델 v3.0"을 참조.**

### 디자인 철학 4개

| # | 원칙 | 의미 | 구현 예시 |
|---|------|------|-----------|
| 1 | **차분한 인터페이스 (Calm UI)** | 학습 중 시각·청각 자극 최소화. 광고·뱃지 알림·과한 애니메이션 금지 | 집중 모드(`useFocusMode` · 30초 무활동 자동 진입) · sidebar dim · 정답 spring 한정 |
| 2 | **점진적 공개 (Progressive Disclosure)** | 본질만 먼저 노출, 깊이는 사용자 요청 시 | 단어 hover/click → RecallCard · 인사이트 패널 토글 · ContinueCard 미리보기 line-clamp |
| 3 | **공감 피드백 (Empathetic Feedback)** | 비난·압박 대신 격려·맥락. Lora italic으로 "사람의 말투" | "20분의 깊은 시간 · 오늘 좋은 페이스예요" · "Page 3까지 왔어요. 좋은 흐름이에요" · 오답 텍스트는 "다시 만나봐요" |
| 4 | **암묵적 진행 표시 (Implicit Progress)** | 숫자 게이지보다 환경 변화로 성장 시각화 | Streak 카운터 · WeeklyHeatmap · Memory Decay 색 변화 · `progressPercent` 1.5px 얇은 바 |

### 학습 과학 원칙 7개

| # | 원칙 | 근거 | 구현 위치 |
|---|------|------|-----------|
| 1 | **능동적 회상 (Active Recall)** | Karpicke & Roediger 2008 — 인출이 재인보다 강한 기억 형성 | `RecallCard` 3단계 판정(knew/unsure/didnt) · Flashcard 양방향 · SpellForge 타이핑 · Dictation 단어별 즉각 채점 |
| 2 | **간격 반복 (Spaced Repetition)** | Ebbinghaus 망각곡선 + SM-2 알고리즘 | `lib/srs/sm2.ts` · `WordItem.nextDays` · "오늘 만나주세요" risk 단어 surface · Dictation Spaced Dictation(autoRepeat + 무음 간격) |
| 3 | **바람직한 어려움 (Desirable Difficulty)** | Bjork — 약간의 인지적 분투가 보유율 향상 | SpellForge 타이핑(보기 X) · Flashcard 답 확인 전 회상 · WordVault 영단어/뜻 숨김 토글 · Dictation random 순서 옵션 |
| 4 | **이중 부호화 (Dual Coding)** | Paivio — 언어 + 시각·청각 동시 자극은 단일 자극보다 강한 기억 | TTS + 영어 스크립트 + 한글 의미 동시 표시 · Lora(영어 serif) vs DM Sans(한글) 시각 분리 · Dictation TTS + 텍스트 입력 동시 |
| 5 | **맥락 의존 기억 (Context-Dependent)** | 단어를 학습한 맥락에서 다시 만났을 때 인출 강화 | `/text/[id]` 워크스페이스 — 단어를 스크립트 안에서 hover · 단어장은 항상 `exampleEn`과 결합 · Dictation 문장/단락/전체 단위 |
| 6 | **인지 부하 관리 (Cognitive Load)** | Sweller — 작업기억 ~4 항목 한계 | 한 번에 한 단어(Flashcard) · ModuleCard 7개 정사각 그리드 · Hero Stats 3분할 · Dictation Phonological Loop 보호(입력 시 음성 멈춤) |
| 7 | **정서적 부호화 (Emotional Encoding)** | 도파민 보상 + 자기효능감 → 해마 기억 강화 | Streak `s2` 폰트 시각 강조 · 정답 spring 애니메이션 · 친근한 격려 텍스트 · 보라/금빛 보상색 · Dictation Smart Suggestion(70~90% 우선 추천) |

### Memory Decay 색 체계 (앱 전용 토큰)

> 위치: `apps/web/src/app/globals.css` `@layer base { :root { ... } }` (앱 도메인 토큰)
> 4단계 색은 **모든 학습 모듈에서 동일** — 상태 일관성이 학습자 멘탈 모델의 핵심.

| 상태 | 토큰 | 색 | 학습자 인식 | 시각 표현 |
|------|------|-----|-------------|-----------|
| stable | `--memory-stable` | `#22C55E` | "이건 알아요" | 1px solid border-bottom |
| shaky | `--memory-shaky` | `#F59E0B` | "익숙해요 (가끔 헷갈림)" | 1.5px dashed border-bottom |
| risk | `--memory-risk` | `#EF4444` | "흐릿해요 — 즉시 복습" | 1.5px dashed + `word-pulse` 애니메이션 |
| new | `--memory-new` | `#94A3B8` | "처음 만나는 단어" | gradient 하이라이트 (배경 65~100%) |

### Flow State 보조 — `/text/[id]` 워크스페이스 핵심 설계

미하이 칙센트미하이 Flow 진입 5조건을 UX로 환기:

| Flow 조건 | 워크스페이스 구현 |
|-----------|-------------------|
| 명료한 목표 | ContextBar 상단 "Page X / Y · Chapter Z" |
| 즉각적 피드백 | 단어 hover → 250ms 후 RecallCard 등장 |
| 도전·기술 균형 | CEFR 기반 콘텐츠 추천 + 사용자 mastery 매칭 (예정) |
| 방해 최소화 | 30초 무활동 → 집중 모드 자동 진입(`useFocusMode`) · sidebar opacity 0.3 |
| 시간 감각 망각 보조 | "20분의 깊은 시간 · 오늘 좋은 페이스예요" Ambient Footer (남은 시간 X — 흐름 깨지 않음) |

### 적용 체크리스트 (새 기능 설계·리뷰 시)

PR 머지 전 자가 점검:

- [ ] **학습 과학 원칙 중 최소 1개에 명시적으로 기여**하는가? (없으면 재고)
- [ ] **Calm UI 위반** 없는가? — 색·소리·애니메이션 과잉 / 깜빡이는 알림 / 빨간 카운터 (admin 외)
- [ ] **회상 부담을 명시적으로** 만드는가? — 답 보여주기 전에 시도 기회 제공
- [ ] **실패가 비난적이지 않은가?** — "틀렸어요/오답입니다" 대신 "다시 만나봐요/곧 익숙해질 거예요"
- [ ] **진행을 환경으로** 보여주는가? — 숫자만이 아닌 색·아이콘·여백 변화
- [ ] **맥락**을 보존하는가? — 단어/표현은 스크립트이나 예문과 결합

### 안티패턴 (절대 금지)

- 정답률 빨간 글씨로 압박 ("정확도 67% 😢")
- 모달 오버레이로 학습 중단 ("3일 연속 학습이 끊겼어요!")
- "오답"을 부정적 색(빨강)으로만 표시 — 색맹 + 정서 모두 위반
- "Are you still there?" 식 inactivity 도발 알림
- 학습 흐름 중 광고·업셀 모달
- 진행률 100% 도달 시 폭죽·트로피 등 과장 보상 — 차분한 "오늘 잘 마쳤어요" 선호

---

## 🧭 학습 모델 v3.0 (Learning Pipeline) — v06.9 재설계

> 9개 핵심 모듈(TextViewer · WordVault · Flashcard · SpellForge · WordBlitz · **PairFlip** · ScriptQuiz · Dashboard · Dictation)을 **하나의 학습 흐름**으로 묶는 메타-모델.
> §"디자인 철학·학습 과학 원칙" 7원칙이 **어느 단계에서 어떻게 작동하는지** 구체화한 단일 진실 소스.
> 본 섹션은 **모델 레이어(흐름·상태·추천·기억·동기·인지·데이터 7축)**를 정의하며, 컴포넌트 레이어(§14 Hub · §16 Dictation 등)는 이 모델을 구현한다.
> 새 학습 기능은 **이 모델의 어느 계층/축에 속하는가**를 먼저 답한 뒤 설계할 것.
>
> **v3.0 핵심 변경**: L2.5 Bridge(Dictation 억지 배치) 폐지 · L4를 인지 부하 순서 4단계로 분리 · Dictation → L4c(청각 생성) 정착. 근거: 뇌과학(인지 부하 계단) · 심리학(Testing/Generation Effect) · 디자인(Progressive Disclosure).

### 7축 구조

```
[1] 흐름 축      L0 발견 → L1 획득 → L2 이해 → L3 부호화
                 → L4a 재인 → L4b 시각생성 → L4c 청각생성 → L4d 통합검증 → L5 회고
[2] 상태 축      단어(D/S/R 3변수 → 4색) + 스크립트(4단계) + 사용자(Cold/Warm/Hot)
[3] 추천 축      자율 70% / 시스템 제안 30% — SDT 자율성 보존
[4] 기억 축      FSRS 호환 — Difficulty · Stability · Retrievability
[5] 동기 축      SDT(자율성·유능감·관계성) × 사용자 단계 매트릭스
[6] 인지 축      Blocked → Hybrid → Interleaved 자동 전환 (단어 Stability 기반)
[7] 데이터 축    texts · vocabularies · learning_records · scores + user_stats(신규)
```

---

### [1] 흐름 축 — 9계층 (v3.0 재설계)

> **설계 원칙**: 인지 부하 순서 = 계층 순서. 낮은 부하(수동 이해)에서 높은 부하(통합 생성)로.
> L4가 4개 하위 계층으로 분리된 것은 각 모듈이 뇌과학적으로 다른 인지 처리 수준에 있기 때문.

| 계층 | 라우트 | 사용자 행위 | 인지 유형 | 출력 |
|------|--------|------------|----------|------|
| **L0 Discover** | `/library` | 큐레이션 카드 탐색 · 스크립트 선택 결정 | 수동 탐색 | 진입 결정 |
| **L1 Acquire** | `/text` 허브 + `/text/new` 입력 (TextViewer) | 스크립트 확정 + CEFR 자동감지 + 자기 자산 누적 관리 | 수동 획득 | `texts` 1건 |
| **L2 Comprehend** | `/text/[id]` (Workspace) | 청취 · 통독 · 단어 hover | 수동→능동 전환 | 이해도 마커 |
| **L3 Encode** | `/wordvault` 허브 + `/wordvault/browse` (풀스크린) + `?view=study\|review` | AI 단어 추출 → 단어장 확정 + Memory Decay 4색 자산 시각화 + 풀스크린 Browse 세션 (워크스페이스 접근 용이) | 능동 부호화 | `vocabularies` N건 (state=new) |
| **L4a Recognize (재인)** | `/flashcard` · `/wordblitz` | 단어 보기 → 아는지 판단 | Recognition | `learning_records` |
| **L4b Generate-Visual (시각 생성)** | `/spellforge` | 뜻 → 철자 직접 생성 (시각+운동) | Generation | `learning_records` |
| **L5 Conquer (정복 · 의미 통합)** | `/scriptquiz` | 스크립트 맥락 4지선다 — 텍스트 단위 검증 | Recognition + Transfer | `scores` + 텍스트 정복 |
| **L6 Complete (완성 · 다중 채널 재생산)** | `/dictate` | TTS 청취 → 받아쓰기 (음운+의미+문법+철자 통합) | Free Recall + Production | `learning_records` + 텍스트 완성 |
| **L7 Reflect (회고)** | `/hub` · `/dashboard` | 메타인지 + 다음 제안 수신 | 메타인지 | 다음 사이클 진입점 |

> **v3.2 핵심 변경**: Dictation 을 L4c (단어 단위 청각 생성) 에서 **L6 Complete (텍스트 단위 다중 채널 재생산)** 으로 재배치. ScriptQuiz 는 L4d 에서 **L5 Conquer (의미 통합)** 로 재배치. 근거: Dictation 은 4지선다 인식이 아닌 자유 재생산 (Free Recall + Production), 음운+의미+문법+철자를 동시 검증하는 통합 행위 — 학습의 정점 ("이 스크립트을 듣고 쓸 수 있다"). ScriptQuiz 는 텍스트 단위 의미 통합으로 Dictation 의 다중 채널 재생산보다 인지 깊이가 한 단계 얕음.

#### L4 하위 계층 상세 — 왜 분리하는가

| 계층 | 모듈 | 단서 | 응답 | 뇌과학 | 감각 채널 | 적합 단어 상태 |
|------|------|------|------|--------|----------|--------------|
| **L4a** | Flashcard | 단어 1개 (시각) | 자가 판정 | 패턴 완성 · 메타인지 | 시각 | new → shaky |
| **L4a** | WordBlitz | 4지선다 | 클릭/탭 (속도) | 자동화 형성 · 각성↑ | 시각+시간압박 | shaky → stable 가속 |
| **L4a** | **PairFlip** | **카드 한쪽 (단어 또는 뜻)** | **짝 카드 위치 식별·클릭** | **재인 + 공간 기억 (Tversky) + 매칭 인지** | **시각+공간** | **new → shaky / shaky → stable** |
| **L4b** | SpellForge | 뜻 + 첫 글자 | 타이핑 (생성) | 운동 부호화 · Generation Effect | 시각+운동 | shaky → stable 검증 |
| **L4c** | Dictation | TTS 청취 | 타이핑 (생성) | Triple Coding · Phonological Loop | 청각+운동 | shaky 견고화 |
| **L4d** | ScriptQuiz | 스크립트 맥락 전체 | 4지선다 | 의미망 + 에피소드 통합 | 시각+맥락 | stable → 텍스트 정복 |

> **PairFlip 인지 차별점** (같은 L4a 안에서):
> - Flashcard = 단어를 **알고 있는지** 시각 자가판정 (메타인지 중심)
> - WordBlitz = 보기에서 **빠르게 인식** (자동화 중심, 시간 압박)
> - **PairFlip** = 카드 위치를 **공간적으로 기억** + **시각·언어 매칭** (Working Memory + Spatial + Recognition 3중 활성화)
> - SpellForge(L4b) = 뜻 보고 **철자 생성** (생성 인출)
> 같은 L4a 안에서 PairFlip 은 Working Memory · Spatial Memory · Recognition 3중 인지 채널이 동시 활성화되어 Flashcard·WordBlitz 보다 인지 채널이 다층적.

#### L4b와 L4c — 쌍둥이 계층

SpellForge(L4b)와 Dictation(L4c)은 동일한 생성 인출이지만 감각 채널이 다름:
- **L4b SpellForge**: 시각(뜻) → 운동(타이핑) — 철자·형태 중심
- **L4c Dictation**: 청각(TTS) → 운동(타이핑) — 음운·리듬 중심

두 모듈을 모두 거친 단어는 시각·청각·운동 3채널에 기억 경로가 생겨 가장 강한 장기 기억을 형성.

#### L2.5 Bridge 폐지 이유 (v2.0 → v3.0)

v2.0에서 Dictation을 L2.5(L3 이전)에 배치한 것은 잘못된 설계:
1. **피드백 루프 부재** — WordVault(L3) 확정 전에는 어떤 단어를 틀렸는지 SRS가 기록할 수 없음
2. **인지 순서 역행** — 생성 인출(Dictation)은 재인(L4a)보다 인지 부하가 높음 — L3 이전 배치는 부하 역전
3. **자리 혼동** — Dictation은 청각 생성 모듈로 SpellForge(시각 생성)와 같은 계층이 정확함

---

### [2] 상태 축 — 3중 상태 모델

#### 단어 상태 — FSRS 3변수 (백엔드) → 4색 (UI)

| 변수 | 범위 | 의미 | UI |
|------|------|------|-----|
| **Difficulty (D)** | 1.0~10.0 | 단어 자체 난이도 (mean reversion으로 ease hell 방지) | 표시 안함 |
| **Stability (S)** | 일 단위 | 100%→90% 감쇠까지의 일수 | 표시 안함 |
| **Retrievability (R)** | 0.0~1.0 | 현재 시점 회상 확률 = `exp(ln(0.9) × t / S)` | **§"Memory Decay 색 체계" 4색으로 변환** |

**4색 매핑 규칙**:

```
신규 등록(D/S 미부여)  → new      #94A3B8 (회색)
R ≥ 0.95              → stable   #22C55E (초록)
0.70 ≤ R < 0.95       → shaky    #F59E0B (주황)
R < 0.70              → risk     #EF4444 (빨강)
```

→ 사용자에게는 **여전히 4색만** 노출 (§"Progressive Disclosure" 정합), 백엔드는 더 정확한 스케줄링.

#### 스크립트 상태 — 4단계

```
미시작 → 듣는 중(progress > 0) → 단어 추출 완료(wordvault_done) → 정복(quiz + dictation 통과)
```

#### 사용자 상태 — 3단계 (★신규 — 추천·인지 축의 분기 기준)

| 단계 | 조건 | 학습 전략 |
|------|------|----------|
| **Cold** | 등록 7일 이내 OR 단어 < 50개 | Blocked 강제 · 한 텍스트 정복 권장 |
| **Warm** | 단어 50~500개 OR Streak 7~30일 | Blocked → Interleaved 점진 전환 |
| **Hot** | 단어 500개+ OR Streak 30일+ | Full Interleaved · 다중 텍스트 병행 |

→ Hub 진입 시 `user_stats.mastery_level` 1쿼리로 분기 (성능)

---

### [3] 추천 축 — 자율 70% / 제안 30%

**자기결정성 이론(SDT) 정합** — 자율성 박탈은 동기 파괴이므로 시스템 제안은 30%로 제한.

#### 제안 위치 (정확히 3곳만)

1. **Hub Today CTA** — 1개 제안 (수락/무시 자유)
2. **FloatingSparkle** (워크스페이스) — 1개 제안 (자동 재출현 X)
3. **세션 종료 직후** "다음 추천" — 1개 제안 (Reflect 단계)

#### 자율 영역

- ModuleCard 8개 항상 동등 노출 (§14 Home Hub 정합)
- Library 카드는 큐레이션 순서만 영향, 차단 X
- Settings에서 "추천 끄기" 가능 (Hot 사용자 default)

---

### [4] 기억 축 — FSRS 호환 알고리즘

#### 핵심 수식

```
회상 확률:        R(t) = exp(ln(0.9) × t / S)
성공 후 Stability: S_new = S × (1 + α × (D-1) × ...)
실패 후 Stability: S_new = S_failed × R^β
Difficulty 회귀:   D_new = w × D_old + (1-w) × D_baseline    -- ease hell 방지
```

#### 구현

- **`ts-fsrs` npm 패키지 채택** — 직접 구현 금지 (Anki 23.10+ 검증 구현)
- 위치: `apps/web/src/lib/srs/fsrs.ts` + `lib/srs/state.ts`(R→4색 매핑) + `packages/ui-shared/src/srs/`(웹·앱 공유)
- 기존 `lib/srs/sm2.ts` 인터페이스는 wrapper로 유지 (호환성)

#### 한국 학습자 특화 초기 파라미터

| 파라미터 | FSRS 표준 | Vocaflow 초기값 | 근거 |
|---------|----------|----------------|------|
| Target Retention | 0.90 | **0.85** | 한국 학습자 평균 학습 시간 부족 — 부담 완화 |
| Initial Difficulty | 5.0 | **6.0** | 외국어 처리는 모국어보다 어려움 |
| Maximum Interval | 36500일 | **365일** | 1년 이상은 의미 없음 |
| Learning Steps | [1m, 10m] | **[1d, 3d]** | Vocaflow는 게임 세션 단위 — 분 단위 X |

→ 출시 후 review 1,000건 누적 시 `fsrs-optimizer`로 사용자별 자동 재최적화.

---

### [5] 동기 축 — SDT × 사용자 단계 매트릭스

#### 자기결정성 이론(SDT) 3요소 매핑

| SDT 요소 | Cold | Warm | Hot |
|---------|------|------|-----|
| **자율성** | "스크립트 자유 선택" 강조 · Library 큐레이션 노출 | 학습 모듈 자유 조합 | 다중 텍스트 병행 + 추천 OFF 옵션 |
| **유능감** | Streak 1일도 시각화 · Memory Decay 첫 변화 강조 | 50/100/500 단어 마일스톤 (차분히) | mastery 그래프 · 자기 통계 비교 |
| **관계성** | 격려 카피 ("좋은 시작이에요") | 학습 회고 ("3주째 함께해요") | (Phase 2) 친구 Streak 비교 옵션 |

#### 보상 장치 4종 — 작동 시점

| 장치 | Cold | Warm | Hot | 안티패턴 회피 |
|------|:---:|:---:|:---:|---------------|
| Streak 카운터 | 표시 | 강조 (`s2` 크기) | 잠금 가능 | 끊겨도 비난 X — "다시 만나봐요" |
| 색 변화 (4색) | **핵심 보상** | **핵심 보상** | **핵심 보상** | 빨강 = 압박 X (자연스러운 알림) |
| 격려 카피 | 자주 | 가끔 | 최소 | 과잉 시 진정성 손실 |
| Memory Decay 환경 | 약하게 | 표준 | 강하게 | 모달/빨간 카운터 절대 X |

> 보상은 **고정 비율(VR) 스케줄** — 매번 X, 가끔 O (도파민 시스템 정합).

---

### [6] 인지 축 — Blocked → Hybrid → Interleaved 자동 전환

#### 연구 근거

- **Hwang(2025) Language Learning**: 인터리빙만 적용 시 저성취 학습자에게 undesirable difficulty 야기. **초기 blocked → 후기 interleaved 하이브리드**가 단독 방식보다 강한 장기 보유율.
- **Brunmair 메타분석**: 인터리빙은 토픽이 유사하지만 예시가 다를 때 가장 효과적 — 어휘 학습은 토픽이 너무 달라지면 효과 역전 가능.

#### 자동 전환 규칙 (단어 Stability 기반)

```
큐 A (Stability < 1일):    BLOCKED 강제
  - 같은 단어를 한 게임에서 N회 반복
  - 한 게임 끝낸 후 다음 단어
  - Cold 사용자 default

큐 B (1일 ≤ Stability < 7일):  HYBRID
  - 같은 단어 2회 반복 후 다음 단어로
  - 한 세션에 5~10단어 mix
  - Warm 사용자 default

큐 C (Stability ≥ 7일):    INTERLEAVED
  - 매 회 다른 단어 (셔플)
  - 다른 모듈도 mix 가능 (Flashcard + WordBlitz 교차)
  - Hot 사용자 default
```

→ **인지 부하 곡선이 단어별로 다르게 작동** — 같은 사용자라도 단어마다 다른 큐 사용.

#### 모듈 ↔ 인지 깊이 매트릭스 (v3.0 — 계층별 정렬)

| 계층 | 모듈 | 단서 | 응답 | 회상 깊이 | 적합 단어 상태 |
|------|------|------|------|----------|--------------|
| L4a | Flashcard | 단어 1개 (시각) | 자가판정 (Again/Hard/Good/Easy) | 재인 + 메타인지 | new → shaky |
| L4a | WordBlitz | 4지선다 | 클릭/탭 (속도) | 재인 + 자동화 | shaky → stable 가속 |
| **L4a** | **PairFlip** | **카드 한쪽 (단어/뜻)** | **짝 카드 위치 식별·클릭** | **재인 + 공간 기억 + 매칭 인지** | **new → shaky / shaky → stable** |
| L4b | SpellForge | 뜻 + 첫 글자 | 타이핑 (시각 생성) | 시각·의미 생성 인출 | shaky → stable 검증 |
| **L5** | ScriptQuiz | 스크립트 맥락 전체 | 4지선다 | 의미 통합 (Recognition + Transfer) | 텍스트 단위 의미 검증 |
| **L6** | Dictation (문장) | TTS (청각) | 타이핑 (자유 재생산) | 음운+의미 재생산 | 텍스트 단위 견고화 |
| **L6** | Dictation (전체) | TTS + 맥락 | 타이핑 (자유 재생산) | 다중 채널 통합 (Free Recall + Production) | 텍스트 단위 완성 |

---

### [7] 데이터 축 — 스키마 (통합)

> **v06.22 통합**: 이전에 분산되어 있던 ALTER 문들은 §"🗄 Supabase DB 스키마" 통합 섹션에 모두 흡수됨.
> 본 섹션은 모델 레이어에서 데이터 축의 핵심 결정 사항만 요약 — 실제 DDL 은 §"🗄 Supabase DB 스키마" 참조.

#### 핵심 결정 사항

| 영역 | 결정 | 근거 |
|---|---|---|
| **Memory Decay 4색** | DB 컬럼 X — R(t) 동적 계산만 | 일관성 (저장 + 시간 흐름 = 데이터 stale) |
| **`vocabularies` FSRS 6 컬럼** | difficulty · stability · last_review_at · next_review_at · module_history (TEXT[]) · review_count | FSRS 호환 (Anki 23.10+ 검증) |
| **`vocabularies` UNIQUE(user_id, word)** | 같은 단어 중복 등록 방지 | Phase 2 Import 시 충돌 회피 |
| **`learning_records.rating`** | SMALLINT 1~4 | FSRS 4단계 (Again/Hard/Good/Easy) |
| **`learning_records.metadata` JSONB** | PairFlip pair_id, ScriptQuiz question_id 등 | 모듈별 부가 컨텍스트 |
| **`scores.metadata` JSONB** | 모듈별 stage·level·maxCombo 등 | 모듈별 차이 흡수 |
| **`user_stats`** 캐시 테이블 | mastery_level · total_words · current_streak · fsrs_target_retention | Hub 진입 1쿼리 분기 |
| **`module_id` ENUM** | 9 모듈 (pairflip 포함) | 정합성 + 가독성 |

#### Vocabularies → SrsCard 변환

```ts
// lib/srs/state.ts — DB row → 도메인 모델
function rowToCard(row: VocabularyRow): SrsCard {
  return {
    id: row.id,
    difficulty: row.difficulty,
    stability: row.stability,
    lastReviewAt: row.last_review_at ? new Date(row.last_review_at) : null,
    nextReviewAt: row.next_review_at ? new Date(row.next_review_at) : null,
    moduleHistory: row.module_history,
    reviewCount: row.review_count,
  }
}
```
```

---

### 사용자 여정 — 4시나리오

#### A. 신규 사용자 (Library 진입, 권장 경로)

```
Hub  →  Today CTA "첫 학습 시작하기"
  ↓
Library /library  →  CEFR A2 카테고리 → LibraryCard 선택
  ↓
Workspace /text/[id]  →  L2 통독 + 단어 hover (RecallCard 1~2회)
  ↓
FloatingSparkle "받아쓰기로 익혀볼까요?"
  ↓
Dictation /dictate (문장 단위, A2 자동감지)
  ↓
Results "AI로 단어 추출"
  ↓
WordVault /wordvault 허브  →  Memory Decay 분포 확인  →  /wordvault/browse 단어장 확정 (풀스크린 · 모두 state=new)
  ↓
Flashcard (Blocked 큐 — Cold 사용자)
  ↓
Hub 갱신 — Streak +1 · ContinueCard 등장
```

#### B. 신규 사용자 (직접 입력 진입)

```
Hub  →  ModuleCard "스크립트" 클릭
  ↓
TextViewer /text 허브  →  /text/new 입력  →  PDF 업로드
  ↓ CEFR 자동감지(B1)
Workspace L2 통독
  ↓ "AI로 단어 추출" (lib/text-viewer/handoff.ts)
WordVault
  ↓
Flashcard → Dictation → SpellForge → WordBlitz → ScriptQuiz (자율)
  ↓
Dashboard 정확도 링 갱신
```

#### C. 복귀 사용자 (Today CTA 따르기 — Warm)

```
Hub
  │ HubHero: Streak 5일 · Today CTA = risk 단어 N개
  │ ContinueCard: "Chapter 3 — 65%"
  ↓ (3가지 자율 분기)
  ├─ Today CTA → Flashcard (risk 우선 큐, Blocked 강제)
  ├─ ContinueCard → Workspace L2 이어 듣기
  └─ ModuleCard "Dictation" → 어제 단락 받아쓰기 (Hybrid 큐)
  ↓
Dashboard 갱신
```

#### D. 깊은 학습자 (Hot — 단일 스크립트 정복)

```
Workspace L2 통독
  → WordVault L3 (15단어)
  → Flashcard L4 (Interleaved · 자가판정)
  → Dictation 문장 단위 (음운 인출)
  → WordBlitz (속도 검증)
  → SpellForge (생성 인출)
  → Dictation 전체 (Dictogloss · 통합 검증)
  → ScriptQuiz (스크립트 통합 검증, 87%)
  → Dashboard "Chapter 1 — 단어 9/15 stable"
```

---

### 추천 엔진 의사코드

```typescript
// apps/web/src/lib/recommend/next-action.ts

function getNextBestAction(userId: string, userStats: UserStats): Action {
  // P1. 회상 위급 (R < 0.6) — 격려형 라벨로만 표시
  const urgentWords = await getWordsByRetrievability(userId, { lt: 0.6 });
  if (urgentWords.length >= 3) {
    return {
      module: 'flashcard',
      queue: urgentWords,
      strategy: 'blocked',
      label: `오늘 ${urgentWords.length}개를 다시 만나보세요`
    };
  }

  // P2. 진행 중 스크립트 (Context-Dependent 보존)
  const lastText = await getLastOpenedText(userId);
  if (lastText && lastText.progress_percent < 100) {
    return { module: 'workspace', textId: lastText.id, label: `${lastText.title} 이어 듣기` };
  }

  // P3. 사용자 단계별 분기
  switch (userStats.mastery_level) {
    case 'cold':
      const newWords = await getWordsByState(userId, 'new');
      if (newWords.length >= 5) return {
        module: 'flashcard', queue: newWords.slice(0, 10),
        strategy: 'blocked', label: '오늘 10개 단어를 만나볼까요?'
      };
      break;
    case 'warm':
      const noDictation = await getShakyWordsWithoutModule(userId, 'dictation');
      if (noDictation.length >= 5) return {
        module: 'dictation', unit: 'sentence', queue: noDictation,
        strategy: 'hybrid', label: '귀로 익혀볼 시간이에요'
      };
      break;
    case 'hot':
      const stableTexts = await getTextsReadyForQuiz(userId);
      if (stableTexts.length >= 1) return {
        module: 'scriptquiz', textId: stableTexts[0].id,
        strategy: 'interleaved', label: '스크립트 전체를 점검해볼까요?'
      };
      break;
  }

  // P4. Cold start
  return { module: 'library', label: '새 스크립트을 만나보세요' };
}
```

---

### 7원칙 × 9계층 적용 매트릭스 (v3.0 검증)

| 원칙 | L0 | L1 | L2 | L3 | L4a 재인 | L4b 시각생성 | L4c 청각생성 | L4d 통합 | L5 |
|---|---|---|---|---|---|---|---|---|---|
| Calm UI | 광고 X · 카드 정렬 | 입력 양식 차분 | 자동재생 X | progress 차분 | 정답 spring · 비난 X | 타이핑 완성 spring | TTS 입력 시 정지 | 3-screen 차분 | "오늘 잘 마쳤어요" |
| Progressive Disclosure | CategoryChip 토글 | 입력 단순화 | hover→RecallCard | 예문 토글 | 힌트 점진 노출 | 첫 글자 힌트 | 4단계 힌트 | 스크립트 인용 단서 | InsightPanel 토글 |
| Empathetic Feedback | "추천해드려요" | "직접 입력해 보세요" | "좋은 흐름이에요" | "12개를 만났어요" | "다시 만나봐요" | "정확해요!" | "다시 들어볼까요?" | "스크립트을 정복했어요" | "20분의 깊은 시간" |
| Implicit Progress | 본 카드 흐림 | — | progressPercent | Memory Decay 4색 | ● 회색→주황 | ● 주황→초록 | 단어별 색 갱신 | 텍스트 정복 표시 | WeeklyHeatmap |
| Active Recall | — | — | hover 능동 | **● SRS 시작** | **● 핵심** | **● 핵심** | **● 핵심** | **● 핵심** | — |
| Spaced Repetition | — | — | — | nextReviewAt 부여 | risk 큐 surface | shaky→stable 계산 | autoRepeat+무음 | 텍스트 단위 | Memory Decay 색 |
| Desirable Difficulty | CEFR 매칭 | — | Step 분절 | 뜻 숨김 토글 | 속도 압박(WordBlitz) | 보기 없이 생성 | random 순서 | 스크립트 맥락 압박 | — |
| Dual Coding | — | — | TTS + Lora 시각 | 영-한 폰트 분리 | 시각 단일 | 시각+운동 | **청각+운동** | 시각+맥락 | — |
| Context-Dependent | 카테고리 맥락 | 스크립트이 앵커 | 스크립트 안 의미 | exampleEn 강제 | 단어 단독 | 뜻→철자 맥락 | 문장/단락/전체 | ScriptQuiz 인용 | — |
| Cognitive Load | 카드 수 제한 | 옵션 3개만 | Step 분절 | 한 번에 N=10 | 한 번에 1단어 | 첫 글자 완충 | **음운 루프 보호** | 4지선다 단순화 | StatCard 3분할 |
| Emotional Encoding | CEFR 배지 | — | — | "12개 발견" 보상색 | spring 애니 | 완성 순간 피드백 | Smart 70~90% 우선 | 정복 배지 | Streak 강조 |

> 빈 칸은 의도 — 모든 원칙이 모든 계층에 작용하지 않음.

---

### 미정 항목 (코드로 측정·조정 필요)

| 항목 | 현재 추정값 | 해결 시점 |
|------|----------|----------|
| FSRS 한국 학습자 파라미터 | Target=0.85, D=6.0 | review 1,000건 누적 시 `fsrs-optimizer` |
| Cold/Warm/Hot 임계값 | 단어 50/500개 | A/B 테스트 |
| Blocked → Interleaved 전환 시점 | Stability 1일/7일 | 사용자 retention 데이터 |
| 다중 텍스트 병행 우선순위 | last_opened DESC | 사용 데이터 검증 |
| 모바일 5분 짧은 세션 축약형 | 미정 | Phase 2 |
| L4b(SpellForge) vs L4c(Dictation) 추천 우선순위 | shaky 단어 상태 기반 | 사용 데이터 검증 |

---

### 모델 적용 체크리스트 (PR 자가 점검)

- [ ] 새 화면/기능이 **9계층(L0~L4d~L5) 중 어디**에 속하는가?
- [ ] L4 계층이라면 **L4a/b/c/d 중 어느 인지 유형**인가? (재인/시각생성/청각생성/통합)
- [ ] **사용자 단계(Cold/Warm/Hot)별로 다르게** 동작하는가?
- [ ] 추천이 **자율 70%** 한도를 지키는가? (제안 위치 3곳 외 추가 X)
- [ ] 단어 상태는 **R(t) 동적 계산** 결과를 사용하는가? (저장된 state 직접 사용 X)
- [ ] Blocked/Hybrid/Interleaved 큐가 **단어 Stability**에 따라 자동 분기되는가?
- [ ] FSRS 파라미터 변경 시 `user_stats.fsrs_target_retention` 업데이트하는가?

### 안티패턴 (모델 위반 — 절대 금지)

- 추천을 4곳 이상에 노출 — SDT 자율성 박탈
- FSRS 변수(D/S/R)를 사용자에게 직접 노출 — Progressive Disclosure 위반
- Cold 사용자에게 Interleaved 강제 — undesirable difficulty (Hwang 2025)
- `state` 컬럼을 DB에 저장하고 직접 사용 — Memory Decay 색 일관성 깨짐 (반드시 R(t)로 동적 계산)
- 추천 라벨에 정확도/실패 카운트 노출 — Empathetic Feedback 위반

---

### §17.10 학습 흐름 IA 원칙 (v06.13 신규)

> **모델 흐름은 UI에 직접 보여야 한다. 단, 강제하지 않는다.**

#### 3가지 노출 위치

1. **Sidebar 5그룹 + META + FOOTER** (v06.16 — `components/layout/sidebar-config.ts` 단일 출처)
   - 5그룹: 스크립트 / 단어 / 익히기 / 정복 / 완성
   - 그룹 라벨이 §17.1 흐름 축과 1:1 매핑
   - 그룹 색상도 FlowNav 단계 accent 와 동일 (보라 #8B5CF6 / 인디고 #6366F1 / 핑크 #EC4899 / 앰버 #F59E0B / 시안 #06B6D4)
   - 익히기 그룹 4 항목 (인지 깊이 정렬): **Flashcard → WordBlitz → PairFlip → SpellForge** (L4a 시각재인 → L4a 자동 → L4a 공간기억+매칭 → L4b 시각생성)
   - **META** (상단): Hub · Dashboard
   - **FOOTER** (하단): Settings
   - 햄버거 토글로 240px ↔ 72px 축소·확대, localStorage 유지 (`vocaflow-sidebar-collapsed`)
   - **풀스크린 라우트 자동 숨김** — `lib/layout/full-screen-routes.ts` `isFullScreenRoute()` 공유 로직 (FlowNav 와 동일)
   - 워크스페이스 `/text/[id]` Focus Mode 시 `body.focus-mode .sidebar` CSS 룰로 opacity 0.3 dim (hover 시 1)

2. **FlowNav (전역)** — 모든 페이지 상단 흐름 표시기 (v2 · v06.14)
   - **6단계 가로** (라이브러리 → 스크립트 → 단어 → 익히기 → 정복 → 완성)
     - L0 Discover (라이브러리, Compass 아이콘) 와 L1+L2 Acquire/Comprehend (스크립트, BookOpen) **시각 구분**
     - "라이브러리에서 왔는지 스크립트에서 왔는지" 사용자 인지 정합
   - **진척도 SVG ring** — 각 단계 익힘% 원형 게이지 (Implicit Progress)
     - 배경 ring (var(--bd) 0.55 op) + 진척 arc (stage accent)
     - strokeDasharray + strokeDashoffset + 0.6s ease-out 애니메이션
     - aria-label 에 "${label} — ${subtitle} · ${progress}% 익힘"
   - **세션 라우팅** — 클릭 시 허브 X, 활동 진입점 직행
     - 라이브러리 → `/library` (entry point)
     - 스크립트 → `/text/[id]` (most-recent in-progress workspace)
     - 단어 → `/wordvault?view=study` (StudyMode)
     - 익히기 → `/flashcard/play`
     - 정복 → `/scriptquiz/play`
     - 완성 → `/dictate/setup` (config 단계, session 진입)
   - 현재 위치 시각 강조 (dot 배경 accent + scale-110 + ring opacity 1)
   - 자유 양방향 클릭 이동, sticky top, 점선 connector
   - 데스크톱: 라벨 + 진척% (없으면 부제) / 모바일: 아이콘 + ring + 활성 라벨 (44×44 Fitts)

3. **각 화면 다음 액션 가이드** — 허브 + 게임 결과 NextActionCard
   - 흐름 순 우선 추천 (cold → 익히기 시작 / warm → 익히기 다지기 / hot → 정복 도전)
   - SDT 자율성 보존 (제안 X 강제, 자유 무시 가능)

#### 풀스크린(세션) 라우트 정책 — Sidebar/FlowNav 자동 숨김

`apps/web/src/lib/layout/full-screen-routes.ts` 의 `isFullScreenRoute(pathname)` 단일 출처 — FlowNav · Sidebar 둘 다 공유:

| 페이지 유형 | URL 예시 | Sidebar | FlowNav | SessionFrame |
|-----------|---------|:------:|:------:|:--------:|
| 허브 | `/text`, `/wordvault`, `/flashcard` 등 | ✅ | ✅ + 단계 활성 | ❌ |
| 워크스페이스 | `/text/[id]` | ✅ (Focus Mode 시 dim 0.3) | ✅ + "스크립트" 활성 | ❌ |
| 결과 | `/dictate/results`, `/pairflip/results` | ✅ | ✅ | ❌ |
| 메타 | `/hub`, `/dashboard`, `/settings` | ✅ | ✅ + 모두 비활성 (opacity-60) | ❌ |
| **게임 play** | `*/play` (Flashcard·SpellForge·ScriptQuiz·PairFlip) | ❌ 자동 숨김 | ❌ 자동 숨김 | ✅ 자동 주입 |
| **Dictation 세션** | `/dictate/session` | ❌ 자동 숨김 | ❌ 자동 숨김 | ✅ 자동 주입 |
| **WordVault Browse** ★v06.22 | `/wordvault/browse` (워크스페이스 접근 용이성) | ❌ 자동 숨김 | ❌ 자동 숨김 | ✅ 자동 주입 |
| **(app) 풀스크린** | `/play/wordblitz`, `/play/pirate-quest` | ❌ (별도 layout) | ❌ (별도 layout) | ✅ `(app)/layout.tsx` 주입 ★v06.21 |

> **자동 숨김 근거**: 세션 중에는 working memory 전체를 학습에 할당해야 함 (Sweller). 메타 네비게이션 동시 노출은 인지 부하 누수.

#### SessionFrame 셸 (v06.21~v06.22) — `components/layout/SessionFrame.tsx`

풀스크린 세션 진입 시 `(main)/layout.tsx` 또는 `(app)/layout.tsx` 가 children 을 자동 감싸 상단 슬림 헤더 주입. 세션 페이지 코드 변경 0.

**2-row stack 구조** (v06.22):
```
┌──────────────────────────────────────────────────────────┐
│ 🎯 플래시카드          [3 / 12]    [단계 ▾] [✕]        │  ← Top: 모듈 정체성
│ 📖 내 스크립트 › The Great Gatsby › Chapter 3            │  ← Sub: 리소스 브레드크럼
└──────────────────────────────────────────────────────────┘
```

| 영역 | 내용 |
|---|---|
| **Top 좌측** | 세션 이모지 + 모듈명 + (데스크톱) 진행도 칩 |
| **Top 우측** | 단계 이동 콤보 (6 모듈 직행 — Flashcard·WordBlitz·PairFlip·SpellForge·ScriptQuiz·Dictation) + 닫기 X (모듈 hub 복귀, **Esc** 단축키) |
| **Sub row** (선택) | 리소스 브레드크럼: `[type icon] [TYPE LABEL] › [자료명] › [위치]` — `resource` 주입 시에만 렌더 |

**리소스 컨텍스트** (v06.22 — 좌측 상단 리소스 위치 인식):

```ts
useSessionProgress().setProgress({
  current: 3, total: 12,
  resource: {
    type: 'library' | 'vocab' | 'script' | 'custom',
    label: 'The Great Gatsby',
    position: 'Chapter 3',
    href?: '/text',  // 선택 — 클릭 시 hub 진입
  },
})
```

타입별 시각: library (Compass · 보라 #8B5CF6) / vocab (Layers · 인디고 #6366F1) / script (BookOpen · 보라 #8B5CF6) / custom (Sparkles · 앰버 #F59E0B). Sidebar 그룹 accent 와 정합.

**적용 패턴**:
1. **Server Component 페이지** (Flashcard/SpellForge/ScriptQuiz/WordBlitz/Pirate): `<ResourceContext resource={...} />` 정적 주입
2. **Client 세션 컴포넌트** (Dictation/PairFlip/WordVaultBrowse): `useSessionProgress()` 훅 직접 호출 — 동적 진행도 실시간 업데이트

**라우트별 닫기 매핑**:
- `/flashcard/play` → `/flashcard`
- `/spellforge/play` → `/spellforge`
- `/scriptquiz/play` → `/scriptquiz`
- `/pairflip/play` → `/pairflip`
- `/dictate/session` → `/dictate`
- `/play/wordblitz` → `/wordblitz`
- `/play/pirate-quest` → `/hub`
- `/wordvault/browse` → `/wordvault` ★v06.22

#### Linear vs Cyclical 균형

- 5단계 = 권장 흐름이지만 학습은 사이클 (Bjork Interleaving)
- 화살표 X, 점선 ┄┄ 사용 — 권장이지 강제 아님
- 양방향 자유 이동 (완성 → 스크립트 회귀 정상)
- 게임 중 자동 숨김 = 집중 흐름 보호

#### Sidebar vs FlowNav 역할 분리

| | Sidebar | FlowNav |
|---|---------|---------|
| 단위 | 모듈 (9개) + META(2) + FOOTER(1) | 단계 (6개 — 라이브러리 분리 반영) |
| 정보량 | 자세 (라벨 + 아이콘 박스) | 추상 (작은 dot + ring + 라벨) |
| 클릭 | 정확한 모듈 직접 진입 | 단계 default 활동 (세션 직행) |
| 현재 표시 | 활성 모듈 배경 + 좌측 인디케이터 | 활성 단계 dot 배경 색 + scale-110 |
| 표시 정책 | 풀스크린 라우트 시 자동 숨김 (md:flex) | 풀스크린 라우트 시 자동 숨김 |
| 5색 accent | 그룹 라벨 dot | 단계 활성 dot + ring |
| 축소·확대 | 햄버거 토글 240px ↔ 72px (localStorage) | — |
| 공통 출처 | `sidebar-config.ts` | `FlowNav.tsx` 자체 STAGES |
| 풀스크린 판정 | `lib/layout/full-screen-routes.ts` 공유 | 동일 |

#### Library 라우트 분리 (v06.16 신규) — `/library/scripts` + `/library/vocab`

L0 Discover 가 두 갈래로 분기:

| 경로 | 내용 | 진입 |
|---|---|---|
| `/library` | redirect | → `/library/scripts` 자동 |
| `/library/scripts` | 공용 스크립트 라이브러리 (이전 `/library` 콘텐츠) | 큐레이션 카드 + 카테고리 + 전체 그리드 |
| `/library/vocab` | 공용 단어장 (수능·고등·중등·TOEIC·공무원·비즈니스 등) | ModuleHero + 8 카테고리 칩 + 세트 그리드 |

- `(main)/library/layout.tsx` 가 `<LibraryTabs>` 헤더 + max-w-6xl 컨테이너 공유
- `<LibraryTabs>` 2탭 (스크립트 / 단어장), `usePathname.startsWith` 활성 표현, 보라(#8B5CF6) 액센트
- 8 카테고리 (`components/library/vocab/categories.ts`): elementary · middle · high · csat · eng_test · civil · business · themed
- 카테고리는 사이드바에 직접 노출 X — 페이지 내부 가로 스크롤 칩으로만 (Calm UI 정합)

#### Dictation = L6 완성 (마지막) 결정 근거

```
재생산 > 인식
  - Dictation: 자유 재생산 (Free Recall + Production)
  - ScriptQuiz: 4지선다 (Recognition + Transfer)
  - 인지 깊이: Free Recall > Recognition

다중 채널 통합
  - 음운 (TTS 청취) + 시각 (텍스트 입력) + 의미 (이해) + 문법 (어순) + 철자 (정확)
  - 동시 검증 — 학습의 정점

사용자 멘탈 모델
  - "이 스크립트을 듣고 쓸 수 있다" = 영어 학습의 자연스러운 정점
  - §17.2 [2] 스크립트 4단계와 정합: 미시작 → 듣는 중 → 단어 추출 → 정복 → 완성

추천 엔진 정합
  - mock 추천에서 dictation 자연 추천 제외 — 사용자 명시 의지 발현 시점
  - cold/warm/hot 모두 익히기 또는 정복으로 진행 권장
```

---

## 🔤 Typography

### 폰트 체계 (Quizlet Hurme Geometric Sans 대안)

```
Display / UI  : 'Plus Jakarta Sans'  — Geometric Sans, 무료 Google Fonts
Body          : 'DM Sans'            — 깔끔한 산세리프, 무료
영어 스크립트     : 'Lora'               — 가독성 우수 세리프, 영어 스크립트 전용
코드 / 게임   : 'JetBrains Mono'     — SpellForge 스펠링 셀 전용
```

**⚠ 절대 사용 금지: Inter · Roboto · Arial**

### Google Fonts Import

```html
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
```

### Tailwind Config

```js
// tailwind.config.js
fontFamily: {
  display: ['"Plus Jakarta Sans"', 'sans-serif'],
  body:    ['"DM Sans"', 'sans-serif'],
  english: ['"Lora"', 'serif'],
  mono:    ['"JetBrains Mono"', 'monospace'],
}
```

### 타이포 스케일

```
Desktop (1280px+)                     Mobile (390px)
──────────────────────────────────    ──────────────────────────────
h1-lg:  36px / 700 / 1.18 / -0.022em  h1-lg:  28px / 700 / 1.2
h1-md:  30px / 700 / 1.20 / -0.016em  h1-md:  24px / 700 / 1.25
h1-sm:  26px / 700 / 1.28 / -0.010em  h1-sm:  22px / 700 / 1.3
h2:     22px / 600 / 1.32             h2:     20px / 600 / 1.3
h3:     18px / 600 / 1.40             h3:     17px / 600 / 1.4
h4:     16px / 600 / 1.40             h4:     15px / 600 / 1.4
h5:     14px / 700 / 1.40 / UPPER     h5:     13px / 700 / UPPER
h6:     12px / 700 / 1.50 / UPPER     h6:     11px / 700 / UPPER
```

### Body (DM Sans)

```
body-1:          16px / 400 / 1.6           — 기본 본문
body-1-semi:     16px / 600 / 1.6           — 강조 본문
body-2:          14px / 400 / 1.5           — 보조 본문
body-3:          13px / 400 / 1.5           — 캡션
body-3-oblique:  13px / 400 / italic        — 이탤릭 캡션
body-3-spaced:   13px / 400 / tracking 0.05em
body-4:          12px / 400 / 1.5           — 최소 텍스트
```

### 영어 스크립트 전용 (Lora Serif)

```
english-body:      20px / 400 / 1.8    — 스크립트 읽기 영역
english-highlight: 20px / 400 / 1.8 / bg: --p-light  — 재생 중 하이라이트
english-word:      18px / 600          — 단어 강조
```

### Special (s1~s4)

```
s1:  14px / 700 / UPPERCASE / tracking 0.10em  — 섹션 레이블
s2:  40px / 800 / 1.1                          — 히어로/점수 대형 표시
s3:  16px / 400                                — 일반 특수
s4:  14px / 400                                — 소형 특수
```

---

## 🎨 Colors — CSS Variables (단일 체계)

> **v6 확정: 축약형 변수를 공식 SSoT로 채택.**  
> Parts Kit v05 HTML에서 사용 중인 `--p`, `--bg`, `--t1` 체계를 전체 통일.  
> 기존 `--color-primary` 계열은 폐기 — 축약형만 사용.

```css
/* ─────────────────────────────────────────────
   globals.css — CSS Variables (SSoT)
───────────────────────────────────────────── */
:root {
  /* Brand */
  --p:       #3B82F6;   /* primary — 메인 인터랙티브 */
  --p-hover: #2563EB;   /* primary hover */
  --p-light: #EFF6FF;   /* primary 배경 틴트 */
  --p-dark:  #1D4ED8;   /* primary 강조 */

  /* Active (yellow — Quizlet yellow 역할) */
  --active:       #F59E0B;
  --active-light: #FEF3C7;

  /* Semantic */
  --success:       #22C55E;
  --success-light: #DCFCE7;
  --error:         #EF4444;
  --error-light:   #FEE2E2;
  --warning:       #F59E0B;
  --warning-light: #FEF3C7;
  --info:          #06B6D4;
  --info-light:    #CFFAFE;

  /* Surface */
  --bg:  #FFFFFF;   /* 기본 배경 */
  --bg2: #F8FAFC;   /* 카드/섹션 배경 */
  --bg3: #F1F5F9;   /* 입력 필드 배경 */

  /* Text */
  --t1: #0F172A;   /* 기본 텍스트 */
  --t2: #475569;   /* 보조 텍스트 */
  --t3: #94A3B8;   /* 비활성 텍스트 */
  --t4: #CBD5E1;   /* 완전 비활성 */
  --ti: #FFFFFF;   /* 반전 (어두운 배경 위) */

  /* Border */
  --bd:  #E2E8F0;   /* 기본 테두리 */
  --bdf: #3B82F6;   /* 포커스 테두리 */
  --bde: #EF4444;   /* 에러 테두리 */

  /* Game Specific — 게임 전용, 변경 금지 */
  --gold:   #EAB308;
  --silver: #94A3B8;
  --bronze: #D97706;
  --combo:  #8B5CF6;
  --streak: #EC4899;

  /* Shadow */
  --sh-xs: 0 1px 2px rgba(0,0,0,.05);
  --sh-sm: 0 1px 3px rgba(0,0,0,.10), 0 1px 2px rgba(0,0,0,.06);
  --sh-md: 0 4px 6px rgba(0,0,0,.07), 0 2px 4px rgba(0,0,0,.06);
  --sh-lg: 0 10px 15px rgba(0,0,0,.10), 0 4px 6px rgba(0,0,0,.05);
  --sh-xl: 0 20px 25px rgba(0,0,0,.10), 0 10px 10px rgba(0,0,0,.04);

  /* Radius */
  --r-sm:   6px;
  --r-md:   8px;
  --r-lg:   12px;
  --r-xl:   16px;
  --r-2xl:  24px;
  --r-full: 9999px;

  /* Motion */
  --dur-fast:   100ms;
  --dur-normal: 200ms;
  --dur-slow:   300ms;
  --dur-slower: 500ms;
  --ease:        cubic-bezier(.4, 0, .2, 1);
  --ease-in:     cubic-bezier(.4, 0, 1, 1);
  --ease-out:    cubic-bezier(0, 0, .2, 1);
  --ease-spring: cubic-bezier(.34, 1.56, .64, 1);
}

/* Dark Mode */
[data-theme="dark"] {
  --p:       #60A5FA;
  --p-hover: #93C5FD;
  --p-light: #1E3A5F;
  --p-dark:  #3B82F6;

  --active-light: #451A03;
  --success:       #4ADE80;
  --success-light: #052E16;
  --error:         #F87171;
  --error-light:   #3B0A0A;
  --info-light:    #083344;
  --warning-light: #3B2000;

  --bg:  #0B1120;
  --bg2: #141E30;
  --bg3: #1E2D42;

  --t1: #F1F5F9;
  --t2: #CBD5E1;
  --t3: #64748B;
  --t4: #334155;

  --bd:  #1E2D42;
  --bdf: #60A5FA;
}
```

### 게임 전용 하드코딩 색상 예외

> 아래 색상만 CSS 변수 대신 하드코딩 허용 — **반드시 주석 명시**

```css
/* ── WordBlitz 정글 전용 — 변경 금지 ── */
#FFE234  /* 황금 점수 텍스트 */
#3d8a3d  /* 정글 배경 기본 그린 */

/* ── Flashcard 카드 gradient — 변경 금지 ── */
/* 앞면: #FFFDE7 → #FFF9C4 → #FFF59D */
/* 뒷면: #E8F5E9 → #C8E6C9 → #A5D6A7 */

/* ── SpellForge 파란 패널 — 변경 금지 ── */
#4A9FCF  /* 패널 메인 컬러 */
#3A7FAF  /* 패널 다크 */
```

---

## 📐 Spacing — 4px 기반 스케일

```
--s-0:   0px
--s-1:   4px    (Tailwind: p-1)   — 아이콘 내부 패딩
--s-2:   8px    (p-2)             — 버튼 내부 최소
--s-3:   12px   (p-3)             — 작은 컴포넌트
--s-4:   16px   (p-4)             — 기본 패딩 ★
--s-5:   20px   (p-5)
--s-6:   24px   (p-6)             — 카드 내부 패딩 ★
--s-8:   32px   (p-8)             — 섹션 간격
--s-10:  40px   (p-10)
--s-12:  48px   (p-12)            — 페이지 상하 패딩
--s-16:  64px   (p-16)            — 히어로 섹션
```

---

## 🌑 Elevation / Shadow

```css
/* 사용 규칙 */
카드 기본:   --sh-sm
카드 호버:   --sh-md
드롭다운:    --sh-lg
모달:        --sh-xl
툴팁:        --sh-md
```

---

## 🔲 Border Radius

```
--r-sm:   6px    — 입력 필드, 작은 버튼, 태그
--r-md:   8px    — 버튼, 배지, 셀렉트
--r-lg:   12px   — 카드, 드롭다운
--r-xl:   16px   — 모달, 큰 카드, 바텀시트
--r-2xl:  24px   — 플래시카드, 팝업
--r-full: 9999px — 아이콘 버튼, 뱃지, 아바타, 진행바
```

---

## 🎬 Motion / Animation

```css
/* Duration */
--dur-fast:   100ms   /* 토글, 체크박스 */
--dur-normal: 200ms   /* 버튼 호버, 색상 변화 */
--dur-slow:   300ms   /* 카드 뒤집기, 페이드 인 */
--dur-slower: 500ms   /* 페이지 전환, 모달 */

/* Easing */
--ease:        cubic-bezier(.4, 0, .2, 1)     /* 일반 전환 */
--ease-in:     cubic-bezier(.4, 0, 1, 1)      /* 퇴장 */
--ease-out:    cubic-bezier(0, 0, .2, 1)      /* 등장 */
--ease-spring: cubic-bezier(.34, 1.56, .64, 1) /* 바운스 (정답 피드백) */

/* 사용 매핑 */
버튼 호버:      transition: all var(--dur-normal) var(--ease)
카드 뒤집기:    rotateY(180deg), 0.55s var(--ease)
정답 피드백:    scale(1.05)→scale(1), --dur-slow, --ease-spring
오답 피드백:    translateX shake 3회, --dur-slow
페이지 전환:    opacity 0→1 + translateY 20→0, stagger 50ms
진행률 바:      width 전환, --dur-slow, --ease-out
점수 카운트업:  0→실제값, 1s, --ease-out
```

---

## 📱 Breakpoints — v6 확정 기준

> **SSoT 기준: 390 / 768 / 1280px** (v5의 640/1024px → 폐기)

```
mobile:   390px    — 1열 레이아웃, 앱 셸 max-width: 480px
tablet:   768px    — 2열 가능
desktop:  1280px   — 최대 너비 제한

최대 콘텐츠 너비: max-w-2xl (672px) — 학습 콘텐츠
최대 페이지 너비: max-w-6xl (1152px) — 대시보드
```

### Tailwind Config

```js
// tailwind.config.js
screens: {
  'sm':  '390px',
  'md':  '768px',
  'lg':  '1280px',
}
```

---

## 🔘 Buttons

### 8종 체계 (웹 — JSX/Tailwind)

```jsx
// src/components/ui/Button.jsx

/* ── Primary ── */
"bg-[var(--p)] text-[var(--ti)]
 px-6 py-3 rounded-[var(--r-md)] font-display font-[600]
 hover:bg-[var(--p-hover)] active:scale-[0.97]
 transition-all duration-[var(--dur-normal)]
 disabled:opacity-50 disabled:cursor-not-allowed"

/* ── Secondary ── */
"border-2 border-[var(--p)] text-[var(--p)] bg-transparent
 px-6 py-3 rounded-[var(--r-md)] font-display font-[600]
 hover:bg-[var(--p-light)] active:scale-[0.97]"

/* ── Danger ── */
"bg-[var(--error)] text-[var(--ti)]
 px-6 py-3 rounded-[var(--r-md)] font-[600]
 hover:opacity-90"

/* ── Ghost ── */
"bg-[var(--bg3)] text-[var(--t1)]
 px-6 py-3 rounded-[var(--r-md)] font-[600]
 hover:bg-[var(--bd)]"

/* ── Icon Button ── */
"w-10 h-10 rounded-full flex items-center justify-center
 bg-[var(--p-light)] text-[var(--p)]
 hover:bg-[var(--p)] hover:text-[var(--ti)]
 transition-all duration-[var(--dur-normal)]"

/* ── Link Button ── */
"text-[var(--p)] font-[600] uppercase tracking-wider text-sm
 hover:underline"

/* ── Social (Google) ── */
"w-full border border-[var(--bd)] rounded-[var(--r-md)]
 px-6 py-3 flex items-center justify-center gap-3
 hover:bg-[var(--bg3)]
 font-display font-[500]"

/* ── Text Link ── */
"text-[var(--p)] font-[500] underline hover:text-[var(--p-dark)]"

/* 크기 변형 */
btn-sm:  px-4 py-2 text-sm rounded-[var(--r-sm)]
btn-md:  px-6 py-3 text-base rounded-[var(--r-md)]  /* 기본 */
btn-lg:  px-8 py-4 text-lg rounded-[var(--r-lg)]
```

### React Native 버전

```tsx
// src/mobile/components/ui/Button.tsx
import { Pressable, Text, StyleSheet } from 'react-native';
import { tokens } from '../tokens';

const styles = StyleSheet.create({
  base: {
    minHeight: 44,       // 터치 타겟 최소 44px
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.r.md,
    paddingHorizontal: tokens.s[6],
    paddingVertical: tokens.s[3],
  },
  primary: {
    backgroundColor: tokens.p,
  },
  primaryText: {
    color: tokens.ti,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 16,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: tokens.p,
  },
  secondaryText: {
    color: tokens.p,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 16,
  },
  disabled: {
    opacity: 0.5,
  },
});
```

---

## ☑️ Selectors

```jsx
// src/components/ui/Checkbox.jsx

/* 4가지 상태 */
Unselected:   "w-[22px] h-[22px] border-2 border-[var(--bd)] rounded-[4px]"
Selected:     "w-[22px] h-[22px] border-2 border-[var(--p)] bg-[var(--p)] rounded-[4px]"
              체크 아이콘 bounce 애니메이션
Indeterminate:"w-[22px] h-[22px] bg-[var(--p)] border-[var(--p)] — 가로줄"
Disabled:     opacity-50 cursor-not-allowed

/* Toggle */
Off:  "bg-[var(--bd)] w-11 h-6"
On:   "bg-[var(--p)] w-11 h-6" + 흰색 원 spring 이동
크기: 최소 44×44px 터치 타겟 확보
```

---

## 📝 Form Fields

```jsx
// src/components/ui/Input.jsx

/* Default */
"w-full px-4 py-3
 border border-[var(--bd)] rounded-[var(--r-md)]
 bg-[var(--bg)] text-[var(--t1)]
 placeholder:text-[var(--t3)]
 font-body text-base
 transition-all duration-[var(--dur-normal)]"

/* Focus */
"focus:border-[var(--bdf)] focus:ring-2 focus:ring-[var(--p)]/20 focus:outline-none"

/* Error */
"border-[var(--bde)] ring-2 ring-[var(--error)]/20"
에러 메시지: "text-[var(--error)] text-sm mt-1"

/* Success */
"border-[var(--success)] ring-2 ring-[var(--success)]/20"

/* Disabled */
"opacity-50 cursor-not-allowed bg-[var(--bg3)]"

/* Alt Form (용어-정의 2열 테이블) */
기본:  "border-b border-[var(--bg3)]"
선택:  "bg-[var(--p-light)] border-b-2 border-[var(--p)]"
```

---

## 🔽 Dropdowns & Popovers

```
Dropdown:   Radix UI Select 기반, 키보드 네비게이션
Popover:    Radix UI Popover, 외부 클릭 닫기
Mobile:     바텀시트 형태, 드래그 핸들 포함
검색:       Dropdown 내 검색 필터 (단어장 선택 시)
```

---

## 💬 Tooltips

```jsx
"absolute px-3 py-2 rounded-[var(--r-md)]
 bg-[var(--t1)] text-[var(--ti)] text-sm
 shadow-[var(--sh-md)]
 animate-in fade-in duration-[var(--dur-normal)]"

방향: top(기본) | bottom | left | right  — caret 포함
색상 변형: default(dark) · info · warning · error
```

---

## 🆕 추가 컴포넌트

### Progress Bar

```jsx
// src/components/ui/ProgressBar.jsx

/* 선형 */
<div className="w-full h-1.5 bg-[var(--bg3)] rounded-[var(--r-full)] overflow-hidden">
  <div className="h-full bg-[var(--p)] rounded-[var(--r-full)]
                  transition-[width] duration-[var(--dur-slow)] ease-out"
       style={{ width: `${progress}%` }} />
</div>

/* 색상 변형: bg-[var(--p)] | bg-[var(--success)] | bg-[var(--error)] */
/* 텍스트 포함 시: 상단 "{current} / {total}" + 퍼센트 표시 */
```

### Toast

```jsx
// src/components/ui/Toast.jsx

/* 성공 */  "bg-[var(--success-light)] border-l-[3.5px] border-[var(--success)]"
/* 에러 */  "bg-[var(--error-light)]   border-l-[3.5px] border-[var(--error)]"
/* 정보 */  "bg-[var(--info-light)]    border-l-[3.5px] border-[var(--info)]"
/* 경고 */  "bg-[var(--warning-light)] border-l-[3.5px] border-[var(--warning)]"

위치: 화면 상단 중앙 fixed / auto-dismiss 3초
```

### Modal

```jsx
// src/components/ui/Modal.jsx

/* 배경 */  "fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
/* 모달 */  "bg-[var(--bg)] rounded-[var(--r-2xl)] shadow-[var(--sh-xl)] p-6 max-w-md mx-auto"
/* 진입 */  scale(0.95)→scale(1) + opacity 0→1, --dur-slow, --ease-spring
```

### Bottom Tab Bar (웹 모바일 + RN)

```jsx
// src/components/layout/BottomTabBar.jsx (웹)

/* 5개 탭: 📖 스크립트 | 📝 단어 | 🃏 카드 | 🎮 게임 | 📊 통계 */
"fixed bottom-0 w-full bg-[var(--bg)] border-t border-[var(--bd)]
 flex safe-bottom"
/* 각 탭: min-h-[56px] flex-1 flex flex-col items-center justify-center py-2 */
/* 활성:  text-[var(--p)], 아이콘 채움 */
/* 비활성: text-[var(--t3)], 아이콘 아웃라인 */
```

```tsx
// src/mobile/components/layout/BottomTabBar.tsx (RN)
import { Platform } from 'react-native';

const tabBarStyle = {
  height: Platform.OS === 'ios' ? 83 : 60,
  paddingBottom: Platform.OS === 'ios' ? 28 : 8,
  backgroundColor: tokens.bg,
  borderTopColor: tokens.bd,
  borderTopWidth: 0.5,
};
```

### Audio Player (TTS)

```jsx
/* 미니 버튼 (문장 옆 인라인) */
"w-8 h-8 rounded-full bg-[var(--p-light)] text-[var(--p)]
 flex items-center justify-center"
아이콘: Play ▶ / Pause ⏸ (Lucide 16px)

/* 전체 플레이어 (하단 고정) */
"fixed bottom-[56px] w-full bg-[var(--bg)] border-t border-[var(--bd)] px-4 py-3"
컨트롤: [◀이전] [▶재생/⏸일시정지] [▶다음]
속도: 0.5x / 0.75x / 1x / 1.25x / 1.5x
진행바 + 현재 문장 텍스트
```

### Loading Overlay

```jsx
// src/components/ui/LoadingOverlay.jsx

"fixed inset-0 z-[200] bg-[rgba(15,23,42,0.5)] backdrop-blur-[4px]
 flex items-center justify-center"

/* 내부 카드 */
"bg-[var(--bg)] rounded-[var(--r-xl)] px-12 py-10 text-center
 shadow-[0_12px_40px_rgba(0,0,0,0.12)]"

/* 스피너: w-10 h-10 / border-t → --p / 0.7s linear infinite */
```

### Badge

```jsx
// src/components/ui/Badge.jsx

"inline-flex items-center font-body text-[11px] font-[600]
 px-2.5 py-0.5 rounded-[var(--r-full)]"

/* green: bg-[var(--success-light)] text-[#065f46] */
/* blue:  bg-[var(--p-light)] text-[var(--p)] */
/* gray:  bg-[var(--bg3)] text-[var(--t3)] */
```

### ButtonGroup

```jsx
// src/components/ui/ButtonGroup.jsx

"flex items-center border border-[var(--bd)] rounded-[var(--r-md)] overflow-hidden"
/* 레이블: font-body 11px / 600 / text-muted / px-2 pl-2.5 */
/* 버튼:   border-r border-[var(--bd)] / hover:bg-[var(--bg2)] / last:border-r-0 */
```

---

## 📱 React Native — 토큰 & 패턴

> **v6 신규 섹션** — 웹(Next.js)과 동일한 설계 기준을 RN/Expo에 적용

### 토큰 파일

```typescript
// src/mobile/tokens.ts

export const tokens = {
  /* Brand */
  p:       '#3B82F6',
  pHover:  '#2563EB',
  pLight:  '#EFF6FF',
  pDark:   '#1D4ED8',

  /* Semantic */
  success:      '#22C55E',
  successLight: '#DCFCE7',
  error:        '#EF4444',
  errorLight:   '#FEE2E2',
  warning:      '#F59E0B',
  warningLight: '#FEF3C7',
  info:         '#06B6D4',
  infoLight:    '#CFFAFE',

  /* Surface */
  bg:  '#FFFFFF',
  bg2: '#F8FAFC',
  bg3: '#F1F5F9',

  /* Text */
  t1: '#0F172A',
  t2: '#475569',
  t3: '#94A3B8',
  t4: '#CBD5E1',
  ti: '#FFFFFF',

  /* Border */
  bd:  '#E2E8F0',
  bdf: '#3B82F6',

  /* Radius */
  r: { sm: 6, md: 8, lg: 12, xl: 16, '2xl': 24 },

  /* Spacing */
  s: { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48 },
} as const;

/* Dark mode 토큰 */
export const tokensDark = {
  ...tokens,
  p:      '#60A5FA',
  pLight: '#1E3A5F',
  bg:  '#0B1120',
  bg2: '#141E30',
  bg3: '#1E2D42',
  t1:  '#F1F5F9',
  t2:  '#CBD5E1',
  t3:  '#64748B',
  bd:  '#1E2D42',
} as const;
```

### 다크모드 훅

```typescript
// src/mobile/hooks/useTokens.ts
import { useColorScheme } from 'react-native';
import { tokens, tokensDark } from '../tokens';

export function useTokens() {
  const scheme = useColorScheme();
  return scheme === 'dark' ? tokensDark : tokens;
}
```

### 공통 패턴

```typescript
// SafeAreaView 필수 적용
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';

// Pressable — 터치 타겟 최소 44×44px
<Pressable
  style={({ pressed }) => [
    styles.button,
    pressed && { opacity: 0.7 },
  ]}
  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
>

// Platform.select — 플랫폼별 분기
import { Platform } from 'react-native';
const shadow = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  android: {
    elevation: 3,
  },
});

// 폰트 로딩 (Expo)
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold } from '@expo-google-fonts/dm-sans';
import { Lora_400Regular, Lora_600SemiBold, Lora_700Bold } from '@expo-google-fonts/lora';
import { JetBrainsMono_400Regular, JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono';
```

### RN 폰트 역할 매핑

```typescript
export const fonts = {
  display: {
    regular:    'PlusJakartaSans_400Regular',
    semibold:   'PlusJakartaSans_600SemiBold',
    bold:       'PlusJakartaSans_700Bold',
    extrabold:  'PlusJakartaSans_800ExtraBold',
  },
  body: {
    regular:    'DMSans_400Regular',
    medium:     'DMSans_500Medium',
    semibold:   'DMSans_600SemiBold',
  },
  english: {
    regular:    'Lora_400Regular',
    semibold:   'Lora_600SemiBold',
    bold:       'Lora_700Bold',
  },
  mono: {
    regular:    'JetBrainsMono_400Regular',
    bold:       'JetBrainsMono_700Bold',
  },
} as const;
```

### RN 접근성

```typescript
// 모든 버튼에 accessibilityLabel 필수
<Pressable accessibilityLabel="단어 발음 듣기" accessibilityRole="button">

// 최소 터치 타겟
style={{ minHeight: 44, minWidth: 44 }}

// 스크린리더 힌트
accessibilityHint="탭하면 단어 발음을 들을 수 있습니다"
```

---

## 🖥 프로젝트 모노레포 구조 (Turborepo)

> 웹(Next.js 14) + 앱(Expo) + 공유 패키지를 단일 레포에서 관리.
> 상업 서비스 표준에 맞춰 도메인 단위로 분리하고, 공통 디자인 토큰·타입을 패키지화.

```
vocaflow/                                     ← 모노레포 루트
├── apps/
│   ├── web/                                  ← Next.js 14 (App Router)
│   └── mobile/                               ← React Native (Expo)
├── packages/
│   ├── design-tokens/                        ← CSS Variables + RN tokens 단일 출처
│   ├── ui-shared/                            ← 플랫폼 무관 로직 (스코어 계산 등)
│   ├── types/                                ← 공유 TypeScript 타입 (DB·API)
│   └── eslint-config/                        ← 공통 린트 규칙
├── supabase/
│   ├── migrations/                           ← SQL 마이그레이션
│   ├── functions/                            ← Edge Functions
│   └── seed.sql
├── .github/
│   └── workflows/                            ← CI/CD (lint·test·deploy)
├── .vscode/
├── docs/                                     ← 운영/온보딩 문서
├── scripts/                                  ← 워크스페이스 유틸 스크립트
│   ├── smoke-tokens.mjs                      ← @vocaflow/design-tokens 런타임 검증
│   ├── verify-tokens.mjs                     ← 토큰 export 일관성 검증
│   ├── fix-mojibake.mjs                      ← 한글 깨짐 일괄 복구
│   ├── fix-mojibake-runs.mjs                 ← Slate runs 한글 깨짐 복구
│   ├── marketing-ref-transform.mjs           ← 마케팅 레퍼런스 변환
│   ├── dict-common.mjs                       ← Supabase service-role 클라이언트 + 공통 헬퍼 (★v06.23)
│   ├── dict-fetch-batch.mjs                  ← shared_dictionary meaning_ko NULL batch 추출 (50개씩 · CEFR 정렬)
│   ├── dict-update-batch.mjs                 ← 한국어 뜻 batch UPDATE (멱등 — WHERE meaning_ko IS NULL 보호)
│   ├── dict-status.mjs                       ← CEFR별 채움 진행률 보고 (text/JSON)
│   ├── seed-dictionary.config.mjs            ← 외부 시드 SQLite 매핑 설정
│   └── seed-dictionary.mjs                   ← shared_dictionary + categories 멱등 batch upsert (ON CONFLICT DO NOTHING)
├── turbo.json
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── tsconfig.base.json                        ← 워크스페이스 공통 TS 설정
├── package.json
├── .editorconfig · .prettierrc · .nvmrc      ← 코드 스타일·런타임 설정
├── CLAUDE.md                                 ← 디자인 시스템 SSoT (이 문서)
└── README.md
```

---

### 📂 apps/web — Next.js 14 (App Router)

```
apps/web/
├── public/                                   ← 정적 자산 (favicon, og-image, manifest.json)
│   ├── icons/
│   ├── images/
│   ├── fonts/                                ← self-hosted 백업용
│   ├── favicon.ico
│   ├── robots.txt
│   ├── sitemap.xml
│   └── manifest.json                         ← PWA
├── src/
│   ├── app/                                  ← App Router
│   │   ├── (auth)/                           ← 인증 라우트 그룹
│   │   │   ├── layout.tsx                    ← 인증 전용 레이아웃 (헤더 없음)
│   │   │   ├── login/page.tsx
│   │   │   ├── signup/page.tsx
│   │   │   ├── reset-password/page.tsx
│   │   │   └── verify-email/page.tsx
│   │   ├── (marketing)/                      ← 랜딩/공개 페이지
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx                      ← 랜딩 (= 루트 /)
│   │   │   ├── pricing/page.tsx
│   │   │   ├── about/page.tsx
│   │   │   ├── terms/page.tsx
│   │   │   └── privacy/page.tsx
│   │   ├── (app)/                            ← 게임 풀스크린 라우트 그룹 (사이드바 X)
│   │   │   └── play/
│   │   │       └── wordblitz/page.tsx        ← WordBlitz 풀스크린 플레이
│   │   ├── (main)/                           ← 로그인 후 앱 (라우트 그룹 — URL 비포함)
│   │   │   ├── layout.tsx                    ← Sidebar + FlowNav + SessionFrame + main 레이아웃 (v06.21)
│   │   │   ├── hub/page.tsx                  ← Hub (Home+Dashboard 통합) ★ 진입점
│   │   │   ├── library/layout.tsx            ← LibraryTabs 헤더 + max-w-6xl 컨테이너 (v06.16)
│   │   │   ├── library/page.tsx              ← redirect → /library/scripts (v06.16)
│   │   │   ├── library/scripts/page.tsx      ← 공용 스크립트 라이브러리 (이전 /library 콘텐츠) ★v06.16
│   │   │   ├── library/vocab/page.tsx        ← 공용 단어장 (수능·고등·중등·TOEIC·공무원·비즈니스) ★v06.16
│   │   │   ├── text/page.tsx                 ← TextViewer 허브 (내 스크립트 라이브러리 + 입력 진입점) ★v06.10
│   │   │   ├── text/new/page.tsx             ← TextViewer 입력 화면 (직접입력·PDF·DOCX·TXT·URL → AI 분석)
│   │   │   ├── text/[id]/page.tsx            ← 학습 워크스페이스 (Reading + Recall + Audio)
│   │   │   ├── wordvault/page.tsx            ← WordVault 허브 v6 (BookShelf·LearningDimension·WordPeek 추가) ★v06.20
│   │   │   │                                   + ?view=browse 호환성 redirect → /wordvault/browse ★v06.22
│   │   │   ├── wordvault/browse/page.tsx     ← Browse 풀스크린 세션 ★v06.22 신규
│   │   │   │                                   (워크스페이스 접근 용이 · SessionFrame 셸 자동 주입)
│   │   │   ├── dashboard/layout.tsx          ← metadata server layout (page.tsx 가 'use client' 라 분리) ★v06.21
│   │   │   ├── dashboard/page.tsx            ← 대시보드 (KPI·28일 sparkline·Ring·Trend·컴팩트 RecentActivity 칩) ★v06.22
│   │   │   ├── flashcard/page.tsx            ← Flashcard Hub (Continue·Queue·정확도·시작 설정)
│   │   │   ├── flashcard/play/page.tsx       ← Flashcard 세션 (SM-2 SRS · 4단계 평가)
│   │   │   ├── spellforge/page.tsx           ← SpellForge Hub (Memory Decay · Best 점수)
│   │   │   ├── spellforge/play/page.tsx      ← SpellForge 세션 (스펠링 타이핑 · IME 분리)
│   │   │   ├── wordblitz/page.tsx            ← WordBlitz Hub (게임 소개 · 최근 점수)
│   │   │   ├── pairflip/page.tsx             ← PairFlip Hub (Hero + StartScreen 통합) ★v06.21 신규
│   │   │   ├── pairflip/play/page.tsx        ← PairFlip 세션 (3D flip 카드 + O/X 코너 배지 + 모든 레벨 2줄) ★v06.21
│   │   │   ├── pairflip/results/page.tsx     ← PairFlip 결과 (ScoreRing · PairsList · NextActionCard) ★v06.21
│   │   │   ├── scriptquiz/page.tsx           ← ScriptQuiz Hub (Chapter grid · 한영 토글)
│   │   │   ├── scriptquiz/play/page.tsx      ← ScriptQuiz 세션 (3-screen · 영어 immersion)
│   │   │   ├── dictate/page.tsx              ← Dictation Hub (CEFR 자동 감지 · 리소스 선택) ★v06.7
│   │   │   ├── dictate/setup/page.tsx        ← Dictation Setup (단위/갯수/순서/채점/속도/힌트)
│   │   │   ├── dictate/session/page.tsx      ← Dictation 세션 (TTS · 단어별 채점 · 4단계 힌트 · Focus)
│   │   │   ├── dictate/results/page.tsx      ← Dictation 결과 (오류 패턴 · 오답 단어 · 다음 단계)
│   │   │   └── settings/page.tsx             ← 설정 (계정·테마·TTS·알림·데이터)
│   │   ├── (app)/                            ← 게임 풀스크린 라우트 그룹 (사이드바 X · FlowNav X · SessionFrame ✓)
│   │   │   ├── layout.tsx                    ← SessionFrame 적용 layout ★v06.21 신규
│   │   │   ├── play/wordblitz/page.tsx       ← WordBlitz 3D 풀스크린 (ResourceContext: 정글 어드벤처)
│   │   │   └── play/pirate-quest/page.tsx    ← Pirate's Bounty 베타 (ResourceContext: 단어 모험)
│   │   ├── admin/                            ← 관리자 콘솔 (§15 / route group 미사용 → URL = /admin/*)
│   │   │   ├── layout.tsx                    ← AdminSidebar 적용
│   │   │   ├── page.tsx                      ← 관리자 대시보드 (KPI · 섹션 · 최근 활동)
│   │   │   ├── users/page.tsx                ← stub · 사용자 관리
│   │   │   ├── library/page.tsx              ← stub · 콘텐츠 관리
│   │   │   ├── vocabulary/page.tsx           ← stub · 단어장 마스터
│   │   │   ├── analytics/page.tsx            ← stub · 플랫폼 분석
│   │   │   ├── reports/page.tsx              ← stub · 신고/문의
│   │   │   ├── billing/page.tsx              ← stub · 결제/구독
│   │   │   └── settings/page.tsx             ← stub · 시스템 설정
│   │   ├── dev/                              ← 개발 검증
│   │   │   └── components/page.tsx           ← Parts Kit 컴포넌트 카탈로그
│   │   ├── api/                              ← Route Handlers (현재 auth/callback 폴더만 존재)
│   │   │   ├── auth/
│   │   │   │   └── callback/                 ← Supabase OAuth 콜백 (route.ts 미구현 — Phase 2)
│   │   │   /* 예정: analyze · tts · quiz · upload · health */
│   │   ├── page.tsx                          ← 루트 / — 화면 인덱스 + 진행률 대시보드 (Phase 1.5 dev 진입점)
│   │   ├── error.tsx                         ← 전역 에러 바운더리 (필수)
│   │   ├── not-found.tsx                     ← 404 (필수)
│   │   ├── loading.tsx                       ← 전역 로딩 스피너 (필수)
│   │   ├── globals.css                       ← CSS Variables (이 문서 §Colors)
│   │   ├── favicon.ico
│   │   └── layout.tsx                        ← Root layout + 폰트 + Provider
│   ├── components/
│   │   ├── ui/                               ← Parts Kit 기반 공통 (재사용 가능)
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Select.tsx
│   │   │   ├── Checkbox.tsx
│   │   │   ├── Radio.tsx
│   │   │   ├── Toggle.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Toast.tsx
│   │   │   ├── Tooltip.tsx
│   │   │   ├── ProgressBar.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── ButtonGroup.tsx
│   │   │   ├── LoadingOverlay.tsx
│   │   │   ├── Skeleton.tsx
│   │   │   └── EmptyState.tsx
│   │   ├── layout/                           ← 페이지 골격
│   │   │   ├── Sidebar.tsx                   ← 데스크톱 전용 (햄버거 토글 240px↔72px · 풀스크린 자동 숨김) ★v06.16
│   │   │   ├── sidebar-config.ts             ← META + NAV_GROUPS(5) + FOOTER 단일 출처 ★v06.16
│   │   │   ├── FlowNav.tsx                   ← 6단계 흐름 네비 (sticky · 풀스크린 자동 숨김) ★v06.14
│   │   │   ├── SessionFrame.tsx              ← 풀스크린 세션 셸 v2 ★v06.22 (2-row stack: 모듈 + 리소스 브레드크럼)
│   │   │   ├── ResourceContext.tsx           ← Server Component 페이지용 리소스 주입 wrapper ★v06.22 신규
│   │   │   ├── Header.tsx · BottomTabBar.tsx · PageContainer.tsx · Footer.tsx
│   │   ├── dictation/                        ← Dictation 모듈 전용 (v06.7 신규)
│   │   │   ├── DictationHubClient.tsx        ← Hub: ModuleHero · Smart Suggestion · 리소스 · 최근 세션
│   │   │   ├── DictationSetupClient.tsx      ← Setup: CEFR 6레벨 · 단위 3 · 갯수 4 · 순서 3 · 채점 2 · 고급
│   │   │   ├── DictationSessionClient.tsx    ← Session: TTS 재생 · 단어별 채점 · 4단계 힌트 · Focus Mode
│   │   │   └── DictationResultsClient.tsx    ← Results: Hero 정확도 · 오류 패턴 분석 · 오답 단어 · 다음 단계
│   │   ├── textviewer/                       ← TextViewer 허브 전용 (v06.10 신규)
│   │   │   ├── TextCard.tsx                  ← 스크립트 카드 (cover gradient · CEFR · 진행률 · 정복 배지)
│   │   │   ├── TextStatusBadge.tsx           ← 4단계 상태 배지 (미시작/진행중/정복)
│   │   │   ├── MyTextsGrid.tsx               ← CEFR 필터 + 검색 + 그리드 (1/2/3열 반응형)
│   │   │   ├── EmptyState.tsx                ← Cold 사용자 첫 진입 (직접 입력 / 라이브러리 분기)
│   │   │   └── DiscoveryFooter.tsx           ← /library 부드러운 전환 (L0 ↔ L1)
│   │   ├── text-viewer/                      ← TextViewer 입력 폼 전용 (v06.1 분리)
│   │   │   ├── InputModeTabs.tsx             ← 직접 입력 / 파일 / URL 탭
│   │   │   ├── TextInput.tsx                 ← 직접 입력
│   │   │   ├── FileUploadArea.tsx            ← PDF · DOCX · TXT 업로드
│   │   │   ├── UrlInput.tsx                  ← URL 가져오기 (Phase 2)
│   │   │   ├── SampleScripts.tsx             ← 샘플 스크립트 카드
│   │   │   ├── ScriptDisplay.tsx             ← 본문 렌더링
│   │   │   ├── AnalysisResult.tsx            ← AI 단어 분석 결과 + WordVault 인계
│   │   │   ├── WordList.tsx                  ← 분석된 단어 리스트
│   │   │   ├── WordCard.tsx                  ← 단어 카드
│   │   │   └── analysis-types.ts             ← 도메인 타입
│   │   ├── wordvault/                        ← WordVault 단어장 전용
│   │   │   ├── hub/                          ← 허브 v6 (v06.11 신규 → v06.20 hybrid 보강)
│   │   │   │   ├── WordVaultHub.tsx          ← 6 Tier 합성 (Hero+VaultBar · BookShelf · CEFR · FindAndMore · LearningDimension · MemoryDecay · WordPeek) ★v06.20
│   │   │   │   ├── VaultBar.tsx              ← Hero 내부 슬림 8px 4색 누적 막대 ★v06.18
│   │   │   │   ├── AssetCollectionsRow.tsx   ← 출처별 컬렉션 (보존, hub 합성 X — 사용자 결정 영역) ★v06.18
│   │   │   │   ├── BookShelfSection.tsx      ← 5 Book Type 카드 (text·level·smart·goal·theme) ★v06.20
│   │   │   │   ├── CEFRDistribution.tsx      ← 6단계 horizontal bar + browse 레벨 진입 ★v06.19
│   │   │   │   ├── FindAndMore.tsx           ← 인라인 검색 진입 + 보조 작업 ★v06.19
│   │   │   │   ├── LearningDimensionSection.tsx ← module_history 3그룹 (unmet/recognizing/multichannel) ★v06.20
│   │   │   │   ├── MemoryDecayDistribution.tsx ← 4색 stacked bar + Bucket 카드 (TrendIndicator 통합)
│   │   │   │   ├── TrendIndicator.tsx        ← week-over-week 추세 (Calm UI: 빨강 X) ★v06.18
│   │   │   │   ├── WordPeekStrip.tsx         ← 데스크톱 전용 최근 단어 5개 chip ★v06.20
│   │   │   │   └── WordVaultEmptyState.tsx   ← Cold 사용자 첫 진입
│   │   │   ├── WordVaultBrowseClient.tsx     ← Browse 풀스크린 클라이언트 ★v06.22 (StatsGrid·단어추가·학습시작 제거)
│   │   │   ├── ScriptsChipNav.tsx            ← 스크립트 칩 nav (전체+각 스크립트 단어 수) ★v06.22 신규
│   │   │   ├── PageHeader.tsx                ← 단어장 헤더 (browse 에선 미사용 — SessionFrame 대체)
│   │   │   ├── CollectionsRow.tsx            ← 단어장 모음 가로 스크롤
│   │   │   ├── SearchRow.tsx                 ← 검색 + 필터
│   │   │   ├── HideToggleBar.tsx             ← 영단어/뜻 숨김 토글 (Active Recall) ★v06.21.5 "전체 예문 펼치기" 제거
│   │   │   ├── StatsGrid.tsx                 ← 단어장 통계 (browse 에선 미사용)
│   │   │   ├── WordList.tsx                  ← 단어 행 컨테이너 ★v06.21.5 expand props 제거
│   │   │   ├── WordRow.tsx                   ← 단어 행 v4 ★v06.21.5 (16px·예문 우측·펼침 X·메타 X)
│   │   │   ├── ListenPanel.tsx               ← 듣기 패널 ★v06.21.7 설정 토글 제거 — 항상 노출
│   │   │   ├── StudyMode.tsx                 ← 학습 모드 진입 패널
│   │   │   ├── hooks/                        ← 단어장 도메인 훅
│   │   │   ├── mock-data.ts
│   │   │   └── types.ts
│   │   ├── flashcard/                        ← Flashcard 게임 (top-level · v06.5 위치 변경)
│   │   │   ├── FlashcardSession.tsx          ← 세션 컨테이너 (SM-2 SRS)
│   │   │   ├── Card.tsx · CardFront.tsx · CardBack.tsx  ← 3D flip 카드
│   │   │   ├── RecallPhase.tsx · FirstJudge.tsx        ← 능동적 회상 단계
│   │   │   ├── HonestyHint.tsx · MicroPause.tsx        ← 학습 과학 보조
│   │   │   ├── SRSBar.tsx · ForgettingCurve.tsx        ← 진행 가시화
│   │   │   ├── CompletionState.tsx
│   │   │   └── mock-data.ts
│   │   ├── spellforge/                       ← SpellForge 게임 (top-level · v06.5 위치 변경)
│   │   │   ├── SpellForge.tsx                ← 메인 컨테이너
│   │   │   ├── ModeSelector.tsx              ← 단어→철자 / 뜻→철자 모드
│   │   │   ├── MeaningDisplay.tsx · InputSlots.tsx · SingleBox.tsx
│   │   │   ├── ConfirmButton.tsx · IMEIndicator.tsx
│   │   │   ├── ReflectionHint.tsx · MicroPause.tsx     ← 학습 과학 보조
│   │   ├── pairflip/                         ← PairFlip 게임 (L4a Recognize 4번째) ★v06.21 신규
│   │   │   ├── types.ts · constants.ts · theme.ts · mock-data.ts · index.ts
│   │   │   ├── PairFlipEnv.tsx               ← warm ivory 환경 + 골드 라디얼 + 미세 폴카
│   │   │   ├── PairFlipMascot.tsx            ← 부엉이 마스코트 4상태 (idle/cheer/happy/clap)
│   │   │   ├── PairFlipLogo.tsx              ← editorial 네이비/골드 글자별 라이즈
│   │   │   ├── PairFlipLevelSelector.tsx     ← 5단계 (Easy 8장 ~ Master 20장)
│   │   │   ├── PairFlipModeSelector.tsx      ← word_meaning(default) / word_definition(Phase 2)
│   │   │   ├── PairFlipStartScreen.tsx       ← Env+Logo+Mascot+Level+Mode+Start 통합
│   │   │   ├── PairFlipHub.tsx               ← Hero(Best/콤보/게임수) + StartScreen 통합
│   │   │   ├── PairFlipCard.tsx              ← 3D flip + 5상태 + O/X 코너 배지 + 골드 테두리
│   │   │   ├── PairFlipGrid.tsx              ← gridCols × 2 rows + 좁은 viewport 가로 스크롤
│   │   │   ├── PairFlipHUD.tsx               ← 타이머·점수(네이비/골드)·콤보·힌트 sticky
│   │   │   ├── PairFlipFeedback.tsx          ← 매칭 emerald/coral 오버레이 + 콤보 텍스트
│   │   │   ├── PairFlipProgress.tsx          ← 하단 진행바 (matched/total)
│   │   │   ├── PairFlipGameScreen.tsx        ← HUD+Grid+Feedback+Mascot+Progress 통합
│   │   │   ├── PairFlipScoreRing.tsx         ← SVG 정확도 링 (정확도 90+ 골드 그라디언트)
│   │   │   ├── PairFlipPairsList.tsx         ← 매칭 단어 펼침 리스트
│   │   │   ├── PairFlipNextActionCard.tsx    ← 결과 후 SDT 자율형 추천 3카드
│   │   │   └── PairFlipResultScreen.tsx      ← Hero(ScoreRing)+Stats+Pairs+NextAction
│   │   ├── game/                             ← 게임 공통 + 미이동 모듈 (예정 분리)
│   │   │   ├── shared/                       ← 게임 공통 (현재 빈 폴더 — GameTimer/ScoreCircle 등 예정)
│   │   │   ├── flashcard/                    ← 빈 폴더 (top-level components/flashcard/ 사용)
│   │   │   ├── spellforge/                   ← 빈 폴더 (top-level components/spellforge/ 사용)
│   │   │   ├── wordblitz/                    ← 예정
│   │   │   │   ├── WordBlitzGame.tsx
│   │   │   │   ├── WordBlitzOption.tsx
│   │   │   │   └── WordBlitzReaction.tsx     ← 정글 환경
│   │   │   └── scriptquiz/                   ← 예정
│   │   │       ├── ScriptQuizStart.tsx
│   │   │       ├── ScriptQuizQuestion.tsx
│   │   │       ├── ScriptQuizFeedback.tsx
│   │   │       └── ScriptQuizResult.tsx
│   │   ├── dashboard/                        ← Dashboard 전용
│   │   │   ├── StatCard.tsx                  ← KPI 카드 (variant=card / inline)
│   │   │   ├── WeeklyHeatmap.tsx             ← 28일 sparkline + Streak 배지 ★v06.22 재설계 (300px → 120px)
│   │   │   ├── ModuleAccuracyRing.tsx
│   │   │   ├── ScoreTrendChart.tsx
│   │   │   └── RecentActivity.tsx            ← 컴팩트 칩 한 줄 ★v06.21 재설계 (~300px → ~70px)
│   │   ├── home/                             ← Home Hub 전용 (§14, v06.4)
│   │   │   ├── HubHero.tsx                   ← 인사 + Streak + Today CTA + inline Stats
│   │   │   ├── ModuleCard.tsx                ← 7모듈 정사각 카드 (아이콘·마지막 학습)
│   │   │   └── ContinueCard.tsx              ← 이어하기 (Lora 제목·진행률·CTA)
│   │   ├── library/                          ← 라이브러리 전용 (v06.16 — 스크립트/단어장 2탭 분리)
│   │   │   ├── LibraryTabs.tsx               ← 2탭 (스크립트/단어장 · usePathname) ★v06.16
│   │   │   ├── CEFRBadge.tsx · CategoryChip.tsx · ContinueCard.tsx · CurationCard.tsx · LibraryCard.tsx
│   │   │   └── vocab/                        ← /library/vocab 공용 단어장 ★v06.16
│   │   │       ├── categories.ts             ← 8 카테고리 (전체+초중고·수능·공인영어·공무원·비즈니스·테마)
│   │   │       ├── CategoryFilter.tsx        ← 가로 스크롤 칩 (활성=보라)
│   │   │       ├── VocabSetCard.tsx          ← 세트 카드 (제목·CEFR·단어수·구독 CTA)
│   │   │       ├── VocabSetGrid.tsx          ← 1/2/3열 반응형 + 빈 상태
│   │   │       └── mock-data.ts              ← 6 샘플 세트 (수능/고등/중등/TOEIC/공무원/비즈니스)
│   │   ├── workspace/                        ← /text/[id] 학습 워크스페이스 전용
│   │   │   ├── ContextBar.tsx                ← 상단 sticky 바 (북마크·타이포·인사이트·집중)
│   │   │   ├── ReadingUniverse.tsx           ← Lora 영어 본문 + 단어 hover/click + 문장 재생
│   │   │   ├── RecallCard.tsx                ← 단어 의미 회상 카드 (3단계 판정)
│   │   │   ├── ModePills.tsx                 ← 7모듈 진입 pill (read/listen/words/...)
│   │   │   ├── Pagination.tsx
│   │   │   ├── FloatingAudioPlayer.tsx       ← 하단 고정 오디오 플레이어
│   │   │   ├── FloatingSparkle.tsx           ← 다음 단계 추천 카드
│   │   │   ├── InsightPanel.tsx              ← 우측 슬라이드 패널 (북마크·기억 상태)
│   │   │   ├── KeyboardHints.tsx
│   │   │   └── TypePopover.tsx
│   │   ├── admin/                            ← 관리자 콘솔 전용 (§15, v06.5)
│   │   │   └── AdminSidebar.tsx              ← 보라 액센트 · 신고 뱃지 · 사용자 앱 복귀
│   │   ├── hub/                              ← /hub 통합 진입점 카드 (Home+Dashboard 합본)
│   │   │   ├── HubStartCard.tsx              ← 첫 진입 시작 카드
│   │   │   ├── ContinueRow.tsx               ← 이어하기 가로 행
│   │   │   ├── ModuleHero.tsx                ← 모듈 hub 공통 Hero (slim · note · bottomSlot · stats)
│   │   │   └── TodayQueue.tsx                ← 오늘의 학습 큐 — risk 우선 surface
│   │   ├── pirate-quest/                     ← Pirate's Bounty 베타 게임 (3D · 단어 모험)
│   │   │   ├── PirateQuestGame.tsx · PirateQuestUI.tsx · PirateQuestUI.css
│   │   │   ├── PirateScene.tsx               ← R3F 3D 씬
│   │   │   └── PirateModel.tsx               ← GLB 모델
│   │   ├── recommend/                        ← 추천 엔진 UI (§17.3 자율 70% / 제안 30%)
│   │   │   └── NextActionCard.tsx            ← Hub Today CTA + 게임 결과 NextAction (cold/warm/hot 분기)
│   │   ├── dev/                              ← 개발 도구 (배포 시 함께 빌드)
│   │   │   └── StubPage.tsx                  ← 미구현 페이지 placeholder (제목·예정 기능·CTA)
│   │   └── marketing/                        ← 랜딩/공개 페이지 전용
│   │       ├── HeroSection.tsx
│   │       ├── FeatureGrid.tsx
│   │       ├── PricingTable.tsx
│   │       ├── TestimonialList.tsx
│   │       └── FAQAccordion.tsx
│   ├── hooks/                                ← React 훅 (UI 연결용)
│   │   ├── useTheme.ts                       ← 다크모드 토글 (localStorage + data-theme)
│   │   ├── useFocusMode.ts                   ← /text/[id] 집중 모드 (30초 무활동)
│   │   ├── useKeyboardShortcuts.ts           ← /text/[id] 키보드 단축키
│   │   ├── useDelayedFeedback.ts             ← Recall 단계 지연 피드백 (250ms)
│   │   ├── useActiveHint.ts                  ← 활성 힌트 표시
│   │   ├── useFlashcardSession.ts            ← Flashcard SM-2 세션
│   │   ├── useFlashcardKeyboard.ts           ← Flashcard 키보드 (1/2/3·Space)
│   │   ├── useRecallPhase.ts                 ← 능동적 회상 단계 상태머신
│   │   ├── useStudyingMode.ts                ← 학습 모드 진입/이탈
│   │   ├── useSpeechSynthesis.ts             ← Web Speech API TTS 폴백
│   │   ├── useSpellForgeSession.ts           ← SpellForge 세션
│   │   ├── useTypingMode.ts                  ← 타이핑 모드 상태
│   │   ├── useIMEDetection.ts                ← 한글 IME 입력 감지 (스펠링 게임)
│   │   └── dictation/                        ← Dictation 훅 (v06.7)
│   │       ├── useAudioControl.ts            ← TTS 재생/반복/정지 (Web Speech API)
│   │       └── useDictationSession.ts        ← Dictation 세션 상태 머신 (sessionStorage)
│   │   ├── usePairFlipSession.ts             ← PairFlip 세션 상태 머신 (idle→reveal→matched/mismatched) ★v06.21
│   │   /* 예정: useAuth · useVocabulary · useTTS · useGameScore
│   │            · useDashboard · useSupabase · useMediaQuery · useDebounce */
│   ├── lib/                                  ← 외부 통합 + 유틸 (서버사이드 OK)
│   │   ├── supabase/
│   │   │   ├── server.ts                     ← Server Component / Route Handler
│   │   │   ├── queries.ts                    ← 공통 쿼리
│   │   │   /* 예정: client.ts(브라우저) · middleware.ts(세션 갱신) */
│   │   ├── text-viewer/                      ← TextViewer 도메인 유틸
│   │   │   └── handoff.ts                    ← /text → /wordvault 단어 인계 (sessionStorage)
│   │   ├── srs/                              ← 간격 반복 알고리즘
│   │   │   └── sm2.ts                        ← Flashcard SM-2 알고리즘
│   │   ├── spellforge/                       ← SpellForge 도메인 로직
│   │   │   ├── scoring.ts                    ← 점수 계산
│   │   │   ├── adaptiveDifficulty.ts         ← 적응형 난이도
│   │   │   └── typoPattern.ts                ← 오타 패턴 분석
│   │   ├── wordblitz/                        ← WordBlitz 3D 도메인
│   │   │   ├── theme.ts                      ← WB_COLORS · WB_DIMS (박스 6.5×5.2×3.0 · 콘솔 기울임)
│   │   │   ├── data.ts                       ← 단어 풀 + 인형 슬롯 + GLB 매핑
│   │   │   └── types.ts                      ← Dictation 타입
│   │   ├── dictation/                        ← Dictation 도메인 (v06.7 신규)
│   │   │   ├── types.ts                      ← Config·Session·Item·WordResult·ErrorPattern
│   │   │   ├── cefr.ts                       ← A1~C2 + 그룹별 (초/중/고) + 자동 감지
│   │   │   ├── text-splitter.ts              ← 약어 처리 + 문장/단락/전체 분리
│   │   │   ├── scoring.ts                    ← Levenshtein + Word alignment + Smart/Strict
│   │   │   ├── analyzer.ts                   ← 6개 패턴 (-ed·관사·복수·동음이의·스펠·단어선택)
│   │   │   ├── audio-control.ts              ← Web Speech API + 자동반복 + 무음 간격
│   │   │   ├── hint.ts                       ← 4단계 힌트 (-5/-3/-10/-25)
│   │   │   └── storage.ts                    ← localStorage + 시드 (A2/B1/B2 3종)
│   │   ├── pairflip/                         ← PairFlip 도메인 ★v06.21 신규
│   │   │   └── learning-records.ts           ← FSRS rating → learning_records 변환 (Phase 2 Supabase)
│   │   ├── wordvault/                        ← WordVault 도메인 ★v06.20 신규
│   │   │   └── mastery.ts                    ← module_history 기반 3그룹 (unmet/recognizing/multichannel)
│   │   ├── layout/                           ← Layout 정책 ★v06.21 신규
│   │   │   └── full-screen-routes.ts         ← isFullScreenRoute 단일 출처 (Sidebar+FlowNav 공유)
│   │   ├── pirate-quest/                     ← Pirate's Bounty 도메인 (3D 단어 모험)
│   │   │   ├── data.ts                       ← 단어 풀 + 스테이지 매핑
│   │   │   └── types.ts
│   │   ├── recommend/                        ← 추천 엔진 도메인 (§17.3)
│   │   │   ├── next-action.mock.ts           ← cold/warm/hot 사용자 단계별 mock 추천
│   │   │   └── types.ts                      ← Action 타입 (module · queue · strategy · label)
│   │   └── utils/                            ← cn · format · validation · constants (예정)
│   ├── types/                                ← TypeScript 타입
│   │   ├── database.ts                       ← Supabase 자동 생성
│   │   ├── flashcard.ts                      ← Flashcard 도메인 타입
│   │   ├── library.ts                        ← Library 도메인 타입
│   │   └── spellforge.ts                     ← SpellForge 도메인 타입
│   │   /* 예정: api.ts · index.ts */
│   ├── styles/
│   │   └── fonts.css                         ← @font-face self-host (백업)
│   └── middleware.ts                         ← Next.js 미들웨어 (Auth 보호)
├── tests/
│   ├── unit/                                 ← Vitest
│   ├── integration/
│   └── e2e/                                  ← Playwright
├── .env.local                                ← gitignore
├── .env.example
├── next.config.mjs
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

#### ✅ 정리 완료 (v06.7 청소)

| 항목 | 처리 |
|------|------|
| 잘못 위치한 훅 5개 (`src/use*.ts` 중복) | 삭제 — `src/hooks/` 단일 출처 |
| 잘못 위치한 페이지 `components/workspace/text/[id]/page.tsx` (0 bytes) | 삭제 — 실제 라우트는 `app/(main)/text/[id]/page.tsx` |
| 빈 placeholder 폴더 9개 (`components/audio` · `components/game/{flashcard,shared,spellforge}` · `lib/{analytics,openai,parsers,scoring}` · `config` · `stores`) | 삭제 — 사용 시점에 재생성 |
| 빈 API 라우트 폴더 5개 (`api/{analyze,health,quiz,tts,upload}`) | 삭제 — 구현 시 재생성. `api/auth/callback`은 OAuth 필수라 `.gitkeep` 유지 |

#### 🚧 남은 정리 후보

| 항목 | 위치 | 처리 방향 |
|------|------|-----------|
| 개인 파일 커밋 | 루트 `Downloads/` (GLB·PDF·zip 5.2MB) | `git rm -r --cached Downloads/` + `.gitignore`에 `Downloads/` 추가 |

---

### 📂 apps/mobile — React Native (Expo)

```
apps/mobile/
├── assets/
│   ├── icons/
│   ├── images/
│   ├── fonts/                                ← @expo-google-fonts 외 self-host
│   ├── splash.png
│   ├── icon.png
│   └── adaptive-icon.png
├── src/
│   ├── app/                                  ← Expo Router (file-based)
│   │   ├── (auth)/
│   │   │   ├── _layout.tsx
│   │   │   ├── login.tsx
│   │   │   └── signup.tsx
│   │   ├── (main)/
│   │   │   ├── _layout.tsx                   ← Tab Navigator
│   │   │   ├── index.tsx                     ← Home
│   │   │   ├── text.tsx
│   │   │   ├── wordvault.tsx
│   │   │   ├── flashcard.tsx
│   │   │   ├── spellforge.tsx
│   │   │   ├── wordblitz.tsx
│   │   │   ├── scriptquiz.tsx
│   │   │   ├── dashboard.tsx
│   │   │   └── settings.tsx
│   │   └── _layout.tsx                       ← Root + 폰트 로드
│   ├── components/                           ← 웹 components/ 와 동일 구조
│   │   ├── ui/
│   │   ├── layout/
│   │   ├── audio/
│   │   ├── text-viewer/
│   │   ├── wordvault/
│   │   ├── game/
│   │   │   ├── shared/
│   │   │   ├── flashcard/
│   │   │   ├── spellforge/
│   │   │   ├── wordblitz/
│   │   │   └── scriptquiz/
│   │   ├── dashboard/
│   │   └── marketing/
│   ├── hooks/                                ← 웹과 동일 (RN 호환만 다르게)
│   ├── stores/                               ← 웹과 동일 (Zustand 그대로 사용)
│   ├── lib/                                  ← 웹과 동일 + RN 전용
│   │   ├── supabase/                         ← AsyncStorage 어댑터
│   │   ├── anthropic/                        ← Claude API (@anthropic-ai/sdk)
│   │   ├── tts/                              ← expo-speech 폴백
│   │   ├── audio/                            ← expo-av
│   │   ├── storage/                          ← expo-secure-store
│   │   └── utils/
│   ├── theme/                                ← RN 전용 토큰 (CSS Var → JS 객체)
│   │   ├── tokens.ts                         ← @vocaflow/design-tokens 임포트
│   │   ├── colors.ts
│   │   └── ThemeProvider.tsx
│   └── types/
├── app.json                                  ← Expo 설정
├── eas.json                                  ← EAS Build/Submit
├── babel.config.js
├── metro.config.js
├── tsconfig.json
├── package.json
└── README.md
```

---

### 📂 packages/ — 공유 패키지 (모노레포 핵심)

```
packages/
├── design-tokens/                            ← 웹·앱 토큰 단일 출처
│   ├── src/
│   │   ├── colors.ts                         ← CSS Vars + RN 동시 export
│   │   ├── spacing.ts
│   │   ├── radius.ts
│   │   ├── shadow.ts
│   │   ├── motion.ts
│   │   ├── typography.ts
│   │   └── index.ts
│   ├── package.json                          ← name: "@vocaflow/design-tokens"
│   └── tsconfig.json
├── ui-shared/                                ← 플랫폼 무관 로직
│   ├── src/
│   │   ├── scoring/                          ← SM-2, 게임 점수 계산
│   │   ├── validation/                       ← Zod 스키마 공유
│   │   └── index.ts
│   └── package.json                          ← name: "@vocaflow/ui-shared"
├── types/                                    ← DB·API 타입 공유
│   ├── src/
│   │   ├── database.ts                       ← Supabase 자동 생성
│   │   ├── api.ts
│   │   └── index.ts
│   └── package.json                          ← name: "@vocaflow/types"
└── eslint-config/
    ├── index.js                              ← 공통 린트 규칙
    └── package.json
```

---

### 📂 supabase/ — DB & 서버리스

```
supabase/
├── migrations/
│   ├── 20251001000000_init_schema.sql        ← texts, vocabularies 등
│   ├── 20251015000000_add_rls.sql
│   └── 20251101000000_add_dashboard_views.sql
├── functions/                                ← Edge Functions (선택)
│   ├── analyze-text/
│   └── generate-quiz/
├── seed.sql                                  ← 시드 데이터
└── config.toml
```

---

### 📂 docs/ — 운영 문서

```
docs/
├── 00_project_brief.md                       ← 프로젝트 브리프 (기획·범위)
├── ONBOARDING.md                             ← 신규 개발자 셋업
├── DEPLOY.md                                 ← Vercel + Railway + EAS 배포
├── API.md                                    ← API Route 명세
├── ARCHITECTURE.md                           ← 시스템 다이어그램
├── DESIGN_DECISIONS.md                       ← ADR (Architecture Decision Records)
└── references/                               ← 외부 레퍼런스 (Quizlet Parts Kit·게임 프로토타입 HTML 등)
```

---

### 파일 경로 주석 규칙 (코드 작성 시 첫 줄 필수)

```typescript
// 웹 (Next.js)
// apps/web/src/components/ui/Button.tsx              ← 공통 UI
// apps/web/src/components/game/spellforge/SpellForgeGrid.tsx  ← 게임
// apps/web/src/components/wordvault/WordList.tsx     ← 단어장
// apps/web/src/components/dashboard/StatCard.tsx     ← 대시보드
// apps/web/src/app/(main)/hub/page.tsx               ← 페이지 (Home+Dashboard 통합)
// apps/web/src/lib/supabase/client.ts                ← Supabase 클라이언트
// apps/web/src/stores/authStore.ts                   ← Zustand 스토어

// 앱 (Expo)
// apps/mobile/src/components/ui/Button.tsx           ← 공통 UI (RN 버전)
// apps/mobile/src/app/(main)/dashboard.tsx           ← 페이지

// 공유 패키지
// packages/design-tokens/src/colors.ts               ← 토큰
// packages/types/src/database.ts                     ← 공유 타입
```

### 폴더 분리 원칙 (Single Responsibility)

| 폴더 | 책임 | 들어가는 것 / 들어가면 안 되는 것 |
|------|------|------|
| `components/ui` | 디자인 시스템 원자 | Parts Kit 컴포넌트만. 비즈니스 로직 금지 |
| `components/{도메인}` | 도메인별 합성 컴포넌트 | API 호출 OK. 다른 도메인 컴포넌트 import 금지 |
| `components/admin` | 관리자 콘솔 전용 | AdminSidebar 등. 사용자 앱과 격리 (보라 액센트로 시각 구분) |
| `components/dev` | 개발 도구 | StubPage 등 placeholder. 프로덕션 의미 부여 금지 |
| `hooks` | UI ↔ 데이터 연결 | React 훅만. 순수 함수는 `lib/utils` |
| `stores` | 전역 클라이언트 상태 | Zustand 스토어. 서버 상태는 React Query/SWR로 |
| `lib` | 외부 통합 + 유틸 | API SDK 래핑·파서·계산. React 훅 금지 |
| `types` | TS 타입 | 인터페이스·타입·enum. 실행 코드 금지 |
| `config` | 환경 설정 | env 검증·사이트 메타. 비즈니스 로직 금지 |

---

## 📊 Dashboard — v6 신규 섹션

> Parts Kit §13 신규 추가. 학습 통계·진행률·점수 시각화 컴포넌트 전체 정의.

### 레이아웃 구조

```
┌─────────────────────────────────────┐
│  Header: "📊 학습 현황"              │
├──────┬──────┬──────┬────────────────┤
│ 오늘 │ 연속 │ 총   │ 정확도         │ ← StatCard ×4
│ 학습 │ 일수 │ 단어 │                │
├─────────────────────────────────────┤
│  주간 학습 히트맵 (7일 × 24칸)       │ ← WeeklyHeatmap
├──────────────┬──────────────────────┤
│ 모듈별 정확도 │ 점수 추이 라인차트    │ ← AccuracyRing + ScoreTrend
│ (도넛 링 ×4) │                      │
├─────────────────────────────────────┤
│  최근 학습 활동                       │ ← RecentActivity
└─────────────────────────────────────┘
```

### StatCard 컴포넌트

```jsx
// src/components/dashboard/StatCard.tsx

<div className="
  flex flex-col gap-1
  p-5 rounded-[var(--r-lg)]
  bg-[var(--bg)] border border-[var(--bd)]
  shadow-[var(--sh-sm)]
">
  {/* 레이블: s1 스케일 / text-muted */}
  <span className="font-display text-[11px] font-[700] uppercase
                   tracking-[0.06em] text-[var(--t3)]">
    {label}
  </span>

  {/* 값: s2 스케일 — 40px / 800 */}
  <span className="font-display text-[40px] font-[800] leading-none
                   text-[var(--t1)]">
    {value}
  </span>

  {/* 보조 정보 */}
  {sub && (
    <span className="font-body text-[12px] text-[var(--t3)]">{sub}</span>
  )}

  {/* 트렌드 표시 (선택) */}
  {trend && (
    <span className={`font-body text-[12px] font-[600] ${
      trend > 0 ? 'text-[var(--success)]' : 'text-[var(--error)]'
    }`}>
      {trend > 0 ? '▲' : '▼'} {Math.abs(trend)}%
    </span>
  )}
</div>

/* 5가지 변형 */
variant="today"    — 오늘 학습 단어 수    — 기본 (Card)
variant="streak"   — 연속 학습 일수       — --streak 포인트 컬러
variant="total"    — 누적 학습 단어       — 기본
variant="accuracy" — 전체 정확도 %        — --success / --error 조건부
variant="inline"   — Hero 내부 임베드용   — 카드 박스 제거 / 값 = s2 흰색 / 레이블 = opacity-80
                                          — Home Hub HubHero 내 1열 3분할에서 사용 (v06.4)

/* inline variant 패턴 */
<div className="flex flex-col gap-0.5">
  <span className="font-display text-[11px] font-[700] uppercase
                   tracking-[0.06em] opacity-80">{label}</span>
  <span className="font-display text-[40px] font-[800] leading-none">{value}</span>
  {sub && <span className="font-body text-[12px] opacity-70">{sub}</span>}
</div>
```

### WeeklyHeatmap

```jsx
// src/components/dashboard/WeeklyHeatmap.tsx

/* 7열(요일) × 4행(주) 그리드 */
/* 각 셀: 12px×12px / rounded-sm / 색상 강도 — 학습량에 따라 4단계 */

/* 색상 강도 (light 모드) */
학습 없음: bg-[var(--bg3)]              /* #F1F5F9 */
1~3개:    bg-[var(--p-light)]           /* #EFF6FF */
4~8개:    bg-[var(--p)]/40              /* primary 40% */
9+개:     bg-[var(--p)]                 /* primary 100% */

/* 렌더 */
<div className="grid grid-cols-7 gap-1">
  {weeks.map((week) =>
    week.map((day) => (
      <Tooltip key={day.date} content={`${day.date}: ${day.count}개`}>
        <div
          className="w-3 h-3 rounded-sm"
          style={{ backgroundColor: getIntensityColor(day.count) }}
        />
      </Tooltip>
    ))
  )}
</div>
```

### ModuleAccuracyRing

```jsx
// src/components/dashboard/ModuleAccuracyRing.tsx

/* 모듈별 도넛 링 차트 — 4개 (Flashcard / SpellForge / WordBlitz / ScriptQuiz) */

/* SVG 도넛 링 */
<svg width="80" height="80" viewBox="0 0 80 80">
  {/* 배경 원 */}
  <circle cx="40" cy="40" r="30"
    fill="none" stroke="var(--bg3)" strokeWidth="8"/>
  {/* 정확도 원 */}
  <circle cx="40" cy="40" r="30"
    fill="none"
    stroke={moduleColor}          /* 모듈별 고정 컬러 */
    strokeWidth="8"
    strokeDasharray={`${2 * Math.PI * 30}`}
    strokeDashoffset={`${2 * Math.PI * 30 * (1 - accuracy)}`}
    strokeLinecap="round"
    transform="rotate(-90 40 40)"
    style={{ transition: 'stroke-dashoffset 1s var(--ease-out)' }}
  />
  {/* 중앙 퍼센트 */}
  <text x="40" y="40" textAnchor="middle" dominantBaseline="central"
    fill="var(--t1)"
    style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 14, fontWeight: 700 }}>
    {Math.round(accuracy * 100)}%
  </text>
</svg>

/* 모듈별 색상 */
Flashcard:  var(--p)       /* 파랑 */
SpellForge: #4A9FCF        /* 게임 전용 파란 패널 */
WordBlitz:  #22C55E        /* 초록 — 정글 테마 */
ScriptQuiz: var(--active)  /* 앰버 */
```

### ScoreTrendChart

```jsx
// src/components/dashboard/ScoreTrendChart.tsx

/* 최근 7일 점수 라인 차트 */
/* Recharts 또는 순수 SVG polyline */

/* SVG 라인 차트 패턴 */
<svg className="w-full" height="120" viewBox="0 0 300 120">
  {/* 그리드 선: stroke-[var(--bg3)] strokeDasharray="4 4" */}
  {/* 라인: stroke-[var(--p)] strokeWidth="2" fill="none" */}
  {/* 점: cx/cy fill-[var(--p)] r="4" — hover: r="6" */}
  {/* 영역: fill-[var(--p)]/10 — 라인 아래 채움 */}
</svg>

/* 범례: 모듈별 컬러 + 이름 */
/* x축: 날짜 (MM/DD) / y축: 점수 (0~100) */
```

### RecentActivity

```jsx
// src/components/dashboard/RecentActivity.tsx

/* 최근 학습 활동 타임라인 */
<div className="flex flex-col divide-y divide-[var(--bg3)]">
  {activities.map((act) => (
    <div key={act.id} className="flex items-center gap-3 py-3">

      {/* 모듈 아이콘 */}
      <div className="w-9 h-9 rounded-[var(--r-md)] flex items-center justify-center
                      bg-[var(--p-light)] text-[var(--p)] flex-shrink-0 text-[16px]">
        {moduleIcon[act.module]}
      </div>

      {/* 내용 */}
      <div className="flex-1 min-w-0">
        {/* 모듈명: body-2 / 600 */}
        <p className="font-body text-[14px] font-[600] text-[var(--t1)] truncate">
          {moduleLabel[act.module]}
        </p>
        {/* 스크립트 제목: body-4 / text-muted */}
        <p className="font-body text-[12px] text-[var(--t3)] truncate">
          {act.textTitle}
        </p>
      </div>

      {/* 우측: 점수 + 시간 */}
      <div className="text-right flex-shrink-0">
        <p className="font-display text-[14px] font-[700] text-[var(--t1)]">
          {act.score}점
        </p>
        <p className="font-body text-[11px] text-[var(--t3)]">
          {act.relativeTime}
        </p>
      </div>

    </div>
  ))}
</div>

/* 모듈 아이콘 매핑 */
const moduleIcon = {
  flashcard:  '🃏',
  spellforge: '⚡',
  wordblitz:  '🌴',
  scriptquiz: '📝',
} as const;
```

### Dashboard Supabase 쿼리

```typescript
// src/hooks/useDashboard.ts

// 오늘 학습 단어 수
const { data: todayCount } = await supabase
  .from('learning_records')
  .select('id', { count: 'exact' })
  .eq('user_id', userId)
  .gte('attempted_at', todayStart);

// 연속 학습 일수 (streak)
// learning_records에서 날짜별 그룹핑 → 연속 날짜 계산

// 주간 히트맵 데이터
const { data: weeklyData } = await supabase
  .from('learning_records')
  .select('attempted_at')
  .eq('user_id', userId)
  .gte('attempted_at', sevenDaysAgo);

// 모듈별 정확도
const { data: moduleStats } = await supabase
  .from('learning_records')
  .select('module, is_correct')
  .eq('user_id', userId);

// 점수 추이 (최근 7일 scores)
const { data: scoreTrend } = await supabase
  .from('scores')
  .select('score, module, created_at')
  .eq('user_id', userId)
  .order('created_at', { ascending: true })
  .gte('created_at', sevenDaysAgo);
```

---

## 🏠 Home Hub — v6.4 신규 섹션

> v06.3에서 신설된 `(main)/hub/page.tsx` 의 본문 컴포넌트 정의.
> Home(인사·이어하기·빠른 진입)과 Dashboard(통계·활동) 통합 진입점.
> **설계 원칙**: F-pattern 시선 정합 + Flow State 진입 보조 — 첫 화면에서 "지금 무엇을 할지" 결정 부담을 최소화하고 한 클릭 안에 학습 진입 유도.

### 레이아웃 구조 — 4영역

```
┌──────────────────────────────────────────────────┐
│  ① Hero                                          │ ← HubHero (full-width gradient)
│     인사 + Streak + Today CTA                    │
│     하단 inline Stats 3분할 (StatCard inline)     │
├──────────────────────────────────────────────────┤
│  ② Module                                        │ ← ModuleCard ×7
│     [스크립트][단어][카드][스펠][블리츠][퀴즈][통계]    │   정사각·아이콘·"마지막 학습"
├──────────────────────────────────────────────────┤
│  ③ Continue                                      │ ← ContinueCard
│     이어하기 (Lora 제목 + 진행률 + CTA)            │
├──────────────────────────────────────────────────┤
│  ④ Reflection                                    │ ← RecentActivity (§13 재사용)
│     최근 학습 활동 회고                            │
└──────────────────────────────────────────────────┘

전체 컨테이너: max-w-6xl · mx-auto · gap-6 · p-4 md:p-8
```

### 페이지 진입점

```tsx
// apps/web/src/app/(main)/hub/page.tsx
import { HubHero } from '@/components/home/HubHero';
import { ModuleCard } from '@/components/home/ModuleCard';
import { ContinueCard } from '@/components/home/ContinueCard';
import { RecentActivity } from '@/components/dashboard/RecentActivity';

export default function HubPage() {
  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto p-4 md:p-8">
      {/* ① Hero — full-width (Stats inline 내장) */}
      <HubHero />

      {/* ② Module — 7열 (모바일 2열 / 태블릿 4열) */}
      <section aria-label="학습 모듈">
        <h2 className="sr-only">학습 모듈</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <ModuleCard module="text"       />
          <ModuleCard module="wordvault"  />
          <ModuleCard module="flashcard"  />
          <ModuleCard module="spellforge" />
          <ModuleCard module="wordblitz"  />
          <ModuleCard module="scriptquiz" />
          <ModuleCard module="dashboard"  />
        </div>
      </section>

      {/* ③ Continue — 이어하기 */}
      <ContinueCard />

      {/* ④ Reflection — 최근 학습 활동 (§13 재사용) */}
      <RecentActivity />
    </div>
  );
}
```

### ① HubHero — 인사 + Streak + Today CTA + inline Stats

```tsx
// apps/web/src/components/home/HubHero.tsx
import { StatCard } from '@/components/dashboard/StatCard';

<header className="
  relative overflow-hidden
  bg-gradient-to-br from-[var(--p-dark)] to-[var(--p)]
  rounded-[var(--r-2xl)] shadow-[var(--sh-md)]
  px-6 py-8 md:px-10 md:py-10 text-[var(--ti)]
">
  {/* 상단: 좌(인사+Streak) | 우(Today CTA) */}
  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">

    {/* 좌측: 인사 + Streak */}
    <div className="flex flex-col gap-2">
      <span className="font-display text-[14px] font-[700] uppercase
                       tracking-[0.10em] opacity-80">
        Welcome back
      </span>
      {/* 인사 — s2 스케일 (40px / 800) — Flow State 진입 시각 강조 */}
      <h1 className="font-display text-[32px] md:text-[40px] font-[800] leading-[1.1]">
        안녕하세요, {userName}님 👋
      </h1>
      <p className="font-body text-[14px] md:text-[16px] opacity-90">
        🔥 <strong className="font-[700]">{streak}일</strong> 연속 학습 중이에요
      </p>
    </div>

    {/* 우측: Today's Review CTA */}
    <button className="
      shrink-0
      bg-[var(--ti)] text-[var(--p)]
      px-6 py-3 rounded-[var(--r-md)]
      font-display font-[700]
      shadow-[var(--sh-sm)]
      hover:scale-[1.02] active:scale-[0.97]
      transition-all duration-[var(--dur-normal)] ease-[var(--ease-spring)]
      flex items-center gap-2
    ">
      <span>오늘의 복습</span>
      <span className="
        bg-[var(--active)] text-[var(--ti)]
        text-[12px] font-[700] px-2 py-0.5 rounded-[var(--r-full)]
      ">{reviewCount}</span>
    </button>
  </div>

  {/* 하단: inline Stats 3분할 — StatCard variant="inline" */}
  <div className="
    mt-6 md:mt-8 pt-5
    border-t border-[var(--ti)]/20
    grid grid-cols-3 gap-4 md:gap-8
  ">
    <StatCard variant="inline" label="오늘 학습"   value={todayCount} />
    <StatCard variant="inline" label="연속 일수"   value={`${streak}일`} />
    <StatCard variant="inline" label="전체 정확도" value={`${accuracy}%`} />
  </div>

  {/* 장식: 우상단 원형 광택 */}
  <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full
                  bg-[var(--ti)]/10 blur-2xl pointer-events-none" />
</header>

/* 빈 상태 (Today's Review === 0):
   CTA 라벨 → "새 단어 추가하기" / 숫자 배지 숨김 / 링크 → /text */
```

### ② ModuleCard — 7모듈 정사각 카드

```tsx
// apps/web/src/components/home/ModuleCard.tsx

type Module = 'text' | 'wordvault' | 'flashcard' | 'spellforge'
            | 'wordblitz' | 'scriptquiz' | 'dashboard';

const MODULE_META: Record<Module, {
  icon: string; label: string; href: string; color: string;
}> = {
  text:       { icon: '📖', label: '스크립트',       href: '/text',       color: 'var(--p)'      },
  wordvault:  { icon: '📝', label: '단어장',     href: '/wordvault',  color: 'var(--p-dark)' },
  flashcard:  { icon: '🃏', label: '플래시카드', href: '/flashcard',  color: 'var(--p)'      },
  spellforge: { icon: '⚡', label: 'SpellForge', href: '/spellforge', color: '#4A9FCF'       },
  wordblitz:  { icon: '🌴', label: 'WordBlitz',  href: '/wordblitz',  color: '#22C55E'       },
  scriptquiz: { icon: '📝', label: 'ScriptQuiz', href: '/scriptquiz', color: 'var(--active)' },
  dashboard:  { icon: '📊', label: '통계',       href: '/dashboard',  color: 'var(--info)'   },
};

<a
  href={MODULE_META[module].href}
  aria-label={`${MODULE_META[module].label} 모듈로 이동`}
  className="
    group relative
    flex flex-col items-center justify-center gap-2
    aspect-square min-h-[110px]
    bg-[var(--bg)] border border-[var(--bd)]
    rounded-[var(--r-lg)] shadow-[var(--sh-sm)]
    hover:shadow-[var(--sh-md)] hover:-translate-y-0.5
    active:scale-[0.97]
    transition-all duration-[var(--dur-normal)] ease-[var(--ease)]
  "
>
  {/* 아이콘 (32px) */}
  <span className="text-[32px] leading-none">{MODULE_META[module].icon}</span>

  {/* 라벨 */}
  <span className="font-display text-[13px] font-[600] text-[var(--t1)]">
    {MODULE_META[module].label}
  </span>

  {/* 마지막 학습 시간 (선택적, 데이터 있을 때만) */}
  {lastStudiedAt && (
    <span className="font-body text-[11px] text-[var(--t3)]">
      {relativeTime(lastStudiedAt)}
    </span>
  )}

  {/* 호버 시 컬러 바 (하단) */}
  <span
    className="absolute bottom-0 left-0 right-0 h-[3px] rounded-b-[var(--r-lg)]
               opacity-0 group-hover:opacity-100
               transition-opacity duration-[var(--dur-normal)]"
    style={{ backgroundColor: MODULE_META[module].color }}
  />
</a>

/* 접근성: aria-label / 터치 타겟 110px ≥ 44px / 키보드 포커스 ring */
```

### ③ ContinueCard — 이어하기

```tsx
// apps/web/src/components/home/ContinueCard.tsx

<a
  href={`/text?id=${recentText.id}`}
  className="
    group flex flex-col gap-3 p-6
    bg-[var(--bg)] border border-[var(--bd)]
    rounded-[var(--r-lg)] shadow-[var(--sh-sm)]
    hover:shadow-[var(--sh-md)] hover:border-[var(--p)]
    transition-all duration-[var(--dur-normal)]
  "
>
  {/* 상단: 레이블 + 진행률 % */}
  <div className="flex items-center justify-between">
    <span className="font-display text-[11px] font-[700] uppercase
                     tracking-[0.06em] text-[var(--t3)]">
      이어하기
    </span>
    <span className="font-body text-[13px] font-[600] text-[var(--p)]">
      {progressPercent}%
    </span>
  </div>

  {/* 제목 — Lora (영어 스크립트 폰트 직접 노출) */}
  <h3 className="font-english text-[20px] font-[600] text-[var(--t1)]
                 leading-tight line-clamp-1">
    {recentText.title}
  </h3>

  {/* 미리보기 (Lora body) */}
  <p className="font-english text-[14px] text-[var(--t2)]
                leading-relaxed line-clamp-2">
    {recentText.preview}
  </p>

  {/* ProgressBar 재사용 (§Extras) */}
  <div className="w-full h-1.5 bg-[var(--bg3)] rounded-[var(--r-full)] overflow-hidden">
    <div
      className="h-full bg-[var(--p)] rounded-[var(--r-full)]
                 transition-[width] duration-[var(--dur-slow)] ease-out"
      style={{ width: `${progressPercent}%` }}
    />
  </div>

  {/* 하단: 메타 + Primary CTA */}
  <div className="flex items-center justify-between mt-2 pt-3 border-t border-[var(--bg3)]">
    <span className="font-body text-[12px] text-[var(--t3)]">
      {relativeTime} · {moduleLabel}
    </span>
    {/* CTA — Primary 버튼 축소 */}
    <span className="
      bg-[var(--p)] text-[var(--ti)]
      font-display text-[13px] font-[600]
      px-4 py-2 rounded-[var(--r-md)]
      group-hover:bg-[var(--p-hover)]
      transition-colors duration-[var(--dur-normal)]
      flex items-center gap-1
    ">
      이어하기
      <span className="group-hover:translate-x-0.5 transition-transform">→</span>
    </span>
  </div>
</a>

/* 빈 상태: "아직 학습한 스크립트이 없어요" + Primary CTA "스크립트 추가" → /text */
```

### 재사용 컴포넌트

| 컴포넌트 | 출처 | 사용 위치 | 비고 |
|----------|------|-----------|------|
| `StatCard` (variant="inline") | §13 | Hero 하단 3분할 | 카드 박스 제거 / 흰색 텍스트 / s2 값 |
| `RecentActivity` | §13 | ④ Reflection | 최근 5개로 제한 권장 |
| `ProgressBar` 패턴 | §Extras | ContinueCard 진행률 | 1.5px 높이 · `--p` 색 |

### 반응형 동작

```
mobile (390px):  Hero(stack: 인사→CTA→Stats 3열) → Module(2열) → Continue → Reflection
tablet (768px):  Hero(좌우 2열 + Stats 3열)       → Module(4열) → Continue → Reflection
desktop (1280px):Hero(좌우 2열 + Stats 3열)       → Module(7열) → Continue → Reflection
```

### 접근성 / UX 원칙

- **F-pattern 시선 정합**: ① 좌상단 인사(s2 시각 닻) → ② 가로 모듈 그리드 → ③ 좌측 이어하기 → ④ 하단 회고 (위→아래·좌→우 자연 흐름)
- **Flow State 진입 보조**:
  - 첫 화면 결정 부담 최소화 — Today CTA 1순위, Continue 2순위, Module 3순위
  - 인사+Streak으로 정서적 진입(`s2` 크기로 자기 효능감 환기)
  - inline Stats는 "성취 가시화" 역할 — 카드 박스 제거로 Hero와 시각 일체
- 모든 카드 터치 타겟 최소 110×110 (44px 기준 충족)
- HubHero CTA 배지는 색상 + 숫자 + 레이블 3중 표현 (색맹 대응)
- ModuleCard는 `<a>` 태그로 prefetch 활용 (Next.js `Link`로 교체 가능)
- 빈 상태: HubHero (review=0) / ContinueCard (스크립트 없음) 모두 정의
- 페이지 폭: `max-w-6xl` (1152px) — Dashboard와 동일 기준

---

## 🛡️ Admin Console — v6.5 신규 섹션

> 플랫폼 운영 전용 영역. 사용자 앱과 라우트·레이아웃·시각 컨텍스트 모두 분리.
> **설계 원칙**: 시각적 구분(보라 액센트) + 명시적 모드 알림 + 한 클릭 사용자 앱 복귀.

### 라우트 구조 — route group 미사용

```
/admin              → 관리자 대시보드 (KPI 4 · 섹션 7 · 최근 활동)
/admin/users        → 사용자 관리 (stub)
/admin/library      → 콘텐츠 관리 (stub)
/admin/curation     → LCP Pipeline v2.0 ★ (실 구현 — 책 큐레이션)
/admin/articles     → ACP Pipeline v1.0 ★ (실 구현 — 짧은 글 큐레이션)
/admin/vocabulary   → 단어장 마스터 (stub)
/admin/vocab/*      → VCB Pipeline ★ (9 페이지 · 실 구현 — 공용 단어장 빌드)
/admin/vrl/*        → VRL Pipeline ★ (6 페이지 · 분류·진단·사용자 V-Level — v06.28 신규)
/admin/analytics    → 플랫폼 분석 (stub)
/admin/reports      → 신고/문의 (mock 6건 + Sidebar 뱃지는 reports.status='open' DB COUNT)
/admin/billing      → 결제/구독 (stub)
/admin/settings     → 시스템 설정 (stub)
```

`(admin)` 라우트 그룹 대신 평문 `/admin/*` 사용 — URL 명시성 + 단일 layout scope.

### 시각 컨텍스트 분리

| 요소 | 사용자 앱 | Admin Console |
|------|-----------|---------------|
| 액센트 | `var(--p)` (#3B82F6) | **#8B5CF6 → #6D28D9** (보라 그라디언트) |
| 로고 아이콘 | `V` (Plus Jakarta) | `ShieldCheck` |
| 사이드바 헤더 | "Vocaflow" | "Vocaflow" + **"Admin"** mono 배지 |
| 알림 박스 | Streak | **"관리자 모드 · 시스템 데이터 접근 중"** |
| 사이드바 하단 | 사용자 프로필 → /settings | **"사용자 앱으로 ← /hub"** |

### AdminSidebar 네비게이션 그룹

```
[ 단독 ]   대시보드 (LayoutDashboard)
[ 사용자 & 콘텐츠 ]   사용자 / 콘텐츠 / LCP Pipeline / ACP Pipeline /
                      단어장 마스터 / VCB Pipeline / VRL Pipeline ⭐NEW
                      — accent: #8B5CF6 (총 7 항목)
[ 운영 ]              플랫폼 분석 / 신고·문의(뱃지) / 결제   — accent: var(--info)
[ 시스템 ]            시스템 설정                            — accent: var(--active)
```

**신고·문의 뱃지** (★v06.28 갱신) — 빨간 카운트, 미처리 건수.
`admin/layout.tsx` Server Component 가 `reports.status='open'` COUNT 를 fetch 하여
AdminSidebar 에 `reportsBadge` prop 으로 주입. 0건일 때 자동 숨김 (정합 보존).
이전 mock `badge: 7` 하드코딩 → DB 실측 연동 완료.

### VRL Pipeline 페이지 (★v06.28 신규)

`/admin/vrl/*` — VRL 분류 시스템 운영 콘솔. VCB (단어장 발행) 와 별개의
어휘 분류·진단·사용자 V-Level 인프라.

| 라우트 | 상태 | 책임 |
|---|---|---|
| `/admin/vrl` | ★ 실 구현 | Dashboard — KPI 4 (의심/진단/사용자/snapshot) + Hero 진행률 + V-Level 12 진행 list |
| `/admin/vrl/taxonomy` | ★ 실 구현 | Levels(12)/Tracks(6)/Domains(8)/Skills(5) read-only · 4 tab |
| `/admin/vrl/concerns` | stub | vrl_data_integrity_concerns cleanup (resolved 필터, type 별 분류) |
| `/admin/vrl/diagnostic` | stub | vrl_diagnostic_tests / questions 시드 + 편집 |
| `/admin/vrl/users` | stub | user_profiles.current_v_level 분포 + 상세 |
| `/admin/vrl/snapshots` | stub | user_level_snapshots chain audit |

**데이터 쿼리**: `apps/web/src/lib/admin/vrl/queries.ts` — `fetchVrlDashboard` / `fetchVrlTaxonomy` 두 함수가 Server Component 진입점에서 한 번에 fetch (revalidate Dashboard 60s / Taxonomy 300s).

**데이터 소스**: `shared_dictionary` · `vocaflow_levels` · `vocaflow_tracks` · `vocaflow_domains` · `vocaflow_skills` · `vrl_data_integrity_concerns` · `vrl_diagnostic_tests/questions` · `user_profiles` · `user_level_snapshots` · `user_diagnostic_results`

### 관리자 대시보드 (`/admin`) 레이아웃

```
┌──────────────────────────────────────────┐
│ [ShieldCheck]  Admin Console             │
│                대시보드                    │
├──────────────────────────────────────────┤
│ KPI ×4 — 총 사용자 / 활성 / 콘텐츠 / 신고  │
├──────────────────────────────────────────┤
│ 관리 섹션 ×7 — 카드 그리드 (3열)          │
├──────────────────────────────────────────┤
│ 최근 활동 — 타임라인 (실시간 마커)         │
└──────────────────────────────────────────┘
```

KPI 카드는 §13 StatCard와 다른 디자인 — delta 변화율 (`▲ 12%`) 강조 + 작은 아이콘 박스. 모듈별 색상 액센트로 빠른 스캔.

### 권한·보안 (Phase 2~3 예정)

- `middleware.ts`에 `/admin/*` RBAC 가드 — Supabase `users.role = 'admin'` 검증
- 관리자 액션은 별도 `audit_logs` 테이블에 기록 (settings 페이지 통합)
- 관리자 전용 로그인 분리 검토 (`/admin/login` — 2FA 필수)

### 접근성 / UX 원칙

- 보라 액센트는 색상 + 형태(ShieldCheck) + 텍스트("Admin") 3중 표현
- "사용자 앱으로" 링크 항상 visible — 컨텍스트 전환 비용 최소화
- 신고 뱃지는 색상 + 숫자 + aria-label 3중 표현 (색맹 대응)
- 모든 stub 페이지는 `components/dev/StubPage`로 통일 — 일관된 검증 경험

---

## 🃏 게임 모듈 — Flashcard

> 독립 레퍼런스: `Flashcard.html` (648줄) — 완전 동작  
> 3-Screen flow: Start(하늘 환경) → Game(카드 flip) → Result

### ① Start Screen — 하늘 환경

```jsx
// src/components/game/FlashcardEnv.tsx

/* 하늘 배경 */
"bg-gradient-to-b from-[#87CEEB] via-[#56CCF2] to-[#1A9898]"

/* 구름 4개: bg-white/78 rounded-[50px] / cloudDrift 18~26s */
/* 잔디 하단: absolute bottom-0 / h-[90px] / #5CE870→#2A9030 / border-radius 50% 50% 0 0 */

/* FLASHCARDS 레인보우 로고 */
/* font-display / clamp(36px,9vw,46px) / 900 / 각 글자 개별 색상 */
F:#ef4444 L:#f97316 A:#eab308 S:#22c55e H:#3b82f6 C:#8b5cf6 A:#ef4444 R:#f97316 D:#eab308 S:#22c55e

/* 시작 버튼 */
/* 단어로: from-[#5B9CF6] via-[#3B82F6] to-[#2563EB] / shadow-[0_5px_0_#1D4ED8] */
/* 뜻으로: from-[#A78BFA] via-[#8B5CF6] to-[#7C3AED] / shadow-[0_5px_0_#5B21B6] */
```

### ② Game Screen — CSS 3D Flip

```jsx
/* perspective: 1200px / transformStyle: preserve-3d */
/* transform: flipped ? rotateY(180deg) : rotateY(0) */
/* transition: .55s cubic-bezier(.4,0,.2,1) */

/* 앞면 (황금 gradient) */
"from-[#FFFDE7] via-[#FFF9C4] to-[#FFF59D]"
/* 단어: Lora / clamp(28px,8vw,36px) / 700 */

/* 뒷면 (초록 gradient) */
"from-[#E8F5E9] via-[#C8E6C9] to-[#A5D6A7]"
/* 뜻: font-display / clamp(18px,5vw,24px) / 700 / #065f46 */
/* 예문: Lora / 13px / italic / bg-white/45 */

/* 정답/오답 버튼 */
/* 알아요:      from-[#22c55e] to-[#16a34a] / shadow-[0_4px_0_#15803d] */
/* 모르겠어요:  from-[#f97316] to-[#ef4444] / shadow-[0_4px_0_#b91c1c] */
```

### 상태 관리

```typescript
type FCMode   = 'word' | 'meaning';   // 단어→뜻 / 뜻→단어
type FCScreen = 'start' | 'game' | 'result';
// SM-2 SRS: 알아요(+) / 모르겠어요(-) → easeFactor/interval 업데이트
// 피드백 chip: 0.7s 후 자동 소멸
```

---

## ⚡ 게임 모듈 — SpellForge

> 독립 레퍼런스: `SpellForge.html` (811줄) — 완전 동작  
> 3-Screen flow: Start → Game(파란 패널) → Result

### ② Game Screen — 파란 패널

```jsx
// src/components/game/SpellForgePanel.tsx

/* 파란 패널 배경 — 게임 전용 하드코딩 */
"bg-gradient-to-br from-[#5CB8E0] via-[#4A9FCF] to-[#3A7FAF]"

/* 뜻 표시 박스: bg-white/97 / rounded-xl */
/* 뜻: Lora / 19px / 600 */

/* 전구 힌트 바 */
/* fill: linear-gradient(90deg, #FFE234, #F59E0B) */
/* bulbGlow: drop-shadow rgba(255,220,0,.3→.7) 2s infinite */

/* 스펠링 셀 */
/* 기본:   w-[50px] h-[54px] / bg-white/92 / JetBrains Mono / 22px / 800 */
/* active: border-3 error / scale(1.06) / ring-4 error/20 */
/* correct:border-[var(--success)] / bg-[var(--success-light)] */
/* hint:   border-[var(--active)] / bg-[var(--active-light)] */

/* 파티클 색상 */
#FFE234 / #F59E0B / #22C55E / #3B82F6 / #8B5CF6
```

### 입력 처리

```typescript
// 자동 제출: typed 길이 === word 길이 → 즉시 checkAnswer()
// 힌트: 점수 -20 / 첫 빈 칸에 정답 글자 삽입
// 숨김 input: opacity:0 / left:-9999px / autocorrect off
```

---

## 🌴 게임 모듈 — WordBlitz

> 독립 레퍼런스: `WordBlitz_Jungle.html` (1,020줄) — 완전 동작  
> 정글 어드벤처 테마 / 3-Screen flow

### 환경 — 정글 배경

```jsx
// src/components/game/WordBlitzGame.tsx

/* 배경: linear-gradient(180deg, #2d6a2d→#5ab540) */
/* 나무 기둥(좌/우): #3d2010→#7a4520 / border: 4px solid #8B5E2A */
/* 크리처 SVG 4종: creatureBob 2.5s ease-in-out infinite */

/* 타이틀: Fredoka One / clamp(48px,8vw,72px) */
/* 색상: #FFE234 / text-shadow: 3px 3px 0 #B8860B, 5px 5px 0 #8B6500 */

/* HUD */
/* bg: rgba(30,60,10,.92) / border: 2px solid #5a9a2a */
/* SCORE/COMBO: #FFE234 + text-shadow */
/* 타이머 바: h-12px / 색상 변화 JS 타이머 */
/* 콤보 점 4개: on=radial-gradient(#ffe234,#f5a623) / off=rgba(0,0,0,.3) */

/* 선택지 버튼 */
/* from-[#3a8a20] via-[#2a6a10] to-[#1a4a08] */
/* border: 3px solid #5ab830 / border-radius: 18px */
/* hover: translateY(-3px) / active: translateY(2px) */
/* correct: correctPop / wrong: wrongShake .38s */
```

### 애니메이션

```css
@keyframes creatureBob  { 0%,100%{transform:translateY(0) rotate(-3deg)} 50%{transform:translateY(-12px) rotate(3deg)} }
@keyframes starSpin     { from{transform:rotate(0)} to{transform:rotate(360deg)} }
@keyframes correctPop   { 0%{transform:scale(1)} 50%{transform:scale(1.08) translateY(-3px)} 100%{transform:scale(1)} }
@keyframes wrongShake   { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 40%{transform:translateX(8px)} 60%{transform:translateX(-5px)} 80%{transform:translateX(5px)} }
@keyframes particleFly  { from{opacity:1;transform:translate(0,0)} to{opacity:0;transform:translate(var(--dx),var(--dy))} }
```

---

## 📝 게임 모듈 — ScriptQuiz

> 독립 레퍼런스: `ScriptQuiz.html` (1,027줄) — 완전 동작  
> Little Fox Quiz UI 스타일 참조 · 3-Screen flow

### ① Start Screen

```jsx
/* QUIZ 로고: gradient text #5BC8F5→#1A7AB8 / drop-shadow / 900 */
/* 스크립트 제목 h2 / 챕터 h3 / 섹션 body-2 타이포 계층 */
/* Start 버튼: bg-[var(--p)] / rounded-[var(--r-full)] / shadow-[0_4px_0_var(--p-dark)] */
```

### ② Question Screen

```jsx
/* HUD 바: bg-[var(--p)] / Time+Score: JetBrains Mono / 22px / 700 */
/* 문제 박스: bg-[var(--bg2)] / border / font-english 18px / 600 */

/* 선택지 5가지 상태 */
idle:     "border-[var(--bd)] bg-[var(--bg)] hover:border-[var(--p)] hover:bg-[var(--p-light)]"
selected: "border-[var(--p)] bg-[var(--p-light)]"
correct:  "border-[var(--success)] bg-[var(--success-light)]"
wrong:    "border-[var(--error)] bg-[var(--error-light)]"
other:    "opacity-45"

/* 정답 체크: 노란 SVG 체크마크 (#FFE234) — Little Fox 스타일 */
/* 오답: ✕ 흰색 / border-error */
```

### ③ O/X 피드백 오버레이

```jsx
/* fixed inset-0 / pointer-events-none / z-50 */
/* 컨테이너: w-[140px] h-[140px] / bg-white/90 / backdrop-blur */
/* O: border-10 solid var(--p) / opacity-60 */
/* X: font-display / 80px / error / opacity-70 */
/* 진입: feedbackPop .3s ease-spring */
/* 소멸: setTimeout 800ms */
```

### ④ Result Screen

```jsx
/* SVG 점수 링: strokeDashoffset 1s var(--ease-out) */
/* 정확도: s2 스케일 (40px/800) / var(--p) */
/* 통계 3칸: success-light / error-light / bg2 */
/* 오답 복습: bg-[var(--active-light)] / border-l-3 var(--active) */
/* 스크립트 근거 하이라이트: Lora italic */
```

### 상태 타입

```typescript
type QuizState  = 'start' | 'question' | 'feedback' | 'result';
type AnswerState = 'idle' | 'selected' | 'answered';

interface QuizQuestion {
  id: string;
  type: 'multiple' | 'truefalse' | 'blank';
  question: string;
  options: { text: string }[];
  correctIndex: number;
  sourceSnippet: string;
  sourceSentenceIdx: number;
}
```

### AI 문제 생성 프롬프트

```typescript
const QUIZ_GENERATION_PROMPT = `
다음 영어 스크립트을 읽고 독해 퀴즈 ${count}개를 생성하세요.

[규칙]
- 문제 유형: multiple(4지선다) 위주, truefalse(OX) 혼합
- 스크립트 내용 근거 문제만 출제 (추론 금지)
- 각 문제에 sourceSnippet(근거 문장) 포함
- 난이도: 내용 이해 70% + 세부 사항 30%
- 한국어로 문제 작성, 선택지 한국어

[출력 — JSON only]
{ "questions": [{ "type":"multiple","question":"...","options":[{"text":"..."}],"correctIndex":0,"sourceSnippet":"..." }] }

[스크립트]
${scriptContent}
`;
```

---

## 📖 WordVault 단어장 컴포넌트

### Hero Header

```jsx
// src/components/wordvault/HeroHeader.tsx

<div className="
  relative overflow-hidden
  bg-gradient-to-br from-[var(--p-dark)] to-[var(--p)]
  px-6 pt-10 pb-14 text-[var(--ti)]
">
  {/* 물결 하단 */}
  <div className="absolute -bottom-10 -left-[10%] w-[120%] h-20
                  bg-[var(--bg2)] rounded-[50%_50%_0_0]" />

  {/* 제목: h1-sm mobile / 800 */}
  <h1 className="font-display text-[26px] font-[800] leading-tight mb-1">
    📖 WordVault
  </h1>
  {/* 부제: body-3 / opacity-85 */}
  <p className="font-body text-[13px] opacity-85">
    스크립트 붙여넣기 → AI 단어 분석 → 단어장 · 플래시카드 · SpellForge · WordBlitz
  </p>
</div>
```

### Word List

```jsx
// src/components/wordvault/WordList.tsx

/* 5열 그리드 */
"grid grid-cols-[44px_1fr_auto_1fr_44px]"

/* 헤더: h-[40px] bg-[var(--bg2)] / font-display 11px / 700 / UPPER */
/* 행: hover:bg-[var(--bg2)] */

/* 단어: Plus Jakarta Sans / 15px / 700 */
/* 품사 배지: DM Sans / 11px / 600 / bg-[var(--bg3)] / rounded-md */
/* 뜻: DM Sans / 13px / 500 / text-[var(--t2)] */
/* 예문: DM Sans / 12px / bg-[var(--bg2)] / border-l-[3px] #C7D2FE */
/* 예문 하이라이트: font-[700] text-[var(--p-dark)] */
```

### SP-Bar (문장 플레이어)

```jsx
// src/components/wordvault/SPBar.tsx

/* 어두운 둥근 바 */
"bg-[#16213e] rounded-[40px] px-3 py-1.5 border border-white/[0.06]"

/* 전체 재생: bg-[var(--p)] / 재생 중: bg-orange-500 */
/* 문장 점: bg-[var(--p)] active / bg-white/10 default */
/* spPulse: box-shadow 0→8px, 0.9s ease-in-out infinite */
```

---

## 🖼 Icons — Lucide React

```bash
pnpm add lucide-react
```

```
네비게이션: Home, BookOpen, CreditCard, Gamepad2, BarChart3
학습:       Play, Pause, SkipForward, SkipBack, Volume2, VolumeX
단어장:     Plus, Trash2, Edit3, Search, Star, BookMarked
게임:       Trophy, Target, Zap, Timer, CheckCircle, XCircle
일반:       Settings, User, LogOut, Moon, Sun, ChevronDown, X, Menu
피드백:     ThumbsUp, ThumbsDown, RefreshCw

크기 규칙:
네비게이션 아이콘:  size={24}
버튼 내 아이콘:    size={20}
인라인 아이콘:     size={16}
대형 표시:        size={32}
색상: currentColor 상속
```

---

## 🗄 Supabase DB 스키마 (v06.22 완전 통합 — 프로젝트 전체 화면·프로세스 정합)

> 이전 §3020 기본 스키마 + §17.7 데이터 축 ALTER + v06.16 PR5 공용 단어장 + Dictation 세션 + PairFlip + Settings/Profile + Daily Activity + Achievements + Reports 정합을 **단일 완전 스키마**로 통합.
> 모든 테이블에 RLS · `user_id`·`updated_at` 트리거 · 인덱스 포함. Phase 1 (현재 mock) vs Phase 2 (예정) 표시.
>
> **15 테이블 + 2 enum** 으로 9개 학습 모듈 + Settings + Dashboard + Admin Console + Library 모든 화면·프로세스 커버.

### 📑 도메인 → DB 매핑 요약

| 도메인 (코드) | DB 테이블 | 핵심 필드 |
|---|---|---|
| `WordItem` (`components/wordvault/types.ts`) | `vocabularies` | word, meaning, example_sentence, cefr_level, FSRS(D/S/R/last/next/history/count) |
| `SrsCard` (`lib/srs/types.ts`) | `vocabularies` (FSRS 컬럼) | difficulty, stability, last_review_at, next_review_at, module_history, review_count |
| `LibraryText` (`types/library.ts`) | `texts` | title, content, cefr_level, source, last_opened, progress_percent |
| `DictationSession` (`lib/dictation/types.ts`) | `dictation_sessions` + `dictation_items` ★Phase 2 | config(JSONB), items, total_accuracy |
| `DictationConfig` | `dictation_sessions.config` (JSONB) | unit, count, order, scoring, cefr, speed, autoRepeat, hintsAllowed |
| `PairFlipResultData` (`components/pairflip/types.ts`) | `scores` + `learning_records` | score, total_pairs, max_combo, hints_used (FSRS rating per pair) |
| `QuizQuestion` (`components/game/scriptquiz/types.ts`) | `quiz_questions` | type, question, options(JSONB), correct_index, source_snippet |
| `ReviewInput/Result` (`lib/srs`) | `learning_records` | rating(1-4), module, is_correct, response_time_ms |
| `UserStats` (`lib/srs/types.ts`) | `user_stats` | mastery_level, total_words, current_streak, fsrs_target_retention |
| `VocabSet` (`components/library/vocab/mock-data.ts`) | `shared_word_sets` + `shared_words` ★v06.16 | category(8종), cefr_level, word_count |
| (구독) | `user_word_set_subscriptions` ★v06.16 | user_id, set_id |
| `Settings` (Settings 페이지) | `user_profiles` ★v06.22 | display_name, theme, locale, tts_voice, daily_word_goal, notify_* |
| Dashboard 28일 sparkline + WeeklyHeatmap | `daily_activity` ★v06.22 | date, total_minutes, total_words, by_module(JSONB) |
| 신기록 배지 (Dashboard "신기록") | `achievements` ★v06.22 | kind, value, achieved_at |
| Admin /admin/reports | `reports` ★v06.22 | kind, status, message |
| `LibraryText.isBookmarked` | `texts.is_bookmarked` ★v06.22 | boolean (인덱스 포함) |
| TextViewer 파일 업로드 | `texts.source_file_path` + Supabase Storage 버킷 ★v06.22 | uploads/{user_id}/{uuid}.pdf |
| Pirate Quest (베타) | `module_id` enum 'pirate-quest' ★v06.22 | scores·learning_records 그대로 사용 |

---

### 1️⃣ 핵심 콘텐츠 테이블

```sql
-- ── ENUM 정의 (TEXT + CHECK 패턴 — Supabase 가이드 권장) ──
-- 학습 모듈 (9 정식 + 베타)
-- learning_records.module / scores.module / vocabularies.module_history[] 공통
DO $$ BEGIN
  CREATE TYPE module_id AS ENUM (
    'flashcard', 'spellforge', 'wordblitz', 'pairflip',
    'scriptquiz', 'dictation', 'wordvault', 'workspace', 'textviewer',
    'pirate-quest'  -- 베타 게임 (v06.5+)
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 텍스트 출처 / Dictation 리소스 source
DO $$ BEGIN
  CREATE TYPE text_source AS ENUM ('library', 'direct-script', 'direct-file', 'shared-set');
EXCEPTION WHEN duplicate_object THEN null; END $$;


-- ────────────────────────────────────────────────
-- 스크립트 (텍스트 자산 — TextViewer 도메인)
-- ────────────────────────────────────────────────
CREATE TABLE texts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  /** source 정합 — DictationResource.source 와 동일 enum */
  source text_source DEFAULT 'direct-script',
  cefr_level TEXT CHECK (cefr_level IN ('A1','A2','B1','B2','C1','C2')),
  /** §17.2 [2] 4단계 상태 */
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('not_started','in_progress','extracted','conquered','completed')),
  /** Workspace 마지막 열람 시각 — 추천 엔진 P2 (lastOpened DESC) */
  last_opened TIMESTAMPTZ,
  /** 듣기/읽기 진행률 0~100 */
  progress_percent NUMERIC(5,2) DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
  /** 한국어 번역 (선택) — Dictation translation */
  translation TEXT,
  /** LibraryText.isBookmarked 매핑 — Library/Workspace 별표 토글 */
  is_bookmarked BOOLEAN DEFAULT false,
  /** TextViewer 파일 업로드 메타 — Supabase Storage 버킷 ref */
  source_file_path TEXT,           -- e.g. 'uploads/{user_id}/{file_uuid}.pdf'
  source_url TEXT,                 -- URL 가져오기 시
  /** 작성자/저자 (Library curation 용) */
  author TEXT,
  /** Cover gradient (UI 캐시) */
  cover_from TEXT,
  cover_to TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_texts_user_lastopened ON texts(user_id, last_opened DESC NULLS LAST);
CREATE INDEX idx_texts_user_status ON texts(user_id, status);
CREATE INDEX idx_texts_user_bookmark ON texts(user_id, is_bookmarked) WHERE is_bookmarked = true;


-- ────────────────────────────────────────────────
-- 단어장 (어휘 자산 — WordVault 도메인)
-- WordItem · SrsCard 통합
-- ────────────────────────────────────────────────
CREATE TABLE vocabularies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  /** 출처 — 1) text_id 있으면 스크립트 추출 / 2) shared_set_id 있으면 공용 / 3) 둘 다 NULL = 직접 입력 */
  text_id UUID REFERENCES texts(id) ON DELETE SET NULL,
  shared_set_id UUID REFERENCES shared_word_sets(id) ON DELETE SET NULL,

  word TEXT NOT NULL,
  meaning TEXT NOT NULL,
  example_sentence TEXT,
  pronunciation TEXT,
  /** 품사 — n. v. adj. adv. ... */
  pos TEXT,
  /** 단어 자체 CEFR (text 와 별개로 단어별 정확도) */
  cefr_level TEXT CHECK (cefr_level IN ('A1','A2','B1','B2','C1','C2')),

  -- ── FSRS 호환 (§17.4 + §17.7) ──
  difficulty REAL DEFAULT 6.0 CHECK (difficulty BETWEEN 1.0 AND 10.0),
  stability REAL DEFAULT 0,
  last_review_at TIMESTAMPTZ,
  next_review_at TIMESTAMPTZ,
  module_history TEXT[] DEFAULT '{}',  -- ModuleId 배열
  review_count INT DEFAULT 0,

  /** 가져오기 출처 — AI 추출 / 공용 세트 / 사용자 직접 입력 */
  origin TEXT DEFAULT 'ai' CHECK (origin IN ('ai','shared_set','imported','manual')),

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- 한 사용자가 같은 단어 중복 등록 방지 (대소문자 무시)
  UNIQUE (user_id, word)
);

CREATE INDEX idx_vocabularies_user_next ON vocabularies(user_id, next_review_at NULLS LAST);
CREATE INDEX idx_vocabularies_text ON vocabularies(text_id);
CREATE INDEX idx_vocabularies_user_cefr ON vocabularies(user_id, cefr_level);
-- ⚠️ memory_state 컬럼 의도적 부재 — R(t) 동적 계산 (§17.2 안티패턴)


-- ────────────────────────────────────────────────
-- 학습 기록 (모든 모듈 공통 — FSRS rating 적재)
-- ────────────────────────────────────────────────
CREATE TABLE learning_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vocabulary_id UUID REFERENCES vocabularies(id) ON DELETE CASCADE,
  /** 9 모듈 enum */
  module module_id NOT NULL,
  is_correct BOOLEAN NOT NULL,
  /** FSRS 4단계 — 1=Again 2=Hard 3=Good 4=Easy */
  rating SMALLINT CHECK (rating BETWEEN 1 AND 4),
  response_time_ms INT,
  /** review 직전 R(t) — 회고용 */
  retrievability_before NUMERIC(4,3),
  /** Stability 변화량 (양수=강화) */
  stability_delta REAL,
  /** 부가 컨텍스트 (예: PairFlip pair_id, ScriptQuiz question_id) */
  metadata JSONB,
  attempted_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_records_user_date ON learning_records(user_id, attempted_at DESC);
CREATE INDEX idx_records_vocab ON learning_records(vocabulary_id, attempted_at DESC);
CREATE INDEX idx_records_user_module ON learning_records(user_id, module);
```

---

### 2️⃣ 게임 점수 / 퀴즈

```sql
-- ────────────────────────────────────────────────
-- 게임 결과 (Flashcard·SpellForge·WordBlitz·PairFlip·ScriptQuiz·Dictation 공통)
-- ────────────────────────────────────────────────
CREATE TABLE scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module module_id NOT NULL,
  text_id UUID REFERENCES texts(id) ON DELETE SET NULL,

  score INT NOT NULL,
  total_questions INT,
  correct_count INT,
  accuracy NUMERIC(5,2) CHECK (accuracy BETWEEN 0 AND 100),
  duration_seconds INT,

  /** 모듈별 부가 메타 — PairFlip(level/maxCombo/hintsUsed) · Dictation(unit/scoring) · WordBlitz(stage) */
  metadata JSONB DEFAULT '{}',

  /** 신기록 여부 — UI 강조용 캐시 */
  is_record BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_scores_user_module_date ON scores(user_id, module, created_at DESC);
CREATE INDEX idx_scores_user_date ON scores(user_id, created_at DESC);


-- ────────────────────────────────────────────────
-- ScriptQuiz AI 생성 문제
-- ────────────────────────────────────────────────
CREATE TABLE quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text_id UUID NOT NULL REFERENCES texts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'multiple' CHECK (type IN ('multiple','truefalse','blank')),
  question TEXT NOT NULL,
  /** [{ text: string }] */
  options JSONB NOT NULL,
  correct_index INT NOT NULL,
  source_snippet TEXT,
  source_sentence_idx INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_quiz_text ON quiz_questions(text_id);
```

---

### 3️⃣ Dictation 세션 (★Phase 2 — 현재 localStorage)

```sql
-- ────────────────────────────────────────────────
-- Dictation 세션 헤더 — DictationSession · DictationConfig 통합
-- ────────────────────────────────────────────────
CREATE TABLE dictation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text_id UUID REFERENCES texts(id) ON DELETE SET NULL,
  resource_title TEXT NOT NULL,

  /** DictationConfig 직렬화 — unit/count/order/scoring/cefr/speed/autoRepeat/hintsAllowed/voice */
  config JSONB NOT NULL,

  current_index INT DEFAULT 0,
  total_accuracy NUMERIC(5,2),
  total_time_ms INT,
  total_hints_used INT DEFAULT 0,

  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_dictation_sessions_user_date ON dictation_sessions(user_id, started_at DESC);


-- ────────────────────────────────────────────────
-- Dictation 문항별 (DictationItem)
-- ────────────────────────────────────────────────
CREATE TABLE dictation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES dictation_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  index INT NOT NULL,
  expected_text TEXT NOT NULL,
  user_input TEXT,
  /** ScoringResult.wordResults[] + errorPatterns[] + accuracy + feedback */
  result JSONB,
  attempt_count INT DEFAULT 0,
  hints_used INT DEFAULT 0,
  time_ms INT,

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_dictation_items_session ON dictation_items(session_id, index);
```

---

### 4️⃣ 공용 단어장 (★v06.16 PR5 — 라이브러리 분리)

```sql
-- ────────────────────────────────────────────────
-- 공용 단어 세트 (관리자 등록)
-- ────────────────────────────────────────────────
CREATE TABLE shared_word_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN (
    'elementary','middle','high','csat','eng_test','civil','business','themed'
  )),
  cefr_level TEXT,
  word_count INT DEFAULT 0,
  is_published BOOLEAN DEFAULT false,
  sort_order INT DEFAULT 0,
  cover_emoji TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_shared_sets_published ON shared_word_sets(is_published, sort_order);
CREATE INDEX idx_shared_sets_category ON shared_word_sets(category);


-- ★v06.25 — dictionary_categories 브릿지 (옵션 A · 최소 외과수술)
-- migration: 20260518130000_shared_word_sets_category_bridge.sql
-- 결정 근거:
--   - dictionary_categories(566 노드 · semantic 단일 체계) 와 shared_word_sets.category
--     (flat 8-enum 'elementary'|'middle'|'high'|...) 가 단절되어 WordVault hub/library
--     필터링이 풍부한 카테고리 트리를 활용 못함.
--   - 기존 dictionary_word_categories 는 이미 FK 정합 100% (orphan 0) — 새 매핑/마스터
--     테이블 추가 X. 다중 분류 체계(purpose/source_ref) 도입은 실제 수요 발생 시점에.
ALTER TABLE shared_word_sets
  ADD COLUMN category_id TEXT REFERENCES dictionary_categories(id) ON DELETE SET NULL,
  ADD COLUMN additional_category_ids TEXT[] NOT NULL DEFAULT '{}';
-- DEPRECATED: 기존 category(text NOT NULL) 는 Phase 2 에서 폐기. UI 는 category_id 우선,
--   fallback 으로 category 사용. 1 row('필수2000') 만 영향 — 적용 후 수동 매핑 필요.
CREATE INDEX idx_sws_category_id ON shared_word_sets(category_id) WHERE category_id IS NOT NULL;
CREATE INDEX idx_sws_additional_cats ON shared_word_sets USING gin(additional_category_ids);


-- 공용 단어 (세트 내 단어들 — 사용자가 구독 시 vocabularies 로 복사 또는 reference)
CREATE TABLE shared_words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id UUID NOT NULL REFERENCES shared_word_sets(id) ON DELETE CASCADE,
  word TEXT NOT NULL,
  meaning_ko TEXT NOT NULL,
  example_en TEXT,
  pronunciation TEXT,
  part_of_speech TEXT,
  cefr_level TEXT CHECK (cefr_level IN ('A1','A2','B1','B2','C1','C2')),
  sort_order INT DEFAULT 0
);

CREATE INDEX idx_shared_words_set ON shared_words(set_id, sort_order);


-- 사용자 구독 (multi-set per user)
CREATE TABLE user_word_set_subscriptions (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  set_id UUID REFERENCES shared_word_sets(id) ON DELETE CASCADE,
  subscribed_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, set_id)
);
```

---

### 5️⃣ 사용자 통계 캐시 (§17.7)

```sql
-- ────────────────────────────────────────────────
-- 사용자 단계 캐시 — Hub 진입 1쿼리로 cold/warm/hot 분기
-- UserStats 1:1 매핑
-- ────────────────────────────────────────────────
CREATE TABLE user_stats (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  /** §17.2 [2] 사용자 상태 */
  mastery_level TEXT DEFAULT 'cold' CHECK (mastery_level IN ('cold','warm','hot')),
  total_words INT DEFAULT 0,
  current_streak INT DEFAULT 0,
  longest_streak INT DEFAULT 0,
  /** FSRS 한국 학습자 초기값 0.85 — review 1,000건 누적 후 fsrs-optimizer 로 자동 재최적화 */
  fsrs_target_retention NUMERIC(3,2) DEFAULT 0.85 CHECK (fsrs_target_retention BETWEEN 0.5 AND 0.99),
  last_studied_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

### 6️⃣ 사용자 프로필 · Settings · 알림 · 신기록

```sql
-- ────────────────────────────────────────────────
-- 사용자 프로필 (auth.users 확장)
-- /settings 화면 + 헤더 아바타 + Sidebar 사용자 영역 데이터
-- ────────────────────────────────────────────────
CREATE TABLE user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  /** 인터페이스 언어 (ko/en) */
  locale TEXT DEFAULT 'ko' CHECK (locale IN ('ko', 'en')),
  /** light/dark/system — Settings 테마 */
  theme TEXT DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
  /** TTS voice 지정 — Settings TTS 영역 */
  tts_voice TEXT,
  tts_speed NUMERIC(3,2) DEFAULT 1.0,
  /** 일일 학습 목표 (단어 수) — KPI "오늘 학습" 진행률 */
  daily_word_goal INT DEFAULT 30,
  /** 알림 채널 */
  notify_email BOOLEAN DEFAULT true,
  notify_push BOOLEAN DEFAULT false,
  /** Streak 위급 알림 */
  notify_streak_risk BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);


-- ────────────────────────────────────────────────
-- 일별 학습 활동 (Dashboard 28일 sparkline + WeeklyHeatmap 정밀 집계)
-- learning_records 으로 derive 가능하지만 매번 GROUP BY 비용 회피
-- 매 review 후 트리거 또는 cron job 으로 일 단위 upsert
-- ────────────────────────────────────────────────
CREATE TABLE daily_activity (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  /** 활동일 (UTC 자정 기준) */
  date DATE NOT NULL,
  total_minutes INT DEFAULT 0,
  total_words INT DEFAULT 0,
  total_reviews INT DEFAULT 0,
  /** 모듈별 review 카운트 — JSONB { flashcard: 12, spellforge: 5, ... } */
  by_module JSONB DEFAULT '{}',
  /** 정확도 평균 0~100 */
  avg_accuracy NUMERIC(5,2),
  PRIMARY KEY (user_id, date)
);

CREATE INDEX idx_daily_activity_user_date ON daily_activity(user_id, date DESC);


-- ────────────────────────────────────────────────
-- 신기록·마일스톤 (Dashboard "신기록" 배지 + Streak 트로피)
-- ────────────────────────────────────────────────
CREATE TABLE achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  /** 신기록 종류 — best_score / streak_milestone / total_words / first_complete 등 */
  kind TEXT NOT NULL CHECK (kind IN (
    'best_score', 'streak_milestone', 'total_words_milestone',
    'first_module_complete', 'text_conquered', 'perfect_session'
  )),
  /** 모듈 컨텍스트 (옵션) */
  module module_id,
  /** 값 (점수, 일수, 단어 수 등) */
  value INT,
  /** 부가 컨텍스트 (텍스트 ID 등) */
  metadata JSONB,
  achieved_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_achievements_user_date ON achievements(user_id, achieved_at DESC);


-- ────────────────────────────────────────────────
-- 사용자 신고/문의 (Admin Console /admin/reports)
-- ────────────────────────────────────────────────
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('bug', 'content', 'feature', 'other')),
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  /** 관련 자원 (옵션) */
  text_id UUID REFERENCES texts(id) ON DELETE SET NULL,
  vocabulary_id UUID REFERENCES vocabularies(id) ON DELETE SET NULL,
  /** 처리 상태 */
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_reports_status_date ON reports(status, created_at DESC);
```

---

### 7️⃣ 트리거 + RLS

```sql
-- ────────────────────────────────────────────────
-- updated_at 자동 갱신 트리거
-- ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_texts_updated         BEFORE UPDATE ON texts         FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_vocabularies_updated  BEFORE UPDATE ON vocabularies  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_user_stats_updated    BEFORE UPDATE ON user_stats    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_user_profiles_updated BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ────────────────────────────────────────────────
-- RLS — 모든 테이블
-- ────────────────────────────────────────────────
ALTER TABLE texts                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE vocabularies                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_records             ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions               ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE dictation_sessions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE dictation_items              ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles                ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_activity               ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_word_sets             ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_words                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_word_set_subscriptions  ENABLE ROW LEVEL SECURITY;

-- 사용자 데이터 — 본인만 SELECT/INSERT/UPDATE/DELETE
CREATE POLICY "own data" ON texts                       FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own data" ON vocabularies                FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own data" ON learning_records            FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own data" ON quiz_questions              FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own data" ON scores                      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own data" ON dictation_sessions          FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own data" ON dictation_items             FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own data" ON user_stats                  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own data" ON user_profiles               FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own data" ON daily_activity              FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own data" ON achievements                FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- reports: 본인 작성만 SELECT/INSERT 가능, UPDATE 는 admin role 만 (Phase 2 admin 정책)
CREATE POLICY "own reports SELECT" ON reports     FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own reports INSERT" ON reports     FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own subs"  ON user_word_set_subscriptions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 공용 자원 — 게시된 것만 모든 인증 사용자 SELECT 가능
CREATE POLICY "read published" ON shared_word_sets FOR SELECT USING (is_published = true);
CREATE POLICY "read words of published" ON shared_words FOR SELECT USING (
  set_id IN (SELECT id FROM shared_word_sets WHERE is_published = true)
);
-- 관리자만 shared_* 에 INSERT/UPDATE — 별도 admin role 정책 (Phase 2)
```

---

### 7️⃣ TypeScript 타입 ↔ DB 컬럼 정합 헬퍼

```typescript
// apps/web/src/types/database.ts (자동 생성 — supabase gen types)
// 위 SQL 과 1:1 대응. WordItem · SrsCard · DictationConfig 등은 위 테이블에서 derived.

// 변환 헬퍼 위치:
// - lib/srs/state.ts          — Vocabulary row → SrsCard
// - lib/dictation/storage.ts  — DB ↔ DictationSession (Phase 2 마이그레이션)
// - lib/wordvault/mastery.ts  — module_history → MasteryStage
// - lib/text-viewer/handoff.ts — extracted words → vocabularies (sessionStorage)
```

---

### 📋 마이그레이션 순서 (Phase 2 진행 시)

| # | 마이그레이션 | 의존성 |
|---|---|---|
| 1 | `01_enums.sql` — module_id (10 모듈 · pairflip 포함) · text_source ENUM | — |
| 2 | `02_init_schema.sql` — texts·vocabularies·learning_records·quiz_questions·scores | auth.users · 01 |
| 3 | `03_fsrs_columns.sql` — vocabularies FSRS 6컬럼 + texts 진척 + learning_records.rating + metadata JSONB | 02 |
| 4 | `04_user_stats_profiles.sql` — user_stats + user_profiles | auth.users |
| 5 | `05_shared_word_sets.sql` — shared_word_sets·shared_words·subscriptions + 공개 정책 | auth.users |
| 6 | `06_dictation_sessions.sql` — dictation_sessions·dictation_items | 02 |
| 7 | `07_daily_activity.sql` — daily_activity (Dashboard 집계) | auth.users |
| 8 | `08_achievements_reports.sql` — achievements·reports | auth.users · 02 |
| 9 | `09_unique_user_word.sql` — vocabularies UNIQUE(user_id, word) | 02 |
| 10 | `10_indices.sql` — 모든 인덱스 일괄 | 01-09 |
| 11 | `11_triggers.sql` — set_updated_at + RLS 정책 | 02-08 |

> ⚠️ **현재 상태 (v06.22)**: 모두 mock/localStorage. 위 스키마는 **Phase 2 Supabase 연동 시 적용** 예정.
> Phase 1 호환성: TS 도메인 타입은 위 스키마 컬럼명과 정합 — DB 연동 시 wrapper 함수만 추가.

---

### 🚫 절대 저장하지 말아야 할 것 (안티패턴)

- **`memory_state`** 컬럼 — Memory Decay 4색은 R(t) 동적 계산만 (§17.2)
- **`mastery_progress` 컬럼** (5단계) — UI 표시용 derived. learning_records 누적으로 계산
- **`last_days` / `next_days` 컬럼** (정수) — Date 차이로 derived
- **암호화되지 않은 Claude API 키 (`ANTHROPIC_API_KEY`) / 사용자 비밀번호** (Supabase Vault 사용)
- **`module_history` 를 정규화** — TEXT[] 그대로 유지 (cardinality 작음, JOIN 비용 회피)

---

### 영단어 마스터 사전 시스템 (v06.23 신설 · v06.24 한국어 뜻 100% 완성 · v06.26 Phase 1 스키마 확장 · v06.27 Phase 2 ETL 적용)

> **문서 버전: v06.27 Phase 2** (Lexicon Unification — Data Backfill 적용). Migration `20260521153559 lexicon_phase2_backfill` + `20260521154526 lexicon_phase2_step2b_remediate` 적용 완료. **결과**: `shared_dictionary` 38,476 → 38,542 row (kice-orphan 66 신규). 모든 row `senses`/`primary_pos`/`pos_set` **100%** 채움. `lexicon_frequencies` 6,305 신규 row (Step 6 wfs migration + Step 7 csat-prep-core-2k 1,839 + ext-1.8k 1,097). `shared_words.lemma` 3,399 / `vocabularies.lemma` 1,228 backfill. 적용 과정 fix commits 4개 — (1) `9d48b01` Step 0 source CHECK 'kice-orphan' 추가 / (2) `b709cc9` Step 1 assertion `<> 12976` → `<> 0` (pos hygiene + P5 ts-track 후 unknown=0 반영) / (3) `c43726a` Step 6+Final lf 임계값 정정 (8,000 → 6,000, orphan wl 1,654 의 wfs 영구 제외 반영) / (4) `db0c185` Step 2-B 버그 remediation — `meanings_ko` 가 plain-string 배열인 780 row 에서 `m || jsonb_build_object` 의 JSONB `||` semantic 으로 `senses[i] = ["str", {sense_idx:0}]` 변형 → 표준 sense object 로 재포장 + pos_set 재계산. **잔존 정찰** — kice-orphan 66 row meta 결손(upstream wl 결손, 후속 enrichment 대상) + sw.lemma 88 / vocab.lemma 31 OOV (Phase 3 surface_index MV 해결 예정). **v06.26 Phase 1 (선행)**: `shared_dictionary` 11개 통합 컬럼 추가 (`senses` JSONB, `primary_pos`, `pos_set`, `ipa_uk/us`, `cefr_confidence`, `domain_tags`, `frequency_score`, `frequency_band`, `verified_by/at`). `lexicon_frequencies` 사이드카 신설 — KICE + WM + EBS + NGSL + AWL + COCA 다중 출처 지원. `vocabularies`·`shared_words`·`library_book_vocabularies`·`library_article_vocabularies` 에 `lemma TEXT REFERENCES shared_dictionary(word)` 추가. `vocab_seed_candidates`·`vocab_enrichment_queue`·`vocab_dict_hits` 에 `lemma_normalized` 추가. `word_lexicon` INSERT 차단 트리거 (`trg_word_lexicon_freeze`) 설치 — 5,421 row 보존 + Phase E DROP 예정. Migration `20260520_120000_lexicon_phase1_expand.sql` 적용 완료. Playwright 1.60 + chromium-headless-shell + e2e 3종 (Browse/Flashcard/Curation) `baseline-pre-phase2` 측정 완료 (5 PASS / 2 FAIL / 0 SKIPPED — FAIL은 selector/mock 데이터 이슈로 Phase 4 시점 자연 해결 예상). 자세한 내용은 `docs/proposals/lexicon-unification/` 참고.

#### shared_dictionary — 영단어 마스터 캐시

시스템 캐시 테이블. 사용자에게 직접 노출 X. 21,740 시드 단어 + 운영 시 자연 누적.

**현재 상태**: 21,740/21,740 = **100%** meaning_ko 채움 완료 (v06.24 · 37 batch 세션). 모든 CEFR 레벨(A1~C2) 100%, NONE(품사 메타 10건) 100%. 추가 단어가 미스로 들어오면 Claude API → 캐시 누적.

| 컬럼 | 타입 | 용도 |
|------|------|------|
| `word` | TEXT PRIMARY KEY | 소문자 정규화 단어 |
| `meaning_ko` | TEXT | 한국어 뜻 (★v06.24 21,740 단어 100% 채움 — 자연스러운 현대 한국어, 다의어 분리, 사용 주의 어휘 명시, 한국 사자성어/속담 매핑) |
| `meanings_ko` | JSONB | 품사별 다의 구조 `[{ pos, meaning }, ...]` |
| `pos` / `pos_all` | TEXT / TEXT[] | 대표 품사 / 모든 가능 품사 |
| `cefr_level` | TEXT | A1~C2 |
| `frequency_rank` | INT NULL | COCA 등 빈도 순위 |
| `example_en` / `synonyms` / `antonyms` | TEXT / TEXT[] | 보조 정보 |
| `source` | TEXT | 'imported' / 'manual' / 'ai-generated' 등 7종 |
| `verified` | BOOLEAN | 사람 검증 여부 (현재 false — 사람 검증 단계 미수행) |

데이터 흐름:

```
사용자 텍스트 → 토큰화 → shared_dictionary 조회
  → 히트(현재 시드 21,740 단어 + 누적 100%): 즉시 반환 (~50ms)
  → 미스(시드 외 신규 단어):     Claude API → 캐시 누적 (source='ai-generated')
```

운영 시 AI 호출 비용 80~95% 절감 예상 (시드 기반 캐시 히트율).

#### dictionary_categories — 3계층 카테고리 트리

566 노드 (H1: 18 / H2: 76 / H3: 472).

| 컬럼 | 타입 | 용도 |
|------|------|------|
| `id` | TEXT PRIMARY KEY | slug ('people-personal-qualities-brave') |
| `name_en` / `name_ko` | TEXT / TEXT NULL | 영문명 / 한국어 (Phase 4-5) |
| `level` | INT | 1/2/3 (계층 깊이) |
| `parent_id` | TEXT | 자기참조 FK |
| `sort_order` / `cover_emoji` | INT / TEXT | 표시·정렬 |
| `word_count` | INT | 통계 캐시 (Phase 2 트리거) |

활용:
- 토픽별 단어 학습 ("Brave" 카테고리 모든 단어)
- CEFR + Topic 교차 필터 ("B1 + Travel")
- Dual Coding 의미망 학습

헬퍼 함수: `get_category_path(cat_id)` — 재귀 풀패스 반환 (예: `['People', 'Personal qualities', 'Brave']`)

#### dictionary_word_categories — 단어↔카테고리 M:N

28,124 매핑. 한 단어가 여러 카테고리에 속함 (다의어 대응).

| 컬럼 | 타입 | 용도 |
|------|------|------|
| `word`, `category_id` | TEXT, TEXT | 복합 PK + FK |
| `pos_in_context` | TEXT | 카테고리에서의 품사 |
| `cefr_in_context` | TEXT | 카테고리에서의 CEFR |
| `rank_in_category` | INT NULL | 카테고리 내 순위 |
| `source` | TEXT | 'imported' / 'manual' / 'ai-suggested' |

#### Import 인프라

- `data/import/dictionary-seed.db` — 외부 시드 SQLite (.gitignore)
- `scripts/seed-dictionary.mjs` — 멱등 batch upsert (ON CONFLICT DO NOTHING)
- 재실행 안전, `--dry-run` 지원

#### RLS 정책

- 모든 인증 사용자 SELECT 가능 (캐시는 공유)
- INSERT/UPDATE 는 service_role 만 (서버 API 라우트에서만)
- 클라이언트 직접 INSERT 차단됨

---

### 라이브러리 도서 난이도 지수 (v06.29 신설 — 4축 정책)

> 라이브러리 도서는 **4축 난이도 지수**로 분류한다. 단일 지수 의존 X — 어휘/문법/표준 정합/통사 4 차원이 독립적으로 책의 다른 측면을 잡아낸다.
> Migration `phase3_cefrj_multi_source_v1` + `phase3_four_axis_difficulty_v1` 적용 (2026-05-25).

#### Tier 1 (MVP · 현재 적용)

| 축 | 컬럼 | 출처 | 의미 |
|---|---|---|---|
| **V-Level Centroid** | `library_books.book_v_level` (smallint) + `v_level_centroid_precise` (numeric) + `vrl_components` (jsonb) | Vocaflow 자체 (`compute_book_vrl`) — `library_book_vocabularies.lemma → shared_dictionary.v_level` p75 centroid (V11 excluded) | 한국 학습자 어휘 부담 |
| **CEFR 6-band** | `library_books.cefr_band` (generated stored, A1~C2) | `cefrj_level` (12-band) 에서 자동 파생 | LibraryCard 메인 표시 |
| **CEFR-J 4-band** | `shared_dictionary.cefrj_wordlist_band` (A1/A2/B1/B2) + `cefrj_domain_tags` (text[]) | 외부 CEFR-J Wordlist v1.6 (7,035 unique lemma · 6,098 매칭 · 86.7%) | 단어 단위 외부 학술 표준 |
| **Flesch-Kincaid** | `library_books.flesch_kincaid_grade` (numeric 0-20) + `flesch_reading_ease` (numeric -50~130) + `readability_computed_at` | `scripts/book-readability.mjs` — chapters_master.sentence_offsets + first_sentence 코퍼스 | 통사 복잡도 보조 |

산정 위치 (단일 출처):
- `compute_book_vrl(book_id)` — V-Level Centroid + p50/p75/p90
- `compute_book_cefrj(book_id)` — V-Level p75 → CEFR-J 12-band → cefr_band 자동 파생
- `scripts/book-readability.mjs` — F-K 2종
- `scripts/cefrj-import.mjs` — CEFR-J Wordlist v1.6 staging upsert + UPDATE shared_dictionary

#### CEFR-J Wordlist 외부 정합 (v06.29 적재 결과)

- 7,988 entries (ALL_sep) → normalize → 7,035 unique lemma
- shared_dictionary 매칭: 6,098/7,035 = **86.7%** (미매칭 937 은 contraction·복합어·고유명사)
- 적재 분포: A1=1,023 · A2=1,194 · B1=1,931 · B2=1,950
- **V-Level ↔ CEFR-J 정합 매트릭스** (V-Level 시스템 외부 학술 검증):
  - V1 → A1 dominant (545/714 = 76%)
  - V2 → A1+A2 dominant (595/786 = 76%)
  - V4 → A2+B1 dominant (518/648 = 80%)
  - V6 → B1+B2 dominant (957/1,044 = 92%)
  - V7 → B2 dominant (429/676 = 63%)
  - V8~V11 → B2 only (wordlist 가 B2 까지만 커버)
- → V-Level 시스템이 CEFR-J 4-band 표준과 **monotonic 정합** 확인.

#### CEFR-J 12-band 매핑 (internal heuristic — Wordlist 가 보증 X)

`vrl_components.p75 → cefrj_level` 매핑은 **Vocaflow 자체 휴리스틱**이며 CEFR-J 공식 표준이 보증하지 않는다 (Wordlist v1.6 은 4-band 만 제공 · 12-band 는 Text Profile/CVLA 도구 영역). 도서 단위 라벨링 편의용:

```
p75=1→PreA1, 2→A1.2, 3→A1.3, 4→A2.1, 5→A2.2, 6→B1.1,
7→B1.2, 8→B2.1, 9→B2.2, 10→C1, 11→C2
```

12-band → 6-band 축약은 `cefr_band` generated column 이 자동 처리 (`A1*`/`PreA1` → A1, `A2*` → A2, …).

#### 소스별 신뢰도 (Source-Aware Confidence)

`cefrj_confidence` 는 base tier × coverage 보정. `library_source_catalogs.cefrj_auto_assign_tier` (S/A/B/C/M) 가 영구 저장:

| Tier | Source | base conf | 검수 정책 |
|---|---|---|---|
| **S** | standard_ebooks · openstax · voa_learning | 0.90~0.95 | auto-publish + spot-check 10% |
| **A** | wikibooks · wikisource | 0.80~0.85 | sample review 30% |
| **B** | gutenberg · librivox | 0.65~0.70 | full review |
| **C** | open_library · hathitrust | 0.50~0.60 | OCR cleanup + full review |
| **M** | manual | 1.00 | admin self-verify |

coverage 보정: `lemma_coverage_pct >= 90` → 0 / 80% → −0.05 / 70% → −0.10 / 미만 → −0.20. 최종 clamp [0.30, 1.00].

#### 5권 실측 (v06.29 backfill)

| Title | V | Centroid | CEFR-6 | CEFR-J 12 | F-K Grade | F-K Ease |
|---|---|---|---|---|---|---|
| Alice's Adventures | 6 | 3.63 | B1 | B1.1 | 10.54 | 69.7 |
| Frankenstein | 8 | 4.90 | B2 | B2.1 | 10.74 | 61.2 |
| Pride and Prejudice | 8 | 4.56 | B2 | B2.1 | 12.44 | 54.9 |
| Sherlock Holmes | 8 | 4.61 | B2 | B2.1 | 9.03 | 70.1 |
| Dorian Gray | 8 | 4.60 | B2 | B2.1 | 6.22 | 76.6 |

→ V-Level 과 F-K 가 **서로 다른 차원**을 잡는 것 확인 (Dorian Gray 어휘 B2 / 문장 6학년 수준 · Pride and Prejudice 어휘 B2 / 문장 12학년 수준).

#### Tier 2 (Phase 2 검토 — 베타 데이터 누적 후 결정)

- Spache Readability — V0-V3 초등 도서 정밀도 보강 후보
- ARI / Coleman-Liau — F-K 음절 추정 부정확 시 보조축
- 도입 트리거: 사용자 perceived difficulty 베타 설문 (30명) 으로 4축 정합도 측정 후

#### Tier 3 (Phase 3 학술 보강 — B2B 진입 시)

- Lexile · ATOS — 학교/학원 B2B (라이선스 비용 발생)
- Coh-Metrix — 50+ 학술 지표

#### LibraryCard 표시 정책 (Progressive Disclosure)

- **메인** (always): `cefr_band` + `book_v_level` 2개만 (예: `B2 · V6`)
- **detail 화면**: V-Level Centroid 소수점 + F-K Grade + lemma_coverage_pct + cefr_confidence

#### Citation 의무

CEFR-J Wordlist v1.6 사용 시 다음 표기 필수 (라이선스 조건):

> The CEFR-J Wordlist Version 1.6. Compiled by Yukio Tono, Tokyo University of Foreign Studies.

위치: Library detail 페이지 footer (Phase 2 UI) + 본 CLAUDE.md 섹션.

#### 산출물 (`data/import/cefrj/`)

| 파일 | 용도 |
|---|---|
| `CEFR-J Wordlist Ver1.6.xlsx` (1MB) | 원본 시드 — `.gitignore` 권장 |
| `cefrj_wordlist_v1.6_normalized.jsonl` | 정규화 결과 (7,035 lemma) |
| `batch_01~05.sql` | 1회용 (현재는 `scripts/cefrj-import.mjs` 사용) |

#### 안티패턴 (절대 금지)

- 단일 지수 의존 (V-Level 만 / CEFR 만 / F-K 만) — 한 차원만 보면 다른 차원 놓침
- `cefrj_level` 12-band 를 CEFR-J 공식 표준으로 표기 — Wordlist 는 4-band 만 보증 (`cefrj_wordlist_band` 는 안전, `cefrj_level` 은 internal 임을 명시)
- LibraryCard 메인에 F-K 노출 — 학습자 인지부담 (detail 한정)
- 검수 강도 평준화 — Tier 별 차등 검수 정책 유지 (Tier S 자동 publish OK · Tier B/C 는 full review)

---

## 📦 독립 레퍼런스 HTML 파일

> 완전 동작 프로토타입 — React 구현 시 CSS 변수명·클래스 구조·애니메이션·로직 기준으로 사용.  
> 모든 파일: `data-theme="dark"` 완전 지원 · 4종 폰트 역할별 적용 · 3-Screen flow

| 파일 | 줄수 | 핵심 구현 |
|------|------|-----------|
| `Flashcard.html` | 648줄 | 하늘환경·구름·잔디·레인보우로고·CSS 3D flip·양방향모드 |
| `SpellForge.html` | 811줄 | 파란패널·전구힌트바·JetBrains Mono 셀·파티클·자동입력 |
| `ScriptQuiz.html` | 1,027줄 | Little Fox 스타일·O/X 피드백·스크립트 하이라이트·SVG 링 |
| `WordBlitz_Jungle.html` | 1,020줄 | 정글테마·SVG 크리처 4종·Fredoka One·파티클·콤보 |

> **참고**: 레퍼런스 HTML 파일 내 `CLAUDE_v4.md` 등 구버전 언급은 모두 `CLAUDE.md`로 간주할 것

---

## 🎮 게임 모듈 요약

| 모듈 | 테마 | 폰트 포인트 | 핵심 컬러 | 레퍼런스 |
|------|------|-------------|-----------|---------|
| Flashcard | 하늘·구름·잔디 | Lora (단어) | 황금→초록 카드 | `Flashcard.html` |
| SpellForge | 파란 패널 | JetBrains Mono (셀) | #4A9FCF 패널 | `SpellForge.html` |
| WordBlitz | 정글 어드벤처 | Fredoka One (타이틀) | #3d8a3d + #FFE234 | `WordBlitz_Jungle.html` |
| **PairFlip** | **Editorial 네이비/골드/크림** | **Plus Jakarta + Lora 혼합** | **#1E3A8A → #1E1B4B + #F59E0B** | **React 직접 구현 (v06.21)** |
| ScriptQuiz | 화이트 + 파란 HUD | Lora (문제·선택지) | var(--p) HUD | `ScriptQuiz.html` |

---

## 🚫 절대 하지 않을 것

- Inter · Roboto · Arial 사용
- `--color-primary` 등 v5 롱폼 변수 사용 (v6 이후 `--p` 축약형만)
- 보라색 그라디언트 배경
- Quizlet 로고·아이콘·브랜드색(#4255FF teal) 그대로 복사
- 학습 중 화면 광고 배치
- 애니메이션 없는 상태 전환
- 44px 미만 터치 타겟
- placeholder만으로 레이블 대체
- 색상만으로 정보 전달 (접근성 위반)
- 웹 전용 또는 앱 전용 단방향 설계
- Parts Kit v01~v05 기준으로 코드 작성

---

## ✅ 항상 지킬 것

- 모든 인터랙티브 요소에 hover + active + focus + disabled 4상태 구현
- 모든 카드·버튼에 transition 적용 (`--dur-normal`, `--ease`)
- 정답/오답 피드백: 색상 + 아이콘 + 애니메이션 3중 피드백
- 모바일 퍼스트 → 데스크톱 확장 (390 → 768 → 1280)
- 공통 컴포넌트 `components/ui/` 재사용 우선
- CSS Variables(`--p`, `--bg`, `--t1` 등) 로 테마 제어 — 하드코딩 금지 (게임 전용 예외 제외)
- `data-theme="dark"` 모든 컴포넌트 대응 필수
- 이미지 대신 Lucide 아이콘 우선
- RN 컴포넌트: `minHeight: 44, minWidth: 44` 터치 타겟 필수
- 파일 첫 줄에 경로 주석 필수 (`// src/components/ui/Button.tsx`)
- 코드는 완성형만 — TODO·생략·placeholder 절대 금지

---

## 📋 Parts Kit v06 섹션 구성

```
01 Typography       — 4종 폰트 · Desktop/Mobile 8단계 스케일
02 Colors           — CSS Variables (--p 축약형) · 다크모드 · 게임 예외
03 Tokens           — Spacing · Shadow · Radius · Motion
04 Buttons          — 8종 변형 · 3크기 · RN StyleSheet 포함
05 Selectors        — Radio · Checkbox(indeterminate) · Toggle
06 Form Fields      — 6가지 상태 · Alt Form
07 Dropdowns        — Select · Popover · Bottom Sheet
08 Tooltips         — 4방향 · 4색 변형
09 Extras           — Progress · Toast · Modal · Audio · Icons · Loading
10 Game UI          — Flashcard · SpellForge · WordBlitz · ScriptQuiz · Score
11 WordVault       — WordVault 단어장 전용 컴포넌트 (Hero · TTS · SP-Bar · WordList 등)
12 ScriptQuiz       — 3-screen flow · 선택지 5상태 · O/X 피드백
13 Dashboard        — StatCard · WeeklyHeatmap · AccuracyRing · ScoreTrend · Activity
14 Home Hub          — HubHero · ModuleCard · ContinueCard / 4영역(Hero·Module·Continue·Reflection) · StatCard inline · F-pattern · Flow State
15 Admin Console     — 8 라우트(/admin/*) · AdminSidebar(보라 액센트) · 관리자 대시보드(KPI·섹션·활동) · components/admin · components/dev/StubPage
16 Dictation        — 받아쓰기 모듈 · 4 라우트(/dictate/*) · CEFR A1~C2 자동 감지 · 단위 3(문장/단락/전체) · Smart/Strict 채점 · 4단계 힌트 · 6개 오류 패턴 · TTS · Focus Mode · Spaced Dictation
17 Learning Model ★v06.9 — 학습 모델 v3.0 (9계층: L0~L4a/b/c/d~L5) · L2.5 Bridge 폐지 · L4 인지 부하 4단계 분리(재인/시각생성/청각생성/통합검증) · Dictation L4c 정착 · 7원칙×9계층 매트릭스 · 체크리스트 갱신
18 PairFlip ★v06.21 — L4a Recognize 4번째 · 짝맞추기 카드 · 5단계 (8~20장, 모든 레벨 2줄) · Editorial 네이비/골드/크림 · 3D flip + O/X 코너 배지 + 매칭 카드 영구 유지 · FSRS rating 통합 · SessionFrame 자동 셸
19 Layout & Navigation ★v06.16~22 — Sidebar config (5그룹·META·FOOTER·햄버거 토글) · LibraryTabs (스크립트/단어장 분리) · SessionFrame v2 2-row stack (모듈 + 리소스 브레드크럼) · ResourceContext wrapper (Server Component 페이지) · isFullScreenRoute (Sidebar+FlowNav 공유 자동 숨김) · 풀팝업 정책 8라우트 ((main) 5 + (app) 2 + WordVault Browse 1)
20 WordVault Browse ★v06.22 — 풀스크린 세션 (`/wordvault/browse`) · ScriptsChipNav (전체+스크립트별 단어 수 인디고 칩) · ListenPanel 설정 항상 노출 · WordRow v4 (16px 컴팩트 + 예문 우측 정렬 + 펼침 메커니즘 X + 메타 X) · HideToggleBar Active Recall 만 (전체 예문 펼치기 버튼 제거) · 워크스페이스 접근 용이성
00 Philosophy        — 디자인 철학 4(Calm/Progressive/Empathetic/Implicit) · 학습 과학 7(Recall·SR·Difficulty·Dual·Context·Load·Emotion) · Memory Decay 4단계 · Flow State 5조건 · 안티패턴
```

---

*CLAUDE.md — Vocaflow Design System · Single Source of Truth*  
*변경 이력: **v06.27** Lexicon Unification Phase 2 ETL 적용 — Migrations `20260521153559 lexicon_phase2_backfill` + `20260521154526 lexicon_phase2_step2b_remediate`. shared_dictionary 38,476 → 38,542 (kice-orphan 66 신규). senses/primary_pos/pos_set 100% 채움. lexicon_frequencies 6,305 신규. shared_words.lemma 3,399 / vocabularies.lemma 1,228 backfill. Fix commits 4 — Step 0 source CHECK, Step 1 unknown assertion, Step 6/Final lf 임계값, Step 2-B plain-string-array 변형 remediation. 잔존: kice-orphan meta 결손 + lemma OOV (Phase 3 해결 예정) / **v06.26** Lexicon Unification Phase 1 — Migration `20260520_120000_lexicon_phase1_expand.sql`. shared_dictionary 11개 통합 컬럼(senses JSONB · primary_pos · pos_set · ipa_uk/us · cefr_confidence · domain_tags · frequency_score · frequency_band · verified_by/at). lexicon_frequencies 사이드카(KICE+WM+EBS+NGSL+AWL+COCA). vocabularies/shared_words/library_*에 lemma REFERENCES shared_dictionary(word). vocab_seed_candidates/queue/dict_hits에 lemma_normalized. word_lexicon freeze trigger(trg_word_lexicon_freeze) 5,421 row 보존 + Phase E DROP 예정. Playwright 1.60 + chromium-headless-shell + e2e 3종 baseline-pre-phase2 (5 PASS / 2 FAIL) / **v06.25** `shared_word_sets` ↔ `dictionary_categories` 브릿지 — 최소 외과수술 (옵션 A 채택) / 정찰 결과 — 기존 분석의 5가지 전제 중 3건 phantom (dictionary_categories 566 노드 + dictionary_word_categories 28,124 매핑 + FK orphan 0 모두 이미 정합) / 진짜 gap 1건만 — shared_word_sets.category(free-text 8-enum 'elementary'|'middle'|'high'|...) 와 dictionary_categories 트리 단절 / 1건 컬럼명 오류 — VCB 연결은 source_run_id 이미 존재 (vocab_collection_id 아님) / 적용 — migration `20260518130000_shared_word_sets_category_bridge.sql` 단일 파일: ALTER 만 (category_id TEXT REFERENCES dictionary_categories(id) ON DELETE SET NULL + additional_category_ids TEXT[] DEFAULT '{}') + 부분 인덱스 (category_id IS NOT NULL) + gin (additional_category_ids) / 기존 category 컬럼 보존 + COMMENT 'DEPRECATED' 표기 — Phase 2 폐기 예정 / 결정 — 새 마스터 테이블/taxonomy 컬럼/vocab_collection_id 컬럼 추가 X (정찰로 불필요 확인) / 사용자 액션 — 마이그레이션 수동 적용 + 1 row('필수2000') 의 category_id 수동 매핑 (semantic 트리 'high' 직접 대응 X 이므로 적절한 H1 선택) + supabase gen types 재생성 / 거버넌스 — UI 는 category_id 우선, fallback category. WordVault hub/library 필터 활성화 시 dictionary_categories.id 기반 필터 / **v06.24** 영단어 마스터 사전 한국어 뜻 100% 완성 — `shared_dictionary` 21,740/21,740 단어 모두 `meaning_ko` 채움 (37 batch 세션 누적) / 모든 CEFR 레벨(A1=548, A2=719, B1=1,204, B2=2,212, C1=3,806, C2=13,241) + NONE(품사 메타 10건) 100% / 품질 지침 준수 — 자연스러운 현대 한국어 우선, 학술 용어는 한국 학계 정확 용어, 차용어 음차+출처 명시, 다의어 분리, 사용 주의 어휘 명시(약물·차별·민감 표현 ~50건), 한국 사자성어/속담 직매핑(~30건 — "백지장도 맞들면 낫다", "호랑이 굴에 들어가야 한다" 등), 영국·미국·호주·캐나다 지역 분기 명시(~80건), 상표명 ™ 처리(~30건 — stilton™·velcro™·whatsapp™·zumba™ 등), typographic apostrophe(U+2019) idiom 일관 처리 / 인프라 — `scripts/dict-fetch-batch.mjs` (50개 batch 추출) + `scripts/dict-update-batch.mjs` (멱등 UPDATE, WHERE meaning_ko IS NULL 보호) + `scripts/dict-status.mjs` (CEFR별 진행률 보고) + `scripts/dict-common.mjs` (service-role 클라이언트) / 운영 효과 — 영단어 토큰화 시 캐시 히트율 100% (시드 21,740 단어 한정), AI 호출 비용 80~95% 절감 / 미완 — `dictionary_categories.name_ko` 0/566 (Phase 4-5 카테고리 한국어화) + `verified` 컬럼 false (사람 검증 단계 미수행) / **v06.23** §"🗄 Supabase DB 스키마" 영단어 마스터 사전 시스템 신설 — `shared_dictionary` 21,740 단어 마스터 캐시 (시스템 캐시, 사용자 노출 X) + `dictionary_categories` 566 노드 카테고리 트리 (3계층 H1=18 / H2=76 / H3=472) + `dictionary_word_categories` 28,124 매핑 (단어↔카테고리 M:N, 다의어 대응) / 데이터 흐름 — 텍스트 토큰화 → 캐시 조회 → 히트(목표 90%) 즉시 반환 / 미스 → Claude API → 캐시 누적 (source='ai-generated') / 외부 시드 데이터 import 인프라 — `scripts/seed-dictionary.mjs` (멱등 batch upsert, ON CONFLICT DO NOTHING) + `data/import/dictionary-seed.db` (.gitignore) / source CHECK 추상화 — 'imported' 통칭 사용 (외부 시드 출처 익명화) / 운영 시 AI 호출 비용 80~95% 절약 예상 (캐시 히트율 기반) / CEFR 분포 — A1=548 / A2=719 / B1=1,204 / B2=2,212 / C1=3,806 / C2=13,241 (한국 학습자 핵심 A1~B2 영역 22% — 운영 시 보강 필요) / 마이그레이션 3개 추가 — `add_shared_dictionary` + `add_dictionary_categories` + `prepare_dictionary_for_seed_import` / **v06.22** WordVault Browse 풀스크린 분리 + SessionFrame ResourceContext 전체 적용 + Dashboard 재설계 + Dictation Setup 정리 / **WordVault Browse 풀스크린 세션** (`/wordvault/browse`) 신규 — `isFullScreenRoute` 등록 + SessionFrame META + `(main)/wordvault/browse/page.tsx` + `WordVaultBrowseClient` + `ScriptsChipNav` 신규. 워크스페이스에서 빠른 접근. 단어 추가 / 학습 시작 / StatsGrid 모두 제거 (Calm UI · 중복 제거). 스크립트 칩 nav 신규 (전체 + 각 스크립트 단어 수, 활성 칩 인디고 그라디언트). ListenPanel 설정 토글 제거 — 항상 노출 (4그룹 인라인 wrap). `?view=browse` 호환성 redirect (쿼리 파라미터 보존) / **SessionFrame v2 — 2-row stack** (모듈 정체성 row + 리소스 브레드크럼 row). `SessionResource` 타입 + `useSessionProgress({ resource: {...} })` API. 4 type (library/vocab/script/custom)별 아이콘+색 매핑 — Sidebar 그룹 accent 정합. `<ResourceContext>` wrapper 신규 (Server Component 페이지용 정적 주입). 8 풀팝업 라우트 모두 적용 (Flashcard/SpellForge/ScriptQuiz/Pairflip/Dictation/WordBlitz/PirateQuest/WordVaultBrowse) / `(app)/layout.tsx` 신규 — WordBlitz·PirateQuest 도 SessionFrame 적용 / **Dashboard WeeklyHeatmap 재설계** — GitHub-style 7×7 heatmap → 28일 sparkline + Streak 배지 (300px → 120px, 60% 감소). SVG 정밀 렌더 + gradient 변조 + 오늘 강조 ring + 신기록 amber 배지 + 인라인 3 stats / **Dictation Setup 정리** — CEFR 수동 선택 UI 제거 (리소스 자동 감지 그대로 + Hub 배지 보존). 'difficulty-first' 순서 옵션 제거 (오답 이력 기반 미구현 — Phase 2 부활 예정). 섹션 5단 재정렬 (단위/갯수/순서/채점/고급). `Pill` 헬퍼 제거 / **WordRow v4** — 16px 컴팩트 + 예문 우측 정렬 + 펼침 메커니즘 완전 제거 + "N일 전·N일 후 복습·마스터 N/5" 메타 라인 삭제. Memory state 좌측 1px 엣지 + 행 클릭 = 발음 자동 재생 (Fitts's law). 7-column grid (chevron 제거). props 시그니처 슬림화 (expandedIds·onToggleExpand·onPlayExample 제거 → WordList·page.tsx 전파) / **HideToggleBar 단순화** — "전체 예문 펼치기/접기" 버튼 + 단축키 `E` 제거. Active Recall 토글만 유지 / **Dashboard 'use client' 전환** — KPIS LucideIcon 함수 참조 server→client 직렬화 에러 fix + `dashboard/layout.tsx` metadata 분리 / **v06.21** PairFlip 신규 모듈 (L4a Recognize 4번째 · 짝맞추기 카드 게임) / 라우트 3 (`/pairflip`·`/pairflip/play`·`/pairflip/results`) · 컴포넌트 16 (`components/pairflip/`) · 훅 1 (`usePairFlipSession`) · 라이브러리 1 (`lib/pairflip/learning-records.ts`) / **5단계 난이도 모두 2줄 고정** (Easy 4×2 8장 ~ Master 10×2 20장) / 좁은 viewport `overflow-x-auto` + `minmax(110px, 1fr)` 가로 스크롤 / **매칭된 카드 영구 유지** (`gone` 전환 X — 시각적 진행도 누적) / **O/X 우상단 28×28 코너 배지** (단어 가리지 않음, 색맹 대응 색+형태+모양 3중) / **Editorial 네이비/골드/크림 팔레트** (전면 색 변경 — Sidebar 익히기 핑크는 네비 식별, 모듈 내부 스킨은 독자) / 카드 1px 골드 테두리 + 4 모서리 코너 장식 + 페이퍼 인셋 그림자 / 부엉이 마스코트 4상태 (idle/cheer/happy/clap) / FSRS rating 매핑 (1회=Easy/2=Good/3~4=Hard/5+=Again) / **Layout 통합**: SessionFrame 셸 (`components/layout/SessionFrame.tsx`) — 풀스크린 세션(`*/play`+`/dictate/session`+`/play/*`) 진입 시 `(main)/layout.tsx` 가 children 자동 감싸 상단 슬림 헤더 주입 (이모지+제목·진행도·단계 콤보·닫기 X+Esc) / `useSessionProgress` 훅 옵션 / **isFullScreenRoute** 단일 출처 (`lib/layout/full-screen-routes.ts`) — Sidebar 와 FlowNav 동일 라우트셋 공유 (이전 FlowNav 만 자동 숨김 → 일관성) / Dashboard 'use client' 전환 (KPIS LucideIcon 함수 참조 server→client 직렬화 에러 fix) + metadata 분리 (`dashboard/layout.tsx`) / Dashboard RecentActivity **컴팩트 칩 행** 재설계 (~300px → ~70px 리스트→pill 가로행, ActivityItem 5필드→3필드 슬림화) / **v06.20** WordVault hub v6 hybrid (BookShelfSection 5 Book Type · LearningDimensionSection · WordPeekStrip 추가, AssetCollectionsRow 보존) + `lib/wordvault/mastery.ts` (groupByMastery) / **v06.16** Sidebar IA 재구성 (5 그룹 + META + FOOTER · `sidebar-config.ts` 단일 출처 · 햄버거 토글 240↔72px localStorage · 익히기 4 항목 — Flashcard→WordBlitz→PairFlip→SpellForge 인지 깊이 정렬 · "스크립트"→"내 스크립트" 라벨) + Library 라우트 분리 (`/library`→`/scripts` 리다이렉트 · `/library/vocab` 신규 · LibraryTabs 헤더 · 8 카테고리 페이지 내부 칩) / 파일명 CLAUDE.md로 통일 / 기술스택 Next.js 14 확정 / CSS 변수 축약형(--p·--bg·--t1) 통일 / React Native 토큰 신설 / Breakpoint 390/768/1280px / Dashboard §13 신설 / Parts Kit v06 / **v06.1** Turborepo 모노레포 구조 + text-viewer/marketing 분리 + game 하위 분리 + lib 폴더화 + stores 추가 / **v06.2** 서비스명 LexiVault → Vocaflow · 단어장 모듈 LexiVault → WordVault · 폴더 vocab → wordvault / **v06.3** (main)/page.tsx 삭제 → (main)/hub/page.tsx 신설 (Home+Dashboard 통합) · URL 충돌로 인한 빌드 실패 해소 (✅ 정상 빌드) · 인증 분기 middleware.ts 일괄 처리 / **v06.4** §14 Home Hub 신설 — HubHero(인사+Streak+Today CTA, gradient + s2) · ModuleCard(7모듈 정사각·아이콘·마지막 학습) · ContinueCard(Lora 제목·진행률·CTA) / StatCard `variant="inline"` 추가 (§13) / 재사용: StatCard·RecentActivity·ProgressBar / 레이아웃 4영역(Hero·Module·Continue·Reflection) · max-w-6xl · F-pattern 시선 정합 · Flow State 진입 보조 / components/home/ 폴더 추가 / **v06.6** "디자인 철학·학습 과학 원칙" 섹션 신설 (§핵심 모듈 직후 · §Typography 직전) — 디자인 철학 4(Calm UI / Progressive Disclosure / Empathetic Feedback / Implicit Progress) · 학습 과학 7(Active Recall / Spaced Repetition / Desirable Difficulty / Dual Coding / Context-Dependent / Cognitive Load / Emotional Encoding) · Memory Decay 색 체계 4단계(stable/shaky/risk/new) 명시 · Flow State 5조건 매핑(워크스페이스) · 적용 체크리스트(PR 자가점검) · 안티패턴 6개 / 기존 코드의 산재된 학습 과학 단서들(vmPFC 텍스트·focus-mode·softQuote·memory 토큰) 통합 정리 / **v06.5** §15 Admin Console 신설 — 8 라우트(/admin/*, route group 미사용) · AdminSidebar(#8B5CF6 보라 액센트 · "관리자 모드" 알림) · 관리자 대시보드(KPI 4 + 섹션 7 + 활동 피드) / components/admin/ · components/dev/StubPage 폴더 추가 / 루트 / 페이지를 임시 진입점 → 화면 인덱스+진행률 대시보드로 전면 개편 (28화면 자동 집계) / (main) 누락 6개(dashboard·flashcard·spellforge·wordblitz·scriptquiz·settings) StubPage로 채움 / error.tsx · not-found.tsx · loading.tsx 전역 바운더리 신설 (이전 "missing required error components" 무한 새로고침 해결) / hooks/useTheme · useFocusMode · useKeyboardShortcuts 추가 / lib/text-viewer/handoff.ts 신설 — TextViewer "AI로 단어 추출" → /wordvault 인계(sessionStorage) / 사이드바 "직접 입력" /input → /text 통합 · /input 라우트 삭제 / components 폴더에 library · workspace 명시 / **v06.7** §16 Dictation 모듈 신설 — 4 라우트(/dictate · /dictate/setup · /dictate/session · /dictate/results) · CEFR A1~C2 자동 감지 (어휘+문장 기반) · 단위 3종(문장/단락/전체 + Dictogloss) · Smart/Strict 채점 (Levenshtein + Word alignment) · 6개 오류 패턴 분석(음성/형태/구문/어휘) · 4단계 힌트(-5/-3/-10/-25) · TTS Web Speech API + Spaced Dictation(autoRepeat + 무음 간격) · Phonological Loop 보호 · Focus Mode(F키, 사이드바 dim) · 키보드 Space/1-5/F/Tab/Enter/Esc · localStorage 기반(Phase 2 Supabase 교체 예정) / lib/dictation/(types·cefr·text-splitter·scoring·analyzer·audio-control·hint·storage 8 파일) · hooks/dictation/(useAudioControl·useDictationSession) · components/dictation/(Hub·Setup·Session·Results 4 클라이언트) · 시드 리소스 3종(A2/B1/B2) / 사이드바 학습 그룹에 Dictation(PencilLine) 항목 추가 / 화면 인덱스에 4 라우트 등록 / 핵심 모듈 7개 → 8개 / **청소(v06.7 동시)** — 잘못 위치한 훅 5개(`src/use*.ts`) · 빈 페이지(`components/workspace/text/[id]/page.tsx` 0bytes) · 빈 placeholder 9폴더(components/audio · components/game/{flashcard,shared,spellforge} · lib/{analytics,openai,parsers,scoring} · config · stores) · 빈 API 5폴더(api/{analyze,health,quiz,tts,upload}) 모두 삭제 · `api/auth/callback`만 `.gitkeep`으로 유지 (OAuth 필수) / **v06.8** §17 학습 모델 v2.0 신설 (상세 내역 v06.8 참조) / **v06.9** §17 학습 모델 v3.0 재설계 — L2.5 Bridge 폐지(Dictation 억지 배치 제거) / L4를 인지 부하 순서 4단계로 분리(L4a 재인: Flashcard+WordBlitz · L4b 시각생성: SpellForge · L4c 청각생성: Dictation · L4d 통합검증: ScriptQuiz) / L4b(SpellForge)와 L4c(Dictation)은 쌍둥이 계층 — 감각 채널만 다른 생성 인출 / 7원칙×9계층 적용 매트릭스 전면 갱신 / PR 체크리스트 "6계층" → "9계층(L0~L4d~L5)" 갱신 / 미정 항목 6개로 확장(L4b vs L4c 추천 우선순위 추가) / **v06.10** §17.1 L1 Acquire 라우트 분리 — `/text` 허브 신규 (Flashcard·SpellForge 패턴 정합) / `/text/new` 입력 화면 분리 (기존 `/text` 입력 폼 이전) / `/text/[id]` 워크스페이스 유지 / TextViewer 5개 신규 컴포넌트 (TextCard · TextStatusBadge · MyTextsGrid · EmptyState · DiscoveryFooter — `components/textviewer/` 신규 폴더) / Sidebar 라벨 '직접 입력' → '스크립트' + Icon Plus → BookOpen 정합 / 4 Tier IA (Hero · Continue · MyTexts · Discovery) / 5관점 설계 (뇌과학 Zeigarnik·Endowment / 심리 SDT 자율성·유능감 / 디자인 공통 허브 컴포넌트(ModuleHero·ContinueRow) 재사용 + TextViewer 액센트 #8B5CF6 / 접근성 WCAG AA — aria-label·role progressbar·aria-valuenow·focus-visible:ring·≥44×44 터치 타겟 / 실용 4시나리오 — 신규 입력 1클릭, 이어 학습 1클릭, 목록 보기 0클릭, 라이브러리 전환 1클릭) / Mock 6개 스크립트 (B1~C1 + A2 미시작 1건 — 정복 2 / 진행 4 / 미시작 1) — Phase 2: Supabase texts 테이블 user_id, last_opened DESC fetch / 기존 `components/text-viewer/` (입력 폼 8개) 그대로 유지 — `/text/new` 가 그대로 사용 / **v06.11** §17.1 L3 Encode 허브 신규 — `/wordvault` 허브 (4 Tier IA: Hero · Memory Decay 분포 · Today Risk · 3-View 진입) + `/wordvault?view=browse|study|review` query param 방식 (라우트 추가 없이 기존 컴포넌트 100% 재사용) / WordVault 5개 신규 컴포넌트 (`components/wordvault/hub/` — WordVaultHub · MemoryDecayDistribution · TodayRiskStrip · ModeEntryGrid · WordVaultEmptyState) / Memory Decay 4색 stacked bar 시각화 (§17.2 [2] 상태 축 정합 — getMemoryState() 동적 계산, R(t) 직접 노출 X) / TodayRiskStrip — filterUrgentCards(0.6) 5개 미리보기 + Flashcard CTA (위급 0개 시 자동 숨김) / TextViewer 분석 후 redirect URL 정합 (`/wordvault` → `/wordvault?view=browse`) — 분석 직후 사용자 의도(단어 확인) 정합 / consumePendingWords 인계 시 router.replace로 ?view=browse 자동 진입 / mock-data.ts srs 카드 보강 (RISK_CARD · RISK_CARD_2 · STABLE_CARD_2 추가 — 4색 분포: stable 2 / shaky 1 / risk 2 / new 3) / 5관점 설계 (뇌과학 — Memory Decay 시각화 + Reconsolidation priming + Endowment Effect / 심리 — SDT 자율성 3-View + 결정 마비 회피(Today Risk가 1개 명확한 액션) / 디자인 — ModuleHero 재사용 + 보라/인디고 gradient `#6366F1→#3730A3` + Memory Decay 4색 토큰(--memory-stable|shaky|risk|new) / 접근성 — role img + aria-label + focus-visible:ring + 키보드 네비 / 실용 4시나리오 — 현황 파악 0클릭, 위급 복습 1클릭, 둘러보기 1클릭, 학습 1클릭) / 헤더 3-tab → Link 기반 (URL이 진실 소스) + '허브' 탭 추가 (총 4탭) / **v06.19** WordVault 허브 v5 — 자산 차원별 관리 / 사용자 비판: "최근 추가·오늘의 단어·빠른 작업의 근거가 뭔가? 자산을 다양한 형태·유형으로 관리해야 하는 화면인데 쓸데없는 게 잔존" / 진단: v06.18 의 SpotlightWord·RecentlyAdded·AssetActions 가 자산 관리 본질에서 벗어남 (단일 단어 부각=학습 ritual / browse view sort=created_at DESC 와 중복 / 검색·전체듣기는 browse 기능 중복) / **이론 근거**: Personal Information Management (S. Dumais) — 자산 관리 UI 의 핵심은 **find / browse-by-facet / organize** 3 작업이며, 단일 자산 부각은 discovery 패턴(학습 영역) 으로 분리해야 함 / **3개 컴포넌트 삭제**: SpotlightWord · RecentlyAdded · AssetActions / **2개 컴포넌트 신규**: CEFRDistribution (Tier 3 — CEFR 6단계 horizontal bar 분포 · 0개 행도 항상 6 행 렌더 opacity-40 + aria-disabled · 클릭 시 /wordvault?view=browse&level=A1 등 진입 · role=progressbar + aria-valuenow) / FindAndMore (Tier 4 — 인라인 검색 input + Enter 시 /wordvault?view=browse&q=X 진입 · 자동 focus X 모바일 키보드 보호 · "전체 둘러보기" 링크 · "일괄 작업 Phase 2" disabled + tooltip · form role="search") / **CEFR 분포 토큰 신설**: --cefr-a1 #86EFAC / --cefr-a2 #22C55E / --cefr-b1 #3B82F6 / --cefr-b2 #1D4ED8 / --cefr-c1 #7C3AED / --cefr-c2 #581C87 + 다크모드 변형 (4.5:1 WCAG AA) — 기존 --cefr-A1-bg passport 톤 badge 토큰과 의미 분리 / **mock-data 보강**: tallyCEFR 집계 헬퍼 + 단어 13개 (8 + 5 추가) — A1·A2·C1·C2 단어 추가하여 6단계 모두 1개 이상 (A1=1·A2=1·B1=3·B2=5·C1=2·C2=1) / **5 Tier IA (multi-faceted asset management)**: Tier 1 Hero+VaultBar (Identity) / Tier 2 AssetCollectionsRow (Source pivot) / Tier 3 CEFRDistribution (Level pivot) / Tier 4 FindAndMore (Find action) / Tier 5 MemoryDecayDistribution+TrendIndicator (State pivot + 추세) / **Hub vs Browse 책임 분리** 명시 (CLAUDE.md §17.10 추가 — hub=facet 진입점만, browse=검색/정렬/필터/목록/일괄/듣기 작업 화면, 중복 금지 원칙) / 5관점 (뇌과학 — Tversky feature-based categorization·Recognition>Recall·parietal spatial memory / 심리 — SDT 자율성·Choice Architecture(Source 가장 prominent)·Miller 7±2 (3 primary facet 안전권) / 효율 — DRY 원칙·One Job per Component·browse 기능 중복 제거 / 접근성 — CEFR 색만 의존 X (라벨 텍스트 동시)·keyboard Enter/Esc·focus-visible:ring·role=progressbar / 실용 — Cold(0개=EmptyState)·Warm(빈 레벨 dim)·Hot(전체 비율) 자동 적응) / **v06.18** WordVault 허브 v4 — "내 어휘 자산" 정체성 강화 / 별도 지시문(VS Code 작업 지시서 v06.14)을 v06.17 baseline 위에 hybrid 적용 / 진단: v06.17 (asset-management) 가 학습 boundary 는 명확하나 "자산 정체성 시각 표현" (Volume·Provenance·Longevity) 약함 — Hero stats 가 학습 부담 강조(위급/안정/전체)였음 / **신규 3 컴포넌트**: VaultBar (Hero 내부 슬림 8px 4색 누적 막대 + 인라인 4 라벨, role="img" + aria-label, onDark 모드로 다크 Hero 위 ti/15 트랙) / TrendIndicator (week-over-week 추세 — stable +N=초록▲, stable -N=회색▼ Calm UI, risk -N=초록▼ 긍정, risk +N=주황▲ — 빨강 사용 X 압박 회피) / AssetCollectionsRow (CollectionsCarousel 대체 · 더 풍부 — type 배지 3종 [스크립트=p-light/내가만든=bg3/추천=active-light] + 4색 mini distribution bar 4px + 카드 아이콘 [history/sparkles/clock/flame] + 정렬 auto→text→custom + ≤3개 grid / 4+개 가로 스크롤 snap-x) / **Hero stats 변경**: 위급/안정/전체 (학습 부담) → 총/컬렉션/누적일수 (자산 규모 — Endowment Effect 3축) / **ModuleHero `bottomSlot` prop 신규** (note 아래·stats 위 자유 슬롯 — VaultBar 임베드용 · 미지정 시 호환 보존) / **MemoryDecayDistribution `trend` prop 옵션** (헤더 우측 TrendIndicator 슬롯) / **mock-data 보강**: MOCK_ACCUMULATED_DAYS=31 · MOCK_TREND={stableDelta:8, riskDelta:-3} · MOCK_ASSET_COLLECTIONS 3개(text 2 + auto 1) / **CollectionsCarousel 삭제** (AssetCollectionsRow 가 대체) / **v06.17 boundary 유지**: 지시문이 v06.13 baseline 가정으로 TodayRiskStrip/ModeEntryGrid "변경 X"를 명시했으나 v06.17에서 사용자 명시 승인 하에 제거 (Flashcard 영역 침범 해소) — hybrid 결정으로 두 컴포넌트 복원하지 않고 자산 정체성 강화 부분만 채택 / **6 Tier IA**: Hero+VaultBar / AssetCollectionsRow / RecentlyAdded / SpotlightWord / AssetActions / MemoryDecayDistribution+TrendIndicator / 5관점 (뇌과학 — Endowment Effect 4축 가시화 / 심리 — SDT 자율성 70% 학습 강제 X / 디자인 — VaultBar(Hero 슬림 8px) vs MemoryDecayDistribution(Tier 6 큰 막대) 시각 무게 차별 / 접근성 — VaultBar role="img"·aria-label, 모든 카드 ≥44×44, focus-visible:ring / 실용 — 0클릭 자산 인지·1클릭 컬렉션·1클릭 발음 예문) / **v06.17** WordVault 허브 v3 — Asset Management 정체성 재정의 / 사용자 지적: "단어장 hub 는 내 단어(자산)을 관리하는 화면으로 구성되어야 함 — WordVault·SRS·Flashcard 관계가 개념상 맞는지" / **개념 답변**: 정합 — WordVault=자산(Asset, "내가 가진 단어들") / SRS=엔진(invisible, "기억 상태 추적") / Flashcard=학습 세션(Module, "능동적 회상") / WordVault hub 는 자산관리에 충실해야 하며 학습 큐/세션은 Flashcard 의 책임 / **v2 진단**: TodayWordsList(위급/shaky 학습 큐 + 일괄 학습 CTA)·ModeEntryGrid(Browse/Study/Review 학습 모드) 가 Flashcard 영역 침범 — boundary 위반 / **v3 변경**: TodayWordsList 삭제 / ModeEntryGrid 삭제 / RecentlyAdded 신규 (자산 성장 surface — `state==='new'` 우선 + id 내림차순 fallback, max 5개, 빈 상태 시 TextViewer 진입 안내) / AssetActions 신규 (3 카드 그리드: 🔍 검색 → /wordvault?view=browse · 🔊 전체듣기 → /wordvault?view=browse · 🃏 학습으로 → /flashcard, 학습 진입을 "외부 모듈 위임"으로 명시 framing) / MemoryDecayDistribution footer 에 학습 게이트웨이 추가 ("주의 필요 N개 — Flashcard 에서 학습할 수 있어요" 작은 링크, attentionCount=risk+shaky, 0 시 숨김) / **6 Tier IA (asset-first 재정렬)**: Tier 1 Hero(자산 통계 — 전체 emphasis · 안정 · 신규) / Tier 2 CollectionsCarousel(자산 조직 PRIMARY · 출처별 그룹 5색 gradient + 이모지) / Tier 3 RecentlyAdded(자산 성장) / Tier 4 SpotlightWord(asset exploration · daily delight) / Tier 5 AssetActions(검색·전체듣기·학습 위임) / Tier 6 MemoryDecayDistribution(자산 건강도 + Flashcard 게이트웨이) / Hero note 신규 분기 (`new>0`=신규 강조 / `shaky>0`=흔들림 강조 / fallback=총개수) / **5관점 (asset 정합)**: 실용 — hub=자산 도구상자 / 접근성 — 모든 인터랙티브 ≥36×36, aria-label / 디자인 — 자산 위계(overview→org→growth→engagement→ops→meta) / 심리 — 컬렉션 소속감 + 자기 성장(RecentlyAdded) + daily ritual(Spotlight) / 마케팅 — "내 라이브러리" 정서, 학습 압박 X / 컴포넌트 정리: 신규 2 (RecentlyAdded · AssetActions) · 삭제 2 (TodayWordsList · ModeEntryGrid) · 유지 4 (SpotlightWord · CollectionsCarousel · MemoryDecayDistribution · WordVaultEmptyState) / **v06.16** WordVault 허브 v2 — 단어 자체와 인터랙트 가능한 hub 재설계 / 사용자 의도: "WordVault 관련 사항들이 거의 없음 — 실용성·접근성·디자인 최고 수준" / 진단: 이전 hub 는 통계와 라우트만 노출 — WordVault 정체성 콘텐츠(단어·예문·발음·컬렉션) 0% / 새 6 Tier IA: Tier 1 Hero(slim, 통계 3개) / Tier 2 **SpotlightWord** ★오늘의 단어 — Lora 32~36px 영단어 + Web Speech API 발음 버튼(36×36) + 한글 의미(DM Sans) + 예문(Lora italic + p 액센트 좌측 보더) + Memory state 배지(4색 토큰) + "잠시 만나보기" CTA, 선정 우선순위 shaky→risk→stable→new(결정적 mock) / Tier 3 **TodayWordsList** — 위급/shaky 단어 카드 LIST(이전 chip→풍부 카드) · 좌측 4색 보더 · 발음 버튼 · 의미 표시 · 일괄 "모두 학습" CTA → /flashcard?mode=review · filterUrgentCards(0.7) 정렬 · 7개 한도 · 0개 시 자동 숨김 / Tier 4 **CollectionsCarousel** — 출처별 컬렉션 카드 (Gatsby🥂 / 1984👁 / TED🎤 / BBC📰 / 즐겨찾기⭐) · 데스크톱 5열 그리드 / 모바일 가로 스크롤 · 88px 카드 + gradient + 이모지 + count 배지 / Tier 5 ModeEntryGrid (라우트) / Tier 6 MemoryDecayDistribution (footer-like meta) / 신규 컴포넌트 3개 (`components/wordvault/hub/`) — SpotlightWord · TodayWordsList · CollectionsCarousel / **TodayRiskStrip 삭제** — TodayWordsList 가 풍부한 카드 LIST 로 대체 / 5관점 (실용 — hub 에서 단어 발음·예문·1클릭 학습 / 접근성 — aria-label 풀텍스트(단어+의미+상태) · 발음 버튼 ≥36×36 Fitts · 4색+텍스트 라벨 동시(색맹 대비) · 키보드 focus-visible / 디자인 — Lora=영어 / DM Sans=한글 시각 분리 · 위계(engagement→action→exploration→meta) · 4색 토큰 일관 / 심리 — SDT 자율성(다층 진입점) + 자기효능감(daily ritual) / 마케팅 — 컬렉션 시각 정체성으로 "내 라이브러리" 소속감) / **v06.15** 용어 통일 — "**원문**" → "**스크립트**" 전수 변경 / 사용자 의도: "원문이라는 메뉴 및 개념을 스크립트라는 용어로 변경" — 메뉴 라벨 수준이 아닌 개념 자체 rename / 변경 범위: Sidebar 그룹 + 메뉴 라벨 (`원문` → `스크립트`) · FlowNav 6단계 source 라벨 · §17 흐름 축 L1 Acquire 설명 · §17.2 [2] 상태 축 4단계 설명 · §17.6 모듈 매트릭스 ScriptQuiz 행 · §17.10 IA 원칙 5그룹/6단계 본문 · 모든 hub ModuleHero `note` 텍스트 · TextViewer hub stats 라벨 · /text/new 헤더·H2·placeholder · ScriptQuiz Start/Question/Result 시각 카피 ("스크립트 독해 퀴즈" / "스크립트 기반 퀴즈" / "스크립트 근거" 등) · DiscoveryFooter 카피 · WordVaultEmptyState 카피 · SpellForgeCompletion 복귀 링크 · ScriptDisplay Step 02 라벨 · WordList 정렬 옵션 · DictationSetupClient 순서 옵션 · NextActionCard mock 라벨 · ModuleCard 라벨 · marketing 페이지 (about/pricing/privacy/terms) · admin (analytics funnel · library 페이지) · root layout meta · /screen index · dev/components 카탈로그 · 코드 주석 (analysis-types · AnalysisResult · queries · types/flashcard · scriptquiz/types) / **유지** (사용자 명시): URL 경로 `/text` (리다이렉트 비용 회피 · URL = 내부 식별자) · DB 테이블 `texts` (마이그레이션 불필요) · `components/textviewer/` · `components/text-viewer/` 폴더 (내부 코드 — Phase 2 정리 후보) · `LibraryText` 타입 / 향후 v8 (DB 연동) 시 폴더·테이블 정리 권장 / **v06.14** §17.10 IA — **FlowNav v2** 재설계 / 5단계 → **6단계** 확장 (라이브러리 L0 Discover 분리 — Compass 아이콘으로 BookOpen(스크립트) 과 시각 구분, 사용자 "라이브러리에서 왔는지 스크립트에서 왔는지" 인지 정합) / **진척도 SVG ring** 신규 (각 단계 익힘% 원형 게이지 — 배경 ring var(--bd) 0.55 + 진척 arc stage accent + strokeDashoffset 0.6s ease-out 애니메이션) — Implicit Progress + 자기효능감 강화 / **세션 라우팅** 전환 — 클릭 시 허브 X, 활동 진입점 직행 (라이브러리 `/library` / 스크립트 `/text/[id]` workspace / 단어 `/wordvault?view=study` StudyMode / 익히기 `/flashcard/play` / 정복 `/scriptquiz/play` / 완성 `/dictate/setup`) / Mock progress 6단계 (0/45/35/87/60/25%) — Phase 2: DB 실시간 fetch 매핑 명시 / 데스크톱 stage 버튼 48px (icon 11×11 + ring 32×32) / 모바일 44px (icon 9×9 + ring 28×28) — 6 dots @ 390px 호환 / aria-label 에 익힘% 포함 — 색맹·스크린리더 대비 / Sidebar 5그룹 그대로 유지 (FlowNav=흐름 단계, Sidebar=모듈 직진 — 의도적 역할 분리) / 5관점 (뇌과학 — 진척 시각화·Levels of Processing 9계층 정합 / 심리 — 자기효능감(능력감)·자율성·Variable Reward / 디자인 — 6색 accent·SVG ring·반응형 / 접근성 — aria-label 익힘%·44×44 Fitts·motion-safe / 실용 — 세션 1클릭 직진·페이지별 자동 숨김 보존) / **v06.13** §17.1 학습 모델 v3.2 / Dictation L4c → **L6 Complete (완성)** 재배치 — 텍스트 단위 다중 채널 재생산 (음운+의미+문법+철자) + Free Recall + Production 인정, 학습 정점으로 격상 / ScriptQuiz L4d → **L5 Conquer (정복)** 재배치 — 텍스트 단위 의미 통합 (Recognition + Transfer) / L5 Reflect → **L7 Reflect** / 9계층 유지 (L0~L4a/b + L5 + L6 + L7) / **§17.10 IA 원칙 신규** — "모델 흐름이 UI에 보여야 한다 (단 강제 X)" 3가지 노출 위치 (Sidebar 5그룹 + 전역 FlowNav + 화면별 NextActionCard) / **FlowNav 컴포넌트 신규** (`components/layout/FlowNav.tsx`) — sticky top, 5단계 가로 (스크립트/단어/익히기/정복/완성), URL 기반 자동 단계 결정, 양방향 자유 이동, 점선 connector, 데스크톱 라벨+부제 / 모바일 아이콘+활성 라벨 (≤40px) / 페이지별 표시 정책 — 게임 play (`*/play`) / Dictation session (`/dictate/session`) 자동 숨김 (working memory 보호 — Sweller) / 메타 페이지 (`/hub`, `/dashboard`, `/settings`) 표시 + 모두 비활성 (opacity-60) / Sidebar 4그룹(입력/학습/게임/분석) → **5그룹+메타 분리** (스크립트/단어/익히기/정복/완성 + META 구분선 후 + Lab 별도) — FlowNav 와 1:1 라벨/색상 매핑 / NavLinkItem 헬퍼 컴포넌트 추출 (NAV_GROUPS·META_ITEMS·LAB_ITEMS 공통) / NextActionCard mock 라벨 흐름 순 정합 — cold "익히기 시작 — 단어 만나보기" / warm "단어를 정확하게 — 철자로 다지기" (dictation → spellforge 변경, dictation 자연 추천 제외) / hot "정복 도전 — 스크립트 안에서 확인" / 5관점 (뇌과학 — 메타인지 활성·인지 부하 차단·Levels of Processing / 심리 — SDT 자율성·Bjork Interleaving·Information Foraging Pirolli / 디자인 — 5색 accent·점선 connector·반응형 / 접근성 — aria-current·44×44 Fitts·Tab 순환·motion-safe / 실용 — 1클릭 이동·0클릭 인지·자동 숨김) / **v06.12** Hub Hero 슬림화 + 모듈별 커스터마이징 — ModuleHero baseline 시각 무게 35% 감량 (`Title` 32~40px font-[800] → 22~28px font-[700] / `Stats emphasis` 32~36 font-[800] → 22~26 / `Stats normal` 24 → 18~20 / `Padding` py-8 md:py-10 → py-5 md:py-6 / `Glow` 224×224 opacity-20 → 128×128 opacity-12 / `Border-radius` r-2xl → r-xl / `Shadow` sh-md → sh-sm) / 신규 `note?: string` prop 추가 — 장식적 영문 인용문 (deprecated `tagline`)을 기능적 한국어 1줄로 대체 ("진행 중 4권 · 정복 2권" / "약 5분이면 끝나요 · 우선 12장" 식의 즉시 정보가치) — 영문 인용문 7개 모두 제거 / `tagline` prop 호환성 유지 (note 미지정 시만 렌더, 더 작은 사이즈) / **7개 hub 모듈 캐릭터 차별화** — 스크립트(asset, "내 라이브러리", 진행/정복/총개수) / 단어장(asset, "내 어휘 자산", 위급 강조 + 격려형 동적 note) / Flashcard(action, "오늘의 카드", "약 N분이면 끝나요" 시간 안내) / Dictation(action, "받아쓰기", streak ≥3 우선 동적 note) / SpellForge(action, "철자 연습", IME 정확도 강조) / ScriptQuiz(score, "스크립트 독해 검증", 평균 정확도 emphasis 변경) / WordBlitz(score 게임 캐릭터 유지하되 슬림 — Title 40~56 → 28~36 / py-10~12 → py-6~7 / 노란 인라인 stats 추가 (Best/콤보/정확도) / 크리처 4→3개 + 14→10 사이즈 / r-2xl → r-xl) / 5관점 적용 (기능 — note는 정보 1줄 / 실용 — 동적 분기로 cold/warm 구분 / 심리 — 격려형 카피·과한 강조 회피 / 마케팅 — "5분이면" 같은 진입 장벽 제거)*
