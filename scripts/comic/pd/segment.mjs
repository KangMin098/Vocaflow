// scripts/comic/pd/segment.mjs
//
// 컷 분할 — 인쇄 지면(다컷 그리드)을 **컷 단위**로 쪼갠다. PD 만화 현대화의 핵심 단계.
//
//   node scripts/comic/pd/segment.mjs --in <복원본 dir|file> --out <dir> [--web 1200] [--analysis 1100] [--min-area 0.03]
//
// 왜 필요한가:
//   1940년대 코믹 한 장은 A4 인쇄를 전제로 한 조밀한 4~8컷 그리드다. 폰에서 그대로 띄우면
//   글자가 깨알이 되어 핀치줌 없이는 못 읽는다. 학습 콘텐츠로서는 치명적이다.
//   컷으로 쪼개 세로 스크롤로 한 컷씩 보여주면(Comixology Guided View · 웹툰 관성)
//   폰 화면 전체가 한 컷에 할당되어 레터링이 그대로 읽힌다.
//   Vocaflow 의 `comic_pages` 스키마가 이미 (chapter_idx, page_order) = **컷 단위**라
//   추가 스키마 없이 그대로 들어맞는다.
//
// 알고리즘 — 배경 플러드필 + 연결요소 (XY-cut 은 실패해서 폐기):
//   처음엔 거터 투영(재귀 XY-cut)으로 짰는데 실측에서 페이지당 1컷으로만 떨어졌다.
//   원인: 위·아래 컷의 프레임선 y 좌표가 몇 px 씩 어긋나 있어 **전폭이 흰 행이 존재하지 않는다**
//   (실측 p7: 480×699 축소본에서 흰 행이 상단 여백 5줄뿐).
//
//   그래서 방식을 바꿨다 —
//     ① 이진화: 종이(밝음)=배경, 잉크=전경
//     ② 이미지 테두리의 흰 픽셀에서 배경을 플러드필 → 컷 **바깥** 거터만 칠해진다
//     ③ 칠해지지 않은 영역의 4-연결 성분 = 컷 하나 (프레임선이 내부를 하나로 묶어준다)
//     ④ 바운딩 박스 → 면적·잉크비로 헤더 띠·부스러기 제거
//   거터가 어긋나 있어도, 거터 폭이 1px 이라도 이어져 있으면 분리된다.
//
// 한계(정직하게):
//   · 컷이 서로 맞닿아 있거나(거터 0px) 프레임 없는 블리드 컷은 하나로 병합된다.
//   · 말풍선이 컷 밖으로 삐져나오면 두 컷이 이어져 병합될 수 있다.
//   검수 단계에서 사람이 확인하는 것을 전제로 한 자동 1차 분할이다.

import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { assertFfmpeg, px, readRgb, runFilter } from './lib-img.mjs'

function parseArgs(argv) {
    // 분석 해상도가 결정적이다 — 480px 로 줄이면 2~6px 거터가 1px 미만으로 뭉개져
  // 컷이 전혀 안 나뉜다(실측). 1100px 에서 거터가 안정적으로 살아난다.
  // dilate 는 기본값을 두지 않는다 — 페이지마다 자동 선택(pickPanelsAdaptive)이 기본이고,
  // 명시했을 때만 그 값으로 고정한다(스윕·재현용).
  const a = { web: 1200, minArea: 0.03, analysis: 1100, bgThreshold: 236, dilate: null }
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i]
    if (k === '--in') a.in = argv[++i]
    else if (k === '--out') a.out = argv[++i]
    else if (k === '--web') a.web = Number(argv[++i])
    else if (k === '--min-area') a.minArea = Number(argv[++i])
    else if (k === '--analysis') a.analysis = Number(argv[++i])
    else if (k === '--bg') a.bgThreshold = Number(argv[++i])
    else if (k === '--dilate') a.dilate = Number(argv[++i])
  }
  if (!a.in || !a.out) {
    console.error('사용법: node scripts/comic/pd/segment.mjs --in <dir|file> --out <dir> [--web 1200]')
    process.exit(1)
  }
  return a
}

