# Admin Console

> 플랫폼 운영 영역 — `/admin/*`. 사용자 앱과 라우트/레이아웃/시각 컨텍스트 모두 분리.
> 작성 시점: 2026-06-08 (v06.34).

---

## 시각 컨텍스트 분리

| 요소 | 사용자 앱 | Admin Console |
|---|---|---|
| 액센트 | `var(--p)` `#3B82F6` | **#8B5CF6 → #6D28D9** (보라 그라디언트) |
| 로고 아이콘 | `V` (Plus Jakarta) | `ShieldCheck` |
| Sidebar 헤더 | "Vocaflow" | "Vocaflow" + **"Admin"** mono 배지 |
| 알림 박스 | Streak | **"관리자 모드 · 시스템 데이터 접근 중"** |
| Sidebar 하단 | 사용자 프로필 → /settings | **"사용자 앱으로 ← /hub"** |

---

## 라우트 구조 (route group 미사용)

평문 `/admin/*` 사용 — URL 명시성 + 단일 layout scope.

### AdminSidebar 그룹

```
[ 단독 ]    대시보드 (LayoutDashboard)
[ 교재 ]     (accent: #8B5CF6)
   교재 공장 (Factory) — 하위 11칸. 들어가면 자동으로 펴지고, 화살표로 직접 접고 편다
[ 콘텐츠 공급 ] (accent: #8B5CF6)
   콘텐츠            /admin/library
   도서 수집   LCP   /admin/curation
   짧은 글     ACP   /admin/articles
   사실 재저작 Compose /admin/compose
   만화        CCP   /admin/comic
   스캔 만화   PDCP  /admin/pd-comics
   주제 코퍼스 TCP   /admin/topic-corpus
   = 7 항목
[ 어휘 ]     (accent: #8B5CF6)
   단어장 마스터     /admin/vocabulary
   어휘 빌드   VCB   /admin/vocab
   어휘 레벨   VRL   /admin/vrl  — 하위 6칸 (같은 접기/펴기)
   대기 단어         /admin/pending-words
   = 4 항목
[ 운영 ]     (accent: var(--info))
   사용자 · 플랫폼 분석 · 신고/문의(실 데이터 뱃지) · 결제/구독
   = 4 항목
[ 품질 · 시스템 ] (accent: var(--active))
   품질 지표 · 품질 게이트 · 추출 판정 · DB 헬스 · 시스템 설정
   = 5 항목
```

#### 왜 이 모양인가 (2026-09-06 재설계 · 회귀 `components/admin/__tests__/sidebar-readability.test.tsx`)

앞 판은 「사용자 & 콘텐츠」 한 묶음에 **1차 항목 13개**가 머리글 없이 이어졌고, 그중 일곱이
이름 대신 약칭(`LCP Pipeline`·`VCB Pipeline`…)을 달고 있었다 — 라벨이 무엇을 만드는
파이프라인인지 말하지 않으니 목록을 매번 처음부터 다시 읽는다. 실측으로 고친 것 넷:

| | 앞 | 뒤 |
|---|---|---|
| 가장 큰 묶음의 1차 항목 | **13** | **7** |
| 묶음 수 | 4 | 6 (만드는 것 기준) |
| 가장 작은 글자 | **9.5px** | **11px** |
| 하위 항목이 부모 밖 href 에서 사라짐 | 1건(`원문 적격`) | 0 |

- **약칭은 오른쪽 색인(`NavItem.tag`)으로 내렸다** — 지울 수는 없다(문서·스크립트가 「LCP」로
  부르고, 각 화면의 제목도 아직 「VRL Pipeline」이다). 이름을 먼저 읽고 약칭이 다리를 놓는다.
- **하위메뉴는 자기 면을 갖는다** — 부모의 아래쪽 모서리를 펴서 맞물린 패널 안에 들어가고,
  줄마다 레일에서 뻗은 가지(`├`/`└`)가 걸린다. 앞 판은 세로선 하나뿐이라 **글자 크기만 1px
  작은 형제 목록**으로 읽혔다("하위메뉴 같지 않다"의 실체가 이것이었다).
- **`opacity` 로 글자를 깎지 않는다** — `--t3`(4.77:1)에 `opacity-60` 을 곱하면 실효 대비가
  **2.31:1** 로 떨어져 AA 를 깬다. 「해설(준비 중)」 줄이 그랬다. 흐림은 색으로 표현한다.
- **펼침 판정이 자식 href 까지 본다**(`inSection`). 「원문 적격」은 라우트가 아직
  `/admin/textbook/sources` 라 부모 밖이었는데, 부모 href 만 보면 **그 항목을 누르는 순간
  자기가 속한 메뉴가 통째로 접혔다.** 화면은 멀쩡히 뜨므로 눈으로는 안 잡힌다.

#### 하위메뉴 접기 / 펴기 (2026-09-06)

하위메뉴는 **경로가 정하는 것**이었다 — 그 파이프라인 안에 있으면 펴지고 나가면 접혔다.
규칙 자체는 맞다(찾는 화면은 대개 지금 있는 곳 근처다). 문제는 관리자가 **그것을 바꿀 수
없었다**는 것이다:

- 교재 공장 **밖**에서 「조판·발행」으로 가려면 부모를 먼저 눌러 하위가 펴지기를 기다린다 —
  한 번에 갈 곳을 **두 번** 이동한다.
- 반대로 하위 11칸이 필요 없는 동안에도 그 11줄이 자리를 먹어, 아래 묶음 셋이 스크롤 밖으로
  밀린다. 1차 항목 22개짜리 메뉴에서 11줄은 **절반**이다.

그래서 경로 규칙을 **기본값**으로 격하하고 관리자의 클릭을 그 위에 얹는다:

    열림 = 관리자가 정한 값(있으면) ?? 경로가 정하는 값

| | |
|---|---|
| 조작 | 1차 항목 오른쪽 끝 화살표(`ChevronRight`). 이름을 누르면 이동, 화살표를 누르면 접기/펴기 |
| 상태 표시 | 화살표가 **회전**한다(접힘 ▶ / 펼침 ▼ = `rotate-90`). 아이콘을 갈아 끼우지 않는 이유는, 두 그림을 오가면 "무엇이 무엇으로 바뀌었는지" 가 안 남기 때문이다. transform 이라 모션 예산 안 |
| 저장 | `localStorage['vocaflow.admin.nav.open']` — **기본값과 다른 항목만** 담긴다 |
| 접근성 | 버튼에 `aria-expanded` + `aria-controls`(펼침 패널 id) + "「…」 하위 N개 펼치기" 라벨. 44×44px |

지킨 것 셋 — 전부 회귀(`sidebar-readability.test.tsx` ⑤)가 잠근다:

- **링크 안에 버튼을 넣지 않는다.** 한 줄이 두 개의 조작이라 겹쳐 놓기 쉬운데, 중첩
  인터랙티브는 **키보드로 도달할 수 없는 버튼**을 만든다. 면·테두리는 감싸는 `<div>` 가 갖고
  링크와 버튼이 그 위에 나란히 눕는다.
- **기본값으로 돌아오는 클릭은 저장값을 지운다.** 안 지우면 「지금 한 번 펴 둔 것」이 영구
  고정으로 굳어서, 다른 파이프라인에 들어가도 남의 하위 11줄이 계속 따라다닌다.
- **접어 둔 채 그 안에 있으면 부모 줄이 강조를 유지한다**(왼쪽 세로 막대 + `font-[600]`).
  하위가 안 보이는 동안 그것이 자기 위치를 아는 **유일한 단서**다.

⚠️ **서버 렌더는 항상 기본값(경로 규칙)으로 그린다.** 첫 렌더에서 `localStorage` 를 읽으면
서버와 다른 HTML 이 나와 하이드레이션이 깨진다 — 저장값은 마운트 뒤에 얹는다.

### 신고 뱃지 (v06.28 · ⚠️ 무효)

`admin/layout.tsx` Server fetch `reports.status='open'` COUNT → AdminSidebar `reportsBadge` prop.
- 0건 자동 숨김
- ⚠️ **`reports` 테이블이 DB 에 없다** (2026-08-12 실측 — `PGRST205`, 2026-09-05 재확인 —
  `to_regclass` NULL). 배지 부재 = "신고 0건" 이 아니라 **"집계할 테이블 없음"**.
- 2026-09-05: `fetchPendingReportsCount` 가 `count ?? 0` 으로 뭉개던 것을 `number | null` 로
  바꿨다. 둘의 차이가 코드에 남아 있어야 나중에 테이블이 생겼을 때 배지가 되살아난다.

---

## /admin — 대시보드 (v06.35 실측화)

`page.tsx` (RSC · `dynamic = 'force-dynamic'`) — `requireAdmin('/admin')` → `createAdminClient()`
(service_role, dev-bypass 에서도 조회 가능) → `lib/admin/dashboard-stats.ts`.

| 블록 | 출처 |
|---|---|
| KPI 4 (공개 콘텐츠 · 검수 대기 · 실패 · 오늘 학습자) | 카운트 합산 (`sum` — 하나라도 null 이면 null) |
| 파이프라인 8 큐 (LCP · ACP · 드레인 큐 · VCB · VRL · CCP · PDCP · Pending Words) | 상태별 `count: 'exact', head: true` |
| 운영·관리 10 링크 | 실측 수치 + DB 미연동 화면에 `목업` 태그 |
| 최근 파이프라인 변경 8건 | `library_books`·`library_articles`·`book_curation_jobs`·`pd_comic_issues`·`vocab_runs` 의 `updated_at` 병합 |

