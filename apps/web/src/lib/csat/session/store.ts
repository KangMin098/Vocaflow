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
import { mergeDissection, sameRecord } from '../continuity'

const DB_NAME = 'vocaflow-csat'
const DB_VERSION = 1
const S_RECORD = 'record'
const S_PAPERS = 'papers'
const RECORD_KEY = 'me'
// T-0172 공용 기기 — 해부 기록은 **로그인한 계정별 키**(`dissection-v1:<user id>`)에 둔다.
// 옛 공용 키 `dissection-v1`(소유자를 증명할 수 없는 기록)은 읽지도 · 병합하지도 · 지우지도 않는다(보류 · docs/r0/shared-device/REPORT.md).
const DISSECTION_KEY_PREFIX = 'dissection-v1:'
let dissectionMemory: DissectionRecord | null = null
/** dissectionMemory 의 주인 — 계정이 바뀌면 메모리 사본만 버린다(기기 저장소는 그대로) */
let memoryOwner: string | null = null

/**
 * 인증 세대 — 계정이 바뀔 때마다(다른 탭 로그인 · 로그아웃 포함, onAuthStateChange) 1 씩 는다.
 * 서버 응답을 기다리는 사이 세대가 바뀌면 그 응답은 버린다(T-0172 r1 P1-2).
 */
let authGeneration = 0
let authUser: string | null | undefined
let subscribed = false
/** 인증 이벤트 순번 — getSession 을 기다리는 사이 이벤트가 오면 늦게 온 응답 대신 이벤트 값을 쓴다(T-0172 r2 P1-2) */
let authEventSeq = 0

/**
 * 기록 결속(T-0172 r2 P1-1) — 이 모듈이 내준 기록에 「읽힌 순간의 주인 · 인증 세대」를 심볼 키로 붙인다.
 * 심볼 키는 화면의 `{ ...record }` 복사에는 따라가고, IndexedDB(structured clone) · JSON 전송에는 실리지 않는다.
 * 저장 때 지금 주인 · 세대와 다르면 저장 · 전송을 거부한다 — 다른 계정이 쥐고 있던 기록이 새 계정 키로 재결속되지 않는다.
 */
const BINDING = Symbol('csat-dissection-owner')
type Binding = { owner: string | null; generation: number }

function bind<T extends DissectionRecord>(record: T, owner: string | null): T {
  Object.defineProperty(record, BINDING, { value: { owner, generation: authGeneration } satisfies Binding, enumerable: true, configurable: true, writable: true })
  return record
}

function bindingOf(record: DissectionRecord): Binding | undefined {
  return (record as unknown as Record<symbol, Binding | undefined>)[BINDING]
}

/** 지금 로그인한 계정 id — 브라우저 세션(쿠키)에서 읽는다(네트워크 없음). 모르면 null */
async function currentOwner(): Promise<string | null> {
  try {
    const { createClient } = await import('@/lib/supabase/client')
    const auth = createClient().auth
    if (!subscribed) {
      subscribed = true
      auth.onAuthStateChange((_event, session) => { authEventSeq += 1; noteAuthUser(session?.user?.id ?? null) })
    }
    const seq = authEventSeq
    const { data } = await auth.getSession()
    // 기다리는 사이 인증 이벤트가 왔으면 이 응답은 낡았다 — 이벤트가 남긴 최신 값을 쓴다
    if (authEventSeq !== seq) return authUser ?? null
    const id = data.session?.user?.id ?? null
    noteAuthUser(id)
    return id
  } catch {
    return null
  }
}

function noteAuthUser(id: string | null) {
  if (authUser !== undefined && authUser !== id) authGeneration += 1
  authUser = id
}

async function ownedMemory(): Promise<string | null> {
  const owner = await currentOwner()
  if (owner !== memoryOwner) {
    dissectionMemory = null
    memoryOwner = owner
  }
  return owner
}

