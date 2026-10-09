// lib/lock.mjs
//
// 원자적 잠금. 파일이 「있다」는 사실만으로 안전하다고 보지 않는다.
//
// 획득  fs.openSync(path, 'wx') — NTFS 에서도 O_EXCL 생성은 원자적이라 동시 시도 중 정확히 하나만 성공한다.
//       잠금 파일에는 무작위 token(= 세대)과 소유자 메타데이터를 쓴다.
//
// 세대 마커 — 확인 후 교체(TOCTOU) 경쟁을 막는 규칙
//   잠금 파일을 **지우거나 바꾸는** 모든 동작(반납 · heartbeat · stale 회수 · 고아 정리)은 먼저
//   `<name>.gen-<token>.marker` 를 'wx' 로 만들어야 한다. 같은 세대(token)에 대해 마커는 하나만 존재할 수 있으므로,
//   마커를 쥔 프로세스가 잠금 파일의 token 이 여전히 그 세대인지 확인한 뒤 행동하는 사이에 다른 누구도
//   그 세대를 없앨 수 없고, 그 세대가 있는 한 경로가 점유돼 있어 새 세대도 생길 수 없다.
//   → 「A 가 확인한 뒤 B 가 회수·재획득하고 A 가 B 의 새 잠금을 지우는」 경쟁이 사라진다.
//   마커를 쥔 채 죽은 프로세스는 epoch 를 올려 넘어간다(아래 「세대 마커 (epoch)」) — 남의 마커를 지우는 경로가 없다.
//
// stale 판정  같은 호스트에서 pid 가 죽었고 **동시에** heartbeat 가 TTL 을 넘었을 때만 stale.
//       pid 가 살아 있으면 heartbeat 가 오래돼도 suspect 일 뿐이다. 다른 호스트는 3×TTL.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { p } from './paths.mjs'
import { appendLog, sleepMs } from './fsutil.mjs'

export const DEFAULT_TTL_MS = () => Number(process.env.VFC_LOCK_TTL_MS || 30 * 60 * 1000)
const MARKER_STALE_MS = 10_000

export function lockName(kind, key) {
  const safe = String(key).replace(/[^A-Za-z0-9._-]/g, '_')
  const short = safe.length > 60 ? safe.slice(0, 40) + '-' + crypto.createHash('sha1').update(String(key)).digest('hex').slice(0, 12) : safe
  return `${kind}--${short}`
}

function lockFile(name) {
  return path.join(p.locks(), `${name}.lock`)
}

export function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return e.code === 'EPERM'
  }
}

export function readLock(name) {
  const f = lockFile(name)
  let stat
  try {
    stat = fs.statSync(f)
  } catch {
    return null
  }
  let meta = null
  try {
    meta = JSON.parse(fs.readFileSync(f, 'utf8'))
  } catch {
    meta = null
  }
  return { name, file: f, meta, mtimeMs: stat.mtimeMs, gen: meta?.token ?? `nometa-${Math.floor(stat.mtimeMs)}` }
}

/** { state: 'live'|'suspect'|'stale'|'absent', reason } */
export function judge(lock, now = Date.now()) {
  if (!lock) return { state: 'absent', reason: 'no lock' }
  const ttl = lock.meta?.ttl_ms ?? DEFAULT_TTL_MS()
  if (!lock.meta || !lock.meta.token) {
    return now - lock.mtimeMs > ttl ? { state: 'stale', reason: 'metadata missing and file older than ttl' } : { state: 'suspect', reason: 'metadata missing (writer may still be initializing)' }
  }
  const age = now - Date.parse(lock.meta.heartbeat_at || lock.meta.acquired_at)
  if (lock.meta.host === os.hostname()) {
    const alive = pidAlive(lock.meta.pid)
    if (alive) return age > ttl ? { state: 'suspect', reason: `pid ${lock.meta.pid} alive but heartbeat ${Math.round(age / 1000)}s old` } : { state: 'live', reason: `pid ${lock.meta.pid} alive` }
    return age > ttl ? { state: 'stale', reason: `pid ${lock.meta.pid} dead and heartbeat older than ttl` } : { state: 'suspect', reason: `pid ${lock.meta.pid} dead but heartbeat still fresh — recoverable after ttl` }
  }
  return age > ttl * 3 ? { state: 'stale', reason: 'foreign host and heartbeat older than 3x ttl' } : { state: 'live', reason: 'foreign host lock — cannot inspect pid' }
}

