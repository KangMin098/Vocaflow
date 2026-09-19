# Design System

> 디자인 작업 진입: [DESIGN.md](../DESIGN.md) · 캡처·비평·수정과 로컬 픽셀 비교: [디자인 작업 절차](design/06-workflow.md).

> Vocaflow 디자인 시스템 **현행 SSoT** — v07 「주묵 판면」(Reading Room 지면 위 주묵 한 색) · 2026-09-18 축약판.
> **값의 정본은 코드다**: `packages/design-tokens/src/tokens.css`(웹) · `colors.ts`(RN) · `apps/web/src/app/globals.css`(앱 도메인 토큰).
> 이 문서의 값은 2026-09-18 에 그 파일들에서 읽었다. 어긋나면 코드가 맞고 이 문서가 낡은 것이다.
>
> **이력은 본문에 두지 않는다** — iOS Indigo SSoT(v06.38, 폐기값) · World-class 벤치마크 · Reading Room 정제 경위 ·
> 옛 CSS 변수 블록(Tailwind 기본색) · 버튼 클래스 문자열 · 매대 실측 서사 · 정정 이력 원문은
> [design/archive/DESIGN_SYSTEM_history.md](design/archive/DESIGN_SYSTEM_history.md) 에 1,509줄 그대로 있다.
> 형태를 **만드는** 절차(§G)는 [vocaflow-design](../.claude/skills/vocaflow-design/SKILL.md), 이 문서는 **재료**다.

---

## 🎯 첫인상 · 이탈 방지 · 모션 예산

### 1. 증명 우선 (Proof-first hero)

주장("내가 아는 비율")은 지문 위에 칠해진 그림이다. 산문으로 설명하면 증명이 사라진다.

| # | 규칙 | 검사법 |
|---|---|---|
| **I1** | 공개 화면 above-the-fold 에 제품이 **실제로 수행한 결과** ≥1 | 히어로에 실데이터 렌더 요소 |
| **I2** | 거기까지 클릭 **0** · 입력 **0** | 진입 직후 화면에 보이는가 |
| **I3** | 증명은 **조작 가능** — 값을 바꾸면 즉시 반응 | 컨트롤 ≥1 · 반응 ≤200ms |
| **I4** | 히어로 부제 ≤ **2문장 / 90자** | 글자 수 |
| **I5** | 수치는 **DB 실측 또는 그 자리 계산값**만 | `components/marketing/__tests__/no-hardcoded-stats.test.ts` |
| **I6** | 증명 요소가 **서버 렌더 HTML** 에 남는다 | 초기 HTML 에 텍스트 |
| **I7** | 한글에 `break-keep` — 없으면 390px 에서 낱말이 쪼개진다 | 2026-09-04 랜딩 H1 "다른 겁니 / 다" |
| **I8** | 증명이 접힌 위에서 끝난다 — **판정 기준 1280×900, 모바일 제외** | 모바일도 증명 자체(색칠된 지문+조작+숫자)는 접힌 위(=I2). 예외는 판정선이지 모바일 퍼스트가 아니다 |

**순서**: `증명(작동하는 것) → 근거 1줄 → 다음 문 → 신뢰 수치 → 상세`. AIDA 를 쓰지 않는다 — 교사·학생은 **오늘 쓸 도구**를 찾으러 온다.

### 2. 이탈 방지 — 못 재면 방지도 없다

| # | 규칙 | 근거 |
|---|---|---|
| **D1** | 가치 확인 앞에 로그인·입력·모달을 두지 않는다 | `/fit` 이 공개인 이유 |
| **D2** | 새 공개 화면은 **진입 + 내부 상호작용 이벤트**를 같은 커밋에 | `lib/analytics/events.ts` 닫힌 목록 |
| **D3** | 이벤트 속성은 숫자·불리언·닫힌 열거형만 | 타입이 강제(지문 유출 차단) |
| **D4** | 파생 가능한 것은 수집하지 않는다 | `lib/admin/retention-math.ts` |
| **D5** | 빈 상태에 **다음 한 걸음** | 막다른 화면 = 이탈 |
| **D6** | 실패·오답에서 비난 금지 (정답률 빨간 글씨·경고 아이콘) | 철학 3 |
| **D7** | 가입 → 첫 학습 완료 **화면 전환 ≤ 3** | 실측 3 — 가입→`/hub`→`/diagnostic`→`/flashcard/play`. 회귀 `app/__tests__/activation-path.test.ts`(세 파일에 나뉜 경로라 화면은 멀쩡한 채 4전환이 된다) |