/** Separate key: old answer accuracy is never relabeled as prediction accuracy. */
export async function loadDissectionRecord(): Promise<DissectionRecord> {
  return loadFor(await ownedMemory())
}

/** 주인을 고정해 읽는다 — 읽는 도중 계정이 바뀌어도 다른 계정 키를 읽지 않는다 */
async function loadFor(owner: string | null): Promise<DissectionRecord> {
  const generation = authGeneration
  if (owner !== memoryOwner) return bind(freshRecord(), null)
  // 계정을 모르면 기기 저장소를 읽지 않는다 — 다른 계정의 기록일 수 있다
  const stored = owner ? await run<DissectionRecord | undefined>(S_RECORD, 'readonly', s => s.get(DISSECTION_KEY_PREFIX + owner)) : null
  // 읽는 사이 계정이 바뀌었으면 읽은 기록을 내주지 않는다(빈 기록 · 결속 없음 → 저장 거부)
  if (authGeneration !== generation) return bind(freshRecord(), null)
  if (stored?.version === 1) return bind(stored, owner)
  if (!dissectionMemory) dissectionMemory = freshRecord()
  return bind(dissectionMemory, owner)
}

function freshRecord(): DissectionRecord {
  const seed = globalThis.crypto?.getRandomValues(new Uint32Array(1))[0] ?? Math.floor(Math.random() * 4294967296)
  return emptyDissectionRecord(seed)
}

/**
 * 화면이 쥐고 있던 기록을 저장한다. 기록이 읽힌 주인이 지금 계정과 다르면 **거부**한다(false — 화면은 「이 기기에만」).
 * 원 소유자 키의 기록은 건드리지 않으므로 그 계정이 다시 로그인하면 그대로 있다(T-0172 r2 P1-1).
 * 같은 주인이 돌아오면(다른 탭 로그아웃 → 재로그인, A→B→A) 다시 저장된다 — 기록은 A 키에만 가고 B 의 쓰기는 B 키에 있다(r3 P1).
 * 인증 세대는 저장 허가가 아니라 **진행 중인 비동기 응답의 폐기**(읽기 · GET · 세션 조회)에만 쓴다.
 */
export async function saveDissectionRecord(record: DissectionRecord): Promise<boolean> {
  const owner = await ownedMemory()
  if (!boundTo(record, owner)) return false
  return saveFor(owner, record)
}

/** 기록이 지금 주인에게 결속돼 있는가(주인 동일성). 결속 없는 기록은 주인을 모를 때(메모리 전용)만 받는다 */
function boundTo(record: DissectionRecord, owner: string | null): boolean {
  const b = bindingOf(record)
  if (!b) return owner === null
  return b.owner === owner
}

/** 주인을 고정해 쓴다 — 그 사이 계정이 바뀌었으면 쓰지도 · 보내지도 않는다(기록은 호출부 손에 남는다) */
async function saveFor(owner: string | null, record: DissectionRecord): Promise<boolean> {
  if (owner !== memoryOwner) return false
  const stamped = bind({ ...record, updatedAt: Date.now() }, owner)
  dissectionMemory = stamped
  // 계정을 모르면 메모리에만 둔다(저장 실패로 알린다) — 공용 키에 쓰면 다음 계정이 읽는다
  const result = owner ? await run(S_RECORD, 'readwrite', s => s.put(stamped, DISSECTION_KEY_PREFIX + owner)) : null
  retries = 0
  schedulePush(stamped, owner)
  return result !== null
}

// 탭 안의 읽기→고치기→쓰기를 한 줄로 세운다(G0 계약 §4). 열람 저장과 확정 저장이 거의 동시에
// 일어나면 각자 옛 기록을 읽고 써서 한쪽이 사라졌다 — 이제 모든 변경은 이 함수 하나로 간다.
let writeChain: Promise<unknown> = Promise.resolve()

/**
 * 기록을 고친다. `fn` 이 같은 객체를 돌려주면(멱등 — 이미 마친 세션 등) 저장하지 않는다.
 * 돌려주는 값은 고친 뒤의 기록과 저장 성공 여부.
 */
