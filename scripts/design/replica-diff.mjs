#!/usr/bin/env node
// scripts/design/replica-diff.mjs
//
// 복제가 참조와 얼마나 다른지 **잰다**(DD-62 Stage 2 완료 판정).
//
//   node scripts/design/replica-diff.mjs                     # 홈: 1440 · 375 픽셀 diff
//   node scripts/design/replica-diff.mjs --app               # 앱: 상자 위치 ±8px
//   node scripts/design/replica-diff.mjs --ours              # Stage 3: 3분할 시트 + 「구조·수치 변경 0」 검사
//   node scripts/design/replica-diff.mjs --base http://localhost:3000
//
// 판정:
//   홈 — 문구·그림 영역을 **양쪽 같은 마스크**로 가린 뒤 픽셀 차이 ≤ 2%
//   앱 — 상단바 높이 · 좌측 레일/패널 폭 · 캔버스 · 우측 인스펙터의 위치·크기 차이 ≤ 8px
//
// 마스크는 손으로 그리지 않는다 — computed.json 의 청사진에서 나온다. 그래야 "가려서 통과시키는" 일이 없다.
// 산출 이미지는 `docs/design/shots/replica/` 로 간다(이 폴더는 .gitignore — DD-47, 캡처는 커밋하지 않는다).

import fs from 'node:fs'
import path from 'node:path'
import { ROOT, VIEWPORTS, chromium, openRef, settle } from './lib/ref-page.mjs'

const argv = process.argv.slice(2)
const has = (k) => argv.includes(k)
const arg = (k, d) => {
  const i = argv.indexOf(k)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d
}

const BASE = arg('--base', 'http://localhost:3000')
const REF_HOME = arg('--ref', 'https://www.tines.com/')
const REF_APP = arg('--ref-app', 'https://www.tines.com/stories/storyboard/')
const OUT = path.resolve(ROOT, 'docs/design/shots/replica')
const REFS = path.resolve(ROOT, 'docs/design/refs/tines')
const THRESHOLD_PCT = Number(arg('--max-diff', '2'))
const BOX_TOLERANCE = Number(arg('--tolerance', '8'))

const computed = JSON.parse(fs.readFileSync(path.join(REFS, 'computed.json'), 'utf8'))
const appMeasured = JSON.parse(fs.readFileSync(path.join(REFS, 'app-measured.json'), 'utf8'))

fs.mkdirSync(OUT, { recursive: true })

