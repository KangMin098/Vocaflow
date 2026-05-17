#!/usr/bin/env node
// Generate CAST-2000 seed list (B1/B2 only, Korean high school segment)
import fs from 'fs';
import path from 'path';

const OUTPUT_PATH = path.resolve('exports/vcb-jobs/20260515-0002-cast-2000-seed-list.jsonl');

// [lemma, pos, cefr, tier]
// tier: c=core, m=common, o=moderate, r=rare
const D = [];
const add = (pos, cefr, tier, ...lemmas) => { for (const l of lemmas) D.push([l, pos, cefr, tier]); };

// ─────────── VERBS B1 ───────────
add('VERB','B1','c',
  'accept','achieve','admit','affect','agree','allow','announce','apply','approach','argue',
  'arrange','arrive','attempt','attend','attract','avoid','base','behave','belong','blame',
  'borrow','breathe','calculate','cancel','capture','care','carry','celebrate','challenge','charge',
  'check','claim','clean','clear','climb','collect','combine','comment','commit','compare',
  'compete','complain','complete','concentrate','concern','confirm','connect','consider','consist','consult',
  'contain','continue','contribute','control','copy','correct','count','cover','crash','create',
  'criticize','cross','cure','deal','decide','declare','defeat','defend','define','delay',
  'deliver','demand','deny','depend','describe','design','destroy','detect','determine','develop',
  'devote','differ','direct','disappear','discover','discuss','dislike','divide','doubt','earn',
  'educate','elect','employ','encourage','enjoy','ensure','enter','escape','establish','examine',
  'exchange','exist','expect','experience','explain','explore','express','extend','face','fail',
  'fasten','feed','fight','fill','find','finish','fire','fit','fix','float',
  'flow','fold','follow','force','forget','forgive','freeze','gain','gather','generate',
  'govern','grow','guess','guide','handle','hang','happen','hate','help','hide',
  'hire','hit','hold','hope','hunt','hurry','hurt','identify','ignore','illustrate',
  'imagine','imitate','impress','improve','include','increase','indicate','influence','inform','injure',
  'insist','install','intend','introduce','invent','investigate','invite','involve','judge','justify',
);
add('VERB','B1','m',
  'keep','kill','knock','lack','last','laugh','launch','lead','lean','learn',
  'leave','lend','lift','light','limit','link','listen','lock','look','lose',
  'maintain','manage','mark','marry','match','matter','measure','meet','melt','mention',
  'mind','miss','mix','move','multiply','name','need','notice','obey','observe',
  'obtain','occur','offer','open','operate','oppose','order','organize','owe','own',
  'pack','paint','park','participate','pass','pay','perform','permit','persuade','pick',
  'plan','plant','please','point','pollute','possess','post','postpone','pour','practice',
  'praise','predict','prefer','prepare','present','preserve','press','pretend','prevent','print',
  'produce','promise','promote','propose','protect','prove','provide','publish','pull','punish',
  'purchase','push','quit','quote','raise','reach','react','read','realize','receive',
  'recognize','recommend','record','recover','recycle','reduce','refer','reflect','refuse','regard',
  'register','regret','reject','relate','relax','release','rely','remain','remember','remind',
  'remove','rent','repair','repeat','replace','reply','report','represent','request','require',
  'rescue','research','resemble','reserve','resist','respect','respond','rest','return','reveal',
  'review','ride','rise','risk','rob','roll','rub','ruin','rule','satisfy',
  'save','scan','scare','score','scream','search','seem','select','sell','send',
  'separate','serve','settle','shake','share','shine','shock','shoot','shop','shout',
  'show','shut','sigh','sign','sing','sink','sit','sleep','slide','slip',
  'smell','smile','smoke','sneeze','solve','sort','sound','speak','spell','spend',
  'split','spoil','spread','stand','stare','start','state','stay','steal','step',
  'stick','stop','store','strike','struggle','study','succeed','suffer','suggest','suit',
  'supply','support','suppose','surprise','surround','survive','suspect','swallow','swear','sweat',
  'sweep','swim','switch','talk','taste','teach','tear','tell','tend','test',
  'thank','think','threaten','throw','tie','tolerate','touch','trace','train','transfer',
  'translate','transport','travel','treat','trust','try','turn','twist','type','understand',
  'unite','urge','use','value','vary','view','visit','vote','wait','wake',
  'walk','wander','want','warn','wash','waste','watch','wave','wear','weigh',
  'welcome','whisper','win','wish','wonder','work','worry','wrap','write','yell',
);

