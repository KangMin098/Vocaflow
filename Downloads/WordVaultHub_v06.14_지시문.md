# WordVault Hub v06.14 — VS Code 작업 지시문
# "나만의 어휘 도서관" — 6 Zone Asset Hub

> **적용 버전**: CLAUDE.md v06.14 (v06.13 → 업그레이드)
> **작업 범위**: `/wordvault` 허브 페이지 전면 재설계
> **변경 성격**: 기존 4 Tier IA → 6 Zone Architecture 전환
> **선결 조건**: CLAUDE.md v06.13 완전 숙지 필수

---

## 0. 필독 — 작업 전 반드시 읽을 파일 (순서 지킬 것)

건너뛰면 컨벤션 충돌 발생.

1. `CLAUDE.md` §"디자인 철학·학습 과학 원칙" — Calm UI, Progressive Disclosure, Memory Decay 4색
2. `CLAUDE.md` §17.1 학습 모델 — L3 Encode 계층 정의, WordVault 역할
3. `CLAUDE.md` §17.2 상태 축 — Memory Decay 4색 매핑 (`stable/shaky/risk/new` 토큰)
4. `CLAUDE.md` §11 WordVault — 기존 컴포넌트 목록 전체 (충돌 방지)
5. `CLAUDE.md` §14 Home Hub — ModuleHero, StatCard 재사용 패턴
6. `CLAUDE.md` §"Supabase DB 스키마" — 기존 테이블 컬럼 확인
7. `apps/web/src/components/wordvault/hub/WordVaultHub.tsx` — 현재 4 Tier 구조
8. `apps/web/src/components/wordvault/hub/MemoryDecayDistribution.tsx` — 기존 구현
9. `apps/web/src/components/wordvault/hub/ModeEntryGrid.tsx` — 기존 구현 (변경 X)
10. `apps/web/src/components/home/ModuleHero.tsx` — props 시그니처 확인

---

## 1. 설계 원칙 — 단 하나의 문장

> **"내가 모은 단어들을, 여러 책장에서 다양한 방식으로 관리하고 학습하는 나만의 어휘 도서관"**

이 문장에서 모든 설계 결정이 나온다:

| 키워드 | 원칙 | 근거 |
|---|---|---|
| "내가 모은" | Endowment Effect (Kahneman) | 소유감·자긍심 → 학습 동기 강화 |
| "여러 책장에서" | Multi-Book Management | 한국 학습자 멘탈 모델 (다권 관리) |
| "다양한 방식으로" | Multi-Dimensional Facet | 기억·학습단계·출처 3축 분류 |
| "도서관" | Information Foraging (Pirolli) | 탐색의 즐거움, 자율적 진입 |

---

## 2. 기존 설계 진단 — AS-IS 무엇이 잘못되었는가

```
[기존 v06.11 4 Tier]
Hero → MemoryDecayDistribution → TodayRiskStrip → ModeEntryGrid
 5%          건강 90%               학습강제 100%       모드진입
```

| 문제 | 원인 | 심각도 |
|---|---|---|
| TodayRiskStrip 포함 | "오늘 해야 할 것" = Action Hub 정체성. WordVault 본질 침범 | 🔴 높음 |
| MemoryDecayDistribution 시각 무게 과다 | 큰 막대+Bucket 카드 4개가 첫 fold 잠식 | 🟡 중간 |
| Book 개념 전무 | 한국 학습자 핵심 멘탈 모델(다권 관리) 완전히 누락 | 🔴 높음 |
| Hero stats "위급 N" 강조 | Calm UI 안티패턴 직접 위반 — 불안 유발 | 🔴 높음 |
| 자산 관리 정체성 5% | 학습 액션 화면처럼 구성 | 🔴 높음 |

---

## 3. TO-BE: 6 Zone Architecture

```
┌────────────────────────────────────────────────────────────┐
│ ZONE 1 — Vault Identity Hero                 (~140px)     │
│   "📖 내 어휘 자산"  총247 · 책장5권 · 안정102             │
│   [VaultBar — 4색 가로 누적 막대 8px]                      │
├────────────────────────────────────────────────────────────┤
│ ZONE 2 — Memory Pulse Strip                   (~48px)     │
│   ● 102 안정   ● 47 흔들림   ● 35 위급   ● 63 신규        │
│   [각 클릭 → ?view=browse&filter=stable|shaky|risk|new]   │
├────────────────────────────────────────────────────────────┤
│ ZONE 3 — My BookShelf  ★핵심★               (~200px)     │
│   가로 스크롤 카드 / 데스크톱 3열 그리드                    │
│   [원문책] [레벨책] [스마트책] [+ 새 단어장 Phase2 잠금]   │
├────────────────────────────────────────────────────────────┤
│ ZONE 4 — Learning Dimension                  (~160px)     │
│   [아직 안 만난] [익히는 중] [여러 채널로 익힘]             │
│   module_history 기반 3그룹                                │
├────────────────────────────────────────────────────────────┤
│ ZONE 5 — Study Mode Entry                     (~80px)     │
│   ModeEntryGrid — Browse · Study · Review (기존 재사용)    │
├────────────────────────────────────────────────────────────┤
│ ZONE 6 — Word Peek  [데스크톱 전용]           (~80px)     │
│   최근 추가 단어 5개 칩 미리보기                            │
└────────────────────────────────────────────────────────────┘
```

