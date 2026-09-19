// apps/web/src/lib/csat/session/store.ts
//
// **기기 저장소 — 풀이 기록과 문제지 추출본.** (브라우저 전용)
//
// ⚠️ 원본 PDF 바이트는 **저장하지 않는다**(지시문 C7). 남기는 것은 회차별 추출 글과 해시다.
// ⚠️ 풀이 기록은 **기기가 먼저, 서버가 뒤**다(DECISIONS.md D18). 기기에 쓰고 곧바로 올리며, 읽을 때
//    서버와 합친다(`sync.ts`). 서버가 막혀도 세션은 기기 기록으로 돈다. 화면은 이 파일의 함수만 부른다.
// ⚠️ IndexedDB 는 사생활 모드·저장 차단·미리보기에서 **던질 수 있다.** 모든 호출을 감싸고,
//    실패하면 메모리로 버틴다 — 화면은 저장이 안 돼도 세션을 끝까지 돈다.

import type { CachedPaper } from '@/lib/csat/reflow/types'

import { EMPTY_RECORD, type Attempt, type LearnerRecord } from './model'
import { mergeRecord, unsynced } from './sync'
import { emptyDissectionRecord, type DissectionRecord } from '../dissect'

const DB_NAME = 'vocaflow-csat'
const DB_VERSION = 1
const S_RECORD = 'record'
const S_PAPERS = 'papers'
const RECORD_KEY = 'me'
const DISSECTION_KEY = 'dissection-v1'
let dissectionMemory: DissectionRecord | null = null

/** Separate key: old answer accuracy is never relabeled as prediction accuracy. */
export async function loadDissectionRecord(): Promise<DissectionRecord> {
  const stored = await run<DissectionRecord | undefined>(S_RECORD, 'readonly', s => s.get(DISSECTION_KEY))
  if (stored?.version === 1) return stored
  if (!dissectionMemory) {
    const seed = globalThis.crypto?.getRandomValues(new Uint32Array(1))[0] ?? Math.floor(Math.random() * 4294967296)
    dissectionMemory = emptyDissectionRecord(seed)
  }
  return dissectionMemory
}

export async function saveDissectionRecord(record: DissectionRecord): Promise<boolean> {
  dissectionMemory = record
  const result = await run(S_RECORD, 'readwrite', s => s.put(record, DISSECTION_KEY))
  return result !== null
}

const memory = { record: null as LearnerRecord | null, papers: new Map<string, CachedPaper>() }

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null)
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(S_RECORD)) db.createObjectStore(S_RECORD)
        if (!db.objectStoreNames.contains(S_PAPERS)) db.createObjectStore(S_PAPERS)
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
      req.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

async function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  const db = await open()
  if (!db) return null
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(store, mode)
      const req = fn(tx.objectStore(store))
      req.onerror = () => resolve(null)
      tx.oncomplete = () => { resolve(req.result); db.close() }
      tx.onabort = () => { resolve(null); db.close() }
      tx.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

async function loadLocal(): Promise<LearnerRecord> {
  const v = await run<LearnerRecord | undefined>(S_RECORD, 'readonly', (s) => s.get(RECORD_KEY))
  return v && v.version === 1 ? v : (memory.record ?? EMPTY_RECORD)
}

/** 서버 풀이 기록. 못 읽으면 null — 기기 기록만으로 계속 간다(오프라인·서버 지연). */
async function fetchServer(): Promise<Attempt[] | null> {
  try {
    const res = await fetch('/api/csat/session/record', { cache: 'no-store' })
    if (!res.ok) return null
    const json = (await res.json()) as { ok: boolean; attempts?: Attempt[] }
    return json.ok && Array.isArray(json.attempts) ? json.attempts : null
  } catch {
    return null
  }
}

/** 서버로 올린다 — 실패해도 조용히(다음 loadRecord 가 `unsynced` 로 다시 올린다) */
async function push(attempts: Attempt[]): Promise<void> {
  if (!attempts.length) return
  try {
    await fetch('/api/csat/session/record', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ attempts }),
      keepalive: true,
    })
  } catch {
    /* 기기에 남아 있다 */
  }
}

/**
 * 기록 읽기 — 기기 먼저, 서버와 합친다(2026-09-17 서버 표 적용 · DECISIONS D18).
 * 기기를 바꿔도 복습 큐가 따라온다. 서버에 없는 기기 풀이는 이때 올린다.
 */
export async function loadRecord(): Promise<LearnerRecord> {
  const local = await loadLocal()
  const server = await fetchServer()
  if (!server) {
    memory.record = local
    return local
  }
  const merged = mergeRecord(local, server)
  memory.record = merged
  await run(S_RECORD, 'readwrite', (s) => s.put(merged, RECORD_KEY))
  void push(unsynced(local.attempts, server))
  return merged
}

export async function saveRecord(rec: LearnerRecord): Promise<void> {
  const prev = memory.record
  memory.record = rec
  await run(S_RECORD, 'readwrite', (s) => s.put(rec, RECORD_KEY))
  // 새로 생긴 풀이만 올린다(온보딩 표시만 바뀐 저장은 서버에 안 간다)
  await push(unsynced(rec.attempts, prev?.attempts ?? []))
}

export async function loadPaper(examId: string, version: number): Promise<CachedPaper | null> {
  const v = (await run<CachedPaper | undefined>(S_PAPERS, 'readonly', (s) => s.get(examId))) ?? memory.papers.get(examId)
  // 추출기 규칙이 바뀌었으면 옛 추출은 쓰지 않는다 — 같은 파일을 다시 놓으면 새로 뽑는다
  return v && v.version === version ? v : null
}

export async function savePaper(p: CachedPaper): Promise<void> {
  memory.papers.set(p.exam_id, p)
  await run(S_PAPERS, 'readwrite', (s) => s.put(p, p.exam_id))
}

/** 기기에 추출본이 있는 회차 */
export async function cachedExamIds(version: number): Promise<string[]> {
  const keys = ((await run<IDBValidKey[]>(S_PAPERS, 'readonly', (s) => s.getAllKeys())) ?? []).map(String)
  const all = [...new Set([...keys, ...memory.papers.keys()])]
  const out: string[] = []
  for (const k of all) if (await loadPaper(k, version)) out.push(k)
  return out
}

/** 테스트·「기록 지우기」용 — 기기와 서버 둘 다 */
export async function clearAll(): Promise<void> {
  dissectionMemory = null
  memory.record = null
  memory.papers.clear()
  try {
    await fetch('/api/csat/session/record', { method: 'DELETE' })
  } catch {
    /* 서버 쪽은 다음에 */
  }
  await run(S_RECORD, 'readwrite', (s) => s.clear())
  await run(S_PAPERS, 'readwrite', (s) => s.clear())
}
