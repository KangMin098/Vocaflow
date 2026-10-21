// apps/web/src/app/admin/csat/__tests__/source-summary-error.test.tsx
import { renderToString } from 'react-dom/server'
import useSWR from 'swr'
import { beforeEach, expect, it, vi } from 'vitest'
import { SourceQueryConsole } from '../sources/SourceQueryConsole'
import { SourceOperations } from '../sources/SourceOperations'
import { SourceProcess } from '../sources/SourceProcess'

vi.mock('swr', () => ({ default: vi.fn(), mutate: vi.fn() }))
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useSWR).mockReturnValue({ data: undefined, error: new Error('unavailable'), isLoading: false, isValidating: false, mutate: vi.fn() })
})

it('사유 집계가 아직 없으면 내용 반려를 0으로 그리지 않는다', () => {
  vi.mocked(useSWR).mockReturnValue({ data: undefined, error: undefined, isLoading: true, isValidating: true, mutate: vi.fn() })
  vi.mocked(useSWR).mockReturnValueOnce({ data: { counts: {}, metrics: {} }, error: undefined, isLoading: false, isValidating: false, mutate: vi.fn() })
  const html = renderToString(<SourceProcess onQuery={() => {}} />)
  expect(html).toContain('role="status"')
  expect(html).toContain('순서대로 세고 있습니다')
  expect(html).not.toContain('판정 대상')
})

it.each([
  ['조회', () => <SourceQueryConsole queue="all" onQueue={() => {}} />],
  ['검토', () => <SourceOperations queue="all" onQueue={() => {}} reason={null} onReason={() => {}} source={null} onSourceClear={() => {}} />],
  ['공정', () => <SourceProcess onQuery={() => {}} />],
] as const)('%s에서 집계 실패를 알리고 자동 재시도 폭주를 막는다', (_name, screen) => {
  const html = renderToString(screen())
  expect(html).toContain('role="alert"')
  expect(html).toContain('집계를 읽지 못했습니다')
  expect(html).toContain('다시 읽기')
  const summary = vi.mocked(useSWR).mock.calls.find(([key]) => typeof key === 'string' && key.endsWith('?summary=1'))
  expect(summary?.[2]).toMatchObject({ shouldRetryOnError: false, revalidateOnFocus: false })
})
