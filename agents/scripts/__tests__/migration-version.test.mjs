// agents/scripts/__tests__/migration-version.test.mjs
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {duplicateMigrationVersions} from '../check.mjs'

test('병렬 브랜치에서 생긴 같은 버전은 통합 후 거부한다', () => {
  const names=['20261021010000_a.sql','20261021010000_b.sql','20261021010001_c.sql']
  assert.deepEqual(duplicateMigrationVersions(names,new Set()),[names.slice(0,2)])
})
test('옛 날짜_시각 형식도 같은 버전으로 정규화한다', () => {
  assert.deepEqual(duplicateMigrationVersions(['20260521_140000_a.sql','20260521_200000_b.sql'],new Set()),[])
  assert.equal(duplicateMigrationVersions(['20260521_140000_a.sql','20260521140000_b.sql'],new Set()).length,1)
})
test('미적용 제안과 기존 라쳇 기준선은 새 중복으로 취급하지 않는다', () => {
  assert.deepEqual(duplicateMigrationVersions(['_pending_a.sql','_pending_a.sql','README.md']),[])
  assert.deepEqual(duplicateMigrationVersions(['20260924150000_a.sql','20260924150000_b.sql']),[])
})
