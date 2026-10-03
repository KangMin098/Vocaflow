// scripts/csat/__tests__/pdf-blank-lines.test.mjs
import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { blankRuleItems, inBlankQuestion, visibleBlankText } from '../lib-pdf-blank-lines.mjs'
const ops = { save: 1, restore: 2, transform: 3, constructPath: 4 }
const drawPath = (bbox) => [20, [], bbox]
const page = { width: 840, height: 1190 }

test('white answer glyphs merged into visible text are removed using original glyph runs', () => {
  const textOps = { ...ops, setTextMatrix: 5, setFillRGBColor: 6, showText: 7, setFont: 8, setHScale: 9 }
  const glyphs = (s) => [...s].map((unicode) => ({ unicode, width: 500 }))
  const list = { fnArray: [8, 5, 7, 1, 6, 5, 7, 2, 5, 7], argsArray: [['font', 10], [[1, 0, 0, 1, 100, 602]], [glyphs('sugar. ')], [], ['#ffffff'], [[1, 0, 0, 1, 150, 602]], [glyphs('hidden answer')], [], [[1, 0, 0, 1, 250, 602]], [glyphs(',')]] }
  const items = [{ str: '34. A question', x: 90, y: 800, w: 100 }, { str: 'sugar. hidden answer', x: 100, y: 602, w: 140 }, { str: ',', x: 250, y: 602, w: 5 }]
  const visible = visibleBlankText(list, textOps, items, page)
  assert.deepEqual(visible.map((s) => s.str), ['34. A question', 'sugar. ', ','])
  assert.equal(blankRuleItems({ fnArray: [4], argsArray: [drawPath([150, 600, 249, 600])] }, ops, visible, page).length, 1)
  assert.deepEqual(visibleBlankText(list, textOps, [{ ...items[0], str: '30. A question' }, ...items.slice(1)], page).map((s) => s.str), ['30. A question', 'sugar. hidden answer', ','])
})

test('a long empty underline before a full stop becomes a blank; text underlines and page rules do not', () => {
  const list = { fnArray: [4, 4, 4, 4], argsArray: [drawPath([150, 850, 320, 850]), drawPath([100, 850, 140, 850]), drawPath([0, 100, 840, 100]), drawPath([200, 1030, 400, 1030])] }
  const items = [{ str: 'The statement is', x: 95, y: 852, w: 53 }, { str: '.', x: 322, y: 852, w: 3 }, { str: ' ', x: 150, y: 852, w: 1200 }]
  const blanks = blankRuleItems(list, ops, items, page)
  assert.deepEqual(blanks, [{ str: ' ______ ', x: 150, y: 852, w: 170 }])
  assert.deepEqual(blankRuleItems(list, ops, [...items, { str: '______', x: 150, y: 852, w: 170 }], page), [], 'existing text-layer blanks must not be duplicated')
})

test('saved drawing transforms are applied and repeated paths yield only one blank', () => {
  const list = { fnArray: [1, 3, 4, 4, 2], argsArray: [[], [1, 0, 0, 1, 100, 800], drawPath([50, 50, 220, 50]), drawPath([50, 50, 220, 50]), []] }
  assert.equal(blankRuleItems(list, ops, [{ str: 'It is', x: 100, y: 852, w: 48 }], page).length, 1)
})

test('adjoining short strokes form one blank but nearby separated strokes stay separate', () => {
  const list = { fnArray: Array(16).fill(4), argsArray: Array.from({ length: 16 }, (_, i) => drawPath([150 + i * 5, 850, 155 + i * 5, 850])) }
  assert.deepEqual(blankRuleItems(list, ops, [{ str: 'It is', x: 100, y: 852, w: 48 }], page), [{ str: ' ______ ', x: 150, y: 852, w: 80 }])
})

test('small-page word blanks shorter than the old forty-point gap threshold are recovered', () => {
  assert.equal(blankRuleItems({ fnArray: [4], argsArray: [drawPath([150, 850, 184, 850])] }, ops, [{ str: 'It is', x: 100, y: 852, w: 48 }], page).length, 1)
})

