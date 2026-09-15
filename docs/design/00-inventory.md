# 00 — 현황 진단 (학습자 앱)

측정일 **2026-09-16** · 대상 `app/(main)` + `app/(app)` 학습자 라우트 **70개** · 관리자(`/admin`) 제외
측정 방법: 파일시스템 실계수 + 실행 중 dev 서버(localhost:3000)에 **로그인한 상태**로 Playwright 실측.
문서의 수치를 근거로 쓰지 않는다(CLAUDE.md §4️⃣ 근거 규칙) — 아래 숫자는 전부 이 날 직접 잰 값이다.

---

## 0-1. 먼저, 의뢰서의 진단을 실측으로 검증한다

의뢰서는 현재 UI 를 이렇게 적었다 — "흰 카드 + **연보라 포인트**, 균일한 라운드, **시스템 폰트**".
셋 중 **하나는 틀렸고 둘은 맞다.** 틀린 것을 그대로 고치면 엉뚱한 곳을 손대게 되므로 먼저 가른다.

| 의뢰서의 진단 | 실측 | 판정 |
|---|---|---|
| 연보라(violet/purple) 포인트 | ~~학습자 표면에서 `purple-*` 6회 · `violet-*` 0회 · `indigo-*` 0회~~ → **아래 정정** | ⚠️ **처음에 「틀렸다」고 적었는데, 그 판단이 틀렸다** |
| 흰 카드 | 카드 면은 흰색이 아니라 크림 `#FBFAF6` / `#F4F0E9`. **하지만 형태는 정확히 그 지적대로다** — 아래 0-3 | ⚠️ **색은 아니고 형태는 맞다** |
| 시스템 폰트 | **정확하다. 그리고 생각보다 심각하다** — 아래 0-2 | ✅ 맞다 |

### ⚠️ 0-1-1. 정정 (같은 날 늦게) — 「연보라」는 실제로 있었다. 내 계수가 틀렸다

위 판정은 **Tailwind 클래스 이름만 세고 CSS 토큰을 보지 않았다.** 보라는 클래스가 아니라
**토큰으로** 살아 있었다:

| 토큰 | 값 | 어디에 |
|---|---|---|
| `--learn-mastered` | `#8B5CF6` (violet-500) | 학습 단계 "정복" — 학습자 표면 **30곳** |
| `--learn-mastered-ink` | `#7C3AED` | 같은 계열 글자색 |
| `--level-c` | `#8B5CF6` | CEFR C 레벨 칩 (`/wordvault/browse` 행마다) |
| 하드코딩 | `#8B5CF6` | `/settings` 「외형」 섹션 액센트 · `dashboard/RecentActivity` 모듈색 2건 |

게다가 그중 **둘은 파랑 → 보라 그라데이션**이었다
(`wordvault/ListenPanel.tsx:227` · `wordvault/StudyMode.tsx:199`,
`linear-gradient(90deg, var(--learn-fresh), var(--learn-mastered))`).
「AI-보라 그라데이션」은 `.claude/skills/vocaflow-design` §2 가 **이름 대어 금지**한 것이다.

> **의뢰인의 눈이 맞았고 내 측정 방법이 틀렸다.** 교훈: 색을 셀 때 **클래스 이름으로 세면 안 된다.**
> 이 저장소는 「색상 하드코딩 금지」를 잘 지켜서 색이 전부 토큰 뒤에 있고, 그래서 **grep 으로는
> 안 보인다.** 실행 중 화면의 `getComputedStyle` 로 재야 한다(그래서 `measure-identity.mjs` 는
> 소스가 아니라 그려진 결과를 본다).
>
> 조치: 학습 단계 5색·CEFR 3색·모듈색을 전부 **지면 팔레트**로 옮기고("정복" 은 가장 깊은 잉크),
> 파랑→보라 그라데이션 2곳을 단색 채움으로 바꿨다. 상세는 `03-system.md` §3-2.

> 요약: 팔레트는 "Reading Room"(종이·잉크·금) 방향을 갖고 있었지만 **그 방향 밖의 원색이
> 토큰 뒤에 남아 있었다**(보라·형광 핑크·시안). 거기에 더해
> ① 한글에 글꼴이 없고 ② 형태 언어가 한 종류뿐이고 ③ 브랜드 자산이 0개다.

---

## 0-2. 가장 큰 결함 — **화면 글자의 절반~4분의 3이 디자인되지 않은 글꼴로 나온다**

`app/layout.tsx` 가 로드하는 웹폰트는 4종이며 **전부 `subsets: ["latin"]`** 이다.

