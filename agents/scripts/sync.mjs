#!/usr/bin/env node
// agents/scripts/sync.mjs
//
// MCP 단일 출처(agents/mcp.source.json) → 두 생성물.
//   · .mcp.json                                — Claude Code. 비밀은 "${VAR}" 참조로.
//   · .codex/config.toml 의 GENERATED 구역     — Codex CLI. 비밀은 env_vars = ["VAR"] 로 셸 환경 통과.
//     (Codex 는 config.toml 안의 ${VAR} 를 치환하지 않는다 — 그대로 쓰면 문자열 "${VAR}" 가 토큰으로 간다.)
//
//   node agents/scripts/sync.mjs           # 생성물 갱신
//   node agents/scripts/sync.mjs --check   # 드리프트만 검사 (다르면 exit 1, 파일은 안 고친다)
//
// 재실행 안전: 같은 출처면 같은 결과. config.toml 은 마커 사이만 바꾸고 나머지(권한·훅)는 건드리지 않는다.
// .mcp.json 은 JSON 이라 주석을 넣을 수 없다 — 대신 이 스크립트의 --check 가 CI 와 커밋 전 훅에서 손편집을 잡는다.

import fs from 'node:fs'
import { isMain, lf, readText, rel } from './lib.mjs'

export const TOML_START = '# >>> GENERATED mcp_servers — agents/scripts/sync.mjs 가 agents/mcp.source.json 에서 만든다. 직접 편집 금지.'
export const TOML_END = '# <<< GENERATED mcp_servers'

const SOURCE = rel('agents', 'mcp.source.json')
const MCP_JSON = rel('.mcp.json')
const CODEX_TOML = rel('.codex', 'config.toml')

const tomlStr = (s) => JSON.stringify(String(s)) // TOML basic string 은 JSON 문자열 이스케이프와 호환된다
const tomlArr = (a) => `[${a.map(tomlStr).join(', ')}]`
const tomlKey = (k) => (/^[A-Za-z0-9_-]+$/.test(k) ? k : tomlStr(k))

export function loadSource() {
  const src = JSON.parse(fs.readFileSync(SOURCE, 'utf8'))
  if (!src.servers || typeof src.servers !== 'object') throw new Error('mcp.source.json: servers 가 없다')
  for (const [name, s] of Object.entries(src.servers)) {
    if (!s.command) throw new Error(`mcp.source.json: ${name}.command 가 없다`)
    for (const v of Object.values(s.env ?? {}))
      if (/\$\{/.test(v)) throw new Error(`mcp.source.json: ${name}.env 에 \${…} 를 쓰지 말고 envFromShell 에 이름만 둔다`)
  }
  return src
}

export function renderMcpJson(src) {
  const mcpServers = {}
  for (const [name, s] of Object.entries(src.servers)) {
    const env = { ...(s.env ?? {}) }
    for (const v of s.envFromShell ?? []) env[v] = `\${${v}}`
    mcpServers[name] = {
      command: s.command,
      ...(s.args?.length ? { args: s.args } : {}),
      ...(Object.keys(env).length ? { env } : {}),
    }
  }
  return JSON.stringify({ mcpServers }, null, 2) + '\n'
}

export function renderTomlBlock(src) {
  const out = [TOML_START]
  for (const [name, s] of Object.entries(src.servers)) {
    out.push('', `[mcp_servers.${tomlKey(name)}]`, `command = ${tomlStr(s.command)}`)
    if (s.args?.length) out.push(`args = ${tomlArr(s.args)}`)
    if (s.envFromShell?.length) out.push(`env_vars = ${tomlArr(s.envFromShell)}`)
    const env = Object.entries(s.env ?? {})
    if (env.length) {
      out.push('', `[mcp_servers.${tomlKey(name)}.env]`)
      for (const [k, v] of env) out.push(`${tomlKey(k)} = ${tomlStr(v)}`)
    }
  }
  out.push('', TOML_END)
  return out.join('\n')
}

// 표 머리 `[a.b]` / `[[a.b]]` → 점으로 나눈 키 조각(따옴표 키 포함). 표 머리가 아니면 null.
const TABLE_HEADER = /^\[\[?\s*((?:[A-Za-z0-9_-]+|"(?:[^"\\]|\\.)*")(?:\s*\.\s*(?:[A-Za-z0-9_-]+|"(?:[^"\\]|\\.)*"))*)\s*\]\]?\s*(?:#.*)?$/
function tableKeys(line) {
  const m = TABLE_HEADER.exec(line)
  if (!m) return null
  return m[1].match(/[A-Za-z0-9_-]+|"(?:[^"\\]|\\.)*"/g).map((k) => (k.startsWith('"') ? JSON.parse(k) : k))
}

