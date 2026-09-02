// scripts/csat/lib-columns.mjs
//
// **2단 조판 PDF 를 한 단씩 세로로 펴 준다.** ingest-mock / pdf-columns2 가 공유한다.
//
// 왜 따로 뺐나 — 기존 구현은 `line.length`(자바스크립트 문자 수)로 단 사이 여백을 찾았다.
// 그런데 pdftotext -layout 은 한글을 **두 칸 폭**으로 조판해 놓고 파일에는 **한 글자**로 쓴다.
// 그래서 한글이 많은 줄일수록 오른쪽 단이 왼쪽으로 밀려 보이고, 여백이 한 자리에 서지 않는다.
// 실측: 2025학년도 6월 모평 8쪽의 여백 후보가 106·129·72·null·74·null·70·67 로 흩어졌고
// 1쪽이 안 잘려 듣기 6·7·9·12번이 통째로 사라졌다.
//
// 고치는 방법은 **표시 폭(한글·전각 2칸)으로 좌표를 다시 세는 것**이다. 그 좌표에서 여백을 찾고,
// 자를 때만 문자 인덱스로 되돌린다.

/** 표시 폭 — 한글·CJK·전각 기호는 2칸 */
export function charWidth(ch, wide = true) {
  if (!wide) return 1
  const c = ch.codePointAt(0)
  if (c >= 0x1100 && c <= 0x115f) return 2 // 한글 자모
  if (c >= 0x2e80 && c <= 0xa4cf) return 2 // CJK 부수 ~ 이체자
  if (c >= 0xac00 && c <= 0xd7a3) return 2 // 한글 음절
  if (c >= 0xf900 && c <= 0xfaff) return 2 // CJK 호환
  if (c >= 0xfe30 && c <= 0xfe6f) return 2
  if (c >= 0xff00 && c <= 0xff60) return 2 // 전각
  if (c >= 0xffe0 && c <= 0xffe6) return 2
  return 1
}

const BLANK = new Set([' ', '\t', String.fromCharCode(0x3000)])

/** 줄을 표시 폭 격자로 편다 — 한글 한 글자는 두 칸을 차지한다 */
export function toGrid(line, wide = true) {
  if (!wide) return line
  let s = ''
  for (const ch of line) s += ch + (charWidth(ch) === 2 ? ' ' : '')
  return s
}

/** 표시 폭 좌표 → 문자 인덱스 */
export function gridToIndex(line, cut, wide = true) {
  let col = 0
  let i = 0
  for (const ch of line) {
    if (col >= cut) return i
    col += charWidth(ch, wide)
    i += ch.length
  }
  return line.length
}

function occupancy(ls, wide = true) {
  const grid = ls.map((l) => toGrid(l, wide))
  const live = grid.filter((l) => l.trim().length)
  if (!live.length) return null
  const width = Math.max(...live.map((l) => l.length))
  const occ = new Array(width).fill(0)
  for (const l of live) for (let i = 0; i < l.length; i += 1) if (!BLANK.has(l[i])) occ[i] += 1
  return { occ, width, n: live.length }
}

/**
 * 가장 넓은 세로 여백의 한가운데 (표시 폭 좌표). 못 찾으면 null
 *
 * ⚠️ **`minRun = 4` 가 12회차에서 페이지를 놓치고 있다 — 고칠 때 읽을 것.**
 *
 * 실측 2026-09-02(M2506 8쪽): 페이지별 여백이 `87 · null · 69 · null · 72 · null · null · 67`
 * 로 나와 **4쪽이 null** 이다. 그 4쪽의 점유도를 세어 보면 여백이 없는 게 아니라
 * **3칸짜리**다(예: 3쪽 64·65·66). `minRun` 이 4라서 버려지고, 그다음 문서 전역 여백(67)이
 * 이 페이지에 안 맞아 `findGutter` 로 되돌아갔다가 87 을 집어 **오른쪽 단 한가운데를 자른다** —
 * `28. LCU Geography Field Trip` 이 `28. LCU Geograp` 로 끊긴 것이 그것이다.
 * (원본 pdftotext 에는 온전히 있다. 잘린 것은 우리 쪽이다.)
 *
 * 회차별 붙은 줄 비율: M2406 11.2% · M2506 10.4% · 2022 8.5% · M2109 5.9% · M2306 5.5% …
 * 총 12회차. `minRun` 을 3으로 내리면 이 4쪽이 살아난다.
 *
 * **그런데 지금은 안 고친다.** 고치면 `columns2/*.txt` 가 바뀌고 → 지문이 바뀌고 →
 * **이미 발행된 802문항의 인용 좌표가 통째로 흔들린다.** 고치려면 순서가 있다:
 *   ① `minRun` 3 안을 31회차 전부에 대고 점수(고유 유형 배정 발문 수 + 분리 품질)로 대조 —
 *      **한 회차라도 낮아지면 안 된다**(어느 한쪽을 고르면 절반이 깨진다는 것이 이 파일의 교훈이다)
 *   ② 코퍼스 재빌드 → 게이트 전량 재실행 → 인용이 깨진 문항만 골라 재드레인
 *   ③ 그때까지 코퍼스는 `body_suspect` 로 **모른다고 말한다**(신호 ⑦⑧⑨).
 */
