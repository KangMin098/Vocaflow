// apps/web/src/app/api/__tests__/route-callers.test.ts
//
// **아무도 부르지 않는 API 라우트는 조용히 썩는다.**
//
// 라우트는 파일이 있는 것만으로 빌드에 들어가고 타입도 통과한다. 그래서 화면에서 버튼이
// 사라져도 라우트는 남고, 남은 채로 리팩터링·의존성 갱신·보안 감사의 대상이 된다.
// 2026-09-06 실측: 라우트 80개 중 11개가 코드 어디에서도 참조되지 않았고, 그중 5개는
// 후속 라우트가 이미 같은 일을 하고 있는 **중복**이었다(자세한 판정은 CHANGELOG).
//
// 이 테스트가 고정하는 것:
//   `src/app/api/**/route.ts` 하나하나가 `apps/web/src` 또는 `scripts/` 에서
//   **실제로 참조되는지** 보고, 참조가 없으면 아래 EXTERNAL 목록에 이유와 함께 있어야 통과.
//
// 참조로 인정하는 두 가지 (둘 다 주석을 걷어낸 소스에서만 — 주석 속 언급은 호출부가 아니다):
//   ① 리터럴          `fetch('/api/acp/enqueue')`
//   ② 템플릿 조립 + 값 `fetch(`/api/admin/articles/${source}-feed`)` 이고
//                      `${source}` 자리에 들어갈 `'nasa'` 가 코드에 문자열로 있을 때
//
// ②에 값 확인까지 요구하는 이유: 템플릿 모양만 보면 `futurity-feed` 도 "호출됨" 으로
// 세어진다. 실제로는 어느 소스 목록에도 `futurity` 가 없어 그 URL 은 만들어지지 않는다.
// 모양이 아니라 **그 값이 코드에 존재하는지**를 봐야 이 구멍이 닫힌다.
//
// ⚠️ EXTERNAL 이 길어지면 커버리지가 아니라 **면제**가 자라는 것이다. 한 줄 더하기 전에
//    "정말 외부에서만 불리나, 아니면 그냥 죽은 것인가" 를 먼저 답할 것. 지금은 8개다.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'

import { describe, expect, it } from 'vitest'

const WEB_SRC = join(process.cwd(), 'src')
const API_DIR = join(WEB_SRC, 'app', 'api')
const SCRIPTS_DIR = resolve(process.cwd(), '..', '..', 'scripts')

/**
 * 코드에 호출부가 없는 것이 **정상**인 라우트 — 이유를 여기 적어야 통과한다.
 * 키는 `src/app/api/` 기준 상대 경로(디렉터리), POSIX 구분자.
 */
