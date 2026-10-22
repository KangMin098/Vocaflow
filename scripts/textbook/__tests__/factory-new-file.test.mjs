// scripts/textbook/__tests__/factory-new-file.test.mjs
// writeNewFile · newFileSet — 임시 디렉터리 + 장애 주입 fs. 실제 산출물 · 서버 · DB 에 닿지 않는다.
import assert from 'node:assert/strict'
import * as fs from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { NewFileError, newFileSet, run, writeNewFile } from '../factory-order-draft.mjs'

const SECRET = 'sb-synthetic-auth-token=SECRET-BODY-MARKER'

function tmp() {
  return fs.mkdtempSync(join(tmpdir(), 'vf-newfile-'))
}
const errno = (code) => Object.assign(new Error(`synthetic ${code}`), { code })

/** 실제 fs 위에 장애를 얹는다. partialThenFail: 첫 writeSync 에 일부 바이트를 쓴 뒤 던진다. */
function faultyFs({ partialThenFail = false, closeFail = false, unlinkFail = false } = {}) {
  return {
    ...fs,
    openSync: fs.openSync,
    writeSync(fd, buf, off, len) {
      if (partialThenFail) {
        fs.writeSync(fd, buf, off, Math.min(3, len))
        throw errno('ENOSPC')
      }
      return fs.writeSync(fd, buf, off, len)
    },
    closeSync(fd) {
      fs.closeSync(fd)
      if (closeFail) throw errno('EIO')
    },
    unlinkSync(p) {
      if (unlinkFail) throw errno('EPERM')
      return fs.unlinkSync(p)
    },
  }
}

test('성공 — 새 파일에 전체 바이트를 쓴다(문자열 · Uint8Array)', () => {
  const d = tmp()
  writeNewFile(join(d, 'a.json'), '{"한":1}\n')
  writeNewFile(join(d, 'b.bin'), new TextEncoder().encode('xyz').subarray(1))
  assert.equal(fs.readFileSync(join(d, 'a.json'), 'utf8'), '{"한":1}\n')
  assert.equal(fs.readFileSync(join(d, 'b.bin'), 'utf8'), 'yz')
})

test('기존 파일 충돌 — 거절하고 기존 파일은 그대로 둔다', () => {
  const d = tmp()
  const p = join(d, 'exists.json')
  fs.writeFileSync(p, 'ORIGINAL')
  assert.throws(() => writeNewFile(p, SECRET), (e) => e instanceof NewFileError && e.code === 'exists' && !e.message.includes('SECRET'))
  assert.equal(fs.readFileSync(p, 'utf8'), 'ORIGINAL')
})

test('부분 쓰기 — 이번에 만든 파일을 닫고 지운다 · 메시지에 본문 없음', () => {
  const d = tmp()
  const p = join(d, 'sheet.html')
  assert.throws(
    () => writeNewFile(p, SECRET, faultyFs({ partialThenFail: true })),
    (e) => e instanceof NewFileError && e.code === 'write_failed_removed' && !e.cleanup_failed && !e.message.includes('SECRET'),
  )
  assert.equal(fs.existsSync(p), false)
  assert.deepEqual(fs.readdirSync(d), [])
})

test('close 실패 — 파일을 지우고 실패로 알린다', () => {
  const d = tmp()
  const p = join(d, 'm.json')
  assert.throws(() => writeNewFile(p, 'x', faultyFs({ closeFail: true })), (e) => e.code === 'write_failed_removed' && /EIO/.test(e.message))
  assert.equal(fs.existsSync(p), false)
})

test('cleanup 실패 — 숨기지 않고 cleanup_failed 로 던진다', () => {
  const d = tmp()
  const p = join(d, 'stuck.html')
  assert.throws(
    () => writeNewFile(p, SECRET, faultyFs({ partialThenFail: true, unlinkFail: true })),
    (e) => e instanceof NewFileError && e.cleanup_failed && e.code === 'cleanup_failed_after_write_error' && /EPERM/.test(e.message) && !e.message.includes('SECRET'),
  )
  assert.equal(fs.existsSync(p), true) // 남은 파일은 사람이 확인 — 경로가 오류에 있다
})

test('newFileSet — rollback 은 이 묶음이 만든 파일만 지우고 남의 파일은 둔다', () => {
  const d = tmp()
  const other = join(d, 'other-process.json')
  fs.writeFileSync(other, 'KEEP')
  const set = newFileSet()
  set.write(join(d, 'sheet.html'), 'a')
  set.write(join(d, 'materials.json'), 'b')
  assert.throws(() => set.write(other, 'c'), (e) => e.code === 'exists')
  assert.deepEqual(set.rollback(), [])
  assert.deepEqual(fs.readdirSync(d), ['other-process.json'])
  assert.equal(fs.readFileSync(other, 'utf8'), 'KEEP')
})

test('newFileSet — 부분 쓰기 실패 뒤 rollback 하면 디렉터리가 비어 rmdir 가능(R2 재현 경로)', () => {
  const root = tmp()
  const out = join(root, 'run')
  fs.mkdirSync(out)
  const fsi = faultyFs()
  const set = newFileSet(fsi)
  set.write(join(out, 'materials.json'), 'ok')
  fsi.writeSync = (fd, buf, off, len) => {
    fs.writeSync(fd, buf, off, Math.min(2, len))
    throw errno('ENOSPC')
  }
  assert.throws(() => set.write(join(out, 'sheet.html'), '<html>partial</html>'), (e) => e.code === 'write_failed_removed')
  assert.deepEqual(set.rollback(), [])
  fs.rmdirSync(out)
  assert.equal(fs.existsSync(out), false)
})

test('newFileSet — rollback unlink 실패를 남은 경로로 돌려준다', () => {
  const d = tmp()
  const fsi = faultyFs()
  const set = newFileSet(fsi)
  set.write(join(d, 'a'), '1')
  fsi.unlinkSync = () => {
    throw errno('EBUSY')
  }
  const left = set.rollback()
  assert.equal(left.length, 1)
  assert.match(left[0], /EBUSY/)
})

test('run — 기본 writeNew 가 writeNewFile 을 쓴다: 실제 파일 성공 · 비밀 미출력', async () => {
  const d = tmp()
  const out = join(d, 'draft.json')
  const body = {
    status: 'draft_prepared', persisted: false, lineage: 'not_registered', production: 'not_started',
    delivery: 'not_performed', mapping: 'candidate_unvalidated', registrable: false,
    factory: { order_hash: 'h'.repeat(64) }, blockers: ['lineage_not_registered'],
  }
  const logs = []
  const deps = {
    env: { VOCAFLOW_ADMIN_COOKIE: SECRET },
    fetch: async () => ({ status: 200, json: async () => body }),
    readFile: () => '{"a":1}',
    stdout: (s) => logs.push(s),
    stderr: (s) => logs.push(s),
  }
  const code = await run(['prepare', '--input', 'in.json', '--out', out], deps)
  if (code !== 0) assert.fail(logs.join('\n'))
  assert.deepEqual(JSON.parse(fs.readFileSync(out, 'utf8')), body)
  assert.ok(!logs.join('\n').includes('SECRET'))
})
