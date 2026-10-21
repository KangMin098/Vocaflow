import{describe,it,expect}from'vitest';import{data}from'./fixture';import{composeV4}from'@/lib/csat/map/v4/compose';import{homeFocusOf}from'@/lib/csat/map/v62/home-focus';import{mapProgressOf}from'@/lib/csat/map/home-progress';import{pickHomeSuggestion}from'@/lib/csat/home-suggestion';
const suggestion=(d:any)=>{const p=mapProgressOf(d);return pickHomeSuggestion({map:'ok',focusKind:homeFocusOf(d).kind,returned:false,activeSet:false,mapProgress:{check:!!p.check,plan:!!p.plan}})};
describe('home does not send a directly checked learner back to no-record status',()=>{
 it('known direct evidence without an exam record is not no_records after home progress fallbacks',()=>{const d=data();const v=composeV4(d,{score:80,set:true})!;expect(v.asIs.tasks['r.central_meaning'].basis).toBe('direct_check');expect(suggestion(d)).not.toBe('no_records')});
 it('goal absent still recommends setting a goal',()=>{const d:any=data();d.model={...d.model,goalSet:false};expect(suggestion(d)).toBe('goal')});
 it('truly absent records remain the existing first-user control',()=>{expect(suggestion(data({findAttempts:[],lifecycleActivity:[]}))).toBe('no_records')});
});
