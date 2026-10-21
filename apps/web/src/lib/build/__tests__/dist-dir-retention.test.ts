// apps/web/src/lib/build/__tests__/dist-dir-retention.test.ts
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  OWNER_FILE,
  planDistDirPrune,
  pruneDistDirs,
} from '../../../../scripts/dist-dir-retention.mjs'

const NOW = Date.parse('2026-10-21T12:00:00Z')
const HOUR = 60 * 60_000

let webDir: string

/** 격리 사본 하나를 만들고 마지막으로 쓰인 시각을 고정한다. */
function makeDist(name: string, hoursAgo: number, owner?: { pid: number; touchedMinutesAgo: number }) {
  const dir = path.join(webDir, name)
  fs.mkdirSync(path.join(dir, 'server'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'BUILD_ID'), name)
  const t = new Date(NOW - hoursAgo * HOUR)
  for (const p of [path.join(dir, 'server'), path.join(dir, 'BUILD_ID'), dir]) fs.utimesSync(p, t, t)
  if (owner) {
    const file = path.join(dir, OWNER_FILE)
    fs.writeFileSync(file, JSON.stringify({ pid: owner.pid }))
    const ot = new Date(NOW - owner.touchedMinutesAgo * 60_000)
    fs.utimesSync(file, ot, ot)
    // 표식 파일이 사본의 마지막 쓰기 시각을 끌어올리지 않게 디렉터리 시각은 사본 시각으로 되돌린다.
    fs.utimesSync(dir, t, t)
  }
}

const names = (xs: { name: string }[]) => xs.map((x) => x.name).sort()

beforeEach(() => {
  webDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dist-retention-'))
})
afterEach(() => {
  fs.rmSync(webDir, { recursive: true, force: true })
})

describe('planDistDirPrune — 검증 빌드 사본 보존 한도', () => {
  it('회차마다 쌓인 사본은 최신 2개만 남기고 나머지를 고른다', () => {
    for (let r = 12; r <= 20; r++) makeDist(`.next-admin-usability-r${r}`, 40 - r)
    const { remove, kept } = planDistDirPrune({ webDir, now: NOW, isAlive: () => false })
    expect(names(kept)).toEqual(['.next-admin-usability-r19', '.next-admin-usability-r20'])
    expect(remove).toHaveLength(7)
  })

  it('살아 있는 서버의 표식이 있는 사본은 오래돼도 지우지 않는다', () => {
    makeDist('.next-served', 30, { pid: 4242, touchedMinutesAgo: 1 })
    makeDist('.next-a', 20)
    makeDist('.next-b', 10)
    makeDist('.next-c', 5)
    const { remove, kept } = planDistDirPrune({ webDir, now: NOW, isAlive: (pid) => pid === 4242 })
    expect(kept).toContainEqual({ name: '.next-served', reason: 'live-server' })
    expect(names(remove)).toEqual(['.next-a'])
  })

  it('표식의 프로세스가 죽었거나 heartbeat 이 끊겼으면 보호하지 않는다', () => {
    makeDist('.next-dead-pid', 30, { pid: 1, touchedMinutesAgo: 1 })
    makeDist('.next-stale-beat', 29, { pid: 4242, touchedMinutesAgo: 10 })
    const { remove } = planDistDirPrune({ webDir, now: NOW, maxKeep: 0, isAlive: (pid) => pid === 4242 })
    expect(names(remove)).toEqual(['.next-dead-pid', '.next-stale-beat'])
  })

  it('최근에 쓰인 사본은 다른 세션이 빌드 중일 수 있어 남긴다', () => {
    makeDist('.next-building', 0.5)
    makeDist('.next-old', 24)
    const { remove, kept } = planDistDirPrune({ webDir, now: NOW, maxKeep: 0, isAlive: () => false })
    expect(kept).toContainEqual({ name: '.next-building', reason: 'recent' })
    expect(names(remove)).toEqual(['.next-old'])
  })

  it('.next · .next-dev · 이번 빌드 대상은 후보가 아니다', () => {
    makeDist('.next', 99)
    makeDist('.next-dev', 99)
    makeDist('.next-verify', 99)
    const { remove, kept } = planDistDirPrune({
      webDir,
      target: '.next-verify',
      now: NOW,
      maxKeep: 0,
      isAlive: () => false,
    })
    expect(remove).toEqual([])
    expect(kept).toEqual([])
  })

  it('.next 로 시작하지 않는 폴더와 파일은 건드리지 않는다', () => {
    fs.mkdirSync(path.join(webDir, 'src'))
    fs.writeFileSync(path.join(webDir, '.next-notes.txt'), 'x')
    const { remove } = planDistDirPrune({ webDir, now: NOW, maxKeep: 0, isAlive: () => false })
    expect(remove).toEqual([])
  })
})

describe('pruneDistDirs', () => {
  it('고른 사본을 실제로 지우고 결과를 한 줄로 알린다', () => {
    makeDist('.next-r1', 30)
    makeDist('.next-r2', 20)
    makeDist('.next-r3', 10)
    const lines: string[] = []
    const { removed, failed } = pruneDistDirs({
      webDir,
      now: NOW,
      maxKeep: 1,
      isAlive: () => false,
      log: (l: string) => lines.push(l),
    })
    expect(removed.sort()).toEqual(['.next-r1', '.next-r2'])
    expect(failed).toEqual([])
    expect(fs.existsSync(path.join(webDir, '.next-r3'))).toBe(true)
    expect(fs.existsSync(path.join(webDir, '.next-r1'))).toBe(false)
    expect(lines).toHaveLength(1)
  })
})