### 3. 모션 예산 — 숫자로 고정

| 항목 | 값 | 토큰 |
|---|---|---|
| 마이크로 (호버·프레스·토글) | **100–200ms** | `--dur-fast` 100ms · `--dur-normal` 200ms |
| 표준 전환 (패널·모달·페이지) | **200–300ms** | `--dur-normal` · `--dur-slow` 300ms |
| 이징 | `cubic-bezier(.4, 0, .2, 1)` | `--ease` |
| 스태거 | **50ms** | §Motion 사용 매핑 |
| 이동 거리 | 마이크로 **4–16px** · 리빌 **20–40px** | — |
| 총 지속 | **1초 초과 금지** (예외: `--dur-breath` 4s 정지 배경 앰비언트) | — |
| 애니메이트 대상 | `transform` · `opacity` **만** | — |

#### 3.1 `prefers-reduced-motion` 은 끄기가 아니라 **낮추기**

`globals.css` 전역 블록 — 회귀 `lib/a11y/__tests__/reduced-motion.test.ts`:

| 대상 | 처리 | 왜 |
|---|---|---|
| 키프레임 애니메이션 | `0.01ms` + `iteration-count: 1` | 늘리면 4s 앰비언트가 빠른 팝이 된다 |
| 전환 시간 | `--dur-fast`(100ms) — 죽이지 않고 낮춘다 | 상태가 바뀌었다는 사실은 남아야 한다 |
| 전환 대상 | `opacity·color·background-color·border-color·outline-color·box-shadow·fill·stroke` 만 | 이동·회전·스케일은 즉시 최종값 |

⚠️ `transform: none` 으로 지우지 않는다(`-translate-x-1/2` 중앙 정렬이 무너진다). 대상 제한과 시간 완화는 **한 쌍**이다.
진입 연출이 꼭 필요한 표면은 자기 규칙으로 **페이드만** 되살린다(`.wayfinder-reveal` → `wayfinder-fade`).
앱 안 토글은 `html[data-reduced-motion='on']`(`components/layout/DevicePreferences.tsx`), JS 구동 모션은 `useReduceMotion()` 분기.

#### 3.2 학습 화면 모션 화이트리스트 (7종 외 금지)

카드 뒤집기 · 정답 `scale(1.05)→1` · 오답 shake 3회 · 진행률 바 · 점수 카운트업 · 페이지 전환 페이드 · 포커스 링.

**항상 금지**: 폭죽 · 콘페티 · 배지 팝업 · 자동재생 캐러셀 · **장식적 상시 모션**(끝나는 상태가 없는 것).
- **로더·스켈레톤은 허용** — 판정 기준은 "반복하는가" 가 아니라 **"끝나는 상태가 있는가"**(2026-09-06, 로더 20곳 오탐 정정).
- **트로피** — 금지는 「진행률 100% 완료 축하」 자리다. 점수·기록 표시의 `Trophy` 는 해당 없음.
- **아케이드 예외** — `components/game/` 는 대상 아님. 학습 모듈(`flashcard` · `dictation` · `spellforge` · `pairflip` · `echo` …)은 예외가 아니다.

회귀: `components/__tests__/learning-tone.test.ts`. 외부 취향 스킬과의 충돌 판정은 [vocaflow-design §2](../.claude/skills/vocaflow-design/SKILL.md).

---

## 🖋 판면 — 지면 · 잉크 · 주묵

**방향 한 줄**: 뜨지 않고 그어진다. 강조는 색이 아니라 자국이다. 밑줄 두께는 데이터다.
(Reading Room 의 지면·잉크 위에 v07 이 **면적을 가진 색 하나 `--ju`** 와 **데이터가 그리는 표식**을 더했다 — 결정 경위 [design/02-directions.md](design/02-directions.md) · 상세 [design/03-system.md](design/03-system.md).)