const IMG_RE = /\.(jpe?g|png)$/i

function listInputs(input) {
  const st = fs.statSync(input)
  if (st.isFile()) return [input]
  return fs
    .readdirSync(input)
    .filter((f) => IMG_RE.test(f))
    .sort((x, y) => x.localeCompare(y, undefined, { numeric: true }))
    .map((f) => path.join(input, f))
}

/** 밝기 맵 (0~255). 복원 후이므로 종이는 거의 250 이상이다. */
function luma(img) {
  const L = new Uint8Array(img.w * img.h)
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      const [r, g, b] = px(img, x, y)
      L[y * img.w + x] = (r * 299 + g * 587 + b * 114) / 1000
    }
  }
  return L
}

/** 잉크 비율 — 빈 여백 조각을 걸러낸다. */
function inkRatio(L, W, r, thr) {
  let ink = 0, n = 0
  for (let y = r.y0; y < r.y1; y += 2) {
    for (let x = r.x0; x < r.x1; x += 2) {
      n++
      if (L[y * W + x] < thr) ink++
    }
  }
  return n ? ink / n : 0
}

/**
 * 컷 검출 — 배경 플러드필 후 남은 연결요소의 바운딩 박스.
 * thr: 이 값 이상이면 배경(종이)로 본다. 복원 후 종이는 245~255 근처.
 */
export function findPanels(img, opt) {
  const W = img.w, H = img.h
  const thr = opt.bgThreshold ?? 236
  const L = luma(img)

  // ①-a 배경 마스크 + 팽창(dilate).
  //   거터는 실측 2px 수준이라 망점 잡티 하나, JPEG 링잉 한 점만 걸쳐도 통로가 막혀
  //   플러드필이 못 지나가고 컷 전체가 하나로 붙어버린다(실측: p7 1컷).
  //   배경을 몇 px 부풀려 그 미세 차단을 넘게 한다. 프레임선(3~6px)보다 작게 유지해야
  //   프레임을 뚫고 컷 내부까지 배경이 새지 않는다.
  let bgMask = new Uint8Array(W * H)
  for (let i = 0; i < W * H; i++) bgMask[i] = L[i] >= thr ? 1 : 0
  const dilate = opt.dilate ?? 2
  for (let d = 0; d < dilate; d++) {
    const next = new Uint8Array(W * H)
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x
        if (bgMask[i]) { next[i] = 1; continue }
        if (
          (x > 0 && bgMask[i - 1]) || (x < W - 1 && bgMask[i + 1]) ||
          (y > 0 && bgMask[i - W]) || (y < H - 1 && bgMask[i + W])
        ) next[i] = 1
      }
    }
    bgMask = next
  }

  // ①-b 플러드필 — 테두리의 배경 픽셀에서 시작해 컷 "바깥" 거터를 칠한다.
  const outside = new Uint8Array(W * H)
  const stack = []
  const pushIf = (x, y) => {
    const i = y * W + x
    if (!outside[i] && bgMask[i]) { outside[i] = 1; stack.push(i) }
  }
  for (let x = 0; x < W; x++) { pushIf(x, 0); pushIf(x, H - 1) }
  for (let y = 0; y < H; y++) { pushIf(0, y); pushIf(W - 1, y) }
  while (stack.length) {
    const i = stack.pop()
    const x = i % W, y = (i / W) | 0
    if (x > 0) pushIf(x - 1, y)
    if (x < W - 1) pushIf(x + 1, y)
    if (y > 0) pushIf(x, y - 1)
    if (y < H - 1) pushIf(x, y + 1)
  }

  // ② 바깥이 아닌 픽셀들의 4-연결 성분 = 컷 후보 (프레임선이 내부를 하나로 묶는다)
  const seen = new Uint8Array(W * H)
  const boxes = []
  for (let y0 = 0; y0 < H; y0++) {
    for (let x0 = 0; x0 < W; x0++) {
      const s = y0 * W + x0
      if (outside[s] || seen[s]) continue
      seen[s] = 1
      const q = [s]
      let minX = x0, maxX = x0, minY = y0, maxY = y0, area = 0
      while (q.length) {
        const i = q.pop()
        const x = i % W, y = (i / W) | 0
        area++
        if (x < minX) minX = x; if (x > maxX) maxX = x
        if (y < minY) minY = y; if (y > maxY) maxY = y
        const nb = []
        if (x > 0) nb.push(i - 1)
        if (x < W - 1) nb.push(i + 1)
        if (y > 0) nb.push(i - W)
        if (y < H - 1) nb.push(i + W)
        for (const j of nb) if (!outside[j] && !seen[j]) { seen[j] = 1; q.push(j) }
      }
      boxes.push({ x0: minX, y0: minY, x1: maxX + 1, y1: maxY + 1, area })
    }
  }

  const total = W * H
  return boxes
    .map((r) => ({ ...r, w: r.x1 - r.x0, h: r.y1 - r.y0 }))
    .filter((r) => r.w > 12 && r.h > 12)
    .filter((r) => (r.w * r.h) / total >= opt.minArea) // 헤더 로고 띠·부스러기 제거
    .filter((r) => r.area / (r.w * r.h) >= 0.35) // 가늘고 긴 장식선 제거(채움률)
    .filter((r) => inkRatio(L, W, r, thr) >= 0.02)
    // 읽기 순서 = 위→아래, 같은 행이면 왼→오른 (좌철 영문 만화)
    .sort((a, b) => (Math.abs(a.y0 - b.y0) > H * 0.05 ? a.y0 - b.y0 : a.x0 - b.x0))
}