// ── 브라우저 안에서 도는 비교기 ────────────────────────────────────────────
// 이미지 두 장을 캔버스에 올려 마스크를 칠하고 픽셀을 센다. 새 의존성을 들이지 않으려고
// node 쪽 이미지 라이브러리 대신 크로미움의 캔버스를 쓴다.
async function comparePngs(page, aDataUrl, bDataUrl, masks, tolerance) {
  return page.evaluate(
    async ({ aUrl, bUrl, masks, tol }) => {
      const load = (src) =>
        new Promise((res, rej) => {
          const im = new Image()
          im.onload = () => res(im)
          im.onerror = rej
          im.src = src
        })
      const [A, B] = await Promise.all([load(aUrl), load(bUrl)])
      const W = Math.min(A.width, B.width)
      const H = Math.min(A.height, B.height)

      const draw = (img) => {
        const c = document.createElement('canvas')
        c.width = W
        c.height = H
        const x = c.getContext('2d', { willReadFrequently: true })
        x.fillStyle = '#ffffff'
        x.fillRect(0, 0, W, H)
        x.drawImage(img, 0, 0)
        // 마스크 — 문구·그림 자리. 양쪽에 **같은** 칠을 한다.
        x.fillStyle = '#ff00ff'
        for (const m of masks) x.fillRect(m.x - 2, m.y - 2, m.w + 4, m.h + 4)
        return { canvas: c, ctx: x }
      }
      const a = draw(A)
      const b = draw(B)

      const diffCanvas = document.createElement('canvas')
      diffCanvas.width = W
      diffCanvas.height = H
      const dctx = diffCanvas.getContext('2d')
      const dimg = dctx.createImageData(W, H)

      let differing = 0
      let compared = 0
      const BLOCK = 512 // 큰 페이지에서 한 번에 다 읽으면 메모리가 터진다 — 가로 띠로 나눠 읽는다.
      for (let y0 = 0; y0 < H; y0 += BLOCK) {
        const h = Math.min(BLOCK, H - y0)
        const ad = a.ctx.getImageData(0, y0, W, h).data
        const bd = b.ctx.getImageData(0, y0, W, h).data
        for (let i = 0; i < ad.length; i += 4) {
          const p = (y0 * W) * 4 + i
          // 마스크 칠(#ff00ff)은 세지 않는다.
          if (ad[i] === 255 && ad[i + 1] === 0 && ad[i + 2] === 255) {
            dimg.data[p] = 245; dimg.data[p + 1] = 245; dimg.data[p + 2] = 245; dimg.data[p + 3] = 255
            continue
          }
          compared++
          const d = Math.abs(ad[i] - bd[i]) + Math.abs(ad[i + 1] - bd[i + 1]) + Math.abs(ad[i + 2] - bd[i + 2])
          if (d > tol) {
            differing++
            dimg.data[p] = 220; dimg.data[p + 1] = 38; dimg.data[p + 2] = 38; dimg.data[p + 3] = 255
          } else {
            dimg.data[p] = 255; dimg.data[p + 1] = 255; dimg.data[p + 2] = 255; dimg.data[p + 3] = 255
          }
        }
      }
      dctx.putImageData(dimg, 0, 0)

      // 시트 — 왼쪽 참조 · 오른쪽 복제. 긴 페이지는 폭 520 으로 줄여 한 장에 담는다.
      const SHEET_W = 520
      const s = Math.min(1, SHEET_W / W)
      const sheet = document.createElement('canvas')
      sheet.width = Math.round(W * s) * 2 + 24
      sheet.height = Math.round(H * s) + 36
      const sc = sheet.getContext('2d')
      sc.fillStyle = '#ffffff'
      sc.fillRect(0, 0, sheet.width, sheet.height)
      sc.fillStyle = '#333333'
      sc.font = '13px system-ui, sans-serif'
      sc.fillText('참조 (reference)', 0, 18)
      sc.fillText('복제 (replica)', Math.round(W * s) + 24, 18)
      sc.drawImage(A, 0, 28, Math.round(W * s), Math.round(H * s))
      sc.drawImage(B, Math.round(W * s) + 24, 28, Math.round(W * s), Math.round(H * s))

      return {
        width: W,
        height: H,
        refSize: { w: A.width, h: A.height },
        replicaSize: { w: B.width, h: B.height },
        compared,
        differing,
        pct: compared ? Math.round((differing / compared) * 10000) / 100 : null,
        diffPng: diffCanvas.toDataURL('image/png'),
        sheetPng: sheet.toDataURL('image/png'),
      }
    },
    { aUrl: aDataUrl, bUrl: bDataUrl, masks, tol: tolerance },
  )
}

const savePng = (file, dataUrl) => {
  fs.writeFileSync(path.join(OUT, file), Buffer.from(dataUrl.split(',')[1], 'base64'))
  return path.relative(ROOT, path.join(OUT, file)).split(path.sep).join('/')
}

/** 청사진에서 마스크를 만든다 — 문구(textLen>0)와 그림(media) 자리. */
function masksFor(vpKey) {
  const out = []
  // 머리·바닥(chrome)도 같은 마스크를 받는다 — 한쪽만 가리면 "가려서 통과" 가 된다.
  for (const band of [...computed[vpKey].blueprint, ...(computed[vpKey].chrome ?? [])]) {
    for (const c of band.children) {
      if (c.textLen > 0 || c.role === 'media' || ['img', 'svg', 'video', 'canvas', 'picture'].includes(c.tag)) {
        out.push({ x: (band.left ?? 0) + c.x, y: band.top + c.y, w: c.w, h: c.h })
      }
    }
  }
  return out
}