| # | 원칙 | 값 |
|---|---|---|
| 1 | 순백·순흑 금지 | 지면 `--bg #FBFAF6` · 잉크 `--t1 #1A1714` |
| 2 | 카드가 아니라 판면 | 모든 `--sh-*` = `0 0 0 1px var(--bd)`(헤어라인 링). 실제로 뜨는 것(모달·시트·토스트·팝오버)만 `--sh-float` |
| 3 | radius 는 거의 직각 | `--r-sm/md/lg/xl/2xl` = 2/3/4/5/6px · `--r-full` 은 칩·아바타·진행바만 |
| 4 | 주묵은 앱이 지면에 남기는 표식 | 1차 CTA(화면에 하나) · 활성 표식 · 완료 체크 · 권점. **학습자 오답·위험 상태에는 쓰지 않는다**(회귀 `learning-tone.test.ts`) |
| 5 | 동시 노출 색 ≤ 3 | 잉크(`--p`) + 주묵 + Memory Decay 1개. 나머지는 잉크 알파와 지면 |
| 6 | 눌리면 들어간다 | hover 는 색만 · `active:translate-y-[1px]` · `transition-all` 대신 속성 나열 |

### 면(fill) vs 잉크(ink) — 작은 글자는 반드시 `-ink`

| 용도 | 면/아이콘/테두리 | 글자 (AA 4.5:1) |
|---|---|---|
| 주묵 | `--ju` | `--ju-ink` · 채움 위 `--on-ju` |
| 골드 강조 | `--active` | `--active-ink` |
| 브랜드 채움 / tint | `--p` / `--p-light` | `--on-p` / `--on-p-tint` (테마별 반전) |
| 학습 상태 | `--learn-*` | `--learn-*-ink` |
| semantic | `--success`/`--error`/`--warning`/`--info` | `--*-ink` · 채움 위 `--on-semantic` |
| Memory Decay | `--memory-*` | `--memory-*-ink` |
| ACP 트랙 | `--track-*` | 같은 토큰(라이트=진한 원색 · 다크=밝은 톤) |

**`--t3` 이하를 의미 있는 글자에 쓰지 않는다** — 메타·저자명·설명은 `--t2` 이상, `--t4` 는 장식·비활성 전용.
측정 근거 ADR-004([DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md)) · 회귀 `apps/web/tests/e2e/14-learner-quality.spec.ts`(axe AA · 라이트/다크 · 44px).

### 색 토큰 카탈로그 (현행 · 2026-09-18 실측)

| 토큰 | 라이트 | 다크 | 역할 |
|---|---|---|---|
| `--p` | `#0F2540` | `#6B9BD1` | Deep Ink — 브랜드 행동·링크·포커스(`--bdf`) |
| `--p-hover` / `--p-light` | `#081832` / `#E3E8EE` | `#87B0DC` / `rgba(107,155,209,.18)` | |
| `--ju` / `--ju-ink` | `#C0392B` / `#A8342A` | `#E0705C` / `#E0705C` | 주묵 면·선 / 작은 글자 |
| `--ju-light` / `--ju-wash` | `#F5E4E0` / `rgba(192,57,43,.13)` | `rgba(224,112,92,.18)` / `.20` | 활성 행 / 붓 자국 |
| `--active` / `--active-ink` | `#B0843A` / `#7E5A1B` | `#D4A856` / `#D4A856` | 골드 — 면적 5% 미만 |
| `--success` · `--error` · `--warning` · `--info` | `#2E7D5A` · `#9C3A30` · `#B5803A` · `#50697F` | `#5BA47D` · `#A8443A` · `#CEA254` · `#8AA8C0` | semantic |
| `--accent-plum` | `#7A4A6B` | `#C79AB6` | 여섯 번째 분류 색조(주묵과 헷갈리지 않게 자주 쪽) |
| `--bg` · `--bg2` · `--bg3` | `#FBFAF6` · `#F4F0E9` · `#ECE6DA` | `#231D17` · `#181410` · `#2D261F` | 지면 · 캔버스 · 채움 |
| `--t1` · `--t2` · `--t3` · `--t4` | `#1A1714` · α.74 · α.62 · α.20 | `#F0EAE0` · α.74 · α.62 · α.20 | 잉크 알파 4단 |
| `--bd` · `--bde` | `#E0DBD0` · `#9C3A30` | `#3D362D` · — | 헤어라인 · 오류 테두리 |
| `--grid-line` | `color-mix(--bd 40%, transparent)` | `color-mix(--bd 55%, transparent)` | 모눈 무대(1px · 24px) — 삽화·증명 액자·공개 히어로·빈 상태 바탕만. SVG `<pattern>` 으로만 그린다 · [03-system §3-9](design/03-system.md) |
| `--learn-error` / `-ink` | `#6B6258` / `#57504A` | — | **오답은 중립 흑연**(빨강 아님) |

