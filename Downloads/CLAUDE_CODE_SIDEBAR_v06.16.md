# Claude Code 작업 지시문 — Sidebar v06.16 Refactor

> 이 문서를 Claude Code에 그대로 입력하면 단계별로 작업이 진행됩니다.
> 작업 위치: `C:\Users\kille\Vocaflow\` (모노레포 루트)
> 단일 진실 소스: `CLAUDE.md` — 충돌 시 CLAUDE.md 우선

---

## 작업 개요

Vocaflow Sidebar 5그룹 IA 정합성 보정 + 공용 단어장 라이브러리 분리 + 단어 가져오기 진입점 2곳 추가.

검증 관점 3가지:
- **실용성**: URL deep link 안정성 · 진입점 다중 노출 · 메뉴 라벨 명확성
- **뇌과학**: Sweller 인지 부하 · Hick 결정 부담 · Bjork desirable difficulty
- **디자인**: Calm UI · Progressive Disclosure · 5색 accent 체계 보존

---

## 사전 작업 — 컨텍스트 로딩

```
다음 파일을 먼저 읽고 현재 구조를 파악해줘:
1. CLAUDE.md — §17.10 IA 원칙 · §17.6 모듈 매트릭스 · §17.4 FSRS 초기 파라미터 부분
2. apps/web/src/components/layout/Sidebar.tsx — 현재 사이드바 구조
3. apps/web/src/app/(main)/library/page.tsx — 현재 라이브러리 페이지
4. apps/web/src/components/wordvault/hub/WordVaultHub.tsx — WordVault 허브
5. apps/web/src/app/(main)/settings/page.tsx — 설정 페이지

읽은 후 현재 NAV_GROUPS 정의가 어디에 있고, 어떤 메뉴 항목이 정의되어 있는지 보고해줘.
변경 시작은 내가 "PR1 시작" 이라고 하면 진행해줘.
```

---

## PR 1 — Sidebar 그룹 재정의

### 작업 명령

```
다음 5가지 작업을 순서대로 수행해줘:

1. apps/web/src/components/layout/sidebar-config.ts 파일을 신규 생성
2. apps/web/src/components/layout/Sidebar.tsx 를 신규 config 파일을 import 하도록 리팩터
3. SpellForge 메뉴를 "익히기" 그룹에 추가 (정렬 순서 중요: Flashcard → WordBlitz → SpellForge)
4. "스크립트" 메뉴 라벨을 "내 스크립트"로 변경
5. 다크모드 동작 확인 (data-theme="dark")

작업 후 다음 사항을 검증해서 보고해줘:
- 그룹 수가 정확히 5개인가 (META + 5그룹 + Footer)
- 각 그룹 accent가 5색과 일치하는가
- 익히기 그룹 항목 순서가 인지 깊이 순서대로 정렬되어 있는가
- 모든 메뉴 항목이 최소 44×44 터치 타겟을 만족하는가
```

### sidebar-config.ts 작성 규격

```typescript
// apps/web/src/components/layout/sidebar-config.ts
// CLAUDE.md §17.10 IA 원칙 정합

import {
  Compass, BookOpen, Layers, Zap, Pencil,
  ScrollText, Mic2, Home, BarChart3, Settings,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  ariaLabel?: string;
}

export interface NavGroup {
  label: string;
  accent: string;       // FlowNav stage accent와 동일
  flowStage: 'script' | 'word' | 'practice' | 'conquer' | 'complete';
  items: NavItem[];
}

export const META_ITEMS: NavItem[] = [
  { label: 'Hub',       href: '/hub',       icon: Home },
  { label: 'Dashboard', href: '/dashboard', icon: BarChart3 },
];

