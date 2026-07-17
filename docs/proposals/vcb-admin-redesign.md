# VCB Pipeline Admin — 재검토 · 재설계 제안서

> 대상: `/admin/vocab/*` (VCB = 공용 단어장 빌드 파이프라인). 작성: 2026-07-06.
> 방법: 5개 영역 병렬 코드 감사(프로세스/화면/seed·curate 플로우) + DB 실측 + 라이브 화면 1샷.
> 상태: **진단 완료 · 재설계 범위 사용자 승인 대기.** (구현 전)

---

## 0. 한 줄 요약

정교한 "셀프서비스 파이프라인 콘솔"처럼 보이지만, 실제로는 **딱 한 번(cast-2000) CLI로 돌린 개발자용 반자동 도구**이고, **지금 UI만으로는 run을 완주할 수 없다**(구조적 dead-end). 데이터 모델은 건전하나 UI 배선·정합성·카피가 깨져 있다.

---

## 1. 실체 (Reality check)

- **run 총 1개** — `vocab_runs` 전체 = `id=1, cast-2000(필수2000), published`. 2026-05 생성, **Method B + CLI/SQL로 out-of-band 완주**. 위저드/프리셋/필터 machinery로 만들어진 run은 **0개**.
- **아키텍처**: Postgres RPC 거의 없음. 모든 단계 = `클라이언트 카드 → Next Server Action → pure-TS core(@vocaflow/vcb-curate-core) → 테이블 R/W`. seed·enrich 2단계만 **서버 호스트에서 `claude -p` CLI를 detached spawn** + 로컬 FS(`exports/vcb-jobs/`) 폴링. (serverless/multi-instance에서 깨짐. 실권장 경로는 out-of-band 스킬 `/vcb-seed-list`·`/vcb-batch-enrich`.)
- **status enum** `vcb_run_status` 11단계: created→ingesting→normalized→extracted→looked_up→enriching→qa→curating→publishing→published(+failed).
- **테이블 9개**: sources→raw_texts→seed_candidates→dict_hits→enrichment_queue(+qa)→curation_decisions(append-only)→collections(발행: shared_word_sets/shared_words).

---

## 2. 🔴 정합성 결함 — "지금 UI로는 동작하지 않는다" (P0)

| # | 결함 | 위치 | 영향 |
|---|---|---|---|
| P0-1 | **파이프라인 dead-end** — `qa→curating` 전이를 하는 코드가 **어디에도 없음**. QA는 `qa`에서 멈추고, 큐레이션 액션은 `vocab_runs.status`를 안 건드림. `curating`은 오직 publish 실패 롤백에서만 세팅. 그런데 precheck/Publish 카드는 status가 `curating`이어야 등장·통과. | core `qa.ts:265`, `curation.ts`(전이 없음), `publish.ts:166`(유일 curating), `precheck.ts:55`, `runs/[id]/page.tsx:284` | **UI만으로 몰면 run이 qa에서 영구 정지. Publish 불가.** cast-2000은 CLI로만 탈출. |
| P0-2 | **dev-bypass에서 데이터 0건** — `fetchRuns()`가 `requireAdmin`(dev-bypass 통과) 후 **RLS-bound client**로 조회. dev-bypass는 세션 미생성 → `auth.uid()=NULL` → 정책 `admin_curator_all` 차단 → **runs 목록·상세·큐레이션 전부 빈 화면**. (ACP는 이미 service_role API route로 해결.) | `lib/vcb/server/runs.ts:15-18` + RLS `vocab_runs.admin_curator_all` | **개발/검증 환경에서 VCB 어드민 전체가 사용 불가.** |
| P0-3 | **큐레이션 500건 silent 절단** — `fetchQueueItems(runId)`가 옵션 없이 호출 → core 기본 `limit=500`. 필터·정렬 전부 client-side. cast-2000(~2000단어)은 **500건만 로드, 나머지 1500건은 큐레이션 UI에서 도달 불가**. | `curate/[run_id]/page.tsx:23`, core `queries.ts:251` | 500+ run은 사실상 큐레이션 불가. |
| P0-4 | **발행 후 404** — publish 성공 시 "Collections 목록 보기" → `/admin/vocab/collections` (**존재하지 않는 라우트**). | `VcbStep8PublishCard.tsx:202` | 성공 직후 admin이 404로. |
| P0-5 | **bulk·edit 완전 dead-end** — 체크박스+`selectedIds`+`bulkApprove/bulkReject`+`editQueueItem` 서버액션 **전부 존재하나 어떤 UI도 호출 안 함**. 큐레이션은 1건씩만. "수정"은 UI에서 불가한데 가이드는 광고. | `VcbCurationView.tsx:31`, `VcbCurationList.tsx:63-79`, `server/curation.ts:75-166` | 대량 flagged 검토가 1건씩 → 실질 불가능한 노동량. |

