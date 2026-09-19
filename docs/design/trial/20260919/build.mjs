// docs/design/trial/20260919/build.mjs
//
// 이미지 체계 Gate 5 — 방향 A 「원고지」(DD-30) 시범 12점 생성기. 실행: node docs/design/trial/20260919/build.mjs
// 출력: svg/<manifest id>.svg 12장 · sheet.html(240px 시트). 검사: node scripts/design/style-gate.mjs docs/design/trial/20260919/svg
//
// 12점 = A 발산안 3점 재사용(#7 · #1 · #9 — explore/20260919/build.mjs 의 A 를 그대로 호출) + manifest `trial` 9점.
// 공통 뼈대(03-system §3-9): 모눈 무대 → 큰 도형(원고지 한 장) → 작은 도형 2~3 → 이야기 선 → 액센트 한 점.
// C 의 주묵 한 획은 A 의 이야기 선 어휘로 흡수(DD-30) — 근거→목적지 관계를 그리는 #10 에서만 쓰고, 그때 그 획이 액센트다.
// 색은 전부 토큰, 글자는 실제 낱말만(Lora 영어 · Hahmlet 한글 · JetBrains Mono 숫자).

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { A, O, I, IB, paper, line, path, txt, mono, gwon, wash, svg, decay } from '../../explore/20260919/build.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const MANIFEST = JSON.parse(readFileSync(join(HERE, '../../asset-manifest.json'), 'utf8'))
const JU = 'fill:none;stroke:var(--ju);stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round'

// 원고지 한 장 — 종이 + 24px 칸(--bd). 큰 도형의 공통 몸.
function wongo(x, y, cols, rows, fill = '--bg') {
  let g = paper(x, y, cols * 24, rows * 24, fill)
  for (let c = 1; c < cols; c++) g += line(x + c * 24, y, x + c * 24, y + rows * 24, IB)
  for (let r = 1; r < rows; r++) g += line(x, y + r * 24, x + cols * 24, y + r * 24, IB)
  return g
}
const cell = (x, y, c, r, n = 1, fill = '--bg2') =>
  `<rect x="${x + c * 24 + 1}" y="${y + r * 24 + 1}" width="${n * 24 - 2}" height="22" style="fill:var(${fill})"/>`
const word = (x, y, c, r, w, n, o = {}) => txt(x + c * 24 + (n * 24) / 2, y + r * 24 + 16, w, { anchor: 'middle', size: 12, ...o })
const ko = (x, y, t, o = {}) => txt(x, y, t, { font: 'Hahmlet', size: 11, weight: 500, ...o })

