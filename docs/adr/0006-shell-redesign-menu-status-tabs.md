# ADR 0006 — 셸 재설계: 메뉴 · 상단 상태 · 하단 · 화면 탭

- **Status**: **Accepted — D2·D3·D4 적용 완료 · D1 부분 적용 (2026-08-14)**
  - ✅ **D2 상단 상태** — `StatusRibbon` 신설, 지표 19 → 3, 0-문장 규칙. Sidebar streak ·
    HubHero streak+3 stats 제거. 죽은 코드 2개(`SidebarFooter`·`DashboardHeader`) 삭제.
  - ✅ **D3 하단** — 진행 실(1px) + Today 점. 하단 탭 4개는 그대로.
  - ✅ **D4 화면 탭** — `/my` 폐지(`MyTabs`·`my/layout` 삭제 · `/my/texts`→`/text`),
    Library 라벨 확정명(책·짧은 글·세트). **만화 흡수는 미적용** — 사이드바 축소와 함께 해야 한다.
  - ◐ **D1 메뉴** — FlowNav 삭제 완료(내비 3 → 2). **사이드바 16 → 6 은 미적용**:
    모듈 7종의 새 자리(콘텐츠 상세의 모드 선택 UI)가 아직 없어 지금 줄이면 접근 경로가 사라진다.
  - 회귀 자산: `tests/e2e/22-shell-status.spec.ts` 7종 + `lib/learner/__tests__/today-status.test.ts` 15종
- **Scope**: 전역 셸 4요소 — 내비게이션 메뉴 / 상단 상태 정보 / 하단 / 화면 내 탭
- **Relates to**: [VOCAB_FRAMEWORK_PROPOSAL.md](../VOCAB_FRAMEWORK_PROPOSAL.md) §3 메뉴 재편안 · §6 진행 가이드 ·
  [lib/framework/axes.ts](../../apps/web/src/lib/framework/axes.ts) (Surface·Facet·Stage 확정) ·
  [ADR 0004](./0004-book-vocab-selection-policy.md) (L1/L2 계층)
- **정합**: 철학 ①Calm UI ②Progressive Disclosure ③Empathetic Feedback ④Implicit Progress ·
  학습원칙 ⑥Cognitive Load ⑦Emotional Encoding

---

## 1. Context — 실측 (2026-08-14, `/hub` 데스크톱 1화면)

### C1. 내비게이션 시스템이 3개이고, 셋이 서로 다른 분류를 쓴다

| 셸 요소 | 파일 | 링크 | 분류축 |
|---|---|--:|---|
| Sidebar | `components/layout/Sidebar.tsx` + `sidebar-config.ts` | **16** | 5 그룹(Scripts·Comics·Words·Practice·Conquer·Complete) + 메타 2 + footer 2 |
| FlowNav | `components/layout/FlowNav.tsx` | **6** | 6 단계(discover·source·words·practice·conquer·complete) |
| MobileTabBar | `components/layout/MobileTabBar.tsx` | **4** | 4 표면(today·library·vault·growth) |

같은 `/library` 로 가는 길이 세 이름(Library · Library(발견) · 서재)으로 셋이다.
`/wordvault` 는 넷이다(Sidebar WordVault · FlowNav Words · MobileTab 내 단어 · ModuleGrid 단어장).

**`axes.ts` 는 이미 표면을 4개로 확정했다.** MobileTabBar 만 그 결정을 따르고 있고,
Sidebar·FlowNav 는 이전 분류를 그대로 들고 있다. FlowNav 는 자기 주석에
"Phase 3 에서 이 컴포넌트 자체가 하단 탭 4개로 재편될 예정" 이라고 적어 두었다 — **미완의 이행이다.**

### C2. 상태 지표 19개 중 신규 사용자에게 18개가 0이다

사용자가 보고한 실화면(2026-08-14)을 요소별로 분해:

| 자리 | 지표 | 신규 사용자 값 |
|---|---|---|
| Sidebar 상단 | Streak | 0일 |
| FlowNav 모멘텀 | Streak · 어휘 총계 · 안정 · 흔들림 · 위급 · 신규 · 이번 주 | 0 · 0 · 0 · 0 · 0 · 0 · 0일 |
| HubHero 캡슐 | Streak | "시작" |
| HubHero stats | 오늘 · 총 단어 · 정확도 | 0개 · 0개 · 0% |
| ModuleGrid | 7 모듈 마지막 학습 | "아직 학습 전" × 7 |

**Streak 이 한 화면에 3번**(Sidebar · FlowNav · HubHero) 나온다.
**기억 4색이 2번**(FlowNav 모멘텀 · `/dashboard` MemoryStatus) 나온다.
합계 **19 지표 / 그중 0 표기 18개.**