// ── 홈 ─────────────────────────────────────────────────────────────────────
async function runHome(browser) {
  const results = []
  const worker = await browser.newPage()
  for (const vp of VIEWPORTS) {
    const { ctx: rctx, page: rpage } = await openRef(browser, REF_HOME, vp)
    const refPng = (await rpage.screenshot({ fullPage: true })).toString('base64')
    await rctx.close()

    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, reducedMotion: 'reduce' })
    const page = await ctx.newPage()
    await page.goto(`${BASE}/dev/replica/tines-home`, { waitUntil: 'networkidle', timeout: 120_000 })
    await settle(page)
    const repPng = (await page.screenshot({ fullPage: true })).toString('base64')
    await ctx.close()

    const r = await comparePngs(
      worker,
      `data:image/png;base64,${refPng}`,
      `data:image/png;base64,${repPng}`,
      masksFor(vp.key),
      30,
    )
    const files = {
      ref: savePng(`home-${vp.key}-ref.png`, `data:image/png;base64,${refPng}`),
      replica: savePng(`home-${vp.key}-replica.png`, `data:image/png;base64,${repPng}`),
      diff: savePng(`home-${vp.key}-diff.png`, r.diffPng),
      sheet: savePng(`home-${vp.key}-sheet.png`, r.sheetPng),
    }
    delete r.diffPng
    delete r.sheetPng
    results.push({ viewport: vp.key, ...r, files, pass: r.pct !== null && r.pct <= THRESHOLD_PCT })
    console.log(
      `home ${vp.key}: 차이 ${r.pct}% (기준 ≤${THRESHOLD_PCT}%) · 비교 ${r.compared.toLocaleString()}px · ` +
      `참조 ${r.refSize.w}×${r.refSize.h} · 복제 ${r.replicaSize.w}×${r.replicaSize.h} → ${r.pct <= THRESHOLD_PCT ? 'PASS' : 'FAIL'}`,
    )
    console.log(`  시트 ${files.sheet}`)
  }
  await worker.close()
  return results
}

/** PNG 여러 장을 가로로 붙인 시트 하나. 한 칸의 최대 폭(maxPanel)을 넘으면 비율대로 줄인다. */
async function sheetOfMany(page, dataUrls, labels, maxPanel = 0) {
  return page.evaluate(
    async ({ urls, labels, maxPanel }) => {
      const load = (src) => new Promise((res, rej) => {
        const im = new Image()
        im.onload = () => res(im)
        im.onerror = rej
        im.src = src
      })
      const imgs = await Promise.all(urls.map(load))
      const scale = maxPanel ? Math.min(1, maxPanel / Math.max(...imgs.map((i) => i.width))) : 1
      const W = imgs.map((i) => Math.round(i.width * scale))
      const H = Math.max(...imgs.map((i) => Math.round(i.height * scale)))
      const GAP = 24
      const c = document.createElement('canvas')
      c.width = W.reduce((a, b) => a + b, 0) + GAP * (imgs.length - 1)
      c.height = H + 28
      const x = c.getContext('2d')
      x.fillStyle = '#ffffff'
      x.fillRect(0, 0, c.width, c.height)
      x.font = '13px system-ui, sans-serif'
      let left = 0
      imgs.forEach((im, i) => {
        x.fillStyle = '#333333'
        x.fillText(labels[i] ?? '', left, 18)
        x.drawImage(im, left, 28, W[i], Math.round(im.height * scale))
        left += W[i] + GAP
      })
      return c.toDataURL('image/png')
    },
    { urls: dataUrls, labels, maxPanel },
  )
}
const sheetOf = (page, a, b, labels) => sheetOfMany(page, [a, b], labels)

