// apps/web/src/lib/csat/map/v62/__tests__/r5-execution-independent.test.ts
import { expect, it } from 'vitest'
import { executableTransferTargets, type ExposureLedger } from '../assessment-exposure'
import { r5ReadOnlyBase } from '../../../../../../tests/e2e/utils/r5-read-only-base'

const targets = [{ target: '2020#24', href: '/csat/practice/claim-support?item=2020%2324' }, { target: '2020#20', href: '/csat/item/2020-20?check=1' }]
const ledger: ExposureLedger = { status: 'ok', events: [], passageKeys: { '2020#24': 'p' } }
it('unseen practice transfer has no runnable Workspace target; theater keeps its own route', () => {
  expect(executableTransferTargets(targets, ledger)).toEqual([targets[1]])
  expect(executableTransferTargets(targets, { status: 'error', failed: ['trap'] })).toEqual([targets[1]])
})
it('exposed practice transfer remains usable as ordinary experience', () => {
  expect(executableTransferTargets(targets, { ...ledger, events: [{ itemRef: '2020#24', source: 'paper', taskKey: null, activity: null, phase: null, helpLevel: null, sessionId: null, contentHash: null, deleted: false }] })).toEqual(targets)
})
it('config and spec resolve the same explicit server and custom port', () => {
  expect(r5ReadOnlyBase({ PLAYWRIGHT_BASE_URL: 'http://localhost:3991' })).toBe('http://localhost:3129')
  expect(r5ReadOnlyBase({ R5_READ_ONLY_PORT: '3992' })).toBe('http://localhost:3992')
  expect(r5ReadOnlyBase({ R5_READ_ONLY_BASE_URL: 'http://localhost:3993', PLAYWRIGHT_BASE_URL: 'http://localhost:3991' })).toBe('http://localhost:3993')
})
