import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {createRequire} from 'node:module'
const dir=path.dirname(fileURLToPath(import.meta.url)),wt='D:/workspace/Vocaflow-final-product'
const req=createRequire(wt+'/apps/web/package.json'),vite=createRequire(req.resolve('vitest/package.json'))('vite'),{chromium}=req('@playwright/test')
const tw=req('tailwindcss/loadConfig')(wt+'/apps/web/tailwind.config.ts');tw.content=[wt+'/apps/web/src/app/admin/knowledge/{design,product}/page.tsx',wt+'/apps/web/src/components/admin/knowledge/*.tsx']
const server=await vite.createServer({configFile:false,root:dir,logLevel:'error',css:{postcss:{plugins:[req('tailwindcss')(tw)]}},server:{host:'127.0.0.1',port:0,fs:{allow:[dir,wt]}}})
let browser;const rows=[]
try{
 await server.listen();const origin='http://127.0.0.1:'+server.httpServer.address().port
 browser=await chromium.launch({headless:true})
 for(const width of [1440,1280])for(const screen of ['design','product'])for(const state of ['mixed','empty','error']){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[]
  page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/'+screen+'-'+state+'.html');await page.waitForTimeout(350)
  const text=(await page.locator('body').innerText()).replace(/\s+/g,' ')
  const checks={render:await page.locator('h1').count()===1,overflow:await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),noErrors:errors.length===0,styles:await page.locator('h1').evaluate(e=>Number.parseFloat(getComputedStyle(e).fontSize)>=20)}
  if(state==='mixed')Object.assign(checks,{onlyCurrentResult:(text.match(/효과 지지/g)||[]).length===1,syntheticExcluded:text.includes('효과 근거 아님'),unknownExplained:text.includes('확인 불가(결과를 근거로 쓰지 않음)'),staleExplained:text.includes('재계산 필요(결과를 근거로 쓰지 않음)'),noActualClaim:!text.includes('실제 학습자')})
  if(state==='empty')checks.empty=screen==='design'?text.includes('검증 계획 없음'):text.includes('검증 0(비합성 표시 0 · 현재 분석 0 · 재계산 필요 0)')
  if(state==='error')checks.error=text.includes('불러오지 못했습니다')&&!text.includes('검증 0')
  await page.keyboard.press('Tab');checks.keyboard=await page.evaluate(()=>document.activeElement?.tagName==='A');checks.namedLinks=await page.locator('a').evaluateAll(a=>a.every(e=>Boolean(e.textContent.trim())&&e.getAttribute('href')?.startsWith('/')))
  const screenshot=screen+'-'+state+'-'+width+'.png';await page.screenshot({path:path.join(dir,screenshot),fullPage:true})
  rows.push({screen,state,width,checks,passed:Object.values(checks).every(Boolean),screenshot,url:page.url(),errors,text});await page.close()
 }
}finally{await browser?.close();await server.close();fs.writeFileSync(path.join(dir,'results.json'),JSON.stringify({environment:'Actual source RSC pages with mocked loaders + compiled source Tailwind/globals/admin skin, actual Chromium. Static RSC HTML; forms stubbed, not authenticated Next or DB, no full admin reference or effect certification.',commit:'f14d7beb5d87d3952b4eccde0c58b5c34390917d',passed:rows.filter(x=>x.passed).length,failed:rows.filter(x=>!x.passed).length,rows},null,2)+'\n')}
console.log(JSON.stringify({passed:rows.filter(x=>x.passed).length,failed:rows.filter(x=>!x.passed).map(x=>({screen:x.screen,state:x.state,width:x.width,checks:x.checks}))},null,2))
