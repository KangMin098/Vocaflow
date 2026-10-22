import {renderToStaticMarkup} from 'react-dom/server'
import {describe,it,expect,vi} from 'vitest'
vi.mock('next/navigation',()=>({useRouter:()=>({push:()=>{}})}))
vi.mock('@/components/wordvault/StudyMode',()=>({StudyMode:()=>null}))
vi.mock('@/components/illustrations/Illustration',()=>({Illustration:()=>null}))
import {VocabLearningCard} from 'D:/workspace/Vocaflow-main-serving/apps/web/src/components/csat/diagnosis/map/VocabLearningCard'
import {WordVaultStudyClient} from 'D:/workspace/Vocaflow-main-serving/apps/web/src/components/wordvault/WordVaultStudyClient'
import {withMapReturn,vocabMapReturnHref} from 'D:/workspace/Vocaflow-main-serving/apps/web/src/lib/csat/map-return'
const ctx={mapTask:'v.core_meaning',ws:'ws.vocab-context',mapWs:'11111111-2222-4333-8444-555555555555',mapPlan:'3',mapGoal:'7'}
const back=vocabMapReturnHref({from:'map',map_task:ctx.mapTask,ws:ctx.ws,map_ws:ctx.mapWs,map_plan:ctx.mapPlan,map_goal:ctx.mapGoal})!
const href=(html:string,testid:string)=>html.match(new RegExp('<a(?=[^>]*data-testid="'+testid+'")[^>]*href="([^"]+)"'))?.[1]?.replaceAll('&amp;','&')
describe('map-origin word preparation keeps selected workspace',()=>{
 it('Workspace preparation link retains the validated map context',()=>{
  const html=renderToStaticMarkup(<VocabLearningCard kind="support" taskName="기본 의미 접근" ctx={ctx}/>)
  const u=new URL(href(html,'ws-vocab-browse')!,'http://x')
  expect(u.searchParams.get('from')).toBe('map');expect(u.searchParams.get('map_task')).toBe(ctx.mapTask)
 })
 it('empty map-origin review preparation link retains map context',()=>{
  const html=renderToStaticMarkup(<WordVaultStudyClient words={[]} mode="review" mapBack={back} backHref={back}/>)
  const h=html.match(/href="([^\"]*\/wordvault\/browse[^\"]*)"/)?.[1]?.replaceAll('&amp;','&')
  const u=new URL(h!,'http://x');expect(u.searchParams.get('map_task')).toBe(ctx.mapTask)
 })
 it('existing review normal control retains selected task',()=>expect(new URL(withMapReturn('/wordvault/review',ctx),'http://x').searchParams.get('map_task')).toBe(ctx.mapTask))
 it('ordinary entry has no map return bar',()=>expect(renderToStaticMarkup(<WordVaultStudyClient words={[]} mode="review"/>)).not.toContain('vocab-map-return'))
 it('existing map return strips authored item and attempt claims',()=>{const u=new URL(vocabMapReturnHref({from:'map',map_task:ctx.mapTask,ws:ctx.ws,map_item:'stale',map_attempt:'42'})!,'http://x');expect(u.searchParams.has('map_item')).toBe(false);expect(u.searchParams.has('map_attempt')).toBe(false)})
})
