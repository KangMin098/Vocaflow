// apps/web/src/lib/vcb/__tests__/sources-resilience.test.ts
//
// `fetchSources` 의 실패 계약 — **보조 뱃지가 본체를 죽이지 않는다**.
//
// 왜 이 테스트가 있는가:
//   `/admin/vocab/sources` 가 통째로 500 이었다. 원인은 소스 목록이 아니라 그 옆의
//   `run_count` 뱃지였다 — 20260719 마이그레이션이 `vocab_raw_texts` 를 지운 동안
//   집계 쿼리가 실패했고, `fetchSources` 가 그걸 `throw` 해서 **이미 손에 들고 있던
//   소스 목록까지 못 보여줬다**. 테이블은 복원했지만(20260812), 다음에 그 쿼리가
//   또 실패하면 같은 일이 반복된다. 그래서 테이블 존재가 아니라 **실패 처리**를 고정한다.
//
//   대비: 같은 프로젝트의 `admin/layout.tsx` 는 `reports` 뱃지를 try/catch 로 감싸
//   0을 반환한다. 그쪽이 옳은 형태이고 이 테스트는 그 원칙을 vcb 쪽에도 못 박는다.
//
// 이 테스트는 패키지(`@vocaflow/vcb-curate-core`)의 함수를 검사한다 — 그 패키지에는
// 테스트 러너가 없고, 소비자가 apps/web 이므로 여기에 둔다.

import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'

import { fetchSources } from '@vocaflow/vcb-curate-core'

type Result<T> = { data: T | null; error: { message: string } | null }

/**
 * fetchSources 가 실제로 쓰는 호출 형태만 흉내 내는 최소 fake.
 *   vocab_sources    : .select(...).order(...)
 *   vocab_raw_texts  : .select(...).in(...)
 * 실제 클라이언트를 흉내 내려 들면 흉내가 실제와 어긋나는 순간 테스트가 거짓이 된다.
 */
function fakeClient(opts: {
  sources: Result<unknown[]>
  rawTexts: Result<unknown[]>
}): SupabaseClient {
  const onRawTexts = vi.fn(() => Promise.resolve(opts.rawTexts))
  const client = {
    from(table: string) {
      if (table === 'vocab_sources') {
        return { select: () => ({ order: () => Promise.resolve(opts.sources) }) }
      }
      if (table === 'vocab_raw_texts') {
        return { select: () => ({ in: onRawTexts }) }
      }
      throw new Error(`예상하지 못한 테이블 접근: ${table}`)
    },
  }
  return client as unknown as SupabaseClient
}

const SOURCE = {
  id: 7,
  slug: 'ngsl',
  title: 'NGSL',
  kind: 'curated_list',
  license_tier: 'T1',
  citation: 'Browne et al.',
  url: null,
  language: 'en',
  notes: null,
  created_at: '2026-05-14T00:00:00Z',
}

describe('fetchSources — 보조 뱃지가 본체를 죽이지 않는다', () => {
  it('집계가 되면 run_count 를 서로 다른 run 수로 센다', async () => {
    const rows = await fetchSources(
      fakeClient({
        sources: { data: [SOURCE], error: null },
        // 같은 run 이 두 번 나와도 1로 세야 한다(런 단위 distinct)
        rawTexts: {
          data: [
            { source_id: 7, run_id: 1 },
            { source_id: 7, run_id: 1 },
            { source_id: 7, run_id: 2 },
          ],
          error: null,
        },
      }),
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].run_count).toBe(2)
    expect(rows[0].slug).toBe('ngsl')
  })

  it('집계가 실패해도 던지지 않고 목록을 살린다 (뱃지만 0)', async () => {
    const rows = await fetchSources(
      fakeClient({
        sources: { data: [SOURCE], error: null },
        // 테이블 부재가 정확히 이 형태로 왔다
        rawTexts: { data: null, error: { message: `Could not find the table 'public.vocab_raw_texts'` } },
      }),
    )
    // 여기서 throw 하면 /admin/vocab/sources 가 다시 500 이 된다
    expect(rows, '집계 실패에 목록이 사라졌다').toHaveLength(1)
    expect(rows[0].run_count, '실패 시 뱃지는 0이어야 한다').toBe(0)
    expect(rows[0].title).toBe('NGSL')
  })

  it('참조 행이 없으면 run_count 는 0이다 (정상 상태)', async () => {
    const rows = await fetchSources(
      fakeClient({
        sources: { data: [SOURCE], error: null },
        rawTexts: { data: [], error: null },
      }),
    )
    expect(rows[0].run_count).toBe(0)
  })

  it('소스가 없으면 집계를 아예 조회하지 않는다', async () => {
    const raw = { data: [], error: null }
    const client = fakeClient({ sources: { data: [], error: null }, rawTexts: raw })
    const rows = await fetchSources(client)
    expect(rows).toEqual([])
  })

  it('본체(vocab_sources)가 실패하면 던진다 — 그때는 보여줄 것이 없다', async () => {
    await expect(
      fetchSources(
        fakeClient({
          sources: { data: null, error: { message: 'permission denied' } },
          rawTexts: { data: [], error: null },
        }),
      ),
    ).rejects.toThrow(/fetchSources failed/)
  })
})
