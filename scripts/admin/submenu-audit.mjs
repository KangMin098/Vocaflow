// scripts/admin/submenu-audit.mjs
// Proposal coverage only. Never executes an application action or contacts a database.
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const require = createRequire(import.meta.url)
const ts = require(require.resolve('typescript', { paths: [path.join(root, 'apps/web')] }))
const planDir = 'docs/admin-restructure'
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const sha = file => createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex')
const walk = dir => fs.readdirSync(path.join(root, dir), { withFileTypes: true })
  .flatMap(entry => entry.name === '__tests__' ? [] : entry.isDirectory()
    ? walk(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`])

// These three navigation data modules have no runtime dependencies outside this allowlist.
// A new dependency fails explicitly, rather than importing a server/client application module.
const moduleFiles = new Map([
  ['@/lib/admin/navigation', 'apps/web/src/lib/admin/navigation.ts'],
  ['@/lib/csat/factory-plain', 'apps/web/src/lib/csat/factory-plain.ts'],
  ['@/lib/knowledge/vnext-labels', 'apps/web/src/lib/knowledge/vnext-labels.ts'],
])
const cache = new Map()
function loadNavigation(specifier) {
  if (cache.has(specifier)) return cache.get(specifier)
  const file = moduleFiles.get(specifier)
  if (!file) throw new Error(`Navigation dependency is not allowlisted: ${specifier}`)
  const module = { exports: {} }
  const output = ts.transpileModule(read(file), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    fileName: file,
  }).outputText
  const run = new vm.Script(`(function(exports,require,module){${output}\n})`, { filename: file })
    .runInNewContext({}, { timeout: 1000 })
  run(module.exports, loadNavigation, module)
  cache.set(specifier, module.exports)
  return module.exports
}

function originalNavigation(baseline) {
  const file = 'apps/web/src/components/admin/AdminSidebar.tsx'
  const body = execFileSync('git', ['show', `${baseline}:${file}`], { cwd: root, encoding: 'utf8' })
  const ast = ts.createSourceFile(file, body, ts.ScriptTarget.Latest, true)
  const get = (obj, key) => obj.properties?.find(p => ts.isPropertyAssignment(p) && p.name.getText(ast) === key)?.initializer
  const atom = node => !node ? null : ts.isStringLiteralLike(node) ? node.text : node.getText(ast)
  let array
  const visit = node => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === 'buildNavGroups') {
      array = node.body.statements.find(ts.isReturnStatement)?.expression
    }
    ts.forEachChild(node, visit)
  }
  visit(ast)
  if (!array || !ts.isArrayLiteralExpression(array)) throw new Error('Original navigation shape changed')
  const item = obj => ({ label: atom(get(obj, 'label')), href: atom(get(obj, 'href')),
    children: get(obj, 'children')?.elements?.map(item) ?? [] })
  return array.elements.map(obj => ({ group: atom(get(obj, 'label')), items: get(obj, 'items').elements.map(item) }))
}

export function audit() {
  const plan = JSON.parse(read(`${planDir}/submenu-plan.json`))
  const snapshot = JSON.parse(read(`${planDir}/source-inventory.json`))
  const permissions = JSON.parse(read(`${planDir}/action-guard-index.json`))
  const nav = loadNavigation('@/lib/admin/navigation')
  const original = originalNavigation(plan.baseline)
  const oldLinks = original.flatMap(group => group.items.flatMap(item => [item, ...item.children]
    .map(link => ({ group: group.group === 'null' ? '대시보드' : group.group, label: link.label, href: link.href }))))
  const errors = []
  const check = (condition, message) => { if (!condition) errors.push(message) }
  const actual = walk('apps/web/src/app/admin').filter(file => file.endsWith('/page.tsx'))
    .map(file => ({ file, route: file.slice('apps/web/src/app'.length).replace('/page.tsx', '') }))
    .sort((a, b) => a.route.localeCompare(b.route, 'en'))
  const spaces = new Map()
  const sections = new Set()
  for (const section of plan.sections) {
    check(!sections.has(section.id), `Duplicate section: ${section.id}`)
    sections.add(section.id)
    for (const space of section.workspaces) {
      check(!spaces.has(space.id), `Duplicate workspace: ${space.id}`)
      spaces.set(space.id, { ...space, section: section.id })
    }
  }
  const entries = new Map()
  for (const entry of plan.routes) {
    check(!entries.has(entry.route), `Duplicate route: ${entry.route}`)
    entries.set(entry.route, entry)
    check(spaces.has(entry.workspace) || (entry.route === '/admin' && entry.workspace === null), `Unknown workspace: ${entry.route}`)
    check(sections.has(entry.section), `Unknown section: ${entry.route}`)
    check(entry.route !== '/admin' || (entry.section === 'home' && entry.workspace === null), 'Home owner must be home with no workspace')
    check(entry.workspace === null || spaces.get(entry.workspace)?.section === entry.section, `Owner mismatch: ${entry.route}`)
    check(['retain', 'move', 'detail', 'alias'].includes(entry.disposition), `Unknown disposition: ${entry.route}`)
    check(entry.status === 'proposed', `Proposal must not claim implementation: ${entry.route}`)
    check(actual.some(page => page.route === entry.target.split(/[?#]/)[0]), `Target page missing: ${entry.route}`)
    const current = nav.getAdminLocation(entry.route)
    check(current?.section.id === entry.v1.section && (current?.workspace?.id ?? null) === entry.v1.workspace, `v1 mapping stale: ${entry.route}`)
    check(entry.evidence.length > 0 && entry.evidence.every(file => fs.existsSync(path.join(root, file))), `Evidence missing: ${entry.route}`)
    const old = oldLinks.filter(link => entry.route === link.href || (link.href !== '/admin' && entry.route.startsWith(`${link.href}/`)))
      .sort((a, b) => b.href.length - a.href.length)[0] ?? null
    check(Boolean(old) === Boolean(entry.original), `Original owner presence mismatch: ${entry.route}`)
    if (old) {
      check(['group', 'label', 'href'].every(key => old[key] === entry.original?.[key]), `Original owner stale: ${entry.route}`)
      check(entry.original?.derived === (old.href === entry.route ? 'direct' : 'prefix'), `Original link type missing: ${entry.route}`)
    }
    if (entry.disposition === 'alias') {
      const ast = ts.createSourceFile(entry.file, read(entry.file), ts.ScriptTarget.Latest, true)
      let destination = null
      const visit = node => {
        if (ts.isCallExpression(node) && node.expression.getText(ast) === 'redirect') {
          let arg = node.arguments[0]
          if (arg && ts.isCallExpression(arg) && arg.expression.getText(ast) === 'adminCompatibilityHref') arg = arg.arguments[0]
          if (arg && ts.isStringLiteralLike(arg)) destination = arg.text
        }
        ts.forEachChild(node, visit)
      }
      visit(ast)
      check(destination === entry.target, `Alias query/hash target mismatch: ${entry.route}`)
    }
  }
  for (const page of actual) {
    check(entries.has(page.route), `Unmapped real page: ${page.route}`)
    check(entries.get(page.route)?.file === page.file, `Page source mismatch: ${page.route}`)
  }
  for (const route of entries.keys()) check(actual.some(page => page.route === route), `Removed real page: ${route}`)
  for (const section of plan.sections) for (const space of section.workspaces) {
    check(actual.some(page => page.route === space.entry.split(/[?#]/)[0]), `Workspace entry missing: ${space.id}`)
    check(plan.routes.some(entry => entry.workspace === space.id), `Empty workspace: ${space.id}`)
    check(plan.routes.find(entry => entry.route === space.entry.split(/[?#]/)[0])?.disposition !== 'detail', `Workspace entry classified as detail: ${space.id}`)
  }
  const observed = new Set()
  for (const file of snapshot.files) {
    check(!observed.has(file.file), `Duplicate observed file: ${file.file}`)
    observed.add(file.file)
    check(fs.existsSync(path.join(root, file.file)) && sha(file.file) === file.sha256, `Source snapshot stale: ${file.file}`)
  }
  for (const page of actual) check(observed.has(page.file), `Page absent from source snapshot: ${page.file}`)
  const candidates = [...new Set([...walk('apps/web/src/app/admin'), ...snapshot.files
    .map(item => item.file).filter(file => file.startsWith('apps/web/src/lib/'))])].filter(file => /\.tsx?$/.test(file))
  const actionFiles = candidates.filter(file => {
    const ast = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true)
    return ast.statements.some(statement => ts.isExpressionStatement(statement)
      && ts.isStringLiteral(statement.expression) && statement.expression.text === 'use server')
  })
  const recordedActions = new Set(permissions.modules.map(item => item.file))
  check(recordedActions.size === permissions.modules.length, 'Duplicate action module')
  for (const file of actionFiles) check(recordedActions.has(file), `Action module unrecorded: ${file}`)
  for (const item of [...permissions.modules, ...permissions.supplementalEvidence]) {
    check(fs.existsSync(path.join(root, item.file)) && sha(item.file) === item.sha256, `Permission evidence stale: ${item.file}`)
  }
  for (const item of permissions.modules) check(actionFiles.includes(item.file), `Action module removed: ${item.file}`)
  check(snapshot.baseline === plan.baseline, 'Source/proposal baselines differ')
  const summary = {
    baseline: plan.baseline,
    realPages: actual.length,
    mappedPages: entries.size,
    observedSourceFiles: snapshot.files.length,
    actionModules: permissions.modules.length,
    actionDeclarations: permissions.modules.reduce((n, item) => n + item.actions.length, 0),
    permissionReviewPending: permissions.modules.flatMap(item => item.actions).filter(action => action.guard.startsWith('unconfirmed')).length,
    original: { groups: original.length, rootLinks: original.reduce((n, g) => n + g.items.length, 0),
      childLinks: original.reduce((n, g) => n + g.items.reduce((m, item) => m + item.children.length, 0), 0) },
    v1: { primary: nav.ADMIN_SECTIONS.length, secondary: nav.ADMIN_SECTIONS.reduce((n, s) => n + s.workspaces.length, 0) },
    proposed: { primary: plan.sections.length, secondary: spaces.size },
    errors,
  }
  if (errors.length) throw new Error(JSON.stringify(summary, null, 2))
  if (process.argv.includes('--write')) {
    const names = new Map(plan.sections.map(section => [section.id, section.label]))
    const currentNames = new Map(nav.ADMIN_SECTIONS.flatMap(section => section.workspaces.map(space => [space.id, space.label])))
    const rows = actual.map(page => {
      const entry = entries.get(page.route)
      const name = spaces.get(entry.workspace)?.label ?? '작업 홈'
      const disposition = { retain: '소속 유지', move: '소속 변경', detail: '상세·생성 보존', alias: '호환 연결 유지' }[entry.disposition]
      const old = entry.original ? `${entry.original.group} / ${entry.original.label} (${entry.original.derived === 'direct' ? '직접 링크' : 'URL 접두사 추정'})` : '직접 메뉴 없음'
      return `| \`${entry.route}\` | ${old.replaceAll('|', '\\|')} | ${currentNames.get(entry.v1.workspace) ?? '작업 홈'} | ${names.get(entry.section)} / ${name} | ${entry.view} | ${disposition} |`
    })
    const output = ['# 관리자 전체 경로 이행표 — 제안, 미적용', '',
      '생성: `node scripts/admin/submenu-audit.mjs --write`. 입력: [submenu-plan.json](./submenu-plan.json).', '',
      `기준 HEAD \`${plan.baseline}\`. 실제 page.tsx ${actual.length}개를 한 번씩 배정했다. 상세·생성도 포함한 파일 수이며 메뉴 수가 아니다.`, '',
      '원래 main의 직접 메뉴는 30개, 펼침 자식 링크는 28개다. 로컬 v1은 7개 상위·26개 하위 작업 공간이며 v2 제안은 7개 상위·22개 하위 작업 공간이다. 서로 다른 탐색 층의 수를 같은 감축률로 비교하지 않는다.', '',
      '모든 기존 경로를 보존하는 제안이다. 아래 “보기”는 화면 재배치 계약이며 새 탭·조회·공통 기록이 구현됐다는 뜻이 아니다. 대상 URL·원래 메뉴 소속·근거 파일은 JSON에 있다. 원래 메뉴의 동적 라벨은 소스 표현식으로 기록했다.', '',
      '| 기존 경로 | 기준 main 메뉴 (직접/추정 구분) | 로컬 v1 하위 공간 | v2 제안 소속 | 제안 보기/용도 | 이행 |',
      '|---|---|---|---|---|---|', ...rows, '', '## 검사 결과', '', '```json', JSON.stringify(summary, null, 2), '```', ''].join('\n')
    fs.writeFileSync(path.join(root, planDir, 'route-map.md'), output)
  }
  return summary
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(audit(), null, 2)) }
  catch (error) { console.error(error.message); process.exitCode = 1 }
}
