# Design System

> Vocaflow 디자인 시스템 SSoT. **v06.36 — iOS/iPadOS HIG 디자인 언어 풀 도입**.
> 토큰 · 폰트 · 컴포넌트 패턴 · 모션 · 머터리얼 · 접근성 통합. 최근 갱신: 2026-06-13.
>
> **토큰 위치**: `packages/design-tokens/src/tokens.css` (웹 SSoT) + `colors.ts` (RN 공유).
> **iOS 프리미티브**: `apps/web/src/components/ui/ios/` (Card · Frame · SegmentControl · InsetGroup · InsetRow · Capsule · StatPill · ActivityRing · PrimaryButton · GlassBar).

---

## 🎨 iOS Color SSoT (v06.38 — Indigo 학습 브랜드 + Learning Color Effect)

> **재진단 (v06.37 → v06.38)**:
> v06.37에서 `--p`를 `#007AFF` iOS Blue 로 정렬했으나 사용자 진단 — "색상이 플랫폼에 안맞음, 학습적 효과 색상 필요". 정확한 진단:
>
> - **iOS Blue = "Apple Settings" 톤** — Vocaflow 는 system 앱이 아닌 학습 플랫폼. systemBlue 는 Apple 시스템 앱(Settings/Files/Mail)의 표준 → 학습 플랫폼에 쓰면 "Apple Settings" 처럼 읽힘
> - **3rd party iOS 앱은 브랜드 색 + iOS 구조** — Duolingo(그린)·Things 3(블루)·Linear(퍼플)·Notion(블랙)·Spotify(그린) 모두 자기 브랜드 색을 유지하면서 iOS 레이아웃·타이포·모션을 차용
> - **학습 플랫폼 색채 심리** — 보라/인디고 = 학구열·사색·집중 (Korean academic 정서, 산타토익/클래스101 정합). 청록/블루 위주의 영어 학습 앱들과 시각 차별
>
> **결정 (v06.38)**: `--p` = **iOS systemIndigo `#5856D6`** (다크 `#5E5CE6` vivid).
> · 시스템 컬러 12종 중 하나 → HIG 정합 100%
> · 학구열·사색 정서 → 학습 플랫폼 정합
> · 다른 영어 학습 앱과 시각 차별

### iOS HIG 3대 색상 시스템

| 시스템 | iOS Spec (Vocaflow 채택) | Vocaflow 토큰 | 용도 |
|---|---|---|---|
| **System Tint (브랜드)** | **`systemIndigo` `#5856D6`** (light) / `#5E5CE6` (dark vivid) | `--p` | 모든 액션·링크·액센트의 표준 — 단 하나의 tint |
| **System Colors** | red/orange/yellow/green/blue/indigo/purple/pink 등 | `--ios-*` + semantic `--success/--error/--warning/--info` | 의미별 액센트 (red=destructive, green=success, orange=warning) |
| **Grouped Background** | `systemGroupedBackground` `#F2F2F7` light / `#000000` dark | `--bg2` (캔버스) + `--bg` (카드) + `--bg3` (셀 fill) | 그레이 캔버스 위에 떠있는 흰 카드 — iOS Settings 시그니처 |
| **Label Colors** | `label` `#000000` → `quaternaryLabel` `rgba(60,60,67,.18)` (4단계 알파) | `--t1` → `--t4` | warm-neutral 라벨, 어떤 배경 위에서도 자연스러운 알파 기반 |
| **Separator** | `#C6C6C8` light / `#38383A` dark | `--bd` | 셀 구분선 — 정확한 iOS 그레이 |

### 색상 토큰 카탈로그 (v06.38)

```css
/* Light Mode — iOS HIG 정확 + 학습 브랜드 (Indigo) */
--p           : #5856D6              /* systemIndigo — 학습 브랜드 */
--p-hover     : #4946C2
--p-light     : #EBEAFB              /* tint badge bg */
--p-dark      : #3C3AAB

--success     : #34C759              /* systemGreen */
--error       : #FF3B30              /* systemRed */
--warning     : #FF9500              /* systemOrange */
--info        : #32ADE6              /* systemCyan */

--bg          : #FFFFFF              /* secondarySystemGroupedBackground = card */
--bg2         : #F2F2F7              /* systemGroupedBackground = canvas ★ iOS 시그니처 */
--bg3         : #E5E5EA              /* systemGray5 = fill */

--t1          : #000000              /* label */
--t2          : rgba(60,60,67,.60)   /* secondaryLabel */
--t3          : rgba(60,60,67,.30)   /* tertiaryLabel */
--t4          : rgba(60,60,67,.18)   /* quaternaryLabel */

--bd          : #C6C6C8              /* separator (opaque) */

/* Dark Mode — iOS 순흑 캔버스 */
--p           : #5E5CE6              /* systemIndigo dark vivid */
--bg          : #1C1C1E              /* card */
--bg2         : #000000              /* canvas — 순흑 */
--bg3         : #2C2C2E              /* fill */

--t1          : #FFFFFF              /* label */
--t2          : rgba(235,235,245,.60) /* secondaryLabel */

--bd          : #38383A              /* separator */
```

