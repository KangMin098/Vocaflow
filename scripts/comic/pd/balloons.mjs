// scripts/comic/pd/balloons.mjs
//
// 말풍선·캡션 박스 영역 검출 — **OCR 텍스트 조각을 감싸는 흰 영역으로 확장한다.**
//
// 왜 필요한가 (실측 2026-08-09):
//   OCR 은 말풍선 하나를 텍스트 그룹 여러 조각으로 쪼갠다. Classics Illustrated #27 표지의
//   캡션 박스 하나가 6조각으로 잡혔다. 그 조각들만 지우면 조각 사이 여백과 테두리에
//   글자 흔적이 남고, 남은 흔적을 생성 모델이 "글자 비슷한 것"으로 재현한다.
//   현대화 모델 트랙에서 이건 치명적이다 — 읽을 수 없는 가짜 글자가 박힌 컷이 나온다.
//
// 접근: 검출기를 새로 만들지 않고 **두 신호를 합친다.**
//   ① OCR 이 "글자가 여기 있다"를 알려준다 (좌표는 신뢰할 수 있다 — 3배 오차는 수정됨)
//   ② 말풍선은 그 글자를 감싼 **밝은 연결 영역**이다
//   글자 위치에서 밝은 영역으로 플러드필해 풍선 전체를 얻는다.
//   순수 검출(밝은 blob 찾기)보다 오탐이 적다 — 하늘·눈밭도 밝지만 글자가 없다.
//
// 한계(정직하게):
//   · 배경이 흰 컷에서는 풍선과 배경이 이어져 영역이 과도하게 커진다 → 면적 상한으로 막고
//     넘으면 텍스트 박스 + 여백으로 후퇴한다(과도한 지움보다 덜 지운 게 낫다).
//   · 어두운 배경의 흰 글자(효과음)는 잡지 못한다. 그런 컷은 사람이 검수에서 거른다.

import { probeSize, px, readRgb } from './lib-img.mjs'

/** 이 밝기 이상이면 "풍선 안쪽(종이)"으로 본다. 복원 후 화이트포인트가 잡혀 있어 높게 둔다. */
const BRIGHT = 200
/** 풍선 하나가 컷의 이 비율을 넘으면 배경과 이어진 것으로 보고 폐기한다. */
const MAX_AREA_RATIO = 0.45
/** 텍스트 박스로 후퇴할 때 주는 여백(글자 높이 배수) — 테두리 획까지 덮기 위함. */
const FALLBACK_PAD = 0.6

/**
 * 밝은 픽셀의 4-연결 성분에 라벨을 매긴다.
 * @returns {{ labels: Int32Array, boxes: Array<{x0,y0,x1,y1,area}> }}
 */
function labelBright(img, bright = BRIGHT) {
  const W = img.w
  const H = img.h
  const labels = new Int32Array(W * H).fill(-1)
  const boxes = []
  const stack = []

  for (let s = 0; s < W * H; s++) {
    if (labels[s] !== -1) continue
    const sy = (s / W) | 0
    const sx = s % W
    const [r0, g0, b0] = px(img, sx, sy)
    if ((r0 * 299 + g0 * 587 + b0 * 114) / 1000 < bright) {
      labels[s] = -2 // 어두움 — 성분 아님
      continue
    }
    const id = boxes.length
    let x0 = sx, x1 = sx, y0 = sy, y1 = sy, area = 0
    labels[s] = id
    stack.push(s)
    while (stack.length) {
      const i = stack.pop()
      const y = (i / W) | 0
      const x = i % W
      area++
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
      const nb = []
      if (x > 0) nb.push(i - 1)
      if (x < W - 1) nb.push(i + 1)
      if (y > 0) nb.push(i - W)
      if (y < H - 1) nb.push(i + W)
      for (const j of nb) {
        if (labels[j] !== -1) continue
        const jy = (j / W) | 0
        const jx = j % W
        const [r, g, b] = px(img, jx, jy)
        if ((r * 299 + g * 587 + b * 114) / 1000 >= bright) {
          labels[j] = id
          stack.push(j)
        } else {
          labels[j] = -2
        }
      }
    }
    boxes.push({ x0, y0, x1: x1 + 1, y1: y1 + 1, area })
  }
  return { labels, boxes }
}

