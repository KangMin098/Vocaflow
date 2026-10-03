// apps/web/tests/design/learning-boundary.mjs
// 테스트 전용 경계. 실 DB/client/server/action 모듈은 번들에 포함하지 않는다.
import React from 'react'
export const writes = []
export const links = []
export const audit = { writes, links, external: [] }
window.learningAudit = audit
const params = new URLSearchParams(location.search)
const tests = ['base_v_level','comprehensive','csat_korean','business_english','academic_english'].map((key,i) => ({id:key,name_ko:key,test_type:i<2?key:'track',target_axis:'v',target_track_id:i<2?null:key,question_count:6,estimated_minutes:5,description_ko:''}))
const questions = ['evolution','adapt','thrive','resilient','pioneer','resolve'].map((word,i) => ({id:`q${i}`,word,target_v_level:i+1,target_track_level:i+1,display_order:i}))
const levels = Array.from({length:12},(_,level) => ({level,korean_name:`어휘 ${level}단계`,english_name:`Level ${level}`,cefr_min:'A2',cefr_max:'B1',test_score_hints:'학습을 위한 기준',description_ko:'지금보다 조금 어려운 단어를 만나며 차근히 연습해요.'}))
const recommendations = [{set_id:'fixture-set',slug:'fixture-set',title:'기초를 다지는 어휘',category:'general',word_count:30,cover_emoji:null,recommendation_type:'primary',reason:'수준에 맞아요',priority:1}]
const snapshots = [{id:'fixture-snapshot-1',v_level:3,previous_v_level:2,v_level_delta:1,taken_reason:'diagnostic_completed',taken_at:'2026-10-01T00:00:00Z',snapshot_type:'diagnostic',triggered_by:'self',v_level_meta:{confidence:.83}}, {id:'fixture-snapshot-2',v_level:2,previous_v_level:null,v_level_delta:null,taken_reason:'self_declared',taken_at:'2026-09-01T00:00:00Z',snapshot_type:'manual',triggered_by:'self',v_level_meta:null}]
let failed = false
function query(table) {
  let mutation = false, single = false
  const q = {
    select(){return q},eq(){return q},order(){return q},limit(){return q},
    insert(value){mutation=true;writes.push({table,value});return q},
    single(){single=true;return q},maybeSingle(){single=true;return q},
    then(resolve,reject) {
      let data = mutation?{id:'fixture-result'}:table==='vocaflow_levels'?levels:table==='vrl_diagnostic_tests'?tests:table==='vrl_diagnostic_questions'?questions:table==='user_level_snapshots'?(params.has('cold')?[]:snapshots):null
      let error = null
      if (mutation && params.get('error')==='submit' && !failed) { failed=true; data=null; error={message:'검증용 연결 실패'} }
      if (!mutation && !['vocaflow_levels','vrl_diagnostic_tests','vrl_diagnostic_questions','user_level_snapshots'].includes(table)) throw new Error(`미허용 읽기 ${table}`)
      if (single && Array.isArray(data)) data=data[0]
      return Promise.resolve({data,error}).then(resolve,reject)
    }
  }
  return q
}
const client = {from:query,auth:{getUser:async()=>({data:{user:{id:'fixture-user'}}})},rpc:async(name,args)=>{
  if(name==='recommend_word_sets_for_user') return {data:recommendations,error:null}
  if(!name.startsWith('analyze_and_apply_')) throw new Error(`미허용 RPC ${name}`)
  writes.push({rpc:name,args});return {data:{estimated_v_level:3,estimated_track_level:3,confidence:.83},error:null}
}}
export const createClient = () => client
export const subscribeSet = async id => {writes.push({action:'subscribeSet',id});return {ok:true}}
export const recordGameScore = async value => {writes.push({action:'recordGameScore',value})}
export const flushPendingSession = async () => {writes.push({action:'flushPendingSession'});return {}}
export const flushOnLeave = () => {writes.push({action:'flushOnLeave'})}
export const saveLearningRecords = async () => {}
export const useToast = () => ({error:message=>{audit.toast=message},success:()=>{}})
const setProgress = () => {}
export const useSessionProgress = () => ({setProgress})
let navigate = () => {}
export const setNavigate = callback => {navigate=callback}
export const useRouter = () => ({push:href=>{links.push(href);navigate(href)},replace:href=>{links.push(href);navigate(href)},back:()=>navigate('/pairflip')})
export const usePathname = () => location.pathname
export default function Compat({href,src,alt,children,priority,fill,unoptimized,loader,quality,...props}) {
  if(src) return React.createElement('img',{src,alt,...props})
  return React.createElement('a',{href,...props,onClick:event=>{event.preventDefault();links.push(href);navigate(href)}},children)
}
