// scripts/knowledge/__tests__/codex-extract-batch.test.mjs — node --test scripts/knowledge/__tests__/codex-extract-batch.test.mjs
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chunkComplete, decidedVideos, parseJsonl, parseTargets } from '../codex-extract-batch.mjs'

test('CRLF 대상 목록에서도 ID 끝에 \\r 이 남지 않는다', () => {
  const text = 'AAAAAAAAAAA\t채널\t제목\r\nBBBBBBBBBBB\t채널\t제목\r\n'
  assert.deepEqual(parseTargets(text), ['AAAAAAAAAAA', 'BBBBBBBBBBB'])
})

test('jsonl: 깨진 줄·null 은 버린다 · CRLF 도 읽는다', () => {
  assert.deepEqual(parseJsonl('{"a":1}\r\nnull\r\n{broken\r\n{"b":2}\r\n'), [{ a: 1 }, { b: 2 }])
})

test('완료 표시 없는 묶음의 영상은 「판정됨」으로 세지 않는다 — 첫 주장만 쓰고 끊긴 영상을 다시 뽑게', () => {
  const partial = [{ videoId: 'P' }]
  const chunks = [
    { name: 'claims-chunk-01.jsonl', claims: [{ videoId: 'A' }], done: true },
    { name: 'claims-chunk-02.jsonl', claims: [{ videoId: 'B' }], done: false },
  ]
  const d = decidedVideos(partial, chunks)
  assert.ok(d.has('P') && d.has('A'))
  assert.equal(d.has('B'), false)
})

test('묶음 완료 = 정상 종료 + 한도 아님 + 맡긴 영상 전부 판정', () => {
  const claims = [{ videoId: 'A' }, { videoId: 'B' }]
  assert.equal(chunkComplete({ status: 0, limitHit: false, ids: ['A', 'B'], claims }), true)
  assert.equal(chunkComplete({ status: 0, limitHit: false, ids: ['A', 'B', 'C'], claims }), false)
  assert.equal(chunkComplete({ status: 1, limitHit: false, ids: ['A', 'B'], claims }), false)
  assert.equal(chunkComplete({ status: 0, limitHit: true, ids: ['A', 'B'], claims }), false)
})