첫 화면이 **아무것도 하지 않은 사람의 성적표**다. 철학 ③Empathetic Feedback 과
학습원칙 ⑦Emotional Encoding(자기효능감)에 정면으로 어긋난다.
`vocabularies` 실측 사용자 3명 · 프리론치 상태이므로 **이 화면이 사실상 모든 신규 사용자의 첫 화면이다.**

### C3. 첫 화면 선택지가 34개다

Sidebar 16 + FlowNav 6 + Hero CTA 2 + Today 1 + Continue 1 + Module 7 + Arcade 1 = **34**.
학습원칙 ⑥Cognitive Load(작업기억 ~4)의 8배다. 게다가 34개 중 의미 있는 목적지는
"진단" 하나뿐이다 — 나머지는 전부 콘텐츠 0인 빈 화면으로 이어진다.

### C4. 폐기하기로 한 이름이 4곳에 살아 있다

`axes.ts` `NAME_DECISIONS` 가 retire 로 지정한 것들:

| retire 대상 | 아직 쓰는 곳 |
|---|---|
| hub ModuleCard "단어장" | `components/home/ModuleCard.tsx:43` |
| "My Scripts" / hub "스크립트" | `sidebar-config.ts:67` · `ModuleCard.tsx:42` |
| TextVault | `components/my/MyTabs.tsx:13` |
| 아케이드 Lv (진행 축 이중화) | `components/layout/SidebarFooter.tsx:52` |

### C5. 죽은 셸 코드 2개 — 그중 하나는 목업을 품고 있다

- **`SidebarFooter.tsx`** — 어디서도 import 되지 않는다. 기본값이
  `userName='김학생' · level=4 · streak=7` 이다. 배선되는 순간 목업이 화면에 뜬다.
  `Lv {level}` 은 폐기된 진행 축이다.
- **`DashboardHeader.tsx`** — import 0건. `bg-bg` · `text-t3` · `duration-normal` 등
  현행 토큰 규약(`var(--bg)` · `--dur-normal`)과 어긋난 클래스를 쓴다.

### C6. 화면 내 탭이 3세트 8탭이고, 한 세트는 폐지 대상이다

| 탭 세트 | 탭 | 문제 |
|---|---|---|
| `LibraryTabs` | 도서 · 스크립트 · 공용 단어장 | "스크립트"·"공용 단어장" 이 retire 이름 |
| `ComicsTabs` | Book Comics · Vintage Comics | Library 와 같은 층위인데 별도 최상위 |
| `MyTabs` | TextVault · WordVault · BookVault | `/my` 전체가 `SURFACES.vault.absorbs` 의 폐지 대상 |

---

## 2. Decisions

### D1 — 내비게이션 시스템을 3 → 1 로. FlowNav 를 폐지한다

**표면은 `axes.ts` 의 4개가 전부다.** 데스크톱 Sidebar 와 모바일 TabBar 는 **같은 레지스트리의
두 표현**이며, 자체 목록을 갖지 않는다(TabBar 는 이미 그렇다 — Sidebar 를 그 규약에 맞춘다).

```
Today   /hub        오늘 할 것과 언제 끝나는지
Library /library    무엇으로 공부할지 고르는 곳
Vault   /wordvault  내 단어가 면별로 어디까지 왔는지
Growth  /dashboard  지나온 것과 증빙
─────────────────────────────────────
Class   /teacher    (footer · 권한이 다른 표면)
Settings /settings  (footer)
```

**16 링크 → 6.** 모듈 7종(Flashcard·WordBlitz·PairFlip·SpellForge·ScriptQuiz·Dictation·Game Lab)은
메뉴에서 내린다 — 프레임워크 §3.1 이 이미 정한 것이고, 선례가 강제한다(Quizlet Gravity 제거 ·
Duolingo Stories 탭 폐지). **없애는 것이 아니라 위치를 바꾼다**:

| 모듈 | 새 위치 |
|---|---|
| 6 학습 모듈 | ① Today 처방이 지정 ② 콘텐츠를 고른 뒤의 **모드 선택** |
| Game Lab | Today 안의 **"골라서 연습" 한 칸** = 이탈구 정확히 1개 (프레임워크 §3.2) |

**FlowNav 는 삭제한다.** 근거 셋:
1. 4표면 결정과 6단계가 공존할 수 없다 — 같은 앱에 두 분류축이 남는다.
2. 모바일 유일 내비였던 존재 이유가 `MobileTabBar` 도입으로 소멸했다.
3. 모멘텀 배지는 D2 의 상태 띠로 흡수된다.

`SidebarFooter.tsx` · `DashboardHeader.tsx` 도 같은 커밋에서 삭제한다(C5).

### D2 — 상단 상태: 19 지표 → 3. 그리고 **0 은 숫자로 쓰지 않는다**

