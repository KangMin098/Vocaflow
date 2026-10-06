// scripts/csat/error-evidence/isolated-pg/lib.mjs
// 격리 PostgreSQL 실행기 공통 — 클러스터 · 역할별 호출 · 결과 기록
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import pg from 'pg'
import net from 'node:net'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const ROOT = path.dirname(fileURLToPath(import.meta.url))
export const REPO = path.resolve(ROOT, '../../../..')
export const MIGRATION = path.join(REPO, 'supabase/migrations/20261003230000_csat_error_evidence.sql')
export const ROLLBACK = path.join(REPO, 'scripts/csat/error-evidence/rollback.sql')
export const VERIFY = path.join(REPO, 'scripts/csat/error-evidence/verify-schema.sql')
let PORT

export async function startCluster() {
  // initdb 는 embedded-postgres 로, 기동은 pg_ctl 로(Windows 관리자 계정에서 postgres 직접 실행이 거부된다 — pg_ctl 은 제한 토큰으로 띄운다)
  // Each run owns a new directory and port; never stops another session's server.
  const parent=path.join(REPO,'tmp','reveal-isolated-pg')
  fs.mkdirSync(parent,{recursive:true})
  const dir=fs.mkdtempSync(path.join(parent,'cluster-'))
  const owned=()=>{if(!fs.realpathSync(dir).startsWith(fs.realpathSync(parent)+path.sep))throw Error('Unsafe isolated cluster path')}
  owned()
  PORT=await new Promise((resolve,reject)=>{const socket=net.createServer();socket.once('error',reject);socket.listen(0,'127.0.0.1',()=>{const port=socket.address().port;socket.close(()=>resolve(port))})})
  const require=createRequire(import.meta.url)
  const embeddedRequire=createRequire(require.resolve('embedded-postgres'))
  const bin=process.platform==='win32'?(await import(pathToFileURL(embeddedRequire.resolve('@embedded-postgres/windows-x64')).href)).pg_ctl:null
  const server = new EmbeddedPostgres({ databaseDir: dir, user: 'supabase_admin', password: 'admin', port: PORT, persistent: true, onLog: () => {}, onError: () => {} })
  await server.initialise()
  if(bin) {
    const started=spawnSync(bin,['-D',dir,'-o',`-p ${PORT}`,'-l',path.join(dir,'server.log'),'-w','start'],{stdio:'ignore',timeout:60000,windowsHide:true})
    if(started.status!==0)throw Error('Isolated PostgreSQL start failed')
  } else await server.start()
  for (let i = 0; i < 60; i++) {
    try {
      const c = new pg.Client({ host: '127.0.0.1', port: PORT, database: 'postgres', user: 'supabase_admin', password: 'admin' })
      await c.connect(); await c.query('create database ec'); await c.end(); break
    } catch (e) { if (i === 59) throw e; await new Promise((r) => setTimeout(r, 1000)) }
  }
  return { stop: async () => { owned();if(bin){const stopped=spawnSync(bin,['-D',dir,'-m','fast','-w','stop'],{stdio:'ignore',timeout:60000,windowsHide:true});if(stopped.status!==0)throw Error('Isolated PostgreSQL stop failed')}else await server.stop();owned();fs.rmSync(dir,{recursive:true,force:true}) } }
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
