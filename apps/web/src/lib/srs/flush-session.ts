// apps/web/src/lib/srs/flush-session.ts
// 세션 종료 시 sessionStorage SRS 큐를 DB 로 flush 하는 클라이언트 헬퍼.
// 각 학습 모듈(Flashcard / SpellForge / Dictation)의 완료 지점에서 1회 호출.
//
// T-0172 공용 기기 — 큐는 계정별로 표시된다(`session-storage.ts` owner). 여기서는 **지금 계정의 항목만**
// 보내고 지운다. 다른 계정 · 주인 없는 항목은 보류로 남는다(원 소유자가 다시 로그인하면 그때 간다).

'use client';

import {
  getPendingResults,
  clearPendingResults,
  setSrsQueueOwner,
  getSrsQueueOwner,
  type PendingSrsResult,
} from './session-storage';
import { flushPendingSrsResults } from './flush-actions';
import type { FlushItem } from './flush-types';

/** 지금 로그인한 계정을 브라우저 세션(쿠키)에서 읽어 큐 주인으로 둔다. 읽지 못하면 그대로 둔다 */
export async function resolveSrsQueueOwner(): Promise<string | null> {
  try {
    const { createClient } = await import('@/lib/supabase/client');
    const { data } = await createClient().auth.getSession();
    setSrsQueueOwner(data.session?.user?.id ?? null);
  } catch {
    /* 세션을 못 읽으면 보내지 않는다 — 보류가 유실보다 낫다 */
  }
  return getSrsQueueOwner();
}

/** 큐 → 전송 항목. 두 경로(확인 전송 · 이탈 전송)가 같은 자를 쓰게 한다. */
function toItems(pending: PendingSrsResult[]): FlushItem[] {
  return pending
    .filter((p) => typeof p.word === 'string' && p.word.length > 0)
    .map((p) => ({
      word: p.word,
      rating: p.rating,
      reviewedAt: p.reviewedAt,
      module: p.module,
      owner: p.owner,
    }));
}

/**
 * 큐를 읽어 서버로 flush. 성공 시에만 보낸 항목을 비운다(실패 시 다음 기회 재시도 — 데이터 보존).
 * 빈 큐면 no-op. word 가 없는 레거시 항목은 제외.
 *
 * **응답을 기다릴 수 있을 때** 쓴다(완주 · 화면 진입). 떠나는 순간에는 `flushOnLeave()`.
 */
export async function flushPendingSession(): Promise<void> {
  await resolveSrsQueueOwner();
  const pending = getPendingResults();
  const items = toItems(pending);
  if (items.length === 0) return;

  try {
    const res = await flushPendingSrsResults(items);
    if (res.ok) clearPendingResults(pending);
  } catch {
    // 네트워크/서버 오류 — 큐 보존(다음 완료 또는 재진입 시 재시도). 학습 흐름은 끊지 않는다.
  }
}

/**
 * **떠나는 순간** 큐를 보낸다 — 동기적으로 시작하고 응답을 기다리지 않는다.
 *
 * `pagehide` · 탭 숨김 · 세션 화면 언마운트(SPA 이동)에서 부른다. 그 순간에는 server action
 * 이 완주한다는 보장이 없어서(문서가 버려지면 진행 중 요청도 버려진다) `sendBeacon` 을 쓴다.
 *
 * 보낸 뒤 **보낸 항목을 비운다.** 응답을 못 받으므로 "성공 후 비우기" 가 원리적으로 불가능하고,
 * 안 비우면 같은 항목이 방문마다 다시 실려 큐가 무한히 자란다. 이중 적용은 서버가
 * (vocabulary_id, attempted_at) 로 막는다 — `lib/srs/flush-actions.ts` 참조.
 * 동기 경로라 주인은 이미 정해진 값(`flushPendingSession` 이 진입 때 정함)을 쓴다 — 모르면 보내지 않는다.
 */
export function flushOnLeave(): void {
  if (typeof window === 'undefined') return;
  const pending = getPendingResults();
  const items = toItems(pending);
  if (items.length === 0) return;
  const body = JSON.stringify({ items });

  let sent = false;
  try {
    sent = navigator.sendBeacon(
      '/api/srs/flush',
      new Blob([body], { type: 'application/json' }),
    );
  } catch {
    sent = false;
  }
  if (!sent) {
    // beacon 이 막힌 환경(용량 초과 · 정책) — keepalive fetch 로 한 번 더.
    try {
      void fetch('/api/srs/flush', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        keepalive: true,
      });
      sent = true;
    } catch {
      sent = false;
    }
  }
  if (sent) clearPendingResults(pending);
}
