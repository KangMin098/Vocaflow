// apps/web/src/lib/__tests__/script-typecheck-coverage.test.ts
//
// **스크립트가 타입체크 밖으로 새지 않게 한다.**
//
// ── 무엇이 있었나 (실측 2026-09-23 · DD-78) ──────────────────────────
// `apps/web/tsconfig.json` 의 `include` 는 `**/*.ts` · `**/*.tsx` 다. TypeScript 의 include
// 패턴은 확장자를 **글자 그대로** 보므로 `**/*.ts` 는 `.mts` 를 안 잡는다. 그래서
// `apps/web/scripts` 의 `.mts` 32개가 통째로 컴파일 밖에 있었고, 그 사실이 실제 결함을 숨겼다:
//
//   · `video-source.mts` 가 `SeriesDef.status` 를 복사하고 있었는데, 그 필드를 **지운 뒤에도**
//     `pnpm turbo run typecheck` 가 7/7 통과했다(DD-76). 광고 번들에 그대로 실려 나갔다.
//   · `csat-learner/env.mts` 의 `doc.destroy()` 는 pdfjs-dist 6.x 에서 **로딩 작업으로 옮겨
//     갔는데** `typeof` 가드에 싸여 있어 늘 거짓이었다 — 워커가 한 번도 안 내려갔다.
//   · `tcp-seed-from-gaps.mts` 의 `OVERRIDES` 가 `Partial<SeedListItem>` 인데 **다른 이름**을
//     쓰고 있어(`cefr` vs `cefr_estimate`) 다섯 예외 중 하나는 통째로 안 먹고, 규격 밖 키가
//     출력 JSONL 에 실려 나갔다.
//
// 셋 다 컴파일이 1초에 잡을 것들이었다. 그래서 잠그는 것은 둘이다:
//   ① `.mts` 를 보는 설정이 있고, **실제로 돌아가는가**(파일만 있고 안 돌리면 없는 것과 같다)
//   ② 스크립트의 **상대 경로 임포트가 실재하는 파일을 가리키는가** — 루트 `scripts/` 는 아직
//      어느 tsconfig 에도 안 잡혀 있어서(부채, 아래 주석) 이 값싼 검사로 대신 막는다.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const WEB = resolve(HERE, '..', '..', '..')
const REPO = resolve(WEB, '..', '..')

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

/* ── ① 설정이 있고 실제로 돌아간다 ───────────────────────────────── */