**`count ?? 0` 금지** — `head: true` 요청은 없는 테이블에도 `204 / error=null / count=null` 을
돌려준다 (404 는 non-head 에서만). 0 으로 채우면 미구현 화면이 "0건" 으로 보인다. `null` 은 화면에 `—`.

**목업 화면** (DB 를 전혀 읽지 않고 코드 상수를 렌더):
`/admin/users` · `/admin/library` · `/admin/analytics` · `/admin/reports` · `/admin/billing` · `/admin/settings`

2026-09-05 — 대시보드 링크에 붙던 `목업` 태그는 **그 화면을 거쳐 온 사람만** 봤다. 사이드바로
직행하면 한 번도 안 보였고, 그 사이 `/admin/users` 는 "총 사용자 **1,247**"(실제 3, 415배)을,
`/admin/settings` 는 "활성화 후 즉시 적용됩니다"(저장 경로 없음)를 단언했다. 조치:

- `components/admin/MockDataBanner.tsx` — 화면 상단 **상시 고지**(접히지 않음, `role="status"`).
  유일한 고지가 기본 접힘인 도움말 안이면 없는 것과 같다
- 가짜 목록·수치 제거. 실측 가능한 축(`user_profiles`·`daily_activity`)은 `getAdminDashboardStats()`
  재사용, 테이블이 없는 축(구독·결제·신고·플래그)은 수치를 지우고 "집계할 곳이 없다"
- 아무것도 저장하지 않는 토글·버튼 11개를 `disabled` + 사유 표시

회귀: `src/app/admin/__tests__/page.test.tsx` (renderToString · 5) +
`src/lib/admin/__tests__/dashboard-stats.integration.test.ts` (실 DB · 6) +
`src/app/admin/__tests__/mock-data-banner.test.tsx` — 목업 화면 목록을 선언하고 전부 배너를
렌더하는지, 그리고 **지운 상수 문자열이 설명문으로 되살아나지 않는지** 고정(실제로 두 번 잡혔다).

---

## 콘솔 공통 뼈대 (2026-09-05)

| 파일 | 없을 때 무슨 일이 났나 |
|---|---|
| `app/admin/error.tsx` | admin 어디서 throw 해도 루트 `error.tsx` 가 잡아 **사이드바까지 사라졌다** — 한 칸 실패가 콘솔 정지 |
| `app/admin/loading.tsx` | `force-dynamic` 화면이 대부분이라 집계가 끝날 때까지 **직전 화면이 얼어** 있었고, 관리자가 다시 눌러 집계가 두 번 돌았다 |
| `app/admin/not-found.tsx` | 한 글자 틀린 주소가 루트 404 로 떨어져 콘솔 밖으로 튕겼다 |
| `app/admin/layout.tsx` 의 `requireAdmin()` | `'use client'` 라 가드를 못 부르는 화면 8개의 유일한 방어가 미들웨어 한 겹이었다 |
| `lib/auth/require-admin.ts` 의 `cache()` | 화면 한 장에 `getUser()` + `user_profiles` 왕복이 **8~10회** (layout + 데이터 로더 5곳) |

`apps/web/middleware.ts` **삭제** — Next 14 는 `src/middleware.ts` 만 실행한다
(`.next/server/middleware-manifest.json` 의 `name="src/middleware"` 로 확정). 4개월 방치된
루트 사본은 curator 차단 · `?returnTo=` · 상태 게이트 부재라는 **이미 고친 버그 3종의 스냅샷**이라,
읽는 사람을 현행 정책으로 오도했다.

### 화면도움말 — 화면 단위 항목이 통째로 사문화돼 있었다

`AdminScreenHelp` 가 `const body = (tab && tabs[tab]) || screen` 으로 **둘 중 하나만** 골랐는데,
탭을 넘기는 화면은 활성 탭 라벨이 항상 정의돼 있어 `screen` 가지에 **한 번도 닿지 않았다**.
거기 든 "채움률을 품질로 읽지 마라" 같은 오조작 방지 경고가 한 번도 안 보였다.
지금은 탭 본문 아래에 화면 전체 경고를 **항상** 덧붙인다.

회귀 `src/lib/admin/__tests__/help-registry.test.ts` — 양방향 잠금:
① 정의됐으나 아무 화면도 안 부르는 고아 키 ② 화면이 부르는데 없는 키 ③ 탭 라벨 불일치.
③ 이 가장 위험하다 — 라벨만 바꾸면 그 탭 도움말이 **오류 없이 조용히** 사라진다.

### 감사 자 — `pnpm admin:audit`

`scripts/audit/admin-console.mjs`. 화면 51 × 축 8(header · help · back · nav · loading · error ·
guard · nomock) + 전역 검사. `--fail-under=<점수>` 로 게이트(`pnpm admin:audit:gate`).

| 전역 검사 | 무엇을 막는가 | 게이트 |
|---|---|---|
| 죽은 `/admin` 링크 | 없는 화면으로 가는 링크 | 점수 |
| 도움말 키 계약(양방향) | 탭 라벨만 바꿔 도움말이 조용히 사라지는 것 | 점수 |
| 정의되지 않은 CSS 변수 | 다크에서만 안 보이는 글자 | 점수 |
| 실패를 0/빈값으로 뭉개는 자리 | **못 잼**이 **없음**으로 보이는 것 | 점수 |
| **이동 깊이** | O/X 로는 안 보이는 **묻힌 화면**. 도달 불가는 점수와 별개로 exit 1 | 별도 |
| **API 가드 갈래** | 가드도 선언도 없는 라우트. `// @auth public|delegated` 로 의도를 적게 한다 | 별도 |
| **첫 줄 경로 주석** | 규칙만 있고 자가 없어 한 구역이 통째로 새는 것 | 점수 |

실측(2026-09-06): 점수 **99.5%**(406/408) · 죽은 링크 0 · 도달 불가 **0**(최대 깊이 3) ·
뭉개는 자리 **0** · 미선언 무가드 **0** · 경로 주석 누락 **0**.

⚠️ **자를 아홉 번 고쳤다** — 자가 틀리면 감사 전체가 틀린다. 동적 세그먼트를 문자열 비교해
정상 링크를 죽은 링크로 봤고, 레이아웃을 빼고 봐서 2차 내비를 놓쳐 "나갈 길이 없다" 는 오답을
냈고(→ back 은 부모 링크가 아니라 **탈출 경로**를 잰다), 도움말 키를 첫 하나만 보고 별칭
형태를 놓쳤고, `redirect()` 한 줄뿐인 화면에 제목을 요구했고, 목업 탐지가 **0** 을 잡아
빈 상태 초기화를 가짜 수치로 찍었고, `count ?? 0` 을 렌더 컴포넌트의 산술(색 농도 분모 ·
정렬 키)에까지 들이대 오탐 3건을 냈고, 이동 깊이를 라우트 디렉터리 직계 파일만 보고 재서
멀쩡한 화면 **9개를 「도달 불가」로 몰았고**(전량 오탐 — 링크가 공유 컴포넌트와 `lib/` 에
산다), 경로 주석에 완전일치를 요구해 **경로 뒤에 라우트를 덧붙인 더 친절한 주석**을 위반으로
몰아 잘못된 수리를 유발했다.

**자를 완화할 때는 무디게 만든 게 아님을 증명하고 넣는다** — 옛 위반을 되살려 여전히 잡히는지
프로브로 확인한다(`count??0` · 경로 주석), 새 게이트는 위반을 일부러 만들어 exit 1 을 확인한다
(고아 화면 · 무가드 라우트). **오탐만 내는 자는 안 잡는 자보다 나쁘다.**

---

## /admin/curation — LCP

### 8탭

| 탭 | 컴포넌트 | 기능 |
|---|---|---|
| Sources | `SourceCatalogTab.tsx` | 9 외부 소스 카탈로그 (composite_score) |
| BulkFetch | `BulkFetchTab.tsx` | 일괄 fetch + "Dev 일괄 처리" 버튼 (v06.34) |
| Seed | `SeedTab.tsx` | gutenberg/SE 시드 카드 |
| Gutenberg ID | `GutenbergIdTab.tsx` | ID 입력 → preview-gutenberg |
| Wikibooks ID | `WikibooksIdTab.tsx` | preview-wikibooks |
| Wikisource ID | `WikisourceIdTab.tsx` | preview-wikisource |
| OpenStax ID | `OpenStaxIdTab.tsx` | preview-openstax |
| My Library | `MyLibraryTab.tsx` | Curated Books 테이블 |

### Curated Books — 테이블 + 일괄 액션 (v06.34)

13 컬럼: 제목 · 저자 · 소스 · 상태 · CEFR · V·Cent · CEFR-J · F-K · 추출 · 단어장 · 단어 · 갱신 · 상세.