const NEW = {
  // #2 첫 글을 넣어 보자 — 붙여 넣은 쪽지의 문장이 원고지 첫 줄로 들어가고, 모르는 한 낱말만 칠해진다
  'illo-02-text-hub-first'(t) {
    const X = 72, Y = 36
    let g = `<g data-layer="main">${wongo(X, Y, 9, 5)}</g><g data-layer="minor">`
    g += word(X, Y, 0, 0, 'Once', 2) + word(X, Y, 3, 0, 'upon', 2) + word(X, Y, 6, 0, 'a', 1)
    g += paper(24, 132, 64, 40, '--bg2', 1) + txt(56, 150, 'Once upon', { anchor: 'middle', size: 10 }) + txt(56, 164, 'a time…', { anchor: 'middle', size: 10 })
    g += `</g><g data-layer="story">${path('M56 132 C 56 96 60 60 72 50', I)}</g>`
    g += wash(X + 3 * 24 + 3, Y + 4, 42, 16)
    return svg(320, 200, t, g)
  },
  // #3 이 조건의 책이 없다 — 학년 칸 머리(V3~V10) 아래가 비어 있고, 자의 범위를 양쪽으로 넓힌다
  'illo-03-shelf-filter-zero'(t) {
    const X = 64, Y = 32
    let g = `<g data-layer="main">${wongo(X, Y, 8, 4)}${cell(X, Y, 3, 0, 2)}`
    ;['V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10'].forEach((v, i) => { g += mono(X + i * 24 + 12, Y + 15, v, { anchor: 'middle', size: 8.5 }) })
    g += `</g><g data-layer="minor">${paper(X, 144, 192, 16, '--bg2', 1)}`
    for (let k = 0; k <= 8; k++) g += line(X + k * 24, 144, X + k * 24, k % 2 ? 149 : 152)
    g += `</g><g data-layer="story">${path(`M${X + 3 * 24 - 6} 172 L${X + 3 * 24 - 14} 172 M${X + 3 * 24 - 10} 168 L${X + 3 * 24 - 14} 172 L${X + 3 * 24 - 10} 176`, I)}${path(`M${X + 5 * 24 + 6} 172 L${X + 5 * 24 + 14} 172 M${X + 5 * 24 + 10} 168 L${X + 5 * 24 + 14} 172 L${X + 5 * 24 + 10} 176`, I)}${line(X + 3 * 24, 172, X + 5 * 24, 172)}</g>`
    g += gwon(X + 4 * 24, 152, 4)
    return svg(320, 200, t, g)
  },
  // #4 받아쓸 글을 고르자 — 윗줄에 인쇄된 낱말, 아랫줄은 낱말 길이만큼 괘선이 끊긴 빈칸
  'illo-04-dictation-choose'(t) {
    const X = 52, Y = 44
    let g = `<g data-layer="main">${wongo(X, Y, 9, 4)}</g><g data-layer="minor">`
    g += word(X, Y, 0, 0, 'listen', 3) + word(X, Y, 4, 0, 'and', 2) + word(X, Y, 7, 0, 'write', 2)
    for (const [c, n] of [[0, 3], [4, 2], [7, 2]]) g += cell(X, Y, c, 1, n)
    g += `</g><g data-layer="story">`
    for (const [c, n] of [[0, 3], [4, 2], [7, 2]]) g += line(X + c * 24 + 4, Y + 2 * 24 - 4, X + (c + n) * 24 - 4, Y + 2 * 24 - 4, O)
    g += `</g>` + gwon(X + 12, Y + 36, 4)
    return svg(320, 200, t, g)
  },
  // #30 오늘 복습할 것이 없다 — 7칸 달력 원고지, 오늘 칸은 비고 다음 복습일(4일) 칸에 권점
  'illo-30-no-review-today'(t) {
    // 머리 칸 1 + 7일 = 8칸(큰 도형 60% — §3-9 비례)
    const X0 = 64, X = X0 + 24, Y = 52
    let g = `<g data-layer="main">${wongo(X0, Y, 8, 3)}</g><g data-layer="minor">`
    g += ko(X0 + 12, Y + 16, '일', { anchor: 'middle', size: 10 })
    for (let i = 0; i < 7; i++) g += mono(X + i * 24 + 12, Y + 15, `${i + 1}`, { anchor: 'middle', size: 9 })
    g += cell(X, Y, 0, 1, 1) + ko(X + 12, Y + 3 * 24 + 26, '오늘', { anchor: 'middle', size: 10 })
    g += `</g><g data-layer="story">${line(X + 12, Y + 3 * 24 + 8, X + 3 * 24 + 12, Y + 3 * 24 + 8)}${line(X + 12, Y + 3 * 24 + 4, X + 12, Y + 3 * 24 + 12)}${line(X + 3 * 24 + 12, Y + 3 * 24 + 4, X + 3 * 24 + 12, Y + 3 * 24 + 12)}</g>`
    g += gwon(X + 3 * 24 + 12, Y + 36, 5)
    return svg(320, 200, t, g)
  },
  // #10 근거가 정답을 가리킨다 — 원고지 지문의 한 낱말에서 선택지 ③ 으로 주묵 실선+화살표(C 흡수)
  'illo-10-evidence-points'(t) {
    const X = 24, Y = 28
    let g = `<g data-layer="main">${wongo(X, Y, 8, 3)}${paper(X, 116, 192, 100)}</g><g data-layer="minor">`
    g += word(X, Y, 0, 0, 'the', 2) + word(X, Y, 2, 0, 'town', 2) + word(X, Y, 4, 0, 'kept', 2) + word(X, Y, 6, 0, 'its', 2)
    g += word(X, Y, 0, 1, 'promise', 4)
    ;['①', '②', '③', '④', '⑤'].forEach((n, i) => {
      g += mono(X + 12, 136 + i * 18, n, { size: 10 })
      g += line(X + 32, 132 + i * 18, X + (i === 2 ? 120 : 96 + (i % 2) * 40), 132 + i * 18, IB)
    })
    g += ko(X + 132, 172, '약속을 지켰다', { size: 9.5 })
    g += `</g><g data-layer="accent">${path(`M${X + 80} ${Y + 46} C ${X + 112} ${Y + 80} ${X + 150} ${Y + 110} ${X + 128} 164`, JU)}${path(`M${X + 124} 157 L${X + 128} 164 L${X + 135} 160`, JU)}</g>`
    return svg(240, 240, t, g)
  },
  // #14 학급에 나눠 줄 한 장 — 세로 원고지 한 장, 머리에 도장, 오른쪽 난외에 번호 붙은 뜻
  'illo-14-class-sheet'(t) {
    const X = 36, Y = 24
    let g = `<g data-layer="main">${wongo(X, Y, 6, 8)}${paper(X + 6 * 24 + 8, Y + 24, 36, 144, '--bg2')}</g><g data-layer="minor">`
    g += word(X, Y, 0, 2, 'the', 2) + word(X, Y, 2, 2, 'river', 3) + word(X, Y, 0, 3, 'kept', 2) + word(X, Y, 3, 3, 'its', 2) + word(X, Y, 0, 4, 'promise', 4)
    g += mono(X + 6 * 24 + 14, Y + 124, '①', { size: 9 }) + ko(X + 6 * 24 + 26, Y + 140, '약속', { anchor: 'middle', size: 9 })
    g += `</g><g data-layer="story">${line(X + 4 * 24, Y + 4 * 24 + 12, X + 6 * 24 + 8, Y + 4 * 24 + 12)}</g>`
    g += `<g data-layer="accent"><rect x="${X + 4 * 24 + 4}" y="${Y + 4}" width="40" height="40" rx="2" style="${JU}"/>${ko(X + 4 * 24 + 24, Y + 31, '고2', { anchor: 'middle', size: 15, fill: '--ju' })}</g>`
    return svg(240, 240, t, g)
  },
  // #8 잊는 속도는 낱말마다 다르다 — 같은 낱말 세 줄, 밑줄 두께 3/2/1px(F1 그대로), 오늘 다시 본 줄에 권점
  'illo-08-decay-per-word'(t) {
    const X = 48, Y = 36
    let g = `<g data-layer="main">${wongo(X, Y, 6, 7)}</g><g data-layer="minor">`
    const R = [['recall', 'risk'], ['recall', 'shaky'], ['recall', 'stable']]
    R.forEach(([w, st], i) => { g += word(X, Y, 1, i * 2 + 1, w, 4, { size: 13 }) + decay(X + 32, Y + (i * 2 + 1) * 24 + 21, 80, st) })
    g += `</g><g data-layer="story">${mono(X - 6, Y + 40, '9일', { anchor: 'end', size: 9 })}${mono(X - 6, Y + 88, '4일', { anchor: 'end', size: 9 })}${mono(X - 6, Y + 136, '오늘', { anchor: 'end', size: 9, font: 'Hahmlet' })}</g>`
    g += gwon(X + 5 * 24 + 12, Y + 5 * 24 + 12, 5)
    return svg(240, 240, t, g)
  },
  // #19 서가가 차오른다 — 원고지 칸이 아래 줄부터 차오르고, 이번 주에 찬 마지막 칸에 권점
  'illo-19-shelf-fills'(t) {
    const X = 24, Y = 40
    let g = `<g data-layer="main">${wongo(X, Y, 8, 6)}</g><g data-layer="minor">`
    const fillTo = [0, 1, 3, 6, 8, 8] // 위 줄부터 찬 칸 수
    fillTo.forEach((n, r) => { if (n) g += cell(X, Y, 0, r, n) })
    g += word(X, Y, 0, 5, 'river', 3, { size: 11 }) + word(X, Y, 3, 5, 'quiet', 3, { size: 11 }) + word(X, Y, 0, 4, 'kept', 2, { size: 11 })
    g += `</g><g data-layer="story">${line(X - 8, Y + 2 * 24, X + 8 * 24 + 8, Y + 2 * 24)}${ko(X + 8 * 24, Y - 8, '이번 주까지', { anchor: 'end', size: 9 })}</g>`
    g += gwon(X + 2 * 24 + 12, Y + 2 * 24 + 12, 5)
    return svg(240, 240, t, g)
  },
  // #16 교육과정 밖 낱말 — 원고지에서 비어 버린 칸, 그 낱말은 난외로 옮겨 적힌다
  'illo-16-off-curriculum'(t) {
    const X = 24, Y = 36
    let g = `<g data-layer="main">${wongo(X, Y, 6, 6)}${paper(X + 6 * 24 + 12, Y, 44, 144, '--bg2')}</g><g data-layer="minor">`
    g += word(X, Y, 0, 0, 'the', 2) + cell(X, Y, 2, 0, 3) + word(X, Y, 0, 2, 'kept', 2) + cell(X, Y, 3, 2, 3) + word(X, Y, 0, 4, 'the', 2) + word(X, Y, 2, 4, 'town', 2)
    const M = X + 6 * 24 + 34
    g += txt(M + 4, Y + 32, 'pledge', { anchor: 'middle', size: 10.5 }) + txt(M, Y + 76, 'solemn', { anchor: 'middle', size: 10.5 })
    g += `</g><g data-layer="story">${line(X + 5 * 24, Y + 12, X + 6 * 24 + 12, Y + 24)}${line(X + 6 * 24, Y + 60, X + 6 * 24 + 12, Y + 72)}</g>`
    g += gwon(M + 4, Y + 13, 3) // 낱말 위 — 글자와 4px 이상 떨어진다
    return svg(240, 240, t, g)
  },
}