// ─────────── VERBS B2 ───────────
add('VERB','B2','m',
  'abandon','abolish','absorb','accelerate','access','accommodate','accompany','accomplish','accumulate','accuse',
  'acknowledge','acquire','adapt','address','adjust','administer','adopt','advance','advocate','allocate',
  'alter','amend','analyze','anticipate','appeal','appreciate','approve','assemble','assert','assess',
  'assign','assist','associate','assume','assure','attach','attain','attribute','authorize','await',
  'ban','bargain','beg','betray','bind','boast','boost','breach','broaden','browse',
  'bury','cease','cite','classify','clarify','clash','coincide','collaborate','collapse','comprise',
  'conceive','conclude','condemn','conduct','confess','confine','confront','conserve','constitute','construct',
  'consume','contemplate','contradict','convert','convey','convict','convince','cope','correspond','counter',
  'crawl','cultivate','dare','debate','decay','decline','decorate','dedicate','define','delegate',
  'demolish','demonstrate','depict','deploy','deposit','depress','derive','descend','deserve','detach',
  'deteriorate','devastate','devise','dictate','differentiate','diminish','disclose','discriminate','disguise','dismiss',
  'dispatch','displace','dispose','dispute','dissolve','distinguish','distract','distribute','disturb','dominate',
  'donate','draft','drift','dump','eliminate','embrace','emerge','emphasize','enable','enact',
  'enclose','encounter','endure','enforce','engage','enhance','enrich','enroll','entitle','equip',
  'erupt','evaluate','evolve','exaggerate','exceed','excel','exclude','execute','exhaust','exhibit',
  'expand','expel','exploit','expose','extract','fade','fascinate','fetch','flatter','flee',
);
add('VERB','B2','o',
  'flourish','fluctuate','foresee','forge','formulate','frustrate','fulfill','function','fund','furnish',
  'glance','glow','grant','grasp','greet','grin','grip','halt','harm','harness',
  'harvest','haunt','heal','hesitate','highlight','host','illuminate','immerse','imply','implement',
  'impose','incorporate','induce','infect','infer','inflict','inhabit','inherit','inhibit','initiate',
  'inquire','insert','inspect','inspire','integrate','interact','interpret','interrupt','intervene','invade',
  'invest','irritate','isolate','kneel','label','lag','leak','linger','locate','lure',
  'magnify','manipulate','manufacture','mediate','merge','migrate','mock','modify','monitor','mourn',
  'navigate','neglect','negotiate','nominate','nourish','nurture','oblige','obscure','occupy','offend',
  'opt','originate','outline','overcome','overlap','overlook','overwhelm','oversee','panic','pardon',
  'peer','penetrate','perceive','perish','persist','pioneer','plead','pledge','plot','plunge',
  'polish','ponder','populate','portray','pose','precede','prescribe','presume','prevail','proceed',
  'prohibit','project','prolong','prompt','propel','prosper','provoke','pursue','qualify','quarrel',
  'rally','rank','rebel','recall','reckon','reconcile','recruit','redeem','refine','regulate',
  'rehearse','reinforce','relieve','render','renew','repel','replicate','reproduce','reside','resign',
  'resolve','restore','restrain','restrict','resume','retain','retreat','retrieve','reverse','revise',
  'revive','rotate','salvage','scatter','seal','seek','seize','shed','shelter','shield',
  'shrink','shrug','simulate','situate','skim','slam','slap','smash','snap','soak',
  'sob','soothe','specify','sponsor','squeeze','stagger','stain','stall','startle','starve',
  'stem','sting','stir','strain','strengthen','stretch','strip','strive','stroll','structure',
  'stumble','submit','subscribe','substitute','summarize','summon','supervise','supplement','suppress','surge',
  'surrender','survey','suspend','sustain','swap','sway','swing','tackle','tame','target',
  'terminate','testify','thrive','thrust','tilt','toss','transcend','transform','transmit','trap',
  'trigger','trim','undermine','unify','unveil','uphold','utilize','vanish','venture','verify',
  'vibrate','violate','volunteer','vow','weaken','weep','whip','wield','withdraw','withhold',
  'withstand','witness','wrestle','yield',
);

