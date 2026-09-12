# Design System

> Vocaflow 디자인 시스템 SSoT. **v06.39 — Reading Room Art Direction (iOS 골격 위 잉크/페이퍼/금)**.

---

## 🎯 첫인상 · 이탈 방지 · 모션 예산 (v06.42 — 2026-09-04)

> **이 절이 이 문서에서 가장 먼저 오는 이유.** 아래 1,200줄은 "무엇으로 만드는가"(색·서체·간격)를
> 말한다. 그런데 실측해 보니 이 문서 전체에 **"첫 화면이 무엇을 증명해야 하는가"를 정한 줄이
> 0개**였다(2026-09-04 grep: `첫인상|이탈` = DESIGN_SYSTEM 0 · CLAUDE.md 0 · CONVENTIONS 3,
> 그 3개도 Next.js CSR 이탈 얘기였다). 토큰이 아무리 정교해도 **첫 화면이 아무것도 증명하지 않으면
> 그 정교함은 아무도 보지 않는다.**

### 1. 증명 우선 (Proof-first hero)

Vocaflow 의 주장은 **"내가 아는 비율"** — 지문 위에 아는 단어와 모르는 단어가 칠해진, 본질적으로
**시각적인** 것이다. 그것을 산문으로 설명하면 증명이 사라지고 주장만 남는다.

| # | 규칙 | 검사법 |
|---|---|---|
| **I1** | 공개 화면 above-the-fold 에 제품이 **실제로 수행한 결과**가 1개 이상 있다 | 히어로에 실데이터 렌더 요소가 있는가 |
| **I2** | 그 증명에 도달하기까지 클릭 **0** · 입력 **0** | 진입 직후 화면에 보이는가 |
| **I3** | 증명은 **조작 가능**하다 — 방문자가 값을 바꾸면 즉시 반응한다 | 컨트롤 ≥1 · 반응 ≤200ms |
| **I4** | 히어로 부제 ≤ **2문장 / 90자**. 설명은 증명 뒤로 | 글자 수 |
| **I5** | 화면의 수치는 **DB 실측 또는 그 자리 계산값**만. 상수 박기 금지 | `components/marketing/__tests__/no-hardcoded-stats.test.ts` |
| **I6** | 증명 요소가 **서버 렌더 HTML** 에 남는다 | 초기 HTML 에 텍스트가 있는가 |
| **I7** | 한글 제목·본문에 `break-keep`(word-break: keep-all) — 없으면 390px 에서 낱말이 쪼개진다 | 2026-09-04 실측: 랜딩 H1 이 "다른 겁니 / 다" 로 깨져 있었다 |
| **I8** | 증명은 **접힌 위(above the fold)** 에서 끝나야 한다 — **판정 기준은 데스크톱 1280×900. 모바일은 제외한다**(아래 각주) | 실측 하단 좌표. 현행 커버리지 숫자 데스크톱 736 / CTA 867 |

> **I8 이 모바일을 제외하는 이유** (2026-09-04 결정). 390×844 에서 H1 + 부제 + 지문 + 슬라이더 +
> 숫자 + CTA 를 **전부** 접힌 위에 넣으려면 지문을 잘라야 한다 — 그런데 지문의 길이 자체가
> 증명의 일부다(짧은 문장 몇 개로는 "아는 비율"이 눈에 안 보인다). 실측에서 모바일은
> **증명(커버리지 숫자 하단 787/844)까지는 접힌 위**이고 CTA 만 910 으로 내려간다.
> 증명을 만진 뒤 한 번 스크롤해 행동하는 것은 자연스러운 순서이므로 여기서 멈춘다.
> **모바일에서도 증명 자체(색칠된 지문 + 조작 + 숫자)는 접힌 위에 있어야 한다** — 그건 I2 다.
> 이 예외는 판정 기준선의 예외이지 모바일 퍼스트(390 → 768 → 1280)의 예외가 아니다.

**순서** — 세일즈가 아니라 도구 순서다:
`증명(작동하는 것) → 근거 1줄 → 다음 문 → 신뢰 수치 → 상세`.
AIDA(Attention→Interest→Desire→Action)를 쓰지 않는다 — 교사·학생은 광고가 아니라
**오늘 쓸 도구**를 찾으러 온다. 욕구를 만드는 단계가 스크롤 예산 낭비다.

### 2. 이탈 방지 — 못 재면 방지도 없다

| # | 규칙 | 근거 |
|---|---|---|
| **D1** | 가치 확인 앞에 로그인·입력·모달을 두지 않는다 | `/fit` 이 공개인 이유(허용 CAC ₩400 시장에서 관문 앞 가치가 유일한 획득 수단) |
| **D2** | 새 공개 화면은 **진입 이벤트 + 내부 상호작용 이벤트**를 같은 커밋에 넣는다 | 진입만 재면 "왔다 갔다"밖에 모른다 |
| **D3** | 이벤트 속성은 **숫자·불리언·닫힌 열거형만** — 자유 문자열 금지 | `lib/analytics/events.ts` 가 타입으로 강제 (지문 유출 차단) |
| **D4** | 파생 가능한 것은 수집하지 않는다 | `lib/admin/retention-math.ts` |
| **D5** | 빈 상태에 **다음 한 걸음**이 반드시 있다 | 막다른 화면 = 이탈 |
| **D6** | 실패·오답에서 비난 금지 (정답률 빨간 글씨·경고 아이콘) | 철학 3 Empathetic Feedback |
| **D7** | 가입 후 **첫 학습 1회 완료까지 화면 전환 ≤ 3** | 실측 **3** (2026-09-06) — ①가입→`/hub` ②`/hub` 미진단→`/diagnostic` ③진단 완료→`/flashcard/play` **직행**. 회귀 `app/__tests__/activation-path.test.ts` 가 세 걸음을 잠근다 |

> **왜 이 줄에 회귀가 붙어 있나.** 이 경로는 세 파일에 나뉘어 있다(가입 리다이렉트 ·
> 관문 CTA · 진단 완료 분기). 한 곳만 바뀌어도 조용히 4전환이 되는데 **화면은 전부 멀쩡히 뜬다** —
> 눈으로는 영영 안 잡히는 자리다. 그리고 그 자리의 비용은 실측돼 있다:
> **가입 → 첫 학습 중앙값 55일**(2026-08-16 `/admin` 리텐션 패널 1회차). 리텐션 이전에 활성화가
> 막혀 있고, 활성화를 막는 것이 이 경로의 길이다.
> 진단 완료가 `/hub` 로 되돌아가면 한 걸음이 늘어난다 — 회귀는 그것을 잡는다(변이 검사로 확인).

### 3. 모션 예산 — 숫자로 고정

기존 토큰(`packages/design-tokens/src/tokens.css:200-204`)은 이미 업계 권장 대역 안에 있었다.
아래는 그것을 **어길 수 없는 규칙으로 승격**한 것이다.

| 항목 | 값 | 토큰 |
|---|---|---|
| 마이크로 (호버·프레스·토글) | **100–200ms** | `--dur-fast` 100ms · `--dur-normal` 200ms |
| 표준 전환 (패널·모달·페이지) | **200–300ms** | `--dur-normal` · `--dur-slow` 300ms |
| 이징 | `cubic-bezier(.4, 0, .2, 1)` | `--ease` |
| 스태거 | **50ms** | §Motion 사용 매핑 |
| 이동 거리 — 마이크로 | **4–16px** | — |
| 이동 거리 — 리빌 | **20–40px** (현행 `translateY 20→0` 준수) | — |
| 총 지속 | **1초 초과 금지** (예외: `--dur-breath` 4s 앰비언트 배경) | — |
| 애니메이트 대상 | `transform` · `opacity` **만** | 레이아웃 스래시 0 |

