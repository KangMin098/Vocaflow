// docs/design/explore/20260919/build.mjs
//
// 이미지 체계 Gate 3 — 발산 4안(A~D) HTML 생성기. 실행: node docs/design/explore/20260919/build.mjs
// 규칙 정본: docs/design/03-system.md §3-9 · 사전: docs/design/symbol-dictionary.md(#1 · #7 · #9 를 네 안이 같은 개념으로 그린다).
// 색은 전부 토큰(var(--…)) — hex 0. 토큰은 저장소의 tokens.css 를 상대 경로로 읽는다(파일을 브라우저로 열면 그대로 렌더).
// 참조 캡처(Tines)는 이 파일이 읽지도, 흉내 내지도 않는다(brief A2) — 소재는 종이 세계에서만.

import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const TOKENS = '../../../../packages/design-tokens/src/tokens.css'
// --memory-* · --learn-* 는 globals.css 에 있다. 브라우저는 @tailwind 등 모르는 at-rule 을 건너뛴다.
const GLOBALS = '../../../../apps/web/src/app/globals.css'

// ── 공통 붓 ────────────────────────────────────────────────────────────────
let uid = 0
const O = 'fill:none;stroke:var(--t1);stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round'
const I = 'fill:none;stroke:var(--t1);stroke-width:1;stroke-linecap:round;stroke-linejoin:round'
const IB = 'fill:none;stroke:var(--bd);stroke-width:1'
const NS = 'vector-effect="non-scaling-stroke"'
const spine = (x, y, w, h, fill) => paper(x, y, w, h, fill, 1) + line(x + 3, y + Math.min(10, h / 5), x + w - 3, y + Math.min(10, h / 5))
const paper = (x, y, w, h, fill = '--bg', r = 2) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" style="fill:var(${fill});${O.replace('fill:none;', '')}" ${NS}/>`
const line = (x1, y1, x2, y2, s = I) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" style="${s}" ${NS}/>`
const path = (d, s = I) => `<path d="${d}" style="${s}" ${NS}/>`
const txt = (x, y, t, { font = 'Lora', size = 13, fill = '--t1', anchor = 'start', weight = 500 } = {}) =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" style="font-family:${font},serif;font-size:${size}px;font-weight:${weight};fill:var(${fill})">${t}</text>`
const mono = (x, y, t, o = {}) => txt(x, y, t, { font: "'JetBrains Mono'", size: 10, weight: 400, ...o })
// 권점(圈點) — 주묵 테두리 원 하나. 액센트 한 점.
const gwon = (x, y, r = 4) =>
  `<g data-layer="accent"><circle cx="${x}" cy="${y}" r="${r}" style="fill:none;stroke:var(--ju);stroke-width:1.5" ${NS}/></g>`
const wash = (x, y, w, h) =>
  `<g data-layer="accent"><rect x="${x}" y="${y}" width="${w}" height="${h}" transform="skewX(-9)" transform-origin="${x + w / 2} ${y + h / 2}" style="fill:var(--ju-wash)"/></g>`
// 모눈 무대 — SVG <pattern> 만(CSS 그라디언트 금지 · §3-9)
function stage(w, h) {
  const id = `g${++uid}`
  return {
    id,
    defs: `<defs><pattern id="${id}" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" style="fill:none;stroke:var(--grid-line);stroke-width:1"/></pattern></defs>`,
    body: `<g data-layer="stage"><rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="6" style="fill:var(--bg)"/><rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="6" style="fill:url(#${id});stroke:var(--bd);stroke-width:1"/></g>`,
  }
}
function svg(w, h, title, inner, cls = '') {
  const s = stage(w, h)
  return `<svg class="illo ${cls}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-labelledby="t${s.id}"><title id="t${s.id}">${title}</title>${s.defs}${s.body}${inner}</svg>`
}
// F1 밑줄 — 두께가 곧 망각도(삽화 선이 아니라 데이터 표기라 2·3px 허용: 망각 계열만)
const decay = (x, y, w, st) => {
  const m = { stable: [1, 'solid'], shaky: [2, 'solid'], risk: [3, 'solid'], new: [2, 'dotted'] }[st]
  return `<line x1="${x}" y1="${y}" x2="${x + w}" y2="${y}" style="stroke:var(--memory-${st});stroke-width:${m[0]};${m[1] === 'dotted' ? 'stroke-dasharray:2 3;' : ''}stroke-linecap:butt" data-f1="${st}"/>`
}

