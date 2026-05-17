# Standard Ebooks — Phase 13 핸드오프 지시문 (정합본 v2)

> **상태**: SSoT 정합 검증 완료. 12건 정정 모두 디스크 실측 기준 반영.
> **이전 폐기**: `/admin/library/standard-ebooks` 평행 인프라 + `standard_ebooks_catalog` 테이블 + `texts.is_published` 컬럼 모두 폐기.

## 사전 확인 (CLAUDE.md v06.28)

- §15 Admin Console — 보라 액센트 `#8B5CF6 → #6D28D9`, AdminSidebar
- §18 LCP v2.0 — pipeline S1~S6, `library_books` status enum 7종 (queued/processing/ready/analyzed/published/failed/archived)
- §18.4 폴더 구조 — `packages/library-pipeline/src/ingest/`
- §18.8 안티패턴 — OpenAI 금지, GENERATED with now() 금지
- §18.9 BLOCKER #15 — SECURITY DEFINER · 트리거 함수에 `SET search_path = public, pg_temp` 명시
- §18.10 미정 항목 1건 — Phase 13 SE fetcher (본 PR 이 해소)
- §18.11 Phase 12 Admin Curation Console — `/admin/curation` 4탭 + 9 컴포넌트 + `EnqueueModal` 재사용
- §Colors — `--bg / --bg2 / --bg3 / --t1~t4 / --ti / --bd / --p / --p-hover / --p-light / --info / --info-light / --error / --error-light / --warning / --warning-light / --success / --success-light / --active`
- §Typography — `font-display` (Plus Jakarta) · `font-body` (DM Sans) · `font-english` (Lora) · `font-mono` (JetBrains Mono)

## 절대 하지 말 것

- ❌ `/admin/library/standard-ebooks` 신규 라우트 — `/admin/curation` 3번째 탭으로 통합
- ❌ `standard_ebooks_catalog` 신규 테이블 — `library_source_catalogs` 의 기존 row 사용
- ❌ `texts.is_published` 컬럼 — `library_books.status='published'` 사용
- ❌ 자체 status 머신 — 기존 7단계 enum 그대로
- ❌ `var(--bg1)` · `var(--info-bg)` · `var(--warn-bg)` · `var(--focus-ring)` — 미존재 토큰
- ❌ `font-serif` — 실제는 `font-english`
- ❌ `'standard-ebooks'` (hyphen) enum — **실제는 `'standard_ebooks'` (underscore)** (라우트 경로만 hyphen 사용 가능)
- ❌ `fetcher_module` 컬럼 — 존재하지 않음. dispatch 는 `route.ts:92` switch 만

---

## 디스크 실측 결과 (핸드오프 시점 SSoT)

### library_source_catalogs 실제 스키마 + SE row

```sql
-- 마이그레이션: supabase/migrations/20260508120600_lcp_v2_source_catalogs.sql
CREATE TABLE library_source_catalogs (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source                   TEXT NOT NULL UNIQUE,        -- ★ slug 역할 (PK는 id UUID)
  display_name             TEXT NOT NULL,
  description              TEXT,
  api_endpoint             TEXT,                         -- OPDS 등
  catalog_url              TEXT,                         -- 사람용 카탈로그
  documentation_url        TEXT,
  quality_text             FLOAT NOT NULL CHECK (0..5),
  quality_metadata         FLOAT NOT NULL CHECK (0..5),
  quality_api              FLOAT NOT NULL CHECK (0..5),
  quality_learning         FLOAT NOT NULL CHECK (0..5),
  quality_license          FLOAT NOT NULL CHECK (0..5),
  quality_volume           FLOAT NOT NULL CHECK (0..5),
  composite_score          FLOAT NOT NULL DEFAULT 0,    -- ★ 트리거 자동 계산 (가중 평균)
  license_summary          TEXT NOT NULL,
  copyright_safe_in_kr     BOOLEAN NOT NULL,
  catalog_size             INT,
  is_implemented           BOOLEAN NOT NULL DEFAULT false,
  is_enabled               BOOLEAN NOT NULL DEFAULT true,
  notes                    TEXT,
  created_at / updated_at  TIMESTAMPTZ
);

-- SE 시드 row (이미 존재, is_implemented=false 만 변경 필요):
INSERT INTO library_source_catalogs (...) VALUES (
  'standard_ebooks', 'Standard Ebooks',
  '자원봉사자가 수작업으로 검수한 깔끔한 EPUB 고전. 타이포그래피·메타데이터 최상.',
  'https://standardebooks.org/opds',
  'https://standardebooks.org/ebooks',
  'https://standardebooks.org/contribute',
  5.0, 5.0, 5.0, 4.0, 5.0, 2.0,
  'CC0 (Public Domain Dedication)', true, 700, false, true
);
```

### Fetcher 현 상태

```typescript
// packages/library-pipeline/src/ingest/standard-ebooks.ts (193 lines, 구현됨)
export async function ingestFromStandardEbooks(sourceId: string): Promise<RawBook>;

// packages/library-pipeline/src/ingest/gutenberg.ts (참조 패턴)
export async function ingestFromGutenberg(bookId: string): Promise<RawBook>;

// packages/library-pipeline/src/types.ts:6 — BookSource enum 에 이미 'standard_ebooks' 포함
```

### Worker dispatch 현 상태

