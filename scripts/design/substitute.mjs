#!/usr/bin/env node
// scripts/design/substitute.mjs
//
// 치환표를 **만든다**(DD-62 Stage 3 ①색).
// 참조 사이트의 색값 하나하나에 우리 토큰 중 ΔE2000 이 가장 가까운 것을 붙인다.
//
//   node scripts/design/substitute.mjs
//
// 산출: docs/design/refs/substitution.json  (원값 → 토큰명 → ΔE)
//
// 손으로 고르지 않는 이유: 눈으로 고르면 "우리 팔레트가 원래 이런 색이라서 비슷해 보이는 것" 과
// "참조 구조에 우리 색을 넣었더니 성립하는 것" 이 섞인다. 사람 판단 ① 이 봐야 하는 것은 후자다.
//
// 후보 풀에서 빼는 것(넣으면 판정이 무의미해진다):
//   · `--ios-*` · `--combo` · `--streak` · `--gold`/`--silver`/`--bronze` — 아케이드/게임 팔레트 예외 구역
//   · `--admin` · `--admin-strong` — 옛 AI-보라(#8B5CF6). DD-01·DD-59 로 **신규 사용 금지**.
//     참조 사이트의 액센트가 보라라서 ΔE 만 보면 반드시 여기로 붙는다 — 금지된 색을 기계가 되살리는 길이다.

import fs from 'node:fs'
import path from 'node:path'
import { ROOT } from './lib/ref-page.mjs'

const TOKENS = path.join(ROOT, 'packages/design-tokens/src/tokens.css')
const REFS = path.join(ROOT, 'docs/design/refs')
const COMPUTED = path.join(REFS, 'tines/computed.json')
const OUT = path.join(REFS, 'substitution.json')

const DENY = [/^--ios-/, /^--combo$/, /^--streak$/, /^--gold$/, /^--silver$/, /^--bronze$/, /^--admin/]

