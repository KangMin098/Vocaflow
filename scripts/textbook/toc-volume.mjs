// scripts/textbook/toc-volume.mjs
//
// **조판된 권에 차례(목차)를 붙인다 — 쪽 번호가 실제로 맞는 차례를.**
//
// ── 왜 필요한가 ──────────────────────────────────────────────────────
// 상업 교재에 차례 없는 것이 없다. 학습자는 차례로 "오늘 어디" 를 정하고, 교사는 "몇 쪽
// 펴세요" 를 부른다. 우리 권에는 **차례가 아예 없었다**(실측 2026-09-01 — "차례" 로 잡힌
// 문자열은 전부 해설 본문의 "차례로 놓는다" 였다).
//
// ── 어려운 곳: DOM 과 쪽의 대응 ───────────────────────────────────────
// 차례에 쪽 번호를 적으려면 **어느 단원이 몇 쪽에서 시작하는지**를 알아야 하는데,
// CDP `Page.printToPDF` 는 그 대응을 안 준다. 화면 좌표도 못 쓴다 — `Emulation.setEmulatedMedia`
// 로 print 스타일을 입혀도 브라우저가 DOM 을 **쪽으로 나누지는 않아서** `break-before:page`
// 가 좌표에 반영되지 않는다.
//
// **그래서 조각을 따로 조판해 쪽 수를 센다.** 이게 성립하는 이유는 조판 규칙 때문이다:
//   · `.cover{break-after:page}` — 표지 다음은 항상 새 쪽
//   · `.unit{break-before:page}` — 단원마다 새 쪽에서 시작
//   · `.answers{break-before:page}` · `.colophon{break-before:page}`
// 각 덩어리가 **새 쪽에서 시작해 자기 안에서만 흐르므로**, 떼어 내 조판해도 쪽 수가 같다.
// (`.unit:first-of-type{break-before:auto}` 는 표지의 `break-after` 가 이미 쪽을 넘겼기
//  때문에 빈 쪽을 막는 장치다 — 첫 단원도 새 쪽에서 시작하는 것은 그대로다.)
//
// 조각을 조판할 때 **원본의 `<head>` 를 그대로 쓴다** — CSS 가 다르면 쪽 수가 달라진다.
//
// ⚠️ 차례 자체가 쪽을 차지하므로 뒤가 밀린다. 차례를 먼저 조판해 그 쪽 수를 재고
//   더한다 — 짐작하지 않는다.
//
// ── ⚠️ 지금은 **쪽 번호를 싣지 않는다** (실측 2026-09-01) ─────────────
// 위 방법으로 재 봤더니 **조각 합 150쪽 대 통째 조판 158쪽**으로 어긋났다. 파싱은 충실하다 —
// 뜯은 조각을 그대로 다시 붙이면 원본과 **똑같이 156쪽**이 나온다(재조립 검증). 즉 조각이
// 합쳐질 때 쪽이 늘어난다. 어디서 늘어나는지는 더 좁혀야 한다.
//
// **그런데 그 전에 고칠 것이 있다.** 조판물에 `<!doctype html>` 이 없어 브라우저가
// **쿼크 모드**로 렌더한다(`<title>` 로 바로 시작한다 · `<meta charset>` 도 없다).
// 쿼크 모드는 상자 모델과 줄 높이가 달라 **쪽 나눔이 통째로 바뀐다.** doctype 을 넣는
// 순간 지금 계산한 쪽 번호는 전부 무효가 된다 — **그러니 지금 쪽 번호를 계산하는 것은
// 순서가 틀렸다.**
//
// 그래서 이 도구는 지금 **쪽 번호 없는 차례**(단원·문항 수·소요 시간)를 낸다. 그것만으로도
// 상업 교재의 차례가 하는 일의 절반은 한다("이 책에 무엇이 몇 개 들어 있나").
// 쪽 번호는 조판기가 표준 모드로 바뀐 뒤에 붙인다.
//
// ── 검산 (진단용) ────────────────────────────────────────────────────
// 조각 쪽 수의 합과 완성본을 통째로 조판한 쪽 수를 **함께 찍는다.** 둘이 같아지면
// 위 전제가 회복된 것이고, 그때 쪽 번호를 실을 수 있다. 어긋나도 실패로 끝내지 않는다 —
// 어차피 쪽 번호를 안 싣기 때문이다.
//
// 재실행 안전: 입력 HTML 을 읽고 **새 파일**에 쓴다. 원본을 안 고친다. DB 도 안 본다.
//
// 실행:
//   node scripts/textbook/toc-volume.mjs --in scripts/textbook/out/volume-v5.html
//   node scripts/textbook/toc-volume.mjs --in <html> --out <html>

