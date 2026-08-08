// scripts/comic/pd/restore.mjs
//
// PD 스캔 만화 페이지 복원 — "1940년대 인쇄물"을 폰에서 읽을 수 있는 화면 자산으로.
//
//   node scripts/comic/pd/restore.mjs --in <dir|file> --out <dir> [--sat 1.22] [--scale 2] [--no-denoise]
//
// 단계 (페이지마다 파라미터를 다시 추정 — 스캔 상태가 장마다 다르다):
//   ① 스캔 여백 크롭   스캔대 배경(분홍/회색 테두리)을 잘라 실제 지면만 남긴다
//   ② 종이 탈황변      종이색을 90분위수로 추정 → 채널 게인으로 순백 정렬(황변·분홍 캐스트 제거)
//   ③ 디노이즈         nlmeans 로 망점(halftone)·인쇄 잡티 완화 — 선화는 살리고 점만 뭉갠다
//   ④ 색 복원          잉크 대비 회복 + 채도 보정으로 4색 인쇄 발색 재현
//   ⑤ 업스케일·샤픈    lanczos 2배 + unsharp — 손레터링 가독성 확보
//
// 설계 주의:
//   · 채도는 기본 1.22 로 보수적. 과하면 골든에이지 특유의 톤이 네온처럼 뜬다(1.15~1.35 범위 권장).
//   · 화이트밸런스는 "가장 밝은 채널에 맞춰 올리기"가 아니라 "종이를 흰색으로" 정렬이다.
//     최대 게인을 1.35 로 물려 색 왜곡(청색 과보정)을 막는다.
//   · 원본은 절대 덮어쓰지 않는다. 복원본은 별도 디렉터리 + manifest 로 감사 가능하게.

import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import {
  assertFfmpeg,
  contentBBox,
  estimatePaper,
  probeSize,
  readRgb,
  runFilter,
  scaleBox,
} from './lib-img.mjs'

function parseArgs(argv) {
  const a = { sat: 1.22, scale: 2, denoise: true, crop: true }
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i]
    if (k === '--in') a.in = argv[++i]
    else if (k === '--out') a.out = argv[++i]
    else if (k === '--sat') a.sat = Number(argv[++i])
    else if (k === '--scale') a.scale = Number(argv[++i])
    else if (k === '--no-denoise') a.denoise = false
    else if (k === '--no-crop') a.crop = false
  }
  if (!a.in || !a.out) {
    console.error('사용법: node scripts/comic/pd/restore.mjs --in <dir|file> --out <dir> [--sat 1.22] [--scale 2]')
    process.exit(1)
  }
  return a
}

const IMG_RE = /\.(jpe?g|png|tif?f)$/i

function listInputs(input) {
  const st = fs.statSync(input)
  if (st.isFile()) return [input]
  return fs
    .readdirSync(input)
    .filter((f) => IMG_RE.test(f))
    .sort((x, y) => x.localeCompare(y, undefined, { numeric: true }))
    .map((f) => path.join(input, f))
}

/** 종이색 → 채널 게인. 종이를 흰색으로 끌어올리되 과보정은 물린다. */
export function whiteBalanceGains(paper, maxGain = 1.35) {
  const target = Math.max(paper.r, paper.g, paper.b)
  const g = (v) => Math.min(maxGain, Math.max(1, target / Math.max(1, v)))
  // 가장 밝은 채널 기준으로 나머지를 올린다 = 캐스트 제거.
  // 그 뒤 전체를 살짝 들어 종이가 250 근처가 되게 한다(순백에 너무 붙이면 계조가 죽는다).
  const lift = Math.min(1.12, 250 / Math.max(1, target))
  return { r: g(paper.r) * lift, g: g(paper.g) * lift, b: g(paper.b) * lift }
}

export function buildFilter({ box, gains, sat, scale, denoise }) {
  const f = []
  if (box) f.push(`crop=${box.w}:${box.h}:${box.x}:${box.y}`)
  // ② 화이트밸런스 — 채널 게인 (colorchannelmixer 대각 성분)
  f.push(
    `colorchannelmixer=rr=${gains.r.toFixed(4)}:gg=${gains.g.toFixed(4)}:bb=${gains.b.toFixed(4)}`,
  )
  // ③ 망점 완화 — 공간 3 / 연구창 5 정도가 선화를 지키면서 점만 녹인다
  if (denoise) f.push('nlmeans=s=1.6:p=3:r=9')
  // ④ 대비·채도 — 바랜 잉크 회복. gamma 를 살짝 내려 검정 선화를 진하게.
  f.push(`eq=contrast=1.10:saturation=${sat.toFixed(3)}:gamma=0.97:gamma_r=0.99:gamma_b=1.01`)
  // ⑤ 업스케일 + 언샤프 (업스케일 후에 샤픈해야 레터링 에지가 산다)
  if (scale && scale !== 1) f.push(`scale=iw*${scale}:ih*${scale}:flags=lanczos`)
  f.push('unsharp=luma_msize_x=5:luma_msize_y=5:luma_amount=0.85')
  return f.join(',')
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
  for (const [i, file] of files.entries()) {
    const name = path.basename(file).replace(IMG_RE, '.jpg')
    const out = path.join(args.out, name)

    const img = readRgb(file, 360)
    const box = args.crop ? scaleBox(contentBBox(img), img, 2) : null
    // 종이색은 크롭된 지면 안에서 다시 추정해야 정확하다(여백이 섞이면 왜곡).
    const paper = estimatePaper(img)
    const gains = whiteBalanceGains(paper)

    const filter = buildFilter({ box, gains, sat: args.sat, scale: args.scale, denoise: args.denoise })
    runFilter(file, out, filter)
    const after = probeSize(out)

    const rec = {
      src: path.relative(process.cwd(), file).replace(/\\/g, '/'),
      out: path.relative(process.cwd(), out).replace(/\\/g, '/'),
      srcSize: { w: img.srcW, h: img.srcH },
      outSize: after,
      paper: { r: Math.round(paper.r), g: Math.round(paper.g), b: Math.round(paper.b) },
      gains: { r: +gains.r.toFixed(3), g: +gains.g.toFixed(3), b: +gains.b.toFixed(3) },
      crop: box,
      params: { sat: args.sat, scale: args.scale, denoise: args.denoise },
    }
    manifest.push(rec)
    console.log(
      `[${i + 1}/${files.length}] ${name}  종이 rgb(${rec.paper.r},${rec.paper.g},${rec.paper.b})` +
        `  게인 ${rec.gains.r}/${rec.gains.g}/${rec.gains.b}` +
        `  ${img.srcW}×${img.srcH} → ${after.w}×${after.h}`,
    )
  }

  const mf = path.join(args.out, 'restore.manifest.json')
  fs.writeFileSync(mf, JSON.stringify({ generatedAt: null, pages: manifest }, null, 2))
  console.log(`\n복원 ${manifest.length}장 · manifest ${path.relative(process.cwd(), mf)}`)
}

// 직접 실행 판별 — Windows 에서 file://D:/ vs file:///D:/ 로 어긋나므로 pathToFileURL 로 정규화.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e.message)
    process.exit(1)
  })
}
