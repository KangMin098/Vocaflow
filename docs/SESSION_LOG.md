# Vocaflow 세션 진행 로그 (SESSION_LOG)

> **목적** — 세션(대화)이 바뀌어도 작업을 매끄럽게 이어가기 위한 진행상황 누적 기록.
>
> **규칙**
> 1. 세션 종료(또는 논리적 구간 종료) 시 아래 **"세션 기록"** 섹션에 **최신 항목을 맨 위에 prepend**.
> 2. 문서 최상단 **"▶ 지금 이어서 할 일 (RESUME HERE)"** 블록은 매 세션 **통째로 덮어써** 항상 최신 상태만 유지 — 새 세션은 여기부터 읽으면 됨.
> 3. 이 문서가 너무 길어지면(대략 **800줄** 초과) `docs/SESSION_LOG_02.md` 를 새로 만들고, 이전 문서 하단 + 새 문서 상단에 **상호 링크**를 걸어 체인 유지.
> 4. 각 항목은 `날짜 — 제목` + `무엇을 했나 / 무엇이 남았나 / 관련 파일·커밋` 을 담는다.
>
> **관련 문서** — `docs/CHANGELOG.md`(릴리스 단위 요약) · `docs/AI_CONTEXT/`(메모리 미러, **자동 생성 — 수동 편집 금지**) · 외부 메모리 `~/.claude/.../memory/MEMORY.md`.

---

## ▶ 지금 이어서 할 일 (RESUME HERE)

**작업**: `/admin/vocab/*` VCB 파이프라인 재검토·재설계 (+ 화면 자동검증 환경)
**브랜치**: `feat/plan-ui`
**상태**: ✅ **코어 재설계 완료** — 이번 세션 9커밋 push. **전 변경 dev :3100 + Playwright 스크린샷 검증**. VCB 파일 tsc 0.

- **자동검증 환경**: dev :3100(`DEV_ADMIN_BYPASS=1`) + `apps/web/.vcb-shots.mjs`(임시, 미커밋)로 각 변경 스크린샷 확인. ⚠️ **dev 서버 1개 원칙**(멀티 `next dev` = `.next` 공유 오염 → 무작위 404/청크 500; 이번에 seed 페이지 500 실측 → clean 재시작으로 해소). 공식 스모크 `pnpm --filter web test:e2e:smoke`([04-ui-smoke.spec.ts](../apps/web/tests/e2e/04-ui-smoke.spec.ts), 동시 세션 v06.159 자산화) 활용 권장.
- **결정 A** — 위저드 3→2스텝 + 필터 machinery(FilterPanel/LiveCountBadge/DistributionChart/SampleWords + `filter-actions.ts` + `CreateRunInput.filters/limits`) 전량 제거 + orphan RPC 3종 DROP(마이그 `drop_vcb_filter_preview_rpcs`).
- **결정 B** — enrich(§5)·seed(§2) 카드에 "Claude Code `/vcb-batch-enrich`·`/vcb-seed-list` 실행 권장" callout. FS 의존 `VcbPipelineGuide`+`pipeline-steps.ts` dead code 제거, `VcbRunProgress`(run.status 7-phase 스텝퍼)로 대체.
- **집계 1000행 cap 버그** — `aggregateRunCounts`·`precheckPublish`가 PostgREST 1000행 cap에 걸려 2,000+ run 카운트 반토막(거짓 정합성 배너·"50%"). `.range()` 페이지네이션 수정. (스크린샷이 발견.)
- **발행 원자성** — `publishRun`을 `vcb_publish_commit` SECURITY DEFINER RPC 단일 트랜잭션으로 치환(이전 세션).
- **MockBanner 제거** — Phase 1.5 "MOCK·시각검증용" 전역 배너 삭제(관리자 콘솔 실데이터화 → 문구 거짓·실 mutation 오인 위험).
- **커밋**(이번 세션): `64a6435`(VcbRunProgress) `d589048`(seed callout) `335c3f0`(MockBanner) `9a4fadb`(dead code) `a476505`(RPC drop) + 이전 세션 A/B/count-cap/publish 커밋.

