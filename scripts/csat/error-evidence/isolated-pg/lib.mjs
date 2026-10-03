// scripts/csat/error-evidence/isolated-pg/lib.mjs
// 격리 PostgreSQL 실행기 공통 — 클러스터 · 역할별 호출 · 결과 기록
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import pg from 'pg'

export const ROOT = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const REPO = path.resolve(ROOT, '../../../..')
export const MIGRATION = path.join(REPO, 'supabase/migrations/20261003230000_csat_error_evidence.sql')
export const ROLLBACK = path.join(REPO, 'scripts/csat/error-evidence/rollback.sql')
export const VERIFY = path.join(REPO, 'scripts/csat/error-evidence/verify-schema.sql')
const PORT = 54329

export async function startCluster() {
  // initdb 는 embedded-postgres 로, 기동은 pg_ctl 로(Windows 관리자 계정에서 postgres 직접 실행이 거부된다 — pg_ctl 은 제한 토큰으로 띄운다)
  const dir = path.join(ROOT, 'data')
  const bin = path.join(ROOT, 'node_modules/@embedded-postgres/windows-x64/native/bin/pg_ctl.exe')
  spawnSync(bin, ['-D', dir, '-m', 'immediate', 'stop'], { stdio: 'ignore', timeout: 30000 })
  fs.rmSync(dir, { recursive: true, force: true })
  const server = new EmbeddedPostgres({ databaseDir: dir, user: 'supabase_admin', password: 'admin', port: PORT, persistent: false, onLog: () => {}, onError: () => {} })
  await server.initialise()
  spawn(bin, ['-D', dir, '-o', `-p ${PORT}`, '-l', path.join(ROOT, 'server.log'), 'start'], { detached: true, stdio: 'ignore' }).unref()
  for (let i = 0; i < 60; i++) {
    try {
      const c = new pg.Client({ host: '127.0.0.1', port: PORT, database: 'postgres', user: 'supabase_admin', password: 'admin' })
      await c.connect(); await c.query('create database ec'); await c.end(); break
    } catch (e) { if (i === 59) throw e; await new Promise((r) => setTimeout(r, 1000)) }
  }
  return { stop: async () => { spawnSync(bin, ['-D', dir, '-m', 'fast', 'stop'], { stdio: 'ignore', timeout: 60000 }) } }
}

export const conn = (user, password) => new pg.Pool({ host: '127.0.0.1', port: PORT, database: 'ec', user, password, max: 12 })

export const results = []
export function record(area, name, pass, detail = '') {
  results.push({ area, name, pass: Boolean(pass), detail: typeof detail === 'string' ? detail : JSON.stringify(detail) })
  const mark = pass ? 'PASS' : 'FAIL'
  console.log(`[${mark}] ${area} · ${name}${detail ? ' — ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 220) : ''}`)
}

/**
 * 역할을 바꿔 한 트랜잭션으로 실행한다(PostgREST 와 같은 방식: authenticator 로 붙어 SET LOCAL ROLE + JWT sub).
 * actor = { role: 'authenticated' | 'anon' | 'service_role', uid?: string }
 */
export async function as(pool, actor, sql, params = []) {
  const c = await pool.connect()
  try {
    await c.query('begin')
    await c.query(`set local role ${actor.role}`)
    if (actor.uid) await c.query(`select set_config('request.jwt.claim.sub', $1, true)`, [actor.uid])
    const r = await c.query(sql, params)
    await c.query('commit')
    return { ok: true, rows: r.rows, count: r.rowCount }
  } catch (e) {
    await c.query('rollback').catch(() => {})
    return { ok: false, err: e.message, code: e.code }
  } finally {
    c.release()
  }
}

/** 열린 트랜잭션을 쥔 채로 쓰는 세션(동시성 테스트) */
export async function openTx(pool, actor) {
  const c = await pool.connect()
  await c.query('begin')
  await c.query(`set local role ${actor.role}`)
  if (actor.uid) await c.query(`select set_config('request.jwt.claim.sub', $1, true)`, [actor.uid])
  return {
    q: (sql, params = []) => c.query(sql, params),
    try: async (sql, params = []) => { try { const r = await c.query(sql, params); return { ok: true, rows: r.rows } } catch (e) { return { ok: false, err: e.message, code: e.code } } },
    commit: async () => { try { await c.query('commit') } finally { c.release() } },
    rollback: async () => { try { await c.query('rollback') } finally { c.release() } },
  }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