**정합성(데이터) 결함:**
- P0-6 **"publishable" 정의 3곳 불일치** → 무결성 미스매치 배너. publish는 "최신 decision이 reject 아닌 enriched 전부"(=승인+수정+**미검토** 포함) 발행, `approved_count`는 "과거에 approve 있었던" 카운트, precheck는 또 다른 공식. **미검토 enriched 단어가 조용히 발행됨.** (`publish.ts:172`, `queries.ts:70`, `precheck.ts:132`)
- P0-7 **publish 비트랜잭션** — shared_word_sets→shared_words→vocab_collections 순차 insert, 중간 실패 시 orphan 발행 세트 + word_count 캐시 불일치. (`publish.ts:88-154`)
- P0-8 **죽은 status/로직** — `pipeline-steps.ts`가 enum에 없는 `'curated'`를 검사(dead). `normalized/failed/skipped`는 UI 플로우에서 미발생. (`pipeline-steps.ts:556,570,579`)

---

## 3. 🟠 구조·UX 결함 (P1)

- P1-1 **스텝 번호 4중 충돌 + "Step 2+3"이 "Step 1" 위에 렌더**. 파이프라인(1,2+3,4..8) vs seed-flow 내부(1,2,3) vs 생성 위저드(1,2,3) vs Method A/B(택1인데 순차처럼). `created` run엔 Method A 카드와 Method B 카드가 "택1" 안내 없이 동시 노출. (`runs/[id]/page.tsx:151-203`)
- P1-2 **위저드 필터 매트릭스가 downstream 미소비** — `config.filters/limits/preset_id`를 저장하지만 **어떤 단계도 다시 읽지 않음**. `buildSeedSpec`는 CEFR/segment만 사용. Step 2의 V-Level/list_tags/freq/POS 매트릭스 + 라이브카운트 + 분포 + 샘플 전체가 **유일 실경로(Method B AI)와 무관한 장식**. (run-create.ts, seed.ts:109)
- P1-3 **시드 정의를 2번** — 위저드에서 segment/CEFR/filters 수집 후, seed 스텝에서 target_count/domain/must_include를 **재수집**. 위저드 의도가 AI spec으로 안 넘어감. (`VcbSeedFlow.tsx:64`)
- P1-4 **완성된 오리엔테이션 UI가 dead code** — `VcbPipelineGuide.tsx`(562줄: 진행%·다음 액션·단계별 시간/비용·why/prereq/verify) **어디서도 import 안 됨**. run 상세는 "너 여기 있고 다음은 이거" 없이 status-gated 플랫 스택. (orphan)
- P1-5 **섹션 내비 없음 · Sources 고아** — `layout.tsx`에 탭/브레드크럼 0. Runs↔Sources 링크 단방향(Sources→Runs만). `loading.tsx`/`error.tsx` 부재(형제 섹션엔 있음).
- P1-6 **원시 status·dev-jargon 도처 노출** — 서브타이틀 `slug · enriching`, `seed-list.jsonl`/`validation.json`, `/vcb-seed-list …`, `vocab_dict_hits`/`qa_flags`/`shared_word_sets`, `vocab-sources-raw 버킷`, `guard_ai_generated_license`, R1~R8, SHA-256/WLP. 운영자 화면에 내부 구현이 그대로.
- P1-7 **stale·모순 카피** — runs 빈상태 "New Run은 P5c에서 구현…SQL로 직접 생성"(바로 위에 작동하는 New Run 버튼). 전역 MockBanner "MOCK 데이터 표시 중—버튼은 시각검증용"(일부 영역은 실제 작동).
- P1-8 **컴포넌트 패턴 불일치** — 큐레이션만 hand-rolled 헤더(나머지 `AdminPageHeader`). 스텝 = bespoke 카드 6종 + 범용 `VcbStepTriggerCard` 1종(딱 1곳). Step 1은 컴포넌트 아닌 인라인 `<Link>`.

