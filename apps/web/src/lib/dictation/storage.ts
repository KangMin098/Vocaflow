// apps/web/src/lib/dictation/storage.ts
// sessionStorage 기반 임시 저장 (Phase 2 - Supabase 교체 예정)
//
// 키:
//   vocaflow:dictation:resources         - DictationResource[]
//   vocaflow:dictation:sessions          - DictationSession[]
//   vocaflow:dictation:active-session    - 현재 진행 중인 session id

import type { DictationResource, DictationSession } from './types';

const KEYS = {
  resources: 'vocaflow:dictation:resources',
  sessions: 'vocaflow:dictation:sessions',
  activeSession: 'vocaflow:dictation:active-session',
} as const;

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function safeRead<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWrite(key: string, value: unknown): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 저장 실패는 무음 */
  }
}

// ═══════ 리소스 ═══════
export function getResources(): DictationResource[] {
  return safeRead<DictationResource[]>(KEYS.resources, []);
}

export function getResource(id: string): DictationResource | undefined {
  return getResources().find((r) => r.id === id);
}

export function saveResource(resource: DictationResource): void {
  const list = getResources();
  const idx = list.findIndex((r) => r.id === resource.id);
  if (idx >= 0) list[idx] = resource;
  else list.unshift(resource);
  safeWrite(KEYS.resources, list);
}

export function deleteResource(id: string): void {
  const list = getResources().filter((r) => r.id !== id);
  safeWrite(KEYS.resources, list);
}

// ═══════ 세션 ═══════
export function getSessions(): DictationSession[] {
  return safeRead<DictationSession[]>(KEYS.sessions, []);
}

export function getSession(id: string): DictationSession | undefined {
  return getSessions().find((s) => s.id === id);
}

export function saveSession(session: DictationSession): void {
  const list = getSessions();
  const idx = list.findIndex((s) => s.id === session.id);
  if (idx >= 0) list[idx] = session;
  else list.unshift(session);
  // 최근 50개만 유지
  safeWrite(KEYS.sessions, list.slice(0, 50));
}

export function deleteSession(id: string): void {
  const list = getSessions().filter((s) => s.id !== id);
  safeWrite(KEYS.sessions, list);
}

// ═══════ 시드 데이터 ═══════
export const SEED_RESOURCES: DictationResource[] = [
  {
    id: 'seed-a2-daily',
    title: 'Daily Conversation - At a Cafe',
    script:
      'Good morning. May I take your order? I would like a latte and a chocolate muffin. Would you like that for here or to go? For here, please. That will be seven dollars and fifty cents.',
    source: 'library',
    cefr: 'A2',
    translation:
      '좋은 아침입니다. 주문하시겠어요? 라떼와 초콜릿 머핀 부탁드립니다. 매장에서 드시겠어요, 가져가시겠어요? 매장에서 먹을게요. 7달러 50센트입니다.',
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 3,
  },
  {
    id: 'seed-b1-news',
    title: 'BBC News - Climate Change',
    script:
      'Climate change is one of the most pressing issues facing humanity today. Scientists worldwide have been warning about its consequences for decades. Rising sea levels and extreme weather events are already affecting millions of people. We must act now to prevent further damage to our planet.',
    source: 'library',
    cefr: 'B1',
    translation:
      '기후 변화는 오늘날 인류가 직면한 가장 시급한 문제 중 하나입니다. 전 세계 과학자들이 수십 년 동안 그 결과에 대해 경고해 왔습니다. 해수면 상승과 극단적인 기상 현상은 이미 수백만 명에게 영향을 미치고 있습니다. 우리는 지구에 더 큰 피해가 가지 않도록 지금 행동해야 합니다.',
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 7,
  },
  {
    id: 'seed-b2-ted',
    title: 'TED Talk - The Power of Vulnerability',
    script:
      'Vulnerability is not weakness. It is our most accurate measure of courage. When we are vulnerable, we open ourselves to connection. The willingness to show up when we cannot control the outcome is what defines true bravery. This is the foundation of meaningful relationships.',
    source: 'library',
    cefr: 'B2',
    translation:
      '취약함은 약함이 아닙니다. 그것은 용기의 가장 정확한 척도입니다. 우리가 취약할 때, 우리는 연결에 자신을 엽니다. 결과를 통제할 수 없을 때 모습을 드러내려는 의지가 진정한 용기를 정의합니다. 이것이 의미 있는 관계의 토대입니다.',
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 14,
  },
];

/**
 * 첫 방문 시 시드 데이터 주입.
 * 이미 데이터가 있으면 건너뜀.
 */
export function ensureSeedResources(): void {
  if (!isBrowser()) return;
  const existing = getResources();
  if (existing.length > 0) return;
  safeWrite(KEYS.resources, SEED_RESOURCES);
}
