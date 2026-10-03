// scripts/design/remaining-learning-audit.mjs
// 전 제품 Tines 라우트의 연결 소스에서 반복 구조 후보를 찾는다. 렌더/DB 호출 없음.
// 후보는 실제 화면 판정이 아니다. 완료/진행/미검증을 분리해 잔여를 숨기지 않는다.
import fs from 'node:fs'
import path from 'node:path'
import { ROOT } from './lib/ref-page.mjs'
const app=path.join(ROOT,'apps/web/src/app'), src=path.join(ROOT,'apps/web/src')
const routes=[]
function resolve(from,spec) {
  const base=spec.startsWith('@/')?path.join(src,spec.slice(2)):spec.startsWith('.')?path.resolve(path.dirname(from),spec):null
  if(!base) return null
  return ['', '.tsx','.ts','.js','.mjs','/index.tsx','/index.ts'].map(ext=>base+ext).find(file=>fs.existsSync(file)&&fs.statSync(file).isFile())
}
function graph(file,seen=new Set()) {
  if(seen.has(file)) return seen
  seen.add(file)
  const source=fs.readFileSync(file,'utf8')
  for(const match of source.matchAll(/(?:from\s*|import\s*(?:\(\s*)?)['"]([^'"]+)['"]/g)) {
    const child=resolve(file,match[1])
    if(child && child.startsWith(src+path.sep)) graph(child,seen)
  }
  return seen
}
function renderedGraph(file) {
  const seen=graph(file)
  let dir=path.dirname(file)
  while(dir.startsWith(app)) {
    const layout=path.join(dir,'layout.tsx')
    if(fs.existsSync(layout))graph(layout,seen)
    if(dir===app)break
    dir=path.dirname(dir)
  }
  return seen
}
function walk(dir) {
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})) {
    const file=path.join(dir,entry.name)
    if(entry.isDirectory()) walk(file)
    else if(entry.name==='page.tsx') {
      const route='/'+path.relative(app,dir).split(path.sep).filter(s=>!/^\(.+\)$/.test(s)).join('/')
      if(/^\/(admin|csat|dev)(\/|$)/.test(route)) continue
      const evidence=[]
      const dependencies=[...renderedGraph(file)]
      for(const dependency of dependencies) {
        // 모바일 전용 구성의 미감은 대상이 아니지만 PC 공통 부품/팝업은 제외하지 않는다.
        if(/components[\\/]layout[\\/]Mobile[^\\/]+\.tsx$/.test(dependency)) continue
        const source=fs.readFileSync(dependency,'utf8')
        source.split(/\r?\n/).forEach((line,i)=>{
          const signals=[]
          if(/max-w-(?:md|lg|xl|[2-5]xl)|max-w-\[var\(--ios-content/.test(line)) signals.push('중앙 고정폭')
          if(/className=.*(?:rounded.*(?:border|shadow)|(?:border|shadow).*rounded)/.test(line)) signals.push('사각 패널')
          if(/role="dialog"|aria-modal="true"/.test(line)) signals.push('자체 팝업')
          if(/bg-gradient|linear-gradient\(.*#|--(?:wo|pq)-.*(?:#|rgba)/.test(line)) signals.push('지역 그라데이션/팔레트')
          if(signals.length) evidence.push({file:path.relative(ROOT,dependency).replaceAll('\\','/'),line:i+1,signals})
        })
      }
      routes.push({route,file:path.relative(ROOT,file).replaceAll('\\','/'),dependencies:dependencies.map(dep=>path.relative(ROOT,dep).replaceAll('\\','/')),dynamic:route.includes('['),evidence,status:['/dashboard','/plan','/reports','/library/books'].includes(route)?'실제 셸 PC 4조건 렌더 + 격리 기능 검증':['/diagnostic','/diagnostic/history','/settings'].includes(route)?'격리 PC 상태 검증':/^\/pairflip(\/|$)/.test(route)?'격리 PC 흐름 검증':route==='/play/word-orrery'?'격리 PC 흐름 검증':route==='/play/pirate-quest'?'UI 상태 검증 / 3D 전체 흐름 잔여':['/flashcard','/spellforge','/text'].includes(route)?'공통 머리 적용 / 본문 잔여':route==='/hub'?'이전 회차 적용 검증':'정상 렌더 및 요소 대조 잔여'})
    }
  }
}
walk(app);routes.sort((a,b)=>a.route.localeCompare(b.route))
// 이전 그래프가 import(...)를 놓쳐 두 게임을 0 후보로 보고했다. 결과를 쓰기 전에
// 실제 동적 게임 본체가 연결됐는지 확인하며, 조용히 빠진 목록은 발행하지 않는다.
for(const [route,body] of [['/play/word-orrery','/WordOrreryGame.tsx'],['/play/pirate-quest','/PirateQuestGame.tsx']]) {
  const item=routes.find(item=>item.route===route)
  if(!item?.dependencies.some(file=>file.endsWith(body)))throw new Error(`동적 본체 추적 누락: ${route}`)
}
const diagnostic=routes.find(item=>item.route==='/diagnostic')
for(const shared of ['/layout/ModuleBanner.tsx','/layout/SessionFrame.tsx','/ui/Dialog.tsx']) {
  if(!diagnostic?.dependencies.some(file=>file.endsWith(shared)))throw new Error(`공통 레이아웃/팝업 추적 누락: ${shared}`)
  if(!diagnostic.evidence.some(item=>item.file.endsWith(shared)))throw new Error(`공통 레이아웃/팝업 후보 조사 누락: ${shared}`)
}
const out=path.join(ROOT,'tmp/tines-adoption/remaining-inventory.json')
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify({mode:'source-only',routes},null,2)+'\n')
const lines=['# PC 학습/공개 Tines 잔여 소스 목록','','자동 소스 후보이며 AI 미감/정상 화면 판정이 아니다. 관리자·CSAT는 3B, 개발 화면과 모바일 전용 구성은 제외한다. 페이지·조상 layout·공통 UI/팝업까지 연결해 고정 폭·사각 패널·자체 팝업·지역 팔레트를 조사했다. 같은 공통 컴포넌트가 여러 라우트에 연결되면 각 행에 나타난다. 후보 수는 미완료 판정이 아니며 현재 상태는 실제 검증 범위를 따로 기록한다. `scripts/design/remaining-learning-audit.mjs` 재실행으로 갱신한다.','','| 라우트 | 소스 후보 수 | 현재 검증 범위 | 후보 대표 소스 |','|---|---:|---|---|']
for(const item of routes) {const lead=item.evidence[0];lines.push(`| ${item.route} | ${item.evidence.length} | ${item.status} | ${lead?`${lead.file}:${lead.line}`:'후보 없음(렌더 미판정)'} |`)}
fs.writeFileSync(path.join(ROOT,'docs/design/remaining-inventory.md'),lines.join('\n')+'\n')
console.log(JSON.stringify({routes:routes.length,dynamic:routes.filter(r=>r.dynamic).length,candidates:routes.filter(r=>r.evidence.length).length,realDbCalls:0,out}))
