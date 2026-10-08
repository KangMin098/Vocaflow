// lib/fsutil.mjs
//
// 상태 파일을 깨뜨리지 않고 쓰는 도구.
//   - atomicWriteJson: 임시 파일에 쓰고 fsync → 기존 본을 .bak 으로 복사 → rename 으로 교체.
//     rename 은 같은 볼륨(NTFS)에서 원자적이라, 쓰는 도중 프로세스가 죽어도 본 파일은 옛 판 그대로다.
//   - readJsonSafe: 본 파일이 깨졌으면 .bak 으로 복구한 값과 그 사실을 함께 돌려준다(조용히 삼키지 않는다).
// 테스트용 고장 주입: 환경 변수 VFC_CRASH_AT=after_tmp 이면 임시 파일만 쓰고 프로세스를 즉시 죽인다.

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const RETRY_CODES = new Set(['EPERM', 'EBUSY', 'EACCES'])

export function sleepMs(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

/** Windows 에서 다른 프로세스가 잠깐 파일을 열고 있으면 rename 이 EPERM 을 낸다 — 짧게 재시도한다. */
function retry(fn, label) {
  let last
  for (let i = 0; i < 40; i++) {
    try {
      return fn()
    } catch (e) {
      if (!RETRY_CODES.has(e.code)) throw e
      last = e
      sleepMs(25 + i * 10)
    }
  }
  throw new Error(`${label}: 재시도 한도 초과 (${last?.code})`)
}

export function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}

export function atomicWriteJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const body = JSON.stringify(value, null, 2) + '\n'
  JSON.parse(body) // 직렬화가 왕복되지 않는 값은 쓰기 전에 거부
  const tmp = `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`
  const fd = fs.openSync(tmp, 'wx')
  try {
    fs.writeSync(fd, body)
    fs.fsyncSync(fd)
  } finally {
    fs.closeSync(fd)
  }
  if (process.env.VFC_CRASH_AT === 'after_tmp') process.exit(86)
  // .bak 은 「마지막으로 파싱되는 본」만 유지한다. 본 파일이 깨져 있으면 .bak 을 덮지 않고 깨진 본을 격리한다.
  if (fs.existsSync(file)) {
    let parses = true
    try {
      JSON.parse(fs.readFileSync(file, 'utf8'))
    } catch {
      parses = false
    }
    if (parses) retry(() => fs.copyFileSync(file, `${file}.bak`), 'backup')
    else retry(() => fs.copyFileSync(file, `${file}.corrupt-${Date.now()}`), 'quarantine')
  }
  retry(() => fs.renameSync(tmp, file), 'rename')
}

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

/** { value, recovered, error } — 본 파일 파싱 실패 시 .bak 로 복구하고 recovered=true. 둘 다 없으면 fallback. */
export function readJsonSafe(file, fallback) {
  if (!fs.existsSync(file)) return { value: fallback, recovered: false, error: null }
  try {
    return { value: readJson(file), recovered: false, error: null }
  } catch (e) {
    const bak = `${file}.bak`
    if (fs.existsSync(bak)) {
      return { value: readJson(bak), recovered: true, error: e.message }
    }
    throw new Error(`${file} 이 깨졌고 .bak 도 없다: ${e.message}`)
  }
}

/** 고장 주입 테스트가 남긴 임시 파일 정리(본 파일은 건드리지 않는다). */
export function cleanupTmp(dir) {
  if (!fs.existsSync(dir)) return 0
  let n = 0
  for (const f of fs.readdirSync(dir)) {
    if (f.endsWith('.tmp')) {
      fs.rmSync(path.join(dir, f), { force: true })
      n++
    }
  }
  return n
}

export function appendLog(file, record) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.appendFileSync(file, JSON.stringify(record) + '\n')
}