```typescript
// apps/web/src/app/api/lcp/process/route.ts:90-96 — SE 분기 누락
await updateStatus('ingesting')
let raw
if (book.source === 'gutenberg') {
  raw = await ingestFromGutenberg(book.source_id as string)
} else {
  throw new Error(`Source not implemented: ${book.source}`)   // ← SE enqueue 시 여기서 실패
}
```

---

## 작업 A — Worker dispatch + `searchStandardEbooksCatalog()` 추가

### A.1 `route.ts` switch 확장 (필수 BLOCKER 해소)

```typescript
// apps/web/src/app/api/lcp/process/route.ts:90~96 교체

await updateStatus('ingesting')
let raw
if (book.source === 'gutenberg') {
  raw = await ingestFromGutenberg(book.source_id as string)
} else if (book.source === 'standard_ebooks') {
  raw = await ingestFromStandardEbooks(book.source_id as string)
} else {
  throw new Error(`Source not implemented: ${book.source}`)
}
```

import 추가:
```typescript
import { ingestFromGutenberg, ingestFromStandardEbooks } from '@vocaflow/library-pipeline'
```

### A.2 `searchStandardEbooksCatalog()` 신규 추가

기존 `ingest/standard-ebooks.ts` 에 export 추가 (현재 `ingestFromStandardEbooks` 만 존재):

```typescript
// packages/library-pipeline/src/ingest/standard-ebooks.ts (append)

export interface SeCatalogEntry {
  source_id: string;          // e.g. 'jane-austen/pride-and-prejudice'
  title: string;
  author: string;
  language: string;
  cover_url?: string;
  genres?: string[];
  published_year?: number;
  word_count_estimate?: number;
}

export interface SearchSeCatalogParams {
  query?: string;
  genre?: string;     // fiction / nonfiction / poetry / drama / shorts
  limit?: number;     // default 24, max 50
  offset?: number;
}

/**
 * Standard Ebooks OPDS 카탈로그 검색.
 * - 전체 카탈로그 endpoint: https://standardebooks.org/opds/all
 * - 응답: Atom XML — fast-xml-parser 로 파싱
 * - 호출자가 캐시 책임 (Edge cache 권장)
 */
export async function searchStandardEbooksCatalog(
  params: SearchSeCatalogParams = {},
): Promise<{ entries: SeCatalogEntry[]; has_more: boolean }>;
```

구현 메모:
- OPDS Atom 파싱은 `fast-xml-parser` 사용 (이미 LCP 의존성에 있다면 재사용, 없으면 `pnpm add --filter @vocaflow/library-pipeline fast-xml-parser` — `pnpm why fast-xml-parser` 로 사전 확인)
- `source_id` = OPDS `<id>` 의 `https://standardebooks.org/ebooks/` 접두사 제거한 slug
- query 가 있으면 client-side 필터 (SE OPDS 가 검색 파라미터 미지원 시), 없으면 페이지네이션만

### A.3 BookSource enum 확인 (변경 불필요)

```typescript
// packages/library-pipeline/src/types.ts:6 — 이미 'standard_ebooks' 포함
```

확인 명령:
```bash
grep -n "standard_ebooks\|BookSource" packages/library-pipeline/src/types.ts
```

### A.4 체크리스트

- [ ] `route.ts:90-96` switch 확장 (else if 추가) — **이게 BLOCKER 1순위**
- [ ] `ingest/standard-ebooks.ts` 에 `searchStandardEbooksCatalog()` + 타입 export 추가
- [ ] `packages/library-pipeline/src/index.ts` 의 export 확인 — `searchStandardEbooksCatalog` 도 re-export
- [ ] `fast-xml-parser` 의존성 확인/추가
- [ ] CLI smoke test: `node -e "import('@vocaflow/library-pipeline').then(m => m.ingestFromStandardEbooks('jane-austen/pride-and-prejudice'))"` 로 실 호출 1건 검증

---

## 작업 B — `library_source_catalogs` SE row 활성화

### B.1 마이그레이션 (UPDATE 1줄)

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_se_fetcher_phase13.sql

BEGIN;

-- Standard Ebooks fetcher 구현 완료 → is_implemented 활성화
-- 다른 메타(api_endpoint, quality_*, license_summary, catalog_size 등)는 이미 시드에 정확히 채워져 있음.
UPDATE library_source_catalogs
SET
  is_implemented = true,
  notes          = COALESCE(notes, '') || E'\nPhase 13 (v06.28+): fetcher implemented at packages/library-pipeline/src/ingest/standard-ebooks.ts',
  updated_at     = now()
WHERE source = 'standard_ebooks';

-- 검증
DO $$
DECLARE
  cnt INT;
BEGIN
  SELECT count(*) INTO cnt FROM library_source_catalogs
   WHERE source = 'standard_ebooks' AND is_implemented = true;
  IF cnt <> 1 THEN
    RAISE EXCEPTION 'SE row activation failed (expected 1, got %)', cnt;
  END IF;
END $$;

COMMIT;
```

### B.2 체크리스트

- [ ] 마이그레이션 timestamp 는 `supabase/migrations/` 의 마지막 파일보다 큰 값
- [ ] dry-run: `supabase db reset` 로 전체 마이그레이션 재실행 검증
- [ ] 적용 후 `SELECT source, is_implemented FROM library_source_catalogs WHERE source='standard_ebooks';` 로 확인

---

## 작업 C — `BrowseSourceTab` (5번째 탭) 신설

### C.1 폴더 구조

```
apps/web/src/components/admin/curation/
└── BrowseSourceTab.tsx              ← ★ 신규 (1 파일)

