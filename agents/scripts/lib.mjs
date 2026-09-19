// agents/scripts/lib.mjs
//
// 두 에이전트(Claude Code · Codex CLI) 공용 스크립트의 공통부 — 저장소 루트, 비밀값 패턴, 작은 git 헬퍼.
// 비밀값 패턴은 여기 한 곳에만 둔다: check.mjs(D3 · 설정 파일 검사)와 guard.mjs(커밋 전 검사)가 같은 목록을 쓴다.

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

export const rel = (...p) => path.join(ROOT, ...p)

export function readText(p) {
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null
}

/** CRLF/LF 가 섞인 저장소다 — 비교·치환 전에 항상 LF 로 맞춘다. */
export const lf = (s) => s.replace(/\r\n/g, '\n')

export function git(args, opts = {}) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts })
}

export function currentBranch() {
  try {
    return git(['rev-parse', '--abbrev-ref', 'HEAD']).trim()
  } catch {
    return '(git 없음)'
  }
}

/**
 * 비밀값 패턴. "값" 을 잡는 것이지 이름을 잡는 것이 아니다 — `SUPABASE_ACCESS_TOKEN` 이라는 변수 이름,
 * `${SUPABASE_ACCESS_TOKEN}` 참조, `env_vars = ["…"]` 는 통과해야 한다.
 */
export const SECRET_PATTERNS = [
  { name: 'Anthropic key', re: /sk-ant-[A-Za-z0-9_-]{20,}/ },
  { name: 'OpenAI key', re: /\bsk-(?!ant-)(?:proj-)?[A-Za-z0-9_-]{32,}/ },
  { name: 'Supabase access token', re: /\bsbp_[a-f0-9]{40}\b/ },
  { name: 'Supabase secret key', re: /\bsb_secret_[A-Za-z0-9_-]{20,}/ },
  { name: 'JWT', re: /\beyJhbGciOi[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/ },
  { name: 'AWS access key', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'GitHub token', re: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}\b|\bgithub_pat_[A-Za-z0-9_]{40,}/ },
  { name: 'Slack token', re: /\bxox[abprs]-[A-Za-z0-9-]{10,}/ },
  { name: 'Google API key', re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: 'DB URL with password', re: /\bpostgres(?:ql)?:\/\/[^:\s/'"]+:[^@\s'"$]{6,}@/ },
  { name: 'Private key', re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/ },
]

/** @returns {{name:string, line:number}[]} */
export function findSecrets(text) {
  const hits = []
  lf(text)
    .split('\n')
    .forEach((line, i) => {
      for (const { name, re } of SECRET_PATTERNS) if (re.test(line)) hits.push({ name, line: i + 1 })
    })
  return hits
}

/** `.env`, `.env.local`, `apps/web/.env.production` … — `.env.example` 류는 제외. */
export function isEnvFile(p) {
  const base = String(p).replace(/^["']|["']$/g, '').split(/[\\/]/).pop()
  if (!/^\.env(\.[\w.-]+)?$/.test(base)) return false
  return !/\.(example|sample|template|dist)$/.test(base)
}

/** `node <this file>` 로 직접 실행됐는가 (import 된 경우 false). Windows 드라이브 문자 대소문자 차이를 무시한다. */
export function isMain(metaUrl) {
  if (!process.argv[1]) return false
  const norm = (p) => path.resolve(p).toLowerCase()
  return norm(fileURLToPath(metaUrl)) === norm(process.argv[1])
}