test('a drawn rule in vocab or choices cannot become a blank in the passage', () => {
  const candidate = { x: 200, y: 600 }
  assert.equal(inBlankQuestion(candidate, [{ str: '30. A sentence', x: 90, y: 800 }], 840), false)
  assert.equal(inBlankQuestion(candidate, [{ str: '31.', x: 90, y: 800 }], 840), true)
  assert.equal(inBlankQuestion(candidate, [{ str: '31.', x: 90, y: 800 }, { str: '① an option', x: 90, y: 700 }], 840), false)
})

test('a whole-line blank or quoted empty line remains between the English lines', () => {
  const list = { fnArray: [4], argsArray: [drawPath([150, 850, 320, 850])] }
  const previous = { str: 'They describe it as', x: 100, y: 869, w: 200 }
  assert.equal(blankRuleItems(list, ops, [previous], page)[0].y, 852)
  assert.equal(blankRuleItems(list, ops, [previous, { str: '“', x: 145, y: 852, w: 4 }], page).length, 1)
})

for (const mode of ['scoped', 'unknown', 'prune', 'changed-answer']) {
  test(`recovered-source synchronization ${mode}: only the named current-set item may be written`, async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'csat-source-scope-'))
    const data = path.join(dir, 'scripts/csat/data')
    fs.mkdirSync(data, { recursive: true })
    fs.writeFileSync(path.join(data, 'classified.json'), JSON.stringify({ types: [{ id: 'R-BLANK', sec: '독해', name: '빈칸' }] }))
    fs.writeFileSync(path.join(data, 'corpus-hakpyeong.json'), JSON.stringify({ items: [31, 32].map((no) => ({ id: `H2603G1#${no}`, exam: 'H2603G1', no, type_id: 'R-BLANK', in_scope: true, year: 2026, passage: 'A recovered ______.', choices: ['A','B','C','D','E'], answer: 1 })) }))
    const requests = []
    const server = http.createServer(async (req, res) => {
      let body = ''
      for await (const part of req) body += part
      requests.push({ method: req.method, url: req.url, body: body ? JSON.parse(body) : null })
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(req.method === 'GET' ? [{ id: 'H2603G1#31', type_id: 'R-BLANK', choices: ['A','B','C','D','E'], answer: mode === 'changed-answer' ? 2 : 1, passage: 'A broken source.', body_ok: false }] : [{ id: 'H2603G1#31' }]))
    })
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    try {
      const child = spawn(process.execPath, [fileURLToPath(new URL('../corpus-sync.mjs', import.meta.url)), '--set', 'hakpyeong', '--items', mode === 'unknown' ? 'H2603G1#99' : 'H2603G1#31', '--commit', ...(mode === 'prune' ? ['--prune-stale'] : [])], { cwd: dir, windowsHide: true, env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${server.address().port}`, SUPABASE_SERVICE_ROLE_KEY: 'test-only' } })
      let output = ''
      child.stdout.on('data', (s) => { output += s })
      child.stderr.on('data', (s) => { output += s })
      const code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('close', resolve) })
      if (mode === 'scoped') {
        assert.equal(code, 0, output)
        assert.equal(requests.length, 2)
        assert.equal(requests[1].method, 'PATCH')
        assert.match(requests[1].url, /^\/rest\/v1\/csat_items\?id=eq.H2603G1%2331/)
        assert.ok(decodeURIComponent(requests[1].url.replace(/\+/g, ' ')).includes('passage=eq.A broken source.'), 'a concurrent source update must prevent stale repair')
        assert.deepEqual(requests[1].body, { passage: 'A recovered ______.', body_ok: true })
      } else {
        assert.notEqual(code, 0, output)
        assert.ok(requests.every((r) => r.method === 'GET'))
      }
    } finally {
      await new Promise((resolve) => server.close(resolve))
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
}