**"추출" 셀 = 해석률 (v06.35 재정의)** — 이전에는 `lemma_coverage_pct`(shared_dictionary 결합률)를 그대로 보여줘, 결합돼선 안 되는 고어·외국어 원문 인용·인명/지명이 전부 "추출 실패"로 표시됐다(Les Misérables 89.5% → 실제 98.7%). 지금 배지 숫자는 `resolved_pct`(결합 + 고어/방언/외국어 해석 + 인명·지명 제외), 옆 `·N↑` 은 **어떤 자산으로도 해석 안 된 진짜 공백**(`unresolved_count`). 툴팁에 사전 결합률·타사전 해석 수·노이즈 제외 수를 함께 노출. 상태: `unresolved=0` → `✓ 완료`(success) · 해석률 ≥99% → info · 미만 → warning.

#### 필터
- 소스 필터 (composite_score 기반 9 카탈로그)
- 레벨 필터 (V-Level 0-11)
- 상태 필터 (전체 / 처리 중 / 검토 대기 / 게시됨 / 실패 / 보관됨)
- 제목/저자 검색

#### 일괄 액션 (체크박스 + Toolbar)

| 버튼 | RPC / 엔드포인트 | 효과 |
|---|---|---|
| **Dev 일괄 처리** | `/api/lcp/dev-process` (순차) | 처리중+검토대기 선택분을 로직 파이프라인으로 dev 처리 — 수집·정규화·분절·분석·추출·V-Level·**LibriVox 자동매핑**까지. 배너에 `🔊 매핑 N · ⏳ 매핑큐 M` 집계 |
| **스크립트 퀴즈 큐** (v06.114) | `enqueue_quiz_jobs(uuid[])` | ready/published+챕터 존재 선택분을 `book_curation_jobs`(`task_type='quiz_gen'` — v06.x 매핑 큐와 통합, 구 `book_quiz_jobs` DROP)로 적재. 챕터별 스토리 퀴즈(문항 수 = `quiz_target_per_chapter(book_v_level)` 곡선 3~10) 생성 큐. 실 생성=Claude Code 드레인(`scripts/lcp/generate-chapter-quiz.mjs`) → `QuizJobsBanner` 진행률(chapters_done/total·문항수) |
| **레벨 검토 큐** (v06.x Phase 1) | `enqueue_review_jobs(uuid[],'level_verify')` | ready/published 선택분을 `book_curation_jobs`(`task_type='level_verify'`)로 적재. Claude Code 드레인(`scripts/lcp/review-book.mjs`)이 본문을 읽어 CEFR/V-Level 재판정 → `result` verdict 기록 + 승인 시(`--correct`) `library_books` 교정. 저신뢰 CEFR(<0.85) 도서 품질 검토용 |
| **어휘 감사 큐** (v06.x Phase 1) | `enqueue_review_jobs(uuid[],'vocab_audit')` | **published**(발행 단어장 존재) 선택분을 `task_type='vocab_audit'`로 적재. Claude Code 드레인(`scripts/lcp/audit-vocab.mjs`)이 발행 단어장의 뜻·품사·레벨·register 를 문맥 근거로 점검 → `result.flagged[]` 기록. 실 교정은 `dict-*` 스크립트로 별도(감사=식별) |
| **소스로 되돌리기 (삭제)** | `admin_bulk_requeue_books(uuid[])` | 처리중 ∪ 검토대기 선택분 → library_books DELETE → BulkFetchTab 복귀. (구 `처리중→소스GET`+`검토대기→소스GET` 2버튼이 동일 RPC 라 1버튼으로 통합) |

> 드레인 큐 통합 (v06.x): 생성/매핑(quiz_gen·voice_map) + 검토(level_verify·vocab_audit) 를 `book_curation_jobs` 단일 큐 + `DrainQueueBanner` 단일 배너(🔊 매핑 / 📝 퀴즈 / 🔬 검토)로. 드레인 오케스트레이터 `scripts/lcp/drain.mjs`: `list`(미완 잡 대시보드) · `next [book_id]`(책별 task 실행 런북 — 4 helper 로 라우팅). 4 task 모두 Claude Code(LLM) 판단 필요라 자동 실행 X, "무엇을·어떻게" 단일 진입점.
> 통합 정리 (v06.x): 구 `검토대기 → 처리중`(draft 삭제 reclassify) 버튼은 제거 — 재처리(Dev 일괄 처리)로 대체. RPC `admin_bulk_set_books_curating` 자체는 DB 에 잔존.

**LibriVox 매핑 자동화 (v06.35)**: 이전의 수동 "매핑 큐 등록(Claude)" 버튼은 제거. `dev-process` 가 분석 직후 `autoMapLibriVoxForBook` 를 호출해 **count-gate 통과 시 즉시 `librivox_audio` 저장**. 정합 실패본만 `book_curation_jobs` 큐에 자동 등록(Claude Code 수동 정합 대상) → 리스트 행에 `JobQueueBadge` 노출. 성공/녹음없음은 큐 잡 자동 삭제.

안전 가드 (자동 스킵):
- `is_published=true` 단어장 존재 (학습자 노출)
- `texts.library_book_id` 참조 (사용자 진도)

#### 도서 처리 엔진 (통합, v06.x)

큐 전체 처리와 선택분 처리가 **단일 엔진**(`runProcess`) + **단일 진행 배너**로 통합:
- **큐 처리** — `status='queued'` 도서 ≥1 일 때 노출. **헤더 `▶ 큐 처리 (dev · N권)` 노란 배지** + "작업 순서" 가이드 콜아웃 두 곳(동일 동작). 큐 도서 전량을 순차 처리.
- **선택분 처리** — 체크박스 선택 후 Toolbar 의 `Dev 일괄 처리` (처리중 ∪ 검토대기 ∪ 실패).
- 둘 다 `/api/lcp/dev-process` 를 도서별 순차 호출 (유한 목록 → 무한 루프 불가). 진행 배너: 성공/실패/남음/경과 + `🔊 매핑 · ⏳ 매핑큐` 집계 + `중지`/`계속`. **완료 시 `검토 대기 보기 →` 액션**(목록을 처리 결과로 필터해 검수로 연결).
- **`⟳ 새로고침`** (헤더) — 상단 통계 + 목록(RSC) + 매핑/퀴즈 큐 배너 일괄 갱신 (소스 GET·큐레이션·Claude Code 드레인 후 out-of-band 변경 반영).
- (구: `dev-drain-queue` 5권/라운드 루프 → 단일 엔진으로 대체. 라우트는 2026-09-06 삭제 — 호출부 0.)

#### 도서 상태 흐름 표시

`StatusPill` (5 tone): success(게시됨) / warning(검토대기) / info(처리중) / danger(실패) / neutral(보관됨)

`ExtractionCell` (4-state):
- extracted=0 → "—"
- coverage=100% + unbound=0 → "✓ 완료"
- coverage≥95% → "{n}% · {unbound}↑" info
- coverage<95% → "{n}% · {unbound}↑" warning

### /admin/curation/preview/[bookId]

`AdminReviewClient.tsx` — 도서 본문 검수 + 챕터 nav + LibriVox 매핑 패널 + 챕터 단어장 검수 + 추출 패널 + **챕터 퀴즈 검수**.

#### LibriVoxAudioPanel (v06.34)

`chapter_parts` + `flat` 두 모드 모두 connected 인식. legacy `mode === null + aligned === true` 도 flat 으로 자동 격상.

`POST /api/admin/library/save-librivox-audio`:
- `build_chapter_map: true` — Roman 파서 시도
- 실패 시 단권 + section_count match → 자동 `flat` 폴백
- 응답: `fallback: 'flat_from_chapter_parts'`

#### ChapterWordSetsAdminSection (v06.32)

Client 전환. 표 행 `role="button"` + Enter/Space 키보드 + `ChapterWordSetPreviewModal` (admin 전용 — 구독 CTA 없음, 단어 전수 fetch + sort_order DESC + 발음 듣기 + 추출 메타 JSONB).

#### ChapterQuizAdminSection (v06.117)

챕터별 퀴즈(`library_chapter_quiz`) 검수. 서버 `fetchBookChapterQuizzes`(authed admin 직접 read — 발행 상태 무관, 미발행 검수 가능) → 챕터별 문항수 표 + 커버리지/저문항(<3) 경고 + 생성 잡 배지(`book_quiz_jobs` done/running/failed·chapters_done/total). 행 클릭 → `ChapterQuizPreviewModal` (문항 EN+KO·4지선다 **정답 초록+아이콘**·본문 근거 snippet Lora italic — 검수용 정답·근거 노출, 학습자 플레이는 숨김). 데이터는 서버 pre-fetch → props(모달 client fetch 없음, RLS 안전).

#### BookExtractionPanel

`extract_vocabulary_for_user_v2(uuid, text[], text='auto')` 테스트 UI.
- composite scoring preview (P70/75/80)
- meta cells (적용/글/본인/gap/N)

---

## /admin/articles — ACP 큐레이션 콘솔

**`CurationConsole` (v06.87)** — 소스별 탭 → **4단계 파이프라인 + SourcePolicy 분기 단일 화면**. VOA/The Conversation 등 소스 차이는 정책 4축(supply/media/derivation/attribution)으로만 분기 — `if(source==='voa')` 하드코딩 금지(`useSourcePolicy`/`resolveSourcePolicy` 단일 출처).