### iOS 색상 철학 (HIG 핵심 dos/don'ts)

#### ✅ DO

| 원칙 | 적용 |
|---|---|
| **단일 tint** | 모든 interactive element (버튼, 링크, 액세서리, 포커스링) = `--p` 단 하나. 절대 다른 임의 액센트 사용 X. |
| **의미 = 색** | 색은 의미에 종속. red=destructive 만, green=success/달성 만, orange=warning 만. 의미와 무관한 장식 색 금지. |
| **알파 기반 라벨** | 텍스트는 알파 라벨 (`--t1~t4`) — 어떤 배경 (흰/그레이/컬러 카드 위) 에도 일관 가독. |
| **그레이 캔버스 = 정체성** | `bg2 = #F2F2F7` 캔버스 + `bg = #FFFFFF` 카드 = 떠있는 카드. 이 패턴이 iOS 시그니처. |
| **시스템 컬러 = vivid dark** | 다크 모드는 `#0A84FF/#FF453A` 등 vivid 변형 사용. 라이트 색상 그대로 X. |
| **separator = `--bd`** | `border-[var(--bd)]` (light: `#C6C6C8`, dark: `#38383A`). Tailwind gray border 사용 X. |
| **CTA 글로우** | Primary CTA 에 `--sh-ios-glow-blue` (`rgba(0,122,255,.25)`) 컬러 그림자로 떠있음 표현. |

#### ❌ DON'T

| 안티패턴 | 이유 |
|---|---|
| ❌ `#3B82F6` (Tailwind blue) 사용 | 미세한 cyan-shift → Tailwind 티 |
| ❌ `#007AFF` (iOS systemBlue) 를 브랜드로 사용 | "Apple Settings" 톤 → 학습 플랫폼 정체성 무력화. 단, iOS Blue 는 `<PrimaryButton tone="info">` 일 때만 사용 가능 (구독/공유 등 system 의미) |
| ❌ `text-slate-*` `bg-slate-*` 사용 | iOS는 warm-neutral, Tailwind slate 는 cool-blue 톤 → 즉시 non-iOS 느낌 |
| ❌ `border-gray-200` 임의 border | iOS separator 와 톤 불일치, 너무 진해보임 |
| ❌ 색상 3개 이상으로 강조 분류 | iOS는 한 화면에 색 액센트 1-2개. 다색 = 안드로이드 Material 느낌 |
| ❌ `text-black` `text-white` 하드코드 | 알파 라벨 (`--t1~t4`) 무력화 → 다크 모드 비정합 |
| ❌ 다크 모드 `bg-gray-900` 임의 | iOS 다크는 `#000000` 캔버스 + `#1C1C1E` 카드. 회색 9 색 (Tailwind) X |
| ❌ 임의 hex 색상 `bg-[#xxxxxx]` | 디자인 토큰 우회 → 다크 모드 비정합 + 일관성 손실 |

### 학습 효과 색채 — 4 Memory Decay (v06.38 iOS 정렬)

학습 과학 검증 4색 (Karpicke 2008 retrieval + Ebbinghaus 망각곡선 시각화). v06.38에서 모든 4색을 iOS systemColor 와 1:1 정합:

| 상태 | 의미 | 이전 (Tailwind) | 신규 (iOS systemColor) | 임계값 |
|---|---|---|---|---|
| **stable** | "이건 알아요" — 안정적 회상 | `#22C55E` Tailwind green | **`#34C759`** iOS systemGreen | R ≥ 0.95 |
| **shaky** | "익숙해요" — 조금 흐려짐 | `#F59E0B` Tailwind amber | **`#FF9500`** iOS systemOrange | 0.70 ≤ R < 0.95 |
| **risk** | "흐릿해요" — 다시 만나야 함 | `#EF4444` Tailwind red | **`#FF3B30`** iOS systemRed | R < 0.70 |
| **new** | "처음 만나는 단어" — 중립 | `#94A3B8` Tailwind slate | **`#8E8E93`** iOS systemGray | D/S 미부여 |

