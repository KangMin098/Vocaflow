// apps/web/src/lib/csat/session/store.ts
//
// **기기 저장소 — 풀이 기록과 문제지 추출본.** (브라우저 전용)
//
// ⚠️ 원본 PDF 바이트는 **저장하지 않는다**(지시문 C7). 남기는 것은 회차별 추출 글과 해시다.
// ⚠️ 풀이 기록이 여기(기기)에만 있는 것은 **임시 결정**이다(DECISIONS.md D7) — 서버 테이블
//    마이그레이션이 승인되면 이 인터페이스 뒤에 서버 어댑터를 둔다. 화면은 이 파일의 함수만 부른다.
// ⚠️ IndexedDB 는 사생활 모드·저장 차단·미리보기에서 **던질 수 있다.** 모든 호출을 감싸고,
//    실패하면 메모리로 버틴다 — 화면은 저장이 안 돼도 세션을 끝까지 돈다.

import type { CachedPaper } from '@/lib/csat/reflow/types'

import { EMPTY_RECORD, type LearnerRecord } from './model'

const DB_NAME = 'vocaflow-csat'
const DB_VERSION = 1
const S_RECORD = 'record'
const S_PAPERS = 'papers'
const RECORD_KEY = 'me'

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
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
      tx.oncomplete = () => db.close()
    } catch {
      resolve(null)
    }
  })
}

export async function loadRecord(): Promise<LearnerRecord> {
  const v = await run<LearnerRecord | undefined>(S_RECORD, 'readonly', (s) => s.get(RECORD_KEY))
  const rec = v && v.version === 1 ? v : (memory.record ?? EMPTY_RECORD)
  memory.record = rec
  return rec
}

export async function saveRecord(rec: LearnerRecord): Promise<void> {
  memory.record = rec
  await run(S_RECORD, 'readwrite', (s) => s.put(rec, RECORD_KEY))
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

/** 테스트·「기기에서 지우기」용 */
export async function clearAll(): Promise<void> {
  memory.record = null
  memory.papers.clear()
  await run(S_RECORD, 'readwrite', (s) => s.clear())
  await run(S_PAPERS, 'readwrite', (s) => s.clear())
}