// ── 세대 마커 (epoch) ─────────────────────────────────────────────────────
//
// 마커는 `<name>.gen-<token>.e<k>.marker` 이다. 같은 세대에 대해 마커를 **지우지 않고 epoch 를 올린다**:
//   가장 높은 epoch k 의 마커가 없으면(또는 그 holder 가 죽고 10초가 지났으면) e<k+1> 을 'wx' 로 만든다.
//   'wx' 생성은 원자적이므로 같은 epoch 를 둘이 가질 수 없고, 살아 있는 최고 epoch 가 있으면 누구도 더 위를 만들지 않는다.
// → 2026-10-09 전체 테스트에서 재현된 경쟁(두 프로세스가 같은 죽은 마커를 「치우는」 사이 한쪽이 새 살아 있는 마커까지
//   치워 소유자가 둘이 된 것)이 구조적으로 사라진다 — 이제 아무도 남의 마커를 옮기거나 지우지 않는다.
//   자기 마커만 지우고, 죽은 하위 epoch 는 그 세대가 끝난 뒤(잠금 파일이 다른 세대이거나 없을 때)에만 청소한다.

function genKey(gen) {
  return String(gen).replace(/[^A-Za-z0-9-]/g, '_')
}

function markerPath(name, gen, k) {
  return path.join(p.locks(), `${name}.gen-${genKey(gen)}.e${k}.marker`)
}

function epochs(name, gen) {
  const prefix = `${name}.gen-${genKey(gen)}.e`
  let files = []
  try {
    files = fs.readdirSync(p.locks())
  } catch {
    return []
  }
  return files
    .filter((f) => f.startsWith(prefix) && f.endsWith('.marker'))
    .map((f) => Number(f.slice(prefix.length, -'.marker'.length)))
    .filter(Number.isInteger)
    .sort((x, y) => x - y)
}

/**
 * 최고 epoch 마커를 넘어가도 되는가: 쥔 쪽이 끝냈거나(done 표시) 죽었으면(pid 사망 + 10초).
 * 끝난 마커는 **지우지 않고 done 으로 표시**한다 — 지우면 epoch 번호가 다시 비어, 오래된 목록을 본 프로세스가
 * 같은 번호(e0 등)를 다시 만들어 같은 세대에 둘이 들어갈 수 있었다(Codex 최종 리뷰 P1 · 2026-10-09).
 * 마커 파일이 없다 = 세대가 끝나 청소됐다 → 넘어가도 되고, 그 뒤 동작은 세대 불일치로 아무것도 하지 않는다.
 */
function markerFree(file) {
  let st
  let m = {}
  try {
    st = fs.statSync(file)
  } catch {
    return true
  }
  try {
    m = JSON.parse(fs.readFileSync(file, 'utf8') || '{}')
  } catch {
    m = {}
  }
  if (m.done === true) return true
  if (Date.now() - st.mtimeMs < MARKER_STALE_MS) return false
  return !(m.host === os.hostname() && pidAlive(m.pid))
}

/** 세대 gen 의 epoch 마커를 쥐고 fn 실행. 다른 프로세스가 같은 세대를 다루는 중이면 { busy:true }. */
function withGen(name, gen, fn) {
  fs.mkdirSync(p.locks(), { recursive: true })
  const ks = epochs(name, gen)
  const top = ks.length ? ks[ks.length - 1] : -1
  if (top >= 0 && !markerFree(markerPath(name, gen, top))) return { busy: true }
  const mine = markerPath(name, gen, top + 1)
  let fd
  try {
    fd = fs.openSync(mine, 'wx')
  } catch (e) {
    if (e.code === 'EEXIST') return { busy: true } // 같은 epoch 를 다른 프로세스가 먼저 가졌다
    throw e
  }
  try {
    fs.writeSync(fd, JSON.stringify({ pid: process.pid, host: os.hostname(), at: new Date().toISOString(), epoch: top + 1 }))
  } finally {
    fs.closeSync(fd)
  }
  if (top >= 0) appendLog(p.eventLog(), { at: new Date().toISOString(), event: 'lock.marker_epoch_advanced', lock: name, from_epoch: top, to_epoch: top + 1 })
  try {
    return fn()
  } finally {
    // 내 마커는 지우지 않고 done 으로 표시한다 — epoch 번호가 재사용되지 않게(같은 번호는 다시 'wx' 로 만들 수 없다)
    fs.writeFileSync(mine, JSON.stringify({ pid: process.pid, host: os.hostname(), at: new Date().toISOString(), epoch: top + 1, done: true }))
    // 세대가 끝났으면(잠금 파일이 다른 세대이거나 없음) 그 세대의 마커를 모두 청소한다 — 세대(token)는 다시 쓰이지 않는다
    const holder = readLock(name)
    if (!holder || holder.gen !== gen) for (const k of epochs(name, gen)) fs.rmSync(markerPath(name, gen, k), { force: true })
  }
}