// ── 앱 ─────────────────────────────────────────────────────────────────────
async function runApp(browser) {
  const results = []
  const worker = await browser.newPage()
  for (const vp of VIEWPORTS) {
    const measured = appMeasured.viewports[vp.key]
    if (!measured || measured.error) continue

    // 뷰포트는 **그 측정값의 폭** 그대로 — 넓게 열면 CSS 미디어쿼리가 375 블록을 감춰 rect 가 전부 0 이 된다.
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1 })
    const page = await ctx.newPage()
    await page.goto(`${BASE}/dev/replica/tines-app`, { waitUntil: 'networkidle', timeout: 120_000 })
    await settle(page)

    const got = await page.evaluate((key) => {
      const frame = document.querySelector(`[data-app-frame="${key}"]`)
      if (!frame) return null
      const fr = frame.getBoundingClientRect()
      const box = (part) => {
        const el = frame.querySelector(`[data-part="${part}"]`)
        if (!el) return null
        const r = el.getBoundingClientRect()
        return { x: Math.round(r.left - fr.left), y: Math.round(r.top - fr.top), w: Math.round(r.width), h: Math.round(r.height) }
      }
      return {
        frame: { w: Math.round(fr.width), h: Math.round(fr.height) },
        canvas: box('canvas'),
        topbar: box('topbar'),
        inspector: box('inspector'),
        nodes: Array.from(frame.querySelectorAll('[data-part="node"]')).map((el) => {
          const r = el.getBoundingClientRect()
          return { x: Math.round(r.left - fr.left), y: Math.round(r.top - fr.top), w: Math.round(r.width), h: Math.round(r.height) }
        }),
      }
    }, vp.key)
    const replicaShot = got
      ? (await page.locator(`[data-app-frame="${vp.key}"]`).screenshot()).toString('base64')
      : null
    await ctx.close()

    // 참조 쪽 — 같은 앱 창 영역만 오려 찍는다.
    let refShot = null
    try {
      const { ctx: rctx, page: rpage } = await openRef(browser, REF_APP, vp)
      const anchor = rpage.locator(appMeasured.source.anchor).first()
      if (await anchor.count()) {
        const box = await anchor.evaluate((el) => {
          let frame = el
          const STOP = new Set(['MAIN', 'BODY', 'HTML'])
          while (frame.parentElement && !STOP.has(frame.parentElement.tagName) &&
            frame.getBoundingClientRect().width < Math.min(900, window.innerWidth * 0.95)) frame = frame.parentElement
          const r = frame.getBoundingClientRect()
          return { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height }
        })
        refShot = (await rpage.screenshot({ clip: box })).toString('base64')
      }
      await rctx.close()
    } catch {
      refShot = null
    }

    if (!got) {
      results.push({ viewport: vp.key, error: '복제 화면에서 앱 창을 못 찾았다' })
      continue
    }

    const d = measured.derived
    const checks = [
      ['frame.width', measured.frame.width, got.frame.w],
      ['frame.height', measured.frame.height, got.frame.h],
      ['topBar.height', d.topBarHeight, got.topbar?.h ?? null],
      ['canvas.x', d.canvas?.x ?? null, got.canvas?.x ?? null],
      ['canvas.y', d.canvas?.y ?? null, got.canvas?.y ?? null],
      ['canvas.w', d.canvas?.w ?? null, got.canvas?.w ?? null],
      ['canvas.h', d.canvas?.h ?? null, got.canvas?.h ?? null],
      ['inspector.w', d.rightInspectorWidth, got.inspector?.w ?? null],
      ['nodes.count', measured.nodes.length, got.nodes.length],
    ].map(([name, want, gotV]) => ({
      name,
      want,
      got: gotV,
      // 양쪽 다 없으면 비교할 것이 없다(예: 375 에서 접힌 앱에는 상단 바가 없다) — 실패가 아니다.
      delta: want === null && gotV === null ? 0 : want === null || gotV === null ? null : Math.round(Math.abs(want - gotV) * 100) / 100,
    }))
    const failed = checks.filter((c) => c.delta === null || c.delta > BOX_TOLERANCE)

    const files = {}
    if (replicaShot) files.replica = savePng(`app-${vp.key}-replica.png`, `data:image/png;base64,${replicaShot}`)
    if (refShot) files.ref = savePng(`app-${vp.key}-ref.png`, `data:image/png;base64,${refShot}`)
    if (refShot && replicaShot) {
      files.sheet = savePng(
        `app-${vp.key}-sheet.png`,
        await sheetOf(worker, `data:image/png;base64,${refShot}`, `data:image/png;base64,${replicaShot}`, ['참조 (reference)', '복제 (replica)']),
      )
    }

    results.push({ viewport: vp.key, checks, files, pass: failed.length === 0, failed })
    console.log(`app ${vp.key}: ${checks.length - failed.length}/${checks.length} 항목이 ±${BOX_TOLERANCE}px 안 → ${failed.length === 0 ? 'PASS' : 'FAIL'}`)
    for (const f of failed) console.log(`  ✗ ${f.name}: 실측 ${f.want} · 복제 ${f.got} · 차 ${f.delta}`)
    if (files.sheet) console.log(`  시트 ${files.sheet}`)
  }
  await worker.close()
  return results
}

