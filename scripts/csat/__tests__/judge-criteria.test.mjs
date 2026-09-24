// scripts/csat/__tests__/judge-criteria.test.mjs
//
// **판정 기준은 한 벌이어야 한다.** 판정자 정의 두 벌(.claude · .codex)에 기준을 손으로 적어 두었더니
// 이미 서로 어긋나 있었다(2026-09-24). 기준은 docs/SOURCE_JUDGMENT_CRITERIA.md 하나에 두고,
// 그 표가 코드의 목록(gate-rules)과 같은지, 판정자 정의가 기준을 다시 쓰지 않고 정본을 가리키는지를 못박는다.

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import { HARMFUL, UNFIT, SOURCE_USES } from '../gate-rules.mjs'

const root = path.resolve(import.meta.dirname, '../../..')
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8').replace(/\r\n/g, '\n')
const DOC = 'docs/SOURCE_JUDGMENT_CRITERIA.md'
const doc = read(DOC)
const section = (title) => {
  const start = doc.indexOf(`## ${title}`)
  assert.ok(start >= 0, `정본에 「${title}」 절이 없다`)
  const end = doc.indexOf('\n## ', start + 3)
  return doc.slice(start, end < 0 ? undefined : end)
}
const tableKeys = (text) => [...text.matchAll(/^\| `([a-z-]+)` \|/gm)].map((m) => m[1])

test('차단 장르 표 = gate-rules 의 HARMFUL + UNFIT + poetry-drama', () => {
  const genre = section('4. genre')
  const blocked = tableKeys(genre.slice(0, genre.indexOf('<!-- topic-genres -->')))
  assert.deepEqual(new Set(blocked), new Set([...HARMFUL, ...UNFIT, 'poetry-drama']))
})

test('uses 표 = gate-rules.SOURCE_USES', () => {
  assert.deepEqual(new Set(tableKeys(section('5. uses'))), SOURCE_USES)
})

test('주제 장르는 차단 장르와 겹치지 않는다', () => {
  const m = doc.match(/<!-- topic-genres -->([\s\S]*?)<!-- \/topic-genres -->/)
  assert.ok(m, 'topic-genres 표지가 없다')
  const topics = [...m[1].matchAll(/`([a-z-]+)`/g)].map((x) => x[1])
  assert.ok(topics.length >= 20)
  for (const t of topics) assert.ok(!HARMFUL.has(t) && !UNFIT.has(t) && t !== 'poetry-drama', t)
})

test('두 판정자 정의는 정본을 가리키고 기준을 다시 쓰지 않는다', () => {
  for (const f of ['.claude/agents/csat-source-judge.md', '.codex/agents/csat-source-judge.toml']) {
    const s = read(f)
    assert.ok(s.includes(DOC), `${f} 가 ${DOC} 를 가리키지 않는다`)
    // 기준 표가 되살아나면 두 벌이 다시 갈라진다 — 표의 첫 줄로 잡는다.
    assert.ok(!/^\| `fragmentary` \|/m.test(s), `${f} 에 차단 장르 표가 다시 들어왔다`)
    assert.ok(!/^\| `argument` \|/m.test(s), `${f} 에 uses 표가 다시 들어왔다`)
  }
})

test('두 판정자 정의의 절차 본문이 같다', () => {
  const body = (s) => s.replace(/^---[\s\S]*?---\n/, '').replace(/^[\s\S]*?developer_instructions = """\n/, '').replace(/"""\s*$/, '').trim()
  const a = body(read('.claude/agents/csat-source-judge.md'))
  const b = body(read('.codex/agents/csat-source-judge.toml'))
  const heads = (s) => [...s.matchAll(/^## .+$/gm)].map((m) => m[0])
  assert.deepEqual(heads(a), heads(b))
})

test('보관 판정 청크 지시(brief)도 기준을 다시 쓰지 않는다', () => {
  const s = read('scripts/csat/plos-raw-triage-brief.md')
  assert.ok(s.includes('SOURCE_JUDGMENT_CRITERIA.md'))
  assert.ok(!/^\| `use` \|/m.test(s))
})
