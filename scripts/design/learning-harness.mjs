// scripts/design/learning-harness.mjs
// 로컬 전용 컴포넌트 QA 서버. .env를 읽지 않고 Supabase/서버 액션을 번들에서 제거한다.
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { ROOT } from './lib/ref-page.mjs'
const require = createRequire(path.join(ROOT,'apps/web/package.json'))
const tsxRequire = createRequire(require.resolve('tsx'))
const { build } = tsxRequire('esbuild')
const postcss = require('postcss'), tailwind = require('tailwindcss')
const before = process.argv.includes('--before')
const src = path.join(ROOT,'apps/web/src'), out = path.join(ROOT,`tmp/tines-adoption/learning-harness${before?'-before':''}`)
const original = file => execFileSync('git',['show',`c577441bd:${path.relative(ROOT,file).replaceAll('\\','/')}`],{cwd:ROOT,encoding:'utf8'})
fs.mkdirSync(out,{recursive:true})
const boundary = path.join(ROOT,'apps/web/tests/design/learning-boundary.mjs')
const blocked = /supabase|\/actions$|\/plan-actions$|\/weekly-report$|\/manage-overview$|\/memory-horizon$|\/recent-activity-query$|\/enroll$|\/flush-actions$|\/record-score$|\/flush-session$|\/SessionFrame$|\/Toast$|\/learning-records$/
const bundled = await build({entryPoints:[path.join(ROOT,'apps/web/tests/design/learning-harness.tsx')],outfile:path.join(out,'bundle.js'),bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',loader:{'.css':'css'},metafile:true,plugins:[{name:'db-isolation',setup(builder){builder.onResolve({filter:/.*/},args=>{
  if(blocked.test(args.path) || ['next/navigation','next/image','next/link'].includes(args.path) || (before && /LearningPathArt$/.test(args.path))) return {path:boundary}
  if(args.path.startsWith('@/')) return {path:path.resolve(src,args.path.slice(2)) + (path.extname(args.path)?'':resolveExtension(args.path.slice(2)))}
});if(before) builder.onLoad({filter:/\.(tsx|ts)$/},args=>args.path.startsWith(src)?{contents:original(args.path),loader:args.path.endsWith('.tsx')?'tsx':'ts'}:null)}}]})
function resolveExtension(relative) {for(const suffix of ['.tsx','.ts','.mjs','.js','/index.ts','/index.tsx']) if(fs.existsSync(path.join(src,relative+suffix))) return suffix;throw new Error(`소스 없음 ${relative}`)}
const inputs = Object.keys(bundled.metafile.inputs)
if(inputs.some(file=>/supabase[\\/](client|server)|library[\\/]vocab[\\/]actions|srs[\\/]flush-actions/.test(file))) throw new Error('실 DB 경계가 번들에 들어왔다')
for(const file of bundled.outputFiles) fs.writeFileSync(path.join(out,file.path.endsWith('.css')?'bundle.css':'bundle.js'),file.contents)
const config = require('tailwindcss/loadConfig')(path.join(ROOT,'apps/web/tailwind.config.ts'))
const globals = (before?original(path.join(src,'app/globals.css')):fs.readFileSync(path.join(src,'app/globals.css'),'utf8')).replace(/^@import.+;\r?\n/gm,'')
const css = await postcss([tailwind({...config,content:[path.join(src,'**/*.{tsx,ts}')]} )]).process(globals,{from:path.join(src,'app/globals.css')})
const tokens = ['tokens.css','skins/tines.css',...(before?[]:['skins/tines-learning.css'])].map(file=>fs.readFileSync(path.join(ROOT,'packages/design-tokens/src',file),'utf8')).join('\n')
fs.writeFileSync(path.join(out,'style.css'),tokens+'\n'+css.css+'\n'+(fs.existsSync(path.join(out,'bundle.css'))?fs.readFileSync(path.join(out,'bundle.css'),'utf8'):'')+'\n:root{--font-display:Arial,sans-serif;--font-serif:Georgia,serif;--font-editorial:Georgia,serif;--font-mono:monospace;--font-english:Arial,sans-serif;}body{margin:0;background:var(--bg)}')
const html='<!doctype html><html lang="ko" data-skin="tines"><head><meta charset="utf-8"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>'
const server = http.createServer((req,res)=>{
  res.setHeader('X-Vocaflow-Learning-Harness','isolated-component')
  if(req.method!=='GET' && req.method!=='HEAD'){res.statusCode=405;res.end();return}
  const pathname = new URL(req.url,'http://localhost').pathname
  if(pathname==='/'){res.setHeader('Content-Type','text/html');res.end(html);return}
  const root = pathname.startsWith('/illustrations/')?path.join(ROOT,'apps/web/public'):out
  const file=path.resolve(root,'.'+pathname)
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.statusCode=404;res.end();return}
  res.setHeader('Content-Type',file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':file.endsWith('.webp')?'image/webp':'application/octet-stream');res.end(fs.readFileSync(file))
})
const port=before?3030:3031
server.listen(port,'127.0.0.1',()=>console.log(JSON.stringify({url:`http://127.0.0.1:${port}`,realDbModules:0,inputs:inputs.length})))
