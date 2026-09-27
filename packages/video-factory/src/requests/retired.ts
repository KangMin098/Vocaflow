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

/** DB 의 내린 편 한 줄 중 가르는 데 필요한 칸 */
export interface RetirementState {
  video_id: string
  restored_at: string | null
  purged_at: string | null
  /** purge 된 편의 되살리기 = 다시 찍기 요청(20260926130000). 마이그레이션 전이면 없다 */
  rerender_requested_at?: string | null
}

/**
 * **내린 편을 단계별로 가른다.** 순수 함수.
 *
 *   · `excluded`  — 포장·발행·manifest 에서 뺄 id: 되살리지 않은 것 **전부**
 *   · `forRender` — 음성·렌더·썸네일(`work/retired.json` · Remotion 루트)에서 뺄 id:
 *                   위에서 「다시 찍기 요청」된 purge 편만 뺀 것. 그래야 파일을 다시 만들 수 있다
 *   · `rerender`  — 다시 찍기 요청된 id. 렌더가 모든 규격을 파일로 확인하면 `video_retire_rerendered`
 *                   가 purged_at 을 지우고 되살린다 — 그 전에는 포장·발행에 나가지 않는다
 */
export function splitRetired(rows: readonly RetirementState[]): {
  excluded: string[]
  forRender: string[]
  rerender: string[]
} {
  const live = rows.filter((r) => r.restored_at === null)
  const rerender = live.filter((r) => r.purged_at !== null && r.rerender_requested_at).map((r) => r.video_id)
  const skip = new Set(rerender)
  return {
    excluded: live.map((r) => r.video_id),
    forRender: live.map((r) => r.video_id).filter((id) => !skip.has(id)),
    rerender,
  }
}
