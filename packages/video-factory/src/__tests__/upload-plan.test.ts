// packages/video-factory/src/__tests__/upload-plan.test.ts
//
// 발행의 재실행 안전 — 건너뛰기는 **내용(sha256)** 이 같을 때만이다(PR #119 리뷰 결함 4).
// 같은 경로·같은 크기·다른 내용인 교체 편 파일이 「이미 올라갔다」로 건너뛰면 버킷에 옛 편이 남는다.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { nextHashIndex, parseHashIndex, planUploads, sha256File } from '../render/upload-plan'

describe('planUploads', () => {
  it('같은 크기라도 내용이 다르면 다시 올린다', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vf-upload-'))
    const oldFile = path.join(dir, 'old.vtt')
    const newFile = path.join(dir, 'new.vtt')
    fs.writeFileSync(oldFile, 'WEBVTT\n\nA')
    fs.writeFileSync(newFile, 'WEBVTT\n\nB')
    expect(fs.statSync(oldFile).size).toBe(fs.statSync(newFile).size)

    const remote = { 'x.vtt': sha256File(oldFile) }
    const plan = planUploads([{ key: 'x.vtt', sha256: sha256File(newFile) }], new Set(['x.vtt']), remote)
    expect(plan.upload.map((f) => f.key)).toEqual(['x.vtt'])
    expect(plan.skip).toEqual([])
  })

  it('버킷에 있고 해시가 같을 때만 건너뛴다', () => {
    const plan = planUploads(
      [
        { key: 'same.mp4', sha256: 'h1' },
        { key: 'gone.mp4', sha256: 'h2' },
        { key: 'new.mp4', sha256: 'h3' },
      ],
      new Set(['same.mp4']),
      { 'same.mp4': 'h1', 'gone.mp4': 'h2' },
    )
    expect(plan.skip.map((f) => f.key)).toEqual(['same.mp4'])
    // purge 로 버킷에서 지워졌으면 해시 기록이 남아 있어도 다시 올린다
    expect(plan.upload.map((f) => f.key)).toEqual(['gone.mp4', 'new.mp4'])
  })

  it('기록이 없거나 깨졌으면 전부 올린다', () => {
    expect(parseHashIndex(null)).toEqual({})
    expect(parseHashIndex('{not json')).toEqual({})
    expect(parseHashIndex('[1,2]')).toEqual({})
    const plan = planUploads([{ key: 'a.jpg', sha256: 'h' }], new Set(['a.jpg']), parseHashIndex(null))
    expect(plan.upload.length).toBe(1)
  })

  it('다음 기록은 성공한 것만 새 해시로, 실패한 것은 지운다', () => {
    const next = nextHashIndex({ 'a.mp4': 'old', 'b.mp4': 'old' }, [{ key: 'a.mp4', sha256: 'new' }], ['b.mp4'])
    expect(next).toEqual({ 'a.mp4': 'new' })
  })
})