// ── 우리 토큰 (라이트 :root 블록만) ────────────────────────────────────────
function ourTokens() {
  const css = fs.readFileSync(TOKENS, 'utf8')
  const start = css.indexOf(':root')
  const darkAt = css.search(/\n\[data-theme="dark"\]|\nhtml\[data-theme/)
  const light = css.slice(start, darkAt > 0 ? darkAt : undefined)
  const out = []
  for (const m of light.matchAll(/^\s*(--[a-z0-9-]+):\s*(#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3})\s*;/gm)) {
    const [, name, hex] = m
    if (DENY.some((re) => re.test(name))) continue
    out.push({ name, hex: expand(hex).toLowerCase() })
  }
  // 같은 색을 가리키는 토큰이 여럿이면 이름이 짧은 쪽(더 일반적인 쪽)을 남긴다.
  const byHex = new Map()
  for (const t of out) {
    const cur = byHex.get(t.hex)
    if (!cur || t.name.length < cur.name.length) byHex.set(t.hex, t)
  }
  return [...byHex.values()]
}
const expand = (h) => (h.length === 4 ? '#' + [...h.slice(1)].map((c) => c + c).join('') : h)

// ── 색 공간 ────────────────────────────────────────────────────────────────
const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
function rgbToLab([r, g, b]) {
  const f = (c) => {
    c /= 255
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  const [R, G, B] = [f(r), f(g), f(b)]
  const X = (0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047
  const Y = 0.2126729 * R + 0.7151522 * G + 0.072175 * B
  const Z = (0.0193339 * R + 0.119192 * G + 0.9503041 * B) / 1.08883
  const g2 = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  const [fx, fy, fz] = [g2(X), g2(Y), g2(Z)]
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}
/** CIEDE2000 — 색 차이. 유클리드 RGB 거리는 어두운 색끼리를 과소평가한다. */
function deltaE2000(l1, l2) {
  const [L1, a1, b1] = l1
  const [L2, a2, b2] = l2
  const rad = Math.PI / 180
  const C1 = Math.hypot(a1, b1)
  const C2 = Math.hypot(a2, b2)
  const Cb = (C1 + C2) / 2
  const G = 0.5 * (1 - Math.sqrt(Math.pow(Cb, 7) / (Math.pow(Cb, 7) + Math.pow(25, 7))))
  const ap1 = (1 + G) * a1
  const ap2 = (1 + G) * a2
  const Cp1 = Math.hypot(ap1, b1)
  const Cp2 = Math.hypot(ap2, b2)
  const hp = (b, ap) => {
    if (b === 0 && ap === 0) return 0
    const h = Math.atan2(b, ap) / rad
    return h >= 0 ? h : h + 360
  }
  const hp1 = hp(b1, ap1)
  const hp2 = hp(b2, ap2)
  const dLp = L2 - L1
  const dCp = Cp2 - Cp1
  let dhp = 0
  if (Cp1 * Cp2 !== 0) {
    dhp = hp2 - hp1
    if (dhp > 180) dhp -= 360
    else if (dhp < -180) dhp += 360
  }
  const dHp = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin((dhp * rad) / 2)
  const Lpb = (L1 + L2) / 2
  const Cpb = (Cp1 + Cp2) / 2
  let hpb
  if (Cp1 * Cp2 === 0) hpb = hp1 + hp2
  else if (Math.abs(hp1 - hp2) <= 180) hpb = (hp1 + hp2) / 2
  else hpb = hp1 + hp2 < 360 ? (hp1 + hp2 + 360) / 2 : (hp1 + hp2 - 360) / 2
  const T = 1 - 0.17 * Math.cos((hpb - 30) * rad) + 0.24 * Math.cos(2 * hpb * rad) +
    0.32 * Math.cos((3 * hpb + 6) * rad) - 0.2 * Math.cos((4 * hpb - 63) * rad)
  const dTheta = 30 * Math.exp(-Math.pow((hpb - 275) / 25, 2))
  const Rc = 2 * Math.sqrt(Math.pow(Cpb, 7) / (Math.pow(Cpb, 7) + Math.pow(25, 7)))
  const Sl = 1 + (0.015 * Math.pow(Lpb - 50, 2)) / Math.sqrt(20 + Math.pow(Lpb - 50, 2))
  const Sc = 1 + 0.045 * Cpb
  const Sh = 1 + 0.015 * Cpb * T
  const Rt = -Math.sin(2 * dTheta * rad) * Rc
  return Math.sqrt(
    Math.pow(dLp / Sl, 2) + Math.pow(dCp / Sc, 2) + Math.pow(dHp / Sh, 2) + Rt * (dCp / Sc) * (dHp / Sh),
  )
}

// ── 참조 색 모으기 (등장 횟수와 함께) ──────────────────────────────────────
function refColors(computed) {
  const count = new Map()
  const bump = (v, weight = 1) => {
    if (typeof v !== 'string') return
    const hex = v.trim().toLowerCase()
    if (!/^#[0-9a-f]{6}$/.test(hex)) return
    count.set(hex, (count.get(hex) || 0) + weight)
  }
  for (const key of Object.keys(computed)) {
    const d = computed[key]
    if (!d || !d.blueprint) continue
    bump(d.pageBg, 50) // 바탕은 면적이 가장 크다
    for (const band of [...d.blueprint, ...(d.chrome ?? [])]) {
      // 면적에 비례해 세지 않으면 1px 테두리 색과 전면 배경이 같은 무게가 된다.
      bump(band.bg, Math.max(1, Math.round((band.w * band.h) / 200000)))
      for (const c of band.children) {
        bump(c.bg, Math.max(1, Math.round((c.w * c.h) / 20000)))
        bump(c.color, 1)
        if (c.border) bump((/#[0-9a-f]{6}/i.exec(c.border) || [])[0], 1)
      }
    }
    for (const items of Object.values(d.elements ?? {})) {
      for (const it of items) {
        bump(it.style?.color, 1)
        bump(it.style?.['background-color'], 2)
      }
    }
  }
  return [...count.entries()].map(([hex, n]) => ({ hex, count: n })).sort((a, b) => b.count - a.count)
}

// ── 실행 ───────────────────────────────────────────────────────────────────
const computed = JSON.parse(fs.readFileSync(COMPUTED, 'utf8'))
const tokens = ourTokens().map((t) => ({ ...t, lab: rgbToLab(hexToRgb(t.hex)) }))
const refs = refColors(computed)

// 액센트는 ΔE 가 아니라 **규칙**으로 고정한다 — 지시문: "액센트는 --ju".
// 참조의 액센트 = 바탕색을 뺀 나머지 중 등장이 가장 많은 유채색.
const chroma = (hex) => {
  const [, a, b] = rgbToLab(hexToRgb(hex))
  return Math.hypot(a, b)
}
const pageBgs = new Set(Object.values(computed).map((d) => (d?.pageBg ?? '').toLowerCase()))
const accentRef = refs.find((r) => !pageBgs.has(r.hex) && chroma(r.hex) > 25)?.hex ?? null
const JU = tokens.find((t) => t.name === '--ju')

// 액센트의 **같은 색 계열**(밝기만 다른 보라들)은 전체 풀에서 고르면 안 된다.
// 그러면 `#542f9c`(제목 잉크) 는 `--info-ink`(청회색) 로, `#9274f4` 는 `--info` 로 흩어져
// 참조에서 한 가족이던 색들이 우리 화면에서 남남이 된다 — 판단 ① 이 그걸 우리 팔레트 탓으로 읽게 된다.
// 액센트를 --ju 로 고정한다는 말은 그 **계열 전체**를 주묵 계열로 받는다는 뜻이다.
const hueOf = (hex) => {
  const [, a, b] = rgbToLab(hexToRgb(hex))
  return (Math.atan2(b, a) * 180) / Math.PI
}
const hueGap = (h1, h2) => {
  const d = Math.abs(h1 - h2) % 360
  return d > 180 ? 360 - d : d
}
const accentHue = accentRef ? hueOf(accentRef) : null
const juFamily = tokens.filter((t) => /^--(ju|on-ju)/.test(t.name))

const colors = refs.map((r) => {
  const lab = rgbToLab(hexToRgb(r.hex))
  if (accentRef && r.hex === accentRef && JU) {
    return {
      from: r.hex, token: '--ju', to: JU.hex,
      deltaE: Math.round(deltaE2000(lab, JU.lab) * 100) / 100,
      count: r.count, rule: 'pinned-accent',
      note: '지시문 고정 — ΔE 최근접이 아니라 「액센트는 --ju」 규칙이 이긴다',
    }
  }
  // 12° — 실측 Lab 색상각: 보라 계열은 −52~−56 에 모여 있고 파랑 `#3565cc` 는 −71 이다.
  // 40° 로 잡으면 그 파랑까지 주묵이 된다(액센트가 아닌 색을 액센트로 만든다).
  const inAccentFamily =
    accentHue !== null && chroma(r.hex) > 15 && hueGap(hueOf(r.hex), accentHue) <= 12
  const pool = inAccentFamily && juFamily.length ? juFamily : tokens
  let best = null
  for (const t of pool) {
    const d = deltaE2000(lab, t.lab)
    if (!best || d < best.d) best = { d, t }
  }
  return {
    from: r.hex, token: best.t.name, to: best.t.hex,
    deltaE: Math.round(best.d * 100) / 100,
    count: r.count,
    rule: inAccentFamily ? 'accent-family' : 'nearest-deltaE2000',
    ...(inAccentFamily ? { note: '참조에서 액센트와 같은 색 계열 — 후보를 --ju 계열로 좁혀 고른다' } : {}),
  }
})

const report = {
  generatedBy: 'scripts/design/substitute.mjs',
  generatedAt: new Date().toISOString().slice(0, 10),
  note: '손으로 고치지 말 것 — 다시 돌리면 덮어써진다. 고칠 것이 있으면 규칙(DENY · 액센트 고정)을 고친다.',
  source: { computed: 'docs/design/refs/tines/computed.json', tokens: 'packages/design-tokens/src/tokens.css' },
  method: 'CIEDE2000 최근접. 후보 풀에서 아케이드 팔레트(--ios-* · --combo · --streak · 메달)와 옛 AI-보라(--admin*)를 뺀다(DD-01 · DD-59).',
  accent: accentRef ? { refHex: accentRef, token: '--ju' } : null,
  tokenPoolSize: tokens.length,
  colors,
}
fs.mkdirSync(REFS, { recursive: true })
fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n', 'utf8')

console.log(`참조 색 ${colors.length} · 후보 토큰 ${tokens.length} · 액센트 ${accentRef} → --ju`)
const far = colors.filter((c) => c.deltaE > 25).length
console.log(`ΔE 중앙값 ${median(colors.map((c) => c.deltaE))} · ΔE>25 인 것 ${far}개(팔레트가 닿지 않는 색 — 사람 판단 ① 의 재료다)`)
console.log(path.relative(ROOT, OUT).split(path.sep).join('/'))

function median(xs) {
  const s = [...xs].sort((a, b) => a - b)
  return Math.round(s[Math.floor(s.length / 2)] * 100) / 100
}