apps/web/src/app/admin/curation/
├── page.tsx                          ← 패치 (RSC 병렬 fetch 2개 추가)
└── AdminCurationClient.tsx           ← 패치 (5번째 탭 등록)

apps/web/src/app/api/admin/library/
└── browse-source/
    └── route.ts                      ← ★ 신규 (OPDS 프록시)

apps/web/src/lib/admin/library-queries.ts   ← 패치 (헬퍼 2개 추가)
```

### C.2 5번째 탭 등록 — `AdminCurationClient.tsx`

```tsx
// 기존 4탭에 3번째 위치로 'browse' 삽입
const TABS = [
  { id: 'sources',      label: '소스 카탈로그', icon: Library },
  { id: 'seeds',        label: '추천 시드',     icon: Sparkles },
  { id: 'browse',       label: '소스 탐색',     icon: Compass },     // ★ 신규
  { id: 'gutenberg-id', label: 'ID 직접 입력',  icon: Hash },
  { id: 'curated',      label: 'Curated Books', icon: BookOpenCheck },
] as const;
```

탭 컨테이너에 `<BrowseSourceTab implementedSources={...} enqueuedKeys={...} />` 분기 추가.

### C.3 `BrowseSourceTab.tsx` — 전체 코드

```tsx
// apps/web/src/components/admin/curation/BrowseSourceTab.tsx
'use client';

import { useState, useCallback } from 'react';
import { Compass, Search, Loader2, ExternalLink, Plus } from 'lucide-react';
import { EnqueueModal } from './EnqueueModal';

type CatalogEntry = {
  source_id: string;
  title: string;
  author: string;
  language: string;
  cover_url?: string;
  genres?: string[];
  word_count_estimate?: number;
  published_year?: number;
};

/** 실제 컬럼명 정합 (library_source_catalogs) */
type ImplementedSource = {
  source: string;          // ★ slug (PK 는 id UUID)
  display_name: string;
  composite_score: number;
};

interface Props {
  implementedSources: ImplementedSource[];
  enqueuedKeys: Set<string>;   // `${source}:${source_id}`
}

const GENRES = [
  { value: '',           label: '전체' },
  { value: 'fiction',    label: 'Fiction' },
  { value: 'nonfiction', label: 'Nonfiction' },
  { value: 'poetry',     label: 'Poetry' },
  { value: 'drama',      label: 'Drama' },
  { value: 'shorts',     label: 'Short Stories' },
];

