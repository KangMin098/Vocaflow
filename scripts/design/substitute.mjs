#!/usr/bin/env node
// scripts/design/substitute.mjs
//
// 치환표를 **만든다**(DD-62 Stage 3 ①색).
// 참조 사이트의 색값 하나하나에 우리 토큰 중 ΔE2000 이 가장 가까운 것을 붙인다.
//
//   node scripts/design/substitute.mjs
//
// 산출: docs/design/refs/substitution.json  (원값 → **역할** → 토큰명 → ΔE)
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
  // 여기서 hex 로 합치지 않는다 — 역할 풀이 **이름**으로 후보를 고르는데(`--ti` 와 `--bg` 는 같은 값이다)
  // 합쳐 버리면 풀에 적은 이름이 사라져 후보가 조용히 비고, 그 역할은 엉뚱한 토큰으로 떨어진다.
  return out
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

// ── 참조 색 모으기 — **역할과 함께** ────────────────────────────────────────
//
// 왜 역할이 먼저인가(2026-09-20 1회차가 가르쳐 준 것):
//   1회차는 색 하나에 토큰 하나를 붙였다. 그래서 참조가 **면**으로 20% 면적에 쓰던 보라가
//   우리 `--ju` 로 통째로 치환되어 빨간 벽이 됐다. `--ju` 는 표식(점·선) 색이고 면으로 쓰는 것은
//   금지다(DD-55). 색은 같은 값이라도 **어디에 쓰였는지**에 따라 다른 토큰이어야 한다.
//   → 역할 3종을 먼저 가르고, 역할마다 다른 후보 풀 안에서 ΔE2000 최근접을 고른다.
const ROLES = { FILL: '면', LINE: '선', TEXT: '글자' }
// 작은 칠은 면이 아니라 **표식**이다(알약 · 점 · 배지). 이 경계가 주묵을 면으로 만들지 않는 첫 관문.
const MARK_AREA = 2000