// ─────────── NOUNS B1 ───────────
add('NOUN','B1','c',
  'ability','accident','account','achievement','action','activity','addition','address','adult','advance',
  'advantage','adventure','advertisement','advice','affair','age','agency','agreement','aim','airport',
  'amount','animal','answer','apartment','appearance','application','area','argument','arm','army',
  'article','artist','aspect','assistance','atmosphere','attack','attempt','attention','attitude','audience',
  'author','authority','average','award','baby','background','balance','ball','band','bank',
  'bar','base','basis','battle','beach','beginning','behavior','belief','benefit','bill',
  'birth','blood','board','body','book','border','boss','bottom','box','boy',
  'branch','brain','break','breath','bridge','brother','budget','building','business','camera',
  'campaign','cancer','candidate','capital','captain','career','case','category','cause','center',
  'century','ceremony','chain','chair','chairman','chance','change','channel','chapter','character',
  'charge','chart','check','chief','child','choice','church','citizen','city','claim',
  'class','climate','clock','club','coach','coast','code','coffee','collection','college',
  'color','column','combination','comfort','command','comment','committee','community','company','comparison',
  'competition','complaint','computer','concept','concern','concert','conclusion','condition','conference','confidence',
  'conflict','connection','consequence','contact','content','context','contract','contrast','contribution','control',
  'conversation','copy','corner','cost','country','county','couple','courage','course','court',
  'cover','craft','crash','cream','creation','credit','crime','crisis','criticism','crowd',
  'culture','currency','current','customer','damage','dance','danger','daughter','day','deal',
);
add('NOUN','B1','m',
  'death','debate','debt','decade','decision','decline','defense','degree','demand','department',
  'depth','description','design','desire','detail','development','device','dialogue','diary','difference',
  'difficulty','direction','disaster','discovery','discussion','disease','distance','distribution','district','division',
  'doctor','document','dog','dollar','door','dream','drink','driver','drug','duty',
  'ear','earth','east','economy','edge','edition','editor','education','effect','effort',
  'election','element','emergency','emotion','emphasis','employee','employer','employment','energy','engine',
  'engineer','enterprise','entrance','entry','environment','equipment','error','essay','establishment','evaluation',
  'event','evidence','examination','example','exception','exchange','existence','expansion','expectation','expense',
  'experience','experiment','expert','explanation','exposure','expression','extension','eye','face','fact',
  'failure','family','farm','fashion','father','favor','fear','feature','feedback','feeling',
  'female','field','fight','figure','file','film','finger','fire','firm','fish',
  'flight','floor','flow','flower','focus','food','foot','football','force','foreigner',
  'forest','form','formation','foundation','frame','freedom','friend','friendship','front','fruit',
  'function','funeral','future','garden','gate','generation','girl','glass','goal','goods',
  'government','grade','grandfather','grandmother','grass','ground','group','growth','guard','guest',
  'guidance','guitar','gun','habit','hair','half','hall','hand','hat','health',
  'heart','heat','height','heritage','hero','highway','hill','history','hole','holiday',
  'home','honor','hope','horizon','horse','hospital','host','hotel','hour','house',
);
add('NOUN','B1','m',
  'household','housing','human','humor','hunger','idea','identification','identity','illness','image',
  'imagination','impact','importance','impression','improvement','income','incident','industry','infection','influence',
  'information','injury','innovation','input','inquiry','insect','inspection','installation','instance','instruction',
  'instrument','insurance','intelligence','intention','interaction','interest','internet','interpretation','interview','introduction',
  'invention','investigation','investment','invitation','involvement','island','issue','item','job','journey',
  'judgment','justice','key','kind','king','kitchen','knee','knowledge','lab','labor',
  'lack','lady','lake','land','landscape','language','laugh','law','lawyer','layer',
  'leader','leaf','league','learner','legend','length','lesson','letter','level','library',
  'license','life','light','limit','line','link','list','literature','loan','location',
  'log','look','loss','love','luck','machine','magazine','majority','male','man',
  'management','manager','manner','map','margin','mark','market','marriage','mass','master',
  'match','material','matter','maximum','meal','meaning','measure','meat','media','medicine',
  'meeting','member','memory','message','method','middle','milk','million','mind','minister',
  'minute','mirror','mission','mistake','mixture','model','moment','money','month','mood',
  'moon','morning','mother','motion','motor','mountain','mouse','mouth','move','movement',
  'movie','music','nation','nature','neck','need','neighbor','network','newspaper','night',
  'noise','north','note','nothing','notice','novel','number','nurse','object','observation',
  'occasion','ocean','offer','office','officer','operation','opinion','opportunity','opposition','option',
);