**추가 완료(2026-07-08 후속)**:
- **큐레이션 낙관적 UI + 키보드 내비** (`6f287d1`) — 오버레이 즉시반영·자동 다음 이동, j/k·a/r 단축키. :3000 스크린샷 + j×3→"find" E2E 검증.
- **큐레이션 리스트 1000행 cap 수정** (`d4ebb88`) — 스크린샷에서 "전체 1000" 발견(run#1=2000). fetchQueueItems 메인쿼리+fetchLatestDecisions+fetchNgslRanks 3곳 페이지네이션/청킹. 검증: "전체 2000" 회복.
- **admin 액센트 색 토큰화** (`a0edcbf`) — 하드코딩 `#6D28D9`(7곳)→`var(--admin-strong)`, `var(--combo)`(게임 토큰 오용, "변경금지")→`var(--admin)`. design-tokens에 전용 `--admin`/`--admin-strong` 신설(light+dark, additive). 검증: 라이트 무변화·다크 대비 개선(New Run 버튼).
- **큐레이션 payload edit rich-form** (`cc92b58`) — 결정 C(저빈도 전문가 도구). `VcbCurationEditForm`(IPA·CEFR·정의ko/en·예문 add/remove·syn/ant/col·노트) + "편집" 토글, 저장 성공 시 즉시 반영(재fetch 없이). 검증: 폼 payload 프리필 렌더.

**✅ VCB 재설계 전체 종결** — 프로세스·기능·화면 + 저우선 edit 폼까지 커버. 이번 세션 **11 커밋**(64a6435·d589048·335c3f0·9a4fadb·a476505·6f287d1·d4ebb88·a0edcbf·cc92b58 + 세션로그).

**향후 여지(선택·비긴급)**:
- 다른 관리자 페이지(VRL/quality 등)도 하드코딩 퍼플 다수 → `var(--admin)` 채택 여지(이번엔 VCB 스코프만).
- ⚠️ 동시 세션(ACP/plan/CONTEXT.md)과 같은 working-copy·index 공유 → 커밋 인터리빙. **명시 pathspec `git commit -- <경로>` 격리 필수**(bare commit은 동시 세션 staged 파일 흡수).

**제안서**: [docs/proposals/vcb-admin-redesign.md](proposals/vcb-admin-redesign.md) §7 결정 A/B/C + 구현계획.
**직전 완료작업 (nav 감사, ✅ 종결)**: 커밋 `f98c918`·`56cb8de`·`5190c0c`·`45e319b`·`146070d`. 상세는 아래 2026-07-05 기록.

---

## 세션 기록 (최신 ▲)

### 2026-07-09 — /plan 자료 고르기 picker 전면 재설계 + 다건 선택 (완결 · 스모크 green)

**요청 흐름**: `/plan` "자료 고르기" 를 (1) 소스별 3단 분류(소스→분류→컨텐츠), (2) 컨텐츠를 우측 넓은 선택 영역으로, (3) 학습대상 **다건 선택**, (4) 디자인 폴리시 — 순차 지시.

**무엇을 했나** (전부 `tsc` + `05-plan-picker.spec` + 전체 스모크 8/8 green):
- **4탭 소스별 분류 통일** — 스크립트(소스→프로그램) · 내 스크립트(소스→책, library texts를 소속 도서로 2차 분류) · 공용단어장(카테고리→책) 모두 **좌 2열 네비 + 우 다건 선택**. 도서만 표준 master-detail(V레벨 레일 + 단건, 챕터 per-book).
- **다건 선택** — `ArticleSelectPane`/`ArticlePickRow`(체크박스) + 선택분 공유 활동·요일 + `commitSourceBatch` 일괄 저장. 상태 `artSel`/`artActs`/`artDays` PlanClient 리프트.
- **일반화·정리** — `buildArticleNav`(소스라벨·정렬 파라미터) + `ArticleNav`(컬럼 라벨 prop). dead `WordSetBookGroups`·`ArticleColumns`·`bookTitleById`·죽은 groups 분기 제거. plan-actions scripts/word_set fetch에 source·library_book_id·chapter + library_books 제목 통합 조인(feed_label=책).
- **디자인 폴리시** — 행 hover 리프트·active·`+` 아이콘 잉크 채움, V레벨 outlined pill, 헤더 구분선.
- **버그 수정** — 탭 전환 시 우측 컴포저(draft/editId/error) 리셋(옛 구성이 새 탭 선택 영역 가리던 버그).
- **회귀 자산** — `tests/e2e/05-plan-picker.spec.ts` 신규. /library/books 앞선 스모크 실패는 **동시 편집 churn(콜드컴파일 타임아웃)** 로 확정 — warm 서버서 8/8 green.

**부수 작업**(별도 지시): StoryWeaver 소스 GET 영어필터 수정 + 큐레이션 메타 21권 · VOA/NASA/SimpleWiki/The Conversation **121편 발행**(소스→프로그램 구조) · V-Level **알고리즘 vs Claude 판정 비교/평가**(아티클·도서·시드; P75 어휘지표 설명문 저평가·도서 서사 정합 96%·시드 est 저평가 편향).

**무엇이 남았나**: /plan 도메인 완결. PR 정리는 동시 WIP(VCB · ACP owid/factbook) 안정화 후 권장.

**관련 커밋**: `v06.146~160` + `97f4e97`(회귀스펙). CHANGELOG 동일 버전대. 전부 격리 pathspec(동시 세션 흡수 방지).

### 2026-07-09 — ACP 파이프라인 라이브 검증 + Simple Wikipedia junk 수정 (VCB 세션 연속)

> VCB 재설계 완결(위 RESUME) 후 사용자가 "ACP 라이브 검증·보완" 선택. 동시 세션(ACP OWID/Pressbooks·/plan)과 working-copy 공유 → 명시 pathspec 격리, wikinews/simple_wiki(비활성 소스)만 건드려 충돌 회피.

**P0 진단(read-only) — ACP는 실제로 잘 작동 중**(메모리 "라이브검증 미실시"보다 양호):
- 127 발행기사/5소스(simple_wikipedia 34·nasa 30·voa 30·the_conversation 25·owid 8). **라이선스 게이트 정확**: the_conversation(cc_by_nd) → 전부 `display_only=true` ✓. register·article_v_level·lexical_noise 전량 채움.
- 어드민 `/admin/articles`: register×cefr 발행 매트릭스 UI 정상(GAP 빗금+클릭→소스GET), 4스텝 내비, stat 카드, pageerror 0.

**발견 3건 / 조치**:
- 🔴 **Simple Wikipedia junk**(수정) — `Category:Good_articles` 수집이 `gcmtype=page`(전 네임스페이스)라 `Wikipedia:Good articles/by date`(33w) 등 관리 인덱스 페이지가 발행 기사로 유입. `gcmnamespace=0` 추가(`62be48a`, 라이브 junk 3→0) + 기존 junk 2건 DB 정리(승인: shared_words 3+단어세트 2+seed 2+기사 2+vocab 25 cascade). 검증: junk 0, UI 129→127·설명 B2 14→12.
- 🟠 **wikinews 0건**(미수정) — `feedrecentchanges`(편집이벤트, 0 entry) 피드 오선택. 실기사는 `Category:Published`(10건 확인)에 있으나 **영문 Wikinews 폐쇄중**("closes after 21 years") → 저ROI 보류.
- 🟡 **A1-A2 gap**(버그 아님) — Simple Wikipedia 34건 전부 B1+(Black hole·Evolution 등 실제 B1+). §18의 "A1-B2 갭 채움" 가정이 낙관적이었음. 별도 easy 소스 필요.

**관련**: `62be48a`(ingester fix) · `docs/proposals/acp-cleanup-simple-wiki-junk.sql` · CHANGELOG v06.165. 교훈: 소스 인제스터는 카테고리 수집 시 **네임스페이스 필터 필수**(위키 계열).

### 2026-07-09 — /plan UI 재설계 + 교육과정 어휘([별책14]) 사전 태깅

> ⚠️ 이 세션은 동시 세션(VCB 어드민)과 브랜치·working-copy 공유 → RESUME HERE 는 VCB 핸드오프 보존 위해 미변경, 본 기록만 prepend. 커밋은 전부 명시 pathspec 격리.

**요청**(순차): (1) 주간보드 가로 컨셉, (2) 스크립트 picker 3열(소스→분류→리스트), (3) 학습계획 일별·다중 소스·다중 챕터, (4) [별책14] 교육과정 어휘 사전 DB 적용·연계 정합.

**무엇을 했나**:
- **주간보드 가로 캘린더** (v06.143 `7da30ed`) — 요일=행(세로 아젠다) → `grid-cols-7`(모바일 가로스크롤+snap). 오늘 3중 인코딩, 계획 있는 날=흰 카드/빈 날=캔버스. `DayCard` 신설.
- **학습계획 다중 엔트리** (v06.145 `a5b73d1`) — 마이그 `20260706024846_p1_plan_multi_entry`: `study_plan_items` `UNIQUE(user,type,material)` 제거 → 한 자료 여러 배치(요일×챕터)로 '월=Ch1/수=Ch2' 가능. `savePlanItem` onConflict→**id 왕복**(INSERT반환/UPDATE by id) — tmp-id 탓 방금담은항목 삭제 실패 버그(B1) 수리. picker=항상 새 배치, 담김→개수.
- **스크립트 picker 3열** — 동시 세션이 이미 소스\|분류\|컨텐츠(v06.149~153) 구현 → 재작업 없이 확인만(충돌 회피).
- **교육과정 기본어휘 3,000 태깅** (v06.146 `60bc3fb`·`ae495b1`) — `Downloads/[별책14]…pdf` pdftotext 추출 3,045 core(등급 `*`819/`**`1215/무1011=문서 배분 일치, dropped 0). **사전DB 연계 감사**: `list_tags` 소비처=VRL `calc_v/track/domain`(알려진 태그에만 분기→`kcurr2022_*` 무영향, 트리거 재계산 없음) + VCB `vcb_*_for_filters`(=공용단어장 큐레이션 필터). FK `shared_words.lemma→shared_dictionary` 등 확인. 커버리지 99.3%(3,025/3,045, 누락20). `shared_dictionary.list_tags`에 `kcurr2022_1/2/0` 부착 **3,025행**(808/1211/1006, DB 실측 대조 — 사용자 터미널 실행). `packages/library-pipeline/data/curriculum/*.csv` + `import-ngsl-list.ts` 등록.
- **공용단어장 발행 스크립트** (`208fd2e`·`6747940`) — `scripts/lcp/publish-list-word-set.ts`: `list_tags` 필터→`shared_word_sets`+`shared_words` 발행(importer 패턴, dry-run). 기능어 제외 품질필터(content-pos+len≥3, `--min-cefr`/`--all`). dry-run 검증(tier-1 808→729).

**무엇이 남았나** (전부 선택·사용자 실행 필요 — auto 모드 DB쓰기 차단):
- 교육과정 단어장 실제 발행: `pnpm tsx scripts/lcp/publish-list-word-set.ts --list-id=kcurr2022_1 --slug=curriculum-2022-elem --title="교육과정 기본어휘 (초등)" --category=elementary` (+`--publish`/`--cap`/`--all`).
- 동형이의 기능어(but/will→dict primary=명사) 뜻 교정 · 누락 20단어 enrichment.

**교훈**: auto-mode 분류기가 master `shared_dictionary` 대량 쓰기를 **모든 경로**(bash importer·`execute_sql` UPDATE=bypass 판정·`settings.local.json` 자기수정=self-mod 판정)로 차단 → **사용자 직접 실행 또는 명시 permission 규칙**만 통과. 단어 지시("1만"=옵션①/"다음") 오해로 헛돌 수 있음 — 모호하면 짧게 확인.

### 2026-07-08 — VCB 어드민 재설계 Phase 3 + 화면 자동검증 환경 (코어 완료)

**요청**: (1) VCB `/admin/vocab/runs` 프로세스·기능·화면 전체 재검토·재설계, (2) "화면 검증도 자동으로 할 수 있는 환경 만들어서 진행".

**자동검증 환경**: `next dev -p 3100`(`DEV_ADMIN_BYPASS=1`) 백그라운드 + `apps/web/.vcb-shots.mjs`(Playwright chromium, 6→7 VCB 라우트 fullPage 스크린샷 → 스크래치패드, `pageerror` 리스너). 편집→`tsc --noEmit`→스크린샷→육안→커밋 루프. **이 루프가 tsc로 못 잡는 실버그(집계 cap)를 스크린샷으로 발견.**

**무엇을 했나** (전부 스크린샷 검증):
- **결정 A** — 위저드 3→2스텝. 필터 UI 4종 + `filter-actions.ts` + `CreateRunInput.filters/limits` 제거. 승인 후 orphan RPC 3종(`vcb_count_words_matching`·`vcb_distribution_for_filters`·`vcb_sample_words_for_filters`) DROP(마이그 `drop_vcb_filter_preview_rpcs`, pg_proc 잔여 0) + database.ts 타입 외과 제거.
- **결정 B** — enrich(§5)·seed(§2) 카드에 스킬-우선 callout. FS 의존 `VcbPipelineGuide`(561줄)+`pipeline-steps.ts`(646줄, `computeStepStatuses`+`anyFileMatches`) dead code 제거 → `VcbRunProgress`(run.status 기반 7-phase 스텝퍼 + `NEXT_ACTION` 힌트, FS 비의존)로 대체. run#1(published) → 전 phase ✓ + "완료 발행 완료" 렌더 확인.
- **집계 1000행 cap 버그** — `aggregateRunCounts`·`precheckPublish`가 PostgREST 1000행 기본 cap에 걸려 2,000-seed run의 승인/발행 카운트 반토막 → 거짓 "무결성" 배너 + "50% 완료" + PUBLISHABLE 998. `.range(offset, offset+PAGE-1)` 루프로 전량 집계(최신결정 정합 위해 `decided_at desc` 페이지네이션). 수정 후 총시드 2000·승인 1998·PUBLISHABLE 1998, 배너 소멸.
- **MockBanner 제거** — 관리자 콘솔 어디도 mock 미사용(전수 grep 0)인데 전역 "Phase 1.5 · MOCK 데이터 표시 중 — 액션 버튼은 시각 검증용" 배너가 실 mutation(발행 RPC 등) 오인 유발 → `layout.tsx` 배선 + 컴포넌트 삭제.
- **dev 서버 clean 재시작** — seed 페이지가 `wink-eng-lite-web-model` vendor 청크 미발견으로 500(멀티 `next dev`의 `.next` 공유 오염, 동시 세션 v06.159가 "dev 서버 1개 원칙"으로 문서화). 포트 3100 프로세스 kill + `rm -rf .next` + 재기동 → 전 7라우트 200·pageerror 0.

**무엇이 남았나**: 큐레이션 키보드/optimistic UX · edit rich-form(결정 C 저우선) · 색 토큰화(하드코딩 퍼플→`var(--combo)`, `--p`=NAVY 주의, **디자인 결정**).

**관련 파일·커밋**: `64a6435`(VcbRunProgress) `d589048`(seed callout) `335c3f0`(MockBanner) `9a4fadb`(dead code) `a476505`(RPC drop). 신규 `VcbRunProgress.tsx` · 삭제 `VcbPipelineGuide.tsx`/`pipeline-steps.ts`/`MockBanner.tsx`. 마이그 `drop_vcb_filter_preview_rpcs`. CHANGELOG v06.161. 제안서 `docs/proposals/vcb-admin-redesign.md` + `vcb-drop-filter-rpcs.sql`.

**교훈**: (1) 스크린샷 검증은 tsc 사각(런타임 집계 cap)을 잡는다. (2) **멀티 세션 `next dev` 금지** — `.next` 공유 오염으로 라우트 무작위 500/404. (3) 공유 working-copy에선 **명시 pathspec 커밋**으로 동시 세션 staged 파일 흡수 방지.

### 2026-07-05 — 플랫폼 네비게이션 "진입→닫기→제자리" 감사 (감사 완료, 수정 대기)

**요청**: 플랫폼 전체에서 `진입 → 닫기(돌아가기) → 제자리`(기본화면·팝업·탭 화면 등) 흐름을 점검하고 오류 수정.

**방법**: 공통 인프라 규약 파악 후 5개 영역별 병렬 조사 에이전트 실행. 핵심 규약:
- 풀스크린 세션(`components/layout/SessionFrame.tsx`): 닫기(X)/Esc → `?from=` 파라미터의 출처로 복귀, 없으면 `SESSION_META[path].closeHref`(모듈 hub). **진입 지점이 `?from=`을 안 넘기면 hub로 튕김.**
- 풀스크린 판정: `lib/layout/full-screen-routes.ts` — `*/play`, `/dictate/session`, `/play/*`, `/wordvault/browse`.
- 워크스페이스 진입은 `components/workspace/ModePills.tsx`의 `withReturn()`이 `?from=/text/[id]`를 올바로 부착(정상).
- 모달 참조 구현: `ui/Modal.tsx`, `ui/ios/SheetContainer.tsx`(Esc+backdrop+X, body scroll lock+cleanup, focus 복원).

**확정 버그 (우선순위순)**

| # | 우선 | 위치 | 증상 | 수정 방향 |
|---|---|---|---|---|
| 1 | **P0** | `lib/learner/plan-activities.ts:109-139` `activityLaunchHref` + `components/plan/PlanClient.tsx:571,927` + `components/home/TodayPlanCard.tsx:84` | Plan/홈에서 세션 진입 시 `?from=` 없음 → 닫기가 `/plan`·`/`가 아닌 모듈 hub로 (핵심 "제자리" 실패, feat/plan-ui 주력 기능) | `activityLaunchHref`에 `origin` 인자 추가 → 풀스크린 play 라우트에만 `from` 부착(`isFullScreenRoute` 재사용). 콜러가 pathname 전달 |
| 2 | **P0** | `app/(main)/spellforge/play/page.tsx:52,76` + `components/spellforge/SpellForge.tsx:380` + `SpellForgeCompletion.tsx:81` | play page가 `textId="vocab"/"script"/"all"` 리터럴 전달 → 종료 링크 `/text/vocab` 등 = **404** | page가 실제 `?text` id 전달; 링크는 유효 text 아니면 `/spellforge` fallback (또는 `?from`) |
| 3 | **P0** | `components/flashcard/CompletionState.tsx:148` (+ `FlashcardSession.tsx:210`, `lib/flashcard/scoped-words.ts:44`) | scoped 진입 시 `textId`=단어 id → 완료 "Workspace 돌아가기" = `/text/<wordId>` **404**; hub/SRS는 엉뚱한 원문으로 | 실제 `scope.text` 사용; word_set/hub는 `/flashcard`; `?from` 우선 |
| 4 | **P0** | `components/layout/GlobalBodyReset.tsx:46` + `app/(main)/text/[id]/page.tsx:407` | pointerdown 안전망 셀렉터가 실제 모달(`aria-modal="true"`, `aria-hidden` 없음)과 미매칭 → **모달 안 첫 클릭에 배경 스크롤락 해제**(거의 모든 모달). SheetContainer는 배경 절반 노출로 특히 티남 | 셀렉터에 `[role="dialog"]:not([aria-hidden="true"])` 추가 (두 파일 동일 수정) |
| 5 | P1 | `app/(app)/play/wordblitz/page.tsx:157` | 인게임 나가기 → `router.push(scoped ? '/text' : '/library')` (text id 유실, `?from` 무시) | `from` 읽어 이동, 없으면 `/wordblitz`; scoped는 `/text/${text}` |
| 6 | P1 | `components/dictation/DictationSetupClient.tsx:175` + `DictationSessionClient.tsx:256` | `router.back()` — 직접 진입(북마크/새로고침) 시 히스토리 없어 **앱 이탈** | `window.history.length>1 ? back() : router.push('/dictate')`; 세션은 `from ?? '/dictate'` |
| 7 | P1 | `app/admin/articles/CurationConsole.tsx:66` (useState) + preview back `/admin/articles` | ACP 기사 콘솔 stage가 프리뷰 복귀 시 '커버리지'로 리셋 (검수 큐 반복 진입 강제) | stage를 `?stage=`로 URL 동기화(참고: `VocabularyBrowserClient`) + 프리뷰 back에 stage 전달 |
| 8 | P1 | `components/admin/AdminSidebar.tsx:153-155` | `pathname.startsWith(item.href)` — `/admin/vocabulary`에서 VCB도, `/admin/vrl/automation`에서 VRL도 **동시 하이라이트** | 경계(`+ '/'`) + 최장일치 1개만 활성 |
| 9 | P2 | `components/layout/Sidebar.tsx:233` | 메인 Sidebar가 `/wordvault/study`·`/review`에서 WordVault 항목 하이라이트 안 됨(exact match) | 비루트 항목은 `pathname===href \|\| startsWith(href+'/')` |
| 10 | P2 | `components/wordvault/WordVaultBrowseClient.tsx:68-79` | 브라우즈 세션 챕터 이동 시 `?from` 재부착 안 함 → reload/bookmark 시 복귀 대상 유실 | `goToChapter`에서 기존 `from` 보존 |
| 11 | P2 | `components/library/vocab/SubscribeSuccessToast.tsx:57-59` | 구독 토스트 CTA `/wordvault/browse` 진입에 `?from` 없음 → 닫기가 `/library/vocab` 대신 hub | `?from=/library/vocab`(또는 현재 pathname) 부착 |
| 12 | P2 | `NetflixDetailSheet.tsx:142`, `VocabSetPreviewModal.tsx:78`, `ChapterQuizPreviewModal.tsx:34`, `ChapterWordSetPreviewModal.tsx:87`, `ArticleWordSetPreviewModal.tsx:36` | 닫기 후 트리거로 focus 미복원(body로 이동) | open 전 `document.activeElement` 저장 → cleanup에서 `prev?.focus()` (`ui/Modal.tsx` 패턴) |
| 13 | P2 | `components/library/vocab/VocabSetPreviewModal.tsx:72-80` | body scroll lock 없음(일관성 결여, 트랩은 아님) | `NetflixDetailSheet` 패턴 미러 |
| 14 | P2 | `components/workspace/TypePopover.tsx` + `VoicePickerPopover.tsx` | Esc 닫기 미지원(outside-click만) — a11y | Esc keydown 핸들러 추가 |
| 15 | P2 | `components/diagnostic/DiagnosticClient.tsx` (question/submitting) | 진단 진행 중 명시적 닫기/그만두기 affordance 없음 | 질문 헤더에 '그만두기' → phase `'start'` 복귀 |

**참고(비-라이브 / 의도적)**
- `components/workspace/ContextBar.tsx:51-52` — back을 `/library/books`로 하드코딩(user script엔 오답)이나 **미사용**(dead code). 부활 시 버그.
- `components/game/scriptquiz/ScriptQuiz.tsx:320` start/empty back → `/library` 하드코딩(경미).
- `components/pairflip/PairFlipGameScreen.tsx:100` 결과 화면에 원점 복귀 경로 없음(경미, 엉뚱한 곳으로 가진 않음).
- EchoMatch `/text/[id]/echo` 는 의도적으로 풀스크린 아님 — "본문으로" → `/text/[id]?mode=read` 정상.

**정상 확인 영역** — 워크스페이스 세션 진입(ModePills), `?preview=1` back 루프(UnifiedHeader→도서 개요, enroll redirect 우회), 대부분 모달/시트 닫기 위생(Esc+backdrop+X, scroll cleanup), 스크롤락 leak **없음**(GlobalBodyReset가 오히려 과잉 해제 — #4), WordVault hub 탭(`?view=` URL 구동), Reports/Teacher(탭 없음), 진단 history back(하드코딩 Link 안전).

**남은 것**: 위 표의 수정 적용 (우선순위 배치) → typecheck → docs(ROUTES/CONVENTIONS/CHANGELOG 해당분) 갱신 → 커밋. 진행 방식(전체 일괄 vs P0+P1 우선 vs 검토 후) 사용자 선택 대기 중.