#### 3.1 `prefers-reduced-motion` 은 끄기가 아니라 **낮추기**

```css
@media (prefers-reduced-motion: reduce) {
  /* 이동·회전·스케일은 제거, 상태 변화는 여전히 보이게 */
  .x { transition: opacity var(--dur-fast) var(--ease); transform: none !important; }
}
```

전부 `0.01ms` 로 죽이는 흔한 처방은 **무엇이 바뀌었는지 알 수 없게 만들어** 오히려 접근성을 깎는다.
**페이드는 남긴다.**

##### 전역 구현 (v06.34 — 그 전까지는 문서만 이렇게 적혀 있고 코드는 반대였다)

`globals.css` 의 전역 블록이 셋을 나눠 처리한다. 회귀:
[`lib/a11y/__tests__/reduced-motion.test.ts`](../apps/web/src/lib/a11y/__tests__/reduced-motion.test.ts)

| 대상 | 처리 | 왜 |
|---|---|---|
| 키프레임 애니메이션 | `0.01ms` + `iteration-count: 1` — 사실상 끈다 | 시간을 늘리면 `breathing`(4s) 같은 앰비언트가 **빠른 팝**이 되어 더 나쁘다 |
| 전환 시간 | `--dur-fast`(100ms) — 죽이지 않고 **낮춘다** | 상태가 바뀌었다는 사실은 남아야 한다 |
| 전환 대상 | `opacity·color·background-color·border-color·outline-color·box-shadow·fill·stroke` 만 | 이동·회전·스케일은 중간 프레임 없이 즉시 최종값으로 |

⚠️ `transform: none` 으로 지우지 않는다 — `-translate-x-1/2` 로 중앙 정렬하는 요소가 많아
레이아웃이 무너진다. 값은 두고 **전환 대상에서만** 뺀다.

⚠️ 전환 대상 제한은 시간 완화와 **한 쌍**이다. 제한하지 않으면 100ms 전환이 `all` 에 걸려
모든 요소의 모든 속성(`width`·`height` 포함)이 애니메이트된다.

진입 연출이 꼭 필요한 표면은 전역이 끈 키프레임을 **자기 규칙으로 페이드만** 되살린다
(`.wayfinder-reveal` → `wayfinder-fade`). 실측(2026-09-05, `reducedMotion: 'reduce'`):
패널 `animation-name` 이 `wayfinder-fade`/100ms 로 바뀌고, 중앙 정렬 `matrix(1,0,0,1,-224,0)` 유지.

#### 3.2 학습 화면 모션 화이트리스트 (7종 외 금지)

카드 뒤집기 · 정답 `scale(1.05)→1` · 오답 shake 3회 · 진행률 바 · 점수 카운트업 ·
페이지 전환 페이드 · 포커스 링.

**항상 금지**: 폭죽 · 콘페티 · 배지 팝업 · 자동재생 캐러셀 · **장식적 상시 모션**(perpetual
micro-motion — 상태와 무관하게 계속 도는 것).
→ 이유: 학습 중 주변시야 움직임은 작업기억을 깎는다(학습 원칙 6 Cognitive Load).

##### 「루프 애니메이션 금지」의 정확한 범위 (2026-09-06 실측으로 정정)

이 줄은 처음에 **"루프 애니메이션 금지"** 라고만 적혀 있었다. 그대로 강제해 봤더니
`animate-spin`·`animate-pulse` **20곳 이상**이 걸렸는데, 세어 보니 전부 `Loader2` 로더와
스켈레톤이었다 — 즉 **규칙이 틀렸지 코드가 틀린 게 아니었다.**

| | 판정 | 왜 |
|---|---|---|
| 로더(`Loader2` + `animate-spin`) · 스켈레톤(`animate-pulse`) | **허용** | 상태가 끝나면 **멈춘다.** "진행 중" 을 말하는 유일한 수단이고, 없애면 응답 없는 화면이 된다 |
| 배경·아이콘·배지의 상시 반복 | **금지** | 끝나는 상태가 없다. 주변시야를 계속 먹는다 |

**판정 기준은 "반복하는가" 가 아니라 "끝나는 상태가 있는가" 다.**

##### 트로피 — CLAUDE.md 의 범위대로

CLAUDE.md 절대금지는 **「진행률 100% 시 폭죽·트로피」** 다 — 즉 *완료 축하 자리*를 막는다.
실측(2026-09-06) 학습자 표면의 `Trophy` 4곳(`hub/RecentScoresList` · `pairflip/PairFlipHUD` ·
`textviewer/TextStatusBadge` · `/wordblitz`)은 전부 **점수·기록 표시**이지 완료 축하가 아니다.
이 절이 한때 "트로피 금지" 로 넓게 적혀 있었으나, 지침이 코드보다 넓으면 멀쩡한 화면이
위반으로 잡힌다 → CLAUDE.md 범위로 되돌린다.

##### 아케이드 예외

`components/game/` 는 이 절의 적용 대상이 아니다(색 하드코딩 예외와 같은 이유).
게임의 리듬은 학습 화면의 차분함과 다른 축이고 그 판단은 각 게임이 한다.
**학습 모듈(`flashcard` · `dictation` · `spellforge` · `pairflip` · `echo` …)은 예외가 아니다.**

회귀: `components/__tests__/learning-tone.test.ts` (7) — 콘페티 라이브러리·폭죽 아이콘 ·
완료/결과 화면의 오류색 · 하드코딩 ms 지속시간.

### 4. 설치된 외부 디자인 스킬 판정 (2026-09-04 실측)

`.claude/skills/` 에 취향 스킬 **13개**가 있고, 그중 **8개가 프론트엔드 UI 작업에 동시 트리거**된다.
서로, 그리고 이 문서와 충돌한다. 판정 결과:

| 외부 지시 | 출처 | 판정 | 대신 |
|---|---|---|---|
| perpetual micro-motion | `stitch-design-taste` | **금지** — Calm UI 정면 위반 | 상태 변화 시점에만 모션 |
| GSAP pinning / scrubbing / stacking | `gpt-taste` | **금지** — 스크롤 납치는 읽기 제품에서 통제감을 없앤다 | 랜딩 1회 진입 페이드까지 |
| "Serif fonts banned in dashboards" | `stitch-design-taste` | **거부** — Lora 는 Dual Coding 시그니처(`tailwind.config.ts` `editorial`) | 영어 원문·단어카드·히어로 = Lora |
| glassmorphism · 무거운 섀도로 "비싸 보이게" | `high-end-visual-design` · `stitch` | **금지** — Reading Room 과 어긋나고 대비를 깎는다 | `--r-lg` + 1px `--bd` + 톤차, 고도는 `--el-*` |
| AIDA 구조 · 거대 여백 | `gpt-taste` | **거부** | §1 증명 우선 순서 |
| 폰트 자유 선택 (Geist·Satoshi·Cabinet Grotesk) | 8개 공통 | **거부** — 폰트는 SSoT | Plus Jakarta · DM Sans · Lora · JetBrains Mono 4종 고정 |
| Inter·Roboto·Arial 금지 · AI-보라 그라데이션 금지 · 동일 3카드 금지 · 가짜 사회적 증거 금지 | 다수 | **채택** (이 문서와 일치) | 그대로 |

라우팅(어떤 화면에 어떤 스킬을 부르는가)과 3D/제너러티브 스택 고정은
**[.claude/skills/vocaflow-design/SKILL.md](../.claude/skills/vocaflow-design/SKILL.md)** 가 정본이다.

---

## 🌍 World-class Benchmarks (v06.40 — 정제 근거)

세계 최고 수준 7개 작품 분석 → "Contemporary Editorial" 정제 방향 추출.

