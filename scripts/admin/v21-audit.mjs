// scripts/admin/v21-audit.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadNavigation } from './submenu-audit.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const plan = JSON.parse(read('docs/admin-restructure/submenu-plan.json'))
const nav = loadNavigation('@/lib/admin/navigation')
const walk = dir => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(entry =>
  entry.name === '__tests__' ? [] : entry.isDirectory() ? walk(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`])
const pages = walk('apps/web/src/app/admin').filter(file => file.endsWith('/page.tsx'))
const errors = []
const rows = []
for (const file of pages) {
  const route = file.slice('apps/web/src/app'.length).replace('/page.tsx', '')
  const proposed = plan.routes.filter(entry => entry.route === route)
  const actual = nav.getAdminLocation(route)
  if (proposed.length !== 1 || !actual || actual.section.id !== proposed[0]?.section ||
    (actual.workspace?.id ?? null) !== proposed[0]?.workspace) errors.push(`Missing/wrong owner: ${route}`)
  rows.push({ route, section: actual?.section.label, workspace: actual?.workspace?.label ?? null,
    navigation: 'applied', processing: 'existing_domain_engine', plannedView: proposed[0]?.view ?? null })
}
for (const entry of plan.routes) if (!rows.some(row => row.route === entry.route)) errors.push(`Removed page: ${entry.route}`)
for (const section of nav.ADMIN_SECTIONS) for (const link of [section, ...section.workspaces,
  ...section.workspaces.flatMap(space => space.tools ?? []), ...(section.utilities ?? [])]) {
  if (!fs.existsSync(path.join(root, 'apps/web/src/app', nav.adminPath(link.href), 'page.tsx'))) errors.push(`Missing destination: ${link.href}`)
}
const secondary = nav.ADMIN_SECTIONS.reduce((sum, section) => sum + section.workspaces.length, 0)
if (nav.ADMIN_SECTIONS.length !== 7 || secondary !== 22) errors.push('Expected 7/22 navigation')
for (const file of ['apps/web/src/app/admin/kice/page.tsx', 'apps/web/src/app/admin/kice/plan/page.tsx', 'apps/web/src/app/admin/kice/plan/PlanList.tsx']) {
  if (/loadMyTraps|csat_trap_attempts|내 약한 것 먼저/.test(read(file))) errors.push(`Personal history in shared analysis: ${file}`)
}
const result = { pages: pages.length, mapped: rows.length, primary: nav.ADMIN_SECTIONS.length, secondary, errors }
if (errors.length) { console.error(JSON.stringify(result, null, 2)); process.exitCode = 1 }
else {
  if (process.argv.includes('--write')) fs.writeFileSync(path.join(root, 'docs/admin-restructure/v21-route-support.json'),
    JSON.stringify({ version: 'v2.1', note: 'Navigation applied; plannedView is the v2 design, not an assertion every internal panel is implemented. See v21-delivery.md for actual flow support and gaps.', rows }, null, 2) + '\n')
  console.log(JSON.stringify(result, null, 2))
}