function moveToRecovered(file, name, tag) {
  fs.mkdirSync(p.recoveredLocks(), { recursive: true })
  const dest = path.join(p.recoveredLocks(), `${name}.${Date.now()}.${process.pid}.${tag}.json`)
  fs.renameSync(file, dest)
  return dest
}

/** 세대 gen 이 아직 그 자리에 있을 때만 action(holder) 실행 — 마커가 그 사이 교체를 막는다. */
function onGeneration(name, gen, action) {
  const r = withGen(name, gen, () => {
    const holder = readLock(name)
    if (!holder || holder.gen !== gen) return { ok: false, reason: 'generation changed — 다른 세대의 잠금이다(건드리지 않음)' }
    return action(holder)
  })
  return r.busy ? { ok: false, busy: true, reason: '다른 프로세스가 같은 세대를 처리 중' } : r
}

// ── 공개 API ─────────────────────────────────────────────────────────────

/**
 * 잠금 획득. 성공: { ok:true, token, meta }. 실패: { ok:false, holder, judgement }.
 * opts: { owner_id, session, purpose, ttl_ms, pid, recoverStale=true }
 */
export function acquire(name, opts = {}) {
  fs.mkdirSync(p.locks(), { recursive: true })
  const f = lockFile(name)
  const meta = {
    name,
    token: crypto.randomBytes(16).toString('hex'),
    owner_id: opts.owner_id ?? null,
    session: opts.session ?? null,
    purpose: opts.purpose ?? null,
    pid: opts.pid ?? process.pid,
    host: os.hostname(),
    acquired_at: new Date().toISOString(),
    heartbeat_at: new Date().toISOString(),
    ttl_ms: opts.ttl_ms ?? DEFAULT_TTL_MS(),
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    let fd
    try {
      fd = fs.openSync(f, 'wx')
    } catch (e) {
      if (e.code !== 'EEXIST') throw e
      const holder = readLock(name)
      if (!holder) continue // 그 사이 반납됐다
      const j = judge(holder)
      if (j.state === 'stale' && opts.recoverStale !== false) {
        const r = onGeneration(name, holder.gen, (h) => {
          const again = judge(h)
          if (again.state !== 'stale') return { ok: false, reason: again.reason }
          const dest = moveToRecovered(h.file, name, 'stale')
          appendLog(p.eventLog(), { at: new Date().toISOString(), event: 'lock.recover_stale', name, reason: again.reason, previous: h.meta, moved_to: dest, by_owner: meta.owner_id, by_pid: meta.pid })
          return { ok: true }
        })
        if (r.ok || r.busy) {
          if (r.busy) sleepMs(20)
          continue
        }
      }
      return { ok: false, holder: holder.meta, judgement: j }
    }
    try {
      fs.writeSync(fd, JSON.stringify(meta, null, 2))
      fs.fsyncSync(fd)
    } finally {
      fs.closeSync(fd)
    }
    appendLog(p.eventLog(), { at: meta.acquired_at, event: 'lock.acquire', name, owner_id: meta.owner_id, session: meta.session, pid: meta.pid })
    return { ok: true, token: meta.token, meta }
  }
  const holder = readLock(name)
  return { ok: false, holder: holder?.meta ?? null, judgement: holder ? judge(holder) : { state: 'absent', reason: 'contention' } }
}

