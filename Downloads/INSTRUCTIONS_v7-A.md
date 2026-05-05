# Vocaflow `/text` 입력 허브 v2 — VS Code Claude Code 지시문 v7-A

> 본 지시문의 본질: **`/text` 페이지를 "입력 도구 + 입력 이력 미니 허브"로 충실하게 정합화**합니다.
> 라우트 분리·신규 컴포넌트·새 데이터 모델 모두 **하지 않습니다**. `page.tsx` 한 파일만 수정합니다.
> Phase 2(DB 연동) 작업은 명시적으로 미룹니다.

---

## 0. 역할 및 규칙

- **SSoT**: 워크스페이스 루트 `CLAUDE.md v06.9` (특히 §17.1 L1 Acquire)
- 응답 언어: **한국어** / 코드 주석: **영문**
- 결론 먼저, 근거는 그 다음
- 절대 금지: TODO · placeholder · 미완성 코드
- 색상 하드코딩 금지 (CSS 변수만)
- 매 단계 끝 → 사용자 승인 후 다음 단계

---

## 1. 워크스페이스 확정 사실 (사전 정찰 완료)

```
✅ 사이드바: { href: '/text', label: '직접 입력', Icon: Plus }
   → 사용자에게 /text는 "라이브러리"가 아니라 "입력 도구"

✅ /text/page.tsx 현재 구조:
   ├─ Step 01 헤더
   ├─ "AI가 분석합니다" 메인 카피
   ├─ RECENT_TEXTS (mock, 3개) "이어서 작업하기" mini panel ← 이미 존재
   ├─ InputModeTabs (text / file / url)
   ├─ 입력 영역 (TextInput / FileUploadArea / UrlInput)
   ├─ SampleScripts
   └─ "AI로 단어 추출하기" CTA → /wordvault

✅ handoff.ts: 단어만 sessionStorage 인계 (텍스트 메타데이터 저장 X)

✅ /library: '내가 쌓아온 영어 원문 컬렉션' description으로 라이브러리 역할 담당
   → /text 허브가 라이브러리를 흉내내면 역할 충돌

✅ LibraryText 타입: types/library.ts에 정의, /library 와 /text/[id] 가 공유
   → 새 데이터 모델 만들 필요 없음
```

## 2. 본 작업의 본질

> **`/text`를 "입력 도구"로 충실하게 정합화. RECENT_TEXTS를 확장해 Zeigarnik 효과 강화. 그 외는 손대지 않음.**

### 2-A. 변경할 것 — 4개

| # | 변경 | 영향 파일 |
|---|------|---------|
| 1 | RECENT_TEXTS mock 5개로 확장, LibraryText 타입 사용 | `page.tsx` |
| 2 | Continue 섹션 시각 강화 — 가로 스크롤 → 응답형 그리드 | `page.tsx` |
| 3 | Hero 카피 정합 — "입력 도구"임을 분명히 | `page.tsx` |
| 4 | Continue 섹션 비어있을 때 EmptyState 메시지 추가 | `page.tsx` |

### 2-B. 변경 안 하는 것 — 명시

- ✋ 라우트 분리 (`/text/new` 신설 안 함)
- ✋ 새 컴포넌트 파일 (`TextHubClient`, `MyTextsSection` 등 안 만듦)
- ✋ 새 데이터 모델 (`LibraryText` 그대로 사용)
- ✋ `handoff.ts` 수정
- ✋ 입력 영역 로직 (`TextInput`, `SampleScripts` 등) 수정
- ✋ "AI로 단어 추출하기" 흐름 수정

### 2-C. Phase 2로 미루는 것 — 명시

DB 연동 시점에 별도 지시문으로 처리:
- 카드 호버 메뉴 (편집/삭제)
- "정복" 4단계 상태 배지 (`texts.progress_percent`)
- CEFR 필터 / 검색 / 정렬
- 페이지네이션 / 무한 스크롤
- `/text/new` 라우트 분리 (입력 이력 12개 이상일 때 의미)

---

## 3. 단계 0 — 사전 확인 (수정 안 함, 읽기만)

작업 시작 전 다음을 확인:

```bash
# LibraryText 타입 정의 확인
cat src/types/library.ts | head -50
```

확인 포인트:
- `LibraryText` 인터페이스 필드 (id, title, author, cefrLevel, progressPercent, lastStudiedAt, ...)
- 이 타입이 `/text/page.tsx`에서 사용 가능한지

`/library` mock 데이터 확인:

```bash
sed -n '14,80p' 'src/app/(main)/library/page.tsx'
```

확인 포인트:
- mock 데이터 구조 — RECENT_TEXTS도 동일 구조로 통일 가능한지

확인이 끝나면 다음 단계로.

---

## 4. 단계 1 — RECENT_TEXTS 확장 + LibraryText 타입 통합

### 4-A. RecentText 인터페이스 제거 → LibraryText 사용

현재 `page.tsx` 라인 19~28에 `interface RecentText { ... }`가 있음. 이걸 제거하고 `LibraryText`를 import해서 사용.

```typescript
// page.tsx 상단 import 추가
import type { LibraryText } from '@/types/library'
```

기존 `interface RecentText { ... }` 블록 전체 삭제.

### 4-B. RECENT_TEXTS mock 데이터 5개로 확장

기존 3개에서 5개로. LibraryText 타입에 맞춰 모든 필수 필드 채움.

```typescript
// §17.1 L1 Acquire — 최근 입력 원문 mini panel (Zeigarnik priming)
// DB 연동 시: Supabase texts 테이블에서 user_id, last_opened DESC 5개 fetch
// progress_percent < 100 우선, 100 도달 텍스트는 자연 disappearance
const RECENT_TEXTS: LibraryText[] = [
  {
    id: '1',
    title: 'The Great Gatsby',
    author: 'F. Scott Fitzgerald',
    cefrLevel: 'B2',
    category: '클래식',
    preview: 'In my younger and more vulnerable years...',
    wordCount: 32,
    progressPercent: 72,
    totalPages: 12,
    currentPage: 9,
    coverGradient: { from: '#0F766E', to: '#064E3B' },
    addedAt: new Date('2024-12-01'),
    lastStudiedAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
    isBookmarked: false,
  },
  {
    id: '2',
    title: 'TED · Power of Vulnerability',
    author: 'Brené Brown',
    cefrLevel: 'B1',
    category: '강연',
    preview: 'I have had a slightly different relationship with vulnerability...',
    wordCount: 24,
    progressPercent: 45,
    totalPages: 6,
    currentPage: 3,
    coverGradient: { from: '#7C3AED', to: '#4C1D95' },
    addedAt: new Date('2024-11-25'),
    lastStudiedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
    isBookmarked: false,
  },
  {
    id: '3',
    title: 'Steve Jobs Stanford Speech',
    author: 'Steve Jobs',
    cefrLevel: 'B2',
    category: '연설',
    preview: 'Today I want to tell you three stories from my life...',
    wordCount: 18,
    progressPercent: 100,
    totalPages: 4,
    currentPage: 4,
    coverGradient: { from: '#DC2626', to: '#7F1D1D' },
    addedAt: new Date('2024-11-15'),
    lastStudiedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7),
    isBookmarked: true,
  },
  {
    id: '4',
    title: 'New York Times · Tech Trends',
    author: 'NYT Editorial',
    cefrLevel: 'C1',
    category: '뉴스',
    preview: 'Artificial intelligence has reshaped how we approach...',
    wordCount: 41,
    progressPercent: 28,
    totalPages: 8,
    currentPage: 2,
    coverGradient: { from: '#1F2937', to: '#0F172A' },
    addedAt: new Date('2024-12-05'),
    lastStudiedAt: new Date(Date.now() - 1000 * 60 * 60 * 6),
    isBookmarked: false,
  },
  {
    id: '5',
    title: 'A Brief History of Time',
    author: 'Stephen Hawking',
    cefrLevel: 'C1',
    category: '과학',
    preview: 'The universe is everything that exists...',
    wordCount: 27,
    progressPercent: 12,
    totalPages: 10,
    currentPage: 1,
    coverGradient: { from: '#0EA5E9', to: '#075985' },
    addedAt: new Date('2024-12-03'),
    lastStudiedAt: new Date(Date.now() - 1000 * 60 * 60 * 48),
    isBookmarked: false,
  },
]
```

### 4-C. 상대 시간 계산 헬퍼 추가

`updatedAt: '어제'` 같은 hardcoded 문자열 대신 `lastStudiedAt: Date`에서 동적 계산하도록.