const EXTERNAL: ReadonlyArray<{ route: string; why: string }> = [
  {
    route: 'auth/callback',
    why: 'Supabase OAuth 콜백 — 리다이렉트 URL 을 Supabase 대시보드가 들고 있다. 코드가 fetch 할 대상이 아니다',
  },
  {
    route: 'lcp/process',
    why: 'pg_cron 워커가 X-LCP-Token 으로 부른다 (process_library_pipeline_batch). 앱 코드에는 호출부가 없는 것이 정상',
  },
  {
    route: 'admin/articles/futurity-feed',
    why:
      '**미배선** — ingester·SOURCE_SPECS·정책·테스트는 packages/library-pipeline 에 다 있는데 ' +
      'BulkArticlesTab 의 SOURCES 와 RssFeedTab 의 source 유니온에만 futurity 가 빠져 있다. ' +
      '죽은 것이 아니라 배선이 덜 된 것이라 지우지 않았다 — 한 줄 더하면 다른 13개 *-feed 와 똑같이 산다',
  },
  {
    route: 'acp/dev-enqueue',
    why:
      'curl 로 부르는 dev 도구 (docs/CONTENT_QUALITY_GATE.md §4 절차). 정규 경로 /api/acp/enqueue 는 ' +
      'RLS 클라이언트 + admin_enqueue_article RPC 라 DEV_ADMIN_BYPASS=1 (auth.uid()=NULL) 에서 Forbidden — ' +
      '이 라우트가 그 갭을 메운다. 대체 경로 없음',
  },
  {
    route: 'lcp/dev-enqueue-book',
    why:
      'acp/dev-enqueue 의 도서판. UI 경로(EnqueueModal → 브라우저 RLS 로 admin_enqueue_book) 가 ' +
      'DEV_ADMIN_BYPASS 에서 Forbidden 이라 대체되지 않는다',
  },
  {
    route: 'lcp/dev-ingest-preview',
    why:
      '신설 book ingester 를 DB 적재 전에 눈으로 확인하는 read-only 도구 (write 0 · 프로덕션 403). ' +
      '다음 ingester 를 붙일 때 다시 쓴다',
  },
  {
    route: 'admin/library/backfill-covers',
    why:
      '기존 도서 표지 일괄 백필 (재실행 안전) — docs/LIBRARY_PIPELINE.md 와 ' +
      'docs/AI_CONTEXT/project/project_book_cover_images.md 가 운영 경로로 안내한다. ' +
      'dev-process 의 도서별 자동 해결은 "이미 적재된 401권" 을 훑지 못해 대체가 아니다',
  },
  {
    route: 'pdcp/issue',
    why:
      '버튼 없는 운영 경로 — lib/admin/help/pd-comics.ts 가 "DELETE /api/pdcp/issue?id=<uuid>" 를 ' +
      '관리자에게 직접 안내한다 (발행본은 409). scripts/comic/docs/PD_MODERNIZE_MODEL.md 는 PATCH 되돌리기를 안내',
  },
]

const EXTERNAL_ROUTES = new Set(EXTERNAL.map((e) => e.route))

const CODE_EXT = /\.(ts|tsx|js|jsx|mjs|mts|cjs)$/
const SKIP_DIR = new Set(['node_modules', '.next', 'dist', 'build', '.turbo'])

function collectFiles(dir: string, match: RegExp, out: string[] = []): string[] {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const entry of entries) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (SKIP_DIR.has(entry)) continue
      collectFiles(full, match, out)
    } else if (match.test(entry)) {
      out.push(full)
    }
  }
  return out
}

/** 주석 제거 — 주석 속 경로 언급이 "호출부" 로 세어지면 이 테스트는 아무것도 지키지 않는다. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

const ROUTE_FILES = collectFiles(API_DIR, /^route\.tsx?$/).map((f) =>
  relative(API_DIR, f).split(sep).join('/'),
)
const ROUTE_KEYS = ROUTE_FILES.map((f) => f.replace(/\/route\.tsx?$/, '')).sort()

/** 라우트 자신의 파일은 corpus 에서 뺀다 (헤더 주석의 자기 경로는 호출부가 아니다). */
const OWN_ROUTE_FILES = new Set(
  collectFiles(API_DIR, /^route\.tsx?$/).map((f) => f.split(sep).join('/')),
)

const CORPUS: string[] = [
  ...collectFiles(WEB_SRC, CODE_EXT),
  ...collectFiles(SCRIPTS_DIR, CODE_EXT),
]
  .filter((f) => !OWN_ROUTE_FILES.has(f.split(sep).join('/')))
  .map((f) => stripComments(readFileSync(f, 'utf8')))

const CORPUS_TEXT = CORPUS.join('\n')

