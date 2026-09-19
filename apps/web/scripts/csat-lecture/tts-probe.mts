// apps/web/scripts/csat-lecture/tts-probe.mts
//
// **Gate 0 하네스** — 진짜 Chrome·Edge 에서 `/dev/tts-probe?auto=1` 을 돌리고
// `docs/csat-lecture/tts-probe-report.json` 을 쓴다. 읽기 전용(DB 를 건드리지 않는다).
//
//   npx tsx scripts/csat-lecture/tts-probe.mts            (소리 끔)
//   npx tsx scripts/csat-lecture/tts-probe.mts --audible  (소리 켬)
//
// PASS = 재 본 브라우저 **전부** 가 ko-KR 음성 · 유실 0 · 큐 간 지연 < 400ms.

import fs from 'node:fs'
import path from 'node:path'

import { launchReal, type BrowserName } from './real-browser.mts'

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'
const OUT = path.resolve('../../docs/csat-lecture/tts-probe-report.json')
const muted = !process.argv.includes('--audible')

const results: Record<string, unknown>[] = []
for (const name of ['chrome', 'edge'] as BrowserName[]) {
  const { browser, close } = await launchReal(name, { muted })
  try {
    const ctx = browser.contexts()[0]
    const page = ctx.pages()[0] ?? (await ctx.newPage())
    await page.goto(`${BASE}/dev/tts-probe?auto=1`, { waitUntil: 'domcontentloaded', timeout: 180_000 })
    await page.waitForFunction(() => (window as unknown as { __TTS_PROBE__?: unknown }).__TTS_PROBE__, null, {
      timeout: 300_000,
      polling: 1000,
    })
    const r = (await page.evaluate(() => (window as unknown as { __TTS_PROBE__: Record<string, unknown> }).__TTS_PROBE__)) as Record<string, unknown>
    results.push({ browser: name, muted, ...r })
    console.log(name, r.pass ? 'PASS' : 'FAIL', JSON.stringify(r.reasons), JSON.stringify(r.sequence ?? {}))
  } catch (e) {
    results.push({ browser: name, muted, pass: false, reasons: [String(e).slice(0, 300)] })
    console.log(name, 'ERROR', String(e).slice(0, 300))
  } finally {
    await close()
  }
}

const pass = results.length > 0 && results.every((r) => r.pass === true)
fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(
  OUT,
  JSON.stringify({ gate: 0, measuredAt: new Date().toISOString(), pass, browsers: results }, null, 2) + '\n',
)
console.log(`Gate 0 ${pass ? 'PASS' : 'FAIL'} → ${OUT}`)
process.exit(pass ? 0 : 1)