import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'

import { openPrinter, pdfPageCount, fragmentHtml, headerFooterOpts } from './_cdp.mjs'

const arg = (n, d = null) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d
}

const IN = arg('in')
if (!IN) {
  console.error('--in <조판된 html> 이 필요하다.')
  process.exit(1)
}
const inPath = path.resolve(IN)
if (!fs.existsSync(inPath)) {
  console.error(`파일이 없다: ${inPath}`)
  process.exit(1)
}
const outPath = path.resolve(arg('out', inPath.replace(/\.html?$/i, '-toc.html')))
const tmpDir = path.join(path.dirname(outPath), '_toc-tmp')

const src = fs.readFileSync(inPath, 'utf8')
// 머리말 제목 — `print-volume.mjs` 와 **같은 규칙**으로 읽는다(다르면 쪽 수가 어긋난다).
const TITLE = src.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, '').trim() ?? path.basename(inPath)

// ── 조판물 뜯기 ──────────────────────────────────────────────────────
// ⚠️ 정규식으로 HTML 을 뜯는 것은 일반적으로 나쁘지만, **이 입력은 우리가 만든 것**이고
//   구조가 `render-volume.mjs` 에 고정돼 있다(섹션이 겹치지 않는다). 파서를 들이는 값보다
//   구조가 바뀌면 아래 단언이 먼저 터지게 하는 편이 싸다.
// ⚠️ 조판물에는 **`<head>` 태그가 없다.** `<title>` 로 바로 시작해 브라우저가 알아서
//   head 를 만든다(실측 2026-09-01 — `<head` 로 찾으면 `<header class="cover">` 가 잡힌다).
//   그래서 "본문이 시작하기 전까지" 를 머리로 본다.
const WRAP_OPEN = '<div class="wrap">'
const wrapAt = src.indexOf(WRAP_OPEN)
const head = wrapAt >= 0 ? src.slice(0, wrapAt).trim() : ''
const cover = src.match(/<header class="cover"[\s\S]*?<\/header>/i)?.[0] ?? null
const units = [...src.matchAll(/<section class="unit"[\s\S]*?<\/section>/gi)].map((m) => m[0])
const answers = src.match(/<section class="answers"[\s\S]*?<\/section>/i)?.[0] ?? null
const colophon = src.match(/<footer class="colophon"[\s\S]*?<\/footer>/i)?.[0] ?? null

if (!head || !cover || !units.length) {
  console.error('조판물 구조를 못 알아봤다 — head/cover/unit 중 빠진 것이 있다.')
  console.error(`  head ${head ? 'O' : 'X'} · cover ${cover ? 'O' : 'X'} · unit ${units.length}`)
  process.exit(1)
}

/** 단원 제목 — `UNIT 03` 과 소요 시간. 없는 값을 지어내지 않는다. */
const unitLabels = units.map((u, i) => {
  const num = u.match(/<span class="unum">([\s\S]*?)<\/span>/i)?.[1]?.replace(/<[^>]+>/g, '').trim()
  const min = u.match(/<span class="umin">([\s\S]*?)<\/span>/i)?.[1]?.replace(/<[^>]+>/g, '').trim()
  const qs = (u.match(/<div class="q"/g) ?? []).length
  return { label: num || `UNIT ${String(i + 1).padStart(2, '0')}`, minutes: min || null, questions: qs }
})

