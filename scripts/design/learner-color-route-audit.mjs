// scripts/design/learner-color-route-audit.mjs — source roles, not rendered/visual acceptance.
import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
import {routeInventory} from './lib/render-evidence.mjs'
const require=createRequire(path.resolve('apps/web/package.json')),esbuild=createRequire(require.resolve('vitest/package.json'))('esbuild')
const out=process.argv[2]||'tmp/learning-color-context'
const built=await esbuild.build({entryPoints:['apps/web/src/lib/design/learner-palette.ts'],bundle:true,write:false,platform:'node',format:'esm',tsconfig:'apps/web/tsconfig.json'})
const{getLearnerPalette,getLearnerColorRole}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].contents).toString('base64'))
const inventory=routeInventory('apps/web/src/app').filter(r=>!r.route.startsWith('/csat'))
const rows=inventory.map(({route,file})=>{
 const text=fs.readFileSync(file,'utf8'),palette=getLearnerPalette(route)
 const directBrandText=[...text.matchAll(/text-\[var\(--(?:p|ju|ju-ink)\)\]/g)].length
 const literalPurple=[...text.matchAll(/#(?:714bd0|5d38ae|542f9c|aa94ff|c3b5ff|6741bf)\b|(?:text|bg|border)-(?:purple|violet|indigo)-\d+/gi)].length
 const serverGetWrite=route.startsWith('/text/[')||route==='/teacher'||route.startsWith('/join/')||route==='/library/scripts/[bookId]'
 return{route,file:file.replaceAll('\\','/'),palette,...getLearnerColorRole(route),directBrandText,literalPurple,sourceScope:'page source counts only; shared imports/rendered visibility not inferred; cadence is a design expectation, not analytics',serverGetWrite,normalRenderVerified:false}
})
fs.mkdirSync(out,{recursive:true})
const report={scope:'Every learner route has a PC color role; source inspection, not 91 rendered passes',counts:{routes:rows.length,assigned:rows.filter(r=>r.palette).length,byPalette:rows.reduce((a,r)=>(a[r.palette]=(a[r.palette]||0)+1,a),{})},rows}
fs.writeFileSync(path.join(out,'route-colors.json'),JSON.stringify(report,null,2));console.log(report.counts)
