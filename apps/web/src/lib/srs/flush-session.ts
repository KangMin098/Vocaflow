// apps/web/src/lib/srs/flush-session.ts
// 세션 종료 시 sessionStorage SRS 큐를 DB 로 flush 하는 클라이언트 헬퍼.
// 각 학습 모듈(Flashcard / SpellForge / Dictation)의 완료 지점에서 1회 호출.

'use client';

import { getPendingResults, clearPendingResults } from './session-storage';
import { flushPendingSrsResults } from './flush-actions';
import type { FlushItem } from './flush-types';

/**
 * 큐를 읽어 서버로 flush. 성공 시에만 큐를 비운다(실패 시 다음 기회 재시도 — 데이터 보존).
 * 빈 큐면 no-op. word 가 없는 레거시 항목은 제외.
 */
export async function flushPendingSession(): Promise<void> {
  const pending = getPendingResults();
  if (pending.length === 0) return;

  const items: FlushItem[] = pending
    .filter((p) => typeof p.word === 'string' && p.word.length > 0)
    .map((p) => ({
      word: p.word,
      rating: p.rating,
      reviewedAt: p.reviewedAt,
      module: p.module,
    }));

  if (items.length === 0) return;

  try {
    const res = await flushPendingSrsResults(items);
    if (res.ok) clearPendingResults();
  } catch {
    // 네트워크/서버 오류 — 큐 보존(다음 완료 또는 재진입 시 재시도). 학습 흐름은 끊지 않는다.
  }
}
