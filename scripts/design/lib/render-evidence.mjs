// scripts/design/lib/render-evidence.mjs
// Successful rendered evidence is separate from source inspection, redirects and isolated fixtures.
import fs from 'node:fs'
import path from 'node:path'

export function routeInventory(appDir) {
  const out = []
  function walk(dir, segments) {
    if (fs.existsSync(path.join(dir, 'page.tsx'))) {
      const route = '/' + segments.join('/')
      out.push({ route, file: path.join(dir, 'page.tsx') })
    }
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || ['api', 'admin', 'dev'].includes(entry.name) || entry.name.startsWith('_')) continue
      walk(path.join(dir, entry.name), entry.name.startsWith('(') ? segments : [...segments, entry.name])
    }
  }
  walk(appDir, [])
  return out.sort((a, b) => a.route.localeCompare(b.route))
}

export function matchRoute(pathname, inventory) {
  const exact = inventory.find(r => r.route === pathname)
  if (exact) return exact.route
  for (const { route } of inventory) {
    const pattern = route.split('/').map(segment => segment.startsWith('[...') ? '.+' : segment.startsWith('[') ? '[^/]+' : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('/')
    if (new RegExp(`^${pattern}/?$`).test(pathname)) return route
  }
  return null
}

export function reportEvidence(report, { file, current = false } = {}) {
  const rows = Array.isArray(report) ? report : report.renders ?? report.rows ?? report.results ?? []
  return rows.flatMap(row => {
    // A failed check with measurements is still a failure. Unknown success is not a pass.
    const passed = row.ok === true || (row.ok == null && row.status === 200 && !!row.m?.h1)
    if (!passed || row.error || row.errorLike || row.loadingLike || row.overflow || row.status >= 400) return []
    const headings = [row.h1, ...(row.headings ?? []), row.m?.h1?.text].filter(v => typeof v === 'string')
    if (row.normalContent === false || row.accessGate === true || headings.some(h => h.trim() === '이 초대 링크는 확인할 수 없어요')) return []
    const raw = row.landed ?? row.pathname ?? row.url
    // Catalogue harnesses explicitly verify pathname before recording route/ok.
    const destination = raw ?? (report.scope?.startsWith('real public routes') ? row.route : null)
    if (!destination) return []
    const url = new URL(destination, 'http://localhost')
    if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return []
    const requested = row.route && new URL(row.route, 'http://localhost').pathname
    if (url.pathname === '/login' && requested && requested !== '/login') return []
    const isolated = /isolated|synthetic|fixture|격리/i.test([row.mode, report.scope, report.mode].filter(Boolean).join(' '))
    return [{ route: url.pathname, file, current, isolated, width: row.width ?? null, theme: row.theme ?? null, at: row.at ?? report.at ?? null }]
  })
}

export function summarizeCoverage(inventory, evidence) {
  return inventory.map(item => {
    const matches = evidence.filter(e => matchRoute(e.route, inventory) === item.route)
    const normal = matches.filter(e => !e.isolated)
    const current = normal.filter(e => e.current)
    const conditions = new Set(current.map(e => `${e.width}-${e.theme}`))
    return { ...item, historical: normal.length > 0, current: current.length > 0, fourConditions: ['1440-light', '1440-dark', '1280-light', '1280-dark'].every(key => conditions.has(key)), isolatedOnly: matches.length > 0 && !normal.length, evidence: [...new Set(matches.map(e => e.file))] }
  })
}
