import fs from 'node:fs'
const dir='verification/reviews/T-0086-r1-independent'
fs.mkdirSync(dir+'/browser',{recursive:true})
fs.writeFileSync(dir+'/probe.test.tsx',fs.readFileSync('verification/reviews/NEXT-VOCAB-PREPARATION/probe.test.tsx','utf8').replaceAll('Vocaflow-main-serving','Vocaflow-final-product'))
fs.writeFileSync(dir+'/browse-rsc.test.tsx',fs.readFileSync('D:/workspace/Vocaflow-final-product/apps/web/src/app/(main)/wordvault/__tests__/map-preparation.test.tsx','utf8').replace("from '../browse/page'","from 'D:/workspace/Vocaflow-final-product/apps/web/src/app/(main)/wordvault/browse/page'"))
let cfg=fs.readFileSync('verification/reviews/NEXT-VOCAB-PREPARATION/vitest.config.mjs','utf8').replaceAll('Vocaflow-main-serving','Vocaflow-final-product')
const tests=[dir+'/probe.test.tsx',
'D:/workspace/Vocaflow-final-product/apps/web/src/lib/csat/__tests__/map-return-vocab.test.ts',
'D:/workspace/Vocaflow-final-product/apps/web/src/components/wordvault/__tests__/vocab-map-preparation.test.tsx',
'D:/workspace/Vocaflow-final-product/apps/web/src/components/csat/diagnosis/map/__tests__/vocab-learning.test.tsx',
dir+'/browse-rsc.test.tsx']
cfg=cfg.replace("include:['verification/reviews/NEXT-VOCAB-PREPARATION/probe.test.tsx']",'include:'+JSON.stringify(tests))
fs.writeFileSync(dir+'/vitest.config.mjs',cfg)
const old='C:/Users/Administrator/AppData/Local/Temp/claude/d--workspace-Vocaflow/c513ff5b-86ef-44a3-8efd-7925a229614b/scratchpad/t0086-browser'
for(const f of fs.readdirSync(old).filter(f=>/\.(tsx?|mjs|html)$/.test(f)))fs.copyFileSync(old+'/'+f,dir+'/browser/'+f)
fs.writeFileSync(dir+'/browser/main.tsx',"import 'D:/workspace/Vocaflow-final-product/apps/web/src/app/globals.css'\n"+fs.readFileSync(dir+'/browser/main.tsx','utf8'))
let runner=fs.readFileSync(dir+'/browser/r.mjs','utf8')
runner=runner.replace("const { chromium } = req('@playwright/test')","const { chromium } = req('@playwright/test');const tw=req('tailwindcss/loadConfig')(`${wt}/apps/web/tailwind.config.ts`);tw.content=[`${wt}/apps/web/src/components/wordvault/**/*.tsx`,`${wt}/apps/web/src/components/csat/diagnosis/map/VocabLearningCard.tsx`,`${wt}/apps/web/src/components/layout/ResourceContext.tsx`,path.join(dir,'main.tsx')]")
runner=runner.replace('configFile: false, root: dir','configFile: false, css:{postcss:{plugins:[req(\'tailwindcss\')(tw)]}}, root: dir')
runner=runner.replace('Tailwind 미적용','source globals/Tailwind applied')
fs.writeFileSync(dir+'/browser/r.mjs',runner)
