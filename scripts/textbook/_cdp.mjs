// scripts/textbook/_cdp.mjs
//
// **헤드리스 브라우저로 인쇄하는 최소 CDP 클라이언트.**
//
// ── 왜 라이브러리를 안 쓰나 ──────────────────────────────────────────
// 필요한 것은 `Page.printToPDF` 하나다. Puppeteer 를 넣으면 Chromium 을 통째로 내려받고
// (수백 MB) 버전 고정 문제가 따라온다. Node 20+ 에는 **`WebSocket` 이 내장**돼 있어서
// CDP 를 직접 부르면 **패키지가 0** 이다(이 기계 Node v24.15.0 확인).
//
// ── 왜 CDP 여야 하나 (CLI 로는 안 되는 것) ────────────────────────────
// `chrome --print-to-pdf` 로는 **머리말·꼬리말 템플릿을 못 준다.** 그런데 쪽 번호는
// CSS 로도 못 넣는다 — `@page` 의 margin box(`@bottom-center` 에 `counter(page)`)는
// CSS Paged Media 규격이지만 **Chrome 이 구현하지 않았다.** 그래서 CDP 의
// `displayHeaderFooter` 가 유일한 길이다.
//
// ⚠️ **모든 호출에 시한을 건다.** 시한이 없으면 응답이 안 오는 순간 영영 선다.
//   실제로 그랬다(2026-09-01): `document.fonts.ready` 를 `awaitPromise` 로 기다렸는데
//   웹폰트가 못 붙는 환경에서 프로미스가 안 풀려 10분을 넘겨도 안 끝났다.
//   `.catch()` 는 거절만 잡지 **멈춤은 못 잡는다**.
//
// ⚠️ **`Page.navigate` 를 부르지 않는다.** `/json/new?<url>` 이 이미 그 주소로 연 탭이다.
//   다시 navigate 하면 같은 문서를 두 번 읽고 `loadEventFired` 와 엇갈리면 선다.
//
// ⚠️ **탭 하나로 두 번 인쇄하지 않는다.** 같은 탭에서 `printToPDF` 를 연달아 부르면
//   두 번째가 안 돌아온 적이 있다(실측 2026-09-01). 인쇄마다 탭을 새로 연다.

import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { spawn } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** 기계마다 다르다 — 경로를 하드코딩하지 않고 있는 것을 고른다. */
const CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean)

export function findBrowser() {
  const found = CANDIDATES.find((p) => {
    try {
      return fs.existsSync(p)
    } catch {
      return false
    }
  })
  if (!found) throw new Error('Chrome/Edge 를 못 찾았다. CHROME_PATH 로 알려 줄 것.')
  return found
}

/** PDF 바이트에서 쪽 수를 센다. **요청한 값이 아니라 찍힌 값**을 보고하기 위해서다. */
export function pdfPageCount(buf) {
  return (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length
}

/** PDF 판형(mm). 못 읽으면 null. */
export function pdfPageSizeMm(buf) {
  const m = buf.toString('latin1').match(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/)
  if (!m) return null
  const mm = (pt) => (Number(pt) / 72) * 25.4
  return { w: mm(m[3]), h: mm(m[4]) }
}

/**
 * 브라우저를 띄우고 인쇄기를 돌려준다. **반드시 `close()` 로 닫을 것** —
 * 안 닫으면 헤드리스 Chrome 과 임시 프로필이 남는다.
 */
export async function openPrinter({ startupTimeoutMs = 20000 } = {}) {
  const browser = findBrowser()
  // 고정 포트를 쓰지 않는다 — 다른 세션이 같은 포트를 쓰면 남의 브라우저에 붙는다.
  const port = 9300 + Math.floor(Math.random() * 600)
  const userDir = path.join(process.env.TEMP ?? process.env.TMPDIR ?? '.', `vocaflow-print-${process.pid}`)

  const child = spawn(
    browser,
    ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${userDir}`,
     '--no-first-run', '--no-default-browser-check', 'about:blank'],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  )
  let stderr = ''
  child.stderr.on('data', (b) => { stderr += String(b) })

  const until = Date.now() + startupTimeoutMs
  let up = false
  while (Date.now() < until) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`)
      if (res.ok) { up = true; break }
    } catch {
      /* 아직 안 떴다 */
    }
    await sleep(150)
  }
  if (!up) {
    try { child.kill() } catch { /* 이미 죽었다 */ }
    throw new Error(`DevTools 가 ${startupTimeoutMs}ms 안에 안 열렸다.\n${stderr.trim().slice(-400)}`)
  }

  /** 파일 하나를 새 탭에서 인쇄한다. `opts` 는 `Page.printToPDF` 파라미터에 그대로 실린다. */
  async function printFile(filePath, opts = {}, { settleMs = 600, timeoutMs = 180000 } = {}) {
    const url = pathToFileURL(path.resolve(filePath)).href
    const res = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })
    if (!res.ok) throw new Error(`탭 생성 실패: ${res.status} ${await res.text()}`)
    const tab = await res.json()

    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    // 연결도 같은 이유로 타이머를 걷는다.
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('CDP 연결이 15초 안에 안 열렸다')), 15000)
      ws.addEventListener('open', () => { clearTimeout(t); resolve() }, { once: true })
      ws.addEventListener('error', () => { clearTimeout(t); reject(new Error('CDP 연결 실패')) }, { once: true })
    })

    let nextId = 1
    const pending = new Map()
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data)
      if (!msg.id || !pending.has(msg.id)) return
      const { resolve, reject } = pending.get(msg.id)
      pending.delete(msg.id)
      if (msg.error) reject(new Error(`${msg.error.message} (${msg.error.code})`))
      else resolve(msg.result)
    })
    /**
     * ⚠️ **진 쪽 타이머를 반드시 걷는다.** `Promise.race([호출, sleep(180s)])` 로 쓰면
     *   호출이 먼저 끝나도 **180초짜리 타이머가 살아 남는다.** 조각을 스물몇 번 인쇄하면
     *   그런 타이머가 그만큼 쌓여 이벤트 루프가 계속 깨어 있고, 프로세스가 안 끝난다
     *   (실측 2026-09-01: 조각 24개 뒤 다음 인쇄가 180초를 넘겼다. 같은 문서를 새
     *   프로세스로는 8.9초에 뽑았다). `clearTimeout` 으로 매번 정리한다.
     */
    const send = (method, params = {}) =>
      new Promise((resolve, reject) => {
        const id = nextId++
        const timer = setTimeout(() => {
          pending.delete(id)
          reject(new Error(`${method} 가 ${timeoutMs / 1000}초 안에 안 끝났다`))
        }, timeoutMs)
        pending.set(id, {
          resolve: (v) => { clearTimeout(timer); resolve(v) },
          reject: (e) => { clearTimeout(timer); reject(e) },
        })
        ws.send(JSON.stringify({ id, method, params }))
      })

    try {
      await sleep(settleMs)
      const { data } = await send('Page.printToPDF', { preferCSSPageSize: true, printBackground: true, ...opts })
      return Buffer.from(data, 'base64')
    } finally {
      try { ws.close() } catch { /* 이미 닫혔다 */ }
      // 탭을 닫는다 — 안 닫으면 수십 번 인쇄할 때 탭이 쌓여 메모리를 먹는다.
      try { await fetch(`http://127.0.0.1:${port}/json/close/${tab.id}`) } catch { /* 못 닫아도 브라우저를 곧 죽인다 */ }
    }
  }

  function close() {
    try { child.kill() } catch { /* 이미 죽었다 */ }
    try { fs.rmSync(userDir, { recursive: true, force: true }) } catch { /* 남아도 치명적이지 않다 */ }
  }

  return { printFile, close, port }
}

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])