describe('.mts 가 타입체크 밖으로 새지 않는다', () => {
  const scriptsTsconfig = join(WEB, 'tsconfig.scripts.json')

  it('스크립트 전용 tsconfig 가 `.mts` 를 포함한다', () => {
    expect(existsSync(scriptsTsconfig), 'apps/web/tsconfig.scripts.json 이 없다').toBe(true)
    const raw = readFileSync(scriptsTsconfig, 'utf8')
    expect(raw).toContain('scripts/**/*.mts')
    // 확장자를 적어 부르는 스크립트끼리의 임포트를 허용하는 것이 이 파일이 따로 있는 이유다.
    expect(raw).toContain('allowImportingTsExtensions')
  })

  it('package.json 의 typecheck 가 그 설정을 **실제로 돌린다**', () => {
    // ⚠️ 설정 파일만 두고 안 돌리면 없는 것과 같다 — 이 저장소는 스캐너를 만들어 두고
    //   아무 데도 안 연결해 둔 전례가 있다(`row-write-budget.test.ts` 머리말).
    const pkg = JSON.parse(readFileSync(join(WEB, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>
    }
    expect(pkg.scripts.typecheck).toContain('tsconfig.scripts.json')
  })

  it('본 설정이 안 보는 자리에 `.mts` 가 놓이지 않는다', () => {
    // 본 설정의 include 는 `**/*.ts`·`**/*.tsx` 라 `scripts/` 밖의 `.mts` 는 **아무도 안 본다**.
    const stray = walk(WEB)
      .filter((p) => extname(p) === '.mts')
      .map((p) => relative(WEB, p).replace(/\\/g, '/'))
      .filter((p) => !p.startsWith('scripts/'))
    expect(stray, '이 파일들을 보는 tsconfig 가 없다').toEqual([])
  })
})

/* ── ② 스크립트의 상대 임포트가 실재한다 ─────────────────────────── */

/** 임포트 지정자 → 실제 파일. 못 찾으면 null. */
function resolveSpecifier(fromFile: string, spec: string): string | null {
  const base = resolve(dirname(fromFile), spec)
  const candidates = [
    base,
    // `./x.js` · `./x.mjs` 로 적고 실제로는 TS 파일인 경우(ESM 관례)
    base.replace(/\.js$/, '.ts'),
    base.replace(/\.mjs$/, '.mts'),
    `${base}.ts`,
    `${base}.mts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.mjs`,
    `${base}.json`,
    join(base, 'index.ts'),
    join(base, 'index.mts'),
    join(base, 'index.tsx'),
    join(base, 'index.js'),
  ]
  return candidates.find((c) => existsSync(c) && statSync(c).isFile()) ?? null
}

const IMPORT_RE = /(?:^|[\s(=])(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/gm

/**
 * 스캔 전에 **템플릿 문자열과 주석을 지운다.**
 *
 * ⚠️ 안 지우면 오탐이 난다 — 실제로 첫 실행에서 `assets-drain-import.mjs` 가 걸렸는데,
 *   그 파일이 **생성해서 써 주는 코드** 안의 `import type … from '../Illustration'` 이었다.
 *   그 경로는 생성물이 놓이는 자리(`components/illustrations/generated/`) 기준이라 이 스크립트
 *   자리에서는 당연히 안 풀린다. 생성 코드를 스크립트 자신의 임포트로 세면 이 검사는
 *   고칠 수 없는 빨간불을 내고, 그러면 아무도 안 본다.
 */
function stripStringsAndComments(src: string): string {
  return src
    .replace(/`(?:\\[\s\S]|[^\\`])*`/g, '``')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

describe('스크립트의 상대 임포트가 실재하는 파일을 가리킨다', () => {
  // 루트 `scripts/` 와 `apps/web/scripts/` 둘 다 본다.
  const files = [...walk(join(REPO, 'scripts')), ...walk(join(WEB, 'scripts'))].filter((p) =>
    ['.ts', '.mts', '.tsx', '.mjs', '.js'].includes(extname(p)),
  )

  it('훑을 스크립트가 실제로 있다 — 0개면 이 검사가 아무것도 안 지킨다', () => {
    expect(files.length).toBeGreaterThan(100)
  })

  it('지워진 모듈을 가리키는 임포트가 없다', () => {
    // ⚠️ 이 검사가 잡은 것: `scripts/check-acp-feeds.ts` 가
    //   `ingest-article/arxiv` 를 최상위에서 import 하고 있었다. 그 소스는 마이그레이션
    //   `20260614240000_acp_remove_arxiv_source` 로 제거됐고, 그 뒤로 이 스크립트는
    //   **어느 모드로도 못 돌았다**(voa 를 불러도 import 에서 죽는다). 아무도 몰랐던 이유는
    //   루트 `scripts/` 가 어느 tsconfig 에도 안 잡혀 있어서다.
    const broken: string[] = []
    for (const f of files) {
      const src = stripStringsAndComments(readFileSync(f, 'utf8'))
      for (const m of src.matchAll(IMPORT_RE)) {
        const spec = m[1] ?? m[2]
        if (!spec || !spec.startsWith('.')) continue
        if (resolveSpecifier(f, spec) == null) {
          broken.push(`${relative(REPO, f).replace(/\\/g, '/')} → ${spec}`)
        }
      }
    }
    expect(broken).toEqual([])
  })
})

/* ── 남은 부채 ──────────────────────────────────────────────────────
 * 루트 `scripts/`(`.ts` 47 · `.mts` 58)는 **어느 패키지에도 속하지 않아** 여전히 타입체크
 * 밖이다. 2026-09-23 실측: 본 저장소 엄격 설정으로는 오류 **299**, 엄격성을 끄고 이름·임포트
 * 종류만 보면 **27**. 27 중 다수는 실제 결함이지만(잘못된 캐스팅 · DTO 불일치) 스크립트마다
 * 맥락이 달라 한 번에 고칠 수 없다. 그래서 지금은 위 ② 가 **가장 비싼 한 종류**(지워진 모듈을
 * 가리키는 임포트)만 막는다. 재는 법은 DD-78 에 적어 두었다.
 */