```typescript
// page.tsx 상단(컴포넌트 외부)에 헬퍼 추가
function relativeTimeKo(date: Date): string {
  const diffMs = Date.now() - date.getTime()
  const diffH = diffMs / (1000 * 60 * 60)
  const diffD = diffH / 24
  if (diffH < 1) return '방금'
  if (diffH < 24) return `${Math.floor(diffH)}시간 전`
  if (diffD < 2) return '어제'
  if (diffD < 7) return `${Math.floor(diffD)}일 전`
  if (diffD < 14) return '1주일 전'
  if (diffD < 30) return `${Math.floor(diffD / 7)}주 전`
  return '오래 전'
}
```

### 4-D. 검증

```bash
cd apps/web
npx tsc --noEmit
```

기대: TSC 0 errors.

---

## 5. 단계 2 — Continue 섹션 시각 강화

기존 가로 스크롤 mini panel을 **반응형 그리드**로 개선합니다.

### 5-A. 기존 Continue 섹션 위치

`/text/page.tsx` 내 `{RECENT_TEXTS.length > 0 && (...)}` 블록.

### 5-B. 변경 사항

1. **컨테이너**: `<ul className="-mx-1 flex gap-2 overflow-x-auto pb-1 ...">` → `<ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">`
2. **카드 너비**: 고정 `w-[220px]` → 그리드 자동 (`w-full`)
3. **카드 메타 정보**: `chapter` 필드 → `author + category` 조합
4. **타이밍 표시**: hardcoded `'어제'` → `relativeTimeKo(lastStudiedAt)`
5. **CEFR 배지 추가**: 카드 우상단에 작은 CEFR 라벨
6. **정복 표시**: progressPercent === 100인 카드는 우상단에 작은 🏆 아이콘 (배지 형태 X — 가벼운 시각 신호)

### 5-C. 정정된 Continue 섹션 코드 (전체 교체)

기존 Continue 섹션 블록을 다음으로 교체:

```typescript
{RECENT_TEXTS.length > 0 && (
  <section
    aria-label="최근 입력한 원문"
    className="mb-s-6 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-s-4 shadow-[var(--sh-xs)]"
  >
    <header className="mb-s-3 flex items-center gap-s-2">
      <Clock3 size={12} className="text-t3" aria-hidden />
      <p className="font-mono text-[10px] font-[700] uppercase tracking-[0.10em] text-t3">
        이어서 작업하기
      </p>
      <span className="ml-auto font-mono text-[10px] text-t3">
        {RECENT_TEXTS.length}개
      </span>
    </header>

    {/* §17.1 L1 Acquire mini panel — Zeigarnik priming
       반응형 그리드: 1col(mobile) / 2col(sm) / 3col(lg) */}
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {RECENT_TEXTS.map((rt) => {
        const pct = rt.progressPercent
        const done = pct >= 100
        return (
          <li key={rt.id}>
            <Link
              href={`/text/${rt.id}`}
              aria-label={`${rt.title} 이어서 학습 (${pct}%)`}
              className="group block rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-3 transition-all duration-[var(--dur-normal)] hover:-translate-y-0.5 hover:border-p hover:bg-bg hover:shadow-[var(--sh-sm)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-1"
            >
              {/* Top row: title + CEFR + done icon */}
              <div className="flex items-start gap-1.5">
                <BookOpen
                  size={11}
                  className="mt-0.5 shrink-0 text-p"
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate font-english text-[13px] font-[600] text-t1">
                  {rt.title}
                </span>
                {done && (
                  <span
                    className="font-mono text-[10px]"
                    aria-label="정복 완료"
                    title="정복 완료"
                  >
                    🏆
                  </span>
                )}
                <span
                  className="shrink-0 rounded-[var(--r-sm)] bg-bg3 px-1.5 py-0.5 font-mono text-[9px] font-[700] uppercase tracking-wider text-t2"
                  aria-label={`레벨 ${rt.cefrLevel}`}
                >
                  {rt.cefrLevel}
                </span>
              </div>

              {/* Author + category */}
              <p className="mt-1 truncate font-body text-[11px] text-t3">
                {rt.author} · {rt.category}
              </p>

              {/* Progress bar */}
              <div className="mt-2 flex items-center gap-2">
                <div
                  className="h-1 flex-1 overflow-hidden rounded-full bg-bg3"
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: done ? 'var(--success)' : 'var(--p)',
                    }}
                  />
                </div>
                <span
                  className="font-mono text-[10px] font-[700] tabular-nums"
                  style={{
                    color: done ? 'var(--success)' : 'var(--p)',
                  }}
                >
                  {pct}%
                </span>
              </div>

              {/* Meta */}
              <div className="mt-1 flex items-center justify-between font-mono text-[10px] text-t3">
                <span>{rt.wordCount}단어</span>
                <span>{relativeTimeKo(rt.lastStudiedAt)}</span>
              </div>
            </Link>
          </li>
        )
      })}
    </ul>
  </section>
)}
```

