// packages/video-factory/src/__tests__/test-bundle.ts
//
// **테스트 전용** 원료 로더 — 제품 경로(`catalog/bundle.ts` `loadBundle` · `render/ensure.ts`)는 이 파일을 쓰지 않는다.
//
// 왜: 진짜 원료 `work/source-bundle.json` 은 DB 실측이라 커밋하지 않는다(패키지 .gitignore — 낡은 수치로 광고를 찍지 않게).
// 그래서 깨끗한 체크아웃(CI)에는 없고, 이 파일을 모듈 첫 줄에서 읽던 두 테스트가 통째로 떨어졌다(2026-09-19 · 이슈 #101).
// 순서: work/ 가 있으면 그것(로컬 — 실측 그대로 검사) → 없으면 tests/fixtures/ 의 고정 원료.
// 둘 다 없으면 vitest.config.ts 가 두 테스트 파일을 **이유를 출력하고** 뺀다(이 함수는 불리지 않는다).

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { BUNDLE_PATH, loadBundle, type SourceBundle } from '../catalog/bundle'

const HERE = path.dirname(fileURLToPath(import.meta.url))
export const FIXTURE_BUNDLE_PATH = path.resolve(HERE, '../../tests/fixtures/source-bundle.json')

export function testBundleSource(): 'work' | 'fixture' | null {
  if (fs.existsSync(BUNDLE_PATH)) return 'work'
  if (fs.existsSync(FIXTURE_BUNDLE_PATH)) return 'fixture'
  return null
}

export function loadTestBundle(): SourceBundle {
  const src = testBundleSource()
  return loadBundle(src === 'fixture' ? FIXTURE_BUNDLE_PATH : BUNDLE_PATH)
}