토큰: `--memory-stable/shaky/risk/new` ([globals.css §Memory Decay Colors](../apps/web/src/app/globals.css)). 코드 사용 — `bg-[var(--memory-stable)]` 식.

### 학습 플랫폼 색채 철학 (v06.38)

#### 1) 단일 학습 브랜드 액센트 = `--p` (Indigo)

학습자의 인지 부하 최소화 (Sweller — 작업기억 ~4 항목). 모든 인터랙티브 = 한 색.
- **버튼·링크·포커스링·V-Level 현재 위치** = `--p` Indigo
- 이를 통해 학습자는 "다음에 할 행동"을 색만으로도 학습 — 매번 인지 자원 소모 X

#### 2) 의미별 1:1 색 → 즉각 인식

학습 효과 = 색-의미 연결의 일관성. 한 번 학습된 색-의미 연결이 화면마다 동일해야 학습자의 인지 부하 최소화.

| 색 (iOS) | 학습 의미 | 사용처 |
|---|---|---|
| **Indigo `#5856D6`** (brand) | 현재 위치 · 메인 액션 · 다음 단계 안내 | 모든 CTA · V-Level 현재 · 진행 막대 |
| **Green `#34C759`** | 달성 · 안정 · 정답 · i+1 (다음 단계 도전) | stable 메모리 · 정답 피드백 · i+1 zone 강조 · 도서 "딱 맞아요" |
| **Orange `#FF9500`** | 주의 · 익숙 (불안정) · streak · 진행 중 | shaky 메모리 · streak 카운터 · 학습 중 도서 |
| **Red `#FF3B30`** | 회복 필요 · critical · 망각 | risk 메모리 · 오답 · 삭제 confirm |
| **Gray `#8E8E93`** | 중립 · 신규 · 미완료 | new 메모리 · 미진단 · 비활성 |

#### 3) 동기부여 색 ≠ 압박 색 — Calm UI 원칙

학습 동기는 색만으로도 영향 받음 (Mehta 2009, Color Psychology in Learning).

| 원칙 | 적용 |
|---|---|
| **risk = 빨강이지만 옅게** | 옅은 background tint (`#FFE5E5`) 위에 진한 텍스트. 압박 X, 회복 안내 톤 |
| **i+1 zone = 그린 강조** | 도파민 보상 (Krashen i+1) → 다음 단계 = 그린 (성장의 색) |
| **streak = orange (warm)** | 차가운 색(blue/red) X — 따뜻한 색이 자기효능감 증진 |
| **정답 피드백 = green + spring 애니메이션** | 즉각 vmPFC 보상 신호 — 색만으로 부족, 모션과 결합 |
| **오답 = red 짧게 + 격려 메시지** | "다시 만나봐요" — 색은 짧게(0.6초), 텍스트로 회복 안내 |

#### 4) V-Level 시각 진행 (Krashen i+1)

V0-V11 12 레벨의 학습자 위치 표시 — 단조 색 X, 의미별 색 분기:

| V-Level | 색상 | 의미 |
|---|---|---|
| **현재 V-Level** | `--p` Indigo (saturated) | 학습자 위치 — 강조 |
| **i+1 zone (V+1)** | `--memory-stable` Green | Krashen 권장 다음 단계 — 도파민 |
| **그 외 (V-Level 분포 막대)** | `--ios-gray-3` (light gray) | 분포 표시만 — 차분 |
| **V0 / 미진단** | `--memory-new` Gray | 중립 |

#### 5) Calm UI = 자극 절제

