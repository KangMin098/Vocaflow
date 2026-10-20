// apps/web/tests/e2e/admin-dialog-stack.spec.ts
// Real React/Dialog/hooks in Chromium, isolated from auth/DB and additional DOM-test dependencies.
import http from 'node:http'
import path from 'node:path'
import { createRequire } from 'node:module'
import { test, expect } from '@playwright/test'
import { adminFixtureCss } from './_support/admin-fixture-css'

const web = path.resolve(__dirname, '../..')
const root = path.resolve(web, '../..')
const requireTool = createRequire(path.join(web, 'package.json'))
let server: http.Server, origin: string
test.beforeAll(async () => {
  const { build } = requireTool(requireTool.resolve('esbuild', { paths: [path.join(root, 'node_modules/.pnpm/node_modules')] }))
  const bundle = await build({
    stdin: { resolveDir: web, loader: 'tsx', contents: `
      import {StrictMode,startTransition,useCallback,useEffect,useRef,useState} from 'react'; import {createRoot} from 'react-dom/client';
      import {Dialog} from './src/components/ui/Dialog';
      import {useFocusTrap} from './src/lib/ui/use-focus-trap';
      import {adminTextInk} from './src/lib/admin/text-ink';
      import {VcbCurationList} from './src/components/admin/vcb/VcbCurationList';
      import {Heatmap} from './src/components/csat/Heatmap';
      window.historySequence=[];window.routerSnapshots=[];window.addEventListener('popstate',()=>{window.historySequence.push('router');window.routerSnapshots.push(location.search)});
      function HistoryExample(){
        const [open,O]=useState(false),[pending,P]=useState(false),after=useRef(null);
        const clean='/?fixture=history&source=gutenberg';
        useEffect(()=>{
          const restore=()=>{const selected=new URL(location.href).searchParams.has('selected');startTransition(()=>O(selected))};
          const push=history.pushState.bind(history),replace=history.replaceState.bind(history);
          const patch=original=>(data,title,url)=>{if(!data?.__NA){const selected=new URL(url??location.href,location.href).searchParams.has('selected');startTransition(()=>O(selected));data={...data,__NA:true,__PRIVATE_NEXTJS_INTERNALS_TREE:history.state?.__PRIVATE_NEXTJS_INTERNALS_TREE}}return original(data,title,url)};
          history.pushState=patch(push);history.replaceState=patch(replace);
          window.addEventListener('popstate',restore);
          return()=>{window.removeEventListener('popstate',restore);history.pushState=push;history.replaceState=replace}
        },[]);
        const close=()=>{history.replaceState(null,'',clean);O(false)};
        return <><button data-focus-restore-id="history-opener" onClick={()=>{history.replaceState({...history.state,__NA:true,retained:'router-state'},'',clean+'&selected=one');O(true)}}>선택 상세 열기</button>
          {open&&<Dialog title="선택 이력 상세" onClose={close} closeDisabled={pending} historyReturnHref={clean} afterUnwindRef={after}>
            <button onClick={()=>P(!pending)}>{pending?'작업 종료':'작업 시작'}</button>
            <button disabled={pending} onClick={()=>{after.current=()=>{window.historySequence.push('navigate');history.pushState({...history.state,__NA:true},'','/destination')};close()}}>검수로 이동</button>
          </Dialog>}
        </>
      }
      function ReplacementExample(){const [open,O]=useState(false),[version,V]=useState(0),[disabled,D]=useState(false);window.replaceFocusOpener=(disabled=false)=>{D(disabled);V(v=>v+1)};return <><button key={version} data-version={version} data-focus-restore-id="book:one" disabled={disabled} onClick={()=>O(true)}>교체되는 도서</button><button>다른 작업</button>{open&&<Dialog title="교체 상세" onClose={()=>O(false)}><p>목록이 새로 렌더링되어도 논리적 도서 위치를 유지합니다.</p></Dialog>}</>}
      function SearchExample(){const panel=useRef(null),input=useRef(null);useFocusTrap(true,panel);useEffect(()=>{input.current.focus()},[]);return <div ref={panel} role="dialog" aria-label="검색 시작" tabIndex={-1}><input ref={input} aria-label="문항 검색"/></div>}
      function MapExample(){const [picked,P]=useState('없음');return <><output aria-label="지도 선택">{picked}</output><Heatmap data={{years:[2025,2026],max:2,rows:[{typeId:'R-PURPOSE',name:'목적 파악',total:3,recent:3,cells:[{year:2025,n:2,hard:1},{year:2026,n:1,hard:0}]}]}} onPick={(type,year)=>P(type+':'+year)}/></>}
      function VCBExample(){const [selected,S]=useState(null),[ids,I]=useState(new Set());return <>
        <output aria-label="상세 선택">{selected??'없음'}</output>
        <div style={{height:300,display:'flex'}}><VcbCurationList items={[{queue_id:1,lemma:'evidence',pos:'noun',cefr:null,qa_flags:[],seed_origin:'manual',latest_decision:null}]} selectedId={selected} selectedIds={ids} onSelect={S} onToggleMultiSelect={id=>I(ids.has(id)?new Set():new Set([id]))}/></div>
        {['var(--memory-stable)','var(--memory-shaky)','var(--memory-risk)','var(--memory-new)','var(--learn-known)','var(--learn-review)','var(--active)'].map((color,i)=><span data-ink-sample={i} style={{display:'block',color:adminTextInk(color),background:'var(--bg2)'}}>상태 글자</span>)}
      </>}
      function Example(){const initial=location.search.includes('initial=1');const [parent,P]=useState(initial),[child,C]=useState(initial),[pending,B]=useState(false),[childPending,CP]=useState(false);const closeParent=useCallback(()=>P(false),[]),closeChild=useCallback(()=>C(false),[]);return <>
        <button data-focus-restore-id="parent-opener" onClick={()=>P(true)}>목록에서 열기</button>
        {parent&&<Dialog title="부모 상세" onClose={closeParent} closeDisabled={pending}><button data-focus-restore-id="child-opener" onClick={()=>C(true)}>확인 열기</button><button onClick={()=>B(!pending)}>{pending?'작업 종료':'작업 시작'}</button>
          {child&&<Dialog title="중첩 확인" onClose={closeChild} closeDisabled={childPending}><button disabled={childPending} onClick={()=>C(false)}>취소</button><button>실행</button><button onClick={()=>CP(!childPending)}>{childPending?'하위 작업 종료':'하위 작업 시작'}</button></Dialog>}
        </Dialog>}</>};createRoot(document.getElementById('root')!).render(<StrictMode>{location.search.includes('fixture=search')?<SearchExample/>:location.search.includes('fixture=history')?<HistoryExample/>:location.search.includes('fixture=replacement')?<ReplacementExample/>:location.search.includes('fixture=map')?<MapExample/>:location.search.includes('fixture=vcb')?<VCBExample/>:<Example/>}</StrictMode>);
    ` },
    bundle: true, write: false, format: 'iife', jsx: 'automatic', alias: { '@': path.join(web, 'src') },
    define: { 'process.env.NODE_ENV': '"development"' },
  })
  const css = await adminFixtureCss(web)
  server = http.createServer((req, res) => {
    if (req.method !== 'GET') { res.writeHead(405); res.end(); return }
    res.setHeader('content-type', 'text/html; charset=utf-8')
    res.end(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>중첩 Dialog 회귀</title><style>${css}</style></head><body><main id="root" data-area="admin"></main><script>${bundle.outputFiles[0].text}</script></body></html>`)
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  origin = `http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}`
})
test.afterAll(async () => { if (server) await new Promise<void>(resolve => server.close(() => resolve())) })
test.beforeEach(async ({ page }) => {
  await page.goto(`${origin}/?source=gutenberg`)
  await page.evaluate(() => history.replaceState({ retained: 'router-state' }, ''))
})

test('선택 상세의 이전 이력에는 닫힌 목록 URL을 보관한다', async ({ page }) => {
  await page.goto(`${origin}/?fixture=history&source=gutenberg`)
  await page.getByRole('button', { name: '선택 상세 열기', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => (window as unknown as { routerSnapshots: string[] }).routerSnapshots)).toEqual(['?fixture=history&source=gutenberg'])
  expect(await page.evaluate(() => history.state.retained)).toBe('router-state')
})

test('선택 이력을 걷은 뒤 검수 이동이 Router 복원보다 늦게 실행된다', async ({ page }) => {
  await page.goto(`${origin}/?fixture=history&source=gutenberg`)
  await page.getByRole('button', { name: '선택 상세 열기', exact: true }).click()
  await page.getByRole('button', { name: '검수로 이동', exact: true }).click()
  await expect(page).toHaveURL(`${origin}/destination`)
  expect(await page.evaluate(() => (window as unknown as { historySequence: string[] }).historySequence)).toEqual(['router', 'navigate'])
  expect(await page.evaluate(() => (window as unknown as { routerSnapshots: string[] }).routerSnapshots)).toEqual(['?fixture=history&source=gutenberg'])
})

test('선택 URL의 작업 중 Back 거부가 Router에도 열린 상세를 유지한다', async ({ page }) => {
  await page.goto(`${origin}/?fixture=history&source=gutenberg`)
  await page.getByRole('button', { name: '선택 상세 열기', exact: true }).click()
  await page.getByRole('button', { name: '작업 시작', exact: true }).click()
  await expect(page.getByRole('button', { name: '작업 종료', exact: true })).toBeVisible()
  await expect.poll(() => page.evaluate(() => history.state?.vocaflowOverlay === true)).toBe(true)
  await page.evaluate(() => history.back())
  await expect.poll(() => page.evaluate(() => history.state?.vocaflowOverlay === true)).toBe(true)
  await expect(page.getByRole('dialog', { name: '선택 이력 상세' })).toBeVisible()
  await expect(page).toHaveURL(/selected=one/)
  expect(await page.evaluate(() => (window as unknown as { routerSnapshots: string[] }).routerSnapshots)).toEqual(['?fixture=history&source=gutenberg&selected=one'])
  await page.getByRole('button', { name: '작업 종료', exact: true }).click()
  await page.evaluate(() => history.back())
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page).not.toHaveURL(/selected=/)
  expect(await page.evaluate(() => history.state.retained)).toBe('router-state')
})

test('pending 중 두 이력을 건너뛰어도 닫기는 목록 이전까지 되감지 않는다', async ({ page }) => {
  await page.goto(`${origin}/?fixture=history&source=gutenberg`)
  await page.evaluate(() => {
    history.replaceState({ ...history.state, retained: 'previous' }, '', '/?fixture=history&source=previous')
    history.pushState({ ...history.state, __NA: true, retained: 'router-state' }, '', '/?fixture=history&source=gutenberg')
  })
  await page.getByRole('button', { name: '선택 상세 열기', exact: true }).click()
  await page.getByRole('button', { name: '작업 시작', exact: true }).click()
  await expect.poll(() => page.evaluate(() => Boolean(history.state?.vocaflowPendingId))).toBe(true)
  await page.evaluate(() => history.go(-2))
  await expect.poll(() => page.evaluate(() => (window as unknown as { routerSnapshots: string[] }).routerSnapshots.length)).toBe(1)
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page).toHaveURL(/selected=one/)
  await page.getByRole('button', { name: '작업 종료', exact: true }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page).toHaveURL(`${origin}/?fixture=history&source=gutenberg`)
  await page.evaluate(() => history.back())
  await expect(page).toHaveURL(`${origin}/?fixture=history&source=previous`)
})

test('pending 중 부모 이력까지 건너뛴 중첩 팝업은 부모와 목록 이력을 복구한다', async ({ page }) => {
  await page.evaluate(() => {
    history.replaceState({ retained: 'previous' }, '', '/?source=previous')
    history.pushState({ retained: 'router-state' }, '', '/?source=gutenberg')
  })
  await openBoth(page)
  await page.getByRole('button', { name: '하위 작업 시작', exact: true }).click()
  await expect.poll(() => page.evaluate(() => Boolean(history.state?.vocaflowPendingId))).toBe(true)
  await page.evaluate(() => history.go(-3))
  await expect.poll(() => page.evaluate(() => (window as unknown as { routerSnapshots: string[] }).routerSnapshots.length)).toBe(1)
  await expect(page.getByRole('dialog', { name: '중첩 확인' })).toBeVisible()
  await page.getByRole('button', { name: '하위 작업 종료', exact: true }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: '중첩 확인' })).toHaveCount(0)
  await expect(page.getByRole('dialog', { name: '부모 상세' })).toBeVisible()
  await page.evaluate(() => history.back())
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page).toHaveURL(`${origin}/?source=gutenberg`)
  await page.evaluate(() => history.back())
  await expect(page).toHaveURL(`${origin}/?source=previous`)
})

for (const previousPath of ['/?fixture=history&source=gutenberg', '/previous']) {
  test('pending 다중 이동은 같은 URL의 다른 상태와 다른 경로의 Router tree를 구분한다: ' + previousPath, async ({ page }) => {
    await page.goto(origin + '/?fixture=history&source=gutenberg')
    await page.evaluate(previous => {
      history.replaceState({ __NA: true, retained: 'previous', __PRIVATE_NEXTJS_INTERNALS_TREE: 'previous-tree' }, '', previous)
      history.pushState({ __NA: true, retained: 'router-state', __PRIVATE_NEXTJS_INTERNALS_TREE: 'list-tree' }, '', '/?fixture=history&source=gutenberg')
    }, previousPath)
    await page.getByRole('button', { name: '선택 상세 열기', exact: true }).click()
    await page.getByRole('button', { name: '작업 시작', exact: true }).click()
    await expect.poll(() => page.evaluate(() => Boolean(history.state?.vocaflowPendingId))).toBe(true)
    await page.evaluate(() => history.go(-3))
    await expect.poll(() => page.evaluate(() => (window as unknown as { routerSnapshots: string[] }).routerSnapshots.length)).toBe(1)
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page).toHaveURL(/selected=one/)
    expect(await page.evaluate(() => history.state.__PRIVATE_NEXTJS_INTERNALS_TREE)).toBe('list-tree')
    await page.getByRole('button', { name: '작업 종료', exact: true }).click()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page).toHaveURL(origin + '/?fixture=history&source=gutenberg')
    await expect.poll(() => page.evaluate(() => history.state.retained)).toBe('router-state')
    await page.evaluate(() => history.back())
    await expect.poll(() => page.evaluate(() => history.state.retained)).toBe('previous')
    await expect(page).toHaveURL(origin + previousPath)
  })
}

async function closeReplacement(page: import('@playwright/test').Page) {
  await page.goto(`${origin}/?fixture=replacement`)
  await page.getByRole('button', { name: '교체되는 도서', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: '교체되는 도서', exact: true })).toBeFocused()
}

test('닫힌 뒤 RSC가 트리거 DOM을 교체해도 같은 도서로 포커스를 복원한다', async ({ page }) => {
  await closeReplacement(page)
  const old = await page.getByRole('button', { name: '교체되는 도서', exact: true }).elementHandle()
  await page.evaluate(() => (window as unknown as { replaceFocusOpener: () => void }).replaceFocusOpener())
  await expect.poll(() => old!.evaluate(el => el.isConnected)).toBe(false)
  await expect(page.getByRole('button', { name: '교체되는 도서', exact: true })).toHaveAttribute('data-version', '1')
  await expect(page.getByRole('button', { name: '교체되는 도서', exact: true })).toBeFocused()
})

test('다른 작업의 포커스는 후속 트리거 교체가 덮지 않는다', async ({ page }) => {
  await closeReplacement(page)
  await page.getByRole('button', { name: '다른 작업', exact: true }).focus()
  await page.evaluate(() => (window as unknown as { replaceFocusOpener: () => void }).replaceFocusOpener())
  await expect(page.getByRole('button', { name: '교체되는 도서', exact: true })).toHaveAttribute('data-version', '1')
  await expect(page.getByRole('button', { name: '다른 작업', exact: true })).toBeFocused()
})

test('비활성 교체 요소를 건너뛰고 다음 사용자 포커스를 유지한다', async ({ page }) => {
  await closeReplacement(page)
  await page.evaluate(() => (window as unknown as { replaceFocusOpener: (disabled: boolean) => void }).replaceFocusOpener(true))
  await expect(page.getByRole('button', { name: '교체되는 도서', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: '교체되는 도서', exact: true })).not.toBeFocused()
  await page.getByRole('button', { name: '다른 작업', exact: true }).focus()
  await page.evaluate(() => (window as unknown as { replaceFocusOpener: (disabled: boolean) => void }).replaceFocusOpener(false))
  await expect(page.getByRole('button', { name: '교체되는 도서', exact: true })).toBeEnabled()
  await expect(page.getByRole('button', { name: '다른 작업', exact: true })).toBeFocused()
})

test('다른 경로로 이동하면 이전 도서의 복원 감시를 끝낸다', async ({ page }) => {
  await closeReplacement(page)
  await page.evaluate(() => { history.pushState({}, '', '/other'); (window as unknown as { replaceFocusOpener: () => void }).replaceFocusOpener() })
  await expect(page.getByRole('button', { name: '교체되는 도서', exact: true })).toHaveAttribute('data-version', '1')
  await expect(page.getByRole('button', { name: '교체되는 도서', exact: true })).not.toBeFocused()
  await page.evaluate(() => { history.replaceState({}, '', '/?fixture=replacement'); (window as unknown as { replaceFocusOpener: () => void }).replaceFocusOpener() })
  await expect(page.getByRole('button', { name: '교체되는 도서', exact: true })).toHaveAttribute('data-version', '2')
  await expect(page.getByRole('button', { name: '교체되는 도서', exact: true })).not.toBeFocused()
})

test('지도 셀은 44px이며 화살표 이동·선택과 한 개의 탭 정거장을 유지한다', async ({ page }) => {
  await page.goto(`${origin}/?fixture=map`)
  const cells = page.getByRole('region', { name: '유형별 연도 격자' }).getByRole('button')
  await expect(cells).toHaveCount(2)
  for (const cell of await cells.all()) {
    const box = await cell.boundingBox()
    expect(box?.width).toBeGreaterThanOrEqual(44)
    expect(box?.height).toBeGreaterThanOrEqual(44)
  }
  await cells.first().focus()
  await page.keyboard.press('ArrowRight')
  await expect(cells.nth(1)).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByLabel('지도 선택')).toHaveText('R-PURPOSE:2026')
  await expect(page.getByRole('region', { name: '유형별 연도 격자' }).locator('button[tabindex="0"]')).toHaveCount(1)
})
async function openBoth(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: '목록에서 열기' }).click()
  await page.getByRole('button', { name: '확인 열기' }).click()
  await expect(page.getByRole('dialog', { name: '중첩 확인' })).toBeVisible()
}

test('여러 이력 이동은 건너뛴 중첩 창을 함께 닫고 목록 이력을 보존한다', async ({ page }) => {
  await page.evaluate(() => {
    history.replaceState({ retained: 'previous' }, '', '/?source=previous')
    history.pushState({ retained: 'router-state' }, '', '/?source=gutenberg')
  })
  await openBoth(page)
  await page.evaluate(() => history.go(-2))
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(await page.evaluate(() => history.state.retained)).toBe('router-state')
  await page.evaluate(() => history.back())
  await expect(page).toHaveURL(`${origin}/?source=previous`)
})

test('검색 입력의 명시적 초기 포커스를 지연된 공용 포커스가 덮지 않는다', async ({ page }) => {
  await page.goto(`${origin}/?fixture=search`)
  await expect(page.getByRole('textbox', { name: '문항 검색' })).toBeFocused()
  await page.keyboard.type('evidence')
  await expect(page.getByRole('textbox', { name: '문항 검색' })).toHaveValue('evidence')
})

test('pending 부모를 건너뛰는 정상 자식의 다중 이동도 전체 거부한다', async ({ page }) => {
  await page.evaluate(() => {
    history.replaceState({ retained: 'previous' }, '', '/?source=previous')
    history.pushState({ retained: 'router-state' }, '', '/?source=gutenberg')
  })
  await page.getByRole('button', { name: '목록에서 열기' }).click()
  await page.getByRole('button', { name: '작업 시작', exact: true }).click()
  await expect.poll(() => page.evaluate(() => Boolean(history.state?.vocaflowPendingId))).toBe(true)
  await page.getByRole('button', { name: '확인 열기' }).click()
  await page.evaluate(() => history.go(-3))
  await expect.poll(() => page.evaluate(() => (window as unknown as { routerSnapshots: string[] }).routerSnapshots.length)).toBe(1)
  await expect(page.getByRole('dialog', { name: '중첩 확인' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: '중첩 확인' })).toHaveCount(0)
  await expect(page.getByRole('dialog', { name: '부모 상세' })).toBeVisible()
  await page.getByRole('button', { name: '작업 종료', exact: true }).click()
  await page.evaluate(() => history.back())
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => Boolean(history.state?.vocaflowOverlayId))).toBe(false)
  expect(await page.evaluate(() => history.state.retained)).toBe('router-state')
  await page.evaluate(() => history.back())
  await expect(page).toHaveURL(`${origin}/?source=previous`)
})
test('중첩의 Tab/Escape만 처리하고 부모 포커스와 Router 상태를 보존한다', async ({ page }) => {
  await openBoth(page)
  await page.getByRole('button', { name: '실행', exact: true }).focus()
  await page.keyboard.press('Tab')
  expect(await page.getByRole('dialog', { name: '중첩 확인' }).evaluate(e => e.contains(document.activeElement))).toBe(true)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: '중첩 확인' })).toHaveCount(0)
  await expect(page.getByRole('dialog', { name: '부모 상세' })).toBeVisible()
  await expect(page.getByRole('button', { name: '확인 열기' })).toBeFocused()
  await expect.poll(() => page.evaluate(() => history.state.retained)).toBe('router-state')
})
test('브라우저 뒤로가기는 최상위 팝업 하나씩 닫고 목록 자리로 돌아온다', async ({ page }) => {
  await openBoth(page)
  await page.evaluate(() => history.back())
  await expect(page.getByRole('dialog', { name: '중첩 확인' })).toHaveCount(0)
  await expect(page.getByRole('dialog', { name: '부모 상세' })).toBeVisible()
  await page.evaluate(() => history.back())
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '목록에서 열기' })).toBeFocused()
  expect(new URL(page.url()).search).toBe('?source=gutenberg')
})
test('StrictMode 재실행과 취소 후 부모 유지·최종 포커스 복원을 보장한다', async ({ page }) => {
  await openBoth(page)
  await page.getByRole('button', { name: '취소', exact: true }).click()
  await expect(page.getByRole('dialog', { name: '중첩 확인' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '확인 열기' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '목록에서 열기' })).toBeFocused()
})

test('처음부터 중첩된 StrictMode 팝업은 자동으로 닫히지 않고 자식 포커스를 유지한다', async ({ page }) => {
  await page.goto(`${origin}/?initial=1`)
  const child = page.getByRole('dialog', { name: '중첩 확인' })
  await expect(child).toBeFocused()
  await page.waitForTimeout(180)
  await expect(child).toBeVisible()
  await child.getByRole('button', { name: '실행', exact: true }).click()
  await page.keyboard.press('Tab')
  expect(await child.evaluate(e => e.contains(document.activeElement))).toBe(true)
  await page.keyboard.press('Escape')
  await expect(child).toHaveCount(0)
  await expect(page.getByRole('dialog', { name: '부모 상세' })).toBeVisible()
  await expect(page.getByRole('dialog', { name: '부모 상세' })).toBeFocused()
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden')
  await page.evaluate(() => history.back())
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('')
  expect(new URL(page.url()).search).toBe('?initial=1')
})

test('작업 중 Back으로 닫기를 거부해도 다음 Back의 목록 이력을 보존한다', async ({ page }) => {
  await page.getByRole('button', { name: '목록에서 열기' }).click()
  await page.getByRole('button', { name: '작업 시작' }).click()
  await page.evaluate(() => history.back())
  await expect.poll(() => page.evaluate(() => history.state?.vocaflowOverlay === true)).toBe(true)
  await expect(page.getByRole('dialog', { name: '부모 상세' })).toBeVisible()
  await page.getByRole('button', { name: '작업 종료' }).click()
  await page.evaluate(() => history.back())
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(new URL(page.url()).search).toBe('?source=gutenberg')
  expect(await page.evaluate(() => history.state.retained)).toBe('router-state')
})

test('어휘 다중 선택과 상세 버튼은 독립된 키보드 동작이다', async ({ page }) => {
  await page.goto(`${origin}/?fixture=vcb`)
  const checkbox = page.getByRole('checkbox', { name: 'evidence 선택' })
  await checkbox.focus()
  await page.keyboard.press('Space')
  await expect(checkbox).toBeChecked()
  await expect(page.getByLabel('상세 선택')).toHaveText('없음')
  await page.getByRole('button', { name: /evidence/ }).click()
  await expect(page.getByLabel('상세 선택')).toHaveText('1')
  await expect(checkbox).toBeChecked()
  expect(await checkbox.evaluate(el => el.closest('button'))).toBeNull()
})

test('상태 글자는 두 테마의 실제 토큰에서 AA 대비를 만족한다', async ({ page }) => {
  await page.goto(`${origin}/?fixture=vcb`)
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--p').trim().toLowerCase())).toBe('#0d0d17')
  for (const theme of ['light', 'dark']) {
    await page.evaluate(t => { document.documentElement.classList.toggle('dark',t==='dark'); document.documentElement.dataset.theme=t },theme)
    const ratios = await page.locator('[data-ink-sample]').evaluateAll(elements => {
      const luminance = (color: string) => {
        const rgb = color.match(/[\d.]+/g)!.slice(0,3).map(Number).map(c => {const v=c/255;return v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4})
        return 0.2126*rgb[0]+0.7152*rgb[1]+0.0722*rgb[2]
      }
      return elements.map(el => {const css=getComputedStyle(el),a=luminance(css.color),b=luminance(css.backgroundColor);return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05)})
    })
    for (const ratio of ratios) expect(ratio, `${theme} 상태 글자 대비`).toBeGreaterThanOrEqual(4.5)
  }
})
