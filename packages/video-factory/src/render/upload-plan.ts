// packages/video-factory/src/render/upload-plan.ts
//
// **무엇을 다시 올릴지 — 크기가 아니라 내용(sha256)으로 가른다.** 순수 함수 + 해시 계산.
//
// 크기만 보면 교체 편처럼 **같은 경로 · 같은 바이트 수 · 다른 내용**인 파일(자막 한 글자 교체, 같은
// 길이의 썸네일)이 「이미 올라갔다」로 건너뛰어 버킷에 옛 편이 남는다. 그래서 올린 파일의 sha256 을
// 버킷의 `publish-sha256.txt`(JSON 본문 · 버킷이 허용하는 text/plain)에 기록하고, 다음 발행은
//   · 버킷에 그 경로가 **실제로 있고**(purge 로 지웠으면 해시 기록이 남아도 다시 올린다)
//   · 기록된 해시가 로컬 해시와 **같을 때만**
// 건너뛴다. 기록이 없으면(첫 실행) 전부 올린다 — 틀리게 건너뛰는 것보다 한 번 더 올리는 게 싸다.

import { createHash } from 'node:crypto'
import fs from 'node:fs'

export const HASH_INDEX_KEY = 'publish-sha256.txt'

export function sha256File(abs: string): string {
  return createHash('sha256').update(fs.readFileSync(abs)).digest('hex')
}

export function parseHashIndex(text: string | null): Record<string, string> {
  if (!text) return {}
  try {
    const v = JSON.parse(text) as unknown
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
    return Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([, h]) => typeof h === 'string')) as Record<
      string,
      string
    >
  } catch {
    // 깨진 기록은 없는 것으로 — 전부 다시 올린다(건너뛰는 쪽으로 틀리지 않는다)
    return {}
  }
}

export function planUploads<T extends { key: string; sha256: string }>(
  local: readonly T[],
  remoteKeys: ReadonlySet<string>,
  remoteHashes: Readonly<Record<string, string>>,
): { upload: T[]; skip: T[] } {
  const upload: T[] = []
  const skip: T[] = []
  for (const f of local) {
    if (remoteKeys.has(f.key) && remoteHashes[f.key] === f.sha256) skip.push(f)
    else upload.push(f)
  }
  return { upload, skip }
}

/** 다음 기록 — 이번에 올렸거나 확인된 것만 새 해시로, 실패한 것은 옛 기록을 지운다(다음에 다시 올리게) */
export function nextHashIndex(
  prev: Readonly<Record<string, string>>,
  ok: readonly { key: string; sha256: string }[],
  failedKeys: readonly string[],
): Record<string, string> {
  const out: Record<string, string> = { ...prev }
  for (const k of failedKeys) delete out[k]
  for (const f of ok) out[f.key] = f.sha256
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)))
}