export function updateDissectionRecord(fn: (record: DissectionRecord) => DissectionRecord): Promise<{ record: DissectionRecord; saved: boolean }> {
  return updateFor(null, fn)
}

/** `owner` 를 주면 그 주인에 고정한다(지금 계정이 다르면 고치지 않는다). null 이면 지금 계정 */
function updateFor(fixed: string | null, fn: (record: DissectionRecord) => DissectionRecord): Promise<{ record: DissectionRecord; saved: boolean }> {
  const next = writeChain.then(async () => {
    const owner = await ownedMemory()
    if (fixed !== null && owner !== fixed) return { record: await loadFor(owner), saved: false }
    const current = await loadFor(owner)
    // 읽은 기록이 지금 주인에게 결속되지 않았으면(읽는 사이 전환 — loadFor 가 결속 없는 빈 기록을 준다) 고치지 않는다
    if (owner !== null && !boundTo(current, owner)) return { record: current, saved: false }
    const changed = fn(current)
    if (changed === current) return { record: current, saved: true }
    const saved = await saveFor(owner, bind(changed, owner))
    return { record: dissectionMemory ?? changed, saved }
  })
  writeChain = next.catch(() => undefined)
  return next
}

// ── 동기화 상태(레코드 밖 · G0 계약 §3) ─────────────────────────────────────
// 화면이 「이 기기에만 저장 중」을 판단할 재료. 레코드에 넣지 않는다 — 넣으면 병합 대상이 된다.
let syncState: { okAt: number | null; failAt: number | null } = { okAt: null, failAt: null }

export function syncStatus(): { okAt: number | null; failAt: number | null } {
  return { ...syncState }
}

function markSync(ok: boolean) {
  syncState = ok ? { ...syncState, okAt: Date.now() } : { ...syncState, failAt: Date.now() }
}

// ── 서버 동기화(ia-design §3-1 · `/api/csat/state`) ────────────────────────────
// 기기가 먼저다. 서버는 **다른 기기에서 이어지게** 하는 사본이다 — 막히면 조용히 기기 기록으로 돈다.
// 쓰기는 1.5초 모아서 한 번(해부 한 문항에 저장이 여러 번 일어난다). 탭을 닫을 때는 keepalive.

let pushTimer: ReturnType<typeof setTimeout> | null = null
let pending: DissectionRecord | null = null
/** 예약된 기록의 주인 — 전송 때 함께 보낸다 */
let pendingOwner: string | null = null
/** 연속 실패(409 · 네트워크) 재전송 횟수 — 성공하거나 새 저장이 오면 0. 상한에 닿으면 멈추고 「이 기기에만」으로 남긴다 */
let retries = 0
/** FI-015 재전송 상한 · 간격(1.5s → 3s → 6s → 12s → 24s). 상한 뒤에도 기기 기록은 남고, 다음 저장 · 다음 진입 동기화가 다시 합친다 */
export const PUSH_RETRY_MAX = 5
export const pushDelay = (n: number) => 1500 * 2 ** Math.min(n, PUSH_RETRY_MAX - 1)

/** `owner` 를 함께 보낸다 — 서버는 로그인한 계정과 다르면 403 으로 거절한다(T-0172 · 재전송 안 함) */
async function putServer(record: DissectionRecord, owner: string | null): Promise<boolean> {
  try {
    const res = await fetch('/api/csat/state', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(owner ? { owner, record } : { record }),
      keepalive: true,
    })
    markSync(res.ok)
    // FI-015 — 다른 기기가 먼저 써서 비교 갱신이 밀렸다(409). 이 기록은 서버에 아직 안 합쳐졌으니 간격을 늘려 다시 보낸다
    //   (서버가 그때 최신 사본과 다시 합친다). 그 사이 새 저장이 오면 그 기록이 대신 간다 — 기기 기록은 언제나 남아 있다
    if (res.ok) retries = 0
    else if (res.status === 409 || res.status >= 500) retryLater(record, owner)
    return res.ok
  } catch {
    // 네트워크 오류도 같은 재전송 — 기기 기록은 이미 IndexedDB 에 있다(saveDissectionRecord 가 먼저 쓴다)
    markSync(false)
    retryLater(record, owner)
    return false
  }
}