/**
 * GENERATED 구역을 block 으로 바꾼다.
 * Codex CLI 는 승인 설정(`[mcp_servers.<서버>.tools.<도구>]`)을 저장할 때 config.toml 을 다시 쓰며
 * 주석 — 곧 마커 — 를 지운다(2026-09-19 실측). 마커가 없으면 생성 대상 표(`mcp_servers.<서버>` ·
 * `.env`)를 표 머리로 찾아 바꾸고, Codex 가 저장한 `.tools.*` 는 출처에 있는 서버 것만 남긴다.
 * @param {string[]} [servers] 출처의 서버 이름 — 마커가 없을 때만 쓴다.
 */
export function spliceToml(toml, block, servers = []) {
  const t = lf(toml)
  const i = t.indexOf(TOML_START)
  const j = t.indexOf(TOML_END)
  if (i !== -1 && j !== -1 && j > i) return t.slice(0, i) + block + t.slice(j + TOML_END.length)
  if (i !== -1 || j !== -1) throw new Error('.codex/config.toml 의 GENERATED 마커가 한쪽만 있다 — 손으로 짝을 맞출 것')

  const keep = new Set(servers)
  const lines = t.split('\n')
  const out = []
  let dropping = false
  let insertAt = -1
  for (const line of lines) {
    const keys = tableKeys(line)
    if (keys) {
      const isMcp = keys[0] === 'mcp_servers' && keys.length >= 2
      const generated = isMcp && (keys.length === 2 || (keys.length === 3 && keys[2] === 'env'))
      dropping = isMcp && (generated || !keep.has(keys[1]))
      if (dropping && insertAt === -1) insertAt = out.length
    }
    if (!dropping) out.push(line)
  }
  // 지운 표 앞의 빈 줄이 겹치지 않게 정리하고 그 자리에 넣는다(없으면 끝에).
  if (insertAt === -1) {
    while (out.length && out[out.length - 1] === '') out.pop()
    return out.join('\n') + '\n\n' + block + '\n'
  }
  const head = out.slice(0, insertAt)
  const tail = out.slice(insertAt)
  while (head.length && head[head.length - 1] === '') head.pop()
  while (tail.length && tail[0] === '') tail.shift()
  return [...head, '', block, ...(tail.length ? ['', ...tail] : [''])].join('\n')
}

/** @returns {{file:string, ok:boolean, next:string}[]} */
export function plan() {
  const src = loadSource()
  const toml = readText(CODEX_TOML)
  if (toml === null) throw new Error('.codex/config.toml 이 없다')
  const items = [
    { file: '.mcp.json', path: MCP_JSON, cur: readText(MCP_JSON), next: renderMcpJson(src) },
    { file: '.codex/config.toml', path: CODEX_TOML, cur: toml, next: spliceToml(toml, renderTomlBlock(src), Object.keys(src.servers)) },
  ]
  return items.map((it) => ({ ...it, ok: it.cur !== null && lf(it.cur) === it.next }))
}

function main() {
  const check = process.argv.includes('--check')
  const items = plan()
  let bad = 0
  for (const it of items) {
    if (it.ok) {
      console.log(`  ok     ${it.file}`)
    } else if (check) {
      bad++
      console.error(`  DRIFT  ${it.file} — agents/mcp.source.json 과 다르다. \`node agents/scripts/sync.mjs\` 로 다시 만들 것(직접 편집 금지).`)
    } else {
      fs.writeFileSync(it.path, it.next)
      console.log(`  wrote  ${it.file}`)
    }
  }
  process.exit(bad ? 1 : 0)
}

if (isMain(import.meta.url)) main()