| 제품 | 시그니처 | Vocaflow 적용 |
|---|---|---|
| **Apple Books** (iOS) | Warm off-white `#FAFAF6` (less yellow) · brown-red `#A05537` 액센트 · 시스템 세리프 hero | `--bg` 살짝 cooler `#FBFAF6` 으로 정제 (v06.39 `#FAF8F3` 은 너무 yellow → vintage) |
| **Linear** | 단일 일렉트릭 블루 `#5E6AD2` · single accent commit · 디테일 obsession | **Gold 적용 면적 5% 미만 제한** (CTA 1곳만, 다른 곳 분산 X) |
| **Things 3** | Things blue · 정밀 SF Pro · 전략적 yellow vs blue 분리 | semantic 색 분기 정확 (success/error/warning 각자 명확) |
| **Notion** | 순백 · 흑색 · 색 절제 · content-first | 동시 노출 색 2-3개 limit (navy + 한 의미 색 + 메모리 상태 1개) |
| **Substack** | Times Old Style 시그니처 · 강한 serif 정체성 | **Lora editorial 승격** (v06.39 시작) — display 폰트 변경 X, 사용 영역 ↑ |
| **Reflect** | Cream `#F8F5EE` · 미니멀 sophistication · 거대 여백 | 페이퍼 톤 + 카드 호흡 강화 (Frame `mb-5` → `mb-6`) |
| **Bear** | PT Serif · 세피아 · subtle pink 액센트 | semantic 채도 deeper sophisticated (mustard 회피) |

### 종합 진단 (v06.39 → v06.40)

| 영역 | v06.39 진단 | v06.40 정제 |
|---|---|---|
| Paper | `#FAF8F3` — 너무 yellow, vintage 느낌 | **`#FBFAF6`** — Apple Books 정합, contemporary |
| Navy | `#1E3A5F` — "old map" 느낌 | **`#0F2540`** — deeper, Linear 정합 contemporary depth |
| Gold | 3곳 분산 (active token + memory shaky + CTA) | **CTA 1곳만 + memory amber 톤 deeper** (Linear single-accent) |
| Hairline | `#D8D2C2` — 약간 visible | **`#E0DBD0`** — 거의 invisible (여백이 구조 담당) |
| Hero typo | 42→52px font-[600] | **44→56px font-[500]** (Lora 가벼움이 editorial 효과 ↑) |
| Frame 호흡 | `mb-5` | **`mb-6`** (Reflect 정합 카드 여백) |
| 다크 | warm brown 너무 진함 | **살짝 lighter + cooler** (Reflect dark 정합) |

### 세계 최고 수준 적용 5조

1. **Single accent commit** — Gold 는 CTA 1곳에만 (Linear)
2. **Less yellow paper** — Apple Books `#FAFAF6` 톤 (modern editorial)
3. **Deeper ink** — `#0F2540` contemporary depth (vs `#1E3A5F` antique)
4. **Subtler hairlines** — `#E0DBD0` 거의 안 보이게, 여백이 구조 (Reflect)
5. **Lora editorial 가벼움** — font-[500] 큰 사이즈 = 가장 editorial (Substack/Bear)

---

## 🎨 Reading Room Art Direction (v06.39 → v06.40 정제)

> **이전 진단** (v06.38 직후):
> iOS HIG 준수는 "안 깨져 보이는" 수준의 **floor**. 그 위에 아트 디렉션이 없으면 **모든 iOS 앱이 똑같이 보인다.** 사용자가 "iOS 감성이 아직 안 느껴짐"이라 한 진짜 이유는 색·타이포·여백이 잘못된 게 아니라 **관점이 없었다**는 것.
>
> **결정 (v06.39)**:
> "iOS 인디고/오렌지 시스템 컬러" → **"Reading Room"** 단일 아트 디렉션으로 풀 피벗.

### 컨셉 — "조용한 서재 / 문학적 도구"

금고에서 꺼낸 종이와 잉크, 절제된 한 줄기 금빛. **WordVault(금고/서재) + Calm UI + Memory Decay(기억을 환경으로) + PairFlip 검증된 네이비/골드 + Lora 시그니처** — 프로젝트가 이미 내포한 정체성을 표면화.

### 시그니처 3축

| 축 | Reading Room | 이전 (iOS Indigo) |
|---|---|---|
| **배경** | Paper `#FBFAF6` (warm) + canvas `#F4F0E9` | 흰 `#FFFFFF` + 그레이 `#F2F2F7` |
| **텍스트** | Ink `#1A1714` (warm brown-black) + warm alpha labels | 순흑 + 쿨 알파 |
| **브랜드** | Deep Ink `#0F2540` + Muted Gold `#B0843A` (작은 글자는 `#7E5A1B`) | iOS systemIndigo `#5856D6` |
| **타이포** | **Lora editorial** hero (42-52px display) + Plus Jakarta UI 칩 + DM Sans 한글 | Plus Jakarta hero 32-34px |

> ⚠️ **값의 정본은 이 문서가 아니라 `packages/design-tokens/src/colors.ts` 다.**
> 2026-09-01 실측에서 이 표의 색 여섯이 **전부** 토큰과 달랐다 — Paper `#FAF8F3`→`#FBFAF6` ·
> Ink `#1C1815`→`#1A1714` · 브랜드 `#1E3A5F`→`#0F2540` · 골드 `#B8893B`→`#B0843A`.
> 토큰 파일은 그 값을 명시적으로 거부하고 있었다: `브랜드 = Deep Ink (contemporary depth,
> **NOT old-map navy**)`. 토큰이 v06.40 으로 바뀔 때 이 표가 안 따라온 것이다.
> (아래 §벤치마크 표는 같은 문서 안에서 이미 `#FAF8F3` 이 낡았다고 적고 있었다 —
>  한 문서가 자기 자신과 어긋나 있었다.)
>
> **왜 위험한가**: 아래 §iOS Color SSoT(v06.38)에는 `--p: #5856D6` 이 적힌 **복사하기 좋은**
> **CSS 블록**이 남아 있다. 세 곳이 서로 다른 브랜드 색을 말하면 다음 사람이 어느 것을
> 믿을지 알 수 없다 — 교재 조판기가 자기 팔레트를 따로 갖게 된 원인이 정확히 이것이었다.

### 색상 토큰 — 면(fill) vs 잉크(ink) 분리 규칙 (v07 · 2026-08-09)

**규칙**: 색 토큰은 "칠하는 색"과 "그 위의 글자색"이 다르다. 작은 글자에는 반드시 `-ink` 계열을 쓴다.

| 용도 | 면/아이콘/테두리 | 글자 (AA 4.5:1) |
|---|---|---|
| 골드 강조 | `--active` | `--active-ink` |
| iOS 톤 캡슐 | `--ios-*-tint` | `--ios-*-ink` |
| 학습 상태 (i+1 배지 등) | `--learn-*` | `--learn-*-ink` |
| 브랜드 채움 배지 | `--p` | `--on-p` (테마별 반전) |
| 브랜드 tint 칩 | `--p-light` | `--on-p-tint` (테마별 반전) |
| semantic 칩(성공/오류/주의/정보) | `--success`/`--error`/`--warning`/`--info` (+ tint) | `--success-ink`/`--error-ink`/`--warning-ink`/`--info-ink` |
| Memory Decay 4색 | `--memory-*` | `--memory-*-ink` |
| semantic 채움 버튼(critical/success/info) | `--error`/`--success`/`--info` | `--on-semantic` (테마별 반전) |
| ACP 트랙 액센트 | `--track-*` (테마별 반전) | 같은 토큰 — 라이트=진한 원색 · 다크=밝은 톤 |

**`--t3` 는 텍스트 색이 아니다.** 알파 0.38 은 종이 위 2.35:1 이라 어떤 조합으로도 AA 를 못 넘긴다
(0.62 = `--t2` 가 최소선 4.79:1). 저자명·설명·메타처럼 **의미 있는 글자는 `--t2` 이상**,
`--t3`/`--t4` 는 장식·아이콘·비활성 전용.

