# Design System

> Vocaflow 디자인 시스템 SSoT. Quizlet Parts Kit v06 분석 기반, 영어 학습앱 최적화.
> CSS Variables · 폰트 · 컴포넌트 패턴 · 모션 · 접근성 통합. 작성 시점: 2026-06-08.
>
> **토큰 위치**: `packages/design-tokens/src/colors.ts` (앱·웹 공유) + `apps/web/src/app/globals.css` (웹 전용 보충).

---

## 디자인 철학 4개

| # | 원칙 | 의미 | 구현 예시 |
|---|---|---|---|
| 1 | **Calm UI** | 학습 중 시각·청각 자극 최소화. 광고·뱃지 알림·과한 애니메이션 금지 | 집중 모드 30초 무활동 진입 · sidebar dim · 정답 spring 한정 |
| 2 | **Progressive Disclosure** | 본질만 먼저 노출, 깊이는 사용자 요청 시 | 단어 hover/click → RecallCard · 인사이트 패널 토글 · ContinueCard 미리보기 |
| 3 | **Empathetic Feedback** | 비난·압박 대신 격려·맥락. Lora italic 으로 "사람의 말투" | "20분의 깊은 시간" · "Page 3까지 왔어요" · 오답 "다시 만나봐요" |
| 4 | **Implicit Progress** | 숫자 게이지보다 환경 변화로 성장 시각화 | Streak 카운터 · WeeklyHeatmap · Memory Decay 색 변화 · 1.5px 얇은 바 |

---

## 학습 과학 원칙 7개

| # | 원칙 | 근거 | 구현 위치 |
|---|---|---|---|
| 1 | **Active Recall** | Karpicke & Roediger 2008 | RecallCard 3단계 · Flashcard 양방향 · SpellForge 타이핑 · Dictation 단어별 채점 |
| 2 | **Spaced Repetition** | Ebbinghaus + SM-2 → FSRS | `ts-fsrs` 패키지 + `lib/srs/state.ts` (R(t)→4색) · "오늘 만나주세요" risk surface |
| 3 | **Desirable Difficulty** | Bjork — 약간의 인지적 분투 | SpellForge 보기 X · Flashcard 답 확인 전 회상 · Dictation random 순서 |
| 4 | **Dual Coding** | Paivio — 언어 + 시각·청각 | TTS + 영어 + 한글 동시 · Lora (영어 serif) vs DM Sans (한글) |
| 5 | **Context-Dependent** | 단어를 학습한 맥락 | `/text/[id]` 워크스페이스 hover · 단어장 항상 `exampleEn` 결합 |
| 6 | **Cognitive Load** | Sweller — 작업기억 ~4 항목 | 한 번에 한 단어 (Flashcard) · ModuleCard 7개 · Dictation Phonological Loop 보호 |
| 7 | **Emotional Encoding** | 도파민 보상 + 자기효능감 → 해마 기억 | Streak `s2` 폰트 · 정답 spring · 친근한 격려 · 보라/금빛 보상색 |

---

## Typography

### 폰트 체계 (Quizlet Hurme Geometric Sans 대안)

```
Display / UI  : 'Plus Jakarta Sans'  — Geometric Sans, 무료 Google Fonts
Body          : 'DM Sans'            — 깔끔한 산세리프
영어 스크립트     : 'Lora'               — 가독성 우수 세리프, 영어 본문 전용
코드 / 게임   : 'JetBrains Mono'     — SpellForge 스펠링 셀 / WordBlitz HUD
```

**⚠ 절대 사용 금지: Inter · Roboto · Arial**

### Google Fonts Import

```html
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
```

### Tailwind Config (`apps/web/tailwind.config.ts`)

```js
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

Body (DM Sans):
body-1:          16px / 400 / 1.6           — 기본 본문
body-1-semi:     16px / 600 / 1.6           — 강조 본문
body-2:          14px / 400 / 1.5           — 보조 본문
body-3:          13px / 400 / 1.5           — 캡션
body-3-oblique:  13px / 400 / italic
body-4:          12px / 400 / 1.5           — 최소 텍스트

영어 (Lora Serif):
english-body:      20px / 400 / 1.8     — 스크립트 읽기 영역
english-highlight: 20px / 400 / 1.8 / bg: --p-light
english-word:      18px / 600

Special:
s1:  14px / 700 / UPPERCASE / tracking 0.10em  — 섹션 레이블
s2:  40px / 800 / 1.1                          — 히어로/점수 대형
s3:  16px / 400
s4:  14px / 400
```

---

## CSS Variables (SSoT 축약형)

위치: `apps/web/src/app/globals.css` `@layer base { :root { ... } }`.

