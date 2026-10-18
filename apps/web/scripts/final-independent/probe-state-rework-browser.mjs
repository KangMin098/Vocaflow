// apps/web/scripts/final-independent/probe-state-rework-browser.mjs
// Actual browser IndexedDB/store retry + actual local API/PostgreSQL, synthetic auth/gate.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { stateHarness, NOW } from './probe-state-rework-http.mjs'

const root = path.resolve(import.meta.dirname, '../../../..')
const meta = JSON.parse(fs.readFileSync(path.join(root, '.agent-logs/final-independent/rework-snapshot.json'), 'utf8'))
const req = createRequire(path.join(root, 'apps/web/package.json'))
const { build } = createRequire(createRequire(req.resolve('vitest/package.json')).resolve('vite'))('esbuild')
const { chromium } = req('@playwright/test')
const h = await stateHarness(), browser = await chromium.launch()
const errors = [], external = []
try {
  const built = await build({ stdin: { contents: "import * as store from './apps/web/src/lib/csat/session/store';window.store=store", resolveDir: meta.snapshot, loader: 'ts' }, bundle: true, write: false, platform: 'browser', format: 'iife', tsconfig: path.join(meta.snapshot, 'apps/web/tsconfig.json') })
  h.fixture.assets.set('/bundle.js', { type: 'application/javascript', body: built.outputFiles[0].contents })
  h.fixture.assets.set('/client.html', { type: 'text/html', body: '<!doctype html><meta charset="utf-8"><script src="/bundle.js"></script>' })
  const contexts = await Promise.all([browser.newContext(), browser.newContext()])
  const pages = await Promise.all(contexts.map(context => context.newPage()))
  const payloads = ['browser-one', 'browser-two'].map(unitId => h.api.withView({ version: 1, seed: 1, onboarded: true, predictions: [], formulas: [], queue: [], completed: [], meaningNotes: [h.api.writeMeaningNote(null, { item: 'SYNTHETIC#1', unitId, text: 'Synthetic browser note ' + unitId, binding: { analysisVersion: 1, contentHash: 'aaaaaaaaaaaaaaaa' } }, NOW)], updatedAt: NOW }, 'SYNTHETIC#1', NOW))
  for (const page of pages) {
    page.on('pageerror', error => errors.push(error.message))
    await page.clock.install({ time: new Date(NOW) })
    await page.route('**/*', route => {
      if (!route.request().url().startsWith(h.base)) { external.push(route.request().url()); return route.abort() }
      return route.continue()
    })
    await page.goto(h.base + '/client.html'); await page.waitForFunction(() => !!window.store)
  }
  h.beginBarrier()
  await Promise.all(pages.map((page, i) => page.evaluate(record => window.store.saveDissectionRecord(record), payloads[i])))
  await Promise.all(pages.map(page => page.clock.runFor(1600)))
  const until = async predicate => { for (let i = 0; i < 200; i++) { if (await predicate()) return; await new Promise(resolve => setTimeout(resolve, 20)) } throw Error('Expected local API/storage event missing') }
  await until(() => h.fixture.httpStatuses.filter(r => r.method === 'PUT').length >= 2)
  h.fixture.barrier = false
  const initialStatuses = h.fixture.httpStatuses.filter(r => r.method === 'PUT').slice(0, 2).map(r => r.status).sort()
  assert.deepEqual(initialStatuses, [200, 409])
  await Promise.all(pages.map(page => page.clock.runFor(3100)))
  await until(async () => (await h.get()).meaningNotes?.length === 2)
  const stored = await h.get(), local = await Promise.all(pages.map(page => page.evaluate(async () => ({ record: await window.store.loadDissectionRecord(), sync: window.store.syncStatus() }))))
  assert.deepEqual(stored.meaningNotes.map(n => n.unitId).sort(), ['browser-one', 'browser-two'])
  for (let i = 0; i < local.length; i++) { assert.ok(local[i].record.meaningNotes.some(n => n.unitId === payloads[i].meaningNotes[0].unitId)); assert.ok(local[i].sync.okAt !== null) }
  assert.deepEqual(errors, []); assert.deepEqual(external, [])
  const third = await browser.newContext(), page = await third.newPage()
  await page.clock.install({ time: new Date(NOW) })
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/*', route => {
    if (!route.request().url().startsWith(h.base)) { external.push(route.request().url()); return route.abort() }
    return route.continue()
  })
  await page.goto(h.base + '/client.html'); await page.waitForFunction(() => !!window.store)
  h.fixture.forceConflicts = true
  const start = h.fixture.httpStatuses.filter(r => r.method === 'PUT').length
  await page.evaluate(record => window.store.saveDissectionRecord(record), payloads[0])
  for (const [i, delay] of [1600, 3100, 6100, 12100, 24100, 24100].entries()) {
    await page.clock.runFor(delay)
    await until(() => h.fixture.httpStatuses.filter(r => r.method === 'PUT').length >= start + i + 1)
  }
  await until(async () => (await page.evaluate(() => window.store.syncStatus())).failAt !== null)
  await page.clock.runFor(60000)
  assert.equal(h.fixture.httpStatuses.filter(r => r.method === 'PUT').length - start, 6)
  const failed = await page.evaluate(async () => ({ record: await window.store.loadDissectionRecord(), sync: window.store.syncStatus() }))
  assert.equal(failed.sync.okAt, null); assert.ok(failed.sync.failAt !== null)
  assert.equal(failed.record.meaningNotes[0].unitId, 'browser-one')
  h.fixture.forceConflicts = false
  await page.evaluate(record => window.store.saveDissectionRecord(record), payloads[0])
  await page.clock.runFor(1600)
  await until(async () => (await page.evaluate(() => window.store.syncStatus())).okAt !== null)
  assert.equal(h.fixture.httpStatuses.filter(r => r.method === 'PUT').length - start, 7)
  const report = { head: meta.head, pr250: meta.pr250, integrationScope: meta.integrationScope, level: 'ISOLATED_BROWSER_VERIFIED', contexts: 3, initialStatuses, finalServerNotes: stored.meaningNotes.map(n => n.unitId).sort(), eachDeviceRetainsOwnIndexedDbNote: true, retryUsedActualStoreTimer: true, boundedRetry: { requests: 6, additionalAfterOneMinute: 0, retainsIndexedDb: true, falseSuccess: false, newSaveResetsAndSucceeds: true }, runtimeErrors: errors.length, externalRequests: external.length, storeSha256: createHash('sha256').update(fs.readFileSync(path.join(meta.snapshot, 'apps/web/src/lib/csat/session/store.ts'))).digest('hex'), scope: 'Actual browser store/IndexedDB timers + actual frozen HTTP state API + PostgreSQL17.10; synthetic login/Reveal Gate. No full theater/shell, actual dev DB/JWT, Gold approval or actual learner effect.' }
  fs.writeFileSync(path.join(root, 'docs/research/final-independent-20261018/state-rework-browser.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({ head: meta.head, initialStatuses, finalNotes: stored.meaningNotes.length, allPassed: true }))
} finally { await browser.close(); await h.close() }