// ─────────── NOUNS B2 ───────────
add('NOUN','B2','m',
  'orientation','origin','outcome','outline','output','owner','pace','package','page','pain',
  'painting','pair','palace','panel','paper','paragraph','parent','park','part','participant',
  'participation','partner','party','passage','passenger','passion','past','path','patient','pattern',
  'peace','people','percentage','performance','period','permission','person','personality','perspective','phase',
  'phenomenon','philosophy','phone','photograph','phrase','physician','picture','piece','place','plan',
  'planet','plant','plastic','plate','platform','player','pleasure','plot','poem','poet',
  'poetry','point','police','policy','politician','politics','pollution','population','port','position',
  'possibility','possession','post','potential','poverty','power','practice','precision','prediction','preference',
  'preparation','presence','presentation','president','pressure','prevention','price','pride','principal','principle',
  'priority','prison','privacy','prize','problem','procedure','process','product','production','profession',
  'professor','profile','profit','program','progress','project','promise','promotion','proof','property',
  'proposal','prospect','protection','protein','protest','province','psychology','publication','publicity','punishment',
  'purchase','purpose','quality','quantity','quarter','queen','question','race','radio','rain',
  'range','rank','rate','ratio','reaction','reader','reality','reason','rebellion','recall',
  'receipt','reception','recipe','recognition','recommendation','record','recovery','reduction','reference','reflection',
  'reform','refusal','region','registration','regulation','rejection','relation','relationship','relevance','relief',
);
add('NOUN','B2','o',
  'religion','reminder','removal','renewal','rent','reply','report','representation','reproduction','reputation',
  'request','requirement','research','reservation','residence','resident','resignation','resistance','resolution','resort',
  'resource','respect','response','responsibility','rest','restaurant','restoration','restriction','result','retirement',
  'revenge','revenue','reverse','revolution','reward','rhythm','rice','ride','right','ring',
  'rise','risk','river','road','rock','role','room','root','rope','round',
  'route','routine','row','rule','run','sacrifice','safety','sailor','sake','salad',
  'salary','sale','salt','sample','satisfaction','scale','scene','schedule','scheme','scholarship',
  'school','science','scientist','score','screen','script','sea','search','season','seat',
  'secret','secretary','section','sector','security','seed','segment','selection','self','senator',
  'sense','sensitivity','sentence','separation','sequence','series','servant','service','session','setting',
  'settlement','shadow','shape','share','sheep','sheet','shelf','shell','shelter','ship',
  'shock','shoe','shop','shore','short','shot','shoulder','show','side','sight',
  'sign','signal','signature','silence','silver','similarity','simplicity','sin','sincerity','singer',
  'sister','site','situation','size','skill','skin','sky','slave','sleep','slice',
  'smell','smile','smoke','snow','soap','society','soil','soldier','solution','song',
  'sort','soul','sound','soup','source','south','space','speaker','species','speech',
  'speed','spending','spirit','sport','spot','spring','square','stadium','staff','stage',
);
add('NOUN','B2','o',
  'stair','stamp','stance','standard','star','statement','station','status','steel','step',
  'stick','stock','stomach','stone','storage','store','storm','story','strain','stranger',
  'strategy','stream','street','strength','stress','stretch','strike','string','strip','stroke',
  'structure','struggle','student','studio','study','stuff','style','subject','substance','success',
  'sugar','suggestion','suit','summary','summer','sun','supply','support','surface','surgery',
  'surprise','survey','survival','suspect','suspicion','sweat','sweep','sympathy','symptom','system',
  'table','tail','tale','talent','tank','tape','target','task','taste','tax',
  'taxi','tea','teacher','team','tear','technique','technology','telephone','television','temper',
  'temperature','tendency','tension','term','territory','test','text','theater','theft','theme',
  'theory','therapy','thinking','thought','threat','throat','ticket','tide','tie','time',
  'tip','title','tobacco','toilet','tone','tongue','tool','tooth','top','topic',
  'tour','tourist','tower','town','track','trade','tradition','traffic','tragedy','trail',
  'train','trainer','transfer','transition','translation','transport','trap','travel','treasure','treatment',
  'tree','trial','triangle','tribe','trick','trip','triumph','troop','trouble','truck',
  'truth','tube','tunnel','turn','tutor','twin','twist','type','uncle','understanding',
  'uniform','union','unit','universe','university','user','usual','vacation','value','vehicle',
  'venture','version','victim','victory','view','village','violence','virus','vision','visit',
  'visitor','vocabulary','voice','volume','vote','voyage','wage','wall','war','warning',
  'watch','water','way','weakness','wealth','weapon','weather','website','wedding','week',
  'weekend','weight','welfare','west','wheel','whole','width','wife','will','wind',
  'window','wine','winner','winter','wisdom','witness','wonder','wood','word','work',
  'worker','workshop','world','worth','wound','writer','writing','yard','year','youth',
);

