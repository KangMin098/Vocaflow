// apps/web/src/lib/__tests__/route-query-params.test.ts
//
// **그 링크가 가리키는 라우트가 그 파라미터를 실제로 읽는가.**
//
// ── 이름 감시로는 부족했다 (실측 2026-08-30) ─────────────────────────
// 짝인 `orphan-query-params.test.ts` 는 "이름이 저장소 **어디에서도** 안 읽히는가" 만 본다.
// 그래서 `/dictate/setup?textId=` 는 잡았지만(아무도 안 읽는 이름이라), **A 화면이 읽는
// 이름을 B 화면 링크에 거는 경우**는 통과시킨다. 그게 더 흔한 모양이다:
//
//   · `/wordvault?set=<id>`   — `set` 은 `/dictate/setup` 이 읽는다. `/wordvault` 는 안 읽는다.
//                               "단어장 보기" 를 눌러도 그 세트가 아니라 허브 전체가 열렸다
//   · `/flashcard?mode=review` — `mode` 는 `/reset-password` 가 읽는다. `/flashcard` 는 안 읽는다
//
// 그래서 **목적지 라우트의 모듈 그래프**(page → import 를 따라간 집합)에서 읽는지 본다.
//
// ── 오탐 세 부류를 먼저 처리했다 (그것이 이 판정의 설계다) ───────────
// 처음 돌렸을 때 12건이 나왔고 그중 10건이 계측기 잘못이었다. 하나씩 확인해 고쳤다:
//   ① **넘겨 주는 라우트** — `/wordvault` 는 `view` 만 떼고 나머지 쿼리를 목적지로 그대로
//      넘긴다. 그 라우트에서 이름을 따지면 멀쩡한 `?q=`·`?level=` 이 고아가 된다.
//   ② **별칭 상수** — `resolveReturnTo` 는 `RETURN_PARAM_ALIASES` 를 돌며 `params.get(key)`
//      한다. 리터럴 `'next'` 가 `.get(` 옆에 없어서 `/login?next=` 를 고아로 신고했다.
//   ③ **주석** — 결함 경위를 길게 적는 저장소라 옛 주소가 주석에 남는다. 안 걷으면
//      방금 고친 것을 다시 신고한다.
//
// ⚠️ 라우트 파일을 못 찾은 링크는 **실패로 세지 않는다**(계산된 경로 조각 등).
//    다만 개수를 출력한다 — 조용히 빠지면 그건 커버리지가 아니라 사각지대다.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC = join(__dirname, '..', '..')
const APP = join(SRC, 'app')
const rel = (f: string) => relative(SRC, f).split(sep).join('/')

/** ③ 주석 제거 — 이 파일 머리 §오탐 부류 참조. */
const strip = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1')

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(name)) out.push(p)
  }
  return out
}

/** 제품이 거는 링크만 본다 — 픽스처·목업·외부 API·실험 화면은 제외(짝 파일과 같은 기준). */
function skipped(f: string): boolean {
  const p = rel(f)
  return (
    p.includes('__tests__/') ||
    p.endsWith('.mock.ts') ||
    p.includes('lib/library/seed-fetchers/') ||
    p.includes('hub-lab/')
  )
}

/** URL 경로 → 그 라우트의 진입 파일. 동적 구간은 `*` 로 접는다. */
function routeMap(): Map<string, string> {
  const out = new Map<string, string>()
  const scan = (dir: string, url: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (!statSync(p).isDirectory()) continue
      if (name.startsWith('(') || name.startsWith('_')) {
        scan(p, url) // 라우트 그룹은 URL 에 안 들어간다
        continue
      }
      const child = `${url}/${name.startsWith('[') ? '*' : name}`
      for (const leaf of ['page.tsx', 'route.ts']) {
        if (existsSync(join(p, leaf))) out.set(child, join(p, leaf))
      }
      scan(p, child)
    }
  }
  scan(APP, '')
  return out
}

function resolveImport(from: string, spec: string): string | null {
  let base: string
  if (spec.startsWith('@/')) base = join(SRC, spec.slice(2))
  else if (spec.startsWith('.')) base = resolve(dirname(from), spec)
  else return null
  for (const ext of ['.ts', '.tsx', '/index.ts', '/index.tsx']) {
    if (existsSync(base + ext)) return base + ext
  }
  return existsSync(base) && statSync(base).isFile() ? base : null
}