/**
 * 배경 팽창(dilate)을 **페이지마다 자동으로 고른다.**
 *
 * 왜 고정값이 안 되는가 (자기발전 스윕 실측 2026-08-09, tune.mjs):
 *   같은 Internet Archive 라도 스캔마다 최적값이 정반대였다.
 *     All Top Comics #6  거터가 넓고 깨끗 → dilate 0 이 정답(7/8/7), dilate 2 는 컷을 갉아먹어 오차 3
 *     Classics Illustrated #27  거터에 잡티 → dilate 0 은 붙어버려 오차 3, dilate 3 이 정답(6/6)
 *   전역 상수 하나로는 둘 중 하나가 반드시 망가진다. 실제로 운영값(1100/2)은
 *   16개 조합 중 거의 최하위(-4.2)였다.
 *
 * 무감독 선택 기준: **박스 겹침(커버리지 > 1)이 풀리는 첫 지점.**
 *
 *   "컷이 가장 많이 갈리는 값"을 고르는 규칙을 먼저 짰다가 폐기했다 — 과분할이 이긴다.
 *   실제로 정답 7컷 페이지에서 9컷을, 정답 1컷 광고 지면에서 3컷을 골랐다.
 *
 *   사다리 실측(페이지별 컷수/커버리지)을 보면 신호가 분명하다:
 *     All Top 0003 (정답 7)  d0:7/0.95  d1:7/0.94  d2:9/0.87  d3:8/0.52
 *     All Top 0005 (정답 8)  d0:8/0.86  d1:8/0.85  d2:4/0.22
 *     CI     0004 (정답 6)  d0:2/1.05  d1:4/1.00  d2:5/0.97  d3:5/0.79
 *   커버리지가 1을 넘는다는 건 바운딩 박스가 **서로 겹친다**는 뜻이고, 곧 컷이 아직
 *   병합돼 있다는 신호다(CI 0004 의 d0·d1). 겹침이 풀리는 순간이 구조가 드러난 지점이다.
 *   반대로 이미 겹치지 않는 페이지(All Top 전부)는 더 팽창시킬 이유가 없다 —
 *   팽창은 컷을 갉아 커버리지를 무너뜨린다(0005 의 0.86 → 0.22).
 */
