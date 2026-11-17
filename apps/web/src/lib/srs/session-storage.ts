// apps/web/src/lib/srs/session-storage.ts
//
// SRS 평가 결과 임시 저장 — DB 미연동 상태에서 학습 흐름을 끊지 않기 위한 브리지.
//
// DB 연동 후엔 이 파일을 호출하지 말고 곧장 Supabase로:
//   supabase.from('vocabularies').update(payload.cardUpdate).eq('id', payload.cardId)
//   supabase.from('learning_records').insert(resultToRecordPayload(result, userId))

import type { VocabularyRow } from './supabase-adapter';
import type { SrsCard } from './index';

const KEY = 'srs_pending';
const CARD_CACHE_KEY = 'srs_card_cache';

export interface PendingSrsResult {
  cardId: string;
  /** 평가된 단어 텍스트 — flush 시 (user_id, word) vocabularies lookup key */
  word: string;
  /** vocabularies UPDATE용 — cardToUpdatePayload(result.card) 결과 */
  cardUpdate: Partial<VocabularyRow>;
  /** learning_records 적재용 — FSRS 1~4 */
  rating: number;
  /** ISO timestamp */
  reviewedAt: string;
  /** 어떤 모듈에서 평가됐는지 — learning_records.module */
  module: string;
  /**
   * 평가한 계정 id(T-0172 공용 기기). 큐에 넣을 때 붙이고, flush 는 지금 계정 것만 보내고 지운다.
   * 없는 항목(옛 큐 · 계정을 끝내 모른 평가)은 누구에게도 보내지 않고 지우지도 않는다(보류).
   */
  owner?: string;
}

// ── 큐 주인(T-0172) ──────────────────────────────────────────────────────
// 같은 브라우저를 두 계정이 쓰면 공용 키의 큐가 다음 계정의 flush 로 그 계정 카드에 적용됐다.
// 주인은 flush-session 이 브라우저 세션에서 읽고 **계정 전환을 구독해**(다른 탭 로그인 · 로그아웃 포함) 늘 지금 값으로 둔다.
// 평가는 큐에 넣는 순간의 주인으로 표시한다. 주인을 모르면(세션 읽기 실패 · 로그아웃) 주인 없이 보류 — 이전 주인을 쓰지 않는다.
let queueOwner: string | null = null;

/** 서버 ACK 와 같은 자 — `flush-actions.ts` 가 같은 모양으로 돌려준다 */
export const pendingKey = (p: { word: string; reviewedAt: string; module: string }) => `${p.word}@${p.reviewedAt}@${p.module}`;

export function getSrsQueueOwner(): string | null {
  return queueOwner;
}

/** 주인 판(版) — 주인을 바꿀 때마다 는다. 늦게 온 세션 조회 응답이 그 사이의 인증 이벤트를 덮지 않게 비교한다(T-0172 r2 P1-2) */
let ownerVersion = 0;

export function getSrsOwnerVersion(): number {
  return ownerVersion;
}

export function setSrsQueueOwner(owner: string | null): void {
  queueOwner = owner;
  ownerVersion += 1;
}

function writeSafe(items: PendingSrsResult[]): void {
  try {
    if (items.length === 0) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* quota 등 — 학습 흐름은 유지 */
  }
}

/**
 * 평가 대기열은 **`localStorage`** 에 둔다 — `sessionStorage` 는 탭 수명이다.
 *
 * ── 왜 바꿨나 (실측 2026-09-05) ────────────────────────────────────────
 * flush 는 "완주" 에만 걸려 있었다. 30장 중 12장을 평가하고 ✕ 로 나가면 그 12장은
 * `sessionStorage` 에 남아 **같은 탭에서 다음 세션을 끝까지 마칠 때** 비로소 올라갔고,
 * 탭을 닫으면 영구히 사라졌다. 학습자는 공부를 했는데 SRS 에는 아무 일도 없었던 것이 된다.
 *
 * 저장소를 바꾸는 것만으로 "탭을 닫으면 사라진다" 가 사라진다 — 다음 방문에 큐가 살아
 * 있으므로 `flushPendingSession()` 이 이어서 올린다. 이탈 순간의 전송(`flushOnLeave`)과
 * 서버의 멱등 가드는 그 위에 얹힌다.
 *
 * 옛 탭에 남아 있던 `sessionStorage` 큐는 **한 번 옮기고 지운다** — 안 옮기면 이미 한
 * 평가가 조용히 버려진다.
 */
function migrateLegacyQueue(): PendingSrsResult[] {
  try {
    const legacy = sessionStorage.getItem(KEY);
    if (!legacy) return [];
    sessionStorage.removeItem(KEY);
    const parsed = JSON.parse(legacy);
    return Array.isArray(parsed) ? (parsed as PendingSrsResult[]) : [];
  } catch {
    return [];
  }
}

function readSafe(): PendingSrsResult[] {
  if (typeof window === 'undefined') return [];
  let current: PendingSrsResult[] = [];
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed)) current = parsed as PendingSrsResult[];
  } catch {
    current = [];
  }
  const legacy = migrateLegacyQueue();
  if (legacy.length === 0) return current;
  const merged = [...current, ...legacy];
  try {
    localStorage.setItem(KEY, JSON.stringify(merged));
  } catch {
    /* quota — 옮기지 못해도 이번 읽기에는 포함된다 */
  }
  return merged;
}

export function pushPendingResult(item: PendingSrsResult): void {
  if (typeof window === 'undefined') return;
  const existing = readSafe();
  const { owner: _ignored, ...rest } = item;
  void _ignored;
  existing.push(queueOwner ? { ...rest, owner: queueOwner } : rest);
  try {
    localStorage.setItem(KEY, JSON.stringify(existing));
  } catch {
    // quota 초과 등 — 학습 흐름은 유지, 결과만 누락
  }
}

