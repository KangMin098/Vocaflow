// packages/video-factory/src/requests/store.ts
//
// **승인된 요청 편의 설계도 파일** — `work/request-specs.json`.
//
// 왜 파일인가: Remotion 루트(`remotion/Root.tsx`)는 브라우저에서 돌아 DB 를 못 읽고 `fs` 도
// 못 쓴다. 원료처럼 **번들 시점에 import** 되는 JSON 이어야 한다. `requests:pull` 이 DB 의
// 승인본으로 이 파일을 쓰고, 렌더·음성·포장은 규칙 편과 똑같이 이 설계도를 읽는다.
//
// 없으면 빈 배열이다 — 요청 편은 **선택**이다(규칙 편 73편은 이 파일 없이도 그대로 돈다).

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { SourceBundle } from '../catalog/bundle'
import { buildSpecs } from '../catalog/build'
import type { VideoSpec } from '../spec/types'
import { mergeSpecs } from './merge'
import { readRetired } from './retired'

const HERE = path.dirname(fileURLToPath(import.meta.url))
export const REQUEST_SPECS_PATH = path.resolve(HERE, '../../work/request-specs.json')

export function loadRequestSpecs(file: string = REQUEST_SPECS_PATH): VideoSpec[] {
  if (!fs.existsSync(file)) return []
  return JSON.parse(fs.readFileSync(file, 'utf8')) as VideoSpec[]
}

export function writeRequestSpecs(specs: VideoSpec[], file: string = REQUEST_SPECS_PATH): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const sorted = [...specs].sort((a, b) => a.id.localeCompare(b.id))
  fs.writeFileSync(file, JSON.stringify(sorted, null, 2) + '\n', 'utf8')
}

/** Remotion 번들이 import 할 수 있게 — 없으면 빈 배열 파일을 만든다. */
export function ensureRequestSpecsFile(file: string = REQUEST_SPECS_PATH): void {
  if (!fs.existsSync(file)) writeRequestSpecs([], file)
}

/**
 * **규칙 편 + 요청 편 − 내린 편** — 음성·렌더·포장·발행이 읽는 전체 목록.
 * 합치는 규칙은 `merge.ts`(교체 편은 같은 id 를 이기고, 새 편은 진다).
 *
 * `retired` 를 안 넘기면 `work/retired.json` 을 읽는다 — 없으면 **멈춘다**(retired.ts 머리말).
 */
export function allSpecs(
  b: SourceBundle,
  opts: { file?: string; retired?: ReadonlySet<string> } = {},
): VideoSpec[] {
  return mergeSpecs(buildSpecs(b), loadRequestSpecs(opts.file), opts.retired ?? readRetired())
}
