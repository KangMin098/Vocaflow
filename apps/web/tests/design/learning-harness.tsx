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
import SettingsPage from '../../src/app/(main)/settings/page'
import DiagnosticHistoryPage from '../../src/app/(main)/diagnostic/history/page'
import { setNavigate } from './learning-boundary.mjs'

const words = MOCK_PAIRS.map(pair => ({en:pair.word,ko:pair.meaning}))
function App() {
  const [route,setRoute] = useState(new URLSearchParams(location.search).get('screen') ?? '/diagnostic')
  setNavigate((href:string)=>setRoute(href))
  if(route==='/diagnostic') return <DiagnosticClient />
  if(route==='/diagnostic/history') return <HistoryFixture />
  if(route==='/settings') return <SettingsPage />
  if(route==='/pairflip') return <PairFlipHub poolWords={words} ownedTotal={words.length} />
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
function HistoryFixture() {
  const [content,setContent] = useState<React.ReactNode>(null)
  useEffect(()=>{let active=true;void DiagnosticHistoryPage().then(element=>{if(active)setContent(element)});return()=>{active=false}},[])
  return content
}
function PirateFixture({phase}:{phase:PirateUIProps['phase']}) {
  const [current,setCurrent] = useState(phase)
  const dive: Dive = {index:1,markers:words.slice(0,3).map((word,i)=>({badge:i+1,slot:i+6,word,hauled:false,liftPx:0})),queue:[2,3],asking:1,scanMs:5000,lantern:false,pending:80,hauled:1}
  const exit = () => setCurrent('done')
  const props: PirateUIProps = {phase:current,dive,scanFrac:.8,scanSeconds:5,tideFrac:.7,tideWarning:false,tideSeconds:50,tideCapped:false,score:140,combo:3,comboMult:1.5,tierLabel:null,bankPreview:80,nextChainMult:1.5,askKo:words[0].ko,lastHaul:words[0],miss:{target:words[0],picked:words[1],lost:80,near:false,hauledPick:false},recall:{word:words[0],options:words.slice(0,3).map(word=>word.ko)},knewMeaning:null,settle:{points:80,seconds:5,full:false,items:2,lantern:false,capped:false},done:{score:140,bankedItems:2,bestCombo:3,bestChain:2,missed:words.slice(0,2),strandedPending:0,best:{prev:null,now:140,improved:true}},lanternLeft:2,substitutedPool:false,muted:true,burstKey:0,burstColors:[],onToggleMute:()=>{},onExit:exit,onDiveNow:()=>setCurrent('haul'),onBank:()=>setCurrent('settle'),onPushLuck:()=>setCurrent('haul'),onLantern:()=>{},onRecallPick:()=>setCurrent('reveal'),onContinue:()=>setCurrent('scan'),onRestart:()=>setCurrent('scan')}
  return <div style={{minHeight:'100vh',background:'linear-gradient(#e7d8ba,#c59c70)'}}>{current==='loading'?<PirateGate progress={65} onExit={exit} />:<PirateQuestUI {...props} />}</div>
}
createRoot(document.getElementById('root')!).render(<App />)