| 단계 | 컴포넌트 | 내용 |
|---|---|---|
| ① 커버리지 | `CoverageMatrix` + `SourceFeedList` | register×CEFR 발행 gap(빗금)/filled · 소스/feed별 후보 현황(`listSourceFeedHealth`) |
| ② 소스 GET | `CandidateTable` (+ `BulkArticlesTab` 대량) | seed-list 6컬럼 + score 막대 + audio(policy.media) + 다중선택 → `/api/acp/enqueue` · 라이브 RSS(`VoaFeedTab`/`RssFeedTab`) 보조 |
| ③ 검수 | `ReviewPanel` (3패널) | 큐 상태 dot / 에디터·player / `computeGateItems(policy)` 동적 게이트 + 발행 |
| ④ 발행 | `CuratedArticlesTab` | published 목록 관리(보관/되돌리기/삭제) |

`PolicyBar` — 소스 선택 시 정책 4축 라이브 렌더. SourcePolicy 정의는 `@vocaflow/library-pipeline/curation-spec`(C2 공유 자산 · drift-lock vitest 18). 피드: `/api/admin/articles/{nasa|nih|voa|wikinews|the_conversation|simple_wikipedia}-feed`(arxiv 제거 v06.69) → seed_catalog/큐 → `/api/acp/dev-process`.

**딥 검수 (v06.51 · 본문·단어 편집 — ReviewPanel "딥 검수" 링크로 재사용)** — `/admin/articles/preview/[id]` (LCP 책 검수 4패널 1:1 미러):

| 패널 | 글 버전 | 책 대응 |
|---|---|---|
| 본문 리더 + 게시 게이트 | 단일 섹션 리더 + 상단바(상태/신뢰도/게시) + 푸터(지금 처리·재분석/재처리/보관) | AdminReviewClient |
| 보이스 연결 | `audio_url` 검증/미리듣기/연결·해제 (`/api/acp/set-audio`) | LibriVoxAudioPanel |
| 학습 단어 추출 | meta cells + LV 랭킹 테이블 + RegisterBadge | BookExtractionPanel |
| 검수 팝업 | 단어 전수 + 뜻 + 발음 + 첫 문장 모달 | ChapterWordSetPreviewModal |

액션 RPC: 게시 `admin_force_publish_article`(copyright_safe 강제 + media='audio' 소스 audio 게이트) / 보관 `admin_archive_article` / 재처리 `admin_requeue_article` / 처리 `dev-process`. vocab 은 service-role 로 로드(테이블 admin RLS 없음).

---

## /admin/vocab/* — VCB

| 경로 | 내용 |
|---|---|
| `/admin/vocab` | VCB 메인 |
| `/admin/vocab/studio` | **단어장 Studio** — 유형 30종(시중 26 + 고유 4) 조립 · 7지표 채점 · 발행. 채점 통과선 0.80 미달이면 발행 버튼이 잠긴다 |
| `/admin/vocab/runs` | runs 목록 |
| `/admin/vocab/runs/new` | 신규 run |
| `/admin/vocab/runs/[id]` | run 상세 |
| `/admin/vocab/runs/[id]/seed` | seed 입력 |
| `/admin/vocab/runs/[id]/seed/preview` | seed 검증 |
| `/admin/vocab/sources` | sources 목록 |
| `/admin/vocab/sources/new` | 신규 source |
| `/admin/vocab/curate/[run_id]` | curate hub |
| `/admin/vocabulary` | (legacy stub) |

컴포넌트 (`components/admin/vcb/`):
- 8 step 워크플로우
- `VcbSeedFlow.tsx` / `VcbStep4LookupCard.tsx` 등
- `studio/StudioClient.tsx` + `studio/ScorecardPanel.tsx` — Studio (blueprint 갤러리 · 채점 결과 · 목차 미리보기)

Studio 는 보강(LLM)을 거치지 않고 **이미 있는 사전·코퍼스 데이터를 조합**한다. 사전에 없는 단어를
새로 채워야 하면 Runs(8-step)로 간다. 발행은 서버가 같은 레시피로 다시 조립해서 하므로
화면이 들고 있던 결과가 그대로 쓰이지 않는다(사이에 사전이 바뀌면 결과도 바뀐다).
CLI 동등물: `pnpm vcb:compose --blueprint <id> [--commit]` · 평가: `pnpm vcb:compose-eval`

---

## /admin/vrl/* — VRL (v06.28 신설)

| 경로 | 상태 | 책임 |
|---|---|---|
| `/admin/vrl` | ★ 실 구현 | Dashboard — KPI 4 (의심/진단/사용자/snapshot) + V-Level 12 진행 |
| `/admin/vrl/taxonomy` | ★ 실 구현 | 4 tab (Levels/Tracks/Domains/Skills) read-only |
| `/admin/vrl/automation` | ★ 실 구현 (v06.34) | pg_cron + V-Level 분포 + 진단 활용도 + track 분포 |
| `/admin/vrl/concerns` | stub | `vrl_data_integrity_concerns` cleanup |
| `/admin/vrl/diagnostic` | stub | 진단 시드/문제 편집 |
| `/admin/vrl/users` | stub | `user_profiles.current_v_level` 분포 |
| `/admin/vrl/snapshots` | stub | `user_level_snapshots` audit chain |

### 데이터 쿼리

`apps/web/src/lib/admin/vrl/queries.ts`:
- `fetchVrlDashboard` — revalidate 60s
- `fetchVrlTaxonomy` — revalidate 300s

### Phase 2J Automation 대시보드

5 admin RPC:
- `cron_jobs` 
- `cron_runs` (최근 10)
- `snapshot_counts` (by reason/scope)
- `v_level_distribution`
- `diagnostic_use`

Phase 2K Polish:
- middleware `/admin/*` RBAC guard (`user_profiles.role` check + redirect)
- cron alert (`pg_notify 'vrl_cron_alert'` when failed>0)
- track distribution RPC + dashboard 섹션 (3 track × L1-L10 bar)

---

## /admin/comic — CCP (Comic Curation Pipeline · 신설)

도서 → 만화 큐레이션·생성·QC·발행. AdminSidebar 사용자&콘텐츠 그룹 등재(`BookImage`).

| 탭 | 기능 |
|---|---|
| **Catalog** | 만화화 대상 도서(ready/published) + 만화 상태(없음/초안/발행)·컷수·큐 상태. 체크박스 → **만화 생성 큐**(`enqueue_comic_jobs`) |
| **Published** | 생성된 만화(초안/발행) 관리 — QC 게이트(`panels_pass`) 통과분만 **발행**(`admin_set_comic_published`) · 회수 |

- KPI 4: 대상 도서 / 초안 / 발행됨 / 큐 대기.
- 데이터: `listComicCatalog`(library_books + comic_books 헤더 + comic_gen 잡 병합). 마이그레이션 미적용 시 빈 목록 안내로 degrade.
- 생성 드레인: Claude Code `scripts/lcp/generate-comic.mjs` (drain.mjs 🎞 등록). QC 판정(`qc_verdict`: verbatim_mismatch·rule_violations)은 헤더에 지속 저장(job.result는 재적재 시 소실 → 런 로그 전용).
- 발행 강제 게이트: `admin_set_comic_published` 가 `panels_pass=true` + 컷 존재 검증 후에만 published.

상세 설계: `scripts/comic/docs/COMIC_PIPELINE_DESIGN.md`.

---

## /admin (대시보드)

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

KPI 카드는 §13 StatCard 와 다른 디자인 — delta 변화율 (`▲ 12%`) 강조 + 작은 아이콘 박스. 모듈별 색상 액센트로 빠른 스캔.

---

## /admin/pending-words (v06.34 신규)

미바인딩 단어 검수 — Phase 3B 부산물.

- Server Component
- KPI 4
- 200 row read-only
- AdminSidebar 등재

---

## /admin/csat — 교재 공장 (공정 8칸)

**요청은 「파이프라인」이었는데 오래 조회 표 세 개였다.** 표는 "지금 몇 개인가" 에는 답하지만
"다음에 무엇을 돌려야 하는가" 에는 답하지 않아, 관리자는 화면을 보고도 터미널로 가
스크립트 197개(csat 131 · textbook 66)를 뒤져야 했다. 2026-09-05 에 **시중 교재 제작 공정을
그대로 8칸으로 세운 라인**으로 재설계했고, 옛 표 세 개는 공정 ①로 내려갔다.

### 레인 둘

| 레인 | 공정 | 하는 일 |
|---|---|---|
| **전략 연구소** | ① 기출 원천 · ② 기획 · ③ 설계 | 무엇을 만들지 정한다 (산출물은 규격·표·판정) |
| **생산 라인** | ④ 소재 · ⑤ 집필 · ⑥ 해설 · ⑦ 검수 · ⑧ 조판·발행 | 정한 대로 찍는다 (산출물이 학습자에게 간다) |

한 줄에 섞으면 "재고가 많다" 가 "잘 만들고 있다" 처럼 읽힌다 — 연구소가 규격을 바꾸면
라인의 재고가 통째로 낡으므로 정반대다. 그래서 레인을 가른다.

### 공정 9칸 — 시중 대응과 게이트

