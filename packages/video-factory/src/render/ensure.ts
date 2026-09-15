// packages/video-factory/src/render/ensure.ts
//
// **번들 전에 있어야 하는 것들** — 없으면 Remotion 번들이 import 단계에서 실패한다.
//
// 왜 빈 파일을 만들어 두나: 음성은 **선택**이다(자막이 있으므로 무음 영상도 성립한다).
// 그런데 `Root.tsx` 는 브라우저에서 돌아 `fs.existsSync` 를 못 쓰므로, "없으면 빈 객체" 를
// **파일로** 만들어 줘야 한다. 원료(`source-bundle.json`)는 반대다 — 없으면 만들지 않고
// 멈춘다. 빈 원료로 영상을 찍으면 수치가 없는 광고가 나가고, 그건 조용한 거짓말이다.

import fs from 'node:fs'
import path from 'node:path'

import { BUNDLE_PATH, MissingBundleError } from '../catalog/bundle'
import { VOICE_DIR } from '../voice/edge-tts'
import type { VoiceManifest } from '../voice/timing'

export const VOICE_INDEX = path.join(VOICE_DIR, 'index.json')

/** 영상별 음성 manifest 를 한 파일로 모은다 — 번들이 import 할 수 있는 유일한 모양이다. */
export function writeVoiceIndex(): Record<string, VoiceManifest> {
  fs.mkdirSync(VOICE_DIR, { recursive: true })
  const index: Record<string, VoiceManifest> = {}
  for (const entry of fs.readdirSync(VOICE_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const p = path.join(VOICE_DIR, entry.name, 'voice.json')
    if (!fs.existsSync(p)) continue
    index[entry.name] = JSON.parse(fs.readFileSync(p, 'utf8')) as VoiceManifest
  }
  fs.writeFileSync(VOICE_INDEX, JSON.stringify(index, null, 2) + '\n', 'utf8')
  return index
}

/** 번들 전 점검. 원료가 없으면 **무엇을 실행해야 하는지** 알려 주고 멈춘다. */
export function ensureWorkFiles(): void {
  if (!fs.existsSync(BUNDLE_PATH)) throw new MissingBundleError(BUNDLE_PATH)
  writeVoiceIndex()
}