// ─────────── ADJECTIVES B1 ───────────
add('ADJ','B1','m',
  'able','absent','active','actual','additional','adequate','advanced','afraid','aggressive','alive',
  'amazing','ancient','angry','annual','anxious','apparent','appropriate','artificial','asleep','automatic',
  'available','average','awake','aware','basic','beautiful','blind','bored','boring','brave',
  'brief','bright','brilliant','broad','broken','busy','calm','capable','careful','careless',
  'central','certain','cheap','cheerful','chemical','civil','classic','clean','clear','clever',
  'close','cloudy','cold','colorful','comfortable','commercial','common','complete','complex','concerned',
  'confident','confused','conscious','conservative','considerable','consistent','constant','content','convenient','correct',
  'creative','critical','cruel','cultural','curious','current','damp','dangerous','dark','dead',
  'deaf','dear','deep','definite','delicate','delicious','dense','dependent','desperate','determined',
  'developed','different','difficult','digital','direct','dirty','disappointed','distant','distinct','diverse',
  'domestic','double','dramatic','dry','due','dull','dynamic','eager','early','easy',
  'economic','educational','effective','efficient','elderly','electric','electronic','elegant','emotional','empty',
  'enormous','enough','entire','environmental','equal','essential','ethical','ethnic','even','eventual',
  'evident','exact','excellent','excited','exciting','expensive','expert','external','extra','extreme',
  'fair','faithful','false','familiar','famous','fancy','far','fast','fat','fatal',
  'favorite','federal','few','final','financial','fine','firm','first','fit','flat',
);
add('ADJ','B1','m',
  'flexible','foreign','formal','former','fortunate','fragile','free','frequent','fresh','friendly',
  'frightened','front','full','fun','functional','funny','furious','general','generous','genuine',
  'gentle','genuine','glad','global','golden','good','gradual','grand','grateful','great',
  'green','grim','gross','guilty','handy','happy','hard','harmful','harsh','healthy',
  'heavy','helpful','hidden','high','historical','homeless','honest','honorable','hopeful','horrible',
  'hot','huge','human','humble','hungry','hurt','ideal','identical','illegal','imaginary',
  'immediate','immense','important','impossible','impressive','inadequate','independent','indirect','individual','industrial',
  'inevitable','infinite','informal','initial','inner','innocent','intelligent','intense','intentional','interested',
  'interesting','internal','international','invisible','involved','isolated','jealous','joint','junior','just',
  'keen','key','kind','large','last','late','lazy','leading','left','legal',
);
add('ADJ','B2','o',
  'legitimate','lengthy','liable','liberal','light','likely','limited','linear','liquid','literal',
  'literary','little','lively','local','logical','lonely','long','loose','loud','lovely',
  'low','loyal','lucky','mad','main','major','mandatory','marine','married','massive',
  'mature','maximum','mean','meaningful','mechanical','medical','medieval','medium','mental','mere',
  'middle','mild','military','minimum','minor','miserable','missing','mobile','moderate','modern',
  'modest','moral','mortal','mutual','mysterious','naive','naked','narrow','national','native',
  'natural','naughty','near','nearby','neat','necessary','negative','nervous','neutral','new',
  'next','nice','noble','noisy','normal','northern','noticeable','notorious','novel','nuclear',
  'numerous','objective','obvious','occasional','odd','offensive','official','old','ongoing','online',
  'open','operational','opposite','optimistic','oral','ordinary','organic','organizational','original','outdoor',
  'outer','outstanding','overall','overseas','overwhelming','pale','parallel','partial','particular','passionate',
  'passive','past','patient','peaceful','peculiar','perfect','permanent','personal','persuasive','physical',
  'plain','pleasant','plenty','plural','poetic','political','poor','popular','positive','possible',
  'potential','powerful','practical','precious','precise','predictable','preferable','pregnant','preliminary','premature',
  'present','previous','primary','prime','primitive','principal','prior','private','probable','productive',
  'professional','profitable','profound','progressive','prominent','prompt','proper','proportional','protective','proud',
);
add('ADJ','B2','o',
  'psychological','public','pure','quick','quiet','radical','random','rapid','rare','raw',
  'ready','real','realistic','reasonable','recent','reckless','redundant','regional','regular','relative',
  'relaxed','relevant','reliable','religious','reluctant','remarkable','remote','renowned','respectful','responsible',
  'restless','rich','right','rigid','ripe','rough','round','royal','rude','rural',
  'sacred','sad','safe','satisfactory','scared','scientific','secondary','secret','secure','selective',
  'self-conscious','sensible','sensitive','separate','serious','severe','sexual','shallow','sharp','shiny',
  'shocking','short','shy','sick','significant','silent','silly','similar','simple','single',
  'skilled','sleepy','slight','slim','slow','small','smart','smooth','social','soft',
  'solid','sophisticated','sore','sorry','sound','sour','southern','spare','special','specific',
  'spectacular','spiritual','splendid','spontaneous','stable','standard','steady','steep','sticky','stiff',
  'still','strange','strategic','strict','striking','strong','structural','stubborn','stunning','stupid',
  'subjective','subsequent','substantial','subtle','successful','sudden','sufficient','suitable','sunny','super',
  'superficial','superior','supreme','sure','surprised','surprising','suspicious','sweet','swift','symbolic',
  'systematic','talented','tall','technical','temporary','tender','tense','terrible','thick','thin',
  'thirsty','thorough','thoughtful','tight','tiny','tired','tough','toxic','traditional','tragic',
  'tremendous','tricky','true','typical','ultimate','unable','unaware','uncertain','uncomfortable','uncommon',
  'unconscious','underground','unexpected','unfair','unfortunate','unhappy','uniform','unique','united','universal',
  'unknown','unlikely','unnecessary','upper','upset','urban','urgent','useful','useless','usual',
  'vacant','vague','valid','valuable','various','vast','verbal','vertical','vicious','vigorous',
  'violent','virtual','visible','vital','vivid','vocal','voluntary','vulnerable','warm','wary',
  'wasteful','weak','wealthy','weary','weird','western','wet','wide','wild','willing',
  'wise','wonderful','wooden','worldwide','worried','worse','worth','worthless','worthwhile','worthy',
  'wrong','young','youthful','zealous',
);

