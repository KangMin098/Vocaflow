// apps/web/scripts/ensure-onnx-runtime.mjs
//
// onnxruntime-web 의 WASM 런타임을 `public/onnx/` 로 복사한다 — EchoMatch(Piper TTS)의 전제.
//
// 왜 이 스크립트가 필요한가 (실측 2026-08-15):
//   `public/onnx/` 는 74MB 라 `.gitignore` 에 있고, 그 옆 주석은
//   "CDN 또는 npm install 시 자동 다운로드 **권장**" 이라고만 적혀 있었다. **권장만 있고
//   하는 코드가 없었다.** `lib/echo/piper-tts.ts` 주석도 "…public/onnx/ 로 복사 후" 라고
//   사람이 손으로 한 것을 기록해 두었을 뿐이다.
//   → 새로 받은 체크아웃에서 EchoMatch 는 조용히 죽는다:
//        no available backend found. ERR: [wasm] TypeError: Failed to fetch
//        dynamically imported module: /onnx/ort-wasm-simd-threaded.jsep.mjs
//     화면은 "음성 모델 로드 실패" 만 말하므로, 원인이 **네트워크가 아니라 빠진 정적 자산**
//     이라는 걸 알아내려면 여기까지 파고들어야 한다(실제로 e2e 가 그렇게 실패하고 있었다).
//
// 멱등하다 — 이미 있고 크기가 같으면 건너뛴다. dev/build 앞에 매번 돌려도 비용이 없다.

import { createRequire } from 'node:module'
import { copyFileSync, existsSync, mkdirSync, readdirSync, realpathSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))
const publicOnnx = join(here, '..', 'public', 'onnx')

/** `piper-tts-web` 이 로드하는 백엔드 묶음. .mjs 만 있고 .wasm 이 없으면 그대로 실패한다. */
const PATTERN = /^ort-wasm-simd-threaded\./

/**
 * onnxruntime-web 의 dist 경로.
 *
 * resolve 를 못 쓴다. 두 가지가 동시에 막는다:
 *   · onnxruntime-web 은 **직접 의존이 아니라** `@mintplex-labs/piper-tts-web` 의 전이 의존이고,
 *     pnpm 은 전이 의존을 최상위로 끌어올리지 않는다(엄격 격리) → `MODULE_NOT_FOUND`
 *   · piper 패키지는 `exports` 에 main 도 `./package.json` 도 없다 → `ERR_PACKAGE_PATH_NOT_EXPORTED`
 * 그래서 심볼릭 링크의 실제 경로를 따라가 **형제 패키지**로 찾는다.
 * (pnpm 은 의존 패키지를 `.pnpm/<pkg>@<ver>_<peer>/node_modules/` 안에 나란히 둔다.)
 */
function distDir() {
  // ① 혹시 최상위에 있으면 그대로 (npm/yarn 평탄화 · 향후 직접 의존이 될 경우)
  try {
    return join(dirname(require.resolve('onnxruntime-web/package.json')), 'dist')
  } catch {
    /* pnpm 기본 경로로 */
  }
  // ② piper 심링크 → 실제 위치 → 형제 onnxruntime-web
  try {
    const piperReal = realpathSync(join(here, '..', 'node_modules', '@mintplex-labs', 'piper-tts-web'))
    const siblings = join(piperReal, '..', '..') // .pnpm/<…>/node_modules
    const dist = join(siblings, 'onnxruntime-web', 'dist')
    if (existsSync(dist)) return dist
  } catch {
    /* 없음 */
  }
  return null
}

const src = distDir()
if (!src || !existsSync(src)) {
  console.warn('[onnx] onnxruntime-web 를 찾지 못했습니다 — EchoMatch 음성 합성은 비활성입니다.')
  process.exit(0) // 빌드를 막지 않는다: EchoMatch 외 화면은 이것 없이도 전부 동작한다
}

mkdirSync(publicOnnx, { recursive: true })

let copied = 0
let skipped = 0
for (const file of readdirSync(src).filter((f) => PATTERN.test(f))) {
  const from = join(src, file)
  const to = join(publicOnnx, file)
  if (existsSync(to) && statSync(to).size === statSync(from).size) {
    skipped += 1
    continue
  }
  copyFileSync(from, to)
  copied += 1
}

if (copied > 0) {
  console.log(`[onnx] ${copied}개 복사 → public/onnx/ (기존 ${skipped}개 유지)`)
}
