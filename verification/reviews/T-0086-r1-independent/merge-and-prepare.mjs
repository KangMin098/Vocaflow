import fs from 'node:fs'
import {execFileSync} from 'node:child_process'
const dir='verification/reviews/T-0086-r1-independent',repo='D:/workspace/Vocaflow-main-serving'
const git=(...args)=>execFileSync('git',args,{cwd:repo,encoding:'utf8'}).trim()
const source='4d8c56a2aa131c0605d6444271dead43bd9ac300'
if(git('branch','--show-current')!=='main'||git('status','--porcelain','--untracked-files=no'))throw new Error('Main not clean')
execFileSync('node',['agents/scripts/lock.mjs','acquire','codex','--pid','19700'],{cwd:repo,stdio:'inherit'})
const base=git('rev-parse','HEAD')
if(!base.startsWith('77717aedf')||git('status','--porcelain','--untracked-files=no')){execFileSync('node',['agents/scripts/lock.mjs','release','codex','--pid','19700'],{cwd:repo,stdio:'inherit'});throw new Error('Main moved; review required')}
execFileSync('git',['merge','--no-ff','--no-commit',source],{cwd:repo,stdio:'inherit'})
fs.writeFileSync(dir+'/merge-base.json',JSON.stringify({base,source,files:git('diff','--cached','--name-only').split('\n')},null,2)+'\n')
for(const name of ['probe.test.tsx','browse-rsc.test.tsx'])fs.writeFileSync(dir+'/combined-'+name,fs.readFileSync(dir+'/'+name,'utf8').replaceAll('Vocaflow-final-product','Vocaflow-main-serving'))
let cfg=fs.readFileSync(dir+'/vitest.config.mjs','utf8').replaceAll('Vocaflow-final-product','Vocaflow-main-serving').replaceAll(dir+'/probe.test.tsx',dir+'/combined-probe.test.tsx').replaceAll(dir+'/browse-rsc.test.tsx',dir+'/combined-browse-rsc.test.tsx')
fs.writeFileSync(dir+'/combined-vitest.config.mjs',cfg)
