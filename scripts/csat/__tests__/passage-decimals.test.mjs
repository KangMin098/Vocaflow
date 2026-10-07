// scripts/csat/__tests__/passage-decimals.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import {passageOf} from '../lib-passage.mjs'

test('question-number stripping preserves decimal values at the start of body lines',()=>{
 const passage=passageOf([
  '34. 다음 빈칸에 들어갈 말은?',
  'A fictional study found people bought',
  '3.3 units without a limit but',
  '5.3 on average with a limit.',
  '12.5 percent is another numeric value.',
  '① first ② second ③ third ④ fourth ⑤ fifth',
 ])
 assert.equal(passage,'A fictional study found people bought 3.3 units without a limit but 5.3 on average with a limit. 12.5 percent is another numeric value.')
 assert.equal(passageOf(['34. A numbered English question remains parseable.']),'A numbered English question remains parseable.')
})
