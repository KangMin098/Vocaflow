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

import { readFileSync } from 'node:fs'
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
