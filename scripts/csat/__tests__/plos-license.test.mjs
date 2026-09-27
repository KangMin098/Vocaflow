// scripts/csat/__tests__/plos-license.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { plosLicenseOf } from '../lib-plos.mjs'

test('PLOS copyright 문장 → 원문 단위 license 표기', () => {
  assert.equal(
    plosLicenseOf('Gao et al This is an open access article distributed under the terms of the Creative Commons Attribution License, which permits unrestricted use'),
    'CC BY 4.0',
  )
  assert.equal(
    plosLicenseOf(' This is an open-access article distributed under the Creative Commons Public Domain declaration which stipulates'),
    'CC0 1.0 (public domain)',
  )
  assert.equal(plosLicenseOf('Creative Commons Attribution-NonCommercial License'), 'CC BY-NC 4.0')
  assert.equal(plosLicenseOf(''), null)
  assert.equal(plosLicenseOf(null), null)
  assert.equal(plosLicenseOf('© 2020 Someone. All rights reserved.'), '© 2020 Someone. All rights reserved.')
})