// ── Stage 3 · 치환 시트 ────────────────────────────────────────────────────
// 여기서는 픽셀 차이를 재지 않는다 — ours 는 색·서체·문구가 **일부러** 다르므로 숫자가 뜻을 잃는다.
// 대신 기계가 검사할 수 있는 것을 검사한다: 「구조·수치 변경 0」. 띠·상자의 자리가 복제와 한 픽셀이라도
// 다르면 그건 치환이 아니라 재설계다.
const shot = async (browser, url, vp, opts = {}) => {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  await page.goto(url, { waitUntil: 'networkidle', timeout: 120_000 })
  await settle(page)
  const target = opts.selector ? page.locator(opts.selector).first() : page
  const png = (await target.screenshot(opts.selector ? {} : { fullPage: true })).toString('base64')
  const geom = await page.evaluate((sel) => {
    const root = sel ? document.querySelector(sel) : document
    if (!root) return null
    const scope = sel ? root : document
    const rr = sel ? root.getBoundingClientRect() : { left: 0, top: -scrollY }
    const pick = (el) => {
      const r = el.getBoundingClientRect()
      return {
        id: el.dataset.band !== undefined ? `band:${el.dataset.band}` : `part:${el.dataset.part}`,
        x: Math.round(r.left - rr.left), y: Math.round(r.top - rr.top),
        w: Math.round(r.width), h: Math.round(r.height),
      }
    }
    return {
      docHeight: document.documentElement.scrollHeight,
      boxes: Array.from(scope.querySelectorAll('[data-band],[data-part]')).map(pick),
    }
  }, opts.selector ?? null)
  await ctx.close()
  return { png, geom }
}

/** 두 기하 목록이 같은지 — 다르면 어디가 몇 px 다른지 돌려준다. */
function geomDiff(a, b) {
  if (!a || !b) return [{ id: '(측정 실패)', delta: null }]
  const out = []
  if (a.docHeight !== b.docHeight) out.push({ id: 'docHeight', want: a.docHeight, got: b.docHeight, delta: Math.abs(a.docHeight - b.docHeight) })
  const n = Math.min(a.boxes.length, b.boxes.length)
  if (a.boxes.length !== b.boxes.length) out.push({ id: 'boxCount', want: a.boxes.length, got: b.boxes.length, delta: Math.abs(a.boxes.length - b.boxes.length) })
  for (let i = 0; i < n; i++) {
    const p = a.boxes[i]
    const q = b.boxes[i]
    const d = Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y), Math.abs(p.w - q.w), Math.abs(p.h - q.h))
    if (d > 0) out.push({ id: p.id, want: p, got: q, delta: d })
  }
  return out
}

