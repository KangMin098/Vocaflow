// scripts/research/lm-g1-5a-independent/runner-contract.mjs
import fs from 'node:fs';import path from 'node:path';import {pathToFileURL} from 'node:url'
export function browserJobs(base,local){
 return [
 ['v2-1280','scripts/research/lm-g1-5a-independent/v2-browser.mjs',['--base',base,'--width','1280','--evidence',local+'/v2-1280']],
 ['v2-1440','scripts/research/lm-g1-5a-independent/v2-browser.mjs',['--base',base,'--width','1440','--evidence',local+'/v2-1440']],
 ['t4-1280','scripts/research/lm-g1-4-independent/browser.mjs',['--base',base,'--width','1280','--evidence',local+'/t4-1280']],
 ['t4-1440','scripts/research/lm-g1-4-independent/browser.mjs',['--base',base,'--width','1440','--evidence',local+'/t4-1440']],
 ['t1','scripts/research/lm-g1-1-independent/browser.mjs',['--base',base,'--width','1280','--evidence',local+'/t1']],
 ['t2-1280','scripts/research/lm-g1-2-independent/vertical.mjs',['--base',base,'--width','1280','--evidence',local+'/t2-1280']],
 ['t2-1440','scripts/research/lm-g1-2-independent/vertical.mjs',['--base',base,'--width','1440','--evidence',local+'/t2-1440']],
 ['t3-1280','scripts/csat/map/v62/e2e-lm-g1-3a.mjs',['--base',base,'--width','1280','--evidence',local+'/t3-1280']],
 ['t3-1440','scripts/csat/map/v62/e2e-lm-g1-3a.mjs',['--base',base,'--width','1440','--evidence',local+'/t3-1440']],
 ['security','scripts/research/lm-g1-2-independent/security.mjs',[base]],
 ['workspace','scripts/csat/map/v62/e2e-map-workspace.mjs',['--base',base,'--evidence',local+'/workspace']],
 ['return','scripts/csat/map/v62/e2e-map-return.mjs',['--base',base]],
 ['study','scripts/csat/map/v62/e2e-map-study.mjs',['--base',base]],
 ['supply','scripts/csat/map/v62/e2e-map-supply.mjs',['--base',base]],
 ]
}
export function renderBrowserRunner({root,file,folder,at}){const ownIds=folder+'/owned-accounts.local.json';
  let src=fs.readFileSync(path.join(root,file),'utf8')
  if(file==='scripts/csat/map/v62/e2e-lm-g1-3a.mjs'){const liveDate=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date(Date.parse(at)+90*86400000));src=src.replaceAll('2026-11-19',liveDate)}
  // Only runner location, viewport, hydration and cleanup instrumentation change; assertions remain.
  src=src.replace(/const ROOT = path.resolve\(import.meta.dirname, [^\n]+\n/, 'const ROOT = '+JSON.stringify(root)+'\n')
  src=src.replace("out=root+'/scripts/research/lm-g1-2-independent/local/security'",'out='+JSON.stringify(folder));
  src=src.replace("out=root+'/scripts/research/lm-g1-2-independent/local/late-remount'",'out='+JSON.stringify(folder));
  src=src.replace("out=root+'/scripts/research/lm-g1-2-independent/local/save-unchanged-'+Number(process.argv[3]??1440)",'out='+JSON.stringify(folder));
  src=src.replaceAll('/scripts/research/lm-g1-2-independent/local/','/scripts/research/lm-g1-5a-independent/local/');
  src=src.replaceAll("from './source-loader.mjs'","from "+JSON.stringify(pathToFileURL(root+'/scripts/research/lm-g1-3a-independent/source-loader.mjs').href));
  src=src.replaceAll("from './cleanup.mjs'","from "+JSON.stringify(pathToFileURL(root+'/scripts/research/lm-g1-1-independent/cleanup.mjs').href))
  src=src.replaceAll("from '../../../research/lm-g1-1-independent/cleanup.mjs'","from "+JSON.stringify(pathToFileURL(root+'/scripts/research/lm-g1-1-independent/cleanup.mjs').href))
  src=src.replaceAll("from '../lm-g1-1-independent/cleanup.mjs'","from "+JSON.stringify(pathToFileURL(root+'/scripts/research/lm-g1-1-independent/cleanup.mjs').href))
  src=src.replace("if (scenario === 'unmounted') {", "if (scenario === 'unmounted') {await b.page.screenshot({path:"+JSON.stringify(folder+'/before-unmount.png')+"});fs.writeFileSync("+JSON.stringify(folder+'/before-unmount-dom.local.html')+",await b.page.content());");
  src=src.replace("users.push(u.user.id)","users.push(u.user.id); (await import('node:fs')).writeFileSync("+JSON.stringify(ownIds)+",JSON.stringify(users))")
  src=src.replace("height: 1000","height: 900")
  src=src.replace("await page.fill('input[type=\"email\"]', acc.email)","await page.waitForTimeout(700); await page.fill('input[type=\"email\"]', acc.email)");
  src=src.replace("await page.fill('input[type=\"email\"]', email)","await page.waitForTimeout(700); await page.fill('input[type=\"email\"]', email)")
  if(file.endsWith('/security.mjs')) src=src.replace('const c=await Promise.all([','const secondReq={...req,clientKey:crypto.randomUUID()};const c=await Promise.all([').replace('b.page.request.post(endpoint,{data:{...req,clientKey:crypto.randomUUID()}})','b.page.request.post(endpoint,{data:secondReq})').replace('winnerIndex===0?req:null','winnerIndex===0?req:secondReq')
  if(file.endsWith('/v2-browser.mjs')) src=src.replace(/^const shot = .*$/m,"const shot = async (page,name)=> {await page.waitForTimeout(400); return page.screenshot({path:path.join(EVID,String(++shots).padStart(2,'0')+'-'+name+'.png')})}")
return src
}