**첫 fold 계산** (데스크톱 1280px, 뷰포트 약 800px 기준):
- Zone 1 ~140px + Zone 2 ~48px + Zone 3 상단 → 스크롤 없이 자산 규모 + 기억 상태 + 책장 진입 모두 인지 ✅

---

## 4. 신규 컴포넌트 명세

### 4.1 VaultBar

```
파일: apps/web/src/components/wordvault/hub/VaultBar.tsx
역할: Zone 1 Hero 내부 — 자산 규모 시각화 (디스플레이 전용, 클릭 X)
```

**Props 인터페이스:**

```typescript
// apps/web/src/components/wordvault/hub/VaultBar.tsx

interface VaultBarProps {
  stable: number;
  shaky: number;
  risk: number;
  newCount: number;   // 'new'는 JS 예약어 → newCount 사용
  onDark?: boolean;   // Hero 다크 배경 위 = true (기본 false)
}
```

**시각 사양:**

| 속성 | 값 |
|---|---|
| 높이 | `h-2` (8px) |
| border-radius | `rounded-full` (= `var(--r-full)`) |
| overflow | `overflow-hidden` |
| 세그먼트 순서 | stable → shaky → risk → new (좌→우) |
| 세그먼트 너비 | `(count / total) * 100%` |
| 색상 | `var(--memory-stable/shaky/risk/new)` — 하드코딩 절대 금지 |
| onDark=true | 트랙 `bg-white/15`, 라벨 `text-white/90` |
| onDark=false | 트랙 `bg-[var(--bg3)]`, 라벨 `text-[var(--t2)]` |

**접근성:**
- `role="img"`
- `aria-label="총 {total}단어 — 안정 {stable}, 흔들림 {shaky}, 위급 {risk}, 신규 {newCount}"`

**하단 라벨:**
- 형식: `● 102 안정` × 4개
- 폰트: `font-body text-[11px] font-[600]`
- 간격: `gap-3 md:gap-4`

**방어 코드:** `if (total === 0) return null;`

**MemoryDecayDistribution과 목적 차별화:**

| 항목 | VaultBar | MemoryPulseStrip (Zone 2) |
|---|---|---|
| 목적 | 자산 규모 인식 | 상태별 필터 진입 |
| 크기 | 8px 슬림 막대 | 1줄 숫자+점 pill |
| 인터랙션 | 없음 (Display only) | 클릭 → 필터 |
| 위치 | Hero 내부 bottomSlot | Zone 2 독립 섹션 |

---

### 4.2 MemoryPulseStrip (MemoryDecayDistribution.tsx 재구현)

```
파일: apps/web/src/components/wordvault/hub/MemoryDecayDistribution.tsx
역할: Zone 2 — 기억 상태 4색 요약 1줄 + 클릭 시 필터 진입
주의: 파일명 유지 (외부 import 호환) — 내부만 재구현
```

**Props 인터페이스:**

```typescript
interface MemoryDecayDistributionProps {
  stable: number;
  shaky: number;
  risk: number;
  newCount: number;
}
// 기존 onBucketClick prop 제거 — 내부에서 router.push 직접 처리
```

**시각 사양:**

각 Pill 구조:
```
[메모리색 dot 2.5] [숫자 font-display 20px/800] [라벨 font-body 12px]
```

| 속성 | 값 |
|---|---|
| 컨테이너 | `flex items-center gap-3 md:gap-5 flex-wrap` |
| 각 Pill | `flex items-center gap-1.5 cursor-pointer min-h-[44px] px-3` |
| 클릭 동작 | `router.push('/wordvault?view=browse&filter={state}')` |
| Dot 크기 | `w-2.5 h-2.5 rounded-full` |
| 숫자 | `font-display text-[20px] font-[800] text-[var(--t1)]` |
| 라벨 | `font-body text-[12px] text-[var(--t3)]` |
| 0인 항목 | `opacity-40` 회색 처리 — 숨기지 않음 (0도 성취감의 근거) |

**접근성:**
- 각 Pill: `role="button"` + `aria-label="{라벨} 단어 {count}개 — 클릭하면 필터링"`

**파일 상단 주석 필수:**
```typescript
// apps/web/src/components/wordvault/hub/MemoryDecayDistribution.tsx
// v06.14: MemoryPulseStrip으로 내부 재구현 (파일명 유지 — 외부 import 호환성 보장)
```

---

### 4.3 BookShelfSection

```
파일: apps/web/src/components/wordvault/hub/BookShelfSection.tsx
역할: Zone 3 — My BookShelf 전체 섹션 (헤더 + Book 카드 그리드)
```

