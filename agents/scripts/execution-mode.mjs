// agents/scripts/execution-mode.mjs
// 중앙 개발 모드의 읽기 어댑터. 설정 사본을 만들거나 원격에 조회하지 않는다.
import fs from 'node:fs'
import path from 'node:path'
import { ROOT } from './lib.mjs'

export function executionMode({ env = process.env, read = (file) => fs.readFileSync(file, 'utf8') } = {}) {
  const file = path.join(env.VFC_ROOT || path.resolve(ROOT, '..', 'Vocaflow-AI-Control'), 'config', 'dev-mode.json')
  let mode = env.VFC_DEV_MODE || undefined
  if (!mode) {
    try { mode = JSON.parse(read(file)).mode }
    catch (e) { if (e.code !== 'ENOENT') throw new Error(`개발 모드 설정 오류: ${file}: ${e.message}`) }
  }
  if (mode === undefined) mode = 'LOCAL_FAST'
  if (!['LOCAL_FAST', 'GITHUB'].includes(mode)) throw new Error(`알 수 없는 개발 모드: ${mode}`)
  return mode
}

export function executionNotice(mode) {
  return mode === 'LOCAL_FAST'
    ? '[개발 모드 LOCAL_FAST] 일반 작업은 로컬 검증·커밋·독립 리뷰·로컬 통합으로 진행합니다. 추가 push·PR·Actions 조회/대기·원격 병합은 하지 않습니다. 로컬 통합: AI-Control/bin/local-integrate.mjs. 원격은 중앙 backup.mjs의 하루 상한·복구 시점 및 Work Bridge만 사용합니다. 미실행 검증은 통과로 처리하지 않습니다.'
    : '[개발 모드 GITHUB] 명시적으로 선택된 원격 절차입니다. 기존 PR/CI·safe-merge 보호 조건을 유지합니다.'
}