/**
 * 컷 하나의 말풍선 영역을 정규화 좌표(0~1)로 돌려준다.
 *
 * @param {string} file          컷 이미지 경로
 * @param {Array<{x,y,w,h}>} textBoxes  OCR 말풍선 박스(정규화 좌표)
 * @param {{ analysis?: number }} opt
 * @returns {Array<{x,y,w,h,via:'balloon'|'text-fallback'}>}
 */
export function detectBalloons(file, textBoxes, opt = {}) {
  if (!textBoxes?.length) return []
  const analysis = opt.analysis ?? 900
  const bright = opt.bright ?? BRIGHT
  const img = readRgb(file, analysis)
  const { labels, boxes } = labelBright(img, bright)
  const total = img.w * img.h

  const out = []
  const usedLabel = new Set()

  for (const tb of textBoxes) {
    // 텍스트 박스 안에서 가장 많이 나온 밝은 성분 = 그 글자를 담은 풍선
    const px0 = Math.max(0, Math.round(tb.x * img.w))
    const py0 = Math.max(0, Math.round(tb.y * img.h))
    const px1 = Math.min(img.w, Math.round((tb.x + tb.w) * img.w))
    const py1 = Math.min(img.h, Math.round((tb.y + tb.h) * img.h))

    const votes = new Map()
    for (let y = py0; y < py1; y++) {
      for (let x = px0; x < px1; x++) {
        const l = labels[y * img.w + x]
        if (l >= 0) votes.set(l, (votes.get(l) ?? 0) + 1)
      }
    }
    let best = -1
    let bestN = 0
    for (const [l, n] of votes) {
      // 배경과 이어진 거대 성분은 후보에서 제외 — 컷 전체를 지우게 된다
      if (boxes[l].area / total > MAX_AREA_RATIO) continue
      if (n > bestN) {
        bestN = n
        best = l
      }
    }

    if (best >= 0) {
      if (usedLabel.has(best)) continue // 같은 풍선의 다른 조각 — 이미 담았다
      usedLabel.add(best)
      const b = boxes[best]
      out.push({
        x: b.x0 / img.w,
        y: b.y0 / img.h,
        w: (b.x1 - b.x0) / img.w,
        h: (b.y1 - b.y0) / img.h,
        via: 'balloon',
      })
    } else {
      // 풍선을 못 찾았다 — 텍스트 박스에 여백만 주고 후퇴한다.
      // 과도하게 지우는 것보다 덜 지운 게 낫다(사람이 검수에서 본다).
      const pad = tb.h * FALLBACK_PAD
      out.push({
        x: Math.max(0, tb.x - pad),
        y: Math.max(0, tb.y - pad),
        w: Math.min(1, tb.w + pad * 2),
        h: Math.min(1, tb.h + pad * 2),
        via: 'text-fallback',
      })
    }
  }
  return mergeOverlaps(out)
}

/**
 * **OCR 없이** 말풍선 후보를 찾는다 — OCR 재현율의 분모를 만들기 위한 것.
 *
 * 왜 필요한가:
 *   기존 OCR 채점(tune.mjs)은 "찾은 대사 중 몇 개가 깨끗한가"만 본다. **놓친 대사는 모른다.**
 *   그래서 스윕이 정밀도만 올리고 재현율은 오히려 떨어뜨릴 수 있다
 *   (실측: 0004-c02 의 "Yassuh, yassuh!" 풍선이 통째로 미검출인데 점수는 높았다).
 *
 *   손으로 전사해 정답을 만들 수도 있지만, 풍선의 **개수**만 알면 재현율은 나온다.
 *   말풍선은 그림과 다른 시각적 성질을 갖는다 — 밝고, 뭉툭하고, 안에 잉크가 있다.
 *   그걸로 후보를 세고 `OCR 이 텍스트를 넣은 후보 / 전체 후보` 를 재현율로 쓴다.
 *
 * detectBalloons 와 다른 점: 저건 OCR 좌표를 씨앗으로 받아 **확장**한다(정밀).
 * 이건 씨앗 없이 **탐색**한다(재현율 측정용). 오탐이 섞이므로 지우기에는 쓰지 않는다.
 *
 * ⚠️ **아직 보정되지 않았다 — 지표로 쓰지 마라.** (실측 2026-08-09)
 *   Classics Illustrated #27 로 재봤더니 OCR 이 **찾아낸** 풍선조차 후보로 못 잡았다
 *   (0004-c04: OCR 2개 검출 · 후보 0). 그 상태로 재현율을 계산하면 8% 가 나오는데,
 *   그건 OCR 이 아니라 이 검출기의 실패를 재는 수다.
 *   분모가 틀린 지표는 없느니만 못하다 — 스윕이 엉뚱한 방향으로 최적화된다.
 *
 *   왜 못 잡나: 밝은 성분이 배경과 이어지면 bbox 가 커져 채움률(0.55) 문턱에 걸린다.
 *   문턱을 낮추면 이번엔 그림 영역이 후보로 들어온다 — 정답 없이 조정하면 그 트랩이다
 *   (컷분할에서 프록시 지표가 과분할을 고른 것과 같은 구조).
 *
 *   **다음 단계는 사람이 세는 것이다.** 표본 컷의 실제 말풍선 수를 truth 에 박고,
 *   그걸 분모로 OCR 재현율을 재야 한다. 컷분할 정답(`samples` 아래 truth.json)과 같은 방식.
 */