function retryLater(record: DissectionRecord, owner: string | null) {
  if (pending || retries >= PUSH_RETRY_MAX) return
  retries += 1
  schedulePush(record, owner, pushDelay(retries))
}

function schedulePush(record: DissectionRecord, owner: string | null, delay = 1500) {
  if (typeof window === 'undefined') return
  pending = record
  pendingOwner = owner
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    pushTimer = null
    const next = pending
    pending = null
    if (next) void putServer(next, pendingOwner)
  }, delay)
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    if (pending) void putServer(pending, pendingOwner)
    pending = null
  })
}

/** `owner` 의 서버 사본 — 응답의 주인이 다르면(그 사이 계정 전환) 못 읽은 것으로 친다 */
async function fetchServerState(owner: string | null): Promise<DissectionRecord | null | 'unavailable'> {
  try {
    const res = await fetch('/api/csat/state', { cache: 'no-store' })
    if (!res.ok) return 'unavailable'
    const json = (await res.json()) as { ok: boolean; owner?: string; record?: DissectionRecord | null }
    if (!json.ok || !owner || json.owner !== owner) return 'unavailable'
    return json.record && json.record.version === 1 ? json.record : null
  } catch {
    return 'unavailable'
  }
}

/**
 * 기기 기록을 읽고 서버 사본과 **항목 단위로** 합친다. 합친 결과가 기기와 다르면 기기에 쓰고,
 * 서버와 다르면 서버에 올린다. 서버가 막혀 있으면 기기 기록을 그대로 돌려준다.
 */
export async function loadSyncedDissectionRecord(): Promise<{ record: DissectionRecord; synced: boolean }> {
  // 읽기 · 병합 · 쓰기 전체를 시작 때의 주인과 인증 세대에 고정한다(T-0172 r1 P1-2)
  const owner = await ownedMemory()
  const generation = authGeneration
  const local = await loadFor(owner)
  const server = await fetchServerState(owner)
  const switched = async () => authGeneration !== generation || (await currentOwner()) !== owner
  if (await switched()) return { record: await loadDissectionRecord(), synced: false }
  if (server === 'unavailable') return { record: local, synced: false }
  if (!server) {
    if (local.predictions.length || local.completed.length || local.formulas.length || local.queue.length || (local.views ?? []).length || local.active || (local.sessions ?? []).length) void putServer(local, owner)
    return { record: local, synced: true }
  }
  // 기기 쪽 쓰기도 직렬화 큐로 — 서버 응답을 기다리는 사이 저장된 세션·예측을 덮지 않게, 쓰는 순간의
  // **최신 기기 기록**과 다시 합친다(Codex 리뷰 P1 · G0 계약 §4)
  if (!owner) return { record: local, synced: false }
  const { record: merged, saved } = await updateFor(owner, (current) => {
    const m = mergeDissection(current, server)
    return sameRecord(m, current) ? current : m
  })
  if (!saved || (await switched())) return { record: await loadDissectionRecord(), synced: false }
  if (!sameRecord(merged, server)) void putServer(merged, owner)
  return { record: merged, synced: true }
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
  memoryOwner = null
  memory.record = null
  memory.papers.clear()
  try {
    await fetch('/api/csat/session/record', { method: 'DELETE' })
    await fetch('/api/csat/state', { method: 'DELETE' })
  } catch {
    /* 서버 쪽은 다음에 */
  }
  await run(S_RECORD, 'readwrite', (s) => s.clear())
  await run(S_PAPERS, 'readwrite', (s) => s.clear())
}
