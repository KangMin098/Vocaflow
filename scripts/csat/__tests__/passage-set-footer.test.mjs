// scripts/csat/__tests__/passage-set-footer.test.mjs
import assert from 'node:assert/strict'
import test from 'node:test'
import {choicesOf} from '../lib-passage.mjs'

test('mixed-width set instructions do not become the last choice',()=>{
 for(const header of ['[31~34］다음 빈칸에 들어갈 말','［36～37] 주어진 글 다음에 이어질 글','[41–42] 윗글을 읽고 물음에 답하시오']){
  assert.deepEqual(choicesOf(['① first ② second ③ third ④ fourth',`⑤ individual …… more …… adding ${header}`]),['first','second','third','fourth','individual …… more …… adding'])
 }
})
test('literal bracket ranges and complete Korean choices remain intact',()=>{
 assert.deepEqual(choicesOf(['① first ② second ③ third ④ fourth ⑤ compare [31~34] and [36~37]']),['first','second','third','fourth','compare [31~34] and [36~37]'])
 assert.deepEqual(choicesOf(['① 첫 단락의 내용 ② 두 번째 단락의 내용 ③ 세 번째 단락의 내용 ④ 네 번째 단락의 내용 ⑤ 다음 단락의 내용']),['첫 단락의 내용','두 번째 단락의 내용','세 번째 단락의 내용','네 번째 단락의 내용','다음 단락의 내용'])
})
