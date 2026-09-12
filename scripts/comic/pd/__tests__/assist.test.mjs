// scripts/comic/pd/__tests__/assist.test.mjs
//
// 브라우저 보조 취득의 **정규화** 회귀.
//
// 세션 자체(창 띄우기·사람의 클릭)는 자동 테스트 대상이 아니다. 자동화한 부분은
// "받은 파일을 pages/ 로 편다"뿐이고, 여기가 조용히 깨지면 0장 취득이 성공처럼 보인다.
//
// ZIP 리더를 직접 구현한 이유: 이 환경에 unzip 이 없고 Node 에 zip 리더가 없다.
// 실물 CBZ(Internet Archive, 37엔트리 · store+deflate 혼재)로 검증했고,
// 그 구조를 여기서 합성해 고정한다.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import zlib from 'node:zlib'
import { describe, expect, it } from 'vitest'

import { extractZipEntry, normalizeIncoming, readZipEntries } from '../assist.mjs'

/** 최소 ZIP 작성기 — store(0)/deflate(8) 를 섞어 실물 CBZ 구조를 재현한다. */
function makeZip(files) {
  const locals = []
  const central = []
  let offset = 0

  for (const f of files) {
    const nameBuf = Buffer.from(f.name, 'utf8')
    const raw = Buffer.from(f.data)
    const deflated = f.method === 8 ? zlib.deflateRawSync(raw) : raw
    const crc = 0 // 리더가 CRC 를 검사하지 않으므로 0 으로 둔다

    const lh = Buffer.alloc(30)
    lh.writeUInt32LE(0x04034b50, 0)
    lh.writeUInt16LE(20, 4)
    lh.writeUInt16LE(f.method, 8)
    lh.writeUInt32LE(crc, 14)
    lh.writeUInt32LE(deflated.length, 18)
    lh.writeUInt32LE(raw.length, 22)
    lh.writeUInt16LE(nameBuf.length, 26)
    lh.writeUInt16LE(0, 28)

    const cd = Buffer.alloc(46)
    cd.writeUInt32LE(0x02014b50, 0)
    cd.writeUInt16LE(20, 6)
    cd.writeUInt16LE(f.method, 10)
    cd.writeUInt32LE(crc, 16)
    cd.writeUInt32LE(deflated.length, 20)
    cd.writeUInt32LE(raw.length, 24)
    cd.writeUInt16LE(nameBuf.length, 28)
    cd.writeUInt32LE(offset, 42)

    locals.push(Buffer.concat([lh, nameBuf, deflated]))
    central.push(Buffer.concat([cd, nameBuf]))
    offset += lh.length + nameBuf.length + deflated.length
  }

  const localAll = Buffer.concat(locals)
  const centralAll = Buffer.concat(central)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(files.length, 8)
  eocd.writeUInt16LE(files.length, 10)
  eocd.writeUInt32LE(centralAll.length, 12)
  eocd.writeUInt32LE(localAll.length, 16)
  return Buffer.concat([localAll, centralAll, eocd])
}

/** 최소 유효 JPEG 헤더 — 정규화가 확장자만 보고 옮기는지, 내용이 보존되는지 확인용. */
const jpeg = (marker) => Buffer.from([0xff, 0xd8, 0xff, 0xe0, marker])

function tmpdir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'pdcp-assist-'))
}

describe('readZipEntries / extractZipEntry', () => {
  it('store 와 deflate 를 모두 읽는다 (실물 CBZ 가 둘을 섞어 쓴다)', () => {
    const buf = makeZip([
      { name: 'a/01.jpg', method: 0, data: jpeg(1) },
      { name: 'a/02.jpg', method: 8, data: jpeg(2) },
    ])
    const entries = readZipEntries(buf)
    expect(entries.map((e) => e.name)).toEqual(['a/01.jpg', 'a/02.jpg'])
    expect(extractZipEntry(buf, entries[0])).toEqual(jpeg(1))
    expect(extractZipEntry(buf, entries[1])).toEqual(jpeg(2))
  })

  it('ZIP 이 아니면 조용히 빈 결과가 아니라 예외 — 0장 취득이 성공처럼 보이면 안 된다', () => {
    expect(() => readZipEntries(Buffer.from('not a zip at all'))).toThrow(/중앙 디렉터리/)
  })
})

