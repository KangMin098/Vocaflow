// apps/web/src/lib/utils/__tests__/secret-redact.test.ts
import { deflateRawSync, inflateRawSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { REDACTED, countSecrets, redactSecrets, redactZip } from '../secret-redact'

// 실제 토큰이 아닌, 형식만 같은 문자열을 실행 중에 만든다
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: '00000000-0000-0000-0000-000000000000', role: 'authenticated', exp: 1 })}.${'s'.repeat(43)}`
const cookie = `sb-${'a'.repeat(20)}-auth-token=base64-${Buffer.from(JSON.stringify({ access_token: jwt, refresh_token: 'r'.repeat(12) })).toString('base64')}`

/** 테스트용 최소 zip(항목 무압축/deflate 혼합) */
function makeZip(files: Array<{ name: string; text: string; deflate?: boolean }>): Buffer {
  const parts: Buffer[] = []
  const cds: Buffer[] = []
  let off = 0
  for (const f of files) {
    const data = Buffer.from(f.text)
    const comp = f.deflate ? deflateRawSync(data) : data
    const name = Buffer.from(f.name)
    const lh = Buffer.alloc(30)
    lh.writeUInt32LE(0x04034b50, 0)
    lh.writeUInt16LE(f.deflate ? 8 : 0, 8)
    lh.writeUInt32LE(comp.length, 18)
    lh.writeUInt32LE(data.length, 22)
    lh.writeUInt16LE(name.length, 26)
    const ch = Buffer.alloc(46)
    ch.writeUInt32LE(0x02014b50, 0)
    ch.writeUInt16LE(f.deflate ? 8 : 0, 10)
    ch.writeUInt32LE(comp.length, 20)
    ch.writeUInt32LE(data.length, 24)
    ch.writeUInt16LE(name.length, 28)
    ch.writeUInt32LE(off, 42)
    parts.push(lh, name, comp)
    cds.push(ch, name)
    off += 30 + name.length + comp.length
  }
  const cd = Buffer.concat(cds)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(files.length, 8)
  end.writeUInt16LE(files.length, 10)
  end.writeUInt32LE(cd.length, 12)
  end.writeUInt32LE(off, 16)
  return Buffer.concat([...parts, cd, end])
}

/** 테스트용 zip 읽기 — 이름 → 본문 */
function readZip(zip: Buffer): Record<string, string> {
  const out: Record<string, string> = {}
  let eocd = zip.length - 22
  while (zip.readUInt32LE(eocd) !== 0x06054b50) eocd--
  let p = zip.readUInt32LE(eocd + 16)
  for (let i = 0; i < zip.readUInt16LE(eocd + 10); i++) {
    const method = zip.readUInt16LE(p + 10)
    const csize = zip.readUInt32LE(p + 20)
    const nlen = zip.readUInt16LE(p + 28)
    const local = zip.readUInt32LE(p + 42)
    const name = zip.subarray(p + 46, p + 46 + nlen).toString()
    p += 46 + nlen + zip.readUInt16LE(p + 30) + zip.readUInt16LE(p + 32)
    const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28)
    const raw = zip.subarray(start, start + csize)
    out[name] = (method === 8 ? inflateRawSync(raw) : raw).toString()
  }
  return out
}

describe('secret-redact', () => {
  it('쿠키 헤더 · Bearer JWT · JSON 갱신 토큰(이스케이프 포함)을 가리고 문맥은 남긴다', () => {
    const text = [`cookie: ${cookie}; theme=dark`, `authorization: Bearer ${jwt}`, '{"refresh_token":"abcdefghijkl"}', '"{\\"refresh_token\\":\\"abcdefghijkl\\"}"'].join('\n')
    expect(countSecrets(text)).toBeGreaterThanOrEqual(4)
    const red = redactSecrets(text)
    expect(countSecrets(red)).toBe(0)
    expect(red).toContain('theme=dark')
    expect(red).toContain(`"refresh_token":"${REDACTED}"`)
    expect(red).not.toContain(jwt)
  })

  it('흔적 없는 본문은 그대로 둔다', () => {
    const text = 'expect(locator).toBeVisible() failed · eyJ 짧은 조각 eyJabc'
    expect(countSecrets(text)).toBe(0)
    expect(redactSecrets(text)).toBe(text)
  })

  it('trace zip 의 무압축 · deflate 항목을 가리고, 다른 항목과 이름은 보존한다', () => {
    const zip = makeZip([
      { name: 'trace.network', text: `{"request":{"headers":[{"name":"cookie","value":"${cookie}"}]}}`, deflate: true },
      { name: 'trace.trace', text: `{"type":"before","params":{"token":"${jwt}"}}` },
      { name: 'resources/a.png', text: 'PNGDATA' },
    ])
    const r = redactZip(zip)
    expect(r).not.toBeNull()
    expect(r!.count).toBeGreaterThanOrEqual(2)
    const files = readZip(r!.zip)
    expect(Object.keys(files)).toEqual(['trace.network', 'trace.trace', 'resources/a.png'])
    expect(countSecrets(files['trace.network'] + files['trace.trace'])).toBe(0)
    expect(files['trace.network']).toContain('"name":"cookie"')
    expect(files['resources/a.png']).toBe('PNGDATA')
  })

  it('흔적 없는 zip 은 null(파일을 다시 쓰지 않는다)', () => {
    expect(redactZip(makeZip([{ name: 'trace.trace', text: '{"type":"before"}', deflate: true }]))).toBeNull()
  })
})
