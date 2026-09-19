// scripts/security/secret-scan.mjs
//
// 추적 파일 전체 비밀값 패턴 검사 — 2026-09-19 검증 계정 비밀번호 평문 노출 대응(design/DECISIONS DD-48).
// 실행: node scripts/security/secret-scan.mjs              (추적 파일 · 찾으면 exit 1 · 값은 출력하지 않는다 — 종류 · 파일:줄만)
//       node scripts/security/secret-scan.mjs --untracked  (미추적까지 — 커밋 전 새 파일 검사)
// CI: apps/web/src/lib/__tests__/secret-scan.test.ts 가 같은 함수를 부른다(verify 잡 · turbo test).
//
// 규칙을 만든 사고: 옛 비밀번호가 문서 1곳 + 코드 56곳에 `process.env.X || '<값>'` 대체값으로 박혀 있었다.
// 처음 쓴 「password = '…'」 패턴은 그중 5곳만 잡았다 — 그래서 env 대체값 모양을 따로 잡는다.
// 자리표시자(<…> · […] · YOUR_… · *** · PASSWORD 같은 대문자 낱말)는 오탐이라 뺀다(예: 마이그레이션 주석의 psql 예시).

import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const BINARY = /\.(png|jpe?g|gif|webp|ico|svg|mp3|wav|ogg|glb|wasm|woff2?|ttf|otf|pdf|zip|mp4|webm)$/i
const PLACEHOLDER = /^(<[^>]*>|\[[^\]]*\]|\{[^}]*\}|\*+|x+|\.{3}|your[_-].*|.*placeholder.*|changeme|example.*|[A-Z_]{6,}|비밀번호.*)$/i

export const RULES = {
  'jwt': /eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}/,
  'openai key': /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}/,
  'anthropic key': /\bsk-ant-[A-Za-z0-9_-]{20,}/,
  'supabase token': /\bsbp_[a-f0-9]{30,}/,
  'aws key': /\bAKIA[0-9A-Z]{16}\b/,
  'github token': /\bgh[pousr]_[A-Za-z0-9]{30,}/,
  'private key': /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/,
  'google api key': /\bAIza[0-9A-Za-z_-]{35}\b/,
  // 값 위치를 캡처해 자리표시자를 거른다
  'db url with password': /postgres(?:ql)?:\/\/[^:\s'"`]+:([^@\s'"`]{4,})@/,
  'env fallback secret': /process\.env(?:\.[A-Z0-9_]*(?:PASS|SECRET|TOKEN|API_?KEY)[A-Z0-9_]*|\[['"][A-Z0-9_]*(?:PASS|SECRET|TOKEN|API_?KEY)[A-Z0-9_]*['"]\])\s*(?:\|\||\?\?)\s*['"`]([^'"`]{6,})['"`]/,
  'secret literal': /\b[A-Za-z_]*(?:password|passwd|pwd|secret|api_?key|token)[A-Za-z_]*\s*[:=]\s*['"`]([^'"`\s$]{8,})['"`]/i,
}

export function scanTracked(root = ROOT) {
  return scanFiles(execSync('git ls-files', { cwd: root, maxBuffer: 1e9 }).toString().split('\n'), root)
}

/** 미추적 파일까지 — 커밋 **전에** 새 파일을 검사할 때(`--untracked`). CI 는 scanTracked 만 쓴다. */
export function scanWorkingTree(root = ROOT) {
  return scanFiles(
    execSync('git ls-files -co --exclude-standard', { cwd: root, maxBuffer: 1e9 }).toString().split('\n'),
    root,
  )
}

export function scanFiles(list, root = ROOT) {
  const files = list.filter((f) => f && !BINARY.test(f))
  const hits = []
  for (const f of files) {
    let text
    try { text = readFileSync(join(root, f), 'utf8') } catch { continue }
    if (text.length > 5e6) continue
    text.split(/\r?\n/).forEach((line, i) => {
      for (const [kind, re] of Object.entries(RULES)) {
        const m = line.match(re)
        if (!m) continue
        const value = m[1]
        if (value !== undefined && PLACEHOLDER.test(value.trim())) continue
        if (value !== undefined && /^\$\{|^process\.env|^import\.meta/.test(value)) continue
        // 참조·경로·토큰 이름·예시는 값이 아니다: env(…)(supabase config) · var(--x)/--x(CSS 토큰) · ./ ../ /(경로) · … 가 든 예시
        if (value !== undefined && (/^(env\(|var\(|--|\.{1,2}\/|\/)/.test(value) || /\.\.\.|…/.test(value))) continue
        // 예시 호스트(`db.example.co`)라고 통과시키지 않는다 — `agents/scripts/lib.mjs` 의 가드와 기준을 하나로 둔다.
        // 검사기 자신의 테스트 픽스처는 값을 **런타임에 조립**해 소스에 리터럴을 남기지 않는다(check.test.mjs 의 기존 방식).
        hits.push({ kind, at: `${f}:${i + 1}` })
      }
    })
  }
  return { files: files.length, hits }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const untracked = process.argv.includes('--untracked')
  const { files, hits } = untracked ? scanWorkingTree() : scanTracked()
  console.log(`검사 파일 ${files} · 발견 ${hits.length}`)
  for (const h of hits) console.log(`  [${h.kind}] ${h.at}`)
  process.exit(hits.length ? 1 : 0)
}