분류 팔레트(POS 8 · 사이드바 6)는 일반 Tailwind 색조를 지면 색조로 **개수를 보존해** 1:1 로 옮긴 것이다 — 표는 [design/03-system.md §3-2](design/03-system.md).
⚠️ canvas 는 `var()` 를 못 읽는다(조용히 검정). `components/echo/PitchVisualizer.tsx` 두 상수만 hex 로 두고 이유를 적었다.

---

## Memory Decay 색 체계 (앱 전용)

R(t) = `exp(ln(0.9) × t / S)` 를 **동적 계산**한다(`memory_state` 컬럼 저장 금지). 4단계는 모든 학습 모듈에서 동일.

| 상태 | 이름 | 원색 토큰 | 값 | 글자용 잉크 | 조건 |
|---|---|---|---|---|---|
| stable | **안정** | `--memory-stable` | `#2E7D5A` | `--memory-stable-ink` `#1F6B49` | R ≥ 0.95 |
| shaky | **흔들림** | `--memory-shaky` | `#B5803A` | `--memory-shaky-ink` `#7A5200` | 0.70 ≤ R < 0.95 |
| risk | **흐릿함** | `--memory-risk` | `#9C3A30` | `--memory-risk-ink` `#9C3A30` | R < 0.70 |
| new | **새 단어** | `--memory-new` | `#8A8278` | `--memory-new-ink` `#5F5A52` | D/S 미부여 |

- **이름은 `lib/framework/memory-labels.ts` 가 소유한다** — `MEMORY_LABEL[state].{label,says,token}` 을 import. 화면에서 짓지 않는다(2026-08-16 여섯 곳이 다섯 벌을 쓰고 있었다). `위급` 은 쓰지 않는다(압박 말투).
- `shaky + risk` **합계**에는 상태 이름을 붙이지 않는다 → `MEMORY_ATTENTION_LABEL`(`'다시 볼'`). 래칫 `lib/framework/__tests__/memory-labels.test.ts`.
- **원색 vs 잉크**: 면·점·막대는 원색, 작은 글자는 잉크(shaky 원색은 `--bg` 위 3.29:1).
- `--memory-risk` 는 망각도이지 평가가 아니다 — 주묵과 색이 가깝지만 **두께가 함께 말한다**(아래 형태 문법 F1).

---

## ✒ 형태 문법 — 데이터가 선을 긋는다 (공용)

> **2026-09-18 승격.** 이 문법은 CSAT 분석 화면(`visual-analysis.module.css`)과 `components/ui/press` 에서 먼저 자랐고,
> 원 결정은 "모듈 CSS 가 소유 · 공용 토큰 신설 금지"였다. 이 절은 그 결정을 존중해 **토큰을 새로 만들지 않고**
> 기존 토큰만으로 **문법(선의 뜻)** 을 공용으로 적는다. 다른 모듈이 같은 선을 쓰면 **같은 뜻**이어야 한다.
> 두 모듈 이상이 같은 값을 복사하기 시작하면 그때 토큰을 신설하는 개정을 연다(→ [design/DECISIONS.md](design/DECISIONS.md) DD-03).
> 이 문법을 **어떤 화면의 골격으로 세우는가**는 vocaflow-design §G 가 정한다.