// ── 네 안 ─────────────────────────────────────────────────────────────────
// 같은 세 개념: E #1 「단어장이 아직 비었다」 · S #7 「내가 아는 비율」 · B #9 「다시 보면 버틴다」

const WORDS = ['the', 'river', 'kept', 'its', 'quiet', 'promise', 'to', 'the', 'town']
const UNKNOWN = new Set(['promise']) // 지금 배울 낱말(주묵) — 그 밖 모르는 낱말은 --bg2
const SHADE = new Set(['quiet'])

const A = {
  key: 'A',
  name: '원고지',
  axis: '채색 지문',
  thesis: '모든 삽화의 큰 도형이 원고지 한 장이다. 무대의 모눈이 곧 원고지 칸이 되어, 낱말이 칸에 들어가고 모르는 칸이 칠해진다 — 지문 채색(랜딩·/fit 서명)과 같은 몸짓을 종이 위에서 한다.',
  signature: '원고지 칸 — 모르는 낱말의 칸만 칠해진다(주묵 붓 자국은 "지금" 한 칸)',
  E() {
    // 원고지 8칸 × 4줄, 첫 칸에 연필 끝 · 첫 칸 권점
    let g = `<g data-layer="main">${paper(72, 36, 192, 120)}`
    for (let c = 1; c < 8; c++) g += line(72 + c * 24, 36, 72 + c * 24, 156, IB)
    for (let r = 1; r < 5; r++) g += line(72, 36 + r * 24, 264, 36 + r * 24, IB)
    g += `</g><g data-layer="minor">`
    // 연필 — 위에서 본 육각 연필(직사각 + 깎인 끝)
    g += `<g transform="rotate(-28 150 150)">${paper(118, 146, 84, 12, '--bg2', 1)}${path('M118 146 L104 152 L118 158', O)}${line(108, 150, 108, 154, O)}${line(190, 146, 190, 158)}</g>`
    g += `</g><g data-layer="story">${txt(84, 54, 'w', { anchor: 'middle', size: 15 })}${path('M111 172 C 104 140 94 96 88 62', I)}</g>`
    g += gwon(96, 42, 3.5)
    return svg(320, 200, '단어장이 아직 비었다 — 원고지 첫 칸에 첫 낱말을 적는다', g)
  },
  S() {
    // 원고지 위 지문: 낱말 = 칸 묶음. 모르는 낱말 칸 --bg2, 지금 배울 낱말 붓 자국
    let g = `<g data-layer="main">${paper(24, 36, 192, 144)}`
    for (let c = 1; c < 8; c++) g += line(24 + c * 24, 36, 24 + c * 24, 180, IB)
    for (let r = 1; r < 6; r++) g += line(24, 36 + r * 24, 216, 36 + r * 24, IB)
    g += `</g><g data-layer="minor">`
    let col = 0, row = 0, acc = ''
    for (const w of WORDS) {
      const n = Math.max(1, Math.ceil(w.length / 2))
      if (col + n > 8) { row++; col = 0 }
      const x = 24 + col * 24, y = 36 + row * 24
      if (SHADE.has(w)) g += `<rect x="${x + 1}" y="${y + 1}" width="${n * 24 - 2}" height="22" style="fill:var(--bg2)"/>`
      if (UNKNOWN.has(w)) acc += wash(x + 2, y + 4, n * 24 - 4, 16)
      g += txt(x + (n * 24) / 2, y + 16, w, { anchor: 'middle', size: 12 })
      col += n + 1 // 원고지 띄어쓰기 = 빈 칸 하나
    }
    g += `</g><g data-layer="story">`
    // 학년 자 — 8 눈금, 손잡이는 4번째
    g += paper(24, 198, 192, 18, '--bg2', 1)
    for (let k = 0; k <= 8; k++) g += line(24 + k * 24, 198, 24 + k * 24, k % 2 ? 204 : 208)
    g += mono(28, 230, 'V3')
    g += mono(212, 230, 'V10', { anchor: 'end' })
    g += `</g>${acc}${gwon(24 + 4 * 24, 207, 5)}`
    return svg(240, 240, '내가 아는 비율 — 원고지 위 지문, 모르는 낱말 칸만 칠해진다', g)
  },
  B() {
    // 7일 원고지 띠: 같은 낱말을 날마다 한 칸에, 밑줄 두께 = 그날의 망각도(F1). 4일째 다시 봄.
    const days = ['stable', 'stable', 'shaky', 'stable', 'stable', 'stable', 'stable']
    const risk = ['stable', 'shaky', 'risk', 'risk', 'risk', 'risk', 'risk']
    let g = `<g data-layer="main">${paper(48, 48, 544, 144)}`
    for (let c = 1; c < 7; c++) g += line(48 + c * (544 / 7), 48, 48 + c * (544 / 7), 192, IB)
    g += line(48, 72, 592, 72, IB)
    g += `</g><g data-layer="minor">`
    days.forEach((st, i) => {
      const cx = 48 + i * (544 / 7) + 544 / 14
      g += mono(cx, 64, `${i + 1}일`, { anchor: 'middle' })
      g += txt(cx, 112, 'promise', { anchor: 'middle', size: 14 })
      g += decay(cx - 28, 120, 56, st)
      g += txt(cx, 164, 'promise', { anchor: 'middle', size: 14, fill: '--t1' })
      g += decay(cx - 28, 172, 56, risk[i])
    })
    g += `</g><g data-layer="story">${mono(40, 124, '다시 봄', { anchor: 'end' })}${mono(40, 176, '안 봄', { anchor: 'end' })}</g>`
    g += gwon(48 + 3 * (544 / 7) + 544 / 14, 88, 5)
    return svg(640, 240, '다시 보면 버틴다 — 같은 낱말의 밑줄이 7일 동안 얼마나 굵어지는가', g)
  },
}

