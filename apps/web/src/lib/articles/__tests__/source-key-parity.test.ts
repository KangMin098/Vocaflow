// apps/web/src/lib/articles/__tests__/source-key-parity.test.ts
//
// **기사 소스 목록이 두 곳에 있고, 두 곳이 갈라졌다.**
//
// ── 왜 (실측 2026-08-23) ────────────────────────────────────────────────
// 정본은 `packages/library-pipeline` 의 `SourceKey` 다. 앱에는 그 **사본**인
// `apps/web/src/lib/acp/seed-upsert.ts` 의 `SeedSource` 가 따로 있다.
//
// 2026-08-21 커밋 `fe252c99` 가 정본에만 `futurity` 를 넣었고 사본이 안 따라왔다.
// 결과는 **브랜치의 `next build` 가 깨진 채로 남은 것**이다 — 이틀 동안.
// 그 사이 모든 화면 스윕은 dev 서버 위에서 돌았고(라우트마다 첫 방문 컴파일),
// 스윕이 실행마다 흔들리는 원인이 됐다. 타입 하나가 계측 전체를 흔든 셈이다.
//
// 사본을 지우는 게 정답이지만 그건 별도 작업이다. 그때까지는 **갈라지는 순간**
// 잡는다 — `tsc` 도 잡긴 하지만 "어디를 어떻게 맞춰야 하는지" 는 말해 주지 않는다.
//
// ⚠️ 두 목록은 소스로 읽는다. 손으로 적으면 이 테스트가 세 번째 사본이 된다.

import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const APP = path.resolve(__dirname, '../../..')
const PKG = path.resolve(APP, '../../../packages/library-pipeline/src')

/** `export type X =` 뒤에 이어지는 `| 'value'` 들을 모은다. */
function unionMembers(src: string, typeName: string): string[] {
  const at = src.indexOf(`export type ${typeName} =`)
  if (at < 0) return []
  // 다음 `export` 나 빈 줄 뒤의 선언까지가 이 유니언의 범위다.
  const rest = src.slice(at + `export type ${typeName} =`.length)
  const end = rest.search(/\n(export|interface|const|function|type)\s/)
  const body = end < 0 ? rest : rest.slice(0, end)
  return [...body.matchAll(/\|\s*'([a-z0-9_]+)'/gi)].map((m) => m[1])
}

const CANON = unionMembers(
  readFileSync(path.join(PKG, 'ingest-article', '_curation-spec.ts'), 'utf8'),
  'SourceKey',
)
const COPY = unionMembers(readFileSync(path.join(APP, 'lib', 'acp', 'seed-upsert.ts'), 'utf8'), 'SeedSource')
const GUIDE = readFileSync(path.join(APP, 'lib', 'articles', 'source-guide.ts'), 'utf8')

/** 소스 GET 탭 목록 — source-guide 의 GET_TAB_SOURCES(정본)를 소스로 읽는다. */
function tabSources(): string[] {
  const at = GUIDE.indexOf('export const GET_TAB_SOURCES')
  const body = GUIDE.slice(at, GUIDE.indexOf('\n]', at))
  return [...body.matchAll(/^  '([a-z0-9_]+)',/gm)].map((m) => m[1])
}


