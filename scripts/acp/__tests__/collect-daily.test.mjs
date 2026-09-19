// scripts/acp/__tests__/collect-daily.test.mjs
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { collectDaily, parseCollectionOptions } from '../collect-daily.mjs'

const fetchedAt = '2026-09-19T01:02:03.456Z'
const item = (id) => ({ source_id: 'example:' + id, url: 'https://example.test/' + id, title: 'Article ' + id })
const first = [item(1), item(2)]
const second = [item(3), item(4)]
function fixture(t, options = {}) {
  t.mock.method(console, 'log', () => {})
  const rows = [...(options.rows ?? [])]
  const writes = []
  const fetched = []
  const listed = []
  let cursor = options.cursor ?? { version: 1, source: 'example', feed: 'news', token: null, exhausted: false, seen: [] }
  const database = {
    from() {
      const filters = {}
      return {
        select() { return this },
        async range(from, to) { return { data: rows.slice(from, to + 1), error: null } },
        eq(name, value) { filters[name] = value; return this },
        async maybeSingle() {
          return options.duplicateError
            ? { data: null, error: { message: 'lookup offline' } }
            : { data: rows.find((row) => row.source_id === filters.source_id) ?? null, error: null }
        },
        async insert(row) {
          if (options.insertError) return { error: { message: 'insert offline' } }
          rows.push({ ...row, id: row.source_id })
          return { error: null }
        },
      }
    },
  }
  const library = {
    classifyTopic: () => 'fit',
    harvestCursorPath: () => 'fixture-cursor.json',
    readHarvestCursor: () => structuredClone(cursor),
    emptyHarvestCursor: () => ({ version: 1, source: 'example', feed: 'news', token: null, exhausted: false, seen: [] }),
    writeHarvestCursor(file, value) { writes.push({ file, value }); cursor = structuredClone(value) },
  }
  const sources = [{
    key: 'example',
    feeds: [{
      id: 'news',
      async run() { return first },
      async runPage(token) {
        listed.push(token)
        if (options.listError) throw new Error('list offline')
        const page = token ?? 0
        if (page === 0) return { items: first, cont: 1 }
        if (page === 1) return { items: second, cont: 2 }
        return { items: [], cont: null }
      },
    }],
    async ingest(url) {
      fetched.push(url)
      if (options.ingestError) throw new Error('body offline')
      return { source: 'example', source_id: 'example:' + url.split('/').pop(), source_url: url,
        title: 'Article', content: 'A source article.', license: 'CC0', published_at: null,
        fetched_at: options.invalidFetchedAt ? undefined : new Date(fetchedAt) }
    },
  }]
  return {
    rows, writes, fetched, listed,
    cursor: () => cursor,
    run: (args = []) => collectDaily({ library, database, sources,
      argv: ['node', 'collector', '--pages', '2', '--page-delay', '0', ...args] }),
  }
}

test('dry-run and fresh dry-run never persist a cursor or fetch bodies', async (t) => {
  const f = fixture(t)
  assert.equal((await f.run()).totalNew, 4)
  assert.equal((await f.run(['--fresh'])).totalNew, 4)
  assert.equal(f.writes.length, 0)
  assert.equal(f.fetched.length, 0)
  assert.equal(f.rows.length, 0)
})

test('commit limit retains the page boundary until all candidates are durable', async (t) => {
  const f = fixture(t)
  for (let run = 0; run < 3; run++) {
    assert.equal((await f.run(['--commit', '--limit', '1'])).saved, 1)
    assert.equal(f.writes.length, 0)
    assert.equal(f.cursor().token, null)
  }
  assert.equal((await f.run(['--commit', '--limit', '1'])).saved, 1)
  assert.equal(f.writes.length, 1)
  assert.equal(f.cursor().token, '2')
  assert.deepEqual(f.rows.map((row) => row.source_id), first.concat(second).map((entry) => entry.source_id))
  assert.equal(f.fetched.length, 4)
  assert.ok(f.rows.every((row) => row.source_fetched_at === fetchedAt))
})

test('saved exhausted cursor does not restart; explicit fresh can restart', async (t) => {
  const f = fixture(t, { cursor: { version: 1, source: 'example', feed: 'news', token: null, exhausted: true, seen: [] } })
  const skipped = await f.run(['--commit', '--limit', '4'])
  assert.equal(skipped.saved, 0)
  assert.equal(skipped.emptyFeeds.length, 0)
  assert.equal(f.listed.length, 0)
  assert.equal(f.writes.length, 0)
  assert.equal((await f.run(['--commit', '--fresh', '--limit', '4'])).saved, 4)
  assert.equal(f.cursor().token, '2')
})

for (const failure of ['ingestError', 'insertError', 'duplicateError', 'invalidFetchedAt', 'listError']) {
  test(failure + ' never advances a cursor', async (t) => {
    const f = fixture(t, { [failure]: true })
    const result = await f.run(['--commit', '--limit', '4'])
    assert.ok(result.failures.length > 0)
    assert.equal(f.writes.length, 0)
    assert.equal(f.rows.length, 0)
  })
}

test('already stored rows allow advancing without fetching them again', async (t) => {
  const f = fixture(t, { rows: first.concat(second).map((entry) => ({ source_id: entry.source_id, source_url: entry.url })) })
  assert.equal((await f.run(['--commit'])).saved, 0)
  assert.equal(f.fetched.length, 0)
  assert.equal(f.cursor().token, '2')
})

test('CLI numeric options cannot silently disable commit limits', () => {
  for (const args of [
    ['--limit'], ['--limit', '--commit'], ['--limit', '0'], ['--limit', '-1'],
    ['--limit', '2.5'], ['--limit', 'Infinity'], ['--limit', 'NaN'], ['--limit', '9007199254740992'],
    ['--pages', '-1'], ['--pages', '1.5'], ['--page-delay', '-1'], ['--page-delay', 'NaN'],
  ]) assert.throws(() => parseCollectionOptions(args), /requires a value|must be an integer/)
  assert.equal(parseCollectionOptions(['--pages', '0']).pages, 0)
  assert.equal(parseCollectionOptions(['--page-delay', '0']).pageDelay, 0)
})

test('unknown feed fails before listing or writing', async (t) => {
  const f = fixture(t)
  await assert.rejects(f.run(['--commit', '--feed', 'missing']), /Unknown feed/)
  assert.equal(f.listed.length, 0)
  assert.equal(f.writes.length, 0)
})