### F1. 선의 두께 = 망각도 (`DecayUnderline`)

| 상태 | 두께 | 선 | 색 |
|---|---|---|---|
| risk | **3px** | solid | `--memory-risk` |
| shaky | **2px** | solid | `--memory-shaky` |
| stable | **1px** | solid | `--memory-stable` |
| new | 2px | **dotted** | `--memory-new` |

R(t) 없이는 그을 수 없는 선이다. 정보는 **두께**가 나르므로 색 단독 전달 금지를 장치 자체가 충족한다(`sr-only` 상태명 동반).
FSRS 상태가 없는 표면은 `bandFromOverdue(overdueDays)` 로 **가진 값**만 두께로 옮긴다 — 상태를 지어내지 않는다.
`components/workspace/ReadingUniverse.tsx`(`/text/[id]`)도 2026-09-18 에 F1 로 옮겼다 — 그 전의 v06 표현(1.5px dashed + `word-pulse` 4s **무한** + 하드코딩 `rgba`)은
끝나는 상태가 없는 모션이었다([design/DECISIONS.md](design/DECISIONS.md) DD-06). 평균 신호 라쳇의 `infinite-anim` 이 재발을 막는다.

### F2. 관계 선 — 지지 · 배제 · 유인 · 합류

| 관계 | 선 | 끝 | 라벨 | 선택 시 면 |
|---|---|---|---|---|
| **지지** (근거 → 정답) | `--ju` **실선** | 화살표 | 「정답」 | `--ju-light` + 실선 테두리 |
| **배제** (근거 → 오답 제거, origin `reject`) | `--t2` **점선** | **막대 끝** | 「오답 배제」 | `--bg3` + 점선 테두리 |
| **유인** (오답이 끌어당기는 표현, origin `tempt`) | `--t2` 점선 | **화살표** | 「오답 유인」 | — |
| **합류** (두 문항 → 같은 출제 공식) | 연결선 | `=` 기호 | 공식 이름 | — |

- 배제와 유인은 선이 같고 **끝이 다르다** — 막대는 "여기서 끊긴다", 화살표는 "여기로 끌려간다". 원문 주석도 같은 origin 을 따른다.
- 음성(TTS) focus 에는 별도 「현재 설명」 라벨을 함께 표시한다.
- **막대 길이 = 문장 길이**다. 중요도·숙련도 수치로 쓰지 않는다.

### F3. 기록 지도 — 네 기호 × 네 선

| 상태 | 기호 | 선 |
|---|---|---|
| 탐색 전 | ○ | 점선 |
| 살펴봄 | • | 실선 |
| 공식 보관 | ✓ | 이중선 |
| 재확인 | ↻ | 라벨 |

기호·선·라벨이 셋 다 말한다 — 색만으로 의미를 구분하지 않는다.

### F4. 판면 어휘 (`components/ui/press`)

| 컴포넌트 | 문법 |
|---|---|
| `Rule` | 구획은 상자가 아니라 **괘선 + 번호(`01`) + 라벨** |
| `Panel` | 판면 표면 `paper` / `canvas` / `ju` 3톤 |
| `Wash` | 숫자·낱말 뒤 붓 자국(9° skew, `--ju-wash`, `aria-hidden`) |
| `JuMark` | `dot` 권점 · `check` 마친 것 · `now` 지금 할 것 — 스크린리더 라벨 필수 |
| `SealMark` | 낙관 — 라벨 첫 글자를 Hahmlet 으로 주묵 테두리 안에(28/36/44px). 이모지 얼굴의 자리를 대신한다 |
| `Gwonjeom` | 권점 아이콘 — lucide `Sparkles` 의 자리(「추천·새것·눈여겨볼 것」) |
| `PressButton` | 1차 주묵 채움 / 2차 잉크 외곽 / 3차 글자만 · 48px 하한 · 4상태 |
| `Eyebrow` | 작은 라벨 — 대문자·넓은 트래킹 금지 |

