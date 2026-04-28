# Vocaflow — CLAUDE.md
# English Learning App · Design System · Single Source of Truth

> Quizlet Parts Kit v06 분석 기반, 영어 학습앱에 최적화된 디자인 시스템  
> **이 문서는 모든 컴포넌트 구현의 단일 기준(Single Source of Truth)입니다.**  
> 기술스택: Next.js 14 (App Router) · React Native (Expo) · Tailwind · Supabase · OpenAI · Vercel · Railway  
> **문서 버전: v06.4** (§14 Home Hub 신설 — HubHero / ModuleCard / RecentTextCard · components/home/ 폴더 추가 · F-pattern 시선 흐름 레이아웃 정의)

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
- **목적**: 영어 원문(스크립트) 기반 종합 학습 플랫폼
- **기술스택**: Next.js 14 (App Router) · React Native (Expo) · Tailwind CSS · Supabase · OpenAI · Vercel · Railway
- **타겟**: 영어 학습자 (한국 고등학생~성인)
- **플랫폼**: 웹(데스크톱+모바일 브라우저) + iOS/Android 앱 동시 지원

### 핵심 모듈 7개

| 모듈 | 설명 | 상태 |
|------|------|------|
| **TextViewer** | 원문 입력(직접입력·PDF·DOCX·TXT·URL), 전체/Step 듣기 | 설계 완료 |
| **WordVault** | 단어장 생성 — AI 분석 → 단어/뜻/예문/TTS | 설계 완료 |
| **Flashcard** | SM-2 SRS 플래시카드 · 하늘 배경 환경 · 양방향 모드 | HTML 완성 |
| **SpellForge** | 스펠링 타이핑 게임 · 파란 패널 테마 | HTML 완성 |
| **WordBlitz** | 타임어택 선택 게임 · 정글 어드벤처 테마 | HTML 완성 |
| **ScriptQuiz** | 원문 독해 퀴즈 · AI 자동 생성 · 3-screen flow | HTML 완성 |
| **Dashboard** | 학습 통계 · 진행률 · 점수 · 히트맵 | **설계 완료 (v6 신규)** |

---

## 🔤 Typography

### 폰트 체계 (Quizlet Hurme Geometric Sans 대안)

```
Display / UI  : 'Plus Jakarta Sans'  — Geometric Sans, 무료 Google Fonts
Body          : 'DM Sans'            — 깔끔한 산세리프, 무료
영어 원문     : 'Lora'               — 가독성 우수 세리프, 영어 원문 전용
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

### 영어 원문 전용 (Lora Serif)

```
english-body:      20px / 400 / 1.8    — 원문 읽기 영역
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

