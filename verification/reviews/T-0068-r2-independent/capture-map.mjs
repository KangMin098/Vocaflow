// verification/reviews/T-0068-r2-independent/capture-map.mjs
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {inflateRawSync} from 'node:zlib'
const root='D:/workspace/Vocaflow-AI-Control',folder='C:/Users/Administrator/AppData/Local/Temp/claude/d--workspace-Vocaflow/c513ff5b-86ef-44a3-8efd-7925a229614b/scratchpad/t0068art/e2e-isolated-report/apps/web/playwright-report-isolated'
const html=fs.readFileSync(folder+'/index.html','utf8'),b=Buffer.from(html.match(/data:application\/zip;base64,([A-Za-z0-9+/=\s]+)/)[1],'base64')
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')
const images=new Map(fs.readdirSync(root+'/verification/ui/T-0068').filter(n=>n.endsWith('.png')).map(n=>{const p='verification/ui/T-0068/'+n;return [hash(root+'/'+p),p]}))
const out=[]
function walk(x,title=''){
 if(!x||typeof x!=='object')return
 const name=x.title??title
 if(Array.isArray(x.attachments)&&name.includes('T-0068'))for(const a of x.attachments){
  if(a.contentType!=='image/png')continue
  const p=path.join(folder,a.path??'');if(!fs.existsSync(p))continue
  const sha=hash(p);out.push({test:name,attachment:a.name,capture:images.get(sha),sha256:sha})
 }
 for(const v of Object.values(x))walk(v,name)
}
for(let p=b.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]));p>=0&&b.readUInt32LE(p)===0x02014b50;){
 const method=b.readUInt16LE(p+10),size=b.readUInt32LE(p+20),n=b.readUInt16LE(p+28),e=b.readUInt16LE(p+30),c=b.readUInt16LE(p+32),at=b.readUInt32LE(p+42),name=b.subarray(p+46,p+46+n).toString()
 if(name.endsWith('.json')){const start=at+30+b.readUInt16LE(at+26)+b.readUInt16LE(at+28),data=b.subarray(start,start+size);walk(JSON.parse((method===8?inflateRawSync(data):data).toString()))}
 p+=46+n+e+c
}
const unique=[...new Map(out.map(x=>[x.test+'|'+x.attachment,x])).values()]
fs.writeFileSync(root+'/verification/reviews/T-0068-r2-independent/capture-map.json',JSON.stringify(unique,null,2)+'\n')
console.log(JSON.stringify({unique_attachments:unique.length}))