export function detectBalloonCandidates(file, opt = {}) {
  const analysis = opt.analysis ?? 900
  const bright = opt.bright ?? BRIGHT
  const minArea = opt.minArea ?? 0.004
  const maxArea = opt.maxArea ?? 0.3
  const img = readRgb(file, analysis)
  const { labels, boxes } = labelBright(img, bright)
  const total = img.w * img.h

  const out = []
  for (const [id, b] of boxes.entries()) {
    const bw = b.x1 - b.x0
    const bh = b.y1 - b.y0
    const bboxArea = bw * bh
    if (bboxArea / total < minArea || bboxArea / total > maxArea) continue
    if (bw < 12 || bh < 8) continue
    // 뭉툭함 — 풍선은 박스를 대부분 채운다. 얇은 하이라이트·테두리 획을 걸러낸다.
    if (b.area / bboxArea < 0.55) continue
    const aspect = Math.max(bw / bh, bh / bw)
    if (aspect > 8) continue

    // 안에 잉크(글자)가 있어야 말풍선이다. 하늘·눈밭은 밝지만 잉크가 없다.
    // 너무 많으면 그림 영역이다(밝은 배경 위 검은 물체).
    let dark = 0
    let n = 0
    for (let y = b.y0; y < b.y1; y += 2) {
      for (let x = b.x0; x < b.x1; x += 2) {
        n++
        const [r, g, bl] = px(img, x, y)
        if ((r * 299 + g * 587 + bl * 114) / 1000 < 110) dark++
      }
    }
    const inkRatio = n ? dark / n : 0
    if (inkRatio < 0.03 || inkRatio > 0.45) continue

    out.push({
      x: b.x0 / img.w,
      y: b.y0 / img.h,
      w: bw / img.w,
      h: bh / img.h,
      inkRatio: +inkRatio.toFixed(3),
      label: id,
    })
  }
  return out
}

/**
 * 컷 이미지의 밝은 연결요소 라벨맵 — **어느 글자가 어느 말풍선에 속하는지** 판정용.
 *
 * 왜 필요한가 (실측 2026-08-11):
 *   OCR 이 캡션과 말풍선을 한 덩어리로 묶고, 나란한 두 풍선을 지퍼처럼 뒤섞는다.
 *     "At the big house, …the old colored servant qssuh yassuh/? Orm right"  ← 캡션+풍선
 *     "Tm only katy harvey binch his place but not ‘home that here he"      ← 좌우 두 풍선
 *   지금까지는 세로 간격·가로 인접 같은 **기하학으로 추측**했는데, psm11(sparse)은
 *   레이아웃 분석이 없어 단어가 흩어지므로 기하학만으로는 갈리지 않는다.
 *
 *   말풍선은 시각적으로 이미 분리돼 있다 — 각자 다른 밝은 영역 안에 있다.
 *   그 사실을 쓰면 추측할 필요가 없다: **다른 성분에 있으면 다른 말풍선이다.**
 *
 * @returns {{ at: (x:number, y:number) => number, w:number, h:number }}
 *   at(x,y) — 컷 **원본 픽셀** 좌표를 받아 성분 id(-1 = 배경/잉크)를 돌려준다.
 */