const OVERLAP_COVERAGE = 0.98
const COLLAPSE_RATIO = 0.5

function pickPanelsAdaptive(img, base, ladder) {
  const total = img.w * img.h
  const measure = (dilate) => {
    const panels = findPanels(img, { ...base, dilate })
    return { panels, dilate, coverage: panels.reduce((s, p) => s + p.w * p.h, 0) / total }
  }

  let cur = measure(ladder[0])
  const first = cur.coverage
  for (const dilate of ladder.slice(1)) {
    // 겹침이 없으면 구조가 이미 드러난 것 — 더 팽창시키면 컷을 갉는다
    if (cur.coverage <= OVERLAP_COVERAGE) break
    const next = measure(dilate)
    // 팽창이 커버리지를 반토막 냈다면 컷이 먹힌 것이지 갈린 게 아니다
    if (next.panels.length === 0 || next.coverage < first * COLLAPSE_RATIO) break
    cur = next
  }
  return cur
}

async function main() {
  const args = parseArgs(process.argv)
  assertFfmpeg()
  const files = listInputs(args.in)
  if (files.length === 0) {
    console.error(`입력 이미지가 없습니다: ${args.in}`)
    process.exit(1)
  }
  fs.mkdirSync(args.out, { recursive: true })

  const manifest = []
  let order = 0
  for (const [pi, file] of files.entries()) {
    const img = readRgb(file, args.analysis)
    // --dilate 를 명시하면 그 값을 쓰고(재현·스윕용), 없으면 페이지마다 자동 선택한다.
    const base = { minArea: args.minArea, bgThreshold: args.bgThreshold }
    const chosen =
      args.dilate == null
        ? pickPanelsAdaptive(img, base, [0, 1, 2, 3])
        : { panels: findPanels(img, { ...base, dilate: args.dilate }), dilate: args.dilate }
    const panels = chosen.panels
    const k = img.srcW / img.w
    const pageName = path.basename(file).replace(IMG_RE, '')

    panels.forEach((p, i) => {
      // 프레임선이 잘리지 않게 살짝 여유를 준다
      const pad = Math.round(k * 2)
      const x = Math.max(0, Math.round(p.x0 * k) - pad)
      const y = Math.max(0, Math.round(p.y0 * k) - pad)
      let w = Math.min(img.srcW - x, Math.round(p.w * k) + pad * 2)
      let h = Math.min(img.srcH - y, Math.round(p.h * k) + pad * 2)
      w -= w % 2; h -= h % 2

      order += 1
      const name = `${pageName}-c${String(i + 1).padStart(2, '0')}.jpg`
      const out = path.join(args.out, name)
      const scale = args.web && w > args.web ? `,scale=${args.web}:-2:flags=lanczos` : ''
      runFilter(file, out, `crop=${w}:${h}:${x}:${y}${scale}`)
      manifest.push({
        page: pageName,
        pageIndex: pi + 1,
        panelIndex: i + 1,
        pageOrder: order,
        file: path.relative(process.cwd(), out).replace(/\\/g, '/'),
        srcBox: { x, y, w, h },
      })
    })
    console.log(
      `[${pi + 1}/${files.length}] ${pageName} → 컷 ${panels.length}개` +
        (args.dilate == null ? `  (팽창 ${chosen.dilate} 자동선택)` : ''),
    )
  }

  const mf = path.join(args.out, 'panels.manifest.json')
  fs.writeFileSync(mf, JSON.stringify({ panels: manifest }, null, 2))
  console.log(`\n컷 ${manifest.length}개 · manifest ${path.relative(process.cwd(), mf)}`)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e.message)
    process.exit(1)
  })
}
