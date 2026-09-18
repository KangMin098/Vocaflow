// Gate 0 — page.tsx 전수 → 화면 목록. 입력: 메인 워크트리(읽기 전용). 출력: stdout JSON
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join, relative, sep, dirname } from 'node:path'
const WEB = process.argv[2]
const APP = join(WEB, 'src', 'app')
const baseline = new Set(JSON.parse(readFileSync(join(APP, '__tests__', 'form-declaration.baseline.json'), 'utf8')))
const pages = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); if (statSync(p).isDirectory()) return n === '__tests__' || n === 'api' ? [] : pages(p); return n === 'page.tsx' ? [p] : [] })
const LAYER = [[/^\/text\/\[id\]\/echo/, 'L4c'], [/^\/text/, 'L0–L2'], [/^\/wordvault/, 'L3'], [/^\/flashcard/, 'L4a'], [/^\/(play\/)?wordblitz/, 'L4a'], [/^\/pairflip/, 'L4a'], [/^\/spellforge/, 'L4b'], [/^\/scriptquiz/, 'L5'], [/^\/dictat/, 'L6'], [/^\/dashboard/, 'L7']]
const DECL = /^\/\/\s*@form:\s*([^—-]+?)\s*[—-]\s*(\S.{7,})$/m
const out = []
for (const f of pages(APP).sort()) {
  const relDir = relative(APP, dirname(f)).split(sep)
  const groups = relDir.filter((s) => /^\(.*\)$/.test(s) && !/^\(\.+\)/.test(s))
  const intercept = relDir.some((s) => /^\(\.+\)/.test(s))
  const slot = relDir.find((s) => s.startsWith('@'))
  const segs = relDir.filter((s) => s && !/^\(.*\)$/.test(s) && !s.startsWith('@'))
  const route = '/' + segs.join('/')
  const src = readFileSync(f, 'utf8')
  const hasJsx = /<[A-Za-z][\w.]*[\s/>]/.test(src.replace(/import[^\n]*\n/g, ''))
  const redirectOnly = /\bredirect\(|permanentRedirect\(/.test(src) && !hasJsx
  const isGame = segs[0] === 'arcade' || relDir.join('/').startsWith('(app)/play') || /components\/game\//.test(src) && /^\/(play|arcade)/.test(route)
  const surface = route.startsWith('/admin') ? 'admin'
    : redirectOnly ? 'redirect'
    : isGame ? 'game'
    : route.startsWith('/dev') ? 'dev'
    : groups.includes('(marketing)') || groups.includes('(auth)') || route === '/' ? 'public'
    : /\/(play|session)(\/|$)|\/echo$|\/dissect/.test(route) ? 'session'
    : 'learner'
  const dyn = segs.filter((s) => /^\[.*\]$/.test(s))
  const d = dirname(f)
  const decl = src.split(/\r?\n/).slice(0, 20).join('\n').match(DECL)
  out.push({
    file: relative(WEB, f).split(sep).join('/'), route, group: groups.join(',') || null, surface,
    layer: (LAYER.find(([re]) => re.test(route)) || [null, null])[1],
    dynamic: dyn, interceptOrSlot: intercept || !!slot,
    form: decl ? { axis: decl[1].trim(), signature: decl[2].trim() } : null,
    inBaseline: baseline.has(relative(WEB, f).split(sep).join('/')),
    states: ['loading', 'error', 'not-found'].filter((s) => existsSync(join(d, s + '.tsx'))),
    lines: src.split('\n').length,
  })
}
console.log(JSON.stringify(out, null, 1))
