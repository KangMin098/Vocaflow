// packages/video-factory/src/requests/retired.ts
//
// **내린 편 목록 — `work/retired.json`.**
//
// 정본은 DB(`video_retirements`)다. 파일로 한 번 더 두는 이유는 Remotion 루트와 같다 —
// 번들은 브라우저에서 돌아 DB 를 못 읽는다. CLI 는 명령마다 DB 에서 이 파일을 새로 쓴다
// (`drain.mts` 의 refreshRetiredFile).
//
// ⚠️ **파일이 없으면 빈 목록으로 삼키지 않는다.** 빈 목록이면 내린 편이 다음 포장에 조용히
//    되살아나 학습자 화면에 다시 뜬다 — 내린 이유(틀린 수치 등)가 그대로 돌아온다.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
export const RETIRED_PATH = path.resolve(HERE, '../../work/retired.json')

export class MissingRetiredError extends Error {
  constructor(p: string) {
    super(
      `내린 편 목록이 없다: ${p}\n` +
        '  DB 에서 받아 온다 →  pnpm video requests\n' +
        '  (없는 채로 진행하면 내린 편이 다음 포장에 되살아난다)',
    )
    this.name = 'MissingRetiredError'
  }
}

export function readRetired(file: string = RETIRED_PATH): Set<string> {
  if (!fs.existsSync(file)) throw new MissingRetiredError(file)
  return new Set(JSON.parse(fs.readFileSync(file, 'utf8')) as string[])
}

export function writeRetired(ids: Iterable<string>, file: string = RETIRED_PATH): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify([...new Set(ids)].sort(), null, 2) + '\n', 'utf8')
}