**타입 시스템 (`hub/types.ts`에 추가):**

```typescript
// apps/web/src/components/wordvault/hub/types.ts 에 추가

type BookType = 'text' | 'level' | 'smart' | 'goal' | 'theme';

interface VaultBook {
  id: string;
  type: BookType;
  title: string;
  subtitle: string;           // 예: "B1 · 12단어"
  wordCount: number;
  distribution: {
    stable: number;
    shaky: number;
    risk: number;
    newCount: number;
  };
  textStatus?: 'in-progress' | 'extracted' | 'conquered'; // text 타입 전용
  href: string;               // 클릭 시 이동 URL
  isLocked?: boolean;         // Phase 2 미구현 타입 — 잠금 표시
}

interface BookShelfSectionProps {
  books: VaultBook[];
}
```

**Phase 1 Book 3종 자동 생성 로직 (mock 기준):**

**① `text` Book (원문책):**
```
생성 조건: texts 테이블 기준, vocabularies에 단어 1개 이상인 text
제목: texts.title
부제: `{cefrLevel} · {wordCount}단어`
정렬: texts.last_opened DESC (최근 열람 순)
href: /wordvault?view=browse&textId={id}
아이콘: 📖
배지색: bg-[var(--p-light)] text-[var(--p-dark)]
```

**② `level` Book (레벨책):**
```
생성 조건: vocabularies.cefr_level 기준 자동 그룹 (단어 1개 이상인 레벨만)
제목: `{level} 레벨 단어`  예: "B1 레벨 단어"
부제: `{wordCount}단어 · CEFR {level}`
정렬: A1 → C2 순
href: /wordvault?view=browse&cefrLevel={level}
아이콘: 📊
배지색: bg-[var(--info-light)] text-[var(--info)]
```

**③ `smart` Book (스마트책):**
```
종류 2개 자동 생성:
  A. "⚡ 복습이 필요한 단어": risk 단어 1개 이상인 경우
     href: /wordvault?view=browse&filter=risk
  B. "🌱 아직 안 만난 단어": new 단어 1개 이상인 경우
     href: /wordvault?view=browse&filter=new
아이콘: ✨
배지색: bg-[var(--active-light)] text-[var(--active)]
```

**BookCard 컴포넌트 시각 사양:**
```
컨테이너:
  min-w-[260px]
  bg-[var(--bg)] border border-[var(--bd)]
  rounded-[var(--r-lg)]
  shadow 없음 (기본)
  hover: shadow-[var(--sh-md)] -translate-y-0.5
  transition: all var(--dur-normal) var(--ease)
  Next.js <Link> 컴포넌트 사용 (a 태그 직접 사용 X)

상단 행:
  - 타입 배지: text-[10px] font-[700] uppercase tracking-wide
               px-2 py-0.5 rounded-full
  - 우측: textStatus 배지 (text 타입만)
    - "진행 중": text-[var(--p)]
    - "정복 ✓": text-[var(--success)]
    - "추출 완료": text-[var(--t3)]

제목: font-display text-[15px] font-[700] text-[var(--t1)] mt-3 line-clamp-1
부제: font-body text-[12px] text-[var(--t3)] mt-0.5

VaultBar 미니:
  mt-3  h-1 (4px)  onDark=false

하단 행:
  - 단어 수: font-display text-[24px] font-[800] text-[var(--t1)]
  - 우측 →: group-hover:translate-x-0.5

Phase 2 잠금 표시:
  - 전체 opacity-50
  - "곧 추가됩니다" text-[11px] text-[var(--t3)] 오버레이
  - pointer-events-none (클릭 비활성)
```

**BookShelfSection 레이아웃:**
```
섹션 헤더:
  "📚 내 단어장 책장"  font-display text-[16px] font-[700]
  우측: "전체 보기 →" 링크 (단어 10개+ 경우만 표시)

카드 컨테이너:
  모바일:      overflow-x-auto snap-x snap-mandatory gap-3
               각 카드 snap-start
  태블릿 768+: grid grid-cols-2 gap-4
  데스크톱 1280+: grid grid-cols-3 gap-4
  4개 이상: 데스크톱도 overflow-x-auto 유지

빈 상태 (books.length === 0):
  Zone 3 전체 null 반환
  Zone 4도 함께 숨김 처리
```

**접근성:**
- 각 BookCard: `aria-label="{title} 단어장 — {wordCount}개 단어"`
- 가로 스크롤 컨테이너: `aria-label="내 단어장 책장"`

---

### 4.4 LearningDimensionSection

```
파일: apps/web/src/components/wordvault/hub/LearningDimensionSection.tsx
역할: Zone 4 — 학습 단계별 단어 현황 3그룹
```

**3그룹 정의 (module_history 기반):**