/**
 * 주인을 **명시해** 넣는다 — 대기열 주인이 아직 정해지지 않았지만(null), 화면이 그 사람을 계정 경계로 **긍정 확인한** 새 평가 하나에만 쓴다
 * (lib/srs/push-owned). 전역 주인을 바꾸지 않고, 이미 쌓인 주인 없는 항목을 인수하지도 않는다 — 이 항목만 그 사람 몫으로 남는다.
 * 주인이 이미 다른 사람이면 넣지 않는다(그 사람의 큐가 되면 안 된다).
 */
export function pushPendingResultAs(item: PendingSrsResult, owner: string): void {
  if (typeof window === 'undefined') return;
  if (queueOwner !== null && queueOwner !== owner) return;
  const existing = readSafe();
  const { owner: _ignored, ...rest } = item;
  void _ignored;
  existing.push({ ...rest, owner });
  try {
    localStorage.setItem(KEY, JSON.stringify(existing));
  } catch {
    // quota 초과 등 — 학습 흐름은 유지, 결과만 누락
  }
}

/** **지금 계정의** 대기 평가만 — 다른 계정 · 주인 없는 항목은 보류라 돌려주지 않는다 */
export function getPendingResults(): PendingSrsResult[] {
  if (!queueOwner) return [];
  return readSafe().filter((p) => p.owner === queueOwner);
}

/**
 * **서버가 확인한(ACK) 항목만** 지운다 — `owner` 의 항목 중 `acked` 키에 든 것. 그 밖(미확인 · 거절 · 다른 계정 ·
 * 주인 없는 항목)은 남긴다. 원 소유자가 다시 로그인하면 그때 전송된다(T-0172).
 */
export function removeAckedResults(owner: string, acked: string[]): void {
  if (typeof window === 'undefined' || acked.length === 0) return;
  const drop = new Set(acked);
  writeSafe(readSafe().filter((p) => p.owner !== owner || !drop.has(pendingKey(p))));
}

/**
 * **지금 계정의** 대기 평가를 모두 지운다. 다른 계정 · 주인 없는 항목은 남긴다(T-0172).
 * flush 는 이 함수를 쓰지 않는다 — 서버 확인 없이 지우면 유실이다(`removeAckedResults`).
 */
export function clearPendingResults(): void {
  if (typeof window === 'undefined') return;
  const owner = queueOwner;
  if (owner) writeSafe(readSafe().filter((p) => p.owner !== owner));
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* 옛 큐가 없으면 그만이다 */
  }
}

// ─────────────────────────────────────────────────────────────────────
// 카드 캐시 — DB 미연동 상태에서 한 세션 내에 동일 단어를 여러 번 평가할 때
// stability/difficulty 가 누적되도록 sessionStorage 에 보관.
// DB 연동 후엔 vocabularies 테이블 조회로 대체.
// ─────────────────────────────────────────────────────────────────────

interface CachedCard extends Omit<SrsCard, 'lastReviewAt' | 'nextReviewAt'> {
  lastReviewAt: string | null;
  nextReviewAt: string | null;
}

function readCardCacheSafe(): Record<string, CachedCard> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = sessionStorage.getItem(CARD_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, CachedCard>) : {};
  } catch {
    return {};
  }
}

export function getCachedCard(cardId: string): SrsCard | null {
  const cache = readCardCacheSafe();
  const cached = cache[cardId];
  if (!cached) return null;
  return {
    ...cached,
    lastReviewAt: cached.lastReviewAt ? new Date(cached.lastReviewAt) : null,
    nextReviewAt: cached.nextReviewAt ? new Date(cached.nextReviewAt) : null,
  };
}

export function cacheCard(card: SrsCard): void {
  if (typeof window === 'undefined') return;
  const cache = readCardCacheSafe();
  cache[card.id] = {
    ...card,
    lastReviewAt: card.lastReviewAt ? card.lastReviewAt.toISOString() : null,
    nextReviewAt: card.nextReviewAt ? card.nextReviewAt.toISOString() : null,
  };
  try {
    sessionStorage.setItem(CARD_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // quota 초과 등 — 학습 흐름은 유지
  }
}

export function clearCardCache(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(CARD_CACHE_KEY);
}

// ─────────────────────────────────────────────────────────────────────
// 텍스트 단위 결과 — L4d ScriptQuiz 통합 검증 전용 (Plan B)
// 단어 단위 cardId 네임스페이스(srs_pending)와 분리.
// §17 [6] 인지 깊이 매트릭스 — ScriptQuiz = "텍스트 단위 검증"
// ─────────────────────────────────────────────────────────────────────

const TEXT_KEY = 'srs_text_pending';

export interface PendingTextResult {
  textId: string;
  /** 0~100 */
  accuracy: number;
  correctCount: number;
  totalCount: number;
  /** ISO timestamp */
  completedAt: string;
  module: 'scriptquiz';
}

function readTextSafe(): PendingTextResult[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(TEXT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PendingTextResult[]) : [];
  } catch {
    return [];
  }
}

export function pushPendingTextResult(item: PendingTextResult): void {
  if (typeof window === 'undefined') return;
  const existing = readTextSafe();
  existing.push(item);
  try {
    sessionStorage.setItem(TEXT_KEY, JSON.stringify(existing));
  } catch {
    // quota 초과 등 — 학습 흐름은 유지
  }
}

export function getPendingTextResults(): PendingTextResult[] {
  return readTextSafe();
}

export function clearPendingTextResults(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(TEXT_KEY);
}
