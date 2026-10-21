// scripts/design/__tests__/render-evidence.test.mjs
import assert from 'node:assert/strict'
import test from 'node:test'
import {matchRoute, reportEvidence, summarizeCoverage} from '../lib/render-evidence.mjs'
const inventory = ['/hub','/login','/library/books','/library/books/[id]','/fit/s/[payload]'].map(route => ({route}))
test('explicit failures, login redirects and unknown success never become render passes', () => {
  const rows = [
    {route:'/hub',landed:'/hub',ok:false,m:{h1:{text:'hub'}}},
    {route:'/hub',landed:'/login',ok:true},
    {pathname:'/hub'},
    {pathname:'/hub',ok:true,errorLike:true},
    {pathname:'/diagnostic',ok:true,loadingLike:true},
    {pathname:'/hub',ok:true,status:500},
    {pathname:'/join/invalid',ok:true,headings:['이 초대 링크는 확인할 수 없어요']},
    {pathname:'/library/textbooks/reading/1/practice',ok:true,accessGate:true},
    {pathname:'/comics/restored/example',ok:true,normalContent:false},
  ]
  assert.deepEqual(reportEvidence(rows), [])
})
test('all modern report containers and query URLs resolve actual pathnames', () => {
  for (const key of ['renders','rows','results']) {
    assert.equal(reportEvidence({[key]:[{ok:true,pathname:'/library/books?view=all'}]})[0].route,'/library/books')
  }
  assert.equal(reportEvidence({scope:'real public routes, anonymous',renders:[{ok:true,route:'/library/books'}]}).length,1)
  assert.equal(reportEvidence([{ok:true,url:'https://www.tines.com/library/'}]).length,0)
  assert.equal(reportEvidence([{ok:true,url:'https://example.invalid/hub'}]).length,0)
})
test('isolated evidence and repeated conditions cannot satisfy four-condition normal coverage', () => {
  const isolated = reportEvidence({scope:'isolated fixtures',rows:[{ok:true,pathname:'/hub',width:1440,theme:'light'}]},{current:true,file:'isolated'})
  let rows = summarizeCoverage(inventory, isolated)
  assert.equal(rows[0].current,false);assert.equal(rows[0].isolatedOnly,true)
  const evidence = ['light','dark'].flatMap(theme => [1440,1280].map(width => ({route:'/hub',width,theme,current:true,file:'current',isolated:false})))
  rows=summarizeCoverage(inventory,evidence)
  assert.equal(rows[0].fourConditions,true)
  assert.equal(summarizeCoverage(inventory,Array(4).fill(evidence[0]))[0].fourConditions,false)
})
test('static routes win over dynamic routes and shared results retain their own route', () => {
  assert.equal(matchRoute('/library/books',[{route:'/library/[id]'},{route:'/library/books'}]),'/library/books')
  assert.equal(matchRoute('/fit/s/abc',inventory),'/fit/s/[payload]')
  assert.equal(matchRoute('/admin',inventory),null)
})
