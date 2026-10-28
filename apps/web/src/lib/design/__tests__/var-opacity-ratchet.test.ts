// apps/web/src/lib/design/__tests__/var-opacity-ratchet.test.ts
//
// **변수 색에 붙은 /N 은 칠해지지 않는다**(Tailwind 3.4 — DD-82 · learner-tines-audit S3 ④ · S4).
// `bg-[var(--bd)]/55` 는 CSS 를 만들지 않아 조용히 투명하다 — 읽기 화면의 문장 듣기 점, 서가 코버플로의 페이지 점 9개,
// 포커스 고리(기본 파랑으로 떨어짐)가 그래서 의도와 다르게 보였다.
// 2026-10-18 학습자 코드(관리자·테스트 제외)에 119곳 · 50파일 → 읽기(16) · 서가 · 단어장(17)을
// `scripts/design/var-opacity-codemod.mjs` 로 고쳤다(2026-10-19 기준 60곳 · 26파일 — 허브 · 대시보드 · 설정 6곳, 단어장 서가 20곳 추가로 고침). 나머지는 화면 묶음마다 눈으로 확인하며 고친다.
//
// **파일별 상한**이다 — 총량만 막으면 한 곳을 고친 몫이 다른 파일의 새 결함을 가린다(사용자 지시 2026-10-19).
// 목록에 없는 파일에 하나라도 생기면 실패하고, 목록의 파일은 그 수를 넘으면 실패한다. 고치면 수를 낮추거나 줄을 지운다.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const SRC = path.resolve(__dirname, '../../..')
const RE = /\[var\(--[a-z0-9-]+\)\]\/\d{1,3}(?![\d%])/g

/**
 * 설명 주석을 뺀 코드에서만 센다 — 주석은 클래스가 아니다(규칙이 정당한 코드를 걸면 규칙을 고친다 · T-0203).
 * TypeScript 구문 트리의 잎 토큰(문자열 · 템플릿 조각 · JSX 텍스트 · 식별자 등)만 모은다. 토큰의 getText 는 앞쪽 주석(trivia)을
 * 포함하지 않으므로 주석만 빠지고 className 문자열 · 템플릿 · cn(...) 인자 · hover: 변형은 그대로 남는다.
 */
export function varOpacityHits(source: string, fileName = 'x.tsx'): string[] {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, false, fileName.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const parts: string[] = []
  const visit = (node: ts.Node) => {
    const kids = node.getChildren(sf)
    if (kids.length === 0) parts.push(node.getText(sf))
    else kids.forEach(visit)
  }
  visit(sf)
  return parts.join(' ').match(RE) ?? []
}

/** 기준선 — 파일(apps/web/src 기준) → 허용 상한. 2026-10-28 T-0203 에서 남은 58곳 · 25파일을 모두 color-mix 로 바꿔 0 이다. */
const BASELINE: Record<string, number> = {}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name)
    if (statSync(p).isDirectory()) {
      if (name === '__tests__' || name === 'admin') continue
      walk(p, out)
    } else if (/\.(tsx?|jsx?)$/.test(name)) out.push(p)
  }
  return out
}

describe('변수 색 /N 클래스(칠해지지 않음) — 파일별 상한', () => {
  const counts = new Map<string, string[]>()
  for (const f of walk(SRC)) {
    const hits = varOpacityHits(readFileSync(f, 'utf8'), f)
    if (hits.length) counts.set(path.relative(SRC, f).split(path.sep).join('/'), hits)
  }

  it('기준선에 없는 파일에는 하나도 없다(새 결함)', () => {
    const fresh = [...counts.entries()].filter(([f]) => !(f in BASELINE)).map(([f, h]) => `${f}  ${h.join(' ')}`)
    expect(fresh).toEqual([])
  })

  it('기준선의 파일은 그 수를 넘지 않는다', () => {
    const over = [...counts.entries()].filter(([f, h]) => f in BASELINE && h.length > BASELINE[f]!).map(([f, h]) => `${f}  ${h.length} > ${BASELINE[f]}`)
    expect(over).toEqual([])
  })

  it('고친 화면 묶음(읽기 · 서가 · 단어장 허브)에는 없다', () => {
    const fixed = [...counts.keys()].filter((f) => /^components\/(workspace|wordvault\/hub)\//.test(f) || /^components\/library\/(LibraryGrid|shared\/NetflixDetailSheet|browse\/(BookFilterBar|BooksExplorer|BookGridCard))\.tsx$/.test(f))
    expect(fixed).toEqual([])
  })
})

describe('varOpacityHits — 주석은 세지 않고 코드는 센다', () => {
  const P = 'bg-[var(--x)]/40'
  it('한 줄 · 여러 줄 · JSX 주석 안의 패턴은 세지 않는다', () => {
    expect(varOpacityHits(`// ${P}\n/* ${P} */\nconst a = 1\nexport const C = () => <div>{/* ${P} */}</div>`)).toEqual([])
  })
  it('className 문자열 · 템플릿 리터럴 · cn(...) 인자 · hover: 변형은 센다', () => {
    const src = [
      `export const A = () => <div className="p-2 ${P}" />`,
      'export const B = (on: boolean) => <div className={`p-2 ${on ? "' + P + '" : ""} hover:' + P + '`} />',
      `declare function cn(...a: string[]): string`,
      `export const C = () => <div className={cn('p-2', 'hover:border-[var(--p)]/30')} />`,
    ].join('\n')
    expect(varOpacityHits(src)).toEqual(['[var(--x)]/40', '[var(--x)]/40', '[var(--x)]/40', '[var(--p)]/30'])
  })
  it('주석과 코드가 섞여도 코드 쪽만 센다', () => {
    expect(varOpacityHits(`// ${P}\nconst s = '${P}'`)).toEqual(['[var(--x)]/40'])
  })
  it('바꾼 color-mix 표기는 세지 않는다', () => {
    expect(varOpacityHits(`const s = 'bg-[color-mix(in_srgb,var(--x)_40%,transparent)]'`)).toEqual([])
  })
})