| # | 공정 | 시중 공정 | 게이트 | 실측 눈금 |
|---|---|---|---|---|
| 1 | 기출 원천 | 출제경향 분석 | 사정권 배점을 덮은 회차 | `csat_coverage()` RPC |
| 2 | 기획 | 시장조사·경쟁교재 분석 | 구속 출판사 지수 ≥ **1.200** | `textbook-publisher-benchmark*.json` |
| 3 | 설계 | 이원목적분류표·목차 | 사다리가 선언한 유형을 라인이 만들 수 있는가 | `SERIES_SPINE` × `csat_stage_gates` |
| 4 | 소재 | 지문 섭외·저작권 | 게이트가 있는 밴드에 지문이 있는가 | `csat_stage_catalog` |
| 5 | 집필 | 원고 집필(문항) | 사다리 칸에 재고 0이 없는가 | `csat_dcp_items` 칸별 count |
| 6 | 해설 | 정답해설 집필 | 해설 보유율 100% | `answer_key->>explanation_ko` |
| 7 | 검수 | 초교·재교·삼교 + 감수 | **층 4개 전부** 통과 | 아래 |
| 8 | 조판·발행 | 조판·교정쇄·인쇄 | 계단마다 최신 규격 권 | `textbook_volume_renders` |
| 9 | 진열 | 매대·상세면 | 구성요소 지수 ≥ **1.200** (시중 최다 8축 대비) | `apparatus-surface-probe.mjs` |

⚠️ **9칸은 2026-09-06 에 늘어난 것이다.** 8칸까지는 전부 **문항의 품질**을 재는데,
학습자가 교재를 고를 때 보는 것은 **책의 껍데기 전부**다(표지·머리말·목차·단원 도입·어휘·
해설·판권…). 그 축을 아무도 안 재는 동안 상세면은 시중 구성요소 14축 중 **1축**이었다 —
문항 지수 1.2 를 넘긴 채로. 기준선은 코퍼스 20종 실측(중앙값 5 · 최다 8)이고
정본은 [`textbook/apparatus.ts`](../packages/library-pipeline/src/textbook/apparatus.ts) 다.

### 한 화면에 다 펼치던 것을 걷어냈다 (2026-09-05)

「너무 복잡하다」를 먼저 **숫자로 바꿨다** — 화면마다 같은 표본으로 덩어리·글자·조작을 세는
회귀(`__tests__/density.test.tsx`)를 두고 실측했다. 현황판이 **덩어리 284 · 글자 2,171** 로
다른 공장 화면(62~143)의 **2~4배**였다. 공정 8칸의 눈금·게이트·명령을 전부 펼쳐 놓은 탓이다.

| | 전 | 후 |
|---|--:|--:|
| 현황판 덩어리 | 284 | **94** (−67%) |
| 현황판 글자 | 2,171 | **422** (−81%) |
| 현황판 조작 | 32 | **12** (−63%) |
| 기획 글자 | 1,391 | **1,123** (−19%) |

**셋을 고쳤다:**

1. **라인 도식** — 카드 8장 대신 한 줄 그림. 상태를 **색 + 모양 + 글자** 세 겹으로 적는다.
   색만 쓰지 않는 이유는 실측이다: 상태 4색을 팔레트 검증기(`dataviz`)에 넣으면
   「통과(초록)」↔「몫 남음(주황)」의 색약 분리가 **ΔE 7.8**(protan)로 경고 대역이다.
   그래서 채운 원 / 반쯤 찬 원 / 사각 / 점선 원으로 모양을 갈랐다. 병목 뒤의 연결선은
   점선으로 끊어 그린다 — 앞이 막히면 뒤로 원고가 안 넘어간다.
2. **한 번에 한 칸만 편다** — 기본 선택은 병목이라 열자마자 고칠 것이 펼쳐져 있다(철학 2).
3. **같은 8칸을 세 번 그리던 것** — 사이드바 하위 메뉴 · 공정 레일 · 라인 도식. 레일을
   지웠다(`FactoryRail.tsx` 삭제). 남긴 것은 **어디로 갈까**(사이드바)와
   **지금 어떤가**(도식) 하나씩이다.

### 좌측 메뉴 2단 (레인별)

교재 공장 하위가 한 줄로 여덟이면 어디서 성격이 바뀌는지 안 보인다. `NavItem.group` 으로
레인 머리글을 넣었다 — **전략 연구소**(①②③) / **생산 라인**(④⑤⑥⑦⑧).
⑥ 해설은 아직 화면이 없으므로 **링크가 아니라 「준비 중」 글자**다(`NavItem.pendingNote`) —
빼면 현황판 도식과 메뉴가 어긋나고, 링크로 걸면 눌러 보고 「고장」이라고 판단한다.

### 표를 그림으로

| 화면 | 전 | 후 |
|---|---|---|
| 기획 | 축마다 「우리/시장/지수」 세 숫자 | **발산형 막대** — 중립 1.000 을 가운데 두고 이김(초록)/짐(빨강), 목표 1.200 눈금 |
| 집필 | 유형×수준 숫자 표 | **히트맵** — 로그 농도(재고가 3~91,474 로 네 자릿수 차라 선형은 패턴이 안 보인다) + 범례 |
| 검수 | 카드 4장 나란히 | **층 도식** — 위에서 아래로 쌓고, 처음 걸리는 층 아래는 흐리게(원고가 거기까지 오지 않았으므로 아래 수치는 통과율이 아니다). 명령은 층마다 접힘 |
| 조판 | 「조판된 계단 N / 7」 숫자 | **사다리 띠** — 7단을 칸으로 그려 **어느 학령이 비었는지** 보이게. 옛 규격은 주황 테두리, 해설 안 붙은 권은 빨간 점. 범례는 글자 없는 기호(점)에만 — 칸 안에 이미 상태 글자가 있어 나머지는 중복이었다(밀집도 예산이 잡음) |

숫자는 지우지 않았다 — 색약·흑백 인쇄·스크린리더 때문이다. 농도는 **거들 뿐**이고,
재고 0(`—`)과 못 셈(`?`)은 색이 아니라 글자로 가른다(할 일이 정반대다).

### 다층 검수 (⑦)

한 층만 통과한 것을 통과라고 부르지 않는다 — 층마다 보는 것이 다르다.

| 층 | 보는 것 | 근거 |
|---|---|---|
| L1 기계 게이트 | 인용 대조 · 정답 대조 · 순환논법 · 규칙 교정 | `analysis-drain-validate` · `proofread-report` |
| L2 3인 페르소나 | 출제자 · 오답분석가 · 현장강사 전원 pass | `csat_analysis_reviews` (DB 트리거 강제) |
| L3 교차 대조 | 정답 번호 쏠림(χ²+Cramér V) · 지문 규격 | `item-health-report` · 조판 `colophon.review` |
| L4 외부 대조 | 시중 교재 7축 우위 지수 | `market-benchmark --per-publisher` |

⚠️ L2 는 **분석 행이 아니라 문항**을 센다. 분석은 덮지 않고 버전을 올려 새 행으로 쌓이므로,
행을 세면 「2,234 / 830」이라는 270%짜리 눈금이 나온다 — 통과율이 아니라 버전 수다.

### 7축이 재지 않는 것 (기획 화면)

벤치마크 일곱 축은 **전부 종이에서도 잴 수 있는 것**이다 — 해설 보유·길이, 오답 배제, 원문 인용,
유형 수, 지문 어수, 선택지 수. 그래서 1.200 을 넘겨도 그 말의 뜻은 **「더 나은 종이책」**이다.

종이가 원리적으로 못 하는 자리는 넷(개인별 복습 일정 · 오답 재출제 · 수준 맞춤 배본 · 즉시 채점)인데
전부 **관측 위에** 선다. 그래서 화면은 「우리는 그것을 한다」고 주장하지 않고 **관측 수를 그대로
적는다** — 실측 2026-09-05 `csat_item_attempts` **1건**.

임계는 짐작이 아니다. `csat_stage_gates` 의 `item_accuracy` 가 0.65~0.70 이므로, 그 근처 비율을
95% 신뢰수준 ±0.10 으로 잡으려면 `n = 0.7×0.3×(1.96/0.10)² ≈ 81`. **필요조건이지 충분조건이
아니다** — 81회가 한 문항에 모여야 그 문항을 잴 수 있고, 흩어지면 여전히 못 잰다. 화면이 그렇게 적는다.

### 공정별 드레인 지도 (현황판 도움말)

8칸 중 **어디가 Claude Code 몫이고 어디가 결정적 스크립트인지**를 칸마다 표시한다.

| Claude Code 몫 | 결정적 (배치가 정할 일이 아니다) |
|---|---|
| ① 기출 원천 · ② 기획(자료 확보) · ⑤ 집필(원글) · ⑥ 해설 · ⑦ 검수 | ③ 설계(코드 상수) · ④ 소재(수확·프로브) · ⑧ 조판(조합·렌더) |

없어야 할 곳에 드레인을 적으면 「배치를 돌리면 된다」는 오해를 만들고, 있어야 할 곳에 없으면
관리자가 터미널에서 막힌다. `line-screens.test.tsx` 가 이 대응을 회귀로 고정한다(드레인이 내미는
`scripts/` 경로의 파일 존재까지 실측).

