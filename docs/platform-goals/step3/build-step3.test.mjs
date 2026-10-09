// docs/platform-goals/step3/build-step3.test.mjs — STEP 3 생성기 추적성 회귀
//   node --test docs/platform-goals/step3/build-step3.test.mjs
// 생성기를 임시 폴더에 복사해 돌린다(실제 산출물을 덮지 않는다).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const GOALS = path.resolve(HERE, '..')

/** platform-goals 사본(정본·manifest·step3 생성기·원자료) + platform-audit 사본을 임시 폴더에 만든다 */
function sandbox(mutate = (s) => s) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'step3-'))
  const goals = path.join(root, 'docs', 'platform-goals')
  fs.cpSync(GOALS, goals, { recursive: true, filter: (p) => !p.endsWith('.test.mjs') })
  fs.cpSync(path.resolve(GOALS, '..', 'platform-audit'), path.join(root, 'docs', 'platform-audit'), { recursive: true })
  const gen = path.join(goals, 'step3', 'build-step3.mjs')
  fs.writeFileSync(gen, mutate(fs.readFileSync(gen, 'utf8')))
  const r = spawnSync(process.execPath, [gen], { encoding: 'utf8' })
  return { r, step3: path.join(goals, 'step3') }
}

const csvRow = (csv, id) => csv.split('\n').find((l) => l.startsWith(`"criterion","${id}"`))

test('모든 갭이 정본에 있는 기준 id 를 명시적으로 참조한다', () => {
  const { r, step3 } = sandbox()
  assert.equal(r.status, 0, r.stderr)
  const dag = JSON.parse(fs.readFileSync(path.join(step3, 'STEP3_DEPENDENCY_DAG.json'), 'utf8'))
  const canon = new Set(JSON.parse(fs.readFileSync(path.join(step3, '_raw', 'crosswalk.json'), 'utf8')).criteria_ids)
  assert.equal(canon.size, 40)
  for (const n of dag.nodes) {
    assert.ok(n.canon_criteria.length > 0, `${n.id} 기준 없음`)
    for (const c of n.canon_criteria) assert.ok(canon.has(c), `${n.id} → ${c} 는 정본에 없다`)
  }
})

test('회귀: R0-G15 → VG-L3-A1-01 · R0-GATE → VG-L3-A2-02 가 기준 추적에 남는다(증거 공유로만 추론하던 결함)', () => {
  const { r, step3 } = sandbox()
  assert.equal(r.status, 0, r.stderr)
  const csv = fs.readFileSync(path.join(step3, 'STEP3_GOAL_CROSSWALK.csv'), 'utf8')
  assert.match(csvRow(csv, 'VG-L3-A1-01-AC1'), /R0-G15/)
  assert.match(csvRow(csv, 'VG-L3-A2-02-AC1'), /R0-GATE/)
})

test('갭의 기준 id 가 정본에 없으면 생성이 실패한다', () => {
  const { r } = sandbox((s) => s.replace("'R0-G15': ['VG-L3-A1-01-AC1', 'VG-L2-A1-AC1']", "'R0-G15': ['VG-L3-A1-99-AC1']"))
  assert.notEqual(r.status, 0)
  assert.match(r.stderr, /R0-G15 의 정본 기준 VG-L3-A1-99-AC1 는 정본에 없다/)
})

test('갭의 기준 id 가 빠지면 생성이 실패한다', () => {
  const { r } = sandbox((s) => s.replace("'R0-GATE': ['VG-L3-A2-02-AC1', 'VG-L3-D2-01-AC1', 'VG-L2-D2-AC1'],", ''))
  assert.notEqual(r.status, 0)
  assert.match(r.stderr, /R0-GATE 에 정본 기준이 없다/)
})

test('증거 항목의 기준 id 가 정본에 없으면 생성이 실패한다', () => {
  const { r } = sandbox((s) => s.replace("'C-01': ['VG-L3-B1-01-AC1']", "'C-01': ['VG-NOPE']"))
  assert.notEqual(r.status, 0)
  assert.match(r.stderr, /증거 C-01 의 정본 기준 VG-NOPE 는 정본에 없다/)
})

test('기준 연결은 PASS 판정이 아니다 — 등록부와 대응표가 그렇게 적는다', () => {
  const { r, step3 } = sandbox()
  assert.equal(r.status, 0, r.stderr)
  assert.match(fs.readFileSync(path.join(step3, 'STEP3_R0_GAP_REGISTER.md'), 'utf8'), /연결은 목표 달성 PASS 판정이 아니다/)
  assert.match(csvRow(fs.readFileSync(path.join(step3, 'STEP3_GOAL_CROSSWALK.csv'), 'utf8'), 'VG-L3-A1-01-AC1'), /목표 달성 PASS 판정이 아니다/)
})