/* 5개 탭: 📖 원문 | 📝 단어 | 🃏 카드 | 🎮 게임 | 📊 통계 */
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
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
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
│   │   ├── (main)/                           ← 로그인 후 앱 (라우트 그룹 — URL 비포함)
│   │   │   ├── layout.tsx                    ← 공통 레이아웃 + BottomTabBar
│   │   │   ├── hub/page.tsx                  ← Hub (Home+Dashboard 통합) ★ 진입점
│   │   │   ├── text/page.tsx                 ← TextViewer
│   │   │   ├── wordvault/page.tsx            ← WordVault 단어장
│   │   │   ├── flashcard/page.tsx
│   │   │   ├── spellforge/page.tsx
│   │   │   ├── wordblitz/page.tsx
│   │   │   ├── scriptquiz/page.tsx
│   │   │   └── settings/page.tsx             ← 계정·테마·TTS 설정
│   │   ├── api/                              ← Route Handlers
│   │   │   ├── auth/
│   │   │   │   └── callback/route.ts         ← Supabase OAuth 콜백 (필수)
│   │   │   ├── analyze/route.ts              ← OpenAI 단어 추출
│   │   │   ├── tts/route.ts                  ← OpenAI TTS-1
│   │   │   ├── quiz/route.ts                 ← ScriptQuiz 생성
│   │   │   ├── upload/route.ts               ← PDF·DOCX·TXT 업로드
│   │   │   └── health/route.ts               ← 헬스체크
│   │   ├── error.tsx                         ← 전역 에러
│   │   ├── not-found.tsx                     ← 404
│   │   ├── loading.tsx                       ← 전역 로딩
│   │   ├── globals.css                       ← CSS Variables (이 문서 §Colors)
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
│   │   │   ├── Header.tsx
│   │   │   ├── BottomTabBar.tsx
│   │   │   ├── Sidebar.tsx                   ← 데스크톱 전용
│   │   │   ├── PageContainer.tsx
│   │   │   └── Footer.tsx
│   │   ├── audio/
│   │   │   ├── AudioPlayer.tsx
│   │   │   └── PlayButton.tsx
│   │   ├── text-viewer/                      ← TextViewer 모듈 전용 (v06.1 분리)
│   │   │   ├── TextInputCard.tsx
│   │   │   ├── FileUploadCard.tsx
│   │   │   ├── UrlInputCard.tsx
│   │   │   ├── ScriptViewer.tsx
│   │   │   ├── SPBar.tsx                     ← 문장 플레이어
│   │   │   └── TTSSettingsCard.tsx
│   │   ├── wordvault/                        ← WordVault 단어장 전용
│   │   │   ├── HeroHeader.tsx
│   │   │   ├── VocabToolbar.tsx
│   │   │   ├── VocabTabBar.tsx
│   │   │   ├── WordList.tsx
│   │   │   ├── WordRow.tsx
│   │   │   ├── SpeakButton.tsx
│   │   │   └── ExampleBox.tsx
│   │   ├── game/                             ← 게임 모듈 (v06.1 하위 분리)
│   │   │   ├── shared/                       ← 게임 공통
│   │   │   │   ├── GameTimer.tsx
│   │   │   │   ├── ScoreCircle.tsx
│   │   │   │   ├── GameStartScreen.tsx
│   │   │   │   └── GameResultScreen.tsx
│   │   │   ├── flashcard/
│   │   │   │   ├── FlashCard.tsx
│   │   │   │   └── FlashcardEnv.tsx          ← 하늘 환경 배경
│   │   │   ├── spellforge/
│   │   │   │   ├── SpellForgeGrid.tsx
│   │   │   │   ├── SpellForgeCell.tsx
│   │   │   │   └── SpellForgePanel.tsx
│   │   │   ├── wordblitz/
│   │   │   │   ├── WordBlitzGame.tsx
│   │   │   │   ├── WordBlitzOption.tsx
│   │   │   │   └── WordBlitzReaction.tsx     ← 정글 환경
│   │   │   └── scriptquiz/
│   │   │       ├── ScriptQuizStart.tsx
│   │   │       ├── ScriptQuizQuestion.tsx
│   │   │       ├── ScriptQuizFeedback.tsx
│   │   │       └── ScriptQuizResult.tsx
│   │   ├── dashboard/                        ← Dashboard 전용
│   │   │   ├── StatCard.tsx
│   │   │   ├── WeeklyHeatmap.tsx
│   │   │   ├── ModuleAccuracyRing.tsx
│   │   │   ├── ScoreTrendChart.tsx
│   │   │   └── RecentActivity.tsx
│   │   ├── home/                             ← Home Hub 전용 (§14, v06.4)
│   │   │   ├── HubHero.tsx                   ← 인사 + Streak + Today CTA + inline Stats
│   │   │   ├── ModuleCard.tsx                ← 7모듈 정사각 카드 (아이콘·마지막 학습)
│   │   │   └── ContinueCard.tsx              ← 이어하기 (Lora 제목·진행률·CTA)
│   │   └── marketing/                        ← 랜딩/공개 페이지 전용
│   │       ├── HeroSection.tsx
│   │       ├── FeatureGrid.tsx
│   │       ├── PricingTable.tsx
│   │       ├── TestimonialList.tsx
│   │       └── FAQAccordion.tsx
│   ├── hooks/                                ← React 훅 (UI 연결용)
│   │   ├── useAuth.ts
│   │   ├── useVocabulary.ts
│   │   ├── useTTS.ts
│   │   ├── useGameScore.ts
│   │   ├── useDashboard.ts
│   │   ├── useSupabase.ts
│   │   ├── useTheme.ts                       ← 다크모드 토글
│   │   ├── useMediaQuery.ts                  ← 반응형 훅
│   │   └── useDebounce.ts
│   ├── stores/                               ← Zustand 전역 상태
│   │   ├── authStore.ts                      ← 사용자 세션
│   │   ├── themeStore.ts                     ← 다크/라이트
│   │   ├── wordVaultStore.ts                 ← 현재 단어장
│   │   ├── gameStore.ts                      ← 게임 진행 상태
│   │   └── settingsStore.ts                  ← TTS 속도·음성 등
│   ├── lib/                                  ← 외부 통합 + 유틸 (서버사이드 OK)
│   │   ├── supabase/
│   │   │   ├── client.ts                     ← 브라우저 클라이언트
│   │   │   ├── server.ts                     ← Server Component / Route Handler
│   │   │   ├── middleware.ts                 ← 세션 갱신
│   │   │   └── queries.ts                    ← 공통 쿼리
│   │   ├── openai/
│   │   │   ├── client.ts
│   │   │   ├── extractWords.ts               ← 단어 추출 프롬프트
│   │   │   ├── generateQuiz.ts               ← ScriptQuiz 프롬프트
│   │   │   └── tts.ts                        ← TTS-1 + Supabase Storage 캐싱
│   │   ├── parsers/                          ← 파일 파서
│   │   │   ├── pdf.ts                        ← pdf-parse
│   │   │   ├── docx.ts                       ← mammoth
│   │   │   ├── txt.ts
│   │   │   └── url.ts                        ← Phase 2 (예정)
│   │   ├── scoring/
│   │   │   ├── sm2.ts                        ← Flashcard SM-2 알고리즘
│   │   │   ├── spellforge.ts
│   │   │   ├── wordblitz.ts
│   │   │   └── scriptquiz.ts
│   │   ├── analytics/
│   │   │   ├── posthog.ts                    ← 또는 Plausible (선택)
│   │   │   └── events.ts
│   │   └── utils/
│   │       ├── cn.ts                         ← clsx + tailwind-merge
│   │       ├── format.ts                     ← 날짜·숫자 포맷
│   │       ├── validation.ts                 ← Zod 스키마
│   │       └── constants.ts
│   ├── types/                                ← TypeScript 타입
│   │   ├── database.ts                       ← Supabase 자동 생성
│   │   ├── api.ts                            ← API Route I/O
│   │   ├── game.ts
│   │   └── index.ts
│   ├── config/                               ← 환경별 설정
│   │   ├── site.ts                           ← 사이트 메타데이터
│   │   └── env.ts                            ← Zod 검증 환경변수
│   ├── styles/                               ← (선택) 추가 스타일
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
│   │   ├── openai/
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
├── ONBOARDING.md                             ← 신규 개발자 셋업
├── DEPLOY.md                                 ← Vercel + Railway + EAS 배포
├── API.md                                    ← API Route 명세
├── ARCHITECTURE.md                           ← 시스템 다이어그램
└── DESIGN_DECISIONS.md                       ← ADR (Architecture Decision Records)
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
        {/* 원문 제목: body-4 / text-muted */}
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
│     [원문][단어][카드][스펠][블리츠][퀴즈][통계]    │   정사각·아이콘·"마지막 학습"
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
  text:       { icon: '📖', label: '원문',       href: '/text',       color: 'var(--p)'      },
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

  {/* 제목 — Lora (영어 원문 폰트 직접 노출) */}
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