### 화면이 명령을 들고 있다

칸마다 **터미널 명령이 그대로 박혀 있다**(복사 버튼 · 「씀」 · 「Claude Code」 표시). 지금까지
그 절차는 화면도움말 안에만 있어 관리자가 펼쳐 읽고 손으로 옮겨 적었다. 명령이 낡으면
회귀 테스트가 잡는다 — `factory-model.test.ts` 가 `scripts/...` 경로의 **파일 존재를 실측**한다.

- 데이터: `lib/csat/factory-model.ts`(공정 정본·판정) + `lib/csat/factory.ts`(실측)
- 하위 화면 3 (레일 + 사이드바 하위 메뉴):
  - `/admin/csat/evidence` — ① 기출 원천. 옛 3탭(회차 커버리지 · 유형별 진행 · 가이드 원천)
  - `/admin/csat/strategy` — ② 기획. 출판사별 7축 지수 · 구속점 · **천장(reachableMax)** 판정.
    천장이 목표 아래면 「증거가 막는다」 — 파이프라인을 고쳐도 안 오르니 자료를 구해야 한다
    (실측 2026-09-01: EBS 는 코퍼스에 정답해설 0건이라 해설 축 A1~A4 를 못 재고 천장 1.199)
  - `/admin/csat/blueprint` — ③ 설계. 이원목적분류표(학령 7단 × V-Level × 유형) + 계단 근거 +
    단계 게이트 임계 9. **「함수」 칸과 재고 0 칸을 색으로 가른다** — 초등 3종은 사전의 순수
    함수라 DB 에 없고, 0 으로 그리면 있지도 않은 구멍을 메우게 된다
  - `/admin/csat/sourcing` — ④ 소재. 단계 밴드 × 수준 지문 재고. 게이트가 있는데 지문 0편인
    밴드를 지목한다(실측 2026-09-05: S5 병행 듣기 0편). 화면 전용 지문은 재고에서 뺀다
  - `/admin/csat/authoring` — ⑤ 집필. 유형 25 × 수준 9 재고 전량. **사다리 밖 재고**
    (어느 권에도 안 실리는 문항)가 실측 **392,566 / 655,092 = 60%** — 「공급망 비대」가
    문항 층에서 드러나는 자리다. 유형 목록은 상수이고, **유형별 합 == 표 전체 count** 로
    낡음을 잡는다(PostgREST 집계가 꺼져 있어 DISTINCT 를 못 쓴다)
  - `/admin/csat/review` — ⑦ 검수. 층 4개가 각자 **무엇을 보는지**와 함께. 권별 기록에서
    「기록 없음」(검사가 안 돌았다)과 「지적 0건」(돌았는데 깨끗했다)을 색과 글자로 가른다
  - `/admin/csat/press` — ⑧ 조판·발행. 조판된 계단 / 7 · 옛 규격 권 · 해설 안 붙은 문항 ·
    문항 없는 원글. 수치는 조판기가 찍은 값 그대로 — 화면과 손에 쥔 책이 같은 것을 말해야 한다
- 화면도움말: `lib/admin/help/csat.ts` — `csat`(현황판) · `csat-evidence`(기출 3탭)
- AdminSidebar 등재 (`사용자 & 콘텐츠` → `교재 공장`, 들어가면 하위 항목이 펼쳐진다)
- 회귀: `app/admin/csat/__tests__/factory-line.test.tsx` 9종 ·
  `lib/csat/__tests__/factory-model.test.ts` 43종 · `factory.integration.test.ts` 7종(실 DB)
- ⚠️ 첫 로딩 **11초**(실측 2026-09-05) — `csat_dcp_items` 65만 행 전수 count 둘이 대부분이다.
  PostgREST 집계 함수가 꺼져 있어(`PGRST123`) 한 방으로 접을 수 없다. 집계 RPC 를 넣으면 ~1초.
- ⚠️ 전수 count 의 **차가운 첫 호출이 `count=null` + 빈 오류로 돌아온다**(실측: 8.5초 뒤 null,
  2·3회차는 1.0초·0.5초). `headCount` 가 한 번 재시도해 삼킨다 — 안 그러면 화면이
  「해설 못 잼」이라 적고 새로고침하면 멀쩡한 **유령 결함**이 된다.

## ~~/admin/textbook — TBP (교재)~~ → 제거 (2026-09-06)

**파이프라인이 둘로 보였다.** 사이드바에 「TBP Pipeline」과 「교재 공장」이 나란히 있었고 둘 다 같은
교재를 말하는데, 한쪽은 **조회만** 하고 한쪽은 **공정**이었다. 관리자가 "교재를 만들려면 어디로
가나" 에 메뉴가 답을 못 했다. 그래서 관측판을 지우고, 그 화면에만 있던 것 셋을 **각 공정으로**
옮겼다 — 그 자리가 원래 자리다.

| TBP 에 있던 것 | 옮긴 곳 | 왜 그 자리인가 |
|---|---|---|
| 브랜드 규격 (색·서체) | ⑧ 조판 (`/admin/csat/press`) | 규격은 조판기의 **입력**이다. 따로 두면 "규격이 바뀌었는데 왜 옛 규격으로 찍혔지" 를 두 화면을 오가며 맞춰야 한다 |
| 초·중 원문 재고 | ④ 소재 (`/admin/csat/sourcing`) | 지문 수급이 곧 그 공정이다. 사다리 아래 계단은 수능 지문으로 못 채운다 |
| 평가 요소 15 | ② 기획 (`/admin/csat/strategy`) | 실측 7축이 **안 보는** 11축만 남겨 「일곱 축 밖」에 건다. 겹치는 넷은 `benchAxis` 로 걸러진다 |

**옮기지 않은 것**: 창고 단위 정답 번호 χ². ⑦ 검수가 이미 **권 단위** 쏠림을 보고 있고, 창고
단위 χ² 는 65만 행 페이징을 쓴다 — 더 약한 신호를 더 비싼 값으로 사는 셈이다.

지운 파일: `app/admin/textbook/page.tsx` · `TextbookConsoleClient.tsx` ·
`lib/textbook/console-stats.ts` · `app/admin/__tests__/textbook-console.test.tsx` ·
`lib/admin/help/textbook.ts` 의 `textbook` 항목.

⚠️ **하위 라우트도 2026-09-06 에 `/admin/csat/sources` 로 옮겼다**(아래) — 세그먼트 `app/admin/textbook` 은 이제 없다. 옛 설명: 부모 세그먼트에 페이지가 없어도
Next.js 는 자식을 그대로 서빙한다. 메뉴에서는 이미 ④ 소재 옆(`④-1 원문 적격`)으로 옮겼고,
경로 자체를 `/admin/csat/sourcing/eligibility` 로 옮기는 것은 별도 작업이다.

---

## /admin/csat/sources — 원문 적격 (2026-09-06 신설 · 같은 날 `/admin/textbook/sources` 에서 이전)

**교재 생성이 임의 판단이 되지 않게 하는 자리.** 「이 지문을 왜 골랐나」에 축·임계값·출처로 답한다.
재고를 세는 화면이 아니라 **자격을 세는 화면**이다 — 재고가 있어도 판정을 통과하지 못하면 실을 수 없다.

- Server Component + `force-dynamic` · 조립은 `lib/textbook/source-eligibility-view.ts`
- 판정 정본은 `packages/library-pipeline/src/textbook/source-eligibility.ts` 의 `judgeSource` — **화면이 다시 계산하지 않는다**
- AdminSidebar 등재 (`사용자 & 콘텐츠` → `TBP Pipeline` 하위 · 부모가 활성일 때만 펼침)

### 일곱 축 — 순서가 곧 판정 순서

되돌릴 수 없는 것부터 본다. 그래야 「고치면 되는 문제」와 「고칠 수 없는 문제」가 사유에 섞이지 않는다.

| 축 | 자의 출처 | 되돌리기 |
|---|---|---|
| 법적 안전 | `license_class` · `display_only` · `copyright_safe_in_kr` | 불가 |
| 게재 안전 | 철회 논문 제목 · 민감 소재 (`csat-format.ts`) | 불가 |
| 게시 게이트 | `scripts/csat/gate-rules.mjs` — 용도 4 · 차단 21 | 가능 |
| 학령 분석 | `process-queue` — V-Level · CEFR · register · 구문 | 가능 |
| 내용 판정 | `csat_fit.gate.verdict` — 규칙만 본 행은 미판정 | 가능 |
| 지문 규격 | `readability.PASSAGE_WORDS` 100~200어 | 가능 |
| 어휘 난도 | `curriculum.CURRICULUM_GATE` 시중 p90 | 가능 |

### 연령 × 유형별 원문 요건 (2026-09-06 추가)

재고 표가 「지금 몇 편인가」를 말한다면 이 표는 **「무엇을 갖춰야 하는가」**를 말한다.
둘이 함께 있어야 「이 지문을 왜 이 학년 이 유형에 썼나」에 답할 수 있다.

| 무엇이 정하나 | 정본 |
|---|---|
| 어느 학년에 어느 유형이 열리나 | `SERIES_SPINE` 7단 |
| 그 유형이 요구하는 창 | 계열 — 수능 짧은 지문 90~200어 · 수능 장문 260~400 · 학교 문단 40~200 · 학교 문장 6~40 · 초등 3종 지문 없음 |
| 학년이 좁히는 창 | `market-spec.json` 그 학년대 p10~p90 (시중 79종 실측) |