/** token(세대)이 맞을 때만 반납. 남의 잠금은 건드리지 않는다. */
export function release(name, token) {
  const r = onGeneration(name, token, (h) => {
    fs.rmSync(h.file, { force: true })
    appendLog(p.eventLog(), { at: new Date().toISOString(), event: 'lock.release', name, owner_id: h.meta?.owner_id, session: h.meta?.session })
    return { ok: true }
  })
  if (!r.ok && !readLock(name)) return { ok: false, reason: 'not held' }
  return r
}

/** 소유자가 살아 있음을 알린다(token 일치 시에만). 임시 파일 + rename, Windows 일시 오류는 재시도. */
export function heartbeat(name, token) {
  return onGeneration(name, token, (h) => {
    const meta = { ...h.meta, heartbeat_at: new Date().toISOString() }
    const tmp = `${h.file}.${process.pid}.hb.tmp`
    fs.writeFileSync(tmp, JSON.stringify(meta, null, 2))
    for (let i = 0; ; i++) {
      try {
        fs.renameSync(tmp, h.file)
        return { ok: true }
      } catch (e) {
        if (!['EPERM', 'EBUSY', 'EACCES'].includes(e.code) || i > 30) {
          fs.rmSync(tmp, { force: true })
          return { ok: false, reason: `heartbeat rename 실패: ${e.code}` }
        }
        sleepMs(20 + i * 10)
      }
    }
  })
}

/** 명시적 복구 — stale 판정일 때만. live/suspect 는 거부. */
export function recover(name) {
  const holder = readLock(name)
  if (!holder) return { ok: false, reason: 'no lock' }
  const j = judge(holder)
  if (j.state !== 'stale') return { ok: false, reason: `not stale (${j.state}: ${j.reason}) — 다른 세션이 쓰는 잠금은 해제하지 않는다`, holder: holder.meta }
  return onGeneration(name, holder.gen, (h) => {
    const again = judge(h)
    if (again.state !== 'stale') return { ok: false, reason: again.reason }
    const dest = moveToRecovered(h.file, name, 'stale')
    appendLog(p.eventLog(), { at: new Date().toISOString(), event: 'lock.recover_stale', name, reason: again.reason, previous: h.meta, moved_to: dest, by_owner: 'recover-cli', by_pid: process.pid })
    return { ok: true, reason: again.reason }
  })
}

/**
 * 고아 정리 — 상태 뮤텍스 안에서만 호출한다(작업 잠금 획득과 상태 기록이 모두 뮤텍스 안이므로,
 * 그 안에서 「어떤 IN_PROGRESS 작업의 run 에도 없는 token」은 커밋되지 못한 시작이 남긴 잠금이다).
 */
export function removeOrphan(name, token, reason) {
  return onGeneration(name, token, (h) => {
    const dest = moveToRecovered(h.file, name, 'orphan')
    appendLog(p.eventLog(), { at: new Date().toISOString(), event: 'lock.remove_orphan', name, reason, previous: h.meta, moved_to: dest })
    return { ok: true }
  })
}

export function listLocks() {
  if (!fs.existsSync(p.locks())) return []
  return fs
    .readdirSync(p.locks())
    .filter((f) => f.endsWith('.lock'))
    .map((f) => {
      const l = readLock(f.slice(0, -5))
      return l && { name: l.name, meta: l.meta, judgement: judge(l) }
    })
    .filter(Boolean)
}

/** 짧게 쥐는 뮤텍스(상태 파일 read-modify-write 용). 쥔 프로세스는 이 CLI 자신이라 pid 가 살아 있는 동안 회수되지 않는다. */
export function withMutex(name, fn, { timeoutMs = 20000, ttl_ms = 5000 } = {}) {
  const start = Date.now()
  let got
  for (;;) {
    got = acquire(name, { owner_id: 'state-mutex', purpose: 'state read-modify-write', ttl_ms, pid: process.pid })
    if (got.ok) break
    if (Date.now() - start > timeoutMs) throw new Error(`mutex ${name} 획득 실패: ${got.judgement?.reason}`)
    sleepMs(10 + Math.floor(Math.random() * 30))
  }
  try {
    return fn()
  } finally {
    release(name, got.token)
  }
}