describe('normalizeIncoming', () => {
  it('CBZ 내부 이미지를 순번대로 편다', () => {
    const dir = tmpdir()
    fs.mkdirSync(path.join(dir, 'incoming'))
    fs.writeFileSync(
      path.join(dir, 'incoming', 'issue.cbz'),
      makeZip([
        { name: 'x/03.jpg', method: 8, data: jpeg(3) },
        { name: 'x/01.jpg', method: 0, data: jpeg(1) },
        { name: 'x/02.jpg', method: 8, data: jpeg(2) },
      ]),
    )
    const r = normalizeIncoming(path.join(dir, 'incoming'), path.join(dir, 'pages'))
    expect(r.pageCount).toBe(3)
    // 내부 이름 순으로 정렬되어야 한다 — 뒤섞이면 만화가 순서 없이 읽힌다
    expect(fs.readFileSync(path.join(dir, 'pages', '0000.jpg'))).toEqual(jpeg(1))
    expect(fs.readFileSync(path.join(dir, 'pages', '0002.jpg'))).toEqual(jpeg(3))
  })

  it('디렉터리 엔트리와 __MACOSX 는 페이지가 아니다', () => {
    const dir = tmpdir()
    fs.mkdirSync(path.join(dir, 'incoming'))
    fs.writeFileSync(
      path.join(dir, 'incoming', 'issue.cbz'),
      makeZip([
        { name: 'x/', method: 0, data: Buffer.alloc(0) },
        { name: '__MACOSX/._01.jpg', method: 0, data: jpeg(9) },
        { name: 'x/01.jpg', method: 0, data: jpeg(1) },
      ]),
    )
    expect(normalizeIncoming(path.join(dir, 'incoming'), path.join(dir, 'pages')).pageCount).toBe(1)
  })

  it('낱장 이미지는 그대로 받는다', () => {
    const dir = tmpdir()
    fs.mkdirSync(path.join(dir, 'incoming'))
    fs.writeFileSync(path.join(dir, 'incoming', 'p2.png'), jpeg(2))
    fs.writeFileSync(path.join(dir, 'incoming', 'p10.png'), jpeg(10))
    // 자연 정렬 — p10 이 p2 앞에 오면 페이지 순서가 뒤집힌다
    const r = normalizeIncoming(path.join(dir, 'incoming'), path.join(dir, 'pages'))
    expect(r.pageCount).toBe(2)
    expect(fs.readFileSync(path.join(dir, 'pages', '0000.png'))).toEqual(jpeg(2))
  })

  it('CBR 은 해제하지 못한다는 사실을 메모로 남긴다 (조용한 0장 금지)', () => {
    const dir = tmpdir()
    fs.mkdirSync(path.join(dir, 'incoming'))
    fs.writeFileSync(path.join(dir, 'incoming', 'issue.cbr'), Buffer.from('Rar!'))
    const r = normalizeIncoming(path.join(dir, 'incoming'), path.join(dir, 'pages'))
    expect(r.pageCount).toBe(0)
    expect(r.notes.join(' ')).toMatch(/CBR/)
  })

  it('PDF 는 페이지로 세지 않고 보관 사실을 남긴다', () => {
    const dir = tmpdir()
    fs.mkdirSync(path.join(dir, 'incoming'))
    fs.writeFileSync(path.join(dir, 'incoming', 'scan.pdf'), Buffer.from('%PDF-1.4'))
    const r = normalizeIncoming(path.join(dir, 'incoming'), path.join(dir, 'pages'))
    expect(r.pageCount).toBe(0)
    expect(r.notes.join(' ')).toMatch(/PDF/)
  })

  it('손상된 CBZ 하나가 세션 전체를 무너뜨리지 않는다', () => {
    const dir = tmpdir()
    fs.mkdirSync(path.join(dir, 'incoming'))
    fs.writeFileSync(path.join(dir, 'incoming', 'broken.cbz'), Buffer.from('garbage'))
    fs.writeFileSync(path.join(dir, 'incoming', 'ok.jpg'), jpeg(1))
    const r = normalizeIncoming(path.join(dir, 'incoming'), path.join(dir, 'pages'))
    expect(r.pageCount).toBe(1)
    expect(r.notes.join(' ')).toMatch(/broken\.cbz/)
  })
})