| 폰트 | 역할 | subset |
|---|---|---|
| Plus Jakarta Sans | `font-display` (UI 라벨·내비·소제목) | latin |
| DM Sans | `font-body` (본문) | latin |
| Lora | `font-editorial` / `font-english` (영어 원문·헤드라인) | latin |
| JetBrains Mono | `font-mono` | latin |

한글 웹폰트는 **한 벌도 없다.** `lib/seo/og-font.ts` 의 Noto Sans KR 은 **OG 이미지 서버 렌더 전용**이라
브라우저 UI 에 닿지 않는다.

### 실측 (Playwright, 로그인 상태, 1440×900)

`/dashboard` 본문 텍스트 노드 **144개 중 한글 108개(75%)**.
그 108개가 선언한 `font-family` 스택을 세니 — **100%가 라틴 전용 스택**이었다:

```
65 노드 | DM Sans → -apple-system → system-ui → sans-serif
31 노드 | Plus Jakarta Sans → -apple-system → system-ui → sans-serif
27 노드 | JetBrains Mono → SF Mono → ui-monospace → monospace   ← 한글이 모노 폴백으로 간다
 8 노드 | Lora → Iowan Old Style → Georgia → serif
```

한글 글리프가 없으므로 브라우저는 **OS 기본 한글꼴**로 떨어진다 — Windows 맑은 고딕 · macOS Apple SD
Gothic Neo · Android Noto Sans CJK. 즉 **같은 화면이 기기마다 다른 얼굴**이고, 어느 기기에서도
"우리가 고른 얼굴"이 아니다. 27개 노드는 한술 더 떠 **모노스페이스 폴백**으로 간다(자간이 무너진다).

라우트별 한글 비율(실측):

| 라우트 | 텍스트 노드 | 한글 | 비율 |
|---|---|---|---|
| `/dashboard` | 144 | 108 | **75%** |
| `/hub` | 44 | 22 | 50% |
| `/flashcard/play` | 93 | 45 | 48% |
| `/wordvault/browse` | 476 | 107 | 22% (영어 표제어가 많은 화면) |

> **이것이 "어디서나 본 템플릿 느낌"의 1차 원인이다.** 화면에서 개성을 담당해야 할 글자의
> 절반~4분의 3이 OS 기본값으로 나오고 있다. 소스에는 `font-display` 1,193회 · `font-body` 848회가
> 적혀 있지만, 한글에 대해서는 **그 2,041번의 지정이 전부 무효**다.

### 곁가지 — 시그니처 자산이 가장 적게 쓰인다
Lora 는 이 서비스가 가진 유일한 개성 자산인데 학습자 표면에서 `font-editorial` 73회 + `font-english`
268회 = **341회**, `font-display`+`font-body`(2,041회)의 **14%** 에 그친다.

---

## 0-3. 두 번째 결함 — 형태 언어가 **한 종류**다

학습자 `.tsx` **447개**를 훑어 인라인 표면 클래스를 셌다:

| 패턴 | 출현 |
|---|---|
| `border-[var(--bd)]` | **681** |
| `rounded-[var(--r-md)]` (8px) | **484** |
| `rounded-[var(--r-full)]` | 223 |
| `rounded-[var(--r-lg)]` (12px) | 172 |
| `bg-[var(--bg)]` / `bg-[var(--bg2)]` | 404 / 382 |
| `shadow-[var(--sh-*)]` | 235 |

실행 화면에서도 같은 결론이 나온다(60×28px 이상 박스 기준):

| 라우트 | 둥근 박스 | 서로 다른 radius | 서로 다른 배경색 |
|---|---|---|---|
| `/hub` | 13 | 4 | 4 |
| `/dashboard` | 10 | 4 | 3 |
| `/wordvault/browse` | 19 | 4 | 3 |
| `/flashcard/play` | 12 | 4 | 3 |

**모든 화면이 "크림 바탕 + 1px 헤어라인 테두리 + 8/12/24px 라운드 + 약한 그림자" 한 가지로 그려진다.**
위계는 오직 글자 크기로만 만들어진다. 카드 열 장을 세로로 쌓으면 열 장이 전부 같은 무게다 —
이게 템플릿처럼 보이는 두 번째 원인이다.

### 공용 프리미티브가 실질적으로 안 쓰인다
`components/ui/Card.tsx` 는 shadcn 형태 그대로다(`rounded-lg` + `border` + `shadow-md` +
`CardHeader/Title/Description/Content/Footer`). 그런데 **학습자 표면 447파일 중 이 Card 를 import 하는
파일은 5개**뿐이다. 나머지는 전부 손으로 같은 세 클래스를 다시 적는다.