// ── 차례 마크업 ──────────────────────────────────────────────────────
// 쪽 번호는 아래에서 실측한 뒤 채운다. 여기서는 **자리와 폭**을 먼저 정한다 —
// 차례 자체가 몇 쪽인지 재야 뒤 쪽 번호가 정해지기 때문이다.
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])
const tocStyle = `<style>
.toc{break-after:page}
.toc h2{font-size:1.3rem;margin:0 0 1.2rem}
.toc ol{list-style:none;margin:0;padding:0}
.toc li{display:flex;align-items:baseline;gap:.5rem;padding:.45rem 0;border-bottom:1px dotted var(--line)}
.toc .tlabel{font-weight:700;color:var(--accent);letter-spacing:.08em}
.toc .tmeta{color:var(--sub);font-size:.82rem}
.toc .tdots{flex:1;border-bottom:1px dotted var(--line);transform:translateY(-.25rem)}
.toc .tpage{font-variant-numeric:tabular-nums;font-weight:600}
@media print{.toc{break-after:page}}
</style>`

const tocHtml = (pages) => `<section class="toc">
  <h2>차례</h2>
  <ol>
${unitLabels
  .map(
    (u, i) => `    <li><span class="tlabel">${esc(u.label)}</span>` +
      `<span class="tmeta">${u.questions}문항${u.minutes ? ` · ${esc(u.minutes)}` : ''}</span>` +
      `<span class="tdots"></span><span class="tpage">${pages ? pages.units[i] : '—'}</span></li>`,
  )
  .join('\n')}
${answers ? `    <li><span class="tlabel">정답 및 해설</span><span class="tmeta"></span><span class="tdots"></span><span class="tpage">${pages ? pages.answers : '—'}</span></li>` : ''}
  </ol>
</section>`

// ── 조각별 쪽 수 실측 ────────────────────────────────────────────────
fs.mkdirSync(tmpDir, { recursive: true })
const printer = await openPrinter()
let failed = null

/** 조각 하나를 조판해 쪽 수를 센다. 원본 `<head>` 를 그대로 써야 쪽 수가 같다. */
async function measure(name, bodyHtml) {
  const f = path.join(tmpDir, `${name}.html`)
  fs.writeFileSync(f, fragmentHtml(head, bodyHtml), 'utf8')
  // ⚠️ **최종본과 같은 조건**으로 잰다 — 머리말·꼬리말이 세로 공간을 먹어 쪽 수가 달라진다.
  const buf = await printer.printFile(f, headerFooterOpts(TITLE))
  return pdfPageCount(buf)
}