/* 빈 상태: "아직 학습한 원문이 없어요" + Primary CTA "원문 추가" → /text */
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
- 빈 상태: HubHero (review=0) / ContinueCard (원문 없음) 모두 정의
- 페이지 폭: `max-w-6xl` (1152px) — Dashboard와 동일 기준

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
/* 원문 제목 h2 / 챕터 h3 / 섹션 body-2 타이포 계층 */
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
/* 원문 근거 하이라이트: Lora italic */
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
다음 영어 원문을 읽고 독해 퀴즈 ${count}개를 생성하세요.

[규칙]
- 문제 유형: multiple(4지선다) 위주, truefalse(OX) 혼합
- 원문 내용 근거 문제만 출제 (추론 금지)
- 각 문제에 sourceSnippet(근거 문장) 포함
- 난이도: 내용 이해 70% + 세부 사항 30%
- 한국어로 문제 작성, 선택지 한국어

[출력 — JSON only]
{ "questions": [{ "type":"multiple","question":"...","options":[{"text":"..."}],"correctIndex":0,"sourceSnippet":"..." }] }

[원문]
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

## 🗄 Supabase DB 스키마

```sql
-- 원문
CREATE TABLE texts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 단어장
CREATE TABLE vocabularies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text_id UUID REFERENCES texts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  word TEXT NOT NULL,
  meaning TEXT NOT NULL,
  example_sentence TEXT,
  pronunciation TEXT,
  difficulty INT DEFAULT 0,   -- 0: 미학습, 1~5: 난이도
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 학습 기록
CREATE TABLE learning_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  vocabulary_id UUID REFERENCES vocabularies(id) ON DELETE CASCADE,
  module TEXT NOT NULL,       -- 'flashcard' | 'spellforge' | 'wordblitz' | 'scriptquiz'
  is_correct BOOLEAN NOT NULL,
  response_time_ms INT,
  attempted_at TIMESTAMPTZ DEFAULT now()
);

-- ScriptQuiz 문제 (AI 생성)
CREATE TABLE quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text_id UUID REFERENCES texts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  type TEXT NOT NULL DEFAULT 'multiple',
  question TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_index INT NOT NULL,
  source_snippet TEXT,
  source_sentence_idx INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 게임 점수
CREATE TABLE scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  text_id UUID REFERENCES texts(id),
  module TEXT NOT NULL,
  score INT NOT NULL,
  total_questions INT NOT NULL,
  accuracy DECIMAL(5,2),
  duration_seconds INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS 정책 (모든 테이블)
ALTER TABLE texts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE vocabularies     ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores           ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own data" ON texts            FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users see own data" ON vocabularies     FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users see own data" ON learning_records FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users see own data" ON quiz_questions   FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users see own data" ON scores           FOR ALL USING (auth.uid() = user_id);
```

