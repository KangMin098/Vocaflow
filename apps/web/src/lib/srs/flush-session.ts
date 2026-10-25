// apps/web/src/lib/srs/flush-session.ts
// 세션 종료 시 sessionStorage SRS 큐를 DB 로 flush 하는 클라이언트 헬퍼.
// 각 학습 모듈(Flashcard / SpellForge / Dictation)의 완료 지점에서 1회 호출.
//
// T-0172 공용 기기 — 큐는 계정별로 표시된다(`session-storage.ts` owner). 여기서는 **지금 계정의 항목만**
// 보내고 지운다. 다른 계정 · 주인 없는 항목은 보류로 남는다(원 소유자가 다시 로그인하면 그때 간다).

'use client';

import {
  getPendingResults,
  removeAckedResults,
  setSrsQueueOwner,
  getSrsQueueOwner,
  getSrsOwnerVersion,
  type PendingSrsResult,
} from './session-storage';
import { flushPendingSrsResults } from './flush-actions';
import type { FlushItem } from './flush-types';

let subscribed = false;

/**
 * 지금 로그인한 계정을 브라우저 세션(쿠키)에서 읽어 큐 주인으로 두고, 계정 전환(다른 탭 로그인 · 로그아웃)을 구독해
 * 늘 지금 값으로 유지한다. 읽지 못하면 주인을 비운다(보류) — 이전 주인을 쓰지 않는다(T-0172 r1 P1-3).
 */
export async function resolveSrsQueueOwner(): Promise<string | null> {
  const version = getSrsOwnerVersion();
  try {
    const { createClient } = await import('@/lib/supabase/client');
    const auth = createClient().auth;
    if (!subscribed) {
      subscribed = true;
      auth.onAuthStateChange((_event, session) => setSrsQueueOwner(session?.user?.id ?? null));
    }
    const { data } = await auth.getSession();
    // 기다리는 사이 인증 이벤트가 주인을 바꿨으면 이 응답은 낡았다 — 버린다(T-0172 r2 P1-2)
    if (getSrsOwnerVersion() === version) setSrsQueueOwner(data.session?.user?.id ?? null);
  } catch {
    if (getSrsOwnerVersion() === version) setSrsQueueOwner(null);
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
 * 큐를 읽어 서버로 flush. **서버가 확인(ACK)한 항목만** 비운다 — 실패 · 미확인 · 거절 항목은 남아 다음 기회에 다시 간다.
 * 다시 가도 이중 적용은 없다: 이미 적재된 평가는 서버가 (vocabulary_id, attempted_at) 로 걸러 duplicated 로 ACK 한다.
 * 빈 큐면 no-op. word 가 없는 레거시 항목은 제외.
 *
 * **응답을 기다릴 수 있을 때** 쓴다(완주 · 화면 진입). 떠나는 순간에는 `flushOnLeave()`.
 */
export async function flushPendingSession(): Promise<void> {
  const owner = await resolveSrsQueueOwner();
  if (!owner) return;
  const items = toItems(getPendingResults());
  if (items.length === 0) return;

  try {
    const res = await flushPendingSrsResults(items);
    if (res.ok) removeAckedResults(owner, res.acked ?? []);
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
 * 보낸 뒤 **큐를 지우지 않는다**(T-0172 r1 P1-4). beacon 의 true 는 전송 예약일 뿐 저장 확인이 아니다 —
 * 지우면 네트워크 실패 · 401 · 500 · 다른 계정 skip 에서 기록을 잃는다. 남은 항목은 다음 진입의 확인 전송
 * (`flushPendingSession`)이 다시 보내고 서버 ACK 로 지운다. 그 사이 이 전송이 이미 적재했으면 서버가
 * (vocabulary_id, attempted_at) 로 걸러 duplicated 로 ACK 한다 — 이중 적용은 없다(`lib/srs/flush-actions.ts`).
 * 동기 경로라 주인은 이미 정해진 값(`flushPendingSession` 이 진입 때 정함)을 쓴다 — 모르면 보내지 않는다.
 */
export function flushOnLeave(): void {
  if (typeof window === 'undefined') return;
  if (!getSrsQueueOwner()) return;
  const items = toItems(getPendingResults());
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
    } catch {
      /* 보낼 길이 없다 — 큐는 남아 다음 진입에 간다 */
    }
  }
}