```css
:root {
  /* Brand */
  --p:       #3B82F6;   /* primary — 메인 인터랙티브 */
  --p-hover: #2563EB;
  --p-light: #EFF6FF;
  --p-dark:  #1D4ED8;

  /* Active (Quizlet yellow 역할) */
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
  --bg2: #F8FAFC;   /* 카드/섹션 */
  --bg3: #F1F5F9;   /* 입력 필드 */

  /* Text */
  --t1: #0F172A;   /* 기본 */
  --t2: #475569;   /* 보조 */
  --t3: #94A3B8;   /* 비활성 */
  --t4: #CBD5E1;   /* 완전 비활성 */
  --ti: #FFFFFF;   /* 반전 (어두운 배경 위) */

  /* Border */
  --bd:  #E2E8F0;
  --bdf: #3B82F6;   /* focus */
  --bde: #EF4444;   /* error */

  /* Game Specific — 변경 금지 */
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

### 게임 전용 하드코딩 색상 (예외)

```css
/* ── WordBlitz 정글 전용 — 변경 금지 ── */
#FFE234  /* 황금 점수 텍스트 */
#3d8a3d  /* 정글 배경 기본 그린 */

/* ── Flashcard 카드 gradient — 변경 금지 ── */
앞면: #FFFDE7 → #FFF9C4 → #FFF59D
뒷면: #E8F5E9 → #C8E6C9 → #A5D6A7

/* ── SpellForge 파란 패널 — 변경 금지 ── */
#4A9FCF  /* 패널 메인 */
#3A7FAF  /* 패널 다크 */

/* ── PairFlip Editorial — 변경 금지 ── */
#1E3A8A → #1E1B4B  /* 네이비/인디고 그라디언트 */
#F59E0B            /* 골드 */
```

---

## Memory Decay 색 체계 (앱 전용)

위치: `globals.css` (앱 도메인 토큰). 4단계는 **모든 학습 모듈에서 동일** — 상태 일관성이 학습자 멘탈 모델의 핵심.

| 상태 | 토큰 | 색 | 인식 | 표현 |
|---|---|---|---|---|
| stable | `--memory-stable` | `#22C55E` | "이건 알아요" | 1px solid border-bottom |
| shaky | `--memory-shaky` | `#F59E0B` | "익숙해요 (가끔 헷갈림)" | 1.5px dashed border-bottom |
| risk | `--memory-risk` | `#EF4444` | "흐릿해요 — 즉시 복습" | 1.5px dashed + `word-pulse` 애니메이션 |
| new | `--memory-new` | `#94A3B8` | "처음 만나는 단어" | gradient 하이라이트 (배경 65~100%) |

---

## CEFR 분포 색 (v06.19)

`--cefr-a1 ~ c2` + 다크모드 변형. WordVault hub `CEFRDistribution` 6 막대 전용. badge 토큰 `--cefr-A1-bg` 와 별개.

```css
--cefr-a1: #86EFAC;
--cefr-a2: #22C55E;
--cefr-b1: #3B82F6;
--cefr-b2: #1D4ED8;
--cefr-c1: #7C3AED;
--cefr-c2: #581C87;
```

---

## Spacing — 4px 기반

```
--s-0:   0px
--s-1:   4px    — 아이콘 내부 패딩
--s-2:   8px    — 버튼 내부 최소
--s-3:   12px   — 작은 컴포넌트
--s-4:   16px   — 기본 패딩 ★
--s-5:   20px
--s-6:   24px   — 카드 내부 패딩 ★
--s-8:   32px   — 섹션 간격
--s-10:  40px
--s-12:  48px   — 페이지 상하
--s-16:  64px   — 히어로
```

## Elevation 사용 규칙

```
카드 기본:   --sh-sm
카드 호버:   --sh-md
드롭다운:    --sh-lg
모달:        --sh-xl
툴팁:        --sh-md
```

## Border Radius

```
--r-sm:   6px    — 입력 필드, 작은 버튼, 태그
--r-md:   8px    — 버튼, 배지, 셀렉트
--r-lg:   12px   — 카드, 드롭다운
--r-xl:   16px   — 모달, 큰 카드, 바텀시트
--r-2xl:  24px   — 플래시카드, 팝업
--r-full: 9999px — 아이콘 버튼, 뱃지, 아바타, 진행바
```

## Motion 사용 매핑

```
버튼 호버:      transition: all var(--dur-normal) var(--ease)
카드 뒤집기:    rotateY(180deg), 0.55s var(--ease)
정답 피드백:    scale(1.05)→scale(1), --dur-slow, --ease-spring
오답 피드백:    translateX shake 3회, --dur-slow
페이지 전환:    opacity 0→1 + translateY 20→0, stagger 50ms
진행률 바:      width 전환, --dur-slow, --ease-out
점수 카운트업:  0→실제값, 1s, --ease-out
```

