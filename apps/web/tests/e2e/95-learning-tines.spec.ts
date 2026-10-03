// apps/web/tests/e2e/95-learning-tines.spec.ts
// 실제 컴포넌트의 PC 상태/흐름 회귀. 격리 하네스만 허용하고 모든 외부 요청을 차단한다.
import fs from 'node:fs'
import path from 'node:path'
import { spawn, type ChildProcess } from 'node:child_process'
import { test, expect, type Page, type Locator } from '@playwright/test'
import { MOCK_PAIRS } from '../../src/components/pairflip/mock-data'

const before = process.env.LEARNING_PHASE === 'before'
const base = `http://127.0.0.1:${before ? 3030 : 3031}`
const out = path.resolve(__dirname, `../../../../tmp/tines-adoption/remaining-${before?'before':'after'}`)
const externalRequests = new WeakMap<Page,string[]>()
const runtimeErrors = new WeakMap<Page,string[]>()
let harness: ChildProcess | undefined
test.beforeAll(async()=>{
  test.setTimeout(120000)
  const ready=async()=>{
    try {const response=await fetch(base,{signal:AbortSignal.timeout(1000)});if(response.ok && response.headers.get('X-Vocaflow-Learning-Harness')==='isolated-component')return true;if(response.ok)throw new Error('3030/3031에 다른 서버가 실행 중입니다');return false}
    catch(error){if(error instanceof Error && error.message.includes('다른 서버'))throw error;return false}
  }
  if(await ready())return
  harness=spawn(process.execPath,[path.resolve(__dirname,'../../../../scripts/design/learning-harness.mjs'),...(before?['--before']:[])],{cwd:path.resolve(__dirname,'../../../..'),windowsHide:true,stdio:'ignore'})
  let failure: Error | undefined
  harness.on('error',error=>{failure=error})
  for(let attempt=0;attempt<180;attempt++) {
    if(failure || harness.exitCode!==null)throw failure ?? new Error('격리 하네스 시작 실패')
    if(await ready())return
    await new Promise(resolve=>setTimeout(resolve,250))
  }
  throw new Error('격리 하네스 준비 시간 초과')
})
test.afterAll(async()=>{
  if(!harness)return
  const child=harness
  await new Promise<void>(resolve=>{if(child.exitCode!==null)return resolve();child.once('exit',()=>resolve());child.kill()})
})
test.beforeEach(async ({ page }) => {
  test.setTimeout(120000)
  fs.mkdirSync(out,{recursive:true})
  externalRequests.set(page,[])
  runtimeErrors.set(page,[])
  page.on('pageerror',error=>runtimeErrors.get(page)!.push(error.message))
  await page.route('**/*',route=>{if(new URL(route.request().url()).origin===base)return route.continue();externalRequests.get(page)!.push(route.request().url());return route.abort('blockedbyclient')})
  await page.clock.setSystemTime(new Date('2026-10-03T12:00:00Z'))
})
async function shot(page: Page,name: string) { if(!before && await page.locator('.diagnostic-modal').count()) await expect(page.locator('.diagnostic-modal')).toHaveCSS('opacity','1');await page.screenshot({path:path.join(out,`${name}.png`),fullPage:true}) }
async function contrast(locator: Locator,property: 'color'|'outlineColor' = 'color') {
  return locator.evaluate((node,field)=>{
    const lum=(color:string)=>color.match(/[\d.]+/g)!.slice(0,3).map(Number).map(v=>{const c=v/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4}).reduce((s,c,i)=>s+c*[.2126,.7152,.0722][i],0)
    let surface:Element|null=node
    while(surface && getComputedStyle(surface).backgroundColor==='rgba(0, 0, 0, 0)') surface=surface.parentElement
    const a=lum(getComputedStyle(node)[field]), b=lum(surface?getComputedStyle(surface).backgroundColor:'rgb(252,249,245)')
    return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)
  },property)
}
async function open(page: Page,screen:string,width:number,dark:boolean,extra='') {
  await page.setViewportSize({width,height:900})
  await page.emulateMedia({reducedMotion:'reduce',colorScheme:dark?'dark':'light'})
  await page.addInitScript(theme=>{
    localStorage.setItem('vocaflow-theme',theme)
    const apply=()=>document.documentElement.dataset.theme=theme
    if(document.documentElement)apply();else document.addEventListener('DOMContentLoaded',apply,{once:true})
  },dark?'dark':'light')
  await page.goto(`${base}/?screen=${encodeURIComponent(screen)}${extra}`)
  await expect(page.locator('html')).toHaveAttribute('data-theme',dark?'dark':'light')
  const surface=await page.evaluate(()=>getComputedStyle(document.body).backgroundColor)
  if(!before && !dark) expect(surface).toBe('rgb(252, 249, 245)')
  if(dark) expect(surface).not.toBe('rgb(252, 249, 245)')
}
async function safe(page:Page) {
  expect(externalRequests.get(page)).toEqual([])
  expect(runtimeErrors.get(page)).toEqual([])
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1)
  expect(await page.evaluate(()=>performance.getEntriesByType('resource').filter(item=>!item.name.startsWith(location.origin)).length)).toBe(0)
}
for(const width of [1440,1280]) for(const dark of [false,true]) {
  const condition=`${width}-${dark?'dark':'light'}`
  test(`진단 전체 상태 ${condition}`,async({page})=>{
    await open(page,'/diagnostic',width,dark)
    await expect(page.getByRole('heading',{name:'어휘 진단',exact:true})).toBeVisible()
    await expect(page.getByRole('button',{name:'진단 시작',exact:true})).toBeVisible()
    if(!before) {
      expect(await page.locator('.diagnostic-intro h1').evaluate(node=>getComputedStyle(node).fontSize)).toBe('64px')
      expect(await contrast(page.locator('.diagnostic-intro h1'))).toBeGreaterThanOrEqual(3)
      for(const card of await page.locator('.diagnostic-goal').all()) expect(await contrast(card.locator('p').first())).toBeGreaterThanOrEqual(3)
      expect(new Set(await page.locator('.diagnostic-goal').evaluateAll(nodes=>nodes.map(node=>getComputedStyle(node).backgroundColor))).size).toBe(4)
    }
    await shot(page,`diagnostic-${condition}`)
    await page.getByRole('button',{name:'안내',exact:true}).click()
    const dialog=page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await shot(page,`diagnostic-info-${condition}`)
    if(!before) {
      await page.keyboard.press('Tab')
      for(let i=0;i<12;i++) {await page.keyboard.press('Tab');expect(await dialog.evaluate(node=>node.contains(document.activeElement))).toBe(true)}
    }
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    if(!before) await expect(page.getByRole('button',{name:'안내',exact:true})).toBeFocused()
    await page.getByRole('button',{name:'레벨 안내 보기'}).click()
    await expect(dialog).toBeVisible()
    await shot(page,`diagnostic-level-${condition}`)
    await page.keyboard.press('Escape')
    await page.getByRole('button',{name:'진단 시작',exact:true}).click()
    await expect(page.getByText('evolution',{exact:true})).toBeVisible()
    await shot(page,`diagnostic-question-${condition}`)
    await page.getByRole('button',{name:'알아요',exact:true}).click()
    await page.getByRole('button',{name:/진단 멈추기/}).click()
    await expect(page.getByText(/하다 만 진단이 있어요/)).toBeVisible()
    await page.getByRole('button',{name:'이어서 하기',exact:true}).click()
    await expect(page.getByText('adapt',{exact:true})).toBeVisible()
    for(let i=0;i<5;i++) await page.getByRole('button',{name:i%2===0?'알아요':'모릅니다',exact:true}).click()
    await expect(page.getByText('진단 완료 · 내 수준은')).toBeVisible()
    await shot(page,`diagnostic-result-${condition}`)
    if(!before) {
      const levelButton=page.locator('.diagnostic-result-level button')
      await page.keyboard.press('Tab')
      await levelButton.focus()
      await expect(levelButton).toHaveCSS('outline-style','solid')
      expect(await contrast(levelButton,'outlineColor')).toBeGreaterThanOrEqual(3)
    }
    await page.getByRole('button',{name:/이 레벨이 뭔가요/}).click()
    await expect(dialog).toBeVisible();await page.keyboard.press('Escape')
    await page.getByRole('button',{name:'의학 영어',exact:true}).click()
    await expect(page.getByRole('button',{name:'의학 영어',exact:true})).toHaveAttribute('aria-pressed','true')
    await page.getByRole('button',{name:/담고 첫 카드 학습 시작/}).click()
    await expect(page.locator('[data-destination]')).toHaveAttribute('data-destination','/flashcard/play')
    expect(await page.evaluate(()=> (window as unknown as {learningAudit:{writes:unknown[]}}).learningAudit.writes.length)).toBeGreaterThanOrEqual(3)
    await safe(page)
  })
  test(`PairFlip 설정 플레이 결과 ${condition}`,async({page})=>{
    await open(page,'/pairflip',width,dark)
    await expect(page.getByRole('heading',{name:'PairFlip',exact:true})).toBeVisible()
    await page.getByRole('radio',{name:/^Easy/}).click()
    await expect(page.getByRole('radio',{name:/^Easy/})).toHaveAttribute('aria-checked','true')
    await shot(page,`pairflip-setup-${condition}`)
    await page.getByRole('button',{name:'게임 시작'}).click()
    await expect(page.locator('.pf-card')).toHaveCount(8)
    await shot(page,`pairflip-play-${condition}`)
    await page.getByRole('button',{name:/힌트 사용/}).click()
    await expect(page.getByRole('button',{name:/힌트 사용 — 남은 1회/})).toBeVisible()
    await page.waitForTimeout(1100)
    for(const pair of MOCK_PAIRS) {
      const word=page.locator('.pf-card').filter({has:page.getByText(pair.word,{exact:true})})
      if(!await word.count()) continue
      await word.click()
      await page.locator('.pf-card').filter({has:page.getByText(pair.meaning,{exact:true})}).click()
      await page.waitForTimeout(750)
    }
    await expect(page.getByText('학습한 단어',{exact:true})).toBeVisible({timeout:15000})
    await shot(page,`pairflip-result-${condition}`)
    await page.getByRole('button',{name:/학습한 단어/}).click()
    await expect(page.getByRole('button',{name:/학습한 단어/})).toHaveAttribute('aria-expanded','false')
    await page.getByRole('link',{name:'PairFlip 홈으로'}).click()
    await expect(page.getByRole('heading',{name:'PairFlip',exact:true})).toBeVisible()
    await safe(page)
  })
  test(`Orrery 지도 관측 핵 결과 ${condition}`,async({page})=>{
    await open(page,'/play/word-orrery',width,dark)
    await expect(page.locator('.wo-orrery')).toBeVisible()
    await shot(page,`orrery-map-${condition}`)
    if(!before) expect(await contrast(page.locator('.wo-help'))).toBeGreaterThanOrEqual(4.5)
    for(let i=0;i<6 && await page.locator('.wo-sun--locked').count();i++) {
      await page.locator('.wo-planet').nth(i).click()
      await expect(page.locator('.wo-panel')).toBeVisible()
      await shot(page,`orrery-observe-${condition}-${i}`)
      await page.locator('.wo-chip').first().click()
      await expect(page.locator('.wo-say')).toBeVisible()
      await page.getByRole('button',{name:'성계로 돌아가기',exact:true}).click()
    }
    await page.locator('.wo-sun').click()
    await expect(page.locator('.wo-core')).toBeVisible()
    await shot(page,`orrery-core-${condition}`)
    for(let i=0;i<6 && await page.locator('.wo-core').count();i++) {
      if(await page.locator('.wo-reveal--seal').count()) {
        await page.locator('.wo-reveal--seal .wo-cta').click()
        continue
      }
      const riddle=await page.locator('.wo-riddle').innerText()
      const answer=MOCK_PAIRS.find(pair=>riddle.includes(pair.meaning))!.word
      if(await page.locator('.wo-tiles').count()) {
        for(const letter of answer) await page.locator('.wo-tile[aria-disabled="false"]').filter({hasText:new RegExp(`^${letter}$`,'i')}).first().click()
        await page.getByRole('button',{name:'새기다',exact:true}).click()
      } else await page.locator('.wo-choices .wo-chip').filter({hasText:new RegExp(`^${answer}$`)}).click()
      await expect(page.locator('.wo-reveal--seal')).toBeVisible()
      await shot(page,`orrery-reveal-${condition}-${i}`)
      await page.locator('.wo-reveal--seal .wo-cta').click()
    }
    await expect(page.locator('.gk-done')).toBeVisible()
    await shot(page,`orrery-result-${condition}`)
    await safe(page)
  })
  test(`Pirate UI 모든 상태 ${condition}`,async({page})=>{
    for(const phase of ['loading','scan','haul','choice','recall','reveal','settle','done']) {
      await open(page,`pirate:${phase}`,width,dark)
      const surface=page.locator(phase==='loading'?'.pq-gate':phase==='done'?'.gk-done':'.pq-deck')
      await expect(surface).toBeVisible()
      if(phase==='choice') await expect(page.getByRole('button',{name:/확정 \+80/})).toBeVisible()
      if(phase==='haul') await expect(page.locator('.pq-ask')).toHaveText(MOCK_PAIRS[0].meaning)
      await shot(page,`pirate-${phase}-${condition}`)
      await safe(page)
    }
  })
  test(`설정 레일과 저장 ${condition}`,async({page})=>{
    await open(page,'/settings',width,dark)
    await expect(page.getByRole('heading',{name:'설정',exact:true})).toBeVisible()
    await shot(page,`settings-${condition}`)
    await page.getByRole('radio',{name:'Long (5s)',exact:true}).click()
    await expect(page.getByRole('radio',{name:'Long (5s)',exact:true})).toHaveAttribute('aria-checked','true')
    await expect(page.getByRole('status')).toHaveText('저장됨')
    await page.reload()
    await expect(page.getByRole('radio',{name:'Long (5s)',exact:true})).toHaveAttribute('aria-checked','true')
    await page.getByRole('link',{name:'Voice',exact:true}).click()
    await expect(page.locator('#audio')).toBeInViewport()
    await safe(page)
  })
  test(`진단 기록 시간축 ${condition}`,async({page})=>{
    await open(page,'/diagnostic/history',width,dark)
    await expect(page.getByRole('heading',{name:'V-Level 변천사'})).toBeVisible()
    await expect(page.locator('ol > li')).toHaveCount(2)
    await shot(page,`diagnostic-history-${condition}`)
    await safe(page)
  })
}
test('Pirate UI 선택·교정·재시작 연결',async({page})=>{
  await open(page,'pirate:choice',1440,false)
  await page.getByRole('button',{name:/확정 \+80/}).click()
  await expect(page.locator('.pq-deck')).toHaveAttribute('data-phase','settle')
  await open(page,'pirate:recall',1440,false)
  await page.locator('.pq-btn--recall').first().click()
  await expect(page.locator('.pq-deck')).toHaveAttribute('data-phase','reveal')
  await page.getByRole('button',{name:/계속/}).click()
  await expect(page.locator('.pq-deck')).toHaveAttribute('data-phase','scan')
  await page.getByRole('button',{name:'나가기',exact:true}).click()
  await expect(page.locator('.gk-done')).toBeVisible()
  await page.getByRole('button',{name:/다시/}).click()
  await expect(page.locator('.pq-deck')).toHaveAttribute('data-phase','scan')
  await safe(page)
})
test('진단 첫 방문과 빈 기록',async({page})=>{
  await open(page,'/diagnostic',1440,false,'&cold')
  await expect(page.getByRole('heading',{name:'어휘 진단',exact:true})).toBeVisible()
  await expect(page.locator('.diagnostic-previous')).toHaveCount(0)
  await shot(page,'diagnostic-first')
  await open(page,'/diagnostic/history',1440,false,'&cold')
  await expect(page.getByText('아직 V-Level 기록이 없어요.',{exact:true})).toBeVisible()
  await shot(page,'diagnostic-history-empty')
  await safe(page)
})
test('진단 제출 실패 후 답을 보존해 재시도',async({page})=>{
  await open(page,'/diagnostic',1440,false,'&error=submit')
  await page.getByRole('button',{name:'진단 시작',exact:true}).click()
  for(let i=0;i<6;i++) await page.getByRole('button',{name:'알아요',exact:true}).click()
  await expect(page.getByText('검증용 연결 실패',{exact:true})).toBeVisible()
  await shot(page,'diagnostic-error')
  await page.getByRole('button',{name:'답한 그대로 다시 제출'}).click()
  await expect(page.getByText('진단 완료 · 내 수준은')).toBeVisible()
  await safe(page)
})