| stage | 조건 | 아이콘 | 라벨 | 부제 | 배지색 | 권장 모듈 |
|---|---|---|---|---|---|---|
| `unmet` | module_history 비어있음 | 🌱 | 아직 안 만난 단어 | Flashcard로 처음 만나보세요 | `var(--memory-new)` | Flashcard |
| `recognizing` | flashcard/wordblitz만 있음 | 🔄 | 익히는 중인 단어 | SpellForge로 철자를 다져보세요 | `var(--memory-shaky)` | SpellForge |
| `multichannel` | spellforge/dictation 포함 | ✨ | 여러 채널로 익힌 단어 | ScriptQuiz로 원문에서 확인하세요 | `var(--memory-stable)` | ScriptQuiz |

**카드 레이아웃:**
```
모바일:      1열 (full-width)
태블릿 768+: 3열 grid
데스크톱:    3열 grid

카드 내부:
  상단: stage 아이콘(24px) + 배지
  제목: font-display text-[15px] font-[700]
  부제: font-body text-[12px] text-[var(--t3)]
  단어 수: font-display text-[28px] font-[800]
  하단: "단어 보기 →" group-hover 화살표
  href: /wordvault?view=browse&mastery={stage}

count 0인 카드:
  opacity-40 비활성 처리
  "아직 없어요" 텍스트
  pointer-events-none

모든 3그룹 count 0:
  Zone 4 전체 null 반환
```

**뇌과학 근거 (파일 상단 주석에 포함):**
```typescript
/**
 * LearningDimensionSection
 * 학습 단계를 3축으로 시각화합니다.
 *
 * 근거:
 * - Generation Effect (Slamecka & Graf 1978):
 *   생성 인출(SpellForge·Dictation)을 거친 단어 = 강한 부호화
 *   → multichannel 그룹 가시화가 자기 효능감 강화
 * - Triple Coding (Paivio):
 *   시각·청각·운동 3채널 누적 = 장기 기억의 결정 요인
 * - SDT 유능감:
 *   "여러 채널로 익힌 단어" 수치 확인 = 학습 역량 자각
 */
```

---

### 4.5 WordPeekStrip (Zone 6 — 데스크톱 전용)

```
파일: apps/web/src/components/wordvault/hub/WordPeekStrip.tsx
역할: Zone 6 — 최근 추가 단어 미리보기 (데스크톱 전용)
표시 조건: hidden md:flex (모바일 완전 숨김 — Cognitive Load 관리)
```

**Props 인터페이스:**

```typescript
interface PeekWord {
  id: string;
  word: string;
  meaning: string;
  cefrLevel: string;
  memoryState: 'stable' | 'shaky' | 'risk' | 'new';
  sourceTitle: string;
}

interface WordPeekStripProps {
  words: PeekWord[];    // 최대 5개
  className?: string;
}
```

**칩 시각 사양:**
```
칩 컨테이너:
  bg-[var(--bg2)] border border-[var(--bd)] rounded-full
  px-3 py-1.5 flex items-center gap-2
  hover: bg-[var(--bg3)] cursor-pointer
  → 클릭: /wordvault?view=browse (해당 단어 하이라이트)

칩 내부:
  [메모리색 dot w-2 h-2] [영어단어 font-english 14px/600] [·] [뜻 font-body 12px]

섹션 헤더:
  "최근에 만난 단어"
  font-display text-[13px] font-[600] text-[var(--t3)] mb-2
```

---

## 5. 신규 라이브러리 파일

### 5.1 lib/wordvault/mastery.ts

```typescript
// apps/web/src/lib/wordvault/mastery.ts

/**
 * WordVault 학습 단계 분류 유틸
 *
 * 근거:
 * - Generation Effect (Slamecka & Graf 1978)
 * - Dual/Triple Coding (Paivio)
 * - CLAUDE.md §17.6 인지 축
 */

export type MasteryStage = 'unmet' | 'recognizing' | 'multichannel';

export interface MasteryGroup {
  stage: MasteryStage;
  count: number;
}

export function getMasteryStage(moduleHistory: string[]): MasteryStage {
  const history = moduleHistory ?? [];
  const hasGenerative =
    history.includes('spellforge') || history.includes('dictation');
  const hasRecognition =
    history.includes('flashcard') || history.includes('wordblitz');

  if (hasGenerative) return 'multichannel';
  if (hasRecognition) return 'recognizing';
  return 'unmet';
}

export function groupByMastery(
  vocabs: Array<{ module_history: string[] }>
): MasteryGroup[] {
  const counts: Record<MasteryStage, number> = {
    unmet: 0,
    recognizing: 0,
    multichannel: 0,
  };
  for (const v of vocabs) {
    counts[getMasteryStage(v.module_history)]++;
  }
  return [
    { stage: 'unmet', count: counts.unmet },
    { stage: 'recognizing', count: counts.recognizing },
    { stage: 'multichannel', count: counts.multichannel },
  ];
}
```

---

## 6. 기존 컴포넌트 수정 사항

### 6.1 WordVaultHub.tsx — 6 Zone 컴포지션으로 전환

**AS-IS (4 Tier):**
```typescript
<ModuleHero ... />
<MemoryDecayDistribution ... />
<TodayRiskStrip ... />        // ← 삭제
<ModeEntryGrid ... />
```

