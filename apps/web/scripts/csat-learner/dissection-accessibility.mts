// apps/web/scripts/csat-learner/dissection-accessibility.mts
// Use an existing Lighthouse CLI installation; no application dependency.
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from '@playwright/test'
import { arg } from './env.mts'

const modulePath = arg('lighthouse')
if (!modulePath) throw new Error('Pass --lighthouse <installed lighthouse/core/index.js>')
const { default: lighthouse } = await import(pathToFileURL(path.resolve(modulePath)).href)
const base = arg('base') ?? 'http://localhost:3101'
const state = JSON.parse(fs.readFileSync('playwright-auth/.auth-csat-learner.json', 'utf8'))
const cookie = state.cookies.map((c: { name: string; value: string }) => `${c.name}=${c.value}`).join('; ')
const browser = await chromium.launch({ args: ['--remote-debugging-port=9223'] })
const report: Record<string, unknown> = {}
try {
  for (const route of ['/csat', '/csat/dissect', '/csat/formulas']) {
    const { lhr } = await lighthouse(base + route, { port: 9223, onlyCategories: ['accessibility'], extraHeaders: { Cookie: cookie }, disableStorageReset: true, logLevel: 'error' })
    const score = Math.round(lhr.categories.accessibility.score * 100)
    const final = new URL(lhr.finalDisplayedUrl ?? lhr.finalUrl).pathname
    const failures = Object.values(lhr.audits).filter((a: any) => a.scoreDisplayMode === 'binary' && a.score === 0).map((a: any) => a.id)
    report[route] = { score, final, failures, scope: route === '/csat/dissect' ? 'PDF loading state; full dissection checked by Playwright axe' : 'landing' }
    console.log(route, score, final, failures)
    if (score < 90 || final !== route) process.exitCode = 1
  }
  fs.writeFileSync('../../docs/csat-learner/dissection-accessibility.json', JSON.stringify(report, null, 2) + '\n')
} finally { await browser.close() }