describe('기사 소스 — 정본과 사본이 같은 목록을 든다', () => {
  it('두 유니언을 실제로 읽었다', () => {
    // 파서가 빈 배열을 돌려주면 아래 비교는 **0건 비교로 통과**한다.
    // 0 은 성과일 수도, 측정 실패일 수도 있다(§CONVENTIONS) — 분모부터 본다.
    expect(CANON.length, 'SourceKey 를 못 읽었다 — 이 가드가 아무것도 안 지킨다').toBeGreaterThan(10)
    expect(COPY.length, 'SeedSource 를 못 읽었다').toBeGreaterThan(10)
  })

  it('사본에 없는 소스가 없다', () => {
    // `original`(§20 재저작)은 수집 소스가 아니라 사본에 없어도 된다.
    const NOT_INGESTED = new Set(['original'])
    const missing = CANON.filter((k) => !NOT_INGESTED.has(k) && !COPY.includes(k))
    expect(
      missing,
      `정본(SourceKey)에만 있는 소스: ${missing.join(', ')} — ` +
        `apps/web/src/lib/acp/seed-upsert.ts 의 SeedSource 에도 더할 것 (안 하면 next build 가 깨진다)`,
    ).toEqual([])
  })

  it('정본에 없는 소스를 사본이 들고 있지 않다', () => {
    const extra = COPY.filter((k) => !CANON.includes(k))
    expect(extra, `사본에만 있는 소스: ${extra.join(', ')} — 정본에서 지워진 것이면 여기서도 지울 것`).toEqual(
      [],
    )
  })

  it('재고에 들어올 수 있는 모든 소스에 **이름**이 있다', () => {
    // ⚠️ **이름이 없으면 관리 화면에서 사라진다.** 검수·발행의 소스 드롭다운은
    //   `SOURCE_LABEL` 의 키로만 만들어지므로, 이름 없는 소스는 URL 에 `?src=` 를 손으로
    //   적어야만 걸러진다. 실측 2026-09-13: 이 맵이 「GET 탭이 있는 소스」 15개만 들고 있어
    //   재고 108,953편 중 **47,165편(43.3%)** 이 그 상태였고, 최대 소스 `gutenberg`(40,519편)는
    //   관리 화면 어디에서도 고를 수 없었다.
    //
    //   분모는 `ArticleSource` 다 — DB `library_articles_source_check` 와 같은 목록이어야 하고,
    //   그쪽이 정본이다(테스트는 DB 를 못 보므로 타입을 대리로 쓴다).
    const SOURCES = unionMembers(
      readFileSync(path.join(PKG, 'types-article.ts'), 'utf8'),
      'ArticleSource',
    )
    expect(SOURCES.length, 'ArticleSource 를 못 읽었다 — 이 가드가 아무것도 안 지킨다').toBeGreaterThan(20)

    // SOURCE_LABEL 블록만 떼어 읽는다 — 같은 파일의 SOURCE_REGISTERS 도 들여쓰기 2칸에
    // 같은 키를 갖고 있어, 파일 전체에서 긁으면 **라벨이 없어도 통과**한다(가드 자기무력화).
    const block = GUIDE.slice(GUIDE.indexOf('export const SOURCE_LABEL'))
    const body = block.slice(0, block.indexOf('\n}'))
    expect(body.length, 'SOURCE_LABEL 블록을 못 잘랐다').toBeGreaterThan(100)
    const labelled = [...body.matchAll(/^ {2}([a-z0-9_]+):/gm)].map((m) => m[1])
    const missing = SOURCES.filter((k) => !labelled.includes(k))
    expect(
      missing,
      `이름 없는 소스: ${missing.join(', ')} — apps/web/src/lib/articles/source-guide.ts 의 ` +
        `SOURCE_LABEL 에 더할 것 (없으면 그 소스의 원문은 관리 화면에서 못 고른다)`,
    ).toEqual([])
  })

  // ── GET 탭이 실제로 열리는가 ──────────────────────────────────────
  // 2026-09-14 실측: `futurity` 는 피드 라우트도 SOURCE_SPECS 도 2026-08-21 부터 있었는데
  //   `SOURCE_OPTIONS` 에만 빠져 있어 재고 2,885편이 쌓이는 동안 화면에서 부를 수 없었다.
  //   타입은 이것을 못 잡는다 — 배열에서 빠진 것은 타입 오류가 아니다.
  it('피드 라우트와 GET 탭이 1:1 이다', () => {
    const feedRoutes = readdirSync(path.join(APP, 'app', 'api', 'admin', 'articles'))
      .filter((d) => d.endsWith('-feed'))
      .map((d) => d.replace(/-feed$/, ''))
    expect(feedRoutes.length, '피드 라우트를 못 읽었다').toBeGreaterThan(10)

    const tabs = tabSources()
    expect(tabs.length, 'GET_TAB_SOURCES 를 못 읽었다').toBeGreaterThan(10)

    const noTab = feedRoutes.filter((f) => !tabs.includes(f))
    expect(
      noTab,
      `피드 라우트는 있는데 GET 탭이 없다: ${noTab.join(', ')} — source-guide 의 ` +
        `GET_TAB_SOURCES 에 더할 것 (없으면 화면에서 그 소스를 부를 수 없다)`,
    ).toEqual([])

    const noRoute = tabs.filter((t) => !feedRoutes.includes(t))
    expect(
      noRoute,
      `GET 탭은 있는데 피드 라우트가 없다: ${noRoute.join(', ')}`,
    ).toEqual([])
  })

  it('탭이 있는 소스는 전부 GET 화면의 case 를 갖는다', () => {
    // ⚠️ SourceGetBody 의 switch 에는 default 가 없다 — case 가 없으면 undefined 를 돌려주고
    //   손잡이만 열린 **빈 패널**이 뜬다. 오류도 경고도 없이 조용하다.
    const view = readFileSync(path.join(APP, 'app', 'admin', 'articles', 'SourceGetView.tsx'), 'utf8')
    const cases = [...view.matchAll(/case '([a-z0-9_]+)':/g)].map((m) => m[1])
    expect(cases.length, 'SourceGetBody 의 case 를 못 읽었다').toBeGreaterThan(10)

    const missing = tabSources().filter((t) => !cases.includes(t))
    expect(
      missing,
      `탭은 있는데 GET 화면이 없다: ${missing.join(', ')} — SourceGetView 의 ` +
        `SourceGetBody 에 case 를 더할 것 (없으면 빈 패널이 뜬다)`,
    ).toEqual([])
  })

  it('모든 소스가 어떤 register 를 다루는지 적혀 있다', () => {
    // `SOURCE_REGISTERS` 는 `Record<SourceKey, …>` 라 빠지면 tsc 가 잡지만,
    // **무엇을 채워야 하는지**는 여기서 이름으로 말해 준다.
    const missing = CANON.filter((k) => !new RegExp(`^\\s*${k}:`, 'm').test(GUIDE))
    expect(
      missing,
      `register 가 안 적힌 소스: ${missing.join(', ')} — source-guide.ts 의 SOURCE_REGISTERS 에 근거와 함께 적을 것`,
    ).toEqual([])
  })
})