측정 근거: ADR-004([DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md)) · 회귀 게이트
`apps/web/tests/e2e/14-learner-quality.spec.ts`(axe WCAG 2.1 AA · 라이트/다크 · 44px 터치 타겟).

### 색상 토큰 (Reading Room)

```css
/* Light Mode — paper + ink + navy + gold */
--p           : #1E3A5F             /* ink navy (brand action) */
--p-hover     : #152A45
--p-light     : #E5EAF1             /* pale navy tint */
--p-dark      : #0F1E33

--active      : #B8893B             /* muted gold — streak, 보상, 시그니처 강조 */
--active-light: #F5EBD4

--success     : #2E7D5A             /* muted forest green */
--error       : #A03A2E             /* warm red (saturated 회피) */
--warning     : #C68A2C             /* warm amber (gold 계열) */
--info        : #5B7A98             /* dusty blue-gray */

--bg          : #FAF8F3             /* warm paper (card) */
--bg2         : #F2EEE6             /* page canvas */
--bg3         : #EAE4D8             /* page edge fill */

--t1          : #1C1815             /* ink primary */
--t2          : rgba(28,24,21,.62)  /* secondary ink */
--t3          : rgba(28,24,21,.38)
--t4          : rgba(28,24,21,.20)

--bd          : #D8D2C2             /* paper hairline */

/* Memory Decay — paper 톤 정합 (채도 1-2단 하향) */
--memory-stable : #2E7D5A
--memory-shaky  : #C68A2C  /* gold 계열 — Reading Room 시그니처 정합 */
--memory-risk   : #A03A2E
--memory-new    : #7A726A

/* Dark Mode — warm ink dark (서재 야간 · 순흑 X) */
--p   (dark)  : #5F8FC0   /* lighter ink navy */
--active(dark): #D4A856   /* lighter muted gold */
--bg  (dark)  : #1F1A14   /* warm dark paper card */
--bg2 (dark)  : #16130E   /* warm dark canvas */
--t1  (dark)  : #F0EAE0   /* warm paper text */
```

### 타이포 시그니처 — Lora editorial 승격

이전: Lora 가 `font-english` (영어 본문 20px) 에만 갇혀 있음. Plus Jakarta(평범한 지오메트릭 산세리프)가 모든 hero 차지.

**v06.39**: Lora 를 **`font-editorial`** 로 승격 → 모든 hero/대형 표시는 Lora. **Dual Coding (Paivio) 의 시각 구현**:
- **영어 표시 → Lora 세리프** (서재의 잉크)
- **한글 표시 → DM Sans 산세리프**
- **UI 칩/메타 → Plus Jakarta** (정밀한 산세리프)

타이포 hierarchy:

```
font-editorial   = Lora bold 500-600  → Hero 42-96px (Page title / 단어카드 / 큰 숫자)
font-display     = Plus Jakarta 600-700 → UI labels / nav / 작은 헤딩 22-26px
font-body        = DM Sans 400-500     → 한글 본문 + UI 14-17px
font-english     = Lora 400            → 영어 본문 17-20px
font-mono        = JetBrains Mono      → 캡션 · 숫자 · 9-12px
```

| 사용처 | 폰트 | 크기 | weight |
|---|---|---|---|
| 페이지 Large Title | `font-editorial` Lora | 42→52px | 600 |
| WordVault hero 숫자 | `font-editorial` Lora | 72→96px | 500 |
| Hub greeting | `font-editorial` Lora | 26→30px | 500 |
| Dashboard greeting | `font-editorial` Lora | 28→34px | 500 |
| BigStat (Hub stats) | `font-editorial` Lora | 30px | 500 |
| Frame section title | `font-display` Plus Jakarta | 22px | 700 |
| 캡슐/배지 | `font-display` Plus Jakarta | 11-13px | 600 |
| 한글 부제 | `font-body` DM Sans | 14-15px | 400 |
| 영어 본문 | `font-english` Lora | 17-20px | 400 |

### Reading Room 디자인 철학 5조

| # | 원칙 | 적용 |
|---|---|---|
| 1 | **순백 X · 순흑 X** | `#FFFFFF` 와 `#000000` 절대 금지. `#FAF8F3` paper / `#1C1815` ink |
| 2 | **Lora 가 hero, Plus Jakarta 는 UI** | 가장 개성 있는 자산을 가장 눈에 띄는 자리에 |
| 3 | **금빛은 시그니처 모먼트에만** | streak / 보상 / 메인 CTA — 화면 면적 5% 미만 |
| 4 | **헤어라인 0.5px + 여백** | 1px 진한 보더 대신 hairline `--bd` + 넉넉한 여백 (카드보다 공기) |
| 5 | **동시 노출 색 3개 이하** | navy(brand) + gold(accent) + memory state 1개 — 그 외 ink + paper |

### iOS 골격은 그대로 (v06.36-v06.38 유산)

토큰 값만 바뀌고 **모든 iOS 프리미티브 + 레이아웃 + 모션 + 접근성 골격은 유지**:
- Card · Frame · SegmentControl · InsetGroup · InsetRow · Capsule · StatPill · ActivityRing · PrimaryButton · GlassBar · SheetContainer · Screen
- `--ios-content-max/wide-max` · `--r-ios-*` · `--sh-ios-*` · `--ease-ios-*` · `--dur-ios-*`
- safe-area / useReduceMotion / prefers-reduced-motion CSS

**이게 CSS 변수 단일 체계의 이점** — 컴포넌트 코드 0줄 수정으로 전체 톤 교체.

---
> 토큰 · 폰트 · 컴포넌트 패턴 · 모션 · 머터리얼 · 접근성 통합. 최근 갱신: 2026-06-13.
>
> **토큰 위치**: `packages/design-tokens/src/tokens.css` (웹 SSoT) + `colors.ts` (RN 공유).
> **iOS 프리미티브**: `apps/web/src/components/ui/ios/` (Card · Frame · SegmentControl · InsetGroup · InsetRow · Capsule · StatPill · ActivityRing · PrimaryButton · GlassBar).

---

## 🛒 매대 시각 상품성 (v06.41 — 2026-09-01 실측)

> **자**: `scripts/textbook/shelf-visual-probe.mjs` — 국내 교재 출판사를 **같은 자로** 잰다.
> 기존 `shelf-ux-probe` 는 *닿는 비용*(스크롤·Tab·밀도)을 재고, 이 자는 *상품으로 보이는가*를 잰다.
> 두 축은 다르다 — 닿는 비용 지수 1.523(목표 1.2)을 넘긴 상태에서도 이미지 면적은 0.56% 였다.

### 기준선 — 실측이지 목표치가 아니다

| 축 | 우리(전) | 우리(현) | NE능률 | 다락원 |
|---|---:|---:|---:|---:|
| 첫화면 이미지 면적 | 0.56% | **17.88%** | 5.3% | 32.2% |
| 표지 크기 | 196px² | **100,048px²** | 15,336px² | — |
| 상품당 이미지 | 2 | **3** | 3 | — |

⚠️ **196px² 는 14×14 다 — 표지가 아니라 아이콘이었다.** 그 전의 "표지"는 46×64 CSS
그라디언트 칩이라 이미지로 세지지도 않았다. 이것이 "이미지가 거의 없고 텍스트 위주" 의 정체다.

### 표지 — 정본은 `textbook/cover.ts`

- **매대(웹)와 조판기(책)가 같은 함수를 쓴다.** 서점에서 본 표지와 펼친 책의 표지가
  달라지면 같은 상품으로 안 읽힌다
