// scripts/design/fixtures/learning-environment.tsx — real components, synthetic data, no learning writes.
import {useState} from 'react'
import {createRoot} from 'react-dom/client'
import {PracticeChooser} from '../../../apps/web/src/app/(main)/practice/PracticeChooser'
import {ReadingSection} from '../../../apps/web/src/components/hub/portal/sections'
import {VocabSeriesHeader} from '../../../apps/web/src/components/library/vocab/VocabSeriesHeader'
import {measureLadderFill} from '../../../apps/web/src/lib/library/vocab/rung'
import {LearnerColorScope} from '../../../apps/web/src/components/layout/LearnerColorScope'
import {Card} from '../../../apps/web/src/components/flashcard/Card'
import {TypePopover} from '../../../apps/web/src/components/workspace/TypePopover'
import {useFlashcardKeyboard} from '../../../apps/web/src/hooks/useFlashcardKeyboard'
import {ModuleBanner} from '../../../apps/web/src/components/layout/ModuleBanner'
import type {HubPortal} from '../../../apps/web/src/lib/learner/hub-portal-query'
import type {FlashcardWord} from '../../../apps/web/src/types/flashcard'
const view=new URLSearchParams(location.search).get('view')||'practice'
const word:FlashcardWord={id:'synthetic-word',text:'understanding',meaning:'이해, 이해력, 상황이나 다른 사람의 마음을 이해하는 능력',pos:'noun',pronunciation:'/ˌʌndərˈstændɪŋ/',exampleSentence:'A clear understanding of the whole sentence helps the learner connect each unfamiliar word to its context.',exampleSentenceWithBlank:'A clear ___ helps the learner.',exampleTranslation:'문장 전체를 분명하게 이해하면 학습자는 낯선 단어를 그 문맥과 연결할 수 있습니다.',textTitle:'합성 검증 지문',textId:'synthetic',textChapter:'격리 예문',illustrationUrl:'/illustrations/tines/spot-reading.webp',collocations:['clear understanding','mutual understanding'],senses:[{pos:'noun',meaning:'내용이나 의미를 이해하는 것'},{pos:'noun',meaning:'사람들 사이의 이해와 공감'}],srs:{easinessFactor:2.5,interval:1,repetitions:0,nextReviewAt:new Date('2026-10-21T00:00:00Z'),lapses:0}}
function Fixture(){
 const[flipped,setFlipped]=useState(false),[type,setType]=useState(false)
 const[judged,setJudged]=useState(0),[exited,setExited]=useState(0)
 useFlashcardKeyboard({phase:view==='card'?(flipped?'flipped':'flippable'):'recall',onFlip:()=>setFlipped(true),onJudge:()=>setJudged(v=>v+1),onPlayAudio:()=>{},onToggleInsight:()=>{},onEscape:()=>{if(view==='card')setExited(v=>v+1)}})
 return <><LearnerColorScope/><p style={{margin:'12px 40px',fontSize:13}}>실제 부품 격리 · 합성 자료 · 계정/원본 학습 화면 아님 · DB 없음</p><main style={{maxWidth:1280,margin:'auto',padding:32}}>
 {view==='practice'&&<PracticeChooser ownedTotal={30} sessionSize={10} gamePoolSize={20} syntaxCount={null}/>}
 {view==='banner'&&<ModuleBanner/>}
 {view==='library'&&<div className="catalog-reference__body"><VocabSeriesHeader fill={measureLadderFill([])} totalVolumes={0} totalWords={0} learnerStep={3}/></div>}
 {view==='topics'&&<ReadingSection portal={{articles:[],facts:{articles:null}} as unknown as HubPortal}/>}
 {view==='card'&&<section style={{maxWidth:580,margin:'32px auto'}}><Card word={word} phase={flipped?'flipped':'flippable'} hintVisible={false} isAudioPlaying={false} isExampleAudioPlaying={false} canPlayAudio={false} onPlayAudio={()=>{}} onClick={()=>setFlipped(v=>!v)} swipeDirection={null} cardChangeKey={0}/><button id="reveal" style={{minHeight:44,marginTop:24}} onClick={()=>setFlipped(v=>!v)}>{flipped?'앞면으로':'정답 확인'}</button></section>}
 {view==='reader'&&<section style={{maxWidth:680,margin:'24px auto'}}><div style={{position:'relative',textAlign:'right'}}><button id="type" style={{minHeight:44}} onClick={()=>setType(v=>!v)}>타이포 설정</button>{type&&<TypePopover onClose={()=>setType(false)}/>}</div><article className="reading-prose" style={{fontSize:'var(--reader-font-size,15px)',lineHeight:'var(--reader-line-height,1.55)'}}><h1>Reading in context</h1><p>Learning begins with a clear view of the sentence. A reader can change the size and spacing without losing the explanation or the controls.</p><p>이 문장은 저장된 학습 자료가 아닌 격리 검증 문장입니다. 내용과 도움말을 가까이 두고, 읽기 중에는 필요한 정보에 집중합니다.</p></article></section>}
 {view==='card'&&<output id="shortcut-count" style={{display:'block',fontSize:12}}>합성 단축키 기록: {judged}/{exited}</output>}
 </main></>
}
createRoot(document.getElementById('root')!).render(<Fixture/> )