const B = {
  key: 'B',
  name: '책갈피 끈',
  axis: '망각',
  thesis: '모든 삽화에 책갈피 끈 한 가닥이 놓이고, 그 끈의 모양이 R(t) 감쇠 곡선이다. 끈은 종이 위에 떨어져 있을 뿐인데 읽으면 "언제 잊는가" 가 된다.',
  signature: '책갈피 끈 = 감쇠 곡선 — 복습한 자리에서 끈이 다시 올라간다',
  E() {
    let g = `<g data-layer="main">${paper(64, 32, 96, 136)}${paper(160, 32, 96, 136)}`
    for (let r = 0; r < 6; r++) { g += line(76, 58 + r * 18, 148, 58 + r * 18, IB); g += line(172, 58 + r * 18, 244, 58 + r * 18, IB) }
    g += `</g><g data-layer="story">`
    // 끈: 위 가운데에서 떨어져 오른쪽 아래로 감쇠 모양
    const d = rt(172, 36, 84, 110, [0])
    g += path(d, O)
    g += `</g>` + gwon(172, 36)
    return svg(320, 200, '단어장이 아직 비었다 — 책갈피 끈이 첫 장에 놓여 있다', g)
  },
  S() {
    let g = `<g data-layer="main">${paper(24, 32, 192, 128)}`
    let x = 36, y = 56
    for (const w of WORDS) {
      const wd = w.length * 7 + 6
      if (x + wd > 206) { x = 36; y += 28 }
      g += txt(x, y, w, { size: 12 })
      if (SHADE.has(w)) g += decay(x, y + 5, wd - 6, 'new')
      if (UNKNOWN.has(w)) g += decay(x, y + 5, wd - 6, 'new') + gwon(x + (wd - 6) / 2, y - 16, 3.5)
      x += wd
    }
    g += `</g><g data-layer="story">${path(rt(24, 172, 192, 44, []), O)}${mono(24, 230, '오늘')}${mono(216, 230, '7일', { anchor: 'end' })}</g>`
    return svg(240, 240, '내가 아는 비율 — 모르는 낱말은 점선 밑줄, 끈은 그 낱말이 7일 동안 흐려지는 모양', g)
  },
  B() {
    let g = `<g data-layer="main">${paper(48, 40, 544, 160)}`
    for (let i = 0; i <= 7; i++) g += line(48 + i * (544 / 7), 184, 48 + i * (544 / 7), 190)
    g += `</g><g data-layer="minor">`
    for (let i = 0; i < 7; i++) g += mono(48 + i * (544 / 7) + 4, 214, `${i + 1}일`)
    g += `</g><g data-layer="story">`
    g += path(rt(48, 56, 544, 120, []), I + ';stroke-dasharray:2 3')
    g += path(rt(48, 56, 544, 120, [3 / 7]), O)
    g += `</g>` + gwon(48 + 3 * (544 / 7), 56, 5)
    return svg(640, 240, '다시 보면 버틴다 — 4일째 다시 본 자리에서 끈이 올라간다(점선은 안 봤을 때)', g)
  },
}
// R(t) = exp(ln(0.9)·t/S) — 끈 모양. reviews: 0~1 위치에서 다시 1 로(안정도 2.5배)
function rt(x, y, w, h, reviews) {
  const pts = []
  let S = 2, t0 = 0, n = 48
  const rv = [...reviews].sort()
  for (let i = 0; i <= n; i++) {
    const u = i / n
    while (rv.length && u >= rv[0]) { t0 = rv.shift(); S *= 2.5 }
    const R = Math.exp((Math.log(0.9) * (u - t0) * 7) / S * 3.2)
    pts.push(`${(x + u * w).toFixed(1)} ${(y + (1 - R) * h).toFixed(1)}`)
  }
  return 'M' + pts.join(' L')
}

