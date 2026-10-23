// docs/csat-learner/skeleton-v4/s1-v6/selection/model.mjs
export const features=['F01','F03','F04','F05','F07','F08']
export const alternatives=['REUSE','IMPROVE','REPLACE','NEW']
export const recommended={F01:'IMPROVE',F03:'IMPROVE',F04:'REPLACE',F05:'IMPROVE',F07:'IMPROVE',F08:'REPLACE'}
export function reportedProposition(choice){
 const match=choice.decisive.match(/「([^」]+)」/u)
 return match?{text:match[1],basis:'EXACT_QUOTE_FROM_STORED_ANALYSIS',sourceField:`inquiry.v3.choices[n=${choice.n}].decisive`,fullOfficialChoice:false}:null
}
export function choicesForMeaning(v3,id){return v3.choices.filter(c=>(c.meaning_ids??[]).includes(id)).map(c=>c.n)}
export function meaningsForChoice(v3,n){return v3.meanings.filter(m=>(v3.choices.find(c=>c.n===n)?.meaning_ids??[]).includes(m.id)).map(m=>m.id)}
export function qualificationRecords(sample){
 const v3=sample.inquiry.v3
 if(sample.itemId==='2026#34')return [
  {id:'Ideally',label:'Ideally · 이상적 법의 한정',text:sample.blocks.find(b=>b.key==='analysis:answer')?.quote??null,source:'blocks[analysis:answer].quote',sentences:[6]},
  {id:'If',label:'If · 가정의 범위',text:sample.blocks.find(b=>b.key==='analysis:intent')?.body?.[0]?.match(/If such laws forbid .*?___/u)?.[0]??null,source:'exact substring of blocks[analysis:intent].body[0]',sentences:[7]},
  {id:'cannot',label:'cannot be · 부정 범위',text:v3.meanings.find(m=>m.expression.includes('cannot be'))?.expression??null,source:'inquiry.v3.meanings.expression',sentences:[7]}
 ]
 return v3.meanings.filter(m=>sample.itemId==='2026#22'?/may|Often|might|more competitive/.test(m.expression):/narratives|identity|university/.test(m.expression)).map(m=>({id:m.id,label:m.expression,text:m.meaning_ko,source:`inquiry.v3.meanings[id=${m.id}].meaning_ko`,sentences:m.sentences}))
}
export const promptByItem={
 '2026#34':{question:'Ideally와 If의 조건 안에서, cannot be가 부정하는 것은 무엇인가?',comparison:'①: 합리성만 부정하는가 / ③: 자유의 구속 자체를 부정하는가',boundary:'Ideally나 If의 가정을 빼도 같은 결론을 말할 수 있는가?'},
 '2026#22':{question:'부분적으로 참인 진단이 글 전체의 요지를 대표하는가?',comparison:'③의 부분 진단 / ①의 전체 처방',boundary:'내용이 참이라는 이유만으로 글 전체의 요지가 되는가?'},
 '2026#38':{question:'앞뒤 문맥을 잇고 기존 연결도 보존하는 위치인가?',comparison:'④의 6→7 연결 / ⑤의 양쪽 접합',boundary:'지시어가 맞으면 기존 6→7 연결을 끊어도 되는가?'}
}