전역 셸 최상단에 **상태 띠(Status Ribbon) 한 줄**만 둔다. 답해야 할 질문은 셋뿐이다.

| 칸 | 답하는 질문 | 데이터 |
|---|---|---|
| **오늘** | 오늘 끝나려면 얼마나 남았나 | `prescribe_today` 블록 수 — **개수로 닫는다**(프레임워크 §6.1) |
| **흔들림** | 지금 조치할 것이 있나 | `risk + shaky` 합 (R(t) 동적) |
| **연속** | (정서) | `user_stats.current_streak` |

```
┌──────────────────────────────────────────────┐
│  ◔ 오늘 3/5      ⚠ 흔들림 12      🔥 7       │
└──────────────────────────────────────────────┘
```

**설계 규칙 5개**

1. **0 은 숫자가 아니라 문장이다.** 세 지표가 모두 0이면 띠는 지표를 **하나도 그리지 않고**
   한 문장 + 행동 하나로 바뀐다.
   ```
   아직 시작 전이에요 — 5분이면 오늘 할 일이 생겨요   [진단 시작]
   ```
   이것이 본 ADR 의 **가장 중요한 단일 변경**이다. 0을 숫자로 나열하는 것은
   "당신은 아무것도 하지 않았다" 를 19번 반복하는 것과 같다.
2. **`stable`·`new` 는 띠에 넣지 않는다.** 조치 불가능한 수치이므로 Growth 소관이다.
   띠는 **행동 가능한 것만** 싣는다.
3. **진행은 링(ring) 하나.** 게이지 바 금지(철학 ④Implicit Progress). 링은 채워질 뿐 퍼센트를 쓰지 않는다.
4. **streak 은 숫자만.** 불꽃은 12px 이하, 0일 때 표시하지 않는다. 압박 금지(철학 ③).
5. **띠는 셸에 1개.** 페이지가 자기 상태 헤더를 또 그리지 않는다 — HubHero 의 3 stats,
   FlowNav 모멘텀, Sidebar streak 은 전부 여기로 흡수되고 원래 자리에서는 사라진다.

**HubHero 는 상태 표시를 잃고 "오늘의 한 걸음" 만 남는다** — 인사 + 처방 1블록 + CTA 하나.

### D3 — 하단: 모바일 4탭 유지 + 오늘 진행 실(thread)

`MobileTabBar` 의 4탭은 이미 옳다(`SURFACE_ORDER` 단일 출처 · 44px 이상 · 색+굵기 2중 표기).
두 가지만 더한다.

1. **탭 위 1px 진행 실** — 오늘 처방 진행률을 탭 바 상단 경계선의 채움으로 표현.
   숫자·퍼센트 없음. 철학 ④Implicit Progress 의 정확한 사례다.
2. **Today 탭에 남은 개수 점(dot)** — 배지 숫자가 아니라 **점 하나**. 숫자 배지는
   "밀린 일" 로 읽혀 압박이 된다(철학 ③). 0이면 점도 없다.

데스크톱에는 하단 바를 만들지 않는다 — Sidebar 하단에 같은 상태 띠 축약형을 둔다.
`--tabbar-h` 규약(CONVENTIONS "하단 고정 UI")은 그대로 유지한다.

### D4 — 화면 탭: "같은 종류의 목록 사이 전환" 에만 쓴다

**탭 규약 (신설 · CONVENTIONS 에 수록)**

| 규칙 | 이유 |
|---|---|
| 탭은 **형제 목록** 사이 전환에만 쓴다. 다른 행동으로 가는 것은 탭이 아니라 버튼이다 | 탭은 "여기 안에서 관점만 바뀐다" 는 약속이다 |
| **최대 4개.** 넘으면 필터 칩으로 내린다 | 학습원칙 ⑥ · 390px 에서 4탭이 한 줄 한계 |
| 활성 탭은 **URL 세그먼트**로 (쿼리 아님) | 딥링크·뒤로가기·"제자리 복귀" 규약 정합 |
| 라벨은 `axes.ts` 확정명만 | 이름이 갈라지는 지점이 늘 탭이었다(C6) |
| 44px 이상 · 색 + 굵기 2중 표기 | 접근성 절대 규칙 |

**표면별 탭 재설계**