const C = {
  key: 'C',
  name: '교정 부호',
  axis: '주묵 문법',
  thesis: '모든 삽화의 큰 도형이 교정지(시험지 단)이고, 주묵은 교정자의 붓처럼 한 획만 긋는다. 그 한 획은 형태 문법의 뜻(지지·배제·유인·합류) 가운데 하나다.',
  signature: '주묵 한 획 — 종이 위 근거에서 목적지로 긋는 실선+화살표',
  E() {
    let g = `<g data-layer="main">${paper(88, 28, 192, 144)}`
    for (let r = 0; r < 6; r++) g += line(104, 60 + r * 18, 264, 60 + r * 18, IB)
    g += line(104, 44, 200, 44, I)
    g += `</g><g data-layer="minor">${paper(28, 60, 44, 28, '--bg2', 1)}${txt(50, 78, '첫 낱말', { font: 'Hahmlet', size: 9, anchor: 'middle', weight: 500 })}</g>`
    // 「지금」 교정 삽입 부호(∨) — 난외 쪽지에서 첫 줄로
    g += `<g data-layer="story">${path('M72 74 C 86 74 92 60 104 60', I)}</g>`
    g += `<g data-layer="accent">${path('M98 54 L104 60 L98 66', 'fill:none;stroke:var(--ju);stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round')}${path('M72 74 C 86 74 92 60 103 60', 'fill:none;stroke:var(--ju);stroke-width:1.5;stroke-linecap:round')}</g>`
    return svg(320, 200, '단어장이 아직 비었다 — 난외 쪽지의 첫 낱말이 첫 줄로 들어간다', g)
  },
  S() {
    let g = `<g data-layer="main">${paper(24, 32, 124, 176)}${paper(156, 32, 60, 176, '--bg2')}`
    let x = 34, y = 56
    for (const w of WORDS) {
      const wd = w.length * 6.6 + 5
      if (x + wd > 142) { x = 34; y += 24 }
      if (SHADE.has(w) || UNKNOWN.has(w)) g += `<rect x="${x - 2}" y="${y - 11}" width="${wd - 1}" height="15" style="fill:var(--bg2)"/>`
      g += txt(x, y, w, { size: 11 })
      if (UNKNOWN.has(w)) C._pw = [x + wd - 6, y - 4]
      x += wd
    }
    g += `</g><g data-layer="minor">${txt(186, 72, '약속', { font: 'Hahmlet', size: 11, anchor: 'middle' })}${mono(164, 56, '①')}${txt(186, 112, '조용한', { font: 'Hahmlet', size: 11, anchor: 'middle' })}${mono(164, 96, '②')}</g>`
    const [px, py] = C._pw
    g += `<g data-layer="accent">${path(`M${px + 2} ${py - 2} C ${px + 16} ${py - 16} 150 64 170 70`, 'fill:none;stroke:var(--ju);stroke-width:1.5;stroke-linecap:round')}${path('M165 65 L171 70 L165 75', 'fill:none;stroke:var(--ju);stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round')}</g>`
    return svg(240, 240, '내가 아는 비율 — 모르는 낱말이 칠해지고, 지금 배울 한 낱말에서 난외 뜻으로 주묵 한 획', g)
  },
  B() {
    let g = `<g data-layer="main">`
    for (let i = 0; i < 7; i++) {
      const x = 56 + i * 78
      g += paper(x, 56, 64, 128, i === 3 ? '--bg' : '--bg')
      g += mono(x + 32, 76, `${i + 1}일`, { anchor: 'middle' })
      g += txt(x + 32, 124, 'promise', { anchor: 'middle', size: 12 })
      g += decay(x + 8, 132, 48, ['stable', 'shaky', 'risk', 'stable', 'stable', 'stable', 'shaky'][i])
    }
    g += `</g><g data-layer="story">${path('M88 150 C 120 176 280 176 322 150', I + ';stroke-dasharray:2 3')}</g>`
    g += `<g data-layer="accent">${path('M88 150 C 120 176 280 176 320 152', 'fill:none;stroke:var(--ju);stroke-width:1.5;stroke-linecap:round')}${path('M312 150 L321 151 L317 159', 'fill:none;stroke:var(--ju);stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round')}</g>`
    return svg(640, 240, '다시 보면 버틴다 — 1일째 기록이 4일째 다시 보기를 받친다(주묵 실선)', g)
  },
}

