// scripts/design/fixtures/learner-colors.tsx — real components, synthetic props, no account/DB.
import {useState} from 'react'
import {createRoot} from 'react-dom/client'
import {Layers} from 'lucide-react'
import {LearnerColorScope} from '../../../apps/web/src/components/layout/LearnerColorScope'
import {FeaturedBookCard} from '../../../apps/web/src/components/library/browse/FeaturedBookCard'
import {VaultIdentity} from '../../../apps/web/src/components/wordvault/hub/VaultIdentity'
import {DurabilityLadder} from '../../../apps/web/src/components/dashboard/DurabilityLadder'
import {ActivityTrace} from '../../../apps/web/src/components/dashboard/ActivityTrace'
import {Frame} from '../../../apps/web/src/components/ui/ios/Frame'
import {TypePopover} from '../../../apps/web/src/components/workspace/TypePopover'
import {UspCards} from '../../../apps/web/src/components/hub/portal/sections'
import {Dialog} from '../../../apps/web/src/components/ui/Dialog'
import type {PublishedBook} from '../../../apps/web/src/lib/library/published-book'
import {editorialScene} from '../../../apps/web/src/lib/design/editorial-art'

const view=new URLSearchParams(location.search).get('view')||'books'
const titles=['A Christmas Carol','Pride and Prejudice','The Secret Garden','The Wonderful Wizard of Oz']
const authors=['Charles Dickens','Jane Austen','Frances Hodgson Burnett','L. Frank Baum']
const books:PublishedBook[]=titles.map((title,i)=>({id:`fixture-${i}`,title,author:authors[i],cefr_level:null,cefr_band:null,book_v_level:null,word_count:null,chapter_count:null,reading_minutes:null,cover_image_url:null}))
const days=Array.from({length:28},(_,i)=>({date:`2026-09-${String(i+1).padStart(2,'0')}`,reviews:(i%5)*8,words:(i%5)*5}))
const ladder={counts:{day:12,few:10,week:8,month:6,season:4},unseen:20,onLadder:40,medianDays:5,topDays:32,champion:null}
const names:Record<string,string>={hub:'오늘의 학습',books:'Books',dashboard:'기억이 자라는 시간',vault:'WordVault'}
const scenes:Record<string,string>={hub:'journey-v4',books:'library-v4',dashboard:'growth-v4',vault:'vault-v4'}

function Fixture(){
 const[selection,setSelection]=useState<string|null>(null),[type,setType]=useState(false),[dialog,setDialog]=useState(false)
 if(view==='roles')return <><LearnerColorScope/><main style={{maxWidth:1060,margin:'64px auto',padding:40}}><p>실제 화면이 아닌 공통 스타일 경계 검사 · 합성 내용 · DB 연결 없음</p><h1 style={{fontSize:44,margin:'28px 0'}}>콘텐츠의 색 역할</h1><p data-body-copy style={{color:'var(--t2)'}}>설명과 읽는 글은 중성색으로 유지합니다.</p><section style={{background:'var(--area-surface)',color:'var(--area-ink)',borderRadius:16,padding:28,margin:'32px 0'}}><h2>구역의 제목과 옅은 콘텐츠 면</h2><p>의미색·학습 상태와 구분합니다.</p></section><button style={{background:'var(--p)',color:'var(--on-p)',minHeight:44,padding:'0 24px',borderRadius:24}} onClick={()=>setDialog(true)}>팝업 확인</button>{dialog&&<Dialog title="이어지는 콘텐츠" onClose={()=>setDialog(false)}><p>팝업의 설명은 읽기 색, 제목은 현재 구역의 색을 사용합니다.</p></Dialog>}</main></>
 const intro=<header style={{display:'grid',gridTemplateColumns:'1fr 360px',alignItems:'center',gap:48,minHeight:260}}><div><p style={{fontSize:13,color:'var(--t3)'}}>색 역할 검증 · 가상 자료</p><h1 style={{fontSize:48,lineHeight:1.15,margin:'16px 0'}}>{names[view]}</h1><p style={{color:'var(--t2)',fontSize:16}}>본문과 보조 문구, 콘텐츠 면의 역할을 구분합니다.</p></div><img src={editorialScene(`scene-${scenes[view]}`)} width="360" height="240" style={{objectFit:'contain'}} alt="" /></header>
 return <>
  <LearnerColorScope />
  <p id="fixture-notice" style={{padding:'12px 40px',borderBottom:'1px solid var(--bd)',fontSize:13}}>실제 부품의 색/배치 격리 검증 · 합성 자료 · 실제 계정/정상 앱 화면 수용 아님 · DB 연결 없음</p>
  <main style={{maxWidth:1360,margin:'auto',padding:'0 40px 56px'}}>
   {intro}
   {view==='books'&&<section className="books-reference__grid" aria-label="격리 추천 도서">{books.map(book=><FeaturedBookCard key={book.id} book={book} onOpen={b=>setSelection(b.title)}/>)}</section>}
   {view==='vault'&&<div className="vault-reference" style={{padding:'24px 0',maxWidth:'none'}}>
    <VaultIdentity total={120} buckets={{stable:54,shaky:24,risk:12,new:30}} collections={4} accumulatedDays={14} weeklyDone={18} weeklyTarget={30} vLevel={null}/>
    <Frame title="단어 수준 지도"><p>고정 자료의 분포 예시입니다.</p><div style={{display:'flex',alignItems:'end',gap:12,height:100}}>{[30,45,85,100,70,35].map((h,i)=><span key={i} style={{height:h,width:36,background:'var(--t1)',borderRadius:5}}/>)}</div></Frame>
    <Frame title="다음 한 단계"><p>이 영역은 다음 학습 선택을 안내합니다.</p><a href="#next" style={{display:'inline-flex',minHeight:44,alignItems:'center',gap:8}}><Layers size={18}/>단어장 둘러보기 →</a></Frame>
   </div>}
   {view==='dashboard'&&<div className="dashboard-reference" style={{padding:'24px 0'}}>
    <div className="dashboard-reference__memory"><h2 style={{marginBottom:24,fontSize:28}}>기억이 버티는 시간</h2><DurabilityLadder ladder={ladder}/></div>
    <div className="dashboard-reference__history"><h2 style={{fontSize:28,marginBottom:24}}>최근 학습 흐름</h2><div><ActivityTrace days={days} streak={3} activeDays={22}/></div></div>
   </div>}
   {view==='hub'&&<div className="hub-reference"><UspCards/></div>}
   <div style={{position:'relative',marginTop:32}}><button id="type-trigger" onClick={()=>setType(!type)} style={{border:'1px solid var(--bd-input)',borderRadius:24,minHeight:44,padding:'0 20px',color:'var(--t1)',background:'var(--bg)'}}>읽기 설정</button>{type&&<TypePopover onClose={()=>setType(false)}/>}</div>
   {selection&&<p role="status">선택한 도서: {selection}</p>}
  </main>
 </>
}
createRoot(document.getElementById('root')!).render(<Fixture/> )