// ─────────── ADVERBS B1/B2 ───────────
add('ADV','B1','m',
  'absolutely','actively','actually','almost','already','always','anywhere','approximately','automatically','briefly',
  'carefully','certainly','clearly','closely','commonly','completely','constantly','correctly','currently','daily',
  'deeply','definitely','directly','easily','effectively','elsewhere','entirely','equally','especially','eventually',
  'exactly','extremely','fairly','finally','firstly','formally','fortunately','frequently','fully','generally',
  'gently','gradually','hardly','heavily','honestly','immediately','indeed','initially','instead','largely',
  'lately','later','lightly','likely','literally','mainly','merely','mostly','naturally','nearly',
  'never','normally','nowadays','obviously','occasionally','officially','often','originally','particularly','perfectly',
  'perhaps','personally','possibly','potentially','practically','precisely','presently','previously','primarily','probably',
);
add('ADV','B2','o',
  'promptly','properly','quickly','quietly','quite','rarely','rather','readily','really','recently',
  'regularly','relatively','reluctantly','repeatedly','roughly','seemingly','seldom','seriously','severely','sharply',
  'shortly','significantly','similarly','simply','slightly','slowly','smoothly','softly','somehow','somewhat',
  'soon','specifically','steadily','still','strictly','strongly','subsequently','successfully','suddenly','surely',
  'surprisingly','technically','temporarily','thoroughly','thus','tightly','together','traditionally','truly','typically',
  'ultimately','unfortunately','unusually','urgently','usually','vaguely','vastly','virtually','visibly','widely',
  'wisely','accordingly','barely','besides','consequently','effectively','elsewhere','furthermore','hence','however',
  'meanwhile','moreover','nevertheless','nonetheless','otherwise','overall','therefore','wherever','whereas','whenever',
);

