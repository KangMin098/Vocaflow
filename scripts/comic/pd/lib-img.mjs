// scripts/comic/pd/lib-img.mjs
//
// PD 스캔 복원/분할 공용 이미지 헬퍼 — **ffmpeg 바이너리 하나만** 의존한다.
//
// 왜 ffmpeg 인가:
//   이 워크스테이션에 Python/OpenCV/sharp 가 없다(실측). 반면 ffmpeg 는
//   nlmeans(디노이즈) · eq(대비/채도/감마) · colorchannelmixer(채널 게인=화이트밸런스) ·
//   unsharp · scale(lanczos) · crop 을 모두 갖고 있어 스캔 복원에 필요한 연산이 전부 된다.
//   픽셀 분석(종이색 추정·여백 검출·거터 검출)은 rawvideo 로 뽑아 Node 에서 직접 센다.
//
// ffmpeg 경로: 환경변수 FFMPEG_BIN → PATH 의 ffmpeg 순으로 찾는다.
//   포터블 빌드를 쓸 때: FFMPEG_BIN=/path/to/ffmpeg.exe node restore.mjs ...

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const FFMPEG = process.env.FFMPEG_BIN || 'ffmpeg'
export const FFPROBE = process.env.FFPROBE_BIN || FFMPEG.replace(/ffmpeg(\.exe)?$/i, 'ffprobe$1')

export function assertFfmpeg() {
  const r = spawnSync(FFMPEG, ['-version'], { encoding: 'utf8' })
  if (r.error || r.status !== 0) {
    throw new Error(
      `ffmpeg 를 찾을 수 없습니다 (${FFMPEG}). FFMPEG_BIN 환경변수로 경로를 지정하세요.`,
    )
  }
}

/** 이미지 크기 (width, height). */
export function probeSize(file) {
  const r = spawnSync(
    FFPROBE,
    ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file],
    { encoding: 'utf8' },
  )
  if (r.status !== 0) throw new Error(`probe 실패: ${file}\n${r.stderr}`)
  const [w, h] = r.stdout.trim().split(',').map(Number)
  if (!w || !h) throw new Error(`probe 결과 이상: ${file} -> ${r.stdout}`)
  return { w, h }
}

/**
 * 이미지를 지정 폭으로 축소해 RGB24 원시 바이트로 읽는다 (픽셀 분석용).
 * 분석은 축소본으로 충분하고 수십 배 빠르다 — 실제 변환은 원본 해상도에 적용한다.
 */
export function readRgb(file, targetW = 320) {
  const { w, h } = probeSize(file)
  const sw = Math.min(targetW, w)
  const sh = Math.max(1, Math.round((h * sw) / w))
  const r = spawnSync(
    FFMPEG,
    ['-v', 'error', '-i', file, '-vf', `scale=${sw}:${sh}:flags=area`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
    { maxBuffer: 1 << 28 },
  )
  if (r.status !== 0) throw new Error(`rawvideo 추출 실패: ${file}\n${r.stderr}`)
  return { data: r.stdout, w: sw, h: sh, srcW: w, srcH: h }
}

export const px = (img, x, y) => {
  const i = (y * img.w + x) * 3
  return [img.data[i], img.data[i + 1], img.data[i + 2]]
}

/** 배열의 p 분위수(0~1). */
export function quantile(arr, p) {
  if (arr.length === 0) return 0
  const a = Float64Array.from(arr).sort()
  const i = Math.min(a.length - 1, Math.max(0, Math.round((a.length - 1) * p)))
  return a[i]
}

/**
 * 종이색 추정 — 페이지에서 "가장 밝은 넓은 면"이 종이다.
 * 채널별 90 분위수를 쓴다. 평균은 잉크에 끌려 내려가고, 최댓값은 스캔 하이라이트 한 점에
 * 휘둘린다. 90 분위수가 변색 정도를 가장 안정적으로 대표한다(페이지마다 다시 추정).
 */
export function estimatePaper(img) {
  const R = [], G = [], B = []
  for (let y = 0; y < img.h; y += 2) {
    for (let x = 0; x < img.w; x += 2) {
      const [r, g, b] = px(img, x, y)
      // 어두운 잉크·선화는 종이 후보에서 제외
      if (r + g + b < 300) continue
      R.push(r); G.push(g); B.push(b)
    }
  }
  if (R.length === 0) return { r: 255, g: 255, b: 255 }
  return { r: quantile(R, 0.9), g: quantile(G, 0.9), b: quantile(B, 0.9) }
}

/**
 * 스캔 여백(스캔대 배경) 제거용 콘텐츠 bbox.
 * 바깥 테두리 색을 배경으로 보고, 그와 충분히 다른 픽셀이 처음/마지막 나타나는 행·열을 찾는다.
 * 골든에이지 스캔은 종이 바깥에 분홍/회색 여백이 크게 남아 있는 경우가 흔하다.
 */
export function contentBBox(img, tol = 26) {
  const corners = [
    px(img, 1, 1), px(img, img.w - 2, 1),
    px(img, 1, img.h - 2), px(img, img.w - 2, img.h - 2),
  ]
  const bg = [0, 1, 2].map((c) => Math.round(corners.reduce((s, p) => s + p[c], 0) / corners.length))
  const isBg = (x, y) => {
    const [r, g, b] = px(img, x, y)
    return Math.abs(r - bg[0]) <= tol && Math.abs(g - bg[1]) <= tol && Math.abs(b - bg[2]) <= tol
  }
  // 한 줄에 비배경이 이 비율 이상이면 "콘텐츠 줄"
  const need = 0.02
  let top = 0, bottom = img.h - 1, left = 0, right = img.w - 1
  const rowHit = (y) => {
    let n = 0
    for (let x = 0; x < img.w; x++) if (!isBg(x, y)) n++
    return n / img.w >= need
  }
  const colHit = (x) => {
    let n = 0
    for (let y = 0; y < img.h; y++) if (!isBg(x, y)) n++
    return n / img.h >= need
  }
  while (top < bottom && !rowHit(top)) top++
  while (bottom > top && !rowHit(bottom)) bottom--
  while (left < right && !colHit(left)) left++
  while (right > left && !colHit(right)) right--
  return { x: left, y: top, w: right - left + 1, h: bottom - top + 1, bg }
}

/** 분석 좌표(축소본) → 원본 좌표. */
export function scaleBox(box, img, pad = 0) {
  const k = img.srcW / img.w
  const x = Math.max(0, Math.round(box.x * k) - pad)
  const y = Math.max(0, Math.round(box.y * k) - pad)
  const w = Math.min(img.srcW - x, Math.round(box.w * k) + pad * 2)
  const h = Math.min(img.srcH - y, Math.round(box.h * k) + pad * 2)
  // 짝수로 맞춰 인코더 경고 방지
  return { x, y, w: w - (w % 2), h: h - (h % 2) }
}

/** ffmpeg 필터체인 실행 (단일 이미지 in/out). */
export function runFilter(input, output, filter, { quality = 3 } = {}) {
  fs.mkdirSync(path.dirname(output), { recursive: true })
  const args = ['-nostdin', '-v', 'error', '-y', '-i', input]
  if (filter) args.push('-vf', filter)
  args.push('-q:v', String(quality), output)
  const r = spawnSync(FFMPEG, args, { encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`ffmpeg 실패\n${filter}\n${r.stderr}`)
  return output
}

export function tmpDir(prefix = 'vf-pd-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}