const importCache = new Map<string, string[]>()
function importsOf(f: string): string[] {
  const hit = importCache.get(f)
  if (hit) return hit
  const src = readFileSync(f, 'utf8')
  const out: string[] = []
  for (const m of src.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
    const r = resolveImport(f, m[1]!)
    if (r) out.push(r)
  }
  for (const m of src.matchAll(/import\(\s*['"]([^'"]+)['"]/g)) {
    const r = resolveImport(f, m[1]!)
    if (r) out.push(r)
  }
  importCache.set(f, out)
  return out
}

/** 진입 파일에서 import 를 따라 도달하는 모듈 집합. */
function subtree(entry: string, max = 1500): Set<string> {
  const seen = new Set<string>()
  const q = [entry]
  while (q.length && seen.size < max) {
    const f = q.shift()
    if (!f || seen.has(f)) continue
    seen.add(f)
    for (const i of importsOf(f)) if (!seen.has(i)) q.push(i)
  }
  return seen
}

function readsIn(files: Iterable<string>): Set<string> {
  const out = new Set<string>()
  for (const f of files) {
    const src = strip(readFileSync(f, 'utf8'))
    for (const m of src.matchAll(/\.get\(\s*['"]([a-zA-Z_]\w*)['"]/g)) out.add(m[1]!)
    for (const m of src.matchAll(/searchParams\s*[:?]\s*\{([\s\S]*?)\}/g)) {
      for (const k of m[1]!.matchAll(/([a-zA-Z_]\w*)\s*\??\s*:/g)) out.add(k[1]!)
    }
    for (const m of src.matchAll(/\b(?:searchParams|sp|params|query)\??\.([a-zA-Z_]\w*)\b/g)) {
      out.add(m[1]!)
    }
    // ② 별칭 상수 배열 — `RETURN_PARAM_ALIASES = ['next', 'returnTo', 'redirect']`
    for (const m of src.matchAll(/(?:ALIASES|PARAM_KEYS|QUERY_KEYS)\s*(?::[^=]*)?=\s*\[([^\]]*)\]/g)) {
      for (const k of m[1]!.matchAll(/['"]([a-zA-Z_]\w*)['"]/g)) out.add(k[1]!)
    }
  }
  return out
}

/** ① 남은 쿼리를 목적지로 그대로 넘기는 라우트인가. 그러면 이름을 따지지 않는다. */
function forwards(file: string): boolean {
  const s = strip(readFileSync(file, 'utf8'))
  return /\.delete\(/.test(s) && /router\.(replace|push)\(/.test(s) && /URLSearchParams/.test(s)
}

const normalize = (r: string) =>
  r.replace(/\$\{[^}]*\}/g, '*').replace(/\/\[[^\]]*\]/g, '/*').replace(/\/+$/, '') || '/'

interface Written {
  name: string
  file: string
  route: string
}

function writtenLinks(files: string[]): Written[] {
  const out: Written[] = []
  const link = /["'`](\/[A-Za-z0-9\-_/[\]$;{}.]*)\?([^"'`]+)["'`]/g
  for (const f of files) {
    if (skipped(f)) continue
    const src = strip(readFileSync(f, 'utf8'))
    for (const m of src.matchAll(link)) {
      for (const pair of m[2]!.split('&')) {
        const name = pair.split('=')[0]!
        if (!/^[a-zA-Z_]\w*$/.test(name)) continue
        out.push({ name, file: rel(f), route: m[1]! })
      }
    }
  }
  return out
}

describe('링크가 가리키는 라우트가 그 파라미터를 읽는다', () => {
  const FILES = walk(SRC)
  const ROUTES = routeMap()
  const LINKS = writtenLinks(FILES)

  it('스캔이 비어 있으면 이 테스트는 아무것도 지키지 않는다', () => {
    expect(LINKS.length).toBeGreaterThan(50)
    expect(ROUTES.size).toBeGreaterThan(50)
  })

  it('목적지가 안 읽는 파라미터가 없다', () => {
    const readCache = new Map<string, Set<string>>()
    const fwdCache = new Map<string, boolean>()
    const offenders = new Set<string>()
    let unresolved = 0

    for (const w of LINKS) {
      const key = normalize(w.route)
      const entry = ROUTES.get(key)
      if (!entry) {
        unresolved += 1 // 계산된 경로 조각 — 판정 보류(실패로 세지 않는다)
        continue
      }
      if (!fwdCache.has(entry)) fwdCache.set(entry, forwards(entry))
      if (fwdCache.get(entry)) continue
      if (!readCache.has(entry)) readCache.set(entry, readsIn(subtree(entry)))
      if (!readCache.get(entry)!.has(w.name)) {
        offenders.add(`${key}  ?${w.name}=  ← ${w.file}`)
      }
    }

    // 보류가 링크 전체를 삼키면 이 검사는 통과해도 뜻이 없다.
    expect(unresolved, '라우트를 못 찾은 링크가 지나치게 많다 — 경로 지도가 깨졌다').toBeLessThan(
      Math.floor(LINKS.length / 4),
    )

    const lines = [...offenders].sort()
    expect(
      lines,
      '목적지가 읽지 않는 파라미터(화면은 오류 없이 뜨고 조건만 조용히 버려진다):\n' +
        lines.join('\n'),
    ).toEqual([])
  })
})