- **인라인 SVG** — `<img>` 로 쓰면 `var(--…)` 토큰도 페이지 서체도 못 물려받는다.
  인라인이라 다크 테마가 공짜로 따라온다
- 싣는 것 넷: 시리즈명 · 권 번호 · 학령 · 깊이 표시. **그림은 넣지 않는다** —
  지문이 13곳에서 오는데 어느 그림도 그 전부를 대표하지 못하고, 대표하는 척하면
  표지가 내용을 오해하게 만든다
- 클라이언트 컴포넌트는 **서브패스 `@vocaflow/library-pipeline/textbook-cover`** 로 들어온다.
  패키지 루트를 import 하면 적재 스크립트의 `child_process` 까지 딸려와 화면이 500 이 된다

### 단어장 표지 — 정본은 **DB 의 각인**이지 코드가 아니다

교재 표지는 코드(`textbook/cover.ts`)가 정본이지만 단어장 표지는 다르다. 계열 다섯의 규격을
Claude Design 캔버스에서 확정해 `shared_word_sets.curation_query.brand` 에 각인하고
(`VocabBrandCanvas` · 브랜드 드레인 3단), **화면은 그 각인을 읽는다.**

| 각인이 정하는 것 | 화면에서 |
|---|---|
| `family` | 도형 문법 + 듀오톤 (`VocabCoverArt` · `coverArtFor`) |
| `lockup.kicker` | 표지 왼쪽 위 |
| `lockup.volumeFormat` | 오른쪽 위 — `{n}` 은 **계단 번호가 아니라 권 이름**(`volumeMark`) |
| `lockup.titleMaxLines` | 제목 클램프 (`GradientBookCover`) |
| `coverGrid.ratio` | 표지 `aspect-ratio` |
| `coverGrid.plateInset` | 도판 여백 |
| `coverGrid.scrimStrength` | 제목 띠 스크림 |
| `palette` · `typography` | 역할 → 토큰(`resolveBrandColors` · `font-*`) |
| `seriesLine` | 표지 아래 계열 줄 |

⚠️ **글자(kicker · 권 번호 · 계열 줄)는 히어로 표지(270px)에만 그린다.** 격자 타일(150px)은
네 귀퉁이가 이미 칩으로 차 있다 — 좌상 구독/신규(y 12~32) · 우상 사다리 `5단 · 고1`(y 12~32) ·
좌하 카테고리+구독수 · 우하 추가 버튼. kicker 는 좌상 칩과 겹치고, 권 번호는 사다리 칩과 같은
자리에서 **다른 수**를 말한다(`VOL. 4` vs `5단`). 그래서 타일은 `drawLockup={false}` 로
**자리가 없다는 사실을 코드가 말한다** — 겹쳐 그려 놓고 규격을 지켰다고 하지 않는다.
값(판형·여백·스크림·줄 수·색·서체)은 두 표면 모두 규격을 따른다.

⚠️ **코드에 남은 값은 규격이 아니라 하한이다**(`covers/contrast.ts`) — 각인이 없는 권
(도서 챕터·글 단어장)만 그것을 쓴다. 규격이 화면과 안 맞으면 **코드가 아니라 캔버스를 고친다.**
실제로 480px 판형에서 정한 「제목 2줄」이 150px 타일에서 여섯 권의 제목을 잘랐고, 그때 고친 것은
캔버스였다(2 → 4줄).

⚠️ 규격이 **적재만 되고 읽히지 않는 상태**가 실제로 있었다 — 여덟 항목 중 계열 하나만
화면에 닿았고 나머지 일곱은 코드 사본이 따로 있었다(스크림은 0.35 vs 0.4 로 이미 갈려 있었다).
그 상태는 타입도 렌더도 안 잡는다. 회귀 `lib/vcb/covers/__tests__/lockup.test.ts` 25종 +
`VocabSetCard.test.tsx` 의 변이 검사(규격을 바꾸면 표지가 따라 바뀌는가)가 그 자리를 잠근다.

### 진열 — 기본은 격자

같은 매대를 두 진열로 재니 격자가 **세 축 모두**에서 이겼다(절충이 없었다):

    목록  이미지면적  4.48% · 첫화면상품 2 · 표지  17,584px²
    격자  이미지면적 30.53% · 첫화면상품 3 · 표지 100,048px²

상업 서점은 예외 없이 표지가 먼저다(교보 썸네일 기본 · 다락원 이미지 보기).
⚠️ 묶음을 푸는 조건은 **정렬을 골랐을 때**이지 *격자를 골랐을 때*가 아니다 —
진열과 묶음은 서로 다른 축이다. 둘을 묶어 두면 기본값을 바꾸는 순간 학령 팻말이 사라진다.
(묶음을 살린 대가로 30.53% → 17.88% 로 내려간다. 그래도 NE능률의 3.4배라 팻말을 지울 이유가 없다.)

### 배지 — 셀 수 있는 것만

상업 매대는 표지 모서리에 판매 신호를 붙인다(다락원 '강의용PPT' · 교보 '베스트').

🚫 **지어낸 신호를 붙이지 않는다** — '베스트'·'추천'·'인기' 는 근거가 없다.
2026-08-16 에 요금제가 지어낸 지표("학습자 12,000+")를 걸고 있다가 걷어낸 이력이 있다.

✅ 지금 쓰는 것: **`해설 100%`** — 시중 교재가 **못 하는 말**이다. 종이책은 인쇄된 뒤에
몇 %에 해설이 붙었는지 셀 방법이 없다. 우리는 셀 수 있다.

### 식별색 — **색상 = 갈래 · 명도 = 수준**

두 축을 겹치지 않게 나눠 쓰면 표지 하나가 둘을 동시에 말한다. 매대에서 상품이
서로 구별되는 유일한 장치이므로, 값이 아니라 **잰 수치**로 관리한다.

| | 정본 | 색 수 | 무엇을 말하나 |
|---|---|---:|---|
| 교재 | `textbook/cover.ts` `RUNG_INK` | 7 | 사다리 **계단**(초등 저학년 → 고3·수능) |
| 단어장 | `lib/library/book-cover.ts` `CATEGORY_HUE` | 10 | 단어장 **유형**(유아 → 테마별) |

**실측 (2026-09-01)** — 바꿀 때 다시 재야 하는 값:

    교재 계단 7색   종이 대비 5.23~13.60 · 최소 RGB 거리 40.0 (5단↔6단)
    단어장 유형 10색 흰글자 대비 4.63~10.31 · 최소 RGB 거리 37.3 (초등↔테마별)
    유형 칩 글자 8색 바탕 대비 4.51~10.31 · 최소 RGB 거리 33.1 (초등↔테마별)

**왜 색상환에 36° 균등인가**: 임의 간격으로 앉히면 어딘가 두 유형이 붙는다 —
첫 배치에서 중등↔테마별이 RGB 22.4 로 사실상 같은 색이었다.

**왜 색면이 필요한가**: 계단 색을 책등(폭 3.5%)과 숫자에만 넣었더니 일곱 권의 **평균색이
전부 베이지**였다. 색이 있어도 **면적이 없으면 구별되지 않는다** — 그래서 표지 아래 42%가 색면이다.

⚠️ **표를 두 벌 두지 말 것.** `VocabSetCarousel` 이 지역 색표를 따로 갖고 있던 동안 같은
'수능·내신' 이 **칩에서는 호박, 표지에서는 인디고**였고, 그 표엔 `preschool` 이 없어 유아
단어장이 조용히 테마 색으로 떨어졌다. 지금은 `categoryIdentity()` 하나가 표지·칩·상세를
모두 먹인다 — 그것도 그라디언트를 스스로 계산하지 않고 **`bookCover()` 에게 물어본다**
(처음엔 명도를 따로 적었다가 40 vs 46 으로 갈렸고 계약 테스트가 잡았다).