---

## Breakpoints — v6 확정

> SSoT: **390 / 768 / 1280px** (v5의 640/1024px 폐기)

```
mobile:   390px    — 1열, 앱 셸 max-width: 480px
tablet:   768px    — 2열 가능
desktop:  1280px   — 최대 너비

콘텐츠 max: max-w-2xl (672px) — 학습 콘텐츠
페이지 max: max-w-6xl (1152px) — 대시보드
```

### Tailwind Config

```js
screens: {
  'sm':  '390px',
  'md':  '768px',
  'lg':  '1280px',
}
```

---

## 컴포넌트 패턴

### Button — 8종

```jsx
/* Primary */
"bg-[var(--p)] text-[var(--ti)] px-6 py-3 rounded-[var(--r-md)]
 font-display font-[600] hover:bg-[var(--p-hover)] active:scale-[0.97]
 transition-all duration-[var(--dur-normal)]"

/* Secondary */
"border-2 border-[var(--p)] text-[var(--p)] bg-transparent"

/* Danger */
"bg-[var(--error)] text-[var(--ti)]"

/* Ghost */
"bg-[var(--bg3)] text-[var(--t1)] hover:bg-[var(--bd)]"

/* Icon */
"w-10 h-10 rounded-full flex items-center justify-center
 bg-[var(--p-light)] text-[var(--p)]"

/* Link */
"text-[var(--p)] font-[600] uppercase tracking-wider text-sm hover:underline"

/* Social (Google) */
"w-full border border-[var(--bd)] rounded-[var(--r-md)] px-6 py-3
 flex items-center justify-center gap-3 hover:bg-[var(--bg3)]"

/* Text Link */
"text-[var(--p)] font-[500] underline hover:text-[var(--p-dark)]"

크기 변형:
btn-sm:  px-4 py-2 text-sm rounded-[var(--r-sm)]
btn-md:  px-6 py-3 text-base rounded-[var(--r-md)]  /* 기본 */
btn-lg:  px-8 py-4 text-lg rounded-[var(--r-lg)]
```

### Form Field

```jsx
/* Default */
"w-full px-4 py-3 border border-[var(--bd)] rounded-[var(--r-md)]
 bg-[var(--bg)] text-[var(--t1)] placeholder:text-[var(--t3)]
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
```

### Toast

```jsx
성공: "bg-[var(--success-light)] border-l-[3.5px] border-[var(--success)]"
에러: "bg-[var(--error-light)] border-l-[3.5px] border-[var(--error)]"
정보: "bg-[var(--info-light)] border-l-[3.5px] border-[var(--info)]"
경고: "bg-[var(--warning-light)] border-l-[3.5px] border-[var(--warning)]"

위치: 화면 상단 중앙 fixed / auto-dismiss 3초
```

### Badge

```jsx
"inline-flex items-center font-body text-[11px] font-[600]
 px-2.5 py-0.5 rounded-[var(--r-full)]"

green: bg-[var(--success-light)] text-[#065f46]
blue:  bg-[var(--p-light)] text-[var(--p)]
gray:  bg-[var(--bg3)] text-[var(--t3)]
```

---

## Icons — Lucide React (v1.11)

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
네비게이션:  size={24}
버튼 내:    size={20}
인라인:     size={16}
대형 표시:  size={32}
색상: currentColor 상속
```

---

## 접근성 / 안티패턴

### 접근성 필수
- 모든 인터랙티브 ≥ 44×44 (Fitts's Law)
- WCAG AA 대비 (focus-visible:ring)
- 색상 + 형태 + 텍스트 3중 표현 (색맹 대응)
- `aria-label` / `role` / `aria-live` 적절 사용
- 키보드 네비게이션 (Tab / Esc / Enter / Space / Alt+화살표)

### 안티패턴 (절대 금지)
- 정답률 빨간 글씨 압박 ("정확도 67% 😢")
- 모달 오버레이로 학습 중단 ("3일 연속 학습이 끊겼어요!")
- "오답"을 부정적 색만으로 표시 — 색맹 + 정서 위반
- "Are you still there?" inactivity 도발
- 학습 흐름 중 광고·업셀 모달
- 진행률 100% 도달 시 폭죽·트로피 — 차분한 "오늘 잘 마쳤어요" 선호

### PR 자가 점검 (머지 전)
- [ ] 학습 과학 원칙 중 최소 1개에 명시적 기여?
- [ ] Calm UI 위반 없는가? (색·소리·애니메이션 과잉)
- [ ] 회상 부담을 명시적으로 만드는가?
- [ ] 실패가 비난적이지 않은가?
- [ ] 진행을 환경으로 보여주는가?
- [ ] 맥락을 보존하는가? (단어는 스크립트/예문과 결합)