// #15 이 글의 적정 학년 — 학년 칸 머리(V3~V10) 원고지 위에 글 한 장이 맞는 칸으로 정렬되고, 그 칸에 도장
NEW['illo-15-fit-grade'] = (t) => {
  const X = 24, Y = 40
  let g = `<g data-layer="main">${wongo(X, Y, 8, 6)}`
  ;['V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10'].forEach((v, i) => { g += mono(X + i * 24 + 12, Y + 15, v, { anchor: 'middle', size: 8.5 }) })
  g += `</g><g data-layer="minor">${paper(X + 3 * 24 + 4, Y + 30, 64, 84, '--bg', 1)}`
  for (let r = 0; r < 4; r++) g += line(X + 3 * 24 + 12, Y + 48 + r * 18, X + 5 * 24 - 4, Y + 48 + r * 18, IB)
  g += txt(X + 4 * 24 + 4, Y + 46, 'river', { anchor: 'middle', size: 10.5 })
  g += `</g><g data-layer="story">${line(X + 3 * 24 + 4, Y + 24, X + 3 * 24 + 4, Y + 30)}${line(X + 5 * 24 + 4, Y + 24, X + 5 * 24 + 4, Y + 30)}</g>`
  g += `<g data-layer="accent"><rect x="${X + 3 * 24 + 22}" y="${Y + 118}" width="28" height="24" rx="2" style="${JU}"/>${ko(X + 3 * 24 + 36, Y + 135, '고2', { anchor: 'middle', size: 10.5, fill: '--ju' })}</g>`
  return svg(240, 240, t, g)
}