export function BrowseSourceTab({ implementedSources, enqueuedKeys }: Props) {
  const defaultSource = implementedSources.find(s => s.source === 'standard_ebooks')?.source
                     ?? implementedSources[0]?.source
                     ?? '';

  const [selectedSource, setSelectedSource] = useState(defaultSource);
  const [query, setQuery] = useState('');
  const [genre, setGenre] = useState('');
  const [page, setPage] = useState(1);
  const [entries, setEntries] = useState<CatalogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const [enqueueTarget, setEnqueueTarget] = useState<{
    source: string;
    source_id: string;
    title: string;
    author: string;
  } | null>(null);

  const PAGE_SIZE = 24;

  const search = useCallback(async (opts?: { append?: boolean }) => {
    if (!selectedSource) return;
    setLoading(true);
    setError(null);
    try {
      const url = new URL('/api/admin/library/browse-source', window.location.origin);
      url.searchParams.set('source', selectedSource);
      if (query) url.searchParams.set('q', query);
      if (genre) url.searchParams.set('genre', genre);
      url.searchParams.set('limit', String(PAGE_SIZE));
      url.searchParams.set('offset', String((page - 1) * PAGE_SIZE));

      const res = await fetch(url.toString());
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data = await res.json() as { entries: CatalogEntry[]; has_more: boolean };
      setEntries(opts?.append ? [...entries, ...data.entries] : data.entries);
      setHasMore(data.has_more);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'unknown error');
    } finally {
      setLoading(false);
    }
  }, [selectedSource, query, genre, page, entries]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    search({ append: false });
  };

  const handleLoadMore = () => {
    setPage(p => p + 1);
    search({ append: true });
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <header className="rounded-[var(--r-lg)] bg-[var(--bg2)] border border-[var(--bd)] p-4">
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-[var(--r-md)] flex items-center justify-center text-[var(--ti)] flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #8B5CF6, #6D28D9)' }}  /* Admin 액센트 — §15 예외 허용 */
          >
            <Compass size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-[18px] font-[600] text-[var(--t1)]">소스 탐색</h2>
            <p className="font-body text-[13px] text-[var(--t2)] mt-0.5">
              구현된 외부 소스의 카탈로그를 직접 검색하고 큐에 추가합니다.
              검색 결과를 추가하면 기존 큐레이션 파이프라인(S1~S6)이 자동 처리합니다.
            </p>

            {/* 소스 선택 칩 */}
            <div className="flex flex-wrap gap-2 mt-3">
              {implementedSources.map(src => (
                <button
                  key={src.source}
                  type="button"
                  onClick={() => {
                    setSelectedSource(src.source);
                    setPage(1);
                    setEntries([]);
                  }}
                  className={`
                    inline-flex items-center gap-1.5
                    font-body text-[12px] font-[600]
                    px-3 py-1.5 rounded-[var(--r-full)]
                    border transition-colors duration-[var(--dur-normal)]
                    ${selectedSource === src.source
                      ? 'bg-[var(--p)] text-[var(--ti)] border-[var(--p)]'
                      : 'bg-[var(--bg)] text-[var(--t2)] border-[var(--bd)] hover:border-[var(--p)] hover:text-[var(--p)]'}
                  `}
                  aria-pressed={selectedSource === src.source}
                >
                  {src.display_name}
                  <span className="font-mono text-[10px] opacity-75">★{src.composite_score.toFixed(1)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* 검색 폼 */}
      <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[240px] relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--t3)] pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="제목, 저자 검색…"
            className="w-full pl-9 pr-4 py-2.5 font-body text-[14px] text-[var(--t1)]
                       bg-[var(--bg)] border border-[var(--bd)] rounded-[var(--r-md)]
                       placeholder:text-[var(--t3)]
                       focus:outline-none focus:border-[var(--bdf)] focus:ring-2 focus:ring-[var(--p-light)]
                       transition-colors duration-[var(--dur-normal)]"
            aria-label="작품 검색"
          />
        </div>

        <select
          value={genre}
          onChange={e => setGenre(e.target.value)}
          className="font-body text-[13px] text-[var(--t1)]
                     bg-[var(--bg)] border border-[var(--bd)] rounded-[var(--r-md)]
                     px-3 py-2.5 min-h-[44px]
                     focus:outline-none focus:border-[var(--bdf)]"
          aria-label="장르 필터"
        >
          {GENRES.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
        </select>

        <button
          type="submit"
          disabled={loading || !selectedSource}
          className="inline-flex items-center gap-2 font-display text-[13px] font-[600]
                     text-[var(--ti)] bg-[var(--p)]
                     px-5 py-2.5 min-h-[44px] rounded-[var(--r-md)]
                     hover:bg-[var(--p-hover)]
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors duration-[var(--dur-normal)]"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          검색
        </button>
      </form>

      {/* 에러 */}
      {error && (
        <div role="alert" className="rounded-[var(--r-md)] bg-[var(--error-light)] border border-[var(--error)] px-4 py-3">
          <p className="font-body text-[13px] text-[var(--error)]">검색 실패: {error}</p>
        </div>
      )}

      {/* 빈 상태 */}
      {!loading && entries.length === 0 && !error && (
        <div className="rounded-[var(--r-lg)] bg-[var(--bg2)] border border-dashed border-[var(--bd)] p-10 text-center">
          <p className="font-body text-[14px] text-[var(--t2)]">검색어를 입력하고 검색을 누르세요.</p>
        </div>
      )}

      {/* 결과 그리드 */}
      {entries.length > 0 && (
        <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {entries.map(entry => {
            const key = `${selectedSource}:${entry.source_id}`;
            const isEnqueued = enqueuedKeys.has(key);
            return (
              <li key={key}
                  className="rounded-[var(--r-lg)] bg-[var(--bg)] border border-[var(--bd)]
                             p-4 flex flex-col gap-3
                             hover:border-[var(--p)] hover:shadow-[var(--sh-sm)]
                             transition-all duration-[var(--dur-normal)]">
                <div className="flex gap-3">
                  <div className="w-16 h-24 flex-shrink-0 rounded-[var(--r-sm)] overflow-hidden bg-[var(--bg3)]">
                    {entry.cover_url
                      ? <img src={entry.cover_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                      : <div className="w-full h-full flex items-center justify-center">
                          <span className="font-english text-[10px] text-[var(--t3)]">no cover</span>
                        </div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-english text-[15px] font-[600] text-[var(--t1)] line-clamp-2 leading-tight" title={entry.title}>
                      {entry.title}
                    </h3>
                    <p className="font-english text-[12px] text-[var(--t2)] mt-1 line-clamp-1">{entry.author}</p>
                    {entry.published_year && (
                      <p className="font-body text-[11px] text-[var(--t3)] mt-1">
                        {entry.published_year}
                        {entry.word_count_estimate ? ` · ${entry.word_count_estimate.toLocaleString()} 단어` : ''}
                      </p>
                    )}
                  </div>
                </div>

                {entry.genres && entry.genres.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {entry.genres.slice(0, 3).map(g => (
                      <span key={g} className="inline-flex items-center font-body text-[10px] font-[500]
                                               bg-[var(--bg3)] text-[var(--t2)]
                                               px-2 py-0.5 rounded-[var(--r-full)]">{g}</span>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between mt-auto pt-2 border-t border-[var(--bd)]">
                  {/* 원본 링크 — SE 전용 host. 다른 소스 추가 시 helper 로 분리 */}
                  
                     href={selectedSource === 'standard_ebooks'
                            ? `https://standardebooks.org/ebooks/${entry.source_id}`
                            : '#'}
                     target="_blank"
                     rel="noopener noreferrer"
                     className="inline-flex items-center gap-1 font-body text-[11px] text-[var(--t3)]
                                hover:text-[var(--p)] transition-colors duration-[var(--dur-normal)]"
                     aria-label="원본 페이지 열기">
                    원본 <ExternalLink size={11} />
                  </a>

                  <button
                    type="button"
                    onClick={() => setEnqueueTarget({
                      source: selectedSource,
                      source_id: entry.source_id,
                      title: entry.title,
                      author: entry.author,
                    })}
                    disabled={isEnqueued}
                    className={`inline-flex items-center gap-1 font-display text-[12px] font-[600]
                                px-3 py-1.5 min-h-[36px] rounded-[var(--r-md)]
                                transition-colors duration-[var(--dur-normal)]
                                ${isEnqueued
                                  ? 'bg-[var(--bg3)] text-[var(--t3)] cursor-not-allowed'
                                  : 'bg-[var(--p)] text-[var(--ti)] hover:bg-[var(--p-hover)]'}`}
                    aria-label={isEnqueued ? '이미 큐에 추가됨' : '큐에 추가'}
                  >
                    <Plus size={12} />
                    {isEnqueued ? '추가됨' : '큐 추가'}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {hasMore && !loading && (
        <div className="flex justify-center pt-2">
          <button type="button" onClick={handleLoadMore}
                  className="font-body text-[13px] font-[600] text-[var(--p)]
                             px-5 py-2.5 min-h-[44px] rounded-[var(--r-md)]
                             border border-[var(--bd)] hover:bg-[var(--p-light)] hover:border-[var(--p)]
                             transition-colors duration-[var(--dur-normal)]">
            더 불러오기
          </button>
        </div>
      )}

      {loading && entries.length > 0 && (
        <div className="flex justify-center py-4">
          <Loader2 size={20} className="animate-spin text-[var(--t3)]" />
        </div>
      )}

      {/* EnqueueModal 재사용 — §18.11 — 실제 props 시그니처는 EnqueueModal.tsx 확인 후 정합 */}
      {enqueueTarget && (
        <EnqueueModal
          isOpen={true}
          source={enqueueTarget.source}
          source_id={enqueueTarget.source_id}
          title={enqueueTarget.title}
          author={enqueueTarget.author}
          onClose={() => setEnqueueTarget(null)}
          onSuccess={() => setEnqueueTarget(null)}
        />
      )}
    </div>
  );
}
```

### C.4 API Route — `/api/admin/library/browse-source/route.ts`

```typescript
// apps/web/src/app/api/admin/library/browse-source/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/auth/require-admin-api';
import { searchStandardEbooksCatalog } from '@vocaflow/library-pipeline';

export const runtime = 'nodejs';
export const revalidate = 3600;

export async function GET(req: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const source = url.searchParams.get('source');
  const query  = url.searchParams.get('q')      ?? undefined;
  const genre  = url.searchParams.get('genre')  ?? undefined;
  const limit  = Math.min(50, Number(url.searchParams.get('limit')  ?? 24));
  const offset = Math.max(0,  Number(url.searchParams.get('offset') ?? 0));

  try {
    let result: { entries: unknown[]; has_more: boolean };

    if (source === 'standard_ebooks') {
      result = await searchStandardEbooksCatalog({ query, genre, limit: limit + 1, offset });
      // limit+1 로 has_more 판단
      const hasMore = result.entries.length > limit;
      const trimmed = hasMore ? result.entries.slice(0, limit) : result.entries;
      return NextResponse.json(
        { entries: trimmed, has_more: hasMore, offset, limit },
        { headers: { 'Cache-Control': 's-maxage=3600, stale-while-revalidate=600' } },
      );
    }

    // 다른 소스 (gutenberg 등) 추후 추가
    return NextResponse.json({ error: `Source not browsable: ${source}` }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'unknown' }, { status: 502 });
  }
}
```

### C.5 page.tsx 패치 + `library-queries.ts` 헬퍼

```typescript
// apps/web/src/lib/admin/library-queries.ts (함수 2개 추가)

export async function getImplementedSources() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('library_source_catalogs')
    .select('source, display_name, composite_score')   // ★ 실제 컬럼명
    .eq('is_implemented', true)
    .eq('is_enabled', true)
    .order('composite_score', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getEnqueuedKeys() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('library_books')
    .select('source, source_id')
    .neq('status', 'archived');   // archived 는 재추가 허용
  if (error) throw error;
  return data ?? [];
}
```

```tsx
// apps/web/src/app/admin/curation/page.tsx (병렬 fetch 에 추가)

const [
  /* 기존 fetches */,
  implementedSources,
  enqueuedRows,
] = await Promise.all([
  /* ... */,
  getImplementedSources(),
  getEnqueuedKeys(),
]);

const enqueuedKeys = new Set(enqueuedRows.map(r => `${r.source}:${r.source_id}`));

// AdminCurationClient 에 prop 전달
```

### C.6 체크리스트

- [ ] `BrowseSourceTab.tsx` 위 코드 그대로 (컬럼명 `source` / `display_name` / `composite_score` 정합)
- [ ] `AdminCurationClient.tsx` TABS 배열에 `browse` 3번째 위치 삽입
- [ ] `page.tsx` 병렬 fetch 2건 추가
- [ ] `library-queries.ts` 헬퍼 2개 추가
- [ ] `/api/admin/library/browse-source/route.ts` 신규 (`requireAdminApi()` 가드)
- [ ] `EnqueueModal` 실제 props 시그니처 확인 후 위 호출부 정합 (`isOpen`/`onSuccess` 등 props 이름이 다를 수 있음)
- [ ] 다크모드 시각 확인
- [ ] WCAG AA — 인터랙티브 ≥ 44×44, aria-label, focus visible
- [ ] grep 0건: `--bg1` / `--info-bg` / `--warn-bg` / `font-serif` / `'standard-ebooks'` (enum 비교용 hyphen)

---

## 통합 E2E 검증

1. **enqueue**: BrowseSourceTab → "큐 추가" → EnqueueModal 확인 → `library_books` row 생성 (status='queued')
2. **dispatch**: pgmq 워커 30초 polling → `route.ts:92` switch → `ingestFromStandardEbooks` 호출 → S2~S6 자동
3. **publish**: 최종 `status='published'` 도달, Tab 5 Curated Books 에 노출
4. **중복 방지**: 같은 작품 다시 "큐 추가" 시도 → `enqueuedKeys` 가 `disabled` 처리

---

## CLAUDE.md 업데이트 (구현 완료 후 append-only)

- §18.10 미정 항목: "Standard Ebooks fetcher" 행 → "✅ v06.X 완료" 로 변경
- §18.11 4탭 구조 표 → 5탭 구조로 갱신 (3번째 위치에 `BrowseSourceTab` 추가)
- 변경 이력 v06.X 항목 prepend: Phase 13 SE fetcher dispatch 연결 + BrowseSourceTab 신설

---

## 12건 정정 매핑 (이전 폐기본 → 본 정합본)

| # | 항목 | 폐기본 가정 | 실측 정합 |
|---|---|---|---|
| 1 | enum 표기 | `'standard-ebooks'` (hyphen) | **`'standard_ebooks'` (underscore)** |
| 2 | 라우트 신설 | `/admin/library/standard-ebooks` | `/admin/curation` 5번째 탭 |
| 3 | 신규 테이블 | `standard_ebooks_catalog` | 없음 (`library_source_catalogs` 사용) |
| 4 | status enum 신설 | 자체 5단계 | 없음 (`library_books.status` 7단계 사용) |
| 5 | `texts.is_published` 컬럼 | 신설 | 없음 (`library_books.status='published'` 사용) |
| 6 | catalog 컬럼명 `slug` | — | **`source`** (PK는 별도 `id` UUID) |
| 7 | catalog 컬럼명 `name` | — | **`display_name`** |
| 8 | catalog 컬럼명 `rating_*` 6종 | — | **`quality_*`** 6종 (다른 이름) + `composite_score` (트리거 자동) |
| 9 | catalog 컬럼명 `fetcher_module` | 신설 가정 | **존재하지 않음 — route.ts switch 사용** |
| 10 | catalog 컬럼명 `catalog_endpoint` | — | **`api_endpoint`** |
| 11 | catalog 컬럼명 `url` | — | **`documentation_url`** + **`catalog_url`** (2개 분리) |
| 12 | Fetcher 함수명 | `ingestStandardEbooksBook` | **`ingestFromStandardEbooks`** (Gutenberg와 동일 컨벤션) |

추가 BLOCKER 해소:
- `route.ts:90-96` switch 확장 — SE enqueue 시 silent failure (`Source not implemented` throw) 방지

CSS 토큰 정합 (위반 0건):
- `--bg1`, `--info-bg`, `--warn-bg`, `--focus-ring`, `font-serif` 모두 미사용
- 사용 토큰: `--bg/bg2/bg3`, `--t1~t3`, `--ti`, `--bd`, `--bdf`, `--p/p-hover/p-light`, `--error/error-light`, `--r-sm/md/lg/full`, `--sh-sm`, `--dur-normal`, `font-display`, `font-body`, `font-english`, `font-mono`
- Admin 보라 (#8B5CF6 → #6D28D9) 인라인 style 1곳, §15 예외 주석 포함

---

## 정정 패치 v3 — 핸드오프 직전 자가 점검 결과 (3건 추가 충돌)

직전 실측으로 본문 작업 C 의 일부 가정이 어긋남 확인. 본 패치를 작업 C 의 **우선 적용 정정** 으로 처리.

### P1. `EnqueueModal` props 시그니처 (실측)

```typescript
// apps/web/src/components/admin/curation/EnqueueModal.tsx:18~28
interface EnqueueModalProps {
  source: EnqueueSource | null;          // ★ 단일 prop 으로 전체 객체
  onClose: () => void;
  onSuccess: (bookId: string) => void;   // ★ bookId 인자 받음
}
export function EnqueueModal({ source, onClose, onSuccess }: EnqueueModalProps)

// EnqueueSource shape (line 177~183):
type EnqueueSource = {
  source: string;
  source_id: string;
  title: string;
  author: string | null;
  author_birth_year: number | null;
  author_death_year: number | null;
  license: string;
}
```

**`isOpen` prop 없음** — 부모가 `source !== null` 로 mount/unmount 제어.

본문 C.3 의 modal 호출부 교체:

```tsx
// ❌ 본문 코드 (잘못)
{enqueueTarget && (
  <EnqueueModal
    isOpen={true}
    source={enqueueTarget.source}
    source_id={enqueueTarget.source_id}
    title={enqueueTarget.title}
    author={enqueueTarget.author}
    onClose={() => setEnqueueTarget(null)}
    onSuccess={() => setEnqueueTarget(null)}
  />
)}

// ✅ 정정
<EnqueueModal
  source={enqueueSource}   // EnqueueSource | null
  onClose={() => setEnqueueSource(null)}
  onSuccess={(_bookId) => {
    setEnqueueSource(null);
    // router.refresh() 로 enqueuedKeys 갱신 (부모에서)
  }}
/>
```

state 타입도 정정:
```tsx
const [enqueueSource, setEnqueueSource] = useState<EnqueueSource | null>(null);

// 버튼 클릭 시 — author_birth_year/death_year/license 는 OPDS catalog 에 없으면 null 전달
onClick={() => setEnqueueSource({
  source: selectedSource,
  source_id: entry.source_id,
  title: entry.title,
  author: entry.author,
  author_birth_year: null,
  author_death_year: null,
  license: selectedSource === 'standard_ebooks' ? 'CC0' : 'unknown',
})}
```

### P2. `AdminCurationClient.tsx` TABS 실제 구조 (실측)

```typescript
// apps/web/src/app/admin/curation/AdminCurationClient.tsx:25
type TabKey = 'sources' | 'seed' | 'id' | 'mine';   // ★ 4 keys, 본문 가정과 다름

// line 158
const TABS: Array<{ key: TabKey; label: string; Icon: typeof BookOpen }> = [
  // 4개 항목 — key 가 'seed'(단수), 'id'(짧음), 'mine' 임
];
```

본문 C.2 의 5탭 정의 교체:

```typescript
// ❌ 본문 (잘못)
const TABS = [
  { id: 'sources', ..., icon: Library },
  { id: 'seeds', ..., icon: Sparkles },
  { id: 'browse', ..., icon: Compass },       // 신규
  { id: 'gutenberg-id', ..., icon: Hash },
  { id: 'curated', ..., icon: BookOpenCheck },
];

// ✅ 정정 (기존 4 key 유지 + 'browse' 만 3번째 삽입)
type TabKey = 'sources' | 'seed' | 'browse' | 'id' | 'mine';

const TABS: Array<{ key: TabKey; label: string; Icon: typeof BookOpen }> = [
  { key: 'sources', label: '소스 카탈로그', Icon: Library },
  { key: 'seed',    label: '추천 시드',     Icon: Sparkles },
  { key: 'browse',  label: '소스 탐색',     Icon: Compass },      // ★ 신규
  { key: 'id',      label: 'ID 직접 입력',  Icon: Hash },
  { key: 'mine',    label: 'Curated Books', Icon: BookOpenCheck },
];
```

**실측 확정 정정** (line 158~163):

```typescript
// 실제 (line 8 import + line 158~163)
import { BookOpen, FolderOpen, Hash, Library } from 'lucide-react';

type TabKey = 'sources' | 'seed' | 'id' | 'mine';   // 기존 4 key

const TABS: Array<{ key: TabKey; label: string; Icon: typeof BookOpen }> = [
  { key: 'sources', label: '소스 카탈로그', Icon: Library },
  { key: 'seed',    label: '추천 시드',     Icon: BookOpen },     // ★ Sparkles 아님
  { key: 'id',      label: 'ID 직접 입력',  Icon: Hash },
  { key: 'mine',    label: 'Curated Books', Icon: FolderOpen },   // ★ BookOpenCheck 아님
];

// ✅ v3 최종 정정 (5탭 — 'browse' 3번째 삽입, Compass 신규 import)
import { BookOpen, Compass, FolderOpen, Hash, Library } from 'lucide-react';

type TabKey = 'sources' | 'seed' | 'browse' | 'id' | 'mine';

const TABS: Array<{ key: TabKey; label: string; Icon: typeof BookOpen }> = [
  { key: 'sources', label: '소스 카탈로그', Icon: Library },
  { key: 'seed',    label: '추천 시드',     Icon: BookOpen },
  { key: 'browse',  label: '소스 탐색',     Icon: Compass },        // ★ 신규
  { key: 'id',      label: 'ID 직접 입력',  Icon: Hash },
  { key: 'mine',    label: 'Curated Books', Icon: FolderOpen },
];
```

추가 변경 (line 14~17 부근 import + 라우팅 영역):
```typescript
// 신규 탭 컴포넌트 import 추가
import { BrowseSourceTab } from '@/components/admin/curation/BrowseSourceTab';

// 탭 컨텐츠 render switch 에 case 추가:
// {tab === 'browse' && <BrowseSourceTab implementedSources={...} enqueuedKeys={...} />}
```

**`stats.total` 뱃지 패턴**: line 173 `key === 'mine' && stats.total > 0` 처럼 'mine' 탭에만 뱃지가 있음. 'browse' 탭은 뱃지 없음 (검색 결과는 동적이라 의미 없음) — 추가 분기 불필요.

### P3. admin queries 파일 경로 (실측)

```
❌ 본문 가정: apps/web/src/lib/admin/library-queries.ts (파일 자체 없음)
✅ 실제 위치: apps/web/src/lib/library/admin-queries.ts
```

이미 등재된 함수:
```typescript
// apps/web/src/lib/library/admin-queries.ts
import type { SupabaseClient } from '@supabase/supabase-js'
type AdminClient = SupabaseClient   // ★ DI 패턴 — caller 가 client 주입

export async function listSourceCatalogs(client: AdminClient, ...)   // ★ 이미 존재
export async function listAllAdminBooks(client: AdminClient, ...)
export async function getCurationStats(client: AdminClient, ...)
export async function enqueueBookViaRpc(client: AdminClient, ...)
export async function requeueBook(client: AdminClient, ...)
export async function forcePublishBook(client: AdminClient, ...)
export async function archiveBook(client: AdminClient, ...)
```

본문 C.5 의 헬퍼 정의 교체:

```typescript
// ❌ 본문 (잘못)
export async function getImplementedSources() {
  const supabase = await createServerSupabaseClient();   // 직접 client 생성
  ...
}

// ✅ 정정 (DI 패턴 + 기존 listSourceCatalogs 재사용 가능성 검토)
export async function getImplementedSources(client: AdminClient) {
  const { data, error } = await client
    .from('library_source_catalogs')
    .select('source, display_name, composite_score')
    .eq('is_implemented', true)
    .eq('is_enabled', true)
    .order('composite_score', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getEnqueuedKeys(client: AdminClient) {
  const { data, error } = await client
    .from('library_books')
    .select('source, source_id')
    .neq('status', 'archived');
  if (error) throw error;
  return data ?? [];
}
```

`page.tsx` 호출부:
```tsx
// ❌ 본문
const [..., implementedSources, enqueuedRows] = await Promise.all([
  /* ... */,
  getImplementedSources(),
  getEnqueuedKeys(),
]);

// ✅ 정정 (client 주입)
import { createClient } from '@/lib/supabase/server';
const client = await createClient();
const [..., implementedSources, enqueuedRows] = await Promise.all([
  /* ... */,
  getImplementedSources(client),
  getEnqueuedKeys(client),
]);
```

**대안 검토**: `listSourceCatalogs` 가 이미 존재 — 시그니처 확인 후 `is_implemented=true` 필터 옵션 만 추가하면 `getImplementedSources` 신설 불필요. 구현자 판단:
```bash
grep -A 15 "export async function listSourceCatalogs" \
  apps/web/src/lib/library/admin-queries.ts
```

### P4. Fetcher exports 확인 (변경 불필요)

```typescript
// 실측
export async function ingestFromStandardEbooks(sourceId: string): Promise<RawBook>
```

본문 작업 A 계획과 일치. `searchStandardEbooksCatalog()` 신규 추가는 그대로 진행.

### v3 정정 체크리스트

작업 C 진입 전 다음 4건 정정:
- [ ] `BrowseSourceTab.tsx` 의 EnqueueModal 호출부 → P1 정합
- [ ] `BrowseSourceTab.tsx` state `enqueueTarget` → `enqueueSource: EnqueueSource | null` 로 변경
- [ ] `AdminCurationClient.tsx` TABS → P2 정합 (`key`/`Icon` + 4 key 유지 + 'browse' 3번째)
- [ ] `admin-queries.ts` (위치: `lib/library/`) 에 `getImplementedSources(client)` + `getEnqueuedKeys(client)` 추가 또는 `listSourceCatalogs` 옵션 확장
- [ ] `page.tsx` 에서 `createClient()` 호출 후 client 주입 패턴

### 핸드오프 영향

- 작업 A: **변경 없음** (route.ts switch + searchStandardEbooksCatalog 추가, fetcher 시그니처 확인됨)
- 작업 B: **변경 없음** (UPDATE 1줄)
- 작업 C: P1·P2·P3 정정 반영 — 코드 ~30줄 차이, 전체 구조는 동일

---

## 핸드오프 직후 모니터링 3시점

### 시점 1 — 작업 A.1 직후 (가장 위험한 1줄)

```bash
grep -A 2 "case 'standard_ebooks'\|standard_ebooks.*ingest" \
  apps/web/src/app/api/lcp/process/route.ts
```

`ingestFromStandardEbooks(book.source_id)` 호출 + `break` (또는 if-else 일관 구조) 확인.
**누락 시 enqueue 가 published 까지 안 감 — silent failure.**

### 시점 2 — 작업 B 마이그레이션 적용 직후

```sql
SELECT source, display_name, is_implemented,
       (SELECT count(*) FROM information_schema.columns
        WHERE table_name = 'library_source_catalogs'
          AND column_name = 'fetcher_module') AS fetcher_col_exists  -- 0 이어야 정상
FROM library_source_catalogs
WHERE source = 'standard_ebooks';
```

- `is_implemented = true` 확인
- `fetcher_col_exists = 0` 확인 (실측대로 컬럼 없음)
- 다른 row 영향 0건 (WHERE 절 정확성)

### 시점 3 — 작업 C 완료 후 E2E

1. `/admin/curation` 진입, Tab 3 "소스 탐색" 클릭
2. SE 칩 default 선택 확인 (composite_score 1위)
3. "Pride" 입력 → 검색 → Jane Austen 결과
4. 큐 추가 → EnqueueModal → 확인
5. 30초 대기 후:

```sql
SELECT source, source_id, status, updated_at
FROM library_books
WHERE source = 'standard_ebooks'
ORDER BY created_at DESC LIMIT 3;
```

`status` 가 `queued → processing → ready/analyzed` 진행이면 워커 dispatch 정합 완성.
`queued` 에서 멈춤이면 시점 1 의 switch case 의심.