⚠️ **옅은 바탕은 유형을 말할 수 없다.** 거의 흰 색끼리는 원리상 멀어지지 않는다 —
L=91% 에서 최소 거리 6.8 · 88% 에서 10.0 · 84% 까지 내려도 15.5 로, 눈에 갈리는 30 에
못 미친다. 더 내리면 칩 행이 시끄러워져 Calm UI 를 깬다. **구별은 글자색이 진다**(33.1).

⚠️ **흰 글자용 색을 옅은 바탕 글자에 재활용하지 말 것.** `accent` 는 *흰 글자가 얹히는*
밝기까지만 내려간 색이라 옅은 바탕 위에서는 4.5 를 못 넘는다 —
실측 여덟 중 넷이 미달(고등 4.19 · 중등 4.16 · 초등 4.18 · 테마별 4.13)이었다.
그래서 `ink` 를 따로 둔다(그 바탕을 기준으로 다시 내린 색).

회귀: `packages/library-pipeline/src/textbook/cover.test.ts`(13) ·
`apps/web/src/lib/library/__tests__/book-cover-category.test.ts`(13).

---


## 🎨 iOS Color SSoT (v06.38 — Indigo 학습 브랜드 + Learning Color Effect)

> 🚫 **이 절의 색 값은 폐기됐다 (v06.40 에서 교체).** `--p` 는 더 이상 Indigo `#5856D6` 이
> 아니라 **Deep Ink `#0F2540`** 이고, 액센트는 Muted Gold `#B0843A` / `#7E5A1B` 다.
> 아래 CSS 블록을 **복사하지 말 것** — 현재 값은 `packages/design-tokens/src/colors.ts` 에 있다.
>
> 절을 지우지 않는 이유는 **판단 근거가 아직 유효**하기 때문이다: "3rd party iOS 앱은 자기
> 브랜드 색 + iOS 구조" 라는 관찰이 v06.40 의 Deep Ink 선택으로 이어졌다. 바뀐 것은 어떤
> 색이냐이지, 자기 색을 갖는다는 원칙이 아니다.

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

### 🔤 iOS Typography SSoT (v06.38.1 — 강화)

타이포그래피가 iOS 감성을 결정하는 두 번째 축. 색상 → 형태 → **타이포** 순으로 인지된다.

#### 폰트 스택 — iOS/macOS는 진짜 SF Pro 렌더

```ts
// tailwind.config.ts (v06.38.1)
display: ["-apple-system", "BlinkMacSystemFont", "SF Pro Display",
          "Plus Jakarta Sans", "system-ui", "sans-serif"]
body:    ["-apple-system", "BlinkMacSystemFont", "SF Pro Text",
          "DM Sans", "system-ui", "sans-serif"]
```

**효과**: iOS/macOS 사용자 → 시스템이 자동으로 **SF Pro Display** (Large Title) / **SF Pro Text** (Body) 적용. 다른 OS(Windows·Linux·Android) → Plus Jakarta Sans / DM Sans fallback. **사용자 디바이스가 Apple이면 진짜 iOS 폰트**가 렌더링됨.

#### iOS Type Ramp (Vocaflow 적용)

| iOS HIG | Spec | Vocaflow 사용처 |
|---|---|---|
| **Large Title** | 34pt / `font-[700]` / `tracking-[-0.028em]` / `leading-[1.05]` | 페이지 메인 타이틀 (Library/Settings/Diagnostic 등 5 페이지) |
| **Title 1** | 28pt / `font-[700]` / `tracking-[-0.026em]` | 페이지 부 타이틀 |
| **Title 2** | 22pt / `font-[700]` / `tracking-[-0.024em]` / `leading-[1.1]` | **Frame 섹션 타이틀** (Card 내부 헤더) |
| **Title 3** | 20pt / `font-[600]` / `tracking-[-0.022em]` | 소섹션 타이틀 |
| **Headline** | 17pt / `font-[600]` / `tracking-[-0.018em]` | InsetRow title · 강조 메타 |
| **Body** | 17pt / `font-[400]` | 본문 텍스트 (Workspace Reading) |
| **Callout** | 16pt / `font-[400]` | 보조 본문 |
| **Subheadline** | 15pt / `font-[400]` | **페이지 hero 부제** · InsetRow subtitle |
| **Footnote** | 13pt / `font-[600]` | More 링크 · 메타 캡션 (Frame meta) |
| **Caption 1** | 12pt / `font-[600]` mono uppercase | InsetGroup header · stats 캡션 |
| **Caption 2** | 11pt / `font-[600]` mono | 작은 라벨 |

#### iOS Typography 핵심 원칙

| # | 원칙 | Vocaflow 적용 | 안티패턴 |
|---|---|---|---|
| 1 | **Bold = `font-[700]`, 절대 `font-[800]` X** | Hero/Title 전부 700 | ❌ `font-extrabold` (안드로이드 Material 톤) |
| 2 | **Display 트래킹 매우 타이트** | Large Title `-0.028em` | ❌ `tracking-tight` (Tailwind 기본 -0.025em → 약함) |
| 3 | **Large Title line-height 매우 좁게** | `leading-[1.05]` | ❌ `leading-tight` (1.25 — 너무 떨어져 보임) |
| 4 | **Body는 17pt 표준, 부제는 15pt** | hero subtitle 15px | ❌ 14px 이하 (정보 밀도만 높고 가독 X) |
| 5 | **Footnote = bold semibold 600** | More 링크 14px 600 | ❌ 13px 700 (너무 진해 보임) |
| 6 | **Caption은 mono uppercase tracking-wide** | InsetGroup header 9.5px 700 0.16em | (이미 적용) |
| 7 | **숫자는 항상 `tabular-nums`** | Hero/StatPill 모든 숫자 | ❌ proportional figures (정렬 깨짐) |

---

### iOS HIG 3대 색상 시스템

| 시스템 | iOS Spec (Vocaflow 채택) | Vocaflow 토큰 | 용도 |
|---|---|---|---|
| **System Tint (브랜드)** | **`systemIndigo` `#5856D6`** (light) / `#5E5CE6` (dark vivid) | `--p` | 모든 액션·링크·액센트의 표준 — 단 하나의 tint |
| **System Colors** | red/orange/yellow/green/blue/indigo/purple/pink 등 | `--ios-*` + semantic `--success/--error/--warning/--info` | 의미별 액센트 (red=destructive, green=success, orange=warning) |
| **Grouped Background** | `systemGroupedBackground` `#F2F2F7` light / `#000000` dark | `--bg2` (캔버스) + `--bg` (카드) + `--bg3` (셀 fill) | 그레이 캔버스 위에 떠있는 흰 카드 — iOS Settings 시그니처 |
| **Label Colors** | `label` `#000000` → `quaternaryLabel` `rgba(60,60,67,.18)` (4단계 알파) | `--t1` → `--t4` | warm-neutral 라벨, 어떤 배경 위에서도 자연스러운 알파 기반 |
| **Separator** | `#C6C6C8` light / `#38383A` dark | `--bd` | 셀 구분선 — 정확한 iOS 그레이 |

### 색상 토큰 카탈로그 (v06.38) — 🚫 **폐기된 값. 복사 금지**

