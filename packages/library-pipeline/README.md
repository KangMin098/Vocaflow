# @vocaflow/library-pipeline

LCP v2.0 — Library Curation Pipeline.

Public domain·CC0·CC-BY-SA 콘텐츠를 자동으로 가져와 chapter 단위로 분할·분석·게시하는 admin 큐레이션 파이프라인.

## Stages (S1 ~ S6)

| Stage | 책임 | 위치 |
|---|---|---|
| S1 SOURCE | License 매트릭스 (Gutenberg PD-WW · Standard Ebooks CC0 · Wikisource CC-BY-SA) | `src/types.ts` |
| S2 INGEST | 외부 소스에서 raw 본문 + 메타 fetch | `src/ingest/` (Phase 4) |
| S3 NORMALIZE | boilerplate 제거 + smart quote/dash 통일 + reflow | `src/normalize/` (Phase 5) |
| S4 SEGMENT | chapter 분할 + paragraph/sentence offset 사전 계산 | `src/segment/` (Phase 5) |
| S5 ANALYZE | book-level WLP + LV Score + CEFR 3중 합의 | `src/analyze/` (Phase 6) |
| S6 CURATE | auto_curate_book SQL 함수 (auto_publish / admin_review / reject) | `supabase/migrations/...` |

## 사용

```ts
import { ingestFromGutenberg, normalizeBook, segmentBook, analyzeBook } from '@vocaflow/library-pipeline'

const raw = await ingestFromGutenberg('1661')
const norm = normalizeBook(raw)
const chapters = segmentBook(norm)
const analyzed = await analyzeBook(bookId, norm, chapters)
```

## 환경변수

`SUPABASE_URL` (또는 `NEXT_PUBLIC_SUPABASE_URL`) · `SUPABASE_SERVICE_ROLE_KEY` · `OPENAI_API_KEY`

`loadEnv()` 가 zod 로 검증.

## 책임 분리

이 패키지는 admin 큐레이션 배치 (CLI / Edge Function / Vercel API Route) 에서만 사용. apps/web 의 사용자 측 코드는 `apps/web/src/lib/library/` 의 클라이언트 헬퍼만 사용.