**TO-BE (6 Zone):**
```typescript
// apps/web/src/components/wordvault/hub/WordVaultHub.tsx

<ModuleHero                           // Zone 1
  variant="asset"
  title="📖 내 어휘 자산"
  note={dynamicNote}
  stats={[
    { label: '총 단어', value: totalCount, emphasis: true },
    { label: '내 책장', value: `${bookCount}권` },
    { label: '안정',   value: stableCount },
  ]}
  bottomSlot={
    <VaultBar
      stable={stableCount}
      shaky={shakyCount}
      risk={riskCount}
      newCount={newCount}
      onDark
    />
  }
/>

<MemoryDecayDistribution              // Zone 2 (재구현됨)
  stable={stableCount}
  shaky={shakyCount}
  risk={riskCount}
  newCount={newCount}
/>

<BookShelfSection books={books} />    // Zone 3

<LearningDimensionSection             // Zone 4
  masteryGroups={masteryGroups}
/>

<ModeEntryGrid />                     // Zone 5 (변경 없음)

{recentWords.length > 0 && (          // Zone 6 (데스크톱 전용)
  <WordPeekStrip
    words={recentWords}
    className="hidden md:flex flex-col gap-2"
  />
)}
```

**Hero stats 변경 근거 (코드 주석으로 문서화 필수):**
```typescript
// AS-IS: { label: '위급', value: riskCount, emphasis: true }
//   → Calm UI 위반: 첫 번째 강조 정보가 "위급" = 불안 유발
//   → CLAUDE.md §"안티패턴": "빨간 카운터로 압박"에 해당
//
// TO-BE: { label: '총 단어', value: totalCount, emphasis: true }
//   → Endowment Effect: 가장 큰 숫자 = 소유한 자산의 규모
//   → Implicit Progress: "내가 모은 것의 총량"이 첫 인상
```

**동적 note 분기 로직:**
```typescript
// Cold (totalCount < 50):
//   "첫 단어를 만나봐요 · 원문을 추가하면 자동으로 쌓여요"
//
// Warm (50~500) + stable < 50%:
//   `흔들리는 단어가 ${shakyCount}개 있어요 · SpellForge로 다져볼까요`
//
// Warm + stable >= 50%:
//   "절반 이상 안정됐어요 · 잘 하고 있어요 🌿"
//
// Hot (totalCount >= 500):
//   `${stableCount}개의 단어가 기억에 자리잡았어요`
```

---

### 6.2 ModuleHero.tsx — bottomSlot prop 추가

```typescript
// apps/web/src/components/home/ModuleHero.tsx

interface ModuleHeroProps {
  variant: 'asset' | 'action' | 'score';
  title: string;
  tagline?: string;     // deprecated — 호환 유지
  note?: string;
  stats?: Array<{
    label: string;
    value: string | number;
    emphasis?: boolean;
  }>;
  /** v06.14 신규: note 아래 자유 슬롯. Hero 다크 배경 위에 렌더됨. */
  bottomSlot?: React.ReactNode;
}

// 렌더 위치: note 출력 직후, border-top 위
// bottomSlot 있음: mt-3 wrapper div 추가
// bottomSlot 없음: 기존 동작 완전 동일 (호환성 100%)
```

**기존 6개 사용처 영향 확인:**

| Hub | bottomSlot | 영향 |
|---|---|---|
| TextViewer Hub | 없음 | ✅ 변경 없음 |
| Flashcard Hub | 없음 | ✅ 변경 없음 |
| SpellForge Hub | 없음 | ✅ 변경 없음 |
| Dictation Hub | 없음 | ✅ 변경 없음 |
| ScriptQuiz Hub | 없음 | ✅ 변경 없음 |
| WordBlitz Hub | 없음 | ✅ 변경 없음 |

---

### 6.3 TodayRiskStrip.tsx — 삭제

```
삭제: apps/web/src/components/wordvault/hub/TodayRiskStrip.tsx

삭제 근거:
1. 사용자 명시 지시: "오늘의 한 가지(Action) 제외"
2. CLAUDE.md §"안티패턴": "빨간 카운터로 압박" 직접 위반
3. CLAUDE.md §17 추천 위치: Hub Today CTA는 Home Hub 전담
4. WordVault = Asset Hub. Action 압박 = 정체성 훼손

삭제 전 확인:
□ WordVaultHub.tsx에서 import 제거
□ CLAUDE.md §11 WordVault 목록에서 제거 명시
```

---

## 7. Mock 데이터 — Phase 1 완전 명세