| 표면 | 현행 | 제안 | 근거 |
|---|---|---|---|
| **Library** | 도서 / 스크립트 / 공용 단어장 (+ 별도 최상위 Comics 2탭) | **책 · 짧은 글 · 만화 · 세트** (4) | `Comics` 최상위를 흡수 — 만화는 "읽는 방식" 이므로 콘텐츠 표면 안이 제자리. retire 이름 2개 해소 |
| **Vault** | 없음 | **탭 없음 + Stage 필터 칩 5** (Met·Recognized·Recalled·Applied·Fluent) | 5는 탭 상한 초과 → 칩. `axes.ts` STAGE_ORDER 그대로 |
| **Growth** | 없음 | **7일 · 30일 · 90일 · 전체** (4) | 죽은 `DashboardHeader` 가 갖고 있던 유일하게 옳은 아이디어를 되살린다 |
| **Today** | 없음 | **탭 없음** | 처방은 정본 하나다. 탭을 두면 두 번째 경로가 생긴다(프레임워크 §3.2) |
| **`/my`** | TextVault / WordVault / BookVault | **폐지** | `SURFACES.vault.absorbs` 가 이미 폐지 대상으로 지정. `/my/*` → `/wordvault` · `/library` 리다이렉트 |

---

## 3. 측정 가능한 목표

| 지표 | 현재 | 목표 |
|---|--:|--:|
| 내비게이션 시스템 | 3 | **1** |
| 전역 내비 링크(데스크톱) | 16 | **6** |
| 첫 화면 선택지 | 34 | **≤7** |
| 상태 지표 | 19 | **3** (전부 0이면 **0** + 문장 1) |
| streak 중복 노출 | 3 | **1** |
| 기억 4색 중복 노출 | 2 | **1** (Growth 단독) |
| retire 이름 잔존 | 4 | **0** |
| 죽은 셸 컴포넌트 | 2 | **0** |
| 화면 탭 세트 | 3 (8탭) | 3 (**최대 4탭** · `/my` 폐지) |

---

## 4. 이행 순서

`axes.ts` 가 이미 축을 고정했으므로 화면부터 바꿔도 이름이 갈라지지 않는다.

1. **죽은 코드 삭제** — `SidebarFooter` · `DashboardHeader`. 위험 0, 목업 유입 경로 차단.
2. **상태 띠 신설 + 0-문장 규칙** — 가장 큰 체감 변화이고 다른 변경에 의존하지 않는다.
   같은 커밋에서 HubHero stats · Sidebar streak 제거(중복 해소가 목적이므로 분리하면 의미가 없다).
3. **FlowNav 삭제 + Sidebar 를 4표면으로** — 모듈 7종의 새 자리(콘텐츠 상세의 모드 선택)가
   먼저 있어야 한다. 없으면 접근 경로가 사라진다. **선행 조건**이다.
4. **Library 탭 4개로 · Comics 흡수 · `/my` 리다이렉트**
5. **하단 진행 실 + Today 점**

각 단계는 되돌릴 수 있고, 3번만 선행 조건을 갖는다.

---

## 5. 하지 않을 것 (근거 포함)

- **하단 탭을 5개 이상으로** — 국외 관측 3~4가 상한(Busuu 3 · Memrise 3 · Babbel 4 · Vocabulary.com 4).
  5번째를 넣고 싶어지면 그것은 표면이 아니라 표면 안의 항목이다.
- **상태 띠에 정확도(%)** — 현재 HubHero 가 보여주지만, 정확도는 **낮을 때 압박이 되고
  높을 때 의미가 없다**(초반 표본이 작아 변동이 크다). 철학 ③ 위반. Growth 에서 추세로만 본다.
- **모듈 7종을 사이드바에 남기기** — "찾기 어려워진다" 는 반론은 맞지만, 답은 메뉴가 아니라
  **처방과 콘텐츠 상세의 모드 선택**이다. 별도 활동 탭이 사용률로 정당화된 선례가 없다.
- **첫 화면에 튜토리얼 오버레이** — 모달로 학습을 막지 않는다(CONVENTIONS 절대 금지).
  0-문장 규칙이 같은 일을 방해 없이 한다.
- **진행률 퍼센트 · 게이지 바** — 철학 ④. 링과 실(thread)로 대체한다.

---

## 6. 미해결 / 검증 필요

- **모듈 7종의 새 자리 실측** — 콘텐츠 상세에서 모드를 고르는 UI 가 아직 없다. D1 3단계의
  선행 조건이고, 이것이 없으면 메뉴만 줄어 접근성이 나빠진다.
- **`prescribe_today` 블록 수가 "오늘 N/M" 의 M 으로 안정적인가** — 처방이 매일 다른 개수를
  내면 "언제 끝나는지" 가 닫히지 않는다. 5블록 고정인지 가변인지 실측 필요.
- **0-문장 규칙의 경계** — 세 지표 중 하나만 0이 아닌 경우(예: streak 만 1)의 표기.
  현 제안은 "지표 전부 0일 때만 문장" 이지만, 실사용에서 "흔들림 0 · 오늘 0/0 · streak 3" 이
  흔하면 규칙을 넓혀야 한다.
- 본 ADR 은 **레이아웃·정보 구조만** 다룬다. 타이포·색·모션은 DESIGN_SYSTEM 소관이며 변경 없다.
