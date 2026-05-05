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
  /** vocabularies UPDATE용 — cardToUpdatePayload(result.card) 결과 */
  cardUpdate: Partial<VocabularyRow>;
  /** learning_records 적재용 — FSRS 1~4 */
  rating: number;
  /** ISO timestamp */
  reviewedAt: string;
  /** 어떤 모듈에서 평가됐는지 — learning_records.module */
  module: string;
}

function readSafe(): PendingSrsResult[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PendingSrsResult[]) : [];
  } catch {
    return [];
  }
}

export function pushPendingResult(item: PendingSrsResult): void {
  if (typeof window === 'undefined') return;
  const existing = readSafe();
  existing.push(item);
  try {
    sessionStorage.setItem(KEY, JSON.stringify(existing));
  } catch {
    // quota 초과 등 — 학습 흐름은 유지, 결과만 누락
  }
}

export function getPendingResults(): PendingSrsResult[] {
  return readSafe();
}

export function clearPendingResults(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(KEY);
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