export function findGutter(ls, minRun = 4, wide = true) {
  const p = occupancy(ls, wide)
  if (!p || p.n < 10 || p.width < 70) return null
  const thr = Math.max(1, Math.floor(p.n * 0.04))
  const lo = Math.floor(p.width * 0.28)
  const hi = Math.floor(p.width * 0.72)
  let best = null
  let run = null
  for (let i = lo; i <= hi; i += 1) {
    if (p.occ[i] <= thr) {
      if (run) run.e = i
      else run = { s: i, e: i }
    } else {
      if (run && (!best || run.e - run.s > best.e - best.s)) best = run
      run = null
    }
  }
  if (run && (!best || run.e - run.s > best.e - best.s)) best = run
  if (!best || best.e - best.s + 1 < minRun) return null
  return Math.floor((best.s + best.e) / 2)
}

function isGutterAt(ls, cut, slack = 2, wide = true) {
  const p = occupancy(ls, wide)
  if (!p) return false
  if (cut >= p.width) return true
  let hits = 0
  for (let i = Math.max(0, cut - slack); i <= Math.min(p.width - 1, cut + slack); i += 1) hits += p.occ[i]
  return hits / (p.n * (slack * 2 + 1)) <= 0.1
}

/**
 * 여백이 안 보일 때의 구조 단서 — `…긴 왼쪽 단…  12. 대화를 듣고` 처럼
 * **한 줄에 두 단의 문항 번호가 같이 온 자리**를 표시 폭으로 재서 중앙값을 쓴다.
 */
function rescueCut(ls, wide = true) {
  const cols = []
  for (const l of ls) {
    const m = l.match(/^(.{20,}?)\s{2,}(\d{1,2}\s*[.．]\s)/)
    if (!m) continue
    const head = m[0].slice(0, m[0].length - m[2].length)
    cols.push([...head].reduce((a, ch) => a + charWidth(ch, wide), 0))
  }
  if (cols.length < 2) return null
  cols.sort((a, b) => a - b)
  const med = cols[Math.floor(cols.length / 2)]
  if (cols.filter((c) => Math.abs(c - med) <= 4).length / cols.length < 0.5) return null
  return Math.max(1, med - 1)
}

function cutPage(ls, cut, wide = true) {
  const L = []
  const R = []
  for (const l of ls) {
    const i = gridToIndex(l, cut, wide)
    L.push(l.slice(0, i).replace(/\s+$/, ''))
    R.push(l.slice(i).replace(/\s+$/, ''))
  }
  const t = (a) => {
    while (a.length && !a[0].trim()) a.shift()
    while (a.length && !a[a.length - 1].trim()) a.pop()
    return a
  }
  return [...t(L), '', ...t(R)]
}

/** 페이지마다 단을 갈라 위→아래로 이어 붙인 텍스트 */
export function restoreColumns(raw, wide = true) {
  const pages = raw
    .split('\f')
    .map((p) => p.split('\n'))
    .filter((ls) => ls.some((l) => l.trim()))
  const found = pages.map((ls) => findGutter(ls, 4, wide)).filter((c) => c != null)
  const tally = new Map()
  for (const c of found) tally.set(c, (tally.get(c) ?? 0) + 1)
  let grid = null
  let bn = 0
  for (const [c, k] of tally) if (k > bn || (k === bn && c < grid)) { grid = c; bn = k }
  const out = []
  for (const ls of pages) {
    const p = occupancy(ls, wide)
    let cut = null
    if (grid != null && p && isGutterAt(ls, grid, 2, wide)) { if (grid < p.width) cut = grid }
    else cut = findGutter(ls, 4, wide)
    if (cut == null) cut = rescueCut(ls, wide)
    if (cut == null) { out.push(...ls, ''); continue }
    out.push(...cutPage(ls, cut, wide), '')
  }
  return out.join('\n')
}

/**
 * **두 좌표계를 다 돌려 더 나은 쪽을 고른다.**
 *
 * pdftotext 가 한글 폭을 보정해 주는 회차와 안 해 주는 회차가 섞여 있다 —
 * 실측: 표시 폭으로 고치니 2020·2021·2023·2024학년도 모평은 발문이 늘었는데(38→42)
 * 2026학년도 6·9월은 오히려 줄었다(45→43). 어느 한쪽을 고르면 반드시 절반이 깨진다.
 * 그래서 **회차마다 재서 고른다.** 자는 호출자가 준다(보통 발문 배정 수).
 *
 * @param {string} raw pdftotext -layout 원문
 * @param {(text: string) => number} score 클수록 좋은 점수
 */
export function restoreColumnsBest(raw, score) {
  const cands = [
    { wide: true, text: restoreColumns(raw, true) },
    { wide: false, text: restoreColumns(raw, false) },
  ]
  for (const c of cands) c.score = score(c.text)
  cands.sort((a, b) => b.score - a.score)
  return cands[0]
}