조립은 [`source-requirements.ts`](../packages/library-pipeline/src/textbook/source-requirements.ts) —
**새 규격을 만들지 않고** 셋을 곱해 편다. 회귀가 `window` 를 `itemWordSpec` 과 행마다 대조한다.

⚠️ **좁혀지지 않은 것을 좁혀진 척하지 않는다.** 교차가 비면 `itemWordSpec` 이 유형 창을
그대로 쓰는데(재료를 0 으로 만들지 않으려는 규칙), 화면이 그걸 「학년으로 좁힘」으로 보이면
근거가 거짓이 된다. 「유형 창 그대로」로 갈라 적는다.

**DB 를 안 본다** — 스냅샷이 낡아도 이 표는 늘 지금 규격이다.

### 등급 6 — 「다음에 무엇을 해야 하는가」로 가른다

`usable`(그대로) · `excerpt`(발췌해) · `excerpt-blind`(자를 자리 없음) · `unjudged`(내용 판정 없음) ·
`unknown`(분석 없음) · `blocked`(불가). **조판 허용은 앞 둘뿐**이고, 회귀가 그 목록을 잠근다.

「쓸 수 있다/없다」 둘로 가르지 않는 이유는 **고칠 수 있는 것과 못 고치는 것이 한 칸에 뭉치기** 때문이다 —
어수가 넘치는 글(자르면 된다)과 라이선스가 막힌 글(영영 못 쓴다)은 처방이 정반대다.

### 규격 v2 — 긴 글의 신호는 「문항 보유」다 (2026-09-06)

처음에는 `csat_fit.make.windows`(발췌창)로 「자를 수 있는가」를 판정했다. **그 열을 읽는 코드가
저장소에 하나도 없다** — `score-articles` 가 쓰고 아무도 안 읽는다. 조판(`composeUnits`)이 실제로
인쇄하는 것은 문항에 저장된 `passage_text` 이고, 그 지문은 만들 때 `itemWordSpec`(유형·학년별 시중
어수창)을 통과한다. 그래서 **문항 보유를 먼저 보고 발췌창은 보조로만** 쓴다.

⚠️ **미절단 원본은 게이트를 돌려도 판정이 안 붙는다.** `gate-rules.mjs` 의
`PURPOSE_RULE.raw.verdicts` 가 빈 집합이라 `decide()` 가 판정 전에 되돌아온다.
실측: `purpose=raw` 36,337편이 **전부** 판정자 `rule` · verdict 없음이다.
미판정 19,333편 중 **13,459편(70%)이 여기 해당**하므로 화면이 그 몫을 갈라 말한다 —
안 그러면 관리자가 돌지 않을 배치를 돌린다. 처방은 발췌 경로(`plos-extract`)다.

### 첫 실측 (2026-09-06 · 규격 v2)

조판 풀 21,839편 중 **조판 가능 2,211편(10.1%)**. 나머지는 내용 판정 없음 19,333 · 사용 불가 222
(법적 152 · 게재 안전 70) · 발췌 자리 없음 57 · 분석 없음 16.

**문항이 붙은 원문은 19,202편**이다. 조판 가능 2,211편과의 차이 **16,991편**이 곧
「판정 없이 만들어진 문항」의 분모다 — 문항은 이미 있는데 그 원문이 판정을 통과하지 못한다.

⚠️ 그중 **82편이 `restricted` + 국내 불가인데 조판 풀에 있었고, 그중 65편이 V1** 이었다 —
초등 저학년 재고 84편의 77%다. `volume-pool.mjs` 가 `display_only` 하나만 보고 있었기 때문이고,
되돌릴 수 없는 축이라 즉시 막았다(`isLegallyUsable` · 회귀 + 변이 검사로 확인).
나머지 축은 아직 조판이 걸지 않는다 — 막으면 재고가 10%로 줄어 권이 아예 안 나온다.
그 격차를 편수로 드러내는 것이 이 화면의 일이다.

### 조판이 이 판정을 실제로 쓴다 (2026-09-06)

`volume-pool.mjs` 가 권마다 `judgeSource` 를 돌려 **`원문 적격 N/M (X%)`** 을 로그에 찍고,
집계를 `loadVolume` 반환값(`sourceGate`)으로 낸다.

| 축 | 조판에서 |
|---|---|
| 법적 안전 · 게재 안전 | **무조건 차단** (`isLegallyUsable` · 철회 제목 · 민감 소재) |
| 게시 게이트 · 학령 분석 · 내용 판정 · 지문 규격 · 어휘 | **경고** — 편수만 인쇄 |

강제는 `VOCAFLOW_SOURCE_STRICT=1` 이다. 기본을 차단으로 두지 않는 이유는 지금 재고로
강제하면 V2 는 3편 · V3 는 1편만 남아 **그 학년 권이 아예 안 나오기** 때문이다 —
재고를 못 만들면서 규칙만 켜는 것은 규칙을 지키는 것이 아니라 파이프라인을 세우는 것이다.

⚠️ 조판 로그의 분모는 **문항이 붙은 원글**이라 이 화면의 분모(밴드 전량)와 다르다.
판정 열을 밴드 전체 select 에 넣었더니 V4(856편) 조판이 **statement timeout 으로 죽었다**
(jsonb 를 행마다 detoast 한다). 문항 없는 원글은 그 권에 아무것도 기여하지 않는다.

### 한계 — 실시간이 아니다

`library_articles`(91,358행)는 본문이 1.3GB 라 조건부 `count: exact` 가 **8초 statement timeout**
에 걸린다(오류 message 가 빈 문자열로 와서 원인이 안 보인다). 전수 훑기는 커서 페이징으로 9~35초 —
매 요청에 할 일이 아니다. 그래서 스캔 스냅샷(`source-eligibility-snapshot.json`)을 읽고
**언제 잰 값인지 항상 함께** 말한다. 7일이 넘으면 줄이 경고색으로 바뀐다.
제대로 된 처방은 matview + 주기 갱신 + RPC(`textbook_shelf_stats` 선례)이고 마이그레이션 승인이 필요하다.


## /admin/quality (v06.140 신규 — 품질평가 Q3)

`quality_metrics` (nightly pg_cron jobid=12, KST 03:10 `collect_quality_metrics`) 읽기 전용 대시보드.

- Server Component 단일 파일 (`admin/quality/page.tsx`), 마이그레이션 0
- 파이프라인 단계(ingest→analyze→extract→publish→deliver)별 지표 카드 — 최신값 + 전회 대비 + 스파크라인(SVG) + dims 상세
- 도서 지표는 `dims.status`(published/ready) 세그먼트 분리
- RLS read=admin — dev-bypass 브라우징은 빈 상태(정상). 데이터 분기는 `__tests__/page.test.tsx` renderToString 픽스처로 검증
- "지금 수집" 버튼 (`CollectNowButton.tsx`, v06.142) — `admin_collect_quality_metrics()` wrapper RPC(role='admin' 검사 후 `collect_quality_metrics()` 위임) 호출 → `router.refresh()`. dev-bypass(anon)에선 'admin only' 거부 → 오류 상태 노출(정상)

## /admin/quality/judge (v06.270 — 추출 품질 판정 하네스 Q3/Q5)

추출 결과의 "탁월함"(cap 40 안에 최고 가치가 들어갔는가)을 인간 blind 판정으로 축적하는 골든 라벨 하네스. 근거: `docs/AI_CONTEXT/diagnostics/ext_quality_p0_20260718.md`.

- 표본 = in-cap 상위 8 + out-of-cap 경계 8(sort_order 41–48), **서버에서 셔플·출처 은닉** (`get_judgment_sample` DEFINER, in_cap/sort_order/composite 미반환)
- **blind 보존**: 판정 중 시스템 선택을 알 수 없음. `save_extraction_judgment`(DEFINER)이 저장 시점 `select_*_vocab` 재조회로 스냅샷(in_cap·sort_order·composite·v_level) 서버-권위 기록 → 확증편향 차단, 이후 가중 변경 회귀 대조
- 모드 2종: **절대 판정**(가치 있음/애매/제외) + **쌍대 비교**(A vs B). 제출 후 reveal — precision(내 선택 ∩ in-cap)·recall + 단어별 나 vs 시스템 대조
- `extraction_judgments` 테이블(RLS `ej_admin_all` = is_admin_or_curator) · RPC 2종 anon REVOKE + authenticated GRANT
- Calm UI: 붉은 압박 없이 초록(가치)/앰버(애매) + 아이콘. 회차당 1챕터 ~16단어 5분

## /admin/db — DB 헬스 콘솔 (2026-09-06 재설계)

세 층이 한 화면에 있다. 수집(pg_cron)과 판정(`/db-health-audit`)은 여전히 밖에 있고,
이 화면은 **지금을 보여 주고 · 판정을 줄 세우고 · 거기서 조치한다.**

### 화면 순서 — 급한 것부터

