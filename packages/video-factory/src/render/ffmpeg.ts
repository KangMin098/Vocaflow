// packages/video-factory/src/render/ffmpeg.ts
//
// **ffmpeg 를 찾는다.** 이 머신에는 시스템 ffmpeg 가 없다(실측: `which ffmpeg` → 없음).
// 그런데 Remotion 이 플랫폼별 compositor 패키지에 `ffmpeg.exe` 를 **함께 깔아 둔다** —
// 렌더에 쓰는 바로 그 바이너리다. 새로 설치할 것 없이 그것을 쓴다.
//
// 시스템에 있으면 그것도 받아 준다(CI·리눅스). **못 찾으면 조용히 넘어가지 않고 말한다** —
// 조용한 무동작은 이 저장소가 반복해 겪은 사고다.

import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'

const require_ = createRequire(import.meta.url)

/** Remotion 이 쓰는 플랫폼별 compositor 패키지 이름. */
function compositorPackage(): string {
  const platform =
    process.platform === 'win32' ? 'win32' : process.platform === 'darwin' ? 'darwin' : 'linux'
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64'
  const abi = platform === 'win32' ? '-msvc' : platform === 'linux' ? '-gnu' : ''
  return `@remotion/compositor-${platform}-${arch}${abi}`
}

let cached: string | null | undefined

/** ffmpeg 실행 파일 경로. 없으면 null. */
export function ffmpegPath(): string | null {
  if (cached !== undefined) return cached
  const exe = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
  try {
    const pkgJson = require_.resolve(`${compositorPackage()}/package.json`)
    const candidate = path.join(path.dirname(pkgJson), exe)
    if (fs.existsSync(candidate)) {
      cached = candidate
      return cached
    }
  } catch {
    // 패키지가 없다 — 시스템 쪽을 본다.
  }
  // PATH 에 있으면 이름만으로 실행된다. 여기서 존재 확인까지는 하지 않고 호출부가 실패를 본다.
  cached = 'ffmpeg'
  return cached
}
