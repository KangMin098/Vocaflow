// apps/web/src/lib/admin/__tests__/help-registry.test.ts
//
// 화면도움말 계약을 **레지스트리 전체**에 대해 잠근다.
//
// 왜 필요한가: AdminScreenHelp 의 계약은 두 개 다 **문자열**이다.
//   ① 화면이 넘기는 `screen="<키>"` ↔ HELP_REGISTRY 의 키
//   ② 화면이 넘기는 `tab={<활성 탭 라벨>}` ↔ 엔트리 `tabs` 의 키(= 화면에 보이는 라벨 그대로)
// 둘 중 어느 쪽을 바꿔도 **타입 에러도 런타임 에러도 나지 않는다.** 도움말 패널이
// 조용히 비거나 통째로 사라지고, 관리자는 "다음에 뭘 눌러야 하는지"를 모른 채 조작한다.
// 파이프라인 화면의 오조작은 되돌릴 수 없는 것(외부 유료 호출 · DELETE)을 포함하므로
// 이 드리프트는 코드 버그보다 비싸다.
//
// compose-help.test.ts 는 화면 하나(compose)만 잠갔다. 나머지 파이프라인
// (articles · curation · comic · pd-comics · csat · vrl …)의 탭 수십 개가 무방비였다.
// 이 파일이 그 구멍을 전부 덮는다 — 새 화면·새 탭이 생기면 여기가 자동으로 포함한다.
//
// 소스 스캔 방식은 scripts/audit/admin-console.mjs 와 같은 발상이지만, 그 스크립트는
// 도움말 파일을 **정규식으로 파싱**한다(들여쓰기 규칙이 바뀌면 조용히 틀린다).
// 여기서는 HELP_REGISTRY 를 **실제로 import** 하므로 파싱 오차가 없다.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { HELP_REGISTRY } from '../help'

const WEB_SRC = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..')
const ADMIN_APP = join(WEB_SRC, 'app', 'admin')
const ADMIN_COMPONENTS = join(WEB_SRC, 'components', 'admin')

// ── 파일 유틸 ────────────────────────────────────────────────────────────────
function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

const readCache = new Map<string, string>()
function read(p: string): string {
  let v = readCache.get(p)
  if (v === undefined) {
    try {
      v = readFileSync(p, 'utf8')
    } catch {
      v = ''
    }
    readCache.set(p, v)
  }
  return v
}

const rel = (p: string) => relative(WEB_SRC, p).split(sep).join('/')

/** `@/…` 와 상대 경로만 따라간다 — node_modules 는 화면 표면이 아니다. */
function resolveImport(spec: string, fromFile: string): string | null {
  let base: string
  if (spec.startsWith('@/')) base = join(WEB_SRC, spec.slice(2))
  else if (spec.startsWith('./') || spec.startsWith('../')) base = resolve(dirname(fromFile), spec)
  else return null
  for (const cand of [base, `${base}.tsx`, `${base}.ts`, join(base, 'index.tsx'), join(base, 'index.ts')]) {
    if (existsSync(cand) && statSync(cand).isFile()) return cand
  }
  return null
}

const IMPORT_RE = /(?:from\s+|import\s+)['"]([^'"]+)['"]/g

/**
 * 탭 라벨은 usage 파일에 직접 있기도 하고(TAB_LABEL 맵), 별도 상수 모듈에서 오기도 한다
 * (compose 의 COMPOSE_TABS). 그래서 지역 임포트를 따라간 파일 집합 전체에서 찾는다.
 */
function surfaceFiles(entry: string, maxDepth = 4): string[] {
  const seen = new Set([entry])
  let frontier = [entry]
  for (let d = 0; d < maxDepth; d++) {
    const next: string[] = []
    for (const f of frontier) {
      for (const m of read(f).matchAll(IMPORT_RE)) {
        const r = resolveImport(m[1], f)
        if (r && !seen.has(r)) {
          seen.add(r)
          next.push(r)
        }
      }
    }
    if (next.length === 0) break
    frontier = next
  }
  return [...seen]
}

// ── 화면이 실제로 부르는 도움말 키 수집 ──────────────────────────────────────
// `<AdminScreenHelp ... screen="키"` 만 본다. 다른 컴포넌트의 `screen` prop 을 섞으면
// 존재하지 않는 위반을 만들어 낸다 — 자가 틀리면 이 테스트 전체가 틀린다.
const USAGE_RE = /<AdminScreenHelp\b[^>]{0,400}?screen=["']([^"']+)["']/g

const SOURCES = [...walk(ADMIN_APP), ...walk(ADMIN_COMPONENTS)].filter(
  (p) => p.endsWith('.tsx') || p.endsWith('.ts'),
)

/** 도움말 키 → 그 키를 부르는 파일들 */
const usages = new Map<string, string[]>()
for (const f of SOURCES) {
  const src = read(f)
  if (!src.includes('AdminScreenHelp')) continue
  for (const m of src.matchAll(USAGE_RE)) {
    const key = m[1]
    if (!usages.has(key)) usages.set(key, [])
    usages.get(key)!.push(f)
  }
}

const registryKeys = Object.keys(HELP_REGISTRY).sort()
const usedKeys = [...usages.keys()].sort()

