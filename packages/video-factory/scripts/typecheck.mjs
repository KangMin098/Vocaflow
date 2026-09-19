// packages/video-factory/scripts/typecheck.mjs
//
// 타입 검사 — 원료가 있으면 전부, 없으면 Remotion 루트 두 파일만 빼고 **경고를 남기고** 검사한다(이슈 #101).
// 왜: src/remotion/Root.tsx 는 브라우저에서 돌아서 원료 JSON(work/source-bundle.json · work/voice/index.json)을
// **번들 시점에 import** 한다. work/ 는 DB 실측이라 커밋하지 않으므로(.gitignore) 깨끗한 체크아웃(CI)에는 없다.
// 원료를 픽스처로 채워 넣지 않는 이유: render/ensure.ts 가 「원료가 없으면 만들지 않는다」로 막아 둔 가드를 우회하게 된다.

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = join(dirname(fileURLToPath(import.meta.url)), '..')
const has = ['work/source-bundle.json', 'work/voice/index.json'].every((f) => existsSync(join(HERE, f)))
if (!has) console.warn('[video-factory] 원료 없음 — src/remotion/Root.tsx · index.ts 는 타입 검사에서 건너뜀(pnpm --filter web video:source 로 원료를 뽑으면 전부 검사).')
const tsc = createRequire(join(HERE, 'package.json')).resolve('typescript/bin/tsc')
const r = spawnSync(process.execPath, [tsc, '--noEmit', '-p', has ? 'tsconfig.json' : 'tsconfig.no-bundle.json'], { cwd: HERE, stdio: 'inherit' })
process.exit(r.status ?? 1)