## 4. 🟡 폴리시 (P2)

- 큐레이션: 키보드 내비 0, optimistic UI 0, 결정마다 전체 re-fetch(≤500 + 조인), 상세 패널 stale, re-enrich는 out-of-band 수동(슬래시명령 복붙).
- 접근성: 44px 미만 타겟 다수, focus-visible 링 부재, 색상 단독 신호, 하드코딩 `#6D28D9`(→`--p` 규칙 위반, 6곳)·`#FFFFFF`.
- seed/preview: 타이머 자동 리다이렉트 2곳(1.2s·1.5s) 취소 불가, import 문 2개(미리보기 없이 vs 반영) 검토 우회 가능, 프리셋 힌트 하드코딩 추정치.

---

## 5. 재설계 비전

### 5.1 핵심 원칙
1. **"동작하는 파이프라인" 우선** — UI만으로 create→…→publish 완주 가능해야 한다(P0 전부 해소).
2. **정직한 정보 구조** — 실체(저빈도 전문가 도구 + 일부 out-of-band)를 숨기지 말고, "자동/수동" 경계를 명확히 라벨.
3. **단일 진행 모델** — 스텝 번호 체계 하나. run 상세 = "현재 단계 · 다음 액션 · 전체 진행%" (dead `VcbPipelineGuide`를 실사용으로 승격 or 재작성).
4. **택1 시드 진입** — Method A(파일) vs Method B(AI)를 명시적 분기로. 위저드 필터는 (a) Method B spec에 실제 반영하거나 (b) 정직하게 제거.
5. **service_role 일관화** — ACP 패턴처럼 admin API route + service_role로 dev/prod 공통 동작.
6. **디자인 시스템 정합** — inline-style→토큰/Tailwind, `--p` 통일, 44px·4-state·focus 규칙 준수, jargon→운영자 언어.

### 5.2 목표 정보 구조 (제안)
```
/admin/vocab                      → 섹션 셸(탭: Runs · Sources · [Collections])
  /runs        Runs 목록(KPI + 카드, 실데이터)
  /runs/new    Create(택1: A 파일 / B AI) — 단일 위저드, 필터는 spec에 반영 or 제거
  /runs/[id]   Cockpit — 진행% + 현재/다음 액션 하이라이트 + 단계 타임라인 + 정합성 경고
  /runs/[id]/seed(+preview)  Method B 상세(운영자 언어)
  /curate/[id] 큐레이션 — 페이지네이션/전량 로드 + bulk + edit + 키보드 + optimistic
  /sources(+new)  Sources (Runs와 양방향 링크)
  /collections 발행 결과(신설 — P0-4의 죽은 링크 목적지)
```

---

## 6. 단계별 실행안 (Phase)