| 자리 | 무엇 | 출처 |
|---|---|---|
| 상태 한 줄 | 정상 / 주의 / 장애 / 수집 멈춤 / 지금 상태를 읽지 못함 + 등급별 건수 + 스냅샷 나이 | `overallStatus()` — **가장 나쁜 신호 하나가 전체를 정한다** |
| «지금» | 신호 7타일(연결·캐시 적중·최장 쿼리·IDLE TX·잠금 대기·예약 실패·DB 용량) + 도는 세션 표 + 잠금 대기 + cron 실패 | `admin_db_health_live()` · 15초 폴링(끌 수 있음) |
| «경보» | 열린 발견 표 — 등급 칩 · 축 · 제목 · 열린 지 · 관측 · 조치. 필터(등급·축) + 줄 펼침 | `db_health_findings` |
| «조치 기록» | 실행한 조치의 감사 기록(실패 포함) + 대상 없는 일괄 조치 2종 | `db_health_action_log` |
| «추세» | 축별 스냅샷 지표 + 스파크라인(4회부터) | `db_health_metrics` |
| «이상 징후» · «용량» · «체크포인트» · «면제» | 기존과 같음 | `db_health_anomalies()` 등 |

### 조치 — 화면이 실제로 실행하는 것

| 등급 | 조치 | 어디에 붙나 |
|---|---|---|
| 안전 | 통계 갱신 (`analyze_table`) | 용량 표의 각 행 · 증거에 `table` 이 있는 경보 |
| 안전 | 낡은 통계 일괄 갱신 (`analyze_stale_tables`) | «조치 기록» 머리 · 제목에 「통계」가 있는 경보 |
| 안전 | 쿼리 취소 (`cancel_query`) | «지금» 세션 표의 각 행 |
| 안전 | 잡 재개 (`cron_enable_job`) | 꺼진 cron 잡 줄 |
| 사유 필요 | 세션 종료 (`terminate_backend`) | 세션 표 · 잠금 대기의 「막는 세션」 |
| 사유 필요 | idle-in-tx 일괄 종료 (`terminate_idle_in_tx`) | «조치 기록» 머리 · 지문에 `idle` 이 있는 경보 |
| 사유 필요 | 잡 정지 (`cron_disable_job`) | cron 실패 줄 · 증거에 `job` 이 있는 경보 |
| **실행 안 함** | `VACUUM FULL` · `DROP INDEX` · `ALTER SYSTEM` · 마이그레이션 | 줄을 펼치면 SQL + 「SQL 복사」만 |

- 사유 필요 조치는 **5자 이상**을 적어야 실행 버튼이 열린다. 사유는 감사 기록에 남는다.
- 허용 목록은 DB 함수 본문(`db_health_run_action`)에 박혀 있어 화면에서 늘릴 수 없다.
  화면 카탈로그(`lib/admin/db-health/types.ts` `ACTION_CATALOG`)와 갈리는 것을 회귀가 잡는다.
- 조치는 **재실행 안전하지 않다** — 같은 pid 를 두 번 종료하면 두 번째는 실패로 기록된다.

### 임계값의 출처

전부 이 DB 의 `pg_settings` 실측이고 `LIVE_THRESHOLDS` 한 곳에만 있다 —
연결 70/85%(`max_connections` 60) · 캐시 적중 99/95% · 최장 쿼리 60/110초(`statement_timeout` 120초) ·
IDLE TX 5/15분(`idle_in_transaction_session_timeout`=0, DB 가 스스로 안 끊는다) ·
잠금 대기 1/5 · 예약 실패 1/20. **DB 용량에는 임계값이 없다** — 디스크 상한을 모르는 채 그은 선은 짐작이다.

### 설계 제약 (회귀로 잠겨 있음)

| 규칙 | 회귀 |
|---|---|
| 가시 텍스트 ≤ 3,000자 · 화면 자체 설명문 ≤ 150자 · 한 덩어리 ≤ 200자 (실측 2,037 / 60 / 48) | `app/admin/db/__tests__/density.test.tsx` |
| 재설계 전 화면 사본과 직접 비교해 절반 미만 | 같은 파일 (사본 `__tests__/legacy/page-before-redesign.tsx`) |
| 되돌릴 수 없는 SQL 에 실행 버튼이 없다 · 「모른다」를 「정상」으로 그리지 않는다 | `app/admin/db/__tests__/page.test.tsx` |
| 화면 카탈로그 = DB 허용 목록 · 임계값에 근거 문자열이 있다 | `lib/admin/db-health/__tests__/live-signals.test.ts` |
| 44px 미만 터치 타깃 0 | `components/admin/__tests__/touch-target.test.ts` |
| 1280×900 · 390px 가로 넘침 0 · axe WCAG2 A/AA 위반 0 | `scripts/shot-admin-db.mjs` |

RLS read=admin — dev-bypass 브라우징은 「지금 상태를 읽지 못함」(정상 동작).
데이터가 있는 상태를 눈으로 보려면 `scripts/shot-admin-db-data.mjs`.


---

## 화면도움말 (v06.34 신설 — 전 화면·전 탭)

관리자가 파이프라인 화면에서 "여기서 뭘 하는 곳이고 다음에 뭘 눌러야 하는지"를 즉시 판단하게 하는 인라인 도움말. **모든 Admin 화면·탭에 존재** (37 화면 + 34 탭 = **도움말 71개**, 2026-08-10 실측).

| 항목 | 위치 |
|---|---|
| 스키마 | `apps/web/src/lib/admin/help/types.ts` — `ScreenHelp {summary · when · steps · fields · cautions · drain · seeAlso}` |
| 데이터 | `apps/web/src/lib/admin/help/<pipeline>.ts` — 8 파일 (articles · curation · comic · pd-comics · vocab · vrl · quality · ops) |
| 병합 | `apps/web/src/lib/admin/help/index.ts` → `HELP_REGISTRY` (키 = 라우트 슬러그) |
| 렌더 | `apps/web/src/components/admin/AdminScreenHelp.tsx` — 헤더 `화면 도움말` 버튼 → 인라인 펼침 (모달 아님 · 열어 둔 채 조작 가능 · 열림 상태 화면별 localStorage 기억) |

**탭 연동** — `<AdminScreenHelp screen="curation" tab={활성탭라벨} />`. 조회 키가 **화면에 보이는 라벨 문자열** 이라 탭 라벨만 바꾸면 도움말이 조용히 사라진다 (루트 CLAUDE.md §자동화 정책 3️⃣ 참조).

**Claude Code 드레인 절차 (7 곳)** — 화면만 봐서는 다음 행동을 알 수 없는 반자동 작업이라 `drain {what · prerequisites · procedure · verify · recovery}` 로 따로 렌더 (앰버 박스). **재실행 안전 여부 명시 필수**.

| 드레인 | 위치 |
|---|---|
| 도서 큐레이션 | `curation` → Curated Books 탭 (`drain.mjs list → next`) |
| 만화 컷 생성 | `comic-drain` (`generate-comic.mjs plan → content → gen-verified → insert --commit`) |
| PD 만화 큐 | `pd-comics` → 큐 · 드레인 탭 |
| PD 만화 현대화 | `pd-comics` → 테스트 · 모니터 탭 (Claude Code 오퍼레이터 루프) |
| VCB 보강 | `vocab-run-detail` (`/vcb-batch-enrich`) |
| VCB 시드 | `vocab-run-seed` (`/vcb-seed-list`) |
| VCB 재보강 | `vocab-curate` (`/vcb-reenrich`) |

---

## 권한·보안 (Phase 2~3 예정)

- `middleware.ts` `/admin/*` RBAC guard — `user_profiles.role = 'admin'` 또는 `'curator'` 검증 (Phase 2K)
- 관리자 액션 별도 `audit_logs` 테이블 기록 (예정)
- 관리자 전용 로그인 분리 검토 (`/admin/login` — 2FA · Phase 3)

`is_admin_or_curator()` SECURITY DEFINER RPC 게이트 — 모든 admin_* RPC 의 첫 분기.

---

## 접근성 / UX 원칙

- 보라 액센트는 **색상 + 형태(ShieldCheck) + 텍스트("Admin")** 3중 표현
- "사용자 앱으로" 링크 항상 visible — 컨텍스트 전환 비용 최소화
- 신고 뱃지 색상 + 숫자 + `aria-label` 3중 (색맹 대응)
- 모든 stub 페이지 `components/dev/StubPage` 통일 — 일관된 검증 경험

---

## Server Action 인벤토리

### `/app/admin/curation/actions.ts`

| Action | 효과 |
|---|---|
| `deleteFailedBookAction(bookId)` | 실패 도서 영구 삭제 (admin_delete_book RPC) |
| `bulkSetBooksToInProgressAction(bookIds)` | ready → curating · draft 단어장 삭제 |
| `bulkRequeueBooksAction(bookIds)` | library_books DELETE · seed unlock (v06.34) |
| `fetchCurationJobsAction()` | 큐 상태 뷰 |

### `/app/(main)/text/actions.ts`

| Action | 효과 |
|---|---|
| `deleteUserTextAction(textId)` | 단일 텍스트 삭제 (그룹 chapter 거부) |
| `unenrollBookAction(bookId)` | 라이브러리 도서 unenroll RPC |
| `deleteUserBookGroupAction(groupId)` | v06.34 — 사용자 책 그룹 일괄 DELETE |
