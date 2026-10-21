// apps/web/scripts/dist-dir-retention.mjs
//
// ══════════════════════════════════════════════════════════════════
// 격리 distDir 보존 한도 — 검증 빌드가 남긴 `.next-*` 사본을 빌드 시점에 정리한다
// ══════════════════════════════════════════════════════════════════
// `NEXT_DIST_DIR` 격리는 dev 서버를 지키지만 **사본을 아무도 안 지운다.** 세션·회차마다
// 새 이름(`.next-admin-usability-r12` … `-r22`, `-final`)으로 빌드해 사본 하나가 1.7 GB 씩 쌓였다.
//   · 2026-08-31  apps/web 하나에 17개 3.8 GB
//   · 2026-10-21  워크트리 하나에 15개 25.8 GB → D: 100 GB 디스크가 98% (전체 사본 32.6 GB)
// 문서 규약(「끝나면 지운다」)은 세 번 다 지켜지지 않았다. 그래서 규약이 아니라 빌드가 지운다.
//
// 규칙 (next.config.mjs 가 `next build` 시작 때 부른다):
//   ① 살아 있는 서버(dev·start)의 소유권 표식이 있는 사본은 **절대** 지우지 않는다.
//   ② 최근 `minAgeMs` 안에 쓰인 사본은 지우지 않는다 — 다른 세션이 막 빌드하는 중일 수 있다.
//   ③ 그 밖의 격리 사본은 최신 `maxKeep` 개만 남긴다.
//   ④ 기본 이름 `.next` · `.next-dev` 와 이번 빌드 대상은 후보가 아니다(제자리에 덮어쓰므로 쌓이지 않는다).
import fs from 'node:fs'
import path from 'node:path'

export const OWNER_FILE = '.dev-server-owner.json'
/** 표식을 stale 로 볼 시간. 서버가 60초마다 다시 쓰므로 그 3배. */
export const OWNER_STALE_MS = 3 * 60_000
export const DEFAULT_MAX_KEEP = 2
export const DEFAULT_MIN_AGE_MS = 2 * 60 * 60_000
/** 쌓이지 않는 기본 이름 — 정리 후보가 아니다. */
const PERMANENT = new Set(['.next', '.next-dev'])
const DIST_NAME = /^\.next-.+$/

/** @param {number} pid */
export function isPidAlive(pid) {
  try {
    process.kill(pid, 0) // 살아 있는지만 본다 — 시그널을 보내지 않는다
    return true
  } catch {
    return false
  }
}

/**
 * 사본을 살아 있는 서버가 쓰고 있는가.
 * @param {string} dir
 * @param {number} now
 * @param {(pid: number) => boolean} isAlive
 */
export function isOwnedByLiveServer(dir, now, isAlive) {
  const file = path.join(dir, OWNER_FILE)
  let owner
  let touchedAt
  try {
    owner = JSON.parse(fs.readFileSync(file, 'utf8'))
    touchedAt = fs.statSync(file).mtimeMs
  } catch {
    return false
  }
  if (!owner?.pid) return false
  if (now - touchedAt > OWNER_STALE_MS) return false // heartbeat 끊긴 유령 표식
  return isAlive(owner.pid)
}

/**
 * 사본이 마지막으로 쓰인 시각. 디렉터리 자체와 바로 아래 항목 중 가장 늦은 것.
 * 빌드 중이면 `cache`·`server`·`static` 이 계속 갱신된다.
 * 소유권 표식은 빼고 본다 — 서버 heartbeat 이 남긴 시각이라, 서버가 죽은 뒤에도 사본을
 * 「방금 쓰인 것」으로 보이게 한다. 서버 생존은 `isOwnedByLiveServer` 가 따로 판정한다.
 * @param {string} dir
 */
export function lastWrittenAt(dir) {
  let latest = fs.statSync(dir).mtimeMs
  for (const name of fs.readdirSync(dir)) {
    if (name === OWNER_FILE) continue
    try {
      latest = Math.max(latest, fs.statSync(path.join(dir, name)).mtimeMs)
    } catch {
      /* 그 사이 사라졌다 — 무시 */
    }
  }
  return latest
}

/**
 * 지울 사본을 고른다(지우지는 않는다).
 * @param {{
 *   webDir: string,
 *   target?: string,
 *   now: number,
 *   maxKeep?: number,
 *   minAgeMs?: number,
 *   isAlive?: (pid: number) => boolean,
 * }} opts
 * @returns {{ remove: { name: string, writtenAt: number }[], kept: { name: string, reason: 'live-server' | 'recent' | 'newest' }[] }}
 */
export function planDistDirPrune(opts) {
  const { webDir, target, now } = opts
  const maxKeep = opts.maxKeep ?? DEFAULT_MAX_KEEP
  const minAgeMs = opts.minAgeMs ?? DEFAULT_MIN_AGE_MS
  const isAlive = opts.isAlive ?? isPidAlive

  /** @type {{ name: string, writtenAt: number }[]} */
  const candidates = []
  /** @type {{ name: string, reason: 'live-server' | 'recent' | 'newest' }[]} */
  const kept = []
  for (const entry of fs.readdirSync(webDir, { withFileTypes: true })) {
    const name = entry.name
    if (!entry.isDirectory() || !DIST_NAME.test(name)) continue
    if (PERMANENT.has(name) || name === target) continue
    const dir = path.join(webDir, name)
    if (isOwnedByLiveServer(dir, now, isAlive)) {
      kept.push({ name, reason: 'live-server' })
      continue
    }
    const writtenAt = lastWrittenAt(dir)
    if (now - writtenAt < minAgeMs) {
      kept.push({ name, reason: 'recent' })
      continue
    }
    candidates.push({ name, writtenAt })
  }
  candidates.sort((a, b) => b.writtenAt - a.writtenAt)
  for (const c of candidates.slice(0, maxKeep)) kept.push({ name: c.name, reason: 'newest' })
  return { remove: candidates.slice(maxKeep), kept }
}

/**
 * 고른 사본을 지운다. 하나가 실패해도 나머지는 계속한다(빌드를 막지 않는다).
 * @param {Parameters<typeof planDistDirPrune>[0] & { log?: (line: string) => void }} opts
 * @returns {{ removed: string[], failed: string[] }}
 */
export function pruneDistDirs(opts) {
  const log = opts.log ?? (() => {})
  const { remove } = planDistDirPrune(opts)
  /** @type {string[]} */
  const removed = []
  /** @type {string[]} */
  const failed = []
  for (const { name } of remove) {
    try {
      fs.rmSync(path.join(opts.webDir, name), { recursive: true, force: true, maxRetries: 2 })
      removed.push(name)
    } catch {
      failed.push(name)
    }
  }
  if (removed.length) log(`[distDir 보존 한도] 오래된 격리 빌드 ${removed.length}개 삭제: ${removed.join(', ')}`)
  if (failed.length) log(`[distDir 보존 한도] 삭제 실패(다음 빌드 때 다시 시도): ${failed.join(', ')}`)
  return { removed, failed }
}
