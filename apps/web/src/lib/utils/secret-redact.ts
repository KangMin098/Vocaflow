// apps/web/src/lib/utils/secret-redact.ts
// 인증 세션 흔적(Supabase 쿠키 · JWT · 갱신 토큰) 가림 — Playwright 실패 call log · trace 가 쿠키를 평문으로 남겨
// QA 세션이 대화에 노출된 사고(2026-10-26) 뒤 e2e 산출물 보호용. 값은 돌려주지 않고 가린 본문 · 건수만 다룬다.
import { crc32 as zlibCrc32, deflateRawSync, inflateRawSync } from 'node:zlib'

const PATTERNS: Array<{ re: RegExp; keep?: true }> = [
  { re: /sb-[a-z0-9]{20}-auth-token(?:\.\d+)?=[^;\s"'\\]+/g }, // 쿠키 헤더의 이름=값
  { re: /base64-eyJ[A-Za-z0-9+/=_-]{40,}/g }, // @supabase/ssr 쿠키 값
  { re: /eyJhbGciOi[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/g }, // JWT
  { re: /("refresh_token\\?"\s*:\s*\\?")[A-Za-z0-9_-]{8,}(\\?")/g, keep: true }, // JSON(이스케이프 포함) 갱신 토큰
]
export const REDACTED = '[REDACTED]'

export function countSecrets(text: string): number {
  return PATTERNS.reduce((n, { re }) => n + (text.match(re)?.length ?? 0), 0)
}

export function redactSecrets(text: string): string {
  return PATTERNS.reduce((s, { re, keep }) => s.replace(re, (...m: string[]) => (keep ? `${m[1]}${REDACTED}${m[2]}` : REDACTED)), text)
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(buf: Buffer): number {
  if (typeof zlibCrc32 === 'function') return zlibCrc32(buf) >>> 0
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/**
 * zip(Playwright trace · html 리포트 첨부) 안의 항목을 가린다. 흔적이 없으면 null(파일을 그대로 둔다).
 * 지원: 무압축(0) · deflate(8) 항목, zip64 아님 — Playwright trace 형식. 그 밖이면 손대지 않고 null.
 */
export function redactZip(zip: Buffer): { zip: Buffer; count: number } | null {
  let eocd = -1
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 65_557); i--) {
    if (zip.readUInt32LE(i) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) return null
  const total = zip.readUInt16LE(eocd + 10)
  let p = zip.readUInt32LE(eocd + 16)
  const entries: Array<{ name: Buffer; data: Buffer; time: number; date: number }> = []
  let count = 0
  for (let i = 0; i < total; i++) {
    if (zip.readUInt32LE(p) !== 0x02014b50) return null
    const method = zip.readUInt16LE(p + 10)
    const time = zip.readUInt16LE(p + 12)
    const date = zip.readUInt16LE(p + 14)
    const csize = zip.readUInt32LE(p + 20)
    const nlen = zip.readUInt16LE(p + 28)
    const xlen = zip.readUInt16LE(p + 30)
    const clen = zip.readUInt16LE(p + 32)
    const local = zip.readUInt32LE(p + 42)
    const name = zip.subarray(p + 46, p + 46 + nlen)
    p += 46 + nlen + xlen + clen
    if (zip.readUInt32LE(local) !== 0x04034b50 || csize === 0xffffffff) return null
    const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28)
    const raw = zip.subarray(start, start + csize)
    let data: Buffer
    if (method === 0) data = Buffer.from(raw)
    else if (method === 8) data = inflateRawSync(raw)
    else return null
    const text = data.toString('latin1')
    const n = countSecrets(text)
    if (n) {
      count += n
      data = Buffer.from(redactSecrets(text), 'latin1')
    }
    entries.push({ name, data, time, date })
  }
  if (!count) return null
  const locals: Buffer[] = []
  const centrals: Buffer[] = []
  let offset = 0
  for (const e of entries) {
    const comp = deflateRawSync(e.data)
    const crc = crc32(e.data)
    const lh = Buffer.alloc(30)
    lh.writeUInt32LE(0x04034b50, 0)
    lh.writeUInt16LE(20, 4)
    lh.writeUInt16LE(0x0800, 6) // UTF-8 이름
    lh.writeUInt16LE(8, 8)
    lh.writeUInt16LE(e.time, 10)
    lh.writeUInt16LE(e.date, 12)
    lh.writeUInt32LE(crc, 14)
    lh.writeUInt32LE(comp.length, 18)
    lh.writeUInt32LE(e.data.length, 22)
    lh.writeUInt16LE(e.name.length, 26)
    const ch = Buffer.alloc(46)
    ch.writeUInt32LE(0x02014b50, 0)
    ch.writeUInt16LE(20, 4)
    ch.writeUInt16LE(20, 6)
    ch.writeUInt16LE(0x0800, 8)
    ch.writeUInt16LE(8, 10)
    ch.writeUInt16LE(e.time, 12)
    ch.writeUInt16LE(e.date, 14)
    ch.writeUInt32LE(crc, 16)
    ch.writeUInt32LE(comp.length, 20)
    ch.writeUInt32LE(e.data.length, 24)
    ch.writeUInt16LE(e.name.length, 28)
    ch.writeUInt32LE(offset, 42)
    locals.push(lh, e.name, comp)
    centrals.push(ch, e.name)
    offset += 30 + e.name.length + comp.length
  }
  const cd = Buffer.concat(centrals)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(cd.length, 12)
  end.writeUInt32LE(offset, 16)
  return { zip: Buffer.concat([...locals, cd, end]), count }
}
