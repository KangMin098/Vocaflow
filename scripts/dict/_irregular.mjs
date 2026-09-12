// scripts/dict/_irregular.mjs
// 불규칙 굴절표 — 예문 게이트의 표제어 매칭에 쓴다.
//
// 왜 따로 두나: 이 표가 없으면 `wring` 의 `wrung` · `befall` 의 `befell` 같은 예문이
//   "표제어가 없다" 로 **조용히 버려진다.** w0830-senseex 가 배치 도중 같은 함정을 세 번 겪고
//   표를 세 차례 보강했는데, 뒤에 만든 w0830-exfix 가 그 표 없이 매처만 베껴 가서 **또 겪었다**.
//   같은 표를 두 곳에 두면 한 곳만 고쳐지고 다른 곳은 계속 버린다 — 그래서 한 파일로 뺀다.
//
// ⚠️ w0830-senseex.mjs 는 아직 자기 사본을 쓴다. 그 배치는 완주해 stamped 라 지금 바꿔도
//   결과가 달라지지 않지만, **다음에 손댈 때 이 파일을 import 하도록 통합할 것.**

export const IRREGULAR = {
  be: ['was', 'were', 'been', 'is', 'are', 'am'], begin: ['began', 'begun'], break: ['broke', 'broken'],
  bring: ['brought'], buy: ['bought'], catch: ['caught'], come: ['came'], do: ['did', 'does', 'done'],
  draw: ['drew', 'drawn'], drive: ['drove', 'driven'], eat: ['ate', 'eaten'], fall: ['fell', 'fallen'],
  feel: ['felt'], fight: ['fought'], find: ['found'], fly: ['flew', 'flown'], get: ['got', 'gotten'],
  give: ['gave', 'given'], go: ['went', 'gone', 'goes'], grow: ['grew', 'grown'], hang: ['hung'],
  have: ['had', 'has'], hear: ['heard'], hold: ['held'], keep: ['kept'], know: ['knew', 'known'],
  lay: ['laid'], lead: ['led'], leave: ['left'], lose: ['lost'], make: ['made'], mean: ['meant'],
  meet: ['met'], pay: ['paid'], rise: ['rose', 'risen'], run: ['ran'], say: ['said', 'says'],
  see: ['saw', 'seen'], sell: ['sold'], send: ['sent'], sit: ['sat'], speak: ['spoke', 'spoken'],
  stand: ['stood'], take: ['took', 'taken'], teach: ['taught'], tell: ['told'], think: ['thought'],
  throw: ['threw', 'thrown'], win: ['won'], write: ['wrote', 'written'], child: ['children'],
  foot: ['feet'], man: ['men'], person: ['people'], tooth: ['teeth'], woman: ['women'], mouse: ['mice'],
  will: ['would'], can: ['could'], shall: ['should'], may: ['might'],
  // 아래 묶음은 w0817-colloc 의 원본 표에 없던 것들이다 — `choose` 의 과거형 `chose` 를 쓴 예문이
  // `no_headword` 로 **조용히 버려지고** 있었다(배치 도중 발견). 없는 불규칙은 오탐이 아니라 손실이다.
  choose: ['chose', 'chosen'], forget: ['forgot', 'forgotten'], sing: ['sang', 'sung'],
  ring: ['rang', 'rung'], wear: ['wore', 'worn'], sleep: ['slept'], spend: ['spent'],
  build: ['built'], understand: ['understood'], hide: ['hid', 'hidden'], shake: ['shook', 'shaken'],
  steal: ['stole', 'stolen'], swim: ['swam', 'swum'], tear: ['tore', 'torn'], wake: ['woke', 'woken'],
  bite: ['bit', 'bitten'], blow: ['blew', 'blown'], freeze: ['froze', 'frozen'], ride: ['rode', 'ridden'],
  shoot: ['shot'], sink: ['sank', 'sunk'], strike: ['struck'], stick: ['stuck'], lend: ['lent'],
  spread: ['spread'], deal: ['dealt'], dig: ['dug'], seek: ['sought'], shine: ['shone'],
  slide: ['slid'], swear: ['swore', 'sworn'], sweep: ['swept'], bend: ['bent'], bind: ['bound'],
  breed: ['bred'], burst: ['burst'], creep: ['crept'], flee: ['fled'], forgive: ['forgave', 'forgiven'],
  grind: ['ground'], kneel: ['knelt'], lie: ['lay', 'lain'], mistake: ['mistook', 'mistaken'],
  arise: ['arose', 'arisen'], awake: ['awoke', 'awoken'], beat: ['beaten'], become: ['became'],
  bleed: ['bled'], feed: ['fed'], hurt: ['hurt'], cost: ['cost'], quit: ['quit'], prove: ['proven'],
  light: ['lit'], lean: ['leant'], leap: ['leapt'], weep: ['wept'], split: ['split'], shrink: ['shrank', 'shrunk'],
  // 합성 동사 — 어간 truncation(5자 초과면 뒤 2자 절단)이 `undertake → undertak` 을 만들어
  // `undertook` 과 안 맞는다. 접두사가 붙은 불규칙은 따로 적어야 한다.
  undertake: ['undertook', 'undertaken'], overcome: ['overcame'], become: ['became'],
  understand: ['understood'], withdraw: ['withdrew', 'withdrawn'], overtake: ['overtook', 'overtaken'],
  forecast: ['forecast'], rebuild: ['rebuilt'], outgrow: ['outgrew', 'outgrown'],
  // 3차 보강 — 배치 중 서브에이전트가 "이 예문이 조용히 버려진다" 고 잡아낸 것들.
  // 어간 절단(5자 초과 시 뒤 2자)이 `stride → strid` 를 만들어 `strode` 와 안 맞는 유형이다.
  strive: ['strove', 'striven'], cling: ['clung'], stride: ['strode', 'stridden'],
  thrive: ['throve', 'thriven'], weave: ['wove', 'woven'], swell: ['swollen'],
  sow: ['sown'], slay: ['slew', 'slain'], spit: ['spat'], spin: ['spun'],
  sting: ['stung'], swing: ['swung'], spring: ['sprang', 'sprung'], stink: ['stank', 'stunk'],
  tread: ['trod', 'trodden'], wring: ['wrung'], wind: ['wound'], uphold: ['upheld'],
  withhold: ['withheld'], foresee: ['foresaw', 'foreseen'], mislead: ['misled'],
  oversee: ['oversaw', 'overseen'], undergo: ['underwent', 'undergone'], withstand: ['withstood'],
  forsake: ['forsook', 'forsaken'], cleave: ['cleft', 'clove'], plead: ['pled'],
  strew: ['strewn'], thrust: ['thrust'], upset: ['upset'], shed: ['shed'], rid: ['rid'],
  knit: ['knitted', 'knit'], slit: ['slit'], flee: ['fled'], dwell: ['dwelt'],
  shear: ['shorn', 'sheared'], sling: ['slung'], slink: ['slunk'], smite: ['smote', 'smitten'],
  spill: ['spilt'], spoil: ['spoilt'], burn: ['burnt'], dream: ['dreamt'], 
}

export const irregularOf = (t) => (Object.hasOwn(IRREGULAR, t) ? IRREGULAR[t] : [])
