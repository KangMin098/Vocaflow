// packages/video-factory/src/render/loudness-run.mts
//
// **음량을 재고 고치는 실행부.** 판정 규칙은 `loudness.ts`(순수부)에 있고 여기서는 ffmpeg 만 돌린다.
//
// ⚠️ 이름이 `loudness.mts` 가 **아닌** 이유: 같은 이름으로 두면 `./loudness` 를 tsx 는 `.ts` 로,
//   vite 는 `.mts` 로 풀어서 **회귀가 순수부 대신 실행부를 가져온다**(실측: import 전부 undefined).
//
// ── 왜 2패스인가 ────────────────────────────────────────────────────
// `loudnorm` 을 한 번만 걸면 실시간 추정으로 맞춰서 목표를 1~2 LU 빗나간다. 먼저 재고,
// 그 값을 필터에 넣어 다시 거는 것이 방송 관행이고 ffmpeg 문서가 권하는 방식이다.
//
// ── 화면은 다시 안 그린다 ───────────────────────────────────────────
// 영상 스트림은 `-c:v copy` 로 그대로 옮긴다. 90분짜리 렌더를 다시 하지 않고 **소리만** 고친다.
//
// ⚠️ **포장(`package`) 앞에 돌린다.** 포장이 manifest 에 바이트 수를 적는데, 포장 뒤에 음량을
//   고치면 파일이 바뀌어 그 수가 틀어진다.

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { ffmpegPath } from './ffmpeg'
import { parseLoudness, TARGET_LUFS, TARGET_TP, type Loudness } from './loudness'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const PKG = path.resolve(HERE, '../..')
const OUT = path.join(PKG, 'out')

/**
 * ffmpeg 를 돌리고 **stdout 과 stderr 를 둘 다** 돌려준다.
 *
 * ⚠️ 여기서 한 번 틀렸다(실측 2026-09-13). `execFileSync` 는 성공하면 **stdout 만** 돌려주는데,
 * `loudnorm` 의 측정 요약은 **stderr 로 나오고 ffmpeg 는 exit 0 으로 끝난다.** 그래서 예외가
 * 안 나고 → stderr 가 버려지고 → 186편 전부 "못 잼" 이 됐다. `spawnSync` 로 둘 다 받는다.
 */
function run(args: string[]): string {
  const bin = ffmpegPath()
  if (!bin) throw new Error('ffmpeg 를 못 찾았다')
  const r = spawnSync(bin, ['-hide_banner', '-nostats', ...args], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  if (r.error) {
    throw new Error(`ffmpeg 를 실행할 수 없다: ${bin} — ${(r.error as Error).message}`)
  }
  return `${r.stdout ?? ''}\n${r.stderr ?? ''}`
}

/** 한 파일을 잰다. **고치지 않는다.** */
export function measure(file: string): Loudness {
  // `-vn` 이 없으면 영상 인코더를 찾다가 죽는다.
  const out = run(['-i', file, '-vn', '-af', 'loudnorm=print_format=summary', '-f', 'null', '-'])
  return parseLoudness(file, out)
}

/**
 * 2패스 정규화. 원본을 제자리에서 바꾸되 **임시 파일로 만든 뒤 옮긴다** —
 * 중간에 끊겨도 반쪽짜리 mp4 가 남지 않게.
 */
export function normalize(file: string): { before: Loudness; after: Loudness } | null {
  const before = measure(file)
  if (before.integrated === null) return null

  // 1패스 — 측정값을 JSON 으로 받는다.
  const json = run([
    '-i',
    file,
    '-vn',
    '-af',
    `loudnorm=I=${TARGET_LUFS}:TP=${TARGET_TP}:LRA=11:print_format=json`,
    '-f',
    'null',
    '-',
  ])
  const m = json.match(/\{[\s\S]*?\}/)
  if (!m) return null
  const s = JSON.parse(m[0]) as Record<string, string>

  // 2패스 — 잰 값을 넣어 정확히 맞춘다. 영상은 복사만 한다.
  const tmp = `${file}.norm.mp4`
  fs.rmSync(tmp, { force: true })
  run([
    '-y',
    '-i',
    file,
    '-af',
    `loudnorm=I=${TARGET_LUFS}:TP=${TARGET_TP}:LRA=11:` +
      `measured_I=${s.input_i}:measured_TP=${s.input_tp}:measured_LRA=${s.input_lra}:` +
      `measured_thresh=${s.input_thresh}:offset=${s.target_offset}:linear=true`,
    '-ar',
    // `loudnorm` 은 192kHz 로 올려 처리한다 — 되돌리지 않으면 AAC 인코더가 거부한다.
    '48000',
    '-c:v',
    'copy',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-movflags',
    '+faststart',
    tmp,
  ])
  if (!fs.existsSync(tmp) || fs.statSync(tmp).size === 0) {
    fs.rmSync(tmp, { force: true })
    return null
  }
  fs.rmSync(file, { force: true })
  fs.renameSync(tmp, file)
  return { before, after: measure(file) }
}

/** `out/` 아래의 mp4 전부 (규격 폴더 순회). */
export function allRendered(): string[] {
  const out: string[] = []
  for (const fmt of ['wide', 'vertical', 'square']) {
    const dir = path.join(OUT, fmt)
    if (!fs.existsSync(dir)) continue
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith('.mp4')) out.push(path.join(dir, f))
    }
  }
  return out.sort()
}

/** 화면·CLI 가 함께 쓰는 상대 경로 표기 — `wide/intro-platform.mp4`. */
export function shortName(file: string): string {
  // Windows 에서는 `wide\intro.mp4` 로 나온다 — 화면·로그·회귀가 같은 문자열을 보게 슬래시로 맞춘다.
  return path.relative(OUT, file).split(path.sep).join('/')
}