export const NAV_GROUPS: NavGroup[] = [
  {
    label: '스크립트',
    accent: '#8B5CF6',           // 보라
    flowStage: 'script',
    items: [
      { label: '라이브러리',   href: '/library', icon: Compass,
        ariaLabel: '공용 콘텐츠 라이브러리' },
      { label: '내 스크립트', href: '/text',    icon: BookOpen,
        ariaLabel: '내가 등록한 스크립트' },
    ],
  },
  {
    label: '단어',
    accent: '#6366F1',           // 인디고
    flowStage: 'word',
    items: [
      { label: 'WordVault', href: '/wordvault', icon: Layers,
        ariaLabel: '내 단어 자산 — 가져오기 진입점 포함' },
    ],
  },
  {
    label: '익히기',
    accent: '#EC4899',           // 핑크
    flowStage: 'practice',
    items: [
      // 정렬 순서 = 인지 깊이 (L4a 자가판정 → L4a 속도 → L4b 생성)
      { label: 'Flashcard',  href: '/flashcard',  icon: Layers,
        ariaLabel: '플래시카드 — 자가판정 회상' },
      { label: 'WordBlitz',  href: '/wordblitz',  icon: Zap,
        ariaLabel: '워드블리츠 — 속도 자동화' },
      { label: 'SpellForge', href: '/spellforge', icon: Pencil,
        ariaLabel: '스펠포지 — 철자 생성 인출' },
    ],
  },
  {
    label: '정복',
    accent: '#F59E0B',           // 앰버
    flowStage: 'conquer',
    items: [
      { label: 'ScriptQuiz', href: '/scriptquiz', icon: ScrollText,
        ariaLabel: '스크립트 독해 검증' },
    ],
  },
  {
    label: '완성',
    accent: '#06B6D4',           // 시안
    flowStage: 'complete',
    items: [
      { label: 'Dictation', href: '/dictate', icon: Mic2,
        ariaLabel: '받아쓰기 — 다중 채널 통합' },
    ],
  },
];

export const FOOTER_ITEMS: NavItem[] = [
  { label: 'Settings', href: '/settings', icon: Settings,
    ariaLabel: '설정 — 데이터 가져오기/내보내기 포함' },
];
```

### Sidebar.tsx 렌더링 규칙 (변경 사항만)

```
- 그룹 라벨: Plus Jakarta Sans 11px / 700 / uppercase / letter-spacing 0.06em / var(--t3)
- 그룹 라벨 좌측: 4px 원형 dot (group.accent 색)
- 그룹 간 여백: space-y-6
- 그룹 내 항목 여백: space-y-1
- 활성 항목: bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] + 좌측 3px 인디케이터
- 호버: bg-[var(--bg2)] (애니메이션 X — Calm UI)
- META, NAV_GROUPS, FOOTER_ITEMS 사이 1px divider (border-[var(--bd)])
- 모든 항목 min-h-[44px]
- aria-current="page" 활성 항목에 부여
```

### 작업 종료 시 보고 형식

```
✅ PR 1 완료
- 변경 파일:
  - apps/web/src/components/layout/sidebar-config.ts (신규)
  - apps/web/src/components/layout/Sidebar.tsx (수정)
- 검증 결과:
  - 그룹 수: 5개 ✓
  - 5색 accent 매칭: ✓
  - 인지 깊이 정렬: ✓
  - 44px 터치 타겟: ✓
- 다음 작업: PR 2 라이브러리 분리

확인 후 "PR2 시작" 이라고 입력해주세요.
```

---

## PR 2 — Library 라우트 분리

### 작업 명령

```
다음 7개 파일을 작업해줘:

1. apps/web/src/app/(main)/library/page.tsx
   → /library/scripts 로 redirect 하는 단순 리다이렉트로 변경

2. apps/web/src/app/(main)/library/layout.tsx (신규)
   → max-w-6xl 컨테이너 + LibraryTabs 헤더

3. apps/web/src/app/(main)/library/scripts/page.tsx (신규)
   → 기존 /library 의 콘텐츠를 그대로 이전

4. apps/web/src/app/(main)/library/vocab/page.tsx (신규)
   → 공용 단어장 페이지 (ModuleHero + CategoryFilter + VocabSetGrid)

5. apps/web/src/components/library/LibraryTabs.tsx (신규)
   → 2탭 (스크립트 / 단어장) · usePathname 활성화