const D = {
  key: 'D',
  name: '책등',
  axis: '환경 변형',
  thesis: '모든 삽화의 큰 도형이 선반이고, 책등의 높이가 곧 안정도다. 성장은 숫자가 아니라 선반이 차오르는 모양으로 보인다(철학 4 Implicit Progress).',
  signature: '책등 높이 = 버티는 기간 — 새 자리는 점선 책등(F1 new)',
  E() {
    let g = `<g data-layer="main">${paper(48, 144, 224, 12, '--bg2', 1)}${line(48, 144, 272, 144, O)}</g><g data-layer="minor">`
    // 첫 자리 — 점선 책등(new)
    g += `<rect x="72" y="72" width="20" height="72" style="fill:none;stroke:var(--memory-new);stroke-width:2;stroke-dasharray:2 3" data-f1="new"/>`
    g += path('M232 144 V96 H244', O) + paper(66, 162, 32, 10, '--bg', 1)
    g += `</g><g data-layer="story">${line(100, 140, 226, 140, IB)}</g>` + gwon(82, 60)
    return svg(320, 200, '단어장이 아직 비었다 — 선반의 첫 자리가 점선으로 비어 있다', g)
  },
  S() {
    let g = `<g data-layer="main">${paper(24, 32, 112, 96)}${paper(136, 32, 80, 96)}`
    let x = 32, y = 52
    for (const w of WORDS.slice(0, 6)) {
      const wd = w.length * 6.4 + 5
      if (x + wd > 130) { x = 32; y += 20 }
      if (SHADE.has(w) || UNKNOWN.has(w)) g += `<rect x="${x - 2}" y="${y - 10}" width="${wd - 1}" height="14" style="fill:var(--bg2)"/>`
      g += txt(x, y, w, { size: 10.5 })
      x += wd
    }
    for (let r = 0; r < 4; r++) g += line(144, 52 + r * 18, 208, 52 + r * 18, IB)
    g += `</g><g data-layer="minor">${line(24, 204, 216, 204, O)}`
    const H = [20, 28, 36, 44, 52, 58, 62, 64]
    H.forEach((h, i) => { g += spine(28 + i * 24, 204 - h, 18, h, i === 3 ? '--bg' : '--bg2') })
    g += mono(28, 222, 'V3')
    g += mono(216, 222, 'V10', { anchor: 'end' })
    g += `</g>` + gwon(28 + 3 * 24 + 9, 204 - 44 - 10, 4)
    return svg(240, 240, '내가 아는 비율 — 펼친 책 옆 학년 책등 8권, 이 글에 맞는 한 권에 권점', g)
  },
  B() {
    let g = `<g data-layer="main">${line(48, 192, 592, 192, O)}${paper(48, 192, 544, 10, '--bg2', 1)}</g><g data-layer="minor">`
    const R = (u, rev) => { const S = rev ? 5 : 2; return Math.exp(Math.log(0.9) * u * 22 / S) }
    for (let i = 0; i < 7; i++) {
      const base = 64 + i * 76
      const h1 = 128 * R(i / 7, false), h2 = 128 * (i < 3 ? R(i / 7, false) : R((i - 3) / 7, true))
      g += spine(base, 192 - h1, 22, h1, '--bg2')
      g += spine(base + 26, 192 - h2, 22, h2, '--bg')
      g += mono(base + 24, 220, `${i + 1}일`, { anchor: 'middle' })
    }
    g += `</g><g data-layer="story">${mono(592, 40, '왼쪽 그늘 책등 = 안 봄 · 오른쪽 흰 책등 = 다시 봄', { anchor: 'end' })}</g>` + gwon(64 + 3 * 76 + 37, 192 - 128 - 12, 5)
    return svg(640, 240, '다시 보면 버틴다 — 4일째 다시 본 뒤 책등이 다시 높아진다', g)
  },
}