### F5. 비교 판면

두 소재 → 하나의 출제 공식 관계를 **CSS Grid + 괘선**으로 나란히 놓는다(CSAT 홈 `learning-home.module.css` — 2026-09-19 기준 다른 세션의 미커밋 작업).
wrapper 최대 68rem, 읽기면은 42rem. 패턴 교체 `button[aria-pressed]` · 심화 `details/summary` · 필터 `label/select`.

---

## Typography — 4종 고정 (v07)

| 역할 | 글꼴 | Tailwind | 자리 |
|---|---|---|---|
| 한글 디스플레이 | **Hahmlet** 500–600 | `font-editorial` · `font-ko-display` | 제목 · 단어 뜻 · 감성 문장(**이탤릭 없음**) |
| 영어 원문·표제어 | **Lora** 400–600 | `font-english` · `font-editorial` | 지문 · 예문 · 표제어 · 워드마크 · 영어 감성 문장(italic) |
| UI·본문 (한글+라틴) | **IBM Plex Sans KR** 400–700 | `font-display` · `font-body` | 라벨 · 버튼 · 설명 · 내비 |
| 숫자·코드 | **JetBrains Mono** | `font-mono` | 수치 · 키 힌트 · 식별자 (`tabular-nums`) |

```
editorial : var(--font-serif) → var(--font-ko-display) → Lora → Hahmlet → Georgia → serif   (글리프 단위 폴백)
english   : var(--font-serif) → Lora → Georgia → serif        ← 한글을 일부러 넣지 않는다
mono      : … JetBrains Mono → … → var(--font-body) → monospace  ← 한글이 모노 폴백으로 떨어지지 않게
```

- **금지**: Inter · Roboto · Arial · 한글에 Lora · 영어에 산세리프 · Plus Jakarta Sans / DM Sans(v07 에서 제거 — 한글 글리프 0)
- 한글 두 벌은 **`preload: false`**, `subsets` 미지정(수백 조각 전량 preload 방지 — 회귀 `learning-tone.test.ts`).
- `h1~h6` 기본은 세리프(영문 Lora + 한글 Hahmlet, 600) + `word-break: keep-all`.

| 자리 | 크기 |
|---|---|
| Hero · 페이지 제목 (`font-editorial`) | 42–56px (숫자 히어로 72–96px) |
| 섹션 제목 | 22px / 600 |
| 영어 본문 (`font-english`) | 17–20px / 400 / 1.8 |
| 한글 본문 (`font-body`) | 14–17px / 400 / 1.6 |
| 캡션·메타 (`font-mono` / `font-body`) | 11–13px |

---

## Spacing — 4px 기반

`--s-0` 0 · `--s-1` 4 · `--s-2` 8 · `--s-3` 12 · **`--s-4` 16(기본 패딩)** · `--s-5` 20 · **`--s-6` 24(판면 내부)** · `--s-8` 32(섹션 간격) · `--s-10` 40 · `--s-12` 48(페이지 상하) · `--s-16` 64(히어로) · `--s-24` 96 · `--s-40` 160(공개 화면 섹션 간격 390 / 1280+ — [03-system §3-9](design/03-system.md)).

## Elevation · Radius

| | 값 | 쓰는 자리 |
|---|---|---|
| `--sh-xs … --sh-xl` · `--sh-ios-1…3` · `--sh-card` | `0 0 0 1px var(--bd)` | 모든 판면·카드(뜨지 않는다) |
| `--sh-float` · `--sh-ios-4` | 링 + `0 18px 48px -12px rgba(26,23,20,.22)` | 모달 · 바텀시트 · 토스트 · 팝오버 |
| `--r-sm` · `--r-md` · `--r-lg` · `--r-xl` · `--r-2xl` | 2 · 3 · 4 · 5 · 6px | 입력 · 버튼 · 판면 · 시트 |
| `--r-ios-modal` | 10px | 실제로 뜨는 시트 |
| `--r-full` | 9999px | 칩 · 아바타 · 진행바 — **큰 컨테이너·1차 버튼 금지** |