/** corpus 안의 모든 `/api/...` 리터럴·템플릿 조각. */
const API_STRINGS: string[] = Array.from(
  CORPUS_TEXT.matchAll(/['"`](\/api\/[^'"`\s]*)['"`]?/g),
  (m) => m[1] ?? '',
)

/** 따옴표로 감싼 문자열 값 전부 — 템플릿 변수 자리에 실제로 그 값이 있는지 확인하는 데 쓴다. */
const QUOTED_VALUES = new Set(
  Array.from(CORPUS_TEXT.matchAll(/['"`]([A-Za-z0-9_.-]+)['"`]/g), (m) => m[1] ?? ''),
)

/** `/api/x/${v}-feed?feed=..` → `^/api/x/(...)-feed` 정규식 (쿼리·해시는 잘라낸다). */
function templateToRegExp(s: string): RegExp | null {
  if (!s.includes('${')) return null
  const path = s.split('?')[0]!.split('#')[0]!
  const parts = path.split(/\$\{[^}]*\}/)
  const escaped = parts.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  return new RegExp(`^${escaped.join('([^/]+)')}$`)
}

const TEMPLATE_PATTERNS = API_STRINGS.map(templateToRegExp).filter(
  (r): r is RegExp => r !== null,
)

/** 리터럴 경로 (쿼리 제거) 집합 — `/api/acp/enqueue` 같은 것. */
const LITERAL_PATHS = new Set(
  API_STRINGS.filter((s) => !s.includes('${')).map(
    (s) => s.split('?')[0]!.split('#')[0]!.replace(/\/+$/, ''),
  ),
)

type Verdict = { referenced: boolean; how: string }

function verdictFor(key: string): Verdict {
  const url = `/api/${key}`

  // ① 리터럴 — 정확 일치 또는 하위 경로(`/api/pdcp/artifact` vs `/api/pdcp/artifact/x`).
  for (const lit of LITERAL_PATHS) {
    if (lit === url || lit.startsWith(`${url}/`)) return { referenced: true, how: `리터럴 ${lit}` }
  }

  // ② 템플릿 조립 — 모양이 맞고, 변수 자리에 들어갈 값이 코드에 문자열로 존재할 때만.
  for (const re of TEMPLATE_PATTERNS) {
    const m = re.exec(url)
    if (!m) continue
    const holes = m.slice(1)
    const allResolvable = holes.every(
      // Next 동적 세그먼트(`[id]`)는 런타임 값이라 확인 대상이 아니다.
      (h) => /^\[.+\]$/.test(h) || QUOTED_VALUES.has(h),
    )
    if (allResolvable) {
      return { referenced: true, how: `템플릿 ${re.source} (값 ${holes.join(',') || '-'})` }
    }
  }

  return { referenced: false, how: '' }
}

describe('API 라우트 호출부', () => {
  it('스캐너가 라우트와 corpus 를 실제로 찾았다 (빈손이면 아무것도 지키지 않는다)', () => {
    expect(ROUTE_KEYS.length).toBeGreaterThan(50)
    expect(CORPUS.length).toBeGreaterThan(300)
    expect(API_STRINGS.length).toBeGreaterThan(50)
  })

  it('모든 라우트는 코드에서 참조되거나 EXTERNAL 에 이유와 함께 등록돼 있다', () => {
    const orphans = ROUTE_KEYS.filter(
      (key) => !EXTERNAL_ROUTES.has(key) && !verdictFor(key).referenced,
    )

    expect(
      orphans,
      `아무도 부르지 않는 라우트다. 호출부를 붙이거나, 지우거나, 외부에서만 불린다면\n` +
        `EXTERNAL 에 **왜 예외인지** 적을 것:\n  ${orphans.join('\n  ')}`,
    ).toEqual([])
  })

  it('EXTERNAL 은 실재하는 라우트만 가리킨다 (낡은 예외는 조용히 구멍을 남긴다)', () => {
    const keys = new Set(ROUTE_KEYS)
    const stale = EXTERNAL.map((e) => e.route).filter((r) => !keys.has(r))
    expect(stale, `EXTERNAL 에 있으나 파일이 없다 — 지울 것:\n  ${stale.join('\n  ')}`).toEqual([])
  })

  it('EXTERNAL 의 모든 항목에 이유가 적혀 있다', () => {
    const missing = EXTERNAL.filter((e) => e.why.trim().length < 20).map((e) => e.route)
    expect(missing).toEqual([])
  })

  it('EXTERNAL 이 라우트의 15% 를 넘지 않는다 (면제가 커버리지를 대신하지 않도록)', () => {
    const ratio = EXTERNAL.length / ROUTE_KEYS.length
    expect(
      ratio,
      `면제 ${EXTERNAL.length}/${ROUTE_KEYS.length} — 예외가 늘고 있다. 지울 것이 섞여 있지 않은지 볼 것.`,
    ).toBeLessThanOrEqual(0.15)
  })
})