```typescript
// apps/web/src/components/wordvault/mock-data.ts 에 추가
// (기존 mock 유지, 아래 내용 추가)

import type { VaultBook } from './hub/types';
import type { MasteryGroup } from '@/lib/wordvault/mastery';
import type { PeekWord } from './hub/WordPeekStrip';

// ─── 기본 통계 ───────────────────────────────────────────
export const MOCK_TOTAL_COUNT = 247;
export const MOCK_STABLE     = 102;
export const MOCK_SHAKY      = 47;
export const MOCK_RISK       = 35;
export const MOCK_NEW_COUNT  = 63;

// ─── Book 목록 (Phase 1: text 2개 + level 2개 + smart 1개 + goal 잠금 1개) ───
export const MOCK_BOOKS: VaultBook[] = [
  {
    id: 'book-text-001',
    type: 'text',
    title: "Charlotte's Web — Chapter 3",
    subtitle: 'B1 · 12단어',
    wordCount: 12,
    distribution: { stable: 5, shaky: 3, risk: 2, newCount: 2 },
    textStatus: 'in-progress',
    href: '/wordvault?view=browse&textId=text-001',
  },
  {
    id: 'book-text-002',
    type: 'text',
    title: 'TED — The Power of Vulnerability',
    subtitle: 'B2 · 18단어',
    wordCount: 18,
    distribution: { stable: 7, shaky: 4, risk: 3, newCount: 4 },
    textStatus: 'extracted',
    href: '/wordvault?view=browse&textId=text-002',
  },
  {
    id: 'book-text-003',
    type: 'text',
    title: 'The Little Prince — Chapter 1',
    subtitle: 'A2 · 14단어',
    wordCount: 14,
    distribution: { stable: 14, shaky: 0, risk: 0, newCount: 0 },
    textStatus: 'conquered',
    href: '/wordvault?view=browse&textId=text-003',
  },
  {
    id: 'book-level-b1',
    type: 'level',
    title: 'B1 레벨 단어',
    subtitle: '83단어 · CEFR B1',
    wordCount: 83,
    distribution: { stable: 41, shaky: 20, risk: 12, newCount: 10 },
    href: '/wordvault?view=browse&cefrLevel=B1',
  },
  {
    id: 'book-level-b2',
    type: 'level',
    title: 'B2 레벨 단어',
    subtitle: '61단어 · CEFR B2',
    wordCount: 61,
    distribution: { stable: 28, shaky: 15, risk: 10, newCount: 8 },
    href: '/wordvault?view=browse&cefrLevel=B2',
  },
  {
    id: 'book-smart-risk',
    type: 'smart',
    title: '⚡ 복습이 필요한 단어',
    subtitle: 'R(t) < 0.7 · 35단어',
    wordCount: 35,
    distribution: { stable: 0, shaky: 0, risk: 35, newCount: 0 },
    href: '/wordvault?view=browse&filter=risk',
  },
  {
    id: 'book-goal-locked',
    type: 'goal',
    title: '목표 단어장',
    subtitle: '수능·토익 목표 설정',
    wordCount: 0,
    distribution: { stable: 0, shaky: 0, risk: 0, newCount: 0 },
    href: '#',
    isLocked: true,
  },
];

// ─── Learning Dimension 3그룹 ─────────────────────────────
export const MOCK_MASTERY_GROUPS: MasteryGroup[] = [
  { stage: 'unmet',        count: 63 },
  { stage: 'recognizing',  count: 47 },
  { stage: 'multichannel', count: 27 },
];

// ─── Word Peek 최근 단어 5개 ──────────────────────────────
export const MOCK_RECENT_WORDS: PeekWord[] = [
  {
    id: 'w1', word: 'evolution',  meaning: '진화',
    cefrLevel: 'B2', memoryState: 'shaky',
    sourceTitle: "Charlotte's Web",
  },
  {
    id: 'w2', word: 'vulnerable', meaning: '취약한',
    cefrLevel: 'B2', memoryState: 'new',
    sourceTitle: 'TED Talk',
  },
  {
    id: 'w3', word: 'compassion', meaning: '연민',
    cefrLevel: 'B1', memoryState: 'stable',
    sourceTitle: 'The Little Prince',
  },
  {
    id: 'w4', word: 'persist',    meaning: '지속하다',
    cefrLevel: 'B1', memoryState: 'risk',
    sourceTitle: "Charlotte's Web",
  },
  {
    id: 'w5', word: 'authentic',  meaning: '진정한',
    cefrLevel: 'C1', memoryState: 'new',
    sourceTitle: 'TED Talk',
  },
];
```

---

## 8. DB 스키마 추가 — 최소화 원칙

기존 스키마 최대 재사용. Phase 1 필요 컬럼만 추가.

```sql
-- vocabularies 테이블 추가 컬럼
ALTER TABLE vocabularies
  ADD COLUMN IF NOT EXISTS stability        FLOAT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retrievability   FLOAT DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS last_review_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_review_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS module_history   TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cefr_level       TEXT;  -- 'A1'~'C2'

-- texts 테이블 추가 컬럼
ALTER TABLE texts
  ADD COLUMN IF NOT EXISTS cefr_level     TEXT,
  ADD COLUMN IF NOT EXISTS last_opened    TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS wordvault_done BOOLEAN DEFAULT false;
```

