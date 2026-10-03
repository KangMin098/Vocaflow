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
export const useRouter = () => ({push:href=>{links.push(href);navigate(href)},replace:href=>{links.push(href);navigate(href)},back:()=>navigate('/pairflip'),refresh:()=>{audit.refreshed=true}})
export const usePathname = () => params.get('screen') ?? location.pathname
export const useSearchParams = () => new URLSearchParams(location.search)
export const LearningPathArt = () => null // 과거 기준선에는 없는 장식이다(현재 소스는 실제 SVG를 사용).
export default function Compat({href,src,alt,children,priority,fill,unoptimized,loader,quality,...props}) {
  if(src) return React.createElement('img',{...props,src,alt,style:fill?{position:'absolute',inset:0,width:'100%',height:'100%',...props.style}:props.style})
  const onClick=props.onClick
  return React.createElement('a',{href,...props,onClick:event=>{onClick?.(event);if(event.defaultPrevented)return;event.preventDefault();links.push(href);navigate(href)}},children)
}

// Growth/Books 서버 경계: fixture만 반환한다. 실제 조회·저장 코드는 번들에 들어가지 않는다.
export const fixtureBooks = ['A Christmas Carol','Winnie-the-Pooh','A Butterfly Smile','Lost and Found','Fables','Poetry'].map((title,i)=>({id:`fixture-book-${i}`,title,author:'Fixture Author',cefr_level:'B1',cefr_band:'B1',book_v_level:i+2,word_count:1200+i*100,chapter_count:3,reading_minutes:20,lexical_coverage:{'5':97,'6':99},chapter_v_hist:{'3':3},synopsis_ko:'이야기 속에서 단어를 만나고, 짧은 챕터로 나누어 영어 원서를 읽어요.',enrollment_state:i===1?'in_progress':'not_enrolled',progress_pct:i===1?30:0,genre_norm:'fiction',has_audio:i===0,popularity_rank:i+1}))
const option = (id,title) => ({id,title,subtitle:'Fixture Author',slug:null,vLevel:3,coverUrl:null,coverEmoji:null,source:null,category:'general',chapterCount:3,bookId:null,chapterIdx:null,feedLabel:null})
export const fixtureMaterials = {books:[option('fixture-book-0','A Christmas Carol'),option('fixture-book-1','Winnie-the-Pooh')],articles:[],wordSets:[],scripts:[]}
export const fixturePlan = [{id:'fixture-plan-0',materialType:'book',materialId:'fixture-book-1',modules:['read'],title:'Winnie-the-Pooh',subtitle:'Fixture Author',href:'/library/books/fixture-book-1',slug:null,vLevel:3,chapters:[1],weekdays:[1,3,6],chapterCount:3,coverUrl:null,coverEmoji:null,source:null}]
export const fetchStudyPlanItems = async () => params.has('cold')?[]:fixturePlan
export const fetchAvailableMaterials = async () => fixtureMaterials
export const fetchBookChapters = async () => [{idx:1,title:'Chapter One',vLevel:3},{idx:2,title:'Chapter Two',vLevel:3},{idx:3,title:'Chapter Three',vLevel:3}]
export const savePlanItem = async value => {writes.push({action:'savePlanItem',value});return params.get('error')==='save'?{ok:false,error:'검증용 저장 실패'}:{ok:true,id:value.id??`fixture-plan-${writes.length}`}}
export const removePlanItem = async id => {writes.push({action:'removePlanItem',id});return {ok:true}}
export const unenrollBook = async (_,id) => {writes.push({action:'unenrollBook',id});return {ok:true}}
export const fixtureReports = [0,1,2].map((offset)=>({week_start:['2026-09-28','2026-09-21','2026-09-14'][offset],total_minutes:40-offset*5,total_words:24-offset*4,total_reviews:36-offset*4,by_module:{flashcard:12,pairflip:8},empathetic_note:'단어를 다시 만나는 이 리듬이 실력이 돼요.',generated_at:'2026-10-03T00:00:00Z'}))
export const fetchRecentReports = async () => params.has('cold')?[]:fixtureReports
export const generateWeeklyReport = async () => {writes.push({action:'generateWeeklyReport'});return params.get('error')==='report'?{ok:false,error:'검증용 갱신 실패'}:{ok:true}}
export const fetchManageOverview = async () => ({userName:'학습자',vLevel:5,knownWordCount:12,currentStreak:2,todayWords:6,plan:{itemCount:1,activityCount:1,topMaterials:['Winnie-the-Pooh']},latestReport:fixtureReports[0]})
export const fetchRecentActivity = async () => ({items:[],failed:false})
export const fetchMemoryHorizon = async () => ({ladder:{counts:params.has('cold')?{day:0,few:0,week:0,month:0,season:0}:{day:5,few:4,week:3,month:2,season:1},unseen:4,onLadder:params.has('cold')?0:15,medianDays:params.has('cold')?null:2,topDays:30,champion:params.has('cold')?null:{word:'resilient',meaning:'회복력이 있는',days:30,reviewCount:4,firstMet:'2026-09-01'}},rescued:{count:3,sample:[{word:'thrive',meaning:'번성하다'},{word:'adapt',meaning:'적응하다'}]},days28:Array.from({length:28},(_,i)=>({date:new Date(Date.UTC(2026,8,6+i)).toISOString().slice(0,10),reviews:i%3?0:6,words:i%3?0:3})),streak:2,activeDays:10,reach:{bands:[{key:'b1',label:'1천위 안',count:5},{key:'b2',label:'1–2천위',count:3}],ranked:8,medianRank:900}})
