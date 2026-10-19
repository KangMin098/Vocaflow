// lib/devmode.mjs — 개발 모드(2026-10-19 사용자 지시 「GitHub 극소화 · 로컬 초고속 협업」)
//
//   LOCAL_FAST(기본) — 일반 개발에서 GitHub 를 부르지 않는다: PR · Actions 판독 · push · 원격 병합 0.
//     검증 기준 ref = 로컬 통합 브랜치(integration_branch). 필수 검증 증거 = 로컬 게이트(bin/local-integrate.mjs)가 남긴 파일.
//     원격은 백업(bin/backup.mjs · 하루 최대 1회 + 복구 시점)과 Work Bridge(vocaflow-exchange · 설계 요청)만 쓴다.
//   GITHUB — 예전 동작(origin/main · gh CI 판독 · 위임 branch_push).
//
// 설정: config/dev-mode.json(버전 관리) · 환경변수 VFC_DEV_MODE 가 우선(시험 · 일시 전환).
import fs from 'node:fs'
import path from 'node:path'

import { root } from './paths.mjs'

export const MODES = ['LOCAL_FAST', 'GITHUB']
const DEFAULTS = {
  mode: 'LOCAL_FAST',
  integration_branch: 'local/integration',
  integration_worktree: 'D:/workspace/Vocaflow-integration',
  backup: { remote: 'origin', ref_prefix: 'backup/local-integration', max_per_day: 1 },
}

export function devConfig({ env = process.env, file = path.join(root(), 'config', 'dev-mode.json') } = {}) {
  let cfg = {}
  try { cfg = JSON.parse(fs.readFileSync(file, 'utf8')) } catch { /* 없으면 기본 */ }
  const merged = { ...DEFAULTS, ...cfg, backup: { ...DEFAULTS.backup, ...(cfg.backup || {}) } }
  const mode = env.VFC_DEV_MODE || merged.mode
  if (!MODES.includes(mode)) throw new Error(`알 수 없는 개발 모드: ${mode} (허용: ${MODES.join(', ')})`)
  return { ...merged, mode }
}

export const isLocalFast = (cfg = devConfig()) => cfg.mode === 'LOCAL_FAST'

/** 검증 · 무효화 판정의 기준 ref — LOCAL_FAST 는 로컬 통합 브랜치, GITHUB 는 origin/main */
export function baseRef(cfg = devConfig()) {
  return isLocalFast(cfg) ? cfg.integration_branch : 'origin/main'
}

/** 로컬 필수 검증 증거 파일 위치(criterion · 커밋별) — local-integrate 가 쓰고 goal-check 가 읽는다 */
export function localEvidenceDir() {
  return path.join(root(), 'verification', 'local')
}

/**
 * 기준(criterion)의 가장 최근 로컬 실행 증거 — CI 판독과 같은 모양({found, conclusion, test_passed, test_skipped, log_read, head_sha, run_id, evidence_path})으로 돌려준다.
 * 그래서 goalcheck.ciAllowsPass 의 판정 규칙(skip=0 · 실행 > 0 · 커밋 일치)이 그대로 적용된다. 없으면 undefined(= UNKNOWN · 통과 아님)
 */
export function readLocalEvidence(criterionId, dir = localEvidenceDir()) {
  let files = []
  try { files = fs.readdirSync(dir).filter((f) => f.startsWith(`${criterionId}--`) && f.endsWith('.json')) } catch { return undefined }
  const rows = files.map((f) => { try { return { f, j: JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) } } catch { return null } }).filter(Boolean)
  rows.sort((a, b) => String(a.j.at || '').localeCompare(String(b.j.at || '')))
  const last = rows.at(-1)
  if (!last) return undefined
  return { ...last.j, evidence_path: ['verification', 'local', last.f].join('/') }
}

/** 실제로 있는 기준 ref — 통합 브랜치가 아직 없으면(첫 실행 · 새 저장소) 로컬의 origin/main 사본(fetch 없음) */
export function resolvedBaseRef(git, cfg = devConfig()) {
  const ref = baseRef(cfg)
  if (ref === 'origin/main') return ref
  try { git(ref); return ref } catch { return 'origin/main' }
}
