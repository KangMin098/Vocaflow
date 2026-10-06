// scripts/csat/reveal-gate/graphql-probe.mjs
export function graphQLScope(fields,{exam,itemIds,type,sessionIds,userIds}) {
  for(const [names,value] of [[['exam_id','examId'],exam],[['item_id','itemId'],itemIds],[['type_id','typeId'],type],[['session_id','sessionId'],sessionIds],[['user_id','userId'],userIds]]) {
    const field=names.find(x=>fields.includes(x))
    if(field)return{args:`first: 1000, filter: { ${field}: { ${Array.isArray(value)?'in':'eq'}: ${JSON.stringify(value)} } }`,targeted:true}
  }
  return{args:'first: 1',targeted:false}
}
export async function graphQLResponse(fetchImpl,url,options) {
  try{const response=await fetchImpl(url,{...options,signal:AbortSignal.timeout(20000)}),body=await response.json().catch(()=>null)
    const shaped=body&&!Array.isArray(body)&&(body.data&&typeof body.data==='object'&&!Array.isArray(body.data)||Array.isArray(body.errors)&&body.errors.length>0)
    if(!response.ok||!shaped)return{errors:[{message:'GraphQL response unavailable or malformed'}],http_status:response.status}
    return body
  }catch{return{errors:[{message:'GraphQL transport failed'}]}}
}
