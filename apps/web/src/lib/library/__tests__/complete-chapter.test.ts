// apps/web/src/lib/library/__tests__/complete-chapter.test.ts
// completeChapter — texts.status='completed' 를 쓰는 유일한 경로의 계약 (T-0009)

import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  current: Row | null;
  siblings: Row[];
  siblingsError: { message: string } | null;
  updateError: { message: string } | null;
  queries: Query[];
} = { user: null, current: null, siblings: [], siblingsError: null, updateError: null, queries: [] };

function makeBuilder(table: string) {
  const q: Query = { table, kind: 'select', calls: [] };
  state.queries.push(q);
  const b: Record<string, unknown> = {};
  const chain = (method: string) => (...args: unknown[]) => {
    q.calls.push({ method, args });
    return b;
  };
  b.select = chain('select');
  b.eq = chain('eq');
  b.order = (...args: unknown[]) => {
    q.calls.push({ method: 'order', args });
    return Promise.resolve(
      state.siblingsError
        ? { data: null, error: state.siblingsError }
        : { data: state.siblings, error: null },
    );
  };
  b.maybeSingle = () => Promise.resolve({ data: state.current, error: null });
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

import { completeChapter } from '../complete-chapter';

const USER = { id: 'user-1' };
const updates = () => state.queries.filter((q) => q.kind === 'update');
const eqArgs = (q: Query) => q.calls.filter((c) => c.method === 'eq').map((c) => c.args);

const FAIL = { ok: false, alreadyCompleted: false, nextChapterTextId: null, bookCompleted: false };

beforeEach(() => {
  state.user = USER;
  state.current = null;
  state.siblings = [];
  state.siblingsError = null;
  state.updateError = null;
  state.queries = [];
});

describe('completeChapter — [0] 거부 경로', () => {
  it('비로그인이면 ok:false 이고 texts 를 건드리지 않는다', async () => {
    state.user = null;
    expect(await completeChapter('t1')).toEqual(FAIL);
    expect(state.queries).toHaveLength(0);
  });

  it('남의 text·없는 text(조회 결과 없음)면 ok:false, update 없음 · 조회는 user_id 로 묶인다', async () => {
    state.current = null;
    expect(await completeChapter('t-other')).toEqual(FAIL);
    expect(updates()).toHaveLength(0);
    expect(eqArgs(state.queries[0])).toEqual([
      ['id', 't-other'],
      ['user_id', USER.id],
    ]);
  });

  it('update 오류면 ok:false', async () => {
    state.current = { id: 't1', library_book_id: null, chapter_idx: null, status: 'in_progress' };
    state.updateError = { message: 'boom' };
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(await completeChapter('t1')).toEqual(FAIL);
  });
});

describe('completeChapter — [1] 완료 기록', () => {
  it('미완료 text 를 completed · progress 100 으로 user_id 조건과 함께 update', async () => {
    state.current = { id: 't1', library_book_id: null, chapter_idx: null, status: 'in_progress' };
    const r = await completeChapter('t1');
    expect(r).toEqual({ ok: true, alreadyCompleted: false, nextChapterTextId: null, bookCompleted: false });
    const u = updates();
    expect(u).toHaveLength(1);
    expect(u[0].table).toBe('texts');
    expect(u[0].payload).toMatchObject({ status: 'completed', progress_percent: 100 });
    expect(typeof u[0].payload?.updated_at).toBe('string');
    expect(eqArgs(u[0])).toEqual([
      ['id', 't1'],
      ['user_id', USER.id],
    ]);
  });
});

describe('completeChapter — [2] 멱등', () => {
  it('이미 completed 면 update 를 다시 부르지 않고 alreadyCompleted:true', async () => {
    state.current = { id: 't1', library_book_id: null, chapter_idx: null, status: 'completed' };
    const r = await completeChapter('t1');
    expect(r).toEqual({ ok: true, alreadyCompleted: true, nextChapterTextId: null, bookCompleted: false });
    expect(updates()).toHaveLength(0);
  });
});

describe('completeChapter — [3] 도서 챕터', () => {
  it('다음 미완료 챕터 id 를 돌려주고 남은 챕터가 있으면 bookCompleted:false', async () => {
    state.current = { id: 'c2', library_book_id: 'b1', chapter_idx: 2, status: 'in_progress' };
    state.siblings = [
      { id: 'c1', chapter_idx: 1, status: 'completed' },
      { id: 'c2', chapter_idx: 2, status: 'in_progress' },
      { id: 'c3', chapter_idx: 3, status: 'not_started' },
    ];
    const r = await completeChapter('c2');
    expect(r).toEqual({ ok: true, alreadyCompleted: false, nextChapterTextId: 'c3', bookCompleted: false });
    const sib = state.queries[state.queries.length - 1];
    expect(eqArgs(sib)).toEqual([
      ['user_id', USER.id],
      ['library_book_id', 'b1'],
    ]);
    expect(sib.calls.find((c) => c.method === 'order')?.args).toEqual([
      'chapter_idx',
      { ascending: true },
    ]);
  });

  it('형제 목록의 자기 status 가 아직 낡아도 마지막 챕터면 bookCompleted:true', async () => {
    state.current = { id: 'c3', library_book_id: 'b1', chapter_idx: 3, status: 'in_progress' };
    state.siblings = [
      { id: 'c1', chapter_idx: 1, status: 'completed' },
      { id: 'c2', chapter_idx: 2, status: 'completed' },
      { id: 'c3', chapter_idx: 3, status: 'in_progress' },
    ];
    expect(await completeChapter('c3')).toEqual({
      ok: true,
      alreadyCompleted: false,
      nextChapterTextId: null,
      bookCompleted: true,
    });
  });

  it('이미 완료한 챕터를 다시 열어도 앞쪽 미완료 챕터를 다음으로 준다', async () => {
    state.current = { id: 'c3', library_book_id: 'b1', chapter_idx: 3, status: 'completed' };
    state.siblings = [
      { id: 'c1', chapter_idx: 1, status: 'not_started' },
      { id: 'c2', chapter_idx: 2, status: 'completed' },
      { id: 'c3', chapter_idx: 3, status: 'completed' },
    ];
    expect(await completeChapter('c3')).toEqual({
      ok: true,
      alreadyCompleted: true,
      nextChapterTextId: 'c1',
      bookCompleted: false,
    });
    expect(updates()).toHaveLength(0);
  });

  it('형제 챕터 조회 실패면 완료 기록(ok)은 유지하되 bookCompleted:false · next null (T-0012)', async () => {
    state.current = { id: 'c2', library_book_id: 'b1', chapter_idx: 2, status: 'in_progress' };
    state.siblingsError = { message: 'siblings boom' };
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(await completeChapter('c2')).toEqual({
      ok: true,
      alreadyCompleted: false,
      nextChapterTextId: null,
      bookCompleted: false,
    });
    expect(updates()).toHaveLength(1);
  });
});