/**
 * 머리말·꼬리말 템플릿 — **여기 한 곳에만 둔다.**
 *
 * ⚠️ `print-volume.mjs` 와 `toc-volume.mjs` 가 **같은 것**을 써야 한다. 처음에 조각은
 *   머리말·꼬리말 없이 재고 최종본만 붙여 인쇄했더니 **조각 합 151쪽 vs 통째 158쪽**으로
 *   7쪽이 어긋났다(실측 2026-09-01). 머리말·꼬리말이 세로 공간을 먹어 쪽이 늘어난 것이다
 *   (같은 문서 148 → 156 으로 이미 재 둔 값과 같은 크기다). 차례의 쪽 번호는 **최종본과
 *   똑같은 조건으로 재야** 맞는다.
 *
 * ⚠️ 템플릿에 `font-size` 를 **반드시** 준다. 안 주면 Chrome 이 기본 아주 작은 크기로
 *   그려서 사실상 안 보인다. 색도 지정한다 — 기본이 옅은 회색이다.
 */
export const HEADER_TEMPLATE = (title) =>
  `<div style="width:100%;font-size:7pt;color:#666;padding:0 17mm;` +
  `font-family:'Malgun Gothic',system-ui,sans-serif;">` +
  `<span style="float:right">${esc(title)}</span></div>`

export const FOOTER_TEMPLATE =
  `<div style="width:100%;font-size:8pt;color:#444;padding:0 17mm;text-align:center;` +
  `font-family:'Malgun Gothic',system-ui,sans-serif;">` +
  `<span class="pageNumber"></span> / <span class="totalPages"></span></div>`

/** 최종본과 같은 조건으로 인쇄하기 위한 파라미터 묶음. */
export const headerFooterOpts = (title) => ({
  displayHeaderFooter: true,
  headerTemplate: HEADER_TEMPLATE(title),
  footerTemplate: FOOTER_TEMPLATE,
})

/**
 * 조판물 CSS 를 그대로 쓰는 조각 문서를 만든다 — 조각의 쪽 나눔이 본문과 **같아야** 한다.
 *
 * ⚠️ **원본과 똑같은 모양으로 만든다 — `<!doctype>` 도 `<html>` 도 붙이지 않는다.**
 *   처음에 `<!doctype html><html lang="ko"><head><meta charset="utf-8">…` 로 감쌌더니
 *   조각 합 149쪽 대 통째 156쪽으로 **7쪽이 어긋났다**(실측 2026-09-01).
 *   원인은 `render-volume.mjs` 의 조판물에 **doctype 이 없어서** 브라우저가 **쿼크 모드**로
 *   렌더한다는 것이다(`<title>` 로 바로 시작한다 — `<meta charset>` 도 없다).
 *   조각에 doctype 을 붙이면 그쪽만 표준 모드가 되어 상자 모델·줄 높이가 달라진다.
 *
 *   ⚠️ **여기서 고치면 안 된다.** 조각을 표준 모드로 만들면 조각은 "옳아" 지지만
 *   실제 인쇄물(원본)과 달라져 **차례의 쪽 번호가 틀린다.** 자는 재는 대상을 따라가야 한다.
 *   진짜 고칠 자리는 조판기이고, 그건 인쇄물 자체가 바뀌는 일이라 따로 판단해야 한다.
 */
export function fragmentHtml(headHtml, bodyHtml) {
  return `${headHtml}\n<div class="wrap">${bodyHtml}</div>`
}

export { zlib }