// 시범 12점(Gate 5) — manifest 상태가 바뀌어도 시트는 같은 12점으로 다시 굽는다
const TRIAL_IDS = ['illo-01-wordbook-empty', 'illo-02-text-hub-first', 'illo-03-shelf-filter-zero', 'illo-04-dictation-choose', 'illo-07-coverage', 'illo-08-decay-per-word', 'illo-09-review-holds', 'illo-10-evidence-points', 'illo-14-class-sheet', 'illo-16-off-curriculum', 'illo-19-shelf-fills', 'illo-30-no-review-today']
const REUSE = { 'illo-07-coverage': () => A.S(), 'illo-01-wordbook-empty': () => A.E(), 'illo-09-review-holds': () => A.B() }
export { NEW, REUSE }

const isMain = import.meta.url === pathToFileURL(process.argv[1]).href
const trial = isMain ? MANIFEST.items.filter((i) => ['trial'].includes(i.status) || (i.source && i.status !== 'blocked')) : []
if (isMain) mkdirSync(join(HERE, 'svg'), { recursive: true })
const made = []
for (const it of isMain ? TRIAL_IDS.map((id) => MANIFEST.items.find((x) => x.id === id)) : []) {
  const title = `${it.concept} — ${it.verb}`
  const fn = REUSE[it.id] ?? NEW[it.id]
  if (!fn) throw new Error(`그릴 함수 없음: ${it.id}`)
  let s = REUSE[it.id] ? fn() : fn(title)
  s = s.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ').replace(/ width="\d+" height="\d+"/, '')
  writeFileSync(join(HERE, 'svg', `${it.id}.svg`), s + '\n')
  made.push({ it, s })
}

