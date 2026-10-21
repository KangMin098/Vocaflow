// verification/reviews/T-0071-r1-independent/browser/main.tsx
import React, {useState} from 'react'
import {createRoot} from 'react-dom/client'
import {LearningNotesPanel} from '@/components/csat/diagnosis/map/LearningNotesPanel'
const d='11111111-1111-4111-8111-111111111111'
const row={ref:'authored:opt-guided-1',deliveryId:d,role:'guided_practice',current:true}
function App() {
 const [input,setInput]=useState({task:'e.option_correspondence',rows:[row],listed:'installed',viewer:'A'})
 ;(window as any).change=(patch:any)=>setInput(x=>({...x,...patch}))
 return <><output id="scope">{input.viewer}:{input.task}:{input.rows[0]?.deliveryId}:{input.listed}:{String(input.rows[0]?.current)}</output><LearningNotesPanel key={input.task} task={input.task} rows={input.rows} listed={input.listed as any} past={false} /></>
}
createRoot(document.getElementById('root')!).render(<App/>)