> ⚠️ **중요**: `memory_state` 컬럼은 절대 추가하지 않는다.
> CLAUDE.md §17.2 원칙: "state(4색)는 R(t) 동적 계산 — 저장 X"
> → `getMemoryState(stability, retrievability)` 함수로 런타임 계산만.

---

## 9. 폴더 구조 — 최종

```
apps/web/src/
├── components/
│   ├── wordvault/
│   │   ├── hub/
│   │   │   ├── WordVaultHub.tsx               ← 수정 (6 Zone 컴포지션)
│   │   │   ├── MemoryDecayDistribution.tsx    ← 재구현 (MemoryPulseStrip)
│   │   │   ├── ModeEntryGrid.tsx              ← 변경 없음
│   │   │   ├── WordVaultEmptyState.tsx        ← 변경 없음
│   │   │   ├── VaultBar.tsx                   ← 신규
│   │   │   ├── BookShelfSection.tsx           ← 신규 (BookCard 포함)
│   │   │   ├── LearningDimensionSection.tsx   ← 신규
│   │   │   ├── WordPeekStrip.tsx              ← 신규 (데스크톱 전용)
│   │   │   └── types.ts                       ← VaultBook 타입 추가
│   │   │
│   │   └── (기존 나머지 파일 변경 없음)
│   │
│   └── home/
│       └── ModuleHero.tsx                     ← bottomSlot prop 추가
│
└── lib/
    └── wordvault/
        └── mastery.ts                         ← 신규

삭제:
  apps/web/src/components/wordvault/hub/TodayRiskStrip.tsx  ← 삭제
```

---

## 10. 반응형 동작 명세

### 모바일 (390px)

| Zone | 레이아웃 |
|---|---|
| Zone 1 Hero | 세로 스택: 타이틀 → stats 3개 가로 → VaultBar |
| Zone 2 Memory Pulse | 2×2 그리드 (4개 pill) |
| Zone 3 BookShelf | 가로 스크롤 스냅 (min-w-[240px]) |
| Zone 4 Learning Dimension | 1열 세로 스택 (3카드) |
| Zone 5 Mode Entry | 기존 ModeEntryGrid 반응형 그대로 |
| Zone 6 Word Peek | `hidden` — 표시 X |

### 태블릿 (768px)

| Zone | 레이아웃 |
|---|---|
| Zone 1 Hero | 좌우 2열 |
| Zone 2 Memory Pulse | 4개 1줄 가로 |
| Zone 3 BookShelf | 2열 그리드 |
| Zone 4 Learning Dimension | 3열 그리드 |
| Zone 5 Mode Entry | 3열 |
| Zone 6 Word Peek | `flex flex-wrap` |

### 데스크톱 (1280px)

| Zone | 레이아웃 |
|---|---|
| Zone 1 Hero | 좌우 2열 |
| Zone 2 Memory Pulse | 4개 1줄 (gap 확장) |
| Zone 3 BookShelf | 3열 그리드 (4개+ 가로 스크롤) |
| Zone 4 Learning Dimension | 3열 그리드 |
| Zone 5 Mode Entry | 3열 |
| Zone 6 Word Peek | `flex flex-wrap` 5개 칩 |

**전체 컨테이너:** `max-w-6xl mx-auto px-4 md:px-8` (기존 기준 유지)

---

## 11. Empty State 처리 (4가지 시나리오)

```typescript
// WordVaultHub.tsx 분기 로직

if (totalCount === 0) {
  // 단어 0개 → 전체 EmptyState (기존 컴포넌트 재사용)
  return <WordVaultEmptyState />;
}

// 각 Zone 개별 null 처리:
// Zone 3: books.length === 0 → null (Zone 4도 함께 숨김)
// Zone 4: 모든 mastery count === 0 → null
// Zone 6: recentWords.length === 0 → null

// Zone 2 (Memory Pulse):
//   항상 표시 — 0도 보여줌 (opacity-40 처리)
//   근거: "위급 0" = 성취감의 시각적 근거
```

---

## 12. 접근성 체크리스트

모든 Zone에서 반드시 검증:

```
□ VaultBar: role="img" + aria-label 완전한 텍스트 포함
□ Memory Pulse Pill: role="button" + aria-label + focus-visible:ring
□ BookCard: Next.js <Link> 사용 (a 태그 직접 X) + aria-label
□ LearningDimension 카드: count=0 시 aria-disabled="true" + visual 비활성
□ 모든 인터랙티브 요소: min-h-[44px] 터치 타겟 (WCAG AA)
□ 다크모드: data-theme="dark" 자동 대응 (CSS 변수만 사용)
□ 색상만으로 정보 전달 X: Memory 색 = 항상 색 + 라벨 병기
□ 키보드 탐색: Tab 순서 논리적 (Zone 1 → 2 → 3 → 4 → 5 → 6)
```

---

## 13. 작업 완료 기준 (Definition of Done)