describe('화면도움말 — 스캐너 자체가 살아 있는가', () => {
  // 스캐너가 0건을 긁어 오면 아래 검사가 전부 "위반 없음"으로 통과한다.
  // 그 침묵이 이 테스트의 유일한 실패 모드다. 먼저 바닥을 박아 둔다.
  it('화면에서 도움말 호출을 실제로 찾아낸다', () => {
    expect(SOURCES.length).toBeGreaterThan(100)
    expect(usedKeys.length).toBeGreaterThanOrEqual(40)
  })

  it('레지스트리가 비어 있지 않다', () => {
    expect(registryKeys.length).toBeGreaterThanOrEqual(40)
  })
})

describe('화면도움말 — 키 계약 (양방향)', () => {
  it('화면이 부르는 키가 레지스트리에 전부 있다', () => {
    const missing = usedKeys
      .filter((k) => !(k in HELP_REGISTRY))
      .map((k) => `${k}  ← ${usages.get(k)!.map(rel).join(', ')}`)
    // 없으면 그 화면의 도움말 버튼은 아무것도 열지 않는다(오류 없이).
    expect(missing).toEqual([])
  })

  it('레지스트리 키를 부르는 화면이 반드시 있다 (고아 항목 금지)', () => {
    const orphans = registryKeys.filter((k) => !usages.has(k))
    // 고아는 "쓰이는 줄 알고 갱신되는 문서" 다 — 낡아도 아무도 모른다.
    expect(orphans).toEqual([])
  })
})

describe('화면도움말 — 탭 라벨 계약', () => {
  const tabbed = registryKeys.filter((k) => {
    const t = HELP_REGISTRY[k]!.tabs
    return t && Object.keys(t).length > 0
  })

  it('탭 도움말을 가진 화면이 여럿 있다 (아래 검사가 빈 루프가 아니다)', () => {
    expect(tabbed.length).toBeGreaterThanOrEqual(5)
    const totalTabs = tabbed.reduce((s, k) => s + Object.keys(HELP_REGISTRY[k]!.tabs!).length, 0)
    expect(totalTabs).toBeGreaterThanOrEqual(25)
  })

  it('모든 탭 키가 그 화면 소스에 문자열 그대로 존재한다', () => {
    const mismatches: string[] = []
    for (const key of tabbed) {
      const files = usages.get(key)
      if (!files) continue // 키 계약 검사가 따로 잡는다
      const blob = files
        .flatMap((f) => surfaceFiles(f))
        .map((f) => read(f))
        .join('\n')
      for (const label of Object.keys(HELP_REGISTRY[key]!.tabs!)) {
        // 라벨은 상수 맵의 값(`'스타일'`)이거나 JSX 텍스트(`>스타일<`)로 나타난다.
        const found =
          blob.includes(`'${label}'`) || blob.includes(`"${label}"`) || blob.includes(`>${label}<`)
        if (!found) mismatches.push(`${key} → '${label}' (부른 곳: ${files.map(rel).join(', ')})`)
      }
    }
    // 어긋나면 그 탭에서 도움말이 조용히 사라진다 — 라벨과 tabs 키를 같은 커밋에서 고칠 것.
    expect(mismatches).toEqual([])
  })
})

describe('화면도움말 — 최소 내용', () => {
  it('모든 엔트리에 제목과 요약이 있다', () => {
    const thin: string[] = []
    for (const key of registryKeys) {
      const e = HELP_REGISTRY[key]!
      if (!e.title?.trim()) thin.push(`${key}: title 없음`)
      if ((e.screen?.summary ?? '').trim().length < 15) thin.push(`${key}: screen.summary 가 너무 짧다`)
    }
    expect(thin).toEqual([])
  })

  it('모든 탭에 요약이 있다 — 빈 패널은 없는 것보다 나쁘다', () => {
    const thin: string[] = []
    for (const key of registryKeys) {
      for (const [label, help] of Object.entries(HELP_REGISTRY[key]!.tabs ?? {})) {
        if ((help.summary ?? '').trim().length < 15) thin.push(`${key} → '${label}'`)
      }
    }
    expect(thin).toEqual([])
  })

  // ⚠️ 여기서 "드레인이 있으면 recovery 에 '재실행 안전' 이 적혀 있다"(CLAUDE.md §3)까지
  //    잠그고 싶었으나, 2026-09-05 실측으로 11곳이 미달이다 — comic-drain · csat ·
  //    csat-authoring · csat-evidence · csat-review · csat-strategy · curation→'Curated Books' ·
  //    pending-words · textbook · vocab-run-seed · vocabulary.
  //    그 파일들은 파이프라인 담당이 소유하므로 여기서 고치지 않는다. 채워진 뒤에
  //    아래 형태로 되살릴 것(그 전에 켜면 남의 영역 때문에 이 파일이 상시 빨갛다):
  //      for (const d of allDrains) expect(d.recovery.join(' ')).toContain('재실행')
  it('드레인 절차가 있으면 최소 형태를 갖춘다 (전제·절차·확인)', () => {
    const bad: string[] = []
    const check = (
      where: string,
      drain: { prerequisites?: string[]; procedure?: unknown[]; verify?: string[] } | undefined,
    ) => {
      if (!drain) return
      if (!drain.procedure?.length) bad.push(`${where}: procedure 없음`)
      if (!drain.prerequisites?.length) bad.push(`${where}: prerequisites 없음`)
      if (!drain.verify?.length) bad.push(`${where}: verify 없음`)
    }
    for (const key of registryKeys) {
      const e = HELP_REGISTRY[key]!
      check(key, e.screen.drain)
      for (const [label, help] of Object.entries(e.tabs ?? {})) check(`${key} → '${label}'`, help.drain)
    }
    expect(bad).toEqual([])
  })
})
