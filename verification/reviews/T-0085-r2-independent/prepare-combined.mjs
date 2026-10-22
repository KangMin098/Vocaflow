import fs from 'node:fs'
const dir='verification/reviews/T-0085-r2-independent'
fs.writeFileSync(dir+'/combined-probe.test.tsx',fs.readFileSync('verification/reviews/T-0085-r1-independent/probe.test.tsx','utf8').replaceAll('Vocaflow-final-product','Vocaflow-main-serving'))
let cfg=fs.readFileSync(dir+'/vitest.config.mjs','utf8').replaceAll('Vocaflow-final-product','Vocaflow-main-serving')
cfg=cfg.replace("include:['verification/reviews/T-0085-r2-independent/probe.test.tsx']",`include:${JSON.stringify([
dir+'/combined-probe.test.tsx',
'D:/workspace/Vocaflow-main-serving/apps/web/src/lib/knowledge/__tests__/trial-evidence-display.test.ts',
'D:/workspace/Vocaflow-main-serving/apps/web/src/lib/knowledge/__tests__/vnext.test.ts',
'D:/workspace/Vocaflow-main-serving/apps/web/src/app/admin/knowledge/__tests__/trial-evidence-display.test.tsx',
'D:/workspace/Vocaflow-main-serving/apps/web/src/app/admin/knowledge/__tests__/application-trace.test.tsx'
])}`)
fs.writeFileSync(dir+'/combined-vitest.config.mjs',cfg)
