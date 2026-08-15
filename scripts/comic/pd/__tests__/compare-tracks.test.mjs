// scripts/comic/pd/__tests__/compare-tracks.test.mjs
//
// 회귀 락: 트랙 비교의 컷 매칭이 **틀린 컷을 조용히 고르지 않는지**.
//
// 실제로 났던 일(2026-08-14): `work/_kaggle-restyle/out/` 에 5개 호의 산출물이 한 폴더로 섞여
// 있었고, 접미사 일치만 하던 매처가 `ci027__0001-c01.jpg` 대신 `1954-07classicsi__0001-c01.jpg`
// 를 골랐다. The Spy 표지와 Ivanhoe 표지를 비교해 SSIM 0.087 이 나왔고, 그 숫자는
// "모델이 구도를 완전히 부쉈다"로 읽힌다 — 지표가 틀린 결론을 그럴듯하게 만든다.
// 비교가 틀리면 비교 안 하느니만 못하므로, 모호하면 **고르지 않는다.**

import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { findPanelFile } from '../compare-tracks.mjs'

let DIR

beforeAll(() => {
  DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cmp-tracks-'))
  for (const f of [
    'ci027__0001-c01.jpg',
    '1954-07classicsi__0001-c01.jpg',
    'whiz__0002-c01.jpg',
    '0003-c01.jpg',
    'notes.txt',
  ]) {
    fs.writeFileSync(path.join(DIR, f), 'x')
  }
})

afterAll(() => {
  fs.rmSync(DIR, { recursive: true, force: true })
})

describe('findPanelFile', () => {
  it('정확히 같은 이름이 있으면 그것을 쓴다', () => {
    const { file } = findPanelFile(DIR, '0003-c01.jpg')
    expect(path.basename(file)).toBe('0003-c01.jpg')
  })

  it('접두사가 붙은 산출물을 접미사로 찾는다', () => {
    const { file } = findPanelFile(DIR, '0002-c01.jpg')
    expect(path.basename(file)).toBe('whiz__0002-c01.jpg')
  })

  it('후보가 여럿이면 고르지 않고 모호함을 알린다 (틀린 컷 비교 방지)', () => {
    const r = findPanelFile(DIR, '0001-c01.jpg')
    expect(r.file).toBeNull()
    expect(r.ambiguous).toHaveLength(2)
  })

  it('hint 로 좁혀지면 그 컷을 고른다', () => {
    const { file } = findPanelFile(DIR, '0001-c01.jpg', 'ci027')
    expect(path.basename(file)).toBe('ci027__0001-c01.jpg')
  })

  it('hint 가 어느 후보와도 안 맞으면 여전히 모호로 남긴다', () => {
    const r = findPanelFile(DIR, '0001-c01.jpg', 'odyssey')
    expect(r.file).toBeNull()
    expect(r.ambiguous).toHaveLength(2)
  })

  it('없는 컷은 null', () => {
    const { file } = findPanelFile(DIR, '9999-c09.jpg')
    expect(file).toBeNull()
  })

  it('디렉터리가 없어도 던지지 않는다', () => {
    const { file } = findPanelFile(path.join(DIR, 'nope'), '0001-c01.jpg')
    expect(file).toBeNull()
  })
})