// ── 해부 화면(390) ───────────────────────────────────────────────────────────
const SECTION_TITLE = '읽기 전에, 내가 아는 비율부터'
const SECTION_BODY = '붙여 넣은 글의 낱말마다 학년 수준을 계산해, 모르는 낱말만 칠해 보여 줍니다.'
function anatomy(d) {
  return `
<div class="phone" aria-label="390px 해부 화면">
  <section class="sec band">
    <h2 class="h">${SECTION_TITLE}</h2>
    <div class="illo-wrap">${d.S()}</div>
    <p class="p">${SECTION_BODY}</p>
    <a class="next" href="#">내 글로 해 보기 →</a>
  </section>
  <section class="sec">
    <div class="empty">
      <div class="illo-wrap e">${d.E()}</div>
      <p class="say">단어장이 아직 비어 있어요.</p>
      <p class="p">읽던 글에서 낱말을 누르면 여기에 모입니다.</p>
      <button class="cta" type="button">첫 글 열기</button>
    </div>
  </section>
</div>`
}
function page(d) {
  uid = 0
  const an = anatomy(d)
  const s = d.S(), e = d.E(), b = d.B()
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${d.key} ${d.name} — 이미지 체계 발산</title>
<link rel="stylesheet" href="${TOKENS}">
<link rel="stylesheet" href="${GLOBALS}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Hahmlet:wght@500;600&family=IBM+Plex+Sans+KR:wght@400;500;600&family=JetBrains+Mono:wght@400&family=Lora:ital,wght@0,500;1,500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="./explore.css">
</head>
<body data-direction="${d.key}">
<header class="head">
  <p class="k">${d.key} · ${d.axis}</p>
  <h1>${d.name}</h1>
  <p class="thesis">${d.thesis}</p>
  <p class="sig"><span>서명</span> ${d.signature}</p>
</header>
<main class="grid">
  <div class="col">${an}</div>
  <div class="col">
    <figure><figcaption>S 스팟 240 · 사전 #7</figcaption>${s}</figure>
    <figure><figcaption>E 빈 상태 320×200 · 사전 #1</figcaption>${e}</figure>
    <figure class="wide"><figcaption>B 띠 640×240 · 사전 #9</figcaption>${b}</figure>
    <figure class="dark" data-theme="dark"><figcaption>다크 — 같은 SVG, 토큰만 뒤집힘</figcaption>${d.S()}</figure>
  </div>
</main>
</body></html>`
}

// 방향 A 확정(DD-30) — Gate 5 시범(docs/design/trial/20260919/build.mjs)이 붓과 A 를 그대로 가져다 쓴다.
export { A, O, I, IB, NS, paper, line, path, txt, mono, gwon, wash, svg, decay, WORDS, UNKNOWN, SHADE }

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const d of [A, B, C, D]) writeFileSync(join(HERE, `${d.key}.html`), page(d))
  console.log('wrote A B C D')
}
