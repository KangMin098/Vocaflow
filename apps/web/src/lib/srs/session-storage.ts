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
  existing.push(item);
  try {
    localStorage.setItem(KEY, JSON.stringify(existing));
  } catch {
    // quota 초과 등 — 학습 흐름은 유지, 결과만 누락
  }
}

export function getPendingResults(): PendingSrsResult[] {
  return readSafe();
}

export function clearPendingResults(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(KEY);
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
