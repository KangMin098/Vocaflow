// scripts/dict/gap-fill2-load.mjs
// Stage2 결과 적재 — Claude Code 배치 교정본. EXCLUDE(방언/외국어/nonce) 제외 + CORRECT(Google 오역 수정) + else Google.
// → lexicon_clean lang='en'. ko_source: claude-corrected / claude-verified(google 유지).
import fs from 'node:fs'
const env=fs.readFileSync('apps/web/.env.local','utf8')
for(const l of env.split('\n')){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')}
const URL=process.env.NEXT_PUBLIC_SUPABASE_URL, SVC=process.env.SUPABASE_SERVICE_ROLE_KEY
const H={apikey:SVC,Authorization:'Bearer '+SVC,'Content-Type':'application/json',Prefer:'resolution=ignore-duplicates,return=minimal'}
const sleep=ms=>new Promise(r=>setTimeout(r,ms))

// 방언/외국어/nonce/모호 — 표준영어 아님, 제외
const EXCLUDE=new Set(['ahint','alterne','asthore','bagnet','balancelle','bedman','bellering','blaws','bosthoon','cachous','chimbley','chimley','crool','daurna','dawggone','dickty','dinguses','falutin','follering','forninst','haysel','justitia','linhay','mistal','monel','moorsman','needn','ollav','othman','partment','pertending','posepone','pouncet','pussens','renovare','seech','servente','stengah','suddint','talionis','tenshun','tention','thegither','theirn','tracasserie','tuilzie','turble','voorlooper','jazzers','musicker','cotehardie','cycloramic','teagown','transpontine'])

// Google 오역 수정 (Claude 교정)
const CORRECT={
 aglare:'환하게 빛나는', ashpan:'재받이', ashplant:'물푸레나무 지팡이', ashplants:'물푸레나무 지팡이',
 astare:'빤히 쳐다보는', astretch:'쭉 뻗은', atlases:'지도책', bathchair:'환자용 바퀴의자', bayous:'늪지',
 beflagged:'깃발로 장식된', begettest:'낳다(고어)', behung:'매달아 장식한', beruffled:'주름장식이 달린',
 bestrewn:'흩뿌려진', betweenwhiles:'틈틈이', birdhood:'새의 시절', bodyservant:'시종, 몸종', booktalk:'책 이야기',
 broadmindedly:'관대하게', cabbagy:'양배추 같은', caddishness:'비열함', cattishly:'심술궂게', clept:'~라 불리는(고어)',
 clothyard:'클로스야드(옷감 재는 단위)', colourable:'그럴듯한, 위장의', counterscarp:'외호 사면(요새)', cubbish:'미숙한',
 dabblings:'어설픈 시도', damfool:'바보 같은', damndest:'최선', darndest:'최선, 굉장한', deepvoiced:'저음의',
 dishuman:'비인간적인', dismallest:'가장 음침한', drummajor:'군악대장', dundrearies:'긴 구레나룻',
 farmhorse:'농사용 말', fireglow:'불빛', firescreen:'벽난로 가리개', fleabite:'벼룩 물린 자국, 사소한 것',
 forbye:'게다가, ~외에', forgettest:'잊다(고어)', frogwise:'개구리 모양으로', funnybone:'팔꿈치 급소',
 gatherum:'격식없는 모임', gentlepeople:'양갓집 사람들', gnomelike:'땅요정 같은', goodhap:'행운',
 greenstuff:'푸성귀, 채소', groceryman:'식료품 상인', gunbutt:'총 개머리판', halldoor:'현관문', handpost:'이정표',
 harkee:'들어보게(고어)', helterskelter:'허둥지둥', higharched:'높은 아치의', hominess:'아늑함',
 horsechestnut:'마로니에, 칠엽수', houseplace:'거실', imperence:'무례함(방언)', indrawing:'빨아들이는',
 jinricksha:'인력거', jogtrot:'느린 구보', juggins:'얼간이', kittenishness:'앙증맞음, 아양', laborite:'노동당원',
 landaus:'란다우 마차', leavetaking:'작별', longcloth:'옥양목', longdrawn:'길게 끄는', longside:'나란히',
 luckpenny:'행운의 동전, 덤', lupanars:'매춘굴', mantelboard:'벽난로 선반', matchlight:'성냥불빛',
 meseemed:'~인 듯했다(고어)', midstride:'걷는 도중에', mommet:'허수아비, 인형(방언)', moneychangers:'환전상',
 mongst:'~사이에(고어)', moonface:'달덩이 같은 얼굴', mournfullest:'가장 슬픈', mumchance:'말없이, 멍하니',
 naysay:'반대하다, 거부하다', newspaperdom:'신문업계', oilcake:'깻묵, 유박', onestep:'원스텝(춤)', onfall:'습격, 발병',
 opinionativeness:'독선, 고집', outfought:'~보다 잘 싸웠다', oversadly:'너무 슬프게', overridden:'제압된, 기각된',
 overshone:'~보다 빛났다, 능가했다', overstrewn:'온통 뒤덮인', pandemonic:'대혼란의', peagreen:'연두색',
 piazzetta:'작은 광장', prahus:'프라우선(말레이 돛단배)', praus:'프라우선(말레이 돛단배)', ptotic:'처진, 안검하수의',
 rebecks:'레벡(중세 현악기)', retook:'되찾았다', rhapsodical:'열광적인, 광시적인', rickyard:'짚가리 마당',
 rightabout:'정반대로, 뒤로 돌아', ruthfully:'가엾게, 애처롭게', sansculotte:'상퀼로트(프랑스혁명 급진파)',
 scatheless:'상처 없는, 무사한', sixpennyworth:'6펜스어치', slumberously:'나른하게, 졸린 듯이', smitch:'아주 조금, 티끌',
 somethink:'뭔가(방언)', spacelock:'우주 기밀실(에어록)', stairfoot:'계단 밑', stockstill:'꼼짝없이',
 stratoplane:'성층권 비행기', sweetling:'귀염둥이', teazle:'산토끼꽃(식물)', tellt:'말했다(방언)', tesselated:'바둑판무늬의',
 theirselves:'그들 자신(방언)', throatily:'목쉰 소리로', throatiness:'목쉰 소리, 걸걸함', tirewoman:'시녀, 몸종(고어)',
 tonelessness:'생기없음, 단조로움', topheavy:'상단이 무거운, 불안정한', twicet:'두 번(방언)', underlain:'밑에 깔린',
 undernote:'저음, 함축', undescried:'눈에 띄지 않은', undiscerned:'알아채지 못한', undissembled:'꾸밈없는, 진솔한',
 undrew:'열어젖혔다', unclerical:'성직자답지 않은', unfoiled:'좌절되지 않은', unforeign:'낯익은', unfumbling:'능숙한',
 ungauntleted:'장갑을 벗은', ungleeful:'시무룩한', unhackneyed:'참신한', unholpen:'도움받지 못한(고어)',
 unimpatient:'느긋한', unintermittent:'끊임없는', unmirthful:'침울한', unostentation:'검소, 수수함',
 unostentatiously:'겸손하게, 드러내지 않고', unpliability:'완고함', unregretfully:'후회 없이', unrelaxing:'방심하지 않는',
 untonsured:'삭발하지 않은', uphove:'솟아올랐다(고어)', upborne:'떠받쳐진', upthrown:'밀어올려진, 융기된',
 washhand:'세면용', wellset:'다부진, 균형잡힌', whenso:'~할 때는 언제나(고어)', whomso:'누구든지(고어)',
 withershins:'반시계방향으로', woodnotes:'숲의 새소리', woolwork:'모직 자수', writingtable:'글쓰기 책상',
 wrongside:'안쪽 면, 뒷면', yclept:'~라 불리는(고어)', yoursel:'너 자신(방언)'
}
async function ins(b,n=6){for(let i=0;i<n;i++){try{const r=await fetch(URL+'/rest/v1/lexicon_clean',{method:'POST',headers:H,body:JSON.stringify(b)});if(r.ok||r.status===409)return true}catch(e){}await sleep(500*(i+1))}return false}

const recs=[]
for(const l of fs.readFileSync('scratchpad-foreign/gap2.jsonl','utf8').split('\n')){if(!l)continue;let o;try{o=JSON.parse(l)}catch{continue}
  if(EXCLUDE.has(o.word))continue
  const ko=CORRECT[o.word]||o.g
  const src=CORRECT[o.word]?'claude-corrected':'claude-verified'
  recs.push({word:o.word,lang:'en',meaning_ko:ko,gloss_source:'mt',ko_source:src,is_valid_word:true})
}
console.error('적재 대상:',recs.length,'(제외',EXCLUDE.size,'· 교정',Object.keys(CORRECT).length,')')
for(let i=0;i<recs.length;i+=300)await ins(recs.slice(i,i+300))
console.error('완료')
