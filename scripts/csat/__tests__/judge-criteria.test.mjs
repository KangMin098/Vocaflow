// scripts/csat/__tests__/judge-criteria.test.mjs
//
// **판정 기준은 한 벌이어야 한다.** 판정자 정의 두 벌(.claude · .codex)에 기준을 손으로 적어 두었더니
// 이미 서로 어긋나 있었다(2026-09-24). 기준은 docs/source-check/criteria.md 하나에 두고, 그 표가 코드의
// 목록(gate-rules)과 같은지, 판정자 정의·옛 정본 자리·청크 지시가 기준을 다시 쓰지 않고 정본을 가리키는지를 못박는다.

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import {
  HARMFUL, UNFIT, SOURCE_USES, SLOT_AGES, SLOT_PURPOSES, SLOT_TYPES, SLOT_PLATFORM, HOLD_REASONS, CRITERIA_VERSION,
} from '../gate-rules.mjs'

const root = path.resolve(import.meta.dirname, '../../..')
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8').replace(/\r\n/g, '\n')
const DOC = 'docs/source-check/criteria.md'
const doc = read(DOC)
const section = (title) => {
  const start = doc.indexOf(`## ${title}`)
  assert.ok(start >= 0, `정본에 「${title}」 절이 없다`)
  const end = doc.indexOf('\n## ', start + 3)
  return doc.slice(start, end < 0 ? undefined : end)
}
const between = (tag) => {
  const m = doc.match(new RegExp(`<!-- ${tag} -->([\\s\\S]*?)<!-- /${tag} -->`))
  assert.ok(m, `${tag} 표지가 없다`)
  return m[1]
}
const tableKeys = (text) => [...text.matchAll(/^\| `([a-z0-9_-]+)` \|/gm)].map((m) => m[1])
const inlineKeys = (text) => [...text.matchAll(/`([a-z0-9_-]+)`/g)].map((m) => m[1])

test('정본 머리의 버전 = gate-rules.CRITERIA_VERSION', () => {
  assert.match(doc, new RegExp(`^# .*· v${CRITERIA_VERSION}\\s*$`, 'm'))
})

test('차단 장르 표 = gate-rules 의 HARMFUL + UNFIT + poetry-drama', () => {
  const genre = section('5. genre')
  const blocked = tableKeys(genre.slice(0, genre.indexOf('<!-- topic-genres -->')))
  assert.deepEqual(new Set(blocked), new Set([...HARMFUL, ...UNFIT, 'poetry-drama']))
})

test('uses 표 = gate-rules.SOURCE_USES', () => {
  assert.deepEqual(new Set(tableKeys(section('6. 내용 판정').split('**uses**')[1])), SOURCE_USES)
})

test('주제 장르는 차단 장르와 겹치지 않는다', () => {
  const topics = inlineKeys(between('topic-genres'))
  assert.ok(topics.length >= 20)
  for (const t of topics) assert.ok(!HARMFUL.has(t) && !UNFIT.has(t) && t !== 'poetry-drama', t)
})

test('쓰임새 칸 네 축 + 플랫폼 속성 = gate-rules 목록', () => {
  assert.deepEqual(new Set(tableKeys(between('slot-ages'))), SLOT_AGES)
  assert.deepEqual(new Set(tableKeys(between('slot-purposes'))), SLOT_PURPOSES)
  assert.deepEqual(new Set(inlineKeys(between('slot-types'))), SLOT_TYPES)
  assert.deepEqual(new Set(tableKeys(between('slot-platform'))), SLOT_PLATFORM)
})

test('보류 사유 = gate-rules.HOLD_REASONS', () => {
  const s = section('3. 보관 판정')
  const line = s.split('\n').find((l) => l.startsWith('`hold_reason`'))
  assert.ok(line, 'hold_reason 줄이 없다')
  assert.deepEqual(new Set(inlineKeys(line).filter((k) => k !== 'hold_reason')), HOLD_REASONS)
})

test('두 판정자 정의는 정본을 가리키고 기준을 다시 쓰지 않는다', () => {
  for (const f of ['.claude/agents/csat-source-judge.md', '.codex/agents/csat-source-judge.toml']) {
    const s = read(f)
    assert.ok(s.includes(DOC), `${f} 가 ${DOC} 를 가리키지 않는다`)
    // 기준 표가 되살아나면 두 벌이 다시 갈라진다 — 표의 첫 줄로 잡는다.
    assert.ok(!/^\| `fragmentary` \|/m.test(s), `${f} 에 차단 장르 표가 다시 들어왔다`)
    assert.ok(!/^\| `argument` \|/m.test(s), `${f} 에 uses 표가 다시 들어왔다`)
    assert.ok(!/^\| `elem` \|/m.test(s), `${f} 에 칸 표가 다시 들어왔다`)
  }
})

test('두 판정자 정의의 절차 본문이 같다', () => {
  const body = (s) => s.replace(/^---[\s\S]*?---\n/, '').replace(/^[\s\S]*?developer_instructions = """\n/, '').replace(/"""\s*$/, '').trim()
  const heads = (s) => [...s.matchAll(/^## .+$/gm)].map((m) => m[0])
  assert.deepEqual(heads(body(read('.claude/agents/csat-source-judge.md'))), heads(body(read('.codex/agents/csat-source-judge.toml'))))
})

test('옛 정본 자리와 청크 지시(brief)는 기준을 다시 쓰지 않는다', () => {
  for (const f of ['docs/SOURCE_JUDGMENT_CRITERIA.md', 'scripts/csat/plos-raw-triage-brief.md']) {
    const s = read(f)
    assert.ok(s.includes('source-check/criteria.md'), `${f} 가 새 정본을 가리키지 않는다`)
    assert.ok(!/^\| `(use|fragmentary|elem)` \|/m.test(s), `${f} 에 기준 표가 있다`)
  }
})