try {
  process.stdout.write('조각 조판 중 ')
  const coverPages = await measure('cover', cover)
  process.stdout.write('.')
  // 차례는 쪽 번호가 아직 없는 판으로 잰다 — 숫자 유무가 줄 수를 바꾸지 않는다.
  const tocPages = await measure('toc', tocStyle + tocHtml(null))
  process.stdout.write('.')

  const unitPages = []
  for (const [i, u] of units.entries()) {
    unitPages.push(await measure(`unit-${String(i).padStart(2, '0')}`, u))
    process.stdout.write('.')
  }
  const answerPages = answers ? await measure('answers', answers) : 0
  if (answers) process.stdout.write('.')
  const colophonPages = colophon ? await measure('colophon', colophon) : 0
  if (colophon) process.stdout.write('.')
  console.log(' 끝')

  // ── 시작 쪽 계산 ───────────────────────────────────────────────────
  // 표지 → 차례 → 단원들 → 정답해설 → 판권면. 각자 새 쪽에서 시작한다.
  let cursor = coverPages + tocPages + 1
  const unitStart = []
  for (const p of unitPages) {
    unitStart.push(cursor)
    cursor += p
  }
  const answersStart = answers ? cursor : null
  const expectedTotal = coverPages + tocPages + unitPages.reduce((a, b) => a + b, 0) + answerPages + colophonPages

  // ── 차례를 넣은 완성본 ─────────────────────────────────────────────
  // 스타일은 본문 시작 **직전**에 넣는다 — 이 문서에는 `</head>` 가 없다.
  const withToc = src
    .replace(WRAP_OPEN, `${tocStyle}\n${WRAP_OPEN}`)
    // ⚠️ 쪽 번호를 **일부러 안 싣는다** — 머리말 주석 참조. 조판물이 쿼크 모드라
    //   doctype 을 넣는 순간 쪽 나눔이 바뀌어 지금 계산한 번호가 전부 무효가 된다.
    //   아래 `unitStart` 는 그 상태를 진단으로만 찍는다.
    .replace(cover, `${cover}\n${tocHtml(null)}`)
  fs.writeFileSync(outPath, withToc, 'utf8')

  // ── 검산: 통째로 조판한 쪽 수와 맞는가 ─────────────────────────────
  //
  // ⚠️ **자식 프로세스로 뽑는다.** 조각을 스물몇 번 인쇄한 **이 프로세스** 안에서는 큰
  //   문서 인쇄가 안 돌아온다(실측 2026-09-01: 조각 24개 뒤 180초 초과). 브라우저
  //   인스턴스를 새로 열어도, CDP 호출 타이머를 걷어도 마찬가지였다 — 원인은 브라우저가
  //   아니라 **이 Node 프로세스 쪽**에 쌓인 무엇이다. 같은 파일을 갓 띄운 프로세스로
  //   인쇄하면 158쪽이 10초에 나온다.
  //   원인을 더 캐는 것보다 **프로세스를 갈아 끼우는 편이 확실하고 싸다** — 검산은
  //   한 번만 돌고, `print-volume.mjs` 는 이미 이 일만 하는 도구다.
  printer.close()
  const verifyOut = await new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      [path.resolve('scripts/textbook/print-volume.mjs'), '--in', outPath, '--out', path.join(tmpDir, 'verify.pdf')],
      { timeout: 300000, encoding: 'utf8' },
      (err, stdout) => (err ? reject(new Error(`검산 인쇄 실패: ${err.message}`)) : resolve(stdout)),
    )
  })
  const whole = Number(verifyOut.match(/(\d+)\s*쪽/)?.[1] ?? 0)
  if (!whole) throw new Error(`검산 출력에서 쪽 수를 못 읽었다:\n${verifyOut}`)

  console.log(`\n${path.relative(process.cwd(), outPath)}`)
  console.log(`  표지 ${coverPages}쪽 · 차례 ${tocPages}쪽 · 단원 ${units.length}개 ${unitPages.reduce((a, b) => a + b, 0)}쪽 · 정답해설 ${answerPages}쪽 · 판권면 ${colophonPages}쪽`)
  console.log(`  (진단) 단원 시작 쪽 추정: ${unitStart.slice(0, 8).join(' · ')}${unitStart.length > 8 ? ' …' : ''}`)
  if (answersStart) console.log(`  (진단) 정답 및 해설: ${answersStart}쪽`)
  console.log(`  조각 합 ${expectedTotal}쪽 · 통째 조판 ${whole}쪽 — ${expectedTotal === whole ? '일치 ✅' : '어긋남 ❌'}`)

  if (expectedTotal !== whole) {
    console.log('\n⚠️ 조각 합과 통째 조판이 다르다 — 그래서 쪽 번호를 안 실었다.')
    console.log('   먼저 고칠 것: 조판물에 <!doctype html> 이 없어 브라우저가 쿼크 모드로 렌더한다')
    console.log('   (<title> 로 바로 시작한다 · <meta charset> 도 없다). 쿼크 모드는 상자 모델과')
    console.log('   줄 높이가 달라 쪽 나눔이 통째로 바뀐다 — doctype 을 넣으면 지금 값은 무효가 된다.')
    console.log('   그것부터 고친 뒤 이 도구를 다시 돌리면, 일치할 때 쪽 번호를 실을 수 있다.')
  } else {
    console.log('\n조각 합과 통째 조판이 일치한다 — 이제 쪽 번호를 실을 수 있다.')
  }
} catch (e) {
  console.error('\n차례 생성 실패:', e.message)
  failed = true
}

// printer 는 검산 직전에 닫았다(실패 경로에서만 여기서 닫힌다).
try { printer.close() } catch { /* 이미 닫혔다 */ }
try { fs.rmSync(tmpDir, { recursive: true, force: true }) } catch { /* 남아도 치명적이지 않다 */ }
process.exit(failed ? 1 : 0)