**Phase 1 — 정합성/작동 (P0)** · 목표: UI만으로 run 완주 + dev에서 표시
- `qa→curating` 명시 전이(큐레이션 "검토 시작" 또는 QA 통과 시). Publish 게이트 정합.
- fetchRuns/fetchRunDetail/curate 조회를 **service_role API route**로(ACP 패턴) → dev-bypass에서도 표시.
- 큐레이션 500-cap 제거(서버 페이지네이션 or 전량) + 필터/카운트 정합.
- "Collections 목록 보기" → 실제 `/admin/vocab/collections` 신설(or 발행세트 상세).
- bulk approve/reject + edit UI 배선(이미 있는 서버액션 연결).
- publish 트랜잭션화 + "publishable" 정의 **단일화**(미검토 발행 차단).

**Phase 2 — 구조/UX 정리 (P1)**
- 스텝 번호 체계 통일 + Method A/B "택1" 분기 + `VcbPipelineGuide` 실사용 승격(진행%/다음 액션).
- stale·모순 카피 제거(P5c/MockBanner), 원시 status→라벨, dev-jargon→운영자 언어.
- 섹션 탭 내비 + Runs↔Sources 양방향 + `loading/error.tsx`.
- 컴포넌트 패턴 통일(헤더·스텝 카드).

**Phase 3 — 심화/아키텍처 (P2, 대형)**
- 위저드 필터를 Method B spec에 실제 반영 or 제거(택1 결정 필요).
- 큐레이션 키보드/optimistic/undo.
- CLI-spawn(claude -p) → 정식 잡 러너 or 순수 out-of-band 스킬로 정리(FS 결합 해소).
- 디자인 토큰/접근성 전면 정리.

---

## 7. 결정 확정 (2026-07-06) + 구현 계획
> 사용자 결정 완료 → Phase 3 방향 확정. **구현은 구조 변경이 많아 dev 서버 재가동 후 실측하며 진행.**

- **C. 도구 지향 = 저빈도 전문가 도구** ✅ — 셀프서비스 폴리시에 과투자하지 않는다. 정합성·명확성만 유지하고 aspirational 요소를 정리.
- **A. 위저드 필터 매트릭스 = 제거** ✅ — `config.filters/limits/preset_id` 는 어떤 파이프라인 단계도 미소비(dead weight). **구현**:
  1. `VcbRunCreateForm` 3-step(Preset→Filter→Meta) → **Preset(선택) → Meta 2-step** 로 축소. FilterPanel 스텝 + `canAdvance(matchCount>0)` 게이트 제거.
  2. `wizard/{FilterPanel,LiveCountBadge,DistributionChart,SampleWords}` + `server/filter-actions.ts` + 프리뷰 RPC 3종(`vcb_count_words_matching`·`vcb_distribution_for_filters`·`vcb_sample_words_for_filters`) 제거.
  3. `run-create.ts` config 에서 filters/limits/preset_id 저장 제거 + `RunConfig` 타입 정리.
  4. ⚠️ 다단계 폼 상태머신 변경 → **dev 서버 실측 필수**(스텝 네비게이션·제출).
- **B. CLI 결합 = out-of-band 스킬을 정식 경로로** ✅ — 서버 `claude -p` spawn 은 배포(서버 FS·멀티인스턴스)에서 깨짐. **구현**:
  1. seed(`VcbSeedFlow` §2)·enrich(`VcbStep5EnrichCard`) UI 에서 "**스킬로 실행**(`/vcb-seed-list`·`/vcb-batch-enrich`)"을 주 안내로, in-UI 러너는 "dev 편의(로컬 전용)" 보조로 라벨·순서 조정.
  2. FS/marker 폴링 의존 축소 — 진행 상태는 DB(queue status)에서 우선 판정.
  3. ⚠️ UI 재배치 → dev 서버 실측 권장.

**착수 순서 (dev 서버 재가동 시)**: A(위저드 축소 — 정리효과 최대) → B(스킬 경로 라벨) → Phase 2 잔여(`VcbPipelineGuide` 승격·색 토큰) → 큐레이션 UX(키보드·optimistic·edit).

---

*진단 근거: 파일·라인·RPC·테이블명은 본문 참조. 결정 3종 확정(2026-07-06). 구현·라이브 검증은 dev 서버 재가동 후.*