---

## 📦 독립 레퍼런스 HTML 파일

> 완전 동작 프로토타입 — React 구현 시 CSS 변수명·클래스 구조·애니메이션·로직 기준으로 사용.  
> 모든 파일: `data-theme="dark"` 완전 지원 · 4종 폰트 역할별 적용 · 3-Screen flow

| 파일 | 줄수 | 핵심 구현 |
|------|------|-----------|
| `Flashcard.html` | 648줄 | 하늘환경·구름·잔디·레인보우로고·CSS 3D flip·양방향모드 |
| `SpellForge.html` | 811줄 | 파란패널·전구힌트바·JetBrains Mono 셀·파티클·자동입력 |
| `ScriptQuiz.html` | 1,027줄 | Little Fox 스타일·O/X 피드백·원문 하이라이트·SVG 링 |
| `WordBlitz_Jungle.html` | 1,020줄 | 정글테마·SVG 크리처 4종·Fredoka One·파티클·콤보 |

> **참고**: 레퍼런스 HTML 파일 내 `CLAUDE_v4.md` 등 구버전 언급은 모두 `CLAUDE.md`로 간주할 것

---

## 🎮 게임 모듈 요약

| 모듈 | 테마 | 폰트 포인트 | 핵심 컬러 | 레퍼런스 |
|------|------|-------------|-----------|---------|
| Flashcard | 하늘·구름·잔디 | Lora (단어) | 황금→초록 카드 | `Flashcard.html` |
| SpellForge | 파란 패널 | JetBrains Mono (셀) | #4A9FCF 패널 | `SpellForge.html` |
| WordBlitz | 정글 어드벤처 | Fredoka One (타이틀) | #3d8a3d + #FFE234 | `WordBlitz_Jungle.html` |
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
14 Home Hub ★NEW    — HubHero · ModuleCard · ContinueCard / 4영역(Hero·Module·Continue·Reflection) · StatCard inline · F-pattern · Flow State
```

---

*CLAUDE.md — Vocaflow Design System · Single Source of Truth*  
*변경 이력: 파일명 CLAUDE.md로 통일 / 기술스택 Next.js 14 확정 / CSS 변수 축약형(--p·--bg·--t1) 통일 / React Native 토큰 신설 / Breakpoint 390/768/1280px / Dashboard §13 신설 / Parts Kit v06 / **v06.1** Turborepo 모노레포 구조 + text-viewer/marketing 분리 + game 하위 분리 + lib 폴더화 + stores 추가 / **v06.2** 서비스명 LexiVault → Vocaflow · 단어장 모듈 LexiVault → WordVault · 폴더 vocab → wordvault / **v06.3** (main)/page.tsx 삭제 → (main)/hub/page.tsx 신설 (Home+Dashboard 통합) · URL 충돌로 인한 빌드 실패 해소 (✅ 정상 빌드) · 인증 분기 middleware.ts 일괄 처리 / **v06.4** §14 Home Hub 신설 — HubHero(인사+Streak+Today CTA, gradient + s2) · ModuleCard(7모듈 정사각·아이콘·마지막 학습) · ContinueCard(Lora 제목·진행률·CTA) / StatCard `variant="inline"` 추가 (§13) / 재사용: StatCard·RecentActivity·ProgressBar / 레이아웃 4영역(Hero·Module·Continue·Reflection) · max-w-6xl · F-pattern 시선 정합 · Flow State 진입 보조 / components/home/ 폴더 추가*
