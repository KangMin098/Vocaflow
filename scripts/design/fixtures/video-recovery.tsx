// scripts/design/fixtures/video-recovery.tsx — real component, synthetic media URLs, no account/DB.
import {useState} from 'react'
import {createRoot} from 'react-dom/client'
import {ComponentVideo} from '../../../apps/web/src/components/video/ComponentVideo'
import {LearnerColorScope} from '../../../apps/web/src/components/layout/LearnerColorScope'
import type {ResolvedVideo} from '../../../apps/web/src/lib/video/catalog'
const query=new URLSearchParams(location.search)
function Fixture(){
 const[changed,setChanged]=useState(false)
 const video:ResolvedVideo={id:changed?'benefit-minimum':'benefit-decay',kind:'benefit',title:'영상 안내',subtitle:'실제 부품의 미디어 실패/복구 검사 · 합성 URL · 학습 데이터 없음',seconds:24,format:'wide',src:query.has('recover')?'/media/recovering.webm':'/media/unavailable.mp4',poster:query.get('poster')==='ok'||changed?'/media/poster.svg':'/media/unavailable.webp',captions:'/media/captions.vtt',width:1280,height:720,transcript:[],evidence:[]}
 return <><LearnerColorScope/><main style={{maxWidth:900,margin:'64px auto',padding:32}}><h1>실제 부품 격리 · 합성 자료</h1><ComponentVideo video={video} posterFallback={query.get('legacy')==='1'?'/illustrations/tines/scene-video-v1.webp':undefined}/><button style={{minHeight:44,marginTop:24}} onClick={()=>setChanged(true)}>다른 영상 보기</button></main></>
}
createRoot(document.getElementById('root')!).render(<Fixture/> )
