// scripts/textbook/print-volume.mjs
//
// **조판된 권을 인쇄용 PDF 로 뽑는다 — 쪽 번호와 running head 를 붙여서.**
//
// ── 왜 브라우저 인쇄로는 안 되는가 (실측 2026-09-01) ──────────────────
// `render-volume.mjs` 가 넣은 `@page{size:188mm 257mm;margin:…}` 와 `break-inside:avoid`
// 는 Chrome 이 그대로 지킨다(V5 20단원 → 148쪽 · MediaBox 188×257.2mm 확인).
// 그런데 **쪽 번호는 CSS 로 못 넣는다** — `@page` 의 margin box(`@bottom-center` 에
// `counter(page)`)는 CSS Paged Media 규격이지만 **Chrome 이 구현하지 않았다.**
// 쪽 번호 없는 인쇄물은 교재가 아니다(차례도 못 만들고, 수업에서 "몇 쪽" 을 못 부른다).
//
// ── 그래서 무엇을 쓰나 ────────────────────────────────────────────────
// **CDP `Page.printToPDF` 의 `displayHeaderFooter`.** Chrome 이 직접 머리말·꼬리말을
// 그려 주고 `.pageNumber` · `.totalPages` · `.title` 클래스를 치환해 준다.
// CLI 플래그(`--print-to-pdf`)로는 이 옵션을 줄 수 없어서 CDP 로 직접 부른다.
//
// ⚠️ **의존성을 안 늘린다.** Paged.js 같은 조판 엔진을 얹는 길도 있지만 그것은 CDN 을
//   물고 DOM 을 통째로 다시 짜므로 조판 결과가 달라진다. 여기서 필요한 것은 쪽 번호
//   하나이고, Node 20+ 의 **내장 `WebSocket`** 으로 CDP 를 직접 부르면 패키지가 0 이다.
//   (이 기계 Node v24.15.0 · `typeof WebSocket === 'function'` 확인.)
//
// ⚠️ 차례(목차)는 아직 못 만든다. 차례에 쪽 번호를 적으려면 **어느 단원이 몇 쪽에서
//   시작하는지**를 알아야 하는데 그건 조판을 한 번 돌려 봐야 나온다(두 벌 조판).
//   지금 권에는 차례 자체가 없다 — 별도 작업이다.
//
// 재실행 안전: 읽기만 하고 PDF 를 덮어쓴다. DB 를 건드리지 않는다.
//
// 실행:
//   node scripts/textbook/print-volume.mjs --in scripts/textbook/out/volume-v5-print.html
//   node scripts/textbook/print-volume.mjs --in <html> --out <pdf> --title "책 제목"

import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const arg = (n, d = null) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d
}

const IN = arg('in')
if (!IN) {
  console.error('--in <조판된 html> 이 필요하다.')
  console.error('예: node scripts/textbook/print-volume.mjs --in scripts/textbook/out/volume-v5-print.html')
  process.exit(1)
}
const inPath = path.resolve(IN)
if (!fs.existsSync(inPath)) {
  console.error(`파일이 없다: ${inPath}`)
  process.exit(1)
}
const outPath = path.resolve(arg('out', inPath.replace(/\.html?$/i, '.pdf')))

/** 머리말에 쓸 제목. 안 주면 조판물의 `<h1>` 에서 읽는다 — 정본이 하나여야 한다. */
const html = fs.readFileSync(inPath, 'utf8')
const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
const TITLE = arg('title', h1 ? h1[1].replace(/<[^>]+>/g, '').trim() : path.basename(inPath))

/**
 * Chrome 을 찾는다. 없으면 Edge 로 떨어진다 — 둘 다 같은 엔진이라 결과가 같다.
 * ⚠️ 경로를 하드코딩하지 않고 있는 것을 고른다. 기계마다 다르다.
 */
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
const BROWSER = CANDIDATES.find((p) => {
  try {
    return fs.existsSync(p)
  } catch {
    return false
  }
})
if (!BROWSER) {
  console.error('Chrome/Edge 를 못 찾았다. CHROME_PATH 로 알려 줄 것.')
  process.exit(1)
}

/** 고정 포트를 쓰지 않는다 — 다른 세션이 같은 포트를 쓰면 남의 브라우저에 붙는다. */
const PORT = 9300 + Math.floor(Math.random() * 600)
const userDir = path.join(
  process.env.TEMP ?? process.env.TMPDIR ?? '.',
  `vocaflow-print-${process.pid}`,
)

