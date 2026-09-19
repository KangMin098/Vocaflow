// Gate 1/3 — 화면 단위 import 트리 · 연결 · 정적 평균 신호.
// 사용: node screen-graph.mjs <webDir> <screens.raw.json> <edges.json> <out.json>
// - 화면의 "자기 트리" = page.tsx 부터 따라간 로컬 import(@/ 별칭·상대경로). node_modules 제외.
// - "셸 트리" = 그 화면을 감싸는 layout.tsx 들의 트리. 모든 화면이 공유하므로 연결·신호에서 따로 센다.
// - 평균 신호 정규식은 apps/web/src/components/__tests__/average-signal-ratchet.test.ts 와 같다.
import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { join, dirname, resolve, relative, sep } from 'node:path'

const [, , WEB, SCREENS, EDGES, OUT] = process.argv
const SRC = join(WEB, 'src')
const ROOT = resolve(WEB, '..', '..')
const screens = JSON.parse(readFileSync(SCREENS, 'utf8'))
const edges = JSON.parse(readFileSync(EDGES, 'utf8'))
const toRepo = (abs) => relative(ROOT, abs).split(sep).join('/')

const EXT = ['.tsx', '.ts', '.css', '/index.tsx', '/index.ts']
function resolveSpec(from, spec) {
  let base
  if (spec.startsWith('@/')) base = join(SRC, spec.slice(2))
  else if (spec.startsWith('.')) base = resolve(dirname(from), spec)
  else return null
  if (existsSync(base) && /\.(tsx?|css)$/.test(base)) return base
  for (const e of EXT) if (existsSync(base + e)) return base + e
  return null
}
const IMPORT = /(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g
const memo = new Map()
function tree(entry) {
  const seen = new Set()
  const stack = [entry]
  while (stack.length) {
    const f = stack.pop()
    if (seen.has(f)) continue
    seen.add(f)
    let deps = memo.get(f)
    if (!deps) {
      const src = readFileSync(f, 'utf8')
      deps = []
      for (const m of src.matchAll(IMPORT)) {
        const spec = m[1] || m[2]
        if (/^import\s+type\b/.test(m[0])) continue
        const r = spec && resolveSpec(f, spec)
        if (r) deps.push(r)
      }
      memo.set(f, deps)
    }
    for (const d of deps) if (!seen.has(d)) stack.push(d)
  }
  return seen
}

const SIGNALS = {
  'grid-3eq': /(?<![\w-])(?:(?:sm|md|lg|xl):)?grid-cols-3(?![\w-])/g,
  'shadow-heavy': /(?<![\w-])(?:hover:)?shadow-(?:md|lg|xl|2xl)(?![\w-])/g,
  'rounded-big': /(?<![\w-])rounded-(?:xl|2xl|3xl)(?![\w-])/g,
  gradient: /bg-gradient-to-|linear-gradient\(|radial-gradient\(/g,
  'ai-purple': /#8B5CF6|#7C3AED|#6D28D9|#A78BFA|(?<![\w-])(?:bg|text|border|from|to|via|ring)-(?:violet|purple|indigo)-\d{2,3}/gi,
  glass: /backdrop-blur/g,
  'float-hover': /hover:-translate-y-/g,
  'infinite-anim': /_infinite\]|animate-(?:bounce|ping)(?![\w-])/g,
}
const FORM_SEEDS = {
  S1: 'components/layout/MemorySparkline.tsx', S2: 'components/ui/press/index.tsx', S3: 'components/marketing/CoverageHero.tsx',
  S4: 'components/textfit/TextFitVerdict.tsx', S5: 'components/csat/PassageMap.tsx', S6: 'components/csat/session/visual-analysis.module.css',
  S7: 'components/csat/session/learning-home.module.css', S8: 'components/dashboard/DurabilityLadder.tsx', S9: 'components/dashboard/LexicalReach.tsx',
  S10: 'components/layout/CompassRibbon.tsx',
}

function layoutsFor(pageAbs) {
  const out = []
  let d = dirname(pageAbs)
  const appDir = join(SRC, 'app')
  while (d.startsWith(appDir)) {
    const l = join(d, 'layout.tsx')
    if (existsSync(l)) out.push(l)
    if (d === appDir) break
    d = dirname(d)
  }
  return out
}

const byRoute = {}
const shellFilesAll = new Set()
for (const s of screens) {
  const pageAbs = join(WEB, s.file)
  const own = tree(pageAbs)
  const shell = new Set()
  for (const l of layoutsFor(pageAbs)) for (const f of tree(l)) shell.add(f)
  for (const f of shell) own.delete(f)
  for (const f of shell) shellFilesAll.add(f)
  const ownRel = [...own].map(toRepo)
  const counts = Object.fromEntries(Object.keys(SIGNALS).map((k) => [k, 0]))
  for (const f of own) {
    if (/__tests__|\.test\./.test(f)) continue
    const t = readFileSync(f, 'utf8')
    for (const [k, re] of Object.entries(SIGNALS)) counts[k] += t.match(re)?.length ?? 0
  }
  const out = new Map()
  for (const f of ownRel) {
    const key = f.replace(/^apps\/web\//, 'apps/web/')
    for (const e of edges[key] || []) if (e.to !== s.route) out.set(e.to, (out.get(e.to) || []).concat(`${f}:${e.line}`))
  }
  const shellOut = new Set()
  for (const f of shell) for (const e of edges[toRepo(f)] || []) shellOut.add(e.to)
  byRoute[s.route] = {
    ownFiles: ownRel.length,
    seeds: Object.entries(FORM_SEEDS).filter(([, p]) => ownRel.some((f) => f.endsWith(p))).map(([k]) => k),
    signals: counts,
    signalTotal: Object.values(counts).reduce((a, b) => a + b, 0),
    out: [...out.entries()].map(([to, at]) => ({ to, at: at.slice(0, 2) })),
    shellOut: [...shellOut],
  }
}
// 들어오는 길: 다른 화면의 자기 트리에서 오는 것 / 셸(레이아웃)에서 오는 것
for (const [route, r] of Object.entries(byRoute)) {
  r.inFromScreens = Object.entries(byRoute).filter(([k, o]) => k !== route && o.out.some((e) => e.to === route)).map(([k]) => k)
  r.inFromShell = Object.values(byRoute).some((o) => o.shellOut.includes(route))
}
for (const r of Object.values(byRoute)) delete r.shellOut
writeFileSync(OUT, JSON.stringify(byRoute, null, 1))
console.log('screens', Object.keys(byRoute).length, 'shell files', shellFilesAll.size)
