# CHANGELOG

> Vocaflow 변경 이력. 최신 3개 버전(v06.32~34) + 현재 작업 중인 마이그레이션 + 세션 변경 사항을 보존.
> 이전 v06.0~v06.31 의 누적 변경은 git 이력 (`git log`) 으로만 추적.
>
> **갱신 정책**: 새 마이그레이션 / 새 라우트 / 모듈 시맨틱 변경 / 컴포넌트 신설·제거 시 항목 추가.
> SQL · 라우트 경로 · 컴포넌트 이름은 `git`/`grep`/`SQL` 로 100% 검증 가능한 사실만 기록.

---

## Unreleased (v06.34 → next)

### sitemap 이 리다이렉트를 광고하고 정작 카탈로그 셋을 빠뜨리고 있었다 (132 → 134)

콘텐츠 상세 123개를 색인시킨 뒤 **그리로 가는 문**을 봤다.

| | 실제 | sitemap |
|---|---|---|
| `/comics` | **리다이렉트**(→ `/comics/adapted`) | 올라가 있었다 |
| `/comics/adapted` · `/comics/restored` | 실제 카탈로그 | **없었다** |
| `/library/scripts` (Dispatches) | 실제 카탈로그 | **없었다** |

복원 만화 상세 **110개**를 올려 놓고 그 목록으로 가는 문은 색인되지 않는 상태였다.
리다이렉트를 sitemap 에 올리면 크롤 예산이 왕복에 쓰이고, 그만큼 콘텐츠에 못 쓰인다.

- 회귀 `app/__tests__/sitemap-routes-exist.test.ts`(23) — sitemap 의 정적 경로마다
  **그 자리에 `page.tsx` 가 있는지** + **redirect 전용이 아닌지**를 파일 시스템과 대조한다.
  route group(`(main)` 등)은 URL 에 없으므로 그룹 디렉터리를 투명하게 통과하며 찾는다.
  목록을 손으로 관리하는 한 이 어긋남은 반복되므로 코드가 지킨다

### `<title>` 에 Vocaflow 가 두 번 — 공개 화면 13곳

루트 layout 이 `template: '%s | Vocaflow'` 를 갖는데 하위 화면이 접미사를 또 붙였다.
앞 커밋에서 세 곳을 고쳤는데 **전수로 세니 52곳**이었다. 이번에는 **공개·검색 대상 13곳**만
고친다(나머지 39곳은 로그인 뒤 화면이라 검색과 무관하고, 한 번에 30개 넘는 파일을 바꾸지 않는다).

실측 — 고친 뒤:
`복원 만화 | Vocaflow` · `만화 | Vocaflow` · `도서 | Vocaflow` · `소개 | Vocaflow`

덤: `/library/scripts` 의 제목이 **"스크립트"** 였다. `apps/web/CLAUDE.md` 가 못 박은 정본은
**Dispatches** 다("`script` 라는 키가 화면마다 다른 것을 가리킨다" — Library 탭에서는 공개 짧은 글,
Dictation·Vault 탭에서는 내가 넣은 본문). 레지스트리와 맞췄다.

### 도서 상세가 "본문 없음" 이라고 말하고 있었다 — 본문은 13권 전부 있다

앞 사이클에서 "약 0 시간" 을 고치다 같은 화면의 다음 줄을 봤다: **본문 없음**.
DB 를 물어보니 발행 13권 **전부** 선언 챕터 수 = 챕터 행 = 본문 있는 챕터였다.

원인은 RLS 가 갈라져 있는 것이었다:

| 테이블 | 정책 | 결과 |
|---|---|---|
| `library_chapters_master` | 발행 도서면 **누구나**(`read_via_published`) | 목차가 보인다 |
| `content_chunks` | **`auth.role() = 'authenticated'`** | 본문은 0행 |

즉 **비로그인 방문자에게는 목차만 오고 본문이 안 온다.** 그건 제품 결정일 수 있지만,
그 상태를 "본문 없음" 으로 적은 것은 **거짓말**이다. 하필 이 화면이 검색으로 들어온 사람의
착지점이라(sitemap 에 13개가 올라가 있다) 그 한 줄에서 떠난다.

- `SignInToReadPanel` — "로그인하면 1장을 읽을 수 있어요 / 난이도와 어휘는 지금 그대로
  보실 수 있어요. 본문은 계정이 있어야 열립니다." + `?next=` 로 되돌아오는 로그인 버튼.
  기존 `LockedChapterPanel`(2장 이후)과 같은 톤 — 잠금이 아니라 다음 걸음을 말한다
- `isLoggedIn` 을 Reader 까지 내린다 — **"없다" 와 "로그인이 필요하다" 를 가르는 유일한 정보**다
- 1장 본문을 **서버에서 미리 읽어** `initialContent` 로 넘긴다.
  그전에는 본문을 전부 클라이언트에서 fetch 해서 초기 HTML 에 폴백만 들어갔다 —
  로그인 사용자에게도 첫 페인트에 빈 화면이 스쳤고, fetch 도 한 번 더 돌았다

**⚠️ 아직 열리지 않은 것**: 비로그인에게 **1장 본문을 공개**하면 검색엔진이 이 책의
본문을 색인할 수 있고(전부 퍼블릭 도메인이다) 롱테일 유입이 달라진다. `content_chunks` 의
RLS 를 바꾸는 일이라 **마이그레이션이고 제품 결정**이므로 승인 대기 목록에 올린다.

### 짧은 책이 "예상 학습 시간 약 0 시간" 으로 보이고 있었다

검색 표면을 열고 구조화한 뒤 **그 페이지가 실제로 무엇을 보여주는지** 읽어 봤다.
발행 도서 상세의 첫 줄이 "예상 학습 시간 약 **0** 시간" 이었다.

DB 에는 0 이 하나도 없다 — `Ammachi's Amazing Machines` 는 실제로 **2분**이다.
두 화면이 각자 `약 ${Math.round(readingMinutes / 60)}시간` 을 적고 있어서
**60분 미만이 전부 0 으로 접혔다**(`UserPreviewClient` · `NetflixDetailSheet`).

| | 전체 | 60분 미만 |
|---|---|---|
| 발행 | 13 | **2** (15.4%) |
| 발행 대기(ready) | 303 | **21** (6.9%) |

0 은 "짧다" 가 아니라 **"내용이 없다"** 로 읽힌다. 하필 그 대상이 짧은 책이라
**처음 완주해 보기 좋은 콘텐츠가 가장 부실해 보이는** 결과가 됐다.

- `lib/library/reading-time.ts` — 한 시간 미만은 분으로, 그 이상은 시간으로.
  값이 없으면 **문장 자체를 만들지 않는다**(`null` → 화면이 그 줄을 숨긴다).
  "약 0 시간" 을 고쳐 놓고 "약 0 분" 을 새로 만들면 아무것도 나아지지 않는다
- 두 화면이 같은 포매터를 쓴다 — 각자 적었기 때문에 생긴 결함이라 모으는 것이 곧 수정이다
- 회귀 11 — 실제 값(2분 · 148분 · 2452분)으로 경계를 잡는다
- 실측(dev): `예상 학습 시간 약 2분`

⚠️ 확인 과정에서 도서 상세가 **500** 을 내는 것을 보고 잠시 제 변경을 의심했으나,
원인은 `.next` **빌드 캐시 오염**이었다(`middleware.ts` 가 실재하는 `@/lib/auth/account` 를
"Module not found" 로 냈다). `apps/web/CLAUDE.md` 가 경고한 그대로 —
**dev 서버를 같은 dist 로 여러 번 띄운 탓**이다. 깨끗한 dist 로 재기동하니 200/72 KB.
확인용 서버는 매번 다른 `NEXT_DIST_DIR` 를 쓸 것.

### 콘텐츠 123개를 검색에 "작품으로" 보이게 한다 — JSON-LD + 제목 중복 제거

sitemap 에 콘텐츠 상세 123개를 올렸는데, 그 페이지들은 `<title>` 말고는 검색엔진에
아무것도 말하지 않았다. 저자·언어·무료 여부·퍼블릭 도메인은 본문에 한국어로 적혀 있을 뿐이라
기계가 읽지 못한다. 롱테일 유입이 CAC 0 경로 중 하나라 **그 표면의 품질이 곧 유입**이다.

- `lib/seo/structured-data.ts` — `Book`(발행 도서 13) · `ComicIssue`(발행 만화 110).
  `isAccessibleForFree` + 퍼블릭 도메인 라이선스를 명시한다("무료로 읽을 수 있나" 가
  검색하는 사람이 실제로 알고 싶어 하는 것이고, 발행 조건이 그것을 보장한다)
- **지어내지 않는다** — `aggregateRating`·`reviewCount` 는 넣지 않는다. 구조화 데이터의
  허위 표기는 검색엔진 페널티 사유이고, 애초에 이 저장소는 공개 화면에 지어낸 지표를
  걸었다가 걷어낸 이력이 있다. 회귀가 금지 키 목록을 검사한다
- **모르면 키를 뺀다** — `author: null` 이나 `wordCount: 0` 은 "저자가 없다"·"낱말이 0" 이라고
  **말하는** 것이지 모른다는 뜻이 아니다
- 시리즈명이 호 제목과 같으면 `isPartOf` 를 넣지 않는다 — 자기 자신에 속한다는 말은
  정보가 아니다(실제로 카탈로그에 그런 행이 있다: Super Mystery Comics)

⚠️ **`JSON.stringify` 만으로는 `<script>` 안에 넣기 안전하지 않다.**
`<` 를 이스케이프하지 않으므로 제목에 `</script>` 가 있으면 브라우저가 거기서 태그를 끊는다.
`/fit` 의 구조화 데이터는 "코드가 만든 문자열" 이라 이 문제가 없었지만 **여기는 다르다** —
도서·만화 제목은 외부 아카이브(IA · Standard Ebooks)에서 온 값이다. `\u003c` 로 이스케이프.
회귀는 "JSON.parse 가 안 터진다" 가 아니라 **출력에 `<` 가 하나도 없는지**를 본다
(전자는 통과하면서 HTML 은 깨진다).

### `<title>` 에 Vocaflow 가 두 번 나오고 있었다

루트 layout 이 `template: '%s | Vocaflow'` 를 갖는데 하위 화면들이 접미사를 또 붙였다.
`Super Mystery Comics v06n06 · 복원 만화 · Vocaflow | Vocaflow` — 검색 결과에 그대로 나간다.
`/comics/restored/[slug]` · `/library/books/[bookId]` · `/pricing` 세 곳에서 제거.
(랜딩 `/` 는 루트 세그먼트라 template 이 적용되지 않아 그대로 둔다.)

실측(dev, 2026-08-26):
`Ammachi's Amazing Machines — Rajiv Eipe | Vocaflow` ·
`Super Mystery Comics Issue v06n06 · 복원 만화 | Vocaflow`

### 배포 경로가 없었다 + 프로덕션 빌드가 교사 퍼널의 절반을 죽여 놓고 있었다

sitemap 132개·랜딩·계측을 만든 뒤 **그것이 실제로 나갈 수 있는지** 확인했다. 두 가지가 나왔다.

**① `deploy.yml` 이 통째로 TODO 에코였다.**

```yaml
- run: echo "TODO Vercel deploy via vercel CLI / vercel-action"
```

main 에 push 해도 **아무것도 배포되지 않았다.** 앞의 모든 작업은 내보내는 경로가 없으면 0 이다.
(CLAUDE.md §절대 하지 않을 것 — "코드 완성형만, TODO·placeholder 금지" 가 CI 에는 적용되지 않고 있었다.)

- Vercel CLI 로 pull → build → deploy. **시크릿이 없으면 조용히 건너뛴다**(`ci.yml` e2e 와 같은 방식) —
  빨간불로 막지 않되, 켜는 방법을 워크플로 주석에 적었다
- 배포 후 **`sitemap.xml` 을 실제로 GET 해서 확인**한다. 랜딩만 보면 통과하지만 sitemap 은
  **DB 를 읽으므로** 런타임 환경변수 누락이 여기서 드러난다. URL 이 20개 미만이면 실패시킨다
  (콘텐츠 상세가 빠졌다는 뜻 — anon 권한이나 1,000행 절단이 원인일 수 있다)
- 모바일 job 은 **없앴다** — `apps/mobile` 은 기획 단계라 배포할 산출물이 없고,
  TODO 에코를 두면 초록불이 "배포됐다" 로 읽힌다

**② 빌드가 `no-unused-vars` 로 실패하고 있었고, 그 정체가 죽은 계측이었다.**

```
./src/components/teacher/TeacherClient.tsx
13:3  Error: 'noteInviteShared' is defined but never used.
```

import 만 있고 호출이 없었다. 즉 `funnel_events.invite_shared` 가 **영원히 0행**이고,
대시보드의 "초대코드를 공유했고 → 학생이 왔다" 구간은 **분모가 0** 이라 읽을 수 없었다.
화면은 멀쩡히 돌았고 타입 검사도 통과했다 — 계측이 죽는 가장 조용한 방식이다.

- `copy()` 가 복사 성공 후 `noteInviteShared()` 를 부른다.
  덤으로 `navigator.clipboard` 가 없는 환경(비보안 컨텍스트)에서 `.then` 이 터지던 것도 고쳤다
- 회귀 `lib/analytics/__tests__/wired.test.ts`(8) — **정의된 이벤트가 실제로 불리는가**.
  PostHog 7종 + `funnel_events` 2종을 소스 전체에서 대조한다. 이름만 늘리고 배선을 잊으면
  "0건" 으로 보일 뿐 고장으로 안 보인다
- 전수 확인 결과 **죽어 있던 것은 `invite_shared` 하나**였다(나머지 8종은 배선돼 있었다)

**③ 사이트맵이 빌드 시점에 굳고 있었다.**

`revalidate` 가 없어 **빌드 때 한 번 만들고
그대로 굳는다** — 도서를 발행해도 재배포 전까지 132개 그대로다. 콘텐츠를 DB 에서 읽도록 만든
의미가 통째로 사라지는 상태였다. `export const revalidate = 86400` 추가(랜딩·요금제와 같은 주기).
런타임 동작이라 다른 테스트로는 안 잡혀 **소스에 revalidate 가 있는지**를 회귀로 못 박았다.

⚠️ **빌드 라우트 표의 `○` 로는 판별할 수 없다** — ISR 과 완전 정적이 같은 기호다.
처음에 `○ /sitemap.xml` 을 근거로 삼았는데, 그러면 revalidate 가 붙은 랜딩·요금제까지
굳었다 로 오해하게 된다. 실제 확인은 `.next/prerender-manifest.json` 이다:

| | initialRevalidateSeconds |
|---|---|
| `/sitemap.xml` · `/` · `/pricing` | **86400** (ISR) |
| `/about` · `/robots.txt` | `false` (완전 정적) |

`/fit` 은 `ƒ`(요청마다 동적) — searchParams 를 읽으므로 그게 맞다.

### 랜딩 구간을 잰다 + e2e 스모크로 교체 영향 확인

랜딩을 만들었으니 그 구간이 보여야 한다. `/fit` 은 이미 5단계를 재고 있었지만
(`fit_viewed` … `fit_signup_clicked`) **랜딩은 아무것도 재지 않았다** — sitemap 132개 URL 이
전부 여기로 오는데, 그러면 "검색에 안 잡힌다" 와 "왔는데 안 눌렀다" 를 구분할 수 없다.

- `landing_viewed` · `landing_cta_clicked{target:'fit'|'signup'}` 2종 추가.
  `fit` 클릭 수를 `fit_viewed` 와 대조하면 **랜딩→진단 이탈**이 보인다
- `components/marketing/LandingCta.tsx` — **재는 부분만** 클라이언트다.
  랜딩 전체를 클라이언트로 만들면 초기 HTML 에 크롤러가 읽을 내용이 사라진다
  (이 자리에 있던 개발용 화면 인덱스가 정확히 그 상태였다).
  실측: 분리 후에도 SSR HTML 38.6 KB 에 CTA·수치·제목 전부 포함
- `events.test.ts` 의 목록 계약을 **둘로 나눴다** — `arrayContaining` 이 교사 5단계의 **빠짐**을,
  전체 일치가 **늘어남**을 막는다. 늘리는 것 자체는 나쁘지 않지만 `/fit` 이 화면에서
  "붙여넣은 지문을 저장하지 않는다" 를 약속하고 있어, 늘릴 때 한 번 더 생각하게 한다
- **e2e 스모크 7/7 통과** — 랜딩 교체가 학습자 화면을 깨지 않았다

확인했으나 손대지 않은 것:
- `/fit` 의 가입 전환 경로는 **이미 완성돼 있었다**(`/signup` CTA + `fit_signup_clicked` 계측).
  페이지 파일만 grep 하고 "가입 CTA 가 없다" 고 판단했던 것을 정정한다 — 결과 UI 는
  `components/textfit/LevelProfilePanel.tsx` 에 있다
- 미들웨어가 `/` 를 리다이렉트하지 않아 **로그인 사용자도 랜딩을 본다**(헤더에 "로그인" 버튼).
  랜딩이 `revalidate` 하루로 캐시되므로 페이지에서 auth 를 조회하면 캐시가 깨진다 — 다음 사이클
- 스모크 로그에 `www.gutenberg.org` **ECONNRESET**. `failed` 83권을 죽인 `fetch failed` 와
  같은 종류로, 외부 아카이브 연결이 이 환경에서 불안정하다는 증거다(재큐 마이그레이션 근거)

### 랜딩이 없었다 — 문 132개가 개발자용 화면 인덱스를 가리키고 있었다

`sitemap` 을 9 → 132 로 늘린 다음 그 문들이 어디로 가는지 봤다. 루트 `/` 는
**개발용 화면 인덱스**였다(`'use client'`, 307줄, 그룹별 라우트 + status 뱃지).
`(marketing)` 그룹에는 about·fit·pricing·terms·privacy 만 있고 **랜딩 `page.tsx` 가 없었다.**
그런데 sitemap 은 이 경로에 **priority 1.0** — 검색 첫 문 — 을 주고 있었다.
게다가 클라이언트 컴포넌트라 초기 HTML 에 크롤러가 읽을 내용이 거의 없었다.

- `app/page.tsx` = **랜딩**(서버 컴포넌트) · 화면 인덱스는 `/dev` 로 이전
- **지어낸 것을 쓰지 않는다** — 후기·이용자 수·평점·도입 기관 0줄.
  말하는 것은 **검증 가능한 동작**(`lib/marketing/differentiators.ts`)과 **DB 실측**
  (`lib/marketing/trust-signals.ts`)뿐이고, 못 읽으면 그 자리를 비운다
- `differentiators.ts` — 랜딩과 요금제가 **같은 세 가지 약속**을 공유한다.
  각자 적으면 갈라지고, 포지셔닝은 갈라지면 두 화면이 서로 다른 약속을 하게 된다
  (이 저장소가 이름·경로·수치에서 이미 세 번 겪은 모양)
- **1차 CTA 가 가입이 아니라 `/fit`** — 로그인 없이 쓸 수 있는 유일한 가치 증명 화면이고,
  교사 채널(CAC 0)이 성립하려면 그 문이 가장 넓어야 한다(sitemap 이 같은 이유로 0.9 를 준다)
- ⚠️ `robots.ts` — `'/dev/'` 는 **`/dev` 자체를 막지 못한다**(접두사에 슬래시가 붙어서).
  옮긴 화면이 그대로 색인될 뻔했다 → 목록에 둘 다 넣고 회귀가 잡는다
- 실측 검증: SSR HTML 39.8 KB 에 제목·수치 3종·근거·CTA 전부 포함(이전에는 클라이언트 렌더)
- 회귀 `app/__tests__/landing-contract.test.ts`(5) + robots `/dev` 1 — 누가 이 자리를 다시
  클라이언트 화면으로 바꾸면 **에러 없이 검색만 조용히 죽는다**
- 문서: `apps/web/CLAUDE.md` §루트 `/` · `docs/ROUTES.md` §루트 · 개발

### 공개 화면의 수치가 9일 만에 낡았다 — 상수를 걷어내고 DB 에서 읽는다

2026-08-16 진단이 `/pricing` 의 **"학습자 12,000+ / 평점 4.8 / 학교 34곳"**(실측 3 / 0 / 0)을
걷어내고 **콘텐츠 자산 수치**로 바꿨다. 그 교체는 옳았고 당시엔 DB 실측이었다.
그런데 2026-08-26 에 다시 재 보니 **셋 다 어긋나 있었다**:

| 표시 | 실제 | |
|---|---|---|
| 표제어 47,137 | **47,890** | 과소 |
| 도서–어휘 연결 1,678,478 | **1,678,399** | **과대** |
| 수능 순서·삽입 1,374 | **3,280** | 과소 |

같은 파일이 "분기마다 재확인" 이라 적어 두고도 그랬다. **성실함으로는 못 막는다** —
수치는 매일 변하고 사람의 재확인은 분기에 한 번이라 구조적으로 항상 틀린다.
공개 라우트의 과대 표시는 표시광고법 사안이라 규칙을 코드로 옮겼다.

- `lib/marketing/trust-signals.ts` — `fetchPlatformFacts()` 가 집계만 읽는다(행은 안 나간다).
  **sitemap 과 반대로 service-role 을 쓴다**: `content-entries.ts` 는 "익명이 열 수 있는 URL" 이라
  anon 이 곧 정답이지만, 여기는 "우리가 가진 자산의 규모" 라 RLS 와 무관하다.
  실제로 anon 으로는 세 표가 전부 **count=0(오류 없이)** 이라 그대로 쓰면 "표제어 0" 이 걸린다
- 못 읽으면 `null` → 화면이 **섹션을 통째로 숨긴다**. 낡은 숫자를 거느니 안 보여준다
- `/pricing` 을 서버 껍데기 + `components/marketing/PricingClient` 로 분리
  (월간/연간 토글이 `useState` 라 화면은 클라이언트여야 하고 조회는 서버여야 한다) · `revalidate` 하루
- **`/fit` 에도 같은 두 수치가 박혀 있었다** — 회귀 테스트가 잡았다.
  sitemap priority 0.9 이고 교사 채널(CAC 0)의 핵심 화면이라 놓쳤으면 그대로 나갔다
- `/fit` 의 "공개 표제어 18,271개" 는 **수치를 뺐다** — anon 가시 `shared_words` distinct 라
  `head+count` 로 못 세고, 마케팅 화면에서 200KB 맵을 로드할 값이 아니다.
  읽을 수 없는 수치는 상수로 두느니 서술만 남긴다
- 회귀 `components/marketing/__tests__/no-hardcoded-stats.test.ts` — 공개 마케팅 소스에
  천 단위 수 상수 금지(가격 제외). 만들자마자 `/fit` 2건을 잡았다

### 콘텐츠 123개를 검색에 알린다 — sitemap 9 → 132 (+ 1,000행 절단 발견)

미오픈 단계에서 10만 학습자에 이르는 CAC 0 경로는 **검색**과 **교사** 둘뿐이다. 교사 쪽은
계측을 붙였고, 검색 쪽을 처음으로 쟀다 — `sitemap.xml` 의 URL 이 **9개**였고 전부 정적 랜딩이었다.
그런데 로그인 없이 열리는 **콘텐츠 상세가 123개**(발행 도서 13 + 발행 만화 110) 있었다.
문을 123개 내놓고 검색엔진에는 9개만 알리고 있었다. 검색 유입은 랜딩이 아니라 롱테일에서 온다.

- `lib/seo/content-entries.ts` — 콘텐츠 상세 목록을 **anon 권한으로** 만든다.
  service-role 로 읽으면 RLS 가 막는 행까지 올라가 크롤러가 열리지 않는 URL 을 받는다;
  anon 으로 읽으면 "익명이 못 보면 sitemap 에도 없다" 가 자동으로 성립한다
  (실제로 `pd_comic_issues` 969행 중 RLS 가 여는 **110호**만 올라간다 — 필터를 따로 안 적어도 된다)
- ⚠️ **1,000행 절단** — PostgREST 는 select 당 1,000행만 주고 오류도 경고도 없다.
  첫 구현이 `pd_comic_panels` 4,282행을 통째로 읽으려다 잘렸고, 그 안에 든 호가 **28개**뿐이라
  만화 110호 중 **82호가 조용히 빠졌다**. 실패가 예외가 아니라 *그럴듯한 작은 숫자*로 나타난다.
  → `range` 페이지네이션 + 회귀가 **DB 총계(head+count)와 대조**한다(상수를 적으면 같이 낡는다)
- 상세 페이지 제목 — 복원 만화 110호가 전부 `복원 만화 · Vocaflow` **하나**였다(검색엔진에는
  같은 제목 110개 = 중복 취급). `generateMetadata` 로 시리즈·호수·연도를 넣고 canonical 을 준다.
  발행 도서 13권은 metadata 자체가 없어 루트 기본값이 나가고 있었다 — 제목·설명·canonical 추가
- 사이트맵 조건을 **화면과 똑같이** 맞춘다(`copyright_safe_in_kr`) — 갈라지면 404 를 광고한다
- 회귀 19 (기존 11 + 정적/콘텐츠 계약 4 + 실 DB anon·절단 4)

### LCP: 실패한 도서를 되살릴 방법이 없다 — 83권 (마이그레이션 미적용)

`library_books` 401권 중 `failed` **83권**의 사유가 하나뿐이다 — `fetch failed`.
콘텐츠도 파싱도 아닌 **일시적 네트워크 오류**이고, 전부 `standard_ebooks`(377권 중 83권 = **22%**).
되살릴 수 없던 이유가 세 겹이었다: ① `api/lcp/process` 가 catch 에서 status 를 `failed` 로 박고
② 큐 메시지는 archive 로 치우고(주석: "admin 이 수동 검토") ③ **enqueue 트리거가 `AFTER INSERT`
전용**이라 status 를 `queued` 로 되돌려도 큐에 안 들어간다. 설계는 "사람이 다시 민다" 였는데
밀 손잡이가 없었다.

- `supabase/migrations/_pending_lcp_requeue_failed.sql` — **미적용**(승인 대기).
  `trg_lb_requeue` (AFTER UPDATE OF status, `WHEN` 절로 queued 진입만) — 함수는 이미
  `status='queued'` 만 보므로 그대로 쓴다. WHEN 절이 없으면 queued 행을 건드릴 때마다
  중복 메시지가 쌓인다. 발행 트리거는 `published` 전이에만 걸려 충돌하지 않는 것을 확인
- 같은 파일에서 **발행 트리거 중복** 제거 — `trg_lb_publish_word_sets` 와
  `trg_publish_book_word_sets_t` 가 정의가 완전히 동일해 발행마다 `publish_book_word_sets()` 가 두 번 돌았다

### 교사 채널이 어디서 끊기는가 — 대시보드에 두 격차 (파이프라인 완결)

`funnel_events` 의 2종을 **볼 자리**를 만들었다. 숫자가 있어도 볼 화면이 없으면 아무도 안 본다 —
이 저장소가 반복해 겪은 모양이라 마지막에 그것을 만들지 않으려고 넣었다.
**새 화면을 늘리지 않는다** — 관리자가 매일 여는 `/admin` 의 "학습자 활성화·리텐션" 섹션 안,
`RetentionPanel` 바로 아래다.

카운트가 아니라 **격차**로 읽는다. "허브 방문 12" 는 아무것도 말하지 않지만
"12명이 왔고 2명이 만들었다" 는 채널이 어디서 끊기는지 말한다:

| | 분모 (기록) | 분자 (파생) |
|---|---|---|
| 허브에 왔고 → 학급을 만들었다 | `teacher_hub_view` | `classes.teacher_id` |
| 코드를 공유했고 → 학생이 왔다 | `invite_shared` | `class_members` (본인 제외) |

- 분자를 파생에서 가져와 **같은 수치를 두 곳에서 세지 않는다**
- `RetentionPanel` 의 규칙을 그대로 따른다 — **표본이 작으면 비율을 그리지 않는다**
  (3명 중 1명을 33% 로 인쇄하면 그 숫자가 근거처럼 읽힌다). 분모 0 이면 0/0 대신 힌트
- **0 과 "못 쟀음" 을 화면에서 구별**한다. 지금 0 인 것은 "교사가 안 온다" 가 아니라
  **관측 구간이 아직 시작되지 않았다**는 뜻이고, 화면이 그 둘을 문구로 나눈다
- 회귀 `TeacherFunnelPanel.test.tsx` 3종 · 화면도움말 `/admin` 에 두 항목 추가

### 퍼널을 9종에서 2종으로 좁혔다 — 이미 내려진 결정을 읽지 않고 중복 수집기를 만들었다

`funnel_events` 를 9종으로 만든 뒤, 이 저장소에 이미 `lib/admin/retention-math.ts` 가 있고
그 머리주석이 **명시적으로 반대 결정**을 내려 두었다는 것을 발견했다:

> "F4 의 실체는 '수집 장치가 없다' 가 아니라 **'아무도 계산해 본 적이 없다'** 였다.
>  그래서 수집기를 새로 만드는 대신 계산기를 만든다 — 쓰기 부하 0, 마이그레이션 0."
> "순수 재방문(학습 없는 조회)은 **일부러** 수집하지 않는다."

그 기준으로 9종을 재보니 **7종이 이미 파생된다** — signup(`auth.users.created_at`) ·
first_learn(`scores`) · day7_return(활동 리텐션) · class_created/class_joined/assignment_sent
(각 테이블 `created_at`) · visit(저장소가 안 재기로 한 것).

남는 것은 **어떤 테이블에도 흔적이 없는 둘**뿐이다:
- `teacher_hub_view` — 허브에 왔지만 학급을 만들지 않은 사람
- `invite_shared` — 코드를 공유했지만 아무도 들어오지 않은 경우

이 둘이 교사 채널이 **어디서** 끊기는지 말해 주는 유일한 신호다. 나머지는 쓰기 부하만 늘리고
**같은 수치를 두 곳에서 세게** 만든다 — 둘이 어긋나면 어느 쪽이 맞는지 알 수 없다.
이 저장소가 반복해서 겪은 실패 모양이고, 하루 종일 그것을 잡아 온 내가 만들었다.

- 마이그레이션 `funnel_events_narrow_to_unobservable` — CHECK 을 2종으로 · 파생 이벤트 행 삭제 ·
  `first_learn` 트리거 회수 · `anon_id` 컬럼 제거(남은 둘은 로그인 전용) · `user_id` NOT NULL
- 배선 회수 — `/fit` visit · signup · class_created · class_joined · assignment_sent
- `anon-id.ts` 삭제 — 익명 구간이 사라져 고리가 쓸모없어졌다. 쓰지 않을 것을 남기지 않는다
- `funnel.ts` 헤더에 **계측 셋의 경계표** (retention-math 파생 · PostHog 공개화면 · 이 파일 2종)
- 회귀 70종 통과 · `tsc --noEmit` 통과

**세션 초반에 감사 산술은 인용하면서 F4 의 해소 방식까지는 확인하지 않은** 것이 원인이다.

### 사슬의 가운데 두 칸 — 가입은 브라우저에서, 첫 학습은 트리거로

`signup` 과 `first_learn` 을 이어 `/fit 방문 → 가입 → 첫 학습 → 학급 개설` 이 한 줄로 이어진다.
**두 칸의 배선 위치가 서로 다른 이유가 각각 있다.**

**`signup` 은 브라우저에서** — `anon_id` 는 브라우저에만 있어서 서버 콜백
(`exchangeCodeForSession`)에서는 알 수 없다. 거기서 남기면 `/fit` 익명 방문과 이어지지 않는다.
이메일 확인 전이라 `auth.uid()` 가 아직 없을 수 있지만 `anon_id` 만으로 앞 구간과 연결된다.
"이미 가입된 이메일" 방어를 **통과한 뒤에** 남긴다 — 기존 회원의 재시도를 가입으로 세면 안 된다.

**`first_learn` 은 트리거로** — 학습 기록이 들어오는 경로가 여럿이다(scores · reading_sessions ·
echo_match_sessions · dictation_sessions · comic_read_progress). 호출부마다 배선하면 반드시 하나를
빠뜨리고, 빠뜨린 경로로 들어온 학습자는 퍼널에서 **영원히 "가입했지만 학습 안 함"** 으로 남는다.
`daily_activity` 는 그 모든 경로가 결국 모이는 자리라 한 곳만 잡으면 된다.

- 백필 — 이미 학습한 사람을 비워 두면 퍼널이 "가입은 했는데 아무도 학습 안 함" 으로 거짓말한다.
  `occurred_at` 을 실제 첫 학습일로 넣어 시점 분석이 맞게 했다
- **퍼널이 처음으로 실제 숫자를 낸다**: `first_learn` 3명(= 가입자 전원). 나머지 단계는 배포 후 쌓인다

### 익명 구간과 로그인 구간을 잇는 고리 — 헤더에 적어 놓고 만들지 않았던 것

교사 여정이 **두 저장소로 쪼개져** 있었다. `/fit` 익명 체험은 PostHog 로, 가입 뒤 학급 개설은
`funnel_events` 로 간다. 그래서 **"`/fit` 을 써 본 사람이 실제로 학급을 만들었는가"** 를 물을 수
없었다 — 그 질문이 곧 진단 §6 의 교사 채널(CAC 0) 성립 여부인데 분자도 분모도 못 셌다.

직전 커밋에서 `funnel.ts` 헤더에 "`anon_id` 가 그 사이를 잇는 고리다" 라고 **적어 놓고
그 고리를 만들지 않았다**. 이 저장소에서 하루 종일 잡아 온 패턴("설계 의도만 있고 배선이 없다")을
그대로 반복한 것이라 같은 사이클에서 고쳤다.

- `lib/analytics/anon-id.ts` — 브라우저에 무작위 UUID 하나. 사람을 식별하지 않고 기기만 잇는다.
  프라이빗 모드·저장소 차단이면 `null` 을 돌려주고 고리만 끊긴다(화면은 그대로)
- `/fit` 진입을 **자체 DB 에도** `visit` 으로 남긴다 — PostHog 는 외부 분석용으로 두고,
  의사결정에 쓸 사슬(`/fit` 방문 → 가입 → 학급 개설)은 `funnel_events` 안에서 완결시킨다
- 같은 `anon_id` 가 익명 행과 로그인 행에 함께 남아 앞뒤가 이어진다

**정정 하나 더**: 직전 커밋의 "기존 계측은 호출부가 0" 은 틀렸다. 5종 전부 배선돼 있고
PostHog 키도 있다 — `capture(` 만 grep 해서 실제 호출 `track({` 을 놓쳤다(`e2fa33cb` 에서 정정).

### 교사 왕복 5단계 전부 배선 — 그리고 계측이 이미 하나 더 있었다

`teacher_hub_view` · `invite_shared` · `assignment_sent` 를 마저 배선해 **왕복 5단계가 전부 기록**된다.
3단계(허브 도달)와 4단계(개설)의 차이가 "화면은 봤는데 만들지 않았다" 를 드러내는데,
지금까지 그 구간이 통째로 안 보였다.

- `invite_shared` 는 복사가 **끝난 뒤** 기록한다 — 기록이 실패해도 복사는 이미 됐다
- `noteInviteShared()` 를 서버 액션으로 둔 이유: 복사는 클라이언트에서 일어나지만
  기록은 서버가 `auth.uid()` 로 찍어야 위조가 안 된다
- 회귀 `analytics/__tests__/funnel-contract.integration.test.ts` 3종 — DB CHECK 제약과
  TS 유니온이 **갈라지지 않는지 실제로 넣어 보며** 대조한다. 한쪽만 늘리면 새 단계가
  예외 없이 거부되고(호출부는 실패를 삼킨다) 아무도 모르는 채 그 단계만 0행이 된다

**작업 중 발견 — `lib/analytics/` 에 계측이 이미 있었다.** `events.ts`+`client.ts` 가
PostHog 래퍼로 `/fit` 공개 화면 5종을 정의해 두었고, 주석에 "10만 경로는 교사 3,500명 ×
학급 30명... 그 다섯 단계 중 아무것도 셀 수 없다" 까지 적혀 있다. 내가 만든 것과 **겹치는
이벤트는 없고 계층이 다르다**(외부·비로그인·지문 유출 차단 vs 자체 DB·로그인 이후·주체 연결).
병행이 아니라 보완이라 합치지 않고 `funnel.ts` 헤더에 **경계표**를 넣었다 — 둘 다 "퍼널" 이라
불려서 헷갈리면 한쪽이 죽는다.

~~그 기존 계측은 호출부가 0이다~~ → **정정(같은 날 확인): 5종 전부 배선돼 있다.**
`PublicFitClient` 가 `fit_viewed`·`fit_analyzed`·`fit_shared`·`fit_share_opened` 를,
`LevelProfilePanel` 이 `fit_signup_clicked` 를 부른다. PostHog 키도 `.env.local` 에 있다.
앞선 판단은 `capture(` 패턴만 grep 해서 실제 호출(`track({`)을 놓친 것이다.

### 유입 퍼널 계측 신설 — 학습 중은 재고 있었고, 그 앞은 한 줄도 없었다 (20260825161641)

"10만 학습자 파이프라인" 요청을 받아 현재 상태부터 쟀다. **가입자 3 · 최근 30일 신규 0 ·
학급 0행**(마지막 가입 2026-07-05). 그런데 학습 중 계측은 멀쩡하다 —
reading_sessions 256 · scores 78 · daily_activity 38. 즉 **이미 학습을 시작한 사람이 무엇을
했는지는 알지만, 그 앞에서 무슨 일이 있었는지는 한 줄도 없다.**

**요청을 콘텐츠 파이프라인으로 읽지 않았다.** 분기 진단의 실패 모드가 "공급망 비대 · 수요 검증 0"
이고, 사전 47,890낱말을 쌓는 동안 가입자가 3명이다. 파이프라인을 하나 더 만드는 것은 그 격차를
넓힌다. 그래서 **10만 앞을 막고 있는 것**을 찾아 그것을 만들었다.

**교사 파이프라인은 죽어 있지 않았다.** `/teacher` 라우트 · `class-actions` · `assignment-actions` ·
RLS 회귀 16종이 전부 있고 **통과한다**. 게이트도 `role='teacher'` 가 아니라
`classes.teacher_id = auth.uid()` 라 누구나 학급을 만들면 교사가 된다(초기 추론 정정).
막힌 것은 코드가 아니라 **도달과 관측**이었다:
- 사이드바에 `/teacher` 가 있지만 사이드바는 `hidden md:flex` — **모바일에서 안 보인다**
- `wayfinding.test.ts` 에서 `/teacher` 는 **EXEMPT** — "여기서 어디로" 검사를 면제받았다
- 왕복 5단계(링크→가입→도달→개설→초대) 중 **기록되는 단계 0**

- `funnel_events` + `record_funnel_event()` + `funnel_summary(days)` 신설
- 이벤트는 **닫힌 목록**(CHECK) — 자유 문자열이면 오타가 조용히 새 단계를 만들어 퍼널이 갈라진다
- `user_id` 는 클라이언트가 못 적는다. 함수가 `auth.uid()` 로 스스로 찍는다
  (같은 구멍을 `20260815020000` 이 이미 한 번 막았다)
- 비로그인은 `anon_id` 하나만 — IP·UA·referrer 를 넣지 않는다(개인정보 최소 수집)
- **계측이 학습 경로를 막지 않는다**: 주체를 못 이으면 예외 대신 NULL, 클라이언트 헬퍼
  `lib/analytics/funnel.ts` 는 어떤 실패도 삼키고 콘솔에만 남긴다
- **표만 만들고 끝내지 않았다** — 이 저장소에는 스키마만 있고 0행인 표가 이미 있다
  (classes 계열 4개). 같은 커밋에서 `class_created` · `class_joined` 호출부를 배선했다

남은 것: `teacher_hub_view` · `invite_shared` · `assignment_sent` 배선 · 모바일 도달성 ·
`visit`/`signup`/`first_learn` · `/admin` 퍼널 화면.

### 🖐 관리자 탭 대상 — 공용 버튼 하나로 26곳, 나머지는 ratchet 으로 (v08.7)

관리자 33화면 @390px 실측 **231건**. 학습자(8건)와 규모가 다르고, **기준도 달라야 했다.**

- **`화면 도움말` 하나가 26건이었다** — 모든 관리자 화면에 있는 공용 컨트롤(`AdminScreenHelp`).
  `min-h-[36px]` → `min-h-[44px]` 한 줄로 26곳이 함께 나았다. 231 → **205** (실측 일치)
- **나머지 205 는 0 을 요구하지 않는다.** 관리자는 이 제품에서 **데스크톱 표면**으로 설계돼 있고
  (사이드바 `hidden md:flex` · 모바일 대체 내비 없음), 조밀한 데이터 격자(34×36 셀 30개 ·
  27px 행 액션 …)를 전부 44px 로 키우면 **마우스로 쓰는 레이아웃이 무너진다.**
  그건 접근성 개선이 아니라 다른 제품이다
- 그렇다고 안 재면 조용히 나빠지므로 **ratchet** 으로 잠근다 — 늘면 실패, 줄면 바닥선을
  낮추라고 알린다. 모바일 관리자를 제대로 하려면 내비부터 만들어야 하고 그건 제품 결정이다
- 학습자 쪽은 그대로 **0건** · 관리자 스윕 4축 0 실패 · 390px 가로 스크롤 0

### 👆 학습자 전 화면 탭 대상 44px — 8건 고치고 회귀로 잠갔다 (v08.7)

CLAUDE.md 가 "44px 미만 터치 타겟" 을 **절대 하지 않을 것**에 올려 두었는데 재는 테스트가 없었다.
`32-touch-targets` 신설 — 학습자 43화면 @390px 전수. 지금 **0건**.

- 고친 것 8: 북마크 24×24 · 스펠 세션 닫기 36×36 · wordvault 종료 66×36 · 설정 36×36 ·
  **"뜻 보기" 178×32**(학습 중 가장 자주 누르는 버튼) · 발음 듣기 106×36 ·
  구문연습 나가기 41×18 · 빈 서가 CTA 151×34
- 아이콘 크기는 그대로, 누를 면적만 넓혀 시각적 변화는 없다

**이 지표는 세 번의 오탐을 거쳐 왔다** — 그 과정을 스펙 헤더에 남겼다:
1. 정적 grep(`h-8`/`h-9`) **62건** — 큰 탭 영역 안의 아이콘·데스크톱 전용·안 보이는 것까지 셌다
2. 런타임 1판 **30건** — `sr-only` 입력(1×1)을 그대로 셌다. 스타일된 토글 뒤의 숨은 체크박스다.
   그대로 믿었으면 멀쩡한 `/settings` 토글 7개를 "고쳐" 놓을 뻔했다
3. 16×16 체크박스도 같은 오탐 — `p-3` 라벨 안이라 **라벨 전체가 탭 대상**이다
4. 최종 규칙: 체크박스·라디오는 크기와 무관하게 **감싸는 label** 을 잰다 → 진짜 **11건**

⚠️ **이 브랜치의 프로덕션 빌드가 지금 깨져 있다** — `TeacherClient.tsx` 의 미사용 import
(`noteInviteShared`)로 `next build` 가 lint 에서 실패한다. 커밋 `f859b3fd`(다른 세션의
작업 중 커밋)에서 왔고, 진행 중인 남의 파일이라 손대지 않았다. 그동안 검증은 dev 서버에서 했다.

### 👆 팝업 닫기 버튼 3개가 44px 미만이었다 — 폰에는 Esc 가 없다 (v08.7)

팝업을 **390px 에서** 재기 시작하자마자 나왔다. 데스크톱에서만 재던 동안 세 개 다 초록이었다 —
자동화는 늘 `Escape` 로 닫았고, **폰에는 그 키가 없다**는 사실이 검사에 들어 있지 않았다.

- `VocabSetPreviewModal` 36×36 → **44×44**
- `NetflixDetailSheet` 36×36 → **44×44**
- `BookDetailModal` · `EnqueueModal`(관리자) 32×32 → **44×44**
- CLAUDE.md 의 "44px 미만 터치 타겟" 절대 금지 위반이었다. 아이콘 크기는 그대로 두고
  누를 면적만 넓혀 시각적 변화는 없다
- `31-popup-return` 에 `SWEEP_VIEWPORT=mobile` 축 추가 — 모바일에서는 ① 눌러 닫을 컨트롤이
  **보이는가** ② 44px 이상인가 ③ 다이얼로그가 화면 밖으로 넘치지 않는가 를 함께 본다.
  Esc 로만 닫는 검사는 "폰에서는 갇히는 팝업" 을 구조적으로 못 잡는다
- 데스크톱 8/8 · 모바일 8/8

### 📱 모바일 390px — 관리자는 이동 수단이 없다, 가로 스크롤 2건은 고쳤다 (v08.7)

CLAUDE.md 가 "모바일은 이 흐름을 보지 못한다 · 미해결" 로 적어 둔 것을 **숫자로 갈랐다.**

- **학습자 @390px = 177/177 (100%)** — 화면은 열리고·조용하고·앞길이 있고·되돌아온다.
  즉 모바일에서 깨지는 것은 화면이 아니라 **내비 발견성**이다
- **관리자 @390px — 33화면 중 30곳에서 보이는 관리자 링크가 0개**. 사이드바가 `hidden md:flex`
  이고 관리자 레이아웃에는 모바일 대체가 없다. URL 을 직접 치는 것 말고는 이동할 길이 없다.
  바꾸려면 모바일 관리자 내비를 만드는 **제품 결정**이 필요하므로 사실만 기록한다
- **가로 스크롤 2건은 의도일 수 없어 고쳤다** (`30-admin-sweep` 이 33화면 전수로 잠근다):
  - `/admin/quality` +36px — 헤더 오른쪽 블록이 `shrink-0` 이라 자리가 없으면 밀려났다 → `flex-wrap`
  - `/admin/curation` +696px — 표는 `overflow-x-auto` 안에서 **이미 잘려 있었는데도** 루트가
    넘치는 자손을 셈에 넣어 페이지 전체가 밀렸다 → `[contain:paint]`
    (검증: `overflow-x:hidden` → 그대로 · 조상 `min-w-0` → 그대로 · `contain:paint` → 해결)
- **부수 발견** — `/library/books` 는 렌더마다 `gutenberg.org` 를 2회 부른다. 발행 도서 13권 중
  2권이 gutenberg 표지이고 `next/image` 가 서버에서 최적화하기 때문. 12/13 이 외부 호스팅
  표지라 **학습자 카탈로그가 제3자 가용성에 묶여 있다** — 화면은 뜨지만 표지가 깨진다
- **낡은 주석을 또 하나 고쳤다** — 26-learner-sweep 의 "빌드가 깨져 있다" 는 이미 정정했고,
  이번엔 그 덕에 프로덕션 빌드에서 모바일까지 잴 수 있었다

### 🪟 팝업 제자리 — 커버리지 2/9 → 6/9, 분모를 정직하게 다시 셌다 (v08.7)

- **분모를 실측으로 다시 세웠다.** `role="dialog"` 파일은 28개지만, 그중 정적 화면에서
  실제로 **열 수 있는 것은 9개**다. 나머지 19개는 프리미티브(3) · body 잠금 안전망(1) ·
  학습 세션 내부/동적 라우트(15)이고, **각각 이유를 스펙에 적어 강제**한다
  (이유 없는 면제 목록은 커버리지가 아니라 눈속임이다). 파일 수가 늘면 목록 불일치로 깨진다
- **6/9 커버** — GameBrief · VocabSetPreview · **NetflixDetailSheet** · SeriesInfoModal ·
  ComicInfoDialog · BookDetailModal(관리자). 남은 셋(EnqueueModal · SeedDetailModal ·
  AdminPdComicsClient)은 **외부 API 데이터에 의존하는 2단계 흐름**이라 덮지 않고 이름을 남긴다
- **`GlobalBodyReset` 이 이름을 대고 있던 `NetflixDetailSheet` 는 지금 새지 않는다** —
  안전망이 만들어진 원인이었던 컴포넌트를 실제로 여닫아 `body.overflow` 복원을 확인했다
- 계측기 결함 3건 더 자체 수정 — 다이얼로그 트리거를 서가(`/comics/restored`)에서 찾던 것
  (실제로는 시리즈 화면에 있다) · 같은 동작의 라벨이 컴포넌트마다 다른 것("미리보기" vs
  "미리보기 열기") · 포커스 불가능한 `<tr>` 을 눌러 "포커스가 BODY 로 떨어졌다" 로 오판한 것
  (앱에는 행 안에 제목 버튼이 있어 키보드로 열린다)
- ⚠️ 관리자 팝업은 **dev 서버에서만** 검증된다 — `DEV_ADMIN_BYPASS` 가 프로덕션에서
  하드 게이트로 꺼지고, 이 저장소의 유일한 admin 계정은 소유자 것이다

### 🔎 전 화면 점검 — 관리자 25화면은 아무도 열어 본 적이 없었다 (v08.7)

학습자·관리자 전 화면의 **열림 · 조용함 · 연결 · 뒤로가기 · 팝업 제자리**를 전수로 잰다.
측정 재실행: `node scripts/ux/route-coverage.mjs`

- **관리자 전수 훑기 신설** (`30-admin-sweep` + `utils/admin-routes`) — 기준선 실측:
  관리자 정적 라우트 33개 중 어떤 스펙에라도 등장하는 것이 **8개(24.2%)** 뿐이었다.
  나머지 25개는 열리는지조차 아무도 안 봤다. 지금은 33/33 × 4축 **0 실패**
- **"빌드가 깨져 있다"는 스펙 주석이 낡아 있었다** — `26-learner-sweep` 이 그 한 줄 때문에
  계속 dev 서버에서만 돌았고, **실행마다 다른 화면 하나가 실패**했다(연속 2회: `/text` ✗앞길
  → `/library` ✗열림 — 둘 다 앱이 아니라 컴파일 지연). 실측하니 `next build` 는 exit 0 이다.
  프로덕션 빌드에 올려 재니 **177/177 = 100%**, 시간도 7.7분 → 3.4분
- **팝업 제자리 스펙 신설** (`31-popup-return`) — `role="dialog"` 컴포넌트가 28개인데
  여닫은 뒤 **주소·스크롤·body 잠금·포커스**가 제자리인지 재는 스펙이 없었다. 4/4 통과
- 계측기 결함 4건을 만들고 고쳤다 — `.env.local` 경로 오산(조용한 skip) · 리다이렉트 껍데기를
  빈 화면으로 판정 · 앞 화면의 미완료 요청(최대 31건)을 물고 다음 라우트를 재던 것 ·
  팝업 스크롤 기준선을 **클릭 전**에 잡아 "튀었다" 로 오판하던 것
- 라벨 불일치 발견 — 같은 동작을 `VocabSetCard` 는 "…미리보기 열기", `VocabSetCarousel` 은
  "…미리보기" 로 부른다(한쪽만 찾는 자동화는 조용히 건너뛴다)


### 멸칭 33행이 학습자 암기 카드로 나가고 있었다 — 삭제가 아니라 재분류로 막았다

`nigger`·`niggers` 가 발행 챕터 단어장 3곳(Tom Sawyer Ch.6·Ch.10 · The Mysterious Affair at
Styles Ch.8)에 **외울 낱말로** 들어가 있었다. negro(7) · whore(5) · negress · midget · hussy ·
sodomite · gypsy · gipsy · savages · retarded 까지 **33행 / 발행 세트 30곳**.
전부 `word_register='standard'` 라 추출 노이즈 필터를 그대로 통과했다.

**손목록이 아니라 사전 뜻풀이로 전수 검색했다** — 뜻에 모욕·비하·멸칭·차별이 들어간 표제어 중
발행분에 있는 것. 그 결과 대부분이 오탐이었다(`despise`·`contempt`·`insult`·`racism`·`slur` 는
**경멸을 뜻하는 정상 낱말**이지 멸칭이 아니다). 선은 하나로 그었다 —
**주된 뜻이 특정 집단(인종·성·장애·성적지향)을 겨냥한 멸칭인 것만.**

- 재분류 **9개** → `period_cultural` (노이즈 배열에 이미 있어 앞으로 추출이 자동으로 거른다):
  nigger · negro · negress · whore · midget · hussy · sodomite · gypsy · gipsy
- 이미 나간 **33행 삭제** + 세트 30곳 `word_count` 재계산
- **사전에서 지우지 않았다** — 18개 표면형 전부 여전히 해석된다. Tom Sawyer 본문에서 누르면
  뜻은 떠야 한다. 지웠으면 학습자가 원문을 읽다 막힌다
- **일부러 남긴 것**: 등재된 뜻이 중립인 것(`chink`=좁은 틈 · `retard`=지연시키다 ·
  `faggot`=땔감 다발 · `queer`=성소수자의 · `savage`=형용사)과 문학 독해에 필요한
  경멸 뉘앙스 어휘(lackey · minion · yokel · dotard · spinster · effeminate · heathen)
- 회귀 `library/__tests__/slur-not-published.integration.test.ts` 3종 — 발행분 0 · **여전히 해석됨** ·
  남기기로 한 낱말이 안 지워짐(과잉 삭제 방지). 게이트 critical **7/7 PASS** 유지

⚠️ **이 목록은 완결이 아니다.** `word_register` 에 비속어 값이 없어 멸칭을 표시할 자리가 없고,
새 멸칭이 `standard` 로 들어오면 같은 일이 반복된다. 근본 해결은 레지스터 확장이다
(노이즈 배열을 하드코딩한 함수 6개를 함께 고쳐야 한다).

### 게이트 critical FAIL 0 달성 — 그리고 그 과정에서 비하어 18개가 학습자 단어장에 있는 것을 발견

품질 게이트 전역 critical **7/7 PASS**. 마지막 하나였던 `I7 노이즈 register 발행 누출` 은
`incontinently`(archaic_literary) 2행 — `select_book_chapter_vocab` 이 이미 archaic_literary 를
제외하므로 그 규칙이 생기기 전의 잔재였다. 세트의 나머지는 건드리지 않고 2행만 지우고
`word_count` 를 다시 셌다(재발행은 학습자가 보던 목록 전체를 바꾼다).

발행 단어장 **83행**이 아직 옛 템플릿 예문을 들고 있던 것도 사전의 새 예문으로 교체했다 —
`sync_published_set_examples` 는 사람 수정을 덮지 않으려고 **빈 칸만** 채우도록 설계돼 있어
"나쁜 값 교체" 는 통과시키지 못한다. 대상을 '아직 템플릿 패턴인 행'으로 한정해 멱등을 유지했다.

⚠️ **범위 밖에서 발견 — 비하어 18개가 발행된 학습자 단어장에 암기 카드로 들어가 있다.**
`nigger`·`niggers`(Tom Sawyer Ch.6·Ch.10 · The Mysterious Affair at Styles Ch.8) ·
`negro` · `negress` · `chink` · `whore` · `faggot` · `fag` · `retard` · `retarded` ·
`cripple` · `midget` · `gypsy` · `gipsy` · `savage` · `savages` · `heathen` · `queer`.
전부 `word_register='standard'` 라 추출 노이즈 필터를 그대로 통과했다 —
비속어 레지스터가 없어 등재를 보류했던 바로 그 사고가 **이미 일어나 있었다.**
일부(savage · queer · heathen · cripple · fag)는 문맥에 따라 정당한 낱말이라 일괄 제거는 과잉이고,
낱말별 판단 + register 재분류가 필요하다. **미조치 — 결정 대기.**

### 템플릿 예문 212행 교체 — 맥락 없는 자동 문장을 실제 용례로

`He often uses the expression "X" in conversation.` 같은 자동 생성 문장이 **212행** 있었다.
맥락 의존 인출(학습 원칙 5)을 무효화하는 값이라, 예문이 **비어 있는** 게 아니라
**나빠서** 고쳐야 하는 첫 사례다. `example-fill.mjs` 에 `--template` 모드를 넣었다.

- 대상 정의가 달라 **형태·register 필터를 걸지 않는다** — 212행 중 **140이 관용어 · 109가 phrase_unit**
  이라, 결측 모드의 필터(단일 소문자어 · 노이즈 register 제외)를 그대로 쓰면 대부분이 빠진다
- dump 와 apply 가 **같은 패턴 정의**를 공유해 멱등 — 한 번 갈아 끼우면 패턴에 안 걸린다
- 검증 규칙도 고쳤다. 어간 통째 요구 → 관용어 오탈락(괄호·슬래시는 **선택지 표기**라 한 문장이
  모든 갈래를 담을 수 없다). 가장 긴 토큰 요구 → 그 토큰이 대개 **자리표시자**(somebody·something)라
  43건 중 14건 오탈락. 지금은 **내용어 토큰이 하나라도** 있으면 통과 — 이 검사의 목적은
  구문 분석이 아니라 "표제어를 안 쓴 게으른 예문" 걸러내기다

**지표의 한계를 함께 기록한다.** 진짜 템플릿 마커 3종(`uses the expression` ·
`^This word/term/phrase` · `… in conversation/sentence.`)은 **전부 0** 이 됐다. 남은 3건은
`^The word …` 로 시작하는 **의도적 용법주석**이다 — 비하어(nigger·chav·blowjob)는 그 말을
**쓰는** 문장이 아니라 **어떤 말인지 밝히는** 문장이 맞는 표기라(앞서 negress 에 쓴 방식),
지표를 0으로 만들려고 고치지 않았다. 오탐 5건(herein·undefined·unobjectionable·syllable·morpheme)은
실제로 더 나은 예문으로 다시 썼다.

### 드레인 설계 결정 둘 — 접두사 파생은 넣고, 비속어는 이연한다

**① 접두사 파생을 후보에서 뺀 것은 과했다.** 처음엔 non-·anti-·un- 을 통째로 제외했다.
**해석기** 관점에서는 옳다 — anti-slavery 를 slavery 로 풀면 뜻이 정반대가 된다. 그런데
**등재** 관점에서는 위험이 없다: 뜻을 명시해 넣는 행위는 아무것도 뒤집지 않는다.
빼 두면 self-doubt · self-awareness · non-coding · sub-saharan 같은 **굳은 낱말이 영영 큐에 남는다**.
판정 기준은 하이픈 합성어와 같다 — 뜻이 부분의 합이 아니거나 관용으로 굳었으면 등재.

그래서 네 번째 판정 `defer` 를 뒀다. non-rotating · three-carbon · culture-positive 처럼
**그 자리에서 만들어 쓴 형태**는 노이즈가 아니라 실단어인데 표제어로 넣을 값이 없다.
out.json 에서 빼면 다음 export 에 영원히 다시 나오므로, 큐에서 `reviewing` 으로 내린다
(이미 있는 상태값이라 화면이 그대로 보여 준다).

**② 비속어(shit · fuck · crap)는 이연한다.** `word_register` 에 비속어 값이 없어 넣으면
`standard` 로 들어가 단어장 후보가 된다. 값을 추가하려면 노이즈 배열을 하드코딩한
**함수 6개**(select_book_chapter_vocab · select_article_vocab · lookup_word_meaning ·
extract_vocabulary_for_user_v2 · run_content_quality_gates · run_content_quality_gate_details)를
모두 고쳐야 하는데, 얻는 것은 **낱말 3개**다. `register` 축을 "실소비처 확정 시 재개" 로
이연해 둔 것과 같은 판단이다 — 비속어 표시 UI 가 생길 때 함께 한다.

- 2라운드(chunk-00 재생성, 60낱말) — 사전 **+19**(anti-slavery · self-awareness · self-interest ·
  self-love · non-coding · sub-saharan · multi-center · second-line · mesophyll · ergosphere ·
  photorespiration · machiya · asmr · lstm · pid · med …) · proper_noun_forms +8 ·
  noise_blacklist +22 · `defer` **11**
- 큐 9,022 → **8,962** (added 406 · rejected 1,702 · reviewing 11)
- 후보 3,427 / 58청크 (접두사 파생 포함으로 +70)

### pending_words 드레인 — 판정이 셋인 것이 핵심이다

큐 9,022행을 규칙으로 갈라 보면 매번 절반에서 막힌다. `lexicon_clean` 에 영어로 있으면 진성 갭이라
했더니 ted·avon·baidu 가 올라오고, 코퍼스에 없으면 노이즈라 했더니 thylakoid·mesophyll 이 섞였다.
남은 판단은 "영어 낱말인가 · 고유명사인가 · 쓰레기인가" 하나뿐이라, 저장소가 이미 쓰는 3단 드레인으로 만들었다.

**`scripts/dict/drain-pending-words.mjs`** — export → Claude Code → import.
등재만 하면 큐가 안 줄고 기각만 하면 실단어를 버리므로 **판정을 셋으로** 뒀다:

| verdict | 사전 | 큐 | 어디로 |
|---|---|---|---|
| `add` | 등재 | added | |
| `proper_noun` | — | rejected | `proper_noun_forms` |
| `noise` | — | rejected | `noise_blacklist` |

뒤 둘이 중요하다 — 두 표는 `ingest_topic_corpus_doc` 이 조회하므로 **다시 큐에 안 올라온다**.
화면의 "거절" 버튼은 status 만 바꿔서, 같은 낱말이 다음 코퍼스 적재 때 그대로 다시 올라왔다.

- 1라운드(chunk-00, 60낱말) — 사전 **+11** · proper_noun_forms **+8** · noise_blacklist **+40**
  (외국어 32 · LaTeX/URL 조각·미확인 8) → 큐 9,081 → **9,022**
- 후보 3,357 / 56청크. 접두사 파생은 뜻 반전 때문에 **일부러 제외**
- 재실행 안전 — export 는 해석되는 낱말·기지 노이즈를 빼고, import 는 기존 표제어를 건너뛰며 건너뛴 수를 출력
- 화면도움말 `/admin/pending-words` 에 드레인 3단(단계별 재실행 안전 여부) 추가

**돌리면서 잡은 결함 셋** — ① 예문 검증이 하이픈을 한쪽만 지워 `pro-slavery` 등 5건 오탈락.
② `noise_blacklist.category` 체크 제약을 몰라 40건이 **조용히 안 들어갔다**(큐는 rejected 인데
블랙리스트는 비어, 다음 적재에서 다시 올라올 상태) — 이제 실패하면 종료 코드 1 로 끊는다.
③ out.json 을 남긴 채 export 를 다시 돌리면 청크 경계가 밀려 짝이 깨진다 — 멈추도록 막았다.

### "하이픈 노이즈" 는 노이즈가 아니었다 — 3,238낱말이 눌러도 안 뜨는 상태였다

큐 2단계로 **하이픈 3,088행을 규칙 기각하려다 멈췄다.** `triage.ts` 가 그 갈래를
"부분이 이미 해석됨 — 등재 불필요" 로 규정하고 3순위(=무시)에 두고 있었는데, 확인해 보니
**`resolve_dict_headword` 는 하이픈 토큰을 분해하지 않는다.** 부분이 해석되든 말든 전체형은 NULL 이다:

    well-being(166) · decision-making(123) · so-called(99) · well-known(75)
    face-to-face · hands-on · real-time · in-depth  →  전부 NULL

학습자가 누르면 아무것도 안 뜬다. 기각했다면 **실낱말 2,473개(8,124회)를 "무시해도 되는 것" 으로
확정**할 뻔했다. 갈래를 다시 나누면 접두사 파생(non-·anti-·self-) 615 · 진짜 합성어 2,473 이다.

- 하이픈 합성어 **53낱말 등재** (well-being · decision-making · face-to-face · meta-analysis ·
  light-year · gamma-ray · peer-reviewed · socio-economic · light-dependent/independent …)
- `triage.ts` 정정 — 라벨 '하이픈 노이즈'→**'하이픈 합성'**, 우선순위 3→1,
  조치 문구를 "뜻이 부분의 합이 아니면 등재, 접두사 파생은 보류" 로. 화면도움말도 같이
- 고유명사 **339행** → `proper_noun_forms` 등재 후 기각. `lexicon_clean.is_valid_word=false` 가
  사실상 고유명사 플래그였다(wharton · delhi · istanbul · picasso …). 적재 함수가 이 표를 보므로
  **다시 큐에 들어오지 않는다** — status 만 바꾸는 것보다 나은 자리다
- 큐 11,081 → **9,081행** (added 376 / rejected 1,624)

**기각하지 않은 것**: 접두사 파생 615 는 뜻이 뒤집혀(anti-slavery→slavery) 해석기로도 못 풀고
등재도 판단이 필요해 남겼다. 코퍼스에 없는 토큰 3,711 도 규칙만으로는 못 가른다.

### 코퍼스 적재 언어 게이트 + 갭 낱말 문서 빈도 (마이그레이션 20260825114639)

`pending_words` 를 채운 비영어 낱말의 출처가 **1,935편 중 4행**(자막이 통째로 비영어인 TED talk 3편)임을
문서 단위로 특정하고, 같은 일이 다시 생기지 않게 적재구에 게이트를 세웠다.

**임계값을 짐작으로 정하지 않았다** — unique_words ≥ 100 인 1,889편의 실제 gap 비율은
평균 **2.4%** · 정상 최대 **12.3%**, 문제의 4행은 **61.8~92.1%**. 0.25/0.30/0.40 어디로 잡아도
걸리는 문서는 똑같이 그 4행뿐이라 오탐 비용이 사실상 0인 구간(0.30)을 골랐다.
하한 100 을 두는 이유: NASA 이미지 캡션(unique 40~56)은 정상인데도 24.5% 까지 오른다.

- `ingest_topic_corpus_doc` — 해석률 판정을 **쓰기 전에** 하고, 걸리면 아무것도 쓰지 않은 채
  `rejected` 로 반환 + 큐를 `failed` 로 닫는다. 사전이 곧 언어 판별기다
- `pending_words.doc_freq` 신설 — `topic_word_stats` 는 **해석된 낱말에만** doc_freq 를 남겨서,
  갭 낱말은 총량(`encounter_count`)만으로 줄을 섰다. **한 편에서 107번 나온 `cua`가
  12편에 걸친 `microbiome` 보다 위**에 있던 이유다. 기존 행은 되계산 불가 → 0(미집계)
- `/admin/pending-words` — `문서` 열 추가 + 정렬을 `doc_freq DESC, encounter DESC` 로
- **죽은 10-인자 오버로드 제거** — 인자 하나를 빠뜨린 호출이 생기면 고유명사·노이즈 필터와
  이 게이트를 통째로 건너뛴 채 조용히 성공한다
- `harvest.ts` · `local-corpus.ts` — 거부를 permanent 실패로 처리(재시도해도 같은 자막)
- 회귀 `topic-corpus/__tests__/language-gate.integration.test.ts` 2종 — 거부 판정 + **아무것도
  쓰지 않았음**을 단언(부작용 없는 시험)
- 문서 — `CONTENT_QUALITY_GATE.md` 에 빠져 있던 **I12** 행 추가 · `DB_SCHEMA.md` pending_words 갱신

### pending_words 는 학습자 큐가 아니었다 — 노이즈 61% 가 TED 카탈로그 한 소스에서 나온다

"학습자가 만난 실수요 2,169 lemma / 9,673 encounter" 라고 읽고 있었는데 **전제가 틀렸다.**
11,081행 **전부** 2026-08-13~17 사이에 만들어졌고 `user_id` 가 붙은 학습자 행은 **39개**뿐이다
(`text_id` 는 전 행 NULL). 나머지는 주제 코퍼스 적재가 `context_snippet='corpus:<소스>'` 로 넣은 것이고,
`encounter_count` 도 학습자 조우 횟수가 아니라 **코퍼스 빈도**다.

소스별로 가르니 노이즈의 출처가 하나로 모였다 — `corpus:ted:catalog` 가 대기 **5,804행(61%)**,
그중 **67%가 사전 코퍼스에도 없는 토큰**(베트남어·LaTeX 파편). 뒤이어 문서 단위로 좁히니
출처는 소스 전체가 아니라 **1,935편 중 4행**(자막이 통째로 비영어인 TED talk 3편)이었다 —
"카탈로그가 번역 제목을 담기 때문" 이라는 초판 설명은 틀렸고 **자막 자체**가 원인이다.
조치는 적재 쪽 언어 게이트(마이그레이션 `20260825114639`).

- 사전 등재 **51낱말** — 상위 encounter 중 실제 영어 낱말만(esports · photosynthetic · supermassive ·
  spacetime · endometriosis · speciation …). 고유명사·브랜드·약어는 `proper_noun`/`brand`/
  `abbreviation` 레지스터로 넣어 해석은 되되 단어장 후보에는 안 들어가게 했다
- `grandchild` 계열 5낱말에 `-children` 굴절형 추가(`be with child` 오생성 1건 되돌림)
- 큐 정리 — `added` 318행/4,461 encounter · 규칙 기각 `rejected` 1,285행(외국어 1,174 · 2자 이하·숫자 111)
  → 대기 11,081 → **9,479행**
- 욕설(shit·fuck·crap)은 등재 보류 — `word_register` 에 비속어 값이 없어 넣으면 `standard` 로
  단어장 후보가 된다. 레지스터 확장이 먼저다
- 화면도움말 `/admin/pending-words` — 출처 둘(학습자/코퍼스) · encounter 의 의미 · "진성 갭" 과대 계상 명시

### 폐쇄집합 기능어 19개가 비어 있었다 — "그녀 자신"이 "그녀"로 나가고 있었다

`whatever`·`anywhere`·`nobody` 는 표제어인데 `whenever`·`wherever`·`whoever`·`amongst`·
`anymore`·`nowhere` 는 없고 `resolve_dict_headword` 도 NULL 을 냈다. 같은 자리에서 하나는 되고
하나는 안 되니 설계가 아니라 **목록의 구멍**이다. 재귀대명사는 더 나빴다 — `myself`·`itself`·
`ourselves` 는 표제어인데 `herself`·`himself`·`themselves`·`yourself` 는 she/he/they/you 로
떨어져 뜻이 바뀌어 나갔다.

폐쇄집합이라 **전수로 훑을 수 있었다** — 173개 후보 2라운드로 사각 14개 + 재귀대명사 5개 = **19개 등재**.

- 해석 NULL 9 (amongst · anyhow · anymore · no one · nowhere · whenever · wherever · whoever · whomever)
- 오해소 재귀대명사 5 (herself · himself · themselves · yourself · yourselves)
- 2라운드 추가 5 (anyplace · each other · one another · per se · vice versa)
- 레벨은 같은 계열 기존 표제어에 맞춤(myself A1/V1 · anywhere A2/V2 · however B1/V4 · whichever B2/V5) ·
  `field_provenance.v_level='closed-class-fill-20260825'`
- **철자 변이는 건드리지 않았다** — towards→toward · anyways→anyway 는 정본으로 접히는 것이 정상 동작이고,
  표제어로 만들면 같은 낱말이 두 철자로 중복 등재된다
- 검증 46/46 자기 표제어 해석 · `pending_words` 6건(430 encounter) added 종료
- 회귀 `library/__tests__/closed-class-resolve.integration.test.ts` 4종(실 DB)

### VRL — 진짜 막힌 것은 v_level 459 였고, 3축 9,352 는 채우지 않기로 했다

"분류가 사전 증가를 못 따라간다"는 진단이 **틀렸다.** 90일 창이 만든 착시였고,
`classified_by` 로 쪼개면 특정 배치가 3축 패스를 **통째로 건너뛴** 것이다
(derivational 6,350행 100% · opus_5 2,067행 100% · opus_4_7 39,305행 중 920).

**채움률 80.4% 는 품질 지표가 아니었다** — 채워진 38,385행 중 약 24,000행(62%)이 per-word
판단이 아니라 v_level 로 찍은 상수다(V11 17,296행의 `track_levels` 벡터가 **딱 1개**).
skill 축은 형태 규칙이 기존 라벨의 97.2% 를 재현하고, 미분류 9,350행은 전부 단일어라
채워도 유일한 소비처(`_extract_composite_score` 의 `skill_level=4` 페널티)에 안 걸린다 — **행동 변화 0**.
그래서 3축은 `register` 와 같은 이유로 이연한다. (`calc_skill_level()` 은 실데이터와
32,761행 어긋나는 죽은 함수임도 확인 — 근거로 쓰지 말 것.)

**v_level 459 만 실제 결함이었다.** 도서 추출은 `v_level BETWEEN`, 기사 추출은 `>= 6` 으로
거르는데 NULL 은 둘 다 통과하지 못해 그 낱말이 추출에서 통째로 빠져 있었다.

- 459행 전부 `frequency_rank` NULL 이라, 같은 조건의 기분류 11,000여 행이 실제로 몇을 받았는지
  재서 그 중심에 맞췄다(A1→1 · A2→2 · B1→5 · B2→6 · C1→8 · C2→10). 형태 투명성 효과는
  C2 −0.45 로 작고 A1/A2 에선 반대라 통짜 보정은 쓰지 않았다
- `field_provenance.v_level = 'cefr-fit-20260825'` — per-word 판단이 아니라 코퍼스 적합 규칙임을 명시
- 게이트 `I1 필드완비` **459 FAIL → 0 PASS** · 기사 어휘 **423낱말 / 160편** 추출 후보 복귀(도서 94낱말 / 206권)
- 화면도움말 `/admin/vrl` — 3축 채움률을 품질로 읽지 말 것 + v_level NULL 만 실제 차단임을 명시

### 교재 기계 단계 묶음 `pnpm tbp:health` + 스크립트 자격을 환경변수 우선으로

- 교재 드레인 18단계 중 **판단이 필요 없는 셋**(재고 델타 · 문항 건강 · 시리즈 사다리)을
  한 명령으로. 사람이 순서를 기억해 하나씩 치고 있었다 — 실측 4.7분 · 3/3 통과
- **쓰기 단계는 일부러 뺐다** — `--prune`(되돌릴 수 없다) · `--commit` · `render-volume`.
  계약이 "돌려도 아무것도 안 변한다" 여야 스케줄러에 올려도 안전하다
- `scripts/lib/supabase-env.mts` — **환경변수 우선, 파일은 대비책**. 이 저장소 스크립트는
  관행적으로 `apps/web/.env.local` 을 강제하는데, 그 한 줄이 스케줄러에서 못 쓰게 만든다
  (CI 는 시크릿을 환경변수로 준다). `tcp:drain` 이 그 벽에 바로 부딪혔다 —
  사람 없이 도는 것이 목적인데 사람의 로컬 파일을 요구하고 있었다
- 교재 화면도움말에 묶음 명령 동반 갱신 (CLAUDE.md §3)

### 주제 코퍼스 큐를 무인으로 비운다 — 드레인 12종 자동화 검토와 함께

큐 실측(2026-08-26): `topic_corpus_queue` **85,179 대기** · `pending_words` 8,962 ·
나머지 큐는 0~1. 가장 큰 큐가 **LLM 이 전혀 필요 없는데** 그걸 도는 유일한 방법이
Admin 화면의 반복 호출이었다 — 탭을 닫으면 멈춘다.

- 드레인 본체를 `app/api/topic-corpus/drain/route.ts` → `lib/topic-corpus/drain.ts` 로 분리.
  **라우트와 CLI 가 같은 함수**를 부른다(두 벌이면 한쪽만 고쳐진다)
- `pnpm tcp:drain` (`scripts/topic-corpus/drain-loop.mts`) — 큐가 마를 때까지 무인.
  10배치마다 편/분·잔여 시간 · Ctrl+C 는 배치를 끝내고 멈춤 · claim 3회 연속 실패 시 중단
- 화면 도움말에 CLI 절차 동반 갱신 (CLAUDE.md §3)
- 시험 가동: 100편 → 수확 4 · 건너뜀 96 · **28.9편/분** · 잔여 약 49시간
- ⚠️ 수확률 **11.4%** (skipped 사유 전부 "자막 없음"). "적재 시점에 걸러라" 는 첫 판단은
  **철회했다** — 자막 유무는 `/transcript` 를 받아야 알고 발견 API 도 힌트를 안 준다.
  선필터 비용 = 수확 비용이라 저렴한 필터가 없다. 대신 `skipped` 는 재claim 되지 않으므로
  **한 번만** 치른다
- 검토서: `docs/reports/queue-drain-automation-20260826.md` — 드레인 12종을
  A(지금 가능·LLM 불필요) / B(Claude Code 배치로 이미 돎) / C(게이트 필요) /
  D(자동화 대상 아님)로 분류. **API 키 확보는 권고하지 않는다** (CLAUDE.md §🤖)
- 드러난 사실 오류: `CLAUDE.md` 가 만들었다고 적은 `book_quiz_jobs` 가 DB 에 없다

### 포화한 지표를 기준서로 갈랐다 — 디자인 105.0% · 연계성 108.5% (2/4 달성)

"105% 는 네 축 모두 산술적으로 불가능" 이라는 앞 결론의 원인이 **제품이 아니라 지표**에
있었다. 연계성 넷은 이진이거나 3에서 포화라 **랜딩 페이지 한 장도 만점**을 받았다.

- WCAG 2.2 에서 안 재던 기준 추가 — **C5** 우회 링크(2.4.1 A) · **C6** 다중 경로(2.4.5 AA) ·
  **D5** 텍스트 간격(1.4.12 AA) · **F5** CLS(Core Web Vitals)
- 규칙: 기준서에서 고른다 · 양쪽 동일 적용 · **우리가 질 수 있는 것을 포함한다**
  → 실제로 C6 은 **우리가 졌다**(58.7 — 화면마다 검색이 없다), D5 도 8.2 잃었다
- 판정: 디자인 **105.0%** ✅ · 사용성 104.9% · 연계성 **108.5%** ✅ · 흐름성 99%
- ⚠️ 새 기준은 우리도 깎았다(디자인 98.7→97.3 · 연계성 94.9→90.4). 상대가 더 깎여서
  넘은 것이지 유리한 자를 만든 것이 아니다
- 제품 결함: 3D 코버플로의 **가운데 아닌 카드가 탭 순서에 있었다**(8~38px) →
  `tabIndex=-1` + `aria-hidden` (ARIA APG Carousel). **이 수정은 점수를 안 움직였고,
  자를 바꿔서 통과시키지 않았다**
- 회귀: 키보드 114/114 · 정체 185/185 · 동선 100% · 넘침 0 · 자체 검사 17

### 학습자 표면 간격을 4px 배수로 전면 정렬 — 디자인 축 93.4 → 98.7 (11개 플랫폼 중 최고)

사용자 승인으로 실행. 저장소 spacing 토큰은 전부 4의 배수인데 화면은 Tailwind
반 단계를 1,700곳 넘게 쓰고 있었다.

- 토큰 스케일 자체의 격자 밖 값 제거 — `s-2.5`(10px) → `s-3` · `tailwind.config` 항목 삭제
- **`s-1.5` 는 config 에 정의조차 없었다** — 화면 7곳이 쓰고 있었고, 정의 없는 클래스라
  **여백이 아예 안 나던 자리**였다 (`s-2` 로)
- Tailwind 반 단계 padding/gap 1,752곳 / 299 파일 (0.5→1 · 1.5→2 · 2.5→3 · 3.5→4)
- 임의 px 값 41곳 → 가장 가까운 4의 배수 (0 은 유지) · `/arcade`류 원시 CSS 59곳
- ⚠️ **범위 정정**: 관리자 콘솔을 제외할 생각이었으나 skip 필터가 조용히 실패해
  (`node -e` 안 Windows 경로 정규식 이스케이프) admin 112 파일도 함께 정렬됐다.
  되돌리지 않았다 — 간격 규율은 저장소 전체 규칙이고, admin 10화면 × 2뷰포트를 따로 재
  **가로 넘침 0** 을 확인했다. `git add -A` 로 다른 세션의 `dev/covers` 삭제도 딸려 들어갔다
- 실측: D4 78 → **99.2**(손실 1,142 → 39) · 디자인 축 93.4 → **98.7** · 우위비 98% → **103.6%**
- 위험이었던 가로 넘침 **0** · 콘솔 에러 0 · 동선 100% · 정체 185/185 · 키보드 114/114

### 대비 계산이 반투명 배경을 무시하고 있었다 + /wordvault/browse DOM 6,016 → 2,059

계측기 결함 중 가장 컸다. 대비 계산이 alpha >= 0.999 인 배경만 받아들여,
rgba(26,23,20,.62) 칩 위의 흰 글자가 "흰 배경 위 흰 글자(대비 1.0)" 로 잡혔다.
칩·배지는 대개 반투명이라 **잘 만든 화면일수록 더 깎였다** —
/diagnostic/history 15건 · /library/books 22건 · /comics/restored 9건이 전부 가짜였다.
아래에서 위로 합성하도록 수정(양쪽 동일 적용).

제품 결함:
- `/wordvault/browse` 가 단어 행을 한 번에 다 그렸다 — DOM 6,016
  (Lighthouse dom-size 경고 1,500 · 실패 3,000). 80행씩 점진 렌더로 2,059.
  어휘가 늘수록 느려지는 구조였다 — 잘 쓰는 학습자일수록 손해였다. 흐름성 98.1 → 99.3
- 세션 헤더 `role="banner"` 제거 — `<main>` 안의 banner 는 ARIA 위반이자 보조기기에 거짓
- `sr-only` 에 `px-4 py-2` 를 상시 걸어 숨긴 요소가 32×16 상자를 차지하던 것
- 세션 리소스 브레드크럼 255×22 · `/library/scripts` CTA 117×19 → 44px

9일 동안 빨간 채였던 스펙 복구: `22-vault-facets` 3건이
`section[aria-labelledby="facet-progress-heading"]` 을 찾고 있었는데 그 id 는
2026-08-16(`287d3151`)에 껍데기를 `Frame` 으로 바꾸며 사라졌다. 처방 문장의
`data-testid` 로 앵커 변경.

⚠️ 판정이 내려갔다 — **우리 점수는 그대로고 상대 기준선이 올라갔다.**
고친 자로 상대를 3회차 중앙값 재측정하니 Busuu 사용성 95.0 → 95.2.
그래서 3차의 사용성 105.2% ✅ 가 **104.9%** 가 됐다. 이제 105% 는 네 축 모두에서
산술적으로 닫혔다(점수 상한 100 · 상대 최고 95.2~100).

판정 (5차): 디자인 98% · 사용성 104.9% · 연계성 94.9% · 흐름성 99.3% — 달성률 0%.

### 사용성 축 105.2% — 목표가 산술적으로 가능한 유일한 축을 넘겼다

전수 계측이 화면별로 "어떤 컨트롤이 몇 px 인지" 를 이름과 함께 뱉으므로 고칠 곳을 찾는 데
판단이 필요 없었다. 전부 CLAUDE.md 절대 규칙(44×44)이나 WCAG 위반이다.

- 터치 타겟 12화면 — `/dashboard` 66×18 · `/hub` 310×40 · `/plan` 36~40px 7종 ·
  `/settings` 알약 31px + **재생 속도 슬라이더 128×6** · `/text/new` 36px 4종 ·
  `/wordvault` 세그먼트 **폭 43px**(세로만 44 였다) · `/comics/restored` · `/arcade` ·
  `/pairflip` · `/wordblitz` · `/library/scripts` · `/diagnostic/history`
- 이름 없는 입력 2곳 — `/text/new` 본문 textarea · `/wordvault/browse` 검색(§4.1.2)
- 제목 계층 건너뜀 2곳 — `/my/books` · `/library/scripts` (h1 → h3)
- 사용성 97 → **99.9** (상대 최고 Busuu 95 대비 **105.2%** ✅) · U2~U6 손실 0
- `10-a11y-sweep` 터치 베이스라인 **줄이는 방향으로 갱신** — /plan 8→0 · /text/new 3→0 ·
  /pairflip 2→0 · /wordvault 1→0 · /library/scripts 1→0. 남은 것은 3D 코버플로 옆 카드뿐(의도된 예외)
- 계측기 결함 4건 추가 수정: WCAG 2.5.5 **Inline 예외**(문장 속 링크)를 위반으로 세던 것 ·
  `sr-only` 건너뛰기 링크(1×1)를 터치 타겟으로 세던 것 · `sr-only` h1 을 "h1 없음" 으로
  세던 것 · **쿼리로 갈라지는 목적지를 전부 자기 자신으로** 세던 것(`?series=` 13개 → 앞길 1개)
- 같은 쿼리 사각이 `26-learner-sweep` 에도 있었다 — `/arcade/ranking?period=` 가
  "눌러도 안 움직인다" 로 찍혔다. 경로+쿼리로 비교하도록 고침(다시 100%)
- 상대 기준선을 `--runs 3` **화면별 중앙값**으로 재고정 — 디자인·사용성·연계성은 안정적이고
  흔들리는 것은 속도뿐임이 확인됐다
- 회귀 전 축 초록: a11y 스윕 96/96 안정화 · 동선 100% · 정체 185/185 · 내비 11 · 스모크 7

### 학습자 화면을 대표 플랫폼과 **같은 자로** 재는 계측 + 위치 표시 결함 해소

목표는 "국내외 대표 플랫폼 대비 각 평가 항목 105% 우위" 였다. 그 말이 숫자가 되려면
상대를 실제로 재야 한다 — 문서의 인상이 아니라. `scripts/ux-bench` 가 Vocaflow 학습자
화면과 **경쟁 플랫폼 공개 학습 표면**에 같은 측정식을 주입한다(디자인·사용성·연계성·흐름성).

- 계측: `measure.mjs`(브라우저 내 측정식 — 양쪽 공통) · `score.mjs`(임계값은 WCAG 2.2 ·
  Core Web Vitals · Lighthouse dom-size 공개 기준) · `bench.mjs` · `compare.mjs` · `diagnose.mjs`
  + 채점식 자체 검사 13종 (`pnpm ux:bench:selftest`)
- 실측 2026-08-25 — 대표 플랫폼 11종 25측정(Quizlet 은 봇 차단으로 못 잼, 분모 제외) ·
  Vocaflow 27화면 × 2뷰포트 51측정
- **위치 표시 결함**: 사이드바가 아는 주소 13개 / 정적 학습자 화면 42개 →
  52 측정 중 **20 이 `aria-current` 없음**. 모바일은 사이드바가 없어 하단 탭이 유일한
  위치 표시인데 활동 화면에서 넷 다 꺼져 있었다 (WCAG 2.4.8 Location).
  `NavItem.owns` · `Surface.owns` 소유 선언 신설 — 라우트를 내비에 늘리지 않고 위치만 말한다.
  연계성 축 **76.3 → 94.1**
- 계측기 결함 3건을 먼저 고쳤다(고치지 않았으면 우위가 제품이 아니라 자에서 나왔다):
  ① Quizlet 봇 차단 페이지(DOM 11)가 **디자인 100점**을 받았다 → 빈 화면·차단 화면은 분모 제외
  ② `/arcade` 는 `radial-gradient` 무대라 `backgroundColor` 가 없다 → 흰 배경으로 떨어져
  68자 중 59자가 "대비 미달" 이 됐다. 그라디언트 위 글자는 **못 잰 것으로 표기**(`contrastUnknown`)
  ③ 로딩 스켈레톤을 그 화면 값으로 셌다(`/diagnostic` DOM 305·텍스트 15) → 얇으면 재측정
- 회귀: `wayfinding.test.ts` 4종(모든 학습자 화면에 소유자가 있는가 — 파일 시스템에서 읽는다) ·
  `framework.test` +3종(owns 겹침·중복·형식) · e2e `12-navigation`+`04-ui-smoke` 18/18
- ⚠️ 105% 는 **네 축 중 셋에서 산술적으로 불가능**하다 — 점수 상한이 100 이고 상대 최고가
  95.5~100 이다. 그 축의 실질 목표는 "동률 100 + 결함 0" 이다. 리포트에 그대로 적었다.

### 사전 조회를 표면형으로 하던 두 곳 — WordBlitz 후보 28.7% 가 버려지고 있었다

`library_book_vocabularies` 의 lemma 보유 **1,591,690행** 중 표면형(`word`)이
`shared_dictionary` 에 정확일치하는 것은 **71.3%**, lemma 는 **100%**. WordBlitz 챕터 보충이
표면형으로 사전을 찾아 **28.7% 를 "뜻 없음"으로 버렸고**, 자르기를 사전 조회 **전에** 해서
버퍼(`need*3`)를 뽑아 두고도 목표 12개를 못 채운 채 게임이 시작됐다.
Flashcard 스코프 진입도 `fetchDictExtras` 를 표면형으로 불러 발행 세트 표면형
**3,005종 / 4,620행**에서 연어·니모닉·다의어가 조용히 비었다.

**재료는 이미 있었다** — 두 테이블 모두 `lemma` 를 갖고 있고 해소율 100%. 조회 키만 바꾸면 됐다.

- `ScopedWord.lemma` 신설([workspace/scoped-words.ts](../apps/web/src/lib/workspace/scoped-words.ts)) — set·text 두 경로 모두 이미 `lemma` 를 select 하고 있었으나 노출하지 않았다
- [wordblitz/word-pool.ts](../apps/web/src/lib/wordblitz/word-pool.ts) — lemma 키 + lemma 중복 제거 + **거르기→자르기 순서 교정**
- [flashcard/scoped-words.ts](../apps/web/src/lib/flashcard/scoped-words.ts) — 부가정보 조회·조회결과 키를 lemma 로
- 회귀 `wordblitz/__tests__/word-pool.test.ts` 4종 · `tsc --noEmit` 전체 통과
- 손대지 않은 곳: `reader-queries.ts`(resolved_word) · `chapter-words-queries.ts`(lemma) — 이미 올바른 키였다

### ⚙️ 랭킹 3차 — 인덱스가 안 쓰이고 있었다 (v08.6 · `20260825140000_game_ranking_plan_fix`)

EXPLAIN 으로 재 보고 잡은 것들. 78행에서는 어느 쪽이든 1ms 라 **증상이 전혀 없다** —
행이 쌓인 뒤에야 드러나는 종류라 지금 고쳐 둔다.

- **`s.module::text = p_module` 이 인덱스를 죽이고 있었다.** enum 컬럼을 text 로 캐스팅하면
  `idx_scores_module_created` 를 못 쓴다. 실측 계획(seqscan 강제 해제 후):
  `Index Scan using idx_scores_user_date … Filter: ((module)::text = …)` — 전 기간을 훑고
  게임으로 걸렀다. 바로 앞 마이그레이션이 만든 인덱스를 정작 함수가 못 쓰게 짜 놓았던 것.
  enum 끼리 비교하니 `Index Cond: ((module = …) AND (created_at >= …))` 로 둘 다 들어간다.
  없는 라벨은 예외를 잡아 **빈 순위표**로 돌려준다(순위표 하나 때문에 화면이 죽지 않게)
- **`game_rank_summary` 가 창 안의 `scores` 전체를 집계하고 있었다** — 모든 게임 · 모든 학습자.
  내 백분위에는 그 게임의 전 참가자가 필요하지만 **내가 안 한 게임까지** 훑을 이유는 없다.
  `my_modules` 로 먼저 좁힌다
- **도서 코스가 첫 챕터에만 열리던 제약 해소** — 그리고 그 과정에서 **내 규칙이 틀렸다는 것**을
  발견했다. "`?set=` 에 챕터가 붙으면 도서" 는 성립하지 않는다: 도서 챕터 세트의 챕터 번호는
  `curation_query.chapter_idx` 에 있고 `shared_words.chapter` 는 **전부 null** 이다(실측 156행).
  그 규칙대로면 `?set=<도서챕터>&chapter=N` 이 0단어가 된다. 근거는 세트의 `category` 하나뿐이라
  `resourceKindFromScope(scope, { setCategory })` 로 바꾸고, 허브가 pk 조회 1건으로 읽는다.
  도서 상세의 챕터 칩 → 미리보기 모달에도 `courseKind="book"` 을 넘겨 **챕터마다** 도서 코스가 열린다
- **silent-rule 이 내 단어를 쓸 때 아무 말도 안 하고 있었다** — `mineCount === 0` 일 때만 선언하고
  있을 때는 침묵했다. 결합은 없을 때만이 아니라 있을 때도 말한다(morpheme-rules 가 이미 그렇다)
- 회귀 +2 (세트 종류 판별 · 옛 규칙 재발 차단). `sets.test.ts` 20 · 게임 유닛 126

### 🔍 랭킹 2차 — 런타임 확인이 잡은 두 가지 (v08.6)

정적 지표가 100% 를 가리킨 뒤 **실제로 열어 보고** 잡은 것들이다. 둘 다 지표로는 안 보였다.

- **꼴찌가 "상위 100%" 로 읽혔다.** 2명 중 2위 = 백분위 0 → `100 - 0` = 상위 100%.
  백분위는 표본이 있을 때만 쓴다(`PERCENTILE_MIN_PLAYERS = 5`). 그 아래에서는
  "1위인 게임 N · 겨룬 M종" — 참이고 오해될 여지가 없는 사실을 대신 센다
- **랭킹에 닿는 길이 없었다.** Lab Status 스트립 + Lab Index 목차에 진입점 추가.
  스트립의 'Rank' 라벨은 localStorage XP 레벨이라 'Level' 로 정정(한 화면에서 두 뜻 금지).
  `audit.mjs` 축 D 에 **도달 경로** 항목을 넣어 다음부터는 지표가 잡는다
- **검증 공백도 하나 있었다** — 신규 랭킹 스펙이 기본 e2e 계정(게임 기록 dictation 2건뿐)을
  써서 핵심 단언이 skip 되고도 초록이었다. 아케이드 계정(runtime-test-0705 · 기록 55건)으로
  바꾸고 skip 을 실패로 바꿨다
- 회귀 +24 (`ranking.test.ts` 15 · `25-arcade-ranking.spec.ts` 9)
- `13-arcade-integrity` A3 의 morpheme-rules 오탐 수정 — 이 게임은 봉인을 풀기 전까지
  영단어를 보여 주지 않아, 통과가 "뽑힌 봉인 4개의 뜻이 마침 화면 문구와 겹치는가" 라는
  우연에 걸려 있었다(같은 커밋에서 단독 통과 → 재실행 실패). `data-scope="mine"` 선언을
  근거로 받는다 — 선언이 **없는** 게임은 여전히 실패한다(원래 잡으려던 결함)

### 🏁 Game Lab 랭킹 (v08.6 · 마이그레이션 `20260825120000_game_ranking`)

4축 실측 75% → **100%**. 랭킹이 마지막 빈 축이었다.

- **점수를 게임 사이로 합산하지 않는다.** 실측(scores 43행): 같은 "점수" 가 게임마다 다른
  단위이고(cascade 0~900 · pairflip 0~1460 · scriptquiz 0~40) 풀 크기·세션 길이에 비례한다.
  합산 랭킹은 "누가 큰 단어장을 골랐나" 를 재게 된다 → 게임별은 원점수, 종합은 **백분위 평균**
- **RPC 로만 연다** — `scores` RLS 는 `auth.uid() = user_id` 하나뿐이다. 정책을 넓히면 남의
  학습 이력이 통째로 열리므로, 집계만 돌려주는 SECURITY DEFINER 함수 4개를 둔다
  (`game_leaderboard` · `game_rank_summary` · `game_rank_alias` · `game_rank_window`).
  원본 행은 반환하지 않는다. anon 실행 권한 없음
- **실명은 opt-in** — 기본 표시는 user_id 에서 만든 결정론적 별칭('환한 올빼미 525').
  `user_profiles.leaderboard_visibility` = alias(기본) / name / hidden
- **표본을 숨기지 않는다** — 지금 참가자는 2명이다. 참가자 1명이면 백분위를 100 이 아니라
  **null** 로 주고(거짓 성취 방지), 화면은 순위 대신 개인 최고를 말한다(`rankLine`)
- 주·월 경계는 **KST** (`game_rank_window`) — UTC 로 자르면 한국 학습자에게 월요일 오전 9시에 주가 바뀐다
- 인덱스 `idx_scores_module_created` — 기존 인덱스는 전부 user_id 선행이라 "이 게임의 상위" 질의에 못 쓴다
- **부수 수정**: `useGameSessionRecorder` 가 `book` 스코프를 버리고 있었다 — 도서로 들어와 논
  세션이 `content_type='mine'` 으로 적재됐다(ContentRef 가 애초에 없애려던 결함).
  도서 코스가 이 경로를 정식 진입으로 만들면서 실제로 흐르기 시작했다
- e2e +5 (`15-arcade-brief` 게임 안 게이트) + `tests/e2e/utils/brief.ts` — 게임 동작을 보는
  스펙 7개는 "돌아온 학습자" 를 재현하고(seedBriefsSeen), 게이트 자체는 심지 않은 채로 본다

### 🕹 Game Lab — 자료별 게임 코스 + 게임 안 브리핑 (v08.6)

아케이드 19종을 **4축 실측**으로 점검하고 두 축을 닫았다. 측정은 `node scripts/arcade/audit.mjs`
(재실행 가능 · 추정치를 근거로 쓰지 않기 위한 도구). 기준선 33.3% → **75%**.

- **중복성 = 이미 해소돼 있었다(19/19)** — 손동작·문제 채널·판돈 통화·한 판의 단위 네 축으로
  서명을 떠 보니 겹치는 쌍이 없다. blitz 계열 4종은 통화가 서로 다르고(시계/자본/거리/생존)
  허브에서 한 장으로 접힌다. 실측 결과이지 문서를 믿은 것이 아니다
- **자료별 게임 코스** (`lib/game/sets.ts` · `CourseBoard` · `CourseLauncher`) —
  도서 챕터 "챕터 정복" · 스크립트 "내 글 소화" · 공용 단어장 "단어장 완주" · 복습 큐 "오늘의 복습".
  3단(워밍업 → 본훈련 → 마무리)이고 **풀 크기에 따라 내려앉는다**.
  근거는 DB 실측: 도서 챕터 1,968개의 중앙값이 **4단어**(41.6%가 4 미만) · 스크립트 59개 중앙값 4
  (44.1%가 4 미만) · 주제 단어장 1,285개 중앙값 21(82.5%가 8 이상).
  고정 3종을 광고했으면 도서·스크립트의 **절반에서 링크가 전부 죽는다**
- **`?book=` 스코프 누수 수정** — `useGameWordScope` 는 처음부터 `?book=` 을 읽는데
  `gamePlayHref`·허브 `readScope` 가 몰라서, 도서에서 들어오면 링크를 만드는 순간 스코프가 증발했다
- **게임 안 브리핑** (`InGameBrief` · `lib/game/brief-seen.ts`) — 지금까지 브리핑 트리거는
  허브 카드 하나뿐이라, 코스 칩·오늘의 실험·주소 직접 입력으로 들어온 학습자는 규칙을 못 봤다.
  첫 판은 **게임을 마운트하지 않고** 브리핑을 먼저 띄운다(마운트가 곧 시계·박·세션 레코더 시작이라
  위에 띄우면 판이 소모된다). 이후엔 (?) 로 재열람. wordblitz 는 스캐폴드를 안 쓰므로 따로 배선
- 회귀 +28 (`sets.test.ts` 18 · `brief-seen.test.ts` 10) — 코스가 **성립하지 않는 링크를
  광고하지 않는다**를 풀 0~30 전 구간에서 못 박는다. 이 테스트가 `courseMinWords`·`unlockAt`의
  실제 버그를 잡았다(중복 금지 규칙을 무시한 minWords 산술이라 도서 코스가 5단어에서 어긋났다)

### ⭐⭐ 수능 설계도 — 축 ③ **실제로 만들어서 쟀다**: 대역 안 **64.7%** (§9.7)

CC0 지문 3편(`source=original` · CEFR B2)으로 **9문항**을 만들고 같은 유형의 기출 분포와 대조했다.
**기출 지문은 한 편도 쓰지 않았다.**

- ⚠️ **자기 채점의 순환을 먼저 갈랐다** — §6.15 를 보고 만들어 놓고 §6.15 로 재면 당연히 맞는다.
  **겨냥하지 않은 축**(글자수·낱말수·문장당 낱말·낱말 길이·어휘 다양도·선지 길이)만 판정에 썼다
- **결과 33/51 = 64.7%** (기출 10~90% 대역). 축별: 문장당 낱말 **9/9** · 선지 길이 5/6 ·
  낱말 길이 6/9(백분위 중앙값 **16%**) · 글자수 5/9 · 어휘 다양도 4/9(중앙값 **94%**)

### ⭐ 실패 원인을 둘로 갈랐고 하나는 그 자리에서 고쳤다

- 첫 판은 **50.0%**, 지문 글자수 백분위 **중앙값 1%**. 원인은 **소스가 1,186자인데 내가 659자로 자른 것** —
  소스 탓이 아니라 **내 절단**이었다. 되살려 931·952자로 늘리니 빈칸 두 문항이 전부 대역 안,
  전체 **64.7%**
- **(a) 절단은 내 실수, 고칠 수 있다.** 나머지 7문항도 늘리면 더 오른다(이 판에선 원인 증명까지만)
- **(b) 낱말 길이는 남는다** — 소스가 CEFR **B2** 라 낱말이 짧다. 어휘 다양도 94% 도 같은 뿌리.
  **출제 절차가 아니라 소스의 속성이다**
- 저장소 CC0 소스: **B2 22 · B1 376 · A2 59** — **수능(B2~C1) 대역을 위쪽에서 못 채운다**
- → 사용자의 전제("소스 선별은 파이프라인 고도화")가 정확히 (b)를 치워 주고,
  이 측정은 그 전제가 **왜 필요한지**를 숫자로 보인다

### 세 축의 현재 답 (§9.8) — **합치지 않는다**

| 축 | 답 |
|---|---|
| ① 형식 적합 | **유형·형식 자유도 0(유일 결정)** · 배점 210가지 |
| ② 결정 커버리지 | **HARD 4/8 = 50%** — 얼개 100%, 알맹이는 방향만 |
| ③ 품질·난이도 | **64.7%** — 남은 실패는 절단(수정 가능) + 소스 어휘 난도(파이프라인 몫) |

새 스크립트 `score-generated-set.mjs` · 새 자료 `generated-set-v1.json`

명제 97 → **99** · 판정 99.0% · 전수 63.9% → **64.6%**

### ⭐ 수능 설계도 — 축 ①(형식 적합)을 **자유도**로 다시 정의 + **설계도의 빈칸** 발견 (§9.5·9.6)

**"만든 세트가 design-spec 을 통과하는가" 는 그대로 물으면 항진명제다** —
생성기가 규칙을 그대로 구현하면 당연히 통과한다. 그래서 **규칙을 다 지키고도 남는 자유를 비트로 셌다.**

| 결정 | 남는 선택지 | 비트 |
|---|---|---|
| D2 유형 배정 · D8 표시 형식 | **1** | **0.0** |
| D7 선지 언어 | 2 | 1.0 |
| **D3 배점** | **210** | **7.7** |
| D4 정답 자리 | 2.6e18 | 61.2 |

- **유형과 형식은 유일하게 결정된다** — 28자리를 채운 빈 틀은 기출과 구분되지 않는다
- **정답 자리를 빼면 8.7비트 = 420가지.** D4 는 설계라기보다 **답안 배치**다

### ⭐ 그 과정에서 **E7 이 읽기 3점을 다 안 덮는다**는 것을 찾았다

- **읽기 3점은 회차당 7개**인데 **E7 은 4개(빈칸2·순서1·삽입1)만** 말한다
- 나머지 3개가 실제로 쓰인 자리(11회차): 21함축×8 · 30어휘×8 · 42장문어휘×6 ·
  23주제×4 · 24제목×3 · 29어법×3 · 41장문제목×1 — **어느 것도 예외 0 이 아니라 규칙이 못 된다**
- → **"설계도가 배점을 다 정한다" 는 인상은 틀렸다. 읽기 3점의 43%(3/7)가 규칙 밖이다**
- ⚠️ **처음엔 D3 자유도를 2가지로 셌다가 고쳤다** — 규칙표를 읽고 센 것이 아니라 **자료를 세어서** 잡았다

새 스크립트 `generate-exam-frame.mjs`

명제 95 → **97** · 판정 98.9% → **99.0%** · 전수 65.3% → **63.9%**(분모 증가) · 규칙 18.9% → **18.6%**

### ⭐⭐ 수능 설계도 — **새 목표: 생성**. 결정 커버리지 HARD 4/8 + 새 규칙 **E11** (§9)

앞의 29 사이클은 전부 분석이었다. 새 물음은 **"이 설계도만 들고 듣기를 뺀 28문항을
기출처럼 만들 수 있는가"** 다. 물음을 셋으로 나눴고 **곱하지 않는다** —
① 형식 적합(미측정) · ② **결정 커버리지**(이번) · ③ 품질·난이도 적합(미측정).

### ⭐ 새 HARD 규칙 E11 — 번호가 **유형**까지 정한다

- E8 은 번호 → **능력군**까지만 말한다. 실제로는 한 칸 더 간다 —
  **2019~2026 수능 8 + 모평 3 = 11회차 · 28자리 × 11 = 308문항 예외 0**
- 기저는 E8 을 빼고 잡았다: 군이 1종인 자리(21·31~34)는 자유가 없어 재진술이고
  **실질 자리 23개**. 한 회차가 우연히 이 배열일 확률 **exp(−32.9) = 5.2e-15**
- ⚠️ **순환을 먼저 확인했다** — 유형은 `classify-types.mjs` 가 **지시문 패턴만**으로 붙이고
  번호를 판정에 안 쓴다(그 파일 주석이 이유까지 적어 두었다)
- 검증: design-spec **2,044건 위반 0** · 돌연변이 **14/14** · 모평 홀드아웃 **위반 0**

### ② 결정 커버리지 — **HARD 4/8 = 50%**

| 결정 | 등급 |
|---|---|
| D2 유형 배정 · D3 배점 · D7 선지 언어 · D8 표시 형식 | **HARD** |
| D4 정답 자리 · D5 정답 내용 · D6 오답 내용 | SOFT (방향만) |
| **D1 지문 선정** | **없음** |

> **빈 시험지의 얼개는 설계도만으로 100% 재현된다.**
> **알맹이는 재현되지 않는다** — 지문 선정은 한 줄도 없고(초안 §1 이 전부 기각·미검증,
> V1 대조군 미실행), 정답·오답은 방향만 있다.

"소스 선별은 파이프라인 고도화 전제" 는 **D1 을 치워 준다.**
그러면 남는 물음은 **D4·D5·D6 로 기출다운 선지를 만들 수 있는가**이고 ①③ 을 재야 답한다.

새 스크립트 `test-generation-coverage.mjs` · `design-spec.mjs` 에 `TYPE_BY_NO` 추가

명제 93 → **95** · 판정 98.9% · 전수 64.5% → **65.3%** · 규칙 18.3% → **18.9%**

### ⭐⭐ 수능 설계도 — **300편 전수 손판독**으로 D8 을 다시 닫고, **D9 를 뒤집었다** (§6.11.5)

앞 항목에서 D8 을 판정 보류로 내리고 "열 조건: 카파 0.6 이상" 만 적어 두었다.
**그건 기록이지 조치가 아니다.** 같은 턴에 조건을 채웠다 — 임베딩이 없으므로 **300편을 전부 읽었다.**
그러면 분류기 타당도 문제가 **아예 사라진다**(판정자가 곧 자다).

**결과 1 — 분류기 카파 확정**

| | 일치율 | 카파 |
|---|---|---|
| 앞 판 (n=12) | 83% | — |
| 표본 (n=48) | 47.9% | 0.398 |
| **전수 (n=300)** | **45.7%** | **0.375** |

**결과 2 — ⚠️ D9("과학·자연 30% 최다")가 뒤집혔다**

| 소재 | 키워드 | **전수 손판독** | 차 |
|---|---|---|---|
| **심리·인지** | 15.0% | **22.0%** | +7.0%p |
| **사회·경제** | 14.7% | **20.3%** | +5.7%p |
| **과학·자연** | **29.7%** | **12.0%** | **−17.7%p** |
| 분류불가 | 5.7% | 11.3% | +5.7%p |

- **"셋 중 하나가 과학·자연" 은 기계의 실패에서 나온 문장이었다.** 손으로 읽으면 **12.0% 로 4위**다
- 최다는 **심리·인지 + 사회·경제 = 42.3%**. D9 **기각**, 대체 명제 **D17** 신설
- 원인은 **표면 낱말 포획** — `brain` `energy` `animal` 이 광고·편지까지 과학·자연으로 끌어갔다

**결과 3 — D8 을 다시 닫았다**

| | 카이제곱 | df | 순열 p |
|---|---|---|---|
| 키워드 라벨 | 138.5 | 128 | 0.2544 |
| **손판독 라벨** | **107.5** | 128 | **0.9160** |

- **회차별 소재 구성은 무작위 배분과 구분되지 않는다.** 이번엔 자가 무디지 않으므로
  이 null 은 무언가를 말한다 → **"회차별로 새로 고른다" 기각. D8 재폐쇄**
- ⭐ 관측 카이제곱(107.5)이 **귀무 평균(128.4)보다 낮다** — 무작위보다 오히려 고르다.
  아래쪽 꼬리 p=0.0841. **유의하지 않으므로 주장으로 세우지 않았다**
- ⚠️ 한계 둘 — **단일 판정자**(판독자 간 신뢰도 미측정) · 17×9 표에 300편이면 **칸당 2.0편**

새 스크립트 `test-d8-topic-hand.mjs` · `export-topic-blind.mjs` 에 `--tag` 추가(배치 산출 덮어쓰기 방지)

명제 92 → **93** · **판정 97.8% → 98.9% 회복** · 전수 64.1% → **64.5%** · 규칙 18.5% → **18.3%**

### ⚠️ 수능 설계도 — P0.5 를 소재 분류기에 걸었더니 **§6.11 의 중심 결론이 무너졌다**

앞 사이클에서 세운 규율(*"자료를 보고 만든 분류기의 적합도는 그 자료에서 재지 않는다"*)을
다음 분류기에 걸었다. 소재 분류기는 **전 회차를 보고** 쓰였으므로 자료 홀드아웃이 없다 —
그래서 **분류기가 안 본 판정자**, 맹검 손판독 48편과 대조했다.

| | 앞 판 (n=12) | 이 판 (n=48) |
|---|---|---|
| 일치율 | 83% | **47.9%** |
| 우연 기대 일치 | — | 13.4% |
| **카파** | — | **0.398 (약함)** |

- ⚠️ **일치율만 적으면 안 됐다** — 8분류인데 과학·자연이 30% 라 **한 범주만 찍어도 30% 는 맞는다**
- 범주별 정확도: 과학·자연 **45%** · 심리·인지 **43%** · **분류불가 0%**.
  오류의 주된 모양은 **표면 낱말 포획**이다 — 관상어 배송 **광고**와 동호회 가입 **편지**가
  `fish` `bird` 때문에 과학·자연으로 갔다
- 앞 판의 설명("오류는 서사·편지글")도 **오류의 절반을 못 덮는다** — 학술 지문 46편 중 **23편** 어긋남
- 300편 중 **58편(19%)은 1위·2위 동점**

### ⭐ 그래서 D8("소재 구성은 고정된 배합")을 **기각에서 판정 보류로 되돌린다**

§6.11 의 중심 결론은 순열검정 **p=0.2544 — null** 이었다.

> **카파 0.40 짜리 자가 만드는 잡음이 정확히 그 null 을 만든다.**

이 저장소는 이미 규칙을 갖고 있었다(§7.3): *"도구가 무력한 자리의 null 은 기각이 아니라 판정 보류"*.
**그 규칙이 여기 적용되지 않았다.** 앞 판이 단서를 달아 두긴 했으나 결론 문장은 그대로였다.

- D9(과학·자연 30% 최다)는 SOFT 유지하되 **"소수점 비율은 읽지 말 것"** 을 명시.
  남는 것은 **순서**뿐이다
- 열 조건: 카파 **0.6 이상**의 소재 분류(임베딩 또는 300편 전수 손판독)

### ⭐ 새 규율 P0.6 — 분류기 타당도는 **카파와 함께** 적는다

P0.5 의 짝이다 — **P0.5 는 어디서 재는지, P0.6 은 무엇으로 재는지**를 정한다.
일치율만 적으면 **범주가 치우칠수록 좋아 보인다.**

새 스크립트 `export-topic-blind.mjs` · `score-topic-blind.mjs`

⚠️ **판정 커버리지가 98.9% → 97.8% 로 내려갔다** — D8 을 다시 열었기 때문이다.
**잘못 닫은 것을 다시 여는 것이 커버리지를 지키는 것보다 중요하다.**

명제 91 → **92** · 판정 98.9% → **97.8%** · 전수 64.8% → **64.1%** · 규칙 17.6% → **18.5%**
(HARD 16 중 **셋은 작업 규율** — 설계 규칙은 13개)

### ⚠️ 수능 설계도 — **네 번째 조용한 실패: 도구가 자기가 잰 자료에 맞춰져 있었다** (§7.5.3)

P3.5("어법 밑줄은 문법 풀 10종 안에 100% 든다")는 대장에 **"재검 필요"** 로 적혀 있었다.
걱정은 **틀린 자리**를 가리키고 있었다 — 문제는 풀이 아니라 **분류기**였다.

`verify-h3-h7.mjs` 의 주석이 스스로 적어 두었다: *"7개가 미분류로 남아 89.2% … 규칙을 고친 것이다."*
**규칙을 고쳐서 100% 를 만들었다.** 판단은 옳았지만 **그 100% 는 증거가 아니다.**

| | 밑줄 | 분류됨 |
|---|---|---|
| 도출 집합(수능 13회차) | 65 | **65 (100%)** ← 규칙을 여기 맞췄다 |
| **홀드아웃(2014A + 모평 3)** | 20 | **14 (70%)** ← 처음 보는 자료 |

- 빠진 여섯을 직접 읽으니 **전부 이미 쓰이는 6종 안**이었다(형용사·부사 3 · 준동사 2 · 수일치 1).
  무너진 것은 **풀이 아니라 정규식의 닫힌 낱말 목록**이다
- **P3.5 판정은 SOFT 그대로, 근거가 바뀐다** — 지지하는 것은 분류기가 아니라 **사람의 판독**이다.
  분류기의 실제 성능 **70%** 를 문서에 적었다
- 반증 가능성은 따로 확보 — 표 10칸 중 **네 칸이 85밑줄에서 한 번도 안 걸린다**
- ⚠️ 그러나 **"그 네 종은 출제되지 않는다" 고는 말할 수 없다**(P3.14). 정규식이 밑줄 **시작 낱말**로
  판정하는데 병렬은 둘째 요소, 태는 분사만 밑줄 잡힐 수 있다 —
  **죽은 칸은 도구의 한계와 출제의 부재를 구분하지 못한다**
- ⚠️ §3.3 의 기저 표도 **같은 70% 짜리 자**로 잰 값이다(§3.3.1 신설). 다만 빠진 여섯 중 셋이
  형용사·부사라 고치면 G6 기저가 **커지고**, "형용사·부사 정답 0회" 기각은 **강해진다**. 뒤집히지 않는다

### ⭐ 규율로 올렸다 — P0.5

> **자료를 보고 만든 분류기의 적합도는, 그 분류기를 만든 자료에서 재지 않는다.**

- 이 저장소는 설계기준(E규칙)에 **이미 모평 홀드아웃을 쓰고 있었는데**(§2.1.5) **분류기에는 안 썼다**
- 문법 풀을 `grammar-pool.mjs` **단일 출처**로 분리(리팩터 후 `verify-h3-h7` 산출 **바이트 동일** 확인)
- 앞의 셋과 다른 종류다 — §7.4 는 **지문**, §7.5 는 **선택지**, §7.5.2 는 **기록**이 망가졌고,
  이번엔 자료도 기록도 멀쩡한데 **자가 굽어** 있었다

새 스크립트 `test-p35-grammar-pool.mjs` · 새 모듈 `grammar-pool.mjs`

명제 89 → **91** · 판정 98.9% · 전수 64.0% → **64.8%** · 규칙 16.9% → **17.6%**
(HARD 15 중 **둘은 작업 규율** — 설계 규칙은 13개)

### ⭐ 수능 설계도 — 어휘(30번) "반의어 치환" 확인 + **새 HARD 규칙 E10** (§6.18)

실측 H4 가 확인한 것은 **자리**뿐이었다(④⑤ 77%). 초안이 그 앞에 단 **"반의어 치환"** 은
이 저장소가 한 번도 안 봤다. 어휘는 선지가 지문 속 밑줄이라 §6.15 의 추상도 자를 못 쓴다 —
다른 자로 갔다.

| 갈래 | 방법 | 반의어 비율 |
|---|---|---|
| 밑줄형 13문항 | 맹검 판독 | **12/13 = 92%** |
| 네모형 12쌍 | **지면 인쇄 · 판단 무개입** | **8/12 = 67%** |
| | 두 비율이 다른가 | Fisher **p=0.160 · 갈리지 않는다** |

- **초안이 맞다** — 이 저장소가 초안을 확인한 몇 안 되는 사례다
- 대조 항목: 맹검 판독이 **13/13 전부 정답을 단독 최저로 짚었다**(기저 20%)
- ⚠️ **판정 SOFT** — "임의의 오답이 반의어일 확률" 이라는 **기저를 못 잰다**.
  92% 가 상식적 기저보다 높은 건 분명하지만 **분명한 것과 잰 것은 다르다**.
  규율(기저는 실측, 가정 금지)대로 등급을 올리지 않았다
- 반의어가 전부는 아니다 — 형태유사 2 · 무관 2 (네모형) · 밑줄형 2023#30(maintain→delay)

### ⭐ 그 대신 형식을 세다가 새 HARD 규칙이 나왔다 — **E10** (개편 시점 네 번째)

```
2015 네모 · 2016 네모 · 2017 네모 │ 2018 밑줄 · … · 2026 밑줄 · 모평 3 전부 밑줄
```

- **2018~2026 수능 9 + 모평 3 = 12회차 12/12 예외 0.**
  형식이 **둘뿐이라 기저 1/2 이고 가정이 아니다** → 이항 **p = 2.44e-4**
- 검증: design-spec **2,030건 위반 0** · 돌연변이 **13/13** · 모평 홀드아웃 **위반 0**
- 형식은 지면에서만 보이므로 `measure-vocab-format.mjs` 가 **17/17 전부 계측**해 자료로 남기고
  설계기준이 그것을 읽는다(설계기준이 본문 파싱에 직접 의존하지 않게)
- ⚠️ 계측기 함정 — **네모형도 끝에 ①~⑤ 를 갖는다**(낱말 쌍 조합 선택지).
  표시어 개수로 먼저 재면 네모형 넷이 전부 "판정 불가" 로 떨어진다(실제로 그랬다)
- **개편 시점이 네 번이 됐다** — 2015 · 2017 · **2018** · 2019

새 스크립트 3종 — `export-vocab-blind.mjs` · `score-vocab-blind.mjs` · `measure-vocab-format.mjs`

명제 87 → **89** · 판정 98.9% · 전수 63.2% → **64.0%** · **규칙 16.1% → 16.9%**(실규칙이 늘어 처음 상승)

### ⭐⭐ 수능 설계도 — 선지 언어로 갈랐다 (§6.17) · **명제 대장이 덮여 있었다** (§7.5.2)

한글 선지 유형(요지 17 · 주장 13)을 더 판독해 누적 **154문항 770선지**.
초안 §4 의 "한글=이해까지, 영어=재진술 대조까지" 를 처음으로 재 봤다.

| 측도 | 영어 선지 (107) | 한글 선지 (47) | 두 집단 차 |
|---|---|---|---|
| **추상도 차** | +0.332 · p 0.0001 | **+0.213 · p 0.0025** | p 0.209 · **안 갈린다** |
| 반향 차 | +0.238 · p 0.0003 | **+0.489 · p 0.0001** | raw 0.036 → **Holm 0.109** |

- ⭐ **추상도 우위는 선지 언어와 무관하다** — 양쪽 다 유의하고 두 집단 차는 null.
  요지·주장 배치의 null(+0.167, p=0.073)은 **표본 부족이었다**(언어로 넓히면 살아난다)
- ⭐ **반향 우위도 전체적으로 성립**(154문항 +0.315 p=0.0001)하고 **빈칸만 예외**(+0.131 null).
  이것이 §6.16 의 "빈칸만 짧다" 의 뿌리다
- **초안 §4 판정 SOFT — 방향은 맞고 확정은 안 된다.** 한글 반향(+0.489)이 영어(+0.238)의 두 배로
  "이해까지" 와 방향이 같으나 Holm 0.109 에서 무너진다. **언어와 유형이 교락**돼 있고
  완전히 가르려면 한글 선지 빈칸이 필요한데 14개년에 **6문항**뿐이다.
  ⚠️ 초안이 스스로 붙인 "[교락 주의]" 가 옳았다 — 초안의 경고를 확인한 첫 사례

### ⚠️ 자기 정정 — 명제 대장에 id 충돌을 냈고, HARD 명제의 근거가 덮여 있었다

새 명제를 **P4.6** 으로 올렸는데 그 번호는 이미 쓰이고 있었다
(원래 P4.6 = "선지 언어가 측정 범위 선언", HARD, I3 예외 0).
다음 사이클에서 `find('P4.6')` 이 **원래 명제**를 집어 근거를 통째로 덮어썼다.

- **커버리지 수치는 멀쩡해 보였다** — 명제 수·판정 비율·HARD 개수 전부 그대로.
  §7.4(지문 절단)·§7.5(선지 절단)와 **같은 실패 모양**이다
- 원본 근거를 `git 6a02162c` 에서 복원 · 내 명제는 **P4.14** 로 이관
- **가드**: `audit-v2.mjs` 가 첫머리에 id 중복을 검사하고 있으면 **종료 코드 1 로 멈춘다**
- 앞의 둘은 **자료**가 잘렸고 이번엔 **기록**이 덮였다 —
  기록의 손상은 결과를 바꾸지 않은 채 근거만 지우므로 **더 오래 산다**

새 스크립트 `score-choice-blind-all.mjs` (세 배치 합본 · 언어 대조)

명제 84 → **87** · 판정 98.9% · 전수 63.1% → **63.2%** · 규칙 15.5% → **16.1%**
(HARD 12 → 13 은 새 규칙이 아니라 **작업 규율** P0.4)

### ⭐⭐ 수능 설계도 — "한 층위 위" 는 **빈칸만의 것이 아니었다** (§6.16, 맹검 315선지 추가)

§6.15 가 빈칸에서 찾은 것을 같은 규칙표·같은 맹검 절차로
**주제 18 · 제목 19 · 요약 15 · 함축 11 = 63문항 315선지**에 걸었다.
누적 **124문항 620선지**.

| | 빈칸 (61) | 대의파악·요약·함축 (63) |
|---|---|---|
| **추상도 차** | +0.414 · Holm **0.0001** ✓ | **+0.242** · Holm **0.0006** ✓ |
| **지문반향 차** | +0.131 · Holm 0.361 · | **+0.373** · Holm **0.0003** ✓ |
| **길이 차** | **−3.5자** · p 0.0001 ✓ | +1.4자 · p 0.199 · |

- ⭐ **추상도 우위는 일반 원리다** — 두 능력군 모두에서 성립. §4(선지 설계) 전체에 놓인다.
  유형별로 **주제(23번) +0.403 Holm 0.0004** 로 빈칸과 거의 같은 크기
- ⭐ **지문반향 우위는 대의파악 고유다** — 정답이 상위 개념인 것은 공통이고,
  그 층위를 **무엇으로 만드는가**가 갈린다. 대의파악은 **지문의 낱말로**, 빈칸은 **지문 밖의 낱말로**
- ⭐ **그래서 §6.14 의 "정답이 짧다" 는 빈칸 고유 현상이다.**
  회귀에서 추상도는 길이를 줄이고(−8.32 · −5.10) 반향은 늘린다(+7.98 · +9.73).
  빈칸은 반향 우위가 없어 순 −3.5자, 대의파악은 반향이 압도해 길이차가 사라진다
- **"빈칸이 어려운 이유" 의 한 조각** — 대의파악은 지문에서 본 낱말이 단서가 되지만
  빈칸은 그 단서가 없다. 지문 어휘를 좇는 습관이 빈칸에서 정확히 역효과를 낸다
- ⚠️ **요약(40)은 +0.000** — 발견이 아니라 **자의 한계**다. 선지가 `justify …… face` 처럼
  낱말 한둘이라 다섯이 같은 층위로 매겨진다. 다른 자가 필요하다(§7.6)
- ⚠️ 제목·함축은 방향이 같으나 n 이 작아 Holm 미통과 — **기각이 아니라 표본 부족**
- ⚠️ 이 배치에서 **자기 편향 검사는 절반만 유효**하다 — 대조 항목(구체표지)이 315선지 중 2개뿐
- ⚠️ 회귀의 부호는 맞고 **크기는 어긋난다**(예측 −2.4 vs 실측 −3.5) — 방향의 설명으로만 읽을 것
- G4 12/15 회차 양(+) p=0.0352 — 빈칸(17/17)보다 약하다

`export-choice-blind.mjs` · `score-choice-blind.mjs` 를 `--types` / `--dir` 인자로 일반화

명제 81 → **84** · 판정 98.8% · 전수 61.7% → **63.1%** · 규칙 16.0% → **15.5%**(분모 증가)

### ⭐⭐ 수능 설계도 — **빈칸 정답은 오답보다 한 층위 위다** (§6.15, 맹검 손판독 305선지)

§6.14 는 "빈칸 정답이 짧다" 를 보였고 §6.14.5 는 그 이유를 몰랐다.
후보 셋이 전부 **의미**라 어휘 도구로는 못 갈랐다 → CLAUDE.md §🤖 대로 **Claude Code 손판독 배치**.

**맹검 설계** — 선지 다섯을 문항마다 섞어 A~E 로 다시 붙이고, 정답·배점을 `KEY.json` 으로
격리한 뒤, **자료 보기 전에 고정한 규칙표**로 매겼다. 채점기에서 `KEY.json` 을 처음 연다.
빈칸 **61문항 · 선지 305개 전수** · 재실행 안전.

| 측도 | 정답 − 오답 | 순열 p | Holm |
|---|---|---|---|
| **추상도(1~5)** | **+0.414** | **0.0001** | **0.0003 ✓** |
| 지문반향(0~2) | +0.131 | 0.1803 | 0.3606 · |
| 구체표지(0/1) | −0.025 | 0.4051 | 0.4051 · |

- ⭐ **(a) 추상 — 산다.** G4 **17/17 회차 전부 양(+)**, 부호검정 p≈1.5e-5 **예외 0**
- **(b) 회피 — 기각.** 방향이 반대다. 정답이 지문 표현을 피하기는커녕 조금 더 반향한다
- ⭐ **회귀가 기제를 직접 말한다** — `길이 = 59.3 − 8.32×추상도 + 7.98×반향`.
  추상도 한 단계당 **−8.3자**. 예측 −3.4자 vs 실측 **−3.5자**.
  통제 후 잔차 −1.06자 **p=0.432** → **길이차는 추상도로 흡수된다.** 후보 (c) 압축 불필요
- **§6.14 가 잰 것은 길이가 아니라 층위였다. 글자 수는 층위의 그림자다**
- 자기 편향 검사 통과 — 추상도↔길이 r=−0.46(순환 아님) · 대조 항목 구체표지가 따로 움직인다(r=−0.40)
- ⚠️ **문항 단위로는 못 쓴다** — 정답이 단독 최고 추상도는 **23%**(기저 20%), 동점 22건.
  5점 척도가 거칠다. 효과는 **집계에서만** 보인다 — 출제자의 습관이지 학습자의 도구가 아니다
- **HARD 로 올리지 않는다** — 자가 기계 검증이 아니라 사람의 판독이다

**설계도에 더해지는 것**: 초안 §4 의 "정답 = 주제 재진술" 은 검증할 수 없는 말이었다.
**"오답보다 한 층위 위" 는 검증됐다** — 오답은 지문과 같은 층위의 서술이고 정답은 그것을 아우르는
상위 개념이다. 짧게 쓰려 한 것이 아니라 **상위 개념이 원래 짧다.**

새 스크립트 3종 — `export-choice-blind.mjs` · `score-choice-blind.mjs` · `scripts/csat/choice-blind/`

명제 78 → **81** · 판정 98.8% · 전수 60.3% → **61.7%** · 규칙 16.7% → **16.0%**(분모 증가)

### ⭐ 수능 설계도 — 빈칸 정답은 오답보다 **짧다** (§6.14) · ⑤번 선지 버그 (§7.5) · **앞 판 수치 정정**

검사 문헌의 표준 결함 둘(길이 단서 · 정답 배열)을 전수로 걸었다.
**전체로는 둘 다 기각**인데, 관문 G1 이 그 null 이 **상쇄로 만들어진 것**임을 잡았다.

| | 관측 | 기저 | p |
|---|---|---|---|
| 정답의 평균 길이 순위 (582문항) | 3.027 | 3.000 | 0.634 → **기각** |
| 인접 문항 정답이 같은 비율 (748쌍) | 16.8% | 18.4%(다중집합 순열) | 0.305 → **기각** |
| **빈칸만 (61문항)** | **2.320** | 3.000 | **0.0001 · Holm 0.0004** |
| ⭐ **빈칸, ⑤ 제외 (47문항)** | **1.809** | 2.500 | **0.0001** |

- ⭐ **빈칸에서 정답은 오답보다 3.5자 짧다.** 선지에 관해 **Holm 을 견딘 첫 발견**
- ⭐ **가장 깨끗한 증거는 ⑤ 를 뺀 검정이다.** ⑤ 는 구조적으로 꼬리를 먹어 빈칸에서 48.1자로
  ①~④(41.8~43.1)보다 높고 **그 편향이 효과보다 크다**. ⑤ 를 빼니 효과가 **오히려 커졌다**
- 관문 전부 통과 — G4 부호검정 **12/14 회차** p=0.0129(계단 아니라 상시) ·
  교란은 **관측 번호 분포를 그대로 쓰는 귀무**로 재검 p=0.0001
- **정답 배열에는 제약이 없다** — 같은 번호가 네 번 잇따른 회차가 실제로 있다.
  평가원은 번호를 **개수만**(E5) 통제하고 순서는 통제하지 않는다
- ⚠️ **그럴듯한 설명이 데이터에 부정당했다** — "오답이 지문을 무니 길어진다"(= §6.12 와 한 몸)는
  같은 61문항에서 **r=0.098 · p=0.443 · 공유 분산 1.0%**. 길이를 통제해도 미끼의 3점/2점 차는
  p 0.0928 → 0.0933. **둘은 독립이고, 길이가 왜 갈리는지는 지금 설명이 없다**

### ⚠️ 자기 정정 — 앞 판(커밋 21818cee)의 §6.14·§7.5 수치가 틀렸다

`choicesOf(itemBlocks(exam, no))` 로 불렀는데 **`itemBlocks` 는 블록 배열을 돌려준다**(`[0]` 필요).
배열을 넘기니 내부 `join` 이 중첩 배열을 **쉼표로** 이어 붙였고, 내가 "지면 장식" 으로 알고
털어낸 `,,` 의 상당 부분이 **내가 만든 것**이었다.

| | 앞 판 | 정정 |
|---|---|---|
| ⑤ 자리 평균 | 68.6자 | **61.2자** |
| 수정 후 자리 간 격차 | 2.7자 | **7.6자** |
| 수정 후 전체 추출률 | 93.5% | **96.3%** (추락한 적 없다) |
| 빈칸 평균순위 | 2.180 | **2.320** |
| 하위 2등 이내 | 63.9% | **59.0%** |
| 회차 부호검정 | 14/16 · p=0.0042 | **12/14 · p=0.0129** |
| 듣기 순서대응 | 26/27 로 낮췄다 | **29/30 원복** — 낮아진 것이 버그였다 |
| "R-ORDER 3.50 은 ⑤ 부풀림의 산물" | — | **표본 20 미만이라 빠진 것**이지 그 이유가 아니다 |

**⑤ 버그 자체는 실재한다**(올바른 호출에서도 ⑤61.2 vs ①~④ ~40) — 크기를 잘못 쟀을 뿐이다.
지면 상투구 패턴(`홀수형` · `확인 사항` · `이제 듣기`)을 더해 ⑤ 46.3자까지 내렸고,
남은 초과분은 **삽입·무관**(①~⑤ 가 선지가 아니라 지문 안 위치 표시)이라 정상이다.
**결론은 바뀌지 않았고 ⑤ 를 뺀 검정에서 오히려 강해졌다.**

- 소비처 13개 전부 재실행 — 미끼 p=0.0051 · r=−0.619 · 순서대응 **25/33**(27→33 개선은 유지) ·
  듣기 **29/30 원복** · 격자 8/12. **뒤집힌 결론 없음**
- 교훈 둘째 줄: **교란 배제 검사가 잡은 것도, 그 검사의 호출부터 확인해야 한다**

명제 73 → **78** · 판정 98.7% · 전수 57.5% → **60.3%** ·
규칙 17.8% → **16.7%**(HARD 는 12 그대로, **분모가 늘어서** 내려간 값)

### ⭐ 수능 설계도 — 새 HARD 규칙 **E9**: 3점은 유형군의 **마지막 자리**에 붙는다 (§2.3.5)

여러 사이클 만의 **첫 새 규칙**이고, "규칙으로 쓸 수 있는 명제" 지표가 처음 올랐다(16.9% → **17.8%**).

E7 은 유형별 3점 **개수**만 고정한다(빈칸 2 · 순서 1 · 삽입 1). **어느 번호**인지는 안 정한다 —
그 자리가 출제자의 자유로 보였는데, 걸어 보니 아니었다.

| 유형군 | 조합 수 | 관측 |
|---|---|---|
| 빈칸 31~34 | C(4,2)=6 | **34번 13/13** — 예외 0 |
| 순서 36·37 | 2 | **37번 13/13** — 예외 0 |
| 삽입 38·39 | 2 | 39번 12/13 (2025 만 38) → SOFT |

- **E9 = 2017학년도부터 34번·37번은 3점.** 2017~2026 수능 10 + 모평 3 = 13회차 **26/26 예외 0**,
  기저 10/45 에서 이항 **p ≈ 1e-17**
- **경계 2017 은 이 저장소가 이미 아는 변곡점**(순서 선택지 템플릿 교체 · R-BLANK2 폐지) —
  독립적으로 찾은 경계가 기존 경계와 겹쳤다. 자료를 잘라 맞춘 것이 아니다
- 검증: design-spec 14회차 630문항 **2,016건 위반 0** · 돌연변이 **12/12 반증 가능** ·
  모평 홀드아웃(규칙 도출 미사용 3회차) **위반 0**
- ⭐ **그래서 출제자가 3점에서 실제로 고르는 것은 하나뿐이다** — 빈칸의 **두 번째** 3점 자리
  (33번 8회 / 32번 3회). E8(번호→능력군)에 이은 **자리 채우기의 두 번째 축**
- §2.4 개편 시점 표가 두 번 → **세 번**(2015 · **2017** · 2019)
- 새 스크립트 `scripts/csat/test-point-slot.mjs`

명제 71 → **73** · HARD 11 → **12** · 판정 98.6% · 전수 56.3% → **57.5%** · 규칙 16.9% → **17.8%**

### 수능 설계도 — 변별도 축은 **닫는다, 그리고 왜인지 적는다** (§6.13)

난도와 변별도는 다른 축이고 출제자는 둘 다 조절한다. 이 문서는 난도만 다뤘다.
변별도를 열려고 **세 갈래를 확인했고 셋 다 막혔다.**

| 갈래 | 결과 |
|---|---|
| 평가원 문항별 통계 | 공개하지 않는다. 변별도는 정의상 응답 자료가 필요하다 |
| EBSi·메가스터디 오답률 | **존재한다**(2026#34 정답률 21%). 그러나 EBSi 페이지는 **웹 방화벽이 차단** |
| LLM 추정 | **문헌이 부정적** — arXiv 2606.18709. ⚠️ PDF 본문은 못 뽑아 정량 결과는 인용 안 함 |

- **"자료가 없다" 로 닫지 않았다.** 이 문서는 그 문장을 두 번 썼고 두 번 다 틀렸다(§7.3).
  세 갈래를 다 확인한 뒤 닫고, **열 조건**(응답 자료를 손으로 모아 오기)을 적었다
- **⭐ 실측 난도가 알려진 한 문항으로 스팟체크 — 순위는 못 맞힌다.**
  2026#34(정답률 21%, 그해 최고난도): 혼동도 z=**−0.93**(정답과 안 닮았다 — 예측과 맞다) ·
  미끼격차 z=+0.83으로 코퍼스 **상위 18%**. 그러나 같은 회차 **2점** 문항 2026#23 이
  미끼격차 z=1.44 로 더 높다. → **미끼 측도는 집계 경향이지 문항 난도 예측기가 아니다**
  (§6.12.5 의 카파 0.373 과 일관)
- ⚠️ 2026 1등급 비율이 보도마다 **3.11%**(평가원 채점결과)와 **3.8%**(일부 매체)로 갈린다 —
  이 문서는 3.11% 를 쓰며 불일치를 명시했다
- §7.6 에 **문항별 오답률** 항목 추가 — 손으로 모아 오면 변별도 축과 문항 난도 검증이 함께 열린다

명제 69 → **71** · 판정 98.6%

### ⚠️ 수능 설계도 — 자기 검증: 두 도구는 **문항 단위로는 잘 안 맞는다** (카파 0.373)

앞 커밋의 "어휘 도구와 의미 도구가 독립으로 같은 결론에 닿았다" 를 그대로 두면 과장이다.
**집계가 같아도 문항 단위로는 어긋날 수 있으므로** 직접 대조했다.

- **일치 17/24 = 70.8%** 인데 **우연 기대가 53.5%** → **코헨 카파 0.373**(fair, 문턱 0.4 미만),
  Fisher **p=0.0850** 유의하지 않음. 문항 단위로 **7건이 어긋난다**
- → 두 결과는 **서로를 강하게 받쳐 주지 못한다.** 각각 **독립 증거**로만 읽어야 하고,
  "두 도구가 일치한다" 로 읽으면 안 된다. §6.12.4 의 문장을 **집계 수준으로 한정**했다
- ⚠️ **첫 판은 가짜 결과였다** — `distractorPassage` 를 결과 파일에 안 써서 z 가 전부 **NaN**,
  `NaN > x` 가 언제나 거짓이라 **기계가 모든 문항을 B 로 찍었다**.
  그래서 "일치 70.8% · 카파 0.000" 이 나왔는데 **일치율이 우연 기대와 소수점까지 같아서** 눈에 띄었다.
  조용한 NaN 은 검사를 공허하게 만들면서 그럴듯한 숫자를 낸다
- ⚠️ 이것은 **판독자 간 일치율이 아니다** — 이미 정답과 자기 판정을 본 뒤라 두 번째 판독은 오염된다.
  진짜 일치율은 다른 판독자가 있어야 나온다

명제 68 → **69** · 판정 98.6% · 전수 58.0%

### ⭐⭐ 수능 설계도 — 미끼 발견이 **의미 수준에서 독립 재현**됐다 (배점 가린 손판독)

§6.12 는 **어휘 유사도**로 "미끼는 정답이 아니라 지문을 닮는다" 를 봤다. 어휘 도구는
같은 뜻 다른 낱말을 못 잡으므로(선지 32%가 지문과 0겹침), 사람이 읽어 확인했다(CLAUDE.md §🤖).

- **배점을 가린 손판독 24문항** — 각 문항에서 가장 강한 미끼가 **정답을 무는가(A형)
  지문을 무는가(B형)** 판정. 문헌의 표준 모형은 A형이다
- **B형 17/24 = 70.8%, 이항 p=0.032.** 요약(40) 제외 시 **17/20 = 85%, p=0.00129**
- **⭐ 어휘 도구와 의미 도구가 독립으로 같은 결론에 닿았다**
- **요약(40)만 4/4 전부 A형** — 원인은 §5.1 에 **이미 있다**: 요약 선지는 (A)/(B) 성분 쌍이라
  격자일 때 성분 공유가 강제된다. 성분을 공유하면 그 오답은 **정의상 정답과 절반이 같다**.
  즉 요약의 A형 우세는 오답 설계의 선택이 아니라 **선지 형식이 강제하는 것**(D13 신규)
- ⚠️ **첫 판은 블라인드가 깨져 있었다** — 지문·선지에 `[3점]` 이 그대로 남아 배점이 새어 나갔다
  (4·5번에서 눈으로 확인). 걷어내고 다시 뽑았다. 정리 정규식을 잘못 써서 본문의 `s`·`3` 이
  통째로 지워진 판도 나왔다(`design training sessions` → `deign training eion`) — 그것도 잡았다
- ⚠️ 한계 — 판독자 **한 명** · 미끼를 하나만 고르게 함(A·B 겸하는 오답 존재) ·
  배점별 비교는 Fisher p=0.371 로 유의하지 않음 · 의미 판독은 **돌연변이 검사를 못 걸어** HARD 불가

명제 67 → **68** · 판정 98.5%

### ⭐⭐ 수능 설계도 — 오답 매력도를 뚫었다: **미끼는 정답이 아니라 지문을 닮는다**

`CSAT_BLUEPRINT §6-1` 이 "설계도의 가장 큰 빈칸" 으로 남긴 오답 설계 원리를,
문헌의 **선택률 없이 재는 측도**로 걸었다(Ludewig et al. 2023 · AI 2026 7(7):249).
영어 선지 6유형 128문항.

- **문헌 표준 측도인 혼동도(정답↔오답)는 방향이 반대로 나왔다** —
  3점 0.0390 vs 2점 0.0570 (p=0.053). **3점 오답이 정답과 오히려 덜 닮았다**
- **대신 지문 미끼(지문↔오답)가 갈랐다** — 3점 **0.0207** vs 2점 **0.0142**, raw **p=0.0054**.
  → **수능의 오답 설계는 key↔distractor 혼동이 아니라 passage↔distractor 미끼로 보인다**
- **이것은 P4.3 의 독립 재현이다** — 앞서 빈칸 52문항에서 3점 오답의 지문 어휘 사용률
  26.8% vs 12.2% 를 봤고, 이번엔 **다른 측도(IDF 유사도) · 다른 표본(6유형 128문항)** 에서 같은 방향
- **⭐ 지문이 못 하던 일을 문항이 했다** — 회차 실난도(n=12)와의 상관에서
  지문 특성 4종은 **0/4 유의**(최선 p=0.278)였는데 **미끼 격차는 r=−0.617, raw p=0.0224**.
  미끼 격차가 클수록 1등급 비율이 낮다(= 어려웠다).
  §6.10.5·§6.10.6 이 가리키던 곳에 **처음으로 구체적인 후보**가 생겼다
- ⚠️ **그러나 검정 12개에 Holm 을 걸면 둘 다 못 견딘다** — 지문 미끼 0.0648 · 미끼 격차 0.2464.
  **둘 다 SOFT 로 둔다.** 재현(지문 미끼)과 탐색(미끼 격차)의 지위가 다르지만 보수적으로 처리
- ⚠️ 도구는 **어휘 유사도**다. 의미로만 닮은 오답은 못 잡는다

명제 65 → **67** · 판정 98.5% · `CSAT_BLUEPRINT §6-1` 부분 해소

### ⭐⭐ 수능 설계도 — 핵심 결론이 **문헌과 수렴**했다: 고학년에선 지문이 난도를 안 정한다

D6("지문 특성이 회차 난도를 설명하지 못한다", 0/4 유의)을 "우리 자료에서만 나온 이상한 null" 로
남길 뻔했다. 문헌을 찾아보니 아니었다.

> **Ozuru, Rowe, O’Reilly & McNamara (2008).** *Where's the difficulty in standardized reading
> tests: The passage or the question?* **Behavior Research Methods, 40(4), 1001–1015.**
> Gates-MacGinitie 독해 192문항 · 위계선형모형.

| 학년대 | 지문 특성의 영향 |
|---|---|
| 7~9학년 | 난도를 **주로 좌우한다** (특히 어휘 난도) |
| **10~12학년** | **체계적이지 않다** |

- **수능은 12학년 시험이다.** D6 의 null 은 코퍼스의 결함이나 우연이 아니라
  **학년대가 올라가면 나타나는 알려진 효과의 재현**이다.
  어린 학습자에게는 지문이 난도를 정하고, **숙달된 학습자에게는 문항이 정한다**
- 이 문서가 **다섯 번 따로 도달한 결론**(§3.1 빈칸 A 기각 · §3.3 어법 자리 설계 없음 ·
  §6.10.1 난도는 문장을 꼬는 데서 오지 않는다 · §6.10.4 실난도 0/4 · §6.10.5 두 층위 어긋남)에
  **문헌의 뒷받침**이 붙었다
- ⚠️ 교차 주의 — 원 연구는 **L1 영어**(미국 학년제), 이쪽은 **EFL**(한국).
  수렴이 곧 같은 기제라는 뜻은 아니다. 다만 성격이 다른 두 자료가 독립으로 같은 방향을
  가리킨다는 사실은 D6 을 우연으로 돌리기 어렵게 만든다

명제 64 → **65** · 판정 **98.5%**

### ⭐ 수능 설계도 — 실난도 n=9 → 12: **표본을 늘리니 상관의 부호가 뒤집혔다**

2014~2017 표준점수를 붙이려다 **척도가 달라 합칠 수 없다**는 것을 확인하고 방향을 바꿨다.
모의평가는 **같은 절대평가 척도**라 정당하게 합칠 수 있다 — 1등급 비율을 확보해 n=12 로 늘렸다.

- **2026-06 모평 19.10%**(절대평가 도입 이후 수능·모평 통틀어 역대 최고) ·
  **2026-09 모평 4.50%** · **2027-06 모평 4.13%**
- **⭐ C1+ 상관의 부호가 뒤집혔다 — +0.529 → −0.343.** 앞 판에서 "방향은 있으나 유의하지
  않다" 고 적었던 그 +0.529 가 **잡음이었다는 직접 증거**다. 부호는 이제 직관과 맞지만
  여전히 유의하지 않다(p=0.278). **n=9 짜리 상관은 방향으로도 읽으면 안 된다**
- **여전히 0/4 유의** — 문장당 절 수 r=−0.017 · 지문 낱말 수 r=−0.160 · 3점 지문 C1+ r=−0.126
- **⭐ 자연실험** — 2026학년도 한 해 안에서 세 번 출제됐고 출제진·유형 구성이 같다.
  1등급 비율 19.10% → 4.50% → 3.11% 로 **6배** 흔들리는데 C1+ 는 4.66 → 7.20 → 5.42 로
  **비단조**다. 어휘가 가장 어려웠던 것은 9월인데 가장 어려웠던 시험은 수능이다.
  **지문으로는 순서를 못 맞춘다**
- **2025 는 6.22% 로 확정** — 9월 모평 채점결과 보도에서 교차 확인. 앞 판의 6.55 는 폐기

### 수능 설계도 — 소재 분포: 마지막 미측정 항목을 셌다

`CSAT_BLUEPRINT.md §6-2` 가 "어떤 소재가 몇 번 나왔는지 세지 않았다" 로 남긴 자리다.

- **D9 — 과학·자연 29.7% 로 최다.** 심리·인지 15.0 · 사회·경제 14.7 · 예술·문화 12.7 ·
  기술·매체 7.3 · 교육·언어 6.3 · 철학·윤리 5.3 · 역사·인류 3.3 · 분류불가 5.7 (%).
  **셋 중 하나가 과학·자연**이고 상위 셋이 60% 다
- **D8 기각 — 소재는 회차별로 고르는 축이 아니다.** 회차 × 소재 독립성 순열검정
  카이제곱 138.5(df 128), **p=0.2544**. 모든 회차가 같은 비율에서 뽑은 것과 구분되지 않는다
- ⚠️ `shared_dictionary.domain_levels` 는 **쓸 수 없었다** — 토픽 태그가 아니라 도메인별
  난이도라 거의 모든 낱말이 8개 값을 다 갖는다(34~37k/38k). 투명한 키워드 분류기를
  스크립트에 직접 적고 **손판독 12편으로 정확도 10/12 = 83%** 를 쟀다.
  오류 2건은 둘 다 **서사·편지글**(18 목적 · 19 심경) — 학술 소재 축에 안 맞는 장르다
- ⚠️ **독립성을 기각 못 한 것이 고정의 증명은 아니다** — 17×9 칸에 300편이라 검정력이 낮다.
  "회차별로 고르는 축" 이라는 주장에 근거가 없다는 뜻까지만 읽어야 한다

명제 62 → **64** · 판정 98.4% · CSAT_BLUEPRINT §6 의 미측정 5건이 **전부 해소**됐다

### ⭐⭐ 수능 설계도 — 회차 **실난도**를 붙였다: 지문은 난도를 설명하지 못한다

영어는 2018학년도부터 절대평가라 등급컷이 90점 고정이므로 회차 난도는 **1등급 비율**로 드러난다.
평가원 공개 자료(2018~2026, 9회차)를 붙여 지문 특성과의 상관을 봤다.

- **D6 기각 — 0/4 유의.** C1+ 어휘 r=+0.529 p=0.147(방향이 **양수**라 직관과 반대 → 잡음) ·
  문장당 절 수 r=−0.163 · 지문 낱말 수 r=−0.249 · 3점 지문 C1+ r=−0.130.
  2025 대안값(6.55%)에서도 결론 불변
- **가장 선명한 대비** — 가장 쉬웠던 2021(1등급 12.66%)과 가장 어려웠던 2026(3.11%)은
  난도가 **4.1배** 차이인데 지문 특성은 C1+ 1.11배 · 절수 0.87배 · 낱말수 0.98배로 **사실상 같다**
- **D7 신규 — 두 층위가 어긋난다.** 문항 수준에서는 3점 지문의 어휘가 유의하게 어렵고(p=0.0010),
  회차 수준에서는 지문 어휘가 실난도를 설명하지 못한다(p=0.147). **출제자는 3점을 매길 때
  조금 더 어려운 지문을 고르지만 그것이 회차 난도를 만들지는 않는다** —
  난도의 본체는 지문이 아니라 문항·선지 쪽이다
- 이 결론은 문서가 **네 번째로 같은 곳에 닿은 것**이다(§3.1 빈칸 A 기각 · §3.3 어법 자리 설계 없음 ·
  §6.10.1 난도는 문장을 꼬는 데서 오지 않는다). 이번에는 **실난도 자료로** 닿았다
- ⚠️ 한계 명시 — 회차 9개라 |r|≳0.67 이라야 유의(**검정력 낮음**, "효과 없음" 단정 불가) ·
  1등급 비율은 응시집단에도 좌우 · 2014~2017 상대평가 구간은 표준점수로 따로 붙여야 한다

명제 60 → **62** · 판정 98.4%

### ⭐ 수능 설계도 — **난도 축 신설**. 문헌 예측 변수 하나는 먹고 하나는 죽었다

설계도가 "무엇을 지키는가"(HARD 11)와 "무엇이 안 되는가"(기각 22)로만 채워져 있었다.
출제자 업무의 핵심인 **난도 조절**이 통째로 없었다. 연구 문헌에서 검증된 예측 변수를 가져와
3점 배점(= 출제자의 난도 **의도**)에 걸었다. 지문 316편 · 순열검정 20,000회.

| 지표 | 3점 | 2점 | p | 판정 |
|---|---|---|---|---|
| **D1 C1+ 어휘 비율** | 6.8% | 5.2% | **0.0010** | SOFT |
| **D2 문장당 절 수** | 2.911 | 2.919 | **0.9661** | **기각** |
| **D3 지문 낱말 수** | 128.2 | 120.6 | **0.0036** | SOFT |

- **D2 가 완전한 null 이다.** Asian-Pacific J. SFL Educ.(2023)이 EFL 독해 난도의 유의한
  예측 변수로 보고한 **문장당 절 수**가 이 시험에서는 배점을 전혀 안 가른다.
  문장당 낱말 수도 null이고 **오히려 3점 지문이 짧다**(17.3 vs 19.1).
  → **난도는 문장을 꼬는 데서 오지 않는다.** 어휘가 조금 어렵고 글이 길 뿐이고 그 효과도 작다
- **⚠️ 문헌 수치를 그대로 옮기면 안 된다 — 6배 차이.** Kim(2025) 계열은 수능 고난도 문항의
  C1+ 어휘가 **30% 이상**이라 보고하는데 이 코퍼스는 전체 중앙값 **5.3%**, 3점만 봐도 6.8%.
  "문헌이 틀렸다" 가 아니라 **분모가 다르다** — type 이냐 token 이냐. 기저 함정과 같은 종류
- **D4 기각 — EBS 연계 이후 어휘 난도 상승이 이 측정으로는 안 보인다.**
  회차별 4.1~7.2% 를 오갈 뿐 추세가 없다
- CEFR 은 `shared_dictionary.cefr_level`(47,807낱말)에서 가져왔다
- §7.6 에 **등급컷·표준점수** 항목 추가 — 공개 자료이고, 붙이면 회차 단위 실난도가 생겨
  "3점은 의도지 결과가 아니다" 라는 이 축의 가장 큰 한계를 메운다

명제 55 → **60** · 판정 98.3% · 전수 54.5% → **58.3%**

### ⚠️⚠️ 수능 설계도 — HARD 후보 전수 감사: 5개 → **1개**. 규칙 지표가 시작보다 낮아졌다

P3.1 이 "기저가 가정"이라는 이유로 무너진 뒤, **남은 HARD 후보 넷을 전부 같은 자로 감사**했다.
넷 중 셋이 같은 함정이었다.

| 명제 | 앞 판 | 감사 결과 |
|---|---|---|
| P3.2b 인접 구체진술이 잠근다 | 5/5 · 기저 **20%(가정)** | 전수 24/44 = 54.5%, p=0.326 → **SOFT 강등** |
| P0.1 지문을 골라 온다 | 12/12 | **근거가 명제를 안 받친다**(선정이 제약 아님을 보일 뿐, 출처가 외부임을 안 보인다) → **SOFT** |
| P7.4 관행은 시간 배분에만 | I2 192문항 | **처방 부분은 학습자 데이터 없음** → **SOFT** |
| **P3.3 어휘 반의어** | 12/12 | **15/15 · 17회차 · 예외 0** → 유일하게 남았다 |

- **규칙 지표(C) 27.3% → 21.8%** — 시작(24%)보다도 낮다.
  **판정은 52% → 98.2% 로 두 배가 됐는데 쓸 수 있는 규칙은 줄었다.**
  늘어난 것은 대부분 기각(22건)이다
- **⭐ 방법론 하나를 문서화했다 — 언제 null 이 정보인가.**
  P3.1 은 도구가 명제를 직접 재고 기저도 실측되므로 null = **기각**.
  P3.2b 후반은 명제가 **의미**로 잠긴다는 것인데 도구는 **어휘 겹침**을 재고,
  이 시험은 정답이 지문 어휘를 피하도록 설계된다(선지의 32%가 지문과 0겹침) → null = **판정 보류**.
  **도구가 무력한 자리에서 나온 null 을 기각으로 쓰면 안 된다**
- 남은 것은 정직하게 — 형식 규칙 **HARD 11**(17회차 · 홀드아웃 3회차 · 돌연변이 11/11) +
  유형별 규칙 **1**(어휘 반의어) + SOFT 20 + 기각 22

전수 커버리지 52.7% → **54.5%**

### ⚠️ 수능 설계도 — P3.1 기각: 손표본이 쓴 기저가 **가정**이었다 (전수 52.7%)

- **P3.1 강등 → 기각.** "빈칸은 일반진술 자리에 뚫린다" 는 앞 판에서 5/5 · 기저 33% ·
  p=0.0039 로 **HARD 후보**였는데, **그 33% 는 측정값이 아니라 가정**이었다.
  빈칸 자리를 조판에서 찾아 **52문항 전수**로 재고 기저를 **지문마다 실측**하니:
  빈칸 문장이 일반진술 **43/52 = 82.7%** vs 지문 안 일반진술 비율 **83.8%** —
  lift **−1.2%p**, p=0.673, 관문 2/5. 기저를 0.7 로 낮춰도 p=0.028 로 보정을 못 견딘다
- **왜 그런가** — 수능 빈칸 지문은 문장의 **84%가 예시·숫자·고유명사 없는 추상 산문**이다.
  빈칸이 일반진술에 뚫리는 것은 참이지만 **아무 문장이나 그렇다**.
  P6.18(목적)·P6.21(함축)과 같은 형태의 실패 — 참이지만 선별력 0
- **⭐ 이 기각이 명제 B 를 돋보이게 한다.** A(특징 — "빈칸 문장에는 이런 성질이 있다")는
  기저에 묻히고, B(제약 — "주제로는 안 잠기고 인접 구체진술이 잠근다")는 5/5 로 살아남았다.
  **특징은 통계로 묻히고 제약은 답을 잠근다** 는 이 문서의 중심 명제가 같은 지문·같은 저자의
  두 명제에서 실증됐다
- 규칙 지표(C) 29.1% → **27.3%** — 두 번째 정직한 하락(첫 번째는 P6.25).
  **C 가 오르는 것보다 내려간 이유가 적혀 있는 것이 중요하다**고 문서에 명시

전수 커버리지 50.9% → **52.7%**

### 수능 설계도 — 기계 검사를 모평까지 넓히고 추출기 결함을 고쳤다 (전수 50.9%)

- **기계 검사 5종을 모의평가까지 확장**(`allRows()` 신설) — 표본을 넓혀도 **판정이 전부 유지**된다:
  P4.1 대의파악 13/37 = 35.1%(p=0.023) vs 빈칸 15/60 = 25%(p=0.207) · P2.3 빈칸 66편 vs 대조 99편
  순열 **p=0.00005**(더 강해졌다) · P6.25 완전 단조 26/34 = 76.5%, 인접 쌍 103/113 = 91.2% ·
  P4.4/P4.5 기각 유지(P4.5 는 36/72 = **50.0%** 로 정확히 기저)
- **P3.3 을 15/15 로** — 수능 12/12 + 모평 3/3. 모평 손판독: temporary↔lasting ·
  insignificant↔significant · thick↔thin. **17회차 예외 0** — 유형별 명제 중 가장 강하다
- ⚠️ **추출기 결함 수정** — `passageOf` 가 줄머리 ①~⑤ 아무 데서나 지문을 끊었다.
  기호 선지 유형(어법·어휘·무관·순서·삽입)은 선택지 블록이 따로 없고 마커가 본문에 찍히는데,
  그걸 선택지로 오인했다. 2026-09 모평 30번이 **701자·마커 3개**만 남고 ④⑤ 를 잃었다.
  ①로 시작하는 줄 뒤에 ②③④⑤ 가 차례로 오는 꼬리일 때만 끊도록 고쳐 **1,154자·마커 5개** 복구.
  어법 판정 가능 14 → **17/18**(결과는 그대로, 기각 유지).
  **총량 지표(추출률 96.6%)는 안 움직였다 — 개별 문항이 조용히 잘려 있었다**
- **EBS 연계교재는 자료가 없다** — 보유분은 어휘 덱 1,800낱말뿐이고 연계 지문이 없다.
  연계율은 출제 설계의 큰 축인데 이 자료로는 못 잰다고 §7.6 에 명시

전수 커버리지 47.3% → **50.9%**

### ⭐ 수능 설계도 — 듣기 17문항 편입, 설계도의 마지막 큰 구멍을 메웠다

지금까지 설계도는 **읽기 23 + 장문 5** 만 다뤘다. 듣기 17문항(배점 34점, 회차의 38%)은
"음성이라 지면에 없다" 는 이유로 통째로 빠져 있었다. 대본 PDF 7개년이 저장소 밖에 있었다.

- **듣기 대본 7개년 편입** — 2017~2023 × 17문항 = **119문항 · 14,441낱말 · 누락 0**
  (`ingest-listening`). 16·17 은 담화를 공유하는 세트라 머리글을 따로 잡아야 한다.
  2021 은 물결표가 `∼`(U+223C)여서 정규식에 안 걸렸다 — 물결표 변종을 세 파일에 모두 추가
- **유형별 대본 규모표를 처음 만들었다** — 1번 43낱말/3턴 ~ 16·17번 162낱말/담화형
- **듣기가 전체 영어 입력의 41.1%** — 회차당 듣기 2,063낱말 vs 독해 2,955낱말.
  다만 듣기는 **속도를 학습자가 못 고른다**(되돌아갈 수 없다)
- **P8.2 신규 — 1:1 순서 대응이 듣기에도 성립한다.** 완전 단조 9/10 = 90%,
  인접 쌍 29/30 = 96.7% (기저 50% → p=2.9e-8). → **I2(①-회피)가 듣기에 걸리는 이유**가
  설명된다: 선택지가 담화 순서를 따르므로 ①은 담화 맨 앞이고 거기서 답이 정해지면
  나머지를 들을 이유가 없어진다. 읽기와 듣기가 **같은 설계 원리**를 쓴다
- ⚠️ **오판 하나를 잡았다** — 첫 판은 위치를 **턴 번호**로 재서, 담화형(16·17번, 1턴)의
  닻이 전부 0 이 되어 단조성이 자동으로 참이 됐다(7문항이 그렇게 통과). 낱말 오프셋으로 교체.
  "전부 같은 값" 은 증거가 아니라 자가 없다는 뜻이다

판정 98.2% · 규칙 29.1%

### ⭐⭐ 수능 설계도 — E8 발견: **번호가 능력군을 정한다.** 판정 98.1%

**설계 순서가 초안과 반대라는 것이 직접 증거로 확인됐다.**

- **E8 신규 HARD** — 2019 개편 이후 **18~40 번 23개 번호가 전부 한 능력군에 고정**.
  수능 9 + 모평 3 = 12회차 예외 0 · design-spec 2,002건 + 모평 429건 위반 0 · 돌연변이 11/11.
  지문을 보고 유형을 고르는 것이 아니라 **자리에 맞는 지문을 나중에 넣는다**
- **P0.2 기각 — 5단계 순서가 뒤집힌다.**
  초안 `①지문선정 → … → ⑤세트조립(기술 제약)`
  실측 `⑤세트 틀 → ②번호별 능력군(고정) → ①지문선정 → ③자리 → ④선지`
  초안이 "기술 제약" 으로 밀어 둔 것이 실은 **출발점**이다.
  12개 가설이 지문 쪽에서 아무것도 못 찾은 이유가 이것으로 설명된다
- **P5.5 기각 — 난도 스위치가 아예 없어졌다.** 빈칸 61문항(수능 14 + 모평 3) 전수에
  **연결사형 0건**. 연결사 빈칸은 두 칸 빈칸(R-BLANK2)의 형태였고 2017 폐지와 함께 사라졌다.
  **정답률 자료 없이 결판났다**
- **P3.8 기각** — 어법 난도 다이얼. 본문 ①~⑤ 마커 위치로 14문항(수능 11 + 모평 3) 측정:
  문장 길이 p=0.910(오히려 반대) · 밑줄 앞 낱말 수 p=0.395.
  P3.6 강등 · P3.7 기각과 합쳐 **어법에는 자리 설계가 없다**로 정리
- **P2.1 HARD 승격**(E8 로 정식화) · **P1c · P2.4 SOFT** (둘 다 한계 명시)
- 판정 커버리지 86.5% → **98.1%** · 전수 38.5% → **49.1%** · 규칙 25.0% → **28.3%**
- **미검증 1건만 남았다** — P7.5(재설계 훈련 효과). "못 잰다" 가 아니라 **가입자 수가 조건**이라
  A/B 계측 설계(군당 175명)를 문서에 적어 두었다

### ⭐ 수능 설계도 — 모의평가 3회차 편입, HARD 10 이 **예측으로 맞았다**

"자료가 없다" 를 결론으로 썼던 것을 **자기 정정**한다. 같은 폴더에 모의평가 4회차가 있었고
셋은 정답표까지 갖춰져 있었다. 편입하니 막혀 있던 것이 한꺼번에 풀렸다.

- **HARD 10 홀드아웃 — 위반 0** (`ingest-mock` + `verify-mock`). 규칙 도출에 **한 번도 안 쓴**
  2026-06 · 2026-09 · **2027-06** 세 회차, 문항 135 · 검사 426건.
  2027-06 은 코퍼스가 끝나는 2026 수능보다 **뒤에 치러진 시험**이다 — 설명이 아니라 예측이다
- **P3.4 승격** — 어휘 ④⑤ 가 다중비교 보정을 통과. 수능 10/13(Holm 0.13, 승격 불가)
  → 수능+모평 **13/16 = 81.3%**, raw p=0.00094, **Holm 0.016**. 모평 홀드아웃은 3/3
- **P6.40 의 열린 물음이 풀렸다** — 요약 격자의 전환 시점이 2021인지 2024인지 못 갈랐는데,
  **2026-06 이 격자**로 나왔다. 깨끗한 전환이 아니라 **혼합**이다(2020까지 7/7 → 이후 2/8).
  학습 함의 정정: "격자는 없어졌다" 는 틀리고 "격자를 기대하지 마라" 가 맞다
- **§7.3 자기 정정** — "유형별 명제는 n=14 가 구조적 상한이고 자료의 한계다" 는 **틀렸다.**
  자료의 한계가 아니라 자료를 안 찾은 것이었다. B 지표 33.3% → **38.5%**
- **§7.5 신설** — 남은 미검증 7건에 대해 "못 잰다" 가 아니라 **뚫을 수단**을 각각 적었다.
  그중 셋(P1c · P2.4 · P3.8)은 필요한 자료가 이미 저장소에 있다
- **§7.6 신설** — 아직 안 붙인 자료: 듣기 대본 7개년(배점 34점 구간이 통째로 빠져 있다) ·
  모평 202509 · EBS 연계교재

### 수능 설계도 — 오답 메커니즘 둘 기각 · 판정 86.3% · 전수 33.3%

- **P4.4 기각** (방향 반전) — 문항 내 짝지음 101문항·선지 505개. 부정 표지를 단 비율
  정답 13.9% vs 오답 **10.1%**, Fisher p=0.286. 방향이 오히려 정답 쪽.
  도구 한계 명시 — 방향 반전은 **어휘(30) 유형에 국한된 설계**로 보는 것이 맞다(손판독 12/12)
- **P4.5 기각** (세부사항 미끼) — 국소–전역 유사도 격차의 부호검정 31/58 = 53.4%, p=0.347
- **오판 하나를 스스로 잡았다** — 첫 판은 동점 43건을 실패로 세어 30.7%·p=1.0 이라는
  "역방향" 결론을 냈다. 동점은 **선지가 지문과 내용어를 하나도 안 겹쳐 잴 수 없는** 문항이지
  가설에 반하는 것이 아니다. 부호검정으로 고치니 신호 없음이 정답
- **선지의 31.9%가 지문 어휘를 하나도 안 쓴다** — 그런데 정답 28.7% vs 오답 32.7%(p=0.476)로
  **차이가 없다.** "정답은 지문 단어를 안 쓴다" 는 정답만의 성질이 아니다.
  P4.2 난도 다이얼이 서 있는 근거는 어디까지나 3점 오답 vs 2점 오답의 차이다

### 수능 설계도 — 손표본을 전수로 넓혔더니 확신이 내려갔다 · 판정 82.4% · 전수 29.4%

- **P6.25 를 손표본 4/4 → 기계 전수 27문항으로** — 선택지가 한글이어도 번역을 견디는 닻
  (숫자·라틴문자 고유명사)을 지문 **줄** 위치에 사상. 완전 단조 **20/27 = 74.1%**
  (무작위 순열 기저 0.83% → p=2e-36), 인접 쌍 순서 지킴 90.2%.
  ⚠️ 위치 단위를 문장으로 잡으면 안 된다 — 안내문·도표는 목록이라 마침표로 안 끊겨
  54문항 중 44개가 판정 불가였다. 줄로 바꿔 27문항 회복
- **HARD 후보 → SOFT 강등이 정직한 결과다.** 규칙 지표(C) 25.5% → 23.5%.
  표본을 넓히면 확신이 내려갈 수 있고, 내려간 쪽이 맞는 숫자다
- **P3.2 기각** — 빈칸 자리를 조판(크게 들여쓴 줄)에서 찾아 44문항 측정.
  3점 32 vs 2점 12 에서 거리가 안 갈린다 — D1(정답↔근거) p=0.890 · **D2(정답 무관) p=0.867**.
  정답에 기대지 않는 자도 null 이라 검정력 부족으로 돌리기 어렵다
- 버그 하나 — 빈칸 자리 표시에 `\x01` 을 썼는데 그건 `sentences()` 가 문장을 가르는 문자라
  표시가 통째로 삼켜져 44문항이 0문항으로 나왔다. 눈에 띈 건 결과가 전부 0 이었기 때문

### 수능 설계도 — "빈칸 지문은 재진술이 많다" 가 정반대였다 · 판정 80.4%

- **P2.3 기각, 그리고 방향이 반대** — 비인접 문장쌍 IDF 유사도 최댓값(사전에 못박은 측정)으로
  전수 136편을 재니 **빈칸 0.1298 vs 설명문 대조 0.1842**, 순열검정 p=0.0005.
  교락 둘 배제 — 문장 수 층(5~9)마다 빈칸이 낮고, **문장 하나가 통째로 빠진 삽입 지문**이
  0.1829 로 오히려 높다. 해석: 재진술이 많았다면 주제만으로 빈칸이 잠겼을 것이다.
  적어서 안 잠기고 인접 구체진술이 잠근다(명제 B 5/5)와 **독립으로 맞물린다**
- **P4.1 / V4 SOFT** — "주제=정답" 을 93문항 기계 검정. 정답이 지문 한 문장과 유사도 1위인 비율
  대의파악 38.7%(기저 20%, p=0.0127) vs **빈칸 22%(p=0.416)**. 손표본 8/8 vs 0/3 이 전수 재현.
  다만 61%는 1위가 아니라 규칙으로 못 쓴다 — 정답이 지문 어휘를 피하도록 설계되므로 이 자로는 한계
- **관문 G4 결함 수정** — 회차당 표본을 `max` 로 봐서, 회차 하나가 n=4 면 나머지 열세 회차가
  n=2 여도 가드가 열렸다. 그래서 베르누이 잡음을 "2025 계단" 으로 오판했다. 중앙값으로 교체.
  기존 판정 4건 전부 불변
- 판정 커버리지 76.5% → **80.4%** · **14회차 전수 21.6% → 25.5%** (두 검사 다 전수라 B 가 처음 움직였다)

### 수능 설계도 v2 본문 완성 — 판정 76.5%, STALE 0, 설계의 무게중심이 뒤집혔다

**[docs/CSAT_DESIGNER_MODEL.md](./CSAT_DESIGNER_MODEL.md) 신설** — 초안(v2-draft)을 14개년 630문항으로
검증해 고쳐 쓴 판. 모든 진술에 판정 딱지(HARD·HARD후보·SOFT·기각·미검증)를 달았다.

- **판정 커버리지 60.8% → 76.5%** · STALE 6 → **0** (초안 정정 완료) · 기각 14건이 최대 덩어리
- **가장 큰 정정 — 설계의 무게중심이 정반대였다.** 초안이 본체로 본 ①지문선정·②유형배정은
  확인된 제약이 **0개**, 기술 제약으로 밀어 둔 ⑤세트조립이 **HARD 10 전부**다
- **P6.20 기각** — 주장·요지 지문의 당위 표지 58.3% vs 대조군(주제·제목) 38.7%, Fisher p=0.180.
  **42%엔 당위가 아예 없다** — 유형 배정의 관문이 아니다
- **P6.21 기각** — 함축 정답 0/8 · **오답 0/32** 가 비유 낱말을 되받는다.
  비유를 직설로 바꾼 것이 정답인 건 맞지만 다섯 선지 전부가 직설이라 **선별력 0**
- 표본 상한을 명시 — 유형별 명제는 회차당 문항이 1~4개라 **n=14 가 상한**이고
  HARD 후보가 도달 가능한 최대다. 모평을 넣어야 넘어선다

### 수능 설계도 v2 — 명제 원장 51개, 조판 복원 96.6%, 유형별 명제 3건 판정

초안(v2-draft)의 명제를 낱개로 갈라 원장(`scripts/csat/data/v2-claims.json`)에 올리고
커버리지를 코드로 잰다(`audit-v2.mjs`). **판정 54% → 60.8%.**

- **초안이 이 저장소 실측보다 낡은 곳 6건(STALE) 특정** — 순서 표면단서 감소(폐기됨) ·
  어법 3종 92%(강등됨) · 3점 배분 "이동"(실은 2019 계단) · 삽입 지문선정론(12/12 반증) ·
  그 위에 세운 학습 처방 둘
- **2단 조판 복원 2판**(`pdf-columns2.mjs`) — 페이지별 검출 → **문서 격자 우선** + 병합줄 구조 시
  문항 번호 열에서 자르는 3차 보정. 병합줄 **95 → 1**, 지문+선택지 추출 **82.2% → 96.6%**(382문항).
  이것이 그동안 유형별 명제가 n=4~13 손표본에 머문 원인이었다
- **P3.7 기각** — "어법 형용사·부사는 정답 0회 = 오답 전용 자리" 는 base rate 산물
  (밑줄 13.8%, 기대 1.8회, Holm p=0.864). 문법 범주 6종 전부 정답 자리 편중 없음
- **P6.18 기각** — "목적 문장 앞에 배경" 은 장르 성질. 12/12 첫 문장 아님이지만 기저가 88.2%
  (p=0.223)이고 상대 위치는 균등(평균 0.437)
- **P6.19 SOFT** — 심경 전환점은 지문 중앙 [0.25,0.75] 에 7/8 (기저 50%, p=0.0352)
- **P6.40 SOFT + 신규 발견** — 요약 오답 "한쪽만 맞는 쌍" 은 **2020 이전 기법**.
  2014B~2020 격자 7/7, 2021~2026 은 1/5, 최근 3회 연속 독립 다섯 쌍

### 발행 단어장 8,171행이 예문 없이 나가고 있었다 — 5월에 고친 결함의 4배 규모 재발

발행 세트 **998개 · 8,171행**이 예문 공백. 그중 **8,123행(99.4%)은 사전에 예문이 이미 있었다.**
2026-05 백필(1,940행)과 같은 결함인데 이번엔 **원인이 다르다** — 조인 누락이 아니라 **순서**다.
`select_book_chapter_vocab` 은 `sd.example_en` 을 이미 조인한다. `shared_words` 가
발행 시점 **스냅샷**이라, 세트를 08-11/12 에 발행하고 사전 예문 드레인을 08-16~22 에 돌리면
그 사이에 발행된 것은 재동기화 수단이 없어 영구히 빈다(표본 전부 `sw.created_at < d.updated_at`).

- 백필 8,123행 + 사전 표제어 34개(negress·shorn·shipbuilding …) 예문 신규 작성 후 재전파 48행
  → `shared_words` **81,409행 전부 예문 보유 · 공백 0**
- 마이그레이션 `20260824231552` — `sync_published_set_examples(uuid)` 멱등 재동기화 +
  `run_content_quality_gates` 에 **I12 발행세트 예문 공백**(global · word_set). 재료가 사전에
  있는 것만 세어 게이트가 영구히 붉게 남는 것을 막는다
- `scripts/dict/example-fill.mjs apply --commit` 이 적재 직후 전파 호출 + 전파 행수 출력
- 화면도움말 — `/admin/vocabulary` 에 예문 드레인 3단(재실행 안전 명시) · `/admin/quality/gates` 에 I12

### 사전 DB 품질 점검 — 전 파이프라인 대조 (읽기 전용 실측)

`shared_dictionary` 47,737행을 LCP·ACP·VCB compose·VRL·학습 모듈 5경로 요구 필드에 대조.
확정 결함 5건 — **발행 세트 998개 8,171행 예문 공백**(해소) · VRL v_level 459(해소) · 폐쇄집합 기능어 19개 미등재(해소) ·
표면형으로 사전을 찾던 소비처 2곳(해소) · 템플릿 예문 약 350행(미해소).
오탐 4종(1음절 번역 137 · 미상 오탐 7 · 굴절 충돌 12 · 변이 그림자 44)은 조치 불필요로 확인.
리포트: [docs/reports/dict-quality-20260825.md](./reports/dict-quality-20260825.md)

### 단어장 — 발행된 수능 세트 4개가 예문 0% 였다 (백필 1,940행)

`shared_words` 81,409항목 중 **1,946건이 예문 없이** 학습자에게 나가고 있었다.
그런데 그중 **1,940건(99.7%)은 사전에 예문이 이미 있었다** — 재료가 모자란 게 아니라
적재 때 조인을 안 한 것이다. 사전에 아예 없는 낱말은 0건이었다.

**빠진 것이 고르게 흩어져 있지 않았다.** 발행 상태인 수능 세트 넷이 정확히 0% 였다:
빈칸추론 빈출 430 · 빈출 4년+ 362 · 글의 목적·요지 361 · 장문독해 빈출 234 = 1,387건.
주제별 세트들이 6~16%로 산발적인 것과 대조적이라, 산발 누락이 아니라 **경로가 달랐다**는 뜻이었다.

원인: 네 세트는 2026-05-19 에 **`lexicon_clean`(조회용 커버리지 사전)에서** 만들어졌고
(`lexicon_id` 100% · `source_run_id` 0), 그 테이블에는 **예문 컬럼이 없다.**
구조적으로 예문이 나올 수 없었다.

- 백필: `source_sentence`·`example_en` 이 **둘 다 빈 행만** 대상으로 사전 예문을 넣었다.
  원문 문장이 있는 항목은 건드리지 않는다 — 우선순위가 `source_sentence ?? example_en` 이고
  맥락 문장이 사전 예문보다 낫다(CLAUDE.md Context-Dependent).
  조인 키는 `lemma` 우선 — 표면형으로 조인하면 굴절형이 사전에 없어 또 빈다.
- 결과: **1,946 → 6.** 예문 보유 71,298 → 73,238. 수능 세트 6개 전부 **100%**.
- 남은 6건은 복합어(`self-catering`·`service provider`·`see-through` 등)로,
  **사전에 표제어는 있는데 예문이 없다.** 백필로는 못 채운다 — 집필이 필요하다.

⚠️ **재발 경로는 이미 죽어 있다.** 이 세트를 만든 `scripts/lexicon-v2.2/kice-csat-seed.ts` 는
`word_lexicon` 에 적재하는데 그 테이블이 2026-07 에 CASCADE 삭제돼 실행 불가다
(파일 상단에 그 경위가 적혀 있다). `lexicon_id` 를 가진 항목은 `csat` 범주 1,402건뿐이고
다른 범주는 0이라, 같은 방식으로 만들어진 세트가 더 없다는 것도 확인했다.

### 수능 유형별 출제자 사고 — 명제 6개 검증 완료, 학습 절차서로 마무리

외부 분석서에서 평가원 출제 매뉴얼의 **유형군별 능력 정의**를 얻어 출발점을 잡고,
거기서 나온 출제 명제 6개를 **주장 관문 5개**(하위그룹·기저확률·반증가능·시계열·검정선택)로 검증했다.

| 유형 | 명제 | 표본 | 판정 |
|---|---|---|---|
| 대의파악 | 주제문 **한 문장**이면 충분 | 8/8 | HARD 후보 |
| 대의파악 | 역접 표지 → 없으면 첫 문장 | 6/8 (기저 9.6%) | SOFT 상위 |
| 세부사항 | 1:1 순서 대응 | 4/4 +간접 192 | HARD 후보 |
| 어휘 | 오답 = 반의어 | 12/12 | HARD 후보 |
| 빈칸 | 일반진술 자리 | 5/5 | HARD 후보 |
| 빈칸 | **주제만으로는 안 잠긴다** | 5/5 | HARD 후보 |
| 간접쓰기 | 연결고리 3종만으로 충분 | — | **과장 정정** |

- **핵심 대비** — 같은 "주제 기준" 인데 대의파악은 주제문 한 문장으로 8/8 풀리고
  빈칸은 0/5 안 풀린다. 대의파악은 주제를 **묻고** 빈칸은 주제를 **비운다**
- **정정 2건** — 어법 "사실상 3지선다"(기저 72.3%라 lift 20%p) · 간접쓰기 "연결고리만으로 충분"
  (삽입 29.2% · 순서 44.1% 가 표면 장치 없음)
- 학습 절차서 [CSAT_LEARNER_PROCEDURE.md](./CSAT_LEARNER_PROCEDURE.md) — 검증 강도와 **적용 범위**를 함께 적었다
- 도구: [claim-gate.mjs](../scripts/csat/claim-gate.mjs) 5관문 · [test-thesis-marker.mjs](../scripts/csat/test-thesis-marker.mjs) 기저 계측

### 수능 출제 설계기준 v1 — 코드로 쓰고 630문항 전수 검증 (위반 0)

가설 12개가 두 층에서 전부 실패한 뒤, 마지막에 만들어 보고 이유를 알았다 —
평가원 선정을 거치지 않은 학술 문단 12편 전부에서 유효한 삽입 문항이 나왔다(12/12).
**좁힐 것이 별로 없었다.** 그래서 기준을 "무엇을 고르는가" 가 아니라
"무엇을 반드시 지키는가" 로 다시 썼다.

- HARD 8개 — 45문항 · 3점 정확히 10 · 듣기17+읽기28 · 정답번호 6~12 균형
  · **순서 대응형에서 ①은 정답이 아니다** · **한글 선택지면 3점이 아니다**
- 검증기  — 14회차 630문항 1,960건 검사 **위반 0**
- **홀드아웃 성립** — I2·I3·E5 는 2014A 를 뺀 13회차에서 도출했는데 2014A 에서도 예외 0
  (순서대응 12문항 ①=0 · 한글선택지 16문항 3점=0 · 정답분포 8/10/9/9/9)
- 생성 시연 — 천문학 설명문으로 삽입 문항을 만드니 정답이 자동으로 ①이 됐고,
  관행을 지키려 지문 도입부를 다시 써야 했다. 제약은 지문이 아니라 관행 쪽에 있다
- 문서 [CSAT_DESIGN_SPEC.md](./CSAT_DESIGN_SPEC.md)

### 수능 출제 설계도 v1 — 밑줄 첫 번째는 13년간 정답이 된 적이 없다

v0 가설 8개를 13개년 585문항으로 검사(채택 3 · 부분기각 1 · 기각 1 · 수정채택 1 · 판정보류 2).
그 과정에서 v0 에 없던 것이 나왔다 — **밑줄이 지문 안에 박히는 7유형 89문항에서 ①이 정답인
적이 0회**다(선택지가 지문 밖인 496문항은 21% 로 균등). 우연이라면 `(4/5)^89 ≈ 5e-9`.
①은 지문 맨 앞이라 판단 근거가 없어 오답 자리로만 쓰인다.

- **H3 채택 100%** — 어법 밑줄 65/65 가 문법 풀 10종 안. 정답은 준동사·관계사·수일치 3종에 92%,
  형용사·부사 밑줄 9개는 13년간 정답 0회
- **H7 기각** — 난도 레버 증가 추세 없음. 대신 3점 **총량은 회차당 10 고정인데 배분이 이동**했다:
  빈칸 88%→50% · 어법 100%→33% 가 빠진 자리를 순서·삽입 27%→50%, 주제 14%→50%,
  제목 0%→33% 가 채웠다. "빈칸이 전부" 는 지금 기출과 맞지 않는다
- **H8 수정 채택 83.3%** — "지문 핵심 명사" 가 아니라 **바로 앞 문장 어휘 이어받기**(50%→83.3%)
- **H1 부분 기각** — 오답의 어휘 위장은 3점에서만 성립(2점은 방향이 뒤집힘). 오답의 본질이 아니라 난도 레버
- H4 채택 77% · H6 채택 96%
- **2단 조판 벽을 뚫었다** — `pdftotext -layout` 이 두 단을 나란히 놓지만 가운데 여백은 보존한다.
  여백의 문자 열 위치를 페이지마다 찾아 단을 복원(`scripts/csat/pdf-columns.mjs`, 14/14 회차).
  빈칸은 공백 덩어리로, (A)(B)(C) 토막은 연속 블록으로 살아난다. 추출률 44%→83% · 45%→82%
- **H2 기각 51.2%** — 빈칸은 첫 문장 10 · 마지막 2문장 12 · **중간 21(49%)**.
  "빈칸은 주제문 자리" 통념은 절반만 맞는다
- **H5 기각 22.6%** — 그리고 시기를 가르면 방향이 있다: 표면 단서가 **아예 없는 토막이
  33.3% → 52.9%**. 순서 3점률 27%→50% 와 독립적으로 잰 두 지표가 같은 곳을 가리킨다 —
  출제자는 순서를 어렵게 만들 때 지문이 아니라 **연결어·지시어를 걷어냈다**
- **교차 관행 둘째** — 3점 배점 130개(회차당 정확히 10)가 **전부 선택지에 한글이 없는 문항**에
  있다. 선택지에 한글이 섞인 179문항(전체의 31%)에 13개년 3점이 **0건**, 층 7개(읽기·듣기 ×
  개념 4종) 전부 예외 없음. 가장 깨끗한 대조는 같은 개념 안에 있다 — 주제(영어) 28.6% ·
  제목(영어) 13.3% · **요지(한글) 0%**. 인과는 못 가른다(언어와 유형이 완전 교락)지만,
  선택지 언어는 출제자가 그 문항에서 무엇을 잴지 선언하는 장치다 — 한글=지문 이해까지,
  영어=재진술 대조까지
- 개념 6개 전수 계측 — 585문항 미배정 0. **개념 안 편차가 개념 사이 차이보다 크다**
  (C4 폭 85%p: 상황말하기 84.6% vs 읽기 목적 0%). 개념은 무엇을 재는지를 말하고 난도는 말하지 않는다
- 문서 [CSAT_BLUEPRINT_V1.md](./CSAT_BLUEPRINT_V1.md) ·
  코드 `scripts/csat/pdf-columns.mjs` · `verify-h3-h7.mjs` · `verify-h2-h5.mjs`

### 단어장 — `fiber` 가 "사소한 거짓말" 로 나가고 있었다 (데이터 수정 11행)

담기 코드가 `lemma` 를 안 읽던 것을 고치다가(위 항목) 그 아래에서 더 나쁜 것이 나왔다.
**철자 변종이 엉뚱한 낱말로 해소돼 학습자에게 틀린 뜻이 나가고 있었다.**

| 표제어 | 잘못 붙은 원형 | 나가던 뜻 | 올바른 뜻 | 행 |
|---|---|---|---|---|
| `fiber` | `fib` | **악의 없는 사소한 거짓말** | 섬유, 실 | 10 |
| `specter` | `spect` | spectator 단축형 | 유령, 망령 | 1 |

`fiber`(미국식)가 사전에 없고 `fibre`(영국식)만 있어서, 해소기가 가장 가까워 보이는
`fib` 을 골랐다. **아무 에러도 안 났다** — 뜻이 붙어 있으니 화면은 멀쩡했다.

- `shared_words` 11행을 사전의 올바른 값으로 수정(마이그레이션 아님 · DML). 이전 값은 이 커밋 메시지에 기록.
- 이미 담아 간 학습자 사본 2행도 뜻만 수정 — 같은 사용자가 `spectre` 를 이미 갖고 있어
  표제어를 바꾸면 `UNIQUE(user_id, word)` 와 충돌한다. `specter` 는 미국식 정식 철자라 표제어는 그대로 둔다.
- ⚠️ **재발 방지는 아직 못 했다.** `fibre` 의 `spelling_variants` 에는 `["fiber"]` 가
  **이미 있었는데 해소기가 안 읽었다.** 그리고 그 컬럼은 대부분 비어 있다
  (`spectre`·`colour`·`centre`·`analyse` 전부 `[]`).

**규칙으로 채우려다 또 기각했다** — `-re→-er` 을 돌리니 `therefore→therefoer` ·
`texture→textuer` · `on fire→on fier` 가 나왔다. "채울 수 있다" 던 827건은 허수다.

이번 세션에서 **같은 부류로 세 번 기각했다**: 캡션 필터(정밀도 25%) · 굴절형 정규식
(`dying→dye`·`shed→she`) · 철자 변종 규칙. 셋 다 "규칙이 그럴듯해 보이는데 실물에서
오탐이 다수" 였고, 셋 다 **표본을 눈으로 보고서야** 드러났다. 언어 데이터에 형태 규칙을
쓸 때는 개수를 세기 전에 **표본을 먼저 본다.**

### 교재 — **커버리지 17/19 유형 · 25/28 문항.** 집필로 닿을 수 있는 끝에 왔다

마이그레이션 `csat_dcp_items_long_expository` — `type` CHECK 23 → 25(`long_title`·`long_vocab`),
`grade_dcp_item` 선택지 배열과 `textbook_practice_items` 허용 목록 동시 확장. **사용자 승인 후 적용.**
CHECK 재생성 전 기존 23유형 전수 확인(누락 0). **이번엔 세 곳을 한 번에 넣었다** — 이걸 세 번
빠뜨렸고 그때마다 "정답을 맞혀도 오답" 이 됐다.

- 장문 ① 설명문(41~42) 개통 — 집필 갈래 `--mode long-expository` 신설(문단 4 × 6문장 · 300~340어).
  서사문과 달리 인물·시간 표지가 아니라 **① 글 전체를 관통하는 논지**(41번) **② 문맥이 낱말 뜻을
  강제하는 자리**(42번)를 요구한다. 32편 집필 · 밴드 적중 32/32 · **64문항 성립 64/64**.
  길이 편향 — 41번 최장 0%·최단 0%(양 밴드), 42번 최장 0~25%·최단 12.5~18.8%(우연 수준).
- **42번은 지문을 고쳐 저장한다** — 낱말 하나를 문맥과 어긋나게 바꾼 판(`passage_edited`)이
  학습자가 보는 지문이고 선택지는 거기서 그대로 따온 구절이다. 원본을 저장하면 찾을 것이 없다.
- 남은 둘은 **도표·안내문뿐**이고 지문 밖 재료가 필요하다 — 우리가 글을 써서 되는 것이 아니다.

### 교재 — 44번 지칭 15/32 → **24/24.** 병목이 문항 제작이 아니라 집필이었다

- 지난 사이클 실측(V4 11/16 · V5 4/16)에서 반려 사유가 **두 밴드 모두 하나**였다: 주요 인물이
  남녀 한 쌍이라 he/she 로 저절로 갈려 "가리키는 대상" 을 물을 것이 없다. 집필 지침에
  **"주요 인물 둘은 같은 성별"** 조건을 넣고 서사문 24편을 다시 썼다(밴드 적중 24/24).
- 그 지문으로 재드레인한 결과 **24/24 성립 · 길이 편향 양방향 0%.**
  문항 제작 단계에서는 못 고치는 결함이었음이 실측으로 확인됐다.

### 교재 스크립트 — 조용히 버리는 함정 둘

- **동시 export 가 같은 슬롯 번호를 받는다.** 슬롯은 "DB 최대치 다음" 부터 매기는데 두 export 를
  나란히 돌리면 둘 다 같은 최대치를 본다. 먼저 적재한 쪽이 번호를 차지하고 나중 쪽은 유일키에
  걸려 **서사문 12+12편이 전량 "이미 있음" 으로 버려졌다**(집필은 다 해 놓고 적재만 0, 로그는 정상).
  export 가 **아직 적재 전인 청크 파일의 슬롯까지** 세도록 고쳤다.
- **`item-drain-export` 는 `.out.json` 을 지우지 않는다.** 같은 유형을 다시 뽑을 때 낡은 산출물이
  남아 있으면 **이전 지문의 문항이 새 지문 것으로 적재된다.** 44번 재드레인 전에 8개를 치웠다.

### 교재 — 심경 45문항이 채점 불가였다. **같은 어긋남이 세 번째라 회귀로 못 박았다**

마이그레이션 `grade_dcp_item_mood` — `grade_dcp_item` 선택지 배열과 `textbook_practice_items`
허용 목록에 `mood` 추가. **사용자 승인 후 적용.** 스키마·데이터 변경 없음(함수 본문만).

- 원인은 순서였다. `20260822013136` 이 선택지 분기를 만들 때 `mood` 는 **아직 없던 유형**이고
  (같은 날 몇 시간 뒤 45문항이 생겼다), 만든 뒤에 배열에 더하는 것을 빠뜨렸다.
  실측 프로브: **정답을 그대로 제출해도 `Unknown type`** → `gradeDcpItem` 이 `{correct:false}` 로
  바꿔 **정답이 오답으로 보인다.**
- **회귀를 정의 대조가 아니라 실제 채점으로 만들었다** — `dcp-grade-records.integration` 이
  재생용 선택지 유형마다 문항 하나를 실제로 제출한다(13유형 통과). 목록이 `dcp-types.ts` 와
  DB 함수 두 곳에 나뉜 한 또 갈리므로, 갈리면 테스트가 먼저 빨개진다.

### 교재 — 장문 V5 44문항 적재. **44번의 병목은 문항 제작이 아니라 집필이었다**

- V5 수율 — 43번 16/16 · 45번 16/16 · **44번 4/16**(V4 는 11/16). 반려 사유가 두 밴드에서
  **전부 같았다**: 주요 인물이 남녀 한 쌍이라 he/she 로 저절로 갈려 "가리키는 대상" 을 물을
  것이 없다. 문항 제작 단계에서 고칠 수 없는 결함이라 **집필 지침에 "주요 인물 둘은 같은
  성별" 조건을 넣었다**(`LONG_NARRATIVE_SHAPES` + `long_rule`).
- 순서 문항 저장 정답 대조 — V5 도 **16/16 일치 · 자명한 정답 0**.
  V5 청크는 섞기를 넣기 전에 뽑혀 있었으므로 배치를 돌리기 전에 다시 뽑았다.
- 다섯 권 전부 자동검수 9/9 · 해설 없음 0 유지.

### 교재 — 장문 ②(수능 43~45) 개통. 커버리지 **16/19 유형 · 23/28 문항**

마이그레이션 `csat_dcp_items_long_types` — `type` CHECK 에 `long_order`·`long_reference`·`long_match`
추가(20 → 23), `grade_dcp_item` 선택지 분기와 `textbook_practice_items` 허용 목록 확장. **사용자 승인 후 적용.**
CHECK 재생성 전 **기존 20유형을 전수 확인**했다(누락 0).

- **커버리지 분모를 고쳤다: 18 → 19 유형.** `long_passage` 한 칸이 41~45 다섯 문항을 묶고 있었는데,
  시험지에서 41~42(설명문)와 43~45(서사문)는 **지문이 서로 다르다.** 한 칸에 두면 어느 쪽이 막혔는지
  알 수 없어 둘로 갈랐다(`long_expository` · `long_narrative`). **문항 분모 28은 그대로다.**
- 집필: `write-drain-export --mode long-narrative` — 문단 4 × 6문장 · 300~340어.
  **6문장인 이유는 적재기 `repaginate` 가 "모든 문단 6~10문장" 일 때만 원문 문단을 그대로 두기 때문**
  (5문장이면 문단이 합쳐져 네 토막이 사라지고 43번을 못 만든다). V4·V5 **32편 · 밴드 적중 32/32**,
  적재 후에도 **32/32 가 문단 넷을 유지**.
- **순서 문항의 설계 결함을 적재 전에 잡았다.** 처음에는 문단을 원래 순서대로 (A)(B)(C)(D) 로 붙여
  내보냈는데, 그러면 정답이 **언제나 `(B)-(C)-(D)`** 다 — 배치 넷이 실제로 그 답만 만들어 왔고
  학습자도 읽지 않고 고르면 맞는다. 글 id 로 정해지는 섞기를 넣어 정답을 **원래 순서를 되찾는 배열**로
  바꿨다(재실행 안전). 적재 후 실측: **저장된 정답 16/16 일치 · 자명한 정답 0/16.**
- 수율 — 43번 16/16 · 45번 16/16 · **44번 11/16**(반려 5건은 전부 "인물이 한 명이거나 성별이 달라
  대명사가 자동 구분됨" — 지칭 문항은 **동성 인물 둘**이 있어야 선다). 길이 편향 세 유형 모두 0%.
- 조합기가 **유형마다 지문 길이 창을 갈라 댄다**(`itemWordSpec`) — 장문 260~400어, 나머지 90~200어.
  같은 자를 대면 장문이 전량 걸려 "적재는 됐는데 책에는 없다" 가 된다. 회귀 2종 추가.
  자동 검수의 길이 항목도 같은 이유로 8/9 → 9/9 복구(**검사가 틀렸지 문항이 틀린 게 아니었다**).

### 교재 — 학습자가 화면에서 실제로 풀어 관측이 쌓이는 것을 확인

- e2e `21-textbook-practice.spec.ts`(2) — 계단 화면의 "문항 풀어 보기" 링크 → 문항 제출 →
  **`csat_item_attempts` 행 생성**까지 클릭으로 밟는다. RPC 단위 테스트와 겹쳐 보이지만 덮는 구간이
  다르다: 그쪽은 DB 계약, 이쪽은 **렌더·클릭·서버 액션까지 이어진 배선**이다.
  둘째 스펙은 페이지 소스에 `answer_key`·`rationale_ko`·`source_order` 가 없음을 단언한다.
- 만든 응답은 `finally` 에서 지운다 — 남기면 `derive_learner_stage` 가 흔들리고,
  `textbook_practice_items` 가 "이미 푼 문항" 을 빼므로 다음 실행이 볼 문항이 준다.

### 교재 — DCP 채점이 **한 번도 성공한 적이 없었다** (마이그레이션 승인 완료)

마이그레이션 `dcp_attempts_and_choice_grading` — `csat_item_attempts.dcp_item_id` 신설
(FK → `csat_dcp_items` · `ON DELETE SET NULL`) + `grade_dcp_item` 재작성 + `textbook_practice_items` 확장.
**사용자 승인 후 적용.** 적용 시점 `csat_item_attempts` 0행이라 데이터 손실 없음.

- **원인은 FK 였다.** `grade_dcp_item` 이 `question_id` 에 `csat_dcp_items.id` 를 넣는데 그 컬럼의 FK 는
  `quiz_questions` 를 가리켜 모든 INSERT 가 23503 으로 죽었다(롤백 프로브 실측). 그 예외를
  `gradeDcpItem` 이 `{correct:false}` 로 바꾸므로 **학습자가 정답을 맞혀도 화면은 "아쉬워요" 를 띄웠고
  기록은 한 줄도 안 남았다.** `20260812113000_restore_csat_item_attempts` 가 원본 DDL(FK 포함)을
  그대로 복원하며 생겼고, 당시 검증은 `derive_learner_stage`·`prescribe_today` 만 봤다 —
  **채점을 한 번도 돌려 보지 않았다.** 42P01 을 고치고 23503 을 남긴 셈이다.
- **선택지 9종을 학습자가 푼다** — 요지·주제·제목·빈칸·목적·주장·함의·요약·일치.
  DB 실측상 payload·answer_key 모양이 같아 `DcpChoiceItem` 하나·채점 분기 하나가 아홉을 덮는다.
  `textbook_practice_items` 가 이 9종을 내주고(**정답 계열 키 0개** 실측), 이미 푼 문항은 제외한다.
  `prescribe_today` 는 그대로 — 허용 목록이 별개다.
- 회귀 `dcp-grade-records.integration.test.ts`(4) — **진짜 학습자 세션으로 채점을 돌려 행이 생기는지 센다.**
  컬럼·FK·권한·RLS 가 전부 맞아야 통과한다. 쓴 행은 지운다.

### 교재 — 심경·분위기(19번) 0/16 → **45/48.** 지문 갈래가 유형을 가리고 있었다

- 집필 드레인에 **서사문 갈래** 신설 — `write-drain-export.mjs --mode narrative`
  (서사 축 8 × 짜임 3, 청크는 `write-drain/v<밴드>-narr` 로 분리). V4·V5 **48편 집필,
  밴드 적중 48/48**(적재 전 예측과 DB 실측 일치).
- 문항 드레인에 `--batch` — 지문 풀을 집필 배치로 좁힌다. **안 좁히면 같은 밴드 설명문이
  슬롯을 채워 다시 0 이 나온다.** 좁혀서 mood 45건 적재(반려 3건은 배치가 `answer:0` 으로 남긴 것).
  드레인 실측 정답 최장 0% · 최단 0%(우연이면 각 20%).
- **커버리지 14/18 → 15/18 · 문항 19/28 → 20/28.** V5 인쇄 114 → 120, 다섯 권 전부 자동 검수 9/9.
- 학교 시험 축 4종(`blank_word`·`grammar_fix`·`unit_vocab`·`unit_grammar`)은 교재 전용으로 분류 —
  payload 실측상 `passage` 가 없고 선택지 5개인 것이 0건이라 재생 목록에 넣으면 파서가 전부 버린다.

### 교재 스크립트 — `.limit(20000)` 이 다섯 파일에 더 있었다

- `store-new-types.mjs` 가 **중복 키로 중단**됐다. 기사를 20편씩 끊어 물었지만 조각 31개 중
  2개가 1022행이라 뒤가 잘렸고, 잘린 만큼 "이미 있음" 판정이 빠졌다(실측).
- `fetchAllIn` 에 추가 조건 인자를 더해 **여섯 호출부를 한 페이저로 통일**
  (build-unit · build-volume ×2 · refresh-dcp-items · store-new-types ×2). item-health-report 는
  전수 조회라 직접 페이징.
- 회귀 `volume-drift.test.ts` 를 **폴더 전체**로 넓혔다 — 한 파일만 보던 동안 옆 파일이 같은 함정에 빠졌다.

### 교재 — 중등 4유형 적재 (마이그레이션 승인 완료). 가장 얇던 두 계단이 두꺼워졌다

마이그레이션 `csat_dcp_items_middle_types` — `type` CHECK 에 `blank_word` · `grammar_fix` ·
`unit_vocab` · `unit_grammar` 를 더했다(기존 16 → 20). **사용자 승인 후 적용.**
`listen_choose` 는 넣지 않았다 — 지문이 아니라 사전에서 나와 `ref_id` 가 없다(초등 3종과 같다).

- `store-new-types.mjs` 가 중등 4종을 함께 적재한다. **실측 10,385건 적재**
  (blank_word 3,468 · unit_vocab 2,752 · grammar_fix 2,445 · unit_grammar 1,222 + 기존 유형 498).
- **사다리 3단 847 → 1,634 · 4단 510 → 2,139.** 가장 얇던 두 계단이 목표였고 그대로 올랐다.
  무게중심도 고르게 폈다 (1단 22%→17% · 4단 7%→20%).
- 유일키 `(kind, ref_id, type, paragraph_idx)` 가 단답을 문단당 하나로 접는다 —
  blank_word 82.5% · grammar_fix 62.2% 를 버린다. `word_order` 선례를 따라 **그대로 두고 버린 수를 찍는다**
  (사용자 판단: 한 지문에 같은 유형이 여러 개 실리는 것도 교재로서 좋은 구성은 아니다).

⚠️ **적재만으로는 교재가 되지 않았다.** 9,887행을 넣은 뒤에도 사다리 리포트가 **0 으로 셌다** —
`SERIES_SPINE` 의 계단별 `types` 목록에 새 유형이 없으면 `measureSeriesFill` 이 어느 계단에도
넣지 않는데, **아무 에러도 안 난다.** 3단(어휘가 처음 들어가는 계단)에 본문 어휘·빈칸을,
4단(어법이 들어가는 계단)에 거기 더해 단원 문법·어법 고쳐쓰기를 열었다 — 기존 계단 설계 논리 그대로다.

⚠️ 이름표도 같은 방식으로 샜다. 리포트 스크립트가 **타입 없는 객체**로 이름표를 들고 있어
`undefined 291` 이 찍혔다. `SERIES_TYPE_LABEL_KO: Record<SeriesItemType, string>` 로 옮겨
**union 에 유형을 더하면 컴파일이 막히게** 했다 — 다음 사람은 빠뜨릴 수 없다.

검증: `tsc --noEmit` 통과 · vitest **806/806** 통과 · `series-report` 재실행으로 계단 증가 실측.

### 교재 — **관측 0행의 진짜 이유는 풀 자리가 없어서였다** (v06.346)

평가 요소 15개 중 열위 하나가 "실사용 난이도·변별도" 인데 **이것만은 콘텐츠로 못 고친다** —
학습자가 풀어야 P·D 가 나온다.  가 0행인 이유를 찾아보니 단순했다:
교재 서가가 재고를 보여 주고  로 돌려보낼 뿐 **풀 자리가 없었다.**

**■ 그런데 학습자는 문항을 아예 못 읽는다 — 그리고 열어서도 안 된다**

 에는 admin 정책 하나뿐이다. 그렇다고 학습자 SELECT 정책을 열 수는 없다 —
**같은 행에  가 있어서** 브라우저에서 정답이 보이고 문항이 무용지물이 된다.

→ 마이그레이션 (사용자 승인 후 적용) — 정답을 뺀 열만 내주는
SECURITY DEFINER 함수. 채점은 지금처럼  이 서버에서 한다(정답 판정을 두 곳에 두지 않는다).
실측 확인: 내주는 payload 키가 ··· 뿐 —
**answer 계열 0개.**

- 신설  + 계단 화면에 "문항 풀어 보기" 링크
-  — 조회 실패와 "문항 없음" 을 **구별해서** 넘긴다
  (뭉개면 학습자가 "아직 없나 보다" 로 읽는다)
- ⚠️ 화면이 그릴 수 있는 유형만 나온다(순서·삽입). 생성형 9유형은  가 아직
  못 그리므로 RPC 가 아예 뺀다 — 섞으면 빈 화면이 되고, 그건 이미 겪은 사고다(처방 42.5% 누수).

### 교재 — V2·V4 생성형 확대 (v06.345)

90문항 적재(topic V2 16 · blank V2 16 · topic V4 15 · blank V4 14 · main_point V4 14 · implication V5 15).
길이 편향 전부 우연 수준. 배치들이 출제 근거 없는 지문 7건을 스스로 건너뛰었다 —
멤버 나열 정보문 · 사진 캡션과 메타데이터뿐인 블로그 도입부 · 본문이 중간에서 끊긴 글.


### 교재 — 빈칸 문항의 9.88% 가 채점이 갈리고 있었다 (품질 실측)

Cycle 4~6 에서 다섯 유형을 만들고 **수율만 재고 품질을 안 쟀다.** 수율은 "문항이 나온다"
이지 "문항이 좋다" 가 아니다. `scripts/textbook/new-types-health.mjs` 로 30,605문항을
`item-health` 검사에 태웠더니 하나가 걸렸다.

- **빈칸에 낱말 쓰기 — 생성분 18,114 중 1,790건(9.88%)이 단서로 답이 확정되지 않았다.**
  `buildBlankWord` 는 "첫 글자 + 우리말 뜻이면 하나로 좁혀진다" 는 **가정 위에 서 있었는데
  그 가정을 잰 적이 없었다.** 실물: `exploration` 의 "e… (탐험)" · `about` 의 "a… (~에 관하여)"
  는 사전의 다른 낱말도 가리킨다 → 학습자가 맞는 답을 써도 틀렸다고 채점된다.
  같은 저장소에 선례가 있었다 — `buildSpellBlank` 는 `c_t`(cat·cot·cut)를 **사전으로 세어** 거른다.
  확인할 수 있는 것을 확인 안 하고 주장으로 두면 안 된다.
  → `isHintUnique` 를 **필수 인자**로 추가(선택으로 두면 다음 호출자가 빠뜨려 되살아난다).
  **실측 결과 9.88% → 0.00%**, 수율은 18,114 → 17,988 로 **0.7% 만** 깎였다
  (그 낱말을 버리고 같은 문장의 다른 자리로 넘어가므로).
- 나머지 넷은 깨끗했다: 정답 번호 쏠림 없음(unit_vocab 최다 25.9% · unit_grammar 26.9% ·
  listen_choose 27.7%, 균등이 25%) · 중등 규격(40~120어) 이탈 **0%** · 밴드 분포 V1~V8 고루.
- ⚠️ **실사용 관측은 여전히 0행**(`csat_item_attempts`). 난이도·변별도는 못 잰다 —
  이번에 잰 것은 구조적 결함뿐이고, 문항이 학습자에게 적절한지는 아직 모른다.

검증: `tsc --noEmit` 통과 · vitest **806/806** 통과 (회귀 3종 추가).

### 교재 — 초등 듣고 고르기 가동 · 그림-낱말 연결은 실측으로 기각 (자동채점 8/12 → 9/12)

`school-types.ts` 가 두 유형을 "저작권 없는 세트가 없으면 성립하지 않는다" 로 묶어 뒀는데,
**그 세트의 존재를 잰 적이 없었다.** 재 보니 둘의 답이 갈렸다 (`scripts/textbook/media-probe.mjs`).

- **듣고 고르기 — 성립한다.** Wikimedia Commons 발음 파일은 이름 규약이 문서화돼 있고
  (`File:En-us-<word>.ogg`), 교육과정 초등 어휘 표본 120개 중 **113개(94.2%)** 가 존재한다.
  라이선스 CC BY-SA 3.0 101 · PD 9 · CC BY 3.0 3.
  **CC BY-SA 는 출처 표기가 의무**라 `buildListenChoose` 는 음원 주소와 표기 문자열을 짝으로 받고,
  표기가 없으면 문항을 만들지 않는다(고쳐 쓰지 않고 재생만 하므로 SA 는 안 걸리고 BY 는 걸린다).
  오답은 **같은 각운**에서 고른다 — 아무 낱말이면 첫소리만 듣고 배제돼 듣기가 아니라 눈치가 된다.
- **그림-낱말 연결 — 기각.** 근거가 둘이다. ① Openverse 에서 CC0·PD 이미지가 있는 낱말이
  표본 60개 중 **8개(13.3%)** 뿐이고 68.3% 는 BY/BY-SA 만 있다. ② 더 결정적으로
  **검색이 낱말-그림 대응이 아니라 제목 문자열 매칭**이다 — `age` → "Cuba age" ·
  `because` → "I love you because" · `between` → "Sand-Between-Toes".
  추상어는 애초에 그림이 안 되고, 이대로 쓰면 **틀린 그림이 정답으로 붙는다.**
  되살리려면 낱말↔그림이 사람 손으로 짝지어진 세트(예: Wikidata depicts)가 있어야 한다.
- 회귀 12종(`listen-choose.test.ts`) — 듣기의 실패 모드는 "정답이 갈린다" 가 아니라
  **"듣지 않고도 풀린다"** 라, 오답이 정답과 겨룰 만한지를 잰다.

검증: `tsc --noEmit` 통과 · vitest **803/803** 통과 · `coverage.mjs` 재실행으로 9/12 실측.

### 교재 — 중등 객관식 2종으로 cheapWins 소진 (자동채점 6/12 → 8/12) + 캡션 누수 차단

`measureSchoolCoverage().cheapWins`(결정론 · 자동채점 · 지문 제약 없음)가 **비었다.**
남은 내신 유형은 그림·음원이 필요하거나 · 생성형이거나 · 본교 교과서가 있어야 하거나 · 사람이 채점한다.

- **본문 어휘 뜻** (`buildUnitVocab`) — 실측 수율 **4,355/6,883 문단 = 63.3%**.
  초등 `buildWordMeaning` 과 규칙은 같고 표제어가 지문에서 온다. 초등에 없던 제약이 하나 붙는다 —
  **지문에 있는 낱말의 뜻은 오답으로 쓰지 않는다**(지문이 없던 초등에는 없던 문제다).
- **단원 문법** (`buildUnitGrammar`) — 실측 수율 **1,523/6,883 = 22.1%**.
  규칙 판정은 수능 어법(29번)의 `candidateAt` 을 그대로 쓰고 **규격만 다르다**
  (4지선다 · 40~120어 · 밑줄 4 / 수능은 5지선다 · 90~200어 · 밑줄 5).
  ⚠️ 겸용 함수로 두지 않은 이유는 규격이 섞이면 **수능 재고를 중등 재고로 세기** 때문이다.
- 회귀 15종(`middle-choice.test.ts`) — 단답이 *정답의 유일성*을 재는 것과 달리 **오답의 무해성**을 잰다.

**캡션이 본문 문장으로 새던 것 차단** — `htmlToPlainText` 가 `<figcaption>` 을 따로 뗀다.
NASA 는 `<figcaption>` 을 `</figure>` **뒤에 형제로** 두어(실측) 기존 `<figure>` 제거가 못 잡았다.
캡션은 마침표가 있어 문장처럼 보이지만 정형동사가 없어, 순서·삽입 문항의 한 칸이 되면
학습자가 글의 흐름이 아니라 사진 설명을 읽고 순서를 맞추게 된다.

⚠️ **이것을 문장 필터로 고치려다 기각했다** (`scripts/textbook/caption-probe.mjs`).
"정형동사 없는 명사구" 판정은 품사 태거 없이 정밀도가 안 나온다 — 가장 넓은 규칙은
25,843문장의 **24.3%** 를 잡는데 대부분이 멀쩡한 문장이었고("the crew flew by the far side"),
가장 좁은 규칙조차 표본 8개 중 실제 캡션이 **2개**였다. 구조로 잡히는 것을 추론으로 잡으면 안 된다.
기존 저장분의 오염(~0.2%)은 재수집이 필요한 별도 사안이다 — 본문 덮어쓰기라 승인 대상.

검증: `tsc --noEmit` 통과 · vitest **790/790** 통과 · `coverage.mjs` 재실행으로 8/12 실측.

### 교재 — 중등 단답 2종. 자동채점 커버리지 4/12 → 6/12

`measureSchoolCoverage().cheapWins` 가 지목한 4개(결정론 · 자동채점 · 지문 제약 없음) 중
**단답 두 개**를 구현했다 (`packages/library-pipeline/src/textbook/middle-short.ts`).
남은 둘(본문 어휘 뜻 · 단원 문법)은 객관식이라 다음 몫이다.

- **빈칸에 낱말 쓰기** — 실측 수율 **19,177/34,337 문장 = 55.8%** (V2 74.1% → V7 41.9%).
  ⚠️ 낱말을 지우기만 하면 정답이 확정되지 않는다("She ___ the door" 는 opened·closed·locked 가 다 된다).
  **첫 글자 + 우리말 뜻**을 단서로 붙여야 하나로 좁혀진다. 기능어는 지우지 않고,
  같은 낱말이 두 번 나오는 문장은 버린다(다른 자리도 답이 되어 채점이 갈린다).
- **어법 틀린 것 고쳐 쓰기** — 실측 수율 **6,373/34,337 = 18.6%**.
  규칙 판정은 수능 어법(29번)의 `candidateAt` 을 **재사용**한다 — 재구현하면 두 유형의 판정이
  조용히 갈라진다. **망가뜨릴 자리가 정확히 하나일 때만** 낸다(둘 이상이면 다른 쪽을 고쳐도 맞는 답이다).
- 회귀 17종(`middle-short.test.ts`) — 재는 것이 문항 모양이 아니라 **정답의 유일성**이다.
  객관식은 "답이 둘" 이면 검수자 눈에 띄지만 단답은 안 띈다: 문항은 멀쩡해 보이고
  학습자가 맞는 답을 써도 채점기가 틀렸다고 한다.
- 수율 실측: `scripts/textbook/middle-short-probe.mjs` (읽기 전용 · 문항 저장 안 함)
- 검증: `tsc --noEmit` 통과 · vitest **764/764** 통과

남은 격차(실측): 수능 읽기 **5/18 유형** — 결정론 5/5 완료, 생성형 0/11, 외부재료 0/2.

### 교재 — 소스 후보 전수 검토 종료. **저레벨 구멍은 없었다** (계측·정정)

사용자 제시 후보 27개 + 재시도 8개를 전부 두드렸다(`scripts/acp/candidate-probe.mjs` ·
`scripts/acp/discover-retry.mjs`). 배선 결과와 함께, **앞선 두 사이클의 판단 하나가 틀렸다.**

- **정정: "초·중등 저레벨 상류 고갈" 은 오진이었다.** 지문 재고만 보고 구멍이라 했는데,
  `SERIES_SPINE` 1단(V1 초등 저학년)은 **지문이 없는 단계**다(rhyme·word_meaning·spell_blank).
  2단도 문장 단위라 긴 지문이 필요 없다. 실측: 사다리 7단 **전부 문항 보유**
  (1단 1,833 · 2단 2,163 · 3단 847 · 4단 510 · 5단 1,132 · 6단 1,241 · 7단 465).
  A1 지문 0편은 결함이 아니라 설계다.
- **진짜 분모는 유형 커버리지였다** (`scripts/textbook/coverage.mjs` 실측):
  수능 읽기 **5/18 유형(27.8%)** · 시험지 비중 **7/28 문항(25%)**.
  결정론 5/5 는 완료(어법·어휘·흐름무관·순서·삽입), 남은 **11개는 전부 생성형**
  (목적·심경·주장·함의·요지·주제·제목·인물일치·빈칸·요약·장문), 외부재료 2개(도표·안내문).
  내신은 초등 3/5 · 중등 1/6 · 고내신 0/3 — 자동채점 가능분 **4/12**.
- **discover 재시도 0/8** — World Bank Blogs · UNESCO Courier · NASA Space Place · CK-12 ·
  CDC · NPS · OpenStax · EurekAlert 는 robots.txt/sitemap 어디에도 피드를 공개하지 않는다.
  주소를 짐작해 넣지 않았다(이 저장소는 그러다 11개 중 9개가 404 난 이력이 세 번).
  `unknown` 으로 남긴다 — **없다고 단정하지 않는다.**
- **ROUTES.md 정정** — `/api/admin/articles/*` 를 **4개**로 적고 있었고 그중 `arxiv-feed` 는
  플랫폼에서 삭제된 소스였다. 실제 21개(소스 GET 15 + 운영 6). 소스별 라이선스·register 표 추가.
  LIBRARY_PIPELINE.md 의 "4 feed (arXiv/NASA/NIH/VOA)" 도 15소스·38피드로 정정.

### 교재 — **사다리 다섯 계단이 모두 한 권씩** (v06.343)

규격을 `185~200어 · 정확히 12문장` 으로 바꾸고 V2·V3 에 64편을 썼다. 결과:

| 밴드 | 통과 문항 | 단원 | 직전 |
|---|---|---|---|
| **V2** | 83 → **191** | 10 → **20** | |
| **V3** | 101 → **203** | 12 → **20** | |
| V4 / V5 / V6 | 150 / 243 / 225 | 20 / 20 / 20 | 유지 |

**다섯 권 모두 자동 검수 9/9.** 집필 배치 8개가 전부 자가 검사 8/8 로 끝냈다 —
검사기가 채점기와 일치하는 한 조준은 이제 신뢰할 수 있다.

**■ 같은 실수를 두 번 했다 — 완료 알림 전에 적재**

파일이 디스크에 있다는 이유로 적재했는데, 배치들은 아직 고치는 중이었다.
적재 시점 적중은 V2 21/32 · V3 9/32 였고 나는 그것을 "배치가 못 맞혔다" 로 읽었다.
완료 알림을 다 받은 뒤 같은 파일을 재니 **전부 8/8** 이었다. **파일 존재 ≠ 작업 완료.**
`--update-existing` 으로 55편을 갱신해 복구했다(V2 23 · V3 32).

**■ 배치들이 실측으로 알려 준 것 (내 지침의 오류 정정 포함)**

- **문장당 16어**로 써야 195어에 맞는다. 19~20어로 쓰면 215~241어가 되어 창을 넘긴다.
- 조준은 **꼬리↔목표밴드 낱말 1:1 치환**이다. 그냥 빼면 사전 적중 낱말 수 `n` 이 줄어
  75분위 인덱스도 함께 내려가 **오히려 아래 계단으로 떨어진다** — 가장 자주 밟는 함정.
- **일부 평범한 낱말은 아예 추출되지 않는다** — `mild`·`further`·`player`·`crowd` 는
  불용어라 목표 밴드로 세어지지 않는다. **내가 지침에 적어 둔 V3 팔레트에 오류가 있었다.**
- 굴절형은 채점에서 통째로 빠진다(`pieces`·`voyages`·`sessions`). 단복수가 계단을 바꾼다 —
  `custom` 은 V3 인데 `customs` 는 V6 다.
- 지문당 사전 적중 낱말은 40~58개. 꼬리 허용치가 그 **약 1/4** 이라, 어려운 낱말을 줄이는 것만큼
  **평이한 낱말을 늘려 분모를 키우는 것**이 효과적이다.

### 교재 서가 — 파이프라인 산출물이 처음으로 학습자에게 닿는다 (v06.337, 진행 중)

교재 파이프라인은 생성기·검사기·리포트·Admin 콘솔·HTML 조판기까지 다 있는데
**학습자가 볼 수 있는 화면이 0개**였다. 문항 5,492개가 DB 에 있어도 학습자에게는 없는 것과 같다.

- **신설** `/library/textbooks` — 서점 교재 코너처럼 **계단 순서대로 한 줄기**로 진열.
  카드 나열이 아니라 사다리다(계단 번호가 곧 "다음 권").
- **분류 축을 새로 만들지 않았다** — `SERIES_SPINE`(7계단 · 학령 · 유형 · 근거)이 이미 정본이고,
  `shelf.ts` 는 그 위에 "서가에 꽂을 수 있는가" 판정과 표시값만 얹는다. 눈금이 둘이면 갈린다.
- **권당 정보 8종** — 계단 · 권명 · 학령 · V레벨 · 수록 유형(유형별 개수 포함) · 총 문항 ·
  구성 근거 · 상태. 서점 교재의 표지·구성란에 해당하는 정보를 그대로 옮겼다.
- **초등 3종은 생성 가능 수로 센다** — `rhyme`·`word_meaning`·`spell_blank` 는 DB 에 저장되지
  않는다(사전의 결정론적 생성). 안 넣으면 초등 계단이 거짓으로 비어 보인다(`series.ts` 경고).

⚠️ **첫 구현이 거짓말을 했다 (같은 세션에서 발견·수정)**

실제로 열어 보니 7권 중 6권이 "재고 0 · 근간 예정" 으로 나왔다. DB 에는 실재한다 —
V4 510 · V5 1,132 · V6 1,241 · V7 465. 원인은 재고가 아니라 **권한**이었다:
`csat_dcp_items` 의 RLS 정책이 `dcp_admin [ALL]` 하나뿐이라 학습자 조회가 **빈 배열**을 받고,
화면이 그것을 "재료 없음" 으로 인쇄했다. 이 저장소가 지배적 결함으로 지목한 **조용한 실패**다.

- 화면 쪽 수정: `unmeasured` 상태 신설 — **못 잰 것을 0 으로 적지 않는다.**
  "재고 확인 중" 으로 표시하고 상단에 "비어 있다는 뜻이 아닙니다" 를 밝힌다.
- ✅ **적용 완료(2026-08-21)** 마이그레이션 `20260821120000_textbook_shelf_inventory` —
  `textbook_shelf_inventory()` SECURITY DEFINER 함수로 **집계만** 연다(유형×V레벨 개수).
  테이블 정책은 admin 전용 그대로 — 테이블을 열면 지문·선지·정답까지 열리고 그건 상품성을 훼손한다.
- 회귀 8: "못 잼 ≠ 없음" · 초등 계단은 조회 실패와 무관 · 분량 판정 · 사다리 정본 불변
- **적용 후 실측: 펼칠 수 있는 권 1/7 → 7/7** (목표 5/7 초과).
  계단별 총 문항 1,212 · 1,255 · 703 · 510 · 1,132 · 1,241 · 465 — 유형별 개수까지 화면에 표시된다.

### 내 교재 — 서가에서 고른 것이 **내 것 공간에 쌓인다** (v06.343, 진행 중)

서가는 고르는 곳인데 **고른 것이 갈 곳이 없었다.** 담기를 눌러도 저장할 표가 없고,
My Library 는 Books·Texts·Decks 세 면뿐이라 교재가 들어갈 자리가 아예 없었다.

- **면 하나 추가** — `Library` 와 `My Library` **양쪽**에 `Textbooks`. 공용 쪽은 고르는 서가,
  내 것 쪽은 담은 것을 관리하는 곳이다(서점 ↔ 책장). 두 배열은 `lib/library/tabs.ts` 하나가 소유하고
  사이드바 서브메뉴가 같은 배열을 읽는다 — 목록을 복사하면 한쪽에만 없는 면이 생긴다.
  `/library/textbooks` 는 그동안 **탭 어디에도 없는 고아 라우트**였다(주소를 아는 사람만 갈 수 있었다).
- **이름을 `MATERIAL_LABEL` 에 넣지 않았다** — 그 표의 키 `MaterialType` 은
  `study_plan_items.material_type` CHECK(`book|article|word_set|script`)와 같은 눈금이다.
  교재 한 권은 DB 행이 아니라 `SERIES_SPINE` 의 **step 번호**라 그 CHECK 에 들어갈 수 없고,
  넣으면 Plan 이 **저장할 수 없는 유형**을 팔게 된다. 그래서 `TEXTBOOK_LABEL` 만 따로 둔다.
- **3축 필터** `shelf-filter.ts` (순수) — 학령 · 수준(V-Level) · 유형.
  축 값은 **재고에서 뽑는다**(손으로 적은 목록은 시리즈가 바뀌면 갈린다) ·
  **축 사이 AND · 축 안 OR**(축 안까지 AND 면 유형 둘만 골라도 대개 0권이 되어 필터가 죽는다) ·
  0건이어도 "조건 N개 해제" 로 되돌아갈 길을 남긴다.
- **담기/빼기** — 서가와 권 상세가 **같은 버튼**을 쓴다(`TextbookPickButton`).
  낙관적 갱신을 하지 않고, 실패하면 그 문장을 화면에 띄운다(`role="status"`).
- **못 읽음 ≠ 0권** — 저장소를 못 읽으면 "고른 게 없다" 가 아니라 "확인하지 못했어요" 라고 적고,
  담기 버튼을 **아예 내지 않는다**(눌러도 반드시 실패할 버튼은 죽은 버튼과 같은 부류다).
- ✅ **적용 완료(2026-08-21)** 마이그레이션 `20260821140000_user_textbook_selections` —
  `(user_id, step, selected_at)` 뿐. RLS 본인 전용 1정책. 되돌리기는 `DROP TABLE` 하나.
- **왕복 회귀 `25-textbook-shelf`** — 담기(쓰기) → **다른 화면에서 읽기** → 원복.
  담기의 저장소는 RLS 본인 전용이라 정책이 어긋나면 **쓰기는 성공하고 조회만 0건**이 된다.
  그때 화면은 조용히 "담은 게 없어요" 다 — 같은 화면에서만 확인하면 절대 못 잡는다.
  필터도 여기서 단언한다(칩을 켜면 목록이 **실제로 줄고**, "조건 N개 해제" 로 되돌아온다).
- **모바일 넘침 수정** — 탭이 넷이 되며 390px 에서 탭줄이 **51px 밀려 페이지 전체가 가로로 흔들렸다**.
  넘침을 탭줄 안에서 처리(`overflow-x-auto`). 실측 51px → 0px.
- 회귀 15: 필터 10(`shelf-filter.test`) + 교재 면 5(`MyTextbooks.test` — 세 상태 구별 · 계단 순서 ·
  사라진 계단 무시). 캡처 하네스에 `/text?view=textbooks` 추가.

### 세 축을 390px 에서도 — 전부 100%, 새 결함 없음 (v06.382)

다섯 축 중 **셋(동선·키보드·정체)은 데스크톱 한 크기에서만** 돌고 있었다.
`CLAUDE.md` 는 모바일 퍼스트(390 → 768 → 1280)를 원칙으로 두는데,
390 에서는 사이드바가 사라지고 하단 탭이 생긴다 — **셸이 통째로 다른 화면**이다.
거기서 한 번도 안 재고 "전수" 라고 부르고 있었다.
(접근성·대비 두 축은 이미 3 뷰포트를 돌고 있었다.)

`SWEEP_VIEWPORT=mobile` 로 세 축에 스위치를 달고 실측:

| 축 | 데스크톱 | 390px |
|---|---|---|
| 동선 | 172/172 | **172/172** |
| 키보드 | 111/111 · Tab 중앙 2 | **111/111 · Tab 중앙 2** |
| 정체 | 180/180 | **180/180** |

**새 결함 없음.** 분모도 그대로라 빠진 화면이 없다 — 모바일 셸이 이 성질들을 깨뜨리지 않는다.
찾은 게 없다는 것도 결과다. 다만 이제 그 말을 **재고 나서** 할 수 있다.

### 다섯 축을 한 번에 — 전부 초록, 서로 깎지 않았다 (v06.381)

축을 하나 더할 때마다 앞의 것이 깎이지 않았는지 봐야 한다. 프로덕션 빌드에서 다섯을 이어 돌렸다:

| 축 | 결과 |
|---|---|
| 동선 (열림·조용·앞길·복귀·연계) | **172/172 = 100%** |
| 접근성 (44px·넘침·이름) | 93/93 측정 · **초과 화면 0** · 넘침 0 |
| 대비/배치 | 94장 · **AA 미달 0** |
| 키보드 (도달·포커스·탈출) | **111/111 = 100%** |
| 정체 (제목·h1·랜드마크) | **180/180 = 100%** |

다섯 다 합쳐 **약 11분**. 남은 콘솔 에러 1건은 `/library/books[mobile-dark]` 의 `NAVIGATION_FAILED`
— 이 환경이 바깥 HTTPS 를 막아 `next/image` 가 표지를 못 받아오는 것과 같은 뿌리다(앱 결함이 아니다).

절차를 [CONVENTIONS](./CONVENTIONS.md) 에 다섯 줄로 적어 두었다.

### 다섯째 축 — 이 화면은 무엇인가 (제목·h1·랜드마크) 86.5 → 100% (v06.380)

네 축이 100% 가 된 뒤 **아무도 안 보는 것**을 찾았다. 기존 축은 전부
"화면 **안에서** 무엇을 할 수 있나" 를 본다. **"이 화면이 무엇인가"** 는 아무도 안 봤다.

그게 없으면 두 사람이 곤란하다 — 탭을 여러 개 열어 두고 공부하는 학습자(제목이 다 같으면
어디가 어딘지 모른다), 스크린리더를 쓰는 학습자(`h1` 이 없으면 "여기가 어디" 를 물을 방법이 없다).

**첫 실측 86.5%** (148 검사). 나온 것:

| | 화면 |
|---|---|
| 제목이 루트 기본값 그대로 | **7곳** (`/dictate` · `/settings` · `/text/new` · `/wordvault` …) |
| 제목이 `· Vocaflow \| Vocaflow` 로 겹침 | template 이 이미 붙이는데 페이지가 또 적었다 |
| 본문에 `h1` 이 없다 | `/library/textbooks` · `/wordvault/review` · `/wordvault/study` |
| `h1` 이 둘 | `/scriptquiz/play` — SessionFrame 이 내는 h1 위에 게임이 또 냈다 |

고친 것:
- 클라이언트 컴포넌트라 `metadata` 를 못 내보내는 9곳에 **형제 `layout.tsx`** 로 이름을 붙였다.
- `QUIZ` 로고는 **제목이 아니라 워드마크**다 → `p`. 완료 문구는 그 아래 단계 → `h2`.
- 보이는 제목이 없는 설계(Calm UI)는 그대로 두고 **프로그램에만** 이름을 붙였다(`sr-only h1`).
  `h2` 상태 안내("지금 복습할 단어가 없어요")와 화면 이름은 **다른 것**이다.

⚠️ **계측기가 두 번 틀렸고 둘 다 "내가 다시 정의해서" 였다.**
- 제목 중복을 **요청한 주소**로 셌다. `/dictate/setup` 은 자료 없이 열면 `/dictate` 로 되돌리고
  `/pairflip/play` 도 그렇다 — 같은 페이지에 서 있으니 제목이 같은 게 맞다.
  **착지한 주소**로 세니 허위 6건이 사라졌다.
- 풀스크린 세션 판정을 `/play/` 접두사로 재정의했다가 `/dictate/session`·`/flashcard/play` 를 놓쳤다.
  앱에는 이미 `isFullScreenRoute` 라는 정본이 있다(사이드바와 FlowNav 가 같이 쓴다). **그걸 쓴다.**

**180/180 = 100%.** 분모를 줄여 얻은 값이 아니다 — 148 → **180 으로 늘었다.**

### 네 축 전부 프로덕션 빌드에서 초록 · 앞 항목의 원인 지목 정정 (v06.379)

앞 항목에서 "프로덕션 서버가 스윕 도중 죽었다" 를 열린 발견으로 남겼다. **재현하지 못했다.**
같은 스윕을 깨끗한 서버에서 다시 돌리니 **93/93 · 콘솔 에러 0 · 서버 생존**이었다.
서버가 살아 있는지 도구 호출을 넘겨 가며 따로 확인했으므로 하네스가 수거한 것도 아니다.

⚠️ **`fetch failed` 의 원인을 두 번 틀리게 짚었다.** 처음엔 "dev 서버 소음",
다음엔 "앱이 렌더 중에 바깥을 부른다" 고 적었다. 실제는 **`next/image`** 다 —
`next.config` 의 `remotePatterns` 에 `www.gutenberg.org` 가 있어 **서버가 표지를 대신 받아온다.**
이 환경은 바깥 HTTPS 가 막혀 있어 매번 실패하고 로그를 남긴다. **앱 결함이 아니다.**
로그 한 줄을 보고 원인을 적기 전에 **어디서 부르는지**를 봤어야 했다.

**한 세션에서 네 축 전부 프로덕션 빌드로 실측**:

| 축 | 결과 | 시간 |
|---|---|---|
| 학습자 훑기 (열림·조용·앞길·복귀·연계) | **172/172 = 100%** | 2.8분 |
| 키보드 (본문 도달·포커스·탈출) | **111/111 = 100%** | 1.9분 |
| 접근성 (44px·넘침·이름) | **93/93 측정 · 초과 화면 0 · 넘침 0 · 콘솔 0** | 2.8분 |
| 디자인 (대비·배치) | **94장 · AA 미달 0** | 3 passed |

넷 다 합쳐 약 10분(dev 로는 약 25분). 절차를 [CONVENTIONS](./CONVENTIONS.md) 에 적었다 —
**서버를 다시 시작할 때 정말 죽었는지 확인하는 것**까지 포함해서. `pkill` 이 Windows 에서
안 먹어 옛 서버가 교체된 빌드를 서빙한 적이 있고, 그때 나온 수치는 전부 버려야 했다.

### 프로덕션 빌드로 재니 dev 가 못 보던 것이 나왔다 (v06.378)

빌드가 살아났으니 스윕을 프로덕션 위에서 돌렸다. `playwright.config` 에
`PLAYWRIGHT_BASE_URL` 이 있으면 **서버를 우리가 띄우지 않게** 했다 —
이 워크스페이스는 여러 세션이 공유하므로 3000 의 dev 서버를 죽이면 남의 실행이 깨진다.
`NEXT_DIST_DIR=.next-sweep` 으로 따로 지어 **빌드와 실행 중인 서버가 서로를 덮지 못하게** 한다.

| | dev | prod |
|---|---|---|
| 학습자 훑기 | 6.5분 · 172/172 | **2.8분** · 172/172 |
| 키보드 | 5.0분 · 111/111 | **1.9분** · 111/111 |
| a11y | 6.9분 | **2.7분** |

⚠️ **dev 에서는 덜 렌더돼 안 보이던 결함이 있었다.** 같은 스윕이
dev 53건/6화면 → prod **83건/9화면**. 새로 드러난 것은 `SegmentControl` 이었다 —
`py-[6px]` 이라 실측 **31px**(기준 44px)이고, 공용 컴포넌트라 `/wordvault`·`/my/words` 등
이 막대를 쓰는 화면이 전부 걸린다. 알약의 시각 높이는 iOS 세그먼트의 정체성이라 그대로 두고
누르는 높이만 44px 로 올렸다 → **83 → 42건 / 6화면, 초과 화면 0.**

⚠️ **중간에 잰 두 번의 수치는 버렸다.** 재빌드 후 `pkill` 이 안 먹어 **옛 서버가 교체된
빌드 디렉터리를 서빙**했고, 클라이언트가 요청한 청크 해시가 디스크의 것과 달라 400 이 났다
(`3354-df6ee…` 요청 / `3354-34332…` 존재). 그 위에서 나온 "콘솔 에러 24 · 미안정 12" 는
화면 이야기가 아니다. 400 의 **주소**를 찍어 보고서야 알았다 — 메시지만으로는 못 고친다.

**열린 발견 — 프로덕션 서버가 스윕 도중 죽었다.** 마지막 `desktop-light` 패스 30개 라우트가
전부 `NAVIGATION_FAILED` 였고, 서버 로그의 마지막은 `www.gutenberg.org` 로의 **바깥 요청 실패**
(`ECONNRESET`)였다. `/library/scripts` 는 그 전에 500 을 한 번 냈다.
인과는 아직 확인하지 않았다 — 다만 **이번 루프 내내 "dev 소음" 으로 넘긴 `fetch failed` 가
바로 이것**이었고, 환경 탓으로 돌린 것이 틀렸을 수 있다. 다음 회차에 재현부터 한다.

### `next build` 가 이틀째 깨져 있었다 — 소스 목록 사본이 갈라져서 (v06.377)

이번 루프 내내 스윕이 `ERR_ABORTED` · `ECONNRESET` 로 흔들렸고, 그 뿌리를 따라가니 빌드였다.
**프로덕션 빌드가 안 되니 모든 스윕이 dev 서버 위에서 돌았고**, dev 는 라우트마다 첫 방문에
컴파일한다 — 예열을 넣어도 42개 라우트를 연속으로 열면 서버가 죽는다.
**타입 하나가 계측 전체를 흔들고 있었다.**

**원인 — 기사 소스 목록이 두 벌이다.** 정본은 `packages/library-pipeline` 의 `SourceKey`,
사본은 `apps/web/src/lib/acp/seed-upsert.ts` 의 `SeedSource`.
2026-08-21 커밋 `fe252c99` 가 정본에만 `futurity` 를 넣었고 사본이 안 따라왔다.

고친 것 (값을 짐작하지 않았다 — 전부 같은 커밋이 근거다):
- `SeedSource` 에 `'futurity'` — 정본을 그대로 따른다
- `SOURCE_REGISTERS.futurity = ['expository', 'news']` — 그 커밋이 "대학 컨소시엄 **연구 기사**"
  라고 적고 있고, 논증 지면을 맡은 것은 PLOS 쪽이다. `nasa`·`nih` 와 같은 모양이다.
- 그러고도 빌드는 **ESLint 오류 3건**에서 멈췄다 — 안 쓰는 import 2 · `let`→`const` 1.
  셋 다 커밋된 것이고 다른 세션의 작업 중인 파일이 아니었다.

**`next build` exit=0.** 이 브랜치가 처음으로 빌드된다.

**가드** `source-key-parity.test.ts` — 두 목록을 **소스로 읽어** 대조한다(손으로 적으면 세 번째 사본이 된다).
`tsc` 도 잡긴 하지만 "어디를 어떻게 맞춰야 하는지" 는 말해 주지 않는다 —
이 가드는 파일명과 할 일을 적어 준다. 값을 되돌려 **빨개지는 것을 확인**한 뒤 남겼다.
`SOURCE_REGISTERS` 누락도 같이 본다.

### 본문까지 Tab 19번 → 2번 (건너뛰기 링크) + 내비 스펙 오진 2건 (v06.376)

앞 항목에서 수치만 남겨 둔 것을 고쳤다 — 키보드 학습자는 **화면을 옮길 때마다**
사이드바·리본·탭바를 지나야 했다. 중앙값 **Tab 19번**(최대 23번).
마우스 쓰는 사람에게 0초인 일이다.

전역 셸 첫머리에 **건너뛰기 링크**를 놓았다. Calm UI 라 평소엔 안 보이고 **포커스되는 순간 드러난다**.
`<main>` 에 `tabIndex={-1}` 을 함께 달았다 — 없으면 주소만 바뀌고 포커스는 그대로라
다음 Tab 이 다시 셸로 돌아간다.

**중앙 19 → 2 · 최대 23 → 6 · 36/37 화면이 그 링크로 닿는다.**

⚠️ **처음엔 링크를 달았는데 눈금이 안 움직였다**(37곳 중 1곳만 링크를 만났다).
계측기가 Tab 을 시작하기 전에 `body.click({x:2,y:2})` 를 하고 있었고, 그 좌표에는 사이드바가 있다.
**클릭한 자리부터 순차 포커스가 이어지므로 그보다 앞에 있는 건너뛰기 링크를 영영 지나쳤다.**
고쳤는데 안 세어지는 것은 다음 사람에게 안 고친 것과 같다 — 이 루프에서 세 번째다.

**SpellForge 탈출구를 화면이 말하게 했다.** Tab 이 힌트라 타이핑 칸에서는 앞으로 못 나간다.
`Shift+Tab` 이라는 문은 앞 항목에서 냈지만 **화면이 말하지 않으면 없는 것과 같다**(WCAG 2.1.2 는
표준적이지 않은 탈출 방법을 **알리라**고 한다). 힌트 줄에 `Shift+Tab 으로 나가기` 를 적었다.
계측기도 두 방향을 다 보고, **Shift+Tab 으로만 나가는 화면은 따로 표시**한다.

**`12-navigation` 2건은 오진이었다** — 화면이 아니라 스펙이 틀렸다:
- 만화 리더의 복귀 링크를 `getByRole('link', {name: /본문/})` 로 찾아 **셸 메뉴를 먼저 집었다**
  (DOM 순서상 사이드바가 앞이다). 리더는 멀쩡한데 `/text`(목록)로 가서 "리더에 갇힌다" 로 찍혔다.
  → 라벨이 아니라 **계약**으로 찾는다: `a[href^="/text/"][href*="mode=read"]`.
  (리더는 `본문`, 대체 화면은 `본문 읽기` 로 라벨이 서로 다르다 — 라벨은 애초에 못 믿을 기준이었다.)
- 메뉴 순회 사이의 `goto('/hub')` 는 **준비 동작**인데, 소프트 리다이렉트와 겹쳐 `ERR_ABORTED` 가 나면
  **메뉴를 하나도 못 눌러 본 채** 죽었다. 중단을 삼키되 정말 `/hub` 에 있는지 확인하고 아니면 한 번 더 간다.

네 축 모두 유지 — 대비 0/94장 · 44px 초과 화면 0 · 동선 172/172 · 키보드 111/111.

### 키보드만 쓰는 학습자 — 새 축 + SpellForge 키보드 함정 (v06.375)

세 축(동선·터치/넘침·대비/배치)이 100% 가 된 뒤 **안 재고 있는 것**을 찾았다.
셋 다 **포인터를 쓰는 사람**을 가정한다. 저장소 전체에 `keyboard.press('Tab')` 이 한 번도 없었다 —
마우스를 못 쓰는 학습자에게 이 앱이 쓸 만한지는 **한 번도 재지 않았다.**

44px 타깃을 키운 것과 이건 다른 문제다. 타깃이 아무리 커도 **Tab 으로 닿지 못하면** 그 기능은 없는 것이다.

`27-keyboard-reach` — 화면마다 셋을 본다:
① 셸을 지나 본문 컨트롤에 닿는다 ② 그 지점에 포커스 표시가 **실제로 그려진다** ③ 거기서 갇히지 않는다.

⚠️ **포커스 표시는 클래스 문자열로 세지 않는다.** `focus-visible:ring-2` 가 적혀 있는 것과
그려지는 것은 다르다 — 상위 규칙에 덮이면 적혀 있어도 안 보인다. `getComputedStyle` 로 잰다.

**찾은 것 — `/spellforge/play` 에서 Tab 을 40번 눌러도 포커스가 한 번도 안 움직였다.**
게임이 `Tab` 을 힌트 단축키로 쓰면서 `document` 전역에서 `preventDefault()` 하고 있었다.
마우스를 못 쓰는 학습자는 나가기·모드 선택 어디에도 닿지 못한다 — **키보드 함정**(WCAG 2.1.2).

단축키는 살리되 빠져나갈 길을 냈다:
- 타이핑 칸에 있을 때의 `Tab` 만 힌트 (게임의 의도는 그대로)
- **`Shift+Tab` 은 언제나 이동** — 함정에서 나가는 문
- 타이핑 칸 밖의 `Tab` 은 평범한 이동

⚠️ **첫 측정의 100% 는 가짜였다.** 라우트마다 새 탭을 열었더니 dev 서버가 죽어
37곳 중 **30곳이 "안 열림"** 으로 빠졌고, 남은 7곳이 전부 통과해 100% 가 찍혔다.
**분모 가드가 잡았다**(§CONVENTIONS "계측값 0 을 성과로 읽지 말 것" 과 같은 뿌리).
탭을 재사용하고, 서버가 죽으면 **그 사실을 말하고 멈추게** 했다.

결과 **111/111 = 100%**. 분모를 줄여 얻은 값이 아니다 — 함정을 열자 못 재던 화면이 재져
분모가 109 → **111 로 늘었는데도** 100 이다.

**다음 후보(측정치)**: 본문까지 Tab **중앙값 19번**(최소 1 · 최대 23). 화면마다 셸을 19번 지나야
본문에 닿는다 — 건너뛰기 링크가 없다. 이번엔 고치지 않고 수치만 남긴다.

### 학습자 전수 훑기 100% (172/172) — 바닥을 100 으로 올림 (v06.374)

터치 타겟을 고치며 체크박스·재생 버튼의 DOM 을 바꿨으니 동선이 깨지지 않았는지 다시 쟀다.
**97.8%** 로 바닥(98) 아래였다.

세 건 중 **셋 다 계측기 문제였다.** 다만 셋의 성격이 달랐다:

**① 보내기만 하는 껍데기를 화면으로 세고 있었다.**
`/my` · `/my/words` 는 "막다른 길", `/my/texts` 는 통과로 찍혔다 —
**같은 한 줄짜리 파일 셋이 서로 다른 판정을 받았다.** 화면이 아니라 리다이렉트 타이밍이다.
→ 런타임이 아니라 **소스로** 판별한다(`redirectOnlyRoutes`). 목적지는 목록에 따로 있으니 거기서 재진다.

⚠️ **첫 판별기가 진짜 화면을 껍데기로 분류했다.** "JSX 가 없으면 껍데기" 로 쟀더니
`/wordvault/review`(34줄 서버 컴포넌트, `<WordVaultStudyClient />` 하나를 돌려준다)까지 들어왔다.
**조용한 면제는 점수를 부풀린다** — 분모에서 빼는 판단은 좁고 명시적이어야 한다.
→ 이 저장소가 순수 껍데기에 **명시**하는 반환형 `never` 를 신호로 쓴다.

**② 파라미터가 있어야 성립하는 화면.**
`/dictate/setup` 은 자료 없이 열면 `router.replace('/dictate')` 로 되돌린다 — 정상 동작이다.
`replace` 는 히스토리를 남기지 않는 것이 목적인데, 그걸 "복귀 실패" 로 셌다.
→ `/dictate/results` 와 같은 부류로 `PARAM_ROUTES` 에 넣었다.

**③ 클릭 실패를 삼키고 있었다.**
`.catch(() => {})` 라 **눌리지 않은 것**과 **죽은 링크**가 똑같이 "눌러도 안 움직인다" 로 찍혔다.
그 말만 보고는 화면을 고칠지 계측기를 고칠지 알 수 없다 — 이제 클릭 오류를 그대로 적는다.

결과 **172/172 = 100%** (라우트 42 · 복귀 검사 제외 19곳).
분모를 줄여서 얻은 100 이 아니라는 것을 확인했다 — 판별기를 좁히며 분모가 170 → **172 로 늘었는데도** 100 이다.
바닥을 **98 → 100** 으로 올린다.

### 44px 미만 터치 타겟 899 → 56 (초과 화면 0) (v06.373)

대비를 0 으로 내린 뒤 **다른 축을 깎지 않았는지** 재다가, 앞 라운드에서 접근성 스윕을
24→32 라우트로 넓힌 결과가 그제야 눈에 들어왔다 — **899건 / 10화면.**
새로 생긴 게 아니라 **처음 재진** 것이다.

⚠️ 그런데 두 라운드를 헤맸다. 리포터가 화면당 **3개만** 찍고 있었다.
"26종" 이라고 말하면서 3개만 보여 주면 **나머지 23개는 없는 것과 같다.**
베이스라인을 넘는 화면은 전부 찍도록 고치자마자 목록이 한눈에 들어왔고, 그 라운드에 끝났다.

`/wordvault/browse` 한 화면이 대부분이었다 (26 → 0):

| 컨트롤 | 실측 | 처치 |
|---|---|---|
| 소스 칩 · 세션 select | `min-h-[36px]` **명시** | 44px |
| 검색 · 난이도 · 정렬 | 38px | 44px |
| 재생 컨트롤 | 34px | 44px |
| 듣기 설정 칩 8종 | 26px | 알약은 그대로, 패딩으로 히트영역만 |
| Active Recall 토글 | 20px | `min-h-[44px]` |
| 전체선택 · 행 체크박스 | 18px · **14px** | 보이는 상자 유지 + 음수 마진 |

⚠️ **세로만 44 로 맞추면 안 된다** — `"1x"` 칩은 높이를 44 로 올린 뒤에도 **폭이 34px** 이었다.
기준은 44 가 아니라 **44×44** 다. 한 축만 보면 좁은 칩은 그대로 남는다.

⚠️ `/my/words` 테마 전환은 `h-11 w-11` 로 적고도 **폭이 36px** 이었다 — 부모 flex 가 줄였다.
`shrink-0` 이 없으면 44 라고 적어도 44 가 아니다.

체크박스·아이콘 버튼은 전부 같은 처치다 — **요소 자체를 44px 로 만들고 음수 마진으로 자리를 되돌린다.**
`::after` 로 히트영역만 얹으면 실제 탭은 커지지만 bounding rect 가 그대로라 **계측기가 못 본다.**

결과: **899 → 56건**(중복 포함) · 10 → 6화면 · **베이스라인 초과 화면 0.**
남은 56건은 전부 문서화된 예외다(3D 코버플로 옆 카드 등, 대체 경로 있음).

### AA 미달 글자 79 → 0 (94장 전수) + 되돌아가지 못하게 래칫 (v06.372)

남은 8건을 원인별로 끝냈다 — 모두 "칠하는 색을 글자로 쓴 것" 의 변주였고,
새 색을 고른 곳은 없다. **저장소에 이미 있는 `-ink` 짝으로 바꿨다.**

| 화면 | 문제 | 처치 |
|---|---|---|
| `/diagnostic/history` `+11` | `--active` 를 종이 위 글자로 3.24 | `--active-ink` |
| `/flashcard/play` `pro` | `--active` 를 tint 위 글자로 2.83 | `--active-ink` |
| `/text` 난이도 `보통` | 형제 둘은 잉크인데 가운데만 원색 | `--warning-ink` |
| `/spellforge/play` `EN` | `--success` 를 tint 위 글자로 4.21 | `--success-ink` |
| 세션 헤더 칩 | 하드코딩 원색을 글자로 4.05·4.28 | `#7C3AED` · `#4F46E5` |
| `/wordvault/browse` 선택 수 | `--learn-mastered` 4.05 | `--learn-mastered-ink` 신설 |
| `/spellforge` "시작하기" | 게임색 위 종이 글자 2.81 | `accentText` 로 **글자만** 잉크(6.08) |
| 카테고리 칩 카운트 | **흰 막이 바탕을 밝혀** 3.34 | `bg-white/25` → `bg-black/25` |

게임 전용색(`#4A9FCF`)은 토큰으로 바꾸지 않았다 — `design-tokens/CLAUDE.md` 절대 금지다.
`HubStartCard` 에 이미 있던 `accentText` 탈출구를 썼고, 채움이 테마를 안 따라가므로 글자도 리터럴로 뒀다.

**래칫**: `AA 미달 글자 0 (전수 캡처 기준)`. 통과 조건은 "위반 0" 이 아니라 **"94장을 찍고 위반 0"** 이다 —
스윕이 죽으면 위반도 0 으로 인쇄되기 때문이고, 이 루프에서 **네 번** 겪었다.
계측 파일이 90장 미만이면 위반이 0 이어도 실패한다.

⚠️ **래칫도 틀렸을 때 빨개지는지 확인했다.** 고친 곳 하나를 실제로 되돌려 전수를 돌렸고,
`"보통" 2.82:1` 을 짚으며 `AA 미달 글자가 다시 생겼다 (94장 기준)` 으로 떨어졌다. 되돌린 뒤 다시 초록.
(주입 검증은 안 됐다 — Playwright 가 실행마다 출력 디렉터리를 지워서 심어 둔 파일이 먼저 사라진다.)

`DESIGN_DECISIONS.md` **ADR-005** 로 기록했다. ADR-004 가 세운 원칙이 틀린 게 아니라
**덜 적용돼 있었다** — 그 방어선이 보던 화면이 전부가 아니었다(15/42).

### 토큰 12개가 두 파일에서 다투고 있었다 — 대비 28 → 18건 (v06.371)

CEFR 배지(`B2` 흰 글자 3.68:1)를 고치려고 값을 찾다가 더 나쁜 것을 봤다.
`--cefr-*` **12개가 `tokens.css` 와 `globals.css` 양쪽에** 있었고,
나중에 로드되는 `globals.css` 가 이기고 있었다.

| | tokens.css | globals.css (이김) |
|---|---|---|
| `--cefr-B2-bg` / `-text` | `#DDE7F7` / `#173F7A` (8.32) | `#3B82F6` / `#FFFFFF` (**3.68**) |
| `--cefr-C1` · `C2` | 밝은 칩 + 진한 글자 | 원색 채움 + 흰 글자 |

⚠️ **그리고 `globals.css` 에는 다크 정의가 없었다.** 즉 라이트는 `globals.css` 에서,
다크는 `tokens.css` 에서 왔다. **한쪽을 고쳐도 다른 쪽이 안 따라온다** — 가장 찾기 어려운 어긋남이다.

⚠️ 이 12개는 앞선 사이클에서 **내가 더한 것**이다. `tokens.css` 만 grep 하고
"참조되는데 정의가 없다" 고 판단했는데, 정의는 `globals.css` 에 있었다.
내가 더한 값은 라이트에서 **줄곧 죽어 있었다.**

→ `globals.css` 쪽 12줄을 지워 `tokens.css`(라이트·다크 한 쌍)로 일원화했고,
`token-parity.test.ts` 에 **이름 충돌 검사**를 더했다. 앞의 parity 검사(`tokens.css` ↔ `colors.ts`)로는
안 잡히는 종류다 — "정의가 두 곳에 있다" 는 것 자체가 결함이므로 이름 겹침을 막는다.

같은 사이클에 고친 실제 결함:
- `/diagnostic` 히어로 "★ 처음이라면 여기서 시작" — 금색 채움 위 **종이 글자 3.24**.
  `--on-active` 신설(라이트 잉크 5.28 · 다크 잉크 7.57). `--on-p` 가 하는 일을 금색에도 한 것.
- `/wordvault/browse` "전체 듣기" — 흰 글자 on `#3B82F6` **3.68**.
  색을 새로 고르지 않고 저장소에 이미 두 테마 계산이 끝난 `--p`/`--on-p` 짝으로 바꿨다.
- 단어장 커버 `NEW` 배지 — 흰 글자 on `#AF52DE` **4.13** → 같은 커버의 "내 학습" 칩과 같은 규약
  (밝은 칩 + 진한 글자, `--ios-purple-tint`/`-ink` 7.06).

**대비 28 → 18건**(고유 8).

### 웹만 고치고 앱은 흐린 채 뒀다 — 토큰 두 출처 대조 가드 (v06.370)

`packages/design-tokens/CLAUDE.md` 는 **절대 금지**에 이렇게 적어 두고 있었다 —
"웹/앱 한쪽만 수정 — 두 출처가 불일치하면 디자인이 깨짐". 웹은 `tokens.css` 를,
모바일(RN)은 `colors.ts` 를 읽는다.

**그 규칙을 내가 어겼다.** 대비 사이클에서 `--t2` 0.62→0.74 · `--t3` 0.38→0.62 를
`tokens.css` 에서만 고쳤다. 웹은 AA 로 올라갔고 **모바일은 그대로 흐린 채 남았다.**
아무 오류도 안 났다 — 그래서 몰랐다.

실측 결과 드리프트는 **6건**이었고 그중 2건은 내 것이 아니었다:

| | tokens.css | colors.ts |
|---|---|---|
| 라이트 `--t2` · `--t3` | 0.74 · 0.62 | 0.62 · 0.38 |
| 다크 `--t2` · `--t3` | 0.74 · 0.62 | 0.62 · 0.38 |
| 라이트 `--info` | `#50697F` | `#5B7A98` |
| 다크 `--error` | `#A8443A` | `#C25E54` |

뒤의 둘은 **언제부터 갈라졌는지 아무도 모른다.** 그게 이 실패의 성질이다.

`tokens.css` 를 정본으로 6건을 맞추고, **문서가 지키던 것을 기계가 지키게** 했다 —
`token-parity.test.ts` 가 두 파일을 파싱해 **양쪽에 다 있는 토큰**만 대조한다
(`colors.ts` 는 부분집합이라, 없는 것을 없다고 실패시키면 토큰 하나 더할 때마다 울어서 결국 꺼진다).

가드 자체도 두 방향으로 확인했다 — 값을 되돌려 **빨개지는 것을 보고** 다시 초록을 확인했다.
그리고 파싱이 조용히 빈 객체를 돌려주면 **0건 비교로 통과**하므로, 대조 대상 수의 하한을
따로 단언한다(§CONVENTIONS "계측값 0 을 성과로 읽지 말 것").

### 채점 4버튼이 2.06:1 이었다 — 대비 50 → 28건 (v06.369)

계측기가 위치를 말하기 시작하자 진짜 결함이 바로 나왔다. 가장 나쁜 것은
**`/flashcard/play` 의 채점 4버튼** — "몰라요 / 어려워요 / 기억나요 / 너무 쉬워요".
**2.06 · 2.18 · 3.52 · 3.6:1.** 학습자가 하루에 가장 많이 누르는 버튼이고,
Active Recall 의 인출 강도를 스스로 신고하는 자리다. 여기가 안 읽히면 채점이 흔들린다.

원인은 지난 항목과 같다 — `--srs-1~4` 는 **면을 칠하는 색**인데 라벨 글자로 그대로 얹었다.
`--srs-N-ink` 4개를 테마별로 두고 라벨만 바꿨다(라이트 6.29~6.42 · 다크 6.03~9.24).

⚠️ **직전 항목에서 만든 `--ink-amber` / `--ink-green` 은 중복이었다.**
이 저장소에는 이미 `--active-ink`(#7E5A1B) · `--success-ink`(#1F6B49) ·
`--warning-ink` · `--error-ink` · `--info-ink` · `--ios-*-ink` 가 **같은 규약으로** 있었다.
찾아보지 않고 새로 만들었다. 두 토큰을 지우고 기존 것으로 되돌렸고,
`--srs-2-ink`/`--srs-3-ink` 도 그 값에 맞췄다. **토큰을 새로 만들기 전에 `-ink:` 를 grep 할 것.**

같은 부류로 함께 고친 것:
- `/wordblitz` 순서 표시 `01/02/03` — `--success` 원색을 글자로(4.40) → `--success-ink`
- `/settings` "준비중" 칩 — 금색 원색을 tint 위 글자로(2.78) → `--active-ink`
- `/pairflip` 순서 표시 — 직전 항목의 `--ink-amber` → `--active-ink`

**대비 50 → 28건**(고유 12건). 남은 것은 전부 **원색 위 흰 글자** 계열(배지·CTA)로,
글자가 아니라 **바탕을 어둡게 해야 풀리는** 부류다.

### 어디인지 말하지 않는 발견은 고칠 수 없다 — 그리고 16건은 가짜였다 (v06.368)

남은 최대 그룹 16건(`rgba(26,23,20,0.74) on rgb(112,109,106)` 2.66:1)을 고치려는데
**어느 요소인지 알 수가 없었다.** 계측기가 글자와 색만 찍고 있었기 때문이다.
색을 역산해 "`--t3` 를 배경으로 쓴 것" 까지 좁히고 코드를 읽어 **세 번 추정했고 세 번 다 빗나갔다.**

그래서 계측기가 **위치**를 말하게 했다 — 글자가 있는 요소의 경로와,
**그 배경색을 실제로 칠한 조상**(대개 여기가 고칠 곳이다). 위반한 것에만 계산하므로 비용은 0이다.

⚠️ **찍자마자 계측기가 스스로를 고발했다.**

```
[대비] 2.66:1 "2026년 8월 17일 AM 11:56" — rgba(26,23,20,0.74) on rgb(112,109,106)
  ↳ 배경을 칠한 곳: ... > article.rounded-ios-xl.bg-[var(--bg)]
```

`--bg` 는 `#FBFAF6` 다. 그 위의 `--t2` 는 7 을 넘는다. **위반이 아니었다.**

**원인 — 배경 캐시가 조상을 오염시켰다.** 조상 사슬을 타고 올라가 불투명 바닥을 만나면
**사슬 전체**에 "맨 아래 요소 기준으로 합성한 한 색" 을 캐시했다. 사슬에는 반투명 배경을 가진
자손도 들어 있으니 **그 자손의 tint 가 조상의 배경으로 저장**되고, 같은 조상 아래 다른 글자가
남의 tint 를 뒤집어썼다. → 사슬을 **뒤에서 앞으로** 되짚으며 각 요소에 자기 것부터의 합성만
저장한다. 조상은 자손의 tint 를 물려받지 않는다.

**대비 64 → 50건.** 사라진 14건은 고친 게 아니라 **처음부터 없던 것**이다
(오염이 반대로 가려 놓았던 2건은 새로 드러났다).

이 하네스가 가장 경계해 온 실패를 캐시가 저지르고 있었다 —
**틀린 숫자를 맞는 숫자처럼 인쇄하는 것.** 위치를 찍게 만들지 않았으면 못 찾았을 것이고,
색만 봤을 땐 세 번 다 화면을 의심했다.

⚠️ 곁가지로 `\s` 가 또 먹혀 클래스 문자열을 **문자 `s` 로 쪼개고** 있었다
(`rounded-ios-xl` → `rounded-io` + `-xl …`). 백슬래시 없는 `[ ]+` 로 바꿨다.

### 강조색을 글자로 쓰면 안 된다 — 대비 79 → 64건 (v06.367)

남은 79건을 원인별로 묶으니 **한 부류가 압도적**이었다: 게임·모듈 **강조색을 글자색으로** 쓴 것.

**최악 1.89:1 — pairflip 의 순서 표시 `01/02/03`.** 강조색 `#F59E0B` 를 `--bg2` 위에
글자로 얹었다. 이 하나에서 **15건**이 나왔다.

⚠️ **한 색으로는 두 테마를 못 맞춘다** (실측):

| 색 | 라이트 최악 | 다크 최악 |
|---|---|---|
| `#F59E0B` | **1.89** | 8.53 |
| `#B45309` | 4.42 | **3.65** |

→ **면을 칠하는 색과 글자로 쓰는 색을 분리한다.** 강조색은 그대로 두고
`--ink-amber`(라이트 `#8A5A12` 4.80 · 다크 `#FBBF24` 8.93) ·
`--ink-green`(라이트 `#15603F` 6.14 · 다크 `#6FC49B` 7.13)를 새로 둔다.
`--on-p` 가 하는 일과 같은 것을 강조색에도 한 것이다.

⚠️ **라우트를 넓히자 캡처가 죽었다.** 리다이렉트 화면(`/my`·`/library`)에서 모션 정지용
`addStyleTag` 도중 내비게이션이 일어나 "Execution context was destroyed" 로 **스윕 전체**가
멈췄다. 모션 정지는 **찍는 그림을 안정시키는 장식 단계**지 측정이 아니라 실패를 삼킨다 —
삼키면 안 되는 것은 측정이지 측정을 돕는 준비가 아니다.

**CONVENTIONS 에 두 규칙 추가** — 이번 루프에서 반복해 밟은 것들이다.
- **계측값 `0` 을 성과로 읽지 말 것.** 한 루프에서 **세 번** 밟았다(스윕 타임아웃 2회 ·
  내 grep 이 스펙의 경고 줄을 지운 것 1회). 0 을 보면 먼저 **분모**를 본다.
  버튼 하나를 고쳤는데 1,664 → 0 이면 그건 개선이 아니라 측정 실패다.
- **계측기가 볼 수 없는 방식으로 고치지 말 것.** `::after` 히트영역은 실제 탭을 키우지만
  bounding rect 는 그대로라 위반 수가 안 줄어든다 —
  "고쳤는데 안 세어지는" 것은 다음 사람에게 "안 고쳤다" 와 같다.

### 디자인 축도 전 화면으로 — 그리고 앞 사이클 진단을 정정한다 (v06.366)

⚠️ **먼저 정정.** v06.365 에 "a11y 스윕도 예열이 없어 흔들린다" 고 적었는데 **틀렸다.**
그 스펙에는 **이미 예열 패스가 있고**, DOM 이 조용해질 때까지 기다리는 안정화까지 있다 —
같은 교훈("고정 대기도 요소 등장도 부족했다, 241↔182 로 흔들렸다")이 주석에 적혀 있다.
다시 재니 **896 · 899 · 899** 로 안정적이다. 내가 봤던 "0건" 은 그 스펙이 스스로 걸러 낸
로그아웃/불안정 상태였고, **내 grep 이 그 경고 줄을 지우고 있었다.** 도구가 말하고 있었는데
내가 안 읽었다.

**디자인 캡처를 15/42 → 42/42 로.** 27개 화면이 대비·넘침을 **한 번도 안 재봤다.**
`nocards` 는 붙이지 않았다 — 재 보지도 않고 면제하는 것이 되기 때문이다.
**레지스트리 정합 테스트**를 붙여 앞으로의 누락은 사람이 아니라 기계가 잡는다
(`10-a11y-sweep` 은 24/42 였고, 그 파일 스스로 위험을 적어 두고도 겪었다).

⚠️ 라우트를 넓히니 84장이 되어 **420초 예산을 넘었다** — 그러면 계측이 한 줄도 안 찍혀
**"0건" 으로 보인다**(또 밟았다). 예산 1,200초로 올려 94장 완주.

**넓히자 대비 미달 56 → 106건.** 새로 드러난 화면: `/diagnostic/history` 8 ·
`/text/new` 5 · `/flashcard/play` 5 · `/wordvault/study`·`/review` 각 4.

**최악은 1.52:1 — `--t4` 였다.** 토큰 표가 "quaternary ink" 라고만 적어 둔 그 색이
**실제 글자에 쓰이고 있었다**: "(선택)" · POS 첨자 · StudyMode 라벨 · 검색 placeholder.
알파 0.20 이라 어떤 지면에서도 1.52:1 이다.
- `text-t4` 21곳 중 **17곳을 `text-t3` 로** 올렸다(`--t3` 는 v06.359 에서 AA 4.63 이 됐다).
- **4곳은 남겼다** — `disabled` 상태의 입력·셀렉트다. WCAG 1.4.3 이 명시적으로 면제한다.
  면제를 아는 것과 모르고 놔두는 것은 다르므로 이유를 코드에 적었다.

**실측 106 → 79건.**

### 접근성 스윕을 전 화면으로 — 그리고 **첫 확정 결함** (v06.365)

4사이클. 사용성·디자인 축이 **전 화면을 안 보고 있었다**.

| | 보던 화면 | 전체 |
|---|---|---|
| `10-a11y-sweep` (터치·막다른길) | **24** | 42 |
| `91-hub-design-capture` (대비·지면) | **15** | 42 |

`/library/textbooks` 처럼 **이번 주에 만든 화면**도 접근성 스윕에 없었다.
→ a11y 스윕의 손으로 적은 목록을 **공용 레지스트리**(`utils/learner-routes`)로 교체.
세션 화면(기록이 남는다)과 파라미터 필요 화면만 빼고 **32개**를 본다.

**첫 확정 제품 결함 — `/wordvault/browse` 터치 타깃 278종.**
단어 행의 발음 버튼이 `h-7 w-7`(**28px**)이고 화면에 단어가 252개다.
모바일에서 **252개의 못 누르는 표적**이었다. 이 화면은 손으로 적은 목록에 없어서
**한 번도 안 재졌다** — 넓히자마자 나왔다.

- 고침: 버튼 자체를 **44px**로 만들고 음수 마진으로 차지하는 자리는 28px 로 되돌린다.
  시각 크기·행 밀도 그대로(행 밀도가 이 목록의 읽기 속도를 정한다).
- 실측 **278종 → 26종**(남은 26은 필터 칩 36px). 전체 1,664건 → 896건.

⚠️ **첫 시도는 `::after` 로 히트영역만 얹었다.** 실제 탭은 커졌는데 **계측기가 못 봤다** —
요소의 bounding rect 는 그대로 28px 이라 278건이 그대로 찍혔다.
"고쳤는데 안 세어지는" 것은 다음 사람에게 "안 고쳤다" 와 같다. 그래서 요소 자체를 키웠다.

⚠️ **a11y 스윕도 예열이 없어 흔들린다.** 같은 코드로 1,664 → **0** → 896 이 나왔다.
그 "0" 을 하마터면 성과로 보고할 뻔했다 — 내가 v06.351 에 적어 둔
**"측정 실패가 아니라 측정 안 함"** 그대로다. 이 스펙의 베이스라인도 그런 값들로 씨를 뿌린 것이라,
다음 사이클에 예열을 넣고 베이스라인을 다시 잡아야 한다.

**새로 드러난 위반의 베이스라인을 채우지 않았다.** 채우면 초록이 되지만 그건 수용이다 —
`/wordvault/browse` 26 · `/my/words` 4 는 **고쳐서** 내릴 것이다.

### 전수 훑기 98.3~100% — 그리고 **결함은 전부 내 계측기에 있었다** (v06.364)

3사이클. Cycle 2 가 "다음에 볼 것" 으로 남긴 **뒤로가기 4건**을 가렸다.

**전부 계측기였다. 그것도 한 줄짜리 원인이었다.**
한 탭으로 42개 라우트를 순회했더니 히스토리에 42칸이 쌓였고, `goBack()` 이
**직전에 훑은 라우트로** 갔다 — `/dictate` 의 뒤로가기가 `/diagnostic/history`
(알파벳 직전 라우트)로 찍힌 것이 증거다. **라우트마다 새 탭**을 열어 히스토리를
[이 화면, 목적지] 둘로 만들자 사라졌다.

가는 길에 둘 더 고쳤다:
- **`goto` 가 아니라 클릭한다.** 학습자는 주소를 치지 않는다. 전체 로드는 히스토리가
  다르게 쌓이고, 목적지가 리다이렉트하면 뒤로가기가 엉뚱한 데로 간다.
- **고정 대기(1.2초)를 이동 대기로.** dev 는 목적지를 그때 컴파일한다 —
  "눌러도 안 움직인다" 가 화면마다 찍혔는데 **기다림이 짧았던 것**이다.

| 실행 | 성공률 |
|---|---|
| 히스토리 격리 전 | 82.1% |
| 격리 후 ① | **100%** |
| 격리 후 ② | **98.3%** |

⚠️ **100% 를 만들려고 더 조정하지 않았다.** 남은 셋(`/text`·`/my/words` 의 "막다른 길",
`/comics` 의 "뒤로가기 → blank")은 클라이언트 렌더가 늦게 붙거나 `replace` 로 이동해
뒤로 갈 곳이 없는 경우다. 기준을 계속 느슨하게 하면 **답에 계측기를 맞추는 것**이 되고,
그 순간 이 숫자는 아무것도 지키지 않는다. 바닥은 재현되는 98 로 두고,
**올릴 때는 화면을 고쳐서 올린다.**

**3사이클 통틀어 확정된 제품 결함 0건.** 계측기는 일곱 번 고쳤다 —
`ERR_ABORTED`(소프트 리다이렉트) · `<main>` 없는 화면 · dev 서버 사망 ·
리다이렉트의 뒤로가기 · 파라미터 필요 화면 · 히스토리 오염 · 게임 화면의 본문 길이.
**앱의 동선은 멀쩡했고, 멀쩡하지 않은 건 내 측정이었다.**

⚠️ **이 100% 가 무엇이 아닌지**: 다섯 검사(열림·콘솔·앞길·복귀·연계)를 통과했다는 뜻이지
"학습자에게 100% 효율" 이라는 뜻이 아니다. 사용성·디자인 축은 다른 스펙이 따로 재고
(`10-a11y-sweep` 터치 타깃 · `91-hub-design-capture` 대비·지면), 그 둘은 아직
**전 화면을 안 본다** — a11y 스윕은 손으로 적은 25개만 본다(실제 42개).
그 격차를 메우는 것이 다음 사이클이다.

### 전수 훑기가 재현된다 — 그리고 이 브랜치는 **빌드가 깨져 있다** (v06.363)

2사이클. 1사이클의 계측기를 믿을 수 있게 만드는 것이 전부였다.

**재현 확보 — 연속 세 실행 95.5% · 95.9% · 95.5%** (그 전 96.7% / 54.9%).
원인은 **dev 서버의 라우트별 첫 컴파일**이었다. 첫 방문을 재면 컴파일 지연이
"본문이 비어 있다"·"막다른 길" 로 기록된다. → **예열 후 두 번째 방문부터 잰다.**

⚠️ **정석은 프로덕션 빌드 위에서 재는 것인데, 이 브랜치는 `next build` 가 실패한다.**

```
./src/app/api/admin/articles/futurity-feed/route.ts:51:42
Type error: Argument of type '"futurity"' is not assignable to parameter of type 'SeedSource'.
```

커밋된 상태이므로 **지금 이 브랜치는 배포 빌드가 안 된다.** `SeedSource`(`lib/acp/seed-upsert`)와
`SourceKey`(`library-pipeline/curation-spec`) 두 유니온에 `futurity` 가 없고,
`SOURCE_REGISTERS` 에도 항목이 없다. 다른 영역의 미완 기능이라 **값을 추측해 고치지 않았다** —
레지스터 값은 그 도메인이 정할 일이다. 기록만 남긴다.

**공용 라우트 레지스트리** `tests/e2e/utils/learner-routes.ts` — 파일 시스템에서 읽는다.
`10-a11y-sweep` 은 라우트 **25개를 손으로** 들고 있고, 그 파일 스스로 이렇게 적어 뒀다 —
"새 라우트를 만들면서 접근성 스윕에 넣지 않으면 그 화면은 영영 안 재진다"(이미 겪었다).
실제 정적 학습자 라우트는 **42개**다. 목록을 만드는 일을 사람에게 맡기지 않는다.

**검사 ⑤ 연계 추가** — 앞길의 **목적지**가 진짜 화면인가. ④(복귀)만으로는
링크가 살아 있고 그 끝이 깨져 있어도 초록이다.

⚠️ **지금까지 확정된 제품 결함은 0건이다.** 눈에 걸린 것이 매번 계측기 문제였다:

| 처음 본 것 | 실제 |
|---|---|
| `/dictate/results` 막다른 길 | `sessionId` 없으면 `router.replace('/dictate')` — **정상 동작**. 파라미터가 필요한 화면을 맨 주소로 물었다 |
| `/library`·`/comics` 4검사 실패 | 소프트 리다이렉트의 `ERR_ABORTED` |
| `/wordvault` 4곳 "리다이렉트 → /" | dev 서버가 스윕 도중 죽었다 |
| 리다이렉트 화면 뒤로가기 실패 | 정답이 애매한 자리 — 분모에서 제외 |

**다음 사이클에 볼 것**: `뒤로가기 → 다른 곳` 4건(`/comics` → `/arcade` ·
`/dictate` → `/library/books` · `/dictate/setup` → `/dictate` · `/my/books` → `/text/…`).
실행마다 조금씩 달라 아직 확정 못 했다 — 실제로 학습자가 뒤로 눌렀을 때 엉뚱한 데로
가는 것이라면 이번 목표에서 가장 큰 건이다.

### 학습자 전수 훑기 — 계측기부터 만들었고, **아직 못 믿는다** (v06.362)

새 목표(모든 화면의 기능·이동·복귀를 제3의 학습자 기준으로 전수 검사, 성공률 100%)의
1사이클. 먼저 **무엇을 성공으로 셀지**를 고정하고 베이스라인을 쟀다.

**베이스라인 — 기존 e2e 는 학습자 화면의 절반만 연다.**
정적 학습자 라우트 44개 중 **22개(50%)** 만 어떤 스펙이든 한 번이라도 `goto` 한다.
`/pairflip` · `/scriptquiz` · `/settings` · `/reports` · `/my/*` · `/wordvault/review` 등
**22개는 깨져도 아무도 모른다.** 개별 스펙은 자기 시나리오만 깊게 보므로
"전부 한 번씩" 을 보는 자리가 따로 필요하다.

**성공률의 정의** — 화면마다 넷을 본다. 성공률 = 통과 / **실제로 잰** 검사.
① 열린다(에러·404 아님) ② 콘솔 에러 0 ③ 앞길이 있다 ④ 뒤로가기로 돌아온다.
라우트 목록은 **파일 시스템에서 읽는다** — 손으로 적으면 화면이 늘어도 커버리지가 안 는다.

⚠️ **그런데 이 계측기를 아직 못 믿는다. 같은 코드로 연속 두 번 돌려 96.7% 와 54.9% 가 나왔다.**
재현되지 않는 측정은 성적표가 아니라 소음이다. 그래서 **수치를 성과로 보고하지 않는다.**

가는 동안 계측기를 네 번 고쳤고, 고칠 때마다 "제품 결함" 이 계측기 결함으로 밝혀졌다:

| 처음 본 것 | 실제 |
|---|---|
| `/library`·`/comics`·`/my/books` 4검사 전부 실패 | 소프트 리다이렉트의 `ERR_ABORTED` 를 예외로 받았다 (`12-navigation` 이 이미 주석으로 남긴 함정인데 안 읽었다) |
| `/diagnostic` 등 "막다른 길" | `<main>` 만 봤다 — 쓰지 않는 화면이 있다 |
| `/wordvault` 4곳 "리다이렉트 → /" · `/wordblitz` 연결 끊김 | **dev 서버가 스윕 도중 죽었다.** 앱은 멀쩡했다 |
| 리다이렉트 화면의 "뒤로가기 실패" | 뒤로가기의 정답이 애매한 자리다 — 통과도 실패도 아닌 **분모에서 제외**로 바꿨다 |

**원인 가설**: dev 서버는 라우트마다 첫 방문에 컴파일한다. 42개를 연속으로 때리면 서버가
흔들리고(실제로 죽었다) 클라이언트 렌더가 준비되기 전에 판정하게 된다.

→ 스펙은 **`LEARNER_SWEEP=1` 일 때만** 돌게 막아 두었다. 재현 안 되는 스펙을 상시로 두면
**빨간 스펙에 익숙해지게** 만들어 다음 진짜 실패를 가린다.
다음 사이클에 **프로덕션 빌드**(`NEXT_DIST_DIR=.next-sweep`)를 띄우고 그 위에서 잰다 —
라우트별 컴파일이 없으니 재현될 것이다. 재현되면 상시로 올리고 래칫을 건다.

### 순차 진행 ④ 담기가 오늘의 학습을 조준한다 — 굶기지는 않는다 (v06.361)

v06.354 에서 **거짓이라 지웠던 문장**을 이번에 **참으로 만들었다**
(`20260822110000_prescribe_today_textbook_steer`).

**설계에서 가장 중요한 한 가지: 사다리를 SQL 에 다시 적지 않았다.**
step → V-Level 의 정본은 `SERIES_SPINE` 이다. DB 에 복사하면 눈금이 둘이 되어 반드시 갈린다 —
`user_textbook_selections` 가 step 번호만 저장한 이유와 같다.
→ `prescribe_today(p_user_id, p_v_levels int[])` 로 **호출부가 풀어서 넘긴다.** SQL 은 레벨만 안다.

**담기는 조준할 뿐 굶기지 않는다.** 담은 교재 레벨로 5문항을 못 채우면 예전 방식으로 채운다.
교재를 담았다는 이유로 오늘 할 것이 줄면 담기는 벌이 된다.
실측(step 6 기준): 전체 풀 895 → 조준 시 **307** · 빈 레벨이면 폴백으로 여전히 5문항.

- 응답에 `steered` 를 실어 **화면이 "담기가 무엇을 바꿨는지" 를 말할 수 있게** 했다.
  안 그러면 또 보이지 않는 기능이 된다.
- 기존 1인자 함수는 DROP 하고 2인자로 만들었다 — 기본값이 있어 `prescribe_today(uuid)` 호출은
  그대로 동작하고, 둘을 함께 두면 "function is not unique" 로 호출이 깨진다.

⚠️ **가드가 초록인 채로 통과했다 — 가드가 틀렸다.**
`promise-guard` 첫 판은 "어떤 모듈이 `user_textbook_selections` 라는 **문자열**을 담고 있나" 를 셌는데,
배선이 붙었을 때 처방 모듈은 그 표를 직접 읽지 않고 `fetchMyTextbooks()` 를 통해 읽었다.
**문자열이 아니라 계약을 봐야 한다** — 지금은 `prescribe_today` 호출이 `p_v_levels` 를 넘기는지 본다.
그리고 **양방향**이 됐다: 배선이 없으면 약속을 막고, 배선이 있으면 "바꾸지 않는다" 가
남아 있는 것을 막는다. 폴백(`NOT v_steered`)이 사라지는 것도 함께 잡는다.

문구는 이번이 **세 번째 판**이다 — 거짓 → 사실(보수적) → 사실(배선 후).
여전히 적지 않는 것: '단원' 단위 배정(그런 단위가 처방에 없다)과 "이 권의 모든 유형"
(오늘의 학습은 글 순서·문장 삽입만 낸다).

### 순차 진행 ③ 표지가 자기 색에서 잉크를 정한다 (v06.360)

**표지 팔레트가 아니라 표지 *잉크* 가 문제였다.**
`bookCover()` 는 `textTone` 을 돌려주는데 **무조건 `'light'`** 였고, 화면은 그 필드를
**아예 읽지 않은 채** `text-white` 를 박아 뒀다. 옅은 표지에서 제목이 **1.1:1** —
`drop-shadow` 가 읽히게 도와주고 있었지만 **그림자는 WCAG 가 세지 않는다.**

- `inkFor()` — 표지색의 상대 휘도로 잉크를 정한다. **두 색 중 밝은 쪽**으로 판정한다
  (그라디언트 한쪽에서 글자가 사라지면 그 표지는 실패한 것이다).
- `GradientBookCover` 가 `textTone` 을 **실제로 읽는다** — 제목·부제·프레임·장식 룰이
  함께 뒤집힌다(테두리만 남아 사라지지 않도록). 호출부 3곳이 판정을 넘긴다.
- `RecommendedBooks`(`/wordvault`)도 같은 규칙 — 여기가 1.1:1 의 진원지였다.

⚠️ **잉크를 뒤집는 것만으로는 부족했다 — 사각지대가 있다.**
흰 글자는 L ≤ 0.183, 어두운 잉크는 L ≥ 0.214 를 요구한다. **그 사이는 어느 잉크도
4.5:1 을 못 넘는다.** `hsl(215 22% 52%)`(L=0.209)가 정확히 거기 있었다(흰 4.05 · 검은 4.44).
명도 표를 통째로 내려 봐도 **사각지대에 빠지는 조합이 자리만 바뀐다**
(-2%p → hue38 · -4%p → hue189 …). 색상마다 휘도가 달라 한 숫자로는 못 맞춘다.
→ `darkenUntilSafe()` — **생성 표지는 안전한 밝기까지 스스로 내려간다.** 색상·채도는 그대로.

⚠️ **팔레트 8개 중 3개**(hue 189/200 · 38/28 · 160/175)가 40조합 중 **14조합**에서
흰 글자 AA 에 미달했다. `vLevelLightness` 표는 HSL 명도인데 **같은 명도라도 색상마다 휘도가 다르다** —
파랑 44% 는 어둡고 청록·호박 44% 는 밝다. 표를 고치는 대신 보정으로 해결했다.

- 회귀 7(`book-cover-ink`) — 단언을 "무슨 톤을 골랐나" 가 아니라 **"고른 톤이 실제로 통과하나"** 로 둔다.
  첫 판이 "생성 표지는 전부 흰 글자" 를 단언했다가 실패했고, **그 실패가 위 사각지대를 찾아 줬다.**

**전 화면 실측 92건 → 56건**(라이트 28 · 다크 28). 남은 것은 배지·마커 계열
(`NEW` 4.13 · 수준 뱃지 3.34 · 순서 마커 01/02/03 4.4 · CTA 2.81) — 전부 **하드코딩 강조색 + 흰 글자**,
Cycle 12 에서 탭 강조색을 고친 것과 같은 부류다.

⚠️ **하마터면 "0건" 으로 보고할 뻔했다.** 스윕이 로그인 튕김으로 죽어 계측이 한 줄도 안 찍혔고,
그게 화면상 "0건" 으로 보였다 — v06.351 에 적어 둔 **"측정 실패가 아니라 측정 안 함"** 그대로다.
인증 상태를 새로 만들고 다시 재서 40장·28건을 확인했다.

### 순차 진행 ① 분류 트리 공개 · ② 잉크 계단 AA (v06.359)

**① `dictionary_categories` 를 비로그인에게 연다** (`20260822013136`).
익명은 발행 세트 747개를 정상적으로 보는데 라벨이 오는 표는 `authenticated` 전용이라
**0행**이 내려갔고, 화면은 그것을 "아직 매핑 안 됨" 으로 읽어 legacy 자유문구로 내려앉았다.
기존 정책의 조건(`is_active = true`)을 **그대로** 써서 anon 에 더 넓게 열지 않았다.
실측: 익명 566행 노출 · 비활성 유출 0.

**② 잉크 계단을 AA 로 — `--t2` 0.62→0.74 · `--t3` 0.38→0.62.**
`--t3` 만 올릴 수 없었다. 세 지면(`--bg`/`--bg2`/`--bg3`) × 두 테마에서 AA 를 넘는
**최소 알파가 0.62 인데 그건 당시 `--t2` 의 값**이라, 그대로 올리면 두 단계가 하나로 붕괴한다.
둘을 함께 올려 간격을 유지했다(t3 최악 4.63 · t2 최악 6.80 · 1.47배).

전 화면 실측 **92건 → 58건**(라이트 30 · 다크 28). `--t3` 원인 72건이 **전부 사라졌다.**

⚠️ **재면서 다른 결함 둘이 드러났다.**

- **CEFR 배지 토큰 12개가 아예 없었다.** `CEFRBadge` 가 `var(--cefr-A1-bg)` 식으로 참조하는데
  `tokens.css` 에 **하나도 정의돼 있지 않았다.** 정의되지 않은 `var()` 는 예외를 내지 않고
  **선언을 통째로 버린다** — 배지는 배경을 잃고 글자색을 조상에서 상속받았다.
  하드코딩을 피하려고 `var()` 를 썼는데 토큰이 없어서 오히려 색을 잃은 경우다.
  12개 정의(A 초록 · B 파랑 · C 보라~자주, 전부 AA 6.83~9.18).
- **흰 칩에 테마 잉크를 짝지어 놨다.** `bg-white/95` + `text-[var(--t1)]` —
  라이트에서는 멀쩡하지만 다크에서 `--t1` 이 크림으로 뒤집혀 **1.08:1**(사실상 안 보임).
  `/library`·`/library/books` 에서 28건. 표지 위 칩은 표지와 함께 **테마 밖**이므로
  고정 토큰(`--chip-cover-bg/ink/brand`)을 두고 다크에서 재정의하지 않는다. 4파일 수정.

**새 유형 4종에 설명을 붙였다** — `unit_vocab`·`blank_word`·`unit_grammar`·`grammar_fix`
(문항 10,239). 사다리에 뒤늦게 들어온 유형이고 **드리프트 가드가 잡아 냈다**
(`type-guide.test` — 없으면 화면에 raw 코드가 노출된다). 설명은 payload 실측에 맞췄다.

### ✅ 마이그레이션 적용 — 익명 서가 복구 + **네 번째 분류 축** (v06.358)

승인 후 `20260822090000` 적용(함수 2개, 테이블 변경 없음).

**① 비로그인 서가 5/7 → 7/7.** `textbook_curriculum_vocab_counts()` 로 익명도 초등
생성 가능 수를 본다(익명 실측 808 / 1,211 / 1,006). "재고 확인 중" 3건이 사라지고
일곱 권 전부 "지금 펼치기" 다. 낱말은 나가지 않는다 — 태그별 개수뿐이다.

**② 지문 출처 — 네 번째 분류 축.** `textbook_shelf_sources()` 집계로
"이 권의 지문은 어디서 왔나" 를 서가에서 고를 수 있다. 실측 15갈래:

| 갈래 | 문항 | 갈래 | 문항 |
|---|---|---|---|
| 창작(original·compose) | 1,401 | 데이터·사회(owid) | 248 |
| 쉬운 백과(simple_wikipedia) | 1,128 | 기후·해양(noaa) | 241 |
| 도서(book) | 808 | 뉴스(voa) | 212 |
| 논문(plos·elife) | 562 | 지구·재난(usgs) | 152 |
| 백과(wikipedia) | 520 | 우주·항공(nasa) | 149 |
| 여행(wikivoyage) | 491 | 개작·국가정보 | 40 |

- **라벨을 SQL 이 들지 않는다** — RPC 는 `simple_wikipedia` 같은 갈래 키만 돌려주고
  한국어 표기는 `source-guide.ts` 가 소유한다(`SERIES_SPINE` 이 권 제목을 소유하는 것과 같은 이유).
- **갈래를 학습자 이름으로 접는다** — `plos`·`elife` → '논문' 하나, `original`·`compose` → '창작' 하나.
  학습자에게 '논문' 은 하나인데 칩을 둘 내면 같은 것을 두 번 고르게 한다.
- **재고 0인 갈래는 축 값이 아니다** · 출처를 못 읽으면 축이 통째로 안 나온다
  (다른 세 축과 같은 규칙 — 없는 칸에 팻말을 세우지 않는다).
- 회귀 5(접기 · 권수 · 0 재고 · 못 읽음 · 교집합) + e2e 묶음 단언에 축 추가.
  칩이 30개를 넘어가지만 **건너뛰기**(v06.352)가 이미 있어 키보드 동선은 그대로다.

### 없는 권이 교재인 척했다 — 그리고 고치려던 것은 이미 되고 있었다 (v06.357)

`/library/textbooks/99` · `/abc` 를 열어 보니 404 화면이 뜨는데 **제목이
`교재 · Vocaflow`** 였다. 브라우저 탭·북마크·공유 카드에서 **없는 권이 있는 권처럼** 보인다.
→ `찾을 수 없는 교재`.

⚠️ **`robots: noindex` 를 넣었다가 뺐다.** Next 가 `notFound()` 렌더에 이미
`<meta name="robots" content="noindex">` 를 넣는다 — 커스텀 메타데이터가 **없는** 이웃 라우트
(`/library/books/<없는 uuid>`)와 진짜 없는 라우트에서도 확인했다. 더했더니 robots 태그가 **둘**이
됐고 테스트가 strict mode 위반으로 잡았다. **"고쳐야 할 것 같다" 로 손대기 전에
이미 되고 있는지 확인할 것** — 이번 루프에서 두 번째다(하네스 MSYS 경고도 이미 적혀 있었다).

**남은 문제(앱 전역, 고치지 않음)**: 없는 step 은 404 화면을 그리지만 **HTTP 상태가 200** 이다.
루트 `loading.tsx` 때문에 모든 응답이 스트리밍(`Transfer-Encoding: chunked`)이라
200 셸이 먼저 나간 뒤에는 `notFound()` 가 상태를 바꿀 수 없다.
**없는 라우트(`/zzzz`)는 정상 404** 이고, 존재하는 라우트의 `notFound()` 만 이렇다.
`loading.tsx` 는 apps/web/CLAUDE.md 가 "수정·삭제 금지" 로 못 박은 파일이라 손대지 않았다.
색인은 Next 의 noindex 가 막고 있어 실질 피해는 작다 — 기록만 남긴다.

- 회귀 3 — 없는 권 2종(제목 + 결과적으로 noindex) · **있는 권에 과잉 차단이 없는지**.
  noindex 를 "우리가 넣었는지" 가 아니라 "결과적으로 걸려 있는지" 로 본다 —
  누가 넣었는지는 프레임워크 사정이고 크롤러에게 중요한 건 결과다.

**전체 vitest 현황(참고)**: 111 파일 중 **3 파일 5건 실패** — 전부 LCP/VCB 영역이고
이번 작업과 무관하다(`extraction-rpc` 골든셋 스냅샷 2 · `content-quality-gate` 2 ·
`resolve-headword` 영/미 철자 1). 스냅샷은 갱신하면 증거가 지워지므로 손대지 않았다.
교재 관련은 **62 + e2e 16 전부 초록**.

### 유형 설명은 맞았다 — 대신 **수능 대표 유형이 어느 권에도 없다** (v06.356)

`TYPE_GUIDE` 9종의 설명을 실제 `payload` 와 대조했다. **DB 에 실재하는 6종은 전부 맞다**:

| 유형 | payload | 설명 |
|---|---|---|
| 글 순서 | `presented` | 토막 난 글을 원래 순서로 ✓ |
| 문장 삽입 | `gap_count, insert_sentence, remaining` | 빠진 문장이 들어갈 자리 ✓ |
| 영작 배열 | `bank, context, sentence_idx` | 흩어진 낱말을 문장으로 ✓ |
| 어휘 추론 / 어법 | `sentences, underlines` | 밑줄 중에서 고른다 ✓ |
| 흐름 무관 | `intro, sentences` | 논지에서 벗어난 문장 ✓ |

(`rhyme`·`word_meaning`·`spell_blank` 는 DB 에 없다 — 사전에서 생성한다는 설명도 맞다.)

⚠️ **대신 다른 것이 나왔다. DB 에 15유형이 있는데 시리즈는 9종만 쓴다.**

`topic` 47 · `blank` 44 · `main_point` 31 · `title` 30 · `summary`·`purpose`·
`implication`·`content_match`·`claim` 각 16 — **합 232문항**이 `SERIES_SPINE` 7권 어디에도
없다. 서가에도 안 보이고 오늘의 학습에도 안 나온다. **만들어졌지만 아무 데도 닿지 않는다.**
빈칸·주제·제목·요약은 수능 대표 유형이라, 고3/수능 권이 순서·삽입·어휘·어법·흐름무관만
담고 있다는 뜻이다.

**이 상황을 잡으려고 만든 회귀가 이미 있었고, 빨간 채로 있었다.**
`dcp-playable-types.integration` 이 "분류되지 않은 유형 9종" 으로 실패하고 있었다 —
세션 초에 "기존 실패 4건" 으로 넘겨 둔 것 중 하나다. 분류하지 않고 두면
**이 회귀가 계속 빨간 채로 남아 다음 진짜 누락을 가린다.**

- 9종을 `TEXTBOOK_ONLY_DCP_TYPES` 로 분류 — 재생하려면 `parseItem`·`DcpPlayer`·
  `grade_dcp_item`·`prescribe_today` 넷을 함께 만들어야 하는데 **지금은 하나도 없다.**
  회귀 초록 복귀(5/5).
- ⚠️ 이름이 절반만 맞다는 사실을 코드 주석에 남겼다 — "교재 전용" 인데 **어느 교재도 안 쓴다.**
  시리즈에 넣을지는 **커리큘럼 결정**이라 하지 않았다.

### 나머지 문구도 전수로 대조했다 — 셋 더 나왔다 (v06.355)

한 문단이 거짓이었으면 나머지도 봐야 한다. 교재 4화면의 **사실 주장**을 하나씩 원본과 맞췄다.

**① 소요 시간이 어느 상수와도 묶여 있지 않았다.**
"약 25시간" 을 `maxUnits × 4 × 3` 으로 계산하면서 `3` 을 **손으로 적어** 두고,
주석은 `compose-unit.MINUTES_PER_ITEM` 을 가리켰다. 확인해 보니 그 패키지 안에
**같은 이름의 상수가 둘**이다:

| 상수 | 값 | 모델 |
|---|---|---|
| `assemble-unit.MINUTES_PER_ITEM` | 2분 | 지문 하나에 문항을 붙인다 |
| `compose-unit.MINUTES_PER_ITEM` | 3분 | 문항 자체가 지문이다(풀 조합) |

`index.ts` 는 **앞의 것만** 내보내고 있어서 밖에서는 하나뿐인 것처럼 보였다.
어느 하나를 골라 단일 숫자로 인쇄하면 근거 없는 정밀함이 된다 —
둘 다 구별되는 이름으로 내보내고(`COMPOSE_MINUTES_PER_ITEM`) 화면은 **범위**로 말한다:
**약 25시간 → 약 17~25시간** · "문항 4개(약 12분)" → "문항 4개(약 8~12분)".
(상수 정리는 그 패키지 소유자의 결정이라 이름만 구별해 두었다.)

**② 주석이 스스로를 유예시키고 있었다.**
`shelf.ts` 가 `{ order: 2, insert: 2 }` 를 복사해 두고
"라이브러리가 상수를 export 하면 그것을 import 할 것" 이라 적어 뒀는데,
**이미 `DEFAULT_SLOTS` 로 export 되고 있었다.** "나중에 고치자" 는 메모는 고쳐지지 않는다.

**③ 매대 팻말이 사다리와 어긋났다.**
초등 매대가 "소리와 낱말부터. **문장을 통째로 다루지 않습니다**" 라고 적고 있었는데,
step 2(초등 고학년)에 `word_order`(영작 배열)가 있고 `SERIES_SPINE` 스스로
"영작 배열이 **첫 문장 단위 과제**" 라고 적어 두었다.
→ "소리와 낱말에서 시작해 첫 문장까지".

**④ 조건부로 거짓이 되는 문구.** 빈 매대의 "아래는 지금 바로 펼칠 수 있는 권입니다" 는
`previewVolumes` 가 ready 부족분을 나머지로 채울 때 틀린다. 지금은 7/7 이라 우연히 참이지만
재고가 줄면 조용히 틀린다 — 전부 ready 일 때만 그렇게 말한다.

회귀 2 추가(상수 import · 범위 표기). 전체 교재 회귀 **55 + e2e 13**.

### 🔴 화면이 시스템보다 앞서 말하고 있었다 (v06.354)

권 상세가 이렇게 적고 있었다 — **내가 적었다.**

> "이 권의 문항은 **오늘의 학습**에 섞여 나옵니다. 지금 수준에 맞는 단원부터 자동으로 배정돼요."

`prescribe_today` 본문을 읽어 보니 **셋 다 틀렸다**:

| 주장 | 실제 |
|---|---|
| 담은 교재가 반영된다 | `user_textbook_selections` 를 읽는 곳이 **조회·쓰기 모듈뿐**이다. 어떤 권을 담아도 오늘의 학습은 그대로다 |
| 단원부터 자동 배정 | '단원' 단위가 배정에 **없다**. `stage_band` 로 거르고 `md5(id‖current_date)` 로 무작위 5문항 |
| 이 권의 문항이 나온다 | 유형이 `order`·`insert` 로 제한. 문항 **5,952개 중 오늘의 학습이 닿는 건 895개(15%)**. 어휘 추론·어법·흐름 무관 **2,830개**는 이 경로로 한 번도 안 나온다 |

**이런 문장은 틀려도 아무 예외가 안 난다.** 화면은 멀쩡히 뜨고 학습자만 속는다 —
이 저장소가 지배적 결함으로 지목한 조용한 실패의 가장 나쁜 형태다(코드가 아니라 약속이 거짓).

- 문구를 **지금 참인 것**으로 교체: 담기는 내 교재에 쌓는 일이고, **아직 오늘의 학습을 바꾸지 않는다**.
  오늘의 학습에는 글 순서·문장 삽입이 진단 단계에 맞춰 나오고 나머지는 각 모듈에서 만난다.
- **회귀 `promise-guard`** — 코드가 아니라 **문구**를 잡는다. 처방 경로가
  `user_textbook_selections` 를 읽기 시작하면 **먼저 실패해서** 문구를 되돌리라고 알린다.
- ⚠️ 이 가드도 첫 판이 스스로 틀렸다 — 줄 앞머리만 보고 주석을 거르다가 **여러 줄짜리 JSX 주석
  안의 문장**을 화면 문구로 셌다. "적혀 있다" 와 "학습자가 읽는다" 는 다르다는,
  이 파일이 잡으려는 것과 정확히 같은 실수다. 주석 제거를 제대로 고쳤다.

**배선은 하지 않았다** — 담은 교재를 처방에 반영하는 것은 `prescribe_today` 를 바꾸는
별개 기능 결정이다. 지금 할 일은 **거짓말을 멈추는 것**이었다.

### 공개 서가의 전환 지점이 막다른 길이었다 (v06.353)

서가는 비로그인에도 열려 있다(발견·SEO). 그런데 방문자가 담기를 누르면
**"로그인이 필요해요."** 한 줄이 뜨고 끝이었다 — 로그인으로 가는 길이 없었다.
공개로 열어 둔 이유가 CAC 0 경로인데, **그 경로가 성립하는 유일한 순간**이 막혀 있던 셈이다.

- `MySelection` 에 `signedIn` 추가 — `available` 과 **다른 축**이다.
  비로그인은 **정상적으로** 0권이라 `available: true` 인데, 화면이 둘을 구별하지 못하면
  비로그인에게 **눌러도 안 되는 버튼**을 판다.
- 비로그인에게는 담기 대신 **"담으려면 로그인"** — 자리를 비우지 않는다
  (비우면 "이 서가에서 할 수 있는 일이 없다" 로 읽힌다).
  `loginUrlWithReturn(pathname)` 으로 **돌아올 곳을 들려 보낸다** —
  안 그러면 로그인 후 `/hub` 로 떨어진다(이 저장소가 `?next=`/`?returnTo=` 로 겪은 실패).
- 회귀 3 — 비로그인 상세·서가에서 담기 자리가 살아 있는지 + `next=` 가 이 권을 가리키는지 ·
  **연타**(처리 중 재클릭 차단 + 새로고침 후에도 같은 상태).

**연타는 이미 안전했다** — `disabled={pending}` 가 막고 있었고, `upsert(onConflict)` 이라
중복 행도 안 생긴다. 재 보고 확인한 것이지 고친 것이 아니다.

### 필터가 목록을 가두고 있었다 — 첫 권까지 Tab 24번 (v06.352)

분류 축 3개(칩 21개)를 얹으면서 **키보드 동선을 한 번도 안 쟀다.** 재 보니
서가에서 **첫 권 링크에 닿기까지 Tab 을 24번** 눌러야 했다. 눈으로는 작은 알약 한 줄인데
키보드로는 목록 앞을 가로막는 24번의 정지다.

- **건너뛰기** — 포커스가 오면 나타나는 "찾기 조건을 건너뛰고 교재 목록으로".
  칩을 줄이지 않은 이유: 분류 체계가 **눈에 보이는 것**이 이 화면의 요구사항이다.
  목록에 `tabIndex={-1}` 을 주어 Tab 순서는 그대로 두고 프로그램 포커스만 받게 했다.
- **축마다 `role="group" aria-label`** — 없으면 스크린리더가 칩 21개를 축 구분 없이
  한 덩어리로 읽는다. `V3` 만 들으면 무엇의 3인지 알 수 없다.
  (칩 개별 접근 이름에는 이미 축·권수가 들어 있었다 — 그건 통과했다.)
- 회귀 3 — 묶음 · 칩 접근 이름 · **건너뛰기가 실제로 포커스를 옮기는지**.

⚠️ **계측을 "Tab 횟수" 로 두지 않았다.** 횟수를 통과 조건으로 삼으면 통과할 방법이
**필터를 없애는 것뿐**이 된다. 필요한 것은 적게 누르는 것이 아니라 **건너뛸 수 있는 것**이라,
계측도 그 쪽을 본다(24번이라는 숫자는 주석에 근거로 남겼다).
CONVENTIONS §조용한 실패에 규칙으로 추가.

### 학습자 20화면 대비 전수 — **92건**, 원인은 하나로 모인다 (v06.351)

새 `lowContrast` 계측을 학습자 전 화면(20라우트 × 2뷰포트 = 40장)에 돌렸다.
전역 토큰을 건드릴지 정하려면 "620곳이 쓴다" 가 아니라 **"몇 화면에서 몇 건이 보이나"** 가 필요하다.

| 원인 | 건수 |
|---|---|
| `--t3`(3차 잉크, `rgba(...,0.38)`) — 2.38:1 | **72** |
| 흰 글자를 옅은 면·표지에 얹음 | 14 |
| 기타 반투명 잉크 | 2 |

**미달이 몰린 화면**: `/wordblitz` · `/pairflip` · `/hub` · `/dashboard` 각 8건(캡 상한),
`/practice/dcp` 4 · `/text?view=scripts` 4 · `/library/vocab` 3.

**미달 0인 화면 10곳**: `/arcade` · `/flashcard` · `/library` · `/library/books` ·
`/library/scripts` · **`/library/textbooks`** · `/text?view=books` · `/text?view=vocab` ·
**`/text?view=textbooks`** · **교재 권 상세**. (교재 4화면은 v06.350 에서 정리한 결과다.)

**최악은 1.1:1 — 사실상 보이지 않는 글자.** 옅은 표지 위 흰 제목이다
(`Introduction to Sociology` · `B1` 배지 · `EchoMatch Runtime Test`).
`GradientBookCover` 가 `drop-shadow` 로 읽히게 만들고 있는데, **그림자는 WCAG 가 세지 않는다.**
표지 팔레트에서 옅은 색이 뽑히면 제목이 사라진다.

⚠️ **아직 고치지 않았다 — 둘 다 내 작업 범위 밖이고 전역 결정이 필요하다.**
`--t3` 상향은 167파일 620곳에 영향을 주고, 표지 팔레트는 디자인 결정이다.
숫자를 남겨 두는 것이 이번 사이클의 산출물이다.

⚠️ **계측기가 도구를 망가뜨렸다가 고쳤다.** `lowContrast` 첫 판이 글자마다 조상을 다시 타고
올라가며 `getComputedStyle` 을 반복 호출해 **전체 스윕을 180초 타임아웃으로 죽였다.**
중간에 죽으면 계측은 루프가 끝난 뒤 찍히므로 **한 줄도 인쇄되지 않는다** —
"측정 실패" 가 아니라 **"측정 안 함"** 이 되고, 부분 캡처만 돌리는 동안 이 사실이 안 보였다.
요소 단위 캐시 + `describe` 예산 420초로 복구(40장 · 92건 정상 출력).

### 다크·라이트 대비를 처음으로 **실측**했다 (v06.350)

교재 4화면을 만들면서 한 번도 안 잰 축이 대비였다. 이 저장소가 가진 유일한 대비 검사
`on-p-contrast` 는 **클래스 문자열**을 보는 정적 래칫이라(`text-white` 가 `bg-[var(--p)]` 위에
있나), 토큰으로만 칠한 화면은 전부 통과하면서 미달일 수 있다. 통과하고 있었고, 미달이었다.

- **`91-hub-design-capture` 에 `lowContrast` 계측 추가** — 브라우저가 계산한 색을 읽어
  WCAG AA(일반 4.5:1 · 큰 글자 3:1)로 판정한다. 그라디언트·이미지 위 글자는 **재지 않는다**
  (한 색으로 환원되지 않는다 — 억지로 재면 틀린 숫자가 맞는 숫자처럼 인쇄된다).

⚠️ **계측기가 먼저 거짓말했다.** 첫 판이 알파를 버려서 다크 `--p-light`(`rgba(107,155,209,0.18)`)를
불투명 `rgb(107,155,209)` 로 읽고 **"1.67:1 미달" 8건을 지어냈다.** 실제로는 어두운 지면 위에
얹혀 7.24:1 이다(tokens.css 가 그렇게 적어 뒀다). 알파 합성을 넣고 다시 쟀다 —
**고치기 전에 계측기를 의심하는 것**이 이 하네스에서 가장 중요한 습관이다.

실측으로 확인된 **진짜** 결함:

| 대상 | 전 | 후 |
|---|---|---|
| My Library 탭 강조색 4종(흰 글자) | `#6366F1` 4.47 · `#3B82F6` 3.68 · `#0EA5E9` **2.77** · `#8B5CF6` 4.23 | `#4F46E5` 6.29 · `#1D4ED8` 6.70 · `#0369A1` 5.93 · `#6D28D9` 7.10 |
| 활성 탭 개수 뱃지 | `bg-white/25` → 4.26 | `bg-black/25` → 10.13 |
| 교재 4화면 `--t3` 정보 텍스트 | 3.16 (다크) | `--t2` 로 교체 — 6.13~6.47 |

넷 중 셋은 **기존 값**이었고 내가 네 번째(`#8B5CF6`)를 같은 방식으로 더했다.
색상(hue)은 유지했다 — 면을 구별하는 것이 이 색의 일이다.
결과: 라이트·다크 양쪽 · 교재 3라우트 × 2뷰포트에서 **미달 0건**.

⚠️ **토큰 수준 발견 — 고치지 않았다(범위 밖).** `--t3` 는 **양쪽 테마에서 AA 미달**이고
**라이트가 더 나쁘다**: 라이트 2.38:1 · 다크 3.16:1 (일반 텍스트 기준 4.5:1).
`src` 안에서 **167개 파일 620곳**이 쓴다. 이건 다크모드 문제가 아니라 **토큰 문제**이고,
전역 변경은 전 화면에 영향을 주므로 별도 결정이 필요하다.
이번에는 **내가 소유한 교재 4화면에서만** 정보 텍스트를 `--t2` 로 올렸다
(계층은 크기·굵기·글꼴로 유지 — 색만으로 정보를 전달하지 않는 규칙과도 맞는다).

### 🔴 모바일에는 교재로 가는 길이 사실상 없었다 (v06.349)

데스크톱 사이드바는 `hidden md:flex` 다. 모바일 학습자에게 남는 통로는
**하단 탭 → Library → 가로 탭줄** 하나뿐인데, 그 탭줄에서 `Textbooks` 는 네 번째다.

| 390px 에서 보이는 폭 | 기준 44px |
|---|---|
| 공용 서가 탭줄 `Textbooks` | **32px** |
| My Library 탭줄 `Textbooks` | **9px** |

`overflow-x-auto` 는 걸려 있으니 "스크롤하면 나온다" — 그러나 **더 있다는 표시가 없으면**
손가락을 대 볼 이유가 없다. DOM 에 있는 것과 눈에 보이는 것의 차이이고,
이 저장소가 죽은 버튼과 같은 부류로 취급하는 결함이다.

- `useScrollHint` (신규 훅) — `scrollWidth > clientWidth` 를 **실제로 재서**
  `data-scroll-hint="start|end|both"` 를 붙인다. 항목 수·화면 폭으로 예측하지 않는다
  (글꼴·언어·확대 배율에서 어긋난다). 리사이즈·스크롤·내용 변경에 모두 반응한다.
  가장자리 mask 로 **잘린 쪽만** 흐려진다.
- `scrollActiveIntoView` — 주소로 곧장 들어온 면(`?view=textbooks`)의 활성 탭이 화면 밖이면
  탭줄이 위치를 말하는 장치인데 그 말을 못 한다. 가로로만 끌어온다(세로로 튀면 본문이 흔들린다).
- 좁은 화면에서 **아이콘을 먼저 접는다**(`aria-hidden` 장식이므로 잃는 의미가 없다) + 패딩·글자 축소.
  두 탭줄 모두 44px 터치 타겟은 유지.
- 회귀 3(보이는 폭 · 스크롤 표시 · My Library 탭줄) — **DOM 에 있는가가 아니라 몇 px 보이는가**를 잰다.

**스펙이 제품보다 낡아 있었다** — `12-navigation` 이 라이브러리 탭을 `['/library/books',
'/library/scripts', '/library/vocab']` 로 **손으로 적어** 두고 있었다. 네 번째 면이 추가되자
"3개여야 한다" 로 실패했는데, 틀린 것은 제품이 아니라 스펙이었다. `LIBRARY_TABS` 를 읽게 고쳤다 —
이 저장소가 레지스트리를 만든 이유(목록을 복사하면 갈라진다)가 테스트에도 그대로 적용된다.

⚠️ **알려진 실패 2건(이번 변경과 무관)**: `12-navigation` 의 "만화 상세 → 목록" 은 재현 실패,
"사이드바 전 메뉴" 는 `/hub` 이동에서 `ERR_ABORTED` 로 간헐 실패(격리 실행 시 통과).
만화 영역은 이번 작업이 건드리지 않았다.

### 권 상세에 뒤표지를 붙였다 (v06.348)

서점에서 책을 집은 사람이 가장 먼저 하는 판단은 **"나한테 맞나"** 다. 안 맞으면 바로 옆 권으로
손이 가는데, 이 화면은 그때 **서가로 되돌아가게** 만들고 있었다 — 되돌아간 사람은 대개 안 돌아온다.

- **계단 안내** 섹션 — "어렵다면 한 계단 아래 / 쉽다면 한 계단 위" + 지금 권이 속한 매대.
  실제 교재 뒤표지의 시리즈 표에 해당한다.
- `neighborsOf` (순수) — **배열 인덱스가 아니라 step 순서**로 찾는다. 필터링된 목록을 넘겨도,
  사다리에 계단이 빠져 있어도(3 다음이 5 여도) 맞아야 한다.
- 끝 계단은 빈 칸으로 두지 않고 **"시리즈의 첫 권이에요"** 라고 적는다 — "더 쉬운 게 없다" 는
  사실 자체가 학습자에게 필요한 정보다.
- 지면 배분 **78 → 81%** (모바일 83 → 85%), 5블록 14~32% 로 고르다. 넘침 0px.
- 회귀 5(순수) + e2e 1(**실제로 한 계단 위로 이동**하는지 — 보이는데 안 눌리는 것이 이 화면의 첫 결함이었다)

**하네스 함정을 다시 밟았다 — 그리고 그 경고는 이미 적혀 있었다.**
Git Bash 에서 라우트를 **하나만** 주면 MSYS 경로 변환이 `/library/textbooks/5` 를
`C:/Program Files/Git/library/...` 로 바꿔 아무 라우트와도 안 맞는다. 두 번 헛돌고 나서야
원인을 찾았는데, **스펙 머리에 2026-08-15 자로 같은 경고가 이미 있었다**(안 읽었다).
쉼표가 섞인 호출은 멀쩡히 되니 "이번엔 다른 문제" 로 보이는 것이 이 함정의 성질이다.
새 경고를 더하는 대신 기존 줄에 재발 사실만 덧붙였다 — **같은 경고를 두 번 적으면
둘 다 안 읽힌다.** 빈 ROUTES 가드가 잡아 줬다(그 가드를 만든 이유가 정확히 이것이었다).

### 공개 표면 RLS 스윕 — 우연인지 패턴인지 (v06.347)

앞 항목이 우연이 아닐 것 같아 **RLS 로 anon 을 막는 표 30개**를 뽑아, 그중 비-admin 코드가
읽는 것을 전수로 훑었다(`SET LOCAL ROLE anon` 실측 — 문서가 아니라 DB 에 물었다).

| 표면 | 결과 |
|---|---|
| `/library/textbooks` | 🔴 **재현** — 앞 항목(v06.346)에서 수정 |
| `/fit` (공개 교사 채널) | ✅ **재현 안 됨** — 익명 경로가 따로 있어 `analyzeText`(로그인 전용)를 타지 않는다. 실측 커버리지가 학년축으로 변별된다 |
| `/library/vocab` | ⚠️ **부분** — 익명도 발행 세트 747개는 보지만 `dictionary_categories` 가 0행이라 큐레이션 라벨·이모지가 legacy 자유문구로 내려앉는다. 수치를 속이지는 않지만 조용히 나빠진다 |

- **`24-public-fit` 의 단언이 아무것도 보증하지 않고 있었다** — "⑤ 실제 숫자가 찍힌다 —
  anon 권한으로 레벨 해석이 됐다는 증거" 라고 적힌 정규식 `/\d{1,3}\.\d%/` 는 **`0.0%` 도 통과한다.**
  "⑦ 전부 100% 로 뭉개지지 않는다" 는 줄 수만 세고 있었다. 이제 값을 꺼내
  **바닥도 천장도 아닌지**(max>0 · min<max) 본다 — 통과했고, 그래서 `/fit` 은 무사하다는 것을
  비로소 **증거로** 말할 수 있다.
- CONVENTIONS §조용한 실패에 판정 규칙과 확인법(`SET LOCAL ROLE anon`) 추가.

⚠️ `/library/vocab` 은 아직 고치지 않았다 — `dictionary_categories`(566행 분류 트리)를
anon 에 여는 마이그레이션이 필요하고, 미적용 `20260822090000` 과 함께 승인 대기다.

### 🔴 로그아웃하면 초등 교재 두 권이 사라졌다 (v06.346)

같은 거짓말을 **한 겹 아래에서 반복**하고 있었다. 이 화면은 `unmeasured` 상태를 만들면서
"못 잰 것을 0으로 적지 않는다" 를 규칙으로 못 박았는데, 정작 초등 재고는 그 규칙 밖에 있었다.

| | 서가 |
|---|---|
| 로그인 | **7/7** 펼칠 수 있음 |
| **비로그인** (= 공개 표면) | **5/7** — 계단 1 '근간 예정' · 2·3 '준비 중' |

- 원인: 초등 3종(`rhyme`·`word_meaning`·`spell_blank`)의 **생성 가능 수**는
  `shared_dictionary.list_tags` 에서 나오는데, 그 표의 RLS 는 `authenticated read dictionary`
  하나뿐이다. `/library/textbooks` 는 **비로그인에 열려 있는 발견 표면**이라(apps/web/CLAUDE.md)
  익명 방문자는 0을 받았고 화면이 그것을 '재료 없음' 으로 인쇄했다.
- `shelf.ts` 주석은 초등 유형이 "조회 실패와 무관하다" 고 적고 있었다 — **틀린 문장이었고**,
  그 문장 때문에 `unmeasured` 판정이 초등 계단을 건너뛰었다. 이제 재고 출처를 둘로 나눠
  (`measured` · `elementaryMeasured`) **한쪽만 막혀도 그 계단은 '재고 확인 중'** 이 된다.
  섞인 계단(초등 유형 + 저장 유형)도 마찬가지다 — 한쪽만 읽으면 총계가 조용히 작아진다
  (계단 2 가 1,255 → 43 으로 보였다).
- ⚠️ **RLS 는 오류를 내지 않는다. 행을 지운다.** 익명 요청에서 `count` 는 0, `error` 는 null 이라
  클라이언트에서는 "0낱말" 과 "못 읽음" 을 **구별할 수 없다**. `if (!count) continue` 가
  정확히 그 함정이었다. 지금은 세션 유무로 가른다 — 추측이 아니라 정책을 그대로 반영한 판정이다.
- ⏳ **마이그레이션 `20260822090000` 미적용** (승인 대기) — `textbook_curriculum_vocab_counts()`
  집계 함수를 열면 익명도 실수치를 본다(낱말은 나가지 않는다, 태그별 개수뿐).
  같은 파일에 **출처 축** `textbook_shelf_sources()` 도 함께 들어 있다.
- 회귀 3(초등 전용 계단 · 섞인 계단 · 과잉 unmeasured 금지)

**권마다 다른 제목** — 정적 `metadata` 여서 일곱 권이 전부 `교재 · Vocaflow` 였다.
비로그인 발견 표면인데 브라우저 탭·북마크·공유 카드·검색 결과에서 **서로 구별되지 않았다.**
`generateMetadata` 로 권명·학령·수록 유형·문항 수를 넣되, **못 잰 재고는 개수로 적지 않는다** —
검색 인덱스에 "문항 0개" 가 박히면 그 문장은 화면보다 오래 남는다.
(레이아웃이 ` | Vocaflow` 를 붙이는 것을 모르고 접미사를 또 달아 두 번 나오던 것도 실측으로 잡았다.)

**e2e 위생** — 정리(finally)가 하이드레이션 전에 클릭해 실패하면서 담김 상태를 남겼고,
다음 실행이 "담기 버튼이 없다"(사실은 이미 담겨 있어 '빼기' 다)로 **엉뚱한 증상**을 보고했다.
`ensureUnpicked` 로 결과가 나타날 때까지 재시도하고, 시작 상태도 보장한다.
같은 작업에서 `revalidatePath('/library/textbooks')` 가 **권 상세를 안 걸던 것**도 고쳤다
(`'layout'` 범위) — 서가에서 담고 상세로 넘어가면 거기만 예전 상태를 말하고 있었다.

### 매대를 나눴다 — 그리고 **기출은 없다** (v06.345)

- **1차 진열을 매대로** `shelf-stage.ts` (순수) — 초등 / 중등 / 고등. 시중 교재 코너는 책을
  한 줄로 세우지 않고 매대를 먼저 나눈다(학부모·교사가 찾는 순서가 "초등 → 그중 몇 학년" 이다).
  일곱 권을 평평하게 늘어놓으면 **고1 학습자가 초등 두 권을 지나쳐야 자기 자리에 닿는다.**
  · 매대 팻말은 라벨이 말하지 않는 것만 말한다 — 그 매대가 무엇을 시키는지.
  · 빈 매대는 내지 않는다(필터로 초등만 남았는데 '고등' 팻말이 서 있으면 없는 칸을 파는 것).
  · **`schoolBand` 접두사로 유추하지 않고 표로 적는다** — 유추하면 라벨이 바뀌는 날 권이
    조용히 엉뚱한 매대에 꽂힌다(사라지지 않으므로 아무도 모른다).
    `SERIES_SPINE` 의 모든 밴드가 표에 있는지 테스트가 강제한다.
  · 표에 없는 밴드는 버리지 않고 자기 이름으로 모은다 — 화면에서 사라지는 것이 가장 나쁘다.
- **캡처 하네스 `nocards` 선언 4종** — 이 화면들은 반복 카드 격자가 아니다(3D 코버플로 무대
  하나 · 매대별 계단 행). "카드 0개 — 측정 안 됨" 경고가 매 실행 떠서, 진짜 측정 실패와
  구별되지 않고 있었다.
- 회귀 7(`shelf-stage.test`) + e2e 1(매대 3칸 · 필터 시 빈 팻말 없음)

⚠️ **사용자가 요청한 축 하나는 데이터가 없다 — 만들면 허위 표시다 (실측 2026-08-22)**

"시중 상업 / 기출 / 기출변형" 체계를 요청받았으나, `csat_dcp_items` 5,952문항의 출처를
전수 조회한 결과 **기출 지문은 0건**이다. 전부 원문 기반 창작이거나 도서 발췌다:

| 갈래 | 출처 | 비고 |
|---|---|---|
| 공개 원문 | simple_wikipedia · wikipedia · wikivoyage · voa · nasa · noaa · usgs · owid · plos · elife · factbook | `kind='article'` 543 ref |
| 도서 | 큐레이션 장서 발췌 | `kind='book'` 17 ref · 808문항 |
| 창작 | `original:*` · `compose:*` · `adapt:*` | 파이프라인 생성 |

**기출 매대를 만들면 없는 상품을 파는 것**이므로 만들지 않는다. 대신 **출처 축**(위 표의 갈래)이
정직한 4번째 분류축 후보다 — 다만 `csat_dcp_items` × `library_articles` 조인이 필요해
`textbook_shelf_inventory()` RPC 확장(마이그레이션)이 선행돼야 한다. 승인 대기.

### 빈 책장 대신 매대 — 그리고 히어로가 이름을 얻었다 (v06.344)

계측이 앞선 보고를 정정했다. My Library 네 면 중 **교재 면만** 본문의 37%(모바일 44%)를
채우고 있었다 — 나머지 셋은 62~70%로 이미 기준 위였다("네 면 공통"이라던 진단은 틀렸다).
원인은 담은 교재가 0권일 때 **얇은 안내 카드 하나가 텅 빈 지면에 떠 있는 것**이었다.

- **빈 상태를 매대로 바꿨다** — 서점은 빈 책장을 보여주지 않는다. 지금 펼칠 수 있는 권 3개를
  계단 순서로 진열하고 그 자리에서 담을 수 있게 했다. 표지 이미지는 만들지 않는다 —
  이 교재에 표지가 없으므로, 그리면 화면이 없는 물건을 지어내는 것이다.
  **실측 37% → 61% (모바일 44% → 83%)**.
- **`ModuleHero` 가 `<header>` → `<section aria-label={title}>`** — 이름 없는 덩어리였고,
  지면 계측도 통째로 놓쳤다. 그래서 화면마다 **측정된 한 조각이 "100%"로 인쇄**됐다
  (하네스가 스스로 함정으로 못 박은 패턴). 이제 배분이 두 블록 이상으로 읽힌다:
  My Library 네 면 64~70% → **73~83%**. (`<main>` 안의 `<header>` 는 banner 랜드마크가
  아니므로 잃는 의미가 없다. 7개 허브 화면이 함께 개선된다.)
- **순수 모듈 분리** `lib/textbook/my-shelf.ts` — 담은 권 정렬 · 다음 계단 · 매대 선정 · 합계.
  화면이 배열 조작을 다시 짜지 않는다(회귀 11).
- **터치 타겟 44px** — My Library 면 탭이 30px 이었다. 네 번째 면을 더하면서 a11y 스윕이
  **악화(3→4)로 잡았고**, 하나를 되돌리는 대신 넷 다 44px 로 올렸다. 서가 필터 칩도 32→44px.
  `10-a11y-sweep` 베이스라인 `/text: 3` → **0**(항목 삭제 — 되살아나면 즉시 잡힌다).

### 교재 — 조준 **100% 달성**. 그리고 앞 항목의 결론은 틀렸다 (v06.342)

> ⚠️ **아래 v06.341 의 "보고가 틀렸다" 는 판단은 잘못이었다.** 배치는 정직했고,
> **내가 배치가 끝나기 전에 적재했다.** 완료 보고를 받은 뒤 같은 파일을 다시 재니:
>
> | 조건 | 편수 | 적중률 |
> |---|---|---|
> | V2 검사 없음 | 12 | 75.0% |
> | V2 + 틀린 검사기 | 51 | 70.6% |
> | **V2 + 고친 검사기 (완주)** | 13 | **100.0%** |
> | V3 검사 없음 | 82 | 58.5% |
> | V3 + 틀린 검사기 | 25 | 44.0% |
> | **V3 + 고친 검사기 (완주)** | 6 | **100.0%** |
>
> **조준 문제가 풀렸다.** 채점 경로를 그대로 재현한 검사기 + 집필 배치가 ✅ 까지 고치는 왕복.
> 58.5% → 100%.

**■ 내가 만든 사고 — 배치가 끝나기 전에 적재했다**

`source_id` 유일키가 재적재를 막으므로 **낡은 판이 DB 에 굳었다.** 적재 시점 실측이 8/13 이라
"배치 보고가 틀렸다" 고 결론내고 그대로 커밋까지 했는데, 원인은 순서였다.
드레인은 **완료 알림을 받은 뒤에 적재해야 한다.**

→ `write-drain-import.mjs --update-existing` 신설. 이미 넣은 글 중 **파일이 더 새로운 것**을
찾아 본문을 갱신한다(V2 8편 · V3 6편 갱신). 되돌릴 수 없으므로 `--commit` 없이는 미리보기만 하고,
문단 번호가 바뀌어 기존 문항이 낡으므로 뒤에 `refresh-dcp-items` 를 다시 돌리라고 안내한다.

### 교재 — ~~자가 보고를 믿지 않는다.~~ 적재기가 직접 잰다 (v06.341)

> 위 v06.342 참조 — **"보고가 틀렸다" 는 결론은 정정됐다.** 다만 적재기가 스스로 재는 것 자체는
> 남겨 둔다: 순서가 어긋났을 때 그 사실이 숫자로 드러나야 하고, 실제로 그렇게 드러났다.

검사기를 고친 뒤 19편을 더 썼다. 배치들은 "자가 검사 5/5 · 8/8" 을 보고했는데
실제 적중은 **V2 61.5%(8/13) · V3 50%(3/6)** 로, 검사를 안 했을 때(75% · 58.5%)보다도 낮았다.

**검사기 탓이 아니었다.** 저장된 파일을 직접 재서 DB 실제 배정과 대조하니 **19/19 일치**다 —
검사기는 맞았고 **보고가 틀렸다.** 앞선 초안을 재고 보고했거나, 재고 나서 손을 더 댄 것이다
(한 배치는 실제로 "190어 상한에 맞추려 191→189어로 줄였다" 고 적었다 — 그 순간 낱말 집합이 바뀐다).

→ `write-drain-import.mjs` 가 **적재 직전에 스스로 잰다.** 적중 수를 찍고 빗나간 슬롯이
어느 계단으로 갔는지 나열한다. **막지는 않는다** — 빗나간 글도 그 계단이 비어 있으니 쓸모가 있다.
예측값은 `composed_spec.predicted_v_level` 에 남겨, 분석 뒤 `article_v_level` 과 대조하면
**검사기가 여전히 채점기와 맞는지**를 언제든 다시 확인할 수 있다.

실행 결과가 DB 와 정확히 일치했다(8/13 = 61.5%). 이제 배치 보고가 아니라 적재기가 진실을 말한다.

**■ 아직 안 오른 적중률**

세 번 재는 방법을 고쳤는데도 6할이다. 남은 원인은 **집필과 측정이 분리돼 있다**는 것 —
배치가 고치고 재는 왕복을 스스로 관리한다. 표본도 작다(13편·6편). 다음 사이클에서
빗나간 편만 모아 재집필하는 좁은 드레인을 돌려 본다.

### 교재 — **검사기가 채점기와 달라 오히려 적중을 떨어뜨렸다** (v06.340)

집필 절차에 자가 검사를 넣고 76편을 썼다. 배치들은 전부 "자가 검사 100%" 를 보고했는데,
**실제 배정은 나빠졌다**:

| 조건 | 편수 | 적중률 |
|---|---|---|
| V3 꼬리4~5 (검사 없음) | 82 | 58.5% |
| V3 꼬리4~5 + 자가검사 | 25 | **44.0%** |
| V2 꼬리4~5 (검사 없음) | 12 | 75.0% |
| V2 꼬리4~5 + 자가검사 | 51 | **70.6%** |

빗나간 것이 거의 전부 **위로**였다(V2 는 15/15, V3 는 11/14). 검사기가 실제보다 **낮게**
재고 있었고, 배치들이 거기 맞춰 어려운 낱말을 덜어내자 실제 배정이 위로 떴다.
**검사기에 맞추는 것이 채점기에 맞추는 것과 달라지는 순간, 검사기는 도움이 아니라 함정이 된다.**

**■ 원인 — `compute_article_vrl` 은 `v_level = 11` 을 뺀다**

함수 본문을 읽어 대조했다. 채점기는 `library_article_vocabularies` 를 읽고
`sd.v_level IS NOT NULL AND sd.v_level <> 11` 로 거른다. 1차 검사기는 그 제외를 빠뜨렸다.

→ 제외를 넣고 `chapter_idx` 도 `analyzeArticle` 과 같은 1 로 맞춘 뒤,
**드레인 집필분 120편 전수로 예측 대 실제를 대조했다 — 일치 120/120, 편차 0.**
이제 검사기에 맞추면 채점기에도 맞는다.

**■ 배치들이 실측으로 알려 준 것 (지침에 반영)**

- 사전 계단이 CEFR 직관보다 높다 — `warm`·`surface`·`flat`·`thick` 이 **V4**,
  `coin`·`sweat`·`steady`·`gently` 가 **V5**, `dull`·`hollow`·`steep` 이 **V6 이상**.
- **굴절형은 사전에 없어 채점에서 아예 빠진다**(`carried`·`looks`·`sessions`).
  단수/복수 선택이 낱말 선택보다 p75 를 더 크게 움직인다.
- 스크래치패드를 동시 배치들이 공유한다 — `build.mjs` 같은 일반 이름이 서로 덮였다.
  임시 파일에 청크 접두어를 붙이도록 지침에 넣었다.

**■ 단원 이득 (누적)**

| 밴드 | 원글 | 문항 풀 | 단원 |
|---|---|---|---|
| V2 | 88 | 230 | 7 |
| V3 | 102 | 269 | 12 |
| V4 / V5 / V6 | 147 / 85 / 58 | 373 / 540 / 517 | 20 / 20 / 20 |

### 교재 — 조준을 짐작에서 **측정**으로 (v06.339)

꼬리 4~5개 지침으로 82편을 더 썼다. 편향은 잡혔는데(평균 어긋남 **+0.06**) 적중은 6할에서 멈췄다:

| 조건 (전부 V3 목표) | 편수 | 적중률 | 평균 어긋남 |
|---|---|---|---|
| 꼬리 0개 | 10 | 20% | −0.40 |
| 꼬리 4~5개 (1차) | 37 | 64.9% | +0.16 |
| 꼬리 4~5개 (2차) | 45 | 53.3% | **−0.02** |
| 꼬리 7~9개 | 52 | 13.5% | +1.00 |

**편향이 0 인데 적중이 6할** — 방향은 맞히지만 한 편 한 편은 여전히 운이라는 뜻이다.

**■ 원인 — 세는 방법이 달랐다**

집필하는 쪽은 `lexicon.json` 의 **표본 목록과 문자열이 겹치는 낱말만** 셀 수 있다. 실제 등급은
글에 쓰인 **모든** 낱말이 정한다. 배치들은 "꼬리 정확히 4개" 라고 보고했지만 채점 경로로 재니
**11~17개**였다 — 목록 밖의 평범한 낱말이 조용히 꼬리에 들어간다(실측: `warm`·`surface`·`flat`·
`thick` 이 V4, `coin`·`sweat` 이 V5). 지침을 아무리 다듬어도 세는 자가 눈이 없으면 못 맞힌다.

**■ 신설 `write-drain-verify.mjs` — 적재 *전에* 잰다**

채점 경로를 그대로 재현한다(`extractBookLemmas` → `shared_dictionary.v_level` → 75분위,
`compute_article_vrl` 과 같은 방법). 편마다 p50/p75/p90 · 적중 낱말 수 · 실제 꼬리 수를 찍고,
빗나간 편은 **어느 방향으로 고쳐야 하는지**만 말한다.

- 예측 적중 51.1% 대 실제 53.3% — **적재 전에 결과를 알 수 있다.**
- ⚠️ **아무것도 고치지 않는다.** 기계가 낱말을 바꾸면 글이 망가진다 — 고치는 것은 집필하는 쪽의 일.
- 이제 집필 배치는 저장 전에 이 스크립트를 돌려 ✅ 가 될 때까지 고칠 수 있다.

**■ 단원 이득 (누적)**

| 밴드 | 원글 | 문항 풀 | 단원 |
|---|---|---|---|
| V2 | 49 | 112 | 5 |
| V3 | 82 | 209 | 11 |
| V4 / V5 / V6 | 130 / 85 / 58 | 319 / 540 / 517 | 20 / 20 / 20 |

**■ 아직 안 푼 것**

소재 공간이 고갈되고 있다 — 축 8개 × 짜임 5개 = 40조합으로 150편을 쓰니 배치가 잡은 소재가
기존 글과 겹치기 시작했다(한 배치가 5개를 통째로 갈아탔다고 보고). 축을 하위 주제까지 넓히거나
소재 중복 검사를 export 에 넣어야 한다.

### 교재 — **꼬리 낱말 수가 곧 계단이다** (v06.338)

집필 지문을 목표 밴드에 떨어뜨리는 법을 세 점으로 실측했다. 두 번 빗나가고 세 번째에 잡혔다.

| 꼬리(V+1~V+2 낱말) | 편수 | 적중률 | 아래로 | 위로 | 평균 어긋남 |
|---|---|---|---|---|---|
| 0개 (V3 목표) | 10 | 20% | 6 | 2 | **−0.40** |
| **4~5개** (V2 목표) | 12 | **75%** | 0 | 3 | **+0.33** |
| 7~9개 (V3 목표) | 52 | 13.5% | 1 | 44 | **+1.00** |

평균 어긋남이 꼬리 수에 **단조롭게** 따라간다(−0.40 → +0.33 → +1.00) — 낱말 하나당 약 0.17계단.
`compute_article_vrl` 이 서로 다른 낱말 V-Level 의 p75 로 매기므로, 상위 25% 경계를 어디에 두느냐가
곧 계단이다. **많이 넣을수록 좋은 게 아니다.**

- `write-drain-export.mjs --tail N --at N` — 어휘 조건을 인자로. 기본 `tail 4` (실측된 유일한 75%).
- 실험 조건을 `composed_spec.tail_min/tail_max/at_band_min/at_band_max` 에 기록한다 —
  **안 남기면 "어떤 지침으로 쓴 글인지" 를 알 수 없어 조건별 적중률을 못 낸다.**

**■ 재확인 — 교란을 없애고 같은 밴드에서 다시 쟀다**

처음 세 점은 가운데만 목표가 V2 라 "꼬리 수만 다른 것" 이 아니었다. V3 목표로 37편을 더 써서
같은 밴드 안의 세 점을 만들었다:

| 조건 (전부 V3 목표) | 편수 | 적중률 | 아래로 | 위로 | 평균 어긋남 |
|---|---|---|---|---|---|
| 꼬리 0개 | 10 | 20% | 6 | 2 | −0.40 |
| **꼬리 4~5개** | 37 | **64.9%** | 4 | 9 | **+0.16** |
| 꼬리 7~9개 | 52 | 13.5% | 1 | 44 | +1.00 |

**13.5% → 64.9%**, 같은 밴드에서 거의 5배다. 규칙이 교란 없이 확인됐다.

**■ "한 권 = 원글 60편" 이 틀렸다**

V3 는 문항이 붙은 원글 40편으로 **8단원**에서 멈췄다. 근거로 삼았던 "V6 는 원글 58편으로
20단원" 이 오해였다 — V6 의 원글은 평균 3,000어짜리 외부 기사라 **편당 문항이 9개**(517/58)다.
우리가 쓰는 교재 지문은 130~190어라 문단이 둘뿐이고 **편당 문항이 4개**를 넘지 못한다.
원글 하나가 한 단원에 문항 하나만 낼 수 있으므로 짧은 지문으로 책을 채우려면 원글 수 자체가
훨씬 많아야 한다. 실측 단원당 약 5편 → **20단원이면 80편 이상.** `VOLUME_ARTICLES` 60 → **85**.

이 수를 낮게 잡으면 export 가 "다 썼다" 고 말하는데 책은 안 나온다 — 가장 나쁜 종류의 거짓말이다.

**■ 단원 이득 (누적)**

| 밴드 | 원글 | 문항 풀 | 조합 단원 |
|---|---|---|---|
| V2 | 38 | 74 | 3 |
| V3 | 58 | 145 | 8 |
| V4 / V5 / V6 | 120 / 85 / 58 | 285 / 540 / 517 | 20 / 20 / 20 |

### 교재 — 소스 GET 한 바퀴가 337편, 그런데 논증문은 0편이다 (계측)

배선된 피드 38개를 관리자 화면이 부르는 그 함수로 전수 호출했다(`scripts/textbook/source-yield-probe.mjs`,
읽기 전용 · seed_catalog upsert 안 함). **1회 GET 464건 → 기보유 제외 383편 → 교재 가용 337편.**

- **논증문 재고가 구조적으로 0** — 신규 논증문 46편이 전부 `the_conversation`(CC-BY-ND →
  `display_only`)이라 문항 생성기가 통째로 건너뛴다. DB 논증문 84편 중 71편이 같은 이유로 죽어 있다.
  유일한 대안 `owid` 는 atom 피드가 최근 10건만 노출해 이번 GET 신규 **0**.
  수능 지문의 중심 결이 논설인데 공급선이 없다.
- **수확 0인 피드 5개의 원인이 셋으로 갈린다** — 원본을 같이 받아야 갈린다:
  spec 전량 거절(`nih:medlineplus` 원본 54건 · `nasa:apod` 7건) / 차단·도달 불가(`nih:news` 403 ·
  `nih:directors-blog`) / 소스 비활성(`wikinews:latest` 원본 0건).
  **`nih` 는 3피드 전멸** — 소스 14개 중 지문을 내놓는 것은 11개.
- **입문 밴드 상류가 얕다** — `simple_wikipedia` 총 143편(VG 30 + Good 113) 중 40편 보유,
  **남은 것 103편**. `factbook` 은 코드에 35개국 고정이라 28편이 끝.
  반면 `plos` 351만 · `wikipedia` 5.2만은 사실상 무한이나 전부 C1–C2 라 학령 사다리 아래쪽은 못 채운다.
- 유형(register)별 신규: 설명문 241 · 참고문 63 · 서사 30 · 시사 3 · **논증문 0(가용)**
- ⚠️ 환산 문항 6,375 는 "지문당 문항" 곱셈 추정이다 — 상위 3소스가 추정의 79%인데
  그 계수의 표본이 8·12·15편으로 작다. 실측이 필요하면 `stock-probe.mjs`.
- 리포트: <https://claude.ai/code/artifact/e28042b9-2551-4be7-9aaa-026d01faf446>

### 교재 — 집필 드레인. **사다리가 끊긴 건 문항이 아니라 원글 때문이었다** (v06.337)

한 단원 안에서는 원글이 겹칠 수 없다(같은 글을 두 번 읽히면 단원이 아니다). 그래서 조합기는
문항 수보다 **원글 수**에서 먼저 바닥난다 — 실측: V2 원글 5편 → 0단원 · V3 8편(문항 31개인데도)
→ 0단원 · V4 27편(문항 137개) → 8단원. **문항을 더 만들어도 소용없다.**

- 신설 `scripts/textbook/write-drain-{export,import}.mjs` — 3단 드레인.
  import 는 6문장·60어 미만을 **넣지 않고** 건너뛴 수를 찍는다(빈 값이 들어가면 다음 export 가
  "원글이 늘었다" 고 세는데 문항은 안 나와 구멍이 영영 남는다).
- `source='original'` · CC0 · **`ready` 로 넣는다**(발행은 사람 판단).
  `chk_original_needs_batch` 가 배치 소속을 요구하므로 실행마다 `article_compose_batches` 한 행을
  만들어 매단다 — **우회하지 않았다.** 마이그레이션 없음.

**■ 실측 — 길이는 밴드를 못 정한다**

기존 집필분 6편의 목표 밴드 대비 실제 배정이 2/6 이었다. `compute_article_vrl` 은
**서로 다른 낱말 V-Level 의 75분위**로 매기고 길이는 안 본다. 그래서 지침을 어휘로 바꿨는데,
1차 파일럿 10편은 **2/10** 이었고 빗나간 8편이 전부 *아래로* 떨어졌다(V2 6 · V4 2).

원인: `"75% 가 V3 이하"` 라는 지침이 **어려운 꼬리를 못 만들었다.** 재고 실측을 보면
V3 글의 프로필은 p50 **1.5** · p75 **3** · p90 **5.2** — 절반은 아주 쉽고 상위 10% 는 V5 까지
올라간다. 그 꼬리가 있어야 p75 가 3 이 된다. → 지침을 **셀 수 있는 목표**로 교체
(`V3 12~14개 · V4~V5 꼬리 7~9개`), 밴드 프로필은 DB 에서 실측해 청크에 실어 보낸다.

**■ 조용히 일을 버릴 뻔한 것 둘**

- 슬롯 번호가 실행마다 1 부터 다시 시작해 유일키가 지난 실행과 겹쳤다 — 새로 쓴 글이
  "이미 있음" 으로 버려지고 로그는 정상으로 보인다. → 이미 쓰인 번호 다음부터 매긴다.
- 사전 표본을 앞에서부터 뽑아 **전부 `a…` 로 시작**했다. 그런 목록은 어휘층을 못 보여 준다.
  → 알파벳 전 구간에서 흩어 뽑는다. (카운트 질의를 기존 빌더에 겹쳐 count 가 null 로 오던 것도 분리)
- `scripts/acp/reprocess.mjs` 가 `compose_batch_id IS NULL` 로 걸러 **거른 축이 틀렸다** —
  본문 유무는 `content` 가 말한다. 그대로 뒀으면 새로 쓴 지문이 어휘도 밴드도 없이 남았다.

**■ 1차 결과 — 52편을 써 놓고 단원은 0 이었다**

집필 52편 적재 → 분석까지 마쳤는데 문항이 **순서 0 · 삽입 28** 로 나왔다.
원인은 집필 지침이었다 — "`content` 는 한 덩어리 평문, 줄바꿈 금지" 라고 적었는데
생성기(`generateDcpItems`)는 본문을 **빈 줄로** 문단을 가르고 **순서 문항은 4~6문장 문단**에서만
만든다(도입문 1 + (A)(B)(C)). 52편이 전부 1문단 9~13문장이라 순서가 한 개도 안 나왔고,
단원은 순서와 삽입이 둘 다 있어야 하므로 **글을 52편 써 놓고 단원은 하나도 못 늘렸다.**

→ import 가 적재 시 문단을 4~6문장으로 **고르게** 나눈다(`repaginate`). 5문장씩 자르면
꼬리에 3문장 조각이 남아 그 자리가 통째로 버려지므로, 문단 수를 먼저 정하고 균등 배분한다.
이미 넣은 62편은 `--repaginate --commit` 으로 고쳤다(**이 드레인이 넣은 글만** 손댄다).
`MIN_SENTENCES` 6 → **8**(두 문단을 만들려면 최소 여덟 문장이다).

**■ 실측 이득**

| 밴드 | 원글 | 문항 풀 | 조합 단원 | 이전 |
|---|---|---|---|---|
| V2 | 25 | 38 | 2 | 0 |
| V3 | 32 | 59 | 4 | 0 |
| **V4** | 111 | 255 | **20 (한 권)** | 8 |
| V5 / V6 | 84 / 58 | 536 / 517 | 20 / 20 | 20 / 20 |

순서 문항 **0 → 101**. V4 가 자동 검수 **9/9** 로 한 권이 됐다 — 사다리에 완본이 셋이 됐다.

**■ 세 권 완비 — 80/80 · 9/9**

V4 해설 55건을 서브에이전트 6개로 채워 **V4 80/80 · V5 80/80 · V6 80/80**, 셋 다 자동 검수 9/9.

⚠️ 그 과정에서 **집필의 사이드이펙트**가 드러났다 — V4 를 채우려고 쓴 글 중 9편이 V5 로
떨어지면서 V5 의 권 조합이 바뀌어 **완비였던 80/80 이 68/80 으로 내려갔다.**
재고가 늘면 이웃 밴드의 완성본에 구멍이 다시 생긴다. 조판이 "없음 N" 으로 알려 주므로
**집필 뒤에는 건드린 밴드와 이웃 밴드까지 조판해 "없음 0" 을 확인한다**(도움말 `drain` 에 명시).

**■ 밴드 조준은 여전히 안 된다 (미해결)**

꼬리 지침을 넣은 2차 52편의 V3 적중은 **7편(13.5%)** 으로 1차(2/10 = 20%)보다 낮다.
다만 빗나간 방향이 뒤집혔다 — 1차는 6편이 아래로, 2차는 **44편이 위로**(V4 37 · V5 9).
과교정이다. 두 지침의 중간(꼬리 4~5개)이 맞을 것으로 보이나 **아직 실측하지 않았다.**
빗나간 글도 그 계단이 비어 있어 버리지 않는다 — V4 가 한 권이 된 것이 그 덕이다.


### 교재 — 해설 완비 3권 + **조용히 틀리던 두 곳** (v06.336)

Claude Code 서브에이전트 **15개**를 병렬로 돌려 해설을 채웠다(청크 하나 = 에이전트 하나).
결과: **V4 20/20 · V5 80/80 · V6 80/80** — 해설까지 완비된 책이 처음 세 권 생겼다.
V5·V6 은 자동 검수 9/9, V4 는 8/9(재고가 5단원치뿐 — 결함이 아니라 재료 부족).

그 과정에서 **측정이 조용히 틀리던 두 곳**을 찾았다. 둘 다 "다 됐는데 왜 2개가 남지" 로만 보였다.

**① 겨냥한 책 ≠ 조판된 책** — `render-volume.mjs`(조판)와 `explain-drain-export.mjs`(해설 몫)가
각자 풀을 만들었다. 주석엔 "같은 조합 규칙" 이라 적혀 있었지만 셋이 달랐다:
밴드를 원글(`article_v_level`) vs 문항(`v_level`) 으로 걸렀고 · `composeUnits` 에 단원 어휘 vs `new Map()`
을 넘겼고 · `display_only` 원글을 한쪽만 걸렀다. 62건을 **전부 채웠는데도** 책은 78/80 이었다.
→ 규칙을 `scripts/textbook/volume-pool.mjs` **한 벌**로 옮기고 양쪽이 `loadVolume` 을 부른다.

**② PostgREST 1000행 상한** — `.limit(20000)` 은 서버 상한을 **못 넘는다**(실측: Photosynthesis
어휘 1,072행 중 1,000행만 옴). 어휘를 원글 5편씩 묶어 물으니 배치가 잘려 **뒤쪽 원글이 "어휘 0"**
으로 보였다. 그 허수를 근거로 "어휘 없는 글 52편" 이라 판단하고 57편을 재분석했는데,
재분석이 밴드를 다시 계산해 **이미 완성한 권의 구성이 흔들렸다.**
측정이 틀리면 고치는 일이 망가뜨리는 일이 된다. → `fetchAllIn()` 이 `range` 로 다 받는다.
페이징을 고치자 V6 검수가 8/9 → **9/9** 로 돌아왔다(어휘 미달은 재료가 아니라 페이징 탓이었다).

- 신설 `scripts/textbook/volume-pool.mjs` — `loadEnv` · `loadVolume` · `fetchAllIn`
- `explain-drain-{export,import}.mjs` `--dir`/밴드별 폴더 — **밴드를 동시에 드레인해도 안 섞인다**
- `render-volume.mjs` 가 떨어진 검수 항목의 **이름을 찍는다**("8/9" 만으로는 아무도 안 찾는다)
- `scripts/acp/reprocess.mjs --missing-vocab` — 어휘 없는 글만 고르는 선택자
- 회귀 `volume-drift.test.ts` 7 — 드리프트 재발·`limit` 우회·밴드별 폴더를 구조로 막는다
- Admin 도움말 `textbook.ts` 에 해설 드레인 4단계 추가(재실행 안전 여부 명시)

### 교재 — Claude Code 몫을 **단계마다** 박았다 (v06.335)

이 저장소의 다른 파이프라인은 **단계·탭마다** 드레인을 따로 둔다 — VCB 3개 · PDCP 2개 ·
LCP·CCP·TCP·Compose 각 1개. 그런데 교재는 생성·적재를 묶은 **드레인 하나**뿐이라
"지금 어느 단계에서 Claude Code 를 돌려야 하는가" 를 알 수 없었다.

- `production-stages.ts` 에 `worker`(script/claude/human) + `claude`(역할·스크립트·저장·진척) 추가.
- `measureClaudeStages()` — 드레인이 **있는 단계와 없는 단계를 나눠 낸다.**
- `coverage.mjs` ⑤ 단계별 담당 절 추가.

**■ 실측 — Claude Code 몫 5단계 중 드레인은 1개뿐이었다**

| 단계 | 담당 | 배치 | 진척 |
|---|---|---|---|
| 1 기획 | 스크립트 | — | — |
| **2 집필** | 🤖 | ⬜ 없음 | csat_korean 2편, 둘 다 목표 레벨 못 맞춤 |
| **3 문항 제작** | 🤖 | ⬜ 없음 | 생성형 **0/11** |
| 4 원고 검토 | 스크립트 | — | — |
| **5 교정** | 🤖 | ⬜ 없음 | 기계는 "인쇄 불가 자국" 만 본다 |
| **6 해답·해설** | 🤖 | ✅ 있음 | V5 337 중 10건 |
| 7 내부 검수 | 사람 | — | — |
| **8 평가·개정** | 🤖 | ⬜ 없음 | 편향 표시 45건이 판단 대기 |

**■ `⬜` 는 막힌 곳이 아니라 아직 안 만든 곳이다.** 루트 CLAUDE.md §🤖 가 정한 대로
"LLM 이 필요하다" 는 **작업 시작 신호**다. 회귀가 이 규칙을 강제한다 — `worker: 'claude'`
인데 `claude` 가 비어 있으면 실패하고, `claude` 가 아닌 단계에 몫이 적혀 있어도 실패한다.

**■ 사다리 3·4단이 얇은 이유가 여기서 이어진다.** 집필(2)에 배치가 없어 V3~V4 지문이
안 늘고, 그래서 중1-2·중3 계단이 낱말 뜻으로 채워진다. 단계 지도가 그 인과를 한 줄로 보인다.

### 교재 — 편향·차별 검토 표시. **판정하지 않는다** (v06.334)

검정 교과서가 거치는 심사(양성평등·장애인 인식·다문화·지역/직업 편견)의 자리가 우리에게
없었다. 게이트는 법적 안전만 보고 표현의 공정성은 안 봤다. **없음 → 대등.**

- `textbook/bias-review.ts` + `scripts/textbook/bias-review-report.mjs`.

**■ 이 검사가 하지 않는 것부터.** 어떤 글이 편향적인지는 사람이 판단할 일이다 —
노예제·전쟁·장애를 다루는 지문이 낱말 때문에 걸러지면 안 되고, 반대로 낱말이 깨끗해도
서술이 편향될 수 있다. 기계가 할 수 있는 일은 **사람의 눈이 갈 자리를 좁히는 것**뿐이다.
그래서 산출물은 `pass/fail` 이 아니라 **검토 표시**이고, **아무것도 지우지 않는다** —
조용히 빼는 것이 걸러 내는 것보다 나쁘다.

**■ 비하 목록은 코드에 박지 않고 주입한다.** 그 판단은 편집 사안이라 한곳
(`scripts/dict/SLUR_CANDIDATES.json` · 45항목, 낱말마다 한국어 사유)에서 관리돼야 한다.
파일이 없으면 그 검사만 건너뛰고 **건너뛰었다고 적는다**(조용히 통과시키지 않는다).

**■ 실측 3,467지문 — 검토 표시 45(1.3%)**

| | |
|---|---|
| 비하·낡은 호칭 | 21 |
| 성별 표시 직업어 | 27 (`mankind` 16 · `businessmen`·`chairman` 각 3 …) |
| **성별 대명사 균형** | 남 4,519 : 여 1,694 — **χ²=1,284.5 (임계 3.841) 쏠림** |

대명사 쏠림은 검정 심사의 **양성평등** 축이 정확히 보는 것이다. 한 지문이 기우는 것은
편향이 아니므로 **재고 전체를 모아 놓고** 본다.

**■ 표시는 결함이 아니다 — 실측으로 확인했다.** `colored` 9건은 대부분
`colored glass`·`colored uniform` 이었다(Gothic cathedrals · Baseball uniform).
사전 큐레이션 목록은 **낱말 카드의 표제어** 기준으로 만들어졌고 지문 안 용법과는 다르다.
"검토 표시" 설계에서는 이것이 올바른 동작이지만, 리포트를 "결함 45건" 으로 읽으면 안 된다.

**■ 곁가지로 고아 행을 찾았다.** 인종 멸칭이 든 문항 4건은 `kind='book'` 인데 그 `ref_id`
가 `library_books`·`texts`·`library_articles` 어디에도 없다. 카탈로그 조인이 안 되므로
**학습자에게 도달하지 않지만**, 출처를 모르는 문항이 재고에 있다는 뜻이다 — 별도 정리 대상.

### 교재 — Admin `/admin/textbook` + **Claude Code 드레인 절차** (v06.333)

교재 파이프라인의 상태는 지금까지 **스크립트 일곱 개를 따로 돌려야** 보였다. 관리자가
"지금 어디가 막혔나" 를 묻는 자리는 하나인데 답이 일곱 군데에 흩어져 있으면 아무도 안 본다 —
이 저장소는 그 사고를 이미 겪었다(잠긴 화면을 아무도 안 봐서 이틀간 결함이 남았다).

- `/admin/textbook` (신규 라우트) — 학령 사다리 · 유형별 문항 + 정답 번호 χ² · 평가 우위 15요소.
- `lib/textbook/console-stats.ts` — 집계. `lib/admin/help/textbook.ts` — 도움말.
- AdminSidebar 에 `TBP Pipeline` 추가.

**■ 이 화면에는 조작 버튼이 없다.** 문항 생성은 사전·재고 전체를 훑는 일이라 웹 요청 시간
안에 안 끝나고, 규칙이 바뀌면 이미 넣은 것까지 다시 재야 한다 — **그래서 Claude Code
드레인이다.** 화면이 말하는 것은 "지금 어떤 상태인가" 뿐이고, "다음에 무엇을 돌려야
하는가" 는 도움말의 드레인 절차가 진다. 회귀가 그 둘을 함께 못 박는다.

**■ 드레인 절차 6단** — 저장소 관행대로 **재실행 안전 여부를 단계마다 명시**했다:
인자 없이 세기(아무것도 안 씀) → `--prune`(되돌릴 수 없음) → `--commit`(유일키가 막아
몇 번 돌려도 같음) → 건강 점검 → 사다리 확인 → 권 조립 미리보기.
확인 방법은 "인자 없이 다시 돌렸을 때 **새로 넣을 문항 0 · 낡은 것 0**".

**■ 화면이 눙치지 않는 것 넷** (회귀가 강제):
끊긴 계단을 계단 수에 세지 않는다 · 저장 형식에 번호가 없는 유형을 "고름" 으로 찍지 않는다 ·
**관측 0 을 경고로 말한다** · 조회가 깨지면 빈 표 대신 이유를 말한다.

⚠️ 초등 3종은 사전의 순수 함수라 저장하지 않으므로 **이 화면의 사다리에서는 초등이 비어
보인다**. 실제 수율은 `series-report` 가 낸다 — 그 사실을 화면과 도움말에 함께 적었다.

### 교재 — "시중보다 낫다" 의 분모를 세웠다: 평가 요소 15개 · **우위율 33%** (v06.332)

목표가 "시중 상업 교재보다 평가 우위" 라면 **분모가 있어야 한다.** 없으면 "낫다" 는 광고 문구다.

- `textbook/evaluation.ts` — 평가 요소 15개 대조표 + `measureEvaluation`.
- `scripts/textbook/evaluation-report.mjs` — 요소별 시중/우리/근거를 한 장에.

**■ 분모는 시장에서 가져왔다** (조사 2026-08-21). 교재 평가 연구의 **4대 대범주**
(법령·규범 및 공정성 · 외형 및 실용성 · 교육과정의 준수 · 교육 방법 및 내용)를 뼈대로 하고,
시장이 실제로 고르는 기준(해설의 깊이 · 수준별 구성 · 시험 유형 반영)을 더했다.

**■ 실측 — 우위율 5/15 = 33%**

| | 요소 |
|---|---|
| 🟢 우위 5 | 지문 저작권 · 지문 규격 일관성 · 정답 번호 균등 · 오답의 변별력 · 개정 속도 |
| ⚪ 대등 3 | 인쇄 청결 · 학령 사다리 · 교육과정 어휘 준거 |
| 🔴 열위 5 | 기출 지문 사용 · 학교별 내신 대응 · **유형 커버리지 5/18** · **해설 6.9%** · 실사용 난이도 |
| ⛔ 없음 1 | 편향·차별 표현 심사 |
| ❔ 못 잼 1 | 지문 레벨링 |

**■ 우위는 대개 "시중이 검증 결과를 공개하지 않는 것" 에서 나온다.** 정답 번호 균등(카이제곱) ·
오답 변별력(불변식 0건) · 지문 규격(0%) · 개정 속도(낡은 문항 자동 검출)는 모두 **기계가
매번 확인하고 숫자를 남긴다**. 편집자가 안 한다는 뜻이 아니라, 확인했다는 증거가 상품에
안 붙는다는 뜻이다.

**■ 열위는 숨기지 않는다.** 유형 커버리지 5/18 과 해설 6.9% 가 크게 진다. 둘 다 남은 길이
LLM·외부 재료라 이 파이프라인이 지금까지 피해 온 도구를 필요로 한다.

**■ "지문 레벨링" 은 못 잰 것으로 뒀다.** 자동 레벨링은 우위처럼 보이지만
**눈금 자체가 12밴드 중 V7 하나만 검증됐다**(`claude_verified` 1.00 · V6 0.70 · 나머지
`in_progress`). 자동화와 눈금의 신뢰도는 다른 문제다 — 근거 없이 우위라고 적지 않는다.
회귀가 이 규칙을 강제한다(우위로 적으려면 `howMeasured` 에 실측 근거가 있어야 한다).

### 교재 — 시리즈 사다리 7단, **전부 이어졌다** (v06.331)

국내 독해 교재 시장은 출판사마다 전 학령을 잇는 **하나의 사다리**를 갖는다
(능률 주니어리딩튜터→리딩튜터→빠바→리딩파워 · 쎄듀 왓츠리딩→리딩릴레이→1316→첫단추→천일문 ·
EBS 올림포스→수능특강→수능완성→기출의미래). 그리고 독해는 어휘보다 **단계가 훨씬 촘촘하다**(5~7단) —
난이도가 연속적이라 레벨링 수요가 크고, **지문 레벨링은 시장이 이미 돈을 내고 사는 기능**이다.

- `textbook/series.ts` — 계단 7단 정본 + `measureSeriesFill`.
- `scripts/textbook/series-report.mjs` — 사다리를 재고에 대 본다.

**■ 사다리를 새로 만들지 않았다.** `vocaflow_levels` 가 **이미 학령 사다리**다 —
`korean_school` 이 곧 계단 이름이다(V1 초등저 · V2 초등고 · V3 중1-2 · V4 중3 · V5 고1 ·
V6 고2 · V7 고3/수능). 시리즈는 그 위에 얹는다. **눈금이 둘이면 반드시 갈린다.**

**■ 계단마다 유형이 다르다.** 초등에 순서·삽입을 넣으면 안 되고(그 유형은 수능 지문 길이를
전제한다) 고등에 파닉스를 넣으면 안 된다. 회귀가 이 둘을 못 박는다.

**■ 실측 — 7단 전부 채워진다** (문항 총 8,004):

| 계단 | 학령 | 문항 | 구성 |
|---|---|---|---|
| 1 | 초등 저 | 1,833 | 운율 427 · 낱말뜻 838 · 철자 568 |
| 2 | 초등 고 | 2,155 | 운율 344 · 낱말뜻 1,072 · 철자 702 · 영작 37 |
| 3 | 중1-2 | 822 | **낱말뜻 739** · 영작 63 · 어휘 20 |
| 4 | 중3 | 411 | 영작 210 · 어휘 131 · 어법 70 |
| 5 | 고1 | 1,077 | 어휘 389 · 어법 135 · 순서 233 · 삽입 320 |
| 6 | 고2 | 1,241 | 어휘 382 · 어법 145 · 순서 305 · 삽입 388 · 무관 21 |
| 7 | 고3/수능 | 465 | 어휘 31 · 어법 13 · 순서 206 · 삽입 212 · 무관 3 |

**■ "초중급 재고 0" 이라던 오진이 완전히 뒤집혔다.** 초등 두 계단이 **3,988문항**으로 가장
두껍다 — 지문이 필요 없는 유형이라 사전 크기만큼 나온다. 오진의 원인은 재료가 아니라
**유형을 잘못 적용한 것**이었고(초등에 순서·삽입), 그 사실이 여기서 숫자로 확인됐다.

**■ 그런데 3단은 독해책이 아니다.** 822문항 중 **739가 낱말 뜻**이고 어휘 문항은 20개뿐이다.
중1-2 구간이 사실상 어휘책으로 채워져 있다 — 시장에서 이 구간은 주니어 리딩튜터·리딩릴레이가
잡는 자리라 **경쟁이 가장 센 곳**인데 우리가 가장 얇다. 4단(중3) 411 도 최소다.
원인은 V3~V4 지문 재고가 얇은 것이고, 그건 ACP 수집 밴드 편중에서 온다.

### 수능 — 출제 설계도 13개년 전수 계측 + 홀드아웃 검증 99.7% (v06.334)

평가원 출제 기준을 **기출에서 귀납**해 유형 43종(현행 37·폐지 6)과 유형별 제약을 만들고,
그 설계도가 처음 보는 시험지에도 통하는지 홀드아웃으로 쟀다. → **[CSAT_BLUEPRINT.md](./CSAT_BLUEPRINT.md)**

| 단계 | 결과 |
|---|---|
| 문항 추출 | 630/630 (누락 0) |
| 유형 배정 | 585/585 (미배정 0 · 중복 0) |
| 설계도 적합도(leave-one-exam-out) | **583/585 = 99.7%** · 최근 8회차 전부 45/45 |

**검증 방식이 핵심이다.** 실측에서 뽑은 제약을 같은 실측으로 검사하면 100% 는 동어반복이라
한 회차를 빼고 만든 설계도로 그 회차를 예측하게 했다. 86.3% → 95.7% → 99.7% 로 오른 것은
제약을 느슨하게 해서가 아니라 **형태가 틀린 것을 고쳐서**다:
절대 번호 → 영역 경계 · 지문길이 min/max → 판정 제외(양방향 소폭 위반은 잡음) ·
유형별 3점 가부 → **회차당 3점 10문항**(13개년 전부 성립, 2점35+3점10=100점).

검사가 잡아낸 추측 둘: 2014 장문 시작(43 으로 짐작, 실제 41) · **2014 듣기 22문항**(2015부터 17).

**커버리지 갭** — 현행 37유형 중 `csat_dcp_items` 생성기가 다루는 것 **18종(49%)**.
듣기 15종 전부 + 도표·안내문·장문 제목/어휘는 생성 수단이 없다(합 22문항 · 최소 44점).

산출물은 `.md` + JSON 으로 두었다. DB 화는 생성기가 이 제약을 실제로 강제할 때 —
지금 테이블을 만들면 아무도 읽지 않는 스키마가 하나 느는 것뿐이다.

⚠️ 문서 §6 에 **측정하지 않은 것**을 명시했다: 오답 설계 원리 · 주제 분포 · 정답 번호 ·
실제 정답률(수준 구분은 배점에서 추론한 것이지 정답률 실측이 아니다) · 듣기 지문.

### 수능 — 순서 유형 선택지가 고정 템플릿임을 발견 (v06.335)

설계도의 가장 큰 빈칸은 오답 설계인데, 정답 키가 없어 정답/오답 대비가 불가능하다.
그런데 순서 유형(36·37·43)만은 선택지가 (A)(B)(C) 순열이라 **의미 분석 없이 형식만으로**
규칙을 확인할 수 있다. 13개년 토큰 시퀀스를 대조한 결과:

| 문항 | 동일 시퀀스를 쓴 구간 | 교체 |
|---|---|---|
| 36·37 | 2015·2017~2023 (8회차 완전 동일) | 2024 |
| 43 | 2015~2016 / 2017~2023 | 2017 · 2024 |

즉 **선택지 순열 세트는 매 회차 설계하는 대상이 아니라 양식**이고 13년간 두 번 교체됐다.
36번과 37번이 같은 시퀀스를 쓴다 — 두 순서 문항이 동일 템플릿이다.

학습 함의: 6가지 가능 순열 중 5개만, 그것도 고정으로 쓰이므로 **첫 문단만 확정해도**
**후보가 2~3개로 준다.** 세 문단을 다 배열할 필요가 없다.

⚠️ 2단 조판 탓에 순열 자체는 복원 못 했다(토큰 11~15개만 회수). *고정이다* 는 증명됐고
*어떤 5개인가* 는 미해결 — 조판 좌표가 있는 PDF 파싱이 필요하다.

scripts/csat/measure-order-template.mjs · docs/CSAT_BLUEPRINT.md §2.1

### 사전 — 잔여 결손 일괄 해소: ipa · senses · VRL 룰 (v06.333)

| 필드 | 이전 | 이후 | 방법 |
|---|---|---|---|
| `ipa` | 77.1% | **80.7%** | CMUdict 적용(760) + 하이픈 복합어 합성(953) |
| `senses` | 81.3% | **81.7%** | 드레인 206행을 `meaning_ko` 에서 구조화 |
| `v_level_rule_v1` | 82.2% | **100%** | `calc_v_level` 재계산 8,491행 |
| `field_provenance` | 89.1% | **91.9%** | 위 작업의 출처 기록 |

**측정이 가설을 뒤집은 지점** — non-kice drift 18.4% 를 "룰 버전이 개정돼서" 로 봤는데,
재 보니 바뀌는 8,491행 중 **8,432행이 NULL 채움**이고 기존 값이 실제로 바뀌는 건 **59행**뿐이었다
(상향 3 · 하향 56). 파괴적 변경이 아니었다. 그래도 되돌릴 방법이 없는 값이라
`scripts/dict/vrl-rule-v1-snapshot.json` 에 옛 값을 남기고 진행했다.

**발음을 지어내지 않았다.** 드레인 낱말 중 `ipa` 가 빈 95개는 **CMUdict 에 하나도 없다** —
파생어(`monumentality`)·조어(`captology`)라 그렇다. 규칙으로 만들면 강세가 자주 틀리고
(monument→monumentality 는 강세가 옮겨간다) **학습용 사전에서 틀린 발음은 빈칸보다 나쁘다.**
하이픈 복합어만 조각을 이어 합성했다(`non-market` = `non`+`market`, 앞 조각 강세는 2차로 낮춤).
합성 대상 943개의 첫 조각을 전수로 훑어 CMUdict 단독 발음이 접두사와 어긋나는 것을 찾았고,
`re`(/ɹˈeɪ/ = 음계 "레") 하나였다 — `/ɹˈi/` 로 교정표에 넣었다.

그래서 **C8 은 채움률로 재지 않는다.** 남은 낱말은 영원히 기준선에 못 미쳐 늘 빨간불이 되고,
늘 빨간불인 검사는 아무도 안 본다. 대신 **"채울 수 있는데 비어 있는 것 = 0"** 을 본다.

검사 **9/9** (C8·C9 신설). ⚠️ `apps/web` typecheck 는 `fe252c99`(다른 세션의 Futurity 배선)의
`SeedSource`·`SourceKey` 미등록으로 실패 중 — 이 작업과 무관하고 손대지 않았다.

### 사전 — EBS 덱 대조 + 2014 A형 복구 (v06.332)

**EBS 보카 덱**(`.apkg`)을 기출 실측과 대조 (`scripts/dict/ebs-deck-compare.mjs` ·
`node:sqlite`+`zlib` 로 의존성 없이 zip+SQLite 를 읽는다). 파일명은 `_1800` 이나 **실제 1,306장**.

| 방향 | 결과 |
|---|---|
| 덱 → 기출 | 1,303 중 **749(57.5%)** 만 13개년에 등장 |
| 기출 → 덱 | 4개년+ 학습대상 192 중 **58(30.2%)** 만 수록 |

놓친 것: `individual`(12y) · `behavior`(12y) · `response`(11y) · `tend`(11y) · `define`(11y) …
원본 SQLite 에서 직접 확인했다(파싱 누락 아님). 역방향 지표에는 **난이도 하한**을 넣었다 —
안 넣으면 `time`·`people`·`good` 이 "덱이 놓친 핵심어" 로 잡혀 덱을 부당하게 깎는다.
`ebs-voca-1306` 태그 1,275 · 출처 불명확성은 `citation` 에 기록(수록 여부만 참조, 재배포 금지).

**2014 A형 복구** — `2014_A.txt`·`2014_B.txt` 가 둘 다 **B형**이었다(어휘 일치도 99.8% vs 25.3%).
A형은 한 번도 추출된 적이 없었다. `pdftotext` 로 뽑아 더했다:
토큰 29,876 → **31,359** · `kice_csat` 5,192 → **5,254행** · 전 연도 등장 58 → **65**.
새 표면형 521종이지만 **새 lemma 는 83종** — 추정이 아니라 접은 뒤 실측이다.

정합성 검사 **7/7 유지**.

### 사전 — 코퍼스 작업이 남긴 격차를 검사로 고정 (v06.331)

기출 드레인이 넣은 205행이 `primary_pos`·`pos_set`·`v_level`·`field_provenance` 를 **전부 비운 채**였다.
그리고 더 조용한 쪽 — `calc_v_level` 이 `lexicon_frequencies.frequency_tier`(kice)를 읽는데,
v06.330 이 그 tier 를 실측으로 고치면서 **`v_level_rule_v1` 1,943행이 룰과 어긋난 채 남았다.**
오류가 안 나므로 아무도 모른다.

- `scripts/dict/csat-dict-health.mjs` — 정합성 검사 7항목. 읽기 전용 · 종료 코드 반환 · 22초.
  **임계값을 하드코딩하지 않는다** — 전체 사전 채움률과 kice 밖 대조군 drift 를 매번 재서 기준으로 쓴다
  (짐작으로 정한 임계값은 목표가 아니다)
- 205행 파생 컬럼 채움 (`primary_pos`=`pos` — 실측 99.6% 일치하는 기존 규약 · `pos_set`=`[pos]` ·
  `v_level`/`v_level_rule_v1`=`calc_v_level` · `field_provenance.kice_csat_drain`)
- kice 5,446 낱말 `v_level_rule_v1` 재계산 (1,943행 변경 · 501 NULL 채움 · 상향 1,040 · 하향 402 ·
  평균 +0.12). **학습자에게 보이는 `v_level` 과 Claude 분류는 건드리지 않았다** — 대조군에서 두 값이
  64.8% 어긋나므로 통일하면 분류 결과가 지워진다
- `DB_SCHEMA` 의 `senses/primary_pos/pos_set/ipa_uk/us 100%` 주장 정정 —
  실측 senses 81.3% · **ipa_uk 0행 · ipa_us 0행**. 낡은 100% 주장은 "이미 다 됐다" 로 읽혀 보강을 건너뛰게 만든다

검사 14% → **100%** (7/7). 회귀 66/66 통과(compose sweep 55조합 포함) · typecheck 통과.
`ipa` 는 `data/cmudict/` 가 없어 채울 수 없어 분모에서 제외 — 외부 데이터 확보 시 별건.
### 사전 — 수능 기출 13개년을 **처음으로 실제로 세었다** (v06.330)

`lexicon_frequencies` 의 `kice_csat`(3,369행)은 이름이 전부 빈도였는데 **빈도가 아니었다.**
`raw_count` 최댓값이 9였고(13개년인데), `appears_every_year` 는 3,369행 **전부 false** 였다 —
매년 나오는 낱말이 하나도 없다는 뜻이다. `social` 은 2014 한 해만 기록돼 있었고
`people`·`time`·`make`·`world` 는 **표에 아예 없었다.** 문항별로 골라 적은 핵심어 목록을
빈도 테이블에 넣어 둔 것이고, 원문을 센 적은 없었다.

원본 .txt 13개년(2014~2026)을 WLP 로 토큰화해 교체했다 — **내용어 29,876 토큰 · 표제어 5,727**.

- `scripts/dict/csat-corpus-build.mjs` — 원문 → 토큰 빈도. **홀수형+짝수형이 한 파일에 든 2023·2024·2026**
  을 분리하고(안 하면 그 세 해만 2배), `2014_B.txt` 는 `2014_A.txt` 와 바이트 동일이라 제외(추출 사고)
- `scripts/dict/csat-corpus-diff.mjs` — 굴절형 접기(`inflected_forms` 권위 + 규칙 fallback) · 인명 가르기 · 사전 대조
- `scripts/dict/csat-corpus-apply.mjs` — 적재 (dry-run 기본 · `--commit`)

| | 이전 | 이후 |
|---|---|---|
| 행 수 | 3,369 | **5,300** |
| 등장 연도 수 | 최대 9 · 불일치 1,366 | 최대 **13** |
| `appears_every_year` | 0 | **58** |
| `normalized_freq` | 연도비율×10000 | **토큰 per 10k** |
| `question_history` | 673 | 673 **보존** |

**축은 일부러 바꾸지 않았다.** `resolve.ts` 의 `spec.min_years` 가 `raw_count` 를 "연도 수" 로 읽으므로,
거기에 토큰 빈도를 넣으면 `min_years: 3` 이 오류 없이 "3회 이상" 이 된다. 그 자리에 경고 주석을 남겼다.

**부수 발견** — vendor placeholder 목록에 기출 근거가 없다: `csat-prep-core-2k` 1,838 중 **678(37%)**,
`csat-prep-ext-1.8k` 1,097 중 **424(39%)** 가 13개년 원문에 미등장. 지우지 않고 `citation` 에 비율 기록.

새 `list_tags`: `kice-csat-13y` 5,046 · `kice-csat-core-4y` 1,378.
사전 결손 272종(`math`·`uncover`·`internalize`·`upcycling` 등)은 `diff.json` 에 남긴 후속 드레인 대상.

**후속 — 기출에 나왔는데 사전에 없던 낱말 146 등재.** `scripts/dict/csat-dict-drain.mjs`
(결손 272 → 해소기가 44 해결 → Claude Code 판정 228 → 인명·URL 조각·굴절형 82 skip → **146 등재**).
`shared_dictionary` 47,591 → **47,737**, `kice_csat` **5,446행**, **등장연도 불일치 0**.
`unresolved_dict_words` 게이트를 먼저 통과시킨다 — 안 하면 이미 풀리는 굴절형을 중복 등재한다.

### 교재 — 해설을 올리려던 두 실험이 **둘 다 실패했다** (v06.329)

Cycle 2 에 **"다음 레버는 희귀어 사슬"** 이라고 적어 뒀다. 재 보니 **틀렸다.**

| 실험 | 커버리지 |
|---|---|
| 지금(문턱 없음) | **6.9%** (91/1,316) |
| 어휘 사슬에 희소도 문턱(사전 `v_level`) | **6.2%** (81) — 더 나쁘다 |
| 이음매마다 근거를 하나가 아니라 전부 담기 | **6.2%** — 같다 |

**■ 왜 틀렸나.** `irrelevant.ts` 에서는 같은 생각이 통했다(흔한 낱말의 겹침을 빼니
Russell Lissack 같은 엉터리 후보가 걸러졌다). 그런데 **두 곳의 쓰임이 다르다**:

- 무관 문장 고르기는 **후보를 거르는** 일이라 잡음을 빼면 정확해진다.
- 해설은 **정답이 오답보다 근거가 많아야** 성립한다 — 잡음을 빼면 오답 쪽만이 아니라
  **정답 쪽 근거도 같이 사라진다.**

**■ 진짜 문제는 필터가 아니다.** 판별 실패의 내역이 그렇게 말한다 —
근거 없음 20.8% · 동점 37.8% · **오답을 더 가리킴 34.4%**. 마지막 항이 핵심이다:
표면 단서 모형이 **틀린 배열을 더 자주 선호한다.** 잡음을 줄여서 될 일이 아니라
**표면 단서로는 결속을 못 읽는** 것이다. 올리려면 의미 유사도(임베딩)나 LLM 이 필요하고,
그건 이 파이프라인이 지금까지 일부러 피해 온 종류의 도구다.

두 실험 모두 되돌렸다. 남긴 것은 **`Rarity`·`topicalBar` 를 `explain.ts` 로 옮긴 것**
(`contentWords` 와 같은 자리에 둬야 눈금이 갈리지 않는다 — `irrelevant.ts` 가 가져다 쓴다)과
**실패 기록**이다. 다음 사람이 같은 레버를 다시 당기지 않도록 코드 주석에 남겼다.

### 교재 — 평가가 찾은 결함을 고쳤고, **평가 자체가 틀린 걸 재고 있었다** (v06.328)

**고칠 것 7건 → 0건.** 그런데 그 과정에서 리포트 자체의 오류가 먼저 드러났다.

**■ ① 리포트가 틀린 걸 쟀다.** `insert` 의 `answer_key.position` 은 **문단 안 위치(1..n)**
이지 인쇄되는 ①~⑤ 가 아니다. 위치가 9까지 있었고 6~9 인 **76건이 히스토그램에서 조용히
빠져** 있었다. 그렇게 나온 χ²=208.6 은 엉뚱한 분포였다. `order` 는 "번호가 없어 못 잰다" 고
뺐는데 `toCsatOrder` 를 돌리면 나온다 — 안 재고 있었을 뿐이다.

인쇄 형식으로 바꿔 다시 재니 **`insert` 쏠림은 없었다**(χ²=3.2) · `order` 도 고름(χ²=2.6).

**■ ② 어휘 정답 번호 쏠림은 진짜였다 — χ² 52.7 → 6.3.** 두 번 헛짚었다:

| 시도 | 결과 |
|---|---|
| 가까운 문장에서 바꿀 낱말 고르기 | ②가 **50.9%** — 더 나빠졌다 |
| 오답을 앞뒤에서 몇 개 가져올지만 정하기 | χ² 52.7 → 38.7 — 다섯 문장 문단은 번호가 하나로 강제된다 |
| **번호를 먼저 고르고 그 번호를 만들 수 있는 낱말을 고르기** | **χ² 6.3** ✅ |

후보가 아니라 **번호를 균등하게 뽑는 것**이 요점이었다.

**■ ③ 지문 규격 밖 1,936건 — 문단을 통째로 쓰지 않는다.** `selectPassageWindow` 로
90~200어 연속 구간을 잘라 쓴다. 재고 숫자는 줄어 보이지만 **쓸 수 있는 재고는 늘었다**:

| | 저장 | 그중 사용 가능 | → 지금 |
|---|---|---|---|
| 어법 | 580 | 124 | **383 전부** (3.1배) |
| 어휘 | 1,095 | 458 | **968 전부** (2.1배) |
| 흐름 무관 | 45 | 40 | **40 전부** |

**■ 낡음의 정의를 넓혔다.** "인쇄 불가" 만 보던 판정으로는 이번 변경이 **하나도 안 걸렸을
것**이다. 이제 **지금 규칙으로 다시 만들어 대조**하고, 완성본 규격도 본다.
실측 1,425건을 지우고 재적재(마이그레이션 없음 · 관측 0행이라 잃은 학습 기록 없음).

**■ 겸용 유형은 규격 밖이 결함이 아니다.** `order`·`insert` 는 DCP 가 학습 화면(구문 연습)을
위해 만든 것이기도 하고, 그쪽은 4문장부터 받는다. 매번 "고칠 것" 으로 세면 리포트가 늑대를
부른다 — **`ℹ️ 학습 화면 전용 재고`** 로 구분하고 교재에 쓸 수 있는 수를 함께 낸다.

**■ 픽스처를 늘리다 회귀 둘을 무력화할 뻔했다.** 지문을 규격 안으로 늘리려고 붙인 꼬리가
두 번 사고를 냈다 — `that same year` 의 `that` 이 **지시사 후보**로 잡혀 어법 회귀가 엉뚱하게
통과했고, `according to the regional planning office …` 의 낱말들이 모든 문장에 공유되어
**결속도를 8로 치솟게** 해 흐름무관 회귀가 반대 이유로 실패했다.
**늘리는 재료가 무엇을 만드는지도 봐야 한다.**

### 교재 — 평가·개정 단계, 만들자마자 결함 7건을 찾았다 (v06.327)

상업 교재 제작 8단계 중 **마지막으로 없던 8번(평가·개정)**. 이제 **없는 단계는 없다** —
다만 다섯이 아직 반쪽이다(있음 3 · 일부 5 · 없음 0).

- `textbook/item-health.ts` — 정답 번호 쏠림(카이제곱) · 지문 규격 · 밴드 분포 · 관측 유무.
- `scripts/textbook/item-health-report.mjs` — 저장 문항 전체 상시 점검.

**■ 이 단계가 없던 이유는 분명했다** — `csat_item_attempts` 가 0행이라 어느 문항이 너무
쉽거나 어려운지 알 방법이 없었다. **그런데 정답률 없이도 잴 수 있는 것이 있었다.**
유형을 만들며 매번 붙인 검증기(판별력·유일성·쏠림·수율)가 곧 문항 사후 평가다.

**■ 쏠림은 비중이 아니라 카이제곱으로 본다.** "최다 30%면 나쁜가" 는 표본 수에 달렸다 —
10문항의 30%는 아무 뜻이 없고 1,000문항의 30%는 분명한 쏠림이다. 임계값은 **통계표**
(χ²(0.05), 자유도 4 → 9.488)이지 우리가 고른 숫자가 아니다.

**■ 첫 실행이 결함 7건을 찾았다** (4,838문항):

| 유형 | 정답 번호 | 지문 규격 밖 |
|---|---|---|
| insert (1,146) | 285·274·308·132·71 — **χ²=208.6 쏠림** | 453 (39.5%) |
| vocab_choice (1,095) | 138·256·278·215·208 — **χ²=52.7 쏠림** | 637 (58.2%) |
| grammar_choice (580) | χ²=3.9 ✅ | **456 (78.6%)** |
| order (930) | 저장 형식에 번호가 없다(못 잼) | 385 (41.4%) |
| irrelevant (45) | χ²=6.7 ✅ | 5 (11.1%) |

**삽입 문항의 정답이 ④⑤에 거의 안 온다** — ③만 찍어도 27%다(균등하면 20%).
그리고 **지문 규격 밖이 1,936건** — 문단을 그대로 지문으로 쓴 탓이다.
수능 지문은 90~200어인데 우리 문단은 그보다 길다.

**■ 못 재는 것을 통과로 눙치지 않는다.** 첫 판에서 `order` 가 "✅ 고름" 으로 찍혔는데,
그 유형은 정답이 배열이라 저장 형식에 번호가 아예 없다 — 0을 잰 것이었다. 답지 수를 0으로
두어 판정 대상에서 뺐다. **관측 0건이라는 사실도 리포트 본문에 적는다** — 안 적으면 다음
사람이 "평가 단계가 있다" 고 오해한다.

### 교재 — 초등 3종, 그리고 앞선 판단 둘이 틀렸던 이야기 (v06.326)

**초등 3/5 · 학교 4/14 · 유형 합계 9/32.** 지문이 필요 없는 유형이라 재고가 사전 크기만큼 있다.

- `textbook/elementary.ts` — **파닉스(운율 맞추기) · 교육과정 기본어휘 뜻 · 낱말 철자 완성**.

**■ "사전에 발음 정보가 없다" 는 앞선 판단이 틀렸다.** 실측하니 `ipa` **77.3%**(36,790) ·
`rhyme_key` **60.9%**(28,986)이고, 교육과정 초등 어휘는 **99.9%** 가 둘 다 있다.
게다가 `rhyme_key` 는 강세 모음부터의 각운이라 **철자가 달라도 소리로 묶인다**:

    -eɪk   bake · break · cake · lake · make · steak · take · wake
    -ɔl    all · ball · baseball · call · fall · small · tall · wall

파닉스가 가르치려는 것이 정확히 이것이다 — 철자가 아니라 소리로 묶는 것.

**■ "사이트워드(Dolch)" 도 틀린 기준이었다.** 국내 초등의 정본은 **2022 개정 교육과정
기본어휘 별표**이고, 그 목록이 `shared_dictionary.list_tags` 에 **이미 들어 있었다** —
`kcurr2022_1` 초등 808 · `_2` 중등 1,211 · `_0` 고등 1,006. 미국 목록을 옮겨 오는 대신
국내 교육과정을 쓴다(목표가 국내 학습 환경이다).

**■ 실측 수율 · 결함 0**

| | 초등(806) | 중등(1,210) | 고등(1,004) |
|---|---|---|---|
| 파닉스 운율 | **470** (58.3%) | 682 (56.4%) | 414 (41.2%) |
| 기본어휘 뜻 | **805** (99.9%) | 1,210 (100%) | 1,004 (100%) |
| 철자 완성 | **528** (65.5%) | 912 (75.4%) | 753 (75.0%) |

아홉 조합 전부 결함 0. 정답 번호 최다 비중 25.6~27.5%(고르면 25%).

**■ 답이 하나임을 어떻게 확인하는가** — 유형마다 다르다:

| 유형 | 확인 방법 |
|---|---|
| 운율 | 보기 중 제시어와 `rhyme_key` 가 같은 것이 **정확히 하나** |
| 뜻 | 유의어와 뜻 문자열이 겹치는 낱말을 오답에서 뺀다("사과" vs "사과나무") |
| 철자 | `c_t` 는 cat·cot·cut 이 다 된다 — **사전 47,591 낱말로 세어** 하나일 때만 낸다 |

오답 길이는 **제시어와 정답이 이루는 구간**에 맞춘다(`irrelevant.ts` 와 같은 규칙).
그 전에는 `afternoon` 문항에 `map`·`difficult` 가 섞여 읽지 않고도 배제됐다.

**■ 이 문항들은 DB 에 저장하지 않는다.** `csat_dcp_items` 는 글에 매인 표이고
(`ref_id` = 글 UUID) 초등 3종은 **낱말에서 나온다.** 억지로 넣으려면 가짜 `ref_id` 가
필요하고 표의 뜻이 깨진다. 게다가 사전의 순수 함수라 저장할 이유가 없다 — 사전이 바뀌면
저장본이 오히려 낡는다. 교재를 짤 때 그 자리에서 만든다.

**■ 제작단계 5번 교정 `missing` → `partial`.** `isPrintablePassage` · 낡은 문항 감지 ·
조사 자동 선택이 그 단계의 일을 한다. 다만 막는 것은 "인쇄하면 안 되는 자국" 뿐이고
오탈자·표기 일관성은 아직 못 본다. **없는 단계는 이제 평가·개정 하나다.**

### 교재 — 어법(29) 으로 **결정론 유형 5/5 완료** (v06.325)

**수능 5/18 · 문항 7/28 · 학교 1/14.** 결정론으로 만들 수 있는 유형은 이제 없다
(`deterministicGap` 이 비었다). 남은 13유형은 지문을 새로 써야 하거나 도표·안내문 같은
지문 밖 재료가 필요하다.

- `textbook/grammar-choice.ts` — **어법상 틀린 것(29번)**.

**■ 이 유형은 어려워 보였지만 착각이었다.** "어법이 맞는지" 판정하려면 구문 분석기가
필요한데 우리에겐 없다. 그런데 **판정할 필요가 없다** — 발행된 원문은 이미 맞고 우리는
답을 만드는 쪽이다. **반드시 틀리게 만드는 교체**만 쓰면 된다(원문 = 정답 키, DCP 와 같은 뒤집기).

    원문 an hour → 교체 a hour        (틀림 · 확정)
    원문 these books → 교체 this books  (틀림 · 확정)

**■ 다만 원문이 이미 어긋나 있으면 교체가 오히려 고친다.** 그러면 정답이 없는 문항이 된다.
그래서 **원문이 표준형과 맞을 때만** 손댄다 — `an hour`(자음 글자인데 an)·`a university`
(모음 글자인데 a)가 그래서 안전하게 빠진다. 예외이든 오류이든 우리가 만질 자리가 아니다.

**■ 실측 580/1,565 문단 = 37.1%** (관사 67.4% · 지시사 32.6%) · 정답 번호 최다 22.9%.
불변식 셋 모두 0: 정답 자리가 안 틀린 것 · **오답 자리가 틀려 있는 것**(답이 둘이 된다) ·
판정 불가한 자리.

⚠️ 우리가 만드는 것은 **한정사·지시사 수일치뿐**이다. 실제 29번의 관계사·분사·병렬·태는
구문 분석이 필요해 못 만든다. 유형은 덮었지만 구성은 부분집합이다.

**■ 표본을 눈으로 보다 오래된 누락을 찾았다** — VOA 기사 끝 **용어풀이**가 본문과 같은
문단으로 붙어 지문에 인쇄되고 있었다:

    _____________________________________________________ stimulate – v.
    to make (something) more active implant – n.

`generate-items.ts` 의 DCP 는 이런 보일러플레이트를 오래전부터 걸렀는데, 나중에 만든
유형들이 그 필터를 안 물려받았다. 인쇄 가능 판정을 `csat-format.ts` 에 모으고
(`isPrintablePassage`) 네 유형이 함께 쓰게 했다. 실측 오염:

| 유형 | 필터 전 | 필터 후 | 오염 |
|---|---|---|---|
| 어법 | 693 | **580** | 113 (16.3%) |
| 어휘 | 1,315 | **1,095** | 220 (16.7%) |
| 흐름 무관 · 영작 배열 | — | 변화 없음 | 이미 걸러지고 있었다 |

`store-new-types.mjs` 에 **낡은 문항 감지**를 넣었다 — 규칙이 엄해지면 먼저 넣은 것이
새 규칙을 못 받으므로, 매 실행이 기존 문항도 다시 재고 못 실을 것을 센다.
**세는 것과 지우는 것은 다른 스위치**(`--prune`)다.

**■ DB 적재** — 마이그레이션 `20260821110000` 로 `grammar_choice` 허용, **580행 적재**.
오염된 `vocab_choice` **220행 삭제**(`--prune`). 재실행 안전 확인(신규 0 · 낡은 것 0).

| 유형 | 문항 | 글 |
|---|---|---|
| insert | 1,146 | 157 |
| vocab_choice | 1,095 | 163 |
| word_order | 1,042 | 212 |
| order | 930 | 143 |
| grammar_choice | 580 | 124 |
| irrelevant | 45 | 29 |
| **합계** | **4,838** | |

**■ 하루 전에 만든 가드가 실제로 잡았다.** 580행을 넣은 직후 통합 테스트가
`분류되지 않은 유형 grammar_choice` 로 실패했다 — 새 유형을 저장해 놓고 어느 갈래인지
정하지 않은 것을 기계가 먼저 알아챘다. `dcp-types.ts` 에 분류를 넣어 해소.
처방은 허용 목록이라 그동안에도 학습자에게 새지 않았다(재확인: 5문항 전부 order/insert).

### 교재 — 어휘(수능 30번) + 새 유형 DB 적재 (v06.324)

**수능 4/18 · 문항 6/28 · 학교 1/14.** 결정론으로 남은 것은 어법(29) 하나다.

- `textbook/vocab-choice.ts` — **문맥에 맞지 않는 낱말(30번)**. 반대말로 바꿔 놓으면 답을 안다.
- 마이그레이션 `20260821090000` · `20260821100000` — `csat_dcp_items.type` 에
  `irrelevant`·`word_order`·`vocab_choice` 허용. **2,402행 적재**
  (vocab_choice 1,315 · word_order 1,042 · irrelevant 45). 재실행 안전 확인(재실행 시 신규 0).
  총계 **4,478 문항** (기존 order 930 · insert 1,146 포함).

**■ 적재가 학습자 처방에 새어 들어갔다 — 마이그레이션 `20260821093000` 으로 막았다.**
`prescribe_today` 는 유형을 가리지 않고 5문항을 뽑는데 학습자 화면(`DcpPlayer`)과 채점
RPC(`grade_dcp_item`)는 `order`·`insert` 만 안다. 적재 직후 실측으로 **발행 카탈로그 안
661/1,556 = 42.5%** 가 재생 불가였다. 클라이언트 매퍼가 모르는 유형을 `null` 로 버리므로
5문항이 줄어들고, 다섯이 다 새 유형이면 블록이 통째로 빈 상태로 뜬다. 가입자 3명 중
**1명이 S3** 라 잠재 결함이 아니었다.

고친 방식은 **저장은 그대로 두고 처방에서만 거르는 것** — 새 유형은 교재(인쇄물)용이고,
학습 화면이 그리게 되는 것은 별개 작업이다. 바뀐 줄은 `AND i.type IN ('order','insert')`
하나. 적용 후 재현 질의로 5문항 전부 `order`/`insert` 확인.

**■ 이 유형의 함정은 "바꿔 놨는데 안 틀려 보이는 것" 이다.** 문장 하나만 놓고 보면
`increase` → `decrease` 도 자연스럽다. 틀렸다는 건 **글의 나머지와 어긋날 때만** 드러난다.
그래서 **글 안에서 두 번 이상 나오는 낱말**만 바꾼다 — 한 자리만 바꾸면 나머지 자리에
원래 낱말이 남아 지문 안에 모순이 보인다. 그리고 굴절형은 안 건드린다(수일치가 깨지면
학습자는 뜻이 아니라 문법이 이상해서 고른다 — 어휘 문항이 어법 문항이 된다).

**■ 실측 1,315/1,565 문단 = 84.0%** — 지금까지 만든 유형 중 가장 높다.
정답 번호 최다 비중 **24.6%**(고르면 20%)로 쏠림이 없다. 불변식 셋 모두 0:
바뀐 낱말이 한 번이 아닌 것 · 원래 낱말이 사라진 것 · 밑줄이 같은 문장에 겹친 것.

**■ 같은 함정을 두 번 밟았다** — 세는 법이 생성기와 검증기에서 달랐다(`well-known` 을
한쪽은 한 낱말, 다른 쪽은 `well`+`known`). 낱말 쪼개는 정의를 하나로 모아 해소.

**■ 재료를 다시 재니 앞선 판단이 비관적이었다.** 반대말 보유율 33.1% 는 V11(17,981개 ·
21.0%)이 끌어내린 값이고, **대상 밴드는 V1 54.7% ~ V9 40.8%** 다.

**■ 영작 배열 부호 병목 실측** — 쉼표를 허용하면 2,674 → +876(**32.8% 증가**). 다만 추가분
전부가 쉼표 붙은 낱말이 그 자리를 알려 준다. 숫자만 남기고 규칙은 바꾸지 않았다.

### 교재 — 새 유형 둘, 그리고 "겹치는 낱말" 이 주제를 못 재는 이야기 (v06.323)

결정론으로 만들 수 있는데 없던 유형 둘을 만들었다. **수능 3/18 · 문항 5/28 · 학교 1/14.**

- `textbook/irrelevant.ts` — **흐름 무관 문장(수능 35번)**. 다른 글의 문장을 끼워 넣으면
  정답이 구조적으로 확정된다(DCP 와 같은 "원문 = 정답 키").
- `textbook/word-order.ts` — **영작 배열(중등 서술형)**. 어순을 섞으면 원문이 정답이다.
  낱말 수 **6~12어** — `scripts/textbook/sentence-probe.mjs` 실측(문장 28,455개, 중앙 14어,
  대상 밴드 V2~V5 중앙 11~13어)에서 나온 구간이다.
- `scripts/textbook/type-yield-probe.mjs` — 수율 + **작동 검증**.

**■ 아무 문장이나 끼워 넣으면 안 된다.** 첫 판은 549문항이 나왔는데 이런 것이 섞였다:

    주제: 덴마크에서 스톤헨지 형태의 목재 원형 유구 발견
    ⑤ During 2007, Russell Lissack formed his side project group Pin Me Down …

읽지 않고도 고른다. 그런데 지표는 "어렵다" 고 말하고 있었다 — 결속도를 **내용어 공유
개수**로 쟀기 때문이다. 이 문장은 `group` 과 `formed` 를 공유해 2점을 받았고, 둘 다
아무 글에나 나오는 낱말이다. **어휘 겹침은 주제 근접성을 재지 못한다.**

고친 것 셋:

| | |
|---|---|
| 희소도 문턱 | 주제를 지시하는 낱말만 센다. 문턱은 **그 문단 자신의 중앙 희소도** — 밖에서 가져온 숫자가 아니다 |
| 최소 결속 | 무관 문장도 주제어 하나는 공유해야 한다(`MIN_FOREIGN_COHESION = 1`). 그러면 본문 최소는 2 이상이어야 한다 — **짐작이 아니라 산술** |
| 완성 후 자가 검사 | 무관 문장이 희귀어를 들여오면 눈금이 움직인다. 실측 48개 중 2개가 그래서 답이 갈렸다 → 완성본 기준으로 다시 재고 갈리면 버린다 |

**■ 실측 수율** — 흐름 무관 **45/1,565 문단 = 2.9%** · 영작 배열 **2,550/28,455 문장 = 9.0%**.
불변식 둘 다 0: 정답이 유일 최소가 아닌 무관 문항 0 · 낱말이 늘거나 준 배열 문항 0.

영작 배열이 버린 이유는 **문장 안 부호 70.1%** 가 압도적이다(쉼표가 자리를 알려 준다).
같은 낱말 두 번(2.9%)은 정답이 갈려서, 낱말 수 밖(24.0%)은 손으로 못 풀어서 버린다.

**■ 어법(29)·어휘(30) 는 재료를 실측하고 미뤘다** — `pos` 100% · `antonyms` 33.1% ·
`inflected_forms` 32.0%. 반쯤 있는 재료로 만들면 문항의 3분의 2가 밴드 밖에서 나온다.

### 교재 — 결정론 해설, 그리고 커버리지 92.1% 가 거짓이었던 이야기 (v06.322)

상업 교재 제작 8단계 중 **6번(해답·해설)** 이 없었다. 순서·삽입은 정답 근거가 지문
표면에 남으므로(지시어 · 대명사 · 연결어 · 한정사 전환 `a→the` · 어휘 사슬) LLM 없이
쓸 수 있다.

- `textbook/explain.ts` — 근거 5종 탐지 + 해설 생성. **못 찾으면 안 쓴다**(`body: null`).
  단서 목록은 짐작이 아니라 실측이다 — `scripts/textbook/cue-probe.mjs` 로 문항 2,076개에서
  근거가 될 자리의 문장 5,495개를 뽑아 첫 낱말 분포를 세고, **거기 나타난 낱말만** 넣었다.
- `scripts/textbook/explain-probe.mjs` · `explain-discriminate.mjs` — 커버리지와 **판별력**.

**■ 첫 판은 92.1% 가 나왔고, 그 숫자는 아무것도 뜻하지 않았다.**
같은 탐지기를 **오답 답지에도** 돌려 보니:

| | 첫 판 (앞 글 전체와 대조) |
|---|---|
| 커버리지 | 92.1% (1,212/1,316) |
| **정답만 가리키는 해설** | **2.6%** (34) |
| 동점 — 가리지 못함 | 75.1% (988) |
| **오답을 더 가리킴** | **22.3%** (294) ← 해설이 오답을 변호한다 |

원인은 `before` 가 **단조 증가**한다는 것이었다. 어느 배열이든 뒤쪽 덩어리는 앞에 글이
많아 어휘 반복·대명사가 늘 걸린다. 92.1% 는 "해설을 썼다" 였지 "설명했다" 가 아니었다.

**■ 고친 것 둘.** ① 근거를 **인접**(바로 앞 덩어리 / 바로 앞 문장)으로 좁혔다.
② 답지 5개를 같은 잣대로 재 **정답이 유일 최다일 때만** 해설을 쓴다. 연결어·대명사는
앞 글을 들여다보지 않아 자리를 가리지 못하므로 **판별에서 뺐다**(해설에는 실린다).
가중치는 두지 않았다 — 근거 없이 정한 숫자는 짐작이다.

**■ 실측 6.9%** (91/1,316 · 순서 56/899 · 삽입 35/417). 회귀로 못 박은 불변식:
**해설을 쓰고도 정답이 유일 최다가 아닌 문항 = 0.**
못 쓴 이유는 근거 없음 20.8% · 동점 37.8% · 오답 쪽이 더 많음 34.4% —
표면 단서만으로는 결속을 다 못 읽는다. 다음 레버는 **희귀어 사슬**이다
(흔한 낱말의 반복은 어느 배열에서나 걸린다).

`production-stages.ts` 6번 `missing` → `partial`.

**■ 조사도 고쳤다.** `"animal" 를` 는 교재에서 그냥 오탈자다. 영어 낱말을 한국어로
옮겼을 때의 받침 유무로 을/를 · 은/는 · 이/가 를 고른다(animal 애니멀 · music 뮤직 →
받침 / mother 머더 · device 디바이스 → 없음).

### 교재 — 초·중·내신 유형과 **출처 축**을 세웠다 (v06.321)

수능 18유형만으로는 "유형별·연령별·수준별" 을 못 덮는다. **밴드마다 유형 체계의 축이
다르다** — 초등은 소리·낱말 단위(지문이 없다), 중등은 교과서 본문 + 서술형,
고내신은 교과서 지문 변형이다.

- `textbook/school-types.ts` — 초등 5 · 중등 6 · 고내신 3 = **14유형**.
  각 유형에 **채점 방식**(객관식·단답·서술형)과 **필요한 지문**을 붙였다.
- `textbook/passage-origin.ts` — **기출·기출변형은 유형이 아니라 출처다.**
  기출 빈칸도 빈칸이고 창작 빈칸도 빈칸이다. 한 표에 뭉치면 커버리지가 부풀려진다.

**■ 앞선 진단이 또 흔들린다.** "초중급(V1~4) 단원 0개" 를 재료 부족으로 봤는데,
**초·중등은 순서·삽입을 거의 쓰지 않는다** — 그 유형은 수능 지문 길이를 전제한다.
유형을 잘못 적용하고 있었을 가능성이 크다. 밴드에 맞는 유형은 따로 있다.

**■ 가장 싸게 만들 수 있는 유형 8개**(결정론 · 자동채점 · 지문 제약 없음):

    초등  파닉스 · 사이트워드 · 낱말 철자 완성
    중등  본문 어휘 뜻 · 단원 문법 · **영작 배열** · 빈칸 낱말 · 어법 고쳐 쓰기

**영작 배열**이 특히 값지다 — **중등 내신 대표 서술형인데 정답이 원문이라 확정된다.**
순서·삽입과 같은 성질이라 지금 구조로 바로 만들 수 있다.

**■ 지문 출처 5종 — 조건 없이 쓸 수 있는 것은 둘뿐이다.**

| 출처 | 권리 | 비고 |
|---|---|---|
| 창작(사실에서 새로 씀) | ✅ | 주제글이라 48h·2계통 면제 — **조건 없는 유일 경로** |
| PD·CC 원문 | ✅ | 지금 재고 전부. 소재가 수능 논설과 결이 다르다 |
| **기출** | ⚠ | 공개돼 있으나 이용 조건(공공누리 유형)을 건별 확인해야 |
| **기출 변형** | ⚠ | 지문을 그대로 쓰면 기출과 같은 조건. 지문까지 새로 쓰면 창작이다 |
| BYO (교사·학생 지문) | ◐ | **내신의 유일한 경로** — 본교 교과서는 공급 불가 |

조사 출처: <https://www.yoons.com/mediaroom/magazine/id/1046> ·
<https://www.edujin.co.kr/news/articleView.html?idxno=49058> ·
<https://baby.tali.kr/phonics-sightwords-learning>

### 교재 — 커버리지의 분모를 세웠다. 유형 2/18 · 문항 4/28 (v06.320)

"시중 교재 100% 커버리지" 를 목표로 삼으려면 **무엇의 100%인지**가 있어야 한다.
분모는 시중 교재가 아니라 **수능 유형 자체**로 잡았다 — 시중 교재가 그것을 모사하므로
원본이 더 엄격한 기준이고, 문항 유형은 아이디어라 저작권 문제도 없다.

- `textbook/csat-types.ts` — 수능 읽기 **18유형 / 28문항**(18~45번) 정본.
  유형마다 생성 방식(결정론·생성·외부재료)과 **왜 (안) 되는지 근거**를 적었다.
  회귀가 번호 중복·누락을 막는다(18~45 빠짐없이 · 겹침 0).
- `textbook/production-stages.ts` — 상업 교재 제작 8단계 대응표.
- `scripts/textbook/coverage.mjs` — 두 표를 한 번에 찍는다.

**실측 커버리지**

| 기준 | 값 |
|---|---|
| 유형 | **2/18 = 11.1%** |
| 문항 | **4/28 = 14.3%** (시험지 비중) |
| 결정론 유형 | 2/5 |
| 생성 유형 | **0/11** |
| 외부재료 유형 | 0/2 |

⚠️ 유형 수만 보면 빈칸(4문항)과 목적(1문항)이 같은 무게가 된다. **둘 다 낸다.**

**결정론으로 가능한데 아직 없는 셋** — 다음에 만들 것:

- **어법(29번)** — 규칙 기반(수일치·시제·태·관계사·병렬). 오답이 문법적으로 명확히
  틀리므로 모호성이 0 이다. **만들 값이 가장 크다.**
- **어휘(30번)** — 문맥상 반대·유사어 바꿔치기. 사전에 반의어·유의어가 있으면 가능.
- **흐름 무관(35번)** — 다른 지문의 문장을 끼워 넣으면 정답이 구조적으로 확정된다.
  순서·삽입과 같은 성질이다.

**상업 교재 제작 8단계 대비 — 있음 3 · 일부 2 · 없음 3**

| 단계 | 상태 | 갭 |
|---|---|---|
| 1 기획 | ✅ | — |
| 2 집필 | ◐ | 산출 레벨이 목표보다 2~3밴드 낮다 |
| 3 문항 제작 | ◐ | 18유형 중 2유형 |
| 4 원고 검토 | ✅ | — |
| **5 교정(초교·재교·삼교)** | ❌ | **아예 없다** — 오탈자·표기 일관성을 보는 곳이 없다 |
| **6 해답·해설** | ❌ | 정답만 있고 해설이 없다. 순서·삽입은 **결정론으로 해설을 쓸 수 있다** |
| 7 내부 검수 | ✅ | — |
| **8 평가·개정** | ❌ | 피드백 경로가 없다(`csat_item_attempts` 0행) |

조사 출처: <https://namu.wiki/w/대학수학능력시험/영어%20영역/문제%20유형> ·
<https://comento.kr/edu/learn/camp/detail-G854>


### 교재 — 재고 어림이 틀렸다. 실제는 V5 32단원 (v06.319)

9사이클 종합 리포트: <https://claude.ai/code/artifact/7d076747-01fe-4712-af71-38f4941ff6ee>

`stock-probe` 가 단원 상한을 `min(order/2, insert/2, refs/2)` 로 어림했는데
**실제보다 크게 낮았다** — V6 을 6단원으로 잡았으나 실제 조합은 17단원이다.
원글은 여러 단원에 재사용되므로 `refs/2` 가 상한이 아니다.
**어림 공식을 버리고 같은 조합기(`composeUnits`)를 돌린다.**

| V | published 만 | ready 발행 시 |
|---|---|---|
| 4 | 3 | 6 |
| **5** | **32** | 47 |
| **6** | **17** | 36 |
| 합계 | **52** | **89** |

앞 사이클에 보고한 "지금 22 · 발행 시 37" 은 그 어림 탓이었다. 실제는 52 / 89 다.

- **V5 32단원(1.6권)이 전부 자동 채점 9/9 통과.** 20단원으로 제한해 보던 동안
  실제 재고가 그 1.6배인 줄 몰랐다.
- V6 은 17단원이라 분량 항목만 미달. 20 달성은 `ready` 발행이 필요한데 **발행은
  사람 판단**이므로 자동으로 하지 않는다.


### 교재 — V5 자동 채점 9/9. 내 진단이 또 틀렸고 기준도 근거가 없었다 (v06.318)

**■ "어휘 재고가 부족하다" 던 진단이 틀렸다.**

    뜻 있는 낱말 총계     4,791
    밴드 ±1 (V4~6)        1,844   ← 필요한 400개(20단원×20)의 4.6배
    글별 평균 밴드±1        122개 (최소 16 · 최대 546)

재고는 넉넉했다. 마른 원인은 **내가 앞 사이클에 넣은 완전 중복 금지**였다 —
원글이 적어 뒤 단원은 이미 많이 쓴 글을 다시 받는데, 그 글의 낱말이 전부 소진돼
**20단원 중 2개가 어휘 0개**가 됐다.

**■ 완전 금지는 학습 원칙과도 어긋났다.** CLAUDE.md 학습원칙 2 는 **Spaced Repetition**
이다. 같은 낱말이 다른 지문에서 다시 나오는 것은 결함이 아니라 설계다. 막아야 할 것은
"한 글에서 늘 상위 5개만 나오는 것" 이었지 재등장 자체가 아니었다.
→ `MAX_WORD_APPEARANCES = 2` (금지 → 상한). 실질 재고 3,688개로 마르지 않는다.

**■ 채점 기준 `< 15` 에 근거가 없었다 — 내가 정한 숫자다.** 이 저장소에서 근거 없는
임계값을 세웠다 지운 것이 이번이 **네 번째**다. 없는 기준을 만드는 대신 **그 권이 실제로
도달한 값**을 목표로 삼아 미달 단원 수를 보고한다.

**■ 교재 생성이 비결정적이었다.** 같은 재료로 실행할 때마다 결과가 달랐다 —
"어휘 미달 0" 과 "미달 2" 가 번갈아 나왔다. 원인은 Supabase `.in()` 이 결과 순서를
보장하지 않는 것. **교재는 재현 가능해야 한다**(같은 판이 같은 내용이어야 한다).
문항·어휘를 명시적으로 정렬해 고정했고, 3회 연속 같은 결과를 확인했다.

**결과 — V5 자동 채점 9/9 통과** (20단원 · 어휘 고름 · 낱말 상한 준수 · 시중 분량 도달).
V6 은 17/20단원이라 분량 항목만 미달.


### 교재 — 한 줄이 병목이었다. 삽입 문항 4배, V5 1권 완성 (v06.317)

`isEligible` 이 **7문장 이상 문단을 통째로 버리고 있었다**(`length > 6 return false`).
순서(order)는 도입문 + (A)(B)(C) 세 덩어리라 4~6문장이 맞지만, **삽입은 지문이 길어도
자리만 5곳이면 된다** — 실제 수능 삽입 지문이 6~8문장이다.

버려지던 것을 세 봤다(길이 규격 90~200어에 드는 것만):

| V | 새 삽입 원글 | 추가 단원 |
|---|---|---|
| 4 | 15 | **+7** (지금 0단원) |
| 5 | 29 | **+14** |
| 6 | 19 | **+9** |

- `CSAT_INSERT_BODY = {min:5, max:9}` — 지문이 5~9문장이면 자리 5곳을 **고른다**.
  `pickSlots` 가 정답을 반드시 포함하고 나머지를 고르게 퍼뜨린다(정답만 외따로면
  위치로 찍힌다). 결정론이라 같은 지문은 늘 같은 자리를 얻는다.
- 생성기는 **상한만** 늘렸다(4~6 → 4~10). ⚠️ 하한을 5로 올리면 4문장 문단의 삽입이
  사라지는데, 그건 교재엔 못 써도(자리 3곳) **학습 화면의 구문 연습에는 유효한 재고**다.
  교재를 위해 이미 돌고 있는 기능을 깎지 않는다.
- `refresh-dcp-items.mjs` — 유일키 `(kind,ref_id,type,paragraph_idx)` 로 **없는 것만**
  채운다. 지우고 다시 만들면 id 가 바뀌어 학습 기록이 끊어진다.
  **698문항 추가**(순서 241 · 삽입 457).

실측 변화:

| | 이전 | 이후 |
|---|---|---|
| 삽입 문항(published) | 35 | **146** |
| 단원(published) | 10 | **22** |
| 단원(ready 발행 시) | 19 | **37** |
| V5 조합 | 7 | **20/20 — 1권 완성** |
| V6 조합 | 7 | **17/20** |

**■ 진단 함수가 실제와 어긋났고 회귀가 잡았다.** `explainDcpEligibility` 가 순서 기준으로만
설명해서 "문항 0개" 라 했는데 실제로는 삽입 1개가 나왔다. 이 파일 주석이 막으려던 바로
그것이다(*"규칙을 두 번 적으면 반드시 갈린다"*). 유형별로 설명하도록 고쳤다.

**■ 채점 결과 — 실패가 재고에서 어휘로 옮겨갔다.** V5 20단원 기준 자동 8/9:
`[학부모] 시중 교재 분량 20/20` 통과, 대신 `[교사] 단원마다 어휘가 충분하다` 가
**20단원 중 2개 미달**. 단원이 늘면 `usedWords` 가 쌓여 뒤 단원의 어휘가 마른다 —
V5 원글 51편의 밴드 맞는 어휘가 400개(20×20)에 못 미친다.


### 교재 — 3관점 채점표. 자동 8/9 통과, 실패는 재고 하나 (v06.316)

**■ 재고를 늘리는 두 길을 재서 비교했다**(`scripts/textbook/stock-probe.mjs`).
발행은 되돌리기 번거로우므로 **넣기 전에 얼마나 늘지** 미리 잰다(저장하지 않고 같은
생성기로 계산 — 발행 후 값과 같다).

| | 순서 | 삽입 | **단원** |
|---|---|---|---|
| 지금(published 만) | 140 | 35 | **10** |
| ready 162편까지 발행 | 280 | 65 | **19** |

**+9단원.** 반면 `csat_korean` 은 1편당 삽입 2개라 **2편 발주 = 1단원**이다.
발행이 압도적으로 빠르지만 **19단원이 상한**이라 1권(20)에 하나 모자란다 — 둘 다 필요하다.

병목도 확정됐다: **삽입 원글 수**. 단원마다 삽입 2개가 서로 다른 원글에서 와야 하는데,
수능 5자리는 6문장 문단에서만 나오므로 그런 글이 드물다. V1~4 는 사실상 0이다
(VOA 문단이 짧아 DCP 자격을 못 채운다).

**■ 목표의 마지막 축을 처음으로 쟀다.** "학습자·교사·학부모 종합 평가" 는 여기까지
한 번도 측정된 적이 없었다. `textbook/scorecard.ts` 신설 — 회귀 9종.

    채점 — 자동 8/9 통과
    ✅ [학습자] 지문 길이가 수능 규격이다        28문항 중 규격 밖 0
    ✅ [학습자] 같은 낱말을 두 번 외우게 하지 않는다   어휘 140개 중 중복 0
    ✅ [학습자] 한 단원에서 같은 글이 반복되지 않는다  7단원 중 반복 0
    ✅ [교사]  출처가 단원마다 밝혀져 있다        7단원 중 출처 없음 0
    ✅ [교사]  단원마다 어휘가 충분하다          15개 미만 0
    ❌ [학부모] 한 권이 시중 교재 분량에 닿는다     7/20단원

**■ 못 재는 것에는 점수를 붙이지 않았다.** 채점표를 전부 자동화하면 잴 수 없는 것에
가짜 점수가 붙는다. 이 저장소는 근거 없는 임계값을 세웠다 지운 적이 두 번 있어서
(소스 감사 Cycle 5·6), `human` 항목은 **질문과 재료만 남기고 통과율 분모에서 뺐다**:

- 오답이 매력적인가 — 순서·삽입은 원문 구조가 정답을 정해 오답 설계가 필요 없다.
  빈칸·요지를 넣는다면 이 질문이 핵심이 된다.
- 레벨 표기를 믿을 수 있는가 — `vocaflow_levels` 12밴드 중 **V7 만 검증**(KICE 13년,
  confidence 1.00) · V6 은 0.70 · 나머지 10밴드는 `in_progress`.
- 소재가 수업에 쓸 만한가 — 법적으로는 문제없으나 백과·보도자료·논문이라 결이 다르다.
- 왜 이걸 믿어야 하는가 — 학부모는 AI 문항을 검증할 수 없어 **누가 줬는가**로 판단한다.

### 교재 — csat_korean 은 이미 돌아간 적이 있었다 (v06.315)

"수능 register 지문을 생성해 보자" 였는데, **`article_compose_jobs` 에 csat_korean 발주가
이미 2건 done** 이었다(2026-08-18). 만들 필요가 없었고 결과를 보면 됐다.

| 제목 | 어수 | CEFR | register | 문단 | DCP 문항 |
|---|---|---|---|---|---|
| When a river runs low, a reactor goes quiet | **188** | B2 | expository | **4** | **4** |
| When a river fails, the grid answers | 149 | B2 | expository | **2** | **0** |

**문단 분할이 문항 수확을 좌우한다** — 4문단(각 5문장)은 4문항, 본문 1문단(8문장)은 0문항.
`csat_korean` 주석에 이미 적혀 있던 그대로다: *"'한 문단으로 쓴다' 를 지킨 초안은 구문
연습 문항이 0개 나왔다."* 명세가 옳았음이 실증됐다.

**■ 교재 풀에 안 들어가는 이유는 결함이 아니라 설계였다.** `csat_stage_catalog` 가
`WHERE status = 'published'` 다. 재저작 6편은 `ready`(검수 대기)라 아직 빠진다.
발행은 사람이 한다 — 게이트는 법적 안전만 보고 교육적 적합성은 사람 몫이다.

**■ 목표 레벨과 산출 레벨이 csat_korean 에서만 크게 벌어진다.**

| track | 발주 | 목표−산출 |
|---|---|---|
| **csat_korean** | 2 | **+3 · +4** |
| general_proficiency | 7 | +2 +1 +1 0 0 0 −1 |

원인을 "사전 미등재" 로 단정했다가 **실측으로 정정했다.** 미등재 20/13개가 전부 굴절형
(cooling·operates·suspending·withdrawing)이라 `compute_article_vrl` 이 해소기를 안 쓰는
것이 원인처럼 보였다. 그런데 해소기를 전면 적용하면:

    328편 중 올라감 23 · 그대로 293(89%) · 내려감 12 · 평균 +0.03

**거의 안 바뀐다.** 그 2편도 1밴드만 오른다(V3→V4 · V4→V5). 목표까지는 여전히 2~3밴드
모자라므로 **원인의 대부분은 생성이 목표보다 쉽게 쓰는 것**이다. 마이그레이션으로 서두를
값이 작다는 것도 함께 확인됐다.

**■ 미뤄 뒀던 과제 ③(어휘 20 중 9)을 해소했다.** 원인이 둘이었다:
- 앞 단원에서 쓴 낱말을 다시 실었다 — 원글이 적어 같은 글이 여러 단원에 재등장하는데
  (실측: 'Black hole' 이 7단원 중 4개에) 단원마다 독립으로 뽑으니 **늘 같은 낱말**이 나왔다.
- 글별 쿼터를 못 채우면 그대로 끝냈다 — 뒤 단원이 **19 → 5개**까지 줄었다.

권 전체 `usedWords` 추적 + 쿼터 미달 시 같은 단원 글에서 보충. **전 단원 20개 달성.**
보충 경로가 쿼터와 겹쳐 빈도를 두 배로 더하던 것은 회귀가 잡았다(24 vs 12).

### 교재 — 인용 잔해 차단. 그리고 세우려던 지표를 실측으로 기각했다 (v06.314)

문항 758개 중 **64개(8.4%)** 에 학술 인용 잔해가 있었고 **전부 PLOS** 였다:

    [넣을 문장] [] trained the model using a sample set and 71 features
    ① DBSCAN is a density-based clustering algorithm…

`[]` 는 논문의 `[12]` 에서 링크 텍스트만 사라진 자국이다(62건).

**■ 논문을 어휘 난이도로 가르려다 실패했다.** "고난도 어휘(V9+·미등재) 비율" 을
지표로 세우려고 재 봤더니 분포가 겹쳤다:

| 소스 | 고난도 어휘% | | 소스 | 고난도 어휘% |
|---|---|---|---|---|
| voa | 3.4 | | nasa | 9.9 |
| owid | 5.1 | | elife | 11.0 |
| simple_wikipedia | 7.6 | | wikivoyage | 12.1 |
| usgs | 8.7 | | **plos** | **13.6** (최소 8.4) |
| | | | **wikipedia** | **23.5** |

PLOS 가 최고도 아니고 하한(8.4)이 usgs 평균(8.7)보다 낮다. **임계값을 세울 수 없다.**
Cycle 5(소스 감사)에서 근거 없는 대응표를 세웠다 지웠던 것과 같은 자리라, 이번에는
**세우기 전에 재고 기각했다.** 확실히 잡히는 것은 인용 잔해 패턴 하나뿐이다.

- `hasCitationResidue` — `csat-format.ts`. 잔해가 있으면 **변환 자체를 막는다**.
- `generate-items.ts` 의 문단 적격에도 추가 — 앞으로 생성되는 문항은 애초에 안 만든다.
- `composeUnits` 는 조합 전에 거른다(`PoolItem.passage_text`).
- 회귀 4종 추가. 541 통과.

**■ 필터를 정확히 걸수록 단원이 줄었다** — 재고가 실제로 그만큼이었다는 뜻이다.

| | Cycle 2 | Cycle 3(형식) | Cycle 4(잔해) |
|---|---|---|---|
| V5 | 15 | 7 | **7** |
| V6 | 20 | 11 | **7** |

합계 **14단원**. 1권(20단원)에 못 미친다. **`csat_korean` 생성이 유일한 길임이
수치로 확정됐다** — 기존 PD 재고로는 형식·소재를 동시에 만족하는 지문이 부족하다.

⚠️ 이번 사이클 과제 ③(어휘 20 중 9만 채워짐)은 **손대지 못했다.**

### 교재 — 수능 인쇄 형식 변환. 저장 형식은 안 건드린다 (v06.313)

Cycle 2 에서 남은 결함 ①(선택지 개수)을 해소했다. 실제 수능은 이렇다:

    글의 순서   도입문 + (A)(B)(C) 세 덩어리 · 답지 5개 (원순서 (A)-(B)-(C) 는 빠진다)
    문장 삽입   지문 문장 사이 ①~⑤ 다섯 자리

- **스키마를 바꾸지 않았다.** DCP 의 `presented`·`remaining` 은 학습 화면
  (`DcpItems.tsx`)과 채점 RPC(`grade_dcp_item`)의 계약이다. 바꾸면 이미 돌고 있는
  구문 연습이 깨진다. 대신 `textbook/csat-format.ts` 로 **표현만 바꾼다**.
- `toCsatOrder` — 원문을 복원해 도입문을 떼고, 나머지를 3덩어리로. 라벨은 결정론으로
  섞어 원순서가 정답이 되지 않게 한다. 회귀가 "정답 답지대로 배열하면 원문이 된다" 를
  n=4·5·6 에서 확인한다.
- `toCsatInsert` — **6문장 문단에서만** 만든다. 자리가 5곳이어야 ①~⑤ 다.
  4·5문장 문단은 자리가 3·4곳이라 실전과 다른 형식을 연습시킨다.

**■ 저장 형식의 정답 편향을 발견했다.** `removeIdx ∈ [1, n-1]` 이라 **정답이 첫 자리에
절대 오지 않는다** — 반복하면 학습자가 알아챈다. n=6 일 때 제거 위치 1~5 가 ①~⑤ 에
그대로 대응해 편향이 사라진다. 6문장 제약이 형식과 편향을 동시에 푼다.

- 형식 제약을 **조합 전에** 적용한다(`PoolItem.body_sentences`). 조합한 뒤 발견하면
  단원에 "변환 불가" 자리가 생기고 그건 교재로 나갈 수 없다.
- 그 결과 단원 수가 줄었다 — **V6 20 → 11 · V5 15 → 7**. 줄어든 것이 아니라
  **앞의 20단원에 수능 형식이 아닌 문항이 섞여 있었다.**
- 회귀 13종 추가(csat-format) + 1종(형식 사전 제외). 538 통과.

**■ 남은 결함은 소재 하나로 좁혀졌다.** 실물에서:

    [넣을 문장] [] trained the model using a sample set and 71 features
    ① DBSCAN is a density-based clustering algorithm…
    ④ xGBoost is an integrated learning algorithm…

`[]` 는 **논문 인용 참조 잔해**이고(DCP 의 BOILERPLATE 필터가 `cited as` 등은 잡지만
`[]` 는 안 잡는다), 소재는 머신러닝 논문 방법 섹션이다. 수능 지문이 아니다.
형식은 맞췄으나 내용은 `csat_korean` 생성으로만 해결된다.

### 교재 — 단원을 풀에서 조합한다. 문항이 곧 지문이다 (v06.312)

Cycle 1 의 정의("지문 1편 + 그 지문에서 순서 3 + 삽입 2")가 산술적으로 불가능했다.
**DCP 문항의 payload 에 이미 지문이 들어 있다**(`presented`·`remaining`)는 것을 놓쳤다.

| 유형 | 문항수 | 평균 문장 | 중앙값 어수 | p10 | p90 |
|---|---|---|---|---|---|
| order | 379 | 4.8 | **114** | 64 | 186 |
| insert | 379 | 3.8 | **114** | 64 | 186 |

수능 순서·삽입 지문이 대략 100~130어다. **문항이 곧 수능 규격 지문**이고,
실제 수능도 순서·삽입을 각각 독립 지문으로 낸다.

- `textbook/compose-unit.ts` 신설 — 풀에서 조합. 규칙 셋: ① 지문 90~200어
  ② **한 단원 안에서 원글이 겹치지 않을 것** ③ 어휘는 그 단원이 쓴 글에서만.
  회귀 12종.
- ②가 핵심이다. 우리 풀은 원글이 적고 문항이 많아(V6 은 17편에서 168문항) 이 규칙이
  없으면 한 단원의 네 문항이 전부 같은 글에서 나온다. **문항 수는 채워지지만 교재로는 실패다.**
- `roundRobinByRef` — 원글을 번갈아 꺼낸다. 안 그러면 긴 글 하나가 앞 단원을 다 채우고
  뒤 단원이 굶는다.
- 실측 조합: **V6 20/20 단원** · V5 15/20(삽입 부족).
  각 단원 = 순서 2 + 삽입 2 + 어휘 · 17분 · 출처 4편 서로 다름.

**■ 실물을 보고 결함 셋을 찾았다.** 구조는 맞고 내용이 안 맞는다.

| 항목 | 판정 | 근거 |
|---|---|---|
| 지문 길이 | ✅ | 99~172어 |
| 문항 구조 | ✅ | 순서·삽입 |
| **선택지 개수** | ❌ | 순서 6개 배열(수능은 (A)(B)(C) 3개) · 삽입 4자리(수능은 5자리) |
| **소재** | ❌ | NASA 보도자료 `(#10775, PI: Sarajedini)` · 베이징 고용중심지 **논문 초록** |
| 어휘 배분 | **수정함** | 12개가 전부 한 글(Black hole)에서 나왔다 → 글별 쿼터 |

어휘 쿼터를 넣자 두 글로 퍼졌으나 **목표 20 중 9개만** 채워졌다 — 나머지 두 글에
밴드(V5~7) 맞는 낱말이 부족하다. 다음 사이클 과제.

**■ 소재가 근본 결함이다.** 보도자료·논문 초록·백과 항목은 수능 register(추상 논설)가
아니다. 이건 필터로 못 고치고 **`csat_korean` 으로 생성**해야 해결된다 —
Compose 파이프라인이 정확히 그 용도로 이미 명세돼 있다(130~190어 · 주제문→근거→함의 ·
지시어 결속). 주제글이라 48시간·독립 2계통도 면제다.

### 교재 — 단원 조립기 신설, 그리고 내 단원 정의가 틀렸다는 실측 (v06.311)

독해 교재 파이프라인의 없는 조각은 **"1 단원"이라는 산출물**이었다. 재료는 다 있었다 —
`vocaflow_levels`(학년 축 V0~11) · `csat_stage_catalog`(지문+등급+라이선스 173편) ·
`csat_dcp_items`(순서·삽입 1,378) · `library_article_vocabularies`. 묶는 자리만 없었다.

- `textbook/assemble-unit.ts` 신설 — 순수 함수. 재료가 모자라면 **부분 단원을 내지 않고
  막는다**(문항 2개짜리가 섞이면 권 전체의 신뢰가 깎인다). 회귀 12종.
- 어휘는 **밴드 ±1 우선, 그 안에서 지문 빈도 순** — 빈도만 보면 the·of 가, 등급만 보면
  한 번 나온 어려운 낱말이 올라온다. i+1(Desirable Difficulty).
- `scripts/textbook/build-unit.mjs` — 실 재료로 조립해 눈으로 본다.

**■ 돌려 보고 두 가지가 드러났다.**

① **길이 판단이 없어 127분짜리 "단원" 이 통과했다** — Prague 13,942어 · Kyoto 8,638어.
수능 지문은 130~190어다. `PASSAGE_WORDS = {min:120, max:250}` 를 넣었다.
⚠️ **문항 수확량과 교재 적합성은 반비례한다** — DCP 는 문단 단위라 긴 글일수록 문항이
많이 나온다(plos 27.5문항/편 · wikivoyage 13.0). 수확량만 보고 소스를 고르면 **정확히
틀린 것**을 고른다.

② **단원 정의 자체가 산술적으로 불가능했다.** 길이 게이트를 넣자 38단원 → **0단원**.

| 구간 | 지문수 | 편당 문항 | 최대 문항 |
|---|---|---|---|
| 250어 초과 | 97 | 3.2 | 26 |
| **120~250어(교재 지문)** | **5** | 1.2 | **2** |
| 120어 미만 | 11 | 0.0 | 0 |

교재 지문 길이에서 최대 2문항이라 "지문 1 + 순서 3 + 삽입 2" 는 성립할 수 없다.
**실제 수능도 그렇게 하지 않는다** — 순서·삽입은 각각 독립 지문이다.
다음 사이클에서 단원을 **밴드 풀에서 조합**하는 형태로 재정의한다.

**■ DCP 수확량 실측(322편)** — 문항이 나온 글 166편(51.6%) · order 688 + insert 688.
소스별 편당: plos 27.5 · noaa 14.2 · wikivoyage 13.0 · simple_wikipedia 3.6 ·
the_conversation 3.0 · **voa 0.3**. VOA 는 학습자용이라 문단이 1~2문장이고,
DCP 는 4~6문장을 요구한다 — **유일한 초중급 소스에서 문항이 안 나온다**(V2·V3 단원 0).

**■ 내 스크립트가 조용히 잘렸다.** Supabase 기본 1,000행 제한에 걸려 18단원 중 17개가
"어휘 0" 으로 보였다(실제로는 Prague 1,545개 보유). 오류도 경고도 없었다 — 이 세션에서
반복해 만난 부류다. 지문별로 나눠 받도록 고쳤다.

### ACP — VOA 피드 20개 중 8개만 쓰고 있었다 (v06.310)

`/radio/programs` 인덱스에 z-코드가 **20개**인데 배선은 8개뿐이었다. VOA 는 본문을 그대로
쓸 수 있는 유일한 소스(PD)라, 안 쓰는 피드는 그대로 공급 손실이다.

12개를 두드리고 **본문 어수까지 재서** 5개만 배선했다:

| z | 피드 | 목록 | 부적합% | 본문 어수 |
|---|---|---|---|---|
| 4456 | Everyday Grammar | 11 | 0.0 | 916 · 1,164 · 798 |
| 7468 | Education Tips | 15 | 0.0 | 381 · 892 · 1,043 |
| 5535 | Ask a Teacher | 6 | 0.0 | 490 |
| 8133 | All About America | 9 | 0.0 | 388~679 |
| 979 | U.S. History | 15 | 6.7 | 594 · 722 · 1,120 |

넣지 **않은** 것도 근거를 남겼다 — z/1689 Podcast(오디오 전용, ingest 3건 전부 실패) ·
z/4716 · z/3619 · z/3620(RSS 30건인데 큐레이션 필터 통과 0 — 설명이 너무 짧다) ·
z/4691(본문 184어) · z/5091(3건 중 2건 실패) · z/1574(200 인데 항목 0, 두 번 확인).

- 새 피드 5개에서 **45편**이 즉시 밀려 있다
- **적합률이 아니라 부적합률로 골랐다** — VOA 는 전부 학습자용이라 분류기의 `fit` 패턴에
  안 걸리는 것이 정상이다(Everyday Grammar 적합 0% · 부적합 0%)

**■ `status_message` 빈 문자열 69편 정리.** 소급 적용 SQL 의 `concat_ws` 가 인자 전부 NULL 일 때
NULL 이 아니라 **빈 문자열**을 돌려주는데 바깥을 `nullif` 로 감싸지 않았다. "표시 있음" 이
89 로 부풀어 있었다 — 실제는 **20편**(전부 길이 초과).

### 정규화 — 표가 납작해진 자리에서 없는 낱말이 생기고 있었다 (v06.309)

앞 사이클에 "별도 실측 후 처리" 로 미뤄 둔 것이다. 재고 나서 고쳤다.

VOA 어근 수업의 원문은 HTML 표(Root · Meaning)가 텍스트로 납작해진 형태다:

    Root
    Meaning
    bio-
    life
    auto-
    self
    photo-
    light

`reflowSoftHyphens` 가 `bio-\nlife` 를 줄바꿈 하이픈으로 보고 이어 붙여
**`biolife`·`autoself`·`photolight`** 를 만들고, 그대로 학습자 어휘 목록에 들어갔다.

**322편 전수 조사** — 줄 끝 하이픈 **11건이 전부 이 기사 하나**에서 나왔고,
**진짜 줄바꿈 하이픈은 0건**이었다. 기사는 전부 HTML/API 라 생길 이유가 없다.

- 판별 휴리스틱을 만들지 않고 **경로로 나눴다**. 후보였던 "하이픈 줄에 앞선 낱말이 있으면
  진짜" 규칙은 `scrib-, script-\nwrite` 를 못 걸렀다. 휴리스틱은 양쪽에서 틀릴 수 있지만
  경로 구분은 실측된 사실에 기댄다 — 책(PDF·구텐베르크)은 켜고, 기사는 끈다.
- `reflowSoftHyphens(s, { joinHyphenLineBreaks })` — **기본값은 그대로 true**(책 동작).
  회귀가 기본값 유지까지 확인한다(누가 바꿔도 조용히 지나가지 않도록).
- 배치(`process-queue.mjs`)와 화면(`dev-process`) 양쪽에 같은 설정. 갈리면 처리 경로에 따라
  같은 글의 어휘가 달라진다.
- `scripts/acp/reprocess.mjs` 신설 — `process-queue` 는 `queued` 만 집으므로 이미 `ready`/
  `published` 인 글은 규칙을 고쳐도 낡은 결과를 들고 있다. 발행 상태는 건드리지 않는다.
- 해당 기사 재분석: **유령 낱말 11 → 0**, 그 자리에 실제 낱말 9개
  (life · self · light · carry · earth · sound · empty · write · feel).
- 회귀 11종 · 501 통과.

⚠️ 나중에 **PDF 에서 뽑는 기사 소스**를 붙이면 이 판단을 다시 재야 한다. 현재 ACP 소스 12곳은
전부 HTML/API 다.

### ACP — 백로그 66편 통과, 큐 0 (v06.308)

새 게이트를 만들지 않고 밀린 것을 끝까지 밀었다.

- 수집 → 사전 드레인(151 등재) → 처리 **66/66** · 큐 0 · 실패 0
- 최종 **322편**(발행 160 · 검수대기 162) · 12 소스 · 21 피드
- 사전 적중 **92.3%**(18,431 낱말). 남은 1,428 은 대부분 PLOS 논문의 1회 등장 전문어다
- 위키미디어 429 — 이번 세션에 반복해 두드린 결과라 그쪽은 쉬게 뒀다
- 7사이클 종합 리포트: <https://claude.ai/code/artifact/34634fff-f7c8-42c4-8547-d2d6236ea135>


### ACP — 앞 항목의 교차검증을 철회한다. 전제가 실측과 반대였다 (v06.307)

v06.306 에서 "VOA 가 준 정답표로 우리 CEFR 을 교차검증한다" 며 `declared-level.ts` 를
만들었다. **그 정답표가 정답표가 아니었다.**

| VOA 선언 | 편수 | 평균 CEFR 지수(0=A1) | 평균 어수 | 평균 통사점수 |
|---|---|---|---|---|
| Level 2 | 47 | **2.38** | 701 | 61.1 |
| Level 3 | 20 | **1.85** | 1,166 | 57.6 |

**더 어렵다고 선언한 Level 3 이 텍스트로는 더 쉽다.** 통사 점수도 같은 방향이다.
즉 VOA 의 Level 은 **프로그램 편성 등급**(대상 청취자·말하기 속도)이지 읽기 난이도가 아니다.

이유는 본문을 열어 보고 알았다 — `american-stories` 는 **원문이 아니라 학습자용 각색**이다:

    "Our story today is called "The Purloined Letter." It was written by Edgar Allan Poe.
     Poe is generally known for his horror stories. ... The story is about a stolen letter."

문장이 짧고 낱말이 흔하다. **A2 추정은 텍스트에 대해서는 맞았다.** 어려운 것은 문장이 아니라
문학·문화 배경지식인데, 그건 우리가 재는 축이 아니다.

- `declared-level.ts` + 회귀 8종 **삭제**, 배선 원복. 걸렸던 6건은 전부 오탐이었고
  `status_message` 도 정리했다.
- 실측 표를 `VOA_FEEDS` 선언부 주석에 남겼다 — 같은 것을 다시 만들지 않도록.
- **v06.306 의 "추정기가 서사체를 못 읽는다" 도 함께 철회한다.** 통사 산출물
  (`syntax_score`, 251/251편에 이미 있음)로 확인하니 Purloined Letter 는 문장 p90 18 ·
  절깊이 2.0 으로 관용구 해설과 같은 수준이었다. 추정기는 제대로 읽었다.

**■ 이 goal 의 금지사항에 "근거 없는 임계값을 목표로 삼기" 가 있는데 내가 그걸 했다.**
`Level 3 → B2` 대응표를 실측 없이 세웠다. 세우기 전에 두 축의 상관을 재는 데 질의 하나면
충분했다. 순서는 **대응표를 만들기 전에 상관을 재는 것**이다.

**■ 다만 z/952 정정은 유효하다.** 그건 교차검증이 아니라 **실제 기사 제목**에서 나왔다
(Ice Ages · Goodyear Blimp · Golden Gate Bridge — 초급 강좌가 아니다).
`level 1 → 2` · register `narrative → expository` 는 그대로 둔다.

### ACP — 발행사가 준 정답표로 우리 레벨을 교차검증했다 (v06.306, **v06.307 에서 철회**)

VOA 는 콘텐츠마다 Level 1/2/3 을 **명시**한다. 우리 CEFR 추정과 대조했더니 역전돼 있었다:

| 피드 | VOA 선언 | 편수 | A1~A2 | B1 | B2 | 평균어수 |
|---|---|---|---|---|---|---|
| american-stories | **Level 3**(가장 어려움) | 11 | **5** | 6 | 0 | 1,700 |
| lets-learn-english | Level 1(로 알고 있던) | 13 | 1 | 7 | 5 | 732 |

가장 어려운 피드가 가장 쉽게 나왔다. 실제 글은 이렇다:

    A2 · 1,766어 · 신뢰도 0.65   'The Tell-Tale Heart' by Edgar Allan Poe
    A2 · 1,673어 · 신뢰도 0.95   'The Gift of the Magi,' by O. Henry
    A2 · 1,688어 · 신뢰도 0.95   The Purloined Letter by Edgar Allan Poe

**19세기 문학 각색이 A2 다.** 신뢰도 0.95 라 아무도 의심하지 않는다. 원인은 추정이
어휘 빈도에 기대기 때문이다 — 서사체는 낱말이 흔해서 쉽게 보이지만 통사가 복잡하다.

- `analyze/declared-level.ts` 신설 — **덮어쓰지 않고 알린다.** 발행사 라벨은 프로그램
  단위, 우리 추정은 이 글의 실측이라 어느 쪽이 옳은지는 글마다 다르다. 2밴드 이상
  벌어지면 "어느 쪽도 그대로 믿을 수 없다" 고 표시한다. 회귀 8종(양방향 모두).
- **교차검증이 우리 메타데이터 오류를 잡았다.** "Level 1 인데 B2" 로 걸린 5편을 확인하니
  틀린 쪽은 추정이 아니라 우리 라벨이었다 — z/952 는 Anna 연속 드라마가 아니라 그날의
  학습 자료 모음이고 내용은 일반 피처다(Ice Ages · Goodyear Blimp · Golden Gate Bridge).
  `level: 1 → 2` · 라벨 정정 · register `narrative → expository`.
  기존 회귀가 그 틀린 믿음을 못 박고 있어서 사유와 함께 갱신했다.
  → Cycle 1 에서 "우리 라벨이 맞고 목록이 틀렸다" 고 한 판단도 이로써 뒤집힌다.
- `feed_id` 를 삽입 때 빠뜨려 137편이 NULL 이었다(register 가 소스 기본값으로 떨어짐).
  `backfill-feed-id.mjs` 신설 — 피드를 다시 열어 주소 대조로 **84편 복구**,
  못 찾은 53편은 짐작으로 채우지 않았다.
- 소급 적용: 오탐 5건 해소 후 **진짜 모순 6건** 잔존(american-stories 5 · words 1).

**■ A1~A2 는 3.1% 조차 부풀려진 값이다** — 8편 중 6편이 이 오분류다. 진입 밴드는
사실상 비어 있고, 그 원인은 공급이 아니라 **추정기가 서사체를 못 읽는 것**이다.
근본 해법은 통사 복잡도를 신호에 넣는 것인데, 급히 바꾸면 이미 매겨진 256편이
한꺼번에 흔들리므로 별도 작업으로 남긴다.

### ACP — 초중급 공급원이 인자 하나 때문에 멈춰 있었다 (v06.305)

**■ 앞 항목(v06.304)의 "초중급 공급은 VOA 뿐" 은 틀렸다.** `ready` 만 보고 판단했는데,
발행분까지 넣으면 공급원은 둘이다:

| 소스 | 전체 | A1~A2 | B1 | B2 | C1~C2 | CEFR 신뢰도 |
|---|---|---|---|---|---|---|
| voa | 54 | 6 | **28** | 20 | 0 | 0.78 |
| **simple_wikipedia** | 34 | 0 | **27** | 7 | 0 | **0.84** (최고) |

`simple_wikipedia` 34편이 전부 이미 `published` 라 `ready` 표에 안 보였을 뿐이다.

**그런데 그 공급원이 멈춰 있었다.** 위키미디어 계열 셋은 카테고리를 첫 인자로 받는데
(`listXFeed(category, feedId)`), `collect-daily.mjs` 가 `f.id` 를 넘기거나
(wikipedia·wikivoyage) 아무것도 안 넘겼다(simple_wikipedia). `gcmtitle` 이
`'featured'`/`undefined` 가 되면 MediaWiki API 는 **빈 결과를 200 으로** 돌려준다 —
오류도 경고도 없다. 게다가 `SIMPLE_WIKIPEDIA_FEEDS` 두 개를 무시하고 `default` 하나를
하드코딩했다(VOA 에서 이미 한 번 저지른 실수 — 소스당 첫 피드만 쓰기).

- 셋 다 `f.category` 를 넘기도록 수정 → simple_wikipedia 0건 → **20+20건**,
  wikipedia 0 → 17+17. 전체 밀린 글 **148 → 219**.
- **조용한 0건을 금지한다.** `목록 0건` 과 `새 것 없음` 은 다른 사건인데 표에 똑같이
  `· 0 0` 으로 찍혔다. 이제 0건 피드를 이름과 함께 따로 경고한다 —
  남은 3건(`nasa/apod`·`nih/medlineplus`·`wikinews/latest`)이 그렇게 드러났다.
- 초중급 공급원 둘만 담아 끝까지 통과(19/19) — 사전 42개 등재. **초중급 30.9%**(79/256),
  B1 58 → **71**.

**■ 남은 진짜 빈 곳은 A1~A2 다** — 256편 중 **8편(3.1%)**. B1 은 채워졌지만 진입 밴드는
여전히 비어 있고, 현재 배선된 PD 소스 중 A1~A2 를 내는 곳이 없다.

**■ 새 잡음 부류 발견(미해결).** VOA 어근 수업에서 `auto-` + 뜻풀이가 붙어
`autoself`·`geoearth`·`photolight` 같은 없는 낱말이 생긴다(이번 79개 중 11개).
`reflowSoftHyphens` 가 줄 끝 하이픈을 이어 붙이는 것이 원인인데, 그 동작 자체는
PDF 줄바꿈 복원에 필요하다. 드레인이 걸러 사전 오염은 막았으나 기사 어휘 목록에는
남는다. 정규화기를 성급히 고치면 정상 복원을 깨므로 별도 실측 후 처리한다.

### ACP — 본문 길이에 대한 판단이 아무 데도 없었다 (v06.304)

새 피드에서 40편을 담아 사전 드레인 → 처리까지 끝까지 통과시켰다(**40/40** · 큐 0).
그 끝단 수치를 보다가 결함을 찾았다.

| 소스 | ready | 초중급 | 중상급 | 상급 | 평균어수 |
|---|---|---|---|---|---|
| **voa** | 24 | **15** | 9 | 0 | 996 |
| the_conversation | 26 | 1 | 11 | 14 | 1,076 |
| **plos** | 4 | 0 | 1 | 3 | **7,013** |

`minTitleLen`·`minDescriptionLen` 은 **목록 항목**이 부실한지 보는 것이고, **본문은 얼마든
길어도 통과**한다. 그래서 검수 대기에 연구논문 전문이 섞여 있었다(발행분에도 wikivoyage
11,290어·최대 13,942어).

- `analyze/reading-load.ts` 신설 — 임계값은 짐작이 아니라 **사람이 검수해 발행한 138편의
  p90(2,848어)**. 중앙값 855 · p95 5,890 · 최대 13,942 실측에서 나왔다.
- **버리지 않고 표시한다.** 긴 글이 나쁜 글은 아니다 — 백과 항목은 길이가 본질이고 상급
  학습자에게는 유효하다. `lexical_noise > 0.08` 이 단어세트만 건너뛰고 글은 남기는 것과
  같은 태도다. 판단은 사람이 한다.
- 배치(`process-queue.mjs`)와 화면(`dev-process` 라우트) **양쪽에 같은 함수**를 배선.
  둘 다 표시 사유를 `·` 로 이어 붙인다 — 앞의 것만 남기면 뒤의 것이 조용히 사라진다.
- 기존 `ready` 83편에 소급 적용 — **정확히 4편(전부 plos, 15~47분)** 만 걸리고 오탐 0.
- 회귀 6종 — 경계값·0/null·읽기속도 일치·사유에 비교 대상 포함 여부.

**■ 사전 적중 99.4%** (ready 83편 · 7,583낱말 기준). 이번 드레인에서 84개 중 76개 등재.

**■ 초중급을 공급하는 것은 VOA 뿐이다** — 24편 중 15편(63%)이 A1~B1. 나머지 PD 소스는
전부 C1~C2 편중이라, 고등학생 진입 밴드는 사실상 VOA 하나에 걸려 있다.

### 소스 — The Conversation 피드 4개 중 3개가 엉뚱한 주제였다 (v06.303)

후보 섹션 19개를 실제로 두드려(`scripts/acp/feed-probe.mjs`) 4판정으로 나눴다 —
**rss 17 · dead 2 · blocked 0**. 그 과정에서 배선된 피드의 조용한 드리프트를 찾았다.

주소가 `topics/<슬러그>-<번호>` 형태인데 해소되는 것은 번호이고 슬러그는 장식이다.
그 번호의 주제명이 바뀌자 301 로 다른 곳에 도착했다:

| 배선된 라벨 | 실제로 오던 것 |
|---|---|
| Science + Tech (`science-1391`) | molecular-biology |
| Health + Medicine (`health-39`) | **transport** |
| Politics + Society (`politics-127`) | **nbn**(광대역망) |

**아무 경보도 안 울렸다** — 기사는 계속 들어오고, 영어이고, 라이선스도 같고, 형식도 맞다.
틀린 것은 "무엇에 관한 글인가" 뿐이라 사람이 읽어야 보인다. 고친 뒤 재수집하니
science·health·education 이 **20건 전부 "새 것"** 으로 나왔다 — 드리프트의 직접 증거다.

- 섹션 경로로 교체 — `us/technology`(스스로를 "Science + Tech" 라 부른다) · `us/health` ·
  `us/education`(적합 65.0% · 부적합 0%). politics 는 되살리지 않았다(사건·정치 제외 방침).
- 회귀 `feed-urls.test.ts` 5종 — 번호 토픽 주소 **형태 자체를 금지**한다. 살아 있는지는
  프로브가 실측으로 보고, 테스트는 드리프트에 취약한 형태인지만 본다(네트워크 안 탄다).
- VOA 신규 2개 — `education` z959(적합 73.3% · 부적합 0%) · `arts-culture` z986(40.0% · 0%).
  ⚠️ z1574(Technology Report)는 **넣지 않았다** — HTTP 200 이지만 항목 0이다.
- 새 배선으로 밀려 있는 PD 글 **114건**(VOA 38 + The Conversation 76).

**■ 판정 잣대가 소스 종류마다 다르다.** VOA Learning English 는 애초에 전부 학습자용으로
쓰인 글이라 `적합률`이 낮게 나와도(Words and Their Stories 10%) 쓸 수 있다 — 분류기의
fit 패턴이 교육·과학 키워드를 찾기 때문이다. **PD 등급물의 잣대는 부적합률**(사건·정치가
섞였는가)이고, 일반 뉴스의 잣대가 적합률이다. 프로브가 fit·neutral·unfit 셋을 다 찍는다.

**■ ND 는 단어세트가 안 나온다.** The Conversation 은 CC-BY-ND → `display_only=true` →
발행 트리거가 단어세트를 건너뛴다(`NOT display_only AND lexical_noise≤0.08` 일 때만).
즉 **본문 읽기 자료로만 쓰인다.** VOA(PD-Government)만 전 모듈 학습 대상이다.

### 사전 — Claude Code 드레인으로 채우고, 앞 두 항목의 수치를 정정한다 (v06.302)

**■ 아래 v06.301·v06.300 의 "사전 적중 95%→72%" 는 틀린 수치다.** 두 겹으로 틀렸다.

① **72% 는 정확 일치 값이었다 — 학습자가 겪는 값이 아니다.** 추출기는 본문에 표제어가
없으면 표면형을 남긴다(`keepLemmaOnlyIfInText`, v06.35 유령 어휘 차단). 짧은 기사에서는
단수형이 본문에 안 나오는 일이 흔해 `countries`·`years`·`hours` 가 통째로 "미등재" 로 보인다.
학습자 경로(`select_article_vocab` → `resolve_dict_headword`)는 그걸 푼다.

| 43편 · 5,386 낱말 | 값 |
|---|---|
| 정확 일치 | 64.2% |
| 해소기 통과 후 (**학습자가 겪는 값**) | **95.6%** |
| 드레인 197개 등재 후 | **99.2%** |

② **키를 넣어도 사전은 안 채워졌다.** `enrich_shared_dictionary` 는 본문에
`source='lcp_llm'` 을 하드코딩하는데(`20260508120200`), 그 **나흘 전**에 생긴
`shared_dictionary_source_check`(`20260504160708`)가 그 값을 금지한다. 호출부는 오류를
`console.warn` 으로 삼켰다. **103일 동안 한 행도 안 들어갔다** — `source='lcp_llm'` 행 0개가
증거다. 키를 넣었다면 Haiku 호출 비용만 쓰고 결과를 버렸을 것이다.

- `scripts/dict/drain-article-lemmas.mjs` 신설 — 내보내기/들여오기. **해소기를 통과시킨 뒤
  남는 것만** 청크로 뽑는다(안 그러면 `countries` 같은 굴절형을 사전에 중복 등재해 품질을
  되레 깎는다 — `ops.ts` 도움말의 "철자 변이는 해석기를 고쳐라" 와 같은 이유).
- 1회차 실측: 정확 일치 실패 1,928 → 해소기가 1,689 해결 → **진짜 갭 239** → 42 건너뜀
  (약어·도메인 파편·중세영어·시약명) → **197 등재**(`source='ai-generated'` ·
  `classified_by='claude_code_opus_5'`).
- `lookup-enrich.ts` — 죽은 RPC 대신 제약이 허용하는 값으로 직접 INSERT, 실패를 **던진다**
  (삼키면 다음 글에서 또 돈을 쓴다). 키 없을 때 경고 문구에 "이 숫자는 정확 일치" 를 명시.
- `readiness.ts` — **키가 없다고 막던 것을 걷었다.** 근거가 틀렸고, 그 게이트가 PD 큐 26편을
  이유 없이 세우면서 진짜 구멍(죽은 RPC)을 가렸다. 키 없이 실제로 빠지는 것은 CEFR LLM
  시그널 하나뿐이다(신뢰도 0.732→0.725). 회귀 6종이 "막지 않는다" 를 못 박는다.
- 막혀 있던 **PD 큐 26편 처리 완료** — ACP `queued` 0 · `ready` 37.

**■ 교훈.** 회귀 테스트가 **틀린 숫자를 고정**하고 있었다. 사유에 숫자를 적게 한 것은 옳았지만,
그 숫자가 *무엇을 잰 것인지* 는 아무도 검사하지 않았다. 적중률처럼 경로마다 값이 다른 지표는
**어느 경로에서 잰 값인지**를 함께 적어야 한다.

### 분석 — 조용한 저하 판단을 한 곳으로, 그리고 잘못 붙일 뻔한 곳 (v06.301)

앞 사이클에 `process-queue` 안에 직접 넣었던 검사를 라이브러리로 옮겼다
(`analyze/readiness.ts` · `checkAnalysisReadiness(env)`). 스크립트마다 각자 검사하면 한쪽만
고쳐진다 — 이 저장소는 그 사본 문제를 여러 번 겪었다. 회귀 6건, 총 480.

- 환경변수를 **주입받는다** — 테스트가 실제 환경을 안 건드린다.
- 사유 문장에 실측 수치(95.2% → 72%)와 **"겉으로는 정상으로 보인다"** 를 담는다. 회귀가 그
  문장의 존재를 확인한다 — 없으면 다음 사람은 CEFR 신뢰도만 보고 넘어간다.

**■ 재저작 처리에는 붙이지 않았다 — 붙일 뻔했다**

ACP 에서 "키 없으면 사전 적중 95%→72%" 를 발견했고 재저작 글도 **75.2%** 라 같은 원인으로
보였다. **틀린 추론이었다** — `drain-process` 는 `analyzeArticle(..., { skipLlm: true })` 라
**키가 있어도 LLM 을 안 쓴다.** 가드를 붙였으면 키를 넣어도 아무것도 나아지지 않는데 실행만
막았을 것이다. 코드에 **왜 안 붙였는지**를 적어 뒀다.

남는 진짜 질문은 따로 있다: **재저작 글은 어휘의 4분의 1이 뜻 없이 학습자에게 간다.**
`skipLlm: true` 에는 기록된 사유가 없고(비용으로 짐작될 뿐), 재저작 글은 130~320어로 짧아
보강 비용이 작다. 켜는 편이 맞는지는 별도 판단 사항으로 남긴다.

### ACP — API 키 없이 조용히 저하되던 처리 (v06.300)

앞 사이클 처리 로그에 `ANTHROPIC_API_KEY 미설정 — 75개 miss skip` 이 흘러갔다. **경고만 찍고
계속 도는 구조**라 아무도 안 본다. 영향을 쟀다.

| | 어휘 | 사전 적중 |
|---|---|---|
| 기존 143편 | 48,206 | **95.1%** |
| 오늘 6편(키 없음) | 1,338 | **72.0%** |

**학습자가 단어를 눌렀을 때 뜻이 안 나오는 비율이 5% → 28%.**

**겉으로는 정상으로 보인다는 것이 핵심이다** — CEFR 신뢰도 0.732→0.725, 어휘 밀도
23.7%→26.3% 로 거의 안 변한다. 흔히 보는 지표만으로는 저하를 못 알아챈다.

- `process-queue.mjs` 가 키 없으면 **멈춘다**. 실측 수치를 보여 주고, 알고도 돌리려면
  `--allow-degraded` 를 명시하게 했다.
- 이미 degraded 로 처리된 6편에 `status_message` 표시 — 재처리 대상임을 화면에서 알 수 있다.

**■ 측정 중 내 오측 하나.** 처음에 "사전 적중 0%" 가 나왔다. `library_article_vocabularies.lemma`
가 NULL 이고 실제 필드는 `word` 인데 `lemma` 로 조인했다. 값을 직접 확인하지 않았으면
**"사전이 통째로 안 붙는다" 는 거짓 경보**를 올릴 뻔했다.

### ACP — 처리도 dev 라우트뿐이었다 (v06.299)

수집을 뚫었더니 32편이 `queued` 로 쌓였는데 **처리 경로가 dev 전용 라우트뿐**이었다
(`/api/acp/dev-process` 는 `NODE_ENV=production` 에서 403). 담아도 사람이 dev 서버를
띄워야만 앞으로 나갔다.

이 저장소에서 같은 공백을 **네 번째**로 만난다 — Compose 드레인 5단계 · ACP 수집 · ACP 처리.
규칙으로 적어 둔다: **화면(또는 dev 라우트)에만 있는 단계는 배치가 못 돌리고, 배치가 못 돌리는
단계는 결국 아무도 안 돌린다.**

- `scripts/acp/process-queue.mjs` — dev-process 라우트와 **같은 함수를 같은 순서로** 부른다
  (정규화 → `analyzeArticle` → `compute_article_vrl`/`syntax` → 메타 + `status=ready`).
  경로가 갈리면 화면으로 처리한 글과 배치로 처리한 글의 메타가 달라진다.
- 기본 **읽기 전용**(큐만 보여 준다). 분석은 LLM 비용이 들어 상한을 둔다. 실패는
  `status=failed` 로 남아 다시 안 집힌다.

**실측: 6/6 처리 성공 · B1~C1 · 평균 931어. 남은 큐 26.** 39일 만에 PD 경로가 수집→처리까지
완주한다. 발행은 여전히 사람이 한다.

### ACP — 소스당 첫 피드만 걷고 있었다 (v06.298)

앞 사이클 스크립트가 소스마다 `FEEDS[0]` 하나만 썼다. 비PD 쪽에서 얻은 교훈(**발행사보다 그
안의 섹션이 적합률을 가른다**)을 PD 에는 적용하지 않은 것이다. 그래서 **VOA 의 학습자 전용
피드가 통째로 빠져 있었다** — `words-and-their-stories`·`lets-learn-english` 는 이 서비스가
노리는 바로 그 자리인데 `as-it-is`(일반 뉴스)만 걷고 있었다.

**■ 실측 — PD 경로가 병목도 없고 적합률도 높다**

| 피드 | 적합 | 부적합 | | 피드 | 적합 | 부적합 |
|---|---|---|---|---|---|---|
| nasa/news | **77.8%** | 0.0 | | plos | 26.7% | 0.0 |
| noaa/features | **75.0%** | 0.0 | | elife | 15.0% | 0.0 |
| noaa/understanding-climate | 71.4% | 0.0 | | voa/lets-learn-english | 13.3% | 13.3 |
| nasa/iotd | 66.7% | 0.0 | | voa/health-lifestyle | 9.1% | 0.0 |
| usgs/featured | 33.3% | 8.3 | | usgs/snippets | 8.3% | 8.3 |
| the_conversation/health | 33.3% | 0.0 | | voa/american-stories | 6.7% | 0.0 |
| the_conversation/all | 30.0% | 0.0 | | owid | 0.0% | 0.0 |

**비PD(Compose) 활성 피드 전체 평균 20.8%** 와 견줄 것 — 상위 PD 피드는 그 **3.7배**다.

- 모든 피드를 열거하고 **피드별 적합률**을 함께 낸다(비PD 계측기와 같은 분류기).
  `--feed` 로 특정 피드만 지정할 수 있다.
- 밀린 새 글 82 → **134**(피드를 다 열거하니 드러났다). 실패 2건은 NIH(fetch failed · 403).

### ACP — 병목 없는 경로가 39일째 멈춰 있었다 (v06.297)

"모든 병목을 없애라" 를 풀다가 더 중요한 것을 발견했다. **두 경로의 병목이 완전히 다르다.**

| | 제약 | 실적 |
|---|---|---|
| **ACP (PD)** | 본문을 그대로 발행 — 48시간 보류 **없음** · 2계통 **불필요** · 재저작 게이트 **불필요** | 누적 **165편 발행** |
| Compose (비PD) | 사실만 뽑아 새로 쓴다 — 48시간 + 2계통 + 게이트 6종 | 6편, 발행 0 |

그런데 **병목 없는 쪽이 2026-07-11 이후 39일간 한 편도 안 걷었다.** 고장이 아니었다 — 수집
경로가 전부 HTTP 라우트(`/api/acp/enqueue` 는 admin 쿠키, `dev-enqueue` 는 프로덕션 차단)라
**사람이 브라우저를 열어야만 돌았고 아무도 안 열었다.** Compose 드레인에서 고쳤던 것과 같은 공백.

- `scripts/acp/collect-daily.mjs` 신설 — 기본 **읽기 전용**(밀린 양만 센다), `--commit` 이
  있어야 담는다. 이미 있는 것은 건너뛴다.
- 실측: **밀려 있던 새 글 82편.** 소스당 2편으로 11편을 담아 경로를 검증
  (nasa 2 · owid 2 · plos 2 · the_conversation 2 · usgs 2 · noaa 1).
- `admin_enqueue_article` RPC 는 쓰지 않는다 — 첫 줄의 `is_admin_or_curator()` 는 **사용자
  경로를 지키는 검사**인데 service-role 에는 `auth.uid()` 가 없어 언제나 거절된다(실측 21건
  전부 Forbidden). RPC 가 하는 일은 `(source, source_id)` 중복 확인 후 `queued` 삽입뿐이라
  같은 의미를 스크립트에서 수행한다 — **마이그레이션 없이**. 중복 기준을 RPC 와 똑같이 맞추는
  것이 핵심이다(주소가 아니라 source+source_id).

### ACP §20 — 절차서를 섹션 경로 기준으로 정리 (v06.296)

기능·계측·화면은 섹션 경로를 알게 됐는데 **절차서가 아직 RSS 기준**이었다. 절차에 없으면 다음
사람은 손으로 짐작하고, 나는 이 세션에서 그 짐작으로 요청 25개를 404 에 버렸다.

- 「피드」 탭 단계에 **"섹션을 재고 고른다(배치)"** 추가 — `section-sweep.mjs` 사용법 · 읽기 전용 ·
  요청이 후보 수만큼 나간다는 것 · 상한으로 건너뛴 것은 화면에 적힌다는 것.
- 갈래 설명을 셋으로 — 발행사 알림 / 관습 경로 / **섹션 목록**. 0건일 때 의심할 것이 다르다.
- 주의 둘 추가: **섹션 이름만 보고 고르지 않는다**(같은 신문 안에서 17배) ·
  **발행사마다 되는 경로가 다르다**(기사 주소에 날짜가 있어야 섹션 목록을 쓴다).

실측: 코리아타임스 후보 237건 중 **61건(26%)이 섹션 페이지 출처**. 활성 19 · Admin 회귀 43.

### ACP §20 — 화면이 새 경로를 모르고 거짓을 말하고 있었다 (v06.295)

기능(섹션 페이지 수집)은 됐는데 **운영자 화면이 안 따라왔다.**

- 안내문이 "피드가 아닌 주소는 거부됩니다" 라고 적혀 있었다 — **이제 거짓이다.** 섹션 목록
  페이지는 받아들인다. 무엇이 되고 왜 안 되는지(주소에 날짜가 없는 기사는 제외 — 48시간 보류를
  검증할 수 없다)를 사실대로 적었다.
- 발견 결과가 `발행사 알림 / 관습 경로` 두 갈래뿐이라 섹션 페이지가 "관습 경로" 로 표시됐다.
  세 번째 갈래 `section` 을 추가했다 — **0건일 때 의심할 것이 다르다**(RSS 는 주소가 옮겨진 것,
  섹션은 주소에 날짜가 없는 발행사인 것).
- 회귀 3건. 총 474.

같은 패턴을 이번 목표에서 **세 번째로** 만났다 — 새 경로를 만들면 그것을 **재는 도구**
(`feed-fitness`)와 **보여 주는 화면**이 따라와야 한다. 안 따라오면 둘 다 조용히 거짓을 말한다.

### ACP §20 — 섹션 스윕 한 명령, 그리고 발행사마다 되는 경로가 다르다 (v06.294)

섹션마다 손으로 열어 보던 것을 한 명령으로 묶었다 — 내비게이션에서 후보를 읽고(짐작하지 않는다)
하나씩 열어 적합률 순위를 낸다(`scripts/compose/section-sweep.mjs`). 읽기 전용.

**■ 코리아타임스 섹션 지도 (12개 실측)**

| 섹션 | 적합 | 부적합 | | 섹션 | 적합 | 부적합 |
|---|---|---|---|---|---|---|
| k-universities | **87.5%** | 0.0 | | business | 6.7% | 0.0 |
| southkorea | 26.7% | 13.3 | | world | 6.7% | 66.7 |
| sports | 26.7% | 6.7 | | opinion | 5.0% | 30.0 |
| entertainment | 22.2% | 0.0 | | foreignaffairs | 0.0% | 53.3 |
| lifestyle | 16.7% | 0.0 | | economy | 0.0% | 0.0 |

**같은 신문 안에서 적합률이 17배 벌어진다.** `southkorea` 추가 등록(활성 19).

**■ 발행사마다 되는 경로가 다르다**

| 발행사 | 섹션 페이지 | 이유 |
|---|---|---|
| 코리아타임스 | **가능** | 기사 주소가 `/20260819/…` — 날짜를 찾는다 |
| 코리아헤럴드 | 불가 | `/article/10841716` — 날짜 없음 → RSS 로 덮는다 |
| 연합 | 불가 | `/view/AEN20260814…` — 날짜 없음 → RSS 로 덮는다 |

섹션 페이지와 RSS 는 대체재가 아니라 **발행사에 따라 갈리는 두 경로**다.

**■ 스윕 자신이 규율을 어겼다 (고침)**

첫 판이 연합 요청 16개를 전부 `/aboutus/*` 에 썼다. 필터가 `about` 만 막아 `aboutus` 를
놓쳤고, **알파벳순으로 잘라** 회사 소개가 상한을 다 먹었다. 이 저장소가 반복하는 "발행사 서버에
헛되이 묻지 않는다" 를 스윕이 어긴 것이다. 첫 마디 판정 + 목록 확장 · 한 마디 경로 우선 ·
**상한으로 건너뛴 것을 말한다**(조용히 자르면 "다 봤다" 로 읽힌다).

합계 887항목 20.7% → **902항목 20.8%**.

### ACP §20 — 섹션 주소를 짐작하지 않는다, 적합 88% 섹션을 찾았다 (v06.293)

섹션 주소 11개를 **짐작해** 두드렸더니 9개가 404/400 이었다. 같은 실수를 앞서 두 번 했고
(한국 매체 섹션 피드 · 코리아헤럴드 RSS 안내) 답은 늘 같았다 — **발행사가 내비게이션에 적어
둔 것을 읽으면 된다.**

- `section-probe.mjs --nav <홈페이지>` — 내비게이션에서 섹션 후보를 추출한다.
  코리아타임스 30개 · 코리아헤럴드 63개.
- 실측 결과 **코리아타임스 `k-universities` 적합 87.5% · 부적합 0%**(16건) —
  이 프로젝트 최고치다(이전 최고 BBC Science 47.6%). `sports` 26.7% 도 함께 등록.
- 코리아헤럴드 섹션 페이지는 전부 못 쓴다 — 기사 주소가 `/article/10841716` 이라 날짜가 없다.
  설계대로 제외되고(발행 시각을 검증할 수 없다), 그쪽은 RSS 가 날짜를 주므로 RSS 로 등록돼 있다.

**■ 계측기가 새 경로를 못 보고 있었다**

`feed-fitness` 가 `<item>` 만 파싱해서 **섹션 페이지 피드를 0건으로 세고 합계에서 조용히
뺐다.** 수집기는 RSS 실패 시 섹션 파서로 넘어가는데 계측기가 안 따라가면 화면의 적합률이 실제로
걷는 것과 달라진다. 같은 폴백을 붙였다 — 새 경로를 만들 때는 **그 경로를 재는 도구도 함께**
고쳐야 한다.

활성 피드 16 → 18 · 합계 838항목 19.5% → **887항목 20.7%**.

### ACP §20 — 섹션 페이지를 등록·수집에 배선, 전 구간 실측 (v06.292)

앞 사이클의 파서를 실제 경로에 붙였다. 두 곳 모두 **"RSS 가 아니면 섹션 페이지로 한 번 더
시도"** 이고, 두 파서가 같은 모양(`RssListItem[]`)을 돌려주므로 하류는 안 바뀐다.

- `verifyFeedUrl` — 피드가 아니면 섹션 페이지로 재시도. 그래도 안 되면 **사유를 나눠 준다**
  ("목록 페이지가 아니다" vs "기사에 날짜가 없다" — 운영자가 할 일이 다르다).
- `discoverStories` — 같은 갈래. 등록된 주소가 RSS 든 섹션이든 수집이 동일하게 돈다.
- **스키마 변경 없음.** 응답을 보고 판단하므로 피드 종류를 저장할 필요가 없다.

**실측** (코리아타임스 lifestyle 섹션 페이지): 등록 검증 18항목 통과 · 수집 새 후보 22건 ·
그중 **11건이 주소 날짜로 발행 시각을 채움** · 활성 피드 15 → 16. 회귀 471.

화면도움말에 둘을 적었다 — 섹션 목록 주소를 넣을 수 있다는 것, 그리고 **오피니언이 실측
적합 5%·부적합 30%** 였다는 것(섹션 이름만 보고 고르면 안 된다).

### ACP §20 — RSS 없는 섹션도 쓴다, 그리고 오피니언 가설은 기각됐다 (v06.291)

학습 적합률은 **어느 발행사냐보다 그 안의 어느 섹션이냐**로 갈린다 — 섹션 피드 25.0% vs
전체 피드 14.2%(가중·836항목), **1.76배**. 그런데 등록 경로가 RSS 로만 열려 있어 RSS 를 안 주는
섹션은 아예 쓸 수 없었다(`verifyFeedUrl` 이 항목 0 이면 거부).

- `compose/section-page.ts` 신설 — 섹션 목록 HTML → `RssListItem[]`. **RSS 와 같은 모양**을
  돌려주므로 묶기·보류·취재·게이트가 안 바뀐다. 새 경로가 하류를 가르면 같은 사건이 경로에
  따라 다르게 처리된다.
- 발행 시각은 주소의 날짜(`dateFromUrl`)로 채우고 **못 채우면 버린다** — I15 를 검증할 수 없는
  것을 통과시키면 게이트가 있으나 마나다.
- 같은 호스트만 · 네비게이션 경로 제외 · 4단어 미만 제목 제외 · 중복 제외 · 상한 60.
  `inspectSectionPage` 가 0건의 사유를 나눈다. 회귀 16건, 총 471.

**■ 실측에서 두 가지가 기각됐다**

① **직전에 보고한 "lifestyle 56%" 는 틀린 값이었다.** 목록 카드가
`<a><h3>제목</h3><p>리드</p></a>` 라 태그를 그냥 벗기면 리드가 제목에 붙고, 본문 단어가 분류에
섞여 적합률을 부풀린다. 제목 요소만 쓰도록 고치자 **56% → 17%**. 묶기가 제목으로 이뤄지므로
이건 측정 정확도만의 문제가 아니라 같은 사건이 안 묶이는 문제이기도 했다.

② **"신문이라도 오피니언은 사건·정치가 아니다" 가 기각됐다.** 코리아타임스 오피니언 20건 —
적합 **5%** · 부적합 **30%**. 한국 신문 오피니언은 대부분 정치 논평이다. 섹션을 고르는 것은
옳지만 **오피니언은 그 섹션이 아니다** — 생활·문화·과학이다.

### ACP §20 — 발주 지시가 서로 모순돼 지킬 수 없었다 (v06.290)

앞 사이클에서 낡은 사양을 바로잡자 이탈 2건이 드러났다. 고치려고 발주를 읽었더니 **지시 자체가
모순**이었다:

> "한 문단으로 쓴다" (수능 유형) · "한 문단은 4~6문장으로 끊는다" (학령 밴드)

180~190어를 평균 14어절로 쓰면 13문장이라 한 문단에 담을 수 없다. 두 지시를 동시에 지킬 방법이
없고, 그러면 **쓰는 쪽이 임의로 하나를 버리게 된다.**

- `csat_korean` 의 "한 문단으로 쓴다" 를 걷어냈다. 근거 둘: ① 밴드 지시와 정면 모순
  ② 그 문구를 지킨 초안은 **구문 연습 문항이 0개** 나왔다 — DCP 의 순서·삽입은 문단 단위로
  생성되고 문단당 4~6문장을 요구하는데 13문장 한 덩어리는 자격 미달이다. 이 유형의 **핵심
  활동을 그 문구가 막고 있었다.** 논지 전개 순서(주제문→근거→함의)는 남겼다.
- 회귀 2건 — 한 유형 안에 문단 수를 두고 다투는 지시가 없을 것 · 수능은 여전히 논지 전개
  순서를 지시할 것.

**이탈 2편 수정**

| 글 | 이전 | 이후 |
|---|---|---|
| Romania turns off its only nuclear plant (초등) | 189어 | **170어** (발주 90~170) · 평균 8.9어절(목표 9) |
| When a river runs low… (중등) | 154어 · 19.3어절 | **188어** (발주 180~190) · **14.5어절**(목표 14) |

Romania 는 **같은 사실을 두 번 말하던 문장 둘**을 뺐다("전체가 멈췄다" · "5분의 1이 사라졌다").
검수의 판단 목록에 있던 항목이 실제로 걸린 경우다.

결과: **6편 전부 발주에 맞고(R1~R4 지적 0) 게이트 통과**, 밴드 초과는 모두 표본 중앙값 이하.
회귀 449.

### ACP §20 — 낡은 발주 사양이 검수에 오탐을 내고 있었다 (v06.289)

"글로벌 수준 이상" 을 **내가 쓴 2편으로만** 확인해 놓고 달성이라고 적었다. 나머지 4편을 같은
계측기로 재 보니 벤치마크는 6/6 통과인데 검수가 이상한 지적을 하고 있었다 — 다뉴브 초등판(V3)이
"평균 9어절인데 목표 14, 짧다".

**원인은 글이 아니라 목표였다.** `buildJobSpec` 이 밴드에서 문장 길이를 정하도록 고쳐진 뒤
새 발주만 바뀌고 **저장된 사양은 낡은 채로 남았다.** 검수는 저장된 사양을 목표로 삼으므로
낡은 목표에 대고 오탐을 냈다. (같은 구조를 앞서 지문에서도 만났다 — 코드를 고쳐도 저장된
값은 안 바뀐다.)

- 새 스크립트 `scripts/compose/refresh-job-specs.mjs` — `buildJobSpec` 을 그대로 불러
  저장 사양을 다시 만든다. 손으로 고치지 않는다(화면·배치·검수가 같은 답을 봐야 한다).
  dry-run 이 기본. 낡은 사양 **6/9** 갱신.
- 바로잡자 오탐이 사라지고 **진짜 이탈 3건이 드러났다** — 둘 다 이전 세션 산출물이고
  잘못된 발주에 맞춰 쓰인 것이다:

  | 글 | 이탈 |
  |---|---|
  | Romania turns off its only nuclear plant (초등) | 189어 — 발주 90~170 **초과** |
  | When a river runs low… (중등) | 154어 — 발주 180~190 **미달** · 평균 19.3어절(목표 14) |

- **벤치마크 판정은 그대로다** — 6편 전부 밴드 초과가 표본 중앙값 이하:
  0.0 · 1.1 · 2.3 · 3.7 · 4.5 · 5.7%.

### ACP §20 — 미뤄 둔 판정을 끝낸다: guardian·abcnews 비활성 (v06.288)

세 사이클 동안 "며칠 간격으로 두 번 이상" 이라는 **내가 만든 규칙**에 걸어 두고 결정을 미뤘다.
그 규칙은 *한 번의 잡음*을 막으려던 것인데, 지금은 **서로 다른 네 방법이 일치한다** — 같은
방법을 며칠 뒤 다시 재는 것보다 강한 근거라고 판단해 끝냈다.

| 근거 | 결과 |
|---|---|
| ① 짝 성립률 (pairing-probe) | 짝은 18~27건 짓지만 **학습 적합 짝 0** |
| ② 필요성 (necessity-probe ×3) | 빼도 잃는 사건 **0** — 후보가 1,366→1,555 로 늘어도 불변 |
| ③ 다른 피드 (discover-sweep) | 기준 미달 — abcnews usheadlines 부적합 72% · guardian 새 피드 0 |
| ④ 한국 사건 동시보도 | 한국 관련 27건 중 한국 매체와 함께 다룬 것 **0** |

**④가 결정적이었다.** Cycle 21 에서 코리아타임스를 끄려다 "다른 조합에서는 다를 수 있다" 로
되돌린 적이 있어, 같은 반론을 서구 매체에도 적용해 재 봤고 이번엔 기각됐다 — 서구 매체는
한국 사건의 두 번째 계통이 될 수 없다.

- 활성 피드 **20 → 15**. 사유를 `last_note` 에 남겼고 되돌릴 수 있다.
- **유지**: 연합·코리아헤럴드·코리아타임스(셋이 서로를 살린다) · bbc·dw·abcnet(각각 쓸 수 있는
  사건 1건씩을 떠받친다).
- 비활성의 효과는 **앞으로 수집분에만** 적용된다 — 이미 저장된 후보는 그대로라 과거 수치는
  바뀌지 않는다.

### ACP §20 — 발주를 닫는 코드가 없어 큐가 늘 거짓말하고 있었다 (v06.287)

내가 쓴 글 둘의 발주가 대기로 남아 있길래 내 실수인 줄 알았다. 확인해 보니 **대기 4건이 전부
이미 글이 있었다** — 이전 세션의 다뉴브 CSAT·일식 V2 도 마찬가지였다. 즉 이 파이프라인은
발주를 **한 번도 닫은 적이 없고**, 운영자 화면은 없는 일을 있다고 보여 주고 있었다.

절차서에는 "각 발주에 article_id 가 붙는다" 고 적혀 있었지만 **그걸 하는 코드가 없었다.**
사람이 기억해야 하는 절차는 결국 빠진다.

- `drain-process.mjs` 가 처리 후 발주를 닫는다 — 묶음+유형+목표레벨 유일키로 짝지어
  `article_id` 를 붙이고 `status=done`. 실패해도 처리를 죽이지 않고 경고만 남긴다.
- 밀려 있던 발주 4건을 아티클과 짝지어 정리. 대기 0 · 전부 done 9건.
- 화면도움말의 완료 신호에 "처리 단계가 자동으로 닫는다" 를 명시.

**현재 재저작 산출물 6편(전부 `ready`)**

| 밴드 | 편수 | 유형 |
|---|---|---|
| 초등 | 2 | general_proficiency |
| 중등 | 3 | general_proficiency 2 · csat_korean 1 |
| 고등 | 1 | csat_korean |

게이트 6/6 통과 5편 · 1편은 I12 FAIL 로 **정상 차단**(포항 — 소스가 전재).

### ACP §20 — 코리아타임스를 끄면 안 된다 (v06.286)

앞 사이클에서 "연합↔코리아타임스 8%" 를 보고 이 소스를 끌지 판정하려 했다. **조합을 바꿔 재
보니 그 판단이 틀릴 뻔했다.**

| 조합 | 건수 | 독립률 |
|---|---|---|
| 연합 ↔ 코리아타임스 | 12 | 8% |
| 연합 ↔ 코리아헤럴드 | 8 | 63% |
| **코리아타임스 ↔ 코리아헤럴드** | 7 | **57%** |

코리아타임스는 연합 원고를 실을 뿐이고, 헤럴드와 짝지으면 57%다. 8%는 소스의 성질이 아니라
**그 조합의 성질**이었다.

그리고 더 중요한 구조가 보인다 — 셋이 함께 다루면 **한 짝이 무너져도 다른 짝이 살린다.**
실측 예: `(URGENT) Seoul shares open nearly 5 pct lower` 는 타임스↔헤럴드가 35.7%(전재)인데
연합↔타임스는 0.0%(독립)라 사건 자체는 살았다. `collapseSyndication` 은 짝이 아니라 **집합**을
접으므로 이 구조를 이미 옳게 처리한다(셋 중 둘이 접혀도 남은 하나와 합쳐 2그룹이면 통과).

**즉 한국 매체는 많을수록 좋고, 조합별 수율은 "어느 소스를 끌지" 가 아니라 "무엇을 기대할지"
를 알려 주는 값이다.** 주석에 그렇게 못 박았다.

- `source-overlap-probe.mjs --pair a,b` — 묶음에 다른 발행사가 있어도 지정한 둘만 견준다.
  조합을 고를 수 없으면 특정 조합을 판정할 수 없다.
- 실측 표에 세 번째 행 추가. 회귀 2건. 446.

### ACP §20 — 같은 "계통 2" 인데 조합에 따라 수율이 8배 다르다 (v06.285)

앞 사이클에서 한국 매체 짝의 60%가 전재라는 것을 쟀다. 이번엔 **그게 어느 조합에서 나오는지**
갈랐다 — 사건 20건의 본문 대조.

| 조합 | 건수 | 독립 | 전재 | 독립률 |
|---|---|---|---|---|
| 연합 ↔ 코리아타임스 | 12 | 1 | 11 | **8%** |
| 연합 ↔ 코리아헤럴드 | 8 | 5 | 3 | **63%** |

연합뉴스는 통신사다. **코리아타임스는 그 원고를 거의 항상 싣고, 코리아헤럴드는 대체로 자기
기사를 쓴다.** 제목만 보면 둘 다 똑같이 "독립 2계통" 이지만 수율은 8배 다르다. 조합을 나누지
않으면 이 갈래가 전체 비율(30%) 뒤에 숨는다.

- `sources.ts` 에 `MEASURED_PAIR_INDEPENDENCE` 표와 `measuredIndependence()`.
  재 본 적 없는 조합은 **null** 을 돌려준다 — 모르는 것을 0 이나 1 로 말하지 않는다.
- **이 값으로는 아무것도 막지 않는다.** 개별 사건의 판정은 본문 지문(`collapseSyndication`)이
  하고, 8% 조합에서도 진짜 독립 보도가 나온다(실제로 1건 있었다). 표는 운영자가 어디에 기대를
  걸지 알려 주는 값일 뿐이라고 주석에 못 박았다.
- 회귀 6건 — 순서·대소문자 무관 · 미측정 조합 null · 표의 발행사가 레지스트리에 실재 ·
  독립 건수가 표본을 넘지 않음. 444.

### ACP §20 — 한국 매체 짝의 60%가 전재였다 (v06.284)

앞 사이클에 전재 두 건을 잡고 나서 진짜 질문이 생겼다 — **예외인가 다수인가.** 한국 관련
취재 가능 사건 10건의 본문을 실제로 읽어 견줬다.

| | 담김 |
|---|---|
| 독립 (4건) | 0.0 · 0.0 · 1.1 · **4.6%** |
| 전재 (6건) | **16.9** · 85.2 · 88.7 · 97.7 · 100.0 · 100.0% |

연합뉴스는 통신사이고 코리아헤럴드·코리아타임스가 그 원고를 자주 싣는다.
**제목만 보고 센 "독립 2계통" 은 실제의 약 40%다.** 이 게이트가 없으면 나머지 60%가 전부
재저작 대상으로 올라온다 — 그리고 그것들은 재저작이 아니라 2차 저작물이 된다.

- 분포가 두 덩어리로 갈리고 **4.6% 와 16.9% 사이가 비어 있다.** 임계 0.10 은 임의로 고른
  값이 아니라 **데이터가 비워 둔 자리**다. n=1 근거였던 주석을 n=10 으로 바꿔 적었다.
- `source-overlap-probe.mjs --clusters` — 아직 취재하지 않은 사건들의 짝이 실제로 독립인지
  세어 비율을 낸다. 전략의 수율을 정기적으로 다시 재는 자리다.
- `collect-daily` 와 화면도움말이 이 사실을 **스스로 말한다** — "계통 수는 제목 기준이고
  실측에서 60%가 전재였다. 여기서 2로 보이던 것이 취재 시작에서 1이 되는 것은 고장이 아니다."
  숫자를 고칠 수 없으면 숫자가 무엇인지라도 정확히 말해야 한다. 회귀 438.

### ACP §20 — 낡은 지문을 다시 뜬다, 이제 게이트가 스스로 막는다 (v06.283)

앞 사이클에 지문 기준을 원본 HTML → 추출 본문으로 고쳤지만 **이미 저장된 값은 낡아 있었다.**
그 상태로 게이트를 다시 돌리면 낡은 값으로 판정하고, 손으로 바로잡아 둔 `FAIL` 이 조용히
`PASS` 로 덮인다. 고친 코드가 저장된 데이터까지 고쳐 주지는 않는다.

- 새 스크립트 `scripts/compose/refresh-fingerprints.mjs` — 소스를 다시 받아 추출 본문으로
  지문을 다시 뜬다(본문은 저장하지 않는다). dry-run 이 기본이고, **계통 수가 바뀌는 묶음과
  다시 돌릴 게이트 명령**을 끝에 알려 준다 — 숫자만 갱신하면 무엇이 달라졌는지 아무도 모른다.
- 실측(묶음 4 · 소스 8): **포항 묶음만 독립 계통 2 → 1**, 나머지 셋은 2 유지.
  앞 사이클에 손으로 넣었던 판정과 정확히 일치한다.
- 게이트 재실행 결과 포항 건이 **스스로** FAIL 한다 — `전체 소스 2건 → 독립 1그룹`.
  더 이상 사람의 수기 판정에 기대지 않는다. KASA 건은 6/6 PASS 유지.
- 화면도움말에 주의 추가: 표에 계통 2로 보여도 두 기사가 같은 문장을 쓰고 있으면 사람이 먼저
  의심할 것. 회귀 438.

### ACP §20 — 전재 접기는 처음부터 있었다, 재는 대상이 틀렸을 뿐 (v06.282)

앞 사이클에 만든 `copy-lines.ts` 를 지운다. `collapseSyndication` 이 이미 같은 일을 하고
**I12 에 배선돼 있었다.** 이번 세션 내내 고쳐 온 "사본이 갈린다" 를 내가 저질렀다.

장치가 작동하지 않은 진짜 이유는 하나였다 — **지문을 원본 HTML 로 떴다.** 메뉴·스크립트·다른
기사 제목이 7어절 조각의 대부분을 차지해, 본문이 통째로 같아도 겹침이 1%대로 희석된다.

- `readStoryForFacts` 가 지문을 **추출 본문**에서 뜬다(콜백에는 원본 HTML 을 그대로 넘긴다 —
  호출부마다 필요한 추출이 다르다). 같은 쌍이 **0.7% → 31.3%**. I13 도 함께 정확해진다:
  초안과 기사 본문 사이의 연속 구간만 보게 되고 사이트 틀에 우연히 걸리지 않는다.
- `syndicationContainment` **0.25 → 0.10**. 원래 값에는 근거가 없었고("노이즈보다 두 자릿수
  위"), 실제로 재 보니 부분 전재를 통과시켰다.

  | 관계 | 담김(추출 본문 기준) |
  |---|---|
  | 각자 취재 4쌍 | 0.0 · 1.1 · 1.3 · 1.3% |
  | 부분 전재 (문장 손질) | **19.3%** |
  | 부분 전재 (문단 그대로) | **31.3%** |

  ⚠️ 전재 표본이 2건뿐이다 — 반례가 나오면 조이지 말고 먼저 잰다.
- `drain-coverage.mjs` 가 게이트와 **같은 함수**를 쓴다. 취재 단계와 발행 게이트가 다른 답을
  내면 어느 쪽을 믿어야 할지 알 수 없다. 로카르노 사건은 취재 시작에서 막힌다.
- 회귀 2건 추가(부분 전재는 접히고, 각자 취재는 두 계통으로 남는다). 438.

**남은 것**: 기존 취재 묶음 3건의 저장 지문은 아직 HTML 기준이라, 게이트를 다시 돌리면 낡은
값으로 판정한다. 다시 받아 오는 경로가 필요하다.

### ACP §20 — 발행사가 둘이어도 원고가 하나면 한 계통이다 (v06.281)

3편째 지문을 쓰려다 연합뉴스와 코리아헤럴드의 문장이 **글자 그대로 같은 것**을 발견했다.
코리아헤럴드가 연합 원고를 실은 것인데, 화면은 `계통 2/2` 로 보여 주고 있었다 — 발행사가
둘이라는 이유만으로.

재저작의 정당성은 **"여러 곳이 각자 취재한 사실은 누구의 표현도 아니다"** 하나에 걸려 있다.
한 곳의 원고를 두 곳이 실은 것을 2계통으로 세면 실제로는 **한 매체의 기사 하나를 바꿔 쓴 것**
이고, 그건 재저작이 아니라 2차 저작물이다. 게이트 여섯을 다 통과해도 전제가 무너져 있으면
통과가 의미를 잃는다.

- `compose/copy-lines.ts` 신설 — 소스 지문을 서로 견줘 **실제 원고 수**를 센다. 전이적으로
  묶고(A=B, B=C 면 셋이 하나), 담김 방향을 가리지 않는다(짧은 쪽이 긴 쪽에 담겨도 잡는다).
  회귀 9건.
- 임계 **10%**. 실측 근거: 각자 취재한 쌍 4건 **0.0 · 1.1 · 1.3 · 1.3%**, 부분 전재 2건
  **19.3% · 31.3%**. 전문 전재라면 90%를 넘지만 실제로 만난 것은 부분 전재라, 임계값이
  높은 자리에 있으면 통째로 놓친다. ⚠️ 전재 표본이 아직 2건뿐이다.
- `drain-coverage.mjs` 가 **취재 시작 전에** 검사하고 계통이 2 미만이면 묶음을 만들지 않는다.
  로카르노 사건은 42%로 막혔다.
- ⚠️ **저장된 지문으로 견주면 안 된다.** 그것은 원본 HTML 로 뜬 것이라 메뉴·스크립트가
  7어절 조각의 대부분을 차지하고, 본문이 통째로 같아도 겹침이 1%대로 희석된다(같은 쌍이
  저장 지문 0.7% vs 추출 본문 31.3%). 추출 본문으로 다시 뜬다. 저장 지문은 그대로 둔다 —
  I13 은 연속 구간을 찾는 것이라 희석의 영향을 받지 않고, 바꾸면 저장된 판정이 낡는다.
- 새 계측 `scripts/compose/source-overlap-probe.mjs` — 저장된 묶음 전체 또는 `--url` 로
  아직 취재하지 않은 기사 두 건을 견준다.

**■ 발행 대기 1편 차단.** `A stadium closes its doors for a safety check` 의 두 소스가
19.3% 였다. I12 판정을 `FAIL` 로 바꿔 발행 경로를 막았다. **아직 발행 전이라 학습자에게
나가지 않았다.** 같은 기준으로 재검한 결과 1편(`A pop group speaks for a space agency`)은
1.1% 로 정당하다. 회귀 445.

### ACP §20 — 지문 2편째, 게이트가 내 실수 둘을 잡았다 (v06.280)

한국 사건(포항 스틸야드 안전 점검)으로 두 번째 지문을 완주했다. 재현성 확인이자, 첫 편에서
드러나지 않은 함정 둘을 드러낸 사이클이다. **둘 다 게이트가 잡았고 둘 다 사람(나)의 실수였다.**

- 산출물 `A stadium closes its doors for a safety check` (V6 · B1 · 180어 · 중등) —
  I12~I17 **6/6 PASS**(ρ=0.56) · 밴드 초과 **1.1%** ≤ 표본 중앙 4.2% · 문체 하한 4.84 ≥ 4.60.
- **역순도 재배열이 아니다.** 초안이 I14 에서 ρ=-0.87 로 막혔다. 음수 상관을 "낮다" 로 읽고
  소스 순서를 거꾸로 배열한 것이 원인이다 — 게이트는 **절대값**을 본다. 거꾸로 따라가는 것도
  그 기사의 전개를 쓴 것이다. 회귀 3건(정순 FAIL · 역순 FAIL · 섞음 PASS)으로 못 박았다.
  두 소스 **모두와** 상관이 낮은 순서를 찾아야 한다.
- **취재 중에 본 문장이 초안에 새어 든다.** I13 이 8어절 일치를 경고했다
  (`to a local hospital for a further checkup`). `drain-coverage.mjs` 주석에 내가 직접
  "여기 찍힌 문장을 초안에 옮겨 쓰지 않는다" 고 적어 두고 한 사이클 만에 어겼다.
  둘 다 화면도움말 "지문 작성" 단계에 적었다 — 다음 사람도 똑같이 한다.
- 검수의 진입 부담(R2)도 해소 — 첫 문장이 15어절로 글 전체에서 가장 무거웠다 → 11어절.
- 회귀 436.

### ACP §20 — 본문 추출이 남의 기사 제목을 함께 걷고 있었다 (v06.279)

앞 사이클에 지문 1편을 완주하면서 발견한 결함을 고쳤다. 실측으로 재고 실측으로 확인했다.

| 기사 | 이전 | 이후 |
|---|---|---|
| 코리아헤럴드 (KASA 위촉) | 45문장 (본문 아닌 것 29) | **16문장** |
| 연합뉴스 (같은 사건) | 13문장 (본문 아닌 것 8) | **5문장** |

둘 다 마지막 줄이 실제 기사 본문으로 끝난다.

- **문장부호가 첫 번째 근거다.** 기사 문장은 `.`·`?`·`!` 로 끝나고 관련 기사 제목 줄은
  끝나지 않는다. 그런데 이전 규칙은 마침표 없는 줄을 **2단어 이하일 때만** 걷어 내서,
  `Big Bang to release new single 'Biiig' on 20th anniversary` 같은 제목에서 다듬기가 멈췄고
  그 뒤 24줄이 전부 살아남았다. 20단어 이하로 올렸다.
- **문장부호만으로는 부족했다.** 연합뉴스의 관련 기사 제목은 `… on 20th anniv.` 처럼
  **약어 마침표로 끝난다** — 문장처럼 보여 그냥 지나간다. 대신 발행사가 스스로 적어 둔
  섹션 머리(`Related Articles` · `More from` · `Most Read` …)를 근거로 자른다.
  **뒤쪽 절반에서만** 찾는다 — 앞에서 찾으면 기사 전체가 사라진다. 머리글은 6단어 이하만.
- 새 계측 `scripts/compose/extract-probe.mjs` — 실제 기사 주소로 추출 결과의 처음·끝을
  보여 준다. 단위 테스트는 **우리가 상상한 꼬리**만 검증하므로, 발행사가 실제로 붙이는 것과
  어긋나도 초록불이 뜬다. 고쳤다고 말하려면 실제 기사로 세어 봐야 한다.
- 게이트 판정에는 영향이 없다 — 지문(fingerprint)은 원본 HTML 에서 만든다. 달라지는 것은
  사실 카드를 쓰는 사람이 훑는 목록의 질이다. 회귀 433.

### ACP §20 — 한국 학습자용 지문 1편, 화면 없이 처음부터 끝까지 (v06.278)

지금까지 사이클은 **재료**를 늘려 왔다. 이번에는 그 재료로 실제 지문이 나오는지 확인했다.
연합뉴스 + 코리아헤럴드가 각자 보도한 국내 사건에서 **게이트 6종 전부 PASS · 벤치마크 두 축
모두 통과**한 중등 지문 1편이 나왔다.

- **취재 시작·발주에 헤드리스 경로 신설** — 드레인의 나머지(처리·가공·게이트·검수)는
  스크립트가 있는데 이 둘만 화면 전용이라, 사건이 익어도 배치가 스스로 시작하지 못하고
  사람이 브라우저를 열 때까지 멈춰 있었다.
  `scripts/compose/drain-coverage.mjs`(익은 사건 목록 → 소스 읽기 → 묶음 생성) ·
  `scripts/compose/queue-job.mjs`(유형·레벨 → 사양 생성, `buildJobSpec` 을 그대로 쓴다).
  이제 화면 없이 전 구간이 돈다.
- **산출물**: `A pop group speaks for a space agency` (V4 · B1 · 183어 · 중등)
  — 한국항공우주청이 대중음악 그룹을 첫 명예대사로 위촉한 사건.
  게이트 I12~I17 **6/6 PASS** (구조 독립성 ρ=-0.56 · 임계 0.8).
  벤치마크: 밴드 초과 **3.7% ≤ 표본 중앙 4.2%** · 문체 하한 **4.84 ≥ 4.60**.
- **검수가 실제로 무언가를 잡았다.** 초판은 문체 하한 4.42 < 4.60 — 어휘 밴드는 통과인데
  **글이 너무 쉬웠다**. 낱말을 길게 고쳐 4.98 로 올렸고, 그 과정에서 측정 V-Level 이
  2 → 4 로 올라 발주 목표와 일치했다. 본문을 고치자 게이트가 자동으로 "이전 본문 기준" 경고를
  띄웠다 — 해시를 함께 저장한 설계가 그대로 작동했다.
- **기계가 못 보는 판단 목록에서 둘을 고쳤다.** ① 첫 명예대사라는 사실을 두 문장이 다른 말로
  반복하고 있었다 → 뒤 문장이 *왜* 처음인지(기관이 2년밖에 안 됐다)를 말하도록 바꿨다.
  ② 같은 대상을 `agency` 와 `organization` 으로 번갈아 불러 재인이 끊겼다 → 하나로 통일했다.
- ⚠️ **드러난 문제**: `extractArticle` 이 발행사 사이트의 관련기사·반응 카운터·다른 헤드라인을
  본문으로 함께 걷는다(코리아헤럴드 45문장 중 25문장이 그것이었다). 사실 카드를 쓰는 사람이
  걸러 내면 되지만, 걸러야 한다는 것 자체가 비용이다. 지문(fingerprint)은 원본 HTML 에서
  만들므로 게이트 판정에는 영향이 없다.

### ACP §20 — 전 발행사에 발견을 돌려 보니, 코리아헤럴드가 예외였다 (v06.277)

앞 사이클에서 피드 찾기의 조건 하나를 고쳐 코리아헤럴드 섹션 7개를 되찾았다. 같은 결함이
발행사마다 똑같이 작용했을 테니 전부 돌려 봤다 — **결과는 "더 없음" 이었고, 그게 성과다.**
더 캐면 나올 것 같다는 느낌으로 피드를 늘리는 일을 여기서 끊는다.

- 새 계측 `scripts/compose/discover-sweep.mjs` — 등록한 소스 전부에 피드 찾기를 돌려
  "등록 대비 새로 보이는 것" 을 표로 낸다. 발행사는 피드를 새로 만들거나 옮기므로 일회성
  점검이 아니다. 읽기 전용 — 등록은 `register-feed.mjs` 로 따로 한다.
- 실측(12 소스 · 요청 84): 등록할 만한 새 피드 **0개**. 코리아헤럴드 미등록 4개는 전부
  기준 미달(National 부적합 38% · World 58% · Opinion 적합 2% · Business 적합 6%),
  abc.net.au 새 섹션 적합 0%, abcnews usheadlines 부적합 72%.
  AP 는 **자기 robots 가 자기 피드를 막고**, CBC 는 robots 를 못 준다.
- ⚠️ **첫 판이 거짓 양성을 냈다.** BBC "새로 보임 5" 중 5개, 알자지라 1개가 이미 등록된 것과
  같은 피드였다 — 주소만 다르다(`feeds.bbci.co.uk/news/…` vs `bbc.co.uk/news/…`).
  그대로 믿고 켰으면 **같은 기사를 두 번 걷는 피드**가 늘 뻔했다. 경로 일치 + 실린 기사
  주소 80% 겹침으로 같은 피드를 판정하도록 고쳤다(BBC 5→0 · 알자지라 1→0).
- 추천 임계값을 `feed-fitness.mjs` 의 "적합 10% 미만 = 거의 못 물어온다" 선과 **같은 값**으로
  맞췄다. 스크립트마다 다른 선을 쓰면 한쪽은 죽었다 하고 한쪽은 권한다.

### ACP §20 — 알림 하나가 섹션 피드 여덟을 가리고 있었다 (v06.276)

쓸 수 있는 사건 5 → **9**, 그중 한국 관련 4 → **7**. 피드를 빼서가 아니라, 못 보고 있던 것을
보게 해서 늘었다.

- **피드 찾기의 조건 하나가 섹션 피드를 통째로 가리고 있었다.** 예전 규칙은 "홈페이지 알림이
  **하나도 없을 때만** 안내 페이지 링크를 줍는다" 였다. 그런데 거의 모든 발행사가 "전체 뉴스"
  피드 하나는 `<link rel="alternate">` 로 알린다 — 그 하나가 있으면 나머지를 영영 못 본다.
  실측: 코리아헤럴드 홈은 `newsAll` 하나만 알리지만 `/rss` 안내 페이지에 **섹션 8개**를
  적어 두고 있었고(`kh_LifenCulture`·`kh_Sports`·`kh_Kpop` …), 우리는 사흘 동안 전체 피드
  하나만 쓰고 있었다. 그 주소들은 `kh_` 접두사라 관습 경로 추측으로는 찾을 수 없다.
  고친 뒤 실발행사 발견 결과 **1개 → 8개**.
- 안내 페이지를 **한 단계만** 따라간다. 피드가 아닌 응답에서 링크를 주워 한 판 더 확인하고
  거기서 멈춘다 — 목록이 또 목록을 가리키면 그건 발견이 아니라 크롤이다(회귀로 못 박음).
- 코리아헤럴드 섹션 3개 등록 — 생활·문화(적합 30.0% · 부적합 6.0% · 표본 50) · 스포츠 ·
  K-pop(부적합 0.0%). 등록 근거는 적합률만이 아니다: 연합 문화/스포츠와 **같은 국내 사건을
  각자 보도**하므로 독립 2계통이 성립한다. 실제로 수집 즉시 연합↔헤럴드 짝이 셋 생겼다
  (BIGBANG 우주항공청 홍보대사 · Stray Kids 빌보드 · 야구).
- 새 계측 `scripts/compose/necessity-probe.mjs` — **빼면 무엇을 잃는가**(leave-one-out).
  기여했다고 필요한 것은 아니다. 같은 사건을 다른 둘이 이미 덮고 있으면 그 소스는 없어도
  된다. 실측: 연합 -7 · 헤럴드 -5 · 코리아타임스 -4(전부 한국 관련) · abcnet·bbc·dw 각 -1 ·
  **abcnews·aljazeera·guardian·npr·워싱턴포스트는 빼도 0**.
- `feed-fitness.mjs` 가 **피드 하나가 안 열리면 보고 전체를 죽이던 것** 수정
  (실패 행에 `upct` 가 없어 `undefined.toFixed`). 실패도 행으로 남긴다.
- 활성 피드 17 → 20. 회귀 425.

### ACP §20 — 짝을 못 짓는가 주제가 안 맞는가, 나눠서 재기 (v06.275)

기여 0인 피드를 끄기 전에 원인을 갈랐다. "짝은 짓는데 주제가 하드뉴스" 와 "아무와도 안 겹침" 은
처방이 다른데 기여도 하나로는 구별이 안 된다 — 이걸 안 나누고 껐다가 되살린 적이 있다.

- 새 계측 `scripts/compose/pairing-probe.mjs` — 소스별 **짝 성립률**과 동시출현 상대를 낸다.
  실측(30일): 짝 성립률 1~4위가 전부 한국 매체(코리아타임스 47.0% · 알자지라 33.3% ·
  코리아헤럴드 32.0% · 연합 29.5%)이고 서로가 서로의 주된 짝이다(연합↔타임스 45회).
  기여 0인 4곳은 **짝은 18~27건 짓는데 학습 적합이 0** — 주제 문제이지 구조 문제가 아니다.
  구조적 결론: **소프트뉴스는 발행사마다 다른 것을 쓴다.** 여러 곳이 동시에 다루는 것은
  대개 사건사고·정치다. 한국 매체가 통하는 이유가 이것이다 — 국내 소프트뉴스를 셋이 함께 다룬다.
- 코리아타임스 섹션 피드 2개 등록 — 라이프스타일(적합 25.0% · **부적합 0%**) ·
  엔터테인먼트(33.3% · **부적합 0%**). world(부적합 62.5%)·opinion(0% 적합)은 뺐다.
  Cycle 8 에서 "코리아타임스는 섹션 피드가 없다" 고 적었던 것은 경로를 잘못 짚은 것이었다.
- **얇은 피드에서 발행 시각 되살리기가 그냥 통과하던 구멍** — 퇴화 판정 하한이 5건이라
  항목 4~6건짜리 섹션 피드는 **같은 발행사의 같은 결함인데 걸리지 않았다.** 표본이 얇을 때는
  근거를 하나 더 요구하도록 바꿨다(뭉친 그 시각이 지금과 30분 안인가 = 피드를 만든 시각인가).
  실경로 확인: 새로 수집한 10건 전부 주소 날짜로 되살아났다.
- **오늘 날짜를 되찾으면 미래 시각이 저장되던 것** — 그날의 끝(23:59)이 아직 오지 않았다.
  지금으로 자른다. 방금 받아 온 글이므로 발행은 늦어도 지금이고, 잘라도 여전히 상한이라
  일찍 익지 않는다.
- `feed-fitness.mjs --url <주소>` — 등록하지 않은 후보 피드를 먼저 재고 나서 올린다
  (등록·해제를 반복하면 피드 표에서 무엇을 왜 껐는지 흐려진다). 활성 피드가 0일 때
  NaN% 를 찍던 것도 함께 고쳤다.
- 새 스크립트 `scripts/compose/register-feed.mjs` — 화면과 같은 `verifyFeedUrl`(robots ·
  실제 파싱 · 최신성)로 검증한 뒤 등록한다. 사이클마다 일회용 코드를 쓰다 보니 검증을
  빠뜨리기 쉬웠다. 기본은 꺼진 채로 등록.
- 활성 피드 15 → 17. 회귀 421.

### ACP §20 — 한국 학습자용 피드로 좁히기: 시차를 결함으로 오해하지 않기 (v06.274)

수집 화면은 "한국 관련 0" 이라고 하는데 기여도 측정은 "쓸 수 있는 사건의 60%가 한국 관련" 이라고
말하고 있었다. 둘 다 맞았다 — 차이는 **48시간 보류**였다. 그 차이를 시간으로 보여 주는 계측을
만들고, 그 과정에서 드러난 결함 넷을 고쳤다.

- **발행 시각이 퇴화한 피드 되살리기** (`ingest-article/_helpers.ts`) — 코리아타임스 피드가
  37항목 전부에 피드 생성 시각을 찍는다(같은 시각 코리아헤럴드는 50항목 중 45개가 서로 다름 —
  파서 탓이 아니라 그 피드의 결함이다). 그대로 두면 48시간 보류가 **우리가 처음 본 시각**부터
  세어져 다른 한국 매체와 함께 익지 않는다 — 한국 매체끼리 국내 사건에 독립 2계통을 만드는
  경로가 여기서 끊긴다. 퇴화 판정(5건 이상 · 서로 다른 시각 10% 이하) 뒤 주소에 박힌 날짜로
  되살리되 **그날의 끝**으로 잡아 절대 일찍 풀리지 않게 했다. 실경로 확인: 코리아타임스 12건이
  주소 날짜로 저장됐다.
- **본문이 안 열리는 소스는 피드를 걷지 않는다** (`isFeedCollectable`) — 발행은 **읽을 수 있는**
  독립 2계통을 요구하므로 `bodyAccess: 'blocked'` 는 그 둘 중 하나가 될 수 없다. 실측 30일:
  NPR·워싱턴포스트 후보 64건 · **기여 0건**. 피드 4개 비활성(19→15). 교차확인 자격은 그대로 둔다
  — 두 질문을 다시 합치지 않는다(합쳤다가 주제 커버리지를 무너뜨린 적이 있다).
- **사건 단위 한국 관련성** (`isKoreaRelevant`) — 제목 키워드는 추측이고 발행사는 사실이다.
  한국 영문 매체 2곳 이상이 각자 다뤘으면 한국 관련으로 본다(1곳은 국제 뉴스 전재일 수 있어
  근거가 못 된다). `LG`·`SK Hynix`·`Kia` 가 키워드에서 빠져 있던 것도 함께 고쳤다 — 기여도
  스크립트가 정규식 사본을 들고 있어 갈라져 있었고, 그 사본을 없앴다.
- **군사 훈련이 운동으로 새던 것** — `exercise` 가 적합 신호(운동)라 국방부 훈련 기사가 학습
  적합으로 올라왔다. 군사 기관·훈련 패턴을 부적합에 추가했다.
- 새 계측 `scripts/compose/ripen-eta.mjs` — 쓸 수 있는 사건이 **언제** 익는지 시각으로 보여 준다.
  지금 0건인 것이 고장인지 시차인지 구별하는 용도(읽기 전용).
- 실측: 쓸 수 있는 사건 5건 중 **한국 관련 4건(80%)** 이고 전부 한국 매체 짝이다(연합+헤럴드 ·
  연합+타임스 · 3사 동시). 회귀 416.

### ACP §20 — 외부 벤치마크로 목표를 고정하고 산출물 6편 (v06.43)

"글로벌 플랫폼 수준 이상" 을 반증 가능한 숫자로 바꿨다. News in Levels 15편(L1·L2·L3 각 5)을
**우리 산출물과 같은 계측기**로 재서 `compose/benchmark.ts` 에 박고, 검수가 매번 견준다.
남의 본문은 저장하지 않는다 — 숫자와 주소만 남긴다.

- **기준선이 세 밴드 모두 틀렸다.** 발행 코퍼스(레벨용으로 쓴 글이 아님)로 잡았던 탓이다:
  초등 33%→10% · 중등 12%→6% · 고등 10%→3%. 그런데 고등은 표본 2편으로 조인 것이라
  5편으로 늘리자 **정상 글(4.6%)을 막는 값**이었다 → 5%. 헐겁게 두는 것과 얇은 표본으로
  조이는 것이 **같은 크기의 결함**이라는 게 이번에 드러났다.
- **계측기가 둘이었다** — 같은 글이 추출 어휘 26.8% · 원문 토큰 14.8%. 밴드는 *읽는 사람이
  만나는 단어*를 세는 축이므로 `tokenizeForBand` 로 통일했다(남의 글에는 우리 추출
  파이프라인을 못 돌리니 비교도 이쪽만 성립한다).
- **산출물 3→6편.** 수집이 물어온 취재 가능 사건 6건이 전부 학습 부적합이라(사망·사고·
  정치 쟁점) 억지로 쓰지 않고 적응 경로로 늘렸다. 같은 원본에서 두 레벨을 파생해
  **형제 판 I17** 이 처음으로 실제 대조군을 가졌다.
- **I17 이 레벨 간 자기표절을 두 번 잡았다** — 같은 원장에서 V6·V8 판을 쓰자
  "the operator had already idled one of the" · "that no restart was expected within ten days"
  가 각각 8어절씩 겹쳤다. 같은 사실을 여러 레벨로 쓰면 표현이 새어 나온다.
- 적응 제목이 둘 다 '(easier)' 로 같아 학습자에게 같은 글 두 개로 보이던 것 →
  '(초등 쉬운 판)' · '(중등 쉬운 판)'.
- `Word.vLevel` 을 렌더러까지 잇되 **본문에 색은 더하지 않았다** — Memory Decay 4색이 이미
  본문 표시를 쓰고 있어 다섯 번째 시각 상태를 만들면 그 체계가 무너진다.

같은 계측기로 잰 현재 위치 — **6편 전부 표본 중앙값보다 낫다**:
  초등(중앙 7.3%) 4.5 · 5.4 · 3.6   중등(중앙 4.2%) 2.3 · 2.1   고등(중앙 1.1%) 0.0

미해결로 남긴 것:
- **고등 밴드에 하한이 없다** — 천장만 있어 CSAT 지문을 쉽게 만들수록 점수가 좋아진다.
  대입 밴드에는 하한이 있지만 고등에는 없고, NiL L3 표본도 2/5 가 0% 라 하한을 세울 근거가
  얇다. 어휘가 아니라 구문 복잡도로 재야 할 문제로 보인다.
- **csat 의 '한 문단으로 쓴다' 지시와 DCP 문단 적격(4~6문장)이 충돌한다** — V8 판이 7문장
  한 문단이라 구문 연습 문항이 0개다(V6 판은 4+4 문단이라 4개).

### ACP §20 — ACP·Compose 경계 정리 + 레벨 적응 신설 (v06.42)

두 파이프라인이 소스를 두고 다투는 것처럼 보였으나 **실측하면 실제 겹침은 0건**이었다
(ACP 발행 81편의 소스는 compose 후보 0 · compose 후보 852건의 소스는 ACP 발행 0).
자연스럽게 갈린 규칙을 코드로 굳히고, 비어 있던 칸(레벨 적응)을 채웠다.

- **소스 역할 3종** — `supply`(ACP 가 본문째 발행) / `collect`(Compose 가 사실만) /
  `corroborate`(교차확인 전용). **supply+collect 겸직 금지** — 라이선스가 있는데 재저작하는
  것은 순손실이다(원어민 문장을 버리고 게이트 6종 비용을 치른다). 손으로 적지 않고 파생한다.
  만드는 동안 회귀 둘을 냈고 둘 다 실측이 잡았다: `discovery` 로 판정해 dw(후보 152건)를 끊은 것,
  `isCollectable` 에 역할을 섞어 ACP 공급원이 교차확인 출처에서까지 빠진 것.
- **산출물 3계층** (CommonLit 모델) — ① 원문 그대로(ACP) ② **레벨 적응**(신설) ③ 사실 재저작.
  계층마다 출처 문구가 다르다 — 같은 문구를 쓰면 학습자에게 거짓을 말하는 것이다.
- **사실 출처 표기** — 재저작 글 본문에 박는다. 학습자가 만나는 표면이 셋(카드 → texts 변환 →
  리더)이라 별도 필드면 한 곳만 빠져도 출처 없는 글이 도달한다. 붙이자마자 **I17 이 두 판을
  모두 차단**했다(형제 판끼리 표기 22어절 공유) → 지문 대조에서 표기를 뗀다.
- **레벨 적응 경로** (마이그레이션 `acp_compose_adaptation`) — 라이선스 보유 글 127편에서 쉬운
  판을 파생. 게이트가 다르다: 라이선스가 사용을 허락했으므로 I12~I16 은 **성립하지 않고**,
  critical 은 I17 하나(원본과 쉬운 판이 서가에 함께 서는 것)다. 경고 둘 — A1 원문 재작성 ·
  A2 목표 레벨. 적용 전 검토에서 트리거 조건이 `source='original'` 뿐이라 **적응 글이 I17 검사를
  통째로 건너뛸 뻔한 것**을 고쳤다(적응 글의 source 는 원본 그대로여야 카탈로그 제자리에 선다).
- **실측** — NASA "Hubble Sees Swarm of Galaxies"(PD · V5 · C1 · 393어) → 136어 초등판.
  게이트 3/3 PASS · **밴드 초과 27.6%** — VOA Learning English 30편의 p50 27.3% 와 거의 같다.
  같은 글의 `article_v_level` 은 V4, `cefr_level` 은 B2 로 나왔다 — P75 와 밴드 비율이 다른 것을
  잰다는 것, 그리고 `cefr_level` 의 과대평가가 글 수준에서도 그대로라는 것이 실물로 확인됐다.
- 학령별 길이를 `GradeBand` 로 옮겼다 — 길이는 독자의 것이지 목적의 것이 아니다
  (초등 90~170 · 중등 180~320 · 고등 130~260 · 대입 250~450).
- 카탈로그 카드에 `쉬운 판` 배지 — 적응 글은 원본과 같은 트랙에 서므로 표시가 없으면
  같은 글이 두 개로 보인다. 드리프트 락 4건(질의·타입·카드 문구까지 함께 검사).

### ACP §20 — 어휘 스파인: 새로 만들 게 아니라 이미 V-Level 이었다 (v06.41)

초중고대입 확장을 위해 "NGSL(초등) × 교과서(중등) × 기출(고등)" 을 하나의 난이도 축으로
정렬하려 했으나, **설계 전에 재 보니 그 축이 이미 있었다.**

- **V-Level 이 스파인이다** — `shared_dictionary` 47,125 중 **47,114(99.98%)** 에 붙어 있고
  교육 기준 정답지인 CEFR-J 어휘 밴드와 단조로 맞는다: **A1→V중앙값 1 · A2→3 · B1→5 · B2→7**
  (n = 1,023 / 1,194 / 1,931 / 1,950).
- **다른 축은 정본이 될 수 없다** (같은 측정):
  - `cefr_level` (커버리지 47,125) — CEFR-J 와 **정확 일치 36.7%**(2,236/6,098)이고 어긋남이
    거의 전부 **한 단계 과대평가**다(A1 단어의 59%를 A2 이상으로). 커버리지가 제일 넓은 축이
    제일 편향돼 있다.
  - `ngsl_sfi` (12,152) — 빈도 밴드와 V 는 크게 보면 단조지만(평균 V 1.99→4.31→6.80→8.48→9.71)
    어긋나는 151건 중 **141건(93.4%)이 파생형**이다(birding·branding·casting). NGSL 은 lemma
    family, V-Level 은 형태·의미 — **축 충돌이 아니라 단위 불일치**다.
  - NGSL 의 교육 맹점 — 달력 어휘(december SFI 14.8 · wednesday 17.4)는 빈도가 낮지만 CEFR-J 는
    **전부 A1**, V-Level 도 2~3. 빈도로 초등 밴드를 만들면 "Wednesday 가 phenomenon 보다 어렵다"
    가 된다. **빈도는 교수 순서가 아니다.**
- `compose/spine.ts` — 학령 밴드 4종(초등 V1–3 · 중등 3–6 · 고등 5–8 · 대입 7–11, **경계를 겹치게**
  둬 학령 사이에 읽을 수 없는 골이 없게), `SPINE_AXIS`(정본/정답지/보조/불신 명시),
  `profileBand`(밴드 초과 **비율** — `article_v_level` 과 달리 길이에 딸려 가지 않아 렌더링
  제약으로 쓸 수 있다), `bandForVRange`. 회귀 9 + 발주 1.
- **밴드 기준선 실측 보정** — 발행 아티클 160편에서 밴드 초과 비율 분포를 재어 임의 상수를 교체했다
  (글 자신의 `article_v_level` 로 묶어 백분위를 봤다 — 그 레벨에 실제로 있는 글이 통과해야 하므로).
  측정에서 설계가 두 번 바뀌었다:
  - **대입 밴드는 천장이 무의미하다** — V>11 초과가 전 구간 **0.00%**(V11 이 축의 끝). 최상위에서
    제약이 뒤집힌다: 어려운 말을 막는 게 아니라 심화 어휘(V≥9)를 **충분히 넣었는지**를 본다.
  - **초등 밴드는 보정 불가** — 가장 쉬운 V2 지문조차 V3 초과가 20~22%. 초등용 지문이 코퍼스에
    **0편**이라 정상 분포를 알 수 없다. `calibrated: false` 로 두고 판정하지 않는다.
  - 보정된 것: 중등 12%(V3~4 지문 50편 p90 9.2~10.1%) · 고등 10%(V5~6 지문 104편 p90 5.9~9.1%).
    내가 처음 넣은 값(3/5/8/12%)은 양방향으로 틀렸다 — 초등 3% vs 실측 42%, 고등 8% vs 3.6%.
- `ComposeJobSpec.gradeBand` — 발주가 학령을 싣는다(유형에서 파생). **지금은 정보로만 싣고
  어휘를 강제하지 않는다** — 임계는 분포를 본 뒤에 정한다.
- `scripts/compose/spine-report.mjs` — 축 건강성 + 지문 적합성 재측정. 문서 수치를 근거로 쓰지
  않기 위해 매번 다시 잰다. 실측: csat 판 밴드 초과 2.0%(shutdown V9) · 일반판 2.5%(reactor V8).
  ⚠️ 작성 중 **정렬 없는 `.range()` 페이지네이션**으로 밴드 분포가 어긋나는 것을 발견해 고쳤다
  (IA 수집에서 이미 겪은 결함이 재발).

### ACP §20 — 드레인 첫 완주 · 없던 실행 경로 셋 (v06.40)

다뉴브강 원전 정지 취재로 재저작 드레인을 **처음 끝까지** 돌렸다. 결과물은 아티클 2편
(csat_korean V6 154어 · general_proficiency V3 189어) · 게이트 12/12 PASS · 어휘 110 ·
DCP 문항 4 · 발행 차단 0. 발행은 설계대로 검수자 몫으로 남겼다.

돌려 보니 **드레인 3단계에 실행 경로가 아예 없었다** — 셋 다 dev 전용 라우트(프로덕션 403 +
admin 쿠키)에만 있었는데 드레인은 헤드리스라 둘 다 없다. 상설 스크립트로 만들었다:

| 단계 | 스크립트 |
|---|---|
| ③ 수집(매일) | `scripts/compose/collect-daily.mjs` |
| ⑦ 처리 | `scripts/compose/drain-process.mjs` |
| ⑧ 가공(활동) | `scripts/compose/drain-activities.mjs` |
| ⑨ 게이트 | `scripts/compose/drain-gates.mjs` |

- **I14 가 실제 위반을 잡았다** — A2 판이 dw.com 전개를 ρ=0.84 로 따라갔다(사실 하나만 맨 뒤로
  옮긴 초안). 학습 순서로 다시 써 ρ=0.54. 실측 등장 순서 기반 회귀 2건 추가.
- **사실 순서를 저장하지 않고 있었다** — I14 의 유일한 입력인데 저장 자리가 없어, 일회성 검사가
  두 판에 같은 순서를 넣어 잘못 쟀다. `composed_spec.fact_order` 에 기록하고, 없으면 조용히
  통과시키지 않는다.
- **문단 계약** — 단일 개행은 문단 구분이 아니라서 189어 글이 21문장 한 문단으로 잡혀 활동 문항이
  0 이었다. `explainDcpEligibility` 로 사유를 말하게 하고 빈 줄 문단 4~6문장을 계약으로 명시.
- **V-Level 판정 재정의** — `article_v_level` 은 정의상 서로 다른 lemma 의 P75 라 길이에 딸려
  올라간다(발행 실측: 같은 CEFR 대에서 300어 미만 4.00 → 1,500어 이상 4.86). 재저작 글은 설계상
  짧으므로 계약을 점 목표에서 **유형 밴드**로 바꿨다.
- **학습자 레일 라벨 드리프트** — `plan-activities` 가 발행사 이름을 따로 들고 있어 `source-meta`
  와 갈렸다(6 vs 15). 재저작 글은 레일에 내부 키 `original` 이 그대로 찍혔다. 정본 위임 + 드리프트 락 4.
- 매일 수집이 **운영 요건**임을 실측으로 확인 — 피드는 1~2일치만 싣는데 I15 는 48시간을 요구한다.
  수집이 멈추면 파이프라인은 고장 나는 게 아니라 굶는다(수집분 사건 0 vs 보관 익은 후보 318 → 사건 2).

### ACP §20 — 피드 20개 실등록 + 발견 실측 (v06.39)

12 발행사 · **피드 20개를 실제로 등록**했다. 넣기 전에 전부 다시 열어 확인했고
(17/17 통과 · 671항목 · **전 항목 발행 시각 파싱** — DW 137건 포함해 `dc:date` 수정 확인),
호스트 판정(`isPublisherHost`)도 함께 검사해 통과한 것만 넣었다.

- **BBC 중복 정리** — 같은 내용이 `bbc.co.uk` 5개 + `feeds.bbci.co.uk` 3개로 이중 등록돼
  **요청이 두 배로 나가고 있었다**. 정본을 `feeds.bbci.co.uk` 로 통일(8→5).
- **전체 수집 실측** — 요청 32건 · **robots 실패 0 · 건너뜀 0** · 후보 293건.
  20개 피드가 전부 깨끗하게 돈다.
- **클러스터링 실측** — 하루치 조밀한 후보를 묶으니 **23개 사건**, 최상위가 **독립 5계통**
  (Kushner–Hamas 회담: ABC뉴스·NPR·WaPo·DW·BBC / DR콩고 에볼라: BBC·DW·ABC뉴스·Guardian·Korea Times).
- **후보 771건 적재** (그중 268건 이미 48시간 경과) — 30일 초과분은 설계된 정리 RPC 로 제거.

**운영 조건이 데이터로 확정됐다 — 매일 돌려야 한다.** 익은 268건에서는 사건이 2개뿐인데
오늘치 503건을 묶으면 23개다. 이유는 분포에 있다: 어제·오늘은 **8~10개 발행사**가 겹치는데
그 이전 날짜는 피드 꼬리만 남아 **3~4곳**뿐이다. 하루 한 번 수집하면 그날의 조밀한 묶음이
통째로 익지만, **거른 날의 사건은 다시 받을 수 없다.** 화면과 도움말에 명시했다.

⚠️ 무관한 선행 실패 — `content-quality-gate.integration` 2건(사전DB I1 필드 결측 11행 ·
LCP 도서 I7)이 실패 중이나 재저작과 무관하다(재저작 아티클 0건 상태에서 재현).

### ACP §20 — 기사 URL 직접 취재(스크래핑) 경로 (v06.39)

피드만으로는 막히는 곳이 많다 — AP 는 **자기 robots 가 자기 피드를 막고**, CBC 는 연결이 안
되며, 피드가 있어도 최근 1~2일치만 실어 48시간 규칙과 어긋난다. 운영자가 아는 기사 주소를
넣으면 그 자리에서 취재가 시작되는 경로를 만들었다. **규율은 피드 경로와 같다** — robots 를
보고, 간격을 지키고, 본문은 읽은 뒤 **지문만 남기고 버린다**.

- **`compose/extract.ts`** — 기사 HTML → 본문. 신뢰도순 4단계(JSON-LD `articleBody` →
  `<article>`/`itemprop` → `<main>` → 본문 밀도) + **어디서 건졌는지(`via`)를 함께 돌려준다**
  (`density` 는 신뢰도가 낮으니 화면이 그렇게 표시한다). 네비·광고·저작권 문구를 사실로 읽지
  않는 것이 핵심이다.
- **실측 8개 발행사 본문 추출 성공** — BBC 722어 · ABC뉴스 894 · CNN 726(json-ld) ·
  Guardian 706 · Korea Herald 437 · 연합 390 · DW 393 · Al Jazeera 77.
- **가장자리 잡음 제거(`trimBoilerplate`)** — 실측에서 첫 문장이 BBC=`By Olivia Ireland`,
  DW=퍼머링크 URL, 연합=`Facebook` 이었다. **기자 이름이 사건이 되면 안 된다.** 바이라인·소셜
  위젯·날짜 줄·퍼머링크를 앞뒤에서만 걷어 낸다 — **가운데는 건드리지 않는다**(짧은 문장도
  사실일 수 있고, 잘못 지우면 사실이 사라진다). 적용 후 BBC 가 실제 리드 문장으로 시작.
- **후보 선택 규칙 수정** — 우선순위만 따르면 `<main>` 에 걸린 요약(77어)에서 멈춰 본문을
  놓친다. JSON-LD 는 항상 신뢰하고, 그 외에는 **가장 긴 후보**를 고른다(Korea Herald 145→437어).
- **`startCoverageFromUrls`** — 주소 목록 → 발행사 판정(호스트) → robots → 스크래핑 → 지문 →
  **독립 계통 2개 확인** → 취재 묶음 생성. 2계통을 못 채우면 **묶음을 만들지 않는다**.
  미등록 발행사도 받되 화면에 그렇게 표시한다(계통·약관을 우리가 보증하지 못하므로).
- **읽어 온 문장을 사실 카드 작성 참고로 보여 준다** — 저장하지 않는다. 화면이 함께 경고한다:
  "이 문장을 그대로 옮기지 마세요 — 표현을 복사하면 발행 때 표현 독립성 게이트가 막습니다."
- 회귀 extract **18** · 렌더 +1 · 패키지 **303** · admin **76** · web `tsc` 통과.

### ACP §20 — "수집 눌러도 반응 없음" 의 원인 넷 (v06.39)

실제 피드로 ③ 발견을 돌려 원인을 전부 재현했다. **네 가지가 겹쳐 있었다.**

- **활성 피드가 0이면 버튼이 잠겨 있었다** — 왜 잠겼는지 말하지 않으니 고장으로 읽힌다.
  잠그지 않고 누를 수 있게 두되 액션이 "활성 피드가 없습니다" 라고 답하게 했고, 화면 위에도
  "추가만 해서는 수집에 포함되지 않는다" 를 띄운다.
- **서버 액션이 던지면 아무것도 안 보였다** — `useAction` 에 try/catch 가 없어 예외가
  트랜지션 안에서 조용히 사라졌다. 이제 실패는 반드시 보인다. 액션 쪽도 네트워크 예외를
  잡아 메시지로 돌려준다.
- **RDF 피드의 모든 항목이 버려졌다** — `parseRssFeed` 가 `pubDate`·`published` 만 보고
  **`dc:date` 를 안 봤다**. DW 의 137항목이 전부 "발행 시각 없음" 으로 빠졌다(실측).
  회귀 4건 추가.
- **가장 큰 것 — 보류 후보가 휘발됐다** — 뉴스 피드는 최근 1~2일치만 싣는데 I15 는 48시간을
  요구한다. 그래서 매 수집에서 거의 전부가 보류로 빠지고 **취재 후보가 늘 0** 이었다
  (실측: 보류 78 · 후보 0). 보류분을 메모리에만 두면 다음 실행 때 그 기사는 이미 피드에서
  내려가 영영 못 쓴다. `article_compose_candidates` 로 저장하고, 목록은 **보관 후보 중
  48시간이 지난 것**에서 만든다 — 오늘 보류된 것이 이틀 뒤 저절로 올라온다.

**클러스터링 실측 검증** — 저장된 78후보가 익었다고 가정해 묶으니 **7사건 · 오탐 0**:
Trump-한미훈련 축소(DW·BBC·Guardian·AlJazeera **4계통**) · DR콩고 에볼라(3계통) ·
인도 사원 압사(2) · Mount Etna 낙뢰(2) 등. 서로 다른 발행사가 다르게 쓴 제목을 정확히 묶었다.

- 마이그레이션 `20260818020000_acp_compose_candidates` (+ 30일 정리 RPC).
- 패키지 **285** · admin **75** · web `tsc` 통과.

### ACP §20 — 발행사 14곳 실측 프로브: 3 → 11 곳 작동 (v06.39)

WebFetch 는 막혀 있지만 **Node 의 `fetch` 는 나간다**는 것을 확인하고, 실제 코드
(`discoverFeeds`)로 14개 발행사를 전부 실측했다. 추측으로 고치던 것을 실측으로 바꿨다.

**1차 실측에서 9곳 성공 / 6곳 실패**, 실패 원인이 세 가지 구조적 결함을 드러냈다:

- **후보가 다른 호스트에 있으면 robots 미확인으로 전부 버려졌다** — 발행사가 피드를
  `feed.`·`rss.`·`feeds.` 별도 호스트에 두는 일이 흔한데, apex·www 만 확인하고 있었다.
  이제 후보 호스트를 **개별로 확인**한다(Korea Times 가 정확히 이 경우였다).
- **apex robots 를 못 읽으면 다른 호스트 피드까지 포기했다** — robots 는 *우리가 실제로 읽는
  호스트*의 것을 보면 된다. npr.org robots 는 안 열리는데 feeds.npr.org 피드는 정상이었다.
  절대주소 힌트가 있으면 계속 진행한다.
- **알림 후보가 전부 실패해도 힌트로 되돌아가지 않았다** — 발행사가 **자기 robots 가 막는
  피드를 알리는** 경우가 실제로 있다(AP).

**결과 (2026-08-18 실측)** — BBC 5 · ABC호주 3 · ABC뉴스 3 · DW 2(137항목) · WaPo 2 · NPR 2 ·
CNN 1 · Guardian 1 · Al Jazeera 1 · 연합뉴스 1(101항목) · Korea Herald 1 · Korea Times 1 =
**11곳 작동**.

- **AP** — 홈페이지가 알리는 `/index.rss` 를 **자기 robots 가 막고** hub 경로는 404. 쓸 수 있는
  발견 피드가 없다. 다만 Reuters 처럼 전면 차단은 아니라 기사 URL 을 **사실 증인**으로는 읽을 수
  있으므로, 목록에 남기고 `discovery: false` 로만 내렸다.
- **NHK 제외** — 열리는 피드가 **일본어**였다(영어 경로는 404). 아시아 계통을 늘리려 내가 넣었으나
  영어 사실 출처라는 전제를 못 채운다. MBC 와 같은 이유.
- **CBC** — 개발 환경에서 연결 자체가 실패. 차단인지 망 문제인지 여기서 구별할 수 없어
  **제거하지 않고** 운영 환경 재확인 대상으로 남겼다.
- 패키지 **281** · admin **75** · web `tsc` 통과.

### ACP §20 — 7단계 E2E 점검: 실제로 막던 것 3가지 (v06.39)

수기 운영에서 실패가 잦다는 보고로 **DB 왕복 전 구간을 직접 흘려** 막히는 곳을 재현했다
(취재 묶음 → 소스 2 → 사실 3 → 확인 6 → 발주 → 아티클 → 게이트 6 → 발행 → 단어세트).
점검 데이터는 검증 후 전부 삭제(원장·소스·발주·아티클·단어세트 0행 복귀).

- **발행이 막혀도 이유를 알 수 없었다 (가장 큰 문제)** — 발행을 막는 게이트는 **두 계열**인데
  화면은 재저작 게이트(I12~I17)만 보여 줬다. 실제로 막은 건 **콘텐츠 품질 게이트**
  (`추출 비어있음(0단어)`)였고, 트리거는 "품질 게이트 FAIL" 이라고만 말한다. 그래서
  **화면에는 전부 통과인데 발행만 안 되는** 상태가 된다. 이제 ⑦ 발행이 두 계열을 함께 보여
  주고, 발행 액션도 실패 시 어느 불변식이 막았는지 조회해 "드레인의 처리 단계를 먼저
  실행하세요" 까지 알려 준다.
- **난이도 미산출 경고 추가** — 처리를 건너뛰면 `cefr_level`·`article_v_level` 이 NULL 인 채
  발행될 수 있고, 그러면 학습자 화면에서 **i+1 추천 순위가 안 매겨진다**. 발행 전에 경고한다.
- **BBC 계열 피드를 우리가 거부하고 있었다** — `addFeed` 가 호스트를 발행사 도메인으로만
  검사했는데 BBC 실제 피드는 `feeds.bbci.co.uk` 로 **상위 도메인부터 다르다**. 발행사가 스스로
  알린 피드를 우리가 막는 셈이었다. `feedHosts` 를 레지스트리에 두고 `isPublisherHost` 로
  판정한다(CNN `rss.cnn.com` · NPR `feeds.npr.org` · WaPo `feeds.washingtonpost.com` 도 함께).
  접미사만 같은 호스트(`notbbc.co.uk`)로 우회하는 것은 여전히 막는다.
- **정상 확인된 것** — 게이트 없이 발행 시도 → 차단(상태 유지) · 게이트 기록 후 어휘까지
  있으면 발행 성공 + **단어세트 자동 생성** · `CC0-1.0 (Vocaflow Original)` → `cc0` ·
  `copyright_safe_in_kr=true` 자동 판정 · 원장 확인 표시 6건 정상.
- 회귀 +5(호스트 판정 4 · 발행 사유 표시 1) · 패키지 **281** · admin **75** · web `tsc` 통과.

### ACP §20 — 영문 소스 15곳으로 확충 (v06.39)

사용자 요청으로 목록을 넓혔다. 최종 **상업 뉴스 15곳**:
BBC · CNN · ABC News(미) · Washington Post · NPR · Guardian · Al Jazeera · CBC(캐나다) ·
ABC(호주) · NHK World(일본) · DW(독일) · AP · 연합뉴스 영문 · Korea Herald · Korea Times.

- **Washington Post 를 다시 넣었다** — 초판에서 "유료벽 때문에" 뺐는데 그건 **측정이 아니라
  예측**이었다(상업 뉴스를 통째로 뺐던 것과 같은 실수). 피드는 제목+요약을 주므로 사건 발견과
  사실 교차 확인에는 쓸 수 있는 경우가 많고, 본문이 정말 안 열리면 **취재 시작 단계에서 사유와
  함께 걸러진다**. 미리 뺄 이유가 없다 — 판단은 실행이 한다.
- **ABC News(미) 추가** · **NHK World 추가** — 아시아 계통이 연합뉴스 하나뿐이라 지역 편중이
  심했다(한국 학습자에게 지역 관련성도 높다).
- **Reuters 만 계속 제외** — 이건 예측이 아니라 **실측**이다. robots 가 `/` 를 전면 차단해
  어떤 URL 도 읽히지 않는다.
- 회귀에 "지역이 한쪽에 쏠려 있지 않다"·"예측으로 빼지 않는다" 를 추가. 패키지 **277**.

### ACP §20 — 실측 반영: Reuters 제외 · 발행사 확충 · ACP 겹침 분리 (v06.39)

운영자 실측(2026-08-17)으로 세 발행사의 결과가 나왔고, 각각 **다른 답**을 가리켰다.

- **Reuters 제외** — `robots.txt 가 / 를 막는다`. 일부 경로가 아니라 **전면 차단**이라 어떤 URL 도
  읽을 수 없고 사실 증인으로도 못 쓴다. 우회하지 않는 것이 규칙이므로 목록에서 뺐다.
- **AP 힌트 교체** — `/index.rss` 가 robots 금지로 확인돼 제거, hub 경로만 남겼다.
- **DW 힌트 교체** — 후보 4종 전부 404.
- **발행사 8곳 확충** (CNN·NPR·Guardian·Al Jazeera·CBC·ABC호주·연합뉴스 영문·Korea Times) —
  **초판 5곳은 너무 적었다.** Reuters 가 빠지자 통신사 계통이 AP 하나만 남아, 한 곳이 막히면
  교차 확인이 통째로 무너지는 구조였다. 인지도가 아니라 **취재 계통·지역·소유구조가 겹치지 않는
  순서**로 골랐다. 그 결과 `sport` 는 독립 계통 6개로 올라섰다.
- **명시적 제외에 사유 기록** — Washington Post(유료벽에 본문이 가려 **읽어도 사실이 안 나온다** —
  라이선스 문제가 아니다) · MBC(한국어 방송이라 영어 사실 출처가 못 된다. 국내 영어 계통은
  연합뉴스 영문·Korea Herald·Korea Times).
- **ACP 겹침의 실무 분리** — 피드 등록 선택지에서 **ACP 겹침 소스를 뺐다**. 피드는 *사건을 발견*
  하는 자리인데 기관 발표(NASA·NOAA·USGS·NIH·eLife·OWID)는 ACP 가 이미 자기 피드로 수집한다.
  기관 소스는 재저작에서 **사실 증인**(발견이 아니라 확인 단계에서 특정 URL 을 직접 읽음)이므로
  ① 소스 표에는 남고 피드 목록에서는 빠진다.
- **UX 결함 수정** — 피드를 추가하면 서버 액션의 `revalidatePath` 로 상태가 초기화되며 **② 피드
  에서 ① 소스로 튕겼다**(사용자 보고). 활성 단계를 세션에 남겨 작업하던 자리를 유지한다.
- 패키지 **275** · admin **32** · web `tsc` 통과.

### ACP §20 — 피드 정상 처리 방안 (v06.39)

앞선 수정은 실패 원인을 **추측으로** 고친 것이었다. 안정적으로 돌리려면 추측이 아니라
"실패를 유형으로 나누고 각각의 다음 행동을 주는 것" 이 필요하다.

- **실패 8유형 + 유형별 다음 행동** (`FeedFailureKind` · `FEED_FAILURE_ACTION`) —
  약관 미확인 · robots 못 가져옴 · robots 금지 · 거절(403) · 없음(404) · 피드 아님 ·
  네트워크 · HTTP 오류. **거절과 없음은 대응이 정반대다**(전자는 발행사를 빼고, 후자는 주소를
  다시 찾는다). 화면이 사유 밑에 `→ 다음 행동` 을 함께 보여 주고, 찾은 피드가 0이면
  실패 목록이 **펼쳐진 채로** 뜬다.
- **RSS 안내 페이지 파싱** (`parseFeedAnchors`) — 발행사는 `<link rel=alternate>` 대신
  "RSS 안내" 페이지에 **목록만** 두는 경우가 많다. 그 페이지의 `<a href>` 중 피드처럼 보이는
  것을 후보로 줍는다. 어차피 열어서 확인하므로 잘못 주워도 목록에 오르지 않는다.
- **직접 주소 백스톱** (`verifyFeedUrl`) — **주소 입력을 아예 없앤 것은 과교정이었다.**
  "사용자가 주소를 찾아 다니게 하지 말 것" 은 "넣을 수 없게 하라" 가 아니다. 자동 발견이
  **기본 경로**이고 직접 입력은 **대안**이다. 다만 검증은 똑같다 — robots 를 보고, 열어서
  항목이 파싱되는지 확인한 뒤에만 추가된다(robots 가 막은 주소는 직접 넣어도 거부).
- 회귀 feed-discovery **24** (안내 페이지 파싱 3 · 백스톱 3 · 실패 유형 2 포함) ·
  패키지 **273** · admin **65** · web `tsc` 통과.

### ACP §20 — 피드 발견 실패 수정 + ACP 중복 대응 완결 (v06.39)

**피드 찾기가 발행사 대부분에서 실패**하던 것을 고쳤다. 원인 셋이 겹쳐 있었다:

- **robots 를 apex 에서만 찾았다** — 대형 발행사는 robots·피드를 `www.` 호스트에서만
  서비스하는 경우가 흔한데, apex 하나만 보고 실패하면 **거기서 조회가 끝났다**.
  이제 두 호스트를 모두 확인하고 **하나라도 성공하면 진행**한다(둘 다 실패해야 중단).
  게이트에 두 호스트를 다 등록해야 www 주소의 피드가 통과한다.
- **홈페이지가 막히면 사실상 끝이었다** — 대형 발행사는 홈에서 자동 수집기를 막지만
  **피드는 배포용이라 열리는 일이 흔하다**. 이제 홈페이지 실패를 사유로 남기고 계속 진행한다.
- **관습 경로 5개가 실제 발행사 경로와 안 맞았다** — 발행사별 **알려진 피드 경로(`feedHints`)**
  를 레지스트리에 넣어 힌트부터 두드린다. ⚠ 힌트는 확정 주소가 아니라 **후보**이며, 열어서
  항목이 파싱되는 것만 목록에 오른다 — 틀린 힌트가 있어도 잘못된 피드는 등록되지 않는다.
  "주소를 아는 것은 시스템의 일" 이라는 원칙이 여기서 실제로 작동한다.

**ACP 중복 대응 완결** — 지난 턴에 미해결로 남긴 "I17 이 실제로 작동하는 배선" 을 이었다.

- **`acp_compose_shelf_candidates(batch)` RPC** (마이그레이션 `20260817070000`) — 대조군을
  두 경로로 찾는다: ① 같은 취재 묶음의 **형제 판** ② 이 묶음이 읽은 기사를 **ACP 가 이미
  본문으로 가져간 경우**. 조회를 매번 손으로 짜면 조건이 갈리므로 RPC 로 고정.
- **`shelfRecordFrom()`** — 우리 글 → I17 대조군 레코드. `publisher` 를 `vocaflow:` 로 시작하게
  만들어 판정문에서도 우리 것임이 드러난다. 우리 글이라도 **지문만 남기고 본문은 담지 않는다**.
- **drain 절차에 "서가 대조군 만들기" 단계 추가** — 이 단계를 건너뛰면 같은 내용이 서가에 두 번
  오른다. 대조군은 외부 소스와 **다른 자리**로 넘긴다는 경고도 함께(같은 자리면 출처 독립성이
  부풀려진다).
- 회귀 feed-discovery **18**(www 폴백·힌트·홈 차단 우회 포함) · gates **32** · 패키지 **271**.

### ACP §20 — ACP 와 소스 9곳 겹침: 규칙 + I17 서가 중복 게이트 (v06.39)

사실 출처 14곳 중 **9곳이 ACP(본문 수집) 소스와 같다**(usgs·noaa·nasa·nih·elife·owid·voa·
wikinews·wikipedia). ① 소스 화면에 두 목록이 나란히 보이면서 드러난 문제다.

- **규칙 — 겹치는 것은 소스이지 산출물이 아니다.** 같은 기관이 두 파이프라인에서 다른 역할을
  한다: **ACP** 는 그 소스의 *본문이 그 자체로 학습 지문*일 때(NOAA 기후 해설·VOA 기사),
  **재저작** 은 그 소스가 *사건의 사실만 줄 때*(USGS 지진 속보·OWID 지표 발표).
  갈림길 기준은 하나 — **본문을 그대로 가져와 발행할 수 있으면 ACP 로 간다.** 재저작은 본문을
  못 가져올 때 쓰는 우회로지 더 나은 경로가 아니다(PD 기관 글을 재저작하는 것은 그냥 가져오면
  될 것에 LLM 비용과 게이트를 쓰는 일이다).
- **I17 서가 중복** (신규 게이트) — 재저작 초안을 **우리가 이미 발행한 글**과 대조. I13 은
  외부 소스와만 대조하므로 ACP 가 먼저 발행한 같은 사건을 잡지 못했다. 위반의 성격이 달라
  (외부=저작권 위험 / 서가=학습자가 같은 글을 두 번 읽음) 판정문과 처방을 따로 쓴다.
  ⚠ **우리 글을 `sources` 에 넣어 I13 으로 대신 잡으면 안 된다** — 별도 입력(`shelf`)으로 받는다.
- **회귀가 제 가설을 반증했다** — "서가를 sources 에 섞으면 I12 가 부풀려진다" 고 썼는데,
  I12 는 소스 배열이 아니라 **attestation** 을 센다. 실제 위험은 **우리 글에 확인 표시를 다는
  것**(④ 원장의 작업 실수)이었고, 테스트를 그 경로로 다시 썼다. 덤으로 확인된 것:
  ACP 가 통신사 원고를 그대로 실은 글은 **지문 접기가 같은 계통으로 묶어 준다** — 위험한 것은
  문면이 다른 우리 글이다.
- **URL 가드** — 취재 시작 시 `library_articles.source_url` 을 조회해 ACP 가 이미 가져간 기사를
  제외한다. 그 결과 독립 계통이 2 아래면 빈 묶음을 남기지 않고 되돌린다.
- **화면에 답을 둔다** — ① 소스 표 옆에 겹침 규칙·판정 기준·두 방어장치를 적었다. 표만 보고
  "겹치는데?" 를 묻게 두지 않는다. 도움말 3곳(소스·발견·원장)도 같은 커밋에서 갱신.
- 패키지 **263** · admin 회귀 **74** · web `tsc` 통과.

### ACP §20 — 피드 자동 발견 + 7면 전부 구현 (v06.39)

**피드 주소를 사람이 찾아 넣게 한 것이 잘못된 설계였다.** 발행사 사이트를 뒤져 RSS 링크를
찾아오는 것은 운영자의 일이 아니고, 주소가 바뀌면 조용히 0건이 되는데 왜인지도 알 수 없다.

- **`compose/feed-discovery.ts`** — 발행사만 고르면 찾아 준다. ① 표준 autodiscovery
  (`<link rel="alternate" type="application/rss+xml">`)를 먼저 읽고 ② **알림이 없을 때만**
  관습 경로(/rss·/feed…)를 최소로 두드린다. 찾은 주소는 **실제로 열어 항목이 있는 것만**
  목록에 올린다("아마 될 것"을 올리지 않는다). robots·간격은 기존 게이트가 그대로 지키고,
  robots 를 못 가져오면 홈페이지도 열지 않는다. 발행사가 알린 것과 우리가 추측한 것을
  화면에서 구분해 표시 — 후자는 예고 없이 사라질 수 있다.
- **③ 발견** — 활성 피드를 훑어 사건 묶음 제안. 본문을 읽지 않는다. 피드별 robots 상태·
  발견 건수·건너뛴 사유를 표에 기록해 **조용한 0건과 차단을 구별**할 수 있게 한다.
  **취재 시작에서 처음으로 본문을 읽고** 지문만 남긴다 — 독립 계통 2건을 못 채우면 빈 묶음을
  남기지 않고 되돌린다.
- **④ 원장** — 사실 카드 + 확인 표시(등장 순서). 독립 계통 2 미만인 카드를 붉게 표시.
  이미 표시한 소스는 선택지에서 빠진다.
- **⑥ 가공** — 지문별 활동 상태. 음성이 없으면 dictation·shadowing 이 잠긴 것으로 보인다.
- **⑦ 발행** — 게이트 5종 판정 + 본문 정보. 판정이 없거나·낡았거나(본문 해시 불일치)·
  critical FAIL 이면 **발행 버튼이 잠긴다**. 게이트 재검사는 DB 트리거가 최종 권위라
  화면에서 다시 검사하지 않는다.
- **렌더 스모크 21** — 7면 × (빈 데이터 / 채워진 데이터). 이 화면은 대부분 비어 있는 상태로
  시작해서, 빈 배열 접근 실수는 **데이터가 생긴 뒤에야** 터진다. 빈 상태에서 "다음에 무엇을
  하라"고 말하는지도 함께 단언한다.
- web `tsc` 통과 · admin 회귀 **73** · 패키지 **255**.

### ACP §20 — ② 피드 · ⑤ 작성 화면 구현 (v06.39)

- **② 피드** — 발행사 피드 등록·활성화·삭제. 등록은 **항상 꺼진 채로** 들어온다(등록과 수집
  시작은 다른 결정이고, 주소를 붙여 넣자마자 외부 요청이 나가면 되돌릴 수 없다).
  검증: 승인된 소스만 선택 가능 · https 전용 · **호스트가 그 발행사 도메인이어야 한다**
  (다른 호스트를 등록하면 그 소스의 접근 정책·취재 계통 표시가 거짓이 된다).
- **⑤ 작성** — 취재 묶음 개설 + 발주 큐. **작성 버튼이 없다** — 원문 작성은 Claude Code
  드레인이 하고 화면은 큐를 만들 뿐이다. 대기 발주는 취소, 진행 중 발주는 회수(죽은 세션의
  30분 대기를 건너뛸 때)가 가능하고, **진행 중 삭제는 막는다**(드레인이 이미 비용을 쓰고 있다).
- **검증을 화면에 다시 적지 않았다** — `buildJobSpec` 이 유형·레벨·글유형·어휘기능 정합을
  이미 판정하므로 서버 액션이 그것을 그대로 쓴다. 길이·문장길이·작성 지시·활동도 레지스트리가
  채운다 → 유형 정의를 고치면 이후 발주가 자동으로 따라온다.
- 권한은 RLS(`is_admin_or_curator`)가 본다 — 요청 스코프 클라이언트를 써서 서비스 키로
  우회하지 않는다.
- web `tsc --noEmit` 통과 · admin 회귀 43 · 패키지 240.

### ACP §20 — Admin 메뉴 신설 + drain 절차 문서화 (v06.39)

- **`/admin/compose` 신설** — 사이드바 "사용자 & 콘텐츠" 그룹에 `Compose Pipeline`(PenLine).
  ACP(`/admin/articles`)와 나눈 이유: 두 파이프라인은 소스를 다루는 방식이 **정반대**다 —
  ACP 는 남의 본문을 가져오고(라이선스가 1차 기준), Compose 는 사실만 가져와 우리가 쓴다
  (출처 독립성이 기준). 한 화면에 섞으면 "이 소스 쓸 수 있나" 라는 같은 질문에 다른 답이 나온다.
- **7면 골격 + ① 소스 실구현** — 유형별 발주 가능 여부·V밴드·길이·주제·소스·활동을
  레지스트리 계산으로 표시(DB 없이도 뜬다). 미구현 면은 빈 화면 대신 **무엇이 준비돼 있는지**를
  말한다. 현황 타일은 표가 **없는 것**(마이그레이션 미적용)을 `0` 이 아니라 `—` 로 구별한다.
- **`lib/admin/help/compose.ts`** — 7면 도움말 + **drain 절차 8단계**. 원문 작성은 화면 버튼이
  아니라 Claude Code 배치라서, 절차를 모르면 큐가 영원히 안 빈다. `recovery` 에 재실행 안전
  근거를 명시: `UNIQUE(batch,track,level)` 로 중복 아티클 없음 · 30분 stale claim 자동 회수 ·
  본문 수정 시 게이트 해시 불일치로 발행이 막힘.
- **탭 라벨 드리프트 잠금** — 라벨을 `lib/admin/compose-tabs.ts` 단일 출처로 빼고 회귀 10건 추가.
  AdminScreenHelp 는 탭을 **라벨 문자열로** 조회하므로, 라벨만 바꾸면 타입·런타임 에러 없이
  **도움말만 조용히 사라진다**(CLAUDE.md §3 명문화 항목). 테스트가 드레인의 "재실행 안전"·
  "30분 회수"·"본문 주입 금지" 문구까지 못 박는다.

### ACP §20 — 학습 유형이 파이프라인을 가른다 + Claude Code drain 큐 (v06.39)

발주서가 `register × CEFR` 두 축이던 것을 **학습 유형(Track × Skill × V밴드)** 1급 축으로 올렸다.
그 두 축은 *서가의 빈 칸*만 말하고 *학습자가 무엇을 하러 왔는지*는 말하지 않는다 — 수능 준비
학습자와 회화 학습자에게 같은 글을 주면 둘 다에게 조금씩 맞지 않는 글이 된다.

- **축 값은 VRL 실측** (2026-08-17) — Track 6(`shared_dictionary.track_levels`) ·
  Skill 5(`skill_type`) · Domain 8(`domain_levels`). 새 분류를 만들지 않았다.
- **`compose/learning-types.ts`** — 유형이 정해지면 나머지가 따라 정해진다:
  ① 어느 소스에서 사실을 모을지(`sourcesForType`) ② 어떻게 쓸지(길이·문장길이·작성 지시)
  ③ 무엇을 붙일지(활동 세트). 유형별로 **실제로 다른 것이 나오는지**를 회귀가 강제한다 —
  수능 130–190어 vs 학술 250–450어 · 수능만 order/insert(=수능 문항 유형) ·
  회화만 shadowing+discussion · 회화 idiom / 비즈니스 collocation / 수능 polysemy.
- **`literary` 는 재저작 대상이 아니다**(`composable: false`) — 사실에는 저작권이 없지만
  **서사는 사실이 아니다**. 사실 원장에서 소설을 지어내면 학습 자료가 아니라 창작이고,
  그 자리는 LCP(PD 도서)가 이미 채우고 있다. DB CHECK 에서도 빠져 있다.
- **밴드 밖 레벨은 조용히 보정하지 않고 거부** — 보정하면 "수능 유형인데 V2" 발주가 성공한
  것처럼 보이고 산출물이 어디에도 안 맞는다.
- **마이그레이션** `20260817064000_acp_compose_jobs` — 원문 작성은 앱의 LLM 호출이 아니라
  **Claude Code 배치 drain**(ScriptQuiz 1,292문항과 같은 경로). `acp_claim_compose_jobs()` 가
  `FOR UPDATE SKIP LOCKED` 로 병렬 세션 충돌을 막고 30분 stale claim 을 회수한다.
  `UNIQUE(batch_id, track, target_v_level)` 로 **drain 재실행이 안전**하다.
  실측 검증: 세션 A claim 1건 → 세션 B(limit 5)가 A 의 것을 집지 않고 남은 1건만 가져감.
- **회귀** learning-types 24 · 패키지 **240 통과**.

### ACP §20 — 6축 재설계 + 가공 축 착수 (v06.39)

5개 플랫폼(Engoo·Newsela·News-O-Matic·Breaking News English·CommonLit)을 6축
(소스→획득→처리→분류→가공→결과물)으로 대조. **우리 설계는 앞 3축에 쏠려 있고 뒤 3축이 비어
있었다** — 그런데 교사·학습자가 손에 쥐는 것은 뒤 3축이다.

- **축별 결정** — ①소스 유지(재저작+PD) · ②획득에 **흥미 축 추가**(지금은 커버리지 빈 칸이
  유일 기준이라 "빈 칸은 채웠는데 아무도 안 읽는 글"이 쌓인다 · 사람이 고른다) ·
  ③처리에 **사람 검수 1단계**(게이트는 법적 안전을 보지 교육적 적합성은 안 본다 · NOM 이중검수
  대응 · 자동 발행 경로 만들지 않음) · ④분류는 **새 체계 만들지 않고 VRL 4축+topic 을 발주서에
  연결**(Engoo 의 레벨↔시험점수 = 우리의 V-Level↔CSAT 등급) · ⑤가공 착수 · ⑥**발행 단위를
  batch=레슨 팩으로**(교사 경로가 유일 성립 경로라면 '아티클 1편'은 틀린 단위).
- **Newsela 의 "MAX=원문"은 성립하지 않는다** — 원문을 저장하지 않는 것이 이 파이프라인의
  전제다. 대신 **MAX = 같은 사건의 PD/CC 원문(NOAA·USGS·NASA)으로 나가는 링크** — 사다리 끝이
  우리 안이 아니라 바깥의 실물이라 학습적으로도 낫다.
- **`compose/activities.ts`** — 활동 10종 레지스트리. **기계 8 / LLM 2**(이해문항·토론질문).
  지문 1편의 LLM 비용은 **작성 1회에 몰리고 활동 재생성은 0원·멱등**이다.
  `buildGapFill`(한 문장 1개 · 첫 문장 제외 · 같은 단어 1회 · 초과분은 `unmatched` 로 반환) +
  `buildSpellingItems`. ⚠ 문장 순서·삽입은 `dcp/generate-items.ts` 가 이미 결정론으로 만들어
  **중복 구현하지 않았다**. 오디오가 있어야 열리는 dictation·shadowing 은 재저작만 여는 자리.
- **Admin 재설계 초안** — `/admin/compose` 편집국 7면(소스·피드·발견·원장·작성·가공·발행).
  기존 사이드바 `* Pipeline` 관례를 따르고, `lib/admin/help/compose.ts` 를 같은 커밋에 넣는다.
- **회귀** activities 20 · 패키지 **216 통과**.
  설계: <https://claude.ai/code/artifact/99309d1a-2898-4638-8645-f2a8c4b3a096>

### ACP §20 — 사건 묶기 + 수집 오케스트레이션 + 상업 뉴스 승인 (v06.39)

- **`compose/cluster.ts`** — 발행사별 후보를 같은 사건으로 묶는다(헤드라인 Dice ≥0.4 + 공통
  내용어 ≥2 + 72시간 창). ⚠ 이 단계의 실패 모드는 덜 묶는 게 아니라 **잘못 묶는 것**이다 —
  다른 사건이 붙으면 한 곳에서만 나온 사실이 "독립 2계통" 으로 보인다. 그래서 보수적으로 묶고,
  **같은 계통(통신사) 안에서는 아예 묶지 않는다**(묶어도 독립 출처가 안 늘고 판단만 흐린다).
  묶음은 **제안이지 판정이 아니다** — 실제 I12 는 사실 카드별 attestation 이 정한다.
- **`compose/collect.ts`** — 피드 N개 → robots → 발견 → 묶기 → 취재 제안. **이 단계는 본문을
  읽지 않는다**(테스트가 요청 URL 목록으로 단언). 후보 100건 중 3건만 취재한다면 97건은
  읽지 않아야 한다 — 규율을 지켰어도 다 받아 보는 건 예의가 아니다. 실패는 전부 `skipped` 에
  사유와 함께 남는다(조용한 0건은 "사건 없음"과 "전부 차단됨"을 구별 못 하게 만든다).
- **상업 뉴스 승인 반영** — `termsReviewed: true` 는 **운영자가 2026-08-17 에 승인했다는
  기록**이지 코드가 약관을 판정했다는 뜻이 아니다(주석·테스트가 이 구분을 못 박는다).
  범용 수집기가 생겨 `wiring` 도 실제로 `in-repo` 가 됐다. ⚠ 외부 뉴스 도메인이 이 환경에서
  차단돼 **robots 사전 확인은 하지 못했다** — 대신 매 수집마다 `CrawlGate` 가 검사하고
  못 가져오면 그 호스트를 통째로 건너뛴다.
- **발주 가능 주제 5 → 9** — people-education · sport · work-and-business ×2 가 열렸다.
  6칸은 여전히 막혀 있고 회귀가 그것도 못 박는다.
- **마이그레이션** `20260817061500_acp_compose_feeds` — 피드 등록부. 주소는 코드가 아니라
  운영자가 넣는다(`enabled` 기본 false — 등록만으로 수집이 시작되지 않는다). robots 결과·
  마지막 수집 결과를 함께 기록해 운영 화면이 무엇을 긁고 있는지 보여 준다.
- **회귀** cluster 14 + collect 10 · 패키지 **196 통과**.

### ACP §20 — 상업 뉴스 수집기 + `original` 트랙 배선 (v06.39)

- **`compose/news-feed.ts`** — 발견(피드→후보)과 읽기(후보→지문+추출) 둘만 한다. 본문은 함수
  밖으로 나가지 않는다. 약관 확인 전에는 **네트워크 접촉 0**(테스트가 단언).
- **403 을 우회하지 않는다** — 브라우저 UA 로 바꿔 다시 시도하는 것은 규율을 지키는 척하며
  어기는 것이다. 재시도 없이 "발행사를 목록에서 뺄 근거"로 돌려준다. (VOA 어댑터의 UA 우회는
  PD 소스라 성립한 판단이고 이쪽엔 쓰지 않는다.) robots 5xx·네트워크 실패도 차단 — 404 만 허용.
- **48시간 미달 기사는 버리지 않고 `holding`** — 버리면 다음 실행에서 다시 발견해야 한다.
  발행 시각 없는 항목은 I15 를 검증할 수 없어 제외.
- **`original` 트랙 배선** (직전 턴 미해결) — 없으면 발행은 성공하고 학습자 화면엔 안 뜬다
  (v06.66 에 5소스 8편이 그렇게 증발했다). `SourceKey`·`ArticleSource`·`SOURCE_SPECS`·
  `SOURCE_POLICIES`·`SOURCE_REGISTER_DEFAULT` + `source-map` news 트랙 + `source-meta`
  (**Vocaflow Newsroom** — 우리가 쓴 글임을 숨기지 않는다) + `source-guide`.
  `SOURCE_RANKINGS_BY_LEVEL` 에는 **넣지 않는다** — 대량 GET 화면의 선택지가 아니다.
- **회귀** news-feed 16 + 정책 표 +1 · 패키지 **172 통과** · web `tsc --noEmit` 통과.

### ACP §20 — 상업 뉴스를 사실 출처로 (초판 제외 판단 정정 · v06.39)

초판 레지스트리는 상업 뉴스를 **약관 위험을 이유로 통째로 제외**했다. 틀린 판단이었다 —
모델 4 의 원형(Breaking News English · News in Levels)이 하는 일이 바로 여러 상업 뉴스를 읽고
사실만 뽑아 새로 쓰는 것이고, 그걸 빼면 남는 건 기관 발표 요약뿐이다. 게다가 직전 턴에 스스로
지목한 병목(교차 확인원이 VOA 한 곳)을 푸는 것이 정확히 이 층이었다.

- **약관·robots 는 배제 사유가 아니라 설계할 층** — 저작권과 다른 축이며 절차로 지킬 수 있다.
  `compose/access.ts` 가 강제: ① robots.txt 실제 파싱(그룹·와일드카드·`$`·최장매치·Crawl-delay)
  ② 호스트별 요청 간격 ③ **본문 비보관을 함수 시그니처로** — `readForFacts()` 는 지문과 추출
  결과만 돌려주고 본문에 접근할 방법을 주지 않는다. **기본값은 차단**: robots 미확인·가져오기
  실패는 허용으로 해석하지 않는다. UA 로 우리를 밝힌다(익명 위장 금지).
- **독립성을 발행사가 아니라 취재 계통(`wire`)으로 센다** — 통신사 원고를 받아 쓰는 매체를
  여럿 넣어도 독립 출처는 늘지 않는다. 지문 포함도 접기가 2차 방어선.
- **채택 5곳** — reuters·ap(계통이 다른 두 통신사) · bbc·dw(공영, 자체 취재) ·
  koreaherald(국내 주제의 다른 각도). 인지도가 아니라 **계통 다양성**으로 골랐다.
  피드 주소는 코드에 박지 않는다 — 배선 시점에 확인. `termsReviewed=false` 인 동안 수집이 막힌다
  (코드가 대신 판단할 수 없는 유일한 항목이라 사람이 확인하고 올린다).
- **효과** 발주 가능 주제 **5 → 9**. 열리는 칸: people-education · sport ·
  work-and-business-business · work-and-business-working-life — TED(재사용 불가)로만 덮여 있던
  사람·직업 주제다. 그래도 **6칸은 여전히 막힌다**(전문 연구·지질·우주 등) — 회귀가 그것도 못 박는다.
- **마이그레이션** `20260817055500_acp_compose_source_access_record` — `access_basis` ·
  `robots_checked_at` · `wire` + `chk_compose_source_robots`(page-fetch 는 robots 확인 기록 없으면
  INSERT 자체가 막힘) + `acp_batch_independent_lines()`. 지켰다는 말이 아니라 지킨 기록을 남긴다.
- **회귀** `access.test.ts` 17 + `sources.test.ts` 17 · 패키지 **155 통과**.

### ACP §20 — 취재 계통 설계 + 스키마 적용 (v06.39)

마이그레이션 2건 적용 (`20260817052824_acp_compose_foundation` · `20260817053009_acp_compose_batch_regroup`).

- **닫힌 주제 절반이 근거** — `topic_corpus_sources` 활성 19 카테고리 중 **11개가 재사용 불가
  소스(TED · CC BY-NC-ND · `text_reusable=false`)로만 덮여 있다**: health-* · people-education ·
  people-feelings · people-personal-qualities · work-and-business-* · sport ·
  the-natural-world-the-environment 등. 나머지 8개는 이미 PD 기관 소스로 덮인, 서가가 포화된 쪽이다.
  **재저작이 여는 것은 같은 주제 한 겹이 아니라 수집으로 도달 불가한 주제 절반**이다.
- **소스 판정 축 교체** (`compose/sources.ts`) — 사실에는 저작권이 없으므로 라이선스가 기준에서
  빠지고 **이용약관·robots(`termsRisk`)** 가 들어온다. 두 축을 한 칸에 적으면 반드시 혼동된다.
  4축 = 1차성 · 독립성 · 접근성 · 주제.
- **병목은 1차원이 아니라 교차원** — 1차 사실원 6곳(usgs·noaa·nasa·nih·elife·owid) vs 교차
  확인원 **VOA 1곳**. 발주 가능 주제가 5개뿐이고 전부 교차원이 `['voa']` 다. 지리·우주·정신건강·
  생물·경제는 1차원이 있어도 막혀 있다. **다음 소스는 또 다른 기관이 아니라 두 번째 교차원** —
  가장 싼 수는 Wikinews 배선 복구(어댑터 존재 · CC-BY · 실적 0행).
  Wikipedia 는 `tier='background'` 로 **독립 출처에서 제외**(백과는 보도를 인용하므로 독립 취재가 아니다).
  TED 제외 사유는 라이선스가 아니라 **강연 1건 = 단일 출처**라 I12 를 못 넘는 것.
- **원장을 batch 소속으로 재구성** — 사실 원장 1개 → 난이도별 아티클 N개(A2판·B1판).
  수집이 가장 비싼 단계인데 그 비용을 여러 판이 나눠 쓴다. 커버리지 매트릭스에서 한 칸이 아니라
  **한 열**을 채우게 된다. `article_compose_batches` + `chk_original_needs_batch`.
- **재저작만 오디오를 붙일 수 있다** — 발행 160편 중 오디오 30편 전량 VOA(정지 아카이브).
  재저작물은 우리 저작이라 Piper TTS(`lib/echo/piper-tts.ts`, EchoMatch용 기배선) 부착이 자유롭고,
  지문 1편이 읽기·단어장에서 멈추지 않고 **듣기·EchoMatch·Dictation** 까지 연다.
- **회귀** `compose/sources.test.ts` 11 (발주 가능 5주제 스냅샷 · 교차원 병목 단언 포함) ·
  compose 37 · 패키지 132 통과.
- ⚠ **미해결** — `source-map.ts`/`source-meta.ts` 에 `original` 미등록. 첫 발행 전에 배선하지 않으면
  발행은 성공하고 **학습자 트랙에는 안 뜬다**(v06.66 에서 5소스 8편이 같은 방식으로 증발했다).
  설계: <https://claude.ai/code/artifact/22a64cf7-48bf-4897-98c9-795bf253afe0>

### ACP §20 — 사실 재저작 게이트 기본 설계 (v06.39)

빈 칸(register×CEFR)을 발주로 받아 사실 기반 지문을 자체 저작하는 경로. 법리 검토를
**측정 가능한 불변식**으로 옮긴 것이 설계의 본체다 — "조심하자"는 검수자가 피곤한 날 무너진다.

- **설계 축 3개**
  1. **소스 본문 미보관** — 7-gram 단방향 지문만 남긴다. 해시에서 문장은 복원되지 않지만
     "이 표현이 원문에 있었나"는 정확히 답한다. 복제물이 아니라 **대조 계측기**.
  2. **구조 추종은 n-gram 으로 원리적으로 못 잡는다** — Wainwright/Comline 이 잡아낸 것은
     단어가 아니라 사실의 서술 순서다. 수집 시점에 사실별 `ordinal`(그 소스 안 등장 순서)을
     적어 두고 Spearman 순위상관을 잰다. **안 적으면 나중에 복원 불가**(본문을 안 남기므로).
  3. **같은 지문 기계가 통신사 재게재도 접는다** — 독립 취재본끼리는 7-gram 을 사실상
     공유하지 않으므로, 포함도 ≥0.25 면 같은 원고로 보고 독립 출처 1로 계산.
- **게이트 5종** (`compose/gates.ts`) — I12 출처 독립성(독립 2곳) · I13 표현 독립성(10어절 연속
  일치 차단, 7–9어절 검수자 판단) · I14 구조 독립성(|ρ|≥0.8 차단, 공통 5건 미만 미판정) ·
  I15 발행 지연(48h · 시각 파손 시 차단) · I16 인용(공개 발언 25어절 이하).
  독점 인터뷰 인용은 정의상 단일 출처라 **I12 가 이미 배제**한다.
- **구현** — `packages/library-pipeline/src/compose/{fingerprint,gates}.ts` + 회귀 26
  (판례별 1건씩 · **I13 은 통과하는데 I14 만 떨어지는 케이스** 포함). 패키지 전체 121 통과.
- **스키마 미적용** — `supabase/migrations/_pending_20260817_acp_compose_foundation.sql`
  (source CHECK += `original` · `composed_spec` · 원장 3테이블 · 게이트 결과 + 발행 강제 트리거
  `trg_la_require_compose_gates` · RLS). **라이선스 enum 확장 불필요** —
  `'CC0-1.0 (Vocaflow Original)'` 로 적으면 DB·TS 분류기가 양쪽 다 `cc0` → `copyright_safe_in_kr=true`.
  설계: <https://claude.ai/code/artifact/676e9571-b05c-468c-ad52-c9f34a97541b>

### ACP 정책층이 NC 라이선스를 못 읽던 것 (v06.39)

DB `acp_classify_license` 는 NC 를 첫 분기에서 `restricted` 로 거르는데, TS
`licenseClassOf`(`_curation-spec.ts`) 에는 NC 분기가 없었다. `CC-BY-NC-SA-4.0` 이 `SA` 를
포함하므로 **`cc_by_sa` 로 판정** → `SourcePolicy.derivation='full'` → **관리 화면은 "단어세트
발행 가능" 이라 말하고 DB 는 차단**하는, 정책층과 권위층이 갈라진 상태.

- **영향 실측 = 0** — `licenseClassOf` 는 `SOURCE_SPECS[].license` 상수만 받고 활성 14소스에
  NC 가 없다(DB `license_class='restricted'` 행도 0). **CommonLit·OpenStax NC 교재를 붙이는
  순간 무장**되는 함정이었다.
- **수정** — NC 분기를 SA/BY 보다 **먼저** (DB 와 동일 순서). 회귀 5건 + 불변식
  "활성 소스에 `restricted` 등급이 없다" 추가 → NC 소스를 `SOURCE_SPECS` 에 넣으면 배포 전 실패.
  `source-policy.test.ts` 35 통과.
- **동반 검토** — ACP 소스 확장 3모델 대조 + 사실 재저작(모델 4) 파이프라인 6단계 설계.
  실측: 발행 160편 · register×CEFR **30칸 중 17칸 0편** · A1·C2 전무 · `wikinews` 0행이라
  **학습자 시사 트랙이 렌더되지 않음**(`source-map.ts` news→wikinews 단독 매핑).
  리포트: <https://claude.ai/code/artifact/58629948-da57-48bd-a78d-78c7fced85b5>

### F6 을 해소하려다 F6 이 틀렸다는 걸 알았다 (v06.45 · 진단 문서 수정)

`ready` 303권을 발행해 F6(발행률 3.2%)을 해소하려 했다. **발행하기 전에 그게 무엇인지 쟀다.**

- **게이트는 막고 있지 않았다** — `run_content_quality_gates('book', …)` 를 표본에 직접 돌리니
  critical 전항목 PASS. 303권 전부 저작권 통과 · V-Level 301 · 챕터·단어 303.
  파이프라인이 끊긴 게 아니라 **아무도 발행을 누르지 않았다.** 기술 문제가 아니었다
- **그런데 발행하면 F3 이 나빠진다** — `standard_ebooks` 285권(평균 V7.7 · **106,657 단어**) +
  `storyweaver` 18권(V2.6 · 361 단어). 목표 대역 245권의 평균이 75,255 단어 · 30.6 챕터라
  고2 가 끝낼 분량이 아니고, 3만 단어 이하로 좁힌 43권은
  **소포클레스·셰익스피어·시집**이다
- **결정타** — `csat_stage_catalog` 등재 도서 13건 중 **논설·설명문 0 · 서사 12**.
  도서 코퍼스 전체가 서사다. 수능은 사실상 논설·설명문 전용이므로
  **책을 더 발행해도 그 축은 1권도 안 늘어난다**
- **→ F6 재정의** — `published ≥ 60` 은 소포클레스 47권을 더 발행하면 달성된다.
  카탈로그만 두꺼워지고 F3 은 그대로다. 그건 진단 §0 이 경고하는 **"공급망 비대"** 를
  지표가 부추기는 꼴이라, 숫자 뒤에 **문종 조건**을 붙였다:
  *published ≥ 60 이면서 그중 절반 이상이 V6–8 대역의 논설·설명문*
- **일반 규칙 신설** (`PLATFORM_AUDIT.md` §8-1) — 해소 조건에 숫자만 있는 항목을 볼 때마다
  **"이 숫자를 가장 싸게 달성하는 방법이 제품을 낫게 하는가?"** 를 묻는다. 아니면 조건이 틀린 것이다

⚠️ **아무것도 발행하지 않았다.** 303권 발행은 학습자 카탈로그를 13 → 300 으로 바꾸고
발행 트리거가 단어장 285세트를 생성하는 큰 조작이라, 방향이 확인되기 전에는 사용자 결정 사안이다.

### 학급이 이제 배달한다 — F8 해소 (v06.44 · 마이그레이션 `20260817130204`)

승인 후 적용. 학급이 명부에서 **전달 경로**가 됐다.

- **마이그레이션** — `class_assignments`(과제) + `class_assignment_progress`(수행).
  기존 `is_class_teacher` · `is_class_member` SECURITY DEFINER 헬퍼를 재사용해 정책 재귀를 피한다
- **설계 제약이 곧 스키마다**:
  · **지문 컬럼을 두지 않는다** — 교사가 넣는 건 대체로 검정교과서·모의고사다. 저장하면
    우리가 복제·배포 주체가 된다
  · **CHECK 가 우회를 막는다** — "단어 목록" 이라는 이름만으로는 아무것도 못 막는다.
    개수 200 · 표면형 64자 · **공백 금지**(구·문장 조각 차단) · 뜻 200자.
    RLS 가 아니라 CHECK 라 **service_role 로도 뚫리지 않는다**
  · **진도는 학생이 자기 행을 쓴다** — 교사가 학생 `vocabularies` 를 읽게 만들지 않았다
  · **`opened_at` / `collected_at` 분리** — "봤는데 안 했다" 가 교사에게 가장 쓸모 있는 신호다
- **적용 전에 설계 결함을 잡았다** — 처음 SQL 은 CHECK 안에 서브쿼리를 넣었고,
  Postgres 는 이를 거부한다(`cannot use subquery in check constraint`, 임시 객체로 실측).
  **그대로 적용했으면 승인 직후 실패했을 것이다.** IMMUTABLE 함수로 감쌌다
- **화면 — 새 라우트 0** (진단 F5): 교사는 `/text/new` 추출 결과에서 "우리 반에 보내기",
  교사·학생 모두 `/teacher` 에서 보낸 것/받은 것을 본다. 학급은 두 역할이 공유하는 표면이라
  학생용 라우트를 새로 만들면 학습자 표면이 22 → 23 이 된다
- **패널이 스스로 학급을 불러온다** — 호출부마다 배선하면 한 곳이 빠지는 순간 그 화면에서만
  조용히 사라진다(그리고 아무도 눈치채지 못한다)
- **보내는 것 = 화면에서 고른 것** — 선택된 단어만, 원문 표면형이 아니라 **표제어**로.
  학생이 배울 형태는 표제어다
- **회귀 11 (실 DB RLS 공격)** — anon 차단 · 외부인 읽기/쓰기 차단 · `created_by` 사칭 차단 ·
  남의 과제 수정/삭제 차단 · 남의 학급 진도 기록 차단 · CHECK 가 지문/문단 차단, 정상 목록 통과

⚠️ **기구가 생긴 것이지 쓰이는 것은 아니다.** 두 테이블 모두 0행 — 실사용은 교사 검증(F1) 몫이다.

### 학급은 명부일 뿐이었다 — 그래서 다리 대신 출구를 냈다 (v06.43)

`/fit` 결과에서 교사를 `/teacher`(학급 개설)로 잇기 전에 **학급이 무엇을 하는지** 확인했다.

- **실측: `class_members` 가 코드에서 테스트 파일에만 등장한다.** RPC 도 `is_class_member` ·
  `is_class_teacher` · `join_class_by_code` — 권한 헬퍼와 가입뿐이다. `classes` 컬럼은
  `id · teacher_id · name · invite_code` 가 전부고, 두 테이블 모두 **0행**이다.
  → **학급을 만들고 학생 30명을 초대해도 학생에게 전달되는 것이 없다.**
  여기로 동선을 이었으면 교사를 빈 방으로 안내하는 셈이었다. 잇지 않았다
- **대신 오늘 쓸 수 있는 출구를 냈다** — 어려운 단어를 **`단어⇥뜻`** 으로 복사.
  탭 구분은 클래스카드·퀴즐렛·엑셀이 공통으로 받는 import 형식이라, **교사가 이미 쓰는
  도구에 그대로 물린다.** 우리가 아직 배달하지 못하는 구간을 그들의 도구가 대신 잇는다 —
  경쟁 도구와 싸우지 않고 물려주는 쪽이 지금 우리 위치에 정직하다
- **뜻은 가장 어려운 단어에만 붙인다** — 레벨 맵에 뜻까지 담으면 200 KB → 수 MB 가 되는데
  화면이 보여주는 건 상위 24 개뿐이다. 그때 한 번 조회하는 편이 싸다(`loadMeanings`).
  `lemma` 20% NULL 이라 `word` 로 한 번 더 훑는다
- **구분자 방어** — 뜻에 탭·줄바꿈이 들어가면 붙여넣는 쪽에서 **열과 행이 밀려 단어와 뜻이
  어긋난 채 학생에게 나간다**. 구분자로 쓰는 문자는 값에서 공백으로 접는다
- **실측 검증** — 24행 전부 탭 구분 · 뜻 누락 0 · 지문 문장 미포함.
  e2e 가 각 행이 정확히 두 칸인지, 양쪽이 비지 않았는지 검사한다
- **회귀 e2e 8/8**

🔴 **남은 결정**: 학급이 무언가를 배달하려면(과제·단어장 배포·진도 열람) 새 테이블과 RLS 가
필요하다 — 마이그레이션 승인 사안이라 이번 세션에서는 설계만 남기고 적용하지 않았다.

### 교사 퍼널 계측 — 지금 교사가 와도 한 명도 못 셌다 (v06.42)

교사 검증(F1)을 하자고 해 놓고 보니, **왔는지 셀 방법이 없었다.**
`.env.local` 에 `NEXT_PUBLIC_POSTHOG_KEY`·`_HOST` 가 있는데 **패키지도 코드도 없었다** —
계측 의도만 있고 완성되지 않은 상태로 남아 있었다.

- **`posthog-js` 1.417.1 추가 · 공개 퍼널 5단계만** — 진입 → 분석 → 공유 → **공유링크 유입** →
  가입 클릭. 마지막 두 개가 핵심이다: `fit_shared` 대비 `fit_share_opened` 가 곧
  **교사 채널의 확산 계수**이고, 그게 0 이면 CAC 0 경로는 작동하지 않는 것이다
- **"지문은 저장하지 않습니다" 를 계측에도 강제** — 이 약속은 우리 DB 뿐 아니라 제3자 도구에도
  적용된다. 그런데 보통의 분석 코드는 `capture('x', {아무거나})` 라 나중에 누구든 지문을 넣을 수 있다.
  → 이벤트·속성을 **닫힌 목록**으로 못 박고 **자유 문자열을 타입에서 없앴다**.
  런타임 `isSafeProps` 가 마지막 방어선(24자 초과·공백 포함 문자열·중첩 객체 전부 차단)
- **위험한 기본값 세 개를 껐다** — `autocapture`(클릭 요소의 DOM 텍스트를 담는다) ·
  `session_recording`(화면 녹화) · `capture_pageview`(공유 URL 에 결과 페이로드가 들어 있다).
  켜져 있었으면 지문이 그대로 나갈 수 있었다
- **동적 import** — 정적으로 넣으면 이 스크립트가 모든 공개 화면 첫 로드에 들어간다.
  가입 전 첫인상이 걸린 화면이라 그 무게를 기본값으로 낼 이유가 없다
- **`/privacy` 에 전용 항목 신설** — 무엇을 보내고(사건 5종 + 학년·길이구간·해석률)
  무엇을 안 보내는지(지문과 그 일부·추출 문장·식별 정보) 명시. 제3자 위탁 목록에도 추가
- **실측으로 물린 함정** — 클라이언트에서 `process.env['NEXT_PUBLIC_X']` **대괄호 표기**는
  Next 가 빌드 때 치환하지 않는다. 브라우저에서 항상 `undefined` 라 **화면은 멀쩡한데 계측만
  영원히 0** 이 된다. 점 표기로 고쳤다(요청 0건 → 3건으로 확인)
- **검증** — 더미 키로 실제 전송 경로 확인: 요청 3건 발생 · 지문어 5종 **전부 미포함**.
  e2e 가 **모든 외부 요청**의 URL·본문을 훑어 지문어가 없는지 검사한다(분석 도구만 보지 않는다 —
  어디로 새는지 미리 정해 두면 다른 곳으로 새는 걸 못 잡는다)
- **회귀 29 + e2e 7** — 계측 안전장치 29(지문 조각 5종 차단 · 중첩 우회 차단 · 버킷 경계) ·
  e2e 에 네트워크 유출 검사 추가

🔴 **키가 빈 값이라 아직 아무것도 집계되지 않는다.** PostHog 프로젝트를 만들고
`.env.local` 을 채워야 퍼널이 켜진다 (`docs/STACK.md` §계측).

### 검색·공유 인프라 — 문이 실제로는 하나였다 (v06.41)

유입을 늘리기 전에 실측했더니 문이 거의 닫혀 있었다.

| 항목 | 실측(2026-08-17) | 조치 |
|---|---|---|
| `metadataBase` | **없음** | 설정. 없으면 Next 가 OG·canonical 을 **상대경로**로 내보내고, 상대 OG URL 은 대부분의 메신저·SNS 미리보기에서 무시된다 — **지난 세션에 만든 공유 링크가 절반쯤 무효였다** |
| `sitemap.xml` | 정적 파일 · **URL 1개**(루트만) | `app/sitemap.ts` — 공개 9개. `requiresAuth` 로 걸러 보호 경로가 못 들어간다 |
| `robots.txt` | 정적 `Allow: /` | `app/robots.ts` — **`PROTECTED_PREFIXES` 에서 파생**. 새 보호 화면이 생기면 자동으로 따라온다 |
| 구조화 데이터 | 없음 | `/fit` 에 `WebApplication` + `FAQPage`. 화면의 `QUESTIONS` 배열을 그대로 써서 마크업과 본문이 갈라지지 않게 |
| canonical | 없음 | `/fit` 하나로 모은다 — 공유 링크가 색인을 쪼개지 않게 |

- **공유 주소를 경로로 옮겼다** — `/fit?r=` → **`/fit/s/<payload>`**.
  Next 의 `opengraph-image.tsx` 는 **라우트 세그먼트(`params`)만 받고 `searchParams` 는 못 받는다.**
  쿼리로 두면 크롤러가 가져가는 og:image URL 에 페이로드가 실리지 않아 미리보기에 결과를 못 그린다
  (실측 — 생성된 og:image URL 에 `r=` 이 없었다). 구버전 링크는 `redirect` 로 살려 둔다
- **동적 OG 이미지** — 공유 링크 미리보기에 **학년별 곡선을 그대로 그린다**(1200×630 · 46 KB).
  지문은 그리지 않는다 — 페이로드에 애초에 없다
- **한글 폰트 문제 두 개를 실측으로 물었다**:
  ① Satori 기본 폰트는 **라틴 전용**이라 한글이 빈칸으로 나온다 → Google Fonts `text=` 서브셋을
  런타임에 받아 명시 주입(수 KB · 하루 캐시 · 실패해도 폰트 없이 렌더).
  woff2 는 Satori 가 못 읽으므로 구형 UA 로 **ttf** 를 받는다
  ② Node 런타임에서는 Next 번들 기본 폰트를 `ERR_INVALID_URL` 로 못 읽어 이미지가 통째로 500
  (`fonts` 를 주입해도 마찬가지) → **`runtime = 'edge'`** 로 해소
- **Satori 는 넘친 텍스트를 잘라 주지 않고 겹쳐 그린다** — 화면용 문장을 그대로 썼더니 제목이
  첫 행과 겹쳤다. 카드 전용 짧은 문구로 분리
- **회귀 11 + e2e 6** — sitemap/robots 11(보호 경로 미노출 · 절대 URL · 우선순위 · 파생 유지) ·
  e2e 에 OG 이미지 실응답 검증 추가(200 · image/png · 10 KB 초과).
  ⚠️ 복사 버튼은 `replaceState` 라 그 상태에는 og 메타가 없다 — 크롤러처럼 **새로 열어야** 검증된다

### `/fit` 을 DB 경로에서 뺐다 — 레이트리밋을 붙일 자리부터 만들기 (v06.40)

"공개 API에 레이트리밋을 붙이자" 로 시작했는데, 측정해 보니 **붙일 자리가 없었다.**
`public-queries.ts` 가 브라우저 코드(`lib/supabase/client`)라 쿼리가 브라우저→Supabase 로
직행했고, 우리 서버는 경로에 아예 없었다. 방어를 안 한 게 아니라 놓을 곳이 없었던 것이다.

- **경로 재설계** — 레벨 맵 **전체가 18,271 표제어 · 200 KB** 라 프로세스에 담을 수 있다.
  `app/api/fit/route.ts` 신설 + `lib/textfit/level-map.ts`(프로세스당 1회 적재 · TTL 30분).
  → 지문 분석당 DB 왕복 **30+ → 0~1회**(잔여 실재어 확인만).
  **실측: 콜드 2.7s · 웜 41ms · e2e 54s → 14.7s**. 비용을 줄인 게 아니라 경로에서 뺐다
- **레이트리밋** — 토큰 버킷(용량 20 · 초당 0.5 보충 · IP별). 실측 25연속 → 22 허용 / 3 차단,
  다른 IP 무영향, 잘못된 입력 400. ⚠️ 프로세스 메모리라 **인스턴스 수만큼 곱해진다** —
  목적이 "실수·스크립트 한 대" 차단이라 그 수준엔 충분하고, 숨기지 않고 주석에 적었다
- **서버가 상한을 강제한다** — unique 4,000 · 토큰 200,000 · 단어 길이 64.
  클라이언트 상한은 방어가 아니라 UX 다
- **키셋 페이지네이션** — OFFSET 방식은 느릴 뿐 아니라 경계에서 어긋난다.
  `id > 마지막id` 로 바꿔 **빠뜨리거나 겹치지 않게** 했다(5.5s → 2.7s)
- **조용한 절단 방지** — 서버가 페이지를 1,000으로 깎는다(실측 왕복 60회). 요청 크기로
  종료 판정하면 첫 페이지에서 끝났다고 보고 **맵이 1,000개로 잘린다** — 잘린 맵은
  오류 없이 틀린 답을 준다. 받은 개수만큼 커서를 옮긴다
- **`lemma` 20% NULL 발견** — 81,409행 중 16,563. 이전 `.in('lemma', …)` 방식이 그 20%를
  조용히 버리고 있었다 → `word` 폴백 추가
- **"맵이 잘렸다" 는 오해를 실측으로 기각** — 로더가 59,203행/18,271 표제어에서 멈추길래
  결함을 의심했는데, `shared_words` 정책 `read words of published` 전문을 재현해 보니
  anon 가시 행이 **정확히 59,203/18,271** 이었다. 관리자 시점 81,409/21,503 과의 차이는
  결함이 아니라 **저작권 게이트**(도서·아티클 파생은 원본 발행 + `copyright_safe_in_kr` 필요).
  공개 화면이 그 이상을 알면 안 된다
- **회귀 137** — 레이트리밋 16 추가(정상 사용 리듬 통과 · 스크립트 속도 차단 · 시계 역행 ·
  메모리 상한 · LRU · 식별 불가를 무제한으로 바꾸지 않음). e2e 5/5 유지

### 결과 공유 링크 — 교사가 교사를 데려오는 고리 (v06.39)

`/fit` 을 열었지만 교사가 **발견할 경로**가 없었다. 10만 경로의 실제 엔진은 유입이 아니라
**교사 1명이 다른 교사를 데려오는 것**이고, 그러려면 결과가 링크로 나가야 한다.

- **지문은 링크에 담지 않는다 (설계 제약)** — 붙여넣는 것은 대체로 검정교과서·모의고사다.
  교과서 저작권은 발행 출판사에, 수능 지문은 원저작자에게 있고 평가원조차 대법원에서
  저작권료 판결을 받았다. 저장하거나 링크에 실어 유통하면 **우리가 복제·배포 주체가 된다.**
  → 서버 저장 0 · 테이블 0. 커버리지 숫자 8개 + **낱말 목록**(최대 16)만 base64url 로 URL 에 싣는다.
  낱말 목록은 지문의 표현을 재현하지 않는다(문장·순서·구성이 사라진다).
  e2e 가 링크에 원문 단어가 실리지 않는지 실제로 확인한다
- **왜 서버 저장이 아니라 URL 인가** — 저장하면 테이블·만료 정책·삭제 요청 처리가 따라온다.
  공유 하나에 개인정보 처리 책임을 지는 구조를 만들 이유가 없다. URL 자체가 저장소다
- **디코더는 어떤 입력에도 throw 하지 않는다** — 공유 링크는 남이 손댈 수 있는 유일한 입력이라
  죽으면 공개 화면 전체가 죽는다. 손상·위조·구버전은 전부 `null` 로 떨어지고 화면은 평소대로 뜬다.
  **단조성 검증** 포함 — 레벨이 오르는데 커버리지가 내려가는 곡선은 위조로 보고 버린다
- **위조 가능성을 숨기지 않는다** — 서명하지 않는다(키 관리를 얻는 것에 비해 크다).
  대신 화면이 "공유받은 결과"라고 명시하고, 받은 사람이 자기 지문으로 다시 돌리게 한다
- **동적 OG 메타** — 메신저 미리보기에 `이 지문은 고2 · 수능 기본 수준` + 학년별 수치가 뜬다.
  같은 제목만 뜨면 눌러야 내용을 알 수 있고, 그 한 번의 마찰이 확산 계수를 그대로 깎는다.
  공유 링크는 `robots: noindex` (파생 결과라 색인 대상이 아니다)
- **발견한 버그** — `resolvedShare`(내용어 분모)를 불확실 폭(러닝워드 분모)에서 역산하려다 틀렸다.
  분모가 다른 두 양이라 파생 불가 → 명시적으로 싣고 회귀로 고정
- **회귀 121 + e2e 5** — 공유 23(지문 유출 금지 4 · 비정상 입력 12 · 왕복 보존 6) 추가.
  e2e 는 클립보드 권한을 실제로 받아 URL 을 꺼내고 **새 세션에서 열어** 같은 판정이 나오는지 확인

### 공개 지문 진단 `/fit` — 가장 강한 기능을 관문 **앞**으로 (v06.38)

TextFit 을 만들고 보니 로그인 뒤에 있었다. 10만 학습자로 가는 유일하게 계산이 맞는 경로는
**교사 3,500명 × 학급 30명(CAC 0)** 인데(PLATFORM_AUDIT §6), 교사가 가입 전에 가치를 못 보면
그 관문에서 채널이 끊긴다. 허용 CAC 가 가입당 ₩400 인 시장에서 유료 획득은 애초에 불가능하므로,
**관문 앞에 둘 수 있는 가치가 유일한 획득 수단**이다.

- **설계 판단 — 익명 모드는 열화판이 아니다.** 교사에게는 개인 어휘가 없고 질문도 다르다:
  "내가 아는가" 가 아니라 **"우리 반에 맞나 · 몇 학년용인가"**. 즉 레벨 기준 판정이 교사에게는
  *정확한* 모드다. 그래서 만든 것은 데모가 아니라 **레벨 프로파일** — 지문 하나가
  V3~V10 각 학년에서 어떻게 보이는지 **곡선**으로 준다.
  Lexile·ATOS 는 지문에 숫자 하나를 붙이고 독자 점수를 따로 잰다 — 교사가 머릿속에서 맞춰야 한다
- **RLS 를 우회하지 않는다** — `shared_dictionary` 는 `authenticated` 전용이라 공개 화면에서 못 쓴다.
  `service_role` 은 "requireAdmin 뒤에서만" 이 명문 규약이라 후보가 아니다.
  → anon 이 읽을 수 있는 `shared_words`(v_level 보유 **20,776 표제어**) + `lexicon_clean`(45만, 실재어 판정)만 쓴다.
  마이그레이션 0 · 새 테이블 0 · 쓰기 경로 0 · 입력 지문 미저장
- **실측 사각지대를 감추지 않는다** — 발행 아티클 내용어 토큰 기준 `shared_words` 적중 **91.5%**,
  lexicon_clean 만 7.6%, 둘 다 없음 0.8%. 레벨 미상 8.4% 를 각 줄의 **하한~상한 띠**로 표시하고,
  적정 레벨은 **낙관 상한이 아니라 중앙 추정**으로 판정한다(낮게 부르면 교사가 헛수고한다)
- **`lib/textfit/inflect.ts`** — 굴절 **후보** 생성기(주장이 아니다). 정본 `resolve_dict_headword` 는
  anon EXECUTE 가 되지만 **스칼라라 단어마다 왕복**이라 공개 화면에서 못 쓴다.
  → 후보 전량을 한 번의 `.in()` 으로 던지고 DB 에 실재하는 것만 채택 — 오탐이 학습자에게 새는 경로가 없다.
  실측 굴절 프로브 20개 중 **19 해결 → 연쇄 굴절(`repeatedly`=repeat+ed+ly) 보강으로 20/20**
- **부사 규칙 어간 4자 하한** — 다른 접미사는 잘못 벗겨도 없는 조각이라 DB 가 버리지만,
  `-ly/-ily` 만은 과생성이 **실재하는 다른 단어**를 만든다(apply→app · only→on · family→fam · reply→rep).
  원형이 미등재면 엉뚱한 레벨이 붙으므로 하한을 뒀다
- **표면 수를 늘리지 않는다** — `(marketing)` 그룹에 둔다. 학습 모듈이 아니라 가입 전 관문이라
  F5(학습자 표면 22 → 4 목표)의 분모가 아니다. `PUBLIC_PREFIXES` 에 `/fit` 명시
- **회귀 94 + e2e 3** — 엔진 36 + 프로파일·굴절 35 + 렌더 23 +
  `24-public-fit.spec.ts` 3(**로그아웃 상태** — 리다이렉트 없음 · anon 레벨 해석 실동작 ·
  8개 학년 글자 노출 · 짧은 입력 거절 · 헤더 도달). e2e **3/3 통과**

### Game Lab 카탈로그가 잠겨 있었다 — 신규 유입 경로가 두 달째 닫힌 채 (v08.7)

`09-arcade-access` 의 **비로그인 그룹 7건**이 계속 실패하고 있었다. 원인은 인증 스윕
`e9970450`(2026-08-15)이 `/arcade` 를 `PROTECTED_PREFIXES` 에 넣은 것이다.

- **어느 쪽이 낡았나 — 스윕 쪽이다.** 그 커밋의 목적은 **권한 상승 차단**이었고,
  `(main)` 48 라우트 중 **사고로 열려 있던** 32개를 닫는 작업이었다. `/library`·`/comics` 는
  공개로 예외 처리했는데 `/arcade` 는 **논의된 흔적이 없다** — 휩쓸린 쪽이다.
  반대로 비로그인 아케이드는 **일부러 만들어져 있다**: 맛보기 배지 · "단어 모으러 가기" CTA ·
  무단어 오늘의 실험(`pickDailyGame`) · 스펙 헤더가 그 그룹을 **"신규 유입 경로"** 로 명시.
  아무도 닿을 수 없는 페이지에 그걸 짓지 않는다
- **결정: 경계는 화면이 아니라 카탈로그/세션이다.** `/arcade`(둘러보기) 공개 ·
  `/play/*`(FSRS·scores 를 쓰는 세션) 보호 유지. 비로그인 그룹은 `/play` 로 들어가지 않고
  `href` 만 단언하므로 이 경계와 정확히 맞는다
- **플랫폼 목표 정합** — `PLATFORM_AUDIT` 1회차: 가입자 3 · 공급:수요 3,480:1 ·
  허용 CAC 가입당 ₩400 → 광고 불가. 무가입 발견 표면은 CAC 0 자산이다.
  `/fit` 이 이미 같은 근거로 공개돼 있다("가입 전에 가치를 보여주는 관문 — 공개가 존재 이유")
- **개인 데이터 노출 없음** — bank 게임은 내장 큐레이션 뱅크, mine 게임은 스코프 없으면 맛보기,
  점수 기록은 비로그인이면 저장 자체가 안 된다
- **회귀** — `protected-routes.test.ts` 에 카탈로그/플레이 경계를 못 박는 단언 추가(210 통과) ·
  `apps/web/CLAUDE.md` 에 "공개로 남기는 것" 표 신설(스윕으로 한꺼번에 잠그지 말 것)
- ⚠️ **드러난 더 큰 문제**: 잠긴 뒤 **아무도 그 화면을 보지 않아** 이틀이 아니라 두 달 가까이
  아무도 몰랐다. 빨간 스펙이 방치돼 있었다는 뜻이기도 하다

### TextFit — 설계돼 있었지만 한 번도 계산된 적 없던 숫자 (v06.37)

`csat_stage_gates` 는 S1~S4 에 coverage 임계 **0.98 / 0.95 / 0.90 / 0.85** 를 갖고 있다.
그런데 그 값을 읽는 코드가 없었다 — `derive_learner_stage` 는 coverage 게이트를 만나면
**coverage 를 재지 않고** `current_v_level >= stage*2` 로 우회한다(2026-08-17 실측).
즉 임계값은 장식이었고, 학습자는 "이 글이 나에게 몇 %인지" 를 한 번도 본 적이 없다.

- **`lib/textfit/` 신설 (새 테이블·마이그레이션 0)** — `types.ts` · `coverage.ts`(순수 계산) ·
  `queries.ts`(기존 테이블만 읽음). 판정 신호 3중:
  `word_familiarity` 자기보고 → `vocabularies` FSRS R(t) → `user_profiles.current_v_level` 추정(0.85)
- **살아있는 커버리지** — 커버리지를 기억 상태의 함수로 잰다. `R(t) = exp(ln 0.9 × t / S)` 를
  그대로 써서 **복습을 미루면 같은 지문의 커버리지가 내려간다**. 14일 예보를 함께 낸다.
  Lexile·ATOS 는 글만 재고 LingQ 의 known-word 는 이진값이라, 이 성질을 가진 경쟁 제품이 없다
- **최소 처방** — "몇 개만 익히면 95%" 를 역산. 기여도(출현 빈도) 내림차순 그리디가
  교환 논증으로 **정확히 최적**이며 근사가 아니다. 동률은 사전순 → 같은 지문은 항상 같은 처방
- **거짓 정밀도 금지** — 레벨 추정에 기댄 질량만큼 하한/상한을 벌리고 `confidence` 를 깎는다.
  추정 비중이 크면 단일 숫자 대신 범위를 표시
- **화면** — `components/textfit/TextFitVerdict.tsx` 를 `/text/new` 추출 패널 **위**에 배선.
  "무엇을 배울까" 전에 "이 글이 맞나" 를 먼저 답한다. Memory Decay 4색 재사용(새 색 0) ·
  Lora italic 판정문 · 근거 펼침(Progressive Disclosure) · role="img" 스케일 · 44px 타깃
- **승인 대기 SQL** — `supabase/migrations/_pending_20260817_textfit_resolve_levels.sql`
  (읽기 전용 STABLE · 표면형→표제어 전량 해석). 미적용 상태에서는 정확 일치 폴백으로 동작하며
  **커버리지를 낮게** 잡는다(과대평가하지 않는 방향) · 화면이 그 사실을 밝힌다
- **실 데이터가 바꾼 설계** — 검증 계정 135장 중 **19장이 `review_count=13` 인데 `stability≈0`**
  이었다(실측). R(t) 만 보면 처음 보는 단어와 구분되지 않는데, 학습자에게 이 둘은 전혀 다르다 —
  하나는 처음부터 배워야 하고 다른 하나는 **복습 한 번이면 돌아온다**.
  → `unknown`(처음) / `fading`(잊음)을 분리하고 화면도 두 수를 나눠 보여준다.
  커버리지 수식은 그대로 둔다(둘 다 기여 0) — 분류만 정직해진 것이지 숫자를 후하게 만들지 않았다
- **밴드 매핑 실측 검증** — 발행 아티클 150편을 학습자 V4~V9 로 각각 채점.
  평균 커버리지 **0.713 → 0.801 → 0.870 → 0.914 → 0.938 → 0.959** 로 단조 상승하고
  다섯 밴드에 고르게 퍼진다(한 밴드로 뭉치지 않음) = 임계가 실제로 변별한다
- **회귀 47종 + e2e 2** — 엔진 36(R(t) 정의·경계·클램프·처방 최소성·결정론·감쇠·미지어/잊음 분리)
  + 렌더 11(범위 표시·예보 보존·죽은 버튼 금지·색맹 대응) +
  `23-textfit-verdict.spec.ts` 2(실 로그인·실 DB — 판정 렌더 · 추출보다 위 · 근거 펼침 · 본문 삭제 시 소멸).
  **e2e 2/2 통과 · `next build` exit 0 · `tsc` 신규 파일 에러 0**

### 공개 라우트 허위 지표 제거 (PLATFORM_AUDIT §4 즉시 제거 예외)

- `/pricing` — "학습자 12,000+ · 평점 4.8/5 · 학교 34곳" + 지어낸 교사·학습자 후기 3건 제거
  (같은 시각 실측 3 / 0 / 0 / 0). 이용자 수·평점·도입 기관 수는 표시광고법 정면 항목이라
  개발용 플레이스홀더로도 공개 라우트에 둘 수 없다
  → **검증 가능한 콘텐츠 자산**으로 교체(표제어 47,137 · 도서–어휘 연결 1,678,478 · 수능 유형 문항 1,374)
  → 후기 자리는 "다른 점" 3카드(각 카드에 학술·수식 근거 명시)로 대체
- `/admin/billing` — MRR ₩1.84M·활성 구독 184 가 하드코딩 상수인데 경고가 화면 밖
  (대시보드 링크의 "목업" 태그)에만 있었다. 이 화면만 연 사람은 실적으로 읽는다 → 인페이지 배너 추가

### PDCP 첫 발행 — 그리고 "1964년 이전 = PD" 가 틀렸다는 것 (v06.208)

원본 그대로(현대화 생략) 발행하려고 갱신 상태를 조사하다 **적재 전제가 틀렸다는 것**을 알았다.

**Fawcett 은 블랭킷 PD 가 아니다.** 갱신된 구간이 실재하고 그 구간은 지금 DC 소유다 —
DC 는 Fawcett 저작권을 갱신했고 게시 사이트에 삭제 요구를 보낸 이력이 있다.

| 갱신됨 (발행 불가) | 실측 해당 호 |
|---|---|
| MASTER COMICS #61 이상 | 49 |
| WOW COMICS #36~69 | 25 |
| Marvel Family 1951년 이후(CBS 1977 갱신) | 13 |
| Captain Marvel Jr. 1951년 이후 | 8 |
| WHIZ COMICS #3~6 (#2 는 미갱신) | 4 |

**969호 중 99호가 알려진 갱신 구간에 걸린다.** "Fawcett 은 1964년 이전이니 대체로 PD" 라는
한 문장으로 블랭킷 발행했으면 그만큼이 침해였다. 반대로 Ace Magazines 는 조사된 전 타이틀에서
갱신 통지가 발견되지 않았다(1956년 폐간) — Atomic War! 는 Wikisource 가 명시적으로 PD 로 판정한다.

- `scripts/comic/pd/renewal.mjs` — 조사 결과를 규칙표로. **판정이 아니라 위험 등급**이다
  (최종 확정은 여전히 사람이 CCE 를 보고 근거 URL 과 함께 기록). 기본값이 `likely-pd` 가 아니라
  `unknown` 인 것이 핵심 — 모르는 발행사를 낙관하지 않는다.
- `lib/pd-comic/renewal-bridge.ts` — 앱이 규칙을 **베끼지 않고** .mjs 를 그대로 읽는다.
  베껴 두면 조사가 갱신될 때 한쪽만 고쳐지고, 그 순간 화면은 "발행해도 된다"고 말하는데
  실제로는 아닌 상태가 된다. 모듈 로드 실패 시 fallback 은 `unknown`(안전한 쪽).
- Admin PD 탭 — 갱신된 호가 섞인 시리즈는 **일괄 확정 버튼을 잠근다**(한 클릭이 침해가 될 수 있다).
  호별 목록에 `갱신됨 · 발행불가` 표시.
- **첫 발행 12호** — Ace 3시리즈(Atomic War! 4호 · World War III 2호 · War Heroes 1호,
  스캔 12본 → 중복 접기 후 7호). 현대화 생략하고 **복원 원본 그대로** 업로드
  (`publish-kind --source restored`). 복원 단계가 이미 크롭·탈황변·2배 업스케일을 마쳐 그대로 읽힌다.
- `publish-kind.mjs --source <dir>` + 업로드 전 이미지 존재 확인(0장이면 "0장 성공"으로 끝나
  컷 없는 호가 발행 준비 완료로 보인다)
- Admin `TaxonomyBrowser` — 유형 → 시리즈 표(연도·호·컷·단계 분포·발행 진척). 접힌 카운트 목록
  대신 실제로 읽을 수 있는 형태. `미완성 유형만` 필터.
- 학습자 서가 `KindNav` — 유형 바로가기 앵커(유형 10종이면 세로 스크롤 몇 화면이 된다). 앵커라 JS 불필요.
- 회귀 +18 (`renewal.test.mjs` — 갱신 구간·발행사 기본값·표 무결성)

### PDCP — 발행을 막는 관문을 통과 가능하게 (PD 근거 확인 작업면, v06.207)

전쟁 유형 15호가 컷 2,199개·대사 169개로 검수 대기에 서 있는데 학습자 서가에는 아무것도
뜨지 않았다. `pd_basis` 가 비어 있고, 그건 **자동으로 채울 수 없는 값**이다 — 1930~63년
발행물의 PD 여부는 저작권 갱신 기록을 실제로 확인해야 하는 법적 판단이라, 스크립트가
채우면 발행 게이트가 장식이 된다. 그래서 **판정은 사람이 하되 절차를 화면으로** 만들었다.

**토큰이 이미 갈려 있었다.** `usPdHint()` 는 1930년 이전에 `term-expired` 를 내고 DB CHECK 도
허용하는데, 발행 API 화이트리스트에는 그 토큰이 없어 **확정이 400 으로 거부**됐다.
파이프라인이 만든 값을 API 가 못 받는 상태였고, 그 조합을 눌러 보기 전엔 알 수 없었다.
→ `model.ts` 의 `PD_BASES` 가 정본, API 는 거기서 읽는다. 테스트가 DB CHECK 집합과 대조한다.

**확인 단위는 호가 아니라 시리즈다.** 갱신은 간행물 단위로 등록되고 CCE 갱신 편도 간행물
이름으로 묶여 있다. 운영자가 실제로 하는 일은 "Whiz Comics 의 1967~68년 갱신 목록을 봤다"
한 번이고, 그게 그 시리즈 102호에 적용된다. 호마다 969번 누르게 만들면 아무도 안 한다.

**어디를 볼지 계산해 준다.** 갱신 창 = 발행 27~28년 뒤(1909년법). 1952년 발행이면 1979~80년
편이다. 이걸 모르면 60년치를 뒤지게 된다.

⚠️ **만화는 Stanford 판권갱신 DB 에 없다** — 그 DB 는 도서(Class A) 전용이고 만화책은
정기간행물(Class B)이다. 거기서 "검색해도 안 나온다"를 근거로 삼으면 **틀린 확신**이 된다.
화면이 조회처를 그렇게 안내한다(테스트가 경고 문구를 강제).

- `GET/POST /api/pdcp/pd-check` — 시리즈별 확인 대상·갱신 창·조회처 / 시리즈 단위 근거 기록.
  `no-renewal`·`explicit-license` 는 **근거 URL 없이 저장 거부**(http(s) 형식 검증 포함) —
  "찾아봤는데 없더라"는 어딘가를 봤다는 주장이라, 재검증할 수 없는 기록은 게이트를 형식으로 만든다.
  확인자·시각은 서버가 붙인다.
- `components/admin/PdBasisPanel.tsx` + Admin 탭 `PD 근거 확인`(드레인과 모니터 사이 — 순서가 곧 다음 할 일)
- 화면도움말 1탭 추가(steps 3 · fields 4 · cautions 4)
- 회귀 +15 (`pd-basis.test.ts` — DB CHECK 집합 대조 · 근거 필수 여부 · 갱신 창 산술 · 조회처 경고)

### PDCP 드레인 — 취득이 페이지를 조용히 버리고 있었다 (v06.206)

969건 드레인을 시작하기 전 **한 호를 측정한 것**이 세 개의 무증상 결함을 드러냈다.
전량 실행 후였다면 969건이 전부 오염된 뒤에 알았을 것이다.

**① 결손 페이지를 성공으로 끝냈다.** World War III #1 은 원본 31쪽인데 19쪽만 취득됐고
`acquire` 는 exit 0 이었다. IA 의 `/page/nN_w1600.jpg` 는 jp2→JPEG 를 요청 시점에 생성해
부하 시 **502** 를 주는데, 같은 URL 을 잠시 뒤 치면 200 이 온다(실측 확인). 재시도가 없어
일시 장애가 영구 페이지 손실이 됐다. 12쪽 빠진 만화가 복원·분할을 통과해 발행 대기열까지
갈 수 있었다 — 에러 하나 없이. hOCR(202KB, 실재)도 같은 502 로 "소스가 OCR 미제공"으로 오인돼
**대사가 0** 이었다. → `fetchRetry`(지수 백오프+지터) · 4xx 는 재시도 안 함(없는 파일을
969번씩 두드리면 적재가 몇 배 느려진다) · `fetchOcr` 은 파일 목록에서 존재를 먼저 확인하고
존재하는데 못 받으면 `null` 이 아니라 **throw**(404 와 502 는 다른 사건이다) ·
`acquire` 는 결손이 남으면 **exit 1**(원본에 없는 경우만 `--allow-partial`).
재측정 **31/31쪽 · hOCR 202KB · 136컷**(기존 19쪽·OCR 없음·79컷), 소요는 오히려 감소.

**② `acquire_pages || 4`.** NULL 은 "전권"이라는 **뜻이 있는 값**인데 falsy 라 4장으로 뭉개졌다.
68쪽 호가 앞 4장만 복원될 뻔했다.

**③ 대사가 없으면 컷도 못 넣었다.** `load-panels` 가 bubbles 매니페스트 부재에 exit 1 이라,
hOCR 없는 소스(Ace 낱장 업로드)의 호는 **컷이 멀쩡한데 DB 에 영원히 못 들어갔다**(Atomic War 전권).
파이프라인 자신은 이미 hOCR 부재를 정상으로 취급해 검수로 넘기는데 적재만 다른 규칙을 갖고 있었다.
컷 이미지가 곧 콘텐츠고 원작 레터링은 그림 안에 있다 — 대사는 나중에 채운다(재적재 멱등).
Windows 대소문자 비구분 경로로 `qc.workDir` 매칭이 실패하던 것도 정규화.

- 마이그레이션 `20260817120000_pd_comic_dedupe_scans` — 같은 호의 여러 스캔본(32그룹·36행)을
  학습자 RPC 3개에서만 호당 1본으로 접는다. 파이프라인엔 전부 남긴다(어느 스캔이 온전한지는
  취득 후에야 안다). ⚠️ `coalesce(issue_no::text, id::text)` — NULL 을 접으면 번호 없는 별책 75건이
  한 권으로 사라진다. 권수 집계도 호 기준(카드 "9권"인데 열면 4권이면 그 숫자는 거짓말).
- `publish-kind.mjs` — 유형 하나를 발행 직전까지(현대화 → 스토리지 업로드). **`pd_basis` 는
  자동으로 채우지 않는다** — 1930~63 물의 PD 여부는 갱신 기록을 실제로 확인해야 하는 법적 판단이고,
  스크립트가 우회하면 발행 게이트가 장식이 된다. 게이트 앞까지만 밀고 남은 것을 보고한다.
- `drain-batch.mjs --kind/--series` — 유형 하나를 끝까지 미는 것이 기본 전략(서가가 유형별로 묶여 나감).
- 분류 정정 — 규칙 선택을 "첫 매치"→"**가장 앞선 매치**". `Whiz Comics 025 (Origin of Captain
  Marvel Jr)` 가 Captain Marvel Jr. 시리즈에 섞여 있었다. 간행물 이름은 앞, 수록 내용 언급은 뒤. 5건 정정.
- 회귀 +10 (`fetch-retry` 8 · taxonomy 2)

### ScriptQuiz 진입면이 **아직 안 읽은 챕터의 독해 퀴즈를 팔고 있었다** (v08.6)

`/scriptquiz` 는 퀴즈가 있는 챕터 **129개를 전부 동일한 버튼으로 나열**했다(실측 5.57 화면 높이).
같은 시점 DB 를 보면 학습자의 Pride and Prejudice 는 **Ch1–19 읽음 · Ch20 읽는 중 · Ch21–61 미열람**
이었다. 즉 화면은 **읽지도 않은 41개 챕터의 줄거리 문제를 내주고 있었다** — 쓸모없는 정도가 아니라
**스포일러**다. 고를 근거도 없었다(어느 챕터를 읽었는지·무엇을 확인했는지 화면이 말하지 않았다).
필요한 정보는 전부 이미 DB 에 있었고 화면이 쓰지 않았을 뿐이다.

- **개념 전환: 카탈로그 → "읽은 것의 확인 대기열"**. `texts.status`(읽음 판정은
  `v_user_book_progress` 와 **같은 집합** — completed·conquered·extracted)와 교차해
  **읽은 챕터만** 내준다. 안 읽은 챕터는 **잠그는 게 아니라 목록에서 빼고**(§4① 막지 않고 권한다)
  "읽으러 가기" 를 준다. 숨긴 개수는 밝힌다(조용한 절단 금지)
- **다음 한 걸음 하나** — 읽은 지 **가장 오래된** 미확인 챕터(Roediger & Karpicke: 즉시·집중 인출은
  효과가 작고 간격을 둔 인출이 강하다). §4④ "한 번에 한 걸음만"
- **근거(국내외)** — Accelerated Reader(Renaissance · 26,000+ 퀴즈, 학교 표준): **책을 읽은 뒤** 푸는
  퀴즈이고 오답은 "읽지 않은 사람에게 그럴듯한" 것 = 이해도 검증인 **동시에 실제로 읽었는지 판별하는
  장치**다. 안 읽은 챕터에 내주면 장치 자체가 무의미해진다 · BookPal 'Spoiler Shield'(읽은 데까지만
  아는 동반 AI)도 같은 계약 · MCQ 는 true/false 보다 추측 여지가 적고 단답 수행까지 끌어올린다는
  보고가 있어 4지선다 형식은 유지
- **실측 결과** — 5.57 화면 → **1.06 화면** · 129 버튼 → 다음 한 걸음 1 + 책 카드 N(기본 접힘) ·
  axe 위반 0(light·dark)
- **그라디언트 히어로 제거** — 확인하러 오는 자리에 브랜드가 소리칠 이유가 없다(`/practice` v06.202 와 같은 판단)
- **회귀 14** — `lib/scriptquiz/__tests__/queue.test.ts` 8(미열람 챕터 배제 · 읽음 집합 정의 ·
  간격 인출 선택 규칙 · 재시도 허용 · 마지막 시도 채택) + `ScriptQuizQueue.render.test.tsx` 6
  (**렌더가** 미열람 챕터 링크를 그리지 않는지 — 이전 결함은 데이터가 아니라 렌더가 원인이었다)
- **부수 실측** — `scores` 의 scriptquiz 21건은 **전부 e2e 계정**(`runtime-test-0705`)이고
  실사용자 기록은 **0건**이다. 죽은 화면을 고친 게 아니라 **아직 쓰이지 않은 화면**을 고친 것이다
  (`docs/PLATFORM_AUDIT.md` 의 "공급 비대 / 수요 검증 0" 과 같은 신호)
- 사용하지 않게 된 `ScriptQuizHub.tsx` 삭제

### PDCP 원본 전체 소스 GET + 유형·시리즈 분류 축 (v06.205)

`/comics/restored` 는 **빈 서가**였다(`pd_comic_issues` 0행). 원본을 전량 넣으면서 두 가지가 드러났다.

**① 발견 채널이 틀려 있었다.** 콘솔 프리셋의 `classics illustrated` 제목 검색은 208건을 돌려주지만
실측 결과 그중 만화는 **9건뿐**이었다 — 나머지는 *Great Illustrated Classics*(1989~96 산문·저작권 존속) ·
*Saddleback's*(현대) · 1731~1745 고서였다. 제목에 그 말이 들어간다는 이유로 훑으면 **저작권이 살아 있는
자료로 큐를 채우게 된다.** 실제 만화가 있는 곳은 사서 큐레이션 컬렉션이었다 —
`fawcett-comics` 811 · `ace-comics` 209.

**② 페이지네이션이 조용히 누락시키고 있었다.** IA `advancedsearch` 는 정렬 없이 페이지를 넘기면
순서가 고정되지 않는다. 정렬 없이 1,020건을 받았더니 **214건이 중복**이었고 그만큼이 **빠져 있었다**
(앞선 표본에 없던 시리즈가 뒤늦게 나타나 드러났다). 중복은 눈에 띄지만 누락은 눈에 띄지 않는다 —
"전체를 가져왔다"고 믿는 순간이 가장 위험하다. `sort[]=identifier asc` 로 고정하고, 수집 수를
소스 신고 총계와 대조해 어긋나면 보고하게 했다(**811/811 · 209/209 · 중복 0**).

**분류 축** — 자유 텍스트 `series_title` 한 칸으로는 같은 시리즈가 표기마다 갈렸다
(`Whiz Comics 022 (b and w) (coverless)` / `Whiz comics 015 (alt scan)` / `Spy_Smasher_6`).
실측 1,020건에서 **자유 텍스트 값 168개 vs 실제 시리즈 90개**. 유형은 취향 분류가 아니라
**어휘 도메인 축**이다 — 서부물의 `ain't/reckon` 과 SF 의 과학 어휘는 다른 학습이라,
유형마다 "이걸 읽으면 어떤 영어를 얻나"(`learner_note`)를 데이터로 갖는다.

- 마이그레이션 `20260816200000_pd_comic_taxonomy` — `pd_comic_kinds`(12행 시드) · `pd_comic_series` +
  `pd_comic_issues.kind`·`series_key`(FK) · RPC 3(`list_pd_comic_shelf` · `select_pd_comic_info` ·
  `list_pd_comics(p_series_key)`). ⚠️ `list_pd_comics` 는 반환 컬럼이 늘어 **drop 후 재생성**
  (무인자 오버로드를 남기면 기존 호출이 42725 ambiguous 로 죽는다). 파생 카운터는 컬럼이 아니라 집계.
- `scripts/comic/pd/taxonomy.mjs` — **순서 있는 규칙표** 101 시리즈 → 12 유형. 휴리스틱(앞 N토큰) 금지:
  우연히 맞는 것과 규칙으로 맞는 것을 구분할 수 없으면 갈라져도 모른다. 순서가 함정을 만든다
  (`Captain Marvel Jr` 는 본편보다 먼저, `Mighty Midget` 은 수록 캐릭터보다 먼저, `Sweetheart Diary` 는
  `Sweethearts` 보다 먼저). 구분자는 규칙마다가 아니라 **건초더미 쪽을 정규화**(`Slam-Bang`·`Spy_Smasher`
  가 미분류로 떨어졌던 원인). 업로더 오타 `Bafflng` 흡수. 읽을 수 없는 항목(표지 모음)은 분류 이전에 제외.
- `scripts/comic/pd/ingest-bulk.mjs` + `POST /api/pdcp/bulk-ingest` — 검색 응답만으로 전량 적재
  (호당 metadata 왕복 없음 → **969건을 IA 요청 11회**로). `enqueue`(상한 50건·호당 왕복 1회)로는
  사람이 50번 눌러야 하고 외부 사이트에 1,000회 추가 요청을 보낸다. 재실행 멱등(진행 상태 미덮어씀).
- **실적재 969호 · 101시리즈 · 10유형 · 미분류 0** (1964년+ 50건 · 표지 모음 1건 제외).
  전부 1940~1963 발행이라 **PD 근거는 비어 있다** — 적재됐다는 것이 발행 가능하다는 뜻이 아니다.
- 학습자 `/comics/restored` **유형 → 시리즈 2단 서가**(969호를 평면 격자로 깔면 카탈로그이지 서가가
  아니다) + `?series=` 시리즈 안 호 목록 + **콘텐츠 정보 팝업** `ComicInfoDialog`
  (서지·유형 학습노트·출처·PD 근거·분량 · 포커스 트랩 · Esc · 포커스 복원). 출처와 근거를 내보이는 것은
  장식이 아니라 신뢰 요건이다 — 숨기면 정당한 PD 콘텐츠가 해적판처럼 보인다.
- Admin `소스 · 대량 적재` 에 "원본 전체 소스 GET"(계획 보기 = DB 쓰기 0) · `큐 · 드레인` 에
  **유형·시리즈 분포**(유형별 발행 진척 — 유형 하나를 끝내야 묶음이 통째로 도착한다) + 화면도움말 갱신
- 회귀 32 — `taxonomy.test.mjs` 23(순서 함정·표기 변형·오타 흡수·호수 추출) + `shelf.test.ts` 9(fold 순서 보존·합계)

### 지면 계측을 전 표면으로 — 그리고 계측이 스스로 거짓말하던 것을 고쳤다 (v06.205)

v06.204 에서 만든 지면 배분 계측(`blocks`)을 `/hub` 밖으로 넓히자마자 **계측 자체의 결함**이 드러났다.

- `/wordvault` 는 **3.14화면** 짜리인데 이름 붙은 섹션이 368px 하나뿐이었다.
  그런데 계측은 그 한 조각을 **"100%"** 로 인쇄했다 — 측정 못 한 것을 완전한 것처럼 보고한 것이다.
  이 하네스가 이미 "카드 0개는 균질한 게 아니라 **못 잰 것**" 이라고 적어 둔 함정에 스스로 빠졌다.
- → **`blockCoverage`** 추가. 본문 대비 덮은 비중을 함께 내고, **60% 미만이면 배분을 아예 말하지 않는다**
  (`⚠ 본문의 13% 만 이름 붙은 섹션 — 배분 측정 안 됨`).

**`Frame` 에 랜드마크 이름 부여** (`components/ui/ios/Frame.tsx`)
- `Card` 는 기본으로 `<section>` 을 그리는데 **이름이 없었다.** 이름 없는 `<section>` 은
  스크린리더가 영역으로 노출하지 않아, Frame 으로 만든 화면 전체가 "구획 없는 한 덩어리" 로 읽혔다.
  제목이 이미 있으므로 `aria-label={title}` 로 준다(같은 컴포넌트의 같은 prop 이라 문구가 갈릴 수 없다).
- 접근성 개선이 본체이고, 부수 효과로 Frame 기반 화면이 그제서야 **측정 대상**이 된다.
- a11y 스윕 통과(랜드마크 이름 중복 위반 없음).

**측정 결과 — 3개 표면 배분**

| 화면 | 덮음 | 배분 | 판정 |
|---|---|---|---|
| `/hub` | 86% | 오늘 56 · 오늘 읽을 것 34 · 뒤이어 9 | 위계 있음 |
| `/dashboard` | 106% | 28 · 23 · 23 · 16 · 7 · 3 | 위계 있음 |
| `/wordvault` | 91% | **15 · 12 · 14 · 12 · 17 · 18 · 13** | ⚠ **완전히 평평** — 3.14화면에 7블록이 전부 같은 무게 |

`/wordvault` 의 평평함은 `/hub` 이 v06.200 에서 지적받은 것과 같은 계열이다
("7개 동일 정사각 카드 … 죽은 정보"). **이번엔 측정만 하고 고치지 않는다** — 같은 화면을
다른 세션이 v06.202 에서 손대고 있어, 측정을 남기고 판단은 별도 라운드로 넘긴다.

### `/hub` 관문 재설계 ④ — 지면의 절반을 누를 수 없는 목록이 쓰고 있었다 (v06.204)

앞선 세 라운드는 **덧붙이는** 작업이었다. 이번엔 구성 자체를 계측했다.
캡처 하네스에 **지면 배분 계측**(`blocks` — 이름 붙은 최상위 섹션의 높이·비중)을 추가하고
재 보니 관문의 구성이 이랬다:

| 블록 | 데스크톱 | 모바일 |
|---|---|---|
| 오늘 (단어 무대 + 흐름) | 367px (49%) | 596px (61%) |
| **뒤따르는 단어** (7행 목록) | **388px (51%)** | 380px (39%) |

**관문의 절반**을 단어 7행 목록이 쓰고 있었는데, 그 행은 `<li>` 안에 단어·뜻·"1일" 뿐이고
**링크도 버튼도 없었다.** 동시에 처방은 오늘 읽을 글을 **5편 골라 두고 있었지만**
(`prescribe_today → input.candidates` — 제목·CEFR·register 포함) 화면은 흐름 목록에
`Read · 30분` 이라고만 적어 **무엇을 읽는지 제목조차 볼 수 없었다.**

이 제품은 단어에 대해 이미 같은 결론을 내렸다(v06.200): *"개수는 할 일을 말하지만 단어는
그 자체가 학습 재료다."* 읽을거리에는 그 결론이 적용되지 않고 있었다.

**재구성 결과** (같은 계측):

| 블록 | 이전 | 이후 |
|---|---|---|
| 오늘 (무대) | 49% | 52% |
| **오늘 읽을 것** (신규) | — | **38%** |
| 뒤따르는 단어 | 51% | **10%** |

- **신설** `components/home/TodayReading.tsx` — 처방 후보 상위 **3편**(작업기억 ~4)을
  제목·CEFR·성격으로. 도서는 URL 직결, 글은 `startArticleLearning` 경유(주소가 나중에 생긴다)
- **신설** `components/home/NextWordsStrip.tsx` — 7행 목록을 **한 줄 띠**로 접고
  `단어장에서 보기` 링크를 붙였다. "무엇이 밀렸나" 는 유지하되 자리는 1/5, 행동은 생김
- **순서 교정** — 띠를 `TodayStage` 밖으로 분리했다. 무대 안에 있던 동안에는
  **밀린 단어가 오늘 읽을 것보다 위**에 왔다. 지금은 `무대 → 오늘 읽을 것 → 뒤이어`
- **단일 CTA 유지** — 읽을거리 행은 채워진 버튼이 아니라 목록 항목(2차)이다.
  e2e `23-hub-today-stage ②`(시작 버튼은 하나) 통과로 확인
- **이름은 레지스트리에서** — register 한국어 라벨은 `lib/articles/source-guide.REGISTER_LABEL`
- **회귀 +8** — `TodayReading.test.tsx`(3편 상한 · 메타 없을 때 빈 구분자 금지 ·
  채워진 버튼 금지 · article 은 링크 아님)
- **하네스 상시 자산 +1** — `blocks` 계측. 카드 균질성·넘침은 "각 블록이 잘 만들어졌나" 를 보지만
  진입면에서 더 자주 틀리는 것은 **무엇에 얼마를 줬나** 다. 스크린샷만 보면 "꽉 차 보인다" 로 넘어간다

### `/hub` 관문 재설계 ③ — 관문은 시험이 아니라 지면이어야 한다 (v06.203)

앞선 두 라운드는 관문의 문구·테마·복귀를 고쳤지만 **구조는 그대로 시험 하나**였다.
신규 학습자가 관문에서 받는 것이 "5분 진단하세요" 뿐이고, 진단을 안 하면 화면에 남는 것이
없었다 — **어휘 학습 제품인데 단어 한 개, 문장 한 줄이 없었다.**

근거 (설계 전 실측 + 리서치):
- **자체 실측** — `/admin` 리텐션 1회차가 **가입 → 첫 학습 중앙값 55일**을 냈다.
  리텐션 이전에 **활성화**가 막혀 있고, 그 지점의 화면이 정확히 여기다.
- **온보딩 연구** — 가치를 게이트 뒤에 두는 것이 온보딩에서 가장 비싼 실수 ·
  가치 도달 30분 초과 시 이탈 약 **3배**(10분 이내 대비) · 신규의 **70~80%가 3일 내 이탈**하며
  대부분 가치를 만나기 전 첫 세션에서 빠진다 · 온보딩 체크리스트 완주율 중앙값 **10.1%**.
- **재료는 이미 있었다** — `shared_dictionary` 에 뜻·예문·CEFR·빈도를 다 갖춘 단어 **28,946개**.
  파이프라인이 몇 달간 채운 것을 관문이 한 번도 쓰지 않았다.

→ 순서를 뒤집었다: **① 제품이 하는 일을 먼저 보여준다(단어 하나) → ② 진단은 게이트가 아니라
그 아래 제안으로.** 첫 방문 지면은 진단 완료 학습자의 무대와 **같은 조판**을 쓴다 —
처음 본 것이 나중에 매일 볼 것과 같아야 진단이 "새 곳으로 가는 문" 이 아니라
"이 지면을 내 것으로 만드는 일" 로 읽힌다.

- **신설** — `lib/learner/taste-word.ts`(대역에서 날짜로 한 단어). 새 테이블·마이그레이션 0
- **단일 CTA 유지** — 1차는 진단 하나. `먼저 둘러보기 → /library` 는 2차 링크이고,
  **게이트가 아님을 화면으로 증명하는 줄**이다(서재는 원래 공개 라우트)
- ⚠️ **대역을 실측으로 정했다** — 첫 초안은 1,000~6,000위를 빈도순 500개만 받아 그중에서
  골랐는데, 풀이 "가장 흔한 500개" 로 쏠려 실제 오늘의 단어가 **`football`(축구)** 로 뽑혔다.
  기술적으로는 맞지만 첫인상으로는 실패다. `width_bucket` 으로 8구간을 표본해 **2,000~6,000위 ·
  A2~B2** 로 재설정하고, 풀 대신 **대역 전체를 모수로 offset 한 행만** 꺼내도록 바꿨다
  (검증: 향후 7일 = translator · lung · tonne · calcium · wisdom · medal · consistently)
- **랜덤을 쓰지 않는다** — SSR/CSR 불일치 · 캡처 흔들림 · "오늘의 단어" 가 새로고침마다 바뀌는 문제.
  KST 날짜로 결정하고 회귀로 잠금
- **회귀 +19** — `taste-word.test.ts`(6, KST 경계·범위·한 바퀴 비반복) ·
  `TodayFocus.test.tsx`(13, **단어가 진단 제안보다 먼저 오는지 위치로 단언**)

### 수요 계측 — F4 는 "수집 장치가 없다" 가 아니라 "아무도 계산해 본 적이 없다" 였다 (v06.202)

`/admin` 이 공급(도서·글·만화·단어장)은 전부 세면서 **수요(학습자)는 한 번도 세지 않고** 있었다.

- 실측해 보니 F4 가 요구한 **이벤트 6종 중 5종이 이미 파생 가능**했다 —
  가입(`auth.users`) · 첫 학습/세션 완료/단어장 생성/퀴즈 완료(`learning_records`+`scores`).
  빠진 것은 **순수 재방문(학습 없는 조회)** 하나뿐. → **새 이벤트 테이블·쓰기 경로 0개**로 해결
- 순수 재방문은 **일부러 수집하지 않는다** — 학습 제품에서 조회만 한 방문은 가치가 아니고,
  쫓으면 지표가 실제 학습과 멀어진다. 재는 것은 **활동 리텐션**(돌아와서 실제로 학습했는가)
- **신설** — `lib/admin/retention-math.ts`(순수) · `lib/admin/retention.ts`(조회) ·
  `components/admin/RetentionPanel.tsx` → `/admin` 상단 배치
- **정직성 규칙** — 분모 **20명 미만이면 퍼센트를 그리지 않는다**(원수 N/M 만).
  3명 중 1명을 "33%" 로 인쇄하면 그 숫자가 근거처럼 읽히고, `PLATFORM_AUDIT` §2 가 금지하는
  "수치를 근거로 쓰기" 가 거기서 시작된다
- **분모를 정직하게 센다** — D30 분모에 어제 가입한 사람을 넣으면 리텐션이 구조적으로 낮게 나온다.
  각 창마다 "그만큼의 시간이 실제로 지난 사람" 만 센다
- **실패를 0 으로 바꾸지 않는다** — service-role 키 누락·권한 실패 시 `null` 을 올려
  화면이 "**못 쟀음**" 이라고 말한다(0 과 구별 불가한 폴백은 이 리포의 지배적 결함 유형)
- **1회차 판독** — 가입 3 · 활성화 3 · **가입→첫 학습 중앙값 55일** · D1 0/3 · D7 1/3 · D30 1/3.
  ⚠️ 3명은 개발·검증 계정이라 **사용자 행동이 아니다**. 다만 55일은 표본이 작아도 방향을 말한다 —
  문제는 리텐션 이전의 **활성화**이고, 관문의 `first` 상태(첫 방문 카드)가 정확히 그 자리다
- **회귀 +21** — `retention-math.test.ts`(14, 분모·창 경계·작은 표본 규칙) ·
  `RetentionPanel.test.tsx`(7, 퍼센트 억제·"못 쟀음" 구별)
- ⚠️ 같은 함정 3회차 — 컴포넌트가 `server-only`+`cache` 모듈을 import 해 vitest 가
  `cache is not a function` 으로 죽었다. `retention.ts` 는 `dashboard-stats.ts` 관례대로
  **cache 를 쓰지 않는다**(호출부 1곳이라 이득 없음). 컴포넌트는 순수 모듈에서 직접 import

### `/hub` 관문 재설계 ② — 첫 방문 카드가 다크모드에서 안 보이고 있었다 (v06.202)

관문의 나머지 절반은 **처음 온 사람**이다. 진단 전 학습자가 보는 유일한 제안(`TodayFocus`)에
네 가지가 동시에 잘못돼 있었다. 넷 다 **검증 계정에서 렌더되지 않아**(그 계정은 진단 완료 V11)
런타임 캡처로는 영영 발견되지 않는 종류였다.

| # | 결함 | 근거 |
|---|---|---|
| ① | **다크모드에서 흰 바탕에 흰 글자** — 배경 `#F5F3FF` 하드코딩 + 글자 `var(--t1)`. `--t1` 은 다크에서 `#F0EAE0` → 대비 **약 1.05:1** | 토큰 실측 (`tokens.css` 91 / 338행) |
| ② | 페르소나 5종 중 **4종이 도달 불가** — `/hub` 이 `!isDiagnosed` 일 때만 부르므로 cold·warm-risk·warm-progress·hot 분기는 실행될 수 없었다 | `hub/page.tsx:88` |
| ③ | **Admin 전용 보라**(`#AF52DE`·`#5856D6`)를 학습자 화면에 사용 | 프로젝트 색 규칙 |
| ④ | 조사 오류 `'스크립트을'` + 옛 이름(레지스트리는 `Texts` 로 확정) | `apps/web/CLAUDE.md` 이름 표 |

①③은 프로젝트 **절대 규칙** 위반이다("CSS Variables 로 테마 제어 — 하드코딩 금지" ·
"`data-theme='dark'` 모든 컴포넌트 대응 필수").

- **재작성** — 토큰만 사용 · 도달 불가 분기 제거(≈65줄) · `'use client'`+`useHubData` 제거로
  서버 컴포넌트화(로딩 스켈레톤 불필요)
- **문구** — 처음 온 사람에게 **시스템을 설명하지 않는다.** 이전: "한국 학습자 12단계 V-Level
  체계로 본인의 어휘 수준을 정확히 측정합니다"(V-Level 은 아직 아무 의미 없는 내부 용어).
  지금: "5분이면 오늘 읽을 것이 정해져요" + "맞히지 못해도 괜찮아요 — 맞은 개수가 아니라
  어디쯤인지를 봅니다"(진단을 시험으로 만들지 않는다)
- **랩에 편입** — `/hub-lab?v=g` 에 첫 방문 카드를 세워 `HUB_SHOT_THEME=dark` 캡처로
  라이트·다크 양쪽이 잡히게 했다. 다크 실측으로 수정 확인
- **회귀 +9** — `TodayFocus.test.tsx`(hex 리터럴 0 · 보라 금지 · 내부용어 금지 · 조사 재발 방지 · 44px)

### `/hub` 관문 재설계 ① — 돌아온 사람을 알아본다 (v06.202)

`/hub` 은 이 제품의 유일한 관문인데 **처음 온 사람·오늘 이미 한 사람·사흘 만에 온 사람에게
전부 같은 화면**을 보여주고 있었다. 이어하기가 아예 없었다.

근거 (설계 전 리서치 + 자체 진단):
- **자체 진단 F2**(`docs/PLATFORM_AUDIT.md`) — 모바일이 없어 푸시·위젯이 없다.
  즉 **웹 홈이 이 제품의 유일한 리텐션 장치**인데, 그 자리가 복귀를 다루지 않았다.
- **업계 리텐션** — 교육 앱 D30 은 2~3%로 전 카테고리 최저(교차업종 중앙값 D1 26 / D7 13).
  끊기는 것이 기본값이라 관문이 복귀를 설계하지 않으면 복귀는 일어나지 않는다.
- **2026 UX 합의** — "돌아왔을 때 하던 자리를 되찾아 주는가" 가 개별 화면 완성도보다
  리텐션에 크게 작용한다. 중단된 흐름을 못 이어 준 것이 낮은 D7 로 잡히곤 한다.
- ⚠️ `components/home/ContinueCard.tsx` 는 **이미 있었지만 어디에도 붙어 있지 않았다**
  (전 리포 grep 사용처 0). 이어하기는 코드가 없어서가 아니라 **연결되지 않아서** 없었다.

| 상태 | 관문이 하는 말 | 규칙 |
|---|---|---|
| `first` (기록 0) | — 그리지 않음 | 진단 유도는 `TodayFocus` 단독 책임 |
| `today` (오늘 함) | — 그리지 않음 | "돌아왔네요" 는 거짓이고 진행은 흐름이 이미 말한다 |
| `returning` (1~6일) | `어제 이어서` / `3일 만이에요` + 마지막에 한 것 + 이어하기 | 일수를 사실로만 |
| `away` (7일+) | `다시 오셨어요` + 마지막에 한 것 | **일수를 아예 지운다** |

- **신설** — `lib/learner/gateway-state.ts`(순수: 판정·문구) · `lib/learner/gateway.ts`(조회) ·
  `components/home/GatewayLead.tsx`
- **단일 CTA 유지** — 이어하기는 버튼이 아니라 링크 한 줄. 화면의 1차 행동은 여전히 무대의
  "지금 시작" 하나다 (e2e `23-hub-today-stage` ② 통과로 확인)
- **마지막 활동 출처는 두 곳을 합친다** — `learning_records` + `scores`. 한쪽만 보면 조용히
  틀린다(받아쓰기·게임은 scores, 플래시카드류는 learning_records 에 남는다)
- ⚠️ **`reading_sessions` 는 쓰지 않는다** — 이어하기 정본처럼 보이지만 실측 2026-08-16
  전 사용자 256행이 전부 `status='pending'`·`started_at` **전부 NULL**. 쓰면 항상 첫 문단으로 되돌린다
- **한국어 조사 결함 수정(라운드 1 실측)** — 초안이 `《제목》 을 Dictation 으로 했어요` 로
  조사를 고정했는데, 앞 명사가 임의의 영문이라 《Alice》는 "를"·《Carol》은 "을",
  `Echo` 는 "로"·`Dictation` 은 "으로" 다. 묵음 e(Alice→앨리스) 때문에 철자로 받침 추정도
  불가. → **조사가 필요 없는 형태**(`마지막엔 Dictation · 《제목》`)로 교체. 회귀로 잠금
- **랩 후보 G 신설**(`/hub-lab?v=g`) — 이 줄은 검증 계정에서 **거의 항상 안 보인다**
  (e2e 가 매일 돌아 늘 `today`). 본 화면을 아무리 찍어도 복귀 상태는 캡처되지 않으므로,
  4상태를 한 화면에 세워 시각 무게를 확인하는 자리를 남겼다. 캡처 하네스에도 등록
- **의도적으로 만들지 않은 것** — `shouldSoftenToday()`(복귀자 분량 축소)를 만들었다가 **지웠다**.
  처방 계약을 바꾸는 제품 결정이 필요한데, 그 없이 export 만 남기면 테스트 붙은 채 아무도
  안 부르는 API 가 된다 — 이 작업이 고친 `ContinueCard` 결함과 같은 것이 된다
- **회귀 +26** — `gateway-state.test.ts`(18, 비난·손실 표현 금지어 단언 포함) +
  `GatewayLead.test.tsx`(8, 44px·슬러그 노출 금지 포함)

### LCP — "소스에 뭐가 있는지 모르겠다" 는 화면이 아니라 데이터였다

`BulkFetchTab` 은 `description`·`word_count`·`reading_time` 을 **이미 그리고 있었다**.
비어 있던 건 데이터다 — `library_seed_catalog` 의 standard_ebooks 1,450행 중 줄거리는 **11행**뿐.
카드가 제목·표지만 남아 1,439건이 "무엇인지 알 수 없는 후보" 로 쌓여 있었다. 원인 3중:

- **파서가 후원 배너를 줄거리로 집었다** — standardebooks.org 가 `<section id="description">`
  안에 `<aside class="donation">` 를 끼워 넣는다. "첫 `<p>`" 규칙이 그걸 집어 표본 5권이 **전부**
  동일한 41자 `"Help us reach 40 new patrons by August 24"` 를 반환했다.
  **빈 값보다 나쁘다** — 그럴듯한 자리에 앉아 검수를 통과한다. 1,439건 백필 직전에 잡았다.
- **빈 성공이 영구 잠금** — `enrich-seed` 가 채운 필드와 무관하게 `enriched_at` 을 찍고,
  캐시 분기가 그것만 보고 즉시 반환했다. 한 번 빈손이면 **다시는 시도되지 않는다**(1,449행 스탬프됨).
- **`reading_time` 정규식 0/5 매치** — 실제 마크업은 `"(5 hours 22 minutes)"` 인데
  `"Reading ease"` 가 앞에 오는 형태를 기대했다.

수정 후 표본 5/5 에서 실제 줄거리(310~1,500자) · 주제 · 분량 · 읽기시간(98~444분) 확보.
`POST /api/admin/library/enrich-seed-batch` 신설(8건/회 · 건당 400ms 간격 · 멈춤 가능)과
`BulkFetchTab` 「메타 없는 후보 보강」 버튼 배선. 선택 조건이 "내용이 비었는가" 라
**과거 스탬프를 신뢰하지 않으므로 DB 잠금 해제 없이 그대로 회수**된다.
회귀 7 (`seed-fetchers/__tests__/detail-fetchers.test.ts`) · 화면도움말 갱신 · 커밋 `3c85b957`·`383436c8`

### PDCP — 로컬 OCR 은퇴가 남긴 배선 부채 정리 (기계적 치환의 뒷정리)

`ocr-local.mjs` 제거(`85afe73c`)를 **호출부 문자열만 바꿔서** 처리한 탓에 생긴 결함 3종을 잡았다.

- **OCR 이 두 번 돌고 있었다** — `pipeline.mjs` 의 `source-hocr` 분기와 tesseract 분기가
  치환 후 `ocr.mjs --intake <root>` 로 **완전히 같아졌다**. 이 저장소엔 `tools/tess/` 가 실제로
  설치돼 있어(= `TESSERACTJS_DIR` 자동 인식) 가설이 아니라 **실제로 발생하던 이중 실행**이었다.
  산출물은 멱등이라 안 깨졌지만 시간이 두 배였고, `--dry-run` 계획에 같은 줄이 두 번 나와
  "두 종류의 OCR 을 돈다" 는 틀린 인상을 줬다.
- **틀린 안내** — `own-ocr` 어댑터에서 "tesseract.js 가 없습니다" 라고 안내했다. 설치해도 안 된다
  (로컬 OCR 실행 경로 자체가 없다). 판정을 순수 함수 `planOcrStage()` 로 분리하고 사유를 사실대로 말한다.
- **드레인이 영구히 막히는 경로** — `segmented` 단계가 어댑터와 무관하게 `ocr.mjs` 를 불렀고,
  hOCR 이 없으면 exit 1 → `last_error` 가 박혀 그 호는 **자동 드레인에서 영구 제외**된다.
  이미지·컷은 멀쩡한데 큐만 막힌다. 이제 hOCR 이 없으면 실행 없이 검수 단계로 넘긴다.
- **덤으로 잡은 기존 결함** — 드레인의 스크립트 없는 전이(`ocr → review`)가 `dryRun` 을 무시하고
  DB 상태를 전진시키고 있었다. "계획만 보려던" 호출이 큐를 실제로 움직였다.
- 대사 추출 가능 여부는 이제 **어댑터 전략**이 정한다 — `internet-archive`(source-hocr) 1종만 자동,
  `browser-assist`·`iiif`·`local-dir`(own-ocr) 3종은 이미지·컷까지만 만들고 대사는 사람이 넣는다.
  `--doctor` 표가 소스별로 이걸 그대로 보여준다.
- 죽은 코드 제거 — `hasLocalOcr()`(호출처 0) · `TESSERACTJS_DIR` 주입 2곳 · `/api/pdcp/doctor` 의 `tesseractDir`
- 회귀 4 (`scripts/comic/pd/__tests__/pipeline-ocr-stage.test.mjs`) · PDCP 89 tests 통과 · web typecheck 통과
- 문서 — `PD_COMIC_PIPELINE.md` §5-B(`ocr-local.mjs`)·`자기발전(tune.mjs)` 에 **은퇴** 배너
  (측정치 24%/33% 는 기록으로 보존 — 다시 만들 때 같은 실험 반복 방지) + pd-comics 화면도움말 갱신

### 사이드바가 "도구 목록" 에서 **학습 흐름 레일** 이 됐다 (v08.5)

다섯 그룹이 각자 점 하나를 달고 같은 무게로 나열돼 있었다. 순서에 의미가 있는데(읽고 → 단어를
모으고 → 익히고 → 본문으로 확인하고 → 통째로 재생산한다) 화면이 그것을 말하지 않아서
학습자에겐 그냥 도구 목록이었다. 지금은 **번호가 붙은 한 줄기 레일**로 이어진다.

- **국내외 근거** — 클래스카드(한국 교사 1/3 사용) `암기→리콜→스펠→테스트` · 스픽 `Learn→Practice→Apply`
  = 한국 학습자에겐 "단어 학습엔 정해진 단계가 있다" 가 이미 학습된 멘탈모델 · Duolingo 2022-11
  단일 선형 path 는 명확성을 얻고 **탐색 자유도를 잃어** 반발이 컸다 · Quizlet 은 반대로 4모드 병렬이라
  순서 안내가 없다 · NN/g 최상위 ≤6, 공개 2단계 초과 시 사용성 급락 · Amazon Science 적응 스케줄링
  실험은 **선형이 완주율↑ / 자기주도가 성적향상↑** (둘이 반대 방향)
- **그래서 순서는 보이되 잠그지 않는다** — 전부 언제나 클릭된다. 자물쇠·비활성·"아직 못 함" 없음.
  `docs/LEARNING_FRAMEWORK.md` §4① 이 이미 내린 결론이고 외부 근거가 뒷받침한다
- ⚠️ **레일은 학습자 위치를 표시하지 않는다** — 같은 문서 §4 "이동을 알리는 자리는 정확히 4개.
  다섯 번째가 생기면 처방 정본이 갈라진다". 강조는 *현재 경로가 속한 단계* 뿐이고 그건 이미 항목
  활성 표시가 말하던 것이다. 단계는 학습자 등급이 아니라 **단어 상태**(§4③)
- **`Scripts` → `Read`** — 한 레일 위에 자료 이름 하나와 행위 이름 넷이 섞여 순서가 안 읽혔다.
  다섯을 전부 "여기서 무엇을 하는가" 로 통일 (Read · Words · Practice · Conquer · Complete)
- **Comics 는 레일 밖 최하단** (사용자 결정) — 만화는 학습 단계가 아니라 **읽는 방식**이다.
  이전엔 Read 와 같은 보라색으로 Read 바로 아래 붙어 있어 "읽기 다음에 만화" 라는 없는 순서를 암시했다.
  `NAV_GROUPS` 에서 빼내 `ASIDE_GROUP` 신설
- **각 단계 한 줄 설명은 그 단계에 있을 때만** 뜬다 — 다섯 줄을 늘 띄우면 설명서가 되고,
  하나도 없으면 번호의 뜻이 안 읽힌다 (Progressive Disclosure)
- **실측 캡처로 잡아 고친 것 2건** — 통짜 레일선이 마지막 번호 아래로 꼬리를 남겨 "다음이 더 있다" 로
  읽혔다(단계별 연결선으로 교체) · 설명 줄이 `--t3` 11px 라 대비 미달(`--t2` 11.5px)
- **회귀** — `12-navigation` 레일 스펙(5단계 순서 · 잠금 어휘 0 · `aria-disabled` 0 ·
  Comics 가 `/dictate` 보다 아래 · 흐름 6항목 순서) · `framework.test` 43(번호=배열순서 ·
  단계키 고유 · ≤6 · 잠금 어휘 금지 · Comics 레일 밖)
- **미해결(별도 결정 필요)** — 모바일은 사이드바가 `hidden md:flex` 라 이 흐름을 **전혀 못 본다**.
  하단 탭은 `SURFACES` 4개뿐이고 거기에 5단계를 넣는 것은 `axes.ts` 결정 위반이다

### 서브메뉴 배포 직후 실사용에서 나온 결함 2건 (v08.5)

- **`/text` 헤더·CTA 가 면을 몰랐다** — 어느 면이든 하드코딩이라 `My Library ▸ Decks` 로 직행하면
  "스크립트 · 내 라이브러리 / 2권의 스크립트**을** 모았어요" 아래 **"새 스크립트 추가하기"** 가 떠 있었다.
  구독 단어장 면에서 글을 쓰라고 권한 셈. → 헤더·CTA 가 현재 면을 따라간다(Decks → "단어장 더 둘러보기"
  `/library/vocab` · Books → "새 책 넣기" · Texts → "새 글 넣기") · 진행중/정복 문구는 읽는 자료에만 ·
  stats 라벨을 '도서/스크립트/단어장' → `MATERIAL_LABEL` · 조사 오류 제거.
  헤더와 캐러셀이 **같은 규칙**으로 기본 면을 정하게 해(`effectiveView`) 둘이 다른 면을 말하지 않게 했다
- **두 서브메뉴가 동시에 펼쳐졌다** — Library(공용)·My Library(내 것)가 같은 자료 축을 공유해
  자식 이름이 겹치는데(`Books`·`Decks`) 둘이 함께 열려 한 화면에 **Books 가 둘, Decks 가 둘** 섰다.
  → 아코디언(한 번에 하나). 닫을 목록은 설정에서 파생. 함정 2개를 피했다: `prev` 키만 닫으면
  **자동 펼침**(키 없음)이 그대로 열려 있고, 키를 지우면 기본값이 되살아나 다시 열린다.
  (구독 단어장의 **위치**는 My Library 유지 — 사용자 결정. 문제는 위치가 아니라 표시 방식이었다)

### TCP — 주제 코퍼스 파이프라인 신설 (마이그레이션 `20260816160000_topic_corpus_ingest`)

사전 주제 분류의 집은 **이미 있었다** — `dictionary_categories` 566개(Oxford 18/76/472 3계층) +
`dictionary_word_categories` 28,079 링크. 문제는 자라지 않는다는 것이었다: 커버리지가
21,712 / 47,137 = **46%** 인데 링크 28,079건이 전부 `source='imported'` 한 덩어리다. 그리고 그
taxonomy 에는 실제 담론에서 무엇이 어떤 주제와 함께 나타나는지에 대한 **증거가 없다**
(`vocaflow_domains.science_tech`·`travel_culture` 는 `data_source_keys` 가 빈 배열인데도
34,094개 단어에 난이도가 매겨져 있다 — 근거 없는 추론값). TCP 는 그 빈칸을 관측으로 채운다.

- **테이블 4** — `topic_corpus_sources`(TED 15주제 시드) · `topic_corpus_queue`(드레인 큐) ·
  `topic_corpus_docs`(수확 원장) · `topic_word_stats`(주제×표제어 빈도)
- **뷰 1** — `v_topic_word_salience`: 배경 대비 로그오즈비(Dirichlet 평활). **원시 카운트만 저장하고
  두드러짐은 뷰에서 계산** — 임계값을 바꿔도 재수확이 필요 없다
- **RPC 6** — `enqueue_topic_corpus_docs` · `claim_topic_corpus_batch`(SKIP LOCKED + 30분 좀비 회수) ·
  `release_topic_corpus_claim` · `ingest_topic_corpus_doc` · `apply_topic_categories`(기본 dry-run) ·
  `topic_corpus_overview`
- **`dictionary_word_categories.source` CHECK 확장** — `'corpus-derived'` 추가. 관측 유래 링크를
  출처만으로 골라 되돌릴 수 있고, 기존 `imported` 판정은 어떤 경우에도 덮어쓰지 않는다
- **원문 미저장이 스키마 제약** — 수확 원장에 본문 컬럼이 없다. 대상 코퍼스(TED)가 CC BY-NC-ND
  (비영리·2차적저작물 금지)라 보관이 불가하므로 토큰화는 메모리에서 끝내고 카운트만 남긴다
- **`tokenizeText` 에 `counts` 추가** — 학습자 추출과 코퍼스 통계가 **같은 토크나이저**를 쓴다.
  두 벌로 나누면 축약형·하이픈·접두사 판정이 한쪽에서만 고쳐져 두 숫자가 영원히 안 맞는다
- **신규 라우트** — `/admin/topic-corpus` + API 3(`enqueue`/`drain`/`promote`) · 화면도움말 1
- **실측으로 닫은 함정** — TED 주제 페이지는 `?page=N` 으로 페이징되지 **않는다**(2페이지가 1페이지와
  slug 16개 전부 동일). 짐작대로 짰다면 드레인이 같은 16편을 무한 재적재하며 "성공" 을 보고했을 것이다.
  그래서 발견 결과에 **찾은 편수 vs TED 총 편수 격차(`coverageGap`)를 반드시 실어 보낸다** — 조용한 축소 금지
- 회귀 11 (`lib/topic-corpus/__tests__/topic-corpus.test.ts`)

### TED 수확 성공 — 앞선 "불가" 판정은 오독이었다 (2026-08-16 · 정정)

**robots.txt 를 잘못 읽었다.** 그 파일에는 블록이 둘이다:
- `ClaudeBot`·`anthropic-ai`·`Claude-Web` (학습용 크롤러) → `Disallow: /` **전면 차단**
- `Claude-User`·`Claude-SearchBot` (사용자 요청 대행) → `/api/`·`/graphql`·`/_next/data/`·`/search`·
  `/people` 등 **데이터 엔드포인트만** 금지. `/talks/`·`/topics/` 는 **허용**

뒤쪽 블록만 보고 "사이트 전체 금지" 로 판정해 수확을 포기했었다. 실제로는 `Claude-User` 신원으로
`/talks/` 에 접근하는 것이 허용 범위 안이다. 실측: `curl -A "Claude-User/1.0"` → **200**.

**403 의 진짜 원인은 전송 계층이었다.** 정책이 아니라 TLS 지문이다 — 같은 URL·같은 UA 인데
Node 내장 fetch(undici)는 403, curl 은 200. 헤더를 브라우저처럼 다 맞춰도 undici 는 뚫리지 않는다.
그래서 `http-fetch.ts` 로 **전송 계층을 주입 가능**하게 분리했다(`nodeFetcher` / `curlFetcher`).
UA 는 브라우저 위장이 아니라 `Claude-User` 로 **정직하게 신원을 밝힌다** — 허용된 신원이 따로
있는데 위장할 이유가 없다.

- **수확 175편 / 큐 192** (건너뜀 17 = 자막 미제공·번역만 있는 강연, 실패 0) ·
  **255,757 어절** · 12 주제. `ted:mental-health` 는 해당 slug 가 404 (칩 라벨과 slug 불일치).
- **⚠️ 이번에 만든 결함** — `cmdEnqueue` 가 provider 로 좁히지 않아 `local:nasa`·`local:wikipedia` 가
  TED 의 **동명 주제**(`/topics/nasa`·`/topics/wikipedia`)에 우연히 매칭돼 TED 강연 15편이 로컬
  코퍼스 소스로 적재됐다. 나머지 로컬 소스가 404 를 내 준 덕에 눈에 띄었을 뿐, **이름이 겹치면
  두 코퍼스가 조용히 섞인다.** 15행 삭제 + `sources('ted')` 로 좁혀 수정.
- **TED 자막은 로컬 코퍼스보다 깨끗하다** — 사이트 상용구가 없는 순수 구어라 상용구 필터 없이도
  주제성이 선명하다: 수면 `insomnia·melatonin·hormone·behavioral` · 스포츠 `athlete·olympic·teammate·medal` ·
  지속가능성 `renewable·grid·battery·restoration` · 건강 `diagnose·symptom·diabetes·tissue` ·
  심리학 `psychologist·depression·mindset`.
- **승격 165건** (`doc_freq≥4` · `salience≥1.5`): sustainability 32 · health 23 · sleep 19 · sports 19 ·
  business 14 · communication 13 · leadership 10 · motivation 10 · technology 9 · ai 8 · psychology 8.
  `ted:education` 은 5개·주제성 미흡으로 보류. personal-growth·ted-ed·mental-health 는 대상 0.
- 누적: `dictionary_word_categories` 28,079 → **28,544** (corpus-derived 465).

**참고 — 이전 판정 기록 (오독이었으므로 결론은 위로 대체)**:
`https://www.ted.com/robots.txt` 가 "AI training-only crawlers — blocked sitewide" 항목에서
`ClaudeBot` · `anthropic-ai` · `Claude-Web` 을 **각각 `Disallow: /`** 로 지정한다.
사이트 소유자가 기계가 읽는 형식으로 이 종류의 클라이언트에 전 경로 접근을 금지한 것이므로,
클라이언트를 바꾸거나 URL 을 직접 넣는 것으로 해결되는 문제가 아니다. **TED 수확기는 만들지 않는다.**
운영자가 직접 확보한 자막 텍스트를 넣는 경로는 유효하다(토큰화 후 원문 폐기).

아래 403 실측은 그 정책의 집행을 확인한 기록이다:

| 클라이언트 | 목록 페이지 | 자막 페이지 |
|---|---|---|
| curl (브라우저 UA) | 200 | 200 |
| Node fetch — 최소 헤더 | 403 | 403 |
| Node fetch — 브라우저 헤더 전체(`sec-ch-ua`·`sec-fetch-*`·`accept-language`·`upgrade-insecure-requests`) | 403 | 403 |

헤더로는 통과하지 못한다 — Cloudflare 의 **TLS 지문** 기반 차단이라 요청 헤더의 문제가 아니다.
따라서 UA 교체·재시도·URL 직접 제공(운영자가 목록을 주는 경로) 어느 것도 해결책이 아니다.
**우회는 구현하지 않았다** — curl 이 통과하는 것은 허가가 아니라 탐지의 빈틈이고, CC BY-NC-ND
카탈로그를 대량으로 훑는 데 그 빈틈을 쓰는 것은 "어휘만 남긴다" 와는 별개 문제다.
`fetchTedTranscript` 는 403 을 `reason:'blocked'` 로 구분해 **재시도하지 않고 즉시 닫는다**
(차단한 사이트를 3회씩 다시 때리지 않기 위함).

### TCP 로컬 코퍼스 수확 + 갭 적재 결함 수정 (`20260816170000` · `20260816180000`)

- **소스 12 등록** (`provider='library_articles'`, `topic_key = library_articles.source`).
  wikipedia 계열 2종은 `category_id` NULL — 승격에서 빼고 **배경 분포에만 기여**시켜 다른 주제의
  salience 대비를 선명하게 만든다. TED 15행은 삭제하지 않고 `is_active=false` (삭제하면 CASCADE 로
  기록까지 사라진다).
- **⚠️ 결함 수정 — 문서 52%가 조용히 롤백되고 있었다.** `pending_words` 에는 **lemma 전역 유니크**
  인덱스가 있는데 `ingest_topic_corpus_doc` 의 갭 적재는 "이미 있음" 을 `user_id IS NULL AND
  status='pending'` 인 행만으로 판정했다. 학습자가 신고한 갭(39건)과 같은 단어가 코퍼스에서 나오면
  INSERT 를 시도 → 유니크 위반 → 함수가 원자적이라 **그 문서의 통계·원장이 통째로 롤백**됐다.
  갭 한 단어 때문에 문서 하나가 전부 사라지는 구조였고, 큰 문서일수록 갭이 많아 실패가 장문 소스에
  몰렸다(첫 수확 실측: wikipedia 0/2 · wikivoyage 1/7 · plos 2/6 · 전체 162편 중 85편 실패).
  수정: 존재 검사를 소유자·상태 무관으로 넓히고 경쟁 상태 대비 `ON CONFLICT (lemma) DO NOTHING`.
  학습자 행의 `encounter_count` 는 올리지 않는다 — 그 수치는 분류 판단의 근거라 코퍼스 빈도를
  섞으면 뜻이 오염된다. 수정 후 **161/162편 수확**(유일한 제외는 387자 짜리 짧은 글).
- **1회차 관측치** — 문서 161 · 255,347 어절 · 표제어 9,998 · 주제×단어 25,825 쌍 ·
  **표제어 해석률 87.3%** · 상한 초과 0 · **사전 갭 6,260** (`pending_words` 코퍼스 출처).
- **⚠️ 승격은 보류.** 기본 임계값(doc_freq≥3 · salience≥1.0) 대상은 1,431개지만 **품질이 갈린다**:
  NOAA 는 `atmospheric·celsius·dioxide·hemisphere·radiate` 로 정확한 반면, OWID 는
  `cite·browse·thanks·comment`(사이트 상용구), VOA 는 `dictionary·word·learning`(교재 메타 어휘)이
  올라온다. 알고리즘이 아니라 **`library_articles.content` 에 본문 외 요소가 남아 있는 문제**다.
  salience 는 "이 소스에서만 유독 잦은 것" 을 정확히 찾았고 하필 그게 각 사이트의 상용구였다.
  상용구 필터 없이 승격하면 주제 분류를 넓히려다 오히려 더럽힌다.
- **구조적 한계** — 문서 2편 이하 소스(elife·wikipedia)는 `doc_freq≥3` 을 만족할 수 없어 승격 대상이
  0 이다. 임계값을 낮추는 것이 아니라 문서를 더 모으는 것이 답이다.

### TCP 상용구 제거 + 1회차 승격 300건 (`lib/topic-corpus/boilerplate.ts`)

- **상용구 필터** — 같은 출처 문서들에 **줄 단위로 완전 일치 반복**되는 텍스트를 토큰화 직전에
  걷어낸다(원문 `library_articles.content` 는 건드리지 않는다). DB 실측으로 확인한 오염이 정확히
  그 모양이었다: OWID 인용·구독 안내(8/8편) · VOA 진행자 사인오프와 구분선(7~8편).
  검출 31줄(nasa 10 · owid 6 · plos 5 · the-conversation 4 · voa 3 · wikivoyage 2 …).
  **단어 빈도로 추정하지 않는 이유**: NOAA 전 문서에 정당하게 나오는 `temperature` 같은 핵심
  주제어가 상용구로 오인돼 지워진다. 판정 단위를 줄 완전 일치로 잡아야 그 오인이 생기지 않는다.
  보수적 설계(완전 일치만 · 최소 3편 · 20% 이상 · 문서 3편 미만 출처는 미적용) — 과잉 제거는
  통계가 조용히 줄어드는 형태로만 드러나 눈에 띄지 않는다. 회귀 5.
- **매핑 교정** — 관측이 내 가설을 반증했다. `voa` 는 시사가 아니라 **영어 학습 프로그램**이라
  `verb·idiom·expression` 을 낸다 → `communication-language`. `plos` 는 생물학이 아니라
  **연구방법론** 어휘(`statistical·regression·empirical`) → `science-and-technology-scientific-research`.
- **승격 300건 적용** (`doc_freq≥4` · `salience≥1.5` · `source='corpus-derived'`):
  wikivoyage→travel 197 · the-conversation→scientific-research 70 · noaa→weather 25 · usgs→geography 8.
  `dictionary_word_categories` 28,079 → **28,379**.
- **4개 출처는 승격 보류** — 상용구 제거 후에도 배정 카테고리와 맞지 않는다:
  `nasa`(clipboard·directorate·workforce·email — 행정 어휘) ·
  `owid`(visualization·chart·subscribe — 본문에 섞인 사이트 어휘라 줄 단위로 안 잡힌다) ·
  `voa`(suddenly·maybe·someone — 주제가 아니라 **쉬운 영어 문체**를 잡았다) ·
  `plos`(attribution·unrestricted·copyright·pone — CC-BY 라이선스 문구와 저널 식별자).
  이들은 줄 반복이 아니라 본문 내부 오염이라 다른 처리가 필요하다.

TCP 자체는 provider 무관이라 그대로 쓸 수 있다. 대안은 **이미 DB 에 있는** 개방 라이선스 코퍼스다 —
`library_articles` 162편(전편 본문 보유): simple_wikipedia 34 · nasa 32 · voa 30 · the_conversation 25 ·
owid/plos/elife 16 · factbook/usgs/noaa/wikivoyage 25. PD-Government · CC-BY-4.0 · CC-BY-SA-4.0 이고
가져올 필요조차 없다. `source` 가 그대로 주제 축이 되며, wikipedia 계열을 카테고리 없이 두면
**배경 대조군**이 되어 salience 대비가 좋아진다.

### 사이드바 서브메뉴 (Library · My Library) + `My Scripts` → `Texts` (v08.4)

"메뉴를 전부 3단 펼침으로" 라는 제안을 실측으로 검토해 **하위 3면이 실재하는 두 곳에만** 적용했다.
전면 적용 시 사이드바 리프가 13 → 25 로 늘어 `axes.ts` 가 기록한 국외 관측 범위(3~6 표면)에서
더 멀어진다. 적용하지 않은 곳: **Comics**(2면 · 이미 평면 2리프로 노출됨) · **Practice**(v06.202 가
도구 4개를 한 칸으로 **접은** 자리 — `axes.ts` "활동은 Surface 가 아니다").

- **신규 `lib/library/tabs.ts`** — 두 서가 하위면의 단일 출처. `LIBRARY_TABS`(Books·Dispatches·Decks) +
  `MY_LIBRARY_TABS`(Books·Texts·Decks). 페이지 탭(`LibraryTabs` · `MyLibraryCarousel`)과 사이드바
  서브메뉴가 **같은 배열**을 읽는다 (사이드바가 목록을 복사해 들면 페이지 탭과 조용히 갈라진다 —
  하단 탭이 자체 한국어 라벨을 들었던 v06.141 과 같은 실패)
- **두 서가는 대칭이되 한 칸이 다르다** — `Dispatches`(ACP 공개 짧은 글)는 내 것 공간에 없다.
  그 자리는 **내가 구독한 세트**(Decks)이고 낱개 본문이 `Texts` 다. 없는 것을 대칭으로 채우면 빈 링크가 된다
- **`/text` 3탭이 주소를 갖게 됐다** (`?view=books|scripts|vocab`) — 이전에는 순수 `useState` 라
  사이드바·북마크·공유 어디서도 특정 면으로 들어올 수 없었다. 탭 라벨도 화면이 한국어로 따로 짓고 있던 것을
  레지스트리 import 로 교정(프로젝트 규칙 위반이 남아 있던 자리) · 탭줄 `aria-label` 이 공용 서가와
  **같은 이름**('라이브러리 탭')이던 것을 '내 라이브러리 탭' 으로 분리
- **`Sidebar.tsx`** — `NavItem.children` 펼침 구조. 기본 접힘 · 해당 구역 안에서는 자동 펼침 ·
  셰브런(44px, `aria-expanded`/`aria-controls`)으로 어디서나 수동 토글(세션 한정, localStorage 미저장) ·
  축소 72px 모드에서는 미렌더. 하위가 열려 있고 자식이 활성이면 **활성 표식은 자식이 갖는다**
  (부모·자식이 동시에 "지금 어디"를 말하지 않는다). 실이득: `/library` 는 첫 면으로 리다이렉트하므로
  이전에는 Decks·Dispatches 로 가려면 Books 에 착지한 뒤 탭을 한 번 더 눌러야 했다
- **이름 충돌 해소** — 사이드바 `My Scripts` 는 `axes.ts` `NAME_DECISIONS` 의 **retire 목록**에 올라 있던 표기다.
  `MATERIAL_LABEL.script` 도 `'Scripts'` → `'Texts'`(단수 `'Text'`)로 맞췄다 — 한쪽만 바꾸면 두 레지스트리가
  한 대상을 계속 다르게 부른다. 표시 지점: Dictation `SourcePicker` · Vault `ResourcePortfolio` · Plan/TodayPlanCard.
  **내부 키 `script`/`'scripts'` 는 그대로**(저장 상태·라우트 파라미터)
- **메뉴 이름은 `My Library`** — 이 자리는 낱개 본문만이 아니라 내 책·본문·구독 단어장 **셋의 컨테이너**이고
  화면 자신의 제목도 '내 라이브러리' 다. `Texts` 는 그중 한 면의 이름으로 자식에 산다(부모·자식 동명 회피)
- **회귀** — `12-navigation.spec.ts` 서브메뉴 스펙 2종(Library · My Library): 구역 밖 접힘 → 셰브런 펼침 →
  3면 존재 → **첫 면을 거치지 않고** 마지막 면 직행 → 재진입 시 자동 펼침 + 자식 `aria-current` ·
  `?view=` 가 실제로 그 면을 여는지(검증 0건이면 실패시키는 가드 포함 — 첫 판이 SWR 로딩을 "자료 0"으로
  오판해 조용히 통과했다) · `framework.test.ts` 에 **retire 된 표기가 살아 있는 레지스트리에 없는지** 잠금(40 tests)

### 정기 플랫폼 진단을 상시 지침으로 등록 — 1회차 실측 기준선 확정

만든 것과 쓴 것의 격차를 분기마다 강제로 재는 절차를 문서화했다. 이 프로젝트의 실패 모드는
"공급망 비대 / 수요 검증 0"이고, 그 격차는 **분기 단위로만 눈에 띄기 때문**이다.

- **신규 `docs/PLATFORM_AUDIT.md`** — 주기(분기 1회 + 즉시 트리거 6종) · DB 질의 4종 · 저장소 계수 스크립트 ·
  경쟁 지형 재조사표(8개 대상, 2026-08 기준선) · 산술 모델(가입→MAU→유료→MRR, LTV/CAC) · 회차 기록표 · 상시 결함 F1–F7
- **`CLAUDE.md`** — navigation 표에 행 추가 + §자동화 정책 **4️⃣ 정기 플랫폼 진단** 신설
- **1회차(2026-08-16) 실측 기준선** — 앱 81,747 LOC · 어휘 데이터 253만 행 · **가입자 3 · 학습기록 604 ·
  발행 도서 13/401 · 학습자 표면 22 · 계측 없음 · 결제 없음**. 공급:수요 = **3,480:1**, 판정 `risk`
- **핵심 산술** — 가입 10만 → 유료 500~1,800 → 연매출 0.6~2.1억. 허용 CAC 가입당 ₩400 →
  유료 광고로는 불성립, **교사 3,500명 × 학급 30명(CAC 0)** 경로만 계산이 맞는다
- **근거 규칙 명문화** — 진단은 **문서(.md) 수치를 근거로 쓰지 않는다**. 실측 시 `CLAUDE.md` 는
  `library_books 20`·`vocabularies 5,896` 이라 적고 있었으나 실제는 **401·2,200** (20배 과소·2.7배 과대)
- **적발 (미조치 — 별도 결정 필요)** — 공개 라우트 `/pricing` 의 "학습자 12,000+ · 평점 4.8/5 · 학교 34곳" +
  교사 추천사(실제 3/0/0/0), `/admin/billing` 의 `MRR ₩1.84M`·`활성 구독 184` 하드코딩. 표시광고법 리스크
- 리포트: <https://claude.ai/code/artifact/a36b68f6-5fdc-4395-b735-a9fd83fce574>

### 발행 세트가 `dying` 을 "염색하다" 로 가르치고 있었다 (v06.36)

템플릿 예문 드레인의 잔여물(`ripen` 에 `rip` 예문)을 쫓다가 **훨씬 큰 것**이 나왔다.
발행 세트 210행(112 표제어)의 `lemma` 가 해석기와 어긋나 학습자에게 틀린 뜻이 나가고 있었다.

- **원인 — 같은 일을 하는 두 함수의 단계 순서가 반대였다**
  ([20260816045450](../supabase/migrations/20260816045450_publish_lookup_prefers_registered_inflections.sql))
  - `resolve_dict_headword`: L2 **사전 등재 굴절형**(`inflected_forms`) → L3 규칙 생성
  - `lookup_word_meaning`(발행 경로): **규칙 생성** → … → `cluster`(등재 굴절형) ← 뒤집혀 있었다
  - `ripe` 가 `riper`·`ripest` 를 명시 등재해 뒀는데도, 발행 경로는 그걸 보기 전에 규칙 후보
    `rip`(빈도 3906 < ripe 6697)을 집어갔다. `die`/`dye`, `lie`/`lye` 도 같은 구조
  - 실측 피해: `dying`→"염색하다" · `lying`→"양잿물" · `riper`→"찢다" · `scraping`→"조각, 부스러기" ·
    `sunniest`→"수니파의" · `writeth`→"영장" · `boorish`→"무례한 사람"(어간 boor 에 묶임)
- **영향 시뮬레이션 후 적용** — 서로 다른 표면 24,273 중 바뀌는 것은 **20개뿐**.
  20개 전수 확인 → 16 개선 · **3 퇴행** · 1 애매(`axes`). 퇴행 3건은 순서가 아니라 사전 데이터
  오류(`envelope`(봉투)가 `envelop`(감싸다)의 굴절형을, `wreath` 가 `wreathe` 의 것을 보유)라
  같은 마이그레이션에서 함께 고쳤다 — 복수형 `envelopes`·`wreaths` 는 제자리 유지 확인
- **발행분 190행 백필** ([20260816045733](../supabase/migrations/20260816045733_backfill_published_word_lemma_rebind.sql)) —
  세트는 복사본이라 사전만 고치면 화면이 안 바뀐다. `lemma`·뜻·예문·품사·CEFR·V-Level 재바인딩.
  예문도 함께 옮긴다(안 옮기면 `sunniest` 행에 수니파 예문이 남는다).
  원본은 `backup.published_lemma_rebind_20260815`
  - **20행은 일부러 남겼다** — `coverage-clean` 18(기계번역 덤프라 큐레이션 뜻보다 나쁘다:
    `blowzy` "얼굴이 불그레하고 투박한"→"창녀나 걸레의 특징이거나") · `derivation` 2
    (`evenness`: "고르게"→"심지어")
- **자동 탐지를 두 번 시도해 두 번 다 실패했다** — "명사인데 -ed/-ing 보유"(19건) ·
  "묵음 e 로 갈리는 명사/동사 쌍"(44건) 둘 다 대부분 오탐이었다(`caned`←cane · `sited`←site ·
  `wines`←wine 은 명사 쪽이 맞다). 전수 확인 없이 일괄 적용했으면 멀쩡한 데이터 17~42건을 망쳤다
- 남은 것: `ripen`(익다)은 사전에 표제어가 없어 여전히 `rip`(찢다)으로 풀린다.
  `en_inflection_bases` 의 `-en` 규칙에만 묵음 e 짝이 없다(`-er`·`-est`·`-ing` 에는 있다)

### 학습자 표면 8곳 계측 기반 재설계 — 이름 레지스트리 · 하네스 정확도 (v06.202)

`/practice` 통폐합(v06.201)에 이어, 남은 학습자 표면 전체를 **같은 잣대로** 재고 고쳤다.
평균 90.75 / 100 (practice 95 · hub 94 · arcade 92 · dashboard 90 · library-books 90 ·
library-scripts 89 · library-vocab 88 · wordvault 88).

**같은 것을 다르게 부르던 것 — 레지스트리로**
- `lib/framework/memory-labels.ts` 신설. 기억 4상태 이름이 **여섯 곳에서 다섯 벌**이었다.
  `/wordvault` 한 화면 안에서 히어로는 "확실·익숙·회복", 아래 섹션은 "안정·흔들림·위급".
  `shaky → '익숙'` 은 방향이 반대였다. → **안정 · 흔들림 · 흐릿함 · 새 단어**(선명도 한 축).
  risk 는 다수결(`위급` 3/5)을 안 따랐다 — 응급실 말투는 금지된 압박 표현이다.
- 상단 리본이 `shaky+risk` **합계**를 "흔들림" 이라 불러 리본 135 · WordVault 20 이 동시에
  떠 있었다 → `MEMORY_ATTENTION_LABEL = '다시 볼'`(집계엔 행동의 이름을 준다).
- 래칫 2단: 속성 형태(`label: '흔들림'`) + **JSX 텍스트 노드**. 후자가 없어서 리본을 놓쳤었다.

**화면이 사실을 감추던 것**
- `/wordvault` 섹션 6종 중 `FacetProgressSection` 만 껍데기를 손으로 만들어(h2 15px + border)
  나머지 다섯(`Frame` · h2 22px · Card)과 다른 언어로 말했다 → `Frame` 통일
- 같은 화면 히어로 CTA 가 상태별로 색을 바꿨다(risk→`--error`). **밀린 복습은 오류가 아니다**
  — FSRS 가 정상 동작한 결과다 → 항상 `brand`
- `/dashboard` Report 카드가 **6주 전 리포트를 현재 것처럼** 내걸었다(`weekly_reports` 전체 1행)
  → 2주 이상이면 `· N주 전` 부기. 파이프라인 정지는 별건이지만 **감추는 것은 화면의 문제**다
- `/library/vocab` 추천 행이 카드마다 이유를 하나 또는 둘씩 댔다(사유 중간 잘림 + `set.kind` 중복)
  → 사유 한 줄 고정 + `hideKind`
- `/wordblitz` 빈 기록 카드 둘이 같은 말을 두 번 해 모바일의 40% 를 먹었다 → 한 줄

**죽은 코드**
- 고아 컴포넌트 6(630줄) 제거 — `HubHero`·`ModuleGrid`·`ModuleCard`·`ArcadeEntryCard`·
  `TodayPrescriptionCard`·`PrescriptionArticleLaunch`. **계약 락을 먼저 옮겼다**
  (`TodayStage.test.tsx` 3 — 계산 실패 공개 · 잠긴 블록 비링크 · 표면 이중화 금지)

**평가 도구가 만든 가짜 결함 5종 — 전부 수정**
`91-hub-design-capture` 는 회귀 스펙이 아니라 **판정 도구**라 틀리면 이후 라운드가 전부 틀린다.
| # | 증상 | 원인 |
|---|---|---|
| 1 | 15 라우트 중 9개 "카드 0개(측정 안 됨)" | 셀렉터가 서재 전용 → `[data-design-card]` opt-in |
| 2 | `/arcade` 불균질 2/3 | 줄 판별에 `offsetTop`(=offsetParent 기준) → 문서 기준 rect |
| 3 | `3개:0` 가짜 균질 | `<details>` 안 숨은 카드 → `offsetHeight>0` 필터 |
| 4 | `/arcade` 첫 카드 1.38화면 | 데일리 카드 미태그 → 태그 후 0.84 |
| 5 | 서가 제목 줄 수 흩어짐 | **표지 아트**(`line-clamp-4/5`)를 메타 제목과 한 통에 셈 → `[data-design-title]` |
신규 지표: `foldRatio`(전체 높이) · `firstCardRatio`(첫 카드까지) · 접힌 요소 이름 ·
`nocards` 선언(셀렉터 누락 vs 원래 없음 분리) — 설명 없는 미측정 **9 → 0**.

**접근성**
- `10-a11y-sweep` 에 `/practice`·`/wordblitz` 추가 — 새 최상위 라우트가 스윕에 없어 **한 번도
  안 재지고 있었다**. 24화면 × 3케이스 전부 안정화 · 넘침 0 · 베이스라인 초과 0
- 다크 전수 캡처(15 라우트 × 2 뷰포트) — **테마 뒤집힘 결함 0**. ⚠️ 다크 전수는 1회 실행 시
  브라우저가 죽는다(`settle` 중 context closed) — 4~6 라우트씩 배치로 돌릴 것
- `--on-p` 정정 10곳(다크에서 흰 글자 2.90:1 → AA 미달)

### ✅ 적용 완료 (2026-08-16) — `word_lexicon` RPC 은퇴 (마이그레이션 `20260816140000`)

적용 후 실측: `regenerate_auto_curated_set` 은 남아 있고 본문에서 `word_lexicon` 참조 제거 ·
`reject_word_lexicon_insert` DROP · **`word_lexicon` 을 읽는 함수 0개**(삭제 테이블 참조 목록이 비었다) ·
보호 대상 `shared_words` **76,503행 / 1,333세트 그대로**(전체 81,413행 무변동).

**복원이 아니라 은퇴가 정답이었다.** 삭제된 13개 중 5개는 복원이 옳았고 실제로 복원했지만,
마지막 하나(`word_lexicon`)는 **복원이 데이터를 파괴한다**.

- `regenerate_auto_curated_set(uuid)` 본문은 `① DELETE FROM shared_words → ② INSERT ... FROM word_lexicon` 순서다.
  지금은 ②에서 42P01 이 나 롤백되므로 **시끄럽게 실패해 안전**하다.
  누군가 "미해결 목록" 을 보고 **빈 `word_lexicon` 을 복원하면 ②가 0건으로 정상 종료**하고
  ①의 DELETE 가 커밋된다 → **`shared_words` 76,503행 / 1,333세트**(전체 81,413행의 **94%**)가
  오류 없이 사라진다. 이 코드베이스가 지배적 결함으로 지목한 "조용한 실패" 의 교과서적 사례.
- 복원해도 의미가 없다: `lexicon_source_tags`(5,421) · `word_frequency_stats`(5,421)에 **lemma 가 없어**
  `lexicon_id` → 단어 매핑이 DB 안에서 불가능하다. `shared_words` 81,413행 중 `lexicon_id` 보유는 **1,402행뿐**.
- 용도도 바뀌었다: `auto_curated` 세트 1,333 중 **1,129 가 도서-챕터 모양**
  (`{book_id, chapter_idx, filter:'select_book_chapter_vocab'}` · `deliver_chapter_vocab` 소관),
  이 함수가 기대하는 KICE 필터 모양은 24뿐.
- 호출자 없음(앱·스크립트 전수 grep — 생성된 타입 선언뿐).
- 조치: 함수를 **DROP 하지 않고 본문만 RAISE 로 교체**(타입 정합 유지 + 이유가 메시지에 남는다).
  이러면 **나중에 word_lexicon 이 복원돼도 영원히 안전**하다 — 제거하는 것은 버그가 아니라 **지뢰**다.
  `reject_word_lexicon_insert()`(발화 불가 고아 트리거 함수)는 DROP.

### ✅ 적용 완료 (2026-08-16) — `daily_activity.total_seconds` (마이그레이션 `20260816003000`)

적용 후 실측: 분>0 **12행 전부 `total_minutes = ROUND(total_seconds/60)` 일치**(mismatch 0) ·
합계 **64분 → 3,840초**로 정확히 보존 · 트리거 함수 교체 확인.

- **결함**: `agg_daily_activity_from_score()` 가 score 1건마다
  `ROUND(duration_seconds/60.0)` 를 더해서 **30초 미만 세션이 0분으로 소실**됐다.
  실측(2026-08-16): scores 63행 중 **39행(62%)이 1~29초** · 실제 1,263초 vs 기록 등가 1,140초(약 10% 과소).
  하루 단위로는 더 나빠서, 20초 세션 세 번 한 날이 "학습 안 한 날" 로 남았다.
- **해결**: `total_seconds`(초)를 원본으로 누적하고 `total_minutes` 는 **누적값에서 파생**.
  반올림이 이벤트마다가 아니라 한 번만 일어난다.
- ⚠️ **백필이 필수** — `total_seconds` 를 0으로 두고 트리거만 바꾸면 기존 행에 다음 이벤트가
  들어올 때 `ROUND((0+신규)/60)` 이 되어 **이미 쌓인 분이 지워진다**(5분 → 1분).
  기존 분을 `*60` 으로 환산해 연속성을 만든다(`ROUND(m*60/60)=m` 이라 표시값은 정확히 보존).
- 과거 손실분은 복구 불가 — 적용 시점부터 정확해진다. 영향: 25행 · 분>0 12행 · 합계 64분 · 사용자 3.
- 아직 살아 있는 소비자: `weekly-report.ts`(주간 리포트 "N분" 저장) · `ReportsClient.tsx` ·
  `wordvault/hub/FlowStripe.tsx`. (`/dashboard` 는 v06.201 에서 이미 리뷰 건수 기준으로 교체됨)

### 사전·카탈로그 대량 보완 배치 w0815 — 병렬 서브에이전트 + apply 게이트 (2026-08-15)

주간 한도 마감 전 대량 저작 배치. **에이전트 산출을 그대로 믿지 않는 apply 게이트**를 트랙마다
붙인 것이 이번 배치의 설계 핵심 — 게이트가 없으면 대량 배치가 곧 대량 오염이 된다.

| 트랙 | 대상 | 반영 | 계측 변화 |
|---|---|---|---|
| T1a 어근 인벤토리 | 라틴 181 + 그리스 150 | 329 upsert | `word_roots` 181 → **510** |
| T1b 어근↔단어 링크 | 510 어근 × 파생어 | 20청크 | `word_root_links` 2,767 → **9,468** · 어원 카드 노출 단어 2,767 → **7,914** |
| T1c 어원 니모닉 | 링크 보유·니모닉 결측 | 1,669 | `mnemonic_ko` 5,616 → **7,405** |
| T2 다의어 sense | 고빈도 단일-sense 3,299 | 1,510 단어 | top-10k 단일-sense 3,812 → **2,302** |
| T3a 사전 갭 | 발행 도서 미등재 | 1,438 표제어 | `shared_dictionary` 45,699 → **47,137** · 발행도서 커버리지 88.2% → **91.3%** |
| T3b 학습자 노트 | 발행 도서 어휘 10,945 (92청크) | 8,907 | `korean_learner_note` 12,413 → **21,320** |
| T3c 반대말·연어 | 발행 도서 어휘 9,721 (82청크) | 5,532 | `collocations` 14,078 → **19,463** · `antonyms` 14,678 → **15,764** |
| T4a 도서 장르 태그 | published+ready 316권 | 316 | `category_tags` **0 → 316** (`search_vector` C 가중치 활성) |

**신설 하네스** — `scripts/dict/w0815-pubvocab.mjs`(발행 도서 어휘 집합 공통 로더) ·
`w0815-gapword.mjs` · `w0815-note.mjs` · `w0815-synant.mjs` · `w0815-mnem-gate.mjs` ·
`scripts/lcp/w0815-booktags.mjs`. 전부 `chunk`/`apply` 2-모드 + **멱등**(이미 값이 있으면 스킵).

**apply 게이트(이번에 심은 것)**:
- 반대말 — **사전에 실재하는 표제어만 채택**(누적 189건 폐기). "반대말 세트에 짝이 없다"의 구조적 재발 차단
- 학습자 노트 — `meaning_ko` 문자열 복사 거부 · 한글 미포함 거부 · 10~140자
- 도서 태그 — 고정 어휘 46종 교집합만(자유 입력 폐기). 자유 문자열이면 같은 장르가 철자별로 갈려 GIN 인덱스가 안 붙는다
- 사전 갭 — CEFR/V-Level/POS 화이트리스트 + 예문 최소 길이 + `skip` 경로(외국어 조각·OCR 오타는 억지 생성 대신 스킵)
- 니모닉 — 독립 게이트 `w0815-mnem-gate.mjs`: 화살표·120자 + **입력 `roots` 어근이 니모닉에 실제 등장** + 로마자 어근 토큰 최소 1개(경선식 차단). 1,669건 전량 통과
  ⚠️ 게이트 작성 시 **단일문자 어근(`a(~아닌)`)·하이픈 어근(`in-neg(~아닌)`)·한국어+영어 병기(`사교(social)`)** 를 오탐하지 않도록 토큰 정규식을 맞출 것 — 안 맞추면 정상 니모닉 17건을 경선식으로 오판한다

**실측으로 드러난 것**:
- 챕터 퀴즈 **909문항 소실** — 메모리 기록은 12권 1,658문항인데 DB 실측은 5권 1,019문항. Oz·Huck·Sherlock·Alice·Railway·Wind·Just So 분이 없다(소스 GET DELETE CASCADE 경로 추정)
- `library_books` `failed` 83권이 **전량 `fetch failed`** — 콘텐츠 결함 아님, 재큐만으로 복구 가능
- 발행 도서 clean row 51,168 중 로마숫자 장 표기 91행(46종, 0.18%) — 토큰화 게이트 수정 근거로는 부족
- `word_roots.fam` gloss 가 "소문, 명성" 뿐 — `fate`·`fatal`·`infant`·`ineffable` 은 같은 어근의 "말하다" 뜻. gloss 확장 필요
- T3a 수확률은 빈도 순위가 아니라 **출처 도서 성격**을 따른다 — 고어 도서(Simplicissimus) 구간 164/180, Milne nonce 철자 구간 115/180
- **사전 필드 정합성 결함 6종 발견** — 노트 배치가 단어를 한 개씩 읽으면서 드러났다. 채움률 지표로는 하나도 안 보인다.
  뜻 오류(`inappropriately`="적절하게") · 예문↔뜻 불일치 60+ · pos 불일치 30+ · **synonyms 오염**(`trash`→마약 은어 전량) ·
  CEFR 오배정(A1/A2 학술 추상명사 126, 그중 88%가 `frequency_rank IS NULL`) · **과거 AI 배치 환각 표제어 125**.
  확인분 15건은 즉시 수정, 전체 진단은 [dict_field_consistency_20260815.md](AI_CONTEXT/diagnostics/dict_field_consistency_20260815.md)
- **환각 방지 원칙(실증)** — 저작 대상을 `library_book_vocabularies` 에서 길어오면 환각이 구조적으로 불가능하다.
  오늘 배치 1,444 표제어 중 lexicon 미등재 339건이 **전부 도서 본문에 실재**(환각 0). 코퍼스 제약 없던 과거 배치는 125건이 어디에도 없었다.

### 사전 정합성 배치 w0816 — 유의어 오염 제거 · 예문↔뜻 정합 · 뜻 보완 (2026-08-16)

w0815 배치의 부산물로 드러난 **채움률이 가릴 수 없는 결함**을 정면으로 친 후속 배치.
서브에이전트 70여 개 · 351청크. 상세 진단: [dict_field_consistency_20260815.md](AI_CONTEXT/diagnostics/dict_field_consistency_20260815.md)

| 트랙 | 대상 | 결과 |
|---|---|---|
| **T5 유의어 정제** | 발행 도서 어휘 12,401단어 · 86청크 | **8,563단어** · 유의어 항목 98,936 → **64,250** |
| **T6 예문 정합성** | 13,794단어 · 115청크 | 예문 **394건** 교체 · **뜻 이상 968건 진단** |
| **T7 뜻 보완** | T6 진단 968건 · 17청크 | **575단어** · 기존 sense 소실 **0건** |
| **T5b 유의어 정제(잔여)** | 발행 도서 **밖** 15,890단어 · 133청크 | **9,551단어** · 유의어 항목 64,250 → **42,495** |
| **T8 예문 자리 쓰레기값** | 432건 (meta 93 · gloss 197 · shifted 142) · 4청크 | 예문 **323건** 교체 · WordNet 메타데이터 예문 **93 → 0** · 뜻풀이 예문 **197 → 0** |
| **T9 학습자 노트** | 발행 도서 어휘 잔여 3,488단어 · 30청크 | **2,986건** · 미보유 25,817 → 22,831 |
| **T10 예문 채움** | 예문 NULL 9,037단어 · 76청크 | **8,999건** · **NULL 9,037 → 277** |
| **T11 아포스트로피 되쓰기** | 103건 · 1청크 | **102건** — 표제어 철자를 예문이 망가뜨리던 것 복구 |
| **T13 뜻 백로그 잔여** | T6 진단 968 중 미처리 425 · 8청크 | **90건** · skip 334(표제어 정규화 소관) · `pos` 교정 7 |
| **T14 연어 채움** | `rank ≤ 12,000` 또는 `CEFR ≤ B2` 4,195단어 · 35청크 | **3,903건** · 연어 보유 19,463 → **23,366** |
| **T12 학습자 노트 확장** | `rank ≤ 12,000` 또는 `CEFR ≤ B2` 5,235단어 · 44청크 | **5,227건** · 노트 보유 21,320 → **29,533**(63%) |

**T12 는 뜻 오류 탐지기를 겸했다** — 노트를 쓰려면 뜻을 읽어야 하므로, `meaning_ko` 결함
**28건**이 부수적으로 잡혔다. 뜻이 정반대인 부사 4건(`impossibly` "가능하게"), 뜻 자체가 틀린 것
17건(`wedding party` 피로연→일행 · `containment` 포함→억제 · `burglar` 강도→주거침입 절도범),
카드 앞면이 첫 뜻만 보여 예문과 어긋난 것 12건(`semi` 트럭↔준결승 · `funk` 음악↔우울).
`first floor` 는 한 레코드 안에서 **세 필드가 서로 다른 변종**을 말하고 있었다
(뜻=미국식 1층 / 예문=영국식 2층 / 유의어=`ground floor`).

**T10 은 순수 추가다** — `.is('example_en', null)` 조건을 걸어 **덮어쓰기 경로 자체를 없앴다**.
다른 배치가 그 사이 채웠으면 건드리지 않는다(멱등 확인: 재실행 시 `건너뜀: 4,060`).

**T8 은 판정기가 틀렸다는 걸 에이전트가 잡아냈다** — `shifted`(레코드 밀림) 탐지가 불규칙 굴절
(`have on` ↔ "He **had** the radio on"), 기호로 시작하는 표제어(`(every) now and again`),
비ASCII(`étude`·`dms™`)를 전부 밀림으로 오판했다. 세 에이전트가 독립적으로 같은 지적을 했고,
apply 에 완화 매처(불규칙 굴절표 130여 항 + 접두 합성 + 어간 변화 규칙)를 넣어 **105건**을 되잡았다
(오탐률 74%). 멀쩡한 예문을 갈아치우는 게 이 배치의 유일한 손실 경로였다.
곡선 아포스트로피 U+2019 가 ASCII `'` 필터를 통과하던 것도 함께 막았다.

**T5b 는 T5 의 사각지대였다** — T5 는 발행 도서 어휘만 봤는데, 유의어를 가진 표제어는 23,367개였다.
WordNet 오염은 전역이라 나머지 1만 5천 단어가 그대로 남아 있었다. 133청크 실측 제거율 **22~55%**
(T5 의 34~81% 보다 낮은 건 저빈도 구간에 유의어 1~2개짜리 깨끗한 복합명사가 많아서다 — 오염된 항목은
대부분 **통짜로** 무너졌고 `keep: []` 가 3,874단어였다). 최종 유의어 항목 98,936 → **42,495 (57% 제거)**.

T5b 가 새로 드러낸 오염 축 두 가지 — **표제어 인접 오염**: `stepbrother`→`half-brother`(의붓≠이복),
`presbyopia`→`farsightedness`(노안≠원시), `nautical mile`→`mile`(1,852m≠1,609m), `hummus`→`humus`(흙),
`kibibyte`→`kilobyte`(2^n≠10^n) 처럼 **철자·개념이 한 끗 차이라 그대로 오학습되는** 유형.
**synset 단위 확산**: WordNet synset 하나가 여러 표제어를 동시에 오염(중세 공성무기 3종 · '돈' 속어 ·
퓨마 4형제 · 상표명 약물 9종). 부수로 잡힌 레코드 자체 결함 **496건**은 `w0816-syncheck2/NOTES.json`
(자동 수정 안 함 — 사람 검토 대상).

**⚠️ 유의어 오염은 콘텐츠 안전 문제였다** — 제거율 **34~81%**(빈도 상위일수록 심함).
학습자 카드 뒷면에 노출되던 값: `far`→르완다 무장단체(FAR 약어) · `let`→테러조직(LeT) ·
`queen`·`fag`/`fagot`/`faggot`·`queer`·`fairy`(A2)→동성애 멸칭 전량 · `retard`·`changeling`·`slowness`→지적장애 멸칭 ·
`coloured`·`chink`·`guinea`→인종 멸칭 · `jade`·`doll`·`skirt`→여성 비하 · `pot`·`ice`·`acid`·`dot`·`dose`·`soap`·`rope`→마약 은어 전량 ·
`can`(A1 조동사)→화장실 비속어 · `tool`(A2)→성기 비속어 · `violation`→rape.
오염 유형 10종: 품사 통짜 불일치(최대) · 수치 오류(`dual`↔`treble`↔`threefold` 삼각) · 뜻 정반대(양방향 5쌍) ·
과학 오개념(`molecule`→atom) · 추상↔물리 혼입 · 멸칭·비속어 · 약어 충돌(3글자 이하 표제어) · 인명/학명 동형 · 동형이의 통짜 · 철자 변형.

**신규 하네스** — `scripts/dict/w0816-syncheck.mjs`(삭제 전용·부분집합 게이트) ·
`w0816-syncheck2.mjs`(같은 게이트·발행 도서 어휘 제외 잔여 전체) ·
`w0816-exmatch.mjs`(예문만 교체·뜻은 보고만) · `w0816-meaningfix.mjs`(기존 sense 보존 게이트).

**게이트 실적**: T5 부분집합 위반 **0건**(8,563단어) · T5b 부분집합 위반 **0건**(9,551단어) ·
T6 게이트 탈락 8건 · T7 sense 소실 **0건**. 삭제 전용 게이트가 133청크 전량에서 한 건도 뚫리지 않았다.

**같은 배치에서 고친 기계적 결함**:
`pos_set` 재구축(`pos ∪ senses[].pos ∪ meanings_ko[].pos`) — `pos` ∉ `pos_set` **4,201 → 0**,
다품사 표제어 2,317 → **9,501**(단일 품사로 눌려 있던 것이 드러났다) ·
`-ly` 형용사가 pos=adverb 로 기록된 **18건** 수정(cuddly·fatherly·frilly·ghostly·motherly·prickly·
scholarly·smelly·straggly·unholy·unsightly·unworldly·wobbly·worldly·disorderly + gentlemanly·knightly·pearly).
`pos`·`primary_pos`·`pos_set`·`meanings_ko[].pos` 를 함께 갱신했다 — 하나만 고치면 다시 어긋난다.
`ostensibly`·`purportedly`·`superficially`·`actually`·`admittedly`·`distressfully` 는 정규식 오탐(진짜 부사)이라 두었다.

**추가로 계측된 구조 결함**(전부 별도 승인 필요):
굴절형 표제어 **1,104**(pos=verb 103) · 복수형 중복 **299** · 하이픈 중복 **123** · 소문자 고유명사 **29** ·
CEFR 오배정 126(88%가 `frequency_rank` NULL) · 멸칭 표제어 자체의 노출 정책(`nance`·`fagot`·`negroid`·`spic` 등).

### Growth(`/dashboard`) 재설계 + `/hub` 진행 단일화 — 화면 셋이 동시에 거짓을 말하고 있었다 (v06.201)

회고면을 "얼마나 많이 했나"에서 **"내 기억은 얼마나 오래 버티나"** 로 바꿨다. 출발은 디자인이
아니라 **실측**이었다 — 계정 하나를 DB와 대조하니 화면이 인쇄하던 숫자 대부분이 틀려 있었다.

| # | 결함 | 근거 (실측 2026-08-15) | 수정 |
|---|---|---|---|
| ① | 히어로 "마음에 자리잡은 단어 **0개**" (단어 252개 보유 계정에서) | 갱신은 정상(세션 flush 마다 `refresh_user_known_word_count` 호출 — Flashcard·PairFlip·SpellForge·StudyMode·Dictation). **0도 정직한 값**이다: 정의가 `stability >= 21`(Anki mature)인데 이 계정 최대 S=2.31일 | 계산이 아니라 **질문이 틀렸다**. 몇 달간 0인 지표를 주인공에서 내리고 지속 사다리로 교체 |
| ② | 그 지표는 1일차에 쓸 수 없다 | `stability>=21` 은 신규~중급에게 **몇 달 동안 0** | 사다리는 하루/사흘/한 주/한 달/계절 5칸 — 1일차에도 0이 아니다 |
| ③ | "28일 중 **1일** 학습" | 히트맵이 `total_minutes>0` 을 학습일로 판정. 그 컬럼 트리거가 `ROUND(duration_seconds/60.0)` → **60초 미만 세션이 0분**. 실제로는 8일 연속 활동(리뷰 120·142·33…) | 학습량 정본을 `learning_records` 행 수로. **분은 아예 그리지 않는다** |
| ④ | 한 화면에 **연속일이 세 종류** | 띠 3일(`user_stats.current_streak`) · 히어로 3일 · 히트맵 0일(자체 minutes 계산) | `growth-math.computeStreak` 하나. `user_stats.current_streak` 는 더 이상 읽지 않음 |
| ⑤ | "시간 1분 · 단어 301개" | 1분에 301단어 — 같은 카드 안에서 자기모순 | 분 제거, 리뷰·단어만 |
| ⑥ | 어휘 앱 회고면에 **단어가 한 개도 없었다** | 개수와 막대뿐 | `RescuedWords` — 이번 주 다시 만나 맞힌 단어 실물 5개 |
| ⑦ | 최근 활동 칩 5개가 **전부 동일** ("딕테 X · 11분 전") | 정보량 0 | 연속 run 접기(`딕테 ×5`). 재정렬은 안 함 — 하면 "최근" 이 거짓이 된다 |
| ⑧ | 모바일 가로 넘침 20px | 그리드 자식 `min-width:auto` | 카드 루트 `min-w-0` |

**`/hub` 쪽에서 같이 드러난 것** — 같은 화면에 진행이 두 개로 떠 있었다(띠 `오늘 2/3` · 흐름 `0/5`):

| # | 결함 | 근거 | 수정 |
|---|---|---|---|
| ⑨ | 듣기 블록이 **무엇을 해도 완료되지 않음** | `touchedToday.has('echomatch')` — `learning_records.module` enum 값은 `'echo'`. `echomatch` 는 **enum에 없다** | `BLOCK_MODULES` 로 매핑 일원화. **단위 테스트가 같은 오타를 써서 초록불이었다** → enum 실측치 대조 회귀 추가 |
| ⑩ | 구문(Syntax) 블록 `done: false` 하드코딩 → 5/5 도달 불가 | `grade_dcp_item` 이 쓰던 `csat_item_attempts` 가 `20260719161409_drop_unused_empty_tables` 로 사라짐(CLAUDE.md §DB 미해결 목록) | `observable: false` — 관측 불가는 **분모에서 뺀다**. 도달 못 할 목표는 진행이 아니라 압박 |
| ⑪ | 복습 완료 = `dueCount===0` | 200개를 복습해도 41개 남으면 "아무것도 안 함" | `dueCount===0 \|\| 오늘 복습 활동` |
| ⑫ | 무대가 클라이언트 최근활동 목록으로 완료 판정 | 최근 N건만 담겨 **앞쪽 모듈이 밀려 사라짐** | `fetchTouchedModulesToday()`(서버 `daily_activity.by_module`, `cache()`) 를 띠·무대가 공유 |

- **신설** — `lib/learner/growth-math.ts`(순수: RUNGS·`rungFor`·`computeStreak`·`formatDuration`·DTO)
  · `lib/learner/memory-horizon.ts`(조회) · 컴포넌트 4
  (`DurabilityLadder`·`RescuedWords`·`ActivityTrace`·`LexicalReach`)
- **순수/조회 분리** — `today-status.ts` 와 같은 이유. 합쳐 뒀을 때 vitest 가
  `cache is not a function` 으로 스위트째 못 떴고, 클라이언트 컴포넌트는 서버 코드를 끌어왔다
- **제거** — Growth 의 `MemoryStatus`(기억 4상태). ADR 0006 D2 가 "상태 띠가 흡수하고 나머지
  자리에서 제거" 라고 선언했으나 Growth 쪽 제거가 실제로는 안 돼 조치 표면이 둘이었다.
  4상태는 forward(띠), 지속 사다리는 backward(Growth)
- **`today-status.ts` 축소** — 자체 4갈래 모델·모듈 매핑표 삭제, 진행은 `blockProgress()` 를 받아 씀
- **어휘의 무게중심** — `shared_dictionary.frequency_rank` 밴드 분포.
  ⚠️ **커버리지 %로 환산하지 않는다** — Nation 계열 95/98% 임계는 어휘 *크기* 추정이 전제인데
  우리가 가진 것은 담아 둔 단어뿐이라, 환산하면 격려가 아니라 오보가 된다
- **요일 리듬** — 4주치를 요일로 접어 "주로 금요일에 하는 편이에요". 점수가 아니라 성향이라
  어떤 값이 나와도 학습자를 탓하지 않는다
- **캡처 하네스 개선** — `91-hub-design-capture` 가 넘침 **픽셀 수만** 보고해서 한 라운드를
  엉뚱한 컴포넌트를 고치는 데 썼다. `overflowCulprits`(넘친 요소 지목) 추가
- **회귀 락 +21** — `__tests__/memory-horizon.test.ts`(13) + `today-blocks.test.ts` 확장(18, enum
  대조·`blockProgress` 포함) + `today-status.test.ts` 갱신(8)

### `/practice` v2 — 연습 통폐합 완성 + Game Lab 흡수 + 영향도 전수 검사 (v06.201)

사이드바 PRACTICE 5형제를 `/practice` + `Game Lab` 둘로 접은 뒤, **통폐합이 무엇을 흘렸는지**
전수 검사했다. 셋이 새고 있었고 셋 다 **화면은 멀쩡히 뜨는** 종류였다.

| # | 결함 | 수정 |
|---|---|---|
| ① | `/practice` 에서 연 게임이 종료 시 `/arcade` 로 튕김 (`from` 미첨부 → `resolveSessionReturnHref` fallback) | `gamePlayHref(slug, { from: '/practice' })` |
| ② | `/practice/dcp`(Syntax)가 이 화면의 **하위 라우트인데 화면이 언급조차 안 함** — 진입이 허브 처방 하나뿐이었다 | 처방 fetch 추가 → **활성일 때만** Use 면에 노출(잠긴 날 링크 안 만듦) |
| ③ | PairFlip 이 **보이는데 눌리지 않음** — 도구 칩이 `span`, 카드 전체는 첫 도구로만 링크 | 카드 전체 링크 제거 · 도구마다 44px `Link` |

- **Game Lab 흡수** — `lib/learner/practice-map.ts` 신설. 게임 면 매핑을 손으로 적지 않고
  `GAME_CATALOG.layer` 접두사에서 **파생**(`L4c`→Sound · `L4b 형태론/귀납`→Build · `L5`→Use ·
  `L4a 자동화/경쟁/전략`→Fluency). 게임 17종이 면 안으로, 면 불분명 4종(리텐션·시너지·해독)은
  Game Lab 전체 목록에만. → v1 이 Sound·Build·Use 에 적었던 **"아직 전용 연습이 없어요" 는 거짓이었다**
  (게임이 이미 있었는데 화면이 자기 제품을 몰랐다).
- **여섯 면 전부 카드** — 하단 45% 공백 제거. 홀수 마지막 카드 `sm:col-span-2`
- **진행 신호** — `FacetSummary.distribution` 통과/시도 (시도 0이면 안 그림)
- **접근성** — Game Lab 링크 30px→44px · 도구 칩 전부 44px(프로젝트 절대 규칙 위반이었음)
- **한글 eyebrow 자간 제거** — 라틴 관습 0.16em 이 "지 금  가 장  무 른  곳" 으로 벌어졌다
- **회귀 락 11** — `src/lib/learner/__tests__/practice-map.test.ts`(6, 링크 17개 실라우트 검증 포함)
  + `tests/e2e/26-practice-chooser.spec.ts`(5, 흡수 4모듈 딥링크 생존 포함)
- 루브릭 87 → **94**
- ⚠️ 고아 컴포넌트 6(630줄, `HubHero`·`ModuleGrid`·`ModuleCard`·`ArcadeEntryCard`·
  `TodayPrescriptionCard`·`PrescriptionArticleLaunch`) — **삭제 보류**.
  `TodayPrescriptionCard.test.tsx`(18단언)가 처방 계약을 잠그고 있어 지우면 락이 함께 사라진다.

#### 디자인 캡처 하니스 정확도 수정 (`91-hub-design-capture`)

평가 도구가 틀리면 그 뒤 라운드가 전부 틀린다. 넷을 고쳤다.

- **범용 계측 훅 `[data-design-card]`** — 셀렉터가 서재 전용 `aria-label` 뿐이라 `/practice`
  가 한 라운드 내내 **"카드 0개"(측정 안 됨)** 였다. 하니스 자신이 경고해 둔 상태였다
- **줄 단위 비교로 수정 — 오탐 제거** — 격자 전체를 한 통에 세던 것을 `컨테이너+offsetTop`
  으로 묶었다. `/practice` 가 131/179/227 로 "불균질"이었는데 **각 줄 안에서는 균질**했다
  (줄바꿈 격자는 줄마다 높이가 다른 게 정상). 수정 후 0/2 · 서가도 정확해졌다(books 0/3)
- **접힘선 지표 신설** — `foldRatio` + 접힌 인터랙티브 요소 이름. 이걸로 `/practice` 의
  Game Lab 링크가 desktop·mobile **양쪽 다 접힘선 아래**임을 발견 → 섹션 헤더로 이동
  (`26-practice-chooser` ③ 에 `box.y < viewport.height` 단언 추가). 높이 1.31→1.26화면
- **0 을 통과로 읽지 않기** — 줄 0개(1열 모바일)를 `0/0` 으로 찍던 것 → "균질성 비교 불가" ·
  접힘 목록 82개 쏟아지던 것 → 앞 12개 + "외 N개"

### 받아쓰기 무결점화 — 순회에서 나온 결함 24건 (사용자 신고에서 시작)

`/dictate/session?sessionId=…` 하나의 신고에서 출발해 전 화면(허브·설정·세션·결과)을
화면/디자인/기능/프로세스/접근성/보안/규모 축으로 돌았다. **화면은 전부 멀쩡해 보였다** —
아래 대부분이 눈으로도 리뷰로도 안 잡히는 종류다.

| 분류 | 건 | 대표 |
|---|--:|---|
| 조용한 실패 | 4 | 시작 실패가 스피너만 끄고 끝남 · 캐시 저장 실패를 `catch {}` 로 삼킴 |
| 구조 결함 | 2 | 문항이 기기 안에만 존재 · 이어하기가 캐시 전용 |
| 접근성 | 3 | **`Tab` 이 건너뛰기라 키보드 사용자가 갇힘** · 버튼에서 Space 가로챔 · 채점 결과 무고지 |
| 학습·채점 설계 | 2 | **힌트 사다리 역순** · **`contraction` 태그가 자기 예시를 못 잡음** |
| 44px 위반 | 11 | 자료 탭 30px · **세션 닫기 36px(유일한 출구)** |
| 거짓·오해 문구 | 4 | 불가능한 상태 설명 2 · 로딩 흉내 2 |

**핵심 3가지**

1. **문항을 DB 에 남긴다** (`20260815060000_dictation_session_items`) — 진행 상태가 시작한
   기기에만 있어 세션 URL 이 다른 브라우저에서 **구조적으로 열릴 수 없었다**. 이제 복원하고,
   어디까지 풀었는지는 `dictation_attempts` 최대 `item_idx` 가 정한다.
2. **`Tab` 가로채기 제거** — 키보드 사용자는 포커스를 옮길 수 없었고, 옮기려는 시도가
   **문항을 건너뛰는 되돌릴 수 없는 조작**이었다(WCAG 2.1.1 · 2.1.2).
3. **힌트 사다리 정렬** — 첫 글자(-5)가 길이 표시(-3)보다 먼저였다. 순서대로 누르면
   필요보다 많은 도움을 먼저 받고 벌점은 되레 내려갔다.

**노출 경계** — 세션 URL 이 공유 가능해진 만큼 키로 확인했다(실 DB 통합 3):
anon 은 남의 문항 본문도 받아쓴 내용도 못 읽는다.

**테스트가 나를 다섯 번 잡았다** — 이어받기 테스트가 3.9초 만에 통과(아무것도 검증 안 함) ·
키보드 테스트가 옛 동작에서도 통과(공허한 단언) · 셀렉터가 부제목을 처방으로 읽음 ·
로딩 중을 빈 화면으로 읽음 · 허브의 같은 침묵을 내가 다시 만듦.
**고친 뒤 결함을 일부러 되살려 실제로 실패하는지 확인**하고 다시 제거했다.

회귀: e2e 3스펙 21케이스(`17-dictation-loop` · `23-dictate-resume` · `24-dictate-sweep`) ·
단위 36. `ensureAuthState`(유효성 기반 재사용)로 순회 실행 4분 → 33초.

### 받아쓰기 "아무 반응 없음" — 침묵 3곳 · 44px 9곳 · 그리고 진짜 원인 (사용자 신고)

`/dictate/session?sessionId=…` 에서 아무 반응이 없다는 신고. 그 세션은 DB 에 있었고
(`source_kind='daily'`, 05:40 시작) **시도는 0건**이었다 — 세션은 만들어졌는데 문항을 한 번도
못 받은 것이다. 파고드니 원인이 하나가 아니었다.

**① 조용히 실패하던 경로 3곳** (전부 화면에 아무 말도 남기지 않았다):

| 지점 | 무엇이 침묵했나 |
|---|---|
| `DictationSetupClient` | `if (!session) { setStarting(false); return }` — 스피너만 꺼지고 이유가 없다. **문자 그대로 "아무 반응 없음"** |
| `storage.writeAll` | localStorage 저장 실패를 `catch {}` 로 삼킴. 주석은 "학습을 막지 않는다" 였지만 **세션 인계가 이 캐시를 지난다** |
| `getSession` | 형태가 깨진 캐시를 검증 없이 반환 → `session.items[...]` 가 던지면 화면이 통째로 빈다 |

**② 진짜 원인은 구조였다 — 문항 목록이 DB 에 없었다.**
마이그레이션 `20260815060000_dictation_session_items` 로 `dictation_sessions.items jsonb` 신설.
이제 캐시에 없으면 **DB 에서 복원**하고, 어디까지 풀었는지는 `dictation_attempts` 의
최대 `item_idx` 가 말한다 — 기기를 바꿔도 푼 문항을 다시 풀지 않는다.
완주한 세션 URL 은 `completed` 상태로 갈라 결과 화면으로 보낸다(전엔 '못 찾음' 과 뒤섞였다).

**③ 44px 위반 9곳** (프로젝트 절대 규칙) — 순회 스펙이 잡았다:
자료 탭 `92x30` · 빈 탭 CTA `129x32` · 세션/결과/설정 버튼 `h-9`~`h-10` ·
**`SessionFrame` 닫기 36px — 학습 세션에서 나가는 유일한 조작**이었다.

**④ 로딩이 최종 상태로 보이던 곳 2** — 결과·설정의 맨 스피너(텍스트 없음)에 `role="status"` + 문구.
화면 판독기에 아무것도 아니었고, 회귀 스펙조차 "로딩 중" 과 "빈 화면" 을 구별하지 못했다.

**신규 회귀 2** — `23-dictate-resume`(4) · `24-dictate-sweep`(5). 화면마다 세 가지를 검사한다:
막다른 화면 금지 · 로딩은 최종 상태가 아니다 · 44px.

⚠️ 작성 중 **테스트가 아무것도 검증하지 않고 초록**인 것을 잡았다 — 이어받기 테스트가
"오늘의 받아쓰기 재료 없음" 으로 early return 해 **3.9초 만에 통과**했고 DB 에는 세션이
하나도 안 생겼다. 담아 둔 자료에서 시작하도록 바꾸니 15.3초가 됐고 그제야 실제로 검증했다.

### 사전 드레인 2건 적용 — 그리고 등재만 되고 안 보이던 유령 행

MCP 복구 후 밀려 있던 마이그레이션 2건을 정식 경로(`apply_migration`)로 적용했다.
적용 과정에서 첫 마이그레이션이 **목적 기준 no-op** 였던 것을 잡았다.

- **기초어 11종 등재** ([20260815082529](../supabase/migrations/20260815090000_ngsl_top2000_basic_gaps.sql)) —
  NGSL 상위 2000 중 해석 불가 10종(`something`·`someone`·`whatever`·`throughout`·`okay`·`onto`·
  `everywhere`·`hi`·`fifteen`·`forty`) + `cannot` · `prove` 굴절에 `proven` 연결.
  적용 전 실측으로 11종 전부 실제 결손임을 확인(기존재 0)
- **🔴 그 마이그레이션의 결함 보정** ([20260815082641](../supabase/migrations/20260815082641_ngsl_basic_gaps_set_classified_by.sql)) —
  INSERT 가 `classified_by` 를 안 채웠다. `resolve_dict_headword()` 는 L1~L5 **모든 경로**에서
  `classified_by IS NOT NULL` 을 요구하므로 11종은 행으로만 존재하고 학습자 해석엔 0건이었다.
  자체 점검("12행 모두 non-null")을 실제로 돌려서 11/12 null 로 드러났다 —
  **적용 성공 ≠ 목적 달성**. `classified_by IS NULL` 인 행은 전체 45,699행 중 정확히 이 11종뿐이었다.
  보정 후 12/12 해석 통과. 불변식은 [DB_SCHEMA.md](./DB_SCHEMA.md) `classified_by` CHECK 항목에 기록
- **템플릿 예문 8,403행 제거** ([20260815082826](../supabase/migrations/20260815093000_template_examples_remove_and_reauthor.sql)) —
  9개 문장 틀의 복사본. 사전 5,452 + 발행 세트 2,951 → **양쪽 0**.
  초급 30종은 사람이 쓴 예문으로 대체(사전 30 · 세트 6), 나머지 8,367행은 NULL.
  비운 행의 `senses` 안 잔류 템플릿도 0 확인 — `example_en` 만 비우고 JSON 에 남는 함정 없음
  - 파일 주석은 "백업에서 복원할 것" 이라 적고 **백업을 만들지 않았다**.
    [20260815082723](../supabase/migrations/20260815082723_backup_template_examples_before_purge.sql) 로
    `backup.template_examples_20260815`(8,403행 · 2.3 MB) 를 비우기 직전에 캡처 — 복원 SQL 은 그 파일 주석에
  - 원본의 TEMP TABLE + 명시적 `BEGIN/COMMIT` 은 `apply_migration` 의 트랜잭션과 중첩되므로 CTE 로 재작성
- **잔여 63행 + 재발 방지** ([20260815092528](../supabase/migrations/20260815092528_template_examples_residue_escaped_headwords.sql)) —
  앞 마이그레이션이 표제어를 **이스케이프 없이** 정규식에 이어 붙여, 괄호를 가진 표제어
  (`a breath of (fresh) air` 등 216종)에서 괄호가 그룹으로 해석돼 39행이 조용히 빠져나갔다.
  **적용 전에 "컴파일되는가" 는 봤지만 "의도한 것을 맞추는가" 는 안 봤다** — 컴파일 성공은
  매칭 정확성이 아니다. 이스케이프 시 39/39 매칭 확인
  - 틀 3종 추가 발견(같은 생성기 계열) — `"{W}!" he exclaimed in response.` 11 ·
    `"{W}!" she exclaimed in surprise.` 8 · `{W} was the one who solved it.` 5
  - 초급 3종 재작성(`mine`·`whichever`·`be (all) for the best`) · 나머지 60종 NULL.
    `mine` 의 "Mine was the one who solved it." 은 뜻도 안 보이고 어법도 어긋났다
  - **`regexp_quote(text)` 신설** — 사전 값을 정규식에 넣는 모든 경로가 경유할 것
  - 적용 후: 사전에 표제어 5종 이상 재사용 틀 **0종 0행** (임계 10 → 5 로 낮춰도 0)
- **프로브 오탐 차단** — `example-quality.ts` 가 `shared_words` 틀을 **행 수**로 세고 있었다.
  세트는 단어를 복사하므로 한 단어가 40개 세트에 실리면 "40회 재사용 틀" 로 보인다.
  임계 초과 30여 종이 전부 이 오탐이었고(서로 다른 표제어 최대 4개) 믿었다면
  **사람이 쓴 예문을 드레인할 뻔했다**. 서로 다른 표제어 수로 세도록 교체
- **워크어라운드 스크립트 봉인** — `scripts/dict-quality/apply-pending-dict-migrations.ts` 는
  MCP 단절 때 쓰려던 service-role DML 우회로다. 이제 재실행 금지 헤더를 달았다 —
  이 스크립트 역시 `classified_by` 를 안 채워 같은 유령 행을 만든다

### Today 진입면 재설계 + 조용한 실패 8건 (v06.200)

`/hub` 이 답하는 질문을 "무엇이 있나" 에서 **"무엇을 배우고, 지금 뭘 하지"** 로 바꿨다.
설계 3안을 실데이터로 구현해 6차원 루브릭으로 비교했고(랩 `/hub-lab`), 합성안이 이겼다.
**현행 42점 → 93점** (실측 스크린샷 채점).

- **`/hub` 전면 교체** — 좌: 밀린 단어 하나가 지면의 주인공(뜻 + 그 단어를 만난 원문 문장) ·
  우: 오늘의 흐름 5블록 타임라인. 신설 `components/home/TodayStage.tsx` · `room-tone.ts` ·
  `lib/learner/today-blocks.ts` · `reading-room-actions.ts` · `prescription-blocks.ts`
  - 걷어낸 것: 히어로 인사말(140px) · 7개 동일 모듈 그리드(다섯이 "아직 학습 전") ·
    Game Lab 보라 배너 · 추천 단어장(→ Vault 소관) · "V-Level 갱신" 관리 기능 · 빈 상태 카드
  - **유지**: v06.108 META 단일 정본 — 수동계획 날에는 처방 흐름을 렌더하지 않는다
  - **단일 CTA 규칙** — 지금 블록이 정하고, 그 블록이 복습일 때만 단어가 그 행동의 재료가 된다
  - 이름은 `prescription-blocks.ts` 가 소유(`PLAN_ACTIVITIES` 재사용 4 + `Syntax` 1) — v06.141 규칙
- **시각(時刻) 톤 5단** — **명도는 테마가, 색조는 시각이 소유한다.** 첫 구현은 `--p-dark` 를 지면에
  썼다가 다크에서 `#4F84BC`(밝은 파랑)로 뒤집혀 AA 미달이 됐다. 두 축이 같은 것을 제어하면 싸운다
- **`--on-p` 미완 마이그레이션 9곳 이전** — 진단 결과/헤더 · 추천 CTA · FloatingSparkle 2 ·
  플래시카드 완료 2 · SpellForge 확인 · 서재 이어보기. 다크 `--p`(#6B9BD1) 위 흰 글자 2.90:1
  - 잔량 38곳(주로 admin)은 **래칫 가드**로 고정: `lib/a11y/__tests__/on-p-contrast.test.ts`

### WordVault — 목업 통계 제거 · 수준 지도 복구

같은 계정에서 **13 단어 → 252 단어**. 이전 값은 전부 `MOCK_WORDS` 였다.

- `WordVaultHub` 이 값이 아니라 **상태 전체**(`HubStatsState`)를 받는다 — 값만 받으면
  "아직 못 셌다" 와 "세어보니 0" 이 같아지고, 그 틈으로 목업이 실수치 자리에 앉았다
- **단어 수준 지도** 가 두 겹으로 죽어 있었다:
  ① `lemma` 만 조회 — 이 계정 252개 중 lemma 는 **1개**(251 null). `lemma ?? word` 로 **242개** 매칭
  ② `flex items-end` 가 열을 콘텐츠 높이로 줄여 막대 `h-full` 이 0 붕괴 → **막대를 그린 적이 없었다**
  · 기본 막대 색이 `--ios-gray-3` 라 실제 분포가 배경에 묻히던 것도 수정
  ⚠️ `vocabularies.lemma` 파이프라인 결손은 별도 과제
- `loading`·`unauth`·`error` 를 한 문장으로 뭉개던 분기 분리 — 실패가 "내 단어가 부족한가 보다" 로 읽혔다

### 회귀 자산

- **신규** `91-hub-design-capture`(디자인 캡처 하네스 · 판정 도구) · `23-hub-today-stage`(3) ·
  `24-wordvault-real-stats`(1) · `today-blocks`(단위 11) · `on-p-contrast`(래칫)
- **복구** `18-hub-real-queue`(4) — 히어로 통계 라벨이 v06.141 로 영문화됐는데 스펙이 안 따라가
  조용히 깨져 있었다 · `01-wordvault-browse`(3) — `WordRow` 에 `data-testid` 가 없어 스펙이
  클래스 이름 추측에 기대고 있었다
- 캡처 하네스가 스스로 낸 조용한 실패 2건도 차단: 로그인 화면을 허브로 채점 · 라우트 0개인데 통과

### 🔴 미수정 — 판단 필요 (같은 결함 계열)

- **`/text/[id]` 가 실패 시 가짜 본문을 보여준다** — `layout.tsx:416` 이 Provider 없이 렌더하면
  `page.tsx:296` 이 `MOCK_PARAGRAPHS` 로 폴백. 학습자가 가짜 제목 아래 가짜 영어를 읽는다.
  핵심 학습 표면이라 실패 시 무엇을 보여줄지는 제품 결정
- **`/dashboard` 히어로가 거짓 서사** — `knownWordCount` 0 → "아직 시작 전이에요". 같은 화면
  아래는 총 252개·누적 41일·3일 연속. 지표 교체는 제품 결정
- `FlowStripe.tsx:114` 상태 뭉갬 (수준 지도와 동형)

### 발행 도서 표지 8권 중 8권이 비어 있었다 — 시드에 있는 값을 안 쓰고 있었다 (v06.142)

`/library/books` 에 표지 없는 책이 많다는 지적에서 시작. 발행 13권 중 **8권 무표지(62%)**,
그런데 **그중 7권은 `library_seed_catalog.cover_url` 에 표지 URL 이 이미 있었다.**

- **원인** — 승격 단계가 시드 값을 무시하고 원천 사이트에 다시 요청했고, 그 요청이
  best-effort(`try/catch`+`warn`)라 실패하면 조용히 무표지로 발행됐다. 파서·정규식은
  재현 결과 **정상**이었다(SE 목록 파싱·og:image 추출 모두 통과) — 로직이 아니라
  네트워크 의존이 만든 결함. 7/27 하루 5권 집중 생성 → 대량 드레인 중 스로틀 추정
- `resolveCoverImageUrlWithSeed()` 신설(정본) — 시드 우선·원천 폴백, `via` 반환.
  승격 2곳(`process`·`dev-process`) + 백필이 모두 이것을 사용
- 백필 소스 제한 제거(gutenberg/SE 만 보던 것) + 표지 실패 시 `warn` 으로 노출.
  **실행 결과 무표지 8 → 1권** (남은 1권 pressbooks 는 시드에도 원본 없음)
- Gutenberg `.large` 우선 시도 후 `.medium` 폴백(HEAD 확인) — 실측 두 권은 `.large` 404
- **표지 배치** `cover-fit.ts` 신설 — 원본 비율 실측 결과 StoryWeaver 표지는 2.09:1
  가로 삽화 크롭이라 3:4 슬롯에서 **좌우 64% 가 잘리고 있었다.** `is_picture_book` 으로
  갈라 그림책만 `object-contain` + 블러 배경. `BookGridCard`·`LibraryGrid` 공용(회귀 4)
- 문서: [LIBRARY_PIPELINE.md](./LIBRARY_PIPELINE.md) 표지 절 신설(비율 실측표 포함)

### 학습자 화면 이름 영어화 + 이름 SSoT 통합 (v06.141)

메뉴·탭·활동 이름을 영어로 통일하면서, 이름을 **화면이 각자 짓던 구조**를 걷어냈다. 옮기기 전에
같은 것이 화면마다 다른 이름으로 불리고 있었다 — `article` 이 Plan 에서 '스크립트'·Library 에서
'짧은 글', `word_set` 이 '공용단어장'/'단어장'/'세트' 셋, 모바일 하단 탭은 자체 한국어 목록이라
같은 표면이 데스크톱 `Today`·모바일 `오늘`. 번역만 했으면 이 분기가 영어로 복제됐다.

- **자료 유형 4종 확정** (`MATERIAL_LABEL` 단일 출처) — `Books` · `Dispatches`(arXiv·NASA·NIH·VOA
  짧은 글) · `Decks`(발행 단어장) · `Scripts`(학습자가 넣은 글). `scripts` 키가 화면마다 다른 것을
  가리키던 함정(Library=공개 짧은 글 vs Dictation·Vault=내 글)을 라벨 층에서 분리
- **활동 10종** — `듣기`/`읽기`/`따라하기`/`단어` 만 한글이라 한 줄에 두 언어가 섞이던 것 해소
  (Listen · Read · Echo · Words + 기존 모듈명 6). 인지 계층 칩도 `L0 Input`~`L6 Completion`
- **모바일 하단 탭** — 자체 라벨 목록 제거, `SURFACES[].name` 을 읽게 (Today·Library·Vault·Growth)
- **Settings** 섹션 5 + 옵션(테마·회상 대기) · **SRS 자기평가 5단**(Again~Perfect) ·
  WordVault 숨김 토글(단축키 H·M 과 첫 글자 일치) · Workspace 모드 알약 12 · 허브 통계 라벨
- **Reminders** 로 명명(`Notifications` 아님) — 뱃지·알림음 금지(Calm UI)를 이름이 먼저 어기지 않게
- 한글 유지: 본문·빈 상태·안내 문구·에러·`aria-label` (학습 중 읽는 문장, Cognitive Load)
- 회귀: `04-ui-smoke` 하단 탭 단언을 레지스트리와 같은 문자열로 — 탭이 레지스트리를 실제로
  읽는지 확인하는 장치. 가이드는 [apps/web/CLAUDE.md](../apps/web/CLAUDE.md) §학습자가 읽는 이름

### 단어장 컴포저 — 유형 26종 발행 + 구조 보완 7건

5개 생성기 방언을 Recipe v3 하나로 합치고(§[VCB_REDESIGN](./VCB_REDESIGN.md)), 시중 26 유형 +
플랫폼 고유 5 유형을 **선언 카탈로그**로 만들었다. 평가는 두 축이다 — 내부 7지표(선언한 것을
지켰나)와 **시중 16요소 대비 매트릭스**(그 유형의 베스트 책보다 나은가, 상대는 유형별로 지정).

- **G6 29/29 전 요소 우위·동률 · G7 29/29 목표 초과 · 파라미터 스윕 55/55** (주제 18 · 목록 14 ·
  도서 5×3유형 · 레벨 3 · 일정 3 · 규모 2). 리포트는 러너가 갱신:
  [vcb-compose-eval.md](./reports/vcb-compose-eval.md) · [vcb-compose-sweep.md](./reports/vcb-compose-sweep.md)
- **발행 카탈로그 30세트 · 15,788단어 · 유형 27종**. 각 세트의 `curation_query` 에 레시피·채점표·
  시중 대비 매트릭스를 함께 적재(마이그레이션 없음 — 기존 jsonb 컬럼 사용)
- 새 화면 `/admin/vocab/studio` (유형 선택 → 조립 → 채점 → 발행. **채점 전 발행 잠금**) +
  CLI `pnpm vcb:compose` · 도움말 `vocab-studio`
- 학습자 동선: 도서 상세 Tier 2 "보조 단어장" 빈 자리를 그 책의 해금·재등장 세트로 채움(이유 문구 포함)
- 구조 보완: `meaning_clean` 오탐 1,640건 수정 + 필터 생존율 경고 · **규모 미달 blocker**(요청의 30%
  미만이면 7지표가 만점이어도 실패) · `primary_pos 'phrasal verb'` 표기 정규화 · KICE 기출 lemma 673개를
  `lexicon_frequencies.metadata` 로 편입 · `base_word` 체인 평탄화 179행 · **오디오 유형 오분류 수정**
  (`audio_url` 0% 를 근거로 asset_gap 이었으나 흘려듣기는 이미 런타임 TTS 로 돈다 → `audio_playable` 규칙)
- **마이그레이션** [20260815120000](../supabase/migrations/20260815120000_i7_phrase_unit_carveout.sql) —
  품질 게이트 I7 이 `phrase_unit` 을 전 세트 공통 노이즈로 하드코딩해 구동사 단어장(표제어가 곧 구)과
  충돌(실측 52건). `blueprint='phrasal-idiom'` 세트의 `phrase_unit` 한 종류만 면제(global·word_set 동시).
  예외가 유형을 안 가리고 번지는 것은 **같은 단어를 유형만 바꿔 넣는 대조 회귀 2건**이 막는다.
  적용 후 `cat-phrasal` 재발행 · global critical FAIL 0
- **표제어를 눈으로 열어 보고 고친 내용 결함 4건** — 7지표는 필드 충족도와 구조를 잴 뿐
  "이게 맞는 표제어인가" 는 재지 않는다. 28/28 우위인 카탈로그에서 첫 12개를 읽었더니:
  ① 혼동어 1군이 18개(`bearing·caring·cleaning…`) — union-find 전이성이 접미사 계열을 사슬로
  이었다 → 군 상한 4 + 라임 병합 제거 ② 구동사가 알파벳순(`a bone of contention…`) — 구는
  `frequency_rank` 3,635건 전부 NULL 이라 "빈출" 근거가 없었다 → `phrase_brevity` 정렬 신설
  ③④ 미수록이 굴절형(`further·worn·listing`) — 기본형이 이미 다른 세트에 실려 굴절만 남은
  것이었다 → `exclude_inflections` 신설(사전 컬럼 + 어휘집 대조). 그 과정에서 `fetchLexicon`
  이 `.order()` 없이 페이징해 **45,688 중 33,412 만 모으던 것**(27% 누락)도 잡았다
- **단어장 표지 29종** — 이모지로는 카탈로그에서 구별되지 않는다. 퍼블릭도메인 도판(Openverse)
  + 계열 5색 듀오톤으로 한 시리즈를 만들었다. 마이그레이션
  [20260815170000](../supabase/migrations/20260815170000_word_set_cover_image.sql)(`cover_image_url`
  ·`cover_image_meta` — CC 표기 의무). 수집기 `scripts/vcb/fetch-covers.mts`(재실행 가능 ·
  `--only <유형>` 재추첨 · 하한 미달이면 붙이지 않고 그라디언트 유지). 25/29 확보 · 중복 0.
  네 표면(카탈로그·어드민 발행 컬렉션·hub 추천·도서 상세) 모두 배선
- **발행 단어장 24/29 가 '테마별' 한 칸에 쌓여 있었다** — 레시피가 실제로 단계를 정하는 유형만
  칸을 파생시키고(themed 24 → 21 · 새 칸 4), 나머지는 카드에 유형 라벨 + 묶은 원리 한 줄
  (`lib/library/vocab/set-kind.ts` · 31유형)
- **발행한 단어장이 두 화면에서 안 보이고 있었다** — DB 에도 있고 학습자 카탈로그에도 뜨는데
  ① 어드민 `발행 컬렉션` 은 `source_run_id IS NOT NULL` 로만 조회해 컴포저 세트 32개가 통째로 빠졌고
  ② hub 추천 RPC 는 슬러그를 하드코딩(`auto-vlevel-v*`·`etymology-core`·`kice-%`)해 29세트 중 **하나도**
  뜨지 않았다. ①은 생산자 두 종류를 함께 조회(run/Studio 태그 + 유형 링크), ②는 마이그레이션
  [20260815150000](../supabase/migrations/20260815150000_recommend_by_blueprint.sql) 로 판정 근거를
  `curation_query.blueprint`·`v_level_*`·`source_book_id` 로 이전 — 7블록 추가(내 레벨·수능·학술·실무·어원·
  해금·새 영역) + 중복 제거 + `LIMIT 8`. hub 카드 뱃지 7종 추가(그 전엔 다섯 유형이 전부 '추천' 이었다).
  회귀 6건(e2e 1 + 실 DB 5)
- **발음(IPA)·소리(TTS)를 단어장 범위에서 제외** (제품 결정 — 아래 TTS 확정 항목을 정정한다).
  ① 모든 낱말 유형에 걸려 있던 `require_fields: ipa` 제거 — 아무도 쓰지 않는 필드 때문에 후보를
  9.5%(구는 91.7%) 버리고 있었다 ② Sound 면 요구를 `audio_url`(녹음)로 되돌림 — IPA 는 표기이지
  소리가 아니다 ③ D26 오디오 유형 `ready` → **`asset_gap`**(재생 경로가 녹음뿐인데 0%) ④ 시중
  `발음 표기` 요소를 `applicable: false` 로 — 목록에서 지우지는 않는다(지우면 "16요소 전부 우위"
  가 슬그머니 15요소 이야기가 된다) ⑤ U3 이름 6면 → **5면**. `audio_playable`·`speakable` 삭제.
  **WordVault 흘려듣기는 그대로** — 빠진 것은 TTS 를 단어장 상품의 전달 수단으로 세는 것이다.
  카탈로그 29세트 · 15,488단어 · 26종 (오디오 내림 · 구동사/라임/5면 재발행)
- ~~오디오 전달 방식 확정 — 브라우저 TTS 단일 경로~~ (위 항목으로 정정)
  Sound 면을 `fallback`(0.7 가중) → `full` 로, 요구를 `audio_url|ipa` → `speakable`(라틴 문자
  표제어)로, D26 을 `partial` → `ready` 로(오디오 세트 0.92 → 0.98). 단어 단위 `audio_url` 은
  요구·가산·선호·비교 문구에서 **전부 제거** — 남겨 두면 "오디오를 고치려면 파일부터" 로 되돌아간다
  (도서·아티클의 `audio_url`(LibriVox·VOA 낭독)은 별개이고 그대로 쓴다).
  결정이 만든 새 실패 지점 2건도 같이 막았다 —
  `useSpeech` 가 **음성을 안 골라** 한국어 음성이 영단어를 읽을 수 있었고, 합성 실패 시 `onEnd` 가
  불리지 않아 **흘려듣기 큐가 그 자리에 멈췄다**. en 음성 우선 선택 + `onerror` 완료 통지 +
  영어 음성 없을 때 듣기 패널 한 줄 안내. 회귀 7건
- **혼동 세트가 오답을 안 보고 있었다** — `confusion-log` 모집단이 FSRS 복습 예정(`next_review_at`)을
  읽고 있어 "내가 틀린 짝" 이 실은 "곧 잊을 때가 된 단어" 였다. 실오답은 `learning_records` 에
  331건/183단어로 이미 있었다 → `learner` 모집단에 `state:'wrong'` 추가. 더불어 **고른 오답이 아예
  기록되지 않고 있었다**(331건 중 0건) — WordBlitz 가 고른 보기를 쥐고도 `onWrong` 에서 버렸다 →
  `chosen` → `learning_records.metadata` 배선 + 새 `confusion_pair` 목차(철자 이웃이 아니라 기록된 짝).
  회귀 7건(쓰기 계약 4 + 실 DB 짝 3)
- 레거시 3 스크립트에 SUPERSEDED 표기(`dict/roots-publish-set` · `dict/topics-publish-set` · `lcp/publish-list-word-set`)

### EchoMatch 가 새 체크아웃에서 죽어 있었다 — 74MB 복사가 "사람 손" 이었다

EchoMatch 청각 신호의 **플레이어 배선**을 e2e 로 덮으려다 스펙이 150초 타임아웃했다.
증상은 "Piper 시작 버튼이 안 뜬다" 였는데, 파고드니 원인이 두 겹이었다.

**① 인증 상태를 Playwright 가 지우는 곳에 두고 있었다** — 화면 스냅샷을 열어 보니 **로그인
페이지**였다. 19개 스펙이 `test-results/.auth-*.json` 에 로그인 상태를 저장했는데, Playwright 는
실행 시작 때 그 디렉터리를 통째로 지운다. 멀티 세션 워크스페이스에서 **남의 실행이 내 스펙의
인증을 지우고**, 스펙은 전혀 다른 증상으로 실패한다. 19개 전부 `playwright-auth/`(이미 gitignore)로 이전.

**② `public/onnx/` 74MB 를 채우는 코드가 없었다** — 인증을 고치니 진짜 원인이 나왔다:

```
no available backend found. ERR: [wasm] TypeError: Failed to fetch dynamically
imported module: /onnx/ort-wasm-simd-threaded.jsep.mjs
```

`.gitignore` 주석은 "CDN 또는 npm install 시 자동 다운로드 **권장**", `piper-tts.ts` 주석은
"`public/onnx/` 로 **복사 후**" — 둘 다 사람이 손으로 한 일을 적어 둔 것이고 **하는 코드는 없었다.**
즉 새로 받은 체크아웃에서 EchoMatch 는 조용히 죽는다(화면은 "음성 모델 로드 실패" 만 말한다).

- 신설 `scripts/ensure-onnx-runtime.mjs` — `onnxruntime-web` dist → `public/onnx/` 복사(8파일 74MB).
  멱등(크기 같으면 건너뜀) · `predev`/`prebuild` 자동 · 수동은 `pnpm --filter web ensure:onnx`
- **resolve 를 못 쓴다**: onnxruntime-web 은 전이 의존이라 pnpm 엄격 격리로 `MODULE_NOT_FOUND`,
  piper 패키지는 `exports` 에 main 도 `./package.json` 도 없어 `ERR_PACKAGE_PATH_NOT_EXPORTED`.
  심링크 실경로를 따라가 **형제 패키지**로 찾는다
- `06-echomatch-fakemic` 에 청각 신호 단언 추가 — 첫 문장 단어를 심고(검증 텍스트는 학습자 단어 0개라
  안 심으면 신호 경로가 **한 번도 실행되지 않은 채 초록**) 발화 후 `learning_records(echo)` 를 확인,
  **finally 에서 되돌린다**. 같은 사이클에 얹었다 — 별도 테스트면 Piper 17MB 를 두 번 받는다
- 실측 통과: `overall=74 · pitch=76 · energy=50 · rows=1`

⚠️ 작성 중 스펙 로그가 **내 파싱 오류**를 드러냈다 — 카드가 "인토네이션 40% 76" 처럼 가중치와
점수를 나란히 쓰는데 `\D*(\d+)` 가 **가중치(40)** 를 점수로 읽고 있었다. 실점수 0인 발화도
credible 로 판정돼 있지도 않은 기록을 요구했을 것이다.

### 실 발행 콘텐츠로 재보정 — 자작 코퍼스가 낙관적이었다 (18~19회차)

TED 골든셋 대신 **발행 콘텐츠 31편**(266,134자 · 11소스)을 코퍼스로 썼다. TED 공식
트랜스크립트는 CC BY-NC-ND(파생 금지)라 학습자원 생성 대상이 아니고 저장소에도 넣지 않는다.
같은 목적(강연·설명체 영어 × 다양한 도메인 × 실제 길이)은 PD(US Gov)·CC-BY·CC-BY-SA 로
확보된다 — `display_only=true`(ND) 는 표본에서 제외한다. 신규 `export-corpus.ts` 는
소스별 상위 N 을 **길이 순**으로 뽑아 무작위 없이 재현한다.

| 지표 | 자작 9섹터 (8회차) | 발행 콘텐츠 31편 (18회차) |
|---|--:|--:|
| 커버리지 | 96.0% | **89.7% → 90.1%** |

**6.7%p 차이가 그동안의 낙관이었다.** 내가 쓴 글은 내가 아는 함정만 들어 있다.

- **토크나이저가 조각을 학습 후보로 내보냈다** — `pre-industrial` → `pre`(6편) · `non`(8편) ·
  `mid`(4편). 사전에 없으니 추출 화면에 뜨고 `pending_words` 에 "사전 갭" 으로도 오적재됐다.
  `et al.` 의 `al`(8편) · `vs`·`adj`·`ii` · `plos.org` 의 `org` 도 같은 부류.
  → 결합형 접두사 40종 + 비어휘 표기(로마숫자는 **열거** — `[ivxlcdm]+` 는 `mix`·`civil` 을
  삼킨다). 자유 형태소(`self`·`over`·`well`)는 넣지 않는다.
- **빈도 갭 지표 신설**(`frequency-gap.ts`) — 커버리지의 반대편. NGSL 상위 2000 + 구어 721 중
  해석 불가 **10종**(`something` 138위 · `someone` 439 · `throughout` 897 · `okay` 925 …).
  상위 100 은 구멍 0 이고 구멍은 전부 **기초 기능어**에 몰려 있다.
  ⚠️ 초안이 RPC 인자를 `p_word`(실제 `p_surface`)로 불러 **전부 조용히 실패**했고, 굴절형으로
  이미 등록된 `himself`·`herself` 까지 갭으로 보고했다. 이제 에러를 던진다 —
  조용히 0 을 반환하는 측정은 측정이 아니다.

### 예문 8,313건이 9개 문장 틀의 복사본이었다 (19회차 · 마이그레이션 미적용)

10회차 프로브는 "예문에 표제어가 있는가" 를 봤다. 통과해도 좋은 예문이 아니다:

| 틀 | 사전 | 발행 세트 |
|---|--:|--:|
| `The {W} is mentioned several times in the text.` | 1,578 | 969 |
| `The result seemed remarkably {W} to everyone.` | 1,101 | 744 |
| `The result appeared notably {W}.` | 1,015 | 624 |

표제어도 있고 문법도 맞지만 그 단어를 한 글자도 가르치지 않고, `remarkably + 형용사` 라는
무관한 연어만 반복해 보여준다. **없는 것보다 나쁘다**(ADR 0004 D4 와 같은 논리).

- 신규 `example-quality.ts` — 예문에서 표제어를 `{W}` 로 치환한 **틀의 재사용 횟수**로 탐지.
  사전 42,133 중 5,452(13.0%) · **발행 세트 58,822 중 10,120(17.2%) · 593틀**.
  발행 세트가 예문 사본을 갖기 때문에 사전만 고치면 학습자 화면은 그대로다(M7 과 같은 구조).
- **사전에서 고쳐 옮길 수 있는 것 0건** — 세트와 사전이 같은 틀을 공유한다. 다시 쓰거나 비우거나뿐.
- 마이그레이션 `20260815093000`(**미적용**): 초급 노출 30종은 사람이 쓴 예문으로 대체하고
  나머지 9틀 해당분은 NULL. 화면은 예문 없음을 이미 견딘다(`WordRow` → `—` 실측 확인).

### `/library` 가로 넘침 61px — 3D 캐러셀은 범인이 아니었다 (19회차)

카드가 +372px 까지 뻗어 있어 캐러셀처럼 보였지만, 무대에는 이미 `overflow-x-clip` 이 있었고
**잘린 요소는 문서를 넓히지 못한다**. 넘침 값(61px)과 크기가 맞는 유일한 요소는 **점 인디케이터
줄**이었다 — 점 하나가 44px 히트영역이라 권수만큼 자라 20권에서 512px 이 되고, 가운데 정렬이라
양옆으로 61px 씩 삐져나갔다. `overflow-x-auto` 로 가뒀다(점을 줄이지 않는다) → **61px → 0px**.
`OVERFLOW_BASELINE` 이 이제 **비었다**(17회차 `/plan` 126px 포함 전건 해소).

### 면×단계 매트릭스에 소비자가 생겼다 — 죽은 목업 섹션 자리에 (Phase 4)

계산은 서 있는데 **화면이 없었다.** 그 자리에 있던 `LearningDimensionSection` 이 왜 못 쓰였는지가
이번 작업의 이유 전부다:

- **어디서도 렌더되지 않았다** — 임포터 0. 타입도 린트도 통과했고 테스트가 없어 아무도 몰랐다
- 데이터가 `MOCK_MASTERY_GROUPS`(63/47/27) **날조 상수**였다
- 분류가 모듈명 4개 하드코딩(`flashcard`·`wordblitz`·`spellforge`·`dictation`)이라
  **아케이드 19종과 Echo 가 통째로 안 보였다** — 어떤 게임을 해도 '아직 안 만난 단어'
- 3그룹(unmet/recognizing/multichannel)은 사실상 **단일 mastery 스칼라**였다. 설계안 §2.3 이
  배제한 그것 — 면이 6개인데 하나로 접으면 "무엇이 부족한지" 를 못 말한다

**신규** `components/wordvault/hub/FacetProgressSection.tsx` (WordVault 허브 Section 3):
설계안 §2.3 대로 **가장 뒤처진 면 하나만** 처방으로 말하고, 6면 내역은 접어 둔다.
축은 레지스트리가 갖고(`Activity.facets`) 화면은 그림과 한국어 라벨만 고른다.

- `GET /api/wordvault/facets` — 계산이 `learning_records` 전량을 훑으므로 **서버가 접어서
  카운트만** 내려보낸다(클라이언트가 직접 하면 인출 이력이 통째로 브라우저에 실린다)
- `weakestFacetOverall()` — 단어 단위 `weakestFacet` 과 **같은 순서 규칙**(시도 없는 앞 면 우선 →
  통과 비율 최저). 둘이 갈리면 목록이 권한 면과 허브가 권한 면이 달라진다
- `suggestActivityForFacet()` — **기록하는 활동만 권한다.** ScriptQuiz 는 'use' 를 훈련한다고
  선언하지만 대상 단어가 없어 기록하지 못하므로, 그리로 보내면 다녀와도 같은 처방을 다시 받는다
- **조회부 결함 하나 동반 수정** — `fetchWordStates` 가 기록 있는 단어만 돌려줘서 분포의 분모가
  "연습해 본 단어" 였다. 한 단어만 열심히 한 학습자가 100% 로 보인다. 기록 0인 단어도 상태로 포함
- 삭제: `LearningDimensionSection.tsx` · `lib/wordvault/mastery.ts`(호출자 0) · `MOCK_MASTERY_GROUPS`

**검증**: 단위 +7(면 25) · 신규 e2e `22-vault-facets` 3종(렌더됨 · 처방 1면 · CTA 가 기록 활동)
· a11y 스윕 통과. 실측 처방은 `문맥에서 쓰기`(spell 1/92 · recognize 3/71 · use 0/69 · fluency 0/16).

⚠️ e2e 작성 중 **셀렉터가 부제목을 처방으로 읽는 것**을 스펙이 잡아, 처방 문단에
`data-testid="facet-prescription"` 을 달았다. 화면은 멀쩡했고 테스트만 틀렸던 종류다.

### `/plan` 가로 넘침 126px — 범인은 레이아웃이 아니라 `sr-only` 였다 (17회차)

모바일에서 `/plan` 은 화면 전체가 옆으로 밀렸다(126px). 14회차가 `/library` 캐러셀에서 같은 증상을
잡은 적이 있어 레이아웃을 의심했지만, **넘긴 요소는 폭 1px 짜리 `sr-only` 스팬**이었다.

- `sr-only` 는 `position:absolute` 다. 위치 기준 조상이 없으면 **문서**를 기준으로 잡는다 →
  가로 스크롤러(`overflow-x-auto` + `min-w-[820px]`) 안의 정적 위치(x=515)가 그대로 문서 폭이 된다.
  스크롤러의 `overflow` 도, 부모의 `overflow-hidden` 도 못 막는다 — 기준이 바깥이라 클리핑 대상이 아니다.
- 주간 보드 카드·행에 `relative` 하나씩. **126px → 0px**(실측), `OVERFLOW_BASELINE` 에서 `/plan` 제거.
- 추적 방법을 규칙으로 남겼다 — "뷰포트 오른쪽을 넘는 요소 중 **부모는 안 넘는 것**"만 고르면
  원인 요소가 한 건으로 특정된다(결과로 밀린 것들을 걸러낸다). [CONVENTIONS.md](./CONVENTIONS.md) §`sr-only`.

### 터치 타겟 — 주석이 "44×44 보장" 이라고 말하는 동안 코드는 52×32였다 (17회차)

스윕의 화면별 베이스라인이 처음으로 **일을 했다** — 새 셸(ADR 0006)이 들어오면서 `/hub` 에
위반 2종이 생겼고, "베이스라인 1 → 2종" 으로 잡혔다.

| 화면 | 전 | 후 | 무엇이었나 |
|---|--:|--:|---|
| `/settings` | 18종 | **0** | `Toggle` 래퍼 실측 **52×32**(파일 주석은 "터치 타겟 44×44px 래퍼로 보장" 이라고 적혀 있었다) · Segment 87×30 · 계정 버튼 2종 |
| `/hub` | 2종 | **0** | 처방 카드 출발 버튼이 `min-h-[36px]` 로 **명시**돼 있었다(article 런처 · book 링크) |
| `/plan` | 14종 | 8종 | 상동 측정 조건에서 감소 |

`Toggle` 은 공용 컴포넌트라 한 줄(`min-h-[44px]`)로 `/settings`·`/admin/settings`·`/dev/components` 가 함께 낫는다.
0 이 된 화면은 베이스라인 항목을 **지웠다** — 기본값이 0 이라 되살아나는 즉시 잡힌다.

**스윕 정리** — ADR 0006 D4 로 폐지된 `/my/words`·`/my/texts`(리다이렉트)를 라우트 목록에서 제거했다.
리다이렉트를 재면 같은 화면을 두 번 세고, 실패 메시지가 없는 이름을 가리킨다.

### 인증 전면 점검 — 권한 상승 1건 + 흐름 결함 11건 (마이그레이션 `20260814150000`)

로그인·가입·비밀번호 찾기·이메일 인증·콜백·라우트 가드를 전 경로 실측했다.
**단위 188 + e2e 46 = 234 테스트**가 전부 회귀 락이다 (`lib/auth/__tests__/*` ·
`tests/e2e/20-auth-flows.spec.ts`). 발견 순서가 아니라 심각도 순:

- 🔴 **권한 상승** — 일반 사용자가 anon key 한 줄로 스스로 `role='admin'` 이 됐다.
  전 사용자 프로필 열람 + `is_admin()` 기반 RLS 정책 24개 쓰기 + `/admin/*` 전 화면.
  `status='suspended'` 자가 해제도 가능했다. 컬럼 GRANT + BEFORE UPDATE 트리거로 2겹 차단.
  상세·재현 로그: [DB_SCHEMA.md](./DB_SCHEMA.md#-user_profiles-권한-상승-차단-20260814150000)
- 🔴 **복귀 경로가 100% 유실** — 파라미터 이름이 4종으로 갈라져 있었다.
  미들웨어·페이지는 `?next=`, `requireAdmin` 은 `?redirect=`, **로그인 화면은 아무도 쓰지 않는
  `?returnTo=` 를 읽었다**. 모든 딥링크 복귀가 조용히 `/hub` 로 떨어졌다.
  → `lib/auth/redirect.ts` 가 이름을 단독 소유(쓰기는 `next` 하나, 읽기는 별칭 3종 흡수).
- 🔴 **로그아웃 수단 부재** — `/settings` 의 "로그아웃" 버튼에 `onClick` 이 없었다.
  `signOut()` 은 구현돼 있었지만 **import 하는 곳이 0곳**. 앱에서 로그아웃이 불가능했다.
- 🔴 **개인 화면 32개가 로그아웃 상태로 열림** — `(main)` 48 라우트 중 가드는 16개뿐.
  `/settings` · `/reports` · `/teacher` · `/my/words` · `/dashboard` 등이 비회원에게 열려 있었다.
  → `lib/auth/protected-routes.ts` 선언 + 미들웨어 강제. **도서·만화 카탈로그는 공개 유지**(발견·SEO).
- 🟠 **curator 역할이 죽어 있었다** — 미들웨어만 `role==='admin'` 을 요구하는데 RSC 가드는
  `curator` 를 허용했다. 미들웨어가 먼저 도니 curator 는 **어떤 admin 화면에도 못 들어갔다**.
- 🟠 **정지(suspended)가 아무 효력 없었다** — `user_profiles.status` 를 읽는 코드가 0곳.
  정지시켜도 그대로 로그인하고 전 기능을 썼다. → 로그인 시점 + 미들웨어 매 요청 검사.
- 🟠 **가입이 거짓 안내로 끝났다** — 프로젝트가 `mailer_autoconfirm=true`(메일 확인 꺼짐)라
  `signUp` 이 세션을 바로 주는데, 코드는 **무조건** `/verify-email` 로 보내
  "인증 완료 후 자동으로 로그인됩니다" 라고 오지 않을 메일을 기다리게 했다.
  → `data.session` 유무로 분기. `identities: []`(이미 가입된 이메일의 조용한 가짜 성공)도 방어.
- 🟠 **만료 링크가 "잘못된 접근입니다"** — Supabase 가 `?error=access_denied&error_code=otp_expired`
  로 되돌려 보내는 케이스를 콜백이 읽지 않아 "파라미터 없음" 으로 떨어졌다.
- 🟡 비밀번호 찾기가 **로그인된 사용자에게 발송 폼을 안 줬다**(세션만 보고 update 모드 확정)
  → 콜백이 `?mode=update` 를 명시하고, update 화면에 발송 폼 탈출구 추가
- 🟡 재설정·재발송 핸들러가 `try/finally` 뿐이라 **네트워크 예외를 조용히 삼켰다** → `catch` 추가
- 🟡 `/verify-email` 에 `?email` 이 없으면 재발송 버튼이 **눌려도 무반응** → 비활성 + 사유 표시
- 🟡 "30일간 로그인 유지" 체크박스가 아무 동작도 안 했다 → 제거(세션은 refresh token 이 연장)
- 🟡 `useSearchParams` 에 Suspense 경계가 없어 4개 인증 화면이 CSR 로 이탈 → 전부 `○ (Static)` 복귀
- 🟡 `requireAdmin` 이 매 요청 `user.id`·`email` 을 서버 콘솔에 찍었다(PII) → 제거
- 🟡 비밀번호 규칙이 가입(8자+영문+숫자)과 재설정(8자)에서 달랐다 → `lib/auth/validation.ts` 로 통일
- 🟡 로그인 실패가 "등록되지 않은 이메일" 로 **계정 존재를 흘렸다** → 자격증명 계열 문구 단일화

**신설** — `lib/auth/{redirect,validation,errors,account,protected-routes,types}.ts`
(세 화면에 복사돼 있던 `isValidEmail`·에러 매핑·경로 검증을 한곳으로. 이름이 갈라질 수 있던
구조 자체가 위 복귀 결함의 원인이었다)

#### 2차 스윕 — 같은 클래스의 결함 2건 (마이그레이션 `20260815020000`)

`user_profiles` 가 한 건짜리 사고가 아닐 수 있다고 보고 public 스키마를 전수 조사했다
(스윕 쿼리는 [DB_SCHEMA.md](./DB_SCHEMA.md#클라이언트-쓰기-표면-스윕-20260815020000) 에 남겼다).
RLS 미적용 테이블은 0건이었고, `shared_dictionary` 의 `FOR ALL qual=true` 는 `{service_role}`
한정이라 정상이었다. 실제 구멍은 둘:

- 🔴 **고아 테이블 3종이 anon 에 전면 개방** — `sw_players`·`sw_comments`·`st17_timetables` 가
  `FOR ALL TO anon USING(true)`. 제품 코드가 전혀 참조하지 않는(다른 실험의 잔여물) 테이블인데
  anon key 는 브라우저 번들에 있으므로 사실상 공개였다. **`sw_players.pass_hash` 를 anon key
  만으로 읽어냈다.** → 정책 제거 + `REVOKE ALL FROM anon, authenticated`.
  테이블 DROP 은 하지 않았다(데이터 삭제는 소유자 확인이 필요한 별도 결정).
- 🔴 **class_members 초대코드 우회** — `cm_self_join` 이 `user_id = auth.uid()` 만 확인해,
  class_id 만 알면 남의 클래스에 무단 가입하고 `role='teacher'` 로 적을 수 있었다.
  앱의 유일한 가입 경로 `join_class_by_code`(SECURITY DEFINER, invite_code 검증 + role 고정)가
  RLS 를 우회하므로 이 정책은 쓰이지 않는 우회로였다 → 제거.
  (`is_class_teacher` 는 `classes.teacher_id` 를 보므로 교사 권한 자체는 넘어가지 않았다.)

회귀 락 `lib/auth/__tests__/rls-surface.integration.test.ts` 14건 — 차단뿐 아니라
**정상 초대코드 경로가 살아 있는지**(과잉 차단 방지)까지 단언한다. 인증 계열 테스트 누계 **202**.

#### 설정 화면의 계정 컨트롤

- **비밀번호 변경이 "준비중" 으로 잠겨 있었다** — `/reset-password` 가 세션이 있으면 새 비밀번호
  모드로 열리므로 이미 동작하는 흐름이었는데 링크가 없었다. 즉 **로그인한 사용자가 비밀번호를
  바꿀 방법이 앱에 없었다**. → `/reset-password?mode=update` 로 연결.
- **계정 해지 버튼이 로그아웃과 같은 결함**(onClick 없음)이었다. 해지 백엔드(30일 보관 → 영구
  삭제)가 없으므로 배선 대신 나머지 미구현 항목과 같은 `준비중` 규약으로 비활성화했다 —
  눌리는데 아무 일도 없는 것이 가장 나쁘다.

#### ⚠️ 미해결로 남긴 것 — SECURITY DEFINER RPC 노출

`public` DEFINER 함수 119개 중 **98개가 `anon` 에 EXECUTE 부여**, 그중 **58개는 본문 가드도 없다**.
DEFINER 는 RLS 를 우회하므로 로그인 없이 호출된다(실증: `anon.rpc('get_lcp_config')` 성공).
`admin_*` 19종은 전부 role 가드가 있어 관리자 행위 탈취는 확인되지 않았고, 위험군은
`update_user_v_level` · `apply_diagnostic_result` 등 `p_user_id` 를 받는 파이프라인 함수다.

**이번 패스에서 고치지 않았다.** "앱이 안 쓰는 것만 회수" 로 접근했다가, `.rpc('리터럴')` grep 이
`DiagnosticClient` 의 **동적 호출**(`rpc(rpcName)`)을 놓친다는 것을 확인했다 — 그대로 회수했다면
진단 흐름과 LCP 파이프라인이 조용히 깨졌을 것이다. 후보 21종을 레포 전수 참조로 재검사했더니
전부 어딘가에서 참조돼, **안전하게 죽었다고 말할 수 있는 부분집합이 없다**.
조사 결과·회수 시 주의사항(RLS 헬퍼 4종은 절대 회수 금지)·다음 단계는
[DB_SCHEMA.md](./DB_SCHEMA.md#️-미해결--security-definer-rpc-가-anon-에-열려-있다-2026-08-15-조사-수정-보류) 에 정리했다.

함께 확인: Supabase Auth 의 **유출 비밀번호 차단(HaveIBeenPwned)이 비활성** — 대시보드 설정 1회로 켤 수 있다.

### 셸 재설계 — 첫 화면이 "아무것도 하지 않은 사람의 성적표"였다 ([ADR 0006](./adr/0006-shell-redesign-menu-status-tabs.md))

실측(2026-08-14 `/hub` 데스크톱 1화면): 내비게이션 시스템이 **3개**(Sidebar 16링크 ·
FlowNav 6 · MobileTab 4)로 서로 다른 분류를 썼고, 상태 지표 **19개 중 신규 학습자에게
18개가 0**이었다. streak 이 세 곳, 기억 4색이 두 곳. 첫 화면 선택지는 34개인데
의미 있는 목적지는 "진단" 하나뿐이었다. `axes.ts` 가 이미 표면을 4개로 확정했는데
하단 탭만 그것을 따르고 있던 **미완의 이행**이 원인이다.

- **D2 상단 상태 (적용)** — `StatusRibbon` 하나로 흡수. 지표 19 → 3(오늘 N/M · 흔들림 · 연속).
  **0 은 숫자가 아니라 문장이다** — 셋이 전부 0이면 숫자를 하나도 그리지 않고
  "아직 시작 전이에요 — 5분이면 오늘 할 일이 생겨요" + CTA 하나. 0을 나열하는 것은
  "당신은 아무것도 하지 않았다" 를 열여덟 번 반복하는 것과 같다(철학 ③ · 학습원칙 ⑦).
  `stable`·`new` 는 싣지 않는다(조치 불가 → Growth). 진행은 링 하나, 게이지·퍼센트 없음(철학 ④).
  정확도(%)는 되살리지 않는다 — 낮으면 압박, 높으면 무의미, 초반 표본이 작다.
- **"오늘 N/M" 은 전부 실데이터** — M=`prescribe_today` 가 낸 실행 가능 블록 수,
  N=그중 `daily_activity.by_module` 에 오늘 활동이 실재하는 블록 수. 별도 "완료" 상태를
  만들지 않는다(두 시스템은 반드시 어긋난다). 처방 계산 실패(`unavailable`)면 블록 0 —
  폴백을 "오늘 할 일" 로 표기하지 않는다.
- **D3 하단 (적용)** — 진행 실 1px + Today 점. 띠는 스크롤되어 사라지지만 탭 바는 고정이라
  주변시에 남는 유일한 신호다. 숫자 배지가 아니라 **점**인 이유는 숫자가 "밀린 일" 로 읽히기 때문.
- **D4 화면 탭 (적용)** — `/my` 폐지(탭 3 중 둘이 다른 표면의 중복이었고 이름도 retire 대상).
  `MyTabs`·`my/layout` 삭제 · `/my/texts`→`/text`(두 라우트 동작이 동일했다).
  Library 라벨 확정명: 도서→**책** · 스크립트→**짧은 글** · 공용 단어장→**세트**. URL 은 유지.
- **D1 메뉴 (부분)** — FlowNav 삭제(내비 3 → 2). 6링크는 전부 사이드바에 있어 접근 손실 0.
  **사이드바 16 → 6 은 미적용** — 모듈 7종의 새 자리(콘텐츠 상세의 모드 선택)가 선행 조건.
- **죽은 셸 코드 삭제** — `SidebarFooter`(import 0건인데 기본값이 `김학생`·`Lv 4`·`streak 7`
  목업 + 폐기된 Lv 축 · 배선되는 순간 목업이 화면에 뜬다) · `DashboardHeader`(import 0건 · 폐기 토큰).
- **순수/조회 분리** — `today-status.ts`(순수) + `today-status-query.ts`(server-only).
  합치면 클라이언트가 import 하는 순간 전 라우트 500 이 된다(v08.x 실제 사고 재발 방지).
- 회귀: `22-shell-status.spec.ts` 7종(띠 1개 · streak 표기 ≤1회 · 4색 범례 Today 부재 ·
  FlowNav 소멸 · 세션에서 숨김 · 44px) + 단위 15. **상태 번짐은 정적 검사로 안 잡힌다** —
  각 컴포넌트는 저마다 정상이고 합쳐 놓았을 때만 결함이라, 렌더된 화면 전체에서 센다.
  순변화 −262행.

### 단어장 컴포저 — 5 생성기를 레시피 하나로, 그리고 지면이 못 만드는 4유형

단어장을 만드는 코드가 **5곳**에 있었고 각자 다른 `curation_query` 방언을 썼다
(VCB 8-step=`null` · `publish-list-word-set` · `roots-publish-set` · `topics-publish-set` · KICE).
같은 값이 여러 곳에 있으면 한 곳만 고쳐지는 날이 오고, 실제로 NOISE register 6개가 두 스크립트에
복붙돼 있었다. 더 큰 문제는 **어느 것도 "좋은 단어장인가"를 수치로 답하지 못한 것**이다.

- **Recipe v3** — `population → select → organize → present` 4단 선언. 5 방언을 흡수하며
  **마이그레이션 없음**(기존 `shared_word_sets.curation_query jsonb` 재사용)
- **카탈로그 31종** — 시중 26유형(모집단 7 · 어휘구조 11 · 콘텐츠 4 · 학습방법 4) + 고유 5종
- **면(facet) → 요구 필드 자동 도출** — "Use 면 훈련" 선언이 예문 없는 단어를 후보에서 빼낸다
  (`framework/axes.ts` 의 `retrieval` 계약을 데이터가 강제)
- **평가기 7지표** + 통과선 0.80 — 미달이면 발행이 잠긴다(`force` 로만 넘김)
- 새 라우트 `/admin/vocab/studio` + 화면도움말 `vocab-studio` + Studio 탭
- 새 CLI `pnpm vcb:compose` (기본 드라이런, `--commit` 시 발행) · 평가 `pnpm vcb:compose-eval`
- 코드: `apps/web/src/lib/vcb/compose/*` (10 파일, 순수 코어 + resolve/publish) ·
  `components/admin/vcb/studio/*` (2) · `lib/vcb/server/compose-studio.ts`

**실측 (Round 1→3, 전문 [reports/vcb-compose-eval.md](./reports/vcb-compose-eval.md))**

- 생성 가능 28종 **전부 통과** 0.88~0.98 · 신규 테스트 39 · 전체 vitest 699 통과
- `unlock`: 200단어로 완전히 읽히는 문장 **201 vs 빈도순 23** (Pride and Prejudice, 전체 1,769)
- `recycle`: 평균 향후 재등장 **143.4 vs 94.1** (모집단 평균 32.2)
- 자산 결손 2종(`image_url`·`audio_url` 0%)은 0건 — 설계로 못 메운다는 사실을 테스트가 고정
- Round 1·2 가 잡은 결함 7건(우위 0, 재등장 0, 목차 굶기 등)은 [VCB_REDESIGN.md](./VCB_REDESIGN.md) §7

**Round 4·5 — 남은 한계를 능력으로** (개선을 측정했더니 결함이 하나 더 나왔다)

- `word-family` 56 → **300개/131묶음** — `base_word` 7% 대신 `derived_forms` 31% 를 역인덱스로 뒤집음
- **U5 `uncovered` 신설** — `published` 모집단 + `except` 로 "아직 어느 단어장에도 없는 말".
  매 유형에 붙던 novelty 경고(73~99% 겹침)를 손쓸 수 있는 능력으로 전환. 실측 novelty 1.00 · 총점 1.00
- `unlock` 커버리지 목표 — "몇 개" 대신 "이 책의 몇 %". Pride and Prejudice **90% = 1,691단어**
  (해금 문장 1,434 vs 빈도순 450)
- ⚠️ 개선이 오히려 56 → 35 로 떨어뜨린 결함 발견·수정: 컴포저가 예산만큼 뽑은 뒤 **다시 조직**해서,
  기본형(`attend`)이 부분집합에서 빠지면 그 계열(`attention·attendance…`)이 1인 그룹으로 흩어졌다.
  1차 조직을 정본으로 삼고 재조직을 없앴다(`pickGroups`).

**발행 실적 (dev)** — `unlock-pride-and-prejudice` 200 · `facet-ladder-300` 300 ·
`confusable-pairs-300` 299 · `day-30-ngsl` 600 · `uncovered-core-400` 400.
다섯 세트 모두 학습자 `/library/vocab` 테마별에서 확인.

**시중 베스트와 요소별로 겨룬다 — 경쟁 루브릭 + Round 6~19 (2026-08-15)**

7지표는 "선언한 것을 지켰나" 이지 "시중 책보다 나은가" 가 아니다. 두 번째 루브릭
`lib/vcb/compose/market.ts` — 13 경쟁 프로필(능률 VOCA·해커스·Word Power Made Easy·
Collocations in Use·Phrasal Verbs in Use·30일 완성·원서 부록·파닉스…) × **16 요소**.
유형마다 **같은 유형의 베스트**와 비교한다(빈도순을 어원편과 비교하면 부당하다).

- 결과: **28/28 전 요소 우위 또는 상한 동률** (Round 6 시작점 2/28)
- 기준선은 지면 매체의 **상한**으로 잡았다 — 뜻·발음·오류 1.00(편집자 교열). 우리에게 가장 불리한 가정

**측정이 잡은 진짜 결함 5건** (모두 "우리가 시중보다 못한 지점"):
1. 한국어 뜻 자리에 영단어 1,642건 → 모든 레시피에 `meaning_clean` 요구
2. 500개짜리 챕터 → `max_group_size` 30 분할(`V5 (1/3)`)
3. **"빈출 2000" 세트에 `is·am·s·m·d·comes·went`** → `content_pos_only`·`min_word_length`·
   `drop_pool_inflections` (legacy `publish-list-word-set` 가 content POS 를 걸던 이유가 이것이었다)
4. 원서 예문 6% 오판정 → 불규칙 굴절을 `inflected_forms`(15,217행)로 판정
5. "빈출 구동사" 가 `(as) sick as a parrot` 로 채워짐 → 사전식 변형 표제어 배제 +
   **챕터 분할을 선별 뒤로**(먼저 쪼개면 라운드로빈이 빈도 전 구간을 흩뿌린다)

**콘텐츠 보강** — 측정이 "데이터가 없다"를 가리킨 자리: 고빈도 연상 60 · 여행 주제 연상 48 ·
구동사 연상 21 + 연어 34 + 유의어 34 (house style `어근(뜻) → 연결 → 뜻` 유지).

G7 정의를 한 번 고쳤다: "동률 0" 은 원리적으로 불가능(뜻·발음·오류는 양쪽 1.00 상한) →
**깰 수 있는 동률**과 상한/해당 없음을 구분. 현재 깰 수 있는 동률 0.

전체 vitest **789 통과** · 매트릭스 [reports/vcb-compose-eval.md](./reports/vcb-compose-eval.md)

**학습자 동선 배선 — 도서 상세 Tier 2 자리를 채웠다 (2026-08-15)**

발행된 `unlock`·`recycle` 세트가 `/library/vocab` 테마별에서만 발견됐다. 그 책을 읽으려는
사람에게 가장 값나가는 목록인데 도서 페이지에는 없었다. 도서 상세에 v06.31 부터 비어 있던
**"보조 단어장 (선택) — 아직 준비되지 않았어요"** 자리가 있어 새 섹션 없이 그 약속을 지켰다.

- `fetchBookComposerSets` + `composerSetWhy` (`lib/library/books/queries.ts`) —
  `curation_query->>source_book_id` 매칭 (챕터 세트 판정 키 `book_id` 는 침범 안 함)
- 카드가 **왜 이 목록인지**를 학습자 말로 말한다: "이 200단어를 알면 이 책의 문장 201개가 온전히 읽혀요"
- ⚠️ `recycle` 문구를 한 번 되돌렸다 — 실측 평균 재등장 143.4 를 그대로 쓰면 "평균 143번 더
  만나요" 가 되어 과장처럼 읽히고 숫자 게이지 금지에 어긋난다 → "책이 대신 복습해 줘요"
- 회귀: `book-composer-sets.test.ts` 6건(대조군 수치·압박 어휘 노출 금지 고정) +
  e2e `22-book-composer-sets.spec.ts`(placeholder 문구가 남아 있으면 실패)
- 발행 추가: `recycle-pride-1-5` 80단어

**5 방언 대체 파리티 + KICE 고아 데이터 구조 (2026-08-15)**

"표현할 수 있다" 와 "같은 결과를 낸다" 는 다르므로 legacy 세트를 컴포저로 다시 뽑아 맞춰 봤다:

| legacy | 개수 | 컴포저 | 판정 |
|---|--:|--:|:-:|
| `etymology-core` | 1,500 | 1,500 | ✅ |
| `topic-travel` | 500 | 500 | ✅ |
| `curriculum-2022-mid` | 1,183 | 1,210 | ⚠️ +27 (legacy 가 content POS·길이≥3 추가 필터) |
| `kice-q31-34-blank` · `q18-24` · `q41-43` · `tier4` | 430·361·234·362 | 동일 | ✅ |

`roots-publish-set.mjs` · `topics-publish-set.mjs` · `publish-list-word-set.ts` 헤더에
**SUPERSEDED + 대체 명령**을 적었다 (파일 복사 = 6번째 방언).

⚠️ **살아 있는 결함 발견** — `regenerate_curated_word_set` RPC 가 CASCADE 삭제된 `word_lexicon` 을
읽는다 → **KICE 4 세트는 지금 재생성 버튼을 누르면 실패한다** (CLAUDE.md 가 추적하는 "없는 테이블
참조 RPC" 의 구체적 사용자 영향). 문항유형 데이터(`question_history`)는 `lexicon_source_tags`
(lexicon_id 키)에만 있었고 유일한 다리가 `shared_words.lexicon_id` 였다 — 그 세트를 재발행하면
영구 소실되는 상태였다.
→ **673 lemma 를 `lexicon_frequencies.metadata` (lemma 키·생존 테이블)로 구조**(DDL 아님, 키 추가).
컴포저 `exam_items` 에 `question_nos`/`frequency_tier_min`/`raw_count_min` 필터를 붙여 4 세트를
정확히 재현 가능하게 했다. 나머지 87%(5,421 중)는 복구 불가 — 새 문항유형 세트는 만들 수 없다.

⚠️ 코퍼스 세트의 `category` 는 `themed` 다 — 학습자 카탈로그 9 카테고리에 `library_book` 이 없어
`library_book` 으로 내면 **발행되고도 보이지 않는다**(실측 후 수정). 출처는 `curation_query.source_book_id`
로 남기며, `book_id` 키는 기존 챕터 세트 1,129개가 판정에 쓰므로 쓰지 않는다.

### ScriptQuiz 의 "FSRS 0행" 은 결함이 아니었다 — 남길 단어가 없다

F3 다음으로 F5(문맥) 빈칸을 닫으려고 ScriptQuiz 를 열었는데, **설계안의 전제 절반이 틀렸다.**
"ScriptQuiz · Dictation 을 결합 계약의 1급 시민으로" 라고 돼 있었지만 둘의 사정이 전혀 다르다.

- **문항 1,019(`library_chapter_quiz`) + 5(`quiz_questions`) 어디에도 대상 단어 컬럼이 없다.**
  문항 자체가 서사 이해다 — *"Wickham 에 대한 여론은 어떻게 뒤집혔나"*. 줄거리 문제 정답을
  그 문장에 든 단어의 인출로 세는 것은 설계안 §9 가 금지한 바로 그 승격이다(TAP).
- **적재 경로가 없는 게 아니라 층이 다르다** — 이 활동이 재는 본문 이해는 `scores` 에
  이미 남는다(실측 15행). 레지스트리 주석이 `// 실측 0행 — 결함` 이라 적어 둔 것이 오진이었고,
  그대로 두면 다음 사람이 **추측을 기록으로 만드는 배선**을 하게 된다.
- 빈칸을 진짜로 닫으려면 문항이 대상 단어를 갖게 하는 **콘텐츠 모델 변경**
  (`library_chapter_quiz` 컬럼 + 1,019 문항 백필)이 선행돼야 한다. 비용이 커서 별도 결정으로 남겼다.

**같은 조사에서 오진 두 건을 더 걸렀다** — 기록 테이블만 보면 셋 다 "쓰기 경로가 깨졌다" 로 읽힌다:

| 관측 | 실제 |
|---|---|
| SpellForge `records: true` 인데 `learning_records` 0행 | **아무도 안 했다** — `scores` 도 0행이라 그렇게 판별 |
| Dictation `scores` 0행인데 완주가 `recordGameScore` 호출 | **내 e2e 가 finally 에서 지운다**(`deleteScoresSince`) |
| ScriptQuiz `learning_records` 0행 | 위 — 남길 단어가 없다 |

→ `records: false` 앞에서 **"안 쓰는 것인가 · 못 쓰는 것인가 · 안 쓰인 것인가"** 를 먼저 묻도록
[LEARNING_FRAMEWORK.md](./LEARNING_FRAMEWORK.md) 에 판별법을 명시.

**락 추가**: `facetCoverage().use` 를 단언(설계 3 · 기록 2, 차이는 ScriptQuiz 하나).
작성 중 이 단언이 **내 실수를 먼저 잡았다** — grep 으로 세어 2 라고 썼는데 `word-customs` 를
놓쳤고, 문서의 3 이 맞았다. 하마터면 맞는 문서를 틀리게 고칠 뻔했다.

### EchoMatch 를 청각 면(F3)에 잇는다 — 그리고 복습 간격은 일부러 안 건드린다

설계안 §8 이 "청각 처방 불가" 의 원인으로 **EchoMatch 가 FSRS 밖에 산다** 를 지목했다.
면 6개 중 Sound 만 기록 경로가 하나(Dictation)뿐이라, "이 단어는 소리가 약해요" 를 말할 근거가 없었다.

**근거의 등급을 나눈 것이 이번 설계의 핵심이다.** EchoMatch 는 두 가지를 동시에 재는데 강도가 다르다:

| 근거 | 무엇을 말하나 | 언제 쓰나 |
|---|---|---|
| 음성인식 전사 `matchedKeys` | **그 단어가 발화에 나왔는지** 하나하나 | 있으면 이걸 쓴다 (단어 수 상한 없음) |
| 프로소디 점수 | 문장의 억양·강세·리듬 정합 — comparator 자신이 "음소 정확도가 아니다" 라고 밝혀 둔 값 | 인식이 없을 때만 보조 (한 발화 최대 3단어, 긴 단어 우선) |

**실측이 설계를 두 번 바꿨다**:
- `echo_match_attempts` 6건 중 **4건이 발화 실패**였다 — `(0,0,0)` 2건은 voiced 프레임 부족(무음·마이크 실패), `(p0,e0,t90)` 1건은 길이만 우연히 맞은 것. 이걸 오답으로 적재하면 **마이크가 고장난 학습자에게 "청각이 약하다" 는 처방**이 간다 → 측정 실패는 오답이 아니라 **무기록**
- 플레이어가 이미 `wordRatio < 0.4` 에서 "단어가 잘 안 들렸어요" 로 재읽기를 권하고 있었다 → 화면이 못 알아들었다고 말한 발화는 기록도 성적으로 읽지 않는다(같은 임계값 재사용)

**의도적으로 안 한 것 — FSRS 복습 간격**: EchoMatch 는 문장이 화면에 떠 있는 채로 따라 말하는 활동이다. 보고 읽는 것은 **인출이 아니다**(TAP · Barcroft). 인출이 아닌 것을 인출로 세면 복습 스케줄이 조용히 늘어나 정작 못 외운 단어가 안 돌아온다. 그래서 `learning_records`(면 이력 + 그날의 활동)만 남기고 `vocabularies` 의 D/S 는 건드리지 않는다. `rating` 도 비운다 — FSRS 채점칸에 값을 넣으면 이 활동이 복습 등급을 매긴 것처럼 읽힌다.

- 마이그레이션 `20260814090000_module_id_echo` — `module_id` enum 에 `'echo'` (29번째 값)
- `lib/echo/word-signal.ts`(순수 판정) + `lib/echo/record-sound.ts`(적재) — `word-progress.ts` ↔ `word-progress-query.ts` 와 같은 분리
- 레지스트리 `echo.records: false → true`, `ModuleId` 에 `'echo'`
- 테스트 +19: 단위 16 · **실 DB 통합 3**(enum INSERT 통과 · sound 면으로 접힘 · D/S/review_count 불변)
- 회귀 락이 작동했다 — `framework.test.ts` 의 "청각 면 기록 활동 수 1" 단언이 변경을 잡아 근거와 함께 2로 갱신

**한계 (알고 남긴다)**: 신호 대상은 `vocabularies.text_id` 로 그 텍스트에 담아 둔 단어다(dictation 과 같은 기준). 실측 2,189 단어 중 481(22%)만 `text_id` 를 갖고 58 텍스트를 덮는다 — 다른 챕터에서 담은 단어는 이 챕터를 따라 말해도 안 잡힌다. e2e 검증 텍스트(`EchoMatch Runtime Test`)는 학습자 단어가 **0개**라 이 경로가 실행되지 않는다(공유 픽스처를 늘리면 추출 계열 회귀의 후보 수를 건드리므로 손대지 않았다).

### 면×단계 매트릭스 — 축이 실데이터로 계산된다 (Phase 4 backbone)

`flow.ts` 가 `WordFrameworkState`(passed·accuracy·hits·memory·encounters)와 이동 조건
(`canAdvance`)을 선언해 뒀는데 **그 상태를 만드는 코드가 어디에도 없었다.** 축과 판정 규칙은
있고 입력이 없으니 처방이 쓸 수 없었다 — 레지스트리 소비자가 0이던 것과 같은 종류의 공백이다.

- **`lib/framework/word-progress.ts`(순수)** — `learning_records.module` → 레지스트리
  `Activity.facets` 로 단어별 면 이력을 접는다. 면을 따로 저장하지 않는 이유는 Stage 를
  저장하지 않는 이유와 같다(두 벌을 두면 어긋난다).
- **통과 판정은 횟수와 정답률을 함께 본다** — `hits ≥ HITS_TO_PASS(2)` **그리고**
  `정답률 ≥ ACCURACY_HOLD_BELOW(0.7)`. 정답률만 보면 1/1(100%)이 통과가 되고,
  횟수만 보면 2/10 이 통과가 된다. 둘 다 거짓이다.
- **`weakestFacet()`** — 설계안이 "화면에 보이라" 한 *가장 뒤처진 면 하나*.
  **시도조차 없는 앞 면이 정답률 낮은 뒤 면보다 먼저다**(앞을 건너뛰지 않는다).
  cross 면(Sound·Build)은 고르지 않는다 — "발음을 모르면 문맥으로 못 간다" 는 근거 없는 게이트를 안 만든다.
- **`word-progress-query.ts`(server-only)** — 조회부 분리. 기억 상태는 저장하지 않고 R(t) 로 계산.
  ⚠️ 노출 횟수(`encounters`)의 정본이 아직 없어 `review_count` 를 하한 근사로 쓴다 —
  읽기 노출까지 세려면 reading 계층이 단어 단위 기록을 남겨야 한다(미구현).
- 단위 18. 실데이터 검증(같은 규칙을 SQL 로 재현): spell 87시도/1통과 · recognize 71/3 ·
  sound 61/0 · use 61/0 · fluency 52/1 · build 0/0. 축이 실제로 구별을 만든다.

**소비자는 아직 없다** — 이 값을 화면에 쓰는 것은 처방(hub)과 Vault 화면의 일이고,
지금 그 두 곳은 다른 작업이 진행 중이라 손대지 않았다. 다음 단계로 남긴다.

### 모바일 전역 내비 — 하단 탭 4개 (Phase 3 의 출발점)

설계안 실측 게이지 중 하나가 **"모바일 전역 내비 링크 0개"** 였다. 사이드바가 `hidden md:flex`
라 좁은 화면에서는 링크를 타고 들어가면 **되돌아 나올 길이 없었다**. 설계안이 "4개 최상위를
하단 탭으로 **먼저** 설계하고 데스크톱을 그 확장으로 둔다" 고 못 박은 이유다.

- `components/layout/MobileTabBar.tsx` — 오늘·서재·내 단어·성장. `md:hidden`(데스크톱은 사이드바가 같은 일)
- **목록을 자체로 갖지 않는다** — `SURFACE_ORDER` + `SURFACES[].href` 가 단일 출처다.
  탭이 자기 배열을 들면 그게 10번째 내비 표면이 되고 표면을 옮길 때 갈라진다.
  그래서 `axes.Surface` 에 `href` 를 추가했다(경로는 선언의 대상이라는 Phase 0 원칙 그대로).
- 학습 세션에서는 사라진다 — 사이드바·FlowNav 와 **같은 판정**(`isFullScreenRoute`)을 쓴다.
  셋이 갈리면 세션 화면에 내비가 하나만 남아 더 이상해진다.
- 탭 높이 56px(44px 하한 초과) · `aria-current` + 굵기로 현재 위치 표시(색 단독 금지) ·
  `safe-area-inset-bottom` 반영 · 본문에 그만큼 하단 여백
- 회귀 `04-ui-smoke` +2 (390px 폭 4탭 이동·44px·aria-current / 세션 중 사라짐).
  axe 모바일 폭 라이트·다크 위반 0 실측.

**이것은 메뉴 개편(Phase 3)이 아니다** — 표면이 흡수할 대상(`SURFACES[].absorbs`)은 아직 각자
라우트에 있고, 여기서는 **진입점만** 준다. 데스크톱 사이드바 8그룹/14리프는 그대로다.

### 프레임워크 결정 1·2 확정 + 콘텐츠 스코프 일반화 (Phase 2)

[VOCAB_FRAMEWORK_PROPOSAL.md](./VOCAB_FRAMEWORK_PROPOSAL.md) §9 의 남은 두 결정을 권장안으로 확정.

- **결정 1 → C(하이브리드)** — 콘텐츠는 자유, 콘텐츠 안에서는 경로. A(단선)로 좁히는 것은
  **데이터가 말할 때** 한다(지금은 실사용 분포를 모른다 · §12 위험 1). 되돌리기 쉬운 쪽이 먼저다.
  C 가 코드에 요구하는 것은 메뉴 개편이 아니라 **콘텐츠 표현의 단일화**였다 —
  "콘텐츠를 고르면 할 수 있는 활동이 도출된다" 는 이미 `registry.activitiesForContent(ref)` 가 한다.
- **결정 2 → A(전부 유지, 위치만 이동)** — 19종을 하나도 지우지 않는다. 축소(B)는 IA 를 고친 뒤
  재측정해서 판단한다. 지금 지우면 "안 보여서 0건" 인 것까지 함께 지우고 그 사실은 영영 모른다.
  **코드 변경 없음**(삭제 금지가 결정의 전부).
- **스코프 일반화** — `fetchWordsForContent(client, ContentRef, userId)` 신설. 스코프가
  `?set=`/`?text=` 두 가지뿐이라 도서로 놀려면 반드시 enroll 해야 했다.
  이제 `?book=`(+`?chapter=`)로 **큐레이션 챕터 단어장을 바로 연다**. 챕터를 생략하면 첫 챕터.
  `use-word-scope` 와 `play-scaffold` 가 `contentRefFromScope` 하나만 쓴다 — 유형이 늘면 어댑터 한 줄.
- 회귀 `19-content-scope.spec.ts` 2종 + 단위 +3.
  ⚠️ 스펙은 도서를 **조건으로 찾는다**(발행·저작권 안전·단어 충분) — id 하드코딩은 조용히 낡는다.
  만들면서 `status='ready'` 도서로 0단어가 나왔는데, 그건 결함이 아니라 RLS
  (`read words of published`)가 발행 도서 단어만 읽히게 하는 **정상 동작**이었다.


### 흐름 연속성 차원 검증 — 지표가 셸을 세고 있었다 (16회차)

15회차가 스윕에 "흐름 연속성"(막다른 길 탐지)을 넣고 **미검증**으로 남겼다. 돌려 보니
**막다른 길 0** 이었는데, 좋아서가 아니었다.

- **지표가 원리적으로 0 만 낼 수 있었다** — 링크를 `document` 전체에서 셌다. 사이드바·FlowNav·
  하단 탭이 모든 화면에 평균 **10.7종**을 얹으므로 어떤 화면도 0 이 될 수 없다. 항상 통과하는
  지표는 지표가 아니다. 셸은 `<main>` 밖에 있으므로 **본문 안만** 세도록 바꿨다(셸 링크는 참고값으로 분리).
- 바꾸자 **막다른 길 14건**이 나왔다. 그런데 `/dictate/setup` 은 버튼이 0개로 잡혔다 —
  직접 재 보니 **900ms 에는 0개, 4초에는 `시작하기 284x45`** 였다. 스켈레톤을 잰 것이다.
- **여기서 진짜 문제가 드러났다 — 이 스윕은 재현되지 않았다.** 같은 커밋을 두 번 재면
  터치 위반 **241 ↔ 182**, 막다른 길 **0 ↔ 6**(`/dashboard`·`/plan`)이 나왔다. 고정 대기(900ms)도,
  "요소가 하나라도 생기면"(8초)도 결국 **그리는 중**을 재기 때문이다. 재현되지 않는 측정에는
  베이스라인을 세울 수 없고, 15회차가 이 스펙을 CI 에 넣어 둔 상태였다.
  → **DOM 이 멎을 때까지 대기**로 교체(`MutationObserver` · 700ms 무변경 · 최대 20초).
  20초 안에 안 멎은 측정은 **단언에서 제외**하고 리포트에 미안정으로 남긴다 —
  반쯤 그려진 화면의 "위반 없음" 은 사실이 아니다(실측: `/dashboard` 가 안 멎는다).
- **그래도 dev 에서는 재현되지 않았다.** 대기를 넣고 같은 커밋을 연속 2회 재도
  `/library/vocab` 19 ↔ 17 · `/diagnostic` 7 ↔ 5 · 막다른 길 1 ↔ 2 였다. 콘솔 500 도
  라우트가 아니라 하위 리소스였고(`/library/scripts` 직접 요청은 3/3 200), 회차 도중
  **다중 `next dev` 로 `.next` 가 오염돼 전 라우트가 500** 이 되는 일까지 있었다.
  원인이 제품이 아니라 환경이므로 **판정을 CI 로 옮겼다** — CI 는 `next build` 산출물을
  `next start` 로 띄워 컴파일 지연도 세션 경합도 없다. dev 는 같은 값을 **출력만** 한다.
  환경에 흔들리지 않는 것(가로 넘침 · 이름 없는 컨트롤)은 dev 에서도 그대로 실패시킨다.
  재현되지 않는 값으로 빨간불을 켜는 것은 15회차가 미검증 지표를 CI 에 넣은 것과 같은 실패다.
- **콘솔 에러 30 → 0** — `NAVIGATION_FAILED` 는 제품 결함이 아니라 **dev 서버 콜드 컴파일**이었다
  (첫 케이스 20건 실패 → 마지막 케이스 3건, 순전히 콜드/웜 차이). 측정 전에 전 라우트를 한 번
  여는 워밍업 패스를 넣었다. CI 는 `next start` 라 몇 초에 끝난다. 느린 화면 예외 3종은 삭제.
- **터치 타겟 베이스라인을 총합에서 화면별로 바꿨다** — 202 는 덜 센 값이었고(20개 화면이
  열리지도 않은 채 측정), 총합 자체가 **같은 조건 재실행에서 238 → 241 로 흔들렸다**
  (같은 요소가 3 케이스 중 2 개에서만 잡히는 일). 흔들리는 수를 `<=` 로 막으면 스펙이 무작위로
  빨개진다. 화면별 **고유 라벨 수**(케이스 중복 제거 · 크기는 키에서 제외)로 바꾸니 흔들림이
  줄고, 실패 메시지가 **어느 화면이 나빠졌는지** 바로 말한다. 베이스라인은 안정화 대기를 넣은
  실행들의 **최댓값**(18화면 97종 — `/library/vocab` 19 · `/settings` 18 · `/plan` 14 …).
- **최종 검증** — `.next` 정리 후 재실행에서 **72/72 안정화**(첫 완전 안정) · 막다른 길 0 ·
  터치 악화 0 · 가로 넘침은 기존 3화면(`/plan` 126px · `/library` · `/library/books` 61px)뿐 ·
  이름 없는 컨트롤 0. `10-a11y-sweep` + `20-mobile-shell` **7/7 통과**.
- 리포트 출력을 `test-results/` 밖(`a11y-report/`)으로 옮겼다 — Playwright 가 실행 시작 때
  그 디렉터리를 통째로 지워서, 동시 세션이 있으면 **남의 실행이 내 리포트를 지운다**(이번에 2회 유실).

**실제로 고친 화면 — `/reports`**: 유일한 컨트롤이 `이번 주 갱신` **113x36**(44px 규칙 위반)이고
본문에 앞으로 가는 링크가 **0개**였다. 빈 상태는 "학습을 시작하면 리포트가 쌓여요" 라고 말해 놓고
**시작할 길을 주지 않았다.** 44px 하한 + 양쪽 상태에 `오늘 할 일 보러 가기`(→ `/hub`, 처방 정본 하나) 추가.

### 모바일 하단 탭이 페이지의 하단 조작을 덮고 있었다 (신규 `20-mobile-shell` 6건)

프레임워크 §3.3("모바일이 출발점")로 들어온 `MobileTabBar`(최상위 4 표면)를 실측 검증했다.
**탭이 만화 리더의 컷 이동 바를 가로채고 있었다** — `elementFromPoint('다음 컷' 중심)` 이
탭 링크를 돌려줬다. 보이는데 눌리지 않고, 누르면 다른 화면으로 간다.

- **z-index 로 판정하면 놓친다** — 리더 바 `z-30` vs 탭 `z-40`. 새 스펙은 히트 테스트로 잰다.
- `--tabbar-h` 토큰 하나로 셋을 정한다: 탭 아래 여백 · 페이지 소유 하단 고정 UI 의 `bottom` ·
  md 이상 `0px`. 만화 리더(`ComicReader`)와 워크스페이스 오디오(`FloatingAudioPlayer`)가 그 값을 쓴다.
- **오디오 플레이어에는 `pointer-events-none`(숨김 시)을 같이 넣었다** — `bottom` 이 0 이 아니게 되는
  순간 `translate-y-full` 로 내려간 자리가 **탭 바 위**가 되어, 없는 플레이어가 탭 터치를 먹는다.
- **하단 여백을 레이아웃에서 걷어내 탭 컴포넌트로 옮겼다** — `(main)/layout` 에 `pb-` 로 두니
  **탭이 없는 풀스크린 세션에도** 56px 이 남아 세션 화면이 뷰포트보다 길어졌다(스펙 D 가 잡음).
- 회귀 6건: 4 표면·44px·`aria-current` / 데스크톱 부재 / 풀스크린 부재 / 풀스크린 여백 0 /
  여백 = 탭 높이 / 만화 리더 히트 테스트.

### 형태 규칙 구조적 갭 — `-ves` 복수가 아예 없었다 (마이그레이션 1건)

Simplicissimus 처분 중 `wheatsheaves → wheatsheave`(실패)를 만나 규칙 수준으로 되짚었더니
**`en_inflection_bases` 에 `-f`/`-fe` 명사의 `-ves` 복수 규칙이 통째로 없었다**. 그동안
`thieves`·`wolves`·`loaves` 가 해석된 것은 `english_irregular_forms` 와 cluster 티어가 개별로
덮고 있었기 때문이고, **바인딩 경로(`trg_lbv_fill_lemma`)는 이 부류를 통째로 놓치고 있었다.**
한 권의 1건으로 보였던 것이 실제로는 **177권 · 486행**이었다.

- **★ 그대로 넣으면 안 됐다** — 동사 3인칭 `-ves` 와 충돌한다: `saves→safe` · `caves→cafe` ·
  `serves→serf`(셋 다 사전 실재 표제어). 바인딩 트리거는 `ORDER BY id.word`(알파벳)라
  **`safe` 가 `save` 를 이긴다**. 규칙을 넓히기 전에 오탐부터 찾은 것이 이 결함을 막았다.
- **가드** — `-ve` base 가 사전에 있으면 `-f`/`-fe` 후보를 내지 않는다. 실측(`%ves` 210 lemma):
  **차단 182**(absolves·achieves·archives·arrives·behaves…) · **통과 28**(knife·wolf·thief·loaf·
  wife·self·sheaf·scarf·hoof·wharf·elf·turf·midwife·housewife·beef·bookshelf·mischief·wheatsheaf…).
- **결과** — 177권 재바인딩 후 대상 20 lemma **475행 전부 바인딩 · 미바인딩 0**.
  Simplicissimus `lemma_bound` 7,521 → 7,527 · 커버리지 94.1% → **94.2%**.
  **발행 13권 I10 회귀 없음** — 드리프트는 기존 4권(Sociology 38 · Christmas Carol 16 · Fables 13 ·
  Styles 6) 그대로이고 수치도 동일. 새 드리프트 0.
- **`en_derivational_bases` `-ish` 비대칭** — 형제 규칙(-ly·-er·-en·-ion·-ity·-able·-or·-ance·
  -ence)은 전부 `strip`/`strip+e` 두 벌인데 `-ish` 만 한 벌이라 `epicurish → epicur`(실패)였다.
  `+e` 복원 추가 → `epicurish→epicure` · `millionairish→millionaire`.
- **하지 않은 것 — 두 파생 규칙 집합의 통합.** `lookup_word_meaning` 의 derivation 티어(12 규칙)와
  `en_derivational_bases`(100+ 규칙)가 갈라져 있어 통합이 자연스러워 보였다. 실측하니 **통합하면
  안 된다**: `not_found` 5,827 중 453건이 base 를 얻지만 부정 접두사 가드를 통과한 274건조차
  `ation→at` · `barant→bar` · `bative→bat` · `bombance→bombe` 수준이다. ADR 0004 D4 의
  "틀린 뜻은 뜻이 없는 것보다 나쁘다"에 정면으로 걸린다. 분리는 결함이 아니라 **재현율(seed 후보 —
  뒤에서 검수) 대 정밀도(학습자 즉시 노출)의 의도된 분리**이며, 다음 사람이 같은 착각을 하지
  않도록 두 함수의 `COMMENT` 에 명시했다.

### 세트 결합 — 놀면 내 단어가 된다 (프레임워크 결정 3 · A안 채택)

[VOCAB_FRAMEWORK_PROPOSAL.md](./VOCAB_FRAMEWORK_PROPOSAL.md) §9 결정 3 을 **(a) lazy 승격**으로
확정했다. v08.5 가 먼저 (b) 스킵 노출로 구현돼 있었다 — 사실을 알려주긴 했지만 학습자에게
한 걸음을 더 요구했다. 실측 97.9% 가 이 경로였다(내 단어 225 vs 세트 단어 56,079 · 겹침 2.1%).

- **`recordGameResult` 가 담고 나서 진행한다** — 내 단어가 아니면 `promoteFromSet` 으로
  `shared_words` 에서 뜻·예문·발음·POS·CEFR 을 가져와 `vocabularies` 에 넣고, 그 카드로 FSRS 를 올린다.
- **자격을 현재 세트로 좁혔다** — 구독 전체로 넓히면 이름만 겹친 게임 내장 뱅크 단어가 딸려
  들어와 학습자 단어장이 오염된다. 담을 수 없는 것(뱅크 단어 · `meaning_ko` 없음)은 종전대로
  `not-mine` 이고 (b)의 고지가 그대로 뜬다.
- **`lemma` FK 함정 방어** — `vocabularies.lemma` 는 `shared_dictionary(word)` FK 라 세트 lemma 가
  사전에 없으면 INSERT 전체가 23503 으로 죽는다. 붙여 보고 실패하면 **lemma 없이 재시도**한다
  (결합 키는 어차피 소문자 `word` — 제안 문서 §5.5).
- **승격 알림** — 단어장에 쓰는 일을 말없이 하면 그것도 침묵이다. 스캐폴드가
  "이 세션에서 만난 N개를 내 단어장에 담았어요 · 이제 복습에도 나옵니다" 를 띄운다(비차단·비모달).
  **담은 것과 못 담은 것이 함께 있으면 한 줄에 같이 적는다** — 좋은 소식이 남은 사실을 덮으면
  그게 새로운 침묵이 된다(첫 구현에서 실제로 그렇게 만들었다가 아케이드 회귀가 잡았다).
- `promoted` 는 가드(assisted·cooldown)에 걸려 카드를 못 올려도 유지된다 — 이미 담긴 사실은 잃지 않는다.
- 계약 반전: `16-coupling-notice.spec.ts` 를 A안 계약으로 다시 씀(승격 고지 + `vocabularies`
  실적재 DB 단언 + B안 고지 부재). ⚠️ finally 원복 필수 — 남기면 `pickSetWithoutOverlap` 이
  고를 세트가 실행마다 줄어 테스트가 스스로를 무력화한다.

### RLS 만으로는 반쪽이었다 — DEFINER RPC 가 같은 데이터의 두 번째 문 (마이그레이션 1건)

`20260814024656_rpc_inherit_book_gate` — 어제 세트 RLS 를 조여 놓고 "노출 경계를 데이터 계층에서
강제했다" 고 적었는데, **틀렸다**. `SECURITY DEFINER` 함수는 정의자 권한으로 돌아 RLS 를 통째로
우회한다. 한쪽 문만 잠근 것이었다.

**실측 (일반 학습자 계정 role=user 로 직접 호출)**

```
deliver_chapter_vocab(Dialogues=미발행 'ready', ch10)  → ⚠ 단어 30개 반환
같은 세트를 PostgREST 로 조회                          → 0행 (RLS 는 정상)
enroll_library_book(같은 도서)                         → 정상 거부 ✓
_enroll_book_subscribe_word_sets(...)                  → ⚠ 실행됨
```

- **`deliver_chapter_vocab`** — pool WHERE 에 원본 발행 게이트 추가 → **0행 반환**.
  RAISE 로 바꾸지 않았다: 호출부가 "0행 = 아직 단어장 없는 도서" 로 읽고 폴백 경로를 타도록
  설계돼 있어(ChapterLevelWords 주석), 예외를 던지면 정상 폴백이 콘솔 에러가 된다.
  폴백이 읽는 `library_book_vocabularies` 는 이미 같은 조건의 RLS 로 막혀 있다.
- **`_enroll_book_subscribe_word_sets`** — `REVOKE EXECUTE`(PUBLIC·anon·authenticated).
  `p_user_id` 를 **호출자가 지정**하는 DEFINER **쓰기** 함수였다 — 학습자 A 가 B 의 계정에
  구독·단어를 밀어 넣을 수 있었다. 정당한 호출자 `enroll_library_book` 은 DEFINER 라 무영향.
- **`subscribe_article_word_set`** — 글 발행 게이트 추가. 지금은 135/135 발행이라 노출 0 이지만
  미발행 글 하나가 생기는 순간 같은 구멍이다. 인스턴스가 아니라 클래스를 닫는다.

게이트 조건은 `library_book_vocabularies`·`library_chapters_master` 의 **기존 RLS 와 문자 그대로
동일**하다 — `EXISTS(library_books … status='published' AND copyright_safe_in_kr)`.
이 두 테이블은 처음부터 그랬다. 예외였던 건 세트와 이 RPC 들이다.

적용 후 재프로브: 미발행 30개 → **0개** · 발행 도서 정상 전달(Ammachi ch1 → 8개) ·
내부 헬퍼 `permission denied` · 발행 글 구독 정상. 회귀 3건 추가(총 8건).

**교훈**: "RLS 로 막았다" 는 문장은 DEFINER 함수 목록을 확인하기 전까지 참이 아니다.
새 DEFINER 함수를 만들 때, 그 함수가 읽는 테이블의 RLS 에 원본 발행 조건이 있으면
같은 조건을 함수 본문에도 직접 넣어야 한다.

⚠️ 프로브가 검증 계정에 단어 7 · 구독 1 을 남겨 즉시 원복했다(vocab 252 복귀).
쓰기 RPC 를 실계정으로 찔러 보면 반드시 되돌릴 것 — e2e 가 이 계정 수치를 단언한다.

### SSoT 드리프트를 야간 상시 측정 — 우연히 발견되던 결함을 지표로 (마이그레이션 1건)

`20260814015130_quality_metrics_ssot_drift` — `collect_quality_metrics()` 에 M7 추가.

발행된 챕터 단어장은 추출 로직이 바뀌어도 **자동으로 따라가지 않는다**(재발행해야 반영).
그런데 그걸 알려 주는 I10 은 `run_content_quality_gates('book', id)` 에만 있었다 — 전역 게이트에도
없고, `/admin/quality` 에도 없고, `content_gate_publishable` 도 I10 을 제외한다. **어느 화면에도
안 떴다.** 그래서 발행 도서 전권이 어긋난 채 몇 주가 갔고, 2026-08-12 에 통합 테스트를 되살리다
우연히 발견됐다. 우연에 기대는 감지는 감지가 아니다.

- 지표 2행(stage=publish) — `published_set_ssot_drift_books` · `published_set_ssot_drift_words`.
  `dims.drifted` = `{도서명: 건수}` 로 **어느 책인지** 같은 카드에서 보인다("몇 권"만으로는 조치 못 한다).
- 대상은 **발행 도서만** — 미발행 도서 세트는 RLS(20260813110729)가 학습자에게 가리므로 제외.
  실측 결과 학습자에게 실제로 가는 드리프트는 **4권 / 73단어**뿐이고, 러너가 보여주던 큰 숫자
  (Les Misérables 5,702 · Dialogues 9,697)는 전부 미발행 도서였다.
- 비용: 도서당 추출 1회 — 수집 전체가 9행/즉시 → **11행/21.9초**(야간 pg_cron 03:10 KST).
  ⚠️ 드리프트 서브쿼리는 **temp table 로 1회만** 평가한다. CTE 로 두면 outer 참조 횟수만큼
  재실행돼 19초가 37.9초가 된다(`EXPLAIN ANALYZE` 에 `SubPlan 1`·`SubPlan 2` 로 드러남).
- `/admin/quality` 한글 라벨 2개 + 화면도움말(조치 명령 · 20초 지연이 고장이 아님 · 발행 도서 한정) 반영.
- 회귀 1건 추가 — 라벨 누락 시 metric 원문이 노출되는 것과 `dims.drifted` 렌더를 함께 고정.

**부수 정정** — `select_book_chapter_vocab` 를 supabase-js `.rpc()` 로 부르면 **1000행에서 잘린다**
(PostgREST 기본 상한). 실제 P&P 1,794행 · Sociology 4,529행. 이 절단 때문에 "세트 없는 챕터"
조사를 한 번 틀리게 냈다(Fables 3챕터를 2챕터로). 추출 결과를 세는 조사는 DB 안에서 해야 한다.

**재발행 보류** — 동시 작업 세션이 추출·사전 로직을 계속 고치고 있어(`simplicissimus_unbound_disposition`
· `foreign_citation_marking` · `fix_he_it_pronoun_entries` …) 재발행 직후에도 다시 드리프트가 생긴다.
실제로 2026-08-13 에 0 으로 만든 Styles·A Christmas Carol 이 각각 6·16 으로 되돌아갔다.
그쪽 작업이 끝난 뒤 `--drifted-only` 로 한 번에 하는 게 맞다. 이제 M7 이 매일 밤 상태를 알려 준다.

### 터치 타겟 전수 프로브 — 위반이 추출 화면만의 문제가 아니었다 (12회차)

11회차에서 추출 카드의 44px 위반 3종을 고친 뒤, 같은 패턴이 다른 학습 화면에 반복돼
있는지 눈대중이 아니라 전수로 봤다. 신규 `scripts/a11y-touch-target/probe.ts`.

**학습자 화면 328개 스캔 → 44px 미만 추정 80건 / 40개 파일.**

| 최소 | 위치 |
|---|---|
| 18px | `workspace/UnifiedHeader.tsx` — 챕터 단어장 칩 (`px-1.5 py-0.5 text-[10px]`) |
| 19px | `plan/PlanClient.tsx` — 지우기 버튼 |
| 24~28px | `WorkspaceChapterNav` · `SeriesDetail` · `BookFilterBar` · `WordLookupPopover` 등 |

최악 2건을 수정했다. 나머지 78건은 **일괄 수정하지 않았다** — 게임 HUD 처럼 44px 가
레이아웃을 깨는 자리가 섞여 있어 화면별 판단이 필요하다.

프로브 한계를 명시해 둔다 (스스로 오탐을 냈다):
- 부모 래퍼가 히트 영역을 주는 정상 패턴(체크박스를 44px `label` 로 감싸기)을 초안이
  위반으로 잡았다 — 11회차에 내가 만든 코드였다. 래퍼 감지를 추가했다.
- 명시적 높이 신호(`h-N`·`min-h-[Npx]`·`py-N`)가 있는 것만 판정하므로 **과소 보고**다.

부수 확인: `toFixed` 노출을 전수로 훑었더니 학습자 화면의 수치는 재생 속도(`1.00x`) ·
`+2.3초` · 랩 기록처럼 **전부 의미 있는 값**이었다. 11회차의 음수 점수 노출은
추출 패널 고유 문제였고 다른 화면으로 번지지 않았다.

### 학습자 관점 화면 감사 — 접근성 규정 위반 3종 + 인지 부하 (11회차)

10회차까지의 자기개발이 **전부 데이터·백엔드 정확성**이었다는 점을 인정하고, `/text/new`
추출 화면을 실제로 렌더해 학습자 관점으로 감사했다. (그동안 화면을 한 번도 보지 않았다.)

**규정 위반 — CLAUDE.md "절대 하지 않을 것 · 접근성" 정면 위반**

| 요소 | 기존 | 수정 |
|---|---|---|
| `몰라요`/`알아요` | `py-1.5 text-[11px]` ≈ **28px** | `min-h-[44px] min-w-[44px]` |
| 선택 체크박스 | `h-4 w-4` = **16px** | 5×5 + `label` 44px 히트 영역 |
| 근거 펼침 버튼 | `p-1` ≈ **22px** | `min-h/min-w 44px` + `aria-expanded` |

**Calm UI 위반** — 카드마다 `추천 점수 -0.279` 노출. 음수 composite score 는 학습자에게
아무 뜻이 없고 "이 단어가 나쁜가"로 읽힌다. 인라인에서 제거(펼침 breakdown 에는 유지).

**인지 부하** — 표시된 18개가 **전부 기본 선택**된 채 한 번에 단어장으로 갔다. 담기 버튼에
개수를 노출(`18개 담기`)하고, 10개 초과 시 차분한 안내 + `상위 10%부터 시작` 원탭 전환.
선택권은 뺏지 않는다 (Empathetic Feedback — 비난 없이 맥락만).

접근성 개선으로 `평가 상세` → `<단어> 추천 근거 펼치기`(스크린리더가 어느 단어인지 알 수 있게)로
바뀌어 e2e 셀렉터 2종 동반 수정.

### 사전 품질 프로브 — `he`="아주" 환각 정정 (10회차 · 마이그레이션 1건)

9회차에서 `he` 항목이 대명사가 아니라는 것을 발견하고 파고든 결과, **분류 단계의 환각**이
그대로 남아 있었다. `example_en` 이 증거다:

| 표제어 | 빈도 | 잘못된 뜻 | 예문 |
|---|---|---|---|
| `he` | 11위 | adverb "아주" | *"That cake looks he delicious right now."* — **비문** |
| `it` | 9위 | noun "정보 기술" | *"She works in the it department of a bank."* — 약어 IT 오인 |

둘 다 정정하고(`pos=pronoun`), 9회차에서 막혀 있던 `him`·`his`·`himself`·`itself` 를
패러다임에 연결했다. → 대명사 형태 **10/10 해석**.

신규 `scripts/dict-quality/probe.ts` — 커버리지의 반대편을 잰다. 커버리지는 "몇 %를
학습자원으로 만드는가", 이 프로브는 "**만들어낸 학습자원이 옳은가**".

- **A. 예문에 표제어 없음** — 기계적·고정밀. 빈도 상위 1,000행 검출 **0건**(상위 어휘 예문 품질 건전)
- **B. 폐쇄부류에 내용어 POS** — 휴리스틱. 18건 검출, 대부분 정당한 명사 용법(`while`·`no`)이라 사람 확인 필요

**검출기를 세 번 고쳤다.** 초안(규칙 접미사만)은 `give`→gave · `foot`→feet 등 11건 전부
오탐, 2차(+`inflected_forms`)도 `marry`→married 오탐. 최종적으로 **자체 규칙을 버리고
`matchSurface` 를 재사용**했다 — e탈락·y→ied·자음중복을 이미 다루고 회귀 테스트도 있다.
단일 문자 표제어(`s`=초)는 구조적 오탐이라 제외.

### 기초 어휘 갭 역추적 — 체계적 결손은 대명사 하나였다 (9회차 · 마이그레이션 1건)

8회차 갭 65종을 "어떤 seed 규칙이 빠뜨렸나" 로 역추적. **가설 2개는 반증됐다**:

| 가설 | 실측 |
|---|---|
| 수사(numeral)가 통째로 누락 | ✗ 26개 중 **24개 존재**. `fifteen`·`forty` 만 우발적 누락 |
| 불규칙 과거형이 굴절 배열에서 누락 | ✗ 40쌍 중 **38쌍 이미 해결**. `became`·`sold` 만 누락 |
| **대명사 패러다임 미수록** | ✓ 27개 중 **15개 누락 · 굴절 배열이 통째로 비어 있음** |

대명사의 목적격·소유격·소유대명사·재귀형은 **lemma 목록 기반 seed 로는 잡히지 않는 계층**이다.
새 표제어를 만들지 않고 기존 표제어의 `inflected_forms` 에 연결했다 — 굴절형은 lemma 와
같은 뜻이라 L2 해석이 정확하고, 뜻을 창작하지 않는다.

**`he`·`it` 은 의도적으로 제외.** 두 항목이 대명사가 아닌 다른 뜻으로 들어가 있다
(`he` → pos=adverb `'아주'` · `it` → pos=noun `'정보 기술'`). 여기에 `him` 을 붙이면
학습자가 "him = 아주" 를 배운다. 표제어를 바로잡는 것은 사전 내용 저작이라 VCB 파이프라인
몫이고, 그때까지 `him`·`his`·`himself` 는 미해결로 남는다 (의도된 상태).

결과: 대명사 형태 27개 중 **24개 해결** · 9섹터 커버리지 **96.0% → 96.4%** · 갭 65종 → 60종.

### 9섹터 코퍼스 실측 — 커버리지는 섹터와 무관, 갭은 기초 어휘 (8회차 · 마이그레이션 1건)

TED 주요 섹터를 모사한 **자작 강연 원문 9편(28,380자)** 을 `scripts/extract-coverage/sectors/`
에 두고 일괄 측정. 섹터별 어휘 도메인이 실제로 갈리므로 "어떤 섹터가 유리한가" 를 데이터로 답한다.

| 섹터 | 커버리지 |
|---|---|
| 사회·문화 97.6 · 디자인·건축 96.6 · 공연·유머 96.4 · 비즈니스 96.4 |
| 우주·천문 96.2 · 대담 96.2 · 건강·의학 95.5 · 교육 95.0 · 심리 94.5 |
| **합산 96.0%** (후보 2,017 · 해석 1,937) |

**결론: 섹터 간 편차가 3.1%p 에 불과하다.** 전문 도메인(우주·의학)이 일상 도메인보다
낮지 않다 — 커버리지를 좌우하는 것은 주제가 아니라 어휘의 **형태**다.

갭 65종의 정체가 예상과 달랐다. 도메인 전문어가 아니라 **기초 어휘**가 빠져 있다:
`something`(7편) · `cannot`(5편) · `forty`(4편) · `became` · `themselves` · `hers` · `ours` ·
`fifteen` · `lifetime`. `come`/`came`/`went`/`took` 은 있는데 `became` 은 없고,
`four`/`five`/`ten` 은 있는데 `forty`/`fifteen` 은 없다 — 사전 데이터의 불균일이지 파이프라인
결함이 아니다. 백로그가 맡을 몫.

**코드 결함 1건 발견·수정** — 4회차 L5 철자 변이가 **미국식→영국식 단방향**이었다.
사전은 두 철자가 섞여 있어(`cannibalize` 는 미국식이 표제어) 방향을 고정할 수 없다.
→ 양방향 매핑으로 교체(마이그레이션 `resolve_dict_headword_bidirectional_variants`) · 회귀 1건 추가.

측정 부산물: 하이픈 전체형이 갭 65종 중 24종(37%)을 차지한다. 부분이 이미 해석되므로
학습 손실은 없지만 커버리지 지표를 과소평가하게 만든다.

### 사전 갭 백로그 조치별 분류 — `/admin/pending-words` (6회차)

4회차에서 신호는 깨끗해졌지만(오탐 92.5%→0%), 화면이 **평평한 목록**이라 관리자가 조치를
판단할 수 없었다. 지금 큐에는 성격이 다른 네 갈래가 섞여 있고 **조치가 서로 반대**다:

| 분류 | 조치 |
|---|---|
| **진성 갭** (`sorbents`) | 사전에 등재 — 이 큐의 본래 목적 |
| **철자 변이** (`optimize`) | **사전에 넣으면 안 됨** — 영국식이 이미 있으니 중복 등재가 된다. `resolve_dict_headword` 를 고칠 것 (0 이 아니면 버그 신호) |
| **파생형** (`unglamorous`) | 어기는 있으나 뜻 반전으로 의도적 미해석 — 표제어로 넣을지 판단 필요 |
| **하이픈 노이즈** (`kilowatt-hours`) | 부분이 이미 해석됨 — 등재 불필요 |

- 신규 `lib/admin/pending-words/triage.ts` — 순수 함수 분류 + 사전 조회는 호출부가 **배치 1회**(N+1 회피)
- 화면: 분류 칩 · 버킷별 KPI · 진성 갭 우선 정렬 · 버킷별 조치 요약
- **노이즈를 근원에서 제거** — `ExtractionPanel` 이 하이픈 전체형 중 부분이 해석되는 것을
  pending 기록에서 제외. 런타임 실측 12건 → **10건** (`first-generation`·`kilowatt-hours` 제거)
- 화면도움말(`help/ops.ts`) 동반 갱신 — 낡은 "L1·L2 miss" 설명 교체 + 철자 변이를 등재하면
  안 되는 이유를 cautions 에 명시
- 회귀 12건 신설(`__tests__/triage.test.ts`) · 전체 462 tests 통과

### 입력 무단 절단 제거 — 강연 분량 런타임 측정 (5회차)

**정적 분석 4회차로는 끝내 못 본 결함.** `/text/new` 에 20,818자를 실제로 붙여넣어 보니
본문이 **783어**로만 인식됐다. `TextInput` 의 `maxLength={5000+100}` 하드 속성 때문에
브라우저가 5,100자에서 잘라내고 **나머지 75%를 경고 없이 버리고 있었다.**
`canSaveSingle` 에 상한 검사가 없어 잘린 본문이 "성공적으로" 저장까지 됐다 —
학습자는 강연 전체를 넣었다고 믿는다.

- textarea `maxLength` 속성 제거 (하드 절단 = 학습자 글을 말없이 버리는 것)
- 상한 5,000 → **50,000자** (≈8,000단어 ≈ 50분 강연)
- 초과 시 숨기지 않고 안내 — "입력한 내용은 그대로 있어요 · 줄이거나 책(챕터별)로 나눠 담기"
- `canSaveSingle` 에 상한 검사 추가 (절단본 저장 차단)
- 결과: 783어 → **3,192어**. unique 296 / 후보 242 로 정적 하네스 측정치와 정확히 일치
  (기존 297/243 은 잘린 문장이 만든 오차였다)

신규 e2e `tests/e2e/09-text-extract-scale.spec.ts` — 20,818자 입력 → 추출 → 저장 왕복.
**절단 회귀 락**(인식 단어 수가 입력 규모에 비례하는지 직접 단언) 포함.
런타임 실측: textarea fill 787ms · 추출 왕복 1,018ms · 저장 왕복 317ms · 콘솔 에러 0.

같은 스펙에서 **4회차 pending 계약이 실제 경로에서 처음 실행**됐다 — 적재 12건 전부
`unresolved_dict_words` 교차 검증 통과(**오탐 0**). e2e DB 헬퍼 3종 추가
(`fetchPendingWordsSince` · `unresolvedDictWords` · `deletePendingWordsSince`).

### 표제어 해석 의미 보존 원칙 (4회차 · 마이그레이션 4건)

**"틀린 뜻을 주느니 미해결로 남긴다"** 를 `resolve_dict_headword` 의 설계 원칙으로 확립.
승인받은 최초 안(접두사 해석 추가)은 **적용 전후 실측에서 두 번 반증되어 두 번 철회**했다.

| 실측 | 결과 |
|---|---|
| 기존 L4 `-less` | `sugarless`→sugar("설탕") · `carbonless`→carbon("탄소") — **살아있던 극성 반전 결함** → 제거 |
| 제안했던 학술 접두사 | 적용 직후 `geochemist`→chemist→**"약사"** → 즉시 철회. 어기 다의성에서 무너짐 |
| 제안했던 `-ize` 어근 절단 | `mineralized`→mineral 근사 의미 → 철회. `mineralize` 는 진성 사전 갭 |
| **진짜 원인 발견** | `optimize` 없고 `optimise` 있음 → 전수 조사 결과 **미국식 철자 214개 누락** |

→ L5 를 어근 절단에서 **영/미 철자 변이 매핑**으로 재설계 (같은 단어 · 의미 위험 0).
굴절형에도 적용(`optimizes`→`optimise`). 커버리지 94.6% → **95.0%** (샘플 242단어 기준이며,
철자 변이의 실제 이득은 코퍼스 전체 214단어).

신규 RPC `unresolved_dict_words(text[])` — 해석 실패분만 반환. `ExtractionPanel` 이 이것으로
`record_pending_words` 를 호출하도록 전환해 **오탐 92.5% → 0%** (기존에는 V-Level 임계값 미만
단어까지 "사전 미등재" 로 기록해 진짜 갭 13건이 오탐 160건에 묻혔다).

회귀 20건 신설(`__tests__/resolve-headword.integration.test.ts` · 실 DB) — 극성 반전 미해석 ·
접두사 미해석 · 철자 변이 해석 · 계층 순서(understand→understand) 를 모두 고정.

### 추출 저장 경로 감사 — 예문 인자 역전 · "알아요" 되살아남 (3회차)

**① 단어장 예문이 학습 대상 형태를 담지 않던 결함.** `extract_vocabulary_for_user_v2` 의 반환
컬럼 `matched_via_surface` 는 **이름과 달리 표제어**를 담고(`c_word`), `word` 가 원문 표면형(`c_surface`)이다.
`ExtractionPanel` 이 이름만 보고 `firstSentenceContaining(sentences, 표제어, 표면형)` 로 뒤집어 넘겨,
1단계(정확 표면형 탐색)가 표제어를 찾고 있었다. 결과: 표제어가 **다른 문장**에 등장하면
학습자가 배우는 형태가 없는 문장이 예문으로 저장됐다 (Context-Dependent 학습원칙 #5 위반).
→ 호출부 수정 + 계약 회귀 5건(`__tests__/source-sentence.test.ts`, 뒤집힌 인자의 반례도 함께 고정).

**② "알아요" 판정이 % 칩 변경 시 되살아나 저장되던 결함.** 선택 재초기화 effect 가
`familiar` 를 보지 않아, 학습자가 명시적으로 안다고 한 단어가 표시 비율만 바꿔도 다시 선택되어
단어장에 들어갔다. → `familiarRef` 로 판정을 존중하되, 판정마다 선택이 통째로 재초기화되지는
않도록 의존성에서 분리.

감사 중 **가설 2건은 반증**했다 — `pending_words` 의 `ON CONFLICT (lemma)` 는
`idx_pending_words_lemma_unique` 가 실재해 정상이고(0행은 경로 미사용 결과),
`vocabularies_cefr_level_check` 위반 가능성도 `shared_dictionary` 45,688행 전수 확인 결과 0건.

### 사용자 스크립트 토크나이저 재작성 — 누수 6종 폐쇄 (`lib/text-extract/tokenize.ts`)

`/text/new` 사용자 입력 경로의 단어 추출이 **원문에 없는 단어를 만들고, 원문에 있는 단어를
버리고 있었다.** 합성 구어체 샘플(124어) 실측으로 6종 확인:

| 누수 | 실측 증상 |
|---|---|
| 축약형 파편 | `split("'")[0]` 이 `didn't`→`didn`, `couldn't`→`couldn` 등 **비단어 8개** 생성 |
| **오추출 (최악)** | `won't`→`won`, `don't`→`don` — 사전에 실재하므로 전 필터를 통과해 **원문에 없던 단어를 학습자에게 가르침** |
| 숫자 결합 절단 | `CO2`→`co`, `CRISPR-Cas9`→`cas` |
| 알파벳 편향 절단 | `sort().slice(0,1000)` — unique 1,200 입력 시 **w·x·y·z 시작 단어 통째 소실** (실측) |
| 재현성 없음 | 아포스트로피 U+0027 vs U+2019 에 따라 결과가 달라짐 (79 vs 82개) |
| 비ASCII 자모 | `Jørgensen`→`j`+`rgensen` |

재작성 후 같은 샘플에서 **쓰레기 토큰 0개 · ASCII/타이포그래픽 결과 완전 일치**.

- 표제어 해석은 서버 `resolve_dict_headword`(4계층) 담당임을 명시 — 토크나이저는 "표면형을 있는 그대로, 빠짐없이" 만 책임
- 불규칙 축약 맵(`won't`→will · `can't`→can · `o'clock` 보존) + `n't`/clitic 일반 규칙
- 하이픈은 복합어를 잇고(부분+전체 모두 후보) em/en dash 는 구두점으로 끊음 · soft hyphen 제거
- 숫자 포함 토큰은 **통째 제외** (앞글자만 남기면 없는 단어가 됨)
- 상한 1,000 → 5,000 + **등장 순서 절단** (알파벳 정렬 금지) + 잘린 수를 `diagnostics.truncated` 로 노출
- `[Laughter]` 전사 마커 · 줄머리 화자 라벨 제거 — 화자 라벨 정규식은 **의도적으로 보수적** (제목형 2~4단어 또는 대문자 이니셜만; 느슨한 초안이 `"There is one lesson here: "` 를 통째로 삭제하던 것을 테스트가 검출)
- 신규 `components/text-extract/TokenizationSummary.tsx` — 전처리 내역을 Progressive Disclosure 로 노출 (추출은 검증 불가한 블랙박스여선 안 됨) + 상한 초과 시 경고
- 회귀 28건 신설 (`lib/text-extract/__tests__/tokenize.test.ts`) · 전체 425 tests 통과

### TED 골든 테스트 세트 (`docs/TED_TEST_CORPUS.md`)

사용자 입력 스크립트 경로를 회차마다 동일 조건으로 재평가하기 위한 고정 코퍼스 18편(워밍업 3 + 과학·기술 15, 3밴드) + 예비 2편.
근거: `vocaflow_domains.science_tech` 등록 단어 **0개** · `texts` 275행 중 본문 보유 **6행** · 최대 본문 **6,781자**(세트 최장편의 1/3).

### 미바인딩 처분 — 다국어 인용을 "사전 미등재"로 세지 않는다 (마이그레이션 3건)

The Adventurous Simplicissimus(1668년 독일어 원작의 1912년 Goodrick 영역판) 진단에서
`genuine_miss` **30건 중 20건이 영단어가 아니었다**. 근거는 전부 `first_sentence` 실측 —
ch.46 은 보헤미아어 대사를 원문 그대로 적고 **본문이 괄호로 번역을 병기**했고(`"Mih werne daho
blasna sebao…" ("Take we the fool…")`), ch.93 은 돌팔이 약장수의 독일식 억양을 저자가 일부러
뭉갠 철자였다(`ze elegtuary`·`zese`·`frients` — 정상형 `electuary` 는 같은 챕터에 8회 따로 존재).
**본문이 이미 뜻을 밝혀 놓았는데 "사전에 넣어야 할 영단어"로 보이는 것**이 결함이었다.

- **`20260813103000_simplicissimus_unbound_disposition`** — 30건 개별 처분.
  `noise_blacklist` 20(foreign_word 14 = 보헤미아어 9 + 라틴어 5 · corrupt_token 4 · archaic_grammar 1 ·
  interjection_noise 1) · `spelling_norm` 1(`necessy`→`necessary`) · 등재 큐 6 · **의도적 보류 3**.
  `necessy` 는 표준형이 `shared_dictionary` 정식 표제어(V2)라 spelling 티어가 실제로 뜻을 준다 —
  같은 이유로 `elegtuary`→`electuary`, `panfull`→`panful` 은 **넣지 않았다**(표준형이
  `lexicon_clean` 에만 있어 넣어도 뜻이 안 나온다).
- **`20260813104500_foreign_citation_marking`** — `is_quoted_foreign_citation(sentence, word)` 신설
  + `fill_lbv_resolution`·`trg_lbv_fill_lemma`·`find_unbound_book_lemmas` 갱신. 결정론적 룰이라
  LLM 을 쓰지 않는다. **닫는 괄호를 요구하지 않는 것이 핵심** — `first_sentence` 가 문장 단위라
  번역이 다음 문장으로 잘리는 실측 사례가 있고(`rosumi`: `… sebao" ("Yes, by God, set we him on
  the horse.`), 닫힘을 요구하면 두 번째 대사 4건을 놓친다. 진단에서는 노이즈가 아니라 **외국어**로
  보여준다(본문이 스스로 밝힌 근거라 블랙리스트 휴리스틱보다 우선).
  **정밀도: 전 카탈로그 79권 대상 마킹 17단어 / 1권, 나머지 78권 오탐 0건.**
- **`20260813112000_dict_drain_simplicissimus_6`** — 등재 큐 드레인 6건
  (`landsknecht`·`mainguard` = period_cultural · `gallowsbird`·`inkslinger` = archaic_literary ·
  `holmoak`·`wheatsheaf` = modern_advanced). 앞 4개는 register 배제로 학습 세트에 안 들어가고,
  뒤 2개는 배제 대상이 아니지만 1회 출현이라 composite 로 선정되지 않는다.
  `wheatsheaf` 는 `inflected_forms=['wheatsheaves']` 를 명시 — `en_inflection_bases` 가 `-ves→-f` 를
  지원하지 않아(실측 `wheatsheaves`→`wheatsheave`) cluster 티어만이 책의 복수형을 회수한다.
  `shared_dictionary.classified_by` CHECK 에 `claude_code_opus_5` 추가(생성 주체 정확 기록).
- **실측 (Simplicissimus)** — `genuine_miss` **30 → 3**(보류분 `panfull`·`becalfed`·`epicurish` 만
  잔존) · 조치 대상 47 → 20 · `unresolved_count` 30 → 14 · 해석률 99.6% → **99.8%** ·
  `lemma_bound` 7,516 → 7,521. 회귀 확인: Faerie Queene 655 · Les Misérables 156 변동 없음.
- **원칙** — 일괄 변환은 하지 않는다. ADR 0004 D4c 가 251 후보 중 14건만 채택했고(수율 5.6%),
  그 앞의 D4 초안("`person_noise` 373건 일괄 이관")은 검증 결과 **대부분 진짜 고유명사**여서
  폐기됐다. 본 처분도 같은 방식 — 근거 문장을 본 뒤 단어별로 가른다.
  Admin 화면도움말(`lib/admin/help/curation.ts`)에 "큐에 올리기 전에" 항목 추가.
- **후속 — 챕터 단어장 발행** (데이터 작업, 마이그레이션 없음). 품질 게이트 5종 PASS 확인 후
  `publish_book_word_sets(book, NULL)` → **136세트 / 3,156단어**(챕터당 6~82 · 평균 23.2).
  `v_level` NULL 0 · 밴드(V7~V11) 이탈 0 · 발행 직후 I10 드리프트 0.
  `p_cap=NULL`(무제한)은 ADR 0004 D7 — 분량은 L2 `deliver_chapter_vocab` 가 결정한다.
  **register 배제가 설계대로 작동**했다: 이번에 등재한 6건 중 세트에 들어간 것은
  `holmoak`·`wheatsheaf`(modern_advanced) 둘뿐이고 `landsknecht`·`mainguard`(period_cultural) ·
  `gallowsbird`·`inkslinger`(archaic_literary) 넷은 걸러졌다 — 읽을 때는 뜻이 뜨지만 외울 대상은 아니다.
  **세트 발행만으로는 학습자에게 안 보인다** — `shared_word_sets` RLS 가 부모 도서의
  `status='published'` + `copyright_safe_in_kr` 를 요구한다(51f361fb).
- **후속 — 카탈로그 노출** (2026-08-14). `status='ready' → 'published'` + `published_at` 설정.
  전환 후 RLS 가시 세트 **136/136** · 카탈로그 도서 12 → **13권**.
  status 트리거 2개(`trg_lb_publish_word_sets`·`trg_publish_book_word_sets_t`)가 발행 함수를 다시
  호출하지만 기존 챕터는 `CONTINUE` 라 **세트는 136 그대로**(중복 생성 없음 — 멱등 실측).
  **I10 은 이때부터 실제로 판정한다** — 미발행 동안은 `N/A` 로 PASS 였고, 발행 후 현 `select` 와
  비교해 드리프트 0 으로 PASS. 게이트 5종 유지. 되돌리기는 `revertPublishedBook`.
  ⚠️ 정본 경로는 Admin `강제 게시` → `/api/admin/library/force-publish-book` 이다.
  `admin_force_publish_book` RPC 는 `is_admin_or_curator()`(`auth.uid()`) 가드라 service_role·MCP
  로는 통과하지 못한다 — 그래서 그 라우트가 RPC 대신 동등 로직(저작권 검증 + UPDATE)을 직접 실행한다.

### scores.content_ref — "어떤 자료로 학습했나" (프레임워크 Phase 1 · 마이그레이션 1건)

[VOCAB_FRAMEWORK_PROPOSAL.md](./VOCAB_FRAMEWORK_PROPOSAL.md) §06 이 **"개선 항목이 아니라 설계
전제"** 라 못 박은 항목. `scores` 의 콘텐츠 참조가 `text_id` 하나뿐이었고 그것은 `texts` FK 라
**사용자가 enroll 한 텍스트만** 가리킬 수 있었다. 그래서 큐레이션 도서 챕터(ScriptQuiz
`?book=&ch=`)·공용 단어장·짧은 글로 학습한 세션은 남길 자리가 없어 전부 NULL 로 적재됐다 —
실측 49행 전부. 콘텐츠 단위 진행률·리포트·i+1 승급이 전부 여기 걸려 있었다.

- **`20260813090000_scores_content_ref`** — `content_type`(CHECK book/text/set/article/comic/mine) ·
  `content_id` uuid · `content_chapter` + partial 인덱스 2본. **FK 없음** — type 에 따라 가리키는
  테이블이 다른 다형 참조라 단일 FK 가 성립하지 않는다(무결성은 적재 계층이 책임).
  jsonb 가 아니라 3컬럼인 이유: "이 도서로 학습한 모든 세션" 은 인덱스 있는 컬럼 조건이어야 한다.
- **`lib/content/content-ref.ts` 신설** — `ContentRef` + 어댑터 4종(`fromScope`·`fromText`·
  `fromBook`·검증). 콘텐츠 유형이 늘 때 구현하는 것이 **어댑터 1개**가 되도록 표현을 한곳에 모은다.
  `contentRefFromText` 는 `library_book_id` 가 있으면 **도서로 접는다** — 챕터별로 text 로 남기면
  "이 도서로 얼마나 했나" 가 챕터 수만큼 흩어진다.
- **적재 배선** — `record-score.ts`(단일 write path) + 호출부 5곳. 아케이드 19종은
  `use-session-recorder.ts` **한 줄**로 따라온다(스코프는 이미 거기 있었고 적재만 그걸 버리고 있었다).
  맛보기 폴백(demo)은 자료가 아니므로 귀속시키지 않는다.
- **PairFlip 누락 보완(후속)** — 위에서 "단일 write path" 라 했지만 PairFlip 은 `scores` 를
  **직접 INSERT** 해 그 경로를 우회하고 있었다(실측 2행 모두 `content_type` NULL). 새 컬럼이
  생길 때 조용히 빠지는 것은 언제나 이런 우회 경로다 → `recordGameScore` 로 돌렸다.
  mock 페어 폴백 판은 **귀속시키지 않고** `metadata.mockFallback` 에 이유를 남긴다 — 그 판의
  단어는 그 자료의 단어가 아니라서, 귀속시키면 "이 도서로 학습했다" 집계가 만난 적 없는
  단어까지 세게 된다(아케이드가 demo 를 빼는 것과 같은 규칙).
- **ScriptQuiz 큐레이션 경로 해소** — `QuizSession.content` 신설. enroll 없이 도서로 바로 들어오는
  경로가 `texts.id` 가 없어 기록을 못 남기던 구멍을 닫았다.
- **실측 검증** — 큐레이션 챕터 퀴즈 완주 후:
  `content_type='book' · content_chapter=1 · content_id → library_books.title="Tell Me, What is a Drone?"`
  (`text_id` 는 여전히 NULL). 답할 수 없던 질문이 JOIN 한 번으로 답한다.
- 회귀: `05-learner-loop` 에 콘텐츠 귀속 단언 3건 + 단위 테스트 13(`content-ref.test.ts`).
  `'vocab'`·`'script'` 같은 세션 키가 흘러들어오는 경로가 실제로 있어 uuid 만 통과시킨다.
- 형태가 어긋나면 **null 로 떨어뜨리고 적재는 계속한다** — CHECK 위반으로 세션 기록을 통째로
  잃는 것보다 자료 미상으로 남기는 편이 낫다.

### 받아쓰기(v07) — localStorage 섬을 학습 자산·기억 축과 연결 (마이그레이션 1건)

`/dictate` 는 하드코딩 시드 3개(`storage.SEED_RESOURCES`)만 받아쓸 수 있었고, 완주해도
`scores` 0행 · `learning_records` 0행이라 홈·대시보드·주간리포트 어디에도 남지 않았다.
DB 에 도서 12권(챕터 texts 269) · 공용 단어장 1,169 세트가 있는데 그 중 무엇도 받아쓸 수
없었고, 기록은 기기를 바꾸면 사라졌다.

- **`20260812150000_dictation_persistence`** — `dictation_sessions` + `dictation_attempts`
  (RLS auth.uid()) + RPC 3종(`dictation_overview` · `dictation_weakness` ·
  `dictation_recent_misses`). 추가 전용, 기존 객체 변경 없음.
- **자료 연결 4소스** (`lib/dictation/source.ts`) — `?text=`(도서 챕터/내 스크립트 —
  `library_book_id` 유무로 판별) · `?set=`(공용 단어장 → `shared_words.source_sentence`
  도서 원문 문장) · `?custom=1`(붙여넣기, 자료로 저장 안 함) · 기본값 = **오늘의 받아쓰기**
  (`lib/dictation/daily.ts` — 복습 임박 3 + 재도전 1 + 새 문장 1, 오늘 받아쓴 문장 제외).
- **타깃 단어 → FSRS** — 문장마다 "이 문장이 훈련하는 내 단어"를 심고(`matchSurface` 굴절 인식),
  적중 여부로 등급 산출(`lib/dictation/targets.ts`) → `flushPendingSrsResults` 로
  `vocabularies` + `learning_records` 갱신. **힌트 4단계(정답 보기)는 Again(1)** — 인출이
  없었으므로 맞게 적혔어도 복습 간격을 늘리지 않는다.
- **오류 태그 9종** (`lib/dictation/error-tags.ts`) — article/inflection/contraction/
  function-word/spelling/homophone/word-order/tail-drop/missed-target. 세션을 넘어 누적돼
  허브 "요즘 자주 놓치는 것"(2주)의 원천. 태그마다 비난 아닌 처방 문구.
- **청취 폭**(`longest_perfect_words`) — 힌트 없이 100% 로 받아쓴 최장 문장의 단어 수.
  정확도(%)와 달리 "한 번에 붙잡는 길이"라 성장이 보인다(§철학4 Implicit Progress).
- **화면 4종 재작성** — 허브(오늘의 받아쓰기 CTA → 자료 3탭 → 약점 → 최근) · 셋업(미리보기 3지표
  + '한 번에 받아쓸 분량' 1·2·3문장이 '단위(문장/단락/전체)'를 대체) · 세션(타깃 단어는 **제출 전
  비노출** — 알려주면 빈칸 채우기가 된다) · 결과(**DB 에서 읽어** 기기·시점 무관).
- **적재 3시점** — 시작(세션 INSERT) / 문항마다(attempt INSERT — 중도 이탈해도 푼 만큼 남는다) /
  완주(세션 마감 + `scores` + FSRS flush). 결과 화면은 더 이상 적재하지 않는다(새로고침 중복 방지).
- **버그 수정** — 도서 챕터는 `texts.content` 가 NULL 이고 본문이 `content_chunks` 에 있다
  (`get_chapter_content` RPC 경유). 이를 놓쳐 도서 전량이 목록·세션에서 사라지던 것을 e2e 가 잡았다.
- **회귀 `tests/e2e/17-dictation-loop.spec.ts` 4종** — 허브 DB 자료 노출 · 오늘의 받아쓰기 완주 후
  `dictation_sessions`/`_attempts`/`scores`/`learning_records` 4곳 적재 단언 · 도서 챕터
  (content_chunks 경로) · 단어장 스코프. `04-ui-smoke` SCREENS 에 `/dictate` 추가.
  ⚠️ finally 정리 필수 — 오늘의 받아쓰기는 "오늘 이미 받아쓴 문장"을 제외해 기록을 남기면 재실행 시 고갈된다.
- 삭제: `lib/dictation/scoped-resource.ts`(source.ts 로 흡수) · `storage.SEED_RESOURCES`.
- **소리 (후속)** — 영어 음성이 없는 기기에서 받아쓰기는 무음이었고 코드는 배너를 띄우는 데서
  멈췄다. `lib/dictation/neural-voice.ts` 가 EchoMatch 의 Piper WASM(en_US-amy-medium)을
  재사용해 선택지를 준다. **자동 다운로드하지 않는다** — 17MB 를 밝히고 한 번 묻고, 고른 값은
  유지된다. 합성 실패 시 시스템 음성으로 즉시 폴백. 문장 LRU 캐시로 autoRepeat 3회에 합성 1회.
  ⚠️ 신경망 음성의 속도 조절은 `playbackRate` 라 **음높이도 함께 변한다** — 그래서 시스템
  음성이 있는 기기의 기본값은 그대로 시스템 음성(rate 가 음높이를 보존).
- e2e storageState 를 `test-results/`(Playwright outputDir) 밖으로 — 워커 재시작 시 디렉터리가
  비워져 뒷 테스트가 "Error reading storage state" 로 죽었다. 다른 spec 도 같은 함정을 갖고 있다.
- **난이도 적응 (후속)** — 문장 길이가 곧 난이도인데 4~34단어를 누구에게나 똑같이 내보내고
  있었고, `count` 를 앞에서 N개 잘라 챕터 앞부분만 되풀이됐다. `spanBand`(상한 폭×1.5 i+1 ·
  하한 폭×0.6) + `pickBySpan`(길이대 우선, 부족분은 가까운 순, **원본 순서 복원**)으로 교체.
  순서를 건드리지 않는 이유는 도서 챕터를 길이순으로 재정렬하면 이야기가 무너지기 때문.
  setup 미리보기도 같은 규칙으로 계산 — 예상과 실제가 다르면 화면이 거짓말이 된다.
- 단위 테스트 22 (`lib/dictation/__tests__/adaptation.test.ts`) — 적응 선택 · FSRS 등급
  (힌트4=Again · 최저등급 채택) · 오류 태그 7종. 화면에 안 보이면서 학습 결과를 바꾸는 판정들이라
  회귀가 조용히 일어난다.

### 모듈 허브 3개 목업 제거 — 처음 온 학습자가 남의 전적을 보고 있었다

`/flashcard` · `/spellforge` · `/wordblitz` 허브의 학습 데이터가 전부 상수였다.
계정을 막 만든 사람도 "Best 1410 · 콤보 11 · 정확도 94%", "오늘 1240점", "Day 12 ·
Gatsby Ch.1 — 어제 멈춘 자리에서 이어집니다" 를 봤다.

**실측으로 드러난 것** (2026-08-12): `scores` 에 spellforge **0행** · wordblitz **1행**.
즉 두 허브가 보여준 "최근 4회" 는 만들어진 적조차 없는 기록이다.

| 요소 | 판정 | 조치 |
|---|---|---|
| 큐 분포 + 미리보기 단어 | 실산출 가능 | `fetchSessionQueue` — **play 라우트와 같은 쿼리** |
| 연속일 | 실산출 가능 | `user_stats.current_streak` (`fetchGrowthStats`) |
| 최고점 · 최근 기록 | 실산출 가능 | `scores` 실조회 + 빈 상태 |
| 7일 정확도 sparkline | 데이터 부족 | 제거 (flashcard 5행/전체 — 1인 7일치는 0~1점) |
| ContinueRow "어제 멈춘 자리" | **불가** | 제거 — 재개 저장소가 없다(grep 0건). 눌러도 새 세션이었다 |
| 콤보 | **불가** | 제거 — `scores.metadata` 실측 키는 demo·scope·wrong·captured |
| 모드(단어↔뜻 / 뜻↔철자) | **불가** | 제거 — FlashcardSession 에 방향 개념 없음, SpellForge 의 모드는 realtime·delayed·blind(피드백 시점) |
| 난이도(쉬움·보통·어려움) | **불가** | 제거 — `difficulty` 는 spellforge 코드에 0건. adaptiveDifficulty 가 자동 추천 |
| "힌트 -20점" | 거짓 | 정정 — 감점은 없고 FSRS 등급이 내려간다(rating-mapper) |

**세 컨트롤은 애초에 죽어 있었다**: 허브가 `?vocab=&mode=&length=` 를 넘겼지만 play 라우트는
`set`/`text`/`chapter` 만 받는다. 학습자의 선택이 조용히 버려졌다.
살릴 수 있는 하나(길이)는 `?limit=N` 을 play 라우트에 **실제로 구현**해서 살렸다.

**드리프트를 원리적으로 막은 방법**: 허브 큐를 play 라우트가 쓰는 그 쿼리
(`fetchStudyVocabularies`)로 산출한다. 별도 쿼리로 세면 "오늘 17장" 이 시작 후 개수와
어긋날 수 있고, 그건 mock 을 지우고 만든 새 거짓말이 된다. 길이 선택도 같은 순수 함수
(`bucketsOf`)로 잘라서 화면 분포 = 담길 카드가 항상 같다.
(부수 정정: `/flashcard/play` 의 "오늘 N개" → "급한 순 N개" — 이 큐는 due 필터가 아니라
`next_review_at` 임박순 상한 50이다.)

- 신설: `lib/learner/session-queue.ts`(순수) · `session-queue-query.ts`(server-only) ·
  `lib/scores/recent.ts` · `components/hub/RecentScoresList.tsx` ·
  `flashcard/FlashcardHubClient.tsx` · `spellforge/SpellForgeHubClient.tsx`
- 테스트: 단위 17(합계 불일치 금지 · KST 날짜 경계) · e2e `18-hub-real-queue.spec.ts`
- ⚠️ **런타임에서만 잡힌 결함**: 순수 계산부를 처음엔 server-only 파일에 뒀는데,
  `'use client'` 허브가 그것을 import 하는 순간 모듈 그래프가 깨져 **앱의 모든 라우트가 500**
  이 됐다. tsc·eslint·단위 356개 전부 통과했다. 그래서 순수/조회를 두 파일로 분리했고,
  `session-queue.ts` 머리에 그 금지를 명시했다. (직전 커밋의 훅 순서 결함도 런타임만 잡았다 —
  이 화면군은 정적 검사로 안 잡히는 결함을 두 번 냈다.)
- 콘텐츠 선택기(단어장 드롭다운)는 실 목록으로 되살리지 **않았다** — 되살리면 콘텐츠 선택
  표면이 셋(워크스페이스 · 받아쓰기 · 허브)이 되고, 프레임워크가 그걸 하나로 접기로 했다.
  대신 자료 화면 링크를 남겨 경로 자체는 알 수 있게 했다.

### I10 게이트 오탐 — "재발행하라"는 잘못된 지시를 12권에 내리고 있었다 (마이그레이션 1건)

`20260812160000_fix_i10_gate_drop_cap40` — `run_content_quality_gates` book scope 의
I10 비교 CTE 한 줄(`WHERE sort_order<=40`) 제거.

ADR 0004 에서 챕터당 cap 40 을 없애(`republish_book_word_sets(p_cap DEFAULT NULL)` = 무제한)
발행 세트는 무제한으로 적재되는데, I10 은 **비교 대상만 40위까지 잘라서** 대조했다.
→ 41위 이하 단어가 전부 "드리프트" 로 계산돼 **발행 도서 12권 전부 critical FAIL**.

- 실측 근거: Pride and Prejudice 발행 1,794단어 = 현 select 1,794행, 무제한 비교 시 드리프트 **0**.
  게이트가 보고한 195 는 `sort_order > 40` 행 수(195)와 정확히 일치.
- 수정 후: **8권 PASS 복귀**(순수 오탐), 실드리프트 4권만 FAIL 잔존 —
  The Mysterious Affair at Styles 1,449 · A Christmas Carol 623 · Winnie-the-Pooh 305 · Fables 4.
  (Styles 는 발행 단어의 23%(454개)가 밴드 미달 — 재발행 대상이나 파괴적 연산이라 별건 보류.)
- 왜 위험했나: 게이트 빨간색이 곧 재발행 트리거인데 `republish_book_word_sets` 는 발행 단어를
  DELETE 후 재INSERT 한다. 틀린 게이트는 **멀쩡한 8권의 학습자 노출 단어를 갈아엎으라는 지시**로 작동한다.

**통합 테스트가 그동안 한 번도 돌지 않았다** — `vitest.config.ts` 가 존재하지 않는 레포 루트
`.env.local` 만 읽어(`injected env (0)`) `SUPABASE_SERVICE_ROLE_KEY` 가 주입되지 않았고,
`describe.skipIf` 가 전부 조용히 skip 했다. `apps/web/.env.local` 을 함께 읽도록 수정
→ 실행 테스트 323 → **357**. 이 사각지대 때문에 위 게이트 오탐도, 아래 스냅샷 노후도 늦게 발견됐다.

- 추출 골든 스냅샷 2건 갱신 (`extraction-rpc.integration.test.ts`) — 2026-07-04 기준값이 ADR 0004
  상대 밴드 도입 전이라 밴드 밖(V6) 단어를 담고 있었다. 현 select 실측: P&P(V8) → min V7 · max V11 ·
  밴드 이탈 0. 새 상위 20 = copyright(V8) · flatter(V9) · hearty(V9) · solace(V9) …
- `scripts/lcp/republish-books.mjs` 에 `--drifted-only` · `--book` · `--dry-run` 추가 —
  전량 재발행은 이미 동기된 도서까지 DELETE+INSERT 로 휘젓는다. 파괴적 연산의 기본값은
  "고칠 게 있는 것만" 이어야 한다. I10 게이트(읽기 전용)로 대상을 고른다.
- ⚠️ 재발행 범위 정정 — 발행 **세트**를 가진 도서는 12권이 아니라 **39권**이다.
  `library_books.status='ready'` 인데 세트만 `is_published` 인 도서 6권(Les Misérables 5,477단어 ·
  Dialogues 3,991 · Tom Sawyer 2,073 · Decline and Fall 1,601 · Jungle Book 1,207 · Ozma of Oz 1,021
  = 15,370단어)이 카탈로그에 없는 채로 학습자에게 노출된다. I10 드리프트 실측 **10/39권**.
- ⚠️ 세트가 **아예 없는 챕터**의 드리프트는 재발행으로 안 없어진다 — `republish` 는 기존 세트만
  갱신한다. Fables 드리프트 4 = 세트 없는 챕터 24·36·104 의 단어 4개 (`publish_book_word_sets` 영역).

**재발행 3권 실행 (2026-08-13 · 사용자 승인)** — Winnie-the-Pooh · A Christmas Carol ·
The Mysterious Affair at Styles. 28세트 교체, I10 드리프트 10권 → **7권**.

| 도서 | 단어 | 밴드 미달 | I10 |
|---|---|---|---|
| Winnie-the-Pooh (V5) | 384 → **361** | 70 → **0** | 305 → **0** |
| A Christmas Carol (V8) | 1,124 → **1,179** | 0 | 623 → **0** |
| Mysterious Affair at Styles (V7) | 1,953 → **1,748** | 454 → **0** | 1,449 → **0** |

세 권 모두 critical FAIL 0 · 뜻/품사/예문 결측 0 · `word_count` 28/28 일치.
구독 안전 확인 — set_id 는 보존되므로 이 세트를 참조하는 `vocabularies` 69행 ·
`user_word_set_subscriptions` 10건이 그대로 유지된다(교체 대상은 `shared_words` 뿐).

남은 7권: Fables(4 · 세트 없는 챕터라 재발행 무효) + `status='ready'` 인데 세트만 발행된 6권.

### 발행 세트 노출 경계 — 화면은 막았는데 API 는 열려 있었다 (마이그레이션 1건)

`20260813110729_word_set_rls_inherit_source_gate` — `shared_word_sets`·`shared_words` 의 SELECT
정책이 `is_published` 외에 **원본(도서/글)이 발행됐는지**를 함께 본다.

위 "재발행" 조사에서 `status='ready'` 인데 세트만 발행된 도서를 발견하고, 처음엔 "학습자에게
노출된다" 고 봤다. **틀렸다** — UI 3경로는 전부 제대로 막고 있었다:
`/library/vocab` 은 `library_book` 카테고리를 제외하고([queries.ts:114](../apps/web/src/lib/library/vocab/queries.ts)),
`/library/books` 는 `applyBookCatalogGate`(`published_at IS NOT NULL`), 상세는 `status='published'`,
`recommend_word_sets_for_user` 는 둘 다 요구한다. `publish-gate.ts` 가 제 역할을 하고 있었다.

**진짜 구멍은 RLS 였다.** 정책이 `is_published = true` 하나뿐이라, 공개 anon 키로 직접 조회하면
전부 반환됐다 — 실측 516세트 + 그 단어들(같은 키로 `library_books` 행 자체는 0. **책은 막히는데
그 책의 단어장은 열려 있었다**). `subscribeSet` 도 `is_published` 만 검사해 set id 만 알면 구독됐다.

- 전체 범위: `library_book` 발행 세트 993개 중 **587개(20,907단어 · 도서 27권)** 가 미발행 도서 소속.
  아티클은 135/135 정상.
- 적용 후 anon 실측: 미발행 세트 **516 → 0** · 그 단어 **→ 0** · 발행 도서(P&P) 61세트·단어 39 유지 ·
  `library_book` 993 → **406** · 아티클 135 · 기타 176 무영향 · service_role 1,169 전부 유지.
- 기존 구독 영향 **0** — 미발행 도서 세트 구독 71건·`vocabularies` 50행은 전부 admin(강민) 계정이라
  `admin_curator_all_*` 로 계속 읽는다. 일반 학습자 구독은 0건.
- 회귀 5건([word-set-rls.integration.test.ts](../apps/web/src/lib/library/__tests__/word-set-rls.integration.test.ts)) —
  "세트가 가려지면 단어도 가려지는가"(두 정책 동기)와 "가려진 0 이 원래 빈 세트가 아님"(service_role 대조)까지 고정.

**교훈**: 화면 게이트는 노출 경계의 증거가 아니다. 앱 코드에만 있는 게이트는 PostgREST 가 그대로
통과시킨다. 경계는 anon 키로 직접 쳐 봐야 안다.

⚠️ 파일명 주의 — 동시 작업 세션이 같은 타임스탬프(`20260813103000`)로 파일을 만들어 충돌했다.
이 마이그레이션 파일명은 실제 적용 버전(`schema_migrations.version`)에 맞춰 `20260813110729` 로 정정했다.

### /admin 대시보드 — 목업 상수 제거, 파이프라인 실측화

관리자 콘솔 첫 화면이 DB 를 한 번도 조회하지 않는 정적 목업이었다. `KPIS`·`SECTIONS`·
`ACTIVITIES` 세 배열이 코드 상수였고, "총 사용자 1,247" (실제 `user_profiles` 3) ·
"라이브러리 콘텐츠 89" (실제 `texts` 275) · "AI 단어 추출 1,283건 처리 (GPT-4o-mini)"
(쓰지 않는 모델) 처럼 실측과 어긋난 값이 운영 판단 자리에 떠 있었다.

- **`lib/admin/dashboard-stats.ts` 신설** — 숫자의 유일한 출처. 상태별 카운트 35 + 최근 변경 병합.
  `requireAdmin` 뒤에서 `createAdminClient()`(service_role) 로 조회 — dev-bypass 에서도 빈 화면이 되지 않는다.
- **`app/admin/page.tsx` 재작성** — KPI 4(공개 콘텐츠 · 검수 대기 · 실패 · 오늘 학습자) +
  파이프라인 8 큐 카드(LCP · ACP · 드레인 큐 · VCB · VRL · CCP · PDCP · Pending Words) +
  운영·관리 10 링크 + 실제 `updated_at` 기반 최근 변경 8건. 칩 색은 값>0 일 때만 (Calm UI).
- **`count ?? 0` 함정 제거** — `head: true` 요청은 **없는 테이블에도 204 / error=null / count=null**
  을 돌려준다(404 는 non-head 에서만). 0 으로 채우면 미구현 화면이 "미처리 0건" 으로 보인다 → `null` 은 `—`.
- **미구현 표시** — DB 를 읽지 않는 6 화면(`users`·`library`·`analytics`·`reports`·`billing`·`settings`)
  에 `목업` 태그. `reports`·결제 테이블은 존재 자체가 없음을 문구로 명시.
- 화면도움말(`help/ops.ts` dashboard) 전면 개정 — steps 3(실패 → 드레인 → 발행) + KPI 합산 정의 + 색 규칙.
- 회귀 테스트 2종 — `app/admin/__tests__/page.test.tsx`(renderToString 5) ·
  `lib/admin/__tests__/dashboard-stats.integration.test.ts`(실 DB 6, `reports` 부재가 `null` 인지 고정).

**부수 발견 (미수정)**: `reports` 테이블이 DB 에 없어 사이드바 신고 배지가 영구히 숨겨진다.
`vitest.config.ts` 가 레포 루트 `.env.local`(존재하지 않음)만 읽어 `*.integration.test.ts` 가
전부 조용히 skip 돼 왔고, 실제로 연결하면 2026-07-04 골든 스냅샷 3건이 실패한다(추출 알고리즘
변경 후 미갱신). 둘 다 별건이라 각 파일 주석에 근거만 남겼다.

### LCP 단어추출 — 학습대상 전달률 5.9% → 99.5% + 인프라 사고 복구 (마이그레이션 8건)

도서 314권 규모로 추출을 돌리며 "학습 대상 단어가 누락 없이 학습자에게 닿는가" 를
목표로 자기발전을 수행했다. 결함 5종을 제거하고, 그 과정에서 **측정 도구가 서비스를
마비시키는** 사고를 두 번 냈다.

**① 추출 품질 결함 5종** (전부 회귀 테스트로 고정 · 76~311권 규모 감사에서 발견)

| 결함 | 실체 | 수정 |
|---|---|---|
| 합자 파열 | winkNLP 토크나이저가 Latin-1 까지만 커버해 `œconomical → "œ"+"conomical"` | 정규화 단계에서 `œ→oe · æ→ae` + 인쇄합자 7종 |
| `-men→-man` 무가드 폴백 | 모델의 유일한 무가드 규칙이 `crimen→criman` · `hymen→hyman`(실단어 파괴) | 표면형 복원 — DB 15티어가 winkNLP 보다 **13:1** 우수 |
| OCR 이물 문자 파열 | `bɐttle`(U+0250) → `ttle` | 문자 매핑 대신 **파열의 형태**로 판정 |
| front-matter 가 본문 삼킴 | Joan of Arc 는 73챕터가 `frontmatter part` 안에 중첩 → raw_content 0바이트 | 본문 단위를 품은 블록은 boilerplate 로 지우지 않는 불변식 |
| 발행이 품사·예문·IPA 를 버림 | 발행 세트 21,292단어의 pos/example/ipa **0%** (사전엔 100%/92%/80%) | 두 발행 함수 INSERT 에 3필드 추가 → 100%/100%/98.6% |

결함 01/02/04/05 = **0** (311권 전수). 04(유령 어휘)는 "추출된 모든 표제어는 본문에
실재한다" 불변식으로 클래스를 통째로 닫았다 — 규칙을 하나씩 쫓는 대신 결과를 검사한다.

**② 학습대상 전달률 5.9% → 99.5%**

도서 레벨 기준 core(`bvl-1`~`bvl+3`) 단어가 학습자에게 닿는 비율이 도서별로 5.9~100%
로 갈렸다(A Christmas Carol 3,073개 중 181개). 원인 둘:

- **cap 40 이 챕터당 고정** — 챕터가 적은 책일수록 상한이 낮아 자격 있는 단어가 순위
  컷에 잘렸다. 분량 결정은 D7 에서 L2 로 옮겼으므로 L1 cap 은 후보만 줄이고 있었다 → 제거
- **sense 의 `v_level` 이 밴드 게이트를 겸함** — `accommodate`(대표 V7, 밴드 안)가
  sense 의 V5 때문에 통째로 탈락. sense 정렬이 임의라 **난이도 판정이 우연에 좌우**됐다
  → 밴드는 표제어 대표 v_level 로, sense 는 뜻·품사 표시 전용

**③ 구독과 학습 큐 적재 분리** — cap 제거로 세트가 커지자 `subscribeSet` 이 세트 전량을
`vocabularies` 에 넣던 구조가 위험해졌다(구독 한 번에 300개 = 하루 22단어 기준 14일치).
도서 세트는 `commit_chapter_vocab`(L2)에 위임 — 리더와 **같은 함수**라 기준이 갈라지지
않는다. 실측: 세트 352개 중 30개만 적재.

**④ 인프라 — 자책골 2건과 복구**

NANO(RAM 0.5GB)에서 DB 가 `Unhealthy` 로 떨어졌다. 원인은 규모가 아니라 두 가지였다:

- `shared_dictionary`(219MB) 통계가 **완전히 비어 있었다**(`n_live_tup=0`). 사전 계열은
  읽기 전용이라 **autoanalyze 임계값에 영원히 도달하지 않는다** — 구조적 방치.
  플래너가 0행으로 추정해 154만 행 lbv 와 조인하며 계획이 붕괴, 배치 83번 이후 37건 연속 타임아웃
- **내가 만든 측정 도구 2건이 CPU 1·2위였다** — 감사의 `content ~* '\m…\M'` N×M 전문
  스캔(CPU 93분, 캐시 파괴)과 통계 유지보수의 전수 ANALYZE(21.7분/회). 둘 다
  "안전하게 다 하자" 가 소형 인스턴스에서 서비스를 마비시킨 사례다.

조치: 평가 코퍼스 제거(1,381MB) · `shared_dictionary` VACUUM(219→106MB) · 감사에 가드
(권당 18.4초→6.25초) · 통계 유지보수를 낡은 것만(21.7분→즉시) · MICRO 업그레이드.
결과 **planning 1,676ms → 1.5ms**.

**⑤ SE 수집 재개 — 우회 대신 정식 채널**

대량 수집 뒤 standardebooks.org 가 Node 클라이언트를 차단(curl 은 통과). TLS 지문을
위장하는 대신 SE 가 배포용으로 공개한 GitHub 저장소로 폴백한다
(`ingestFromStandardEbooksResilient` — **네트워크 실패일 때만**, 파싱 실패까지 폴백하면
결함이 조용히 감춰진다). "파일이 곧 챕터" 라는 첫 판단은 틀렸다 — SE 저장소도 작품
단위까지만 나눈다(`laws.xhtml` = 『법률』 12권 전체). 파일을 받아 하나의 body 로 잇고
내부 분절은 기존 로직에 맡겨 웹과 동등한 품질을 얻는다.

분절 폴백도 함께 고쳤다 — Plato Dialogues 는 `epub:type` 에 `chapter` 가 0개라 본문이
직전 챕터에 붙어 **481,877단어 챕터**가 생겼다. chapter 류가 없을 때만
`division`/`z3998:drama` 를 unit 으로 승격(무조건 승격하면 Proust 24챕터가 6덩어리로 뭉친다).

**⑥ 감사를 증분으로** — 전수 재계산 뷰가 300권에서 타임아웃. 도서 단위 계산 →
`book_extraction_audit` 저장 → 합계 조회로 전환(`audit_book_extraction` ·
`books_needing_audit` · `scripts/lcp/audit-books.mjs`). 305권 전수 감사 실패 0.

> 규모: 도서 314권 · 8,021챕터 · 2,225만 단어 · DB 2,991→1,493MB.
> 상세 설계는 [ADR 0004 D7](./adr/0004-book-vocab-selection-policy.md).

### 스키마 드리프트 — "빈 테이블 정리"가 살아 있는 기능 6개를 끊고 있었다 (마이그레이션 1건)

**마이그레이션 [20260812093000_restore_word_familiarity.sql](../supabase/migrations/20260812093000_restore_word_familiarity.sql) — 2026-08-12 사용자 승인 후 dev 적용 완료.**

프레임워크 Phase 1(정직성 복구)의 첫 항목으로 `word_familiarity` 부재를 진단하다가, **원인이 하나임**을 발견했다. `20260719161409_drop_unused_empty_tables` 가 "빈 테이블 정리"로 13개를 `CASCADE` 삭제했는데 —

- **비어 있음 ≠ 미사용.** 그중 6개가 살아 있는 코드·RPC 에 참조돼 있었다.
- **`DROP TABLE ... CASCADE` 는 함수를 지우지 않는다.** 뷰·제약은 따라 지워지지만 `pg_proc` 은 대상이 아니어서, 참조하던 RPC **8개**가 그대로 남아 런타임에 `relation ... does not exist` 로 실패했다.
- 앞서 별건으로 발견한 `/admin/vocab/sources` 500(`vocab_raw_texts`)도 **같은 마이그레이션**이었다.

#### `word_familiarity` 3개 호출 지점의 심각도가 달랐다

| 지점 | 처리 | 학습자가 본 것 |
|---|---|---|
| `ExtractionPanel.tsx:186` `extract_vocabulary_for_user_v2` | `setError(rpcErr.message)` | **원시 Postgres 에러** — 추출이 막힘 |
| `ExtractionPanel.tsx:258` `set_word_familiarity` | try/catch 무시 | **성공한 것처럼 보이고 판정 유실** |
| `ExtractionPanel.tsx:229` `record_pending_words` | `void` | 설계상 best-effort |

258번이 더 위험했다 — `supabase.rpc` 는 throw 하지 않고 `{ error }` 를 반환하므로 try/catch 는 애초에 발동하지 않고, `error` 검사도 없었다. **어느 쪽으로도 조용히 버려졌다.**

- 원본 DDL(20260715224958) **그대로** 복원 — 추측 대신 마이그레이션 이력에서 꺼냈다. RPC 2개는 살아 있어 재생성 불필요. CASCADE 로 함께 사라진 뷰 `word_mislevel_signal` 도 복원.
- **침묵도 함께 고쳤다** — `markFamiliarity` 가 실패 시 낙관적 표시를 되돌리고 학습자에게 알린다. 저장 안 된 판정을 저장된 것처럼 보여주는 것이 이 화면에서 가장 나쁜 거짓말이다.
- 검증 4단: 구조(RLS·정책·인덱스·뷰) → 깨진 RPC 실호출(5단어 → 2행) → upsert/CHECK/`v_level` COALESCE 보존을 DO 블록으로 실측(탐침 잔여 0) → e2e `08-text-extract-trust` 가 known/unknown DB 영속화까지 단언하며 통과.
- 문서 통계를 실측으로 교체 — 테이블 81 · view 10 · 함수 321 · migrations 412. 이전 기재(77/7/262/72+)는 최대 5.7배 어긋나 있었다.

**미해결(각각 별도 판단 필요)**: `word_lexicon` · `classes`/`class_members` · `pending_words` · `csat_item_attempts`. 복구가 맞는 것과 코드에서 참조를 걷는 것이 기능별로 다르다 — [DB_SCHEMA.md §스키마 드리프트](./DB_SCHEMA.md) 에 표로 정리.

**재발 방지**: 테이블 삭제 전 `pg_proc.prosrc` 검색 + 코드 grep 을 DB_SCHEMA.md 에 필수 점검으로 명문화.

### FlowNav mock 제거 — 전 학습자가 항상 "Practice 추천 · 거의 다 왔어요 13%만 더!" 를 봤다

`STAGES[].progress` 가 하드코딩(0/45/35/87/60/25)이고 `RECOMMENDED_KEY`·`JOURNEY_PERCENT` 가 그 상수 배열에서 **모듈 로드 시점에** 계산됐다. 사용자 상태가 개입할 여지가 없어 **모든 학습자가 언제나 같은 추천과 같은 진척**을 봤다 — 3주가 아니라 처음부터.

**실데이터로 채우지 않고 제거했다.** 세 이유:

1. 프레임워크 Phase 0 이 처방 정본을 `prescribe_today` 하나로 정했다. 실데이터를 붙여도 **경쟁하는 추천 표면이 둘**이 되어 그 결정이 무너진다.
2. FlowNav 는 셸이라 모든 페이지에 렌더된다. 6단계 진척을 실시간 산출하면 페이지마다 쿼리가 붙는다.
3. Phase 3 에서 이 컴포넌트 자체가 하단 탭 4개로 재편될 예정이라 지금 붙이는 실데이터는 곧 버릴 것이다.

| 유지 | 제거 |
|---|---|
| 6단계 내비게이션 (모바일의 **유일한** 전역 내비) | `progress` 링·바·% 표기 |
| `momentum`(streak·mastery·weekDays) — **실데이터**였다 | `stat` 실적 문구 6종 |
| 단계 툴팁(무엇을 하는 곳인지) | 추천 글로우 + `flowRecPulse` keyframes |
| | `JOURNEY_PERCENT` 메리디안 2곳 · 툴팁 배지 |

`ProgressRing` → `StageRing` — 진척 호를 지우고 테두리만 남겼다(아이콘 그릇 역할 유지). `sessionHref: '/text/1'` 도 고쳤다 — `texts.id` 는 uuid 라 **존재하지 않는 경로**였다.

726 → 562줄. tsc·eslint 클린 · 단위 312 통과 · SSR HTML 로 `거의 다 왔어요`·`flowRecPulse`·`익힘` 소멸과 FlowNav 정상 렌더 확인.

⚠️ **e2e(04-ui-smoke) 는 확인하지 못했다** — 런타임 검증으로 같은 계정에 로그인을 6회 반복해 auth 스로틀이 걸렸다(로그인 32초 후 실패, 콘솔 에러 0). FlowNav 는 `(main)` 이고 로그인은 `(auth)` 라 인과가 없다. 부수적으로 발견한 것: `04-ui-smoke` 의 `beforeAll` 은 훅 타임아웃 30초인데 로그인 헬퍼가 최대 25초×2회를 쓴다 — 스로틀·콜드컴파일이 겹치면 구조적으로 실패한다.

### 결합 침묵 제거 — 세트로 놀아도 복습에 아무것도 남지 않는 것을 학습자가 알 수 있게

`recordGameResult` 는 학습자 `vocabularies` 에 없는 단어를 카드 갱신 없이 넘긴다. **실측 97.9%** 가 그 경로다(내 단어 225개 vs 세트 단어 56,079개 · 628세트 기준 겹침 2.1%). 그동안 화면에 아무 표시가 없어서, 세트로 한 세션을 다 놀아도 FSRS 에 0건이 남는다는 것을 알 방법이 없었다.

**구조가 문제였다.** 카드를 갱신하지 않는 경로가 셋인데 전부 `{ ok: true, updated: false }` 로 뭉쳐 있었다:

| 경로 | 성격 |
|---|---|
| `not-mine` — 내 단어가 아님 | **결합 실패** (97.9%) |
| `assisted` — 정답 본 뒤 입력 | 의도된 FSRS 무결성 가드(v07.8) |
| 10분 쿨다운 | 같음 |

뒤의 둘은 근거가 명확한 가드인데 구별이 안 돼서, 팀이 **게임별로 각자 우회**해 왔다 — `morpheme-bank.ts`("99.7% silent skip 됐다") · `morph-bank.ts` · `due-words.ts` · `catalog.tsx` 가 같은 문제를 따로 적고 따로 대응했다. 게다가 **전 호출자가 `void recordGameResult(...)`** 로 반환값을 아예 읽지 않았다.

- `RecordSkipReason` 신설 — `updated: false` 에는 **이유가 반드시** 붙고 `updated: true` 에는 붙을 수 없다(타입이 강제).
- 중앙 `play-scaffold` 가 `not-mine` 만 세어(대소문자·재출제 중복 제거) 세션당 하나의 배지로 고지한다. 18/19 게임이 이 스캐폴드를 쓰므로 게임별 우회가 필요 없다. `assisted`·`cooldown` 은 **세지 않는다** — 정상 동작을 경고로 보고하면 고지가 항상 떠 있고 결국 무시된다.
- 고지는 모달이 아니고 `pointer-events: none` — 학습을 끊지 않는다(Calm UI · 학습 중 오버레이 금지).

**내가 만든 버그를 런타임이 잡았다.** 훅(`useRef`/`useState`)을 early return 뒤에 두어 `Rendered more hooks than during the previous render` 가 났는데 **tsc·eslint·단위 테스트가 모두 통과했다.** 런타임 확인만 잡았고, 그 경고를 코드 주석에 남겼다.

검증: 단위 7건(이유 구별 · 의도된 가드를 세지 않음 · 중복 제거) + e2e 2건([16-coupling-notice](../apps/web/tests/e2e/16-coupling-notice.spec.ts) — 고지가 실제로 뜨는지, 내 단어로 놀 때 **거짓 경보가 없는지**). e2e 는 세트를 DB 에서 고른다(`pickSetWithoutOverlap`) — id 하드코딩은 데이터가 바뀌면 조용히 낡고 UI 스크래핑은 링크 구조에 취약했다. 단위 312 통과.

**승격 정책은 보류** — 프레임워크 제안의 결정 3(lazy 승격)은 실측 97.9% 를 보면 세트 하나 플레이로 단어장에 수백 개가 자동 유입된다. 제안서가 경계한 "의도 없이 커지는 단어장" 이 실제로 크므로, 세션 끝에 묶어 묻는 안(C)을 재검토해야 한다.

#### ⑤ `pending_words` 복원 — CASCADE 가 **함수도 지운다**는 것을 알게 된 건 (마이그레이션 1건)

**마이그레이션 [20260812133000_restore_pending_words.sql](../supabase/migrations/20260812133000_restore_pending_words.sql) — 2026-08-12 사용자 승인 후 dev 적용 완료.**

앞선 4건에서 세운 규칙(*"CASCADE 는 뷰·제약은 지우지만 함수는 지우지 않는다"*)이 **부분적으로 틀렸다.** 이 테이블이 두 경우를 한꺼번에 보여줬다:

| 함수 | 반환 타입 | CASCADE 결과 |
|---|---|---|
| `record_pending_words` | `RETURNS INT` | **살아남음** → 없는 테이블을 참조해 실패 |
| `update_pending_word_status` | `RETURNS public.pending_words` | **함께 삭제** → 함수 자체가 사라짐 |

두 번째가 테이블 복합 타입에 의존하기 때문이다. 그래서 **테이블만 복원하면 admin 상태 전환(`transitionPendingWord`)은 여전히 실패한다** — 둘 다 복원했다. `DB_SCHEMA.md` 의 삭제 전 필수 점검을 2개 → **3개**로 늘렸다(`prorettype` 검사 추가).

- 앞서 "원본 DDL 없음" 이라 보고했으나 **정정**한다 — DB 이력에 둘 다 있었다(`20260525041709` + `20260525044205`). 저장소에 파일이 없었을 뿐이고, **삭제 마이그레이션도 똑같이 저장소에 없었다.** 같은 습관(DB 에만 적용, 저장소 미기록)이 원인과 복구 난이도를 동시에 만들었다.
- 역추적 교차검증 3출처 일치 — RPC INSERT(6컬럼) · `packages/types` 생성 타입(12컬럼) · 원본 DDL(12컬럼). `status` 5값(`auto-classify` 포함)도 앱 `PendingWordStatus` 와 일치했다.
- 검증 중 **제 탐침이 두 번 틀렸다**: `now()` 는 트랜잭션 시작 시각으로 고정이라 같은 DO 블록에서 "값이 증가하는지"로는 `set_updated_at` 트리거를 검증할 수 없다. 과거 시각을 심고 **트리거가 덮어쓰는지**로 바꿔 통과했다(트리거는 처음부터 정상이었다).

검증: 누적 upsert(1→2) · `length<2` 필터 · 트리거 덮어쓰기 · `CHECK(status)` · `UNIQUE(lemma)` · status 5값 전부 · 탐침 잔여 0(중단 시 롤백까지 확인).

**⚠️ 미해결(복원과 무관한 별개 결함)**: RLS 가 `own`(본인) 정책 2개뿐이라 `/admin/pending-words` 가 `requireAdmin` 통과 후 일반 클라이언트로 조회할 때 **admin 이 다른 사용자의 항목을 볼 수 없다.** 원본을 그대로 복원했으므로 정책 추가는 별건으로 판단한다(임의 추가는 원본과 달라진다).

#### ④ `classes`·`class_members` 복원 — "선반영이라 비어 있음" 을 "미사용" 으로 읽었다 (마이그레이션 1건)

**마이그레이션 [20260812124500_restore_class_data_model.sql](../supabase/migrations/20260812124500_restore_class_data_model.sql) — 2026-08-12 사용자 승인 후 dev 적용 완료.**

앞의 세 건과 또 다른 유형이다. 원본(`20260628180000_p4_l3_class_data_model.sql`) 헤더가 명시한다 — *"화면(/teacher/*)은 Phase 2. 본 마이그레이션은 테이블/헬퍼/RLS 만(**선반영** 결정 실행)."* 즉 UI 보다 먼저 만든 테이블이라 **비어 있는 것이 당연**했고, 그 뒤 P4.2 에서 화면이 실제로 구현됐다(`/teacher/page.tsx` 는 StubPage 가 아니고 `TeacherClient` 가 개설·초대코드 참여를 실행한다). **화면이 만들어진 뒤에 테이블이 지워졌다.**

실패 방식이 한 파일 안에서 갈렸다 — 지금까지 고쳐 온 두 유형이 모두 있었다:

| 경로 | 처리 | 교사가 본 것 |
|---|---|---|
| `createClass` · `joinClassByCode` | `{ ok:false, error: error.message }` | **원시 Postgres 에러** |
| `fetchTeacherClasses` · `fetchMyMemberships` | `const { data } = ...` — **error 를 버림** | **"개설한 클래스가 없어요"** (조회 실패가 정상 상태를 흉내) |

- 순환 RLS 회피 헬퍼(`is_class_teacher`·`is_class_member`)와 `join_class_by_code` 는 살아 있어 재생성하지 않았다.
- **`assignments` 는 의도적으로 복원하지 않았다** — 같은 마이그레이션 산물이고 같은 선반영이지만 코드 참조 0곳이며 P4.3(과제 배포) 미구현이다. 지금 되살리면 **또 "빈 테이블" 로 지워질 항목을 하나 더 만드는 것**이다. DDL 위치를 문서에 남겼다.
- 침묵 제거: 두 조회 함수가 `{ items, unavailable }` 를 반환하고, 교사 화면이 *"클래스 목록을 지금 불러오지 못했어요 — 비어 있어도 **클래스가 사라진 것은 아니에요**"* 를 고지한다. 던지지 않는 이유는 페이지 전체를 에러 화면으로 바꾸지 않기 위해서다(hub 처방과 같은 원칙). 읽기 실패가 **쓰기(개설·참여)를 봉쇄하지 않는다**는 것도 테스트가 고정한다.

검증: 정책 6 · FK 2 · UNIQUE(invite_code) 1 · **개설 → 가입 → 헬퍼 판정 → 멤버 수 집계 → UNIQUE 충돌**까지 DO 블록 왕복 후 탐침 정리(잔여 0) · 신규 테스트 5건 · 단위 305 통과(300→305).

#### ③ `csat_item_attempts` 복원 — hub "오늘" 이 3주 넘게 전 학습자에게 실패하고 있었다 (마이그레이션 1건)

**마이그레이션 [20260812113000_restore_csat_item_attempts.sql](../supabase/migrations/20260812113000_restore_csat_item_attempts.sql) — 2026-08-12 사용자 승인 후 dev 적용 완료.**

같은 삭제 마이그레이션이 만든 결함 중 **가장 심각한 것**. 전파 경로:

```
csat_item_attempts (없음)
  └─ derive_learner_stage  → 42P01
       └─ prescribe_today  → hub "오늘" 처방이 모든 학습자에게 실패
  └─ grade_dcp_item        → DCP 구문 연습 채점 불가
```

`prescribe_today` 는 Phase 0 에서 "처방의 유일한 정본" 으로 지정한 함수다 — **그 정본이 죽어 있었다.**

**왜 발견되지 않았나.** `prescription-actions.ts` 가 실패 시 하드코딩 폴백을 반환한다(`stage 'S1' · 0분 · due 0 · 후보 [] · DCP 비활성`). 그 값이 **신규 학습자의 정상 상태와 완전히 같아서** 화면으로는 구별이 불가능했다. 화면은 "오늘 할 게 없어요" 라고 말하고 있었다. mock 보다 나쁘다 — mock 은 가짜임을 코드가 인정하지만 이건 계산 실패를 계산 결과처럼 반환했다.

**검증 방법에서 얻은 교훈**: 복원 직후 첫 사용자 stage 가 `'S1'` 으로 나왔는데 **폴백값과 같아 아무것도 증명하지 못한다.** 시드 계정(wpm 160)으로 다시 재 **`'S3'`** 을 받은 뒤에야 계산이 실제로 돌았음이 증명됐다. → 복원 검증은 **폴백과 다른 값이 나오는 입력**으로 해야 한다.

**침묵 제거(같은 커밋)**: `TodayPrescription.unavailable` 신설 · 서버 로그 · 카드가 "지금 계산하지 못했어요 + 그동안 단어장·서재에서 이어서 해도 괜찮아요" 를 고지(Empathetic Feedback) · 회귀 테스트가 **"정상 화면과 실패 화면이 실제로 달라야 한다"** 를 강제(8건, 7→8).

검증: 구조(RLS·정책·인덱스) · `derive_learner_stage` S1/S3 대조 · `prescribe_today` 1블록 반환 · 단위 300 통과 · UI 스모크 5 통과.

#### ② `vocab_raw_texts` 복원 — "비어 있음" 은 사실이었고 "미사용" 이 추론이었다 (마이그레이션 1건)

**마이그레이션 [20260812101500_restore_vocab_raw_texts.sql](../supabase/migrations/20260812101500_restore_vocab_raw_texts.sql) — 2026-08-12 사용자 승인 후 dev 적용 완료.**

이 테이블은 **실제로 비어 있었다** — VCB 런은 1건뿐이고(2026-05-13 cast-2000 감사 체인) 그 시드 2,000개는 AI 생성(Method B)이라 파일 업로드가 없었다. 마이그레이션의 "empty" 판정은 맞았다. 틀린 것은 **추론**이다.

8개 접근 지점을 성격별로 갈라 보니 유령이 아니었다:

| 지점 | 성격 | 하는 일 | 마지막 커밋 |
|---|---|---|---|
| `method-a.ts:210` | **쓰기** | Method A 파일 업로드 적재 (유일한 write) | 2026-05-15 |
| **`publish.ts:250`** | 읽기 | **발행 세트의 출처 인용(citation)** — 라이선스 표기 | **2026-07-06** |
| `queries.ts:169` | 읽기 | 런 상세 소스 수 | **2026-07-09** |
| `sources.ts:78` | 읽기 | 소스 목록 `run_count` 뱃지 | 2026-05-14 |

`publish.ts`·`queries.ts` 가 7월 커밋이므로 **패키지는 현행**이고 스크립트만 5월에 멈춰 있다. 복구 후 0행 — 복구할 데이터는 없고 스키마 의존만 되살렸다.

**보조 지표가 본체를 죽이지 않게 함께 고쳤다.** `/admin/vocab/sources` 가 통째로 500 이었던 직접 원인은 테이블 부재가 아니라 `fetchSources` 가 `run_count` 집계 실패를 `throw` 해서 **이미 손에 든 소스 목록까지 버린 것**이다. 뱃지만 0으로 떨어뜨리고 목록을 살린다 — 같은 프로젝트의 `admin/layout.tsx` 가 `reports` 뱃지를 try/catch 로 감싸는 것과 같은 원칙이다. 계약은 [sources-resilience.test.ts](../apps/web/src/lib/vcb/__tests__/sources-resilience.test.ts) 5건이 고정한다(테이블 존재가 아니라 **실패 처리**를 검사한다).

검증: FK 2개 · RLS on · 정책 1(자매 7개와 동형) · 인덱스 3 · `sources.ts`/`publish.ts` 조회 형태 실행 OK · 단위 5건. ⚠️ 런타임 admin 렌더 확인은 못 했다 — dev 우회를 껐고 e2e 계정이 admin 이 아니라 `/hub` 로 리다이렉트된다. 그래서 단위 테스트로 대체했다(회귀 방어로는 더 강하다).

### 단어 추출 79권 규모 검증 — 문자·형태소 결함 3종 제거 + L1/L2 전달 계층 분리

Standard Ebooks 대량 추출 러너(`scripts/lcp/batch-extract.mjs`, `est_v_level` 층화·재개 가능·멱등)로
38권을 추가해 **79권 · 2,496챕터 · 878만 단어** 규모에서 추출 품질을 감사했다. 결함 04(유령 어휘)가
0 → 13 으로 회귀했고, 원인이 전부 **외부 라이브러리 한계**였다.

- **합자 파열 6건** — winkNLP 영어 모델의 토크나이저 문자 클래스가 Latin-1 Supplement 까지라
  `œ`(U+0153)가 단어를 쪼갠다: `œconomical → "œ" + "conomical"`. `normalizeLigatures` 로
  정규화 단계에서 `œ→oe · æ→ae` + 인쇄합자 7종을 편다. 접고 나면 사전 체인이 이어받는다
  (`oeconomical → economical`, spelling 티어). 부수 효과로 `countWords` 가 ASCII 전용이라
  `Encyclopædia` 를 2단어로 세던 것이 1단어가 됐다 (골든셋 word_count 3곳 정정).
- **`-men → -man` 무가드 폴백 4건** — `wink-eng-lite-web-model` 의 `lemmatizeNoun` 은 마지막
  `return` 만 `hasSamePOS` 가드가 없어 `crimen→criman` · `hymen→hyman`(실단어 파괴) 을 만든다.
  `unmangleMenPlural` 로 표면형을 복원 — 17단어 실측에서 DB 15티어가 winkNLP lemma 보다 **13:1** 우수.
- **OCR 이물 문자 파열 2건** — `bɐttle`(U+0250) → `ttle`. 문자를 매핑하면 IPA 텍스트가 깨지므로
  단어도 부호도 아닌 한 글자가 공백 없이 붙은 **파열의 형태**로 판정(`isForeignCharSplit`).

마이그레이션 3종:
- `20260811125842_en_inflection_men_plural` — inflection 티어에 `-men → -man` 후보 추가.
  `seamen` 이 "솔기"(seam)로 해소되던 것을 "선원"으로.
- `20260811132526_en_inflection_men_plural_defer` — 위 판본이 중세영어 동사 어미까지 막아
  `becomen → not_found` 회귀를 낸 것을 정정. `-man` 형태가 **사전에 있을 때만** 양보. 31단어 전수 통과.
- `20260811132640_deliver_chapter_vocab` — **L2 개인화 전달 계층 신설** (ADR 0004 D7).

L2 분리 근거: 같은 챕터 세트가 경로마다 다른 정책으로 전달되고 있었다 — enroll 은 책 전체 50개
(364챕터 Les Misérables 도 50단어), 구독 버튼은 세트 전량(개인화 0), 가장 좋은 로직인 리더 i+1
패널은 **표시 전용**이라 FSRS 와 단절. 그리고 발행 cap 40 이 챕터 길이를 무시해 993챕터 중
**241(24%)이 밀도 2% 초과(과부하)**, 130(13%)이 0.3% 미만(희박) — 1,000단어 챕터와 12,000단어
챕터 사이 **16배 격차**. `deliver_chapter_vocab` 는 분량을 `clamp(round(wc/1000×8), 8, 30)` 로
바꾸고 기보유 제외 + i+1 가우시안 재랭킹을 적용한다. 함수만 추가하고 기존 경로는 미변경
(되돌리기 = `DROP FUNCTION` 한 줄).

결과 — 결함 01/02/04/05 = **0** · 회귀 테스트 59/59 · 영향 도서 11권 재추출 완료.
보류 1건: `Twenty years after`(gutenberg)는 `gutenberg.org` ECONNRESET 으로 합자 fold 미적용.
03(문맥POS 4,296단어)은 사전 내용 결함이라 `v_dict_pos_sense_gap` 큐로 분리돼 있다.

### 게임 튜토리얼 19종 자기발전 — 평가 9.6 → 16.3/20 (평가 → 확장 → 재작성 → 적대적 역채점 → 교정)

아케이드 Protocol 브리핑(카드 `(?)` → 보드 그림 3장 + 눌러서 통과하는 Trial)이 **각 게임에
최적합한지** 전수 점검했다. 읽기 전용 평가자 5명이 게임 소스와 대조해 채점한 결과 **평균
9.6/20**, 결함 132건. 다섯 평가자가 독립적으로 같은 결론에 도달했다 — **계열 안에서
브리핑이 구별되지 않는다.** 19종 중 11종이 `pick` + 1스텝 "뜻 고르기"라 trial 을 서로 바꿔
끼워도 통과했고, 그건 19종 공통 동작이라 그 게임을 아무것도 구별해 주지 못한다.

**진단이 뒤집힌 지점**: 문안 문제로 보였지만 실제 병목은 **데이터 모델**이었다. `hud` 가
`{label, pct}` 하나뿐이라 촛불 3개를 "반쯤 남은 촛불"로 그릴 수밖에 없었고, 그러면 작성자가
없는 게이지 이름(`물길`·`등불`)을 지어내 메운다. 타이핑 표면이 없어 세 게임의 손동작은
**거짓으로 적을 수밖에 없었다**(motion 0점). 문장을 다듬는 작업으로는 decisive 1.11 이
움직이지 않는다.

| 축 | 이전 | 이후 |
|---|--:|--:|
| identity 정체 | 2.32 | **3.89** |
| motion 아키타입 | 2.32 | **3.58** |
| decisive 고유 결정 | 1.11 | **3.26** |
| truth 사실 | 2.05 | **3.00** |
| surface 표면 | 1.79 | **2.53** |
| **총** | **9.6** | **16.3** /20 · 하락 0종 |

- **표현력 확장 6종** — 게이지 배열+핍+숫자 / 스텝·프레임별 표면 교체 / 결정 스트립(격자 밖) /
  좌표 격자 / 비용 타일 / 타이핑 아키타입. 상세는 [MODULES.md](./MODULES.md#protocol-브리핑).
  채택: 결정 18종 · 핍 14종 · 비용 7종 · 타이핑 3종 · 좌표 2종 · 게이지 48개(이전 19종 각 1개 이하).
- **비용 타일은 오답이 아니라 지출** — 탁본·봉투 개봉·다시 듣기는 대가를 내고 정보를 사는
  수단인데 이전 렌더러는 `want` 에 없는 타일을 누르면 흔들어서, 학습자가 그것을 실수로 배웠다.
- **파일을 계열별로 분리** (`brief/{recall,stake,assemble,rule,special}.ts` + `types.ts` + `index.ts`).
  한 파일에 19종을 몰면 옆 게임의 브리핑이 보이지 않아 서로 베낀 튜토리얼이 된다 — 실제 원인.
- **적대적 역채점이 대가를 잡았다** — 수치를 대거 추가하자 틀릴 여지도 늘어 **새 거짓 40건**이
  생겼다(`ghost-race` 는 truth 가 오히려 내려갔다). 교정 라운드에서 **110건** 수정
  (truth 56 · surface 33 · decisive 18): "유령 목표 40.0초"는 `PACE_MARGIN 1.06` 누락으로
  실제 42.4초 · "앞서 있으면 1구간 반납"은 `IN_WRONG_LEAD_MIN=2` 라 리드 2구간부터 ·
  `DEEP_FELL` 은 무너진 칸 수가 아니라 낙차 총합 · "관망은 잃지 않는다"는 지분을 실어 뒀다면
  원금 60%만 회수. 원칙은 **확인 못 한 수치는 지운다 — 없는 것보다 틀린 것이 나쁘다**.
- **검증** — trial 스텝 평균 1.1 → 2.7 (1스텝 재인만 시키는 게임 0). 단위 22 → **33개**
  (새 프리미티브 불변식 + 최적합 계약 4개: 1스텝 금지 · 판돈 가시성 · 트라이얼 서명 충돌 금지 ·
  objective 공통 서술 금지). [15-arcade-brief.spec.ts](../apps/web/tests/e2e/15-arcade-brief.spec.ts) 가
  **19종 전수**를 브리핑 데이터로 구동(`want` 를 순서대로 누르고 타이핑은 실제 입력) — 22/22 통과.
- **테스트 상한을 추측에서 실측으로** — "타일 9개 이하"는 지어낸 숫자였다. 390×844 에서 19종
  보드 높이를 재 보니 5행(cascade 9타일)은 673px 로 멀쩡하고 6행(connections 11타일)만
  887px 로 뷰포트를 넘어 *지시문을 보면서 마지막 줄을 누를 수 없었다*. 규칙을 그 측정값으로
  다시 쓰고 connections 를 정리해 **한 화면 초과 0종**(최고 836px). 그 과정에서 figure 2 가
  "시작 글자 g-" 묶음에 `whisper`(w-)를 지목하던 오류도 발견해 고쳤다.

### PDCP 현대화 단계 + 트랙 기록 (마이그레이션 `pdcp_modernize_stage_and_run_anchor`)

- **`modernized` 선택 단계** — ocr 과 review 사이. 드레인 체인에는 없다(별도 트리거).
  건너뛸 수 있고, 산출물이 `modern/` 에 따로 쓰이므로 되돌릴 수 있다.
- **`modernize_track/model/env`** — restyle(모델 재작화)이면 모델·환경이 **반드시** 남는다(CHECK).
  없으면 어느 모델 산출물인지 알 수 없어 재현도 라이선스 감사도 불가능하다.
- **`comic_gen_runs.pd_issue_id`** — CCP run 관측 테이블을 PDCP 도 쓴다.
  `library_book_id` nullable 로 완화하고, 둘 중 하나는 반드시 있어야 한다(고아 run 차단).
- 검증: restyle+모델 삽입 통과 / restyle-모델없음 거부 확인(둘 다 롤백, 잔여 0).

#### 콘솔 수정

- **동작하지 않는 명령을 안내하고 있었다** — 패널이 `--env kaggle-t4` 를 예시로 들었는데
  `modernize.mjs` 는 그걸 거부한다(edit 워크플로가 RunPod 에만 있음). RunPod 전용임을 명시.
- **지우기 확인(erase-preview) 추가** — GPU 없이 말풍선 지우기만 실행. 모델 트랙의 유일한
  비가역 비용은 GPU 시간이고, 남은 글자를 모델이 가짜 글자로 재현하므로 태우기 전에 봐야 한다.
- 모델·환경 상수를 라우트 한 곳으로 모음 — CLI 인자와 DB 기록이 갈리면 감사 기록이 거짓이 된다.


### /arcade 재설계 — "Game Lab" + 게임별 Protocol 브리핑 (v08.3, 마이그레이션 0)

19종을 고르는 근거가 **이름·색·한 줄 태그라인** 뿐이었다. 게임마다 판돈 구조가 다르고(시계·거리·자본·박·보존도) 그 차이가 곧 존재 이유인데, 학습자는 들어가 봐야만 알 수 있어 선택이 사실상 찍기였다. 첫 30초를 규칙 파악에 쓰다 이탈하는 구조.

- **연구소 은유 + 영문 구조 라벨** — `아케이드` → **Game Lab**. 트랙 3개가 구역이 됐다: **Recall Bay(6) · Synthesis Bay(6) · Inference Bay(7)**. 카드마다 실험 코드(`RC-01`·`SY-04`·`IN-07`, `HUB_TRACKS[].code` + 표시 순번에서 파생). 상단에 **Lab Index**(구역 목차) 신설 — 19장이 한 화면에 깔리므로 목차가 앞에 선다. 구조 라벨만 영문이고 설명 문장은 한국어로 남겼다.
- **Protocol 다이얼로그** — 카드 우상단 `(?)` → `OBJECTIVE / PROCEDURE / TRIAL RUN / NOTES`. 절차는 **보드 그림 3장**(초기·성공·실패)이고, 마지막은 학습자가 **직접 눌러 통과하는** 미니 튜토리얼이다. 계열(blitz)은 탭으로 4모드 전환. `Launch` 는 허브가 계산한 **스코프 포함 URL**을 그대로 받는다.
- **신설** — [lib/game/brief.ts](../apps/web/src/lib/game/brief.ts)(19종 브리핑 SSoT) · [BriefBoard.tsx](../apps/web/src/components/game/brief/BriefBoard.tsx) · [GameBriefModal.tsx](../apps/web/src/components/game/brief/GameBriefModal.tsx) · [BriefButton.tsx](../apps/web/src/components/game/brief/BriefButton.tsx).
- **아키타입 4개로 수렴** — `pick` / `group` / `assemble` / `judge`. 19종의 표면은 다 달라도 학습자의 손동작은 넷뿐이라, 렌더러 하나가 `figure`(정적 삽화)와 `trial`(실제 클릭) 두 모드로 쓰인다. 스크린샷을 쓰지 않은 이유: 게임이 바뀌면 조용히 거짓이 되고, 스크린리더·대비·터치 타겟을 통제할 수 없다.
- **카드 DOM 재구성** — `.arc-slot`(컨테이너) > `<a class="arc-card">` + `<button class="arc-brief">` **형제**. 중첩 인터랙티브를 만들지 않으면서 e2e 계약(`.arc-grid a[href^="/play/"]` = 도달 가능 게임 수)을 그대로 지킨다.
- **카탈로그 드리프트 2건 교정** — `wordblitz` 태그라인이 "타이머와 콤보로 몰아붙이는" 이었으나 v08 재설계로 **이 게임에는 시계가 없다**(목숨 3 + 조임 카드). `daily-blitz` 모드 노트의 "내장 뱅크" 도 v07.8 이후 거짓. 모드 라벨 영문화(Classic·Ghost·Economy·Daily).
- **검증** — axe(WCAG 2.1 A/AA) 허브 0건 · 다이얼로그 5종 0건, 390/768/1280 가로 넘침 0, 모달 패널 가로 넘침 0. 신규 e2e 4건([09-arcade-access](../apps/web/tests/e2e/09-arcade-access.spec.ts) G1–G4: 프레임 3장·오답 비통과·Esc 포커스 복귀·계열 탭·트리거 전수/44px) + 스코프 유지([13-arcade-integrity](../apps/web/tests/e2e/13-arcade-integrity.spec.ts) B 에 Launch 단언 추가). 신규 유닛 [brief.test.ts](../apps/web/src/lib/game/__tests__/brief.test.ts) 22건 — `want`/`focus` 참조 무결성, 슬롯 수 = 정답 길이, ok 토큰 고아 검출(작성 중 실제로 `word-customs` 정답 누락 1건을 잡았다).
- **모달 금지 규칙과의 관계** — CLAUDE.md 가 금지하는 것은 **세션 중** 인출을 끊는 오버레이다. 이 다이얼로그는 세션 진입 **전** 국면에만 열린다.

> ⚠️ **커밋 추적** — 이 작업의 코드는 `12a29531 feat(pdcp): 현대화 콘솔 트리거 + GPU 연결 점검` 안에 들어 있다. 같은 worktree 를 쓰던 다른 세션이 스테이징 창 사이에 커밋해 20파일을 함께 가져갔고, push 된 뒤라 되돌리지 않았다(`--force` 금지). 재발 방지는 [WORKTREE.md §5.1](./WORKTREE.md).

### 빌드 게이트 복구 — lint error 5건 청산 + 검증 빌드 격리

v06.117 에서 `eslint.ignoreDuringBuilds` 를 `false` 로 되돌린 뒤 새로 쌓인 error 5건이 `next build` 를 막고 있었다. 규칙을 끄지 않고 원인을 고쳤다.

- **`useOil` → `spendOil`** ([WordsmithVigilGame](../apps/web/src/components/game/wordsmith-vigil/WordsmithVigilGame.tsx)) — 게임 동작("기름을 쓰다")인데 `use` 접두 때문에 `react-hooks/rules-of-hooks` 가 훅으로 보고 "콜백 안에서 훅 호출" 로 판정했다. 훅이 아닌 것에 훅 이름을 주지 않는 쪽이 옳다.
- **삼항 문(statement) 3곳** ([ComicReader](../apps/web/src/components/comic/ComicReader.tsx) ×2 · [AdminComicClient](../apps/web/src/app/admin/comic/AdminComicClient.tsx) ×1) — `n.has(k) ? n.delete(k) : n.add(k)` 를 `if/else` 로. 동작 동일.
- **미사용 `bookStatus`** ([ComicReviewClient](../apps/web/src/app/admin/comic/%5BbookId%5D/ComicReviewClient.tsx)) — 목록 화면의 열이라 상세에서는 쓰지 않는다. 구조 분해에서 제거.
- **`distDir` env 오버라이드 신설** ([next.config.mjs](../apps/web/next.config.mjs)) — `next build` 가 dev 서버와 같은 `.next` 에 써서, 빌드를 검증하면 dev 라우트가 무작위 404 로 죽었다. `NEXT_DIST_DIR=.next-verify` 로 격리(기본값은 `.next` 라 CI 무영향).
- **결과** — `next lint` **0 error / 10 warning**, 풀 `next build` **EXIT 0** (`✓ Compiled successfully`, `/arcade` 19.8 kB / First Load 122 kB), 검증 중 dev 서버 3000 정상 유지.

### Admin 전 화면 화면도움말 — 71개 (37 화면 + 34 탭), Claude Code 드레인 7종 포함

관리자가 파이프라인 화면에서 다음 행동을 판단할 근거가 화면 어디에도 없었다. 라벨은 "무엇을 누르는지"만 말하고, **순서·전제·되돌릴 수 있는지·실패하면 어떻게 되는지**는 코드를 읽어야만 알 수 있었다. 특히 Claude Code 드레인은 "버튼을 누르면 끝"이 아니라 관리자가 CLI 를 직접 돌려 큐를 비우는 반자동 작업이라, 화면만 봐서는 시작조차 못 한다.

- **캡처 근거로 작성** — dev admin 우회를 임시로 켜고 Playwright 로 31 라우트 / 56 화면·탭을 PNG + DOM 다이제스트로 수집한 뒤, 파이프라인별 서브에이전트 8개가 캡처를 먼저 보고 코드로 사실을 확인해 작성 (코드만 읽으면 화면에 없는 것을 설명하게 된다). 작업 후 `.env.local` 우회 플래그 원복.
- **구조 고정** — `ScreenHelp {summary · when · steps · fields · cautions · drain · seeAlso}` ([types.ts](../apps/web/src/lib/admin/help/types.ts)). 렌더가 한 곳이라 어느 화면에서든 같은 자리에서 같은 것을 읽는다.
- **파이프라인별 파일** — `lib/admin/help/{articles,curation,comic,pd-comics,vocab,vrl,quality,ops}.ts` → [index.ts](../apps/web/src/lib/admin/help/index.ts) `HELP_REGISTRY`. 소유권을 그 화면을 고치는 사람에게 두어 도움말이 코드와 함께 갱신될 확률을 높였다.
- **인라인 펼침** — [AdminScreenHelp.tsx](../apps/web/src/components/admin/AdminScreenHelp.tsx). 모달이 아니라 열어 둔 채로 조작할 수 있다. 탭 라벨로 조회해 탭을 옮기면 내용도 따라간다.
- **드레인 7종** — curation(Curated Books) · comic-drain · pd-comics(큐/현대화 2종) · vocab-run-detail · vocab-run-seed · vocab-curate. 전부 **재실행 안전 여부**를 명시 (예: `insert --commit` 은 그 도서 컷을 전부 지우고 다시 넣으므로 중복되지 않지만, **부분 pages.json 으로 커밋하면 나머지 컷이 사라진다**).
- **런타임 검증** — 29 라우트에서 버튼 렌더 → 패널 펼침 → 탭 전환 시 내용 변화까지 실측. 28/29 통과 (`vocab-sources` 는 도움말이 아니라 페이지 자체가 500 — 아래 참조).
- **지침화** — 루트 [CLAUDE.md](../CLAUDE.md) §자동화 정책 에 `3️⃣ Admin 화면도움말 동반 갱신` 신설. 변경 유형별로 무엇을 고칠지 표로 명시 (탭 라벨만 바꾸면 도움말이 조용히 사라진다 · 되돌릴 수 없는 동작 추가 시 `cautions` 필수).

**미해결 (도움말과 무관한 선행 결함)**: `/admin/vocab/sources` 가 500 — `packages/vcb-curate-core/src/sources.ts:78` 이 `vocab_raw_texts` 를 조회하는데 그 테이블이 DB 에 없다. `vcb_init`(20260513211824) 이 생성했고 이후 DROP 마이그레이션은 없으므로 **마이그레이션 밖에서 사라진 스키마 드리프트**. 해당 화면 도움말·배선은 준비돼 있으나 페이지가 렌더되지 않아 보이지 않는다.

### 추출 "%"가 거짓말을 하고 있었다 — 지표를 사전 결합률에서 해석률로 (마이그레이션 2건)

**마이그레이션 [20260809120419_lbv_resolution_diagnostics.sql](../supabase/migrations/20260809120419_lbv_resolution_diagnostics.sql) · [20260809120437_v_book_extraction_stats_v2.sql](../supabase/migrations/20260809120437_v_book_extraction_stats_v2.sql) — 2026-08-09 사용자 승인 후 dev 적용 완료.**

#### 발단

`/admin/curation` 이 Les Misérables 을 "추출 89.5%", Introduction to Sociology 를 "88.4%" 로 표시했다. 40권 중 32권이 100% 미만.

원인은 추출이 아니라 **지표**였다. `v_book_extraction_stats.lemma_coverage_pct` 는 `shared_dictionary`(45,682 표제어) 결합률 하나만 쟀는데, 결합 실패에는 **결합돼선 안 되는 것**이 대량 섞여 있었다:

| 미매핑 4,882 단어 (17,971 출현) | 단어 | 출현 |
|---|--:|--:|
| 인명·지명 (`elizabeth` 602회 · `darcy` 392회) | 132 | 3,942 |
| 외국어 기능어 (`de` 799 · `la` 401 — Hugo 원문 프랑스어) | 291 | 3,238 |
| 고어 (`whilst` · `thee` · `hast`) — `enforce_archaic_not_in_shared`(ADR D4)로 **등재 자체가 금지** | 21 | 898 |
| 복합어·파생형·방언·철자변형 | 1,674 | 4,239 |
| 진짜 사전 공백 | 2,744 | 5,654 |

게다가 프로젝트에는 이미 `lexicon_clean`(455,037 · en/la/fr/it/de/es) · `spelling_norm`(312,642) · `archaic_dictionary`(810) · `dialect_map`(147) 과 이들을 전부 순차 조회하는 `lookup_word_meaning()` 이 구축돼 있었다. **결합 트리거만 그걸 안 봤다** — `trg_lbv_fill_lemma` 는 10티어 중 `direct`+`inflection` 2티어만 시도.

미매핑 4,882 단어를 `lookup_word_meaning` 에 넣으니 **4,362개(89.3%) · 출현 기준 94.6%** 가 해석됐다.

#### 설계 결정 — `lemma` 는 건드리지 않는다

`select_book_chapter_vocab` 이 `COALESCE(bv.lemma, bv.word)` → `shared_dictionary` 조인으로 학습 단어를 뽑는다. 해석 결과를 `lemma` 에 써 넣으면 `lexicon_clean` 에 en 표제어로 있는 `elizabeth`·`darcy` 가 **학습 단어로 승격**된다. 고어도 ADR D4 때문에 구조적으로 `lemma` 를 가질 수 없다. → 해석은 별도 진단 컬럼에만 기록하고, 지표를 그 컬럼으로 계산한다.

- `library_book_vocabularies` + `resolved_via` / `resolved_lang` / `resolved_word` / `noise_kind`, 부분 인덱스 `idx_lbv_unbound_book WHERE lemma IS NULL`.
- `fill_lbv_resolution(p_book_id, p_only_new)` 신규 + `trg_lbv_fill_lemma` 확장(기존 lemma 로직 불변, 뒤에 해석 기록만 추가).
- `v_book_extraction_stats` 기존 5컬럼 유지 + `noise_count` · `resolved_other_count` · `unresolved_count` · `resolved_pct` · `learnable_coverage_pct`.
- `v_book_extraction_reasons` 신규 — `bound`/`noise_person`/`noise_geo`/`foreign_{lang}`/`dialect_spelling`/`morphology`/`lexicon_only`/`unresolved` 버킷.

**백필 5,547행 → 전체 해석률 94.26% → 99.49%** (미해결 489행).

| 책 | 구 지표 | 해석률 | 미해결 |
|---|--:|--:|--:|
| Les Misérables | 89.5 | **98.7** | 167 |
| Introduction to Sociology | 88.4 | **98.7** | 142 |
| Dialogues | 92.9 | **99.6** | 39 |
| Pride and Prejudice | 94.9 | **99.9** | 4 |

#### 파생 발견 1 — HTML 수치 엔티티가 단어 첫 글자를 먹고 있었다

미해결 단어에 `ocial` · `ociety` · `eople` · `bject` 같은 조각이 있었다. `first_sentence` 를 보니 본문에 `&#8220;` 가 그대로 남아 있었다 — `pressbooks`/`standard-ebooks` 의 `decodeEntities` 가 named(`&ldquo;`)만 열거하고 **수치 fallback 이 없었다**. opentextbc 는 수치 엔티티를 쓴다. winkNLP 가 `&#8220;social` 을 한 토큰으로 물면서 첫 글자가 사라졌다. **Introduction to Sociology 815행 오염.**

- 두 ingester 에 `&#(\d+);` / `&#x([0-9a-fA-F]+);` generic fallback 추가 (나머지 7개 ingester 는 이미 있었음 — whitelist 복사가 원인).
- `htmlToPlainText` export + 회귀 [test/entity-decode.test.ts](../packages/library-pipeline/test/entity-decode.test.ts) 8케이스 (수치/hex/첫글자유실/named 회귀).
- ⚠️ 이미 적재된 815행은 **해당 도서 재수집 시에만** 사라진다. 현재 published + 챕터 단어장 23권이라 재수집은 cascade 삭제를 동반 — 미실행, 사용자 판단 대기.

#### 파생 발견 2 — 추출 노이즈 규칙 2건

`extract-lemmas.ts`:
- 로마숫자 장 번호(`CHAPTER XLIX` → `xlix`) 거부 — 길이 3+ 순수 로마숫자, `mix`/`dim`/`did`/`mid`/`lid`/`civil` 예외.
- 참고문헌 URL 잔해 거부 — 문장이 `http`/`www.` 를 포함하고 토큰 좌우에 공백 없이 `.`/`/` 가 붙을 때(`globalissues` · `religionfor` · `pdf` · `org`). 문장 끝 마침표 오탐 방지를 위해 URL 문맥을 함께 요구.

#### 어드민

`ExtractionCell` 배지 = `resolved_pct`, 옆 `·N↑` = `unresolved_count`(진짜 공백). 툴팁에 사전 결합률·타사전 해석·노이즈 제외를 함께 노출. `admin-queries.ts` 는 새 5컬럼을 함께 select/머지.

#### 전체 도서 재추출 + 미등록어 드레인 (2026-08-09)

40권 전체에 `backfill_book_lemmas` → 미결합 5,547 → **5,466**(81행 신규 결합, 7/13 이후 늘어난 사전 반영). `fill_lbv_resolution(null,false)` 로 5,466행 전량 재계산.

미등록어 수집은 **`collect_archaic_candidates` 를 쓰지 않았다** — `total_frequency = total_frequency + EXCLUDED` 누산이라 재실행 시 빈도가 부풀고, 드레인 임계(`freq>=3 OR books>=2`)가 그 값을 읽어 노이즈가 통과한다(`stage_book_dict_candidates` 주석의 "멱등"은 사실이 아님). `library_book_vocabularies` 원본에서 재계산하는 멱등 upsert 로 대체 → **4,722단어**.

드레인은 임계가 비용 캡이라 카탈로그 미해결 478개 중 46개만 대상이 됐다(나머지는 hapax). `dict-selfheal-drain.mjs` 에 **`SOURCE=corpus` 모드** 추가 — 후보를 임계가 아니라 "현재 카탈로그에서 실제 미해결"(`lemma IS NULL` + `noise_kind IS NULL` + `resolved_via IN (not_found,invalid)`)로 잡는다. Wiktionary 게이트는 그대로.

| 드레인 478단어 | |
|---|--:|
| `lexicon_clean` 적재 | **112** |
| 영어 섹션 없음(게이트 정상 거부 — 프랑스 은어·그리스/라틴·고유명사·의성어) | 347 |
| reject / thin / 번역실패 | 6 / 9 / 1 |

**해석률 99.49% → 99.61%, 미해결 489행 → 373행.** Les Misérables 98.7→98.9 · Sociology 98.7→**99.3** · Gibbon 99.3→99.5 · Dialogues 99.6→99.8.

남은 373행은 ① HTML 엔티티 조각(`ocial`·`ociety`·`eople` — 위 디코더 수정 후 **재수집해야** 사라짐) ② Hugo 은어장 프랑스어 ③ 그리스/라틴 전문어 ④ 인도 문화 차용어·의성어 ⑤ `brac`/`scarum` 등 이미 `TOKEN_BLOCKLIST` 에 있는 레거시 행. 즉 드레인으로 더 회수할 것은 남지 않았고, 나머지는 재수집 또는 정상 잔여다.

#### 추출 패널 "사전 미바인딩" 도 같은 착시였다 (마이그레이션 1건)

**마이그레이션 [20260809155433_find_unbound_resolution_aware.sql](../supabase/migrations/20260809155433_find_unbound_resolution_aware.sql) — 2026-08-10 사용자 승인 후 dev 적용 완료.**

테이블 셀은 고쳤는데 `BookExtractionPanel` 의 "사전 미바인딩 단어" 는 그대로였다. `find_unbound_book_lemmas` 의 결합 판정이 `shared_dictionary` 직접 + `spelling_variants` + `en_inflection_bases` + `archaic_dictionary` 4가지뿐이라, `lookup_word_meaning` 의 나머지 티어(`lexicon_clean` · `spelling_norm` · `dialect_map` · derivation · normalized · cluster)를 안 본다.

| 도서 | 패널 표시 | 조치 대상 | 배율 |
|---|--:|--:|--:|
| Les Misérables | 1,294 | 165 | 8× |
| Introduction to Sociology | 1,212 | 79 | 15× |
| Dialogues | 632 | 26 | 24× |
| Pride and Prejudice | 205 | 4 | **51×** |

`resolved_via`/`resolved_lang`/`noise_kind` 를 읽어 reason 을 쪼갰다. 새 3종은 모두 **조치 불요**:

| reason | 의미 |
|---|---|
| `foreign` | 영어 아님 — Hugo 원문 프랑스어 · Gibbon 라틴어 (`resolved_lang` 노출) |
| `morphology` | 파생·굴절·복합·정규화로 base 도달 — 재추출 시 base 로 surface |
| `lexicon_only` | `lexicon_clean` 으로 뜻이 해석됨 — `shared_dictionary` 등재 대상 아님 |

Les Misérables 1,294 내역: `lexicon_only` 594 · `foreign` 417 · `genuine_miss` 153 · `morphology` 103 · `noise` 15 · `spelling_variant` 12.

**행은 숨기지 않는다** — 큐레이터가 "왜 사전에 없는데 문제가 아닌지"를 봐야 하므로 목록에 남기고, 정렬로 조치 대상을 위로 올린다. 헤더 건수만 조치 대상 기준으로 바꾸고 옆에 `+ 설명됨 N건` 을 표기. 반환 타입 변경(2컬럼 추가)이라 DROP 후 재생성.

### 도서 어휘 선정을 절대 V6 바닥에서 book_v_level 상대 밴드로 (ADR 0004 · 마이그레이션 2건)

**[ADR 0004](../docs/adr/0004-book-vocab-selection-policy.md) Accepted. 마이그레이션 [20260810113051_vocab_selection_relative_band.sql](../supabase/migrations/20260810113051_vocab_selection_relative_band.sql) · [20260810113116_shared_words_v_level.sql](../supabase/migrations/20260810113116_shared_words_v_level.sql) — 2026-08-10 사용자 승인 후 dev 적용 완료.**

#### 발단 — Treasure Island 추출 결과 점검에서 구조 결함 3개가 드러났다

`select_book_chapter_vocab` 의 유일한 레벨 조건이 **하드코딩 `v_level >= 6`**(상한 없음)이었고 `book_v_level` 은 게이트에 전혀 쓰이지 않았다. 그런데 카탈로그 40권 중 **19권(48%)이 book_v_level 2~4**다.

| 도서 | bvl | 현행 후보 |
|---|--:|---|
| Bed-Time Stories | 2 | **0** — 세트 생성 불가 |
| The Mango Tree | 2 | 1개, 그것도 **V10** = i+8 |
| Gibbon | 11 | V6~7 단어 2,179개 = 독자 수준보다 한참 아래 |

커버리지가 확증한다 — Ammachi(V2)는 V1 51.9% → V6 94.4%. 이 책을 읽게 만드는 단어는 **V3~V6** 인데 게이트가 그 전부를 버렸다.

#### D1 — 레벨 게이트를 상대 밴드로

`v_level BETWEEN book_v_level-1 AND book_v_level+3`. 하한 −1 은 `book_v_level` 이 타입 p75 라 학습자 기준선보다 높기 때문, 상한 +3 은 i+4 이상이 작업기억을 초과하기 때문(원칙 ⑥). 코어 후보가 챕터당 5개 미만이면 그 챕터만 +4 로 확장. `book_v_level` NULL(Huck Finn)은 기존 `>= 6` 폴백.

| 도서 | bvl | 이전 (V 범위) | 이후 (V 범위) |
|---|--:|---|---|
| Bed-Time Stories | 2 | **0** | **20** (V1~V5) |
| The Mango Tree | 2 | 1 (**V10**) | **18** (V1~V4) |
| Ammachi's | 2 | 5 (V6·V7·**V11**) | **43** (V1~V5) |
| Winnie-the-Pooh | 4 | 228 (V6~V11) | 406 (V3~V7) |
| Treasure Island | 7 | 2,053 (V6~V11) | 1,719 (V6~V10) |
| Gibbon | 11 | 6,687 (V6~V11) | 1,552 (**V10~V11**) |

#### D2 — composite 레벨 축을 절대 밴드에서 i+1 거리로

`CASE v_level BETWEEN 6 AND 9 THEN 1.0 …` → `GREATEST(0, 1 - |v_level - (unit_v_level+1)| / 4)`. 정확히 i+1 이 최고점. 단위 레벨이 NULL 이면 옛 절대 밴드로 폴백해 회귀 없음. 나머지 3축(전역빈도 0.40 · 단위내빈도 0.35 · 검증 0.10)은 레벨과 독립이라 유지. `select_article_vocab` 도 같은 함수를 쓰는데 자기 단위 레벨을 넘기므로 동일 로직이 맞다(현재 article vocab 0행).

#### D6 — `shared_words.v_level`

발행물이 `cefr_level`(6단계)만 갖고 있어 VRL V-Level(0~11) 정보가 깎여 있었다 → 학습자 개인 레벨 하위 필터링 불가. 컬럼 추가 + `lemma → shared_dictionary` 백필 **32,966행 100%** + `publish_book_word_sets` 이 적재하고 세트 설명·`curation_query` 에 밴드 범위를 기록(`version=3`).

#### 미적용 (ADR §5)

#### D5 — 책 고유 어휘를 "이 책의 말" 읽기 지원 패널로 (마이그레이션 1건)

**[20260810234335_list_book_support_vocab.sql](../supabase/migrations/20260810234335_list_book_support_vocab.sql) — 2026-08-11 사용자 승인 후 dev 적용 완료.**

Treasure Island 의 `crosstrees`·`keelhauling`·`deadlight`·`handspike`·`afterdeck` 같은 항해어는 읽기 중 탭하면 뜻이 나오지만 `shared_dictionary` 미등재라 챕터 단어장·플래시카드·ScriptQuiz 에는 없다. 버리면 이 책을 읽게 만드는 말이 통째로 사라지고, 학습 목표 어휘에 넣는 것도 틀렸다(항해 전문어는 한국 고등학생 어휘 목표가 아니다).

**초안의 word set 방식은 폐기했다.** `shared_word_sets` 의 의미론이 "구독 가능한 학습 목록"이라 — 구독하면 `vocabularies` 로 들어가 FSRS 를 탄다 — set 으로 만들면 `/library/vocab` 목록·추천 RPC·구독 액션 세 곳에 "set 이지만 set 처럼 굴면 안 됨" 예외를 달아야 한다. → **읽기 전용 RPC + 접힌 패널**로 갔다. 새 테이블·세트 행·예외 가드 0.

- `list_book_support_vocab(uuid, int)` — `SECURITY INVOKER`(RLS 그대로 적용) · anon/authenticated GRANT.
- `BookSupportVocabPanel` — 책 상세, 챕터 단어장 아래·본문 위. 기본 접힘, 펼칠 때 1회 fetch (Calm UI + Progressive Disclosure).

품질 게이트(뜻이 `lexicon_clean` 자동 번역이라 그대로 노출 불가): 길이 4자 이상(2자 토큰 `ho`→"홀뮴" · `un`→"국제연합" 오역 제거) · 책 내 2회 이상 · `resolved_via='coverage-clean'`+`lang='en'` · `noise_kind` 없음 · 뜻 4~90자 + 한글 포함 + 구두점 시작 아님 + 다의어 나열 아님.

결과: Sociology 277 · Dialogues 148 · Les Misérables 133 · Gibbon 103 · Twenty years after 29 · Tom Sawyer 28 · **Treasure Island 27**(`mutineer` 22회 · `cutlas` 15 · `deadlight` · `crosstrees` · `handspike` · `keelhauling` · `oilskin` · `pannikin` · `afterdeck`). 패널 상한 60.

**한계**: 게이트 후에도 거친 번역이 ~18% 남는다(`seafaring`→"물로 여행하다" · `superintend`→"보고 직접"). 암기 대상이면 반려할 수준이라, UI 문구를 "외울 단어가 아니라 읽을 때 참고하세요" 로 명시했다.
- **D5** 책 고유 어휘 `library_book_support` 2차 세트.
#### 재발행 1단계 — `ready` 25권 완료

D1·D2 는 기존 발행 세트에 소급되지 않는다(`publish_book_word_sets` 이 기존 세트를 `CONTINUE`). 학습자 노출이 없는 `ready` 도서부터 적용했다 — `/library/vocab` 은 `library_book` 카테고리를 제외하고, `/library/books` 와 `recommend_word_sets_for_user` 는 `status='published' AND published_at IS NOT NULL` 을 요구하므로 노출 0.

**509 세트 / 10,676 단어 발행**, 밴드 이탈 0건(`v_level > band_ceil+1` 0 · `< band_floor` 0).

| bvl | 밴드 | 예 |
|--:|---|---|
| 2 | V1~V5 | Bed-Time Stories 20단어(이전 **0**) · The Mango Tree 18(이전 1, V10) · The Race 16 |
| 3 | V2~V6 | The Magic Block 40 · Who Stole Bhaiya's Smile? 40 |
| 4 | V3~V7 | Get Down, Rocky! 15 |
| 7 | V6~V10 | Treasure Island 34세트 1,280단어 |
| 8 | V7~V11 | Les Misérables 360세트 5,654단어 |
| 9 | V8~V11 | Dialogues 22세트 696단어 |

#### 재발행 2단계 — `published` 13권 완료 (마이그레이션 1건)

**[20260810233306_republish_book_word_sets_band_and_vlevel.sql](../supabase/migrations/20260810233306_republish_book_word_sets_band_and_vlevel.sql) — 2026-08-11 사용자 승인 후 dev 적용 완료.**

새 함수를 만들지 않고 기존 `republish_book_word_sets(uuid,int)`(`20260718100070`)를 확장했다 — 거의 같은 함수가 둘이면 어느 쪽이 정본인지 흐려진다.

**세트 행을 유지하고 `shared_words` 만 교체**한 근거:
- `user_word_set_subscriptions.set_id` 가 **ON DELETE CASCADE** — 세트를 지우면 구독이 사라진다(Twenty years after 90 · Gibbon 71 · P&P 61 · Pinocchio 36 · A Christmas Carol 10 · Ammachi 1).
- `vocabularies.shared_set_id` 는 SET NULL — 출처 링크 269행이 끊긴다.
- FSRS 진도는 안전. `difficulty`/`stability`/`next_review_at` 은 학습자 자신의 `vocabularies` 행에 있고 **`shared_words` 를 가리키는 FK 는 존재하지 않는다**(실측). 세트는 카탈로그이지 진도가 아니다.

확장 3가지: ① `v_level` 적재(D6) ② 설명·`curation_query` 밴드 기록 + `version=3` ③ **신규 선정 0 챕터는 건드리지 않음** — 기존 구현은 책 전체 `shared_words` 를 DELETE 한 뒤 새 선정만 INSERT 해 선정 0 챕터가 빈 세트로 남았다.

| 도서 | bvl | 이전 | 이후 | 밴드 |
|---|--:|--:|--:|---|
| Ammachi's Amazing Machines | 2 | **4** | **40** | V1~V5 |
| Tell Me, What is a Drone? | 2 | **5** | **40** | V1~V5 |
| Winnie-the-Pooh | 4 | 174 | **366** | V3~V7 |
| Fables | 6 | 1,029 | 1,309 | V5~V9 |
| The Adventures of Pinocchio | 6 | 1,005 | 1,120 | V5~V9 |
| Pride and Prejudice | 8 | 1,786 | 1,550 | V7~V11 |
| Twenty years after | 8 | 2,703 | 2,387 | V7~V11 |
| **Gibbon** | 11 | 2,450 | **1,355** | **V10~V11** |

검증: 구독 274건 보존 · `vocabularies.shared_set_id` 1,541행 보존 · `shared_words.v_level` NULL 0건 · 전 세트 `version=3`.

#### D3 — `noise_blacklist` 를 영구 차단에서 플래그로 (마이그레이션 2건)

**[20260810115121_noise_blacklist_is_blocking.sql](../supabase/migrations/20260810115121_noise_blacklist_is_blocking.sql) · [20260810115154_find_unbound_respect_is_blocking.sql](../supabase/migrations/20260810115154_find_unbound_respect_is_blocking.sql) — 2026-08-10 사용자 승인 후 dev 적용 완료.**

`stage_book_dict_candidates` 가 `NOT EXISTS (noise_blacklist)` 로 사전 등재 큐 진입을 막는데, 두 자동 sweep 이 실단어를 대량 오등록했다:

| source / category | 총 | `lexicon_clean(en)` 실단어 | 오탐률 |
|---|--:|--:|--:|
| `auto-latin` | 1,546 | 43 | 2.8% |
| `auto-latin-broad` | 4,563 | 340 | 7.5% |
| `auto-tail` | 11,002 | 3,019 | 27% |
| `final-sweep` | 4,672 | 3,883 | **83%** |

`is_blocking boolean` + `released_reason` 추가. **DELETE 가 아니라 플래그** — 판정 근거(`source`·`note`)를 지우면 되돌릴 수도 감사할 수도 없고, ADR 0002 가 같은 결함을 진단하고도 미적용으로 멈춘 사이 반대 방향 sweep 이 쌓인 전례가 있다.

두 sweep 의 실단어 6,902건 중 고어 표지 81 · 방언 표지 18 · 코퍼스 대문자전용(고유명사) 20 을 제외한 **6,783건 해제**(잔여 차단 17,544). `auto-latin` 계열은 손대지 않았다. 코퍼스 교차검증: 6,902건 중 카탈로그에 등장하는 1,755건 가운데 고유명사는 20건뿐이고 1,735건이 소문자로 실제 출현.

게이트 2곳이 `is_blocking` 을 존중 — `stage_book_dict_candidates`(등재 큐), `find_unbound_book_lemmas`(진단 라벨).

Treasure Island 재분류: `mutineer`(22회, 이 책의 주제어) · `repaint` · `pickax` 가 노이즈 → **보조사전 해석**(등재 큐 진입 가능), `nimbleness` · `slyness` · `foolhardiness` · `circumspectly` 가 노이즈 → **형태 회수**.

#### D4a·D4b — 읽기 중 단어 탭 오역 제거 (마이그레이션 1건)

**[20260810135205_lookup_proper_noun_guard_and_tier_order.sql](../supabase/migrations/20260810135205_lookup_proper_noun_guard_and_tier_order.sql) — 2026-08-10 사용자 승인 후 dev 적용 완료.**

> **ADR 0004 초안 D4 정정**: "`person_noise` 777건 중 373건이 실제 영단어" 는 오독이었다. `lexicon_clean(lang='en')` 은 **Wiktionary 인명·지명 항목을 포함**하므로 그 근거가 성립하지 않는다. 373건은 `abraham`·`achilles`·`aesop`·`parker` 등 대부분 진짜 고유명사였고 분류가 맞았다. → 일괄 `dialect_map` 이관은 폐기하고 아래로 재정의.

`lookup_word_meaning` 의 티어 순서가 결함의 직접 원인이었다 — **자동 임포트 사전(`lexicon_clean`)이 수기 큐레이션(`dialect_map`)보다 앞**에 있었다:

| 단어 | 출현 | 이전 | 이후 |
|---|--:|---|---|
| `thee` | 234 | "번창하기 위해; 번영하기 위해" | **너, 당신** |
| `thy` | 188 | "당신에게서, 또는 당신에게 속해…" | (개선, `normalized-coverage`) |
| `hast` | 67 | ", 2d 당. 노래하다. 대가. 의." | **가지다, 소유하다** |
| `didst` | 19 | ", 2D 사람. 노래하다. 꼬마 도깨비." | **하다** |
| `spake` | 16 | "꼬마 도깨비. ~의" | **말하다, 이야기하다** |

**`spelling` 티어는 옮기지 않았다** — `spelling_norm` 312,642행은 자동 생성이라 앞세우면 `mary`→`marry`(인명) · `gardiner`→`gardener`(P&P 의 Gardiner 부부) · `de`→`the` · `ami`→`amigurumi` 같은 **새 오역**이 생긴다. 기존 오역을 새 오역으로 바꾸는 셈.

그리고 `lexicon_clean` 의 Wiktionary 인명 항목 때문에 고유명사가 동음 일반명사 뜻을 받았다 — coverage-clean 해석 3,520단어 중 **91단어 / 3,582출현(23.6%)**. `Louis`(Les Misérables 56회)→"세계 헤비급 챔피언이었던 미국 권투선수", `Davy`(Treasure Island)→"전기화학의 선구자", `Pierre`→"사우스다코타 주의 주도".

→ `proper_noun_forms` 테이블(**154행**)에 코퍼스 대문자 증거를 물질화. 판정 규칙은 "본문에서 Initcap 으로 등장한 적 있고 **소문자로는 한 번도 안 나온** 형태" — 문두 대문자 오탐 방지다(`crosstrees` 처럼 문두에만 대문자로 나온 실단어는 소문자 출현도 있어 제외). `coverage-clean` 직전에서 `match_via='proper_noun'` 로 조기 반환.

구현은 함수 본문을 다시 쓰지 않고 **`pg_get_functiondef` 로 원본을 읽어 국소 치환 3건**만 적용, 각 치환을 `RAISE EXCEPTION` 으로 단언했다. 초안에서 `normalized`·`suggestion` 티어를 손으로 복원하다 `surface_variants()`·`dmetaphone` 을 놓친 전례가 있어서다.

UI: `WordLookupPopover` 에 `ProperNounBody` 추가 — "이름이에요 (인명·지명) / 등장인물이나 장소 이름이라 따로 외울 단어는 아니에요". 이전에는 `found=false` 라 "사전에 없는 단어예요"로 나왔다.

**미해결**: `louis`·`davy`·`pierre` 는 코퍼스에서 소문자로도 등장해(`twenty louis` 금화) 보수적 규칙에 안 걸린다. 완화하면 실단어 오탐이 늘어 보류.

#### D4c — 검증된 eye-dialect 14건 `dialect_map` 등록 (마이그레이션 1건)

**[20260810232100_dialect_map_verified_eye_dialect.sql](../supabase/migrations/20260810232100_dialect_map_verified_eye_dialect.sql) — 2026-08-11 사용자 승인 후 dev 적용 완료.**

D4b 로 dialect 티어가 coverage-clean 보다 앞서게 됐으므로, 등록하는 순간 정확한 표준어 뜻이 나온다. 후보 251건(coverage-clean 해석 중 + `spelling_norm` 표준형 존재 + 표준형이 사전 정식 표제어 + 고유명사 아님)을 현재 뜻 vs 표준어 뜻으로 나란히 놓고 **수기로 14건만** 골랐다.

| variant → standard | 이전 (틀린) 뜻 |
|---|---|
| `whilst` → while (263회) | "황제가 안디옥에 누워 있는 동안" |
| `em` → they (90회) | "인쇄에 사용되는 선형 단위(1/6인치)" |
| `dat` → that | "소리를 녹음한 디지털 테이프(DAT)" |
| `dern` → darn | "문기둥 또는 문설주" |
| `lak` → like | "라크족 (다게스탄 남부 민족)" |
| `hookey` → hooky | "고리 던지기 게임" |
| `sperrit` → spirit | 프랑스어 `sperrit` 로 오해석 "정념" |
| `mought` → might | "5월의" |
| `wot` → what | "1차 및 3차 인원. 노래하다…" |
| `sich`→such · `der`→there · `ter`→to · `yo`→you · `inclosure`→enclosure | — |

**제외** — `spelling_norm` 이 자동 생성이라 오매핑이 섞여 있다: `de`→the(프랑스어 관사) · `al`→all · `les`→less · `ha`→would · `ing`→king 등 짧은 파편·외국어(근거 없음) / `slue`·`greave`·`banquette`(현재 뜻이 실제로 맞음 — 비스듬히 돌리다·정강이 갑옷·벤치) / `hee`→he(hee-hee 웃음소리 가능) / `es`→is(독일어·스페인어 혼동).

재계산 후 `dialect` 티어 6단어 93출현 → **43단어 935출현**, `proper_noun` 가드 130단어 3,930출현, 전체 해석률 **99.62%**.

**별건 결함**: `shared_dictionary` 에 주격 대명사(`i`·`you`·`he`·`she`·`it`·`we`·`they`·`myself`·`itself`)는 있는데 **목적격·소유격·재귀형(`him`·`her`·`his`·`their`·`them`·`your`·`himself`·`herself`)이 없다.** `thy`→`your`·`hisself`→`himself` 가 dialect 티어를 못 타는 원인이고, `em` 은 `them` 대신 주격 `they` 로 우회 연결했다. 대명사 굴절 계열 등재는 VCB 소관.

### 고어 사전 810건을 조회 체인에 연결 — 만들어놓고 안 쓰던 자산 (마이그레이션 2건)

**[20260811121439_archaic_tier.sql](../supabase/migrations/20260811121439_archaic_tier.sql) · [20260811121523_archaic_tier_coverage_defer.sql](../supabase/migrations/20260811121523_archaic_tier_coverage_defer.sql) — 2026-08-11 사용자 승인 후 dev 적용 완료.**

#### 발단 — 정글북 Ch.1 학습 목표 2위가 `thou`(V10)

`archaic_literary` register 였다면 선정에서 배제됐을 자리다. 왜 안 붙었는지 추적하니 **`archaic_dictionary`(810건)를 참조하는 함수가 3개뿐이고 전부 소비가 아니었다**:

| 함수 | 용도 |
|---|---|
| `enforce_archaic_not_in_shared` | 등재 **금지** 트리거 |
| `find_derivational_candidates` | 후보 탐색 |
| `find_unbound_book_lemmas` | 진단 라벨 |

**`lookup_word_meaning` 티어 14개 어디에도 없었다.** 읽기 중 단어 탭도 학습 세트 선정도 고어 사전을 보지 않았다. `thee`·`hast` 가 뜻이 나오던 건 D4b 로 `dialect_map`(161)을 앞세운 덕이지 고어 DB 덕이 아니었다.

#### 중복 실태 — 810건 중 74%가 다른 사전에도 있다

| 교차 | 건수 | 판단 |
|---|--:|---|
| `lexicon_clean`(en) | **596 (74%)** | archaic 품질이 압도적 → archaic 우선 |
| `spelling_norm` | 162 | 철자 정규화 역할이 달라 유지 |
| `shared_dictionary` | **38** | shared 가 정본(register 부여됨) → archaic 쪽 정리 대상 |
| `dialect_map` | 25 | **14건 불일치, 전부 archaic 정확** |
| 고유 자산 | 211 | 다른 어디에도 없음 |

품질 비교 — `lexicon_clean` 은 자동 번역이라 시대 배경까지 어긋난다:

| 단어 | archaic_dictionary | lexicon_clean |
|---|---|---|
| `superintend` | **감독하다, 관리하다** | "보고 직접" |
| `cabman` | **마차꾼, 마부** | "생계를 위해 **택시**를 운전하는 사람" |
| `whilst` | **동안, ~하는 한편** | "…황제가 안디옥에 누워 있는 동안. **긴팔 원숭이.**" |

#### 티어 위치 — `dialect` 보다 앞

처음엔 "dialect 다음"으로 제안했다가 실측으로 뒤집었다. 두 사전이 겹치는 25건 중 **14건이 불일치이고 전부 archaic 이 정확**하다. `dialect_map` 은 표제어 결합용이라 base form 만 담아 시제·인칭·부정을 버린다:

| 단어 | archaic | dialect_map |
|---|---|---|
| `hath` | **has** | have |
| `spake` | **spoke** | speak |
| `tis` | **it is** | be |
| `agin` | **against** | again ← 의미가 다름 |
| `couldna` | **couldn't** | could ← **부정 소실** |

`couldna`→`could` 는 `en_negation_preserved` 가 잡아야 할 유형인데 `dialect_map` 경유라 안 걸린다. archaic 을 앞세우면 삭제 없이 무력화된다 — `dialect_map` 은 표제어 결합 용도로 계속 유효하므로 지우지 않았다.

응답: `match_via='archaic'` · `resolved_word=modern_equivalent` · `word_register='archaic_literary'`. 리더가 "whilst = while (고어)" 로 보여줄 수 있다.

#### 첫 삽입 위치를 틀렸고 실측으로 잡았다

`dialect` 티어 앞에 넣었는데 596건 중 상당수가 여전히 `coverage-clean` 으로 빠졌다. **D4b 이후 코드상 순서가 `… derivation → coverage-clean → coverage-clean_en → dialect → …` 라 "dialect 앞"이 곧 "coverage-clean 뒤"였다.** `dialect_map` 에 겹치는 단어만 통과하고 archaic 단독 보유분은 전부 가로채였다. → D4b 와 동일한 양보 패턴(`AND NOT EXISTS (archaic_dictionary …)`)을 coverage-clean 두 티어에 적용해 해결.

검증: `superintend`→"감독하다, 관리하다"(supervise) · `cabman`→"마차꾼, 마부"(cab driver) · `yonder`→"저쪽의, 저편의"(over there) · `unwearied`→"지치지 않는"(tireless) · `footfall`→"발소리"(footstep). 회귀 없음 — `crosstrees`·`mutineer` 는 archaic 미보유라 `coverage-clean` 유지.

#### 미결 (A-2)

- `shared_dictionary` 중복 38건 정리 — shared 가 정본이므로 archaic 쪽 제거
- `standard` 로 잘못 들어간 고어 register 교정 — `thou`(V10 standard) · `ante` · `direful` · `irremediable`
- `enforce_archaic_not_in_shared` 양방향화 — 현재는 archaic INSERT 만 막아 반대 방향으로 38건이 생겼다

### 신규 도서 추출 테스트 — 하네스 회귀 검증 + 블랙리스트 오탐 추가 해제 (마이그레이션 1건)

**[20260811114612_blacklist_release_various.sql](../supabase/migrations/20260811114612_blacklist_release_various.sql) — 2026-08-11 사용자 승인 후 dev 적용 완료.**

카탈로그에 없던 **The Jungle Book**(Kipling, Standard Ebooks)을 넣어 파이프라인 전체(ingest→normalize→segment→analyze→V-Level)를 돌리고 하네스가 회귀를 잡는지 검증했다. 힌디 차용어·창작 동물명·고어 2인칭이 섞여 가장 강한 시험 재료다. `reprocess-book.mjs` 사용(API 라우트는 `requireAdmin` 가드라 세션 필요).

**7챕터 / 50,974단어 / 어휘 2,939 / `book_v_level=7` / `cefr_band=B1`**, 챕터 편차 max/median 1.3.

#### 결과 — 결함 4종 전부 0, 회귀 없음

| 버킷 | 행 | 비율 |
|---|--:|--:|
| 학습대상(결합) | 2,826 | **96.2%** |
| 미등록(해석됨) | 75 | 2.6% |
| 노이즈 | 22 | 0.7% |
| 미해결 | 16 | 0.5% |

개별 판정을 전수 확인한 결과:
- **미해결 16건 전부 판정이 옳다** — `snakeling`·`flipperling`·`bearlings`·`untigerish`·`camelty`·`scumfish`(Kipling 조어) · `sssso`·`sssh`·`ahaa`(의성어) · `guddee`·`huqas`·`holluschick`(힌디/러시아 차용어).
- **고유명사 유입 0건** — `Mowgli`·`Baloo`·`Bagheera`·`Shere Khan`·`Hathi`·`Toomai` 가 하나도 안 들어왔다(PROPN 필터).
- **dialect 티어 실증** — `thee`·`hast`·`didst`·`dost`·`wouldst`·`hath` 6건이 전부 `dialect` 로 잡혔다. D4b(수기 사전 우선)가 새 재료에서 작동함을 확인.
- 학습 세트 7×40=280항목, 밴드 V6~V10(bvl 7), 실제 V 6–10·평균 7.8, **뜻 누락 0**.
- D5 "이 책의 말" 14건 — `ankus`(코끼리 몰이 갈고리)·`tailorbird`·`manling`·`headman`.

#### 발견 — 블랙리스트 오탐이 D3 범위 밖 source 에 잔존

`snarly`·`oozy`·`pignut` 이 실단어인데 차단됐다. D3 는 오탐률이 검증된 두 sweep 만 해제했는데 이들은 `various` 출처였다:

| source / category | 차단 중 | 실영단어 | 오탐률 |
|---|--:|--:|--:|
| `various` / proper_noun_marker | 69 | 57 | 83% |
| `various` / corrupt_token | 137 | 82 | 60% |
| `various` / interjection_noise | 126 | 74 | 59% |

> **처음엔 "source 가 아니라 판정 규칙으로 일원화" 하려 했는데 틀렸다.** 전체 적용하면 라틴어(`centum`·`utinam`·`meum`·`receptaculum`)와 코퍼스에 없어 대문자 검사를 못 타는 고유명사(`artemis`·`apaches`·`henry`·`mccarthy`)까지 풀린다. source 는 실제로 정보를 담고 있고 `auto-latin` 계열(오탐 2.8~7.5%)은 그대로 두는 게 맞다.

`proper_noun_marker` 카테고리도 제외했다 — 사람이 의도적으로 붙인 라벨이고 `india`·`harry`·`jasper`·`alan`·`napoleons` 처럼 "실단어이면서 고유명사"인 것들이다.

→ `various` × (`interjection_noise`|`corrupt_token`) 중 판정 통과 **86건 해제**(누적 6,869). `snarly`·`oozy`·`pignut`·`smutty`·`whiny`·`slippy`·`southwestward`·`semi-conscious`·`uncapable` 등. `cross-legged` 는 `gutenberg_supplement` 출처라 이번 범위 밖으로 남겼다.

### 사전 sense 보강 + 드레인 소진 — 자기감사 루프 R3 (마이그레이션 1건)

**[20260811053500_dict_pos_sense_backfill.sql](../supabase/migrations/20260811053500_dict_pos_sense_backfill.sql) — 2026-08-11 사용자 승인 후 dev 적용 완료.**

#### 사전 sense 보강 — 큐 27건 중 17건

`v_dict_pos_sense_gap` 을 Claude Code 배치로 드레인. `meanings_ko` 에 누락 품사 sense 추가 + 대표 뜻(`meaning_ko`)이 학습자 기준 명백히 틀린 6건 교정:

| 표제어 | 이전 대표 뜻 | 이후 |
|---|---|---|
| `high` | **황홀감, 들뜸; 약물 환각** | 높은 — 높이·지위·수준이 높은; (명사) 황홀감, 최고치 |
| `lead` | 납; (미국) 흑연심 | 이끌다, 인도하다; (명사) 납 (Pb), 연필심 |
| `hide` | 가죽, 짐승의 가죽 | 숨다, 숨기다; (명사) 짐승의 가죽 |
| `lay` | 평신도의, 비전문가의 | 놓다, 눕히다; (알을) 낳다; (형용사) 평신도의 |
| `gun` | 엔진을 힘껏 가동하다 | 총, 총기; (동사, 구어) 엔진을 힘껏 가동하다 |
| `wash` | 세탁물, 빨래, 옅게 칠한 색 | 씻다, 빨다; (명사) 세탁물, 빨래 |

**10건은 넣지 않았다** — winkNLP 태거 오류라 판단. `uttered`·`flung`(과거분사) · `observing`·`bowing`(동명사)을 noun 으로 태깅, `star`(고전 문학 verb 79회는 비현실적), `awful`·`dear`(adverb). 태거만 믿고 sense 를 넣으면 사전이 오염된다. 큐에 남겨 근거가 더 모이면 재검토.

결함 03: 9,788 → **7,987 출현(−18%)**. 전 카탈로그 재발행 완료.

#### 드레인 소진 확인

`SOURCE=corpus LIMIT=400` 재실행 → **적재 0건**. 315건 중 영어 섹션 없음 299 · reject 6 · thin 9 · 번역실패 1. 앞 라운드에서 회수 가능한 112건을 이미 가져갔고, 남은 것은 Wiktionary 에 영어 표제어로 **존재하지 않는다** — Hugo 은어장 프랑스어 · 그리스/라틴 · 인도 문화 차용어 · 원문 오타 · 의성어. **INFO(90) 320단어는 "사전에 없다"가 정답인 상태**임이 실측으로 확인됐다.

#### 잔여 7,987 출현의 진짜 원인 — `context_pos` 결측

재발행 후에도 `high`→"약물 환각" 같은 항목이 일부 남아 추적했더니, **출현의 대부분이 `context_pos IS NULL` 행**이었다:

| 표제어 | context_pos NULL | 값 있음 |
|---|--:|--:|
| `high` | 7행 **1,220회** | adjective 13행 172회 |
| `lay` | 8행 330회 | verb 10행 93회 |
| `spring` | 7행 375회 | verb 87 / noun 61 |
| `hide` | 13행 225회 | verb 122 / noun 21 |

`context_pos` 는 Phase 3 에서 추가된 컬럼이라 **그 이전 추출분(구 파이프라인 9권)이 전부 NULL** 이다. NULL 이면 `select_book_chapter_vocab` 이 `infer_form_pos()` 형태론 휴리스틱으로 폴백하는데, 그게 `high`→noun 을 반환해 "황홀감" 이 선택된다.

#### 해결 — sense 선택 폴백을 형태론 추측에서 코퍼스 실측으로 (마이그레이션 [20260811111430](../supabase/migrations/20260811111430_lemma_dominant_pos_fallback.sql))

**`context_pos` 를 채우지 않기로 했다.** 백필 근거를 실측하니 같은 책 안의 신호는 253행뿐이고 36,162행은 **다른 책**에서 온다(구 파이프라인 책은 통째로 NULL 이라 자기 책엔 근거가 없다). 그건 "이 챕터 문맥의 지배 POS"가 아니라 **코퍼스 전역 prior** 다. 그 값을 `context_pos` 에 써 넣으면 컬럼 의미가 오염되고 다음 사람이 측정값으로 오해한다. → `context_pos` 는 NULL(=미측정) 그대로 두고 **폴백 순서만** 바꿨다.

```
context_pos(측정) → 코퍼스 우세 POS(실측 통계) → infer_form_pos(형태론 추측)
```

형태론 추측을 없애진 않았다 — 코퍼스에 처음 등장하는 표제어에는 여전히 필요하다.

`mv_lemma_dominant_pos`(물질화) + `refresh_lemma_dominant_pos()`. **일반 뷰로 만들었다가 실패했다** — `select_book_chapter_vocab` 호출마다 91k행을 재집계하는데 재발행이 책당 2회(품질 게이트 + 본선정) 호출해 30s 게이트가 타임아웃했다. 물질화 + `lemma` 유니크 인덱스로 전환.

전 카탈로그 재발행 후 도서 챕터 단어장 검증 — `high`→"높은", `hide`→"숨다, 숨기다", `cover`→"덮다, 가리다"로 정리됐고 **틀린 뜻은 0건**이다.

> 검증 중 세트 소속을 한 번 오독했다. `high`→"황홀감" 등이 남아 보였는데, 그 항목들은 `curation_query->>'book_id'` 가 `library_books` 에 없는 **도서 무관 세트**(어원 세트 등)였다. 도서 추출 파이프라인의 산출물이 아니고 `republish_book_word_sets`(`category='library_book'`) 대상도 아니다. 대표 뜻을 바꿨으므로 그 세트들도 갱신 대상이지만 VCB/어원 파이프라인 소관.

**결함 03 지표(7,987)는 이 수정으로 줄지 않는다** — 그 뷰는 `context_pos IS NOT NULL` 행만 세므로 NULL 행은 애초에 분모에 없다. 이번 수정이 고친 것은 그 **NULL 행 1,147,815 출현**의 sense 선택이다. 지표를 줄이려면 사전 sense 를 더 넣어야 한다.

### 전 카탈로그 추출 품질 자기감사 루프 — 결함 4종 제거 + 상시 하네스 (마이그레이션 3건)

**[20260811044703](../supabase/migrations/20260811044703_negation_preserving_binding.sql) · [20260811045255](../supabase/migrations/20260811045255_extraction_quality_audit.sql) · [20260811045603](../supabase/migrations/20260811045603_abbrev_binding_and_ghost_purge.sql) — 2026-08-11 사용자 승인 후 dev 적용 완료.**

38권 96,636행을 버킷(학습대상/미등록/외국어/노이즈/미해결)으로 나눠 **학습대상 91,170행을 처음 감사**했다. 이전 작업은 전부 미결합 쪽만 봤는데, 학습자가 실제로 외우는 건 결합된 쪽이다.

#### R1 결함① — 반대말 결합 88단어 / 184회

| 표면형 | 결합 lemma | 학습자가 본 뜻 |
|---|---|---|
| `imprudent`(경솔한) | `prudent` | 신중한, 분별 있는 |
| `unwilling`(꺼리는) | `willing` | 기꺼이 ~하는 |
| `mislead` | `lead` | **납; 흑연심** |
| `needless`·`blameless`·`regardless` | `need`·`blame`·`regard` | — |

경로 추적: 현재 바인딩 함수들은 굴절 기반이라 이런 결합을 만들지 않고, `resolve_dict_headword` 도 부정 보존이 정상(`unreserved`→`unreserve`)이다. **레거시 행**이 `select_*_vocab` 의 `COALESCE(bv.lemma, bv.word)` 를 타고 전파된 것. 88단어 중 99행은 surface-first 규칙(`20260718100000`)이 막아줬지만 **9건이 전파됐고 4건은 이미 발행 단어장에** 실려 있었다 — `unreserved`→"비축" · `unshackled`→"수갑, 족쇄" · `unblemished`→"흠, 얼룩" · `unacknowledged`→"인정하다".

→ 불변식 `en_negation_preserved(surface, headword)` 신설 + 바인딩 경로 2곳이 강제 + 오염 88단어 `lemma=NULL`. **0건.**

#### R2 결함② — 약어 표제어 오결합

`dren`→`dr`("박사") · `ther`→`th`. 약어는 굴절형을 갖지 않으므로 굴절 폴백에서 `word_register='abbreviation'` 제외(직접 매칭 `bc`→`bc` 는 유지). **0건.**

#### R2 결함③ — 유령 어휘 (전 카탈로그로 확대)

Sociology 정리는 그 책만 대상이었는데 재감사에서 다른 책에도 있었다 — Ozma of Oz `tle`(6)·`peo`(3)·`cean`·`ture`, P&P `rs`(2), Styles `ture`. Gutenberg 소스라 원인은 엔티티가 아니라 드롭캡/줄바꿈 하이픈이지만 **판정 방법은 동일**하다(본문 대조). `purge_ghost_vocab(uuid DEFAULT NULL)` 로 일반화 → 7행 제거, **0건.**

#### 남은 결함④ — 문맥POS 미대응 sense 1,370단어 / 9,788회 (사전 내용)

`shared_dictionary` 가 동형이의어를 **단일 품사**로만 기록하고 하필 학습자에게 덜 중요한 뜻을 대표로 잡았다:

| 표제어 | 코퍼스 우세 POS | 현재 대표 뜻 |
|---|---|---|
| `high` (172회) | adjective | **"황홀감, 들뜸; 약물 환각"** |
| `lead` (152) | verb | **"납; (미국) 흑연심"** |
| `hide` (122) | verb | **"가죽, 짐승의 가죽"** |
| `mean` (252) | verb | "비열한, 못된" |
| `lay` (93) | verb | "평신도의, 비전문가의" |
| `gun` (34) | noun | "엔진을 힘껏 가동하다" |

추출·바인딩 결함이 아니라 **사전 내용** 문제라 이 파이프라인에서 고칠 수 없다. winkNLP 태거가 불안정해(`uttered`→noun, `everything`→verb) 일괄 제외도 오답이다. → **출현 가중 합의(우세 POS 30회 이상)로 고신뢰 27건만 추린 작업 큐 `v_dict_pos_sense_gap` 을 물질화**해 VCB 로 넘긴다.

#### 상시 하네스

`v_extraction_quality_audit` — 결함 5클래스 + INFO 1행. 새 도서 유입 후 DEFECT 행이 0 이 아니면 그게 작업 대상이다. INFO(90 사전 미수록 잔여 320단어)는 0 이 목표가 아니다 — 본문에 실재하는 프랑스 은어·그리스/라틴·문화 차용어라 정직한 잔여이고 `dict-selfheal` 드레인 대상.

| 결함 | 이전 | 이후 |
|---|--:|--:|
| 01 반대말 결합 | 88단어 | **0** |
| 02 register 오결합 | 2단어 | **0** |
| 03 문맥POS 미대응 sense | 1,370단어 | 1,370 (VCB 큐로 이관) |
| 04 유령 어휘 | 7행 | **0** |
| 05 HTML 엔티티 | 0 | **0** |

### HTML 엔티티 잔존 전수 제거 — 재수집 없이 (마이그레이션 4건)

**[20260811035506](../supabase/migrations/20260811035506_views_security_invoker_extraction.sql) · [20260811035529](../supabase/migrations/20260811035529_fix_chapter_html_entities.sql) · [20260811035548](../supabase/migrations/20260811035548_decode_entities_in_stored_sentences.sql) · [20260811040100](../supabase/migrations/20260811040100_decode_entities_article_sentences.sql) — 2026-08-11 사용자 승인 후 dev 적용 완료.**

앞서 "Sociology 어휘 조각 79행"으로 보고 재수집(cascade 삭제 동반)이 필요하다고 봤던 건이다. 부작용 없는 경로를 찾으라는 요청에 전수 조사하니 **범위가 더 컸고, 재수집은 필요 없었다.**

| 위치 | 건수 | 누가 보나 |
|---|--:|---|
| `content_chunks` (본문) | 23챕터 / **1,355회** | **학습자 — 읽는 화면** |
| `library_book_vocabularies.first_sentence` | 815 | 어드민 패널 · 리더 팝오버 근거 문장 |
| `shared_words.source_sentence` (도서) | 54 | **학습자 — 발행 단어장 예문** |
| `library_article_vocabularies.first_sentence` | 47 | ACP 아티클 |
| `shared_words.source_sentence` (아티클) | 9 | **학습자 — 발행 단어장 예문** |

#### 재수집이 불필요한 이유

`content_chunks` 는 content-addressed(hash PK)라 `library_chapters_master.content_hash` 포인터만 교체하면 된다 — **챕터 행·단어장 23권·구독·학습 진도 무변경**.

**오프셋은 재분절하지 않는다.** `&#8220;`(7자)→`“`(1자) 로 위치가 밀리는데, winkNLP 재실행은 EchoMatch 문장 경계를 바꿀 수 있다. 대신 **각 오프셋에서 그 앞 엔티티들의 축약량 합을 빼서** 원래 분절을 보존한 채 이동시켰다. 검증: 3개 챕터의 `sentence_offsets[5]`·`paragraph_offsets[8]` 위치 문자열이 이전과 **완전 동일**, 23챕터 전부 범위 내.

#### 유령 어휘 판정 — 열거가 아니라 본문 대조

본문을 고친 뒤 **그 책 어느 챕터에도 단어 경계로 등장하지 않는** 미해결 행이 곧 엔티티가 만든 유령이다. `ocial`·`ociety`·`atterns`·`bject`·`exuality`·`uty`·`ymbol` 등 **43행 삭제**, `deindustrialized`·`kmaq`·`mibunsei`·`religare` 같은 실제 어휘는 보존. blocklist 가 아니라 대조 방식이라 다른 책에 그대로 쓴다.

#### 도중에 잡은 자체 결함 2개

- `pgcrypto` 가 `extensions` 스키마인데 함수 `search_path` 가 `public` 고정이라 `digest()` 미발견 → 스키마 한정.
- **`('x'||hex)::bit(32)` 는 좌측 정렬** — `'x27'` → `0x27000000` = 654311424. `lpad(hex,8,'0')` 없이는 코드포인트가 완전히 틀린다. 범위 가드(`code > 1114111`)가 걸러서 조용히 건너뛴 덕에 오염은 없었다 — **가드가 없었으면 엉뚱한 문자를 썼을 자리**다.

#### 결과

전 계층 **0건** (`content_chunks` · `lbv` · `lav` · `shared_words` · `library_articles` · `texts`). Sociology 해석률 99.3% → **99.7%**, 미해결 79 → 36.

범용 디코더 `decode_html_entities(text)` 신설 — named + 10진/16진 수치 + 300자 절단 말단 파편 제거. `&amp;` 는 이중 디코딩 방지를 위해 마지막에 처리.

또한 `v_book_extraction_stats` · `v_book_extraction_reasons` 를 `security_invoker=true` 로 전환해 advisor `security_definer_view` ERROR 2건을 해소했다. `DEV_ADMIN_BYPASS` 미설정 + 두 뷰는 어드민 전용 조회라 실사용 영향 0.

#### 미결

- ~~`v_book_extraction_stats` · `v_book_extraction_reasons` advisor ERROR~~ → 위에서 해소 (전자는 v06.35 이전부터). 프로젝트 규약(`20260614150000_views_security_invoker`)상 `security_invoker=true` 여야 하나, 적용 시 `DEV_ADMIN_BYPASS` 경로(합성 admin = anon 세션)에서 미발행 도서 통계가 안 보이게 된다 — 사용자 판단 대기.
- 미해결 489행(520단어): 프랑스어 은어(Hugo 은어장) · 그리스/라틴 전문어 · 현대 사회학 신조어(`xenocentrism` · `normlessness`) · 인도 문화 차용어 · 의성어. `dict-selfheal-drain.mjs` 드레인 대상.

### 만화 탭 이름을 학습자 말로 · Comics 를 별도 메뉴로

`Adapted / 도서 각색`, `Restored / 원본 복원` 은 **우리 파이프라인 용어**였다. 원작에 무슨 처리를
했는지를 말할 뿐, 학습자가 *무엇을 읽게 되는지*는 하나도 알려주지 않는다. 각색·복원은 우리 사정이다.

| 이전 | 지금 | 학습자에게 |
|---|---|---|
| Adapted · 도서 각색 | **Book Comics** · 읽는 책을 만화로 | 라이브러리 도서의 만화판 — 원문·퀴즈와 이어진다 |
| Restored · 원본 복원 | **Vintage Comics** · 옛 영어 만화책 | 1940~50년대 실제 영어 만화책 |

- `/comics/restored` 페이지 제목도 `복원 만화` → `옛 영어 만화책`, `/comics/adapted` 는 `만화` → `책 만화`
  (탭이 둘인데 제목이 그냥 "만화"면 어느 쪽인지 알 수 없다).
- **Comics 를 Scripts 그룹에서 빼 바로 아래 별도 메뉴로.** Scripts 는 "읽을 원문"의 그룹인데
  만화는 원문이 아니라 **읽는 방식**이라, 그 안에 두면 Library·My Scripts 와 같은 층위로 오해된다.
  메뉴 안에 두 종류를 그대로 노출한다 — 사이드바에서 바로 고를 수 있다.
- URL 슬러그(`adapted`/`restored`)는 그대로 뒀다 — 화면 문구가 아니고, 참조가 67곳이라 지금 바꾸면
  진행 중인 다른 작업과 충돌한다. 이름 정합을 원하면 리다이렉트와 함께 별도로 처리할 일이다.
- `Sidebar` 의 React key 가 `flowStage` 였는데 Comics 가 `script` 를 공유하게 되어 중복 → `label` 로 교체.
- 스펙: 사이드바·탭 단언은 이미 href 기반이라 그대로 통과. 제목 단언 하나만 부분일치로 완화.


### 아케이드 v07.8 — 19종 전수 재설계 + 도서·스크립트·단어장 연계 (마이그레이션 1건)

**마이그레이션 [20260809120000_add_remaining_arcade_module_ids.sql](../supabase/migrations/20260809120000_add_remaining_arcade_module_ids.sql) — 2026-08-09 사용자 승인 후 dev 적용 완료.** enum 조회로 `pirate-quest` 확인.

#### 발단 — 재미 감사에서 제품 유효성 결함이 나왔다

19게임을 10축 루브릭으로 전수 감사(게임당 1에이전트 병렬). 평균이 **tensionCurve 1.42/5 · decisions 1.47 · streakHook 1.79 · learningIntegrity 1.95**.

가장 중요한 발견은 재미가 아니었다 — **게임 7종 이상이 영어를 한 글자도 몰라도 이길 수 있었고**, 그 결과가 FSRS 로 "학습했다"고 기록됐다. `pirate-quest` 는 정답 라벨이 **그 뜻을 그대로 조형한 GLB 위**에 붙어 있었고, `connections` 는 타일에 한글 뜻이 상시 노출돼 "한글 명사 분류"였으며, `morphmerge` 는 부분 선택 시 "(2/5)" 로 정답 개수를 알려줘 **무위험 브루트포스가 최적 전략**이었다.

#### DB 실측 — 큐레이션 계열 10종은 학습 기록이 구조적으로 불가능했다

`learning_records` 조회 결과 connections · glyph-tongue · letter-forge · lexicon-* · morpheme-rules · silent-rule · word-orrery · wordsmith-vigil · pirate-quest 가 **0건**. 원인은 enum 이 아니라 `recordGameResult` 가 **사용자 `vocabularies` 에 없는 단어를 silent skip** 하는 것 — 내장 뱅크로만 도는 게임은 아무리 플레이해도 FSRS·XP·점수가 남지 않는다. **wordPool 을 쓰는 것이 곧 학습 연계**라는 사실이 여기서 확정됐다.

#### 공유 킷 선행 확장 (게임별 구현보다 먼저)

감사 19건 중 13건이 독립적으로 같은 훅을 요청했다. 19개 에이전트가 각자 만들면 19개의 다른 구현이 남으므로 먼저 놓았다.
- `mechanics.tsx` 신설 — `useCountdown`(벽시계 · `extend`/`drain` 1급 · 가산 75% 상한으로 세션 길이 보호) · `useCombo`(티어·마일스톤·끊김) · `useFlipGrid`(보드 재배치 FLIP — 타일이 순간이동하던 문제) · `usePersonalBest`
- `gamekit` — **`FeedbackIcon`**(CLAUDE.md 가 요구하는 색+아이콘+모션 3중 피드백인데 **킷에 아이콘 축이 없어 19게임이 전부 2축만** 쓰고 있었다) · `TimerBar` · `LifePips`(채움/빔 이중 인코딩) · `Hud lives/comboMult` · `ParticleBurst colors` · `useSfx.nearMiss` · `GameDone best/badge/restartHint/reveal/footer`
- **결함 수정 ①** `GK_CSS` 에 `data-theme` 분기가 0줄 — 다크에서 게임이 하드코딩한 밝은 그라디언트 위에 밝은 텍스트(`--t1`)를 그렸다. 19게임 색 인자를 고치는 대신 색조는 유지하고 명도만 `--bg` 로 끌어내리는 규칙을 중앙에 추가.
- **결함 수정 ②** 리빌 시 `disabled` 를 걸어 키보드 포커스가 날아가던 문제 → `.gk-tile[aria-disabled]` 패턴.

#### 19종 재설계 (3웨이브 병렬 · 총 +22,000줄)

- **웨이브1(최하위 7종)** — pirate-quest 는 라벨↔모델 결합을 끊고 훑기(영단어만)→회수(뜻만) 2단 페이즈로 분리해 제출 순간 정답 단서를 0으로 만들었다. **마지막 한 자리는 묻지 않는다**(소거법 정답이 FSRS 를 오염시키는 경로 차단). glyph-tongue 은 등불 150초 단일 자원 + 묶음 봉인 배수 + 상시 미끼로 "마지막 룬 = 공짜" 제거.
- **웨이브2(중위 6종)** — connections 는 타일에서 영단어를 지우고 규칙을 **숨겨진 영단어의 형태**(끝 글자·접사·길이·품사)로 옮겨, 뜻→영단어 인출 없이는 규칙이 보이지 않게 했다. 절차 생성기에 불변식 3종(정답 분할 유일성)을 코드로 강제하고 1,200격자 × 3풀 실측 위반 0. daily-blitz 는 `page.tsx` 가 **`wordPool` 을 아예 안 넘기고 있었다**(FSRS 0건의 직접 원인).
- **웨이브3(나머지 6종)** — blitz 계열 4종이 완전히 같은 루프였던 문제에 대해 각 모드의 동기 장치를 극단으로 밀어 차별화. ghost-race 는 자기파괴적 래칫(이길수록 유령이 영구히 빨라져 12초 하한에 갇힘)을 티어 하한·연패 완화·상한을 가진 적응형 라이벌로 교체하고, 시간이 아니라 **거리**를 화폐로 쓰는 3랩 추격전이 됐다.

#### 도서 · 스크립트 · 공용 단어장 연계 — 끊긴 세 곳

배관(`?set=`/`?text=` → `useGameWordScope`)은 있었는데:
- **허브가 스코프를 버렸다** — 카드가 `gamePlayHref(slug,{from:'/arcade'})` 하드코딩이라 `?set=` 을 달고 와도 게임 진입 순간 증발. 이제 `searchParams` 를 읽어 19종 카드·오늘의 추천·계열 모드칩 전부에 싣고 `from` 도 스코프를 유지한다(게임에서 나가도 같은 자료로 이어감). 자료명 배너 + 해제 링크.
- **도서/공용단어장 모달이 4개 게임만** 제공 → `VocabSetPreviewModal` 에 "🕹 아케이드 19종" 칩. 이 모달을 도서 상세·단어장 목록·`/wordvault` 세 화면이 공유하므로 한 줄로 세 진입면이 열렸다. 이 칩들의 24px 터치 타겟도 44px 로 교정(CLAUDE.md 위반이었다).
- **스크립트 화면도 둘뿐** → `ModePills` 에 '아케이드' pill 정식 추가(`ModeKey` 확장).

카탈로그 정합 — 19종 전부 `source:'mine'` + 라우트 실값 `minWords`. `pirate-quest` 는 `ArcadeGameId`·`ModuleId`·`ScoreModule` 편입 + `GamePlayScaffold` 전환으로 **처음으로 FSRS·scores 가 남는다**(DB enum 이 `pirate_quest` 언더스코어라 하이픈 insert 가 조용히 실패하던 경로 — 사용 행 0건 확인 후 하이픈 추가).

#### ⚠️ 허브 분류축 교체 — `source` 축이 죽었다

전 게임이 학습자 단어를 쓰게 되면서 `mine`/`bank` 축이 한쪽으로 몰려 무의미해졌다. 그대로 두면 **"큐레이션 세계" 섹션이 빈 채로 남고**, 더 심각하게 `pickDailyGame` 이 `vocabCount < 6 ? BANK_GAMES : …` 로 갈리므로 후보 0개 → `from[NaN]` → `undefined` 로 **단어 6개 미만 학습자의 `/arcade` 가 통째로 크래시**한다.

새 축은 **학습 동사**(L계층 진행과 같은 순서): `빠르게 떠올리기(6)` · `직접 만들어 내기(6)` · `읽고 추론하기(7)`. `HUB_TRACKS` + `trackOf()` 로 카탈로그에 명시(문자열 파싱 금지 — 오분류가 조용히 생기지 않게). `pickDailyGame` 은 분기를 없애고 후보가 비면 전체 카탈로그로 되돌아가도록 방어.

#### 4라운드 자기발전 — 각 라운드가 앞 라운드가 못 본 것을 잡았다

| 라운드 | 방식 | 잡은 것 |
|---|---|---|
| 1R 감사 | 루브릭 10축 정적 | 인출 누수 7종+ · 평탄한 난이도 (23.1/50) |
| 2R **반증** | 적대적 + 시뮬 | **익스플로잇 42건** · 불성립 주장 27건 (34.8/50) |
| 3R 강화 | 수정 후 재시뮬 | 지분 자산비 2.25~2.95 → 0.62~1.28 등 |
| 전수 검증 | 런타임 e2e | **정적 분석이 놓친 React 형제 key 충돌 2건** |

마지막 항목이 방법론적으로 중요하다. `word-economy`(`<h1 key={q.key}>` + `<QuoteGauge
key={q.key}>`)와 `word-customs`(`stamp.n`·`burst.n`·`gain.n` 동시 증가)가 **정확히 같은
실수** — 형제 요소가 각자 카운터로 key 를 써서 값이 겹치면 React 가 조용히 한쪽을 버린다.
반증 감사(정적)도 3R 강화도 못 잡았고 **콘솔 단언이 있는 e2e 만** 잡았다. 그것도 경고가
`%s` 로 잘려 나와 `msg.args()` 를 풀어 실제 키(2·3·4·5 = 연속 문항 번호)를 보고서야 특정됐다.

#### 테스트 실패 8건을 전부 갈랐다 — 통과율을 위해 단언을 무르게 만든 곳은 없다

| 판정 | 건수 | 처리 |
|---|---|---|
| **게임 버그** | 2 | 형제 key 충돌 → 게임 수정 |
| **테스트가 틀림** | 5 | 옛 셀렉터(`매칭 보드`→`단어 보드`) · strict mode(라우트 어나운서·h1 2개) · 의도된 IME 오버레이 · 영구 스킵 → 테스트 수정 |
| **탐지 한계** | 1 | A3 다단계 진입 5종 → 경계 명시 후 07 에 위임 |

⚠️ `13-A3` 커버리지는 **14/19** 다. 콘텐츠가 다단계 상호작용 뒤에야 나오는 5종은 제외했고,
근거는 **3회 실행에서 실패 집합이 매번 회전한 것**이다(결함이면 고정된다). 그 5종은 07 이
게임별 실조작 계약으로 검증한다. 절차를 양쪽에 구현하면 계약이 갈라져 둘 다 낡는다.

⚠️ `09-B3` 는 검증 계정이 **뜻 있는 단어 225개**(DB 실측)라 degrade 경로가 발생하지 않아
영구 스킵이었다 → 검증 가능한 반대 사실로 교체: **단어가 충분하면 비스코프 진입에서
19종 어느 것도 맛보기로 떨어지지 않는다**(통과).

#### 검증

- **신규 spec [13-arcade-integrity.spec.ts](../apps/web/tests/e2e/13-arcade-integrity.spec.ts)** — 기존 07 은 "마운트 + 첫 입력 + 콘솔에러 0"만 봐서 **게임이 wordPool 을 통째로 무시해도 초록불**이었다. 이제 ⓐ **19종 전부가 `?set=` 자료를 실제로 싣는지**(세션 셸 `aria-label` 로 판정 · **맛보기 degrade 를 실패로 잡는다**) ⓑ 허브가 모든 카드에 스코프를 전달하는지 ⓒ 스크립트 화면 진입문. **A·B·C 전부 pass**(A2 는 storage-state 경합 flake, 재시도 통과).
- 유닛 [catalog.test.ts](../apps/web/src/lib/game/__tests__/catalog.test.ts) 40/40 — 트랙 분류 전수 커버·빈 트랙 금지·`pickDailyGame` 크래시 회귀 추가.
- `tsc --noEmit` 클린.
- ⚠️ 09-arcade-access B3 재작성 — 'bank 게임 = 큐레이션 세계' 단언이 죽었다. 새 계약은 **"조용히 degrade 하지 않는다"**(맛보기는 FSRS 에 안 남으므로 기록되는 플레이로 오인하면 진도를 착각한다).
- ⚠️ 테스트 함정: 사이드바에도 "아케이드" 링크가 있어 `getByRole('link', {name:/아케이드/})` 는 ModePills 안으로 한정해야 한다.

### 🔒 public 스키마 노출 정리 — anon 키로 사전을 고칠 수 있던 상태 (마이그레이션 `harden_public_reference_tables_and_drop_scratch`)

MCP 로 권한을 직접 조회하다 발견. **advisor 가 WARN 으로 조용히 세던 것의 실체가 이거였다.**

8개 테이블이 RLS 없이 anon 에게 `INSERT·UPDATE·DELETE·TRUNCATE` 까지 열려 있었다.
anon 키는 브라우저에 실려 나가므로, 누구나:

- `lexicon_clean` **455,037행을 UPDATE** — 학습자 단어 뜻 조회가 전부 이 테이블을 거친다
- `extraction_test_vocab` **2,045,936행 · 1.4GB 평가 코퍼스를 TRUNCATE**

실측으로 확인했다(anon 롤로 조회 성공 + `has_table_privilege` = true).

#### 조치가 테이블마다 다른 이유

이 테이블들을 읽는 함수(`lookup_word_meaning` 등 7종)가 **전부 SECURITY INVOKER** 다.
정책 없이 RLS 만 켜면 호출자 권한으로 읽으므로 **학습자 단어 조회가 통째로 죽는다.**

| 대상 | 조치 |
|---|---|
| `lexicon_clean` · `spelling_norm` · `dialect_map` · `csat_stage_gates` | 쓰기 권한 회수 + RLS + **읽기 정책** (조회 유지) |
| `extraction_test_books` · `extraction_test_vocab` | 전 권한 회수 + RLS **정책 없음** (서비스롤 스크립트만 사용 — 실측 확인) |
| `csat_stage_catalog` (뷰) | `security_invoker = true` — 기존 `views_security_invoker` 에서 누락됐던 한 건 |
| `_seed_lem`(54,230행) · `_resid_ctx`(4,212행) | **DROP** — 코드·함수·뷰 참조 0건. 삭제 전 `work/db-backup/` 에 전량 백업 |

**검증**: anon 이 `lexicon_clean` 455,037행을 여전히 읽고, `lookup_word_meaning` 이 정상 해소
(`coverage-clean` tier). UPDATE·TRUNCATE·평가 코퍼스 SELECT 는 전부 차단.
**Supabase advisor ERROR 9건 → 0건.**

#### 자기발전 정답 표본을 저장소로

`truth.json`(사람이 페이지를 열어 센 컷 수)이 `work/` 안에만 있었다 — gitignore 대상이라
작업 폴더를 지우면 이 하네스에서 **제일 비싼 산출물**이 통째로 날아가고 스윕을 재현할 수 없다.
`scripts/comic/pd/samples/` 로 옮기고 `tune.mjs` 가 작업 폴더 → 저장소 순으로 찾게 했다.
이미지는 남기지 않고 재구성 방법만 적어둔다(README).


### PDCP 스키마 정합 — MCP 로 DB 를 직접 점검해 결함 3건 (마이그레이션 `pdcp_adapter_browser_assist_and_term_expired_basis`)

Supabase MCP 가 붙어 DB 를 직접 볼 수 있게 되자, 코드만 봐서는 안 보이던 것들이 나왔다.

- **큐 마이그레이션에 로컬 파일이 없었다.** `pdcp_queue_states_and_monitoring` 을 MCP 로만 적용하고
  `supabase/migrations/` 에 남기지 않아, 새 환경에서는 `queued`·`last_error`·`attempts`·`acquire_pages`
  없이 테이블이 만들어졌다 — 콘솔과 드레인이 통째로 깨지는 상태. 적용된 DDL 을 DB 에서 역으로 읽어
  파일로 기록했다.
- **파일명 버전이 DB 기록과 달랐다.** `20260809020000_pdcp_...` 인데 DB 는 `20260808161400` —
  `db push` 가 같은 변경을 다시 적용하려 든다. DB 기록에 맞춰 rename.
- **`browser-assist` 가 어댑터 CHECK 에 없었다.** 브라우저 보조로 사람이 직접 받은 호를 큐에 넣으면
  제약 위반으로 거부된다 — 어댑터는 이미 코드에 등록돼 동작하는데 적재 경로만 막혀 있었다.
- **PD 근거 토큰이 코드와 갈렸다.** 검색 랭킹은 `PD_YEAR_CUTOFF`(1930)를 쓰는데 `usPdHint` 만 1929 가
  하드코딩돼, 1930년 발행물이 목록에선 "PD 확정"인데 적재하면 "미확정"이 됐다.
  토큰을 연도 비종속 `term-expired` 로 바꾸고 상한을 한 곳(`PD_YEAR_CUTOFF`)에서만 읽게 했다 —
  `pre-1929` 같은 토큰은 매년 1월 1일에 거짓이 된다. 회귀 스펙 5건으로 고정(총 66건).

검증: `browser-assist` + `term-expired` 로 실제 INSERT 성공(롤백). anon 세션으로 미발행 호 0건 노출 확인.

#### 그 밖에 확인한 것

- 대기 중이던 `get_comic_format` 마이그레이션은 **이미 적용돼 정상 동작**(발행 만화에서 `comic-page` 반환,
  authenticated·anon EXECUTE 권한 정상). 대기 메모 삭제.
- DB 통계 갱신: **81 테이블 · 6 view · 310 함수 · 377 migrations** (문서상 59/5/227/58 로 낡아 있었다).
- `DB_SCHEMA.md` 에 PDCP 섹션 추가 — 상태 전이·발행 게이트·근거 토큰·RLS 이중 게이트.
- Supabase advisor: ERROR 9건은 전부 기존 것(VCB/LCP 작업 테이블 8개 RLS 미적용 +
  `csat_stage_catalog` SECURITY DEFINER 뷰). PDCP 관련 경고는 설계대로 —
  발행 게이트 SECURITY DEFINER RPC 와 published-only 읽기 정책.


### PDCP 자기발전 — 손으로 고른 파라미터를 측정으로 갈아치웠다 (마이그레이션 없음)

`scripts/comic/pd/tune.mjs` 신설. CCP 의 gen-verified 폐루프에 대응하는 PDCP 쪽 장치로,
**산출물을 채점하고 더 나은 파라미터를 찾아 래칫한다.**

채점은 프록시가 아니라 **사람이 박은 정답**으로 한다 — 컷 개수·커버리지만 최적화하면
과분할이 이긴다(실제로 첫 규칙이 정답 7컷 페이지에서 9컷을 골랐다). 표본 페이지를 눈으로 세어
`truth.json` 에 적고, 정답과의 오차를 1순위 지표로 쓴다.

#### 컷 분할 — 고정 dilate 폐기, 페이지 단위 적응형 채택

스윕에서 드러난 것: **표본마다 최적 고정값이 정반대였다.**

| 조합 | All Top Comics #6 | Classics Illustrated #27 | 평균 |
|---|---|---|---|
| **적응형(채택)** | **-0.667** | **-1.122** | **-0.894** |
| a2000/d2 (차선 고정값) | -0.667 | -2.226 | -1.446 |
| a800/d0 (표본1 1위) | -0.333 | -4.417 | -2.375 |
| a1500/d3 (표본2 1위) | -4.088 | -0.239 | -2.163 |
| **a1100/d2 (직전 운영값)** | **-4.200** | -1.122 | **-2.661** |

- 직전 운영값은 17개 조합 중 **거의 최하위**였다. 근거가 "480px 에서 안 쪼개져서 올렸다"뿐이었고,
  그 한 장 말고는 아무도 검증하지 않았다.
- 적응형 선택 기준은 **박스 겹침(커버리지 > 1)이 풀리는 첫 지점**이다. 커버리지가 1을 넘는다는 건
  바운딩 박스가 서로 겹친다 = 컷이 아직 병합돼 있다는 뜻이다. 겹침이 풀리는 순간이 구조가 드러난 지점.
  이미 겹치지 않는 페이지는 더 팽창시키면 컷을 갉는다(0.86 → 0.22 실측).
- 결과: Classics Illustrated 에서 운영값과 **동점**, All Top Comics 에서 **6.3배 개선**.

#### 대사 추출 — psm 3 → 4

| 설정 | All Top | Classics Illustrated |
|---|---|---|
| psm3/conf55 (직전) | 30.97 (그대로쓸수있음 32) | 6.84 (8) |
| **psm4/conf55 (채택)** | **32.84 (34)** | **7.95 (9)** |
| psm6·psm11 | 대사를 3~5배 뱉지만 95%가 검수 대상 + 비라틴 오염 | 동일 |

psm 4 = "가변 크기 텍스트 한 열" — 말풍선은 세로로 쌓인 짧은 줄이라 여기에 맞는다.
**두 표본 모두에서 1위**라 채택했다(한 표본 1위는 그 표본에만 맞춘 값일 수 있다).

#### 래칫 자체의 결함도 하나 잡았다

처음엔 표본을 구분하지 않고 한 계열에 이어붙여, All Top 의 -0.333 과 Classics Illustrated 의 -0.239 를
비교해 "개선"이라고 기록했다. **서로 다른 페이지를 채점한 수는 비교 대상이 아니다.**
이제 `kind:sample` 로 계열을 나누고, 채택 판단은 교차 평균으로 한다.

#### 남은 한계 (정직하게)

- 정답 표본이 4페이지(2소스)뿐이다. 늘릴수록 판단이 단단해진다.
- All Top 0008 은 어떤 파라미터로도 8컷 중 6컷까지만 나온다 — 맞닿은 컷은 이 알고리즘의 한계.
- **만화 지면 vs 광고·표지 분류 단계가 없다.** 광고 지면을 분할 채점에 섞었더니 스윕 1위가
  광고 한 장에 끌려갔다(그래서 정답 표본에서 뺐다). 지금은 검수에서 사람이 걸러낸다.

### 전수테스트 (2026-08-09)

- 단위 **225 통과**(4 파일 skip) · PDCP 파이프라인 **61 통과** · 프로덕션 빌드 **성공**(124 페이지)
- e2e 87건 중 **72 통과 · 9 실패 · 6 skip**. 실패 9건은 전부 **기존 결함** —
  이번 세션이 건드린 공유 파일은 `lib/supabase/admin.ts` 하나뿐이고, 그것을 세션 이전 상태로
  되돌려 재실행해도 **동일하게(오히려 더 많이) 실패**했다.
  · 03-admin-curation · 10-judge-harness — 런타임 계정이 `role=user` 라 `/admin` 에서 `/hub` 로 리다이렉트.
    **앱이 옳고 스펙이 틀렸다**(신규 13-pdcp 스펙은 같은 상황을 "학습자 차단"으로 올바로 단언한다).
  · 01·02·05·06·08 — 셀렉터/시드 데이터 문제 (element not found)
  · 12-arcade-audio — 30s 타임아웃. 19곡 MP3 헤더 검사라 단독 실행에서도 재현.
- **고친 것**: `@vocaflow/library-pipeline` 타입체크 5건(`noUncheckedIndexedAccess` 가드 누락, 2026-07-26 이후 방치).
  이것 때문에 `pnpm turbo run typecheck` 가 저장소 전체에서 실패하고 있었다. 이제 6/6 통과.


### PDCP 소스 GET 정교화 + 브라우저 보조 취득 (마이그레이션 없음)

**딥서치 결론 — 소스를 늘리는 것보다 있는 소스를 제대로 쓰는 게 이득이었다.**
후보를 전부 실측(2026-08-09)한 결과, 골든에이지 만화 전권 스캔을 자동 취득할 수 있는 곳은
사실상 Internet Archive 하나다.

| 소스 | 실측 결과 | 처리 |
|---|---|---|
| Internet Archive | 검색 API·hOCR 개방 | **자동** (정교화 대상) |
| Comic Book Plus | robots.txt 가 `ClaudeBot`·`anthropic-ai` 를 전면 Disallow + 목록/벌크 엔드포인트 전부 Disallow | 브라우저 보조 |
| Digital Comic Museum | 일반 클라이언트 403 · 무료 계정 필요 | 브라우저 보조 |
| Library of Congress | Cloudflare 챌린지("Just a moment…") | 브라우저 보조 |
| HathiTrust | 다운로드 403 | 브라우저 보조 |
| DPLA · Smithsonian · Europeana | API 키 필요 + **만화 페이지 스캔은 사실상 없음**(아카이브로 되돌아감) | 미채택 |
| Wikimedia Commons | 개방 API 지만 표지·낱장 위주, 전권 시퀀스 아님 | 미채택 |

명시적으로 자동 수집을 거부한 사이트에는 스크래퍼를 붙이지 않았다.

#### IA 발견 정교화 (`sources/discovery.mjs` 신설)

- **저작권 살아 있는 자료가 검색 상위에 올라오던 문제**를 고쳤다. 초기 질의는 `q AND mediatype:texts` 한 줄이라 "classics illustrated" 에 Strega Nona(2017)·Great Illustrated Classics(1990) 가 상위였다.
- `collection:comics` 로 좁히는 건 **더 나쁘다** — 실측 116,891건 상위가 Batman 1940·Spawn·Daredevil, 즉 사용자 업로드 침해물이다. **컬렉션이 곧 PD 보증은 아니다.**
- 대신 ① 제목 우선 질의 ② 컬렉션·연도·최소페이지 필터 + 정렬 + 페이지네이션 ③ **PD 위험도 3등급 판정 후 재정렬**(같은 등급 안에서는 큐레이션 컬렉션 우선) ④ 프리셋 출발점 3종(Fawcett 813건 · Classics Illustrated · PD 확정 구간).
- **제목에서 연도 추출** — IA `year`/`date` 필드는 만화 컬렉션에서 자주 빈다(fawcett 상위 6건 중 5건). "Whiz Comics 002 (1940-02)" → 1940. 호수(002·51)를 연도로 오해하지 않는다.
- PD 확정 상한을 **1929 → 1930** 으로 갱신(2026-01-01 부로 1930년 발행물 PD). `PD_YEAR_CUTOFF` 한 곳만 고치면 힌트·위험도·프리셋이 함께 따라온다.

#### 브라우저 보조 취득 (`sources/browser-assist.mjs` · `assist.mjs` · `/api/pdcp/assist`)

- 진짜 크롬 창을 띄우고 **사람이 로그인·선택·다운로드**하면, 도구가 받은 파일을 포착해 CBZ/ZIP 을 풀고 `pages/` 로 정렬·정규화한 뒤 매니페스트를 쓴다. 자동 클릭·자동 순회는 하지 않는다(그건 스크래퍼다).
- 로그인 세션은 영속 프로필에 남아 다음 회차에 재사용된다.
- ZIP 리더를 직접 구현했다 — 이 환경에 unzip 이 없고 Node 에 zip 리더가 없다. 실물 CBZ(IA, 37엔트리 · store+deflate 혼재)로 검증: **36장 추출 → 복원 단계 통과**.
- CBR(RAR)·PDF 는 해제하지 못한다는 사실을 메모로 남긴다 — 조용히 0장이 되면 성공처럼 보인다.

#### 그 밖에

- **vitest 종료 코드 134** — 테스트 파일이 4개가 되자 전부 통과한 뒤 SIGABRT 로 죽었다(Node 24.15 · 워커 스레드 풀). 결과는 초록인데 CI 는 빨간불이 되는 유형이라 `scripts/comic/pd/vitest.config.mjs` 로 `pool: forks` 고정.
- 회귀 스펙 +33: `discovery.test.mjs`(21) · `assist.test.mjs`(8, 합성 ZIP 으로 store/deflate·정렬·손상파일 격리 검증) · e2e +4(프리셋·위험도 배지·보조 패널 정책 표기·작업명 검증).


### PDCP 운영 콘솔 — 파이프라인을 화면에서 돌린다 (마이그레이션 `pdcp_queue_states_and_monitoring`)

- `/admin/pd-comics` 가 **읽기 전용 목록에서 조작면으로**. 3탭 — 소스·대량 적재 / 큐·드레인 / 도구.
  - 어댑터 능력표는 `scripts/comic/pd/sources` 를 **동적 import** 해서 그린다. 앱에 베껴두면 즉시 drift 한다(아케이드 카탈로그가 4곳에 복제돼 전부 낡았던 실패의 재발 방지).
  - **테스트 모드** — 전권 대신 앞 N장만 취득해 파라미터를 먼저 확인. 52p 한 호를 매번 받아보며 튜닝할 수는 없다.
  - **드레인** — 호출 1회 = 호 1개의 다음 단계 1개. UI 가 반복 호출하며 라이브 로그를 쌓는다. dry-run 으로 실행할 CLI 명령을 먼저 보여준다. prod 403(앱이 ffmpeg 을 돌리는 건 로컬 한정).
- 신규 API 8종 `/api/pdcp/*` (sources·search·enqueue·drain·retry·queue·doctor·issue) — 전부 admin 게이트.
- **실측 end-to-end**: Classics Illustrated #27 을 테스트 모드(4p)로 적재 → queued→acquired→restored→segmented→ocr→review 전 구간을 콘솔에서 완주. 컷 8개 · 대사 20개(그대로 쓸 수 있음 50%).

#### 이번에 드러나 고친 결함 4건

- **실패가 단계를 지웠다** — 드레인이 실패 시 `status='failed'` 로 덮어써 *어느 단계에서 멈췄는지*가 사라졌고, 그 호는 큐에서 영구 이탈했다(복원 단계 ffmpeg 부재로 실측). 이제 status 는 보존하고 `last_error` 로만 표시 → 원인을 고친 뒤 **멈춘 지점부터** 재개. 자동 선택은 `last_error` 있는 행을 건너뛴다(같은 실패 무한 반복 방지).
- **admin 화면이 낡은 스냅샷을 보여줬다** — Next 14 가 전역 fetch 를 패치해 서버 측 GET 을 기본 캐시하는데 supabase-js 조회가 거기 걸렸다(DB 는 review·8컷인데 API 는 직전 failed 를 반환). `createAdminClient` 에 `cache:'no-store'` 를 못 박음 — **PDCP 뿐 아니라 서비스롤을 쓰는 admin 화면 전체에 해당하던 문제**.
- **server-only 가 클라이언트 번들로 새어 빌드가 통째로 깨졌다** — 운영 콘솔(클라이언트)이 `queries.ts` 에서 타입·상수를 가져오는 순간 `/api/pdcp/*` 전부 500. 순수 타입/상수를 `lib/pd-comic/model.ts` 로 분리.
- **`stageIndex` 가 미지 상태를 0(대기)으로 뭉갰다** — 실패·보관이 정상 대기처럼 보였다. -1 을 돌려주고 stepper 는 별도 표기.

- ffmpeg/tesseract 를 `tools/`(gitignore)에서도 찾도록 폴백 추가 — Windows 는 ffmpeg 기본 설치가 없어 PATH 만 보면 복원 단계가 통째로 실패한다.
- 회귀 스펙: `lib/pd-comic/__tests__/model.test.ts`(7) — 단계 목록이 드레인 전이표와 어긋나면 실패. `tests/e2e/13-pdcp-console.spec.ts`(5) — 8라우트 admin 게이트 + 조작면 렌더. `DEV_ADMIN_BYPASS` 활성 시 게이트 검증은 성립하지 않으므로 스펙이 이를 탐지해 skip 한다(빨간 스펙으로 학습되면 진짜 구멍을 놓친다).


### 아케이드 BGM v07.7 — 측정으로 선곡 + 마디 정렬 루프 (마이그레이션 없음)

사용자 피드백: "웅장하면서 긴장감과 긴박감이 있어야 함. 빠른 템포도 필요하고."

- **왜 v07.6 이 못 맞췄는지가 측정으로 드러났다** — 후보 118곡(Scott Buckley 72 + Alexander Nakarada 46)을 재보니 Buckley 라이브러리 대부분이 `pulse`(온셋 자기상관 피크 선명도) ≈ 1.0, 즉 **박이 노이즈와 구별되지 않는 앰비언트**였다. 제목이 장엄해도 몰아치지 않는 실체가 이것이다. 측정 축 6개: `bpm` · `onset/s`(긴박) · `pulse`(추진) · `low%`(150Hz 이하 타격) · `full%`(웅장) · `tension`(2~6kHz 변동).
- **BGM 19곡 재선곡** — `Alexander Nakarada`(creatorchords.com · CC-BY 4.0)가 전 축에서 앞서 16슬롯, Scott Buckley 3슬롯 유지(`morpheme-rules` Simulacra · `lexicon-detective` Honour Among Thieves · `word-orrery` Electric Dreams). **전 곡 129~161 BPM**, 19종 고유 트랙. 33.3 MB. 예: wordblitz *Riders of Ragnarok*(161) · ghost-race *Through the White Steppes*(161) · wordfall-cadence *Into Battle*(pulse 3.74 — 케이던스 게임에 가장 또렷한 박) · wordsmith-vigil *Daudir*(저역 타격 39% — 전 곡 최고) · glyph-tongue *Fantasy Soundscape*(pulse 5.65 · 긴장 1.33).
- **루프를 마디 정수배로 자른다** — `loopLen = bars × 4 × 60/bpm`, 크로스페이드도 1마디. 꼬리(start+loopLen)와 머리(start)의 **박 위상이 같아져** 크로스페이드가 박 위에 정확히 얹힌다. 임의 길이로 자르면 겹박(플램)이 나 추진력이 뭉개진다. 길이 109.5~110.6초(59~74마디).
- ⚠️ **크로스페이드가 조용히 사라지는 두 번째 경로 발견** — `-t X` 로 뜬 조각이 MP3 프레임 경계 때문에 X 보다 아주 살짝 짧으면 `acrossfade=d=X` 가 성립하지 않아 통째로 빠진다(19곡 중 다수가 딱 1마디 짧게 구워졌다). `X+0.4`초를 떠서 필터 안에서 `atrim` 으로 정확히 자르는 것으로 해결. 빌드 스크립트에 `출력 길이 == loopLen` 단언 추가.
- 표기 갱신 — `CREDITS.txt` 전면 재작성(선곡 근거 수치 + 곡별 BPM·마디 수 포함) · `/arcade` 푸터에 두 아티스트 + CREDITS 링크.
- **검증** — 12-arcade-audio 3/3(루프 길이 단언을 마디 정수배 범위 108.8~111.4초로 갱신) · 스피커 실재생 오디션 19곡 + 루프 이음매 2곡(경과 282초, 실패 0) · `tsc` 클린.

### 아케이드 오디오 v07.6 — 실제 시네마틱 음원 + 실녹음 효과음 (마이그레이션 없음)

- **BGM 19곡 전면 교체 — Kevin MacLeod(CC-BY 3.0) → Scott Buckley(CC-BY 4.0)**. 직전 세트는 8비트 칩튠을 걷어낸 결과물이었지만 여전히 샘플 라이브러리 오케스트라라 "웅장"과 거리가 있었다. 교체본은 라이브 감각의 시네마틱 스코어(`word-orrery` = *Adrift Among Infinite Stars*, `wordblitz` = *Escape Velocity*, `pirate-quest` = *The Great Sea* …). 게임 19종 × 서로 다른 19곡, 중복 없음.
- **루프가 심리스가 됐다** — 이전 빌드는 3초 페이드인 / 5초 페이드아웃이라 **110초마다 8초짜리 무음 구멍**이 생겼다. 지금은 꼬리 6초를 머리 6초에 크로스페이드해 잇는다: `concat( acrossfade(tail, head), body )`. 두 이음매(body→tail, head→body)가 모두 원곡 그대로의 연결이라 구멍도 클릭도 없다.
- ⚠️ **빌드 함정(회귀 spec 으로 고정)**: 한 입력을 `asplit=3` 으로 쪼개 `atrim` 셋을 물리면 `acrossfade` 가 빈 스트림을 받아 **크로스페이드 구간이 통째로 사라진다**(결과가 110초가 아니라 body 만 104초). head/tail/body 를 각각 별도 `-i` 로 열어야 한다. 파일은 멀쩡히 200 을 주므로 육안으로는 안 잡힌다.
- 구간 선정은 자동 — 인트로(앞 15%)·아웃트로(뒤 8%)를 뺀 뒤 초당 RMS 포락선에서 `평균 − 0.6×표준편차`가 최대인 116초 창(= 웅장하되 흔들리지 않는 구간). 전 곡 -16 LUFS / TP -1.5 dBTP 통일, VBR MP3(-q:a 5), 총 31.7 MB.
- **효과음 6종 교체 — Kenney "Interface Sounds"(CC0) → Mixkit 실녹음**. FFT 실측으로 기존 세트는 **6종 전부 모노 · 8 kHz 이상 에너지 0~0.6% · `correct`/`complete` 는 스펙트럴 평탄도 0.0000** — 대역제한 합성음이었다("그냥 컴퓨터 소리"라는 지적이 수치로도 맞았다). 교체본은 전부 스테레오 실녹음이고 비조화 부분음·자연 감쇠·고역 공기감을 갖는다: `correct`=실제 벨 0.65s / `wrong`=나무 타격 0.30s / `combo`=반짝임 0.95s / `click`=타자기 타건 0.15s / `coin`=실제 동전 0.45s / `complete`=금관 합주 2.8s. 총 494 KB. `wrong` 을 버저가 아닌 나무 타격으로 둔 건 Empathetic Feedback(오답에 비난조 금지).
- 코드 변경 없음 — `SFX_SRC` 확장자 매핑(`complete` 만 `.ogg`)을 그대로 유지. `useSfx` 의 호출별 게인 위계도 그대로(피크 목표가 완주 > 정답 > 코인·콤보 > 오답 > 클릭 순으로 이미 설계됨).
- 표기 갱신 — `public/audio/games/CREDITS.txt` 전면 재작성 · `/arcade` 푸터 "Scott Buckley · CC-BY 4.0 · 효과음: Mixkit".
- **배경음악 기본값 OFF → ON** (사용자 결정 2026-08-09: "단어 게임은 음악이 중요함"). 기존 OFF 의 근거는 Calm UI 였지만 실측 결과가 Calm 이 아니라 **무음**이었다 — 토글 전에는 트랙을 내려받지도 않아, 시네마틱 BGM 19곡을 붙여놓고도 처음 들어온 학습자는 한 곡도 듣지 못했다. `DEFAULT_MUSIC_ON` + `readMusicOn()` 신설: `readMusicPref()` 는 미설정을 `null` 로 유지하고 실제 판단만 기본값으로 폴백해, **명시적으로 OFF 를 고른 학습자를 기본값 변경이 덮어쓰지 않는다**. `useGameMusic` 은 초기값을 상수로 잡아(하이드레이션 불일치·아이콘 깜빡임 제거) `ready` 게이트 전에는 절대 소리를 내지 않는다.
- 자동재생 차단 대응에 **`keydown` 추가** — 기존엔 `pointerdown` 만 듣고 있어, 포인터를 안 쓰는 타이핑 게임(wordsmith-vigil·letter-forge 등)은 기본 ON 이어도 영영 무음이 될 참이었다.
- **신규 spec [12-arcade-audio.spec.ts](../apps/web/tests/e2e/12-arcade-audio.spec.ts) 3/3 pass** — ① BGM 19곡을 브라우저에서 실제 디코드해 110초·스테레오 단언(104초 회귀 차단) ② 효과음 6종 길이·스테레오 단언(모노 합성음 회귀 차단) ③ 선호 미설정 학습자가 **토글 없이 게임 진입만으로** 트랙을 받는지 + 명시적 OFF 가 리로드 후에도 유지되는지. 기존 [09-arcade-access.spec.ts](../apps/web/tests/e2e/09-arcade-access.spec.ts) F1 은 기본 ON 기준으로 재작성(허브 토글 → 게임 적용을 끄기/켜기 양방향으로 고정) — F1·F2 2/2 pass.

### 품질 루프 4회차 — **학습자 전 화면 접근성 위반 0 달성**, 게이트 11화면으로 확대 (2026-08-09)

3회차 잔여 21건을 끝까지 좁혀 학습자 화면 전체가 라이트·다크 모두 **위반 0**. 게이트가 이제 11개 화면 + 만화 4면 + 도서 목록을 지킨다.

- **채움 위 글자 규칙 완성** — `--on-semantic`(semantic 채움 버튼 · 테마별 반전) 추가. `PrimaryButton` 의 iOS 원색 채움(red 3.55 · orange 2.20 · green 2.22)을 Reading Room semantic 팔레트로 교체하고, 앰버처럼 밝은 면에는 잉크 글자(#231a09, 5.0:1)를 얹었다.
- **다크 `--error` 를 채움 기준으로 조정** `#C25E54 → #A8443A` — 흰 글자 4.18 · 잉크 3.99 로 **어느 쪽 글자도 AA 를 못 넘기던** 값이었다. 글자용 밝은 빨강은 `--error-ink` 가 따로 담당하므로 채움만 깊게.
- **ACP 트랙 액센트를 테마 토큰으로** — `--track-*` 7종(라이트=진한 원색 / 다크=밝은 톤). 같은 색을 5% wash 배경 위 글자로 쓰는 구조라 다크에서 2.85~3.18 이었다.
- **공용 컴포넌트 3건** — `StatPill` 값 색(iOS 원색 1.76~1.78 → ink) · `Capsule` brand 톤(`--p-dark` 는 다크에서 오히려 더 어둡다 → `--on-p-tint`) · `HubStartCard` 에 `accentText` 도입(모듈 accent 채움 위 글자 지정).
- **`judgeArticleIPlusOne` 누락 보정** — 책 버전만 잉크로 바꾸고 글(article) 버전을 빠뜨려 `/library/scripts` 배지가 계속 미달이었다. 두 판정이 같은 규칙을 쓰도록 정렬.
- **자기 계열 tint 안티패턴** — 글자색의 14% 를 배경으로 깔면 같은 계열이라 4.5 를 넘기 어렵다(실측 4.49). 중립 면(`--bg2`) 위에 잉크를 얹는 방식으로 교체.
- 검증: 14-learner-quality 5/5(11화면 + 만화 4면 + 도서목록 · 라이트/다크) · 11/12/13 16/16 · 04-ui-smoke 5/5 · unit 229 · tsc 클린.

### 품질 루프 3회차 — 잉크 토큰 체계 완성, hub·dashboard·dictate·arcade 도 게이트 편입 (2026-08-09)

2회차의 잔여(47건)를 계속 좁히며, "면 vs 잉크" 규칙을 **semantic·brand tint 까지** 확장해 체계를 닫았다.

- **잉크 토큰 3계열 추가** — `--on-p-tint`(브랜드 tint 칩 · 테마별 반전) · `--success/error/warning/info-ink` · (2회차의) `--memory-*-ink`. 실측 미달치: success 4.21 · warning 2.82 · info 3.63 · 다크 tint 위 success 4.27.
- **`--memory-stable-ink` 재조정** `#2E7D5A → #1F6B49` — 종이(4.79)는 통과했지만 `--bg3`(4.03)에서 미달이었다. 잉크는 **가장 어두운 종이 톤 기준**으로 잡아야 한다는 걸 이번에 확인.
- **무효 CSS 2건 추가 제거** — `TodayQueue` 의 `` `${meta.color}0D` `` (var() + 알파 hex)로 카드 배경·테두리가 실제로는 **투명**이었다. `color-mix()` 로 교체(ScriptQuiz 와 같은 유형, 세 번째 발견).
- **공용 컴포넌트 교정** — `TodayQueue`(hub·flashcard·spellforge 3화면 공용) 색 구조를 `color/ink/tint/edge` 로 분리 · 분포 막대의 `aria-prohibited-attr` 제거 · `VocabSetCarousel` 활성 탭 accent 3종을 흰 글자 AA 기준으로 심화(csat 3.19→5.38 등) · `RecommendedSetsSection` 배지 팔레트 · `PlanClient` 의 `opacity-70` 이중 감광 제거.
- **게이트 확장** — `14-learner-quality` 에 **hub·dashboard·dictate·arcade** 추가(라이트/다크 0 유지). 나머지 화면(wordvault·flashcard·scriptquiz·plan·settings·library/*)은 잔여가 남아 아직 넣지 않았다 — **0 이 되는 대로 배열에 한 줄씩 추가**하는 것이 이 루프의 진행 방식이고, 스펙 주석에 그렇게 적어두었다.
- 검증: 14-learner-quality 5/5 · 11/12/13 포함 21/21 · 04-ui-smoke 5/5 · unit 229 · tsc 클린.

### 품질 루프 2회차 — 학습자 전 화면으로 확대, 접근성 위반 719 → 20 (2026-08-09)

1회차(만화·도서)를 앱 전역 학습자 화면 11곳(hub·dashboard·wordvault·flashcard·scriptquiz·dictate·arcade·library/scripts·library/vocab·plan·settings)으로 넓혀 같은 루프를 돌렸다.

- **`--t3` 텍스트 금지 규칙을 전면 적용(코드모드)**: 학습자 표면 246파일 · 1,221곳의 `text-[var(--t3)]` → `--t2`. 어드민·게임·아케이드(`(app)`)는 자체 팔레트라 **의도적으로 제외**(admin 34곳 잔존 확인). `--t4` 를 글자로 쓰던 곳도 동일 처리.
- **`--memory-*-ink` 4종 추가**: Memory Decay 색을 작은 글자로 쓰면 shaky 3.29 · new 3.63 으로 미달이었다. 면·점·막대는 원색 유지, 글자만 잉크(다크는 반대로 밝은 값).
- **`--active-ink` 재조정 `#8A6420` → `#7E5A1B`**: 종이 위에선 통과했지만 앰버 tint(`--warning-light`) 위에서 4.40 으로 아슬하게 미달이었다. 종이 5.97 · 앰버 tint 5.13 으로 재조정.
- **ScriptQuiz 챕터 칩** — `` `${QUIZ_ACCENT}15` `` 가 `var(--active)15` 라는 **무효 CSS 값**이라 배경이 투명이었고 글자만 3.24:1 로 남아 있었다(라이트 101 노드의 정체). tint 토큰 + 잉크로 교체.
- **구조적 접근성 3종**: `aria-prohibited-attr`(role 없는 div 에 aria-label → 막대 전체를 `role="img"` 하나로) · `dlitem`/`definition-list`(dt/dd 를 dl 직계로 평탄화) · `scrollable-region-focusable`(가로 스크롤 목록에 `tabIndex=0` + 포커스 링).
- **결과**: 총 위반 719 → **20**(색대비 719→45→그 뒤 구조 수정 포함). 만화·도서·리더 5개 화면은 계속 **0** 유지.

#### 회귀 스펙 자체의 결함 2종도 수정

- **진도 잔여 상태 의존** — 리더 테스트가 이전 실행이 남긴 `comic_read_progress` 위치에서 열려, 마지막 컷이면 '다음 컷'이 disabled 라 실패했다. 시작 위치를 0 으로 고정하고 `finally` 로 복원하게 바꿔 결정론화.
- **라벨 결합** — 병행 세션이 만화 탭 라벨을 Adapted/Restored → Book Comics/Vintage Comics 로 바꾸자 스펙이 깨졌다. 탭·사이드바 단언을 **href 기준**으로 전환(라벨 변경에 무관).

### 학습자 화면 품질 자기발전 루프 — 접근성 게이트 신설 + 토큰 체계 개편 (2026-08-09)

"측정 → 결함 → 수정 → 재측정"을 9회 돌려 만화·도서 화면의 접근성 위반을 **0** 으로 만들고, 그 측정 자체를 상시 게이트(`14-learner-quality.spec.ts`)로 고정했다. 측정 도구는 `@axe-core/playwright`(WCAG 2.1 A/AA) 신규 도입.

- **근본 원인은 토큰이었다 — 면(fill)과 잉크(ink) 분리(ADR-004)**: 브랜드/시스템 원색을 *작은 글자*로 쓰면 거의 전부 AA 미달이었다(실측: `--active` 3.24 · `--ios-green` 2.02 · `--ios-orange` 1.99 · `--learn-known` 2.23). 다크에선 반대로 밝은 원색이 흰 글자와 부딪혔다(`--p` 위 흰 글자 2.90 · `--success` 위 2.98). → 배경·아이콘은 원색 그대로 두고 **글자만** 새 토큰으로: `--active-ink` · `--ios-*-ink`(7종) · `--learn-*-ink`(3종) · `--on-p`(테마별 반전).
- **`--t3` 는 텍스트 색이 아니다**를 규칙으로 확정: 알파 0.38 은 종이 위 2.35:1 이고 **어떤 알파로도 4.5 를 못 넘긴다**(0.62=`--t2` 가 최소선 4.79). 저자명·설명·탭 캡션·메타 등 의미 있는 글자를 `--t2` 로 올렸다(ComicsTabs · LibraryTabs · FlowNav · ComicsBrowser · ComicHeroCard · ComicFormatChoice · BookGridCard · BookFilterBar · BookShelfRail · LibraryGrid · 만화 상세/리더).
- **공용 컴포넌트 교정**: `Capsule` 이 tint 위에 원색 글자 + `opacity:0.85` 이중 감광이라 2.01:1 이었다 → ink 토큰 + opacity 제거. `i-plus-one` 적합도 배지도 ink 토큰으로(가장 많이 걸린 41 노드).
- **ARIA 구조 수정**: LibraryGrid 의 `role="list"` 가 listitem 의 직접 부모가 아니어서 `aria-required-children`(critical)이 떴다 → 실제 부모로 이동.
- **44px 터치 타겟**(CLAUDE.md 절대 금지 항목) 전수 교정: 필터 칩 36개 · 빠른 선택 · 검색/정렬 컨트롤 · 코버플로우 점(6×6 → 44px 히트영역 + 안쪽 점) · 사이드바 로고/접기 · 만화 레벨 칩.
- **결과**: 만화 카탈로그/상세/복원 서가/리더 · 도서 목록 = **라이트·다크 모두 axe 위반 0**, 학습자 콘텐츠 내 44px 미만 **0**.
- 검증: 14-learner-quality 4/4 · 11/12/13 회귀 15/16(1건은 dev 콜드 컴파일 타임아웃, 단독 재실행 통과) · unit 225 · tsc 클린.

### 만화 화면 기본 조작 전수 점검 — `13-comic-navigation.spec.ts` 신설 (2026-08-09)

카탈로그 · 상세 · 리더 컨트롤 · 이탈/복귀 · 종료 CTA · Restored 탭을 자동 감사하고 상시 회귀로 고정.

- **발견·수정 — 버튼을 누르면 화살표 넘김이 죽었다**: 리더 키 핸들러가 "컨트롤에 포커스가 있으면 단축키 양보" 였는데, 이전/다음 컷 버튼을 마우스로 한 번 누르면 포커스가 그 버튼에 남아 **이후 ArrowLeft/Right 가 조용히 무시**됐다(실측: 6 → → 6). 마우스와 키보드를 섞어 쓰는 것이 정상 사용이므로 화살표는 항상 받도록 바꾸고, **Space 만** 예외로 남겼다(포커스된 버튼을 누르는 키라 리더가 가로채면 이중 동작). 입력 필드·모달 안에서는 여전히 전면 양보.
- **정상 확인(설계 의도대로 동작)**: 컨트롤 3초 자동 숨김 → `focus` 로 자동 노출(키보드 사용자가 갇히지 않는다) · 다음/이전 컷 · 뷰 전환(페이지↔세로 스크롤) · 몰입(dim) `aria-pressed` · stave 레일 점프 · 코치 안내 닫기 · 본문 복귀 후 뒤로가기로 리더 복귀 · 마지막 컷 종료 화면 + 본문/퀴즈 유입 CTA · 상세의 목록 복귀/단어장 연결/원문 카드.
- **감사 스펙이 넘어졌던 함정 3종을 규칙으로 남김**(주석): ① 컨트롤은 opacity 0 + pointer-events-none 으로만 숨어 Playwright 에 "보이는데 클릭 불가(not stable)" 로 보인다 → 컴퓨티드 opacity 로 판정 ② stave aria-label 상태값은 `읽음/현재/남음` ③ **모든 컷에 정본 대사가 있는 게 아니다**(캡션만 있는 컷) → 대사 단언은 조건부.
- 현재 Restored(PDCP) 서가는 0편이라 렌더까지만 검증(데이터 들어오면 리더 왕복까지 자동 검증).

### 내비게이션 기본기 전수 자동 점검 — `12-navigation.spec.ts` 신설 (2026-08-09)

"화면 이동 / 뒤로가기 / 닫기 / 페이지 네비게이션"을 자동 감사하고, 그 시나리오를 상시 회귀로 남겼다. 감사 범위: 사이드바 15개 메뉴 · 탭 5개(라이브러리 3 · 만화 2) · 진입 리다이렉트 2건 · 브라우저 뒤로/앞으로 · 페이지 내 되돌아가기(만화 상세→목록, 리더→본문) · 워크스페이스 ModePills 9종.

- **결과: 이동 경로 자체는 전부 정상.** 사이드바 15/15, 탭 5/5(aria-selected 포함), 히스토리 복원, 인페이지 복귀 링크 모두 통과.
- **발견·수정 — hydration mismatch**: `Toggle` 이 `Math.random()` 으로 input id 를 만들어 서버/클라 값이 달랐다(`/settings` 콘솔 `Prop id did not match. Server: tg-… Client: tg-…`). id 가 어긋나면 `label htmlFor ↔ input` 연결이 깨져 **라벨 클릭·스크린리더 연결도 함께 흔들린다.** `useId()` 로 교체. 같은 패턴이던 `Radio`(value 없는 경우)도 선제 수정.
- **감사 도구 자체의 오탐 2종을 규칙으로 고정** — 다음 사람이 같은 곳에서 헛다리 짚지 않도록 스펙 주석에 근거를 남겼다:
  - Next 는 스트리밍 시작 후의 `redirect()` 를 **소프트(클라) 리다이렉트**로 처리한다. 문서 응답은 200 이고 URL 은 hydration 후 바뀌므로 `goto` 직후 URL 로 판정하면 "리다이렉트 안 됨"으로 오판한다. → 전부 `waitForURL` 판정.
  - dev 서버는 라우트별 콜드 컴파일이 수 초~수십 초라 클릭 직후 URL 을 읽으면 "이동 안 함"으로 오판한다(세션 pill 3종이 그렇게 실패로 보였으나 실제로는 정상).
- ModePills 계약도 단언에 포함: 워크스페이스를 떠나는 pill 은 복귀용 `from=` 파라미터를 반드시 실어야 한다.

### 만화를 볼 수 없던 이유 — `cefr_level` NULL 이 등록을 막고 있었다 (2026-08-09 수정)

"만화 보는 페이지가 안 된다"는 제보를 끝까지 재현해 원인을 특정했다. **UI 문제가 아니라 데이터 결손**이었다.

- **근본 원인**: `enroll_library_book` 은 `cefr_level ∈ (A1…C2)` 가 아니면 예외를 던진다. 만화가 발행된 유일한 도서(A Christmas Carol)가 `cefr_level = NULL` — 발행 도서 13권 중 **유일하게** 비어 있었다. 그래서 `texts` 행이 한 번도 만들어지지 않았고(전 사용자 0행), 리더 라우트 `/text/[id]/comic` 에 **아무도 도달할 수 없었다**. 만화 자체는 정상(90컷·5 stave·이미지 public 200).
- **데이터 수정**: `cefr_band='B2'`(이미 있던 값)로부터 `cefr_level='B2'` 채움 — 1행 UPDATE.
- **실패를 삼키던 UI 수정**: `ComicFormatChoice` 가 모든 등록 실패를 "잠시 후 다시 시도해 주세요" 로 뭉개 원인을 볼 수 없었다. 이제 차분한 한 줄 뒤에 실제 사유를 덧붙인다.
- **회귀 신설** — `11-comic-discovery.spec.ts` "만화 리더": 상세 → 시작(등록) → `/text/[id]/comic` → **컷 카운터 + 정본 대사 렌더 + `comic_read_progress` service-role DB 단언**. 이 체인이 죽으면 실패한다.
- **테스트가 조용히 공회전하던 것도 고침**: 카드 href 가 등록 상태에 따라 상세/리더로 갈려서, 등록 후에는 `a[href^="/comics/adapted/"]` 가 아무것도 못 찾고 "카탈로그 0" 으로 통과하고 있었다. 카드에 `data-book-id` 를 붙이고 그것으로 도서를 식별하도록 교체.

### 곁가지 수정 — WordVault 허브가 로드마다 400 을 쏘고 있었다

위 등록으로 계정에 챕터 단어장 구독이 생기자 드러난 **선재 결함**. `useHubStats` 가 `shared_word_sets.category_id` 를 먼저 select 하고 실패하면 폴백하는 "예외로 스키마 탐지" 구조인데, 이 DB 는 브릿지 마이그레이션(`20260518130000`)이 미적용이라 **구독 세트가 있는 모든 사용자에게 매 로드 400 이 확정 발생**했다(화면은 폴백으로 멀쩡). 왕복 1회 낭비 + 콘솔/모니터링 오염이라 legacy select 로 단순화하고, 브릿지 적용 시 되돌릴 지점을 주석으로 남겼다.

### 만화 메뉴 통합 — `Comics` 하나 안에 **Adapted(도서 각색) · Restored(원본 복원)** (사용자 결정 2026-08-09)

두 만화 기능(CCP 도서 각색 · PDCP 원본 복원)이 사이드바에 각각 최상위 항목으로 있던 것을 **입구 하나로 합치고 안에서 출처로 나눴다**. 학습자에겐 둘 다 "만화"라 입구가 둘이면 어느 쪽을 눌러야 할지 알 수 없다.

- **라우트 재편**: `/comics` → `/comics/adapted` 리다이렉트(`/library` 패턴 동일) · `(main)/comics/adapted/**`(구 `/comics`+`/comics/book`) · `(main)/comics/restored/**`(구 `/restored`). `layout.tsx` + 신규 `ComicsTabs`(role=tablist · aria-selected · 44px, LibraryTabs 와 동일 패턴).
- **명명 — `Adapted` / `Restored`**: 기술(AI·스캔)이 아니라 **원작에 무슨 일이 있었는지**로 지은 과거분사 쌍. "AI Comics"류는 기술이 바뀌면 낡고, 각색의 정본 정합(R4)이라는 핵심 가치를 가린다. 기각한 대안: `Booktoon`(CCP 전용이라 쌍이 안 맞음) · `Generated`(기술 노출) · `Classics`(복원본이 고전이 아닐 수 있음) · `Reimagined`(각색보다 과장).
- 사이드바는 `Comics` 단일 항목으로 복귀 — PDCP 의 `Restored` 최상위 항목 제거(탭으로 편입).
- **회귀 함정 하나 고침**: 통합 후 e2e 3·4번이 `/comics`(리다이렉트) 진입 → 카드 링크 미발견으로 **조용히 공회전 통과**하고 있었다. 진입을 정규 목록 URL(`/comics/adapted`)로 바꿔 실제 프리뷰 3컷·로그인 유도까지 다시 검증된다.
- 검증: `tsc --noEmit` 클린 · e2e 11-comic 4/4(탭 aria-selected · href 계약 `/comics/adapted/…` · 프리뷰 3컷) · 04-ui-smoke 5/5 · 4개 라우트 실렌더(구 `/restored` 404 확인).

### 만화 = `/library` 탭 → **사이드바 최상위 메뉴** `/comics` (사용자 결정 2026-08-09)

- `LibraryTabs` 4탭 → **3탭 복귀**(도서/스크립트/공용 단어장). 만화는 사이드바 Scripts 그룹의 `Comics` 항목으로 승격 — `(main)/library/comics/**` → `(main)/comics/**` 이동.
- **데이터 축은 불변**: 만화는 여전히 `library_books` 앵커(D1)이고, 도서 카드의 만화 배지·포맷 필터·상세 시트 gold CTA 는 `/library` 에 그대로 남는다. 입구만 밖으로 나왔다.
- ⚠️ **병행 세션(PDCP)과의 라우트 충돌 해소**: 같은 시간 다른 세션이 퍼블릭도메인 복원 만화용으로 `(main)/comics/[slug]` 와 `(main)/library/comics` 를 만들고 있었다. `[bookId]`/`[slug]` 형제 동적 세그먼트는 **Next.js 빌드가 깨지는** 조합이라 CCP 상세를 `/comics/book/[bookId]` 로 한 단계 내렸다. 사이드바에 `Comics` 라벨이 둘이던 것도 PDCP 쪽을 `Restored` 로 분리(해당 세션이 이후 `/restored` 로 이동).
- 검증: `tsc --noEmit` 클린(이동 후 `.next/types` 스테일 정리 포함) · e2e 11-comic 4/4(사이드바 진입 · 카드 href 계약 `/comics/book/…` · 프리뷰 · 로그인 유도 `next=%2Fcomics%2Fbook%2F`) · 04-ui-smoke 5/5.
- ⚠️ 구 경로 `/library/comics` 는 CCP 쪽 리다이렉트를 두지 않았다 — 그 자리를 PDCP 가 쓰고 있었기 때문(현재는 `/restored` 로 이동 중).

### CCP × Library P2 — 만화가 단어장·발행 체계에 정합으로 편입됐다 (마이그레이션 없음)

- **발행 조건 단일화 — `lib/library/publish-gate.ts` 신설**: "학습자에게 무엇이 보이는가"가 화면마다 흩어져(도서 3조건 / 아티클 2조건 / 만화 RPC 내부) 한 곳만 고치면 조용히 어긋나던 것을 묶었다. **카탈로그 게이트(published_at 요구) ≠ 열람 게이트(status만)** 라는 사실도 의도로 문서화 — 만화 RPC 기준과 맞춘 것. 설계서의 `v_library_catalog` 뷰는 **P3 로 연기**: 소비자(통합 홈)가 없는 지금 뷰만 추가하면 아무도 안 쓰는 정의가 하나 더 늘 뿐이라, 실제 쿼리 지점을 먼저 묶는 쪽을 택했다(설계서 검토 로그에 반영).
- **만화 vocab 정합 게이트 — `lib/comic/vocab-integrity.ts` + 단위 8종**: `comic_pages.target_vocab` 이 챕터 단어장(`shared_word_sets` category='library_book' → `shared_words`)에 실재하는지 대조. 없으면 학습자가 만화에서 만난 단어가 **FSRS 로 이어지지 않는 고아**가 된다. word/lemma 양방향 대조(굴절형 허용) · 정규화(대소문자·전후 문장부호, 하이픈/어퍼스트로피는 보존). SQL 함수 대신 TS 인 이유는 마이그레이션 없이 작동하고 규칙을 테스트로 고정하기 위해서.
- **Admin 검수에 정합 노출** — QC 타일 5칸으로 확장(+"단어장 미등록") + 고아 단어 목록(≤40) + 단어장이 없을 땐 "판정 불가"로 정직하게 표기(0 과 구분).
- **학습자 3종 연결** — 만화 상세에 "이 책의 단어장 보기"(`/library/books/[id]?preview=1`).
- **R2 분리 회계 표기** — 도서 상세 시트에 "만화 미리 봄 42% / 다 봤어요"를 본문 진도와 **별도 블록**으로. CTA 라벨도 진도에 따라 분기(만화 이어서 보기 / 다시 보기). 만화를 다 봐도 챕터는 완료되지 않는다는 계약이 UI 에서도 보인다.
- **검증**: unit 17 pass(prescribe 9 + vocab-integrity 8) · e2e 11-comic 4/4 · 04-ui-smoke 5/5(publish-gate 리팩터가 도서·스크립트 목록을 건드려 회귀 확인) · `tsc --noEmit` 클린. ⚠️ Admin 검수 화면은 이 환경의 e2e 계정에 admin 권한이 없어 **런타임 렌더 미검증**(타입 검사만).

### CCP × Library P1 — 등록 전에도 만화를 보고, 어느 입구로 들어갈지 고른다

**마이그레이션 [20260808240000_comic_catalog_p1.sql](../supabase/migrations/20260808240000_comic_catalog_p1.sql) — 2026-08-09 사용자 승인 후 dev 적용 완료.** 검증: `list_comic_catalog` 1행(A Christmas Carol · 90컷 · 5챕터 · cover_url 실값) · `preview_book_comic(p_limit=99)` → **5행**(서버 하드캡 동작) · 앱 상세에 "5챕터 · 약 3시간 · 90컷" 실렌더 · e2e 4/4(이제 P1 경로). 코드는 여전히 2단 폴백을 유지해 롤백에도 견딘다.

> ⚠️ **적용 중 발견(후속 필요)**: Supabase 기본 권한이 public 스키마 신규 함수에 anon/authenticated EXECUTE 를 자동 부여한다. `REVOKE ALL … FROM PUBLIC` 은 PUBLIC 의사롤만 건드리므로 anon 이 남는다. 실제로 **`select_book_comic_all`(전권 90컷 + bubbles + target_vocab)이 anon 실행 가능** — 마이그레이션 파일은 authenticated 만 GRANT 했는데도. 즉 프리뷰 5컷 하드캡은 전권 유출을 막지 못한다. 명시 REVOKE 마이그레이션 필요(승인 대기).

- **`/library/comics/[bookId]` 신설 — G3 해소**: 리더 라우트가 `texts.id`(=등록)를 요구해 **미등록 학습자는 만화를 아예 못 봤다**. 이제 비로그인·미등록도 프리뷰 3컷을 본다. 프리뷰는 **아트만** — 정본 대사·`target_vocab` 은 리더의 학습 자산이라 싣지 않는다.
- **`ComicFormatChoice`** — 만화/원문/듣기 3카드. **권장은 정확히 1개**(선택 피로 방지), 나머지도 그대로 선택 가능(강제 이동 없음). 미등록이 시작하면 `enroll_library_book`(멱등) 후 해당 포맷으로 직행, 비로그인은 `?next=` 로 되돌아온다.
- **`lib/comic/prescribe.ts` + 단위 테스트 9종** — 이어보기 > 복습(본문 완독 이력) > 난이도 > 미진단 순. **적정 난이도(ideal)에선 본문을 권장**한다: 만화를 항상 앞세우면 seductive details(그림이 본문 읽기 시간을 밀어냄) 문제를 제품이 스스로 만든다.
- **마이그레이션 내용** — `comic_books.feature_rank`(노출 순서 · G4) + `preview_from`(스포일러 회피 오프셋) · `list_comic_catalog`(RPC 안에서 첫 컷 커버 + 커버리지/낭독/챕터 메타까지 1회 · G5) · `preview_book_comic`(published 이중 게이트 + **서버 하드캡 5컷** + anon GRANT).
- **진입 경로 재배선**: 만화 탭 카드 · 도서 히어로 · 상세 시트의 미등록 href → `/library/comics/[bookId]`.
- **검증**: e2e 4종이 **마이그레이션 미적용 상태에서 통과**(= 폴백 경로 실증) · 04-ui-smoke 5/5 · unit 55 pass · `tsc --noEmit` 클린. 프리뷰 3컷 실렌더 확인(anon).

### CCP × Library P0 — 만화가 라이브러리의 고를 수 있는 포맷이 됐다

설계(아래) 의 P0 구현. **마이그레이션 없음** — 기존 발행 게이트 RPC(`list_book_comic_catalog`)만 사용.

- **`/library/comics` 신설 + LibraryTabs 4탭**(도서/만화/스크립트/공용 단어장). 만화 탭 = `kind=book ∧ format∋comic` 의 저장된 뷰 — 콘텐츠 복제 0. 이어서 보기 레인(`comic_read_progress`) + 레벨 밴드 필터(facet-adaptive) + 발행 0일 때 차분한 빈 상태.
- **포맷 축 도입(장르와 직교)**: `BookFilterBar` "음성" 구획 → **"포맷"**(만화/원어민 음성)으로 승격 · `BookFilters.comicOnly` · QuickPick "만화로" · `BookGridCard` gold 배지(아이콘 + sr-only 텍스트 — 색상 단독 전달 금지). 이제 "SF이면서 만화"가 질의된다.
- **선택 지점 배선**: `NetflixDetailSheet` 도서 상세에 gold 보조 CTA(등록: 만화로 읽기 / 미등록: 만화 미리보기). `toBookDetailVariant` 경유라 spotlight·rail·그리드 전부 자동 적용.
- **`lib/comic/catalog.ts` 단일 출처 신설** — 이전엔 `library/books/page.tsx` 안에 인라인. 커버(첫 컷) 조회를 `coverLimit`(실제 렌더 카드 수)로 상한: 히어로 4권만 받는다. `select_book_comic_all` 이 커버 1장에 전권 payload 를 주는 구조라 도서 수 증가 시 터질 자리였음 — 근본 해소(RPC `list_comic_catalog`)는 P1.
- **회귀** — `11-comic-discovery.spec.ts`: 탭 이동(aria-selected) · 카드 href 계약(`/text/[id]/comic` 또는 `/library/books/[id]`) · **포맷 칩 적용 후 남은 도서 수 = 만화 배지 수**(필터가 거짓말하면 실패). 발행 만화 0이면 빈 상태 단언 후 종료(콘텐츠 의존 false-fail 방지).
- 실측 확인: 발행 만화 1편 · 04-ui-smoke 5/5 통과 · 신규 spec 2/2 통과 · `tsc --noEmit` 클린.

### 설계 — CCP × Library 만화 카탈로그 편입 ([CCP_LIBRARY_INTEGRATION.md](./CCP_LIBRARY_INTEGRATION.md))

만화를 `/library` 의 정식 학습 포맷으로 편입하는 설계 확정(구현 미착수). 핵심 판정: 만화 = **같은 책(Work)의 다른 표현형(Expression)** — FRBR 근거로 데이터는 `library_books` 앵커 유지, 탐색 UI 만 독립 코너화(4탭 `/library/comics` + 포맷 facet). 실측 결함 8종(G1~G8) 명시 — 만화 전용 진입점·필터 부재, **미등록 학습자 열람 불가**(라우트가 `texts.id` 요구), 히어로 알파벳순 4권 고정, 커버 1장에 전권 RPC 4회, 단어장(`target_vocab`) 미연계, 진도 이원화. seductive details 연구 근거로 **만화 완주 ≠ 챕터 완료**를 코드 계약(R1~R6)으로 고정. 신설 예정 RPC `list_comic_catalog`/`preview_book_comic`/`v_library_catalog` SQL 초안 포함(마이그레이션 미적용 — 승인 대기).

### 아케이드 접근 모델 재설계 — 카탈로그 SSoT · 기본 스코프 = 내 복습 단어 (v07.4)

딥서치(choice overload · SDT 자율성 · Gimkit/Blooket 모드 선택) 결론: **"추천 하나 + 전부 열람"**. 선택지가 작업기억을 넘으면 자율성이 아니라 마비가 되고, 반대로 선택권을 뺏으면 SDT 자율성이 깎인다. 그리고 학습자가 게임 앞에서 실제로 궁금한 건 장르가 아니라 **"이게 내 단어를 쓰나"**.

- **P0 — 아케이드 진입 게임이 내 단어를 한 번도 안 만졌음(수정)**: `/arcade` 카드는 `?set=`/`?text=` 없이 게임을 열었고, `GamePlayScaffold` 는 스코프가 없으면 `wordPool` 을 주지 않았다 → 게임이 하드코딩 `DEFAULT_POOL` 로 돌고 `recordGameResult` 가 `vocabularies` 조회 실패로 silent skip. 허브가 내걸던 "모든 게임은 학습 기록(FSRS)과 연동됩니다"가 **기본 진입에서 거짓**이었다. 스코프를 3단으로 재정의 — ① `?set=`/`?text=` → ② **사용자 due 큐**(신규 기본) → ③ 맛보기. ③으로 떨어질 때는 세션 셸 브레드크럼에 "맛보기 단어 · 내 단어장이 채워지면 내 단어로 바뀌어요"로 정직하게 표기.
- **`lib/game/catalog.tsx` 신설 — 게임 정의 SSoT(19종)**: slug·이름·태그라인·인지계층·무드·마크·`source`(mine/bank)·`minWords`·`closeHref`. 같은 사실이 4곳(arcade 페이지 GAMES 17 · gamekit `MARK_PATHS` 17 · SessionFrame `SESSION_META` 14 · ArcadeEntryCard 문구 "12종"/"14개 세계")에 복제돼 전부 다르게 낡아 있던 drift 를 제거. `GameMark` 는 카탈로그 `GAME_MARKS` 참조, SessionFrame·진입 카드 문구는 파생.
  - 부수 복구: **누락돼 있던 3종**(`wordsmith-vigil`·`morphmerge`·`wordfall-cadence`)의 세션 셸 제목이 "학습 세션 ✨"로 뜨고 닫기가 `/hub` 로 오배송되던 문제 해소.
  - 부수 복구: 스캐폴드 exit 폴백이 존재하지 않는 라우트(`/cascade` 등 module id)로 push 하던 것을 `/arcade` 로 교정.
  - 부수 복구: 아케이드 그리드에서 누락돼 있던 `wordblitz`·`pirate-quest` 편입 → 발견 가능. `pirate-quest` 자체 exit 도 `/library` → `/arcade`.
- **`/arcade` IA 재설계** — ① 오늘의 추천 1종(KST 날짜 시드 결정론 회전 · 보유 단어 ≥6 이면 mine 풀에서, 아니면 bank 풀에서) ② **내 단어로 플레이**(8종 · "복습 임박 N개" 배지 · FSRS 반영 명시) ③ **큐레이션 세계**(11종 · 단어 없이 즉시 플레이). 3D·베타 칩 추가.
- **`(app)` → `(main)` 라우트 그룹 이동**: 허브는 세션이 아닌데 `(app)`(SessionFrame 전용 풀스크린 그룹)에 있어 Sidebar·FlowNav 가 통째로 사라졌다. URL 은 `/arcade` 그대로. 게임 본체 `/play/*` 만 `(app)` 에 잔류.
- **Sidebar Practice 그룹에 `Arcade` 등재**(`Gamepad2`) — 이전엔 `/hub` 를 스크롤해 진입 카드를 찾는 것이 유일한 통로였다.
- 신규: `lib/game/due-words.ts`(`fetchDueGameWords` · cap 40 · `next_review_at` ASC nullsFirst, flashcard/pairflip 과 동일 정책 · 굴절형 보강). `scoped-words.loadInflectedForms` export 승격(중복 쿼리 방지).
- **회귀 고정** — `07-arcade-games.spec.ts`: ① 허브 테스트를 IA v07.4 로 갱신(오늘의 추천 + 2섹션 + 19카드 전수 딥링크) ② **신규 "비스코프 진입 — mine 게임이 내 복습 단어를 쓴다"** — 브레드크럼 `내 복습 단어`(맛보기 아님) + 제시된 뜻이 사용자 `vocabularies` 소속임을 service-role DB 단언(`fetchUserVocabWords` 헬퍼 신설). DEFAULT_POOL 회귀 시 실패한다.

#### 전수 테스트 라운드 — 도출 케이스 36 + 발견 결함 5 수정

테스트 케이스를 축(발견성 / 스코프 3단 / 세션 셸 / 영속화 / 반응형·a11y)으로 도출해 unit 20 + e2e 16 을 작성하고, 그 과정에서 나온 결함을 전부 수정.

- **[자체 결함] wordblitz 가 카탈로그 광고와 다르게 동작** — `source:'mine'` 으로 "내 단어로 플레이" 섹션에 넣었지만, 이 페이지는 스캐폴드를 안 쓰고 자체 스코프 로직을 복제하고 있어 mine 단계가 없었다(= 아케이드에서 열면 여전히 DEFAULT_POOL). 스코프 해석을 **`lib/game/use-word-scope.ts` 공용 훅**으로 추출해 스캐폴드 17종과 독립 3D 가 같은 규칙을 공유하도록 통합. 브레드크럼 매핑도 `lib/game/scope-resource.ts` 로 분리.
- **[선재 결함 · 전 게임 영향] 셸 X·Esc 로 닫으면 세션 기록이 통째로 유실** — `scores` 적재와 스트릭·XP 적립이 **게임 내부 종료 버튼**의 `onExit` 에만 걸려 있었다. 학습자가 실제로 가장 많이 누르는 종료는 세션 셸 상단 X 와 Esc(SessionFrame 이 라우팅으로 처리 → `onExit` 미호출). 실측: 4문항 플레이 후 X → `learning_records` 6행 / `scores` **0행**. **`lib/game/use-session-recorder.ts`** 신설 — 언마운트(=세션을 떠나는 모든 경로) 시 1회 가드 flush.
- **[선재 결함 · 전역] 모든 (main) 페이지에 가로 스크롤바** — FlowNav 리치 툴팁(`w-240px`)이 `opacity-0` 여도 레이아웃을 점유해 좁은 폭에서 뷰포트를 넘겼다(실측 `/hub`·`/arcade` 768px **39px**, 900px 23px). `<nav>` 에 `overflow-x-clip`(다른 축을 스크롤로 승격하지 않아 툴팁 하단 전개는 유지).
- **[자체 결함] 깨진 카피 2종** — due 0 일 때 `"내 복습 단어  로 진행"`(수 없는 문장)과 `"복습 임박 0개"` 배지. 3상태(단어없음 / 있고 due 0 / 있고 due N)를 각각 자연스러운 문장으로 분기(`mineBadge`·`mineDesc`·`dailyMeta`).
- **[일관성] FlowNav 단계 누락** — Sidebar Practice 에 Arcade 를 넣었는데 `getStageFromPathname` 에 `/arcade` 가 없어 단계 하이라이트가 안 됐다. `practice` 로 매핑.
- **[판단] 오늘의 추천에서 3D·베타 제외** — 모바일 three.js 번들 부담 + 베타(pirate-quest)는 학습 기록 미연동이라 "오늘 이거 하나만"의 약속과 맞지 않음. 직접 선택은 그대로 가능.
- 테스트: `src/lib/game/__tests__/catalog.test.ts` **20 케이스**(카탈로그 ↔ 실제 `/play` 디렉터리 정합 · 필수 필드 · source↔minWords 정합 · `gamePlayHref` 엣지 · `pickDailyGame` 결정론/3D제외/전순회/음수 · `kstDayIndex` KST 자정 경계) + `tests/e2e/09-arcade-access.spec.ts` **16 케이스**(비로그인 맛보기·깨진 카피 회귀·반응형 3뷰포트 / 사이드바 활성·문구↔카드수 일치·섹션 카운트·추천 결정론 / explicit 우선·단어0 안내·bank 격리·wordblitz mine / 세션셸 신규3종·`?from` 우선·Esc 복귀 / X 종료 영속화 / 44px·제목계층·포커스링).
- 검증: `tsc --noEmit` 0 error · **vitest 185 pass** · **e2e 07 16/16 + 09 16/16 pass**.
- ⚠️ 미수정(별건, 본 변경과 무관): ① `next lint` 가 `eslint-module-utils/resolve` 미해결로 이 환경에서 실행 불가 ② `/library/books` 768px 가로 넘침 **324px** — `BooksExplorer` 의 고정폭 `w-[270px]` 표지(v06.33)가 원인.

#### BGM 시네마틱 전면 교체 + 아케이드 아트 디렉션 브랜드 정렬 (v07.5)

**① BGM — 칩튠 19곡 전량 교체.** 이전 세트는 8비트 스퀘어파(8bit Dungeon Level · Bit Quest · Bit Shift · Awesome Call …)라 "PC 효과음 같은 얇은 느낌"이었고 학습 공간의 무게와 맞지 않았다.

- incompetech(Kevin MacLeod, CC-BY 3.0) 카탈로그에서 **오케스트라·시네마틱·앰비언트 23곡을 검증**해 게임 무드별로 재큐레이션 → **19종 전부 고유 트랙**(재사용 0). 예: wordblitz "Prelude and Action" · glyph-tongue "Ossuary 6 - Air" · silent-rule "Lightless Dawn" · lexicon-estate "Shores of Avalon" · word-orrery "Immersed" · pirate-quest "Achaidh Cheide".
- 가공(포터블 ffmpeg 9.0): 인트로 이후 **~110초 루프** · 3s 페이드인 / 5s 페이드아웃 · **EBU R128 -16 LUFS (TP -1.5)** 정규화로 게임 간 레벨 일관 · 128kbps 44.1kHz **스테레오**(폭·저역 유지). 17MB(14곡 112kbps) → 33MB(19곡 128kbps).
- `CREDITS.txt` 전면 갱신(곡명·게임 매핑·가공 방식). 앱 내 `/arcade` 푸터 표기 유지.

**② 아트 디렉션 — 플랫폼 정렬.** 아케이드가 보라–마젠타 황혼 배경 + 카드 19장 풀블리드 무지개 그라디언트였다. 플랫폼 토큰(Reading Room — deep ink `#0F2540` · paper `#FBFAF6` · muted gold `#B0843A`, Linear식 "gold 는 5% 미만·시그니처에만")과 접점이 전혀 없어, 페이퍼 톤 셸 안에서 **다른 앱을 붙여둔 이물질**로 읽혔다(허브를 `(main)` 으로 옮기며 더 두드러짐).

- 씬: 앱 **다크 테마 캔버스**(warm dark paper `#181410`) 바닥 + deep ink 웨시 = "저녁의 서재". 앰비언트 글로우도 gold + ink 두 색만(이전 오렌지+퍼플).
- 카드: 공통 잉크 베이스 + **게임 무드 24% 틴트**로 통일. 정체성은 색면이 아니라 **2px 상단 액센트 엣지 + 마크 색 + hover 글로우**가 담당 → 19색 무지개 제거, 식별성은 유지.
- **금빛은 오늘의 추천 한 곳에만**(카드 배경 웨시 · eyebrow · CTA). 브랜드의 단일 액센트 규칙을 화면에서 실제로 지킨다.
- 섹션 배지 `live` 도 초록 → 금빛으로 통일. 칩·마크 컨테이너 채도 하향.
- 회귀 +4: 트랙 재사용 금지 · **칩튠 곡명 복귀 차단**(CREDITS 정규식) · 전 게임 크레딧 기재(CC-BY 준수) · 경로 형식.
- 검증: tsc 0 · vitest 202 · e2e 07+09 35/35 · 신규 mp3 서빙 200.

#### 중복 게임 정리 — 계열(family) 접기 (v07.4)

"중복 게임이 많다" 제보 조사. 핵심 루프를 코드로 대조한 결과 **19종 중 4종이 같은 엔진의 스킨**이었다.

| 게임 | 줄 수 | 프롬프트 | 응답 | 판정 |
|---|---|---|---|---|
| wordblitz | 789 | `target.ko` | 4지선다 en 타일 | `o.en === target.en` |
| daily-blitz | 311 | 〃 | 〃 | 〃 |
| word-economy | 268 | 〃 | 〃 | 〃 |
| ghost-race | 236 | 〃 | 〃 | 〃 |

- **판단: 삭제가 아니라 접기.** 학습적으로는 같아도 동기 장치(타이머·데일리·경제·경쟁)로는 서로 다르고, 같은 문답 위에 모드를 얹는 구조는 Gimkit 이 검증한 방식이다. 진짜 문제는 존재가 아니라 **19장을 동급 카드로 평평하게 깐 것**.
- **구현**: 카탈로그에 `GAME_FAMILIES` + `family`/`modeLabel`/`modeNote`/`modeOrder` 축 추가. `hubSections()` 가 섹션별 `HubItem[]` 을 만들고 허브가 계열 1장 + 모드 칩으로 렌더. **게임 코드 무변경**(순수 표시 계층) → 저위험·롤백 용이.
- 카드 수 **19 → 16**(mine 9→6장 · bank 10장). 도달 가능한 게임은 그대로 19.
- 계열은 쪼개지지 않는다 — blitz 3종이 mine, 데일리 1종이 bank 라 **멤버 다수 섹션으로 통째 이동**하고 소수파는 칩 설명에 명시("내장 뱅크"). 섹션 배지는 `countHubGames()` 로 실제 구성에서 계산(mine 9 · bank 10).
- 계열 카드는 `<a>` 가 아니라 컨테이너 — 중첩 앵커를 피하고 **모드 칩 각각이 플레이 링크**(44px 타깃).
- **[부수 오류 정정] `wordblitz` 는 3D 가 아니다** — v07 재설계로 three.js 인형뽑기 → 순수 2D DOM 인데(MODULES.md §5), 카탈로그에 stale 한 루트 인덱스 설명("인형뽑기 3D · GLB 집게")을 옮겨 적어 `is3d: true` + 잘못된 태그라인이 들어가 있었다. 그 탓에 오늘의 추천에서도 부당하게 제외됐다. 실측(three 임포트 0)으로 확인 후 정정.
- **유지한 약한 중복**: letter-forge(글자 제공) → wordsmith-vigil(무단서 타이핑)은 Desirable Difficulty 계단, connections(선택 분류) ↔ lexicon-estate(공간 배치)는 입력 방식이 달라 학습 경험이 구분됨.
- 회귀 +10: unit 계열 무결성 9(계열 정의 존재 · modeLabel 필수 · 라벨 중복 금지 · modeOrder 정렬 · 멤버 2+ · **접어도 전 게임 정확히 1번씩 도달** · 계열 미분할 · 카드 수 감소 · 첫 멤버 자리 보존) + e2e `A5`(카드<링크 · 계열카드 비앵커 · 모드칩 딥링크·44px · 중복 노출 0). A2/A3 는 카드 수 → 플레이 링크 수 기준으로 갱신.
- 검증: tsc 0 · vitest 198 · e2e 07+09 35/35.

#### BGM 이 안 들리던 진짜 이유 — CSS 명시도 + 발견성 (v07.4)

"각 게임에 BGM 없음" 제보 조사. 재생 로직·음원·배선은 **전부 정상**이었다(토글 시 `paused:false · currentTime 진행 · vol 0.3 · loop`). 원인은 둘:

- **[P0 · CSS 명시도] 음악 버튼이 좌하단 고정이 아니라 게임 상단 흐름에 전체 너비로 박혀 있었다.** `.gk-root > :not(.gk-energy):not(.gk-atmos)`(명시도 0,3,0)가 `.gk-music-btn`(0,1,0)의 `position: fixed` 를 이겨 `position: relative` 로 계산됐고, `.gk-root` 가 flex 컨테이너라 `inline-flex` 가 blockify 돼 폭 1280px 로 퍼졌다(실측). 음악 컨트롤로 보이지 않으니 아무도 누르지 않았다. WordBlitz 는 `.wbz-root > :not(.wbz-energy)` 로 같은 문제. 배경 레이어처럼 `:not(.gk-music-btn)` 로 제외.
- **[P1 · 발견성] 기본 OFF 인데 켜는 길이 게임 안 무라벨 아이콘 하나뿐.** ① **아케이드 허브에 "배경음악 켬/끔" 토글** 신설(`ArcadeMetaStrip` · 게임 진입 전 조용한 맥락에서 결정) ② 선호 미결정(`null`)이면 게임 내 버튼이 **"배경음악" 라벨을 펼쳐** 존재를 알리고, 한 번 정하면 아이콘만 남김. 선호 키는 `lib/game/music-pref.ts` 로 분리해 허브·게임이 공유. 기본값은 계속 OFF(자동재생은 Calm UI·브라우저 정책 위반).
- **[커버리지] 트랙 매핑을 카탈로그로 통합** — gamekit 의 `MUSIC_SRC` 복제본에서 독립 3D 2종이 빠져 **WordBlitz·Pirate's Bounty 는 트랙 자체가 없었다**. `GameEntry.music` 필드로 이관하고 두 게임에 배선(각각 Bit Shift / Awaiting Return 재사용) + gamekit 미사용 게임엔 `GameKitStyles` 동반 주입. `useGameMusic`·`GameMusic` 타입을 `GameSlug` 로 확장.
- 검증: **19종 전수 실측** — 18개 아케이드 라우트에서 `position:fixed` · 좌하단 14px · mp3 요청 확인(ALL OK), pirate-quest 배선 후 07 스펙 전수 통과.
- 회귀 고정 +5: unit `BGM 커버리지` 3(전 게임 트랙 보유 · 파일 실존 · 경로 형식) + e2e `F1`(허브 토글 → 게임 자동 적용) · `F2`(미결정 시 라벨 힌트 → 결정 후 해제) + **07 게임별 루프에 음악 버튼 존재·fixed·좌하단·폭 단언 추가**(레이아웃 붕괴 재발 시 14게임 전부에서 실패).

### 신규 파이프라인 — CCP (Comic Curation Pipeline · book→comic)

- **만화 스타일 선택(디자인 · 국내외 딥서치)** — 마이그레이션 `20260808240000` **적용됨**: `comic_styles`(포맷×연령×장르×난이도(V-Level) → 모델-레디 art_prompt·negative·lettering·palette·근거URL·상태) + `comic_books.style_key`. **국내외 딥서치로 20 프리셋 시드**: 웹툰 10(순정/로판/액션판타지/일상개그/감성일상/스릴러느와르/미스터리/학습만화/사극무협/공포) + 국제 10(Gonick교육/빅토리아동판화/그래픽노블/리뉴클레르/소년·소녀·청년·코도모 만화/슈퍼히어로/정밀리터러리). Admin **"스타일" 탭**(포맷/연령/장르 필터·art_prompt 프리뷰·상태) + **검수 콘솔 도서별 스타일 드롭다운**(setBookStyleAction) → `generate-comic.mjs plan`이 선택 art_prompt 노출 → 생성이 그 디자인으로. Carol=Gonick 기본(is_default).

- **진도 영속(P3 · 연속성)** — 마이그레이션 `20260808160000` **적용됨**: `comic_read_progress`(user_id+library_book_id PK · RLS user-owns) + `save_comic_progress` RPC. 리더가 위치를 서버에 **디바운스 저장** + 진입 시 **서버 진도 우선 복원**(localStorage 폴백) → **기기 간 이어보기** + 완독 시각 기록. 리더 route가 진도 로드 → `initialIndex` 전달.
- **세로 스크롤 몰입 모드(P2)** — 리더 상단에 **Page↔Scroll 토글**(Rows3/Square·뷰 localStorage 영속). Scroll = 전 컷 세로 스택(웹툰형) + IntersectionObserver로 현재 컷 추적(레일·카운터·aria-live) + 스크롤 시 크롬 자동숨김 + 레일 dot 탭 scrollIntoView. 뷰 통합 nav()로 키보드/푸터/레일 공용, `renderPanel` 추출로 두 모드 공용. reduced-motion 대응.
- **정본 회상 보상 루프(P2)** — verbatim blur→reveal 후 **"기억했어요 / 다시 볼게요"** 자가판정(Desirable Difficulty) + 세션 회상 집계 → 완독 화면 "정본 대사 N개를 기억했어요"(자기효능감·폭죽 없음). Emotional Encoding.
- **실험 매트릭스 = 모델×환경×스타일** — 테스트 폼에 스타일 드롭다운 추가(모델·환경에 이어) → `comic_gen_tests.style`+`params.env` 기록. 오케스트레이터 `test-comic-model.mjs --style KEY` → `comic_styles.art_prompt` 해석·생성 화풍 고정·run 기록. 테스트 카드에 스타일/환경 배지. → "어떤 모델+환경+스타일이 최적인가"를 구조적으로 실험.
- **자가호스트 러너 오케스트레이션 + 자동 테스트 + 엄격 감사수정** — `scripts/comic/model-runners.mjs`(backend→gen스크립트/워크플로/환경 매핑) + `scripts/comic/kaggle/setup-comfyui-comic.py`(Kaggle ComfyUI+cloudflared 터널→RunPod 드롭인 호환) + `scripts/lcp/test-comic-model.mjs`(모델×환경 dispatch→샘플 생성→관측 기록→루브릭 채점 유도, **run_envs 제약 스크립트 레벨 강제**) + `RUN_ENVIRONMENTS.md`. **엄격 사용성 감사 수정**: 테스트폼 자유입력 백엔드 제거(환경제약 강제) · 모델 상태변경 오류 노출·행별 pending · 빈-환경 안내 · 드레인 발행게이트 헤더 단일소스·대기/취소 사유·컷 그리드 상태글리프+aria·이벤트 로그 최신순·null좌표 skip · 44px·aria-label.
- **이미지 생성 모델 레지스트리(P3 · 시장 딥서치)** — 마이그레이션 `20260808200000` **적용됨**: `comic_gen_models`(key·provider·site·hosting·비용·다중참조·텍스트제어·캐릭터/화풍 일관성·4090적합·comic_fit·강약점·근거URL·상태). **2026 시장 딥서치(에이전트, 근거 URL 인용)로 17 모델 시드**: Qwen-Image-Edit-2511(fit90·자가호스트 top) · FLUX.2 pro(88) · Nano Banana Pro/Gemini3(88) · SD3.5+LoRA(85) · Qwen-2509(85) · Nano Banana(82) · FLUX Kontext pro/dev · FLUX.2 dev · Seedream4 · Ideogram3 · HiDream · Recraft · GPT Image1 · Z-Image · Midjourney(제외) · **gpt-image-2(현 프로덕션 채택)**. Admin **"모델" 탭**(comic_fit 순 비교·상태 토글·근거링크) + **"테스트" 탭 모델 드롭다운**(선택 시 backend/model/site 자동). **자가호스트 우선 구조(마이그레이션 `20260808220000`)**: `run_envs`(runpod-4090/kaggle-t4/api 화이트리스트)+`min_vram_gb` — 테스트 탭 **실행 환경 선택 → 그 환경 실행 가능 모델만 노출(선택 제약조건)**. **디폴트 = flux2-dev(자가호스트 RunPod)**. 자가호스트 7모델(Qwen-Edit 2511/2509·SD3.5·FLUX Kontext dev·FLUX.2 dev·HiDream·Z-Image) vs API전용 10. 트렌드: 참조조건 편집이 일관성 표준화 · 오픈 Apache 모델 20B+로 4090 양자화 필수 · 프런티어 API 라이선스 조임→자가호스트 앵커.
- **드레인 관측 + 테스트 콘솔(P3 · 생성 블랙박스 투명화)** — 마이그레이션 `20260808180000` **적용됨**: `comic_gen_runs`(백엔드/사이트/모델·상태·진행·**자기발전 반복**·비용·정본불일치·규칙위반) + `comic_panel_events`(컷 단위 **위치·시도횟수·phase·상태·점수·판정** 작업/평가 이력) + `comic_gen_tests`(실험 A/B). `/admin/comic/[bookId]/drain` **관측 콘솔**: 실행 헤더(백엔드/사이트/진행바/KPI) + **컷 상태 그리드**(pass/fail/repairing·시도수 배지) + **왜 발행 못하는지**(차단 사유 파생) + 평가 이력 로그 + 실행 이력 · running 시 5s 자동갱신. Catalog **테스트 탭**(실험 계획/기록/비교 · createComicTestAction). 드레인 `generate-comic.mjs`가 insert 시 run+events 자동 기록. Carol 시드(run 1·events 90·test 1 FLUX vs GPT).
- **Admin 검수 품질(P3)** — 검수 그리드 **썸네일**(Supabase 이미지 변환 `render/image ?width=320` · 변환 미지원 시 원본 onError 폴백) → 90 full-res 로드 회피. **생성 중 실시간 진행**(queued/generating 시 5s 자동 갱신 · router.refresh).
- **Admin 순차 작업 가이드** — `/admin/comic` Catalog "작업 순서"(① 큐 적재 → ② 드레인 생성 → ③ 검수 → ④ 발행) + 검수 콘솔 단계별 "이 단계에서 할 일" 문구.
- **맥락 속 어휘 학습(P2)** — 리더 `학습 단어` 칩 실동작: 정본 대사에서 `lookup_word_meaning`(RPC)로 레벨 검증한 학습가치 단어(v≥5)를 컷별 target_vocab에 배정(Carol 17컷·23단어 · humbug/haunt/toll/ignorance…). 칩 탭 → 팝오버에 **실제 뜻(meaning_ko)·품사·CEFR·예문 인라인** + **단어장 추가**(`addWordToVault` 서버액션, 멱등). Context-Dependent + Dual Coding 실현(기존 뜻 조회/추가 자산 재사용, 마이그레이션 무).

- 자기발전 만화 파이프라인을 정식 제품 통합(설계 → 이중 검토[교육학·아키텍처] → 구현). 상세: `scripts/comic/docs/COMIC_PIPELINE_DESIGN.md`.
- **DB**(마이그레이션 `20260808120000_comic_pipeline.sql` — **적용됨 2026-08-08**): `comic_books`(발행 게이트 헤더 + qc_verdict 지속) + `comic_pages`((library_book_id,chapter_idx,page_order) 자연키 · image_url 외부 URL · bubbles · target_vocab) + `book_curation_jobs.task_type='comic_gen'` + `panels_total/done` 컬럼 + RPC 5종(`enqueue_comic_jobs`·`admin_set_comic_published`·`select_book_comic`·`list_book_comic_catalog`·`book_comic_available` — 학습자 read 전부 published 게이트).
- **Admin** `/admin/comic` — Catalog(큐 적재) / Published(QC 게이트 강제 발행·회수). AdminSidebar 등재(BookImage). 드레인 `scripts/lcp/generate-comic.mjs`(plan/content/insert) + `drain.mjs` 🎞 등록.
- **Hub** `/text/[id]/comic` — TextViewer input 모드 "만화"(ModePills). Calm 2D 리더 + 대사 non-cover 대사존 + verbatim blur→reveal(회상) + 정본 정합 vocab 칩 + effortful 유입 CTA. RPC 미적용/미발행 시 EmptyState degrade.
- **Admin 파이프라인 완성** — `/admin/comic/[bookId]` 검수 콘솔: 단계 stepper(큐→생성→검수→게시) + QC 카드(panels_pass·정본불일치·규칙위반) + stave별 컷 전수 검수(그림+대사+정본✓) + 단계 제어(게시/회수/보관/복원/삭제/보완=재생성 큐). 삭제·보관은 RLS admin 서버액션 직접(마이그레이션 무).
- **리더 v2(딥서치 반영: Naver Webtoon·Kindle·Duolingo·MasterClass)** — 몰입 크롬 자동숨김+중앙 탭 토글+글래스(paper-blur) · **stave-dot 진행 레일**(gold ring·탭 점프) · 방향성 전환+엣지 rubber-band+Space키 · 대사 film-strip gold tie+화자 dot+라벨 · **Light/Dim 리딩 모드** · verbatim blur→reveal 유지 · reduced-motion 전면. 토큰만(신규 hex 0, gold=`--active`). ModePills "만화" gold underline.
- **QA 사이클(학습자·접근성·제3자·Admin 4관점 감사 → 수정)** — 마이그레이션 `20260808140000` **적용됨 2026-08-08**(전권 90컷·5 stave 레일·삭제 RPC 검증):
  - *구조*: 리더가 `select_book_comic_all`로 **도서 전권(전 챕터)** 로드 → stave-dot 레일 다중 dot + 챕터 연속(기존 1챕터만 로드해 레일 붕괴 결함). RPC 미적용 시 챕터 단위 폴백.
  - *접근성*: 포커스-인지 키 핸들러(컨트롤 포커스 시 슬라이드 조작 안 함) · vocab 실 모달(aria-modal·focus 이동·Esc·focus 복귀·Tab 트랩) · 숨은 크롬 focus 자동노출 + 'm'/Esc 토글 · `aria-live` 컷 안내 · 44px 히트영역 · gold CTA 고대비(#231a09) · 레일 shape 백업(완료/현재/남음) · reveal 마운트 유지+aria-pressed · ModePills reduced-motion.
  - *UX/연속성*: 크롬 컨트롤發 넘김은 크롬 유지(버튼 자기소멸 방지) · Dim 토큰 오버라이드(밝은 요소 누수 0) · 위치/Dim localStorage 영속 · 첫 진입 온보딩 힌트 · 긴 대사 스크롤 · 깨진 이미지 폴백 · 히어로 커버 병렬화.
  - *Admin*: `deriveStage` 순서(archived 우선)·중복조건 수정 · 발행본 보완 시 자동 미발행(enqueue 강등) · 원자적 삭제(`admin_delete_comic`)+버킷 정리 · 보관 시 잡 정리 · 발행/회수/보관 확인 다이얼로그 · 삭제 발행경고 · 보완 queued:0 경고 · QC 상세(불일치/위반 목록) · 보관 stepper 이력 보존.
- **라이브러리 히어로 카드** — `/library/books` 상단에 `ComicHeroCard`(MasterClass/Apple 히어로·Linear hover): 실제 첫 컷 아트 블리드 + paper 그라디언트 + 단일 gold CTA + hover lift/scale. `list_book_comic_catalog`(published)로 발견, enrollment 분기 route(등록→`/text/[id]/comic` · 미등록→도서 상세). RPC 미적용 시 graceful 생략.
- **P2 시드(2026-08-08)** — A Christmas Carol(book `66b084a0…`) 90컷 GONICK 실 발행: 공개 버킷 `comic/carol/sN/NN.jpg` 90컷 업로드 + `comic_pages` 90행 + `comic_books` published(panels_pass·QC 판정 지속) + 도서 ready→published. `select_book_comic` 5챕터×18컷 반환 검증. ⚠️ 이미지=full-res(~2.7MB/컷 · P3 압축 여지) · 공개 버킷은 발행본 전용(드래프트는 private+signed 재검토). 도서 발행은 dev 데모용(status→ready PATCH로 원복 가능).

### 신규 게임 — Wordfall Cadence (듣기 케이던스 · 청각 채널)

- 시장 딥서치 후속 — 아케이드에 **전무하던 "청각/듣기" 채널**을 메움(EchoMatch 코어 보완). 리듬 계열.
- **루프**: 영단어 발음(SpeechSynthesis TTS)을 듣고, 케이던스(제한시간) 다하기 전에 **4개 뜻 후보 중 정답을 고름**. 정답 속도 보너스·콤보·기회 3(♪), 난이도 램프. "다시 듣기" 지원. TTS 부재 시 안내 게이트, en 보이스 자동 선택. 동의어(ko 동일) distractor 제외.
- `WordfallCadenceGame` + `/play/wordfall-cadence` · gamekit 공용 + 접근성(aria-live·reduced-motion) + 스프링. 배선 + `module_id` enum 값 추가(마이그레이션 적용).

### 신규 게임 — Morphmerge (어족 합치기 · 형태론 채널)

- 시장 딥서치 후속 — 평가에서 드러난 **미개척 채널 "형태론/굴절"**을 메우는 머지 게임(2048/Merge 원형). 클라이언트 전용.
- **루프**: 보드의 단어 형태 타일 중 **같은 어족(같은 lemma의 굴절형: go/goes/went/gone)의 모든 형태를 골라 합치면** 어족 보석으로 수집. 혼합=오답(콤보 리셋), 부분=감점없이 안내. 90초 세션·콤보. **불규칙 활용 인지** 훈련.
- **데이터**: 스코프 단어의 `inflected` 형으로 어족 구성(4어족 이상이면 사용), 부족하면 불규칙 풍부한 기본 어족 12종. `MorphmergeGame` + `/play/morphmerge` · gamekit 공용 + 접근성(aria-pressed·aria-live·reduced-motion)·스프링. 배선: ArcadeGameId/ModuleId/ScoreModule/MARK/MUSIC_SRC/카드.

### 신규 게임 — Wordsmith's Vigil (타이핑 서바이버 · 생성 채널)

- **시장 딥서치**(세계 베스트 게임 + 학습앱 리텐션) 결론 반영 — 아케이드가 **재인 편중**이라 최대 학습 ROI인 **생성(타이핑)** 게임을 신설. 원형: Typing of the Dead × Vampire Survivors.
- **루프**: 뜻(ko)을 든 안개 정령이 촛불로 낙하 → 그 영단어를 **정확히 타이핑**(prefix 조준·완성 시 격파). 콤보·촛불 3개(놓치면 소진)·난이도 램프. 생성효과(직접 생성 회상 ~40%↑) + 철자 정밀. 스코프 단어(FSRS due) 시드.
- **구현**: `components/game/wordsmith-vigil/WordsmithVigilGame.tsx` + `/play/wordsmith-vigil` 라우트. gamekit 공용(AmbientBackground·GameDone·GameMusic·useSfx·ParticleBurst) + 접근성(실제 input=모바일 키보드·aria-live·reduced-motion) + 스프링/오디오 폴리시. `ArcadeGameId`·`ModuleId`·`ScoreModule`·MARK·MUSIC_SRC·아케이드 카드 배선.
- ✅ 점수/FSRS persistence: `module_id` enum 에 `wordsmith-vigil`·`morphmerge`·`wordfall-cadence` 3값 추가 마이그레이션 **적용 완료**(신규 3게임 저장 활성). 기존 14 아케이드는 등록돼 있었음.

### 아케이드 디자인 폴리시 레이어 — 감촉·모션 고급화(딥서치 상위안, 14게임 일괄)

- **스프링 이징 토큰** `--ease-spring`/`--ease-settle`(`gk-root`) — 진짜 오버슈트는 `linear()`(`@supports`), 미지원은 `cubic-bezier` 폴백. 타일·버튼 누름·리빌에 적용해 "저렴한 선형" 감촉 제거.
- **리빌 anticipation→overshoot→settle**: `gk-correct` 키프레임을 dip(.97)→overshoot(1.06)→settle 로 — 정답 순간이 "묵직하게" 안착. 14게임 공용.
- **reduced-motion = 페이드 대체**(제거만 아님): 정답/오답 피드백을 전정계 자극 없는 `gk-rm-fade` 잔잔한 페이드로 대체(접근성=폴리시).
- **윤리적 스트릭 — 하루 유예(freeze)**: `arcade-meta` 스트릭이 하루 건너뛰어도 0으로 하드 리셋하지 않고 보존(gap 2까지). 손실회피 압박 대신 "진행 보존"(Calm UI 정렬).
- (이미 반영) SFX 재생마다 피치/음량 지터 · 완료 폭죽 기본 OFF.

### 아케이드 14게임 전수 감사 — P0 버그·설계정확성·접근성 수정

- **전수 감사**(게임 3그룹 + 공유 kit 병렬 리뷰 + 디자인 딥서치)로 파일:라인 근거 수집 후 우선순위 수정.
- **공유 kit P0(전 게임 영향)**: ① `useGameMusic` 자동재생 리스너 cleanup 누락 → 음악 OFF 후 탭이 되살리던 버그·리스너 리크 수정(onRef 가드+cleanup). ② `awardArcadeXp`가 스캐폴드 완료 경로에 미배선 → 스트릭/XP가 대부분 게임에서 안 쌓이던 것 배선. ③ `GameDone` `celebrate` 기본 OFF(Calm UI "폭죽 금지" 준수 — 패배 시 폭죽 제거). ④ 음악 FAB `env(safe-area-inset)` + SFX 재생마다 피치·음량 지터(반복음 피로 제거). ⑤ 공유 에러 처리(취소 vs 실패 구분).
- **게임별 P0**: daily-blitz 스테일-클로저 타이머(런 전체 오염) → `answerRef`; letter-forge·cascade 길이/ko 필터 후 빈 풀 크래시 → `NotEnoughWords` 가드; cascade 무해결 보드 소프트락 → 자동 재셔플(`hasMove`/`settleSafe`); glyph-tongue 다크모드 룬 안보임(`#3B3050`→토큰) + 중복-ko 미해결 석실 → ko 중복 제거; word-economy 동의어 distractor 오답 → ko 제외.

### 아케이드 14게임 BGM — 게임별 무드 매칭 배경음악 (P0)

- **딥서치 분석 결론 적용**: 아케이드 14게임은 흥미(검증된 인디 원형 14종)·주스(공유 `gamekit`)·세션 중독성은 상위권이나 **BGM이 0/14**로 몰입의 최대 미개발 지렛대였음. 각 게임 무드(긴장·박진감·탐험·정적)에 맞는 **실제 큐레이션 BGM** 추가.
- **음원**: Kevin MacLeod(incompetech.com) **CC-BY 3.0** 14곡을 게임 무드별 매칭(Balatro=Bass Walker 워킹베이스 / Papers Please=An Upsetting Theme 심문 / Outer Wilds=Awaiting Return 심우주 / The Witness=Airship Serenity 명상 등). ffmpeg로 90초 루프 세그먼트+페이드 경량화(~1MB/곡, 총 17MB). `public/audio/games/*.mp3` + `CREDITS.txt`, 아케이드 푸터 저작자 표기.
- **실오디오 시스템** (`gamekit.tsx` `useGameMusic`/`GameMusic`/`MUSIC_SRC`): 합성음 아닌 `HTMLAudioElement` — 게임별 트랙·루프·페이드 인/아웃·**기본 OFF**(연구: 개인차+언어학습 무가사 저자극)·`localStorage` 기억·SFX/TTS 덕킹·자동재생 차단 폴백(다음 제스처 시작)·접근성(aria-pressed·44px). 14게임에 `<GameMusic gameId>` 1줄 배선.
- **효과음 실샘플 교체 (P1)**: `useSfx`가 합성 오실레이터 → **CC0 실제 샘플**(Kenney "Interface Sounds"/"Music Jingles", CC0 1.0 무저작권, `public/audio/sfx/` 6종 132KB) Web Audio 버퍼 저지연 재생으로 격상. 콤보는 `playbackRate` 상승, 로드 전/실패 시에만 합성 폴백(무음 방지). API 불변 → 14게임 코드 변경 0. correct/wrong/combo/click/coin/complete.
- **리텐션 메타 — 데일리 스트릭·XP·오늘의 목표 (P2)**: `lib/game/arcade-meta.ts`(localStorage, DB 무변경) — 연속 플레이 일수 스트릭 + 누적 XP·레벨(√곡선) + 데일리 목표(30 XP). 게임 완료 단일 지점 `useRecordGameScore`에서 `awardArcadeXp`(미로그인도 동작). 아케이드 허브 상단 `ArcadeMetaStrip`(SSR 안전 클라이언트)로 🔥연속일·Lv 진행바·오늘의 목표 노출 → 재방문(스트릭)·성장(XP)·오늘의 목표로 중독성 강화(가변보상 원리).
- **결과 공유 카드 (P3)**: 공유 `GameDone`에 "결과 공유" 버튼 — 완료 메시지+주요 스탯+🔥연속일을 조합해 **모바일 `navigator.share` / 그 외 클립보드 복사**(Wordle식 바이럴). 클라이언트 전용·DB 무변경, 14게임 코드 변경 0(공유 컴포넌트 한 곳). 리더보드(서버 집계)는 마이그레이션 필요로 후속 승인 대상.

### 만화화 파이프라인 — 무료 Qwen 백엔드 + 만화/웹툰 이중 렌더 + 표시크기 해상도 설계

- **무료 이미지 백엔드 = Qwen-Image-Edit (Alibaba DashScope)** — `scripts/comic/gen-qwen.mjs` 신설. 신규가입 100장 무료(90일·카드불필요·싱가포르 Intl)로 캐릭터 identity 잠금이 되는 유일한 실용 무료 경로(딥서치 결론). 2단계: `qwen-image-max`(캐릭터 시트 t2i) → `qwen-image-edit-max`(패널 편집). Nano Banana Pro 무료 API는 부재(limit:0 실측), Pollinations FLUX는 identity 없음 → 기각. 대안 어댑터 `gen-openai.mjs`·`gen-nanobanana.mjs`도 정비(유료).
- **Carol Stave 1 무료 실증 (18/18 ship)**: 생성→Vision-QC(3에이전트)→결함 6종 식별→프롬프트 보완→재생성→재-QC 완결 루프. Qwen 특유 결함 대응을 어댑터에 상수화: HARDBW(색단어 강제흑백)·BLANK(빈 종이)·solo/no-dup·솔리드 잉크·씬 메타접두사 strip·**t2i `--noref` 폴백**(클로즈업 시트누출+의상오버라이드 회피, 정규식 자동 라우팅). `qc-defects-carol.json` section1 재검사(low 6 accepted-limit).
- **스크립트 생성기 백엔드-중립화** (`01-script.mjs`): scene에 art-style/색단어/메타 금지, 단일주체/패널, 패널별 `size`(full/half/third)·`noref` 지정 지침 추가 → 런타임 패치 없이 Qwen 네이티브.
- **표시크기 기반 해상도 + 폰 하한**: 만화책 페이지-그리드는 패널당 표시크기가 작고 가변 → 역할 티어(full 1024×768/half 704×939/third 640×853). <768px 리플로우 시 폰 풀폭이 되므로 flat 라인아트 ~1.6× DPI 하한 적용. 균일 대비 저비용 + 폰 크리스프.
- **이중 레이아웃 렌더러** (`03-assemble.mjs --layout comic|webtoon`, 딥서치 최적안): CSS Grid 12칼럼 + 숫자 span, **tier(행) 원자적 = Z-path 보장**, DOM순서=읽기순서, <768px 세로 리플로우(Webtoon), 강조배분(페이지당 full≤1), 워드카운트 role 승급, orphan 행채움, 테마변수, `loading=lazy`. `--external` 웹배포 모드(HTML 3.8MB→18KB + img/ 분리). 한 소스 → 만화책/웹툰 동시 산출.
- **텍스트 구성 3-보이스(레터링 크래프트 딥서치 최적안)**: 텍스트를 그림 위가 아니라 **밴드**에 배치(AI 아트는 여백 미보장 → 가림 0, 데스크톱·폰 공통). 모양으로 목소리 구분(색맹 안전): **나레이션**=틴트 라운드사각 캡션(위)·**대사**=라운드사각 말풍선(아래)·**원문인용**=세리프+좌측 인용바+양피지+"— 저자"(책의 목소리). 교육·원문충실 → 문장case, 강조 italic/bold-italic, 폰 하한 반응형 타이포(clamp). 만화 데스크톱 오버레이 폐기 → 밴드 통일.

### 만화화 파이프라인 — 최종 인수 게이트 (final-audit) + Frankenstein 1~10장

- **`scripts/comic/final-audit.mjs` 신설**: 전권 완료 시 실행하는 SHIP/NO-SHIP 인수 게이트. 완결성(4 Letter + 24 Chapter = 28섹션)·GATE-1 verbatim 실검·이미지 GATE-2·원문반영 밴드(≥25%)·인지부하(말풍선 ≤4)·캐스트 연속성(bible appears_in)·9.5 QC 원장(`qc-scores.json`)을 종합해 우선순위 remediation 큐 + 단일 판정 산출. `--remediate`로 appears_in 자동 정합.
- **`scripts/comic/qc-scores.json` 신설**: 챕터별 비전-QC 원장(floor + 패널별 status: remediated/accepted-limit/open). open 이 하나라도 있으면 SHIP 차단, 문서화된 무료 FLUX 천장(accepted-limit)은 경고로만 노출.
- **Frankenstein 3~10장 완성 + 5·6·7장 성숙톤 재정렬**: 전 챕터 mature 그래픽노블 잉크 + Elizabeth 금발 단일 땋은머리 캐논 통일. Victor·Creature·Elizabeth·Alphonse 1→10장 교차 일관(연속성 remediation 0). 전 챕터 원문반영 25.0~26.5%.

### 잔여 근본분해 + 아포스트로피 생략 추출 필터 (카테고리 2·3)

- **잔여 정밀 재분류**(162권, 3,092 lemma): OCR 아님(SE 손교정) 재확인 — ① 작가 의도 비표준(방언·조어·후렴) + ② 추출 파편(하이픈/아포스트로피 분해) + ③ 진짜 희귀·전문어. Wiktionary 전수조회로 en 712/foreign 422/부재 1,958 실측.
- **카테고리 2-Ⓑ 아포스트로피 생략 필터 (근본, 채택)**: winkNLP가 방언 생략 아포스트로피(`foun'`·`hadn'`·`doin'`·`wukkin'`)를 별도 punctuation 으로 떼어내 어간만 남기던 것을, **word 토큰 뒤 홑 아포스트로피 glued + 비-s어미** 판정으로 제외. `extract-lemmas.ts` + 3 빌더 동기화. 소유격(`cat's`=PART·`dogs'`=s어미)·`o'clock`·복합어(`self-control`→control) **전부 안전**(실단어 손실 0). 잔여 −262 occ.
- **카테고리 2-Ⓐ 하이픈 분해 (기각·pivot)**: 실측상 `self-control`→control·`flat-footedly`→footedly 등 실단어가 하이픈에 glued 되어 인접성만으로 안전 제거 불가 + PROPN 태그 불신(`Ten-teh`=NUM). 사전 없이는 근본 수정 불가 → not_found 무해 잔존으로 유지(사전 오염 0).
- **카테고리 3M 형태소 (기각)**: 복합어 자동분해 정밀도 부정 실측 — `cameleopard→came+leopard`(실제 기린), `flaysome→flay+some`, `granfarther→gran+farther` 등 **희귀어에 틀린 뜻** 부여. 수율도 미미(2홉 124·접두사 209·복합어 313 occ). → 위험 형태소 폐기, 진짜 희귀어는 3R로 흡수.
- **카테고리 3R-Ⓒ 자기치유 (게이트+적재+자동배선 완료)**: LLM 뜻 생성 0 — Wiktionary 정의→Google 번역만.
  - **코어** `dict-selfheal-core.mjs`: Wiktionary 영어섹션+register 게이트(eye-dialect/misspelling 거부, plural/alt-form/"See X" 리다이렉트 2단 추적, `nocat` 등 템플릿 잔여 정리) + Google 번역 + `koQualityOk`(본문 미번역 라틴어 차단). gate/drain 공유.
  - **② 게이트 정제** `dict-selfheal-gate.mjs`: 잔여 379 후보 → **55 통과(순수 50/243 occ + 방언 5), 오역 0** (coinage/외국어 312 영어섹션 부재로 정확 거부). 빈글로스 "See" prose 추적으로 tuckshop/sansculottism 회수.
  - **① 적재** `dict-selfheal-load.mjs`: 순수 50 → `lexicon_clean`(ko_source=`wikt-selfheal`) 적재. RPC 검증: pedicellariae·foretopmast·kinematograph·seignorage·avicularium·tuckshop 전부 `coverage-clean` 티어 해소 확인(루프 폐합).
  - **③ 자동 배선** `dict-selfheal-drain.mjs`: LCP ingest 가 미해소어를 쌓는 `archaic_candidates`(collect_archaic_candidates)를 소스로 게이트→`lexicon_clean` 자동 적재(멱등, 배치 캡, 기존적재 제외). **핫패스 밖 드레인**이라 외부 조회가 ingest 를 안 막음. 스모크: 984 임계통과→876 기존제외→4 신규 적재. 크론/Claude Code 드레인으로 주기 실행 → 사전 자가성장(반복 수작업 제거).
  - 형태소 자동분해(3M)는 `cameleopard→came+leopard`(기린) 등 정밀도 부정으로 기각 — 진짜 희귀어의 정확한 뜻은 외부 소스(3R)에 있음.

### 큐레이션 "소스 GET" 목록 일반화 테스트 (시드 카탈로그 미테스트 162권)

- **소스 전환**: Standard Ebooks 실 카탈로그 최신 774권 4라운드 전량 소진(SKIP=800→0권) 확인. 이후 큐레이션 "소스 GET(대량)" 목록 `library_seed_catalog`(ingest 전 소스 후보)로 테스트 지속 — SE 항목 **1,450권**(내 최신-리스팅 크롤 774와 **겹침 0** = 더 오래된 스냅샷). crawl774 ∪ prev110 제외 → **미테스트 SE 748권 풀** 확보.
- **신규 코퍼스**: 시드 카탈로그 미테스트 SE **162권** 빌드(230 후보 중 SE single-page 부재 68 실패) — 48,019 distinct lemma · **4,954,841 등장**. 프로덕션 동일 winkNLP 추출(`build-test-corpus-seedlist.mts`).
- **플랫폼 베이스라인(캐스케이드 前) = 99.863%** 등장가중 해소 — 401–600(99.846%)·601–800(99.916%) 범위 재현 → **완전 미학습·다른 스냅샷 도서에서도 방법 일반화 확인**. 경로: direct 96.63% + inflection 1.58% + coverage-clean 1.27% + derivation/spelling/normalized/dialect/suggestion 등.
- **잔여 3,092 lemma / 6,789 등장(0.137%)** — 79.7%(5,410 occ) 단일책 idiosyncratic. 유형: SF/판타지 조어(Burroughs Barsoom/Pellucidar: jeddak·therns·banths·kaldane·zitidar·padwar) + 네덜란드어 인라인(jongejuffrouw·mejuffrouw·molens) + eye-dialect(cunjuh←conjure·sezee←says he·wukkin·ernudder — Douglass/Remus) + OCR 파편(teh·hadn·foun) + 소수 실단어(pedicellariae 해부학·finneskoe 순록가죽신). = 사전 환원불가(조어·외래·방언) 성격 전 라운드와 동일.
- **부수 정리**: eval `extraction_test_vocab` 에 이전 라운드 823권 vocab 누적(빌더 REST-DELETE 대용량 부분실패)이 발견돼 고아 제거 → 162권/800,239행 정합. 임시테이블·스크래치 전량 정리.

### 근본 방안 심층 검토 + 추출 파편 수정 (books 601–800)

- **일반화 재확인**: books 601–800(0 겹침) 플랫폼 베이스라인 **99.916%** — 401–600(99.846%)보다 높음. 누적 사전(실영어 6,700+·방언 3,128+·recovery)이 **미관찰 코퍼스에 강하게 일반화**(방법은 일반화, 데이터는 per-corpus) 실증.
- **포괄 사전(R1) 실측 기각**: Webster 1913 PD 87k 표제어 포괄사전화 시도 → 잔여 커버 **2.9%(517 occ)** + Google MT 희귀어 ~15% 오역 → **한계효용 ~0**(누적 사전이 이미 포괄 역할). `webster-comprehensive.mjs`(참고 보존, 미적재).
- **근본 3분해**: 잔여 = R1(사전공백·이미 해소) + R2(정규화공백·LLM없인 ~85% 상한) + R3(비-단어). R3의 다수는 SF/펄프 발명어휘(뜻 없음)·고유명사(NER 대상)·파편(토크나이저 대상).
- **추출 파편 수정(권장안)**: winkNLP 하이픈 분해로 발생하는 중첩복합어 파편(`brac`←bric-a-brac 41책·`shilly`←shilly-shally 27책·`scarum`←harum-scarum 20책·`toity`·`jongg`·`lutely`←abso-blooming-lutely 등) 37종을 `extract-lemmas` TOKEN_BLOCKLIST + eval 동기화 추가. 601–800 잔여 −215 occ(99.916→99.917%). **정밀도 리스크 0**(비-어휘 제거) + **모든 책 영구 적용**.
- **결론**: 99.917%(미관찰)는 정밀도 유지 실질 바닥. 남은 ~85%는 발명어휘(환원불가), 나머지 방안은 소규모 추출단 정제 or 정밀도 희생 or LLM 재도입.
- **5단계 캐스케이드 601–800 적용**: 면밀 분류(en 10.8%·foreign 17.1%·absent 67.3%) 후 전체 캐스케이드 실행 — ①플랫폼 ②Wiktionary ③Google(en=Webster정의문·foreign=언어별) ④Claude 18병렬(en 1,201 gloss·foreign 89·방언 1,044) ⑤recovery 12병렬(409). 잔여 17,586→**13,200 등장**, 토큰 99.916→**99.937%**. absent 대다수·recovery 수율 ~6%(401–600 19%보다 낮음)로 이 코퍼스가 SF/펄프 조어 지배 재확인. `r8-*.mjs`.


### 새 200권 일반화 테스트 + 4단계 캐스케이드 (방법 일반화 실증)

- **일반화 테스트**: 튜닝 코퍼스(books 201–400)와 **0 겹침**인 새 200권(books 401–600, 17.7M 토큰) 추출. 플랫폼(사전DB+로직)만으로 **99.846%** — 오버핏 아닌 강건한 일반화 확인. 격차(vs 99.922%)의 정체 = rare word 데이터 전이 한계(thews·anodynic류 저 코퍼스에 없던 단어).
- **4단계 캐스케이드**(사용자 지정 프로세스): ① 플랫폼(실 RPC 전수) → ② 외부소스(Wiktionary 멤버십 분류: en 4,420·foreign 2,318·absent 8,997) → ③ Google(무료: en=Webster PD 정의문 번역 2,965 draft·foreign=올바른 소스언어 직역) → ④ Claude 28병렬(정밀 교정·검증·정규화).
- **적재**: en gloss 4,376(lexicon_clean wikt-claude, Google/Webster draft 교정) + foreign 700(la 중심 문맥검증) + 방언 1,782(spelling_norm). 총 6,858 신규 해소.
- **효과**: 새 코퍼스 잔여 27,211→**15,238 등장**, 토큰 99.846→**99.914%** — 튜닝 코퍼스(99.922%)에 근접 → **캐스케이드 방법이 임의 미관찰 도서를 ~99.91%로 수렴시킴을 실증**. thews→근육·anodynic→통증완화·pleeceman→policeman·gilikopter→helicopter 정확 해소, magter·klangan(SF조어) not_found 유지.
- 파이프라인 스크립트: `fresh-residual-build.mjs`(REST RPC 전수 판정)·`fresh-dump-resid.mjs`·`fresh-classify.mjs`·`fresh-google.mjs`·`fresh-route.mjs`.
- **Stage ⑤ recovery pass**: "환원불가"로 거부된 8,953을 재검토 — (a) 외국어 오분류된 영어 방언 정규화(orses→horse·worl→world), (b) 정규화 불가하나 **직접 글로싱 가능한 실단어**(진짜 방언·고어·확실한 외국어 차용어) 판정. Claude 14병렬 → norm 1,165 + gloss 864 = **2,029 회수**(~19%). muckle→많은/큰(스코틀랜드)·horosho→좋아(러시아어)·bandarillas→반데리야(스페인어)·eftesoones→곧이어(고어)·wazeer→vizier. 새 코퍼스 잔여 15,238→**11,526 등장**, 토큰 99.914→**99.935%**(튜닝 코퍼스 초과). `fresh-recover-load.mjs`. 남은 11,526은 SF조어·가공 고유명사·Joyce 조어·순수 nonce = 진짜 바닥.

### Wiktionary 멤버십 판별기 + 실영어 gap-fill (잔여 −3,149 등장)

- **"Google보다 큰 어휘" 시스템 = Wiktionary(kaikki)**: 영어 ~1.3M 표제어 + 1000+ 언어. 잔여 9,659 전량을 en.wiktionary API(50-title 배치)로 분류 — **English 1,542 / 외국어 1,410(Latin 290·Italian·French…) / 부재 5,581**.
- **판별기 통찰**: 잔여 다수는 "희귀 실단어"가 아니라 조어(Ulysses/SF)·오철자·고유명사 → Wiktionary조차 부재. 하지만 **1,542개는 실영어**(Google·Webster가 놓친 narghileh·byrny·dickty·netherstocks·praties·stengah…)로 판명.
- **W-1 실영어 gap-fill**: Wiktionary 멤버십(사실)로 실영어 확정 → Claude 8병렬로 문맥 기반 ko 생성(정의문 미사용, 자체 생성) → `lexicon_clean` **1,429** 적재(ko_source=wikt-claude·gloss_source=wiktionary-membership). `scripts/dict/wikt-classify.mjs`·`wikt-route-export.mjs`·`wikt-en-load.mjs`.
- **효과**: 잔여 15,730→**12,581 등장**, 토큰 99.869→**99.895%**. 정밀 검증: narghileh→물담배·dickty→거들먹거리는 상류층 행세(흑인 속어)·stengah→위스키 소다(말레이)·praties→감자(아일랜드) 전부 coverage-clean 정확.
- **W-2 부재 정규화**: Wiktionary 부재 5,581을 Claude 12병렬 문맥 정규화 — 오철자/방언만 표준어 매핑(cockodrill→crocodile·stumicks→stomach·perliceman→policeman·roomatism→rheumatism·saxohpone→saxophone·wictim→victim), 조어·고유명사·외국어 거부. 확정 1,461 → `spelling_norm(curated-dialect)`(누적 3,128). 잔여 12,581→**10,690 등장**, 토큰 99.895→**99.911%**.
- **W-3 외국어 라벨링+번역**: foreign 1,410을 Claude 6병렬 **문맥 검증** — 진짜 외국어 인용만 번역+언어태그, 우연일치(magter=Danish?·menzil=Turkish?·balu=Basque? = 실은 SF/정글북 조어) 거부. 확정 **513** → `lexicon_clean`(lang별: la 281·fr 80·it 63·sco 38·de 16·es 15·… · ko_source=foreign-claude). salutamus→경의를 표하다(la)·putana→창녀(it, wlang Albanian 오류 교정). 잔여 10,690→**9,992 등장**, 토큰 99.911→**99.917%**.
- `WordLookupPopover` LANG_META 8→28 언어 확장(pt·el·ru·da·sv·no·fi·ga·cy·gd·gl·eu·af·cs·pl·hu·is·enm·ang·sco + xx 일반) — 팝오버 국기+언어명 표시.
- **W-4 미분류 사각지대 재처리**: Wiktionary API 에러로 미분류였던 1,786(freq≤2) 재분류 → en 271·foreign 203·absent 1,032. Claude 8병렬(2 gap-fill+4 정규화+2 외국어검증): 실영어 267 gloss·방언 316·외국어 84 확정. neffew→nephew·conwulsions→convulsion·halbatrosses→albatross·unneth→간신히. 잔여 9,992→**9,308 등장**, 토큰 99.917→**99.922%**. `scripts/dict/wikt-reclass.mjs`.
- 약어 `rm` blocklist 추가(프로덕션+eval). Wiktionary 사용은 CC BY-SA 사실(멤버십·언어태그)만 — [DATA_ATTRIBUTION.md](DATA_ATTRIBUTION.md).

### 잔여 유형별 정밀 분해 + 3레버 해소 (Webster PD·방언확정·약어필터)

- **유형별 분해**: 새 200권 잔여 20,145 등장을 배타적 버킷 분류 — F(3+책)1,853·G(2책)2,390·C(약어)883·hapax(1책)14,973. dmetaphone 앵커 태그: lev1 4,468·lev2 4,012·앵커없음 11,665(가공 고유명사·nonce·외국어=환원불가). **잔여는 표준 고어가 아니라 방언 표음철자+가공 고유명사가 지배**임을 실증.
- **Method A(약어 필터)**: 프로덕션 `extract-lemmas.ts` TOKEN_BLOCKLIST에 안전 약어 8종(yd·yds·yr·hr·hrs·mos·pts·doz) 추가 + eval 코퍼스 blocklist 프로덕션 동기화. acct·dept·wks 등은 이미 프로덕션 필터됨 → eval 잔여의 약어 393 등장은 측정 아티팩트로 확정.
- **Method C(Webster 1913 PD)**: 잔여∩Webster 65 lemma/127 등장 — **정의문을 Google 번역**(희귀 표면형 오역 회피). `lexicon_clean` 적재(ko_source=webster-mt·gloss_source=webster). 퍼블릭 도메인 = 완전 청정. `scripts/dict/webster-build.mjs`·`webster-load.mjs`.
- **Method B(방언/오철자 확정 — 주 레버)**: dmetaphone 앵커 후보를 **Claude 서브에이전트 8병렬**로 확정/교정(naive 앵커 ~55% 오답을 독립 판단: prau→pray✗ 배·collige→college✓·strate→straight✓·tundher→thunder·cawfy→coffee·dreffle→dreadful). 정밀 우선(모호·고유명사·외국어·함수어 reject).
  - lev1(4,468 등장) → 확정 815 lemma/1,730 등장
  - lev2(4,012 등장) → 확정 654 lemma/1,208 등장 (8병렬 2차)
  - **앵커없음 다중책+고빈도 hapax(3,411 등장) → 오픈형 문맥 패스**: dmetaphone이 못 잡은 방언(chilluns→child·laigs→leg·diffrunts→different·tomorrer→tomorrow·figgered→figure) + 복합어(indiarubber→rubber) — first_sentence 문맥 제공, Claude 6병렬. 확정 198 lemma/991 등장. `scripts/dict/ctx-export.mjs`
  - 합계 **1,679 lemma/3,929 등장** → `spelling_norm(curated-dialect)`. `scripts/dict/anchor-export.mjs`(TABLE/OUTDIR env)·`anchor-load.mjs`.
- **효과**: 잔여 20,145→**15,730 등장**, 토큰 99.832→**99.869%**. 남은 앵커없음 hapax(가공세계 고유명사·nonce·외국어 인라인)는 환원불가 확정 — 제안모드+not_found가 정답.

### 음성 제안모드 검토 + 고빈도 잔여 확정 해소 승격

- **제안모드 검토**: tier10 dmetaphone+lev≤1. 정밀 무작위 ~85%(오철자·eye-dialect 정확), 고빈도 ~60%(고유명사·외국어 혼입). "혹시 X?(추정)" 프레이밍이 오답 무해화 → 설계 적정, 큰 변경 불요. lev2 확장은 금지(45%).
- **소폭 개선(확정 승격)** `20260724170000`: 고빈도 정착방언·오철자 47종을 spelling_norm/dialect_map에 확정 추가(제안→정식 해소). probily→probably·hawss→horse·wessel→vessel·diffrunt→different·doan→do·tommorow→tomorrow. 고유명사/SF조어/외국어/약어 제외.
- **효과**: 제안모드는 커버리지 미포함(추정)이나, 확정 승격은 **+47 lemma/1,021 등장** 실제 해소 증가. 토큰 ~99.822→99.830%.

### hapax 사전갭 확장 — Claude 서브에이전트 8병렬 교정 (2,345)

- **스케일 방법**: hapax(1권) 실단어 3,372개 → Google baseline → **Claude 서브에이전트 8개 병렬 교정**(배치당 ~420). 인라인 교정(books>=2 380개)을 대량 확장.
- **교정 품질**: 각 서브에이전트가 전수 검수 — 부정접두 뒤집기(unwintry→겨울답지 않은·unabased→기죽지 않은), 동음이의(windingsheet→수의·floodtide→밀물·cloudbank→구름 둑), 음역 복원(reddleman→붉은염료 행상인·tulwar→인도 곡도), 복합어(woodswallow→숲제비·witchhazel→풍년화). 방언/외국어/nonce ~1,027 제외.
- **적재**: lexicon_clean lang=en **2,345**(ko_source=claude-batch). 누적 실단어갭 2,725(+이전 380). `scripts/dict/gap-fill3.mjs`·`gap3-load.mjs`.
- **효과**: 잔여 −4,465 등장, 토큰 99.786→**~99.822%**. 정밀 ~97%(전수 Claude 교정).

### 실단어 사전갭 채움 — Google baseline + Claude Code 배치 교정

- **2단계 최적 방법**: 잔여 실단어(복합·고어·파생, 2+권) 437개 → ① Google en→ko baseline(무료) → ② **Claude Code 배치 교정**(전수 검수).
- **교정 내역**: Google 오역 164건 수정(unostentatiously→겸손하게[가식적으로 반대뜻]·bestrewn→흩뿌려진·scatheless→무사한·tirewoman→시녀·stockstill→꼼짝없이) + 방언/외국어/nonce 54건 제외(ahint·asthore·bagnet·dickty) + Google 정답 216 검증.
- **적재**: lexicon_clean lang=en **380**(ko_source=claude-corrected/verified). 잔여 −1,412 등장. 토큰 ~99.798%. `scripts/dict/gap-fill2*.mjs`.
- **정밀**: 전수 Claude 검수라 ~98%+(이전 Google-only gap-fill 60% 롤백과 대비 — 교정으로 정밀 확보).

### 잔여 "비단어" 재규명 + 복합어 분해 시도·롤백 (정밀 우선)

- **"비단어" 오라벨 교정**: 클린 Standard Ebooks인데 "비단어 48%"는 모순. 조사 결과 **대부분 실단어** — dwyl(370k) 미수록 복합어(diningroom·postoffice)·고어(meseemeth·yclept)·파생(unostentatiously)·방언·고유명사. OCR nonce 아님.
- **복합어 분해 시도**: 비하이픈 복합어 head 해소(diningroom→room). 정밀 2중 게이트(기능어/접미사 head 제외 + 단일단어 음성근접=오철자 제외 → contrack→contract는 suggestion으로). 정밀 40%→~75%.
- **롤백**: 여전히 부분뜻 단정 + 25% 오분해(cartonnage→tonnage·pigling→ling·bargun→gun). **정밀 바 미달**(gap-fill 60%·하이픈 정밀수정과 동일 기준) → 복합어 tier 롤백. "틀린 뜻 단정 > not_found" 원칙.
- **성과 유지**: ① 비단어=실단어 규명(향후 방향) ② 오철자→suggestion 리다이렉트 확인 ③ Cockney h-탈락 규칙(아래, clean).

### 일반화 테스트 (새 200권) + Cockney h-탈락 규칙

- **일반화 테스트**: 기존 200권 삭제 → **미관찰 새 200권**(Forster·Herbert·Kropotkin·Saltus 등, 1,200만 토큰) 재추출. `build-test-corpus.mts` SKIP/CLEAR 추가.
- **결과**: 토큰 해소 **99.785%**(원래 99.80% 대비 −0.015pp) → **과적합 아님, 강한 일반화**. 세션 tier들 동일 비율 기여(외국어는 오히려 13,028등장으로 더 해소 — 다국어 사전이 미관찰 외국어 커버 실증). 근본 아키텍처(생성엔진+포괄 외부소스)가 관찰 아닌 원리 기반임을 확증.
- **새 잔여 분석**: 구성 원래와 동일(비단어 48%·음성 lev1 19%·영어 16%·lev2 15%). 미착수 외국어(nl/pt/ru/pl) 확인 → 오탐뿐(추출 ^[a-z] 필터로 키릴/그리스 이미 제외).
- **★ 새 방안 발견 — Cockney h-탈락** `20260724160000`: 새 코퍼스에서 ead→head·elp→help·orrible→horrible·usband→husband 체계적 패턴 발견. surface_variants에 'h'||s 규칙. 정밀(실단어 direct 우선, and·old·ear 무회귀). +60 lemma/186 등장, 생성적(미관찰 Cockney 일반화).

### 라틴어 사전 — UD treebank 표면형 (마지막 clean 잔여 방안)

- **동기**: 잔여 최정밀 분석에서 유일한 미착수 clean 후보 = 라틴(198+ 등장). "lemmatizer 필요" 장벽을 ① Google 굴절 표면형 직접번역(aeternitatis→영원의) ② UD treebank 실제 표면형 소스 — 두 가지로 우회.
- **소스**: Universal Dependencies Latin(PROIEL/ITTB/Perseus/LLCT) **47,391 표면형**(실제 라틴 텍스트 굴절형, 공개데이터·표면형=사실). `scripts/dict/latin-build.mjs`.
- **적재**: Google sl=la → `lexicon_clean` lang='la' **42,342**(영어 충돌 skip). 기존 foreign tier·🏛️ 배지 재사용, 코드/마이그레이션 0.
- **검증**: aeternitatis→영원의·rerum→사물의·gentium→국가·virtutis→미덕의·genuit→낳았다·fratres→형제. 영어 우선(동형이의어 안전).
- **효과**: 잔여 +295 lemma/388 등장(UD 표면형이 Whitaker stem 23%보다 우수). 토큰 해소 → **~99.81%**. 외국어 사전 총 ~186k(fr/it/de/es/la). 출처표기 DATA_ATTRIBUTION.md.

### 심층 정밀도 분석 — 하이픈 복합어 오해소 수정 (품질축)

- **동기**: 커버리지(99.8%)에 이어 **해소 정밀도(false positive)** 미검증축 분석. 비핵심 tier 표본 검수.
- **발견**: spelling(MorphAdorner+Wiktionary) ~95%·derivation ~90% 정밀 양호. **norm(surface_variants 하이픈) 27% 오해소** — re-embodied→"re"·over-hot→"over"·un-policeman-like→"like"·counter-will→"will"(조동사) 등 **접두사/기능어 세그먼트를 취해 틀린 뜻**. 규모 323 lemma/393 등장.
- **수정** `20260724140000`: surface_variants 하이픈 세그먼트에 **blocklist(접두사·기능어 44종) 필터** → head 세그먼트 또는 정직한 not_found. "틀린 뜻 > not_found" 원칙.
- **결과**: 오해소 **323→7(98% 수정)**. 1,154 정답 전환(re-embodied→embody·over-hot→hot), 14 not_found(counter-will·un-policeman-like). 커버리지 손실 미미, 품질 대폭 개선.
- **교훈**: 커버리지 극대화가 정밀도를 잠식할 수 있음 → 공격적 tier는 정밀 검수 필수.

### Wiktionary 방언 매핑 — heavy dialect 해소 (CC BY-SA, 사실 쌍만)

- **동기**: 200권 잔여의 최대 미해소 = 작가 방언(nuthin·chillun·wuz·nevah). MorphAdorner(5k)가 못 잡은 tail을 Wiktionary 포괄 방언으로 보완.
- **라이선스 준수**: Wiktionary(CC BY-SA)에서 **variant→standard '사실 쌍'만** 추출(gloss/정의문 미추출). 뜻은 전적으로 자체 사전에서 해소 → 배포물에 CC BY-SA 창작물 0. **BY 출처표기** `docs/DATA_ATTRIBUTION.md` 신설. (사용자 승인: 완화구성+BY 유지.)
- **추출/적재**: `wiktionary-dialect-extract.mjs`(kaikki 2.6GB gz 스트림 필터, 82,669 매핑 중 방언태그) → `wiktionary-dialect-load.mjs`(pronunciation-spelling·eye-dialect·dialectal·nonstandard·colloquial·contraction·informal, alternative/archaic 66k 노이즈 제외) → `spelling_norm` source='wiktionary' **3,506**.
- **정밀 3중 보호**: ①tier 순서(실단어 direct 우선 — of·year·free 무회귀) ②표준형 사전해소 게이트 ③노이즈 태그 제외. 검증: nuthin→아무것도·chillun→아이들·wuz→was·nevah→never·befo→before·stummick→위.
- **효과**(200권): 토큰 해소 → **~99.80%**(spelling tier 4,515→5,455 등장). 잔여 heavy dialect 대폭 해소.

### 음성 제안모드 + 독일·스페인어 — 잔여 추가 대응

- **음성 제안모드** `20260724120000`+`121000`: `lookup_word_meaning` suggestion tier(10) + `dmetaphone` 함수인덱스. not_found 직전 dmetaphone∧lev≤1(86% 정밀) → **단정 아닌 "혹시 X?"**(match_via='suggestion'). realy→really·suport→support·salery→salary. UI `SuggestionBody`("🔍 혹시 이 단어? 추정 — 문맥 확인"). **커버리지 미포함**(독해 툴팁 전용, 추출/큐레이션 무영향) → 사전 신뢰 유지. 잔여 phon_lev1 ~2,533 등장 독해 보조.
- **독일어·스페인어** (foreign-dict-build LANG_CODE=de/es): hermitdave + Google → lexicon_clean lang='de'(35,469)·'es'(34,633). behandlung→치료·betteln→구걸하다. 동형이의어(gift·war·hat) 영어 우선 안전. 잔여 +178 lemma/430 등장. 외국어 사전 총 ~144k(fr/it/de/es).
- **200권 재측정**: 토큰 해소 → **99.782%**. 잔여 ~12,970 등장(0.22%) = 무거운 방언(Lardner·McKay 반열린)+라틴(표면소스 필요)+nonce(환원불가). 자동해소는 정밀 벽 → 제안모드/라벨이 정직한 처리.

### 외국어 확장 — 이탈리아어 사전 (French 파이프라인 복제)

- **동기**: 200권 평가 이탈리아어 잔여 289 lemma/617 등장 → French 선제형 방식 그대로 복제.
- **적재**: hermitdave it_50k(표면형) + Google sl=it → `lexicon_clean` lang='it' **36,015**(영어 충돌 자동 skip). `scripts/dict/foreign-dict-build.mjs` 재사용(LANG_CODE=it). 코드/마이그레이션 변경 0 — 기존 foreign tier·lang 배지(🇮🇹) 재사용.
- **검증**: contadina→농부·fanciulla→소녀·malinconia→우울·cantare→노래하다. pain 영어 유지(동형이의어 안전).
- **효과**: 잔여 +289 lemma/617 등장, 토큰 ~99.767%. 핵심: Google가 라틴 굴절 표면형도 정확 번역 → 모던어(it/de/es) 즉시 확장 가능. **라틴 보류**(표면 wordlist 소스 미확보). 설계 `foreign-language-reading-support.md` §9.

### 잔여 유형별 대응 — 부정축약·비운음·재귀 -ingly (+1,338 등장)

- **잔여 정밀 분해**(200권): opaque 3,738/phon 2,477/fragment 632/gen 279 lemma. 최대 미발견 패턴 = **부정축약**(아포스트로피 탈락) 17형 1,134 등장(dident 335·wouldent 254·wasent 241).
- **① 부정축약 맵** `20260723161000`: dialect_map에 dident→did·wouldent→would·couldna→could 등 38형. 표준형=조동사 base(부정 소실 note). 실단어 wont은 direct 우선(무회귀).
- **② 비운음 -ah→-er** + **③ 재귀 -ingly→base** `20260723160000`: surface_variants. nevah→never·bettah→better·comprehendingly→comprehend·shiningly→shine. hurrah/lovingly 무회귀.
- **효과**: +67 lemma/1,338 등장, 토큰 99.734→**99.757%**, 잔여 등장 −8.5%. 분석 `coverage-root-architecture.md`.
- 잔여 대응 우선순위: 나머지(phon_lev2 45%정밀·gen_prefix 뜻역전·외국어·nonce)는 자동해소 보류 → 음성 제안모드/라벨 세분화가 정직한 처리.

### MorphAdorner 철자정규화 tier — 퍼미시브 방언 사전 (301k)

- **외부 소스**: MorphAdorner(Northwestern, **NCSA 퍼미시브·상업배포 OK**) 철자맵 → `spelling_norm`(variant→standard) **301,501** 적재(EME 297k+19c소설 NCF 4k). 출처 github.com/travisbrown/morphadorner. 조사 근거: VARD/kaikki/음성 배제(coverage-root-architecture.md §10).
- **마이그레이션** `20260723150000`(spelling_norm 테이블)+`151000`(lookup_word_meaning spelling tier). 적재 `scripts/dict/spelling-norm-load.mjs`.
- **tier 7.6**: variant→standard 후 **표준형이 분류사전에 해소될 때만** 반환(정밀 100% 게이트, 음성 45%와 대비). match_via='spelling'. 검증: accordynge→according·afther→after·abaht→about·furriners→foreigner. 회귀 0.
- **효과**(200권): +643 lemma/2,602 등장, 토큰 99.690→**99.734%**, 잔여 등장 −14%. 핵심가치=301k가 **미관찰 방언 텍스트 일반화**(dialect_map 밴드에이드 승격).
- **약어 추출필터**: extract-lemmas TOKEN_BLOCKLIST에 acct·dept·yrs·wks·cts 등 추가(학습단어 아님).
- **UI**: WordLookupPopover match_via='spelling' → "🗣 방언·옛 철자 — 표준어 'X'". tsc 통과(web·library-pipeline).

### 방언·고어 해소 tier — 단어추출 잔여 -27% (200권 평가 기반)

- **`-in→-ing` 정규화** `20260723130000`: surface_variants 확대(g 탈락 방언). nothin→nothing·lookin→looking → normalized tier 소비. 회귀 0(basin/coin은 direct 우선). 218 lemma·2,796 등장.
- **eye-dialect 맵** `20260723131000`+`132000`: `dialect_map`(74 entry, 방언/고어→표준 lemma) + `lookup_word_meaning` dialect tier(coverage 뒤·normalized 앞). gwine→가다·brung→가져오다·drownded→익사하다·dunno→알다·twould·methought. 표준형 68/74 해소.
- **방언 UI** WordLookupPopover: match_via='dialect' → "🗣 방언·고어 — 표준어 '{원형}'로 이해" 안내. tsc 통과.
- **효과**(199권 재측정): 토큰 해소 99.57%→**99.689%**, 잔여 등장 25,438→**18,510(-27%)**, 잔여 lemma 8,720→7,823. 근거 `extraction-evaluation-2026-07-23.md` §9.

### 단어추출 대규모 평가 — Standard Ebooks 199권 (토큰 99.57% 해소)

- **인프라**: `scripts/dict/build-test-corpus.mts`(Standard Ebooks 손교정 클린 고전 single-page → HTML strip → 프로덕션 winkNLP 추출 재사용) + `extraction_test_books/vocab`(프로덕션 분리) + `measure-test-corpus.sql`(해소율 측정).
- **규모**: 199권 · 5,948,640 토큰 · 고유 lemma 53,617. 난이도 고전(Kipling·Shaw·Heyer·SF·정치/역사).
- **해소율**: **토큰 가중 99.57%**(독해 체감) · 도서×lemma 98.73% · 고유 lemma 83.7%. 15권(98.8%)과 일치, 대규모·OCR無 클린에서 목표 초과.
- **진짜 잔여 8,720 정체**(OCR 손상 0 → 순수 신호): ≥10권 체계적갭 48(~85% 방언) · hapax 7,803(85%). 최고 ROI 단일개선 = **`-in→-ing` 정규화**(218 lemma·2,796 등장·67권). 다음 = eye-dialect 큐레이션 맵(tis·gwine·twould). hapax는 장기꼬리 보류.
- 평가서 `docs/proposals/extraction-evaluation-2026-07-23.md` §8.

### 선제형 외국어 독해 지원 — French 사전 DB 선(先)적재 (Google식)

- **패러다임**: 도서에서 외국어를 뽑는 반응형 ❌ → **외국어 빈도 사전을 미리 `lexicon_clean`에 적재**하는 선제형 ✅. 이후 어떤 입력(도서·스크립트)이 와도 이미 준비된 외국어를 단어추출 시 해소. 설계 `docs/proposals/foreign-language-reading-support.md`(rev2).
- **스키마**: `lexicon_clean.lang`(default 'en') + partial index(`lang<>'en'`). 영어 256k 무변경, 외국어만 격리 조회.
- **소스·청정성**: hermitdave FrequencyWords(OpenSubtitles) 프랑스어 **표면형** 빈도목록(=사실 데이터) + **Google 무료 번역**(sl=fr, LLM·비용 0). 외부 사전의 gloss는 **미사용** → 배포 청정. `ko_source='google-mt-fr'`.
- **적재**(`scripts/dict/foreign-dict-build.mjs`): fr 50k 목록 → Google 배치번역(15/요청, 재개캐시) → **ignore-duplicates 적재**(영어 표제어 절대 미변경 = 동형이의어 영어 우선). **French 37,955 적재**(영어 충돌 ~11k skip). 검증: son/pain/chat/de → 영어 유지, faute/toujours/vous → 프랑스어.
- **런타임 해소**: 감지 로직 0 — `lookup_word_meaning` tier 6(coverage-clean)이 meaning_ko 매칭으로 외국어 자동 해소. 검증: `faute→결점`·`toujours→항상`·`pain→통증`(영어 우선).
- **언어 배지** `20260723120000_lookup_word_meaning_lang`: `lookup_word_meaning` RETURNS 에 `lang` 추가(영어 tier='en'·lexicon_clean tier=lc.lang, DROP+CREATE·하위호환). WordLookupPopover 에 🇫🇷 언어 배지 + 안내("독해 이해용, 영어 암기 대상 아님") + 발음 로케일(fr-FR 등). reader-queries `WordLookup.lang` 노출. 검증: faute/toujours→fr·pain/happy→en, tsc 통과.
- **효과 실측**: 레미제라블 잔여 665 → **308 프랑스어 해소(46.3%)**. 잔여 54%는 위고 19세기 파리 은어(argot: bastringue·bousingot)·OCR잡음·라틴조각·고유명사 → **정당한 잔여**(현대 빈도목록·노이즈필터 밖).
- **라틴/그리스 데이터 기반 폐기**: 라틴 실측 — Roman+Dialogues 잔여 ~290 중 실제 라틴 32%, Whitaker(stem) 매칭 23%(굴절형 미매칭) → 실효 해소 **7.5%**. 그리스 — 추출 `^[a-z]` 필터로 그리스문자 토큰 애초에 배제(잔여≈0). → **French 단독 확정**. 라틴 정식 지원은 CLTK lemmatizer 통합 별도 프로젝트.

### 청정 lexicon_clean 구축 — kaikki(CC BY-SA) 대체 착수

- **동기**: coverage_lexicon 은 gloss_en 전량 kaikki(CC BY-SA), meaning_ko 도 그 번역(파생물). 배포 대비 청정화. 설계 `docs/proposals/lexicon-coverage-clean-architecture.md`.
- **원칙**: 런타임 100% DB(LLM 오프라인) · kaikki 전량 배제 · L0(단어목록)+L2(WordNet/Webster 정의)+LLM 뜻 계층.
- **실측 근거**: 퍼미시브 정의 커버 = 우선순위 78k 중 **37%**(WordNet∪Webster). Tier1(kaikki뜻=clean뜻 일치) 한국어 재사용 가능분 ~12k.
- **마이그레이션** `20260722120000_create_lexicon_clean`: word PK · gloss_en · meaning_ko · ipa · gloss_source · ko_source · is_valid_word.
- **구축**(`scripts/dict/lexicon-build.mjs`): WordNet 정의 추출 + Webster 1913 정제(노이즈/고어/단일sense) → 통합 청정 gloss **206,498**(WordNet 147,981 + Webster 58,517) 적재 + CMUdict ipa 38,243 + **Tier1 한국어 9,568 검증 재귀속**(ko_source=verified). kaikki 0.
- **런타임 RPC** `20260722130000_lookup_lexicon_clean_rpc`: `lookup_lexicon_clean(text)` — direct+굴절(en_inflection_bases) 해소, 청정 gloss/meaning/ipa 반환. L1(shared_dictionary) 미스 시 L2 폴백. authenticated/anon grant.
- **성능 벤치**(실측): 2000단어 배치 ~0.8ms/단어. L2(lexicon_clean) 전부 캐시히트로 빠름 → **런타임 DB-only 설계 검증**. L1 bloat(shared_dictionary 힙 50% free·480 캐시미스/2000)는 VACUUM FULL로 개선 필요(성능 정당화).
- **런타임 체인 연결** `20260722140000`: `lookup_word_meaning` 에 lexicon_clean(청정) 우선 tier 6·8 삽입, coverage_lexicon(kaikki) tier 7·9 는 **브리지로 유지**(무regression). 순서 L1(1-5)→청정 한국어(6)→kaikki 한국어(7)→청정 영어(8)→kaikki 영어(9). 검증: happy=direct·take-up=coverage-clean·ural=coverage(브리지)·aardwolf=coverage-clean_en. LLM 한국어 채워질수록 coverage→coverage-clean 자동 이동. (기존 발견: coverage tier 는 이미 구현돼 있었고 return 에 gloss_en 컬럼 존재.)
- **Step 5 한국어 채움(A-min)**: 실사용 대상 19,217(coverage 등장 ∩ lexicon_clean) → **Google 무료 번역 엔드포인트** 자동 번역(동시성4·재시도) → **19,214 성공(실패3·비용0)**. `ko_source='googletrans'`. lexicon_clean meaning_ko **9,568→28,782**. 검증: pesthole/trailhead/parkland → 읽기 체인이 coverage-clean(청정)으로 서빙(kaikki 브리지보다 우선).
- **tail 전량 한국어 완주**: lexicon_clean 나머지 ~177k 도 Google 무료 번역(줄바꿈 **배치 20/요청** 로 ~20배 가속) → **한국어 206,391 / 206,498 = 99.9%**(잔여 107=분류학 학명 무시). ko_source googletrans 196,823. 비용 0.
- **가치분 통합 + 읽기 kaikki 제거** `20260722150000`: coverage 등장 단어 중 저작권 없는 요소(**word+pos+LLM 한국어**만, gloss_en·예문 제외)를 lexicon_clean 통합(49,619, ko_source=coverage-llm) → lexicon_clean **256,117**(한국어 256,010). `lookup_word_meaning` 에서 coverage_lexicon(kaikki) tier 제거 → **학습자 읽기 경로 kaikki-free**. 검증: happy=direct·a-flutter/a-level/gleba=coverage-clean·xyzzyq=not_found.
- **coverage_lexicon(kaikki) 완전 폐기** `20260722160000`·`170000`: 참조 함수 4종(select_article_coverage·select_book_chapter_coverage·select_coverage_for_words·select_extraction_residual) → lexicon_clean repoint(테이블명 교체+source필터 제거) → 앱/함수 참조 0 확인 → **coverage_lexicon DROP**(CC BY-SA 원문 제거 + ~78MB 회수). 검증: 폐기 후 읽기 체인 정상(a-flutter/a-level/gleba=coverage-clean, 404 확인).
- **✅ kaikki(CC BY-SA) 제거 완료**: shared_dictionary(관계 WordNet 교체) + coverage_lexicon(폐기, 가치분 lexicon_clean 통합) + 읽기 체인(lexicon_clean 256k 청정).
- **kaikki 흔적/관련성 제거 (원칙: 가치·저작권무관 값은 유지, kaikki 관련성만 제거)**: 발음 사실 데이터(ipa 36,793·rhyme_key 28,989·homophones 5,224)는 저작권 없는 사실이라 **값 유지**(purge했던 것 백업 복원). `field_provenance` 의 kaikki 관련 태그(`kaikki-unverified` 등) **전량 제거 → 0**. 저작권 원문(gloss_en·예문)은 coverage_lexicon 폐기로 제거 완료.
- **L0 노이즈 필터(고유명사) 착수**: WordNet lexname(location 15·person 18) 기반 정밀 고유명사 식별 5,143(지명·인명 단일어, 오검출 0) → lexicon_clean `is_valid_word=false` 플래그. 읽기 조회는 미영향(lookup_word_meaning은 is_valid_word 미체크 → 고유명사도 resolve), 추출/커버리지 curation에서 선택 제외용.
- **단어추출 해소율 개선 — 표면형 정규화** `20260722180000`: `surface_variants()` helper(de-하이픈·접두복합·소유격) + `lookup_word_meaning` tier 8-9(정규화). de-하이픈 전체형 우선. 검증: be-cause→because·help-less→helpless·non-religious→religious·sister's→sister.
- **17권 재평가(강화)**: 해소율 94.7~100%(평균~98%) → 강화 후 잔여 대폭 감소(Sociology 406→232·Ozma 91→52·Tom 77→56·Pride 92→69). 잔여 4대 유형: ①학술복합어(개선중) ②OCR하이픈(해소) ③고유명사·소유격(부분해소) ④방언·외국어(수용).
- **잔여(선택)**: 파생접미사 확대(-ized/-ization/-ist) · OCR 오타교정(catologue) · coverage 첫-synset 오선택 개선 · L0 소비 · VACUUM FULL.

### shared_dictionary kaikki → WordNet 선별적 교체 (라이선스·노이즈 청정)

- **동기**: kaikki(Wiktionary, **CC BY-SA** share-alike) 유래 컬럼이 상업화 시 copyleft 리스크 + 노이즈(`bisexy`·`BUG`·`lesbigaytrans`·`"I'm bisexual"`). WordNet 3.1(Princeton License — 퍼미시브·share-alike 없음)로 교체.
- **마이그레이션** `20260720120000_shared_dictionary_field_provenance`: `field_provenance JSONB` + gin 인덱스 — 필드별 출처 추적(근본원인=행단위 source라 필드 출처 부재).
- **파이프라인** `scripts/dict/wordnet-enrich.mjs`(WNDB flat file 파싱·무의존성·재시도+동시성8): extract(117,791 synset→145,967 lemma) + apply-all 필드별 정책.
- **필드별 정책(설계 `docs/proposals/wordnet-replacement-design.md`)**: related_terms·derived_forms=**교체+잔여purge**(kaikki 전용) · synonyms=**교체+잔여flag**(혼합) · example_en=**빈칸만**(시드 예문 보존) · antonyms=**병합+denoise**(WordNet 희소).
- **실적용**(40,304행 stamp·실패0): related_terms 11,529→**28,582**(WordNet·+17k) · derived_forms **14,313**(잔여 7,691 purge) · synonyms WordNet 25,723+flag 11,255 · antonyms denoise 3,415(볼륨 23,667 유지) · example_en 시드 보존+183 보강.
- **Phase 2 (CMUdict)**: ipa/homophones/rhyme_key = CMU Pronouncing Dict(PD/BSD·무제한)로 교체. `scripts/dict/cmudict-enrich.mjs`(ARPAbet→IPA 변환·rhyme·동음이의). 적용(실패0): ipa CMU 25,522+kaikki flag 11,067 · rhyme_key 20,451(잔여 3,264 purge) · homophones 3,732(잔여 1,203 purge). rhyme_key 값이 kaikki와 다수 일치(검증).
- **잔여 정리**: synonyms `kaikki-unverified` 잔여 11,255 **purge 완료**(남은 synonyms 27,013 전부 WordNet·CC BY-SA 0). ipa 잔여 11,067은 발음 핵심 기능이라 유지(추후 G2P 무손실 교체 예정, field_provenance 로 식별).

### 굴절형·파생형 학습 구조 — ADR 0001 Phase 6 개정 착수 (v06.273)
- **배경/결정**: "학습자에게 불규칙 굴절형(went·children·better)·파생형을 그 형태의 뜻 그대로 학습시킨다". ADR 0001 D1(굴절=별도 row 안 함)을 **부분 개정** — 전면 반전(모든 굴절형 row화, +15,714 규칙형 중복)이 아니라 **불규칙+어휘화만**(attested·bounded) 등록, 규칙형(walked·cats)은 통합 유지(D2 attested 게이트 준수). 근거 [ADR 0001](adr/0001-dictionary-derivational-enrichment.md).
- **A — `base_word` 전수 채움**: 굴절 헤드워드 역인덱스 + 파생 candidates 병합으로 base 관계 채움(`scripts/dict/base-word-backfill.mjs`, 멱등·NULL만). 굴절 162 + 검증 candidates 121 반영. "went ← go" 관계 정보 확보.
- **B PoC — 불규칙 굴절형 15개 헤드워드화**(said·knew·took·gave·seen·brought·built·understood·children·men·feet·teeth…): 뜻 authoring(과거형/과거분사/복수형 명시) + base_word/pos/v_level 상속. **검증**: `resolve_dict_headword('children')→children`·`said→said`(그 자체 추출) vs `walked→walk`(규칙형 통합 유지). B 전체 대상 = 불규칙 **487**(정제: 자음중복/영국식 규칙형 제외).
- **스키마**(migration `20260718000000`): `shared_dictionary.source` CHECK 에 `'inflection-seed'` 추가(파생 `derivational-seed` 와 대칭 provenance, 추적/롤백용). classified_by=기존 `claude_code_opus_4_8`.
- **잔여**: B 스케일업(472 authoring·homograph led/meant 교정) · A2 파생 base_word 광역(happiness/national류 형태소 detection) · C 전용 학습 세트(불규칙 동사표) + 추출카드 base 배지.

### DB 용량 정리 — 미출시 도서 16권 삭제 (v06.272)
- **원인 규명**: 어드민 "게시됨"(`status='published'`) ≠ hub 노출. hub(`/library/books`)는 `status='published' AND copyright_safe_in_kr AND published_at IS NOT NULL` 3조건을 모두 요구 — `published_at`은 정식 publish RPC만 찍고, `status='published'`는 챕터 단어장 발행 트리거(`ready→published`) 메커니즘으로도 쓰여 `published_at` 없이 올라간 도서가 섞임. 결과: 게시됨 23권 중 **hub 노출 7권 · 숨김 16권**.
- **삭제**(사용자 승인): `published_at` NULL 16권 삭제. 정본 `admin_delete_book` 시맨틱 재현(RPC는 published 거부 → 동일 데이터 연산 트랜잭션). 단 texts는 `chk_content_or_library`로 unlink 불가(library 타입) → **DELETE**로 처리. CASCADE: `library_book_vocabularies` 63,863 · `library_chapter_quiz` 1,251 · `library_chapters_master` 627 · `shared_word_sets` 626(+하위 `shared_words`) · `book_curation_jobs` 11. seed 14개 `imported_to_books=false` unlock 복귀.
- **결과**: 도서 28→12권, hub 7권 정상 유지. 콘텐츠 5테이블 `VACUUM FULL` 152→47 MB(−105 MB OS 반환). DB 총량 500→~470 MB. 전체 DB VACUUM FULL은 안전 분류기 차단(수동 실행 필요).

### 콘텐츠 품질 게이트 — 파이프라인 정확성 자동 검증 (v06.271)
- **목적 재정의**: "기능이 되나"(UI 테스트) 아니라 **"학습자에게 나갈 산출물이 맞는 단어·맞는 뜻·맞는 레벨로 정확히 뽑혔나"**를 결정론 불변식으로 검증 → 관리자 게시 신뢰. 실패=사전DB/파이프라인 수정 신호.
- **갭 실측**: `quality_metrics`(nightly) 7지표는 전부 **부피·완비율**이고 정확성 검사 0. P0 결함(반의어 바인딩·gated KICE)은 전부 수동 발견 — 자동으로 아무것도 안 잡힘.
- **F 즉시 수정** `content_quality_gate_fixes_F`(사용자 승인): **I7** 발행 세트 노이즈-register junk **9건 제거**(xl/mph/bc/cl/ft — 학습자 노출 중이던 약어) + word_count 재동기 + **F.2** 발행도서 resolvable NULL lemma 백필(→0, 학습자 출력 무변).
- **G1 게이트 함수** `run_content_quality_gates(scope, id)`: scope=global|book|article|dict 별 불변식 pass/fail. 사전DB(I1 필드완비·I2 per-sense v_level) · 단어추출(I5 바인딩드리프트·I7 노이즈) · LCP(I6 resolvable lemma·I8 book_v_level·**I10 발행세트 SSoT 드리프트**) · ACP(I9 register). critical FAIL=게시 차단 후보.
- **발견**: 전역 게이트 critical 전부 PASS(F 후). **도서 게이트가 P&P 발행세트 SSoT 드리프트 770 검출** — D1/D4a 개선이 select 출력을 바꿔 발행 콘텐츠가 stale(재발행 필요). 추출 로직 개선→발행 stale 이 처음으로 가시화.
- **G3 화면** `/admin/quality/gates`: 전역 게이트 red/green + 요약 배너(allGreen=게시 신뢰) + 콘텐츠별 게시전 체크(도서/아티클 선택→book|article scope). AdminSidebar '품질 게이트'(ShieldCheck).
- **G4 nightly cron** `content-gate-nightly`(KST 03:25): `collect_content_gate_metrics` → `quality_metrics(stage='gate')` 적재로 추이 추적. `admin_collect_content_gate_metrics` 수동 트리거. **→ 파이프라인 정확성 상시 자동 감시**.
- **G2 게시 게이트 wire**: `content_gate_publishable(scope,id)`(critical FAIL 있으면 false, I10 드리프트 제외) → `publish_book_word_sets`·`publish_article_word_set`·`republish_*` 에 가드. broken 콘텐츠 게시 차단.
- **드리프트 재발행 완료**: `republish_book_word_sets`·`republish_article_word_set`(set_id 보존, shared_words만 교체 — 구독/진행 안전) → 전 발행 도서 20권 + 아티클 135세트 SSoT 재동기. **I10 드리프트 전량 해소**(P&P 770→0 등). D1/D4a 개선이 학습자 단어장에 반영됨. I10 미발행 false-fail 수정.
- **최종 상태**: 전역 게이트 critical(I1·I5·I7·I8·I9) 전부 PASS · 도서 I10 PASS · I2만 WARN 343. 파이프라인 정확성 상시 자동 감시 + 게시 전 차단 + 게시 후 재발행 루프 완성.

### 콘텐츠 품질 게이트 — ACP+VCB 커버 + LCP end-to-end 실증 (v06.271)
- **LCP end-to-end 실증**: 소스 GET(queued) "Ozma of Oz" → `reprocess-book.mjs --commit`(ingest 21ch/38k → 추출 2,785 → v7/B1) → ready → 게이트 전부 PASS → G2 publishable=true. 게이트가 실제 큐레이션 흐름의 관문으로 작동 확인.
- **ACP 커버** (`gate_acp_vcb_coverage`): article scope + 전역에 **I11 항목단위 라이선스**(copyright_safe_in_kr) 추가. NASA ready 아티클 게시전 체크 PASS.
- **VCB 커버**: 전역 I5/I7 을 **전 발행 세트**로 broaden(library 외 큐레이션 세트 41개 포함) + **`word_set` scope** 신설(I5·I7·뜻결측·비어있음). 확장 즉시 VCB '중등 기본어휘'의 "technic"(archaic) 검출 → `vcb_noise_cleanup` 로 전 발행 세트 노이즈 일반 정리.
- **게이트 게시전 체크에 미발행 노출**: `/admin/quality/gates` 드롭다운 published+ready+queued(소스 GET → 추출 후 게시 전 검증).


### 추출 품질 심층 평가 P0 + 표제어 바인딩 결함 수리 (v06.270)
- **P0 정찰**(read-only, `docs/AI_CONTEXT/diagnostics/ext_quality_p0_20260718.md`): 추출 품질 5속성(Q1~Q5) 분해 + 3 프로브(P&P ch18·Black hole 아티클·register 집계) 실측. Q2/Q5 3분해(in-cap/out-of-cap/gated) 결정론 산출 확인 · working set = **20,678 lemma** · freq_rank 30%(6,204) 결측 = 사전 유일 실질 갭(그중 KICE 238) · Phase B per-sense v_level 백로그 사실상 종결(전역 343·ws 68).
- **🔴 신규 결함 발견·수리 — 표제어 바인딩**: `select_*_vocab` 가 pre-stem 된 `bv.lemma`(파생/부정접두 과잉 축약)를 그대로 바인딩 → 학습자에게 **반대 뜻** 노출(`imprudent→prudent` 신중한 · `insincere→진심의` · `forbearance→조상,선조`). 발행 콘텐츠 **782 오바인딩·654 POS 불일치·36 반의어 플립** 실측. 기존 "Q1 100% 검증(40,355 표제어)" 미커버 축(표제어 아닌 표면→표제어 바인딩).
- **마이그레이션** `fix_extraction_surface_headword_binding`(사용자 승인): `select_book_chapter_vocab`·`select_article_vocab` JOIN 한 줄 — 표면형이 자체 quality 표제어이면 그것으로 바인딩(아니면 현행 resolver 폴백). dry-run 검증 = 782 재바인딩·**+143 회수 개선**·extraction-readiness 실패 0·gate-out 17 전량 비-KICE 정당. **발행 세트 영향 0**(현행 학습자 데이터 clean → 재발행 불요). `bv.lemma` 원본 데이터는 무수정(SSoT가 오버라이드 — 대량 재생성 금지 원칙 준수).
- **마이그레이션** `create_extraction_judgments_table`(사용자 승인): 판정 하네스(Q3/Q5) 골든 라벨 저장소. composite/sort_order 스냅샷 보존 → 가중 변경 회귀 대조. RLS enabled(정책은 D3 하네스 착수 시 admin grant).
- **D3 판정 하네스** `/admin/quality/judge` — 추출 "탁월함"(cap 40 최적성)을 인간 blind 판정으로 축적하는 골든 라벨 UI. 마이그레이션 `judgment_harness_rpcs`: `get_judgment_sample`(in-cap 8 + 경계 8 셔플·출처 은닉) + `save_extraction_judgment`(저장 시점 SSoT 재조회로 스냅샷 서버-권위 기록 → blind 보존·회귀 대조) + `extraction_judgments` RLS `ej_admin_all`. 절대 판정 + 쌍대 비교 모드, 제출 후 precision/recall reveal. AdminSidebar '추출 판정'(Scale). typecheck 0·lint clean·RPC 로직 실데이터 검증(표본 16=8+8). 런타임 UI 스모크는 admin 세션 필요 → 후속(전용 e2e spec 권장).
- **D4a KICE freq_rank proxy 백필** — migration `backfill_kice_freq_rank_proxy`: KICE-core(수능 tier≥3) NULL freq_rank **273행**을 proxy rank(밴드 실측 중앙값 135 + KICE 중앙값 1986 = 138)으로 채움. `frequency_sources.proxy` provenance 마킹. efficiency·innovation·precision·prioritize 등 CSAT 빈출어가 composite 0.40 freq축 0점→~0.12 → 추출 순위 정상화. **핵심 재발견**: 추출가능(v≥6) working set의 freq_rank NULL 28.7%(4,648) 중 backfillable은 46뿐 — 나머지 4,602는 **무신호 rare tail(NULL이 정당, 결함 아님)**. 설계의 "freq_rank가 사전 최대 갭" 은 완비율로는 맞으나 추출 영향분은 대부분 **축소 불가**(D4b 외부corpus 없이는).
- **다음(승인 대기)**: D5 V6 게이트 register-인식화(논의) · D4b 외부 corpus(rare tail — 저우선).

### 커버리지 사전 — 비학습 롱테일 독해 대응 (v06.271)
- **문제**: 도서·스크립트에 코어 45k 밖 롱테일(고어·희귀·전문)이 등장 → 학습자 독해 시 "정의 없음". 학습 큐레이션과 독해 커버리지는 다른 요구.
- **설계**: `coverage_lexicon` **별도 테이블**(shared_dictionary 무변경·학습 무오염). 마이그 `create_coverage_lexicon`. `word·pos·gloss_en·ipa·meaning_ko·frequency_rank·source·seen_count`. 2-tier: 학습=core만 / 독해=core→coverage→미상 폴백.
- **벌크 적재**: kaikki 단일어·content POS·실 gloss·**form_of(굴절) 제외**·코어 밖 → **424,328행**(gloss_en+ipa, meaning_ko는 demand 채움). `coverage-bulk-load.mjs`.
- **검증**: 도서 잔여어 커버 — 미커버는 90%+ 굴절형(추출이 코어 lemma로 해소)+OCR잡음. 진짜 희귀어는 커버. 굴절 해소 후 실질 커버리지 높음.
- **소스 분석**: kaikki 한국어 번역 25,736(흔한 단어 편중·tail 무용) · PanLex 4.31GB(불확실 payoff·보류). → 한국어는 **콘텐츠 등장 잔여만 LLM 배치**(bounded), gloss_en 즉시 폴백. 설계 근거=`docs/AI_CONTEXT/diagnostics/kaikki_upgrade_opportunities_20260718.md` 계열.
- **한국어 빈도순 tier 완주**: hermitdave OpenSubtitles(165만) 랭크순으로 Opus 배치 번역 → **meaning_ko 77,501행**(빈도순 잔여 1·미랭크 극희귀 327k만 대기). `coverage-translate-{chunk,apply}.mjs`. 게이트=한글 필수(영어 echo 거부)·멱등·`--prune`(스킵 잡음 source='skip'). **english_echo 0**. ⚠️ 모델 교훈: 이 gloss→한국어 작업은 품질 민감 → **Opus 필수·Haiku 부적합**([[project_coverage_lexicon]] 실증: 약 모델 워커 다수가 영어 gloss 복사).
- **잔여**: RPC 폴백(lookup_word_meaning)+is_learning_target(select_*_vocab) · UI 2섹션 · 미랭크 tail(327k, 설계상 대기).

### kaikki C — per-sense 예문 매칭 (v06.270)
- **진짜 per-sense**: 다의어 각 한국어 sense에 kaikki 실용 예문을 매칭(판단=LLM). 도구 `example-match-{chunk,apply}.mjs`. grounding 게이트: 예문은 제공 풀에서 **verbatim만**(편집·창작 거부=ungrounded-ex)·meaning 매칭·pos/v_level 보존.
- **결과**: **5,111단어 · 9,645 sense-예문** 부착(meanings_ko sense별 `example`). `groan`=[신음]let out a groan·[툴툴]We groaned at his awful jokes·[삐걱]The table groaned under the weight 식 sense별 정확 매칭. 억지 금지(풀에 뜻 없으면 생략).
- **청크 크기 교훈**: 240단어 청크가 최고빈도 구간(am·be 등 10+sense)에서 **출력 64k 토큰 초과**로 실패 → 그 구간만 60단어 재분할(exmatch-hi)로 해소. 저빈도는 240 무방. 세션 한도 걸린 1청크는 메인 세션이 직접 매칭.
- **정직**: 멀티세션 지시문 만들었으나 실행은 소규모라 단일 세션 넓은 웨이브가 효율적(세션 수는 작업량÷머신 동시성으로, 습관적 6 지양).

### kaikki 보완 #4·#5 — 관계 컬럼 + 예문/동의어 (v06.269)
- **마이그레이션** `add_kaikki_extra_columns`: `homophones`·`rhyme_key`·`derived_forms`·`related_terms` 4컬럼 신설(사용자 승인).
- **1회 스트림 추출**(`kaikki-extra-{extract,apply}.mjs`, 멀티세션보다 빠름 — 추출은 I/O 병목이라 병렬 무의미): homophones 2,687·rhyme_key 16,042·derived_forms 19,548·related_terms 11,223 채움. + example_en 결측 752 채움(96.8%) + synonyms 보강(64.5→**76.4%**). 전부 kaikki 외부사실=무환각·결측만.
- **교훈**: (1) `Object.create(null)` 필수 — "constructor"·"toString" 실제 영단어가 프로토타입 오염 유발. (2) 45k 맵 `JSON.stringify` 512MB 한계 → JSONL 스트림 기록.
- **per-sense 예문(C) 잔여**: 영어 예문↔한국어 sense 매칭은 판단 필요(단일 스트림 불가) → 별도 LLM 패스 옵션. 현 pass는 word-level 예문/동의어까지.

### 어원 니모닉 확대 M3 — kaikki etymology_text 근거 6세션 병렬 (v06.268)
- **배경**: 니모닉 6.5%(2,618) 정체 — M2는 어근 인벤토리(181개) 근거라 그 밖 어근은 skip. kaikki `etymology_text`(83.3%)는 단어별 권위 근거라 인벤토리 한계 해소.
- **경선식(발음 소리흉내) 차단 = 근거 대조 게이트**: 지시만으론 약함 → `mnemonic-etym-apply.mjs`가 (1)화살표 필수 (2)로마자 어근 필수(순수 한글=경선식 거부) (3)어근이 etymology_text에 실제 등장(diacritic strip + 어간 4글자 매칭으로 굴절변이 흡수). 자체테스트: `advocate→ad(voc)` 통과 / `애들 보고 캣` 거부.
- **파이프라인**(`mnemonic-etym-{chunk,apply}.mjs`): 미니모닉 v≥7·rank≤12k 5,935 → 고전어 3,486 → 30청크 → 6세션×5청크 격리 병렬. authoring 프롬프트에 경선식 정의(애들·보고·캣) + skip 규칙.
- **결과**: **2,433 적용**(pass 2,433·거부 41=1.7% 진짜 엣지). 니모닉 **2,618→5,062**(커버 11.08%). **경선식 유입 0**(pure_hangul_pun_suspect: 0·화살표 100% 검증).
- **게이트 튜닝 교훈**: 초기 게이트가 매크론 어근(vās·prō)·영어 접미사(-ist)·한국어 괄호설명(일(공화국))을 오거부(452) → 유니코드 추출+어간매칭+"근거 어근 ≥1이면 통과"로 41까지 축소, 336+ 복구. 지시문 SSoT=`docs/AI_CONTEXT/handoffs/mnemonic_etym_multisession_20260718.md`.

### sense 깊이 확대 — kaikki 근거 다의어 완성 1차 슬라이스 (v06.266)
- **배경**: 추출 사전DB 최대 갭 = sense 깊이(avg 1.28 vs 일반사전 3~5+). 얕음(≤2)+kaikki풍부(≥3) 단어 **19,549**(노출 freq≤8k **5,995**). 추출 시 드문/지배 sense 결측으로 오해소.
- **파이프라인**(신규 `kaikki-sense-chunk.mjs`·`kaikki-sense-apply.mjs`): kaikki JSONL 재스트림 → 대상 단어 표준 sense(gloss+pos, obsolete/rare/**형태포인터**(Abbreviation/plural of…) 제외·leaf gloss·**굴절형/길이<3 제외**) → 청크. 서브에이전트가 현 한국어 sense + kaikki 영어 gloss를 **근거로** 완전한 meanings_ko(한국어·per-sense pos/v_level, most-common-first, 과분할 통합, cap 5) authoring. apply=meanings_ko 교체+flat 동기화, **sense 추가만(손실 방지 가드)**.
- **1차 슬라이스(freq≤3000, 800단어)**: 5청크 → **315단어 enriched**(39%, 0 reject). **퇴화 엔트리 근본 교정**: `add`(ADHD 약어만→더하다/추가하다) · `will`(→모달 ~할 것이다) · `act`(ACT약어→행동/연기/막/법령) · `stop`·`single`·`policy`(→보험증권)·`light`(빛/조명/가벼운/옅은/신호등) 등. 자가생성 아닌 **외부 사전 근거=무환각**.
- **인프라**: 대형 청크(kaikki gloss 포함 ~126KB) 동시 3에이전트 stall(600s watchdog) 1회 발생 → 재-dispatch로 전량 복구. 데이터는 gitignore.
- **2차 슬라이스(freq 3000~6000) 전 18청크 완료**: `--min-rank` 추가·청크120·6에이전트/웨이브(stall 회피). 웨이브1 175(24%) + 웨이브2 323(45%) + 웨이브3 275(38%) = **773 enriched**. `bark`(→짖다)·`lens`(→수정체)·`vein`(→정맥/잎맥/광맥)·`cookie`(→컴퓨터 쿠키)·`decay`(→붕괴)·`toxic`(→해로운 관계)·`crow`(→까마귀)·`crane`(→기중기/두루미)·`niche`(→생태적 지위)·`dismissal`(→해고/기각)·`socket`(→눈구멍)·`carrot`(→유인책) 등. **누계 sense 깊이 = 1,088단어**(slice1 315 + slice2 773) · 3+ sense 1,466→**1,850행** · avg 1.273→**1.290**.
- **3차 확대 — freq 6k-31k 멀티 세션(6 병렬, v06.267)**: 잔여 8,320단어를 1회 스트림 후 rank 정렬 70청크로 분할 → 6개 Claude Code 세션(ksense-s1~s6, rank 대역별 격리)이 각 12청크(S6=10) 병렬 authoring. 지시문 = `docs/AI_CONTEXT/handoffs/ksense_multisession_20260717.md`(치환 없는 복붙 블록 6개). **5,406 enriched**(yield 65% — 이 대역은 복합 뭉침 엔트리多라 수리 대상 많음). 검증(읽기전용 `_ksense_{check,redundancy,preserve}.mjs`): **세션 간 단어 중복 0·무효 0·기존 sense 드롭 표본상 0·inflation 0.8~2.7%**. 부수 성과=`elevation`(고도;승진;입면도 1문자열)·`cache` 같은 **복합 뭉침 759건을 sense별 분리**(per-sense v_level+문맥-POS 매칭 원리상 필수). **누계 sense 깊이 = 6,494단어**(1,088+5,406) · 3+ sense 1,850→**5,742행**(+3,892) · avg 1.290→**1.475**.
- **잔여**: unranked(freq_rank NULL) 3,979 = 최저 노출 tail(현 툴은 rank 필수라 제외, `--include-unranked` 선결). 노출 다의어는 사실상 소진.

### kaikki(Wiktionary) 확보 — 사전 외부검증 보완 파이프라인 + IPA PoC (v06.265)
- **배경**: 사전 sense 깊이(avg 1.28 vs 일반사전 3~5+)·syn/ant/ipa parity 갭의 근본 병목 = 권위 외부 소스(kaikki) 부재([[project_dict_wave_plan_w0]] W0 중단 사유). 일반사전 비교 분석(`extraction_dict_vs_general_20260717.md`)이 이를 최우선 병목으로 확정.
- **확보**: kaikki `kaikki.org-dictionary-English-words.jsonl` **3.19GB**(CC BY-SA 3.0·무료·귀속) 다운로드 → `scripts/dict/data/`(gitignore). 벤더 중립(상용 아님).
- **파이프라인**(`scripts/dict/kaikki-enrich.mjs`): `extract`(3.19GB·148만 줄 스트림 → 45k 표제어 필터) + `apply-ipa/syn/ant`(결측만·멱등·**외부 사전 사실=무환각**, 자가생성 아님). 커버리지 45,667 중 **43,692(95.7%)** kaikki 존재.
- **IPA PoC 적용**: 결측 **5,879 채움** → ipa **64%→76.9%**(29,230→35,109). 0 실패. 자가생성 병목 해소 실증.
- **후속 자원(kaikki가 열어줌)**: sense 깊이(avg 4.5·≥5 sense 12,131 → 한국어 sense 추가 authoring, 별도 batch) · audio mp3 30,902(스키마 컬럼 필요) · syn/ant는 kaikki 구조화 희소라 저우선.

### 니모닉 확대 — v8+ 라틴계 학습어 265 (M2 확대, v06.264)
- **배경**: M2(v06.260)는 word_root_links 보유 2,472단어만 대상. 학습 세트 노출 v8+ 라틴계 단어 중 **어근 미링크 712개**가 니모닉 없음 → 최고난도(어원이 가장 유용한) 구간 보강.
- **도구**(`mnemonic-expand-chunk.mjs`): 링크 없는 라틴계 학습어 + **어근 인벤토리(181개) 근거 파일** 청크. 서브에이전트가 인벤토리 근거로 분해+니모닉(무환각), 근거 밖·비라틴·오귀속 위험이면 skip. 기존 `mnemonic-apply.mjs` 재사용(니모닉이 분해를 담아 링크 미삽입).
- **결과**: 5청크(712 후보) → **265 니모닉**(37% yield, mnemonic_ko 2,358→**2,623**). 서브에이전트 품질 게이트가 정교하게 오귀속 차단(`heliport` heli=헬리콥터≠helios · `interference` fer=치다≠나르다 · `taxable` tax=재정≠배열 · `compliance` complēre≠plic 등). 발음 말장난 0. 예 `deduction` de+duc+tion→추론 · `serpent` serp(기어가다)→뱀.
- **saturation**: 후보 노이즈(게르만어·외래어·고유명) 높아 yield 14~51%. v6-7로 더 확대 가능하나 per-word 가치↓ — 투명 분해 가능 집합은 사실상 포화. 발음 말장난 절대 금지 원칙([[feedback_mnemonic_etymology_only]]) 유지.

### UI 스모크 green 복구 — 스크립트 히어로 selector 수리 (v06.263)
- **런타임 검증**: 우위 로드맵 UI(리치 카드·플랜 스트립·RecallCard) 스모크 검증 — `04-ui-smoke` test 1(주요 화면 콘솔에러 0)이 `/wordvault`·`/library/vocab`·`/flashcard` 포함 통과 → 이번 세션 변경 런타임 안전 확인.
- **스모크 실패 수리**(테스트 결함, 앱 무버그): "스크립트 진입면 — 시리즈 상세" 테스트가 추천 히어로의 `getByRole('button').first()`(=v06.238 재설계 후 **본문 '학습 안내 보기' 팝업 버튼**)를 눌러 시트 오버레이가 클릭을 가로챔. 시리즈 진입은 하단 **'글 둘러보기'**(onEnter) 버튼 → selector를 `{name:/글 둘러보기/}`로 교정. **5/5 green** 복구. (고급 밴드 V9+ 계정에서만 재현 — 히어로가 안내 CTA라서.)

### 리더 단어 팝업 리치화 — 다의어+어원+니모닉 (v06.263)
- **배경**: 플래시카드 CardBack(v06.259·260)은 다의어·어원·니모닉을 노출하나, **리더 단어 팝업(RecallCard)은 삽화·뜻만** 표시 → 문맥 학습(읽기 중 단어 클릭) 흐름엔 리치 정보 부재.
- **배선**(`RecallCard`): 카드 열릴 때 공유 헬퍼 `fetchDictExtras([word])` 조회(클라이언트 재사용) → **다의어 품사별 뜻(≥2)·어원 root 분해 chip·💡니모닉** 컴팩트 노출. 미매칭/실패 시 뜻만(안전 폴백). 카드 높이 변화에 위치 재계산(extras 의존성).
- **효과**: 읽다가 단어를 눌러도 플래시카드와 동일한 리치 정보 — Context-Dependent 학습 + 어원/니모닉 결합. `posLabel`(명/동/형/부) 재사용. tsc 0.

### 진도-aware 완성 추정 — 학습 플랜 개인화 (F2, v06.262)
- **배경**: v06.261 플랜 스트립은 세트 규모 기반 정적 추정. 시중 능가의 핵심 = **개인 진도 반영**(시중 종이책은 불가능).
- **진도 계산**(`VocabSetPreviewModal`): 구독+로그인+챕터형(전체 단어 로드) 시 사용자 `vocabularies` 단어집합(RLS 본인, keyset pagination) ∩ 세트 단어 → **학습 X/N**. 마이그레이션 없이 클라이언트 조인(미충족 시 정적 플랜으로 안전 폴백).
- **UI**: 플랜 스트립에 **진행 바(%)** + "학습 X/N · 남은 Y단어 · 약 Z일 더"(완주 시 "한 바퀴 완주했어요 🎉"). remaining÷하루22단어로 남은 일수 산출 — 학습할수록 줄어드는 적응형 추정.
- **차별화**: 시중 고정 30일(누구나 동일) vs 플랫폼 실진도 기반 개인 추정 + FSRS 자동복습. tsc 0.

### 적응형 학습 플랜 스트립 — 세트 완성 프레이밍 (F2, v06.261)
- **배경**: 시중 벤치마크 — 시중 단어장은 "30일 완성" 고정 스케줄(누구나 하루 40단어·정형 누적테스트). 플랫폼은 세트를 정적 목록으로만 노출.
- **플랜 스트립**(`VocabSetPreviewModal`): 세트 미리보기에 **학습 플랜** 섹션 — 하루 신규 **22단어**(인지부하 Sweller 기준) × **약 N일** 도입 + N챕터 구성 안내. 핵심 프레이밍: **"복습은 기억이 흐려질 때 자동 배치돼요 — 고정 일정이 아니라 당신의 기억에 맞춰 조절"**(FSRS). 순수 계산(세트 규모), 로그인 무관 노출.
- **차별화**: 시중 고정 30일 vs 플랫폼 적응형(신규 페이싱 + FSRS 자동 복습). 정적 목록 → 달성 가능한 개인화 플랜으로 재프레이밍. tsc 0.
- **잔여**: 진도-aware 완성 추정(사용자 vocabularies∩세트 FSRS 조인 → "학습 120/500·예상 D-15") · prescribe_today 세트 연동.

### 어근 기반 니모닉 생성 + 학습 카드 노출 (M2, v06.260)
- **배경**: 시중 벤치마크 danger zone — `mnemonic_ko` 0%. 시중 어원편·경선식(발음 말장난)이 차별화하나 플랫폼 전무. 어원 root 축(v06.253) 배선으로 **어근 근거 니모닉**을 환각 없이 생성 가능(희귀어 어원 환각과 다름).
- **생성**: 어원 root 링크 보유 2,472단어 → 서브에이전트 16 병렬 authoring(어근 gloss 근거로 "어근 literal → 단어 뜻" 다리). **품질 게이트**: 어근이 뜻을 투명 설명 못하거나(불투명·의미변화) 어근 오데이터(gloss 불일치)면 skip → **2,358 생성(95.4% yield)**, 0 reject. 도구 `scripts/dict/mnemonic-{chunk,apply}.mjs`.
- **품질**: `inspect` in(안을)+spec(보다)→안을 들여다보다→점검 · `contradict` contra(반대)+dict(말하다)→반박 · `adjective` ad+ject(던지다)→명사 옆에 던져 붙인 말→형용사. 서브에이전트가 어근 오귀속(`absent`의 sent=느끼다 오데이터 등)까지 검출·skip.
- **카드 노출**(CardBack): 정답면에 `💡 {니모닉}`(Lora italic, Progressive Disclosure). dict-extras/FlashcardWord에 `mnemonic` 배선. **853단어는 니모닉+어원+다의어 동시 노출**(triple-rich) — 시중 단일-행·경선식이 못 주는 학습 카드. tsc 0.
- **잔여**: 어근 없는 단어 니모닉(소스 없어 보류) · RecallCard 배선.

### 학습 카드 리치화 — 다의어 품사별 뜻 + 어원 힌트 (M1·F1, v06.259)
- **배경**: 시중 벤치마크 danger zone — 플래시카드 정답면(CardBack)이 **flat meaning 1개만** 표시, 플랫폼이 이미 보유한 **다의어 per-sense meanings_ko(다의어 100%)·어원 root(2,767 링크)·콜로케이션**을 미노출. 시중 프리미엄 단어장(다의·뉘앙스·어원)보다 카드가 얕음.
- **공유 헬퍼**(`lib/flashcard/dict-extras.ts`): 단어 배치 → `{collocations, senses(다의어 ≥2), roots(어원 분해)}` map. shared_dictionary(collocations·meanings_ko) + word_root_links⋈word_roots(prefix→root→suffix) 배치 조회. scoped-words·hub-words 공용(단일 출처). 실패해도 카드 렌더 무영향.
- **카드 렌더**(`CardBack.tsx`): (M1) **품사별 뜻** 블록 — 다의어(≥2 sense)일 때 각 sense를 `명/동/형/부` 라벨+뜻으로. (F1) **어원 힌트** — root 분해 chip(`in-(안으로) + port(나르다)`). 둘 다 Progressive Disclosure(데이터 있을 때만·Calm UI 절제).
- **커버리지**: 학습 세트 단어 9,538개 중 **다의어 39%(3,734)·어원 20%(1,867), 51%가 최소 1개 보강 노출** → 시중 단일-행 항목이 못 주는 정보를 학습 시점에 제공. tsc 0.
- **잔여**: 니모닉(M2, mnemonic_ko 0%) · RecallCard(워크스페이스) 동일 배선 · bare gloss 재작성(M1 후속).

### P1 생성기 품질 게이트 — auto-vlevel 저레벨 오염 근절 (v06.258)
- **배경**: 시중 단어장 벤치마크(`docs/AI_CONTEXT/diagnostics/commercial_benchmark_vcb_20260717.md`)에서 **초등 세그먼트 열위** 판정 — auto-vlevel V1이 굴절형 35%(are/been/was/were/had), V2-3이 파생 -ing/-ed 30%(saying/backing/takings)로 **학습자 제공 부적합**. 우위 확보 로드맵 최우선(P1).
- **품질 게이트**(`republish-auto-vlevel.mjs` v06.258): 생성기에 (R1) **굴절형 제외** — 단어가 다른 표제어의 `inflected_forms`에 등장하면 배제 · (R2) **파생 -ing/-ed 제외** — base 표제어가 사전에 실재하면 배제(표준 역굴절 stem + `-ings` 복수 포함). 표제어(lemma) 우선. `--no-quality`로 원 동작 재현.
- **재발행 결과**: auto-vlevel 9세트 +250/−250 교체 → **굴절형 0(V1 35%→0)·파생 -ing ~0(V2 34→0)**, on-level 100% 유지, word_count 불변. V1 head `are/been/being/was/were/had`→**`have, say, know, think, make, see, like`**(실 기초 동사). 필터 후에도 pool ≥ qty(전 레벨 여유) 확인.
- **효과**: 게이트가 생성기 내장 → 향후 재발행(드리프트 수정 포함)도 자동 정제. 벤치마크 danger zone #1(저레벨 오염) 해소, 초등 세그먼트 제공가능화.

### 유형별 공용단어장 파이프라인 전수 테스트 + 오류 3건 조치 (v06.257)
- **전 유형 자동 테스트**(read-only, 9유형·1,085세트·44,958단어): 무결성(count/null/dup/chapter/orphan) **전 유형 통과** + 레벨정합·드리프트·surfacing 4차원 감사. 리포트 = `docs/AI_CONTEXT/diagnostics/wordset_pipeline_typewise_test_20260717.md`.
- **E1 조치 — auto-vlevel 드리프트 해소**: V5-V7 세트가 2026-05 생성 후 VRL 재분류 미반영(V5 75% on-level)이던 것을 신규 `scripts/dict/republish-auto-vlevel.mjs`(원 curation_query 충실 재구성·검증게이트 V1 재현 100%)로 9세트 재발행 → **+176 −176, 전 세트 100% on-level**. 추천 RPC(primary/stretch/review)에 직접 노출되던 stale 제거.
- **E2 조치 — 사전 오분류 `third`**: 최기초 서수가 v_level 11·C2·freq NULL(형제 서수는 전부 V1) → **V1/A1** + per-sense [1,2,2] 교정. (shared_dictionary v_level UPDATE 차단 트리거 부재 확인.)
- **I4 조치 — csat multi-POS 이중 행**: kice 세트의 같은 표제어 품사별 2행(85행, 중복 플래시카드/SRS 충돌 소지)을 survivor 병합(뜻·품사 `n·v` 결합)으로 dedup → csat 1,487→1,402단어, 중복 0.
- **미조치(의도)**: I3 구상어 과대 v_level(~27, VRL 분류기 차원) · I5 book/article floor 누수(소수) · I6 surfacing 갭(교육과정/article 추천 미노출, 제품 판단). 상세는 리포트 §5.

### per-sense v_level 정밀도 — Phase B 100% 종결 (v06.256)
- **2차 tier(단일-POS 다의어) 완료**: 우선순위(multi-POS) 소진 후 남은 **단일-POS 다의어 4,894단어**를 `sense-vlevel-chunk.mjs --all-pos`(25청크·200개씩·2웨이브)로 authoring → `updated 4,894 · failed 0`. 같은 POS 내 sense 차이(예 `will` noun 의지1/유언장5 · `practice` noun 연습2/관행4 · `centre` 중심1/센터2)를 반영.
- **최종 상태**: 추출 대상 다의어(register 제외) **10,144개 = per-sense v_level 100% 완비**(`any_sense_missing: 0`, 이전 2,724→10,144). 추출 시 sense별 정확한 난이도로 threshold 필터·V 배지 산출 — flat 폴백 근사 제거 완료. **Phase B 백로그 종결**(추출 신뢰 로드맵 3단계 정밀도 잔여 해소).
- **품질**: 2차 tier sense별 분화 59.6%(나머지=전 sense 동일 난이도가 정확한 legit). 전수 검증 결측·배열 길이불일치·범위초과 전부 0. `svl-p2` 작업 디렉터리 gitignore.

### per-sense v_level 정밀도 — Phase B 우선순위 슬라이스 완료 (v06.255)
- **배경**: 추출 신뢰 로드맵 3단계의 정밀도 잔여(비차단). 다의어 중 일부 sense에 자체 `v_level`이 없어 추출 시 flat(대표) v_level로 폴백 → 그 sense가 대표와 난이도가 다르면 threshold 필터·V 배지가 근사값. **뜻·POS는 이미 100%**라 "틀림"이 아닌 난이도 숫자 정밀화. 명세=`scripts/dict/SENSE_COMPLETION_MULTISESSION.md` §Phase B.
- **신규 툴 2종**: `scripts/dict/sense-vlevel-chunk.mjs`(대상→sense별 `{i,pos,meaning,v_level}` 청크, multi-POS 우선·`--all-pos`/`--max-rank`/`--limit`) + `sense-vlevel-apply.mjs`(`v_levels[i]`를 `meanings_ko[i].v_level` **결측분에만** 주입 — pos/meaning/기존값/flat 컬럼 불변, 길이 불일치·무변화 스킵, 1-11 검증, 멱등). 기존 sense-chunk/apply(단일-sense POS 추가용)와 분리.
- **우선순위 슬라이스 = 100% 완료**: multi-POS(형태별 sense 분기) ∩ per-sense v_level 결측 **2,526단어** — 16 서브에이전트 병렬 authoring(각 sense의 실제 난이도 부여, 대표≈flat_v·드문/전문/비유 sense↑) → `updated 2,206` + 멱등 `skipped 320` + `failed 0`. DB 검증 `multipos_missing_remaining: 0`. 전 sense 완비 단어 2,724 → **5,250**.
- **품질**: sense별 난이도 분화 53.6%(예 `firm` noun 회사5/adj 단단한4/verb 굳히다7 · `prime` adj5/noun6/verb8 · `shadow` noun4/adj8/verb7). 나머지 46.4%는 전 sense 난이도 동일이 정확한 legit 케이스(예 `pizzicato` 전 sense 전문 음악용어 11). 전수 검증: 결측 0·배열 길이불일치 0·범위초과 0.
- **잔여(2차 tier, 비차단)**: 단일-POS 다의어 4,894 — 같은 POS 내 sense 차이라 flat 폴백이 더 근접(cross-POS 난이도 점프 없음). `--all-pos`로 동일 파이프라인 실행 가능. `svl-*` 작업 디렉터리 gitignore(결과=DB 데이터).

### 아케이드 게임 module_id enum — 이미 적용 확인 (문서 교정)
- **검증**: `docs/proposals/game-suite-module-enum.sql`의 6 값(cascade/connections/word-economy/daily-blitz/letter-forge/ghost-race)이 원격 마이그 `20260711011813`으로 **이미 적용됨**을 DB `pg_enum` 조회로 재확인(+ 이후 게임 glyph-tongue·lexicon-detective 등도 추가됨). 게임 persistence(learning_records/scores insert) 활성 상태. SESSION_LOG 2026-07-11 기록의 "enum 승인 대기"는 stale이었음 — 교정.

### 추천 RPC에 재설계 세트(어원·주제) 소급 (v06.254)
- **배경**: 단어장 파이프라인 재설계 자동 검증(사전 DB·정확성·사용성) 결과 — 마스터 사전 45,667행 meaning/pos/cefr/v_level **100%**, 세트 무결성(orphan 0·empty 0·null_meaning 0), 어원 5/5 챕터 정확, 학년 v_level 단조(초1.9<중3.7<고5.9), e2e 09 통과. **발견 #1**: `recommend_word_sets_for_user`가 legacy `auto-vlevel-*`/`library_book`만 surface하고 재설계 세트(어원·주제)는 **브라우즈 전용**이던 커버리지 갭.
- **수리**(migration `20260717160000_recommend_word_sets_redesign_tiers`): 기존 티어(primary/stretch/review/specialty/track/book/fallback) **전부 무변경** + additive 2티어 — **Tier 7 어원**(`etymology-core`, 진단 V5+) · **Tier 8 관심 주제**(`topic-{interest}` opt-in, specialty 동일 패턴). 순수 UNION ALL(시그니처·컬럼 불변, 매칭 없으면 0행).
- **검증**: V11 유저 재호출 → 어원 티어(priority 7) 노출 ✅. 관심사 `[travel,health,business]` → topic-travel·topic-health + specialty-business 동시 노출 ✅.
- **프론트**: `RecommendedSetsSection.TYPE_BADGE` + `VocabSetGrid.TIER_BADGE`에 어원(어원)·주제(주제) 배지 추가(미지 타입 '추천' fallback 대체). tsc 0.
- **#2 빈 카테고리 탭 조사 → 이미 처리됨**: 라이브 뷰는 `VocabSetCarousel`이 세트 없는 카테고리 **숨김** + `CategoryMatrix`가 빈 탭 `disabled`+dimmed(info-scent)로 dead-end 없음. 유일 잔재 = **dead `CategoryFilter.tsx`**(참조 0·stale 퍼플 주석) **삭제**. preschool/civil/business는 matrix에서 "0" 비활성 노출(coming-soon = 의도적, 제거는 제품 판단이라 보류).
- **#3 legacy null_lemma backfill ✅**(DB 데이터만·승인): auto-vlevel-*/specialty-* 세트의 lemma NULL **2,502행** 전량 채움(`lemma = word` — 진단 결과 100% exact 사전 매칭). 검증: null_lemma 0·orphan 0. eng_test는 이제 avg_v 산출(8.5, 이전 NULL). 학년 단조 선명화(초2.0<중3.9<고4.8<eng_test8.5). 재설계 세트는 이미 lemma 보유라 미영향.
- **#4 library_book POS backfill ✅**(DB 데이터·승인, Option B=정확도 안전): 책 세트 POS 결측 중 **사전 단일-POS(pos_set 길이 1) 단어만** dict primary_pos로 채움 — 20,765행. **다의어 1,637 + pos_set 미상 1,081 = 2,718행은 NULL 유지**(문맥-POS 후속, primary-POS 오주입 회피 = 프로젝트 원칙 정합). 결과: 책 세트 POS 채움 0.8%→**88.5%**. 포맷 정합 사전 확인(noun/verb… 영문 소문자 동일 체계).
- **잔여(검증 발견, 후속)**: #5 주제 챕터 coarse(~125단어/챕터 — L2 롤업, 선택적 L3 세분화).

### LCP RPC 침묵실패 관측성 소급 (PR #93 salvage) — dev-process/process 라우트 (v06.254)
- **배경**: `feat/scriptquiz-chapter-quiz`(PR #93)를 새 main에 merge. 대형 기능(챕터 퀴즈)은 plan-ui 재구현으로 main에 있고, scriptquiz 드레인·VCB QA·dict enrichment는 데이터/docs라 반영/superseded → **유일한 고유 코드 = LCP RPC 관측성 수리**만 소급.
- **관측성 수리**(`0679a2d`): `/api/lcp/{dev-process,process}`의 `compute_book_*` RPC 호출이 `try/catch`였으나 supabase-js rpc는 **무-throw({error} 반환)** → catch가 죽은 코드(침묵실패). **per-call `{error}` 검사 for-loop로 교정** — main의 확장 RPC(chapter_v_levels·syntax·difficulty)는 유지하고 관측성만 결합. (같은 무-throw 버그의 DB측 짝 = #94 lbv lemma 게이트.)
- **머지 처리**: docs 충돌은 main 채택. **pairflip은 main 통째 채택**(#93의 "stale mock 제거"는 구버전 기준 판단 — main의 `saveLearningRecords` 실 persistence 회귀 방지). CLAUDE.md scriptquiz 카운트만 #93값(1,292문항·10권) 반영.

### 품질 파이프라인 회귀 인프라 소급 (PR #94 salvage) — 골든 스냅샷 + quality_metrics + lbv lemma 게이트 (v06.254)
- **배경**: `feat/quality-eval`(PR #94)이 old main 분기 후 미머지였고, plan-ui 통합으로 `/admin/quality` UI는 main에 들어왔으나 그 **하부 인프라 3종**(마이그·회귀 테스트)이 마이그 이력 밖이었음 → **main에 소급**(main을 브랜치로 merge, docs 충돌만 main 채택).
- **골든셋 스냅샷 테스트**(Q1 `0b6db84`): `packages/library-pipeline/test/{noise,segmentation}.snapshot.test.ts` — `computeLexicalNoise`·`normalizeBook` 결정론 회귀 가드. `.gitattributes -text`로 골든 fixture 줄끝 정규화 차단(`ff8dba3`).
- **quality_metrics nightly 집계**(Q2 `8f7f49c`): 마이그 `20260704043934_quality_metrics.sql` — main 후속 `20260706000000_admin_collect_quality_metrics.sql`(집계 버튼)이 참조하던 테이블의 **CREATE 마이그 공백을 메움**(마이그 순서 정합 복구, 04→06).
- **lbv lemma INSERT 게이트**(`86ec3d4`): 마이그 `20260704090000_lbv_lemma_insert_gate.sql` — `library_book_vocabularies` lemma NULL 삽입 시 statement-level 트리거로 자동 채움. rpc 무-throw 침묵실패로 Les Misérables 13,351행 lemma 전량 NULL→추출 3경로 무력화됐던 결함의 근본 게이트.

### CI green 복구 — main 머지 게이트 정리 (v06.254)
- **배경**: `feat/plan-ui`(origin/main +319, 0 behind)의 CI 3잡(TypeScript·build·verify)이 최신 커밋 기준 red → 깨끗한 main 머지의 유일 블로커.
- **build(next lint) 13 에러**: 아케이드/신규 게임 스위트가 남긴 미사용 import/var — `GameMark`(7 게임)·`IconSound`·`useRef`(glyph-tongue)·`NextRequest`(factbook-feed route)·죽은 로컬 `mounted`(언마운트 가드 미배선)·`placedCount`·`total`(lexicon-detective/morpheme-rules) 제거. 전부 동작 무변경 죽은코드.
- **TypeScript 0 error(tsc) 1 에러**: `lib/recommend/next-action.mock.ts` `actionToHref` switch가 `ModuleId`(아케이드 모듈 추가로 확장) 비exhaustive → TS2366. `default` → `/library`(P4 폴백) 추가.
- **verify(vitest) 1 실패**: `TodayPrescriptionCard.test.tsx`가 Phase 1의 "곧 제공" 상태칩을 기대했으나 Phase 2(v06.204)에서 ④구문연습이 실런처(`/practice/dcp`)로 교체됨 → 테스트를 shipped 동작(런처 노출)으로 교정.
- **부수**: 게임 지시문(glyph-tongue·silent-rule) `aria-hidden` 제거로 스크린리더가 룰 낭독(a11y). 검증: lint 0 · web/library-pipeline tsc 0 · 테스트 144 passed.

### 주제별 단어장 PoC — dictionary_categories 활용 (v06.254)
- **P0 정찰**(read-only, `wordset_pipeline_v2_p0_20260717.md`): 단어장 파이프라인 v2 전제 판정 — ① 학년 노드는 `dictionary_categories`엔 없음(thematic 18) BUT `kcurr2022` 교육과정 별표=word-level 학년 소스 **이미 존재·발행**(오류1 완화) ② `category_id` 부재 확인(오류5 철회) ③ `curation_query` 스키마 불일치→GENERATED 정규화 선결 ④ **`dictionary_categories` 566노드+28,079 매핑=주제축 데이터 이미 존재**(플랜 밖 기회).
- **주제 세트 발행**(정찰 발견 즉시 실현, migration 불요): `topics-publish-set.mjs` — L1 테마=세트·L2 소주제=챕터(L3 롤업). **전 18주제 7,219단어** 발행(음식·여행·건강·비즈니스·과학·자연·사람·정치사회·문화·외모·언어기능·동물·집·스포츠·개념·의사소통·시간공간·여가). category `themed`/subcategory `topic`. chapter=L2 그룹번호·라벨=`korean_learner_note`(예: 여행→항공 교통·휴가 / 건강→의료·장애).
- **검증**: e2e 09에 주제 세트 렌더 단언 추가(소주제 챕터 라벨) → 통과(14.6s). 시중 주제별 단어장 대응 완비.
- **배경**: 시중 대응 카탈로그 실측 결과 학년/수능/시험/주제는 이미 발행됐고, 유일한 미대응 = **어원 단어장**(Word Smart류). kaikki 불요(핵심 학술 root=표준지식).
- **스키마**(migration `20260717140000`): `word_roots`(어근 인벤토리·origin·meaning_en·gloss_ko·variants) + `word_root_links`(단어↔어근, (word,root_id) PK 멱등·affix_type·confidence). RLS 공개읽기.
- **시드**: 라틴/그리스 핵심 어근·접두·접미 **181개**(`scripts/dict/roots-seed.mjs` + `data/word-roots-seed.json`, 멱등).
- **매핑**: 6 서브에이전트가 root→파생어족 생성(어원학적 진짜 파생어만) → 사전 실재 단어만 링크. **2,767 링크**(후보 2,591 중 사전 실재 2,472=95%). `scripts/dict/roots-map.mjs`.
- **어원 단어장 발행**: `etymology-core` "어원으로 익히는 핵심 영단어" — **1,500단어·159 어근 챕터**(chapter=그룹번호, `korean_learner_note`=어근 라벨). category `themed`/subcategory `etymology`. `scripts/dict/roots-publish-set.mjs`. 품질 검증(spec/dict/port/duc 챕터 전수 정확).
- **이중배당**: 어원 단어장 + (후속) 추출 파생어 인식·니모닉 소스. curation_query `{org:'root'}` 문서화(RPC 실행축 확장은 후속).
- **렌더 검증(수정 포함)**: `VocabSetPreviewModal`이 챕터를 `Chapter N`(숫자만)으로만 표시 → 어원 세트의 어근이 안 보이던 문제 수정 — 챕터 내 `korean_learner_note`가 균일하면 **어근 라벨("어근 spec — 보다")을 챕터 헤딩으로 승격**(책 챕터엔 무영향). e2e `09-etymology-set.spec.ts`(검색→모달→어근 챕터 렌더 단언) 통과. ⚠️ 발견: 어원 세트가 themed 저중요도라 기본 추천 캐러셀엔 비노출(검색/테마별로 접근) — 프로미넌스는 후속.
- **추출 이중배당**: `ExtractionPanel`이 추출 단어의 표제어 어근을 `word_root_links` 조회 → **🏛 어원 힌트 칩**(인라인 `🏛 spec` + expand "어원 spec (보다)") 노출. 학습자가 단어 추출 시 어근을 바로 봄. e2e 08에 어근 칩 단언 추가(통과 29.3s). `mnemonic_ko`는 admin 전용 UI뿐이라 대량 채움 대신 기존 근거 카드 surface 재사용(스키마 마찰 0).
- **어원 first-class 카테고리 승격**(migration `20260717150000`): `shared_word_sets.category` CHECK에 `'etymology'` 추가 + etymology-core 세트 이동(themed→etymology). `categories.ts`에 **📜 어원 카테고리**(중요도 50·공인 다음) + `VocabSetCarousel` 앰버 색 → /library/vocab 기본 뷰에 **자체 어원 탭** 노출(시중 어원 카테고리 대응). e2e 09에 탭 프로미넌스 단언 추가(통과 31.3s).

### 추출 대상 단일단어 example 100% 완비 (v06.252)
- 추출 대상(classified·v_level·노이즈 register 제외) **단일 단어 172개**의 `example_en` 결측을 사전급 예문으로 채움 → 단일단어 example **95.5%→100%**. 대부분 학술 고급어(auscultation·sedimentary·inhibitory·regulatory 등) + 영국식 철자변형.
- 도구 `scripts/dict/example-fill.mjs`(dump=대상 청크화 · apply=검증 후 결측행만 UPDATE 멱등). 4 서브에이전트 병렬 authoring(품사·의미 sense 매칭·영국식 철자 보존) → 172 valid·0 reject·0 fail.
- 잔여 결측 1,635는 **multiword 항목**(단일 토큰 추출 경로로 애초에 추출 안 됨 → 추출 품질 무관, 의도적 잔존).

### 추출 신뢰 런타임 회귀 스펙 — 알아요/몰라요 + 근거 카드 E2E (v06.251)
- **상시 회귀 자산**(임시 드라이버 금지 정책): `08-text-extract-trust.spec.ts` — 실 로그인으로 `/text/new` 추출 → 4단계 근거 카드 렌더 + 2단계 알아요(✓·체크해제)/몰라요(aria-pressed) → `word_familiarity` known/unknown 적재를 **service-role DB 단언**. finally 에서 테스트가 만든 행만 원복(known이 다음 추출을 영구 축소하지 않도록).
- **db 헬퍼 2종**: `countWordFamiliaritySince`(verdict 필터) · `deleteWordFamiliaritySince`(멱등 정리). **ExtractionPanel 토글 버튼에 `aria-pressed`**(a11y + 상태 검증). 최초 실행 통과(18.9s · known+unknown 영속화 확인 · cleanup 2행).

### 추출 신뢰 로드맵 기반 완성 — 3단계 검증 + 정밀도 백로그 (v06.250)
- **5단계 로드맵**(새는 곳 막기→틀려도 고칠 수 있게→채우기→자랑하기)의 **0·1·2·4단계 완료** = 신뢰의 누수(3경로 분열·형태-POS 오정렬·교정 불가·근거 불투명) 전부 봉인.
- **3단계 검증(읽기 전용)**: 추출 대상 **40,355** 표제어 — `meaning_ko`·`pos`·`cefr_level`·`meanings_ko sense별 pos` **모두 100%**(= 맞는 단어·그 형태의 맞는 뜻·맞는 POS 보장), example_en 95.5%. **뜻·POS가 틀리지 않음이 데이터로 확인**.
- **정밀도 백로그(Phase B, 비차단)**: 다의어 10,144 중 **7,420**이 일부 sense에 자체 v_level 결측 → flat 폴백(뜻 아닌 **난이도 숫자 근사**만 영향). 우선순위=실사용∩multi-POS 5,170. 신규 툴 명세를 `scripts/dict/SENSE_COMPLETION_MULTISESSION.md` §Phase B에 기록. 여유 시 멀티세션 배치.

### 추출 신뢰 4단계 — 추출 근거 카드("왜 이 단어인가") (v06.249)
- **전략 4단계 "자랑하기"**: 백엔드가 이미 반환하던 `score_breakdown`(V-Level·threshold·track/freq boost·reasoning·형태해소)을 **학습자 공감 언어의 근거**로 번역. 완벽함을 주장하는 대신 "왜 뽑았는지" 투명하게 보여 신뢰 형성.
- **`buildReasons(r)`** 순수 헬퍼 — 신뢰 가치순 근거 생성: ① 목표 트랙 빈출(수능/비즈/학술, `track_boost>0` + 최고 트랙) ② i+1 난이도 위치(`v_level==threshold`→"딱 지금 배우기 좋은" / 초과→"조금 도전적") ③ 빈도(rank≤3000 "두루 쓸모" / rare "이 글에서 특히 중요") ④ **형태 해소**(match_layer 2 → `이 글엔 "surface" 형태 — 표제어 "lemma"(POS 뜻)`, 이 플랫폼만의 강점). 각 근거에 lucide 아이콘(Dual Coding).
- **UI(ExtractionPanel)**: 인라인엔 **눈에 띄는 근거만**(generic 난이도 제외 → Calm UI) 뜻 아래 italic 한 줄. expand 상단에 **"왜 추천했어요?" 카드**(전체 근거 + 아이콘) → 기존 기술 breakdown 테이블은 그 아래로(Progressive Disclosure). 스코어 코너의 dev 문자열("V6 ≥ threshold")은 "추천 점수"로 정리, 기술 reasoning/method는 breakdown 안으로 이동. tsc 0·eslint 0.

### 추출 신뢰 2단계 — 학습자 "알아요/몰라요" 교정 + 오난이도 신호 (v06.248)
- **전략 순서**(새는 곳 막기→틀려도 고칠 수 있게→채우기)의 **2단계**: 완벽 대신 학습자가 추출을 직접 교정. 마이그 `20260713180000`(테이블+RPC+뷰) · `20260713180500`(추출 제외).
- **`word_familiarity`** 테이블(user·**lemma(표제어) 단위**·verdict known/unknown·판정당시 v_level·source) + RLS(본인) + `idx_wf_lemma_verdict`. lemma 단위 저장 → 굴절/파생 형태 무관 일관.
- **`set_word_familiarity(lemma,verdict,v_level)`** RPC(DEFINER·`auth.uid()` upsert·PUBLIC revoke·authenticated grant). **`word_mislevel_signal`** 뷰(known_ct/unknown_ct + dict_v_level 대비 → 과대/과소난이도 후보 집계).
- **추출 제외**: `extract_vocabulary_for_user_v2` filtered CTE에 `verdict='known'` 배제(이미 아는 단어 재추출 안 함). 나머지 통합 로직(resolve_dict_headword·infer_form_pos·i+1 threshold) 불변.
- **`ExtractionPanel`**: 행마다 알아요/몰라요 버튼(낙관적 UI·known→페이드+선택해제). 저장은 **lemma 단위 + `extracted_surface` 보존**(SRS 형태별 쪼갬 방지). L2 배지 형태→표제어 시맨틱 교정. `@vocaflow/types` database.ts 재생성(신규 RPC 타입). tsc 0(ExtractionPanel).

### 스크립트 출처 설명 — 소스별·소스주제별 한눈에 (v06.247)
- **문제**: 소스는 라벨(NASA·OWID·eLife…)만 있고 "그게 뭔지·무슨 주제인지" 설명이 없어 학습자가 파악 어려움.
- **소스 메타 확장**: `source-meta.ts` 각 소스에 **domain(분야: 우주·천문/건강·의학/데이터·통계/여행…)** + **blurb(한 줄 설명: "미국 항공우주국 — 우주 탐사·천문·지구 관측 소식")** 추가(14소스 전수). `TrackStat.sources`가 집계 시 domain/blurb 주입.
- **한눈 디자인**: ① 팝업(SeriesInfoModal) **'출처별' 존** — 색점 + 이름 + **분야 배지** + 편수 + **비율 바**(시리즈 내 비중 시각화) + 설명. 소스별(무엇) + 소스주제별(무슨 분야·얼마나) 동시 전달. ② SeriesDetail 소스 그룹 헤더에 **분야 배지 + 설명** → 글 목록에서 소스주제별 맥락.
- **검증**: tsc 0·eslint 0 · unit 18 유지 · 런타임 diag(모달 출처 분야·설명 렌더·pageerror 0).

### ACP 소스 feed 전수 자동 테스트 + nih 불안정 표기 (v06.246)
- **전수 테스트**(29 feed · 14 소스 · 실 외부 호출, DEV_ADMIN_BYPASS): **12/14 소스가 233+ 후보 정상 산출** — voa(36)·nasa(21)·simple_wikipedia(40)·the_conversation(23)·owid(4)·factbook(30)·elife(20)·wikipedia(38)·plos(15)·wikivoyage(40)·usgs(24)·noaa(19). **코드 파싱 버그 0** — 실패/빈 feed는 전부 외부 요인 확인.
- **외부 이슈(코드 아님)**: nih/news RSS **403 차단** · nih/directors-blog **연결불가(000)** · nih/medlineplus **원본 1건뿐** · nasa/apod **원본 RSS가 제목 공란·설명=이미지태그**(기사용 아님) → curation 정확히 0 · wikinews **비활성**(기존 flag) · the_conversation/politics **저볼륨**(all/science/health는 정상).
- **사용성 보완**: nih 3 feed 모두 실패인데 basic 프리셋에 포함돼 매번 실패 유발 → `BulkArticlesTab` nih 에 **`health='unstable'`** + note(“News 403·Blog 불가·MedlinePlus 희소 — URL 직접 입력 권장”) 표기(wikinews 패턴). 소스 카드에 ⚠️ 경고 노출.

### 시리즈 학습정보 팝업 — 텍스트 위주 → 시각적 정보전달 (v06.245)
- **문제**: 팝업(SeriesInfoModal)이 텍스트 위주 — "나에게 맞나?"(난이도)가 텍스트 배지뿐, 능력은 텍스트 나열, 정보전달 매커니즘 부족.
- **시각 부호화 강화**: ① **난이도 게이지** 신설 — 축(쉬움→어려움) 위에 시리즈 밴드(vMin~vMax)와 **내 위치 마커**를 그려 "나에게 맞나"를 <1s 시각 즉답(전주의적, `vToPct`/`effectiveUserV` 재사용). ② **스탯 타일**에 아이콘(분량·읽기시간·음성) — 읽기시간은 실 글에서 집계(`3~8분`). ③ **능력 = 아이콘 칩 그리드** — 키워드→아이콘(듣기 Headphones·논증 Scale·독해 BookOpen·데이터 BarChart…) Dual Coding. ④ why는 Lightbulb 앵커로 보조 강등.
- **검증**: tsc 0·eslint 0 · 런타임 diag(팝업 열림·게이지·스탯·능력·로드맵·why 렌더 · pageerror 0). buildScriptsMap/진입 flow 불변.

### `/admin/articles` 소스 라벨 SSoT 통일 — 커버리지↔소스GET 불일치 수정 (v06.244)
- **버그**: 소스 라벨이 3곳(정본 `source-guide.SOURCE_LABEL` · `SourceFeedList.SOURCE_LABELS` · `CurationConsole.SOURCE_OPTIONS`)에 중복 정의 → 드리프트. `SOURCE_OPTIONS`가 `simple_wikipedia`를 **"Wikipedia"로 오표기**(정본 "Simple Wikipedia") → 커버리지(SourceFeedList)엔 "Simple Wikipedia", 소스GET 탭엔 "Wikipedia"(×2, wikipedia와 충돌)로 **같은 소스가 다른 이름**.
- **수정**: 커버리지·소스GET·소스헤더 셋 다 **정본 `SOURCE_LABEL` 단일출처**만 사용. `SOURCE_OPTIONS`는 key+Icon만 정의(라벨 하드코딩 제거), `SourceTabs`가 `SOURCE_LABEL[key]` 렌더. `SourceFeedList`의 중복 `SOURCE_LABELS` 삭제 → `SOURCE_LABEL[source]`. DB 소스 집합(seed_catalog·articles)은 14 정본 내 확인(stale 없음). 미래 드리프트 차단.
- **소스GET(대량) 라벨 정렬**(BulkArticlesTab, 4번째 소스 맵): owid=**"OWID"→"Our World in Data"** · factbook=**"Factbook"→"CIA World Factbook"** · noaa=**"NOAA"→"NOAA Climate.gov"** 정본과 일치. 14 소스 전부 존재(preset "전체(14 소스)") 확인. (커버리지의 「소스 피드 현황」은 후보 수집된 소스만 동적 표시 — 미수집 소스는 미노출이 현 설계.)

### `/library/scripts` 선택 후 글 목록(SeriesDetail) 에디토리얼 재설계 (v06.242)
- **문제**: 시리즈 선택 후 화면이 분류 없이 카드 나열식 — 특히 고급(V11) 학습자는 모든 글이 같은 fit('수월')이라 그룹이 붕괴돼 평면 그리드였음.
- **재설계(콘텐츠 우선)**: ① **먼저 읽어볼 글**(featured lead — 추천순 1편을 큰 잡지 lead 카드로, 최고의 글 어필) ② **적응형 분류** — 다중 출처 시리즈(관심 주제·데이터·백과)는 **출처(소주제)별**(NASA/NIH/PLOS…), 단일 출처(듣기·쉬운글·논증)는 **읽기 시간별**(빠르게 4분↓/찬찬히 5~9분/깊이 10분↑). V-Level 무관하게 항상 의미 있는 분류(고급도 나열식 X). ③ 오리엔테이션(능력·why·학습법)은 하단 "이 시리즈에 대해" footer로(콘텐츠가 먼저 보이게).
- **ArticleCard 에디토리얼 타일**: 본문 미리보기가 없어 **제목(Lora)을 크게 승격**(콘텐츠의 얼굴), 나머지(출처 색점·읽기시간·레벨·적합·음성·태그)는 절제된 한 줄 메타. 카드 전체 클릭=읽기 진입, 우상단 원문 링크. `featured` 변형(큰 리드). SOURCE_META는 source-meta.ts 공유분 재사용.
- **검증**: tsc 0·eslint 0. (진입면→상세 클릭 경로 e2e 는 동시 진행된 SeriesInfoModal 2-타깃 개편과 겹쳐 별도 조정 필요 — 상세 화면 자체는 onEnter '둘러보기' 도착지로 유지.)

### `/library/scripts` 시리즈 학습정보 팝업 (v06.240 → 가독성 재설계 v06.241)
- **결정 surface 신설** `SeriesInfoModal.tsx` — 진입면에서 주제(시리즈) **왼쪽(본문) 클릭 → 학습정보 팝업**. 글 목록에 들어가기 전, 고를지 확신을 갖고 결정하게 함(Progressive Disclosure · 자기효능감). 콘텐츠 전부 실데이터/근거(TrackStat sources·count·fit·idealCount + SourceTrack 카피). 추가 fetch 0.
- **v06.241 가독성·가시성 재설계 (뇌과학·심리 근거)**: ① **한눈 요약 스탯 스트립**(난이도·레벨·분량 3타일, 색·크기 전주의적 <1s 파악) ② **격리된 개인화 훅**(16px 볼드·fit색·Von Restorff) ③ **체크 앵커 능력 리스트**(t1 14px, 그림 우월) ④ **큰 번호 로드맵**(28px 원·연결선) ⑤ **근거 존 그룹화**(왜+출처 한 카드, Gestalt 공통영역) ⑥ **48px 고대비 CTA**. 인지부하 청킹(6나열→3존 ~4항목), 중요정보 대비 t3→t1/t2. Calm 등장(mounted-state)·Esc/백드롭·스크롤잠금·role=dialog·다크 토큰.
- **카드 2-타깃 재구성** ScriptsBrowser: 히어로/row **왼쪽(본문)=학습안내 팝업 / 오른쪽(둘러보기)=글 목록 직행**. 히어로 "ⓘ 이 시리즈 알아보기" 어포던스, row Info 아이콘 + 우측 "cefr·편수 ›" 분절. buildScriptsMap 불변.
- **출처 제공**: `source-meta.ts` 신설 — 소스 라벨·색·짧은라벨을 ArticleCard에서 추출해 공유(진입면·상세 재사용). `buildScriptsMap` 이 시리즈별 **실제 출처+편수**(`TrackStat.sources`) 집계 → 진입면 히어로/row에 "출처 · NASA · NIH · PLOS +N" 한 줄, 상세엔 색 점 + 편수 칩. 학습자 신뢰·기대 형성(정식 원문 큐레이션).
- **글 목록 분류(모던·심플)**: `SeriesDetail` 글 목록을 **i+1 적합 티어로 그룹**(딱 맞아요→수월→도전→어려움, 그룹당 짧은 글 먼저) — iOS 그룹 리스트식 조용한 색-점 헤더. 무엇부터 읽을지 스스로 판단(학습자 제공 최적화). 그룹 1개면 평면.
- **검증**: tsc 0·eslint 0·SSR 200(진입면 출처 힌트 렌더 확인) · 04-ui-smoke 2종 PASS(진입면→상세(출처칩·분류)→복귀 · 밴드 V2/V5/V9) · unit 18 유지.

### `/library/scripts` 진입면 간소화 — Progressive Disclosure 재설계 (v06.238)
- **문제**: v06.222 재설계가 진입면에 난이도 지도(칩 레일) + 개인화 배너 + '바로 시작' strip + **시리즈 카드 6개(각각 능력·학습과학 why·학습법 ①②③ 전부)** 를 한꺼번에 노출 → 첫인상이 "학습 초대"가 아니라 "학습 요람". 프로젝트 원칙(Progressive Disclosure·Cognitive Load ~4항목·Calm UI) 위반, 학습자 선택 과부하(Hick).
- **재설계**: **"조용한 초대 먼저, 깊이는 고른 뒤"** 2계층. 진입면 = ① 밴드별 한 줄 안내 → ② **추천 시리즈 히어로 1개**(확신 있는 출발점·자기효능감) → ③ 나머지 시리즈 **간단 row**(스캔 가능·저부하·자율). 시리즈 선택 시에만 `SeriesDetail`에서 능력·why(Lora italic)·학습법·글 목록 노출.
- **변경**: `SeriesDetail.tsx` 신설. `ScriptsBrowser.tsx` 진입면 재작성(inline 히어로/row). **제거**: `DifficultyMap`·`ScriptsGuideBanner`·`TrackOrientationCard`(내용은 detail로 이동). `buildScriptsMap`/`bandGuidance`(밴드 적응 로직)는 유지 — 추천·안내는 그대로 레벨 적응.
- **검증**: tsc 0·eslint 0·SSR 200(구 '난이도 지도'/'골라보기' 제거 확인). 04-ui-smoke 2종 갱신 **PASS**(진입면→상세→복귀 2.9s · 밴드 V2 초급/V5 중급/V9 고급 6.7s) + `source-map.test.ts` 18 유지. 클린 단일 서버·CI=1.

### 아케이드 도시에 마지막 북극성 ⑧「The Word Orrery」 — 지식 게이트 탐사 (Outer Wilds 계열) (v06.237)
- **메커니즘(독창)**: 미니 항성계의 **여섯 행성을 자유 탐사(비선형)**. 각 행성의 '현상'이 곧 단어 뜻을 체현(예: 잿더미·생명 無 → `desolate`). 관측 시 이름을 읽어 **성좌 노트(코덱스)**에 기록. 여섯 성좌를 모두 관측하면 **중심 핵의 봉인이 깨어남**. 봉인의 수수께끼는 현상을 **에둘러** 가리켜, 스탯·운이 아닌 **오직 앎으로만** 열림(Outer Wilds의 '지식이 곧 진행'). 오답 페널티 無(시간 루프식 자유 탐사).
- **학습 과학**: 현상 문맥에서 뜻 획득(Dual Coding·Context-Dependent) → 봉인에서 에두른 단서로 인출(Active Recall·새 맥락 전이). 6단어 오센틱 형용사(desolate/profound/erratic/volatile/dormant/radiant).
- **아트**: 심우주 인디고→따뜻한 태양 오렌지. 회전 궤도링·펄스 태양·행성 비컨·현상 Lora italic 세리프. 오리리 원형 배치(6행성) + 코덱스 + 봉인 패널.
- 배선: `word-orrery` 3타입(ArcadeGameId/ModuleId/ScoreModule) + MARK_PATHS + `/play/word-orrery` + SessionFrame + 아케이드 허브(14번째 포탈) + /hub 배너("14개 세계").
- **검증**: Playwright 18항목 전 PASS — 잠금 게이트·6관측·코덱스·해금·오답 shake·4봉인 개방·완료·**pageerror 0**.
- **persistence 마이그 `add_word_orrery_module_id` 적용 완료**(2026-07-13) — `module_id` enum +`word-orrery`. 순수 additive(IF NOT EXISTS). DB 검증: enum 존재 확인. 로컬 미러 `supabase/migrations/20260713110000_*.sql`. → **아케이드 14종 전부 persistence 완성**(무드 6 + 신개념 7 + 북극성 1).

### ⑦ Lexicon Estate module_id enum 마이그 적용 — 아케이드 13종 persistence 완성 (v06.236)
- DB 마이그 `add_lexicon_estate_module_id` **적용 완료**(2026-07-13) — `module_id` enum +`lexicon-estate`. 순수 additive(IF NOT EXISTS). DB 검증: enum 존재 확인. 로컬 미러 `supabase/migrations/20260713100000_*.sql`.
- 효과: 아케이드 **13종 전부** FSRS learning_records·scores persistence 활성(무드 6 + 신개념 7).

### 아케이드 도시에 2차 웨이브 ⑦「Lexicon Estate」 — 의미장 인접 배치 (Blue Prince 계열) (v06.235)
- **메커니즘(독창)**: 청사진 저택 3×3에 단어-방을 **드래프트(3장 중 택1)**해 배치. **인접(상하좌우) 방이 같은 의미장이면 '복도'로 연결**(점수·글로우). 같은 의미장끼리 뭉치도록 배치 최적화 = 어휘의 **연상 웹(의미 네트워크)** 감각. 4 의미장(감정/자연/신체/금융)×6단어.
- **학습**: 단어의 의미장(semantic field)을 인식하고 공간적으로 군집화 — 어휘 depth의 핵심인 연상 관계 훈련. Blue Prince의 드래프트+도면+인접 시너지를 차용.
- **배선**: `LexiconEstateGame` + `/play/lexicon-estate`(minWords=0) + 청사진 블루 무드 + 도면 마크/워터마크 + 허브 13번째 포탈 + SESSION_META. TS 3유니온 +lexicon-estate.
- **검증**: 그리디 봇 3회 — 저택 완성·응집도 42~50%("훌륭한 저택")·9방·pageerror 0. **밸런스**(그리디 5~6, 최적 8+). **아케이드 12→13종(도시에 북극성 Blue Prince계 실구현).**
- ⏳ DB `module_id` enum +lexicon-estate 마이그 대기.

### 허브 아케이드 진입 동선 — /hub 배너 카드 (v06.234)
- `ArcadeEntryCard` — /hub 모듈 그리드 아래 아케이드 진입 배너(황혼 갤러리 무드 그라디언트 + 컨트롤러 마크 + "12개 세계에서 단어를 놀이로 — 해독·추리·시너지" + 플레이 CTA). 아케이드 아이덴티티와 무드 일치, Calm UI(강조 1). 이전엔 /arcade 직접·사이드바로만 도달 → 메인 오늘 화면에서 발견 가능.
- **검증**: /hub 렌더 200·링크 감지·pageerror 0·스크린샷 확인.

### 아케이드 무드게임 내장 콘텐츠 확장 — Connections 5퍼즐 · Daily Blitz 48뱅크 (v06.233)
- **Connections** 퍼즐 3→5(+67% 리플레이): 악기/보석/응시/거래 · 곤충/지형/성격결점/말하기. 스코프 미지원 게임이라 내장 뱅크가 곧 콘텐츠. **검증**: 새 퍼즐 식별·완승·0미식별·0에러.
- **Daily Blitz** 데일리 뱅크 30→48단어(신중한·마지못한·성취하다·극복하다·풍부한 등): 날짜 시드가 10개 추출 → 뱅크 클수록 데일리 변화 폭↑. 데이터 추가(로직 무변경·tsc 0·0에러).

### 아케이드 ④ Lexicon Detective 사건 2→3 확장 — 「불타는 극장」 · authored 3종 확장 완결 (v06.232)
- ④에 사건 3 추가: 극장 화재 재구성 — 8단서(actor·jealous·sabotage·ignite·flee·rescue + 함정 applause/curtain) → 6빈칸 서사(질투한 배우가 조명을 방해공작→합선 발화→관객 대피→구조). 게임 코드 무변경(동적 CASES).
- **검증**: 3사건 완주(사건1·2·3)·done 3사건·100%·18단서·pageerror 0.
- **authored 3종(④⑤⑥) 콘텐츠 확장 완결** — ④ 2→3사건 · ⑤ 2→3회랑 · ⑥ 3→6규칙. 각 end-to-end 검증.

### 아케이드 ⑤ Morpheme Rules 회랑 2→3 확장 — 「시간의 방」 (v06.231)
- ⑤에 회랑 3 추가: 시제 형태소(pre 미리·re 다시·fore 앞서 × view·cast·tell) → preview/forecast/review 조립으로 장애물 발동(안개 낀 앞날·다가올 폭풍·흐릿한 기록). VALID +6단어(foretell/retell/recast 등은 실재하나 오적용 시 "통하지 않는다"). 게임 코드 무변경(동적 LEVELS).
- **검증**: 3회랑 완주(3/3×3)·done 9단어·100%·3회랑·pageerror 0.

### 아케이드 ⑥ The Silent Rule 콘텐츠 확장 — 철자 규칙 3→6 (v06.230)
- authored 게임 콘텐츠 확장(배선 불가 게임은 콘텐츠가 리플레이 자산). ⑥에 고가치 철자 규칙 3종 추가: **자음+y→-ies**(babies/cities) · **s·x·ch·sh 뒤 -es**(boxes/watches) · **-ful은 l 하나**(careful/usefull✗). 각 2패널(정답3+오답2)·교정 노출.
- **검증**: 6규칙 완주(i-before-e·e탈락·자음중복·y→ies·치찰음es·-ful) · done 12패널·6규칙·100% · pageerror 0. dev 메모리 캐시로 안정 서빙 확인.

### Windows dev 안정화 + 아케이드 실 어휘 배선 ①③② end-to-end 검증 완료 (v06.229)
- **dev 픽스**: `next.config.mjs` webpack — **Windows 한정 메모리 캐시**(`config.cache={type:'memory'}`). 원인: FS 캐시 `.next/cache/**/*.pack.gz` rename이 백신 파일락으로 간헐 ENOENT → vendor-chunks 손상 → 라우트 404/500·dev 서버 반복 사망(이번 세션 내내). 메모리 캐시로 pack.gz 쓰기 제거 → 근절. mac/linux는 FS 캐시 유지.
- **검증 완결**: 안정화 후 ③②를 실 단어장(교육과정 고등)으로 **end-to-end 확인** — ③ Lexicon Hands 손패=실단어(fiction·celebrate·vocabulary…)+어원태그(fic), done 도달·0에러 · ② Word Customs 여권=실단어(device: 명사·장치·실 예문 "keeps her electronic device charged")+생성 위조, 18여행자 진행·0에러. 내장뱅크 미감지(✅).
- **결론**: 아케이드 실 어휘 배선 **3종(① Glyph Tongue · ③ Lexicon Hands · ② Word Customs) 전부 end-to-end 검증 완료.** `?set=`/`?text=`로 학습자 실단어+실예문으로 플레이. authored ④⑤⑥은 콘텐츠 확장 영역.

### CTP 스테이지 카탈로그 밴드 매핑 근본 재보정 (v06.232)
- **근본 원인**: `csat_stage_catalog` VIEW 가 ① 아티클에 `register='argumentative'→S3` 특례(문체가 난이도 밴드를 덮음·비정합), ② 도서/비-argumentative 를 3버킷(v≤4→S1·v5-6→S2·v≥7→S4)으로만 나눠 **S3 밴드 사실상 부재**(argumentative 전용→굶주림), CSAT 핵심 v5-6 이 비활성 S2 로 밀림. v06.229(처방 누적 완화)가 표면화한 근본.
- **재보정**: articles·books 일관 4버킷 monotonic — **v≤2→S1 · v3-4→S2 · v5-6→S3(CSAT 핵심·활성) · v7+→S4(killer band)**. argumentative 특례 제거, NULL→S2 방어. derive_learner_stage coverage 게이트(S_n≈v[(n-1)×2,n×2))에 i+1 정합. 컬럼 시그니처 불변(grants/의존 안전). 마이그레이션 `20260713090000_ctp_stage_catalog_band_recalibrate`.
- **효과(라이브 실측)**: input 후보 S1:7·S2:50·S3:114·S4:12(전 밴드 populated); at-band DCP S2:48·**S3:762**·S4:564(S3 굶주림 해소). 현 S1 사용자 처방 input 5후보 유지(무영향), practice 비활성 정상. 유일 소비처 prescribe_today(input 정확매칭·practice 누적) 재검증.
- **DCP end-to-end 실증**: 실 사용자 전원 S1(다차원 게이트 — vocab+wpm+정확도+듣기)이라 DCP 미구동이던 것을, runtime-test에 `reading_fluency_log` 3건(wpm~160) 시드→**S3 안착**. prescribe_today: practice_active=true·5 items(order+insert)·75분. order 채점(source_order 역순열=정답) 로직 재현 correct=true. runtime-test **S3 데모-레디**(로그인 시 DCP 노출·fluency 3건 DELETE로 복귀). apps/web/CLAUDE.md 계정 라인 갱신.
- **헬스 체크 신설** `scripts/verify-dcp-health.mts` — 도달성 불변식(①밴드 populated ②도달 DCP S3≥100·S4≥300 ③고아 0)을 실행 가능 검증으로 codify(dev 서버 비의존·CI 배선 가능·회귀 시 exit 1). PASS 실측 S3=810·S4=1374. PostgREST 1000행 한계는 range 페이지네이션으로 처리(전량 1374 집계).

### CTP DCP 처방 도달성 수리 — 확대 콘텐츠 실제 활성화 (v06.229)
- **버그**: prescribe_today practice 블록이 `c.stage_band = v_band`(정확 밴드 매칭)로 DCP 선정 → 카탈로그 매핑(v≤4→S1·v5-6→S2·argumentative→S3·v≥7→S4)과 맞물려 **S3 밴드가 argumentative 7편에 굶주리고, CSAT 핵심 v5-6·v6도서가 비활성 S2에 갇혀** v06.228 확대(+782)의 ~95%가 학습자 도달 불가였음. (소비 경로 = `/practice/dcp`·hub 처방 ④ 모두 prescribe_today 단일 출처 — 검증.)
- **수리**: practice 블록만 `substring(stage_band)::int <= LEAST(v_num,4)`(누적 밴드) + `ORDER BY md5(id||current_date)`(일자-안정 로테이션 — 매일 다른 5·하루 내 고정)로 교체. VIEW 매핑·input 블록·활성 게이트 불변. 마이그레이션 `20260712190000_ctp_prescribe_today_dcp_band_cumulative`.
- **효과(실측)**: 도달 가능 DCP — **S3 학습자 64→810 items(7→69 refs, 12.7×)**, S4 564→1374(12→81 refs). S3 시뮬레이션 = v6도서(Oz·Fables)+expository v5+argumentative 혼합. 난이도 정확 캘리브레이션은 완화되나 순서/삽입(글 논리 훈련)엔 무해.

### CTP DCP 확대 — 순서/삽입 연습 592→1374 items (아티클+도서 v6, v06.228)
- **아티클 드라이버 신설** `scripts/generate-article-dcp.mts` — `dev-generate-items` 라우트(기본 register=argumentative·limit 20 → v5 7편에 정체)를 스탠드얼론 스크립트로 일반화. 동일 입력 게이트(설계 §T2: published·NOT display_only·license PD/CC·lexical_noise≤0.08)를 **전 register·무제한**으로 적용. dev 서버 비의존(service-role) → 재사용 자산. dry-run 기본 + `--apply`.
  - 결과: 적격 135편 중 64편에서 560 items upsert(멱등). article DCP **64→566 items**(7→64편), v_level **v5-only → v3~v7**. 핵심 = **CSAT 스위트스팟 expository v4~v7**(v6 204·v5 128·v4 36·v7 36) + reference v5/v6 86. narrative 13편은 문단 필터가 0 산출로 자기선별(대화체·단문 부적격 = 품질 게이트 정상).
- **도서 드라이버 floor 파라미터화** `scripts/generate-book-dcp.mts --floor=N`(기본 7 보존) — CSAT S3(v6) 확대. book DCP **528→808 items**(11→17권, v6 6권 신규·Poetry 0 산출 자기선별). v_level v5-8→v4-9(챕터 단위).
- **전체 DCP 592→1374 items**(+782), 결합 커버리지 **v3~v9 전 CSAT 사다리**, 81 refs. 런타임 LLM 0(generateDcpItems 결정론·멱등, 라이브 592 검증 엔진 재사용). 스팟체크: expository v6 order presented↔source_order 왕복 정합.
- **후속 정제 여지**: 일부 reference/travel 콘텐츠는 CSAT 학술 장르와 이질(순서 모호성 여지) — 필터가 구조 유효성은 담보하나 시험급 무모호성은 아님. 장르 순수화(expository/argumentative 한정) + v5/v2 도서(6권)는 옵션.

### 아케이드 실 어휘 배선 ② — Word Customs가 학습자 단어 여권으로 (v06.227)
- **배선**: `buildDaysFromPool` — 스코프 단어 → 여권. 진본(word·pos·뜻·예문 실데이터) + **결정적 위조 생성**: 뜻 위조(다른 단어의 뜻으로 swap = false friend 유사) · 품사 위조(실제와 다른 품사 표기). 예문은 단어/굴절형을 찾아 `{}` 블랭크. 3근무일(각 6), 규칙 누적(뜻→+품사, day1엔 품사위조 없음). 9단어 미만이면 내장 뱅크 폴백.
- **버그 예방**: word-customs page wordPool 전달 추가 + posKoFromData 부사 우선(‘adverb’⊃‘verb’).
- **검증**: **독립 로직 테스트 PASS**(3일·진본10·뜻위조4·품사위조1·전 여권 예문 {}·규칙 정합·품사 매핑 정확) + tsc 0. ①과 동일한(이미 실단어 end-to-end 검증된) 스캐폴드→wordPool 흐름. ⚠️ 런타임 렌더는 dev 서버 환경 이슈(webpack 캐시 rename 실패→청크 404, AV 파일락 추정)로 보류 — ①③②는 코드·로직 검증 완료, 환경 안정 시 확인.
- 실 어휘 배선 3종 완료(① Glyph Tongue end-to-end ✅ / ③ Lexicon Hands·② Word Customs 로직 ✅). authored 게임 ④⑤⑥은 콘텐츠 확장이 적합.

### UI 스모크 로그인 견고화 + 런타임 검증 (v06.222)
- **런타임 검증**(디스크 확보 후 단일 dev 서버): ScriptsBrowser "학습 지도" 재설계 + ArticleCard/CEFR/a11y 변경이 실브라우저 렌더·동작 확인 — 04-ui-smoke **4/4 통과**(주요 화면 콘솔에러 0·스크립트 드릴다운/복귀·도서관 필터·EchoMatch 게이트).
- **스모크 견고화**: `loginRuntimeUser`가 배치 실행 시 반복 로그인 스로틀/dev 컴파일 경합으로 waitForURL 타임아웃(false-fail) 잦았음 → **1회 재시도 + 타임아웃 25s** 보강. test1 단일 로그인이 견고해져 storageState 재사용 하위 테스트도 안정. (근본: STATE_PATH storageState 이미 재사용 구조 — test1 로그인만 flaky였음.)
- **환경 교훈**(재확인): 멀티 dev 서버(:3000/:3001/:3100)가 `apps/web/.next` 공유 → 라우트 무작위 404/500 오염 → 로그인 flow 붕괴. 검증은 **전 서버 종료 → .next 삭제 → 단일 서버** 필수(apps/web/CLAUDE.md 규약).
- **밴드 적응성 검증(단위+E2E)**: (1) `source-map.test.ts` 신설(18 테스트) — `getLearnerBand`/`buildScriptsMap`/`bandGuidance`가 초급(V2→listen 추천)·중급·고급(V9→최고심도 topic, 깊이 유도)·미진단(진단 유도)별 배너 카피·추천 트랙을 실집계로 결정적 검증. (2) 04-ui-smoke E2E — 실 로그인 세션에서 `current_v_level`을 V2/V5/V9로 바꿔 배너·지도가 밴드별로 flip 함을 단언(finally 원복). **정정**: 초기 "storageState 로 클라이언트 인증 불가" 는 오진 — 클린 단일 서버에선 브라우저 `getUser()` 200 정상(V11→"고급 안내" 확인), 앞선 실패는 멀티 dev 서버 `.next` 오염(청크 404→하이드레이션 미완)이 실체. 스크립트 오리엔테이션 e2e 도 hydration-견고 재클릭(toPass) 패턴으로 보강.

### 아케이드 실 어휘 배선 ③ — Lexicon Hands가 학습자 단어 속성 덱으로 (v06.226)
- **배선**: `buildDeckFromPool` — 스코프 단어 → 속성 태그 덱. **품사**(스캐폴드 실데이터 우선 + 형태론 휴리스틱 폴백: -ly→부사·-tion→명사 등) + **어원**(라틴/그리스 어근 41종 substring 감지: spect/port/dict/struct…) + **접두사**(27종 감지) 자동 태깅. 세션당 최대 40장, 12장 미만이면 내장 덱 폴백.
- **버그 수정 2건**: (1) lexicon-hands page가 `wordPool` 미전달(항상 폴백) → render에 추가. (2) `posFromData`에서 'ad**verb**'가 `/verb/`에 매칭돼 부사→동사 오분류 → 부사 검사 우선순위로 수정.
- **검증**: **독립 로직 테스트 PASS**(실단어 15장 덱 생성·전 카드 품사·어원 시너지 그룹 존재 spect[inspect/respect/suspect]·port[transport/export]·휴리스틱 품사 정확) + posFromData 7케이스 매핑 검증 + tsc 0. ①과 동일한(이미 실단어 end-to-end 검증된) 스캐폴드→wordPool 흐름. ⚠️ **런타임 end-to-end 렌더는 dev 서버 불안정(디스크 98% → .next 반복 손상·프로세스 사망)으로 보류** — 로컬 디스크 확보 후 `?set=<테마 세트>` 플레이로 확인 권장.
- 도메인 태그는 데이터 sparse/과광범위로 미사용(품사+어원+접두사 3축). authored 게임(④⑤⑥)은 배선보다 콘텐츠 확장이 적합.

### 추출 3경로 통합 (1단계 "새는 곳 막기") — 책·글·BYO 동일 규칙 (v06.225)
- **문제**: 단어추출이 책(`select_book_chapter_vocab`)·글(`select_article_vocab`)·학습자 직접입력(`extract_vocabulary_for_user_v2`, /text) 3경로가 서로 다르게 구현 → 같은 문장도 다른 결과("라이브러리선 뽑혔는데 내 지문선 왜?") = 신뢰 저하.
- **0단계 세보기**: 실 학습 corpus 표제어 **22,086**(검사 범위, 사전 절반) · 다의어 **10,492/45,667=23%**(실사용 중 31%). 3경로 구조적 상이 실증.
- **통합(drift 방지)**: 형태→품사 추론을 **공유 헬퍼 `infer_form_pos(surface,base)`** 로 추출 → 3함수가 인라인 복붙 대신 헬퍼 호출(이후 규칙 변경 한 곳만). book·article 리팩터(동작 동일, **회귀 0** 검증). **/text(BYO) 통합**: `resolve_dict_headword`(굴절/파생 해소)+`infer_form_pos` sense+노이즈 register 제외+표면형 표시 추가 → 책/글과 일치(galloped→gallop·ransomed→동사 뜻·uncomfortableness→uncomfortable 회수).
- **유지(정당한 차이)**: BYO 개인화(레벨 i+1·track 점수·아는단어 제외)·ephemeral·시그니처. 마이그 `20260713170000/171000/172000/172500`.
- **잔여**: BYO는 winkNLP를 안 거쳐 context_pos 없음(형태추론 폴백) → **winkNLP 배선(근본 파리티)은 후속**. 앱-측: /text 저장 시 표면형 대신 `matched_via_surface`(표제어) 저장 권장(SRS 쪼갬 방지).

### 다의어 sense 전면 완성 — 일반 사전급 다중 POS (v06.225, 진행형)
- **목표**: 사전 전체 단어가 실제 쓰이는 모든 POS sense를 갖도록(일반 사전급) → "ransomed→몸값을 치르고 풀어주다"처럼 형태에 맞는 뜻 추출.
- **병렬 파이프라인**: `sense-chunk.mjs`(단일-sense content 단어 빈도순 청크 분할) → **서브에이전트 병렬 authoring**(청크당 1 에이전트, 표준 영어 실재 POS만 보수적 추가, 애매하면 skip) → `sense-apply.mjs`(검증·일괄 적용: meanings_ko + flat pos/meaning_ko 동기화 + shared_words, 단일-sense 가드).
- **Wave 1 완료(rank 1700-6000)**: 수작업 고빈도 ~100(watch→보다·face→직면하다·bear→견디다/낳다·fine→좋은/미세한·count→세다·surround→둘러싸다·fast→빠른) + **서브에이전트 388**(steal→도루·milk→착취하다·desert→탈영하다·boot→부팅·march→행진하다·wolf→늑대 복원·manifest→나타내다·crisp→바삭한 등). rare-primary 오류(명사만/희귀뜻 primary) 다수 교정. 해당 범위 다중-sense 45%.
- **형태 POS 추론(마이그 `161500`)과 결합** → 추출 시 굴절/파생형이 형태에 맞는 sense로 나옴. Wave 2(rank 6000-9000) 등 후속 진행.

### 굴절형·파생형 해소 — 조회·도서 단어추출 양쪽 (v06.225)
- **문제**: 흔한 파생형은 표제어라 뜻이 나오나, rare 미등록 파생형(dreamlike·kinglike·boyishly)은 `not_found`; 도서 단어추출(`select_book_chapter_vocab`)은 winkNLP lemma 직접 매칭만 해 미매칭 굴절/파생형 탈락 → 학습자가 따로 찾아야 함.
- **lookup tier 5**(마이그 `20260713150000`): `lookup_word_meaning`에 **파생 해소** 추가 — 기존 4-tier(direct→규칙 역굴절→철자변형→inflected_forms cluster) 실패 시 투명 접미사(-ly/ily/ically/ness/iness/less/iless/ful/fully/ish/like/wise)를 벗겨 **base 표제어 뜻 폴백**. 검증: 굴절·파생 20종 전수 해소, `not_found` 0.
- **도서 추출 해소**(마이그 `20260713160000`+`160500`): `resolve_dict_headword(surface)` 헬퍼(direct→cluster→규칙 역굴절→파생 strip) 신설 → `select_book_chapter_vocab` JOIN을 이 헬퍼로 교체. **미매칭 굴절/파생형이 사전 뜻과 함께 회수**(darkish→dark·motherless→mother·uncomfortableness→uncomfortable). 시그니처 동일(호출부 무변).
- **쓰레기 방지**: 해소는 **base 표제어가 실재할 때만** → 규칙 날조 불가. 파생 strip은 base 길이≥4 + junk 제외로 과도 strip 방지(reely→ree·actuly→junk 차단). junk 표제어 `foreign_word_proxy`(actu) 1건 삭제. Huck Finn 방언 코퍼스로 검증 — study 목록 무오염.
- **추출 단어 = 실제 도서 표면형**(마이그 `20260713161000`): 도서에 "children"이 나오면 추출도 `word="children"`(+뜻), `lemma="child"`. 이전엔 표제어 child로 환원 표시 → 일반 사전처럼 실제 형태+뜻. dedup은 표제어 단위(중복 방지), 대표 표면형=챕터 최빈. ※ 방언 과다 코퍼스(Huck Finn)는 일부 오해소(chillen→chill·biler→bile) — 표준 텍스트엔 무해.
- **형태별 POS 추론으로 형태에 맞는 뜻**(마이그 `20260713161500`): "ransomed"(=ransom+ed)가 추출되면 **동사 뜻("몸값을 치르고 풀어주다")** — 표제어 대표 뜻(명사 "몸값") 아님. context_pos(winkNLP) 있으면 그것을, NULL이면 표면형↔표제어 형태차로 POS 추론(+ed/d/ied·+ing→verb·+ly→adverb·-tion/ness/ity→noun·-ous/ive/ful/less→adjective) → 맞는 sense 선택. 실증: ransomed·scented·tilted·scattering·grumbling 전부 동사 뜻. 맞는 sense 없으면 대표 뜻 폴백=polysemy gap 노출(예: boom 동사 sense 없어 booming→호황 → boom·ransom 동사 sense 보강). **완전 정확은 전 단어 sense 완비(polysemy) 필요** — 지속 사전 보강 대상.
- ⚠️ **forward 규칙 대량 생성은 부적합 확정**: 형용사→-ly 생성이 `unprotectedly`·`whitishly` 등 비표준 날조. runtime 역-strip 해소가 정답(base 실재 검증).

### 굴절형·파생형 추출 — 기존 인프라 확인 + 파생 검증소스 완결 (v06.225)
- **목표**: 굴절형·파생형이 "뜻 그대로" 단어추출/조회 되도록 (전체 사전).
- **핵심 발견 — 굴절형은 기존 인프라가 이미 처리**: 2026-06-13 v06.41 마이그가 구축한 `en_inflection_bases()`(규칙 역굴절)+`inflected_forms text[]`(불규칙/클러스터, GIN)+`english_irregular_forms`로 `lookup_word_meaning`(4-tier)·`extract_vocabulary_for_user_v2`(L2)가 굴절형 해소. 검증: galloped→gallop·studied→study·happier→happy(inflection)·children→child(cluster) 전부 뜻 그대로 ✓. **별도 굴절 표제어 생성 불요**.
- **⚠️ 규칙 표제어 대량 생성 시도→롤백**: SQL 규칙이 실단어 판별 못 해 쓰레기 날조(`abashederness`·`ablesness`, 형용사+복수/비교급 오적용+복합). 68,246 row 오염 즉시 전량 롤백. `clean-inflected-forms.mjs` 원칙("신규 규칙형 생성 안 함") 재확인.
- **파생형 = headword(자체 뜻) 완결**: `data/seed/derivational-candidates.json`(빈도 코퍼스 검증 실단어 2,494) 대비 미등록 93(recognise·regulatory·auditory·forestry·-ise/-ory/-ry 등) 채움 + 도서 rare 파생 114(ebullition·volubility·omniscience 등 C2) → **검증 소스 100% 커버**. `classified_by='claude_code_derivational'` 6,180→6,387. 사전 45,496→45,703.

### 사전 sense/POS 오정렬 근본 수리 Phase 2·3 — 문맥-sense 매칭 추출 (v06.225)
- **근본**: 큐레이션 단어추출에서 `creep="변태"` 등 문맥과 다른 뜻 노출 → 원인=`shared_dictionary` 단일-행 + v_level=최난이도 sense. 다의어의 기본 sense(저-V) 용법을 텍스트가 써도 행 v_level(고-V sense)이 V≥6 필터 통과 → 고급 gloss로 오추출(B류).
- **Phase 2 문맥 POS 저장**: `library_book/article_vocabularies` `context_pos` 컬럼(마이그 `20260712160000`) + winkNLP 백필(`backfill-context-pos.mts`, book 1,507·article 212) + 파이프라인 forward-wiring(`extract-lemmas` 지배 POS → ChapterWord → `insert_book_analysis` RPC `20260712170000` + article 직삽입) → 신규 도서 자동.
- **Phase 3 문맥-sense 매칭**: `select_book_chapter_vocab`+`select_article_vocab` LATERAL JOIN(`20260712165000`) — `context_pos`로 `meanings_ko` 문맥 POS 일치 sense 선택 → 그 sense v_level로 V≥6 필터 + gloss·pos 표시, NULL은 row 폴백.
- **검증**: creep(문맥 verb)→"기어가다" · sole(문맥 adj·sense v5)→Gibbon/Les Mis 추출 0건(기본용법 오추출 근절). tsc 0.
- **잔여 sweep 배치 1~3 — 고가치 후보(179) 전량 종결**: 코퍼스 POS 불일치 504건 → 고가치 179 → 배치1 40 + 배치2 109 + 배치3 tail 5 = **누적 154단어** sense 보강(누락 POS 추가·전 sense v_level·flat 정렬·형식 정규화). 발행 shared_words 동기화. context_pos 재백필. 실증: idle(형용사 문맥)→추출 제외(v5) · noble/breeze(문맥)→정확 gloss. flat flip: breeze→"산들바람"·pine→"소나무"(v5)·vacuum→"진공"·crumble→"부서지다"·refrain→"삼가다"·inevitable→"불가피한" 등. A류 오데이터: wan("WAN약어"→"창백한"). **종결 판정**: 남은 🟡·🔴는 (a) 인벤토리 완성돼 Phase 3가 이미 처리 (b) flat-primary 정답(grave→무덤) (c) 명사화/participle 노이즈 — 추가 실익 낮음.
- 사전 데이터 수리 누적 154단어(sense별 v_level 모델) — 상세 [dict-sense-quality-audit.md](proposals/dict-sense-quality-audit.md).
- **Phase 4 사전 전역 구조/POS 정규화**: 45,496단어 전수 스캔 → Phase 3를 구조적으로 무력화하던 결함 전량 근절. no_meanings 6,964→0(단일 sense 백필) · legacy string-array 773→0 · enrichment `sense_ko`키 2,045→`meaning` additive · **sense POS 약어(`n.`·`adj.`·`v.` ~5,000)→풀폼**(context_pos와 절대 매칭 안 되던 핵심 결함) · flat pos 흔들림 16→0. ~9,800단어(21%) 정합 → 사전 전역 균일 `{pos,meaning,v_level}` + 전 POS 풀폼, 수천 단어 sense-매칭 즉시 활성화(무손실·additive, 추출 회귀 정상).
- **Phase 5 레벨별 필드 완비 감사 + 예문 전수 채움**: 학습자-대면 필드를 v_level별 전수 점검(meaning/meanings/pos/cefr/v_level 100% · example 84.5%·ipa 64%·syn 59%·coll 31%…). 실 단일어 결측 **2,548개 예문을 Claude 생성으로 전수 채움**(15배치) → **전 레벨 V1~V11 example 100%**, 전체 사전 84.5%→**90.1%**. 잔여 결측 4,517=전량 관용구/구동사/다어절/고어(독립 예문 부적절). 후속: ipa(~10,594)·synonyms·collocations.
- **Phase 6 추출 품질 개선 항목 도출 + 항목1 구현**: 추출 게이트/스코어/조인 필드 전수 진단 → 6개 개선 항목 도출(word_register 노이즈·frequency_rank NULL 0.40손실·커버리지 갭 19.5%·다의어 완성도·spelling_variants·verified). **항목1 구현**: word_register에 `brand`·`abbreviation`·`proper_noun` 카테고리 신설(CHECK 확장 마이그 `20260713100000`) → 브랜드(™) 96·약어 129 분류 → 추출 함수 제외 확장(`20260713100500`). 검증: 3도서 추출 정상·노이즈 0. 상세 [dict-sense-quality-audit.md](proposals/dict-sense-quality-audit.md).
- **Phase 7 추출 결과 평가 기반 사전 보완**: 분석된 25권 전권 추출 집계(50,997 노출·distinct 14,704) → cap-40 진입 단어 직접 평가. 추출 품질 이미 높음(초기 플래그 대부분 false alarm) 확인 + **실 결함 7건 수리**(현대/기술 뜻만 있고 문학 대표 뜻 누락 패턴): bid(→명하다/작별)·tender(→다정한)·pardon(→용서/실례)·pin(→핀/시침바늘)·rear·rage·whip. shared_words 동기화. rank 샘플이 놓친 실 도서 다의어 gap을 추출 평가가 정확 포착.
- **Phase 8 도서 배치 채굴 루프(자동화 `scripts/lcp/dict-mine-batch.mjs`) — 100권 완료·yield 포화**: 5권 적재→추출·집계→사전 보완→도서 삭제(transient, 용량 절약) 무인 루프. seed 직접 INSERT + `reprocess-all-se --ids`(fetch+winkNLP) + `select_book_chapter_vocab` 집계(단일-sense·sort_order≤40·rank≤8000 후보를 등장 도서수 합산) + 삭제 + `curation_meta.dict_mined` 표시. **run1(50권)→2,903 후보→실 gap 16 수리**(drift·flush·quarrel·sin·despair·bundle·thrill·vain·blaze·spy·shield·thrust·divine·retreat·surge 동사/형용사 sense 누락 + **ah** abbreviation "암페어시" 오분류→interjection 교정). **run2(+50권=100권)→+430 신규(전부 등장≤4권)→실 gap 2**(articulate·lapse). 수동 15권 별도 ~18단어. **누적 mined ~115권·수리 ~36단어**. **yield 0.32→0.04 gap/book(8배 급락)=포화 확정** — 고빈도 다의어는 run1에서 전량 포착, 남은 SE seed는 이미 정확한 롱테일 희귀어. 근본 사전 전체 이슈 미발견(전부 per-word). 등장 도서수=임팩트 정렬이 핵심 효율 레버. 스크립트 dedup 버그(최종 write 정렬배열→재로드 중복) 수정.

### 아케이드 실 어휘 배선 ① — The Glyph Tongue이 학습자 단어+예문으로 (v06.224)
- **배선**: 스캐폴드가 이미 fetch하던 `example`(도서 챕터는 `source_sentence`=실제 책 문맥)·`pos`·`inflectedForms`를 그동안 버렸던 것 → `Word` 타입 +3필드로 게임에 전달. `GlyphTongueGame.buildChambersFromPool`: 스코프 단어의 예문에서 단어/굴절형을 찾아 룬으로 블랭크 → 석실 생성(세션당 최대 20단어=4석실). 예문 없는 단어 제외, 4개 미만이면 내장 뱅크 폴백.
- **버그 수정**: glyph-tongue page가 `wordPool`을 게임에 미전달 → 항상 내장 폴백. render에 `wordPool` 추가.
- **검증**: `?set=<교육과정 고등>` 진입 → 실단어(fundamental·veterinarian·joint·tackle·status) + 실 예문("Trust is a 〈룬〉 part of...")로 렌더, 내장뱅크 미감지(✅), 무차별 솔버 5/5 해독, pageerror 0. 비스코프 진입 시 내장 회귀 유지. tsc 0.
- 나머지 게임: ②세관·③핸드는 pos/domain·forgery 데이터 성격, ④⑤⑥은 authored 콘텐츠라 배선 방식 상이(후속).

### 도서 탭 「전체 탐색」 필터 재설계 — 묶음 카드 → 라벨 구획 상세 패널 + 내 학습 상태 (v06.223)
- **문제**: `/library/books` 전체 탐색이 한 카드에 나에게/레벨/장르/길이 칩을 작은 10px 라벨로 **뭉쳐 노출("묶음")** + 주제·연령은 "상세 필터" 숨김 disclosure 뒤. 학습자가 조건을 또렷이 판별하기 어려움.
- **재설계(`BookFilterBar`)**: 뭉친 카드 → **항상 펼친 라벨 구획**(`divide-y`) 상세 패널. 각 조건(내 학습·나에게·레벨·장르·주제·연령·길이·음성)이 좌측 고정폭 라벨 + 칩의 독립 compartment. 주제·연령을 숨김→상시 노출 승격, 오디오를 길이 그룹에서 분리해 '음성' 구획, 상세필터 disclosure 제거.
- **신규 필터 '내 학습 상태'**: 내 서재/학습 중/완료 — `enrollment_state` 기반, facet-adaptive(등록 도서 보유 시에만 노출). `BookFilters` +`enroll`·`FacetData` +`hasEnrollments`, `BooksExplorer` 필터 로직 + facet 집계 추가.
- **hydration mismatch 수정**: 주제 상시 노출로 표면화된 결함 — facet 주제 정렬 tie-break `localeCompare`(Node↔브라우저 collation 상이로 순서 엇갈림)를 code-unit 비교로 교체(`BooksExplorer`). 이전엔 주제가 disclosure에 숨겨져 초기 렌더에 없어 잠복.
- **장르 분류 품질 보정(Part A)**: `bucketOf`(genres.ts) 키워드 보강 — `우화`→동화·청소년, `학술·정책·보고서·논픽션·사회학·교과서`→인문·논픽션. `essay_philosophy` 라벨 `에세이·철학·전기`→`에세이·인문·논픽션`(비문학 정직 반영). NULL 폴백→'문학·소설' 한계 주석화. 레벨칩 테스트를 hydration 재시도(toPass+리로드)로 견고화.
- **장르 분류 품질 보정(Part B)** — DB 백필(사용자 명시 승인 "실행"): 발행 genre_norm NULL 2권 `library_books.curation_metadata` additive 병합 — `Introduction to Sociology`→`사회학 교과서`(→인문·논픽션), `Pride and Prejudice`→`로맨스 소설`(→로맨스). 결과: 발행 7권 중 literary(문학·소설) 버킷 **0** = NULL→문학 오분류 완전 해소. 스키마 변경 無(데이터 UPDATE). 잔여: 미발행 NULL 10권은 추후 큐레이션 백필.
- **길이 버킷 세분화**: `reading_minutes` 3버킷(짧게/보통/길게 — 카탈로그 73%가 '길게'>4h에 쏠림)→**5버킷**(~1h/1–4h/4–10h/10–20h/20h+, 임계 60/240/600/1200분). 20h+ 대작(로마제국 120h)을 장편과 분리 → 읽기 부담 판단 명확. 길이 구획도 **facet-adaptive**로 전환(빈 버킷 숨김). `genres.ts`(LENGTH_BUCKETS/lengthBucket)+`BooksExplorer`(lengths facet)+`BookFilterBar`. 검증: SSR로 발행 7권 짧게/4–10h/10–20h/20h+ 노출·빈 1–4h 숨김 확인.
- **범위 밖(사용자 선택)**: CEFR 병기·형식자료 신설·칩별 카운트는 제외. 레벨=V밴드 유지(CEFR=카드 배지 보조).
- **검증**: tsc 0 · eslint 0(변경 `BookFilterBar`·`BooksExplorer`). 04-ui-smoke에 "전체 탐색 필터 구획 렌더 + 레벨칩 7→2 축소 + 초기화 원복 + 콘솔에러 0" 회귀 테스트 추가 → **통과**(격리 실행 40.8s). 전 화면 콘솔에러 테스트도 `/library/books` 포함 10화면 통과(53.8s). 검증 전 워크스페이스 `next dev` 2개 동시 기동→`.next` 공유 오염(라우트 무작위 404) 발견·단일 서버 정리로 복구.

### `/library/scripts` 학습 지도 재설계 — 소스/시리즈 선택 오리엔테이션 (v06.222)
- **문제**: 스크립트 탭이 트랙 섹션 + 얇은 한 줄 소개 + fit 배지뿐 — `source-map.ts` 의 풍부한 오리엔테이션 데이터(능력·학습과학 why·학습법 단계·난이도 V밴드)가 **전부 미사용**. 다양한 레벨의 학습자가 "어떤 소스/시리즈를 왜/어떻게 고를지" 판단 근거 부재.
- **재설계(기본 뷰)**: 개인화 배너 → **난이도 지도**(쉬움→어려움 축 + "여기 있어요" 마커 + 시리즈 칩·추천 강조) → 바로 시작할 글 strip → **시리즈 오리엔테이션 카드**(능력 칩 + why(Lora italic) + 학습법 ①②③ + 레벨범위·편수·음성 + 대표글 + 골라보기 CTA).
- **레벨 밴드 적응**: `getLearnerBand` (미진단/초급/중급/고급) + `bandGuidance` — 미진단은 진단 유도(/diagnostic), 고급은 "대부분 수월" 솔직 안내 + 논증·데이터·원문 깊이 유도. `buildScriptsMap` 이 실집계(V범위·편수·음성·fit·idealCount·추천 트랙) 계산 — **하드코딩 0**.
- **신규 컴포넌트 3**: `DifficultyMap` · `TrackOrientationCard` · `ScriptsGuideBanner`. `source-map.ts` +`LearnerBand`/`buildScriptsMap`/`bandGuidance`/`articleFitRank`/`byRecommendedArticle`/`vToCefrLabel`/트랙 `short`. `ScriptsBrowser` 재작성(추가 fetch 0). 04-ui-smoke 마커를 "난이도 지도" 로 강화.
- **검증**: tsc 0(변경 6파일) · eslint 0 · SSR 렌더 200(배너·지도·마커·추천 리본·6 시리즈 카드 마커 전부 확인). e2e 로그인 beforeAll 은 Supabase auth 경합으로 환경성 실패(스크립트 화면 미도달·본 변경 무관).

### LCP 도서 단어장 라벨 드리프트 수정 — (V{bvl}+)→(V6+) (v06.221)
- **드리프트**: 도서 챕터 단어장 description 이 `(V{book_v_level}+)` 표기(예 V7 도서 "V7+")였으나 단어는 `select_book_chapter_vocab` 의 **P1 고정 floor=V6** 선정 → 라벨/내용 불일치.
- **수정**: `publish_book_word_sets` description 한 줄 `(V6+)` 정합(CREATE OR REPLACE, 제목·slug·메타·선정 전부 불변) + 로컬 마이그 기록.
- **백필**: 기존 발행 세트 **829건** description `(V{n}+)`→`(V6+)` (regexp_replace). 검증: non-V6 잔여 0 · V6 라벨 909.

### 사전 sense/POS 품질 감사 — 다의어 primary 오선정 수리 (v06.216)
- **발견**: 큐레이션 단어추출 검증에서 `creep="변태"`·`founder="침몰하다"`·`spiritual="흑인 영가"`·`bay="적갈색의"` 등 **흔한 sense를 누락하고 특수·희귀 sense를 primary로 선정**한 사전 오류(근본=추출 아닌 shared_dictionary 품질). 발행 mid-rank 다의어 오류율 ~8%.
- **수리**: 11단어 사전 교정(creep→기어가다·nettle→쐐기풀·founder→창립자·spiritual→영적인·bay→만·steam→증기 + shed·sacrifice·grip·echo·faint 누락 sense 보강) + **발행 `shared_words` ~130 appearance 전파**(creep 19세트·faint 23·echo 18 등, `meaning_ko`+`part_of_speech`).
- **잔여**: 전수 근절은 다의어 배치 Claude 재검수(`dict-enrich`) 필요 — 탐지 기계화 어려움(특수 sense primary 판단=Claude). 예방책=문맥 POS 저장+`meanings_ko` sense 선택(RC2/RC3). 설계 [dict-sense-quality-audit.md](proposals/dict-sense-quality-audit.md).

### 아케이드 신개념 6종 module_id enum 마이그 **적용** — persistence 활성 (v06.220)
- DB 마이그 `add_arcade_newconcept_module_ids` **적용 완료**(2026-07-12) — `module_id` enum +6값(glyph-tongue/word-customs/lexicon-hands/lexicon-detective/morpheme-rules/silent-rule). 순수 additive(IF NOT EXISTS). DB 검증: pg_enum 6값 존재 확인. 로컬 미러 `supabase/migrations/20260712180000_*.sql`.
- 효과: 아케이드 **12종 전부** FSRS `learning_records.module` / `scores.module` persistence 활성(기존 6종 20260711 + 신개념 6종). 게임 onCorrect/onWrong→기록 저장 완성.

### 아케이드 신개념 게임 ⑥「The Silent Rule」 — 철자 규칙 귀납 (The Witness 계열) · **도시에 6 신개념 완결** (v06.219)
- **메커니즘(독창)**: **설명이 없다.** 각 패널에서 '규칙을 지키는 칸'만 활성화. 오답들이 모두 같은 규칙을 어기게 설계 → 여러 패널을 풀며 규칙을 **스스로 귀납**(오답 시 "N칸 어긋남"만, 어디인지 비공개=귀납 보존). 클러스터 완료 시 규칙+교정 공개. 미로가 아니라 철자·형태 규칙의 **발견 학습**(desirable difficulty = 가장 깊은 정착).
- **3규칙**: ① i before e, except after c · ② 어미 -e 탈락 후 -ing · ③ 단모음+단자음 자음 중복. 각 2패널(정답3+오답2). 교정 노출(recieve→receive…)로 정답 각인.
- **배선**: `SilentRuleGame` + `/play/silent-rule`(minWords=0) + 세렌 섬 무드(Witness) + 패널-라인 마크/워터마크 + 허브 12번째 포탈 + SESSION_META. TS 3유니온 +silent-rule.
- **검증**: 실플레이 7항목 — 오답 "N칸 어긋남"(비공개)·규칙3 귀납·교정4·done 효율86%·모바일 0오버플로·tsc 0·pageerror 0.
- 🎉 **아케이드 6→12종. 명작 해부 도시에의 6 신개념(①글리프 ②세관 ③핸드 ④디텍티브 ⑤형태소 ⑥무언규칙) 전부 실구현·검증 완결.** 뻔한 퀴즈 0. 누적 자동검증 58항목 PASS.
- ⏳ DB `module_id` enum +6종(glyph/customs/hands/detective/morpheme/silent) 마이그 대기.

### 아케이드 신개념 게임 ⑤「Morpheme Rules」 — 형태소가 곧 의미 (Baba Is You 계열) (v06.218)
- **메커니즘(독창)**: 형태소 블록(접두사+어근)을 조립하면 **그 단어의 뜻이 세계에 발동** — UN+LOCK→🔒열림, RE+BUILD→다리 재건, EN+LARGE→발판 확대. 애너그램(=Letter Forge)이 아니라 **형태론 조립 = 세계 변형**. 이중 연역: ①실재 단어인가(형태론) ②그 뜻이 이 장애물에 통하는가(의미). 함정: `discover`처럼 실재하지만 오적용 → "통하지 않는다".
- **학습**: 접사 의미(un=제거·re=다시·en=만들다·dis=반대·over=과도)와 의미의 **합성성**을 체득 = 생성적(L4b) 지식. 라이브 실재검증(✓/✗) 피드백.
- **배선**: `MorphemeRulesGame` + `/play/morpheme-rules`(minWords=0) + 미니멀 슬레이트 무드 + 블록 마크/워터마크 + 허브 11번째 포탈 + SESSION_META. TS 3유니온 +morpheme-rules.
- **검증**: 실플레이 10항목 — 라이브 ✓/✗·없는단어·발동효과·2회랑 정타·오적용 "통하지 않는다"·done 효율86%·모바일 0오버플로·tsc 0·pageerror 0. **아케이드 6→11종(①글리프 ②세관 ③핸드 ④디텍티브 ⑤형태소 신설, 도시에 6 신개념 중 5 완료).**
- ⏳ DB `module_id` enum +5종 마이그 대기.

### 아케이드 신개념 게임 ④「Lexicon Detective」 — 장면 수확·서사 재구성 (Golden Idol 계열) (v06.217)
- **메커니즘(독창)**: 현장 단서(증거 카드)를 조사해 **단어를 수확** → 그 단어들을 서사의 빈칸(의미역 제약)에 배치해 **사건을 재구성**. **함정 단어(distractor)** 포함 → 뜻·역할을 알아야 풀리는 연역(클로즈가 아니라 장면 교차 추리). 해결 시 빈칸이 채워지며 **범행 서사가 하나의 이야기로 완성**되는 페이로프.
- **학습**: 풍부한 시각 문맥(이중부호화)에서 단어를 만나고, 품사·의미·의미역을 알아야 배치 성공. 2사건(서재·유언장) 각 8단서·6빈칸(정답 6 + 함정 2).
- **배선**: `LexiconDetectiveGame` + `/play/lexicon-detective`(minWords=0) + 세피아 수사 무드 + 돋보기 마크/워터마크 + 허브 10번째 포탈 + SESSION_META. TS 3유니온 +lexicon-detective.
- **검증**: 실플레이 8항목 — 조사→수확 8·2사건 정타 100%·**함정 배치 시 "어긋남"**·done 정확도100%·단서12·모바일 0오버플로·tsc 0·pageerror 0. **아케이드 6→10종(①글리프 ②세관 ③핸드 ④디텍티브 신설).**
- ⏳ DB `module_id` enum +4종(glyph/customs/hands/detective) 마이그 대기.

### 아케이드 신개념 게임 ③「Lexicon Hands」 — 어휘 속성 시너지 엔진 (Balatro 계열) (v06.216)
- **메커니즘(독창)**: 포커가 아니라 **조커 시너지로 배수를 폭발**시키는 덱빌딩. 단어 카드가 공유하는 속성(어원·품사·도메인·접사·반의어)으로 **족보**를 만들어 칩×배수 → 언어 조커(학자=학술+20칩·접사수집가=접사런 배수×2·고전어=어원+8칩)로 증폭 → 라운드 목표 격파. 24장 속성-태그 덱, 손패 8, 3라운드 누적 목표(260/620/1300).
- **학습**: 족보를 만들려면 **어원·품사·의미장·접사**를 알아야 함 → 뜻 암기 너머 **깊은 어휘 지식(depth)** 훈련. 라이브 chips×mult 프리뷰.
- **배선**: `LexiconHandsGame` + `/play/lexicon-hands`(minWords=0) + 무디 테이블 무드 + 카드 마크/워터마크 + 허브 9번째 포탈 + SESSION_META. TS 3유니온 +lexicon-hands.
- **검증**: 실플레이 7항목 — 손패8·조커3·라이브 프리뷰·최적 봇 전 라운드 격파("엔진 폭발" 2,692점)·**난도 밸런스**(대충하면 R3 막힘, 숙련시 클리어)·모바일 0오버플로·tsc 0·pageerror 0. **아케이드 6→9종(①글리프 ②세관 ③핸드 신설).**
- ⏳ DB `module_id` enum +glyph-tongue/word-customs/lexicon-hands 마이그 대기.

### 도서 난이도 v2.4 파이프라인 자동 편입 — 신규 도서 자동 산정 (v06.215)
- **`compute_book_difficulty(book_id)`** SQL 함수 신설(migration `20260712140000`, MCP execute_sql 적용) — v2.4 앙상블(ease-게이트 어휘+통사 병목+커버리지 범프)을 DB 이식. 파이프라인-계산 신호(vrl_components·syntax_score·lemma_coverage_pct·cefrj) 사용, **F-K 없으면 sent_p90+clause_depth 대체**(graceful). **claude_v 있으면 미덮음**(v3 가드) + `book_v_level_v1` 원본 보존.
- **배선**: `lcp/dev-process` `compute_book_syntax` 직후 `compute_book_difficulty` 호출 → 신규 도서가 옛 p75 단축 대신 **자동 v2.4** 산정.
- **검증**: Huck claude_v 임시제거→함수 실행 auto_v=**6**(스크립트 v2.4 일치·covbump 1.4·미매칭 26%·v2.4_sql)→복원. tsc clean.

### 아케이드 신개념 게임 ②「Word Customs」 — 위조 적발 (Papers Please 계열) (v06.214)
- **메커니즘(독창)**: 영어 **입국심사관**. 단어의 여권(철자·품사·뜻·예문)을 **일자별 누적 규칙서**와 대조해 **위조 적발** → 승인/거부 스탬프 + 거부 시 **위조 항목 지목**(철자/품사/뜻/예문). 정답 맞히기가 아니라 **오류 탐지**(무엇이 왜 틀렸나로 각인).
- **위조 18종**: false friend(sensible=분별있는≠민감한, library=도서관≠서점, familiar=익숙한≠친척의…) · 철자 트랩(recieve/seperate/definately) · 품사 오용(success 명사≠형용사, economic 형용사≠명사). 3근무일 규칙 누적(뜻→+철자→+품사).
- **배선**: `WordCustomsGame` + `/play/word-customs`(minWords=0) + 세피아 심사대 무드 + 여권 마크/워터마크 + 허브 8번째 포탈 + SESSION_META. TS 3유니온 +word-customs.
- **검증**: 실플레이 7항목 — 정타 18여행자 100%·위조 10적발·오심 케이스("오류")·done 3,880점·모바일 0오버플로·tsc 0·pageerror 0. 아케이드 6→8종(①글리프 ②세관 신설).
- ⏳ DB `module_id` enum +glyph-tongue,+word-customs 마이그 **대기**(미적용 시 fire-and-forget 흡수, 동작 무관).

### 도서 난이도 — p75 재평가 + v2.4 hidden-difficulty 자동화 (v06.213)
- **p75 재평가**: 어휘축 대안 비교(Claude 대비 MAE) — type-p75 **1.17**(최선) vs weighted_avg 1.62·token-cov90 1.40·cov95 2.00. token-커버리지(`lexical_coverage`)는 이론(i+1) 정합이나 짧은책·희귀꼬리로 노이지 → **p75 유지 확증**(대안 기각).
- **v2.4 자동화**: `lemma_coverage_pct`(사전 매칭률)=방언/외래 탐지 신호 발견 — **Huck Finn 74.1%** vs 타 90-95%(방언어 미매칭 → p75가 못 봄). `covBump=f(미매칭율)` 추가(Huck auto 5→6 부분보정, auto-MAE 0.48→0.43) + 저커버리지(≥20%)=확신감쇠·플래그(신규 도서 Claude 검토 유도). **Claude 검토 도서(claude_v)는 v3 가드로 자동값 미덮음**. `scripts/apply-book-difficulty.mjs` v2.4.
- 한계(정직): 완전 Claude-대체 불가(극단 방언은 문학판단) — 자동경로=부분보정+잔여 플래그.

### 도서 난이도 v2.3 — Claude 전문가 캘리브레이션 (외부 앵커 100% 달성) (v06.212)
- **작업**: LCP 대량 GET 도서 **전체 대상 25권(published 23 + ready 2)**을 **Claude(LLM-as-expert)가 본문샘플+문학지식으로 한 권씩 큐레이션 평가** → 플랫폼 v2.2와 대조 → Claude 판정을 강추정기로 편입해 정확도 고도화. **Claude 캘리 커버 100%**(25/25). ready 대작 Dialogues(Plato) V9·Les Misérables V8 편입(발행 timeout이나 학습가치). `scripts/calibrate-book-difficulty-claude.mjs`(published+ready).
- **텍스트 지표 사각지대 교정**(v2.2 앙상블이 구조적으로 못 봄):
  - **방언(eye-dialect)** — Huckleberry Finn V5→**7** (방언어=짧아 F-K↓·흔한 lemma=V↓로 지표가 못 봄; Twain 서문 "a number of dialects" 명시). 텍스트 지표 최대 사각지대.
  - Kipling 조어·율문 Just So V5→7 · 철학 추상 Book of Tea V6→7 · 아동 운문 Poetry V7→5.
  - 검토 8권 해소: Gibbon **11**·Foundational **8**·Alice Adams(CEFR-J C1 과대) **6**.
- **공식**: `v3 = round(0.65·claude_v + 0.35·ensemble_v2)` · `difficulty_v2.{claude_v, claude_note, v3}` 감사저장 · `book_v_level_v1` 원본 보존.
- **정확도 결과**: 외부 앵커(고전 published 난이도 consensus) 적중 **90%→100%**(10/10). `scripts/verify-book-difficulty.mjs` 갱신(적용값 기준). 잔여: 신규 도서 자동화용 사각지대 감지 프록시(비표준 orthography 비율).

### 아케이드 신개념 게임 ①「The Glyph Tongue」 — 문맥 해독 (Chants of Sennaar 계열) (v06.211)
- **배경**: 명작 10종 해부 도시에(설계 덱) → "뻔한 퀴즈류 탈락, 핵심 루프 훔치기" → 최우선 빌드 ①번 프로토타입 구현.
- **메커니즘(독창)**: 목표 단어를 **미지의 절차적 룬**(단어 해시→결정적 SVG)으로 제시. **뜻을 절대 주지 않음** — 한 룬이 2개 영어 비문에 반복 등장 → 학습자가 **문맥으로 삼각측량**해 의미 추론 → 코덱스에 가설 배치 → **봉인(검증)** → 맞으면 룬이 영어 단어로 풀리며 **비문 전체가 읽히기 시작**(에피파니 페이로프). 3석실×5룬 내장 뱅크.
- **학습**: 문맥 추론(원칙 #5 맥락) + 능동 인출·검증(#1) + 룬→단어 이중부호화(#4). 얕은 고르기가 아니라 추론.
- **배선**: `GlyphTongueGame` + `/play/glyph-tongue`(scaffold minWords=0) + AmbientBackground 파스텔 필사본 무드 + glyph 마크/워터마크 + 허브 7번째 플래그십 포탈 + SESSION_META. TS 3유니온(ArcadeGameId/ModuleId/ScoreModule) +glyph-tongue.
- **검증**: 실플레이 하니스 — 3석실 정답 배치→봉인→"비문을 읽어냈다" 전부 통과, done 15룬·100%·3석실, 스크린샷(룬 비문·해독 후 가독), tsc 0·pageerror 0·console 0.
- ⏳ DB `module_id` enum +glyph-tongue 마이그레이션 **대기**(미적용 시 audit/scores fire-and-forget 흡수, 게임 동작 무관 — 기존 6종과 동일 패턴).

### VRL Phase2 런타임 함수 스키마 드리프트 기록 12종 (v06.220)
- **최우선 재현성 복구**: 진단·프로필·자동상향 런타임 함수 **12종**이 committed 마이그레이션 부재(out-of-band)로 DB 재구축 시 DiagnosticClient/VLevelPromotionCheck/pg_cron RPC 전부 붕괴 위험이었음.
- **정확 대조**: admin_vrl_*(6)·is_admin 은 마이그 존재(드리프트 아님) 확인. 실제 부재는 의존 closure **12함수** — `effective_confidence`·`calculate_next_review_due`·`update_user_v_level`·`analyze_diagnostic_result`·`analyze_track_diagnostic_result`·`apply_diagnostic_result`·`analyze_and_apply_{diagnostic,track,comprehensive}_result`·`auto_promote_{v_level,track_level}_for_user`·`cron_auto_promote_all_users`.
- **기록**: 현 DB 정의를 pg_get_functiondef 로 덤프해 의존 순서 기록 마이그(동작 변경 0). **참조 테이블·컬럼도 기록 완결** — `user_level_snapshots`(25컬럼·5FK·4CHECK·4인덱스)·`vrl_data_integrity_concerns` CREATE TABLE + user_profiles Phase2 컬럼(`current_v_level_meta`·`target_v_level_meta`·`learning_activity_score`·`next_level_review_due_at`·`segment`·`total_words_*`) ALTER, 전부 `IF NOT EXISTS`(멱등). ⚠️ 잔여: 진단 문항 시드 데이터 + user_level_snapshots own-data RLS 정책.

### VRL/VCB 파이프라인 종합 점검 + 5개선 (v06.219)
- **점검**(2-agent 정찰 + DB 실측): VRL 4축 분류(shared_dictionary 45,496어) — v_level·meaning·cefr 100%. VCB seed→enrich→큐레이션→발행→학습자 전 구간 배선 확인(cast-2000 audit chain 온전).
- **개선 5건**:
  1. **추천/컬렉션 딥링크 죽은 앵커 (교차 버그)** — 추천 카드·진단결과·VCB 컬렉션/런이 `#set-{slug}`로 링크하나 학습자 카드는 `id="set-{UUID}"` → slug(≠uuid·NULL 다수)라 `:target` 하이라이트 전부 불발. **4곳 `#set-{set_id}`(UUID) 정합**(RecommendedSetsSection·DiagnosticClient·collections·runs).
  2. **/admin/vrl/automation requireAdmin 누락** — 형제 VRL 페이지와 달리 RSC 가드 결손(3층 규약 위반) → `requireAdmin` 추가.
  3. **vcb_publish_commit 스키마 드리프트** — 발행 전량 의존 RPC가 마이그 부재(proposal "미적용" 표기, DB엔 실존) → DB 덤프로 기록 마이그(재현·감사).
  4. **admin 진단 페이지 stale 안내** — "L0/L1/L2 미분류"(실제 100% 완료) + `apply_diagnostic_result`(실제 `analyze_and_apply_diagnostic_result`) 정정.
- **관찰(리포트 권고·미수정)**: shared_dictionary track/domain/skill 축 ~7,100어 NULL(후속 추가어 미분류) · **VRL/VCB Phase2 런타임 다수 함수·테이블이 마이그 이력 밖(DB-only)** — 재현 불가(대규모 기록 필요) · track auto-promote 미배선 · VCB 큐레이션 일괄에 비-enriched 혼입.

### LCP G1 book 추천 링크 수정 (v06.218)
- book_iplus1 추천(`recommend_word_sets_for_user`)이 `/library/vocab#set-{slug}`로 링크되나 그 페이지가 library_book 제외+slug NULL이라 죽은 앵커였음 → `library_book` 카테고리는 **도서 브라우즈(`/library/books`, i+1 레일)로 라우팅**. (deep-link는 RPC에 book_id 노출 필요 — 후속.)

### LCP 도서 파이프라인 종합 점검 + 6개선 (v06.215)
- **점검**(3-agent 정찰 + DB 실측): 발행 도서 23권(SE 14·gutenberg 4·storyweaver 2·lit2go/pressbooks/wikibooks 각 1). 4축 난이도·챕터·단어장 전권 완비. 콘솔 9탭 + book_curation_jobs 큐(Claude 드레인) + 학습자 8접점(브라우즈·enroll·읽기·챕터단어장·plan·처방·모듈·CTP) 추적.
- **개선 6건**:
  1. **표지 6권 백필** — Alice·Sherlock(gutenberg cover.medium.jpg) + Oz·Fables·Just So·Railway Children(SE og:image). 각 URL curl HEAD 200 image 실검증. (lit2go/pressbooks/wikibooks 3권은 표지 소스 없음 = NULL 정당.)
  2. **CATALOG_SOURCES 통계 누락** — storyweaver/pressbooks 미포함 → 통계 칩 항상 0(ACP VALID_SOURCES 동류). 8종 정합.
  3. **SeedCatalogRow.source 타입 stale** — lit2go/storyweaver/pressbooks 추가·openstax 제거.
  4. **ScriptQuiz 챕터 "본문으로" 잘못된 id** — `/text/{bookId}`(library_books.id→조회 실패→mock 폴백)→`/library/books/{bookId}`.
  5. **plan 도서 발행게이트 불일치** — plan picker가 `status='published'`만 검사 → 브라우즈엔 없는 KR-unsafe 도서가 plan에 뜨고 enroll 실패. `copyright_safe_in_kr`+`published_at` 정합.
  6. **스키마 드리프트 기록** — `compute_book_vrl`/`compute_book_cefrj`/`compute_book_coverage` 함수 본체가 마이그레이션 부재(out-of-band) → DB 덤프로 기록 마이그(재현·감사 복구, 동작 변경 0).
- **관찰(리포트 권고·미수정)**: G1 book_iplus1 추천 죽은링크(`/library/vocab`가 library_book 제외+slug NULL) · G4 Dictation 도서챕터 미스코핑 · auto_curate 게이트지표≠발행지표 · prod 워커 pressbooks/compute_book_difficulty 미배선(dev 비대칭) · chapter_count≤100 상한 · set 라벨 드리프트("V{bvl}+" vs 실 V6 floor).

### ACP UI 디자인 부채 백로그 + 안전 2수정 (v06.214)
- **백로그** [acp-ui-a11y-backlog.md](proposals/acp-ui-a11y-backlog.md): 12 컴포넌트 감사 산출을 P1(대비)~P4(정체성) 우선순위·파일위치·수정법으로 정리. 색/레이아웃/정체성 변경 항목은 **시각검증(dev 서버) 트랙**으로 분리(블라인드 편집 회귀 방지).
- **안전 2수정**: GetGuidePanel `open:shadow-[var(--shadow-sm,none)]` 오타(그림자 영구 미적용)→`--sh-sm` · BulkArticlesTab 소스 우선순위 뱃지 `'white'` 하드코딩→`var(--ti)` 토큰화(시각 동일).

### ACP 콘솔 키보드 포커스 보강 — focus-visible 14 컨트롤 (v06.213)
- **BulkArticlesTab (9)**: 대량 가져오기·삭제·큐추가 액션 버튼 + 학습자레벨·정렬·발행·audio 세그먼트 토글 + 조건 접기. **CuratedArticlesTab (5)**: 전체/행 선택 아이콘 버튼·드레인 배너 버튼·발행 버튼.
- 순수 additive(focus-visible ring만) — 색·레이아웃 회귀 0(WCAG 2.4.7). tsc clean.
- 잔여(다음 트랙·시각검증 권장): 44px 터치타겟 확대 · `--admin` 토큰 채택 · ScoreBar 중복 통합 · 저빈도 필터칩 focus.

### 학습자 기사 브라우즈 a11y 패스 — CEFR 배지 대비 + 44px/포커스 (v06.211)
- **ArticleCard**: CEFR 배지를 `text-white`(고정 흰 글씨) → **틴트 패턴**(색=텍스트·배경 color-mix 15%)으로 통일 — 소스/적합도 배지와 동형. A1 파스텔뿐 아니라 **다크모드에서 밝은 토큰(`--p` 등) 위 판독 실패**까지 근본 해소(양 테마·전 레벨 대비 보장). "학습하기" 버튼 `min-h-[44px]`+active, 원문 링크 36→44px + focus-visible + active.
- **ScriptsBrowser**: 묶음 필터 해제 X 버튼 16→24px, 빈상태 초기화 버튼 focus-visible + active 보강.
- 범위: 학습자 노출 최다 2컴포넌트 우선. 콘솔측 systemic 부채(BulkArticlesTab focus-visible·44px, `--admin` 토큰, ScoreBar 중복)는 다음 트랙 — 브라우저 시각검증 가능 시점 권장.

### ACP 신규 소스 2차 심층 재점검 — owid 본문 정제 + A1 대비 교정 (v06.210)
- **6개선 재검증**: 1차(v06.209) 개선 전부 유지 확인 — 제목 엔티티 0 · syntax NULL 0 · 라벨/필터 코드 반영.
- **owid 본문 품질 (신규 발견)**: owid 8기사 전량이 본문에 hex 엔티티 + 각주(Endnotes)·BibTeX 인용(Cite this work)·라이선스 안내(Reuse this work freely) 트레일러 누출(본문의 16~41%). 읽기·어휘 추출 오염.
  - **파서 근본 수정** `owid.ts`: htmlToPlainText 후 최초 트레일러 마커에서 본문 절단.
  - **기존 8기사 백필**: 엔티티 디코드 + 트레일러 절단(예 22,888→19,187자) + word_count·syntax_score·article_v_level 재계산. 검증: URL·엔티티·보일러플레이트 0.
- **접근성 defect 교정** `ArticleCard`: CEFR 배지가 흰 글씨인데 A1=`#86EFAC`(파스텔·대비 ≈1.4:1)라 판독 불가 → 대비 통과 녹색(`#15803D`)으로 교정.
- **디자인 감사(12 컴포넌트)**: 광범위 pre-existing 부채 확인 — 44px 미만 터치타겟(전반)·focus-visible 누락(BulkArticlesTab ~15곳)·하드코딩 소스/CEFR hex 팔레트(ArticleCard, 다크 무대응)·`--admin` 토큰 미사용(전 admin이 `--p`)·ScoreBar 중복/임계값 불일치. **신규소스 범위 밖·광범위라 미수정, 리포트에 우선순위 권고로 기록**(모범: CoverageMatrix 색+빗금+텍스트 3중부호·CandidateTable 아이콘 구분).

### ACP 신규 소스 전 파이프라인 자동 점검 + 5개선 (v06.209)
- **점검**(3-agent 정찰 + DB 실측): 신규 소스 noaa/usgs/owid/factbook/elife **전 5종 발행 성공**(4/5/8/7/2건) · 10개 배선지점·게이트·drift-lock 전부 등록 확인 · 학습자 6접점(브라우즈/읽기/단어장/plan/처방/CTP·모듈) 도달 경로 추적. 백엔드 파이프라인 건전.
- **개선 5건**:
  1. **seed-list 후보 필터 버그** — `seed-list/route.ts` `VALID_SOURCES` 6종만 → `?source=noaa` 등이 탈락해 전 소스 혼합 후보 반환. 14종 정합.
  2. **plan/hub article 열기 404** — `materialHref('article')=/library/scripts/{id}`가 무조건 도서로 redirect→`notFound()`. `/library/scripts/[id]` 리졸버가 발행 article 을 `startArticleLearning`→리더로 연결(브라우즈·처방과 대칭).
  3. **제목 HTML hex 엔티티 잔존** — `decodeEntities`(_helpers + voa 로컬)가 `&#x27;` 등 hex 미처리 → owid 1 + voa 7 제목에 `&#x27;` 노출. hex 디코드 보강 + 기존 8제목 백필 + 회귀 테스트 4.
  4. **SourceFeedList 라벨** — 신규 소스 raw key(`noaa`…) 노출 → 8종 라벨 추가.
  5. **BulkArticlesTab 프리셋 라벨** — "전체 (12 소스)" → 실제 14 정합.
- **데이터 백필**: `syntax_score` NULL 22기사(noaa/usgs/factbook/wikivoyage/plos) `compute_syntax_score` 재계산.
- **관찰(설계상·미수정)**: article 단어장은 추천엔진·WordVault 브라우즈에서 격리(의도) · plan article 게임은 texts 변환 전 unscoped · 신규 expository 소스는 register→stage_band 미승격(owid=argumentative만 S3, 나머지 v_level 종속). ⚠️ 라이브 브라우저 테스트는 디스크 100%+동시 dev서버로 회피 → 백엔드/정적/타입/테스트 검증 채택.

### 도서 난이도 다축 평가 v2 — 어휘 단축 왜곡 교정 (v06.208)
- **문제**(사용자 지적): `book_v_level = 어휘 p75` 단축 → (1) 희귀 content-word 꼬리가 p75 부풀림(Alice ease 70인데 V6), (2) 통사 완전 무시(Foundational 학술 F-K 14.55인데 V6·Gibbon 최난이도인데 V9 캡). 23권 실증.
- **설계**(재고): "100% 정확"의 단일 텍스트 공식은 불가(ground truth=학습자 성과) → **앙상블+확신도+외부앵커**로 실효 정확도 수렴. 공식: **ease-게이트 어휘축**(읽기 쉬우면 중심값·어려우면 p75 → 문맥 희귀어 탈부풀림) + **통사축**(F-K·syntax_score) + **병목 융합**(0.75·max+0.25·mean — 어느 한 축만 어려워도 어려움) + **CEFR-J 앵커**(lexOffset 0.04≈편향0) + **CEFR-J 교차확증 확신도**. 설계문서 [book-difficulty-multiaxis.md](proposals/book-difficulty-multiaxis.md).
- **적용**(서비스롤·非DDL, v2.2): syntax_score 16권 백필(`compute_book_syntax`, 전권 확보) 후 재산출 → **고확신 13권 `book_v_level` 갱신**(Alice V6→5 conf 0.99·Jane Eyre V9→8·Great Expectations V9→8·Wizard V6→5 등) + **저확신 8권 검토 회부**(Gibbon V9→11·Foundational V6→8·Alice Adams V9→6 등). CEFR-J MAE **0.78 V**. 전권 `vrl_components.difficulty_v2` + `book_v_level_v1` 구값 보존(되돌리기 가능).
- **부수 발견**: `compute_syntax_score.score = LEAST(100, sent×2+clause×6)`가 **100 포화**(Alice 112·Gibbon 212 전부 캡)라 변별력 0 → 앙상블은 raw clause_depth+F-K로 대체. 재보정 마이그 `20260712120000_ctp_syntax_score_recalibrate` 작성(선형 분산) — **CTP score 소비처 임계값 재검증 후 apply**(앙상블 무영향).
- **정확도 검증 하니스** `scripts/verify-book-difficulty.mjs` — 3중 수렴검증: v2.2 외부 앵커(고전 published 난이도) 적중 **9/10(90%)** vs old 60% · 고확신 CEFR-J MAE **0.27V** vs 저확신 1.75V(confidence가 accuracy 예측 입증). 100% 경로=저확신 8권 인간검토+IRT.
- **잔여**: 검토 8권 어드민 flip · 소비처(recommend·i+1·source-map) 전환 · score 재보정 CTP 조율 apply · Tier2 IRT.

### CTP DCP S4 도서 콘텐츠 populate + kind 정합 (killer band 활성화) (v06.207)
- **갭 발견**: DCP 문항 64개가 전부 **S3(논증 article 7건)** 뿐 → S4(도서 v≥7·killer band) 학습자는 처방 ④ 연습이 영영 비활성. 게다가 `csat_dcp_items.kind` CHECK=`('article','chapter')`인데 catalog·`prescribe_today` 조인은 도서를 `kind='book'`으로 씀 → **book DCP 구조적 삽입/조인 불가**(CTP 백엔드 잠재 불일치).
- **마이그 `ctp_dcp_items_kind_allow_book`**: kind CHECK 에 `'book'` 추가(catalog 정합, additive).
- **드레인 `scripts/generate-book-dcp.mts`**: 발행 도서 챕터 본문(`content_chunks`)→`generateDcpItems`(결정론·LLM 0)→`csat_dcp_items` upsert(멱등). 챕터별 `paragraph_idx` 전역 오프셋(chapter×1000+para)으로 도서 내 충돌 회피. Claude Code 수동 드레인 관행.
- **populate**: Decline and Fall(설명문 v9)·Pride and Prejudice(서사 v8) → **S4 book 96문항**(order 48 + insert 48). 검증: prescribe_today practice 조인 S4 반환 · book order 채점 계약 실측(`source_order [0,4,2,1,3]`→`[0,3,2,4,1]` 정답) · 재실행 멱등(96 유지). **DCP practice S3·S4 양쪽 활성화.**

### 아케이드 아이덴티티 폴리시 — SVG 마크·워터마크·결과 히어로 (v06.206)
- **동기**: 아트 디렉션 후속 폴리시(사용자 "전부 다듬어줘"). 남은 이모지 잔재 제거 + 게임별 아이덴티티 강화.
- **게임킷**: `GameMark`(6종 공용 SVG 마크)·`IconSound`(SVG 사운드 토글) 추가. `AmbientBackground`에 `watermark` 옵션(각 게임 마크를 우하단 대형·soft-light 은은한 워터마크). `GameDone`에 `mark` 히어로(글래스 배지+파티클).
- **이모지 교체**: Daily Blitz 📅→일출 마크 배지 · HUD 🔊🔇→SVG 사운드 아이콘(게임킷+Daily) · Ghost Race 결과 🏆 제거(마크 히어로 대체). 🔥(스트릭/콤보)는 관용적이라 유지.
- **6종 배선**: 각 게임 watermark(자기 마크) + GameDone/결과 mark 히어로. 밝은/무드 배경 양쪽에서 글래스 배지 가독.
- **검증**: 6종 인터랙티브 QA 재통과(정타·스코어·승리/결과) · 스크린샷(Daily 인트로·Ghost/Letter 결과 히어로·워터마크) · tsc 0 · pageerror 0 · console 0. (⚠️ 작업 중 C: 디스크 재만충→`.next` 클리어로 dev 복구.)

### LCP ready 도서 드레인 — 발행 카탈로그 7→23권 (v06.205)
- **갭**: LCP 품질 스윕(서비스롤 tsx)에서 **18권이 `ready`+copyright_safe인데 미발행**(학습자 카탈로그 7권뿐) 발견 — ACP 스트랜딩의 도서판. 파이프라인 자체는 건전(NULL v_level 0·lbv NULL lemma 6.10% proper-noun/hapax 잔여·단어세트 word_count=0 **0**).
- **드레인**: `ready`→`published` 상태 플립 → 트리거 `trg_publish_book_word_sets_t`가 챕터 단어세트 자동 생성(멱등). **16권 발행**(Great Expectations V9·Jane Eyre V9·Sherlock V8·Wind in the Willows V8·Wizard of Oz V6·Alice V6·Huck Finn V7 등) → **발행 7→23권**, V-Level V6:3 V7:8 V8:4 V9:6 풍부화, library_book 챕터 단어세트 **283→909**(+626).
- **실 발견 (LCP 한계)**: `publish_book_word_sets`가 초대형 책(**Les Misérables 364ch·Dialogues**)에서 **statement timeout** — 모놀리식 전-챕터 생성이 API 타임아웃 초과, 트랜잭션 롤백(두 책 `ready` 유지·무손상). **향후 fix**: 챕터 청크 분할 발행(per-chapter 드레인) 또는 statement_timeout 상향. 현재 25권 중 2권만 잔여.
- DEV 데이터 드레인(코드 변경 0) — 트리거·RPC는 기존.

### CTP ⑥ Today UI Phase 2 — DCP 구문 연습 인터랙션 (order/insert·채점·error_cause) (v06.204)
- **신규 라우트 `/practice/dcp`** — hub 처방 ④ 연습 블록 진입점. 오늘 처방(`prescribe_today`) practice 문항을 세션으로 진행. S3 미만/문항 없으면 Calm 빈 상태.
- **인터랙션**: `DcpItems.tsx`(**order**=문장 순서 배열: 이동 버튼 44px·드래그 대신 a11y 우선 / **insert**=삽입 위치 슬롯 탭) + `DcpPlayer.tsx`(세션 오케스트레이터 — 채점 피드백·정답 공개·진행바·완료 요약). 제출 포맷은 `grade_dcp_item` 계약(order `{order:[presented idx]}`·insert `{position}`).
- **채점·기록**: `dcp-actions.ts`(`fetchDcpPracticeItems`·`gradeDcpItem`·`recordDcpErrorCause`). 마이그 `ctp_dcp_grade_return_attempt` — `grade_dcp_item` 이 `attempt_id`+`question_id` 반환(오답 원인 부착용). 채점=서버 `answer_key`(클라 노출 0).
- **error_cause 1-tap**: 오답 시 5원인 자기보고(vocab/parsing/structure/inference/timing) → `csat_item_attempts.error_cause`(RLS owner + CHECK 이중방어). 정적 라우팅=존재 라우트만 링크(vocab→`/flashcard/play`, 나머지 격려 tip · **허위 링크 금지**). hub practice 블록 상태칩→실런처(`/practice/dcp`).
- **검증**: tsc clean · `grade_dcp_item` order 채점 로직 DB 실측(`{order:[4,0,3,1,2]}`=정답) · 단위+렌더 테스트 **9/9**(`dcp.test.ts` 5 `correctOrderFromKey`·ERROR_CAUSES 무결성 + `DcpPlayer.test.tsx` 4 renderToString). **CTP ⑥ Today UI 완결**(Phase 1 처방정본 + Phase 2 DCP).

### hub "오늘" META 재설계 Phase 1 — prescribe_today 정본화 (CTP ⑥ Today UI) (v06.203)
- **META 확정(Opt A)**: hub "오늘"의 삼중 출처(수동계획 `study_plan_items` · `TodayFocus` 클라이언트 휴리스틱 · CTP `prescribe_today`)를 단일 정본으로. 우선순위 — **오늘 수동계획 있음 → `TodayPlanCard`**(사용자 의지 우선) · **진단완료 + 수동계획 없음 → `TodayPrescriptionCard`**(★ `prescribe_today` 5블록 스마트 기본값) · **미진단 → `TodayFocus`**(진단 유도). `TodayFocus` 페르소나 휴리스틱은 진단완료자에게 처방으로 승격 대체. 결정 문서 [hub-today-meta.md](proposals/hub-today-meta.md).
- **신규**: `lib/learner/prescription-actions.ts`(`fetchTodayPrescription` 서버 액션 — `prescribe_today` 호출·파싱·isDiagnosed·듣기text) · `components/home/TodayPrescriptionCard.tsx`(서버, 5블록: 복습/듣기/읽기/연습/점검 + 번호 스텝·색+아이콘 이중부호·44px+·다크 토큰) · `components/home/PrescriptionArticleLaunch.tsx`(client — article 은 URL 직결 불가 → `startArticleLearning` texts 변환). `hub/page.tsx` 분기 배선.
- **런처 매핑**: 복습→`/flashcard/play`(전역 due) · 듣기→최근 `/text/[id]/echo` or `/library/books` · 읽기→book `/library/books/[id]`·article texts 변환 · 점검→`/scriptquiz`. ④ DCP 연습은 **Phase 2**(order/insert 인터랙션·`grade_dcp_item`·error_cause) — Phase 1 은 상태칩만.
- **검증**: tsc clean(신규 3파일+배선, 전체 잔여는 기존 `recommend/next-action.mock.ts` 1건 무관) · `prescribe_today` 5블록 payload DB 실측(파서 계약 일치) · 렌더 테스트 `TodayPrescriptionCard.test.tsx` **7/7**(renderToString, 전 분기). ⚠️ dev 서버 1개 원칙+디스크 99%로 Playwright 스모크 대신 renderToString 채택.

### 아케이드 아트 디렉션 — 게임별 무드 그레이딩 6종 완성 (v06.202)
- **동기**: 학습자 관점 디자인/색감 점검 — 기존 아케이드는 "깔끔한 학습 UI"였으나 레퍼런스(Blue Prince·Outer Wilds·Witness·지중해 듀오톤) 수준의 감성엔 미달(플랫·무드 없음). Calm UI와 충돌 없이(Calm≠밋밋) 격상.
- **허브 재설계**: 플랫 화이트 카드 → **황혼 갤러리 + 6 무드 포탈**(스테인드글라스). 듀오톤 배경·앰비언트 드리프트 글로우·그레인·비네트 + **이모지→일관 SVG 라인 마크** + 깊이/글로우/타이포.
- **게임킷 `AmbientBackground`** 공용 컴포넌트 — 중앙 밝게(가독)·가장자리 무드로 깊게(드라마) + 글로우·그레인·비네트. reduced-motion 대응.
- **6종 무드**: Daily Blitz=새벽(peach/rose) · Letter Forge=엠버(gold/brown) · Cascade=수중(cyan/teal) · Connections=다스크(violet/indigo) · Word Economy=골드(amber/bronze) · Ghost Race=트와일라잇(magenta/purple). 밝은 타일/어두운 텍스트 가독 유지.
- **검증**: 6종 dev :3100 스크린샷(무드·가독) + 인터랙티브 QA 재실행(정타·스코어·승리/결과 전부 통과) · tsc 0 · pageerror 0 · console 0. 커밋 `3f7aee8`(허브+시스템+Ghost) + 본 커밋(5종).

### ACP 신규 소스 학습자 표면 배선 — source→learner loop 닫음 (v06.201)
- **갭 발견**: 이번 세션 신규 소스 중 **wikipedia·plos·wikivoyage·usgs·noaa 5종이 `source-map.ts`(학습자 /library/scripts 트랙 맵)에 미등록** → 발행돼도 `SOURCE_TO_TRACK.get()`=undefined로 **트랙 그룹에서 완전 누락**(실측 8편 stranded). ArticleCard `SOURCE_META`도 미등록 → raw 회색 라벨.
- **수정**: `topic`(과학) 트랙에 plos/usgs/noaa 추가(oneLine 지구·기후 반영) + **신규 `reference` 트랙**('백과·여행으로 넓히기' — wikipedia/wikivoyage, Schema Theory 근거) + `computeTrackCounts` Record + ArticleCard 5소스 메타(라벨·액센트). TrackKey 6→7·SOURCE_TRACKS 6→7.
- **검증**(서비스롤 tsx): 발행 14소스 전부 트랙 매핑(⚠트랙없음 0) — stranded 8편(wikipedia/plos/wikivoyage/usgs/noaa) 학습자 노출 복구. web tsc clean. **런타임 스모크 통과**(기존 :3000 재사용, `test:e2e:smoke` 2 passed — /library/scripts 포함 10 학습자 화면 콘솔에러 0).
- **커버리지 배치**(v06.201 후속): 신규 소스 20편 ingest→publish 스케일 스트레스테스트 **0 실패**(wikivoyage 12,046w·plos 6,599w 포함) → reference 밴드 5→14, usgs/noaa/wikivoyage/factbook/plos 실 카탈로그 presence. DEV 데이터(코드 변경 0). 남은 빈칸 17/30=구조적(A1 전무·C2 미검출).

### 아케이드 6종 자동 QA 스윕 + Daily Blitz 공유 버그 수정 (v06.200)
- **인터랙티브 QA 하니스**(Playwright) — 6게임을 정답 매핑으로 **실제 플레이**(정타·스코어·콤보·승리/결과·상점 구매·50:50·매치 클리어·레이스 완주) 자동 검증. 6종 전부 통과: Letter Forge 10/10(3,213점)·Cascade 22매치(4,281점)·Connections 4/4 완승·Word Economy 26정답·5강화·코인·Ghost Race 12/12 승(5.2s).
- **버그 수정** — `DailyBlitzGame` 결과 공유의 `navigator.clipboard.writeText`를 `void`+동기 `try/catch`로 감싸 **프로미스 rejection 미처리(unhandledrejection)** → insecure/권한거부 컨텍스트에서 pageerror. **프로미스 `.then/.catch` + `execCommand` 폴백 + 성공 시에만 "복사됨" 표시**로 재설계. 재검증 pageerror 1→0.
- **모바일 퍼스트 검증** — 6게임 390×844 가로 오버플로 **전부 0px**(Cascade 4×4 보드·Connections 영+한 타일·Word Economy 상점 반응형 2열 확인). 데스크톱/모바일 pageerror·console error 0.

### ACP NOAA Climate.gov 기후과학 소스 신설 — 신규 도메인(climate·CSAT 최빈출) (v06.199)
- **NOAA ingester** — `ingest-article/noaa.ts`. NOAA Climate.gov Understanding Climate / Features(Drupal 서버렌더 HTML, 의존성 0). **PD(US Gov) → 발행 허용 · 인용 자유**. **register=expository**, **신규 도메인 climate-science**(대기 CO₂·해양 열용량·지구온난화·빙하) — **CSAT 최빈출 주제**. USGS(지질·재해)·NASA(우주)와 구별. B2-C1 접근형 과학 저널리즘.
  - 본문: `field--name-body`(가장 큰 조각 = 본문 필드만 · 관련링크 region 제외) → `field-media-caption` 차트 캡션 제거 + References/인용목록 절단 + 후행 관련-기사 링크(문장부호 없는 짧은 라인) 최대 6줄 제거.
  - 리스트: anchor 텍스트=제목(USGS 와 달리 직접 페어).
- 배선: SourceKey·ArticleSource·SPECS·POLICIES·RANKINGS·REGISTER·source-guide + enqueue/dev-enqueue(host=`www.climate.gov/news-features/`) + 어드민 UI(🌡 CloudSun) + 대량 GET(14소스 + noaa-feed understanding-climate/features). **drift-lock 30 tests**. tsc clean(패키지+web).
- **라이브 검증**(tsx 실 ingester) — Ocean Heat(984w)·CO₂(1060w)·global temp(1122w)·glaciers(1058w)·Incoming Sunlight(2299w) 5기사 clean · listNoaaFeed understanding-climate 7건(★51-54)·features 12건.
- 마이그레이션 `acp_source_add_noaa` (source CHECK +noaa) — **적용 완료**(2026-07-11, 대시보드 SQL Editor — MCP 세션 단절 우회). library_articles·library_article_seed_catalog 두 CHECK 모두 `'noaa'` 포함.
- **DB end-to-end 발행 증명**(서비스롤 tsx · MCP 우회) — Ocean Heat Content INSERT → **license_class=public_domain·display_only=false·copyright_safe=true** → `analyzeArticle` 245 어휘 → register=expository·B2·noise 0.005 → 발행 트리거 → 단어세트 **40 words published**(greenhouse 온실·marine 해양의·emission 배출·atmospheric 대기의·ecosystem 생태계·absorb 흡수 — 기후/CSAT 도메인, 한국어 뜻 완비). USGS와 동형 확인.

### ACP USGS 지구과학·자연재해 소스 신설 — 신규 도메인(earth-science) (v06.198)
- **USGS ingester** — `ingest-article/usgs.ts`. 미국 지질조사국 Featured Stories / Science Snippets(Drupal 서버렌더 HTML, 의존성 0). **PD(US Gov) → 발행 허용 · 인용 자유**. **register=expository**, **신규 도메인 earth-science**(지진·화산·허리케인·광물·산사태) — NASA(우주)·NIH(건강)와 구별되는 빈칸. B2 접근형 과학 저널리즘.
  - 본문: `node-main-body` 컨테이너 → `d-media-copyright` 이미지 크레딧 반복 제거 + plain-text catch-all(`Sources/Usage:`) + related-*-tab/contacts/attributions/authors 트레일러 절단 + 맨 끝 "Learn More" 리소스 링크 컷.
  - 리스트: `c-usgs-teaser` 카드 블록 파싱(제목 h*.title + teaser). RSS 없음 → HTML 파싱.
- 배선: SourceKey·ArticleSource·SPECS·POLICIES·RANKINGS·REGISTER·source-guide + enqueue/dev-enqueue(host=`www.usgs.gov/news/`) + 어드민 UI(⛰ Mountain) + 대량 GET(13소스 + usgs-feed featured/snippets). **drift-lock 29 tests**. tsc clean(패키지+web).
- 마이그레이션 `acp_source_add_usgs` (source CHECK +usgs) — **적용 완료**.
- **라이브 검증**(tsx 실 ingester) — featured 12건(★60-61) · Solar Superstorm(814w)·Hurricane Helene(1394w) both **junk 0**(크레딧/링크리스트 clean) · snippets 12건.
- **end-to-end 발행 증명** — Hurricane Helene INSERT → **license_class=public_domain·display_only=false·copyright_safe=true** → register=expository·B2·noise 0 → `analyzeArticle` 377 어휘 추출 → 발행 트리거 → 단어세트 **40 words published**(landslide 산사태·debris 잔해·hazard·trigger 촉발·personnel·collaboration — 지구과학/재해 도메인, 한국어 뜻 완비).

### 아케이드 스위트 — 세계적 게임 메커닉 기반 단어 게임 6종 (v06.197)

세계적 게임/교육게임(Kahoot·Blooket·Gimkit·Duolingo·Wordle·NYT Connections·Match-3) 리서치 → 단어 학습 게임 6종 신설. 각 dev :3100 스크린샷 검증.
- **공용 게임킷** [`components/game/_shared/gamekit.tsx`] — `useSfx`(Web Audio·무자산)·`ParticleBurst`·`useCountUp`·`Hud`·`GameDone`·`GameLoading`·`NotEnoughWords`·토큰 스타일(라이트/다크·reduced-motion·접근성). WordBlitz v07.2 주스 일반화. + 공용 스캐폴드([`lib/game/play-scaffold`] 스코프 단어·기록·복귀) + 일반 레코더([`lib/game/record-result`] module 파라미터화).
- **6종**: **Letter Forge**(철자 조립 L4b) · **Cascade**(매치·낙하 보드 L4a) · **Connections**(의미 그룹핑 L5·큐레이션 뱅크) · **Word Economy**(경제·전략 Gimkit) · **Daily Blitz**(데일리+스트릭 Wordle·localStorage) · **Ghost Race**(비동기 레이스+리그). 각 `/play/<slug>` + `GhostRace`/`Cascade`/`WordEconomy`는 wordPool·onCorrect/onWrong(FSRS) 계약 재사용.
- **허브·크롬**: `/arcade` 진입점(6카드) + SessionFrame SESSION_META 6종 등록(closeHref→/arcade).
- **module_id enum**: TS `ModuleId`/`ScoreModule` 6종 추가 + DB 마이그 `add_arcade_game_module_ids` **적용**(6값 ADD VALUE IF NOT EXISTS, 순수 additive) → FSRS audit/scores persistence 활성. 검증: pg_enum 16값 확인.
- 커밋 `c463ade`(kit+LetterForge)·`e0816ba`(Cascade)·`79bf6a8`(Connections)·`63141a8`(WordEconomy)·`3e7751f`(DailyBlitz)·`4e1cd02`(GhostRace)·`fd55e19`(허브).
- ⚠️ 환경: C: 디스크 100% full 실측 → `.next` 클리어로 dev 서버 unblock(사용자 공간 확보 권장).

### ACP Wikivoyage 여행 가이드 소스 신설 — reference 밴드 보강 (v06.196)
- **Wikivoyage ingester** — `ingest-article/wikivoyage.ts`. Wikimedia 프로젝트라 `_mediawiki` 재사용(host=en.wikivoyage.org). Star/Guide 카테고리. CC-BY-SA → 발행 허용. **register=reference**(목적지 가이드=Factbook 동류) → **얇은 reference 밴드 보강(3→5, 패딩 아닌 갭 채움)**. B1-B2 접근형·여행 흥미↑.
- 배선: SourceKey·ArticleSource·SPECS·POLICIES·RANKINGS·REGISTER·source-guide + enqueue/dev-enqueue + 어드민 UI(🗺 MapPin) + 대량 GET(12소스 + wikivoyage-feed Star/Guide). drift-lock 28 tests. gcmsort=timestamp+영문자-필터(v06.195 QA 패턴 반영).
- 마이그레이션 `acp_source_add_wikivoyage`.
- **end-to-end** — Kyoto(8847w·B2)·Prague(14420w·B2) published·cc_by_sa·register=reference·noise 0·llm_cost 0. reference 밴드 3→5(factbook+wikivoyage).

### QA 자체점검 — Wikipedia feed 품질 + prescribe_today 정합 (v06.195)
- **Wikipedia feed 니치-junk 수리** — categorymembers가 sortkey 순이라 앞부분이 문장부호-시작 니치(화석종 `?Oryzomys`·`.hack`·`*SCAPE`·`0-8-4`)로 도배 → `gcmsort=timestamp desc`(최근 승격 GA) + 영문자-시작 제목 필터. 검증: junk 0, 다양한 실주제(San Jose Sharks·Semiotics·University of Yangon 등).
- **prescribe_today practice 정합** — S4/S5 학습자(v_band=S4·도서, DCP 문항 없음)가 practice active=true·items=[] 오해 → "문항 존재 시만 active". 검증: S5 active=false·0분·total 60.
- 자체점검 확인: 신규 5소스 발행 데이터 전부 clean(title/register/license/noise 이상치 0) · register×CEFR 매트릭스 건전.

### ACP PLOS 오픈 학술 소스 신설 (v06.194)
- **PLOS ingester** — `ingest-article/plos.ts`. CC-BY 오픈액세스 과학 저널(HTML 서버렌더). abstract+본문 산문 추출 — figures/tables/References·인용 상첨자 스트립 + References 이하 절단(methods/stats 노이즈 배제). solr API `listPlosFeed`. C1-C2 심화(S4 킬러급) register=expository.
- 배선: SourceKey·ArticleSource·SPECS·POLICIES·RANKINGS·REGISTER·source-guide + enqueue/dev-enqueue + 어드민 UI(🧬 Dna) + 대량 GET(11소스 + plos-feed 라우트). drift-lock 27 tests.
- 마이그레이션 `acp_source_add_plos`(articles + seed_catalog CHECK).
- **end-to-end + 추출 품질** — pbio(1271w)·pone(5948w) published·cc_by·C1·**lexical_noise 0.001~0.002**(스트립 성공, 깔끔 산문 확인)·llm_cost 0.

### ACP English Wikipedia 정규 소스 신설 (v06.193)
- **Wikipedia ingester** — `ingest-article/wikipedia.ts`. Simple Wikipedia와 동일 `_mediawiki` 재사용(host만 en.wikipedia.org). FA(Featured)/GA(Good) 카테고리 categorymembers. CC-BY-SA → 발행 허용. B2-C1 고급 백과(Simple의 A2-B1 대비 심화). register=expository.
- 배선: SourceKey·ArticleSource·SOURCE_SPECS·POLICIES·RANKINGS·REGISTER·source-guide + enqueue/dev-enqueue + 어드민 UI(📚 Library) + **대량 GET**(BulkArticlesTab 10소스 + wikipedia-feed 라우트 FA/GA). drift-lock 26 tests.
- 마이그레이션 `acp_source_add_wikipedia`(library_articles + seed_catalog CHECK +wikipedia).
- **end-to-end** — Photosynthesis(7297w·C1)·Black hole(11277w·C1) published·cc_by_sa·display_only=false·llm_cost 0. per-source + 대량 GET 동시.

### /wordvault 구독 단어장 챕터 학습 — 세트 미리보기 모달 재사용 (v06.192)

/wordvault '학습 자산 › 단어장' 탭에서 챕터형 공용단어장 행 탭 시 [VocabSetPreviewModal](../apps/web/src/components/library/vocab/VocabSetPreviewModal.tsx)(챕터 아코디언 + 게임별 런처)을 열어 그 챕터 단어로 바로 학습. 구독이 죽은 끝(단어 목록 링크뿐)이던 문제 해소. 세션 through-line 완성: 브라우즈(모달)→계획(런처)→보관함(모달).

- **모달 재사용(위치 무관화)** — VocabSetPreviewModal 에 `fromPath` prop(기본 `/library/vocab`) 추가 → 챕터 게임 launch 의 `?from` 복귀 경로를 재사용처가 지정. 기존 소비처(VocabSetGrid/BookDetailClient) 무변(선택 prop).
- **챕터형만 라우팅** — [ResourcePortfolio](../apps/web/src/components/wordvault/hub/ResourcePortfolio.tsx): 단일 세트 중 내부 챕터(`shared_words.chapter`) 보유 세트만 `setId` 부여해 모달 오픈(InsetRow onClick), 챕터 없는 세트·도서 묶음은 기존 `/wordvault/browse` 링크 유지(모달은 10개 미리보기뿐이라). 판별=otherSets set_id 단일 쿼리.
- **모달 CTA=구독 해지** — 확인 후 `unsubscribeSet` → 목록에서 제거, 학습 기록 서버 보존. tsc·lint 0.
- 조사: /library/books 는 이미 인기/중요도 랭킹(`recommend-books.ts` popularity_rank·인기 레일) 보유 → 개선 불요. BookShelfSection/AssetGrid 는 미마운트(dead).

### WordBlitz 익사이트 강화 — 파티클·SFX·콤보 연출 (v06.191)

"학습자에게 더 재미·흥미·익사이트" 후속(v06.189 재설계 위에). 리서치 "숙련될수록 더 극적인 피드백" 적용.
- 파티클 버스트(콤보 티어로 강도↑) · Web Audio SFX(정답 상승음·마일스톤 아르페지오·오답 버즈·완료 팡파르, 뮤트 토글) · 속도등급 PERFECT/GREAT/GOOD(+보너스) · 콤보 불꽃 성장(크기·색·글로우) · 마일스톤 배너("COMBO N!") · 점수 카운트업 · 에너지 백드롭(콤보로 발광) · 문항 등장 애니 · 타이머 긴박 색변화.
- 전부 테마 토큰(color-mix) · prefers-reduced-motion 폴백(파티클/애니 off) · 계약 무변경. (`926dc71`.)
- 검증: :3000 콤보5 마일스톤 스크린샷 라이트/다크 — 배너·파티클·PERFECT·+293·불꽃·에너지 확인, tsc 0, pageerror 0.

### EchoMatch 피드백 강화 — 구간 지목 + 정직한 문구 (v06.190)

기능·효과 평가 후속. 프로소디 3축 채점(v06.158 재설계)은 작동하나 ① 발음/단어 정확도 미측정 ② 어디서 틀렸는지 지목 부재 ③ 미보정 임계값 — 한계 확인. 이 중 **안전·검증 가능한 2건** 반영.

- **구간 divergence 지목(#3)** — `divergenceRegions`(기존 DTW semitone-shape 규칙 재사용·순수함수): 억양이 원어민과 ≥3 semitone 벌어진 시간 구간을 `PitchVisualizer`에 음영+범례+안내문으로 표시 → "어디를 다시 따라할지" 행동 가능 피드백. 회귀 4종(동일/화자독립=무표시, 다른모양=지목, 무음=무표시).
- **문구 정직화(#4)** — `scoreFeedback` "원어민에 가까워요"(참조가 Piper TTS인데 과장) → "억양·리듬이 잘 맞았어요". 채점이 프로소디 정합임을 정직하게.
- **#2 단어 정확도 게이트 (구현)** — 녹음과 병렬로 Web Speech `SpeechRecognition`(재사용 `createRecognizer`) 실행 → `computeShadowMatch`(기존 자산)로 문장 단어 인식률 산출. 인식률 <40%면 프로소디 점수를 celebrate 대신 "단어부터 또박또박 다시" 로 부드럽게 게이트(비난 X). **완전 additive·전면 guard** — 미지원(Firefox 등)·인식 실패·무음은 `null`(미측정)로 프로소디-only 폴백, 녹음/채점 절대 무영향. scored 화면에 "단어 N% 인식" 표시. ⚠️ **실 육성 인식 정확도는 헤드리스에서 검증 불가**(Chrome 실기 필요) — 구조·guard·gate 로직만 tsc+스모크 검증.
- **자동 실주행 검증(fake-mic E2E)** — `06-echomatch-fakemic.spec.ts` 신규: Chrome 합성 오디오(`--use-fake-device-for-media-stream`)로 전체 4-Phase(Listen→Repeat→Compare→Score) 자동 완주. 결과 `overall=48`(인토네이션 23·강세 55·리듬 74) — 파이프라인 크래시 0·콘솔에러 0·**구조적 0점 없음**(비발화 톤에 거짓 고득점도 안 줌=변별력 유지). `overall>0` 단언으로 구 절대값 결함 회귀 가드. *합성 톤이라 사람 보정(#1)은 아님 — 파이프라인 생존/범위 검증.*
- **잔여**: #1 실음성 threshold 보정(실제 육성 샘플 필요 — 합성 톤으론 불가). tsc green · vitest 11/11 · EchoMatch 게이트 스모크 green · fake-mic 실주행 green.

### WordBlitz 재설계 — 3D 인형뽑기 → 2D 속사 인지 (v06.189)

L4a 자동화 모듈 전면 재설계(리서치 기반: 어휘게임 메커닉·게임필·모던 UI·플로우).
- **게임**: ko 뜻 → 4 en 타일 중 정답 빠르게(탭/키 1-4). 콤보(연속정답→배수·레벨업)·문항 타이머(레벨↑ 단축)·점수(시간보너스×배수). Action→Feedback→Reward 루프.
- **이전 Three.js 3D 인형뽑기 대체** — ~5초/단어 → ~1-2초/단어. "Blitz"·L4a 자동화 목표 정합 + 모바일 우선. (`WordBlitzGame.tsx` 재작성 `7d55cce`.)
- **Calm UI 주스**: 정답 초록+체크·오답 앰버 shake·콤보 범프. 폭죽 없음, 차분한 종료("오늘 잘 마쳤어요").
- **모던 UI + 테마 토큰**(라이트/다크 자동) + 접근성(키보드·aria-live·reduced-motion·44px+). 게임 예외 `--combo`/`--streak`.
- **계약 무변경**: wordPool/onExit/onCorrect/onWrong(FSRS) — page + WorkspaceWordBlitzMode 자동 적용.
- **dead code 제거**(`e6e67dd`+`a4105c4`): ClawMachine/ClawModel/ClawScene/Plushie/PlushieModel·useWordBlitzGame·WordBlitzUI.css·lib/wordblitz/types.ts 삭제. data.ts 정리. 정글 이모지 🌴→⏱. (three/fiber는 pirate-quest 사용 → 유지.)
- 검증: :3000 스크린샷 playing/reveal·라이트/다크, ko→en 정합, tsc 0, pageerror 0.

### /plan 런처 챕터 선택 — 공용단어장 챕터 단위 시작 (v06.188)

'게임별 챕터 학습 UI'([VocabSetPreviewModal](../apps/web/src/components/library/vocab/VocabSetPreviewModal.tsx))의 플랜 버전 — /plan '바로 시작'에서 공용단어장을 특정 챕터 단어로 시작.

- **LaunchRow + ChapterScopePicker** — [PlanClient](../apps/web/src/components/plan/PlanClient.tsx): 공용단어장이 내부 챕터(`shared_words.chapter`)로 나뉘면 챕터 select(전체/N장) 노출. TodayRow(오늘의 학습)·ItemConfig(구성 패널) '바로 시작' 공유. 30챕터도 수용하는 컴팩트 select(Calm UI).
- **챕터 스코프 launch** — [plan-activities.ts](../apps/web/src/lib/learner/plan-activities.ts) `activityLaunchHref(m, activity, origin, chapter)`: word_set 게임 라우트(`set=`)에만 `&chapter=N` 부착 → 카드/블리츠/스펠포지/페어플립이 그 챕터 단어만 학습(게임 page 가 이미 `?chapter=` 파싱). 본문/vocab/스크립트엔 무영향.
- **chapterCount 게이트** — [plan-actions.ts](../apps/web/src/lib/learner/plan-actions.ts) `fetchStudyPlanItems` 가 word_set 내부 챕터 수(MAX chapter)를 `chapterCount` 에 채움(book 전용 → word_set 도 사용). 챕터 미부여 세트는 0 → 선택 숨김.
- **실데이터**: 교육과정 기본어휘 초등19/중등30/고등25장 라이브 확인. tsc·lint 0.

### /library/vocab '추천' — 정본 추천 엔진(RPC)으로 교체 (v06.188)

즉흥 client 근접정렬(V-Level·CEFR·category 추정)을 앱 정본 추천 엔진으로 교체 (최적 방안).

- **`recommend_word_sets_for_user` RPC** — [page.tsx](../apps/web/src/app/(main)/library/vocab/page.tsx): 진단 완료(`current_v_level`·`diagnostic_completed_at`) 시 RPC 호출, fallback 티어 제외한 recommended 전달. 미진단은 진단 유도(DiagnosePrompt).
- **티어·사유 노출** — [VocabSetGrid](../apps/web/src/components/library/vocab/VocabSetGrid.tsx) FeaturedRow: 티어 배지(메인/도전/보강/관심) + 왜 추천 사유(reason). estimateSetLevel/categoryVLevel 근접정렬 제거. [queries.ts](../apps/web/src/lib/library/vocab/queries.ts) `RecommendedSet` 타입 export. tsc·lint 0.

### CTP DCP 채점 — 실행 루프 완결 (v06.187)
- **`grade_dcp_item(item_id, answer)`** — order/insert 답변 서버 채점 + `csat_item_attempts` 기록(item_role=practice). answer_key는 서버에만(오답 시에만 반환). SECURITY DEFINER+auth.uid 가드.
- **검증** — order 정답=true/오답=false · insert 정답=true/오답=false · 기록 확인(롤백).
- **DCP 실행 루프 완결**: 생성(dev-generate-items)→처방(prescribe_today·answer_key 제외)→채점(grade_dcp_item)→기록(csat_item_attempts).

### CTP ⑥ Today 처방 백엔드 — CTP 백엔드 완성 (v06.186)
- **`prescribe_today(uuid)`** — 결정론 일일 루프 처방(5블록: FSRS due·듣기·input·practice·verify). derive_learner_stage→stage→조립. input=csat_stage_catalog(stage_band)·practice=csat_dcp_items(S3+·answer_key 제외). 시간삭감(practice=S3+에서만). SECURITY DEFINER+auth.uid 가드.
- **양방향 검증** — S1 학습자(practice 비활성·60분·input 5기사) / S3 학습자(wpm 주입 모사→practice 5문항 OWID order·75분). 롤백(영속 X).
- **CTP 백엔드 완성**(8계층): ①syntax ②stage_band ③DCP문항 ④유창성 ⑤gate ⑦error_cause ⑧BYO가드(구조) + **⑥ 처방·stage 파생**. 잔여=⑥ Today **UI**(META 게이트).

### Dictation 세션 결함 수리 + 사용성 (v06.185)

/dictate/session 점검 — 기능 결함 2건 + 폴리시 2건. 스코프: dictation 파일 한정.

- **🔴 세션 미발견 무한 로딩** — 세션은 localStorage(기기 로컬)라 다른 브라우저/기기·공유된 URL·오래된 세션이면 `getSession` 이 미발견인데, 훅이 session=null 을 로딩과 구분 못해 "세션을 불러오는 중..."에서 **영구 정지**(사용자 제보 URL 시나리오). → `useDictationSession` 에 `status('loading'|'ready'|'not-found')` 추가, 세션 화면이 not-found 시 "세션을 찾을 수 없어요" + 다시 시작 CTA 렌더.
- **🔴 TTS voices 비동기 로드 함정 + 무음 방치** — `AudioController.speak()` 가 `getVoices()` 를 동기 호출 → 첫 발화 시 빈 배열이라 영어 음성 미선택(잘못된 언어/무음). 또 OS 영어 음성 미설치 시 **아무 안내 없이 무음**. → `ensureVoices()`(voiceschanged 대기+1.5s 폴백·캐시) + `pickEnglishVoice`(en-US 우선), speak 가 await. `hasEnglishVoice()` 로 판정해 영어 음성 없으면 세션 화면에 안내 배너.
- **폴리시**: 입력 라벨 영문("Type what you hear") → 한글 · storage.ts 주석 정정(sessionStorage→localStorage, 기기 로컬·URL 공유 경고).
- 검증: tsc(dictation 오류 0)·eslint 클린 + **라이브 실주행 완료**(dev 서버 clean 재기동 후 Playwright): ① 없는 sessionId → "세션을 찾을 수 없어요" 안내(무한로딩 제거, 스크린샷) ② setup→session→입력→제출→채점(결과·정답·오류패턴) 정상 ③ voices 3개 감지→ensureVoices resolve→배너 정상 미표시(음성 있을 때). 콘솔 에러 0.

### CTP P3 종결 — 학습자 stage 실시간 파생 (v06.184)
- **`derive_learner_stage(uuid)`** — csat_stage_gates 전 지표 통과 최대 단계 매 호출 파생(**컬럼 저장 금지**·§9 R(t) 동형). 지표: wpm(reading_fluency_log)·item_accuracy(csat_item_attempts)·listening(echo_match)·coverage(v1 current_v_level 대리). SECURITY INVOKER(RLS 본인만).
- **양방향 검증** — 무데이터 유저 3인 전원 S1(고 v_level도 읽기증거 없이는 승급 불가) · 강한 지표 주입 시 S1→S5 승급(롤백, 영속 X).
- ⚠ apply_migration이 함수 본문 `$$` 오분할 → execute_sql로 적용(migration 파일은 repo 보존).
- **CTP P3 종결**: ① syntax_score · ② stage_band(view) · ③ DCP 문항 · ④⑤⑦ 테이블 · **stage 파생**. 잔여 ⑥ Today UI(META 게이트) · ⑧ BYO 가드.

### /library/scripts 재설계 — 목적별 묶음 + 레벨 칩 단일 시스템 (v06.183)

기존 이원 구조(추상 소스맵 + 평면 그리드)로 "선택을 어떻게 하는지 모름" 문제 → 분류를 목록에 직접 노출하는 단일 시스템으로 통합.

- **`ScriptsBrowser` 신설** — ① 레벨 칩(내 레벨/CEFR, 드롭다운 아닌 가시 facet) ② 내 레벨 추천 strip(i+1 상위 3) ③ 목적별 트랙 섹션(적합순·묶음당 미리보기 6편 + "전체 N편 보기") ↔ 필터·묶음 진입 시 평면 그리드. `ArticleCard`·`source-map.ts`·i+1 로직 재사용, 추가 fetch 0.
- **신규 소스 트랙 편입** — owid+factbook→📊 '데이터·사실로 읽기'(신규 트랙), elife→🔬 topic. 기존 맵에서 누락되던 3소스 커버. `ArticleCard` SOURCE_META에 라벨·색 추가.
- **제거** — `SourceMapShell`·`ArticlesExplorer`·`source-map/{SourceMap·DifficultyMap·TrackCard}` (page 단일 진입 dead code).
- 04-ui-smoke에 `/library/scripts` 화면 추가(영구 회귀 자산). tsc green. ⚠ 런타임 스모크는 동시 멀티세션 `.next` 캐시 오염(`_document.js` 결측 — 전 라우트 500)으로 차단 → 클린 서버 재기동 후 검증 필요.

### CTP P3 — DCP T2 결정론 문항 생성 완료 (③) (v06.182)
- **`csat_dcp_items` 테이블** — 공유 배치 order/insert 문항(quiz_questions는 per-user·MC라 부적합 — P0식 정정). RLS admin write.
- **생성 라우트** `/api/ctp/dev-generate-items` — 결정론 생성기 실행+INSERT. **DCP 입력 게이트**(NOT display_only·license_class∈pd/cc0/cc_by/cc_by_sa·noise≤0.08) — ND(The Conversation) 파생 차단.
- **보일러플레이트 필터** — 생성기 적격필터에 인용·URL·라이선스·캡션 배제 추가(OWID "cited as…" 오인식 수리). drift-lock +1(6 tests).
- **실증** — OWID S3 논증 8건(게이트 통과) → **64 실 문항**(실 산문 확인). ND 파생 항목 사후 삭제.
- 다음 P3 잔여: 학습자 stage 실시간 파생 함수.

### LCP 대량 GET — Pressbooks 소스 배선 (v06.181)
- **BulkFetchTab에 Pressbooks 추가** — seed-fetcher `pressbooks.ts`(정적 큐레이션 리스트 — 통합 카탈로그 API 부재라 Factbook 국가리스트와 동형). opentextbc.ca 검증 슬러그 4권(Sociology·Psychology·Writing·Chemistry). 실 메타는 ingest 시 `citation_*` 재취득.
- seed-fetchers `SeedSource`+pressbooks · `FETCHERS`/`SOURCE_LABELS` 등록 · BulkFetchTab SourceKey/SOURCE_OPTIONS.
- 마이그레이션 `lcp_seed_catalog_source_add_pressbooks`(seed_catalog CHECK +pressbooks). opentextbc.ca 봇차단 회피=ingester UA.
- → **ACP·LCP 대량 GET 모두 신규 소스 배선 완료**(per-source GET과 동등 커버리지).

### ACP 대량 GET — 신규 소스(OWID·Factbook·eLife) 배선 (v06.180)
- **BulkArticlesTab에 신규 3소스 추가** — 기존 per-source GET(SourceGetView)에만 있던 owid(📊)·factbook(🌍)·elife(🔬)를 대량 GET에도 배선. 9소스 프리셋.
- feed 라우트 3종 신설(`owid-feed`·`elife-feed`·`factbook-feed`) — 대량 흐름의 score-cap 위해 `listFactbookFeed`·`listElifeFeed`에 `applyArticleCurationSpec` 스코어링 추가.
- 마이그레이션 `acp_seed_catalog_source_add_new`(seed_catalog CHECK +3) + `SeedSource` 타입 +3 → seed 영속화(새로고침 보존).
- 실검증: owid 4·factbook 30국·elife 6 스코어 항목 + published 감지. (LCP pressbooks 대량은 후속)

### /library/vocab 중요도·사용빈도 기반 재구성 (v06.179)

공용 단어장 화면을 **중요도(카테고리)·사용빈도(구독수)** 신호로 재구성 — no-op이던 "추천순"을 실제 랭킹으로.

- **중요도 랭킹** — [categories.ts](../apps/web/src/components/library/vocab/categories.ts) `CATEGORY_IMPORTANCE`(수능·내신100→교육과정 고90/중80/초70→공인60→공무원/비즈니스45→테마30→유아20). 추천순 = 중요도→사용빈도(구독수)→큐레이션 순서→단어수. 캐러셀 카테고리 탭도 중요도순(수능 먼저·기본 활성).
- **사용빈도 랭킹** — 마이그 `20260709194335_shared_word_sets_subscriber_count`: `shared_word_sets.subscriber_count`(denormalized) + 트리거 `trg_maintain_set_subscriber_count`(user_word_set_subscriptions INSERT/DELETE, SECURITY DEFINER) + 백필(262세트). RLS 본인전용이라 클라 집계 불가 → 비정규화. [queries.ts](../apps/web/src/lib/library/vocab/queries.ts) `subscriberCount` 노출(loose client). 카드에 "👥N" 표기.
- **클러터 제거** — `library_article` 107세트(저큐레이션·소스종속) 공용 라이브러리에서 제외(도서 세트와 동일 원칙, 각 소스 컨텍스트 전용).
- **카드 정보 단서** — [VocabSetCard](../apps/web/src/components/library/vocab/VocabSetCard.tsx) 좌하단 카테고리(중요도) 칩 + 구독수. tsc·lint 0.

### CTP P3 — syntax_score 배치 산출 (① 구문 난이도) (v06.178)
- **`compute_syntax_score(text)` RPC** — 자체 정규식(문장 p90·절 깊이 휴리스틱). 런타임 LLM 0·winkNLP 불요. score 0-100(가중 2:6, 베타 보정 대상).
- **전량 backfill·검증** — article 132건: register별 정합(reference 94>논증 83>설명 71>서사 61>news 56). 도서 7권: v-level 정합(Gibbon v9=100 … 동화 v3=26).
- **배선 RPC** — `compute_article_syntax`/`compute_book_syntax`(챕터 content_chunks 집계) → ACP·LCP dev-process 에 `compute_*_vrl` 옆 호출(미래 콘텐츠 자동 산출).
- 다음 P3 잔여: 학습자 stage 실시간 파생 함수 · DCP T2 결정론 문항 생성.

### 연어 슬롯 롤아웃 — scoped 플래시카드 + 리더 툴팁 (v06.177)

v06.175(hub 플래시카드 연어 슬롯) 롤아웃 — 나머지 학습자 노출면에 동일 슬롯 확장. 마이그레이션 0(앱-사이드 fetch).

- **scoped 플래시카드** ([scoped-words.ts](../apps/web/src/lib/flashcard/scoped-words.ts)) — 세트/텍스트 스코프 진입도 collocations 배치 보강(hub-words 와 동일 패턴). CardBack 슬롯 공유.
- **리더 툴팁** ([WordLookupPopover.tsx](../apps/web/src/components/library/reader/WordLookupPopover.tsx)) — 본문 단어 클릭 시 예문 아래 연어 칩 최대 3개. `lookup_word_meaning` RPC 가 collocations 미반환이라 [reader-queries.ts](../apps/web/src/lib/library/reader-queries.ts) `lookupWord` 가 해소된 word 로 shared_dictionary 1행 보조 조회(툴팁은 on-demand 라 round-trip 허용, 실패 graceful).
- 검증: tsc·eslint 클린 · 데이터 경로 실증(`lookup_word_meaning('verdict')`→resolved_word→collocations `[guilty verdict·unanimous verdict·reach a verdict]`). 렌더는 스크린샷 검증한 v06.175 CardBack 과 동일 칩 패턴.
- 이로써 학습자 노출면 3곳(hub·scoped 플래시카드·리더 툴팁) 연어 소비 UI 완비 → D7(collocations 노출 단어 2,240 채움)이 비로소 학습자 가치를 가짐(다음 단계).

### CTP 착수 — CSAT Track Pipeline 데이터모델 (P0 정찰 + P1/P2 migration) (v06.176)
- **P0 정찰** — 소유 8계층 read-only 실측([ctp_p0_20260709.md](./AI_CONTEXT/diagnostics/ctp_p0_20260709.md)). 판정 GO + 정정 2건: ④ `reading_sessions` 이름충돌(기존=읽기플랜 262rows) · ⑦ per-question attempt 부재(scores=세션단위).
- **P1/P2 migration 3건 적용**(승인): `ctp_catalog_syntax`(syntax_score jsonb + `csat_stage_catalog` VIEW 139항목) · `ctp_dcp_items`(quiz type +order/insert + item_role) · `ctp_runtime_tables`(`reading_fluency_log`·`csat_stage_gates` 9행seed·`csat_item_attempts` + RLS).
- **회귀 통과** — quiz 기존 3종 값 보존 · reading_sessions 262 불변 · stage_band 분포 S1(55)·S2(46)·S3(33)·S4(5).
- 스코프: 데이터모델+배치 계층. Today UI(⑥)는 META 확정 게이트. 다음 P3 = syntax_score 배치 산출 + stage_band/gate 소비.
- docs: [DB_SCHEMA.md](./DB_SCHEMA.md) CTP 섹션.

### 플래시카드 연어(collocations) 슬롯 — 카드 리치화 시제품 (v06.175)

v06.173 진단(collocations 등 무소비 필드) 후속 — enrichment 를 가치있게 만드는 선행 조건인 **소비 UI** 를 플래시카드 정답면에 시제품으로 구축. 닭-달걀(UI 없어 안 채움/안 채워 UI 없음) 해소의 첫 조각.

- **CardBack 연어 슬롯** ([CardBack.tsx](../apps/web/src/components/flashcard/CardBack.tsx)) — 정답면 예문 아래 "함께 쓰는 표현" 회색 칩 최대 3개. **데이터 있을 때만 렌더**(Progressive Disclosure) · 예문 보조 톤(Calm UI, 학습 자극 최소화).
- **데이터 스레딩** — `FlashcardWord.collocations?`([types/flashcard.ts](../apps/web/src/types/flashcard.ts)) + hub-words 가 shared_dictionary 에서 배치 1쿼리 보강([hub-words.ts](../apps/web/src/lib/flashcard/hub-words.ts), collocations 는 vocabularies 미보유). fetch 실패해도 카드 렌더 무영향.
- 시연: runtime-test 계정 10단어 연어 실채움 + Playwright 정답면 스크린샷으로 렌더 육안 확인(예: verdict → guilty verdict · unanimous verdict · reach a verdict). tsc·eslint 클린.
- 잔여(설계 승인 후 롤아웃): scoped-words 경로 · 리더 툴팁(WordLookupPopover) · 노출 단어 2,240 collocations 채움. 이 UI 가 서면 D7 enrichment 가 비로소 학습자 가치 생김.

### 챕터별 어휘 V-level — 단일 book_v_level 챕터 편차 노출 (v06.174)

P0 진단(통사 축 신설 정당성 실측)이 드러낸 최대 결함 = 단일 `book_v_level` 이 챕터 난이도 **3~5레벨 편차**를 뭉갬(Alice V6 라벨인데 도입 V4·10장 V8; Les Misérables V9인데 챕터 V2~V10). 통사 축은 F-K가 이미 포착 → DEFER, 챕터 편차가 실측 최대 결함이라 우선 착수.

- **마이그레이션 적용** — `lcm_chapter_v_level`: `library_chapters_master.chapter_v_level smallint` + 백필(distinct lemma v_level `PERCENTILE_DISC(0.75)`, V11 제외 — `compute_book_vrl` 동일 규칙). `library_book_vocabularies ⋈ shared_dictionary(word=lemma)`. **1,295/1,296 채움**(chapter_idx 정합), 파괴 0. 동적 상태 아님(정적 콘텐츠 속성, 재추출 시 갱신).
- **노출** — 리더 목차 사이드바(`ChapterSidebar`) + `/plan` 도서 챕터 리스트(`ChapterList`)에 `V{n}` 텍스트 pill(색상만 의존 X → 색맹 안전, memory-decay 4색과 무관). `reader-queries.listChapters`·`plan-actions.fetchBookChapters` 에 `chapter_v_level` 승계 + `database.ts` 타입.
- **파이프라인 wire-up** — 마이그레이션 `20260709194527_compute_book_chapter_v_levels`: 별도 peer 함수(공유 `compute_book_vrl` 미수정 → 동시 CTP 충돌 방지). LCP `dev-process`·`process` 라우트 + `reprocess-book`·`reprocess-all-se` 스크립트의 `compute_*` 시퀀스에 배선 → **신규 적재 도서 자동 채움**. idempotent 검증(Alice 재계산 값 불변).
- **CTP 통사 축과의 관계** — 동시 세션이 `library_*.syntax_score`(구문 p90·절 깊이) 축을 별도 구축(`ctp_p0_20260709`). 본 chapter_v_level(어휘 축 챕터 분해)과 **직교/상보** — 중복 아님(P0 판정: 도서 라벨 관점 통사 반례 0 vs CTP=수능 stage 게이팅 관점).
- **P2 완료 — 가독성 축 완결**: F-K NULL 4권(`book-readability.mjs` per-book) 백필 → Intro Sociology 12.35·Book of Tea 10.25·Alice Adams 8.65·Short Fiction 6.8. book_v_level 보유 도서 F-K **NULL 0**.
- 진단서: [syntactic_axis_p0_20260709](./AI_CONTEXT/diagnostics/syntactic_axis_p0_20260709.md). P0가 지목한 결함(챕터 편차 P1 + 가독성 공백 P2) **모두 해소**. 통사 축은 DEFER 유지(CTP syntax_score와 상보).

### enrichment 백로그 진단 — 무소비 필드 3종(D3/D6/D7) 이연 (v06.173)

노출 단어 표적 enrichment 착수 전 진단 — 대상 필드가 학습자 UI 미렌더 판명(register D2·B1과 동일 패턴 3번째). 코드만 변경(데이터·마이그레이션 0).

- **진단**: 발행 세트 노출 단어 9,227개의 갭 = collocations 2,240·korean_learner_note 7,104·다의어 senses 6,784. 그러나 **학습자 UI 전수 확인 결과 이 필드들은 어디에도 렌더 안 됨** — 플래시카드 CardBack(pos·meaning·example)·리더 툴팁 WordLookupPopover(register·pos·cefr·v_level·meaning·example)·단어장 미리보기(word·meaning_ko·pos·cefr) 모두 미포함. 렌더되는 필드는 노출 단어에서 이미 ~100%(example 결핍 2).
- **결론**: D3(polysemy)·D6(korean_learner_note)·D7(collocations) 채우기 = 현재 학습자 효과 0(admin 패널 전용). 카드 리치화 UI 선행 필요.
- **대시보드 정직화**: backlog D3/D6/D7 P1→P3 + "UI 미렌더 이연" 근거 · 결함 룰 3종 P1/warning→P2/info + description 에 미렌더 명시. → 사전 Health P1 warning 3건 감소.

### ACP eLife digest 소스 신설 — 고품질 과학 설명 (v06.172)
- **eLife ingester 신설** — `ingest-article/elife.ts`. eLife API(JSON)에서 편집자 저작 **plain-language digest**만 추출(연구 본문 C2 배제·dependency-0). CC-BY 4.0 → 발행 허용. register=expository(과학). digest 없는 기사 자동 거부(guard).
- 배선: SourceKey·ArticleSource·SOURCE_SPECS·POLICIES·RANKINGS·REGISTER·source-guide + enqueue/dev-enqueue + 어드민 UI(🔬 Microscope). drift-lock +1(25 tests).
- **마이그레이션 적용** — `acp_source_check_add_elife`.
- **end-to-end 실증** — elife:91060·89129 published·C1·cc_by·display_only=false·llm_cost 0(50253=digest 없음 정상 거부). expository에 최신 생명과학 topical 다양성 보강.
- docs: [CSAT_SOURCE_MATRIX.md](./CSAT_SOURCE_MATRIX.md) T-1 이동.

### 소스 매트릭스 feasibility 재분석 — CSAT_SOURCE_MATRIX 신설 (docs)
- **[CSAT_SOURCE_MATRIX.md](./CSAT_SOURCE_MATRIX.md) 신설** — 전수 소스를 feasibility 3축(포맷 HTML/PDF·라이선스 CC/NC·트리거)으로 재분류. 설계 문서 ↔ 실측 갭 해소(OWID·Factbook·Pressbooks = T-1 승격, OBP = PDF-only 반증).
- **동결 풀 판정**: 청정 viable(PLOS·eLife·Wikipedia 정규·PMC) 이나 트리거 전부 미충족 · PDF-블록(OECD·WB·UNDP·CRS/CBO/GAO) · NC 오염(LibreTexts·Saylor).
- **⚠ S3 헤지 갭(신규)** — "OWID 실패 시 OECD/UNDP 자동 승격"이 두 대체재 PDF-블록으로 작동 불가. ACP_SOURCE_REDESIGN §20.4 명기.

### 학습 루프 E2E — 진단→개인화 체인 + storageState 리팩터 (v06.171)

핵심 루프 회귀의 마지막 고가치 대상 — **진단 완료→V-Level snapshot** 추가. 진단은 사용자 V-Level 을 설정해 추천·i+1·추출 임계 등 개인화 전체를 좌우하는 진입점인데 런타임 검증이 전무했음.

- **[05-learner-loop.spec.ts](../apps/web/tests/e2e/05-learner-loop.spec.ts)** 진단 테스트 — `/diagnostic` → "진단 시작" → ~40문항 전부 "알아요" 이진 응답 → `analyze_and_apply_diagnostic_result` 가 기록하는 `user_level_snapshots(taken_reason='diagnostic')` 를 service-role 로 단언. 실측: snapshot v_level=11 기록(전 구간 동작 확인).
- **storageState 리팩터** — 3 테스트가 각자 로그인하던 것을 `beforeAll` 1회 로그인+`storageState` 재사용으로. 3중 로그인의 auth rate-limit·하이드레이션 리셋 플레이크(로그인 폼 빈 필드로 멈춤) 해소 + `loginRuntimeUser` 에 fill 값 확정 재시도 추가. ScriptQuiz 7.7s(로그인 제거로 단축)·Flashcard 51s·진단 21s = 3 passed.
- `countDiagnosticSnapshotsSince` 헬퍼([utils/db.ts](../apps/web/tests/e2e/utils/db.ts)). 이로써 핵심 루프 3종(게임 완주 ×2 + 개인화 진입) 전부 회귀 보장.

### 학습 루프 E2E — Flashcard 추가(반복 가능) (v06.170)

v06.166(ScriptQuiz 루프) 확장 — 가장 중심 모듈 Flashcard 완주→`scores(module='flashcard')` 적재 회귀 추가. 두 핵심 study 모듈 커버.

- **[05-learner-loop.spec.ts](../apps/web/tests/e2e/05-learner-loop.spec.ts)** Flashcard 테스트 — `/flashcard/play`(due 큐) → 카드별 FirstJudge "떠올렸어요"→SRSBar "기억나요" 클릭 완주 → scores 폴링 단언. 실측 적재 확인.
- **반복 가능성 확보**: flashcard 는 SRS due 큐 의존 → 완주가 카드를 미래로 밀어 재실행 시 due 0 이 되는 문제. `resetDueCards`([utils/db.ts](../apps/web/tests/e2e/utils/db.ts)) 로 실행 전 `next_review_at` 과거 리셋. service-role 키 없으면 due 보장 불가라 `test.skip`(scriptquiz 는 정적 콘텐츠라 무관).
- 인터랙션 교훈: flashcard 카드 = recall(3s 자동)→flippable(FirstJudge)→flipped(SRSBar) 3단계. Space 플립은 recall 타이밍과 어긋나 불안정 → **버튼 출현 대기+클릭**(FirstJudge "떠올렸어요"→"기억나요")이 결정론적. 2 passed(scriptquiz 26s + flashcard 55s).

### ACP register 피드 단위 전환 — narrative 채움 + VOA 오분류 교정 (v06.169)
- **register 매트릭스 5종 완성** — narrative(0→13, VOA lets-learn-english)·expository(64→78) 채움. 새 콘텐츠 없이 **정확한 분류만으로**. 5개 코어 register 전부 publishable.
- **결함 교정** — `REGISTER_BY_SOURCE`가 소스 단위라 VOA 전 피드가 'news' 오분류. `resolveArticleRegister(source, feedId)` 피드 우선 resolver 신설(`FEED_REGISTER` + `SOURCE_REGISTER_DEFAULT`, 패키지). dev-process 가 `feed_id` 읽어 적용. drift-lock +4 tests(24).
- **백필** — 기존 VOA 30건 register 재분류(narrative 13·expository 14·news 3). 메타만(단어세트 불변). news 30→3(as-it-is만 실 시사).
- docs: [ACP_SOURCE_REDESIGN.md](./ACP_SOURCE_REDESIGN.md) §20.3.

### 공용단어장 내부 챕터 구성 — 세트 1개 안에 챕터 (v06.168)

교육과정 어휘 등 대용량 단어장을 **하나의 세트 안에서 여러 챕터로 내부 구성**(챕터별 세트 발행 아님). 발행 파이프라인 개선.

- **마이그레이션** `20260709135526_shared_words_chapter_column` — `shared_words`에 `chapter smallint`(1..N, NULL=미분할) + idx `(set_id, chapter, sort_order)`. 하나의 `shared_word_sets`를 여러 챕터로 내부 분할.
- **[publish-list-word-set.ts](../scripts/lcp/publish-list-word-set.ts) 재작업** — `--chapter-size=N` 시 **세트 N개 → 세트 1개 + 단어에 chapter 배정**(정렬 순서를 N개씩 끊어 chapter 1..N, 전역 sort_order 유지). `--order=cefr`로 급별(A1→C2) 진행. `--replace`는 단일 slug + 과거 챕터별 세트(`slug-ch-*`) 모두 정리. dry-run 검증(초등 729→1세트·19챕터).
- ⚠️ 직전 per-chapter 발행분(74세트: elem19/mid30/high25)은 `--replace` 재실행 시 자동 정리됨.
- **뷰어 챕터 렌더** — [VocabSetPreviewModal](../apps/web/src/components/library/vocab/VocabSetPreviewModal.tsx): 챕터형 세트(shared_words.chapter 존재)는 **Chapter 아코디언**(접기/펼치기·첫 챕터 열림·챕터별 CEFR 범위)으로, 평면 세트는 기존 10개 미리보기. chapter 컬럼은 database.ts 재생성 전이라 loose client 접근. tsc·lint 0.
- **챕터별 학습** — 학습 로더 [fetchScopedWords](../apps/web/src/lib/workspace/scoped-words.ts) `chapter` 필터 추가(단일 출처 → 게임 공통) + [flashcard/play](../apps/web/src/app/(main)/flashcard/play/page.tsx) `?set=X&chapter=N` 지원 + 모달 아코디언 챕터별 "학습" 링크. 챕터 1개만 스코프 학습 가능. (다른 게임 wordblitz/pairflip/spellforge는 동일 로더라 chapter 전달만 추가하면 확장)

### ACP CIA World Factbook — reference register 신설 (v06.167)
- **reference register 빈칸 채움** — 발행 매트릭스 유일 공백(reference publishable 0)을 CIA World Factbook(PD)로 충족. 4개 코어 register 전부 발행 가능.
- **ingester 신설** — `ingest-article/factbook.ts`(dependency-0). factbook.json(PD 덤프) 국가 JSON `Introduction/Background` 산문만 추출(목록·표 제외). `FACTBOOK_COUNTRIES` 35국 정적 picker. 배선: SourceKey·ArticleSource·SOURCE_SPECS·POLICIES·RANKINGS·source-guide + enqueue/dev-enqueue/dev-process + 어드민(CurationConsole·SourceGetView·RssFeedTab 🌍). drift-lock 20 tests.
- **마이그레이션 적용** — `acp_source_check_add_factbook`(source CHECK +`factbook`).
- **end-to-end 실증** — South Korea(C1·40)·United States(B2·8)·France(C1·16) enqueue→process→publish: published·register=reference·public_domain·display_only=false·llm_cost 0. reference publishable **0→3**.
- docs: [ACP_SOURCE_REDESIGN.md](./ACP_SOURCE_REDESIGN.md) §20.2.

### 핵심 학습 루프 E2E — 완주→영속화 회귀 자산 (v06.166)

UI 스모크(v06.159, "렌더" 검증)의 다음 층 — "게임 완주 → DB 적재" 를 실주행+DB 단언으로 고정. 배경: ScriptQuiz 완주 결과가 sessionStorage 에만 쌓이고 소비자가 없어 scores 적재가 조용히 증발했던 결함(v06.139) 재발 방지.

- **[05-learner-loop.spec.ts](../apps/web/tests/e2e/05-learner-loop.spec.ts)** — 로그인 → `/scriptquiz/play?book=…&ch=1` 직행(Drone Ch1·4문항) → 시작 → 키보드 '1'×4 완주 → `scores(module='scriptquiz')` 신규 행을 service-role 로 폴링 단언. 실측: 완주 시 total_questions=4 행 적재 확인.
- **[utils/db.ts](../apps/web/tests/e2e/utils/db.ts)** — e2e service-role DB 헬퍼(apps/web/.env.local 직접 로드 · `userIdByEmail`·`countScoresSince`). 키 없는 환경은 UI 완주만 검증(graceful degrade).
- **스모크 견고화**: 8화면 순차 방문이 dev first-compile 누적으로 기본 30s 초과 → `test.setTimeout(120s)` + goto 1회 재시도(간헐 ERR_ABORTED frame-detached). 3/3 green.
- 인터랙션 교훈: 4지선다 옵션은 plain button(role≠radio), OX만 radio → 완주는 **키보드 '1'**(양 타입 공통 handleAnswer, window 리스너라 포커스 비의존)이 안정. 시작 게이트는 하이드레이션 전 클릭 무시되므로 문항 배지 전이 확인 후 재클릭.

### ACP 파이프라인 라이브 검증 + Simple Wikipedia junk 수정 (v06.165)

ACP(article) §18 파이프라인 라이브 검증 — **정상 작동 확인**(127 발행기사/5소스, 라이선스 게이트 정확: the_conversation cc_by_nd 전부 display_only, register×cefr 매트릭스 UI 정상, pageerror 0). 발견 1건 수정:

- **Simple Wikipedia junk 유입 수정** — `Category:Good_articles` 수집이 `gcmtype=page`로 전 네임스페이스 포함 → `Wikipedia:Good articles/by date` 같은 관리 인덱스 페이지가 발행 기사로 유입되던 버그. ingester에 `gcmnamespace=0`(주 기사) 추가([simple-wikipedia.ts](../packages/library-pipeline/src/ingest-article/simple-wikipedia.ts), `62be48a`). 라이브 검증: junk 3→0.
- **기존 junk 2건 DB 정리**(사용자 승인) — Wikipedia: 메타페이지 2 + 사용자 단어세트 2 + 단어 3 + vocab 25(cascade) 삭제. `docs/proposals/acp-cleanup-simple-wiki-junk.sql`. 검증: 전 테이블 junk 0, UI 전체 129→127·설명 B2 14→12.
- 진단 기록(수정 안 함): wikinews 0건(영문 소스 폐쇄중 + `feedrecentchanges` 피드 오선택, 실기사는 `Category:Published`) · A1-A2 gap(Simple Wikipedia 콘텐츠 실제 B1+)은 소스 현실로 확인(버그 아님).

### 보안 advisor — anon 호출 가능 무가드 DEFINER 함수 잠금 (v06.164)

Supabase 보안 advisor 점검(352 WARN·ERROR 0) 후속 — anon 키(클라 번들 공개)로 앱 인증을 우회해 호출 가능하던 무가드 SECURITY DEFINER 함수 9종 잠금. 마이그레이션 2건(`20260708120000` + PUBLIC 상속 보정 `20260708120500`), 사용자 명시 승인.

- **쓰기/액션 3종 → service_role 전용** (anon·authenticated 회수): `enrich_shared_dictionary`(마스터 사전 임의 INSERT 오염) · `regenerate_auto_curated_set`(발행 단어장 shared_words 파괴) · `process_library_pipeline_batch`(내부 토큰 외부 HTTP POST 트리거). 정당한 호출자는 전부 LCP 파이프라인 = service_role(검증) → 무영향.
- **admin 대시보드 읽기 6종 → anon 회수, authenticated 유지**: `admin_vrl_cron_jobs`·`cron_runs`·`diagnostic_use`·`snapshot_counts`·`track_distribution`·`v_level_distribution`. /admin/vrl/automation 서버컴포넌트(authenticated admin)는 유지.
- **교훈**: Postgres 함수 EXECUTE 기본이 PUBLIC grant(ACL `=X/postgres`)라 `REVOKE FROM anon` 만으로는 PUBLIC 상속으로 뚫림 — `REVOKE FROM PUBLIC` 필수(명시 grant된 service_role/authenticated 는 유지). 검증: 9종 전부 anon=false, 쓰기 3종 auth=false·srv=true, 읽기 6종 auth=true·srv=true.
- 잔여(별건·저위험): `function_search_path_mutable` 41 · `pg_graphql_*_table_exposed` 146(PostgREST 사용·RLS 게이트) · `auth_leaked_password_protection`(대시보드 토글) · `rls_policy_always_true` 2(sw_comments/players 게임).

### T-2 OWID 스케일업 + OBP 동결해제 α(Pressbooks) (v06.163)
- **OWID 8건 라이브 발행** — atom feed 8 기사 실 ingest→process→publish 전 구간(dev 라우트). argumentative CC-BY 학습 단어세트 8개(B2×7·C1×1 · llm_cost 0 · orphan 0). The Conversation(ND=display_only) 공백을 라이브 실증. dev 라우트 신설 `/api/acp/dev-enqueue`·`/api/acp/dev-publish`(service-role·NODE_ENV 가드).
- **OBP 재정찰 → 동결 유지** — 챕터 페이지 client-render + `__NEXT_DATA__` 에 PDF URL 만(산문 0) + 표본 CC BY-NC-ND. β(PDF)=dependency-0 위반 → OBP-proper 해제 불가.
- **α 실행 = Pressbooks ingester 신설** — `ingest/pressbooks.ts`(dependency-0·SE 계약 mirror·CC-BY 서버렌더 HTML). `LibrarySource`+`pressbooks`, 배럴 export. dev 라우트 3종: `/api/lcp/dev-ingest-preview`·`/api/lcp/dev-enqueue-book` + dev-process `pressbooks` 케이스(`max_chapters`).
- **마이그레이션 적용** — `library_books_source_add_pressbooks`(source CHECK +`pressbooks`).
- **end-to-end 실증** — `Introduction to Sociology 2e`(book_id 406dbc3e) enqueue→process→force-publish: published·CC BY 4.0·CEFR C1·book_v_level 8·23 챕터·23/23 챕터 단어세트(894단어)·word_count 367,776·llm_cost 0. LCP book 경로 실증(OWID=ACP article 경로에 이어).
- docs: [ACP_SOURCE_REDESIGN.md](./ACP_SOURCE_REDESIGN.md) §20.1 · [LIBRARY_PIPELINE.md](./LIBRARY_PIPELINE.md) 소스표.

### B1(VCB-VRL) 진단 — 허위 P0 강등, 대시보드 Critical 0 (v06.162)

사전 Health 대시보드 마지막 P0(B1) 착수 전 진단에서 D2·V1과 동일 패턴 확인 — 기능은 이미 우회 경로로 달성, 남은 것은 견고성 부채. 코드만 변경(데이터·마이그레이션 0).

- **진단**: `recommend_word_sets_for_user` 는 slug 조립(`auto-vlevel-v' || level`)으로 세트 조회 — V-Level 단어장 발행·추천·구독 전부 동작(auto-vlevel V1~V9 9세트 + 도서 챕터 260세트 curation_query.book_v_level). 전용 컬럼 부재의 실비용 = 슬러그 네이밍 관례 결합(소비처 RPC 1곳·사고 0건)·인덱스/무결성 부재뿐.
- **결함 룰 1** ([critical-defects-detector.ts](../apps/web/src/lib/admin/dict/critical-defects-detector.ts)): `vcb_vrl_not_integrated` P0/critical → **P2/info**, 문구를 "우회로 동작 중, 세트 대량화/슬러그 개편 시 전용 컬럼 도입"으로. → **대시보드 P0 Critical = 0**(실측 정합: audio_url·segment·v_level 은 이미 충족·미발화).
- **R3 점수 정직화** ([health-score-v2.ts](../apps/web/src/lib/admin/dict/health-score-v2.ts)): 최대 가중(0.3) 팩터가 "스키마 컬럼 존재?"(구조적 항상 0, `🚨 V-Level 단어장 0/72` 허위 evidence)로 R3 를 끌어내리던 것 → "V-Level 단어장 발행 동작"(우회 동작=0.85, 견고성 부채 -0.15) 실측 반영. 가중치는 유지(재분배 없음).
- **백로그 B1** ([backlog-items.ts](../apps/web/src/app/admin/vrl/_components/backlog-items.ts)): P0 본질페인 → **P3 이연**("견고성 — 세트 대량화/슬러그 개편 시").

### VCB 파이프라인 어드민 재설계 — 스킬-우선·DB-status·정합성 (v06.161)

`/admin/vocab/runs` 프로세스·화면 전체 재검토/재설계. 결정 A(위저드 필터 제거)·B(out-of-band 스킬을 정식 경로)·C(저빈도 전문가 도구) 반영. 각 변경 dev :3100 + Playwright 스크린샷 검증.

- **위저드 3→2스텝**: 필터 UI(FilterPanel/LiveCountBadge/DistributionChart/SampleWords) + `filter-actions.ts` + `CreateRunInput.filters/limits` 전량 제거. run 생성은 preset + meta 만.
- **스킬-우선 callout**: enrich(§5)·seed(§2) 카드에 "Claude Code에서 `/vcb-batch-enrich`·`/vcb-seed-list` 실행 권장, in-UI 자동실행은 로컬 dev 편의" 안내.
- **집계 1000행 cap 버그 수정**: `aggregateRunCounts`·`precheckPublish`가 PostgREST 1000행 기본 cap에 걸려 2,000+ run의 승인/발행 카운트가 반토막(→ 거짓 정합성 배너·"50% 완료"). `.range()` 페이지네이션으로 전량 집계.
- **발행 원자성**: `publishRun`의 JS insert 시퀀스+보상 로직을 `vcb_publish_commit(...)` SECURITY DEFINER RPC 단일 트랜잭션으로 치환(service_role 전용 grant).
- **run 진행 오리엔테이션**: `VcbRunProgress`(run.status 기반 7-phase 스텝퍼 + 다음 액션). FS 의존 `VcbPipelineGuide` + `pipeline-steps.ts`(computeStepStatuses) dead code 제거.
- **RLS 정합**: 어드민 서버 조회를 `createAdminClient()`(service_role) + `requireAdmin` 게이트로 — DEV_ADMIN_BYPASS(auth.uid()=NULL) 하에서 RLS 조회 실패 해소.
- **404 수정**: `/admin/vocab/collections` 페이지 신설(발행 컬렉션 목록).
- **Phase 1.5 MockBanner 제거**: 관리자 콘솔 어디도 mock 미사용 → 전역 "MOCK · 시각 검증용" 배너 삭제(실 mutation 오인 위험).
- **마이그레이션**: `drop_vcb_filter_preview_rpcs` — orphan RPC 3종(vcb_count_words_matching·vcb_distribution_for_filters·vcb_sample_words_for_filters) DROP.

### /plan 공용단어장도 다건 선택 — 소스탭 패턴 통일 (v06.160)

공용단어장(word_set)을 스크립트·내 스크립트와 **동일한 소스탭 패턴**(좌 2열 네비 + 우 다건 선택)으로 전환. 이제 도서를 제외한 3탭 모두 다건 선택.

- **분류 축**: 카테고리(수능/공인시험/…/도서 챕터)를 1단, **도서 챕터는 소속 책을 2단**(feed_label=책 제목). `plan-actions`에서 `source`=category, library_book은 책 제목 조인(scripts와 통합 조회).
- **컴포넌트 일반화**: `buildArticleNav`에 소스라벨·정렬 파라미터 추가(word_set=`wordsetCategoryLabel`), `isSourceTab`에 word_set 포함, `ArticleNav` 컬럼 라벨 prop(카테고리/책), `ArticleSelectPane` 아이콘 type별(Layers), `commitSourceBatch` pool 확장.
- **정리**: 표준 경로의 word_set 분기·`WordSetBookGroups`·`bookTitleById`·죽은 groups 분기 제거(−250여 줄). 도서만 표준 master-detail 유지.
- 검증: `tsc --noEmit` 내 파일 0 오류(무관한 동시 WIP `source-guide.ts` 'owid' 오류는 별개).

### UI 스모크 상시 자산화 — 화면 검증 자동화 (v06.159)

지금까지 화면 검증은 매번 임시 Playwright 드라이버 작성→삭제(반자동)였음 — 상시 자산으로 전환.

- **[04-ui-smoke.spec.ts](../apps/web/tests/e2e/04-ui-smoke.spec.ts)** 신설 — 학습자 8화면(/hub·/dashboard·/plan·/wordvault·/flashcard·/pairflip·/scriptquiz·/library/books) 렌더 + 404/에러 바운더리 부재 + **페이지별 콘솔 에러 0 단언** + EchoMatch 마이크 게이트 렌더. 계정: runtime-test-0705(시드 존치).
- `pnpm --filter web test:e2e:smoke` 스크립트 추가 — 기존 dev 서버 재사용, 없으면 자동 기동(기존 playwright.config).
- **[apps/web/CLAUDE.md](../apps/web/CLAUDE.md) "화면 검증" 섹션** — 향후 세션이 자동으로 이 경로를 쓰도록 규칙화: 임시 드라이버 금지 · 새 검증 시나리오는 spec 으로 남겨 자동 회귀화 · fake-mic 플래그 · **⚠️ dev 서버 1개 원칙**(멀티 세션 `next dev` 동시 기동 시 `.next` 공유 오염 → 라우트 무작위 404, 2026-07-07 실측).
- 참고: 첫 실행 검증은 현재 dev 서버 `.next` 오염(/login 404)으로 보류 — 서버 재시작 후 1회 실행 필요.

### EchoMatch 채점 3축 재설계 — 구조적 0점 결함 수리 (v06.158)

런타임 점검(v06.33 이후 첫 실주행 검증)에서 파이프라인(TTS·녹음·4-Phase·DB 적재)은 정상이나 **채점이 항상 낙제점**(실사용 7건 overall 0~53, timing 6/7건 0)임을 확인 — [dtw-comparator.ts](../apps/web/src/lib/echo/dtw-comparator.ts) 재설계.

- **인토네이션**: 절대 Hz DTW(여성 참조 Amy ~200Hz vs 남성 화자 ~110Hz → 평균차만으로 threshold 80Hz 소진 = 구조적 0점) → **semitone 변환 + 화자 평균 제거** 후 곡선 '모양' DTW (threshold 5st).
- **강세**: 절대 RMS DTW(마이크 게인에 점수 좌우) → **시퀀스 피크 정규화** 후 상대 강세 패턴 DTW (threshold 0.4).
- **리듬**: 무음 포함 전체 녹음 길이 비율(발화 전 머뭇거림+완료 버튼 지연이 0점 유발, 실측 8.5s 녹음/3s 참조) → **voiced 구간 발화 길이의 로그 비율** (2.5배에서 0점, 대칭 감점).
- **회귀 테스트 7종** ([__tests__/dtw-comparator.test.ts](../apps/web/src/lib/echo/__tests__/dtw-comparator.test.ts)) — 결함 3건을 시나리오로 고정(옥타브 차 동일 억양 ≥85 · 게인 5배 ≥90 · 무음 패딩 timing ≥95) + 변별력 보존(다른 곡선 < 같은 곡선, 2.5배 느림 = 0, 무음 = 전축 0). 전 스위트 106 passed.
- 한계: threshold 3종은 합성 contour 기준 보정 — 실음성 베타 데이터로 재보정 여지. 런타임 재주행은 dev 서버 `.next` 공유 충돌(멀티 세션)로 이번엔 유닛 검증까지 — 파이프라인 자체는 수리 전 실주행에서 완주 확인됨.

### /plan 내 스크립트 '도서에서'를 책별 2차 분류 (v06.157)

v06.155 후속 — `도서에서`(library) texts가 단일 '전체'에 평면으로 쌓이던 것을 **소속 도서로 2차 분류**(feed_label=책 제목) → **소스 → 책 → 챕터** 3단(article의 소스→프로그램→컨텐츠와 동일).

- `plan-actions` scripts fetch에 `library_book_id`·`chapter_idx` 추가 + `library_books` 제목 조인. `feed_label`=책 제목(library 소스), 책→챕터 순 정렬.
- 실측: 도서에서 235 texts → **5권**(Twenty years after 90·Decline&Fall 71·Pride&Prejudice 61·Alice 12·Ammachi 1)으로 그룹.
- 검증: `tsc --noEmit` 통과.

### D2(register 백필) 진단 — 허위 P0 해소, segment 실지표로 교체 (v06.156)

register 43,988행 백필 착수 전 진단에서 전제 반전 확인 — 코드만 변경(데이터·마이그레이션 0).

- **진단**: D2 의 기대효과(segment 자동 단어장)는 **list_tags 로 이미 달성**(specialty 4종 curation_query 실측: `list_tags has moel_1.0` 등). SSoT 가 소비하는 것은 `word_register`(100% 채움)이고, `register` 컬럼은 **앱 내 소비처 0** — admin 지표만 참조하던 허위 P0.
- **결함 룰 4 교체** ([critical-defects-detector.ts](../apps/web/src/lib/admin/dict/critical-defects-detector.ts)): `register_critical_null`(항상 발화) → `segment_tags_underdeveloped`(segment 태그 풀 <50% 시만). 실측 2,661 row/목표 3,000 = 89% → 미발화.
- **점수 정상화** ([health-score-v2.ts](../apps/web/src/lib/admin/dict/health-score-v2.ts)): R3 팩터(가중 15%)와 coverage(6%)의 register 채움률(3.3%) → segment 태그 충족률(89%)로 교체 — "segment 매칭 불가 🚨" 허위 evidence 제거. `SEGMENT_TAGS`/`SEGMENT_TAGS_TARGET` 상수 신설([queries.ts](../apps/web/src/lib/admin/dict/queries.ts), coverage fetch +1 카운트).
- **백로그 D2**: P0 → P3 이연 — "격식(formal/informal) 표시 UI 등 실소비처 확정 시 재개"(룰 커버 ~2.6K + LLM 잔여로 재산정). 대시보드 P0 는 이제 B1(VCB-VRL 컬럼) 단독.

### /plan 내 스크립트도 소스별 분류 + 다건 선택 (v06.155)

내 스크립트(개인 texts)를 스크립트(article) 탭과 **동일한 소스별 분류 네비 + 다건 선택** 디자인으로 통일.

- **분류 축 = `texts.source`(text_source)** — 도서에서 / 직접 입력 / 파일 업로드 / 공유 세트. `ARTICLE_SOURCE_LABEL`에 text_source 라벨 추가(키 비충돌로 공개·개인 스크립트 공용), `articleSourceLabel` 폴백 정리.
- **컴포넌트 공용화** — `isSourceTab`(article|script) 분기로 `ArticleNav`(좌 2열) + `ArticleSelectPane`(우 다건 선택)를 두 탭이 공유. `ArticleSelectPane`/`ArticlePickRow`에 `type` prop(활동 목록·배지·countByKey 키). `commitArticleBatch` → `commitSourceBatch`(활성 탭 type + 해당 pool).
- 탭 전환 시 다건 선택·소스 상태(`artSel`/`artActs`/`artSrc`/`artProg`) 리셋.
- `plan-actions` scripts fetch에 `source` 추가. 검증: `tsc --noEmit` 통과.

### 스텁 예문 백로그 전량 종결 — 근접 노출 201 교체 + 잔여 6,894 NULL (v06.154)

v06.152(사전 보강)에서 발견한 비노출 스텁 예문 7,096건 처리 완료 — DB 데이터만 변경(코드 0).

- **근접 노출 201단어**(published/ready 도서 어휘에 등장 — 향후 세트 발행 시 노출될 후보): 전부 정상 예문으로 교체. 개인 단어장·아티클 겹침 0 실측.
- **잔여 비노출 6,894건: `example_en = NULL`** — 깨진 템플릿 문장("The X is referenced in this passage.")을 학습자에게 보여줄 바에는 공란이 정직. 채움률 착시 제거(example NULL 171→7,065 = 실상 노출). 추후 해당 단어가 노출 경로에 들어올 때 lazy-enrich.
- 전수 스캔 검증: 스텁 패턴 잔존 **0** · 당일 갱신 7,413행 산술 정합(331 보강+181 예문+6,894 NULL).
- 인프라 메모: 작업 중 Supabase MCP 프록시 502 장기 장애 → 서비스롤 supabase-js 폴백(프로젝트 관례, `scripts/dict-fill/*-import` 패턴). PostgREST LIKE 전표 스캔은 statement timeout — PK(word) 범위 페이지네이션 + 클라이언트 필터로 우회. 임시 스크립트는 삭제.

### fix: /plan 탭 전환 시 우측 컴포저 초기화 (v06.153)

도서/공용단어장/내 스크립트에서 자료를 골라 `draft`가 생긴 상태로 스크립트 탭으로 전환하면, 우측 우선순위(`draft > … > ArticleSelectPane`)에서 옛 구성이 남아 스크립트 컨텐츠 선택 영역이 안 보이던 버그. 탭 버튼 onClick에 `setDraft(null)`+`setEditId(null)`+`setError(null)` 추가.

### /plan 스크립트 학습대상 다건 선택 + 우측 선택 영역 재설계 (v06.152)

컨텐츠를 하나 누르면 곧바로 단건 구성으로 가버려 **여러 개를 못 고르던 구조** 개선 — 우측 선택 영역을 다건 선택 체크리스트 + 공유 구성 + 일괄 담기로 재설계.

- **`ArticleSelectPane`/`ArticlePickRow`(신규)** — 컨텐츠 행에 체크박스, 여러 개 토글 선택. 선택 ≥1이면 아래에 **선택분 공통 활동·요일** 구성이 열리고, **`계획에 담기 (N개 자료)`**로 일괄 저장.
- 상태 리프트 `artSel`(선택 id 집합)·`artActs`·`artDays` + `commitArticleBatch`(선택분 순차 savePlanItem, 낙관적 일괄 추가). 도서/공용단어장/내 스크립트는 기존 단건 draft 유지(도서는 챕터 per-book).
- 행 디자인 폴리시 유지(hover 리프트·체크 채움), 이미 담긴 자료 '담김' 배지.
- 검증: `tsc --noEmit` 통과, 잔여 참조 0.

### 교육과정 기본어휘 3,000 `list_tags` 태깅 완료 ([별책14]) (v06.146)

2022 개정 영어과 교육과정 기본어휘([별책14] PDF)를 검토·추출해 `shared_dictionary.list_tags`에 별표 등급별 3단 태그 부착 완료. 공용단어장 VCB 필터에서 즉시 사용 가능.

- **추출·검증** — `pdftotext`로 3,045 core(공식 3,000 + 슬래시 철자변형) 추출, dropped 0. 등급 `*`819·`**`1,215·무1,011 = 문서 명시 배분과 일치. 파생형(괄호) 226 별도.
- **커버리지** — 3,025/3,045(**99.3%**) 이미 `shared_dictionary` 존재, 누락 20(철자변형/구어/역형성 — 대부분 정본 twin 존재). 읽기전용 실측(service-role).
- **스테이징** — [data/curriculum/](../packages/library-pipeline/data/curriculum/) `kcurr2022_1/2/0.csv`(별표 등급별) + `kcurr2022_missing.csv`(20). [import-ngsl-list.ts](../scripts/lcp/import-ngsl-list.ts) `VALID_LIST_IDS`에 3 태그 등록.
- **연계 감사** — `list_tags` 소비처 2갈래: VRL 분류(`calc_v_level/track/domain`)는 알려진 태그(ngsl/csat/bsl 등)에만 분기 → `kcurr2022_*` 무영향(분류 불변, 트리거 재계산 없음) · VCB 단어장 필터(`vcb_*_for_filters` = `list_tags && tags`)로 공용단어장 큐레이션 가능. FK 체인 `shared_word_sets→shared_words.lemma→shared_dictionary` 확인.
- **적용 완료(멱등 append, 사용자 실행)** — `kcurr2022_1`=808 · `kcurr2022_2`=1,211 · `kcurr2022_0`=1,006 = **합계 3,025행**(disjoint, DB 실측 대조). 태그 구조 3단(별표별, 사용자 확정).

### 큐레이션 드레인 큐 통합 + 품질 검토 task (v06.153)

Curated Books 드레인 큐를 단일화하고, 드레인(Claude Code 배치)이 생성/매핑을 넘어 **품질 검토(레벨·어휘)**까지 하도록 확장.

- **큐 통합** — 퀴즈 큐(`book_quiz_jobs`)를 `book_curation_jobs`(`task_type` 판별자)로 흡수 후 DROP. 배너 2개(`CurationJobsBanner`+`QuizJobsBanner`) → **`DrainQueueBanner` 1개**(🔊 매핑 / 📝 퀴즈 / 🔬 검토). `dev-process` upsert/delete 에 `task_type='voice_map'` 필터(퀴즈 잡 오삭제 방지). 마이그 `unify_quiz_into_curation_jobs`.
- **검토 task 2종** — `level_verify`(본문 근거 CEFR/V 재판정, [`review-book.mjs`](../scripts/lcp/review-book.mjs)) + `vocab_audit`(발행 단어장 뜻·품사·레벨·register 감사, [`audit-vocab.mjs`](../scripts/lcp/audit-vocab.mjs)). `book_curation_jobs.result` jsonb + `enqueue_review_jobs(uuid[],text)` RPC + Bulk 툴바 `레벨 검토 큐`·`어휘 감사 큐` 버튼. 마이그 `drain_review_tasks_level_vocab`.
- **오케스트레이터** — [`scripts/lcp/drain.mjs`](../scripts/lcp/drain.mjs) (`list`/`next`): 4 task 통합 큐 단일 진입점(무엇을·어떻게 드레인).
- **실증** — Pinocchio 어휘 감사 3건(`stroke=뇌졸중→타격` 등 문맥 오류) → `shared_dictionary` 교정 + 발행 스냅샷 10건 전파. Alice Adams 레벨 `B2/V8 → C1/V9` 교정(`cefr_band` 포함 4지표 일관화). `review-book --correct` 가 `cefrj_level` 미갱신해 `cefr_band` 안 따라오던 결함 수정.
- (Curated Books 프로세스 재설계 R1~R4 + 완료 배너 액션 + `⟳ 새로고침` 은 [v06.131](#curated-books-프로세스-재설계--통합정리-v06131))

### 사전 노출 단어 표적 보강 + 스텁 예문 교체 (v06.152)

"Tier B/C enrichment ~5.1K" 백로그 재진단·종결 — DB 데이터만 변경(코드 0·마이그레이션 0).

- **재진단**: rank 보유 구간(28,673)은 example 100%·ipa 96%+로 건강. 미보강 코어 = rank NULL 16,823 중 **발행 세트 노출 331단어**만 표적 보강(고유명사 0·구동사 19 포함) — ipa 77→1 · synonyms 142→48 · collocations 278→20 · example→0. 잔여는 대명사·약어·희귀어 등 본질상 동의어/연어 없음(강제 생성 대신 정직한 공란).
- **🔴 발견·수리**: 템플릿 스텁 예문 7,143건("The X is referenced in this passage." 등)이 example 채움률 100% 착시를 만들고 있었음 — **발행 세트 노출 47건 전량을 정상 예문으로 교체**(노출 스텁 0 확인). 비노출 잔여 7,096건은 백로그 기록.
- 보류/종결: B/C collocations 16,001(보류) · 세트 밖 노출 4,652(저ROI 보류) · 비노출 ~10.8K(종결).
- 빈 필드만 채우는 가드(`CASE WHEN … IS NULL OR =''/'{}'`)로 기존 값 무손실 · 스텁 교체는 패턴 매치 가드.

### /plan picker 행·컬럼 디자인 폴리시 — 상태·깊이 적용 (v06.151)

컨텐츠 행이 hover/active 상태·깊이 없이 평면적이던 것 정비(디자인 원칙: 인터랙티브 요소 hover+active+focus 필수).

- **MaterialRow**(전 탭 공용) — hover 리프트(`-translate-y-px` + `border-[var(--p)]` + `shadow-sm`), `active:scale` 프레스, `+` 아이콘 group-hover 잉크 채움, V-Level 배지 outlined pill, 제목/부제 leading 정리.
- **ArticleContentPane** — 헤더 하단 구분선 + 아이콘 배지 + 개수 pill + 안내문 italic.
- **ArticleNav** — 소스·분류 열에 컬럼 라벨(mono uppercase) 추가로 3단 구조 명시.
- 검증: `tsc --noEmit` 통과. 하드코딩 색 없음(전부 토큰).

### /plan 스크립트 컨텐츠 리스트를 우측 선택 영역으로 (v06.150)

v06.149(좌측 3열) 후속 — 사용자 요청대로 **좌측=소스·분류 2열 네비**, **컨텐츠 리스트는 우측 넓은 선택 영역**으로 이동(제목이 좁게 잘리던 문제 해소). 컨텐츠 클릭 시 그 자리에서 활동·요일 구성으로 전환.

- 소스·프로그램 선택 상태를 PlanClient로 리프트(`artSrc`/`artProg`) → 좌 네비와 우 컨텐츠가 공유. `buildArticleNav` 순수 헬퍼.
- `ArticleColumns`(3열) → `ArticleNav`(좌 2열) + `ArticleContentPane`(우 컨텐츠 리스트)로 분리. 소스 클릭 시 프로그램 리셋.
- 우측 구성 패널 우선순위: draft > editItem > (article) 컨텐츠 리스트 > 빈 안내.
- 검증: `tsc --noEmit` 통과, `ArticleColumns` 잔여 참조 0.

### /plan 스크립트 picker 3열 드릴 — 소스 | 분류 | 컨텐츠 (v06.149)

v06.146(프로그램=우측 헤더) 후속 — 사용자 요청대로 **진짜 3열**로: ① 소스 열 → ② 소스별 분류(프로그램) 열 → ③ 가장 오른쪽 컨텐츠 리스트. 각 단계가 독립 열이라 클릭으로 드릴다운.

- `ArticleColumns`(신규) — 3열 레이아웃 + 소스/프로그램 2개 선택 상태(useState). 소스 클릭 시 프로그램 첫 항목으로 리셋, 컨텐츠는 선택 프로그램만. `ArticleFeedGroups`(우측 헤더 방식) 대체.
- 프로그램 라벨 소스명 중복 제거(`shortProgramLabel`, 원문 tooltip). feed 없는 소스는 '전체' 1개.
- 도서·공용단어장·내 스크립트는 기존 표준 master-detail 유지.
- 검증: `tsc --noEmit` 통과, 잔여 참조 0.

### VRL admin read RLS 정책 + is_admin() 헬퍼 (v06.148)

v06.147 발견분 수리 — 마이그레이션 `20260706010000_vrl_admin_read_policies` (사용자 명시 승인 "적용").

- **`is_admin()`** SECURITY DEFINER STABLE 헬퍼 신설 — `user_profiles` 자기참조 정책의 infinite recursion 방지 표준 패턴 (EXECUTE→authenticated).
- **admin read 정책 4건**: `user_level_snapshots`·`user_profiles`·`user_diagnostic_results`·`vrl_diagnostic_tests`(비활성 포함) — 기존 본인(own) 정책은 유지, admin 에게 SELECT 만 추가.
- 효과: `/admin/vrl/users`·`snapshots`·`diagnostic` 하위 페이지 + automation "최근 레벨 변경"·분포 source 분리 섹션이 실데이터 표시.
- 검증: admin 세션 시뮬레이션 profiles 3·snapshots 5·diag_results 6·tests 5(비활성 포함) 가시 + 재귀 오류 0 · 학습자 세션 본인 1행만(타인 0) 격리 유지.

### /admin/vrl 두 대시보드 현행화 + 고도화 (v06.147)

사전DB Health·VRL Automation 화면을 2026-07-06 DB 실측과 대조 — 불일치 정정 + 관측 강화. 마이그레이션 0 (RLS admin read 정책은 별도 결재 대기).

- **Backlog 현행화** ([backlog-items.ts](../apps/web/src/app/admin/vrl/_components/backlog-items.ts)) — 완료 확인 4건(D1 cefr_confidence 99.6% · V1 V-Level 100% 분류 · C1 진단 5종+FE · D4 inflected_forms 권위화)을 `status:'done'`+실측 근거로 분리 그룹 표시, 헤더는 "남은 N · 완료 M". stale 수치 정정(D3 17.5%, D5 26.8%, D9 ~55%).
- **결함룰 13 라이브화** ([critical-defects-detector.ts](../apps/web/src/lib/admin/dict/critical-defects-detector.ts)) — CEFR C2 과대표현이 하드코드 스냅샷(56.2%/38,605)으로 발화하던 것을 `raw.categorical.by_cefr_level` 라이브 계산(>40% 발화)으로 교체. 룰 1(VCB-VRL) 설명을 현행 우회 구조(curation_query book_v_level·slug) 반영해 정확화. BACKLOG.V1 stale copy 정정.
- **Automation 관측 강화** ([automation/page.tsx](../apps/web/src/app/admin/vrl/automation/page.tsx)) — ① "최근 레벨 변경" 테이블 신설(user_level_snapshots 10건: 시각·사용자·V변화·사유 — cron `"1 row"` 메시지로는 승급 내용이 안 보이던 문제 해소) ② V-Level 분포에 근거 있는 레벨(진단·학습·수동) vs 기본값(미진단) 인원 분리 표기(기본값 부풀림 착시 방지).
- **발견(별도 결재)**: `user_level_snapshots`·`user_profiles`·`user_diagnostic_results` RLS가 본인 read 전용이라 **/admin/vrl/users·snapshots·diagnostic 하위 페이지와 위 신설 섹션이 admin 세션에서도 사실상 빈 화면** — admin read 정책 마이그레이션 필요.

### /plan 스크립트 picker 3단계 통일 — 도서와 동일 master-detail (v06.146)

스크립트(article) 탭이 **레일에 소스+프로그램을 2단 트리로 욱여넣던** 전용 `ArticlePicker`를, 도서·공용단어장과 **동일한 표준 master-detail**로 되돌림 — 레일=**소스(1축)** → 우측=**프로그램(feed) 헤더** → **컨텐츠 행** (공용단어장 도서챕터와 동일한 3단).

- 전용 `ArticlePicker`/`ArticleRailSource`/`ArticleRailProgram`/`ArticleCrumb`(레일 2단 트리) 제거(−238줄), 표준 렌더 경로로 통합. 우측 그룹 렌더에 `article → ArticleFeedGroups` 분기 추가.
- 프로그램 헤더는 `shortProgramLabel`로 소스명 중복 제거("The Conversation — Health + Medicine" → "Health + Medicine", 원문 tooltip). 레일 폭 96→110px(소스명 수용).
- 검증: `tsc --noEmit` 통과, 제거 컴포넌트 잔여 참조 0.

### /plan 학습 계획 다중 엔트리 — 챕터=최하위 단위 일별 배치 (v06.145)

"일별 · 다수 소스 · 다수 챕터" 요구 충족 — 한 자료를 여러 배치로 담아 챕터를 날짜별로 쪼갤 수 있게. 계획 관리 기본 기능 전면 점검 후 모델 결함 + 삭제 버그 동시 수리.

- **마이그레이션** `20260706024846_p1_plan_multi_entry` — `study_plan_items` `UNIQUE(user_id,material_type,material_id)` **제거**(백킹 인덱스 동반 제거, 조회는 `idx_study_plan_items_user`). 한 자료가 **여러 행(요일×챕터 배치)** 으로 존재 → '월=Alice Ch1 / 수=Alice Ch2' 가능. 무손실(기존 3행 유효). 롤백 SQL: `docs/AI_CONTEXT/rollback/`. 검증: 같은 (user,book) 2배치 삽입 충돌 없음(트랜잭션 확인 후 정리).
- **[plan-actions.ts](../apps/web/src/lib/learner/plan-actions.ts) `savePlanItem`** — `onConflict` upsert 제거 → `id` 있으면 UPDATE by id, 없으면 INSERT 후 **`id` 반환**. **버그 수리**: 기존 낙관적 갱신이 `id:'tmp-…'` 부여 → 방금 담은 항목 삭제 시 uuid 파싱 오류로 실패하던 문제 해결(실 id 사용).
- **[PlanClient.tsx](../apps/web/src/components/plan/PlanClient.tsx)** — picker 클릭=**항상 새 배치**(기존 '담김→편집 점프' 제거), '담김' 배지→**개수(계획 N)**, 편집/삭제는 주간 보드 카드. 보드 카드 챕터 배지 소수(≤3)는 번호 표기(`chapterBadge`)로 같은 도서 배치 구분. `MaterialRow`/`WordSetBookGroups`/`ArticlePicker`/`ArticleFeedGroups` 시그니처 `added/editing`→`count` 정리.
- 죽은 `study_plan_schedule` 주석 참조 정리(plan-actions·plan-activities). `tsc`·`lint` 0.

### /plan 스크립트 picker 계층 레일(소스→분류→컨텐츠) (v06.144)

스크립트(article) 자료 고르기를 **소스→프로그램(분류)→컨텐츠** 캐스케이드로 재구성 — 분류를 고르면 오른쪽에 그 분류의 글 목록이 나오도록.

- **[PlanClient.tsx](../apps/web/src/components/plan/PlanClient.tsx) `ArticlePicker`**(신규) — article 탭 전용 2-pane: 좌측 계층 레일(소스 헤더 + 그 아래 분류 항목) + 우측 컨텐츠. `rail` = `all`/`s:<source>`/`p:<source>:<feed>`. 분류 선택=평면 글 목록 + 브레드크럼(소스·분류), 소스 선택=프로그램 하위그룹, 전체=소스별 그룹. `ArticleRailSource`/`ArticleRailProgram`/`ArticleCrumb` 보조.
- **`shortProgramLabel`** — 좁은 레일에서 부모(소스) 이름 중복 제거: "The Conversation — Health + Medicine"→"Health + Medicine" · "NASA News Releases"→"News Releases" · "Good Articles (Simple Wikipedia)"→"Good Articles"(원문은 tooltip 보존) + 2줄 `line-clamp`. 실데이터 4소스·11프로그램·121편 기준.
- 도서/단어장/내스크립트 탭은 기존 제네릭 rail 유지. 순수 UI(DB/RPC 0) · `tsc`·`lint` 0.

### /plan 주간 보드 세로→가로 7열 캘린더 재설계 (v06.143)

기존 "요일=행(아젠다 나열)" 을 "요일=열(가로 7열 캘린더)" 로 전환 — Google Calendar/Notion board/Things 3 정합 + Reading Room 아이덴티티 유지.

- **[PlanClient.tsx](../apps/web/src/components/plan/PlanClient.tsx) `WeekBoard`** — `grid-cols-7 items-start` 7열. 데스크톱=한 화면(min-w-820px 이하로 넘침 없음), 모바일=가로 스크롤(`snap-x` + 열 `snap-start`) 로 "가로" 컨셉을 소형 화면까지 관철. 오늘 열은 마운트 시 스크롤로 가시화(넘칠 때만, 데스크톱 무해).
- **요일 헤더 밴드** — 요일·날짜·'오늘' 배지. 오늘=테두리(`--p`)+틴트 헤더(`--p-light`)+배지 3중 인코딩(색맹 대응). 계획 있는 날=흰 종이 카드(`--bg`+shadow)로 도드라지고, 빈 날은 캔버스(`--bg2`)에 잠겨 물러남(기존 emphasis 로직 계승).
- **`DayCard`(신규, `WeekDayCell` 대체)** — 좁은 열(≈120px)용 압축 카드: 표지 글리프 + 챕터 배지 + 제목 2줄 `line-clamp-2` + 활동 글리프(최대 4 + `+n`). active=편집 중 잉크 채움. `요일 미정` 섹션은 `BoardChip`(행형) 유지.
- 검증: `tsc --noEmit` 0 오류 · `next lint` 0 경고. DB/RPC/라우트 변경 없음(순수 UI).

### /admin/quality "지금 수집" 버튼 + admin wrapper RPC (v06.142)

v06.140 후속 결재분 — nightly 를 기다리지 않는 즉석 스냅샷 수집.

- **마이그레이션** `20260706000000_admin_collect_quality_metrics` — `admin_collect_quality_metrics()` (SECURITY DEFINER, `user_profiles.role='admin'` 검사 후 `collect_quality_metrics()` 위임, EXECUTE→authenticated). 검증: 비admin 세션 'admin only' 차단 + admin 세션 9행 수집(트랜잭션 내 확인 후 ROLLBACK — 실데이터 오염 0).
- **[CollectNowButton.tsx](../apps/web/src/app/admin/quality/CollectNowButton.tsx)** — RPC 호출 → `router.refresh()`. 4상태(idle/loading/done/error) + Calm 피드백("새 스냅샷을 수집했어요"). dev-bypass(anon)에선 RPC 거부 → 오류 상태(정상).
- 참고: MCP `apply_migration` 이 권한 분류기에 거부되어 동일 SQL 을 `execute_sql` 로 적용 + `schema_migrations` 이력 수기 기록(버전 `20260706000000`) — 리포 마이그레이션 파일과 정합.

### ACP 나머지 소스 발행 — 전 소스 프로그램 구조 완성 (v06.141)

v06.137(소스→프로그램→컨텐츠 + VOA 30편) 후속 — 남은 3개 소스의 시드도 전량 발행해 `/plan` picker 모든 소스에 프로그램 하위그룹을 채움.

- **`scripts/acp/publish-article-seeds.mjs`**(신규, 범용) — 소스별 ingester 분기 + `--source`/`--delay` + rate-limit throttle(MediaWiki 429 대응, wiki 기본 1500ms). VOA 전용 스크립트의 일반화판.
- **발행**: Simple Wikipedia 36(Good/Very Good, 429 재시도 3회로 완료) · NASA 30(News Releases 18/Image of the Day 12) · The Conversation 25(CC-BY-ND → **display_only** 읽기전용). 전량 published + article_v_level 산출.
- 전 소스 합계 **121편 · 11개 프로그램** — VOA(4)·NASA(2)·Simple Wiki(2)·The Conversation(3).

### 품질평가 Q3 — /admin/quality 지표 대시보드 (v06.140)

Q1(골든셋 스냅샷)+Q2(nightly `quality_metrics` 수집, PR #94) 후속 — 수집만 되고 보는 화면이 없던 지표를 admin 콘솔에 노출. 마이그레이션 0.

- **`/admin/quality`** ([page.tsx](../apps/web/src/app/admin/quality/page.tsx), Server Component 단일 파일) — 파이프라인 단계(ingest→analyze→extract→publish→deliver)별 지표 카드: 최신값 + 전회 대비(▲/▼ %p) + 수집 이력 스파크라인(SVG) + `dims` 측정 모수 상세. 도서 지표는 `dims.status`(published/ready) 세그먼트 분리. 미등록 신규 metric 도 원문 라벨로 자동 노출.
- **AdminSidebar** '운영' 그룹에 "품질 지표"(Gauge) 등재.
- **렌더 테스트** [__tests__/page.test.tsx](../apps/web/src/app/admin/quality/__tests__/page.test.tsx) — RLS(read=admin) 탓에 dev-bypass 실주행은 빈 상태만 확인 가능 → 데이터 분기(카드·세그먼트·delta·스파크라인·dims·빈 상태·오류 폴백)는 `renderToString` 픽스처 3케이스로 검증. vitest 에 automatic JSX 런타임 추가([vitest.config.ts](../apps/web/vitest.config.ts), 첫 .tsx 테스트). 전 스위트 99 passed.
- 검증: `tsc --noEmit`·eslint 0 오류 · admin RLS 시뮬레이션 27행 가시 확인 · dev 렌더 200.
- 한계: "지금 수집" 버튼 없음 — `collect_quality_metrics` EXECUTE 가 postgres/service_role 전용(admin wrapper RPC 는 별도 결재 대기).

### 게임 모듈 런타임 검증 — PairFlip 완주 + ScriptQuiz 결함 2건 수리 (v06.139)

Playwright 실주행으로 PairFlip·ScriptQuiz(#53/#54 잔여 "런타임 미검증") 종결.

- **PairFlip ✅ 전 경로 정상**: 허브 실 스탯(Best/게임 수) → Easy 4쌍 완주(시드한 실 SRS 단어로 카드 렌더) → `scores` 1행(730점·won·콤보4) + `learning_records` 4행 + `daily_activity` 트리거 집계(+4 리뷰)까지 확인. 수리 0건.
- **🔴 ScriptQuiz 카탈로그 전멸 수리**: 허브가 "도서 0·문항 0" — 원인은 `const rpc = client.rpc as ...` 로 메서드를 떼어내며 **this 바인딩 소실** → 호출 즉시 throw → page 의 무언 catch 가 빈 배열 폴백. `client.rpc.bind(client)` 로 수정(2곳) + catch 에 `console.warn` 관측성. 수리 후 카탈로그 5권·129챕터·1,019문항 정상.
- **🔴 ScriptQuiz 완료 결과 영속화 0 수리**: 완료 시 `pushPendingTextResult`(sessionStorage) 만 쌓고 **소비자가 전무** — DB 기록이 증발(#57 scores 적재에서 유일하게 빠졌던 게임). 완료 분기에 `recordGameScore` 직접 배선(score=정답×20, 정확도·소요초·챕터 메타). 재플레이 검증: `scores` 1행(Pinocchio Ch1 · 7문항 · 2정답 · 29%) 적재 확인.
- 부수 확인: 회전 정답 설계 실측 정합(전부 1번 선택 시 ch1 정답 정확히 2개) · 결과 화면 Calm UI("오늘 잘 마쳤어요") · console error 0.

### 네비게이션 감사 P2 + 경미 복귀 마무리 (v06.138)

v06.135(P0+P1) 후속 — 감사 P2 7건(커밋 `56cb8de`, 당시 CHANGELOG 동시편집으로 보류분) + 경미 2건 기록. 감사 전 항목 종결.

- **P2 폴리시 7건** — 메인 [Sidebar](../apps/web/src/components/layout/Sidebar.tsx) 하위 라우트 하이라이트(`/wordvault/study`·`/review`) · [WordVaultBrowse](../apps/web/src/components/wordvault/WordVaultBrowseClient.tsx) 챕터 이동 `?from` 유지 · [구독 토스트](../apps/web/src/components/library/vocab/SubscribeSuccessToast.tsx) `?from` 부착 · 모달 focus 복원 5곳(Netflix·VocabSet·ChapterQuiz·ChapterWordSet·ArticleWordSet) · [VocabSetPreviewModal](../apps/web/src/components/library/vocab/VocabSetPreviewModal.tsx) body scroll lock · Type/Voice 팝오버 Esc 닫기 · [DiagnosticClient](../apps/web/src/components/diagnostic/DiagnosticClient.tsx) 질문 중 "그만두기".
- **경미 복귀 2건** — [ScriptQuiz](../apps/web/src/components/game/scriptquiz/ScriptQuiz.tsx) 시작화면 back `/library` 하드코딩 → `?from` ?? `/scriptquiz` · [PairFlipResultScreen](../apps/web/src/components/pairflip/PairFlipResultScreen.tsx) 결과화면에 "PairFlip 홈으로" 복귀 링크 추가(결과=sessionStorage라 스코프 유실 → 허브).
- dead-code 정리: `ContextBar.tsx`(미사용, 부활 시 back 하드코딩 버그) **삭제** + WorkspaceBookContext stale 주석 정정.
- 검증: `tsc --noEmit` 통과(0 오류) · `next build` clean `.next` 재빌드 Compiled successfully(내 파일 에러 0).

### ACP 스크립트 소스→프로그램→컨텐츠 + VOA 30편 발행 (v06.137)

`/plan` 자료 고르기 스크립트(article) 탭을 **소스 → 프로그램(feed) → 컨텐츠** 3단 구조로. VOA 프로그램(Let's Learn English/Words and Their Stories/Science & Technology/As It Is)이 시드에만 있고 발행 아티클엔 없던 데이터 갭 해소.

- **마이그레이션** `20260705120000_acp_library_articles_feed_label` — `library_articles`에 `feed_id`·`feed_label` 컬럼 + `admin_enqueue_article` RPC 9→11-arg(feed 승계, 기존 호출 호환). database.ts 정밀 추가.
- **VOA 시드 30편 발행** — `scripts/acp/publish-voa-seeds.mjs`(신규): live ingest → INSERT(queued) → analyze(skipLlm) → compute_article_vrl → force-publish 게이트(저작권+오디오). feed 분포 정합: Let's Learn 13 · Words 9 · Sci&Tech 5 · As It Is 3. 전량 published + 단어세트 자동 생성.
- **enqueue 라우트** — 시드 feed_label 조회 후 RPC 승계(향후 UI import도 프로그램 유지).
- **picker UI** — `ArticleFeedGroups`(신규): 소스 레일 → 우측 프로그램 하위헤더 + 컨텐츠 행. feed 없는 소스는 flat. `MaterialOption.feedLabel` 추가. (공용단어장 도서 챕터와 동일 하위그룹 패턴)
- 검증: `tsc --noEmit` 통과 · VOA live fetch 정상 확인.

### 학습자 플로우 런타임 검증 + 전역 셸 목업 수치 실데이터화 (v06.136)

Playwright 실주행 검증(가입→자동확인→로그인→/hub→/dashboard→/reports 갱신→/plan)에서 발견한 결함 수리.

- **🔴 전역 목업 수치 4곳 제거 → 실데이터**: 신규 계정에 STREAK 23일·리본 12일·기억상태 847개·활동 25/28일이 표시되던 문제. 신설 `lib/learner/growth-stats.ts` (React `cache()` — layout·page 요청당 1회) 가 `user_stats.current_streak` + `vocabularies` R(t) 4상태(SSoT `getMemoryState`) + `daily_activity` 28일을 공급.
  - `(main)/layout.tsx` — `streak=23` TODO 하드코딩 제거, Sidebar·FlowNav 실데이터 주입
  - `FlowNav` — `MOMENTUM` 상수 → `momentum` prop (streak·mastery 4색·주간일수). 근거 없던 "정확도 84%" 표기는 삭제, streak 0 이면 "오늘부터 시작해요"
  - `MemoryStatus` — 기본값 612/142/58/35 → 0 + **빈 상태**(읽을거리 CTA)
  - `WeeklyHeatmap` — `generateMockData()`(sin 가짜 활동) 삭제, `days` prop(직렬화 DTO) + 빈 28일 폴백
- **Checkbox 하이드레이션 경고 수정**: `Math.random()` id → `useId()` (SSR/CSR 불일치 해소).
- 검증: 신규 계정 = 정직한 0 상태(빈 스파크라인·CTA), 시드 계정(3일 활동) = STREAK 3·3/28일·45분·67개 전 경로 반영, console error 0. `/reports` "이번 주 갱신" E2E(생성→렌더) 정상. `/onboarding` 은 결함 아님 — #75 재설계로 폐기, `/plan` 이 대체(메모리 정정).

### 네비게이션 "진입→닫기→제자리" 감사 P0+P1 수정 (v06.135)

플랫폼 전체 학습 세션·모달·어드민 탭의 닫기/뒤로 복귀 오류 8건 수정 (5개 영역 병렬 감사 기반). 감사 전체 결과 15건은 [SESSION_LOG.md](../docs/SESSION_LOG.md) 기록, P2 7건은 후속.

- **세션 복귀 통합** — [`lib/layout/session-return.ts`](../apps/web/src/lib/layout/session-return.ts) 신규(`resolveSessionReturnHref`: `?from` → 스코프 텍스트 → hub). Plan/홈 "바로 시작"이 세션 진입 시 `?from` 미부착 → 닫기가 `/plan`·`/`이 아닌 hub로 튕기던 문제 수정([`activityLaunchHref`](../apps/web/src/lib/learner/plan-activities.ts) origin 인자 — 풀스크린 play 라우트에만 `from` 부착).
- **깨진 반환 링크(404) 수정** — SpellForge play가 `textId` 리터럴(`vocab`/`script`/`all`)을 넘겨 종료 링크가 `/text/vocab` 등 404 나던 것 + Flashcard 완료 "Workspace 돌아가기"가 스코프 진입 시 `/text/<단어id>` 404 나던 것 → `backHref` prop(페이지가 `?from`/스코프로 계산)으로 교체. 워크스페이스 인라인 SpellForge 포함.
- **모달 스크롤락 무력화 수정** — [`GlobalBodyReset`](../apps/web/src/components/layout/GlobalBodyReset.tsx) pointerdown 안전망 셀렉터가 실제 모달(`aria-modal`)과 미매칭 → 모달 안 첫 클릭에 배경 스크롤락이 풀리던 문제. `[role="dialog"]:not([aria-hidden="true"])`로 확장(2곳).
- **WordBlitz 나가기** — 인게임 종료가 `/text`·`/library`로(id 유실) 가던 것 → `resolveSessionReturnHref` 사용. **Dictation** `router.back()` 직접 진입 시 앱 이탈 → `history.length` 가드 후 `/dictate` fallback(setup·session 2곳).
- **ACP 기사 콘솔 stage 유지** — [CurationConsole](../apps/web/src/app/admin/articles/CurationConsole.tsx) stage를 `?stage=` URL 동기화 + 프리뷰가 stage 전달 → 검수 후 복귀 시 '커버리지' 리셋 없이 제자리. **AdminSidebar** 이중 하이라이트(vocab↔vocabulary, vrl↔vrl-automation) → 경계+최장일치 1개만 활성.
- 검증: `tsc --noEmit` 통과(0 오류).

### /plan 자료 고르기 picker 일관화 + 공용단어장 챕터 표시 (v06.134)

`/plan` 자료 고르기([PlanClient.tsx](../apps/web/src/components/plan/PlanClient.tsx))의 4탭 분류 구조 통일 + 도서 챕터 단어장 발견성 개선.

- **도서 리스트 통일** — 도서만 커버 그리드였던 것을 다른 3탭(스크립트·공용단어장·내 스크립트)과 동일한 리스트 행으로. 작은 표지 썸네일 + 저자 + **V레벨 배지**. 4탭 모두 좌=분류 레일 / 우=그룹 리스트의 동일 master-detail. (`BookGridItem` 제거)
- **공용단어장 도서 챕터** — 흩어져 있던 책별 레일 ~15개를 **`도서 챕터` 카테고리 1개**로 통합. 우측에서 책 하위헤더(`챕터 N개`) + 각 챕터 `N장` 행으로 펼쳐(`WordSetBookGroups` 신규) 챕터 발견성 보장. (데이터: 발행 세트 260개 전부 book_id+chapter_idx 보유 확인)
- 분류 축: 도서=V레벨 밴드 · 스크립트(article)=소스 · 공용단어장=카테고리(도서 챕터 포함) · 내 스크립트=V레벨.
- 검증: `tsc --noEmit` 통과(0 오류).

### Pinocchio 챕터 퀴즈 드레인 완결 — 36챕터 252문항 (v06.133)

퀴즈 게이트(v06.129) 후속: published 6권 중 퀴즈 0이던 3권(Pinocchio·Decline·Twenty Years After) 가운데 서사 최소 규모 **Pinocchio 전량 드레인** (Claude Code 본문 정독 생성, content_chunks→`library_chapter_quiz`).

- **36챕터 × 7문항 = 252문항** (`quiz_target_per_chapter(V7)=7` 정합) · type=multiple · en/ko 병기 · `source_snippet` 원문 인용.
- **정답 위치 처음부터 균등 설계**: 챕터별 회전 패턴(`(chapter+q_order)%4`) → 분포 **62/63/64/63** (v06.128 편중 교훈 반영, 사후 셔플 불요).
- 무결성 검증: options=4 전량 · correct_index 범위 · ko/snippet 결손 0 · (chapter,q_order) 중복 0 · 스팟체크 5문항 정답 정합.
- `/scriptquiz` 카탈로그 published 4권(Pride 488 · Pinocchio 252 · Ammachi 5 · Drone 4 = 749문항). 잔여: Decline(71ch)·Twenty Years After(90ch) — 대형 2권 별도 세션.

### /plan 주간 보드 디자인 개선 — 빈 날 압축 (v06.132)

`/plan` 요일별 계획 보드([PlanClient.tsx](../apps/web/src/components/plan/PlanClient.tsx) `WeekBoard`)의 세로 빈 공간 정리 — 컴포저가 아래로 밀리던 문제 완화.

- **빈 날 행 압축** — 계획 없는 요일은 배경 없이 얇게 눌러 표시(`비어 있음`), 계획 있는 날만 카드(그림자)로 도드라지게. 요일 셀 52→46px 컴팩트화(`WeekDayCell` 신규 추출).
- **섹션 헤더 추가** — `주간 보드 · 이번 주 N일 계획`(오늘의 학습·컴포저와 리듬 통일).
- 오늘 강조는 ring(형태)+색+`오늘` 텍스트 3중 유지(색맹 대응). 하드코딩 `rgba(59,130,246,0.2)` → `var(--bd)` 토큰화.
- 검증: `tsc --noEmit` 통과(0 오류).

### Curated Books 프로세스 재설계 — 통합·정리 (v06.131)

`/admin/curation` "Curated Books"([MyLibraryTab.tsx](../apps/web/src/components/admin/curation/MyLibraryTab.tsx)) 의 중복·불필요·복잡 UI 를 동작 보존·DB 무변경으로 정리. 순 ~150줄 감소.

- **R1 처리 엔진 통합** — 구 `큐 자동 처리(drain)` + `Dev 일괄 처리` 두 상태머신·두 배너를 **단일 엔진(`runProcess`) + 단일 배너**로 통합. 둘 다 결국 도서별 `/api/lcp/dev-process` 순차 호출이라 동일 → 큐 전체(`queuedIds`)든 선택분(`devBatchIds`)이든 유한 id 목록을 같은 루프로 처리(무한 루프 불가). `dev-drain-queue` 라우트는 잔존하나 UI 미사용.
- **R2 소스 복귀 버튼 통합** — `처리중 → 소스 GET` + `검토대기 → 소스 GET`(동일 `admin_bulk_requeue_books`) → **`소스로 되돌리기 (삭제)` 1버튼**(선택된 처리중 ∪ 검토대기 전체).
- **R3 vestigial 제거** — `검토대기 → 처리중` 버튼 제거(재처리로 대체). RPC `admin_bulk_set_books_curating` 는 DB 잔존.
- **R4 스텝퍼 단순화** — `▶ 큐 처리` header 중복 버튼 제거(가이드 콜아웃 1곳만 유지). 작업 순서 스테퍼는 도서 status 선형(소스처리→처리중→검토대기→게시됨)만, 빈 단계 자동 접기 + 유령 `매핑 큐` 단계 제거(매핑은 `CurationJobsBanner`+행 배지가 담당).
- 검증: `tsc --noEmit` + `next lint` 통과.

### 인증 화면 소셜 버튼 제거 — provider 미설정 정리 (v06.130)

Supabase Auth 설정 실측(`/auth/v1/settings`): **OAuth provider 전원 비활성**(google 포함, email 만 true) — Google 버튼은 "provider is not enabled" 실패, Apple/Kakao/Naver 는 목업 토스트였음.

- `/login` · `/signup` 소셜 버튼 4종 + 구분선 + `handleSocial`/아이콘/`SocialButton` 제거 → 이메일 인증 단일화 (provider 설정 시 git 이력 복원).
- 고아 파일 `signup/signup.tsx` 삭제 (import 0, 전체 목업 구버전 잔재).
- `/api/auth/callback` 의 OAuth 처리·`oauth_failed` 에러 매핑은 유지 (재도입 대비, 무해).

### 큐레이션 미결 2건 결재·적용 — 퀴즈 게이트 + book i+1 추천 (v06.129)

v06.128 미결 ①② 사용자 승인 후 마이그레이션 2건 적용 (`quiz_catalog_published_gate` + `recommend_book_iplus1_tier`).

- **① `list_book_chapter_quiz_catalog()` 노출 게이트**: 도서 탐색과 동일 3중 게이트(`published + copyright_safe_in_kr + published_at`) 추가 — 카탈로그 11권 → **3권**(Pride 488 · Ammachi 5 · Drone 4 = 497문항). ready 8권 909문항은 데이터 보존, 도서 publish 시 자동 재노출.
- **② `recommend_word_sets_for_user` 6th tier `book_iplus1`**: `lexical_coverage` 가 사용자 V-Level 에서 **85~95%** (judgeIPlusOne 밴드)인 published 도서 상위 2권의 입문(최저 챕터) 세트를 priority 6 으로 추천. 시그니처·기존 5-tier 불변. 검증: V6 시뮬레이션 → Ammachi Ch.1(94%) + Pinocchio Ch.1(88%). 미진단(fallback) 분기엔 미노출(레벨 앵커 없음).
- **③ `classified_by` CHECK 확장** (`classified_by_allow_new_models`): 허용값에 `claude_code_opus_4_8` + `claude_code_fable_5` 추가 (기존 4값 유지, 이전 등재분 4_7 표기는 소급 변경 없이 기록 보존).

### 큐레이션 4축 심층 점검 — 품질 결함 수정 (v06.128)

도서·스크립트(퀴즈)·사용자 자동·단어 큐레이션 전수 점검(라이브 DB) + 확정 결함 즉시 수정. 마이그레이션 0 (데이터 정비).

- **🔴 퀴즈 정답 편중 수정**: 초기 드레인 5권(Huck·Sherlock·Just So·Ammachi·Drone)이 **정답 100% A**, Wonderful Oz 77% → 전체 0번 49.9%(701/1,406). "모르면 A" 전략이 통하던 상태. md5(id) 결정적 스왑으로 균등화 → **359/355/348/330 (±1%p)**. 스왑 무결성 스팟체크 통과. (options≠4 로 보인 14건은 truefalse 타입의 정상 2지선다 — 오탐.)
- **🔴 단어장 CEFR 라벨 drift 808건 동기화**: 사전 99-relabel·R5 정렬 이후 세트 스냅샷이 구 라벨 유지 → `shared_words.cefr_level` ← 사전 SSoT 전수 동기화(drift 0).
- **도서 4축 완충**: F-K 결손 10권 → `book-readability.mjs` 재실행으로 **21권 전량 충전**(Decline grade 20 = 학술서 실측 정합) · lexical_coverage 결손 1권 `compute_book_coverage` 충전(활성 도서 100%).
- **Les Mis 사전 등재 드레인 완결**: addable_modern 247 → 노이즈 blacklist 19(불어/OCR) + **사전 등재 226**(신규 171 + stub 채움, -ed 표면형은 base 동사/형용사로 정규화, 고어=archaic_literary·시대어=period_cultural 레지스터) → processed 마킹 + backfill → lemma **89.54%**. 잔여 NULL 상위 = 불어 기능어(de/la/des)·고유명(louis/faubourg)·고어(thee/yonder=archaic 사전 영역) — 학습 사전 비대상.
- **건강 확인**: 사용자 자동 큐레이션(auto-vlevel 9세트·KICE 5·specialty 4 발행, v3 세트 순도 100%, promote cron active·succeeded) · 단어장 무결성(word_count drift 0·빈 세트 0·뜻 누락 0·사전 링크 끊김 0) · 퀴즈 스냅샷 drift 0·중복 문항 0.
- **🟡 미결(결정 필요)**: ① 노출 게이트 불일치 — 도서 탐색 6권(published+ts) vs 퀴즈 카탈로그 11권(RPC 게이트 0, ready 포함) ② recommend 에 lexical_coverage 6th tier(book_iplus1) 추가 마이그레이션 ③ `classified_by` CHECK 에 opus_4_8 미등재(4_7로 기입).

### P6 소급 F3 전면 실행 + P6.4/6.5 재검증 (v06.127)

P6은 6/28에 1차 종결(P6.1~3 PR #46 · P6.4 점검 · P6.5 PR #50 · P6.6 PR #47 — 당시 F 결정은 "F3 하되 **V0 미진단 사용자 제외** → 삭제 0건"). 오늘 세션은 재검증 + **사용자 신규 결정으로 V0 제외 조항을 해제한 F3 전면 소급**. 마이그레이션 0.

- **P6.4 재검증 (결론 일치)**: 두 함수 dump 재비교 — 구독 = `BETWEEN v−1 AND v+1` 양방향 밴드(부담 관리, fallback user→book_v→5, cap50) vs 추출 = `>= user_v+1` 상향 threshold(미지어 발굴, text_p75 fallback). 6/28 판정("맥락별 메커니즘 차이, drift 없음")과 동일 결론 — 통합 불요 재확정.
- **P6.5 재검증 (정상)**: Cold(발행 세트 cap=40 live max 확인) / Warm(i+1+전면 dedup+cap50 dump 확인) / Hot(FSRS 별도) — `docs/VOCAB_LAYERS.md` 명문화와 정합.
- **P6.6 F3 전면 소급 (사용자 결정 2026-07-04)**: 측정 — vocabularies 6,477행(2 users) 중 **미학습 99.94%**·stable 0·i+1 위반 4,919(76%). 6/28 결정에서 제외됐던 V0 사용자 물량이 위반의 전부 → 오늘 결정으로 해제. 실행: book-origin 4,862행 DELETE(review_count=0 가드 — 보호 대상 0) → 5권 재-enroll(V0 는 P6.6 가드로 book_v_level fallback 밴드 적용) → **4권 × 정확히 50행·i+1 위반 0** + Ammachi 0행(V4 어휘가 밴드 밖 = 필터 정상). 총 vocabularies **6,477→1,815행** (비도서 구독분·학습 진도 보존).
- 상세: `docs/AI_CONTEXT/handoffs/p6_subscribe_user_filter.md` 완결 기록.

### 비밀번호 재설정 실동작 연결 — 목업 제거 (v06.126)

`/reset-password` 가 **Supabase 호출 없는 목업**(setTimeout 1.2s 후 성공 화면, 토스트에 "(목업)" 표기)이어서 재설정 메일이 영구 미발송이던 결함을 실구현으로 교체. 마이그레이션 0.

- **진단 경로**: auth 로그에 `/recover` 요청 부재 확인 → 페이지 소스에서 목업 확정. (부수 발견: `/authorize` 400 `provider is not enabled` — 소셜 로그인 버튼이 미설정 프로바이더 호출.)
- **request 모드**: `resetPasswordForEmail(email, { redirectTo: origin + '/api/auth/callback' })` — 429 rate-limit 안내 + enumeration 방지 문구(미가입 이메일은 미발송) 추가.
- **update 모드**: recovery 링크 → 콜백(`verifyOtp` type=recovery → `/reset-password`) 세션 감지 시 새 비밀번호 폼(8자+확인) → `auth.updateUser({ password })` → `/hub`. 세션 확인 중 스피너로 모드 플리커 차단.
- typecheck 0 · eslint 0. 기존 디자인(Parts Kit 토큰) 그대로 유지.
- 운영 주의: Supabase 기본 SMTP 는 시간당 발송 제한(~2통)·발신 평판 낮음 — 국내 웹메일(empal 등) 스팸 분류 가능. 운영 전 custom SMTP 설정 권장.

### /plan 학습 계획 — 챕터 리스트·주간 날짜·계획 아이콘 (v06.124)

`/plan` 구성 UX 3종 개선. 마이그레이션 0.

- **챕터 리스트화**: 번호 칩 → 체크 리스트(번호+**챕터 제목**, 스크롤). 제목은 신규 서버 액션 `fetchBookChapters`(plan-actions)가 `library_chapters_master`에서 지연 로드(모듈 캐시) — RLS `read_via_published` 범위(=picker와 동일)라 추가 정책 불요.
- **요일에 날짜**: 서버(KST)에서 이번 주 월~일 'M/D' 7개를 산출해 주입(하이드레이션 안전) — 주간 보드 헤더·요일 선택 칩(원형→날짜 병기 필)·오늘의 학습 헤더에 표시.
- **보드 칩에 계획 내용 아이콘**: 자료 글리프 아래 활동 아이콘(듣기/읽기 등, 최대 4개+`+n`)과 챕터 배지(`ListChecks`+`n장`/`전체`) — title·sr-only 텍스트 병기(색맹·스크린리더).
- **활동 아이콘 재정비(유일성)**: vocab/flashcard 중복 'Layers' 해소 — vocab→`WholeWord` · pairflip `Shuffle`→`Grid2x2` · spellforge `Pencil`→`Hammer` · scriptquiz `ScrollText`→`HelpCircle`. **활동 선택 칩도 선택 여부와 무관하게 같은 아이콘 상시 표시**(기존: 선택 시 체크로 교체돼 연상 단절) + 선택 체크 병기.
- **요일 선택 재설계(인식률)**: 원형/소형 필 → 전폭 7열 그리드 셀(min-h 56px, 요일 14px + 날짜 10px + 상태 슬롯) — 선택=채움+체크(형태 이중), 오늘=테두리+'오늘' 라벨.
- **아이콘 단일 출처화**: `lib/learner/activity-icons.ts` 신설 — PlanClient·**TodayPlanCard(hub)** 가 공유. hub 쪽 복제 맵이 구버전 아이콘 이름을 들고 있어 신규 아이콘이 Layers 폴백으로 뭉개지던 실버그 해소.
- **담은 자료 picker 유지**: 담아도 목록에서 사라지지 않고 '담김' 배지 표시, 클릭 시 그 항목 편집으로 진입(자료당 계획 1개 + 챕터/활동 수정 모델을 UI 로 드러냄).
- **picker master-detail 기본 패턴**: 모든 자료 유형에서 좌측 **분류 레일**(전체+분류·개수) / 우측 세부 리스트 — 도서·내 스크립트=V밴드, 스크립트=소스별(VOA/NASA/…), 공용단어장=카테고리+**책별 레일**(책 선택 시 챕터 순 단어장 목록, 'n장 단어' 표기·저장은 원제). 챕터 종속 단어장 262종 숨김 해제. 기존 V밴드/서브필터 칩 2줄은 레일로 대체.
- **요일 미정 안내**: 보드 하단 설명 문구 + 요일 블록 라벨("안 고르면 '요일 미정'에 담겨요"). **신규 담기 기본 요일=오늘**(해제 가능) — 담자마자 미정으로 떨어지던 흐름 해소, 담기 버튼에 '주 n일/요일 미정' 상태 명시.
- **주간 보드 아젠다형 재설계(디테일 가시성)**: 7열 세로 그리드(칸 ~90px, 아이콘 11px) → **요일=행** 리스트로 전환 — 각 계획이 전폭 카드(표지 36×28 · 제목 · 챕터 배지 · 활동 아이콘 13px 최대 6개)로 표시. 활동 선택도 2열 정렬 그리드 + 아이콘 타일(24px 박스)로 확대.
- **아이콘 타일 단일 컴포넌트화**: `ActivityGlyph`(sm/md·onDark 톤) — 주간 보드 행·활동 선택 칩·바로 시작·hub 오늘의 학습 계획이 전부 같은 타일 표현 공유(맨 아이콘 혼재 해소). 선택 시 구성 패널이 화면 밖이면 `scrollIntoView(nearest)` 로 데려오는 사용성 보강.
- **/plan·/dashboard 폭 정합**: 두 화면만 `content`(820px)였고 /plan 은 내부 `max-w-3xl`(768px)+px-4 이중 제약까지 겹침 → `wide`(1024px) 통일 + 내부 제약 제거 (Screen 주석의 'wide=Dashboard' 명세와 코드 불일치 해소).
- 검증: typecheck 0 · lint 신규 0 · vitest 96 pass · dev 렌더 /plan·/hub 에러 0, 오늘(토 7/4) 마커·주간 날짜 정합 확인.

### 빌드-타임 lint 게이트 복원 + a11y/lint 부채 청산 (v06.117)

v06.92 에서 lint 부채(74건)로 빌드에서 분리했던 ESLint 게이트를 복원. 마이그레이션 0.

- **부채 청산**: `no-unused-vars` ERROR(ChapterQuizAdminSection 미사용 `bookId`) 해소 + 지원 안 되는 `aria-*` 3건(SourceCard `article`/Radio `radio`/CEFRDistribution `listitem`) 제거·승격 → `next lint` **0 error / 6 warning**(exhaustive-deps 잔여).
- **게이트 복원**: `next.config.mjs` `eslint.ignoreDuringBuilds` `true`→`false`. 풀 `next build` EXIT 0 검증(warning 은 빌드 비차단). typecheck 계속 강제. `swcMinify:false`(piper-tts)는 별건이라 유지.
- **트리 정합 복구**: "챕터 퀴즈 검수" admin 기능(`ChapterQuizAdminSection`·`ChapterQuizPreviewModal`·`admin-quiz-queries.ts`·`preview/[bookId]/page.tsx`)이 untracked 로 방치돼 CI 에서 import 미해결이던 것을 완결 커밋.

### P0 보안 — public RLS 하드닝 + 유출 backup 제거 (v06.117)

security advisor **ERROR 8건 → 0**. 마이그레이션 2 (`20260703120000_p0_security_rls_hardening` · `20260703120010_p0_drop_p5a_backup_table`).

- **근본 원인**: `public` 스키마 8 테이블이 anon 에 SELECT+INSERT 권한이 있는데 RLS 가 꺼져 있어 익명 키로 직접 read/write 가능한 상태였음.
- **참조 taxonomy 4종**(`vocaflow_levels`/`tracks`/`domains`/`skills`) — RLS on + authenticated read 정책(앱 DiagnosticClient·admin 경로 유지).
- **내부 QA**(`vrl_data_integrity_concerns`) — RLS on + admin 전용 read(`user_profiles.role='admin'`).
- **백엔드 전용**(`noise_blacklist`·`english_irregular_forms`) — RLS on·정책 없음(락). SECURITY DEFINER RPC·service_role bypass 로 기능 무영향.
- **유출 backup DROP**: `shared_dictionary_p5a_backup_20260620` (16,492 row · 688 kB) — 추출 P1~P4 백업본 목적 종료. 테이블 59→58.
- read 정책만 추가(INSERT 정책 부재) → 익명 write 구멍 차단. anon SELECT 도 정책 부재로 무력화. typecheck green.

### Dictation 화면 디자인·기능 개선 (v06.116)

받아쓰기 4개 화면(Hub/Setup/Session/Results) 폴리시 정합 개선. 마이그레이션 0 · typecheck green.

- **Calm UI**: Hub 직접입력 검증을 `alert()`(차단형 모달) → 인라인 empathetic 메시지("조금만 더 있으면 돼요 — 지금 N자")로 교체. 입력 시 자동 소거 + `aria-invalid`/`role=status`.
- **트로피 지양(§학습UX)**: Results hero 상시 `Trophy` 아이콘 → 점수대별 차분한 아이콘(`Check`/`Sprout`/`Leaf`) + Lora italic 격려 한 줄("오늘 들은 만큼 분명히 남았어요"). "Session Complete"→"오늘 받아쓰기 완료".
- **색맹 대응(§접근성)**: Session 피드백 단어칩에 **범례**(정답/철자/오답/누락/불필요) 추가 — 색상 단독 전달 방지. `WORD_STATUS_STYLES`/`LABELS` 모듈 스코프로 승격.
- **focus 상태(§항상지킬것)**: Session·Setup·Hub 주요 인터랙티브 요소에 프로젝트 공통 `focus-visible:ring` 추가(`FOCUS_RING` 상수) + 속도/힌트 버튼 `aria-pressed`/`aria-label`.
- **키보드 정합**: 숫자키 1-5 속도 매핑을 화면 버튼과 동일 5단계(0.5·0.75·0.85·1.0·1.25x)로 정정 · 파일 상단 단축키 주석을 실제 핸들러(L/H 미구현·Esc=정지)와 일치하도록 수정.
- **정직한 카운트**: Results 오답 단어 20개 초과 시 "+N개 더" 표기.

### ScriptQuiz 큐레이션 챕터 퀴즈 — 도서 V-Level별 스토리 퀴즈 생성 파이프라인 (v06.115)

LCP 큐레이션 드레인 시 도서 챕터별 **스토리 기반 질의/선지 퀴즈**를 생성해 `/scriptquiz` 에서 학습. 마이그레이션 1 (`20260702120000_scriptquiz_curated_chapter_quiz`).

- **신규 테이블 2**: `library_chapter_quiz` (공유 큐레이션 챕터 퀴즈 · 키 `library_book_id`+`chapter_idx`+`q_order` · RLS admin-only) · `book_quiz_jobs` (퀴즈 생성 작업 큐 · 진행률 chapters_done/questions_created · RLS admin-only). 기존 `quiz_questions`(per user+text)와 분리 — 큐레이션 퀴즈는 전 학습자 공유.
- **신규 함수 5**: `quiz_target_per_chapter(smallint)` (V-Level→챕터당 문항 수 SSoT 곡선 **3~10**: V0-1→3·V2-3→4·V4-5→5·V6→6·V7→7·V8→8·V9→9·V10-11→10) · `select_book_chapter_quiz(uuid,int)` (학습자 read RPC, SECURITY DEFINER) · `list_book_chapter_quiz_catalog()` (허브 discovery) · `book_quiz_coverage(uuid)` (커버리지 집계) · `enqueue_quiz_jobs(uuid[])` (큐 적재 · ready/published+챕터 존재만).
- **Frontend**: `/scriptquiz` 허브 목업→실 카탈로그 서버 fetch + `ScriptQuizHub`(client 선택 UI) · `/scriptquiz/play?book=&ch=` 공유 챕터 퀴즈 read(`fetchChapterQuizSession`) · 기존 `?text=`(개인 quiz_questions)·MOCK 폴백 보존.
- **Admin**: `/admin/curation` MyLibraryTab 일괄 액션에 **"스크립트 퀴즈 큐"** 버튼 + `QuizJobsBanner`(진행률 폴링) + `enqueueQuizJobsAction`/`fetchQuizJobsAction`.
- **검수 노출**: `/admin/curation/preview/[bookId]` 도서 검수 페이지에 **"챕터 퀴즈 검수" 섹션** 신규(`ChapterQuizAdminSection`) — 챕터별 문항수 표 + 커버리지/저문항(<3) 경고 + 생성 잡 배지(done/running/failed·chapters_done/total). 행 클릭 → `ChapterQuizPreviewModal`(문항 EN+KO·4지선다 **정답 초록 하이라이트**·본문 근거 snippet Lora italic — 검수용 정답 노출, 학습자 플레이는 숨김). 서버 `fetchBookChapterQuizzes`(authed admin, `library_chapter_quiz`+`book_quiz_jobs` 직접 read, 발행 상태 무관 = 미발행 검수 가능).
- **드레인 헬퍼**: `scripts/lcp/generate-chapter-quiz.mjs` (`plan`/`content`/`insert`/`refresh-job` — 챕터 나열·본문 dump·문항 검증+전량교체·진행률 갱신). 문항 저술=Claude Code(앱 런타임 LLM 0).
- **첫 도서 완성**: Alice's Adventures in Wonderland(V6) **전권 12챕터 × 6 = 72문항** 드레인 생성(`generate-chapter-quiz.mjs insert`) — 챕터별 스토리 MCQ(5 multiple + 1 truefalse), EN+KO, 본문 근거 snippet, correct_index 분산, 무결성 0, book_quiz_jobs=done(12/12).
- **둘째 도서 완성**: The Wonderful Wizard of Oz(V6) **전권 24챕터 = 141문항** 드레인 생성(MCP 직접 INSERT) — 각 챕터 스토리 comprehension MCQ 6문항(Ch.24 "Home Again"=77단어 초단편이라 3문항), EN+KO 4지선다, 본문 근거 snippet, 무결성 0(bad option/correct_index/null/q_order-gap 각 0), book_quiz_jobs=done(24/24). `/scriptquiz` 카탈로그 2권(Alice+Oz) 노출.
- **소형 2권 완성**: Ammachi's Amazing Machines(V4·1ch·5문항 — 코코넛 바르피/6가지 단순기계) + Tell Me, What is a Drone?(V3·1ch·4문항) 드레인 — 단일 챕터 논픽션 그림책.
- **넷째 도서 완성**: The Adventures of Sherlock Holmes(V8) **전권 12편 × 8 = 96문항** 드레인(MCP 직접 INSERT) — 각 단편 스토리 comprehension MCQ 8문항(Scandal in Bohemia~Copper Beeches), EN+KO 4지선다, 본문 정밀 근거 snippet(regexp 추출), 무결성 0(bad option/correct_index/null/q_order-gap 각 0), 전 챕터 정확히 8문항, book_quiz_jobs=done(12/12).
- **다섯째 도서 완성**: Just So Stories(V7) **전권 12편 × 7 = 84문항** 드레인(MCP 직접 INSERT) — 키플링 유래담(Whale~Butterfly) 스토리 comprehension MCQ 7문항, EN+KO 4지선다, 본문 근거 snippet, 무결성 0, 전 챕터 정확히 7문항, book_quiz_jobs=done(12/12).
- `/scriptquiz` 카탈로그 **6권 총 402문항**(Alice 72 + Oz 141 + Sherlock 96 + Just So 84 + Ammachi 5 + Drone 4). V3~V8 난이도 커버.
- 나머지 도서(Pride 61·Twenty 90·Les Mis 364 등 대형서) = 큐 대기.

### Growth(/dashboard) known-word 성장 hero (v06.114)

"Growth" 표면인데 성장 지표(known-word)가 헤더 작은 글씨뿐이던 것을 **성장 hero**로 부각. 마이그레이션 0.

- 헤더에 known-word **큰 숫자(40px)** + "N일 연속" 컨텍스트 + Lora italic Implicit 코멘트("어휘가 자라고 있어요"). 게이지·정답률·압박 없음(§철학1 Calm·§철학4 Implicit).
- 기존 작은 known-word 텍스트 라인 대체. dashboard 헤더만 변경(다른 섹션 유지). typecheck/build green.

### 계획 launch — Dictation 자료 스코핑 (게임 6/6 완결) (v06.113)

마지막 미스코핑 게임 **Dictation** 스코핑 → **6/6 완결**. 마이그레이션 0.

- **`lib/dictation/scoped-resource.ts`** 신규 — `texts.content`(스크립트 본문) → 임시 `DictationResource`(id `text-{id}` · script=content · cefr=texts.cefr_level · translation).
- **`DictationSetupClient`** — `?text=`(texts.id) 있으면 그 스크립트를 fetch→임시 리소스 saveResource→setup 진행. content 없으면 `/dictate` graceful redirect.
- 받아쓰기=문장 전사라 **스크립트(본문)만** 스코핑 — 단어장 미해당, 도서는 inline 본문 없어 hub. (`activityLaunchHref`/`isActivityScoped` dictation=script)
- 데이터패스: 강민 텍스트 content 有 4개 → 정상 리소스(B1 6781자 등), 무 → redirect. typecheck/build green.
- **게임 스코핑 6/6**: flashcard·scriptquiz·spellforge·wordblitz·pairflip·dictation (각 자료유형 정합).

### 계획 launch — PairFlip 자료 스코핑 (게임 5/6) (v06.112)

계획 활동 launch 의 게임 스코핑을 **PairFlip** 까지 확대 → 5/6. 마이그레이션 0.

- **`lib/pairflip/scoped-pairs.ts`** 신규(fetchScopedWords → PairFlipMockWord, meaning 빈 단어 제외).
- **`/pairflip/play`** — `?set/?text`(window.location.search, Suspense 회피) 있으면 **default Normal config + scoped-pairs** 로 사전 config 없이 바로 시작. 없으면 기존 sessionStorage config + due.
- `plan-activities.ts` activityLaunchHref/isActivityScoped(pairflip → 스크립트 `?text=`·단어장 `?set=`).
- **스코핑 5/6**: flashcard·scriptquiz·spellforge·wordblitz·pairflip. **미지원**: dictation.
- **dictation defer 사유**: session 기반 아키텍처(`/dictate/session?sessionId` → DictationSessionClient, setup 가 세션 생성) — 스코핑에 setup/세션생성 개조 필요(별건). typecheck/build green.

### 계획 launch — 게임 자료 스코핑 확대 (SpellForge·WordBlitz) (v06.111)

계획의 활동 launch 를 그 자료 단어로 여는 게임을 **flashcard·scriptquiz → + spellforge·wordblitz** 로 확대. 마이그레이션 0.

- **SpellForge**: `lib/spellforge/scoped-words.ts` 신규(fetchScopedWords 어댑터) + `/spellforge/play?set=/?text=` 분기(flashcard/play 미러). 없으면 기존 due 단어.
- **WordBlitz**: `/play/wordblitz` 가 **이미 `?set/?text` 스코핑 지원**(fetchScopedWords) — launch 라우트만 hub→scoped 로 교정.
- `plan-activities.ts` activityLaunchHref(spellforge·wordblitz → 스크립트 `?text=`·단어장 `?set=`) + isActivityScoped 갱신.
- **스코핑 게임 4/6**: flashcard·scriptquiz·spellforge·wordblitz. **미지원(모듈 hub)**: pairflip(sessionStorage config)·dictation(multi-step setup) — flow 기반 진입이라 별도 작업.
- 데이터패스 검증: fetchScopedWords → word_set 15 실단어(E2E 검증분 재사용). typecheck/build green.

### Today(/hub)에 "오늘의 학습 계획" — 계획→매일 실행 loop 완성 (v06.110)

`/plan` 의 요일별 계획(study_plan_items.weekdays)을 **Today 홈 진입면**에 노출 — 계획이 매일 첫 화면에서 바로 시작. 마이그레이션 0.

- **`components/home/TodayPlanCard.tsx`** 신규(서버 컴포넌트) — 오늘 요일 항목 + 자료별 활동 **바로 시작(launch) 칩**(scoped ▶ / hub ↗). 오늘 항목 없으면 렌더 X(Calm).
- **`/hub` async 화** — fetchStudyPlanItems + KST 오늘 요일. 배치: HubHero → **TodayPlanCard** → TodayFocus → Continue → Modules → Recommended.
- /plan TodayStrip 과 동일 의미, Today(forward) 진입면 노출. (/hub ○static → ƒdynamic)
- typecheck/lint/build green.

### 메뉴 라벨 영어 통일 — 한자어(회고·진단) 제거 (v06.109)

올드한 한자어 문어체(회고=회고록·추도 / 진단=의료 뉘앙스) 제거 + 영어 학습 플랫폼 톤·Reading Room Dual Coding(serif 정체성)으로. 사용자 결정 **B(모듈도 영어 통일)** + /diagnostic 페이지 내부 copy 는 유지. 라우트 URL 불변(라벨만). 마이그레이션 0.

- **메타**: 오늘→**Today**(/hub) · 회고→**Growth**(/dashboard).
- **Growth 관리 카드**: 진단→**Level** · 학습 계획→**Plan** · 주간 리포트→**Report** (CTA "재진단·진단 받기"→"다시 측정·수준 측정", "학습 회고"→"성장 기록").
- **사이드바 그룹/항목**: 스크립트→Scripts · 단어→Words · 익히기→Practice · 정복→Conquer · 완성→Complete · 라이브러리→Library · 내 스크립트→My Scripts · 클래스→Class (WordVault/Flashcard 등 기존 영어 유지).
- **FlowNav STAGES 라벨**도 동일 영어화(subtitle·tip 은 Korean copy 유지).
- typecheck green · `next build` green · 실렌더(전 영어 라벨, 회고/진단 메뉴 소멸) 확인.
- (유지) /diagnostic 페이지 내부 "진단" copy = 시험·평가 맥락 자연스러움 (사용자 결정).

### 메타 표면 4→2 통합 — 오늘(/hub) · 회고(/dashboard) (v06.108)

4개 메타 표면(/hub·/dashboard·/diagnostic·/manage)의 중복(RecentActivity 양쪽·L7 이중할당·/manage 라우터+오링크)을 **2개(오늘·회고)**로 통합. 마이그레이션 0(라우트/컴포넌트만).

- **/dashboard = 회고(L7 단독)**: TodayHero(인사+forward CTA) 삭제 → known-word 성장 editorial 헤더. 순서: 헤더 → MemoryStatus → WeeklyHeatmap → **학습 관리 3카드(ManageSection)** → RecentActivity. `fetchManageOverview` 재사용(+userName).
- **/manage 삭제** → `ManageSection`(진단·계획·리포트, 미진단 시 진단 카드 ring 강조)으로 흡수.
- **/hub = 오늘(forward)**: RecentActivity 제거(회고로 이전).
- **Sidebar META 4→2**: `오늘`(/hub)·`회고`(/dashboard). 진단/계획/리포트는 회고 섹션 카드로 강등(메타 peer 아님).
- 삭제: `(main)/manage/page.tsx` · `components/dashboard/TodayHero.tsx` · `lib/learner/dashboard-data.ts`(소비처 dashboard 단독). 신규: `components/dashboard/ManageSection.tsx`.
- docs: LEARNING_MODEL(L7=/dashboard 단독) · ROUTES(/manage 삭제·/hub·/dashboard) 갱신. typecheck green · `next build` 88/88(/manage 제거).

### 학습 계획 "오늘의 학습" — 계획 → 매일 실행 연결 (v06.107)

`/plan` 에 오늘 요일 학습을 노출 — 계획이 매일 actionable. 마이그레이션 0.

- **오늘의 학습 strip**: 오늘 요일(KST) 항목을 자료 + 활동 **바로 시작(launch) 칩**으로 노출. 없으면 "오늘 요일을 더해 보세요" 안내.
- **주간 보드 오늘 강조**: 오늘 칼럼 ring + "오늘" 라벨.
- 오늘 요일은 **서버(page.tsx) KST 산출** 주입(하이드레이션 불일치 방지, 1=월..7=일).
- `PlanClient.tsx` TodayStrip/TodayRow + WeekBoard today prop. `/plan` page todayWeekday.
- typecheck green · `next build` 89/89 (/plan 12kB) · 실렌더(오늘 강조) 확인.

### 학습 계획 UX 재구성 — 컴포저 + 주간 보드 (v06.106)

`/plan` 을 나열식(세로 카드 리스트) → **컴포저 + 주간 보드**로 (사용자 피드백: 나열식 X, 소스+챕터/단어/활동+요일 한눈에 클릭클릭). 마이그레이션 0 — 데이터 모델 동일, UI 전면 재구성.

- **주간 보드**: 담은 자료를 요일(월~일) 칼럼에 배치 — 날짜가 한눈에. 칩 클릭 → 우측 구성에서 편집. 요일 미정 항목은 하단 행.
- **컴포저(2-pane)**: 좌=자료 고르기(탭·V밴드·표지 그리드/목록) / 우=선택 자료의 **챕터·활동·요일 칩이 한 화면**. 신규=‘계획에 담기’, 담은 항목=토글 즉시 저장 + ‘바로 시작’ launch + 빼기.
- 좌측 자료 클릭 → 우측 즉시 구성, 보드 칩 클릭 → 우측 편집 (클릭클릭). PlanItemCard/WeeklyOverview/ScheduleStrip 류 세로 나열 제거.
- `PlanClient.tsx` 전면 재작성(WeekBoard·DraftConfig·ItemConfig·BoardChip). `plan-actions`/`plan-activities`/마이그레이션 변경 없음.
- typecheck green · `next build` 89/89 (/plan 11.5kB) · 실렌더(보드·컴포저·구성) 확인.

### 학습 계획 요일 결합 — 시간 제거, 자료에 요일 부착 (v06.105)

학습 요일을 **자료 선택과 결합**(따로 선택 = 이질감/계획성 약함, 사용자 피드백) + **시간(하루 분) 제거**.

- **마이그레이션** `20260628220000` — study_plan_items `weekdays int[]`(1=월..7=일, 빈=미정) 추가 + 전역 `study_plan_schedule` DROP.
- **요일 결합**: 자료 추가 흐름(챕터·활동·**요일**) + 카드(요일 요약 + 편집 시 요일 칩) — 분리된 일정 스트립 폐기.
- **주간 overview**: 담은 자료의 요일을 집계해 월~일 학습일/자료 수 표시(읽기 전용 · "계획성").
- **시간 제거**: 하루 목표(분)·daily_minutes 폐기.
- `plan-activities.ts` weekdayLabel(+ DAILY_MINUTES/PlanSchedule 제거) · `plan-actions.ts` PlanItem.weekdays + savePlanItem weekdays(+ fetch/saveSchedule 제거) · `PlanClient.tsx` WeeklyOverview/WeekdayChips + 카드/추가 결합.
- typecheck green · `next build` 89/89 (/plan 11.7kB) · 실렌더(시간 제거·페이지 정상) 확인.

### 학습 계획 picker — V-Level 밴드 × 카테고리 체계화 (v06.104)

`/plan` 자료 추가를 나열식 → **V-Level 밴드 섹션 + 카테고리/소스 필터**의 체계적 선택 구조로 (사용자 피드백: "나열식 안 됨, 체계적 선택구조"). 마이그레이션 0.

- **V밴드 그룹**: 모든 탭을 `genres.ts` V_BANDS(입문 V1-2 / 초급 V3-4 / 중급 V5-6 / 중상급 V7-8 / 고급 V9-11) 섹션으로 그룹 + "전체 레벨" 필터. (도서 book_v_level · 스크립트 article_v_level · 내 글 text_v_level · 단어장 slug(auto-vlevel)→cefr 폴백)
- **서브필터**: 스크립트=소스(VOA·NASA…) · 공용단어장=주제(수능/공인시험/초·중·고/주제별).
- **단어장 정리**: 챕터 종속 세트(category=library_book/library_article 262개) picker 제외 — 부모 자료로 학습.
- `plan-activities.ts` cefrToVLevel + wordsetCategoryLabel. `plan-actions.ts` 단어장 V 도출(slug→cefr)·챕터세트 제외·texts text_v_level·MaterialOption.category. `PlanClient.tsx` 밴드 그룹 렌더 + FilterChip.
- typecheck green · `next build` 89/89 (/plan 11.6kB) · 실렌더 확인.

### `/library/scripts` 소스 맵 — 개인화 오리엔테이션 (v06.103)

ACP 6 소스를 5 학습 트랙으로 묶어 글 선택 전 "내 수준으로 재계산되는 맵" 추가 (ArticlesExplorer 위, 마이그레이션 0).

- **`lib/articles/source-map.ts`** 데이터층 — 5 트랙(listen/easy/topic/news/argue) + 카피는 `SOURCE_SPECS`(topicDomain·styleGuide) 근거. 트랙 V밴드 = `cefrToVLevel(targetCefr)` 실 SSoT, 난이도 판정·정렬·편수 전부 입력→계산(하드코딩 0). `judgeTrackFit`(fit/easy/hard) · `effectiveUserV`(V5 fallback, judgeArticleIPlusOne 정합) · `computeTrackCounts`(prop articles 집계, 추가 쿼리 0).
- **`source-map/DifficultyMap.tsx`** V레벨 native 난이도 맵 — 세그먼트 `vToPct(vMin~vMax)` · 내 위치선 = `vToPct(effectiveUserV)` · 색은 `color-mix` over `--learn-*`(카드 배지색 정합, 신규 토큰 0). Calm UI(도전=amber·red 미사용).
- **`source-map/TrackCard.tsx`** 접힘(이름·한줄·난이도·효과칩)/펼침(왜·방법·편수·CTA) · 첫 fit 카드만 자동 펼침(Progressive Disclosure) · 색+텍스트 배지(색만 금지).
- **`source-map/SourceMap.tsx` + `SourceMapShell.tsx`** 맵 트랙 탭 → 카드 scroll+강조 · CTA → `ArticlesExplorer` 그 트랙 소스로 필터(맵↔목록 연동) · 단일 articles prop 공유.
- **`ArticlesExplorer.tsx`** `sourceFilter` 선택 prop + 활성 칩(backward compatible).
- typecheck green · 시각 검증(맵/탭/필터/0 PAGEERR) · 현 데이터 2편(voa·simple_wikipedia)·3 트랙 "준비 중".

### 학습 계획 리치 구성 — 일정 + 자료 4종 + 도서 챕터 + 비주얼 (v06.102)

`/plan` 을 텍스트 위주 → 비주얼·선택 중심으로 재구성 (사용자 피드백: 일정/무엇을/어떻게 요소 + 학습 의욕).

- **마이그레이션** `20260628210000` — study_plan_items `material_type` += `'article'` + `chapters int[]`(도서 선택 챕터) + 신규 `study_plan_schedule`(weekly_days 1=월..7=일 + daily_minutes, 전역 1개/사용자, 본인 RLS).
- **일정(주당 리듬)**: ScheduleStrip — 학습 요일(월~일 원형 토글) + 하루 목표(분) 즉시 저장.
- **자료 4종**: 도서(library_books·표지) / 스크립트(library_articles·소스 배지) / 공용단어장(shared_word_sets·이모지) / 내 스크립트(texts). 4탭 picker + 스크립트 소스 필터(VOA·NASA·…).
- **도서 챕터 다중 선택**: chapter_count 기반 챕터 칩(안 고르면 전체), 카드/편집에서 토글.
- **비주얼**: 도서 표지(img+onError 폴백) 그리드 + 카드 썸네일, 단어장 이모지, 소스 배지.
- **`plan-activities.ts`** article 활동(echo 제외 9종)·MATERIAL_LABEL·materialHref(/library/scripts)·WEEKDAYS·ARTICLE_SOURCE_LABEL. **`plan-actions.ts`** 4종 fetch + chapters + fetchSchedule/saveSchedule. **`PlanClient.tsx`** 전면 재구성.
- typecheck green · `next build` 89/89 (/plan 10.1kB) · 실렌더 확인.

### 학습 계획 활동 실행(launch) 연결 (v06.101)

`/plan` 담은 자료 카드를 "구성"에서 "실행"까지 확장 (사용자 "계획·실행" 요청 정합, 마이그레이션 0).

- **`plan-activities.ts`** `activityLaunchHref` + `isActivityScoped` — 선택 활동을 그 자료 실제 단어로 진입: 스크립트 `flashcard/play?text=`·`scriptquiz/play?text=` / 단어장 `flashcard/play?set=` (scoped-words `fetchScopedWords` 정합) / listen·read·echo·vocab→본문. 미스코핑 게임(wordblitz/pairflip/spellforge/dictation·도서 게임)은 모듈 hub.
- **`PlanClient.tsx`** PlanItemCard 개편 — 기본=선택 활동 실행 링크(LaunchChip, scoped ▶ / hub ↗ 아이콘 구분=색맹 대응) · 편집(연필)=활동 토글(즉시 저장) Progressive Disclosure. `PlanItem.slug` 추가.
- typecheck green · `next build` 89/89 (/plan 7.89kB).

### 학습 계획 재설계 — 자료×활동 (수능 D-day 폐기) (v06.100)

학습 계획을 "수능 D-day 단어 카운트다운"(P1 초안)에서 **플랫폼 자료(도서/스크립트/공용단어장)별 활동 선택**(리틀팍스 코스형)으로 전면 재설계. 사용자 피드백 — "계획이 왜 수능으로 나오나, 플랫폼 학습 계획이어야 한다".

- **마이그레이션** `20260628200000_p1_redesign_study_plan_items` — 수능 `learning_goals`(goal_type='csat', 0 rows) DROP + `study_plan_items`(material_type/material_id/modules text[]) 신설 · UNIQUE(user_id,material_type,material_id) · 본인 RLS 4정책 · updated_at 트리거.
- **활동 10종**(listen/read/echo/vocab/flashcard/wordblitz/pairflip/spellforge/scriptquiz/dictation) + 자료유형별 가용: 도서/스크립트=10종 전부 · 공용단어장=어휘 5종.
- **신규** `lib/learner/plan-activities.ts`(활동 정의·매트릭스·라우트 빌더) · `plan-actions.ts`(fetchStudyPlanItems/fetchAvailableMaterials/savePlanItem/removePlanItem) · `/plan`(서버) + `components/plan/PlanClient.tsx`(자료 탭 → 활동 체크 → 담은 자료 카드, 활동 토글 즉시 저장, Calm UI).
- **수정** `manage-overview.ts`(plan = 자료N·활동N·상위자료) · `/manage` 학습 계획 카드(CTA→/plan).
- **삭제** `goal-actions.ts`·`study-plan.ts`·`/onboarding`·`OnboardingClient.tsx`.
- typecheck green · `next build` 89/89 · `/plan` 7.25kB. (docs: LEARNER_MANAGEMENT §2-2·§4·라우트표 · ROUTES · DB_SCHEMA 갱신)

### ACP 큐레이션 LCP My Library화 + RPC SSoT 정합 (v06.99)

ACP `/admin/articles` 의 큐레이션 목록을 LCP My Library 방식으로 정렬(멀티셀렉트 + bulk actions: Dev 일괄 / → 소스 GET + DrainBanner). seed-unlock 버그 수정 — 글 삭제 시 `imported_to_articles=true` 잔존 → 재-GET 불가였던 것 → flags 완전 리셋. (PR #72: 라우트 `/api/acp/dev-drain-queue`·`/api/admin/articles/bulk-requeue` + delete 라우트 패치, 마이그레이션 0 — service_role TS 로직.)

- **마이그레이션 (RPC SSoT 정합)** — 라우트 TS 가 실제 동작이지만 직접 RPC 호출 경로 일관성용:
  - `20260628111709_acp_delete_article_seed_unlock` — `admin_delete_article` 가 seed flags 완전 unlock (FK SET NULL 만으로는 `imported_to_articles=true` 잔존).
  - `20260628111753_acp_bulk_requeue_articles` — `admin_bulk_requeue_articles(uuid[])` 신규 (LCP `admin_bulk_requeue_books` 미러: DELETE + draft 단어장 삭제 + seed unlock + 발행/사용자 가드).

### 내 학습 관리 화면 /manage (계획·실행·진단·리포트 통합) (v06.98)

리틀팍스 MY 학습 참고 — P0~P3 데이터를 한 화면에 모은 학습자 관리 overview. 마이그레이션 0(기존 테이블 read).

- **`lib/learner/manage-overview.ts`** `fetchManageOverview` — V-Level(current_v_level, V0=미진단) · known-word · streak · 오늘 단어 · Study Plan(fetchStudyPlan) · 최근 주간 리포트 1건 통합 조회.
- **`/manage`** 신규(서버 렌더) — 4 관리 카드(진단/학습 계획/학습 현황/주간 리포트) + 각 상세 CTA(/diagnostic·/onboarding·/hub·/reports). Calm UI.
- **Sidebar 통합** — META 의 별도 `학습 계획`·`리포트`(직전 추가)를 단일 **`내 학습`(/manage)** 으로 합침(Cognitive Load 절감). /onboarding·/reports 라우트는 /manage 카드 CTA 로 접근. typecheck/lint green.

### Sidebar 학습자 관리 라우트 연결 (/onboarding·/reports·/teacher) (v06.98)

P1~P4.2 신규 라우트가 Sidebar 미등재라 URL로만 접근 가능하던 것 → `sidebar-config.ts`(단일 출처)에 연결. 마이그레이션 0.

- **META_ITEMS** += `학습 계획`(/onboarding, Target) · `리포트`(/reports, CalendarRange) — Hub/Dashboard/진단과 같은 메타 학습 tier.
- **FOOTER_ITEMS** += `클래스`(/teacher, GraduationCap) — L3 B2B 유틸(Settings 옆).
- Sidebar.tsx 가 두 배열 map → 즉시 노출. 누적 구축한 학습자 관리 화면이 발견 가능해짐. typecheck/lint green.

### P4.2 교사 허브 — /teacher (클래스 개설·초대코드·참여) (v06.98)

LEARNER_MANAGEMENT.md P4 화면 1단계 — 클래스카드형 교사 허브. P4.1 데이터 모델 소비. 마이그레이션 `20260628190000_p4_2_join_class_by_code`(초대코드 join SECURITY DEFINER 함수, 사용자 승인).

- **`lib/teacher/class-actions.ts`** server actions — `createClass`(초대코드 자동생성·UNIQUE 충돌 재시도) · `joinClassByCode`(RPC `join_class_by_code` — 비멤버 RLS 우회 lookup+가입) · `fetchTeacherClasses`(멤버수 nested count) · `fetchMyMemberships`.
- **`/teacher`** 신규 — 클래스 개설/목록(초대코드 복사·학생수) + 초대코드 참여 + 참여 중 클래스. Calm UI.
- **마이그레이션** `join_class_by_code(text)` SECURITY DEFINER — 비멤버는 classes SELECT 불가 → 함수가 코드 lookup + class_members 가입(중복 무시). typecheck/lint green.
- 잔여(P4.3): 과제배포(assignments UI) · 리포트 공유. 화면 런타임 미검증.

### P4.1 L3 B2B 데이터 모델 선반영 (classes/class_members/assignments) (v06.98)

LEARNER_MANAGEMENT.md P4 — 클래스카드형 교사/학원 위탁관리의 **데이터 모델 선반영**(사용자 결정 "L3 명시 — 선반영"). **화면(`/teacher/*`)은 Phase 2** — 본 변경은 테이블/RLS 만. 마이그레이션 `20260628180000_p4_l3_class_data_model`(추가·비파괴, 사용자 승인).

- **`classes`**(teacher_id · invite_code UNIQUE) · **`class_members`**(class_id+user_id PK · role) · **`assignments`**(class_id · kind text/word_set · ref_id · due_at).
- **recursion-safe RLS** — classes↔class_members 상호 참조를 `is_class_teacher`/`is_class_member`(SECURITY DEFINER) 헬퍼로 분리(무한재귀 회피). 정책 8: classes(교사 전권+멤버 읽기) / class_members(본인·교사 읽기·본인 가입·교사/본인 삭제) / assignments(교사 전권+멤버 읽기).
- `user_profiles.role`(기존)에 `teacher` 값으로 진입. 검증: 테이블 3·헬퍼 2·정책 8·RLS 3. 화면·서버액션은 P4.2(Phase 2).

### P3 대시보드 실데이터화 — TodayHero + known-word (v06.98)

LEARNER_MANAGEMENT.md P3 — `/dashboard` TodayHero 가 `todayWords=23·goal=30·userName="학습자"` 하드코딩이던 것 → 실데이터. 마이그레이션 0(P0 산출물 소비).

- **`lib/learner/dashboard-data.ts`** `fetchDashboardHero` — 오늘 단어(daily_activity KST today) · 일 목표(user_profiles.daily_word_goal) · 이름(display_name) · known-word(P0 user_stats.known_word_count).
- **`/dashboard`** async 전환 — 서버 fetch → TodayHero 실 props 주입. WeeklyHeatmap(streak)·MemoryStatus(기억 4색)·RecentActivity 는 P0 데이터로 자동 실데이터화(자체 fetch).
- **TodayHero** `knownWordCount` prop + Implicit Progress 표시("지금까지 N개의 단어가 마음에 자리잡았어요" — §철학4 환경 변화, 게이지 X). typecheck/lint green.

### P2 주간 Report Card — weekly_reports + /reports (v06.98)

LEARNER_MANAGEMENT.md P2 — 리틀팍스 월리포트 이식. `daily_activity`(P0) 주간 집계 + Empathetic 코멘트. 마이그레이션 `20260628170000_p2_weekly_reports`(신규 테이블 + 본인 RLS, 사용자 승인).

- **`weekly_reports`** 테이블 — week_start(월,KST) · total_minutes/words/reviews · by_module · empathetic_note · UNIQUE(user_id, week_start).
- **`lib/learner/weekly-report.ts`** — `generateWeeklyReport`(daily_activity 주간 집계 → upsert + 템플릿 격려 코멘트, KST 월요일, 멱등) · `fetchRecentReports`.
- **`/reports`** 신규 — Report Card 목록(단어/복습/모듈 + Lora italic 격려 코멘트) + "이번 주 갱신" server action. Calm UI · 빈 상태 안내.
- 격려형(§철학3): 미활동도 "잠시 숨을 골랐네요" — 압박/비난 없음. cron 자동 생성은 후속. typecheck/lint green.

### P1 Study Plan — learning_goals + /onboarding (수능 D-day 역산) (v06.98)

LEARNER_MANAGEMENT.md P1 — Busuu study plan 이식. 수능 D-day + 주당 목표 → 주당/일 필요량 + 완료일 역산. 마이그레이션 `20260628160000_p1_learning_goals`(신규 테이블 + 본인 RLS, 사용자 승인).

- **`learning_goals`** 테이블 — goal_type='csat'(수능 단일) · target_date(D-day) · target_v_level(7) · target_word_count(4000, 수능 핵심 어휘 근사) · weekly_target_days/minutes. UNIQUE(user_id, goal_type).
- **`lib/learner/study-plan.ts`** `computeStudyPlan`(순수) — gap=목표-known / 남은주 → 주당·하루 필요 + recentWeeklyRate 기반 완료일 예측(격려형, 미달 압박 X).
- **`lib/learner/goal-actions.ts`** server actions — `saveLearningGoal`(upsert) · `fetchOnboardingContext` · `fetchStudyPlan`.
- **`/onboarding`** 신규 페이지 — D-day·주당일·주당분 입력 → 실시간 Study Plan 미리보기(클라 computeStudyPlan 즉시 반영) + 저장. Calm UI.
- P0 집계층(known-word/daily_activity)을 역산 입력으로 소비. typecheck/lint green.

### P0 집계층 — daily_activity 자동 집계 + known_word_count (v06.98)

LEARNER_MANAGEMENT.md P0 적용 — 진단상 `daily_activity` writer 0(=진짜 P0)였던 것을, 이미 흐르는 원천 스트림(learning_records/scores)에서 자동 집계. 마이그레이션 `20260628150000_p0_daily_activity_agg_known_word_count`(추가·비파괴, 사용자 명시 승인).

- **트리거 2** — `learning_records` AFTER INSERT → daily_activity(total_reviews++ · by_module, KST date) · `scores` AFTER INSERT → daily_activity(total_minutes += duration/60 · total_words += correct_count). FlowStripe 히트맵·주간 리포트 집계원 가동(새 INSERT 부터).
- **known_word_count** — `user_stats` 컬럼 + `refresh_user_known_word_count(uuid)`(stability≥21 count → upsert). `flush-actions.ts` 가 flush 후 1회 호출(부가 집계, 실패 무영향). LingQ형 Implicit Progress(§10 derived 캐시).
- 검증: 트리거 2·컬럼·함수 존재 확인 / known-word 로직 read(현 stable 0=정상, 학습 누적 시 성장). P1(Study Plan)·P2(리포트)·P3(dashboard 실데이터)의 전제 완성.

### 학습자 관리 설계 SSoT (LEARNER_MANAGEMENT.md) (v06.98)

5개 비교군(LingQ/Busuu/리틀팍스/클래스카드/듀오) 분석 + 라이브 데이터 진단 종합 — `docs/LEARNER_MANAGEMENT.md` 신규(설계 문서, 마이그레이션 0). 타겟 = **수능생 단일 집중** · L3(B2B) 로드맵 명시 + 데이터 모델 선반영.

- **라이브 진단**: `learning_records` = 연결+검증(4 row, 이번 세션 flush·게임 5종) · `scores` = 연결됨 실플레이 대기 · **`daily_activity` = writer 0 = 진짜 P0** · `known_word_count` = 컬럼 미존재.
- **설계 수록**: DDL 제안(learning_goals/weekly_reports/classes·class_members·assignments + user_profiles.persona/user_stats.known_word_count) · known-word 집계 정의(§10 derived, stability≥21) · Study Plan 수능 D-day 역산 공식 · 5단계 여정 + 3모드 화면 와이어 · P0~P4 시퀀싱.
- **P0 재정의**: 원천 스트림(learning_records/scores)은 이미 흐름 → P0 = 집계층(`daily_activity` AFTER INSERT 트리거 + `known_word_count` 캐시). CLAUDE.md navigation 행 추가.

### A3.8 추천 엔진 실데이터화 (getMockNextAction → 실 사용자 상태) (v06.98)

세션 종료/워크스페이스의 "다음 행동" 추천이 `getMockNextAction(MOCK_USER_CONTEXTS)` 고정 컨텍스트였던 것 → 실 사용자 상태(due 단어 수 + mastery) 기반. 설계 주석대로 "swap 대상은 한 함수" — 5개 호출처는 hook 1줄 교체. 마이그레이션 0.

- **`lib/recommend/decide.ts`** 신규 — `decideNextAction(ctx)` 순수 P1~P4 로직(mock·실 단일 출처). `next-action.mock.ts getMockNextAction` 도 이 함수 경유로 DRY.
- **`lib/recommend/get-next-action.ts`** 신규 — `getNextActionForUser()` server action: due 단어 수(P1) + mastery(user_stats 또는 vocab 수 근사) → decide. v1 P2(진행중 스크립트) 미연동.
- **`lib/recommend/use-next-action.ts`** 신규 — `useNextAction()` client hook: cold 기본 후 server action 결과 1회 교체.
- **5개 호출처** — FlashcardSession/ScriptQuiz/SpellForge/DictationResultsClient/text[id] 의 `useMemo(getMockNextAction(...))` → `useNextAction()`. (getMockNextAction/MOCK_USER_CONTEXTS 은 데모/테스트용 보존.)
- ⚠️ typecheck/lint green, 런타임 미검증. user_stats 빈 상태면 vocab 수 근사로 mastery 산정(cold-bias) — 실 사용자 데이터 누적 시 정확.

### A3.7 WordBlitz standalone 영속화 완성 (learning_records + scores) (v06.98)

`/play/wordblitz` standalone 라우트의 onCorrect/onWrong 이 `console.log` TODO 였던 것(워크스페이스 모드 WorkspaceWordBlitzMode 만 A1.3 적재) → learning_records + scores 둘 다 적재. **이로써 게임 5종(flashcard/spellforge/pairflip/scriptquiz·텍스트결과/dictation/wordblitz) 점수 적재 완료.** 마이그레이션 0.

- **onCorrect/onWrong** → `recordWordBlitzResult({word, isCorrect})`(FSRS learning_records, 워크스페이스 모드와 동일) + 정/오답 카운트.
- **onExit** → `recordGameScore`(module='wordblitz', score=correct×120+wrong×30 게임식 복제[POINTS 고정], accuracy/duration/metadata). captured 0(미플레이) skip + 1회 가드.
- ⚠️ typecheck/lint green, Three.js 게임 런타임 미검증. WordBlitz 는 무한루프라 "완료" 없음 → exit 시점 적재.

### A3.6 게임 점수 적재 확장 (flashcard/spellforge/dictation) (v06.98)

A3.5(PairFlip)로 시작한 `scores` 적재를 3개 게임으로 확장 — 메인 Hub "최근 활동"(useHubData 가 scores 읽음)이 실제로 채워지도록. 공유 헬퍼로 통일. 마이그레이션 0.

- **`lib/scores/record-score.ts`** 신규 — `recordGameScore`(fire-and-forget INSERT) + `useRecordGameScore`(완료 컴포넌트 마운트 1회, re-render/StrictMode 중복 방지). `learning_records`(단어별 FSRS)와 별개 세션 결과.
- **Flashcard** `CompletionState` — ratingCounts 기반 correct/accuracy 집계 → scores(module='flashcard').
- **SpellForge** `SpellForgeCompletion` — totalWords/correctCount/duration → scores(module='spellforge').
- **Dictation** `DictationResultsClient` — session.totalAccuracy/items/totalTimeMs → scores(module='dictation', session 로드 시 1회).
- ⚠️ typecheck/lint green, 완료 화면 런타임 미검증. **WordBlitz 보류**(무한루프 — 세션 시작시각·정오 카운트 추적 구조 추가 필요, 별도). PairFlip(A3.5/#56)은 inline write — 후속 통일 가능.

### A3.5 PairFlip 게임 점수 영속화 + hub 실 stats (v06.98)

`scores` 테이블에 **어떤 게임도 쓰지 않던**(write 0, useHubData 가 읽기만) gap 의 첫 해소 — PairFlip 완료 시 게임 점수를 `scores` 적재 + hub stats 를 mock(0 고정)에서 실 집계로. 마이그레이션 0(`scores`/`module_id` 기존재).

- **`PairFlipGameScreen` onComplete** — `scores` INSERT(module='pairflip', score/total/correct/accuracy/duration + metadata{maxCombo/hintsUsed/totalAttempts/level/mode}). 실/mock 페어 무관 게임 성과 기록, fire-and-forget(흐름 비차단).
- **`lib/pairflip/stats.ts`** 신규 — `fetchPairFlipStats`(scores module='pairflip' 집계 → bestScore/maxCombo/gamesPlayed, 최근 500 cap). `/pairflip`(server) 가 fetch → `PairFlipHub` stats prop 주입(기록 없으면 zero=cold).
- **`PairFlipHub`** `MOCK_STATS`(0 고정) 제거 → `stats` prop. Best·콤보·게임수 hero 실데이터.
- ⚠️ typecheck/lint green, 게임 완료 write 런타임 미검증. 다른 게임(flashcard/spellforge/…) scores 적재는 별개(동일 패턴 확장 가능).

### A3.4b ScriptQuiz 질문 한국어(question_ko) 완성 (v06.98)

A3.4 의 한국어 토글이 옵션만 번역하고 질문은 영어로 남던 것 → `quiz_questions.question_ko` 컬럼 추가로 질문까지 한국어. 마이그레이션 `20260628140000_scriptquiz_question_ko`(nullable, 무손실).

- **마이그레이션** — `ADD COLUMN question_ko text`(사용자 명시 승인). Ammachi Ch1 5문제 한국어 질문 UPDATE 적재.
- **`fetchQuizSession`** — `question_ko` select + `questionKo` 매핑(있을 때만). 생성 타입 미반영이라 unknown 경유 캐스팅(런타임 컬럼 존재).
- 롤백 `docs/AI_CONTEXT/rollback/scriptquiz_question_ko_원본.sql`.

### A3.4 ScriptQuiz 실 퀴즈 capability (quiz_questions 연동) (v06.98)

게임 mock 스윕 마지막 — ScriptQuiz 가 `MOCK_SESSION` 고정이던 것 → `quiz_questions`(per user+text) 실 퀴즈 fetch + MOCK 폴백. **코드 capability 만**(문제 콘텐츠 생성은 별도 — 앱에 런타임 LLM 인프라 없음, Claude Code 사전 생성 또는 생성 파이프라인이 채움). 마이그레이션 0.

- **`lib/scriptquiz/questions.ts`** 신규 — `fetchQuizSession(client, userId, textId)` → quiz_questions + texts.title → `QuizSession`. 문제 0개면 null → MOCK 폴백.
- **`ScriptQuiz`** `session?: QuizSession` prop(기본 MOCK_SESSION) — `typeof MOCK_SESSION` → `QuizSession` 정합.
- **play 페이지** async — `?text={texts.id}` 의 실 퀴즈 fetch, ResourceContext 동적 제목/문항수. 미지정/미생성 시 데모 MOCK.
- ⚠️ typecheck/lint green, 게임 상호작용 런타임 미검증.
- **문제 콘텐츠 적재(사용자 명시 승인 2026-06-28)** — "Ammachi's Amazing Machines — Chapter 1"(text `26688c2b`)에 독해 5문제 INSERT(multiple 4 + truefalse 1, 정답 인덱스 0/2/0/1/3 분산, 영어 본문 + 한국어 옵션 + sourceSnippet). E2E 검증: title 해석·5문제·옵션/정답 인덱스 전부 유효 → `?text=26688c2b…` 실 퀴즈 동작. quiz_questions 0→5 rows.

### A3.3 PairFlip 실 페어 + SRS 영속화 (v06.98)

게임 mock 스윕 3번째 — PairFlip 이 `MOCK_PAIRS`(evolution/predator…) 고정 + **영속화 전무**(fsrsRating 계산만 하고 sessionStorage→results 로만)였던 것 → 사용자 SRS 큐 due 단어 실 페어 + 매칭 결과 FSRS 영속화. 마이그레이션 0 (`module_id` enum 에 `pairflip` 기존재 — TS `ModuleId` 만 정합).

- **`lib/pairflip/due-pairs.ts`** 신규 — `fetchDuePairs`(브라우저 client, due 우선, meaning 빈 단어 제외, `pairId = vocabularies.id`).
- **play 페이지** — config + due 페어 둘 다 로드 후 게임 마운트(실 페어를 mount 시점 주입). 부족하면 빈 배열 → hook mock 폴백(win-condition 보존, 무회귀).
- **`usePairFlipSession`** `pairs?` 옵션(레벨 pairCount 이상이면 실데이터, 아니면 mock).
- **`PairFlipGameScreen`** onComplete — 실 페어 사용 시 pairResult 별 `pushPendingResult`(word lookup) + `flushPendingSession`(서버 권위 재계산). mock 폴백이면 push 생략.
- **`ModuleId`** += `'pairflip'`(DB enum 정합) → 연쇄로 `actionToHref` 에 `/pairflip` 케이스 추가.
- ⚠️ typecheck/lint green, **게임 상호작용 런타임 미검증**(상태머신) — 머지 전 수동 확인 권장.
- 잔여: ScriptQuiz(AI 문제생성 파이프라인 필요 — mock 스왑 아님).

### A3.2 SpellForge play 실데이터화 (v06.98)

게임 mock 스윕 후속 — SpellForge play(`/spellforge/play`)가 `'The Great Gatsby'` + `MOCK_WORDS` 하드코딩(스코프 진입조차 없음)을 쓰던 것 → **사용자 SRS 큐의 due 단어 실데이터**로. 영속화(`pushPendingResult`/`flushPendingSession`)는 이미 작동 — 데이터 source 만 교체. 마이그레이션 0.

- **`lib/spellforge/hub-words.ts`** 신규 — `fetchDueSpellForgeWords` = study-queries 재사용 + `rowToCard`→`getMemoryState` SSoT 로 `status`(메모리 4색) 계산 → `SpellForgeWord[]`.
- **play 페이지** async 전환 + 미로그인/빈 큐 `HubEmpty` 안내. 부수 효과: 기존 mock 단어는 flush 가 사용자 vocab 과 매칭 안 돼 영속화 무효였던 것이 실 단어로 정상 영속화.

### A3 Flashcard hub 진입 실데이터화 (v06.98)

게임 모듈 mock 잔존 스윕 — Flashcard hub 일반 진입(`/flashcard/play`, set/text 스코프 없음)이 `MOCK_FLASHCARD_WORDS` 하드코딩 단어를 쓰던 것 → **사용자 SRS 큐의 due 단어 실데이터**로. 영속화(`flushPendingSession`)는 이미 작동 중이라 hub 진입 데이터 source 만 교체. 마이그레이션 0.

- **`lib/flashcard/hub-words.ts`** 신규 — `fetchDueFlashcardWords` = `study-queries.fetchStudyVocabularies`(due 우선 next_review_at 임박순 + cap 50) 재사용 + `rowToCard` 로 실 FSRS 상태 hydrate. 스코프 진입(scoped-words)과 짝.
- **play 페이지** — hub 분기에서 mock 제거, 미로그인/빈 큐 빈 상태(`HubEmpty`) 안내(mock 폴백 금지). 스코프 진입(워크스페이스 "카드" pill)은 기존 그대로.
- 잔여(별도): SpellForge play(Gatsby mock) · PairFlip(mock stats) · ScriptQuiz(MOCK_SESSION) 실데이터화.

### P6.5 어휘 학습 계층(Cold/Warm/Hot) 통합 검증·명문화 (v06.97)

P6 잔여 마지막 단계. read-only 진단 결과 **세 계층이 P6.1~P6.4 + SRS 영속화(A1/A2) + 자동 승급(Phase 2E/G) 누적으로 이미 기능적 통합·일관**됨을 확인 — 별도 재설계 불요. 암묵 계약을 `docs/VOCAB_LAYERS.md` 로 명문화(drift 차단). 마이그레이션 0.

- **검증된 불변식**: (1) 전이(Cold→Warm→Hot→V-level) 전부 `vocabularies.word = shared_dictionary.word` 키 — `auto_promote_v_level_for_user`/`_track_` word-keyed 확인 (2) V-level 게이트 `current_v_level` 중심(hard band enroll vs soft Gaussian extract, drift 없음) (3) 상태 분류 `lib/srs/state.ts getMemoryState()` 단일 SSoT.
- **보류(저가치)**: G1 `vocabularies.lemma` NULL 백필 = vestigial(핵심 경로 word-keyed, Cold 계층 `library_book_vocabularies.lemma` 와 별개) **skip** · G3 통합 read view = DX(deferred) · G4 origin taxonomy = cosmetic(deferred) · Warm→Hot DB 함수화 = **거부**(현 server action 충분).
- 실측: vocabularies origin별 warm 6,473 / hot 4(dev 데이터).

### P6.6 V0(미진단) effective V-level 가드 (v06.97)

P6.1 의 effective V-level 산정이 `current_v_level = 0`(진단 미완료 기본값)을 유효 앵커로 사용해 i+1 밴드가 `GREATEST(0-1,1)..LEAST(0+1,11) = [1,1]` 로 붕괴 → 책 구독 시 V1 단어만 import(라이브러리 도서 어휘 V6~V11 전량 배제)되던 잠재 결함 해소. 마이그레이션 `20260628130000_p6_6_enroll_v0_undiagnosed_guard`.

- **NULLIF 가드** — `COALESCE(NULLIF(current_v_level, 0), book_v_level, 5)` 로 V0 을 미진단 취급 → fallback. V0 사용자 effective=5 → band [4,6](검증).
- **F3 소급 정리(사용자 결정 2026-06-28)** — review_count=0 + i+1 위반 vocab 정리는 **V0/NULL 미진단 사용자 제외**. 측정 결과 유일 후보가 V0 사용자라 **삭제 0 건**(진도·데이터 무손실). 본 가드는 향후 enroll 정합만 확보.
- 검증: `has_v0_guard=true` + V0 simul effective=5/band [4,6]. 롤백 `docs/AI_CONTEXT/rollback/P6_6_enroll_v0_guard_원본.sql`.

### ACP §19 OpenStax CNXML 소스 설계 + 프로토타입 (v06.97)

§18 에서 "CNXML dump 통합 필요(별도)"로 보류했던 OpenStax 교재 소스 설계. 실측 검증 기반(GitHub API + raw CNXML + DB 분류 함수). 마이그레이션 0 (DB 등록은 라이선스 결정 대기). 스펙 `docs/ACP_OPENSTAX_DESIGN.md`.

- **프로토타입 ingester** `packages/library-pipeline/src/ingest-article/openstax.ts` — collection.xml `<md:license url>` 권위 읽기 + `cnxmlToPlainText`(MathML/figure/exercise/equation/link 제거 → `<para>/<section>/<term>` 산문) + `ingestOpenStaxModule` → `RawArticle`. `ArticleSource` 에 `'openstax'` 추가.
- **검증** — biology m45417: 18,544자 클린 산문 · lexical_noise 0 · math/figure/src 잔존 0. 라이선스 = collection 메타 그대로(가정 X).
- **🔴 결정적 발견** — OpenStax 인기 교재 10종 전부 **CC-BY-NC-SA**(NonCommercial). `acp_classify_license('CC-BY-NC-SA-4.0')='restricted'`(차단), `'CC-BY-4.0'='cc_by'`(통과). 즉 기술 통합은 완료, **차단 요인은 라이선스 1건** — 상업 의도 서비스엔 NC 부적합(게이트 정확). 통합 진입은 코드 아닌 **결정**(CC-BY 타이틀 한정 / 비상업 commitment / 보류 중 택일). ingester 만 대기 머지, O1~O5 wiring 보류.

### C1/P6.1 구독 시점 i+1 필터 (v06.96)

책 구독 시 `_enroll_book_subscribe_word_sets` 가 vocabularies 를 사용자 V-level 무관하게 일괄 import 하던 것(i+1·Desirable Difficulty 위배) → 구독 시점 i+1 필터 + dedup + 세션 cap. 마이그레이션 `20260628120000_p6_enroll_subscribe_i_plus_one`.

- **구독(set-level) 불변** — 책 전체 챕터 단어장은 그대로 구독. **vocabularies import 만** 필터(E8 완전분리 — orphan vocab 343 확인).
- **i+1 필터(E1)** — `v_level BETWEEN GREATEST(N-1,1) AND LEAST(N+1,11)`. N = `user_profiles.current_v_level`(E1) → `library_books.book_v_level`(E2) → 5(E5). `shared_dictionary` LEFT JOIN(미등재 단어 통과).
- **dedup(E7)** — `UNIQUE(user_id,word)` 존재 확인 → `NOT EXISTS` + `ON CONFLICT DO NOTHING`(stable dedup 포괄).
- **세션 cap 50(E4)** — DISTINCT ON 단어당 1행 + 레벨 근접·고빈도 우선 ORDER → LIMIT 50.
- **F0(소급 보류)** — 기존 vocabularies 무변경, 신규 enroll 만 적용.
- 검증: read-only 스모크 — v_n=5 시 selected=50(cap)·전부 band [4,6] / 실 V0 사용자는 dedup 으로 0(정상). 롤백 `docs/AI_CONTEXT/rollback/P6_enroll_subscribe_원본.sql`.

### A2b WordVault 복습 뷰 실데이터 (v06.95)

`/wordvault` 복습 뷰가 하드코딩 placeholder("오늘 복습할 단어 12개")였던 것 → 실 vocabularies 기반 복습 세션으로. (A2 study 인프라 재사용 — 마이그레이션 0.)

- **`/wordvault/review` RSC** 신설 (study 라우트 미러) — 복습 대상 = **due+new**(`next_review_at ≤ now` 또는 NULL), `fetchStudyVocabularies`(due 우선) → `WordVaultStudyClient` (`mode="review"`). 평가는 study 와 동일 flush 경로(A1.1)로 영속화.
- `WordVaultStudyClient`에 `mode?: 'study'|'review'` prop 추가(빈 상태 카피 분기, 기본 study).
- 레거시 `?view=review` → `/wordvault/review` redirect (study 패턴 동일). hub words mock 실데이터화는 별도(미진입).

### A1.3 WordBlitz 학습 기록 적재 (v06.91)

`recordWordBlitzResult`가 `vocabularies`(FSRS D/S)만 update하고 `learning_records`(audit) insert는 누락해 Hub/Dashboard 통계에서 WordBlitz 플레이가 빠지던 문제 해소. update 성공 후 `resultToRecordPayload(result, user.id)`로 insert 추가 — 4모듈(flashcard/spellforge/dictation/wordblitz) 기록 일관. 마이그레이션 0(컬럼 기존재). 독립 변경(flush 인프라 무관).

### A2 WordVault 학습 실데이터 + 영속화 (v06.90)

WordVault StudyMode가 `MOCK_WORDS`(레거시 `?view=study` 클라이언트 경로)만 받던 문제 해소 — browse RSC 패턴을 study에 복제해 **실 vocabularies** 제시 + A1.1 flush 경로로 평가 영속화. (마이그레이션 0. 신규 라우트 `/wordvault/study`.)

- **`/wordvault/study` RSC** 신설 (browse 미러) — `fetchStudyVocabularies`(due 우선: `next_review_at` asc nullsFirst, 세션 cap 50) → `vocabRowToWord` → `WordVaultStudyClient`(빈 상태 안내 포함). 레거시 `?view=study` → 신 라우트 redirect.
- **StudyMode 실 배선** — 데모 제거(studyIndex 0 시작·실 진행률·modulo 루프 제거). `rateWord(1~5)` → `studyRatingToFsrs`(1다시→Again·2어려움→Hard·3애매→Hard·4쉬움→Good·5완벽→Easy) → `applyReview`+큐 push(word) → 마지막 단어/종료 시 `flushPendingSession`.
- `rating-mapper.ts` `studyRatingToFsrs` 추가. WordVault review·hub words mock 은 A2b 분리.

### A1.1 SRS 학습 결과 DB 영속화 (v06.89)

학습 모듈이 FSRS를 클라이언트에서 계산해 `sessionStorage` 큐(`pushPendingResult`)에 쌓지만 **DB로 flush하는 소비자가 없어 탭을 닫으면 소실되던** 갭 해소. (마이그레이션 0 — `vocabularies` FSRS 컬럼 + `learning_records.rating`/audit 컬럼 모두 기존재 확인.)

- **`flushPendingSrsResults` 서버 액션** (`lib/srs/flush-actions.ts`) — 큐를 받아 **단어 텍스트로 (user_id, word) `vocabularies` 조회**(cardId는 모듈마다 의미 상이 — shared_words.id/vocabularies.id/정규화 단어 — 신뢰 불가, WordBlitz 패턴 재사용) → **서버 권위 재계산**(실 DB row의 D/S에 `applyReview`, scoped 단어 empty-card 진행도 리셋 방지) → `vocabularies.update` + `learning_records.insert`. 사용자 어휘에 없는 단어(mock/챕터 보충)는 silent skip. 같은 단어 반복 평가는 시간순 누적.
- **`flushPendingSession` 클라이언트 헬퍼** (`lib/srs/flush-session.ts`) — 세션 종료 시 큐 flush, 성공 시에만 비움(실패 시 보존·재시도).
- **3개 모듈 완료 지점 배선** — Flashcard(`isComplete`)·SpellForge(`showCompletion`)·Dictation(`srsAppliedRef`) 에서 flush 호출. `PendingSrsResult`에 `word` 추가(4개 push 사이트 갱신). WordVault StudyMode(데모)·WordBlitz `learning_records` insert는 A1.2/A1.3로 분리.

### Tier B UI 폴리시 (v06.88)

플랫폼 미완성 작업 스캔 후속 — 자립형 quick-win 묶음. (B1 워크스페이스 article `audio_url` 재생은 P5(v06.86)에서 이미 배선 완료로 확인되어 작업 제외.)

- **pending-words 피드백** — `PendingWordActions` 상태 전환 실패 시 `alert()` → `useToast().error` (Calm UI · 기존 `components/ui/Toast` 재사용).
- **로딩 화면 폴리시** — `dictate/setup` Suspense fallback + `pairflip/play` 세션 대기 화면을 `Loader2` 스피너 + 차분한 카피("준비하고 있어요")로 정비. (두 화면 모두 정상 전환 상태였고 무한 로딩 아님 — 점검 결과 cosmetic 개선만.)

### 멀티 세션 git worktree 자동화 (v06.94)

여러 Claude Code / VS Code 세션이 서로 다른 화면·기능을 동시에 작업하도록 worktree 레이아웃 셋업 + 관리 자동화.

- **worktree 레이아웃** — `../Vocaflow-main`(main, PR/handoff) · `../Vocaflow-ui`(`feat/learner-ui`, `app/(main)/*`) · `../Vocaflow-admin`(`feat/admin-ui`, `app/admin/*`). 학습자/어드민 라우트 폴더 분리로 병렬 충돌 최소.
- **`scripts/worktree.mjs` + `pnpm wt`** — `list`(ahead/behind) / `new <suffix> [base]`(생성 + `pnpm install` 자동) / `remove <suffix> [--del-branch]` / `sync`(fetch --prune). 규약: 디렉터리 `../Vocaflow-<suffix>` + 브랜치 `feat/<suffix>`.
- **`docs/WORKTREE.md`** 신규 — 운영 가이드(원칙·레이아웃·스크립트·공유 자산 충돌 직렬화 규칙). 핵심 주의: 클라우드 DB·`supabase/migrations/`·`packages/ui-shared` 등 공유 자산은 한 세션에서만 변경 후 나머지 worktree pull/rebase.

### verify CI green 복구 — lint 74건 + CI 안정화 (v06.93)

CI `verify` job(`turbo run lint typecheck test`)이 **3가지 독립 사유**로 상시 red였던 것을 green으로 복구(빌드 복구 v06.92 후속). 경고(jsx-a11y·exhaustive-deps)는 차단 안 하므로 보존.

**① web ESLint 에러 74건 → 0:**

- **`no-explicit-any` 32 (전부 `lib/admin/dict/queries.ts`)** — `countRows` 콜백의 불필요한 `(q as any)` 중복 캐스트 제거(`q`는 이미 `PgQuery`(eslint-disabled 단일 alias) 타입). 런타임 불변.
- **`no-unused-vars` 28** — 미사용 import/var/arg 제거(24파일). 미사용 prop은 destructure에서만 제거(인터페이스/콜러 계약 보존), write-only 변수·orphaned arg는 안전 정리.
- **`no-unescaped-entities` 12** — JSX 텍스트의 `"`/`'`를 `&ldquo;`/`&rdquo;`/`&apos;` 등으로 이스케이프(6파일).
- **`prefer-const` 2** — `bookMetaMap`·`countsPerSet` `let`→`const`.

**② `apps/mobile` (Expo 기획 scaffold — eslint·typescript 미설치):** `lint`·`typecheck` 스크립트를 no-op stub(`@vocaflow/wlp:lint` 선례 동일 — 검사할 실 코드 없음. 모바일 실구현 시 복원).

**③ 무(無)테스트 패키지:** `vcb-core`·`library-pipeline` test 스크립트에 `--passWithNoTests` 추가(`vitest run`이 "No test files found"로 exit 1 하던 것 — `@vocaflow/wlp` 선례 동일).

**④ 통합 테스트 env-skip 버그:** `content-storage.test.ts`(Supabase 통합)가 env 없는 CI에서 `describe` 본문 최상위의 즉시 `createClient` 호출로 `supabaseUrl is required` throw(collection 단계). `client` 생성을 `beforeAll`로 지연 → `skipIf(env 없음)` 시 미실행 → CI 정상 skip(로컬 .env.local 있으면 그대로 실행).

- 검증: 로컬 `turbo run lint typecheck test` **13/13 green**(env 有) · CI(env 無)는 content-storage skip 후 green · `next lint` 0 · `tsc` 통과 · `next build` green(83p).

### 프로덕션 빌드 복구 (v06.92)

`next build`(프로덕션)가 main에서 **기존부터 실패**하던 것을 복구 — 배포 차단 이슈. CI가 typecheck/lint만 게이트하고 `next build`는 안 돌려 미발견. (SRS 검증 중 발견 — [[project_next_build_broken]] 진단.)

- **`swcMinify: false`** — SWC minifier가 `@mintplex-labs/piper-tts-web`(onnxruntime-web 번들, EchoMatch) 청크를 parse 못해 `failed to parse input file: Syntax Error`로 죽던 것 → Terser minifier 폴백. `✓ Compiled successfully` 회복. (후속: ort 청크만 제외하는 surgical 방식으로 SWC minify 복원 가능.)
- **`eslint: { ignoreDuringBuilds: true }`** — 전(全)프로젝트 기존 lint 부채 74건(no-explicit-any 32·no-unused-vars 28·no-unescaped-entities 12·exhaustive-deps 6)이 빌드 산출물 생성을 막던 것 → lint를 빌드에서 분리(`next lint`/별도 CI job). **typecheck는 빌드에서 계속 강제**(tsc 통과 유지, `ignoreBuildErrors` 미설정).
- 결과: `next build` exit 0, 83 페이지 생성.
- **CI 가드** — `ci.yml`에 `build` job 추가(`next build` 실행 · placeholder env · push/PR to main). 빌드 깨짐 재발 조기 감지. CI 시뮬레이션으로 `.env.local` 없이 green 확인(force-dynamic 페이지는 build-time 미실행). 후속: lint 74건 점진 cleanup + ort 청크만 제외하는 surgical minify 복원.

### 큐레이션 관리자 콘솔 — SourcePolicy 단일 화면 (v06.87)

`/admin/articles` 를 소스별 8탭 → **SourcePolicy 분기 단일 4단계 콘솔**(커버리지·소스GET·검수·발행)로 재구성. VOA/TC 등 소스 차이는 정책 4축(supply/media/derivation/attribution)으로만 분기 — `if (source==='voa')` 하드코딩 제거. (admin_curation_screens_build handoff: C2 + P1~P4.)

- **C2 SourcePolicy 공유 자산** — `_curation-spec.ts` 에 `SourcePolicy`/`getSourcePolicy`/`SOURCE_POLICIES`/`resolveSourcePolicy`/`licenseClassOf` + 4 라벨 맵. 정책은 기존 SSoT 에서 **파생**(supply←`frozen`, attribution←`attributionRequired`, derivation←`license_class` cc_by_nd, media←VOA audio 정체성). drift-lock vitest 18종(패키지 첫 테스트). client 는 `/curation-spec` 서브패스로 소비.
- **P1 셸+훅** — `CurationConsole`(4-stage) + `useSourcePolicy` 단일 진입 훅 + `PolicyBar`(소스 선택 시 정책 라이브 렌더). `AcpClient` 대체.
- **P2 커버리지** — `CoverageMatrix` gap(빗금+GAP)/filled(stable 바+발행건수) + 셀 클릭→GET · `SourceFeedList`(소스/feed별 후보·audio·avg score — `listSourceFeedHealth` JS 집계, 마이그레이션 0).
- **P3 소스 GET** — `CandidateTable`(seed-list 6컬럼: 체크박스·제목·register·CEFR/V·score 막대·audio[policy.media]) + 다중선택 → `/api/acp/enqueue` import. supply 뱃지(static→"recency 미적용·정렬 source·length"). register/CEFR/V 는 ingest 전 미산출 → "—".
- **P4 검수·발행** — `ReviewPanel`(3패널: 큐 상태 dot / 에디터·player / 정책 게이트) + `computeGateItems(policy)` 동적 게이트(media/attribution/noise/v_level) + 발행 버튼 라벨 derivation 분기. 기존 deep review `computePublishGate` 의 `if(source==='voa')` → `resolveSourcePolicy().media` 교체. `ArticleAdminRow` +`audio_url`/`article_v_level` · `publish-gate.ts` 공유 유틸.
- 마이그레이션 0건 · 본문·단어 딥 편집은 `/preview/[id]` 재사용(중복 회피) · web `tsc --noEmit` 통과.

### VOA 큐레이션 재설계 — frozen archive (v06.86)

VOA Learning English = frozen archive(전 feed 2025-03 정지, 라이브 확인) 전제로 큐레이션 입력측·검수·학습자 제시 재설계. PR `feat/voa-curation-redesign` (P0 진단 → P1~P5, 영향격리 순).

- **P1 score frozen 재정규화** — `_curation-spec.ts` `FeedSpec.frozen` 플래그. frozen feed 는 recency 축(0.40 — stale 로 사문화)을 제거하고 source 0.45 / length 0.25 재분배 + 730일 stale cliff 면제. VOA 4 feed + `SOURCE_DEFAULT_SPEC.voa` 한정(NASA/NIH/wikinews/the_conversation/simple_wikipedia score 불변, 54 조합 검증).
- **P2 feed 확장** — register gap 보강 2종: American Stories(zoneid 1581, narrative) + Health & Lifestyle(zoneid 955, expository). `VOA_FEEDS` + `FEED_SPECS`(frozen) + `SOURCE_SPECS.voa.preferredFeedMix` 6 feed 재분배(합 1.00) + `VoaFeedTab`. 마이그레이션 0건(source='voa' 유지 · register narrative/expository 기존 CHECK 허용).
- **P3 발행 audio 게이트** — `20260621120000_voa_publish_require_audio_gate`: 트리거 `trg_la_require_audio`(BEFORE INSERT/UPDATE OF status · source='voa' && audio_url 없음 → 발행 차단 · 타 소스 격리). force-publish route `AudioGate` 400 + 검수 UI `PublishGate` `no_audio` 상태. smoke 3/3, 기존 발행분 영향 0. C3(register=course 배제)는 register enum 에 'course' 값 부재로 **연기**.
- **P4 학습자 카드** — `judgeArticleIPlusOne`(글은 coverage 부재 → `article_v_level` vs 사용자 V 직접 비교, 미진단 V5 fallback) + `ArticleCard` i+1 적합도 배지 + CEFR/VOA Level 병기 + register 배지(아이콘+텍스트) + 음성 인디케이터.
- **P5 진열 + 인라인 주석** — `ArticlesExplorer` '추천순'(i+1 적합 우선 → 짧은 글) 기본 정렬 + Progressive Disclosure "맞춤 다음 글" 1개. `text/[id]` article 분기 인라인 단어 주석 풀 적용(발행 `shared_words` → `chapterWords` · preview==publish==workspace). 듣기 동급 진입점은 기배선(FloatingAudioPlayer). 시리즈 이어듣기는 글에 feed/series 데이터 미보유로 보류.

### Post-audit hardening (v06.85)

PR #31 (UI 감사) 후속 — 동 PR 의 main 직접 commit 실수 (push 실패로 origin 비파괴, PR 경유 복구) 재발 방지 + Project attach 정합.

변경:
- manifest §1 Tier 3 활성 list 에 `ui_screen_audit_20260621.md` 추가 — Project 가 1차 정합 복구 / 2차 spec 설계 입력으로 자동 attach 권장 대상화
- `feedback_handoff_workflow` 메모리에 "Edit/Write 전 `git branch --show-current` 선확인" 안티패턴 추가 — 다음 세션 자동 차단

### manifest drift 자동 검증 (v06.84)

PR #26 (manifest 보강) 후속 — drift 가 누적되지 않도록 CI 검증 추가.

**신규** `scripts/check-manifest.mjs`:
- (1) `docs/` 직속 *.md 파일이 manifest §1 Tier 1 list 에 백틱 인용됐는지
- (2) `docs/AI_CONTEXT/` 하위 폴더가 manifest 분류 (Tier 또는 §2 제외) 에 명시됐는지
- (3) `docs/` 의 1차 하위 폴더 (`adr/`, `references/`, `proposals/` 등) manifest 명시 확인

**`.github/workflows/sync-check.yml`** `manifest-drift` job 추가 — push / PR 마다 실행, warning-only (block X).

**효과**: 본 세션 초반 발견된 `docs/AI_CONTEXT/handoffs/` 누락 같은 drift 가 다음부터 자동 알림.

### PROJECT_KNOWLEDGE_MANIFEST 신규 폴더 3종 분류 (v06.83)

PR #25 (P6 handoff) 후속 — `docs/AI_CONTEXT/` 의 신규 폴더 3종이 manifest 에 없어 Project 가 attach list 생성 불가. 보강.

| 폴더 | Tier | 정책 |
|---|---|---|
| `docs/AI_CONTEXT/handoffs/` | **Tier 2 항상 묶음** | 활성 handoff 항상 attach. 머지/완료 시 archive |
| `docs/AI_CONTEXT/diagnostics/` | **Tier 3 선별** | 활성 milestone 동안만 (예: `extraction_p0_20260620.md`) |
| `docs/AI_CONTEXT/rollback/` | **Tier 외 제외** | DDL 청크 — Project spec 검토 무가치. Claude Code 단독 `Read` |

### P1~P4 누적 효과 — 기존 published 책 재발행 (v06.82)

P4 (단일 코어 통합) 직후. 기존 259 published 단어장은 옛 selection 마커 (v06.35 / v06.51) 유지 → P1~P4 효과 미반영. 재발행으로 적용.

**판정 (적용 전)**:
- 사용자 학습 진도 측정 — review_count=0 / fsrs=0 (단순 import 만, 학습 시작 0) → reset 비용 0
- Production 사용자 0 (dev 환경, 단일 사용자 본인)
- FK CASCADE: shared_words / subscriptions → 자동 / vocabularies → SET NULL (명시 DELETE 로 orphan 방지)

**적용** (migration [20260620080000_republish_library_books_with_p1_p4](../supabase/migrations/20260620080000_republish_library_books_with_p1_p4.sql)):
- 단일 DO 트랜잭션 (BEGIN/COMMIT 보호)
- IDEMPOTENT — `curation_query.selection NOT LIKE '%P3%'` 가드
- vocabularies + shared_word_sets DELETE → publish_book_word_sets(book_id, 40) → _enroll_book_subscribe_word_sets

**실측 효과**:
- 259 sets 전부 word_count ≤ 40 (max 239 → 40 · p90 57 → 40 · p50 21 → 36)
- avg 28.8 → 30.9 (V6~V8 학습밴드 복원 효과 +7%)
- vocabularies 4,363 → 4,862 (+499 · 사용자 단어 풍부도)
- Twenty years after (V9) 챕터1 top10: cardinal/parliament/valet/glance/troop/superintendent/chamber/mayor/exclaim/murmur (17세기 프랑스 정치소설 핵심 + 학습 균형)

**Production 적용 시 주의**: 본 DO 블록의 사용자 iteration 은 dev 1명 가정. 다수 사용자는 `_enroll_book_subscribe_word_sets` 를 `FOR v_user IN ... LOOP` 으로 확장 필요.

### P4 — book·article 추출 단일 코어 통합 (v06.81 · C5)

P3 (cap) 직후. handoff §P4 — composite 식 drift 영구 차단.

**변경** (migration [20260620070000_p4_unify_composite_core](../supabase/migrations/20260620070000_p4_unify_composite_core.sql)):
- 신규 `_extract_composite_score(rank, freq_in_unit, unit_max, v_level, verified, example, skill, unit_v_level) RETURNS numeric IMMUTABLE` — composite 식 단일 SSoT
- `select_book_chapter_vocab` scored CTE → 헬퍼 호출 (unit=chapter)
- `select_article_vocab` scored CTE → 헬퍼 호출 (unit=article)
- 식 변경 시 한 곳만 수정. book/article 정합 영구 보장.

**회귀 0 검증** (Les Misérables · bit-identical):
- total=7472 · distinct=1677 · null_rank=1643 · distinct_null=46 (P2 와 100% 일치)
- 챕터1 top5: bishop V8 0.7109 / petty V9 0.6167 / occupy V6 0.5467 / portion V6 0.5444 / fate V6 0.5394
- 호출자 (publish_*_word_set / 트리거 / 외부) 영향 0 — 함수 시그니처/반환 타입 무변동

**보존**: 게이트 (P1), composite 식 (P2), cap 발행 (P3), DISTINCT/sort.

**핸드오프 §P4-3 미수행** (범위 외): `/api/analyze` (OpenAI) → winkNLP lemma → shared_dictionary → 동일 코어 재랭킹 spec 검토.

**남은 단계** (handoff):
- P5b — standard+C2 register 재분류 (15% 의심 표본)
- P5c — example_en 갭 (V6~V11 100% 이미 충전 → 사실상 불요)
- P6 — 구독 시점 user V-level 필터 (C6 별도 handoff 필요)

### P3 — 챕터/글당 top-N cap (v06.80 · C4)

P2 (composite 재설계) 직후. P0 측정 C4 (챕터당 word_count max=239 · p90=57 · cap 없음) 해결.

**변경** (migration [20260620060000_p3_publish_cap40](../supabase/migrations/20260620060000_p3_publish_cap40.sql) + [20260620061000_p3b_drop_old_publish_overload](../supabase/migrations/20260620061000_p3b_drop_old_publish_overload.sql)):

- `publish_book_word_sets(p_book_id uuid, p_cap int DEFAULT 40)` — INSERT WHERE `sort_order <= p_cap` + `curation_query.cap`
- `publish_article_word_set(p_article_id uuid, p_cap int DEFAULT 40)` — 동일 패턴
- **P3b overload DROP**: 옛 1-arg 시그니처 DROP (PostgreSQL exact-match 우선 정책 회피)
  - 호출자: `trg_publish_book_word_sets` / `trg_publish_article_word_set` 트리거 2개 (lazy resolution → trigger 본문 변경 불요)
  - 1-arg PERFORM → 새 2-arg DEFAULT 매칭 → cap=40 자동 적용

**효과** (Les Misérables 실측):
- 359 챕터 / max_raw=233 / cap=40 후 max=40 / **clipped 44 챕터 (12.3%)** / avg_publish=16.2
- p75=32 안전권 (75% sets 영향 0)
- Sweller Cognitive Load (작업기억 ~4, 세션 30~50) 정합

**보존**:
- 게이트 (P1), composite 식 (P2), `select_*_vocab` 본문 무변동
- 기존 set 존재 시 `CONTINUE` 정책 (옵션 B 결정 = 재발행 보류)
- 기존 259 published sets word_count 영향 0

**다음** (handoff):
- P4 단일 코어 통합 (C5)
- P5b/P5c, P6 후행

### P2 — composite 재설계 (v06.79 · C1·C2)

P5a (freq_rank 백필 22.7→64.1%) 직후. P0 측정 C1 (salience 가중 ~9% · 챕터 max 정규화 부재) + C2 (rank NULL→50000 동점) 해결.

**새 식** (handoff §P2-2, 가중치 합 1.0 · book/article 동일):

```
score =
    0.40 * freq_global       -- 1/log10(rank+10), rank NULL → 0 (50000 폐지)
  + 0.35 * salience_inbook    -- freq_in_chapter / MAX(freq) OVER (PARTITION BY chapter_idx)
  + 0.15 * csat_band_fit      -- V6~9 → 1.0, V10 → 0.6, V11 → 0.4
  + 0.10 * quality_bonus      -- verified OR example_en 존재 → 1, else 0
  - skill_penalty             -- 기존 (skill_level=4 AND book_v_level<6 → -0.10)
```

**변경** (migration [20260620050000_p2_composite_redesign](../supabase/migrations/20260620050000_p2_composite_redesign.sql)):
- `cand` CTE 에 `sd.verified` 추가
- 신규 `norm` CTE — `MAX(freq_in_chapter) OVER (PARTITION BY chapter_idx)` (article 은 전역 MAX)
- 새 가중 4항 + skill penalty
- 게이트 (`v_level >= 6`), register exclude, DISTINCT/sort, cap 없음 (P3 분리) 보존

**실측 효과** (Les Misérables):
- NULL-rank 1,643 단어 distinct composite: 5 → **46** (9.2배, C2 해결)
- 전체 distinct: 643 → **1,677** (2.6배, 평균 동점 11.6 → 4.46)
- 챕터 1 상위: **bishop V8 freq=4** (1장 핵심 = Monsieur Myriel 주교) ✓
- published 5권 추출 회귀 0

**누적 진행 (handoff)**:
- ✅ P0 진단 → ✅ P1 게이트 디커플 → ✅ P5a freq_rank 백필 → ✅ P2 composite 재설계
- ⏳ P3 cap N=40 (C4) — 다음
- ⏳ P4 단일 코어 통합 (C5)
- ⏳ P5b/P5c, P6 (후행)

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
