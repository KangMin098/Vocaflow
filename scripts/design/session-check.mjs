// scripts/design/session-check.mjs
//
// 세션 공통 조작을 **모듈별 실제 계약**대로 실행한다 — learner-tines-audit S3 ③ · S4.
//
// 처음 판(S3)은 모든 모듈에 「Space = 학습 동작 · Esc = 복귀」를 요구했다. 실제 계약은 모듈마다 다르다:
//   · Esc — 세션 틀(SessionFrame)이 앱에서 Esc 를 듣는 유일한 곳이고, 모듈이 `useSessionEscape` 로 등록하면 모듈이 먼저 쓴다.
//           SpellForge 는 「단어 건너뛰기」로 등록(v08.7 [B1] — 한 번의 Esc 가 건너뛰기와 종료를 동시에 하던 결함의 수정),
//           단어장 학습·복습은 「저장 후 종료」로 등록, 나머지는 틀이 복귀시킨다.
//   · Space — 플래시카드(카드 뒤집기 · `FlashcardSession` phase=flippable) · 단어장 학습(뜻 → 예문 공개)만 계약이다.
//           ScriptQuiz · PairFlip · 구문 연습은 Space 계약이 없다(누르기·고르기로 진행).
// 그래서 페이지마다 계약을 넘긴다: "id|경로|복귀주소|esc(exit|skip)|space(yes|no)".
// 주소 변화는 최대 30초 기다린다 — 3.5초 고정 대기는 dev 서버 첫 컴파일을 「안 움직임」으로 쟀다(S3 PairFlip 미확인의 유력 원인).
// 기록(평가 1~5 등 FSRS 쓰기)은 하지 않는다 — 공유 검증 계정의 학습 데이터를 바꾸지 않는다.
// 사용: node scripts/design/session-check.mjs --base http://localhost:3041 --out <dir> --page "id|/path?q|/close|exit|yes" ...

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const require_ = createRequire(path.join(ROOT, 'apps/web/package.json'))
const { chromium } = require_('@playwright/test')
const args = process.argv.slice(2)
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : fallback
}
const BASE = arg('base', 'http://localhost:3041')
const outDir = path.resolve(ROOT, arg('out', 'tmp/s3/session-check'))
const width = Number(arg('width', '1440'))
const pages = args.flatMap((a, i) => (a === '--page' ? [args[i + 1]] : [])).map((s) => {
  const [id, url, close, esc = 'exit', space = 'no'] = s.split('|')
  return { id, url, close, esc, space: space === 'yes' }
})
const STATE_FILE = path.join(ROOT, 'apps/web/playwright-auth/.auth-design-capture.json')

// 글자만 비교하면 앞뒤 면이 이미 DOM 에 있는 카드 뒤집기를 못 본다(S4 실측) — 본문 DOM 전체(클래스·속성 포함)를 비교한다
const mainText = (p) => p.evaluate(() => document.querySelector('main')?.innerHTML ?? '')

const run = async () => {
  fs.mkdirSync(outDir, { recursive: true })
  const browser = await chromium.launch()
  const results = []
  for (const pg of pages) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', ...(fs.existsSync(STATE_FILE) ? { storageState: STATE_FILE } : {}) })
    const p = await ctx.newPage()
    const row = { id: pg.id, url: pg.url, contract: { esc: pg.esc, space: pg.space }, base: BASE, width, at: new Date().toISOString() }
    try {
      await p.goto(`${BASE}${pg.url}`, { waitUntil: 'domcontentloaded', timeout: 120_000 })
      await p.waitForTimeout(6000)
      row.landed = new URL(p.url()).pathname
      const info = await p.evaluate(() => {
        const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && r.top < innerHeight }
        const name = (e) => (e.getAttribute('aria-label') || e.textContent || '').trim().replace(/\s+/g, ' ')
        const exits = [...document.querySelectorAll('a, button')].filter(vis).filter((e) => /세션 닫기|닫기|종료|나가기/.test(name(e)) && !/설정/.test(name(e)))
          .map((e) => { const r = e.getBoundingClientRect(); return { name: name(e).slice(0, 30), href: e.getAttribute('href'), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } })
        // 전역 헤더 = 「Today」 메뉴나 로고가 있는 맨 위 header (세션 틀의 닫기 링크도 /hub 를 가리킬 수 있어 href 로는 못 가린다)
        const appHeader = Boolean([...document.querySelectorAll('header')].find((h) => vis(h) && [...h.querySelectorAll('a')].some((a) => a.textContent.trim() === 'Today' || a.textContent.includes('Vocaflow')) && h.getBoundingClientRect().top < 5))
        return { exits, appHeader }
      })
      row.appHeader = info.appHeader
      row.exits = info.exits
      await p.screenshot({ path: path.join(outDir, `${pg.id}@${width}-start.png`) })
      // 포커스를 본문 바깥(문서)으로 — 입력칸 포커스면 Space 가 글자가 된다
      await p.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : null))
      if (pg.space) {
        const before = await mainText(p)
        await p.keyboard.press('Space')
        await p.waitForTimeout(1200)
        row.spaceChanged = (await mainText(p)) !== before
        await p.screenshot({ path: path.join(outDir, `${pg.id}@${width}-space.png`) })
      }
      const beforeEsc = await mainText(p)
      // SpellForge 의 건너뛰기는 확인 창(window.confirm)을 먼저 띄운다. 「확인」은 FSRS 오답 기록을 쌓으므로(공유 계정 학습 데이터)
      // 누르지 않는다 — 창이 떴는지와 문구만 확인하고 「취소」한다.
      const dialogs = []
      p.on('dialog', async (d) => { dialogs.push(d.message()); await d.dismiss().catch(() => {}) })
      await p.keyboard.press('Escape')
      if (pg.esc === 'exit') {
        await p.waitForURL((u) => u.pathname !== row.landed, { timeout: 30_000 }).catch(() => {})
        row.afterEsc = new URL(p.url()).pathname
        row.escOk = row.afterEsc === pg.close
      } else {
        // skip — 세션에 머물고 화면 내용(단어)이 바뀐다
        await p.waitForTimeout(1500)
        row.afterEsc = new URL(p.url()).pathname
        row.escDialog = dialogs[0] ?? null
        row.escOk = row.afterEsc === row.landed && /건너뛸까요/.test(row.escDialog ?? '')
      }
      row.ok = !row.appHeader && row.exits.length === 1 && row.exits[0].x > width - 120 && row.exits[0].h >= 44 && row.escOk && (!pg.space || row.spaceChanged)
    } catch (e) {
      row.ok = false
      row.error = String(e).slice(0, 140)
    }
    process.stdout.write(`${row.ok ? '✓' : '✗'} ${pg.id} ${JSON.stringify({ contract: row.contract, appHeader: row.appHeader, exits: row.exits?.map((e) => [e.name, e.x, e.y, e.h]), space: row.spaceChanged, esc: row.afterEsc, escDialog: row.escDialog, error: row.error })}\n`)
    results.push(row)
    await ctx.close()
  }
  await browser.close()
  fs.writeFileSync(path.join(outDir, `_sessions@${width}.json`), JSON.stringify({ sha: arg('sha', 'unknown'), results }, null, 2))
  console.log(`\n${results.filter((r) => r.ok).length}/${results.length}`)
}

run().catch((e) => { console.error(e); process.exit(1) })