## Motion 사용 매핑

```
버튼 호버:      background-color/border-color/color, var(--dur-normal) var(--ease)  — 뜨지 않는다
버튼 프레스:    translateY(1px)                                                       — 스케일 대신
카드 뒤집기:    rotateY(180deg), 0.55s var(--ease)
정답 피드백:    scale(1.05)→scale(1), --dur-slow, --ease-spring
오답 피드백:    translateX shake 3회, --dur-slow
페이지 전환:    opacity 0→1 + translateY 20→0, stagger 50ms
진행률 바:      width 전환, --dur-slow, --ease-out
점수 카운트업:  0→실제값, 1s, --ease-out
```

## Breakpoints

**390 / 768 / 1280px** (`sm` / `md` / `lg`). 모바일 1열 · 앱 셸 480px · 학습 콘텐츠 `max-w-2xl`(672px) · 대시보드 `max-w-6xl`(1152px).
모바일 하단은 탭이 쓰는 자리 — 페이지 소유 하단 고정 UI 는 `bottom-[var(--tabbar-h)]`(md 이상 0). 겹침은 z-index 가 아니라 `elementFromPoint` 로 판정([CONVENTIONS.md](./CONVENTIONS.md) §하단 고정 UI).

---

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

이 목록은 스스로 검증된다 — `components/__tests__/learning-tone.test.ts` 가 모든 색이 **코드에 실재**하는지 검사한다(유령 예외 금지).
목록 밖 학습자 하드코딩 hex 약 308건(2026-09-06)은 측정만 했고 아직 결정 전이다 — 경위는 archive.
만화 표지 장르색(아트워크)도 예외다. **CEFR 분포 색** `--cefr-a1…c2` 는 WordVault `CEFRDistribution` 6막대 전용.

---

## 매대 — 표지 · 진열 · 식별색 (규칙만; 실측 서사는 archive)

- **교재 표지 정본 = `textbook/cover.ts`** — 매대(웹)와 조판기(책)가 같은 함수. 인라인 SVG(토큰·서체·다크 상속). 싣는 것: 시리즈명 · 권 번호 · 학령 · 깊이. **그림 없음**. 클라이언트는 서브패스 `@vocaflow/library-pipeline/textbook-cover` 로 import(루트 import 는 `child_process` 가 딸려 와 500).
- **단어장 표지 정본 = DB 의 각인** `shared_word_sets.curation_query.brand`(`VocabBrandCanvas`). 코드 값은 하한일 뿐 — 규격이 안 맞으면 **캔버스를 고친다**. 격자 타일(150px)은 `drawLockup={false}`. 회귀 `lib/vcb/covers/__tests__/lockup.test.ts`.
- **진열 기본 = 격자** (목록 대비 이미지 면적·첫 화면 상품 수·표지 크기 세 축 모두 우위). 묶음 해제 조건은 *정렬 선택*이지 *격자 선택*이 아니다.
- **배지 = 셀 수 있는 것만** (`해설 100%`). '베스트'·'추천'·'인기' 금지.
- **식별색 = 색상은 갈래 · 명도는 수준** — 교재 `RUNG_INK` 7색 · 단어장 `CATEGORY_HUE` 10색(색상환 36° 균등), 표지 아래 42% 색면. 표는 한 벌(`categoryIdentity()` → `bookCover()`). 옅은 바탕은 유형을 말하지 못한다 — 구별은 글자색(`ink`)이 진다. 회귀 `packages/library-pipeline/src/textbook/cover.test.ts` · `apps/web/src/lib/library/__tests__/book-cover-category.test.ts`.

---

## 컴포넌트 규약