6. apps/web/src/components/library/vocab/categories.ts (신규)
   → 8 카테고리 정의 (id · label · emoji)

7. apps/web/src/components/library/vocab/ (신규 폴더)
   - VocabSetCard.tsx
   - CategoryFilter.tsx (가로 스크롤 칩)
   - VocabSetGrid.tsx
   - mock-data.ts (시드 6세트)

기존 /library 페이지의 콘텐츠는 손실 없이 /library/scripts 로 이전되어야 함.
```

### categories.ts 작성 규격

```typescript
// apps/web/src/components/library/vocab/categories.ts

export const VOCAB_CATEGORIES = [
  { id: 'all',        label: '전체',     emoji: '✨' },
  { id: 'elementary', label: '초등',     emoji: '🌱' },
  { id: 'middle',     label: '중학',     emoji: '📘' },
  { id: 'high',       label: '고등',     emoji: '📗' },
  { id: 'csat',       label: '수능·내신', emoji: '🎯' },
  { id: 'eng_test',   label: '공인영어', emoji: '🌐' },
  { id: 'civil',      label: '공무원',   emoji: '🏛️' },
  { id: 'business',   label: '비즈니스', emoji: '💼' },
  { id: 'themed',     label: '테마별',   emoji: '🎨' },
] as const;

export type VocabCategoryId = typeof VOCAB_CATEGORIES[number]['id'];
```

### LibraryTabs.tsx 작성 규격

```typescript
// apps/web/src/components/library/LibraryTabs.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Compass, Layers } from 'lucide-react';

const TABS = [
  { label: '스크립트', href: '/library/scripts', icon: Compass },
  { label: '단어장',   href: '/library/vocab',   icon: Layers },
];

