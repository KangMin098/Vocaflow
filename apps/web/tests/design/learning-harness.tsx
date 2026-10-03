// apps/web/tests/design/learning-harness.tsx
// 실제 학습 컴포넌트에 고정 입력만 주입한다. 네트워크/서버 DB 기능은 경계에서 제거.
import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { DiagnosticClient } from '../../src/components/diagnostic/DiagnosticClient'
import { PairFlipHub } from '../../src/components/pairflip/PairFlipHub'
import { PairFlipGameScreen } from '../../src/components/pairflip/PairFlipGameScreen'
import { PairFlipResultScreen } from '../../src/components/pairflip/PairFlipResultScreen'
import { MOCK_PAIRS } from '../../src/components/pairflip/mock-data'
import { STORAGE_KEYS } from '../../src/components/pairflip/constants'
import type { PairFlipConfig, PairFlipResultData } from '../../src/components/pairflip/types'
import { WordOrreryGame } from '../../src/components/game/word-orrery/WordOrreryGame'
import { PirateQuestUI, PirateGate, type PirateUIProps } from '../../src/components/pirate-quest/PirateQuestUI'
import type { Dive } from '../../src/components/pirate-quest/logic'
import { ModuleHero } from '../../src/components/hub/ModuleHero'
import { Screen } from '../../src/components/ui/ios'
import SettingsPage from '../../src/app/(main)/settings/page'
import DiagnosticHistoryPage from '../../src/app/(main)/diagnostic/history/page'
import DashboardPage from '../../src/app/(main)/dashboard/page'
import PlanPage from '../../src/app/(main)/plan/page'
import ReportsPage from '../../src/app/(main)/reports/page'
import { AreaHero } from '../../src/components/layout/AreaHero'
import { LearningPathArt } from '../../src/components/ui/LearningPathArt'
import { BooksExplorer } from '../../src/components/library/browse/BooksExplorer'
import type { PublishedBook } from '../../src/lib/library/published-book'
import { fixtureBooks, setNavigate } from './learning-boundary.mjs'

const words = MOCK_PAIRS.map(pair => ({en:pair.word,ko:pair.meaning}))
function App() {
  const [route,setRoute] = useState(new URLSearchParams(location.search).get('screen') ?? '/diagnostic')
  setNavigate((href:string)=>setRoute(href))
  if(route==='/diagnostic') return <DiagnosticClient />
  if(route==='/diagnostic/history') return <HistoryFixture />
  if(route==='/settings') return <SettingsPage />
  if(route==='/dashboard') return <AsyncFixture load={DashboardPage} />
  if(route==='/plan') return <AsyncFixture load={PlanPage} />
  if(route==='/reports') return <AsyncFixture load={ReportsPage} />
  if(route.split('?')[0]==='/library/books') return <BooksFixture showAll={route.includes('show=all')} />
  if(route==='/pairflip') return <Screen width="content" background="bg2" padX="md"><PairFlipHub poolWords={words} ownedTotal={words.length} /></Screen>
  if(route==='/pairflip/play') {
    const config = JSON.parse(sessionStorage.getItem(STORAGE_KEYS.config) ?? '{"level":"easy","mode":"word_meaning"}') as PairFlipConfig
    return <PairFlipGameScreen config={config} pairs={MOCK_PAIRS} />
  }
  if(route==='/pairflip/results') return <PairFlipResultScreen result={JSON.parse(sessionStorage.getItem(STORAGE_KEYS.result)!) as PairFlipResultData} />
  if(route==='/play/word-orrery') return <WordOrreryGame wordPool={words} />
  if(route.startsWith('pirate:')) return <PirateFixture phase={route.split(':')[1] as PirateUIProps['phase']} />
  if(route.startsWith('hero:')) { const title=route.split(':')[1]; return <div style={{margin:'40px'}}><ModuleHero title={title} eyebrow={title} gradient={{from:'',to:''}} note="실제 세션에서 만날 단어를 확인하고 학습을 시작해요." stats={[{label:'이번 학습',value:words.length,unit:'단어'}]} /></div> }
  return <div data-destination={route}>{route}</div>
}
function BooksFixture({showAll}:{showAll:boolean}) {
  const books = (new URLSearchParams(location.search).has('cold')?[]:fixtureBooks) as PublishedBook[]
  return (
    <Screen width="wide" background="bg2" padX="md" className="tines-books">
      <div className="flex flex-col gap-5 py-6 md:py-8">
        <AreaHero className="books-intro" desktopArt={<LearningPathArt variant="books" />}
          kicker="서가 · 영어 원서" title="Books"
          sub="큐레이션된 영어 원서 — i+1 수준에 맞춘 도서를 추천해드려요."
          tile="tile-books" tint="green"
          stats={books.length?[{label:'Books',value:String(books.length)}]:undefined}
          tabs={[{href:'/library/books',label:'둘러보기',active:!showAll},{href:'/library/books?show=all',label:'전체 보기',active:showAll}]} />
        <BooksExplorer books={books} userVLevel={5} userMastery="warm" showAll={showAll} />
      </div>
    </Screen>
  )
}
function AsyncFixture({load}:{load:()=>Promise<React.ReactNode>}) {
  const [content,setContent] = useState<React.ReactNode>(null)
  useEffect(()=>{let active=true;void load().then(element=>{if(active)setContent(element)});return()=>{active=false}},[load])
  return content
}
function HistoryFixture() {
  const [content,setContent] = useState<React.ReactNode>(null)
  useEffect(()=>{let active=true;void DiagnosticHistoryPage().then(element=>{if(active)setContent(element)});return()=>{active=false}},[])
  return content
}
function PirateFixture({phase}:{phase:PirateUIProps['phase']}) {
  const [current,setCurrent] = useState(phase)
  const dive: Dive = {index:1,markers:words.slice(0,3).map((word,i)=>({badge:i+1,slot:i+6,word,hauled:false,liftPx:0})),queue:[2,3],asking:1,scanMs:5000,lantern:false,pending:80,hauled:1}
  const exit = () => setCurrent('done')
  const props: PirateUIProps = {phase:current,dive,scanFrac:.8,scanSeconds:5,tideFrac:.7,tideWarning:false,tideSeconds:50,tideCapped:false,score:140,combo:3,comboMult:1.5,tierLabel:'항해자',bankPreview:80,nextChainMult:1.5,askKo:words[0].ko,lastHaul:words[0],miss:{target:words[0],picked:words[1],lost:80,near:false,hauledPick:false},recall:{word:words[0],options:words.slice(0,3).map(word=>word.ko)},knewMeaning:null,settle:{points:80,seconds:5,full:false,items:2,lantern:false,capped:false},done:{score:140,bankedItems:2,bestCombo:3,bestChain:2,missed:words.slice(0,2),strandedPending:0,best:{prev:null,now:140,improved:true}},lanternLeft:2,substitutedPool:false,muted:true,burstKey:0,burstColors:[],onToggleMute:()=>{},onExit:exit,onDiveNow:()=>setCurrent('haul'),onBank:()=>setCurrent('settle'),onPushLuck:()=>setCurrent('haul'),onLantern:()=>{},onRecallPick:()=>setCurrent('reveal'),onContinue:()=>setCurrent('scan'),onRestart:()=>setCurrent('scan')}
  return <div style={{minHeight:'100vh',background:'linear-gradient(#e7d8ba,#c59c70)'}}>{current==='loading'?<PirateGate progress={65} onExit={exit} />:<PirateQuestUI {...props} />}</div>
}
createRoot(document.getElementById('root')!).render(<App />)