> 즉 **"공유 디자인 시스템이 있어서 똑같은" 것이 아니라, 없어서 각자 같은 기본값으로 수렴한 것**이다.
> 토큰 한 곳을 바꿔도 화면이 안 따라오는 구조이기도 하다.

---

## 0-4. 세 번째 결함 — 색이 없다 (측정치)

`/dashboard` 본문 텍스트 노드 144개의 글자색 분포(실측):

| 색 | 노드 수 | 정체 |
|---|---|---|
| `rgb(26,23,20)` | 61 | `--t1` 잉크 |
| `rgba(26,23,20,.74)` | 49 | `--t2` 같은 잉크 74% |
| `rgba(26,23,20,.62)` | 26 | `--t3` 같은 잉크 62% |
| `rgb(15,37,64)` | 8 | `--p` deep ink |

**136/144 = 94%가 같은 잉크 한 색의 알파 3단계**다. 브랜드 액센트인 muted gold(`--active #B0843A`)를
글자로 쓴 노드는 **0개**. 배경은 `#FBFAF6` / `#F4F0E9` 두 크림이 전부.

Calm UI 원칙의 결과물이지만, **차분함과 무기억성은 다르다.** 스크린샷 한 장으로 알아볼 수 있으려면
"이 서비스의 색" 이 최소 한 개는 화면에 **면적으로** 있어야 하는데 지금은 없다.

---

## 0-5. 네 번째 결함 — 브랜드 자산 **0개**

`apps/web/public/` 전체에서 이미지·일러스트·로고·패턴·텍스처 파일 수: **0**.
(있는 것은 게임 BGM 20종 · 효과음 6종 · ONNX 런타임 · 만화 리더용 리소스뿐이다.)

아이콘은 전량 **lucide-react** — 학습자 표면 **202파일**에서 import, 서로 다른 아이콘 **220종**.
lucide 는 지금 이 순간 전 세계 AI 생성 UI 가 공통으로 쓰는 세트다. 아이콘 220개가 전부 같은 손글씨라면
**그 화면의 손글씨는 우리 것이 아니다.**

---

## 0-6. 레이아웃 셸 · 화면 목록

### 셸 (`app/(main)/layout.tsx`)
| 요소 | 파일 | 폭 |
|---|---|---|
| 사이드바 | `components/layout/Sidebar.tsx` | `hidden md:flex` |
| 모바일 유틸리티 바 | `components/layout/MobileUtilityBar.tsx` | < md |
| 상태 띠(나침반) | `components/layout/CompassRibbon.tsx` | 전 폭 |
| 세션 프레임 | `components/layout/SessionFrame.tsx` | 전 폭 |
| 하단 탭 | `components/layout/MobileTabBar.tsx` (`--tabbar-h` 56px) | < md |
| 나의 자리 패널 | `components/layout/WayfinderPanel.tsx` | 펼침 |

풀스크린 세션(`lib/layout/full-screen-routes`)은 사이드바·탭바 없이 `SessionFrame` 만 쓴다 —
`(app)/play/*` 19종 + 학습 세션.

### 공용 컴포넌트 (`components/ui/`, 32파일)
`Badge · Button · ButtonGroup · Card · Checkbox · EmptyState · FormField · Input · LoadingOverlay ·
MemoryBadge · Modal · ProgressBar · Radio · Select · Skeleton · Textarea · Toast · Toggle · Tooltip ·
ZoomableImage` + `ui/ios/` (Screen · Frame · Capsule · StatPill · SegmentControl …)

### 도메인 컴포넌트 (관리자 제외 상위)
`library 59 · game 34 · ui 32 · wordvault 25 · workspace 18 · pairflip 17 · layout 13 · flashcard 13 ·
home 11 · text-viewer 10 · spellforge 10 · csat 10 · textfit 9 · textviewer 8 · comic 8 · echo 7 ·
dashboard 7` (합계 학습자 `.tsx` **447**)

### 라우트 70개 (실계수)
```
/arcade /arcade/ranking /comics /comics/adapted /comics/restored
/csat /csat/drill /csat/map /csat/overlay /csat/patterns /csat/plan /csat/predict
/dashboard /diagnostic /diagnostic/history
/dictate /dictate/results /dictate/session /dictate/setup
/flashcard /flashcard/play /hub
/library /library/books /library/scripts /library/textbooks /library/vocab
/my /my/books /my/texts /my/words
/pairflip /pairflip/play /pairflip/results /plan
/play/* (19종: cascade connections daily-blitz ghost-race glyph-tongue letter-forge
         lexicon-detective lexicon-estate lexicon-hands morpheme-rules morphmerge
         pirate-quest silent-rule word-customs word-economy word-orrery wordblitz
         wordfall-cadence wordsmith-vigil)
/practice /practice/dcp /reports /scriptquiz /scriptquiz/play /settings /sitemap
/spellforge /spellforge/play /text /text/new /wordblitz
/wordvault /wordvault/browse /wordvault/review /wordvault/study
```