- **새 화면의 구획은 `components/ui/press`(F4)** 로 만든다. iOS 프리미티브(`@/components/ui/ios` — Card · Frame · SegmentControl · InsetGroup · InsetRow · Capsule · StatPill · ActivityRing · PrimaryButton · GlassBar · SheetContainer · Screen)는 **유지**되며 토큰 교체로 판면 톤을 받는다. 두 벌을 한 화면에 섞어 같은 구획을 두 문법으로 그리지 않는다.
- **섹션 껍데기는 `Frame`** — 손으로 `border + p-4` 를 만들면 그 구역만 한 단계 작아 보인다.
- **상태로 1차 버튼 색을 바꾸지 않는다** — 밀린 복습은 오류가 아니다. 긴급도는 문구와 수치가 말한다.
- **카드 + 보조 액션 = `.arc-slot`** — `<a>` 안에 `<button>` 금지. 형제로 두고 버튼은 우상단 44×44, 카드 상단 `padding-right: 44px`, DOM 순서 = 탭 순서.
- **설명 오버레이는 세션 진입 전에만**(`components/game/brief/`) — `role="dialog"` + `aria-modal` · Esc · Tab 트랩 · 포커스 복귀 · ≤620px 바텀시트 · 상태는 색+아이콘+테두리 3중.
- **아이콘 = lucide-react** 12–20px · `strokeWidth` 2 · `currentColor` · **둥근 컨테이너에 담지 않는다**. 세션 머리·채점 이모지 금지(→ `SealMark` · 채움 눈금 1~4칸).
- **폼**: 레이블 필수(placeholder 대체 금지) · 오류는 `--bde` 테두리 + 문구 · disabled 는 `opacity-50` + `cursor-not-allowed`.

## 화면 계측 훅

`tests/e2e/91-hub-design-capture.spec.ts` 는 판정 도구다(카드 높이 균질성 · 제목 줄 수 · 첫 콘텐츠까지 거리).
새 화면: 반복 카드 루트에 `data-design-card`, 메타데이터 제목에 `data-design-title`. 반복 카드가 원래 없으면 `ALL_ROUTES` 에 `nocards: '이유'`.
**수치가 이상하면 화면보다 먼저 그 수치를 만든 코드를 의심한다**(계측이 만든 가짜 결함 5종 — archive).

---

## 접근성 / 안티패턴

### 접근성 필수
- 모든 인터랙티브 ≥ 44×44 · WCAG AA 대비 · `:focus-visible { outline: 2px solid var(--bdf) }`
- 색 + 형태 + 텍스트 3중 표현 · `aria-label` / `role` / `aria-live`
- 클릭되는 것은 `<button>`/`<a>` — `div onClick` 에 `role`·`tabIndex` 를 붙였으면 **`onKeyDown` 도**(Enter/Space 는 div 에서 click 을 만들지 않는다)
- 키보드: Tab / Esc / Enter / Space / 방향키 · 한국어 IME 조합 보호는 입력 컴포넌트 책임

### 안티패턴 (절대 금지)
- 정답률 빨간 글씨 압박 · "오답"을 부정적 색만으로 표시
- 모달 오버레이로 학습 중단 · "Are you still there?" · 학습 흐름 중 광고·업셀
- 진행률 100% 에 폭죽·트로피 — "오늘 잘 마쳤어요"
- 빈 상태를 두 칸 잡아 두 번 알리기 — 없는 것은 한 줄로 말하고 자리를 비운다
- 낡은 산출물을 현재 것처럼 내걸기 — 나이를 함께 적는다
- 오류 색(`--error`)을 오류가 아닌 것(복습 밀림·미완료)에 쓰기

### PR 자가 점검 (머지 전)
- [ ] 학습 과학 원칙 중 최소 1개에 명시적 기여? (철학 4 · 원칙 7 정본은 [AGENTS.md](../AGENTS.md) · [LEARNING_MODEL](./LEARNING_MODEL.md))
- [ ] Calm UI 위반 없는가? (색·소리·애니메이션 과잉)
- [ ] 회상 부담을 명시적으로 만드는가?
- [ ] 실패가 비난적이지 않은가?
- [ ] 진행을 환경으로 보여주는가?
- [ ] 맥락을 보존하는가? (단어는 스크립트/예문과 결합)
- [ ] 골격이 형태 문법(F1–F5) 또는 vocaflow-design §G1 축 중 하나인가 — 카드 목록·표·3열 격자가 골격이면 [06-workflow](design/06-workflow.md) 비평 (b) 평균 회귀부터
