// agents/scripts/__tests__/execution-mode.test.mjs
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { executionMode, executionNotice } from '../execution-mode.mjs'

test('중앙 설정을 읽고 명시적 환경 모드가 우선한다', () => {
  let requested
  const read = file => { requested = file; return '{"mode":"LOCAL_FAST"}' }
  assert.equal(executionMode({ env: { VFC_ROOT: '/control' }, read }), 'LOCAL_FAST')
  assert.equal(requested, path.join('/control', 'config', 'dev-mode.json'))
  assert.equal(executionMode({ env: { VFC_DEV_MODE: 'GITHUB' }, read: () => { throw Error('must not read') } }), 'GITHUB')
  assert.equal(executionMode({ env: {}, read: () => '{"mode":"GITHUB"}' }), 'GITHUB')
})

test('설정 부재는 LOCAL_FAST이고 깨진 설정·알 수 없는 모드는 원격으로 전환하지 않는다', () => {
  const missing = () => { throw Object.assign(Error('missing'), { code:'ENOENT' }) }
  assert.equal(executionMode({ env:{}, read:missing }), 'LOCAL_FAST')
  assert.throws(() => executionMode({ env:{}, read:()=>'{' }), /개발 모드 설정 오류/)
  assert.throws(() => executionMode({ env:{}, read:()=>'{"mode":"typo"}' }), /알 수 없는 개발 모드/)
  assert.throws(() => executionMode({ env:{}, read:()=>'{"mode":null}' }), /알 수 없는 개발 모드/)
  assert.throws(() => executionMode({ env:{VFC_DEV_MODE:'typo'}, read:missing }), /알 수 없는 개발 모드/)
  assert.match(executionNotice('LOCAL_FAST'), /추가 push·PR·Actions 조회\/대기·원격 병합은 하지 않습니다/)
  assert.match(executionNotice('GITHUB'), /기존 PR\/CI·safe-merge 보호 조건을 유지/)
})

test('LOCAL_FAST safe-merge는 git/gh가 없는 환경에서도 dry-run·wait 전에 멈춘다', () => {
  const script = fileURLToPath(new URL('../safe-merge.mjs', import.meta.url))
  for (const flag of ['--dry-run', '--wait']) {
    const result = spawnSync(process.execPath, [script, '317', flag], {
      encoding:'utf8', timeout:5000,
      env:{...process.env, VFC_DEV_MODE:'LOCAL_FAST', PATH:'', Path:''},
    })
    assert.equal(result.status, 3, result.stderr)
    assert.match(result.stdout, /LOCAL_FAST.*원격 호출 없이 종료/s)
    assert.doesNotMatch(result.stdout + result.stderr, /정책을 읽지 못했다|PR #317 를 읽지 못했다/)
  }
})

test('세션 시작에 중앙 LOCAL_FAST를 알리고 오래된 원격 정책 동기화로 유도하지 않는다', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vfc-mode-'))
  try {
    fs.mkdirSync(path.join(root, 'config'))
    fs.writeFileSync(path.join(root, 'config', 'dev-mode.json'), '{"mode":"LOCAL_FAST"}')
    const script = fileURLToPath(new URL('../handoff-inject.mjs', import.meta.url))
    const result = spawnSync(process.execPath, [script, '--agent', 'codex'], {
      encoding:'utf8', timeout:5000, env:{...process.env, VFC_ROOT:root, VFC_DEV_MODE:''},
    })
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /개발 모드 LOCAL_FAST/)
    assert.doesNotMatch(result.stdout, /\[정책 낡음\]/)
  } finally {
    assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep))
    fs.rmSync(root, {recursive:true, force:true})
  }
})