export function balloonLabelMap(file, opt = {}) {
  const analysis = opt.analysis ?? 900
  const bright = opt.bright ?? BRIGHT
  const img = readRgb(file, analysis)
  const { labels } = labelBright(img, bright)
  // readRgb 는 축소본을 주므로 원본 px → 분석 px 로 환산해서 조회한다.
  const sx = img.w / (img.srcW || img.w)
  const sy = img.h / (img.srcH || img.h)
  const at = (x, y) => {
    const ax = Math.max(0, Math.min(img.w - 1, Math.round(x * sx)))
    const ay = Math.max(0, Math.min(img.h - 1, Math.round(y * sy)))
    const l = labels[ay * img.w + ax]
    return l >= 0 ? l : -1
  }

  return {
    w: img.w,
    h: img.h,
    at,
    /**
     * 단어 박스가 **어느 말풍선 안에 있는지**.
     *
     * ⚠️ 중심점 한 곳만 보면 안 된다 — 글자 한가운데는 대개 **잉크(어두움)** 라 라벨이 -1 이
     *    나온다. 실측에서 그 때문에 같은 풍선 안 단어들이 서로 다른 라벨을 받아 캡션 하나가
     *    "Colored" "Servant" "Right" 처럼 조각났다(대사 60→99개로 과분할).
     *
     * 그래서 글자 **주변 여백**을 표본한다 — 박스 바로 위·아래·좌·우는 풍선 안쪽 종이다.
     * 가장 많이 나온 성분을 그 단어의 풍선으로 본다.
     */
    labelFor: (box) => labelForBox(at, box),
  }
}

/**
 * 표본 규칙 본체 — 이미지 없이 테스트할 수 있도록 순수 함수로 분리했다.
 * @param {(x:number,y:number)=>number} at  좌표 → 성분 id (-1 = 배경/잉크)
 */
export function labelForBox(at, box) {
  const w = box.x1 - box.x0
  const h = box.y1 - box.y0
  const pad = Math.max(2, h * 0.4)
  const pts = [
    [box.x0 + w / 2, box.y0 - pad], // 위
    [box.x0 + w / 2, box.y1 + pad], // 아래
    [box.x0 - pad, box.y0 + h / 2], // 왼
    [box.x1 + pad, box.y0 + h / 2], // 오른
    [box.x0 + w / 2, box.y0 + h / 2], // 중심(여백일 수도 있다)
  ]
  const votes = new Map()
  for (const [x, y] of pts) {
    const l = at(x, y)
    if (l >= 0) votes.set(l, (votes.get(l) ?? 0) + 1)
  }
  let best = -1
  let n = 0
  for (const [l, c] of votes) if (c > n) { n = c; best = l }
  return best
}

/** 두 박스의 교집합 비율(작은 쪽 기준) — 후보와 OCR 결과를 짝지을 때 쓴다. */
export function overlapRatio(a, b) {
  const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x))
  const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))
  const inter = ix * iy
  const small = Math.min(a.w * a.h, b.w * b.h)
  return small > 0 ? inter / small : 0
}

/**
 * 겹치거나 맞닿은 박스를 합친다.
 * 후퇴 박스들이 한 캡션의 조각인 경우가 흔해, 합치지 않으면 사이에 글자가 남는다.
 */
export function mergeOverlaps(boxes) {
  const items = boxes.map((b) => ({ ...b }))
  let changed = true
  while (changed) {
    changed = false
    outer: for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i]
        const b = items[j]
        const ax1 = a.x + a.w
        const ay1 = a.y + a.h
        const bx1 = b.x + b.w
        const by1 = b.y + b.h
        if (a.x < bx1 && b.x < ax1 && a.y < by1 && b.y < ay1) {
          const x = Math.min(a.x, b.x)
          const y = Math.min(a.y, b.y)
          items[i] = {
            x,
            y,
            w: Math.max(ax1, bx1) - x,
            h: Math.max(ay1, by1) - y,
            // 하나라도 실제 풍선이면 풍선으로 본다
            via: a.via === 'balloon' || b.via === 'balloon' ? 'balloon' : 'text-fallback',
          }
          items.splice(j, 1)
          changed = true
          break outer
        }
      }
    }
  }
  return items
}

export { probeSize }