// ─────────── PREP / CONJ / INTJ B1/B2 ───────────
add('PREP','B1','m',
  'above','across','against','along','alongside','amid','among','around','aside','behind',
  'below','beneath','beside','between','beyond','despite','during','except','inside','outside',
  'past','through','throughout','toward','underneath','versus','via','within','without',
);
add('CONJ','B1','m',
  'although','because','before','either','neither','since','though','unless','until','whereas',
  'whether','while',
);
add('PRON','B1','m',
  'anybody','anyone','anything','everybody','everyone','everything','itself','myself','nobody','none',
  'oneself','ourselves','somebody','someone','themselves','whoever','whomever','yourself',
);
add('DET','B1','m',
  'another','either','enough','every','neither','several',
);
add('INTJ','B2','r',
  'alas','bravo','farewell','hooray','indeed','nonsense','ouch','phew','wow',
);

// Dedup + filter to B1/B2 only
const seen = new Set();
const lemmas = [];
for (const [lemma, pos, cefr, tier] of D) {
  if (cefr !== 'B1' && cefr !== 'B2') continue;
  if (seen.has(lemma)) continue;
  seen.add(lemma);
  lemmas.push({ lemma, pos, cefr, tier });
}

// Rationale templates by POS
const RAT = {
  VERB:  '학술·논설문 빈출 동사',
  NOUN:  '개념·사회 주제 빈출 명사',
  ADJ:   '논설·묘사 빈출 형용사',
  ADV:   '논리 흐름 빈출 부사',
  PREP:  '문법 필수 전치사',
  CONJ:  '복문 연결 접속사',
  PRON:  '지시·재귀 대명사',
  DET:   '한정사 어휘',
  INTJ:  '감정 표현 감탄사',
};
const TIER_MAP = { c: 'core', m: 'common', o: 'moderate', r: 'rare' };
const CONF = { c: 0.92, m: 0.85, o: 0.75, r: 0.60 };

const lines = lemmas.map((x) => JSON.stringify({
  lemma: x.lemma,
  pos: x.pos,
  cefr_estimate: x.cefr,
  frequency_tier: TIER_MAP[x.tier],
  rationale_short: RAT[x.pos],
  confidence: CONF[x.tier],
}));

fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
fs.writeFileSync(OUTPUT_PATH, lines.join('\n') + '\n', { encoding: 'utf8' });

// Stats
const dist = { B1: 0, B2: 0 };
const posDist = {};
let confSum = 0;
for (const x of lemmas) {
  dist[x.cefr]++;
  posDist[x.pos] = (posDist[x.pos] || 0) + 1;
  confSum += CONF[x.tier];
}
console.log(`Total: ${lemmas.length}`);
console.log(`CEFR: B1=${dist.B1}, B2=${dist.B2}`);
console.log(`POS:`, posDist);
console.log(`Confidence avg: ${(confSum / lemmas.length).toFixed(3)}`);
console.log(`Output: ${OUTPUT_PATH}`);