| 검증 항목 | 검증 방법 |
|---|---|
| 6 Zone 정상 렌더 | 브라우저 시각 확인 |
| VaultBar 4색 비율 | mock stable102/shaky47/risk35/new63 비율 확인 |
| Memory Pulse 클릭 → 필터 적용 | ?view=browse&filter=risk 진입 확인 |
| BookShelf 6종 카드 렌더 | 5개 활성 + 1개 잠금 |
| Learning Dimension 3그룹 | unmet63 / recognizing47 / multichannel27 |
| Word Peek 모바일 숨김 | 390px에서 hidden 확인 |
| TodayRiskStrip 완전 제거 | import 없음 확인 |
| ModuleHero bottomSlot 기존 6개 사용처 | 각 hub 정상 렌더 (회귀 없음) |
| 다크모드 전체 Zone | data-theme="dark" 토글 확인 |
| 모바일 390px 반응형 | 가로 스크롤, 세로 스택 |
| 태블릿 768px 반응형 | 2열 그리드 |
| 데스크톱 1280px 반응형 | 3열 그리드 |
| TypeScript 오류 0 | `pnpm --filter web tsc --noEmit` |
| ESLint 오류 0 | `pnpm --filter web lint` |
| getMasteryStage 단위 테스트 | 3가지 stage 분기 모두 통과 |

---

## 14. CLAUDE.md 업데이트 (작업 완료 후 필수)

### 변경 내용

1. **버전**: `v06.13` → `v06.14`
2. **§11 WordVault hub/ 폴더 업데이트**:
   - 추가: `VaultBar.tsx` · `BookShelfSection.tsx` · `LearningDimensionSection.tsx` · `WordPeekStrip.tsx`
   - 수정: `MemoryDecayDistribution.tsx` — "v06.14 내부 재구현" 명시
   - 삭제: `TodayRiskStrip.tsx` 항목 제거
3. **§17.1 L3 Encode** 행: 4 Tier → 6 Zone 갱신

### 변경 이력 추가 (CLAUDE.md 하단)

```
**v06.14** §11 WordVault Hub 6 Zone Architecture — "나만의 어휘 도서관"
/ 기존 4 Tier → 6 Zone
  (VaultIdentityHero · MemoryPulseStrip · BookShelf · LearningDimension · ModeEntry · WordPeek)
/ TodayRiskStrip 삭제 (Calm UI 정합 + 사용자 지시)
/ MemoryDecayDistribution → MemoryPulseStrip 내부 재구현 (파일명 유지)
/ VaultBar 신규 (Hero 내부 4색 슬림 막대 8px)
/ BookShelfSection 신규 — Book 5종 타입 (text · level · smart · goal · theme)
  Phase 1: text · level · smart 자동 생성 /
  Phase 2: goal · theme 사용자 정의 (잠금 표시)
/ LearningDimensionSection 신규 — module_history 기반 3그룹
  (unmet · recognizing · multichannel) — Generation Effect · Triple Coding 근거
/ WordPeekStrip 신규 (데스크톱 전용, Cognitive Load 관리)
/ ModuleHero bottomSlot prop 추가 (note 아래 자유 슬롯, 호환성 100%)
/ lib/wordvault/mastery.ts 신규 (getMasteryStage · groupByMastery)
/ Hero stats 변경: "위급 강조" → "총단어 · 책장권수 · 안정" (Endowment Effect · Calm UI)
/ DB 컬럼 추가: vocabularies (stability · retrievability · last_review_at ·
  next_review_at · module_history · cefr_level) · texts (cefr_level · last_opened · wordvault_done)
/ 5관점 (뇌과학 — Endowment Effect · Context-Dependent · Generation Effect · Triple Coding
  / 심리 — SDT 자율성 · Calm UI · Implicit Progress
  / 인지 — Cognitive Load 6Zone 분리
  / 접근성 — WCAG AA · 44px · role · aria-label
  / 실용 — 0클릭 자산인지 · 1클릭 진입 · 2클릭이내 완결)
```

---

## 15. 절대 금지 사항 (이 작업 한정)

```
❌ TodayRiskStrip 어떤 형태로도 부활 금지
❌ "오늘의 단어", "최근 N일", "이번 주" 시간 윈도우 카피 금지
❌ Hero stats에 risk / 위급 강조 금지
❌ memory_state 컬럼 DB 추가 및 직접 사용 금지 (R(t) 동적 계산만)
❌ --color-primary 등 v5 롱폼 변수 금지 (--p 축약형만)
❌ MemoryDecayDistribution.tsx 파일 삭제 금지 (내부 재구현만)
❌ TODO · placeholder · 생략 코드 금지 — 완성형만
❌ Zone 6 (WordPeekStrip) 모바일 표시 금지 — hidden 반드시 유지
❌ 색상 하드코딩 금지 (Memory Decay 색 포함 — 토큰만)
❌ Inter · Roboto · Arial 사용 금지
```

---

*WordVaultHub_v06.14_지시문.md — Vocaflow WordVault Hub 설계 지시문*
*작성 기준: CLAUDE.md v06.13 / 적용 대상: CLAUDE.md v06.14*
