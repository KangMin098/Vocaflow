// apps/web/src/lib/library/__tests__/mark-progress.test.ts
// markChapterStarted — Workspace 진입 시 not_started 만 in_progress 로, 완료 기록은 강등하지 않는다 (T-0010)

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown>;
type Call = { method: string; args: unknown[] };

interface Query {
  table: string;
  kind: 'select' | 'update';
  payload?: Row;
  calls: Call[];
}

const state: {
  user: { id: string } | null;
  updateError: { message: string } | null;
  queries: Query[];
} = { user: null, updateError: null, queries: [] };

function makeBuilder(table: string) {
  const q: Query = { table, kind: 'select', calls: [] };
  state.queries.push(q);
  const b: Record<string, unknown> = {};
  b.eq = (...args: unknown[]) => {
    q.calls.push({ method: 'eq', args });
    return b;
  };
  b.update = (payload: Row) => {
    q.kind = 'update';
    q.payload = payload;
    return b;
  };
  b.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve({ data: null, error: q.kind === 'update' ? state.updateError : null }).then(
      resolve,
      reject,
    );
  return b;
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    from: (table: string) => makeBuilder(table),
  }),
}));

import { markChapterStarted } from '../mark-progress';

const updates = () => state.queries.filter((q) => q.kind === 'update');

describe('markChapterStarted', () => {
  beforeEach(() => {
    state.user = null;
    state.updateError = null;
    state.queries = [];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('[0] 로그인 사용자는 id·user_id·status=not_started 조건으로만 in_progress 로 바꾼다', async () => {
    state.user = { id: 'user-1' };
    await markChapterStarted('text-1');

    const ups = updates();
    expect(ups).toHaveLength(1);
    expect(ups[0].table).toBe('texts');
    expect(ups[0].payload?.status).toBe('in_progress');
    expect(typeof ups[0].payload?.updated_at).toBe('string');
    expect(ups[0].calls).toEqual([
      { method: 'eq', args: ['id', 'text-1'] },
      { method: 'eq', args: ['user_id', 'user-1'] },
      { method: 'eq', args: ['status', 'not_started'] },
    ]);
    // completed·extracted·conquered 는 status 조건에 걸리지 않아 강등될 수 없다
    for (const s of ['completed', 'extracted', 'conquered', 'in_progress']) {
      expect(ups[0].calls).not.toContainEqual({ method: 'eq', args: ['status', s] });
    }
  });

  it('[1] 비로그인이면 update 를 호출하지 않는다', async () => {
    await markChapterStarted('text-1');
    expect(updates()).toHaveLength(0);
  });

  it('[2] update 오류는 예외 없이 로그만 남긴다', async () => {
    state.user = { id: 'user-1' };
    state.updateError = { message: 'boom' };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(markChapterStarted('text-1')).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalledWith('[markChapterStarted] failed:', 'boom');
  });
});
