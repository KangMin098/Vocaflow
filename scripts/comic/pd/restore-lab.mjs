// scripts/comic/pd/restore-lab.mjs
//
// 복원 품질 실험 하네스 — "Claude Code 를 루프의 지능으로" 방법론. 한 페이지에 대해 여러 복원 변형을
// ffmpeg 로 만들고, Claude Code(오퍼레이터)가 각 이미지를 직접 보고 채점·비교해 최적 프로파일을 고른다.
// 모든 변형은 lab.manifest.json 에 기록(모니터링). 반복하며 파라미터를 조정 → "현대적"으로 수렴.
//
//   node scripts/comic/pd/restore-lab.mjs --in work/whiz/pages/0005.jpg --out work/lab [--scale 2]
//
// 변형 설계(딥서치 근거): 낡은 스캔의 누런종이·halftone·저대비를 잡되 line art 를 살린다.
//   grayscale 강제(핑크틴트 제거) · colorlevels(종이→흰·잉크→검) · hqdn3d(디스크린 근사) · unsharp(선명).

import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? d : process.argv[i + 1] }
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const REPO = path.resolve(HERE, '..', '..', '..')
const FF = process.env.FFMPEG_BIN || (fs.existsSync(path.join(REPO, 'tools', 'ffmpeg', 'ffmpeg.exe')) ? path.join(REPO, 'tools', 'ffmpeg', 'ffmpeg.exe') : 'ffmpeg')

const IN = arg('in')
const OUT = arg('out', 'work/lab')
const SCALE = Number(arg('scale', 2))
if (!IN || !fs.existsSync(IN)) { console.error(`--in <이미지> 필요(존재해야 함): ${IN}`); process.exit(2) }
fs.mkdirSync(OUT, { recursive: true })

const up = `scale=iw*${SCALE}:ih*${SCALE}:flags=lanczos`
// Claude Code 발견(이미지 실측): 스토리 페이지는 흑백이 아니라 4색 컬러. → 컬러 복원 변형.
// 목표: 누런 종이(황색 캐스트) 중화 + 바랜 잉크 채도/대비 부스트 + halftone 디스크린 + 선명 업스케일.
const VARIANTS = [
  { key: 'v1_baseline', note: '현행(채도1.22) — 황색 캐스트 잔존', vf: `eq=saturation=1.22:contrast=1.05, ${up}` },
  { key: 'v2_neutral', note: '황색 중화(청색 감마↑) + 채도', vf: `eq=gamma_b=1.12:saturation=1.28:contrast=1.06, ${up}` },
  { key: 'v3_vivid_descreen', note: '디스크린 + 황색중화 + 채도↑ + 샤픈', vf: `hqdn3d=2:2:5:5, eq=gamma_b=1.1:saturation=1.38:contrast=1.08, unsharp=5:5:0.6:5:5:0.0, ${up}` },
  { key: 'v4_wb_curves', note: '화이트밸런스(청색 리프트 커브) + 채도', vf: `curves=b='0/0.045 1/1', eq=saturation=1.3:contrast=1.06, ${up}` },
  { key: 'v5_modern_punch', note: '디스크린 + 강중화 + 강채도/대비(현대 vivid)', vf: `hqdn3d=2:2:4:4, eq=gamma_b=1.13:saturation=1.45:contrast=1.12:brightness=0.02, unsharp=5:5:0.7:5:5:0.0, ${up}` },
]

const results = []
for (const v of VARIANTS) {
  const outFile = path.join(OUT, `${v.key}.jpg`)
  const r = spawnSync(FF, ['-y', '-i', IN, '-vf', v.vf, '-q:v', '3', outFile], { encoding: 'utf8' })
  const ok = r.status === 0 && fs.existsSync(outFile)
  const sz = ok ? fs.statSync(outFile).size : 0
  results.push({ ...v, out: path.relative(REPO, outFile), ok, bytes: sz })
  console.log(`  ${ok ? '✓' : '✗'} ${v.key.padEnd(15)} ${(sz / 1024).toFixed(0).padStart(5)}KB  ${v.note}`)
}
const mf = { input: path.relative(REPO, path.resolve(IN)), scale: SCALE, generatedVariants: results.length, variants: results, verdict: null, generatedNote: 'Claude Code 가 각 변형을 열어 채점 후 verdict 갱신' }
fs.writeFileSync(path.join(OUT, 'lab.manifest.json'), JSON.stringify(mf, null, 2))
console.log(`\n✓ 변형 ${results.filter((r) => r.ok).length}개 · ${OUT} · lab.manifest.json (모니터링)`)
console.log('  → Claude Code 가 각 변형을 열어 "가장 깨끗·현대적" 판정 → 최적 프로파일 확정')