const child = spawn(
  BROWSER,
  [
    '--headless=new',
    '--disable-gpu',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${userDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ],
  { stdio: ['ignore', 'ignore', 'pipe'] },
)
let browserErr = ''
child.stderr.on('data', (b) => {
  browserErr += String(b)
})

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** DevTools 가 열릴 때까지 기다린다. 바로 붙으면 ECONNREFUSED 가 난다. */
async function waitForDevtools(timeoutMs = 20000) {
  const until = Date.now() + timeoutMs
  while (Date.now() < until) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`)
      if (res.ok) return await res.json()
    } catch {
      /* 아직 안 떴다 */
    }
    await sleep(150)
  }
  throw new Error(`DevTools 가 ${timeoutMs}ms 안에 안 열렸다.\n${browserErr.trim().slice(-400)}`)
}

function cleanup() {
  try {
    child.kill()
  } catch {
    /* 이미 죽었으면 그만이다 */
  }
  try {
    fs.rmSync(userDir, { recursive: true, force: true })
  } catch {
    /* 지워지지 않아도 치명적이지 않다 */
  }
}

let ws = null
try {
  await waitForDevtools()

  // 새 탭을 만들고 그 탭의 WebSocket 에 바로 붙는다 — Target 도메인을 안 거쳐도 된다.
  const fileUrl = pathToFileURL(inPath).href
  const newRes = await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(fileUrl)}`, {
    method: 'PUT',
  })
  if (!newRes.ok) throw new Error(`탭 생성 실패: ${newRes.status} ${await newRes.text()}`)
  const tab = await newRes.json()

  ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true })
    ws.addEventListener('error', () => reject(new Error('CDP 연결 실패')), { once: true })
  })

  let nextId = 1
  const pending = new Map()
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id)
      pending.delete(msg.id)
      if (msg.error) reject(new Error(`${msg.error.message} (${msg.error.code})`))
      else resolve(msg.result)
    }
  })
  /**
   * ⚠️ **모든 CDP 호출에 시한을 건다.** 시한이 없으면 응답이 안 오는 순간 영영 선다.
   *   실제로 그랬다(2026-09-01): `document.fonts.ready` 를 `awaitPromise` 로 기다렸는데
   *   웹폰트가 못 붙는 환경에서 그 프로미스가 안 풀려 **10분을 넘겨도 안 끝났다.**
   *   `.catch()` 는 거절만 잡지 **멈춤은 못 잡는다** — 그래서 race 로 감싼다.
   */
  const send = (method, params = {}, timeoutMs = 180000) =>
    Promise.race([
      new Promise((resolve, reject) => {
        const id = nextId++
        pending.set(id, { resolve, reject })
        ws.send(JSON.stringify({ id, method, params }))
      }),
      sleep(timeoutMs).then(() => {
        throw new Error(`${method} 가 ${timeoutMs / 1000}초 안에 안 끝났다`)
      }),
    ])

  // ⚠️ `Page.navigate` 를 부르지 않는다 — `/json/new?<url>` 이 **이미 그 주소로 연 탭**이다.
  //   다시 navigate 하면 같은 문서를 두 번 읽고, 그 사이 `loadEventFired` 를 기다리다
  //   엇갈리면 선다. 폰트 정착은 `printToPDF` 가 알아서 기다린다(실측: 148쪽 8.9초).
  await sleep(700)

  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])
  // ⚠️ 템플릿에 font-size 를 **반드시** 준다. 안 주면 Chrome 이 기본 아주 작은 크기로
  //   그려서 사실상 안 보인다. 색도 지정한다 — 기본이 옅은 회색이다.
  const headerTemplate =
    `<div style="width:100%;font-size:7pt;color:#666;padding:0 17mm;` +
    `font-family:'Malgun Gothic',system-ui,sans-serif;">` +
    `<span style="float:right">${esc(TITLE)}</span></div>`
  const footerTemplate =
    `<div style="width:100%;font-size:8pt;color:#444;padding:0 17mm;text-align:center;` +
    `font-family:'Malgun Gothic',system-ui,sans-serif;">` +
    `<span class="pageNumber"></span> / <span class="totalPages"></span></div>`

  const { data } = await send('Page.printToPDF', {
    // 조판물의 `@page` 를 정본으로 삼는다 — 여기서 크기를 다시 적으면 정본이 둘이 된다.
    preferCSSPageSize: true,
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate,
    footerTemplate,
  })

  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, Buffer.from(data, 'base64'))

  // 쪽 수와 판형을 되읽어 **찍힌 것**을 보고한다 — 요청한 값이 아니라.
  const buf = fs.readFileSync(outPath)
  const raw = buf.toString('latin1')
  const pages = (raw.match(/\/Type\s*\/Page[^s]/g) ?? []).length
  const mb = raw.match(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/)
  const mm = (pt) => (Number(pt) / 72) * 25.4
  console.log(`${path.relative(process.cwd(), outPath)}`)
  console.log(`  ${pages}쪽 · ${Math.round(buf.length / 1024)} KB`)
  if (mb) console.log(`  판형 ${mm(mb[3]).toFixed(1)} × ${mm(mb[4]).toFixed(1)} mm`)
  console.log(`  머리말 "${TITLE}" · 꼬리말 쪽번호`)
} catch (e) {
  console.error('인쇄 실패:', e.message)
  cleanup()
  process.exit(1)
}

try {
  ws?.close()
} catch {
  /* 닫히지 않아도 아래에서 브라우저를 죽인다 */
}
cleanup()
process.exit(0)