```css
/* Light Mode — iOS HIG 정확 + 학습 브랜드 (Indigo) */
--p           : #5856D6              /* 🚫 폐기 — 현재 #0F2540 (Deep Ink) */
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
| **Reduce Motion** | `globals.css` `@media (prefers-reduced-motion: reduce)` — 키프레임은 끄고, **전환은 `--dur-fast` 로 낮추며 대상을 비-모션 속성으로 제한**하는 글로벌 가드 (§3.1). **앱 안의 토글**은 OS 미디어쿼리를 바꿀 수 없으므로 별도 후크 `html[data-reduced-motion='on']` 을 쓴다 — `components/layout/DevicePreferences.tsx`(루트 레이아웃에 1회 마운트) 가 `localStorage` 의 취향을 읽어 칠하고 같은 낮추기 규칙을 싣는다(키프레임은 남긴다 — 스켈레톤·스피너는 상태 표시다). 설정 화면은 `useMotionPreference()` 로 저장 결과(boolean)를 받아 「저장됨」을 띄운다 | `useReduceMotion()` ([useReduceMotion.ts](../apps/web/src/hooks/useReduceMotion.ts)) — `transition: 'none'` 등 inline style 분기. ActivityRing/SheetContainer 등 JS-driven 애니메이션은 inline style 우선순위가 CSS guard 보다 높아 명시 분기 필수. |
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

  /* Layout — 모바일 하단 탭 (components/layout/MobileTabBar) */
  --tabbar-h: calc(56px + env(safe-area-inset-bottom, 0px));
}

/* md 이상은 사이드바가 내비를 맡아 탭이 없다 → 비켜 줄 자리도 없다 */
@media (min-width: 768px) {
  :root { --tabbar-h: 0px; }
}
```

**`--tabbar-h` 사용 규약** — `fixed bottom-0` 을 새로 쓰지 않는다. 모바일 하단은 탭이 이미 쓰는
자리라 페이지 소유 하단 고정 UI(만화 리더 컷 바 · 워크스페이스 오디오)는 `bottom-[var(--tabbar-h)]`
로 그 위에 앉는다. 겹침 여부는 z-index 가 아니라 **히트 테스트**(`elementFromPoint`)로 판정한다
— 실측에서 `z-30` 리더 바가 `z-40` 탭에 가려 '다음 컷' 이 눌리지 않았다. 상세: [CONVENTIONS.md](./CONVENTIONS.md) §하단 고정 UI.

```css
/* (아래는 다크 모드 계속) */

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

### 게임 전용 하드코딩 색상 (예외) — 2026-09-06 실측으로 정정

```css
/* ── WordBlitz 정글 전용 — 변경 금지 ── */
#FFE234  /* 황금 점수 텍스트 */
#3d8a3d  /* 정글 배경 기본 그린 */

/* ── SpellForge 파란 패널 — 변경 금지 ── */
#4A9FCF  /* 패널 메인 */
#5CB8E0  /* 패널 라이트 (그러데이션 시작) */
#3A7FAF  /* 패널 다크 */

/* ── PairFlip Editorial — 변경 금지 ── */
#1E3A8A → #1E1B4B  /* 네이비/인디고 그라디언트 */
#F59E0B            /* 골드 */
#FCD34D            /* 골드 라이트 (진행바 그러데이션 끝) */
```

#### 이 목록은 **양방향으로 낡아 있었다**

| | 실측 (2026-09-06) |
|---|---|
| **유령 예외 6색** | Flashcard 카드 gradient(`#FFFDE7 #FFF9C4 #FFF59D` / `#E8F5E9 #C8E6C9 #A5D6A7`)가 **저장소 전체에 0건**이었다. 없어진 색을 "변경 금지" 로 지키고 있었다 → 삭제 |
| **누락** | `#5CB8E0`(SpellForge) · `#FCD34D`(PairFlip)가 쓰이는데 목록에 없었다 → 추가 |
| **목록 밖 하드코딩** | 학습자 컴포넌트(admin·`game/` 제외)에 hex **422건**. 그중 예외 명시 모듈(pairflip 102)을 빼면 **약 308건**이 `library` 87 · `comic` 51 · `pirate-quest` 45 · `textviewer` 36 · `wordvault` 27 · `dictation` 17 … 에 흩어져 있다 |

**308건은 이번에 고치지 않는다.** 이 저장소의 진단 규칙이 「측정 → 기록 → (별도 결정) → 수정」이고,
같은 턴에 고치면 측정이 오염된다([PLATFORM_AUDIT.md](./PLATFORM_AUDIT.md) §4). 그리고 이 세션이
바로 그 반대의 교훈을 얻었다 — **지침이 코드보다 넓으면 멀쩡한 화면이 위반으로 잡힌다**(§3.2).
색 축의 예외 범위를 먼저 정하지 않고 회귀부터 걸면 308건이 전부 오탐이 된다.

**대신 문서가 스스로 검증되게 했다** — `components/__tests__/learning-tone.test.ts` 가
이 목록의 모든 색이 **실제로 코드에 있는지** 검사한다. 유령 예외는 다시 생길 수 없다.

---

## Memory Decay 색 체계 (앱 전용)

위치: `globals.css` (앱 도메인 토큰). 4단계는 **모든 학습 모듈에서 동일** — 상태 일관성이 학습자 멘탈 모델의 핵심.

| 상태 | 이름 | 원색 토큰 | 값 | 글자용 잉크 | 표현 |
|---|---|---|---|---|---|
| stable | **안정** | `--memory-stable` | `#2E7D5A` | `--memory-stable-ink` | 1px solid border-bottom |
| shaky | **흔들림** | `--memory-shaky` | `#B5803A` | `--memory-shaky-ink` | 1.5px dashed border-bottom |
| risk | **흐릿함** | `--memory-risk` | `#9C3A30` | `--memory-risk-ink` | 1.5px dashed + `word-pulse` |
| new | **새 단어** | `--memory-new` | `#8A8278` | `--memory-new-ink` | gradient 하이라이트 |

**이름은 `lib/framework/memory-labels.ts` 가 소유한다 — 화면에서 짓지 말 것** (v06.202).
실측 2026-08-16 에 여섯 곳이 **다섯 벌**을 쓰고 있었고, `/wordvault` 한 화면 안에서
히어로("확실·익숙·회복")와 아래 섹션("안정·흔들림·위급")이 동시에 떠 있었다.
`shaky → '익숙'` 은 방향까지 반대였다. `MEMORY_LABEL[state].{label,says,token}` 을 import 할 것.
- risk 는 `위급` 이 다수(3/5)였지만 쓰지 않는다 — 응급실 말투는 금지된 압박 표현이고
  `안정·흔들림·흐릿함` 이라야 **선명도라는 한 축**으로 읽힌다
- `shaky + risk` **합계**에는 상태 이름을 붙이지 않는다 → `MEMORY_ATTENTION_LABEL`(`'다시 볼'`).
  구성 요소의 이름을 집계에 붙였다가 리본 135 · WordVault 20 이 동시에 뜬 적이 있다
- 래칫: `lib/framework/__tests__/memory-labels.test.ts` — 속성(`label: '…'`)과 **JSX 텍스트
  노드** 둘 다 잡는다(전자만 볼 때 리본을 놓쳤다)

**원색 vs 잉크**: 면·점·막대는 원색, **작은 글자는 잉크**. shaky 원색은 `--bg` 위 3.29:1 로
AA 미달이다. `StatPill` 처럼 점과 숫자를 함께 쓰는 컴포넌트는 점에 원색, 숫자에 잉크를 준다.

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

### 카드 + 보조 액션 — `.arc-slot` 패턴 (v08.3)

카드 전체가 링크(`<a>`)인데 그 위에 **또 다른 조작**(설명 열기 등)을 얹어야 할 때.
`<a>` 안에 `<button>` 을 넣는 것은 HTML 위반이고 스크린리더·키보드에서 깨진다.

```jsx
<div className="arc-slot">          {/* position: relative */}
  <a className="arc-card" href="…">…</a>
  <button className="arc-brief" />   {/* position: absolute; 우상단 44×44 */}
</div>
```

