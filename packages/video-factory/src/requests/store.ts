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
 * **규칙 편 + 요청 편** — 음성·렌더·포장·발행이 읽는 전체 목록.
 * 같은 id 가 둘에 있으면 규칙 편이 이긴다(요청 id 는 `req-` 로 시작해 겹칠 수 없지만, 겹치면
 * 기존 편을 조용히 덮는 쪽보다 요청 편이 빠지는 쪽이 안전하다).
 */
export function allSpecs(b: SourceBundle, file: string = REQUEST_SPECS_PATH): VideoSpec[] {
  const rule = buildSpecs(b)
  const ids = new Set(rule.map((s) => s.id))
  return [...rule, ...loadRequestSpecs(file).filter((s) => !ids.has(s.id))]
}