async function runOurs(browser) {
  const results = []
  const worker = await browser.newPage()

  for (const vp of VIEWPORTS) {
    const { ctx: rctx, page: rpage } = await openRef(browser, REF_HOME, vp)
    const refPng = (await rpage.screenshot({ fullPage: true })).toString('base64')
    await rctx.close()

    const rep = await shot(browser, `${BASE}/dev/replica/tines-home`, vp)
    const ours = await shot(browser, `${BASE}/dev/replica/ours-home`, vp)
    const drift = geomDiff(rep.geom, ours.geom)

    const sheet = savePng(
      `ours-home-${vp.key}-sheet.png`,
      await sheetOfMany(
        worker,
        [`data:image/png;base64,${refPng}`, `data:image/png;base64,${rep.png}`, `data:image/png;base64,${ours.png}`],
        ['① 참조 (Tines)', '② 복제 (replica)', '③ 우리 것 (ours)'],
        460,
      ),
    )
    savePng(`ours-home-${vp.key}.png`, `data:image/png;base64,${ours.png}`)
    results.push({ target: 'home', viewport: vp.key, sheet, structureDrift: drift, pass: drift.length === 0 })
    console.log(`ours home ${vp.key}: 구조 어긋남 ${drift.length}건 → ${drift.length === 0 ? 'PASS (구조·수치 변경 0)' : 'FAIL'}`)
    for (const d of drift.slice(0, 5)) console.log(`  ✗ ${d.id}: ${d.delta}px`)
    console.log(`  시트 ${sheet}`)
  }

  // 앱 — 1440 만(375 는 접힌 구성이라 나란히 놓는 뜻이 없다)
  const vp = VIEWPORTS[0]
  let refAppPng = null
  try {
    const { ctx: rctx, page: rpage } = await openRef(browser, REF_APP, vp)
    const anchor = rpage.locator(appMeasured.source.anchor).first()
    if (await anchor.count()) {
      const box = await anchor.evaluate((el) => {
        let frame = el
        const STOP = new Set(['MAIN', 'BODY', 'HTML'])
        while (frame.parentElement && !STOP.has(frame.parentElement.tagName) &&
          frame.getBoundingClientRect().width < Math.min(900, window.innerWidth * 0.95)) frame = frame.parentElement
        const r = frame.getBoundingClientRect()
        return { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height }
      })
      refAppPng = (await rpage.screenshot({ clip: box })).toString('base64')
    }
    await rctx.close()
  } catch { refAppPng = null }

  const sel = '[data-app-frame="1440"]'
  const repApp = await shot(browser, `${BASE}/dev/replica/tines-app`, vp, { selector: sel })
  const oursApp = await shot(browser, `${BASE}/dev/replica/ours-app`, vp, { selector: sel })
  const appDrift = geomDiff(repApp.geom, oursApp.geom)
  const panels = [refAppPng && `data:image/png;base64,${refAppPng}`, `data:image/png;base64,${repApp.png}`, `data:image/png;base64,${oursApp.png}`].filter(Boolean)
  const labels = [refAppPng ? '① 참조 (Tines)' : null, '② 복제 (replica)', '③ 우리 것 (ours)'].filter(Boolean)
  const appSheet = savePng(`ours-app-${vp.key}-sheet.png`, await sheetOfMany(worker, panels, labels, 620))
  results.push({ target: 'app', viewport: vp.key, sheet: appSheet, structureDrift: appDrift, pass: appDrift.length === 0 })
  console.log(`ours app ${vp.key}: 구조 어긋남 ${appDrift.length}건 → ${appDrift.length === 0 ? 'PASS (구조·수치 변경 0)' : 'FAIL'}`)
  for (const d of appDrift.slice(0, 5)) console.log(`  ✗ ${d.id}: ${d.delta}px`)
  console.log(`  시트 ${appSheet}`)

  await worker.close()
  return results
}

// ── 실행 ───────────────────────────────────────────────────────────────────
const browser = await chromium.launch()
const report = { base: BASE, ref: { home: REF_HOME, app: REF_APP }, ranAt: new Date().toISOString(), thresholdPct: THRESHOLD_PCT, boxTolerance: BOX_TOLERANCE }
if (has('--ours')) report.ours = await runOurs(browser)
else if (has('--app')) report.app = await runApp(browser)
else if (has('--home')) report.home = await runHome(browser)
else {
  report.home = await runHome(browser)
  report.app = await runApp(browser)
  report.ours = await runOurs(browser)
}
await browser.close()

fs.writeFileSync(path.join(OUT, 'replica-diff.json'), JSON.stringify(report, null, 2) + '\n', 'utf8')
console.log(`\n${path.relative(ROOT, path.join(OUT, 'replica-diff.json')).split(path.sep).join('/')}`)

const failures = [...(report.home ?? []), ...(report.app ?? []), ...(report.ours ?? [])].filter((r) => !r.pass)
if (failures.length) process.exitCode = 1
