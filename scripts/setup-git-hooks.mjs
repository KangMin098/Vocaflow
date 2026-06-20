#!/usr/bin/env node
// scripts/setup-git-hooks.mjs
//
// `core.hooksPath = .githooks` 설정 + 실행 권한 부여.
// pnpm install 의 prepare lifecycle 에서 자동 실행 (idempotent).

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')
const HOOKS_DIR = path.join(REPO_ROOT, '.githooks')

function sh(cmd, opts = {}) {
  return execSync(cmd, { cwd: REPO_ROOT, encoding: 'utf-8', stdio: 'pipe', ...opts }).trim()
}

// 1. git 저장소인지 확인 (pnpm install 이 tarball 안에서 실행되는 경우 등 skip)
try {
  sh('git rev-parse --git-dir')
} catch {
  // not a git repo — skip silently
  process.exit(0)
}

// 2. .githooks 디렉터리 존재 검증
if (!fs.existsSync(HOOKS_DIR)) {
  console.warn('[setup-git-hooks] .githooks/ 없음 — skip')
  process.exit(0)
}

// 3. core.hooksPath 현재 값 확인 (이미 설정돼있으면 idempotent)
let current = ''
try {
  current = sh('git config --get core.hooksPath')
} catch {
  current = ''
}

if (current === '.githooks') {
  // 이미 설정됨
  process.exit(0)
}

// 4. 설정
try {
  sh('git config core.hooksPath .githooks')
  console.log('[setup-git-hooks] git config core.hooksPath = .githooks 설정 완료')
} catch (e) {
  console.warn('[setup-git-hooks] core.hooksPath 설정 실패:', e instanceof Error ? e.message : e)
  process.exit(0) // never block install
}

// 5. POSIX 환경에서 실행 권한 부여 (Windows 는 chmod 미지원 — try/catch)
try {
  for (const hook of fs.readdirSync(HOOKS_DIR)) {
    const p = path.join(HOOKS_DIR, hook)
    if (fs.statSync(p).isFile()) {
      try {
        fs.chmodSync(p, 0o755)
      } catch {
        // Windows — no-op
      }
    }
  }
} catch {
  // 폴더 access 실패 — 무시
}
