// scripts/csat/__tests__/set-header-width.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {itemBlocks,setBlockFor,passageOf,choicesOf,useColumns} from '../lib-passage.mjs'

test('mixed-width set header restores both shared questions without stealing the preceding summary',()=>{
 const fixture=fs.mkdtempSync(path.join(os.tmpdir(),'csat-set-header-'))
 const columns=path.join(fixture,'columns2')
 const originalColumns=path.resolve('scripts/csat/data/columns2')
 fs.mkdirSync(columns,{recursive:true})
 try{
  useColumns(columns)
  for(const [index,header] of ['[41~42］','［41～42]','［41∼42］','[41~42]'].entries()){
   const exam=`H990${index+1}G1`
   fs.writeFileSync(path.join(columns,`${exam}.txt`),[
    '40. 다음 글의 빈칸에 들어갈 말은?',
    'The earlier passage must stay separate.',
    '① first ② second ③ third ④ fourth ⑤ fifth',
    header+' 다음 글을 읽고, 물음에 답하시오.',
    'A fictional shared passage has enough evidence.',
    'It contains no official answers.',
    '41. 윗글의 제목으로 가장 적절한 것은?',
    '① one ② two ③ three ④ four ⑤ five',
    '42. 밑줄 친 낱말의 쓰임이 적절하지 않은 것은?',
    '① (a) ② (b) ③ (c) ④ (d) ⑤ (e)',
   ].join('\n'))
   const shared=passageOf(setBlockFor(exam,41))
   assert.equal(shared,'A fictional shared passage has enough evidence. It contains no official answers.')
   assert.deepEqual(setBlockFor(exam,42),setBlockFor(exam,41))
   assert.equal(passageOf(itemBlocks(exam,40)[0]),'The earlier passage must stay separate.')
   assert.deepEqual(choicesOf(itemBlocks(exam,40)[0]),['first','second','third','fourth','fifth'])
   assert.equal(setBlockFor(exam,40),null)
  }
 }finally{
  useColumns(originalColumns)
  assert.ok(path.resolve(fixture).startsWith(path.resolve(os.tmpdir())+path.sep))
  assert.ok(path.basename(fixture).startsWith('csat-set-header-'))
  fs.rmSync(fixture,{recursive:true,force:true})
 }
})
