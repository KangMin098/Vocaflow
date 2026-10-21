import{describe,it,expect}from'vitest';import{loadAuthoredDeliveries}from'@/lib/csat/map/load';
const row={id:'d1',artifact_ref:'authored:a',task_id:'r.central_meaning',role:'independent_check'};
function db(responses:Record<string,{data:unknown,error:unknown}>){const chain:any={};for(const k of['select','eq','in'])chain[k]=()=>chain;chain.then=(f:any)=>Promise.resolve({data:[row],error:null}).then(f);return{from:()=>chain,rpc:async(n:string)=>responses[n]} as never;}
const err={data:null,error:{message:'temporary RPC outage'}};
describe('delivery-validity failure is not an empty delivered set',()=>{
 it('both validity RPC errors must propagate unavailable, not remove every delivery as false',async()=>{await expect(loadAuthoredDeliveries(db({workspace_delivery_current:err,supply_delivery_valid:err}),'u')).rejects.toThrow()});
 it('both validity results null without an explicit boolean also cannot assert no valid deliveries',async()=>{await expect(loadAuthoredDeliveries(db({workspace_delivery_current:{data:null,error:null},supply_delivery_valid:{data:null,error:null}}),'u')).rejects.toThrow()});
 it('legitimate service-role fallback true remains a valid delivery',async()=>{expect(await loadAuthoredDeliveries(db({workspace_delivery_current:err,supply_delivery_valid:{data:true,error:null}}),'u')).toEqual([row])});
 it('legitimate fallback false remains explicit invalid, not a read outage',async()=>{expect(await loadAuthoredDeliveries(db({workspace_delivery_current:err,supply_delivery_valid:{data:false,error:null}}),'u')).toEqual([])});
});
