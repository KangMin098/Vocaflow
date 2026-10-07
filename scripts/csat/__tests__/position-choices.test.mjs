// scripts/csat/__tests__/position-choices.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import {choicesOf} from '../lib-passage.mjs'

test('insertion options are five locations rather than text following each location',()=>{
 const block=['A given sentence.', 'The body opens. ( ① ) It continues. (②) Another point. ( ③ ) A detail. (④) It concludes. ( ⑤ ) Final statement.']
 assert.deepEqual(choicesOf(block,{positionsOnly:true}),['①','②','③','④','⑤'])
 assert.deepEqual(choicesOf([block[0],block[1].replace('(④)','（ ④ ）')],{positionsOnly:true}),['①','②','③','④','⑤'])
 assert.equal(choicesOf([block[0],block[1].replace('(④)','')],{positionsOnly:true}),null)
 assert.equal(choicesOf(['① alpha ② beta ③ gamma ④ delta ⑤ epsilon'],{positionsOnly:true}),null)
})
test('ordinary choices preserve content and remove only terminal page decorations',()=>{
 assert.deepEqual(choicesOf(['① a ※ b','② beta','③ gamma','④ delta','⑤ epsilon ＊']),['a ※ b','beta','gamma','delta','epsilon'])
 assert.equal(choicesOf(['① a','② b','③ c','④ d','⑤ final ※'])[4],'final')
})