// 240px 시트 — 12점을 폭 240 으로 맞춰 4열
const T = '../../../../packages/design-tokens/src/tokens.css', G = '../../../../apps/web/src/app/globals.css'
const cards = made.map(({ it, s }) => `<figure><div class="f">${s}</div><figcaption><b>#${it.dict}</b> ${it.concept}<br><span>${it.size} · ${it.id.replace(/^illo-\d+-/, '')}${it.source ? ' · A 재사용' : ''}</span></figcaption></figure>`).join('\n')
if (isMain) writeFileSync(join(HERE, 'sheet.html'), `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>시범 12점 — 240px 시트</title>
<link rel="stylesheet" href="${T}"><link rel="stylesheet" href="${G}">
<link href="https://fonts.googleapis.com/css2?family=Hahmlet:wght@500;600&family=IBM+Plex+Sans+KR:wght@400;500&family=JetBrains+Mono:wght@400&family=Lora:wght@500&display=swap" rel="stylesheet">
<style>body{margin:0;padding:24px;background:var(--bg2);color:var(--t1);font-family:'IBM Plex Sans KR',sans-serif;word-break:keep-all;width:${4 * 240 + 3 * 16}px}
h1{font:600 20px Hahmlet,serif;margin:0 0 16px}.g{display:grid;grid-template-columns:repeat(4,240px);gap:24px 16px}
figure{margin:0}.f{width:240px;height:150px;display:flex;align-items:center;justify-content:center}.f svg{max-width:240px;max-height:150px;width:auto;height:auto}
figcaption{font-size:12px;line-height:1.45;margin-top:6px}figcaption span{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--t2)}</style></head>
<body><h1>방향 A 「원고지」 — 시범 12점 (240px)</h1><div class="g">${cards}</div></body></html>`)
if (isMain) console.log(`wrote ${made.length} svg + sheet.html`)
