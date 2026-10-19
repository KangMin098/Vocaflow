// scripts/design/tines-ref-shots.mjs — tines.com 대표 5페이지를 1440 으로 찍는다(쿠키 창은 Reject all). 산출 tmp/s8/tines/<page>-<0..2>.png
import path from 'node:path'
import { createRequire } from 'node:module'
const require_ = createRequire('D:/workspace/Vocaflow-learner-tines-audit/apps/web/package.json')
const { chromium } = require_('@playwright/test')
const out = 'D:/workspace/Vocaflow-learner-tines-audit/tmp/s8/tines'
const pages = { home: '/', library: '/library/', customers: '/customers/', product: '/product/', university: '/university/' }
const b = await chromium.launch()
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
for (const [k, u] of Object.entries(pages)) {
  try {
    await p.goto('https://www.tines.com' + u, { waitUntil: 'networkidle', timeout: 60000 })
    await p.waitForTimeout(2000); await p.getByRole('button',{name:'Reject all'}).click({timeout:5000}).catch(()=>{}); await p.waitForTimeout(800)
    for (let i = 0; i < 3; i++) {
      await p.evaluate((y) => window.scrollTo(0, y), i * 900)
      await p.waitForTimeout(900)
      await p.screenshot({ path: path.join(out, `${k}-${i}.png`) })
    }
    console.log('ok', k)
  } catch (e) { console.log('fail', k, String(e).slice(0, 80)) }
}
await b.close()