function refUsages(computed) {
  const count = new Map()
  const bump = (v, role, weight = 1) => {
    if (typeof v !== 'string') return
    const hex = v.trim().toLowerCase()
    if (!/^#[0-9a-f]{6}$/.test(hex)) return
    const k = `${hex}|${role}`
    count.set(k, (count.get(k) || 0) + weight)
  }
  for (const key of Object.keys(computed)) {
    const d = computed[key]
    if (!d || !d.blueprint) continue
    bump(d.pageBg, ROLES.FILL, 50) // 바탕은 면적이 가장 크다
    for (const band of [...d.blueprint, ...(d.chrome ?? [])]) {
      // 면적에 비례해 세지 않으면 1px 테두리 색과 전면 배경이 같은 무게가 된다.
      bump(band.bg, ROLES.FILL, Math.max(1, Math.round((band.w * band.h) / 200000)))
      for (const c of band.children) {
        const area = c.w * c.h
        bump(c.bg, area >= MARK_AREA ? ROLES.FILL : ROLES.LINE, Math.max(1, Math.round(area / 20000)))
        bump(c.color, ROLES.TEXT, 1)
        if (c.border) bump((/#[0-9a-f]{6}/i.exec(c.border) || [])[0], ROLES.LINE, 1)
      }
    }
    for (const items of Object.values(d.elements ?? {})) {
      for (const it of items) {
        bump(it.style?.color, ROLES.TEXT, 1)
        const r = it.rect ?? { w: 0, h: 0 }
        bump(it.style?.['background-color'], r.w * r.h >= MARK_AREA ? ROLES.FILL : ROLES.LINE, 2)
      }
    }
  }
  return [...count.entries()]
    .map(([k, n]) => ({ hex: k.split('|')[0], role: k.split('|')[1], count: n }))
    .sort((a, b) => b.count - a.count)
}

// ── 역할별 후보 풀 ─────────────────────────────────────────────────────────
//
// 역할 밖 토큰은 **아예 후보가 아니다.** 「역할 먼저, 역할 안에서 ΔE 최근접」(사용자 결정 2026-09-20).
// 면 풀에 잉크·주묵이 없는 것이 요점이다 — 그래야 어떤 참조 면도 주묵 벽이 될 수 없다(DD-55 면 금지).
const ROLE_POOL = {
  면: ['--bg', '--bg2', '--bg3', '--ti', '--p-light', '--ju-light', '--success-light', '--error-light', '--warning-light', '--info-light', '--active-light'],
  선: ['--bd', '--bdf', '--bde', '--ju', '--ju-ink', '--p', '--active', '--success', '--error', '--warning', '--info'],
  글자: ['--t1', '--t2', '--t3', '--p', '--ju-ink', '--on-p', '--on-ju', '--ti', '--success-ink', '--error-ink', '--warning-ink', '--info-ink'],
}

// 액센트 계열이 역할마다 가는 곳 — ΔE 가 아니라 **규칙**이다(사용자 결정).
//   면   → `--bg2`  : 참조 액센트의 면 용법은 「다른 톤의 종이」다. 실측으로 --bg2 는 --bg 에
//                     잉크를 채널당 3.1~5.8% 섞은 값이고(03-system §3-9), 사용자가 준 창 「잉크 4~6%」 안이다.
//   선   → `--ju`   : 표식(점 · 선 · 테두리) — 주묵이 원래 있어야 할 자리.
//   글자 → `--t1`   : ⚠️ 사용자는 `--ink` 라고 적었는데 그 이름의 토큰은 **없다**(tokens.css 실측).
//                     우리 잉크 정본은 `--t1`(#1A1714)이라 그것으로 읽었다. 틀렸으면 이 한 줄만 고치면 된다.
const ACCENT_PIN = { 면: '--bg2', 선: '--ju', 글자: '--t1' }

// **반전 글자** — 참조가 어둡거나 진한 면 위에 얹으려고 쓴 밝은 글자(`#fcf9f5` 따위).
// 우리 면 풀은 **전부 밝다**(아래에서 확인한다). 그래서 그 면 위에 밝은 글자를 그대로 올리면
// 종이 위 종이색이 되어 **안 보인다** — 2026-09-20 2회차 첫 시트에서 실제로 한 띠가 통째로 사라졌다.
// ΔE 로는 잡히지 않는다(`#fcf9f5` 의 최근접 글자 토큰은 당연히 `--ti` 다). 규칙으로 잡는다.
const REVERSE_L = 80 // Lab L* 이 이보다 밝은 글자색 = 반전 글자
const REVERSE_INK = '--t1'

// ── 실행 ───────────────────────────────────────────────────────────────────
const computed = JSON.parse(fs.readFileSync(COMPUTED, 'utf8'))
const tokens = ourTokens().map((t) => ({ ...t, lab: rgbToLab(hexToRgb(t.hex)) }))
const byName = new Map(tokens.map((t) => [t.name, t]))
const refs = refUsages(computed)

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

/** 역할 풀을 이름 순서대로 펼친다 — 같은 값이 여럿이면 먼저 적은 이름이 이긴다. */
function poolFor(role) {
  const seen = new Set()
  const out = []
  for (const name of ROLE_POOL[role] ?? []) {
    const t = byName.get(name)
    if (!t || seen.has(t.hex)) continue
    seen.add(t.hex)
    out.push(t)
  }
  return out
}
const POOLS = Object.fromEntries(Object.keys(ROLE_POOL).map((r) => [r, poolFor(r)]))
for (const [role, pool] of Object.entries(POOLS)) {
  if (pool.length === 0) throw new Error(`역할 「${role}」 의 후보 풀이 비었다 — ROLE_POOL 의 이름을 tokens.css 와 맞춰라`)
}
// 반전 글자 규칙의 전제: 면 풀이 **전부 밝다**. 어두운 면 토큰이 풀에 들어오면 그 전제가 깨지고,
// 그때는 밝은 글자를 잉크로 뒤집는 것이 오히려 틀린 판정이 된다 — 조용히 틀리지 않게 여기서 막는다.
{
  const dark = POOLS['면'].filter((t) => rgbToLab(hexToRgb(t.hex))[0] <= 70)
  if (dark.length) throw new Error(`면 풀에 어두운 토큰이 있다(${dark.map((t) => t.name).join(' · ')}) — 반전 글자 규칙(REVERSE_INK)을 다시 정해야 한다`)
}

const colors = refs.map((r) => {
  const lab = rgbToLab(hexToRgb(r.hex))
  // 액센트 계열 = 액센트 자신 + Lab 색상각 ±12° 안의 유채색.
  // 12° 인 이유(실측): 보라들은 −52~−56 에 모여 있고 파랑 `#3565cc` 는 −71 이다. 40° 로 잡으면
  // 그 파랑까지 액센트가 되어, 액센트가 아닌 색이 주묵 규칙을 타고 들어온다.
  if (r.role === '글자' && lab[0] >= REVERSE_L) {
    const t = byName.get(REVERSE_INK)
    return {
      from: r.hex, role: r.role, token: t.name, to: t.hex,
      deltaE: Math.round(deltaE2000(lab, rgbToLab(hexToRgb(t.hex))) * 100) / 100,
      count: r.count, rule: 'reverse-text',
      note: '참조에서 진한 면 위에 얹던 **밝은 글자**다. 우리 면은 전부 밝아 그대로 두면 안 보인다 — 잉크로 뒤집는다',
    }
  }
  const inAccentFamily =
    accentHue !== null && chroma(r.hex) > 15 && hueGap(hueOf(r.hex), accentHue) <= 12
  if (inAccentFamily && ACCENT_PIN[r.role] && byName.get(ACCENT_PIN[r.role])) {
    const t = byName.get(ACCENT_PIN[r.role])
    const NOTE = {
      면: '참조 액센트의 **면** 용법 — 주묵은 면이 될 수 없다(DD-55). 다른 톤의 종이(--bg2)로 받는다',
      선: '참조 액센트의 **선·표식** 용법 — 주묵이 원래 있어야 할 자리',
      글자: '참조 액센트의 **글자** 용법 — 잉크로 받는다(주묵 글자는 평가로 읽힌다)',
    }
    return {
      from: r.hex, role: r.role, token: t.name, to: t.hex,
      deltaE: Math.round(deltaE2000(lab, rgbToLab(hexToRgb(t.hex))) * 100) / 100,
      count: r.count, rule: `pinned-accent:${r.role}`, note: NOTE[r.role],
    }
  }
  const pool = POOLS[r.role] ?? POOLS['글자']
  let best = null
  for (const t of pool) {
    const d = deltaE2000(lab, t.lab)
    if (!best || d < best.d) best = { d, t }
  }
  return {
    from: r.hex, role: r.role, token: best.t.name, to: best.t.hex,
    deltaE: Math.round(best.d * 100) / 100,
    count: r.count, rule: `nearest-deltaE2000:${r.role}`,
  }
})

const report = {
  generatedBy: 'scripts/design/substitute.mjs',
  generatedAt: new Date().toISOString().slice(0, 10),
  note: '손으로 고치지 말 것 — 다시 돌리면 덮어써진다. 고칠 것이 있으면 규칙(DENY · 액센트 고정)을 고친다.',
  source: { computed: 'docs/design/refs/tines/computed.json', tokens: 'packages/design-tokens/src/tokens.css' },
  method:
    '**역할 먼저, 역할 안에서 ΔE2000 최근접.** 같은 색값이라도 면·선·글자로 쓰였는지에 따라 다른 토큰으로 간다 — ' +
    '1회차는 역할을 안 봐서 참조의 면 20%가 주묵 벽이 됐다(DD-55 면 금지 위반). ' +
    '후보 풀에서 아케이드 팔레트(--ios-* · --combo · --streak · 메달)와 옛 AI-보라(--admin*)를 뺀다(DD-01 · DD-59).',
  roles: {
    면: '면적 ≥ 2000px² 의 칠 · 띠 배경 · 페이지 바탕',
    선: '테두리 · 면적 < 2000px² 의 칠(알약 · 점 · 배지 = 표식)',
    글자: '글자색',
  },
  rolePool: ROLE_POOL,
  accentPin: ACCENT_PIN,
  reverseText: { whenLabLightnessAtLeast: REVERSE_L, token: REVERSE_INK, why: '우리 면 풀은 전부 밝다 — 밝은 글자를 그대로 두면 종이 위 종이색이 된다' },
  accent: accentRef ? { refHex: accentRef, hueLab: Math.round(hueOf(accentRef)), familyWithinDeg: 12, pin: ACCENT_PIN } : null,
  tokenPoolSize: tokens.length,
  colors,
}
fs.mkdirSync(REFS, { recursive: true })
fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n', 'utf8')

const byRole = (r) => colors.filter((c) => c.role === r).length
console.log(`참조 용법 ${colors.length}(면 ${byRole('면')} · 선 ${byRole('선')} · 글자 ${byRole('글자')}) · 액센트 ${accentRef} → 면 ${ACCENT_PIN['면']} · 선 ${ACCENT_PIN['선']} · 글자 ${ACCENT_PIN['글자']}`)
const far = colors.filter((c) => c.deltaE > 25).length
console.log(`ΔE 중앙값 ${median(colors.map((c) => c.deltaE))} · ΔE>25 인 것 ${far}개(팔레트가 닿지 않는 색 — 사람 판단 ① 의 재료다)`)
console.log(path.relative(ROOT, OUT).split(path.sep).join('/'))

function median(xs) {
  const s = [...xs].sort((a, b) => a - b)
  return Math.round(s[Math.floor(s.length / 2)] * 100) / 100
}