학습 중 시각 자극 최소화 (CLAUDE.md §디자인 철학 #1). 색채 적용 규칙:

- **한 화면에 saturated 색 최대 2개** — Indigo brand + 하나의 의미 색
- **나머지는 알파 라벨 (warm-neutral) + 그레이** — 인지 자원 보존
- **rainbow palette 금지** — V-Level 12색 무지개·정확도 빨강↔초록 X
- **광고·뱃지 알림 색 금지** — 모든 카운트 = neutral capsule

### Capsule tone 매핑 (의미-색 1:1)

```
brand   = systemIndigo     — 메인/현재/primary action (학습 브랜드)
green   = systemGreen      — 완료/달성/다음 단계/딱 맞아요
orange  = systemOrange     — 진행 중/주의/도서/복습
red     = systemRed        — 위험/critical/회복 필요
yellow  = systemYellow     — caution/수능 트랙
purple  = systemPurple     — 단어장/specialty
pink    = systemPink       — streak/학술 트랙
neutral = bg3 + t1         — 일반 메타 (수치, 카운트)
gray    = bg3 + t2         — secondary 정보
```

이 의미 슬롯은 [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) §iOS 시스템 컬러 의미 슬롯 표와 동일.

---

## 🍎 iOS / iPadOS 디자인 언어 (v06.36 풀 적용)

### 철학 — Apple HIG 3대 원칙 (학습 컨텍스트로 번역)

| # | 원칙 | iOS 정의 | Vocaflow 적용 |
|---|---|---|---|
| 1 | **Clarity (명료성)** | 텍스트가 모든 크기에서 가독, 아이콘이 정확·이해, 장식 절제, 기능이 동기 부여 | Hero 숫자 88px · Lora 17-19px 본문 · 캡슐 배지 의미별 1색 · 절대 모달 캡 없음 |
| 2 | **Deference (양보)** | 콘텐츠가 주역, 인터페이스는 보조 (반투명 머터리얼·minimal chrome·Z-axis 위계 콘텐츠 우선) | 그레이 캔버스(`bg2`) + 떠있는 흰 카드 · 글라스 네비 bar · 학습 중 sidebar dim |
| 3 | **Depth (깊이)** | 시각 레이어·실사적 모션이 위계와 의미 전달, 직접 조작 즐거움 | Activity Ring 그라데이션 + glow · 카드 hover `-translate-y-1` · spring easing · 캡슐 shadow stack |

### 핵심 개념 (Composition Vocabulary)

| 개념 | 정의 | 토큰/프리미티브 |
|---|---|---|
| **Continuous Corner** | iOS 라운드는 squircle (G2 continuous). Vocaflow는 CSS `border-radius`로 근사 — radius 18px 이상은 비례 패딩으로 보강 | `--r-ios-{xs..3xl}`, `rounded-ios-{md..3xl}` |
| **Gray Canvas + Floating Card** | 메인 backdrop은 `bg2`(그레이), 카드는 흰 surface + soft shadow로 부유감 | `<Card>`, `--sh-ios-2` |
| **Glass Material** | UIVisualEffectView Material — backdrop-blur + saturate. thin/regular/thick 3단 | `--mat-glass-bg-{thin,regular,thick}`, `<GlassBar>` |
| **Capsule** | 정보·상태 캡슐 (pill 반경). 의미별 7+ tone (iOS 시스템 컬러 매핑) | `<Capsule>`, `--r-ios-pill` |
| **Inset Grouped List** | Settings 인셋 그룹 — rounded-14 바깥 + 흰 안쪽 divide-y + 8px SF Symbol 아이콘 box | `<InsetGroup>` + `<InsetRow>`, `--r-ios-lg` |
| **Segmented Control** | UISegmentedControl — 캡슐 컨테이너 + 활성 흰 캡슐 + `--sh-ios-button` | `<SegmentControl>` |
| **Activity Ring** | Fitness 앱 원형 진행도 — 그라디언트 + glow + emphasized cubic-bezier (700ms) | `<ActivityRing>` |
| **Hero Numerals** | SF Display 거대 숫자 — `font-[800] tracking-[-0.045em] tabular-nums` 64-128px | `font-display` + `text-[64px..128px]` |
| **Primary CTA** | 큰 캡슐 버튼, 6 tone (neutral/brand/critical/warning/info/success), tone별 glow | `<PrimaryButton>`, `--sh-ios-glow-*` |
| **iOS Color Glow** | CTA·상태 강조용 컬러 그림자 (rgba 22-25% × 16px blur) | `--sh-ios-glow-{blue,green,red,orange}` |

### iOS 시스템 컬러 — 의미별 액센트 (브랜드 `--p` 와 별도)

| 컬러 | Hex (light) | Hex (dark vivid) | Tint | 의미 슬롯 |
|---|---|---|---|---|
| ios-red | `#FF3B30` | `#FF453A` | `#FFE5E5` | critical · destructive · risk |
| ios-orange | `#FF9500` | `#FF9F0A` | `#FFF1E5` | warning · 도서 · review |
| ios-yellow | `#FFCC00` | `#FFD60A` | `#FEF3C7` | caution · 수능 트랙 |
| ios-green | `#34C759` | `#30D158` | `#E8F8EE` | success · stable · i+1 zone |
| ios-mint / teal / cyan | — | — | — | utility (예약) |
| ios-blue | `#007AFF` | `#0A84FF` | `#E5F2FF` | 정보 · 스크립트 · 비즈 트랙 |
| ios-indigo | `#5856D6` | `#5E5CE6` | — | 보조 액션 |
| ios-purple | `#AF52DE` | `#BF5AF2` | `#F3E8FF` | 단어장 · specialty |
| ios-pink | `#FF2D55` | `#FF375F` | `#FCE7F3` | 학술 트랙 · streak (예약) |
| ios-gray-1..6 | `#8E8E93..#F2F2F7` | (flipped) | — | neutral · 비활성 · 구분 |

### 토큰 카탈로그 (iOS 전용)

```css
/* Radius — iOS HIG */
--r-ios-xs    : 6px    /* badge inner */
--r-ios-sm    : 8px    /* small icon box (SF Symbol container) */
--r-ios-md    : 12px   /* button, cell inner */
--r-ios-lg    : 14px   /* inset group outer */
--r-ios-xl    : 18px   /* primary button */
--r-ios-2xl   : 24px   /* card surface */
--r-ios-3xl   : 32px   /* hero card */
--r-ios-modal : 38px   /* sheet, modal */
--r-ios-pill  : 9999px /* capsule */

/* Shadow — iOS HIG */
--sh-ios-1       : 0 1px 2px rgba(0,0,0,.04)                                /* subtle */
--sh-ios-2       : 0 1px 2px rgba(0,0,0,.04), 0 8px 24px -12px rgba(0,0,0,.08) /* card */
--sh-ios-3       : 0 2px 4px rgba(0,0,0,.06), 0 12px 32px -8px rgba(0,0,0,.12) /* elevated */
--sh-ios-4       : 0 4px 8px rgba(0,0,0,.08), 0 20px 48px -8px rgba(0,0,0,.16) /* modal */
--sh-ios-button  : 0 1px 2px rgba(0,0,0,.06), 0 2px 8px rgba(0,0,0,.04)
--sh-ios-glow-blue  : 0 4px 16px rgba(59,130,246,.22)
--sh-ios-glow-green : 0 4px 16px rgba(52,199,89,.22)
--sh-ios-glow-red   : 0 4px 16px rgba(255,69,58,.25)
--sh-ios-glow-orange: 0 4px 16px rgba(255,159,10,.22)

/* Material — UIVisualEffectView 정합 */
--mat-glass-bg-thin    : rgba(255,255,255,.72)
--mat-glass-bg-regular : rgba(255,255,255,.85)
--mat-glass-bg-thick   : rgba(255,255,255,.92)
--mat-glass-filter     : blur(20px) saturate(1.5)

/* Motion — Spring + Standard easing */
--ease-ios-standard      : cubic-bezier(.4, 0, .2, 1)
--ease-ios-emphasized    : cubic-bezier(.2, 0, 0, 1)
--ease-ios-spring        : cubic-bezier(.34, 1.56, .64, 1)
--ease-ios-spring-bouncy : cubic-bezier(.5, 1.8, .5, 1)

--dur-ios-fast   : 150ms  /* tap, capsule swap */
--dur-ios-normal : 250ms  /* card hover, segment switch */
--dur-ios-slow   : 400ms  /* ring fill */
--dur-ios-slower : 700ms  /* hero reveal */

/* Layout Inset (iPhone/iPad safe area + Reading 폭) */
--ios-content-max      : 820px   /* iPad Reading 폭 */
--ios-content-wide-max : 1024px
--ios-inset-x          : 20px    /* iPhone safe area horizontal */
--ios-inset-x-compact  : 16px
--ios-card-gap         : 16px

--ios-navbar-h  : 52px
--ios-toolbar-h : 49px
--ios-tabbar-h  : 83px

/* iOS Typography (SF Display/Text 정합) */
--ios-text-large-title : 700 34px/40px var(--ios-font-display)
--ios-text-title-1     : 700 28px/34px var(--ios-font-display)
--ios-text-title-2     : 700 22px/28px var(--ios-font-display)
--ios-text-title-3     : 600 20px/25px var(--ios-font-display)
--ios-text-headline    : 600 17px/22px var(--ios-font-text)
--ios-text-body        : 400 17px/22px var(--ios-font-text)
--ios-text-callout     : 400 16px/21px var(--ios-font-text)
--ios-text-subheadline : 400 15px/20px var(--ios-font-text)
--ios-text-footnote    : 400 13px/18px var(--ios-font-text)
--ios-text-caption-1   : 400 12px/16px var(--ios-font-text)
--ios-text-caption-2   : 400 11px/13px var(--ios-font-text)
```

### Foundation 프리미티브 카탈로그 (`@/components/ui/ios`)

| 컴포넌트 | 역할 | 핵심 props |
|---|---|---|
| **`Card`** | iOS 떠있는 카드 — 24px radius + soft shadow | `size: sm\|md\|lg\|xl` (16-28px 패딩) · `elevation: 1\|2\|3\|4` (그림자 강도) · `as: section\|article\|div` |
| **`Frame`** | Card + iOS section header (title + meta + More →) | `title`, `meta`, `moreHref`, `moreLabel`, `headerRight` |
| **`SegmentControl`** | UISegmentedControl 캡슐 세그먼트 | `items: SegmentItem<TKey>[]` · `active: TKey` · `onChange` or `href` · `block` |
| **`InsetGroup`** | Settings 인셋 그룹 컨테이너 (header/footer 캡션) | `header`, `footer` |
| **`InsetRow`** | Settings 셀 — 아이콘 + title + subtitle + chevron + 진도 | `href` or `onClick` · `icon` + `iconBg` · `progress` · `metaRight` · `hideChevron` |
| **`Capsule`** | 정보·상태 캡슐. label+value 또는 단일 children | `tone: 9종` · `size: sm\|md` · `label`+`value` or `children` |
| **`StatPill`** | Health Categories KPI 셀 — 라벨 + 큰 숫자 + 단위 | `label`, `value`, `unit`, `accent`, `dotColor`, `ratio` |
| **`ActivityRing`** | Fitness 원형 진행도 — 그라데이션 + glow | `pct`, `reached`, `size`, `stroke`, `capLabel`, `centerValue`, `centerSub` |
| **`PrimaryButton`** | iOS Primary CTA — 큰 캡슐, 6 tone | `tone`, `size: sm\|md\|lg` · `count` · `rightIcon` · `block` |
| **`GlassBar`** | NavigationBar — 글라스 sticky/fixed (52px) | `leading`, `center`, `trailing`, `material: thin\|regular\|thick` |
| **`SheetContainer`** | iOS bottom sheet — Modal presentation. 전역 keyframe + solid scrim + Esc/scrim 닫힘 + body scroll lock | `visible`, `onClose`, `detent: medium\|large`, `labelledBy`/`ariaLabel`, `disableBackdropClose` |
| **`Screen`** | 화면 셸 — 폭 variant + safe-area + 배경 | `width: compact\|content\|wide\|full`, `background: bg\|bg2\|transparent`, `padX` |

### 접근성 패턴 (Always-on · v06.36)

| 패턴 | 1차 (전역) | 2차 (JS 분기) |
|---|---|---|
| **Reduce Motion** | `globals.css` `@media (prefers-reduced-motion: reduce)` — `animation-duration:.01ms!important` 등 글로벌 가드 | `useReduceMotion()` ([useReduceMotion.ts](../apps/web/src/hooks/useReduceMotion.ts)) — `transition: 'none'` 등 inline style 분기. ActivityRing/SheetContainer 등 JS-driven 애니메이션은 inline style 우선순위가 CSS guard 보다 높아 명시 분기 필수. |
| **Focus visible** | `:focus-visible { outline: 2px solid var(--bdf) }` 글로벌 | — |
| **Safe area** | Screen/Sheet 가 `env(safe-area-inset-{top,bottom,left,right})` 자동 처리 | — |
| **ESC 닫힘 + body scroll lock** | SheetContainer 내 `useEffect` 가 키 핸들러 + `document.body.style.overflow = 'hidden'` | — |
| **ARIA 라벨링** | `role="dialog" aria-modal="true"` · `aria-labelledby` 우선, `aria-label` fallback | — |
| **한국어 IME 조합 보호** | **셸 책임 X** — 입력 컴포넌트(SpellForge/Dictation) 의 `<input>` 레벨에서 `composition*` 이벤트 처리 또는 비제어 ref 사용. (audit D9 정합) | — |

### 사용 규약 (Always-on)

1. **카드 = `<Card>` 또는 `<Frame>`** — `bg-[var(--bg)]` 직접 셀 금지 (그림자·radius 누락 위험).
2. **세그먼트 = `<SegmentControl>`** — 자체 캡슐 nav 금지 (활성 그림자 토큰 누락).
3. **Settings list = `<InsetGroup>` + `<InsetRow>`** — `divide-y` 직접 셀 금지.
4. **상태 캡슐 = `<Capsule>`** — 인라인 `rounded-[var(--r-full)] px-2.5` 금지.
5. **CTA = `<PrimaryButton>`** — 자체 큰 버튼 금지 (tone별 컬러 글로우 누락).
6. **네비 헤더 = `<GlassBar>`** — 자체 `sticky top-0 backdrop-blur` 금지.
7. **거대 숫자 = `font-display text-[64px..128px] font-[800] tracking-[-0.045em] tabular-nums`** — 4축 한 세트로 사용.
8. **iOS 시스템 컬러 사용 시 always tint와 페어로** — `bg-ios-green-tint` + `text-ios-green` (대비 보장).
9. **Reading 폭 `max-w-[var(--ios-content-max)]`** (820px) — Hub·Reader류 콘텐츠. wider 페이지는 `--ios-content-wide-max` (1024px).
10. **모션은 `ease-ios-*` 토큰 사용** — 임의 cubic-bezier 금지.
11. **JS-driven 애니메이션은 `useReduceMotion()` 분기 필수** — inline style `transition` 은 CSS @media 가드를 우회. ActivityRing, SheetContainer, 커스텀 슬라이더 등.
12. **bottom sheet = `<SheetContainer>`** — 자체 `<Modal>`+keyframe 금지 (전역 sheetUp keyframe + scrim + body scroll lock 누락 위험).
13. **화면 셸 = `<Screen>`** — `min-h-dvh` 직접 셀 금지 (safe-area + 폭 variant 누락).

### Mobile / RN (Phase 2 — Native Layer iOS-led)

웹 iOS 프리미티브와 동일 철학을 React Native + Expo 위에 구현. 8 파일 corrected 스펙은 [MOBILE_SHELL_SPEC.md](./MOBILE_SHELL_SPEC.md) 보존 — Phase 2 진입 시 1:1 복붙.

핵심 차이 (audit D4 정합):
- **명명 = "Native Layer (iOS-led)"** — Android 동시 타깃 고려, "iOS Layer" 명칭 폐기.
- **Android 실 블러 보장** — `expo-blur` `experimentalBlurMethod="dimezisBlurView"` 분기.
- **Reduce Transparency 폴백** — iOS 만 의미 (Android 항상 false). `useReduceTransparency` 시 Material → 불투명 View.
- **회전·폴더블** — Sheet 는 `useWindowDimensions` (Dimensions.get 금지).
- **공간 회수** — large title 은 스크롤 콘텐츠 첫 요소로 배치 (opacity 페이드만으론 공간 잔존).
- **자동 탭 등록 차단** — Expo Router `<Tabs.Screen options={{ href: null }}>` 명시.

### 적용 범위 (v06.36 1단계)

- ✅ **WordVault Hub** (6 Section) — VaultIdentity · VocabularyLevelMap · ResourcePortfolio · RecommendedBooks · NextStepList · FlowStripe + 헤더 (page.tsx)
- ✅ **공통 기반** — Card · Frame · SegmentControl · InsetGroup · InsetRow · Capsule · StatPill · ActivityRing · PrimaryButton · GlassBar · SheetContainer · Screen (12종)
- ✅ **접근성** — `prefers-reduced-motion` 전역 + `useReduceMotion` JS · ActivityRing/RecommendedBooks 카드 hover 분기
- 🟡 **다음 단계** (Phase 14.6 후속): TextViewer · Workspace · Library Books Browse · Diagnostic · Admin Console — 같은 프리미티브로 점진 마이그레이션
- 🟡 **Mobile (Phase 2)** — [MOBILE_SHELL_SPEC.md](./MOBILE_SHELL_SPEC.md) corrected 형태 그대로 구현, TAB-IA 결정 후 진입

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
