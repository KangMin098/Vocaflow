# 영역 감사 — Admin 콘솔 · 운영 자동화 · 에이전트/개발 인프라

> 기준: `D:\workspace\Vocaflow-platform-audit` @ `a7c986469`(origin/main, PR #154 머지) · 측정일 2026-10-09.
> 근거: 저장소 grep · `gh run list/view` · DB 직접 질의(`cron.job`, `cron.job_run_details`, `db_health_*`, `funnel_events`).
> 상태 어휘: VERIFIED_WORKING / IMPLEMENTED_UNVERIFIED / PARTIAL / DESIGN_ONLY / EXPERIMENTAL / UNMERGED / DEPRECATED / UNKNOWN.
> 화면별 런타임 렌더링은 이번 감사에서 띄워 보지 않았다 — 화면은 별도 근거가 없으면 IMPLEMENTED_UNVERIFIED.

## 0. 핵심 발견 (먼저 읽을 것)

1. **프로덕션 배포가 일어나지 않는다.** `.github/workflows/deploy.yml` 은 main push 마다 "성공(초록)" 으로 끝나지만, 최근 실행(run 37785693595) 로그에 `배포 건너뜀 — VERCEL_TOKEN / VERCEL_PROJECT_ID 미설정`. `gh secret list` 에는 `PLAYWRIGHT_RUNTIME_PASSWORD` 하나만 보인다. 초록불이 배포 부재를 가린다 → 상태 **PARTIAL**(코드 완성, 시크릿 없음). `vercel.json` 도 저장소에 없다.
2. **야간 CSAT 원문 무결성 워크플로가 연속 실패.** `csat-source-audit.yml`(워크플로 이름 "CSAT source integrity", cron `20 19 * * *`) 최근 3회(10-06, 10-06, 10-07) 모두 `failure`. 아무도 알림을 받지 않는 구조(실패 시 이슈/알림 단계 없음).
3. **pg_cron 15개 중 14개 활성, 최근 14일 실패 0.** 운영 자동화 중 실제로 도는 것은 DB 안쪽 cron 뿐이다(`library-pipeline-worker` 매분 작업은 `active=false`, `recompute-kr-safe` 는 연 1회라 실행 이력 없음).
4. **DB 헬스는 "측정은 자동, 판정·조치는 수동".** `db_health_metrics` 10,466행(일·주 cron 적재) vs `db_health_findings` 미해결 **26건**. 판정(`/db-health-audit`)·조치(`/db-remediate`)는 Claude 슬래시 명령으로만 돈다.
5. **Admin 화면 6개는 목업 데이터** — `/admin/analytics` `/admin/billing` `/admin/library` `/admin/reports` `/admin/settings` `/admin/users` 가 `MockDataBanner` 를 띄운다(billing·library·reports·settings 는 페이지에서 Supabase 호출 0). 결제 API(`/api/billing`, webhooks)는 존재하지 않는다.
6. **도움말 커버리지는 사실상 완전**(아래 §2). 미적용은 `/admin/vocab/runs/[id]/seed/preview` 의 서버 페이지 정도(클라이언트 `VcbSeedPreviewClient` 에는 있음) — 구조적 결함 아님. 회귀 테스트 `help-registry.test.ts`·`help-links.test.ts` 가 지킨다.
7. **수요 계측은 작동하나 수요가 없다.** `funnel_events` 30일 14,806건 중 **고유 사용자 4명**, 69%가 `screen_viewed`. 이벤트 종류 46. 계측 인프라 VERIFIED_WORKING, 측정 대상 부재.

## 1. Admin 라우트 (87 페이지) — 무슨 일을 하나 · 상태

공통: 모든 페이지가 `@/lib/auth/require-admin` 로 서버 가드. 사이드바(`components/admin/AdminSidebar.tsx`)가 61개 링크를 갖고, 사이드바 밖 화면은 상세(`[id]`)·하위 탭(`kice/map|plan|predict` ← `/admin/kice`, `vocab/studio|collections|runs` ← `VcbSectionNav`)으로 모두 진입 경로가 있다 → **고아 화면 없음**.

| 그룹 | 라우트 | 하는 일 | 상태 · 근거 |
|---|---|---|---|
| 대시보드 | `/admin` (583줄) | 전 파이프라인 요약 지표(`lib/admin/dashboard-stats.ts`) | IMPLEMENTED_UNVERIFIED |
| CSAT 공장 라인 | `/admin/csat` + `new·sources·sourcing·authoring·explain·review·press·catalog·evidence·strategy·blueprint·details·help` | 기출형 문항 생산 라인 단계별 화면(StageFrame/FactoryLineClient). `sources` = 원문 감사·판정 드레인 진입 | IMPLEMENTED_UNVERIFIED (화면 테스트 `line-screens.test.tsx`·`sources-screen.test.tsx` 존재). 단계 화면 다수가 15–27줄 래퍼 — 실체는 공용 클라이언트 |
| CSAT 진단 | `/admin/csat/diagnosis` + `exams[/id]·learners[/id]·settings` | 학습자 진단 세션 관리(`/api/admin/csat/diagnosis/sessions`) | IMPLEMENTED_UNVERIFIED — 실제 학습자 4명 |
| KICE 분석 | `/admin/kice` + `[typeId]·item/[slug]·map·plan·predict` | 평가원 기출 유형 분석·예측 | IMPLEMENTED_UNVERIFIED |
| 지식/학습원리 | `/admin/knowledge` + 15 하위, `/admin/methodology` | 학습 원리·근거·실험실·제품 연결 | EXPERIMENTAL — 메모리상 methodology-vnext / knowledge-vnext 두 브랜치 병행(스키마 충돌 이력) |
| LCP 도서 | `/admin/library`, `/admin/curation[/preview]` | 도서 수집·큐레이션 게이트 | library = **DESIGN_ONLY(목업 배너)**, curation = IMPLEMENTED_UNVERIFIED |
| ACP 기사 | `/admin/articles[/preview/id]` | 14 소스 피드 수집·재큐·강제발행 | IMPLEMENTED_UNVERIFIED (피드 API 15종) |
| 조판 | `/admin/compose` | 지문 조판/생성 | IMPLEMENTED_UNVERIFIED |
| 만화 | `/admin/comic[/bookId[/drain]]`(CCP 도서→만화), `/admin/pd-comics[/reader]`(PDCP PD 만화 현대화) | 두 개의 별도 만화 파이프라인 | IMPLEMENTED_UNVERIFIED — 발행 `comic_books` 1권 |
| 토픽 코퍼스 | `/admin/topic-corpus` | TCP enqueue/drain/promote | IMPLEMENTED_UNVERIFIED |
| 어휘 | `/admin/vocab/*`(VCB 런·시드·큐레이트·스튜디오·컬렉션·소스), `/admin/vocabulary`, `/admin/pending-words` | 사전 구축·시드·드레인 판정 | IMPLEMENTED_UNVERIFIED; `/admin/vocab` 는 `/admin/vocab/runs` 리다이렉트 |
| VRL | `/admin/vrl` + `taxonomy·diagnostic·users·concerns·snapshots·automation` | 4축 분류·진단·자동승격 | VERIFIED_WORKING(자동승격 부분: cron `vrl-auto-promote-daily` 10-07 성공), 화면은 IMPLEMENTED_UNVERIFIED |
| 품질 | `/admin/quality` + `gates·judge` | 품질 지표·콘텐츠 게이트 | 지표 적재 VERIFIED_WORKING(cron `quality-metrics-nightly`·`content-gate-nightly` 성공) |
| DB | `/admin/db` (675줄) | db_health 지표·발견 보기 | IMPLEMENTED_UNVERIFIED (데이터는 실재) |
| 영상 | `/admin/video[/requests/id]` | 영상 요청 설계 드레인 | IMPLEMENTED_UNVERIFIED |
| 운영 일반 | `/admin/users` `/admin/analytics` `/admin/reports` `/admin/billing` `/admin/settings` | 사용자·분석·리포트·결제·설정 | **DESIGN_ONLY / PARTIAL** — 6화면 `MockDataBanner`; users·analytics 만 Supabase 일부 호출 |

### 중복 시스템
- **만화 2계통**: `/admin/comic`(CCP) vs `/admin/pd-comics`(PDCP) + API `/api/pdcp/*` 22개. 목적은 다르지만(생성 vs PD 복원) 학습자 화면도 `/comics/adapted` vs `/comics/restored` 로 갈려 운영 화면 2벌.
- **어휘 2계통**: `/admin/vocab/*`(VCB) vs `/admin/vocabulary`(+`/admin/vrl` 메인이 dict 헬스 쿼리 사용). VRL 메인 페이지가 `lib/admin/dict/*` 를 import — VRL 과 사전 품질이 한 화면에 섞임.
- **CSAT 분석 2계통**: `/admin/kice/*`(기출 분석) vs `/admin/csat/*`(생산 라인) vs `/admin/knowledge/sources/csat`. 세 곳이 기출을 각각 다른 관점으로 다룬다.
- **지식 2계통**: `/admin/knowledge/*` vs `/admin/methodology` (브랜치 두 개 병행 중 — UNMERGED 위험).
- **dev-* API 계열**: `/api/acp/dev-*`, `/api/lcp/dev-*`, `/api/csat/dev-paper` 는 프로덕션 비활성(`dev-process disabled in production`) — 운영 경로와 개발 경로가 병존.

## 2. Admin 화면도움말 커버리지

- 레지스트리: `apps/web/src/lib/admin/help/index.ts` 가 16 파일 병합(articles·comic·compose·csat·csat-diagnosis·kice·knowledge·curation·ops·pd-comics·quality·textbook·topic-corpus·vocab·video·vrl). types.ts 제외.
- 렌더 경로: `AdminScreenHelp` 를 page.tsx 직접 또는 `StageFrame`(CSAT)·`StepHeader`(factory)·`KnowledgeFrame`·`FactoryLineClient`·각 `*Client.tsx` 가 포함. 87 페이지 중 page.tsx 직접 미포함 28개는 모두 클라이언트/프레임 컴포넌트에서 렌더 확인(`csat/details` → `FactoryLineClient` L25).
- 회귀: `app/admin/__tests__/help-links.test.ts`, `lib/admin/__tests__/help-registry.test.ts`, `help-diagram.test.ts`, `compose-help.test.ts`.
- **빈칸**: `textbook.ts` 도움말이 있으나 대응 전용 라우트 `/admin/textbook` 은 없음(csat/details 의 TextbookProductionPanel 로 흡수). 목업 6화면에도 도움말이 있어 "도움말은 있는데 데이터는 가짜" 상태.
- 판정: VERIFIED_WORKING(가드 테스트 근거) — 단, 내용 최신성은 미검증.

## 3. Admin API (91 라우트 중 운영 관련)

| 계열 | 수 | 용도 | 상태 |
|---|---|---|---|
| `/api/admin/articles/*` | 22 (피드 15 + 조작 7, `reading-promotion` 신규) | ACP 소스별 피드 수집·삭제·재큐·강제발행 | IMPLEMENTED_UNVERIFIED (`route-callers.test.ts`) |
| `/api/admin/library/*` | 13 | Gutenberg/LibriVox/OpenStax/StoryWeaver/Wikibooks/Wikisource 미리보기·시드 | PARTIAL — 고전 PD 도서는 메모리상 "퇴출" 결정; preview-gutenberg 등 잔존 → DEPRECATED 후보 |
| `/api/admin/csat/*` | 5 | 진단 세션·근거·가이드·문항·원문 | IMPLEMENTED_UNVERIFIED |
| `/api/pdcp/*` | 22 | PD 만화 파이프라인 전 단계 | IMPLEMENTED_UNVERIFIED |
| `/api/acp|lcp/dev-*`, `process`, `enqueue` | 10 | 큐 처리(개발 전용 다수) | dev-* = EXPERIMENTAL(프로덕션 차단) |
| `/api/topic-corpus/*` | 3 | TCP | IMPLEMENTED_UNVERIFIED |
| `/api/analytics/event` | 1 | 퍼널 이벤트 수신 | VERIFIED_WORKING (30일 14,806건 적재) |
| `/api/auth/callback` | 1 | Supabase OAuth 콜백 | IMPLEMENTED_UNVERIFIED |

## 4. 드레인(LLM 배치) 인프라

- **export/import 쌍 11개**: `scripts/csat/{analysis,compose,design}-drain-*`, `scripts/design/assets-drain-*`, `scripts/textbook/{adapt,explain,item,item-review,write}-drain-*`, `scripts/vocab/{brand,example-ko}-drain-*`. 그 외 API 형 드레인 `/api/pdcp/drain`, `/api/topic-corpus/drain`, `/admin/comic/[bookId]/drain`.
- **서브에이전트 7** (`.claude/agents/`): csat-item-analyst · csat-source-judge · pending-words-judge · vcb-curation-comparator · vcb-enrich-chunk · vcb-seed-validator · video-request-designer. Codex 쪽 `.codex/agents/*.toml` 미러(sync.mjs 생성).
- **슬래시 명령 14** (`.claude/commands/`): DB 4(checkpoint·health-audit·incident·remediate) · VCB 7 · pending-words-drain · dict-enrich · goal.
- **`.agents/skills`**: vocaflow-design · vocaflow-design-loop (AGENTS.md 가 가리키는 `.agents/skills/csat-source-audit/SKILL.md` 는 **존재하지 않음** → 문서 링크 깨짐).
- 상태: IMPLEMENTED_UNVERIFIED (드레인 자체는 과거 실적 — ScriptQuiz 1,292문항 등 — 이 있으나 이번에 재실행 안 함).
- **운영 부담**: 전 드레인이 **사람이 Claude Code 세션을 열어야만** 돈다. 스케줄러·큐 워커 없음(`library-pipeline-worker` cron 비활성). 콘텐츠 공급의 LLM 단계는 100% 수동 트리거.

## 5. 스케줄 작업

### pg_cron (DB 실측, 15개)
| job | 주기(UTC) | 활성 | 최근 | 14일 실패 |
|---|---|---|---|---|
| refresh-lemma-dominant-pos | 매일 17:30 | Y | 10-07 성공 | 0 |
| vrl-auto-promote-daily | 매일 18:00 | Y | 10-07 성공 | 0 |
| quality-metrics-nightly | 매일 18:10 | Y | 성공 | 0 |
| content-gate-nightly | 매일 18:25 | Y | 성공 | 0 |
| db-health-daily / queues-daily | 18:40 / 18:45 | Y | 성공 | 0 |
| db-health-integrity-weekly | 일 18:50 | Y | 10-04 성공 | 0 |
| gc-content-chunks | 매일 19:00 | Y | 성공 | 0 |
| classify-archaic-candidates-daily | 매일 20:00 | Y | 성공 | 0 |
| archive-stale-drafts | 토 17:00 | Y | 10-03 성공 | 0 |
| purge-cron-history-7d | 매일 04:00 | Y | 성공 | 0 |
| csat-source-snapshot | 6시간 | Y | 10-08 성공 | 0 |
| refresh-textbook-shelf-stats | 6시간 | Y | 성공 | 0 |
| recompute-kr-safe | 12/31 | Y | 이력 없음 | — |
| library-pipeline-worker | 매분 | **N** | 없음 | — |

→ VERIFIED_WORKING. 단 마이그레이션에서 grep 되는 `cron.schedule` 은 5종뿐 — 나머지 10개는 마이그레이션 밖(대시보드/수동 SQL)에서 등록됐을 가능성 → **스키마 재현성 결함**(새 환경에서 cron 이 재생성되지 않음). `refresh-hot-dictionary` 는 unschedule 됨(DEPRECATED).
- ACP 수집 `scripts/acp/collect-daily.mjs` 는 이름과 달리 스케줄러에 걸려 있지 않음(cron·workflow 어디에도 없음) → 수동 실행.

### GitHub Actions (4)
| 워크플로 | 트리거 | 내용 | 상태 |
|---|---|---|---|
| `ci.yml` (CI) | push/PR | agents check + 스크립트 테스트 + `turbo lint typecheck test` + build + Playwright 스모크(시크릿 없으면 skip) | VERIFIED_WORKING (10-08 연속 success) |
| `sync-check.yml` | push/PR | tsc, manifest, PR 브랜치 규칙 | VERIFIED_WORKING |
| `deploy.yml` (Deploy) | push main / 수동 | Vercel pull/build/deploy | **PARTIAL — 시크릿 미설정으로 매번 skip 후 success** |
| `csat-source-audit.yml` | 매일 19:20 UTC / 수동 | CSAT 원문 감사 `--check` | **실패 중**(최근 3회 failure) |

Node 20 액션 deprecation · ubuntu-latest → 26 이전(2026-10-19) 경고 있음.

## 6. Git 훅 · 에이전트 인프라 · worktree

- **git 훅**: `.githooks/pre-commit` 1개(`scripts/setup-git-hooks.mjs` 가 `core.hooksPath` 설정). 기능은 docs/AI_CONTEXT 미러 낡음 검사뿐, 인덱스 수정 안 함(DD-49). VERIFIED_WORKING(설계대로) — 단 설정 스크립트를 실행해야만 활성(클론 기본 비활성).
- **`agents/`**: `router.md`(분담) · `goal-review.md` · `handoff.md` · `DECISIONS.md` · `mcp.source.json`(→ `.mcp.json`/`.codex/config.toml` 생성) · scripts: `check.mjs`(AGENTS.md 크기·중복·D10 마이그레이션 번호 등, CI 에서 실행 → VERIFIED_WORKING) · `sync.mjs` · `lock.mjs`(쓰기 잠금) · `handoff.mjs`/`handoff-inject.mjs`(SessionStart 주입) · `review.mjs`(Codex 목적 대조 리뷰) · `guard.mjs`(PreToolUse 파괴 명령 차단). `.sh` 래퍼 3개 중복 존재(check.sh·lock.sh·handoff.sh·sync.sh — `.mjs` 와 이중). 테스트 `agents/scripts/__tests__` CI 실행.
  - lock/handoff/review: IMPLEMENTED_UNVERIFIED(로컬 수동 도구). 메모리에 "acquire 실패 후에도 다음 명령 실행" 사고 기록(54639c57d) → 잠금은 **권고형**이지 강제 아님.
- **`.claude/settings.json`** 훅: SessionStart 1 · PreToolUse 1 (Stop 훅 Codex 자동리뷰는 메모리상 존재하나 이 파일 grep 에선 Stop 미검출 → 사용자 전역 설정에 있을 가능성, UNKNOWN).
- **worktree**: `scripts/worktree.mjs` (`pnpm wt list/new/remove`). `_raw/worktrees.txt` 참조 — 다수 워크트리 병행, 메모리상 "안전장치 낡은 워크트리 13/15" 실측 이력. IMPLEMENTED_UNVERIFIED, 운영 부담 큼.

## 7. 분석/퍼널 이벤트

- `apps/web/src/lib/analytics/events.ts`(625줄, ~123 고유 문자열 리터럴) + DB CHECK allowlist(메모리: 두 곳을 같이 바꾸지 않으면 조용히 0건).
- DB 실측: 누적 고유 이벤트 46종 · 30일 14,806건 · **30일 고유 사용자 4** · 상위 `screen_viewed` 10,274, `csat_dx_viewed` 1,099, `catalog_viewed` 580, `landing_viewed` 154.
- 판정: 수집 VERIFIED_WORKING. 정의된 이벤트 대비 실발생 46종 — 정의만 있고 한 번도 안 난 이벤트가 상당수(events.ts 리터럴 수 > 46; 정확 대조는 미실시). 소비 화면 `/admin/analytics` 는 목업 배너 → **계측은 되는데 보는 화면이 가짜**.

## 8. 공개/마케팅 · 인증 라우트

| 라우트 | 상태 |
|---|---|
| `/(marketing)` about · pricing · privacy · terms · fit · fit/s/[payload] · join/[code] · video · video/[id] | IMPLEMENTED_UNVERIFIED — CI 스모크 `33-public-surface` 가 공개 표면을 검사(성공 중). pricing 은 결제 백엔드 없음 → 결제 흐름 DESIGN_ONLY. `landing_viewed` 154·`fit_viewed` 256(30일)로 수신은 됨 |
| `/(auth)` login · signup · reset-password · verify-email + `/api/auth/callback` | IMPLEMENTED_UNVERIFIED — 가입자 4명 존재로 기본 경로 작동 정황 |
| `/dev/*` (components, directions, replica 4종, tts-probe) | EXPERIMENTAL — 디자인 레플리카 실험; 프로덕션 노출 차단 여부 미확인(UNKNOWN) |
| `/(main)/hub-lab`, `/(main)/sitemap` | EXPERIMENTAL / IMPLEMENTED_UNVERIFIED |
| 배포 자체 | **배포 경로 미가동(§0-1)** — 공개 화면이 실제 인터넷에 나가는지 저장소 기준으로는 확인 불가 |

## 9. 운영 부담 요약 (수동 비율)

| 영역 | 자동 | 수동 |
|---|---|---|
| DB 지표 수집·게이트·GC | pg_cron 14개 | — |
| DB 헬스 판정·조치 | — | `/db-health-audit`·`/db-remediate` (미해결 26) |
| 콘텐츠 LLM 드레인 11쌍 + API 드레인 | — | 전부 Claude Code 세션 수동 |
| ACP 일일 수집 | — | `collect-daily.mjs` 수동 |
| 배포 | 워크플로 존재 | 시크릿 없음 → 실제로는 0 |
| CSAT 원문 감사 | 매일 Actions | 실패 방치, 알림 없음 |
| 에이전트 협업(lock/handoff/review/memory sync) | 훅 2 + CI check | 대부분 규약·수동 명령 |

결론: **운영 자동화는 DB 안쪽(pg_cron)만 실제로 돈다.** 공급 파이프라인의 판단 단계·배포·감사 실패 대응은 전부 사람(또는 사람이 연 에이전트 세션) 의존이며, 사용자 4명 대비 87 Admin 화면·91 API·15 cron·14 명령·7 서브에이전트의 유지 비용이 크다.

## 10. 권고 전 확인할 것 (측정만 했고 고치지 않음)
- Vercel 시크릿 부재가 의도(미공개 유지)인지 사용자 확인.
- `csat-source-audit` 실패 로그 원인 확인.
- 마이그레이션 밖 cron 10개를 마이그레이션으로 고정할지.
- AGENTS.md 의 `.agents/skills/csat-source-audit/SKILL.md` 깨진 참조.
- 목업 Admin 6화면: 실데이터화 vs 사이드바에서 숨김.
