// verification/reviews/T-0072-r1-independent/prepare-browser.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const dir = path.dirname(fileURLToPath(import.meta.url))
const source = 'C:/Users/ADMINI~1/AppData/Local/Temp/claude/d--workspace-Vocaflow/c513ff5b-86ef-44a3-8efd-7925a229614b/scratchpad/t0072-browser'
for (const name of ['main.tsx', 'nav.ts', 'index.html']) fs.copyFileSync(path.join(source, name), path.join(dir, name))
let runner = fs.readFileSync(path.join(source, 'run.mjs'), 'utf8')
const marker = '} finally {'
if (!runner.includes(marker)) throw new Error('Missing browser protocol boundary')
runner = runner.replace(marker, `
  {
    const x = await open('goal=11')
    await x.page.evaluate(() => { window.__refresh = () => {} })
    await x.page.locator('[data-testid="plan-save"]').click()
    await x.page.waitForTimeout(300)
    const after = await state(x.page)
    results.push({ case: 'Independent: successful POST without current server refetch stays unconfirmed', passed: x.posts.length === 1 && after !== 'saved', after, posts: x.posts.length })
    await x.page.close()
  }
  {
    const x = await open('goal=11')
    await x.page.unroute('**/api/csat/diagnosis/map/plan')
    await x.page.route('**/api/csat/diagnosis/map/plan', async route => {
      x.posts.push(JSON.parse(route.request().postData()))
      await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ code: 'goal_changed' }) })
    })
    await x.page.locator('[data-testid="plan-save"]').click()
    await x.page.waitForSelector('[data-testid="plan-conflict"]')
    const after = await state(x.page)
    results.push({ case: 'Independent: goal CAS conflict never claims saved', passed: after !== 'saved' && x.posts.length === 1, after, posts: x.posts.length })
    await x.page.close()
  }
  {
    const x = await open('goal=11')
    await x.page.locator('[data-testid="plan-reason"]').selectOption('learner_adjust')
    await x.page.locator('[data-testid="plan-save"]').click()
    await x.page.waitForFunction(() => document.querySelector('[data-testid="plan-save-state"]')?.getAttribute('data-state') === 'saved')
    const body = x.posts[0]
    results.push({ case: 'Independent: explicit user reason survives default goal reason', passed: body?.reason === 'learner_adjust' && body.expectedGoalVersion === 11 && body.expectedVersion === 2, body: { reason: body?.reason, expectedGoalVersion: body?.expectedGoalVersion, expectedVersion: body?.expectedVersion } })
    await x.page.close()
  }
  {
    const x = await open('goal=11')
    const notice = await x.page.locator('[data-testid="plan-drift"]').textContent().catch(() => null)
    results.push({ case: 'Observation only: content-drift notice on goal-only change', passed: true, observation: notice, severity: 'P2', blocking: false })
    await x.page.close()
  }
} finally {`)
runner = runner.replace("passed: results.filter((r) => r.passed).length, failed: results.filter((r) => !r.passed).length", "passed: results.filter((r) => r.passed && !r.observation).length, failed: results.filter((r) => !r.passed).length, observations: results.filter((r) => r.observation).length")
fs.writeFileSync(path.join(dir, 'run.mjs'), runner)
console.log('Independent protocol prepared; original artifact remains unchanged')