- 카드 상단은 `padding-right: 44px` 로 버튼 자리를 **비워 둔다**(칩이 밑으로 흐르지 않게)
- hover 효과는 `.arc-slot:hover .arc-card` 로 올려 두 형제가 한 장처럼 반응하게
- DOM 순서 = 탭 순서: 카드 → 보조 액션

### Protocol 다이얼로그 (v08.3 · `components/game/brief/`)

세션 **진입 전** 국면에서만 여는 설명 오버레이. (세션 중 오버레이는 금지 — 아래 안티패턴 참조)

- `role="dialog"` + `aria-modal="true"` + `aria-labelledby` · Esc 닫기 · **Tab 순환 트랩** · 닫을 때 트리거로 포커스 복귀
- `document.body` 로 포털 · 열려 있는 동안 `body { overflow: hidden }`
- 헤더/푸터 고정, **본문만 스크롤**(`overscroll-behavior: contain`)
- ≤620px 는 바텀 시트(`align-items: flex-end` + 상단만 라운드)
- 설명은 글이 아니라 **보드 그림**으로 — 같은 렌더러를 `figure`(정적)/`trial`(클릭 가능) 두 모드로 재사용
- 상태는 색 + 아이콘(`✓`/`✕`) + 테두리 3중. 색 하나만으로 정보를 나르지 않는다

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

## 화면 계측 훅 — 디자인을 눈대중으로 판정하지 않기 (v06.202)

`tests/e2e/91-hub-design-capture.spec.ts` 는 **회귀 스펙이 아니라 판정 도구**다. 화면마다
같은 잣대(카드 높이 균질성 · 제목 줄 수 · 전체 높이 · 첫 콘텐츠까지 거리 · 접힌 요소)를 낸다.

**새 화면을 만들면 두 가지를 하라**
| 훅 | 어디에 | 왜 |
|---|---|---|
| `data-design-card` | 반복 카드의 **루트** | 안 달면 그 화면은 "카드 0개(측정 안 됨)" 로 남는다 — 실측 2026-08-16 에 15 라우트 중 9개가 그랬다 |
| `data-design-title` | 카드 안 **메타데이터 제목** | 표지 아트의 글자(`GradientBookCover` 등)를 제목으로 세면 정상 격자가 "기준선 어긋남" 으로 나온다 |

반복 카드가 원래 없는 화면은 하네스의 `ALL_ROUTES` 에 **`nocards: '이유'`** 를 선언한다.
"셀렉터가 못 잡음(결함)" 과 "원래 없음(정상)" 을 같은 경고로 찍으면 후자가 전자를 가린다.

**계측이 만든 가짜 결함 5종** — 같은 함정을 다시 파지 않도록 각각 코드 주석으로 남겨 뒀다:
줄 판별에 `offsetTop`(=offsetParent 기준) · `<details>` 안 숨은 카드(offsetHeight 0) ·
태그 안 된 첫 콘텐츠가 `firstCardRatio` 를 부풀림 · 표지 아트 제목 · 격자 전체를 한 줄로 셈.
**수치가 이상하면 화면보다 먼저 그 수치를 만든 코드를 의심할 것.**

⚠️ 다크 전수 캡처는 1회 실행 시 브라우저가 죽는다(`settle` 중 context closed) — 4~6 라우트씩
배치로 돌린다. 그리고 `test-results/` 는 다른 스펙 실행이 통째로 지우므로 캡처는 그때그때 다시 뽑는다.

### 섹션 껍데기는 `Frame` 이다 — 손으로 만들지 말 것

`components/ui/ios/Frame.tsx` = `Card` + `h2 22px/600` + `meta` + `moreHref`.
`/wordvault` 섹션 6종 중 하나만 자기 껍데기(`border + p-4`, `h2 15px`)를 갖고 있었고,
훑으면 그 구역만 한 단계 작아 보여 **덜 중요한 것으로 읽혔다**(v06.202 에서 통일).

### 상태로 버튼 색을 바꾸지 말 것

한 자리의 1차 행동은 한 색이다. `/wordvault` 히어로 CTA 가 risk→`--error` · shaky→`warning` ·
new→`info` 로 돌았는데, **밀린 복습은 오류가 아니다**(FSRS 가 정상 동작한 결과). 긴급도는
문구와 옆의 수치가 이미 말한다 — 버튼 색으로 한 번 더 소리치면 그 화면에서 가장 큰 채도
덩어리가 되어 나머지가 배경으로 밀린다.

---

## 접근성 / 안티패턴

### 클릭되는 것은 버튼이어야 한다 (v06.203 훑기)

`<div onClick>` 은 **보이기만 인터랙티브**다 — 키보드로 닿지 않고 스크린리더가 읽지 않는다.
학습자 화면 전체(admin 제외)를 훑어 비인터랙티브 요소의 `onClick` 15건을 확인했다.

| 판정 | 건수 | 내용 |
|---|--:|---|
| 🔴 **실제 결함** | 1 | `WordRow` 재생 — ▶ 가 `aria-hidden` 장식이고 행 `div` 의 onClick 이 유일 경로였는데, 단어·뜻·예문 열이 `stopPropagation` 을 걸어 **가장 누를 법한 곳이 죽어 있었다.** 키보드 경로는 아예 없었다 → 진짜 `<button aria-label>` 로 전환 |
| ✅ 제대로 갖춤 | 2 | `StatCard`(role·tabIndex·**onKeyDown**) · `Card`(flashcard — 전역 Space/Enter 핸들러가 `FlashcardSession` 에 있다) |
| ✅ 배경 클릭 | 2 | `InsightPanel`·`SeriesInfoModal` 닫기 오버레이(`aria-hidden` / `role="presentation"`) |
| ✅ 전파 차단용 | 3 | `WordRow` 의 텍스트 열 — 동작이 아니라 선택을 위한 `stopPropagation` |
| ✅ 대체 경로 있음 | 2 | `InputSlots`(SpellForge 는 입력을 프로그램적으로 포커스 — 클릭 없이 타이핑된다) 외 |
| ⚠️ **알고 남긴 것** | 2 | `ChapterContent`·`ReadingUniverse` 의 **본문 단어 클릭 조회** — 마우스·터치 전용. 단어마다 포커스를 주면 읽기가 망가진다(탭 수백 번). 대체 수단이 생기기 전까지 감수 |

**교훈**: `role`·`tabIndex`·`aria-label` 이 붙어 있어도 **키 핸들러가 없으면 조작이 안 된다** —
`div` 는 Enter/Space 로 click 을 만들지 않는다. 셋을 붙였으면 `onKeyDown` 도 붙었는지 볼 것.

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
- **빈 상태를 두 칸 잡아 두 번 알리기** — `/wordblitz` 의 "최고 기록"·"최근 기록" 두 카드가
  각각 "아직 기록이 없어요…" 를 띄워 모바일의 40% 를 먹고 시작 CTA 를 접힘선 아래로 밀었다.
  없는 것은 한 줄로 말하고 자리를 비운다 (v06.202)
- **낡은 산출물을 현재 것처럼 내걸기** — Report 카드가 6주 전 리포트를 날짜만 적어 보여 줬다.
  파이프라인이 멈춘 것은 별건이지만 **멈춘 걸 감추는 것은 화면의 문제**다. 나이를 함께 적을 것
- **오류 색(`--error`)을 오류가 아닌 것에 쓰기** — 복습 밀림·미완료는 학습의 정상 상태다

### PR 자가 점검 (머지 전)
- [ ] 학습 과학 원칙 중 최소 1개에 명시적 기여?
- [ ] Calm UI 위반 없는가? (색·소리·애니메이션 과잉)
- [ ] 회상 부담을 명시적으로 만드는가?
- [ ] 실패가 비난적이지 않은가?
- [ ] 진행을 환경으로 보여주는가?
- [ ] 맥락을 보존하는가? (단어는 스크립트/예문과 결합)