---

## 0-7. 현재 토큰 (SSoT `packages/design-tokens/src/tokens.css`, 463줄)

| 축 | 값 |
|---|---|
| 브랜드 | `--p #0F2540` deep ink · `--p-light #E3E8EE` · `--active #B0843A` muted gold |
| 지면 | `--bg #FBFAF6` · `--bg2 #F4F0E9` · `--bg3 #ECE6DA` |
| 잉크 | `--t1 #1A1714` · `--t2` .74 · `--t3` .62 · `--t4` .20 |
| 테두리 | `--bd #E0DBD0` (헤어라인) |
| 시맨틱 | success `#2E7D5A` · error `#9C3A30` · warning `#B5803A` · info `#50697F` (+ `*-ink` 쌍) |
| radius | legacy 6/8/12/16/24 + iOS 6/8/12/14/18/24/32/38 — **두 스케일이 공존** |
| 그림자 | legacy `--sh-xs~xl` + iOS `--sh-ios-1~4` + glow 5종 — **역시 두 벌** |
| 모션 | `--dur-fast 100 / normal 200 / slow 300 / slower 500` · `--ease cubic-bezier(.4,0,.2,1)` |
| 간격 | 4px 기반 `--s-0~16` |

추가로 `app/globals.css` 에 학습 도메인 토큰(`--learn-*` · `--memory-*` · `--srs-*` · `--slot-*` ·
`--track-*` · `--cefr-*`)이 산다. 접근성 대비는 이미 여러 차례 실측·교정된 상태다(`*-ink` 짝).

> **토큰의 문제는 값이 아니라 "두 벌"이라는 것이다** — legacy radius/shadow 와 iOS radius/shadow 가
> 동시에 살아 있어서, 화면마다 어느 쪽을 집는지가 다르고 그래서 8px·12px·18px·24px 이 한 화면에
> 섞인다(0-3 실측). 방향을 새로 잡을 때 **하나로 접어야 한다.**

---

## 0-8. "Claude 기본 산출물 스타일" 을 만드는 요소 — 구체 지목

| # | 요소 | 위치 | 근거 수치 |
|---|---|---|---|
| C1 | **한글에 글꼴이 없다** | `app/layout.tsx` 폰트 4종 전부 latin subset | 화면 글자의 48~75%가 OS 기본꼴 |
| C2 | **균일 라운드 카드 스택** | 학습자 447파일에 인라인으로 반복 | `border-[var(--bd)]` 681 · `rounded-md` 484 |
| C3 | **shadcn 형 Card 프리미티브** | `components/ui/Card.tsx` | `rounded-lg`+`border`+`shadow-md`+5 서브컴포넌트 |
| C4 | **lucide 아이콘 단일 세트** | 202파일 · 220종 | 브랜드 아이콘 0 |
| C5 | **색 없음(잉크 1색 3알파)** | 전 화면 | `/dashboard` 글자색 94%가 동일 잉크 |
| C6 | **브랜드 자산 0** | `public/` | 이미지·로고·패턴 파일 0개 |
| C7 | **radius/shadow 두 벌 공존** | `tokens.css` | 한 화면에 4가지 radius |
| C8 | **작은 대문자 트래킹 섹션 라벨** | `home/*`, `dashboard/*` | 템플릿 관용구 |
| C9 | 떠돌이 indigo-600 | `/wordvault/browse` 실측 `rgb(79,70,229)` | 1건 |

---

## 0-9. 다음 단계가 손댈 곳 (레버리지 순)

1. **한글 글꼴 도입** — 한 곳(`app/layout.tsx` + `tailwind.config.ts` 폰트 스택) 수정으로
   70 라우트 전부의 글자 절반 이상이 바뀐다. 레버리지 압도적 1위.
2. **형태 언어 재정의** — 토큰 한 벌로 접고, 카드 이외의 표면 어휘(괘선·판면·탭·여백)를 만든다.
3. **색 시그니처 1개** — 면적으로 존재하는 색. Calm UI 를 깨지 않는 범위에서.
4. **아이콘/자산** — lucide 를 전량 교체하는 것은 5시간 예산 밖이다. **핵심 20개만 커스텀**하고
   나머지는 스타일 규칙(굵기·크기·컨테이너 금지)으로 묶는다.

측정 산출물: `docs/design/shots/before/` (캡처 하네스 `scripts/design/capture-learner.mjs`)