### 5-D. 검증

```bash
cd apps/web
npx tsc --noEmit
pnpm dev
```

브라우저에서 `/text` 진입 → "이어서 작업하기" 섹션이 1열(모바일) / 2열(태블릿) / 3열(데스크톱) 그리드로 표시 확인.

---

## 6. 단계 3 — Hero 카피 정합화

현재 Hero는 "Step 01 / Script Input" 식의 워크플로 표현이 강합니다. 사이드바 라벨이 "직접 입력"이므로 **입력 도구임을 더 분명히** 합니다.

### 6-A. 기존 Hero 위치

`/text/page.tsx` 내 `<div className="mb-s-8">...</div>` 블록 (Step 01 + 메인 카피 영역).

### 6-B. 카피 변경

| 위치 | 기존 | 변경 후 |
|------|------|--------|
| 작은 라벨 | `— Step 01 / Script Input` | `— 새 원문 추가하기` |
| 메인 제목 | "영어 스크립트를 / AI가 분석합니다" | "원문을 추가하면 / AI가 단어를 추출합니다" |
| 부제 | "텍스트를 직접 입력하거나 PDF · DOCX · TXT 파일을 업로드하면, AI가 핵심 단어를 추출해 학습용 단어장을 자동 생성합니다." | (그대로 유지 — 충분히 명확) |

이유:
- "Step 01"은 워크플로우 진행감 표현이지만 실제로 사용자는 자유 진입 (Step 의미 약함)
- "스크립트"보다 "원문"이 한국 학습자에게 자연스러움 (CLAUDE.md 다른 영역의 용어와 통일)

### 6-C. 헤더 라벨 변경

상단 헤더의 `Step 01 / 학습 시작`도 동일 톤으로:

| 위치 | 기존 | 변경 후 |
|------|------|--------|
| 헤더 부제 | `Step 01 / 학습 시작` | `직접 입력 · 새 원문 추가` |
| 헤더 부제 (분석 중) | `AI 분석 중...` | (그대로) |

### 6-D. 검증

```bash
cd apps/web
npx tsc --noEmit
pnpm dev
```

브라우저에서 `/text` 진입 → Hero 영역의 카피가 "직접 입력 도구"임을 명확히 표현하는지 확인.

---

## 7. 단계 4 — Continue 섹션 비어있을 때 처리

현재 코드는 `RECENT_TEXTS.length > 0 && ...`로 비어있을 때 섹션 자체를 숨김. 하지만 **Cold 사용자가 처음 진입했을 때 길잡이가 없음**.

### 7-A. EmptyState 추가

`{RECENT_TEXTS.length > 0 && ...}` 블록 직후에 빈 상태용 안내 추가:

```typescript
{RECENT_TEXTS.length === 0 && (
  <div
    className="mb-s-6 rounded-[var(--r-lg)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] p-s-5 text-center"
    aria-label="첫 원문 안내"
  >
    <Sparkles size={18} className="mx-auto mb-2 text-p" aria-hidden />
    <p className="mb-1 font-display text-[13px] font-[700] text-t1">
      아직 추가한 원문이 없어요
    </p>
    <p className="font-body text-[12px] text-t2">
      첫 원문을 입력하거나 라이브러리에서 골라보세요
    </p>
    <Link
      href="/library"
      className="mt-3 inline-flex items-center gap-1 font-display text-[11px] font-[700] text-p hover:underline"
    >
      라이브러리 둘러보기 →
    </Link>
  </div>
)}
```

이 EmptyState는 `/library` 진입을 부드럽게 유도. **두 페이지의 협력 관계**를 명시.

### 7-B. 검증

이 분기는 RECENT_TEXTS가 5개로 채워진 현재는 노출 안 됨. 검증 시 임시로 `RECENT_TEXTS = []`로 빈 배열 만들어 화면 확인 → 다시 5개로 복원.

---

## 8. 단계 5 — 전체 검증 + 보고

### 8-A. 검증 명령

```bash
cd apps/web
npx tsc --noEmit
pnpm dev
```

### 8-B. 시각 검증 (브라우저)

`/text` 진입 시 다음 모두 확인:

- [ ] Hero 영역: "직접 입력 · 새 원문 추가" + "원문을 추가하면 / AI가 단어를 추출합니다"
- [ ] Continue 섹션: 5개 카드가 그리드로 표시 (1/2/3열 반응형)
- [ ] 카드 우상단: CEFR 배지 + 정복(100%)인 카드는 🏆 아이콘
- [ ] 진행률 막대: 100%는 success 색, 그 외 primary 색
- [ ] 상대 시간: "방금" / "N시간 전" / "어제" / "N일 전" / "1주일 전" 등
- [ ] 카드 호버: -translate-y-0.5 lift + border 색 변경
- [ ] 입력 영역: 기존 흐름 그대로 (TextInput / FileUploadArea / UrlInput / SampleScripts)
- [ ] CTA: "AI로 단어 추출하기" 클릭 → /wordvault 이동 (기존 흐름)

### 8-C. 보고 형식

```markdown
### 단계 1~4 (TextViewer 입력 허브 v2) 완료

수정 파일: src/app/(main)/text/page.tsx (한 파일만)

변경 사항:
1. RecentText 인터페이스 제거 → LibraryText 타입 사용
2. RECENT_TEXTS mock 5개로 확장 (LibraryText 타입 정합)
3. relativeTimeKo 헬퍼 추가
4. Continue 섹션: 가로 스크롤 → 반응형 그리드 (1/2/3열)
5. 카드 디자인 강화: CEFR 배지 + 정복 🏆 아이콘 + author/category
6. Hero 카피 정합: "직접 입력 도구"임을 명시
7. EmptyState 추가: RECENT_TEXTS 비어있을 때 라이브러리 유도

수정 안 한 것:
- 라우트 분리 (/text/new 신설 안 함)
- 새 컴포넌트 파일 (안 만듦)
- handoff.ts (그대로 유지)
- 입력 영역 로직 (TextInput / SampleScripts 등)
- "AI로 단어 추출하기" CTA 흐름

검증:
- TSC: 0 errors
- 브라우저: 모든 시각 항목 확인 완료

다음 마일스톤 (별도 지시문):
- DB 설계 + cardId 통합 + 추천 엔진 (v8)
- /text Phase 2: 카드 호버 메뉴, 4단계 상태 배지, 필터/검색 (DB 후)
- WordVault 허브 신규 (v7-B)
- WordBlitz /play 분리 (v7-C)
```

---

## 9. 자가 점검 체크리스트

작업 완료 후:

- [ ] 수정 파일은 `src/app/(main)/text/page.tsx` 한 개뿐인가?
- [ ] 새 컴포넌트 파일을 만들지 않았는가?
- [ ] 라우트(`/text/new`)를 분리하지 않았는가?
- [ ] `LibraryText` 타입을 그대로 사용했는가? (새 인터페이스 X)
- [ ] mock 5개 모두 LibraryText 필수 필드 채웠는가?
- [ ] 색상은 CSS 변수만 사용했는가? (CEFR 배지 색 등)
- [ ] 다크모드 대응 (data-theme="dark") 정합?
- [ ] 키보드 포커스 (focus-visible:ring) 모든 카드/링크에 있는가?
- [ ] aria-label 모든 카드에 있는가?
- [ ] progressbar role + aria-valuenow 설정?
- [ ] TODO·placeholder 0건?

---

## 10. 막혔을 때

| 상황 | 대응 |
|------|------|
| `LibraryText` 필드명이 다름 | `cat src/types/library.ts`로 정확한 필드명 확인 후 mock 정정 |
| Tailwind 임의 클래스 (`gap-s-4`, `mb-s-3`) 인식 안 됨 | 워크스페이스의 Tailwind config 보고 정합. 표준 Tailwind면 `gap-4`, `mb-3` 사용 |
| `hover:border-p` 작동 X | `hover:border-[var(--p)]`로 명시 |
| RECENT_TEXTS 5개가 너무 많아 보임 | 그리드는 그대로, mock 개수만 줄여도 OK (3~5개 사이) |

---

## 11. 다음 작업 — 본 지시문 범위 밖

| 우선순위 | 작업 | 예상 |
|:-:|------|------|
| 🔴 | DB 설계 (Supabase + Migration SQL) | v8 |
| 🟡 | WordVault 허브 신규 | v7-B |
| 🟢 | WordBlitz `/play` 분리 | v7-C |
| 🔵 | TextViewer Phase 2 (카드 메뉴, 상태 배지) | v8-A (DB 후) |

---

이 지시문을 끝까지 읽었다면, **단계 0 (사전 확인)** 부터 시작하세요.