export function LibraryTabs() {
  const pathname = usePathname();

  return (
    <nav role="tablist" aria-label="라이브러리 탐색"
         className="flex gap-1 border-b border-[var(--bd)]">
      {TABS.map(tab => {
        const isActive = pathname.startsWith(tab.href);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            role="tab"
            aria-selected={isActive}
            className={`
              flex items-center gap-2 px-4 py-3 min-h-[44px]
              font-display text-[14px] font-[600]
              border-b-2 transition-colors duration-[var(--dur-fast)]
              ${isActive
                ? 'border-[#8B5CF6] text-[var(--t1)]'
                : 'border-transparent text-[var(--t3)] hover:text-[var(--t1)]'}
            `}
          >
            <Icon size={16} aria-hidden />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

### /library/vocab/page.tsx 페이지 구조

```
ModuleHero
  - title: "공용 단어장"
  - subtitle: "함께 만든 어휘 자산"
  - note: "총 N개 세트 · 카테고리 8종"
  - accent: 보라 gradient (#8B5CF6 → #6D28D9)

CategoryFilter
  - 가로 스크롤 칩 9개 (전체 + 8 카테고리)
  - 활성 칩: bg group accent / 비활성: bg-[var(--bg2)]
  - 모바일: overflow-x-auto · scrollbar 숨김

VocabSetGrid
  - 데스크톱 3열 / 태블릿 2열 / 모바일 1열
  - 각 VocabSetCard:
    - 제목 (Plus Jakarta 16px / 700)
    - 카테고리 뱃지 + CEFR 뱃지
    - 단어 수 ({count}개 단어)
    - 한 줄 설명 (DM Sans 13px / var(--t3))
    - "내 단어장에 추가" Primary 버튼
    - 이미 구독한 세트는 "추가됨 ✓" disabled

빈 상태
  - "곧 다양한 단어장이 추가될 예정이에요"
  - 일러스트 또는 아이콘 + 카테고리 신청 폼 (선택)
```

### mock-data.ts 시드 6세트

```typescript
// apps/web/src/components/library/vocab/mock-data.ts

export const MOCK_VOCAB_SETS = [
  {
    id: 'csat-top1000',
    title: '수능 빈출 어휘 TOP 1000',
    category: 'csat',
    cefr: 'B2',
    wordCount: 1000,
    description: '최근 10개년 수능 출제 어휘 분석 기반',
  },
  {
    id: 'high-essential-2000',
    title: '고등 필수 2000',
    category: 'high',
    cefr: 'B1~B2',
    wordCount: 2000,
    description: 'EBS 수능 연계 핵심 어휘',
  },
  {
    id: 'middle-1200',
    title: '중학 필수 1200',
    category: 'middle',
    cefr: 'A2~B1',
    wordCount: 1200,
    description: '교육부 중학 기본 어휘 기반',
  },
  {
    id: 'toeic-900',
    title: 'TOEIC 900 핵심',
    category: 'eng_test',
    cefr: 'B2',
    wordCount: 1200,
    description: 'Part 5/6 빈출 문법·어휘',
  },
  {
    id: 'civil-9th',
    title: '공무원 9급 영어',
    category: 'civil',
    cefr: 'B2~C1',
    wordCount: 2000,
    description: '연도별 출제 빈도 분석',
  },
  {
    id: 'business-email',
    title: '비즈니스 이메일 표현',
    category: 'business',
    cefr: 'B2',
    wordCount: 600,
    description: '실무 빈출 표현·관용구',
  },
];
```

### 작업 종료 시 보고 형식

```
✅ PR 2 완료
- 변경 파일: 7개
- 라우트 검증:
  - /library 진입 → /library/scripts 자동 리다이렉트 ✓
  - /library/vocab 진입 가능 ✓
  - 탭 활성화 정상 동작 ✓
- 카테고리 8개 정의 완료, 사이드바 직접 노출 없음 ✓
- 다음 작업: PR 3 단어 가져오기 진입점

확인 후 "PR3 시작" 이라고 입력해주세요.
```

---

## PR 3 — WordVault 가져오기 진입점

### 작업 명령

```
다음 작업을 순서대로 수행해줘:

1. xlsx 패키지 설치 확인 (없으면 추가)
   pnpm add xlsx --filter @vocaflow/web

2. 신규 파일 생성:
   - apps/web/src/components/wordvault/hub/AddWordsPanel.tsx
   - apps/web/src/components/wordvault/import/ImportDialog.tsx
   - apps/web/src/components/wordvault/import/ImportFromFile.tsx
   - apps/web/src/components/wordvault/import/ImportFromGoogleSheets.tsx
   - apps/web/src/components/wordvault/import/ImportPreviewTable.tsx
   - apps/web/src/lib/wordvault/import/parse-csv.ts
   - apps/web/src/lib/wordvault/import/parse-xlsx.ts
   - apps/web/src/lib/wordvault/import/parse-gsheets.ts
   - apps/web/src/lib/wordvault/import/normalize-words.ts

3. WordVaultHub.tsx 에 AddWordsPanel 통합
   - ModeEntryGrid 아래 위치
   - 3카드 grid (AI 추출 / 라이브러리 / 파일 가져오기)

4. apps/web/src/components/settings/DataManagementSection.tsx 신규 생성
   - Settings 페이지에 통합
   - 가져오기 + 내보내기 두 영역
```

### AddWordsPanel.tsx 작성 규격

```typescript
// apps/web/src/components/wordvault/hub/AddWordsPanel.tsx

import Link from 'next/link';
import { useState } from 'react';
import { Sparkles, Compass, Upload } from 'lucide-react';
import { ImportDialog } from '../import/ImportDialog';

export function AddWordsPanel() {
  const [isImportOpen, setIsImportOpen] = useState(false);

  return (
    <section aria-labelledby="add-words-heading" className="mt-8">
      <h2 id="add-words-heading"
          className="font-display text-[14px] font-[600] text-[var(--t2)] mb-3">
        + 단어 추가하기
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* 카드 1: AI 추출 */}
        <Link
          href="/text/new"
          className="
            block p-5 min-h-[110px]
            bg-[var(--bg)] border border-[var(--bd)]
            rounded-[var(--r-lg)]
            hover:border-[var(--p)] transition-colors duration-[var(--dur-fast)]
            focus-visible:ring-2 focus-visible:ring-[var(--p)]
          "
        >
          <Sparkles size={20} className="text-[var(--p)] mb-2" />
          <div className="font-display text-[14px] font-[700] text-[var(--t1)]">
            AI 추출
          </div>
          <div className="font-body text-[12px] text-[var(--t3)] mt-1">
            스크립트에서 자동으로
          </div>
        </Link>

        {/* 카드 2: 라이브러리 */}
        <Link
          href="/library/vocab"
          className="
            block p-5 min-h-[110px]
            bg-[var(--bg)] border border-[var(--bd)]
            rounded-[var(--r-lg)]
            hover:border-[#8B5CF6] transition-colors duration-[var(--dur-fast)]
            focus-visible:ring-2 focus-visible:ring-[#8B5CF6]
          "
        >
          <Compass size={20} className="text-[#8B5CF6] mb-2" />
          <div className="font-display text-[14px] font-[700] text-[var(--t1)]">
            라이브러리
          </div>
          <div className="font-body text-[12px] text-[var(--t3)] mt-1">
            공용 단어장에서 가져오기
          </div>
        </Link>

        {/* 카드 3: 파일 가져오기 */}
        <button
          onClick={() => setIsImportOpen(true)}
          className="
            block p-5 min-h-[110px] text-left w-full
            bg-[var(--bg)] border border-[var(--bd)]
            rounded-[var(--r-lg)]
            hover:border-[var(--success)] transition-colors duration-[var(--dur-fast)]
            focus-visible:ring-2 focus-visible:ring-[var(--success)]
          "
          aria-haspopup="dialog"
        >
          <Upload size={20} className="text-[var(--success)] mb-2" />
          <div className="font-display text-[14px] font-[700] text-[var(--t1)]">
            파일 가져오기
          </div>
          <div className="font-body text-[12px] text-[var(--t3)] mt-1">
            Excel · CSV · Google Sheets
          </div>
        </button>
      </div>

      {isImportOpen && (
        <ImportDialog onClose={() => setIsImportOpen(false)} />
      )}
    </section>
  );
}
```

### normalize-words.ts 작성 규격 (FSRS 정합)

```typescript
// apps/web/src/lib/wordvault/import/normalize-words.ts
// CLAUDE.md §17.4 한국 학습자 초기 파라미터 정합

export interface RawImportRow {
  word: string;
  meaning: string;
  example?: string;
  partOfSpeech?: string;
}

export interface NormalizedWord {
  word: string;
  meaning: string;
  exampleEn: string | null;
  partOfSpeech: string | null;
  difficulty: number;          // FSRS D — 6.0 (한국 학습자 초기값)
  stability: number;            // FSRS S — 0 (첫 학습 전)
  lastReviewAt: null;
  nextReviewAt: null;
  reviewCount: 0;
  moduleHistory: string[];
  source: 'imported';
}

export function normalizeImportedWords(rows: RawImportRow[]): NormalizedWord[] {
  return rows
    .filter(r => r.word?.trim() && r.meaning?.trim())
    .map(r => ({
      word: r.word.trim().toLowerCase(),
      meaning: r.meaning.trim(),
      exampleEn: r.example?.trim() || null,
      partOfSpeech: r.partOfSpeech?.trim() || null,
      difficulty: 6.0,
      stability: 0,
      lastReviewAt: null,
      nextReviewAt: null,
      reviewCount: 0,
      moduleHistory: [],
      source: 'imported',
    }));
}
```

### ImportDialog 4단계 흐름

```
Step 1: 소스 선택
  - 라디오: [ Excel/CSV 업로드 | Google Sheets URL ]

Step 2: 컬럼 매핑
  - 자동 감지 + 사용자 확인
  - word ←→ A열 (필수)
  - meaning ←→ B열 (필수)
  - example ←→ C열 (선택)
  - partOfSpeech ←→ D열 (선택)

Step 3: 미리보기
  - ImportPreviewTable: 최대 20행 표시
  - 중복 단어는 회색 + "이미 있음" 라벨
  - 빈 행은 자동 제외

Step 4: 실행
  - "가져오기" 버튼 → API 호출
  - 결과 토스트: "12개 추가됨 · 3개 이미 있음"
  - Dialog 자동 닫힘 + WordVault 갱신
```

### DataManagementSection.tsx (Settings 통합)

```typescript
// apps/web/src/components/settings/DataManagementSection.tsx

import Link from 'next/link';
import { Upload, Download, ExternalLink } from 'lucide-react';

export function DataManagementSection() {
  return (
    <section aria-labelledby="data-mgmt-heading" className="mt-8">
      <h2 id="data-mgmt-heading"
          className="font-display text-[16px] font-[700] text-[var(--t1)] mb-4">
        데이터 관리
      </h2>

      <div className="bg-[var(--bg)] border border-[var(--bd)] rounded-[var(--r-lg)] divide-y divide-[var(--bd)]">

        {/* 가져오기 행 */}
        <div className="flex items-center justify-between p-4">
          <div>
            <div className="font-display text-[14px] font-[600]">
              내 단어장 가져오기
            </div>
            <div className="font-body text-[12px] text-[var(--t3)] mt-0.5">
              Excel · CSV · Google Sheets
            </div>
          </div>
          {/* WordVault 가져오기 트리거로 라우팅 — query param 사용 */}
          <Link
            href="/wordvault?import=open"
            className="btn btn-secondary btn-sm min-h-[36px]"
          >
            가져오기
          </Link>
        </div>

        {/* 라이브러리 행 */}
        <div className="flex items-center justify-between p-4">
          <div>
            <div className="font-display text-[14px] font-[600]">
              공용 단어장에서 가져오기
            </div>
            <div className="font-body text-[12px] text-[var(--t3)] mt-0.5">
              초·중·고·수능·공인영어 등 8개 카테고리
            </div>
          </div>
          <Link
            href="/library/vocab"
            className="btn btn-secondary btn-sm min-h-[36px]"
          >
            라이브러리 열기
          </Link>
        </div>

        {/* 내보내기 행 */}
        <div className="flex items-center justify-between p-4">
          <div>
            <div className="font-display text-[14px] font-[600]">
              내 단어장 내보내기
            </div>
            <div className="font-body text-[12px] text-[var(--t3)] mt-0.5">
              CSV로 다운로드
            </div>
          </div>
          <button className="btn btn-secondary btn-sm min-h-[36px]">
            내보내기
          </button>
        </div>

        {/* Anki 내보내기 (Phase 2) */}
        <div className="flex items-center justify-between p-4 opacity-60">
          <div>
            <div className="font-display text-[14px] font-[600]">
              Anki .apkg로 내보내기
            </div>
            <div className="font-body text-[12px] text-[var(--t3)] mt-0.5">
              Phase 2 예정
            </div>
          </div>
          <button disabled className="btn btn-secondary btn-sm min-h-[36px]">
            준비 중
          </button>
        </div>

      </div>
    </section>
  );
}
```

### 작업 종료 시 보고 형식

```
✅ PR 3 완료
- 신규 파일: 9개
- 수정 파일: WordVaultHub.tsx, settings/page.tsx
- 가져오기 진입점:
  - WordVault 허브 AddWordsPanel ✓
  - Settings DataManagementSection ✓
  → 정확히 2곳 ✓
- FSRS 초기값 정합:
  - difficulty: 6.0 ✓
  - stability: 0 ✓
- 다음 작업: PR 4 CLAUDE.md 갱신

확인 후 "PR4 시작" 이라고 입력해주세요.
```

---

## PR 4 — CLAUDE.md 갱신

### 작업 명령

```
CLAUDE.md 파일에서 다음 3가지를 갱신해줘:

1. 문서 버전: v06.15 → v06.16

2. §17.10 IA 원칙 섹션의 "Sidebar 5그룹" 부분에 메뉴 라벨 명시 추가:

   기존:
   "5그룹: 스크립트 / 단어 / 익히기 / 정복 / 완성"

   추가 명시:
   - 스크립트 그룹 = [라이브러리, 내 스크립트] — 그룹명은 §17.1 흐름축 L1 라벨과 동일
   - 단어 그룹 = [WordVault] — 단어 가져오기 3진입점(AI 추출, 공용, 파일) 내포
   - 익히기 그룹 = [Flashcard, WordBlitz, SpellForge]
     - 정렬 순서 = 인지 깊이 (L4a 자가판정 → L4a 속도 → L4b 생성)
     - Hick의 법칙 부담 완화 + Sweller 인지 부하 계단 정합
   - 정복 그룹 = [ScriptQuiz]
   - 완성 그룹 = [Dictation]
   - 회고(L7 Reflect) — 별도 메뉴 X · Hub Reflection 영역 + Dashboard로 흡수

3. §17.10 안티패턴 섹션에 4개 항목 추가:
   - Sidebar 그룹을 6개 이상으로 분할 — 5색 accent 체계 깨짐 + FlowNav 매핑 어긋남
   - 공용 단어장 카테고리(8개)를 사이드바에 직접 노출 — Calm UI 위반
   - 동일 모듈 그룹 내 항목 정렬을 알파벳/임의 순으로 변경 — 인지 부하 순서 위반
   - 회고 별도 메뉴화 — 사용자에게 "회고해야 한다" 의무감 부여 (Empathetic Feedback 위반)

4. 문서 최하단 변경 이력에 v06.16 한 줄 추가:

   v06.16 Sidebar IA 정합 보정 — 메뉴 라벨 명확화(스크립트→내 스크립트) ·
   /library 서브 라우트 분리(/scripts·/vocab) ·
   공용 단어장 8 카테고리(페이지 내부 필터) ·
   WordVault 허브 AddWordsPanel(AI 추출·라이브러리·파일 3진입점) ·
   Settings 데이터 관리 섹션 ·
   SpellForge 익히기 그룹 명시(L4a→L4a→L4b 인지 깊이 정렬) ·
   FSRS 초기값 정합(difficulty 6.0, stability 0)

작업 후 변경된 라인 수와 §17.10 정합성을 보고해줘.
```

### 작업 종료 시 보고 형식

```
✅ PR 4 완료
- CLAUDE.md 변경: 약 N 라인 추가
- 버전: v06.15 → v06.16 ✓
- §17.10 5그룹 메뉴 라벨 명시 ✓
- §17.10 안티패턴 4개 추가 ✓
- 변경 이력 v06.16 추가 ✓
- 다음 작업: PR 5 DB 마이그레이션 (선택)

이대로 끝낼지, "PR5 시작" 으로 DB 마이그레이션까지 진행할지 알려주세요.
```

---

## PR 5 — DB 마이그레이션 (선택 · Phase 2)

### 작업 명령

```
supabase/migrations/ 폴더에 다음 마이그레이션 파일 신규 생성:

파일명: YYYYMMDDHHMMSS_v06_16_shared_word_sets.sql

다음 SQL 작업 수행:
1. shared_word_sets 테이블 생성
2. shared_words 테이블 생성
3. user_word_set_subscriptions 테이블 생성
4. RLS 정책 적용
5. vocabularies 테이블에 source 컬럼 추가
6. vocabularies 테이블에 (user_id, word) UNIQUE 제약 추가

작업 후 마이그레이션 dry run 명령어를 알려줘.
```

### SQL 파일 작성 규격

```sql
-- supabase/migrations/[timestamp]_v06_16_shared_word_sets.sql
-- CLAUDE.md v06.16 — 공용 단어장 + 가져오기 정합

-- 1. 공용 단어 세트 (관리자 등록)
CREATE TABLE shared_word_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN (
    'elementary','middle','high','csat','eng_test','civil','business','themed'
  )),
  cefr_level TEXT NOT NULL,
  word_count INT DEFAULT 0,
  is_published BOOLEAN DEFAULT false,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_shared_word_sets_category ON shared_word_sets(category);
CREATE INDEX idx_shared_word_sets_published ON shared_word_sets(is_published);

-- 2. 공용 단어 항목
CREATE TABLE shared_words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id UUID REFERENCES shared_word_sets(id) ON DELETE CASCADE,
  word TEXT NOT NULL,
  meaning_ko TEXT NOT NULL,
  example_en TEXT,
  part_of_speech TEXT,
  cefr_level TEXT,
  sort_order INT DEFAULT 0
);

CREATE INDEX idx_shared_words_set ON shared_words(set_id);

-- 3. 사용자 구독
CREATE TABLE user_word_set_subscriptions (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  set_id UUID REFERENCES shared_word_sets(id) ON DELETE CASCADE,
  subscribed_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, set_id)
);

-- 4. RLS 정책
ALTER TABLE shared_word_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_words ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_word_set_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read published sets" ON shared_word_sets
  FOR SELECT USING (is_published = true);

CREATE POLICY "Read words of published sets" ON shared_words
  FOR SELECT USING (
    set_id IN (SELECT id FROM shared_word_sets WHERE is_published = true)
  );

CREATE POLICY "Users see own subscriptions" ON user_word_set_subscriptions
  FOR ALL USING (auth.uid() = user_id);

-- 5. vocabularies 테이블 변경
ALTER TABLE vocabularies
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'ai'
    CHECK (source IN ('ai','shared_set','imported','manual'));

-- 6. 가져오기 중복 방지
ALTER TABLE vocabularies
  ADD CONSTRAINT vocabularies_user_word_unique UNIQUE (user_id, word);
```

---

## 최종 검증 — 모든 PR 완료 후

### 검증 명령

```
다음 11개 항목을 검증하고 결과를 보고해줘:

[ ] 1. Sidebar 그룹 수가 정확히 5개인가? (META + 5 + Footer)
[ ] 2. 각 그룹 accent가 §17.10 5색과 일치하는가? (보라/인디고/핑크/앰버/시안)
[ ] 3. FlowNav 6단계 라벨과 Sidebar 그룹 라벨이 1:1 매핑되는가?
[ ] 4. 익히기 그룹 항목 순서가 인지 깊이 순(L4a → L4a → L4b)인가?
[ ] 5. 공용 단어장 8 카테고리가 사이드바에 직접 노출되지 않는가?
[ ] 6. 단어 가져오기 진입점이 정확히 2곳(WordVault 허브, Settings)인가?
[ ] 7. 가져온 단어의 FSRS 초기값이 difficulty=6.0, stability=0인가?
[ ] 8. /library 진입 시 /library/scripts로 자동 리다이렉트되는가?
[ ] 9. 모든 Sidebar 항목이 최소 44×44 터치 타겟을 만족하는가?
[ ] 10. Calm UI 위반 없는가? (호버 애니메이션 X, 광고 X, 빨간 카운터 X)
[ ] 11. CLAUDE.md §17.10 갱신 + v06.16 변경 이력 추가됐는가?

각 항목 ✓ / ✗ / ⚠️ 와 근거 파일/라인 번호 함께 보고해줘.
```

### 빌드 검증

```
다음 명령어 순서로 빌드 검증:

1. cd C:\Users\kille\Vocaflow
2. pnpm install (xlsx 추가됐다면)
3. pnpm --filter @vocaflow/web typecheck
4. pnpm --filter @vocaflow/web lint
5. pnpm --filter @vocaflow/web build

오류 발생 시 자동 수정 시도하고 변경 사항 보고해줘.
TypeScript strict mode · ESLint vocaflow 공통 룰 준수 필수.
```

---

## 작업 시작

```
"PR1 시작"
```

위 한 줄을 입력하면 PR1부터 순차 진행합니다.

각 PR 완료 후 자동 보고 → 사용자 확인 후 다음 PR 진행 → 마지막에 최종 검증.

전체 작업을 한 번에 진행하려면 "전체 진행" 이라고 입력.

---

*이 지시문은 CLAUDE.md v06.16 (예정) 의 부속 문서입니다.*
*충돌 시 CLAUDE.md가 우선합니다.*
